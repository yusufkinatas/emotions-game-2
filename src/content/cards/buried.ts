// Buried cards (DESIGN 4.10, 6.10): one per Shade type, Weight 1 to 3, unplayable.
// The affliction they give while held and the Tend rules are engine rules keyed by `buried.shade`.

import { AFFLICTION_OF, SHADES, cureOf } from '../../engine/emotions';
import type { CardDef, CardId, Shade } from '../../engine/types';

const SHADE_NAME: Record<Shade, string> = {
  anger: 'Anger',
  sadness: 'Sadness',
  loneliness: 'Loneliness',
  fear: 'Fear',
  despair: 'Despair',
  anxiety: 'Anxiety',
};

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The Insight each Buried card becomes (DESIGN 4.10 table). */
export const INSIGHT_OF_BURIED: Record<Shade, CardId> = {
  anger: 'insight.passion',
  sadness: 'insight.bittersweet',
  loneliness: 'insight.solitude',
  fear: 'insight.instinct',
  despair: 'insight.resilience',
  anxiety: 'insight.foresight',
};

export const buriedId = (s: Shade): CardId => `buried.${s}`;

function buriedCard(s: Shade): CardDef {
  const affliction = capitalize(AFFLICTION_OF[s]);
  const light = capitalize(cureOf(s));
  return {
    id: buriedId(s),
    name: `Buried ${SHADE_NAME[s]}`,
    lights: [],
    kind: 'buried',
    rarity: 'special',
    cost: 'unplayable',
    target: 'none',
    effects: [],
    text: `Weight {w}. Unplayable. End of turn in hand: gain {w} ${affliction}. Play a ${light} card Inward to Tend.`,
    flavor: 'Not gone. Just quiet.',
    buried: { shade: s, insight: INSIGHT_OF_BURIED[s] },
    availableFromAct: 1,
  };
}

export const BURIED_CARDS: CardDef[] = SHADES.map(buriedCard);
