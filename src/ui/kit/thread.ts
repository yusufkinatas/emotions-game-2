// The thread of light (DESIGN 16.2, 17.1): when an eligible Light card is selected, a glowing thread joins
// it to the Buried card it can Tend, and the INWARD target lights up. The screen measures both cards and
// passes their points in the coordinates of a positioned container; the kit draws the curve.

import type { Light } from '../../engine/emotions';
import { attrs, n, toElement } from './svg';

export interface ThreadProps {
  /** Start and end points (px) inside the container: the Light card and the Buried card. */
  from: readonly [number, number];
  to: readonly [number, number];
  /** The Light that Tends: the thread's colour. */
  light: Light;
  /** How far the curve bows upward (px). Default 60. */
  lift?: number;
}

const PAD = 24;

/** An absolutely positioned SVG thread between two points, with a slow light flow along it. */
export function threadMarkup(p: ThreadProps): string {
  const lift = p.lift ?? 60;
  const [x0, y0] = p.from;
  const [x1, y1] = p.to;
  const left = Math.min(x0, x1) - PAD;
  const top = Math.min(y0, y1) - lift - PAD;
  const w = Math.abs(x1 - x0) + PAD * 2;
  const h = Math.abs(y1 - y0) + lift + PAD * 2;
  const ax = x0 - left;
  const ay = y0 - top;
  const bx = x1 - left;
  const by = y1 - top;
  const cy = Math.min(ay, by) - lift;
  const d = `M${n(ax)} ${n(ay)}C${n(ax)} ${n(cy)} ${n(bx)} ${n(cy)} ${n(bx)} ${n(by)}`;
  return (
    `<svg${attrs({ class: 'light-thread', 'data-light': p.light, viewBox: `0 0 ${n(w)} ${n(h)}`, style: `left:${n(left)}px;top:${n(top)}px;width:${n(w)}px;height:${n(h)}px`, 'aria-hidden': 'true', focusable: 'false' })}>` +
    `<path class="light-thread__glow" d="${d}"/><path class="light-thread__line" d="${d}"/><path class="light-thread__flow" d="${d}" pathLength="100"/>` +
    `<circle class="light-thread__end" cx="${n(ax)}" cy="${n(ay)}" r="4"/><circle class="light-thread__end" cx="${n(bx)}" cy="${n(by)}" r="4"/>` +
    `</svg>`
  );
}

export function renderThread(p: ThreadProps): SVGSVGElement {
  return toElement<SVGSVGElement>(threadMarkup(p));
}
