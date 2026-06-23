'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Hash, MessageSquare, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor, displayOf, withFileToken } from './Sidebar';
import { useFocusTrap } from '@/lib/useFocusTrap';

const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
const mediaUrl = (u?: string) => (!u ? '' : withFileToken(u.startsWith('http') ? u : api(u)));

function channelLabel(ch: string) {
  if (ch === 'taskis-bot') return { icon: <Bot className="w-[13px] h-[13px]" />, text: 'Taskis Bot' };
  if (ch.startsWith('dm_')) return { icon: <MessageSquare className="w-[13px] h-[13px]" />, text: 'Direct message' };
  return { icon: <Hash className="w-[13px] h-[13px]" />, text: ch };
}

function highlight(text: string, q: string) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase()
    ? <mark key={i} style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: 3 }}>{p}</mark>
    : <span key={i}>{p}</span>));
}

export default function GlobalSearch({ onNavigate }: { onNavigate: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(open, cardRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-search', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-search', onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQ(''); setResults([]); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const s = q.trim();
    if (s.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(api(`/api/chat/search?q=${encodeURIComponent(s)}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((r) => r.json()).then((d) => setResults(Array.isArray(d) ? d : [])).catch(() => setResults([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = (m: any) => {
    try { sessionStorage.setItem('taskis-jump', String(m.id)); } catch { /* ignore */ }
    onNavigate(m.channel);
    setOpen(false);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[560] flex items-start justify-center pt-[12vh] px-4"
          style={{ background: 'rgba(7,7,9,0.55)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            ref={cardRef}
            role="dialog" aria-modal="true" aria-label="Search messages"
            initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="card w-[600px] max-w-full overflow-hidden"
            style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-border">
              <Search className="w-[16px] h-[16px] text-t3 flex-none" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all messages…" className="flex-1 bg-transparent border-0 outline-none py-3.5 text-[15px] text-t1" />
              <span className="text-[11px] text-t3 border border-border rounded px-1.5 py-0.5">esc</span>
            </div>
            <div className="scroll max-h-[56vh] overflow-y-auto py-1.5">
              {loading && <div className="px-4 py-6 text-center text-[13px] text-t3">Searching…</div>}
              {!loading && q.trim().length >= 2 && results.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-t3">No messages match “{q.trim()}”.</div>}
              {!loading && q.trim().length < 2 && <div className="px-4 py-6 text-center text-[13px] text-t3">Type at least 2 characters.</div>}
              {results.map((m) => {
                const lbl = channelLabel(m.channel);
                const src = mediaUrl(m.sender?.avatarUrl);
                return (
                  <button key={m.id} onClick={() => pick(m)} className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-hover transition-colors">
                    <span className="relative w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white overflow-hidden mt-0.5" style={{ background: src ? 'transparent' : toneFor(m.sender?.username || '?') }}>
                      {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(m.sender?.username || '?')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[12px] text-t3 mb-0.5">
                        <span className="font-semibold text-t2">{displayOf(m.sender)}</span>
                        <span className="flex items-center gap-1">{lbl.icon}{lbl.text}</span>
                        <span>· {new Date(m.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[13.5px] text-t1 line-clamp-2">{highlight(m.content, q.trim())}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
