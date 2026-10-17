// Seeded randomness, so the same seed (for example a user id plus a date)
// always gives the same quests. That keeps quest building repeatable and
// testable.

export type Random = () => number; // 0 (inclusive) to 1 (exclusive)

// Turns any text into a 32-bit number (FNV-1a).
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// A small, fast generator (mulberry32) seeded from text.
export function seededRandom(seed: string): Random {
  let state = hashText(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One item from a non-empty list.
export function pick<T>(items: readonly T[], random: Random): T {
  if (items.length === 0) throw new Error("Cannot pick from an empty list");
  return items[Math.floor(random() * items.length)];
}
