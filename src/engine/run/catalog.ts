// Sorted, cached views of a content pack so every random pick is independent of object key order.

import type { CardDef, ContentPack, EventId, KeepsakeDef, Shade } from '../types';

export interface Catalog {
  /** All cards sorted by id. */
  cards: CardDef[];
  /** All keepsakes sorted by id. */
  keepsakes: KeepsakeDef[];
  /** All event ids sorted. */
  events: EventId[];
  /** Buried card def per Shade. */
  buriedByShade: Partial<Record<Shade, CardDef>>;
}

const cache = new WeakMap<ContentPack, Catalog>();

const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function catalog(pack: ContentPack): Catalog {
  const hit = cache.get(pack);
  if (hit) return hit;
  const cards = Object.values(pack.cards).sort(byId);
  const buriedByShade: Partial<Record<Shade, CardDef>> = {};
  for (const c of cards) if (c.kind === 'buried' && c.buried) buriedByShade[c.buried.shade] = c;
  const built: Catalog = {
    cards,
    keepsakes: Object.values(pack.keepsakes).sort(byId),
    events: Object.keys(pack.events).sort(),
    buriedByShade,
  };
  cache.set(pack, built);
  return built;
}
