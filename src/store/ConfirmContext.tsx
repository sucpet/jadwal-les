import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLang } from './LanguageContext';

// Modal konfirmasi in-app reusable (pengganti window.confirm yang tidak andal di PWA).
// Pemakaian: const confirm = useConfirm(); if (await confirm({ message, danger })) { ... }
interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolverRef.current = resolve;
    setOpts(o);
  }), []);

  const close = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      else if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => close(false)}>
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              {opts.danger && (
                <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {opts.title && <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{opts.title}</h3>}
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line break-words">{opts.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => close(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {opts.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                onClick={() => close(true)}
                className={`text-sm px-4 py-2 rounded-lg text-white ${opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {opts.confirmLabel ?? t('common.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
