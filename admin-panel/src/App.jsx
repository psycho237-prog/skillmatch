import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Transactions from './pages/Transactions';
import Disputes from './pages/Disputes';
import WalletOps from './pages/WalletOps';
import Logs from './pages/Logs';

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '📊' },
  { id: 'users',        label: 'Users',        icon: '👥' },
  { id: 'transactions', label: 'Transactions', icon: '💳' },
  { id: 'disputes',     label: 'Disputes',     icon: '⚠️' },
  { id: 'wallet-ops',   label: 'Wallet Ops',   icon: '🏦' },
  { id: 'logs',         label: 'Activity Logs',icon: '📋' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const stored = localStorage.getItem('admin_user');
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':    return <Dashboard />;
      case 'users':        return <Users />;
      case 'transactions': return <Transactions />;
      case 'disputes':     return <Disputes />;
      case 'wallet-ops':   return <WalletOps />;
      case 'logs':         return <Logs />;
      default:             return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-lg">🛡️</div>
            <div>
              <p className="text-white font-bold text-sm">SkillMatch</p>
              <p className="text-gray-400 text-xs">Admin Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                page === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.id === 'disputes' && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
              )}
            </button>
          ))}
        </nav>

        {/* User info / Logout */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-gray-300 text-sm font-bold">
              {user.display_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-gray-500 text-xs capitalize">{user.role || 'admin'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-center text-gray-400 hover:text-red-400 text-xs py-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        {renderPage()}
      </main>
    </div>
  );
}
