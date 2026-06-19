'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Copy, Check, RefreshCw, Power, Trash2, KeyRound } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { initials, toneFor } from '../../components/Sidebar';

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
  const authJson = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
  const keyByString = (s: string) => keys.find((k) => k.keyString === s);

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
      const [uRes, kRes] = await Promise.all([
        fetch(api('/api/admin/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(api('/api/admin/keys'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);
      setUsers(await uRes.json());
      setKeys(await kRes.json());
    } catch (e) { console.error(e); }
  };

  const setActive = async (id: number, active: boolean) => {
    await fetch(api(`/api/admin/users/${id}/active`), { method: 'POST', headers: authJson(), body: JSON.stringify({ active }) });
    fetchData();
  };

  const removeUser = async (id: number, name: string) => {
    if (!confirm(`Remove ${name}? This deletes the account and revokes their key.`)) return;
    await fetch(api(`/api/admin/users/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
  };

  const revokeKey = async (keyId: number, name: string) => {
    if (!confirm(`Revoke ${name}'s access key? They won't be able to register with it.`)) return;
    await fetch(api(`/api/admin/keys/${keyId}/revoke`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
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
          <div className="hidden sm:grid items-center gap-3.5 px-[22px] py-2.5 border-b border-border eyebrow" style={{ gridTemplateColumns: '1fr 170px 150px', letterSpacing: '0.05em' }}>
            <span>Operative</span><span>Access key</span><span className="text-right">Actions</span>
          </div>

          {members.map((u: any) => {
            const k = keyByString(u.registrationKey);
            const isAdmin = u.role === 'ADMIN';
            const inactive = u.active === false;
            const keyStatus = k?.revoked ? 'Revoked' : k?.isUsed ? 'Used' : 'Active';
            const keyColor = k?.revoked ? 'var(--danger)' : k?.isUsed ? 'var(--t3)' : 'var(--online)';
            return (
            <div key={u.id} className={`grid items-center gap-3.5 px-[22px] py-3 border-b border-border last:border-b-0 ${inactive ? 'opacity-55' : ''}`} style={{ gridTemplateColumns: '1fr 170px 150px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-[34px] h-[34px] rounded-full grid place-items-center flex-none text-[13px] font-semibold text-white" style={{ background: toneFor(u.username) }}>
                  {initials(u.username)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-t1 truncate">{u.displayName || u.username}</span>
                    {isAdmin && <span className="text-[10.5px] font-semibold text-accent-text bg-accent-soft rounded-full px-2 py-0.5">Admin</span>}
                    {inactive && <span className="text-[10.5px] font-medium text-danger bg-danger-soft rounded-full px-2 py-0.5">Inactive</span>}
                  </div>
                  <div className="text-[12.5px] text-t3">@{u.username.toLowerCase()}</div>
                </div>
              </div>
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="font-mono text-[13px] text-t2 truncate" title={u.registrationKey || ''}>{shortKey(u.registrationKey)}</span>
                {u.registrationKey && (
                  <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: keyColor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: keyColor }} />{keyStatus}
                  </span>
                )}
              </div>
              <div className="flex justify-end gap-1">
                <button onClick={() => copyToClipboard(u.registrationKey)} disabled={!u.registrationKey} className="icon-btn w-[30px] h-[30px] border-0 disabled:opacity-40" title="Copy key">
                  {copiedKey === u.registrationKey ? <Check className="w-[15px] h-[15px] text-online" /> : <Copy className="w-[15px] h-[15px]" />}
                </button>
                <button onClick={() => { if (confirm(`Regenerate access key for ${u.username}? This replaces the previous key.`)) generateKey(u.username); }} className="icon-btn w-[30px] h-[30px] border-0" title="Regenerate key">
                  <RefreshCw className="w-[15px] h-[15px]" />
                </button>
                {!isAdmin && k && !k.revoked && (
                  <button onClick={() => revokeKey(k.id, u.username)} className="icon-btn w-[30px] h-[30px] border-0" title="Revoke key"><KeyRound className="w-[15px] h-[15px]" /></button>
                )}
                {!isAdmin && (
                  <button onClick={() => setActive(u.id, inactive)} className="icon-btn w-[30px] h-[30px] border-0" title={inactive ? 'Reactivate' : 'Deactivate'} style={inactive ? { color: 'var(--online)' } : undefined}><Power className="w-[15px] h-[15px]" /></button>
                )}
                {!isAdmin && (
                  <button onClick={() => removeUser(u.id, u.username)} className="icon-btn w-[30px] h-[30px] border-0 hover:!text-danger" title="Remove member"><Trash2 className="w-[15px] h-[15px]" /></button>
                )}
              </div>
            </div>
            );
          })}

          {members.length === 0 && (
            <div className="px-[22px] py-12 text-center text-t3 text-sm">No personnel found.</div>
          )}
        </section>
      </div>
    </div>
  );
}
