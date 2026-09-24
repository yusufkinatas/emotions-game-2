// A compact ContentPack for engine tests, sims and contracts (DESIGN 20.1.3). It is not the real content:
// numbers follow DESIGN where convenient, but the point is coverage of every mechanic the engine offers.
//
// Cards: all six Lights, a Blend (Sunbeam), a neutral card (Name It), two Buried/Insight pairs, every
// keyword (linger, letGo, innate, reachesShy), a Mood with oncePerEnemyPhase, costMod, Promise, Spark-free
// multi-hit ALL, Harmony riders and Companions acting now.
// Shades: cycle (Grumble, Mope), passives with marks (Short Fuse, Wallow), a summoner with a Fleeting minion
// (Skitter, Doubt), an override gauge (The Kettle), byFace + turnsAfterAction + hit-turn limit + threshold
// (The Mask), a compound (Old Grudge), numb rules with phases and Surfacing (The Numbness, Surfaced Shades).

import {
  afflict,
  and,
  draw,
  ease,
  easeAll,
  energy,
  flare,
  gauge,
  guard,
  has,
  ifH,
  lacks,
  mark,
  marked,
  mend,
  not,
  per,
  perCompanion,
  perTargetStatus,
  promise,
  removeAfflictions,
  selfStatus,
  setStatus,
  shadeGuard,
  shadeMend,
  spawn,
  status,
  strike,
  summon,
  companionsAct,
  unmark,
} from '../../src/engine/dsl';
import { SHADES } from '../../src/engine/emotions';
import type {
  CardDef,
  CompanionDef,
  ContentPack,
  EncounterDef,
  EnemyDef,
  EventDef,
  KeepsakeDef,
  Shade,
  StatusDef,
} from '../../src/engine/types';

export const byId = <T extends { id: string }>(list: T[]): Record<string, T> =>
  Object.fromEntries(list.map((x) => [x.id, x]));

// ---------------------------------------------------------------------------------------------------
// Statuses (all 21 v1 ids plus 'veiled')
// ---------------------------------------------------------------------------------------------------

const aff = (id: string, name: string, affliction: StatusDef['affliction'], text: string): StatusDef => ({
  id,
  name,
  owner: 'player',
  polarity: 'debuff',
  affliction,
  decay: 'playerTurnEnd',
  text,
});
const gaugeDef = (id: string, name: string, max: number, min?: number): StatusDef => ({
  id,
  name,
  owner: 'enemy',
  polarity: 'gauge',
  decay: 'never',
  max,
  ...(min !== undefined ? { min } : {}),
  text: `${name} {n}.`,
});

export const statuses: StatusDef[] = [
  { id: 'nerve', name: 'Nerve', owner: 'player', polarity: 'buff', decay: 'never', text: 'Your card hits Ease {n} more.' },
  { id: 'warmth', name: 'Warmth', owner: 'player', polarity: 'buff', decay: 'playerTurnEnd', max: 6, text: 'At the end of your turn, Mend {n}.' },
  aff('seething', 'Seething', 'seething', 'At the end of your turn, lose {n} Heart.'),
  aff('heavy', 'Heavy', 'heavy', 'Your card hits Ease x3/4.'),
  aff('isolated', 'Isolated', 'isolated', 'No Harmony, and your Companions rest.'),
  aff('trembling', 'Trembling', 'trembling', 'Guard from cards is x3/4.'),
  aff('hollow', 'Hollow', 'hollow', 'Gain 1 less Spirit at the start of your turn.'),
  aff('restless', 'Restless', 'restless', 'Your first card each turn costs 1 more.'),
  aff('numb', 'Numb', 'numb', 'Your first card each turn has no Light.'),
  { id: 'next_draw', name: 'Belonging', owner: 'player', polarity: 'buff', decay: 'consumedOnUse', text: 'Draw {n} more next turn.' },
  { id: 'next_spirit', name: 'Clarity', owner: 'player', polarity: 'buff', decay: 'consumedOnUse', text: 'Gain {n} more Spirit next turn.' },
  { id: 'flare', name: 'Flare', owner: 'enemy', polarity: 'buff', decay: 'never', text: 'Strikes {n} harder.' },
  { id: 'hush', name: 'Hush', owner: 'enemy', polarity: 'debuff', decay: 'consumedOnUse', text: 'Its next attack is {n} softer per strike.' },
  { id: 'understood', name: 'Understood', owner: 'enemy', polarity: 'flag', decay: 'consumedOnUse', max: 1, text: 'Your next card hit counts as OPPOSITE.' },
  { id: 'wavering', name: 'Wavering', owner: 'enemy', polarity: 'flag', decay: 'never', max: 1, text: 'Finish it yourself.' },
  { id: 'veiled', name: 'Veiled', owner: 'enemy', polarity: 'flag', decay: 'never', max: 1, text: 'Out of reach while a Surfaced Shade stands.' },
  gaugeDef('worry', 'Worry', 6),
  gaugeDef('pressure', 'Pressure', 6),
  gaugeDef('tension', 'Tension', 6),
  gaugeDef('tally', 'Tally', 6),
  gaugeDef('countdown', 'Countdown', 3),
  gaugeDef('coil', 'Coil', 6, 1),
];

// ---------------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------------

type CardIn = Omit<CardDef, 'availableFromAct'> & { availableFromAct?: 1 | 2 };
const card = (d: CardIn): CardDef => ({ availableFromAct: 1, ...d });

export const miniCards: CardDef[] = [
  card({ id: 'love.kind_word', name: 'Kind Word', lights: ['love'], kind: 'ease', rarity: 'starter', cost: 1, target: 'enemy',
    effects: [ease(6)], upgrade: { effects: [ease(9)] }, text: 'Ease {0}.' }),
  card({ id: 'love.unconditional', name: 'Unconditional', lights: ['love'], kind: 'mood', rarity: 'rare', cost: 2, target: 'none',
    effects: [], mood: [{ on: 'heartLostFromMove', oncePerEnemyPhase: true, effects: [status('warmth', 2)] }],
    upgrade: { cost: 1 }, text: "The first time each enemy phase a Shade's move makes you lose Heart, gain 2 Warmth." }),
  card({ id: 'joy.bright_spark', name: 'Bright Spark', lights: ['joy'], kind: 'ease', rarity: 'starter', cost: 1, target: 'enemy',
    effects: [ease(4), draw(1)], upgrade: { effects: [ease(6), draw(1)] }, text: 'Ease {0}. Draw {1}.' }),
  card({ id: 'joy.confetti', name: 'Confetti', lights: ['joy'], kind: 'ease', rarity: 'common', cost: 1, target: 'all',
    effects: [easeAll(3, 2)], upgrade: { effects: [easeAll(4, 2)] }, text: 'Ease {0} to ALL Shades twice.' }),
  card({ id: 'friendship.reach_out', name: 'Reach Out', lights: ['friendship'], kind: 'ease', rarity: 'starter', cost: 1, target: 'enemy',
    effects: [ease(6)], upgrade: { effects: [ease(9)] }, text: 'Ease {0}.' }),
  card({ id: 'friendship.high_five', name: 'High Five', lights: ['friendship'], kind: 'ease', rarity: 'common', cost: 1, target: 'enemy',
    effects: [ease(perCompanion(5, 2)), ifH([companionsAct()])],
    upgrade: { effects: [ease(perCompanion(7, 3)), ifH([companionsAct()])], text: 'Ease {0}, +3 per Companion. Harmony: your Companions act now.' },
    text: 'Ease {0}, +2 per Companion. Harmony: your Companions act now.' }),
  card({ id: 'courage.brave_strike', name: 'Brave Strike', lights: ['courage'], kind: 'ease', rarity: 'starter', cost: 1, target: 'enemy',
    effects: [ease(6)], upgrade: { effects: [ease(9)] }, text: 'Ease {0}.' }),
  card({ id: 'courage.stand_firm', name: 'Stand Firm', lights: ['courage'], kind: 'skill', rarity: 'starter', cost: 1, target: 'self',
    effects: [guard(5)], upgrade: { effects: [guard(8)] }, text: 'Gain {0} Guard.' }),
  card({ id: 'hope.wish_on_a_star', name: 'Wish on a Star', lights: ['hope'], kind: 'ease', rarity: 'common', cost: 1, target: 'enemy',
    effects: [ease(4), ifH([promise([ease(12)])], [promise([ease(8)])])],
    upgrade: { effects: [ease(5), ifH([promise([ease(15)])], [promise([ease(11)])])] },
    text: 'Ease {0}. Promise: Ease {2} to the same Shade. Harmony: the Promise Eases {1} instead.', availableFromAct: 2 }),
  card({ id: 'hope.plant_a_seed', name: 'Plant a Seed', lights: ['hope'], kind: 'skill', rarity: 'common', cost: 0, target: 'none',
    effects: [promise([energy(1), draw(1)])], keywords: ['letGo'], upgrade: { effects: [promise([energy(1), draw(2)])] },
    text: 'Promise: gain {0} Spirit and draw {1}. Let Go.', availableFromAct: 2 }),
  card({ id: 'calm.count_to_ten', name: 'Count to Ten', lights: ['calm'], kind: 'ease', rarity: 'common', cost: 2, target: 'enemy',
    effects: [ease(13)], keywords: ['linger'], costMod: { per: 'lingered', mult: -1 }, upgrade: { effects: [ease(17)] },
    text: 'Ease {0}. Linger. Costs 1 less for each turn it has Lingered this combat.', availableFromAct: 2 }),
  card({ id: 'calm.lullaby', name: 'Lullaby', lights: ['calm'], kind: 'ease', rarity: 'common', cost: 1, target: 'enemy',
    effects: [ease(5), ifH([status('hush', 4, 'all')], [status('hush', 4, 'target')])],
    upgrade: { effects: [ease(7), ifH([status('hush', 5, 'all')], [status('hush', 5, 'target')])] },
    text: 'Ease {0}. Hush {2}. Harmony: Hush ALL Shades instead.', availableFromAct: 2 }),
  card({ id: 'blend.sunbeam', name: 'Sunbeam', lights: ['love', 'joy'], kind: 'ease', rarity: 'blend', cost: 1, target: 'enemy',
    effects: [ease(7), mend(2), draw(1)], upgrade: { effects: [ease(9), mend(3), draw(1)] }, text: 'Ease {0}. Mend {1}. Draw {2}.' }),
  card({ id: 'neutral.name_it', name: 'Name It', lights: [], kind: 'ease', rarity: 'common', cost: 1, target: 'enemy',
    effects: [ease(4), status('understood', 1, 'target')], keywords: ['reachesShy'],
    upgrade: { effects: [ease(7), status('understood', 1, 'target')] }, text: 'Ease {0}. Then the target becomes Understood. Reaches Shy.' }),
  card({ id: 'buried.anger', name: 'Buried Anger', lights: [], kind: 'buried', rarity: 'special', cost: 'unplayable', target: 'none',
    effects: [], text: 'Weight {w}. Unplayable.', buried: { shade: 'anger', insight: 'insight.passion' }, flavor: 'Not gone. Just quiet.' }),
  card({ id: 'insight.passion', name: 'Passion', lights: ['love'], kind: 'ease', rarity: 'special', cost: 1, target: 'enemy',
    effects: [ease(perTargetStatus(9, 'flare', 3)), status('nerve', 1)],
    upgrade: { effects: [ease(perTargetStatus(12, 'flare', 4)), status('nerve', 1)], text: 'Ease {0}, +4 for each Flare on the target. Gain {1} Nerve.' },
    text: 'Ease {0}, +3 for each Flare on the target. Gain {1} Nerve.', insightOf: 'anger' }),
  card({ id: 'buried.fear', name: 'Buried Fear', lights: [], kind: 'buried', rarity: 'special', cost: 'unplayable', target: 'none',
    effects: [], text: 'Weight {w}. Unplayable.', buried: { shade: 'fear', insight: 'insight.instinct' } }),
  card({ id: 'insight.instinct', name: 'Instinct', lights: ['courage'], kind: 'skill', rarity: 'special', cost: 1, target: 'self',
    effects: [guard(per('incoming', 1, 0, { max: 30 }))], keywords: ['innate'], upgrade: { cost: 0 },
    text: "Innate. Gain Guard equal to the total of all Shades' incoming strikes (max 30).", insightOf: 'fear' }),
];

// ---------------------------------------------------------------------------------------------------
// Shades
// ---------------------------------------------------------------------------------------------------

const lines = (bark: string): EnemyDef['lines'] => ({ bark: [bark], resolved: 'It settles, and so do you.', suppressed: 'It goes quiet. Not calm. Just quiet.' });

export const miniEnemies: EnemyDef[] = [
  {
    id: 'shade.grumble', name: 'Grumble', faces: ['anger'], hp: [40, 44], tier: 'normal',
    moves: {
      snap: { name: 'Snap', intent: ['strike'], effects: [strike(7)] },
      stomp: { name: 'Stomp', intent: ['strike', 'afflict'], effects: [strike(5), afflict('seething', 2)] },
      huff: { name: 'Huff', intent: ['guard', 'buff'], effects: [shadeGuard(6), flare(1)] },
    },
    pattern: { kind: 'cycle', moves: ['snap', 'stomp', 'huff'] },
    passives: [
      { name: 'Short Fuse', on: 'hitTaken', if: and({ c: 'hitFromCard' }, lacks('love')), effects: [mark('fuse')],
        text: 'At the end of your turn, if a card without Love hit it this turn, Flare +1.' },
      { name: 'Short Fuse', on: 'playerTurnEnd', if: marked('fuse'), effects: [flare(1), unmark('fuse')] },
    ],
    lines: lines('HMPH.'), visual: { family: 'anger', scale: 1 },
  },
  {
    id: 'shade.mope', name: 'Mope', faces: ['sadness'], hp: [46, 50], tier: 'normal',
    moves: {
      sigh: { name: 'Sigh', intent: ['strike', 'afflict'], effects: [strike(6), afflict('heavy', 1)] },
      drizzle: { name: 'Drizzle', intent: ['strike'], effects: [strike(2, 3)] },
      curl_up: { name: 'Curl Up', intent: ['guard'], effects: [shadeGuard(10)] },
    },
    pattern: { kind: 'cycle', moves: ['sigh', 'drizzle', 'curl_up'] },
    passives: [
      { name: 'Wallow', on: 'hitTaken', if: has('joy'), effects: [mark('soothed')],
        text: 'After its action, restores 5 Intensity unless a hit with Joy landed on it.' },
      { name: 'Wallow', on: 'afterOwnAction', if: not(marked('soothed')), effects: [shadeMend(5)] },
      { name: 'Wallow', on: 'afterOwnAction', effects: [unmark('soothed')] },
    ],
    lines: lines('...It\'s fine.'), visual: { family: 'sadness', scale: 1 },
  },
  {
    id: 'shade.skitter', name: 'Skitter', faces: ['fear'], hp: [26, 30], tier: 'normal', summoner: true,
    moves: {
      hide: { name: 'Hide', intent: ['guard', 'summon'], effects: [shadeGuard(8), spawn('shade.doubt', 2)] },
      lunge: { name: 'Lunge', intent: ['strike'], effects: [strike(10)] },
      shiver: { name: 'Shiver', intent: ['strike', 'afflict'], effects: [strike(4), afflict('trembling', 2)] },
    },
    pattern: { kind: 'cycle', moves: ['hide', 'lunge', 'shiver'] },
    passives: [{ name: 'Summoner', on: 'combatStart', effects: [spawn('shade.doubt', 2)], text: 'Its Doubts fade when it leaves.' }],
    lines: lines('What was that?!'), visual: { family: 'fear', scale: 0.8 },
  },
  {
    id: 'shade.doubt', name: 'Doubt', faces: ['fear'], hp: [7, 7], tier: 'minion', fleeting: true,
    moves: { nag: { name: 'Nag', intent: ['strike'], effects: [strike(3)] } },
    pattern: { kind: 'cycle', moves: ['nag'] },
    lines: lines('...are you sure?'), visual: { family: 'doubt', scale: 0.5 },
  },
  {
    id: 'shade.kettle', name: 'The Kettle', faces: ['anger'], hp: [90, 94], tier: 'elite',
    moves: {
      rattle: { name: 'Rattle', intent: ['strike'], effects: [strike(8)] },
      whistle: { name: 'Whistle', intent: ['strike', 'afflict'], effects: [strike(5, 2), afflict('seething', 2)] },
      simmer: { name: 'Simmer', intent: ['guard', 'buff'], effects: [shadeGuard(12), gauge('pressure', 2)] },
      boil_over: { name: 'Boil Over', intent: ['strike', 'afflict'], effects: [strike(24), afflict('seething', 3), setStatus('pressure', 0)] },
    },
    pattern: { kind: 'cycle', moves: ['rattle', 'whistle', 'simmer'], overrides: [{ if: selfStatus('pressure', '>=', 6), move: 'boil_over' }] },
    passives: [
      { name: 'Pressure', on: 'cardHitResolved', if: lacks('love'), effects: [gauge('pressure', 1)],
        text: 'Cards without Love that hit it add 1 Pressure; Love cards let off 2. At 6 it boils over.' },
      { name: 'Pressure', on: 'cardHitResolved', if: has('love'), effects: [gauge('pressure', -2)] },
    ],
    lines: lines('Hhhhhhhhhhh.'), visual: { family: 'anger', scale: 1.3 },
  },
  {
    id: 'shade.mask', name: 'The Mask', faces: ['anger', 'sadness', 'loneliness', 'fear'], hp: [150, 150], tier: 'boss',
    turnsAfterAction: true, maxTurnsPerPlayerTurn: 2,
    moves: {
      rage: { name: 'Rage', intent: ['strike'], effects: [strike(12)] },
      weep: { name: 'Weep', intent: ['strike', 'afflict'], effects: [strike(5, 2), afflict('heavy', 2)] },
      turn_away: { name: 'Turn Away', intent: ['guard', 'afflict'], effects: [shadeGuard(15), afflict('isolated', 2)] },
      startle: { name: 'Startle', intent: ['strike', 'afflict'], effects: [strike(8), afflict('trembling', 2)] },
    },
    pattern: { kind: 'byFace', moves: { anger: 'rage', sadness: 'weep', loneliness: 'turn_away', fear: 'startle' } },
    passives: [{ name: 'Cracked', on: 'hpThreshold', thresholdPct: 50, effects: [flare(3)], text: 'The first time it is at half Intensity, Flare +3.' }],
    lines: lines('...'), visual: { family: 'mask', scale: 1.4 },
  },
  {
    id: 'shade.old_grudge', name: 'Old Grudge', faces: ['anger', 'sadness'], hp: [60, 64], tier: 'normal',
    moves: {
      mutter: { name: 'Mutter', intent: ['strike', 'afflict'], effects: [strike(6), afflict('seething', 2)] },
      rehash: { name: 'Rehash', intent: ['strike'], effects: [strike(per({ status: 'tally', on: 'self' }, 3, 4)), setStatus('tally', 0)] },
      brood: { name: 'Brood', intent: ['guard', 'afflict'], effects: [shadeGuard(10), afflict('heavy', 1)] },
    },
    pattern: { kind: 'cycle', moves: ['mutter', 'rehash', 'brood'] },
    passives: [
      { name: 'Keeps Score', on: 'hitTaken', if: and({ c: 'hitFromCard' }, not({ c: 'relation', is: ['opposite'] })),
        effects: [gauge('tally', 1)], text: 'Each card hit that is not OPPOSITE adds 1 Tally.' },
    ],
    lines: lines('I haven\'t forgotten.'), visual: { family: 'anger', scale: 1.1 },
  },
  {
    id: 'shade.numbness', name: 'The Numbness', faces: [], hp: [180, 180], tier: 'final',
    numbRules: { surface: 3, hpPerHiddenWeight: 6 },
    moves: {
      static: { name: 'Static', intent: ['strike'], effects: [strike(12)] },
      fog: { name: 'Fog', intent: ['guard', 'afflict'], effects: [shadeGuard(14), afflict('numb', 1)] },
      nothing_much: { name: 'Nothing Much', intent: ['strike', 'afflict'], effects: [strike(8), afflict('heavy', 1), afflict('hollow', 1)] },
      flatline: { name: 'Flatline', intent: ['strike'], effects: [strike(18)] },
      fog2: { name: 'Thick Fog', intent: ['guard', 'afflict'], effects: [shadeGuard(14), afflict('numb', 2)] },
      static_storm: { name: 'Static Storm', intent: ['strike'], effects: [strike(4, 4)] },
    },
    pattern: {
      kind: 'phases',
      phases: [
        { atOrBelowPct: 100, pattern: { kind: 'cycle', moves: ['static', 'fog', 'nothing_much'] } },
        { atOrBelowPct: 50, pattern: { kind: 'cycle', moves: ['flatline', 'fog2', 'static_storm'] } },
      ],
    },
    lines: { bark: [''], resolved: 'Colour comes back all at once.', suppressed: 'The grey settles.' },
    visual: { family: 'numb', scale: 1.5 },
  },
  ...SHADES.map((s: Shade): EnemyDef => ({
    id: `shade.surfaced_${s}`, name: `Surfaced ${s[0]!.toUpperCase()}${s.slice(1)}`, faces: [s], hp: [12, 12], tier: 'surfaced',
    moves: {
      reach: { name: 'Reach', intent: ['strike'], effects: [strike(6)] },
      sink: { name: 'Sink', intent: ['guard'], effects: [shadeGuard(6)] },
    },
    pattern: { kind: 'cycle', moves: ['reach', 'sink'] },
    lines: { bark: ['...'], resolved: 'It was yours all along. You can hold it now.', suppressed: 'It sinks back down.' },
    visual: { family: s, scale: 0.8 },
  })),
];

// ---------------------------------------------------------------------------------------------------
// Companions, Keepsakes, Afterglows, events, encounters
// ---------------------------------------------------------------------------------------------------

export const miniCompanions: CompanionDef[] = [
  { id: 'comp.lantern_moth', name: 'Lantern Moth', lights: ['friendship'], act: [ease(3)], text: 'Ease 3 to your last target.' },
];

export const miniKeepsakes: KeepsakeDef[] = [
  { id: 'ks.compass', name: 'The Compass', rarity: 'fixed', text: 'Cards next to your last Light on the wheel Harmonize.', flags: ['harmony'] },
  { id: 'ks.warm_locket', name: 'Warm Locket', rarity: 'charm', text: 'At the end of each combat you win, Mend 8.',
    on: { combatWon: { effects: [mend(8)] } }, addsCard: 'love.kind_word' },
  { id: 'ks.woven_bracelet', name: 'Woven Bracelet', rarity: 'charm', text: 'At the start of each combat, Summon a Lantern Moth.',
    on: { combatStart: { effects: [summon('comp.lantern_moth')] } }, addsCard: 'friendship.reach_out' },
];

export const afterglows: ContentPack['afterglows'] = {
  anger: { name: 'Conviction', effects: [status('nerve', 1)], text: 'Gain 1 Nerve.' },
  sadness: { name: 'Release', effects: [mend(4)], text: 'Mend 4.' },
  loneliness: { name: 'Belonging', effects: [status('next_draw', 2)], text: 'Draw 2 more cards next turn.' },
  fear: { name: 'Caution', effects: [guard(6)], text: 'Gain 6 Guard.' },
  despair: { name: 'Perspective', effects: [removeAfflictions(), draw(1)], text: 'Remove all your afflictions except Numb. Draw 1.' },
  anxiety: { name: 'Clarity', effects: [status('next_spirit', 1)], text: 'Gain 1 more Spirit next turn.' },
};

export const miniEvents: EventDef[] = [
  { id: 'mem.quiet_moment', title: 'A Quiet Moment', text: 'The water is still for a while.',
    options: [{ label: 'Breathe', result: 'Mend 10.', effects: [{ op: 'heart', n: 10 }] }] },
  { id: 'mem.small_fire', title: 'A Small Fire', text: 'Someone left a fire burning, and a spare cup.',
    options: [
      { label: 'Sit by it', result: 'Mend 8.', effects: [{ op: 'heart', n: 8 }] },
      { label: 'Keep watch', result: 'Lose 5 Heart. Gain 30 Glimmers.', effects: [{ op: 'heart', n: -5 }, { op: 'glimmers', n: 30 }] },
    ] },
];

export const miniEncounters: EncounterDef[] = [
  { id: 'enc.t1', members: [{ enemy: 'shade.grumble', hp: [18, 18] }] },
  { id: 'enc.t2', members: [{ enemy: 'shade.mope', hp: [22, 22] }] },
  { id: 'enc.t3', members: [{ enemy: 'shade.grumble', hp: [20, 20] }, { enemy: 'shade.mope', hp: [14, 14] }] },
  { id: 'enc.t4', members: [{ enemy: 'shade.skitter', hp: [24, 24] }, { enemy: 'shade.grumble', hp: [28, 30] }] },
  { id: 'enc.grumble', members: [{ enemy: 'shade.grumble' }] },
  { id: 'enc.mope', members: [{ enemy: 'shade.mope' }] },
  { id: 'enc.skitter', members: [{ enemy: 'shade.skitter' }] },
  { id: 'enc.grumble_mope', members: [{ enemy: 'shade.grumble' }, { enemy: 'shade.mope', hp: [40, 44] }] },
  { id: 'enc.two_grumbles', members: [{ enemy: 'shade.grumble', hp: [26, 30] }, { enemy: 'shade.grumble', hp: [26, 30] }] },
  { id: 'enc.old_grudge', members: [{ enemy: 'shade.old_grudge' }] },
  { id: 'enc.mope_skitter', members: [{ enemy: 'shade.mope', hp: [40, 44] }, { enemy: 'shade.skitter' }] },
  { id: 'enc.kettle', members: [{ enemy: 'shade.kettle' }] },
  { id: 'enc.mask', members: [{ enemy: 'shade.mask' }] },
  { id: 'enc.numbness', members: [{ enemy: 'shade.numbness' }] },
];

export const miniPack: ContentPack = {
  cards: byId(miniCards),
  enemies: byId(miniEnemies),
  encounters: byId(miniEncounters),
  statuses: byId(statuses),
  companions: byId(miniCompanions),
  keepsakes: byId(miniKeepsakes),
  events: byId(miniEvents),
  afterglows,
  pools: {
    act1: {
      early: ['enc.grumble', 'enc.mope', 'enc.skitter'],
      standard: ['enc.grumble_mope', 'enc.two_grumbles', 'enc.old_grudge'],
      elite: ['enc.kettle', 'enc.mope_skitter'],
      boss: 'enc.mask',
    },
    act2: {
      early: ['enc.grumble', 'enc.mope'],
      row3: ['enc.old_grudge'],
      standard: ['enc.grumble_mope', 'enc.two_grumbles', 'enc.old_grudge', 'enc.mope_skitter'],
      elite: ['enc.kettle', 'enc.mope_skitter'],
      boss: 'enc.mask',
    },
    deep: 'enc.numbness',
    tutorial: ['enc.t1', 'enc.t2', 'enc.t3', 'enc.t4'],
  },
  starter: {
    deck: [
      'love.kind_word', 'love.kind_word', 'joy.bright_spark', 'joy.bright_spark', 'friendship.reach_out', 'friendship.reach_out',
      'courage.brave_strike', 'courage.brave_strike', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm',
    ],
    charms: ['ks.warm_locket', 'ks.woven_bracelet'],
    tutorialCharm: 'ks.warm_locket',
  },
  fallbackEvent: 'mem.quiet_moment',
  rules: {},
};

