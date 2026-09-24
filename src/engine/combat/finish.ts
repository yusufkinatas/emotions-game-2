// buildCombatResult (5.8, 12.1): the only way combat changes the run.

import type { CombatResult, CombatState, EngineCtx, KeepsakeId, RunState } from '../types';

/** 12.1 base Glimmers for the combat tier (event and tutorial fights pay as normal fights). */
export function baseGlimmers(ectx: EngineCtx, tier: CombatState['tier']): number {
  const g = ectx.rules.glimmersBase;
  if (tier === 'elite') return g.elite;
  if (tier === 'boss') return g.boss;
  if (tier === 'final') return g.final;
  return g.normal;
}

export function buildResult(c: CombatState, run: RunState, ectx: EngineCtx): CombatResult {
  if (!c.outcome) throw new Error('buildCombatResult: combat is not over');
  const won = c.outcome === 'won';
  const keepsakeCounters: Record<KeepsakeId, number> = {};
  if (c.paperCraneUsed && !run.paperCraneUsed) {
    for (const k of run.keepsakes) {
      if (ectx.pack.keepsakes[k.id]?.flags?.includes('paperCrane')) keepsakeCounters[k.id] = k.counter + 1;
    }
  }
  const named = c.gone.filter((g) => g.outcome !== 'fade');
  const allResolved = won && named.length > 0 && named.every((g) => g.outcome === 'resolve' || g.outcome === 'deepResolve');
  return {
    outcome: c.outcome,
    heartAfter: Math.max(0, c.player.hp),
    glimmers: won ? baseGlimmers(ectx, c.tier) + c.glimmers : 0,
    mutations: c.mutations.slice(),
    keepsakeCounters,
    paperCraneUsed: c.paperCraneUsed,
    allResolved,
    gone: c.gone.slice(),
    stats: {
      ...c.stats,
      playsByLight: { ...c.stats.playsByLight },
      playsByCard: { ...c.stats.playsByCard },
      dmgByRelation: { ...c.stats.dmgByRelation },
    },
  };
}
