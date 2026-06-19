'use client';

import React from 'react';
import { Hash, Lock, Shield, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import SettingsMenu from './SettingsMenu';
import { disconnectWs } from '@/lib/ws';

interface SidebarProps {
  user: any;
  activeChannel: string;
  setActiveChannel: (c: string) => void;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
}

const AVATAR_TONES = ['#5a4a38', '#4a463f', '#574a3e', '#454039', '#5c5044', '#403c37'];

export function initials(name: string) {
  return (name || '?').charAt(0).toUpperCase();
}

export function toneFor(name: string) {
  let sum = 0;
  for (let i = 0; i < (name || '').length; i++) sum += name.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

function presenceColor(status: string) {
  if (status === 'ACTIVE') return 'var(--online)';
  if (status === 'AWAY') return 'var(--away)';
  return 'var(--t3)';
}

export default function Sidebar({ user, activeChannel, setActiveChannel, isOpen, setIsOpen }: SidebarProps) {
  const router = useRouter();
  const channels = ['general', 'intel', 'alerts', 'confidential'];
  const [operatives, setOperatives] = React.useState<any[]>([]);
  const [unread, setUnread] = React.useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const api = (p: string) => `http://${window.location.hostname}:8080${p}`;

  React.useEffect(() => {
    if (activeChannel) {
      const lastReadStr = localStorage.getItem('lastRead');
      const lastRead = lastReadStr ? JSON.parse(lastReadStr) : {};
      lastRead[activeChannel] = Date.now();
      localStorage.setItem('lastRead', JSON.stringify(lastRead));
    }

    const fetchData = () => {
      fetch(api('/api/chat/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((res) => { if (!res.ok) throw new Error('Not OK'); return res.json(); })
        .then((data) => {
          if (Array.isArray(data)) setOperatives(data.filter((u) => u.username !== user.username && u.username !== 'Taskis Bot'));
        })
        .catch(console.error);

      fetch(api('/api/chat/channels/latest'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((res) => { if (!res.ok) throw new Error('Not OK'); return res.json(); })
        .then((data) => {
          const lastReadStr = localStorage.getItem('lastRead');
          const lastRead = lastReadStr ? JSON.parse(lastReadStr) : {};
          const newUnread: Record<string, boolean> = {};
          for (const ch in data) {
            const latestDate = new Date(data[ch]).getTime();
            const readDate = lastRead[ch] || 0;
            if (latestDate > readDate && ch !== activeChannel) newUnread[ch] = true;
          }
          setUnread(newUnread);
        })
        .catch(console.error);
    };
    fetchData();
    const int = setInterval(fetchData, 5000);
    return () => clearInterval(int);
  }, [user.username, activeChannel]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploadRes = await fetch(api('/api/chat/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed: ' + uploadRes.status);
      const uploadData = await uploadRes.json();
      const res = await fetch(api('/api/chat/avatar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ avatarUrl: uploadData.url }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      } else {
        alert(await res.text());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    disconnectWs();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const getDmChannel = (otherId: number) => {
    const ids = [user.id, otherId].sort();
    return `dm_${ids[0]}_${ids[1]}`;
  };

  const avatarSrc = (u: any) =>
    u.avatarUrl ? (u.avatarUrl.startsWith('http') ? u.avatarUrl : api(u.avatarUrl)) : null;

  if (!isOpen) return null;

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="eyebrow px-[9px] pt-4 pb-[5px]" style={{ letterSpacing: '0.08em' }}>{children}</div>
  );

  const itemCls = (active: boolean) =>
    `flex items-center gap-[9px] w-full text-left rounded-lg px-[9px] py-[7px] cursor-pointer transition-colors ${
      active ? 'bg-accent-soft text-t1' : 'text-t2 hover:bg-hover hover:text-t1'
    }`;

  return (
    <aside className="w-[264px] flex-none flex flex-col h-screen bg-surface border-r border-border">
      {/* header */}
      <div className="flex items-center gap-[9px] px-4 pt-4 pb-[13px] border-b border-border">
        <span className="tk-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
          <i style={{ width: 6, height: 6 }} />
          <b style={{ width: 2, height: 4 }} />
        </span>
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em] text-t1">Taskis</span>
        <Lock className="w-[11px] h-[11px] text-t3" />
      </div>

      {/* lists */}
      <div className="scroll flex-1 overflow-y-auto px-2 py-2.5">
        <SectionLabel>Channels</SectionLabel>
        {channels.map((c) => {
          const active = activeChannel === c;
          const locked = c === 'confidential';
          return (
            <button key={c} onClick={() => setActiveChannel(c)} className={itemCls(active)}>
              <span className="w-3.5 text-center text-[15px] flex-none" style={{ color: active ? 'var(--accent-text)' : 'var(--t3)' }}>#</span>
              <span className="flex-1 text-sm font-medium">{c.charAt(0).toUpperCase() + c.slice(1)}</span>
              {locked && <Lock className="w-[13px] h-[13px] text-t3" />}
              {unread[c] && <span className="bg-accent text-on-accent text-[11px] font-semibold min-w-[8px] px-1.5 py-px rounded-full">●</span>}
            </button>
          );
        })}

        <SectionLabel>Bots</SectionLabel>
        <button onClick={() => setActiveChannel('taskis-bot')} className={itemCls(activeChannel === 'taskis-bot')}>
          <span className="w-[22px] h-[22px] rounded-md bg-accent-soft text-accent-text text-[11px] font-bold grid place-items-center flex-none">TB</span>
          <span className="flex-1 text-sm font-medium">Taskis Bot</span>
          {unread['taskis-bot'] && <span className="bg-accent text-on-accent text-[11px] font-semibold px-1.5 py-px rounded-full">●</span>}
        </button>

        <SectionLabel>Operatives</SectionLabel>
        {operatives.map((op) => {
          const channelId = getDmChannel(op.id);
          const active = activeChannel === channelId;
          const src = avatarSrc(op);
          return (
            <button key={op.id} onClick={() => setActiveChannel(channelId)} className={itemCls(active)}>
              <span className="relative w-[25px] h-[25px] rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white" style={{ background: src ? 'transparent' : toneFor(op.username) }}>
                {src ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" /> : initials(op.username)}
                <span className="absolute -right-px -bottom-px w-[9px] h-[9px] rounded-full" style={{ background: presenceColor(op.status), border: '2px solid var(--surface-1)' }} />
              </span>
              <span className="flex-1 text-sm font-medium truncate">{op.username}</span>
              {unread[channelId] && <span className="bg-accent text-on-accent text-[11px] font-semibold px-1.5 py-px rounded-full">New</span>}
            </button>
          );
        })}
      </div>

      {/* user card */}
      <div className="border-t border-border px-3 py-[11px]">
        <div className="flex items-center gap-2.5">
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Change profile picture"
            className="relative w-8 h-8 rounded-full grid place-items-center flex-none text-xs font-semibold text-white hover:opacity-80 transition-opacity"
            style={{ background: avatarSrc(user) ? 'transparent' : toneFor(user.username) }}
          >
            {avatarSrc(user) ? <img src={avatarSrc(user)!} alt="" className="w-full h-full rounded-full object-cover" /> : initials(user.username)}
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-t1 truncate">{user.username}</div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-t3">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--online)' }} />
              Online
            </div>
          </div>
          <SettingsMenu />
          <ThemeToggle />
        </div>
        <div className="flex gap-1.5 mt-2.5">
          {(user.role === 'ADMIN' || user.username.toLowerCase() === 'nelson') && (
            <button onClick={() => router.push('/admin')} className="btn-secondary flex-1 py-[7px] text-[12.5px]">
              <Shield className="w-[13px] h-[13px]" /> Admin
            </button>
          )}
          <button onClick={handleLogout} className="btn-secondary flex-1 py-[7px] text-[12.5px]">
            <LogOut className="w-[13px] h-[13px]" /> Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
