import ENV from '../config/env';

const API_URL = ENV.API_URL;

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error: any) {
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  }

  // Auth
  async loginWithGoogle(userInfo: any) {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ user_info: userInfo }),
    });
  }

  async getUser(userId: string) {
    return this.request(`/auth/user/${userId}`);
  }

  // Services
  async getServices(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/services${query}`);
  }

  async getFeaturedServices() {
    return this.request('/services/featured');
  }

  async getCategories() {
    return this.request('/services/categories');
  }

  async getServiceById(id: string) {
    return this.request(`/services/${id}`);
  }

  async createService(service: any) {
    return this.request('/services', {
      method: 'POST',
      body: JSON.stringify(service),
    });
  }

  async updateService(id: string, updates: any) {
    return this.request(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteService(id: string) {
    return this.request(`/services/${id}`, { method: 'DELETE' });
  }

  // Search
  async searchServices(query: string, filters?: Record<string, any>) {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...filters }),
    });
  }

  // Chat
  async getConversations(userId: string) {
    return this.request(`/chat/conversations/${userId}`);
  }

  async getMessages(conversationId: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    return this.request(`/chat/messages/${conversationId}?${params.toString()}`);
  }

  async createConversation(user1Id: string, user2Id: string, serviceId?: string) {
    return this.request('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ user1_id: user1Id, user2_id: user2Id, service_id: serviceId }),
    });
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    return this.request('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, content }),
    });
  }

  async markMessagesRead(conversationId: string, userId: string) {
    return this.request('/chat/messages/read', {
      method: 'PUT',
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId }),
    });
  }

  // Users
  async updateUser(userId: string, updates: any) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUserServices(userId: string) {
    return this.request(`/users/${userId}/services`);
  }
}

export const api = new ApiService();
