'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Plus, Copy, Check, RefreshCw, Power, Trash2, KeyRound, Users, Activity,
  MessageSquare, Newspaper, Flag, Crown, ArrowUpDown, Skull, ShieldAlert, Lock, Search,
  UserRound, Shield, Briefcase, CalendarDays, X,
} from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { displayOf, avatarFor, ringFor } from '../../components/Sidebar';
import { useToast } from '../../components/Toast';

function Donut({ value, total, color, caption }: { value: number; total: number; color: string; caption: string }) {
  const r = 30, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[92px] h-[92px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circ * pct} ${circ}`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[20px] font-semibold text-t1 leading-none tabular-nums">{value}</div>
            <div className="text-[10px] text-t3">of {total}</div>
          </div>
        </div>
      </div>
      <div className="text-[12px] text-t2 mt-1.5">{caption}</div>
    </div>
  );
}

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
  const [tab, setTab] = useState<'members' | 'reports'>('members');
  const [query, setQuery] = useState('');

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
    } catch { toast('Network error', 'error'); }
    setLoading(false);
  };

  const runDestruct = async () => {
    if (destructText !== 'DESTRUCT' || !destruct) return;
    setDestructing(true);
    try {
      if (destruct.kind === 'all') {
        const r = await fetch(api('/api/admin/self-destruct'), { method: 'POST', headers: authJson(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) { const d = await r.json(); toast(`Wiped. ${d.filesRemoved ?? 0} files removed.`, 'success'); } else toast((await r.text()) || 'Failed', 'error');
      } else {
        const r = await fetch(api(`/api/admin/destruct-user/${destruct.user.id}`), { method: 'POST', headers: authJson(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) toast(`${destruct.user.username} destructed`, 'success'); else toast((await r.text()) || 'Failed', 'error');
      }
    } catch { toast('Network error', 'error'); }
    setDestructing(false); setDestruct(null); setDestructText(''); fetchData();
  };

  const copyToClipboard = async (keyString: string) => {
    if (!keyString) return;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(keyString); success = true; }
      else {
        const ta = document.createElement('textarea');
        ta.value = keyString; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        success = document.execCommand('copy'); document.body.removeChild(ta);
      }
    } catch (err) { console.error('Failed to copy:', err); }
    if (success) { setCopiedKey(keyString); toast('Access key copied', 'success'); setTimeout(() => setCopiedKey(null), 2000); }
    else window.prompt('Copy the key below (Ctrl+C):', keyString);
  };

  const allMembers = users.filter((u: any) => u.username !== 'Taskis Bot');
  const members = allMembers.filter((u: any) => !query.trim() || displayOf(u).toLowerCase().includes(query.trim().toLowerCase()) || u.username.toLowerCase().includes(query.trim().toLowerCase()));
  const shortKey = (k?: string) => (k ? `${k.slice(0, 6)}…${k.slice(-4)}` : 'N/A');
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const openReports = reports.filter((r) => !r.resolved).length;

  const COLS = { sel: 'w-7 flex-none', member: 'flex-1 min-w-0', role: 'w-[128px] flex-none hidden sm:block', status: 'w-[118px] flex-none', key: 'w-[150px] flex-none hidden lg:block', joined: 'w-[120px] flex-none hidden lg:block', act: 'w-[132px] flex-none flex justify-end' };

  const STAT_TILES = stats ? [
    { icon: Users, label: 'Members', value: stats.users },
    { icon: Activity, label: 'Active now', value: stats.activeNow, accent: true },
    { icon: MessageSquare, label: 'Messages', value: stats.messages },
    { icon: Newspaper, label: 'Posts', value: stats.posts },
    { icon: Flag, label: 'Reports', value: stats.reports },
    { icon: KeyRound, label: 'Keys', value: stats.keys },
  ] : [];

  return (
    <div className="scroll h-screen overflow-y-auto bg-bg">
      <header className="flex items-center gap-[13px] px-7 h-[62px] border-b border-border sticky top-0 z-20" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => router.push('/chat')} aria-label="Back" className="icon-btn w-8 h-8"><ChevronLeft className="w-[15px] h-[15px]" /></button>
        <div className="flex-1"><div className="text-[15px] font-semibold text-t1 leading-tight">Admin</div></div>
        <ThemeToggle />
      </header>

      <div className="max-w-[1000px] mx-auto px-7 pt-8 pb-20 flex flex-col gap-6">
        {/* title block */}
        <div>
          <div className="eyebrow flex items-center gap-1.5"><Lock className="w-[12px] h-[12px]" />Private database</div>
          <h1 className="serif text-[30px] font-bold text-t1 tracking-tight mt-1.5">Team administration</h1>
          <p className="text-[14.5px] text-t2 mt-1">Members, access keys, reports and presence across Taskis.</p>
        </div>

        {/* stat tiles */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAT_TILES.map((s) => (
              <div key={s.label} className="card p-4">
                <s.icon className="w-[15px] h-[15px] mb-2" style={{ color: s.accent ? 'var(--online)' : 'var(--t3)' }} />
                <div className="text-[22px] font-semibold text-t1 leading-none tabular-nums">{s.value ?? '—'}</div>
                <div className="text-[11.5px] text-t3 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* charts */}
        {stats && (() => {
          const admins = allMembers.filter((u: any) => u.role === 'ADMIN').length;
          const bars = [
            { label: 'Messages', value: stats.messages || 0, color: 'var(--accent)' },
            { label: 'Posts', value: stats.posts || 0, color: '#2f9e54' },
            { label: 'Comments', value: stats.comments || 0, color: '#8b5cf6' },
            { label: 'Reports', value: stats.reports || 0, color: 'var(--danger)' },
          ];
          const max = Math.max(1, ...bars.map((b) => b.value));
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="card p-5 lg:col-span-2">
                <div className="text-[13px] font-semibold text-t1 mb-4">Content volume</div>
                <div className="space-y-3">
                  {bars.map((b) => (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="w-[78px] text-[12.5px] text-t2 flex-none">{b.label}</span>
                      <span className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <span className="block h-full rounded-full" style={{ width: `${(b.value / max) * 100}%`, background: b.color, transition: 'width 0.6s ease' }} />
                      </span>
                      <span className="w-10 text-right text-[12.5px] font-medium text-t1 tabular-nums flex-none">{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5 flex items-center justify-around">
                <Donut value={stats.activeNow || 0} total={stats.users || 0} color="var(--online)" caption="Active now" />
                <Donut value={admins} total={allMembers.length || 0} color="#8b5cf6" caption="Admins" />
              </div>
            </div>
          );
        })()}

        {/* tabs + toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="pill-track">
            <button className="pill-item" data-active={tab === 'members'} onClick={() => setTab('members')}>Members <span className="text-t3">{allMembers.length}</span></button>
            <button className="pill-item" data-active={tab === 'reports'} onClick={() => setTab('reports')}>Reports {openReports > 0 && <span style={{ color: 'var(--danger)' }}>{openReports}</span>}</button>
          </div>
          <div className="flex-1" />
          {tab === 'members' && (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-surface pl-3 pr-2 h-9">
                <Search className="w-[14px] h-[14px] text-t3" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…" className="bg-transparent border-0 outline-none text-[13px] text-t1 w-[150px]" />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); generateKey(newUsername); }} className="flex items-center gap-2">
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="New codename" className="tk-input h-9" style={{ width: 150, padding: '0 12px', fontSize: 13 }} />
                <button type="submit" disabled={loading || !newUsername.trim()} className="btn-accent h-9 px-3.5 text-[13px] whitespace-nowrap">
                  {loading ? <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Plus className="w-[15px] h-[15px]" />}Add
                </button>
              </form>
            </>
          )}
        </div>

        {/* MEMBERS TABLE */}
        {tab === 'members' && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border eyebrow" style={{ letterSpacing: '0.05em' }}>
              <span className={COLS.sel} />
              <span className={`${COLS.member} flex items-center gap-1.5`}><UserRound className="w-[13px] h-[13px]" />Member</span>
              <span className={`${COLS.role} flex items-center gap-1.5`}><Shield className="w-[13px] h-[13px]" />Role</span>
              <span className={`${COLS.status} flex items-center gap-1.5`}><Briefcase className="w-[13px] h-[13px]" />Status</span>
              <span className={`${COLS.key} flex items-center gap-1.5`}><KeyRound className="w-[13px] h-[13px]" />Access key</span>
              <span className={`${COLS.joined} flex items-center gap-1.5`}><CalendarDays className="w-[13px] h-[13px]" />Joined</span>
              <span className={COLS.act} />
            </div>

            {members.map((u: any) => {
              const k = keyByString(u.registrationKey);
              const isAdmin = u.role === 'ADMIN';
              const inactive = u.active === false;
              const keyStatus = k?.revoked ? 'Revoked' : k?.isUsed ? 'Used' : 'Active';
              const keyColor = k?.revoked ? 'var(--danger)' : k?.isUsed ? 'var(--t3)' : 'var(--online)';
              const presence = u.status === 'ACTIVE' ? 'var(--online)' : u.status === 'AWAY' ? 'var(--away)' : 'var(--t3)';
              return (
                <div key={u.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-hover transition-colors ${inactive ? 'opacity-60' : ''}`}>
                  <span className={COLS.sel} />
                  <div className={`${COLS.member} flex items-center gap-3`}>
                    <span className="relative w-[34px] h-[34px] rounded-full grid place-items-center flex-none text-[12px] font-semibold text-white overflow-hidden" style={{ background: 'transparent', boxShadow: ringFor(u) }}>
                      <img src={avatarFor(u)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <span className="absolute -right-px -bottom-px w-[9px] h-[9px] rounded-full z-10" style={{ background: presence, border: '2px solid var(--surface-1)' }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-t1 truncate">{displayOf(u)}</div>
                      <div className="text-[12px] text-t3 truncate">@{u.username.toLowerCase()}</div>
                    </div>
                  </div>
                  <div className={COLS.role}>
                    <span className="tk-chip" style={isAdmin ? { background: 'color-mix(in srgb, #8b5cf6 16%, transparent)', color: '#8b5cf6' } : { background: 'var(--surface-2)', color: 'var(--t2)' }}>
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: isAdmin ? '#8b5cf6' : 'var(--t3)' }} />{isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>
                  <div className={COLS.status}>
                    {inactive ? (
                      <span className="tk-chip" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><X className="w-[12px] h-[12px]" />Inactive</span>
                    ) : (
                      <span className="tk-chip" style={{ background: 'color-mix(in srgb, var(--online) 15%, transparent)', color: 'var(--online)' }}><Check className="w-[12px] h-[12px]" />Active</span>
                    )}
                  </div>
                  <div className={`${COLS.key} min-w-0`}>
                    {u.registrationKey ? (
                      <>
                        <div className="font-mono text-[12.5px] text-t2 truncate" title={u.registrationKey}>{shortKey(u.registrationKey)}</div>
                        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: keyColor }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: keyColor }} />{keyStatus}</span>
                      </>
                    ) : <span className="text-[12.5px] text-t3">—</span>}
                  </div>
                  <div className={`${COLS.joined} text-[12.5px] text-t2`}>{fmtDate(u.createdAt)}</div>
                  <div className={COLS.act}>
                    <button onClick={() => copyToClipboard(u.registrationKey)} disabled={!u.registrationKey} className="icon-btn w-[28px] h-[28px] border-0 disabled:opacity-40" title="Copy key">{copiedKey === u.registrationKey ? <Check className="w-[14px] h-[14px] text-online" /> : <Copy className="w-[14px] h-[14px]" />}</button>
                    <button onClick={async () => { if (await confirm({ title: `Regenerate key for ${u.username}?`, body: 'This replaces their previous key.', confirmText: 'Regenerate' })) generateKey(u.username); }} className="icon-btn w-[28px] h-[28px] border-0" title="Regenerate key"><RefreshCw className="w-[14px] h-[14px]" /></button>
                    <button onClick={() => setRole(u.id, isAdmin ? 'USER' : 'ADMIN', u.username)} className="icon-btn w-[28px] h-[28px] border-0" title={isAdmin ? 'Demote to member' : 'Make admin'}>{isAdmin ? <ArrowUpDown className="w-[14px] h-[14px]" /> : <Crown className="w-[14px] h-[14px]" />}</button>
                    {!isAdmin && <button onClick={() => setActive(u.id, inactive)} className="icon-btn w-[28px] h-[28px] border-0" title={inactive ? 'Reactivate' : 'Deactivate'} style={inactive ? { color: 'var(--online)' } : undefined}><Power className="w-[14px] h-[14px]" /></button>}
                    {!isAdmin && <button onClick={() => removeUser(u.id, u.username)} className="icon-btn w-[28px] h-[28px] border-0 hover:!text-danger" title="Remove"><Trash2 className="w-[14px] h-[14px]" /></button>}
                    {!isAdmin && <button onClick={() => { setDestruct({ kind: 'user', user: u }); setDestructText(''); }} className="icon-btn w-[28px] h-[28px] border-0 hover:!text-danger" title="Destruct (erase person & data)"><Skull className="w-[14px] h-[14px]" /></button>}
                  </div>
                </div>
              );
            })}
            {members.length === 0 && <div className="px-4 py-12 text-center text-t3 text-sm">{query ? 'No members match your search.' : 'No personnel found.'}</div>}
          </div>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <div className="card overflow-hidden">
            {reports.length === 0 ? (
              <div className="px-5 py-12 text-center text-t3 text-sm">No reports. All quiet. 🌿</div>
            ) : reports.map((r) => (
              <div key={r.id} className={`px-5 py-4 border-b border-border last:border-b-0 ${r.resolved ? 'opacity-55' : ''}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="tk-chip" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Flag className="w-[11px] h-[11px]" />{r.type}</span>
                  <span className="text-[13px] text-t2">by <span className="font-medium text-t1">{r.authorName || 'unknown'}</span></span>
                  <span className="text-[12px] text-t3">· reported by {r.reportedBy}</span>
                  {r.resolved && <span className="tk-chip" style={{ background: 'color-mix(in srgb, var(--online) 15%, transparent)', color: 'var(--online)' }}><Check className="w-[11px] h-[11px]" />resolved</span>}
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
          </div>
        )}

        {/* danger zone */}
        <section className="card overflow-hidden mt-2" style={{ borderColor: 'var(--danger)' }}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-border">
            <ShieldAlert className="w-[16px] h-[16px]" style={{ color: 'var(--danger)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--danger)' }}>Danger zone</h2>
          </div>
          <div className="px-5 py-4">
            <div className="text-[14px] font-semibold text-t1">Self-destruct</div>
            <p className="text-[13px] text-t2 mt-1 leading-relaxed max-w-[600px]">Permanently wipes <b>all messages, posts, reports, custom emoji, registration keys</b>, every non-admin account, and all uploaded files. Admin accounts are kept. This cannot be undone.</p>
            <p className="text-[12px] text-t3 mt-2 max-w-[600px]">Removing the server services, database file, and codebase is intentionally <b>not</b> available here — run <span className="font-mono">teardown.sh</span> on the server for the full machine wipe.</p>
            <button onClick={() => { setDestruct({ kind: 'all' }); setDestructText(''); }} className="btn-accent px-4 py-2.5 text-sm mt-4" style={{ background: 'var(--danger)' }}><Skull className="w-[15px] h-[15px]" />Self-destruct the database</button>
          </div>
        </section>
      </div>

      {/* destruct confirmation */}
      {destruct && (
        <div onClick={() => !destructing && setDestruct(null)} className="fixed inset-0 z-[460] flex items-center justify-center p-6" style={{ background: 'rgba(7,7,9,0.6)', backdropFilter: 'blur(3px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="card w-[420px] max-w-full p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Skull className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">{destruct.kind === 'all' ? 'Self-destruct the database?' : `Destruct ${destruct.user?.username}?`}</h2>
            <p className="text-[13.5px] text-t2 leading-[1.55] mb-4">{destruct.kind === 'all' ? 'This erases all conversations, posts, reports, keys, non-admin accounts, and uploaded files. There is no undo.' : `This permanently erases ${destruct.user?.username} and every message, post and comment they created. There is no undo.`}</p>
            <label className="eyebrow block mb-1.5">Type DESTRUCT to confirm</label>
            <input autoFocus value={destructText} onChange={(e) => setDestructText(e.target.value)} placeholder="DESTRUCT" className="tk-input mb-5" />
            <div className="flex gap-2.5">
              <button onClick={() => { setDestruct(null); setDestructText(''); }} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
              <button onClick={runDestruct} disabled={destructText !== 'DESTRUCT' || destructing} className="btn-accent flex-1 py-[11px] text-sm" style={{ background: 'var(--danger)' }}>
                {destructing && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />}{destruct.kind === 'all' ? 'Wipe everything' : 'Destruct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
