'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, FileText, Download, Lock, Menu, X, AlertCircle, MessageSquare, MoreVertical, Reply, Pencil, Trash2, SmilePlus, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor } from './Sidebar';
import { subscribe, publish } from '@/lib/ws';

interface ChatAreaProps { user: any; channel: string; onToggleSidebar: () => void; }

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '🎉', '👀', '💯', '✅', '🙏'];
const api = (path: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${path}`;
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const unreadRef = useRef(0);
  const lastTyping = useRef(0);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isBot = channel === 'taskis-bot';
  const isDm = channel.startsWith('dm_');
  const isChannel = !isBot && !isDm;
  const headerTitle = isBot ? 'Taskis Bot' : isDm ? 'Direct message' : channel;
  const headerSub = isBot ? 'Automated · read-only' : 'End-to-end encrypted';

  const fetchMsgs = () =>
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then(setMessages).catch(() => {});

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setNewCount(0);
    setTypingUsers([]);
    nearBottomRef.current = true;
    prevLenRef.current = 0;
    unreadRef.current = 0;
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => { if (r.status === 401 || r.status === 403) { localStorage.clear(); window.location.href = '/'; } return r.json(); })
      .then((d) => { setMessages(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [channel]);

  useEffect(() => {
    const upsert = (incoming: any) => {
      if (!incoming || incoming.id == null) return;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === incoming.id);
        if (i === -1) {
          if (document.hidden) { unreadRef.current += 1; document.title = `(${unreadRef.current}) Taskis`; }
          return [...prev, incoming];
        }
        const copy = prev.slice();
        copy[i] = incoming;
        return copy;
      });
    };
    const offMsg = subscribe(`/topic/${channel}`, upsert);
    const offTyping = subscribe(`/topic/${channel}.typing`, (e: any) => {
      if (!e || !e.username || e.username === user.username) return;
      setTypingUsers((prev) => (prev.includes(e.username) ? prev : [...prev, e.username]));
      clearTimeout(typingTimers.current[e.username]);
      typingTimers.current[e.username] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== e.username));
      }, 3500);
    });
    const onFocus = () => { unreadRef.current = 0; document.title = 'Taskis'; };
    window.addEventListener('focus', onFocus);
    return () => { offMsg(); offTyping(); window.removeEventListener('focus', onFocus); };
  }, [channel, user.username]);

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.sender?.username === user.username) return;
      const read = (msg.readBy || '').split(',').map((s: string) => s.trim());
      if (!read.includes(user.username))
        fetch(api(`/api/chat/messages/${msg.id}/read`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
    });
  }, [messages]);

  useEffect(() => {
    const grew = messages.length - prevLenRef.current;
    prevLenRef.current = messages.length;
    if (grew <= 0) return;
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    } else {
      setNewCount((c) => c + grew);
    }
  }, [messages.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 120;
    if (nearBottomRef.current && newCount) setNewCount(0);
  };

  const jumpToLatest = () => {
    nearBottomRef.current = true;
    setNewCount(0);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    let attachmentUrl = null;
    let attachmentType = null;
    if (file) {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await fetch(api('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
        if (!r.ok) throw new Error(await r.text());
        const d = await r.json();
        attachmentUrl = d.url;
        attachmentType = d.type;
      } catch (err) { console.error('Upload failed', err); }
      setUploading(false);
      setFile(null);
    }
    await fetch(api('/api/chat/send'), { method: 'POST', headers: authH(), body: JSON.stringify({ content: input, channel, attachmentUrl, attachmentType, replyToId: replyTo?.id ?? null }) });
    setInput('');
    setReplyTo(null);
    nearBottomRef.current = true;
    if (taRef.current) taRef.current.style.height = 'auto';
    fetchMsgs();
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
    setEditMsg(null);
    fetchMsgs();
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockLoading(true);
    const r = await fetch(api('/api/chat/unlock-archive'), { method: 'POST', headers: authH(), body: JSON.stringify({ passphrase }) });
    if (r.ok) { setShowUnlock(false); setPassphrase(''); setUnlockErr(''); fetchMsgs(); }
    else setUnlockErr(await r.text());
    setUnlockLoading(false);
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
  const readByOthers = (msg: any) => (msg.readBy || '').split(',').map((s: string) => s.trim()).some((u: string) => u && u !== user.username);

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

  const dividerLabel = (ds: string) => {
    const d = new Date(ds), t = new Date(), y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  };

  const fileNameOf = (url: string) => url.split('/').pop()?.split('_').slice(1).join('_') || 'Document';

  const linkify = (text: string) =>
    text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all hover:opacity-80">{part}</a>
        : <span key={i}>{part}</span>,
    );

  const autoGrow = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`; }
  };

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); }
  };

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current > 1800) { lastTyping.current = now; publish('/app/chat.typing', { channel }); }
  };

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing…`
    : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
      : 'Several people are typing…';

  const Attachment = ({ msg, mine }: { msg: any; mine: boolean }) => {
    if (!msg.attachmentUrl) return null;
    const full = api(msg.attachmentUrl);
    if (msg.attachmentType?.startsWith('image/')) {
      return (
        <button onClick={() => setBigImage(full)} className="block w-[282px] max-w-full rounded-[14px] overflow-hidden border border-border cursor-zoom-in hover:border-border-strong transition-colors p-0 bg-transparent mt-1.5">
          <img src={full} alt="attachment" className="w-full max-h-[260px] object-cover block" />
        </button>
      );
    }
    return (
      <div className="flex items-center gap-[11px] px-3 py-2.5 rounded-xl border border-border w-[264px] max-w-full mt-1.5" style={{ background: mine ? 'var(--bubble-own)' : 'var(--surface-2)' }}>
        <span className="w-[34px] h-[34px] rounded-lg bg-surface-3 grid place-items-center flex-none text-t2"><FileText className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-t1 truncate">{fileNameOf(msg.attachmentUrl)}</div>
          <div className="text-xs text-t3 uppercase">{msg.attachmentType?.split('/')[1] || 'file'}</div>
        </div>
        <a href={full} download target="_blank" rel="noreferrer" className="icon-btn w-[30px] h-[30px] border-0" aria-label="Download"><Download className="w-[15px] h-[15px]" /></a>
      </div>
    );
  };

  const actionBtnCls = 'w-[26px] h-[26px] grid place-items-center rounded-lg bg-surface-2 border border-border text-t2 hover:text-t1 hover:border-border-strong transition-colors cursor-pointer';

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
        <button onClick={onToggleSidebar} className="icon-btn w-8 h-8 lg:hidden" aria-label="Toggle sidebar"><Menu className="w-[15px] h-[15px]" /></button>
        {isChannel && <span className="text-[22px] font-medium text-t3 leading-none">#</span>}
        {isBot && <span className="w-[30px] h-[30px] rounded-lg bg-accent-soft text-accent-text text-[13px] font-bold grid place-items-center flex-none">TB</span>}
        {isDm && <span className="w-[30px] h-[30px] rounded-full grid place-items-center flex-none text-xs font-semibold text-white" style={{ background: toneFor(channel) }}>{initials(headerTitle)}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold text-t1 leading-tight truncate">{headerTitle}</div>
          <div className="flex items-center gap-1.5 text-xs text-t2 mt-px"><Lock className="w-[11px] h-[11px]" />{headerSub}</div>
        </div>
      </header>

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="scroll flex-1 overflow-y-auto px-[22px] pt-4 pb-2">
        {!loading && messages.length > 0 && (
          <button onClick={() => { setUnlockErr(''); setShowUnlock(true); }} className="flex items-center justify-center gap-2 mx-auto mb-2 px-3.5 py-1.5 rounded-full bg-surface-2 border border-border text-[12px] text-t2 hover:text-t1 hover:border-border-strong transition-colors">
            <Lock className="w-[12px] h-[12px]" />Older history is sealed · <span className="text-accent-text font-medium">unlock archive</span>
          </button>
        )}

        {loading ? (
          <div className="flex flex-col gap-[22px] pt-2">
            {[60, 80, 50, 70].map((w, i) => (
              <div key={i} className="flex gap-[11px]">
                <span className="w-7 h-7 rounded-full bg-surface-2 flex-none" />
                <div className="flex flex-col gap-[7px]">
                  <span className="w-[90px] h-[9px] rounded bg-surface-2" />
                  <span className="h-[13px] rounded-md bg-surface-2" style={{ width: `${w}%`, minWidth: 120 }} />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-5 gap-3.5">
            <div className="w-[54px] h-[54px] rounded-[14px] bg-surface-2 border border-border grid place-items-center text-t3"><MessageSquare className="w-[22px] h-[22px]" /></div>
            <div>
              <div className="text-base font-semibold text-t1">No messages yet</div>
              <div className="text-[13.5px] text-t2 mt-1 max-w-[300px] leading-relaxed">Start the conversation. Every message in {isChannel ? `#${channel}` : 'this thread'} is end-to-end encrypted.</div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender?.username === user.username;
            const showDivider = idx === 0 || !sameDay(msg.timestamp, messages[idx - 1].timestamp);
            const prev = idx > 0 ? messages[idx - 1] : null;
            const grouped = !!prev && !showDivider && prev.sender?.username === msg.sender?.username
              && (new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5 * 60 * 1000;
            const rx = parseRx(msg.reactions);
            const isDeleted = !!msg.deleted;
            const canEdit = isMe && !isDeleted && !readByOthers(msg);
            const src = msg.sender?.avatarUrl ? (msg.sender.avatarUrl.startsWith('http') ? msg.sender.avatarUrl : api(msg.sender.avatarUrl)) : null;

            return (
              <React.Fragment key={msg.id || idx}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-[18px]">
                    <div className="flex-1 h-px bg-border" />
                    <span className="eyebrow" style={{ letterSpacing: '0.04em' }}>{dividerLabel(msg.timestamp)}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`group flex gap-[11px] ${grouped ? 'mt-0.5' : 'mt-3.5'} ${isMe ? 'flex-row-reverse' : ''}`}>
                  {/* avatar (others only; hidden when grouped but space preserved) */}
                  {!isMe && (
                    grouped ? (
                      <span className="w-7 flex-none" />
                    ) : (
                      <span className="w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white mt-5" style={{ background: src ? 'transparent' : toneFor(msg.sender?.username || '?') }}>
                        {src ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" /> : initials(msg.sender?.username || '?')}
                      </span>
                    )
                  )}

                  <div className={`min-w-0 max-w-[76%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* meta */}
                    {!grouped && (
                      <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[13px] font-semibold text-t1">{isMe ? 'You' : msg.sender?.username}</span>
                        <span className="text-[11px] text-t3">{fmt(msg.timestamp)}</span>
                        {msg.edited && !isDeleted && <span className="text-[11px] text-t3 italic">edited</span>}
                      </div>
                    )}

                    {/* reply preview */}
                    {msg.replyTo && (
                      <div className={`mb-1 px-2.5 py-1 rounded-lg border-l-2 text-xs text-t2 max-w-xs truncate ${isMe ? 'self-end' : 'self-start'}`} style={{ borderColor: 'var(--accent-line)', background: 'var(--surface-2)' }}>
                        <span className="font-semibold text-accent-text mr-1">{msg.replyTo.sender?.username}</span>
                        {msg.replyTo.content || 'Attachment'}
                      </div>
                    )}

                    {/* bubble + hover actions */}
                    <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div>
                        <div
                          className={`px-[13px] py-[9px] text-[14.5px] leading-relaxed border border-border whitespace-pre-wrap break-words ${isDeleted ? 'opacity-50 italic text-t2' : 'text-t1'}`}
                          style={{ background: isMe ? 'var(--bubble-own)' : 'var(--bubble-other)', borderRadius: isMe ? '15px 5px 15px 15px' : '5px 15px 15px 15px' }}
                        >
                          {msg.content && <span>{isDeleted ? msg.content : linkify(msg.content)}</span>}
                          {!isDeleted && <Attachment msg={msg} mine={isMe} />}
                        </div>
                      </div>

                      {!isDeleted && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* emoji */}
                          <div className="relative" data-menu>
                            <button onClick={(e) => { e.stopPropagation(); setEmojiId(emojiId === msg.id ? null : msg.id); setMenuId(null); }} className={actionBtnCls} aria-label="React">
                              <SmilePlus className="w-[14px] h-[14px]" />
                            </button>
                            {emojiId === msg.id && (
                              <div className={`card absolute z-50 bottom-full mb-1.5 ${isMe ? 'right-0' : 'left-0'} p-2 flex flex-wrap gap-1 w-[200px]`} style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }} onClick={(e) => e.stopPropagation()}>
                                {EMOJIS.map((em) => (
                                  <button key={em} onClick={() => react(msg.id, em)} className="text-lg hover:scale-125 transition-transform p-1 rounded-md hover:bg-hover">{em}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* reply */}
                          <button onClick={(e) => { e.stopPropagation(); setReplyTo(msg); }} className={actionBtnCls} aria-label="Reply"><Reply className="w-[14px] h-[14px]" /></button>
                          {/* menu (own) */}
                          {isMe && (
                            <div className="relative" data-menu>
                              <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === msg.id ? null : msg.id); setEmojiId(null); }} className={actionBtnCls} aria-label="More"><MoreVertical className="w-[14px] h-[14px]" /></button>
                              {menuId === msg.id && (
                                <div className={`card absolute z-50 bottom-full mb-1.5 ${isMe ? 'right-0' : 'left-0'} overflow-hidden min-w-[140px] py-1`} style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }} onClick={(e) => e.stopPropagation()}>
                                  {canEdit && (
                                    <button onClick={() => startEdit(msg)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Pencil className="w-[14px] h-[14px] text-t2" /> Edit</button>
                                  )}
                                  <button onClick={() => deleteMsg(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-danger hover:bg-danger-soft transition-colors"><Trash2 className="w-[14px] h-[14px]" /> Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* reactions */}
                    {Object.keys(rx).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(rx).map(([em, users]) => {
                          const mineRx = users.includes(user.username);
                          return (
                            <button key={em} onClick={() => react(msg.id, em)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors" style={mineRx ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent-text)' } : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--t2)' }}>
                              {em}<span className="text-[10px]">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* read receipt (own) */}
                    {isMe && !isDeleted && (
                      <div className="flex items-center gap-1 mt-1 text-[10.5px] text-t3">
                        <CheckCheck className="w-3 h-3" style={readByOthers(msg) ? { color: 'var(--accent-text)' } : undefined} />
                        {readByOthers(msg) ? 'Seen' : 'Sent'}
                      </div>
                    )}
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* typing indicator */}
      {!isBot && typingUsers.length > 0 && (
        <div className="px-[22px] h-5 flex items-center gap-2 text-[12px] text-t3">
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite' }} />
            <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite 0.2s' }} />
            <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite 0.4s' }} />
          </span>
          {typingText}
        </div>
      )}

      {/* jump to latest */}
      {newCount > 0 && (
        <div className="px-[22px] flex justify-center pointer-events-none">
          <button onClick={jumpToLatest} className="pointer-events-auto -mt-1 mb-1 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent text-on-accent text-[12.5px] font-medium shadow-[var(--shadow-md)] hover:bg-accent-hover transition-colors">
            {newCount} new message{newCount > 1 ? 's' : ''}
            <span aria-hidden>↓</span>
          </button>
        </div>
      )}

      {/* composer / read-only */}
      {isBot ? (
        <div className="px-[22px] py-[17px] flex-none border-t border-border flex items-center justify-center gap-2 text-t3 text-[13px]">
          <Lock className="w-[14px] h-[14px]" />Taskis Bot is read-only — replies are automated.
        </div>
      ) : (
        <div className="px-[22px] pt-[13px] pb-[18px] flex-none border-t border-border space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs">
              <div className="flex items-center gap-2 text-t2 min-w-0">
                <Reply className="w-[14px] h-[14px] text-accent-text flex-none" />
                <span className="flex-none">Replying to <span className="text-accent-text font-semibold">{replyTo.sender?.username}</span></span>
                <span className="truncate opacity-70">{replyTo.content}</span>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-t3 hover:text-danger transition-colors flex-none"><X className="w-[14px] h-[14px]" /></button>
            </div>
          )}

          {editMsg ? (
            <form onSubmit={submitEdit} className="flex items-center gap-2">
              <input ref={editRef} value={editVal} onChange={(e) => setEditVal(e.target.value)} className="tk-input flex-1" />
              <button type="submit" className="btn-accent px-4 py-2.5 text-sm">Save</button>
              <button type="button" onClick={() => setEditMsg(null)} className="btn-secondary px-4 py-2.5 text-sm">Cancel</button>
            </form>
          ) : (
            <>
              {file && (
                <div className="px-3 py-2 rounded-lg bg-surface-2 border border-accent-soft flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-accent-text"><FileText className="w-4 h-4" /> {file.name}</div>
                  <button onClick={() => setFile(null)} className="text-danger text-xs hover:underline">Remove</button>
                </div>
              )}
              <form onSubmit={send} className="flex items-center gap-1.5 rounded-[14px] border border-border-strong bg-surface-2 p-1.5">
                <label className="icon-btn w-[34px] h-[34px] border-0 cursor-pointer">
                  <Paperclip className="w-[18px] h-[18px]" />
                  <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <textarea ref={taRef} rows={1} value={input} onChange={(e) => { setInput(e.target.value); autoGrow(); notifyTyping(); }} onKeyDown={onComposerKey} placeholder={`Message ${isChannel ? '#' + channel : headerTitle}`} className="scroll flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-[14.5px] leading-relaxed text-t1 px-1 py-2 max-h-[140px]" />
                <button type="submit" disabled={(!input.trim() && !file) || uploading} aria-label="Send" className="btn-accent w-[34px] h-[34px] rounded-[10px] flex-none">
                  {uploading ? <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Send className="w-[17px] h-[17px]" />}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* archive modal */}
      {showUnlock && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setShowUnlock(false)} className="fixed inset-0 z-[400] flex items-center justify-center p-6 tk-fade" style={{ background: 'rgba(7,7,9,0.62)', backdropFilter: 'blur(2px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="card tk-pop w-[398px] max-w-full p-7" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
            <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border-strong grid place-items-center text-t2 mb-4"><Lock className="w-5 h-5" /></div>
            <div className="eyebrow mb-[7px]" style={{ letterSpacing: '0.14em' }}>Restricted</div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">Open restricted archive</h2>
            <p className="text-[13.5px] leading-[1.55] text-t2 mb-5">
              Messages older than 48 hours are sealed. Enter the archive passphrase to unlock the full history.
              <br /><span className="text-danger font-medium">2 incorrect attempts will lock this account.</span>
            </p>
            <form onSubmit={unlock}>
              <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Archive passphrase" autoFocus className={`tk-input ${unlockErr ? 'is-error' : ''}`} />
              {unlockErr && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[12.5px] text-danger"><AlertCircle className="w-[13px] h-[13px] flex-none" /><span>{unlockErr}</span></div>
              )}
              <div className="flex gap-2.5 mt-[22px]">
                <button type="button" onClick={() => setShowUnlock(false)} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
                <button type="submit" disabled={unlockLoading} className="btn-accent flex-1 py-[11px] text-sm">
                  {unlockLoading && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />}<span>Unlock</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* lightbox */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {bigImage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBigImage(null)} className="fixed inset-0 z-[400] flex items-center justify-center p-12 cursor-zoom-out" style={{ background: 'rgba(0,0,0,0.86)' }}>
              <button onClick={() => setBigImage(null)} aria-label="Close" className="fixed top-[22px] right-[22px] w-[38px] h-[38px] grid place-items-center rounded-[10px] text-white cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}><X className="w-[18px] h-[18px]" /></button>
              <motion.img initial={{ scale: 0.97 }} animate={{ scale: 1 }} src={bigImage} alt="Full screen" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
