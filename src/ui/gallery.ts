/// <reference types="vite/client" />
// Developer gallery for the UI kit (gallery.html). Not part of the game build.
import './styles/index.css';
import './styles/gallery.css';

import { LIGHTS, SHADES } from '../engine/emotions';
import type { Light, Shade } from '../engine/emotions';
import type { CardDef } from '../engine/types';
import { synth } from './audio/synth';
import type { UiSound } from './audio/synth';
import { barkMarkup, coachMarkMarkup, promiseChipMarkup, waveringChipMarkup } from './kit/callouts';
import { cardFaceMarkup, fitCards } from './kit/cardFace';
import type { CardFaceProps } from './kit/cardFace';
import { compassMarkup } from './kit/compass';
import type { CompassProps } from './kit/compass';
import { LIGHT_NAME, SHADE_NAME } from './kit/names';
import { companionSlotsMarkup, incomingLineMarkup, inwardTargetMarkup, promiseTrayMarkup, wandererMarkup } from './kit/player';
import { lightMixMarkup, mapEdgesMarkup, mapLegendMarkup, mapNodeMarkup, numbnessMeterMarkup } from './kit/runHud';
import type { MapEdge, MapNodeProps } from './kit/runHud';
import { renderShade, resolvedFormMarkup, setShadeReaction, shadeMarkup } from './kit/shadeArt';
import type { ShadeArtOpts, ShadeFamily, ShadeReaction } from './kit/shadeArt';
import { ornamentFor } from './kit/shadeOrnaments';
import type { ShadeOrnament } from './kit/shadeOrnaments';
import { ICON_NAMES, intentIcon, keepsakeIcon, markIcon, nodeIcon, numbBadge, resourceIcon, sigil } from './kit/sigils';
import { threadMarkup } from './kit/thread';
import {
  barMarkup,
  chipRowMarkup,
  defaultMatchups,
  floatingNumberMarkup,
  guardBadgeMarkup,
  guardBubbleMarkup,
  intentPillMarkup,
  lethalBannerMarkup,
  matchupChipMarkup,
  nameplateMarkup,
  setBarValue,
  spawnFloatingNumber,
  statusChipMarkup,
  tooltipMarkup,
} from './kit/widgets';
import type { FloatingNumberProps, StatusChipProps } from './kit/widgets';

const root = document.getElementById('gallery')!;

function section(id: string, title: string, note: string, body: string): string {
  return `<section class="g-section" id="${id}"><header><h2>${title}</h2><p>${note}</p></header>${body}</section>`;
}

function group(title: string, body: string, cls = ''): string {
  return `<div class="g-group ${cls}"><h3>${title}</h3>${body}</div>`;
}

function tile(label: string, content: string, cls = ''): string {
  return `<figure class="g-tile ${cls}"><div class="g-tile__art">${content}</div><figcaption>${label}</figcaption></figure>`;
}

// ------------------------------------------------------------------------------------------------
// Sigils and icons
// ------------------------------------------------------------------------------------------------

function sigilSection(): string {
  const sizes = [14, 24, 48];
  const row = (name: Parameters<typeof sigil>[0], label: string, tint: boolean) =>
    `<div class="g-sigil-row">${sizes.map((s) => sigil(name, { size: s, tint })).join('')}<span>${label}</span></div>`;
  const lights = LIGHTS.map((l) => row(l, LIGHT_NAME[l], true)).join('');
  const shades = SHADES.map((s) => `<div class="g-shade-sigil" data-face="${s}">${row(s, SHADE_NAME[s], false)}</div>`).join('');
  const extras = `${row('numb', 'Numb', true)}${row('doubt', 'Doubt', true)}${row('neutral', 'Neutral', false)}<div class="g-sigil-row">${numbBadge({ size: 24 })}<span>NUMB badge</span></div>`;
  const grid = (title: string, items: string) => group(title, `<div class="g-grid">${items}</div>`);
  const icons = (names: readonly string[], fn: (n: string) => string) =>
    names.map((nm) => tile(nm, `<div class="g-icon">${fn(nm)}</div><div class="g-icon g-icon--small">${fn(nm)}</div>`)).join('');
  return section(
    'sigils',
    'Sigils and icons',
    '24-unit grid, currentColor. Shown at 14, 24 and 48px. Lights are open and rounded, Shades closed and pointed.',
    `<div class="g-cols">
      <div class="g-group"><h3>Lights</h3>${lights}</div>
      <div class="g-group"><h3>Shades</h3>${shades}</div>
      <div class="g-group"><h3>Numb, doubt, neutral</h3>${extras}</div>
    </div>` +
      grid('Intents', icons(ICON_NAMES.intents, (k) => intentIcon(k as never))) +
      grid('Node icons (legend)', ICON_NAMES.nodes.map((k) => tile(k, `<span class="map-node" data-kind="${k}">${nodeIcon(k)}</span>`, 'g-tile--node')).join('')) +
      grid('Resources', icons(ICON_NAMES.resources, (k) => resourceIcon(k as never))) +
      grid('Marks and UI', icons(ICON_NAMES.marks, (k) => markIcon(k as never))) +
      grid('Keepsakes', icons([...ICON_NAMES.keepsakes, 'unknown-hint'], (k) => keepsakeIcon(k))),
  );
}

// ------------------------------------------------------------------------------------------------
// Cards
// ------------------------------------------------------------------------------------------------

const SAMPLE: Record<Light, { name: string; text: string; kind: string; cost: number }> = {
  love: { name: 'Kind Word', text: 'Ease 6.', kind: 'Ease', cost: 1 },
  joy: { name: 'Bright Spark', text: 'Ease 4. Draw 1.', kind: 'Ease', cost: 1 },
  friendship: { name: 'High Five', text: 'Ease 5, +2 per Companion. Harmony: your Companions act now.', kind: 'Ease', cost: 1 },
  courage: { name: 'Stand Firm', text: 'Gain 5 Guard.', kind: 'Skill', cost: 1 },
  hope: { name: 'Wish on a Star', text: 'Ease 4. Promise: Ease 8 to the same Shade. Harmony: the Promise Eases 12 instead.', kind: 'Ease', cost: 1 },
  calm: { name: 'Count to Ten', text: 'Ease 13. Linger. Costs 1 less for each turn it has Lingered this combat.', kind: 'Ease', cost: 2 },
};

const BLEND_SAMPLES: CardFaceProps[] = [
  { name: 'Sunbeam', lights: ['love', 'joy'], cost: 1, kindLabel: 'Ease', text: 'Ease 7. Mend 2. Draw 1.', rarity: 'blend' },
  { name: "Tag, You're It!", lights: ['joy', 'friendship'], cost: 1, kindLabel: 'Ease', text: 'Ease 5. Spark +1. Summon a Lantern Moth.', rarity: 'blend' },
  { name: 'Shoulder to Shoulder', lights: ['friendship', 'courage'], cost: 1, kindLabel: 'Ease', text: 'Ease 6 and gain 6 Guard, +2 each per Companion. Reaches Shy.', rarity: 'blend' },
  { name: 'Against the Odds', lights: ['courage', 'hope'], cost: 2, kindLabel: 'Ease', text: 'Ease 10. Promise: Ease 10 to the same Shade.', rarity: 'blend' },
  { name: 'Wait It Out', lights: ['hope', 'calm'], cost: 1, kindLabel: 'Ease', text: 'Ease 7. Linger. Eases 4 more for each turn it has Lingered this combat.', rarity: 'blend' },
  { name: 'Gentle Hands', lights: ['calm', 'love'], cost: 1, kindLabel: 'Ease', text: 'Ease 6. Hush 5. Mend 3.', rarity: 'blend' },
];

function card(p: CardFaceProps, label?: string): string {
  return `<figure class="g-card">${cardFaceMarkup(p)}${label ? `<figcaption>${label}</figcaption>` : ''}</figure>`;
}

const buried = (shade: Shade, weight: number, aff: string, light: string): CardFaceProps => ({
  name: `Buried ${SHADE_NAME[shade]}`,
  lights: [],
  cost: null,
  kindLabel: 'Buried',
  text: `Weight ${weight}. Unplayable. End of turn in hand: gain ${weight} ${aff}. Play a ${light} card Inward to Tend.`,
  rarity: 'special',
  buried: { weight, shade },
});

function handCards(): CardFaceProps[] {
  return [
    { name: 'Kind Word', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 6.', rarity: 'starter', chips: ['Tends Buried Anger', 'Soothes Seething'], state: 'playable' },
    { name: 'Bright Spark', lights: ['joy'], cost: 1, kindLabel: 'Ease', text: 'Ease 4. Draw 1.', rarity: 'starter', chips: ['HARMONY -> Delight'], state: 'playable' },
    { name: 'Sunbeam', lights: ['love', 'joy'], cost: 1, kindLabel: 'Ease', text: 'Ease 7. Mend 2. Draw 1.', rarity: 'blend', chips: ['HARMONY -> Playfulness'], state: 'playable', className: 'is-hover' },
    { name: 'Reach Out', lights: ['friendship'], cost: 1, kindLabel: 'Ease', text: 'Ease 6.', rarity: 'starter', chips: ['HARMONY -> Playfulness', 'Soothes Isolated'], state: 'playable' },
    { name: 'Brave Strike', lights: ['courage'], cost: 1, kindLabel: 'Ease', text: 'Ease 6.', rarity: 'starter', chips: ['HARMONY -> Loyalty'], state: 'playable' },
    { name: 'Stand Firm', lights: ['courage'], cost: 2, kindLabel: 'Skill', text: 'Gain 5 Guard.', rarity: 'starter', state: 'unaffordable', costState: 'unaffordable' },
    buried('anger', 2, 'Seething', 'Love'),
  ];
}

/** A hand fan. Dense hands (cards overlapping) collapse chips to icons with .card-chips--icons. */
function handFan(dense: boolean): string {
  const cards = handCards().slice(0, dense ? 7 : 5);
  return `<div class="g-hand${dense ? ' g-hand--dense card-chips--icons' : ''}">${cards.map((c) => cardFaceMarkup(c)).join('')}</div>`;
}

function cardSection(): string {
  const lightCards = LIGHTS.map((l) => {
    const s = SAMPLE[l];
    return card({ name: s.name, lights: [l], cost: s.cost, kindLabel: s.kind, text: s.text, rarity: 'common' }, LIGHT_NAME[l]);
  }).join('');
  const blends = BLEND_SAMPLES.map((p) => card(p)).join('');
  const special = [
    card({ name: 'Name It', lights: [], cost: 1, kindLabel: 'Ease', text: 'Ease 4. Then the target becomes Understood.', rarity: 'common' }, 'Neutral'),
    card(buried('anger', 1, 'Seething', 'Love'), 'Buried W1'),
    card(buried('fear', 2, 'Trembling', 'Courage'), 'Buried W2'),
    card(buried('loneliness', 3, 'Isolated', 'Friendship'), 'Buried W3, longest text'),
    card({ name: 'Passion', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 9, +3 for each Flare on the target. Gain 1 Nerve.', rarity: 'special', insight: true }, 'Insight'),
    card({ name: 'Foresight', lights: ['calm'], cost: 0, kindLabel: 'Skill', text: 'Draw 2. Hush 3 on ALL Shades. Linger.', rarity: 'special', insight: true, upgraded: true }, 'Insight upgraded'),
  ].join('');
  const base: CardFaceProps = { name: 'Kind Word', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 12.', rarity: 'starter' };
  const states =
    (['idle', 'playable', 'selected', 'unaffordable', 'numbed'] as const)
      .map((st) => card({ ...base, state: st, costState: st === 'unaffordable' ? 'unaffordable' : 'normal' }, st))
      .join('') +
    card({ name: 'Sunbeam', lights: ['love', 'joy'], cost: 1, kindLabel: 'Ease', text: 'Ease 7. Mend 2. Draw 1.', rarity: 'blend', state: 'selected' }, 'selected Blend') +
    card({ name: 'Passion', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 9, +3 for each Flare on the target. Gain 1 Nerve.', rarity: 'special', insight: true }, 'Insight, not selected');
  const costs = [
    card({ ...base, name: 'Brave Strike', lights: ['courage'], cost: 2, costState: 'raised', text: 'Ease 6.' }, 'cost raised (Restless)'),
    card({ ...base, name: 'Daybreak', lights: ['hope'], cost: 1, costState: 'lowered', text: 'Ease 18 to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.', rarity: 'rare' }, 'cost lowered, rare'),
    card({ ...base, name: 'Soft Spot', upgraded: true, text: 'Ease 8. Mend 3.', rarity: 'common', numberTrends: ['up', null] }, 'upgraded, trend up'),
    card({ ...base, name: 'Reach Out', lights: ['friendship'], text: 'Ease 3.', rarity: 'uncommon', numberTrends: ['down'] }, 'uncommon, trend down'),
    card({ ...base, name: 'Grand Finale', lights: ['joy'], cost: 2, text: 'Ease 4 to ALL Shades once for each card you played earlier this turn (at least once). Let Go.', rarity: 'rare' }, 'longest Light text'),
  ].join('');
  const minis = `<div class="g-cards">${[
    { ...base, name: 'Wish on a Star', lights: ['hope'] as Light[] },
    { ...base, name: 'Shoulder to Shoulder', lights: ['friendship', 'courage'] as Light[], rarity: 'blend' as const },
    buried('despair', 2, 'Hollow', 'Hope'),
    { ...base, name: 'Passion', insight: true, rarity: 'special' as const },
  ]
    .map((p) => cardFaceMarkup({ ...p, className: 'card-face--mini' }))
    .join('')}</div>`;
  return section(
    'cards',
    'Card faces',
    'Every frame, Blend split, Buried, Insight, states and cost states at the 130x182 reference size. Nothing on a card is below 12px except the 10px caps footer; long texts give up art-band height instead.',
    group('Lights', `<div class="g-cards">${lightCards}</div>`) +
      group('Blends (footer: the Blend name, every Blend is an Ease card)', `<div class="g-cards">${blends}</div>`) +
      group('Neutral, Buried (cracks in a 10px border band, Weight pips and W label), Insight (turning six-hue border, prism mark)', `<div class="g-cards">${special}</div>`) +
      group('States: selected lifts and glows in its own Light colour, never a pearl frame', `<div class="g-cards g-cards--lift">${states}</div>`) +
      group('Cost, rarity, trends', `<div class="g-cards">${costs}</div>`) +
      group('A roomy hand: chips are one word and never wider than their card; the hovered card shows the full sentence', `<div class="g-hand-wrap">${handFan(false)}</div>`) +
      group('A crowded hand (.card-chips--icons): chips collapse to icons so they never overlap a neighbour', `<div class="g-hand-wrap">${handFan(true)}</div>`) +
      group('Mini (piles, reward tiles): gem, badge and name only', minis) +
      group('Every card in the content pack at the text floor (loaded from content)', `<div class="g-cards g-cards--all" id="g-all-cards"><p class="muted">Loading the content pack...</p></div>`),
  );
}

const KIND_LABEL: Record<CardDef['kind'], string> = { ease: 'Ease', skill: 'Skill', mood: 'Mood', buried: 'Buried' };

/** Fill a content text template with worst-case two-digit numbers (Buried Weight 3). */
const fillTemplate = (t: string): string => t.replace(/\{w\}/g, '3').replace(/\{\d+\}/g, '12');

async function mountAllCards(): Promise<void> {
  const host = document.getElementById('g-all-cards');
  if (!host) return;
  try {
    const { defaultPack } = await import('../content/index');
    const faces: string[] = [];
    for (const def of Object.values(defaultPack.cards)) {
      const variants: [string, boolean][] = [[def.text, false]];
      if (def.upgrade?.text) variants.push([def.upgrade.text, true]);
      for (const [text, upgraded] of variants) {
        faces.push(
          cardFaceMarkup({
            name: def.name,
            lights: def.lights,
            cost: def.cost === 'unplayable' ? null : upgraded && def.upgrade?.cost !== undefined ? def.upgrade.cost : def.cost,
            kindLabel: KIND_LABEL[def.kind],
            text: fillTemplate(text),
            rarity: def.rarity,
            upgraded,
            ...(def.buried ? { buried: { weight: 3, shade: def.buried.shade } } : {}),
            ...(def.id.startsWith('insight.') ? { insight: true } : {}),
          }),
        );
      }
    }
    host.innerHTML = faces.join('');
    host.dataset.count = String(faces.length);
    fitCards(host);
  } catch (e) {
    host.innerHTML = `<p class="muted">The content pack did not load: ${String(e)}</p>`;
  }
}

// ------------------------------------------------------------------------------------------------
// Shades
// ------------------------------------------------------------------------------------------------

function shadeTile(o: ShadeArtOpts, label: string): string {
  return `<figure class="g-shade" data-face="${o.face ?? 'none'}"><div class="g-shade__stage">${shadeMarkup({ size: 180, ...o })}</div><figcaption>${label}</figcaption></figure>`;
}

const FAMILY_FACE: Record<ShadeFamily, ShadeArtOpts['face']> = {
  anger: 'anger',
  sadness: 'sadness',
  loneliness: 'loneliness',
  fear: 'fear',
  despair: 'despair',
  anxiety: 'anxiety',
  doubt: 'fear',
  mask: 'anger',
  numb: null,
};

function shadeSection(): string {
  const families: ShadeFamily[] = ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety'];
  const seeds = [11, 204, 3071];
  const rows = families
    .map((f) =>
      group(
        f,
        `<div class="g-row">${seeds.map((sd) => shadeTile({ family: f, seed: sd, face: FAMILY_FACE[f] }, `seed ${sd}`)).join('')}${shadeTile({ family: f, seed: 77, face: FAMILY_FACE[f], flare: 3 }, 'Flare 3')}</div>`,
      ),
    )
    .join('');
  const small = group(
    'Doubt (Fleeting), scale 0.6',
    `<div class="g-row">${seeds.map((sd) => shadeTile({ family: 'doubt', seed: sd, face: 'fear', scale: 0.6 }, `seed ${sd}`)).join('')}</div>`,
  );
  const compounds = group(
    'Compounds: the expression and the on-body badge follow the showing face (dim badge dashed, lit badge filled)',
    `<div class="g-row">${[
      shadeTile({ family: 'anger', seed: 5, face: 'anger', innerFace: 'sadness' }, 'Old Grudge, Anger showing'),
      shadeTile({ family: 'anger', seed: 5, face: 'sadness', innerFace: 'sadness' }, 'Old Grudge, Sadness showing'),
      shadeTile({ family: 'sadness', seed: 9, face: 'sadness', innerFace: 'loneliness' }, 'Longing, Sadness showing'),
      shadeTile({ family: 'sadness', seed: 9, face: 'loneliness', innerFace: 'loneliness' }, 'Longing, Loneliness showing'),
      shadeTile({ family: 'loneliness', seed: 12, face: 'fear', innerFace: 'fear' }, 'Wallflower, Fear showing'),
      shadeTile({ family: 'fear', seed: 14, face: 'fear', innerFace: 'despair' }, 'Dread, Fear showing'),
      shadeTile({ family: 'fear', seed: 14, face: 'despair', innerFace: 'despair' }, 'Dread, Despair showing'),
    ].join('')}</div>`,
  );
  const elites = group(
    'Elites and bosses: ornaments by enemy id (ornamentFor), scale up to 1.35 (they rise above the frame)',
    `<div class="g-row g-row--tall">${[
      shadeTile({ family: 'anger', seed: 31, face: 'anger', scale: 1.3, ornament: ornamentFor('shade.kettle') }, 'The Kettle: lid and steam'),
      shadeTile({ family: 'fear', seed: 32, face: 'fear', scale: 1.35, ornament: ornamentFor('shade.looming') }, 'The Looming: tall shadow'),
      shadeTile({ family: 'anxiety', seed: 33, face: 'anxiety', innerFace: 'anger', scale: 1.3, ornament: ornamentFor('shade.knot') }, 'The Knot: cinched knot'),
      shadeTile({ family: 'despair', seed: 34, face: 'despair', innerFace: 'anxiety', scale: 1.35, ornament: ornamentFor('shade.spiral'), gauge: 2 }, 'The Spiral, Coil 2'),
      shadeTile({ family: 'despair', seed: 34, face: 'anxiety', innerFace: 'anxiety', scale: 1.35, ornament: ornamentFor('shade.spiral'), gauge: 6 }, 'The Spiral, Coil 6, Anxiety showing'),
    ].join('')}</div>` +
      `<div class="g-row g-row--tall">${[
        shadeTile({ family: 'mask', seed: 35, face: 'anger', nextFace: 'sadness', scale: 1.35, ornament: ornamentFor('shade.mask') }, 'The Mask: a crown of its faces (showing lit, next dashed)'),
        shadeTile({ family: 'numb', seed: 36, face: null, slouched: true, scale: 1.15, ornament: ornamentFor('shade.apathy') }, 'Apathy: melting into a puddle, sighing'),
        shadeTile({ family: 'numb', seed: 37, face: null, scale: 1.35, ornament: ornamentFor('shade.numbness'), gauge: 1 }, 'The Numbness, veil 1'),
        shadeTile({ family: 'numb', seed: 37, face: null, scale: 1.35, ornament: ornamentFor('shade.numbness'), gauge: 3, feltCracks: [['love', 'joy']] }, 'veil 3 (three Surfaced), one FELT crack'),
      ].join('')}</div>`,
  );
  const maskRow = group(
    'The Mask: its own expression per face, face sigil on the cheek, next face on the forehead, fissures spread with Flare',
    `<div class="g-row g-row--tall">${(
      [
        ['anger', 'sadness', 0],
        ['sadness', 'loneliness', 1],
        ['loneliness', 'fear', 3],
        ['fear', 'anger', 5],
      ] as const
    )
      .map(([f, nx, fl]) => shadeTile({ family: 'mask', seed: 1, face: f, nextFace: nx, flare: fl, ornament: 'mask' }, `${SHADE_NAME[f]}, next ${SHADE_NAME[nx]}, Flare ${fl}`))
      .join('')}</div>`,
  );
  const numbRow = group(
    'Apathy and The Numbness',
    `<div class="g-row">${[
      shadeTile({ family: 'numb', seed: 2, face: null, slouched: true, scale: 0.85 }, 'Apathy'),
      shadeTile({ family: 'numb', seed: 3, face: null }, 'The Numbness'),
      shadeTile({ family: 'numb', seed: 3, face: null, feltCracks: [['love', 'joy'], ['courage', 'hope'], ['calm', 'love']] }, 'after 3 FELT hits'),
    ].join('')}</div>`,
  );
  const flareRow = group(
    'Flare 0 to 5: cracks, body and timing stay the same Shade as it Flares; only its Flare look grows',
    `<div class="g-row g-row--small">${[0, 1, 2, 3, 4, 5].map((fl) => shadeTile({ family: 'fear', seed: 40, face: 'fear', flare: fl, size: 130 }, `Fear Flare ${fl}`)).join('')}</div>` +
      `<div class="g-row g-row--small" style="margin-top:12px">${[0, 5].map((fl) => shadeTile({ family: 'anger', seed: 41, face: 'anger', flare: fl, size: 130 }, `Anger Flare ${fl}`)).join('')}${[0, 5]
        .map((fl) => shadeTile({ family: 'loneliness', seed: 42, face: 'loneliness', flare: fl, size: 130 }, `Loneliness Flare ${fl}`))
        .join('')}${[0, 5].map((fl) => shadeTile({ family: 'despair', seed: 43, face: 'despair', flare: fl, size: 130 }, `Despair Flare ${fl}`)).join('')}</div>`,
  );
  const reactions: ShadeReaction[] = ['flinch', 'swell', 'hit', 'resolving', 'deepResolving', 'suppressed'];
  const reactRow = group(
    'Reactions (click to replay). Resolve: cracks flare, ink dissolves along them, a 50px light form rises and holds',
    `<div class="g-row g-row--small" id="g-reactions">${reactions
      .map((re) => `<figure class="g-shade" data-reaction="${re}"><div class="g-shade__stage"></div><figcaption><button class="btn btn--small">${re}</button></figcaption></figure>`)
      .join('')}</div>`,
  );
  const forms = group(
    'Resolved forms',
    `<div class="g-row g-forms">${LIGHTS.map((l) => `<figure class="g-tile" data-light="${l}"><div class="g-tile__art">${resolvedFormMarkup(l, { size: 44 })}</div><figcaption>${LIGHT_NAME[l]}</figcaption></figure>`).join('')}</div>`,
  );
  return section(
    'shades',
    'Shades',
    'Procedural silhouettes, one generator per family, one seeded stream per feature. Ink bodies with grey rims; only the cracks carry hue, in the cure colour of the showing face.',
    rows + small + compounds + elites + maskRow + numbRow + flareRow + reactRow + forms,
  );
}

function mountReactions(): void {
  const row = document.getElementById('g-reactions');
  if (!row) return;
  for (const fig of row.querySelectorAll<HTMLElement>('[data-reaction]')) {
    const reaction = fig.dataset.reaction as ShadeReaction;
    const stage = fig.querySelector('.g-shade__stage')!;
    // First render freezes a representative frame so a still (or a screenshot) shows the effect.
    const FREEZE_AT: Partial<Record<ShadeReaction, number>> = { hit: 70, resolving: 520, deepResolving: 560, suppressed: 560 };
    const play = (freeze: boolean) => {
      const deep = reaction === 'deepResolving';
      const svg = renderShade({
        family: deep ? 'anger' : 'sadness',
        seed: 21,
        face: deep ? 'anger' : 'sadness',
        innerFace: deep ? 'sadness' : null,
        size: 160,
      });
      stage.replaceChildren(svg);
      requestAnimationFrame(() => {
        setShadeReaction(svg, reaction);
        const t = FREEZE_AT[reaction];
        if (!freeze || t === undefined) return;
        for (const a of svg.getAnimations({ subtree: true })) {
          a.pause();
          a.currentTime = t;
        }
      });
    };
    fig.querySelector('button')!.addEventListener('click', () => play(false));
    play(true);
  }
}

// ------------------------------------------------------------------------------------------------
// Slot composition
// ------------------------------------------------------------------------------------------------

function slot(o: {
  face: Shade | null;
  family: ShadeFamily;
  seed: number;
  name: string;
  hp: number;
  maxHp: number;
  guard?: number;
  beneath?: Shade;
  next?: Shade;
  inner?: Shade;
  pill: string;
  chips: StatusChipProps[];
  bad?: string;
  banner?: string;
  previewLoss?: number;
  flare?: number;
  feet?: string;
  bark?: string;
  scale?: number;
  ornament?: ShadeOrnament | null;
  gauge?: number;
  tall?: boolean;
  focused?: boolean;
}): string {
  const matchups = defaultMatchups(o.face, o.bad);
  return `<div class="shade-slot g-slot${o.tall ? ' shade-slot--tall' : ''}" data-face="${o.face ?? 'none'}"${o.focused ? ' data-focused="true"' : ''}>
    <div class="shade-slot__intent">${o.banner ?? o.pill}</div>
    <div class="shade-slot__art">${shadeMarkup({ family: o.family, seed: o.seed, face: o.face, innerFace: o.inner ?? null, nextFace: o.next ?? null, flare: o.flare ?? 0, scale: o.scale ?? 1, label: o.name, ornament: o.ornament ?? null, ...(o.gauge !== undefined ? { gauge: o.gauge } : {}), shimmer: o.family !== 'anger' || o.seed === 101 })}${o.feet ? `<div class="shade-slot__feet">${o.feet}</div>` : ''}${o.bark ? `<div class="g-bark">${barkMarkup({ text: o.bark })}</div>` : ''}</div>
    ${nameplateMarkup({ face: o.face, name: o.name, beneath: o.beneath ?? null, nextFace: o.next ?? null, hp: o.hp, maxHp: o.maxHp, guard: o.guard ?? 0, matchups, chips: o.chips, ...(o.previewLoss ? { previewLoss: o.previewLoss } : {}) })}
  </div>`;
}

function stageRow(): string {
  return `<div class="g-stage-row">
    ${slot({ face: 'anger', family: 'anger', seed: 101, name: 'Grumble', hp: 24, maxHp: 42, guard: 5, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 8 }], order: 1, title: 'Strikes for 8 (7 + 1 Flare). Your Guard blocks 5. You lose 3.' }), chips: [{ kind: 'buff', label: 'Flare', value: 1, title: 'Flare 1: +1 to each of its strikes.' }, { kind: 'flag', label: 'Short Fuse', title: 'Short Fuse: at the end of your turn, if a card without Love hit it, Flare +1.' }], bad: 'Just calm down.', flare: 1, previewLoss: 12, bark: 'HMPH.' })}
    ${slot({ face: 'sadness', family: 'sadness', seed: 102, name: 'Mope', hp: 44, maxHp: 48, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 6 }, { kind: 'afflict', affliction: 'heavy', stacks: 1 }], order: 2 }), chips: [{ kind: 'flag', label: 'Wallow' }], bad: 'At least you have people who love you.', feet: promiseChipMarkup({ text: 'Promise: Ease 8', lights: ['hope', 'courage'] }) })}
    ${slot({ face: 'anger', family: 'anger', seed: 103, name: 'Old Grudge', inner: 'sadness', beneath: 'sadness', hp: 18, maxHp: 62, pill: '', banner: lethalBannerMarkup({ kind: 'deepResolve', lights: ['love', 'joy'], sub: ['Conviction: +1 Nerve', 'Release: Mend 4'] }), chips: [{ kind: 'gauge', label: 'Tally', value: 3 }, { kind: 'flag', label: 'Keeps Score' }], bad: 'Just calm down.' })}
    ${slot({ face: 'loneliness', family: 'loneliness', seed: 105, name: 'Surfaced Loneliness', hp: 1, maxHp: 24, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 4 }, { kind: 'afflict', affliction: 'isolated', stacks: 2 }], projected: true, title: 'Lantern Moth will leave it Wavering.' }), chips: [], bad: 'Just go out and have fun!', feet: waveringChipMarkup(), scale: 0.85 })}
  </div>
  <div class="g-stage-row">
    ${slot({ face: 'fear', family: 'mask', seed: 106, name: 'The Mask', next: 'anger', hp: 96, maxHp: 150, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 8 }, { kind: 'afflict', affliction: 'trembling', stacks: 2 }], title: 'Strikes for 8 and gives you 2 Trembling.' }), chips: [{ kind: 'gauge', label: 'Turns left', value: 1 }, { kind: 'buff', label: 'Flare', value: 3 }, { kind: 'flag', label: 'Many Faces' }, { kind: 'flag', label: 'Cracked' }], bad: 'Come on, everyone else is doing it.', flare: 3, scale: 1.3, ornament: 'mask', tall: true, focused: true })}
    ${slot({ face: 'despair', family: 'despair', seed: 107, name: 'The Spiral', inner: 'anxiety', beneath: 'anxiety', hp: 150, maxHp: 200, guard: 15, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 3, count: 4 }, { kind: 'afflict', affliction: 'restless', stacks: 1 }] }), chips: [{ kind: 'gauge', label: 'Coil', value: 4 }, { kind: 'flag', label: 'Deepening' }], bad: 'Just pull yourself together.', scale: 1.3, ornament: 'spiral', gauge: 4, tall: true, feet: promiseChipMarkup({ text: 'Promise: Ease 10', lights: ['courage', 'hope'] }) })}
    ${slot({ face: null, family: 'numb', seed: 104, name: 'The Numbness', hp: 180, maxHp: 180, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 12 }] }), chips: [{ kind: 'flag', label: 'Veiled' }, { kind: 'flag', label: 'Muffled' }], scale: 1.3, ornament: 'numbness', gauge: 2, tall: true })}
  </div>`;
}

function stageSection(): string {
  return section(
    'stage',
    'Shade slots',
    'Intent pill, silhouette with its lit floor, feet chips and bark, and the nameplate, composed at the 205px slot width. Long names get their own line; the Guard slot is reserved.',
    stageRow(),
  );
}

// ------------------------------------------------------------------------------------------------
// Player side
// ------------------------------------------------------------------------------------------------

function playerPanel(o: { inward: boolean; lethal: boolean }): string {
  const companions = companionSlotsMarkup({
    slots: [
      { icon: 'moth', name: 'Lantern Moth', value: 3, action: 'ease', title: 'Lantern Moth: at the end of your turn, Ease 3 to your last target.' },
      { icon: 'hare', name: 'Burrow Hare', value: 3, action: 'guard', title: 'Burrow Hare: at the end of your turn, you gain 3 Guard.' },
      null,
    ],
    isolated: false,
  });
  const heart = o.lethal
    ? barMarkup({ kind: 'heart', value: 7, max: 70, previewLoss: 9, lethal: true })
    : barMarkup({ kind: 'heart', value: 54, max: 70, previewLoss: 5 });
  return `<div class="g-player">
    <div class="g-player__avatar">
      ${guardBubbleMarkup({ size: 176 })}
      ${wandererMarkup({ note: ['love', 'joy'], compass: true, size: 160 })}
      ${o.inward ? inwardTargetMarkup({ preview: 'Clear 2 Seething. Tend Buried Anger (W2 -> W1).', focused: true, size: 214 }) : ''}
    </div>
    <div class="g-player__companions">${companions}</div>
    <div class="g-player__heart">${guardBadgeMarkup(5, { title: 'Guard 5: blocks the next 5 Shade damage this round.' })}${heart}</div>
    ${incomingLineMarkup(o.lethal ? { text: 'Incoming: strikes 12, Seething 2.', lethal: true } : { text: 'Incoming: strikes 8, Guard 5, Seething 2. You lose 5.' })}
    <div class="chip-row">${statusChipMarkup(AFFLICTION_CHIPS[0]!)}${statusChipMarkup(AFFLICTION_CHIPS[1]!)}</div>
    ${promiseTrayMarkup(['+5 Guard, draw 1.'])}
  </div>`;
}

function playerSection(): string {
  const avatars = [
    tile('No Compass yet: grey flame', wandererMarkup({ note: [], compass: false, size: 160 }), 'g-tile--avatar'),
    tile('Note Love', wandererMarkup({ note: ['love'], compass: true, size: 160 }), 'g-tile--avatar'),
    tile('Note Delight: split flame', wandererMarkup({ note: ['love', 'joy'], compass: true, size: 160 }), 'g-tile--avatar'),
    tile('Note Courage', wandererMarkup({ note: ['courage'], compass: true, size: 160 }), 'g-tile--avatar'),
    tile('Note Calm', wandererMarkup({ note: ['calm'], compass: true, size: 160 }), 'g-tile--avatar'),
    tile('Hit: flicker (frozen)', wandererMarkup({ note: ['hope'], compass: true, size: 160, className: 'is-hit' }), 'g-tile--avatar g-freeze" data-t="60'),
  ].join('');
  const companions = `<div class="g-row g-row--center g-companions">${companionSlotsMarkup({
    slots: [
      { icon: 'moth', name: 'Lantern Moth', value: 3, action: 'ease', title: 'Lantern Moth: at the end of your turn, Ease 3 to your last target.' },
      { icon: 'hare', name: 'Burrow Hare', value: 3, action: 'guard', title: 'Burrow Hare: at the end of your turn, you gain 3 Guard.' },
      { icon: 'dog', name: 'Old Dog', value: 6, action: 'ease', title: 'Old Dog: at the end of your turn, Ease 6 to your last target.' },
    ],
    isolated: false,
  })}<span class="g-gap"></span>${companionSlotsMarkup({ slots: [{ icon: 'dog', name: 'Old Dog', value: 6, action: 'ease' }, { icon: 'moth', name: 'Lantern Moth', value: 3, action: 'ease' }, null], isolated: true })}<span class="g-gap"></span>${companionSlotsMarkup({ slots: [], isolated: false })}</div>`;
  const thread = `<div class="g-thread" id="g-thread">${cardFaceMarkup({ name: 'Kind Word', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 6.', rarity: 'starter', state: 'selected' })}${cardFaceMarkup(buried('anger', 2, 'Seething', 'Love'))}</div>`;
  return section(
    'player',
    'Player side',
    'The Wanderer (its lantern flame is the Note), the INWARD target, Companion slots, the Heart row, the Promise tray and the thread of light from a Light card to the Buried card it can Tend.',
    group('Player panel, composed at 340px: a Love card is selected, so the INWARD target shows', `<div class="g-row g-row--top">${playerPanel({ inward: true, lethal: false })}${playerPanel({ inward: false, lethal: true })}</div>`) +
      group('The Wanderer', `<div class="g-row">${avatars}</div>`) +
      group('Companions (56px slots, action number; Isolated greys them; empty slots)', companions) +
      group('Promise tray and incoming line', `<div class="g-row g-row--center">${promiseTrayMarkup(['+5 Guard, draw 1.', 'Gain 1 Spirit and draw 1.'])}${incomingLineMarkup({ text: 'Incoming: strikes 8, Guard 5, Seething 2. You lose 5.' })}</div>`) +
      group('Thread of light (selected Love card to Buried Anger)', thread),
  );
}

function mountThread(): void {
  const host = document.getElementById('g-thread');
  if (!host) return;
  const [a, b] = [...host.querySelectorAll<HTMLElement>('.card-face')];
  if (!a || !b) return;
  const box = host.getBoundingClientRect();
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  host.insertAdjacentHTML(
    'beforeend',
    threadMarkup({ from: [ra.left + ra.width / 2 - box.left, ra.top - box.top + 20], to: [rb.left + rb.width / 2 - box.left, rb.top - box.top + 24], light: 'love', lift: 50 }),
  );
}

// ------------------------------------------------------------------------------------------------
// Compass
// ------------------------------------------------------------------------------------------------

function compassSection(): string {
  const base: CompassProps = {
    enabled: true,
    note: ['love'],
    harmoniesThisTurn: 0,
    energy: 3,
    maxEnergy: 3,
    hollow: false,
    isolated: false,
    act2Unlocked: false,
    ownedLights: ['love', 'joy', 'friendship', 'courage'],
    activeShades: ['anger'],
  };
  const all = [...LIGHTS];
  const tiles: [string, CompassProps][] = [
    ['Before The Compass: Spirit orb only', { ...base, enabled: false, energy: 2 }],
    ['Act 1, Note Love, Anger in the fight', base],
    ['Note Delight (Love+Joy), 1 Harmony', { ...base, note: ['love', 'joy'], harmoniesThisTurn: 1, energy: 1, activeShades: ['sadness', 'loneliness'], harmonyArc: ['love', 'joy'] }],
    ['No Friendship cards owned (dashed), empty Note', { ...base, note: [], ownedLights: ['love', 'joy', 'courage'], activeShades: ['fear'] }],
    ['Act 2, Note Calm, compound edge glows', { ...base, act2Unlocked: true, note: ['calm'], ownedLights: all, harmoniesThisTurn: 2, energy: 2, maxEnergy: 4, activeShades: ['anger', 'sadness'], glowEdges: [['love', 'joy']] }],
    ['Hollow, 0 Spirit', { ...base, act2Unlocked: true, ownedLights: all, note: ['hope'], hollow: true, energy: 0, activeShades: ['despair'] }],
    ['Isolated 2', { ...base, isolated: true, isolatedStacks: 2, note: ['courage'], activeShades: ['loneliness', 'fear'] }],
  ];
  return section(
    'compass',
    'Compass HUD',
    'Ring of six segments with sigils, Spirit orb, Note with pulsing neighbours, Shade markers, DISSONANT arrows, Isolated fog, locked Act 2 segments.',
    `<div class="g-row g-compasses">${tiles.map(([label, p]) => tile(label, compassMarkup(p), 'g-tile--compass')).join('')}</div>`,
  );
}

// ------------------------------------------------------------------------------------------------
// HUD pieces
// ------------------------------------------------------------------------------------------------

const AFFLICTION_CHIPS: StatusChipProps[] = [
  { kind: 'affliction', affliction: 'seething', label: 'Seething', value: 2, title: 'Seething 2: at the end of your turn you lose 2 Heart, then it drops to 1.' },
  { kind: 'affliction', affliction: 'heavy', label: 'Heavy', value: 1 },
  { kind: 'affliction', affliction: 'isolated', label: 'Isolated', value: 2 },
  { kind: 'affliction', affliction: 'trembling', label: 'Trembling', value: 1 },
  { kind: 'affliction', affliction: 'hollow', label: 'Hollow', value: 1 },
  { kind: 'affliction', affliction: 'restless', label: 'Restless', value: 3 },
  { kind: 'affliction', affliction: 'numb', label: 'Numb', value: 2 },
];

const SHADE_CHIPS: StatusChipProps[] = [
  { kind: 'buff', label: 'Flare', value: 2 },
  { kind: 'gauge', label: 'Pressure', value: '4/6' },
  { kind: 'gauge', label: 'Turns left', value: 2 },
  { kind: 'flag', label: 'Short Fuse' },
  { kind: 'flag', label: 'Shy' },
  { kind: 'flag', label: 'Fleeting' },
  { kind: 'buff', label: 'Understood', icon: '' },
  { kind: 'debuff', label: 'Hush', value: 4 },
  { kind: 'flag', label: 'Veiled' },
];

function hudSection(): string {
  const chips =
    group('Affliction chips (ink drop, cure rim, Shade sigil). Chips with a sentence are focusable and show it on hover, focus or tap', `<div class="g-row">${AFFLICTION_CHIPS.map(statusChipMarkup).join('')}</div>`) +
    group('Shade status chips, and a row collapsing to +N', `<div class="g-row">${SHADE_CHIPS.map(statusChipMarkup).join('')}</div><div class="g-row" style="margin-top:10px">${chipRowMarkup(SHADE_CHIPS.slice(0, 5))}</div>`);
  const matchups = group(
    'Matchup chips',
    `<div class="g-row">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'opposite', light: l })).join('')}</div><div class="g-row" style="margin-top:8px">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'dissonant', light: l })).join('')}${matchupChipMarkup({ kind: 'felt' })}${matchupChipMarkup({ kind: 'muffled' })}</div>`,
  );
  const bars = group(
    'Heart (pearl) and Intensity (grey) bars: lag chunk, hatched preview, Mend preview, lethal pulse',
    `<div class="g-bars">
      <div>${barMarkup({ kind: 'heart', value: 54, max: 70 })}<span>Heart 54/70</span></div>
      <div>${barMarkup({ kind: 'heart', value: 54, max: 70, previewLoss: 12 })}<span>predicted loss 12</span></div>
      <div>${barMarkup({ kind: 'heart', value: 40, max: 70, previewGain: 8 })}<span>Mend preview +8</span></div>
      <div>${barMarkup({ kind: 'heart', value: 9, max: 70, previewLoss: 9, lethal: true })}<span>lethal</span></div>
      <div class="g-bar-row">${guardBadgeMarkup(5)}${barMarkup({ kind: 'intensity', value: 24, max: 42 })}<span>Guard 5, Intensity 24/42</span></div>
      <div class="g-bar-row">${barMarkup({ kind: 'intensity', value: 24, max: 42, previewLoss: 12 })}<span>hatched ghost -12</span></div>
      <div class="g-bar-row" id="g-lag">${barMarkup({ kind: 'intensity', value: 42, max: 42 })}<span>lag chunk (live)</span></div>
    </div>`,
  );
  const guard = group(
    'Guard bubble: idle, crack, shatter',
    `<div class="g-row">${(['idle', 'crack', 'shatter'] as const).map((st) => tile(st, guardBubbleMarkup({ state: st, size: 110 }), `g-tile--bubble ${st === 'shatter' ? 'g-freeze" data-t="110' : ''}`)).join('')}</div>`,
  );
  const intents = group(
    'Intent pills (spoken as the engine sentence)',
    `<div class="g-row g-intents">${[
      intentPillMarkup({ items: [{ kind: 'strike', value: 8 }], title: 'Strikes for 8 (7 + 1 Flare).' }),
      intentPillMarkup({ items: [{ kind: 'strike', value: 3, count: 4 }], order: 2 }),
      intentPillMarkup({ items: [{ kind: 'strike', value: 5 }, { kind: 'afflict', affliction: 'seething', stacks: 2 }], order: 1 }),
      intentPillMarkup({ items: [{ kind: 'guard', value: 6 }, { kind: 'buff' }] }),
      intentPillMarkup({ items: [{ kind: 'afflict', affliction: 'heavy', stacks: 1 }, { kind: 'afflict', affliction: 'isolated', stacks: 1 }, { kind: 'guard', value: 10 }] }),
      intentPillMarkup({ items: [{ kind: 'guard', value: 8 }, { kind: 'summon' }] }),
      intentPillMarkup({ items: [{ kind: 'guard', value: 8 }, { kind: 'scatter', value: 1 }] }),
      intentPillMarkup({ items: [{ kind: 'mend', value: 5 }] }),
      intentPillMarkup({ items: [{ kind: 'strike', value: 8 }, { kind: 'afflict', affliction: 'trembling', stacks: 2 }], projected: true, title: 'Lantern Moth will turn it to Fear.' }),
      intentPillMarkup({ items: [{ kind: 'afflict', affliction: 'numb', stacks: 2 }, { kind: 'guard', value: 10 }] }),
    ].join('')}</div>`,
  );
  const floats: [string, FloatingNumberProps][] = [
    ['OPPOSITE', { kind: 'opposite', value: 12, lights: ['love'] }],
    ['OPPOSITE Joy', { kind: 'opposite', value: 16, lights: ['joy'] }],
    ['neutral', { kind: 'neutral', value: 6 }],
    ['DISSONANT', { kind: 'dissonant', value: 3, line: 'Just calm down.' }],
    ['FELT: hard split, both sigils', { kind: 'felt', value: 14, lights: ['love', 'joy'] }],
    ['MUFFLED', { kind: 'muffled', value: 3 }],
    ['Blocked', { kind: 'blocked', value: 5 }],
    ['Mend', { kind: 'mend', value: 4 }],
    ['Heart lost', { kind: 'loss', value: 7 }],
  ];
  const floatRow = group(
    'Floating numbers (frozen mid-flight; click a tile to replay)',
    `<div class="g-row g-floats">${floats
      .map(([label, fp], i) => `<figure class="g-tile g-float g-freeze" data-float="${i}"><div class="g-tile__art g-float__art">${floatingNumberMarkup(fp)}</div><figcaption>${label}</figcaption></figure>`)
      .join('')}</div>`,
  );
  const banners = group(
    'Lethal banners (each engine sub-line on its own line; not live regions)',
    `<div class="g-row g-banners">${[
      lethalBannerMarkup({ kind: 'resolve', lights: ['love'], sub: ['+8 Glimmers', 'Conviction: +1 Nerve'] }),
      lethalBannerMarkup({ kind: 'resolve', lights: ['courage'], sub: ['+8 Glimmers', 'Caution: +6 Guard'] }),
      lethalBannerMarkup({ kind: 'resolve', lights: ['hope'], sub: ['Insight: Passion joins your hand'] }),
      lethalBannerMarkup({ kind: 'deepResolve', lights: ['love', 'joy'], sub: ['Conviction: +1 Nerve', 'Release: Mend 4'] }),
      lethalBannerMarkup({ kind: 'suppress', sub: ['Buried Anger joins your deck (Weight 1)'], resolveWith: 'Kind Word' }),
      lethalBannerMarkup({ kind: 'suppress', sub: ['The Numbness +20 Intensity'] }),
      lethalBannerMarkup({ kind: 'fade' }),
      lethalBannerMarkup({ kind: 'wavering' }),
    ].join('')}</div>`,
  );
  const tips = group(
    'Tooltip',
    `<div class="g-row" style="position:relative;height:90px">${tooltipMarkup({
      title: 'Seething 2',
      lines: ['At the end of your turn you lose 2 Heart.', 'Love cards soothe 1. Play Love Inward to clear it all.'],
      arrow: 'up',
    }).replace('class="tooltip', 'style="position:relative" class="tooltip')}</div>`,
  );
  const buttons = group(
    'Buttons and panel',
    `<div class="g-row">
      <button class="btn btn--primary btn--stack">End Turn (E)<span class="btn__sub">2 Spirit unused</span></button>
      <button class="btn">Undo <span class="kbd">Z</span></button>
      <button class="btn btn--light" data-light="friendship">Take card</button>
      <button class="btn btn--ghost">Skip <span class="kbd">S</span></button>
      <button class="btn btn--pulse">End Turn</button>
      <button class="btn" disabled>Undo (disabled)</button>
      <button class="btn btn--primary" disabled>End Turn (disabled)</button>
      <button class="btn btn--small">Small</button>
      <div class="panel" style="width:320px"><div class="panel__title">A Quiet Moment</div><p class="muted">The water is perfectly still. Your reflection looks like it has been waiting for you.</p></div>
    </div>`,
  );
  return section('hud', 'HUD pieces', 'Chips, bars, Guard, intents, floating numbers, lethal banners, tooltips and buttons.', chips + matchups + bars + guard + intents + floatRow + banners + tips + buttons);
}

// ------------------------------------------------------------------------------------------------
// Map and run HUD
// ------------------------------------------------------------------------------------------------

const MIX_SEGMENTS: Parameters<typeof lightMixMarkup>[0]['segments'] = [
  { kind: 'light', light: 'love', count: 4 },
  { kind: 'light', light: 'joy', count: 3 },
  { kind: 'light', light: 'friendship', count: 2 },
  { kind: 'light', light: 'courage', count: 4 },
  { kind: 'blend', lights: ['love', 'joy'], count: 1 },
  { kind: 'blend', lights: ['friendship', 'courage'], count: 1 },
  { kind: 'neutral', count: 1 },
  { kind: 'insight', light: 'calm', count: 1 },
  { kind: 'buried', shade: 'anger', count: 1 },
  { kind: 'buried', shade: 'fear', count: 1 },
];

/** A four-row slice of a map: nodes on a grid, edges dotted ahead and solid behind. */
function mapSlice(): string {
  const W = 560;
  const H = 400;
  const col = (c: number) => 80 + c * 133;
  const row = (r: number) => H - 50 - r * 100;
  type N = { c: number; r: number; p: MapNodeProps };
  const nodes: N[] = [
    { c: 1, r: 0, p: { kind: 'fight', state: 'visited', shades: [['anger']], label: 'Fight, visited: Grumble' } },
    { c: 2, r: 0, p: { kind: 'fight', state: 'unreachable', shades: [['sadness']], label: 'Fight: Mope' } },
    { c: 1, r: 1, p: { kind: 'chest', state: 'current', label: 'Chest, you are here' } },
    { c: 0, r: 2, p: { kind: 'fight', state: 'reachable', key: 1, shades: [['fear'], ['anger']], label: 'Fight: Fear and Anger' } },
    { c: 1, r: 2, p: { kind: 'elite', state: 'reachable', key: 2, shades: [['anger']], label: 'Elite: The Kettle' } },
    { c: 2, r: 2, p: { kind: 'memory', state: 'reachable', key: 3, label: 'Memory' } },
    { c: 3, r: 2, p: { kind: 'sanctuary', state: 'unreachable', label: 'Sanctuary' } },
    { c: 0, r: 3, p: { kind: 'haven', state: 'unreachable', label: 'Haven' } },
    { c: 1, r: 3, p: { kind: 'fight', state: 'unreachable', shades: [['loneliness'], ['sadness'], ['fear']], label: 'Fight: Loneliness, Sadness and Fear' } },
    { c: 2, r: 3, p: { kind: 'fight', state: 'unreachable', shades: [['anger', 'sadness']], label: 'Fight: Old Grudge' } },
  ];
  const at = (c: number, r: number): [number, number] => [col(c), row(r)];
  const edges: MapEdge[] = [
    { from: at(1, 0), to: at(1, 1), state: 'travelled' },
    { from: at(2, 0), to: at(1, 1), state: 'future' },
    { from: at(1, 1), to: at(0, 2), state: 'route' },
    { from: at(1, 1), to: at(1, 2), state: 'future' },
    { from: at(1, 1), to: at(2, 2), state: 'future' },
    { from: at(2, 0), to: at(3, 2), state: 'future' },
    { from: at(0, 2), to: at(0, 3), state: 'route' },
    { from: at(1, 2), to: at(1, 3), state: 'future' },
    { from: at(2, 2), to: at(2, 3), state: 'future' },
    { from: at(3, 2), to: at(2, 3), state: 'future' },
  ];
  const placed = nodes
    .map((nd) => `<div class="g-map__node" style="left:${col(nd.c)}px;top:${row(nd.r)}px">${mapNodeMarkup(nd.p)}</div>`)
    .join('');
  return `<div class="g-map" style="width:${W}px;height:${H}px">${mapEdgesMarkup({ width: W, height: H, edges })}${placed}</div>`;
}

function mapSection(): string {
  const nodes: [string, MapNodeProps][] = [
    ['Fear + Anger, reachable, key 1', { kind: 'fight', state: 'reachable', key: 1, shades: [['fear'], ['anger']], label: 'Fight: Fear and Anger' }],
    ['one Shade: big sigil', { kind: 'fight', state: 'reachable', key: 2, shades: [['despair']], label: 'Fight: Slump' }],
    ['compound: joined by a bar', { kind: 'fight', state: 'reachable', key: 3, shades: [['anger', 'sadness']], label: 'Fight: Old Grudge' }],
    ['three Shades, visited', { kind: 'fight', state: 'visited', shades: [['sadness'], ['loneliness'], ['fear']], label: 'Fight, visited' }],
    ['elite: The Knot', { kind: 'elite', state: 'reachable', key: 4, shades: [['anxiety', 'anger']], label: 'Elite: The Knot' }],
    ['elite: Apathy (NUMB)', { kind: 'elite', state: 'unreachable', shades: [['numb']], label: 'Elite: Apathy' }],
    ['current', { kind: 'fight', state: 'current', shades: [['anxiety']], label: 'Fight, you are here' }],
    ['haven, reachable', { kind: 'haven', state: 'reachable', key: 1, label: 'Haven' }],
    ['sanctuary, visited', { kind: 'sanctuary', state: 'visited', label: 'Sanctuary, visited' }],
    ['memory, unreachable', { kind: 'memory', state: 'unreachable', label: 'Memory' }],
    ['chest, reachable', { kind: 'chest', state: 'reachable', key: 2, label: 'Chest' }],
    ['boss: The Mask', { kind: 'boss', state: 'unreachable', label: 'Boss: The Mask', silhouette: { family: 'mask', seed: 7, face: 'anger', nextFace: 'sadness', ornament: 'mask' } }],
    ['boss: The Spiral', { kind: 'boss', state: 'reachable', key: 1, label: 'Boss: The Spiral', silhouette: { family: 'despair', seed: 8, face: 'despair', innerFace: 'anxiety', ornament: 'spiral' } }],
    ['boss, no silhouette', { kind: 'boss', state: 'visited', label: 'Boss' }],
  ];
  return section(
    'map',
    'Map and run HUD',
    'Map nodes (Shade sigils on fights and elites, compounds joined by a bar, key numbers on reachable nodes, boss silhouettes), edges, the legend, the Light Mix bar (Blends split, Buried ink with a cure rim, Insight pearl, a +1 ghost for the hovered reward) and the Numbness meter.',
    group('Nodes and states: reachable (pulsing ring and key), visited (filled), current, unreachable (40%)', `<div class="g-grid g-grid--nodes">${nodes.map(([label, p]) => tile(label, mapNodeMarkup(p), 'g-tile--node')).join('')}</div>`) +
      group('A map slice: travelled edges solid, future dotted, the hovered route bright; the legend is always visible', `<div class="g-row g-row--top">${mapSlice()}<div class="panel g-legend">${mapLegendMarkup()}</div></div>`) +
      group('Light Mix bar (x240-1040): a +1 ghost on Joy for the hovered reward card', `<div class="g-mix">${lightMixMarkup({ width: 800, ghost: 1, segments: MIX_SEGMENTS, button: true })}</div>`) +
      group('The Numbness meter (top bar and map panel)', `<div class="g-row">${numbnessMeterMarkup({ count: 2, title: 'Buried Anger (W2) and Buried Fear (W1) will surface. The rest add +6 Intensity per Weight.' })}${numbnessMeterMarkup({ count: 3 })}${numbnessMeterMarkup({ count: 1 })}</div>`),
  );
}

// ------------------------------------------------------------------------------------------------
// Guidance: coach marks, barks, feet chips
// ------------------------------------------------------------------------------------------------

function guidanceSection(): string {
  return section(
    'guidance',
    'Coach marks, barks and feet chips',
    'Coach marks are pearl bubbles with an arrow toward their anchor and never block input. Barks are the Shades speaking; farewells are ink. Promise and Wavering chips sit at a Shade\'s feet.',
    group(
      'Coach marks (arrow down, left, up, right)',
      `<div class="g-row g-row--center g-coach">${coachMarkMarkup({ text: 'Kind Word is Love. Love is Anger’s opposite, so it Eases double.', arrow: 'down' })}${coachMarkMarkup({ text: 'Drop a card on yourself: clear your feeling and Tend what you buried.', arrow: 'left' })}${coachMarkMarkup({ text: 'Out of Spirit. End your turn and you get 3 back.', arrow: 'up' })}${coachMarkMarkup({ text: 'Two feelings. OPPOSITE hits turn it.', arrow: 'right' })}</div>`,
    ) +
      group('Barks and farewells', `<div class="g-row g-row--center">${barkMarkup({ text: 'Nobody LISTENS.' })}${barkMarkup({ text: 'HMPH.', tail: 'left' })}${barkMarkup({ text: 'It goes quiet. Not calm. Just quiet.', farewell: true })}</div>`) +
      group(
        "Chips at a Shade's feet",
        `<div class="g-row g-row--center">${promiseChipMarkup({ text: 'Promise: Ease 8', lights: ['hope'] })}${promiseChipMarkup({ text: 'Promise: Ease 12', lights: ['hope', 'courage'] })}${waveringChipMarkup()}</div>`,
      ),
  );
}

// ------------------------------------------------------------------------------------------------
// Palettes and greyscale
// ------------------------------------------------------------------------------------------------

function paletteSection(): string {
  const swatches = (pal: 'default' | 'cb') =>
    `<div class="g-palette" data-palette="${pal}"><h3>${pal === 'cb' ? 'Colour-blind (Okabe-Ito)' : 'Default'}</h3><div class="g-swatches">${LIGHTS.map(
      (l) => `<div class="g-swatch" data-light="${l}"><span class="g-swatch__chip"></span>${sigil(l, { size: 24, tint: true })}<b>${LIGHT_NAME[l]}</b></div>`,
    ).join('')}</div><div class="g-cards">${LIGHTS.map((l) => cardFaceMarkup({ name: SAMPLE[l].name, lights: [l], cost: SAMPLE[l].cost, kindLabel: SAMPLE[l].kind, text: SAMPLE[l].text, rarity: 'common' })).join('')}</div></div>`;
  return section('palettes', 'Both palettes', 'The default Light colours and the colour-blind palette, side by side.', `<div class="g-palettes">${swatches('default')}${swatches('cb')}</div>`);
}

function greyscaleSection(): string {
  const sig = [...LIGHTS, ...SHADES, 'numb', 'doubt'] as const;
  return section(
    'greyscale',
    'Greyscale strip',
    'Everything must stay readable with ?gray=1: shapes, patterns and labels carry the meaning.',
    `<div class="g-greyscale">
      <div class="g-row g-grey-sigils">${sig.map((nm) => `<span class="g-grey-sigil">${sigil(nm, { size: 28, tint: true })}<small>${nm}</small></span>`).join('')}</div>
      <div class="g-cards">${LIGHTS.map((l) => cardFaceMarkup({ name: SAMPLE[l].name, lights: [l], cost: SAMPLE[l].cost, kindLabel: SAMPLE[l].kind, text: SAMPLE[l].text, rarity: 'common' })).join('')}${BLEND_SAMPLES.slice(0, 1)
        .map((p) => cardFaceMarkup(p))
        .join('')}</div>
      <div class="g-row">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'opposite', light: l })).join('')}${AFFLICTION_CHIPS.slice(0, 4).map(statusChipMarkup).join('')}</div>
      <div class="g-row">${[
        shadeTile({ family: 'anger', seed: 5, face: 'anger', innerFace: 'sadness' }, 'compound badge dim (dashed)'),
        shadeTile({ family: 'anger', seed: 5, face: 'sadness', innerFace: 'sadness' }, 'compound badge lit (filled)'),
      ].join('')}${compassMarkup({ enabled: true, note: ['love', 'joy'], harmoniesThisTurn: 1, energy: 0, maxEnergy: 3, hollow: true, isolated: false, act2Unlocked: true, ownedLights: ['love', 'joy', 'courage', 'hope'], activeShades: ['anger'] })}</div>
      ${stageRow()}
    </div>`,
  );
}

function mountLiveDemos(): void {
  document.querySelectorAll<HTMLElement>('.g-freeze').forEach((el) => {
    const t = Number(el.dataset.t ?? 260);
    el.getAnimations({ subtree: true }).forEach((a) => {
      a.pause();
      a.currentTime = t;
    });
  });
  document.querySelectorAll<HTMLElement>('.g-float').forEach((fig) => {
    fig.addEventListener('click', () => {
      const art = fig.querySelector<HTMLElement>('.g-float__art')!;
      const props = FLOAT_REPLAY[Number(fig.dataset.float)];
      if (props) spawnFloatingNumber(art, props, art.clientWidth / 2, art.clientHeight / 2);
    });
  });
  const lag = document.querySelector<HTMLElement>('#g-lag .bar');
  if (lag) {
    let hp = 42;
    setInterval(() => {
      hp = hp <= 10 ? 42 : hp - 11;
      setBarValue(lag, hp, 42);
    }, 1500);
  }
}

// ------------------------------------------------------------------------------------------------
// Audio and toolbar
// ------------------------------------------------------------------------------------------------

function audioSection(): string {
  const b = (id: string, label: string) => `<button class="btn btn--small" data-sound="${id}">${label}</button>`;
  const lights = LIGHTS.map((l) => b(`light:${l}`, LIGHT_NAME[l])).join('');
  const rel = ['opposite', 'dissonant', 'muffled', 'neutral'].map((r) => b(`rel:${r}`, r)).join('') + b('felt', 'felt (Love+Joy)');
  const shades = [...SHADES, 'numb'].map((sh) => b(`strike:${sh}`, sh)).join('');
  const uis = ['hover', 'play', 'spirit', 'notEnough', 'glimmer', 'confirm', 'cancel'].map((u) => b(`ui:${u}`, u)).join('');
  const big =
    b('harmony', 'harmony chain') +
    b('resolve', 'resolve (Joy)') +
    b('deep', 'deep resolve (Love+Joy)') +
    b('suppress', 'suppress') +
    b('inward', 'inward (Calm)') +
    b('glimmers', 'glimmers x8') +
    b('wheel', 'the wheel closes') +
    b('heart', 'heartbeat') +
    b('amb:1', 'ambience Act 1') +
    b('amb:2', 'ambience Act 2') +
    b('amb:deep', 'ambience Deep') +
    b('amb:off', 'ambience off') +
    b('brighten', 'brighten (Resolve)');
  return section(
    'audio',
    'Sounds',
    'WebAudio synthesis, no files. The first click creates the AudioContext. Every sound has a visual twin, so muting loses nothing.',
    group('Light voices (pentatonic in wheel order)', `<div class="g-row g-row--buttons">${lights}</div>`) +
      group('Hit relations (Courage)', `<div class="g-row g-row--buttons">${rel}</div>`) +
      group('Shade strikes', `<div class="g-row g-row--buttons">${shades}</div>`) +
      group('UI', `<div class="g-row g-row--buttons">${uis}</div>`) +
      group('Moments and ambience', `<div class="g-row g-row--buttons">${big}</div>`),
  );
}

function mountAudio(): void {
  synth.init();
  let chainStep = 0;
  document.getElementById('audio')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sound]');
    if (!btn) return;
    synth.unlock();
    const [kind, arg] = btn.dataset.sound!.split(':') as [string, string | undefined];
    switch (kind) {
      case 'light':
        synth.light(arg as Light, 'opposite');
        break;
      case 'rel':
        synth.light('courage', arg as 'opposite');
        break;
      case 'felt':
        synth.light(['love', 'joy'], 'felt');
        break;
      case 'strike':
        synth.strike(arg as Shade);
        break;
      case 'ui':
        synth.ui(arg as UiSound);
        break;
      case 'harmony': {
        const walk: Light[] = ['love', 'joy', 'friendship', 'courage', 'hope', 'calm'];
        const a = walk[chainStep % 6]!;
        const bb = walk[(chainStep + 1) % 6]!;
        chainStep++;
        synth.harmony([a, bb]);
        break;
      }
      case 'resolve':
        synth.resolve('joy');
        break;
      case 'deep':
        synth.resolve(['love', 'joy'], true);
        break;
      case 'suppress':
        synth.suppress();
        break;
      case 'inward':
        synth.inward('calm');
        break;
      case 'glimmers':
        synth.glimmers(8);
        break;
      case 'wheel':
        synth.wheelCloses();
        break;
      case 'heart':
        synth.heartbeat();
        break;
      case 'amb':
        synth.ambience(arg === 'off' ? null : arg === 'deep' ? 'deep' : (Number(arg) as 1 | 2));
        break;
      case 'brighten':
        synth.ambienceBrighten();
        break;
    }
  });
}

function toolbar(): string {
  return `<div class="g-toolbar" id="g-toolbar">
    <button class="btn btn--small" data-toggle="palette">Colour-blind palette</button>
    <button class="btn btn--small" data-toggle="motion">Reduced motion</button>
    <button class="btn btn--small" data-toggle="gray">Greyscale (?gray=1)</button>
    <button class="btn btn--small" data-toggle="mute">Mute</button>
    <nav class="g-nav">${['sigils', 'cards', 'shades', 'stage', 'player', 'compass', 'hud', 'map', 'guidance', 'palettes', 'greyscale', 'audio']
      .map((id) => `<a href="#${id}">${id}</a>`)
      .join('')}</nav>
  </div>`;
}

function applyUrlFlags(): void {
  const q = new URLSearchParams(location.search);
  const html = document.documentElement;
  if (q.get('gray') === '1') html.dataset.gray = '1';
  if (q.get('palette') === 'cb') html.dataset.palette = 'cb';
  if (q.get('motion') === 'reduced') html.dataset.motion = 'reduced';
}

function mountToolbar(): void {
  const html = document.documentElement;
  document.getElementById('g-toolbar')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle]');
    if (!btn) return;
    const which = btn.dataset.toggle;
    if (which === 'palette') html.dataset.palette = html.dataset.palette === 'cb' ? 'default' : 'cb';
    if (which === 'motion') html.dataset.motion = html.dataset.motion === 'reduced' ? 'full' : 'reduced';
    if (which === 'gray') {
      if (html.dataset.gray) delete html.dataset.gray;
      else html.dataset.gray = '1';
    }
    if (which === 'mute') synth.setMuted(!synth.muted);
    btn.classList.toggle('is-on');
  });
}

const FLOAT_REPLAY: FloatingNumberProps[] = [
  { kind: 'opposite', value: 12, lights: ['love'] },
  { kind: 'opposite', value: 16, lights: ['joy'] },
  { kind: 'neutral', value: 6 },
  { kind: 'dissonant', value: 3, line: 'Just calm down.' },
  { kind: 'felt', value: 14, lights: ['love', 'joy'] },
  { kind: 'muffled', value: 3 },
  { kind: 'blocked', value: 5 },
  { kind: 'mend', value: 4 },
  { kind: 'loss', value: 7 },
];

root.innerHTML =
  `<header class="g-head"><h1>Heartward UI kit</h1><p>Every feeling has a light.</p></header>` +
  toolbar() +
  sigilSection() +
  cardSection() +
  shadeSection() +
  stageSection() +
  playerSection() +
  compassSection() +
  hudSection() +
  mapSection() +
  guidanceSection() +
  paletteSection() +
  greyscaleSection() +
  audioSection();
applyUrlFlags();
mountToolbar();
mountReactions();
mountLiveDemos();
mountAudio();
fitCards(root);
mountThread();
void mountAllCards();
