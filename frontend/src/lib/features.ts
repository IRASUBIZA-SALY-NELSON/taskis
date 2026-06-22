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
  { key: 'polls', title: 'Create polls', desc: 'Type /poll Question | A | B to start a vote.' },
  { key: 'effects', title: 'Message effects', desc: 'Send with /slam, /gentle, or /spoiler tap-to-reveal.' },
  { key: 'superreact', title: 'Super-reactions', desc: 'React 🎉 or 🔥 for a sound + confetti burst.' },
  { key: 'accent', title: 'Pick your accent', desc: 'Recolor the whole app from Settings → Accent.' },
  { key: 'markdown', title: 'Rich formatting', desc: 'Use > quotes, - lists, and | tables | in messages.' },
];

const KEY = 'taskis-features-v2';
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
