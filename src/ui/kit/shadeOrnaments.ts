// Ornaments that give elites and bosses presence (DESIGN 16.7 plus the art review): The Kettle's lid and
// steam, The Knot's cinched knot, The Spiral's coils (they track its Coil gauge), The Looming's tall
// shadow, The Mask's crown of faces, Apathy's puddle and The Numbness's veil. The contract has
// no ornament field, so the kit maps enemy ids itself (ORNAMENT_OF).

import type { Shade } from '../../engine/emotions';
import type { EnemyId } from '../../engine/types';
import type { Rand } from './hash';
import type { Parts } from './shadeFamilies';
import { CX, GROUND } from './shadeGeometry';
import { sigilBody } from './sigils';
import { n, polar } from './svg';

export type ShadeOrnament = 'kettle' | 'knot' | 'spiral' | 'looming' | 'mask' | 'apathy' | 'numbness';

/** Enemy ids that wear an ornament. Screens pass `ornament: ornamentFor(def.id)`. */
export const ORNAMENT_OF: Readonly<Record<EnemyId, ShadeOrnament>> = {
  'shade.kettle': 'kettle',
  'shade.knot': 'knot',
  'shade.spiral': 'spiral',
  'shade.looming': 'looming',
  'shade.mask': 'mask',
  'shade.apathy': 'apathy',
  'shade.numbness': 'numbness',
};

export function ornamentFor(enemyId: EnemyId): ShadeOrnament | null {
  return Object.prototype.hasOwnProperty.call(ORNAMENT_OF, enemyId) ? ORNAMENT_OF[enemyId]! : null;
}

/** The most Coil rings The Spiral shows (its gauge max, 7.2). */
export const MAX_COILS = 6;

/** The most veil layers The Numbness shows (one per Surfaced Shade standing, 4.16). */
export const MAX_VEIL = 3;

/** The Mask's faces in content order (EnemyDef.faces of shade.mask), used when none are passed. */
export const MASK_FACES: readonly Shade[] = ['anger', 'sadness', 'loneliness', 'fear'];

export interface OrnamentLayers {
  /** Outside the idle group, behind everything (The Looming's shadow, ripples, the pit spiral). */
  staticBack?: string;
  /** Inside the idle group, over the body (lid, knot, coils, The Mask's crown). */
  front?: string;
  /** Outside the idle group, over everything (The Numbness's veil). */
  staticFront?: string;
}

export interface OrnamentCtx {
  scale: number;
  /** The Mask: its faces for the halo. */
  faces?: readonly Shade[] | undefined;
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
  // A yarn knot tied on top of the head, two loops and two loose ends: the tangle cinched tight.
  const [x, y] = p.top;
  const lean = r.range(-6, 6);
  const loop = (dir: -1 | 1) =>
    `<path class="sa-orn__yarn" d="M${n(x)} ${n(y + 2)}c${n(dir * 6)} -16 ${n(dir * 24)} -14 ${n(dir * 20)} -2c${n(dir * -3)} 8 ${n(dir * -14)} 6 ${n(dir * -20)} 2"/>`;
  const tails =
    `<path class="sa-orn__yarn" d="M${n(x - 2)} ${n(y + 4)}q-10 8 -14 22M${n(x + 2)} ${n(y + 4)}q9 10 16 18"/>`;
  return {
    front:
      `<g class="sa-orn sa-knot" transform="rotate(${n(lean)} ${n(x)} ${n(y)})">` +
      tails +
      loop(-1) +
      loop(1) +
      `<circle class="sa-orn__ink" cx="${n(x)}" cy="${n(y + 2)}" r="6"/>` +
      `<path class="sa-orn__yarn sa-orn__yarn--thin" d="M${n(x - 4)} ${n(y)}q4 3 8 0M${n(x - 4)} ${n(y + 4)}q4 3 8 0"/>` +
      `</g>`,
  };
}

function spiral(p: Parts): OrnamentLayers {
  const [x, y, hw] = p.waist;
  // Coil rings stacked up the body, bottom first; ring k shows while --coil >= k.
  let rings = '';
  for (let k = 1; k <= MAX_COILS; k++) {
    const ry = y + 28 - k * 7.5;
    const rx = hw + 11 - k * 1.1;
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

function looming(p: Parts, scale: number): OrnamentLayers {
  const [x] = p.top;
  const w = 86;
  // The body is scaled from the ground up; keep the shadow's top inside the frame at any scale.
  const top = GROUND - (GROUND - 6) / scale;
  const d = `M${n(x - w)} ${GROUND}C${n(x - w - 6)} ${n(GROUND - 90)} ${n(x - w * 0.8)} ${n(top + 30)} ${n(x)} ${n(top)}C${n(x + w * 0.8)} ${n(top + 30)} ${n(x + w + 6)} ${n(GROUND - 90)} ${n(x + w)} ${GROUND}Z`;
  return {
    staticBack:
      `<g class="sa-orn sa-looming">` +
      `<path class="sa-looming__shadow" d="${d}"/>` +
      `<ellipse class="sa-looming__eye" cx="${n(x - 22)}" cy="${n(top + 40)}" rx="8" ry="4.5"/>` +
      `<ellipse class="sa-looming__eye" cx="${n(x + 22)}" cy="${n(top + 40)}" rx="8" ry="4.5"/>` +
      `</g>`,
  };
}

// ------------------------------------------------------------------------------------------------
// The Mask: a crown of the faces it can turn to, the showing one lit and the next one dashed
// ------------------------------------------------------------------------------------------------

function mask(faces: readonly Shade[]): OrnamentLayers {
  const list = faces.length ? faces : MASK_FACES;
  const count = list.length;
  const discs = list
    .map((f, i) => {
      const a = count === 1 ? 0 : -50 + (100 * i) / (count - 1);
      const [x, y] = polar(CX, 100, 84, a);
      const s = 12;
      return (
        `<g class="sa-halo__face sa-halo__face--${f}" data-face="${f}">` +
        `<circle class="sa-halo__disc" cx="${n(x)}" cy="${n(y)}" r="10"/>` +
        `<g class="sa-halo__sigil" transform="translate(${n(x - s / 2)} ${n(y - s / 2)}) scale(${n(s / 24)})">${sigilBody(f)}</g>` +
        `</g>`
      );
    })
    .join('');
  return { front: `<g class="sa-orn sa-halo">${discs}</g>` };
}

// ------------------------------------------------------------------------------------------------
// Apathy: it has let itself melt into a flat grey puddle, and heaves a long flat sigh
// ------------------------------------------------------------------------------------------------

function apathy(p: Parts, r: Rand): OrnamentLayers {
  const [x, , hw] = p.waist;
  const [tx, ty] = p.top;
  const puddle =
    `<ellipse class="sa-puddle" cx="${n(x)}" cy="${GROUND - 1}" rx="${n(hw + 30)}" ry="8"/>` +
    `<ellipse class="sa-puddle__melt" cx="${n(x + r.jitter(4))}" cy="${GROUND - 2}" rx="${n(hw + 12)}" ry="6"/>`;
  // The sigh: three flat dashes drifting up and away, each fainter than the last.
  const sigh = [0, 1, 2]
    .map((k) => {
      const sx = tx + 34 + k * 11;
      const sy = ty - 4 - k * 11;
      return `<path class="sa-sigh" style="opacity:${n(0.7 - k * 0.2)}" d="M${n(sx - 6 + k)} ${n(sy)}H${n(sx + 6 - k)}"/>`;
    })
    .join('');
  return { staticBack: puddle, staticFront: `<g class="sa-orn sa-sighs">${sigh}</g>` };
}

// ------------------------------------------------------------------------------------------------
// The Numbness: a grey veil that thickens with each Surfaced Shade (--veil), and still-water ripples
// ------------------------------------------------------------------------------------------------

function numbness(p: Parts): OrnamentLayers {
  const [x, y, hw] = p.waist;
  const top = p.top[1] - 8;
  const w = hw + 8;
  // A shroud laid over the oval: it follows the shoulders, then falls straight and pools in a soft hem.
  const hem = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((t) => x + t * (w + 14));
  let d = `M${n(x)} ${n(top)}C${n(x + w * 0.66)} ${n(top)} ${n(x + w)} ${n(top + (y - top) * 0.5)} ${n(x + w)} ${n(y)}`;
  d += `C${n(x + w)} ${n(y + 44)} ${n(x + w + 8)} ${n(GROUND - 20)} ${n(hem[5]!)} ${GROUND - 2}`;
  for (let k = 4; k >= 0; k--) d += `Q${n((hem[k]! + hem[k + 1]!) / 2)} ${GROUND - 9} ${n(hem[k]!)} ${GROUND - 2}`;
  d += `C${n(x - w - 8)} ${n(GROUND - 20)} ${n(x - w)} ${n(y + 44)} ${n(x - w)} ${n(y)}`;
  d += `C${n(x - w)} ${n(top + (y - top) * 0.5)} ${n(x - w * 0.66)} ${n(top)} ${n(x)} ${n(top)}Z`;
  const folds = [-0.55, -0.15, 0.3, 0.7]
    .map((t) => `M${n(x + t * w)} ${n(y - 10 + Math.abs(t) * 20)}C${n(x + t * w * 1.05)} ${n(y + 40)} ${n(x + t * (w + 10))} ${n(GROUND - 30)} ${n(x + t * (w + 14))} ${GROUND - 6}`)
    .join('');
  const layers = [0, 1, 2]
    .map(
      (k) =>
        `<g class="sa-veil__layer" style="opacity:clamp(0, calc(var(--veil) - ${k}), 1)" transform="translate(${n(k * 2.5 - 2.5)} ${-k * 3})">` +
        `<path class="sa-veil__cloth" d="${d}"/><path class="sa-veil__fold" d="${folds}"/></g>`,
    )
    .join('');
  const ripples = [0, 1, 2]
    .map((k) => `<ellipse class="sa-ripple" cx="${n(x)}" cy="${GROUND - 1}" rx="${n(w + 30)}" ry="9" style="animation-delay:${n(-k * 1.4)}s;transform-origin:${n(x)}px ${GROUND - 1}px"/>`)
    .join('');
  return {
    staticBack: `<g class="sa-orn sa-ripples">${ripples}</g>`,
    staticFront: `<g class="sa-orn sa-veil">${layers}</g>`,
  };
}

export function ornamentLayers(kind: ShadeOrnament, parts: Parts, r: Rand, ctx: OrnamentCtx = { scale: 1 }): OrnamentLayers {
  switch (kind) {
    case 'kettle':
      return kettle(parts, r);
    case 'knot':
      return knot(parts, r);
    case 'spiral':
      return spiral(parts);
    case 'looming':
      return looming(parts, ctx.scale);
    case 'mask':
      return mask(ctx.faces ?? MASK_FACES);
    case 'apathy':
      return apathy(parts, r);
    case 'numbness':
      return numbness(parts);
  }
}
