// Queues the lasting-effect triggers: Keepsake hooks (9), Mood effects (6), Shade passives (7).
// Everything is queued FIFO and runs when the interpreter drains (after the current effect completes).

import { MEM_ONCE } from '../constants';
import { evalCond } from '../conditions';
import { enqueue } from '../interpreter';
import { emit } from '../primitives';
import type { EffectCtx, EnemyState, KeepsakeTrigger, MoodDef, PassiveTrigger, Uid } from '../types';
import { cardMoods } from './cards';
import { enemyCtx, enemyDef, type Rt, type Trigger } from './runtime';

export function keepsakeCtx(rt: Rt): EffectCtx {
  return { source: 'keepsake', sourceUid: 0, targetUid: rt.c.lastTarget, lights: [], harmonized: false, fromCard: false };
}

/** Fires every owned Keepsake's hook for a trigger, in acquisition order, honouring turn/combat limits. */
export function fireKeepsakes(rt: Rt, trigger: KeepsakeTrigger): void {
  for (const k of rt.run.keepsakes) {
    const hook = rt.pack.keepsakes[k.id]?.on?.[trigger];
    if (!hook) continue;
    if (hook.limit) {
      const key = `${k.id}:${trigger}`;
      if ((rt.c.keepsakeFired[key] ?? 0) >= 1) continue;
      rt.c.keepsakeFired[key] = (rt.c.keepsakeFired[key] ?? 0) + 1;
    }
    emit(rt, { e: 'keepsake', id: k.id });
    enqueue(rt, { effects: hook.effects, ctx: keepsakeCtx(rt) });
  }
}

/** Clears the counters of Keepsake hooks limited to once per turn (at your turn start). */
export function resetTurnKeepsakeLimits(rt: Rt): void {
  for (const key of Object.keys(rt.c.keepsakeFired)) {
    const sep = key.lastIndexOf(':');
    const id = key.slice(0, sep);
    const trigger = key.slice(sep + 1) as KeepsakeTrigger;
    if (rt.pack.keepsakes[id]?.on?.[trigger]?.limit === 'turn') delete rt.c.keepsakeFired[key];
  }
}

export function moodCtx(rt: Rt, uid: Uid): EffectCtx {
  const card = rt.c.cards[uid]!;
  const lights = rt.pack.cards[card.defId]?.lights ?? [];
  return { source: 'mood', sourceUid: uid, targetUid: rt.c.lastTarget, lights: [...lights], harmonized: false, fromCard: false };
}

/** Fires active Moods (moods pile, in the order they were played). */
export function fireMoods(rt: Rt, on: MoodDef['on']): void {
  for (const uid of rt.c.piles.moods) {
    const card = rt.c.cards[uid];
    if (!card) continue;
    const def = rt.pack.cards[card.defId];
    if (!def) continue;
    for (const md of cardMoods(def, card.upgraded)) {
      if (md.on !== on) continue;
      const ctx = moodCtx(rt, uid);
      if (md.oncePerEnemyPhase) {
        if (rt.c.moodFiredThisPhase.includes(uid)) continue;
        if (md.if && !evalCond(rt, md.if, ctx)) continue;
        rt.c.moodFiredThisPhase.push(uid);
        enqueue(rt, { effects: md.effects, ctx });
      } else {
        enqueue(rt, md.if ? { effects: md.effects, ctx, cond: md.if } : { effects: md.effects, ctx });
      }
    }
  }
}

/** Queues one Shade's passives for a trigger. `extra` carries the triggering hit/card (R-2b). */
export function firePassives(rt: Rt, e: EnemyState, on: PassiveTrigger, extra: Partial<EffectCtx> = {}): void {
  const passives = enemyDef(rt, e).passives;
  if (!passives) return;
  for (let i = 0; i < passives.length; i++) {
    const p = passives[i]!;
    if (p.on !== on || on === 'hpThreshold') continue;
    const t: Trigger = { effects: p.effects, ctx: enemyCtx(e, extra), enemyUid: e.uid };
    if (p.if) t.cond = p.if;
    if (p.once) t.onceKey = `${MEM_ONCE}${i}`;
    enqueue(rt, t);
  }
}

/** Queues passives of every Shade on the field (position order), optionally skipping one. */
export function firePassivesAll(rt: Rt, on: PassiveTrigger, extra: Partial<EffectCtx> = {}, except?: Uid): void {
  for (const e of rt.c.enemies.slice()) if (e.uid !== except) firePassives(rt, e, on, extra);
}

/** hpThreshold passives: each threshold percent fires once, the first time Intensity is at or below it. */
export function checkThresholds(rt: Rt, e: EnemyState): void {
  const passives = enemyDef(rt, e).passives;
  if (!passives) return;
  const crossed: number[] = [];
  for (const p of passives) {
    if (p.on !== 'hpThreshold' || p.thresholdPct === undefined) continue;
    const pct = p.thresholdPct;
    if (e.thresholdsFired.includes(pct) || crossed.includes(pct)) continue;
    if (e.hp * 100 <= e.maxHp * pct) crossed.push(pct);
  }
  if (crossed.length === 0) return;
  for (let i = 0; i < passives.length; i++) {
    const p = passives[i]!;
    if (p.on !== 'hpThreshold' || p.thresholdPct === undefined || !crossed.includes(p.thresholdPct)) continue;
    const t: Trigger = { effects: p.effects, ctx: enemyCtx(e), enemyUid: e.uid };
    if (p.if) t.cond = p.if;
    enqueue(rt, t);
  }
  for (const pct of crossed) e.thresholdsFired.push(pct);
}
