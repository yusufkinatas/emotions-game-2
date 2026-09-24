// Card face renderer (DESIGN 16.2 "Hand and card face"). Pure presentation: every number and word comes in
// through props (the engine's cardText, handHints and describeCard); the kit only lays it out.
// Reference size 130x182. Scale a card with the CSS variable --cu (card unit), e.g. style="--cu: calc(var(--u) * 1.4)".
// Text never drops below 12px: long rules texts take space from the art band instead (cardFit.ts).

import type { Light, Shade } from '../../engine/emotions';
import { AFFLICTION_OF, BLENDS, blendOfLights, lightsOfBlend } from '../../engine/emotions';
import type { Rarity } from '../../engine/types';
import { CARD_KEYWORD_RE, TEXT_FLOOR, fitCard, footerFits } from './cardFit';
import { hashSeed, rand } from './hash';
import { AFFLICTION_NAME, BLEND_NAME, LIGHT_NAME, SHADE_NAME } from './names';
import { markIcon, sigil, sigilBody } from './sigils';
import { attrs, esc, n, toElement } from './svg';

export type CardState = 'idle' | 'playable' | 'selected' | 'unaffordable' | 'numbed';
export type CostState = 'normal' | 'raised' | 'lowered' | 'unaffordable';

export interface CardFaceProps {
  name: string;
  /** Printed Lights: [] neutral or Buried, 1 mono, 2 Blend (wheel order). */
  lights: readonly Light[];
  /** Final cost to show, or null for Unplayable (Buried). */
  cost: number | null;
  costState?: CostState;
  /** Kind word for the footer: 'Ease', 'Skill', 'Mood', 'Buried', 'Insight'. */
  kindLabel: string;
  /** Rules text already rendered by the engine. The kit bolds every number and marks keywords. */
  text: string;
  rarity: Rarity;
  upgraded?: boolean;
  /** Buried card: ink body, cracked border in the cure colour, Weight pips and a "W2" label. */
  buried?: { weight: number; shade: Shade };
  /** Insight card: turning six-hue border, prism mark and the INSIGHT label. */
  insight?: boolean;
  /** Context chips above the card, max 2 shown (engine priority order). */
  chips?: readonly string[];
  state?: CardState;
  /** Footer text. Default: "LOVE · EASE" style from lights and kindLabel. Numbed cards show "NO LIGHT". */
  footer?: string;
  /** Optional up/down triangle after the Nth number in the text (contextual numbers, 16.2). */
  numberTrends?: readonly ('up' | 'down' | null)[];
  /** Root tag. Screens that make cards clickable should pass 'button'. */
  tag?: 'div' | 'button';
  /** Accessible label. Default: "Kind Word, Love, cost 1. Ease 6." (Buried: "..., Weight 2, unplayable."). */
  ariaLabel?: string;
  /** Extra classes on the root. */
  className?: string;
  /** Seed for the art-band motif. Default: hash of the name, so a card always looks the same. */
  seed?: number;
}

/** Escape card text, bold every number (with optional trend triangles) and mark keywords. */
export function formatCardText(text: string, trends: readonly ('up' | 'down' | null)[] = []): string {
  let numberIndex = 0;
  return text
    .split(/(\d+)/)
    .map((part, i) => {
      if (i % 2 === 1) {
        const trend = trends[numberIndex++] ?? null;
        const tri = trend ? markIcon(trend === 'up' ? 'triUp' : 'triDown', { className: `trend trend--${trend}` }) : '';
        return `<b class="n${trend ? ` n--${trend}` : ''}">${part}${tri}</b>`;
      }
      return esc(part).replace(CARD_KEYWORD_RE, (kw) => {
        const cls = kw === 'Harmony:' ? 'kw kw--harmony' : 'kw';
        return `<span class="${cls}">${kw}</span>`;
      });
    })
    .join('');
}

/** Footer as its essential type word and an optional kind that may drop when space is tight. */
interface FooterParts {
  main: string;
  rest: string;
}

function footerParts(p: Pick<CardFaceProps, 'lights' | 'kindLabel' | 'buried' | 'insight' | 'footer'>): FooterParts {
  if (p.footer !== undefined) {
    const [main, ...rest] = p.footer.split(' · ');
    return { main: main ?? '', rest: rest.length ? ` · ${rest.join(' · ')}` : '' };
  }
  if (p.buried) return { main: 'BURIED', rest: ` · ${SHADE_NAME[p.buried.shade].toUpperCase()}` };
  const blend = blendOfLights(p.lights);
  // Every Blend card is an Ease card (6.8), so a Blend footer is just the Blend's name.
  if (blend) return { main: BLEND_NAME[blend].toUpperCase(), rest: '' };
  const light = p.lights[0] ? LIGHT_NAME[p.lights[0]] : 'Neutral';
  const kind = p.insight ? 'Insight' : p.kindLabel;
  return { main: light.toUpperCase(), rest: ` · ${kind.toUpperCase()}` };
}

/** Footer words: "LOVE · EASE", "DELIGHT", "NEUTRAL · SKILL", "BURIED · ANGER", "CALM · INSIGHT". */
export function defaultFooter(p: Pick<CardFaceProps, 'lights' | 'kindLabel' | 'buried' | 'insight'>): string {
  const f = footerParts(p);
  return f.main + f.rest;
}

// ------------------------------------------------------------------------------------------------
// Chips: styled by what they say (the engine's chip strings, DESIGN 16.2)
// ------------------------------------------------------------------------------------------------

const BLEND_BY_NAME = new Map(BLENDS.map((b) => [BLEND_NAME[b].toLowerCase(), b]));
const SHADE_BY_NAME = new Map(Object.entries(SHADE_NAME).map(([k, v]) => [v.toLowerCase(), k as Shade]));
const AFFLICTION_SHADE = new Map(
  Object.entries(AFFLICTION_OF).map(([shade, aff]) => [AFFLICTION_NAME[aff].toLowerCase(), shade as Shade]),
);

/** Chip parts: the full engine sentence plus a short label for the compact hand view. */
function chip(cls: string, attrsText: string, icon: string, short: string, full: string): string {
  return (
    `<span class="card-chip${cls}"${attrsText}>${icon}` +
    `<span class="card-chip__short" aria-hidden="true">${esc(short)}</span>` +
    `<span class="card-chip__full">${chipText(full)}</span></span>`
  );
}

/**
 * One context chip. Recognises "HARMONY -> Delight", "Tends Buried Fear" and "Soothes Heavy".
 * It renders compact (icon and one word) and shows the full sentence while its card is hovered,
 * focused or selected, so chips never overrun their neighbours in a hand fan.
 */
export function cardChipMarkup(text: string): string {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words[0] === 'harmony') {
    const blend = words.map((w) => BLEND_BY_NAME.get(w)).find(Boolean);
    if (blend) {
      const [a, b] = lightsOfBlend(blend);
      return chip(' card-chip--harmony', ` data-light="${a}" data-light2="${b}"`, markIcon('harmony'), BLEND_NAME[blend], text);
    }
    return chip(' card-chip--harmony', '', markIcon('harmony'), 'Harmony', text);
  }
  const shade = words.map((w) => SHADE_BY_NAME.get(w)).find(Boolean);
  if (words[0] === 'tends' && shade) {
    return chip(' card-chip--tends', ` data-face="${shade}"`, sigil(shade), 'Tends', text);
  }
  const soothed = words.map((w) => AFFLICTION_SHADE.get(w)).find(Boolean);
  if (words[0] === 'soothes' && soothed) {
    const aff = AFFLICTION_NAME[AFFLICTION_OF[soothed]];
    return chip(' card-chip--soothes', ` data-face="${soothed}"`, sigil(soothed), aff, text);
  }
  return chip('', '', '', text.split(' ')[0] ?? text, text);
}

/** Chip label with the engine's ASCII arrow drawn as a real arrow. */
function chipText(s: string): string {
  return esc(s).replace(/-&gt;/g, '→');
}

// ------------------------------------------------------------------------------------------------
// Art band motif: the card's sigil large, plus seeded small echoes of it
// ------------------------------------------------------------------------------------------------

const ART_W = 122;
const ART_H = 70;

function placed(body: string, x: number, y: number, size: number, extra = ''): string {
  const s = size / 24;
  return `<g transform="translate(${n(x - size / 2)} ${n(y - size / 2)}) scale(${n(s)})"${extra}>${body}</g>`;
}

function motifMarkup(p: CardFaceProps, seed: number): string {
  const r = rand(hashSeed(seed, 'motif'));
  const echoes: string[] = [];
  const main: string[] = [];
  const names: ('neutral' | Light | Shade)[] = p.buried ? [p.buried.shade] : p.lights.length ? [...p.lights] : ['neutral'];
  const echoCount = r.int(4, 6);
  for (let i = 0; i < echoCount; i++) {
    const name = names[i % names.length]!;
    const left = i % 2 === 0;
    const x = left ? r.range(10, 36) : r.range(86, 112);
    const y = r.range(12, 58);
    const size = r.range(8, 13);
    const tone = names.length === 2 ? (name === names[0] ? 'var(--c)' : 'var(--c2)') : 'var(--c)';
    echoes.push(placed(sigilBody(name), x, y, size, ` style="color:${tone}" opacity="${n(r.range(0.22, 0.42))}"`));
  }
  // The motif is drawn for the 70px band and centred; shorter bands crop its top and bottom (slice).
  if (p.buried) {
    main.push(placed(sigilBody(p.buried.shade), ART_W / 2, ART_H / 2, 34, ' class="motif__shade"'));
  } else if (names.length === 2) {
    main.push(placed(sigilBody(names[0]!), ART_W / 2 - 15, ART_H / 2 - 2, 30, ' class="motif__main" style="color:var(--c)"'));
    main.push(placed(sigilBody(names[1]!), ART_W / 2 + 15, ART_H / 2 + 2, 30, ' class="motif__main" style="color:var(--c2)"'));
  } else {
    main.push(placed(sigilBody(names[0]!), ART_W / 2, ART_H / 2, 36, ' class="motif__main" style="color:var(--c)"'));
  }
  const glow = `<ellipse class="motif__glow" cx="${ART_W / 2}" cy="${ART_H / 2}" rx="34" ry="24"/>`;
  return `<svg class="card-face__motif" viewBox="0 0 ${ART_W} ${ART_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${glow}${echoes.join('')}${main.join('')}</svg>`;
}

// ------------------------------------------------------------------------------------------------
// Buried border cracks: jagged lines that stay inside a 10px band along the frame
// ------------------------------------------------------------------------------------------------

const CRACK_BAND = 10;

function cracksMarkup(seed: number): string {
  const r = rand(hashSeed(seed, 'cracks'));
  const W = 130;
  const H = 182;
  const paths: string[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    // Start on the frame edge, run along it and zigzag between the edge and the band's inner line.
    const side = i % 4;
    const horizontal = side === 0 || side === 2;
    const span = horizontal ? W : H;
    const len = r.range(22, 38);
    let t = r.range(0.14, 0.86) * span - len / 2;
    const depth = (d: number) => Math.min(CRACK_BAND, Math.max(1.5, d));
    const point = (along: number, inset: number): [number, number] =>
      side === 0 ? [along, inset] : side === 1 ? [W - inset, along] : side === 2 ? [along, H - inset] : [inset, along];
    let [x, y] = point(t, 1.5);
    let d = `M${n(x)} ${n(y)}`;
    const steps = r.int(4, 6);
    for (let s = 0; s < steps; s++) {
      t += len / steps;
      [x, y] = point(t, depth(s % 2 === 0 ? r.range(6, 9.5) : r.range(2, 4.5)));
      d += `L${n(x)} ${n(y)}`;
    }
    paths.push(`<path d="${d}"/>`);
  }
  return `<svg class="card-face__cracks" viewBox="0 0 130 182" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="cracks__glow">${paths.join('')}</g><g class="cracks__line">${paths.join('')}</g></svg>`;
}

// ------------------------------------------------------------------------------------------------
// Card face
// ------------------------------------------------------------------------------------------------

function badgeMarkup(p: CardFaceProps): string {
  if (p.buried) return `<div class="card-face__badge card-face__badge--shade">${sigil(p.buried.shade)}</div>`;
  if (p.lights.length === 2) {
    return `<div class="card-face__badge card-face__badge--blend"><span data-light="${p.lights[0]}">${sigil(p.lights[0]!)}</span><span data-light="${p.lights[1]}">${sigil(p.lights[1]!)}</span></div>`;
  }
  if (p.lights.length === 1) return `<div class="card-face__badge">${sigil(p.lights[0]!)}</div>`;
  return `<div class="card-face__badge card-face__badge--neutral">${sigil('neutral')}</div>`;
}

const clampWeight = (w: number): number => Math.max(0, Math.min(3, Math.floor(w)));

function costMarkup(p: CardFaceProps): string {
  if (p.buried) {
    const w = clampWeight(p.buried.weight);
    const pips = [0, 1, 2].map((i) => `<i class="pip${i < w ? ' pip--on' : ''}"></i>`).join('');
    return `<div class="card-face__weight" aria-hidden="true">${pips}<b class="card-face__weight-n">W${w}</b></div>`;
  }
  if (p.cost === null) return '';
  const state = p.costState ?? 'normal';
  const tick =
    state === 'raised'
      ? markIcon('triUp', { className: 'gem__tick' })
      : state === 'lowered'
        ? markIcon('triDown', { className: 'gem__tick' })
        : '';
  return `<div class="card-face__gem gem" data-cost-state="${state}"><span class="gem__n">${p.cost}</span>${tick}</div>`;
}

function rarityMarkup(r: Rarity): string {
  if (r === 'starter' || r === 'special') return '';
  return `<span class="card-face__rarity rarity rarity--${r}" aria-hidden="true"></span>`;
}

function defaultAria(p: CardFaceProps, displayName: string): string {
  if (p.buried) {
    return `${displayName}, Weight ${clampWeight(p.buried.weight)}, unplayable. ${p.text}`;
  }
  const lights = p.lights.map((l) => LIGHT_NAME[l]).join(' and ') || 'no Light';
  const kind = p.insight ? ', Insight' : '';
  const cost = p.cost === null ? 'unplayable' : `cost ${p.cost}`;
  return `${displayName}, ${lights}${kind}, ${cost}. ${p.text}`;
}

const PRISM_MARK =
  '<svg class="card-face__prism" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M9 4L16 18H2Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<path d="M13.4 10.4L22.6 7.2" stroke="var(--love)" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M14.4 12.2L22.8 11.8" stroke="var(--joy)" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M15.2 14L22.4 16.4" stroke="var(--calm)" stroke-width="2" stroke-linecap="round"/></svg>';

/** Card face markup (string). Use renderCardFace for an element; call fitCards once it is mounted. */
export function cardFaceMarkup(p: CardFaceProps): string {
  const state = p.state ?? 'idle';
  const seed = p.seed ?? hashSeed(p.name);
  const numbed = state === 'numbed';
  const displayName = p.upgraded && !p.name.endsWith('+') ? `${p.name}+` : p.name;
  const fit = fitCard(displayName, p.text);
  const foot = numbed ? { main: 'NO LIGHT', rest: '' } : footerParts(p);
  const footShort = foot.rest !== '' && !footerFits(foot.main + foot.rest);
  const chips = (p.chips ?? []).slice(0, 2);
  const tag = p.tag ?? 'div';
  const lightAttr = p.buried ? 'none' : (p.lights[0] ?? 'none');
  const rootAttrs = attrs({
    class: ['card-face', p.className ?? ''].filter(Boolean).join(' '),
    'data-light': lightAttr,
    'data-light2': p.lights[1] ?? null,
    'data-face': p.buried ? p.buried.shade : null,
    'data-kind': p.buried ? 'buried' : p.insight ? 'insight' : p.lights.length === 2 ? 'blend' : p.lights.length === 0 ? 'neutral' : 'light',
    'data-rarity': p.rarity,
    'data-state': state,
    'data-upgraded': p.upgraded ? 'true' : null,
    'data-fit': fit.tier,
    'data-name-lines': fit.name.lines,
    style: fit.name.size === 14 ? null : `--name-size:${fit.name.size}`,
    'aria-label': p.ariaLabel ?? defaultAria(p, displayName),
    type: tag === 'button' ? 'button' : null,
    role: tag === 'div' ? 'group' : null,
  });
  return (
    `<${tag}${rootAttrs}>` +
    (chips.length ? `<div class="card-face__chips" aria-hidden="true">${chips.map(cardChipMarkup).join('')}</div>` : '') +
    `<div class="card-face__frame"></div>` +
    (p.insight ? '<div class="card-face__iris" aria-hidden="true"><i></i></div>' : '') +
    `<div class="card-face__body">` +
    `<div class="card-face__art"><div class="card-face__pat"></div><div class="card-face__pat card-face__pat--b"></div>${motifMarkup(p, seed)}</div>` +
    `<div class="card-face__name"><span>${esc(displayName)}</span></div>` +
    `<div class="card-face__text"><p>${formatCardText(p.text, p.numberTrends)}</p></div>` +
    `<div class="card-face__footer"${footShort ? ' data-footer="short"' : ''}><span class="card-face__footer-main">${esc(foot.main)}</span>${foot.rest ? `<span class="card-face__footer-rest">${esc(foot.rest)}</span>` : ''}</div>` +
    `</div>` +
    (p.buried ? cracksMarkup(seed) + '<div class="card-face__wisps"><i></i><i></i><i></i></div>' : '') +
    (p.insight ? `<div class="card-face__sheen"></div><div class="card-face__label">${PRISM_MARK}INSIGHT</div>` : '') +
    rarityMarkup(p.rarity) +
    costMarkup(p) +
    badgeMarkup(p) +
    `</${tag}>`
  );
}

/** Card face element at the 130x182 reference size. Call fitCards(el) after it is in the document. */
export function renderCardFace(p: CardFaceProps): HTMLElement {
  return toElement<HTMLElement>(cardFaceMarkup(p));
}

const TIER_ORDER = ['md', 'sm', 'xs', 'xxs'] as const;

/**
 * Check mounted cards against the real font and adjust: names step 14 -> 13 -> 12px and then wrap to two
 * lines (never below 12px, never ellipsised), rules text gives up art-band height tier by tier, and a
 * footer that still overflows drops its kind word. Pass a card or any container of cards. It reads and
 * writes layout once per step, so call it once after mounting a hand, not every frame.
 */
export function fitCards(root: ParentNode): void {
  const cards = root instanceof Element && root.matches('.card-face') ? [root] : [...root.querySelectorAll('.card-face')];
  for (const card of cards as HTMLElement[]) {
    if (card.classList.contains('card-face--mini')) continue;
    const plate = card.querySelector<HTMLElement>('.card-face__name');
    const span = plate?.querySelector<HTMLElement>('span');
    if (plate && span && card.dataset.nameLines === '1') {
      const avail = () => plate.clientWidth - parseFloat(getComputedStyle(plate).paddingLeft) * 2;
      let size = Number(card.style.getPropertyValue('--name-size') || 14);
      while (span.scrollWidth > avail() + 0.5 && size > TEXT_FLOOR) {
        size -= 1;
        card.style.setProperty('--name-size', String(size));
      }
      if (span.scrollWidth > avail() + 0.5) card.dataset.nameLines = '2';
    }
    const box = card.querySelector<HTMLElement>('.card-face__text');
    const para = box?.querySelector('p');
    if (box && para) {
      let i = TIER_ORDER.indexOf((card.dataset.fit ?? 'md') as (typeof TIER_ORDER)[number]);
      while (para.scrollHeight > box.clientHeight + 0.5 && i < TIER_ORDER.length - 1) card.dataset.fit = TIER_ORDER[++i];
    }
    const footer = card.querySelector<HTMLElement>('.card-face__footer');
    if (footer && footer.scrollWidth > footer.clientWidth + 0.5) footer.dataset.footer = 'short';
  }
}

/** Older name for fitCards (it now fits names, rules text and footers). */
export const fitCardNames = fitCards;
