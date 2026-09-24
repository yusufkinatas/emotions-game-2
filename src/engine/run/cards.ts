// Card classification, filters and reward pools (DESIGN 6.0, 12.2).

import { LIGHTS } from '../emotions';
import type { Rng } from '../rng';
import type { CardDef, CardFilter, CardId, CardInstance, EngineCtx, Light, Rarity } from '../types';
import { catalog } from './catalog';

export type OfferRarity = 'common' | 'uncommon' | 'rare';

export const isInsight = (d: CardDef): boolean => d.insightOf !== undefined || d.id.startsWith('insight.');
export const isBuried = (d: CardDef): boolean => d.kind === 'buried';
export const isBlendCard = (d: CardDef): boolean => d.lights.length === 2;
export const isAvailable = (d: CardDef, act: 1 | 2): boolean => d.availableFromAct <= act;

export const isUpgradable = (c: CardInstance, d: CardDef): boolean =>
  !c.upgraded && d.upgrade !== undefined && d.kind !== 'buried';

/** Cards that rewards, shops and events may hand out (never starter, Buried or Insight cards). */
export const isOfferable = (d: CardDef): boolean =>
  d.kind !== 'buried' && d.rarity !== 'starter' && d.rarity !== 'special' && !isInsight(d);

/** Filter match for a deck card. `lights` means "printed Lights include any of these". `blend` is not a selector. */
export function matchesFilter(c: CardInstance, d: CardDef, f: CardFilter | undefined, act: 1 | 2): boolean {
  if (!f) return true;
  if (f.kinds && !f.kinds.includes(d.kind)) return false;
  if (f.lights && !d.lights.some((l) => f.lights!.includes(l))) return false;
  if (f.rarity && !f.rarity.includes(d.rarity)) return false;
  if (f.notBuried && isBuried(d)) return false;
  if (f.buriedOnly && !isBuried(d)) return false;
  if (f.notInsight && isInsight(d)) return false;
  if (f.upgradable && !isUpgradable(c, d)) return false;
  if (f.available && !isAvailable(d, act)) return false;
  return true;
}

/** Mono-Light reward cards available in `act`, optionally of one Light and rarity. */
export function lightCards(ctx: EngineCtx, act: 1 | 2, light?: Light, rarity?: Rarity): CardDef[] {
  return catalog(ctx.pack).cards.filter(
    (d) =>
      isOfferable(d) &&
      d.lights.length === 1 &&
      isAvailable(d, act) &&
      (light === undefined || d.lights[0] === light) &&
      (rarity === undefined || d.rarity === rarity),
  );
}

/** Lights (wheel order) that have at least one available reward card. */
export function availableLights(ctx: EngineCtx, act: 1 | 2): Light[] {
  const cards = lightCards(ctx, act);
  return LIGHTS.filter((l) => cards.some((d) => d.lights[0] === l));
}

export function blendCards(ctx: EngineCtx, act: 1 | 2): CardDef[] {
  return catalog(ctx.pack).cards.filter((d) => isOfferable(d) && isBlendCard(d) && isAvailable(d, act));
}

export function neutralCards(ctx: EngineCtx, act: 1 | 2, rarity?: Rarity): CardDef[] {
  return catalog(ctx.pack).cards.filter(
    (d) =>
      isOfferable(d) &&
      d.lights.length === 0 &&
      isAvailable(d, act) &&
      (rarity === undefined || d.rarity === rarity),
  );
}

/**
 * Pool for a random addCard RunEffect. Without `lights` in the filter it draws Light cards (mono), as the
 * events say ("random upgraded card" = a Light card available in the current act). Rarity defaults to C/U/R.
 */
export function randomCardPool(ctx: EngineCtx, f: CardFilter, act: 1 | 2): CardDef[] {
  const rarities: Rarity[] = f.rarity ?? ['common', 'uncommon', 'rare'];
  return catalog(ctx.pack).cards.filter((d) => {
    if (!isOfferable(d) || !rarities.includes(d.rarity)) return false;
    if (f.lights === undefined && d.lights.length !== 1) return false;
    const probe: CardInstance = { uid: 0, defId: d.id, upgraded: false };
    return matchesFilter(probe, d, { ...f, available: f.available ?? true }, act);
  });
}

export function rollRarity(rng: Rng, weights: Record<OfferRarity, number>): OfferRarity {
  return rng.weighted([
    { item: 'common' as const, weight: weights.common },
    { item: 'uncommon' as const, weight: weights.uncommon },
    { item: 'rare' as const, weight: weights.rare },
  ]);
}

export const pickId = (rng: Rng, defs: readonly CardDef[]): CardId | null =>
  defs.length === 0 ? null : rng.pick(defs).id;
