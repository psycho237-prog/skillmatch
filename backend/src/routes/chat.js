const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/chat/conversations/:userId - Get all conversations for a user
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Join users twice (for user1 and user2) and aggregate messages
    const sql = `
      SELECT c.*,
             json_build_object('id', u1.id, 'display_name', u1.display_name, 'avatar_url', u1.avatar_url) as user1,
             json_build_object('id', u2.id, 'display_name', u2.display_name, 'avatar_url', u2.avatar_url) as user2,
             (
               SELECT json_agg(json_build_object('content', m.content, 'created_at', m.created_at, 'sender_id', m.sender_id, 'status', m.status) ORDER BY m.created_at ASC)
               FROM messages m WHERE m.conversation_id = c.id
             ) as messages
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.updated_at DESC
    `;

    const { rows } = await query(sql, [userId]);

    const conversations = rows.map(conv => {
      const otherUser = conv.user1_id === userId ? conv.user2 : conv.user1;
      const messages = conv.messages || [];
      const sortedMessages = [...messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMessage = sortedMessages[0] || null;
      const unreadCount = messages.filter(m => m.sender_id !== userId && m.status !== 'read').length;

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

// GET /api/chat/conversations/detail/:conversationId - Get single conversation detail with service details
router.get('/conversations/detail/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { rows } = await query(
      `SELECT c.*, 
              s.id as service_id, s.title as service_title, s.price as service_price, s.service_type, s.holdup_amount, s.currency, s.user_id as service_owner_id,
              u1.display_name as user1_name, u2.display_name as user2_name
       FROM conversations c
       LEFT JOIN services s ON c.service_id = s.id
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation: rows[0] });
  } catch (error) {
    console.error('Conversation detail fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

// GET /api/chat/messages/:conversationId - Get messages for a conversation
router.get('/messages/:conversationId', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const sql = `
      SELECT m.*, json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await query(sql, [req.params.conversationId, parseInt(limit), parseInt(offset)]);

    res.json({ messages: rows });
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

    let checkSql = `
      SELECT * FROM conversations 
      WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
    `;
    const params = [user1_id, user2_id];

    const { rows: existing } = await query(checkSql, params);

    if (existing.length > 0) {
      return res.json({ conversation: existing[0], isNew: false });
    }

    const insertSql = `
      INSERT INTO conversations (user1_id, user2_id, service_id, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *
    `;
    
    const newConv = await query(insertSql, [user1_id, user2_id, service_id || null]);

    res.status(201).json({ conversation: newConv.rows[0], isNew: true });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// POST /api/chat/messages - Send a message
router.post('/messages', async (req, res) => {
  try {
    const { conversation_id, sender_id, content } = req.body;

    if (!conversation_id || !sender_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { rows: messageRows } = await query(`
      INSERT INTO messages (conversation_id, sender_id, content, status, created_at)
      VALUES ($1, $2, $3, 'sent', NOW())
      RETURNING *
    `, [conversation_id, sender_id, content]);

    let message = messageRows[0];

    // Get sender info manually since RETURNING doesn't join
    const { rows: userRows } = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [sender_id]);
    message.sender = userRows[0];

    // Update conversation timestamp
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversation_id]);

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/chat/messages/read - Mark messages as read
router.put('/messages/read', async (req, res) => {
  try {
    const { conversation_id, user_id } = req.body;

    await query(`
      UPDATE messages 
      SET status = 'read' 
      WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
    `, [conversation_id, user_id]);

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
