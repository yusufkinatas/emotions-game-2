// Display names for wheel ids, used by labels, tooltips and aria text across the kit.
// Glossary words for game text live in src/content/glossary.ts; these are only the emotion names.

import type { AfflictionId, Blend, Light, Shade } from '../../engine/emotions';

export const LIGHT_NAME: Record<Light, string> = {
  love: 'Love',
  joy: 'Joy',
  friendship: 'Friendship',
  courage: 'Courage',
  hope: 'Hope',
  calm: 'Calm',
};

export const SHADE_NAME: Record<Shade, string> = {
  anger: 'Anger',
  sadness: 'Sadness',
  loneliness: 'Loneliness',
  fear: 'Fear',
  despair: 'Despair',
  anxiety: 'Anxiety',
};

export const BLEND_NAME: Record<Blend, string> = {
  delight: 'Delight',
  playfulness: 'Playfulness',
  loyalty: 'Loyalty',
  determination: 'Determination',
  patience: 'Patience',
  compassion: 'Compassion',
};

export const AFFLICTION_NAME: Record<AfflictionId | 'numb', string> = {
  seething: 'Seething',
  heavy: 'Heavy',
  isolated: 'Isolated',
  trembling: 'Trembling',
  hollow: 'Hollow',
  restless: 'Restless',
  numb: 'Numb',
};

/** Hex values of both palettes (16.0), for places that cannot read CSS variables (canvas, tests). */
export const LIGHT_HEX: Record<'default' | 'cb', Record<Light, string>> = {
  default: {
    love: '#FF5C8A',
    joy: '#FFD23F',
    friendship: '#3DDC84',
    courage: '#FF8C42',
    hope: '#B18CFF',
    calm: '#4CC9F0',
  },
  cb: {
    love: '#CC79A7',
    joy: '#F0E442',
    friendship: '#009E73',
    courage: '#E69F00',
    hope: '#0072B2',
    calm: '#56B4E9',
  },
};

/** CSS variable holding a Light's colour in the active palette. */
export const lightVar = (l: Light): string => `var(--${l})`;
