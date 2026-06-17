import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Paperclip, File, Download, Image as ImageIcon, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatAreaProps {
  user: any;
  channel: string;
  onToggleSidebar: () => void;
}

export default function ChatArea({ user, channel, onToggleSidebar }: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);

  useEffect(() => {
    // Load historical messages
    fetch(`http://${window.location.hostname}:8080/api/chat/messages/${channel}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(r => {
      if (!r.ok) throw new Error('Not OK');
      return r.json();
    })
    .then(data => setMessages(data))
    .catch(console.error);

    // Setup WebSocket using Stomp via simple native WebSocket or SockJS
    // For simplicity without external stomjs, we use a basic polling or raw websocket if Stomp is complex to bundle.
    // Wait, the backend uses Stomp. We need @stomp/stompjs. Let's dynamically import it or use a simpler approach.

    // Instead of raw STOMP, we will fetch periodically for this demo if STOMP isn't loaded,
    // or better, we can just use setInterval to simulate real-time if we don't have stompjs installed.
    // Let's implement a simple poll for robust local network since it's just 12 users.
    const interval = setInterval(() => {
      fetch(`http://${window.location.hostname}:8080/api/chat/messages/${channel}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            throw new Error('Unauthorized');
        }
        if (!r.ok) throw new Error('Not OK');
        return r.json();
      })
      .then(data => {
        if(data.length > messages.length) {
            setMessages(data);
            if (document.hidden) {
                const unread = data.length - messages.length;
                document.title = `(${unread}) TASKIS - New Message`;
            }
        }
      })
      .catch(console.error);
    }, 1000);

    const handleFocus = () => {
        document.title = 'TASKIS';
    };
    window.addEventListener('focus', handleFocus);

    return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
    };
  }, [channel, messages.length]);

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
        const res = await fetch(`http://${window.location.hostname}:8080/api/chat/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
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

    // Since we don't have stompJS ready in the generated code, we will just simulate send via REST endpoint.
    // Wait, we didn't add a REST endpoint for sending! Let's modify the component to do it.
    // Actually, sending via REST is easy if we add it to the backend. I'll just use a mock POST for now,
    // wait I need to add a POST /api/chat/send to the backend!

    // For now we'll just push locally and the poll will sync it later.
    // Let's call the POST /api/chat/send.
    try {
        await fetch(`http://${window.location.hostname}:8080/api/chat/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                content: inputValue,
                channel: channel,
                attachmentUrl,
                attachmentType
            })
        });
        setInputValue('');
        // force immediate poll
    } catch(err) {
        console.error(err);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isDifferentDay = (dateStr1: string, dateStr2: string) => {
    return new Date(dateStr1).toDateString() !== new Date(dateStr2).toDateString();
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/api/chat/unlock-archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ passphrase })
        });
        if (res.ok) {
            setShowUnlockModal(false);
            setPassphrase('');
            setUnlockError('');
            // refetch by just relying on the poll
        } else {
            const err = await res.text();
            setUnlockError(err);
        }
    } catch(err) {
        setUnlockError('Connection error');
    }
  };

  const renderDateDivider = (dateStr: string) => {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label = d.toLocaleDateString();
      if (d.toDateString() === today.toDateString()) label = "Today";
      else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";

      return (
          <div className="flex items-center justify-center my-6 relative group">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative px-4 py-1.5 rounded-full bg-surface-light border border-border text-xs text-text-muted font-bold tracking-widest uppercase hover:text-text cursor-pointer transition-colors z-10 flex items-center gap-2">
                  {label}
                  <span className="opacity-50 text-[10px]">▼</span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-surface-light border border-border rounded-lg shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 overflow-hidden flex flex-col pt-1 pb-1">
                      <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase font-bold tracking-wider">Jump to...</div>
                      <button onClick={() => messagesEndRef.current?.scrollIntoView()} className="px-3 py-2 text-xs text-left hover:bg-bg-hover text-text transition-colors">Today</button>
                      <button onClick={() => setShowUnlockModal(true)} className="px-3 py-2 text-xs text-left hover:bg-bg-hover text-text-muted transition-colors flex items-center justify-between">Last week <span className="text-[8px] border border-border px-1 rounded bg-black/40 text-primary">SECURE</span></button>
                      <button onClick={() => setShowUnlockModal(true)} className="px-3 py-2 text-xs text-left hover:bg-bg-hover text-text-muted transition-colors flex items-center justify-between">Last month <span className="text-[8px] border border-border px-1 rounded bg-black/40 text-primary">SECURE</span></button>
                      <button onClick={() => setShowUnlockModal(true)} className="px-3 py-2 text-xs text-left hover:bg-bg-hover text-text-muted transition-colors flex items-center justify-between">The very beginning <span className="text-[8px] border border-border px-1 rounded bg-black/40 text-primary">SECURE</span></button>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full z-10">
      <header className="glass p-4 flex items-center justify-between border-b border-border shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="p-2 hover:bg-bg-hover rounded-lg text-text-muted hover:text-text transition-colors lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-text">
              <span className="text-primary">#</span> {channel}
            </h2>
            <p className="text-xs text-text-muted">Encrypted P2P Comm Link • E2E Enabled</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => {
          const isMe = msg.sender.username === user.username;
          const showDateDivider = idx === 0 || isDifferentDay(msg.timestamp, messages[idx - 1].timestamp);

          return (
            <React.Fragment key={msg.id || idx}>
              {showDateDivider && renderDateDivider(msg.timestamp)}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
              <div className="flex items-end gap-2 max-w-[80%]">
                {!isMe && msg.sender.avatarUrl && <img src={msg.sender.avatarUrl.startsWith('http') ? msg.sender.avatarUrl : `http://${window.location.hostname}:8080${msg.sender.avatarUrl}`} alt="" className="w-8 h-8 rounded-full border border-border mb-1" />}
                {!isMe && !msg.sender.avatarUrl && <div className="w-8 h-8 rounded-full border border-border mb-1 flex items-center justify-center bg-surface-light text-xs text-text-muted">{msg.sender.username.charAt(0).toUpperCase()}</div>}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-medium text-text-muted">{msg.sender.username}</span>
                    <span className="text-[10px] text-text-muted/50">{formatTime(msg.timestamp)}</span>
                  </div>

                  <div className={`p-3 rounded-2xl ${isMe ? 'bg-primary/20 text-text border border-primary/30 rounded-br-sm glow-border' : 'bg-surface-light text-text border border-border rounded-bl-sm'}`}>
                    {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}

                    {msg.attachmentUrl && (
                      <div className="mt-2">
                        {msg.attachmentType?.startsWith('image/') ? (
                          <motion.img
                            layoutId={`img-${msg.id}`}
                            onClick={() => setSelectedImage(`http://${window.location.hostname}:8080${msg.attachmentUrl}`)}
                            src={`http://${window.location.hostname}:8080${msg.attachmentUrl}`}
                            alt="attachment"
                            className="max-w-xs max-h-64 object-cover rounded-lg border border-border cursor-zoom-in"
                          />
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-surface-light border border-border rounded-xl max-w-sm mt-1">
                            <div className="p-2 bg-primary/20 rounded-lg">
                              <File className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-sm text-text truncate font-medium">
                                {msg.attachmentUrl.split('/').pop()?.split('_').slice(1).join('_') || 'Document'}
                              </span>
                              <span className="text-xs text-text-muted uppercase">
                                {msg.attachmentType?.split('/')[1] || 'FILE'}
                              </span>
                            </div>
                            <a
                              href={`http://${window.location.hostname}:8080${msg.attachmentUrl}`}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto p-2 bg-primary/10 hover:bg-primary/30 rounded-lg transition-colors text-primary"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {channel === 'taskis-bot' ? (
        <div className="p-4 glass border-t border-border text-center text-xs font-bold tracking-widest text-text-muted uppercase">
          SYSTEM CHANNEL (READ-ONLY)
        </div>
      ) : (
        <div className="p-4 glass border-t border-border">
          {file && (
            <div className="mb-2 p-2 bg-surface-light border border-primary/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <File className="w-4 h-4" /> {file.name}
              </div>
              <button onClick={() => setFile(null)} className="text-red-400 text-xs hover:underline">Remove</button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <label className="p-3 text-text-muted hover:text-primary transition-colors cursor-pointer bg-surface-light rounded-xl border border-border hover:border-primary/50">
              <Paperclip className="w-5 h-5" />
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Transmit secure message..."
              className="flex-1 bg-surface-light border border-border rounded-xl py-3 px-4 text-text placeholder-text-muted focus:outline-none glow-border transition-all"
            />

            <button
              type="submit"
              disabled={(!inputValue.trim() && !file) || isUploading}
              className="p-3 bg-primary/20 text-primary border border-primary/50 rounded-xl hover:bg-primary/30 hover:shadow-[0_0_15px_rgba(0,255,204,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
            </button>
          </form>
        </div>
      )}

      {showUnlockModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
            <h3 className="text-red-500 font-bold uppercase tracking-widest text-lg mb-2 flex items-center gap-2">
              RESTRICTED ARCHIVE
            </h3>
            <p className="text-text-muted text-sm mb-6">
              Access to messages older than 48 hours requires clearance.
              <br /><br />
              <span className="text-red-400 font-bold uppercase">Warning:</span> 2 incorrect attempts will result in permanent lock-out.
            </p>

            <form onSubmit={handleUnlock}>
              <input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Enter Passphrase"
                className="w-full bg-surface-light border border-border rounded-xl py-3 px-4 text-text placeholder-text-muted focus:outline-none focus:border-red-500 transition-colors mb-2"
                autoFocus
              />
              {unlockError && <p className="text-red-500 text-xs font-bold mb-4">{unlockError}</p>}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowUnlockModal(false)} className="flex-1 py-2 rounded-xl border border-border text-text hover:bg-bg-hover transition-colors">Abort</button>
                <button type="submit" className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-text transition-colors font-bold tracking-widest uppercase">Unlock</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
            >
              <motion.img
                layoutId={`img-full-${selectedImage}`}
                src={selectedImage}
                alt="Full screen"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl glow-border"
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
