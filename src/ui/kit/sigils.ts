// SVG sigils and icons (DESIGN 16.0, 16.2, 16.4, 19).
// Every glyph sits on a 24-unit grid, draws in currentColor and is built to stay legible at 14px and
// distinct in greyscale. Light sigils are open and rounded; Shade sigils are closed and pointed.
// Functions return markup strings (usable in innerHTML, testable without a DOM); iconElement() parses one.

import type { Light, Shade } from '../../engine/emotions';
import type { IntentKind } from '../../engine/types';
import { attrs, cssLen, esc, n, polar, svgElement } from './svg';

// ------------------------------------------------------------------------------------------------
// Part builders
// ------------------------------------------------------------------------------------------------

/** Rounded stroke path. */
const S = (d: string, sw = 2, extra = ''): string =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
/** Sharp (mitred) stroke path, for pointed Shade marks. */
const SM = (d: string, sw = 2): string =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="6"/>`;
/** Filled path; evenodd lets inner shapes punch holes. */
const F = (d: string, evenodd = false, extra = ''): string =>
  `<path d="${d}" fill="currentColor"${evenodd ? ' fill-rule="evenodd"' : ''}${extra}/>`;
const circleS = (cx: number, cy: number, r: number, sw = 2): string =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="currentColor" stroke-width="${sw}"/>`;
const circleF = (cx: number, cy: number, r: number, extra = ''): string =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="currentColor"${extra}/>`;
/** Closed circle subpath (for evenodd holes inside a filled path). */
const ring = (cx: number, cy: number, r: number): string =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;

/** Clockwise arc from startDeg to endDeg (0 = up). */
function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x0, y0] = polar(cx, cy, r, startDeg);
  const [x1, y1] = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${n(r)} ${n(r)} 0 ${large} 1 ${n(x1)} ${n(y1)}`;
}

/** Star polygon: `points` tips alternating outer radii, `inner` valley radius. */
function starPath(cx: number, cy: number, outer: number[], inner: number, points: number, rot = 0): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer[(i / 2) % outer.length]! : inner;
    const [x, y] = polar(cx, cy, r, rot + (i * 180) / points);
    d += `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`;
  }
  return `${d}Z`;
}

/** Concave four-point sparkle centred on (cx, cy) with radius r. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.16;
  return (
    `M${n(cx)} ${n(cy - r)}C${n(cx + k)} ${n(cy - k)} ${n(cx + k)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}` +
    `C${n(cx + k)} ${n(cy + k)} ${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + r)}` +
    `C${n(cx - k)} ${n(cy + k)} ${n(cx - k)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}` +
    `C${n(cx - k)} ${n(cy - k)} ${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - r)}Z`
  );
}

const HEART =
  'M12 20.2C12 20.2 3.4 14.8 3.4 9C3.4 6.3 5.5 4.2 8.1 4.2C9.8 4.2 11.2 5.1 12 6.6C12.8 5.1 14.2 4.2 15.9 4.2C18.5 4.2 20.6 6.3 20.6 9C20.6 14.8 12 20.2 12 20.2Z';
const GHOST = 'M5 21V11.5C5 7.4 8.1 4.2 12 4.2C15.9 4.2 19 7.4 19 11.5V21L16.7 19.2L14.3 21L12 19.2L9.7 21L7.3 19.2Z';
const SHIELD = 'M12 2.6L19.8 5.4V11C19.8 15.9 16.6 19.5 12 21.4C7.4 19.5 4.2 15.9 4.2 11V5.4Z';
const DROP = 'M12 2.8C14 6 18.6 10.6 18.6 14.6A6.6 6.6 0 0 1 5.4 14.6C5.4 10.6 10 6 12 2.8Z';

// ------------------------------------------------------------------------------------------------
// Lights (open, rounded)
// ------------------------------------------------------------------------------------------------

function sunRays(r0: number, r1: number, count: number, sw: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const [x0, y0] = polar(12, 12, r0, (i * 360) / count);
    const [x1, y1] = polar(12, 12, r1, (i * 360) / count);
    d += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
  }
  return S(d, sw);
}

function linkedRings(): string {
  // Two interlocked rings: each has a small gap where it passes under the other.
  const r = 5.2;
  const gap = 26;
  return (
    S(arc(8.6, 12, r, 139.1 + gap, 139.1 - gap + 360), 2.1) + S(arc(15.4, 12, r, 319.1 + gap, 319.1 - gap + 360), 2.1)
  );
}

const LIGHT_GLYPH: Record<Light, string> = {
  love: S(HEART, 2.1),
  joy: circleS(12, 12, 3.7, 2.1) + sunRays(6.7, 9.9, 8, 2.1),
  friendship: linkedRings(),
  courage: S('M4.5 14.8L12 7.3L19.5 14.8', 2.6) + S('M8 19.2L12 15.2L16 19.2', 2.1, ' opacity="0.6"'),
  hope: S('M12 2.8C12.9 8.6 15.4 11.1 21.2 12C15.4 12.9 12.9 15.4 12 21.2C11.1 15.4 8.6 12.9 2.8 12C8.6 11.1 11.1 8.6 12 2.8Z', 2),
  calm: S('M3 9C5 6.6 7 6.6 9 9S13 11.4 15 9S19 6.6 21 9', 2.2) + S('M3 15C5 12.6 7 12.6 9 15S13 17.4 15 15S19 12.6 21 15', 2.2),
};

// ------------------------------------------------------------------------------------------------
// Shades (closed, pointed) and the numb and doubt marks
// ------------------------------------------------------------------------------------------------

const SHADE_GLYPH: Record<Shade, string> = {
  anger: F(
    'M3 19.6L3.6 8.4L7.6 12.1L8.8 5.4L11.1 10L12 3.2L12.9 10L15.2 5.4L16.4 12.1L20.4 8.4L21 19.6Z' +
      'M5.2 15.4H18.8V17H5.2Z',
    true,
  ),
  sadness: F('M12 1.9C13.6 5.1 17.9 10.1 17.9 14.3A5.9 5.9 0 0 1 6.1 14.3C6.1 10.1 10.4 5.1 12 1.9Z', false, ' transform="rotate(24 12 13)"'),
  loneliness: F(ring(12, 12, 9.8) + ring(12, 12, 7.4), true) + circleF(12, 15.6, 2.3),
  fear: F('M1.2 12C5.8 4.6 18.2 4.6 22.8 12C18.2 19.4 5.8 19.4 1.2 12Z' + ring(12, 12, 4.4) + ring(12, 12, 2), true),
  despair: F('M2.4 3.8H21.6L13.9 12.5V21L10.1 18.4V12.5Z'),
  anxiety: SM(
    'M5 16.5C2.5 11 7.5 5.5 11.5 8C15.5 10.5 10.5 16.5 8.5 12.5C6.5 8.5 12.5 4.5 16 6.5C20 8.8 17.5 15.5 14 13.5C10.5 11.5 16.5 7.5 19.5 11C22 14 19.5 19 15.5 18.5C12 18 10 20 6.5 19',
    2.1,
  ),
};

const EXTRA_SIGIL = {
  numb: F('M2.4 12a9.6 6.9 0 1 0 19.2 0a9.6 6.9 0 1 0 -19.2 0Z' + 'M6.6 11.3H17.4V12.7H6.6Z', true),
  doubt:
    S('M8.2 8.6C8.2 5.3 10.4 3.6 12.6 3.6C15.3 3.6 17.2 5.5 17.2 7.9C17.2 11 13.2 11.6 12.6 14.4C12.3 15.8 13.3 16.6 12.4 17.6', 2.4) +
    circleF(12.1, 20.6, 1.6),
  neutral: S('M12 3.8L20.2 12L12 20.2L3.8 12Z', 2) + circleF(12, 12, 1.8),
} as const;

export type SigilName = Light | Shade | keyof typeof EXTRA_SIGIL;

// ------------------------------------------------------------------------------------------------
// Intents (16.2): unique shapes, never colour-only
// ------------------------------------------------------------------------------------------------

const INTENT_GLYPH: Record<IntentKind, string> = {
  strike: F(starPath(12, 12, [11, 8.2], 4.6, 8, 11)),
  guard: F(SHIELD + 'M12 6.2L16.4 7.8V11.2C16.4 14 14.7 16.2 12 17.5Z', true),
  afflict: F(DROP + ring(12, 15, 2.6), true),
  buff: F('M12 2.6L21.6 20.4L12 15.6L2.4 20.4Z'),
  mend: S('M12 3.2C13.9 6.2 18.2 10.6 18.2 14.4A6.2 6.2 0 0 1 5.8 14.4C5.8 10.6 10.1 6.2 12 3.2Z', 1.9) + S('M12 11.2V17.6M8.8 14.4H15.2', 2.2),
  summon: F(GHOST, false, ' transform="translate(-1.6 2.2) scale(0.84)"') + S('M19 2.6V9.4M15.6 6H22.4', 2.3),
  scatter:
    F(GHOST, false, ' transform="translate(-0.6 8.4) scale(0.56) rotate(-14 12 12)"') +
    F(GHOST, false, ' transform="translate(11.2 8.4) scale(0.56) rotate(14 12 12)"') +
    S('M10 5H3.4M5.6 2.8L3.4 5L5.6 7.2M14 5H20.6M18.4 2.8L20.6 5L18.4 7.2', 1.9),
};

// ------------------------------------------------------------------------------------------------
// Map nodes (16.4)
// ------------------------------------------------------------------------------------------------

export type NodeIconName = 'fight' | 'elite' | 'haven' | 'sanctuary' | 'memory' | 'chest' | 'boss';

const NODE_GLYPH: Record<NodeIconName, string> = {
  fight: F(GHOST + ring(9.6, 11.6, 1.7) + ring(14.4, 11.6, 1.7), true),
  elite: F(
    'M5 21V12C5 9.3 6.2 7.1 8 5.8L7.3 2.2L10.2 4.5L12 1.5L13.8 4.5L16.7 2.2L16 5.8C17.8 7.1 19 9.3 19 12V21L16.7 19.2L14.3 21L12 19.2L9.7 21L7.3 19.2Z' +
      'M7.8 10.6L11 11.8L10.4 13.4L7.6 12.4Z' +
      'M16.2 10.6L13 11.8L13.6 13.4L16.4 12.4Z',
    true,
  ),
  haven:
    S('M9.2 4.4C9.2 2.6 14.8 2.6 14.8 4.4M7.6 6.2H16.4M8.6 6.2L7.6 9V17.2L8.6 19.6H15.4L16.4 17.2V9L15.4 6.2M9.2 21.4H14.8', 1.9) +
    F('M12 9.6C13.7 11.6 14.2 13 14.2 14.2A2.2 2.2 0 0 1 9.8 14.2C9.8 13 10.3 11.6 12 9.6Z'),
  sanctuary:
    S('M4.6 21.2V3.6H14.4V21.2M2.6 21.2H21.4', 1.9) +
    F('M14.4 3.6L19.4 5.6V21.2L14.4 21.2Z', false, ' opacity="0.55"') +
    F(sparkle(9.5, 11.6, 3.6)),
  memory: S('M12 7C9.5 5 6 4.8 3 5.6V19.2C6 18.4 9.5 18.7 12 20.6C14.5 18.7 18 18.4 21 19.2V5.6C18 4.8 14.5 5 12 7ZM12 7V20.6M6 9.2C7.4 9 8.8 9.2 9.8 9.8M14.2 9.8C15.2 9.2 16.6 9 18 9.2', 1.8),
  chest: S('M4.6 10.6H19.4V20.6H4.6ZM3.4 7.2H20.6V10.6H3.4ZM12 7.2V20.6M12 7.2C10.2 3.4 6.4 4.4 8 7.2M12 7.2C13.8 3.4 17.6 4.4 16 7.2', 1.8),
  boss:
    F('M6.4 6.4L7 1.8L9.5 4.1L12 1L14.5 4.1L17 1.8L17.6 6.4Z') +
    F('M4.4 22.6V14.2C4.4 10.3 7.8 7.6 12 7.6C16.2 7.6 19.6 10.3 19.6 14.2V22.6L17.1 20.8L14.5 22.6L12 20.8L9.5 22.6L6.9 20.8Z' + ring(9.3, 14.2, 1.8) + ring(14.7, 14.2, 1.8), true),
};

// ------------------------------------------------------------------------------------------------
// Resources and UI marks
// ------------------------------------------------------------------------------------------------

export type ResourceIconName = 'heart' | 'spirit' | 'guard' | 'glimmer';

const RESOURCE_GLYPH: Record<ResourceIconName, string> = {
  heart: F(HEART),
  spirit: F(ring(12, 12.6, 8.4) + sparkle(9.4, 10, 3), true) + S('M12 1.8C12.8 2.8 13 3.4 12.6 4.2', 1.6, ' opacity="0.7"'),
  guard: F(SHIELD),
  glimmer: F(sparkle(10, 10, 7.6)) + F(sparkle(18.4, 18, 3.4)),
};

export type MarkIconName =
  | 'chevronUp2'
  | 'chevronDown'
  | 'ringDouble'
  | 'ringSingle'
  | 'triUp'
  | 'triDown'
  | 'sunburst'
  | 'seal'
  | 'brokenHeart'
  | 'turn'
  | 'lock'
  | 'harmony'
  | 'promise'
  | 'fade'
  | 'moth'
  | 'hare'
  | 'dog'
  | 'deck'
  | 'draw'
  | 'discard'
  | 'codex'
  | 'settings'
  | 'log'
  | 'undo'
  | 'sound'
  | 'mute'
  | 'close'
  | 'inward';

function sealPath(): string {
  let d = '';
  const bumps = 14;
  for (let i = 0; i <= bumps * 2; i++) {
    const r = i % 2 === 0 ? 10 : 8.8;
    const [x, y] = polar(12, 12, r, (i * 180) / bumps);
    d += `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`;
  }
  return `${d}Z${ring(12, 12, 6.2)}${ring(12, 12, 4.9)}`;
}

const MARK_GLYPH: Record<MarkIconName, string> = {
  chevronUp2: S('M5 12.4L12 5.8L19 12.4M5 18.6L12 12L19 18.6', 2.6),
  chevronDown: S('M5 8.6L12 15.4L19 8.6', 2.6),
  ringDouble: circleS(12, 12, 8.6, 2) + circleS(12, 12, 4.6, 2),
  ringSingle: circleS(12, 12, 7.2, 2),
  triUp: F('M12 4.6L20.4 18.6H3.6Z'),
  triDown: F('M12 19.4L20.4 5.4H3.6Z'),
  sunburst: F(starPath(12, 12, [11.4, 9.6], 6.6, 12, 0)),
  seal: F(sealPath(), true),
  brokenHeart: S(HEART, 2) + S('M12 6.6L10.4 10.2L13.4 12.6L11 16.4', 2),
  turn: S('M18.8 13.4A7 7 0 1 1 17.2 7.2M19.4 3.6L17.6 7.6L13.4 6.6', 2),
  lock: S('M6.2 11H17.8V20.2H6.2ZM8.6 11V8.2A3.4 3.4 0 0 1 15.4 8.2V11', 2) + circleF(12, 15.4, 1.4),
  harmony:
    circleS(8.8, 12, 5.6, 1.9) + circleS(15.2, 12, 5.6, 1.9) + F('M12 7.3A5.6 5.6 0 0 1 12 16.7A5.6 5.6 0 0 1 12 7.3Z'),
  promise: S('M12 21V11.6M12 14.6C12 10.8 8.8 9.4 5.6 9.8C5.6 13.2 8.4 14.8 12 14.6ZM12 11.6C12 7.8 14.8 5.2 18.6 5.4C18.8 9.2 16 11.8 12 11.6Z', 1.9),
  fade: circleS(12, 12, 7.6, 1.6) + circleF(8.6, 9.4, 1.2) + circleF(15.8, 15, 0.9) + S('M15 6.4L16.6 5M18.6 9.4L20.4 8.8M5.2 16.8L3.8 18', 1.6),
  moth:
    F('M12 7.4C13 7.4 13.5 8.6 13.5 11V16.4C13.5 17.6 12.9 18.4 12 18.4C11.1 18.4 10.5 17.6 10.5 16.4V11C10.5 8.6 11 7.4 12 7.4Z') +
    S('M10.6 10.6C7.6 6.6 3.4 6.2 3.2 9.4C3 12.6 7.2 13.8 10.6 13.4M13.4 10.6C16.4 6.6 20.6 6.2 20.8 9.4C21 12.6 16.8 13.8 13.4 13.4M10.8 14.6C8.2 15.4 6.8 18 8.4 19.2M13.2 14.6C15.8 15.4 17.2 18 15.6 19.2M11.2 7.6L9.6 4.6M12.8 7.6L14.4 4.6', 1.6),
  hare: S('M8.6 10.8C7.4 7.4 7.2 3.4 8.6 3C10 2.6 10.8 6.6 10.8 10M13.2 10C13.2 6.6 14 2.6 15.4 3C16.8 3.4 16.6 7.4 15.4 10.8M6.4 16.2C6.4 12.8 8.8 10.2 12 10.2C15.2 10.2 17.6 12.8 17.6 16.2C17.6 19.2 15.2 20.8 12 20.8C8.8 20.8 6.4 19.2 6.4 16.2Z', 1.8) + circleF(10, 15, 1) + circleF(14, 15, 1),
  dog: S('M7 8.8C4.6 8.2 3.2 10.8 3.8 14.2C4.8 13.8 6 12.8 6.6 11.2M17 8.8C19.4 8.2 20.8 10.8 20.2 14.2C19.2 13.8 18 12.8 17.4 11.2M6.6 11.2C6.6 7.6 9 5.6 12 5.6C15 5.6 17.4 7.6 17.4 11.2V14.6C17.4 18 15 20.4 12 20.4C9 20.4 6.6 18 6.6 14.6Z', 1.8) + circleF(9.8, 12.4, 1.1) + circleF(14.2, 12.4, 1.1) + F('M10.6 15.6H13.4L12 17.2Z'),
  deck: S('M7.4 3.6H18.2V17.8H7.4ZM5.8 6.2V20.4H15.8', 1.8),
  draw: S('M6.4 4.4H17.6V19.6H6.4ZM12 8V15.2M9 12.4L12 15.4L15 12.4', 1.8),
  discard: S('M6.4 4.4H17.6V19.6H6.4ZM9.2 9.4L14.8 15M14.8 9.4L9.2 15', 1.8),
  codex: S('M5 4.6C5 3.9 5.5 3.4 6.2 3.4H18.8V18.2H6.2C5.5 18.2 5 18.7 5 19.4ZM5 19.4C5 20.1 5.5 20.6 6.2 20.6H18.8M9 7.6H15M9 10.6H13.4', 1.8),
  settings: S(ring(12, 12, 3.2) + 'M12 2.8V5.4M12 18.6V21.2M2.8 12H5.4M18.6 12H21.2M5.5 5.5L7.3 7.3M16.7 16.7L18.5 18.5M5.5 18.5L7.3 16.7M16.7 7.3L18.5 5.5', 1.9) + circleS(12, 12, 6.6, 1.9),
  log: S('M7 3.6H17C18.1 3.6 19 4.5 19 5.6V20.4H7C5.9 20.4 5 19.5 5 18.4V5.6C5 4.5 5.9 3.6 7 3.6ZM8.6 8H15.4M8.6 11.4H15.4M8.6 14.8H12.8', 1.8),
  undo: S('M8.6 6.4L4.6 10.4L8.6 14.4M4.8 10.4H14.4C17.4 10.4 19.4 12.6 19.4 15.4C19.4 18.2 17.4 20.2 14.4 20.2H10.8', 2),
  sound: F('M4 9.2H7.6L12.4 5V19L7.6 14.8H4Z') + S('M15.4 9C16.6 10.6 16.6 13.4 15.4 15M18 6.6C20.4 9.6 20.4 14.4 18 17.4', 1.8),
  mute: F('M4 9.2H7.6L12.4 5V19L7.6 14.8H4Z') + S('M15.6 9.4L20.4 14.6M20.4 9.4L15.6 14.6', 1.9),
  close: S('M6 6L18 18M18 6L6 18', 2.2),
  inward: S(HEART, 1.8) + circleF(12, 11.6, 2.2),
};

// ------------------------------------------------------------------------------------------------
// Keepsakes: simple generic shapes keyed by the content's icon hint
// ------------------------------------------------------------------------------------------------

const KEEPSAKE_GLYPH: Record<string, string> = {
  compass:
    circleS(12, 12, 9.2, 1.8) +
    F('M12 5L14.4 12H9.6Z') +
    F('M9.6 12H14.4L12 19Z', false, ' opacity="0.45"') +
    S('M12 1.6V3.2M12 20.8V22.4M1.6 12H3.2M20.8 12H22.4', 1.6),
  locket:
    S('M8.2 2.2C8.2 5 10 7 12 7C14 7 15.8 5 15.8 2.2', 1.5) +
    S('M12 22C12 22 4.8 17.4 4.8 12.6C4.8 10.4 6.6 8.6 8.8 8.6C10.2 8.6 11.3 9.4 12 10.6C12.7 9.4 13.8 8.6 15.2 8.6C17.4 8.6 19.2 10.4 19.2 12.6C19.2 17.4 12 22 12 22Z', 1.8) +
    circleF(12, 7.6, 1.2),
  sun: circleS(12, 12, 4.8, 1.8) + sunRays(7.6, 10.2, 12, 1.6) + S('M10.2 12.8C11.2 13.8 12.8 13.8 13.8 12.8', 1.4),
  bracelet:
    `<ellipse cx="12" cy="12.4" rx="9" ry="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
    circleF(12, 18, 1.9) +
    circleF(6.2, 16.2, 1.5) +
    circleF(17.8, 16.2, 1.5) +
    S('M6.4 8.6L8.4 10.4M10.6 7.2L12.2 9M14.6 7.4L15.8 9.4', 1.3),
  pebble:
    S('M4.2 14.6C4.2 10 8.4 7 13 7C17.6 7 20.2 10 20.2 13.6C20.2 17.6 16.4 19.4 12 19.4C7.4 19.4 4.2 18.2 4.2 14.6Z', 1.8) +
    S('M9.4 14.8L12.2 11.8L15 14.8', 1.8),
  fork:
    S('M9 2.8V10C9 11.9 10.3 13.2 12 13.2C13.7 13.2 15 11.9 15 10V2.8M12 13.2V21.4M10 21.4H14', 1.8) +
    S('M5.4 4.6C4.4 6.2 4.4 8 5.4 9.6M18.6 4.6C19.6 6.2 19.6 8 18.6 9.6', 1.5),
  flower:
    S('M12 13.6V22M12 18C9.8 18 8.4 16.8 8 15M12 19.6C14 19.6 15.4 18.6 15.8 17', 1.6) +
    circleS(12, 8, 2, 1.6) +
    [0, 72, 144, 216, 288]
      .map((a) => {
        const [x, y] = polar(12, 8, 4.4, a);
        return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="2.4" ry="1.6" transform="rotate(${a + 90} ${n(x)} ${n(y)})" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
      })
      .join(''),
  umbrella: S(
    'M2.8 12.2C2.8 7.2 7 3.4 12 3.4C17 3.4 21.2 7.2 21.2 12.2C19.8 11 17.6 11 16.6 12.2C15.4 11 13.4 11 12 12.2C10.6 11 8.6 11 7.4 12.2C6.4 11 4.2 11 2.8 12.2ZM12 12.2V19C12 21 9 21 9 19M12 1.8V3.4',
    1.8,
  ),
  tea:
    S('M4.6 9H16V12.8C16 16.4 13.6 18.8 10.4 18.8C7.2 18.8 4.6 16.4 4.6 12.8ZM16 10.4C19 10.2 19.2 14.8 16 15M3.2 21H18', 1.8) +
    S('M8.2 6.6C7.2 5.2 9.2 4.2 8.2 2.6M11.8 6.6C10.8 5.2 12.8 4.2 11.8 2.6', 1.4),
  socks: S('M7.6 2.8H13.8V11.2L18.6 15.2C20.2 16.6 19.8 19.2 17.8 20.2C16.4 20.9 14.8 20.6 13.6 19.6L8.6 15.4C8 14.9 7.6 14.2 7.6 13.4ZM7.6 6H13.8M14.8 17.6L16.8 15.6', 1.8),
  prism:
    S('M12 3.6L20.2 19.4H3.8Z', 1.8) +
    S('M1.2 12.8L9.4 11.8', 1.5) +
    S('M15.2 12.2L22.6 9.6M15.6 13.4L22.8 13.2M15.2 14.6L22.4 16.8', 1.3),
  journal: S('M5.4 3.4H18.2V20.6H5.4ZM8.4 3.4V20.6M14.8 3.4V20.6', 1.7) + F('M11.6 14.4C11.6 14.4 9.8 13.2 9.8 11.8C9.8 11.2 10.3 10.7 10.9 10.7C11.2 10.7 11.5 10.9 11.6 11.2C11.7 10.9 12 10.7 12.3 10.7C12.9 10.7 13.4 11.2 13.4 11.8C13.4 13.2 11.6 14.4 11.6 14.4Z', false, ' transform="translate(0.1 -1)"'),
  lantern:
    S('M9.2 4.4C9.2 2.6 14.8 2.6 14.8 4.4M7.6 6.2H16.4M8.6 6.2L7.6 9V17.2L8.6 19.6H15.4L16.4 17.2V9L15.4 6.2M9.2 21.4H14.8', 1.7) +
    F('M12 8.8C14 11 14.6 12.6 14.6 14A2.6 2.6 0 0 1 9.4 14C9.4 12.6 10 11 12 8.8Z'),
  mat:
    S('M4 7.6H20V16.4H4ZM4 9.2H2M4 11.2H2M4 13.2H2M4 15.2H2M20 9.2H22M20 11.2H22M20 13.2H22M20 15.2H22', 1.6) +
    F('M12 14.4C12 14.4 9.6 12.9 9.6 11.2C9.6 10.4 10.2 9.8 11 9.8C11.4 9.8 11.8 10 12 10.4C12.2 10 12.6 9.8 13 9.8C13.8 9.8 14.4 10.4 14.4 11.2C14.4 12.9 12 14.4 12 14.4Z'),
  crane: S('M1.8 12.8L9 11.2L12 3.6L14.6 11.2L22.2 8.4L16.2 15.2L12 20.4L9.4 15.2ZM9 11.2L12 15.8L14.6 11.2M12 15.8V20.4', 1.5),
  diary:
    S('M5.4 3.4H17.4C18 3.4 18.4 3.8 18.4 4.4V19.6C18.4 20.2 18 20.6 17.4 20.6H5.4ZM8.2 3.4V20.6M18.4 10H20.4V14H18.4', 1.7) +
    F('M11 20.6V23.4L12.2 22.4L13.4 23.4V20.6Z'),
  teacup:
    S('M4 9H9.8L10.9 10.8L12 9H17V12.6C17 16.2 14.2 18.6 10.5 18.6C6.8 18.6 4 16.2 4 12.6ZM17 10.4C20 10.2 20.2 14.8 17 15M2.6 21H18.4', 1.8) +
    S('M13.2 11.6L12.4 13.6L13.6 15', 1.2),
  shell: S(
    'M12.4 12.6C12.4 11.5 13.6 11.1 14.3 11.9C15.3 13.1 14.3 14.9 12.7 15C10.5 15.1 9.3 13 9.9 11.1C10.7 8.5 13.9 7.5 16.2 8.9C19.1 10.7 19.2 15 17 17.3C14.4 20 9.5 20 6.9 17.4C3.9 14.4 4.2 9.1 7.5 6.4C9.9 4.4 13.4 4 16.3 5.1',
    1.8,
  ),
  box: S('M12 2.8L20.6 7.4V16.6L12 21.2L3.4 16.6V7.4ZM3.4 7.4L12 12L20.6 7.4M12 12V21.2', 1.7) + circleF(16.4, 13.8, 1.3),
  mirror: S('M6.4 2.8L17.4 5L20.2 14.2L11 21.2L3.8 12.2Z', 1.8) + S('M9 8.4L12.6 7.2M8.2 11.2L14.4 9', 1.4),
  key: circleS(7, 12, 4, 1.8) + S('M11 12H21.2M17.4 12V15.6M20.4 12V16.4', 1.8) + circleF(7, 12, 1.2),
  rod: S('M12 5V21.4M8 21.4H16', 1.8) + circleF(12, 3.6, 1.8) + S('M17.6 4.4L14.8 9H18.6L15.4 13.8', 1.6),
};

const DEFAULT_CHARM =
  circleS(12, 14, 6.6, 1.8) + circleS(12, 4.8, 1.8, 1.6) + S('M12 6.6V7.4', 1.6) + F(sparkle(12, 14, 3.6));

/** Keepsake icon hints the kit draws; anything else gets the default charm shape. */
export const KEEPSAKE_HINTS: readonly string[] = Object.keys(KEEPSAKE_GLYPH);

// ------------------------------------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------------------------------------

export interface IconOpts {
  /** Number = px, string = any CSS length. Omit to size by CSS (.sigil is 1em square). */
  size?: number | string;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string;
  /** Extra classes on the <svg>. */
  className?: string;
  /**
   * Colour a Light sigil with its Light (and the numb oval grey). Other icons stay currentColor.
   * Adds the class `sigil--tint`.
   */
  tint?: boolean;
}

function wrap(kind: string, name: string, body: string, o: IconOpts = {}, viewBox = '0 0 24 24', aspect = 1): string {
  const cls = ['sigil', `sigil--${kind}`, `sigil--${name}`, o.tint ? 'sigil--tint' : '', o.className ?? '']
    .filter(Boolean)
    .join(' ');
  const size = o.size === undefined ? null : cssLen(o.size);
  const width = size && aspect !== 1 ? `calc(${size} * ${n(aspect)})` : size;
  const a = attrs({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox,
    class: cls,
    'data-icon': name,
    style: size ? `width:${width};height:${size}` : null,
    role: o.title ? 'img' : null,
    'aria-label': o.title ?? null,
    'aria-hidden': o.title ? null : 'true',
    focusable: 'false',
  });
  const title = o.title ? `<title>${esc(o.title)}</title>` : '';
  return `<svg${a}>${title}${body}</svg>`;
}

/**
 * Inner markup of a sigil on its 24-unit grid (no <svg> wrapper), for composing into larger SVGs:
 * `<g transform="translate(x y) scale(s)">${sigilBody('love')}</g>`. Draws in currentColor.
 */
export function sigilBody(name: SigilName): string {
  const body =
    (LIGHT_GLYPH as Record<string, string>)[name] ??
    (SHADE_GLYPH as Record<string, string>)[name] ??
    (EXTRA_SIGIL as Record<string, string>)[name];
  if (!body) throw new Error(`Unknown sigil: ${name}`);
  return body;
}

/** Light, Shade, numb, doubt or neutral sigil. */
export function sigil(name: SigilName, o?: IconOpts): string {
  return wrap('sigil', name, sigilBody(name), o);
}

/** Intent icon (strike starburst, guard shield, afflict drop, buff notched triangle, mend, summon, scatter). */
export function intentIcon(kind: IntentKind, o?: IconOpts): string {
  return wrap('intent', kind, INTENT_GLYPH[kind], o);
}

/** Map node icon (legend and node centres). */
export function nodeIcon(kind: NodeIconName, o?: IconOpts): string {
  return wrap('node', kind, NODE_GLYPH[kind], o);
}

/** Heart, Spirit, Guard or Glimmer icon. */
export function resourceIcon(kind: ResourceIconName, o?: IconOpts): string {
  return wrap('res', kind, RESOURCE_GLYPH[kind], o);
}

/** Inner markup of a mark icon on its 24-unit grid, for composing into larger SVGs. */
export function markBody(name: MarkIconName): string {
  return MARK_GLYPH[name];
}

/** Small UI marks: chevrons, rings, triangles, sunburst, seal, lock, pile and menu icons, Companions. */
export function markIcon(name: MarkIconName, o?: IconOpts): string {
  return wrap('mark', name, MARK_GLYPH[name], o);
}

/** Keepsake icon from the content's `icon` hint. Unknown or missing hints get a default charm. */
export function keepsakeIcon(hint: string | undefined, o?: IconOpts): string {
  const key = hint && Object.prototype.hasOwnProperty.call(KEEPSAKE_GLYPH, hint) ? hint : 'charm';
  return wrap('keepsake', key, KEEPSAKE_GLYPH[key] ?? DEFAULT_CHARM, o);
}

/** The grey oval labelled NUMB (Apathy and The Numbness on map nodes, nameplates and the meter). */
export function numbBadge(o?: Omit<IconOpts, 'tint'>): string {
  const body =
    `<g class="numb-badge__oval">${EXTRA_SIGIL.numb}</g>` +
    `<text x="27" y="16.6" font-size="11" font-weight="800" letter-spacing="1" fill="currentColor" font-family="ui-rounded, system-ui, sans-serif">NUMB</text>`;
  const opts: IconOpts = { ...o, className: `numb-badge ${o?.className ?? ''}`.trim() };
  return wrap('badge', 'numb', body, opts, '0 0 62 24', 62 / 24);
}

/** Every icon name per family, for galleries and tests. */
export const ICON_NAMES = {
  lights: ['love', 'joy', 'friendship', 'courage', 'hope', 'calm'] as const satisfies readonly Light[],
  shades: ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety'] as const satisfies readonly Shade[],
  extras: Object.keys(EXTRA_SIGIL) as (keyof typeof EXTRA_SIGIL)[],
  intents: Object.keys(INTENT_GLYPH) as IntentKind[],
  nodes: Object.keys(NODE_GLYPH) as NodeIconName[],
  resources: Object.keys(RESOURCE_GLYPH) as ResourceIconName[],
  marks: Object.keys(MARK_GLYPH) as MarkIconName[],
  keepsakes: KEEPSAKE_HINTS,
};

/** Parse any icon markup from this module into an SVGSVGElement (requires a DOM). */
export function iconElement(markup: string): SVGSVGElement {
  return svgElement(markup);
}
