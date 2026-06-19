'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, FileText, Download, Lock, Menu, X, AlertCircle, MessageSquare, MoreVertical, Reply, Pencil, Trash2, SmilePlus, CheckCheck, Search, Pin, Bookmark, BookmarkCheck, Mic, Square, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor, displayOf } from './Sidebar';
import { subscribe, publish } from '@/lib/ws';
import EmojiGifPicker from './EmojiGifPicker';
import { useToast } from './Toast';

interface ChatAreaProps { user: any; channel: string; onToggleSidebar: () => void; }

const api = (path: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${path}`;
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const { confirm, toast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
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
  const [members, setMembers] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSel, setMentionSel] = useState(0);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [savedActive, setSavedActive] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [showComposerPicker, setShowComposerPicker] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const lastTyping = useRef(0);
  const boundaryRef = useRef(0);
  const nextTemp = useRef(0);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isBot = channel === 'taskis-bot';
  const isDm = channel.startsWith('dm_');
  const isChannel = !isBot && !isDm;
  const headerTitle = isBot ? 'Taskis Bot' : isDm ? 'Direct message' : channel;
  const headerSub = isBot ? 'Automated · read-only' : 'End-to-end encrypted';

  const fetchMsgs = () =>
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then(setMessages).catch(() => {});

  // Roster for @mention autocomplete. (Notifications are handled globally by NotificationManager.)
  useEffect(() => {
    fetch(api('/api/chat/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then((d) => Array.isArray(d) && setMembers(d)).catch(() => {});
  }, []);

  const savedKey = `saved_${user.username}`;
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(savedKey) || '[]');
      setSavedIds(new Set(arr));
    } catch { /* noop */ }
  }, [savedKey]);

  const toggleSave = (id: number) => {
    setMenuId(null);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(savedKey, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  const togglePin = async (id: number) => {
    setMenuId(null);
    await fetch(api(`/api/chat/messages/${id}/pin`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchMsgs();
  };

  const scrollToMessage = (id: number) => {
    // Clear any active filter so the target is actually rendered, then scroll + flash.
    setPinnedOpen(false);
    setShowSearch(false);
    setSearch('');
    setSavedActive(false);
    setHighlightId(id);
    setTimeout(() => {
      document.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1700);
  };

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: 3, padding: '0 1px' }}>{p}</mark>
        : <span key={i}>{p}</span>,
    );
  };

  const markChannelSeen = () => {
    try {
      const seen = JSON.parse(localStorage.getItem('seenAt') || '{}');
      seen[channel] = Date.now();
      localStorage.setItem('seenAt', JSON.stringify(seen));
    } catch { /* noop */ }
  };

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setNewCount(0);
    setTypingUsers([]);
    nearBottomRef.current = true;
    prevLenRef.current = 0;
    try {
      const seen = JSON.parse(localStorage.getItem('seenAt') || '{}');
      boundaryRef.current = seen[channel] || 0;
    } catch { boundaryRef.current = 0; }
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => { if (r.status === 401 || r.status === 403) { localStorage.clear(); window.location.href = '/'; } return r.json(); })
      .then((d) => { setMessages(d); setLoading(false); markChannelSeen(); })
      .catch(() => setLoading(false));
  }, [channel]);

  useEffect(() => {
    const upsert = (incoming: any) => {
      if (!incoming || incoming.id == null) return;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === incoming.id);
        if (i === -1) {
          if (incoming.sender?.username !== user.username && !document.hidden) markChannelSeen();
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
    return () => { offMsg(); offTyping(); };
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

  const pickFile = (f: File | null) => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(f);
    setFilePreview(f && (f.type.startsWith('image/') || f.type.startsWith('audio/')) ? URL.createObjectURL(f) : null);
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const type = mr.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        pickFile(new File([blob], `voice-note.${ext}`, { type }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      alert('Microphone access is required to record a voice note.');
    }
  };

  const stopRec = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
    mediaRecRef.current?.stop();
  };

  const cancelRec = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
    const mr = mediaRecRef.current;
    if (mr) { mr.onstop = null; mr.stop(); }
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
  };

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    setProgress(0);
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const uploadWithProgress = (f: File): Promise<{ url: string; type: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', api('/api/chat/upload'));
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Bad response')); }
        } else reject(new Error(xhr.responseText || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      const fd = new FormData();
      fd.append('file', f);
      xhr.send(fd);
    });

  const deliver = async (payload: any, tempId: string) => {
    try {
      const r = await fetch(api('/api/chat/send'), { method: 'POST', headers: authH(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      const saved = await r.json();
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === saved.id);
        return prev.flatMap((m) => (m.id === tempId ? (exists ? [] : [saved]) : [m]));
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _sending: false, _failed: true } : m)));
      toast('Message failed to send', 'error');
    }
  };

  const retrySend = (m: any) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, _sending: true, _failed: false } : x)));
    deliver({ content: m.content, channel, attachmentUrl: m.attachmentUrl, attachmentType: m.attachmentType, replyToId: m.replyTo?.id ?? null }, m.id);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    const text = input;
    const replySnapshot = replyTo;

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    if (file) {
      setUploading(true);
      setProgress(0);
      try {
        const d = await uploadWithProgress(file);
        attachmentUrl = d.url;
        attachmentType = d.type;
      } catch {
        toast('Upload failed — try again', 'error');
        setUploading(false);
        return; // keep the staged file so the user can retry
      }
      setUploading(false);
      clearFile();
    }

    // Optimistic: show the message instantly, reconcile with the server copy.
    const tempId = `temp-${nextTemp.current++}`;
    const optimistic = {
      id: tempId, sender: user, content: text, channel,
      attachmentUrl, attachmentType, replyTo: replySnapshot,
      timestamp: new Date().toISOString(), _sending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setReplyTo(null);
    nearBottomRef.current = true;
    if (taRef.current) taRef.current.style.height = 'auto';

    deliver({ content: text, channel, attachmentUrl, attachmentType, replyToId: replySnapshot?.id ?? null }, tempId);
  };

  const react = async (msgId: number, emoji: string) => {
    setEmojiId(null);
    await fetch(api(`/api/chat/messages/${msgId}/react`), { method: 'POST', headers: authH(), body: JSON.stringify({ emoji }) });
    fetchMsgs();
  };

  const deleteMsg = async (id: number) => {
    setMenuId(null);
    if (!(await confirm({ title: 'Delete message?', body: 'This removes it for everyone in the conversation.', confirmText: 'Delete', danger: true }))) return;
    await fetch(api(`/api/chat/messages/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchMsgs();
  };

  const startEdit = (msg: any) => { setMenuId(null); setEditMsg(msg); setEditVal(msg.content); setTimeout(() => editRef.current?.focus(), 50); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch(api(`/api/chat/messages/${editMsg.id}`), { method: 'PUT', headers: authH(), body: JSON.stringify({ content: editVal }) });
    if (!r.ok) { toast((await r.text()) || 'Could not edit', 'error'); return; }
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

  const renderContent = (text: string) =>
    text.split(/(https?:\/\/[^\s]+|@\w+)/g).map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-accent-text break-all hover:opacity-80">{part}</a>;
      }
      if (/^@\w+$/.test(part)) {
        const name = part.slice(1);
        const known = members.some((m) => m.username?.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === user.username.toLowerCase();
        if (!known) return <span key={i}>{part}</span>;
        const isMe = name.toLowerCase() === user.username.toLowerCase();
        return (
          <span key={i} className="font-medium" style={{ color: 'var(--accent-text)', background: isMe ? 'var(--accent-soft)' : 'transparent', borderRadius: 4, padding: isMe ? '0 3px' : 0 }}>{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });

  const detectMention = (val: string, pos: number) => {
    const upto = val.slice(0, pos);
    const m = upto.match(/(?:^|\s)@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
    setMentionSel(0);
  };

  const insertMention = (username: string) => {
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? input.length;
    const upto = input.slice(0, pos).replace(/(^|\s)@(\w*)$/, `$1@${username} `);
    const next = upto + input.slice(pos);
    setInput(next);
    setMentionQuery(null);
    setTimeout(() => {
      if (ta) { ta.focus(); ta.setSelectionRange(upto.length, upto.length); autoGrow(); }
    }, 0);
  };

  const autoGrow = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`; }
  };

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSel((s) => Math.min(s + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSel((s) => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionMatches[mentionSel].username); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); }
  };

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current > 1800) { lastTyping.current = now; publish('/app/chat.typing', { channel }); }
  };

  const insertEmoji = (e: string) => {
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? input.length;
    const next = input.slice(0, pos) + e + input.slice(pos);
    setInput(next);
    setTimeout(() => { if (ta) { ta.focus(); const c = pos + e.length; ta.setSelectionRange(c, c); autoGrow(); } }, 0);
  };

  const sendGif = async (url: string) => {
    setShowComposerPicker(false);
    await fetch(api('/api/chat/send'), {
      method: 'POST',
      headers: authH(),
      body: JSON.stringify({ content: '', channel, attachmentUrl: url, attachmentType: 'image/gif', replyToId: replyTo?.id ?? null }),
    });
    setReplyTo(null);
    nearBottomRef.current = true;
    fetchMsgs();
  };

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing…`
    : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
      : 'Several people are typing…';

  const mentionMatches = mentionQuery === null ? [] : members
    .filter((m) => m.username && m.username !== 'Taskis Bot' && m.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    .slice(0, 6);

  const firstUnreadId = (() => {
    const b = boundaryRef.current;
    if (!b || !messages.length) return null;
    const m = messages.find((mm) => new Date(mm.timestamp).getTime() > b && mm.sender?.username !== user.username);
    return m ? m.id : null;
  })();

  const searchActive = showSearch && search.trim().length > 0;
  const pinnedMsgs = messages.filter((m) => m.pinned && !m.deleted);
  const view = searchActive
    ? messages.filter((m) => (m.content || '').toLowerCase().includes(search.trim().toLowerCase()))
    : savedActive
      ? messages.filter((m) => savedIds.has(m.id))
      : messages;
  const filtering = searchActive || savedActive;

  const Attachment = ({ msg, mine }: { msg: any; mine: boolean }) => {
    if (!msg.attachmentUrl) return null;
    const full = msg.attachmentUrl.startsWith('http') ? msg.attachmentUrl : api(msg.attachmentUrl);
    if (msg.attachmentType?.startsWith('image/')) {
      return (
        <button onClick={() => setBigImage(full)} className="block w-[282px] max-w-full rounded-[14px] overflow-hidden border border-border cursor-zoom-in hover:border-border-strong transition-colors p-0 bg-transparent mt-1.5">
          <img src={full} alt="attachment" className="w-full max-h-[260px] object-cover block" />
        </button>
      );
    }
    if (msg.attachmentType?.startsWith('audio/')) {
      return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border w-[282px] max-w-full mt-1.5" style={{ background: mine ? 'var(--bubble-own)' : 'var(--surface-2)' }}>
          <span className="w-[30px] h-[30px] rounded-full bg-accent-soft text-accent-text grid place-items-center flex-none"><Mic className="w-[15px] h-[15px]" /></span>
          <audio controls src={full} className="flex-1 min-w-0 h-9" style={{ maxWidth: 210 }} />
        </div>
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

        <div className="flex items-center gap-1.5 flex-none">
          {showSearch && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="tk-input hidden sm:block"
              style={{ width: 190, padding: '7px 12px', fontSize: 13 }}
            />
          )}
          <button onClick={() => { setShowSearch((s) => !s); setSearch(''); setSavedActive(false); }} className="icon-btn w-8 h-8" title="Search">
            <Search className="w-[15px] h-[15px]" />
          </button>

          <div className="relative" data-menu>
            <button onClick={(e) => { e.stopPropagation(); setPinnedOpen((o) => !o); }} className="icon-btn w-8 h-8 relative" title="Pinned messages">
              <Pin className="w-[15px] h-[15px]" />
              {pinnedMsgs.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-accent text-on-accent text-[9px] font-bold grid place-items-center">{pinnedMsgs.length}</span>
              )}
            </button>
            {pinnedOpen && (
              <div className="card absolute right-0 top-full mt-2 w-[300px] max-h-[340px] overflow-y-auto scroll z-50 py-1" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }} onClick={(e) => e.stopPropagation()}>
                <div className="eyebrow px-3 py-2">Pinned</div>
                {pinnedMsgs.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-t3">No pinned messages yet.</div>
                ) : pinnedMsgs.map((m) => (
                  <button key={m.id} onClick={() => scrollToMessage(m.id)} className="w-full text-left px-3 py-2 hover:bg-hover transition-colors">
                    <div className="text-[12px] font-semibold text-t1">{m.sender?.username}</div>
                    <div className="text-[12.5px] text-t2 truncate">{m.content || 'Attachment'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setSavedActive((a) => !a); setShowSearch(false); setSearch(''); }} className="icon-btn w-8 h-8" title="Saved messages" style={savedActive ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-line)' } : undefined}>
            {savedActive ? <BookmarkCheck className="w-[15px] h-[15px]" /> : <Bookmark className="w-[15px] h-[15px]" />}
          </button>
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
        ) : view.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-5 gap-3.5">
            <div className="w-[54px] h-[54px] rounded-[14px] bg-surface-2 border border-border grid place-items-center text-t3">
              {filtering ? <Search className="w-[22px] h-[22px]" /> : <MessageSquare className="w-[22px] h-[22px]" />}
            </div>
            <div>
              <div className="text-base font-semibold text-t1">{searchActive ? 'No matches' : savedActive ? 'No saved messages' : 'No messages yet'}</div>
              <div className="text-[13.5px] text-t2 mt-1 max-w-[300px] leading-relaxed">
                {searchActive
                  ? `Nothing in this channel matches “${search.trim()}”.`
                  : savedActive
                    ? 'Save messages from their menu to find them here.'
                    : `Start the conversation. Every message in ${isChannel ? `#${channel}` : 'this thread'} is end-to-end encrypted.`}
              </div>
            </div>
          </div>
        ) : (
          view.map((msg, idx) => {
            const isMe = msg.sender?.username === user.username;
            const showDivider = idx === 0 || !sameDay(msg.timestamp, view[idx - 1].timestamp);
            const prev = idx > 0 ? view[idx - 1] : null;
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
                {msg.id === firstUnreadId && (
                  <div className="flex items-center gap-3 my-[14px]">
                    <div className="flex-1 h-px" style={{ background: 'var(--accent-line)' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-text">New messages</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--accent-line)' }} />
                  </div>
                )}

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-mid={msg.id} className={`group flex gap-[11px] ${grouped ? 'mt-0.5' : 'mt-3.5'} ${isMe ? 'flex-row-reverse' : ''} transition-colors duration-500 rounded-xl`} style={highlightId === msg.id ? { background: 'var(--accent-soft)' } : undefined}>
                  {/* avatar (others only; hidden when grouped but space preserved) */}
                  {!isMe && (
                    grouped ? (
                      <span className="w-7 flex-none" />
                    ) : (
                      <span className="relative overflow-hidden w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white mt-5" style={{ background: src ? 'transparent' : toneFor(msg.sender?.username || '?') }}>
                        {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(msg.sender?.username || '?')}
                      </span>
                    )
                  )}

                  <div className={`min-w-0 max-w-[76%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* meta */}
                    {!grouped && (
                      <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[13px] font-semibold text-t1">{isMe ? 'You' : displayOf(msg.sender)}</span>
                        <span className="text-[11px] text-t3">{fmt(msg.timestamp)}</span>
                        {msg.edited && !isDeleted && <span className="text-[11px] text-t3 italic">edited</span>}
                        {msg.pinned && <Pin className="w-[11px] h-[11px] text-accent-text" />}
                      </div>
                    )}

                    {/* reply preview (click to jump to original) */}
                    {msg.replyTo && (
                      <button
                        type="button"
                        onClick={() => scrollToMessage(msg.replyTo.id)}
                        className={`mb-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-l-2 text-xs text-t2 max-w-xs truncate text-left hover:text-t1 transition-colors ${isMe ? 'self-end' : 'self-start'}`}
                        style={{ borderColor: 'var(--accent-line)', background: 'var(--surface-2)' }}
                      >
                        <Reply className="w-3 h-3 flex-none text-accent-text" />
                        <span className="font-semibold text-accent-text">{displayOf(msg.replyTo.sender)}</span>
                        <span className="truncate opacity-80">{msg.replyTo.content || 'Attachment'}</span>
                      </button>
                    )}

                    {/* bubble + hover actions */}
                    <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div>
                        <div
                          className={`px-[13px] py-[9px] text-[14.5px] leading-relaxed border border-border whitespace-pre-wrap break-words ${isDeleted ? 'opacity-50 italic text-t2' : 'text-t1'}`}
                          style={{ background: isMe ? 'var(--bubble-own)' : 'var(--bubble-other)', borderRadius: isMe ? '15px 5px 15px 15px' : '5px 15px 15px 15px' }}
                        >
                          {msg.content && <span>{isDeleted ? msg.content : (searchActive ? highlight(msg.content, search.trim()) : renderContent(msg.content))}</span>}
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
                              <EmojiGifPicker reactMode align={isMe ? 'right' : 'left'} onEmoji={(em) => react(msg.id, em)} onClose={() => setEmojiId(null)} />
                            )}
                          </div>
                          {/* reply */}
                          <button onClick={(e) => { e.stopPropagation(); setReplyTo(msg); }} className={actionBtnCls} aria-label="Reply"><Reply className="w-[14px] h-[14px]" /></button>
                          {/* menu */}
                          <div className="relative" data-menu>
                            <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === msg.id ? null : msg.id); setEmojiId(null); }} className={actionBtnCls} aria-label="More"><MoreVertical className="w-[14px] h-[14px]" /></button>
                            {menuId === msg.id && (
                              <div className={`card absolute z-50 bottom-full mb-1.5 ${isMe ? 'right-0' : 'left-0'} overflow-hidden min-w-[152px] py-1`} style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }} onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => togglePin(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Pin className="w-[14px] h-[14px] text-t2" /> {msg.pinned ? 'Unpin' : 'Pin'}</button>
                                <button onClick={() => toggleSave(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors">{savedIds.has(msg.id) ? <BookmarkCheck className="w-[14px] h-[14px] text-accent-text" /> : <Bookmark className="w-[14px] h-[14px] text-t2" />} {savedIds.has(msg.id) ? 'Unsave' : 'Save'}</button>
                                {canEdit && (
                                  <button onClick={() => startEdit(msg)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Pencil className="w-[14px] h-[14px] text-t2" /> Edit</button>
                                )}
                                {isMe && (
                                  <button onClick={() => deleteMsg(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-danger hover:bg-danger-soft transition-colors"><Trash2 className="w-[14px] h-[14px]" /> Delete</button>
                                )}
                              </div>
                            )}
                          </div>
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

                    {/* delivery / read receipt (own) */}
                    {isMe && !isDeleted && (
                      <div className="flex items-center gap-1 mt-1 text-[10.5px]">
                        {msg._sending ? (
                          <span className="text-t3 italic">Sending…</span>
                        ) : msg._failed ? (
                          <button onClick={() => retrySend(msg)} className="text-danger hover:underline">Failed · retry</button>
                        ) : (
                          <span className="flex items-center gap-1 text-t3">
                            <CheckCheck className="w-3 h-3" style={readByOthers(msg) ? { color: 'var(--accent-text)' } : undefined} />
                            {readByOthers(msg) ? 'Seen' : 'Sent'}
                          </span>
                        )}
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
          ) : recording ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-border-strong bg-surface-2 p-2 px-3">
              <span className="w-2.5 h-2.5 rounded-full bg-danger flex-none" style={{ animation: 'tk-dot 1.2s infinite' }} />
              <span className="text-[13px] font-medium text-t1 tabular-nums">{fmtDur(recSeconds)}</span>
              <span className="text-[12px] text-t3 flex-1">Recording voice note…</span>
              <button type="button" onClick={cancelRec} className="icon-btn w-8 h-8" title="Cancel"><Trash2 className="w-[15px] h-[15px]" /></button>
              <button type="button" onClick={stopRec} className="btn-accent w-8 h-8 rounded-[10px]" title="Stop recording"><Square className="w-[14px] h-[14px]" /></button>
            </div>
          ) : (
            <>
              {file && (
                <div className="relative inline-flex items-center gap-3 p-2 pr-2.5 rounded-xl bg-surface-2 border border-border max-w-full overflow-hidden">
                  {file.type.startsWith('image/') && filePreview ? (
                    <img src={filePreview} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" />
                  ) : file.type.startsWith('audio/') && filePreview ? (
                    <span className="w-12 h-12 rounded-lg bg-accent-soft text-accent-text grid place-items-center flex-none"><Mic className="w-5 h-5" /></span>
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-surface-3 grid place-items-center text-t2 flex-none"><FileText className="w-5 h-5" /></span>
                  )}
                  <div className="min-w-0">
                    {file.type.startsWith('audio/') && filePreview ? (
                      <audio controls src={filePreview} className="h-8" style={{ maxWidth: 200 }} />
                    ) : (
                      <>
                        <div className="text-[13px] font-medium text-t1 truncate max-w-[220px]">{file.name}</div>
                        <div className="text-[11.5px] text-t3">{formatBytes(file.size)}</div>
                      </>
                    )}
                  </div>
                  {!uploading && (
                    <button type="button" onClick={clearFile} aria-label="Remove attachment" className="icon-btn w-6 h-6 border-0 ml-1"><X className="w-3.5 h-3.5" /></button>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-1.5" style={{ background: 'color-mix(in srgb, var(--bg) 72%, transparent)' }}>
                      <div className="text-[12px] font-semibold text-t1">{progress}%</div>
                      <div className="w-3/4 h-1 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <form onSubmit={send} className="relative flex items-center gap-1.5 rounded-[14px] border border-border-strong bg-surface-2 p-1.5">
                {mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className="card absolute bottom-full mb-2 left-0 w-[240px] py-1 z-50" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
                    {mentionMatches.map((m, i) => (
                      <button
                        type="button"
                        key={m.id ?? m.username}
                        onMouseDown={(e) => { e.preventDefault(); insertMention(m.username); }}
                        onMouseEnter={() => setMentionSel(i)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${i === mentionSel ? 'bg-hover' : ''}`}
                      >
                        <span className="w-6 h-6 rounded-full grid place-items-center flex-none text-[10px] font-semibold text-white" style={{ background: toneFor(m.username) }}>{initials(m.username)}</span>
                        <span className="text-[13px] text-t1">{m.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                <label className="icon-btn w-[34px] h-[34px] border-0 cursor-pointer">
                  <Paperclip className="w-[18px] h-[18px]" />
                  <input type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
                </label>
                <button type="button" onClick={startRec} className="icon-btn w-[34px] h-[34px] border-0" title="Record voice note"><Mic className="w-[18px] h-[18px]" /></button>
                <div className="relative" data-menu>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setShowComposerPicker((s) => !s); }} className="icon-btn w-[34px] h-[34px] border-0" title="Emoji & GIFs"><Smile className="w-[18px] h-[18px]" /></button>
                  {showComposerPicker && (
                    <EmojiGifPicker onEmoji={insertEmoji} onGif={sendGif} onClose={() => setShowComposerPicker(false)} />
                  )}
                </div>
                <textarea ref={taRef} rows={1} value={input} onChange={(e) => { setInput(e.target.value); autoGrow(); notifyTyping(); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); }} onKeyDown={onComposerKey} placeholder={`Message ${isChannel ? '#' + channel : headerTitle}`} className="scroll flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-[14.5px] leading-relaxed text-t1 px-1 py-2 max-h-[140px]" />
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
