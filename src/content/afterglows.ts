// Afterglows (DESIGN 4.9): the gift a Resolved Shade leaves, keyed by the face that was Resolved.

import { draw, guard, mend, removeAfflictions, status } from '../engine/dsl';
import type { ContentPack } from '../engine/types';

export const AFTERGLOWS: ContentPack['afterglows'] = {
  anger: { name: 'Conviction', effects: [status('nerve', 1)], text: 'Gain 1 Nerve.' },
  sadness: { name: 'Release', effects: [mend(4)], text: 'Mend 4.' },
  loneliness: {
    name: 'Belonging',
    effects: [status('next_draw', 2)],
    text: 'At the start of your next turn, draw 2 more cards.',
  },
  fear: { name: 'Caution', effects: [guard(6)], text: 'Gain 6 Guard.' },
  despair: {
    name: 'Perspective',
    effects: [removeAfflictions(), draw(1)],
    text: 'Remove all your afflictions except Numb. Draw 1.',
  },
  anxiety: {
    name: 'Clarity',
    effects: [status('next_spirit', 1)],
    text: 'At the start of your next turn, gain 1 more Spirit.',
  },
};
