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
  { key: 'uploads', title: 'Multiple files & folders', desc: 'Attach many files — or a whole folder — in one message.' },
  { key: 'preview', title: 'Preview files in-app', desc: 'Open images, PDFs, video and docs without leaving chat.' },
  { key: 'share', title: 'Share a conversation', desc: 'Invite teammates and copy an access link.' },
  { key: 'select', title: 'Select & bulk-delete', desc: 'Tick several messages and clear them at once.' },
  { key: 'confidential', title: 'Unlock #confidential', desc: 'A locked channel that asks for a passkey first.' },
  { key: 'slash', title: 'Slash commands & confetti', desc: 'Try /roll, /flip, /8ball or /celebrate 🎉' },
  { key: 'heart', title: 'Double-tap to react', desc: 'Double-click any message to ❤️ it instantly.' },
];

const KEY = 'taskis-features-v1';
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
