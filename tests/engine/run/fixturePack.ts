// A complete but tiny ContentPack for run-side tests: the real ids and shapes, placeholder numbers.
// Deliberately independent of src/content (written concurrently).

import type {
  CardDef,
  CardKind,
  ContentPack,
  EncounterDef,
  EnemyDef,
  EventDef,
  KeepsakeDef,
  Light,
  Rarity,
  Shade,
  StatusDef,
} from '../../../src/engine/types';

const ease = (n: number) => ({ op: 'hit' as const, amount: n });

function card(
  id: string,
  lights: Light[],
  kind: CardKind,
  rarity: Rarity,
  availableFromAct: 1 | 2 = 1,
  extra: Partial<CardDef> = {},
): CardDef {
  return {
    id,
    name: id.split('.')[1]!.replace(/_/g, ' '),
    lights,
    kind,
    rarity,
    cost: 1,
    target: kind === 'ease' ? 'enemy' : 'self',
    effects: [kind === 'ease' ? ease(6) : { op: 'guard', amount: 5 }],
    upgrade: { effects: [kind === 'ease' ? ease(9) : { op: 'guard', amount: 8 }] },
    text: kind === 'ease' ? 'Ease {0}.' : 'Gain {0} Guard.',
    availableFromAct,
    ...extra,
  };
}

const cards: CardDef[] = [
  card('love.kind_word', ['love'], 'ease', 'starter'),
  card('joy.bright_spark', ['joy'], 'ease', 'starter'),
  card('friendship.reach_out', ['friendship'], 'ease', 'starter'),
  card('courage.brave_strike', ['courage'], 'ease', 'starter'),
  card('courage.stand_firm', ['courage'], 'skill', 'starter'),
];

const LIGHT_CARDS: Record<Light, string[]> = {
  love: ['soft_spot', 'warm_embrace', 'unguarded', 'forgive', 'tender_tune', 'unconditional'],
  joy: ['giggle', 'confetti', 'skip_along', 'belly_laugh', 'zoomies', 'grand_finale'],
  friendship: ['call_a_friend', 'buddy_up', 'high_five', 'group_hug', 'pile_on', 'best_friend'],
  courage: ['hold_the_line', 'face_the_storm', 'chin_up', 'find_your_nerve', 'bold_leap', 'lionheart'],
  hope: ['wish_on_a_star', 'silver_lining', 'plant_a_seed', 'growing_light', 'better_days', 'daybreak'],
  calm: ['still_water', 'lullaby', 'count_to_ten', 'center', 'unhurried', 'serenity'],
};
const RARITY_BY_SLOT: Rarity[] = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare'];
for (const [light, names] of Object.entries(LIGHT_CARDS) as [Light, string[]][]) {
  const act = light === 'hope' || light === 'calm' ? 2 : 1;
  names.forEach((n, i) => cards.push(card(`${light}.${n}`, [light], i % 2 === 0 ? 'ease' : 'skill', RARITY_BY_SLOT[i]!, act)));
}

cards.push(
  card('blend.sunbeam', ['love', 'joy'], 'ease', 'blend', 1),
  card('blend.tag_youre_it', ['joy', 'friendship'], 'ease', 'blend', 1),
  card('blend.shoulder_to_shoulder', ['friendship', 'courage'], 'ease', 'blend', 1),
  card('blend.against_the_odds', ['courage', 'hope'], 'ease', 'blend', 2),
  card('blend.wait_it_out', ['hope', 'calm'], 'ease', 'blend', 2),
  card('blend.gentle_hands', ['love', 'calm'], 'ease', 'blend', 2),
  card('neutral.name_it', [], 'ease', 'common'),
  card('neutral.pause', [], 'skill', 'common'),
  card('neutral.push_it_down', [], 'ease', 'common'),
  card('neutral.look_inward', [], 'skill', 'uncommon'),
  card('neutral.sit_with_it', [], 'skill', 'rare'),
);

export const BURIED: Record<Shade, { id: string; insight: string; light: Light }> = {
  anger: { id: 'buried.anger', insight: 'insight.passion', light: 'love' },
  sadness: { id: 'buried.sadness', insight: 'insight.bittersweet', light: 'joy' },
  loneliness: { id: 'buried.loneliness', insight: 'insight.solitude', light: 'friendship' },
  fear: { id: 'buried.fear', insight: 'insight.instinct', light: 'courage' },
  despair: { id: 'buried.despair', insight: 'insight.resilience', light: 'hope' },
  anxiety: { id: 'buried.anxiety', insight: 'insight.foresight', light: 'calm' },
};
for (const [shade, b] of Object.entries(BURIED) as [Shade, (typeof BURIED)[Shade]][]) {
  cards.push({
    id: b.id,
    name: `Buried ${shade}`,
    lights: [],
    kind: 'buried',
    rarity: 'special',
    cost: 'unplayable',
    target: 'none',
    effects: [],
    text: 'Weight {w}. Unplayable.',
    buried: { shade, insight: b.insight },
    availableFromAct: 1,
  });
  cards.push(card(b.insight, [b.light], 'ease', 'special', 1, { insightOf: shade }));
}

function enemy(id: string, faces: Shade[], hp: [number, number], tier: EnemyDef['tier'], extra: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id,
    name: id.split('.')[1]!,
    faces,
    hp,
    tier,
    moves: { hit: { name: 'Hit', intent: ['strike'], effects: [{ op: 'strike', amount: 5 }] } },
    pattern: { kind: 'cycle', moves: ['hit'] },
    lines: { bark: ['...'], resolved: 'It rests.', suppressed: 'It goes quiet.' },
    visual: { family: faces[0] ?? 'numb', scale: 1 },
    ...extra,
  };
}

const enemies: EnemyDef[] = [
  enemy('shade.tut_grumble', ['anger'], [18, 18], 'normal'),
  enemy('shade.tut_mope', ['sadness'], [22, 22], 'normal'),
  enemy('shade.tut_echo', ['loneliness'], [24, 24], 'normal'),
  enemy('shade.tut_skitter', ['fear'], [24, 24], 'normal'),
  enemy('shade.grumble', ['anger'], [40, 44], 'normal'),
  enemy('shade.mope', ['sadness'], [46, 50], 'normal'),
  enemy('shade.skitter', ['fear'], [26, 30], 'normal', { summoner: true }),
  enemy('shade.doubt', ['fear'], [7, 7], 'minion', { fleeting: true }),
  enemy('shade.echo', ['loneliness'], [32, 36], 'normal'),
  enemy('shade.looming', ['fear'], [84, 88], 'elite'),
  enemy('shade.kettle', ['anger'], [90, 94], 'elite'),
  enemy('shade.mask', ['anger', 'sadness', 'loneliness', 'fear'], [150, 150], 'boss'),
  enemy('shade.fret', ['anxiety'], [42, 46], 'normal'),
  enemy('shade.slump', ['despair'], [50, 54], 'normal'),
  enemy('shade.old_grudge', ['anger', 'sadness'], [60, 64], 'normal'),
  enemy('shade.longing', ['sadness', 'loneliness'], [58, 62], 'normal'),
  enemy('shade.wallflower', ['loneliness', 'fear'], [38, 42], 'normal'),
  enemy('shade.dread', ['fear', 'despair'], [56, 60], 'normal'),
  enemy('shade.knot', ['anxiety', 'anger'], [108, 112], 'elite'),
  enemy('shade.apathy', [], [90, 94], 'elite', { numbRules: { surface: 1, hpPerHiddenWeight: 0 } }),
  enemy('shade.spiral', ['despair', 'anxiety'], [200, 200], 'boss'),
  enemy('shade.numbness', [], [180, 180], 'final', { numbRules: { surface: 3, hpPerHiddenWeight: 6 } }),
  ...(['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety'] as const).map((f) =>
    enemy(`shade.surfaced_${f}`, [f], [12, 12], 'surfaced'),
  ),
];

const enc = (id: string, ...members: (string | [string, number, number])[]): EncounterDef => ({
  id,
  members: members.map((m) =>
    typeof m === 'string' ? { enemy: `shade.${m}` } : { enemy: `shade.${m[0]}`, hp: [m[1], m[2]] as [number, number] },
  ),
});

const encounters: EncounterDef[] = [
  enc('enc.t1', 'tut_grumble'),
  enc('enc.t2', 'tut_mope'),
  enc('enc.t3', 'tut_echo', ['tut_mope', 14, 14]),
  enc('enc.t4', 'tut_skitter', ['grumble', 28, 30]),
  enc('enc.a1.grumble', 'grumble'),
  enc('enc.a1.mope', 'mope'),
  enc('enc.a1.skitter', 'skitter'),
  enc('enc.a1.grumble_echo', 'grumble', 'echo'),
  enc('enc.a1.mope_skitter', ['mope', 40, 44], 'skitter'),
  enc('enc.a1.two_grumbles', ['grumble', 26, 30], ['grumble', 26, 30]),
  enc('enc.a1.echo_mope', 'echo', ['mope', 40, 44]),
  enc('enc.a1.two_skitters', ['skitter', 22, 26], ['skitter', 22, 26]),
  enc('enc.a1.echo', 'echo'),
  enc('enc.a1.looming', 'looming'),
  enc('enc.a1.kettle', 'kettle'),
  enc('enc.a1.mask', 'mask'),
  enc('enc.a2.fret', 'fret'),
  enc('enc.a2.slump', 'slump'),
  enc('enc.a2.old_grudge', 'old_grudge'),
  enc('enc.a2.longing', 'longing'),
  enc('enc.a2.dread', 'dread'),
  enc('enc.a2.wallflower_grumble', ['grumble', 34, 38], 'wallflower'),
  enc('enc.a2.wallflower_fret', ['fret', 34, 38], 'wallflower'),
  enc('enc.a2.two_frets', ['fret', 32, 36], ['fret', 32, 36]),
  enc('enc.a2.slump_echo', 'slump', ['echo', 28, 32]),
  enc('enc.a2.knot', 'knot'),
  enc('enc.a2.apathy', 'apathy'),
  enc('enc.a2.spiral', 'spiral'),
  enc('enc.deep.numbness', 'numbness'),
  enc('enc.mem.echo', ['echo', 32, 36]),
];

const ks = (id: string, rarity: KeepsakeDef['rarity'], extra: Partial<KeepsakeDef> = {}): KeepsakeDef => ({
  id,
  name: id.split('.')[1]!,
  rarity,
  text: 'A small comfort.',
  ...extra,
});

const keepsakes: KeepsakeDef[] = [
  ks('ks.compass', 'fixed', { flags: ['harmony'] }),
  ks('ks.warm_locket', 'charm', { addsCard: 'love.kind_word' }),
  ks('ks.sun_charm', 'charm', { addsCard: 'joy.bright_spark' }),
  ks('ks.woven_bracelet', 'charm', { addsCard: 'friendship.reach_out' }),
  ks('ks.brave_pebble', 'charm', { addsCard: 'courage.brave_strike' }),
  ks('ks.tuning_fork', 'common'),
  ks('ks.pressed_flower', 'common'),
  ks('ks.yellow_umbrella', 'common', { flags: ['umbrella'] }),
  ks('ks.morning_tea', 'common'),
  ks('ks.warm_socks', 'common'),
  ks('ks.prism_shard', 'uncommon', { flags: ['prism'] }),
  ks('ks.journal', 'uncommon'),
  ks('ks.ember_lantern', 'uncommon'),
  ks('ks.welcome_mat', 'uncommon'),
  ks('ks.paper_crane', 'rare', { flags: ['paperCrane'] }),
  ks('ks.worn_diary', 'rare', { flags: ['wornDiary', 'insightUpgraded'] }),
  ks('ks.friendship_bracelet', 'rare', { flags: ['companionsUseNote'] }),
  ks('ks.chipped_teacup', 'boss', { energyPerTurn: 1 }),
  ks('ks.spiral_shell', 'boss', { energyPerTurn: 1, flags: ['noRest', 'halfActMend'] }),
  ks('ks.lead_box', 'boss', { flags: ['leadBox'] }),
  ks('ks.mirror_shard', 'boss', { flags: ['mirror'] }),
  ks('ks.skeleton_key', 'boss', { flags: ['skeletonKey'] }),
  ks('ks.lightning_rod', 'boss', { flags: ['lightningRod'] }),
];

const events: EventDef[] = [
  {
    id: 'mem.unsent_letter',
    title: 'The Unsent Letter',
    text: 'Tucked in the reeds is a letter in your handwriting.',
    options: [
      {
        label: 'Read it aloud',
        result: 'Lose 6 Heart. Tend a Buried card of your choice. If you have none: upgrade 2 random cards.',
        effects: [
          { op: 'heart', n: -6 },
          {
            op: 'if',
            cond: { c: 'buriedCount', op: '>=', n: 1 },
            then: [{ op: 'deckSelect', purpose: 'tend' }],
            else: [{ op: 'upgradeRandom', n: 2 }],
          },
        ],
      },
      {
        label: 'Fold it into a paper crane',
        result: 'Gain Paper Crane. Gain Buried Sadness.',
        requires: { c: 'not', of: { c: 'hasKeepsake', id: 'ks.paper_crane' } },
        requiresText: 'You already carry a paper crane.',
        effects: [
          { op: 'keepsake', id: 'ks.paper_crane' },
          { op: 'addBuried', shade: 'sadness' },
        ],
      },
      { label: 'Put it back', result: 'Nothing.', effects: [] },
    ],
  },
  {
    id: 'mem.campfire',
    title: 'The Campfire',
    text: 'Three travellers wave you over.',
    options: [
      { label: 'Sit with them', result: 'Mend 16.', effects: [{ op: 'heart', n: 16 }] },
      {
        label: 'Swap stories',
        result: 'Add a random upgraded Friendship card.',
        effects: [{ op: 'addCard', card: { random: { lights: ['friendship'], available: true }, upgraded: true } }],
      },
      {
        label: 'Take the first watch',
        result: 'Lose 5 Heart. Gain 45 Glimmers.',
        effects: [
          { op: 'heart', n: -5 },
          { op: 'glimmers', n: 45 },
        ],
      },
    ],
  },
  {
    id: 'mem.mirror_pond',
    title: 'The Mirror Pond',
    text: 'The water is perfectly still.',
    options: [
      {
        label: 'Look closer',
        result: 'Duplicate a card of your choice (not Buried, not Insight).',
        effects: [{ op: 'deckSelect', purpose: 'duplicate', filter: { notBuried: true, notInsight: true } }],
      },
      {
        label: 'Make a face',
        result: 'Transform a card of your choice into a random upgraded card of a neighbouring Light.',
        effects: [{ op: 'deckSelect', purpose: 'transform', filter: { notBuried: true } }],
      },
      { label: 'Skip a stone', result: 'Gain 20 Glimmers.', effects: [{ op: 'glimmers', n: 20 }] },
    ],
  },
  {
    id: 'mem.stuck_balloon',
    title: 'The Stuck Balloon',
    text: 'A very small Mope sits under a tree.',
    options: [
      {
        label: 'Climb up',
        result: 'Lose 7 Heart. Gain a random common Keepsake.',
        effects: [
          { op: 'heart', n: -7 },
          { op: 'keepsake', id: { randomRarity: 'common' } },
        ],
      },
      {
        label: 'Tell it a joke',
        result: 'If you have 3+ Joy cards: upgrade 2 random Joy cards. Otherwise: gain 10 Glimmers.',
        effects: [
          {
            op: 'if',
            cond: { c: 'lightCount', light: 'joy', op: '>=', n: 3 },
            then: [{ op: 'upgradeRandom', n: 2, filter: { lights: ['joy'] } }],
            else: [{ op: 'glimmers', n: 10 }],
          },
        ],
      },
      {
        label: 'Sit with it',
        result: 'Mend 8. Remove a card of your choice.',
        effects: [
          { op: 'heart', n: 8 },
          { op: 'deckSelect', purpose: 'remove' },
        ],
      },
    ],
  },
  {
    id: 'mem.tea_slowly',
    title: 'Tea, Slowly',
    text: 'An old tortoise runs a tea stall at the crossroads.',
    options: [
      { label: 'Chamomile', result: 'Mend 12.', effects: [{ op: 'heart', n: 12 }] },
      {
        label: 'Strong brew',
        result: 'Pay 25 Glimmers. Upgrade 2 random cards.',
        requires: { c: 'glimmers', op: '>=', n: 25 },
        requiresText: 'Needs 25 Glimmers.',
        effects: [
          { op: 'glimmers', n: -25 },
          { op: 'upgradeRandom', n: 2 },
        ],
      },
      {
        label: 'Ask for advice',
        result: 'Remove a card of your choice. If it was a Buried card, also Mend 6.',
        effects: [
          { op: 'deckSelect', purpose: 'remove' },
          { op: 'if', cond: { c: 'lastSelectedKind', kind: 'buried' }, then: [{ op: 'heart', n: 6 }] },
        ],
      },
    ],
  },
  {
    id: 'mem.wishing_well',
    title: 'The Wishing Well',
    text: 'A well with a tin cup on a string.',
    options: [
      {
        label: 'Toss in 20 Glimmers',
        result: 'Add a random upgraded card.',
        requires: { c: 'glimmers', op: '>=', n: 20 },
        requiresText: 'Needs 20 Glimmers.',
        effects: [
          { op: 'glimmers', n: -20 },
          {
            op: 'if',
            cond: { c: 'act', op: '>=', n: 2 },
            then: [{ op: 'addCard', card: { random: { lights: ['hope'], available: true }, upgraded: true } }],
            else: [{ op: 'addCard', card: { random: { available: true }, upgraded: true } }],
          },
        ],
      },
      {
        label: 'Toss in everything',
        result: 'Pay all Glimmers. Add a random rare card. If you paid 80+, also gain a random Keepsake.',
        requires: { c: 'glimmers', op: '>=', n: 1 },
        requiresText: 'Needs at least 1 Glimmer.',
        effects: [
          { op: 'payAll' },
          { op: 'addCard', card: { random: { rarity: ['rare'], available: true }, upgraded: false } },
          { op: 'if', cond: { c: 'lastPaid', op: '>=', n: 80 }, then: [{ op: 'keepsake', id: { randomRarity: 'weighted' } }] },
        ],
      },
      {
        label: 'Shout into it',
        result: 'Face an Echo. Resolve it: a random uncommon Keepsake. Suppress it: 30 Glimmers.',
        effects: [
          {
            op: 'combat',
            encounter: 'enc.mem.echo',
            onResolve: [{ op: 'keepsake', id: { randomRarity: 'uncommon' } }],
            onSuppress: [{ op: 'glimmers', n: 30 }],
          },
        ],
      },
    ],
  },
  {
    id: 'mem.quiet_moment',
    title: 'A Quiet Moment',
    text: 'Nothing here but the lap of the water.',
    options: [{ label: 'Breathe', result: 'Mend 10.', effects: [{ op: 'heart', n: 10 }] }],
  },
];

const statuses: StatusDef[] = (['seething', 'heavy', 'isolated', 'trembling', 'hollow', 'restless'] as const).map((id) => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  owner: 'player',
  polarity: 'debuff',
  affliction: id,
  decay: 'playerTurnEnd',
  text: '{n}',
}));

const record = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]));

const afterglow = (name: string) => ({ name, effects: [], text: name });

export function makeFixturePack(): ContentPack {
  return {
    cards: record(cards),
    enemies: record(enemies),
    encounters: record(encounters),
    statuses: record(statuses),
    companions: {
      'comp.lantern_moth': { id: 'comp.lantern_moth', name: 'Lantern Moth', lights: ['friendship'], act: [ease(3)], text: 'Ease 3.' },
    },
    keepsakes: record(keepsakes),
    events: record(events),
    afterglows: {
      anger: afterglow('Conviction'),
      sadness: afterglow('Release'),
      loneliness: afterglow('Belonging'),
      fear: afterglow('Caution'),
      despair: afterglow('Perspective'),
      anxiety: afterglow('Clarity'),
    },
    pools: {
      act1: {
        early: ['enc.a1.grumble', 'enc.a1.mope', 'enc.a1.skitter'],
        standard: [
          'enc.a1.grumble_echo',
          'enc.a1.mope_skitter',
          'enc.a1.two_grumbles',
          'enc.a1.echo_mope',
          'enc.a1.two_skitters',
          'enc.a1.echo',
        ],
        elite: ['enc.a1.looming', 'enc.a1.kettle'],
        boss: 'enc.a1.mask',
      },
      act2: {
        early: ['enc.a2.fret', 'enc.a2.slump'],
        row3: ['enc.a2.old_grudge', 'enc.a2.longing', 'enc.a2.dread'],
        standard: [
          'enc.a2.old_grudge',
          'enc.a2.longing',
          'enc.a2.dread',
          'enc.a2.wallflower_grumble',
          'enc.a2.wallflower_fret',
          'enc.a2.two_frets',
          'enc.a2.slump_echo',
        ],
        elite: ['enc.a2.knot', 'enc.a2.apathy'],
        boss: 'enc.a2.spiral',
      },
      deep: 'enc.deep.numbness',
      tutorial: ['enc.t1', 'enc.t2', 'enc.t3', 'enc.t4'],
    },
    starter: {
      deck: [
        'love.kind_word',
        'love.kind_word',
        'joy.bright_spark',
        'joy.bright_spark',
        'friendship.reach_out',
        'friendship.reach_out',
        'courage.brave_strike',
        'courage.brave_strike',
        'courage.stand_firm',
        'courage.stand_firm',
        'courage.stand_firm',
      ],
      charms: ['ks.warm_locket', 'ks.sun_charm', 'ks.woven_bracelet', 'ks.brave_pebble'],
      tutorialCharm: 'ks.warm_locket',
    },
    fallbackEvent: 'mem.quiet_moment',
    rules: {},
  };
}

export const fixturePack = makeFixturePack();
