// Speech and guidance (DESIGN 7.0, 7.4, 16.2, 17.3): Shade barks and farewells, coach marks, and the chips
// at a Shade's feet (pending Promises, Wavering). Text always comes from content or the engine.

import type { Light } from '../../engine/emotions';
import { LIGHT_NAME } from './names';
import { markIcon } from './sigils';
import { attrs, esc } from './svg';
import { tipAttrs, tipText } from './widgets';

export type Tail = 'down' | 'up' | 'left' | 'right';

/**
 * A Shade's speech bubble: barks on spawn and first action, farewells for 1.2 s on Resolve or Suppress.
 * Decorative for screen readers (the log announces lines), so it is aria-hidden.
 */
export function barkMarkup(p: { text: string; tail?: Tail; farewell?: boolean }): string {
  return `<div${attrs({ class: `bark${p.farewell ? ' bark--farewell' : ''}`, 'data-tail': p.tail ?? 'down', 'aria-hidden': 'true' })}>${esc(p.text)}</div>`;
}

/**
 * A coach mark (17.3): pearl bubble with an arrow toward its anchor. Never blocks input (pointer-events
 * pass through except on its own close button), one visible at a time, 18 words at most.
 */
export function coachMarkMarkup(p: { text: string; arrow?: Tail; id?: string }): string {
  return (
    `<div${attrs({ class: 'coach-mark', 'data-arrow': p.arrow ?? 'down', 'data-coach': p.id ?? null, role: 'note' })}>` +
    `<span class="coach-mark__text">${esc(p.text)}</span>` +
    `<button class="coach-mark__close" type="button" aria-label="Dismiss tip">${markIcon('close')}</button>` +
    `</div>`
  );
}

/** A pending Promise at a Shade's feet (4.14): "Promise: Ease 8" with the Light it carries. */
export function promiseChipMarkup(p: { text: string; lights?: readonly Light[]; title?: string }): string {
  const [a, b] = p.lights ?? [];
  const lights = (p.lights ?? []).map((l) => LIGHT_NAME[l]).join(' and ');
  const tip = p.title ?? (lights ? `A Promise carrying ${lights}: it lands at the start of your next turn.` : undefined);
  return (
    `<span${attrs({ class: `feet-chip feet-chip--promise${tip ? ' has-tip' : ''}`, 'data-light': a ?? null, 'data-light2': b ?? a ?? null, ...tipAttrs(tip) })}>` +
    `${markIcon('promise')}<span>${esc(p.text)}</span>${tipText(tip)}</span>`
  );
}

/** The Wavering chip (4.8): an automatic hit stopped this Shade at 1. */
export function waveringChipMarkup(p: { title?: string } = {}): string {
  const tip = p.title ?? 'Wavering: it stops at 1. Finish it yourself.';
  return `<span${attrs({ class: 'feet-chip feet-chip--wavering has-tip', ...tipAttrs(tip) })}>${markIcon('ringSingle')}<span>Finish it yourself</span>${tipText(tip)}</span>`;
}
