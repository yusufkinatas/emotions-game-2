// Keepsake acquisition (DESIGN 9): no duplicates, rarity weights, exhausted-rarity fallback, Charm cards.

import type { Rng } from '../rng';
import type { EngineCtx, GameState, KeepsakeDef, KeepsakeId, RunState } from '../types';
import { catalog } from './catalog';
import { addCard } from './deck';
import { ownsKeepsake } from './state';

export type PoolRarity = 'common' | 'uncommon' | 'rare';
const POOL_ORDER: readonly PoolRarity[] = ['common', 'uncommon', 'rare'];
const POOL_WEIGHTS: Record<PoolRarity, number> = { common: 50, uncommon: 35, rare: 15 };

/** Glimmers given instead when every pool Keepsake is owned. */
export const EXHAUSTED_GLIMMERS = 50;

/** Adds a Keepsake unless owned. Keepsakes with addsCard (Charms) also add their card. */
export function grantKeepsake(d: GameState, ctx: EngineCtx, id: KeepsakeId): boolean {
  const def = ctx.pack.keepsakes[id];
  if (!def || ownsKeepsake(d.run, id)) return false;
  d.run.keepsakes.push({ id, counter: 0 });
  if (def.addsCard) addCard(d, ctx, def.addsCard, false);
  return true;
}

function unowned(run: RunState, ctx: EngineCtx, rarity: KeepsakeDef['rarity'], exclude: readonly KeepsakeId[]): KeepsakeDef[] {
  return catalog(ctx.pack).keepsakes.filter(
    (k) => k.rarity === rarity && !ownsKeepsake(run, k.id) && !exclude.includes(k.id),
  );
}

/**
 * One pool Keepsake. 'weighted' rolls the rarity (C 50 / U 35 / R 15). An exhausted rarity moves to the
 * next higher one, then wraps to the lower ones; null when the whole pool is owned.
 */
export function drawPoolKeepsake(
  run: RunState,
  ctx: EngineCtx,
  rng: Rng,
  rarity: PoolRarity | 'weighted',
  exclude: readonly KeepsakeId[] = [],
): KeepsakeId | null {
  const start =
    rarity === 'weighted'
      ? rng.weighted(POOL_ORDER.map((r) => ({ item: r, weight: POOL_WEIGHTS[r] })))
      : rarity;
  const i0 = POOL_ORDER.indexOf(start);
  const order = [...POOL_ORDER.slice(i0), ...POOL_ORDER.slice(0, i0).reverse()];
  for (const r of order) {
    const pool = unowned(run, ctx, r, exclude);
    if (pool.length > 0) return rng.pick(pool).id;
  }
  return null;
}

/** Up to n distinct unowned boss Keepsakes. */
export function drawBossKeepsakes(run: RunState, ctx: EngineCtx, rng: Rng, n: number): KeepsakeId[] {
  return rng
    .shuffle(unowned(run, ctx, 'boss', []))
    .slice(0, n)
    .map((k) => k.id);
}

export const keepsakeRarity = (ctx: EngineCtx, id: KeepsakeId): KeepsakeDef['rarity'] | null =>
  ctx.pack.keepsakes[id]?.rarity ?? null;
