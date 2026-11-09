'use client';

import { apiUrl } from './api';

// Push notifications reach the Taskis Android app through Capacitor's PushNotifications
// plugin (Firebase underneath). In a normal browser none of this runs.

type PushPlugin = {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  createChannel(c: Record<string, unknown>): Promise<void>;
  addListener(event: string, cb: (data: any) => void): Promise<unknown>; // eslint-disable-line @typescript-eslint/no-explicit-any
};
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: PushPlugin } };

const capacitor = () => (typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor);
const isNative = () => !!capacitor()?.isNativePlatform?.();

function post(path: string, body: unknown) {
  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

let started = false;

/** Ask for permission, create the vibrating "messages" channel, and give this phone's token to the server. */
export async function initPush() {
  const Push = capacitor()?.Plugins?.PushNotifications;
  if (started || !isNative() || !Push) return;
  started = true;
  try {
    await Push.createChannel({
      id: 'messages', name: 'Messages', description: 'New message alerts',
      importance: 5, visibility: 1, vibration: true, lights: true,
    });
    await Push.addListener('registration', (t: { value: string }) => {
      localStorage.setItem('pushToken', t.value);
      post('/api/push/register', { token: t.value, platform: 'android' });
    });
    // Tapping a notification opens that conversation.
    await Push.addListener('pushNotificationActionPerformed', (a: { notification?: { data?: { channel?: string } } }) => {
      const channel = a?.notification?.data?.channel;
      if (channel) window.dispatchEvent(new CustomEvent('open-channel', { detail: channel }));
    });
    const perm = await Push.requestPermissions();
    if (perm.receive === 'granted') await Push.register();
  } catch {
    started = false;
  }
}

/** This conversation is open: restart its unread count on the server. */
export function markSeen(channel: string) {
  if (!isNative() || !channel || channel.startsWith('__')) return;
  post('/api/push/seen', { channel });
}
