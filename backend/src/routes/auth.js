const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// POST /api/auth/google - Authenticate with Google
router.post('/google', async (req, res) => {
  try {
    const { id_token, user_info } = req.body;

    if (!user_info || !user_info.email) {
      return res.status(400).json({ error: 'Missing user information' });
    }

    const { email, name, picture, id: googleId } = user_info;

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let user;
    if (existingUser) {
      // Update last login
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          avatar_url: picture || existingUser.avatar_url,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          display_name: name || email.split('@')[0],
          avatar_url: picture || null,
          google_id: googleId,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          notification_enabled: true,
          language: 'en',
          theme: 'system',
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    }

    res.json({ user, message: 'Authentication successful' });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/user/:id - Get user by ID
router.get('/user/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ user });
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;
