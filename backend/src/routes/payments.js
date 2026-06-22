const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

router.use(authenticateToken);

// POST /api/payments/subscribe
// Endpoint to purchase a Pro subscription using internal Wallet
router.post('/subscribe', async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, autoRenew } = req.body; // 'monthly' or 'yearly'
    
    // 1. Get platform settings for pricing
    const settingsRes = await query('SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ($1, $2)', ['pro_monthly_price', 'pro_yearly_price']);
    const settings = {};
    settingsRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);
    
    const price = plan === 'yearly' 
      ? Number(settings['pro_yearly_price'] || 50000) 
      : Number(settings['pro_monthly_price'] || 5000);

    // 2. Fetch User and Wallet
    const userRes = await query('SELECT subscription_expires_at, subscription_tier FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const walletRes = await query('SELECT id, balance FROM wallets WHERE user_id = $1', [userId]);
    if (walletRes.rows.length === 0 || parseFloat(walletRes.rows[0].balance) < price) {
      return res.status(400).json({ error: 'Solde du portefeuille insuffisant. Veuillez recharger.' });
    }
    const wallet = walletRes.rows[0];

    // 3. Deduct from wallet
    const debitRes = await query(`
      UPDATE wallets 
      SET balance = balance - $1, updated_at = NOW() 
      WHERE user_id = $2 AND balance >= $1 
      RETURNING id, balance
    `, [price, userId]);

    if (debitRes.rowCount === 0) {
      return res.status(400).json({ error: 'Solde du portefeuille insuffisant.' });
    }

    // 4. Record Transaction
    const txId = crypto.randomUUID();
    await query(`
      INSERT INTO wallet_transactions (id, user_id, wallet_id, type, amount, balance_before, balance_after, status, description) 
      VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, 'completed', $7)
    `, [txId, userId, wallet.id, price, wallet.balance, debitRes.rows[0].balance, `Abonnement Pro (${plan})`]);

    // 5. Update User Subscription
    let currentExpires = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
    if (currentExpires < new Date()) currentExpires = new Date();
    
    if (plan === 'yearly') {
      currentExpires.setFullYear(currentExpires.getFullYear() + 1);
    } else {
      currentExpires.setMonth(currentExpires.getMonth() + 1);
    }

    const { rows } = await query(
      `UPDATE users 
       SET subscription_tier = 'premium', 
           subscription_expires_at = $1,
           auto_renew_pro = $2,
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [currentExpires, !!autoRenew, userId]
    );

    res.json({ success: true, user: rows[0], message: 'Félicitations! Vous êtes abonné à Swapster Pro.' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

// POST /api/payments/boost
// Endpoint to purchase a service boost using internal Wallet
router.post('/boost', async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId, durationDays } = req.body;
    
    if (!serviceId || !durationDays) {
      return res.status(400).json({ error: 'Missing serviceId or durationDays' });
    }

    const price = parseInt(durationDays) * 200; // 200 XAF per day

    // Verify service belongs to user
    const checkRes = await query('SELECT id, featured_until FROM services WHERE id = $1 AND user_id = $2', [serviceId, userId]);
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to boost this service' });
    }
    const service = checkRes.rows[0];

    // Deduct from wallet
    const walletRes = await query('SELECT id, balance FROM wallets WHERE user_id = $1', [userId]);
    if (walletRes.rows.length === 0 || parseFloat(walletRes.rows[0].balance) < price) {
      return res.status(400).json({ error: 'Solde du portefeuille insuffisant. Veuillez recharger.' });
    }
    const wallet = walletRes.rows[0];

    const debitRes = await query(`
      UPDATE wallets 
      SET balance = balance - $1, updated_at = NOW() 
      WHERE user_id = $2 AND balance >= $1 
      RETURNING id, balance
    `, [price, userId]);

    if (debitRes.rowCount === 0) return res.status(400).json({ error: 'Solde du portefeuille insuffisant.' });

    // Record Transaction
    const txId = crypto.randomUUID();
    await query(`
      INSERT INTO wallet_transactions (id, user_id, wallet_id, type, amount, balance_before, balance_after, status, description) 
      VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, 'completed', $7)
    `, [txId, userId, wallet.id, price, wallet.balance, debitRes.rows[0].balance, `Boost de service (${durationDays} jours)`]);

    // Extend featured_until
    let currentFeatured = service.featured_until ? new Date(service.featured_until) : new Date();
    if (currentFeatured < new Date()) currentFeatured = new Date();
    currentFeatured.setDate(currentFeatured.getDate() + parseInt(durationDays));

    const { rows } = await query(
      `UPDATE services 
       SET is_featured = true, 
           featured_until = $1,
           updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [currentFeatured, serviceId]
    );

    res.json({ success: true, service: rows[0], message: 'Service boosté avec succès!' });
  } catch (error) {
    console.error('Boost error:', error);
    res.status(500).json({ error: 'Failed to process service boost' });
  }
});

module.exports = router;
