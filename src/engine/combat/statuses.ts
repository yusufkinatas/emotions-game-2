// Status rules on top of the raw primitives: Yellow Umbrella (9.3), "can't be Understood" (4.12),
// Ember Lantern's shadeGainedFlare trigger (9.3).

import { ST } from '../constants';
import { AFFLICTIONS } from '../emotions';
import { addStatus, emit, setStatusValue, type StatusOwner } from '../primitives';
import type { StatusId } from '../types';
import { isNumbRules, type Rt } from './runtime';
import { fireKeepsakes } from './triggers';

export function isAffliction(rt: Rt, id: StatusId): boolean {
  const def = rt.pack.statuses[id];
  if (def) return def.affliction !== undefined;
  return id === ST.numb || (AFFLICTIONS as readonly string[]).includes(id);
}

/** Umbrella: the first time each combat you would gain affliction stacks, gain none. */
function umbrellaBlocks(rt: Rt, id: StatusId, delta: number): boolean {
  if (delta <= 0 || !isAffliction(rt, id) || !rt.flags.has('umbrella') || rt.c.umbrellaUsed) return false;
  rt.c.umbrellaUsed = true;
  emit(rt, { e: 'afflictBlocked', id });
  return true;
}

function blockedOnShade(owner: StatusOwner, id: StatusId): boolean {
  return owner !== 'player' && id === ST.understood && isNumbRules(owner);
}

/** Adds stacks with every rule that cares about status gains. Returns the actual change. */
export function giveStatus(rt: Rt, owner: StatusOwner, id: StatusId, delta: number): number {
  if (delta === 0) return 0;
  if (owner === 'player') {
    if (umbrellaBlocks(rt, id, delta)) return 0;
    return addStatus(rt, 'player', id, delta);
  }
  if (blockedOnShade(owner, id)) return 0;
  const d = addStatus(rt, owner, id, delta);
  if (id === ST.flare && d > 0) fireKeepsakes(rt, 'shadeGainedFlare');
  return d;
}

export function setStatusOn(rt: Rt, owner: StatusOwner, id: StatusId, n: number): number {
  const before = owner === 'player' ? (rt.c.player.statuses[id] ?? 0) : (owner.statuses[id] ?? 0);
  if (owner === 'player') {
    if (umbrellaBlocks(rt, id, n - before)) return 0;
    return setStatusValue(rt, 'player', id, n);
  }
  if (blockedOnShade(owner, id)) return 0;
  const d = setStatusValue(rt, owner, id, n);
  if (id === ST.flare && d > 0) fireKeepsakes(rt, 'shadeGainedFlare');
  return d;
}
