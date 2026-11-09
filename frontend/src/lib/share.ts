'use client';

import { apiUrl } from './api';
import { ensureFreshToken } from './session';

// "Share to Taskis": the Android app receives what other apps share (see TaskisSharePlugin.java) and hands it
// to the page, which lets the person pick a conversation.

export interface SharedFile { name: string; type: string; size: number; path: string }
export interface Shared { text?: string; subject?: string; files?: SharedFile[]; skipped?: boolean }

interface SharePlugin {
  getPending(): Promise<Shared>;
  clear(): Promise<void>;
  upload(o: { path: string; url: string; token: string; channel: string; type: string }): Promise<{ url: string; type: string }>;
  addListener(event: 'share', cb: (s: Shared) => void): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
}

const plugin = (): SharePlugin | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: { Plugins?: { TaskisShare?: SharePlugin } } }).Capacitor?.Plugins?.TaskisShare;

export const shareSupported = () => !!plugin();

export const hasContent = (s: Shared | null | undefined): s is Shared => !!s && !!((s.text && s.text.trim()) || s.files?.length);

/** Show the sheet for real content, or to explain that what was shared could not be read. */
export const worthShowing = (s: Shared | null | undefined): s is Shared => !!s && (hasContent(s) || !!(s as Shared).skipped);

export async function getPendingShare(): Promise<Shared | null> {
  try { const s = await plugin()?.getPending(); return worthShowing(s) ? s : null; } catch { return null; }
}

export function onShare(cb: (s: Shared) => void): () => void {
  let handle: { remove: () => Promise<void> } | null = null;
  let gone = false;
  try {
    // Depending on how the plugin is reached, addListener returns a promise or the handle itself.
    Promise.resolve(plugin()?.addListener('share', (s) => { if (worthShowing(s)) cb(s); }))
      .then((h) => { if (!h) return; if (gone) h.remove(); else handle = h; })
      .catch(() => {});
  } catch { /* sharing unavailable */ }
  return () => { gone = true; try { Promise.resolve(handle?.remove()).catch(() => {}); } catch { /* noop */ } };
}

export function clearShare() { plugin()?.clear().catch(() => {}); }

/** Uploads one shared file straight from the phone's storage; the bytes never pass through the page. */
export async function uploadShared(file: SharedFile, channel: string): Promise<{ url: string; type: string }> {
  await ensureFreshToken();
  const p = plugin();
  if (!p) throw new Error('Sharing is only available in the Taskis app');
  return p.upload({
    path: file.path,
    url: new URL(apiUrl('/api/chat/upload'), window.location.origin).toString(),
    token: localStorage.getItem('token') || '',
    channel,
    type: file.type,
  });
}
