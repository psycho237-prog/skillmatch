const { query } = require('../config/database');

const onlineUsers = new Map(); // userId -> socketId

function setupChatSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // User comes online
    socket.on('user_online', (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      io.emit('user_status', { userId, online: true });
      console.log(`👤 User online: ${userId}`);
    });

    // Join a conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
      console.log(`📥 Socket ${socket.id} joined conv_${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // Send a message
    socket.on('send_message', async (data) => {
      try {
        const { conversation_id, sender_id, content } = data;

        // Save message to Postgres
        const { rows: msgRows } = await query(
          'INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES ($1, $2, $3, false, NOW()) RETURNING *',
          [conversation_id, sender_id, content]
        );
        let message = msgRows[0];

        // Fetch sender details
        const { rows: userRows } = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [sender_id]);
        message.sender = userRows[0];

        // Update conversation timestamp
        await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversation_id]);

        // Emit to conversation room
        io.to(`conv_${conversation_id}`).emit('new_message', message);

        // Get conversation to find recipient
        const { rows: convRows } = await query('SELECT user1_id, user2_id FROM conversations WHERE id = $1', [conversation_id]);
        
        if (convRows.length > 0) {
          const conv = convRows[0];
          const recipientId = conv.user1_id === sender_id ? conv.user2_id : conv.user1_id;
          const recipientSocketId = onlineUsers.get(recipientId);

          if (recipientSocketId) {
            io.to(recipientSocketId).emit('notification', {
              type: 'new_message',
              conversation_id,
              message,
            });
          }
        }
      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`conv_${data.conversation_id}`).emit('user_typing', {
        userId: data.user_id,
        conversation_id: data.conversation_id,
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(`conv_${data.conversation_id}`).emit('user_stop_typing', {
        userId: data.user_id,
        conversation_id: data.conversation_id,
      });
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { conversation_id, user_id } = data;
        await query(
           'UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false',
           [conversation_id, user_id]
        );

        socket.to(`conv_${conversation_id}`).emit('messages_read', {
          conversation_id,
          read_by: user_id,
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('user_status', { userId: socket.userId, online: false });
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupChatSocket };
