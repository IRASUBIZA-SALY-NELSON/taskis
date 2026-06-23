'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, MessageSquare, Pencil, Shield, Check, Heart, MessageCircle, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { initials, toneFor, displayOf, avatarFor, ringFor, withFileToken } from './Sidebar';
import ProfileModal from './ProfileModal';
import { FONT_OPTIONS, getFontId, applyFont } from '@/lib/prefs';
import { getNotifyPrefs, setNotifyPrefs, getDnd, setDnd, requestNotificationPermission, notificationsEnabled } from '@/lib/notify';
import { getThemeMode, applyThemeMode, type ThemeMode } from '@/lib/theme';
import { ACCENTS, getAccent, applyAccent } from '@/lib/accent';
import { markFeature } from '@/lib/features';

const api = (p: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${p}`;
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const fullMedia = (u?: string) => (!u ? '' : withFileToken(u.startsWith('http') ? u : api(u)));

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative w-[34px] h-[20px] rounded-full transition-colors flex-none" style={{ background: on ? 'var(--accent)' : 'var(--surface-3)' }} aria-pressed={on}>
      <span className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all" style={{ left: on ? 16 : 2 }} />
    </button>
  );
}

function presence(status?: string) {
  if (status === 'ACTIVE') return { c: 'var(--online)', label: 'Active now' };
  if (status === 'AWAY') return { c: 'var(--away)', label: 'Away' };
  return { c: 'var(--t3)', label: 'Offline' };
}

export default function ProfilePage({ me, username, onNavigate, onBack, onToggleSidebar }: { me: any; username: string; onNavigate: (c: string) => void; onBack?: () => void; onToggleSidebar: () => void }) {
  const router = useRouter();
  const isSelf = username === me.username;
  const [profile, setProfile] = useState<any>(isSelf ? me : null);
  const [posts, setPosts] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);

  // settings (self only)
  const [fontId, setFontId] = useState('geist');
  const [prefs, setPrefs] = useState({ sound: true, desktop: true });
  const [granted, setGranted] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState('blue');
  const [dnd, setDndState] = useState<{ on: boolean; from: number | null; to: number | null }>({ on: false, from: null, to: null });

  useEffect(() => {
    fetch(api('/api/chat/users'), { headers: authH() })
      .then((r) => r.json())
      .then((list) => { if (Array.isArray(list)) { const u = list.find((x: any) => x.username === username); if (u) setProfile(u); } })
      .catch(() => {});
    fetch(api(`/api/posts/by/${encodeURIComponent(username)}`), { headers: authH() })
      .then((r) => r.json()).then((d) => Array.isArray(d) && setPosts(d)).catch(() => {});
  }, [username]);

  useEffect(() => { if (isSelf) markFeature('profile'); }, [isSelf]);

  useEffect(() => {
    if (!isSelf) return;
    setFontId(getFontId()); setPrefs(getNotifyPrefs()); setGranted(notificationsEnabled());
    setTheme(getThemeMode()); setAccent(getAccent()); setDndState(getDnd());
  }, [isSelf, editing]);

  const u = profile || { username };
  const p = presence(u.status);
  const src = avatarFor(u);
  const updatePrefs = (x: Partial<{ sound: boolean; desktop: boolean }>) => { setNotifyPrefs(x); setPrefs((s) => ({ ...s, ...x })); };
  const updateDnd = (d: Partial<{ on: boolean; from: number | null; to: number | null }>) => { setDnd(d); setDndState((s) => ({ ...s, ...d })); };
  const toTime = (m: number | null) => (m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  const fromTime = (s: string): number | null => { if (!s) return null; const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };

  const messageThem = () => {
    if (!u.id) return;
    const ids = [me.id, u.id].sort((a: number, b: number) => a - b);
    onNavigate(`dm_${ids[0]}_${ids[1]}`);
  };

  return (
    <div className="scroll h-full overflow-y-auto bg-bg">
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border sticky top-0 z-10" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(8px)' }}>
        {onBack ? (
          <button onClick={onBack} className="icon-btn w-8 h-8" aria-label="Back"><ArrowLeft className="w-[15px] h-[15px]" /></button>
        ) : (
          <button onClick={onToggleSidebar} className="icon-btn w-8 h-8" aria-label="Toggle sidebar"><Menu className="w-[15px] h-[15px]" /></button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold text-t1 leading-tight truncate">{isSelf ? 'Your profile' : displayOf(u)}</div>
          <div className="text-xs text-t2">{isSelf ? 'Manage your profile & settings' : `@${u.username}`}</div>
        </div>
      </header>

      <div className="max-w-[680px] mx-auto px-5 py-7 flex flex-col gap-5">
        {/* identity card */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <span className="relative w-[76px] h-[76px] rounded-full grid place-items-center flex-none text-2xl font-semibold text-white overflow-hidden" style={{ background: 'transparent', boxShadow: ringFor(u) }}>
              <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </span>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-semibold text-t1 tracking-tight">{displayOf(u)}</h1>
                {u.role === 'ADMIN' && <span className="text-[10.5px] font-semibold text-accent-text bg-accent-soft rounded-full px-2 py-0.5 flex items-center gap-1"><Shield className="w-[11px] h-[11px]" />Admin</span>}
              </div>
              <div className="text-[13.5px] text-t3">@{u.username}</div>
              {u.customStatus && <div className="text-[13.5px] text-t1 mt-2">{u.customStatus}</div>}
              <div className="flex items-center gap-1.5 text-[12.5px] text-t2 mt-2"><span className="w-[7px] h-[7px] rounded-full" style={{ background: p.c }} />{p.label}</div>
              {u.bio && <p className="text-[13.5px] text-t2 leading-relaxed mt-3">{u.bio}</p>}
            </div>
          </div>
          <div className="flex gap-2.5 mt-5">
            {isSelf ? (
              <>
                <button onClick={() => setEditing(true)} className="btn-accent px-4 py-2.5 text-sm"><Pencil className="w-[14px] h-[14px]" />Edit profile</button>
                {(me.role === 'ADMIN' || me.username?.toLowerCase() === 'nelson') && (
                  <button onClick={() => router.push('/admin')} className="btn-secondary px-4 py-2.5 text-sm"><Shield className="w-[14px] h-[14px]" />Admin</button>
                )}
              </>
            ) : (
              <button onClick={messageThem} className="btn-accent px-4 py-2.5 text-sm"><MessageSquare className="w-[14px] h-[14px]" />Message</button>
            )}
          </div>
        </div>

        {/* settings (self only) */}
        {isSelf && (
          <div className="card p-6">
            <h2 className="text-[15px] font-semibold text-t1 mb-4">Settings</h2>

            <div className="eyebrow mb-2">Theme</div>
            <div className="flex gap-1 p-0.5 rounded-lg bg-surface-2 border border-border mb-4 max-w-[280px]">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <button key={m} onClick={() => { applyThemeMode(m); setTheme(m); }} className="flex-1 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors" style={theme === m ? { background: 'var(--surface-1)', color: 'var(--t1)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--t3)' }}>{m}</button>
              ))}
            </div>

            <div className="eyebrow mb-2">Accent</div>
            <div className="flex items-center gap-2 mb-4">
              {ACCENTS.map((a) => (
                <button key={a.id} onClick={() => { applyAccent(a.id); setAccent(a.id); }} title={a.label} className="w-7 h-7 rounded-full grid place-items-center transition-transform hover:scale-110" style={{ background: a.hex, boxShadow: accent === a.id ? '0 0 0 2px var(--surface-1), 0 0 0 4px var(--t2)' : 'var(--edge-hi)' }}>
                  {accent === a.id && <Check className="w-[12px] h-[12px] text-white" />}
                </button>
              ))}
            </div>

            <div className="eyebrow mb-2">Font</div>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {FONT_OPTIONS.map((f) => (
                <button key={f.id} onClick={() => { applyFont(f.id); setFontId(f.id); }} className="px-3 py-1.5 rounded-lg border text-[13px] transition-colors" style={{ fontFamily: f.stack, borderColor: fontId === f.id ? 'var(--accent-line)' : 'var(--border)', color: fontId === f.id ? 'var(--accent-text)' : 'var(--t2)', background: fontId === f.id ? 'var(--accent-soft)' : 'transparent' }}>{f.label}</button>
              ))}
            </div>

            <div className="h-px bg-border my-1" />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13.5px] text-t1">Desktop alerts</span>
              {granted ? <Toggle on={prefs.desktop} onClick={() => updatePrefs({ desktop: !prefs.desktop })} /> : <button onClick={async () => { const ok = await requestNotificationPermission(); setGranted(ok); if (ok) updatePrefs({ desktop: true }); }} className="text-[12.5px] font-medium text-accent-text hover:underline">Enable</button>}
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13.5px] text-t1">Sound</span>
              <Toggle on={prefs.sound} onClick={() => updatePrefs({ sound: !prefs.sound })} />
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13.5px] text-t1">Do Not Disturb</span>
              <Toggle on={dnd.on} onClick={() => updateDnd({ on: !dnd.on })} />
            </div>
            <div className="flex items-center justify-between py-2.5 gap-2">
              <span className="text-[13px] text-t2">Quiet hours</span>
              <div className="flex items-center gap-1.5">
                <input type="time" value={toTime(dnd.from)} onChange={(e) => updateDnd({ from: fromTime(e.target.value) })} className="tk-input" style={{ padding: '4px 8px', width: 96, fontSize: 12 }} />
                <span className="text-t3 text-xs">–</span>
                <input type="time" value={toTime(dnd.to)} onChange={(e) => updateDnd({ to: fromTime(e.target.value) })} className="tk-input" style={{ padding: '4px 8px', width: 96, fontSize: 12 }} />
              </div>
            </div>
          </div>
        )}

        {/* posts */}
        <div className="card p-6">
          <h2 className="text-[15px] font-semibold text-t1 mb-3">{isSelf ? 'Your posts' : 'Posts'} <span className="text-t3 font-normal">· last 24h</span></h2>
          {posts.length === 0 ? (
            <div className="py-8 text-center text-[13.5px] text-t3">No posts in the last 24 hours.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {posts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-border overflow-hidden bg-surface-2">
                  {post.imageUrl && <img src={fullMedia(post.imageUrl)} alt="" className="w-full max-h-[180px] object-cover" />}
                  {post.caption && <div className="px-3 py-2.5 text-[13px] text-t1 leading-relaxed line-clamp-3">{post.caption}</div>}
                  <div className="flex items-center gap-3 px-3 py-2 text-[12px] text-t3 border-t border-border">
                    {!post.imageUrl && !post.caption && <ImageIcon className="w-[13px] h-[13px]" />}
                    <span className="flex items-center gap-1"><Heart className="w-[13px] h-[13px]" />{post.likeCount || 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-[13px] h-[13px]" />{post.commentCount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && <ProfileModal user={u} onClose={() => setEditing(false)} />}
    </div>
  );
}
