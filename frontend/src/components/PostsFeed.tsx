'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Image as ImageIcon, Trash2, Send, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { initials, toneFor, displayOf } from './Sidebar';

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

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({ u, size = 36 }: { u: any; size?: number }) {
  const src = mediaUrl(u?.avatarUrl);
  return (
    <span className="rounded-full grid place-items-center flex-none text-white font-semibold overflow-hidden" style={{ width: size, height: size, fontSize: size * 0.36, background: src ? 'transparent' : toneFor(u?.username || '?') }}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials(u?.username || '?')}
    </span>
  );
}

function PostCard({ post, user, onChange, onDelete }: { post: any; user: any; onChange: (p: any) => void; onDelete: (id: number) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const mine = post.author?.username === user.username;

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !loaded) {
      fetch(api(`/api/posts/${post.id}/comments`), { headers: { Authorization: `Bearer ${token()}` } })
        .then((r) => r.json()).then((d) => { setComments(d); setLoaded(true); }).catch(() => {});
    }
  };

  const like = async () => {
    const r = await fetch(api(`/api/posts/${post.id}/like`), { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
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
        {mine && (
          <button onClick={() => onDelete(post.id)} className="icon-btn w-8 h-8" title="Delete post"><Trash2 className="w-[15px] h-[15px]" /></button>
        )}
      </div>

      {post.imageUrl && (
        <img src={mediaUrl(post.imageUrl)} alt="" className="w-full max-h-[560px] object-cover bg-surface-2" />
      )}

      <div className="px-4 pt-3 pb-1 flex items-center gap-1">
        <button onClick={like} className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: post.likedByMe ? 'var(--danger)' : 'var(--t2)' }}>
          <Heart className="w-[20px] h-[20px]" fill={post.likedByMe ? 'currentColor' : 'none'} /> {post.likeCount || 0}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-sm font-medium text-t2 hover:text-t1 transition-colors ml-3">
          <MessageCircle className="w-[19px] h-[19px]" /> {post.commentCount || 0}
        </button>
      </div>

      {post.caption && (
        <div className="px-4 pb-3 text-[14.5px] leading-relaxed text-t1 whitespace-pre-wrap break-words">
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
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(api('/api/posts'), { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json()).then((d) => { setPosts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !caption.trim()) return;
    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch(api('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
        if (up.ok) imageUrl = (await up.json()).url;
      }
      const r = await fetch(api('/api/posts'), { method: 'POST', headers: authJson(), body: JSON.stringify({ imageUrl, caption }) });
      if (r.ok) {
        const created = await r.json();
        setPosts((prev) => [created, ...prev]);
        setCaption('');
        pick(null);
      } else {
        alert(await r.text());
      }
    } catch (err) { console.error(err); }
    setPosting(false);
  };

  const onChange = (updated: any) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  const onDelete = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    await fetch(api(`/api/posts/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold text-t1 leading-tight">Feed</div>
          <div className="text-xs text-t2 mt-px">Posts from the team</div>
        </div>
      </header>

      <div className="scroll flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-4 py-6 flex flex-col gap-5">
          {/* composer */}
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <Avatar u={user} />
              <div className="flex-1 min-w-0">
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share something with the team…" rows={2} className="tk-input resize-none" style={{ background: 'transparent', border: 'none', padding: '6px 0' }} />
                {preview && (
                  <div className="relative mt-2 inline-block">
                    <img src={preview} alt="" className="max-h-56 rounded-xl border border-border" />
                    <button onClick={() => pick(null)} className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-black/55 text-white"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost px-2.5 py-1.5 text-[13px]"><ImageIcon className="w-[16px] h-[16px]" /> Photo</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
                  <button onClick={submit} disabled={posting || (!file && !caption.trim())} className="btn-accent px-4 py-1.5 text-sm">
                    {posting && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />} Post
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-t3 text-sm py-10">Loading feed…</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-t2 text-sm py-10">No posts yet. Share the first one.</div>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} user={user} onChange={onChange} onDelete={onDelete} />)
          )}
        </div>
      </div>
    </div>
  );
}
