// Fluent combat scenario builder for rule tests. Builds a GameState mid player turn (after 5.2) with exactly
// the hand, piles, Shades, statuses, Keepsakes, Companions and Note you ask for, then drives the real
// combat API. Intents are derived by the engine unless you set them.
//
//   const t = scenario().hand('love.kind_word').enemy('shade.grumble', { hp: 20 }).build();
//   t.play('love.kind_word', 0);          // target = enemy index 0
//   expect(t.enemy(0).hp).toBe(8);

import {
  buildCombatResult,
  cardText,
  combatLegalActions,
  handHints,
  intents,
  previewCombat,
  startCombat,
  stepCombat,
  type CombatStartSpec,
} from '../../src/engine/combat/index';
import { currentPattern, makeEnemy, rollIntent } from '../../src/engine/combat/enemy';
import { createRt } from '../../src/engine/combat/runtime';
import { emptyStats } from '../../src/engine/combat/setup';
import type {
  Action,
  CardId,
  CombatCard,
  CombatState,
  ContentPack,
  EngineCtx,
  EnemyState,
  GameEvent,
  GameState,
  KeepsakeId,
  Light,
  Preview,
  RulesConfig,
  StatusBag,
  StepResult,
  Uid,
} from '../../src/engine/types';
import { testPack } from '../fixtures/testPack';
import { ctxFor, makeRun, makeState } from './run';

export interface CardSpec {
  id: CardId;
  upgraded?: boolean;
  weight?: 1 | 2 | 3;
  peakWeight?: 1 | 2 | 3;
  lingered?: number;
  timesPlayed?: number;
  tended?: boolean;
}
export type CardArg = CardId | CardSpec;

export interface EnemySpec {
  hp?: number;
  maxHp?: number;
  guard?: number;
  statuses?: StatusBag;
  faceIndex?: number;
  /** Intent move id: sets the cycle index so the engine derives it (throws if unreachable). */
  intent?: string;
  patternIndex?: number;
  phase?: number;
  memory?: Record<string, number>;
  /** Index of an earlier enemy that summoned this one. */
  summonedBy?: number;
  /** Uid of a Buried card (in removed pile) this Surfaced Shade came from. */
  surfacedFromCard?: number;
}

export interface PlayerSpec {
  hp?: number;
  maxHp?: number;
  guard?: number;
  energy?: number;
  statuses?: StatusBag;
}

type PileName = 'hand' | 'draw' | 'discard' | 'moods' | 'deck' | 'removed' | 'letGo';

export class Scenario {
  private cards: { pile: PileName; spec: CardSpec }[] = [];
  private enemies: { defId: string; spec: EnemySpec }[] = [];
  private playerSpec: PlayerSpec = {};
  private keepsakeIds: KeepsakeId[] = [];
  private companionIds: string[] = [];
  private noteLights: Light[] = [];
  private turnNo = 1;
  private tierName: CombatState['tier'] = 'normal';
  private rulesOverride: Partial<RulesConfig> | undefined;
  private flagsOverride: Partial<CombatState['turnFlags']> = {};
  private insights: string[] = [];
  private lastTargetIndex: number | null = null;
  private extra: Partial<CombatState> = {};
  private runPaperCraneUsed = false;

  constructor(private pack: ContentPack = testPack) {}

  private add(pile: PileName, cards: CardArg[]): this {
    for (const c of cards) this.cards.push({ pile, spec: typeof c === 'string' ? { id: c } : c });
    return this;
  }
  hand(...cards: CardArg[]): this {
    return this.add('hand', cards);
  }
  /** Draw pile, top card first. */
  draw(...cards: CardArg[]): this {
    return this.add('draw', cards);
  }
  discard(...cards: CardArg[]): this {
    return this.add('discard', cards);
  }
  /** Active Moods (already played outward). */
  moods(...cards: CardArg[]): this {
    return this.add('moods', cards);
  }
  /** In the run deck and the removed pile (not drawable), e.g. to own a Buried card for Suppress tests. */
  removed(...cards: CardArg[]): this {
    return this.add('removed', cards);
  }
  enemy(defId: string, spec: EnemySpec = {}): this {
    this.enemies.push({ defId, spec });
    return this;
  }
  player(p: PlayerSpec): this {
    this.playerSpec = { ...this.playerSpec, ...p };
    return this;
  }
  statuses(bag: StatusBag): this {
    this.playerSpec.statuses = { ...(this.playerSpec.statuses ?? {}), ...bag };
    return this;
  }
  energy(n: number): this {
    this.playerSpec.energy = n;
    return this;
  }
  keepsakes(...ids: KeepsakeId[]): this {
    this.keepsakeIds.push(...ids);
    return this;
  }
  compass(): this {
    return this.keepsakes('ks.compass');
  }
  companions(...ids: string[]): this {
    this.companionIds.push(...ids);
    return this;
  }
  note(...lights: Light[]): this {
    this.noteLights = lights;
    return this;
  }
  turn(n: number): this {
    this.turnNo = n;
    return this;
  }
  tier(t: CombatState['tier']): this {
    this.tierName = t;
    return this;
  }
  rules(r: Partial<RulesConfig>): this {
    this.rulesOverride = r;
    return this;
  }
  turnFlags(f: Partial<CombatState['turnFlags']>): this {
    this.flagsOverride = { ...this.flagsOverride, ...f };
    return this;
  }
  insightsMade(...ids: string[]): this {
    this.insights.push(...ids);
    return this;
  }
  lastTarget(enemyIndex: number): this {
    this.lastTargetIndex = enemyIndex;
    return this;
  }
  paperCraneAlreadyUsed(): this {
    this.runPaperCraneUsed = true;
    return this;
  }
  with(extra: Partial<CombatState>): this {
    this.extra = { ...this.extra, ...extra };
    return this;
  }

  build(): Harness {
    const ctx = ctxFor(this.pack, this.rulesOverride);
    let uid = 1;
    const cards: Record<Uid, CombatCard> = {};
    const piles: CombatState['piles'] = { draw: [], hand: [], discard: [], letGo: [], moods: [], removed: [], play: [] };
    const deck = [];
    for (const { pile, spec } of this.cards) {
      if (!this.pack.cards[spec.id]) throw new Error(`scenario: unknown card ${spec.id}`);
      const card: CombatCard = {
        uid,
        defId: spec.id,
        upgraded: spec.upgraded ?? false,
        mem: { lingered: spec.lingered ?? 0, timesPlayed: spec.timesPlayed ?? 0, tended: spec.tended ?? false, lingerThisTurn: false },
      };
      const def = this.pack.cards[spec.id]!;
      if (def.kind === 'buried') {
        card.weight = spec.weight ?? 1;
        card.peakWeight = spec.peakWeight ?? card.weight;
      }
      cards[uid] = card;
      const { mem: _mem, ...inst } = card;
      void _mem;
      deck.push(inst);
      if (pile !== 'deck') piles[pile].push(uid);
      uid++;
    }
    const run = makeRun({
      deck,
      keepsakes: this.keepsakeIds,
      heart: this.playerSpec.hp ?? 70,
      maxHeart: this.playerSpec.maxHp ?? 70,
      insightsMade: this.insights,
      paperCraneUsed: this.runPaperCraneUsed,
    });
    const combat: CombatState = {
      nodeId: 0,
      encounter: 'enc.test',
      tier: this.tierName,
      turn: this.turnNo,
      energy: this.playerSpec.energy ?? 3,
      player: {
        hp: this.playerSpec.hp ?? 70,
        maxHp: this.playerSpec.maxHp ?? 70,
        guard: this.playerSpec.guard ?? 0,
        statuses: { ...(this.playerSpec.statuses ?? {}) },
      },
      cards,
      piles,
      enemies: [],
      gone: [],
      companions: [],
      note: [...this.noteLights],
      lastTarget: null,
      turnFlags: { played: 0, harmonies: 0, firstCardDone: false, centerActive: false, prismUsed: false, lightsThisTurn: [], ...this.flagsOverride },
      keepsakeFired: {},
      moodFiredThisPhase: [],
      playedLastTurn: 0,
      promises: [],
      promisesMade: 0,
      pending: null,
      rng: { shuffle: 12345, ai: 777 },
      umbrellaUsed: false,
      paperCraneUsed: this.runPaperCraneUsed,
      mutations: [],
      glimmers: 0,
      maxHeartDelta: 0,
      outcome: null,
      lossCause: null,
      stats: emptyStats(),
      ...this.extra,
    };
    let state: GameState = { v: 1, contentHash: 'test', seed: 1, nextUid: uid, phase: { kind: 'combat', nodeId: 0 }, run, combat, eventCombat: null };
    // Shades and Companions get engine uids; intents are derived by the engine.
    const rt = createRt(state, ctx);
    const made: EnemyState[] = [];
    for (const { defId, spec } of this.enemies) {
      const def = this.pack.enemies[defId];
      if (!def) throw new Error(`scenario: unknown enemy ${defId}`);
      const hp = spec.hp ?? def.hp[1];
      const e = makeEnemy(rt, defId, hp, {
        summonerUid: spec.summonedBy !== undefined ? made[spec.summonedBy]!.uid : null,
        surfacedFrom: spec.surfacedFromCard ?? null,
        offset: spec.patternIndex ?? 0,
      });
      e.maxHp = spec.maxHp ?? Math.max(hp, def.hp[1]);
      e.guard = spec.guard ?? 0;
      e.statuses = { ...(spec.statuses ?? {}) };
      e.faceIndex = spec.faceIndex ?? 0;
      e.pattern.phase = spec.phase ?? 0;
      e.memory = { ...e.memory, ...(spec.memory ?? {}) };
      made.push(e);
      rt.c.enemies.push(e);
    }
    for (const e of rt.c.enemies) {
      const spec = this.enemies[made.indexOf(e)]!.spec;
      if (spec.intent) {
        // Express the requested intent through the pattern so the engine derives the same move.
        const pat = currentPattern(this.pack.enemies[e.defId]!, e);
        if (pat.kind === 'cycle' && pat.moves.includes(spec.intent)) e.pattern.index = pat.moves.indexOf(spec.intent);
      }
      rollIntent(rt, e);
      if (spec.intent && e.intent?.moveId !== spec.intent) {
        throw new Error(`scenario: ${e.defId} cannot intend ${spec.intent} in this state (derived ${e.intent?.moveId})`);
      }
    }
    for (const id of this.companionIds) rt.c.companions.push({ uid: rt.nextUid++, defId: id });
    if (this.lastTargetIndex !== null) rt.c.lastTarget = made[this.lastTargetIndex]!.uid;
    state = { ...state, nextUid: rt.nextUid, combat: rt.c };
    return new Harness(state, ctx);
  }
}

export const scenario = (pack?: ContentPack): Scenario => new Scenario(pack);

export class Harness {
  /** Events of the last step. */
  events: GameEvent[] = [];
  /** Every event since build. */
  log: GameEvent[] = [];
  history: GameState[] = [];

  constructor(
    public state: GameState,
    public readonly ctx: EngineCtx,
  ) {}

  get c(): CombatState {
    return this.state.combat!;
  }

  /** Card uid by def id (first match in hand, then any pile), or pass a uid through. */
  uid(card: CardId | Uid, nth = 0): Uid {
    if (typeof card === 'number') return card;
    const inHand = this.c.piles.hand.filter((u) => this.c.cards[u]!.defId === card);
    if (inHand[nth] !== undefined) return inHand[nth]!;
    const any = Object.values(this.c.cards).filter((x) => x.defId === card);
    if (any[nth]) return any[nth]!.uid;
    throw new Error(`no card ${card}`);
  }

  enemy(i: number): EnemyState {
    const e = this.c.enemies[i];
    if (!e) throw new Error(`no enemy at ${i}`);
    return e;
  }

  enemyByDef(defId: string): EnemyState | undefined {
    return this.c.enemies.find((e) => e.defId === defId);
  }

  action(card: CardId | Uid, target?: number | 'inward'): Action {
    const uid = this.uid(card);
    if (target === 'inward') return { t: 'play', card: uid, inward: true };
    if (target === undefined) return { t: 'play', card: uid };
    return { t: 'play', card: uid, target: this.enemy(target).uid };
  }

  step(a: Action): StepResult {
    const r = stepCombat(this.state, this.ctx, a);
    this.history.push(this.state);
    this.state = r.state;
    this.events = r.events;
    this.log.push(...r.events);
    return r;
  }

  play(card: CardId | Uid, target?: number | 'inward'): StepResult {
    return this.step(this.action(card, target));
  }

  endTurn(): StepResult {
    return this.step({ t: 'endTurn' });
  }

  choose(uid: Uid): StepResult {
    return this.step({ t: 'choose', uid });
  }

  preview(card: CardId | Uid, target?: number | 'inward'): Preview | null {
    return previewCombat(this.state, this.ctx, this.action(card, target));
  }

  previewEndTurn(): Preview | null {
    return previewCombat(this.state, this.ctx, { t: 'endTurn' });
  }

  legal(): Action[] {
    return combatLegalActions(this.state, this.ctx);
  }

  intents() {
    return intents(this.state, this.ctx);
  }

  hints() {
    return handHints(this.state, this.ctx);
  }

  text(card: CardId | Uid, target?: number): string {
    return cardText(this.state, this.ctx, this.uid(card), target === undefined ? undefined : this.enemy(target).uid);
  }

  result() {
    return buildCombatResult(this.state, this.ctx);
  }

  status(id: string): number {
    return this.c.player.statuses[id] ?? 0;
  }

  handIds(): string[] {
    return this.c.piles.hand.map((u) => this.c.cards[u]!.defId);
  }

  eventsOf<K extends GameEvent['e']>(kind: K, from: GameEvent[] = this.events): Extract<GameEvent, { e: K }>[] {
    return from.filter((e) => e.e === kind) as Extract<GameEvent, { e: K }>[];
  }
}

/** Starts a real combat through startCombat (5.1) from a deck of card ids. */
export function startScenario(o: {
  pack?: ContentPack;
  deck: (string | { id: string; upgraded?: boolean; weight?: 1 | 2 | 3; peakWeight?: 1 | 2 | 3 })[];
  encounter: string;
  keepsakes?: KeepsakeId[];
  seed?: number;
  hps?: number[];
  tier?: CombatState['tier'];
  heart?: number;
  insightsMade?: string[];
  rules?: Partial<RulesConfig>;
}): Harness {
  const pack = o.pack ?? testPack;
  const ctx = ctxFor(pack, o.rules);
  const s = makeState(o.deck, {
    keepsakes: o.keepsakes ?? [],
    heart: o.heart ?? 70,
    insightsMade: o.insightsMade ?? [],
  });
  const spec: CombatStartSpec = { encounter: o.encounter, nodeId: 1, nodeSeed: o.seed ?? 1, tier: o.tier ?? 'normal' };
  if (o.hps) spec.hps = o.hps;
  const r = startCombat(s, ctx, spec);
  const h = new Harness(r.state, ctx);
  h.events = r.events;
  h.log.push(...r.events);
  return h;
}
