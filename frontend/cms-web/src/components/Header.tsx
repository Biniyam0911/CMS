import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Clock, LucideIcon, Check, CheckCheck, X, AlertTriangle,
  Flame, Pill, FlaskConical, DollarSign, Activity, ChevronRight,
  Settings, HeartPulse, Stethoscope, FileHeart, ShieldCheck, Building, Cross, Menu
} from 'lucide-react';
import { api } from '../api/apiClient';
import { ModuleKey } from './Sidebar';
import { NOTIFICATION_EVENTS, isUserSubscribedToEvent } from '../utils/notificationRules';
import { playNotificationTone } from '../utils/audioAnnouncer';

interface HeaderProps {
  title: string;
  subtitle: string;
  user: { username: string; roles: string[]; tenantId: number } | null;
  clinicName?: string;
  appIconName?: string;
  onNavigateModule?: (module: ModuleKey) => void;
  onToggleMobileMenu?: () => void;
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

interface NotificationItem {
  id: number;
  subject: string;
  body: string;
  priority: number;
  notificationType: string;
  statusId: number; // 1 = unread, 2 = read
  createdAt: string;
  targetRole?: string;
}

export default function Header({ title, subtitle, user, clinicName, appIconName = 'FileHeart', onNavigateModule, onToggleMobileMenu }: HeaderProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const data = await api.get<any[]>('/notifications');
      let items: NotificationItem[] = [];
      if (Array.isArray(data)) {
        items = data.map((n: any) => ({
          id: n.id || n.Id,
          subject: n.subject || n.Subject || 'Notification',
          body: n.body || n.Body || '',
          priority: n.priority || n.Priority || 2,
          notificationType: n.notificationType || n.NotificationType || 'General',
          statusId: n.statusId || n.StatusId || 1,
          createdAt: n.createdAt || n.CreatedAt || new Date().toISOString(),
          targetRole: n.targetRole || n.TargetRole
        }));
      }

      // Filter by role subscription
      const userRoles = user?.roles || ['Doctor'];
      const filtered = items.filter(n => isUserSubscribedToEvent(n.notificationType, userRoles));
      setNotifications(filtered);
    } catch {
      // Real notifications only; do not set mock fallback data on error
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);

    const handleNewNotification = (e: any) => {
      const notif = e.detail;
      if (notif) {
        setNotifications(prev => [notif, ...prev]);
        setActiveToast(notif);
        playNotificationTone();
        setTimeout(() => setActiveToast(null), 6000);
      } else {
        loadNotifications();
      }
    };

    window.addEventListener('cms_new_notification', handleNewNotification);
    window.addEventListener('cms_notification_rules_changed', loadNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener('cms_new_notification', handleNewNotification);
      window.removeEventListener('cms_notification_rules_changed', loadNotifications);
    };
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
    } catch {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, statusId: 2 } : n));
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', {});
    } catch {}
    setNotifications(prev => prev.map(n => ({ ...n, statusId: 2 })));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    handleMarkAsRead(item.id);
    setShowDropdown(false);

    // Find target module
    const eventDef = NOTIFICATION_EVENTS.find(e => e.key === item.notificationType);
    if (eventDef && onNavigateModule) {
      onNavigateModule(eventDef.targetModule);
    }
  };

  const unreadCount = notifications.filter(n => n.statusId === 1).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return n.statusId === 1;
    if (filter === 'critical') return n.priority === 1;
    return true;
  });

  const getEventIcon = (type: string, priority: number) => {
    if (priority === 1 || type.toLowerCase().includes('emergency') || type.toLowerCase().includes('critical')) {
      return <Flame size={15} color="#ff3b30" />;
    }
    if (type.toLowerCase().includes('prescription') || type.toLowerCase().includes('drug')) {
      return <Pill size={15} color="#34c759" />;
    }
    if (type.toLowerCase().includes('lab')) {
      return <FlaskConical size={15} color="#af52de" />;
    }
    if (type.toLowerCase().includes('invoice') || type.toLowerCase().includes('billing') || type.toLowerCase().includes('payment')) {
      return <DollarSign size={15} color="#f59e0b" />;
    }
    return <Activity size={15} color="#0071e3" />;
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const ClinicIcon = ICON_MAP[appIconName] || FileHeart;

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '14px 20px',
          borderRadius: '14px',
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          position: 'relative'
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="mobile-only"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                title="Open Navigation"
              >
                <Menu size={22} />
              </button>
            )}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0071e3, #005bb5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 113, 227, 0.28)',
                flexShrink: 0
              }}
            >
              <ClinicIcon size={16} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
            {clinicName && (
              <span
                className="desktop-only"
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '20px',
                  background: 'rgba(0, 113, 227, 0.08)',
                  color: '#0071e3',
                  border: '1px solid rgba(0, 113, 227, 0.16)',
                  whiteSpace: 'nowrap'
                }}
              >
                {clinicName}
              </span>
            )}
          </div>
          <p className="desktop-only" style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '3px', paddingLeft: '40px' }}>{subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Real-time Clock (Desktop only) */}
          <div
            className="desktop-only"
            style={{
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

          {/* Notifications Center Bell with Dynamic Badge */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              title="Notifications"
              style={{
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: showDropdown ? 'rgba(0, 113, 227, 0.12)' : 'var(--bg-card)',
                border: showDropdown ? '1px solid #0071e3' : '1px solid var(--border-color)',
                transition: 'all 0.15s ease',
                outline: 'none'
              }}
            >
              <Bell size={17} color={showDropdown ? '#0071e3' : 'var(--text-secondary)'} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    borderRadius: '9px',
                    background: '#ff3b30',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(255, 59, 48, 0.4)',
                    border: '2px solid var(--bg-card)'
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Center Dropdown Panel */}
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  width: 'min(380px, calc(100vw - 32px))',
                  maxHeight: '480px',
                  borderRadius: '16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-dark)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(255, 59, 48, 0.12)',
                          color: '#d70015'
                        }}
                      >
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.72rem',
                        color: '#0071e3',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', padding: '8px 14px', gap: '6px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                  <button
                    onClick={() => setFilter('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: filter === 'all' ? '#0071e3' : 'transparent',
                      color: filter === 'all' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setFilter('unread')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: filter === 'unread' ? '#0071e3' : 'transparent',
                      color: filter === 'unread' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    Unread ({unreadCount})
                  </button>
                  <button
                    onClick={() => setFilter('critical')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: filter === 'critical' ? '#ff3b30' : 'transparent',
                      color: filter === 'critical' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    Critical ({notifications.filter(n => n.priority === 1).length})
                  </button>
                </div>

                {/* Notifications List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {filteredNotifications.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Bell size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>All caught up!</div>
                      <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>No notifications matching filter</div>
                    </div>
                  ) : (
                    filteredNotifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          marginBottom: '4px',
                          cursor: 'pointer',
                          background: n.statusId === 1 ? 'rgba(0, 113, 227, 0.04)' : 'transparent',
                          border: n.statusId === 1 ? '1px solid rgba(0, 113, 227, 0.12)' : '1px solid transparent',
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                          transition: 'background 0.15s'
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: n.priority === 1 ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 113, 227, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        >
                          {getEventIcon(n.notificationType, n.priority)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                              {n.subject}
                            </span>
                            <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.35 }}>
                            {n.body}
                          </p>
                        </div>

                        {n.statusId === 1 && (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#0071e3',
                              flexShrink: 0,
                              marginTop: '8px'
                            }}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer with Notification Manager Link */}
                <div
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-dark)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      if (onNavigateModule) onNavigateModule('USER_MGMT');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0071e3',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Settings size={13} /> Configure Role Rules in RBAC <ChevronRight size={12} />
                  </button>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {user?.roles?.[0] || 'Doctor'}
                  </span>
                </div>
              </div>
            )}
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

      {/* Floating Animated Toast Banner */}
      {activeToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            width: '360px',
            background: 'var(--bg-card)',
            border: activeToast.priority === 1 ? '1px solid #ff3b30' : '1px solid var(--border-color)',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
            padding: '14px 16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            cursor: 'pointer',
            animation: 'slideIn 0.25s ease-out'
          }}
          onClick={() => handleNotificationClick(activeToast)}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: activeToast.priority === 1 ? 'rgba(255, 59, 48, 0.12)' : 'rgba(0, 113, 227, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {getEventIcon(activeToast.notificationType, activeToast.priority)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{activeToast.subject}</strong>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.35 }}>
              {activeToast.body}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.7rem', color: '#0071e3', fontWeight: 600 }}>
              Click to view details <ChevronRight size={11} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}