// Player-side hits (5.4), their side effects (step 8), lethal outcomes (R-8), Afterglows (R-9),
// summoner Fades (R-8a) and the immediate win check (R-8b, 4.18 ordering).

import { ST } from '../constants';
import { evalAmount } from '../conditions';
import { computeHit, type HitSpec } from '../damage';
import { drain, enqueue } from '../interpreter';
import { applyHit, emit, removeEnemy, tidyAtCombatEnd } from '../primitives';
import type { Amount, Effect, EffectCtx, EnemyState, EntityRef, HitBreakdown, LethalOutcome } from '../types';
import { surfacedResolved, surfacedSuppressed, suppressConsequence } from './buried';
import { autoTarget } from './companions';
import { checkPhases, refreshIntent, turnFace } from './enemy';
import { COMBAT_OVER, enemyDef, findEnemy, isNumbRules, isVeiled, showing, type Rt } from './runtime';
import { giveStatus, setStatusOn } from './statuses';
import { checkThresholds, fireKeepsakes, firePassives, firePassivesAll } from './triggers';

function sourceRef(ctx: EffectCtx): EntityRef {
  return ctx.source === 'companion' ? { side: 'companion', uid: ctx.sourceUid } : { side: 'player' };
}

function sourceLabel(rt: Rt, ctx: EffectCtx): string {
  if (ctx.source === 'card' || ctx.source === 'mood' || ctx.source === 'promise') {
    const card = rt.c.cards[ctx.sourceUid];
    const def = card ? rt.pack.cards[card.defId] : undefined;
    if (def) return ctx.source === 'promise' ? `${def.name} (Promise)` : def.name;
  }
  if (ctx.source === 'companion') {
    const comp = rt.c.companions.find((x) => x.uid === ctx.sourceUid);
    const def = comp ? rt.pack.companions[comp.defId] : undefined;
    if (def) return def.name;
  }
  if (ctx.source === 'keepsake') return 'Keepsake';
  if (ctx.source === 'afterglow') return 'Afterglow';
  return 'Ease';
}

/** The HitSpec for a hit on `e` right now (shared by the interpreter, previews and card-face numbers). */
export function hitSpecFor(rt: Rt, e: EnemyState, base: number, ctx: EffectCtx): HitSpec {
  const ps = rt.c.player.statuses;
  return {
    base,
    fromCard: ctx.fromCard,
    lights: ctx.lights,
    nerve: ps[ST.nerve] ?? 0,
    heavy: (ps[ST.heavy] ?? 0) >= 1,
    lightningRod: rt.flags.has('lightningRod'),
    target: {
      hp: e.hp,
      guard: e.guard,
      faces: e.faces,
      faceIndex: e.faceIndex,
      fleeting: e.fleeting,
      understood: !isNumbRules(e) && (e.statuses[ST.understood] ?? 0) >= 1,
      veiled: isVeiled(e),
    },
    label: sourceLabel(rt, ctx),
  };
}

/** The 'hit' effect: times x (one target, or every targetable Shade left to right). */
export function hitEffect(rt: Rt, eff: Extract<Effect, { op: 'hit' }>, ctx: EffectCtx): void {
  const times = eff.times === undefined ? 1 : Math.max(0, evalAmount(rt, eff.times, ctx));
  for (let i = 0; i < times; i++) {
    if (eff.to === 'all') {
      const uids = rt.c.enemies.filter((e) => !isVeiled(e)).map((e) => e.uid);
      for (const uid of uids) {
        const e = findEnemy(rt, uid);
        if (e) hitOne(rt, e, eff.amount, ctx);
      }
      continue;
    }
    // Card hits on a Shade that is already gone fizzle; automatic hits fall back (R-13, R-14).
    const e = ctx.fromCard ? findEnemy(rt, ctx.targetUid) : autoTarget(rt, ctx.targetUid);
    if (!e) return;
    hitOne(rt, e, eff.amount, ctx);
  }
}

function hitOne(rt: Rt, e: EnemyState, amount: Amount, ctx: EffectCtx): void {
  const amountCtx = ctx.targetUid === e.uid ? ctx : { ...ctx, targetUid: e.uid };
  performHit(rt, e, evalAmount(rt, amount, amountCtx), ctx);
}

/** One pass through the damage pipeline, then side effects or the lethal outcome. */
export function performHit(rt: Rt, e: EnemyState, base: number, ctx: EffectCtx): HitBreakdown {
  const spec = hitSpecFor(rt, e, base, ctx);
  const understoodUsed = spec.fromCard && spec.target.understood;
  const b = computeHit(spec, rt.rules);
  applyHit(rt, sourceRef(ctx), e, b);
  if (ctx.fromCard) {
    const s = rt.c.stats.dmgByRelation;
    s[b.relation] = (s[b.relation] ?? 0) + b.damage;
    if (rt.play && ctx.source === 'card' && !rt.play.hit.includes(e.uid)) rt.play.hit.push(e.uid);
  }
  if (b.outcome !== null && b.outcome !== 'wavering') {
    resolveLethal(rt, e, b, ctx);
    return b;
  }
  sideEffects(rt, e, b, ctx, understoodUsed);
  return b;
}

/** 5.4 step 8 (non-lethal hits, and Wavering). */
function sideEffects(rt: Rt, e: EnemyState, b: HitBreakdown, ctx: EffectCtx, understoodUsed: boolean): void {
  if (b.outcome === 'wavering') {
    if ((e.statuses[ST.wavering] ?? 0) === 0) giveStatus(rt, e, ST.wavering, 1);
    emit(rt, { e: 'wavering', enemy: e.uid });
  }
  if (!isNumbRules(e)) {
    if (b.relation === 'dissonant' && ctx.fromCard) giveStatus(rt, e, ST.flare, rt.rules.dissonanceFlare);
    if (b.relation === 'opposite') {
      if ((e.statuses[ST.flare] ?? 0) > 0) giveStatus(rt, e, ST.flare, -rt.rules.oppositeFlareRemove);
      turnFace(rt, e, 'hit');
    }
  }
  if (understoodUsed) setStatusOn(rt, e, ST.understood, 0);
  if (ctx.fromCard && (e.statuses[ST.wavering] ?? 0) > 0) setStatusOn(rt, e, ST.wavering, 0);
  firePassives(rt, e, 'hitTaken', { lights: b.lights.slice(), fromCard: ctx.fromCard, relation: b.relation });
  checkThresholds(rt, e);
  checkPhases(rt, e);
  refreshIntent(rt, e);
}

function resolveBonus(rt: Rt, e: EnemyState): number {
  if (e.fleeting || e.surfacedFrom !== null) return 0;
  const tier = enemyDef(rt, e).tier;
  const g = rt.rules.glimmersResolve;
  if (tier === 'normal') return g.normal;
  if (tier === 'elite') return g.elite;
  if (tier === 'boss') return g.boss;
  if (tier === 'final') return g.final;
  return 0;
}

function afterglowCtx(rt: Rt): EffectCtx {
  return { source: 'afterglow', sourceUid: 0, targetUid: rt.c.lastTarget, lights: [], harmonized: false, fromCard: false };
}

function recordGone(rt: Rt, e: EnemyState, outcome: LethalOutcome): void {
  rt.c.gone.push({ uid: e.uid, defId: e.defId, outcome, face: showing(e) });
}

function resolveLethal(rt: Rt, e: EnemyState, b: HitBreakdown, ctx: EffectCtx): void {
  const outcome = b.outcome!;
  const face = showing(e);
  recordGone(rt, e, outcome);
  if (outcome === 'fade') {
    removeEnemy(rt, e.uid, { e: 'faded', enemy: e.uid });
  } else if (outcome === 'resolve' || outcome === 'deepResolve') {
    const deep = outcome === 'deepResolve';
    const afterglows = face === null ? [] : deep ? [...e.faces] : [face];
    const glimmers = resolveBonus(rt, e);
    rt.c.glimmers += glimmers;
    if (deep) rt.c.stats.deepResolved += 1;
    else rt.c.stats.resolved += 1;
    removeEnemy(rt, e.uid, { e: 'resolved', enemy: e.uid, deep, by: b.lights.slice(), glimmers, afterglows });
    for (const sh of afterglows) {
      const ag = rt.pack.afterglows[sh];
      if (ag) enqueue(rt, { effects: ag.effects, ctx: afterglowCtx(rt) });
    }
    fireKeepsakes(rt, 'resolved');
    if (e.surfacedFrom !== null) surfacedResolved(rt, e);
  } else {
    ctx.suppressedTarget = true;
    if (rt.play && ctx.source === 'card' && ctx.sourceUid === rt.play.uid) rt.play.suppressed = true;
    rt.c.stats.suppressed += 1;
    let buried: typeof face = null;
    if (e.surfacedFrom === null && face !== null && !e.fleeting) {
      buried = face;
      rt.notes.buried[e.uid] = { shade: face, ...suppressConsequence(rt, face) };
      rt.c.mutations.push({ k: 'suppress', shade: face });
    }
    removeEnemy(rt, e.uid, { e: 'suppressed', enemy: e.uid, buried });
    if (e.surfacedFrom !== null) surfacedSuppressed(rt, e);
  }
  afterRemoval(rt, e);
}

function fadeQuietly(rt: Rt, e: EnemyState): void {
  recordGone(rt, e, 'fade');
  removeEnemy(rt, e.uid, { e: 'faded', enemy: e.uid });
}

/** R-8a summoner Fades, Veil lifting, shadeLeft passives, then the R-8b win check. */
function afterRemoval(rt: Rt, gone: EnemyState): void {
  if (gone.surfacedFrom !== null && !rt.c.enemies.some((x) => x.surfacedFrom !== null)) {
    for (const x of rt.c.enemies) if ((x.statuses[ST.veiled] ?? 0) > 0) setStatusOn(rt, x, ST.veiled, 0);
  }
  firePassivesAll(rt, 'shadeLeft');
  if (enemyDef(rt, gone).summoner) {
    for (const m of rt.c.enemies.slice()) {
      if (m.fleeting && m.summonerUid === gone.uid) {
        fadeQuietly(rt, m);
        firePassivesAll(rt, 'shadeLeft');
      }
    }
  }
  checkWin(rt);
}

/**
 * R-8b: if no non-Fleeting Shade remains, Fleeting Shades Fade and the combat is won immediately.
 * 4.18: the finishing hit's Afterglow and Keepsake `resolved` triggers run first, then `combatWon` hooks.
 */
export function checkWin(rt: Rt): void {
  if (rt.c.enemies.some((e) => !e.fleeting)) return;
  for (const m of rt.c.enemies.slice()) fadeQuietly(rt, m);
  drain(rt, true);
  fireKeepsakes(rt, 'combatWon');
  drain(rt, true);
  rt.c.outcome = 'won';
  tidyAtCombatEnd(rt);
  emit(rt, { e: 'combatEnd', outcome: 'won' });
  throw COMBAT_OVER;
}
