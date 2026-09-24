// Run-level HUD pieces (DESIGN 4.16, 11.4, 16.4, 16.5): the Numbness meter, the Light Mix bar and map
// nodes with Shade sigils. Counts and names come from the engine (nodeDetail, deck summaries).

import type { Light, Shade } from '../../engine/emotions';
import { blendOfLights } from '../../engine/emotions';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from './names';
import { shadeMarkup } from './shadeArt';
import type { ShadeArtOpts } from './shadeArt';
import { nodeIcon, sigil } from './sigils';
import type { NodeIconName } from './sigils';
import { attrs, cssLen, esc, n } from './svg';
import { tipAttrs, tipText } from './widgets';

// ------------------------------------------------------------------------------------------------
// The Numbness meter (4.16): grey NUMB oval, "The Numbness: N will surface"
// ------------------------------------------------------------------------------------------------

export function numbnessMeterMarkup(p: { count: number; title?: string }): string {
  const count = Math.max(0, Math.min(3, Math.floor(p.count)));
  const pips = [0, 1, 2].map((i) => `<i class="numb-meter__pip${i < count ? ' is-on' : ''}"></i>`).join('');
  return (
    `<div${attrs({ class: `numb-meter${p.title ? ' has-tip' : ''}`, ...tipAttrs(p.title) })}>` +
    `<span class="numb-meter__badge" data-face="none">${sigil('numb')}</span><span class="numb-meter__text">The Numbness: <b class="num">${count}</b> will surface</span>` +
    `<span class="numb-meter__pips" aria-hidden="true">${pips}</span>${tipText(p.title)}</div>`
  );
}

// ------------------------------------------------------------------------------------------------
// Light Mix bar (16.4): one segment per Light in wheel order, Blends split, Buried ink, Insight pearl
// ------------------------------------------------------------------------------------------------

export type LightMixSegment =
  | { kind: 'light'; light: Light; count: number }
  | { kind: 'blend'; lights: readonly [Light, Light]; count: number }
  | { kind: 'neutral'; count: number }
  | { kind: 'buried'; shade: Shade; count: number }
  | { kind: 'insight'; light: Light; count: number };

function segmentName(s: LightMixSegment): string {
  switch (s.kind) {
    case 'light':
      return LIGHT_NAME[s.light];
    case 'blend': {
      const b = blendOfLights(s.lights);
      return b ? BLEND_NAME[b] : s.lights.map((l) => LIGHT_NAME[l]).join(' and ');
    }
    case 'neutral':
      return 'Neutral';
    case 'buried':
      return `Buried ${SHADE_NAME[s.shade]}`;
    case 'insight':
      return `Insight (${LIGHT_NAME[s.light]})`;
  }
}

function segmentIcon(s: LightMixSegment): string {
  switch (s.kind) {
    case 'light':
    case 'insight':
      return sigil(s.light);
    case 'blend':
      return `<span class="mix__pair"><span data-light="${s.lights[0]}">${sigil(s.lights[0])}</span><span data-light="${s.lights[1]}">${sigil(s.lights[1])}</span></span>`;
    case 'neutral':
      return sigil('neutral');
    case 'buried':
      return sigil(s.shade);
  }
}

/**
 * The deck's Light Mix. Segments are sized by count in the order given (pass them in wheel order, then
 * Blends, neutral, Insight, Buried). `ghost` marks a segment index with a "+1" (hovered reward card).
 * `button: true` makes the whole bar one button (16.4: click opens the deck view); its segments then keep
 * their tips for the mouse only, since a button can't hold focusable children.
 */
export function lightMixMarkup(p: {
  segments: readonly LightMixSegment[];
  ghost?: number;
  width?: number | string;
  button?: boolean;
}): string {
  const total = p.segments.reduce((t, s) => t + Math.max(0, s.count), 0);
  const width = p.width === undefined ? null : cssLen(p.width);
  const segs = p.segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.count > 0)
    .map(({ s, i }) => {
      const attr =
        s.kind === 'light' || s.kind === 'insight'
          ? { 'data-light': s.light }
          : s.kind === 'blend'
            ? { 'data-light': s.lights[0], 'data-light2': s.lights[1] }
            : s.kind === 'buried'
              ? { 'data-face': s.shade }
              : { 'data-light': 'none' };
      const name = segmentName(s);
      const tip = `${name}: ${s.count}`;
      const ghost = p.ghost === i;
      return (
        `<span${attrs({ class: `mix__seg mix__seg--${s.kind}${ghost ? ' is-ghost' : ''} has-tip`, style: `flex:${s.count} 1 0`, ...attr, ...(p.button ? { 'data-tip': tip } : tipAttrs(tip)) })}>` +
        `${segmentIcon(s)}<b class="num">${s.count}</b>${ghost ? '<span class="mix__ghost">+1</span>' : ''}<span class="sr-only">${esc(name)} ${s.count}${ghost ? ', plus 1' : ''}</span></span>`
      );
    })
    .join('');
  const label = `Light Mix, ${total} cards${p.button ? '. Open the deck view' : ''}`;
  const style = width ? `width:${width}` : null;
  return p.button
    ? `<button${attrs({ class: 'mix mix--button', type: 'button', 'aria-label': label, style })}>${segs}</button>`
    : `<div${attrs({ class: 'mix', role: 'group', 'aria-label': label, style })}>${segs}</div>`;
}

// ------------------------------------------------------------------------------------------------
// Map nodes (11.4, 16.4): 56px circles; fights show their Shades' sigils
// ------------------------------------------------------------------------------------------------

export type MapNodeState = 'reachable' | 'visited' | 'unreachable' | 'current';

export interface MapNodeProps {
  kind: NodeIconName;
  state: MapNodeState;
  /** Fight and elite nodes: each Shade's faces (a compound has two, joined by a bar). 'numb' = Apathy. */
  shades?: readonly (readonly (Shade | 'numb')[])[];
  /** Boss nodes: draw the boss's own silhouette (16.4 "80px circle with its silhouette"). */
  silhouette?: Pick<ShadeArtOpts, 'family' | 'seed' | 'face' | 'innerFace' | 'nextFace' | 'ornament' | 'faces'>;
  /** Key number 1-4 shown on reachable nodes. */
  key?: number;
  /** Accessible label from the engine's node detail, e.g. "Fight: Fear and Anger". */
  label: string;
}

function shadeGroup(g: readonly (Shade | 'numb')[]): string {
  return g
    .map((s) =>
      s === 'numb'
        ? `<span class="map-node__numb" data-face="none">${sigil('numb')}<b>NUMB</b></span>`
        : `<span class="map-node__sigil" data-face="${s}">${sigil(s)}</span>`,
    )
    .join('<i class="joiner" aria-hidden="true"></i>');
}

/**
 * A map node button. Fights and elites with Shades show 1 to 3 sigil groups instead of the generic icon
 * (sigils shrink as more share the circle); a boss node can show its silhouette.
 */
export function mapNodeMarkup(p: MapNodeProps): string {
  const groups = (p.shades ?? []).slice(0, 3);
  const sigils = groups.reduce((t, g) => t + g.length, 0);
  const inner =
    (p.kind === 'fight' || p.kind === 'elite') && groups.length
      ? `<span class="map-node__sigils" data-n="${Math.min(3, sigils)}">${groups.map(shadeGroup).join('')}</span>`
      : p.kind === 'boss' && p.silhouette
        ? `<span class="map-node__silhouette">${shadeMarkup({ ...p.silhouette, size: '100%', shimmer: false, label: p.label })}</span>`
        : nodeIcon(p.kind);
  const key = p.key !== undefined && p.state === 'reachable' ? `<span class="map-node__key" aria-hidden="true">${p.key}</span>` : '';
  return `<button${attrs({ class: 'map-node', type: 'button', 'data-kind': p.kind, 'data-state': p.state, 'aria-label': p.label, disabled: p.state === 'unreachable' })}>${inner}${key}</button>`;
}

// ------------------------------------------------------------------------------------------------
// Map edges and legend (16.4): future edges dotted, travelled solid, the hovered route bright
// ------------------------------------------------------------------------------------------------

export type MapEdgeState = 'future' | 'travelled' | 'route';

export interface MapEdge {
  /** Centres of the two nodes (px) in the map container's coordinates. */
  from: readonly [number, number];
  to: readonly [number, number];
  state: MapEdgeState;
}

/**
 * Every edge of a map as one absolutely positioned SVG covering the container (width x height px).
 * Edges stop short of the node circles (`inset`, default 32px) so they never cross an icon.
 */
export function mapEdgesMarkup(p: { width: number; height: number; edges: readonly MapEdge[]; inset?: number }): string {
  const inset = p.inset ?? 32;
  const lines = p.edges
    .map((e) => {
      const [x0, y0] = e.from;
      const [x1, y1] = e.to;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const k = Math.min(0.45, inset / len);
      const a = [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
      const b = [x1 - (x1 - x0) * k, y1 - (y1 - y0) * k];
      return `<path class="map-edge" data-state="${e.state}" d="M${n(a[0]!)} ${n(a[1]!)}L${n(b[0]!)} ${n(b[1]!)}"/>`;
    })
    .join('');
  return `<svg${attrs({ class: 'map-edges', viewBox: `0 0 ${n(p.width)} ${n(p.height)}`, style: `width:${n(p.width)}px;height:${n(p.height)}px`, 'aria-hidden': 'true', focusable: 'false' })}>${lines}</svg>`;
}

const LEGEND: readonly [NodeIconName, string][] = [
  ['fight', 'Fight'],
  ['elite', 'Elite'],
  ['haven', 'Haven: rest'],
  ['sanctuary', 'Sanctuary: shop'],
  ['memory', 'Memory'],
  ['chest', 'Chest'],
  ['boss', 'Boss'],
];

/** The always-visible map legend: every node kind's icon and label. */
export function mapLegendMarkup(): string {
  return (
    `<ul class="map-legend" aria-label="Map legend">` +
    LEGEND.map(([kind, label]) => `<li><span class="map-node map-node--legend" data-kind="${kind}" aria-hidden="true">${nodeIcon(kind)}</span>${esc(label)}</li>`).join('') +
    `</ul>`
  );
}
