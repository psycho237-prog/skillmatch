const { query } = require('../config/database');
const { processEscrowPayout } = require('../routes/escrow');
const crypto = require('crypto');
const { setGlobalIoInstance, reconcilePendingTransactions } = require('./walletReconciler');
const { sendPushNotification } = require('../config/notifications');

async function resolveExpiredEscrows() {
  try {
    const now = new Date();
    console.log(`[CRON RESOLVER] Running resolver check at: ${now.toISOString()}`);

    // Poll and reconcile all pending PawaPay wallet transactions
    await reconcilePendingTransactions(null, null);

    // 1. Auto-confirm delivery (PROVIDER_MARKED_DONE + autoResolveAt < now)
    //    48h passed without buyer confirming → auto-release to provider
    const toConfirmRes = await query(
      `SELECT * FROM escrows 
       WHERE status = 'PROVIDER_MARKED_DONE' AND auto_resolve_at < $1`,
      [now]
    );
    for (const escrow of toConfirmRes.rows) {
      try {
        const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
        if (serviceRes.rowCount > 0) {
          await processEscrowPayout(escrow, serviceRes.rows[0]);
          console.log(`[CRON] Auto-confirmed escrow ${escrow.id} — delivery payment released to provider.`);
        }
      } catch (err) {
        console.error(`[CRON] Failed to auto-confirm escrow ${escrow.id}:`, err);
      }
    }

    // 2. Dispute no proof (DISPUTE_NO_PROOF + autoResolveAt < now) → provider wins
    //    Client disputed without proof → auto-resolve in provider's favor (same as confirm)
    const disputeNoProofRes = await query(
      `SELECT * FROM escrows 
       WHERE status = 'DISPUTE_NO_PROOF' AND auto_resolve_at < $1`,
      [now]
    );
    for (const escrow of disputeNoProofRes.rows) {
      try {
        const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
        if (serviceRes.rowCount > 0) {
          await processEscrowPayout(escrow, serviceRes.rows[0]);
          console.log(`[CRON] Dispute-no-proof resolved for escrow ${escrow.id} — provider wins.`);
        }
      } catch (err) {
        console.error(`[CRON] Failed to resolve dispute-no-proof for escrow ${escrow.id}:`, err);
      }
    }

    // 3. Unresolved dispute with proof (DISPUTED + autoResolveAt < now)
    //    72h passed without admin action → platform keeps all funds (FORFEITED)
    //    Must release pending_balance from both wallets and credit platform account.
    const forfeitedRes = await query(
      `SELECT * FROM escrows 
       WHERE status = 'DISPUTED' AND auto_resolve_at < $1`,
      [now]
    );
    for (const escrow of forfeitedRes.rows) {
      try {
        const amountA = parseFloat(escrow.amount_initiator) || 0;
        const amountB = parseFloat(escrow.amount_counterparty) || 0;
        const totalForfeit = amountA + amountB;

        // Release pending_balance from both wallets (debit pending, don't credit balance — platform keeps it)
        if (amountA > 0) {
          await query(
            'UPDATE wallets SET pending_balance = pending_balance - $1, updated_at = NOW() WHERE user_id = $2',
            [amountA, escrow.initiator_id]
          );
        }
        if (amountB > 0) {
          await query(
            'UPDATE wallets SET pending_balance = pending_balance - $1, updated_at = NOW() WHERE user_id = $2',
            [amountB, escrow.counterparty_id]
          );
        }

        // Credit platform account
        if (totalForfeit > 0) {
          await query(
            `UPDATE platform_account 
             SET balance = balance + $1, total_commissions = total_commissions + $1, total_transactions = total_transactions + 1, updated_at = NOW() 
             WHERE id = 1`,
            [totalForfeit]
          );
        }

        // Mark escrow FORFEITED
        await query(
          `UPDATE escrows SET status = 'FORFEITED', updated_at = NOW() WHERE id = $1`,
          [escrow.id]
        );

        // Record arbitration transactions for both parties
        await query(
          `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
           VALUES ($1, $2, 'ARBITRATION', $3, $4, 'COMPLETED', $5, NOW())`,
          [crypto.randomUUID(), escrow.initiator_id, amountA, escrow.currency, escrow.id]
        );
        await query(
          `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
           VALUES ($1, $2, 'ARBITRATION', $3, $4, 'COMPLETED', $5, NOW())`,
          [crypto.randomUUID(), escrow.counterparty_id, amountB, escrow.currency, escrow.id]
        );

        console.log(`[CRON] Forfeited escrow ${escrow.id}. Platform kept ${totalForfeit} ${escrow.currency} as arbitration fee.`);
      } catch (err) {
        console.error(`[CRON] Failed to forfeit escrow ${escrow.id}:`, err);
      }
    }

    // 4. Stale initiations (AWAITING_COUNTERPARTY + created > 24h ago)
    //    No funds were locked yet at this stage (locking happens on /accept), so just cancel — no wallet refund needed.
    const staleLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleRes = await query(
      `UPDATE escrows 
       SET status = 'CANCELLED', updated_at = NOW() 
       WHERE status = 'AWAITING_COUNTERPARTY' AND created_at < $1
       RETURNING id`,
      [staleLimit]
    );
    if (staleRes.rowCount > 0) {
      console.log(`[CRON] Cancelled ${staleRes.rowCount} stale escrow initiations (no funds were locked).`);
    }

  } catch (error) {
    console.error('[CRON ERROR] resolveExpiredEscrows failed:', error);
  }
}

async function processSubscriptions() {
  try {
    console.log(`[CRON SUB] Running processSubscriptions at: ${new Date().toISOString()}`);

    // Ensure pro_reminder_sent exists
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_reminder_sent BOOLEAN DEFAULT false`);
    } catch (e) { }

    // 1. Process expirations and auto-renewals
    const expiredRes = await query(`
      SELECT id, push_token, auto_renew_pro
      FROM users 
      WHERE subscription_tier = 'premium' AND subscription_expires_at <= NOW()
    `);

    for (const user of expiredRes.rows) {
      if (user.auto_renew_pro) {
        // Fetch price
        const settingsRes = await query("SELECT setting_value FROM platform_settings WHERE setting_key = 'pro_monthly_price'");
        const price = settingsRes.rows[0] ? Number(settingsRes.rows[0].setting_value) : 5000;

        const walletRes = await query('SELECT id, balance FROM wallets WHERE user_id = $1', [user.id]);
        
        if (walletRes.rows.length > 0 && parseFloat(walletRes.rows[0].balance) >= price) {
          const wallet = walletRes.rows[0];
          
          await query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [price, wallet.id]);
          
          const txId = crypto.randomUUID();
          await query(`
            INSERT INTO wallet_transactions (id, user_id, wallet_id, type, amount, balance_before, balance_after, status, description) 
            VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, 'completed', $7)
          `, [txId, user.id, wallet.id, price, wallet.balance, parseFloat(wallet.balance) - price, 'Auto-renouvellement Swapster Pro']);
          
          await query(`
            UPDATE users 
            SET subscription_expires_at = NOW() + interval '1 month', pro_reminder_sent = false, updated_at = NOW() 
            WHERE id = $1
          `, [user.id]);
          
          if (user.push_token) await sendPushNotification(user.push_token, 'Abonnement Renouvelé', 'Votre abonnement Swapster Pro a été renouvelé avec succès!');
          console.log(`[CRON SUB] Auto-renewed Pro for user ${user.id}`);
          continue;
        }
      }
      
      // If no auto-renew or insufficient funds -> Downgrade
      await query(`
        UPDATE users 
        SET subscription_tier = 'free', auto_renew_pro = false, pro_reminder_sent = false, updated_at = NOW() 
        WHERE id = $1
      `, [user.id]);
      
      if (user.push_token) await sendPushNotification(user.push_token, 'Abonnement Expiré', 'Votre abonnement Swapster Pro a expiré.');
      console.log(`[CRON SUB] Downgraded user ${user.id} to free tier.`);
    }

    // 2. 3-day warnings
    const warningsRes = await query(`
      SELECT id, push_token 
      FROM users 
      WHERE subscription_tier = 'premium' 
        AND subscription_expires_at <= NOW() + interval '3 days' 
        AND subscription_expires_at > NOW() 
        AND pro_reminder_sent = false
    `);

    for (const user of warningsRes.rows) {
      await query(`UPDATE users SET pro_reminder_sent = true WHERE id = $1`, [user.id]);
      if (user.push_token) {
        await sendPushNotification(user.push_token, 'Abonnement Bientôt Expiré', 'Votre abonnement Swapster Pro expire dans moins de 3 jours.');
      }
      console.log(`[CRON SUB] Sent 3-day warning to user ${user.id}`);
    }

  } catch (error) {
    console.error('[CRON ERROR] processSubscriptions failed:', error);
  }
}

function startCronScheduler(io) {
  if (io) {
    setGlobalIoInstance(io);
  }

  // Run every 15 minutes
  setInterval(resolveExpiredEscrows, 15 * 60 * 1000);
  setInterval(processSubscriptions, 15 * 60 * 1000);
  console.log('⏰ SkillPay Escrow & Subscriptions Cron Scheduler started (running every 15 minutes)');
  
  // Run once immediately on start
  resolveExpiredEscrows();
  processSubscriptions();
}

module.exports = { startCronScheduler };
