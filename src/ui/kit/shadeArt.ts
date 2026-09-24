// Procedural Shade silhouettes (DESIGN 16.7). One generator per family, varied only by a UI-side hash of
// a numeric seed (use the Shade's uid): height, spikes, eye and limb counts, sway timing and crack paths.
// Ink bodies with cracks glowing in the cure colour of the showing face. Cute-sad, never horror.
//
// All animation is CSS (kit-shade.css): idle per family, flare, hover flinch/swell, hit squash, resolve
// dissolve and suppress crush are classes or data attributes on the root <svg>, so screens can react
// without re-rendering. Geometry that depends on Flare (spikes, eyes, ring, pit) is drawn at render time.

import type { Light, Shade } from '../../engine/emotions';
import { cureOf } from '../../engine/emotions';
import { rand } from './hash';
import { SHADE_NAME } from './names';
import { GENERATORS } from './shadeFamilies';
import { CX, GROUND, cracks } from './shadeGeometry';
import { sigilBody } from './sigils';
import { attrs, cssLen, esc, n, svgElement, uniqueId } from './svg';

export type ShadeFamily = Shade | 'doubt' | 'mask' | 'numb';

export interface ShadeArtOpts {
  /** EnemyDef.visual.family. */
  family: ShadeFamily;
  /** Any number; use the Shade's uid. Same seed, same Shade. */
  seed: number;
  /** Showing face (drives crack colour). null for the numb family (Apathy, The Numbness). */
  face: Shade | null;
  /** Compounds: the inner face. Its sigil badge lights while it is the showing face. */
  innerFace?: Shade | null;
  /** The Mask: the next face, shown small on its forehead. */
  nextFace?: Shade | null;
  /** Flare stacks. The look grows up to 5 (5+ looks like 5). */
  flare?: number;
  /** Rendered height: number = px, string = CSS length. Default calc(var(--u) * 200). */
  size?: number | string;
  /** EnemyDef.visual.scale: shrinks or grows the body inside the fixed frame (0.45 to 1.15). */
  scale?: number;
  /** Numb family: lasting two-colour cracks left by FELT hits, oldest first. */
  feltCracks?: readonly (readonly [Light, Light])[];
  /** Numb family: Apathy's smaller, slouched oval. */
  slouched?: boolean;
  /** Anger heat shimmer (the one animated SVG filter). Pass false when 2+ Anger Shades are on screen. */
  shimmer?: boolean;
  /** Accessible name, e.g. "Grumble, Anger". Default: the family's face name. */
  label?: string;
  className?: string;
}

/** Reactions a screen can show on a rendered Shade (see setShadeReaction). */
export type ShadeReaction = 'flinch' | 'swell' | 'hit' | 'resolving' | 'deepResolving' | 'suppressed';

// ------------------------------------------------------------------------------------------------
// Resolved forms (the light each Shade becomes, 16.7), on the 24 grid in the Light's colour
// ------------------------------------------------------------------------------------------------

const MOTE: Record<Light, string> = {
  love: '<path d="M12 21C12 21 4.4 16.4 4.4 11.2C4.4 8.9 6.2 7.2 8.3 7.2C9.8 7.2 11.1 8 12 9.3C12.4 6.6 11 4.6 10 3C13.8 3.8 15.9 6 16.3 7.3C18.2 7.8 19.6 9.3 19.6 11.2C19.6 16.4 12 21 12 21Z"/>',
  joy: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="5.8" r="3.3"/><circle cx="17.9" cy="10.1" r="3.3"/><circle cx="15.6" cy="17" r="3.3"/><circle cx="8.4" cy="17" r="3.3"/><circle cx="6.1" cy="10.1" r="3.3"/>',
  friendship: '<circle cx="12" cy="14" r="4.2"/><ellipse cx="7.6" cy="8.6" rx="4" ry="2.6" opacity="0.55" transform="rotate(-30 7.6 8.6)"/><ellipse cx="16.4" cy="8.6" rx="4" ry="2.6" opacity="0.55" transform="rotate(30 16.4 8.6)"/>',
  courage: '<path d="M12 2.4C15.8 6.8 18 10.2 18 14.2A6 6 0 0 1 6 14.2C6 11.6 7.4 9.6 9 8C9 10.2 10 11.2 11 11.6C10.6 8.2 11.2 5.2 12 2.4Z"/>',
  hope: '<path d="M12 2.4C12.9 8.4 15.6 11.1 21.6 12C15.6 12.9 12.9 15.6 12 21.6C11.1 15.6 8.4 12.9 2.4 12C8.4 11.1 11.1 8.4 12 2.4Z"/>',
  calm: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.7"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/>',
};

/** The light form a Shade becomes when Resolved (reward tiles, outcome strip), as SVG markup. */
export function resolvedFormMarkup(light: Light, o: { size?: number | string; className?: string } = {}): string {
  const size = o.size === undefined ? null : cssLen(o.size);
  return `<svg${attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    class: `resolved-form ${o.className ?? ''}`.trim(),
    'data-light': light,
    style: size ? `width:${size};height:${size}` : null,
    'aria-hidden': 'true',
    focusable: 'false',
  })}><g fill="currentColor">${MOTE[light]}</g></svg>`;
}

// ------------------------------------------------------------------------------------------------
// Renderer
// ------------------------------------------------------------------------------------------------

const clampFlare = (f: number | undefined): number => Math.max(0, Math.min(5, Math.floor(f ?? 0)));

function badgeMarkup(inner: Shade): string {
  const cure = cureOf(inner);
  return (
    `<g class="sa-badge" style="--badge-c:var(--${cure})">` +
    `<circle class="sa-badge__disc" cx="166" cy="30" r="17"/>` +
    `<g class="sa-badge__sigil" transform="translate(154 18) scale(1)">${sigilBody(inner)}</g>` +
    `</g>`
  );
}

/** Shade silhouette markup (string). Use renderShade for an element. */
export function shadeMarkup(o: ShadeArtOpts): string {
  const r = rand(o.seed * 2654435761 + o.family.length);
  const flare = clampFlare(o.flare);
  const parts = GENERATORS[o.family]({ r, flare, opts: o });
  const id = uniqueId('sa');
  const scale = Math.max(0.45, Math.min(1.15, o.scale ?? 1));
  const face = o.family === 'numb' ? null : o.face;
  const showing = o.innerFace && face === o.innerFace ? 'inner' : 'outer';
  const idleDur = r.range(0.85, 1.15);
  const idleDelay = -r.range(0, 4);
  const [iox, ioy] = parts.idleOrigin ?? [CX, GROUND];
  const bodyPath = parts.body;
  const cr = parts.crack;
  const crackPaths = cr ? cracks(r, cr.x, cr.y, cr.spread, cr.count, cr.lo, cr.hi) : [];
  const crackLayer =
    crackPaths.length || parts.glow
      ? `<g class="sa-cracks" clip-path="url(#${id}c)">` +
        crackPaths.map((d) => `<path class="sa-crack__glow" d="${d}"/>`).join('') +
        crackPaths.map((d) => `<path class="sa-crack" d="${d}"/>`).join('') +
        crackPaths.map((d) => `<path class="sa-crack__core" d="${d}"/>`).join('') +
        `</g>` +
        (parts.glow ? `<g class="sa-cracks sa-cracks--free">${parts.glow}</g>` : '')
      : '';
  const heatOn = parts.heat && o.shimmer !== false;
  const heatDef = heatOn
    ? `<filter id="${id}h" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.07" numOctaves="1" seed="${o.seed % 97}"><animate attributeName="baseFrequency" dur="1.8s" values="0.018 0.07;0.024 0.09;0.018 0.07" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>`
    : '';
  const defs =
    `<defs>` +
    `<radialGradient id="${id}g" cx="42%" cy="30%" r="75%"><stop offset="0%" class="sa-stop-hi"/><stop offset="55%" class="sa-stop-mid"/><stop offset="100%" class="sa-stop-lo"/></radialGradient>` +
    `<clipPath id="${id}c"><path d="${bodyPath}"/></clipPath>` +
    `<clipPath id="${id}t"><rect x="0" y="0" width="200" height="${n(GROUND - 96)}"/></clipPath>` +
    `<clipPath id="${id}m"><ellipse cx="100" cy="94" rx="34" ry="43"/></clipPath>` +
    `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<radialGradient id="${id}l"><stop offset="0%" class="sa-bloom-stop"/><stop offset="100%" class="sa-bloom-stop" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="${id}r" cx="50%" cy="50%" r="50%"><stop offset="0%" class="sa-dissolve-hole"/><stop offset="70%" class="sa-dissolve-hole"/><stop offset="100%" class="sa-dissolve-edge"/></radialGradient>` +
    `<mask id="${id}d" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="250"><rect x="-20" y="-20" width="240" height="250" fill="white"/><circle class="sa-dissolve" cx="${n(parts.core[0])}" cy="${n(parts.core[1])}" r="150" fill="url(#${id}r)" style="transform-origin:${n(parts.core[0])}px ${n(parts.core[1])}px"/></mask>` +
    heatDef +
    `</defs>`;
  const fixIds = (s: string) =>
    s.replace(/url\(#HOODCLIP\)/g, `url(#${id}t)`).replace(/url\(#MASKCLIP\)/g, `url(#${id}m)`).replace(/url\(#BODYCLIP\)/g, `url(#${id}c)`);
  const flash = parts.flash ?? `<path class="sa-flash" d="${bodyPath}"/>`;
  const bodyLayers =
    `<path class="sa-aura" d="${bodyPath}" filter="url(#${id}b)"/>` +
    (parts.back ?? '') +
    `<path class="sa-ink" d="${bodyPath}" fill="url(#${id}g)"/>` +
    `<path class="sa-rim" d="${bodyPath}"/>` +
    crackLayer +
    fixIds(parts.front ?? '');
  const mote = face
    ? `<g transform="translate(${n(parts.core[0] - 14)} ${n(parts.core[1] - 14)}) scale(${n(28 / 24)})"><g class="sa-mote" style="color:var(--${cureOf(face)})"><g fill="currentColor">${MOTE[cureOf(face)]}</g></g></g>`
    : '';
  const mote2 =
    o.innerFace && face
      ? (() => {
          const other = face === o.innerFace ? o.family : o.innerFace;
          if (other === 'doubt' || other === 'mask' || other === 'numb' || other === face) return '';
          const l = cureOf(other);
          return `<g transform="translate(${n(parts.core[0] + 4)} ${n(parts.core[1] - 8)})"><g class="sa-mote sa-mote--second" style="color:var(--${l})"><g fill="currentColor">${MOTE[l]}</g></g></g>`;
        })()
      : '';
  const numbCracks = o.family === 'numb' ? (o.feltCracks?.length ?? 0) : 0;
  const height = cssLen(o.size ?? 'calc(var(--u) * 200)');
  const label = o.label ?? (face ? SHADE_NAME[face] : 'Numb');
  const rootAttrs = attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 200 210',
    class: ['shade-art', o.className ?? ''].filter(Boolean).join(' '),
    'data-family': o.family,
    'data-face': face ?? 'none',
    'data-inner': o.innerFace ?? null,
    'data-next': o.nextFace ?? null,
    'data-showing': o.innerFace ? showing : null,
    'data-flare': flare,
    'data-felt': numbCracks || null,
    'data-slouched': o.family === 'numb' && o.slouched ? 'true' : null,
    style: `--flare:${flare};--idle-rate:${n(idleDur)};--idle-delay:${n(idleDelay)}s;--dmask:url(#${id}d);height:${height};width:calc(${height} * 200 / 210)`,
    role: 'img',
    'aria-label': label,
  });
  const idleStyle = `transform-origin:${n(iox)}px ${n(ioy)}px`;
  const scaleT = scale === 1 ? '' : ` transform="translate(${CX} ${GROUND}) scale(${n(scale)}) translate(${-CX} ${-GROUND})"`;
  return (
    `<svg${rootAttrs}><title>${esc(label)}</title>${defs}` +
    `<ellipse class="sa-shadow" cx="${n(parts.core[0] === CX ? CX : (parts.core[0] + CX) / 2)}" cy="${GROUND + 3}" rx="${n(parts.shadow * scale)}" ry="${n(6 * scale + 1)}"/>` +
    `<g${scaleT}>` +
    `<g class="sa-react">` +
    `<g class="sa-flare">` +
    `<g class="sa-dissolver">` +
    (parts.staticBack ?? '') +
    `<g class="sa-idle" style="${idleStyle}">` +
    `<g class="sa-body"${heatOn ? ` style="filter:url(#${id}h)"` : ''}>${bodyLayers}</g>` +
    flash +
    `</g>` +
    fixIds(parts.staticFront ?? '') +
    `</g>` +
    `</g>` +
    `</g>` +
    `<g class="sa-bloom"><circle cx="${n(parts.core[0])}" cy="${n(parts.core[1])}" r="80" fill="url(#${id}l)" style="transform-origin:${n(parts.core[0])}px ${n(parts.core[1])}px"/></g>` +
    mote +
    mote2 +
    `<g class="sa-seal" style="transform-origin:${CX}px ${GROUND - 6}px"><ellipse cx="${CX}" cy="${GROUND - 6}" rx="30" ry="12"/><ellipse class="sa-seal__ring" cx="${CX}" cy="${GROUND - 6}" rx="20" ry="7"/></g>` +
    `</g>` +
    (o.innerFace ? badgeMarkup(o.innerFace) : '') +
    `</svg>`
  );
}

/** Shade silhouette element. See ShadeArtOpts. */
export function renderShade(o: ShadeArtOpts): SVGSVGElement {
  return svgElement(shadeMarkup(o));
}

/**
 * Turn a rendered Shade to another face without re-rendering: crack colour, the compound badge and The
 * Mask's crossfade all follow. For The Mask also pass the next face for its forehead.
 */
export function setShadeFace(svg: SVGSVGElement, face: Shade, nextFace?: Shade | null): void {
  svg.dataset.face = face;
  const inner = svg.dataset.inner;
  if (inner) svg.dataset.showing = inner === face ? 'inner' : 'outer';
  if (nextFace !== undefined) {
    if (nextFace) svg.dataset.next = nextFace;
    else delete svg.dataset.next;
  }
  svg.classList.remove('is-turning');
  void svg.getBoundingClientRect();
  svg.classList.add('is-turning');
}

/** Update the Flare level that CSS reads (growth, Mask cracks). Geometry-based looks need a re-render. */
export function setShadeFlare(svg: SVGSVGElement, flare: number): void {
  const f = clampFlare(flare);
  svg.dataset.flare = String(f);
  svg.style.setProperty('--flare', String(f));
}

const REACTION_CLASS: Record<ShadeReaction, string> = {
  flinch: 'is-flinch',
  swell: 'is-swell',
  hit: 'is-hit',
  resolving: 'is-resolving',
  deepResolving: 'is-resolving is-deep',
  suppressed: 'is-suppressed',
};

/**
 * Set or clear a reaction class. Hover reactions (flinch, swell) stay until cleared with null.
 * 'hit' restarts its animation each call. 'resolving' and 'suppressed' end hidden (the Shade has left).
 */
export function setShadeReaction(svg: SVGSVGElement, reaction: ShadeReaction | null): void {
  for (const c of ['is-flinch', 'is-swell', 'is-resolving', 'is-deep', 'is-suppressed']) svg.classList.remove(c);
  if (reaction === 'hit') {
    svg.classList.remove('is-hit');
    void svg.getBoundingClientRect();
    svg.classList.add('is-hit');
    return;
  }
  if (reaction) svg.classList.add(...REACTION_CLASS[reaction].split(' '));
}
