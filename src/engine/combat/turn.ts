// Player turn start (5.2) and end (5.6). The enemy phase (5.7) lives in enemy.ts.

import { DEFAULT_DECAYING, MEM_TURNS_LEFT, ST } from '../constants';
import { AFFLICTION_OF } from '../emotions';
import { runEffects, settle } from '../interpreter';
import {
  addStatus,
  announcePromise,
  clearPlayerGuard,
  discardFromHand,
  drawCards,
  emit,
  losePlayerHp,
  mendPlayer,
  setEnergy,
  takeDuePromises,
} from '../primitives';
import type { StatusId, Uid } from '../types';
import { buriedShade, isBuried } from './buried';
import { hasKeyword } from './cards';
import { companionsAct } from './companions';
import { enemyPhase } from './enemy';
import { checkHeart, loseCombat } from './player';
import { enemyDef, type Rt } from './runtime';
import { giveStatus, setStatusOn } from './statuses';
import { fireKeepsakes, fireMoods, firePassivesAll, resetTurnKeepsakeLimits } from './triggers';

function keepsakeEnergy(rt: Rt): number {
  let n = 0;
  for (const k of rt.run.keepsakes) n += rt.pack.keepsakes[k.id]?.energyPerTurn ?? 0;
  return n;
}

/** 5.2. The turn limit (4.17) ends the combat when turn `turnLimit` has fully ended. */
export function startTurn(rt: Rt): void {
  const c = rt.c;
  if (c.turn >= rt.rules.turnLimit) loseCombat(rt, 'turnLimit');
  c.turn += 1;
  emit(rt, { e: 'turn', side: 'player', n: c.turn });
  resetTurnKeepsakeLimits(rt);
  clearPlayerGuard(rt);
  const ps = c.player.statuses;
  const nextSpirit = ps[ST.nextSpirit] ?? 0;
  const hollow = (ps[ST.hollow] ?? 0) >= 1 ? 1 : 0;
  setEnergy(rt, Math.max(0, rt.rules.energyPerTurn + keepsakeEnergy(rt) + nextSpirit - hollow));
  if (nextSpirit) setStatusOn(rt, 'player', ST.nextSpirit, 0);
  const nextDraw = ps[ST.nextDraw] ?? 0;
  if (nextDraw) setStatusOn(rt, 'player', ST.nextDraw, 0);
  drawCards(rt, rt.rules.handSize + nextDraw);
  fireMoods(rt, 'turnStart');
  fireKeepsakes(rt, 'turnStart');
  if (c.turn === 1) fireKeepsakes(rt, 'turn1Start');
  settle(rt);
  for (const p of takeDuePromises(rt, c.turn)) {
    announcePromise(rt, p);
    runEffects(rt, p.effects, {
      source: 'promise',
      sourceUid: p.sourceUid,
      targetUid: p.targetUid,
      lights: p.lights.slice(),
      harmonized: false,
      fromCard: false,
    });
  }
}

function decays(rt: Rt, id: StatusId): boolean {
  const def = rt.pack.statuses[id];
  if (def) return def.affliction !== undefined || def.decay === 'playerTurnEnd';
  return DEFAULT_DECAYING.includes(id);
}

/** 5.6 steps 1 to `upTo` (6 for the M2 intent projection, 8 for a real end of turn). */
export function endTurnSteps(rt: Rt, upTo: 6 | 8): void {
  const c = rt.c;
  // 1. End-of-turn Moods, then Keepsakes.
  fireMoods(rt, 'turnEnd');
  fireKeepsakes(rt, 'turnEnd');
  settle(rt);
  // 2. Companions act (not while Isolated). A win here ends the combat.
  companionsAct(rt);
  settle(rt);
  // 3. Ticks.
  const seething = c.player.statuses[ST.seething] ?? 0;
  if (seething > 0) {
    losePlayerHp(rt, seething, 'seething');
    checkHeart(rt);
  }
  const warmth = c.player.statuses[ST.warmth] ?? 0;
  if (warmth > 0) mendPlayer(rt, warmth);
  // 4. Decay.
  for (const id of Object.keys(c.player.statuses)) if (decays(rt, id)) addStatus(rt, 'player', id, -1);
  // 5. Buried in hand (after decay, so the stacks last through your next turn).
  if (!rt.flags.has('leadBox')) {
    for (const uid of c.piles.hand.slice()) {
      const card = c.cards[uid]!;
      if (!isBuried(rt.pack.cards[card.defId])) continue;
      const shade = buriedShade(rt, card);
      if (shade) giveStatus(rt, 'player', AFFLICTION_OF[shade], card.weight ?? 1);
    }
  }
  settle(rt);
  // 6. Shade end-of-your-turn passives (position order).
  firePassivesAll(rt, 'playerTurnEnd');
  settle(rt);
  if (upTo === 6) return;
  // 7. Discard the hand except Linger cards (never Buried cards).
  const keep: Uid[] = [];
  const toss: Uid[] = [];
  for (const uid of c.piles.hand) {
    const card = c.cards[uid]!;
    const def = rt.pack.cards[card.defId]!;
    const lingers = !isBuried(def) && (hasKeyword(def, card.upgraded, 'linger') || card.mem.lingerThisTurn);
    (lingers ? keep : toss).push(uid);
  }
  discardFromHand(rt, toss);
  for (const uid of keep) c.cards[uid]!.mem.lingered += 1;
  // 8. Per-turn resets (the Note is not reset).
  c.playedLastTurn = c.turnFlags.played;
  c.turnFlags = { played: 0, harmonies: 0, firstCardDone: false, centerActive: false, prismUsed: false, lightsThisTurn: [] };
  for (const k in c.cards) c.cards[k]!.mem.lingerThisTurn = false;
  for (const e of c.enemies) {
    const max = enemyDef(rt, e).maxTurnsPerPlayerTurn;
    if (max !== undefined) e.memory[MEM_TURNS_LEFT] = max;
  }
}

/** The endTurn action: 5.6, 5.7, then the next 5.2. */
export function endTurn(rt: Rt): void {
  endTurnSteps(rt, 8);
  enemyPhase(rt);
  startTurn(rt);
}
