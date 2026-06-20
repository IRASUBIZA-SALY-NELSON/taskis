'use client';

import { useEffect, useState } from 'react';

export interface CustomEmoji { id: number; name: string; url: string; createdBy?: string }

const api = (p: string) => `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8080${p}`;
const abs = (u: string) => (u?.startsWith('http') ? u : api(u));

let list: CustomEmoji[] = [];
let map: Record<string, string> = {};
let loaded = false;
const subs = new Set<() => void>();

function notify() { subs.forEach((f) => f()); }

export async function loadCustomEmojis() {
  try {
    const r = await fetch(api('/api/emojis'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const d = await r.json();
    if (Array.isArray(d)) {
      list = d.map((e: CustomEmoji) => ({ ...e, url: abs(e.url) }));
      map = {};
      list.forEach((e) => { map[e.name] = e.url; });
      loaded = true;
      notify();
    }
  } catch { /* ignore */ }
}

export function getCustomMap() { return map; }

export function useCustomEmojis() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (!loaded) loadCustomEmojis();
    return () => { subs.delete(f); };
  }, []);
  return { list, map };
}
