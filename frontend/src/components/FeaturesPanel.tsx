'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CircleCheck, Circle, X, ChevronDown, PartyPopper } from 'lucide-react';
import { FEATURES, getDone, hasSeenTour, setSeen, onFeatureChange, markFeature } from '@/lib/features';
import { confetti } from '@/lib/fun';

/**
 * A cookie-banner-style "What's new" announcer that slides in on first visit,
 * with a Notion-style exploration checklist. A floating button reopens it later.
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

  const total = FEATURES.length;
  const completed = FEATURES.filter((f) => done.has(f.key)).length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  // a little celebration the moment the whole list is finished
  useEffect(() => {
    if (allDone && open && !celebrated) { confetti(120); setCelebrated(true); }
    if (!allDone) setCelebrated(false);
  }, [allDone, open, celebrated]);

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="card w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            {/* header */}
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center flex-none text-on-accent" style={{ background: 'var(--accent)' }}>
                <Sparkles className="w-[17px] h-[17px]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-t1 tracking-tight">What’s new in Taskis</div>
                <div className="text-[12.5px] text-t2 mt-0.5">Explore the latest features</div>
              </div>
              <button onClick={() => setOpen(false)} className="icon-btn w-7 h-7 flex-none border-0" aria-label="Collapse">
                <ChevronDown className="w-[16px] h-[16px]" />
              </button>
            </div>

            {/* checklist */}
            <div className="px-2 pb-1 max-h-[46vh] overflow-y-auto scroll">
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

            {/* progress footer */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-3">
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
        )}
      </AnimatePresence>

      {/* reopen button — always available */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-full btn-accent text-[13px] shadow-[var(--shadow-md)]"
        title="What's new"
      >
        <Sparkles className="w-[15px] h-[15px]" />
        New features
        {!open && completed < total && (
          <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-bold" style={{ background: 'var(--on-btn)', color: 'var(--btn-primary)' }}>
            {total - completed}
          </span>
        )}
      </button>
    </div>
  );
}
