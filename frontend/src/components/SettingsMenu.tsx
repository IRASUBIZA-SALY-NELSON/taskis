'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Check } from 'lucide-react';
import { FONT_OPTIONS, getFontId, applyFont } from '@/lib/prefs';
import { getNotifyPrefs, setNotifyPrefs, requestNotificationPermission, notificationsEnabled } from '@/lib/notify';

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFontId(getFontId());
    setPrefs(getNotifyPrefs());
    setGranted(notificationsEnabled());
  }, [open]);

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
