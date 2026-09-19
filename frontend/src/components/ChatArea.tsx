'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, FileText, Download, Lock, Menu, X, AlertCircle, MessageSquare, MoreVertical, Reply, Pencil, Trash2, SmilePlus, CheckCheck, Search, Pin, Bookmark, BookmarkCheck, Mic, Square, Smile, Copy, Eye, FolderUp, KeyRound, CircleCheck, Circle, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor, displayOf, avatarFor, ringFor, withFileToken } from './Sidebar';
import { subscribe, publish } from '@/lib/ws';
import EmojiGifPicker from './EmojiGifPicker';
import { useToast } from './Toast';
import { renderRich } from '@/lib/rich';
import LinkPreview, { firstUrl } from './LinkPreview';
import HoverCard from './HoverCard';
import VoiceNote from './VoiceNote';
import { copyToClipboard } from '@/lib/clipboard';
import { searchEmoji } from '@/lib/emoji';
import { useCustomEmojis } from '@/lib/customEmoji';
import { isMuted, toggleMute, playTick, playReaction } from '@/lib/notify';
import { Bell, BellOff, ArrowDown, Bold, Italic, Code, Link as LinkIcon, Strikethrough, Flag } from 'lucide-react';
import FilePreview, { PreviewAtt } from './FilePreview';
import ShareModal from './ShareModal';
import PollComposer from './PollComposer';
import { Share2, Dices, Coins, PartyPopper, Sparkles, Heart, AtSign, Zap } from 'lucide-react';
import { plainText } from '@/lib/rich';
import { confetti, emojiRain, runFunCommand, deservesConfetti, watchKonami, parseEffect } from '@/lib/fun';
import { markFeature } from '@/lib/features';
import { apiUrl as api } from '@/lib/api';

interface ChatAreaProps { user: any; channel: string; onToggleSidebar: () => void; }

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const { confirm, toast } = useToast();
  const { map: customMap } = useCustomEmojis();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<(string | null)[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [bigImage, setBigImage] = useState<string | null>(null);
  const [previewAtt, setPreviewAtt] = useState<PreviewAtt | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [topic, setTopic] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [confidUnlocked, setConfidUnlocked] = useState(true);
  const [passInput, setPassInput] = useState('');
  const [passErr, setPassErr] = useState(false);
  const [passMsg, setPassMsg] = useState('Incorrect passkey. Try again.');
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
  const [colonQuery, setColonQuery] = useState<string | null>(null);
  const [colonSel, setColonSel] = useState(0);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashSel, setSlashSel] = useState(0);
  const [heartId, setHeartId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [savedActive, setSavedActive] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [showComposerPicker, setShowComposerPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [muteVer, setMuteVer] = useState(0);
  const [farUp, setFarUp] = useState(false);
  const [threadRoot, setThreadRoot] = useState<any>(null);
  const [threadInput, setThreadInput] = useState('');
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
  const pendingInitial = useRef(true);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isBot = channel === 'taskis-bot';
  const isDm = channel.startsWith('dm_');
  const isSelfNotes = channel === `dm_${user.id}_${user.id}`;
  const isChannel = !isBot && !isDm;
  const dmPartner = isDm && !isSelfNotes
    ? (() => { const ids = channel.split('_').slice(1).map(Number); const pid = ids.find((id) => id !== user.id); return members.find((m) => m.id === pid) || null; })()
    : null;
  const dmPresence = dmPartner?.status === 'ACTIVE' ? 'Active now' : dmPartner?.status === 'AWAY' ? 'Away' : 'Offline';
  const headerTitle = isBot ? 'Taskis Bot' : isSelfNotes ? 'Notes' : isDm ? (dmPartner ? displayOf(dmPartner) : 'Direct message') : channel;
  const headerSub = isBot ? 'Automated · read-only' : isSelfNotes ? 'Your private space — only you can see this' : isDm && dmPartner ? dmPresence : 'End-to-end encrypted';

  const fetchMsgs = () =>
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then(setMessages).catch(() => {});

  // Roster for @mention autocomplete. (Notifications are handled globally by NotificationManager.)
  useEffect(() => {
    fetch(api('/api/chat/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json()).then((d) => Array.isArray(d) && setMembers(d)).catch(() => {});
  }, []);

  // #confidential gate — enforced server-side. The passkey lives ONLY on the
  // backend; here we just reflect whether this account has unlocked it.
  const [unlocking, setUnlocking] = useState(false);
  const confidUnlockedRef = useRef(!!user.confidentialUnlocked);
  useEffect(() => {
    setSelectMode(false);
    setSelected(new Set());
    setPassInput('');
    setPassErr(false);
    if (channel !== 'confidential') { setConfidUnlocked(true); return; }
    setConfidUnlocked(!!user.confidentialUnlocked || confidUnlockedRef.current);
  }, [channel, user.confidentialUnlocked]);

  const unlockConfidential = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setPassErr(false);
    try {
      const r = await fetch(api('/api/chat/unlock-confidential'), { method: 'POST', headers: authH(), body: JSON.stringify({ passphrase: passInput.trim() }) });
      if (r.ok) {
        confidUnlockedRef.current = true;
        setConfidUnlocked(true);
        setPassInput('');
        markFeature('confidential');
        try { const u = JSON.parse(localStorage.getItem('user') || '{}'); u.confidentialUnlocked = true; localStorage.setItem('user', JSON.stringify(u)); } catch { /* noop */ }
        fetchMsgs();
      } else {
        const t = await r.text().catch(() => '');
        setPassMsg(r.status === 429 && t ? t : 'Incorrect passkey. Try again.');
        setPassErr(true);
      }
    } catch {
      setPassMsg('Could not reach the server. Try again.');
      setPassErr(true);
    }
    setUnlocking(false);
  };

  useEffect(() => { if (isSelfNotes) markFeature('notes'); }, [isSelfNotes]);

  // Channel topic (kept locally per channel for now).
  useEffect(() => {
    setEditingTopic(false);
    try { setTopic(localStorage.getItem(`taskis-topic-${channel}`) || ''); } catch { setTopic(''); }
  }, [channel]);
  const saveTopic = (v: string) => {
    const t = v.trim();
    setTopic(t);
    setEditingTopic(false);
    try { if (t) localStorage.setItem(`taskis-topic-${channel}`, t); else localStorage.removeItem(`taskis-topic-${channel}`); } catch { /* noop */ }
  };

  // Konami code → it rains confetti. Pure silliness.
  useEffect(() => watchKonami(() => { emojiRain('🎉', 48); toast('🎉 You found the secret. Party mode!', 'success'); }), [toast]);

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
    pendingInitial.current = true;
    try {
      const seen = JSON.parse(localStorage.getItem('seenAt') || '{}');
      boundaryRef.current = seen[channel] || 0;
    } catch { boundaryRef.current = 0; }
    // restore any unsent draft for this channel
    try { setInput(localStorage.getItem(`draft_${channel}`) || ''); } catch { setInput(''); }
    setTimeout(() => autoGrow(), 0);
    // Don't fetch a gated channel until it's unlocked (avoids a 403 logout loop).
    if (channel === 'confidential' && !user.confidentialUnlocked && !confidUnlockedRef.current) { setLoading(false); return; }
    fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => {
        if (r.status === 403 && channel === 'confidential') { setConfidUnlocked(false); setLoading(false); return null; }
        if (r.status === 401 || r.status === 403) { localStorage.clear(); window.location.href = '/'; return null; }
        return r.json();
      })
      .then((d) => { if (d) { setMessages(d); setLoading(false); markChannelSeen(); } })
      .catch(() => setLoading(false));
  }, [channel]);

  useEffect(() => {
    const upsert = (incoming: any) => {
      if (!incoming || incoming.id == null) return;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === incoming.id);
        if (i === -1) {
          if (incoming.sender?.username !== user.username) {
            if (!document.hidden) markChannelSeen();
            if (deservesConfetti(incoming.content)) confetti();
          }
          return [...prev, incoming];
        }
        const copy = prev.slice();
        copy[i] = incoming;
        return copy;
      });
    };
    // Don't subscribe to a gated channel we haven't unlocked — the server rejects it.
    if (channel === 'confidential' && !confidUnlocked) return;
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
  }, [channel, user.username, confidUnlocked]);

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
    if (messages.length === 0) return;
    // First render for this channel: land on the first unread, else the bottom.
    if (pendingInitial.current) {
      pendingInitial.current = false;
      const b = boundaryRef.current;
      const fu = b ? messages.find((m) => new Date(m.timestamp).getTime() > b && m.sender?.username !== user.username) : null;
      setTimeout(() => {
        if (fu) document.querySelector(`[data-mid="${fu.id}"]`)?.scrollIntoView({ block: 'center' });
        else bottomRef.current?.scrollIntoView();
      }, 60);
      return;
    }
    if (grew <= 0) return;
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    } else {
      setNewCount((c) => c + grew);
    }
  }, [messages.length]);

  // Auto-focus the composer when opening a conversation (desktop only).
  useEffect(() => {
    if (isBot || typeof window === 'undefined' || window.innerWidth < 1024) return;
    const t = setTimeout(() => taRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [channel, isBot]);

  // Jump to a specific message after navigating from global search.
  useEffect(() => {
    let jid: string | null = null;
    try { jid = sessionStorage.getItem('taskis-jump'); } catch { jid = null; }
    if (!jid || !messages.some((m) => String(m.id) === jid)) return;
    try { sessionStorage.removeItem('taskis-jump'); } catch { /* ignore */ }
    setHighlightId(Number(jid));
    setTimeout(() => { document.querySelector(`[data-mid="${jid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 220);
    setTimeout(() => setHighlightId((h) => (h === Number(jid) ? null : h)), 2000);
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 120;
    setFarUp(dist > 500);
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

  const MAX_FILES = 30;
  const previewFor = (f: File) =>
    f.type.startsWith('image/') || f.type.startsWith('audio/') ? URL.createObjectURL(f) : null;

  const addFiles = (list: FileList | File[] | null) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
    setFilePreviews((prev) => [...prev, ...incoming.map(previewFor)].slice(0, MAX_FILES));
    if (incoming.length + files.length > 1) markFeature('uploads');
    if (incoming.length + files.length > MAX_FILES) toast(`Only the first ${MAX_FILES} files were added`, 'info');
  };

  const removeFile = (i: number) => {
    setFilePreviews((prev) => { const p = prev[i]; if (p) URL.revokeObjectURL(p); return prev.filter((_, k) => k !== i); });
    setFiles((prev) => prev.filter((_, k) => k !== i));
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
        addFiles([new File([blob], `voice-note.${ext}`, { type })]);
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

  const clearFiles = () => {
    filePreviews.forEach((p) => p && URL.revokeObjectURL(p));
    setFiles([]);
    setFilePreviews([]);
    setProgress(0);
    setUploadCount({ done: 0, total: 0 });
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
      fd.append('channel', channel);
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

  const applySlash = (raw: string) => {
    const cmds: Record<string, string> = {
      '/shrug': '¯\\_(ツ)_/¯',
      '/tableflip': '(╯°□°)╯︵ ┻━┻',
      '/unflip': '┬─┬ ノ( ゜-゜ノ)',
    };
    for (const cmd of Object.keys(cmds)) {
      if (raw === cmd) return cmds[cmd];
      if (raw.startsWith(cmd + ' ')) return `${raw.slice(cmd.length + 1)} ${cmds[cmd]}`.trim();
    }
    return raw;
  };

  // ---- polls (stored as a marker message; votes ride the existing reactions) ----
  const POLL_TOKENS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const makePoll = (raw: string): string | null => {
    const m = raw.trim().match(/^\/poll\s+(.+)$/i);
    if (!m) return null;
    const parts = m[1].split('|').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) return null; // need a question + at least two options
    const [q, ...options] = parts;
    return `::poll::${JSON.stringify({ q, options: options.slice(0, 10) })}`;
  };
  const submitPoll = async (q: string, options: string[]) => {
    setShowPollComposer(false);
    markFeature('polls');
    const content = `::poll::${JSON.stringify({ q, options: options.slice(0, 10) })}`;
    const replySnapshot = replyTo;
    setReplyTo(null);
    nearBottomRef.current = true;
    await fetch(api('/api/chat/send'), { method: 'POST', headers: authH(), body: JSON.stringify({ content, channel, replyToId: replySnapshot?.id ?? null }) });
    fetchMsgs();
  };
  const reactRaw = (id: number, emoji: string) =>
    fetch(api(`/api/chat/messages/${id}/react`), { method: 'POST', headers: authH(), body: JSON.stringify({ emoji }) });
  const votePoll = async (msg: any, token: string, tokens: string[]) => {
    markFeature('polls');
    const rx = parseRx(msg.reactions);
    // single-choice: clear any other option I picked, then toggle the target
    for (const t of tokens) {
      if (t !== token && (rx[t] || []).includes(user.username)) await reactRaw(msg.id, t);
    }
    await reactRaw(msg.id, token);
    fetchMsgs();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && files.length === 0) return;

    // Poll syntax wins; otherwise silly slash commands (/roll, /flip, …).
    const poll = makePoll(input);
    const fun = runFunCommand(input);
    const text = poll ?? (fun.handled ? (fun.content ?? '') : applySlash(input));
    if (poll) markFeature('polls');
    if (fun.handled) markFeature('slash');
    if (/^::(slam|gentle)::/.test(text) || /\|\|[^|]+\|\|/.test(text)) markFeature('effects');
    if (fun.effect === 'confetti') confetti();
    const replySnapshot = replyTo;

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    if (files.length) {
      const queued = files;
      setUploading(true);
      setUploadCount({ done: 0, total: queued.length });
      try {
        const results: { url: string; type: string }[] = [];
        for (let i = 0; i < queued.length; i++) {
          setProgress(0);
          results.push(await uploadWithProgress(queued[i]));
          setUploadCount({ done: i + 1, total: queued.length });
        }
        if (results.length === 1) {
          attachmentUrl = results[0].url;
          attachmentType = results[0].type;
        } else {
          // Multiple attachments ride in one message as JSON arrays.
          attachmentUrl = JSON.stringify(results.map((r) => r.url));
          attachmentType = JSON.stringify(results.map((r) => r.type));
        }
      } catch {
        toast('Upload failed — try again', 'error');
        setUploading(false);
        return; // keep the staged files so the user can retry
      }
      setUploading(false);
      clearFiles();
    }

    if (!text.trim() && !attachmentUrl) return; // e.g. a fun command that only ran an effect

    // Optimistic: show the message instantly, reconcile with the server copy.
    const tempId = `temp-${nextTemp.current++}`;
    const optimistic = {
      id: tempId, sender: user, content: text, channel,
      attachmentUrl, attachmentType, replyTo: replySnapshot,
      timestamp: new Date().toISOString(), _sending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    if (!fun.effect && deservesConfetti(text)) confetti();
    playTick();
    setInput('');
    setSlashQuery(null);
    try { localStorage.removeItem(`draft_${channel}`); } catch { /* ignore */ }
    setReplyTo(null);
    nearBottomRef.current = true;
    if (taRef.current) taRef.current.style.height = 'auto';

    deliver({ content: text, channel, attachmentUrl, attachmentType, replyToId: replySnapshot?.id ?? null }, tempId);
  };

  const react = async (msgId: number, emoji: string) => {
    setEmojiId(null);
    playReaction(emoji);
    if (emoji === '🎉' || emoji === '🎊' || emoji === '🔥') { confetti(60); markFeature('superreact'); } // super-reaction burst
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

  const copyText = async (m: any) => {
    setMenuId(null);
    if (await copyToClipboard(m.content || '')) toast('Copied to clipboard', 'success');
    else toast('Could not copy', 'error');
  };

  const reportMsg = async (m: any) => {
    setMenuId(null);
    if (!(await confirm({ title: 'Report this message?', body: 'An admin will review it and can take action.', confirmText: 'Report', danger: true }))) return;
    await fetch(api('/api/reports'), { method: 'POST', headers: authH(), body: JSON.stringify({ type: 'message', targetId: String(m.id), reason: '' }) });
    toast('Reported — thanks', 'success');
  };

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

  const repliesOf = (id: number) => messages.filter((m) => m.replyTo?.id === id && !m.deleted);

  const sendThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInput.trim() || !threadRoot) return;
    const content = threadInput;
    setThreadInput('');
    await fetch(api('/api/chat/send'), { method: 'POST', headers: authH(), body: JSON.stringify({ content, channel, replyToId: threadRoot.id }) });
    fetchMsgs();
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

  const fileNameOf = (url: string) => {
    const last = decodeURIComponent((url.split('/').pop() || '').split('?')[0]);
    if (/^[0-9a-fA-F-]{16,40}_/.test(last)) return last.split('_').slice(1).join('_') || 'Document'; // legacy /uploads/<uuid>_name
    return last || 'Document';
  };

  // A message may carry one attachment (plain string) or several (JSON arrays).
  const parseAttachments = (msg: any): { url: string; type: string }[] => {
    const raw = msg.attachmentUrl as string | null;
    if (!raw) return [];
    if (raw.trim().startsWith('[')) {
      try {
        const urls: string[] = JSON.parse(raw);
        let types: string[] = [];
        try { types = JSON.parse(msg.attachmentType || '[]'); } catch { /* noop */ }
        if (Array.isArray(urls)) return urls.map((u, i) => ({ url: u, type: types[i] || 'application/octet-stream' }));
      } catch { /* fall through to single */ }
    }
    return [{ url: raw, type: msg.attachmentType || 'application/octet-stream' }];
  };

  const toFull = (u: string) => withFileToken(u.startsWith('http') ? u : api(u));
  const dlHref = (full: string) => {
    if (!full.includes('/api/files/')) return full;
    const sep = full.includes('?') ? '&' : '?';
    return `${full}${sep}dl=1`;
  };

  // Files carry a read-only file-scoped token (via withFileToken), so preview/download
  // load directly — no shared passphrase prompt.
  const openPreview = (a: { url: string; type: string }) => {
    const full = toFull(a.url);
    markFeature('preview');
    setPreviewAtt({ url: full, type: a.type, name: fileNameOf(a.url) });
  };

  const downloadAll = (atts: { url: string; type: string }[]) => {
    atts.forEach((a, i) => setTimeout(() => {
      const link = document.createElement('a');
      link.href = dlHref(toFull(a.url));
      link.download = fileNameOf(a.url);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, i * 220));
  };

  // ---- silly slash commands (icon-led autocomplete) ----
  const SLASH_COMMANDS = [
    { cmd: '/roll', icon: Dices, desc: 'Roll a die — /roll 20 for a d20' },
    { cmd: '/flip', icon: Coins, desc: 'Flip a coin' },
    { cmd: '/8ball', icon: Sparkles, desc: 'Ask the magic 8-ball a question' },
    { cmd: '/celebrate', icon: PartyPopper, desc: 'Throw confetti 🎉' },
    { cmd: '/poll', icon: ListChecks, desc: 'Create a poll — /poll Lunch? | Pizza | Sushi' },
    { cmd: '/slam', icon: Zap, desc: 'Send with a slam effect' },
    { cmd: '/gentle', icon: Sparkles, desc: 'Send with a gentle effect' },
    { cmd: '/spoiler', icon: Eye, desc: 'Hide text behind tap-to-reveal' },
    { cmd: '/shrug', icon: Smile, desc: '¯\\_(ツ)_/¯' },
    { cmd: '/tableflip', icon: Smile, desc: '(╯°□°)╯︵ ┻━┻' },
    { cmd: '/unflip', icon: Smile, desc: '┬─┬ ノ( ゜-゜ノ)' },
  ];
  const slashMatches = slashQuery === null ? [] : SLASH_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(slashQuery.toLowerCase()));

  const detectSlash = (val: string, pos: number) => {
    const m = pos === val.length && /^\/(\w*)$/.test(val) ? val.match(/^\/(\w*)$/) : null;
    setSlashQuery(m ? m[1] : null);
    setSlashSel(0);
  };

  const pickSlash = (cmd: string) => {
    markFeature('slash');
    const needsArg = ['/8ball', '/roll', '/poll', '/slam', '/gentle', '/spoiler'].includes(cmd);
    const next = needsArg ? `${cmd} ` : cmd;
    setInput(next);
    setSlashQuery(null);
    setTimeout(() => { const ta = taRef.current; if (ta) { ta.focus(); ta.setSelectionRange(next.length, next.length); } }, 0);
  };

  // double-tap a message to ❤️ it (with a little heart pop)
  const doubleReact = (msg: any) => {
    if (selectMode || msg.deleted || typeof msg.id !== 'number') return;
    markFeature('heart');
    react(msg.id, '❤️');
    setHeartId(msg.id);
    setTimeout(() => setHeartId((h) => (h === msg.id ? null : h)), 850);
  };

  // ---- multi-select delete ----
  const canDelete = (msg: any) =>
    typeof msg.id === 'number' && !msg.deleted &&
    (msg.sender?.username === user.username || user.role === 'ADMIN');

  const toggleSelect = (id: number) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const enterSelect = (id?: number) => {
    setMenuId(null);
    setSelectMode(true);
    setSelected(new Set(typeof id === 'number' ? [id] : []));
    markFeature('select');
  };

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!(await confirm({ title: `Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?`, body: 'This removes them for everyone in the conversation.', confirmText: 'Delete', danger: true }))) return;
    setBulkDeleting(true);
    await Promise.all(ids.map((id) =>
      fetch(api(`/api/chat/messages/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {}),
    ));
    setBulkDeleting(false);
    exitSelect();
    fetchMsgs();
    toast(`Deleted ${ids.length} message${ids.length > 1 ? 's' : ''}`, 'success');
  };

  const openProfile = (uname?: string) => { if (uname && uname !== 'Taskis Bot') window.dispatchEvent(new CustomEvent('open-profile', { detail: uname })); };

  const renderContent = (text: string) => renderRich(text, { members, me: user.username, custom: customMap });

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

  const detectColon = (val: string, pos: number) => {
    const m = val.slice(0, pos).match(/(?:^|\s):([a-z0-9_+-]{2,})$/i);
    setColonQuery(m ? m[1] : null);
    setColonSel(0);
  };

  const insertColon = (text: string) => {
    const ta = taRef.current;
    const pos = ta?.selectionStart ?? input.length;
    const upto = input.slice(0, pos).replace(/(^|\s):([a-z0-9_+-]{2,})$/i, `$1${text} `);
    const next = upto + input.slice(pos);
    setInput(next);
    setColonQuery(null);
    setTimeout(() => { if (ta) { ta.focus(); ta.setSelectionRange(upto.length, upto.length); autoGrow(); } }, 0);
  };
  const pickColon = (item: any) => insertColon(item.custom ? `:${item.name}:` : item.e);

  const wrapSelection = (pre: string, suf: string = pre) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? 0;
    const e = ta.selectionEnd ?? 0;
    const sel = input.slice(s, e) || 'text';
    const next = input.slice(0, s) + pre + sel + suf + input.slice(e);
    setInput(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + pre.length, s + pre.length + sel.length); autoGrow(); }, 0);
  };

  const insertLink = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? 0;
    const e = ta.selectionEnd ?? 0;
    const sel = input.slice(s, e) || 'text';
    const next = `${input.slice(0, s)}[${sel}](url)${input.slice(e)}`;
    setInput(next);
    const urlStart = s + 1 + sel.length + 2;
    setTimeout(() => { ta.focus(); ta.setSelectionRange(urlStart, urlStart + 3); autoGrow(); }, 0);
  };

  const fmtBtn = 'w-[26px] h-[26px] grid place-items-center rounded-[8px] text-t2 hover:text-t1 hover:bg-hover active:scale-95 transition-all';

  const autoGrow = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`; }
  };

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null && slashMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashSel((s) => Math.min(s + 1, slashMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashSel((s) => Math.max(s - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && slashMatches[slashSel].cmd !== input.trim())) { e.preventDefault(); pickSlash(slashMatches[slashSel].cmd); return; }
      if (e.key === 'Escape') { setSlashQuery(null); return; }
    }
    if (colonQuery !== null && emojiMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setColonSel((s) => Math.min(s + 1, emojiMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setColonSel((s) => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickColon(emojiMatches[colonSel]); return; }
      if (e.key === 'Escape') { setColonQuery(null); return; }
    }
    if (mentionQuery !== null && mentionMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSel((s) => Math.min(s + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSel((s) => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionMatches[mentionSel].username); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); wrapSelection('**'); return; }
      if (k === 'i') { e.preventDefault(); wrapSelection('_'); return; }
      if (k === 'e') { e.preventDefault(); wrapSelection('`'); return; }
    }
    if (e.key === 'Escape' && replyTo) { setReplyTo(null); return; }
    if (e.key === 'ArrowUp' && !input.trim()) {
      const mine = [...messages].reverse().find((m) => m.sender?.username === user.username && !m.deleted && typeof m.id === 'number');
      if (mine) { e.preventDefault(); startEdit(mine); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e as any); }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasted = Array.from(items)
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (pasted.length) { addFiles(pasted); e.preventDefault(); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isBot) return;
    addFiles(e.dataTransfer.files);
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

  // Special broadcast mentions — only inside real channels (not DMs/bot).
  const SPECIAL_MENTIONS = isChannel
    ? [
        { username: 'channel', special: true, sub: 'Notify everyone in this channel' },
        { username: 'here', special: true, sub: 'Notify people who are active' },
      ]
    : [];
  const mentionMatches: any[] = mentionQuery === null ? [] : [
    ...SPECIAL_MENTIONS.filter((s) => s.username.startsWith(mentionQuery.toLowerCase())),
    ...members.filter((m) => m.username && m.username !== 'Taskis Bot' && m.username.toLowerCase().startsWith(mentionQuery.toLowerCase())),
  ].slice(0, 6);

  const emojiMatches: { custom: boolean; e?: string; name?: string; url?: string }[] = colonQuery === null ? [] : [
    ...Object.keys(customMap).filter((n) => n.includes(colonQuery.toLowerCase())).slice(0, 5).map((n) => ({ custom: true, name: n, url: customMap[n] })),
    ...searchEmoji(colonQuery).slice(0, 8).map((e) => ({ custom: false, e })),
  ].slice(0, 9);

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

  // A single attachment rendered by kind (image / video / audio / generic file).
  const AttachmentOne = ({ a, mine }: { a: { url: string; type: string }; mine: boolean }) => {
    const full = toFull(a.url);
    if (a.type.startsWith('image/')) {
      return (
        <button onClick={() => setBigImage(full)} className="block w-[282px] max-w-full rounded-[16px] overflow-hidden border border-border cursor-zoom-in hover:border-border-strong transition-colors p-0 bg-transparent shadow-[var(--shadow-sm)]">
          <img src={full} alt="attachment" className="w-full max-h-[260px] object-cover block" />
        </button>
      );
    }
    if (a.type.startsWith('video/')) {
      return <video src={full} controls className="w-[282px] max-w-full max-h-[260px] rounded-[16px] border border-border bg-black block" />;
    }
    if (a.type.startsWith('audio/')) {
      return <VoiceNote src={full} mine={mine} />;
    }
    return (
      <div className="flex items-center gap-[11px] px-3 py-2.5 rounded-2xl border border-border w-[264px] max-w-full" style={{ background: 'var(--surface-2)' }}>
        <button onClick={() => openPreview(a)} className="w-[34px] h-[34px] rounded-xl bg-surface-3 grid place-items-center flex-none text-t2 hover:text-t1 transition-colors" title="Preview"><FileText className="w-4 h-4" /></button>
        <button onClick={() => openPreview(a)} className="flex-1 min-w-0 text-left">
          <div className="text-[13.5px] font-medium text-t1 truncate hover:underline">{fileNameOf(a.url)}</div>
          <div className="text-xs text-t3 uppercase">{a.type?.split('/')[1] || 'file'}</div>
        </button>
        <button onClick={() => openPreview(a)} className="icon-btn w-[30px] h-[30px] border-0" aria-label="Preview" title="Preview"><Eye className="w-[15px] h-[15px]" /></button>
        <a href={dlHref(full)} download target="_blank" rel="noreferrer" className="icon-btn w-[30px] h-[30px] border-0" aria-label="Download" title="Download"><Download className="w-[15px] h-[15px]" /></a>
      </div>
    );
  };

  const Attachment = ({ msg, mine }: { msg: any; mine: boolean }) => {
    const atts = parseAttachments(msg);
    if (!atts.length) return null;
    if (atts.length === 1) return <AttachmentOne a={atts[0]} mine={mine} />;

    const allImages = atts.every((a) => a.type.startsWith('image/'));
    return (
      <div className="w-[282px] max-w-full flex flex-col gap-2">
        {allImages ? (
          <div className="grid grid-cols-2 gap-1.5">
            {atts.map((a, i) => (
              <button key={i} onClick={() => setBigImage(toFull(a.url))} className="relative rounded-xl overflow-hidden border border-border cursor-zoom-in hover:border-border-strong transition-colors aspect-square bg-surface-2">
                <img src={toFull(a.url)} alt="attachment" className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          atts.map((a, i) => <AttachmentOne key={i} a={a} mine={mine} />)
        )}
        <button onClick={() => downloadAll(atts)} className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-border text-[12.5px] font-medium text-t2 hover:text-t1 hover:border-border-strong transition-colors" style={{ background: 'var(--surface-2)' }}>
          <Download className="w-[14px] h-[14px]" /> Download all · {atts.length} files
        </button>
      </div>
    );
  };

  const actionBtnCls = 'w-[26px] h-[26px] grid place-items-center rounded-lg bg-surface-2 border border-border text-t2 hover:text-t1 hover:border-border-strong transition-colors cursor-pointer';

  const ThreadRow = ({ m }: { m: any }) => {
    const src = avatarFor(m.sender);
    const me = m.sender?.username === user.username;
    return (
      <div className="flex gap-2.5">
        <span className="relative w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white overflow-hidden mt-0.5" style={{ background: src ? 'transparent' : toneFor(m.sender?.username || '?') }}>
          {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(m.sender?.username || '?')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-t1">{me ? 'You' : displayOf(m.sender)}</span>
            <span className="text-[11px] text-t3">{fmt(m.timestamp)}</span>
          </div>
          {m.content && <div className="text-[14px] text-t1 leading-relaxed whitespace-pre-wrap break-words mt-0.5">{m.deleted ? '[deleted]' : renderContent(m.content)}</div>}
          {!m.deleted && <Attachment msg={m} mine={me} />}
        </div>
      </div>
    );
  };

  if (channel === 'confidential' && !confidUnlocked) {
    return (
      <div className="flex flex-col h-full relative">
        <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
          <button onClick={onToggleSidebar} className="icon-btn w-8 h-8" aria-label="Toggle sidebar" title="Toggle sidebar"><Menu className="w-[15px] h-[15px]" /></button>
          <span className="text-[22px] font-medium text-t3 leading-none">#</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15.5px] font-semibold text-t1 leading-tight truncate">confidential</div>
            <div className="flex items-center gap-1.5 text-xs text-t2 mt-px"><Lock className="w-[11px] h-[11px]" />Passkey required</div>
          </div>
        </header>
        <div className="flex-1 grid place-items-center px-6">
          <form onSubmit={unlockConfidential} className="card tk-pop w-[380px] max-w-full p-7 text-center" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-strong grid place-items-center text-accent-text mx-auto mb-4"><KeyRound className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">This channel is locked</h2>
            <p className="text-[13.5px] leading-[1.55] text-t2 mb-5">#confidential is restricted. Enter the passkey to continue.</p>
            <input
              type="password"
              inputMode="numeric"
              value={passInput}
              onChange={(e) => { setPassInput(e.target.value); setPassErr(false); }}
              placeholder="Passkey"
              autoFocus
              className={`tk-input text-center tracking-[0.3em] ${passErr ? 'is-error' : ''}`}
            />
            {passErr && (
              <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[12.5px] text-danger"><AlertCircle className="w-[13px] h-[13px] flex-none" /><span>{passMsg}</span></div>
            )}
            <button type="submit" disabled={!passInput.trim() || unlocking} className="btn-accent w-full py-[11px] text-sm mt-[22px]">{unlocking ? <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Lock className="w-[14px] h-[14px]" />}Unlock channel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={(e) => { if (!isBot) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      {dragOver && !isBot && (
        <div className="absolute inset-3 z-[60] rounded-2xl border-2 border-dashed grid place-items-center pointer-events-none" style={{ borderColor: 'var(--accent-line)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}>
          <div className="text-center">
            <div className="text-[15px] font-semibold text-accent-text">Drop to attach</div>
            <div className="text-[12.5px] text-t2 mt-0.5">Release to add the file to your message</div>
          </div>
        </div>
      )}
      {/* header */}
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
        <button onClick={onToggleSidebar} className="icon-btn w-8 h-8" aria-label="Toggle sidebar" title="Toggle sidebar"><Menu className="w-[15px] h-[15px]" /></button>
        {isChannel && <span className="text-[22px] font-medium text-t3 leading-none">#</span>}
        {isBot && <span className="w-[30px] h-[30px] rounded-lg bg-accent-soft text-accent-text text-[13px] font-bold grid place-items-center flex-none">TB</span>}
        {isDm && (
          <button onClick={() => openProfile(dmPartner?.username)} disabled={!dmPartner} className="relative w-[30px] h-[30px] rounded-full grid place-items-center flex-none text-xs font-semibold text-white overflow-hidden hover:opacity-85 transition-opacity" style={{ background: dmPartner ? 'transparent' : toneFor(dmPartner?.username || channel) }}>
            {dmPartner ? <img src={avatarFor(dmPartner)} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(headerTitle)}
            {dmPartner && <span className="absolute -right-px -bottom-px w-2.5 h-2.5 rounded-full z-10" style={{ background: dmPartner.status === 'ACTIVE' ? 'var(--online)' : dmPartner.status === 'AWAY' ? 'var(--away)' : 'var(--t3)', border: '2px solid var(--bg)' }} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          {dmPartner ? (
            <button onClick={() => openProfile(dmPartner.username)} className="text-[15.5px] font-semibold text-t1 leading-tight truncate hover:underline decoration-border block max-w-full text-left">{headerTitle}</button>
          ) : (
            <div className="text-[15.5px] font-semibold text-t1 leading-tight truncate">{headerTitle}</div>
          )}
          {isChannel ? (
            editingTopic ? (
              <input
                autoFocus
                defaultValue={topic}
                onBlur={(e) => saveTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTopic((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingTopic(false); }}
                placeholder="Add a topic…"
                className="bg-transparent border-0 outline-none text-xs text-t2 w-full mt-px"
              />
            ) : (
              <button onClick={() => setEditingTopic(true)} className="group flex items-center gap-1.5 text-xs text-t2 hover:text-t1 transition-colors mt-px max-w-full" title="Set channel topic">
                <span className="truncate">{topic || <span className="text-t3">Add a topic…</span>}</span>
                <Pencil className="w-[10px] h-[10px] flex-none opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-t2 mt-px"><Lock className="w-[11px] h-[11px]" />{headerSub}</div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-none">
          {!isBot && (
            <button
              onClick={() => { toggleMute(channel); setMuteVer((v) => v + 1); }}
              className="icon-btn w-8 h-8"
              title={isMuted(channel) ? 'Unmute notifications' : 'Mute notifications'}
              style={isMuted(channel) ? { color: 'var(--accent-text)' } : undefined}
              data-mutever={muteVer}
            >
              {isMuted(channel) ? <BellOff className="w-[15px] h-[15px]" /> : <Bell className="w-[15px] h-[15px]" />}
            </button>
          )}
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
                    <div className="text-[12.5px] text-t2 truncate">{plainText(m.content) || 'Attachment'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setSavedActive((a) => !a); setShowSearch(false); setSearch(''); }} className="icon-btn w-8 h-8" title="Saved messages" style={savedActive ? { background: 'var(--accent-soft)', color: 'var(--accent-text)', borderColor: 'var(--accent-line)' } : undefined}>
            {savedActive ? <BookmarkCheck className="w-[15px] h-[15px]" /> : <Bookmark className="w-[15px] h-[15px]" />}
          </button>

          {!isBot && (
            <button onClick={() => { markFeature('share'); setShowShare(true); }} className="btn-accent h-8 px-3 text-[13px] ml-0.5" title="Share">
              <Share2 className="w-[14px] h-[14px]" />Share
            </button>
          )}
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
            const selectable = canDelete(msg);
            const isSelected = typeof msg.id === 'number' && selected.has(msg.id);
            const isPoll = !isDeleted && typeof msg.content === 'string' && msg.content.startsWith('::poll::');
            const src = avatarFor(msg.sender);

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

                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-mid={msg.id}
                  onClick={selectMode && selectable ? () => toggleSelect(msg.id) : undefined}
                  className={`group flex gap-[11px] ${grouped ? 'mt-0.5' : 'mt-3.5'} ${isMe ? 'flex-row-reverse' : ''} transition-colors duration-500 rounded-xl px-1.5 -mx-1.5 ${selectMode && selectable ? 'cursor-pointer' : ''} ${selectMode && !selectable ? 'opacity-45' : ''}`}
                  style={isSelected ? { background: 'var(--accent-soft)' } : highlightId === msg.id ? { background: 'var(--accent-soft)' } : undefined}
                >
                  {/* selection checkbox */}
                  {selectMode && (
                    <span className="flex items-center flex-none self-center">
                      {!selectable ? (
                        <Circle className="w-[18px] h-[18px] text-t3 opacity-40" />
                      ) : isSelected ? (
                        <CircleCheck className="w-[18px] h-[18px]" style={{ color: 'var(--accent-text)' }} />
                      ) : (
                        <Circle className="w-[18px] h-[18px] text-t3" />
                      )}
                    </span>
                  )}
                  {/* avatar (others only; hidden when grouped but space preserved) */}
                  {!isMe && (
                    grouped ? (
                      <span className="w-7 flex-none" />
                    ) : (
                      <button onClick={() => openProfile(msg.sender?.username)} className="relative overflow-hidden w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white mt-5 cursor-pointer hover:opacity-85 transition-opacity" style={{ background: src ? 'transparent' : toneFor(msg.sender?.username || '?'), boxShadow: ringFor(msg.sender) }} title={`View ${displayOf(msg.sender)}`}>
                        {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(msg.sender?.username || '?')}
                      </button>
                    )
                  )}

                  <div className={`min-w-0 max-w-[76%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* meta */}
                    {!grouped && (
                      <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {isMe ? <span className="text-[13px] font-semibold text-t1">You</span> : <HoverCard user={msg.sender} onClick={() => openProfile(msg.sender?.username)} className="text-[13px] font-semibold text-t1 cursor-pointer hover:underline decoration-border">{displayOf(msg.sender)}</HoverCard>}
                        <span className="text-[11px] text-t3" title={new Date(msg.timestamp).toLocaleString()}>{fmt(msg.timestamp)}</span>
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
                        <span className="truncate opacity-80">{plainText(msg.replyTo.content) || 'Attachment'}</span>
                      </button>
                    )}

                    {/* bubble + hover actions */}
                    <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`relative flex flex-col gap-1.5 min-w-0 ${isMe ? 'items-end' : 'items-start'}`} onDoubleClick={() => doubleReact(msg)}>
                        {heartId === msg.id && (
                          <motion.span
                            initial={{ scale: 0.2, opacity: 0, y: 0 }}
                            animate={{ scale: 1, opacity: [0, 1, 1, 0], y: -26 }}
                            transition={{ duration: 0.85, ease: 'easeOut' }}
                            className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                          >
                            <Heart className="w-7 h-7 text-danger drop-shadow" fill="currentColor" />
                          </motion.span>
                        )}
                        {isPoll ? (() => {
                          let data: { q: string; options: string[] } | null = null;
                          try { data = JSON.parse(msg.content.slice(8)); } catch { /* noop */ }
                          if (!data) return null;
                          const rx = parseRx(msg.reactions);
                          const tokens = data.options.map((_, i) => POLL_TOKENS[i]);
                          const counts = tokens.map((t) => (rx[t] || []).length);
                          const total = counts.reduce((a, b) => a + b, 0);
                          return (
                            <div className="w-[300px] max-w-full rounded-2xl border border-border p-3.5" style={{ background: 'var(--surface-2)' }}>
                              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-t3 mb-1.5"><Sparkles className="w-[12px] h-[12px]" />Poll</div>
                              <div className="text-[14px] font-semibold text-t1 mb-2.5 break-words">{data.q}</div>
                              <div className="space-y-1.5">
                                {data.options.map((opt, i) => {
                                  const c = counts[i]; const pct = total ? Math.round((c / total) * 100) : 0;
                                  const voters = rx[tokens[i]] || [];
                                  const picked = voters.includes(user.username);
                                  return (
                                    <button key={i} onClick={() => votePoll(msg, tokens[i], tokens)} className="relative w-full text-left rounded-xl border overflow-hidden transition-colors hover:border-border-strong" style={{ borderColor: picked ? 'var(--accent-line)' : 'var(--border)' }}>
                                      <span className="absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--accent-soft)' }} />
                                      <span className="relative flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-t1">
                                        <span className="flex items-center gap-2 min-w-0"><span className="truncate">{opt}</span>{picked && <CheckCheck className="w-[13px] h-[13px] flex-none" style={{ color: 'var(--accent-text)' }} />}</span>
                                        <span className="flex items-center gap-2 flex-none">
                                          {voters.length > 0 && (
                                            <span className="flex -space-x-1.5">
                                              {voters.slice(0, 3).map((vu) => {
                                                const vm = members.find((m) => m.username === vu) || { username: vu };
                                                return <span key={vu} className="relative w-[18px] h-[18px] rounded-full overflow-hidden grid place-items-center text-[8px] font-semibold text-white" style={{ background: toneFor(vu), border: '1.5px solid var(--surface-2)' }} title={displayOf(vm)}><img src={avatarFor(vm)} alt="" className="absolute inset-0 w-full h-full object-cover" /></span>;
                                              })}
                                            </span>
                                          )}
                                          <span className="text-t3 tabular-nums">{pct}%</span>
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="text-[11px] text-t3 mt-2.5">{total} vote{total === 1 ? '' : 's'} · tap to vote, tap again to remove</div>
                            </div>
                          );
                        })() : (() => { const fx = isDeleted ? { effect: null, text: msg.content } : parseEffect(msg.content); return (msg.content || isDeleted) && (
                          <div
                            className={`px-[14px] py-[9px] text-[14.5px] leading-relaxed whitespace-pre-wrap break-words ${isDeleted ? 'opacity-50 italic' : ''} ${fx.effect === 'slam' ? 'tk-fx-slam' : fx.effect === 'gentle' ? 'tk-fx-gentle' : ''}`}
                            style={{ background: isMe ? 'var(--bubble-own)' : 'var(--bubble-other)', color: isMe ? 'var(--bubble-own-text)' : 'var(--bubble-other-text)', borderRadius: isMe ? '20px 7px 20px 20px' : '7px 20px 20px 20px' }}
                          >
                            {msg.content ? (isDeleted ? msg.content : (searchActive ? highlight(fx.text, search.trim()) : renderContent(fx.text))) : msg.content}
                          </div>
                        ); })()}
                        {!isDeleted && !msg.attachmentUrl && firstUrl(msg.content) && <LinkPreview url={firstUrl(msg.content)!} />}
                        {!isDeleted && <Attachment msg={msg} mine={isMe} />}
                      </div>

                      {!isDeleted && !selectMode && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* quick reactions */}
                          {['👍', '❤️', '😂'].map((em) => (
                            <button key={em} onClick={() => react(msg.id, em)} className="w-[26px] h-[26px] grid place-items-center rounded-lg bg-surface-2 border border-border hover:border-border-strong text-[14px] transition-colors" title={`React ${em}`}>{em}</button>
                          ))}
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
                                {msg.content && <button onClick={() => copyText(msg)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Copy className="w-[14px] h-[14px] text-t2" /> Copy text</button>}
                                <button onClick={() => togglePin(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Pin className="w-[14px] h-[14px] text-t2" /> {msg.pinned ? 'Unpin' : 'Pin'}</button>
                                <button onClick={() => toggleSave(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors">{savedIds.has(msg.id) ? <BookmarkCheck className="w-[14px] h-[14px] text-accent-text" /> : <Bookmark className="w-[14px] h-[14px] text-t2" />} {savedIds.has(msg.id) ? 'Unsave' : 'Save'}</button>
                                {canEdit && (
                                  <button onClick={() => startEdit(msg)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Pencil className="w-[14px] h-[14px] text-t2" /> Edit</button>
                                )}
                                {selectable && (
                                  <button onClick={() => enterSelect(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><ListChecks className="w-[14px] h-[14px] text-t2" /> Select</button>
                                )}
                                {!isMe && (
                                  <button onClick={() => reportMsg(msg)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-t1 hover:bg-hover transition-colors"><Flag className="w-[14px] h-[14px] text-t2" /> Report</button>
                                )}
                                {selectable && (
                                  <button onClick={() => deleteMsg(msg.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-danger hover:bg-danger-soft transition-colors"><Trash2 className="w-[14px] h-[14px]" /> Delete</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* reactions */}
                    {!isPoll && Object.keys(rx).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(rx).map(([em, users]) => {
                          const mineRx = users.includes(user.username);
                          return (
                            <button key={em} onClick={() => react(msg.id, em)} title={users.join(', ')} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors" style={mineRx ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--accent-text)' } : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--t2)' }}>
                              {em}<span className="text-[10px]">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* thread summary */}
                    {(() => {
                      const tr = repliesOf(msg.id);
                      if (tr.length === 0) return null;
                      const parts: any[] = [];
                      tr.forEach((r) => { if (!parts.some((p) => p.username === r.sender?.username)) parts.push(r.sender); });
                      const lastAt = tr[tr.length - 1]?.timestamp;
                      return (
                        <button onClick={() => setThreadRoot(msg)} className={`flex items-center gap-2 mt-1.5 pl-1 pr-3 py-1 rounded-full hover:bg-hover transition-colors ${isMe ? 'self-end' : 'self-start'}`}>
                          <span className="flex -space-x-1.5">
                            {parts.slice(0, 3).map((p, pi) => {
                              const psrc = avatarFor(p);
                              return (
                                <span key={pi} className="relative w-[18px] h-[18px] rounded-full grid place-items-center text-[9px] font-semibold text-white overflow-hidden" style={{ background: psrc ? 'transparent' : toneFor(p?.username || '?'), border: '1.5px solid var(--surface-1)' }}>
                                  {psrc ? <img src={psrc} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(p?.username || '?')}
                                </span>
                              );
                            })}
                          </span>
                          <span className="text-[12.5px] font-medium text-accent-text">{tr.length} {tr.length === 1 ? 'reply' : 'replies'}</span>
                          <span className="text-[11.5px] text-t3">Last reply {fmt(lastAt)}</span>
                          <ArrowDown className="w-3 h-3 text-t3 -rotate-90" />
                        </button>
                      );
                    })()}

                    {/* delivery / read receipt (own) */}
                    {isMe && !isDeleted && (() => {
                      const readers = (msg.readBy || '').split(',').map((s: string) => s.trim()).filter((u: string) => u && u !== user.username);
                      const nameOf = (u: string) => { const mm = members.find((x) => x.username === u); return mm ? displayOf(mm) : u; };
                      const label = readers.length === 0
                        ? 'Sent'
                        : `Seen by ${readers.slice(0, 2).map(nameOf).join(', ')}${readers.length > 2 ? ` +${readers.length - 2}` : ''}`;
                      return (
                        <div className="flex items-center gap-1 mt-1 text-[10.5px]">
                          {msg._sending ? (
                            <span className="text-t3 italic">Sending…</span>
                          ) : msg._failed ? (
                            <button onClick={() => retrySend(msg)} className="text-danger hover:underline">Failed · retry</button>
                          ) : (
                            <span className="flex items-center gap-1 text-t3" title={readers.map(nameOf).join(', ')}>
                              <CheckCheck className="w-3 h-3" style={readers.length ? { color: 'var(--accent-text)' } : undefined} />
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* scroll to latest */}
      {farUp && newCount === 0 && (
        <button
          onClick={() => { nearBottomRef.current = true; bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          className="absolute right-5 bottom-[88px] z-20 w-9 h-9 grid place-items-center rounded-full bg-surface border border-border-strong text-t2 hover:text-t1 shadow-[var(--shadow-md)] transition-colors"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="w-[16px] h-[16px]" />
        </button>
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

      {/* bulk-select action bar */}
      {selectMode && (
        <div className="px-[22px] py-2.5 flex-none border-t border-border flex items-center gap-3" style={{ background: 'var(--surface-2)' }}>
          <ListChecks className="w-[16px] h-[16px] text-accent-text flex-none" />
          <span className="text-[13px] font-medium text-t1">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set(view.filter(canDelete).map((m) => m.id)))} className="text-[12.5px] text-accent-text hover:underline">Select all</button>
          <div className="flex-1" />
          <button onClick={exitSelect} className="btn-secondary px-3.5 py-2 text-[13px]">Cancel</button>
          <button onClick={bulkDelete} disabled={selected.size === 0 || bulkDeleting} className="btn-accent px-3.5 py-2 text-[13px]" style={{ background: 'var(--danger)' }}>
            {bulkDeleting ? <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Trash2 className="w-[14px] h-[14px]" />}
            Delete{selected.size ? ` ${selected.size}` : ''}
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
                <span className="truncate opacity-70">{plainText(replyTo.content)}</span>
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
              {files.length > 0 && (
                <div className="space-y-2">
                  {uploading && (
                    <div className="flex items-center gap-2.5 px-1 text-[12px] text-t2">
                      <span className="w-[13px] h-[13px] rounded-full border-2 border-t-transparent tk-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      <span className="flex-none">Uploading {Math.min(uploadCount.done + 1, uploadCount.total)}/{uploadCount.total}…</span>
                      <span className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                        <span className="block h-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => {
                      const pv = filePreviews[i];
                      return (
                        <div key={i} className="relative inline-flex items-center gap-2.5 p-2 pr-2 rounded-xl bg-surface-2 border border-border max-w-full overflow-hidden">
                          {f.type.startsWith('image/') && pv ? (
                            <img src={pv} alt="" className="w-10 h-10 rounded-lg object-cover flex-none" />
                          ) : f.type.startsWith('audio/') ? (
                            <span className="w-10 h-10 rounded-lg bg-accent-soft text-accent-text grid place-items-center flex-none"><Mic className="w-[18px] h-[18px]" /></span>
                          ) : f.type.startsWith('video/') ? (
                            <span className="w-10 h-10 rounded-lg bg-surface-3 grid place-items-center text-t2 flex-none"><Eye className="w-[18px] h-[18px]" /></span>
                          ) : (
                            <span className="w-10 h-10 rounded-lg bg-surface-3 grid place-items-center text-t2 flex-none"><FileText className="w-[18px] h-[18px]" /></span>
                          )}
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-t1 truncate max-w-[150px]">{f.name}</div>
                            <div className="text-[11px] text-t3">{formatBytes(f.size)}</div>
                          </div>
                          {!uploading && (
                            <button type="button" onClick={() => removeFile(i)} aria-label="Remove attachment" className="icon-btn w-6 h-6 border-0"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      );
                    })}
                    {!uploading && files.length > 1 && (
                      <button type="button" onClick={clearFiles} className="self-center text-[12px] text-t3 hover:text-danger transition-colors px-1">Clear all</button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-1 pb-2">
                <div className="inline-flex items-center gap-0.5 rounded-[12px] border border-border bg-surface-2 p-1">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection('**')} className={fmtBtn} title="Bold (⌘B)"><Bold className="w-[14px] h-[14px]" /></button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection('_')} className={fmtBtn} title="Italic (⌘I)"><Italic className="w-[14px] h-[14px]" /></button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection('~~')} className={fmtBtn} title="Strikethrough"><Strikethrough className="w-[14px] h-[14px]" /></button>
                  <span className="w-px h-4 bg-border mx-0.5" />
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection('`')} className={fmtBtn} title="Code (⌘E)"><Code className="w-[14px] h-[14px]" /></button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} className={fmtBtn} title="Link"><LinkIcon className="w-[14px] h-[14px]" /></button>
                </div>
                <span className="text-[11px] text-t3 hidden sm:block">Select text, then format · or type <span className="tk-icode">/</span> for commands</span>
              </div>
              <form onSubmit={send} className="relative flex items-end gap-1.5 rounded-[22px] border border-border-strong bg-surface-2 p-1.5">
                {slashQuery !== null && slashMatches.length > 0 && (
                  <div className="card tk-pop absolute bottom-full mb-2 left-0 w-[296px] py-1.5 z-50" style={{ boxShadow: 'var(--shadow-lg)' }}>
                    <div className="eyebrow px-3 pb-1.5 pt-1">Commands</div>
                    {slashMatches.map((c, i) => {
                      const Ic = c.icon;
                      return (
                        <button
                          type="button"
                          key={c.cmd}
                          onMouseDown={(e) => { e.preventDefault(); pickSlash(c.cmd); }}
                          onMouseEnter={() => setSlashSel(i)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === slashSel ? 'bg-hover' : ''}`}
                        >
                          <span className="w-8 h-8 rounded-lg bg-surface-2 border border-border grid place-items-center flex-none text-t2"><Ic className="w-[15px] h-[15px]" /></span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-t1">{c.cmd}</span>
                            <span className="block text-[11.5px] text-t3 truncate">{c.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {colonQuery !== null && emojiMatches.length > 0 && (
                  <div className="card absolute bottom-full mb-2 left-0 p-1.5 flex gap-1 z-50" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
                    {emojiMatches.map((item, i) => (
                      <button type="button" key={item.custom ? `c-${item.name}` : item.e} onMouseDown={(e) => { e.preventDefault(); pickColon(item); }} onMouseEnter={() => setColonSel(i)} className="w-8 h-8 grid place-items-center text-xl p-1 rounded-md transition-colors" style={i === colonSel ? { background: 'var(--hover)' } : undefined} title={item.custom ? `:${item.name}:` : undefined}>
                        {item.custom ? <img src={item.url} alt="" className="w-5 h-5 object-contain" /> : item.e}
                      </button>
                    ))}
                  </div>
                )}
                {mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className="card tk-pop absolute bottom-full mb-2 left-0 w-[260px] py-1 z-50" style={{ boxShadow: 'var(--shadow-lg)' }}>
                    {mentionMatches.map((m, i) => (
                      <button
                        type="button"
                        key={m.id ?? m.username}
                        onMouseDown={(e) => { e.preventDefault(); insertMention(m.username); }}
                        onMouseEnter={() => setMentionSel(i)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${i === mentionSel ? 'bg-hover' : ''}`}
                      >
                        {m.special ? (
                          <span className="w-7 h-7 rounded-full grid place-items-center flex-none text-on-accent" style={{ background: 'var(--accent)' }}><AtSign className="w-[14px] h-[14px]" /></span>
                        ) : (
                          <span className="w-7 h-7 rounded-full grid place-items-center flex-none text-[10px] font-semibold text-white overflow-hidden" style={{ background: toneFor(m.username) }}>{initials(m.username)}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-t1">@{m.username}</span>
                          {m.special && <span className="block text-[11px] text-t3 truncate">{m.sub}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <label className="icon-btn w-[34px] h-[34px] border-0 cursor-pointer" title="Attach files">
                  <Paperclip className="w-[18px] h-[18px]" />
                  <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
                </label>
                <label className="icon-btn w-[34px] h-[34px] border-0 cursor-pointer" title="Upload a folder">
                  <FolderUp className="w-[18px] h-[18px]" />
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={(el) => { if (el) { el.setAttribute('webkitdirectory', ''); el.setAttribute('directory', ''); } }}
                    onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }}
                  />
                </label>
                <button type="button" onClick={startRec} className="icon-btn w-[34px] h-[34px] border-0" title="Record voice note"><Mic className="w-[18px] h-[18px]" /></button>
                <button type="button" onClick={() => setShowPollComposer(true)} className="icon-btn w-[34px] h-[34px] border-0" title="Create a poll"><ListChecks className="w-[18px] h-[18px]" /></button>
                <div className="relative" data-menu>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setShowComposerPicker((s) => !s); }} className="icon-btn w-[34px] h-[34px] border-0" title="Emoji & GIFs"><Smile className="w-[18px] h-[18px]" /></button>
                  {showComposerPicker && (
                    <EmojiGifPicker onEmoji={insertEmoji} onGif={sendGif} onClose={() => setShowComposerPicker(false)} />
                  )}
                </div>
                <textarea ref={taRef} rows={1} value={input} onPaste={onPaste} onChange={(e) => { const v = e.target.value; const p = e.target.selectionStart ?? v.length; setInput(v); autoGrow(); notifyTyping(); detectMention(v, p); detectColon(v, p); detectSlash(v, p); try { if (v) localStorage.setItem(`draft_${channel}`, v); else localStorage.removeItem(`draft_${channel}`); } catch { /* ignore */ } }} onKeyDown={onComposerKey} placeholder={`Message ${isChannel ? '#' + channel : headerTitle}`} className="scroll flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-[14.5px] leading-relaxed text-t1 px-1 py-2 max-h-[140px]" />
                <button type="submit" disabled={(!input.trim() && files.length === 0) || uploading} aria-label="Send" className="btn-accent w-[36px] h-[36px] rounded-full flex-none">
                  {uploading ? <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Send className="w-[17px] h-[17px]" />}
                </button>
              </form>
            </>
          )}

          {/* typing — sits under the message box */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 pt-0.5 text-[12px] text-t3 h-4">
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite' }} />
                <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite 0.2s' }} />
                <span className="w-1 h-1 rounded-full bg-t3" style={{ animation: 'tk-dot 1.2s infinite 0.4s' }} />
              </span>
              {typingText}
            </div>
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

      {/* thread panel */}
      {threadRoot && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setThreadRoot(null)} className="fixed inset-0 z-[420] flex justify-end tk-fade" style={{ background: 'rgba(7,7,9,0.45)' }}>
          <motion.div
            initial={{ x: 40, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[440px] max-w-full h-full bg-surface border-l border-border flex flex-col"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <header className="flex items-center gap-2 px-5 h-[62px] flex-none border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-t1">Thread</div>
                <div className="text-xs text-t2">{repliesOf(threadRoot.id).length} {repliesOf(threadRoot.id).length === 1 ? 'reply' : 'replies'}</div>
              </div>
              <button onClick={() => setThreadRoot(null)} className="icon-btn w-8 h-8" aria-label="Close"><X className="w-[15px] h-[15px]" /></button>
            </header>
            <div className="scroll flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <ThreadRow m={threadRoot} />
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-border" />
                <span className="eyebrow" style={{ letterSpacing: '0.04em' }}>{repliesOf(threadRoot.id).length} {repliesOf(threadRoot.id).length === 1 ? 'reply' : 'replies'}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {repliesOf(threadRoot.id).map((r) => <ThreadRow key={r.id} m={r} />)}
            </div>
            <form onSubmit={sendThread} className="p-3 flex-none border-t border-border flex items-center gap-2">
              <input value={threadInput} onChange={(e) => setThreadInput(e.target.value)} placeholder="Reply in thread…" className="tk-input flex-1" autoFocus />
              <button type="submit" disabled={!threadInput.trim()} className="btn-accent w-10 h-10 rounded-full flex-none"><Send className="w-[16px] h-[16px]" /></button>
            </form>
          </motion.div>
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

      {/* in-app file viewer */}
      <FilePreview att={previewAtt} onClose={() => setPreviewAtt(null)} />

      {/* share */}
      {showShare && <ShareModal user={user} channel={channel} title={isChannel ? `#${channel}` : headerTitle} members={members} onClose={() => setShowShare(false)} />}

      {/* poll builder */}
      {showPollComposer && <PollComposer onSubmit={submitPoll} onClose={() => setShowPollComposer(false)} />}
    </div>
  );
}
