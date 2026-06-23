'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, ListChecks } from 'lucide-react';

/** A friendly poll builder — question + up to 10 options, no syntax to remember. */
export default function PollComposer({ onSubmit, onClose }: { onSubmit: (q: string, options: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length >= 10 ? o : [...o, '']));
  const removeOpt = (i: number) => setOptions((o) => (o.length <= 2 ? o : o.filter((_, k) => k !== i)));

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = q.trim().length > 0 && clean.length >= 2;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit(q.trim(), clean.slice(0, 10));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[460] flex items-center justify-center p-6 tk-fade" style={{ background: 'rgba(7,7,9,0.55)', backdropFilter: 'blur(3px)' }}>
      <motion.form
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="card w-[420px] max-w-full p-5" style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-none text-on-accent" style={{ background: 'var(--accent)' }}><ListChecks className="w-[17px] h-[17px]" /></span>
          <div className="flex-1">
            <h2 className="text-[16px] font-semibold text-t1">Create a poll</h2>
            <div className="text-[12.5px] text-t2">Ask the team a question</div>
          </div>
          <button type="button" onClick={onClose} className="icon-btn w-8 h-8" aria-label="Close"><X className="w-[15px] h-[15px]" /></button>
        </div>

        <label className="eyebrow block mb-1.5">Question</label>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="What should we have for lunch?" className="tk-input mb-4" maxLength={200} />

        <label className="eyebrow block mb-1.5">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={opt} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} className="tk-input flex-1" maxLength={80} />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOpt(i)} className="icon-btn w-9 h-9 flex-none" aria-label="Remove option"><Trash2 className="w-[14px] h-[14px]" /></button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button type="button" onClick={addOpt} className="btn-ghost mt-2 px-2.5 py-1.5 text-[13px]"><Plus className="w-[14px] h-[14px]" />Add option</button>
        )}

        <div className="flex gap-2.5 mt-5">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
          <button type="submit" disabled={!valid} className="btn-accent flex-1 py-[11px] text-sm">Create poll</button>
        </div>
      </motion.form>
    </div>,
    document.body,
  );
}
