const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { sendPushNotification } = require('../config/notifications');

// POST /api/webhooks/mobile-money/callback
router.post('/mobile-money/callback', async (req, res) => {
  try {
    const payload = req.body;
    
    // Extract transaction ID from PawaPay payload
    const txnId = payload.depositId || payload.payoutId || payload.refundId;
    const status = payload.status;
    
    if (!txnId) {
      return res.status(400).json({ error: 'Missing transaction ID' });
    }

    console.log(`[WEBHOOK] Reçu pour transaction ${txnId} : ${status}`);

    // Fetch local transaction
    const txnRes = await query('SELECT * FROM wallet_transactions WHERE reference_id = $1 FOR UPDATE', [txnId]);
    if (txnRes.rows.length === 0) {
      console.log(`[WEBHOOK] Transaction ${txnId} introuvable localement.`);
      return res.status(200).end(); // Always 200 for PawaPay
    }
    const txn = txnRes.rows[0];

    // Idempotency: if already processed, return 200
    if (txn.status === status.toLowerCase() || txn.status === 'completed' || txn.status === 'failed') {
      return res.status(200).end();
    }

    if (status === 'COMPLETED') {
      if (txn.type === 'deposit') {
        // Credit the user's wallet
        await query(
          'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
          [txn.amount, txn.wallet_id]
        );
        // Mark transaction as completed
        await query(
          "UPDATE wallet_transactions SET status = 'completed' WHERE id = $1", 
          [txn.id]
        );
        // Mark transaction as completed in escrow_transactions
        await query(
          "UPDATE escrow_transactions SET status = 'COMPLETED' WHERE pawapay_deposit_id = $1",
          [txn.reference_id]
        );
        // Send Notification
        await sendPushNotification(
          txn.user_id,
          'Dépôt Réussi 🎉',
          `Votre compte a été crédité de ${txn.amount} FCFA.`,
          { transactionId: txn.id, type: 'deposit' }
        );
        // Socket notify
        notifyUsers(req, [txn.user_id], 'WALLET_DEPOSIT_SUCCESS', {
          title: 'Deposit Successful 🎉',
          body: `Your wallet was credited with ${txn.amount} ${txn.currency || 'FCFA'}.`
        });
      } else if (txn.type === 'withdrawal') {
        // Withdrawal completed: remove from pending_balance
        await query(
          'UPDATE wallets SET pending_balance = pending_balance - $1 WHERE id = $2',
          [txn.amount, txn.wallet_id]
        );
        // Mark transaction as completed
        await query(
          "UPDATE wallet_transactions SET status = 'completed' WHERE id = $1", 
          [txn.id]
        );
        // Mark transaction as completed in escrow_transactions
        await query(
          "UPDATE escrow_transactions SET status = 'COMPLETED' WHERE pawapay_payout_id = $1",
          [txn.reference_id]
        );
        // Send Notification
        await sendPushNotification(
          txn.user_id,
          'Retrait Traité 💸',
          `Votre retrait de ${txn.amount} FCFA a été traité vers votre compte mobile money.`,
          { transactionId: txn.id, type: 'withdrawal' }
        );
        // Socket notify
        notifyUsers(req, [txn.user_id], 'WALLET_WITHDRAWAL_SUCCESS', {
          title: 'Withdrawal Processed 💸',
          body: `Your withdrawal of ${txn.amount} ${txn.currency || 'FCFA'} was processed.`
        });
      }
    } else if (status === 'FAILED') {
      if (txn.type === 'withdrawal') {
        // Refund the failed withdrawal
        await query(
          'UPDATE wallets SET balance = balance + $1, pending_balance = pending_balance - $1 WHERE id = $2',
          [txn.amount, txn.wallet_id]
        );
      }
      // Mark transaction as failed
      await query(
        "UPDATE wallet_transactions SET status = 'failed', description = $1 WHERE id = $2", 
        [`${txn.description} - Echec: ${payload.failureReason?.failureMessage || 'Inconnu'}`, txn.id]
      );
      // Mark transaction as failed in escrow_transactions
      await query(
        "UPDATE escrow_transactions SET status = 'FAILED' WHERE pawapay_deposit_id = $1 OR pawapay_payout_id = $1",
        [txn.reference_id]
      );
      // Send Notification
      const verb = txn.type === 'deposit' ? 'Dépôt' : 'Retrait';
      await sendPushNotification(
        txn.user_id,
        `${verb} Échoué ⚠️`,
        `Votre transaction de ${txn.amount} FCFA n'a pas pu aboutir. Raison: ${payload.failureReason?.failureMessage || 'Inconnue'}.`,
        { transactionId: txn.id, type: txn.type }
      );
      // Socket notify
      const socketVerb = txn.type === 'deposit' ? 'Deposit' : 'Withdrawal';
      notifyUsers(req, [txn.user_id], 'WALLET_TX_FAILED', {
        title: `${socketVerb} Failed ⚠️`,
        body: `Your transaction of ${txn.amount} ${txn.currency || 'FCFA'} failed. Reason: ${payload.failureReason?.failureMessage || 'Unknown'}.`
      });
    } else if (status === 'PROCESSING') {
        // In case of Wave REDIRECT_AUTH, just acknowledge.
    }

    res.status(200).end();
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});


const WHITELIST_IPS = [
  '3.64.89.224',       // Sandbox
  '18.192.208.15',     // Prod
  '18.195.113.136',    // Prod
  '3.72.212.107',      // Prod
  '54.73.125.42',      // Prod
  '54.155.38.214',     // Prod
  '54.73.130.113'      // Prod
];

// Helper to notify via socket.io
function notifyUsers(req, userIds, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  userIds.forEach(id => {
    io.emit(`user_notification_${id}`, { event, payload });
  });
}

// Helper to insert a system message in the chat
async function insertSystemMessage(conversationId, content) {
  try {
    await query(
      'INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES ($1, NULL, $2, false, NOW())',
      [conversationId, content]
    );
  } catch (err) {
    console.error('Failed to insert system message:', err);
  }
}

// POST /pawapay
router.post('/pawapay', async (req, res) => {
  // Always return HTTP 200 immediately (PawaPay retries on anything else)
  res.sendStatus(200);

  // Run the processing asynchronously
  (async () => {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      console.log(`[PAWAPAY WEBHOOK] Callback received from IP: ${clientIp}`);

      // IP Whitelisting (allow localhost for developer testing)
      const isLocalhost = clientIp.includes('127.0.0.1') || clientIp.includes('::1') || clientIp.includes('::ffff:127.0.0.1') || process.env.NODE_ENV !== 'production';
      const isWhitelisted = WHITELIST_IPS.some(ip => clientIp.includes(ip));

      if (!isWhitelisted && !isLocalhost) {
        console.warn(`[PAWAPAY WEBHOOK] Blocked request from non-whitelisted IP: ${clientIp}`);
        return;
      }

      const { depositId, status, amount, currency } = req.body;
      if (!depositId || !status) {
        console.warn('[PAWAPAY WEBHOOK] Missing depositId or status in body');
        return;
      }

      console.log(`[PAWAPAY WEBHOOK] Processing callback. ID: ${depositId} | Status: ${status} | Amount: ${amount}`);

      // 1. Idempotency Check — skip if transaction already processed as COMPLETED
      const txCheck = await query('SELECT * FROM escrow_transactions WHERE pawapay_deposit_id = $1', [depositId]);
      if (txCheck.rowCount > 0 && txCheck.rows[0].status === 'COMPLETED') {
        console.log(`[PAWAPAY WEBHOOK] Transaction ${depositId} already processed.`);
        return;
      }

      // 2. Find corresponding Escrow
      const escrowRes = await query(
        'SELECT * FROM escrows WHERE deposit_id_initiator = $1 OR deposit_id_counterparty = $2',
        [depositId, depositId]
      );

      if (escrowRes.rowCount === 0) {
        console.warn(`[PAWAPAY WEBHOOK] Escrow not found for depositId: ${depositId}`);
        return;
      }
      const escrow = escrowRes.rows[0];

      const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
      const service = serviceRes.rows[0];

      const isInitiator = (escrow.deposit_id_initiator === depositId);
      const userId = isInitiator ? escrow.initiator_id : escrow.counterparty_id;

      if (status === 'COMPLETED') {
        // Record/Update Transaction as COMPLETED
        if (txCheck.rowCount > 0) {
          await query('UPDATE escrow_transactions SET status = \'COMPLETED\' WHERE pawapay_deposit_id = $1', [depositId]);
        } else {
          await query(
            `INSERT INTO escrow_transactions (user_id, type, pawapay_deposit_id, amount, currency, status, created_at)
             VALUES ($1, 'DEPOSIT', $2, $3, $4, 'COMPLETED', NOW())`,
            [userId, depositId, amount, currency]
          );
        }

        // Credit user wallet balance in wallets
        await query(
          `INSERT INTO wallets (user_id, balance, currency, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) 
           DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
          [userId, parseFloat(amount), currency]
        );

        // Update locking status on Escrow record
        let updateQuery = '';
        if (isInitiator) {
          updateQuery = 'UPDATE escrows SET initiator_locked = true, updated_at = NOW() WHERE id = $1';
        } else {
          updateQuery = 'UPDATE escrows SET counterparty_locked = true, updated_at = NOW() WHERE id = $1';
        }
        await query(updateQuery, [escrow.id]);

        // Reload Escrow to evaluate transitions
        const updatedEscrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrow.id]);
        const updatedEscrow = updatedEscrowRes.rows[0];

        // Evaluate state transitions
        if (updatedEscrow.type === 'SKILL_TO_CASH') {
          // Only client needs to deposit. One completed deposit is enough
          await query('UPDATE escrows SET status = \'BOTH_LOCKED\', updated_at = NOW() WHERE id = $1', [escrow.id]);
          
          // Insert system message and notify users
          const convRes = await query('SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))', [
            escrow.service_id, escrow.initiator_id, escrow.counterparty_id
          ]);
          if (convRes.rowCount > 0) {
            await insertSystemMessage(convRes.rows[0].id, `🔒 Escrow locked — ${amount} ${currency} held`);
          }
          notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'BOTH_LOCKED', { escrowId: escrow.id });
        } else {
          // SKILL_TO_SKILL: both must lock
          if (updatedEscrow.initiator_locked && updatedEscrow.counterparty_locked) {
            await query('UPDATE escrows SET status = \'BOTH_LOCKED\', updated_at = NOW() WHERE id = $1', [escrow.id]);
            
            const convRes = await query('SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))', [
              escrow.service_id, escrow.initiator_id, escrow.counterparty_id
            ]);
            if (convRes.rowCount > 0) {
              await insertSystemMessage(convRes.rows[0].id, `🔒 Escrow locked — ${amount} ${currency} held from both sides`);
            }
            notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'BOTH_LOCKED', { escrowId: escrow.id });
          }
        }
      } else if (status === 'FAILED') {
        // Record transaction as FAILED
        if (txCheck.rowCount > 0) {
          await query('UPDATE escrow_transactions SET status = \'FAILED\' WHERE pawapay_deposit_id = $1', [depositId]);
        } else {
          await query(
            `INSERT INTO escrow_transactions (user_id, type, pawapay_deposit_id, amount, currency, status, created_at)
             VALUES ($1, 'DEPOSIT', $2, $3, $4, 'FAILED', NOW())`,
            [userId, depositId, amount, currency]
          );
        }

        // Mark escrow CANCELLED
        await query('UPDATE escrows SET status = \'CANCELLED\', updated_at = NOW() WHERE id = $1', [escrow.id]);

        const convRes = await query('SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))', [
          escrow.service_id, escrow.initiator_id, escrow.counterparty_id
        ]);
        if (convRes.rowCount > 0) {
          await insertSystemMessage(convRes.rows[0].id, `❌ Escrow deposit failed. Transaction cancelled.`);
        }
        notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'CANCELLED', { escrowId: escrow.id });
      }
    } catch (err) {
      console.error('[PAWAPAY WEBHOOK ERROR] Failed to process webhook payload:', err);
    }
  })();
});

module.exports = router;
