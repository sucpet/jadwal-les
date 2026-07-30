import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Toast in-app reusable. Pemakaian: const toast = useToast(); toast.success('Tersimpan');
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string }

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });

const META: Record<ToastType, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'text-green-600 dark:text-green-400' },
  error:   { icon: AlertTriangle, cls: 'text-red-600 dark:text-red-400' },
  info:    { icon: Info, cls: 'text-indigo-600 dark:text-indigo-400' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const push = useCallback((type: ToastType, msg: string) => {
    const id = nextId.current++;
    setToasts(ts => [...ts, { id, type, msg }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const api = useRef<ToastApi>({
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map(t => {
          const { icon: Icon, cls } = META[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3"
            >
              <Icon size={18} className={`${cls} flex-shrink-0 mt-0.5`} />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 break-words">{t.msg}</span>
              <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
