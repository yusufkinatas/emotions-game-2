// UI-side visual hash (DESIGN 16.7): Shade art varies by a hash of the instance uid, never by the engine RNG
// and never by Math.random, so the same Shade always looks the same.

/** FNV-1a 32-bit hash of any mix of numbers and strings. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = typeof part === 'number' ? `n${part}` : `s${part}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2f;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic random source (mulberry32) with helpers for procedural art. */
export interface Rand {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [a, b). */
  range(a: number, b: number): number;
  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number;
  /** Uniform in [-a, a). */
  jitter(a: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
}

export function rand(seed: number): Rand {
  let a = hashSeed(seed) | 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    jitter: (amp) => (next() * 2 - 1) * amp,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
  };
}
