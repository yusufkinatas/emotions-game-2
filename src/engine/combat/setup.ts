// Combat start (5.1): deck copy and shuffle, Innate / Worn Diary, kind tutorial hands (17.1), spawning with
// pattern offsets, Surfacing and the Numbness's hidden-Weight growth (4.16, B2), combat-start triggers,
// intents, then the first player turn.

import { LEAD_BOX_SURFACED_PCT, ST, SURFACED_PREFIX } from '../constants';
import { cureOf, shadeIndex } from '../emotions';
import { settle } from '../interpreter';
import { growEnemy, insertEnemy, surfaceShade } from '../primitives';
import { hash32, Rng } from '../rng';
import type { CombatCard, CombatState, CombatStats, EngineCtx, GameState, Shade, StepResult, Uid } from '../types';
import { isBuried } from './buried';
import type { CombatStartSpec } from './index';
import { cardEffects, hasKeyword } from './cards';
import { makeEnemy, rollIntent } from './enemy';
import { CombatOver, createRtFor, enemyDef, keepsakeFlags, type Rt } from './runtime';
import { giveStatus } from './statuses';
import { startTurn } from './turn';
import { fireKeepsakes, firePassivesAll } from './triggers';

export function emptyStats(): CombatStats {
  return {
    resolved: 0,
    deepResolved: 0,
    suppressed: 0,
    harmonies: 0,
    tends: 0,
    insights: 0,
    cardsPlayed: 0,
    playsByLight: {},
    playsByCard: {},
    dmgByRelation: {},
    heartLost: 0,
  };
}

function isTutorialFight(ectx: EngineCtx, spec: CombatStartSpec): boolean {
  return spec.tier === 'tutorial' || (ectx.pack.pools.tutorial ?? []).includes(spec.encounter);
}

/** 17.1: if none of the top 5 cards is OPPOSITE to a Shade in the fight, swap the first such card to slot 5. */
function kindOpeningHand(order: Uid[], cards: Record<Uid, CombatCard>, ectx: EngineCtx, faces: Shade[], handSize: number): Uid[] {
  const answers = (uid: Uid): boolean => {
    const def = ectx.pack.cards[cards[uid]!.defId];
    if (!def || !cardEffects(def, cards[uid]!.upgraded).some((x) => x.op === 'hit')) return false;
    return faces.some((f) => def.lights.includes(cureOf(f)));
  };
  const top = Math.min(handSize, order.length);
  if (top === 0 || order.slice(0, top).some(answers)) return order;
  const j = order.findIndex((uid, i) => i >= top && answers(uid));
  if (j < 0) return order;
  const out = order.slice();
  [out[top - 1], out[j]] = [out[j]!, out[top - 1]!];
  return out;
}

function patternOffset(rt: Rt, defId: string, ai: Rng, tutorial: boolean): number {
  const def = enemyDef(rt, defId);
  if (def.tier !== 'normal' || tutorial) return 0;
  const p = def.pattern.kind === 'phases' ? def.pattern.phases[0]?.pattern : def.pattern;
  if (!p || p.kind !== 'cycle' || p.moves.length === 0) return 0;
  return ai.int(0, p.moves.length - 1);
}

function buriedByHeaviest(rt: Rt): CombatCard[] {
  const list: CombatCard[] = [];
  for (const uid of rt.c.piles.draw) {
    const card = rt.c.cards[uid]!;
    if (isBuried(rt.pack.cards[card.defId])) list.push(card);
  }
  const shadeOf = (c: CombatCard) => rt.pack.cards[c.defId]?.buried?.shade;
  return list.sort((a, b) => {
    const dw = (b.weight ?? 1) - (a.weight ?? 1);
    if (dw !== 0) return dw;
    const sa = shadeOf(a);
    const sb = shadeOf(b);
    return (sa ? shadeIndex(sa) : 6) - (sb ? shadeIndex(sb) : 6);
  });
}

/** 4.16: Surfacing for each numb-rules boss, then its hidden-Weight growth. */
function surfacing(rt: Rt): void {
  for (const boss of rt.c.enemies.slice()) {
    const rules = enemyDef(rt, boss).numbRules;
    if (!rules) continue;
    const rising = buriedByHeaviest(rt).slice(0, rules.surface);
    for (const card of rising) {
      const shade = rt.pack.cards[card.defId]!.buried?.shade;
      if (!shade) continue;
      let hp = rt.rules.surfacedHpPerWeight * (card.weight ?? 1);
      if (rt.flags.has('leadBox')) hp = Math.floor((hp * LEAD_BOX_SURFACED_PCT) / 100);
      const e = makeEnemy(rt, `${SURFACED_PREFIX}${shade}`, hp, { summonerUid: null, surfacedFrom: card.uid, offset: 0 });
      surfaceShade(rt, e, rt.c.enemies.indexOf(boss), card.uid);
    }
    if (rising.length > 0) giveStatus(rt, boss, ST.veiled, 1);
    if (rules.hpPerHiddenWeight > 0) {
      let hidden = 0;
      for (const k in rt.c.cards) {
        const card = rt.c.cards[k]!;
        if (!isBuried(rt.pack.cards[card.defId]) || rt.c.piles.removed.includes(card.uid)) continue;
        hidden += card.weight ?? 1;
      }
      growEnemy(rt, boss, rules.hpPerHiddenWeight * hidden);
    }
  }
}

export function startCombatState(s: GameState, ectx: EngineCtx, spec: CombatStartSpec): StepResult {
  const { pack, rules } = ectx;
  const enc = pack.encounters[spec.encounter];
  if (!enc) throw new Error(`Unknown encounter ${spec.encounter}`);
  const run = s.run;
  const tutorial = isTutorialFight(ectx, spec);
  const flags = keepsakeFlags(run, pack);

  // 1. Deck copy, shuffle, Innate and Worn Diary on top.
  const cards: Record<Uid, CombatCard> = {};
  for (const inst of run.deck) {
    cards[inst.uid] = { ...inst, mem: { lingered: 0, timesPlayed: 0, tended: false, lingerThisTurn: false } };
  }
  const shuffleRng = new Rng(hash32(spec.nodeSeed, 'shuffle'));
  let order = shuffleRng.shuffle(run.deck.map((c) => c.uid));
  const top: Uid[] = order.filter((uid) => {
    const def = pack.cards[cards[uid]!.defId];
    return !!def && hasKeyword(def, cards[uid]!.upgraded, 'innate');
  });
  if (flags.has('wornDiary')) {
    const wheel = (uid: Uid): number => {
      const sh = pack.cards[cards[uid]!.defId]?.buried?.shade;
      return sh ? shadeIndex(sh) : 6;
    };
    const buried = order
      .filter((uid) => isBuried(pack.cards[cards[uid]!.defId]))
      .sort((a, b) => (cards[b]!.weight ?? 1) - (cards[a]!.weight ?? 1) || wheel(a) - wheel(b));
    if (buried[0] !== undefined && !top.includes(buried[0])) top.push(buried[0]);
  }
  order = [...top, ...order.filter((u) => !top.includes(u))];
  if (tutorial) {
    const faces = enc.members.map((m) => pack.enemies[m.enemy]?.faces[0]).filter((f): f is Shade => !!f);
    order = kindOpeningHand(order, cards, ectx, faces, rules.handSize);
  }

  const c: CombatState = {
    nodeId: spec.nodeId,
    encounter: spec.encounter,
    tier: spec.tier,
    turn: 0,
    energy: 0,
    player: { hp: run.heart, maxHp: run.maxHeart, guard: 0, statuses: {} },
    cards,
    piles: { draw: order, hand: [], discard: [], letGo: [], moods: [], removed: [], play: [] },
    enemies: [],
    gone: [],
    companions: [],
    note: [],
    lastTarget: null,
    turnFlags: { played: 0, harmonies: 0, firstCardDone: false, centerActive: false, prismUsed: false, lightsThisTurn: [] },
    keepsakeFired: {},
    moodFiredThisPhase: [],
    playedLastTurn: 0,
    promises: [],
    promisesMade: 0,
    pending: null,
    rng: { shuffle: shuffleRng.state, ai: hash32(spec.nodeSeed, 'ai') },
    umbrellaUsed: false,
    paperCraneUsed: run.paperCraneUsed,
    mutations: [],
    glimmers: 0,
    maxHeartDelta: 0,
    outcome: null,
    lossCause: null,
    stats: emptyStats(),
  };
  const rt = createRtFor(c, s, ectx);

  // 2. Spawn left to right with pre-rolled HP and pattern offsets.
  const hpRng = new Rng(hash32(spec.nodeSeed, 'enc'));
  const ai = new Rng(c.rng.ai);
  enc.members.forEach((m, i) => {
    const def = enemyDef(rt, m.enemy);
    const range = m.hp ?? def.hp;
    const hp = spec.hps?.[i] ?? hpRng.int(range[0], range[1]);
    const offset = patternOffset(rt, m.enemy, ai, tutorial);
    insertEnemy(rt, makeEnemy(rt, m.enemy, hp, { summonerUid: null, surfacedFrom: null, offset }), rt.c.enemies.length);
  });
  rt.c.rng.ai = ai.state;

  try {
    // 3. Surfacing and hidden-Weight growth.
    surfacing(rt);
    // 4. Combat-start triggers: Keepsakes (acquisition order), then Shade passives (position order).
    fireKeepsakes(rt, 'combatStart');
    settle(rt);
    firePassivesAll(rt, 'combatStart');
    settle(rt);
    // 5. Intents.
    for (const e of rt.c.enemies) rollIntent(rt, e);
    // 6. The first turn.
    startTurn(rt);
  } catch (err) {
    if (!(err instanceof CombatOver)) throw err;
  }
  return {
    state: { ...s, phase: { kind: 'combat', nodeId: spec.nodeId }, nextUid: rt.nextUid, combat: rt.c },
    events: rt.events,
    revealedHiddenInfo: true,
  };
}
