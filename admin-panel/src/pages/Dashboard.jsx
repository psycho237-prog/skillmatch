import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>;

  const StatCard = ({ title, value, sub, color = 'blue', icon }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm font-medium">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold text-${color}-600`}>{value?.toLocaleString()}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* User Stats */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Users</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard title="Total" value={stats?.users?.total} icon="👥" color="blue" />
        <StatCard title="New Today" value={stats?.users?.new_today} icon="🆕" color="green" />
        <StatCard title="Last 7 Days" value={stats?.users?.new_7d} icon="📅" color="indigo" />
        <StatCard title="Last 30 Days" value={stats?.users?.new_30d} icon="📆" color="purple" />
        <StatCard title="Active/Month" value={stats?.users?.active_this_month} icon="⚡" color="orange" />
        <StatCard title="Suspended" value={stats?.users?.suspended} icon="🚫" color="red" />
      </div>

      {/* Transaction Stats */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Transactions</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total" value={stats?.transactions?.total} icon="💳" color="blue" />
        <StatCard title="Pending" value={stats?.transactions?.pending} icon="⏳" color="yellow" />
        <StatCard title="Completed" value={stats?.transactions?.completed} icon="✅" color="green" />
        <StatCard title="Disputed" value={stats?.transactions?.disputed} icon="⚠️" color="red" />
        <StatCard title="Cancelled" value={stats?.transactions?.cancelled} icon="❌" color="gray" />
      </div>

      {/* Commission Stats */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Platform Revenue (XAF)</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Commissions" value={stats?.commissions?.total} icon="🏦" color="emerald" />
        <StatCard title="Today" value={stats?.commissions?.today} icon="📈" color="green" />
        <StatCard title="This Week" value={stats?.commissions?.week} icon="📊" color="teal" />
        <StatCard title="This Month" value={stats?.commissions?.month} icon="💰" color="cyan" />
      </div>
    </div>
  );
}
