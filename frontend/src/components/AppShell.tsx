'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import PostsFeed from '@/components/PostsFeed';
import ProfilePage from '@/components/ProfilePage';
import NotificationManager from '@/components/NotificationManager';
import CommandPalette from '@/components/CommandPalette';
import ShortcutsHelp from '@/components/ShortcutsHelp';
import GlobalSearch from '@/components/GlobalSearch';
import FeaturesPanel from '@/components/FeaturesPanel';
import { initThemeWatcher } from '@/lib/theme';
import { initAccent } from '@/lib/accent';
import { apiUrl } from '@/lib/api';

export default function AppShell({ initialChannel = 'general' }: { initialChannel?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const prevChannelRef = useRef<string>('__posts__');
  const isProfileView = (c: string) => c === '__me__' || c.startsWith('__user__:');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { router.push('/'); return; }
    setUser(JSON.parse(userData));
    setIsSidebarOpen(window.innerWidth >= 1024);
  }, [router]);

  useEffect(() => { initAccent(); return initThemeWatcher(); }, []);

  // Ensure a file-scoped token exists (sessions created before file tokens did won't have one).
  const [, setFileTokenReady] = useState(0);
  useEffect(() => {
    try {
      if (localStorage.getItem('token') && !localStorage.getItem('fileToken')) {
        fetch(apiUrl('/api/auth/file-token'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.fileToken) { localStorage.setItem('fileToken', d.fileToken); setFileTokenReady((n) => n + 1); } })
          .catch(() => {});
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const openProfile = (e: Event) => {
      const name = (e as CustomEvent).detail as string;
      setActiveChannel((curr) => { if (!isProfileView(curr)) prevChannelRef.current = curr; return name ? `__user__:${name}` : '__me__'; });
    };
    const openChannel = (e: Event) => { const c = (e as CustomEvent).detail as string; if (c) setActiveChannel(c); };
    window.addEventListener('open-profile', openProfile);
    window.addEventListener('open-channel', openChannel);
    return () => { window.removeEventListener('open-profile', openProfile); window.removeEventListener('open-channel', openChannel); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = () => {
      fetch(apiUrl('/api/chat/heartbeat'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: document.hasFocus() ? 'ACTIVE' : 'AWAY' }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const int = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(int);
  }, [user]);

  if (!user) return <div className="min-h-screen flex items-center justify-center text-t2 text-sm">Establishing secure connection…</div>;

  return (
    <MotionConfig reducedMotion="user">
      <NotificationManager user={user} />
      <FeaturesPanel />
      <CommandPalette user={user} onNavigate={setActiveChannel} />
      <GlobalSearch onNavigate={setActiveChannel} />
      <ShortcutsHelp />
      <div className="h-screen w-full overflow-hidden">
        <div className="flex h-full w-full overflow-hidden bg-surface">
          <Sidebar
            user={user}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
          />

          <main className="flex-1 flex flex-col relative h-full min-w-0 bg-bg">
            {activeChannel === '__posts__' ? (
              <PostsFeed user={user} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            ) : activeChannel === '__me__' || activeChannel.startsWith('__user__:') ? (
              <ProfilePage
                me={user}
                username={activeChannel === '__me__' ? user.username : activeChannel.slice('__user__:'.length)}
                onNavigate={setActiveChannel}
                onBack={() => setActiveChannel(prevChannelRef.current || '__posts__')}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />
            ) : (
              <ChatArea user={user} channel={activeChannel} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            )}
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
