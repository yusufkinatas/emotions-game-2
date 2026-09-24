// Geometry helpers for the procedural Shades (DESIGN 16.7): smooth closed paths through seeded points,
// limbs, jagged cracks, pearl eyes with mood lids. Pure string builders in the 200x210 Shade frame.

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
    for (let s = 0; s < steps; s++) {
      angle += r.jitter(34);
      [x, y] = polar(x, y, seg * r.range(0.7, 1.2), angle);
      d += `L${n(x)} ${n(y)}`;
      if (s === 1 && r.chance(0.6)) {
        const [bx, by] = polar(x, y, seg * 0.6, angle + r.pick([-55, 55]));
        d += `M${n(x)} ${n(y)}L${n(bx)} ${n(by)}M${n(x)} ${n(y)}`;
      }
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
  const iris = o.iris ? `<circle class="sa-iris" cx="${n(cx + lx)}" cy="${n(cy + ly)}" r="${n(pr * 1.55)}"/>` : '';
  return (
    `<g class="sa-eye ${o.cls ?? ''}" style="transform-origin:${n(cx)}px ${n(cy)}px;animation-duration:${n(o.blinkDur)}s;animation-delay:${n(o.blinkDelay)}s">` +
    `<ellipse class="sa-eye__white" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/>` +
    `<g class="sa-look">${iris}<circle class="sa-pupil" cx="${n(cx + lx)}" cy="${n(cy + ly)}" r="${n(pr)}"/>` +
    `<circle class="sa-glint" cx="${n(cx + lx - pr * 0.35)}" cy="${n(cy + ly - pr * 0.4)}" r="${n(Math.max(1, pr * 0.32))}"/></g>` +
    `${lid}</g>`
  );
}

export function blink(r: Rand): Pick<EyeOpts, 'blinkDur' | 'blinkDelay'> {
  return { blinkDur: r.range(4.2, 7.5), blinkDelay: -r.range(0, 6) };
}

export function mouth(d: string): string {
  return `<path class="sa-mouth" d="${d}"/>`;
}
