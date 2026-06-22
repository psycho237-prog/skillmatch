const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/users/public/settings - Get public platform settings
router.get('/public/settings', async (req, res) => {
  try {
    const { rows } = await query('SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ($1, $2)', ['pro_monthly_price', 'pro_yearly_price']);
    const settings = {};
    rows.forEach(r => settings[r.setting_key] = r.setting_value);
    res.json({
      pro_monthly_price: Number(settings['pro_monthly_price'] || 5000),
      pro_yearly_price: Number(settings['pro_yearly_price'] || 50000)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/users/:id - Get user profile
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, phone_number, display_name, avatar_url, notification_enabled, chat_backup_enabled, subscription_tier, subscription_expires_at, auto_renew_pro, language, theme, push_token, created_at, correspondent, currency, country, identity_verified, average_rating, total_ratings FROM users WHERE id = $1', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { display_name, avatar_url, notification_enabled, chat_backup_enabled, auto_renew_pro, language, theme, identity_verified, correspondent, currency, country } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      params.push(display_name);
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      params.push(avatar_url);
    }
    if (notification_enabled !== undefined) {
      updates.push(`notification_enabled = $${paramCount++}`);
      params.push(notification_enabled);
    }
    if (chat_backup_enabled !== undefined) {
      updates.push(`chat_backup_enabled = $${paramCount++}`);
      params.push(chat_backup_enabled);
    }
    if (auto_renew_pro !== undefined) {
      updates.push(`auto_renew_pro = $${paramCount++}`);
      params.push(auto_renew_pro);
    }
    if (language !== undefined) {
      updates.push(`language = $${paramCount++}`);
      params.push(language);
    }
    if (theme !== undefined) {
      updates.push(`theme = $${paramCount++}`);
      params.push(theme);
    }
    if (req.body.push_token !== undefined) {
      updates.push(`push_token = $${paramCount++}`);
      params.push(req.body.push_token);
    }
    if (identity_verified !== undefined) {
      updates.push(`identity_verified = $${paramCount++}`);
      params.push(identity_verified);
    }
    if (correspondent !== undefined) {
      updates.push(`correspondent = $${paramCount++}`);
      params.push(correspondent);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramCount++}`);
      params.push(currency);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramCount++}`);
      params.push(country);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    params.push(req.params.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, phone_number, display_name, avatar_url, notification_enabled, chat_backup_enabled, subscription_tier, subscription_expires_at, auto_renew_pro, language, theme, push_token, correspondent, currency, country, identity_verified, average_rating, total_ratings`;

    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/users/:id/services - Get services posted by user
router.get('/:id/services', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM services WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC', [req.params.id]);
    res.json({ services: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user services' });
  }
});

// GET /api/users/:id/readiness - Live user readiness checklist
router.get('/:id/readiness', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user profile info
    const userRes = await query('SELECT phone_number, correspondent, avatar_url, identity_verified FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userProfile = userRes.rows[0];

    // Fetch service metrics
    const serviceCountRes = await query('SELECT COUNT(*)::int as count FROM services WHERE user_id = $1 AND deleted_at IS NULL', [userId]);
    const serviceCount = serviceCountRes.rows[0].count;

    const invalidHoldRes = await query(
      "SELECT COUNT(*)::int as count FROM services WHERE user_id = $1 AND service_type = 'SKILL_TO_SKILL' AND (holdup_amount IS NULL OR holdup_amount <= 0) AND deleted_at IS NULL",
      [userId]
    );
    const invalidHoldCount = invalidHoldRes.rows[0].count;

    // Fetch wallet balance
    const walletRes = await query('SELECT balance::float as balance FROM wallets WHERE user_id = $1', [userId]);
    const balance = walletRes.rowCount > 0 ? walletRes.rows[0].balance : 0.00;

    // Compute checks
    const phoneVerified = !!userProfile.phone_number;
    const mobileNetworkDetected = !!userProfile.correspondent;
    const profilePhotoUploaded = !!userProfile.avatar_url;
    const servicePosted = serviceCount > 0;
    const holdupAmountSet = serviceCount > 0 && invalidHoldCount === 0;
    const walletFunded = balance > 0;
    const identityVerified = !!userProfile.identity_verified;

    // Score computation
    const checks = [
      phoneVerified,
      mobileNetworkDetected,
      profilePhotoUploaded,
      servicePosted,
      holdupAmountSet,
      walletFunded,
      identityVerified
    ];
    const score = checks.filter(Boolean).length;

    res.json({
      readiness: {
        phoneVerified,
        mobileNetworkDetected,
        profilePhotoUploaded,
        servicePosted,
        holdupAmountSet,
        walletFunded,
        identityVerified,
        score,
        total: 7
      }
    });
  } catch (error) {
    console.error('Readiness fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user readiness checklist' });
  }
});

module.exports = router;
