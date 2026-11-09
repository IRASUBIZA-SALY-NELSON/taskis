'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Check, Moon } from 'lucide-react';
import { FONT_OPTIONS, getFontId, applyFont } from '@/lib/prefs';
import { getNotifyPrefs, setNotifyPrefs, requestNotificationPermission, notificationsEnabled, getDnd, setDnd } from '@/lib/notify';
import { getThemeMode, applyThemeMode, type ThemeMode } from '@/lib/theme';
import { ACCENTS, getAccent, applyAccent } from '@/lib/accent';
import { markFeature } from '@/lib/features';
import { apiUrl } from '@/lib/api';

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-[34px] h-[20px] rounded-full transition-colors flex-none"
      style={{ background: on ? 'var(--accent)' : 'var(--surface-3)' }}
      aria-pressed={on}
    >
      <span className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all" style={{ left: on ? 16 : 2 }} />
    </button>
  );
}

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [fontId, setFontId] = useState('geist');
  const [prefs, setPrefs] = useState({ sound: true, desktop: true });
  const [granted, setGranted] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState('blue');
  const [dnd, setDndState] = useState<{ on: boolean; from: number | null; to: number | null }>({ on: false, from: null, to: null });
  const [hidePush, setHidePush] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch(apiUrl('/api/push/prefs'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setHidePush(!!d.hideContent); })
      .catch(() => {});
  }, [open]);

  const toggleHidePush = () => {
    const next = !hidePush;
    setHidePush(next);
    fetch(apiUrl('/api/push/prefs'), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hideContent: next }),
    }).catch(() => setHidePush(!next));
  };

  useEffect(() => {
    setFontId(getFontId());
    setPrefs(getNotifyPrefs());
    setGranted(notificationsEnabled());
    setTheme(getThemeMode());
    setAccent(getAccent());
    setDndState(getDnd());
  }, [open]);

  const toTime = (m: number | null) => (m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  const fromTime = (s: string): number | null => { if (!s) return null; const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
  const updateDnd = (d: Partial<{ on: boolean; from: number | null; to: number | null }>) => { setDnd(d); setDndState((s) => ({ ...s, ...d })); markFeature('dnd'); };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (id: string) => { applyFont(id); setFontId(id); };
  const update = (p: Partial<{ sound: boolean; desktop: boolean }>) => { setNotifyPrefs(p); setPrefs((s) => ({ ...s, ...p })); };

  const enableDesktop = async () => {
    const ok = await requestNotificationPermission();
    setGranted(ok);
    if (ok) update({ desktop: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="icon-btn w-[30px] h-[30px]" title="Settings" aria-label="Settings">
        <Settings className="w-[15px] h-[15px]" />
      </button>
      {open && (
        <div className="card absolute bottom-full left-0 mb-2 w-[248px] max-w-[calc(100vw-32px)] py-1.5 z-50" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
          <div className="eyebrow px-3 py-1.5">Appearance</div>
          <div className="px-3 pb-1.5">
            <div className="flex gap-1 p-0.5 rounded-lg bg-surface-2 border border-border">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { applyThemeMode(m); setTheme(m); }}
                  className="flex-1 py-1 rounded-md text-[12px] font-medium capitalize transition-colors"
                  style={theme === m ? { background: 'var(--surface-1)', color: 'var(--t1)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--t3)' }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pt-2 pb-1">
            <div className="eyebrow pb-2">Accent</div>
            <div className="flex items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { applyAccent(a.id); setAccent(a.id); markFeature('accent'); }}
                  title={a.label}
                  aria-label={a.label}
                  className="w-6 h-6 rounded-full grid place-items-center transition-transform hover:scale-110"
                  style={{ background: a.hex, boxShadow: accent === a.id ? '0 0 0 2px var(--surface-1), 0 0 0 4px var(--t2)' : 'var(--edge-hi)' }}
                >
                  {accent === a.id && <Check className="w-[12px] h-[12px] text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border my-1.5 mx-3" />

          <div className="eyebrow px-3 py-1.5">Notifications</div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[13.5px] text-t1">Desktop alerts</span>
            {granted
              ? <Toggle on={prefs.desktop} onClick={() => update({ desktop: !prefs.desktop })} />
              : <button onClick={enableDesktop} className="text-[12px] font-medium text-accent-text hover:underline">Enable</button>}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[13.5px] text-t1">Sound</span>
            <Toggle on={prefs.sound} onClick={() => update({ sound: !prefs.sound })} />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 gap-2">
            <span className="text-[13.5px] text-t1 leading-tight">Hide message text in push alerts</span>
            <Toggle on={hidePush} onClick={toggleHidePush} />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[13.5px] text-t1"><Moon className="w-[14px] h-[14px] text-t3" />Do Not Disturb</span>
            <Toggle on={dnd.on} onClick={() => updateDnd({ on: !dnd.on })} />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 gap-2">
            <span className="text-[12.5px] text-t2 flex-none">Quiet hours</span>
            <div className="flex items-center gap-1">
              <input type="time" value={toTime(dnd.from)} onChange={(e) => updateDnd({ from: fromTime(e.target.value) })} className="tk-input" style={{ padding: '3px 6px', width: 84, fontSize: 12 }} />
              <span className="text-t3 text-xs">–</span>
              <input type="time" value={toTime(dnd.to)} onChange={(e) => updateDnd({ to: fromTime(e.target.value) })} className="tk-input" style={{ padding: '3px 6px', width: 84, fontSize: 12 }} />
            </div>
          </div>

          <div className="h-px bg-border my-1.5 mx-3" />

          <div className="eyebrow px-3 py-1.5">Font</div>
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => choose(f.id)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-hover transition-colors"
            >
              <span className="text-[13.5px] text-t1" style={{ fontFamily: f.stack }}>{f.label}</span>
              {fontId === f.id && <Check className="w-[14px] h-[14px] text-accent-text" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
