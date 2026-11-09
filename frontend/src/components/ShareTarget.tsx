'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Search, X, FileText, Check } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { clearShare, getPendingShare, onShare, uploadShared, type Shared } from '@/lib/share';
import { avatarFor, displayOf } from './Sidebar';

// The sheet that opens when something is shared to Taskis from another app: choose where it goes, then send.

const CHANNELS = ['general', 'intel', 'alerts'];
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface Target { channel: string; label: string; sub?: string; avatar?: string }

export default function ShareTarget({ user }: { user: { id: number; username: string } }) {
  const [shared, setShared] = useState<Shared | null>(null);
  const [people, setPeople] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const closing = useRef(false);

  // Something was shared before the app opened, or while it was already open.
  useEffect(() => {
    getPendingShare().then((s) => { if (s) setShared(s); });
    return onShare((s) => { closing.current = false; setShared(s); setPicked(null); setMessage(''); setError(''); });
  }, []);

  useEffect(() => {
    if (!shared || people.length) return;
    fetch(apiUrl('/api/chat/users'), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((u) => { if (Array.isArray(u)) setPeople(u.filter((p) => p.username !== user.username && p.username !== 'Taskis Bot')); })
      .catch(() => {});
  }, [shared, people.length, user.username]);

  const targets: Target[] = useMemo(() => {
    const dm = (id: number) => `dm_${Math.min(user.id, id)}_${Math.max(user.id, id)}`;
    const all: Target[] = [
      { channel: `dm_${user.id}_${user.id}`, label: 'Notes', sub: 'Just you' },
      ...CHANNELS.map((c) => ({ channel: c, label: c, sub: 'Channel' })),
      ...people.map((p) => ({ channel: dm(p.id), label: displayOf(p), sub: `@${p.username}`, avatar: avatarFor(p) })),
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((t) => t.label.toLowerCase().includes(q) || (t.sub || '').toLowerCase().includes(q)) : all;
  }, [people, query, user.id, user.username]);

  if (!shared) return null;

  const files = shared.files || [];
  const text = (shared.text || '').trim();
  const nothing = !text && files.length === 0; // everything shared was unreadable or too large

  const close = (clear = true) => {
    if (busy) return;
    closing.current = true;
    if (clear) clearShare();
    setShared(null); setPicked(null); setQuery(''); setMessage(''); setError('');
  };

  const send = async () => {
    if (!picked) return;
    setError('');
    try {
      const uploaded: { url: string; type: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        setBusy(files.length > 1 ? `Sending file ${i + 1} of ${files.length}…` : 'Sending…');
        uploaded.push(await uploadShared(files[i], picked));
      }
      setBusy('Sending…');
      const content = text && message.trim() ? `${text}\n${message.trim()}` : text || message.trim();
      const res = await fetch(apiUrl('/api/chat/send'), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          channel: picked,
          content,
          attachmentUrl: uploaded.length === 0 ? null : uploaded.length === 1 ? uploaded[0].url : JSON.stringify(uploaded.map((u) => u.url)),
          attachmentType: uploaded.length === 0 ? null : uploaded.length === 1 ? uploaded[0].type : JSON.stringify(uploaded.map((u) => u.type)),
        }),
      });
      if (!res.ok) throw new Error('The message could not be sent.');
      setBusy('');
      clearShare();
      closing.current = true;
      setShared(null); setPicked(null); setQuery(''); setMessage('');
      window.dispatchEvent(new CustomEvent('open-channel', { detail: picked }));
    } catch (e) {
      setBusy('');
      setError(e instanceof Error ? e.message.replace(/^Upload failed: ?/, '') || 'Something went wrong.' : 'Something went wrong.');
    }
  };

  return (
    <div className="fixed inset-0 z-[620] flex items-end sm:items-center justify-center" style={{ background: 'rgba(7,7,9,0.55)' }} onClick={() => close()}>
      <div className="w-full sm:w-[420px] max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-surface-1 border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Share to Taskis">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="flex-1 text-[16px] font-semibold text-t1">Share to Taskis</div>
          <button onClick={() => close()} className="icon-btn w-8 h-8" aria-label="Cancel"><X className="w-4 h-4" /></button>
        </div>

        {/* what is being shared */}
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-t2">
          {text && <div className="line-clamp-3 break-words text-t1">{text}</div>}
          {files.slice(0, 3).map((f, i) => (
            <div key={i} className="flex items-center gap-2 mt-1 first:mt-0"><FileText className="w-[14px] h-[14px] flex-none text-t3" /><span className="truncate">{f.name}</span></div>
          ))}
          {files.length > 3 && <div className="mt-1 text-t3">+ {files.length - 3} more</div>}
          {shared.skipped && <div className="mt-1 text-[12px]" style={{ color: 'var(--danger, #e5484d)' }}>{nothing ? 'Taskis could not read what you shared. It may be too large (over 500 MB) or the other app did not allow access.' : 'Some files were too large or could not be read.'}</div>}
        </div>

        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
          <Search className="w-[14px] h-[14px] text-t3 flex-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people and channels" className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[16px] sm:text-[14px] text-t1" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll px-2 pb-2">
          {targets.map((t) => (
            <button key={t.channel} onClick={() => setPicked(t.channel)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-hover transition-colors">
              {t.avatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-none bg-surface-3" />
                : <span className="w-9 h-9 rounded-full grid place-items-center flex-none bg-surface-3 text-t2"><Hash className="w-4 h-4" /></span>}
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-medium text-t1 truncate">{t.label}</span>
                {t.sub && <span className="block text-[12px] text-t3 truncate">{t.sub}</span>}
              </span>
              {picked === t.channel && <Check className="w-[18px] h-[18px] flex-none" style={{ color: 'var(--accent-text)' }} />}
            </button>
          ))}
          {!targets.length && <div className="px-3 py-6 text-center text-[13px] text-t3">No match.</div>}
        </div>

        <div className="border-t border-border p-3 flex flex-col gap-2">
          {error && <div className="text-[12.5px]" style={{ color: 'var(--danger, #e5484d)' }}>{error}</div>}
          <div className="flex items-center gap-2">
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={text ? 'Add a note…' : 'Add a message…'} disabled={!!busy}
              className="flex-1 min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-2.5 outline-none text-[16px] sm:text-[14px] text-t1" />
            <button onClick={send} disabled={!picked || !!busy || nothing} className="btn-accent px-4 py-2.5 text-sm" style={{ opacity: !picked || busy || nothing ? 0.55 : 1 }}>{busy || 'Send'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
