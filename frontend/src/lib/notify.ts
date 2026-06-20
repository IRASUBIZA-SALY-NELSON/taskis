'use client';

let swReg: ServiceWorkerRegistration | null = null;

export async function initNotifications() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    try { swReg = await navigator.serviceWorker.register('/sw.js'); } catch { /* ignore */ }
  }
}

export function notificationsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

interface PushOpts { body?: string; url?: string; tag?: string }

/** Show a notification — via the service worker (works for backgrounded tabs) when possible. */
export async function showNotification(title: string, opts: PushOpts = {}) {
  if (!notificationsEnabled()) return;
  const options: NotificationOptions = {
    body: (opts.body || '').slice(0, 180),
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: opts.tag,
    data: { url: opts.url || '/feed' },
  };
  try {
    const reg = swReg || (('serviceWorker' in navigator) ? await navigator.serviceWorker.ready : null);
    if (reg) { await reg.showNotification(title, options); return; }
  } catch { /* fall through */ }
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); if (opts.url) window.location.href = opts.url; n.close(); };
  } catch { /* ignore */ }
}

let audioCtx: AudioContext | null = null;
export function playPing() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch { /* ignore */ }
}

export function getMuted(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('mutedChannels') || '[]'); } catch { return []; }
}
export function isMuted(channel: string) { return getMuted().includes(channel); }
export function toggleMute(channel: string) {
  const set = new Set(getMuted());
  if (set.has(channel)) set.delete(channel); else set.add(channel);
  try { localStorage.setItem('mutedChannels', JSON.stringify([...set])); } catch { /* ignore */ }
  return set.has(channel);
}

const KEY = 'notifyPrefs';
export function getNotifyPrefs() {
  if (typeof window === 'undefined') return { sound: true, desktop: true };
  try { return { sound: true, desktop: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { sound: true, desktop: true }; }
}
export function setNotifyPrefs(p: { sound?: boolean; desktop?: boolean }) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getNotifyPrefs(), ...p })); } catch { /* ignore */ }
}
