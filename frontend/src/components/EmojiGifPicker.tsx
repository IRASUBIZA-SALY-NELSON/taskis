'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { EMOJI_GROUPS, searchEmoji } from '@/lib/emoji';

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
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji');
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
          {(['emoji', 'gif'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setQ(''); }}
              className="flex-1 py-2 text-[12px] font-semibold uppercase tracking-wider transition-colors"
              style={tab === t ? { color: 'var(--accent-text)', boxShadow: 'inset 0 -2px 0 var(--accent)' } : { color: 'var(--t3)' }}
            >
              {t === 'emoji' ? 'Emoji' : 'GIF'}
            </button>
          ))}
        </div>
      )}

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

      {tab === 'emoji' ? (
        <div className="scroll max-h-[230px] overflow-y-auto p-2">
          {q.trim() ? (
            <div className="grid grid-cols-8 gap-0.5">
              {emojis.map((e, i) => (
                <button key={i} onClick={() => onEmoji(e)} className="text-xl p-1 rounded-md hover:bg-hover transition-colors">{e}</button>
              ))}
              {emojis.length === 0 && <div className="col-span-8 text-center text-[12px] text-t3 py-4">No emoji found</div>}
            </div>
          ) : (
            EMOJI_GROUPS.map((g) => (
              <div key={g.name} className="mb-1.5">
                <div className="eyebrow px-1 py-1" style={{ fontSize: 10 }}>{g.name}</div>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.items.map((it, i) => (
                    <button key={i} onClick={() => onEmoji(it.e)} className="text-xl p-1 rounded-md hover:bg-hover transition-colors">{it.e}</button>
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
                <button key={g.id} onClick={() => onGif?.(g.url)} className="rounded-lg overflow-hidden border border-border hover:border-border-strong transition-colors">
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
