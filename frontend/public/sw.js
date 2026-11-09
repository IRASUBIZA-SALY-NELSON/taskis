/* Taskis service worker — shows notifications for backgrounded or closed tabs (Web Push) and
   focuses/opens the app when one is clicked. */

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

function openTarget(channel, call) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        client.focus();
        // Tell the running app which conversation to show, instead of reloading it.
        client.postMessage({ type: call ? 'check-call' : 'open-channel', channel });
        return;
      }
    }
    const url = call ? '/feed' : '/feed' + (channel ? '?c=' + encodeURIComponent(channel) : '');
    if (self.clients.openWindow) return self.clients.openWindow(url);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  event.waitUntil(openTarget(d.channel, d.kind === 'call'));
});

/* A message or call arrived while the app is closed or in the background. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { /* not JSON */ }
  const call = d.kind === 'call';

  event.waitUntil((async () => {
    // Someone is looking at the app right now: they see it live, so stay quiet (calls always ring).
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!call && wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;

    await self.registration.showNotification(d.title || 'Taskis', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'taskis',
      renotify: true,            // buzz again when a new message replaces the previous one
      requireInteraction: call,  // a call keeps ringing on screen until answered or dismissed
      vibrate: call ? [400, 200, 400, 200, 400] : [150, 80, 150],
      data: { channel: d.channel || '', kind: d.kind || 'message' },
    });

    try { if (self.navigator.setAppBadge && d.count) await self.navigator.setAppBadge(d.count); } catch (e) { /* unsupported */ }
  })());
});
