// The Deep (DESIGN 7.3): The Numbness and the six Surfaced Shades.
// Surfaced Intensity is 12 x Weight (rules.surfacedHpPerWeight, x1.5 with Lead Box), set by the engine at
// Surfacing; their `hp` below is only the Weight 1 to 3 range for the Codex.

import { afflict, shadeGuard, strike } from '../../engine/dsl';
import type { EnemyDef, MoveDef, Shade } from '../../engine/types';
import { SHADE_LINES } from '../lines';
import { move } from './move';
import { displayOnly } from './passives';

function surfaced(face: Shade, name: string, first: [string, MoveDef], second: [string, MoveDef]): EnemyDef {
  const id = `shade.surfaced_${face}`;
  return {
    id,
    name,
    faces: [face],
    hp: [12, 36],
    tier: 'surfaced',
    moves: { [first[0]]: first[1], [second[0]]: second[1] },
    pattern: { kind: 'cycle', moves: [first[0], second[0]] },
    lines: SHADE_LINES[id]!,
    visual: { family: face, scale: 0.85 },
    blurb: 'A Buried card risen as a Shade. Resolve it and it becomes Insight.',
  };
}

export const DEEP_ENEMIES: EnemyDef[] = [
  {
    id: 'shade.numbness',
    name: 'The Numbness',
    faces: [],
    hp: [396, 396],
    tier: 'final',
    numbRules: { surface: 3, hpPerHiddenWeight: 6 },
    moves: {
      static: move('Static', strike(19)),
      fog: move('Fog', shadeGuard(14), afflict('numb', 1)),
      nothing_much: move('Nothing Much', strike(13), afflict('heavy', 1), afflict('hollow', 1)),
      flatline: move('Flatline', strike(29)),
      fog2: move('Fog', shadeGuard(14), afflict('numb', 2)),
      static_storm: move('Static Storm', strike(6, 4)),
    },
    pattern: {
      kind: 'phases',
      phases: [
        { atOrBelowPct: 100, pattern: { kind: 'cycle', moves: ['static', 'fog', 'nothing_much'] } },
        { atOrBelowPct: 50, pattern: { kind: 'cycle', moves: ['flatline', 'fog2', 'static_storm'] } },
      ],
    },
    passives: [
      displayOnly('Muffled', 'One Light is MUFFLED (x1/2). Two Lights at once are FELT (x2). It has no face to Understand.'),
      displayOnly(
        'Surfacing',
        'Your 3 heaviest Buried cards rise first as Shades and Veil it. Every other Weight you carry adds 6 Intensity. Suppress a Surfaced Shade and it grows.',
      ),
      // The switch itself is the phases pattern (atOrBelowPct 50).
      displayOnly('Thaw', 'The first time it is at half Intensity or less, it wakes into its second phase.'),
    ],
    lines: SHADE_LINES['shade.numbness']!,
    visual: { family: 'numb', scale: 1.6 },
    blurb: 'Where every feeling you never tended went to sleep. One feeling is not enough here.',
  },
  surfaced(
    'anger',
    'Surfaced Anger',
    ['flare_up', move('Flare Up', strike(8))],
    ['smolder', move('Smolder', strike(5), afflict('seething', 2))],
  ),
  surfaced(
    'sadness',
    'Surfaced Sadness',
    ['sigh', move('Sigh', strike(6), afflict('heavy', 1))],
    ['curl_up', move('Curl Up', shadeGuard(8))],
  ),
  surfaced(
    'loneliness',
    'Surfaced Loneliness',
    ['call_out', move('Call Out', strike(6))],
    ['cold_shoulder', move('Cold Shoulder', strike(4), afflict('isolated', 2))],
  ),
  surfaced(
    'fear',
    'Surfaced Fear',
    ['lunge', move('Lunge', strike(9))],
    ['shiver', move('Shiver', strike(4), afflict('trembling', 2))],
  ),
  surfaced(
    'despair',
    'Surfaced Despair',
    ['sigh_deeply', move('Sigh Deeply', strike(7), afflict('hollow', 1))],
    ['sink', move('Sink', shadeGuard(10))],
  ),
  surfaced(
    'anxiety',
    'Surfaced Anxiety',
    ['flurry', move('Flurry', strike(3, 3))],
    ['fidget', move('Fidget', afflict('restless', 2), shadeGuard(6))],
  ),
];
