'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, Upload } from 'lucide-react';
import { EMOJI_GROUPS, searchEmoji } from '@/lib/emoji';
import { useCustomEmojis, loadCustomEmojis } from '@/lib/customEmoji';

import { apiUrl } from '@/lib/api';

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY || 'dc6zaTOxFJmzC'; // public beta key

interface Props {
  onEmoji: (e: string) => void;
  onGif?: (url: string) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  vertical?: 'up' | 'down';
  reactMode?: boolean; // hide GIF tab (reactions are emoji-only)
}

export default function EmojiGifPicker({ onEmoji, onGif, onClose, align = 'left', vertical = 'up', reactMode = false }: Props) {
  const [tab, setTab] = useState<'emoji' | 'gif' | 'custom'>('emoji');
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [addName, setAddName] = useState('');
  const [addErr, setAddErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const { list: customList } = useCustomEmojis();

  const uploadCustom = async (file: File) => {
    const name = addName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!/^[a-z0-9_]{2,32}$/.test(name)) { setAddErr('Name: 2–32 of a–z, 0–9, _'); return; }
    setAddErr('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await fetch(apiUrl('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
      if (!up.ok) throw new Error();
      const url = (await up.json()).url;
      const r = await fetch(apiUrl('/api/emojis'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ name, url }) });
      if (!r.ok) { setAddErr(await r.text()); return; }
      setAddName('');
      loadCustomEmojis();
    } catch { setAddErr('Upload failed'); }
  };

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'gif') return;
    let cancelled = false;
    setGifLoading(true);
    const endpoint = q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q.trim())}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
    const t = setTimeout(() => {
      fetch(endpoint)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setGifs((d.data || []).map((g: any) => ({
            id: g.id,
            url: g.images?.original?.url,
            preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
          })).filter((g: any) => g.url));
        })
        .catch(() => !cancelled && setGifs([]))
        .finally(() => !cancelled && setGifLoading(false));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tab, q]);

  const emojis = searchEmoji(q);

  return (
    <div
      ref={ref}
      className={`card absolute z-50 ${vertical === 'down' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} ${align === 'right' ? 'right-0' : 'left-0'} w-[300px] max-w-[calc(100vw-32px)] overflow-hidden`}
      style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {!reactMode && (
        <div className="flex border-b border-border">
          {(['emoji', 'gif', 'custom'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setQ(''); }}
              className="flex-1 py-2 text-[12px] font-semibold uppercase tracking-wider transition-colors"
              style={tab === t ? { color: 'var(--accent-text)', boxShadow: 'inset 0 -2px 0 var(--accent)' } : { color: 'var(--t3)' }}
            >
              {t === 'emoji' ? 'Emoji' : t === 'gif' ? 'GIF' : 'Custom'}
            </button>
          ))}
        </div>
      )}

      {tab !== 'custom' && (
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-t3" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'gif' ? 'Search GIFs' : 'Search emoji'}
              className="tk-input"
              style={{ padding: '7px 10px 7px 30px', fontSize: 13 }}
            />
          </div>
        </div>
      )}

      {tab === 'custom' ? (
        <div className="scroll max-h-[230px] overflow-y-auto p-2">
          <div className="flex items-center gap-1.5 mb-2">
            <input value={addName} onChange={(e) => setAddName(e.target.value.toLowerCase())} placeholder="emoji_name" className="tk-input font-mono flex-1" style={{ padding: '6px 10px', fontSize: 12 }} />
            <button type="button" onClick={() => addFileRef.current?.click()} className="btn-secondary px-2.5 py-[7px] text-[12px] flex-none"><Upload className="w-[13px] h-[13px]" />Add</button>
            <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCustom(f); e.target.value = ''; }} />
          </div>
          {addErr && <div className="text-[11.5px] text-danger mb-1.5 px-0.5">{addErr}</div>}
          {customList.length === 0 ? (
            <div className="text-center text-[12px] text-t3 py-5 flex flex-col items-center gap-1"><Plus className="w-4 h-4" />No custom emoji yet</div>
          ) : (
            <div className="grid grid-cols-6 gap-1">
              {customList.map((ce) => (
                <button key={ce.id} type="button" onClick={() => onEmoji(`:${ce.name}:`)} title={`:${ce.name}:`} className="p-1 rounded-md hover:bg-hover grid place-items-center transition-colors">
                  <img src={ce.url} alt={ce.name} className="w-6 h-6 object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'emoji' ? (
        <div className="scroll max-h-[230px] overflow-y-auto p-2">
          {q.trim() ? (
            <div className="grid grid-cols-8 gap-0.5">
              {emojis.map((e, i) => (
                <button key={i} type="button" onClick={() => onEmoji(e)} className="text-xl p-1 rounded-md hover:bg-hover transition-colors">{e}</button>
              ))}
              {emojis.length === 0 && <div className="col-span-8 text-center text-[12px] text-t3 py-4">No emoji found</div>}
            </div>
          ) : (
            EMOJI_GROUPS.map((g) => (
              <div key={g.name} className="mb-1.5">
                <div className="eyebrow px-1 py-1" style={{ fontSize: 10 }}>{g.name}</div>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.items.map((it, i) => (
                    <button key={i} type="button" onClick={() => onEmoji(it.e)} className="text-xl p-1 rounded-md hover:bg-hover transition-colors">{it.e}</button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="scroll max-h-[230px] overflow-y-auto p-2">
          {gifLoading ? (
            <div className="text-center text-[12px] text-t3 py-6">Loading…</div>
          ) : gifs.length === 0 ? (
            <div className="text-center text-[12px] text-t3 py-6">No GIFs found</div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map((g) => (
                <button key={g.id} type="button" onClick={() => onGif?.(g.url)} className="rounded-lg overflow-hidden border border-border hover:border-border-strong transition-colors">
                  <img src={g.preview} alt="" className="w-full h-[88px] object-cover block" />
                </button>
              ))}
            </div>
          )}
          <div className="text-center text-[10px] text-t3 pt-2">Powered by GIPHY</div>
        </div>
      )}
    </div>
  );
}
