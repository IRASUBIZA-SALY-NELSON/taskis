'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, FileQuestion } from 'lucide-react';

export interface PreviewAtt {
  url: string; // full, fetchable URL
  type: string;
  name: string;
}

const kindOf = (type: string) => {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('text/') || type === 'application/json') return 'text';
  return 'other';
};

/** Slack-style in-app viewer: opens an overlay and shows the file inline. */
export default function FilePreview({ att, onClose }: { att: PreviewAtt | null; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [textErr, setTextErr] = useState(false);
  const kind = att ? kindOf(att.type) : 'other';

  useEffect(() => {
    if (!att) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [att, onClose]);

  useEffect(() => {
    setText(null);
    setTextErr(false);
    if (att && kind === 'text') {
      fetch(att.url)
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => setText(t.slice(0, 200_000)))
        .catch(() => setTextErr(true));
    }
  }, [att, kind]);

  if (typeof document === 'undefined') return null;

  const dl = att ? (att.url.includes('/api/files/') ? `${att.url}?dl=1` : att.url) : '#';

  return createPortal(
    <AnimatePresence>
      {att && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[440] flex flex-col p-4 sm:p-8"
          style={{ background: 'rgba(7,7,9,0.82)', backdropFilter: 'blur(3px)' }}
        >
          {/* toolbar */}
          <div className="flex items-center gap-3 mb-3 flex-none text-white" onClick={(e) => e.stopPropagation()}>
            <FileText className="w-[16px] h-[16px] opacity-80 flex-none" />
            <div className="flex-1 min-w-0 truncate text-[14px] font-medium">{att.name}</div>
            <a href={dl} download target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <Download className="w-[14px] h-[14px]" /> Download
            </a>
            <button onClick={onClose} aria-label="Close"
              className="w-[34px] h-[34px] grid place-items-center rounded-lg flex-none"
              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <X className="w-[16px] h-[16px]" />
            </button>
          </div>

          {/* body */}
          <motion.div
            initial={{ scale: 0.98, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-h-0 rounded-2xl overflow-hidden grid place-items-center"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: kind === 'image' || kind === 'video' ? 'transparent' : 'var(--surface-1)' }}
          >
            {kind === 'image' && <img src={att.url} alt={att.name} className="max-w-full max-h-full object-contain" />}
            {kind === 'video' && <video src={att.url} controls autoPlay className="max-w-full max-h-full" />}
            {kind === 'audio' && (
              <div className="w-full max-w-md px-6"><audio src={att.url} controls autoPlay className="w-full" /></div>
            )}
            {kind === 'pdf' && <iframe src={att.url} title={att.name} className="w-full h-full bg-white" />}
            {kind === 'text' && (
              <div className="w-full h-full overflow-auto scroll">
                {textErr ? (
                  <div className="h-full grid place-items-center text-t3 text-sm">Couldn’t load preview.</div>
                ) : text === null ? (
                  <div className="h-full grid place-items-center text-t3 text-sm">Loading…</div>
                ) : (
                  <pre className="m-0 p-5 text-[13px] leading-relaxed text-t1 whitespace-pre-wrap break-words font-mono">{text}</pre>
                )}
              </div>
            )}
            {kind === 'other' && (
              <div className="text-center px-6 py-10">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border grid place-items-center text-t3 mx-auto mb-4">
                  <FileQuestion className="w-6 h-6" />
                </div>
                <div className="text-[15px] font-semibold text-t1">No in-app preview</div>
                <div className="text-[13px] text-t2 mt-1 max-w-[320px] mx-auto">This file type can’t be shown here. Download it to open with the right app.</div>
                <a href={dl} download target="_blank" rel="noreferrer" className="btn-accent px-4 py-2.5 text-sm mt-4 inline-flex">
                  <Download className="w-[15px] h-[15px]" /> Download
                </a>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
