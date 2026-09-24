// HUD pieces (DESIGN 16.2, 18.1, 19): status chips, matchup chips, Heart and Intensity bars, Guard badge and
// bubble, intent pills, floating numbers, lethal banners, the Shade nameplate and tooltips.
// Pure presentation: every number and sentence comes from the engine (preview, intents, statuses).
//
// Tooltips: anything with a tip sentence is focusable (tabindex 0) and shows the sentence on hover, focus
// or tap through CSS (`.has-tip[data-tip]`), and carries it as screen-reader text, so touch and keyboard
// users reach the same information as a mouse. There is no bare `title` tooltip anywhere.

import type { AfflictionId, Light, Shade } from '../../engine/emotions';
import { AFFLICTION_CURE, AFFLICTION_OF, cureOf, dissonantLightOf } from '../../engine/emotions';
import type { IntentKind } from '../../engine/types';
import { textWidth } from './cardFit';
import { AFFLICTION_NAME, LIGHT_NAME, SHADE_NAME } from './names';
import { intentIcon, markIcon, resourceIcon, sigil, sigilBody } from './sigils';
import { attrs, cssLen, esc, n, toElement } from './svg';

const SHADE_OF_AFFLICTION = Object.fromEntries(Object.entries(AFFLICTION_OF).map(([s, a]) => [a, s])) as Record<
  AfflictionId,
  Shade
>;

/** Attributes that make an element a keyboard- and touch-reachable tooltip anchor. */
export function tipAttrs(tip: string | undefined): Record<string, string | null> {
  return tip ? { tabindex: '0', 'data-tip': tip } : {};
}

/** Screen-reader copy of a tip, placed inside its anchor. */
export function tipText(tip: string | undefined): string {
  return tip ? `<span class="sr-only">. ${esc(tip)}</span>` : '';
}

// ------------------------------------------------------------------------------------------------
// Affliction drop (ink body, cure-colour rim, Shade sigil)
// ------------------------------------------------------------------------------------------------

/** The affliction drop icon: ink drop with a cure-colour rim around the inflicting Shade's sigil. */
export function afflictionDrop(id: AfflictionId | 'numb', o: { size?: number | string } = {}): string {
  const size = o.size === undefined ? null : cssLen(o.size);
  const inner =
    id === 'numb'
      ? `<g transform="translate(6.5 11) scale(0.46)" class="drop__sigil">${sigilBody('numb')}</g>`
      : `<g transform="translate(6.6 10.4) scale(0.45)" class="drop__sigil">${sigilBody(SHADE_OF_AFFLICTION[id])}</g>`;
  const face = id === 'numb' ? 'none' : SHADE_OF_AFFLICTION[id];
  return (
    `<svg${attrs({ class: 'drop', viewBox: '0 0 24 24', 'data-face': face, style: size ? `width:${size};height:${size}` : null, 'aria-hidden': 'true', focusable: 'false' })}>` +
    `<path class="drop__body" d="M12 1.8C14.2 5.4 19.4 10.4 19.4 14.9A7.4 7.4 0 0 1 4.6 14.9C4.6 10.4 9.8 5.4 12 1.8Z"/>${inner}</svg>`
  );
}

// ------------------------------------------------------------------------------------------------
// Status chips
// ------------------------------------------------------------------------------------------------

export type ChipKind = 'affliction' | 'buff' | 'debuff' | 'gauge' | 'flag';

export interface StatusChipProps {
  /** Display name: 'Seething', 'Flare', 'Pressure', 'Shy', 'Short Fuse', 'Turns left'. */
  label: string;
  /** Stacks or gauge text ('4/6'). Omit for flags. */
  value?: number | string;
  kind: ChipKind;
  /** Affliction chips: which affliction (drop icon, rim colour). */
  affliction?: AfflictionId | 'numb';
  /** Optional icon markup (e.g. markIcon('promise')). Buff chips default to the notched triangle. */
  icon?: string;
  /** Tooltip sentence from the engine (shown on hover, focus and tap; read by screen readers). */
  title?: string;
}

export function statusChipMarkup(p: StatusChipProps): string {
  const face = p.affliction && p.affliction !== 'numb' ? SHADE_OF_AFFLICTION[p.affliction] : null;
  const icon =
    p.icon ??
    (p.kind === 'affliction' && p.affliction
      ? afflictionDrop(p.affliction)
      : p.kind === 'buff'
        ? intentIcon('buff')
        : p.kind === 'debuff'
          ? markIcon('chevronDown')
          : '');
  const value = p.value === undefined ? '' : ` <b class="chip__n">${esc(p.value)}</b>`;
  return `<span${attrs({
    class: `chip chip--${p.kind}${p.title ? ' has-tip' : ''}`,
    'data-face': face ?? (p.affliction === 'numb' ? 'none' : null),
    ...tipAttrs(p.title),
  })}>${icon}<span class="chip__text">${esc(p.label)}${value}</span>${tipText(p.title)}</span>`;
}

/** A row of status chips; more than `max` collapse into a "+N" chip that expands on hover and focus (16.2). */
export function chipRowMarkup(chips: readonly StatusChipProps[], max = 3): string {
  const shown = chips.length > max ? chips.slice(0, max - 1) : chips;
  const hidden = chips.length > max ? chips.slice(max - 1) : [];
  const names = hidden.map((c) => c.label + (c.value !== undefined ? ` ${c.value}` : '')).join(', ');
  const more = hidden.length
    ? `<span class="chip chip--more" tabindex="0" aria-label="${esc(`${hidden.length} more: ${names}`)}">+${hidden.length}<span class="chip-row__overflow">${hidden.map(statusChipMarkup).join('')}</span></span>`
    : '';
  return `<div class="chip-row">${shown.map(statusChipMarkup).join('')}${more}</div>`;
}

// ------------------------------------------------------------------------------------------------
// Matchup chips (nameplate row 3)
// ------------------------------------------------------------------------------------------------

export interface MatchupChipProps {
  kind: 'opposite' | 'dissonant' | 'felt' | 'muffled';
  /** OPPOSITE: the cure. DISSONANT: the bad-advice Light. Unused for FELT / MUFFLED. */
  light?: Light;
  /** Tooltip, e.g. "OPPOSITE: Love deals double and Resolves Anger." */
  title?: string;
}

export function matchupChipMarkup(p: MatchupChipProps): string {
  const tip = { ...tipAttrs(p.title) };
  const has = p.title ? ' has-tip' : '';
  if (p.kind === 'felt') {
    return `<span${attrs({ class: `matchup matchup--felt${has}`, ...tip })}>${markIcon('ringDouble')}<b>FELT x2</b><span>two Lights</span>${tipText(p.title)}</span>`;
  }
  if (p.kind === 'muffled') {
    return `<span${attrs({ class: `matchup matchup--muffled${has}`, ...tip })}>${markIcon('ringSingle')}<b>MUFFLED x1/2</b><span>one Light</span>${tipText(p.title)}</span>`;
  }
  const l = p.light!;
  const opposite = p.kind === 'opposite';
  const mark = markIcon(opposite ? 'chevronUp2' : 'chevronDown', { className: 'matchup__mark' });
  const mult = opposite ? 'x2' : 'x1/2';
  const word = opposite ? 'OPPOSITE' : 'DISSONANT';
  return (
    `<span${attrs({ class: `matchup matchup--${p.kind}${has}`, 'data-light': l, ...tip })}>` +
    `<span class="sr-only">${word} ${mult}: ${LIGHT_NAME[l]}</span>` +
    `<span class="matchup__vis" aria-hidden="true">${sigil(l)}<b>${mult}</b>${mark}</span>${tipText(p.title)}</span>`
  );
}

// ------------------------------------------------------------------------------------------------
// Bars (Heart 240x18 pearl, Intensity 180x14 grey) with lag chunk and hatched preview
// ------------------------------------------------------------------------------------------------

export interface BarProps {
  kind: 'heart' | 'intensity';
  value: number;
  max: number;
  /** Predicted loss: hatched segment at the fill's right edge. */
  previewLoss?: number;
  /** Mend preview: bright outline extension ("+4"). */
  previewGain?: number;
  /** Heart: predicted loss >= Heart, the outline pulses. */
  lethal?: boolean;
  /** Width override (number = px, string = CSS length). Defaults 240 (Heart) / 180 (Intensity) reference px. */
  width?: number | string;
  label?: string;
}

const frac = (v: number, max: number): number => (max <= 0 ? 0 : Math.max(0, Math.min(1, v / max)));

export function barMarkup(p: BarProps): string {
  const pct = frac(p.value, p.max);
  const loss = Math.min(p.value, Math.max(0, p.previewLoss ?? 0));
  const gain = Math.min(p.max - p.value, Math.max(0, p.previewGain ?? 0));
  const width = p.width !== undefined ? cssLen(p.width) : null;
  const label = p.label ?? `${p.value}/${p.max}`;
  const style = `--p:${n(pct)};--loss:${n(frac(loss, p.max))};--gain:${n(frac(gain, p.max))}${width ? `;width:${width}` : ''}`;
  return (
    `<div${attrs({
      class: `bar bar--${p.kind}${loss || gain ? ' bar--previewing' : ''}`,
      style,
      role: 'meter',
      'aria-valuemin': 0,
      'aria-valuemax': p.max,
      'aria-valuenow': p.value,
      'aria-label': `${p.kind === 'heart' ? 'Heart' : 'Intensity'} ${label}${loss ? `, preview -${loss}` : ''}${gain ? `, preview +${gain}` : ''}`,
      'data-lethal': p.lethal ? 'true' : null,
    })}>` +
    `<div class="bar__lag"></div><div class="bar__fill"></div>` +
    (loss ? `<div class="bar__loss"></div>` : '') +
    (gain ? `<div class="bar__gain"></div>` : '') +
    `<span class="bar__label bar__label--light"><span>${esc(label)}</span></span>` +
    `<span class="bar__label bar__label--dark" aria-hidden="true"><span>${esc(label)}</span></span>` +
    `</div>`
  );
}

/**
 * Change a rendered bar's value. The fill drops at once and the pale lag chunk drains after 400 ms (18.1),
 * both driven by CSS transitions on --p. Previews are cleared; re-render to show a new one.
 */
export function setBarValue(bar: HTMLElement, value: number, max: number, label = `${value}/${max}`): void {
  bar.style.setProperty('--p', n(frac(value, max)));
  bar.setAttribute('aria-valuenow', String(value));
  bar.setAttribute('aria-valuemax', String(max));
  bar.querySelector('.bar__loss')?.remove();
  bar.querySelector('.bar__gain')?.remove();
  bar.classList.remove('bar--previewing');
  for (const el of bar.querySelectorAll('.bar__label > span')) el.textContent = label;
}

// ------------------------------------------------------------------------------------------------
// Guard
// ------------------------------------------------------------------------------------------------

/**
 * Silver shield badge with the Guard number (left of a bar). At 0 it returns '' unless `reserve` is set,
 * which keeps an empty slot of the same size so nothing shifts when Guard appears.
 */
export function guardBadgeMarkup(guard: number, o: { after?: number; reserve?: boolean; title?: string } = {}): string {
  if (guard <= 0 && !o.after) return o.reserve ? `<span class="guard-badge guard-badge--empty" aria-hidden="true"></span>` : '';
  const after = o.after !== undefined && o.after !== guard ? `<span class="guard-badge__after">${o.after}</span>` : '';
  return `<span${attrs({ class: `guard-badge${o.title ? ' has-tip' : ''}`, 'aria-label': `Guard ${guard}`, role: 'img', ...tipAttrs(o.title) })}>${resourceIcon('guard')}<b class="num">${guard}</b>${after}</span>`;
}

/**
 * The player's translucent silver hexagon Guard bubble (16.2), built from 6 shards so a break can scatter them.
 * state: 'crack' when hit, 'shatter' when broken (18.1, 250 ms).
 */
export function guardBubbleMarkup(o: { state?: 'idle' | 'crack' | 'shatter'; size?: number | string } = {}): string {
  const size = cssLen(o.size ?? 'calc(var(--u) * 190)');
  let shards = '';
  for (let i = 0; i < 6; i++) {
    const a0 = ((i * 60 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
    const p0 = [50 + 46 * Math.cos(a0), 50 + 46 * Math.sin(a0)];
    const p1 = [50 + 46 * Math.cos(a1), 50 + 46 * Math.sin(a1)];
    const mid = ((i * 60 + 30 - 90) * Math.PI) / 180;
    const sx = Math.cos(mid) * 26;
    const sy = Math.sin(mid) * 26;
    shards += `<path class="guard-bubble__shard" style="--sx:${n(sx)}px;--sy:${n(sy)}px;--sr:${i % 2 ? -35 : 35}deg" d="M50 50L${n(p0[0]!)} ${n(p0[1]!)}L${n(p1[0]!)} ${n(p1[1]!)}Z"/>`;
  }
  const cracks = `<path class="guard-bubble__crack" d="M50 8L46 24L54 32L47 44M72 20L64 30L68 38"/>`;
  return `<svg${attrs({ class: 'guard-bubble', viewBox: '0 0 100 100', 'data-state': o.state ?? 'idle', style: `width:${size};height:${size}`, 'aria-hidden': 'true', focusable: 'false' })}>${shards}<path class="guard-bubble__rim" d="M50 4L89.8 27V73L50 96L10.2 73V27Z"/>${cracks}</svg>`;
}

// ------------------------------------------------------------------------------------------------
// Intent pill
// ------------------------------------------------------------------------------------------------

export interface IntentItem {
  kind: IntentKind;
  /** Strike amount per strike, Guard amount, Mend amount, Scatter count, stacks for buffs. */
  value?: number;
  /** Strike count for multi-strikes ("3x4"). */
  count?: number;
  /** Afflict: the affliction and its stacks. */
  affliction?: AfflictionId | 'numb';
  stacks?: number;
}

export interface IntentPillProps {
  items: readonly IntentItem[];
  /** Order badge 1 to 4 when 2+ Shades act. */
  order?: number;
  /** The pill shows the projected intent (after end of turn). */
  projected?: boolean;
  /** Tooltip sentence: IntentView.text, plus the projected cause ("Lantern Moth will turn it to Fear."). */
  title?: string;
  /** Spoken label. Default: the tooltip sentence, else a summary built from the items ("Strike 3 x4"). */
  label?: string;
}

function intentItemMarkup(it: IntentItem): string {
  if (it.kind === 'afflict' && it.affliction) {
    return `<span class="intent-item intent-item--afflict" data-face="${it.affliction === 'numb' ? 'none' : SHADE_OF_AFFLICTION[it.affliction]}">${afflictionDrop(it.affliction)}<b class="num">${it.stacks ?? ''}</b></span>`;
  }
  const num =
    it.kind === 'strike' && it.count && it.count > 1
      ? `${it.value ?? 0}x${it.count}`
      : it.value !== undefined
        ? String(it.value)
        : '';
  return `<span class="intent-item intent-item--${it.kind}">${intentIcon(it.kind)}${num ? `<b class="num">${num}</b>` : ''}</span>`;
}

const INTENT_WORD: Record<IntentKind, string> = {
  strike: 'Strike',
  guard: 'Guard',
  afflict: 'Afflict',
  buff: 'Grows stronger',
  mend: 'Mend',
  summon: 'Summon',
  scatter: 'Scatter',
};

function intentSummary(items: readonly IntentItem[]): string {
  return items
    .map((it) => {
      if (it.kind === 'afflict' && it.affliction) return `${AFFLICTION_NAME[it.affliction]} ${it.stacks ?? ''}`.trim();
      if (it.kind === 'strike' && it.count && it.count > 1) return `Strike ${it.value ?? 0} x${it.count}`;
      return `${INTENT_WORD[it.kind]}${it.value !== undefined ? ` ${it.value}` : ''}`;
    })
    .join(', ');
}

export function intentPillMarkup(p: IntentPillProps): string {
  const order = p.order ? `<span class="intent-pill__order" aria-hidden="true">${p.order}</span>` : '';
  const tag = p.projected ? `<span class="intent-pill__tag" aria-hidden="true">${markIcon('turn')}after end of turn</span>` : '';
  const spoken =
    (p.order ? `Acts ${p.order}. ` : '') +
    (p.projected ? 'After end of turn: ' : '') +
    (p.label ?? p.title ?? intentSummary(p.items));
  return (
    `<div${attrs({ class: `intent-pill${p.title ? ' has-tip' : ''}`, 'data-projected': p.projected ? 'true' : null, role: 'img', 'aria-label': spoken, ...tipAttrs(p.title) })}>` +
    `${order}<div class="intent-pill__items" aria-hidden="true">${p.items.map(intentItemMarkup).join('')}</div>${tag}</div>`
  );
}

// ------------------------------------------------------------------------------------------------
// Floating numbers (18.1)
// ------------------------------------------------------------------------------------------------

export type FloatKind = 'opposite' | 'neutral' | 'dissonant' | 'felt' | 'muffled' | 'blocked' | 'mend' | 'loss';

export interface FloatingNumberProps {
  kind: FloatKind;
  value: number;
  /** OPPOSITE: the Light; FELT: both Lights. */
  lights?: readonly Light[];
  /** DISSONANT: the bad-advice line, shown in italics for 1.2 s. */
  line?: string;
}

export function floatingNumberMarkup(p: FloatingNumberProps): string {
  const [a, b] = p.lights ?? [];
  const text =
    p.kind === 'blocked'
      ? `Blocked ${p.value}`
      : p.kind === 'mend'
        ? `+${p.value}`
        : p.kind === 'loss'
          ? `-${p.value}`
          : String(p.value);
  const tag =
    p.kind === 'opposite' || p.kind === 'felt'
      ? `<span class="float-num__tag">x2</span>`
      : p.kind === 'dissonant' || p.kind === 'muffled'
        ? `<span class="float-num__tag">x1/2</span>`
        : '';
  // FELT is two Lights at once: a hard two-tone split and both sigils, never a blended gradient.
  const felt =
    p.kind === 'felt' && a
      ? `<span class="float-num__sigils"><span data-light="${a}">${sigil(a)}</span>${b ? `<span data-light="${b}">${sigil(b)}</span>` : ''}</span>`
      : '';
  const icon = p.kind === 'blocked' ? resourceIcon('guard') : p.kind === 'mend' || p.kind === 'loss' ? resourceIcon('heart') : '';
  const line = p.kind === 'dissonant' && p.line ? `<span class="float-num__line">${esc(p.line)}</span>` : '';
  return `<div${attrs({ class: `float-num float-num--${p.kind}`, 'data-light': a ?? null, 'data-light2': b ?? null, 'aria-hidden': 'true' })}><span class="float-num__v">${felt}${icon}<span class="float-num__n">${esc(text)}</span>${tag}</span>${line}</div>`;
}

/**
 * Spawn a floating number at (x, y) inside a positioned container; it removes itself when its animation
 * ends (or after 1.6 s as a fallback). Returns the element.
 */
export function spawnFloatingNumber(container: HTMLElement, p: FloatingNumberProps, x: number, y: number): HTMLElement {
  const el = toElement<HTMLElement>(floatingNumberMarkup(p));
  el.style.left = `${n(x)}px`;
  el.style.top = `${n(y)}px`;
  container.append(el);
  const done = () => el.remove();
  el.addEventListener('animationend', (e) => {
    if (e.target === el) done();
  });
  setTimeout(done, 1600);
  return el;
}

// ------------------------------------------------------------------------------------------------
// Lethal banners (16.2)
// ------------------------------------------------------------------------------------------------

export interface LethalBannerProps {
  kind: 'resolve' | 'deepResolve' | 'suppress' | 'fade' | 'wavering';
  /** RESOLVE: the finishing Light. DEEP RESOLVE: both. */
  lights?: readonly Light[];
  /** Sub-lines from the engine, e.g. ['+8 Glimmers', 'Caution: +6 Guard'] or ['Buried Anger joins your deck (Weight 1)']. */
  sub?: readonly string[];
  /** SUPPRESS: "Resolve with: Kind Word" hint. */
  resolveWith?: string;
}

const BANNER_WORD: Record<LethalBannerProps['kind'], string> = {
  resolve: 'RESOLVE',
  deepResolve: 'DEEP RESOLVE',
  suppress: 'SUPPRESS',
  fade: 'FADES',
  wavering: 'stops at 1',
};

/**
 * Lethal banner. It is not a live region: every target previews at once, so only the Play Line
 * (aria-live) announces the focused one.
 */
export function lethalBannerMarkup(p: LethalBannerProps): string {
  const [a, b] = p.lights ?? [];
  const emblem =
    p.kind === 'resolve' || p.kind === 'deepResolve'
      ? markIcon('sunburst', { className: 'lethal-banner__emblem' })
      : p.kind === 'suppress'
        ? markIcon('seal', { className: 'lethal-banner__emblem' })
        : p.kind === 'fade'
          ? markIcon('fade', { className: 'lethal-banner__emblem' })
          : '';
  const subs = p.sub ?? [];
  const sub = subs.length ? `<span class="lethal-banner__sub">${subs.map((s) => `<span>${esc(s)}</span>`).join('')}</span>` : '';
  const hint = p.resolveWith ? `<span class="lethal-banner__hint">Resolve with: <b>${esc(p.resolveWith)}</b></span>` : '';
  return (
    `<div${attrs({ class: `lethal-banner lethal-banner--${p.kind}`, 'data-light': a ?? null, 'data-light2': b ?? a ?? null })}>` +
    `${emblem}<span class="lethal-banner__word">${BANNER_WORD[p.kind]}</span>${sub}${hint}</div>`
  );
}

// ------------------------------------------------------------------------------------------------
// Nameplate (205px: face row, Intensity row, matchup row, status row)
// ------------------------------------------------------------------------------------------------

export interface NameplateProps {
  /** Showing face, or null for Apathy and The Numbness (grey NUMB oval). */
  face: Shade | null;
  name: string;
  /** Two-faced Shades: the face beneath (shown small with a turn arrow). */
  beneath?: Shade | null;
  /** The Mask: its next face. */
  nextFace?: Shade | null;
  hp: number;
  maxHp: number;
  guard: number;
  /** Preview: Intensity lost by the selected card (hatched ghost). */
  previewLoss?: number;
  matchups: readonly MatchupChipProps[];
  chips: readonly StatusChipProps[];
}

/** Room for the name row inside the 205px slot. */
const NAME_ROW_W = 196;

export function nameplateMarkup(p: NameplateProps): string {
  const faceIcon = p.face
    ? `<span class="shade-disc nameplate__face" data-face="${p.face}">${sigil(p.face)}</span>`
    : `<span class="shade-disc nameplate__face nameplate__face--numb" data-face="none">${sigil('numb')}</span>`;
  const typeWord = p.face ? SHADE_NAME[p.face].toUpperCase() : 'NUMB';
  // "Surfaced Loneliness" already says its type; the caps word would only repeat it.
  const showType = !p.name.toUpperCase().includes(typeWord);
  const beneath = p.beneath
    ? `<span${attrs({ class: 'nameplate__beneath has-tip', 'data-face': p.beneath, ...tipAttrs(`Beneath: ${SHADE_NAME[p.beneath]}. OPPOSITE hits turn it.`) })}><span class="sr-only">Beneath: ${SHADE_NAME[p.beneath]}. OPPOSITE hits turn it.</span><span class="nameplate__beneath-vis" aria-hidden="true">${sigil(p.beneath)}${markIcon('turn')}</span></span>`
    : '';
  const next = p.nextFace
    ? `<span${attrs({ class: 'nameplate__beneath has-tip', 'data-face': p.nextFace, ...tipAttrs(`Next face: ${SHADE_NAME[p.nextFace]}.`) })}><span class="sr-only">Next face: ${SHADE_NAME[p.nextFace]}.</span><span class="nameplate__beneath-vis" aria-hidden="true">next ${sigil(p.nextFace)}</span></span>`
    : '';
  const typeW = showType ? textWidth(typeWord, 12, true, 0.03) + 16 : 0;
  const badgesW = (p.beneath ? 38 : 0) + (p.nextFace ? 46 : 0);
  const rowW = 24 + typeW + textWidth(p.name, 14, true) + badgesW;
  // Too long for one row: the type line keeps the disc, caps word and badges; the name gets its own line.
  const stacked = rowW > NAME_ROW_W;
  const type = showType ? `<span class="nameplate__type">${typeWord}</span>${stacked ? '' : '<span class="nameplate__dot" aria-hidden="true">·</span>'}` : '';
  const name = `<span class="nameplate__name">${esc(p.name)}</span>`;
  const nameRows = stacked
    ? `<div class="nameplate__row nameplate__row--name">${faceIcon}${type}${beneath}${next}</div><div class="nameplate__row nameplate__row--name2">${name}</div>`
    : `<div class="nameplate__row nameplate__row--name">${faceIcon}${type}${name}${beneath}${next}</div>`;
  return (
    `<div class="nameplate${stacked ? ' nameplate--stacked' : ''}" data-face="${p.face ?? 'none'}">` +
    nameRows +
    `<div class="nameplate__row nameplate__row--bar">${guardBadgeMarkup(p.guard, { reserve: true })}${barMarkup({ kind: 'intensity', value: p.hp, max: p.maxHp, ...(p.previewLoss ? { previewLoss: p.previewLoss } : {}) })}</div>` +
    `<div class="nameplate__row nameplate__row--matchups">${p.matchups.map(matchupChipMarkup).join('')}</div>` +
    `<div class="nameplate__row nameplate__row--chips">${chipRowMarkup(p.chips)}</div>` +
    `</div>`
  );
}

/**
 * Default matchup chips for a face: its cure x2 and its DISSONANT Light x1/2 (derived from the wheel),
 * with the 16.2 tooltips. Pass the Shade's bad-advice line (content lines) to include the DISSONANT chip.
 * The older `{ light, line }` form is still accepted; its light is ignored in favour of the wheel's.
 */
export function defaultMatchups(face: Shade | null, badAdvice?: string | { light: Light; line: string }): MatchupChipProps[] {
  if (!face) {
    return [
      { kind: 'felt', title: 'FELT: a hit with two Lights deals double and can Resolve it.' },
      { kind: 'muffled', title: 'MUFFLED: a hit with one Light or none deals half.' },
    ];
  }
  const cure = cureOf(face);
  const out: MatchupChipProps[] = [
    { kind: 'opposite', light: cure, title: `OPPOSITE: ${LIGHT_NAME[cure]} deals double and Resolves ${SHADE_NAME[face]}.` },
  ];
  const line = typeof badAdvice === 'string' ? badAdvice : badAdvice?.line;
  if (line !== undefined) {
    const bad = dissonantLightOf(face);
    out.push({
      kind: 'dissonant',
      light: bad,
      title: `DISSONANT: '${line}' ${LIGHT_NAME[bad]} deals half and gives ${SHADE_NAME[face]} 1 Flare.`,
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Tooltip
// ------------------------------------------------------------------------------------------------

/** Tooltip box (position it yourself). Lines should stay under 60 characters (19). */
export function tooltipMarkup(p: { title?: string; lines: readonly string[]; arrow?: 'up' | 'down' }): string {
  const cls = `tooltip${p.arrow ? ` tooltip--${p.arrow}` : ''}`;
  return `<div class="${cls}" role="tooltip">${p.title ? `<span class="tooltip__title">${esc(p.title)}</span>` : ''}${p.lines
    .map((l) => `<span class="tooltip__line">${esc(l)}</span>`)
    .join('')}</div>`;
}

/** Which Light soothes an affliction (for tooltips such as "Love cards soothe 1"). */
export const soothingLight = (a: AfflictionId): Light => AFFLICTION_CURE[a];

/** Element helpers for screens that prefer nodes to markup. */
export const widgetElement = <T extends Element = HTMLElement>(markup: string): T => toElement<T>(markup);
