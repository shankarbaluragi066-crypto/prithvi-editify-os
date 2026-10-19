import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

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

      {/* Toast Stack */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0 no-print"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-[#E2E4DF] shadow-lg rounded-lg p-4 text-[#172333]"
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#26734D] shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#A96518] shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 text-[#B93832] shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.message && <p className="text-xs text-[#6E7785] mt-0.5 break-words">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-[#6E7785] hover:text-[#172333] p-1 rounded"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172333]/60 p-4 no-print"
        >
          <div className="bg-white border border-[#E2E4DF] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#172333]">{confirmState.title}</h3>
            <p className="text-sm text-[#6E7785] mt-2 leading-relaxed">{confirmState.message}</p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-sm font-medium text-[#172333] bg-[#F5F5F1] hover:bg-[#E2E4DF] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-[#B93832] hover:bg-[#992B26] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {confirmBusy ? 'Processing...' : confirmState.confirmLabel || 'Confirm Delete'}
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
