import React, { useState, useEffect } from 'react';
import { api } from '../api';

function ResolveModal({ dispute, onClose, onRefresh }) {
  const [resolution, setResolution] = useState('');
  const [reason, setReason] = useState('');
  const [split, setSplit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleResolve = async () => {
    if (!resolution || !reason) return;
    setLoading(true); setMsg('');
    try {
      await api.resolveDispute(dispute.id, resolution, reason, split);
      setMsg('✅ Dispute resolved successfully');
      setTimeout(() => { onClose(); onRefresh(); }, 1500);
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="font-bold text-lg text-red-600">Resolve Dispute</h2>
            <p className="text-gray-500 text-sm">Tx: {dispute.id?.slice(0, 12)}…</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Provider</p>
              <p className="font-semibold text-blue-700">{dispute.provider_name}</p>
              <p className="text-xs text-gray-400">{dispute.provider_phone}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Beneficiary</p>
              <p className="font-semibold text-orange-700">{dispute.beneficiary_name}</p>
              <p className="text-xs text-gray-400">{dispute.beneficiary_phone}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500">Amount: <span className="font-bold text-gray-800">{parseFloat(dispute.amount || 0).toLocaleString()} XAF</span></p>
            <p className="text-gray-500 mt-1">Dispute reason: <span className="text-gray-700">{dispute.dispute_reason || 'N/A'}</span></p>
          </div>

          {msg && <div className="bg-gray-50 rounded-lg p-3 text-sm">{msg}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Decision</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'provider_wins', label: '⚖️ Provider Wins' },
                { val: 'beneficiary_wins', label: '⚖️ Beneficiary Wins' },
                { val: 'split', label: '✂️ Split' },
                { val: 'auto_refund', label: '↩️ Refund Both' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setResolution(opt.val)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${resolution === opt.val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {resolution === 'split' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider Share: {split}%</label>
              <input type="range" min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% (Beneficiary)</span><span>50/50</span><span>100% (Provider)</span>
              </div>
            </div>
          )}

          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Resolution notes / reason (required)..."
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />

          <button onClick={handleResolve} disabled={loading || !resolution || !reason}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-red-700">
            {loading ? 'Processing...' : 'Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Disputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('disputed');

  const load = () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;
    api.getDisputes(params)
      .then(setDisputes)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
        <div className="flex gap-2">
          <button onClick={() => setFilter('disputed')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'disputed' ? 'bg-red-600 text-white' : 'bg-white border text-gray-600 hover:border-red-400'}`}>Open</button>
          <button onClick={() => setFilter('resolved')} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === 'resolved' ? 'bg-green-600 text-white' : 'bg-white border text-gray-600 hover:border-green-400'}`}>Resolved</button>
          <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-lg text-sm font-medium ${!filter ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>All</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"></div></div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 font-medium">No disputes found</p>
          <p className="text-gray-400 text-sm">All transactions are running smoothly!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'disputed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{d.status}</span>
                    <span className="text-xs text-gray-400 font-mono">{d.id?.slice(0, 12)}…</span>
                    <span className="text-xs text-gray-400">{new Date(d.dispute_opened_at || d.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Provider</p>
                      <p className="font-medium">{d.provider_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Beneficiary</p>
                      <p className="font-medium">{d.beneficiary_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Amount</p>
                      <p className="font-bold text-gray-900">{parseFloat(d.amount || 0).toLocaleString()} XAF</p>
                    </div>
                  </div>
                  {d.dispute_reason && <p className="text-gray-500 text-xs mt-2">Reason: {d.dispute_reason}</p>}
                  {d.dispute_resolution && <p className="text-green-600 text-xs mt-1">Resolution: {d.dispute_resolution} — {d.dispute_notes}</p>}
                </div>
                {d.status === 'disputed' && (
                  <button onClick={() => setSelected(d)}
                    className="ml-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 whitespace-nowrap">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <ResolveModal dispute={selected} onClose={() => setSelected(null)} onRefresh={load} />}
    </div>
  );
}
