'use client';

import { apiBase, apiUrl } from './api';

// A device signs in once and stays signed in: the short-lived session token is renewed
// from a long-lived refresh token, so nobody sees the login screen again until they log out
// or stay away for the whole refresh window (90 days by default).

const KEYS = ['token', 'fileToken', 'refreshToken', 'user'];
const RENEW_BEFORE_MS = 5 * 60 * 1000;

type SessionData = { token?: string; fileToken?: string; refreshToken?: string; user?: unknown };

export function saveSession(d: SessionData) {
  if (d.token) localStorage.setItem('token', d.token);
  if (d.fileToken) localStorage.setItem('fileToken', d.fileToken);
  if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
  if (d.user) localStorage.setItem('user', JSON.stringify(d.user));
}

export function clearSession() {
  KEYS.forEach((k) => localStorage.removeItem(k));
}

function expiresAt(jwt: string | null): number {
  try {
    const payload = JSON.parse(atob((jwt || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

type Outcome = 'ok' | 'rejected' | 'offline';
let inflight: Promise<Outcome> | null = null;

const rawFetch: typeof fetch | null = typeof window !== 'undefined' ? window.fetch.bind(window) : null;

/** Trade the refresh token for a new session token. Only a server rejection signs the device out; being offline never does. */
export function refreshSession(): Promise<Outcome> {
  if (inflight) return inflight;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken || !rawFetch) return Promise.resolve('rejected');
  inflight = (async (): Promise<Outcome> => {
    try {
      const res = await rawFetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status === 401) {
        clearSession();
        if (window.location.pathname !== '/') window.location.href = '/';
        return 'rejected';
      }
      if (!res.ok) return 'offline';
      saveSession(await res.json());
      return 'ok';
    } catch {
      return 'offline';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Renew the session token if it is expired or about to be. Safe to call often. */
export async function ensureFreshToken(): Promise<void> {
  if (!localStorage.getItem('refreshToken')) return;
  if (expiresAt(localStorage.getItem('token')) - Date.now() < RENEW_BEFORE_MS) await refreshSession();
}

/** Sign this device out: forget the session locally and revoke it on the server. */
export function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  clearSession();
  if (refreshToken && rawFetch) {
    rawFetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => {});
  }
}

function isProtectedApi(url: string): boolean {
  if (/\/api\/auth\/(login|register|access|refresh|logout)(\?|$)/.test(url)) return false;
  const base = apiBase();
  return url.startsWith('/api/') || (base !== '' && url.startsWith(`${base}/api/`));
}

function withToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

// Every API call goes through here: renew before sending, and if the server still says the
// session is gone (401), renew once and replay the call.
if (typeof window !== 'undefined' && rawFetch && !(window as { __taskisSession?: boolean }).__taskisSession) {
  (window as { __taskisSession?: boolean }).__taskisSession = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== 'string' || !isProtectedApi(input)) return rawFetch(input, init);
    const carriesToken = new Headers(init?.headers).get('Authorization')?.startsWith('Bearer ');
    if (!carriesToken) return rawFetch(input, init);

    await ensureFreshToken();
    const current = localStorage.getItem('token');
    const res = await rawFetch(input, current ? withToken(init, current) : init);
    if (res.status !== 401 || !localStorage.getItem('refreshToken')) return res;

    if ((await refreshSession()) !== 'ok') return res;
    return rawFetch(input, withToken(init, localStorage.getItem('token') || ''));
  };

  // Coming back to the app after a long time away: renew right away instead of waiting for the first failed call.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensureFreshToken().catch(() => {});
  });
}
