// Heart-0 check (5.5) with Paper Crane, and the combat-lost exit.

import { PAPER_CRANE_HEART } from '../constants';
import { emit, restorePlayerHpTo, tidyAtCombatEnd } from '../primitives';
import { COMBAT_OVER, type Rt } from './runtime';

/** Immediate: if Heart reached 0, Paper Crane (once per run) or the combat is lost. */
export function checkHeart(rt: Rt): void {
  if (rt.c.player.hp > 0) return;
  if (rt.flags.has('paperCrane') && !rt.c.paperCraneUsed) {
    rt.c.paperCraneUsed = true;
    const id = rt.run.keepsakes.find((k) => rt.pack.keepsakes[k.id]?.flags?.includes('paperCrane'))?.id;
    if (id) emit(rt, { e: 'keepsake', id });
    restorePlayerHpTo(rt, PAPER_CRANE_HEART);
    return;
  }
  loseCombat(rt, 'heart');
}

export function loseCombat(rt: Rt, cause: 'heart' | 'turnLimit'): never {
  rt.c.outcome = 'lost';
  rt.c.lossCause = cause;
  tidyAtCombatEnd(rt);
  emit(rt, { e: 'combatEnd', outcome: 'lost' });
  throw COMBAT_OVER;
}
