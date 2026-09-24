// Ornaments that give elites and bosses presence (DESIGN 16.7 plus the art review): The Kettle's lid and
// steam, The Knot's cinched knot, The Spiral's coils (they track its Coil gauge) and The Looming's tall
// shadow. The contract has no ornament field, so the kit maps enemy ids itself (ORNAMENT_OF).

import type { EnemyId } from '../../engine/types';
import type { Rand } from './hash';
import type { Parts } from './shadeFamilies';
import { GROUND } from './shadeGeometry';
import { n } from './svg';

export type ShadeOrnament = 'kettle' | 'knot' | 'spiral' | 'looming';

/** Enemy ids that wear an ornament. Screens pass `ornament: ornamentFor(def.id)`. */
export const ORNAMENT_OF: Readonly<Record<EnemyId, ShadeOrnament>> = {
  'shade.kettle': 'kettle',
  'shade.knot': 'knot',
  'shade.spiral': 'spiral',
  'shade.looming': 'looming',
};

export function ornamentFor(enemyId: EnemyId): ShadeOrnament | null {
  return Object.prototype.hasOwnProperty.call(ORNAMENT_OF, enemyId) ? ORNAMENT_OF[enemyId]! : null;
}

/** The most Coil rings The Spiral shows (its gauge max, 7.2). */
export const MAX_COILS = 6;

export interface OrnamentLayers {
  /** Outside the idle group, behind everything (The Looming's shadow). */
  staticBack?: string;
  /** Inside the idle group, over the body (lid, knot, coils). */
  front?: string;
}

function kettle(p: Parts, r: Rand): OrnamentLayers {
  const [x, y] = p.top;
  const tilt = r.range(-9, 9);
  const w = 26;
  const lid =
    `<g class="sa-orn sa-lidcap" transform="rotate(${n(tilt)} ${n(x)} ${n(y)})">` +
    `<path class="sa-orn__ink" d="M${n(x - w)} ${n(y)}Q${n(x - w + 2)} ${n(y - 14)} ${n(x)} ${n(y - 15)}Q${n(x + w - 2)} ${n(y - 14)} ${n(x + w)} ${n(y)}Z"/>` +
    `<path class="sa-orn__ink" d="M${n(x - w - 4)} ${n(y)}H${n(x + w + 4)}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle class="sa-orn__ink" cx="${n(x)}" cy="${n(y - 18)}" r="5"/>` +
    `</g>`;
  const steam = [-13, 1, 15]
    .map(
      (dx, i) =>
        `<path class="sa-steam" style="animation-delay:${n(-i * 0.55)}s;transform-origin:${n(x + dx)}px ${n(y - 22)}px" d="M${n(x + dx)} ${n(y - 22)}c-5 -6 5 -10 0 -16c-4 -5 4 -9 1 -14"/>`,
    )
    .join('');
  return { front: steam + lid };
}

function knot(p: Parts, r: Rand): OrnamentLayers {
  const [x, y, hw] = p.waist;
  const side = r.pick([-1, 1]);
  const kx = x + side * hw * 0.55;
  const band = `M${n(x - hw)} ${n(y - 3)}Q${n(x)} ${n(y + 9)} ${n(x + hw)} ${n(y - 3)}`;
  return {
    front:
      `<g class="sa-orn sa-knot">` +
      `<path class="sa-orn__band-rim" d="${band}"/><path class="sa-orn__band" d="${band}"/>` +
      `<path class="sa-orn__ink" d="M${n(kx)} ${n(y + 2)}c${n(side * -16)} -14 ${n(side * -22)} 4 ${n(side * -4)} 6z"/>` +
      `<path class="sa-orn__ink" d="M${n(kx)} ${n(y + 2)}c${n(side * 16)} -12 ${n(side * 22)} 6 ${n(side * 4)} 6z"/>` +
      `<path class="sa-orn__tail" d="M${n(kx - 2)} ${n(y + 6)}q${n(-side * 4)} 10 ${n(-side * 2)} 20M${n(kx + 2)} ${n(y + 6)}q${n(side * 5)} 9 ${n(side * 6)} 17"/>` +
      `<circle class="sa-orn__ink" cx="${n(kx)}" cy="${n(y + 3)}" r="5.2"/>` +
      `</g>`,
  };
}

function spiral(p: Parts): OrnamentLayers {
  const [x, y, hw] = p.waist;
  // Coil rings stacked up the body, bottom first; ring k shows while --coil >= k.
  let rings = '';
  for (let k = 1; k <= MAX_COILS; k++) {
    const ry = y + 26 - k * 11;
    const rx = hw + 10 - k * 1.2;
    const d = `M${n(x - rx)} ${n(ry)}A${n(rx)} ${n(5.5)} 0 0 0 ${n(x + rx)} ${n(ry)}`;
    rings += `<g class="sa-coil" style="opacity:clamp(0, calc(var(--coil) + 1 - ${k}), 1)"><path class="sa-orn__band-rim" d="${d}"/><path class="sa-orn__band" d="${d}"/></g>`;
  }
  // A spiral drawn into the pit floor, so The Spiral reads as one at a glance.
  let sp = '';
  const cy = GROUND - 14;
  for (let i = 0; i <= 44; i++) {
    const a = (i / 44) * Math.PI * 5.2;
    const rr = 2 + i * 1.15;
    sp += `${i === 0 ? 'M' : 'L'}${n(100 + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr * 0.24)}`;
  }
  return {
    staticBack: `<path class="sa-orn__pitspiral" d="${sp}"/>`,
    front: `<g class="sa-orn sa-coils">${rings}</g>`,
  };
}

function looming(p: Parts): OrnamentLayers {
  const [x] = p.top;
  const w = 86;
  const top = 2;
  const d = `M${n(x - w)} ${GROUND}C${n(x - w - 6)} ${n(GROUND - 90)} ${n(x - w * 0.8)} ${top + 30} ${n(x)} ${top}C${n(x + w * 0.8)} ${top + 30} ${n(x + w + 6)} ${n(GROUND - 90)} ${n(x + w)} ${GROUND}Z`;
  return {
    staticBack:
      `<g class="sa-orn sa-looming">` +
      `<path class="sa-looming__shadow" d="${d}"/>` +
      `<ellipse class="sa-looming__eye" cx="${n(x - 22)}" cy="${top + 42}" rx="8" ry="4.5"/>` +
      `<ellipse class="sa-looming__eye" cx="${n(x + 22)}" cy="${top + 42}" rx="8" ry="4.5"/>` +
      `</g>`,
  };
}

export function ornamentLayers(kind: ShadeOrnament, parts: Parts, r: Rand): OrnamentLayers {
  switch (kind) {
    case 'kettle':
      return kettle(parts, r);
    case 'knot':
      return knot(parts, r);
    case 'spiral':
      return spiral(parts);
    case 'looming':
      return looming(parts);
  }
}
