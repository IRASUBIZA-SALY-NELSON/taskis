'use client';

/* Per-browser daily activity streak — counts consecutive days the app is opened. */

const KEY = 'taskis-streak';

interface StreakData { last: string; streak: number; best: number }

function read(): StreakData {
  if (typeof window === 'undefined') return { last: '', streak: 0, best: 0 };
  try { return { last: '', streak: 0, best: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { last: '', streak: 0, best: 0 }; }
}

/** Record today's visit and return the current streak. */
export function recordVisit(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toDateString();
  const d = read();
  if (d.last === today) return d.streak || 1;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streak = d.last === y.toDateString() ? (d.streak || 0) + 1 : 1;
  const best = Math.max(streak, d.best || 0);
  try { localStorage.setItem(KEY, JSON.stringify({ last: today, streak, best })); } catch { /* noop */ }
  return streak;
}

export function getStreak(): number { return read().streak || 0; }
