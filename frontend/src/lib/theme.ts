'use client';

export type ThemeMode = 'light' | 'dark' | 'system';

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const t = localStorage.getItem('theme');
  return t === 'dark' ? 'dark' : t === 'system' ? 'system' : 'light';
}

export function systemDark() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemeMode(mode: ThemeMode) {
  localStorage.setItem('theme', mode);
  const dark = mode === 'dark' || (mode === 'system' && systemDark());
  document.documentElement.classList.toggle('light', !dark);
}

/** Keep `system` mode in sync with OS changes. Returns an unsubscribe fn. */
export function initThemeWatcher() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => { if (getThemeMode() === 'system') applyThemeMode('system'); };
  mq.addEventListener?.('change', handler);
  return () => mq.removeEventListener?.('change', handler);
}
