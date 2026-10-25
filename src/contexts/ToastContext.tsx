import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
  confirmAction: (options: ConfirmDialogState) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirmAction = useCallback((options: ConfirmDialogState) => {
    setConfirmState(options);
  }, []);

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
    } finally {
      setConfirmBusy(false);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* Toast Notification Stack */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0 no-print"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-[#0D1F38] border border-[#1E3A5F] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)] rounded-xl p-4 text-[#F8FAFC]"
          >
            {t.type === 'success' && (
              <div className="w-7 h-7 rounded-lg bg-[#22C55E]/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              </div>
            )}
            {t.type === 'warning' && (
              <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              </div>
            )}
            {t.type === 'error' && (
              <div className="w-7 h-7 rounded-lg bg-[#EF4444]/15 flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4 text-[#EF4444]" />
              </div>
            )}
            {t.type === 'info' && (
              <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-[#10B981]" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-[#F8FAFC] leading-snug">{t.title}</p>
              {t.message && (
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed break-words">
                  {t.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] p-1.5 rounded-lg transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Destructive Action Confirmation Dialog */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040D1A]/80 backdrop-blur-xs p-4 no-print"
        >
          <div className="bg-[#0D1F38] border border-[#1E3A5F] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-[#EF4444]/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[#F8FAFC]">{confirmState.title}</h3>
                <p className="text-sm text-[#94A3B8] mt-1.5 leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1E3A5F]">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-xs font-semibold text-[#F8FAFC] bg-[#132A4A] hover:bg-[#1E293B] border border-[#1E3A5F] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={handleConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {confirmBusy ? 'Processing...' : confirmState.confirmLabel || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
