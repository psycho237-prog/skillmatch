const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/users/:id - Get user profile
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, phone_number, display_name, avatar_url, notification_enabled, language, theme, push_token, created_at FROM users WHERE id = $1', [req.params.id]);

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
    const { display_name, avatar_url, notification_enabled, language, theme } = req.body;

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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    params.push(req.params.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, phone_number, display_name, avatar_url, notification_enabled, language, theme, push_token`;

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
    const { rows } = await query('SELECT * FROM services WHERE user_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ services: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user services' });
  }
});

module.exports = router;
