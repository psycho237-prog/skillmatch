const { supabase } = require('../config/supabase');

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

        // Save message to database
        const { data: message, error } = await supabase
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

        // Emit to conversation room
        io.to(`conv_${conversation_id}`).emit('new_message', message);

        // Get conversation to find recipient
        const { data: conv } = await supabase
          .from('conversations')
          .select('user1_id, user2_id')
          .eq('id', conversation_id)
          .single();

        if (conv) {
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
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversation_id)
          .neq('sender_id', user_id)
          .eq('is_read', false);

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
