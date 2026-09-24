// Every Shade definition (DESIGN 7): 12 Act 1 (incl. 4 tutorial variants), 9 Act 2, 7 The Deep.

import type { EnemyDef } from '../../engine/types';
import { ACT1_ENEMIES } from './act1';
import { ACT2_ENEMIES } from './act2';
import { DEEP_ENEMIES } from './deep';
import { TUTORIAL_ENEMIES } from './tutorial';

export { ACT1_ENEMIES, ACT2_ENEMIES, DEEP_ENEMIES, TUTORIAL_ENEMIES };
export { intentsOf } from './move';

export const ALL_ENEMIES: EnemyDef[] = [...ACT1_ENEMIES, ...TUTORIAL_ENEMIES, ...ACT2_ENEMIES, ...DEEP_ENEMIES];
