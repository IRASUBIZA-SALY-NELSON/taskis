'use client';

import { useEffect, useRef } from 'react';
import { subscribe } from '@/lib/ws';
import { initNotifications, requestNotificationPermission, showNotification, playPing, getNotifyPrefs, isMuted } from '@/lib/notify';
import { displayOf } from './Sidebar';
import { apiUrl as api } from '@/lib/api';
const NAMED = ['general', 'intel', 'alerts', 'confidential', 'taskis-bot'];

/**
 * Global, cross-channel notifications. Subscribes to every channel the user
 * belongs to (named channels + their DMs) so they get pinged even when the tab
 * is backgrounded or they're looking at a different conversation/the feed.
 * Rendered once in AppShell; renders nothing.
 */
export default function NotificationManager({ user }: { user: any }) {
  const seen = useRef<Set<number>>(new Set());
  const unread = useRef(0);

  useEffect(() => {
    initNotifications();
    requestNotificationPermission().then((ok) => { if (ok) syncWebPush(); });

    const offs: Array<() => void> = [];
    const mentionsMe = (t: string) =>
      !!t && (new RegExp(`(^|\\s)@${user.username}\\b`, 'i').test(t)
        || /(^|\s)@(channel|here|everyone)\b/i.test(t));

    const handle = (tag: string) => (msg: any) => {
      if (!msg || msg.id == null || seen.current.has(msg.id)) return;
      seen.current.add(msg.id);
      const from = msg.sender?.username;
      if (!from || from === user.username) return;
      if (isMuted(tag)) return; // channel muted — stay quiet

      // Only notify for *fresh* messages. The server re-broadcasts a message
      // whenever it's read/reacted/edited; those carry readBy/reactions/edited,
      // so we skip them — this kills the phantom "message that doesn't exist".
      const rx = (msg.reactions || '').trim();
      const readBy = (msg.readBy || '').trim();
      const isFresh = !msg.edited && (rx === '' || rx === '{}') && readBy === '';
      if (!isFresh) return;

      const prefs = getNotifyPrefs();
      const mention = mentionsMe(msg.content || '');
      const name = displayOf(msg.sender);
      if (document.hidden) {
        unread.current += 1;
        document.title = `(${unread.current}) Taskis`;
        // When real push is on, the server already sends this (and honours "hide message text"), so skip the in-page copy.
        if (prefs.desktop && localStorage.getItem('webPush') !== '1') {
          const n = unread.current;
          showNotification(
            n > 1 ? `Taskis · ${n} new messages` : (mention ? `${name} mentioned you` : name),
            { body: `${name}: ${msg.content || 'sent an attachment'}`, url: '/chat', tag: 'taskis-aggregate' },
          );
        }
        if (prefs.sound) playPing();
      } else if (mention && prefs.sound) {
        playPing();
      }
    };

    NAMED.forEach((ch) => offs.push(subscribe(`/topic/${ch}`, handle(ch))));

    fetch(api('/api/chat/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((users) => {
        if (!Array.isArray(users)) return;
        users
          .filter((u) => u.username !== user.username && u.username !== 'Taskis Bot')
          .forEach((op) => {
            const ids = [user.id, op.id].sort((a: number, b: number) => a - b);
            const ch = `dm_${ids[0]}_${ids[1]}`;
            offs.push(subscribe(`/topic/${ch}`, handle(ch)));
          });
      })
      .catch(() => {});

    const onFocus = () => { unread.current = 0; document.title = 'Taskis'; };
    window.addEventListener('focus', onFocus);
    return () => { offs.forEach((f) => f()); window.removeEventListener('focus', onFocus); };
  }, [user.id, user.username]);

  return null;
}
