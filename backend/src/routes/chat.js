const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/chat/conversations/:userId - Get all conversations for a user
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(id, display_name, avatar_url),
        user2:users!conversations_user2_id_fkey(id, display_name, avatar_url),
        messages(content, created_at, sender_id, is_read)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Format conversations to include other user info and last message
    const conversations = (data || []).map(conv => {
      const otherUser = conv.user1_id === userId ? conv.user2 : conv.user1;
      const messages = conv.messages || [];
      const lastMessage = messages.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0] || null;
      const unreadCount = messages.filter(
        m => m.sender_id !== userId && !m.is_read
      ).length;

      return {
        id: conv.id,
        other_user: otherUser,
        last_message: lastMessage,
        unread_count: unreadCount,
        updated_at: conv.updated_at,
        service_id: conv.service_id,
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Conversations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/chat/messages/:conversationId - Get messages for a conversation
router.get('/messages/:conversationId', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(display_name, avatar_url)')
      .eq('conversation_id', req.params.conversationId)
      .order('created_at', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;
    res.json({ messages: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat/conversations - Create or get existing conversation
router.post('/conversations', async (req, res) => {
  try {
    const { user1_id, user2_id, service_id } = req.body;

    if (!user1_id || !user2_id) {
      return res.status(400).json({ error: 'Both user IDs are required' });
    }

    // Check for existing conversation between users about this service
    let query = supabase
      .from('conversations')
      .select('*')
      .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`);
    
    if (service_id) {
      query = query.eq('service_id', service_id);
    }

    const { data: existing, error: fetchError } = await query.maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (existing) {
      return res.json({ conversation: existing, isNew: false });
    }

    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        user1_id,
        user2_id,
        service_id: service_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;
    res.status(201).json({ conversation: newConv, isNew: true });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// POST /api/chat/messages - Send a message (REST fallback)
router.post('/messages', async (req, res) => {
  try {
    const { conversation_id, sender_id, content } = req.body;

    if (!conversation_id || !sender_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select('*, sender:users!messages_sender_id_fkey(display_name, avatar_url)')
      .single();

    if (error) throw error;

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    res.status(201).json({ message: data });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/chat/messages/read - Mark messages as read
router.put('/messages/read', async (req, res) => {
  try {
    const { conversation_id, user_id } = req.body;

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversation_id)
      .neq('sender_id', user_id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
