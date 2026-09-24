// Run-level HUD pieces (DESIGN 4.16, 11.4, 16.4, 16.5): the Numbness meter, the Light Mix bar and map
// nodes with Shade sigils. Counts and names come from the engine (nodeDetail, deck summaries).

import type { Light, Shade } from '../../engine/emotions';
import { blendOfLights } from '../../engine/emotions';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from './names';
import { nodeIcon, numbBadge, sigil } from './sigils';
import type { NodeIconName } from './sigils';
import { attrs, cssLen, esc } from './svg';
import { tipAttrs, tipText } from './widgets';

// ------------------------------------------------------------------------------------------------
// The Numbness meter (4.16): grey NUMB oval, "The Numbness: N will surface"
// ------------------------------------------------------------------------------------------------

export function numbnessMeterMarkup(p: { count: number; title?: string }): string {
  const count = Math.max(0, Math.min(3, Math.floor(p.count)));
  const pips = [0, 1, 2].map((i) => `<i class="numb-meter__pip${i < count ? ' is-on' : ''}"></i>`).join('');
  return (
    `<div${attrs({ class: `numb-meter${p.title ? ' has-tip' : ''}`, ...tipAttrs(p.title) })}>` +
    `${numbBadge({ className: 'numb-meter__badge' })}<span class="numb-meter__text">The Numbness: <b class="num">${count}</b> will surface</span>` +
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
 */
export function lightMixMarkup(p: { segments: readonly LightMixSegment[]; ghost?: number; width?: number | string }): string {
  const total = p.segments.reduce((t, s) => t + Math.max(0, s.count), 0) || 1;
  const width = p.width === undefined ? null : cssLen(p.width);
  const segs = p.segments
    .filter((s) => s.count > 0)
    .map((s) => {
      const i = p.segments.indexOf(s);
      const attr =
        s.kind === 'light' || s.kind === 'insight'
          ? { 'data-light': s.light }
          : s.kind === 'blend'
            ? { 'data-light': s.lights[0], 'data-light2': s.lights[1] }
            : s.kind === 'buried'
              ? { 'data-face': s.shade }
              : { 'data-light': 'none' };
      const name = segmentName(s);
      return (
        `<span${attrs({ class: `mix__seg mix__seg--${s.kind}${p.ghost === i ? ' is-ghost' : ''} has-tip`, style: `flex:${s.count} 1 0`, ...attr, ...tipAttrs(`${name}: ${s.count}`) })}>` +
        `${segmentIcon(s)}<b class="num">${s.count}</b>${p.ghost === i ? '<span class="mix__ghost">+1</span>' : ''}<span class="sr-only">${esc(name)} ${s.count}</span></span>`
      );
    })
    .join('');
  return `<div${attrs({ class: 'mix', role: 'group', 'aria-label': `Light Mix, ${total} cards`, style: width ? `width:${width}` : null })}>${segs}</div>`;
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
  /** Key number 1-4 shown on reachable nodes. */
  key?: number;
  /** Accessible label from the engine's node detail, e.g. "Fight: Fear and Anger". */
  label: string;
}

function shadeGroup(g: readonly (Shade | 'numb')[]): string {
  return g
    .map((s) => (s === 'numb' ? numbBadge({ className: 'map-node__numb' }) : `<span class="map-node__sigil" data-face="${s}">${sigil(s)}</span>`))
    .join('<i class="joiner"></i>');
}

/** A map node button. Fights with Shades show 1 to 3 sigil groups instead of the generic icon. */
export function mapNodeMarkup(p: MapNodeProps): string {
  const groups = (p.shades ?? []).slice(0, 3);
  const inner =
    (p.kind === 'fight' || p.kind === 'elite') && groups.length
      ? `<span class="map-node__sigils">${groups.map(shadeGroup).join('')}</span>`
      : nodeIcon(p.kind);
  const key = p.key !== undefined && p.state === 'reachable' ? `<span class="map-node__key" aria-hidden="true">${p.key}</span>` : '';
  return `<button${attrs({ class: 'map-node', type: 'button', 'data-kind': p.kind, 'data-state': p.state, 'aria-label': p.label, disabled: p.state === 'unreachable' })}>${inner}${key}</button>`;
}
