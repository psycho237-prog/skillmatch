const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { processDeposit, processWithdrawal } = require('../config/wallet');
const crypto = require('crypto');

const PAWAPAY_TOKEN = process.env.PAWAPAY_API_KEY || 'YOUR_FALLBACK_TOKEN';
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

    // 1. Predict Provider
    const predRes = await fetch(`${PAWAPAY_BASE_URL}/v2/predict-provider`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: mobile_money_number })
    });
    const pred = await predRes.json();
    if (pred.failureReason) return res.status(400).json({ error: pred.failureReason.failureMessage });

    // 2. Discover provider decimal support
    const confRes = await fetch(`${PAWAPAY_BASE_URL}/v2/active-conf?country=${pred.country}&operationType=DEPOSIT`, {
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}` }
    });
    const conf = await confRes.json();
    let decimalsInAmount = 'NONE';
    for (const c of conf.countries || []) {
      for (const p of c.providers || []) {
        if (p.provider === pred.provider) {
          const op = p.currencies?.[0]?.operationTypes?.DEPOSIT;
          if (op) decimalsInAmount = op.decimalsInAmount;
        }
      }
    }

    const formattedAmount = decimalsInAmount === 'TWO_PLACES' ? Number(amount).toFixed(2) : String(Math.floor(Number(amount)));

    // 3. Initiate Deposit
    const depositId = crypto.randomUUID();
    
    // Fetch wallet id and balances
    const walletRes = await query('SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1', [userId]);
    const wallet = walletRes.rows[0];
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Create pending local record
    await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7, 'pending', $8, $9)`, 
      [userId, wallet.id, Number(amount), wallet.balance, wallet.balance, wallet.pending_balance, wallet.pending_balance, depositId, `Dépôt Mobile Money (${pred.provider})`]);

    const depositRes = await fetch(`${PAWAPAY_BASE_URL}/v2/deposits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositId: depositId,
        amount: formattedAmount,
        currency: pred.country === 'CMR' ? 'XAF' : 'XOF', // Adapt to your country configuration
        payer: {
          type: "MMO",
          accountDetails: { phoneNumber: pred.phoneNumber, provider: pred.provider }
        },
        customerMessage: "Swapster Deposit",
      })
    });
    const depositData = await depositRes.json();

    if (depositData.status === 'ACCEPTED') {
      res.json({ message: 'Dépôt initié. Veuillez confirmer sur votre téléphone.', transaction_id: depositId, pawapayData: depositData });
    } else if (depositData.status === 'REJECTED') {
      await query(`UPDATE wallet_transactions SET status = 'failed' WHERE reference_id = $1`, [depositId]);
      res.status(400).json({ error: depositData.failureReason?.failureMessage || 'Dépôt rejeté' });
    } else {
      res.json({ message: 'Dépôt en cours...', transaction_id: depositId, status: depositData.status });
    }
  } catch (err) {
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

    // 1. Predict Provider
    const predRes = await fetch(`${PAWAPAY_BASE_URL}/v2/predict-provider`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: mobile_money_number })
    });
    const pred = await predRes.json();
    if (pred.failureReason) return res.status(400).json({ error: pred.failureReason.failureMessage });

    const formattedAmount = String(Math.floor(Number(amount)));

    // 2. Initiate Payout
    const payoutId = crypto.randomUUID();

    // Lock funds immediately
    await query(`UPDATE wallets SET balance = balance - $1, pending_balance = pending_balance + $1 WHERE id = $2`, [Number(amount), wallet.id]);
    await query(`INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, pending_before, pending_after, status, reference_id, description) VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6, $7, 'pending', $8, $9)`, 
      [userId, wallet.id, Number(amount), wallet.balance, Number(wallet.balance) - Number(amount), wallet.pending_balance, Number(wallet.pending_balance) + Number(amount), payoutId, `Retrait Mobile Money (${pred.provider})`]);

    const payoutRes = await fetch(`${PAWAPAY_BASE_URL}/v2/payouts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payoutId: payoutId,
        amount: formattedAmount,
        currency: pred.country === 'CMR' ? 'XAF' : 'XOF', // Adapt accordingly
        recipient: {
          type: "MMO",
          accountDetails: { phoneNumber: pred.phoneNumber, provider: pred.provider }
        },
        customerMessage: "Swapster Withdraw",
      })
    });
    const payoutData = await payoutRes.json();

    if (payoutData.status === 'ACCEPTED' || payoutData.status === 'ENQUEUED') {
      res.json({ message: 'Retrait initié avec succès.', transaction_id: payoutId, pawapayData: payoutData });
    } else if (payoutData.status === 'REJECTED') {
      // Revert funds
      await query(`UPDATE wallets SET balance = balance + $1, pending_balance = pending_balance - $1 WHERE id = $2`, [Number(amount), wallet.id]);
      await query(`UPDATE wallet_transactions SET status = 'failed' WHERE reference_id = $1`, [payoutId]);
      res.status(400).json({ error: payoutData.failureReason?.failureMessage || 'Retrait rejeté' });
    } else {
      res.json({ message: 'Retrait en cours...', transaction_id: payoutId, status: payoutData.status });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
