// Every card in the pack, grouped as in DESIGN 6.

import type { CardDef, Light } from '../../engine/types';
import { BLEND_CARDS } from './blends';
import { BURIED_CARDS } from './buried';
import { CALM_CARDS } from './calm';
import { COURAGE_CARDS } from './courage';
import { FRIENDSHIP_CARDS } from './friendship';
import { HOPE_CARDS } from './hope';
import { INSIGHT_CARDS } from './insight';
import { JOY_CARDS } from './joy';
import { LOVE_CARDS } from './love';
import { NEUTRAL_CARDS } from './neutral';
import { STARTER_CARDS } from './starter';

export { STARTER_DECK } from './starter';
export { BURIED_CARDS, INSIGHT_OF_BURIED, buriedId } from './buried';

/** The 36 Light cards (6 per Light: 3 common, 2 uncommon, 1 rare), keyed by Light. */
export const LIGHT_CARDS: Record<Light, CardDef[]> = {
  love: LOVE_CARDS,
  joy: JOY_CARDS,
  friendship: FRIENDSHIP_CARDS,
  courage: COURAGE_CARDS,
  hope: HOPE_CARDS,
  calm: CALM_CARDS,
};

export { BLEND_CARDS, INSIGHT_CARDS, NEUTRAL_CARDS, STARTER_CARDS };

export const ALL_CARDS: CardDef[] = [
  ...STARTER_CARDS,
  ...Object.values(LIGHT_CARDS).flat(),
  ...BLEND_CARDS,
  ...NEUTRAL_CARDS,
  ...BURIED_CARDS,
  ...INSIGHT_CARDS,
];
