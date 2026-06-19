'use client';

export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

// First option is the default (Geist, loaded via next/font in layout).
export const FONT_OPTIONS: FontOption[] = [
  { id: 'geist', label: 'Geist', stack: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { id: 'system', label: 'System', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { id: 'serif', label: 'Serif', stack: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
  { id: 'mono', label: 'Mono', stack: "var(--font-geist-mono), ui-monospace, 'Cascadia Code', 'Courier New', monospace" },
  { id: 'rounded', label: 'Rounded', stack: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'Segoe UI', system-ui, sans-serif" },
];

export function getFontId(): string {
  if (typeof window === 'undefined') return 'geist';
  return localStorage.getItem('font') || 'geist';
}

export function applyFont(id: string) {
  const opt = FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0];
  localStorage.setItem('font', opt.id);
  if (opt.id === 'geist') {
    localStorage.removeItem('fontStack');
    document.documentElement.style.removeProperty('--font-user');
  } else {
    localStorage.setItem('fontStack', opt.stack);
    document.documentElement.style.setProperty('--font-user', opt.stack);
  }
}
