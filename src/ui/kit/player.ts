// The player's side of the combat screen (DESIGN 16.2 "Player panel"): the Wanderer avatar with the
// Note-coloured lantern flame, the INWARD heart target, the three Companion slots and the Promise tray.
// Pure presentation: previews, Companion actions and Promise lines come from the engine.

import type { Light } from '../../engine/emotions';
import { LIGHT_NAME } from './names';
import { markIcon } from './sigils';
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
export const WANDERER_HEART: readonly [number, number] = [74, 108];

function flameMarkup(note: readonly Light[], compass: boolean, id: string): string {
  const lit = compass && note.length > 0;
  const [a, b] = note;
  const flame = 'M0 -17C5.5 -9.5 8 -4.6 8 0.4A8 8 0 0 1 -8 0.4C-8 -4.6 -3.4 -8.8 0 -17Z';
  const inner = 'M0 -9C2.6 -5 3.8 -2.4 3.8 0.4A3.8 3.8 0 0 1 -3.8 0.4C-3.8 -2.4 -1.6 -5 0 -9Z';
  const fill = !lit ? 'var(--numb)' : b ? `url(#${id}f)` : `var(--${a})`;
  const split = lit && b
    ? `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0.5" stop-color="var(--${a})"/><stop offset="0.5" stop-color="var(--${b})"/></linearGradient>`
    : '';
  const glow = lit ? `var(--${a})` : 'var(--numb)';
  return (
    (split ? `<defs>${split}</defs>` : '') +
    `<g class="wanderer__flame" data-lit="${lit}" style="--flame:${glow}${b && lit ? `;--flame2:var(--${b})` : ''}">` +
    `<circle class="wanderer__glow" r="22"/>` +
    (lit && b ? `<circle class="wanderer__glow wanderer__glow--b" r="16" cx="4"/>` : '') +
    `<path class="wanderer__fire" d="${flame}" style="fill:${fill}"/>` +
    `<path class="wanderer__core" d="${inner}"/>` +
    `</g>`
  );
}

/** The Wanderer: a small hooded traveller holding a lantern whose flame shows the Note (16.2). */
export function wandererMarkup(p: WandererProps): string {
  const id = uniqueId('wd');
  const height = cssLen(p.size ?? 'calc(var(--u) * 160)');
  const lit = p.compass && p.note.length > 0;
  const noteText = lit ? p.note.map((l) => LIGHT_NAME[l]).join(' and ') : '';
  const label = p.label ?? (lit ? `You, your lantern lit by ${noteText}` : 'You, your lantern waiting for a Light');
  const cloak =
    'M74 34C94 34 106 50 108 72C110 92 114 118 122 142C124 150 118 156 110 156H40C31 156 26 150 28 142C35 118 38 92 40 72C42 50 54 34 74 34Z';
  const hoodOpening = 'M74 48C88 48 96 60 96 74C96 88 86 96 74 96C62 96 52 88 52 74C52 60 60 48 74 48Z';
  const x = 124;
  const y = 112;
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
    `<defs><linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wanderer__stop-hi"/><stop offset="1" class="wanderer__stop-lo"/></linearGradient></defs>` +
    `<ellipse class="wanderer__shadow" cx="76" cy="162" rx="48" ry="7"/>` +
    `<g class="wanderer__body">` +
    `<path class="wanderer__boot" d="M50 150h18v10a4 4 0 0 1 -4 4h-14a4 4 0 0 1 -4 -4v-6z"/>` +
    `<path class="wanderer__boot" d="M82 150h18v10a4 4 0 0 1 -4 4h-14a4 4 0 0 1 -4 -4v-6z"/>` +
    `<path class="wanderer__cloak" d="${cloak}" fill="url(#${id}c)"/>` +
    `<path class="wanderer__fold" d="M58 104C60 122 58 138 54 152M92 100C92 120 96 136 100 152"/>` +
    `<path class="wanderer__scarf" d="M50 96C62 104 86 104 98 96L100 106C86 114 62 114 48 106Z"/>` +
    `<path class="wanderer__scarf" d="M88 106L96 132L86 134L82 108Z"/>` +
    `<path class="wanderer__hood" d="${hoodOpening}"/>` +
    `<g class="wanderer__face"><ellipse class="wanderer__eye" cx="66" cy="76" rx="3.4" ry="4.2"/><ellipse class="wanderer__eye" cx="82" cy="76" rx="3.4" ry="4.2"/>` +
    `<path class="wanderer__smile" d="M69 85Q74 89 79 85"/><ellipse class="wanderer__blush" cx="61" cy="84" rx="3.6" ry="2"/><ellipse class="wanderer__blush" cx="87" cy="84" rx="3.6" ry="2"/></g>` +
    `<path class="wanderer__arm" d="M98 104C108 108 114 112 118 104"/>` +
    `<circle class="wanderer__hand" cx="119" cy="102" r="6"/>` +
    `</g>` +
    `<g class="wanderer__lantern" transform="translate(${x} ${y})">` +
    `<path class="wanderer__handle" d="M-5 -20C-5 -32 5 -32 5 -20"/>` +
    `<path class="wanderer__cap" d="M-11 -20H11L8 -15H-8Z"/>` +
    `<rect class="wanderer__glass" x="-10" y="-15" width="20" height="28" rx="5"/>` +
    `<g transform="translate(0 6)">${flameMarkup(p.note, p.compass, id)}</g>` +
    `<path class="wanderer__frame" d="M-10 -15V13M10 -15V13M-11 13H11L9 18H-9Z"/>` +
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

