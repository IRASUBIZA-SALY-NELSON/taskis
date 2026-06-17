import React from 'react';
import { Hash, Shield, Users, LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  user: any;
  activeChannel: string;
  setActiveChannel: (c: string) => void;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
}

export default function Sidebar({ user, activeChannel, setActiveChannel, isOpen, setIsOpen }: SidebarProps) {
  const router = useRouter();

  const channels = ['general', 'intel', 'alerts', 'confidential'];

  const [operatives, setOperatives] = React.useState<any[]>([]);

  const [unread, setUnread] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    // update current channel lastRead
    if (activeChannel) {
        const lastReadStr = localStorage.getItem('lastRead');
        const lastRead = lastReadStr ? JSON.parse(lastReadStr) : {};
        lastRead[activeChannel] = Date.now();
        localStorage.setItem('lastRead', JSON.stringify(lastRead));
    }

    const fetchData = () => {
      fetch(`http://${window.location.hostname}:8080/api/chat/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Not OK');
        return res.json();
      })
      .then(data => {
          if(Array.isArray(data)) setOperatives(data.filter(u => u.username !== user.username && u.username !== 'Taskis Bot'));
      })
      .catch(console.error);

      fetch(`http://${window.location.hostname}:8080/api/chat/channels/latest`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Not OK');
        return res.json();
      })
      .then(data => {
          const lastReadStr = localStorage.getItem('lastRead');
          const lastRead = lastReadStr ? JSON.parse(lastReadStr) : {};
          const newUnread: Record<string, boolean> = {};
          for (const ch in data) {
              const latestDate = new Date(data[ch]).getTime();
              const readDate = lastRead[ch] || 0;
              if (latestDate > readDate && ch !== activeChannel) {
                  newUnread[ch] = true;
              }
          }
          setUnread(newUnread);
      })
      .catch(console.error);
    };
    fetchData();
    const int = setInterval(fetchData, 5000);
    return () => clearInterval(int);
  }, [user.username, activeChannel]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    try {
        const uploadRes = await fetch(`http://${window.location.hostname}:8080/api/chat/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        if (!uploadRes.ok) throw new Error('Upload failed: ' + uploadRes.status);
        const uploadData = await uploadRes.json();

        const res = await fetch(`http://${window.location.hostname}:8080/api/chat/avatar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ avatarUrl: uploadData.url })
        });

        if (res.ok) {
            const updatedUser = await res.json();
            localStorage.setItem('user', JSON.stringify(updatedUser));
            window.location.reload();
        } else {
            alert(await res.text());
        }
    } catch (err) {
        console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const getDmChannel = (otherId: number) => {
      const ids = [user.id, otherId].sort();
      return `dm_${ids[0]}_${ids[1]}`;
  };

  if (!isOpen) return null;

  return (
    <aside className="w-64 glass border-r border-border h-full flex flex-col z-20">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary glow-text">TASKIS</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Secure Channels</div>
        <div className="space-y-1">
          {channels.map(c => (
            <button
              key={c}
              onClick={() => setActiveChannel(c)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeChannel === c ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-text hover:bg-surface-light/50 hover:text-primary/80'}`}
            >
              <Hash className="w-4 h-4 opacity-50" />
              <span className="flex-1 text-left">{c.charAt(0).toUpperCase() + c.slice(1)}</span>
              {unread[c] && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>
          ))}
        </div>



        <div className="px-4 mt-8 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">System Bots</div>
        <div className="space-y-1">
          <button
            onClick={() => setActiveChannel('taskis-bot')}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeChannel === 'taskis-bot' ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-text hover:bg-surface-light/50 hover:text-primary/80'}`}
          >
            <div className="relative">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=TaskisBot" alt="" className="w-6 h-6 rounded-full bg-surface-light border border-border" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-primary animate-pulse"></span>
            </div>
            <span className="flex-1 text-left font-medium">Taskis Bot</span>
            {unread['taskis-bot'] && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
        </div>

        <div className="px-4 mt-8 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Operatives ({operatives.filter(op => op.username !== 'Taskis Bot').length + 1}/12)</div>
        <div className="space-y-1">
          {operatives.map(op => {
              const channelId = getDmChannel(op.id);
              return (
                <button
                  key={op.id}
                  onClick={() => setActiveChannel(channelId)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeChannel === channelId ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-text hover:bg-surface-light/50 hover:text-primary/80'}`}
                >
                  <div className="relative">
                    {op.avatarUrl ? (
                        <img src={op.avatarUrl.startsWith('http') ? op.avatarUrl : `http://${window.location.hostname}:8080${op.avatarUrl}`} alt="" className="w-6 h-6 rounded-full bg-surface-light border border-border object-cover" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-light border border-border flex items-center justify-center text-[10px] text-text-muted">{op.username.charAt(0).toUpperCase()}</div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${op.status === 'ACTIVE' ? 'bg-primary animate-pulse' : 'bg-gray-500'}`}></span>
                  </div>
                  <span className="flex-1 text-left">{op.username}</span>
                  {unread[channelId] && (
                    <span className="text-[10px] font-bold bg-red-500 text-text px-1.5 py-0.5 rounded-full">New</span>
                  )}
                </button>
              );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-border bg-surface-light/30">
        <div className="flex items-center gap-3 mb-4">
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" />
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `http://${window.location.hostname}:8080${user.avatarUrl}`}
              alt="avatar"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full bg-surface-light border border-primary/30 cursor-pointer hover:opacity-80 transition-opacity object-cover"
              title="Change Profile Picture"
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full bg-surface-light border border-primary/30 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center text-text-muted text-sm"
              title="Change Profile Picture"
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-text truncate">{user.username}</div>
            <div className="text-xs text-primary flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse"></span> Online
            </div>
          </div>
          <ThemeToggle />
        </div>
        {(user.role === 'ADMIN' || user.username.toLowerCase() === 'nelson') && (
          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center justify-center gap-2 py-2 mb-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
          >
            <Shield className="w-4 h-4" /> Admin Panel
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" /> Disconnect
        </button>
      </div>
    </aside>
  );
}
