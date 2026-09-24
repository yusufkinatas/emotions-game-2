/// <reference types="vite/client" />
// Developer gallery for the UI kit (gallery.html). Not part of the game build.
import './styles/index.css';
import './styles/gallery.css';

import { LIGHTS, SHADES } from '../engine/emotions';
import type { Light, Shade } from '../engine/emotions';
import { synth } from './audio/synth';
import type { UiSound } from './audio/synth';
import { cardFaceMarkup, fitCardNames } from './kit/cardFace';
import { compassMarkup } from './kit/compass';
import type { CompassProps } from './kit/compass';
import type { CardFaceProps } from './kit/cardFace';
import { LIGHT_NAME, SHADE_NAME } from './kit/names';
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
import { renderShade, resolvedFormMarkup, setShadeReaction, shadeMarkup } from './kit/shadeArt';
import type { ShadeArtOpts, ShadeFamily, ShadeReaction } from './kit/shadeArt';
import { ICON_NAMES, intentIcon, keepsakeIcon, markIcon, nodeIcon, numbBadge, resourceIcon, sigil } from './kit/sigils';

const root = document.getElementById('gallery')!;

function section(id: string, title: string, note: string, body: string): string {
  return `<section class="g-section" id="${id}"><header><h2>${title}</h2><p>${note}</p></header>${body}</section>`;
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
  const grid = (title: string, items: string) => `<div class="g-group"><h3>${title}</h3><div class="g-grid">${items}</div></div>`;
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
      grid(
        'Map nodes',
        ICON_NAMES.nodes
          .map((k) => tile(k, `<span class="map-node" data-kind="${k}">${nodeIcon(k)}</span>`, 'g-tile--node'))
          .join(''),
      ) +
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
  hope: { name: 'Wish on a Star', text: 'Ease 4. Promise: Ease 8 to the same Shade.', kind: 'Ease', cost: 1 },
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

function cardSection(): string {
  const lightCards = LIGHTS.map((l) => {
    const s = SAMPLE[l];
    return card({ name: s.name, lights: [l], cost: s.cost, kindLabel: s.kind, text: s.text, rarity: 'common' }, LIGHT_NAME[l]);
  }).join('');
  const blends = BLEND_SAMPLES.map((p) => card(p)).join('');
  const special = [
    card({ name: 'Name It', lights: [], cost: 1, kindLabel: 'Ease', text: 'Ease 4. Then the target becomes Understood.', rarity: 'common' }, 'Neutral'),
    card({ name: 'Buried Anger', lights: [], cost: null, kindLabel: 'Buried', text: 'Unplayable. End of turn in hand: gain 1 Seething. Play a Love card Inward to Tend.', rarity: 'special', buried: { weight: 1, shade: 'anger' } }, 'Buried W1'),
    card({ name: 'Buried Fear', lights: [], cost: null, kindLabel: 'Buried', text: 'Unplayable. End of turn in hand: gain 2 Trembling. Play a Courage card Inward to Tend.', rarity: 'special', buried: { weight: 2, shade: 'fear' } }, 'Buried W2'),
    card({ name: 'Buried Despair', lights: [], cost: null, kindLabel: 'Buried', text: 'Unplayable. End of turn in hand: gain 3 Hollow. Play a Hope card Inward to Tend.', rarity: 'special', buried: { weight: 3, shade: 'despair' } }, 'Buried W3'),
    card({ name: 'Passion', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 9, +3 for each Flare on the target. Gain 1 Nerve.', rarity: 'special', insight: true }, 'Insight'),
    card({ name: 'Foresight', lights: ['calm'], cost: 0, kindLabel: 'Skill', text: 'Draw 2. Hush 3 on ALL Shades. Linger.', rarity: 'special', insight: true, upgraded: true }, 'Insight upgraded'),
  ].join('');
  const base: CardFaceProps = { name: 'Kind Word', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 12.', rarity: 'starter' };
  const states = (['idle', 'playable', 'selected', 'unaffordable', 'numbed'] as const)
    .map((st) => card({ ...base, state: st, costState: st === 'unaffordable' ? 'unaffordable' : 'normal' }, st))
    .join('');
  const costs = [
    card({ ...base, name: 'Brave Strike', lights: ['courage'], cost: 2, costState: 'raised', text: 'Ease 6.' }, 'cost raised (Restless)'),
    card({ ...base, name: 'Daybreak', lights: ['hope'], cost: 1, costState: 'lowered', text: 'Ease 18 to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.', rarity: 'rare' }, 'cost lowered, rare'),
    card({ ...base, name: 'Soft Spot', upgraded: true, text: 'Ease 8. Mend 3.', rarity: 'common', numberTrends: ['up', null] }, 'upgraded, trend up'),
    card({ ...base, name: 'Reach Out', lights: ['friendship'], text: 'Ease 3.', rarity: 'uncommon', numberTrends: ['down'], chips: ['HARMONY -> Playfulness'] }, 'uncommon, trend down, chip'),
    card({ ...base, name: 'Kind Word', lights: ['love'], text: 'Ease 6.', chips: ['Tends Buried Anger', 'Soothes Seething'], state: 'playable' }, 'two chips'),
  ].join('');
  return section(
    'cards',
    'Card faces',
    'Every frame, Blend split, Buried, Insight, states and cost states at the 130x182 reference size.',
    `<div class="g-group"><h3>Lights</h3><div class="g-cards">${lightCards}</div></div>
     <div class="g-group"><h3>Blends</h3><div class="g-cards">${blends}</div></div>
     <div class="g-group"><h3>Neutral, Buried, Insight</h3><div class="g-cards">${special}</div></div>
     <div class="g-group"><h3>States</h3><div class="g-cards">${states}</div></div>
     <div class="g-group"><h3>Cost, rarity, trends, chips</h3><div class="g-cards g-cards--chips">${costs}</div></div>`,
  );
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
    .map(
      (f) =>
        `<div class="g-group"><h3>${f}</h3><div class="g-row">${seeds
          .map((sd) => shadeTile({ family: f, seed: sd, face: FAMILY_FACE[f] }, `seed ${sd}`))
          .join('')}${shadeTile({ family: f, seed: 77, face: FAMILY_FACE[f], flare: 3 }, 'Flare 3')}</div></div>`,
    )
    .join('');
  const small = `<div class="g-group"><h3>Doubt (Fleeting), scale 0.6</h3><div class="g-row">${seeds
    .map((sd) => shadeTile({ family: 'doubt', seed: sd, face: 'fear', scale: 0.6 }, `seed ${sd}`))
    .join('')}${shadeTile({ family: 'fear', seed: 88, face: 'fear', scale: 1.15, flare: 1 }, 'The Looming, scale 1.15')}</div></div>`;
  const compounds = `<div class="g-group"><h3>Compounds: outer silhouette + inner-face badge</h3><div class="g-row">${[
    shadeTile({ family: 'anger', seed: 5, face: 'anger', innerFace: 'sadness' }, 'Old Grudge, Anger showing'),
    shadeTile({ family: 'anger', seed: 5, face: 'sadness', innerFace: 'sadness' }, 'Old Grudge, Sadness showing'),
    shadeTile({ family: 'sadness', seed: 9, face: 'sadness', innerFace: 'loneliness' }, 'Longing'),
    shadeTile({ family: 'loneliness', seed: 12, face: 'fear', innerFace: 'fear' }, 'Wallflower, Fear showing'),
    shadeTile({ family: 'fear', seed: 14, face: 'fear', innerFace: 'despair' }, 'Dread'),
    shadeTile({ family: 'anxiety', seed: 15, face: 'anxiety', innerFace: 'anger', scale: 1.1 }, 'The Knot'),
    shadeTile({ family: 'despair', seed: 16, face: 'anxiety', innerFace: 'anxiety', scale: 1.12 }, 'The Spiral, Anxiety showing'),
  ].join('')}</div></div>`;
  const maskRow = `<div class="g-group"><h3>The Mask: face sigil, next face on the forehead, cracks spread with Flare</h3><div class="g-row">${(
    [
      ['anger', 'sadness', 0],
      ['sadness', 'loneliness', 1],
      ['loneliness', 'fear', 3],
      ['fear', 'anger', 5],
    ] as const
  )
    .map(([f, nx, fl]) => shadeTile({ family: 'mask', seed: 1, face: f, nextFace: nx, flare: fl }, `${SHADE_NAME[f]}, next ${SHADE_NAME[nx]}, Flare ${fl}`))
    .join('')}</div></div>`;
  const numbRow = `<div class="g-group"><h3>Apathy and The Numbness</h3><div class="g-row">${[
    shadeTile({ family: 'numb', seed: 2, face: null, slouched: true, scale: 0.85 }, 'Apathy'),
    shadeTile({ family: 'numb', seed: 3, face: null }, 'The Numbness'),
    shadeTile({ family: 'numb', seed: 3, face: null, feltCracks: [['love', 'joy'], ['courage', 'hope'], ['calm', 'love']] }, 'after 3 FELT hits'),
  ].join('')}</div></div>`;
  const flareRow = `<div class="g-group"><h3>Flare 0 to 5</h3><div class="g-row">${[0, 1, 2, 3, 4, 5]
    .map((fl) => shadeTile({ family: 'fear', seed: 40, face: 'fear', flare: fl, size: 140 }, `Flare ${fl}`))
    .join('')}</div><div class="g-row">${[0, 2, 5]
    .map((fl) => shadeTile({ family: 'anger', seed: 41, face: 'anger', flare: fl, size: 140 }, `Anger Flare ${fl}`))
    .join('')}${[0, 5]
    .map((fl) => shadeTile({ family: 'loneliness', seed: 42, face: 'loneliness', flare: fl, size: 140 }, `Loneliness Flare ${fl}`))
    .join('')}${[0, 5]
    .map((fl) => shadeTile({ family: 'despair', seed: 43, face: 'despair', flare: fl, size: 140 }, `Despair Flare ${fl}`))
    .join('')}</div></div>`;
  const reactions: ShadeReaction[] = ['flinch', 'swell', 'hit', 'resolving', 'deepResolving', 'suppressed'];
  const reactRow = `<div class="g-group"><h3>Reactions (click to replay)</h3><div class="g-row" id="g-reactions">${reactions
    .map((re) => `<figure class="g-shade" data-reaction="${re}"><div class="g-shade__stage"></div><figcaption><button class="btn btn--small">${re}</button></figcaption></figure>`)
    .join('')}</div></div>`;
  const forms = `<div class="g-group"><h3>Resolved forms</h3><div class="g-row g-forms">${LIGHTS.map(
    (l) => `<figure class="g-tile" data-light="${l}"><div class="g-tile__art">${resolvedFormMarkup(l, { size: 44 })}</div><figcaption>${LIGHT_NAME[l]}</figcaption></figure>`,
  ).join('')}</div></div>`;
  return section(
    'shades',
    'Shades',
    'Procedural silhouettes, one generator per family, varied by seed. Cracks glow in the cure colour of the showing face.',
    rows + small + compounds + maskRow + numbRow + flareRow + reactRow + forms,
  );
}

function mountReactions(): void {
  const row = document.getElementById('g-reactions');
  if (!row) return;
  for (const fig of row.querySelectorAll<HTMLElement>('[data-reaction]')) {
    const reaction = fig.dataset.reaction as ShadeReaction;
    const stage = fig.querySelector('.g-shade__stage')!;
    // First render freezes a representative frame so a still (or a screenshot) shows the effect.
    const FREEZE_AT: Partial<Record<ShadeReaction, number>> = { hit: 70, resolving: 560, deepResolving: 600, suppressed: 560 };
    const play = (freeze: boolean) => {
      const deep = reaction === 'deepResolving';
      const svg = renderShade({
        family: deep ? 'anger' : 'sadness',
        seed: 21,
        face: deep ? 'anger' : 'sadness',
        innerFace: deep ? 'sadness' : null,
        size: 180,
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
    ['No Friendship cards owned, empty Note', { ...base, note: [], ownedLights: ['love', 'joy', 'courage'], activeShades: ['fear'] }],
    ['Act 2, Note Calm, compound edge glows', { ...base, act2Unlocked: true, note: ['calm'], ownedLights: all, harmoniesThisTurn: 2, energy: 2, maxEnergy: 4, activeShades: ['anger', 'sadness'], glowEdges: [['love', 'joy']] }],
    ['Hollow, 0 Spirit', { ...base, act2Unlocked: true, ownedLights: all, note: ['hope'], hollow: true, energy: 0, activeShades: ['despair'] }],
    ['Isolated', { ...base, isolated: true, note: ['courage'], activeShades: ['loneliness', 'fear'] }],
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
  { kind: 'affliction', affliction: 'seething', label: 'Seething', value: 2, title: 'Seething 2: at the end of your turn you lose 2 Heart.' },
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
  const chips = `<div class="g-group"><h3>Affliction chips (ink drop, cure rim, Shade sigil)</h3><div class="g-row">${AFFLICTION_CHIPS.map(statusChipMarkup).join('')}</div></div>
    <div class="g-group"><h3>Shade status chips, and a row collapsing to +N</h3><div class="g-row">${SHADE_CHIPS.map(statusChipMarkup).join('')}</div><div class="g-row" style="margin-top:10px">${chipRowMarkup(SHADE_CHIPS.slice(0, 5))}</div></div>`;
  const matchups = `<div class="g-group"><h3>Matchup chips</h3><div class="g-row">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'opposite', light: l })).join('')}</div><div class="g-row" style="margin-top:8px">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'dissonant', light: l })).join('')}${matchupChipMarkup({ kind: 'felt' })}${matchupChipMarkup({ kind: 'muffled' })}</div></div>`;
  const bars = `<div class="g-group"><h3>Heart and Intensity bars (lag chunk, hatched preview, Mend preview, lethal pulse)</h3>
    <div class="g-bars">
      <div>${barMarkup({ kind: 'heart', value: 54, max: 70 })}<span>Heart 54/70</span></div>
      <div>${barMarkup({ kind: 'heart', value: 54, max: 70, previewLoss: 12 })}<span>predicted loss 12</span></div>
      <div>${barMarkup({ kind: 'heart', value: 40, max: 70, previewGain: 8 })}<span>Mend preview +8</span></div>
      <div>${barMarkup({ kind: 'heart', value: 9, max: 70, previewLoss: 9, lethal: true })}<span>lethal</span></div>
      <div class="g-bar-row">${guardBadgeMarkup(5)}${barMarkup({ kind: 'intensity', value: 24, max: 42 })}<span>Guard 5, Intensity 24/42</span></div>
      <div class="g-bar-row">${barMarkup({ kind: 'intensity', value: 24, max: 42, previewLoss: 12 })}<span>hatched ghost -12</span></div>
      <div class="g-bar-row" id="g-lag">${barMarkup({ kind: 'intensity', value: 42, max: 42 })}<span>lag chunk (live)</span></div>
    </div></div>`;
  const guard = `<div class="g-group"><h3>Guard bubble: idle, crack, shatter</h3><div class="g-row">${(['idle', 'crack', 'shatter'] as const)
    .map((st) => tile(st, guardBubbleMarkup({ state: st, size: 110 }), `g-tile--bubble ${st === 'shatter' ? 'g-freeze" data-t="110' : ''}`))
    .join('')}</div></div>`;
  const intents = `<div class="g-group"><h3>Intent pills</h3><div class="g-row g-intents">${[
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
  ].join('')}</div></div>`;
  const floats: [string, FloatingNumberProps][] = [
    ['OPPOSITE', { kind: 'opposite', value: 12, lights: ['love'] }],
    ['OPPOSITE Joy', { kind: 'opposite', value: 16, lights: ['joy'] }],
    ['neutral', { kind: 'neutral', value: 6 }],
    ['DISSONANT', { kind: 'dissonant', value: 3, line: 'Just calm down.' }],
    ['FELT', { kind: 'felt', value: 14, lights: ['love', 'joy'] }],
    ['MUFFLED', { kind: 'muffled', value: 3 }],
    ['Blocked', { kind: 'blocked', value: 5 }],
    ['Mend', { kind: 'mend', value: 4 }],
    ['Heart lost', { kind: 'loss', value: 7 }],
  ];
  const floatRow = `<div class="g-group"><h3>Floating numbers (frozen mid-flight; click a tile to replay)</h3><div class="g-row g-floats">${floats
    .map(([label, fp], i) => `<figure class="g-tile g-float g-freeze" data-float="${i}"><div class="g-tile__art g-float__art">${floatingNumberMarkup(fp)}</div><figcaption>${label}</figcaption></figure>`)
    .join('')}</div></div>`;
  const banners = `<div class="g-group"><h3>Lethal banners</h3><div class="g-row g-banners">${[
    lethalBannerMarkup({ kind: 'resolve', lights: ['love'], sub: ['+8 Glimmers', 'Conviction: +1 Nerve'] }),
    lethalBannerMarkup({ kind: 'resolve', lights: ['courage'], sub: ['+8 Glimmers', 'Caution: +6 Guard'] }),
    lethalBannerMarkup({ kind: 'resolve', lights: ['hope'], sub: ['Insight: Passion joins your hand'] }),
    lethalBannerMarkup({ kind: 'deepResolve', lights: ['love', 'joy'], sub: ['Conviction: +1 Nerve', 'Release: Mend 4'] }),
    lethalBannerMarkup({ kind: 'suppress', sub: ['Buried Anger joins your deck (Weight 1)'], resolveWith: 'Kind Word' }),
    lethalBannerMarkup({ kind: 'suppress', sub: ['The Numbness +20 Intensity'] }),
    lethalBannerMarkup({ kind: 'fade' }),
    lethalBannerMarkup({ kind: 'wavering' }),
  ].join('')}</div></div>`;
  const tips = `<div class="g-group"><h3>Tooltip</h3><div class="g-row" style="position:relative;height:90px">${tooltipMarkup({
    title: 'Seething 2',
    lines: ['At the end of your turn you lose 2 Heart.', 'Love cards soothe 1. Play Love Inward to clear it all.'],
    arrow: 'up',
  }).replace('class="tooltip', 'style="position:relative" class="tooltip')}</div></div>`;
  const buttons = `<div class="g-group"><h3>Buttons and panel</h3><div class="g-row">
    <button class="btn btn--primary btn--stack">End Turn (E)<span class="btn__sub">2 Spirit unused</span></button>
    <button class="btn">Undo <span class="kbd">Z</span></button>
    <button class="btn btn--light" data-light="friendship">Take card</button>
    <button class="btn btn--ghost">Skip <span class="kbd">S</span></button>
    <button class="btn btn--pulse">End Turn</button>
    <button class="btn" disabled>Undo</button>
    <div class="panel" style="width:320px"><div class="panel__title">A Quiet Moment</div><p class="muted">The water is perfectly still. Your reflection looks like it has been waiting for you.</p></div>
  </div></div>`;
  return section('hud', 'HUD pieces', 'Chips, bars, Guard, intents, floating numbers, lethal banners, tooltips and buttons.', chips + matchups + bars + guard + intents + floatRow + banners + tips + buttons);
}

// ------------------------------------------------------------------------------------------------
// Slot composition, palettes and greyscale
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
  bad?: { light: Light; line: string };
  banner?: string;
  previewLoss?: number;
  flare?: number;
}): string {
  const matchups = defaultMatchups(o.face, o.bad);
  return `<div class="shade-slot g-slot" data-face="${o.face ?? 'none'}">
    <div class="shade-slot__intent">${o.banner ?? o.pill}</div>
    <div class="shade-slot__art">${shadeMarkup({ family: o.family, seed: o.seed, face: o.face, innerFace: o.inner ?? null, nextFace: o.next ?? null, flare: o.flare ?? 0 })}</div>
    ${nameplateMarkup({ face: o.face, name: o.name, beneath: o.beneath ?? null, nextFace: o.next ?? null, hp: o.hp, maxHp: o.maxHp, guard: o.guard ?? 0, matchups, chips: o.chips, ...(o.previewLoss ? { previewLoss: o.previewLoss } : {}) })}
  </div>`;
}

function stageRow(): string {
  return `<div class="g-stage-row">
    ${slot({ face: 'anger', family: 'anger', seed: 101, name: 'Grumble', hp: 24, maxHp: 42, guard: 5, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 8 }], order: 1 }), chips: [{ kind: 'buff', label: 'Flare', value: 1 }, { kind: 'flag', label: 'Short Fuse' }], bad: { light: 'calm', line: 'Just calm down.' }, flare: 1, previewLoss: 12 })}
    ${slot({ face: 'sadness', family: 'sadness', seed: 102, name: 'Mope', hp: 44, maxHp: 48, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 6 }, { kind: 'afflict', affliction: 'heavy', stacks: 1 }], order: 2 }), chips: [{ kind: 'flag', label: 'Wallow' }], bad: { light: 'love', line: 'At least you have people who love you.' } })}
    ${slot({ face: 'anger', family: 'anger', seed: 103, name: 'Old Grudge', inner: 'sadness', beneath: 'sadness', hp: 18, maxHp: 62, pill: '', banner: lethalBannerMarkup({ kind: 'deepResolve', lights: ['love', 'joy'], sub: ['Conviction: +1 Nerve', 'Release: Mend 4'] }), chips: [{ kind: 'gauge', label: 'Tally', value: 3 }, { kind: 'flag', label: 'Keeps Score' }], bad: { light: 'calm', line: 'Just calm down.' } })}
    ${slot({ face: null, family: 'numb', seed: 104, name: 'The Numbness', hp: 180, maxHp: 180, pill: intentPillMarkup({ items: [{ kind: 'strike', value: 12 }] }), chips: [{ kind: 'flag', label: 'Veiled' }, { kind: 'flag', label: 'Muffled' }] })}
  </div>`;
}

function stageSection(): string {
  return section('stage', 'Shade slots', 'Intent pill, silhouette and nameplate composed at the 205px slot width.', stageRow());
}

function paletteSection(): string {
  const swatches = (pal: 'default' | 'cb') =>
    `<div class="g-palette" data-palette="${pal}"><h3>${pal === 'cb' ? 'Colour-blind (Okabe-Ito)' : 'Default'}</h3><div class="g-swatches">${LIGHTS.map(
      (l) => `<div class="g-swatch" data-light="${l}"><span class="g-swatch__chip"></span>${sigil(l, { size: 24, tint: true })}<b>${LIGHT_NAME[l]}</b></div>`,
    ).join('')}</div><div class="g-cards">${LIGHTS.map((l) => cardFaceMarkup({ name: SAMPLE[l].name, lights: [l], cost: SAMPLE[l].cost, kindLabel: SAMPLE[l].kind, text: SAMPLE[l].text, rarity: 'common', className: 'card-face--mini' })).join('')}</div></div>`;
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
      <div class="g-cards">${LIGHTS.map((l) => cardFaceMarkup({ name: SAMPLE[l].name, lights: [l], cost: SAMPLE[l].cost, kindLabel: SAMPLE[l].kind, text: SAMPLE[l].text, rarity: 'common', className: 'card-face--mini' })).join('')}${BLEND_SAMPLES.slice(0, 3)
        .map((p) => cardFaceMarkup({ ...p, className: 'card-face--mini' }))
        .join('')}</div>
      <div class="g-row">${LIGHTS.map((l) => matchupChipMarkup({ kind: 'opposite', light: l })).join('')}${AFFLICTION_CHIPS.slice(0, 4).map(statusChipMarkup).join('')}</div>
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
    `<div class="g-group"><h3>Light voices (pentatonic in wheel order)</h3><div class="g-row">${lights}</div></div>
     <div class="g-group"><h3>Hit relations (Courage)</h3><div class="g-row">${rel}</div></div>
     <div class="g-group"><h3>Shade strikes</h3><div class="g-row">${shades}</div></div>
     <div class="g-group"><h3>UI</h3><div class="g-row">${uis}</div></div>
     <div class="g-group"><h3>Moments and ambience</h3><div class="g-row">${big}</div></div>`,
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
    <nav class="g-nav">${['sigils', 'cards', 'shades', 'stage', 'compass', 'hud', 'palettes', 'greyscale', 'audio']
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
    btn.classList.toggle('btn--primary');
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
  compassSection() +
  hudSection() +
  paletteSection() +
  greyscaleSection() +
  audioSection();
applyUrlFlags();
mountToolbar();
mountReactions();
mountLiveDemos();
mountAudio();
fitCardNames(root);

