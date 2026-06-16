import { io, Socket } from 'socket.io-client';
import ENV from '../config/env';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(userId: string) {
    if (this.socket?.connected) return;

    this.socket = io(ENV.SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.socket?.emit('user_online', userId);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    // Re-emit events to local listeners
    this.socket.onAny((event, ...args) => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(cb => cb(...args));
      }
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave_conversation', conversationId);
  }

  sendMessage(data: { conversation_id: string; sender_id: string; content: string }) {
    this.socket?.emit('send_message', data);
  }

  startTyping(data: { conversation_id: string; user_id: string }) {
    this.socket?.emit('typing', data);
  }

  stopTyping(data: { conversation_id: string; user_id: string }) {
    this.socket?.emit('stop_typing', data);
  }

  markRead(data: { conversation_id: string; user_id: string }) {
    this.socket?.emit('mark_read', data);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  get isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
