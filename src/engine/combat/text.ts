// Card rules text (CardDef doc comment in types.ts): `{0}`, `{1}`... slots filled by a depth-first walk of
// the effect list (then before else, Promise contents in place), `{w}` = Weight. Buried cards get
// generated text. Numbers come from the one damage pipeline.

import { ST } from '../constants';
import { evalAmount } from '../conditions';
import { computeGuard, computeHit } from '../damage';
import { AFFLICTION_OF, cureOf } from '../emotions';
import type { Amount, CardDef, EffectCtx, Effect, EngineCtx, EnemyState, Light, Shade } from '../types';
import { isBuried } from './buried';
import { cardEffects, cardTemplate } from './cards';
import { hitSpecFor } from './lethal';
import type { Rt } from './runtime';

export const capitalize = (s: string): string => (s.length ? s[0]!.toUpperCase() + s.slice(1) : s);

export function lightName(l: Light): string {
  return capitalize(l);
}

export function shadeName(s: Shade): string {
  return capitalize(s);
}

export function statusName(ectx: Pick<EngineCtx, 'pack'>, id: string): string {
  return ectx.pack.statuses[id]?.name ?? capitalize(id.replace(/_/g, ' '));
}

interface Slot {
  eff: Effect;
  inPromise: boolean;
}

/** Slots in template order: one per effect with a primary number. */
export function collectSlots(effects: readonly Effect[]): Slot[] {
  const out: Slot[] = [];
  const walk = (list: readonly Effect[], inPromise: boolean) => {
    for (const eff of list) {
      switch (eff.op) {
        case 'hit':
        case 'guard':
        case 'mend':
        case 'status':
        case 'draw':
        case 'energy':
          out.push({ eff, inPromise });
          break;
        case 'if':
          walk(eff.then, inPromise);
          walk(eff.else ?? [], inPromise);
          break;
        case 'promise':
          walk(eff.effects, true);
          break;
        default:
          break;
      }
    }
  };
  walk(effects, false);
  return out;
}

function slotAmount(eff: Effect): Amount | null {
  switch (eff.op) {
    case 'hit':
    case 'guard':
    case 'mend':
      return eff.amount;
    case 'status':
      return eff.stacks;
    case 'draw':
    case 'energy':
      return eff.n;
    default:
      return null;
  }
}

/** Amount with every count at 0 (deck view, rewards, shop). */
export function staticAmount(a: Amount): number {
  if (typeof a === 'number') return a;
  let v = a.add ?? 0;
  if (a.min !== undefined) v = Math.max(a.min, v);
  if (a.max !== undefined) v = Math.min(a.max, v);
  return Math.floor(v);
}

function fill(template: string, values: number[], weight: number | undefined): string {
  return template.replace(/\{(\d+|w)\}/g, (m, k: string) => {
    if (k === 'w') return weight === undefined ? m : String(weight);
    const v = values[Number(k)];
    return v === undefined ? m : String(v);
  });
}

export function buriedText(ectx: Pick<EngineCtx, 'pack'>, def: CardDef, weight: number): string {
  const shade = def.buried?.shade;
  if (!shade) return fill(def.text, [], weight);
  const aff = statusName(ectx, AFFLICTION_OF[shade]);
  const light = lightName(cureOf(shade));
  return `Weight ${weight}. Unplayable. End of turn in hand: gain ${weight} ${aff}. Play a ${light} card Inward to Tend.`;
}

/** Outside combat: base numbers. */
export function describeDef(ectx: EngineCtx, def: CardDef, upgraded: boolean, weight?: number): string {
  if (isBuried(def)) return buriedText(ectx, def, weight ?? 1);
  const values = collectSlots(cardEffects(def, upgraded)).map((s) => {
    const a = slotAmount(s.eff);
    return a === null ? 0 : staticAmount(a);
  });
  return fill(cardTemplate(def, upgraded), values, weight);
}

/**
 * In combat. Without a target: hits include your Nerve and Heavy, Guard includes Trembling.
 * With a target: hits are the final number against that Shade (type, Guard ignored).
 */
export function describeInCombat(rt: Rt, def: CardDef, upgraded: boolean, ctx: EffectCtx, target: EnemyState | undefined, weight?: number): string {
  if (isBuried(def)) return buriedText(rt, def, weight ?? 1);
  const trembling = (rt.c.player.statuses[ST.trembling] ?? 0) >= 1;
  const values = collectSlots(cardEffects(def, upgraded)).map((s) => {
    const a = slotAmount(s.eff)!;
    const n = evalAmount(rt, a, ctx);
    if (s.eff.op === 'hit') {
      const fromCard = !s.inPromise;
      const hitCtx: EffectCtx = { ...ctx, fromCard };
      if (target) {
        const spec = hitSpecFor(rt, target, n, hitCtx);
        return computeHit({ ...spec, target: { ...spec.target, guard: 0 } }, rt.rules).damage;
      }
      const ps = rt.c.player.statuses;
      return computeHit(
        {
          base: n,
          fromCard,
          lights: [],
          nerve: ps[ST.nerve] ?? 0,
          heavy: (ps[ST.heavy] ?? 0) >= 1,
          lightningRod: false,
          target: { hp: Number.MAX_SAFE_INTEGER, guard: 0, faces: ['anger'], faceIndex: 0, fleeting: false, understood: false, veiled: false },
        },
        rt.rules,
      ).damage;
    }
    if (s.eff.op === 'guard') return computeGuard(n, { fromCard: true, trembling }, rt.rules);
    return n;
  });
  return fill(cardTemplate(def, upgraded), values, weight);
}
