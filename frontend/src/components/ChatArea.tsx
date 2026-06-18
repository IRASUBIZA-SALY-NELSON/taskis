'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, File, Download, Menu, MoreVertical, Reply, Pencil, Trash2, X, SmilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatAreaProps { user: any; channel: string; onToggleSidebar: () => void; }

const EMOJIS = ['👍','❤️','😂','😮','','😡','','🎉','👀','💯','✅','🙏'];
const api = (path: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${path}`;
const authH = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bigImage, setBigImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editMsg, setEditMsg] = useState<any>(null);
  const [editVal, setEditVal] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [emojiId, setEmojiId] = useState<number | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const fetchMsgs = () =>
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(setMessages).catch(() => {});

  useEffect(() => { setMessages([]); fetchMsgs(); }, [channel]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(r => { if (r.status === 401) { localStorage.clear(); window.location.href = '/'; } return r.json(); })
        .then((data: any[]) => setMessages(prev => {
          if (data.length !== prev.length || JSON.stringify(data.map(m => m.reactions + m.readBy)) !== JSON.stringify(prev.map(m => m.reactions + m.readBy))) {
            if (data.length > prev.length && document.hidden) document.title = `(${data.length - prev.length}) TASKIS`;
            return data;
          }
          return prev;
        })).catch(() => {});
    }, 1500);
    window.addEventListener('focus', () => { document.title = 'TASKIS'; });
    return () => clearInterval(iv);
  }, [channel]);

  useEffect(() => {
    messages.forEach(msg => {
      if (msg.sender?.username === user.username) return;
      const read = (msg.readBy || '').split(',').map((s: string) => s.trim());
      if (!read.includes(user.username))
        fetch(api(`/api/chat/messages/${msg.id}/read`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    });
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-menu]')) { setMenuId(null); setEmojiId(null); }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    let attachmentUrl = null, attachmentType = null;
    if (file) {
      setUploading(true);
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await fetch(api('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
        if (!r.ok) throw new Error(await r.text());
        const d = await r.json(); attachmentUrl = d.url; attachmentType = d.type;
      } catch (err) { console.error('Upload failed', err); }
      setUploading(false); setFile(null);
    }
    await fetch(api('/api/chat/send'), { method: 'POST', headers: authH(), body: JSON.stringify({ content: input, channel, attachmentUrl, attachmentType, replyToId: replyTo?.id ?? null }) });
    setInput(''); setReplyTo(null); fetchMsgs();
  };

  const react = async (msgId: number, emoji: string) => {
    setEmojiId(null);
    await fetch(api(`/api/chat/messages/${msgId}/react`), { method: 'POST', headers: authH(), body: JSON.stringify({ emoji }) });
    fetchMsgs();
  };

  const deleteMsg = async (id: number) => {
    setMenuId(null);
    if (!confirm('Delete this message?')) return;
    await fetch(api(`/api/chat/messages/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchMsgs();
  };

  const startEdit = (msg: any) => { setMenuId(null); setEditMsg(msg); setEditVal(msg.content); setTimeout(() => editRef.current?.focus(), 50); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(api(`/api/chat/messages/${editMsg.id}`), { method: 'PUT', headers: authH(), body: JSON.stringify({ content: editVal }) });
    if (!r.ok) { alert(await r.text()); return; }
    setEditMsg(null); fetchMsgs();
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(api('/api/chat/unlock-archive'), { method: 'POST', headers: authH(), body: JSON.stringify({ passphrase }) });
    if (r.ok) { setShowUnlock(false); setPassphrase(''); setUnlockErr(''); fetchMsgs(); }
    else setUnlockErr(await r.text());
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffDay = (a: string, b: string) => new Date(a).toDateString() !== new Date(b).toDateString();
  const parseRx = (r: string): Record<string, string[]> => {
    if (!r || !r.trim()) return {};
    const result: Record<string, string[]> = {};
    for (const part of r.split(';')) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      const emoji = part.slice(0, idx);
      const users = part.slice(idx + 1).split(',').filter(Boolean);
      if (emoji && users.length) result[emoji] = users;
    }
    return result;
  };
  const readByOthers = (msg: any) => (msg.readBy || '').split(',').map((s: string) => s.trim()).some((u: string) => u && u !== user.username);

  const dateDivider = (ds: string) => {
    const d = new Date(ds), t = new Date(), y = new Date(t); y.setDate(y.getDate() - 1);
    const label = d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString();
    return (
      <div className="flex items-center justify-center my-6 relative group">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative px-4 py-1.5 rounded-full bg-surface-light border border-border text-xs text-text-muted font-bold tracking-widest uppercase cursor-pointer z-10 flex items-center gap-2">
          {label}<span className="opacity-50 text-[10px]">▼</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-surface-light border border-border rounded-lg shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 pb-1">
            <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase font-bold tracking-wider">Jump to...</div>
            <button onClick={() => bottomRef.current?.scrollIntoView()} className="w-full px-3 py-2 text-xs text-left hover:bg-bg-hover text-text">Today</button>
            {['Last week','Last month','The very beginning'].map(l => (
              <button key={l} onClick={() => setShowUnlock(true)} className="w-full px-3 py-2 text-xs text-left hover:bg-bg-hover text-text-muted flex items-center justify-between">{l}<span className="text-[8px] border border-border px-1 rounded bg-black/40 text-primary">SECURE</span></button>
            ))}
          </div>
        </div>
      </div>
    );
  };



  return (
    <div className="flex flex-col h-full z-10">
      {/* Header */}
      <header className="glass p-4 flex items-center justify-between border-b border-border shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="p-2 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text transition-colors lg:hidden"><Menu className="w-5 h-5" /></button>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-text"><span className="text-primary">#</span>{channel}</h2>
            <p className="text-xs text-text-muted">Encrypted P2P Comm Link • E2E Enabled</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1" onClick={() => { setMenuId(null); setEmojiId(null); }}>
        {messages.map((msg, idx) => {
          const isMe = msg.sender?.username === user.username;
          const showDate = idx === 0 || diffDay(msg.timestamp, messages[idx - 1].timestamp);
          const rx = parseRx(msg.reactions);
          const isDeleted = !!msg.deleted;
  const canEdit = isMe && !isDeleted && !readByOthers(msg);

          return (
            <React.Fragment key={msg.id || idx}>
     {showDate && dateDivider(msg.timestamp)}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2`}>
                <div className="flex items-end gap-2 max-w-[80%]">
                  {/* Avatar */}
               {!isMe && (msg.sender?.avatarUrl
                    ? <img src={msg.sender.avatarUrl.startsWith('http') ? msg.sender.avatarUrl : api(msg.sender.avatarUrl)} alt="" className="w-8 h-8 rounded-full border border-border self-end" />
                    : <div className="w-8 h-8 rounded-full border border-border self-end flex items-center justify-center bg-surface-light text-xs text-text-muted">{msg.sender?.username?.charAt(0).toUpperCase()}</div>
                  )}

                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xsfont-medium text-text-muted">{msg.sender?.username}</span>
                      <span className="text-[10px] text-text-muted/50">{fmt(msg.timestamp)}</span>
                      {msg.edited && !isDeleted && <span className="text-[9px] text-text-muted/40 italic">(edited)</span>}
                    </div>

                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className={`mb-1 px-2 py-1 rounded-lg border-l-2 border-primary/60 bg-surface-light/50 text-xs text-text-muted max-w-xs truncate ${isMe ? 'self-end' : 'self-start'}`}>
                   <span className="font-bold text-primary/80 mr-1">{msg.replyTo.sender?.username}</span>
                        {msg.replyTo.content || '📎 Attachment'}
                      </div>
                    )}

                    {/* Bubble + action buttons */}
                    <div className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Bubble */}
                      <div className={`p-3 rounded-2xl max-w-sm ${isMe ? 'bg-primary/20 border border-primary/30 rounded-br-sm glow-border' : 'bg-surface-light border border-border rounded-bl-sm'} ${isDeleted ? 'opacity-40 italic' : ''}`}>
                        {msg.content && <p className="text-sm whitespace-pre-wrap text-text">{msg.content}</p>}
                        {msg.attachmentUrl && !isDeleted && (
                          <div className="mt-2">
                            {msg.attachmentType?.startsWith('image/') ? (
                              <motion.img layoutId={`img-${msg.id}`} onClick={() => setBigImage(api(msg.attachmentUrl))}
                                src={api(msg.attachmentUrl)} alt="attachment"
 className="max-w-xs max-h-64 object-cover rounded-lg border border-border cursor-zoom-in" />
                            ) : (
                              <div className="flex items-center gap-3 p-3 bg-surface-light border border-border rounded-xl max-w-sm mt-1">
                                <div className="p-2 bg-primary/20 rounded-lg"><File className="w-6 h-6 text-primary" /></div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-sm text-text truncate font-medium">{msg.attachmentUrl.split('/').pop()?.split('_').slice(1).join('_') || 'Document'}</span>
                                  <span className="text-xs text-text-muted uppercase">{msg.attachmentType?.split('/')[1] || 'FILE'}</span>
                                </div>
                                <a href={api(msg.attachmentUrl)} download target="_blank" rel="noreferrer" className="ml-auto p-2 bg-primary/10 hover:bg-primary/30 rounded-lg transition-colors text-primary"><Download className="w-4 h-4" /></a>
                              </div>
                            )}
                          </div>
                        )}
      </div>

                      {/* Hover action buttons */}
                      {!isDeleted && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Emoji picker */}
                          <div className="relative" data-menu>
                            <button onClick={e => { e.stopPropagation(); setEmojiId(emojiId === msg.id ? null : msg.id); setMenuId(null); }}
                              className="p-1.5 rounded-lg bg-surface-light border border-border hover:bg-bg-hover text-text-muted hover:text-primary transition-colors">
             <SmilePlus className="w-3.5 h-3.5" />
                            </button>
                            {emojiId === msg.id && (
                              <div className={`absolute z-50 bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-surface border border-border rounded-xl p-2 shadow-2xl flex flex-wrap gap-1 w-48`} onClick={e => e.stopPropagation()}>
                                {EMOJIS.map(em => (
                                  <button key={em} onClick={() => react(msg.id, em)} className="text-lg hover:scale-125 transition-transform p-0.5 rounded hover:bg-bg-hover">{em}</button>
                         ))}
                              </div>
                            )}
                          </div>
                          {/* Reply */}
                          <button onClick={e => { e.stopPropagation(); setReplyTo(msg); }}
                            className="p-1.5 rounded-lg bg-surface-light border border-border hover:bg-bg-hover text-text-muted hover:text-primary transition-colors">
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {/* Three dots */}
                          {isMe && (
                            <div className="relative" data-menu>
                              <button onClick={e => { e.stopPropagation(); setMenuId(menuId === msg.id ? null : msg.id); setEmojiId(null); }}
                                className="p-1.5 rounded-lg bg-surface-light border border-border hover:bg-bg-hover text-text-muted hover:text-primary transition-colors">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {menuId === msg.id && (
                                <div className={`absolute z-50 bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} bg-surface border border-border rounded-xl shadow-2xl overflow-hidden min-w-[130px]`} onClick={e => e.stopPropagation()}>
                                  {canEdit && (
                                    <button onClick={() => startEdit(msg)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bg-hover text-text transition-colors">
                                      <Pencil className="w-3.5 h-3.5 text-primary" /> Edit
                                    </button>
        )}
                                  <button onClick={() => deleteMsg(msg.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 text-red-400 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
            {Object.keys(rx).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(rx).map(([em, users]) => (
                          <button key={em} onClick={() => react(msg.id, em)}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${users.includes(user.username) ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-surface-light border-border text-text-muted hover:bg-bg-hover'}`}>
                        {em}<span className="text-[10px]">{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {channel === 'taskis-bot' ? (
        <div className="p-4 glass border-t border-border text-center text-xs font-bold tracking-widest text-text-muted uppercase">SYSTEM CHANNEL (READ-ONLY)</div>
      ) : (
        <div className="p-4 glass border-t border-border space-y-2">
          {/* Reply banner */}
          {replyTo && (
          <div className="flex items-center justify-between px-3 py-2 bg-surface-light border border-primary/30 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-text-muted">
                <Reply className="w-3.5 h-3.5 text-primary" />
                <span>Replying to <span className="text-primary font-bold">{replyTo.sender?.username}</span></span>
                <span className="truncate max-w-[200px] opacity-60">{replyTo.content}</span>
          </div>
              <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          {/* Edit inline */}
          {editMsg && (
            <form onSubmit={submitEdit} className="flex items-center gap-2">
              <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                className="flex-1 bg-surface-light border border-primary/50 rounded-xl py-2 px-3 text-sm text-text focus:outline-none" />
              <button type="submit" className="px-3 py-2 bg-primary/20 text-primary border border-primary/50 rounded-xl text-xs font-bold hover:bg-primary/30 transition-colors">Save</button>
              <button type="button" onClick={() => setEditMsg(null)} className="px-3 py-2 border border-border rounded-xl text-xs text-text-muted hover:bg-bg-hover transition-colors">Cancel</button>
            </form>
          )}
          {/* File preview */}
          {file && (
            <div className="flex items-center justify-between p-2 bg-surface-light border border-primary/30 rounded-lg text-sm text-primary">
              <div className="flex items-center gap-2"><File className="w-4 h-4" />{file.name}</div>
              <button onClick={() => setFile(null)} className="text-red-400 text-xs hover:underline">Remove</button>
            </div>
          )}
          {/* Send form */}
          {!editMsg && (
            <form onSubmit={send} className="flex items-center gap-2">
              <label className="p-3 text-text-muted hover:text-primary transition-colors cursor-pointer bg-surface-light rounded-xl border border-border hover:border-primary/50">
                <Paperclip className="w-5 h-5" />
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder="Transmit secure message..."
                className="flex-1 bg-surface-light border border-border rounded-xl py-3 px-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all" />
              <button type="submit" disabled={(!input.trim() && !file) || uploading}
                className="p-3 bg-primary/20 text-primary border border-primary/50 rounded-xl hover:bg-primary/30 hover:shadow-[0_0_15px_rgba(0,255,204,0.4)] transition-all disabled:opacity-50">
                {uploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Unlock modal */}
      {showUnlock && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
<div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
            <h3 className="text-red-500 font-bold uppercase tracking-widest text-lg mb-2">RESTRICTED ARCHIVE</h3>
            <p className="text-text-muted text-sm mb-6">Access to messages older than 48 hours requires clearance.<br /><br /><span className="text-red-400 font-bold uppercase">Warning:</span> 2 incorrect attempts will result in permanent lock-out.</p>
            <form onSubmit={unlock}>
              <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="Enter Passphrase" autoFocus
                className="w-full bg-surface-light border border-border rounded-xl py-3 px-4 text-text placeholder-text-muted focus:outline-none focus:border-red-500 transition-colors mb-2" />
              {unlockErr && <p className="text-red-500 text-xs font-bold mb-4">{unlockErr}</p>}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowUnlock(false)} className="flex-1 py-2 rounded-xl border border-border text-text hover:bg-bg-hover transition-colors">Abort</button>
                <button type="submit" className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold uppercase tracking-widest">Unlock</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Image lightbox */}
      {typeof document !== 'undefined' && createPortal(
 <AnimatePresence>
          {bigImage && (
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBigImage(null)}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out">
              <motion.img src={bigImage} alt="" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl glow-border" />
            </motion.div>
          )}
        </AnimatePresence>, document.body
      )}
    </div>
  );
}
