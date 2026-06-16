const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class AdminApi {
  getToken() {
    return localStorage.getItem('admin_token');
  }

  async request(path, options = {}) {
    const token = this.getToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async login(phone_number, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone_number, password }),
    });
    return data;
  }

  async getStats() { return this.request('/admin/stats'); }
  async getUsers(params = {}) { return this.request('/admin/users?' + new URLSearchParams(params)); }
  async setUserStatus(id, status, reason) {
    return this.request(`/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  }
  async manualWallet(id, action, amount, reason) {
    return this.request(`/admin/users/${id}/wallet-manual`, {
      method: 'POST',
      body: JSON.stringify({ action, amount, reason }),
    });
  }
  async getTransactions(params = {}) { return this.request('/admin/transactions?' + new URLSearchParams(params)); }
  async getTransaction(id) { return this.request(`/admin/transactions/${id}`); }
  async getDisputes(params = {}) { return this.request('/admin/disputes?' + new URLSearchParams(params)); }
  async resolveDispute(id, resolution, reason, providerSharePercentage) {
    return this.request(`/admin/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, reason, providerSharePercentage }),
    });
  }
  async getWalletOps(params = {}) { return this.request('/admin/wallet-ops?' + new URLSearchParams(params)); }
  async getLogs() { return this.request('/admin/logs'); }
}

export const api = new AdminApi();
