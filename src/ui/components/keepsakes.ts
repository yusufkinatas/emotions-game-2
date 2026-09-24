// Keepsake icons with reachable tooltips (hover, focus, tap) and larger Keepsake tiles for rewards,
// the Sanctuary shelf and charm select. Names and text come from content.

import type { Engine, KeepsakeDef, KeepsakeId, KeepsakeInstance } from '../../engine/index';
import { keepsakeIcon } from '../kit/sigils';
import { h } from '../dom';

export const keepsakeTip = (def: KeepsakeDef): string => `${def.name}: ${def.text}`;

/** A small focusable Keepsake icon; the tooltip is the name and rules text. */
export function keepsakeChip(engine: Engine, k: KeepsakeInstance | KeepsakeId): HTMLElement {
  const id = typeof k === 'string' ? k : k.id;
  const def = engine.pack.keepsakes[id];
  const tip = def ? keepsakeTip(def) : id;
  return h('span', {
    class: 'keepsake-chip has-tip',
    attrs: { tabindex: 0, 'data-tip': tip, role: 'img', 'aria-label': tip },
    dataset: { keepsake: id, rarity: def?.rarity ?? 'common' },
    html: keepsakeIcon(def?.icon),
  });
}

/** A row of the run's Keepsakes in acquisition order. */
export function keepsakeRow(engine: Engine, list: readonly KeepsakeInstance[], emptyText = 'None yet'): HTMLElement {
  const row = h('div', { class: 'keepsake-row', attrs: { role: 'list', 'aria-label': 'Keepsakes' } });
  if (list.length === 0) row.append(h('span', { class: 'muted keepsake-row__empty' }, emptyText));
  for (const k of list) {
    const chip = keepsakeChip(engine, k);
    chip.setAttribute('role', 'listitem');
    row.append(chip);
  }
  return row;
}

const RARITY_WORD: Record<KeepsakeDef['rarity'], string> = {
  fixed: 'Keepsake',
  charm: 'Charm',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  boss: 'Boss Keepsake',
};

/** The big face of a Keepsake: icon, name, rarity word and rules text. Put it inside a button or a tile. */
export function keepsakeFace(engine: Engine, id: KeepsakeId): HTMLElement {
  const def = engine.pack.keepsakes[id];
  return h(
    'div',
    { class: 'keepsake-face', dataset: { rarity: def?.rarity ?? 'common' } },
    h('span', { class: 'keepsake-face__icon', html: keepsakeIcon(def?.icon), attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'keepsake-face__name' }, def?.name ?? id),
    h('span', { class: 'keepsake-face__rarity caps' }, def ? RARITY_WORD[def.rarity] : ''),
    h('span', { class: 'keepsake-face__text' }, def?.text ?? ''),
    def?.flavor ? h('span', { class: 'keepsake-face__flavor' }, def.flavor) : null,
  );
}
