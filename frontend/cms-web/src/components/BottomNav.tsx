import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileHeart,
  Video,
  Menu
} from 'lucide-react';
import { ModuleKey } from './Sidebar';

interface BottomNavProps {
  activeModule: ModuleKey;
  onSelectModule: (key: ModuleKey) => void;
  onToggleMobileMenu: () => void;
}

export default function BottomNav({
  activeModule,
  onSelectModule,
  onToggleMobileMenu
}: BottomNavProps) {
  const tabs = [
    { key: 'DASHBOARD' as ModuleKey, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'PATIENTS' as ModuleKey, label: 'Patients', icon: Users },
    { key: 'EMR' as ModuleKey, label: 'EMR', icon: FileHeart },
    { key: 'TELEMED' as ModuleKey, label: 'Telemed', icon: Video },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-color, #e5e5ea)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 5000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)'
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeModule === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelectModule(tab.key)}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--accent-blue, #0071e3)' : 'var(--text-secondary, #6e6e73)',
              transition: 'color 0.15s ease'
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--accent-blue, #0071e3)'
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.01em'
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* More / Menu Drawer Trigger */}
      <button
        onClick={onToggleMobileMenu}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary, #6e6e73)',
          transition: 'color 0.15s ease'
        }}
      >
        <Menu size={20} strokeWidth={1.8} />
        <span style={{ fontSize: '0.68rem', fontWeight: 500, letterSpacing: '-0.01em' }}>
          All Modules
        </span>
      </button>
    </nav>
  );
}
