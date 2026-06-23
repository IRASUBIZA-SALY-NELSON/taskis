'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Eye, EyeOff } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onUnlock: (passphrase: string) => void;
  fileName?: string;
  action?: 'preview' | 'download';
}

export default function FilePassphraseGate({ open, onClose, onUnlock, fileName, action = 'preview' }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setValue(''); setError(false); setShow(false); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() === 'onedayyouwilldie') {
      onUnlock(value.trim());
      setValue('');
      setError(false);
    } else {
      setError(true);
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: 'rgba(7,7,9,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-2xl border border-border shadow-2xl overflow-hidden"
            style={{ background: 'var(--surface-1)' }}
          >
            {/* header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
              <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: 'color-mix(in srgb,var(--accent) 14%,transparent)', color: 'var(--accent)' }}>
               <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-t1">File is protected</div>
                {fileName && <div className="text-[12px] text-t3 truncate">{fileName}</div>}
              </div>
              <button onClick={onClose} className="icon-btn w-7 h-7 border-0 flex-none"><X className="w-4 h-4" /></button>
            </div>

            {/* body */}
            <form onSubmit={submit} className="px-5 py-5 space-y-4">
              <p className="text-[13px] text-t2 leading-relaxed">
                Enter the passphrase to {action === 'download' ? 'download' : 'preview'} this file.
              </p>

              <div className="relative">
                <input
                  ref={inputRef}
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={e => { setValue(e.target.value); setError(false); }}
                  placeholder="Enter passphrase…"
                  className={`tk-input w-full pr-10 ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-t3 hover:text-t1 transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-[12.5px] font-medium" style={{ color: 'var(--danger)' }}>
     Incorrect passphrase. Try again.
                </motion.p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
                <button type="submit" disabled={!value.trim()} className="btn-accent flex-1 py-2.5 text-sm">
                  {action === 'download' ? 'Download' : 'Preview'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
