// The player's side of the combat screen (DESIGN 16.2 "Player panel"): the Wanderer avatar with the
// Note-coloured lantern flame, the INWARD heart target, the three Companion slots and the Promise tray.
// Pure presentation: previews, Companion actions and Promise lines come from the engine.

import type { Light } from '../../engine/emotions';
import { LIGHT_NAME } from './names';
import { markIcon, resourceIcon } from './sigils';
import { attrs, cssLen, esc, toElement, uniqueId } from './svg';
import { tipAttrs, tipText } from './widgets';

// ------------------------------------------------------------------------------------------------
// The Wanderer
// ------------------------------------------------------------------------------------------------

export interface WandererProps {
  /** The Note (0 to 2 Lights). The flame takes its colour; two Lights split the flame. */
  note: readonly Light[];
  /** Without The Compass the Note is not shown, so the flame stays grey. */
  compass: boolean;
  /** Rendered height: number = px, string = CSS length. Default calc(var(--u) * 160). */
  size?: number | string;
  /** Accessible name. Default "You, lantern lit by Love" style text. */
  label?: string;
  className?: string;
}

/** The heart point on the avatar (viewBox units), where Inward plays land. */
export const WANDERER_HEART: readonly [number, number] = [72, 114];

function flameMarkup(note: readonly Light[], compass: boolean, id: string): string {
  const lit = compass && note.length > 0;
  const [a, b] = note;
  const flame = 'M0 -17C5.5 -9.5 8 -4.6 8 0.4A8 8 0 0 1 -8 0.4C-8 -4.6 -3.4 -8.8 0 -17Z';
  const inner = 'M0 -9C2.6 -5 3.8 -2.4 3.8 0.4A3.8 3.8 0 0 1 -3.8 0.4C-3.8 -2.4 -1.6 -5 0 -9Z';
  // Two Lights split the flame down the middle (a hard edge, never a blend: 16.2).
  const fill = !lit ? 'var(--numb)' : b ? `url(#${id}f)` : `var(--${a})`;
  const split = lit && b
    ? `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0.5" stop-color="var(--${a})"/><stop offset="0.5" stop-color="var(--${b})"/></linearGradient>`
    : '';
  return (
    (split ? `<defs>${split}</defs>` : '') +
    `<g class="wanderer__flame" data-lit="${lit}">` +
    `<path class="wanderer__fire" d="${flame}" style="fill:${fill}"/>` +
    `<path class="wanderer__core" d="${inner}"/>` +
    `</g>`
  );
}

/** The flame's light: a halo round the glass and a pool on the ground, in the Note's colour(s). */
function glowMarkup(note: readonly Light[], lit: boolean, id: string): string {
  const [a, b] = note;
  const ca = lit && a ? `var(--${a})` : 'var(--numb)';
  const cb = lit && b ? `var(--${b})` : ca;
  return (
    `<radialGradient id="${id}ga"><stop offset="0" stop-color="${ca}" stop-opacity="0.55"/><stop offset="1" stop-color="${ca}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}gb"><stop offset="0" stop-color="${cb}" stop-opacity="0.55"/><stop offset="1" stop-color="${cb}" stop-opacity="0"/></radialGradient>`
  );
}

/** The Wanderer: a small hooded traveller holding a lantern whose flame shows the Note (16.2). */
export function wandererMarkup(p: WandererProps): string {
  const id = uniqueId('wd');
  const height = cssLen(p.size ?? 'calc(var(--u) * 160)');
  const lit = p.compass && p.note.length > 0;
  const two = lit && p.note.length > 1;
  const noteText = lit ? p.note.map((l) => LIGHT_NAME[l]).join(' and ') : '';
  const label = p.label ?? (lit ? `You, your lantern lit by ${noteText}` : 'You, your lantern waiting for a Light');
  // A rounded travelling cloak whose hood tip flops over to the lantern side.
  const cloak =
    'M70 28C82 24 96 20 110 26C103 28 99 33 100 40C106 52 108 66 108 80C110 100 114 124 120 146C122 154 116 160 108 160H38C30 160 24 154 26 146C32 124 36 100 38 80C40 50 52 30 70 28Z';
  const opening = 'M72 50C86 50 94 60 94 73C94 87 85 95 72 95C59 95 50 87 50 73C50 60 58 50 72 50Z';
  const lx = 121;
  const ly = 104;
  const halo = two
    ? `<circle cx="-4" cy="33" r="30" fill="url(#${id}ga)"/><circle cx="4" cy="33" r="30" fill="url(#${id}gb)"/>`
    : `<circle cx="0" cy="33" r="32" fill="url(#${id}ga)"/>`;
  return (
    `<svg${attrs({
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 160 180',
      class: ['wanderer', p.className ?? ''].filter(Boolean).join(' '),
      'data-lit': lit,
      style: `height:${height};width:calc(${height} * 160 / 180)`,
      role: 'img',
      'aria-label': label,
    })}><title>${esc(label)}</title>` +
    `<defs><linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wanderer__stop-hi"/><stop offset="1" class="wanderer__stop-lo"/></linearGradient>${glowMarkup(p.note, lit, id)}</defs>` +
    `<ellipse class="wanderer__shadow" cx="74" cy="165" rx="50" ry="7"/>` +
    `<ellipse class="wanderer__pool" cx="${lx}" cy="166" rx="34" ry="7" fill="url(#${id}ga)"/>` +
    `<g class="wanderer__body">` +
    `<path class="wanderer__boot" d="M46 152h18v9a4 4 0 0 1 -4 4h-14a4 4 0 0 1 -4 -4v-5z"/>` +
    `<path class="wanderer__boot" d="M80 152h18v9a4 4 0 0 1 -4 4h-14a4 4 0 0 1 -4 -4v-5z"/>` +
    `<path class="wanderer__cloak" d="${cloak}" fill="url(#${id}c)"/>` +
    `<path class="wanderer__fold" d="M54 108C56 124 54 140 50 154M90 104C90 122 94 138 98 154"/>` +
    `<path class="wanderer__hood" d="${opening}"/>` +
    `<g class="wanderer__face">` +
    `<circle class="wanderer__skin" cx="72" cy="76" r="17"/>` +
    `<path class="wanderer__hair" d="M55 72C55 60 63 55 72 55C81 55 89 60 89 72C85 66 80 64 76 66C73 62 67 62 64 66C61 64 58 67 55 72Z"/>` +
    `<ellipse class="wanderer__eye" cx="65.5" cy="77" rx="2.5" ry="3.3"/><ellipse class="wanderer__eye" cx="78.5" cy="77" rx="2.5" ry="3.3"/>` +
    `<path class="wanderer__smile" d="M68.5 84Q72 87 75.5 84"/><ellipse class="wanderer__blush" cx="61" cy="83" rx="3.4" ry="2"/><ellipse class="wanderer__blush" cx="83" cy="83" rx="3.4" ry="2"/>` +
    `</g>` +
    `<path class="wanderer__scarf" d="M50 94C62 102 84 102 96 94L98 104C84 112 62 112 48 104Z"/>` +
    `<path class="wanderer__scarf" d="M60 106L54 132L64 134L68 108Z"/>` +
    `<path class="wanderer__arm" d="M96 104C106 108 112 106 ${lx - 2} ${ly + 1}"/>` +
    `</g>` +
    `<g class="wanderer__lantern" transform="translate(${lx} ${ly})">` +
    `<g class="wanderer__swing">` +
    halo +
    `<path class="wanderer__handle" d="M-7 11C-7 -1 7 -1 7 11"/>` +
    `<path class="wanderer__cap" d="M-12 11H12L9 17H-9Z"/>` +
    `<rect class="wanderer__glass" x="-11" y="17" width="22" height="30" rx="6"/>` +
    `<g transform="translate(0 40) scale(1.12)">${flameMarkup(p.note, p.compass, id)}</g>` +
    `<path class="wanderer__frame" d="M-11 20V44M11 20V44M-12 47H12L10 52H-10Z"/>` +
    `</g>` +
    `<circle class="wanderer__hand" cx="0" cy="1" r="6"/>` +
    `</g>` +
    `</svg>`
  );
}

export function renderWanderer(p: WandererProps): SVGSVGElement {
  return toElement<SVGSVGElement>(wandererMarkup(p));
}

// ------------------------------------------------------------------------------------------------
// INWARD target: a heart outline around the avatar, shown only when Inward is legal (16.2)
// ------------------------------------------------------------------------------------------------

export interface InwardTargetProps {
  /** The engine's Inward preview, e.g. "Clear 2 Seething. Tend Buried Anger (W2 -> W1)." */
  preview: string;
  /** The keyboard target or the hovered target: brighter outline. */
  focused?: boolean;
  /** Rendered height (the heart), default calc(var(--u) * 200). */
  size?: number | string;
  /** Root tag: 'button' when the screen makes it clickable. */
  tag?: 'div' | 'button';
}

/** INWARD heart outline with its label and the engine's preview line. Place it over the avatar. */
export function inwardTargetMarkup(p: InwardTargetProps): string {
  const tag = p.tag ?? 'div';
  const height = cssLen(p.size ?? 'calc(var(--u) * 200)');
  const heart = 'M100 186C100 186 14 132 14 70C14 40 36 18 64 18C80 18 92 27 100 40C108 27 120 18 136 18C164 18 186 40 186 70C186 132 100 186 100 186Z';
  const preview = p.preview.replace(/->/g, '→');
  return (
    `<${tag}${attrs({
      class: 'inward-target',
      'data-focused': p.focused ? 'true' : null,
      type: tag === 'button' ? 'button' : null,
      'aria-label': `Play Inward. ${p.preview}`,
      style: `height:${height};width:${height}`,
    })}>` +
    `<svg class="inward-target__heart" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><path class="inward-target__glow" d="${heart}"/><path class="inward-target__line" d="${heart}"/></svg>` +
    `<span class="inward-target__label" aria-hidden="true">${markIcon('inward')}INWARD</span>` +
    `<span class="inward-target__preview" aria-hidden="true">${esc(preview)}</span>` +
    `</${tag}>`
  );
}

// ------------------------------------------------------------------------------------------------
// Companions: three 56px slots (16.2), greyed while Isolated
// ------------------------------------------------------------------------------------------------

export type CompanionIcon = 'moth' | 'hare' | 'dog';

export interface CompanionSlot {
  icon: CompanionIcon;
  name: string;
  /** The action number: Ease 3 (Lantern Moth), Guard 3 (Burrow Hare), Ease 6 (Old Dog). */
  value: number;
  /** 'ease' shows the strike mark, 'guard' the shield. */
  action: 'ease' | 'guard';
  /** Tooltip sentence, e.g. "Lantern Moth: at the end of your turn, Ease 3 to your last target." */
  title?: string;
}

export function companionSlotsMarkup(p: { slots: readonly (CompanionSlot | null)[]; isolated: boolean }): string {
  const slots = [0, 1, 2].map((i) => {
    const s = p.slots[i] ?? null;
    if (!s) return `<span class="companion-slot companion-slot--empty" aria-hidden="true"></span>`;
    const tip = p.isolated ? `${s.name} won't act while you are Isolated.` : s.title;
    return (
      `<span${attrs({ class: 'companion-slot has-tip', 'data-action': s.action, ...tipAttrs(tip) })}>` +
      `${markIcon(s.icon, { className: 'companion-slot__icon' })}` +
      `<b class="companion-slot__n num">${s.value}</b>` +
      `<span class="sr-only">${esc(s.name)}, ${s.action === 'ease' ? 'Ease' : 'Guard'} ${s.value}</span>${tipText(tip)}</span>`
    );
  });
  return (
    `<div class="companions" data-isolated="${p.isolated}" role="group" aria-label="Companions">${slots.join('')}` +
    (p.isolated ? `<span class="companions__iso">Isolated: won't act</span>` : '') +
    `</div>`
  );
}

// ------------------------------------------------------------------------------------------------
// Promise tray: pending Promises that target you (16.2)
// ------------------------------------------------------------------------------------------------

/** "Next turn: +5 Guard, draw 1." One engine line per Promise, in creation order. */
export function promiseTrayMarkup(lines: readonly string[]): string {
  if (!lines.length) return '';
  return (
    `<div class="promise-tray" role="group" aria-label="Promises for next turn">` +
    `${markIcon('promise', { className: 'promise-tray__icon' })}<span class="promise-tray__head">Next turn</span>` +
    lines.map((l) => `<span class="promise-tray__line">${esc(l)}</span>`).join('') +
    `</div>`
  );
}

/** The heart point in CSS px of a rendered avatar, for aiming the Inward fly and the light thread. */
export function wandererHeartPoint(svg: SVGSVGElement): { x: number; y: number } {
  const r = svg.getBoundingClientRect();
  const [hx, hy] = WANDERER_HEART;
  return { x: r.left + (hx / 160) * r.width, y: r.top + (hy / 180) * r.height };
}

// ------------------------------------------------------------------------------------------------
// Incoming line under the Heart bar (16.2): the engine's end-of-turn preview in one sentence
// ------------------------------------------------------------------------------------------------

/**
 * "Incoming: strikes 8, Guard 5, Seething 2. You lose 5." When the loss would take the last Heart it reads
 * "Lethal: you will fall" with a broken heart, and pulses with the Heart bar's lethal outline.
 */
export function incomingLineMarkup(p: { text: string; lethal?: boolean }): string {
  const lethal = p.lethal
    ? `<span class="incoming__lethal">${markIcon('brokenHeart')}Lethal: you will fall</span>`
    : '';
  return `<p${attrs({ class: 'incoming', 'data-lethal': p.lethal ? 'true' : null })}>${resourceIcon('heart', { className: 'incoming__icon' })}<span>${esc(p.text)}</span>${lethal}</p>`;
}
