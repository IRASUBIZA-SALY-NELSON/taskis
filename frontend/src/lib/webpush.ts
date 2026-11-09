'use client';

import { apiUrl } from './api';

// Desktop (and installed web app) push: the browser keeps a subscription with its own push service, and the
// Taskis server sends to it, so notifications arrive even with every Taskis tab closed. The native Android
// app uses Firebase instead (lib/push.ts).

const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export function webPushSupported(): boolean {
  return typeof window !== 'undefined' && !isNative() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

let syncing: Promise<boolean> | null = null;

/** Make sure this browser is subscribed and the server knows about it. Needs notification permission already granted. */
export function syncWebPush(): Promise<boolean> {
  if (!webPushSupported() || Notification.permission !== 'granted') return Promise.resolve(false);
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const info = await fetch(apiUrl('/api/push/web/key'), { headers: auth() }).then((r) => (r.ok ? r.json() : null));
      if (!info?.enabled || !info.publicKey) { localStorage.removeItem('webPush'); return false; }

      const reg = await navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);
      const key = keyBytes(info.publicKey);
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; } // server keys changed
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });

      const json = sub.toJSON();
      const res = await fetch(apiUrl('/api/push/web/subscribe'), { method: 'POST', headers: auth(), body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      if (!res.ok) return false;
      localStorage.setItem('webPushEndpoint', sub.endpoint);
      localStorage.setItem('webPush', '1'); // real push is on: the in-page popup stands down so nothing shows twice
      return true;
    } catch {
      return false;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Ask for permission (call from a click) and subscribe. */
export async function enableWebPush(): Promise<boolean> {
  if (!webPushSupported()) return false;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { return false; }
  }
  return syncWebPush();
}

/** Stop pushing to this browser (used on logout). */
export function forgetWebPush() {
  try {
    const endpoint = localStorage.getItem('webPushEndpoint');
    localStorage.removeItem('webPush');
    localStorage.removeItem('webPushEndpoint');
    if (endpoint) {
      fetch(apiUrl('/api/push/web/unsubscribe'), { method: 'POST', headers: auth(), body: JSON.stringify({ endpoint }), keepalive: true }).catch(() => {});
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => s?.unsubscribe()).catch(() => {});
  } catch { /* noop */ }
}
