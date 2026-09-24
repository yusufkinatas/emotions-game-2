// The default content pack (DESIGN 20.1 principle 3: the engine never imports content; it receives this pack).

import type { ContentPack } from '../engine/types';
import { AFTERGLOWS } from './afterglows';
import { ALL_CARDS, STARTER_DECK } from './cards';
import { COMPANIONS } from './companions';
import { ALL_ENEMIES } from './enemies';
import { ENCOUNTERS, POOLS } from './encounters';
import { EVENTS, FALLBACK_EVENT, QUIET_MOMENT } from './events';
import { CHARMS, KEEPSAKES, TUTORIAL_CHARM } from './keepsakes';
import { RULE_OVERRIDES } from './rules';
import { STATUSES } from './statuses';

/** Index a list of definitions by id; a duplicate id is a content bug. */
function byId<T extends { id: string }>(list: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of list) {
    if (out[item.id]) throw new Error(`duplicate content id ${item.id}`);
    out[item.id] = item;
  }
  return out;
}

export const defaultPack: ContentPack = {
  cards: byId(ALL_CARDS),
  enemies: byId(ALL_ENEMIES),
  encounters: byId(ENCOUNTERS),
  statuses: byId(STATUSES),
  companions: byId(COMPANIONS),
  keepsakes: byId(KEEPSAKES),
  events: byId([...EVENTS, QUIET_MOMENT]),
  afterglows: AFTERGLOWS,
  pools: POOLS,
  starter: { deck: STARTER_DECK, charms: CHARMS, tutorialCharm: TUTORIAL_CHARM },
  fallbackEvent: FALLBACK_EVENT,
  rules: RULE_OVERRIDES,
};

export * from './display';
export * from './glossary';
export * from './lines';
