'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/lib/useFocusTrap';

const SHORTCUTS: [string, string][] = [
  ['⌘ / Ctrl + K', 'Open the command palette'],
  ['?', 'Show this help'],
  ['Enter', 'Send message'],
  ['Shift + Enter', 'New line'],
  ['↑', 'Edit your last message (empty composer)'],
  ['Esc', 'Cancel reply / close dialogs'],
  ['@', 'Mention someone'],
  [':', 'Emoji autocomplete'],
  ['Double-click image', 'Like a post'],
  ['Drag / paste', 'Attach an image'],
];

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '?' && !typing) { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[560] flex items-center justify-center p-6"
          style={{ background: 'rgba(7,7,9,0.55)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            ref={ref}
            role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="card w-[440px] max-w-full p-6"
            style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="serif text-[18px] font-semibold text-t1">Keyboard shortcuts</h2>
              <button onClick={() => setOpen(false)} className="icon-btn w-8 h-8" aria-label="Close"><X className="w-[15px] h-[15px]" /></button>
            </div>
            <div className="flex flex-col gap-1">
              {SHORTCUTS.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-[13.5px] text-t2">{desc}</span>
                  <kbd className="text-[11.5px] font-medium text-t1 bg-surface-2 border border-border rounded-md px-2 py-0.5 whitespace-nowrap">{key}</kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
