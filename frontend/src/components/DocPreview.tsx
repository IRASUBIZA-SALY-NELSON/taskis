'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download } from 'lucide-react';

// A document in a message shows what's inside it: the first page of a PDF or Word file, or the
// first lines of a text file. Tapping it opens the full viewer. Thumbnails are cached because the
// chat re-renders often.

type Thumb =
  | { kind: 'img'; src: string; pages?: number }
  | { kind: 'html'; html: string }
  | { kind: 'text'; text: string }
  | { kind: 'none' };

const CARD_W = 282;
const PREVIEW_H = 170;
const MAX_BYTES = 25 * 1024 * 1024;

const cache = new Map<string, Thumb>();
const inflight = new Map<string, Promise<Thumb>>();

function kindOf(type: string, name: string): 'pdf' | 'docx' | 'text' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || type.includes('wordprocessingml') || type.endsWith('.docx')) return 'docx';
  if (type.startsWith('text/') || type === 'application/json' || ['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'text';
  return 'other';
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('too large');
  const blob = await res.blob();
  if (blob.size > MAX_BYTES) throw new Error('too large');
  return blob;
}

async function makePdfThumb(url: string): Promise<Thumb> {
  const blob = await fetchBlob(url);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (CARD_W * 2) / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const thumb: Thumb = { kind: 'img', src: canvas.toDataURL('image/jpeg', 0.82), pages: doc.numPages };
  task.destroy();
  return thumb;
}

async function makeDocxThumb(url: string): Promise<Thumb> {
  const blob = await fetchBlob(url);
  const { renderAsync } = await import('docx-preview');
  const body = document.createElement('div');
  const styles = document.createElement('div');
  body.style.cssText = 'position:fixed;left:-10000px;top:0;';
  document.body.appendChild(body);
  try {
    // The first page is in the DOM almost immediately; what renderAsync keeps waiting on is images and
    // fonts, which a thumbnail doesn't need. Don't let a slow one hold the card up.
    await Promise.race([
      renderAsync(blob, body, styles, { inWrapper: false, breakPages: true, renderHeaders: false, renderFooters: false, renderFootnotes: false }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    const page = body.querySelector('section.docx') as HTMLElement | null;
    if (!page) return { kind: 'none' };
    const width = page.style.width || '816px';
    // Shown inside a sandboxed iframe with no scripts, so nothing in the document can run.
    const html = `<!doctype html><meta charset="utf-8"><style>${styles.textContent || ''}html,body{margin:0;background:#fff;overflow:hidden}section.docx{margin:0!important;box-shadow:none!important;width:${width};padding:30pt 36pt!important;min-height:0!important;box-sizing:border-box}</style>${page.outerHTML}`;
    return { kind: 'html', html };
  } finally {
    body.remove();
  }
}

async function makeTextThumb(url: string): Promise<Thumb> {
  const blob = await fetchBlob(url);
  return { kind: 'text', text: (await blob.text()).slice(0, 700) };
}

function loadThumb(url: string, kind: ReturnType<typeof kindOf>): Promise<Thumb> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(url);
  if (!p) {
    const work = kind === 'pdf' ? makePdfThumb(url) : kind === 'docx' ? makeDocxThumb(url) : makeTextThumb(url);
    p = work.catch((): Thumb => ({ kind: 'none' })).then((t) => { cache.set(url, t); inflight.delete(url); return t; });
    inflight.set(url, p);
  }
  return p;
}

export default function DocPreview({ url, type, name, downloadHref, onOpen }: {
  url: string; type: string; name: string; downloadHref: string; onOpen: () => void;
}) {
  const kind = kindOf(type, name);
  const ext = (name.split('.').pop() || type.split('/')[1] || 'file').toUpperCase().slice(0, 5);
  const [thumb, setThumb] = useState<Thumb | null>(() => cache.get(url) ?? null);
  const box = useRef<HTMLButtonElement>(null);

  // Only fetch a document once it scrolls into view.
  useEffect(() => {
    if (thumb || kind === 'other') return;
    const el = box.current;
    if (!el) return;
    let alive = true;
    const start = () => loadThumb(url, kind).then((t) => { if (alive) setThumb(t); });
    if (typeof IntersectionObserver === 'undefined') { start(); return () => { alive = false; }; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [url, kind, thumb]);

  const meta = thumb?.kind === 'img' && thumb.pages ? `${ext} · ${thumb.pages} page${thumb.pages > 1 ? 's' : ''}` : ext;

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-surface-2 shadow-[var(--shadow-sm)]" style={{ width: CARD_W, maxWidth: '100%' }}>
      <button ref={box} onClick={onOpen} title="Open" aria-label={`Open ${name}`}
        className="relative block w-full p-0 border-0 text-left cursor-pointer overflow-hidden"
        style={{ height: PREVIEW_H, background: thumb?.kind === 'text' ? 'var(--surface-1)' : '#fff' }}>
        {thumb?.kind === 'img' && <img src={thumb.src} alt="" className="w-full block" draggable={false} />}
        {thumb?.kind === 'html' && (
          <iframe sandbox="" scrolling="no" srcDoc={thumb.html} title={name} tabIndex={-1}
            className="absolute top-0 left-0 border-0 pointer-events-none origin-top-left"
            style={{ width: 816, height: Math.ceil(PREVIEW_H / (CARD_W / 816)), transform: `scale(${CARD_W / 816})` }} />
        )}
        {thumb?.kind === 'text' && (
          <pre className="m-0 p-3 text-[11px] leading-[1.45] text-t2 font-mono whitespace-pre-wrap break-words overflow-hidden">{thumb.text}</pre>
        )}
        {(thumb?.kind === 'none' || kind === 'other') && (
          <span className="absolute inset-0 grid place-items-center bg-surface-2">
            <span className="flex flex-col items-center gap-1.5 text-t3">
              <FileText className="w-9 h-9" />
              <span className="text-[11px] font-semibold tracking-wider">{ext}</span>
            </span>
          </span>
        )}
        {!thumb && kind !== 'other' && <span className="absolute inset-0 animate-pulse bg-surface-3" />}
        {thumb && thumb.kind !== 'none' && kind !== 'other' && (
          <span className="absolute inset-x-0 bottom-0 h-7 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.10), transparent)' }} />
        )}
      </button>
      <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-t1 truncate">{name}</div>
          <div className="text-[11.5px] text-t3">{meta}</div>
        </div>
        <a href={downloadHref} download target="_blank" rel="noreferrer" className="icon-btn w-[30px] h-[30px] border-0 flex-none" aria-label="Download" title="Download">
          <Download className="w-[15px] h-[15px]" />
        </a>
      </div>
    </div>
  );
}
