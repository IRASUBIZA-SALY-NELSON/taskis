'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Link2, Users, Lock, Check, ShieldCheck, ChevronDown, UserPlus } from 'lucide-react';
import { initials, toneFor, displayOf } from './Sidebar';
import { useToast } from './Toast';
import { copyToClipboard } from '@/lib/clipboard';

type Access = 'Can view' | 'Can edit';

const api = (p: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${p}`;
const avatarSrc = (u: any) => (u?.avatarUrl ? (u.avatarUrl.startsWith('http') ? u.avatarUrl : api(u.avatarUrl)) : null);

function AccessSelect({ value, onChange, small }: { value: string; onChange: (v: Access) => void; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const opts: Access[] = ['Can view', 'Can edit'];
  return (
    <div className="relative" data-share-menu>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`flex items-center gap-1 rounded-lg text-t2 hover:text-t1 hover:bg-hover transition-colors ${small ? 'px-1.5 py-1 text-[12.5px]' : 'px-2.5 py-2 text-[13px] border-l border-border'}`}
      >
        {value}<ChevronDown className="w-[13px] h-[13px]" />
      </button>
      {open && (
        <div className="card tk-pop absolute right-0 top-full mt-1.5 w-[150px] py-1 z-10" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
          {opts.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-t1 hover:bg-hover transition-colors">
              {o}{o === value && <Check className="w-[14px] h-[14px] text-accent-text" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShareModal({
  user, channel, title, members, onClose,
}: { user: any; channel: string; title: string; members: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [inviteAccess, setInviteAccess] = useState<Access>('Can view');
  const [linkOpen, setLinkOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/chat?c=${encodeURIComponent(channel)}` : '';

  // People with access: everyone in the workspace for a channel; you are the owner.
  const [people, setPeople] = useState<{ u: any; role: string }[]>([]);
  useEffect(() => {
    const others = (members || []).filter((m) => m.username !== user.username && m.username !== 'Taskis Bot');
    setPeople([
      { u: user, role: 'owner' },
      ...others.slice(0, 8).map((u) => ({ u, role: 'Can edit' })),
    ]);
  }, [members, user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return;
    copyToClipboard(`${shareUrl}`);
    toast(`Invite link for ${v} copied — share it to grant ${inviteAccess.toLowerCase()} access`, 'success');
    setEmail('');
  };

  const copyLink = async () => {
    if (await copyToClipboard(shareUrl)) { setCopied(true); setTimeout(() => setCopied(false), 1600); toast('Link copied', 'success'); }
    else toast('Could not copy link', 'error');
  };

  const remove = (username: string) => {
    setPeople((prev) => prev.filter((p) => p.u.username !== username));
    toast('Access removed', 'info');
  };

  const invitedCount = useMemo(() => people.length, [people]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[440] flex items-center justify-center p-6 tk-fade" style={{ background: 'rgba(7,7,9,0.55)', backdropFilter: 'blur(3px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-[480px] max-w-full overflow-hidden"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {/* header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-semibold text-t1 tracking-tight">Share {title}</h2>
            <p className="text-[13px] text-t2 mt-0.5">Invite teammates or share an access link</p>
          </div>
          <button onClick={onClose} className="icon-btn w-8 h-8 flex-none" aria-label="Close"><X className="w-[15px] h-[15px]" /></button>
        </div>

        {/* invite row */}
        <form onSubmit={invite} className="px-6">
          <div className="flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 pl-3 pr-1.5 py-1.5 focus-within:border-accent transition-colors">
            <UserPlus className="w-[15px] h-[15px] text-t3 flex-none" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email, name…" className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px] text-t1 py-1" />
            <AccessSelect value={inviteAccess} onChange={setInviteAccess} />
            <button type="submit" className="btn-accent px-4 py-2 text-[13px]">Invite</button>
          </div>
        </form>

        {/* general access */}
        <div className="px-6 pt-5">
          <div className="eyebrow mb-2.5">General access</div>
          <button onClick={() => setLinkOpen(false)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hover transition-colors text-left">
            <span className="w-9 h-9 rounded-xl bg-surface-2 border border-border grid place-items-center flex-none text-t2"><Users className="w-[17px] h-[17px]" /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-t1">Only those invited</div>
              <div className="text-[12px] text-t3">{invitedCount} {invitedCount === 1 ? 'person' : 'people'} with access</div>
            </div>
            {!linkOpen && <Check className="w-[16px] h-[16px] text-accent-text" />}
          </button>
          <button onClick={() => setLinkOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hover transition-colors text-left">
            <span className="w-9 h-9 rounded-xl bg-surface-2 border border-border grid place-items-center flex-none text-t2"><Link2 className="w-[17px] h-[17px]" /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-t1">Link access</div>
              <div className="text-[12px] text-t3">Anyone with the link can open</div>
            </div>
            {linkOpen && <Check className="w-[16px] h-[16px] text-accent-text" />}
          </button>
        </div>

        {/* people with access */}
        <div className="px-6 pt-4">
          <div className="eyebrow mb-1">People with access</div>
          <div className="max-h-[230px] overflow-y-auto scroll -mx-1 px-1">
            {people.map(({ u, role }) => {
              const src = avatarSrc(u);
              const me = u.username === user.username;
              return (
                <div key={u.username} className="group flex items-center gap-3 py-2">
                  <span className="relative w-9 h-9 rounded-full grid place-items-center flex-none text-[12px] font-semibold text-white overflow-hidden" style={{ background: src ? 'transparent' : toneFor(u.username) }}>
                    {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(u.username)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-t1 truncate">{displayOf(u)}{me && <span className="text-t3 font-normal"> (you)</span>}</div>
                    <div className="text-[12px] text-t3 truncate">{u.email || `${u.username}@taskis`}</div>
                  </div>
                  {role === 'owner' ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] text-t2 font-medium pr-1"><ShieldCheck className="w-[14px] h-[14px] text-online" />owner</span>
                  ) : (
                    <>
                      <span className="text-[12.5px] text-t2">{role}</span>
                      <button onClick={() => remove(u.username)} className="text-[12.5px] font-medium text-danger opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-md hover:bg-danger-soft">remove</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* copy link */}
        <div className="px-6 pb-6 pt-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface-2 border border-border pl-3 pr-1.5 py-1.5">
            <Lock className="w-[13px] h-[13px] text-t3 flex-none" />
            <span className="flex-1 min-w-0 truncate text-[12.5px] text-t2">{shareUrl}</span>
            <button onClick={copyLink} className="btn-accent px-3 py-2 text-[12.5px] flex-none">
              {copied ? <Check className="w-[14px] h-[14px]" /> : <Link2 className="w-[14px] h-[14px]" />}{copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
