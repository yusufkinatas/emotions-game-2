// Debug hooks (DESIGN 20.6, ?debug=1&encounter=): jump into any encounter, set the hand.

import { startCombat } from '../combat/index';
import { hash32, rngFrom } from '../rng';
import type { CardId, CombatCard, CombatState, EncounterId, EngineCtx, GameState, Uid } from '../types';
import { cloneJson } from './clone';
import { rollEncounterHps } from './map';
import { cardDef } from './state';

const TIER_RANK: Record<string, number> = { normal: 0, minion: 0, surfaced: 0, elite: 1, boss: 2, final: 3 };

/** Tier of an encounter from its strongest member. */
export function encounterTier(ctx: EngineCtx, id: EncounterId): CombatState['tier'] {
  const enc = ctx.pack.encounters[id];
  if (!enc) throw new Error(`Unknown encounter ${id}`);
  let best = 0;
  for (const m of enc.members) best = Math.max(best, TIER_RANK[ctx.pack.enemies[m.enemy]?.tier ?? 'normal'] ?? 0);
  return (['normal', 'elite', 'boss', 'final'] as const)[best]!;
}

export function debugStartCombat(s: GameState, ctx: EngineCtx, encounter: EncounterId): GameState {
  const d = cloneJson(s);
  d.combat = null;
  const nodeSeed = hash32(s.seed, 'debug', encounter, s.run.floor);
  const hps = rollEncounterHps(ctx, encounter, rngFrom(nodeSeed, 'enc'));
  return startCombat(d, ctx, { encounter, hps, nodeId: null, nodeSeed, tier: encounterTier(ctx, encounter) }).state;
}

/** Puts cards of these ids in hand: taken from the draw pile, then discard, else created. Old hand goes on top of draw. */
export function debugSetHand(s: GameState, ctx: EngineCtx, ids: CardId[]): GameState {
  if (!s.combat) throw new Error('debug.setHand needs a combat in progress');
  const combat = cloneJson(s.combat);
  const draw: Uid[] = [...combat.piles.hand, ...combat.piles.draw];
  const discard: Uid[] = [...combat.piles.discard];
  const hand: Uid[] = [];
  let nextUid = s.nextUid;
  const take = (pile: Uid[], id: CardId): Uid | null => {
    const i = pile.findIndex((u) => combat.cards[u]?.defId === id);
    return i >= 0 ? pile.splice(i, 1)[0]! : null;
  };
  for (const id of ids) {
    const found = take(draw, id) ?? take(discard, id);
    if (found !== null) {
      hand.push(found);
      continue;
    }
    const def = cardDef(ctx, id);
    const uid = nextUid++;
    const card: CombatCard = {
      uid,
      defId: id,
      upgraded: false,
      mem: { lingered: 0, timesPlayed: 0, tended: false, lingerThisTurn: false },
    };
    if (def.kind === 'buried') {
      card.weight = 1;
      card.peakWeight = 1;
    }
    combat.cards[uid] = card;
    hand.push(uid);
  }
  combat.piles = { ...combat.piles, hand, draw, discard };
  return { ...s, nextUid, combat };
}
