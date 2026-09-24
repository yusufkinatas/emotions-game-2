// Encounters and row pools (DESIGN 8). Members spawn left to right; `hp` overrides the Shade's own range.

import type { ContentPack, EncounterDef } from '../engine/types';

const one = (id: string, enemy: string): EncounterDef => ({ id, members: [{ enemy }] });

export const ENCOUNTERS: EncounterDef[] = [
  // Tutorial (every member starts at pattern offset 0).
  one('enc.t1', 'shade.tut_grumble'),
  one('enc.t2', 'shade.tut_mope'),
  { id: 'enc.t3', members: [{ enemy: 'shade.tut_echo' }, { enemy: 'shade.tut_mope', hp: [14, 14] }] },
  { id: 'enc.t4', members: [{ enemy: 'shade.tut_skitter' }, { enemy: 'shade.grumble', hp: [28, 30] }] },

  // Act 1: The Shallows.
  one('enc.a1.grumble', 'shade.grumble'),
  one('enc.a1.mope', 'shade.mope'),
  one('enc.a1.skitter', 'shade.skitter'),
  { id: 'enc.a1.grumble_echo', members: [{ enemy: 'shade.grumble' }, { enemy: 'shade.echo' }] },
  { id: 'enc.a1.mope_skitter', members: [{ enemy: 'shade.mope', hp: [48, 53] }, { enemy: 'shade.skitter' }] },
  {
    id: 'enc.a1.two_grumbles',
    members: [
      { enemy: 'shade.grumble', hp: [31, 36] },
      { enemy: 'shade.grumble', hp: [31, 36] },
    ],
  },
  { id: 'enc.a1.echo_mope', members: [{ enemy: 'shade.echo' }, { enemy: 'shade.mope', hp: [48, 53] }] },
  {
    id: 'enc.a1.two_skitters',
    members: [
      { enemy: 'shade.skitter', hp: [26, 31] },
      { enemy: 'shade.skitter', hp: [26, 31] },
    ],
  },
  one('enc.a1.echo', 'shade.echo'),
  one('enc.a1.looming', 'shade.looming'),
  one('enc.a1.kettle', 'shade.kettle'),
  one('enc.a1.mask', 'shade.mask'),

  // Act 2: The Undertow.
  one('enc.a2.fret', 'shade.fret'),
  one('enc.a2.slump', 'shade.slump'),
  one('enc.a2.old_grudge', 'shade.old_grudge'),
  one('enc.a2.longing', 'shade.longing'),
  one('enc.a2.dread', 'shade.dread'),
  {
    id: 'enc.a2.wallflower_grumble',
    members: [{ enemy: 'shade.grumble', hp: [48, 53] }, { enemy: 'shade.wallflower' }],
  },
  { id: 'enc.a2.wallflower_fret', members: [{ enemy: 'shade.fret', hp: [48, 53] }, { enemy: 'shade.wallflower' }] },
  {
    id: 'enc.a2.two_frets',
    members: [
      { enemy: 'shade.fret', hp: [45, 50] },
      { enemy: 'shade.fret', hp: [45, 50] },
    ],
  },
  { id: 'enc.a2.slump_echo', members: [{ enemy: 'shade.slump' }, { enemy: 'shade.echo', hp: [39, 45] }] },
  one('enc.a2.knot', 'shade.knot'),
  one('enc.a2.apathy', 'shade.apathy'),
  one('enc.a2.spiral', 'shade.spiral'),

  // The Deep (Surfaced Shades are added by Surfacing, 4.16).
  one('enc.deep.numbness', 'shade.numbness'),

  // Memory "The Wishing Well": pays base 10 + Resolve 8, counts as a win, no card reward.
  { id: 'enc.mem.echo', members: [{ enemy: 'shade.echo', hp: [38, 43] }] },
];

const A1_EARLY = ['enc.a1.grumble', 'enc.a1.mope', 'enc.a1.skitter'];

/**
 * Pools by row (8). Act 1: rows 1 to 3 draw from `early` (row3 repeats it explicitly), rows 4 and 6 to 8 from
 * `standard`. Act 2: rows 1 and 2 `early`, row 3 only the lone compounds (`row3`), rows 4 and 6 to 8 `standard`.
 * Elites: the map stream orders the pair (row 6 first, row 8 second, row 7 either).
 */
export const POOLS: ContentPack['pools'] = {
  act1: {
    early: A1_EARLY,
    row3: A1_EARLY,
    standard: [
      'enc.a1.grumble_echo',
      'enc.a1.mope_skitter',
      'enc.a1.two_grumbles',
      'enc.a1.echo_mope',
      'enc.a1.two_skitters',
      'enc.a1.echo',
    ],
    elite: ['enc.a1.looming', 'enc.a1.kettle'],
    boss: 'enc.a1.mask',
  },
  act2: {
    early: ['enc.a2.fret', 'enc.a2.slump'],
    row3: ['enc.a2.old_grudge', 'enc.a2.longing', 'enc.a2.dread'],
    standard: [
      'enc.a2.old_grudge',
      'enc.a2.longing',
      'enc.a2.dread',
      'enc.a2.wallflower_grumble',
      'enc.a2.wallflower_fret',
      'enc.a2.two_frets',
      'enc.a2.slump_echo',
    ],
    elite: ['enc.a2.knot', 'enc.a2.apathy'],
    boss: 'enc.a2.spiral',
  },
  deep: 'enc.deep.numbness',
  tutorial: ['enc.t1', 'enc.t2', 'enc.t3', 'enc.t4'],
};
