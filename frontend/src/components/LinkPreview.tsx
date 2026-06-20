'use client';

import React from 'react';
import { Play, ExternalLink } from 'lucide-react';

const IMG = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;

export function firstUrl(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0].replace(/[).,]+$/, '') : null;
}

function ytId(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null;
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
  } catch { /* ignore */ }
  return null;
}

export default function LinkPreview({ url }: { url: string }) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }

  const yt = ytId(url);
  if (yt) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-[300px] max-w-full rounded-xl overflow-hidden border border-border hover:border-border-strong transition-colors mt-1.5">
        <div className="relative">
          <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" className="w-full h-[160px] object-cover block" />
          <span className="absolute inset-0 grid place-items-center"><span className="w-12 h-12 rounded-full grid place-items-center bg-black/55 text-white"><Play className="w-5 h-5 ml-0.5" fill="currentColor" /></span></span>
        </div>
        <div className="px-3 py-2 bg-surface-2 text-[12px] text-t2 flex items-center gap-1.5"><Play className="w-3 h-3" /> youtube.com</div>
      </a>
    );
  }

  if (IMG.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-[300px] max-w-full rounded-xl overflow-hidden border border-border hover:border-border-strong transition-colors mt-1.5">
        <img src={url} alt="" className="w-full max-h-[280px] object-cover block" />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 w-[300px] max-w-full rounded-xl border border-border hover:border-border-strong transition-colors mt-1.5 px-3 py-2.5 bg-surface-2">
      <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" className="w-5 h-5 rounded flex-none" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-t1 truncate">{host}</div>
        <div className="text-[12px] text-t3 truncate">{url.replace(/^https?:\/\//, '')}</div>
      </div>
      <ExternalLink className="w-[14px] h-[14px] text-t3 flex-none" />
    </a>
  );
}
