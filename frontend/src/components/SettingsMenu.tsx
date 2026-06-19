'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings, Check } from 'lucide-react';
import { FONT_OPTIONS, getFontId, applyFont } from '@/lib/prefs';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [fontId, setFontId] = useState('geist');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setFontId(getFontId()); }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (id: string) => { applyFont(id); setFontId(id); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="icon-btn w-[30px] h-[30px]" title="Settings" aria-label="Settings">
        <Settings className="w-[15px] h-[15px]" />
      </button>
      {open && (
        <div className="card absolute bottom-full right-0 mb-2 w-[220px] py-1.5 z-50" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
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
