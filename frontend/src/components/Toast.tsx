'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/lib/useFocusTrap';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType }
interface ConfirmOpts { title?: string; body?: string; confirmText?: string; cancelText?: string; danger?: boolean }

interface ToastApi {
  toast: (message: string, type?: ToastType) => void;
  confirm: (opts: ConfirmOpts | string) => Promise<boolean>;
}

const Ctx = createContext<ToastApi>({ toast: () => {}, confirm: async () => false });
export const useToast = () => useContext(Ctx);

const ICONS = {
  success: <CheckCircle2 className="w-[17px] h-[17px]" style={{ color: 'var(--online)' }} />,
  error: <AlertCircle className="w-[17px] h-[17px]" style={{ color: 'var(--danger)' }} />,
  info: <Info className="w-[17px] h-[17px]" style={{ color: 'var(--accent-text)' }} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!confirmState, dialogRef);

  useEffect(() => setMounted(true), []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setItems((p) => [...p, { id, message, type }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts | string) => {
    const o = typeof opts === 'string' ? { body: opts } : opts;
    return new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve }));
  }, []);

  const closeConfirm = (v: boolean) => { confirmState?.resolve(v); setConfirmState(null); };

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
      if (e.key === 'Enter') closeConfirm(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmState]);

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {mounted && createPortal(
        <div className="fixed bottom-5 right-5 z-[600] flex flex-col gap-2 items-end pointer-events-none">
          <AnimatePresence>
            {items.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="card pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 min-w-[220px] max-w-[360px]"
                style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
              >
                {ICONS[t.type]}
                <span className="text-[13.5px] text-t1 leading-snug">{t.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {confirmState && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => closeConfirm(false)}
              className="fixed inset-0 z-[600] flex items-center justify-center p-6"
              style={{ background: 'rgba(7,7,9,0.6)', backdropFilter: 'blur(2px)' }}
            >
              <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={confirmState.title || 'Confirm'}
                initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className="card w-[400px] max-w-full p-6"
                style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
              >
                {confirmState.danger && (
                  <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                {confirmState.title && <h2 className="text-[17px] font-semibold text-t1 mb-1.5">{confirmState.title}</h2>}
                {confirmState.body && <p className="text-[13.5px] leading-[1.55] text-t2 mb-5">{confirmState.body}</p>}
                <div className="flex gap-2.5 justify-end">
                  <button onClick={() => closeConfirm(false)} className="btn-secondary px-4 py-2.5 text-sm">{confirmState.cancelText || 'Cancel'}</button>
                  <button
                    autoFocus
                    onClick={() => closeConfirm(true)}
                    className={confirmState.danger ? 'px-4 py-2.5 text-sm rounded-[10px] font-semibold text-white' : 'btn-accent px-4 py-2.5 text-sm'}
                    style={confirmState.danger ? { background: 'var(--danger)' } : undefined}
                  >
                    {confirmState.confirmText || 'Confirm'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
