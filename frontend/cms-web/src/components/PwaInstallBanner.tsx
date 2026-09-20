import React, { useState, useEffect } from 'react';
import { Download, X, Share, Smartphone, PlusSquare, Check } from 'lucide-react';
import {
  isStandalone,
  isIos,
  subscribeToInstallPrompt,
  triggerPwaInstall
} from '../utils/pwaInstallPrompt';

export default function PwaInstallBanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [alreadyStandalone, setAlreadyStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setAlreadyStandalone(true);
      return;
    }

    const dismissedUntil = localStorage.getItem('cms_pwa_banner_dismissed');
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setDismissed(true);
      return;
    }

    const unsubscribe = subscribeToInstallPrompt((installable) => {
      setCanInstall(installable);
    });

    return () => unsubscribe();
  }, []);

  if (alreadyStandalone || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 7 days
    localStorage.setItem('cms_pwa_banner_dismissed', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleInstallClick = async () => {
    if (isIos()) {
      setShowIosGuide(true);
      return;
    }

    const accepted = await triggerPwaInstall();
    if (accepted) {
      setInstalledSuccess(true);
      setTimeout(() => setDismissed(true), 2500);
    }
  };

  // If not iOS and install prompt not ready yet, don't render clutter
  if (!canInstall && !isIos()) return null;

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(90deg, #0071e3 0%, #005bb5 100%)',
          color: '#ffffff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,113,227,0.3)',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          fontSize: '0.82rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Smartphone size={18} color="#ffffff" />
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installedSuccess ? 'App Installed!' : 'Install CMS Mobile App'}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installedSuccess ? 'You can now access CMS from your home screen' : 'Fast one-tap access, full screen & offline support'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {!installedSuccess ? (
            <button
              onClick={handleInstallClick}
              style={{
                background: '#ffffff',
                color: '#0071e3',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <Download size={13} /> Install
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Ready
            </span>
          )}

          <button
            onClick={handleDismiss}
            title="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowIosGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              marginBottom: '16px',
              color: 'var(--text-main, #1d1d1f)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={18} color="#0071e3" /> Install CMS on iPhone / iPad
              </h3>
              <button
                onClick={() => setShowIosGuide(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #6e6e73)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6e6e73)', marginBottom: '16px' }}>
              Follow these simple steps in Safari to install CMS on your home screen:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-dark, #f5f5f7)', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0071e3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>1</div>
                <div>Tap the <strong>Share</strong> button <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> at the bottom of Safari.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-dark, #f5f5f7)', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0071e3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>2</div>
                <div>Scroll down and select <strong>Add to Home Screen</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-dark, #f5f5f7)', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0071e3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>3</div>
                <div>Tap <strong>Add</strong> in the top-right corner.</div>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '18px', justifyContent: 'center', padding: '10px' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
