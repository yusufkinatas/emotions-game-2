// Companions (R-13): max 3, oldest leaves, act in summon order, never while Isolated.

import { ST } from '../constants';
import { runEffects } from '../interpreter';
import { addCompanion, emit, removeCompanion } from '../primitives';
import type { CompanionDef, EnemyState, Light, Uid } from '../types';
import { findEnemy, isVeiled, newUid, type Rt } from './runtime';
import { fireKeepsakes } from './triggers';

/**
 * Target of an automatic hit: the preferred Shade if it is present and not Veiled, else the leftmost
 * Shade that isn't Veiled (R-13, R-14). Shy Shades can be hit.
 */
export function autoTarget(rt: Rt, preferred: Uid | null): EnemyState | undefined {
  const p = findEnemy(rt, preferred);
  if (p && !isVeiled(p)) return p;
  return rt.c.enemies.find((e) => !isVeiled(e));
}

/** Friendship Bracelet: Companion hits carry the Note's Lights (Friendship if the Note is empty). */
export function companionLights(rt: Rt, def: CompanionDef): Light[] {
  if (rt.flags.has('companionsUseNote')) return rt.c.note.length > 0 ? [...rt.c.note] : ['friendship'];
  return [...def.lights];
}

export function isolated(rt: Rt): boolean {
  return (rt.c.player.statuses[ST.isolated] ?? 0) >= 1;
}

export function summonCompanion(rt: Rt, defId: string): void {
  if (!rt.pack.companions[defId]) throw new Error(`Unknown companion ${defId}`);
  while (rt.c.companions.length >= rt.rules.maxCompanions) removeCompanion(rt, rt.c.companions[0]!.uid);
  addCompanion(rt, newUid(rt), defId);
  fireKeepsakes(rt, 'summoned');
}

export function scatterCompanions(rt: Rt, n: number): void {
  for (let i = 0; i < n && rt.c.companions.length > 0; i++) removeCompanion(rt, rt.c.companions[0]!.uid);
}

/** Every Companion acts once, in summon order (5.6 step 2, or "your Companions act now"). */
export function companionsAct(rt: Rt): void {
  if (isolated(rt)) return;
  for (const comp of rt.c.companions.slice()) {
    if (!rt.c.companions.some((x) => x.uid === comp.uid)) continue;
    if (isolated(rt)) return;
    const def = rt.pack.companions[comp.defId];
    if (!def) continue;
    emit(rt, { e: 'companionAct', companion: comp.uid });
    const target = autoTarget(rt, rt.c.lastTarget);
    runEffects(rt, def.act, {
      source: 'companion',
      sourceUid: comp.uid,
      targetUid: target ? target.uid : null,
      lights: companionLights(rt, def),
      harmonized: false,
      fromCard: false,
    });
  }
}
