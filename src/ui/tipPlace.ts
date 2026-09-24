// Coach mark placement (DESIGN 17.3): pure geometry, DOM-free so it runs in Node tests.
// Tries the four sides of the anchor (and three horizontal offsets above and below), keeps the ones that fit
// the viewport, and picks the one that covers the least of the UI the player needs (End Turn, the top bar,
// lethal banners, intents, nameplates...), preferring above, then below, then left, then right.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Avoid extends Rect {
  /** How bad it is to cover this (area fraction multiplier). */
  weight: number;
}

export type TipArrow = 'down' | 'up' | 'left' | 'right' | 'none';

export interface TipPlacement {
  arrow: TipArrow;
  left: number;
  top: number;
  /** Arrow offset along the bubble edge (x for up/down, y for left/right), in px. */
  arrowAt?: number;
}

export interface PlaceInput {
  anchor: Rect | null;
  bubble: { w: number; h: number };
  view: { w: number; h: number };
  avoid: readonly Avoid[];
  /** Layout unit (px per design px). */
  u: number;
  gap?: number;
  margin?: number;
}

const area = (r: Rect): number => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** True if `outer` contains `inner` (or they are the same box). */
export function contains(outer: Rect, inner: Rect): boolean {
  return outer.left <= inner.left + 0.5 && outer.top <= inner.top + 0.5 && outer.right >= inner.right - 0.5 && outer.bottom >= inner.bottom - 0.5;
}

export function placeTip(p: PlaceInput): TipPlacement {
  const { anchor: a, bubble, view, u } = p;
  const gap = (p.gap ?? 12) * u;
  const m = p.margin ?? 8;
  const bw = bubble.w;
  const bh = bubble.h;
  if (!a || area(a) <= 0) return { arrow: 'none', left: (view.w - bw) / 2, top: 60 * u };

  const cx = (a.left + a.right) / 2;
  const cy = (a.top + a.bottom) / 2;
  const clampX = (x: number): number => Math.min(view.w - bw - m, Math.max(m, x));
  const clampY = (y: number): number => Math.min(view.h - bh - m, Math.max(m, y));
  const cands: (TipPlacement & { pref: number })[] = [];

  const horizontal = (arrow: 'down' | 'up', top: number, pref: number): void => {
    const lefts = [cx - 31 * u, cx - bw / 2, cx - bw + 31 * u];
    const seen = new Set<number>();
    lefts.forEach((x, i) => {
      const left = Math.round(clampX(x));
      if (seen.has(left)) return;
      seen.add(left);
      const arrowAt = Math.min(bw - 24 * u, Math.max(10 * u, cx - left - 7 * u));
      cands.push({ arrow, left, top, arrowAt, pref: pref + i * 0.02 });
    });
  };
  const vertical = (arrow: 'left' | 'right', left: number, pref: number): void => {
    const top = Math.round(clampY(cy - 21 * u));
    const arrowAt = Math.min(bh - 20 * u, Math.max(8 * u, cy - top - 7 * u));
    cands.push({ arrow, left, top, arrowAt, pref });
  };

  if (a.top - bh - gap >= m) horizontal('down', a.top - bh - gap, 0);
  if (a.bottom + bh + gap <= view.h - m) horizontal('up', a.bottom + gap, 0.1);
  if (a.left - bw - gap >= m) vertical('right', a.left - bw - gap, 0.15);
  if (a.right + bw + gap <= view.w - m) vertical('left', a.right + gap, 0.2);
  if (!cands.length) return { arrow: 'none', left: (view.w - bw) / 2, top: 60 * u };

  const bArea = bw * bh || 1;
  let best = cands[0]!;
  let bestScore = Infinity;
  for (const c of cands) {
    const box: Rect = { left: c.left, top: c.top, right: c.left + bw, bottom: c.top + bh };
    let score = c.pref + (overlap(box, a) / bArea) * 20;
    for (const r of p.avoid) score += (overlap(box, r) / bArea) * r.weight;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = c;
    }
  }
  return best.arrowAt === undefined ? { arrow: best.arrow, left: best.left, top: best.top } : { arrow: best.arrow, left: best.left, top: best.top, arrowAt: best.arrowAt };
}
