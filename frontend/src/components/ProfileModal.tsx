'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera } from 'lucide-react';
import { initials, toneFor, defaultAvatarUrl } from './Sidebar';
import { markFeature } from '@/lib/features';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface Props {
  user: any;
  onClose: () => void;
}

export default function ProfileModal({ user, onClose }: Props) {
  const api = (p: string) => `http://${window.location.hostname}:8080${p}`;
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [customStatus, setCustomStatus] = useState(user.customStatus || '');
  const [ringColor, setRingColor] = useState<string | null>(user.ringColor || null);
  const RING_COLORS = ['#3068f5', '#7c5cff', '#2f9e54', '#e8833a', '#e0558c', '#0ea5a4', '#d9930a'];
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, cardRef);

  const token = () => localStorage.getItem('token');
  const currentAvatar = user.avatarUrl ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : api(user.avatarUrl)) : defaultAvatarUrl(user.username);

  const pickAvatar = (f: File | null) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(f);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const up = await fetch(api('/api/chat/upload'), { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
        if (up.ok) {
          const d = await up.json();
          await fetch(api('/api/chat/avatar'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ avatarUrl: d.url }) });
        }
      }
      const res = await fetch(api('/api/chat/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ displayName, bio, customStatus, ringColor: ringColor || '' }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (customStatus.trim()) markFeature('status');
        if (ringColor) markFeature('rings');
        localStorage.setItem('user', JSON.stringify(updated));
        window.location.reload();
        return;
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[400] flex items-center justify-center p-6 tk-fade" style={{ background: 'rgba(7,7,9,0.62)', backdropFilter: 'blur(2px)' }}>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-label="Edit profile" onClick={(e) => e.stopPropagation()} className="card tk-pop w-[420px] max-w-full p-7" style={{ boxShadow: 'var(--shadow-lg), var(--edge-hi)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-t1">Edit profile</h2>
          <button onClick={onClose} className="icon-btn w-8 h-8" aria-label="Close"><X className="w-[15px] h-[15px]" /></button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => fileRef.current?.click()} className="relative w-16 h-16 rounded-full grid place-items-center flex-none text-lg font-semibold text-white overflow-hidden group" style={{ background: (avatarPreview || currentAvatar) ? 'transparent' : toneFor(user.username), boxShadow: ringColor ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${ringColor}` : undefined }} title="Change photo">
            {avatarPreview || currentAvatar ? <img src={avatarPreview || currentAvatar!} alt="" className="absolute inset-0 w-full h-full object-cover" /> : initials(user.username)}
            <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-5 h-5" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0] || null)} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-t1">{displayName || user.username}</div>
            <div className="text-[12.5px] text-t3">@{user.username}</div>
          </div>
        </div>

        <label className="eyebrow block mb-1.5">Status</label>
        <input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="🌴 On leave" className="tk-input mb-4" maxLength={80} />

        <label className="eyebrow block mb-1.5">Avatar ring</label>
        <div className="flex items-center gap-2 mb-4">
          <button type="button" onClick={() => setRingColor(null)} title="No ring" className="w-7 h-7 rounded-full grid place-items-center border border-border-strong" style={{ boxShadow: !ringColor ? '0 0 0 2px var(--surface-1), 0 0 0 3.5px var(--t2)' : undefined }}>
            <X className="w-[12px] h-[12px] text-t3" />
          </button>
          {RING_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setRingColor(c)} aria-label={c} className="w-7 h-7 rounded-full transition-transform hover:scale-110" style={{ background: c, boxShadow: ringColor === c ? '0 0 0 2px var(--surface-1), 0 0 0 3.5px var(--t1)' : 'var(--edge-hi)' }} />
          ))}
        </div>

        <label className="eyebrow block mb-1.5">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user.username} className="tk-input mb-4" maxLength={40} />

        <label className="eyebrow block mb-1.5">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short line about you" rows={3} className="tk-input resize-none mb-6" maxLength={300} />

        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-secondary flex-1 py-[11px] text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-accent flex-1 py-[11px] text-sm">
            {saving && <span className="w-[14px] h-[14px] rounded-full border-2 border-white/35 border-t-white tk-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
