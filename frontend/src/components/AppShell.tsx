'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import PostsFeed from '@/components/PostsFeed';
import NotificationManager from '@/components/NotificationManager';
import CommandPalette from '@/components/CommandPalette';

export default function AppShell({ initialChannel = 'general' }: { initialChannel?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { router.push('/'); return; }
    setUser(JSON.parse(userData));
    setIsSidebarOpen(window.innerWidth >= 1024);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = () => {
      fetch(`http://${window.location.hostname}:8080/api/chat/heartbeat`, {
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
    <div className="flex h-screen overflow-hidden">
      <NotificationManager user={user} />
      <CommandPalette user={user} onNavigate={setActiveChannel} />
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
        ) : (
          <ChatArea user={user} channel={activeChannel} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        )}
      </main>
    </div>
  );
}
