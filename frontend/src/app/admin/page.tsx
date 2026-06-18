'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, Users, ArrowLeft, Plus, Copy, Check, RefreshCw } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'ADMIN' && user.username.toLowerCase() !== 'nelson') {
      router.push('/chat');
      return;
    }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const usersRes = await fetch(`http://${window.location.hostname}:8080/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(await usersRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const generateKey = async (username: string) => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8080/api/admin/keys`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
          setNewUsername('');
          fetchData();
      } else {
          alert(await res.text());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const copyToClipboard = async (keyString: string) => {
    if (!keyString) return;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(keyString);
        success = true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = keyString;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      }
} catch (err) {
      console.error('Failed to copy text: ', err);
    }
    if (success) {
      setCopiedKey(keyString);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      // Fallback: show full key in a prompt so user can manuallycopy
      window.prompt('Copy the key below (Ctrl+C):', keyString);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/chat')} className="p-2 bg-surface-light border border-border rounded-xl hover:bg-bg-hover transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-primary">
              <Shield className="text-primary" /> SECURE ADMIN DASHBOARD
            </h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Registration Form */}
          <div className="bg-surface-light/30 p-6 rounded-2xl border border-border lg:col-span-1 h-fit">
            <h2 className="text-xl font-bold tracking-widest uppercase flex items-center gap-2 mb-6">
              <Plus className="w-5 h-5 text-primary" /> Register Operative
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider font-bold mb-2 block">Assign Codename</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="e.g. Agent-X"
                  className="w-full bg-background border border-border rounded-lg p-3 focus:outline-none focus:border-primary transition-colors text-text"
                />
              </div>
              <button
                onClick={() => generateKey(newUsername)}
                disabled={loading || !newUsername.trim()}
                className="w-full py-3 bg-primary/20 text-primary border border-primary/50 rounded-xl hover:bg-primary hover:text-background transition-all font-bold tracking-widest uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Key className="w-4 h-4" /> Generate Access Key
              </button>
            </div>
          </div>

          {/* Personnel Table */}
          <div className="bg-surface-light/30 p-6 rounded-2xl border border-border overflow-x-auto lg:col-span-2">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
               <Users className="w-5 h-5 text-primary" /> Active Personnel
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs tracking-widest uppercase text-text-muted">
                  <th className="p-4 font-medium">Codename</th>
                  <th className="p-4 font-medium">Clearance</th>
                  <th className="p-4 font-medium">Access Key</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter((u: any) => u.username !== 'Taskis Bot').map((u: any) => (
                  <tr key={u.id} className="border-b border-border hover:bg-bg-hover transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary border border-primary/50 text-xs">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold">{u.username}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-widest ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-primary/20 text-primary border border-primary/50'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 max-w-[200px]">
                       <div className="truncate font-mono text-xs text-text-muted bg-background/50 px-2 py-1 rounded border border-border">
                           {u.registrationKey || 'N/A'}
                       </div>
                    </td>
                    <td className="p-4 text-right">
                       <div className="flex justify-end gap-2">
                           <button
                             onClick={() => copyToClipboard(u.registrationKey)}
                             disabled={!u.registrationKey}
                             className="p-2 bg-surface-light border border-border rounded hover:bg-bg-hover transition-colors disabled:opacity-50"
                             title="Copy Key"
                           >
                             {copiedKey === u.registrationKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-primary" />}
                           </button>
                           <button
                             onClick={() => {
                                 if (confirm(`Regenerate access key for ${u.username}? This revokes the previous key.`)) {
                                     generateKey(u.username);
                                 }
                             }}
                             className="p-2 bg-surface-light border border-border rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
                             title="Regenerate Key"
                           >
                             <RefreshCw className="w-4 h-4" />
                           </button>
                       </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-text-muted">No personnel found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
