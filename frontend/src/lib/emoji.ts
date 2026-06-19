export interface EmojiGroup {
  name: string;
  items: { e: string; k: string }[];
}

// Curated set with search keywords (k). Not exhaustive, but covers the common ground.
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: 'Smileys',
    items: [
      { e: '😀', k: 'grin happy smile' }, { e: '😁', k: 'beaming grin' }, { e: '😂', k: 'joy lol laugh tears' },
      { e: '🤣', k: 'rofl rolling laugh' }, { e: '😊', k: 'blush smile happy' }, { e: '😇', k: 'innocent angel' },
      { e: '🙂', k: 'slight smile' }, { e: '😉', k: 'wink' }, { e: '😍', k: 'heart eyes love' },
      { e: '🥰', k: 'love hearts adore' }, { e: '😘', k: 'kiss blow' }, { e: '😋', k: 'yum tasty' },
      { e: '😎', k: 'cool sunglasses' }, { e: '🤩', k: 'star struck wow' }, { e: '🥳', k: 'party celebrate' },
      { e: '🤔', k: 'thinking hmm' }, { e: '🤨', k: 'raised eyebrow skeptical' }, { e: '😐', k: 'neutral meh' },
      { e: '😴', k: 'sleep tired zzz' }, { e: '😢', k: 'cry sad tear' }, { e: '😭', k: 'sob crying' },
      { e: '😤', k: 'huff frustrated' }, { e: '😡', k: 'angry mad rage' }, { e: '🤯', k: 'mind blown' },
      { e: '😱', k: 'scream shock fear' }, { e: '😬', k: 'grimace awkward' }, { e: '🙄', k: 'eye roll' },
      { e: '😏', k: 'smirk' }, { e: '🤐', k: 'zip mouth quiet' }, { e: '🤗', k: 'hug' },
      { e: '🤫', k: 'shush quiet' }, { e: '🤥', k: 'lying liar' }, { e: '😶', k: 'no mouth blank' },
    ],
  },
  {
    name: 'Gestures',
    items: [
      { e: '👍', k: 'thumbs up like approve yes' }, { e: '👎', k: 'thumbs down dislike no' }, { e: '👏', k: 'clap applause' },
      { e: '🙌', k: 'raised hands praise hooray' }, { e: '🙏', k: 'pray thanks please' }, { e: '🤝', k: 'handshake deal' },
      { e: '👊', k: 'fist bump punch' }, { e: '✊', k: 'fist power' }, { e: '🤞', k: 'fingers crossed luck' },
      { e: '✌️', k: 'peace victory' }, { e: '🤙', k: 'call me shaka' }, { e: '👌', k: 'ok perfect' },
      { e: '🤌', k: 'pinched chef italian' }, { e: '👋', k: 'wave hello bye' }, { e: '💪', k: 'muscle strong flex' },
      { e: '🫶', k: 'heart hands love' }, { e: '👀', k: 'eyes looking watch' }, { e: '🧠', k: 'brain smart' },
    ],
  },
  {
    name: 'Hearts',
    items: [
      { e: '❤️', k: 'red heart love' }, { e: '🧡', k: 'orange heart' }, { e: '💛', k: 'yellow heart' },
      { e: '💚', k: 'green heart' }, { e: '💙', k: 'blue heart' }, { e: '💜', k: 'purple heart' },
      { e: '🖤', k: 'black heart' }, { e: '🤍', k: 'white heart' }, { e: '💕', k: 'two hearts love' },
      { e: '💞', k: 'revolving hearts' }, { e: '💔', k: 'broken heart' }, { e: '❤️‍🔥', k: 'heart fire' },
    ],
  },
  {
    name: 'Objects',
    items: [
      { e: '🔥', k: 'fire lit hot' }, { e: '✨', k: 'sparkles shiny' }, { e: '🎉', k: 'party tada celebrate' },
      { e: '🎊', k: 'confetti party' }, { e: '💯', k: 'hundred perfect' }, { e: '✅', k: 'check done yes' },
      { e: '❌', k: 'cross no wrong' }, { e: '⚠️', k: 'warning caution' }, { e: '🚀', k: 'rocket launch ship' },
      { e: '⭐', k: 'star' }, { e: '🌟', k: 'glowing star' }, { e: '💡', k: 'idea bulb light' },
      { e: '📌', k: 'pin' }, { e: '📎', k: 'paperclip attach' }, { e: '🔒', k: 'lock secure' },
      { e: '⏰', k: 'alarm time clock' }, { e: '☕', k: 'coffee' }, { e: '🍕', k: 'pizza food' },
      { e: '🎯', k: 'target bullseye goal' }, { e: '🏆', k: 'trophy win' }, { e: '💀', k: 'skull dead' },
    ],
  },
];

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '🔥'];

export function searchEmoji(query: string): string[] {
  const q = query.trim().toLowerCase();
  const all = EMOJI_GROUPS.flatMap((g) => g.items);
  if (!q) return all.map((it) => it.e);
  return all.filter((it) => it.k.includes(q)).map((it) => it.e);
}
