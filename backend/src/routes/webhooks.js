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
        // Send Notification
        await sendPushNotification(
          txn.user_id,
          'Dépôt Réussi 🎉',
          `Votre compte a été crédité de ${txn.amount} FCFA.`,
          { transactionId: txn.id, type: 'deposit' }
        );
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
        // Send Notification
        await sendPushNotification(
          txn.user_id,
          'Retrait Traité 💸',
          `Votre retrait de ${txn.amount} FCFA a été traité vers votre compte mobile money.`,
          { transactionId: txn.id, type: 'withdrawal' }
        );
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
      // Send Notification
      const verb = txn.type === 'deposit' ? 'Dépôt' : 'Retrait';
      await sendPushNotification(
        txn.user_id,
        `${verb} Échoué ⚠️`,
        `Votre transaction de ${txn.amount} FCFA n'a pas pu aboutir. Raison: ${payload.failureReason?.failureMessage || 'Inconnue'}.`,
        { transactionId: txn.id, type: txn.type }
      );
    } else if (status === 'PROCESSING') {
        // In case of Wave REDIRECT_AUTH, just acknowledge.
    }

    res.status(200).end();
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

module.exports = router;
