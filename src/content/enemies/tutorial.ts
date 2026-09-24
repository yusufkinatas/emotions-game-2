// Tutorial variants (DESIGN 7.1): used only by enc.t1 to enc.t4, no passives, pattern offset 0.

import { afflict, shadeGuard, strike } from '../../engine/dsl';
import type { EnemyDef } from '../../engine/types';
import { SHADE_LINES } from '../lines';
import { move } from './move';

export const TUTORIAL_ENEMIES: EnemyDef[] = [
  {
    id: 'shade.tut_grumble',
    name: 'Little Grumble',
    faces: ['anger'],
    hp: [18, 18],
    tier: 'normal',
    moves: {
      snap5: move('Snap', strike(5)),
      snap6: move('Snap', strike(6)),
      snap7: move('Snap', strike(7)),
    },
    pattern: { kind: 'cycle', moves: ['snap5', 'snap6', 'snap7'] },
    lines: SHADE_LINES['shade.tut_grumble']!,
    visual: { family: 'anger', scale: 0.75 },
    blurb: 'A very small Grumble. It snaps a little harder each time.',
  },
  {
    id: 'shade.tut_mope',
    name: 'Little Mope',
    faces: ['sadness'],
    hp: [22, 22],
    tier: 'normal',
    moves: {
      sigh: move('Sigh', strike(5)),
      curl_up: move('Curl Up', shadeGuard(6)),
      drizzle: move('Drizzle', strike(2, 2)),
    },
    pattern: { kind: 'cycle', moves: ['sigh', 'curl_up', 'drizzle'] },
    lines: SHADE_LINES['shade.tut_mope']!,
    visual: { family: 'sadness', scale: 0.75 },
    blurb: 'A very small Mope under a very small cloud.',
  },
  {
    id: 'shade.tut_echo',
    name: 'Little Echo',
    faces: ['loneliness'],
    hp: [24, 24],
    tier: 'normal',
    moves: {
      call_out: move('Call Out', strike(5)),
      drift: move('Drift', shadeGuard(6)),
    },
    pattern: { kind: 'cycle', moves: ['call_out', 'drift'] },
    lines: SHADE_LINES['shade.tut_echo']!,
    visual: { family: 'loneliness', scale: 0.75 },
    blurb: 'A very small Echo, calling out to anyone at all.',
  },
  {
    id: 'shade.tut_skitter',
    name: 'Little Skitter',
    faces: ['fear'],
    hp: [24, 24],
    tier: 'normal',
    moves: {
      shiver: move('Shiver', strike(4), afflict('trembling', 2)),
      lunge: move('Lunge', strike(7)),
    },
    pattern: { kind: 'cycle', moves: ['shiver', 'lunge'] },
    lines: SHADE_LINES['shade.tut_skitter']!,
    visual: { family: 'fear', scale: 0.7 },
    blurb: 'A very small Skitter. It startles at its own shadow.',
  },
];
