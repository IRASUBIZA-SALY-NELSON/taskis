'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Hash, Newspaper, Bot, Shield, LogOut, Search, Sun, Moon, User as UserIcon, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor, displayOf } from './Sidebar';
import { disconnectWs } from '@/lib/ws';
import { useFocusTrap } from '@/lib/useFocusTrap';

const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
const CHANNELS = ['general', 'intel', 'alerts', 'confidential'];

interface Cmd { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; group: string }

export default function CommandPalette({ user, onNavigate }: { user: any; onNavigate: (c: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [ops, setOps] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, cardRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-command-palette', onOpen); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ(''); setSel(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    fetch(api('/api/chat/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then((d) => Array.isArray(d) && setOps(d.filter((u) => u.username !== user.username && u.username !== 'Taskis Bot'))).catch(() => {});
  }, [open]);

  const go = (c: string) => { onNavigate(c); setOpen(false); };
  const dm = (op: any) => { const ids = [user.id, op.id].sort((a: number, b: number) => a - b); return `dm_${ids[0]}_${ids[1]}`; };
  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle('light') === false;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };
  const logout = () => { disconnectWs(); localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/'); };
  const isAdmin = user.role === 'ADMIN' || user.username?.toLowerCase() === 'nelson';

  const cmds: Cmd[] = useMemo(() => {
    const list: Cmd[] = [
      { id: 'feed', label: 'Feed', hint: 'Posts', icon: <Newspaper className="w-[15px] h-[15px]" />, run: () => go('__posts__'), group: 'Go to' },
      ...CHANNELS.map((c) => ({ id: 'ch-' + c, label: '#' + c, icon: <Hash className="w-[15px] h-[15px]" />, run: () => go(c), group: 'Channels' })),
      { id: 'bot', label: 'Taskis Bot', icon: <Bot className="w-[15px] h-[15px]" />, run: () => go('taskis-bot'), group: 'Channels' },
      ...ops.map((op) => ({
        id: 'dm-' + op.id,
        label: displayOf(op),
        hint: 'Direct message',
        icon: <span className="w-[18px] h-[18px] rounded-full grid place-items-center text-[9px] font-semibold text-white" style={{ background: toneFor(op.username) }}>{initials(op.username)}</span>,
        run: () => go(dm(op)),
        group: 'People',
      })),
      { id: 'theme', label: 'Toggle theme', icon: <span className="relative w-[15px] h-[15px]"><Sun className="w-[15px] h-[15px] absolute dark:opacity-0" /><Moon className="w-[15px] h-[15px] absolute opacity-0" /></span>, run: () => { toggleTheme(); setOpen(false); }, group: 'Actions' },
      ...(isAdmin ? [{ id: 'admin', label: 'Admin panel', icon: <Shield className="w-[15px] h-[15px]" />, run: () => { router.push('/admin'); setOpen(false); }, group: 'Actions' } as Cmd] : []),
      { id: 'logout', label: 'Log out', icon: <LogOut className="w-[15px] h-[15px]" />, run: logout, group: 'Actions' },
    ];
    return list;
  }, [ops, isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cmds;
    return cmds.filter((c) => c.label.toLowerCase().includes(s) || c.hint?.toLowerCase().includes(s));
  }, [q, cmds]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
  };

  // group consecutive items by group label
  let lastGroup = '';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[550] flex items-start justify-center pt-[14vh] px-4"
          style={{ background: 'rgba(7,7,9,0.55)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className="card w-[560px] max-w-full overflow-hidden"
            style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-border">
              <Search className="w-[16px] h-[16px] text-t3 flex-none" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to a channel, person, or action…"
                className="flex-1 bg-transparent border-0 outline-none py-3.5 text-[15px] text-t1"
              />
              <span className="text-[11px] text-t3 border border-border rounded px-1.5 py-0.5">esc</span>
            </div>
            <div ref={listRef} className="scroll max-h-[52vh] overflow-y-auto py-1.5">
              {filtered.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-t3">No matches</div>}
              {filtered.map((c, i) => {
                const showGroup = c.group !== lastGroup;
                lastGroup = c.group;
                return (
                  <React.Fragment key={c.id}>
                    {showGroup && <div className="eyebrow px-4 pt-2.5 pb-1">{c.group}</div>}
                    <button
                      data-i={i}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => c.run()}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                      style={i === sel ? { background: 'var(--hover)' } : undefined}
                    >
                      <span className="flex-none text-t2 grid place-items-center w-[18px]">{c.icon}</span>
                      <span className="flex-1 text-[14px] text-t1">{c.label}</span>
                      {c.hint && <span className="text-[11.5px] text-t3">{c.hint}</span>}
                      {i === sel && <CornerDownLeft className="w-[13px] h-[13px] text-t3" />}
                    </button>
                  </React.Fragment>
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
