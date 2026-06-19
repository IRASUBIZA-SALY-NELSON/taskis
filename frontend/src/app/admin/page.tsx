'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Copy, Check, RefreshCw } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { initials, toneFor } from '../../components/Sidebar';

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const api = (p: string) => `http://${window.location.hostname}:8080${p}`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { router.push('/'); return; }
    const u = JSON.parse(userData);
    if (u.role !== 'ADMIN' && u.username.toLowerCase() !== 'nelson') { router.push('/chat'); return; }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const res = await fetch(api('/api/admin/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const generateKey = async (username: string) => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(api('/api/admin/keys'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.ok) { setNewUsername(''); fetchData(); } else { alert(await res.text()); }
    } catch (e) { console.error(e); }
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
        const ta = document.createElement('textarea');
        ta.value = keyString;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (err) { console.error('Failed to copy:', err); }
    if (success) {
      setCopiedKey(keyString);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      window.prompt('Copy the key below (Ctrl+C):', keyString);
    }
  };

  const members = users.filter((u: any) => u.username !== 'Taskis Bot');
  const shortKey = (k?: string) => (k ? `${k.slice(0, 8)}…${k.slice(-6)}` : 'N/A');

  return (
    <div className="scroll h-screen overflow-y-auto bg-bg">
      {/* header */}
      <header className="flex items-center gap-[13px] px-7 h-[62px] border-b border-border sticky top-0 bg-bg/90 backdrop-blur z-10">
        <button onClick={() => router.push('/chat')} aria-label="Back" className="icon-btn w-8 h-8">
          <ChevronLeft className="w-[15px] h-[15px]" />
        </button>
        <div className="flex-1">
          <div className="text-[15.5px] font-semibold text-t1 leading-tight">Admin</div>
          <div className="text-xs text-t2">Manage access for this team</div>
        </div>
        <ThemeToggle />
      </header>

      <div className="max-w-[860px] mx-auto px-7 pt-[30px] pb-16 flex flex-col gap-[26px]">
        {/* generate */}
        <section className="card p-[22px]">
          <div className="eyebrow mb-1">Invite</div>
          <h2 className="text-[17px] font-semibold text-t1 mb-1">Generate a registration key</h2>
          <p className="text-[13.5px] text-t2 mb-4 leading-relaxed max-w-[520px]">
            Each key is single-use and assigned to one operative. Share it over a secure channel.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); generateKey(newUsername); }}
            className="flex gap-2.5 max-w-[520px]"
          >
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Operative codename (e.g. Cipher)"
              className="tk-input flex-1"
            />
            <button type="submit" disabled={loading || !newUsername.trim()} className="btn-accent px-[18px] text-sm whitespace-nowrap">
              {loading ? <span className="w-[15px] h-[15px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Plus className="w-[15px] h-[15px]" />}
              Generate key
            </button>
          </form>
        </section>

        {/* members + keys */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 px-[22px] pt-[18px] pb-3.5 border-b border-border">
            <h2 className="text-[15px] font-semibold text-t1 flex-1">Members &amp; keys</h2>
            <span className="text-[12.5px] text-t3">{members.length} of 12</span>
          </div>

          {/* column header */}
          <div className="hidden sm:grid items-center gap-3.5 px-[22px] py-2.5 border-b border-border eyebrow" style={{ gridTemplateColumns: '1fr 220px 90px 80px', letterSpacing: '0.05em' }}>
            <span>Operative</span><span>Access key</span><span>Role</span><span className="text-right">Actions</span>
          </div>

          {members.map((u: any) => (
            <div key={u.id} className="grid items-center gap-3.5 px-[22px] py-3 border-b border-border last:border-b-0" style={{ gridTemplateColumns: '1fr 220px 90px 80px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-[34px] h-[34px] rounded-full grid place-items-center flex-none text-[13px] font-semibold text-white" style={{ background: toneFor(u.username) }}>
                  {initials(u.username)}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-t1 truncate">{u.username}</div>
                  <div className="text-[12.5px] text-t3">@{u.username.toLowerCase()}</div>
                </div>
              </div>
              <span className="font-mono text-[13px] text-t2 truncate hidden sm:block" title={u.registrationKey || ''}>{shortKey(u.registrationKey)}</span>
              <span className="hidden sm:block">
                {u.role === 'ADMIN' ? (
                  <span className="text-[11.5px] font-semibold text-accent-text bg-accent-soft rounded-full px-2.5 py-0.5">Admin</span>
                ) : (
                  <span className="text-[11.5px] font-medium text-t3 bg-surface-2 border border-border rounded-full px-2.5 py-0.5">Operative</span>
                )}
              </span>
              <div className="flex justify-end gap-1">
                <button onClick={() => copyToClipboard(u.registrationKey)} disabled={!u.registrationKey} className="icon-btn w-[30px] h-[30px] border-0 disabled:opacity-40" title="Copy key">
                  {copiedKey === u.registrationKey ? <Check className="w-[15px] h-[15px] text-online" /> : <Copy className="w-[15px] h-[15px]" />}
                </button>
                <button
                  onClick={() => { if (confirm(`Regenerate access key for ${u.username}? This revokes the previous key.`)) generateKey(u.username); }}
                  className="icon-btn w-[30px] h-[30px] border-0"
                  title="Regenerate key"
                >
                  <RefreshCw className="w-[15px] h-[15px]" />
                </button>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="px-[22px] py-12 text-center text-t3 text-sm">No personnel found.</div>
          )}
        </section>
      </div>
    </div>
  );
}
