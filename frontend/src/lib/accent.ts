'use client';

/* Accent palette switcher. Overrides the accent CSS vars on :root; derived
   tints use color-mix so soft/line/text adapt to the chosen hue and theme. */

export interface AccentOption { id: string; label: string; hex: string }

export const ACCENTS: AccentOption[] = [
  { id: 'blue', label: 'Blue', hex: '#3068f5' },
  { id: 'violet', label: 'Violet', hex: '#7c5cff' },
  { id: 'green', label: 'Green', hex: '#2f9e54' },
  { id: 'clay', label: 'Clay', hex: '#d97757' },
  { id: 'rose', label: 'Rose', hex: '#e0558c' },
  { id: 'amber', label: 'Amber', hex: '#d9930a' },
];

const PROPS = ['--accent', '--accent-hover', '--accent-press', '--accent-soft', '--accent-line', '--accent-text'];

export function getAccent(): string {
  if (typeof window === 'undefined') return 'blue';
  return localStorage.getItem('accent') || 'blue';
}

export function applyAccent(id: string) {
  if (typeof document === 'undefined') return;
  try { localStorage.setItem('accent', id); } catch { /* noop */ }
  const root = document.documentElement;
  const a = ACCENTS.find((x) => x.id === id);
  // 'blue' is the built-in default — clear overrides so the theme-tuned tokens win.
  if (!a || id === 'blue') { PROPS.forEach((p) => root.style.removeProperty(p)); return; }
  const h = a.hex;
  root.style.setProperty('--accent', h);
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${h}, white 12%)`);
  root.style.setProperty('--accent-press', `color-mix(in srgb, ${h}, black 14%)`);
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${h} 14%, transparent)`);
  root.style.setProperty('--accent-line', `color-mix(in srgb, ${h} 38%, transparent)`);
  // mix toward the foreground so accent-text stays legible in both themes
  root.style.setProperty('--accent-text', `color-mix(in srgb, ${h} 76%, var(--t1))`);
}

export function initAccent() { applyAccent(getAccent()); }
