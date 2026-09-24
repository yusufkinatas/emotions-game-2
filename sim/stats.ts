// Statistics for paired seeds (DESIGN 21.2): Wilson intervals, one-sided McNemar (exact and mid-p) on
// discordant pairs, and a paired bootstrap for continuous metrics.

import { Rng } from '../src/engine/index';

export interface Interval {
  p: number;
  lo: number;
  hi: number;
}

/** Wilson score interval for k successes in n trials (95% by default). */
export function wilson(k: number, n: number, z = 1.96): Interval {
  if (n === 0) return { p: 0, lo: 0, hi: 0 };
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

const logFactCache: number[] = [0];
function logFact(n: number): number {
  for (let i = logFactCache.length; i <= n; i++) logFactCache.push(logFactCache[i - 1]! + Math.log(i));
  return logFactCache[n]!;
}

/** P(X = k) for X ~ Binomial(n, 1/2). */
function halfBinomPmf(n: number, k: number): number {
  return Math.exp(logFact(n) - logFact(k) - logFact(n - k) - n * Math.LN2);
}

export interface McNemar {
  /** Pairs where A won and B lost. */
  b10: number;
  /** Pairs where B won and A lost. */
  b01: number;
  /** One-sided exact p for H1 "A wins more often than B": P(X >= b10), X ~ Bin(b10 + b01, 1/2). */
  pExact: number;
  /** Mid-p variant: P(X > b10) + P(X = b10) / 2. */
  pMid: number;
}

export function mcnemarOneSided(b10: number, b01: number): McNemar {
  const n = b10 + b01;
  if (n === 0) return { b10, b01, pExact: 1, pMid: 1 };
  let tail = 0;
  for (let k = b10 + 1; k <= n; k++) tail += halfBinomPmf(n, k);
  const at = halfBinomPmf(n, b10);
  return { b10, b01, pExact: Math.min(1, tail + at), pMid: Math.min(1, tail + at / 2) };
}

/** McNemar on paired outcomes (same seeds): A's wins vs B's wins. */
export function pairedMcNemar(a: readonly boolean[], b: readonly boolean[]): McNemar {
  let b10 = 0;
  let b01 = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] && !b[i]) b10 += 1;
    else if (!a[i] && b[i]) b01 += 1;
  }
  return mcnemarOneSided(b10, b01);
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Linear-interpolated quantile (q in 0..1). */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return Number.NaN;
  const a = [...xs].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo]! + (a[hi]! - a[lo]!) * (pos - lo);
}

export const median = (xs: readonly number[]): number => quantile(xs, 0.5);

/**
 * Paired bootstrap: resample seed indices jointly and recompute `stat` on both samples.
 * Returns the point estimate of stat(a) - stat(b) (or the ratio) with a 95% percentile interval.
 */
export function pairedBootstrap<T>(
  a: readonly T[],
  b: readonly T[],
  stat: (xs: readonly T[]) => number,
  opts: { iterations?: number; seed?: number; mode?: 'diff' | 'ratio' } = {},
): Interval {
  const n = Math.min(a.length, b.length);
  const mode = opts.mode ?? 'diff';
  const combine = (x: number, y: number) => (mode === 'ratio' ? x / y : x - y);
  const point = combine(stat(a.slice(0, n)), stat(b.slice(0, n)));
  if (n === 0) return { p: Number.NaN, lo: Number.NaN, hi: Number.NaN };
  const rng = new Rng(opts.seed ?? 12345);
  const iters = opts.iterations ?? 1000;
  const out: number[] = [];
  const sa: T[] = new Array(n);
  const sb: T[] = new Array(n);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      const j = rng.int(0, n - 1);
      sa[i] = a[j]!;
      sb[i] = b[j]!;
    }
    const v = combine(stat(sa), stat(sb));
    if (Number.isFinite(v)) out.push(v);
  }
  return { p: point, lo: quantile(out, 0.025), hi: quantile(out, 0.975) };
}
