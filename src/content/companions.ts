// Companions (DESIGN 4.13, 6.12). Friendship-typed automatic hits aimed at your last target, at the end of your turn.

import { ease, guard } from '../engine/dsl';
import type { CompanionDef } from '../engine/types';

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'comp.lantern_moth',
    name: 'Lantern Moth',
    lights: ['friendship'],
    act: [ease(3)],
    text: 'At the end of your turn: Ease 3 to your last target.',
  },
  {
    id: 'comp.burrow_hare',
    name: 'Burrow Hare',
    lights: ['friendship'],
    act: [guard(3)],
    text: 'At the end of your turn: you gain 3 Guard.',
  },
  {
    id: 'comp.old_dog',
    name: 'Old Dog',
    lights: ['friendship'],
    act: [ease(6)],
    text: 'At the end of your turn: Ease 6 to your last target.',
  },
];
