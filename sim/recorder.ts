// Event reducer for one run: turns the engine's step results into the RunRecord metrics (DESIGN 20.7, 21.3).

import type { Engine, GameEvent, GameState, Light, Relation } from '../src/engine/index';
import type { CombatRecord, DeckRecord, RunRecord, Tier } from './types';

export class RunRecorder {
  combats: CombatRecord[] = [];
  dmg: Partial<Record<Relation, number>> = {};
  resolves = 0;
  deepResolves = 0;
  suppresses = 0;
  cardsAfterCompass = 0;
  harmonizedAfterCompass = 0;
  buriedWeightAtDeep: number | null = null;
  maxCardsPerTurn = 0;
  private cur: CombatRecord | null = null;
  private hp = 0;
  private cardsThisTurn = 0;

  constructor(private readonly engine: Engine) {}

  /** Feed one step: the state before, the state after and the step's events. */
  onStep(before: GameState, after: GameState, events: readonly GameEvent[]): void {
    if (before.phase.kind !== 'combat' && after.phase.kind === 'combat' && after.combat) this.startCombat(before, after);
    const compass = before.run.keepsakes.some((k) => k.id === 'ks.compass');
    for (const ev of events) this.onEvent(ev, compass);
    if (this.buriedWeightAtDeep === null && after.run.act === 3) this.buriedWeightAtDeep = buriedWeight(this.engine, after);
  }

  private startCombat(before: GameState, after: GameState): void {
    const c = after.combat!;
    this.hp = before.run.heart;
    this.cardsThisTurn = 0;
    this.cur = {
      encounter: c.encounter,
      tier: c.tier as Tier,
      act: after.run.act,
      floor: after.run.floor,
      won: false,
      turns: 0,
      heartStart: before.run.heart,
      heartLost: 0,
      cardsPlayed: 0,
      maxCardsPerTurn: 0,
      resolves: 0,
      deepResolves: 0,
      suppresses: 0,
    };
    this.combats.push(this.cur);
  }

  private onEvent(ev: GameEvent, compass: boolean): void {
    const c = this.cur;
    switch (ev.e) {
      case 'turn':
        if (c && ev.side === 'player') {
          c.turns = ev.n;
          this.cardsThisTurn = 0;
        }
        break;
      case 'cardPlayed':
        if (c) {
          c.cardsPlayed += 1;
          this.cardsThisTurn += 1;
          c.maxCardsPerTurn = Math.max(c.maxCardsPerTurn, this.cardsThisTurn);
          this.maxCardsPerTurn = Math.max(this.maxCardsPerTurn, this.cardsThisTurn);
        }
        if (compass) {
          this.cardsAfterCompass += 1;
          if (ev.harmonized) this.harmonizedAfterCompass += 1;
        }
        break;
      case 'hit':
        if (ev.b.fromCard) this.dmg[ev.b.relation] = (this.dmg[ev.b.relation] ?? 0) + ev.b.damage;
        break;
      case 'strike':
        if (c) {
          c.heartLost += Math.max(0, this.hp - ev.hpAfter);
          this.hp = ev.hpAfter;
        }
        break;
      case 'hpLoss':
        if (c && ev.to.side === 'player') {
          c.heartLost += ev.amount;
          this.hp = ev.after;
        }
        break;
      case 'mend':
        if (ev.to.side === 'player') this.hp = ev.after;
        break;
      case 'resolved':
        if (ev.deep) this.deepResolves += 1;
        else this.resolves += 1;
        if (c) {
          if (ev.deep) c.deepResolves += 1;
          else c.resolves += 1;
        }
        break;
      case 'suppressed':
        this.suppresses += 1;
        if (c) c.suppresses += 1;
        break;
      case 'combatEnd':
        if (c) c.won = ev.outcome === 'won';
        this.cur = null;
        break;
      default:
        break;
    }
  }

  /** The combat in progress (the run stopped inside it), if any. */
  get openCombat(): CombatRecord | null {
    return this.cur;
  }
}

export function buriedWeight(engine: Engine, s: GameState): number {
  let w = 0;
  for (const c of s.run.deck) if (engine.pack.cards[c.defId]?.kind === 'buried') w += c.weight ?? 1;
  return w;
}

export function deckRecord(engine: Engine, s: GameState): DeckRecord {
  const sum = engine.deckSummary(s);
  let blends = 0;
  for (const n of Object.values(sum.byBlend)) blends += n;
  return {
    total: sum.total,
    easeByLight: { ...sum.easeByLight },
    dominant: sum.mostCommon[0] as Light,
    buried: sum.buried,
    buriedWeight: sum.buriedWeight,
    insight: sum.insight,
    neutral: sum.neutral,
    blends,
  };
}

export type RecorderFields = Pick<
  RunRecord,
  | 'combats'
  | 'dmg'
  | 'resolves'
  | 'deepResolves'
  | 'suppresses'
  | 'cardsAfterCompass'
  | 'harmonizedAfterCompass'
  | 'buriedWeightAtDeep'
  | 'maxCardsPerTurn'
>;

export function recorderFields(r: RunRecorder): RecorderFields {
  return {
    combats: r.combats,
    dmg: r.dmg,
    resolves: r.resolves,
    deepResolves: r.deepResolves,
    suppresses: r.suppresses,
    cardsAfterCompass: r.cardsAfterCompass,
    harmonizedAfterCompass: r.harmonizedAfterCompass,
    buriedWeightAtDeep: r.buriedWeightAtDeep,
    maxCardsPerTurn: r.maxCardsPerTurn,
  };
}
