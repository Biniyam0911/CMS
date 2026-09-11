import React, { useState, useEffect } from 'react';
import {
  Bell, Clock, LucideIcon,
  HeartPulse, Stethoscope, FileHeart, Activity, ShieldCheck, Building, Cross, FlaskConical
} from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  user: { username: string; roles: string[]; tenantId: number } | null;
  clinicName?: string;
  appIconName?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  HeartPulse,
  Stethoscope,
  FileHeart,
  Activity,
  ShieldCheck,
  Building,
  Cross,
  FlaskConical,
};

export default function Header({ title, subtitle, user, clinicName, appIconName = 'FileHeart' }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ClinicIcon = ICON_MAP[appIconName] || FileHeart;

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '14px 20px',
        borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0071e3, #005bb5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0, 113, 227, 0.28)'
            }}
          >
            <ClinicIcon size={16} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.015em' }}>{title}</h1>
          {clinicName && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: '20px',
                background: 'rgba(0, 113, 227, 0.08)',
                color: '#0071e3',
                border: '1px solid rgba(0, 113, 227, 0.16)'
              }}
            >
              {clinicName}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '3px', paddingLeft: '40px' }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Real-time Clock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-card)',
            padding: '5px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}
        >
          <Clock size={13} color="#0071e3" />
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
        </div>

        {/* Notifications Icon */}
        <div
          style={{
            position: 'relative',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            transition: 'background 0.15s'
          }}
        >
          <Bell size={16} color="var(--text-secondary)" />
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#ff3b30'
            }}
          />
        </div>

        {/* User Profile Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '4px 12px 4px 5px',
            borderRadius: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0071e3, #005bb5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: '#fff'
            }}
          >
            {user?.username?.substring(0, 2).toUpperCase() || 'SA'}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.1 }}>
              {user?.username || 'SuperAdmin'}
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
              {user?.roles?.[0] || 'Doctor'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
