// miniPack plus the rest of the DESIGN 6 to 9 mechanics, for rule-by-rule scenario tests.
// Everything is plain DSL data: if a mechanic can't be written here, the content agent can't write it either.

import {
  and,
  clearStatus,
  draw,
  ease,
  easeAll,
  energy,
  fetchBuried,
  flare,
  gauge,
  guard,
  has,
  iff,
  ifH,
  lacks,
  lingerHand,
  mark,
  marked,
  mend,
  nextCardFree,
  not,
  per,
  perCompanion,
  perTargetStatus,
  promise,
  scatter,
  selfStatus,
  setStatus,
  shadeGuard,
  shadeMend,
  spark,
  spawn,
  status,
  strike,
  afflict,
  summon,
  tendAny,
  unmark,
} from '../../src/engine/dsl';
import type { CardDef, CompanionDef, ContentPack, EncounterDef, EnemyDef, KeepsakeDef } from '../../src/engine/types';
import { byId, miniPack } from './miniPack';

type CardIn = Omit<CardDef, 'availableFromAct' | 'rarity'> & { availableFromAct?: 1 | 2; rarity?: CardDef['rarity'] };
const card = (d: CardIn): CardDef => ({ availableFromAct: 1, rarity: 'common', ...d });

const buried = (shade: 'sadness' | 'loneliness' | 'despair' | 'anxiety', insight: string): CardDef =>
  card({ id: `buried.${shade}`, name: `Buried ${shade[0]!.toUpperCase()}${shade.slice(1)}`, lights: [], kind: 'buried', rarity: 'special',
    cost: 'unplayable', target: 'none', effects: [], text: 'Weight {w}. Unplayable.', buried: { shade, insight } });

export const extraCards: CardDef[] = [
  // Love
  card({ id: 'love.forgive', name: 'Forgive', lights: ['love'], kind: 'ease', cost: 2, target: 'enemy', rarity: 'uncommon',
    effects: [ease(perTargetStatus(8, 'flare', 4)), clearStatus('flare', 'target')], text: 'Ease {0}, +4 for each Flare on the target. Then remove all its Flare.' }),
  card({ id: 'love.unguarded', name: 'Unguarded', lights: ['love'], kind: 'ease', cost: 1, target: 'enemy',
    effects: [iff({ c: 'noGuard' }, [ease(11)], [ease(5)])], text: 'Ease {1}. If you have no Guard, Ease {0} instead.' }),
  card({ id: 'love.warm_embrace', name: 'Warm Embrace', lights: ['love'], kind: 'skill', cost: 1, target: 'self',
    effects: [guard(5), status('warmth', 2)], text: 'Gain {0} Guard. Gain {1} Warmth.' }),
  // Joy
  card({ id: 'joy.giggle', name: 'Giggle', lights: ['joy'], kind: 'ease', cost: 0, target: 'enemy', effects: [ease(spark(3, 1))], text: 'Ease {0}. Spark +1.' }),
  card({ id: 'joy.grand_finale', name: 'Grand Finale', lights: ['joy'], kind: 'ease', cost: 2, target: 'all', rarity: 'rare', keywords: ['letGo'],
    effects: [easeAll(4, per('playedThisTurn', 1, 0, { min: 1 }))], text: 'Ease {0} to ALL Shades once for each card you played earlier this turn (at least once). Let Go.' }),
  card({ id: 'joy.zoomies', name: 'Zoomies', lights: ['joy'], kind: 'skill', cost: 0, target: 'none', keywords: ['letGo'], rarity: 'uncommon',
    effects: [energy(1), draw(1), ifH([draw(1)])], text: 'Gain {0} Spirit. Draw {1}. Harmony: draw {2} more. Let Go.' }),
  // Friendship
  card({ id: 'friendship.call_a_friend', name: 'Call a Friend', lights: ['friendship'], kind: 'skill', cost: 1, target: 'none',
    effects: [summon('comp.lantern_moth')], text: 'Summon a Lantern Moth.' }),
  card({ id: 'friendship.buddy_up', name: 'Buddy Up', lights: ['friendship'], kind: 'skill', cost: 1, target: 'self',
    effects: [guard(4), summon('comp.burrow_hare')], text: 'Gain {0} Guard. Summon a Burrow Hare.' }),
  card({ id: 'friendship.best_friend', name: 'Best Friend', lights: ['friendship'], kind: 'skill', cost: 2, target: 'none', rarity: 'rare',
    effects: [summon('comp.old_dog')], text: 'Summon an Old Dog.' }),
  // Courage
  card({ id: 'courage.face_the_storm', name: 'Face the Storm', lights: ['courage'], kind: 'ease', cost: 1, target: 'enemy',
    effects: [ifH([ease(10)], [iff({ c: 'targetIntendsAttack' }, [ease(10)], [ease(7)])])],
    text: 'Ease {2}. If the target intends to attack, Ease {1} instead. Harmony: always Ease {0}.' }),
  card({ id: 'courage.find_your_nerve', name: 'Find Your Nerve', lights: ['courage'], kind: 'mood', cost: 1, target: 'none', rarity: 'uncommon',
    effects: [status('nerve', 2)], text: 'Gain {0} Nerve.' }),
  card({ id: 'courage.lionheart', name: 'Lionheart', lights: ['courage'], kind: 'mood', cost: 2, target: 'none', rarity: 'rare', effects: [],
    mood: [{ on: 'turnStart', if: { c: 'anyIntendsAttack' }, effects: [status('nerve', 1)] }],
    text: 'At the start of your turn, if any Shade intends to attack, gain 1 Nerve.' }),
  // Hope
  card({ id: 'hope.growing_light', name: 'Growing Light', lights: ['hope'], kind: 'ease', cost: 1, target: 'enemy', rarity: 'uncommon',
    effects: [ease(per('timesPlayed', 3, 6))], text: 'Ease {0}. Each time you play this, it Eases 3 more for the rest of this combat.', availableFromAct: 2 }),
  card({ id: 'hope.better_days', name: 'Better Days', lights: ['hope'], kind: 'mood', cost: 1, target: 'none', rarity: 'uncommon', effects: [],
    mood: [{ on: 'turnStart', effects: [guard(per('turn', 1, 0, { max: 8 }))] }],
    text: 'At the start of your turn, gain Guard equal to the turn number (max 8).', availableFromAct: 2 }),
  card({ id: 'hope.daybreak', name: 'Daybreak', lights: ['hope'], kind: 'ease', cost: 3, target: 'all', rarity: 'rare', keywords: ['letGo'],
    costMod: { per: 'promisesMade', mult: -1 }, effects: [easeAll(18)], text: 'Ease {0} to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.', availableFromAct: 2 }),
  card({ id: 'hope.silver_lining', name: 'Silver Lining', lights: ['hope'], kind: 'skill', cost: 1, target: 'self',
    effects: [guard(5), promise([guard(5), draw(1)])], text: 'Gain {0} Guard. Promise: gain {1} Guard and draw {2}.', availableFromAct: 2 }),
  // Calm
  card({ id: 'calm.center', name: 'Center', lights: ['calm'], kind: 'skill', cost: 1, target: 'none', rarity: 'uncommon',
    effects: [nextCardFree(), draw(1)], text: 'The next card you play this turn costs 0. Draw {0}.', availableFromAct: 2 }),
  card({ id: 'calm.unhurried', name: 'Unhurried', lights: ['calm'], kind: 'mood', cost: 1, target: 'none', rarity: 'uncommon', effects: [],
    mood: [{ on: 'turnEnd', effects: [guard(per('unspentEnergy', 4))] }], text: 'At the end of your turn, gain 4 Guard for each unspent Spirit.', availableFromAct: 2 }),
  card({ id: 'calm.serenity', name: 'Serenity', lights: ['calm'], kind: 'mood', cost: 2, target: 'none', rarity: 'rare', effects: [],
    mood: [{ on: 'turnEnd', effects: [lingerHand()] }], text: 'At the end of your turn, every non-Buried card in your hand Lingers.', availableFromAct: 2 }),
  card({ id: 'calm.still_water', name: 'Still Water', lights: ['calm'], kind: 'skill', cost: 1, target: 'self', keywords: ['linger'],
    effects: [guard(7)], text: 'Gain {0} Guard. Linger.', availableFromAct: 2 }),
  // Blends
  card({ id: 'blend.shoulder_to_shoulder', name: 'Shoulder to Shoulder', lights: ['friendship', 'courage'], kind: 'ease', cost: 1, target: 'enemy',
    rarity: 'blend', keywords: ['reachesShy'], effects: [ease(perCompanion(6, 2)), guard(perCompanion(6, 2))],
    text: 'Ease {0} and gain {1} Guard, +2 each per Companion. Reaches Shy.' }),
  card({ id: 'blend.tag_youre_it', name: "Tag, You're It!", lights: ['joy', 'friendship'], kind: 'ease', cost: 1, target: 'enemy', rarity: 'blend',
    effects: [ease(spark(5, 1)), summon('comp.lantern_moth')], text: 'Ease {0}. Spark +1. Summon a Lantern Moth.' }),
  card({ id: 'blend.against_the_odds', name: 'Against the Odds', lights: ['courage', 'hope'], kind: 'ease', cost: 2, target: 'enemy', rarity: 'blend',
    effects: [ease(10), promise([ease(10)])], text: 'Ease {0}. Promise: Ease {1} to the same Shade.', availableFromAct: 2 }),
  card({ id: 'blend.wait_it_out', name: 'Wait It Out', lights: ['hope', 'calm'], kind: 'ease', cost: 1, target: 'enemy', rarity: 'blend',
    keywords: ['linger'], effects: [ease(per('lingered', 4, 7))], text: 'Ease {0}. Linger. Eases 4 more for each turn it has Lingered this combat.', availableFromAct: 2 }),
  card({ id: 'blend.gentle_hands', name: 'Gentle Hands', lights: ['calm', 'love'], kind: 'ease', cost: 1, target: 'enemy', rarity: 'blend',
    effects: [ease(6), status('hush', 5, 'target'), mend(3)], text: 'Ease {0}. Hush {1}. Mend {2}.', availableFromAct: 2 }),
  // Neutral
  card({ id: 'neutral.pause', name: 'Pause', lights: [], kind: 'skill', cost: 0, target: 'none', keywords: ['letGo'], effects: [draw(2)], text: 'Draw {0}. Let Go.' }),
  card({ id: 'neutral.push_it_down', name: 'Push It Down', lights: [], kind: 'ease', cost: 1, target: 'enemy',
    effects: [ease(9), iff({ c: 'suppressedTarget' }, [energy(2)])], text: 'Ease {0}. If this Suppresses a Shade, gain {1} Spirit.' }),
  card({ id: 'neutral.look_inward', name: 'Look Inward', lights: [], kind: 'skill', cost: 1, target: 'none', rarity: 'uncommon',
    effects: [fetchBuried(), draw(1)], text: 'Put a Buried card from your draw or discard pile into your hand. Draw {0}.' }),
  card({ id: 'neutral.sit_with_it', name: 'Sit With It', lights: [], kind: 'skill', cost: 1, target: 'none', rarity: 'rare', keywords: ['letGo'],
    effects: [tendAny()], text: 'Tend a Buried card in your hand, whatever its type. Let Go.' }),
  // Buried / Insight
  buried('sadness', 'insight.bittersweet'),
  buried('loneliness', 'insight.solitude'),
  buried('despair', 'insight.resilience'),
  buried('anxiety', 'insight.foresight'),
  card({ id: 'insight.bittersweet', name: 'Bittersweet', lights: ['joy'], kind: 'skill', cost: 1, target: 'self', rarity: 'special', keywords: ['linger'],
    effects: [mend(4), draw(2)], upgrade: { effects: [mend(6), draw(2)] }, text: 'Mend {0}. Draw {1}. Linger.', insightOf: 'sadness' }),
  card({ id: 'insight.solitude', name: 'Solitude', lights: ['friendship'], kind: 'ease', cost: 2, target: 'enemy', rarity: 'special',
    effects: [iff({ c: 'noCompanions' }, [ease(20)], [ease(10)]), summon('comp.lantern_moth')],
    text: 'Ease {1}. If you have no Companions, Ease {0} instead. Then Summon a Lantern Moth.', insightOf: 'loneliness' }),
  card({ id: 'insight.resilience', name: 'Resilience', lights: ['hope'], kind: 'skill', cost: 0, target: 'self', rarity: 'special',
    effects: [guard(6), promise([energy(1), draw(1)])], text: 'Gain {0} Guard. Promise: gain {1} Spirit and draw {2}.', insightOf: 'despair' }),
  card({ id: 'insight.foresight', name: 'Foresight', lights: ['calm'], kind: 'skill', cost: 0, target: 'none', rarity: 'special', keywords: ['linger'],
    effects: [draw(2), status('hush', 3, 'all')], text: 'Draw {0}. Hush {1} on ALL Shades. Linger.', insightOf: 'anxiety' }),
];

const lines = (bark: string): EnemyDef['lines'] => ({ bark: [bark], resolved: 'It settles.', suppressed: 'It goes quiet.' });

export const extraEnemies: EnemyDef[] = [
  {
    id: 'shade.echo', name: 'Echo', faces: ['loneliness'], hp: [32, 36], tier: 'normal',
    moves: {
      call_out: { name: 'Call Out', intent: ['strike'], effects: [strike(6)] },
      cold_shoulder: { name: 'Cold Shoulder', intent: ['strike', 'afflict'], effects: [strike(4), afflict('isolated', 2)] },
      drift: { name: 'Drift', intent: ['guard', 'scatter'], effects: [shadeGuard(8), scatter(1)] },
    },
    pattern: { kind: 'cycle', moves: ['call_out', 'cold_shoulder', 'drift'] },
    passives: [
      { name: 'Last One Left', on: 'combatStart', if: and({ c: 'onlyShade' }, not(marked('alone'))), effects: [flare(2), shadeGuard(10), mark('alone')] },
      { name: 'Last One Left', on: 'shadeLeft', if: and({ c: 'onlyShade' }, not(marked('alone'))), effects: [flare(2), shadeGuard(10), mark('alone')] },
    ],
    lines: lines('Anyone?'), visual: { family: 'loneliness', scale: 1 },
  },
  {
    id: 'shade.looming', name: 'The Looming', faces: ['fear'], hp: [84, 88], tier: 'elite', summoner: true,
    moves: {
      loom: { name: 'Loom', intent: ['guard', 'summon'], effects: [shadeGuard(12), spawn('shade.doubt', 3)] },
      pounce: { name: 'Pounce', intent: ['strike'], effects: [strike(14)] },
      shriek: { name: 'Shriek', intent: ['strike', 'afflict'], effects: [strike(4, 3), afflict('trembling', 2)] },
    },
    pattern: { kind: 'cycle', moves: ['loom', 'pounce', 'shriek'] },
    passives: [
      { name: 'Summoner', on: 'combatStart', effects: [spawn('shade.doubt', 3), spawn('shade.doubt', 3)] },
      { name: 'Grows in the Dark', on: 'playerTurnEnd', if: not({ c: 'playedLightThisTurn', light: 'courage' }), effects: [flare(1)] },
    ],
    lines: lines("I'M ENORMOUS."), visual: { family: 'fear', scale: 1.4 },
  },
  {
    id: 'shade.fret', name: 'Fret', faces: ['anxiety'], hp: [42, 46], tier: 'normal',
    moves: {
      flurry: { name: 'Flurry', intent: ['strike'], effects: [strike(3, per({ status: 'worry', on: 'self' }, 1, 1))] },
      fidget: { name: 'Fidget', intent: ['buff', 'afflict'], effects: [gauge('worry', 2), afflict('restless', 2)] },
      pace: { name: 'Pace', intent: ['guard'], effects: [shadeGuard(8)] },
    },
    pattern: { kind: 'cycle', moves: ['flurry', 'fidget', 'pace'] },
    passives: [
      { name: 'Worry', on: 'afterOwnAction', effects: [gauge('worry', 1)] },
      { name: 'Worry', on: 'cardHitResolved', if: has('calm'), effects: [gauge('worry', -2)] },
    ],
    lines: lines('What if...'), visual: { family: 'anxiety', scale: 1 },
  },
  {
    id: 'shade.slump', name: 'Slump', faces: ['despair'], hp: [50, 54], tier: 'normal',
    moves: {
      sigh_deeply: { name: 'Sigh Deeply', intent: ['strike', 'afflict'], effects: [strike(6), afflict('hollow', 1)] },
      sink: { name: 'Sink', intent: ['guard'], effects: [shadeGuard(12)] },
      collapse: { name: 'Collapse', intent: ['strike'], effects: [strike(15)] },
    },
    pattern: { kind: 'cycle', moves: ['sigh_deeply', 'sink', 'collapse'] },
    passives: [{ name: 'Heavy Silence', on: 'afterOwnAction', if: { c: 'playedLastTurn', op: '<=', n: 2 }, effects: [shadeGuard(8)] }],
    lines: lines('Why bother.'), visual: { family: 'despair', scale: 1 },
  },
  {
    id: 'shade.longing', name: 'Longing', faces: ['sadness', 'loneliness'], hp: [58, 62], tier: 'normal',
    moves: {
      reach_back: { name: 'Reach Back', intent: ['strike'], effects: [strike(9)] },
      remember: { name: 'Remember', intent: ['guard', 'afflict'], effects: [shadeGuard(10), afflict('heavy', 1), afflict('isolated', 1)] },
      ache: { name: 'Ache', intent: ['strike'], effects: [strike(4, 3)] },
    },
    pattern: { kind: 'cycle', moves: ['reach_back', 'remember', 'ache'] },
    passives: [
      { name: 'Wallow', on: 'hitTaken', if: has('joy', 'friendship'), effects: [mark('soothed')] },
      { name: 'Wallow', on: 'afterOwnAction', if: not(marked('soothed')), effects: [shadeMend(5)] },
      { name: 'Wallow', on: 'afterOwnAction', effects: [unmark('soothed')] },
    ],
    lines: lines('Remember when...?'), visual: { family: 'sadness', scale: 1 },
  },
  {
    id: 'shade.wallflower', name: 'Wallflower', faces: ['loneliness', 'fear'], hp: [38, 42], tier: 'normal', shy: true,
    moves: {
      peek: { name: 'Peek', intent: ['afflict'], effects: [afflict('trembling', 2)] },
      wilt: { name: 'Wilt', intent: ['scatter', 'afflict'], effects: [scatter(1), afflict('isolated', 2)] },
      prickle: { name: 'Prickle', intent: ['strike'], effects: [strike(8)] },
    },
    pattern: { kind: 'cycle', moves: ['peek', 'wilt', 'prickle'] },
    passives: [{ name: 'Cornered', on: 'shadeLeft', if: { c: 'onlyShade' }, once: true, effects: [flare(3)] }],
    lines: lines("Don't look at me."), visual: { family: 'loneliness', scale: 0.9 },
  },
  {
    id: 'shade.dread', name: 'Dread', faces: ['fear', 'despair'], hp: [56, 60], tier: 'normal',
    moves: {
      creak: { name: 'Creak', intent: ['strike'], effects: [strike(6), gauge('countdown', -1)] },
      shadow: { name: 'Shadow', intent: ['afflict'], effects: [afflict('trembling', 2), afflict('hollow', 1), gauge('countdown', -1)] },
      the_thing: { name: 'The Thing', intent: ['strike'], effects: [strike(24), setStatus('countdown', 3)] },
    },
    pattern: { kind: 'cycle', moves: ['creak', 'shadow'], overrides: [{ if: selfStatus('countdown', '<=', 0), move: 'the_thing' }] },
    passives: [
      { name: 'Countdown', on: 'combatStart', effects: [setStatus('countdown', 3)] },
      { name: 'Countdown', on: 'hitTaken', if: and({ c: 'hitFromCard' }, has('courage', 'hope'), not(marked('pushed'))), effects: [gauge('countdown', 1), mark('pushed')] },
      { name: 'Countdown', on: 'playerTurnEnd', effects: [unmark('pushed')] },
    ],
    lines: lines("It's coming."), visual: { family: 'fear', scale: 1 },
  },
  {
    id: 'shade.knot', name: 'The Knot', faces: ['anxiety', 'anger'], hp: [108, 112], tier: 'elite',
    moves: {
      twist: { name: 'Twist', intent: ['strike'], effects: [strike(6, 2)] },
      clench: { name: 'Clench', intent: ['guard', 'buff'], effects: [shadeGuard(16), gauge('tension', 2)] },
      lash: { name: 'Lash', intent: ['strike'], effects: [strike(14)] },
      snap: { name: 'Snap', intent: ['strike'], effects: [strike(22), setStatus('tension', 0)] },
    },
    pattern: { kind: 'cycle', moves: ['twist', 'clench', 'lash'], overrides: [{ if: selfStatus('tension', '>=', 6), move: 'snap' }] },
    passives: [
      { name: 'Tension', on: 'cardPlayed', if: lacks('calm', 'love'), effects: [gauge('tension', 1)] },
      { name: 'Tension', on: 'hitTaken', if: and({ c: 'hitFromCard' }, has('calm', 'love')), effects: [gauge('tension', -1)] },
    ],
    lines: lines('Too much.'), visual: { family: 'anxiety', scale: 1.3 },
  },
  {
    id: 'shade.spiral', name: 'The Spiral', faces: ['despair', 'anxiety'], hp: [200, 200], tier: 'boss',
    moves: {
      what_if: { name: 'What If', intent: ['strike', 'afflict'], effects: [strike(3, per({ status: 'coil', on: 'self' })), afflict('restless', 1)] },
      whats_the_point: { name: "What's the Point", intent: ['afflict', 'guard'], effects: [afflict('hollow', 2), shadeGuard(15)] },
      around_again: { name: 'Around Again', intent: ['strike', 'buff'], effects: [strike(12), gauge('coil', 1)] },
    },
    pattern: { kind: 'cycle', moves: ['what_if', 'whats_the_point', 'around_again'] },
    passives: [
      { name: 'Coil', on: 'combatStart', effects: [setStatus('coil', 2)] },
      { name: 'Coil', on: 'afterOwnAction', effects: [gauge('coil', 1)] },
      { name: 'Coil', on: 'cardPlayed', if: has('hope', 'calm'), effects: [iff({ c: 'sourceLights', has: ['hope', 'calm'], mode: 'all' }, [gauge('coil', -2)], [gauge('coil', -1)])] },
      { name: 'Coil', on: 'faceTurned', effects: [gauge('coil', -1)] },
      { name: 'Deepening', on: 'hpThreshold', thresholdPct: 50, effects: [flare(2)] },
    ],
    lines: lines('What if...'), visual: { family: 'despair', scale: 1.4 },
  },
  {
    id: 'shade.apathy', name: 'Apathy', faces: [], hp: [90, 94], tier: 'elite', numbRules: { surface: 1, hpPerHiddenWeight: 0 },
    moves: {
      shrug: { name: 'Shrug', intent: ['strike'], effects: [strike(10)] },
      grey_out: { name: 'Grey Out', intent: ['afflict', 'guard'], effects: [afflict('numb', 2), shadeGuard(10)] },
      sigh: { name: 'Sigh', intent: ['strike'], effects: [strike(6, 2)] },
    },
    pattern: { kind: 'cycle', moves: ['shrug', 'grey_out', 'sigh'] },
    lines: lines('Meh.'), visual: { family: 'numb', scale: 1 },
  },
  {
    id: 'shade.pest', name: 'Pest', faces: ['anger'], hp: [10, 10], tier: 'normal', summoner: true,
    moves: { swarm: { name: 'Swarm', intent: ['summon'], effects: [spawn('shade.doubt', 9)] } },
    pattern: { kind: 'cycle', moves: ['swarm'] },
    lines: lines('More!'), visual: { family: 'anger', scale: 0.6 },
  },
];

export const extraCompanions: CompanionDef[] = [
  { id: 'comp.burrow_hare', name: 'Burrow Hare', lights: ['friendship'], act: [guard(3)], text: 'You gain 3 Guard.' },
  { id: 'comp.old_dog', name: 'Old Dog', lights: ['friendship'], act: [ease(6)], text: 'Ease 6 to your last target.' },
];

const ks = (d: KeepsakeDef): KeepsakeDef => d;
export const extraKeepsakes: KeepsakeDef[] = [
  ks({ id: 'ks.sun_charm', name: 'Sun Charm', rarity: 'charm', text: 'On turn 1 of each combat, draw 2 extra cards.', on: { combatStart: { effects: [status('next_draw', 2)] } } }),
  ks({ id: 'ks.brave_pebble', name: 'Brave Pebble', rarity: 'charm', text: 'At the start of each combat, gain 1 Nerve.', on: { combatStart: { effects: [status('nerve', 1)] } } }),
  ks({ id: 'ks.tuning_fork', name: 'Tuning Fork', rarity: 'common', text: 'The first time a card is Harmonized each turn, draw 1.', on: { harmonized: { effects: [draw(1)], limit: 'turn' } } }),
  ks({ id: 'ks.pressed_flower', name: 'Pressed Flower', rarity: 'common', text: 'Whenever you Resolve a Shade, Mend 3.', on: { resolved: { effects: [mend(3)] } } }),
  ks({ id: 'ks.yellow_umbrella', name: 'Yellow Umbrella', rarity: 'common', text: 'The first time each combat you would gain affliction stacks, gain none.', flags: ['umbrella'] }),
  ks({ id: 'ks.morning_tea', name: 'Morning Tea', rarity: 'common', text: 'On turn 1 of each combat, gain 1 extra Spirit.', on: { turn1Start: { effects: [energy(1)] } } }),
  ks({ id: 'ks.warm_socks', name: 'Warm Socks', rarity: 'common', text: 'On turn 1 of each combat, gain 6 Guard.', on: { turn1Start: { effects: [guard(6)] } } }),
  ks({ id: 'ks.prism_shard', name: 'Prism Shard', rarity: 'uncommon', text: 'Your first Harmonized card each turn costs 1 less.', flags: ['prism'] }),
  ks({ id: 'ks.journal', name: 'Journal', rarity: 'uncommon', text: 'Whenever you Tend a Buried card in combat, draw 1 and gain 3 Guard.', on: { tended: { effects: [draw(1), guard(3)] } } }),
  ks({ id: 'ks.ember_lantern', name: 'Ember Lantern', rarity: 'uncommon', text: 'Whenever a Shade gains Flare, gain 2 Guard.', on: { shadeGainedFlare: { effects: [guard(2)] } } }),
  ks({ id: 'ks.welcome_mat', name: 'Welcome Mat', rarity: 'uncommon', text: 'Whenever you Summon a Companion, gain 3 Guard.', on: { summoned: { effects: [guard(3)] } } }),
  ks({ id: 'ks.paper_crane', name: 'Paper Crane', rarity: 'rare', text: 'Once per run, when your Heart would drop to 0, Mend to 25 instead.', flags: ['paperCrane'] }),
  ks({ id: 'ks.worn_diary', name: 'Worn Diary', rarity: 'rare', text: 'Your heaviest Buried card starts in your hand. Insights you create are upgraded.', flags: ['wornDiary', 'insightUpgraded'] }),
  ks({ id: 'ks.friendship_bracelet', name: 'Friendship Bracelet', rarity: 'rare', text: "Your Companions' hits count as the Lights of the Note.", flags: ['companionsUseNote'] }),
  ks({ id: 'ks.chipped_teacup', name: 'Chipped Teacup', rarity: 'boss', text: '+1 Spirit each turn. At the start of each combat, gain 3 Seething.', energyPerTurn: 1, on: { combatStart: { effects: [status('seething', 3)] } } }),
  ks({ id: 'ks.spiral_shell', name: 'Spiral Shell', rarity: 'boss', text: '+1 Spirit each turn.', energyPerTurn: 1, flags: ['noRest', 'halfActMend'] }),
  ks({ id: 'ks.lead_box', name: 'Lead Box', rarity: 'boss', text: 'Buried cards in your hand never afflict you. You cannot Tend.', flags: ['leadBox'] }),
  ks({ id: 'ks.mirror_shard', name: 'Mirror Shard', rarity: 'boss', text: 'Lights directly across the wheel also Harmonize.', flags: ['mirror'] }),
  ks({ id: 'ks.skeleton_key', name: 'Skeleton Key', rarity: 'boss', text: 'Inward plays can Tend any Buried card.', flags: ['skeletonKey'] }),
  ks({ id: 'ks.lightning_rod', name: 'Lightning Rod', rarity: 'boss', text: 'DISSONANT hits deal x1 instead of x1/2.', flags: ['lightningRod'] }),
  ks({ id: 'ks.bell', name: 'Little Bell', rarity: 'common', text: 'At the end of your turn, Ease 2 to your last target.', on: { turnEnd: { effects: [ease(2)] } } }),
];

export const extraEncounters: EncounterDef[] = [
  { id: 'enc.echo', members: [{ enemy: 'shade.echo' }] },
  { id: 'enc.echo_grumble', members: [{ enemy: 'shade.grumble' }, { enemy: 'shade.echo' }] },
  { id: 'enc.looming', members: [{ enemy: 'shade.looming' }] },
  { id: 'enc.apathy', members: [{ enemy: 'shade.apathy' }] },
  { id: 'enc.spiral', members: [{ enemy: 'shade.spiral' }] },
];

export const testPack: ContentPack = {
  ...miniPack,
  cards: { ...miniPack.cards, ...byId(extraCards) },
  enemies: { ...miniPack.enemies, ...byId(extraEnemies) },
  encounters: { ...miniPack.encounters, ...byId(extraEncounters) },
  companions: { ...miniPack.companions, ...byId(extraCompanions) },
  keepsakes: { ...miniPack.keepsakes, ...byId(extraKeepsakes) },
};

