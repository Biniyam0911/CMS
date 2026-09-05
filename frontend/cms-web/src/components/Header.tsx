import React, { useState, useEffect } from 'react';
import { Bell, Clock } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  user: { username: string; roles: string[]; tenantId: number } | null;
}

export default function Header({ title, subtitle, user }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1px' }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Real-time Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: '16px', border: '1px solid #bae6fd' }}>
          <Clock size={13} />
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{time}</span>
        </div>

        {/* Notifications Icon */}
        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Bell size={18} color="var(--text-secondary)" />
          <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '7px', height: '7px', borderRadius: '50%', background: '#e11d48' }}></span>
        </div>

        {/* User Profile Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '20px', background: '#ffffff', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>
            {user?.username?.substring(0, 2).toUpperCase() || 'SA'}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>{user?.username || 'SuperAdmin'}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{user?.roles?.[0] || 'Doctor'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
