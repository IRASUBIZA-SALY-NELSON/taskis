import React from 'react';

interface Opts { members?: any[]; me?: string }

function inline(text: string, opts: Opts, keyBase: string) {
  // Protect inline code first, then handle links, mentions, bold, italic.
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (/^`[^`]+`$/.test(part)) return <code key={k} className="tk-icode">{part.slice(1, -1)}</code>;
    return part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s]+|@\w+)/g).map((t, j) => {
      const kk = `${k}-${j}`;
      if (/^\*\*[^*]+\*\*$/.test(t)) return <strong key={kk} className="font-semibold">{t.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(t) || /^_[^_]+_$/.test(t)) return <em key={kk}>{t.slice(1, -1)}</em>;
      if (/^https?:\/\//.test(t)) return <a key={kk} href={t} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all hover:opacity-80">{t}</a>;
      if (/^@\w+$/.test(t)) {
        const name = t.slice(1);
        const known = !opts.members || opts.members.some((m) => m.username?.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === opts.me?.toLowerCase();
        if (!known) return <span key={kk}>{t}</span>;
        const isMe = name.toLowerCase() === opts.me?.toLowerCase();
        return <span key={kk} className="font-medium" style={{ color: 'var(--accent-text)', background: isMe ? 'var(--accent-soft)' : 'transparent', borderRadius: 4, padding: isMe ? '0 3px' : 0 }}>{t}</span>;
      }
      return <span key={kk}>{t}</span>;
    });
  });
}

/** Lightweight, safe markdown: fenced code blocks, inline code, bold, italic, links, @mentions.
    React escapes everything, so there's no HTML-injection risk. */
export function renderRich(text: string, opts: Opts = {}) {
  if (!text) return null;
  const segments = text.split(/```([\s\S]*?)```/g); // [text, code, text, code, ...]
  return segments.map((seg, i) => {
    if (i % 2 === 1) {
      return <pre key={`code-${i}`} className="tk-code"><code>{seg.replace(/^\n/, '').replace(/\n$/, '')}</code></pre>;
    }
    if (!seg) return null;
    return <React.Fragment key={`t-${i}`}>{inline(seg, opts, `t${i}`)}</React.Fragment>;
  });
}
