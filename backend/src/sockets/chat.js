const { query } = require('../config/database');
const { sendPushNotification } = require('../config/notifications');

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
        const { conversation_id, sender_id, content, reply_to_id } = data;

        // Save message to Postgres
        const { rows: msgRows } = await query(
          'INSERT INTO messages (conversation_id, sender_id, content, status, reply_to_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
          [conversation_id, sender_id, content, 'sent', reply_to_id || null]
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

    // Edit a message
    socket.on('edit_message', async (data) => {
      try {
        const { message_id, content, user_id, conversation_id } = data;
        
        // Ensure 5 minute limit
        const { rows: checkRows } = await query('SELECT created_at FROM messages WHERE id = $1 AND sender_id = $2', [message_id, user_id]);
        if (checkRows.length === 0) return;
        const msgTime = new Date(checkRows[0].created_at).getTime();
        const now = Date.now();
        if (now - msgTime > 5 * 60 * 1000) {
          socket.emit('message_error', { error: 'Time limit exceeded for editing (5 mins)' });
          return;
        }

        const { rows: msgRows } = await query(
          'UPDATE messages SET content = $1, is_edited = true WHERE id = $2 RETURNING *',
          [content, message_id]
        );
        
        io.to(`conv_${conversation_id}`).emit('message_updated', msgRows[0]);
      } catch (error) {
        console.error('Edit message error:', error);
      }
    });

    // Delete a message
    socket.on('delete_message', async (data) => {
      try {
        const { message_id, user_id, conversation_id } = data;
        
        // Ensure they own it
        const { rows: checkRows } = await query('SELECT id FROM messages WHERE id = $1 AND sender_id = $2', [message_id, user_id]);
        if (checkRows.length === 0) return;

        const { rows: msgRows } = await query(
          'UPDATE messages SET content = $1, is_deleted = true WHERE id = $2 RETURNING *',
          ['This message was deleted', message_id]
        );
        
        io.to(`conv_${conversation_id}`).emit('message_updated', msgRows[0]);
      } catch (error) {
        console.error('Delete message error:', error);
      }
    });

    // React to a message
    socket.on('react_message', async (data) => {
      try {
        const { message_id, user_id, emoji, conversation_id } = data;
        
        const { rows: getMsg } = await query('SELECT reactions FROM messages WHERE id = $1', [message_id]);
        if (getMsg.length === 0) return;
        
        let reactions = getMsg[0].reactions || {};
        if (!reactions[emoji]) reactions[emoji] = [];
        
        // Toggle reaction
        if (reactions[emoji].includes(user_id)) {
          reactions[emoji] = reactions[emoji].filter(id => id !== user_id);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji].push(user_id);
        }

        const { rows: msgRows } = await query(
          'UPDATE messages SET reactions = $1 WHERE id = $2 RETURNING *',
          [reactions, message_id]
        );
        
        io.to(`conv_${conversation_id}`).emit('message_updated', msgRows[0]);
      } catch (error) {
        console.error('React message error:', error);
      }
    });

    // Mark messages as delivered
    socket.on('message_delivered', async (data) => {
      try {
        const { conversation_id, user_id } = data;
        await query(
           'UPDATE messages SET status = $1 WHERE conversation_id = $2 AND sender_id != $3 AND status = $4',
           ['delivered', conversation_id, user_id, 'sent']
        );

        socket.to(`conv_${conversation_id}`).emit('messages_status_update', {
          conversation_id,
          status: 'delivered',
          updated_by: user_id,
        });
      } catch (error) {
        console.error('Mark delivered error:', error);
      }
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { conversation_id, user_id } = data;
        await query(
           'UPDATE messages SET status = $1 WHERE conversation_id = $2 AND sender_id != $3 AND status != $1',
           ['read', conversation_id, user_id]
        );

        socket.to(`conv_${conversation_id}`).emit('messages_status_update', {
          conversation_id,
          status: 'read',
          updated_by: user_id,
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
