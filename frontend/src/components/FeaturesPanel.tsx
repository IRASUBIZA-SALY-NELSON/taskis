'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CircleCheck, Circle, X, PartyPopper } from 'lucide-react';
import { FEATURES, getDone, hasSeenTour, setSeen, onFeatureChange, markFeature } from '@/lib/features';
import { confetti } from '@/lib/fun';

/**
 * "What's new" announcer + exploration checklist. Opens automatically on first
 * visit and on demand via the `open-whats-new` window event (fired from the
 * sidebar). Rendered as a centered modal so it never covers the composer.
 */
export default function FeaturesPanel() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    setDone(getDone());
    if (!hasSeenTour()) {
      const t = setTimeout(() => { setOpen(true); setSeen(); }, 900);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => onFeatureChange(() => setDone(getDone())), []);
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('open-whats-new', openIt);
    return () => window.removeEventListener('open-whats-new', openIt);
  }, []);

  const total = FEATURES.length;
  const completed = FEATURES.filter((f) => done.has(f.key)).length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  useEffect(() => {
    if (allDone && open && !celebrated) { confetti(120); setCelebrated(true); }
    if (!allDone) setCelebrated(false);
  }, [allDone, open, celebrated]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[460] flex items-end sm:items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(7,7,9,0.5)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="card w-[380px] max-w-full overflow-hidden"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center flex-none text-on-accent" style={{ background: 'var(--accent)' }}>
                <Sparkles className="w-[17px] h-[17px]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-t1 tracking-tight">What’s new in Taskis</div>
                <div className="text-[12.5px] text-t2 mt-0.5">Explore the latest features</div>
              </div>
              <button onClick={() => setOpen(false)} className="icon-btn w-7 h-7 flex-none border-0" aria-label="Close">
                <X className="w-[16px] h-[16px]" />
              </button>
            </div>

            <div className="px-3 pb-1 max-h-[50vh] overflow-y-auto scroll">
              {FEATURES.map((f) => {
                const isDone = done.has(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => markFeature(f.key)}
                    className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-hover transition-colors text-left group"
                    title={isDone ? 'Explored' : 'Mark as explored'}
                  >
                    {isDone
                      ? <CircleCheck className="w-[18px] h-[18px] flex-none mt-px" style={{ color: 'var(--accent)' }} />
                      : <Circle className="w-[18px] h-[18px] flex-none mt-px text-t3 group-hover:text-t2" />}
                    <span className="min-w-0">
                      <span className={`block text-[13.5px] font-medium ${isDone ? 'text-t3 line-through' : 'text-t1'}`}>{f.title}</span>
                      {!isDone && <span className="block text-[12px] text-t2 leading-snug mt-0.5">{f.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center gap-3">
              {allDone ? (
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--accent-text)' }}>
                  <PartyPopper className="w-[14px] h-[14px]" />All explored — nice!
                </span>
              ) : (
                <span className="text-[12.5px] font-semibold text-t1 flex-none">{completed} of {total} explored</span>
              )}
              <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <motion.span className="block h-full rounded-full" style={{ background: 'var(--accent)' }} initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 200, damping: 26 }} />
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
