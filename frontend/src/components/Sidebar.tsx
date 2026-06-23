'use client';

import React from 'react';
import { Hash, Lock, Shield, LogOut, Newspaper, Search, Radar, Megaphone, Bot, Users, Star, StickyNote, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import SettingsMenu from './SettingsMenu';
import { disconnectWs } from '@/lib/ws';
import { markFeature, FEATURES, getDone, onFeatureChange } from '@/lib/features';

export function displayOf(u: any) {
  return (u?.displayName && u.displayName.trim()) || u?.username || '?';
}

interface SidebarProps {
  user: any;
  activeChannel: string;
  setActiveChannel: (c: string) => void;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
}

const AVATAR_TONES = ['#3068f5', '#2f9e54', '#8b5cf6', '#e8833a', '#0ea5a4', '#e0558c'];

export function initials(name: string) {
  return (name || '?').charAt(0).toUpperCase();
}

export function toneFor(name: string) {
  let sum = 0;
  for (let i = 0; i < (name || '').length; i++) sum += name.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

/** A status ring drawn around an avatar — a user's chosen color, or gold for admins. */
export function ringFor(u: any): string | undefined {
  const c = typeof u?.ringColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(u.ringColor) ? u.ringColor : null;
  if (c) return `0 0 0 2px var(--surface-1), 0 0 0 3.5px ${c}`;
  if (u?.role === 'ADMIN') return '0 0 0 2px var(--surface-1), 0 0 0 3.5px #d9930a';
  return undefined;
}

/** A generated default profile picture for anyone without an uploaded avatar. */
export function defaultAvatarUrl(name: string) {
  return `https://api.dicebear.com/7.x/thumbs/svg?radius=50&backgroundType=gradientLinear&seed=${encodeURIComponent(name || 'taskis')}`;
}

/** Append the file passphrase to a protected /api/files URL so <img>/<iframe>/fetch can load it. */
export function withFileToken(url: string): string {
  if (!url || !url.includes('/api/files/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'passphrase=onedayyouwilldie';
}

/** Resolve a user's avatar URL, falling back to a generated default profile. */
export function avatarFor(u: any) {
  const raw = u?.avatarUrl;
  if (raw) return withFileToken(raw.startsWith('http') ? raw : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${raw}`);
  return defaultAvatarUrl(u?.username || '?');
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
  const [favs, setFavs] = React.useState<string[]>([]);

  const [newCount, setNewCount] = React.useState(0);

  React.useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('taskis-fav-channels') || '[]')); } catch { /* noop */ }
    const recompute = () => setNewCount(FEATURES.filter((f) => !getDone().has(f.key)).length);
    recompute();
    return onFeatureChange(recompute);
  }, []);

  const selfNotes = `dm_${user.id}_${user.id}`;
  const toggleFav = (c: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markFeature('favorites');
    setFavs((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      try { localStorage.setItem('taskis-fav-channels', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

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
    u.avatarUrl ? withFileToken(u.avatarUrl.startsWith('http') ? u.avatarUrl : api(u.avatarUrl)) : defaultAvatarUrl(u.username);

  const select = (c: string) => {
    setActiveChannel(c);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsOpen(false);
  };

  const SectionLabel = ({ icon: Ic, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
    <div className="eyebrow flex items-center gap-1.5 px-[9px] pt-4 pb-[5px]" style={{ letterSpacing: '0.08em' }}>
      {Ic && <Ic className="w-[12px] h-[12px]" />}{children}
    </div>
  );

  const channelIcon: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    general: Hash, intel: Radar, alerts: Megaphone, confidential: Lock,
  };

  const itemCls = (active: boolean) =>
    `flex items-center gap-[10px] w-full text-left rounded-[10px] px-[10px] py-[7px] cursor-pointer transition-all ${
      active
        ? 'bg-surface border border-border text-t1 shadow-[var(--shadow-sm)]'
        : 'text-t2 border border-transparent hover:bg-hover hover:text-t1'
    }`;

  const renderChannel = (c: string) => {
    const active = activeChannel === c;
    const locked = c === 'confidential';
    const fav = favs.includes(c);
    const Ic = channelIcon[c] || Hash;
    return (
      <div key={c} onClick={() => select(c)} className={`group ${itemCls(active)}`}>
        <Ic className="w-[15px] h-[15px] flex-none" style={{ color: active ? 'var(--t1)' : 'var(--t3)' }} />
        <span className="flex-1 text-sm font-medium">{c.charAt(0).toUpperCase() + c.slice(1)}</span>
        {locked && <Lock className="w-[12px] h-[12px] text-t3" />}
        {unread[c] && <span className="w-[7px] h-[7px] rounded-full bg-accent" />}
        <span
          role="button"
          tabIndex={0}
          aria-label={fav ? 'Unfavorite' : 'Favorite'}
          onClick={(e) => toggleFav(c, e)}
          className={`grid place-items-center w-5 h-5 rounded-md transition-opacity ${fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <Star className="w-[13px] h-[13px]" style={{ color: fav ? 'var(--away)' : 'var(--t3)', fill: fav ? 'var(--away)' : 'transparent' }} />
        </span>
      </div>
    );
  };

  return (
    <>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" aria-hidden />}
      <aside className={`w-[264px] flex-none flex flex-col h-full bg-surface border-r border-border fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}`}>
      {/* header */}
      <div className="flex items-center gap-[9px] px-4 pt-4 pb-[13px] border-b border-border">
        <span className="tk-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
          <i style={{ width: 6, height: 6 }} />
          <b style={{ width: 2, height: 4 }} />
        </span>
        <span className="serif flex-1 text-[17px] font-semibold text-t1">Taskis</span>
        <Lock className="w-[11px] h-[11px] text-t3" />
      </div>

      {/* quick search */}
      <div className="px-2 pt-2.5">
        <button
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="w-full flex items-center gap-2 rounded-lg px-[9px] py-2 text-sm text-t3 bg-surface-2 border border-border hover:border-border-strong hover:text-t2 transition-colors"
        >
          <Search className="w-[14px] h-[14px]" />
          <span className="flex-1 text-left">Search…</span>
          <span className="text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</span>
        </button>
      </div>

      {/* lists */}
      <div className="scroll flex-1 overflow-y-auto px-2 pt-1.5 pb-2.5">
        <button onClick={() => select('__posts__')} className={itemCls(activeChannel === '__posts__')}>
          <Newspaper className="w-[15px] h-[15px] flex-none" style={{ color: activeChannel === '__posts__' ? 'var(--t1)' : 'var(--t3)' }} />
          <span className="flex-1 text-sm font-medium">Feed</span>
        </button>
        <button onClick={() => select(selfNotes)} className={itemCls(activeChannel === selfNotes)}>
          <StickyNote className="w-[15px] h-[15px] flex-none" style={{ color: activeChannel === selfNotes ? 'var(--t1)' : 'var(--t3)' }} />
          <span className="flex-1 text-sm font-medium">Notes</span>
          <span className="text-[10.5px] text-t3">you</span>
        </button>
        <button onClick={() => window.dispatchEvent(new Event('open-whats-new'))} className={itemCls(false)}>
          <Sparkles className="w-[15px] h-[15px] flex-none text-t3" />
          <span className="flex-1 text-sm font-medium">What’s new</span>
          {newCount > 0 && <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-on-accent text-[10.5px] font-bold">{newCount}</span>}
        </button>

        {favs.length > 0 && (
          <>
            <SectionLabel icon={Star}>Favorites</SectionLabel>
            {channels.filter((c) => favs.includes(c)).map((c) => renderChannel(c))}
          </>
        )}

        <SectionLabel icon={Hash}>Channels</SectionLabel>
        {channels.filter((c) => !favs.includes(c)).map((c) => renderChannel(c))}

        <SectionLabel icon={Bot}>Bots</SectionLabel>
        <button onClick={() => select('taskis-bot')} className={itemCls(activeChannel === 'taskis-bot')}>
          <span className="w-[22px] h-[22px] rounded-md bg-accent-soft text-accent-text text-[11px] font-bold grid place-items-center flex-none">TB</span>
          <span className="flex-1 text-sm font-medium">Taskis Bot</span>
          {unread['taskis-bot'] && <span className="bg-accent text-on-accent text-[11px] font-semibold px-1.5 py-px rounded-full">●</span>}
        </button>

        <SectionLabel icon={Users}>Operatives</SectionLabel>
        {operatives.map((op) => {
          const channelId = getDmChannel(op.id);
          const active = activeChannel === channelId;
          const src = avatarSrc(op);
          return (
            <button key={op.id} onClick={() => select(channelId)} className={itemCls(active)}>
              <span className="relative overflow-hidden w-[25px] h-[25px] rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white" style={{ background: src ? 'transparent' : toneFor(op.username), boxShadow: ringFor(op) }}>
                {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(op.username)}
                <span className="absolute -right-px -bottom-px w-[9px] h-[9px] rounded-full z-10" style={{ background: presenceColor(op.status), border: '2px solid var(--surface-1)' }} />
              </span>
              <span className="flex-1 text-sm font-medium truncate">{displayOf(op)}</span>
              {unread[channelId] && <span className="bg-accent text-on-accent text-[11px] font-semibold px-1.5 py-px rounded-full">New</span>}
            </button>
          );
        })}
      </div>

      {/* user card */}
      <div className="border-t border-border px-3 py-[11px]">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => select('__me__')}
            title="Your profile"
            className="relative overflow-hidden w-8 h-8 rounded-full grid place-items-center flex-none text-xs font-semibold text-white hover:opacity-80 transition-opacity"
            style={{ background: avatarSrc(user) ? 'transparent' : toneFor(user.username), boxShadow: ringFor(user) }}
          >
            {avatarSrc(user) ? <img src={avatarSrc(user)!} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(user.username)}
          </button>
          <button onClick={() => select('__me__')} className="flex-1 min-w-0 text-left">
            <div className="text-[13.5px] font-semibold text-t1 truncate">{displayOf(user)}</div>
            {user.customStatus ? (
              <div className="text-[12px] text-t2 truncate">{user.customStatus}</div>
            ) : (
              <span className="tk-chip mt-0.5" style={{ background: 'color-mix(in srgb, var(--online) 16%, transparent)', color: 'var(--online)' }}>
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: 'var(--online)' }} />
                Online
              </span>
            )}
          </button>
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
    </>
  );
}
