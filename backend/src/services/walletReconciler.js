const { pool, query } = require('../config/database');
const pawapay = require('./pawapay');
const { sendPushNotification } = require('../config/notifications');

let globalIoInstance = null;

/**
 * Sets the global Socket.io instance for background notification broadcasts.
 */
function setGlobalIoInstance(io) {
  globalIoInstance = io;
}

/**
 * Emits real-time notification event to connected clients via Socket.io
 */
function notifyUsers(req, userIds, event, payload) {
  const io = req?.app?.get('io') || globalIoInstance;
  if (!io) return;
  userIds.forEach(id => {
    io.emit(`user_notification_${id}`, { event, payload });
  });
}

/**
 * Reconciles any pending deposits or payouts by checking their status against PawaPay
 * and applying database transactions to update wallet balances.
 */
async function reconcilePendingTransactions(userId = null, req = null) {
  const client = await pool.connect();
  try {
    let sql = `SELECT * FROM wallet_transactions WHERE status = 'pending'`;
    let params = [];
    if (userId) {
      sql += ' AND user_id = $1';
      params.push(userId);
    }
    const pendingTxns = await client.query(sql, params);

    for (const txn of pendingTxns.rows) {
      const txnId = txn.reference_id;
      if (!txnId) continue;

      let statusData;
      try {
        if (txn.type === 'deposit') {
          statusData = await pawapay.pollDepositStatus(txnId);
        } else if (txn.type === 'withdrawal') {
          statusData = await pawapay.pollPayoutStatus(txnId);
        }
      } catch (err) {
        console.error(`[RECONCILER] Error polling PawaPay status for transaction reference ${txnId}:`, err.message);
        continue;
      }

      if (!statusData) continue;

      let newStatus = null;
      let failureReason = null;

      if (statusData.data) {
        if (Array.isArray(statusData.data)) {
          newStatus = statusData.data[0]?.status;
          failureReason = statusData.data[0]?.failureReason;
        } else {
          newStatus = statusData.data.status;
          failureReason = statusData.data.failureReason;
        }
      } else {
        newStatus = statusData.status;
        failureReason = statusData.failureReason;
      }

      if (!newStatus) continue;

      // Keep waiting if transaction is still in a pending state on PawaPay side
      if (['PENDING', 'SUBMITTED', 'PROCESSING', 'ACCEPTED', 'ENQUEUED'].includes(newStatus)) {
        continue;
      }

      // Open a database transaction to apply the final state update atomically
      await client.query('BEGIN');
      try {
        const currentTxnRes = await client.query('SELECT * FROM wallet_transactions WHERE id = $1 FOR UPDATE', [txn.id]);
        if (currentTxnRes.rows.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }
        const currentTxn = currentTxnRes.rows[0];

        // Ensure status has not changed to avoid double processing
        if (currentTxn.status !== 'pending') {
          await client.query('ROLLBACK');
          continue;
        }

        const walletRes = await client.query('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [currentTxn.wallet_id]);
        if (walletRes.rows.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }
        const wallet = walletRes.rows[0];

        if (newStatus === 'COMPLETED') {
          if (currentTxn.type === 'deposit') {
            const amountNum = parseFloat(currentTxn.amount);
            const newBalance = parseFloat(wallet.balance) + amountNum;

            await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);
            await client.query(`UPDATE wallet_transactions SET status = 'completed', balance_after = $1 WHERE id = $2`, [newBalance, currentTxn.id]);
            await client.query(`UPDATE escrow_transactions SET status = 'COMPLETED' WHERE pawapay_deposit_id = $1`, [currentTxn.reference_id]);

            await sendPushNotification(currentTxn.user_id, 'Dépôt Réussi 🎉', `Votre compte a été crédité de ${currentTxn.amount} FCFA.`, { transactionId: currentTxn.id, type: 'deposit' });
            notifyUsers(req, [currentTxn.user_id], 'WALLET_DEPOSIT_SUCCESS', { title: 'Deposit Successful 🎉', body: `Your wallet was credited with ${currentTxn.amount} ${currentTxn.currency || 'FCFA'}.` });
          } else if (currentTxn.type === 'withdrawal') {
            const amountNum = parseFloat(currentTxn.amount);
            const newPending = parseFloat(wallet.pending_balance) - amountNum;

            await client.query('UPDATE wallets SET pending_balance = $1, updated_at = NOW() WHERE id = $2', [newPending, wallet.id]);
            await client.query(`UPDATE wallet_transactions SET status = 'completed', pending_after = $1 WHERE id = $2`, [newPending, currentTxn.id]);
            await client.query(`UPDATE escrow_transactions SET status = 'COMPLETED' WHERE pawapay_payout_id = $1`, [currentTxn.reference_id]);

            await sendPushNotification(currentTxn.user_id, 'Retrait Traité 💸', `Votre retrait de ${currentTxn.amount} FCFA a été traité.`, { transactionId: currentTxn.id, type: 'withdrawal' });
            notifyUsers(req, [currentTxn.user_id], 'WALLET_WITHDRAWAL_SUCCESS', { title: 'Withdrawal Processed 💸', body: `Your withdrawal of ${currentTxn.amount} ${currentTxn.currency || 'FCFA'} was processed.` });
          }
        } else if (newStatus === 'FAILED' || newStatus === 'REJECTED') {
          const failureMessage = failureReason?.failureMessage || 'Inconnu';
          if (currentTxn.type === 'deposit') {
            await client.query(`UPDATE wallet_transactions SET status = 'failed', description = $1 WHERE id = $2`, [`${currentTxn.description} - Echec: ${failureMessage}`, currentTxn.id]);
            await client.query(`UPDATE escrow_transactions SET status = 'FAILED' WHERE pawapay_deposit_id = $1`, [currentTxn.reference_id]);

            const verb = 'Dépôt';
            await sendPushNotification(currentTxn.user_id, `${verb} Échoué ⚠️`, `Votre transaction de ${currentTxn.amount} FCFA a échoué. Raison: ${failureMessage}.`, { transactionId: currentTxn.id, type: currentTxn.type });
            notifyUsers(req, [currentTxn.user_id], 'WALLET_TX_FAILED', { title: `${verb} Failed ⚠️`, body: `Your transaction of ${currentTxn.amount} failed. Reason: ${failureMessage}.` });
          } else if (currentTxn.type === 'withdrawal') {
            const amountNum = parseFloat(currentTxn.amount);
            const newBalance = parseFloat(wallet.balance) + amountNum;
            const newPending = parseFloat(wallet.pending_balance) - amountNum;

            await client.query('UPDATE wallets SET balance = $1, pending_balance = $2, updated_at = NOW() WHERE id = $3', [newBalance, newPending, wallet.id]);
            await client.query(`UPDATE wallet_transactions SET status = 'failed', balance_after = $1, pending_after = $2, description = $3 WHERE id = $4`, [newBalance, newPending, `${currentTxn.description} - Echec: ${failureMessage}`, currentTxn.id]);
            await client.query(`UPDATE escrow_transactions SET status = 'FAILED' WHERE pawapay_payout_id = $1`, [currentTxn.reference_id]);

            const verb = 'Retrait';
            await sendPushNotification(currentTxn.user_id, `${verb} Échoué ⚠️`, `Votre transaction de ${currentTxn.amount} FCFA a échoué. Raison: ${failureMessage}.`, { transactionId: currentTxn.id, type: currentTxn.type });
            notifyUsers(req, [currentTxn.user_id], 'WALLET_TX_FAILED', { title: `${verb} Failed ⚠️`, body: `Your transaction of ${currentTxn.amount} failed. Reason: ${failureMessage}.` });
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[RECONCILER] Error updating transaction ${txn.id} in db transaction:`, err);
      }
    }
  } catch (error) {
    console.error('[RECONCILER] General error in reconcilePendingTransactions:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  setGlobalIoInstance,
  reconcilePendingTransactions
};
