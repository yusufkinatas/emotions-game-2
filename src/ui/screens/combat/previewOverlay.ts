// Preview overlays on a Shade slot while a card is selected (DESIGN 16.2): the callout ("-12 OPPOSITE x2"),
// the Flare arrow into the intent, the face-turn arrow, gauge changes, and lethal banners.

import type { IntentView } from '../../../engine/types';
import { esc } from '../../kit/svg';
import { intentIcon, markIcon, sigil } from '../../kit/sigils';
import { lethalBannerMarkup } from '../../kit/widgets';
import { SHADE_NAME } from '../../kit/names';
import type { ShadeModel } from './model';
import { intentStrikeTotal, isDownRelation, isUpRelation } from './text';

const arrow = (s: string): string => esc(s).replace(/-&gt;/g, '→');

/** The callout or lethal banner for one Shade, or '' when it has no preview. */
export function previewOverlayMarkup(m: ShadeModel): string {
  const p = m.preview;
  if (!p) return '';
  if (p.banner) return `<div class="cb-overlay cb-overlay--banner" data-kind="${p.banner.kind}">${lethalBannerMarkup(p.banner)}</div>`;
  const c = p.callout;
  if (!c) return '';
  const lines: string[] = [];
  if (c.blocked > 0) lines.push(`<span class="cb-callout__line">Guard blocks ${c.blocked}</span>`);
  if (c.flare > 0) lines.push(`<span class="cb-callout__line cb-callout__line--flare">${markIcon('triUp')}+${c.flare} Flare</span>`);
  if (c.turnTo) {
    lines.push(
      `<span class="cb-callout__line cb-callout__line--turn" data-face="${c.turnTo}">${markIcon('turn')}turns to ${sigil(c.turnTo)}${SHADE_NAME[c.turnTo]}</span>`,
    );
  }
  for (const g of c.gauges) lines.push(`<span class="cb-callout__line">${arrow(g)}</span>`);
  const next = intentAfterMarkup(m);
  if (next && !c.gauges.some((g) => g.includes('next move'))) lines.push(`<span class="cb-callout__line">${next}</span>`);
  const up = isUpRelation(c.relation);
  const down = isDownRelation(c.relation);
  const mark = up ? markIcon('chevronUp2') : down ? markIcon('chevronDown') : '';
  const head =
    c.label !== ''
      ? `<span class="cb-callout__head"><b class="cb-callout__n num">-${c.amount}${c.hits > 1 ? ` <small>(${c.hits} hits)</small>` : ''}</b><span class="cb-callout__rel">${mark}${esc(c.label)}</span></span>`
      : '';
  return (
    `<div class="cb-overlay cb-callout" data-relation="${c.relation}"${up && c.light ? ` data-light="${c.light}"` : ''}>` +
    head +
    lines.join('') +
    `</div>`
  );
}

/** "8 -> 9" (or the new move) in the callout when the selected card changes the Shade's next move. */
export function intentAfterMarkup(m: ShadeModel): string {
  const after: IntentView | null | undefined = m.preview?.intentAfter;
  const now = m.intent;
  if (!after || !now) return '';
  const a = intentStrikeTotal(now);
  const b = intentStrikeTotal(after);
  if (after.moveId === now.moveId && a === b) return '';
  const strikeText = (iv: IntentView): string => (iv.strikes ? `${iv.strikes.perStrike}${iv.strikes.count > 1 ? `x${iv.strikes.count}` : ''}` : '');
  const body =
    after.moveId !== now.moveId
      ? `next move <b>${esc(after.name.toUpperCase())}</b>${after.strikes ? ` ${intentIcon('strike')}<b class="num">${strikeText(after)}</b>` : ''}`
      : `${intentIcon('strike')}<b class="num">${strikeText(now)}</b> → <b class="num">${strikeText(after)}</b>${markIcon(b > a ? 'triUp' : 'triDown')}`;
  return `<span class="cb-intent-after" data-dir="${b >= a ? 'up' : 'down'}">${body}</span>`;
}
