// Geometry helpers for the procedural Shades (DESIGN 16.7): smooth closed paths through seeded points,
// limbs, jagged cracks, pearl eyes with mood lids and whole facial expressions per feeling.
// Pure string builders in the 200x210 Shade frame.

import type { Shade } from '../../engine/emotions';
import type { Rand } from './hash';
import { n, polar } from './svg';

export interface P {
  x: number;
  y: number;
  /** Sharp points get a cusp instead of a smooth pass. */
  sharp?: boolean;
}

export const GROUND = 196;
export const CX = 100;

function catmull(pts: readonly P[], closed: boolean): string {
  const N = pts.length;
  const at = (i: number): P => (closed ? pts[(i + N) % N]! : pts[Math.max(0, Math.min(N - 1, i))]!);
  let d = `M${n(pts[0]!.x)} ${n(pts[0]!.y)}`;
  const last = closed ? N : N - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = p1.sharp ? p1 : { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = p2.sharp ? p2 : { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
}

export const closedPath = (pts: readonly P[]): string => catmull(pts, true);
export const openPath = (pts: readonly P[]): string => catmull(pts, false);

/** A limb: rim stroke under an ink stroke so it reads against the dark stage. */
export function limb(d: string, w: number, cls = 'sa-limb'): string {
  return `<g class="${cls}"><path class="sa-limb__rim" d="${d}" stroke-width="${n(w + 3)}"/><path class="sa-limb__ink" d="${d}" stroke-width="${n(w)}"/></g>`;
}

/** Jagged crack paths radiating from an origin, heading within [lo, hi] degrees (0 = up, clockwise). */
export function cracks(r: Rand, ox: number, oy: number, spread: number, count: number, lo = 0, hi = 360): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let angle = lo + ((hi - lo) * (i + 0.5)) / count + r.jitter(Math.min(40, (hi - lo) / count / 2));
    let [x, y] = [ox + r.jitter(5), oy + r.jitter(5)];
    let d = `M${n(x)} ${n(y)}`;
    const steps = r.int(3, 5);
    const seg = spread / (steps + 0.5);
    // Draw the branch decision for every step so the stream advances the same way for every crack.
    for (let s = 0; s < steps; s++) {
      angle += r.jitter(34);
      [x, y] = polar(x, y, seg * r.range(0.7, 1.2), angle);
      d += `L${n(x)} ${n(y)}`;
      const branch = r.chance(0.6);
      const turn = r.pick([-55, 55]);
      if (s === 1 && branch) {
        const [bx, by] = polar(x, y, seg * 0.6, angle + turn);
        d += `M${n(x)} ${n(y)}L${n(bx)} ${n(by)}M${n(x)} ${n(y)}`;
      }
    }
    out.push(d);
  }
  return out;
}

/** Fissures: unbranched zigzags that start on an ellipse's rim and run inward (The Mask). */
export function fissures(r: Rand, cx: number, cy: number, rx: number, ry: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i * 137.5 + r.range(0, 40)) % 360) * (Math.PI / 180);
    let x = cx + Math.sin(a) * rx;
    let y = cy - Math.cos(a) * ry;
    const inX = (cx - x) / Math.hypot(cx - x, cy - y);
    const inY = (cy - y) / Math.hypot(cx - x, cy - y);
    let d = `M${n(x)} ${n(y)}`;
    const steps = r.int(3, 4);
    const len = Math.min(rx, ry) * r.range(0.45, 0.7);
    for (let s = 0; s < steps; s++) {
      const side = s % 2 === 0 ? 1 : -1;
      x += (inX * len) / steps - inY * side * r.range(2.5, 4.5);
      y += (inY * len) / steps + inX * side * r.range(2.5, 4.5);
      d += `L${n(x)} ${n(y)}`;
    }
    out.push(d);
  }
  return out;
}

export type Lid = 'sad' | 'angry' | 'worried' | 'tired' | 'none';

export interface EyeOpts {
  lid: Lid;
  /** -1 for the viewer's left eye, 1 for the right. */
  side: -1 | 1;
  look?: [number, number];
  pupil?: number;
  iris?: boolean;
  blinkDur: number;
  blinkDelay: number;
  cls?: string;
}

/** Pearl eye with pupil, glint and an ink lid that sets the mood. */
export function eye(cx: number, cy: number, rx: number, ry: number, o: EyeOpts): string {
  const [lx, ly] = o.look ?? [0, 0];
  const pr = o.pupil ?? Math.min(rx, ry) * 0.46;
  let lid = '';
  if (o.lid !== 'none') {
    const inner = cx - o.side * rx;
    const outer = cx + o.side * rx;
    const [yi, yo] =
      o.lid === 'sad'
        ? [cy - ry * 0.62, cy - ry * 0.02]
        : o.lid === 'angry'
          ? [cy - ry * 0.12, cy - ry * 0.72]
          : o.lid === 'worried'
            ? [cy - ry * 0.78, cy - ry * 0.45]
            : [cy - ry * 0.2, cy - ry * 0.2];
    const top = cy - ry - 3;
    const xi = inner - o.side * 2.5;
    const xo = outer + o.side * 2.5;
    lid = `<path class="sa-lid" d="M${n(xi)} ${n(yi)}L${n(xo)} ${n(yo)}L${n(xo)} ${n(top)}L${n(xi)} ${n(top)}Z"/>`;
  }
  const iris = o.iris ? `<circle class="sa-iris" cx="${n(cx + lx)}" cy="${n(cy + ly)}" r="${n(Math.max(pr * 1.9, Math.min(rx, ry) * 0.36))}"/>` : '';
  return (
    `<g class="sa-eye ${o.cls ?? ''}" style="transform-origin:${n(cx)}px ${n(cy)}px;animation-duration:${n(o.blinkDur)}s;animation-delay:${n(o.blinkDelay)}s">` +
    `<ellipse class="sa-eye__white" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/>` +
    `<g class="sa-look">${iris}<circle class="sa-pupil" cx="${n(cx + lx)}" cy="${n(cy + ly)}" r="${n(pr)}"/>` +
    `<circle class="sa-glint" cx="${n(cx + lx - pr * 0.35)}" cy="${n(cy + ly - pr * 0.4)}" r="${n(Math.max(0.8, pr * 0.32))}"/></g>` +
    `${lid}</g>`
  );
}

export function blink(r: Rand): Pick<EyeOpts, 'blinkDur' | 'blinkDelay'> {
  return { blinkDur: r.range(4.2, 7.5), blinkDelay: -r.range(0, 6) };
}

export function mouth(d: string, cls = ''): string {
  return `<path class="sa-mouth${cls ? ` ${cls}` : ''}" d="${d}"/>`;
}

// ------------------------------------------------------------------------------------------------
// Expressions: the showing face sets lids, brows, pupils and mouth, so a compound that turns changes mood
// ------------------------------------------------------------------------------------------------

export interface EyeSpot {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Open eyes only; closed ones are drawn as a lash curve. */
  open?: boolean;
}

export interface FaceSpec {
  eyes: readonly EyeSpot[];
  mouth: { x: number; y: number; w: number };
  /** Draw brows over the first two eyes. */
  brows?: boolean;
  /** Eyes get cure-coloured irises (Fear's family look). */
  iris?: boolean;
  /** Extras by mood: Anger's fang, a tear under the eye when Sadness shows. */
  fang?: boolean;
  tears?: boolean;
}

interface Mood {
  lid: Lid;
  look: [number, number];
  /** Pupil radius as a share of the eye's smaller radius. */
  pupil: number;
  brow: 'angry' | 'sad' | 'raised' | 'worried' | 'flat' | 'none';
  mouth: 'frown' | 'pout' | 'flat' | 'wobble' | 'sag' | 'zigzag';
}

const MOODS: Record<Shade, Mood> = {
  anger: { lid: 'angry', look: [0, 1], pupil: 0.46, brow: 'angry', mouth: 'frown' },
  sadness: { lid: 'sad', look: [-1.2, 2], pupil: 0.46, brow: 'sad', mouth: 'pout' },
  loneliness: { lid: 'sad', look: [1.8, 0.6], pupil: 0.44, brow: 'none', mouth: 'flat' },
  fear: { lid: 'none', look: [0, -0.4], pupil: 0.17, brow: 'raised', mouth: 'wobble' },
  despair: { lid: 'tired', look: [-1, 2.4], pupil: 0.44, brow: 'flat', mouth: 'sag' },
  anxiety: { lid: 'worried', look: [-1.4, 0], pupil: 0.26, brow: 'worried', mouth: 'zigzag' },
};

function browPath(kind: Mood['brow'], e: EyeSpot, side: -1 | 1): string {
  const y = e.y - e.ry - 3.2;
  const inner = e.x - side * e.rx * 0.95;
  const outer = e.x + side * e.rx * 0.95;
  switch (kind) {
    case 'angry':
      return `M${n(inner)} ${n(y + 1.8)}L${n(outer)} ${n(y - 4.2)}`;
    case 'sad':
      return `M${n(inner)} ${n(y - 3.8)}Q${n(e.x)} ${n(y - 2.8)} ${n(outer)} ${n(y + 0.6)}`;
    case 'raised':
      return `M${n(inner)} ${n(y - 2.6)}Q${n(e.x)} ${n(y - 8.4)} ${n(outer)} ${n(y - 3.4)}`;
    case 'worried':
      return `M${n(inner)} ${n(y - 4.6)}Q${n(e.x + side * e.rx * 0.2)} ${n(y - 3.6)} ${n(outer)} ${n(y - 1.2)}`;
    case 'flat':
      return `M${n(inner)} ${n(y + 0.6)}L${n(outer)} ${n(y + 0.6)}`;
    default:
      return '';
  }
}

function mouthPath(kind: Mood['mouth'], m: FaceSpec['mouth']): string {
  const { x, y, w } = m;
  const h = w / 2;
  switch (kind) {
    case 'frown':
      return `M${n(x - h)} ${n(y + 3)}Q${n(x)} ${n(y - 5)} ${n(x + h)} ${n(y + 3)}`;
    case 'pout':
      return `M${n(x - h * 0.7)} ${n(y + 2)}Q${n(x)} ${n(y - 3)} ${n(x + h * 0.7)} ${n(y + 2)}`;
    case 'flat':
      return `M${n(x - h * 0.55)} ${n(y + 0.6)}Q${n(x)} ${n(y - 0.4)} ${n(x + h * 0.55)} ${n(y + 1)}`;
    case 'wobble': {
      const s = w / 6;
      return `M${n(x - h)} ${n(y)}q${n(s / 2)} ${n(-2.6)} ${n(s)} 0t${n(s)} 0t${n(s)} 0t${n(s)} 0t${n(s)} 0t${n(s)} 0`;
    }
    case 'sag':
      return `M${n(x - h)} ${n(y)}q${n(h / 2)} ${n(-1.6)} ${n(h)} 0t${n(h)} 0`;
    case 'zigzag': {
      const s = w / 6;
      let d = `M${n(x - h)} ${n(y)}`;
      for (let i = 0; i < 6; i++) d += `l${n(s)} ${i % 2 === 0 ? -2.6 : 2.6}`;
      return d;
    }
  }
}

/**
 * A whole facial expression for a mood (the showing face's feeling). Blink timings come from `r`, drawn
 * once per eye slot in order, so every mood of the same Shade blinks in the same rhythm.
 */
export function expression(mood: Shade, f: FaceSpec, r: Rand): string {
  const m = MOODS[mood];
  let out = '';
  f.eyes.forEach((e, i) => {
    const b = blink(r);
    const side: -1 | 1 = e.x < f.mouth.x ? -1 : 1;
    if (e.open === false) {
      out += `<path class="sa-closed-eye" d="M${n(e.x - e.rx)} ${n(e.y)}Q${n(e.x)} ${n(e.y + e.ry * 0.7)} ${n(e.x + e.rx)} ${n(e.y)}"/>`;
      return;
    }
    const lookScale = Math.min(1, e.rx / 8);
    out += eye(e.x, e.y, e.rx, e.ry, {
      lid: m.lid,
      side,
      look: [m.look[0] * lookScale, m.look[1] * lookScale],
      pupil: Math.min(e.rx, e.ry) * m.pupil,
      iris: f.iris === true,
      ...b,
    });
    if (f.brows && i < 2 && m.brow !== 'none') out += `<path class="sa-brow" d="${browPath(m.brow, e, side)}"/>`;
  });
  out += mouth(mouthPath(m.mouth, f.mouth));
  if (mood === 'anger' && f.fang) {
    const { x, y } = f.mouth;
    out += `<path class="sa-fang" d="M${n(x + 5)} ${n(y - 1.9)}L${n(x + 10)} ${n(y - 0.4)}L${n(x + 7.8)} ${n(y + 4.6)}Z"/>`;
  }
  if (mood === 'sadness' && f.tears !== false && f.eyes[0]) {
    const tearAt = (e: EyeSpot, delay: number) =>
      `<path class="sa-tear" style="animation-delay:${n(delay)}s" d="M${n(e.x)} ${n(e.y + e.ry)}c1.8 2.8 3.5 4.8 3.5 6.5a3.5 3.5 0 0 1 -7 0c0 -1.7 1.7 -3.7 3.5 -6.5Z"/>`;
    out += tearAt(f.eyes[0], 0.4);
    if (f.eyes[1]) out += tearAt(f.eyes[1], 1.7);
  }
  return out;
}
