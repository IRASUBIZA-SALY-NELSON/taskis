'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initials, toneFor, displayOf, defaultAvatarUrl } from './Sidebar';

const api = (p: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${p}`;
const mediaUrl = (u?: string) => (!u ? '' : u.startsWith('http') ? u : api(u));

function presence(status?: string) {
  if (status === 'ACTIVE') return { c: 'var(--online)', label: 'Online' };
  if (status === 'AWAY') return { c: 'var(--away)', label: 'Away' };
  return { c: 'var(--t3)', label: 'Offline' };
}

export default function HoverCard({ user, children, className }: { user: any; children: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const above = r.top > 220;
      setPos({ x: Math.min(r.left, window.innerWidth - 260), y: above ? r.top : r.bottom, above });
    }, 350);
  };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setPos(null); };

  const src = user?.avatarUrl ? mediaUrl(user.avatarUrl) : defaultAvatarUrl(user?.username || '?');
  const p = presence(user?.status);

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className={className}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); }}
          onMouseLeave={hide}
          className="card tk-pop fixed z-[560] w-[240px] p-4"
          style={{ left: pos.x, top: pos.above ? undefined : pos.y + 8, bottom: pos.above ? window.innerHeight - pos.y + 8 : undefined, boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
        >
          <div className="flex items-center gap-3">
            <span className="relative w-12 h-12 rounded-full grid place-items-center flex-none text-white font-semibold overflow-hidden" style={{ background: src ? 'transparent' : toneFor(user?.username || '?'), fontSize: 18 }}>
              {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(user?.username || '?')}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-t1 truncate">{displayOf(user)}</div>
              <div className="text-[12.5px] text-t3 truncate">@{user?.username}</div>
            </div>
          </div>
          {user?.bio && <p className="text-[13px] text-t2 leading-relaxed mt-3">{user.bio}</p>}
          <div className="flex items-center gap-1.5 mt-3 text-[12px] text-t2">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: p.c }} />{p.label}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
