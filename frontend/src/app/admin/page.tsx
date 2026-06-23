'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Copy, Check, RefreshCw, Power, Trash2, KeyRound, Users, Activity, MessageSquare, Newspaper, Flag, Crown, ArrowUpDown, Skull, ShieldAlert } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { initials, toneFor } from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

export default function AdminDashboard() {
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [destruct, setDestruct] = useState<{ kind: 'all' | 'user'; user?: any } | null>(null);
  const [destructText, setDestructText] = useState('');
  const [destructing, setDestructing] = useState(false);

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
      const [uRes, kRes, rRes, sRes] = await Promise.all([
        fetch(api('/api/admin/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(api('/api/admin/keys'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(api('/api/reports'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(api('/api/admin/stats'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);
      setUsers(await uRes.json());
      setKeys(await kRes.json());
      if (rRes.ok) setReports(await rRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (e) { console.error(e); }
  };

  const resolveReport = async (id: number) => {
    await fetch(api(`/api/reports/${id}/resolve`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
  };
  const dismissReport = async (id: number) => {
    await fetch(api(`/api/reports/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
  };

  const setActive = async (id: number, active: boolean) => {
    await fetch(api(`/api/admin/users/${id}/active`), { method: 'POST', headers: authJson(), body: JSON.stringify({ active }) });
    fetchData();
  };

  const setRole = async (id: number, role: string, name: string) => {
    if (!(await confirm({ title: role === 'ADMIN' ? `Make ${name} an admin?` : `Demote ${name} to member?`, body: role === 'ADMIN' ? 'Admins can manage everyone and access the danger zone.' : 'They lose admin powers.', confirmText: role === 'ADMIN' ? 'Promote' : 'Demote' }))) return;
    await fetch(api(`/api/admin/users/${id}/role`), { method: 'POST', headers: authJson(), body: JSON.stringify({ role }) });
    fetchData();
    toast(role === 'ADMIN' ? `${name} is now an admin` : `${name} demoted`, 'success');
  };

  const runDestruct = async () => {
    if (destructText !== 'DESTRUCT' || !destruct) return;
    setDestructing(true);
    try {
      if (destruct.kind === 'all') {
        const r = await fetch(api('/api/admin/self-destruct'), { method: 'POST', headers: authJson(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) { const d = await r.json(); toast(`Wiped. ${d.filesRemoved ?? 0} files removed.`, 'success'); }
        else toast((await r.text()) || 'Failed', 'error');
      } else {
        const r = await fetch(api(`/api/admin/destruct-user/${destruct.user.id}`), { method: 'POST', headers: authJson(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) toast(`${destruct.user.username} destructed`, 'success');
        else toast((await r.text()) || 'Failed', 'error');
      }
    } catch { toast('Network error', 'error'); }
    setDestructing(false);
    setDestruct(null);
    setDestructText('');
    fetchData();
  };

  const removeUser = async (id: number, name: string) => {
    if (!(await confirm({ title: `Remove ${name}?`, body: 'This deletes the account and revokes their key.', confirmText: 'Remove', danger: true }))) return;
    await fetch(api(`/api/admin/users/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
    toast(`${name} removed`, 'success');
  };

  const revokeKey = async (keyId: number, name: string) => {
    if (!(await confirm({ title: `Revoke ${name}'s key?`, body: "They won't be able to register with it.", confirmText: 'Revoke', danger: true }))) return;
    await fetch(api(`/api/admin/keys/${keyId}/revoke`), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    fetchData();
    toast('Key revoked', 'success');
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
      if (res.ok) { setNewUsername(''); fetchData(); toast('Key generated', 'success'); } else { toast((await res.text()) || 'Failed', 'error'); }
    } catch (e) { toast('Network error', 'error'); }
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
      toast('Access key copied', 'success');
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
        {/* dashboard stats */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: Users, label: 'Members', value: stats.users },
              { icon: Activity, label: 'Active now', value: stats.activeNow, accent: true },
              { icon: MessageSquare, label: 'Messages', value: stats.messages },
              { icon: Newspaper, label: 'Posts', value: stats.posts },
              { icon: Flag, label: 'Reports', value: stats.reports },
              { icon: KeyRound, label: 'Keys', value: stats.keys },
            ].map((s) => (
              <div key={s.label} className="card p-3.5">
                <s.icon className="w-[15px] h-[15px] mb-1.5" style={{ color: s.accent ? 'var(--online)' : 'var(--t3)' }} />
                <div className="text-[20px] font-semibold text-t1 leading-none tabular-nums">{s.value ?? '—'}</div>
                <div className="text-[11.5px] text-t3 mt-1">{s.label}</div>
              </div>
            ))}
          </section>
        )}

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
                <button onClick={async () => { if (await confirm({ title: `Regenerate key for ${u.username}?`, body: 'This replaces their previous key.', confirmText: 'Regenerate' })) generateKey(u.username); }} className="icon-btn w-[30px] h-[30px] border-0" title="Regenerate key">
                  <RefreshCw className="w-[15px] h-[15px]" />
                </button>
                {!isAdmin && k && !k.revoked && (
                  <button onClick={() => revokeKey(k.id, u.username)} className="icon-btn w-[30px] h-[30px] border-0" title="Revoke key"><KeyRound className="w-[15px] h-[15px]" /></button>
                )}
                <button onClick={() => setRole(u.id, isAdmin ? 'USER' : 'ADMIN', u.username)} className="icon-btn w-[30px] h-[30px] border-0" title={isAdmin ? 'Demote to member' : 'Make admin'}>
                  {isAdmin ? <ArrowUpDown className="w-[15px] h-[15px]" /> : <Crown className="w-[15px] h-[15px]" />}
                </button>
                {!isAdmin && (
                  <button onClick={() => setActive(u.id, inactive)} className="icon-btn w-[30px] h-[30px] border-0" title={inactive ? 'Reactivate' : 'Deactivate'} style={inactive ? { color: 'var(--online)' } : undefined}><Power className="w-[15px] h-[15px]" /></button>
                )}
                {!isAdmin && (
                  <button onClick={() => removeUser(u.id, u.username)} className="icon-btn w-[30px] h-[30px] border-0 hover:!text-danger" title="Remove member"><Trash2 className="w-[15px] h-[15px]" /></button>
                )}
                {!isAdmin && (
                  <button onClick={() => { setDestruct({ kind: 'user', user: u }); setDestructText(''); }} className="icon-btn w-[30px] h-[30px] border-0 hover:!text-danger" title="Destruct (erase person & all their data)"><Skull className="w-[15px] h-[15px]" /></button>
                )}
              </div>
            </div>
            );
          })}

          {members.length === 0 && (
            <div className="px-[22px] py-12 text-center text-t3 text-sm">No personnel found.</div>
          )}
        </section>

        {/* reports */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 px-[22px] pt-[18px] pb-3.5 border-b border-border">
            <h2 className="text-[15px] font-semibold text-t1 flex-1">Reports</h2>
            <span className="text-[12.5px] text-t3">{reports.filter((r) => !r.resolved).length} open</span>
          </div>
          {reports.length === 0 ? (
            <div className="px-[22px] py-10 text-center text-t3 text-sm">No reports. All quiet. 🌿</div>
          ) : reports.map((r) => (
            <div key={r.id} className={`px-[22px] py-3.5 border-b border-border last:border-b-0 ${r.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{r.type}</span>
                <span className="text-[13px] text-t2">by <span className="font-medium text-t1">{r.authorName || 'unknown'}</span></span>
                <span className="text-[12px] text-t3">· reported by {r.reportedBy}</span>
                {r.resolved && <span className="text-[11px] text-online ml-1">resolved</span>}
              </div>
              <div className="text-[13.5px] text-t1 bg-surface-2 border border-border rounded-xl px-3 py-2 mb-2 whitespace-pre-wrap break-words">{r.snapshot || <span className="text-t3 italic">(no text)</span>}</div>
              {r.reason && <div className="text-[12.5px] text-t2 mb-2">Reason: {r.reason}</div>}
              {!r.resolved && (
                <div className="flex gap-2">
                  <button onClick={() => resolveReport(r.id)} className="btn-secondary px-3 py-1.5 text-[12.5px]"><Check className="w-[13px] h-[13px]" /> Mark resolved</button>
                  <button onClick={() => dismissReport(r.id)} className="btn-secondary px-3 py-1.5 text-[12.5px]">Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* danger zone */}
        <section className="card overflow-hidden" style={{ borderColor: 'var(--danger)' }}>
          <div className="flex items-center gap-2 px-[22px] pt-[18px] pb-3.5 border-b border-border">
            <ShieldAlert className="w-[16px] h-[16px]" style={{ color: 'var(--danger)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--danger)' }}>Danger zone</h2>
          </div>
          <div className="px-[22px] py-4">
            <div className="text-[14px] font-semibold text-t1">Self-destruct</div>
            <p className="text-[13px] text-t2 mt-1 leading-relaxed max-w-[560px]">
              Permanently wipes <b>all messages, posts, reports, custom emoji, registration keys</b>, every non-admin account, and all uploaded files. Admin accounts are kept so you can still sign in. This cannot be undone.
            </p>
            <p className="text-[12px] text-t3 mt-2 max-w-[560px]">
              Removing the server services, the database file, and the codebase itself is intentionally <b>not</b> available here — run <span className="font-mono">teardown.sh</span> on the server for the full machine wipe.
            </p>
            <button onClick={() => { setDestruct({ kind: 'all' }); setDestructText(''); }} className="btn-accent px-4 py-2.5 text-sm mt-4" style={{ background: 'var(--danger)' }}>
              <Skull className="w-[15px] h-[15px]" />Self-destruct the database
            </button>
          </div>
        </section>
      </div>

      {/* destruct confirmation */}
      {destruct && (
        <div onClick={() => !destructing && setDestruct(null)} className="fixed inset-0 z-[460] flex items-center justify-center p-6" style={{ background: 'rgba(7,7,9,0.6)', backdropFilter: 'blur(3px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="card w-[420px] max-w-full p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Skull className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">
              {destruct.kind === 'all' ? 'Self-destruct the database?' : `Destruct ${destruct.user?.username}?`}
            </h2>
            <p className="text-[13.5px] text-t2 leading-[1.55] mb-4">
              {destruct.kind === 'all'
                ? 'This erases all conversations, posts, reports, keys, non-admin accounts, and uploaded files. There is no undo.'
                : `This permanently erases ${destruct.user?.username} and every message, post and comment they created. There is no undo.`}
            </p>
            <label className="eyebrow block mb-1.5">Type DESTRUCT to confirm</label>
            <input autoFocus value={destructText} onChange={(e) => setDestructText(e.target.value)} placeholder="DESTRUCT" className="tk-input mb-5" />
            <div className="flex gap-2.5">
              <button onClick={() => { setDestruct(null); setDestructText(''); }} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
              <button onClick={runDestruct} disabled={destructText !== 'DESTRUCT' || destructing} className="btn-accent flex-1 py-[11px] text-sm" style={{ background: 'var(--danger)' }}>
                {destructing && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />}
                {destruct.kind === 'all' ? 'Wipe everything' : 'Destruct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
