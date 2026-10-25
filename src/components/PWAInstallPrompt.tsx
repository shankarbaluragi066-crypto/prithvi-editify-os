import React, { useState, useEffect } from 'react';
import { Download, WifiOff, Smartphone, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;

export const OfflineStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>You are currently offline. Viewing cached Prithvi Editify studio data — changes will sync when reconnected.</span>
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(deferredPromptGlobal);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      deferredPromptGlobal = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredPromptGlobal = null;
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPromptGlobal = null;
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install Prithvi Editify App to Home Screen"
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D1F38] hover:bg-[#132A4A] text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all'
            : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D1F38]/90 hover:bg-[#132A4A] text-slate-200 hover:text-emerald-300 border border-[#1E3A5F] hover:border-emerald-500/40 text-xs font-semibold transition-all'
        }
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>Install App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#132A4A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">Install Prithvi Editify App</h3>
                <p className="text-xs text-slate-400">Fast home-screen access for Clients & Studio Admin</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-[#081629] border border-[#1E3A5F] rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white">Chrome / Edge (Desktop & Android):</strong> Click the{' '}
                  <span className="text-emerald-300 font-semibold">Install icon</span> in the browser address bar or open browser menu →{' '}
                  <span className="text-emerald-300 font-semibold">"Install App" / "Add to Home screen"</span>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white">Safari on iPhone / iPad:</strong> Tap the{' '}
                  <span className="text-emerald-300 font-semibold">Share</span> button at the bottom of Safari and select{' '}
                  <span className="text-emerald-300 font-semibold">"Add to Home Screen"</span>.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0EA5E9] text-[#040D1A] font-bold text-xs hover:opacity-95 transition-opacity"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
