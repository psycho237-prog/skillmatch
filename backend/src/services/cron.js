const { query } = require('../config/database');
const { processEscrowPayout } = require('../routes/escrow');
const crypto = require('crypto');

async function resolveExpiredEscrows() {
  try {
    const now = new Date();
    console.log(`[CRON RESOLVER] Running resolver check at: ${now.toISOString()}`);

    // 1. Auto-confirm delivery (PROVIDER_MARKED_DONE + autoResolveAt < now)
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
          console.log(`[CRON] Auto-confirmed escrow ${escrow.id} - delivery completed.`);
        }
      } catch (err) {
        console.error(`[CRON] Failed to auto-confirm escrow ${escrow.id}:`, err);
      }
    }

    // 2. Dispute no proof (DISPUTE_NO_PROOF + autoResolveAt < now) - provider wins
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
          console.log(`[CRON] Auto-resolved dispute-no-proof for escrow ${escrow.id} in provider's favor.`);
        }
      } catch (err) {
        console.error(`[CRON] Failed to resolve dispute-no-proof for escrow ${escrow.id}:`, err);
      }
    }

    // 3. Unresolved dispute with proof (DISPUTED + autoResolveAt < now) - Platform keeps both holds
    const forfeitedRes = await query(
      `SELECT * FROM escrows 
       WHERE status = 'DISPUTED' AND auto_resolve_at < $1`,
      [now]
    );
    for (const escrow of forfeitedRes.rows) {
      try {
        const totalForfeit = parseFloat(escrow.amount_initiator) + parseFloat(escrow.amount_counterparty);

        // Update escrow to FORFEITED
        await query(
          `UPDATE escrows SET status = 'FORFEITED', updated_at = NOW() WHERE id = $1`,
          [escrow.id]
        );

        // Record arbitration transaction
        await query(
          `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
           VALUES ($1, $2, 'ARBITRATION', $3, $4, 'COMPLETED', $5, NOW())`,
          [crypto.randomUUID(), escrow.initiator_id, totalForfeit, escrow.currency, escrow.id]
        );

        console.log(`[CRON] Forfeited escrow ${escrow.id}. Platform keeps arbitration revenue: ${totalForfeit}`);
      } catch (err) {
        console.error(`[CRON] Failed to forfeit escrow ${escrow.id}:`, err);
      }
    }

    // 4. Stale initiations (AWAITING_COUNTERPARTY + createdAt < now - 24h)
    const staleLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleRes = await query(
      `UPDATE escrows 
       SET status = 'CANCELLED', updated_at = NOW() 
       WHERE status = 'AWAITING_COUNTERPARTY' AND created_at < $1`,
      [staleLimit]
    );
    if (staleRes.rowCount > 0) {
      console.log(`[CRON] Cancelled ${staleRes.rowCount} stale escrow initiations.`);
    }

  } catch (error) {
    console.error('[CRON ERROR] resolveExpiredEscrows failed:', error);
  }
}

function startCronScheduler() {
  // Run every 15 minutes (900000 milliseconds)
  setInterval(resolveExpiredEscrows, 15 * 60 * 1000);
  console.log('⏰ SkillPay Escrow Cron Scheduler started (running every 15 minutes)');
  
  // Run once immediately on start for validation
  resolveExpiredEscrows();
}

module.exports = { startCronScheduler };
