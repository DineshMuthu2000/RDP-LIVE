import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, Activity, User } from 'lucide-react';
import { api } from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        await api.getHealth();
        setIsOnline(true);
      } catch (err) {
        setIsOnline(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '16px 32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 0 15px rgba(16,185,129,0.3)' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              RDP Manager
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>License Admin Panel</p>
          </div>
        </div>

        {/* Status & User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Health Badge */}
          <div className={`badge ${isOnline ? 'badge-active' : 'badge-disabled'}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Activity size={14} />
            <span>{isOnline ? 'API Online' : 'API Unreachable'}</span>
          </div>

          {/* User Info */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <User size={16} color="var(--gold)" />
              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{user.username}</span>
            </div>
          )}

          {/* Logout */}
          <button onClick={logout} className="btn btn-secondary btn-sm" title="Log Out">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
