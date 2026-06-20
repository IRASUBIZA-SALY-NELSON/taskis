'use client';

import React, { useState } from 'react';

interface Opts { members?: any[]; me?: string }

function Spoiler({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      onClick={() => setShow(true)}
      title={show ? undefined : 'Click to reveal'}
      className="rounded px-1 transition-colors"
      style={show ? undefined : { background: 'var(--surface-3)', color: 'transparent', cursor: 'pointer', userSelect: 'none' }}
    >
      {text}
    </span>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="relative group/code">
      <pre className="tk-code"><code>{code}</code></pre>
      <button onClick={copy} className="absolute top-1.5 right-1.5 text-[11px] px-1.5 py-0.5 rounded bg-surface-3 text-t2 hover:text-t1 opacity-0 group-hover/code:opacity-100 transition-opacity">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function inline(text: string, opts: Opts, keyBase: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (/^`[^`]+`$/.test(part)) return <code key={k} className="tk-icode">{part.slice(1, -1)}</code>;
    return part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|\|\|[^|\n]+\|\||https?:\/\/[^\s]+|@\w+)/g).map((t, j) => {
      const kk = `${k}-${j}`;
      if (/^\*\*[^*]+\*\*$/.test(t)) return <strong key={kk} className="font-semibold">{t.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(t) || /^_[^_]+_$/.test(t)) return <em key={kk}>{t.slice(1, -1)}</em>;
      if (/^\|\|[^|]+\|\|$/.test(t)) return <Spoiler key={kk} text={t.slice(2, -2)} />;
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

/** Lightweight, safe markdown: fenced code blocks (with copy), inline code,
    bold, italic, ||spoiler||, links, @mentions. React escapes everything. */
export function renderRich(text: string, opts: Opts = {}) {
  if (!text) return null;
  const segments = text.split(/```([\s\S]*?)```/g); // [text, code, text, code, ...]
  return segments.map((seg, i) => {
    if (i % 2 === 1) return <CodeBlock key={`code-${i}`} code={seg.replace(/^\n/, '').replace(/\n$/, '')} />;
    if (!seg) return null;
    return <React.Fragment key={`t-${i}`}>{inline(seg, opts, `t${i}`)}</React.Fragment>;
  });
}
