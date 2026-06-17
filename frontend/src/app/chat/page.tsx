'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';

export default function ChatLayout() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState('general');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/');
      return;
    }

    setUser(JSON.parse(userData));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = () => {
        fetch(`http://${window.location.hostname}:8080/api/chat/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: document.hasFocus() ? 'ACTIVE' : 'AWAY' })
        }).catch(console.error);
    };
    sendHeartbeat();
    const int = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(int);
  }, [user]);

  if (!user) return <div className="min-h-screen bg-background flex items-center justify-center text-primary glow-text">Establishing Secure Connection...</div>;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        user={user}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col relative h-full">
        {/* Background glow for the chat area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-primary/5 blur-[120px] pointer-events-none z-0" />

        <ChatArea
          user={user}
          channel={activeChannel}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </main>
    </div>
  );
}
