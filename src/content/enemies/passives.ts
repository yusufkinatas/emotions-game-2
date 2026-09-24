// Passive shapes shared by several Shades.

import { and, has, mark, marked, not, shadeMend, unmark } from '../../engine/dsl';
import type { Cond, Effect, Light, PassiveDef } from '../../engine/types';

/**
 * "The first time it is the only Shade on the field (checked at combat start and whenever a Shade leaves)"
 * (Echo's Last One Left, Wallflower's Cornered). The mark makes the two triggers fire once in total.
 */
export function firstTimeAlone(name: string, key: string, text: string, effects: Effect[]): PassiveDef[] {
  const cond: Cond = and({ c: 'onlyShade' }, not(marked(key)));
  const then = [...effects, mark(key)];
  return [
    { name, on: 'combatStart', if: cond, effects: then, text },
    { name, on: 'shadeLeft', if: cond, effects: then },
  ];
}

/**
 * Wallow (Mope, Longing): after its action it restores 5 Intensity unless a hit carrying one of `lights`
 * (card or automatic) landed on it since its previous action.
 */
export function wallow(lights: Light[], text: string): PassiveDef[] {
  return [
    { name: 'Wallow', on: 'hitTaken', if: has(...lights), effects: [mark('soothed')], text },
    { name: 'Wallow', on: 'afterOwnAction', if: not(marked('soothed')), effects: [shadeMend(5)] },
    { name: 'Wallow', on: 'afterOwnAction', effects: [unmark('soothed')] },
  ];
}

/** A named passive whose mechanic comes from an EnemyDef flag or pattern: carries the chip name and tooltip only. */
export const displayOnly = (name: string, text: string): PassiveDef => ({ name, on: 'combatStart', effects: [], text });
