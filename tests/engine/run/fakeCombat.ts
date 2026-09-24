// Stand-in for src/engine/combat/index.ts in run-side tests (vi.mock). A combat ends on the first endTurn
// with whatever `fake` says, so run flows can be tested without the real combat engine.

import type { CombatStartSpec } from '../../../src/engine/combat/index';
import {
  IllegalActionError,
  type Action,
  type CardId,
  type CombatCard,
  type CombatResult,
  type CombatState,
  type CombatStats,
  type EngineCtx,
  type GameState,
  type HandHint,
  type IntentView,
  type Preview,
  type StepResult,
  type Uid,
} from '../../../src/engine/types';

export const emptyCombatStats = (): CombatStats => ({
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
});

export const fake = {
  outcome: 'won' as 'won' | 'lost',
  lossCause: 'heart' as 'heart' | 'turnLimit',
  /** Overrides merged into the CombatResult of the next finished combats. */
  result: null as null | ((s: GameState) => Partial<CombatResult>),
  started: [] as CombatStartSpec[],
  reset(): void {
    this.outcome = 'won';
    this.lossCause = 'heart';
    this.result = null;
    this.started = [];
  },
};

export function startCombat(s: GameState, ctx: EngineCtx, spec: CombatStartSpec): StepResult {
  fake.started.push(spec);
  const enc = ctx.pack.encounters[spec.encounter];
  if (!enc) throw new Error(`fake startCombat: unknown encounter ${spec.encounter}`);
  const enemies = enc.members.map((m, i) => {
    const def = ctx.pack.enemies[m.enemy]!;
    const hp = spec.hps?.[i] ?? def.hp[0];
    return {
      uid: 10_000 + i,
      defId: m.enemy,
      hp,
      maxHp: hp,
      guard: 0,
      statuses: {},
      faces: [...def.faces],
      faceIndex: 0,
      intent: null,
      pattern: { index: 0, phase: 0 },
      fleeting: false,
      summonerUid: null,
      surfacedFrom: null,
      memory: {},
      thresholdsFired: [],
    };
  });
  const cards: Record<Uid, CombatCard> = {};
  for (const c of s.run.deck) cards[c.uid] = { ...c, mem: { lingered: 0, timesPlayed: 0, tended: false, lingerThisTurn: false } };
  const combat: CombatState = {
    nodeId: spec.nodeId,
    encounter: spec.encounter,
    tier: spec.tier,
    turn: 1,
    energy: 3,
    player: { hp: s.run.heart, maxHp: s.run.maxHeart, guard: 0, statuses: {} },
    cards,
    piles: { draw: s.run.deck.map((c) => c.uid), hand: [], discard: [], letGo: [], moods: [], removed: [] },
    enemies,
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
    rng: { shuffle: 1, ai: 1 },
    umbrellaUsed: false,
    paperCraneUsed: s.run.paperCraneUsed,
    mutations: [],
    glimmers: 0,
    maxHeartDelta: 0,
    outcome: null,
    lossCause: null,
    stats: emptyCombatStats(),
  };
  return { state: { ...s, phase: { kind: 'combat', nodeId: spec.nodeId }, combat }, events: [], revealedHiddenInfo: true };
}

export function combatLegalActions(): Action[] {
  return [{ t: 'endTurn' }];
}

export function stepCombat(s: GameState, _ctx: EngineCtx, a: Action): StepResult {
  if (a.t !== 'endTurn') throw new IllegalActionError(`fake combat only knows endTurn`, a);
  const combat: CombatState = {
    ...s.combat!,
    outcome: fake.outcome,
    lossCause: fake.outcome === 'lost' ? fake.lossCause : null,
  };
  return { state: { ...s, combat }, events: [{ e: 'turn', side: 'enemy', n: 1 }], revealedHiddenInfo: true };
}

const TIER_GLIMMERS: Record<CombatState['tier'], number> = {
  normal: 10,
  tutorial: 10,
  event: 10,
  elite: 25,
  boss: 60,
  final: 0,
};

export function buildCombatResult(s: GameState): CombatResult {
  const c = s.combat!;
  const base: CombatResult = {
    outcome: c.outcome!,
    heartAfter: c.outcome === 'won' ? s.run.heart : 0,
    glimmers: c.outcome === 'won' ? TIER_GLIMMERS[c.tier] : 0,
    mutations: [],
    keepsakeCounters: {},
    paperCraneUsed: false,
    allResolved: true,
    gone: c.enemies.map((e) => ({ uid: e.uid, defId: e.defId, outcome: 'resolve', face: e.faces[0] ?? null })),
    stats: emptyCombatStats(),
  };
  return { ...base, ...(fake.result?.(s) ?? {}) };
}

export function previewCombat(): Preview | null {
  return null;
}
export function intents(): IntentView[] {
  return [];
}
export function handHints(): HandHint[] {
  return [];
}
export function cardText(_s: GameState, _ctx: EngineCtx, uid: Uid): string {
  return `card ${uid}`;
}
export function describeCard(_ctx: EngineCtx, defId: CardId, upgraded: boolean): string {
  return `${defId}${upgraded ? '+' : ''}`;
}
