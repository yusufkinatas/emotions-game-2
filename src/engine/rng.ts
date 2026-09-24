// Seeded randomness (DESIGN.md 20.5). The engine never uses Math.random.
// Stream states are plain numbers stored in GameState so states stay JSON and replayable.

/** FNV-1a over the UTF-16 code units of the joined parts, then a murmur3 finalizer. Unsigned 32-bit int. */
export function hash32(...parts: (number | string)[]): number {
  const s = parts.map(String).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** One mulberry32 step. Returns the next stream state and a float in [0, 1). */
export function next(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [s, out];
}

/**
 * Mutable wrapper around a stream state for use inside one reducer step.
 * Read `.state` back into GameState when done.
 */
export class Rng {
  constructor(public state: number) {}

  float(): number {
    const [s, f] = next(this.state);
    this.state = s;
    return f;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.float() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty list');
    return items[this.int(0, items.length - 1)]!;
  }

  /** Weighted pick. Weights <= 0 are never picked. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((a, b) => a + Math.max(0, b.weight), 0);
    if (total <= 0) throw new Error('Rng.weighted with no positive weight');
    let r = this.float() * total;
    for (const { item, weight } of items) {
      if (weight <= 0) continue;
      r -= weight;
      if (r < 0) return item;
    }
    return items[items.length - 1]!.item;
  }

  /** Fisher-Yates shuffle, returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** Convenience: an Rng seeded from hashed parts. */
export const rngFrom = (...parts: (number | string)[]): Rng => new Rng(hash32(...parts));
