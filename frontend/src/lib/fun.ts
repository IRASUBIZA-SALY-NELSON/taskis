'use client';

/* ============================================================
   Taskis — little joys.
   Confetti bursts, emoji rain, and a handful of silly slash
   commands. All purely client-side; nothing here touches the
   server or persists anything.
   ============================================================ */

const PALETTE = ['#d97757', '#e9a487', '#5fae7e', '#d3a24a', '#c2a5f0', '#8fbf8f'];
const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A celebratory confetti burst from the bottom of the viewport. */
export function confetti(count = 90) {
  if (typeof document === 'undefined' || reduceMotion()) return;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const rise = 38 + Math.random() * 42; // vh travelled up
    const drift = (Math.random() - 0.5) * 36; // vw lateral
    const dur = 1500 + Math.random() * 1400;
    const round = Math.random() > 0.5;
    bit.style.cssText = `position:absolute;bottom:-20px;left:${left}vw;width:${size}px;height:${
      size * (round ? 1 : 0.5)
    }px;background:${PALETTE[i % PALETTE.length]};border-radius:${
      round ? '50%' : '1px'
    };opacity:0;will-change:transform,opacity`;
    bit.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.7 },
        {
          transform: `translate(${drift}vw,-${rise}vh) rotate(${
            (Math.random() - 0.5) * 720
          }deg)`,
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: dur, easing: 'cubic-bezier(.18,.7,.4,1)', fill: 'forwards' },
    );
    layer.appendChild(bit);
  }
  setTimeout(() => layer.remove(), 3200);
}

/** A gentle shower of a given emoji from the top — the Konami payoff. */
export function emojiRain(emoji = '🎉', count = 36) {
  if (typeof document === 'undefined' || reduceMotion()) return;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const drop = document.createElement('span');
    drop.textContent = emoji;
    const left = Math.random() * 100;
    const delay = Math.random() * 1500;
    const dur = 2600 + Math.random() * 2200;
    drop.style.cssText = `position:absolute;top:-40px;left:${left}vw;font-size:${
      18 + Math.random() * 22
    }px;opacity:0`;
    drop.animate(
      [
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        {
          transform: `translateY(110vh) rotate(${(Math.random() - 0.5) * 360}deg)`,
          opacity: 1,
        },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(.4,.1,.7,1)', fill: 'forwards' },
    );
    layer.appendChild(drop);
  }
  setTimeout(() => layer.remove(), 5200);
}

const EIGHT_BALL = [
  'It is certain.', 'Without a doubt.', 'Yes — definitely.', 'You may rely on it.',
  'Most likely.', 'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.',
  'Ask again later.', 'Cannot predict now.', 'Don’t count on it.', 'My reply is no.',
  'Very doubtful.', 'Outlook not so good.',
];

export interface FunResult {
  /** Text to send as the message (null = don't send anything). */
  content: string | null;
  /** Optional visual effect to fire locally on send. */
  effect?: 'confetti' | null;
  /** True if the raw input was a recognised fun command. */
  handled: boolean;
}

/**
 * Interpret silly slash commands. Returns {handled:false} for anything that
 * isn't one of ours, so the caller can fall through to normal sending.
 */
export function runFunCommand(raw: string): FunResult {
  const text = raw.trim();
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd) {
    case '/roll': {
      const sides = Math.max(2, Math.min(1000, parseInt(arg, 10) || 6));
      const n = 1 + Math.floor(Math.random() * sides);
      return { handled: true, content: `🎲 rolled a **${n}** (d${sides})` };
    }
    case '/flip': {
      const r = Math.random() < 0.5 ? 'Heads' : 'Tails';
      return { handled: true, content: `🪙 flipped a coin — **${r}**` };
    }
    case '/8ball': {
      if (!arg) return { handled: true, content: '🎱 Ask the 8-ball a question: `/8ball will it rain?`' };
      const a = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
      return { handled: true, content: `🎱 *${arg}*\n> ${a}` };
    }
    case '/celebrate':
    case '/party':
      return { handled: true, content: `🎉 ${arg || 'Let’s celebrate!'} 🎉`, effect: 'confetti' };
    case '/slam':
      return arg ? { handled: true, content: `::slam:: ${arg}` } : { handled: true, content: 'Usage: /slam your message' };
    case '/gentle':
      return arg ? { handled: true, content: `::gentle:: ${arg}` } : { handled: true, content: 'Usage: /gentle your message' };
    case '/spoiler':
      return arg ? { handled: true, content: `||${arg}||` } : { handled: true, content: 'Usage: /spoiler hidden text' };
    default:
      return { handled: false, content: raw };
  }
}

/** Pull a leading message effect marker (::slam::/::gentle::) off content. */
export function parseEffect(content: string | null | undefined): { effect: 'slam' | 'gentle' | null; text: string } {
  const m = (content || '').match(/^::(slam|gentle)::\s?/);
  if (m) return { effect: m[1] as 'slam' | 'gentle', text: (content || '').slice(m[0].length) };
  return { effect: null, text: content || '' };
}

/** Heuristic: does this message deserve a spontaneous confetti pop? */
export function deservesConfetti(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if ((text.match(/🎉|🥳|🎊/g) || []).length >= 1) return true;
  return /\b(congrats|congratulations|happy birthday|we (did|shipped) it|let'?s celebrate)\b/.test(t);
}

/** Watch for the Konami code; fire `onUnlock` when entered. Returns a cleanup fn. */
export function watchKonami(onUnlock: () => void): () => void {
  const seq = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ];
  let pos = 0;
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === seq[pos] ? pos + 1 : key === seq[0] ? 1 : 0;
    if (pos === seq.length) { pos = 0; onUnlock(); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
