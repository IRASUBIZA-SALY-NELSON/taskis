'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

const BARS = 40;
// pleasant default envelope shown until/if real peaks are decoded
const DEFAULT_PEAKS = Array.from({ length: BARS }, (_, i) => 0.35 + 0.5 * Math.abs(Math.sin(i * 0.7)) * (0.6 + 0.4 * Math.sin(i * 0.23)));

let sharedCtx: AudioContext | null = null;

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VoiceNote({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [peaks, setPeaks] = useState<number[]>(DEFAULT_PEAKS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        sharedCtx = sharedCtx || new Ctx();
        const audio = await sharedCtx.decodeAudioData(buf.slice(0));
        const data = audio.getChannelData(0);
        const block = Math.floor(data.length / BARS) || 1;
        const arr: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < block; j++) sum += Math.abs(data[i * block + j] || 0);
          arr.push(sum / block);
        }
        const max = Math.max(...arr) || 1;
        if (!cancelled) setPeaks(arr.map((v) => Math.max(0.12, v / max)));
      } catch { /* keep defaults */ }
    })();
    return () => { cancelled = true; };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const seek = (e: React.MouseEvent) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || !dur) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    a.currentTime = frac * dur;
    setProgress(frac);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-border w-[282px] max-w-full mt-1.5" style={{ background: mine ? 'var(--bubble-own)' : 'var(--surface-2)' }}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => { const a = e.target as HTMLAudioElement; setCur(a.currentTime); if (a.duration) setProgress(a.currentTime / a.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); setCur(0); }}
      />
      <button onClick={toggle} className="w-9 h-9 rounded-full grid place-items-center flex-none bg-accent text-on-accent" aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="w-[16px] h-[16px]" fill="currentColor" /> : <Play className="w-[16px] h-[16px] ml-0.5" fill="currentColor" />}
      </button>
      <div ref={barsRef} onClick={seek} className="flex-1 flex items-center gap-[2px] h-8 cursor-pointer">
        {peaks.map((p, i) => {
          const filled = i / BARS <= progress;
          return <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.round(p * 100)}%`, minHeight: 3, background: filled ? 'var(--accent)' : 'var(--border-strong)', transition: 'background 0.1s' }} />;
        })}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-t3 flex-none tabular-nums">
        <Mic className="w-[11px] h-[11px]" />{fmt(playing || cur ? cur : dur)}
      </div>
    </div>
  );
}
