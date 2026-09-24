// The one damage pipeline (DESIGN.md 5.4, 5.5). Preview, intents, card faces and bot beliefs all call these.
// Pure: no state access beyond the arguments.

import { lethalOutcome, relationOf, type TargetTyping } from './emotions';
import type { RulesConfig } from './rules';
import type { HitBreakdown, Light, Shade } from './types';

export interface HitTarget {
  hp: number;
  guard: number;
  /** [] = numb rules. */
  faces: readonly Shade[];
  faceIndex: number;
  fleeting: boolean;
  understood: boolean;
  veiled: boolean;
}

export interface HitSpec {
  /** Step 1: the card's number after its own Amount expression. */
  base: number;
  /** True for hits from the card being played. */
  fromCard: boolean;
  /** Effective Lights carried by the hit. */
  lights: readonly Light[];
  /** Player Nerve stacks (applied to card hits only). */
  nerve: number;
  /** Player has 1+ Heavy (applied to card hits only). */
  heavy: boolean;
  lightningRod: boolean;
  target: HitTarget;
  /** Trace label for step 1 (card or source name). */
  label?: string;
}

export function typingOf(t: HitTarget): TargetTyping {
  if (t.faces.length === 0) return { rule: 'numb', veiled: t.veiled };
  return { rule: 'standard', face: t.faces[t.faceIndex % t.faces.length]!, understood: t.understood };
}

export function showingFace(t: Pick<HitTarget, 'faces' | 'faceIndex'>): Shade | null {
  return t.faces.length === 0 ? null : t.faces[t.faceIndex % t.faces.length]!;
}

const pctText = (p: number): string => {
  if (p === 200) return 'x2';
  if (p === 50) return 'x1/2';
  if (p === 75) return 'x3/4';
  if (p === 100) return 'x1';
  if (p === 0) return 'x0';
  return `x${p / 100}`;
};

/** Steps 1 to 7 of 5.4. Side effects (Flare, face turn, Understood, Wavering) are the caller's job (step 8). */
export function computeHit(spec: HitSpec, rules: RulesConfig): HitBreakdown {
  const B = Math.max(0, Math.floor(spec.base));
  const F = spec.fromCard ? Math.max(0, spec.nerve) : 0;
  const H = spec.fromCard && spec.heavy ? rules.heavyPct : 100;
  const typing = typingOf(spec.target);
  // A Veiled standard-rules target (not used in v1) would still take damage; veiled only matters for numb rules.
  const rel = relationOf(spec.lights, typing, { fromCard: spec.fromCard, lightningRod: spec.lightningRod }, rules);
  const T = rel.pct;
  let D = Math.floor(((B + F) * H * T) / 10000);
  if (B + F > 0 && T > 0) D = Math.max(1, D);
  const blocked = Math.min(spec.target.guard, D);
  const hpLoss = D - blocked;
  const guardAfter = spec.target.guard - blocked;
  const lethal = spec.target.hp - hpLoss <= 0;
  let outcome: HitBreakdown['outcome'] = null;
  let hpAfter = spec.target.hp - hpLoss;
  if (lethal) {
    outcome = lethalOutcome(spec.lights, spec.target.faces, showingFace(spec.target), rel.relation, {
      fromCard: spec.fromCard,
      fleeting: spec.target.fleeting,
      understood: spec.target.understood,
    });
    hpAfter = outcome === 'wavering' ? 1 : 0;
  }

  const trace: HitBreakdown['trace'] = [{ label: spec.label ?? 'Ease', value: String(B) }];
  if (F > 0) trace.push({ label: 'Nerve', value: `+${F}` });
  if (H !== 100) trace.push({ label: 'Heavy', value: pctText(H) });
  trace.push({ label: rel.relation.toUpperCase(), value: pctText(T) });
  trace.push({ label: '=', value: String(D) });
  if (blocked > 0) trace.push({ label: 'Guard absorbs', value: `-${blocked}` });
  trace.push({ label: 'Intensity', value: `${spec.target.hp} -> ${hpAfter}` });

  return {
    base: B,
    flat: F,
    afflictionPct: H,
    relation: rel.relation,
    typePct: T,
    damage: D,
    blocked,
    hpLoss,
    hpBefore: spec.target.hp,
    hpAfter,
    guardAfter,
    lethal,
    outcome,
    fromCard: spec.fromCard,
    lights: [...spec.lights],
    trace,
  };
}

/** Bot beliefs: re-derive damage and lethality with a different type percent (keeps everything else). */
export function recombine(b: HitBreakdown, typePct: number, guard: number): { damage: number; hpLoss: number; lethal: boolean } {
  let D = Math.floor(((b.base + b.flat) * b.afflictionPct * typePct) / 10000);
  if (b.base + b.flat > 0 && typePct > 0) D = Math.max(1, D);
  const hpLoss = D - Math.min(guard, D);
  return { damage: D, hpLoss, lethal: b.hpBefore - hpLoss <= 0 };
}

/** Player Guard from cards/Moods: x tremblingPct while Trembling. Keepsakes/Companions/Afterglows ignore it. */
export function computeGuard(base: number, o: { fromCard: boolean; trembling: boolean }, rules: RulesConfig): number {
  const b = Math.max(0, Math.floor(base));
  return o.fromCard && o.trembling ? Math.floor((b * rules.tremblingPct) / 100) : b;
}

/** Mend never exceeds missing Heart/Intensity. */
export function computeMend(amount: number, hp: number, maxHp: number): number {
  return Math.max(0, Math.min(Math.floor(amount), maxHp - hp));
}

/** A Shade strike against the player (5.5): per strike max(0, base + Flare - Hush). */
export function computeStrike(base: number, flare: number, hush: number): number {
  return Math.max(0, Math.floor(base) + flare - hush);
}

/** Apply `perStrike` x `count` strikes to the player's Guard/Heart. Returns totals and the resulting values. */
export function resolveStrikes(
  perStrike: number,
  count: number,
  guard: number,
  hp: number,
): { blocked: number; hpLoss: number; guardAfter: number; hpAfter: number } {
  let g = guard;
  let h = hp;
  let blocked = 0;
  let loss = 0;
  for (let i = 0; i < count; i++) {
    const b = Math.min(g, perStrike);
    g -= b;
    blocked += b;
    const l = perStrike - b;
    h -= l;
    loss += l;
  }
  return { blocked, hpLoss: loss, guardAfter: g, hpAfter: h };
}
