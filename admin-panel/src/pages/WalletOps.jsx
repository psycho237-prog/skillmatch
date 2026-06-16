import React, { useState, useEffect } from 'react';
import { api } from '../api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function WalletOps() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');

  const load = () => {
    setLoading(true);
    const params = { limit: 100 };
    if (type) params.type = type;
    api.getWalletOps(params)
      .then(setOps)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [type]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Wallet Operations</h1>
        <div className="flex gap-2">
          {['', 'deposit', 'withdrawal'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${type === t ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:border-blue-400'}`}>
              {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['User', 'Phone', 'Type', 'Amount', 'Status', 'Description', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : ops.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No operations found</td></tr>
            ) : ops.map(op => (
              <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{op.user_name}</td>
                <td className="px-4 py-3 text-gray-500">{op.user_phone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${op.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {op.type === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">{parseFloat(op.amount || 0).toLocaleString()} XAF</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[op.status] || 'bg-gray-100 text-gray-600'}`}>{op.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{op.description}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(op.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
