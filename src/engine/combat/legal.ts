// Play planning and legality (5.3 steps 1 to 3, R-7 Inward legality, Shy, Veiled) and legal action lists.

import { ST } from '../constants';
import { countOf } from '../conditions';
import { afflictionSoothedBy, harmonize } from '../emotions';
import type { Action, AfflictionId, CardDef, EffectCtx, EnemyState, Light, Uid } from '../types';
import { IllegalActionError } from '../types';
import { inwardTendCandidate, isBuried } from './buried';
import { cardCost, cardCostMod, hasKeyword } from './cards';
import { enemyDef, findEnemy, isVeiled, type Rt } from './runtime';

export interface PlayPlan {
  uid: Uid;
  def: CardDef;
  upgraded: boolean;
  /** Numb: the first card played this turn has no Light. */
  greyed: boolean;
  effective: Light[];
  harmonized: boolean;
  cost: number;
  usedCenter: boolean;
  usedPrism: boolean;
}

export function cardCtx(uid: Uid, targetUid: Uid | null, lights: Light[], harmonized: boolean): EffectCtx {
  return { source: 'card', sourceUid: uid, targetUid, lights, harmonized, fromCard: true };
}

/** Effective Lights, Harmony and final cost of playing a card from hand now. Null if it can't be played. */
export function planCard(rt: Rt, uid: Uid): PlayPlan | null {
  const c = rt.c;
  const card = c.cards[uid];
  if (!card || !c.piles.hand.includes(uid)) return null;
  const def = rt.pack.cards[card.defId];
  if (!def) return null;
  const printed = cardCost(def, card.upgraded);
  if (printed === 'unplayable' || isBuried(def)) return null;
  const ps = c.player.statuses;
  const firstCard = !c.turnFlags.firstCardDone;
  const greyed = (ps[ST.numb] ?? 0) >= 1 && firstCard;
  const h = greyed
    ? { effective: [] as Light[], harmonized: false }
    : harmonize(c.note, def.lights, {
        enabled: rt.flags.has('harmony'),
        isolated: (ps[ST.isolated] ?? 0) >= 1,
        mirror: rt.flags.has('mirror'),
      });
  let cost = printed;
  const mod = cardCostMod(def, card.upgraded);
  if (mod) cost += countOf(rt, mod.per, cardCtx(uid, null, h.effective, h.harmonized)) * mod.mult;
  if ((ps[ST.restless] ?? 0) >= 1 && firstCard) cost += 1;
  const usedPrism = rt.flags.has('prism') && h.harmonized && c.turnFlags.harmonies === 0 && !c.turnFlags.prismUsed;
  if (usedPrism) cost -= 1;
  cost = Math.max(0, cost);
  const usedCenter = c.turnFlags.centerActive;
  if (usedCenter) cost = 0;
  return { uid, def, upgraded: card.upgraded, greyed, effective: h.effective, harmonized: h.harmonized, cost, usedCenter, usedPrism };
}

/** A card can target this Shade: present, not Veiled, not Shy while another Shade stands (unless Reaches Shy). */
export function canTarget(rt: Rt, e: EnemyState, reachesShy: boolean): boolean {
  if (isVeiled(e)) return false;
  if (enemyDef(rt, e).shy && rt.c.enemies.length > 1 && !reachesShy) return false;
  return true;
}

export interface InwardOutcome {
  cleanse: { id: AfflictionId; n: number; light: Light }[];
  tend: Uid | null;
}

/** R-7: what an Inward play would do (clear each effective Light's affliction, Tend one Buried card). */
export function inwardOutcome(rt: Rt, plan: PlayPlan): InwardOutcome {
  const cleanse: InwardOutcome['cleanse'] = [];
  for (const l of plan.effective) {
    const id = afflictionSoothedBy(l);
    const n = rt.c.player.statuses[id] ?? 0;
    if (n > 0 && !cleanse.some((x) => x.id === id)) cleanse.push({ id, n, light: l });
  }
  return { cleanse, tend: plan.effective.length > 0 ? inwardTendCandidate(rt, plan.effective) : null };
}

export function inwardLegal(rt: Rt, plan: PlayPlan): boolean {
  if (plan.def.lights.length === 0 || plan.effective.length === 0) return false;
  const o = inwardOutcome(rt, plan);
  return o.cleanse.length > 0 || o.tend !== null;
}

/** Validates a play action; returns its plan or throws IllegalActionError. */
export function checkPlay(rt: Rt, a: Extract<Action, { t: 'play' }>): PlayPlan {
  const c = rt.c;
  const fail = (why: string): never => {
    throw new IllegalActionError(`Illegal play: ${why}`, a);
  };
  if (c.outcome) fail('combat is over');
  if (c.pending) fail('a choice is pending');
  const plan = planCard(rt, a.card) ?? fail('card not playable from hand');
  if (plan.cost > c.energy) fail('not enough Spirit');
  if (a.inward) {
    if (a.target !== undefined) fail('Inward plays take no target');
    if (!inwardLegal(rt, plan)) fail('Inward would do nothing');
    return plan;
  }
  if (plan.def.target === 'enemy') {
    const e = findEnemy(rt, a.target) ?? fail('target must be a Shade on the field');
    if (!canTarget(rt, e, hasKeyword(plan.def, plan.upgraded, 'reachesShy'))) fail('target cannot be targeted');
  } else if (a.target !== undefined) fail('this card takes no target');
  return plan;
}

/** Canonical order: plays in hand order (targets left to right, then Inward), then endTurn. */
export function legalActionsOf(rt: Rt): Action[] {
  const c = rt.c;
  if (c.outcome) return [];
  if (c.pending) return c.pending.options.map((uid) => ({ t: 'choose', uid }) as Action);
  const out: Action[] = [];
  for (const uid of c.piles.hand) {
    const plan = planCard(rt, uid);
    if (!plan || plan.cost > c.energy) continue;
    if (plan.def.target === 'enemy') {
      const shy = hasKeyword(plan.def, plan.upgraded, 'reachesShy');
      for (const e of c.enemies) if (canTarget(rt, e, shy)) out.push({ t: 'play', card: uid, target: e.uid });
    } else out.push({ t: 'play', card: uid });
    if (inwardLegal(rt, plan)) out.push({ t: 'play', card: uid, inward: true });
  }
  out.push({ t: 'endTurn' });
  return out;
}
