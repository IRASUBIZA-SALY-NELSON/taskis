'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Plus, Copy, Check, RefreshCw, Power, Trash2, KeyRound, Users, Activity,
  MessageSquare, Flag, Crown, ArrowUpDown, Skull, ShieldAlert, Lock, Search,
  UserRound, Shield, Briefcase, CalendarDays, X, BarChart3, Hash, Settings,
  Newspaper, ChevronRight,
} from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';
import { displayOf, avatarFor, ringFor } from '../../components/Sidebar';
import { useToast } from '../../components/Toast';
import { apiUrl as api } from '@/lib/api';

/* ── helpers ── */
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const authJ = () => ({ ...authH(), 'Content-Type': 'application/json' });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const shortKey = (k?: string) => k ? `${k.slice(0, 6)}…${k.slice(-4)}` : 'N/A';

/* ── Donut chart ── */
function Donut({ value, total, color, caption }: { value: number; total: number; color: string; caption: string }) {
  const r = 30, circ = 2 * Math.PI * r, pct = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[88px] h-[88px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div className="text-[19px] font-semibold text-t1 leading-none tabular-nums">{value}</div>
          <div className="text-[10px] text-t3">of {total}</div>
        </div>
      </div>
      <div className="text-[12px] text-t2 mt-1.5">{caption}</div>
    </div>
  );
}

/* ── Radial bar chart (per-user messages) ── */
function RadialChart({ data }: { data: { username: string; messages: number }[] }) {
  if (!data.length) return <div className="text-t3 text-sm text-center py-8">No message data yet.</div>;
  const max = Math.max(1, ...data.map(d => d.messages));
  const cx = 120, cy = 120, outerR = 100, innerR = 30;
  const COLORS = ['var(--accent)', '#2f9e54', '#8b5cf6', '#e8833a', '#0ea5a4', '#e0558c', '#d9930a', '#3068f5', '#64748b', '#ef4444'];
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 240 240" className="w-[220px] h-[220px]">
        {/* grid rings */}
        {[0.25, 0.5, 0.75, 1].map(frac => (
          <circle key={frac} cx={cx} cy={cy} r={innerR + (outerR - innerR) * frac}
            fill="none" stroke="var(--border)" strokeWidth="0.7" strokeDasharray="3 3" />
        ))}
        {/* spokes */}
        {data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return <line key={i} x1={cx} y1={cy} x2={cx + outerR * Math.cos(angle)} y2={cy + outerR * Math.sin(angle)}
            stroke="var(--border)" strokeWidth="0.7" />;
        })}
        {/* filled area */}
        <polygon
          points={data.map((d, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = innerR + (outerR - innerR) * (d.messages / max);
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(' ')}
          fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"
        />
        {/* dots + labels */}
        {data.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = innerR + (outerR - innerR) * (d.messages / max);
          const lx = cx + (outerR + 16) * Math.cos(angle);
          const ly = cy + (outerR + 16) * Math.sin(angle);
          return (
            <g key={i}>
              <circle cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)} r="4"
                fill={COLORS[i % COLORS.length]} stroke="var(--surface-1)" strokeWidth="1.5" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize="8.5" fill="var(--t2)" fontFamily="inherit">
                {d.username.length > 8 ? d.username.slice(0, 7) + '…' : d.username}
              </text>
            </g>
          );
        })}
        {/* center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--t1)" fontFamily="inherit">msgs</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="var(--t3)" fontFamily="inherit">per user</text>
      </svg>
      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[12px] text-t2">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: COLORS[i % COLORS.length] }} />
            {d.username} <span className="text-t3 tabular-nums">({d.messages})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Channel bar mini chart ── */
function ChannelBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map(e => e[1]));
  const COLORS = ['var(--accent)', '#2f9e54', '#8b5cf6', '#e8833a', '#0ea5a4', '#e0558c', '#d9930a', '#3068f5'];
  return (
    <div className="space-y-2.5 w-full">
      {entries.map(([ch, cnt], i) => (
        <div key={ch} className="flex items-center gap-3">
          <span className="w-[90px] text-[12px] text-t2 truncate flex-none">#{ch}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${(cnt / max) * 100}%`, background: COLORS[i % COLORS.length], transition: 'width .6s ease' }} />
          </div>
          <span className="w-8 text-right text-[12px] text-t1 tabular-nums flex-none">{cnt}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Sidebar nav ── */
type AdminSection = 'overview' | 'members' | 'reports' | 'analytics' | 'audit' | 'danger';
const NAV: { id: AdminSection; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'overview',  label: 'Overview',    icon: Activity },
  { id: 'members',   label: 'Members',     icon: Users },
  { id: 'reports',   label: 'Reports',     icon: Flag },
  { id: 'analytics', label: 'Analytics',   icon: BarChart3 },
  { id: 'audit',     label: 'Audit logs',  icon: Settings },
  { id: 'danger',    label: 'Danger zone', icon: ShieldAlert },
];

function AdminSidebar({ section, setSection, openReports, isMobile, onClose }:
  { section: AdminSection; setSection: (s: AdminSection) => void; openReports: number; isMobile: boolean; onClose: () => void }) {
  return (
    <>
      {isMobile && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`${isMobile ? 'fixed inset-y-0 left-0 z-40 w-[220px]' : 'w-[200px] flex-none'} flex flex-col bg-surface border-r border-border h-full`}>
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-t3" />
            <span className="text-[13px] font-semibold text-t1">Admin panel</span>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setSection(id); if (isMobile) onClose(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
section === id ? 'bg-accent-soft text-accent-text font-medium' : 'text-t2 hover:bg-hover hover:text-t1'
              }`}>
              <Icon className="w-[15px] h-[15px] flex-none" />
              <span className="flex-1 text-left">{label}</span>
              {id === 'reports' && openReports > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold">{openReports}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border text-[11px] text-t3">Taskis Admin v2</div>
      </aside>
    </>
  );
}

/* ── Main page ── */
export default function AdminDashboard(){
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<AdminSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditCategory, setAuditCategory] = useState('');
  const [destruct, setDestruct] = useState<{ kind: 'all' | 'user'; user?: any } | null>(null);
  const [destructText, setDestructText] = useState('');
  const [destructing, setDestructing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { router.push('/'); return; }
    const u = JSON.parse(userData);
    if (u.role !== 'ADMIN' && u.username.toLowerCase() !== 'nelson') { router.push('/chat'); return; }
    fetchAll();
  }, [router]);

  useEffect(() => {
    if (section === 'audit') fetchAuditLogs(auditCategory);
  }, [section, auditCategory]);

  const fetchAll = async () => {
    try {
      const [uR, kR, rR, sR, aR] = await Promise.all([
        fetch(api('/api/admin/users'), { headers: authH() }),
        fetch(api('/api/admin/keys'), { headers: authH() }),
        fetch(api('/api/reports'), { headers: authH() }),
        fetch(api('/api/admin/stats'), { headers: authH() }),
        fetch(api('/api/admin/analytics'), { headers: authH() }),
      ]);
      setUsers(await uR.json());
      setKeys(await kR.json());
      if (rR.ok) setReports(await rR.json());
      if (sR.ok) setStats(await sR.json());
      if (aR.ok) setAnalytics(await aR.json());
      // Audit logs fetched separately on demand
    } catch (e) { console.error(e); }
  };

  const fetchAuditLogs = async (category = '') => {
    const url = category ? api(`/api/admin/audit-logs?category=${category}`) : api('/api/admin/audit-logs');
    const r = await fetch(url, { headers: authH() });
    if (r.ok) setAuditLogs(await r.json());
  };

  const generateKey = async (username: string) => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(api('/api/admin/keys'), { method: 'POST', headers: authJ(), body: JSON.stringify({ username }) });
      if (r.ok) { setNewUsername(''); fetchAll(); toast('Key generated', 'success'); } else toast(await r.text(), 'error');
    } catch { toast('Network error', 'error'); }
    setLoading(false);
  };

  const copyToClipboard =async (k: string) => {
    if (!k) return;
    let ok = false;
    try {
 if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(k); ok = true; }
      else { const ta = document.createElement('textarea'); ta.value = k; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta); }
    } catch { /**/ }
    if (ok) { setCopiedKey(k); toast('Key copied', 'success'); setTimeout(() => setCopiedKey(null), 2000); }
    else window.prompt('Copy (Ctrl+C):', k);
  };

  const setRole = async (id: number, role: string, name: string) => {
    if (!(await confirm({ title: role === 'ADMIN' ? `Make ${name} admin?` : `Demote ${name}?`, body: '', confirmText: role === 'ADMIN' ? 'Promote' : 'Demote' }))) return;
    await fetch(api(`/api/admin/users/${id}/role`), { method: 'POST', headers: authJ(), body: JSON.stringify({ role }) });
    fetchAll(); toast(role === 'ADMIN' ? `${name} is now admin` : `${name} demoted`, 'success');
  };

  const setActive = async (id: number, active: boolean) => {
    await fetch(api(`/api/admin/users/${id}/active`), { method: 'POST', headers: authJ(), body: JSON.stringify({ active }) });
fetchAll();
  };

  const removeUser = async (id: number, name: string) => {
    if (!(await confirm({ title: `Remove ${name}?`, body: 'Deletes the account and key.', confirmText: 'Remove', danger: true }))) return;
    await fetch(api(`/api/admin/users/${id}`), { method: 'DELETE', headers: authH() });
    fetchAll(); toast(`${name} removed`, 'success');
  };

  const resolveReport = async (id: number) => { await fetch(api(`/api/reports/${id}/resolve`), { method: 'POST', headers: authH() }); fetchAll(); };
  const dismissReport = async (id: number) => { await fetch(api(`/api/reports/${id}`), { method: 'DELETE', headers: authH() }); fetchAll(); };

  const runDestruct = async () => {
    if (destructText !== 'DESTRUCT' || !destruct) return;
    setDestructing(true);
    try {
      if (destruct.kind === 'all') {
        const r = await fetch(api('/api/admin/self-destruct'), { method: 'POST', headers: authJ(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) { const d = await r.json(); toast(`Wiped. ${d.filesRemoved ?? 0} files removed.`, 'success'); } else toast(await r.text(), 'error');
      } else {
        const r = await fetch(api(`/api/admin/destruct-user/${destruct.user.id}`), { method: 'POST', headers: authJ(), body: JSON.stringify({ confirm: 'DESTRUCT' }) });
        if (r.ok) toast(`${destruct.user.username} destructed`, 'success'); else toast(await r.text(), 'error');
      }
    } catch { toast('Network error', 'error'); }
    setDestructing(false); setDestruct(null); setDestructText(''); fetchAll();
  };

  const allMembers = users.filter(u => u.username !== 'Taskis Bot');
  const members = allMembers.filter(u => !query.trim() || u.username.toLowerCase().includes(query.toLowerCase()) || displayOf(u).toLowerCase().includes(query.toLowerCase()));
  const openReports = reports.filter(r => !r.resolved).length;
  const keyByString = (s: string) => keys.find(k => k.keyString === s);
  const COLS = { member: 'flex-1 min-w-0', role: 'w-[110px] flex-none hidden sm:block', status: 'w-[100px] flex-none', key: 'w-[140px] flex-none hidden lg:block', joined: 'w-[110px] flex-none hidden xl:block', act: 'w-[140px] flex-none flex justify-end' };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
<div className="hidden lg:flex flex-col h-full">
        <AdminSidebar section={section} setSection={setSection} openReports={openReports} isMobile={false} onClose={() => {}} />
      </div>
      {sidebarOpen && <AdminSidebar section={section} setSection={s => { setSection(s); setSidebarOpen(false); }} openReports={openReports} isMobile onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-5 h-[62px] border-b border-border flex-none" style={{ background: 'color-mix(in srgb,var(--bg) 88%,transparent)', backdropFilter: 'blur(8px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="icon-btn w-8 h-8 lg:hidden"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => router.push('/chat')} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[13px] text-t2 hover:text-t1 hover:bg-hover transition-colors whitespace-nowrap" title="Back to chat">
            <ChevronLeft className="w-4 h-4 flex-none" />
            <span>Back to chat</span>
          </button>
          <div className="flex-1 text-[15px] font-semibold text-t1 capitalize">{section}</div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          {/* OVERVIEW */}
          {section === 'overview' && (<>
  <div>
              <div className="text-[11px] font-semibold text-t3 uppercase tracking-widest mb-1">Private database</div>
              <h1 className="text-[26px] font-bold text-t1">Team administration</h1>
              <p className="text-[14px] text-t2 mt-1">Members, keys, reports and presence across Taskis.</p>
            </div>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { icon: Users, label: 'Members', value: stats.users },
                  { icon: Activity, label: 'Active now', value: stats.activeNow, accent: true },
                  { icon: MessageSquare, label: 'Messages', value: stats.messages },
                  { icon: Newspaper, label: 'Posts', value: stats.posts },
                  { icon: Flag, label: 'Reports', value: stats.reports },
                  { icon: KeyRound, label: 'Keys', value: stats.keys },
                ].map(s => (
                  <div key={s.label} className="card p-4">
                    <s.icon className="w-[15px] h-[15px] mb-2" style={{ color: s.accent ? 'var(--online)' : 'var(--t3)' }} />
                    <div className="text-[22px] font-semibold text-t1 leading-none tabular-nums">{s.value ?? '—'}</div>
                    <div className="text-[11.5px] text-t3 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
         <div className="card p-5 lg:col-span-2 space-y-3">
                  <div className="text-[13px] font-semibold text-t1">Content volume</div>
                  {[{ label:'Messages', value: stats.messages||0, color:'var(--accent)' },
                    { label:'Posts', value: stats.posts||0, color:'#2f9e54' },
                    { label:'Comments', value: stats.comments||0, color:'#8b5cf6' },
                    { label:'Reports', value: stats.reports||0, color:'var(--danger)' }
                  ].map(b=> {
                    const max = Math.max(1, stats.messages||0, stats.posts||0, stats.comments||0, stats.reports||0);
                    return (
                      <div key={b.label} className="flex items-center gap-3">
                        <span className="w-[78px] text-[12.5px] text-t2 flex-none">{b.label}</span>
                        <span className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background:'var(--surface-2)' }}>
                          <span className="block h-full rounded-full" style={{ width:`${(b.value/max)*100}%`, background:b.color, transition:'width .6s ease' }} />
                        </span>
                        <span className="w-10 text-right text-[12.5px] font-medium text-t1 tabular-nums flex-none">{b.value}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="card p-5 flex items-center justify-around">
                  <Donut value={stats.activeNow||0} total={stats.users||0} color="var(--online)" caption="Active now" />
                  <Donut value={allMembers.filter(u=>u.role==='ADMIN').length} total={allMembers.length||0} color="#8b5cf6" caption="Admins" />
                </div>
              </div>
            )}
          </>)}

          {/* MEMBERS */}
          {section === 'members' && (<>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[20px] font-bold text-t1 flex-1">Members</h2>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface pl-3 pr-2 h-9">
                <Search className="w-[14px] h-[14px] text-t3" />
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search…" className="bg-transparent border-0 outline-none text-[13px] text-t1 w-[140px]" />
              </div>
              <form onSubmit={e=>{e.preventDefault();generateKey(newUsername);}} className="flex items-center gap-2">
                <input value={newUsername} onChange={e=>setNewUsername(e.target.value)} placeholder="New codename" className="tk-input h-9" style={{width:140,padding:'0 12px',fontSize:13}} />
                <button type="submit" disabled={loading||!newUsername.trim()} className="btn-accent h-9 px-3.5 text-[13px]">
                  {loading ? <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" /> : <Plus className="w-[15px] h-[15px]" />}Add
                </button>
              </form>
            </div>
       <div className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border text-[11px] font-semibold text-t3 uppercase tracking-wider">
                <span className={COLS.member}>Member</span>
                <span className={COLS.role}>Role</span>
                <span className={COLS.status}>Status</span>
                <span className={COLS.key}>Access key</span>
                <span className={COLS.joined}>Joined</span>
                <span className={COLS.act} />
              </div>
              {members.map(u => {
                const k = keyByString(u.registrationKey);
                const isAdm = u.role==='ADMIN', inactive=u.active===false;
                const keyColor = k?.revoked?'var(--danger)':k?.isUsed?'var(--t3)':'var(--online)';
                const presence = u.status==='ACTIVE'?'var(--online)':u.status==='AWAY'?'var(--away)':'var(--t3)';
                return (
                  <div key={u.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-hover transition-colors ${inactive?'opacity-60':''}`}>
                    <div className={`${COLS.member} flex items-center gap-3`}>
                      <span className="relative w-[34px] h-[34px] rounded-full flex-none overflow-hidden" style={{boxShadow:ringFor(u)}}>
                        <img src={avatarFor(u)} alt="" className="w-full h-full object-cover" />
                        <span className="absolute -right-px -bottom-px w-[9px] h-[9px] rounded-full z-10" style={{background:presence,border:'2px solid var(--surface-1)'}} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-t1 truncate">{displayOf(u)}</div>
                        <div className="text-[12px] text-t3">@{u.username}</div>
                      </div>
                    </div>
                    <div className={COLS.role}><span className="tk-chip" style={isAdm?{background:'color-mix(in srgb,#8b5cf6 16%,transparent)',color:'#8b5cf6'}:{background:'var(--surface-2)',color:'var(--t2)'}}>{isAdm?'Admin':'Member'}</span></div>
                    <div className={COLS.status}>{inactive?<span className="tk-chip" style={{background:'var(--danger-soft)',color:'var(--danger)'}}>Inactive</span>:<span className="tk-chip" style={{background:'color-mix(in srgb,var(--online) 15%,transparent)',color:'var(--online)'}}>Active</span>}</div>
                    <div className={`${COLS.key} min-w-0`}>{u.registrationKey?<><div className="font-mono text-[12px] text-t2 truncate">{shortKey(u.registrationKey)}</div><span className="text-[11px]" style={{color:keyColor}}>{k?.revoked?'Revoked':k?.isUsed?'Used':'Active'}</span></>:<span className="text-t3 text-[12px]">—</span>}</div>
                    <div className={`${COLS.joined} text-[12.5px] text-t2`}>{fmtDate(u.createdAt)}</div>
                    <div className={COLS.act}>
                      <button onClick={()=>copyToClipboard(u.registrationKey)} disabled={!u.registrationKey} className="icon-btn w-[28px] h-[28px] border-0 disabled:opacity-40">{copiedKey===u.registrationKey?<Check className="w-[14px] h-[14px] text-online"/>:<Copy className="w-[14px] h-[14px]"/>}</button>
                      <button onClick={async()=>{if(await confirm({title:`Regen key for ${u.username}?`,body:'Replaces previous key.',confirmText:'Regenerate'}))generateKey(u.username);}} className="icon-btn w-[28px] h-[28px] border-0"><RefreshCw className="w-[14px] h-[14px]"/></button>
           <button onClick={()=>setRole(u.id,isAdm?'USER':'ADMIN',u.username)} className="icon-btn w-[28px] h-[28px] border-0">{isAdm?<ArrowUpDown className="w-[14px] h-[14px]"/>:<Crown className="w-[14px] h-[14px]"/>}</button>
                      {!isAdm&&<button onClick={()=>setActive(u.id,inactive)} className="icon-btn w-[28px] h-[28px] border-0" style={inactive?{color:'var(--online)'}:{}}><Power className="w-[14px] h-[14px]"/></button>}
                      {!isAdm&&<button onClick={()=>removeUser(u.id,u.username)} className="icon-btn w-[28px] h-[28px] border-0 hover:!text-danger"><Trash2 className="w-[14px] h-[14px]"/></button>}
                      {!isAdm&&<button onClick={()=>{setDestruct({kind:'user',user:u});setDestructText('');}} className="icon-btn w-[28px] h-[28px] border-0 hover:!text-danger"><Skull className="w-[14px] h-[14px]"/></button>}
                    </div>
                  </div>
                );
              })}
              {members.length===0&&<div className="px-4 py-12 text-center text-t3 text-sm">No members found.</div>}
            </div>
          </>)}

          {/* REPORTS */}
          {section === 'reports' && (<>
            <h2 className="text-[20px] font-bold text-t1">Reports</h2>
            <div className="card overflow-hidden">
              {reports.length===0?<div className="px-5 py-12 text-center text-t3 text-sm">No reports. All quiet. 🌿</div>:
              reports.map(r=>(
                <div key={r.id} className={`px-5 py-4 border-b border-border last:border-0 ${r.resolved?'opacity-55':''}`}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="tk-chip" style={{background:'var(--danger-soft)',color:'var(--danger)'}}><Flag className="w-[11px] h-[11px]"/>{r.type}</span>
                    <span className="text-[13px] text-t2">by <b className="text-t1">{r.authorName||'unknown'}</b></span>
                    <span className="text-[12px] text-t3">· reported by {r.reportedBy}</span>
                    {r.resolved&&<span className="tk-chip" style={{background:'color-mix(in srgb,var(--online) 15%,transparent)',color:'var(--online)'}}><Check className="w-[11px] h-[11px]"/>resolved</span>}
                  </div>
                  <div className="text-[13.5px] text-t1 bg-surface-2 border border-border rounded-xl px-3 py-2 mb-2 whitespace-pre-wrap">{r.snapshot||<span className="text-t3 italic">(no text)</span>}</div>
                  {!r.resolved&&<div className="flex gap-2"><button onClick={()=>resolveReport(r.id)} className="btn-secondary px-3 py-1.5 text-[12.5px]"><Check className="w-[13px] h-[13px]"/>Resolve</button><button onClick={()=>dismissReport(r.id)} className="btn-secondary px-3 py-1.5 text-[12.5px]">Dismiss</button></div>}
                </div>
              ))}
            </div>
          </>)}

          {/* ANALYTICS */}
          {section === 'analytics' && (<>
            <h2 className="text-[20px] font-bold text-t1">Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           <div className="card p-6">
                <div className="text-[13px] font-semibold text-t1 mb-4">Message activity per user</div>
                <RadialChart data={analytics?.perUser || []} />
              </div>
              <div className="card p-6">
                <div className="text-[13px] font-semibold text-t1 mb-4">Messages per channel</div>
                <ChannelBars data={analytics?.perChannel || {}} />
              </div>
              {stats && (
                <div className="card p-6 lg:col-span-2">
                  <div className="text-[13px] font-semibold text-t1 mb-4">Platform overview</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      {label:'Total messages',value:stats.messages,color:'var(--accent)'},
                      {label:'Total posts',value:stats.posts,color:'#2f9e54'},
                      {label:'Total comments',value:stats.comments,color:'#8b5cf6'},
                      {label:'Registered users',value:stats.users,color:'#e8833a'},
                    ].map(s=>(
                      <div key={s.label} className="text-center p-4 rounded-xl border border-border">
                        <div className="text-[28px] font-bold tabular-nums" style={{color:s.color}}>{s.value??0}</div>
                        <div className="text-[12px] text-t2 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>)}

          {/* AUDIT LOGS */}
          {section === 'audit' && (<>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[20px] font-bold text-t1 flex-1">Audit logs <span className="text-[13px] font-normal text-t3">(last 24h, auto-deleted)</span></h2>
              <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="tk-input h-9 text-[13px]" style={{width:160,padding:'0 10px'}}>
                <option value="">All categories</option>
                {['AUTH','MESSAGE','USER_MGMT','KEY','ROLE','FILE','REACTION','REPORT','SYSTEM'].map(c=>(
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button onClick={()=>fetchAuditLogs(auditCategory)} className="btn-secondary h-9 px-3 text-[13px]">Refresh</button>
            </div>
            <div className="card overflow-hidden">
              <div className="hidden sm:grid grid-cols-[150px_90px_140px_1fr_80px] gap-3 px-4 py-2.5 border-b border-border text-[11px] font-semibold text-t3 uppercase tracking-wider">
                <span>Time</span><span>Actor</span><span>Action</span><span>Detail</span><span>Result</span>
              </div>
              {auditLogs.length === 0 && <div className="px-4 py-12 text-center text-t3 text-sm">No audit logs yet. Actions will appear here.</div>}
              {auditLogs.map(log => {
                const fail = log.result === 'FAILURE';
                const cc: Record<string,string> = {AUTH:'#3068f5',MESSAGE:'var(--accent)',USER_MGMT:'#8b5cf6',KEY:'#e8833a',ROLE:'#d9930a',FILE:'#0ea5a4',REACTION:'#e0558c',REPORT:'var(--danger)',SYSTEM:'var(--t3)'};
                const cc2 = cc[log.category] || 'var(--t3)';
                return (
                  <div key={log.id} className={`flex flex-col sm:grid sm:grid-cols-[150px_90px_140px_1fr_80px] gap-2 sm:gap-3 items-start px-4 py-3 border-b border-border last:border-0 hover:bg-hover transition-colors text-[12.5px] ${fail?'bg-red-500/5':''}`}>
                    <span className="text-t3 tabular-nums text-[11px]">{new Date(log.timestamp).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                    <span className="font-medium text-t1 truncate">{log.actor}</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full flex-none" style={{background:cc2}}/><span className="text-[11px] font-semibold" style={{color:cc2}}>{log.action}</span></span>
                    <span className="text-t2 break-words leading-relaxed">{log.detail}{log.targetName&&<span className="ml-1 text-t3">→ {log.targetName}</span>}</span>
                    <span className={`text-[11px] font-bold ${fail?'text-red-400':'text-green-500'}`}>{log.result}</span>
                  </div>
                );
              })}
            </div>
          </>)}

          {/* DANGER */}
          {section === 'danger' && (<>
            <h2 className="text-[20px] font-bold" style={{color:'var(--danger)'}}>Danger zone</h2>
            <div className="card p-6" style={{borderColor:'var(--danger)'}}>
              <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-5 h-5" style={{color:'var(--danger)'}}/><span className="text-[15px] font-semibold" style={{color:'var(--danger)'}}>Self-destruct</span></div>
              <p className="text-[13.5px] text-t2 leading-relaxed max-w-[600px]">Permanently wipes all messages, posts, reports, keys, every non-admin account and all uploaded files. Admin accounts are kept. This cannot be undone.</p>
              <button onClick={()=>{setDestruct({kind:'all'});setDestructText('');}} className="btn-accent px-4 py-2.5 text-sm mt-5" style={{background:'var(--danger)'}}><Skull className="w-[15px] h-[15px]"/>Self-destruct the database</button>
            </div>
          </>)}

        </main>
      </div>

      {destruct&&(
        <div onClick={()=>!destructing&&setDestruct(null)} className="fixed inset-0 z-[460] flex items-center justify-center p-6" style={{background:'rgba(7,7,9,.6)',backdropFilter:'blur(3px)'}}>
          <div onClick={e=>e.stopPropagation()} className="card w-[420px] max-w-full p-6">
            <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{background:'var(--danger-soft)',color:'var(--danger)'}}><Skull className="w-5 h-5"/></div>
            <h2 className="text-lg font-semibold text-t1 mb-1.5">{destruct.kind==='all'?'Self-destruct the database?':`Destruct ${destruct.user?.username}?`}</h2>
            <p className="text-[13.5px] text-t2 leading-[1.55] mb-4">{destruct.kind==='all'?'Erases all conversations, posts, reports, keys, non-admin accounts and files. No undo.':`Permanently erases ${destruct.user?.username} and all their data. No undo.`}</p>
            <label className="text-[11px] font-semibold text-t3 uppercase tracking-wider block mb-1.5">Type DESTRUCT to confirm</label>
            <input autoFocus value={destructText} onChange={e=>setDestructText(e.target.value)} placeholder="DESTRUCT" className="tk-input mb-5" />
            <div className="flex gap-2.5">
              <button onClick={()=>{setDestruct(null);setDestructText('');}} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
              <button onClick={runDestruct} disabled={destructText!=='DESTRUCT'||destructing} className="btn-accent flex-1 py-[11px] text-sm" style={{background:'var(--danger)'}}>
                {destructing&&<span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin"/>}{destruct.kind==='all'?'Wipe everything':'Destruct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
