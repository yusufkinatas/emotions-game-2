// Hope: Promise (next-turn payoffs, growth). Cures Despair, clears Hollow, DISSONANT vs Anxiety (DESIGN 6.6).
// Act 2+ ("the wheel closes").

import { draw, ease, easeAll, energy, guard, ifH, per, promise } from '../../engine/dsl';
import type { CardDef } from '../../engine/types';

/** Harmony is decided at play time, so the rider picks which Promise is made (a Promise carries no Harmony). */
const wishOnAStar = (now: number, promised: number, harmony: number) => [
  ease(now),
  ifH([promise([ease(harmony)])], [promise([ease(promised)])]),
];

export const HOPE_CARDS: CardDef[] = [
  {
    id: 'hope.wish_on_a_star',
    name: 'Wish on a Star',
    lights: ['hope'],
    kind: 'ease',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    effects: wishOnAStar(4, 8, 12),
    upgrade: { effects: wishOnAStar(5, 11, 15) },
    text: 'Ease {0}. Promise: Ease {2} to the same Shade. Harmony: the Promise Eases {1} instead.',
    availableFromAct: 2,
  },
  {
    id: 'hope.silver_lining',
    name: 'Silver Lining',
    lights: ['hope'],
    kind: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'self',
    effects: [guard(5), promise([guard(5), draw(1)])],
    upgrade: { effects: [guard(7), promise([guard(7), draw(1)])] },
    text: 'Gain {0} Guard. Promise: gain {1} Guard and draw {2}.',
    availableFromAct: 2,
  },
  {
    id: 'hope.plant_a_seed',
    name: 'Plant a Seed',
    lights: ['hope'],
    kind: 'skill',
    rarity: 'common',
    cost: 0,
    target: 'none',
    effects: [promise([energy(1), draw(1)])],
    keywords: ['letGo'],
    upgrade: { effects: [promise([energy(1), draw(2)])] },
    text: 'Promise: gain {0} Spirit and draw {1}. Let Go.',
    availableFromAct: 2,
  },
  {
    id: 'hope.growing_light',
    name: 'Growing Light',
    lights: ['hope'],
    kind: 'ease',
    rarity: 'uncommon',
    cost: 1,
    target: 'enemy',
    effects: [ease(per('timesPlayed', 3, 6))],
    upgrade: {
      effects: [ease(per('timesPlayed', 4, 8))],
      text: 'Ease {0}. Each time you play this, it Eases 4 more for the rest of this combat.',
    },
    text: 'Ease {0}. Each time you play this, it Eases 3 more for the rest of this combat.',
    availableFromAct: 2,
  },
  {
    id: 'hope.better_days',
    name: 'Better Days',
    lights: ['hope'],
    kind: 'mood',
    rarity: 'uncommon',
    cost: 1,
    target: 'none',
    effects: [],
    mood: [{ on: 'turnStart', effects: [guard(per('turn', 1, 0, { max: 8 }))] }],
    upgrade: { cost: 0 },
    text: 'At the start of your turn, gain Guard equal to the turn number (max 8).',
    availableFromAct: 2,
  },
  {
    id: 'hope.daybreak',
    name: 'Daybreak',
    lights: ['hope'],
    kind: 'ease',
    rarity: 'rare',
    cost: 3,
    costMod: { per: 'promisesMade', mult: -1 },
    target: 'all',
    effects: [easeAll(18)],
    keywords: ['letGo'],
    upgrade: { effects: [easeAll(24)] },
    text: 'Ease {0} to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.',
    availableFromAct: 2,
  },
];
