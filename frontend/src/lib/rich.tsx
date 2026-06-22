'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from './clipboard';

interface Opts { members?: any[]; me?: string; custom?: Record<string, string> }

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'import', 'export', 'from', 'default', 'class', 'new', 'extends', 'implements',
  'interface', 'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly', 'true', 'false', 'null',
  'undefined', 'void', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
  'as', 'yield', 'def', 'print', 'elif', 'lambda', 'None', 'True', 'False', 'package', 'func', 'struct', 'val', 'fn', 'let',
]);

function highlightCode(code: string) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g;
  const out: React.ReactNode[] = [];
  let last = 0; let k = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(<span key={k++}>{code.slice(last, m.index)}</span>);
    const t = m[0];
    let color: string | undefined;
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('#')) color = 'var(--code-comment)';
    else if (/^[`"']/.test(t)) color = 'var(--code-string)';
    else if (/^\d/.test(t)) color = 'var(--code-number)';
    else if (KEYWORDS.has(t)) color = 'var(--code-keyword)';
    out.push(<span key={k++} style={color ? { color } : undefined}>{t}</span>);
    last = re.lastIndex;
  }
  if (last < code.length) out.push(<span key={k++}>{code.slice(last)}</span>);
  return out;
}

function Spoiler({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span onClick={() => setShow(true)} title={show ? undefined : 'Click to reveal'} className="rounded px-1 transition-colors"
      style={show ? undefined : { background: 'var(--surface-3)', color: 'transparent', cursor: 'pointer', userSelect: 'none' }}>
      {text}
    </span>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (await copyToClipboard(code)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  return (
    <div className="tk-codeblock">
      <div className="tk-codeblock-head">
        <span className="font-mono text-[11.5px] text-t3 truncate">{lang || 'code'}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[11.5px] text-t3 hover:text-t1 transition-colors">
          {copied ? <Check className="w-[12px] h-[12px]" /> : <Copy className="w-[12px] h-[12px]" />}{copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre><code>{highlightCode(code)}</code></pre>
    </div>
  );
}

function inline(text: string, opts: Opts, keyBase: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (/^`[^`]+`$/.test(part)) return <code key={k} className="tk-icode">{part.slice(1, -1)}</code>;
    return part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|\|\|[^|\n]+\|\||\[[^\]\n]+\]\([^)\s]+\)|:[a-z0-9_]+:|https?:\/\/[^\s]+|@\w+)/g).map((t, j) => {
      const kk = `${k}-${j}`;
      if (/^\*\*[^*]+\*\*$/.test(t)) return <strong key={kk} className="font-semibold">{t.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(t) || /^_[^_]+_$/.test(t)) return <em key={kk}>{t.slice(1, -1)}</em>;
      if (/^~~[^~]+~~$/.test(t)) return <span key={kk} style={{ textDecoration: 'line-through', opacity: 0.7 }}>{t.slice(2, -2)}</span>;
      if (/^\|\|[^|]+\|\|$/.test(t)) return <Spoiler key={kk} text={t.slice(2, -2)} />;
      const md = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (md) {
        const href = /^https?:\/\//.test(md[2]) ? md[2] : `https://${md[2]}`;
        return <a key={kk} href={href} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all hover:opacity-80">{md[1]}</a>;
      }
      if (/^:[a-z0-9_]+:$/.test(t)) {
        const url = opts.custom?.[t.slice(1, -1)];
        if (url) return <img key={kk} src={url} alt={t} title={t} className="inline-block align-text-bottom" style={{ height: '1.35em', width: 'auto', margin: '0 1px' }} />;
        return <span key={kk}>{t}</span>;
      }
      if (/^https?:\/\//.test(t)) return <a key={kk} href={t} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all hover:opacity-80">{t}</a>;
      if (/^@\w+$/.test(t)) {
        const name = t.slice(1);
        const lower = name.toLowerCase();
        // Broadcast mentions highlight for everyone.
        if (lower === 'channel' || lower === 'here' || lower === 'everyone') {
          return <span key={kk} className="font-semibold" style={{ color: 'var(--accent-text)', background: 'var(--accent-soft)', borderRadius: 4, padding: '0 3px' }}>{t}</span>;
        }
        const known = !opts.members || opts.members.some((mm) => mm.username?.toLowerCase() === lower) || lower === opts.me?.toLowerCase();
        if (!known) return <span key={kk}>{t}</span>;
        const isMe = lower === opts.me?.toLowerCase();
        return <span key={kk} className="font-medium" style={{ color: 'var(--accent-text)', background: isMe ? 'var(--accent-soft)' : 'transparent', borderRadius: 4, padding: isMe ? '0 3px' : 0 }}>{t}</span>;
      }
      return <span key={kk}>{t}</span>;
    });
  });
}

/**
 * Strip markdown markers to readable plain text — for compact previews (reply
 * bars, pinned list, thread roots, search) where we want the *words* without
 * the `*_~`` symbols cluttering them.
 */
export function plainText(text: string | null | undefined): string {
  if (!text) return '';
  if (text.startsWith('::poll::')) { try { return `📊 ${JSON.parse(text.slice(8)).q || 'Poll'}`; } catch { return 'Poll'; } }
  return text
    .replace(/^::(slam|gentle)::\s?/, '') // message effect markers
    .replace(/```[\w.+-]*\n?([\s\S]*?)```/g, '$1') // fenced code → contents
    .replace(/\*\*([^*\n]+)\*\*/g, '$1') // bold
    .replace(/~~([^~\n]+)~~/g, '$1') // strike
    .replace(/\|\|([^|\n]+)\|\|/g, '$1') // spoiler
    .replace(/\*([^*\n]+)\*/g, '$1') // italic *
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1$2') // italic _ (word-boundary only)
    .replace(/`([^`\n]+)`/g, '$1') // inline code
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1') // [label](url) → label
    .replace(/\s+/g, ' ')
    .trim();
}

const splitRow = (ln: string) => ln.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

/** Block-level markdown: blockquotes, bullet/numbered lists, tables, paragraphs. */
function renderBlocks(text: string, opts: Opts, keyBase: string): React.ReactNode {
  const lines = text.replace(/\n$/, '').split('\n');
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let k = 0;
  const flush = () => {
    if (!para.length) return;
    const buf = para; para = [];
    out.push(
      <p key={`${keyBase}-p${k++}`} className="tk-md-p">
        {buf.map((ln, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(ln, opts, `${keyBase}-pl${k}-${j}`)}</React.Fragment>)}
      </p>,
    );
  };

  for (let i = 0; i < lines.length;) {
    const ln = lines[i];
    // table: a row with pipes followed by a |---|---| separator
    if (/\|/.test(ln) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+$/.test(lines[i + 1])) {
      flush();
      const header = splitRow(ln);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
      out.push(
        <div key={`${keyBase}-tw${k++}`} className="tk-md-tablewrap">
          <table className="tk-md-table">
            <thead><tr>{header.map((c, ci) => <th key={ci}>{inline(c, opts, `${keyBase}-th${k}-${ci}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{header.map((_, ci) => <td key={ci}>{inline(r[ci] || '', opts, `${keyBase}-td${k}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*>\s?/.test(ln)) {
      flush();
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(<blockquote key={`${keyBase}-q${k++}`} className="tk-md-quote">{q.map((t, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(t, opts, `${keyBase}-ql${k}-${j}`)}</React.Fragment>)}</blockquote>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(ln)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push(<ul key={`${keyBase}-ul${k++}`} className="tk-md-list">{items.map((t, j) => <li key={j}>{inline(t, opts, `${keyBase}-uli${k}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push(<ol key={`${keyBase}-ol${k++}`} className="tk-md-list tk-md-ol">{items.map((t, j) => <li key={j}>{inline(t, opts, `${keyBase}-oli${k}-${j}`)}</li>)}</ol>);
      continue;
    }
    if (ln.trim() === '') { flush(); i++; continue; }
    para.push(ln); i++;
  }
  flush();
  return <React.Fragment key={keyBase}>{out}</React.Fragment>;
}

/** Lightweight markdown: fenced code (lang header, copy, highlight), inline code,
    bold, italic, ~~strike~~, ||spoiler||, [links](url), bare links, @mentions, :custom_emoji:,
    plus blockquotes, lists and tables. */
export function renderRich(text: string, opts: Opts = {}) {
  if (!text) return null;
  const segs = text.split(/```(\w[\w.+-]*)?\n?([\s\S]*?)```/g); // [text, lang, code, text, lang, code, ...]
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < segs.length; i++) {
    const mod = i % 3;
    if (mod === 0) { if (segs[i]) nodes.push(renderBlocks(segs[i], opts, `t${i}`)); }
    else if (mod === 2) { nodes.push(<CodeBlock key={`c-${i}`} code={(segs[i] || '').replace(/^\n/, '').replace(/\n$/, '')} lang={segs[i - 1]} />); }
  }
  return nodes;
}
