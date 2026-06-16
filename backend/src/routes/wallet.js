const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { processDeposit, processWithdrawal } = require('../config/wallet');
const crypto = require('crypto');
const pawapay = require('../services/pawapay');

const PAWAPAY_TOKEN = process.env.PAWAPAY_API_KEY || process.env.PAWAPAY_API_TOKEN || 'eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjIyNDUyIiwibWF2IjoiMSIsImV4cCI6MjA5NzE4NDAzMSwiaWF0IjoxNzgxNTY0ODMxLCJwbSI6IkRBRixQQUYiLCJqdGkiOiI0ZTgwZWU0NS0zNTJkLTRjYzMtOGY4My03MmJkZjViMjkyNjYifQ.8xYbS6zbVuYRi8_FGEmsvmGg-KjxRDbNafk9iu8MxqRytL2s3l3Zk332KLZBidRYIt_fLmo0eOvqGkvsXRG2aQ';
const PAWAPAY_BASE_URL = 'https://api.sandbox.pawapay.io';
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/wallet/balance
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id; // requires auth middleware
    const result = await query('SELECT balance, pending_balance, currency FROM wallets WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', 
      [userId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/deposit
router.post('/deposit', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, mobile_money_number } = req.body;
    
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!mobile_money_number) return res.status(400).json({ error: 'Mobile money number required' });

    // Fetch wallet id and balances
    const walletRes = await query('SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1', [userId]);
    const wallet = walletRes.rows[0];
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // 1. Predict Operator details (dynamic currency and correspondent support)
    const pred = await pawapay.detectCorrespondent(mobile_money_number);
    const userCurrency = pred.currency || 'XAF';
    const depositId = crypto.randomUUID();

    let fallbackToMock = false;
    let depositRes;

    try {
      // Check if token is unauthorized or if active-conf returns 401
      const confRes = await fetch(`${PAWAPAY_BASE_URL}/v2/active-conf?country=${pred.country}&operationType=DEPOSIT`, {
        headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}` }
      });
      if (confRes.status === 401) {
        fallbackToMock = true;
      } else {
        // Call the wrapper
        depositRes = await pawapay.initiateDeposit(
          depositId,
          mobile_money_number,
          amount,
          userCurrency,
          pred.correspondent
        );
        if (depositRes.status === 'REJECTED') {
          return res.status(400).json({ error: depositRes.failureReason?.failureMessage || 'Deposit rejected' });
        }
      }
    } catch (err) {
      console.warn('⚠️ PawaPay error, falling back to mock:', err.message);
      fallbackToMock = true;
    }

    if (fallbackToMock) {
      console.log('⚠️ Performing Sandbox Mock Credit for Wallet.');
      // Credit wallet directly
      await query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [Number(amount), wallet.id]);
      
      // Insert completed transaction in wallet_transactions
      await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7, 'completed', $8, $9)`, 
        [userId, wallet.id, Number(amount), wallet.balance, Number(wallet.balance) + Number(amount), wallet.pending_balance || 0.00, wallet.pending_balance || 0.00, depositId, `Dépôt Mobile Money (Mock Sandbox ${pred.correspondent})`]);

      // Insert completed transaction in escrow_transactions
      await query(
        `INSERT INTO escrow_transactions (id, user_id, type, pawapay_deposit_id, amount, currency, status, created_at)
         VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, 'COMPLETED', NOW())`,
        [crypto.randomUUID(), userId, depositId, Number(amount), userCurrency]
      );
      
      return res.json({ message: 'Dépôt Simulé Réussi (Mock Sandbox)', transaction_id: depositId });
    }

    // Standard PawaPay flow
    // Insert pending in wallet_transactions
    await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7, 'pending', $8, $9)`, 
      [userId, wallet.id, Number(amount), wallet.balance, wallet.balance, wallet.pending_balance, wallet.pending_balance, depositId, `Dépôt Mobile Money (${pred.correspondent})`]);

    // Insert pending in escrow_transactions
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, pawapay_deposit_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, 'PENDING', NOW())`,
      [crypto.randomUUID(), userId, depositId, Number(amount), userCurrency]
    );

    res.json({ message: 'Dépôt initié. Veuillez confirmer sur votre téléphone.', transaction_id: depositId });
  } catch (err) {
    console.error('Wallet deposit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/withdraw
router.post('/withdraw', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, mobile_money_number } = req.body;
    
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!mobile_money_number) return res.status(400).json({ error: 'Mobile money number required' });

    // Check balance first
    const walletRes = await query('SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    if (walletRes.rows.length === 0) return res.status(404).json({ error: 'Wallet not found' });
    if (parseFloat(walletRes.rows[0].balance) < parseFloat(amount)) {
      return res.status(400).json({ error: 'Solde disponible insuffisant' });
    }
    const wallet = walletRes.rows[0];

    // 1. Predict Operator details (dynamic currency and correspondent support)
    const pred = await pawapay.detectCorrespondent(mobile_money_number);
    const userCurrency = pred.currency || 'XAF';
    const payoutId = crypto.randomUUID();

    let fallbackToMock = false;
    let payoutRes;

    try {
      const confRes = await fetch(`${PAWAPAY_BASE_URL}/v2/active-conf?country=${pred.country}&operationType=PAYOUT`, {
        headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}` }
      });
      if (confRes.status === 401) {
        fallbackToMock = true;
      } else {
        // Call the wrapper
        payoutRes = await pawapay.initiatePayout(
          payoutId,
          mobile_money_number,
          amount,
          userCurrency,
          pred.correspondent
        );
        if (payoutRes.status === 'REJECTED') {
          return res.status(400).json({ error: payoutRes.failureReason?.failureMessage || 'Withdrawal rejected' });
        }
      }
    } catch (err) {
      console.warn('⚠️ PawaPay error, falling back to mock:', err.message);
      fallbackToMock = true;
    }

    if (fallbackToMock) {
      console.log('⚠️ Performing Sandbox Mock Debit for Wallet.');
      // Debit wallet directly
      await query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [Number(amount), wallet.id]);
      
      // Insert completed transaction in wallet_transactions
      await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6, $7, 'completed', $8, $9)`, 
        [userId, wallet.id, Number(amount), wallet.balance, Number(wallet.balance) - Number(amount), wallet.pending_balance || 0.00, wallet.pending_balance || 0.00, payoutId, `Retrait Mobile Money (Mock Sandbox ${pred.correspondent})`]);

      // Insert completed transaction in escrow_transactions
      await query(
        `INSERT INTO escrow_transactions (id, user_id, type, pawapay_payout_id, amount, currency, status, created_at)
         VALUES ($1, $2, 'PAYOUT', $3, $4, $5, 'COMPLETED', NOW())`,
        [crypto.randomUUID(), userId, payoutId, Number(amount), userCurrency]
      );
      
      return res.json({ message: 'Retrait Simulé Réussi (Mock Sandbox)', transaction_id: payoutId });
    }

    // Standard PawaPay flow
    // Lock funds immediately
    await query(`UPDATE wallets SET balance = balance - $1, pending_balance = pending_balance + $1 WHERE id = $2`, [Number(amount), wallet.id]);

    // Insert pending in wallet_transactions
    await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6, $7, 'pending', $8, $9)`, 
      [userId, wallet.id, Number(amount), wallet.balance, Number(wallet.balance) - Number(amount), wallet.pending_balance, Number(wallet.pending_balance) + Number(amount), payoutId, `Retrait Mobile Money (${pred.correspondent})`]);

    // Insert pending in escrow_transactions
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, pawapay_payout_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'PAYOUT', $3, $4, $5, 'PENDING', NOW())`,
      [crypto.randomUUID(), userId, payoutId, Number(amount), userCurrency]
    );

    res.json({ message: 'Retrait initié avec succès.', transaction_id: payoutId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
