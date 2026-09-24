// Screen effects for the combat animation (DESIGN 18.1). Everything lives in the screen's fx layer,
// animates only transform and opacity, and falls back to fades under reduced motion.

import type { Light, Shade } from '../../engine/types';
import { h } from '../dom';
import { cardFaceMarkup } from '../kit/cardFace';
import { prefersReducedMotion } from '../kit/motion';
import { SHADE_NAME } from '../kit/names';
import { resolvedFormMarkup } from '../kit/shadeArt';
import { toElement } from '../kit/svg';
import { spawnFloatingNumber, type FloatingNumberProps } from '../kit/widgets';

export interface Point {
  x: number;
  y: number;
}

export interface FxHost {
  root: HTMLElement;
  fx: HTMLElement;
  centerOf(el: Element | null | undefined): Point;
}

const reduced = (): boolean => prefersReducedMotion();

/** Position an element in the fx layer over its current on-screen box. */
export function lift(host: FxHost, el: HTMLElement | SVGElement): { el: HTMLElement | SVGElement; box: DOMRect } {
  const root = host.root.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const box = new DOMRect(r.left - root.left, r.top - root.top, r.width, r.height);
  const s = (el as HTMLElement).style;
  s.position = 'absolute';
  s.left = `${box.x}px`;
  s.top = `${box.y}px`;
  s.width = `${box.width}px`;
  s.height = `${box.height}px`;
  s.margin = '0';
  s.transform = 'none';
  s.setProperty('--x', '0');
  s.setProperty('--y', '0');
  s.setProperty('--rot', '0');
  host.fx.append(el);
  return { el, box };
}

/** Fly an fx element's centre to a point, shrinking; removes it at the end. */
export function flyTo(el: HTMLElement | SVGElement, box: DOMRect, to: Point, ms: number, opts: { scale?: number; fade?: number } = {}): Promise<void> {
  const done = () => el.remove();
  if (ms <= 0) {
    done();
    return Promise.resolve();
  }
  if (reduced()) {
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    return a.finished.then(done, done);
  }
  const dx = to.x - (box.x + box.width / 2);
  const dy = to.y - (box.y + box.height / 2);
  const a = el.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${opts.scale ?? 0.3})`, opacity: opts.fade ?? 0.25 },
    ],
    { duration: ms, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)', fill: 'forwards' },
  );
  return a.finished.then(done, done);
}

export function floatNumber(host: FxHost, p: FloatingNumberProps, at: Point): void {
  spawnFloatingNumber(host.fx, p, at.x, at.y);
}

/** A ring of a Light's colour pulsing outward (Inward plays). */
export function ring(host: FxHost, at: Point, light: Light | null, size: number): void {
  const el = h('div', { class: 'inward-ring', dataset: light ? { light } : {} });
  Object.assign(el.style, { left: `${at.x - size / 2}px`, top: `${at.y - size / 2}px`, width: `${size}px`, height: `${size}px` });
  host.fx.append(el);
  setTimeout(() => el.remove(), 700);
}

/** Soft radial bloom (Resolve), peak opacity 0.3 from the kit keyframes. */
export function bloom(host: FxHost, at: Point, light: Light | null, size: number): void {
  if (reduced()) return;
  const el = h('div', { class: 'bloom', dataset: light ? { light } : {} });
  Object.assign(el.style, { left: `${at.x - size / 2}px`, top: `${at.y - size / 2}px`, width: `${size}px`, height: `${size}px` });
  host.fx.append(el);
  setTimeout(() => el.remove(), 1100);
}

/** A centred screen banner ("The Shades stir"). */
export function banner(host: FxHost, text: string, ms: number, kind = 'stir'): void {
  if (ms <= 0) return;
  const el = h('div', { class: `cb-banner cb-banner--${kind} serif` }, text);
  el.style.setProperty('--banner-ms', `${ms}ms`);
  host.fx.append(el);
  setTimeout(() => el.remove(), ms + 60);
}

/** A light form rising from a Resolved Shade and flying to the Glimmer counter. */
export function moteTo(host: FxHost, from: Point, to: Point, light: Light, ms: number): Promise<void> {
  const size = 44;
  const el = toElement<SVGSVGElement>(resolvedFormMarkup(light, { size: `${size}px`, className: 'cb-mote' }));
  const box = new DOMRect(from.x - size / 2, from.y - size / 2, size, size);
  Object.assign(el.style, { position: 'absolute', left: `${box.x}px`, top: `${box.y}px` });
  host.fx.append(el);
  if (ms <= 0 || reduced()) {
    const a = el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: Math.max(ms, 400) });
    return a.finished.then(() => el.remove(), () => el.remove());
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const a = el.animate(
    [
      { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
      { transform: 'translate(0, -40px) scale(1.15)', opacity: 1, offset: 0.3 },
      { transform: 'translate(0, -46px) scale(1)', opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 0.4 },
    ],
    { duration: ms, easing: 'ease-in-out', fill: 'forwards' },
  );
  return a.finished.then(() => el.remove(), () => el.remove());
}

/** A mini Buried card flying from a Suppressed Shade to the deck counter, labelled "+1 Buried" or "W2". */
export function buriedToDeck(host: FxHost, from: Point, to: Point, shade: Shade, weight: number, label: string, ms: number): void {
  const card = toElement<HTMLElement>(
    cardFaceMarkup({
      name: `Buried ${SHADE_NAME[shade]}`,
      lights: [],
      cost: null,
      kindLabel: 'Buried',
      text: '',
      rarity: 'special',
      buried: { weight: Math.max(1, Math.min(3, weight)), shade },
      className: 'card-face--mini',
    }),
  );
  const tag = h('span', { class: 'cb-buried-tag' }, label);
  const wrap = h('div', { class: 'cb-buried-fly' }, card, tag);
  host.fx.append(wrap);
  const r = wrap.getBoundingClientRect();
  const box = new DOMRect(from.x - r.width / 2, from.y - r.height / 2, r.width, r.height);
  Object.assign(wrap.style, { left: `${box.x}px`, top: `${box.y}px` });
  const t = Math.max(ms, 0);
  if (t <= 0) {
    wrap.remove();
    return;
  }
  if (reduced()) {
    wrap.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: t }).finished.then(() => wrap.remove(), () => wrap.remove());
    return;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  wrap
    .animate(
      [
        { transform: 'translate(0, 20px) scale(0.6)', opacity: 0 },
        { transform: 'translate(0, -20px) scale(1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(0, -24px) scale(1)', opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.3 },
      ],
      { duration: t, easing: 'ease-in-out', fill: 'forwards' },
    )
    .finished.then(() => wrap.remove(), () => wrap.remove());
}

/** A dotted line from a Companion to its target for a moment. */
export function dottedLine(host: FxHost, a: Point, b: Point, ms: number): void {
  if (ms <= 0) return;
  const svg = toElement<SVGSVGElement>(
    `<svg class="cb-dotline" width="100%" height="100%" aria-hidden="true"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/></svg>`,
  );
  host.fx.append(svg);
  setTimeout(() => svg.remove(), ms);
}

/** Restart a one-shot CSS class on an element. */
export function restartClass(el: Element | null | undefined, cls: string, ms: number): void {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).getBoundingClientRect();
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/** A short speech line floating over a point (farewells after the slot is gone, Insight moments). */
export function floatLine(host: FxHost, text: string, at: Point, ms: number, cls = ''): void {
  const el = h('div', { class: `bark bark--farewell cb-float-line ${cls}` }, text);
  Object.assign(el.style, { left: `${at.x}px`, top: `${at.y}px` });
  host.fx.append(el);
  setTimeout(() => el.remove(), ms);
}
