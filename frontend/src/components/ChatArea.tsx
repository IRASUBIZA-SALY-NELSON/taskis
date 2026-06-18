'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, FileText, Download, Lock, Menu, X, AlertCircle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initials, toneFor } from './Sidebar';

interface ChatAreaProps {
  user: any;
  channel: string;
  onToggleSidebar: () => void;
}

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
  const isBot = channel === 'taskis-bot';
  const isDm = channel.startsWith('dm_');
  const isChannel = !isBot && !isDm;

  const headerTitle = isBot ? 'Taskis Bot' : isDm ? 'Direct message' : channel;
  const headerSub = isBot ? 'Automated · read-only' : 'End-to-end encrypted';

  useEffect(() => {
    setLoading(true);
    let first = true;
    const load = () => {
      fetch(api(`/api/chat/messages/${channel}`), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then((r) => {
          if (r.status === 401 || r.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            throw new Error('Unauthorized');
          }
          if (!r.ok) throw new Error('Not OK');
          return r.json();
        })
        .then((data) => {
          if (first) { setMessages(data); setLoading(false); first = false; return; }
          setMessages((prev) => {
            if (data.length > prev.length && document.hidden) {
              document.title = `(${data.length - prev.length}) Taskis`;
            }
            return data.length !== prev.length ? data : prev;
          });
        })
        .catch((e) => { setLoading(false); console.error(e); });
    };
    load();
    const interval = setInterval(load, 1000);
    const handleFocus = () => { document.title = 'Taskis'; };
    window.addEventListener('focus', handleFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', handleFocus); };
  }, [channel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !file) return;
    let attachmentUrl = null;
    let attachmentType = null;
    if (file) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(api('/api/chat/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        attachmentUrl = data.url;
        attachmentType = data.type;
      } catch (err) {
        console.error('Upload failed', err);
      }
      setIsUploading(false);
      setFile(null);
    }
    try {
      await fetch(api('/api/chat/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ content: inputValue, channel, attachmentUrl, attachmentType }),
      });
      setInputValue('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockLoading(true);
    try {
      const res = await fetch(api('/api/chat/unlock-archive'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        setShowUnlockModal(false);
        setPassphrase('');
        setUnlockError('');
      } else {
        setUnlockError(await res.text());
      }
    } catch (err) {
      setUnlockError('Connection error');
    }
    setUnlockLoading(false);
  };

  const formatTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

  const dividerLabel = (s: string) => {
    const d = new Date(s);
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  };

  const fileNameOf = (url: string) => url.split('/').pop()?.split('_').slice(1).join('_') || 'Document';

  const Attachment = ({ msg, mine }: { msg: any; mine: boolean }) => {
    if (!msg.attachmentUrl) return null;
    const full = api(msg.attachmentUrl);
    if (msg.attachmentType?.startsWith('image/')) {
      return (
        <button
          onClick={() => setSelectedImage(full)}
          className="block w-[282px] max-w-full rounded-[14px] overflow-hidden border border-border cursor-zoom-in hover:border-border-strong transition-colors p-0 bg-transparent"
        >
          <img src={full} alt="attachment" className="w-full max-h-[260px] object-cover block" />
        </button>
      );
    }
    return (
      <div className="flex items-center gap-[11px] px-3 py-2.5 rounded-xl border border-border w-[264px] max-w-full" style={{ background: mine ? 'var(--bubble-own)' : 'var(--surface-2)' }}>
        <span className="w-[34px] h-[34px] rounded-lg bg-surface-3 grid place-items-center flex-none text-t2">
          <FileText className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-t1 truncate">{fileNameOf(msg.attachmentUrl)}</div>
          <div className="text-xs text-t3 uppercase">{msg.attachmentType?.split('/')[1] || 'file'}</div>
        </div>
        <a href={full} download target="_blank" rel="noreferrer" className="icon-btn w-[30px] h-[30px] border-0" aria-label="Download">
          <Download className="w-[15px] h-[15px]" />
        </a>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <header className="flex items-center gap-[13px] px-[22px] h-[62px] flex-none border-b border-border">
        <button onClick={onToggleSidebar} className="icon-btn w-8 h-8 lg:hidden" aria-label="Toggle sidebar">
          <Menu className="w-[15px] h-[15px]" />
        </button>
        {isChannel && <span className="text-[22px] font-medium text-t3 leading-none">#</span>}
        {isBot && <span className="w-[30px] h-[30px] rounded-lg bg-accent-soft text-accent-text text-[13px] font-bold grid place-items-center flex-none">TB</span>}
        {isDm && <span className="w-[30px] h-[30px] rounded-full grid place-items-center flex-none text-xs font-semibold text-white" style={{ background: toneFor(channel) }}>{initials(headerTitle)}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold text-t1 leading-tight truncate">{headerTitle}</div>
          <div className="flex items-center gap-1.5 text-xs text-t2 mt-px">
            <Lock className="w-[11px] h-[11px]" />
            {headerSub}
          </div>
        </div>
      </header>

      {/* messages */}
      <div className="scroll flex-1 overflow-y-auto px-[22px] pt-4 pb-2">
        {!loading && messages.length > 0 && (
          <button
            onClick={() => { setUnlockError(''); setShowUnlockModal(true); }}
            className="flex items-center justify-center gap-2 mx-auto mb-2 px-3.5 py-1.5 rounded-full bg-surface-2 border border-border text-[12px] text-t2 hover:text-t1 hover:border-border-strong transition-colors"
          >
            <Lock className="w-[12px] h-[12px]" />
            Older history is sealed · <span className="text-accent-text font-medium">unlock archive</span>
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
            <div className="w-[54px] h-[54px] rounded-[14px] bg-surface-2 border border-border grid place-items-center text-t3">
              <MessageSquare className="w-[22px] h-[22px]" />
            </div>
            <div>
              <div className="text-base font-semibold text-t1">No messages yet</div>
              <div className="text-[13.5px] text-t2 mt-1 max-w-[300px] leading-relaxed">
                Start the conversation. Every message in {isChannel ? `#${channel}` : 'this thread'} is end-to-end encrypted.
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender.username === user.username;
            const showDivider = idx === 0 || !sameDay(msg.timestamp, messages[idx - 1].timestamp);
            const src = msg.sender.avatarUrl
              ? (msg.sender.avatarUrl.startsWith('http') ? msg.sender.avatarUrl : api(msg.sender.avatarUrl))
              : null;
            return (
              <React.Fragment key={msg.id || idx}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-[18px]">
                    <div className="flex-1 h-px bg-border" />
                    <span className="eyebrow" style={{ letterSpacing: '0.04em' }}>{dividerLabel(msg.timestamp)}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                {isMe ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-row-reverse mt-3.5">
                    <div className="min-w-0 max-w-[76%] flex flex-col items-end">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[11px] text-t3">{formatTime(msg.timestamp)}</span>
                        <span className="text-[13px] font-semibold text-t1">You</span>
                      </div>
                      <div className="flex flex-col gap-1 items-end w-full">
                        {msg.content && (
                          <div className="px-[13px] py-[9px] text-[14.5px] leading-relaxed text-t1 border border-border whitespace-pre-wrap break-words" style={{ background: 'var(--bubble-own)', borderRadius: '15px 5px 15px 15px' }}>
                            {msg.content}
                          </div>
                        )}
                        <Attachment msg={msg} mine />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-[11px] mt-3.5 items-start">
                    <span className="w-7 h-7 rounded-full grid place-items-center flex-none text-[11px] font-semibold text-white mt-0.5" style={{ background: src ? 'transparent' : toneFor(msg.sender.username) }}>
                      {src ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" /> : initials(msg.sender.username)}
                    </span>
                    <div className="min-w-0 max-w-[76%]">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-t1">{msg.sender.username}</span>
                        <span className="text-[11px] text-t3">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className="flex flex-col gap-1 items-start">
                        {msg.content && (
                          <div className="px-[13px] py-[9px] text-[14.5px] leading-relaxed text-t1 border border-border whitespace-pre-wrap break-words" style={{ background: 'var(--bubble-other)', borderRadius: '5px 15px 15px 15px' }}>
                            {msg.content}
                          </div>
                        )}
                        <Attachment msg={msg} mine={false} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* composer */}
      {isBot ? (
        <div className="px-[22px] py-[17px] flex-none border-t border-border flex items-center justify-center gap-2 text-t3 text-[13px]">
          <Lock className="w-[14px] h-[14px]" />
          Taskis Bot is read-only — replies are automated.
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="px-[22px] pt-[13px] pb-[18px] flex-none border-t border-border">
          {file && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-surface-2 border border-accent-soft flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-accent-text">
                <FileText className="w-4 h-4" /> {file.name}
              </div>
              <button type="button" onClick={() => setFile(null)} className="text-danger text-xs hover:underline">Remove</button>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-[14px] border border-border-strong bg-surface-2 p-1.5">
            <label className="icon-btn w-[34px] h-[34px] border-0 cursor-pointer">
              <Paperclip className="w-[18px] h-[18px]" />
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Message ${isChannel ? '#' + channel : headerTitle}`}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14.5px] text-t1 px-1 py-2"
            />
            <button
              type="submit"
              disabled={(!inputValue.trim() && !file) || isUploading}
              aria-label="Send"
              className="btn-accent w-[34px] h-[34px] rounded-[10px] flex-none"
            >
              {isUploading ? <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Send className="w-[17px] h-[17px]" />}
            </button>
          </div>
        </form>
      )}

      {/* archive modal */}
      {showUnlockModal && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setShowUnlockModal(false)} className="fixed inset-0 z-[400] flex items-center justify-center p-6 tk-fade" style={{ background: 'rgba(7,7,9,0.62)', backdropFilter: 'blur(2px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="card tk-pop w-[398px] max-w-full p-7" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
            <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border-strong grid place-items-center text-t2 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <div className="eyebrow mb-[7px]" style={{ letterSpacing: '0.14em' }}>Restricted</div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">Open restricted archive</h2>
            <p className="text-[13.5px] leading-[1.55] text-t2 mb-5">
              Messages older than 48 hours are sealed. Enter the archive passphrase to unlock the full history.
              <br />
              <span className="text-danger font-medium">2 incorrect attempts will lock this account.</span>
            </p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Archive passphrase"
                autoFocus
                className={`tk-input ${unlockError ? 'is-error' : ''}`}
              />
              {unlockError && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[12.5px] text-danger">
                  <AlertCircle className="w-[13px] h-[13px] flex-none" />
                  <span>{unlockError}</span>
                </div>
              )}
              <div className="flex gap-2.5 mt-[22px]">
                <button type="button" onClick={() => setShowUnlockModal(false)} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
                <button type="submit" disabled={unlockLoading} className="btn-accent flex-1 py-[11px] text-sm">
                  {unlockLoading && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />}
                  <span>Unlock</span>
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
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="fixed inset-0 z-[400] flex items-center justify-center p-12 cursor-zoom-out"
              style={{ background: 'rgba(0,0,0,0.86)' }}
            >
              <button onClick={() => setSelectedImage(null)} aria-label="Close" className="fixed top-[22px] right-[22px] w-[38px] h-[38px] grid place-items-center rounded-[10px] text-white cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}>
                <X className="w-[18px] h-[18px]" />
              </button>
              <motion.img
                initial={{ scale: 0.97 }} animate={{ scale: 1 }}
                src={selectedImage} alt="Full screen"
                onClick={(e) => e.stopPropagation()}
                className="max-w-full max-h-full object-contain rounded-xl"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
