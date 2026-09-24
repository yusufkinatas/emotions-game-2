// The Compass HUD (DESIGN 16.2): a pure render of props, 200x200 reference, bottom-left of the combat screen.
// Ring of six Light segments clockwise from the top, Spirit orb in the centre, the Note highlighted with
// pulsing neighbours, outer Shade markers, DISSONANT arrows, Isolated fog and Act 2 segments locked.

import type { Light, Shade } from '../../engine/emotions';
import { LIGHTS, blendOf, dissonantShadeOf, lightIndex, shadeCuredBy } from '../../engine/emotions';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from './names';
import { markBody, sigilBody } from './sigils';
import { attrs, cssLen, esc, n, polar, toElement, uniqueId } from './svg';

export interface CompassProps {
  /** True once the player owns The Compass. False shows only the Spirit orb. */
  enabled: boolean;
  /** The Note: printed Lights of the last Light card played (0 to 2). */
  note: readonly Light[];
  harmoniesThisTurn: number;
  energy: number;
  maxEnergy: number;
  /** Hollow draws a crack across the orb. */
  hollow: boolean;
  /** Isolated lays grey fog over the ring. */
  isolated: boolean;
  /** False in Act 1: Hope and Calm are dark ("Awakens in Act 2"). */
  act2Unlocked: boolean;
  /** Lights the deck has cards of; others are dimmed. */
  ownedLights: readonly Light[];
  /** Showing faces of Shades in the fight; their outer markers light up. */
  activeShades: readonly Shade[];
  /** Blend edges to glow, e.g. a two-faced Shade in the fight ([Love, Joy] for Old Grudge). */
  glowEdges?: readonly (readonly [Light, Light])[];
  /** Draw the Harmony arc from the old Note Light to the new one (18.1, 250 ms). */
  harmonyArc?: readonly [Light, Light] | null;
  /** Play the "ring grows out of the orb" animation (The Compass just granted). */
  granting?: boolean;
  /** Play "the wheel closes": Hope and Calm ignite. */
  wheelCloses?: boolean;
  /** Rendered width: number = px, string = CSS length. Default calc(var(--u) * 200). */
  size?: number | string;
}

const C = 100;
const R_IN = 52;
const R_OUT = 77;
const R_SIGIL = 64.5;
const R_MARK = 90;
const GAP = 2.2;

const angleOf = (l: Light): number => lightIndex(l) * 60;

function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(C, C, r1, a0);
  const [x1, y1] = polar(C, C, r1, a1);
  const [x2, y2] = polar(C, C, r0, a1);
  const [x3, y3] = polar(C, C, r0, a0);
  return `M${n(x0)} ${n(y0)}A${r1} ${r1} 0 0 1 ${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}A${r0} ${r0} 0 0 0 ${n(x3)} ${n(y3)}Z`;
}

function placeGlyph(body: string, x: number, y: number, size: number, cls: string): string {
  const s = size / 24;
  return `<g class="${cls}" transform="translate(${n(x - size / 2)} ${n(y - size / 2)}) scale(${n(s)})">${body}</g>`;
}

function isLocked(l: Light, p: CompassProps): boolean {
  return !p.act2Unlocked && (l === 'hope' || l === 'calm');
}

function segmentMarkup(l: Light, p: CompassProps): string {
  const a = angleOf(l);
  const inNote = p.note.includes(l);
  const locked = isLocked(l, p);
  const neighbour = !inNote && !locked && p.note.some((x) => blendOf(x, l) !== null);
  const owned = p.ownedLights.includes(l);
  const state = locked ? 'locked' : inNote ? 'note' : neighbour ? 'next' : owned ? 'owned' : 'dim';
  const [sx, sy] = polar(C, C, R_SIGIL, a);
  const title = locked ? `${LIGHT_NAME[l]}: awakens in Act 2` : `${LIGHT_NAME[l]}${inNote ? ' (the Note)' : neighbour ? ' (Harmonizes next)' : ''}`;
  let extra = '';
  if (inNote) {
    const [t1x, t1y] = polar(C, C, R_IN - 1, a - 7);
    const [t2x, t2y] = polar(C, C, R_IN - 1, a + 7);
    const [t3x, t3y] = polar(C, C, R_IN - 8, a);
    extra += `<path class="cp-notch" d="M${n(t1x)} ${n(t1y)}L${n(t2x)} ${n(t2y)}L${n(t3x)} ${n(t3y)}Z"/>`;
  }
  if (neighbour) {
    const [p1x, p1y] = polar(C, C, R_IN - 9, a - 7);
    const [p2x, p2y] = polar(C, C, R_IN - 3, a);
    const [p3x, p3y] = polar(C, C, R_IN - 9, a + 7);
    extra += `<path class="cp-chevron" d="M${n(p1x)} ${n(p1y)}L${n(p2x)} ${n(p2y)}L${n(p3x)} ${n(p3y)}"/>`;
  }
  const glyph = locked
    ? placeGlyph(markBody('lock'), sx, sy, 16, 'cp-lock')
    : placeGlyph(sigilBody(l), sx, sy, 21, 'cp-sigil');
  return (
    `<g class="cp-seg" data-light="${l}" data-state="${state}"><title>${esc(title)}</title>` +
    `<path class="cp-seg__fill" d="${sector(R_IN, R_OUT, a - 30 + GAP, a + 30 - GAP)}"/>` +
    `<path class="cp-seg__edge" d="${sector(R_IN, R_OUT, a - 30 + GAP, a + 30 - GAP)}"/>` +
    glyph +
    extra +
    `</g>`
  );
}

function markerMarkup(l: Light, p: CompassProps): string {
  const shade = shadeCuredBy(l);
  const a = angleOf(l);
  const [x, y] = polar(C, C, R_MARK, a);
  const active = p.activeShades.includes(shade);
  const locked = isLocked(l, p);
  return (
    `<g class="cp-marker" data-face="${shade}" data-active="${active}" data-locked="${locked}"><title>${LIGHT_NAME[l]} answers ${SHADE_NAME[shade]}.</title>` +
    `<circle class="cp-marker__disc" cx="${n(x)}" cy="${n(y)}" r="9.5"/>` +
    placeGlyph(sigilBody(shade), x, y, 12.5, 'cp-marker__sigil') +
    `</g>`
  );
}

function dissonanceArrow(l: Light, p: CompassProps): string {
  // From this Light's segment to the marker of the Shade its clockwise neighbour cures.
  const shade = dissonantShadeOf(l);
  const a = angleOf(l);
  const [x0, y0] = polar(C, C, R_OUT + 2, a + 17);
  const [cx, cy] = polar(C, C, R_MARK + 3, a + 36);
  const [x1, y1] = polar(C, C, R_MARK - 1.5, a + 49);
  const [h1x, h1y] = polar(x1, y1, 3.6, a + 49 + 180 - 40 + 90);
  const [h2x, h2y] = polar(x1, y1, 3.6, a + 49 + 180 + 40 + 90);
  const locked = isLocked(l, p) || isLocked(LIGHTS[(lightIndex(l) + 1) % 6]!, p);
  return (
    `<g class="cp-dis" data-locked="${locked}"><title>${LIGHT_NAME[l]} alone deepens ${SHADE_NAME[shade]}.</title>` +
    `<path d="M${n(x0)} ${n(y0)}Q${n(cx)} ${n(cy)} ${n(x1)} ${n(y1)}"/>` +
    `<path d="M${n(h1x)} ${n(h1y)}L${n(x1)} ${n(y1)}L${n(h2x)} ${n(h2y)}"/>` +
    `</g>`
  );
}

function edgeMarkup(i: number, p: CompassProps): string {
  const a = LIGHTS[i]!;
  const b = LIGHTS[(i + 1) % 6]!;
  const blend = blendOf(a, b)!;
  const ang = i * 60 + 30;
  const [x, y] = polar(C, C, R_SIGIL, ang);
  const glow = (p.glowEdges ?? []).some(([u, v]) => blendOf(u, v) === blend);
  return (
    `<g class="cp-edge" data-light="${a}" data-light2="${b}" data-glow="${glow}"><title>${LIGHT_NAME[a]} and ${LIGHT_NAME[b]}: ${BLEND_NAME[blend]}</title>` +
    `<path class="cp-edge__glow" d="${sector(R_IN - 2, R_OUT + 2, ang - GAP - 1.2, ang + GAP + 1.2)}"/>` +
    `<circle class="cp-edge__hit" cx="${n(x)}" cy="${n(y)}" r="9"/>` +
    `</g>`
  );
}

function harmonyArcMarkup(arc: readonly [Light, Light]): string {
  const [from, to] = arc;
  const a0 = angleOf(from);
  let a1 = angleOf(to);
  if (a1 - a0 > 180) a1 -= 360;
  if (a0 - a1 > 180) a1 += 360;
  const [x0, y0] = polar(C, C, R_SIGIL, a0);
  const [x1, y1] = polar(C, C, R_SIGIL, a1);
  const sweep = a1 > a0 ? 1 : 0;
  return `<path class="cp-arc" data-light="${to}" pathLength="100" d="M${n(x0)} ${n(y0)}A${R_SIGIL} ${R_SIGIL} 0 0 ${sweep} ${n(x1)} ${n(y1)}"/>`;
}

function orbMarkup(p: CompassProps): string {
  const empty = p.energy <= 0;
  const crack = p.hollow
    ? `<path class="cp-orb__crack" d="M${C - 30} ${C - 12}L${C - 14} ${C - 6}L${C - 8} ${C + 6}L${C + 6} ${C + 2}L${C + 14} ${C + 14}L${C + 30} ${C + 16}"/>`
    : '';
  return (
    `<g class="cp-orb" data-empty="${empty}">` +
    `<circle class="cp-orb__halo" cx="${C}" cy="${C}" r="44"/>` +
    `<circle class="cp-orb__body" cx="${C}" cy="${C}" r="36" fill="url(#CPORB)"/>` +
    `<ellipse class="cp-orb__shine" cx="${C - 11}" cy="${C - 16}" rx="13" ry="7"/>` +
    crack +
    `<text class="cp-orb__n" x="${C - 4}" y="${C + 11}" text-anchor="middle">${p.energy}</text>` +
    `<text class="cp-orb__max" x="${C + 11}" y="${C + 12}">/${p.maxEnergy}</text>` +
    `</g>`
  );
}

function fogMarkup(): string {
  const puffs = [0, 50, 110, 170, 230, 290]
    .map((a, i) => {
      const [x, y] = polar(C, C, 66, a + 12);
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${24 + (i % 3) * 4}"/>`;
    })
    .join('');
  return `<g class="cp-fog" filter="url(#CPFOG)">${puffs}</g><text class="cp-fog__label" x="${C}" y="${C + 58}" text-anchor="middle">Isolated</text>`;
}

function ariaLabel(p: CompassProps): string {
  const spirit = `Spirit ${p.energy} of ${p.maxEnergy}${p.hollow ? ', Hollow' : ''}.`;
  if (!p.enabled) return spirit;
  const note = p.note.length ? `Note: ${p.note.map((l) => LIGHT_NAME[l]).join(' and ')}.` : 'No Note yet.';
  const iso = p.isolated ? ' Isolated: no Harmony.' : '';
  return `${spirit} ${note} Harmonies this turn: ${p.harmoniesThisTurn}.${iso}`;
}

/** Compass HUD markup (string). Use renderCompass for an element. */
export function compassMarkup(p: CompassProps): string {
  const id = uniqueId('cp');
  const width = cssLen(p.size ?? 'calc(var(--u) * 200)');
  const ring = p.enabled
    ? `<g class="cp-ring">` +
      LIGHTS.map((l) => dissonanceArrow(l, p)).join('') +
      LIGHTS.map((l) => segmentMarkup(l, p)).join('') +
      LIGHTS.map((_, i) => edgeMarkup(i, p)).join('') +
      LIGHTS.map((l) => markerMarkup(l, p)).join('') +
      (p.harmonyArc ? harmonyArcMarkup(p.harmonyArc) : '') +
      (p.isolated ? fogMarkup() : '') +
      `</g>`
    : '';
  const defs =
    `<defs><radialGradient id="${id}o" cx="40%" cy="32%" r="75%"><stop offset="0%" stop-color="#ffffff"/><stop offset="45%" class="cp-stop-pearl"/><stop offset="100%" class="cp-stop-edge"/></radialGradient>` +
    `<filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter></defs>`;
  const svg =
    `<svg class="compass-hud__svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${defs}${ring}${orbMarkup(p)}</svg>`
      .replace(/url\(#CPORB\)/g, `url(#${id}o)`)
      .replace(/url\(#CPFOG\)/g, `url(#${id}f)`);
  const label = p.enabled
    ? `<div class="compass-hud__label">Harmonies this turn: <b class="num">${p.harmoniesThisTurn}</b></div>`
    : '';
  const rootAttrs = attrs({
    class: 'compass-hud',
    'data-enabled': p.enabled,
    'data-granting': p.granting ? 'true' : null,
    'data-wheel-closes': p.wheelCloses ? 'true' : null,
    'data-isolated': p.isolated,
    'data-hollow': p.hollow,
    style: `width:${width}`,
    role: 'img',
    'aria-label': ariaLabel(p),
  });
  return `<div${rootAttrs}>${svg}${label}</div>`;
}

/** Compass HUD element (a <div> holding the ring SVG and the Harmonies label). */
export function renderCompass(p: CompassProps): HTMLElement {
  return toElement<HTMLElement>(compassMarkup(p));
}
