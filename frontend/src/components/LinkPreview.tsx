'use client';

import React, { useEffect, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { apiUrl } from '@/lib/api';

type Meta = { title?: string; description?: string; image?: string; siteName?: string };
const metaCache = new Map<string, Meta>();

/** Title, description and image of a page, fetched by the server (browsers can't read other sites directly). */
function usePageMeta(url: string, enabled: boolean): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(() => metaCache.get(url) ?? null);
  useEffect(() => {
    if (!enabled || metaCache.has(url)) return;
    let alive = true;
    fetch(apiUrl(`/api/links/preview?url=${encodeURIComponent(url)}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m: Meta) => { metaCache.set(url, m); if (alive) setMeta(m); });
    return () => { alive = false; };
  }, [url, enabled]);
  return meta;
}

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
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* invalid url: nothing to show */ }

  const yt = host ? ytId(url) : null;
  const plain = !!host && !yt && !IMG.test(url);
  const meta = usePageMeta(url, plain);
  const [imgOk, setImgOk] = useState(true);
  if (!host) return null;

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

  if (meta && (meta.title || meta.image)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-[300px] max-w-full rounded-xl overflow-hidden border border-border hover:border-border-strong transition-colors mt-1.5 bg-surface-2">
        {meta.image && imgOk && (
          <img src={meta.image} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="w-full h-[150px] object-cover block bg-surface-3" />
        )}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11.5px] text-t3 mb-0.5">
            <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-sm flex-none" />
            <span className="truncate">{meta.siteName || host}</span>
          </div>
          {meta.title && <div className="text-[13.5px] font-semibold text-t1 leading-snug line-clamp-2">{meta.title}</div>}
          {meta.description && <div className="text-[12.5px] text-t2 leading-snug mt-0.5 line-clamp-2">{meta.description}</div>}
        </div>
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
