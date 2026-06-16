import React, { useState, useEffect } from 'react';
import { api } from '../api';

function Badge({ status }) {
  const map = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-yellow-100 text-yellow-700',
    banned: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status || 'active'}
    </span>
  );
}

function UserModal({ user, onClose, onRefresh }) {
  const [action, setAction] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleWallet = async () => {
    setLoading(true); setMsg('');
    try {
      await api.manualWallet(user.id, action, parseFloat(amount), reason);
      setMsg('✅ Wallet adjusted successfully');
      setAmount(''); setReason('');
      onRefresh();
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setLoading(false); }
  };

  const handleStatus = async () => {
    setLoading(true); setMsg('');
    try {
      await api.setUserStatus(user.id, newStatus, statusReason);
      setMsg('✅ Status updated');
      setStatusReason('');
      onRefresh();
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="font-bold text-lg">{user.display_name}</h2>
            <p className="text-gray-500 text-sm">{user.phone_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {msg && <div className="bg-gray-50 rounded-lg p-3 text-sm">{msg}</div>}

          {/* Wallet info */}
          <div className="grid grid-cols-2 gap-4 bg-blue-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-500">Balance</p>
              <p className="font-bold text-blue-700">{parseFloat(user.balance || 0).toLocaleString()} XAF</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending</p>
              <p className="font-bold text-orange-600">{parseFloat(user.pending_balance || 0).toLocaleString()} XAF</p>
            </div>
          </div>

          {/* Manual Wallet Adjustment */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 mb-3">Manual Wallet Adjustment</h3>
            <div className="flex gap-2 mb-2">
              {['credit', 'debit'].map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${action === a ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (XAF)" className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)" className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={handleWallet} disabled={loading || !amount || !reason}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
              Apply Adjustment
            </button>
          </div>

          {/* Status Change */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 mb-3">Change Account Status</h3>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">Select status...</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
            <input type="text" value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Reason" className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={handleStatus} disabled={loading || !newStatus || !statusReason}
              className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-orange-600">
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api.getUsers({ search, limit: 100 })
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search name or phone..."
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
          />
          <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Search</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Name', 'Phone', 'Balance', 'Txns', 'Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{u.display_name}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone_number}</td>
                <td className="px-4 py-3 font-mono text-blue-700">{parseFloat(u.balance || 0).toLocaleString()} XAF</td>
                <td className="px-4 py-3 text-gray-500">{u.tx_count}</td>
                <td className="px-4 py-3"><Badge status={u.status} /></td>
                <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(u)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <UserModal user={selected} onClose={() => setSelected(null)} onRefresh={load} />}
    </div>
  );
}
