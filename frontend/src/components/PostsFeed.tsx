'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, Image as ImageIcon, Trash2, Send, X, Smile, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor, displayOf } from './Sidebar';
import { subscribe } from '@/lib/ws';
import EmojiGifPicker from './EmojiGifPicker';

const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
const token = () => localStorage.getItem('token');
const authJson = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
const mediaUrl = (u?: string) => (!u ? '' : u.startsWith('http') ? u : api(u));

function renderText(text: string) {
  if (!text) return null;
  return text.split(/(https?:\/\/[^\s]+|@\w+)/g).map((p, i) => {
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all">{p}</a>;
    if (/^@\w+$/.test(p)) return <span key={i} className="font-medium text-accent-text">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

function parseRx(r: string): Record<string, string[]> {
  if (!r || !r.trim()) return {};
  const out: Record<string, string[]> = {};
  for (const part of r.split(';')) {
    const i = part.indexOf(':');
    if (i === -1) continue;
    const emoji = part.slice(0, i);
    const users = part.slice(i + 1).split(',').filter(Boolean);
    if (emoji && users.length) out[emoji] = users;
  }
  return out;
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function expiryLabel(expiresAt: string, now: number) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'expiring…';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return '<1m left';
}

function Avatar({ u, size = 36 }: { u: any; size?: number }) {
  const src = mediaUrl(u?.avatarUrl);
  return (
    <span className="relative rounded-full grid place-items-center flex-none text-white font-semibold overflow-hidden" style={{ width: size, height: size, fontSize: size * 0.36, background: src ? 'transparent' : toneFor(u?.username || '?') }}>
      {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(u?.username || '?')}
    </span>
  );
}

function PostCard({ post, user, now, onChange, onDelete, onZoom }: { post: any; user: any; now: number; onChange: (p: any) => void; onDelete: (id: number) => void; onZoom: (url: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [burst, setBurst] = useState(false);
  const [pickReact, setPickReact] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = post.author?.username === user.username;
  const liked = (post.likers || []).includes(user.username);
  const rx = parseRx(post.reactions || '');

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !loaded) {
      fetch(api(`/api/posts/${post.id}/comments`), { headers: { Authorization: `Bearer ${token()}` } })
        .then((r) => r.json()).then((d) => { setComments(d); setLoaded(true); }).catch(() => {});
    }
  };

  const like = async (force?: boolean) => {
    if (force && liked) { setBurst(true); setTimeout(() => setBurst(false), 700); return; }
    const r = await fetch(api(`/api/posts/${post.id}/like`), { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    if (r.ok) onChange(await r.json());
  };

  const doubleLike = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
    if (!liked) like();
  };

  const singleClickImage = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { onZoom(mediaUrl(post.imageUrl)); clickTimer.current = null; }, 220);
  };

  const react = async (emoji: string) => {
    setPickReact(false);
    const r = await fetch(api(`/api/posts/${post.id}/react`), { method: 'POST', headers: authJson(), body: JSON.stringify({ emoji }) });
    if (r.ok) onChange(await r.json());
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await fetch(api(`/api/posts/${post.id}/comments`), { method: 'POST', headers: authJson(), body: JSON.stringify({ content: text }) });
    if (r.ok) {
      const c = await r.json();
      setComments((prev) => [...prev, c]);
      setText('');
      onChange({ ...post, commentCount: (post.commentCount || 0) + 1 });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar u={post.author} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-t1 truncate">{displayOf(post.author)}</div>
          <div className="text-[12px] text-t3">{timeAgo(post.createdAt)}</div>
        </div>
        {post.expiresAt && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-t3 bg-surface-2 border border-border rounded-full px-2.5 py-1" title="Posts disappear 24h after they're shared">
            <Clock className="w-[12px] h-[12px]" />{expiryLabel(post.expiresAt, now)}
          </span>
        )}
        {mine && (
          <button onClick={() => onDelete(post.id)} className="icon-btn w-8 h-8" title="Delete post"><Trash2 className="w-[15px] h-[15px]" /></button>
        )}
      </div>

      {post.imageUrl && (
        <div className="relative bg-surface-2 select-none">
          <img
            src={mediaUrl(post.imageUrl)}
            alt=""
            onClick={singleClickImage}
            onDoubleClick={doubleLike}
            className="w-full max-h-[560px] object-cover cursor-pointer block"
          />
          <AnimatePresence>
            {burst && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 0.45 }}
                className="absolute inset-0 grid place-items-center pointer-events-none"
              >
                <Heart className="w-24 h-24 text-white drop-shadow-lg" fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="px-4 pt-3 flex items-center gap-1">
        <button onClick={() => like()} className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: liked ? 'var(--danger)' : 'var(--t2)' }}>
          <Heart className="w-[21px] h-[21px]" fill={liked ? 'currentColor' : 'none'} /> {post.likeCount || 0}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-sm font-medium text-t2 hover:text-t1 transition-colors ml-4">
          <MessageCircle className="w-[20px] h-[20px]" /> {post.commentCount || 0}
        </button>
        <div className="relative ml-auto" data-menu>
          <button onClick={() => setPickReact((s) => !s)} className="icon-btn w-8 h-8 border-0" title="React"><Smile className="w-[18px] h-[18px]" /></button>
          {pickReact && <EmojiGifPicker reactMode align="right" onEmoji={react} onClose={() => setPickReact(false)} />}
        </div>
      </div>

      {Object.keys(rx).length > 0 && (
        <div className="px-4 pt-2.5 flex flex-wrap gap-1.5">
          {Object.entries(rx).map(([em, users]) => {
            const me = users.includes(user.username);
            return (
              <button key={em} onClick={() => react(em)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors" style={me ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent-text)' } : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--t2)' }}>
                {em}<span className="text-[10px]">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {post.caption && (
        <div className="px-4 pt-2.5 pb-3 text-[14.5px] leading-relaxed text-t1 whitespace-pre-wrap break-words">
          <span className="font-semibold mr-1.5">{displayOf(post.author)}</span>{renderText(post.caption)}
        </div>
      )}

      {showComments && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {comments.length === 0 && loaded && <div className="text-[13px] text-t3">No comments yet — be the first.</div>}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar u={c.author} size={28} />
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-t1 mr-1.5">{displayOf(c.author)}</span>
                <span className="text-[13.5px] text-t1">{renderText(c.content)}</span>
                <div className="text-[11px] text-t3 mt-0.5">{timeAgo(c.createdAt)}</div>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="flex items-center gap-2 pt-1">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="tk-input flex-1" style={{ padding: '8px 12px', fontSize: 13.5 }} />
            <button type="submit" disabled={!text.trim()} className="btn-accent w-9 h-9 rounded-[10px] flex-none"><Send className="w-[15px] h-[15px]" /></button>
          </form>
        </div>
      )}
    </motion.div>
  );
}

export default function PostsFeed({ user }: { user: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [pick, setPick] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [now, setNow] = useState(() => 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const capRef = useRef<HTMLTextAreaElement>(null);

  const normalize = (p: any) => ({ ...p, likedByMe: (p.likers || []).includes(user.username) });

  const load = () => fetch(api('/api/posts'), { headers: { Authorization: `Bearer ${token()}` } })
    .then((r) => r.json()).then((d) => setPosts(Array.isArray(d) ? d.map(normalize) : [])).catch(() => {});

  useEffect(() => {
    setNow(Date.now());
    load().finally(() => setLoading(false));
    // live updates
    const off = subscribe('/topic/feed', (evt: any) => {
      if (!evt || !evt.event) return;
      if (evt.event === 'created') setPosts((prev) => (prev.some((p) => p.id === evt.payload.id) ? prev : [normalize(evt.payload), ...prev]));
      else if (evt.event === 'updated') setPosts((prev) => prev.map((p) => (p.id === evt.payload.id ? { ...p, ...normalize(evt.payload) } : p)));
      else if (evt.event === 'deleted') setPosts((prev) => prev.filter((p) => p.id !== evt.payload.id));
    });
    // poll fallback + clock for countdowns / expiry
    const poll = setInterval(load, 20000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => { off(); clearInterval(poll); clearInterval(clock); };
  }, []);

  // drop expired posts client-side as their timer runs out
  const visible = posts.filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() > now);

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setGifUrl(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const insertEmoji = (e: string) => {
    const ta = capRef.current;
    const pos = ta?.selectionStart ?? caption.length;
    setCaption(caption.slice(0, pos) + e + caption.slice(pos));
    setTimeout(() => { ta?.focus(); }, 0);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !gifUrl && !caption.trim()) return;
    setPosting(true);
    try {
      let imageUrl: string | null = gifUrl;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch(api('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
        if (up.ok) imageUrl = (await up.json()).url;
      }
      const r = await fetch(api('/api/posts'), { method: 'POST', headers: authJson(), body: JSON.stringify({ imageUrl, caption }) });
      if (r.ok) {
        const created = normalize(await r.json());
        setPosts((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
        setCaption('');
        pickFile(null);
        setGifUrl(null);
      } else alert(await r.text());
    } catch (err) { console.error(err); }
    setPosting(false);
  };

  const onChange = (updated: any) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...normalize(updated) } : p)));
  const onDelete = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    await fetch(api(`/api/posts/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="serif text-[18px] font-semibold text-t1 leading-tight">Feed</div>
          <div className="text-xs text-t2 mt-px flex items-center gap-1.5"><Clock className="w-[11px] h-[11px]" />Posts vanish 24 hours after sharing</div>
        </div>
      </header>

      <div className="scroll flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-4 py-6 flex flex-col gap-5">
          {/* composer */}
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <Avatar u={user} />
              <div className="flex-1 min-w-0">
                <textarea ref={capRef} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share something with the team…" rows={2} className="tk-input resize-none" style={{ background: 'transparent', border: 'none', padding: '6px 0' }} />
                {(preview || gifUrl) && (
                  <div className="relative mt-2 inline-block">
                    <img src={preview || gifUrl!} alt="" className="max-h-56 rounded-xl border border-border" />
                    <button onClick={() => { pickFile(null); setGifUrl(null); }} className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-black/55 text-white"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost px-2.5 py-1.5 text-[13px]"><ImageIcon className="w-[16px] h-[16px]" /> Photo</button>
                  <div className="relative" data-menu>
                    <button onClick={() => setPick((s) => !s)} className="btn-ghost px-2.5 py-1.5 text-[13px]"><Smile className="w-[16px] h-[16px]" /> Emoji / GIF</button>
                    {pick && <EmojiGifPicker onEmoji={insertEmoji} onGif={(u) => { setGifUrl(u); pickFile(null); setPick(false); }} onClose={() => setPick(false)} />}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
                  <button onClick={submit} disabled={posting || (!file && !gifUrl && !caption.trim())} className="btn-accent px-4 py-1.5 text-sm ml-auto">
                    {posting && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />} Post
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-t3 text-sm py-10">Loading feed…</div>
          ) : visible.length === 0 ? (
            <div className="text-center text-t2 text-sm py-10">No posts yet. Share the first one — it'll be here for 24 hours.</div>
          ) : (
            visible.map((p) => <PostCard key={p.id} post={p} user={user} now={now} onChange={onChange} onDelete={onDelete} onZoom={setZoom} />)
          )}
        </div>
      </div>

      {/* lightbox */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {zoom && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} className="fixed inset-0 z-[400] flex items-center justify-center p-12 cursor-zoom-out" style={{ background: 'rgba(0,0,0,0.86)' }}>
              <button onClick={() => setZoom(null)} aria-label="Close" className="fixed top-[22px] right-[22px] w-[38px] h-[38px] grid place-items-center rounded-[10px] text-white" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}><X className="w-[18px] h-[18px]" /></button>
              <motion.img initial={{ scale: 0.97 }} animate={{ scale: 1 }} src={zoom} alt="" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
