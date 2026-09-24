// Card text fitting (DESIGN 16.2, 19): every 6.x card must fit its 130x182 face without text below 12px.
// Long texts keep their type size and give up art-band height instead (70 -> 56 -> 40 -> 26 px).
// Markup picks a layout from a width estimate; fitCards() then checks the real font in the DOM.
//
// Widths come from DejaVu Sans, the widest common fallback for `ui-rounded, system-ui, sans-serif`
// (SF Pro, Segoe UI and Roboto are narrower), so an estimate that fits here fits everywhere.

/** Advance widths of ASCII 32..126 in 1/100 em, regular (400) and bold (600+). */
const REGULAR = [
  32, 40, 46, 84, 64, 95, 78, 27, 39, 39, 50, 84, 32, 36, 32, 34, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 34, 34, 84, 84,
  84, 53, 100, 68, 69, 70, 77, 63, 58, 77, 75, 29, 29, 66, 56, 86, 75, 79, 60, 79, 69, 63, 61, 73, 68, 99, 69, 61, 69, 39,
  34, 39, 84, 50, 50, 61, 63, 55, 63, 62, 35, 63, 63, 28, 28, 58, 28, 97, 63, 61, 63, 63, 41, 52, 39, 63, 59, 82, 59, 59,
  52, 64, 34, 64, 84,
];
const BOLD = [
  35, 46, 52, 84, 70, 100, 87, 31, 46, 46, 52, 84, 38, 42, 38, 37, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 40, 40, 84, 84,
  84, 58, 100, 77, 76, 73, 83, 68, 68, 82, 84, 37, 37, 77, 64, 100, 84, 85, 73, 85, 77, 72, 68, 81, 77, 110, 77, 72, 73,
  46, 37, 46, 84, 50, 50, 67, 72, 59, 72, 68, 44, 72, 71, 34, 34, 67, 34, 104, 71, 69, 72, 72, 49, 60, 48, 71, 65, 92, 65,
  65, 58, 71, 37, 71, 84,
];

/** Estimated width in px of `s` at font size `px`. Non-ASCII characters count as a wide letter. */
export function textWidth(s: string, px: number, bold = false, letterSpacingEm = 0): number {
  const table = bold ? BOLD : REGULAR;
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    w += (c >= 32 && c <= 126 ? table[c - 32]! : 80) + letterSpacingEm * 100;
  }
  return (w * px) / 100;
}

/** Keywords the card renderer bolds (keep in sync with formatCardText). */
export const CARD_KEYWORDS = ['Harmony:', 'Promise:', 'Linger', 'Let Go', 'Innate', 'Reaches Shy', 'Unplayable', 'Spark', 'Mood'];
export const CARD_KEYWORD_RE = new RegExp(
  `\\b(${CARD_KEYWORDS.map((k) => (k.endsWith(':') ? k : `${k}\\b`)).join('|')})`,
  'g',
);

// ------------------------------------------------------------------------------------------------
// Layout tiers (reference px; the CSS in kit-card.css uses the same numbers)
// ------------------------------------------------------------------------------------------------

export type TextTier = 'md' | 'sm' | 'xs' | 'xxs';

export interface TierSpec {
  id: TextTier;
  /** Art band height. */
  art: number;
  /** Rules text size (13 is the spec size, 12 the floor). */
  text: number;
  /** Bold number size (spec 16). */
  num: number;
  /** Line pitch as rendered (line box with the bold numbers). */
  pitch: number;
  /** Most lines allowed (the spec's 3 lines at full size). */
  maxLines: number;
}

export const TIERS: readonly TierSpec[] = [
  { id: 'md', art: 70, text: 13, num: 16, pitch: 17, maxLines: 3 },
  { id: 'sm', art: 56, text: 12, num: 14, pitch: 15, maxLines: 99 },
  { id: 'xs', art: 40, text: 12, num: 13, pitch: 14, maxLines: 99 },
  { id: 'xxs', art: 26, text: 12, num: 12.5, pitch: 14, maxLines: 99 },
];

/** Smallest type the card uses anywhere (DESIGN 19: chips >= 12px). */
export const TEXT_FLOOR = 12;

/** Card body height (182 - 2 x 4 frame). */
const BODY_H = 174;
/** Name plate space below the art band: 1 line (22 tall, 11 overlap) or 2 lines (32 tall, 14 overlap). */
const NAME_BELOW = { 1: 11, 2: 18 } as const;
/** Footer 16 + 3 margin, text padding 4 + 2. */
const FOOTER_H = 19;
const TEXT_PAD_V = 6;
/** Rules text width: body 122 minus 5 px padding each side, minus 2 px of rounding slack. */
export const TEXT_W = 110;
/** Name plate text width: body 122 - 2 x 3 margin - 2 x 4 padding - 2 border - 2 slack. */
export const NAME_W = 104;
/** Footer width: body 122 - 2 x 8 margin - 2 slack. */
export const FOOTER_W = 104;

export const NAME_SIZES = [14, 13, 12] as const;

export interface NameLayout {
  size: number;
  lines: 1 | 2;
}

/** The biggest name size that fits on one line, else 12px on two lines (DESIGN 16.2: 14px bold). */
export function nameLayout(name: string): NameLayout {
  for (const size of NAME_SIZES) if (textWidth(name, size, true) <= NAME_W) return { size, lines: 1 };
  return { size: TEXT_FLOOR, lines: 2 };
}

interface Run {
  text: string;
  kind: 'plain' | 'keyword' | 'number';
}

/** Split rules text into the runs the renderer styles differently. */
function runs(text: string): Run[] {
  const out: Run[] = [];
  text.split(/(\d+)/).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      out.push({ text: part, kind: 'number' });
      return;
    }
    let last = 0;
    for (const m of part.matchAll(CARD_KEYWORD_RE)) {
      if (m.index! > last) out.push({ text: part.slice(last, m.index), kind: 'plain' });
      out.push({ text: m[0], kind: 'keyword' });
      last = m.index! + m[0].length;
    }
    if (last < part.length) out.push({ text: part.slice(last), kind: 'plain' });
  });
  return out;
}

/** Lines the rules text wraps to at a tier (greedy word wrap, the same line count as text-wrap: balance). */
export function textLines(text: string, tier: TierSpec, width = TEXT_W): number {
  // Build words as lists of styled pieces; spaces separate words.
  const words: { w: number }[] = [];
  let cur = 0;
  let open = false;
  for (const run of runs(text)) {
    const px = run.kind === 'number' ? tier.num : tier.text;
    const bold = run.kind !== 'plain';
    const pieces = run.text.split(/( +)/);
    for (const piece of pieces) {
      if (!piece) continue;
      if (/^ +$/.test(piece)) {
        if (open) words.push({ w: cur });
        cur = 0;
        open = false;
        continue;
      }
      cur += textWidth(piece, px, bold);
      open = true;
    }
  }
  if (open) words.push({ w: cur });
  const space = textWidth(' ', tier.text);
  let lines = words.length ? 1 : 0;
  let lineW = 0;
  for (const { w } of words) {
    if (lineW === 0) lineW = w;
    else if (lineW + space + w <= width) lineW += space + w;
    else {
      lines++;
      lineW = w;
    }
  }
  return lines;
}

/** Text box height at a tier with a 1- or 2-line name. */
export function textBoxHeight(tier: TierSpec, nameLines: 1 | 2): number {
  return BODY_H - tier.art - NAME_BELOW[nameLines] - FOOTER_H - TEXT_PAD_V;
}

export interface CardFit {
  tier: TextTier;
  name: NameLayout;
  lines: number;
  /** False only if the text overflows even the last tier (a content bug the tests catch). */
  fits: boolean;
}

/** Pick the roomiest layout that holds the rules text at 12px or more. */
export function fitCard(name: string, text: string): CardFit {
  const nm = nameLayout(name);
  for (const tier of TIERS) {
    const lines = textLines(text, tier);
    const cap = Math.min(tier.maxLines, Math.floor(textBoxHeight(tier, nm.lines) / tier.pitch));
    if (lines <= cap) return { tier: tier.id, name: nm, lines, fits: true };
  }
  const last = TIERS[TIERS.length - 1]!;
  return { tier: last.id, name: nm, lines: textLines(text, last), fits: false };
}

/** Footer words, uppercase with the caps letter-spacing, fit on one line at 10px. */
export function footerFits(footer: string, px = 10, letterSpacingEm = 0.06): boolean {
  return textWidth(footer, px, true, letterSpacingEm) <= FOOTER_W;
}
