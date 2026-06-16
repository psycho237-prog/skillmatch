import { Platform } from 'react-native';
import ENV from '../config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = ENV.API_URL;

export const resolveImageUrl = (url: string | null | undefined): string => {
  if (!url) return 'https://via.placeholder.com/150';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${ENV.SOCKET_URL}${url}`;
  return url; // fallback for local paths or others
};

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async getToken() {
    return await AsyncStorage.getItem('@skillmatch_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = await this.getToken();

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error: any) {
      console.error(`API Error [${url}]:`, error.message);
      throw error;
    }
  }

  // Auth
  async loginWithPhone(phone_number: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_number, password }),
    });
  }

  async sendOtp(phone_number: string) {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number }),
    });
  }

  async registerWithPhone(phone_number: string, password: string, display_name: string, otp_code: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone_number, password, display_name, otp_code }),
    });
  }

  async getUser(userId: string) {
    return this.request(`/auth/user/${userId}`);
  }

  // Services
  async getServices(params?: Record<string, string>, userId?: string) {
    const allParams = { ...params };
    if (userId) allParams.user_id = userId;
    const query = Object.keys(allParams).length > 0 ? '?' + new URLSearchParams(allParams).toString() : '';
    return this.request(`/services${query}`);
  }

  async getFeaturedServices(userId?: string) {
    const query = userId ? `?user_id=${userId}` : '';
    return this.request(`/services/featured${query}`);
  }

  async getCategories() {
    return this.request('/services/categories');
  }

  async getServiceById(id: string, userId?: string) {
    const query = userId ? `?user_id=${userId}` : '';
    return this.request(`/services/${id}${query}`);
  }

  async toggleFavorite(serviceId: string, userId: string) {
    return this.request(`/services/${serviceId}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
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

  async rateService(serviceId: string, userId: string, rating: number) {
    return this.request(`/services/${serviceId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, rating }),
    });
  }

  // Upload - Generic multi-file upload via FormData
  async uploadFiles(files: { uri: string; name: string; mimeType: string }[]): Promise<{ urls: string[]; count: number }> {
    const url = `${this.baseUrl}/upload`;
    const token = await this.getToken();

    const formData = new FormData();
    
    await Promise.all(files.map(async (file, index) => {
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append('images', blob, file.name);
      } else {
        formData.append('images', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }
    }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data;
    } catch (error: any) {
      console.error('Upload Error:', error.message);
      throw error;
    }
  }

  // Upload - Multi-image upload via FormData
  async uploadImages(imageUris: string[]): Promise<{ urls: string[]; count: number }> {
    const url = `${this.baseUrl}/upload`;
    const token = await this.getToken();

    const formData = new FormData();
    
    // Process images
    await Promise.all(imageUris.map(async (uri, index) => {
      const filename = uri.split('/').pop() || `image_${index}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : 'image/jpeg';

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('images', blob, filename);
      } else {
        formData.append('images', {
          uri,
          name: filename,
          type,
        } as any);
      }
    }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error: any) {
      console.error(`Upload Error:`, error.message);
      throw error;
    }
  }

  // Search
  async searchServices(query: string, filters?: Record<string, any>, userId?: string) {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...filters, user_id: userId }),
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

  async updateUserPushToken(userId: string, token: string) {
    return this.updateUser(userId, { push_token: token });
  }

  // Wallet
  async getWalletBalance() {
    return this.request('/wallet/balance');
  }

  async getWalletHistory() {
    return this.request('/wallet/history');
  }

  async depositFunds(amount: number, mobileMoneyNumber: string) {
    return this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, mobile_money_number: mobileMoneyNumber }),
    });
  }

  async withdrawFunds(amount: number, mobileMoneyNumber: string) {
    return this.request('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, mobile_money_number: mobileMoneyNumber }),
    });
  }

  // Transactions
  async getTransactions() {
    return this.request('/transactions');
  }

  async createTransaction(data: any) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptTransaction(id: string) {
    return this.request(`/transactions/${id}/accept`, { method: 'POST' });
  }

  async completeTransaction(id: string) {
    return this.request(`/transactions/${id}/complete`, { method: 'POST' });
  }

  async confirmTransaction(id: string) {
    return this.request(`/transactions/${id}/confirm`, { method: 'POST' });
  }

  async disputeTransaction(id: string, reason: string) {
    return this.request(`/transactions/${id}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async submitTransactionProof(id: string, description: string, files: string[] = []) {
    return this.request(`/transactions/${id}/proof`, {
      method: 'POST',
      body: JSON.stringify({ description, files }),
    });
  }

  async cancelTransaction(id: string) {
    return this.request(`/transactions/${id}/cancel`, { method: 'POST' });
  }

  // ================= ADMIN API =================
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getAdminTransactions(params = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/transactions?${query}`);
  }

  async getAdminTransactionDetails(id: string) {
    return this.request(`/admin/transactions/${id}`);
  }

  async getAdminWalletOps(params = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/wallet-ops?${query}`);
  }

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/users?${query}`);
  }

  async setAdminUserStatus(id: string, status: string, reason: string) {
    return this.request(`/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  }

  async adminManualWallet(id: string, action: 'credit' | 'debit', amount: number, reason: string) {
    return this.request(`/admin/users/${id}/wallet-manual`, {
      method: 'POST',
      body: JSON.stringify({ action, amount, reason }),
    });
  }

  async getAdminDisputes(params = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/disputes?${query}`);
  }

  async resolveAdminDispute(id: string, resolution: string, reason: string, providerSharePercentage?: number) {
    return this.request(`/admin/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, reason, providerSharePercentage }),
    });
  }

  async getAdminLogs(params = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/logs?${query}`);
  }
}

export const api = new ApiService();
