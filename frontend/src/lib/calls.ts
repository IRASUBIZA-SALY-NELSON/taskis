'use client';

import { apiUrl } from './api';

let enabledPromise: Promise<boolean> | null = null;

/** Whether the server has calling set up (LiveKit keys present). Asked once per page load. */
export function callsEnabled(): Promise<boolean> {
  if (!enabledPromise) {
    enabledPromise = fetch(apiUrl('/api/calls/config'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => !!d.enabled)
      .catch(() => false);
  }
  return enabledPromise;
}

export function startCall(channel: string, video: boolean) {
  window.dispatchEvent(new CustomEvent('start-call', { detail: { channel, video } }));
}

/** A plain ringing sound made in the browser (no audio file needed), plus a vibration on phones. */
export function playRing(kind: 'incoming' | 'outgoing'): () => void {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext | null = null;
  try { ctx = Ctx ? new Ctx() : null; ctx?.resume().catch(() => {}); } catch { ctx = null; }

  const beep = (freq: number, at: number, dur: number) => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur + 0.05);
  };

  const pulse = () => {
    if (kind === 'incoming') { beep(880, 0, 0.35); beep(660, 0.42, 0.35); try { navigator.vibrate?.([350, 150, 350]); } catch { /* noop */ } }
    else beep(425, 0, 1.0);
  };
  pulse();
  const timer = setInterval(pulse, kind === 'incoming' ? 2400 : 3500);
  return () => {
    clearInterval(timer);
    try { navigator.vibrate?.(0); } catch { /* noop */ }
    ctx?.close().catch(() => {});
  };
}
