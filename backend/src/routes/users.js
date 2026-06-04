const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/users/:id - Get user profile
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { display_name, avatar_url, notification_enabled, language, theme } = req.body;

    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (notification_enabled !== undefined) updates.notification_enabled = notification_enabled;
    if (language !== undefined) updates.language = language;
    if (theme !== undefined) updates.theme = theme;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/users/:id/services - Get services posted by user
router.get('/:id/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ services: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user services' });
  }
});

module.exports = router;
