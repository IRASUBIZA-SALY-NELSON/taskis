'use client';

/* ============================================================
   "What's new" feature tour + exploration checklist.
   Tracks which new features each teammate has tried, persisted
   locally per browser. Components call markFeature(key) when a
   feature is used; the panel listens and ticks it off.
   ============================================================ */

export interface FeatureItem {
  key: string;
  title: string;
  desc: string;
}

export const FEATURES: FeatureItem[] = [
  { key: 'profile', title: 'Your profile page', desc: 'Click your name in the sidebar — manage profile, settings & posts in one place.' },
  { key: 'polls', title: 'Polls', desc: 'Tap the poll button in the composer to ask the team.' },
  { key: 'notes', title: 'Notes to self', desc: 'Open “Notes” in the sidebar — a private space just for you.' },
  { key: 'rings', title: 'Custom avatar ring', desc: 'Pick a ring color in your profile.' },
  { key: 'recap', title: 'Daily recap & streaks', desc: 'Open the Feed for your streak and the week’s top post.' },
  { key: 'status', title: 'Custom status', desc: 'Set “🌴 On leave” from your profile.' },
  { key: 'dnd', title: 'Do Not Disturb', desc: 'Silence pings — with optional quiet hours — in Settings.' },
  { key: 'favorites', title: 'Favorite channels', desc: 'Star a channel to pin it to the top.' },
  { key: 'effects', title: 'Message effects', desc: 'Send with /slam, /gentle, or /spoiler tap-to-reveal.' },
  { key: 'accent', title: 'Pick your accent', desc: 'Recolor the whole app from Settings → Accent.' },
];

const KEY = 'taskis-features-v5';
const EVT = 'taskis:feature';

interface State { seen?: boolean; dismissed?: boolean; done?: string[] }

function read(): State {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function write(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function getDone(): Set<string> {
  return new Set(read().done || []);
}

export function hasSeenTour(): boolean {
  return !!read().seen;
}

export function setSeen() {
  const s = read();
  if (s.seen) return;
  s.seen = true;
  write(s);
}

/** Mark a feature as explored; ticks it off the checklist live. */
export function markFeature(key: string) {
  if (typeof window === 'undefined') return;
  const s = read();
  const done = new Set(s.done || []);
  if (done.has(key)) return;
  done.add(key);
  s.done = [...done];
  write(s);
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
}

/** Subscribe to exploration changes. Returns an unsubscribe fn. */
export function onFeatureChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}
