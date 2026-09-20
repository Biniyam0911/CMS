// Progressive Web App (PWA) Install Prompt Hook & Utilities

type InstallPromptListener = (canInstall: boolean) => void;

let deferredPrompt: any = null;
const listeners: Set<InstallPromptListener> = new Set();

export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

export const isIos = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

export const isIosSafari = (): boolean => {
  if (!isIos()) return false;
  const ua = window.navigator.userAgent;
  return /WebKit/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
};

// Initialize listener once on page load
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners(false);
  });
}

function notifyListeners(canInstall: boolean) {
  listeners.forEach((fn) => fn(canInstall));
}

export const subscribeToInstallPrompt = (fn: InstallPromptListener): (() => void) => {
  listeners.add(fn);
  fn(deferredPrompt !== null);
  return () => {
    listeners.delete(fn);
  };
};

export const triggerPwaInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyListeners(false);
    return outcome === 'accepted';
  } catch (err) {
    console.error('Error triggering PWA install prompt:', err);
    return false;
  }
};
