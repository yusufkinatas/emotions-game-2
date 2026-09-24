// DESIGN tables transcribed row by row and compared with the content data (sections 4.6, 4.9, 6.12, 7, 8, 9,
// 10, 13, 15.3, 17.3). Moves are rendered in the DESIGN 7.0 notation so a changed number shows up as a diff.

import { describe, expect, it } from 'vitest';
import type { Amount, Effect, EnemyDef, IntentPattern, KeepsakeDef, RunEffect } from '../../src/engine/types';
import * as content from '../../src/content';
import { defaultPack as pack } from '../../src/content';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const statusName = (id: string): string => pack.statuses[id]?.name ?? cap(id);

/** Amount in DESIGN words: 7, "(1 + Worry)", "4 + 3 per Tally", "Coil". */
function amountText(a: Amount, grouped: boolean): string {
  if (typeof a === 'number') return String(a);
  const per = a.per;
  if (per === undefined) return String(a.add ?? 0);
  const what = typeof per === 'object' ? statusName(per.status) : per;
  const mult = a.mult ?? 1;
  const add = a.add ?? 0;
  if (add === 0 && mult === 1) return what;
  if (mult === 1) return grouped ? `(${add} + ${what})` : `${add} + ${what}`;
  return `${add} + ${mult} per ${what}`;
}

/** One Shade-side effect in DESIGN 7.0 notation (marks are bookkeeping and render as nothing). */
function effectText(e: Effect): string | null {
  switch (e.op) {
    case 'strike':
      return e.times === undefined ? `Strike ${amountText(e.amount, false)}` : `Strike ${amountText(e.amount, false)} x ${amountText(e.times, true)}`;
    case 'guard':
      return `Guard ${amountText(e.amount, false)}`;
    case 'afflict':
      return `${e.stacks} ${statusName(e.id)}`;
    case 'status': {
      const n = typeof e.stacks === 'number' ? e.stacks : NaN;
      return `${statusName(e.id)} ${n >= 0 ? '+' : ''}${n}`;
    }
    case 'setStatus':
      return `${statusName(e.id)} = ${e.n}`;
    case 'spawn':
      return `Summon ${pack.enemies[e.enemy]!.name} (max ${e.max})`;
    case 'scatter':
      return `Scatter ${e.n}`;
    case 'mark':
    case 'unmark':
      return null;
    default:
      return `?${e.op}`;
  }
}

const moveText = (effects: readonly Effect[]): string =>
  effects
    .map(effectText)
    .filter((x): x is string => x !== null)
    .join(', ');

function patternOrder(p: IntentPattern): unknown {
  if (p.kind === 'phases') return p.phases.map((ph) => ({ at: ph.atOrBelowPct, moves: patternOrder(ph.pattern) }));
  if (p.kind === 'byFace') return p.moves;
  return p.moves;
}

interface ShadeRow {
  name: string;
  faces: string[];
  hp: [number, number];
  tier: EnemyDef['tier'];
  pattern: unknown;
  moves: Record<string, string>;
}

/** DESIGN 7.1 to 7.3, move text as printed there (gauge resets from the passive text are part of the move). */
const SHADES: Record<string, ShadeRow> = {
  'shade.grumble': {
    name: 'Grumble',
    faces: ['anger'],
    hp: [40, 44],
    tier: 'normal',
    pattern: ['snap', 'stomp', 'huff'],
    moves: { snap: 'Strike 7', stomp: 'Strike 5, 2 Seething', huff: 'Guard 6, Flare +1' },
  },
  'shade.mope': {
    name: 'Mope',
    faces: ['sadness'],
    hp: [46, 50],
    tier: 'normal',
    pattern: ['sigh', 'drizzle', 'curl_up'],
    moves: { sigh: 'Strike 6, 1 Heavy', drizzle: 'Strike 2 x 3', curl_up: 'Guard 10' },
  },
  'shade.skitter': {
    name: 'Skitter',
    faces: ['fear'],
    hp: [26, 30],
    tier: 'normal',
    pattern: ['hide', 'lunge', 'shiver'],
    moves: { hide: 'Guard 8, Summon Doubt (max 2)', lunge: 'Strike 10', shiver: 'Strike 4, 2 Trembling' },
  },
  'shade.doubt': {
    name: 'Doubt',
    faces: ['fear'],
    hp: [7, 7],
    tier: 'minion',
    pattern: ['nag'],
    moves: { nag: 'Strike 3' },
  },
  'shade.echo': {
    name: 'Echo',
    faces: ['loneliness'],
    hp: [32, 36],
    tier: 'normal',
    pattern: ['call_out', 'cold_shoulder', 'drift'],
    moves: { call_out: 'Strike 6', cold_shoulder: 'Strike 4, 2 Isolated', drift: 'Guard 8, Scatter 1' },
  },
  'shade.looming': {
    name: 'The Looming',
    faces: ['fear'],
    hp: [84, 88],
    tier: 'elite',
    pattern: ['loom', 'pounce', 'shriek'],
    moves: { loom: 'Guard 12, Summon Doubt (max 3)', pounce: 'Strike 14', shriek: 'Strike 4 x 3, 2 Trembling' },
  },
  'shade.kettle': {
    name: 'The Kettle',
    faces: ['anger'],
    hp: [90, 94],
    tier: 'elite',
    pattern: ['rattle', 'whistle', 'simmer'],
    moves: {
      rattle: 'Strike 8',
      whistle: 'Strike 5 x 2, 2 Seething',
      simmer: 'Guard 12, Pressure +2',
      boil_over: 'Strike 24, 3 Seething, Pressure = 0',
    },
  },
  'shade.mask': {
    name: 'The Mask',
    faces: ['anger', 'sadness', 'loneliness', 'fear'],
    hp: [150, 150],
    tier: 'boss',
    pattern: { anger: 'rage', sadness: 'weep', loneliness: 'turn_away', fear: 'startle' },
    moves: {
      rage: 'Strike 12',
      weep: 'Strike 5 x 2, 2 Heavy',
      turn_away: 'Guard 15, 2 Isolated',
      startle: 'Strike 8, 2 Trembling',
    },
  },
  'shade.tut_grumble': {
    name: 'Little Grumble',
    faces: ['anger'],
    hp: [18, 18],
    tier: 'normal',
    pattern: ['snap5', 'snap6', 'snap7'],
    moves: { snap5: 'Strike 5', snap6: 'Strike 6', snap7: 'Strike 7' },
  },
  'shade.tut_mope': {
    name: 'Little Mope',
    faces: ['sadness'],
    hp: [22, 22],
    tier: 'normal',
    pattern: ['sigh', 'curl_up', 'drizzle'],
    moves: { sigh: 'Strike 5', curl_up: 'Guard 6', drizzle: 'Strike 2 x 2' },
  },
  'shade.tut_echo': {
    name: 'Little Echo',
    faces: ['loneliness'],
    hp: [24, 24],
    tier: 'normal',
    pattern: ['call_out', 'drift'],
    moves: { call_out: 'Strike 5', drift: 'Guard 6' },
  },
  'shade.tut_skitter': {
    name: 'Little Skitter',
    faces: ['fear'],
    hp: [24, 24],
    tier: 'normal',
    pattern: ['shiver', 'lunge'],
    moves: { shiver: 'Strike 4, 2 Trembling', lunge: 'Strike 7' },
  },
  'shade.fret': {
    name: 'Fret',
    faces: ['anxiety'],
    hp: [42, 46],
    tier: 'normal',
    pattern: ['flurry', 'fidget', 'pace'],
    moves: { flurry: 'Strike 3 x (1 + Worry)', fidget: 'Worry +2, 2 Restless', pace: 'Guard 8' },
  },
  'shade.slump': {
    name: 'Slump',
    faces: ['despair'],
    hp: [50, 54],
    tier: 'normal',
    pattern: ['sigh_deeply', 'sink', 'collapse'],
    moves: { sigh_deeply: 'Strike 6, 1 Hollow', sink: 'Guard 12', collapse: 'Strike 15' },
  },
  'shade.old_grudge': {
    name: 'Old Grudge',
    faces: ['anger', 'sadness'],
    hp: [60, 64],
    tier: 'normal',
    pattern: ['mutter', 'rehash', 'brood'],
    moves: { mutter: 'Strike 6, 2 Seething', rehash: 'Strike 4 + 3 per Tally, Tally = 0', brood: 'Guard 10, 1 Heavy' },
  },
  'shade.longing': {
    name: 'Longing',
    faces: ['sadness', 'loneliness'],
    hp: [58, 62],
    tier: 'normal',
    pattern: ['reach_back', 'remember', 'ache'],
    moves: { reach_back: 'Strike 9', remember: 'Guard 10, 1 Heavy, 1 Isolated', ache: 'Strike 4 x 3' },
  },
  'shade.wallflower': {
    name: 'Wallflower',
    faces: ['loneliness', 'fear'],
    hp: [38, 42],
    tier: 'normal',
    pattern: ['peek', 'wilt', 'prickle'],
    moves: { peek: '2 Trembling', wilt: 'Scatter 1, 2 Isolated', prickle: 'Strike 8' },
  },
  'shade.dread': {
    name: 'Dread',
    faces: ['fear', 'despair'],
    hp: [56, 60],
    tier: 'normal',
    pattern: ['creak', 'shadow'],
    moves: { creak: 'Strike 6', shadow: '2 Trembling, 1 Hollow', the_thing: 'Strike 24' },
  },
  'shade.knot': {
    name: 'The Knot',
    faces: ['anxiety', 'anger'],
    hp: [108, 112],
    tier: 'elite',
    pattern: ['twist', 'clench', 'lash'],
    moves: { twist: 'Strike 6 x 2', clench: 'Guard 16, Tension +2', lash: 'Strike 14', snap: 'Strike 22, Tension = 0' },
  },
  'shade.apathy': {
    name: 'Apathy',
    faces: [],
    hp: [90, 94],
    tier: 'elite',
    pattern: ['shrug', 'grey_out', 'sigh'],
    moves: { shrug: 'Strike 10', grey_out: '2 Numb, Guard 10', sigh: 'Strike 6 x 2' },
  },
  'shade.spiral': {
    name: 'The Spiral',
    faces: ['despair', 'anxiety'],
    hp: [200, 200],
    tier: 'boss',
    pattern: ['what_if', 'whats_the_point', 'around_again'],
    moves: { what_if: 'Strike 3 x Coil, 1 Restless', whats_the_point: '2 Hollow, Guard 15', around_again: 'Strike 12, Coil +1' },
  },
  'shade.numbness': {
    name: 'The Numbness',
    faces: [],
    hp: [180, 180],
    tier: 'final',
    // Thaw "at 90 or less" of 180 (the contract's phases thresholds are percents of max Intensity).
    pattern: [
      { at: 100, moves: ['static', 'fog', 'nothing_much'] },
      { at: 50, moves: ['flatline', 'fog2', 'static_storm'] },
    ],
    moves: {
      static: 'Strike 12',
      fog: 'Guard 14, 1 Numb',
      nothing_much: 'Strike 8, 1 Heavy, 1 Hollow',
      flatline: 'Strike 18',
      fog2: 'Guard 14, 2 Numb',
      static_storm: 'Strike 4 x 4',
    },
  },
  'shade.surfaced_anger': {
    name: 'Surfaced Anger',
    faces: ['anger'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['flare_up', 'smolder'],
    moves: { flare_up: 'Strike 8', smolder: 'Strike 5, 2 Seething' },
  },
  'shade.surfaced_sadness': {
    name: 'Surfaced Sadness',
    faces: ['sadness'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['sigh', 'curl_up'],
    moves: { sigh: 'Strike 6, 1 Heavy', curl_up: 'Guard 8' },
  },
  'shade.surfaced_loneliness': {
    name: 'Surfaced Loneliness',
    faces: ['loneliness'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['call_out', 'cold_shoulder'],
    moves: { call_out: 'Strike 6', cold_shoulder: 'Strike 4, 2 Isolated' },
  },
  'shade.surfaced_fear': {
    name: 'Surfaced Fear',
    faces: ['fear'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['lunge', 'shiver'],
    moves: { lunge: 'Strike 9', shiver: 'Strike 4, 2 Trembling' },
  },
  'shade.surfaced_despair': {
    name: 'Surfaced Despair',
    faces: ['despair'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['sigh_deeply', 'sink'],
    moves: { sigh_deeply: 'Strike 7, 1 Hollow', sink: 'Guard 10' },
  },
  'shade.surfaced_anxiety': {
    name: 'Surfaced Anxiety',
    faces: ['anxiety'],
    hp: [12, 36],
    tier: 'surfaced',
    pattern: ['flurry', 'fidget'],
    moves: { flurry: 'Strike 3 x 3', fidget: '2 Restless, Guard 6' },
  },
};

describe('Shades match DESIGN 7.1 to 7.3 row by row', () => {
  it('covers every Shade', () => {
    expect(Object.keys(pack.enemies).sort()).toEqual(Object.keys(SHADES).sort());
  });

  for (const [id, row] of Object.entries(SHADES)) {
    it(id, () => {
      const e = pack.enemies[id]!;
      expect(e.name).toBe(row.name);
      expect([...e.faces]).toEqual(row.faces);
      expect(e.hp).toEqual(row.hp);
      expect(e.tier).toBe(row.tier);
      expect(patternOrder(e.pattern)).toEqual(row.pattern);
      const moves = Object.fromEntries(Object.entries(e.moves).map(([m, def]) => [m, moveText(def.effects)]));
      expect(moves).toEqual(row.moves);
    });
  }

  it('flags: Fleeting Doubt, Summoners, Shy Wallflower, The Mask turning', () => {
    const flagged = (f: 'fleeting' | 'summoner' | 'shy') =>
      Object.values(pack.enemies)
        .filter((e) => e[f])
        .map((e) => e.id)
        .sort();
    expect(flagged('fleeting')).toEqual(['shade.doubt']);
    expect(flagged('summoner')).toEqual(['shade.looming', 'shade.skitter']);
    expect(flagged('shy')).toEqual(['shade.wallflower']);
  });

  it('overrides fire at Pressure 6, Tension 6 and Countdown 0', () => {
    const ov = (id: string) => {
      const p = pack.enemies[id]!.pattern;
      return p.kind === 'cycle' ? p.overrides : undefined;
    };
    expect(ov('shade.kettle')).toEqual([{ if: { c: 'status', id: 'pressure', on: 'self', op: '>=', n: 6 }, move: 'boil_over' }]);
    expect(ov('shade.knot')).toEqual([{ if: { c: 'status', id: 'tension', on: 'self', op: '>=', n: 6 }, move: 'snap' }]);
    expect(ov('shade.dread')).toEqual([{ if: { c: 'status', id: 'countdown', on: 'self', op: '<=', n: 0 }, move: 'the_thing' }]);
  });
});

describe('passive encodings implement the DESIGN 7 rule text', () => {
  const passives = (id: string) => pack.enemies[id]!.passives ?? [];
  const on = (id: string, trigger: string) => passives(id).filter((p) => p.on === trigger);

  it('Wallow marks on a hit, then (after its action) restores unless marked, then unmarks, in that order', () => {
    for (const [id, lights] of [
      ['shade.mope', ['joy']],
      ['shade.longing', ['joy', 'friendship']],
    ] as const) {
      const ps = passives(id).filter((p) => p.name === 'Wallow');
      expect(ps.map((p) => p.on)).toEqual(['hitTaken', 'afterOwnAction', 'afterOwnAction']);
      expect(ps[0]!.if).toEqual({ c: 'sourceLights', has: [...lights], mode: 'any' });
      expect(ps[0]!.effects).toEqual([{ op: 'mark', key: 'soothed' }]);
      expect(ps[1]!.if).toEqual({ c: 'not', of: { c: 'marked', key: 'soothed' } });
      expect(ps[1]!.effects).toEqual([{ op: 'mend', amount: 5, to: 'self' }]);
      expect(ps[2]!.if).toBeUndefined();
      expect(ps[2]!.effects).toEqual([{ op: 'unmark', key: 'soothed' }]);
    }
  });

  it('Short Fuse: a card hit without Love marks it; at the end of your turn it Flares once and unmarks', () => {
    const [hit, end] = passives('shade.grumble');
    expect(hit).toMatchObject({ on: 'hitTaken', if: { c: 'and', of: [{ c: 'hitFromCard' }, { c: 'sourceLights', has: ['love'], mode: 'none' }] } });
    expect(end).toMatchObject({ on: 'playerTurnEnd', if: { c: 'marked', key: 'provoked' } });
    expect(end!.effects).toEqual([
      { op: 'status', id: 'flare', stacks: 1, to: 'self' },
      { op: 'unmark', key: 'provoked' },
    ]);
  });

  it('Grows in the Dark: no card with Courage this turn -> Flare +1 at the end of your turn', () => {
    const [p] = on('shade.looming', 'playerTurnEnd');
    expect(p).toMatchObject({ if: { c: 'not', of: { c: 'playedLightThisTurn', light: 'courage' } } });
    expect(p!.effects).toEqual([{ op: 'status', id: 'flare', stacks: 1, to: 'self' }]);
  });

  it('Summoners bring their Doubts at combat start (Skitter 1, The Looming 2)', () => {
    const count = (id: string) => on(id, 'combatStart').flatMap((p) => p.effects).filter((e) => e.op === 'spawn').length;
    expect(count('shade.skitter')).toBe(1);
    expect(count('shade.looming')).toBe(2);
  });

  it('first time alone (Echo, Wallflower): checked at combat start and when a Shade leaves, once in total', () => {
    for (const [id, flare, guard] of [
      ['shade.echo', 2, 10],
      ['shade.wallflower', 3, 0],
    ] as const) {
      const ps = passives(id);
      expect(ps.map((p) => p.on)).toEqual(['combatStart', 'shadeLeft']);
      for (const p of ps) {
        expect(p.if).toMatchObject({ c: 'and', of: [{ c: 'onlyShade' }, { c: 'not', of: { c: 'marked' } }] });
        expect(p.effects.find((e) => e.op === 'status')).toEqual({ op: 'status', id: 'flare', stacks: flare, to: 'self' });
        const g = p.effects.find((e) => e.op === 'guard');
        expect(g ? (g as { amount: number }).amount : 0).toBe(guard);
        expect(p.effects.at(-1)!.op).toBe('mark');
      }
    }
  });

  it('Kettle Pressure: after each card that hit it, +1 without Love or -2 with Love', () => {
    const [p] = on('shade.kettle', 'cardHitResolved');
    expect(p!.effects).toEqual([
      {
        op: 'if',
        cond: { c: 'sourceLights', has: ['love'], mode: 'any' },
        then: [{ op: 'status', id: 'pressure', stacks: -2, to: 'self' }],
        else: [{ op: 'status', id: 'pressure', stacks: 1, to: 'self' }],
      },
    ]);
  });

  it('Fret Worry: +1 after its action; a card with Calm that hit it removes 2', () => {
    expect(on('shade.fret', 'afterOwnAction')[0]!.effects).toEqual([{ op: 'status', id: 'worry', stacks: 1, to: 'self' }]);
    const [calm] = on('shade.fret', 'cardHitResolved');
    expect(calm).toMatchObject({ if: { c: 'sourceLights', has: ['calm'], mode: 'any' } });
    expect(calm!.effects).toEqual([{ op: 'status', id: 'worry', stacks: -2, to: 'self' }]);
  });

  it('Slump Heavy Silence: after its action, Guard 8 if you played 2 or fewer cards last turn', () => {
    const [p] = on('shade.slump', 'afterOwnAction');
    expect(p!.if).toEqual({ c: 'playedLastTurn', op: '<=', n: 2 });
    expect(p!.effects).toEqual([{ op: 'guard', amount: 8 }]);
  });

  it("Old Grudge Keeps Score: each card hit that isn't OPPOSITE adds 1 Tally", () => {
    const [p] = on('shade.old_grudge', 'hitTaken');
    expect(p!.if).toEqual({ c: 'and', of: [{ c: 'hitFromCard' }, { c: 'not', of: { c: 'relation', is: ['opposite'] } }] });
    expect(p!.effects).toEqual([{ op: 'status', id: 'tally', stacks: 1, to: 'self' }]);
  });

  it('Dread Countdown: starts 3, -1 after each action, 3 after The Thing, one Courage/Hope card push per turn', () => {
    const ps = passives('shade.dread');
    expect(ps.map((p) => p.on)).toEqual(['combatStart', 'afterOwnAction', 'hitTaken', 'playerTurnEnd']);
    expect(ps[0]!.effects).toEqual([{ op: 'setStatus', id: 'countdown', n: 3, to: 'self' }]);
    expect(pack.enemies['shade.dread']!.moves.the_thing!.effects.at(-1)).toEqual({ op: 'mark', key: 'thing' });
    expect(ps[1]!.effects).toEqual([
      {
        op: 'if',
        cond: { c: 'marked', key: 'thing' },
        then: [
          { op: 'setStatus', id: 'countdown', n: 3, to: 'self' },
          { op: 'unmark', key: 'thing' },
        ],
        else: [{ op: 'status', id: 'countdown', stacks: -1, to: 'self' }],
      },
    ]);
    expect(ps[2]!.if).toEqual({
      c: 'and',
      of: [{ c: 'hitFromCard' }, { c: 'sourceLights', has: ['courage', 'hope'], mode: 'any' }, { c: 'not', of: { c: 'marked', key: 'pushed' } }],
    });
    expect(ps[2]!.effects).toEqual([
      { op: 'status', id: 'countdown', stacks: 1, to: 'self' },
      { op: 'mark', key: 'pushed' },
    ]);
    expect(ps[3]!.effects).toEqual([{ op: 'unmark', key: 'pushed' }]);
  });

  it('Knot Tension: +1 per card played without Calm or Love, -1 per card hit with Calm or Love', () => {
    const [played] = on('shade.knot', 'cardPlayed');
    expect(played!.if).toEqual({ c: 'sourceLights', has: ['calm', 'love'], mode: 'none' });
    expect(played!.effects).toEqual([{ op: 'status', id: 'tension', stacks: 1, to: 'self' }]);
    const [hit] = on('shade.knot', 'hitTaken');
    expect(hit!.if).toEqual({ c: 'and', of: [{ c: 'hitFromCard' }, { c: 'sourceLights', has: ['calm', 'love'], mode: 'any' }] });
    expect(hit!.effects).toEqual([{ op: 'status', id: 'tension', stacks: -1, to: 'self' }]);
  });

  it('Spiral Coil: starts 2, +1 after its action, -1 per Hope or Calm card (-2 with both), -1 per face turn', () => {
    const ps = passives('shade.spiral').filter((p) => p.name === 'Coil');
    expect(ps.map((p) => p.on)).toEqual(['combatStart', 'afterOwnAction', 'cardPlayed', 'faceTurned']);
    expect(ps[0]!.effects).toEqual([{ op: 'setStatus', id: 'coil', n: 2, to: 'self' }]);
    expect(ps[1]!.effects).toEqual([{ op: 'status', id: 'coil', stacks: 1, to: 'self' }]);
    expect(ps[2]!.if).toEqual({ c: 'sourceLights', has: ['hope', 'calm'], mode: 'any' });
    expect(ps[3]!.effects).toEqual([{ op: 'status', id: 'coil', stacks: -1, to: 'self' }]);
  });

  it('thresholds: Cracked Flare +3, Deepening Flare +2', () => {
    const t = (id: string, name: string) => passives(id).find((p) => p.name === name)!;
    expect(t('shade.mask', 'Cracked')).toMatchObject({ on: 'hpThreshold', thresholdPct: 50, once: true });
    expect(t('shade.mask', 'Cracked').effects).toEqual([{ op: 'status', id: 'flare', stacks: 3, to: 'self' }]);
    expect(t('shade.spiral', 'Deepening')).toMatchObject({ on: 'hpThreshold', thresholdPct: 50, once: true });
    expect(t('shade.spiral', 'Deepening').effects).toEqual([{ op: 'status', id: 'flare', stacks: 2, to: 'self' }]);
  });

  it('tutorial variants and Surfaced Shades have no working passives', () => {
    for (const e of Object.values(pack.enemies)) {
      if (e.id.startsWith('shade.tut_') || e.tier === 'surfaced') expect(e.passives ?? [], e.id).toEqual([]);
    }
  });
});

describe('barks and farewells match DESIGN 7.4', () => {
  const LINES: Record<string, [string[], string, string]> = {
    'shade.grumble': [
      ['HMPH.', 'Nobody LISTENS.'],
      "Cools into a small ember and curls up by your boots. It's very warm, actually.",
      'It goes quiet. Not calm. Just quiet.',
    ],
    'shade.mope': [
      ["...It's fine.", "Don't mind me."],
      'The drizzle stops. Mope blinks, and a very small rainbow peeks out from behind it.',
      'It sinks out of sight, still damp.',
    ],
    'shade.skitter': [
      ['What was that?!'],
      'It uncurls. It was a moth all along. It would like to sit on your lantern.',
      'It scurries under a stone. You can still hear it, a little.',
    ],
    'shade.echo': [
      ['Anyone? ...anyone?'],
      "It calls out, and this time something answers. It's you.",
      'The echo fades. The quiet it leaves is louder.',
    ],
    'shade.looming': [
      ["I'M ENORMOUS."],
      "Up close, it's only a coat on a hook. It seems embarrassed about the whole thing.",
      'It shrinks back into the corner. The corner stays dark.',
    ],
    'shade.kettle': [
      ['Hhhhhhhhhhh.'],
      'It clicks off. Somewhere, two cups of tea are poured. One is for you.',
      "The lid is jammed on tight. Now and then you'll hear it rattle.",
    ],
    'shade.mask': [
      [],
      'The mask falls away. Underneath is a face of pearl light, and it looks like yours.',
      'The mask settles on one expression and stays that way.',
    ],
    'shade.fret': [
      ['Did I leave the... what if...'],
      'It stops pacing, sits down and says "oh" very softly, like someone who just remembered to breathe.',
      "It hurries off. It'll be back to check on things.",
    ],
    'shade.slump': [['Why bother.'], 'It sits up. Then stands. Then, astonishingly, stretches.', 'It sinks a little deeper. So do you.'],
    'shade.old_grudge': [
      ["I haven't forgotten.", "That's another one."],
      "It puts down the chalk. It can't remember what the tally was for.",
      "It pockets the chalk. It's still counting.",
    ],
    'shade.longing': [
      ['Remember when...?'],
      'It gives everything back, one thing at a time. It was keeping them safe.',
      "It lets go all at once and doesn't look back.",
    ],
    'shade.wallflower': [
      ["Don't look at me."],
      "It steps off the wall. It's a sunflower, and it turns toward you.",
      "It presses flatter against the wall until you can't see it.",
    ],
    'shade.dread': [
      ["It's coming.", 'Three.'],
      "The countdown reaches zero. The Thing arrives. It's morning.",
      "The countdown freezes at one. It'll wait.",
    ],
    'shade.knot': [
      ['Too much. Too much. Too much.'],
      'It loosens, and loosens, and turns out to be a very long, very warm scarf.',
      'It pulls itself tighter and rolls away.',
    ],
    'shade.apathy': [
      ['Meh.'],
      'It blinks, slowly, like it just noticed the colour of the sky.',
      "It shrugs and drifts off. It didn't care anyway. Probably.",
    ],
    'shade.spiral': [
      ["What if... what's the point... what if..."],
      'It slows to a curl, then a line, then a path. It leads forward.',
      "It winds itself small and burrows down. Some nights you'll feel it turning.",
    ],
  };

  for (const [id, [bark, resolved, suppressed]] of Object.entries(LINES)) {
    it(id, () => expect(pack.enemies[id]!.lines).toEqual({ bark, resolved, suppressed }));
  }

  it('Surfaced Shades share the 7.4 Surfaced farewells; The Numbness uses the 15.3 endings', () => {
    for (const e of Object.values(pack.enemies).filter((x) => x.tier === 'surfaced')) {
      expect(e.lines.resolved).toBe('It was yours all along. You can hold it now.');
      expect(e.lines.suppressed).toBe('It sinks back down. The grey grows thicker.');
    }
    expect(pack.enemies['shade.numbness']!.lines).toEqual({
      bark: [],
      resolved:
        "Colour comes back all at once. It's loud. It's a lot. You laugh, and you're also crying a little, and that seems exactly right.",
      suppressed:
        "The grey settles. It's quiet. You made it through, and that counts. Some colours are still missing. Maybe next time.",
    });
  });
});

describe('encounters and pools match DESIGN 8', () => {
  /** members as "enemy" or "enemy lo-hi" (HP override). */
  const ENCOUNTERS: Record<string, string[]> = {
    'enc.t1': ['tut_grumble'],
    'enc.t2': ['tut_mope'],
    'enc.t3': ['tut_echo', 'tut_mope 14-14'],
    'enc.t4': ['tut_skitter', 'grumble 28-30'],
    'enc.a1.grumble': ['grumble'],
    'enc.a1.mope': ['mope'],
    'enc.a1.skitter': ['skitter'],
    'enc.a1.grumble_echo': ['grumble', 'echo'],
    'enc.a1.mope_skitter': ['mope 40-44', 'skitter'],
    'enc.a1.two_grumbles': ['grumble 26-30', 'grumble 26-30'],
    'enc.a1.echo_mope': ['echo', 'mope 40-44'],
    'enc.a1.two_skitters': ['skitter 22-26', 'skitter 22-26'],
    'enc.a1.echo': ['echo'],
    'enc.a1.looming': ['looming'],
    'enc.a1.kettle': ['kettle'],
    'enc.a1.mask': ['mask'],
    'enc.a2.fret': ['fret'],
    'enc.a2.slump': ['slump'],
    'enc.a2.old_grudge': ['old_grudge'],
    'enc.a2.longing': ['longing'],
    'enc.a2.dread': ['dread'],
    'enc.a2.wallflower_grumble': ['grumble 34-38', 'wallflower'],
    'enc.a2.wallflower_fret': ['fret 34-38', 'wallflower'],
    'enc.a2.two_frets': ['fret 32-36', 'fret 32-36'],
    'enc.a2.slump_echo': ['slump', 'echo 28-32'],
    'enc.a2.knot': ['knot'],
    'enc.a2.apathy': ['apathy'],
    'enc.a2.spiral': ['spiral'],
    'enc.deep.numbness': ['numbness'],
    'enc.mem.echo': ['echo 32-36'],
  };

  it('every encounter row', () => {
    const actual = Object.fromEntries(
      Object.values(pack.encounters).map((enc) => [
        enc.id,
        enc.members.map((m) => `${m.enemy.replace('shade.', '')}${m.hp ? ` ${m.hp[0]}-${m.hp[1]}` : ''}`),
      ]),
    );
    expect(actual).toEqual(ENCOUNTERS);
  });

  it('pools by row', () => {
    expect(pack.pools.tutorial).toEqual(['enc.t1', 'enc.t2', 'enc.t3', 'enc.t4']);
    expect(pack.pools.deep).toBe('enc.deep.numbness');
    const a1 = pack.pools.act1;
    expect(a1.early).toEqual(['enc.a1.grumble', 'enc.a1.mope', 'enc.a1.skitter']);
    expect(a1.row3 ?? a1.early).toEqual(a1.early);
    expect([...a1.standard].sort()).toEqual(
      ['enc.a1.grumble_echo', 'enc.a1.mope_skitter', 'enc.a1.two_grumbles', 'enc.a1.echo_mope', 'enc.a1.two_skitters', 'enc.a1.echo'].sort(),
    );
    expect(a1.elite).toEqual(['enc.a1.looming', 'enc.a1.kettle']);
    expect(a1.boss).toBe('enc.a1.mask');
    const a2 = pack.pools.act2;
    expect(a2.early).toEqual(['enc.a2.fret', 'enc.a2.slump']);
    expect(a2.row3).toEqual(['enc.a2.old_grudge', 'enc.a2.longing', 'enc.a2.dread']);
    expect([...a2.standard].sort()).toEqual(
      [
        'enc.a2.old_grudge',
        'enc.a2.longing',
        'enc.a2.dread',
        'enc.a2.wallflower_grumble',
        'enc.a2.wallflower_fret',
        'enc.a2.two_frets',
        'enc.a2.slump_echo',
      ].sort(),
    );
    expect(a2.elite).toEqual(['enc.a2.knot', 'enc.a2.apathy']);
    expect(a2.boss).toBe('enc.a2.spiral');
  });
});

describe('Keepsakes match DESIGN 9', () => {
  const ks = (id: string): KeepsakeDef => pack.keepsakes[id]!;

  it('rarities, flags and Spirit per turn', () => {
    const ROWS: Record<string, [KeepsakeDef['rarity'], string[], number]> = {
      'ks.compass': ['fixed', ['harmony'], 0],
      'ks.warm_locket': ['charm', [], 0],
      'ks.sun_charm': ['charm', [], 0],
      'ks.woven_bracelet': ['charm', [], 0],
      'ks.brave_pebble': ['charm', [], 0],
      'ks.tuning_fork': ['common', [], 0],
      'ks.pressed_flower': ['common', [], 0],
      'ks.yellow_umbrella': ['common', ['umbrella'], 0],
      'ks.morning_tea': ['common', [], 0],
      'ks.warm_socks': ['common', [], 0],
      'ks.prism_shard': ['uncommon', ['prism'], 0],
      'ks.journal': ['uncommon', [], 0],
      'ks.ember_lantern': ['uncommon', [], 0],
      'ks.welcome_mat': ['uncommon', [], 0],
      'ks.paper_crane': ['rare', ['paperCrane'], 0],
      'ks.worn_diary': ['rare', ['wornDiary', 'insightUpgraded'], 0],
      'ks.friendship_bracelet': ['rare', ['companionsUseNote'], 0],
      'ks.chipped_teacup': ['boss', [], 1],
      'ks.spiral_shell': ['boss', ['noRest', 'halfActMend'], 1],
      'ks.lead_box': ['boss', ['leadBox'], 0],
      'ks.mirror_shard': ['boss', ['mirror'], 0],
      'ks.skeleton_key': ['boss', ['skeletonKey'], 0],
      'ks.lightning_rod': ['boss', ['lightningRod'], 0],
    };
    expect(Object.keys(pack.keepsakes).sort()).toEqual(Object.keys(ROWS).sort());
    for (const [id, [rarity, flags, spirit]] of Object.entries(ROWS)) {
      expect(ks(id).rarity, id).toBe(rarity);
      expect(ks(id).flags ?? [], id).toEqual(flags);
      expect(ks(id).energyPerTurn ?? 0, id).toBe(spirit);
    }
  });

  it('trigger hooks do what the effect column says', () => {
    const hooks = (id: string) =>
      Object.fromEntries(Object.entries(ks(id).on ?? {}).map(([t, h]) => [t, { effects: h!.effects, limit: h!.limit }]));
    expect(hooks('ks.warm_locket')).toEqual({ combatWon: { effects: [{ op: 'mend', amount: 8, to: 'player' }], limit: undefined } });
    // Sun Charm and Morning Tea feed the turn-1 draw and Spirit of 5.2 through next_draw / next_spirit.
    expect(hooks('ks.sun_charm')).toEqual({ combatStart: { effects: [{ op: 'status', id: 'next_draw', stacks: 2, to: 'player' }], limit: undefined } });
    expect(hooks('ks.morning_tea')).toEqual({ combatStart: { effects: [{ op: 'status', id: 'next_spirit', stacks: 1, to: 'player' }], limit: undefined } });
    // L7: turn 1 start (after the Guard reset), so Welcome Mat's Guard from this summon is kept.
    expect(hooks('ks.woven_bracelet')).toEqual({ turn1Start: { effects: [{ op: 'summon', companion: 'comp.lantern_moth' }], limit: undefined } });
    expect(hooks('ks.brave_pebble')).toEqual({ combatStart: { effects: [{ op: 'status', id: 'nerve', stacks: 1, to: 'player' }], limit: undefined } });
    expect(hooks('ks.tuning_fork')).toEqual({ harmonized: { effects: [{ op: 'draw', n: 1 }], limit: 'turn' } });
    expect(hooks('ks.pressed_flower')).toEqual({ resolved: { effects: [{ op: 'mend', amount: 3, to: 'player' }], limit: undefined } });
    expect(hooks('ks.warm_socks')).toEqual({ turn1Start: { effects: [{ op: 'guard', amount: 6 }], limit: undefined } });
    expect(hooks('ks.journal')).toEqual({ tended: { effects: [{ op: 'draw', n: 1 }, { op: 'guard', amount: 3 }], limit: undefined } });
    expect(hooks('ks.ember_lantern')).toEqual({ shadeGainedFlare: { effects: [{ op: 'guard', amount: 2 }], limit: undefined } });
    expect(hooks('ks.welcome_mat')).toEqual({ summoned: { effects: [{ op: 'guard', amount: 3 }], limit: undefined } });
    // afflict (not status) so Yellow Umbrella can block it.
    expect(hooks('ks.chipped_teacup')).toEqual({ combatStart: { effects: [{ op: 'afflict', id: 'seething', stacks: 3 }], limit: undefined } });
    for (const id of ['ks.compass', 'ks.yellow_umbrella', 'ks.prism_shard', 'ks.paper_crane', 'ks.worn_diary', 'ks.friendship_bracelet', 'ks.spiral_shell', 'ks.lead_box', 'ks.mirror_shard', 'ks.skeleton_key', 'ks.lightning_rod']) {
      expect(ks(id).on, id).toBeUndefined();
    }
  });

  it('player text names every number of the effect column', () => {
    const NUMBERS: Record<string, string[]> = {
      'ks.warm_locket': ['8'],
      'ks.sun_charm': ['1', '2'],
      'ks.pressed_flower': ['3'],
      'ks.morning_tea': ['1'],
      'ks.warm_socks': ['1', '6'],
      'ks.journal': ['1', '3'],
      'ks.ember_lantern': ['2'],
      'ks.welcome_mat': ['3'],
      'ks.paper_crane': ['0', '25'],
      'ks.chipped_teacup': ['1', '3'],
      'ks.spiral_shell': ['1', '50'],
      'ks.lead_box': ['50'],
      'ks.lightning_rod': ['1', '1/2', '1'],
    };
    for (const [id, nums] of Object.entries(NUMBERS)) {
      for (const n of nums) expect(ks(id).text, id).toContain(n);
    }
  });
});

describe('Memories match DESIGN 10', () => {
  const ev = (id: string) => pack.events[id]!;
  const opt = (id: string, i: number) => ev(id).options[i]!;
  const effects = (id: string, i: number): RunEffect[] => opt(id, i).effects;

  it('titles, labels and bracketed results', () => {
    const ROWS: Record<string, [string, [string, string][]]> = {
      'mem.unsent_letter': [
        'The Unsent Letter',
        [
          ['Read it aloud', 'Lose 6 Heart. Tend a Buried card of your choice. If you have none: upgrade 2 random cards.'],
          [
            'Fold it into a paper crane',
            'Gain Paper Crane. Gain Buried Sadness (or +1 Weight; at Weight 3, lose 3 max Heart instead).',
          ],
          ['Put it back', 'Nothing.'],
        ],
      ],
      'mem.campfire': [
        'The Campfire',
        [
          ['Sit with them', 'Mend 16.'],
          ['Swap stories', 'Add a random upgraded Friendship card.'],
          ['Take the first watch', 'Lose 5 Heart. Gain 45 Glimmers.'],
        ],
      ],
      'mem.mirror_pond': [
        'The Mirror Pond',
        [
          ['Look closer', 'Duplicate a card of your choice (not Buried, not Insight).'],
          [
            'Make a face',
            "Transform a card of your choice into a random upgraded card of a Light adjacent to its own (available Lights only). Neutral, Buried and Blend cards can't be chosen.",
          ],
          ['Skip a stone', 'Gain 20 Glimmers.'],
        ],
      ],
      'mem.stuck_balloon': [
        'The Stuck Balloon',
        [
          ['Climb up', 'Lose 7 Heart. Gain a random common Keepsake.'],
          ['Tell it a joke', 'If you have 3+ Joy cards: upgrade 2 random Joy cards. Otherwise: gain 10 Glimmers.'],
          ['Sit with it', 'Mend 8. Remove a card of your choice.'],
        ],
      ],
      'mem.tea_slowly': [
        'Tea, Slowly',
        [
          ['Chamomile', 'Mend 12.'],
          ['Strong brew', 'Pay 25 Glimmers. Upgrade 2 random cards.'],
          ['Ask for advice', 'Remove a card of your choice. If it was a Buried card, also Mend 6.'],
        ],
      ],
      'mem.wishing_well': [
        'The Wishing Well',
        [
          ['Toss in 20 Glimmers', 'Add a random upgraded card: Hope in Act 2, any available Light in Act 1.'],
          [
            'Toss in everything',
            'Pay all Glimmers (min 1). Add a random rare card. If you paid 80+, also gain a random Keepsake.',
          ],
          ['Shout into it', 'Fight an Echo. Resolve it: gain a random uncommon Keepsake. Suppress it: gain 30 Glimmers.'],
        ],
      ],
    };
    for (const [id, [title, options]] of Object.entries(ROWS)) {
      expect(ev(id).title, id).toBe(title);
      expect(ev(id).options.map((o) => [o.label, o.result]), id).toEqual(options);
    }
  });

  it('italic after-lines', () => {
    expect(opt('mem.unsent_letter', 1).after).toBe('Some things fly better folded.');
    expect(opt('mem.unsent_letter', 2).after).toBe("Not today. That's allowed.");
    expect(opt('mem.campfire', 2).after).toBe('They insist on paying you, mostly in toast.');
    expect(opt('mem.mirror_pond', 2).after).toBe("It skips four times. You'll take that as a sign.");
    expect(opt('mem.stuck_balloon', 2).after).toBe('Nothing happens for a while. Then it leans on you.');
    expect(opt('mem.tea_slowly', 2).after).toBe('"Put that down, dear. You\'ve been carrying it all day."');
  });

  it('mechanical results', () => {
    expect(effects('mem.unsent_letter', 0)[0]).toEqual({ op: 'heart', n: -6 });
    expect(effects('mem.unsent_letter', 1)).toEqual([
      { op: 'keepsake', id: 'ks.paper_crane' },
      { op: 'addBuried', shade: 'sadness' },
    ]);
    expect(opt('mem.unsent_letter', 1).requires).toEqual({ c: 'not', of: { c: 'hasKeepsake', id: 'ks.paper_crane' } });
    expect(effects('mem.unsent_letter', 2)).toEqual([]);
    expect(effects('mem.campfire', 0)).toEqual([{ op: 'heart', n: 16 }]);
    expect(effects('mem.campfire', 2)).toEqual([
      { op: 'heart', n: -5 },
      { op: 'glimmers', n: 45 },
    ]);
    expect(effects('mem.mirror_pond', 0)).toEqual([
      { op: 'deckSelect', purpose: 'duplicate', filter: { notBuried: true, notInsight: true } },
    ]);
    expect(effects('mem.mirror_pond', 1)[0]).toMatchObject({ op: 'deckSelect', purpose: 'transform' });
    expect(effects('mem.mirror_pond', 2)).toEqual([{ op: 'glimmers', n: 20 }]);
    expect(effects('mem.stuck_balloon', 0)).toEqual([
      { op: 'heart', n: -7 },
      { op: 'keepsake', id: { randomRarity: 'common' } },
    ]);
    expect(effects('mem.stuck_balloon', 2)).toEqual([
      { op: 'heart', n: 8 },
      { op: 'deckSelect', purpose: 'remove' },
    ]);
    expect(effects('mem.tea_slowly', 0)).toEqual([{ op: 'heart', n: 12 }]);
    expect(opt('mem.tea_slowly', 1).requires).toEqual({ c: 'glimmers', op: '>=', n: 25 });
    expect(effects('mem.tea_slowly', 1)[0]).toEqual({ op: 'glimmers', n: -25 });
    expect(opt('mem.wishing_well', 0).requires).toEqual({ c: 'glimmers', op: '>=', n: 20 });
    expect(effects('mem.wishing_well', 0)[0]).toEqual({ op: 'glimmers', n: -20 });
    expect(opt('mem.wishing_well', 1).requires).toEqual({ c: 'glimmers', op: '>=', n: 1 });
    expect(effects('mem.wishing_well', 1)[0]).toEqual({ op: 'payAll' });
    expect(effects('mem.wishing_well', 1)[2]).toMatchObject({ op: 'if', cond: { c: 'lastPaid', op: '>=', n: 80 } });
    expect(effects('mem.wishing_well', 2)).toEqual([
      {
        op: 'combat',
        encounter: 'enc.mem.echo',
        onResolve: [{ op: 'keepsake', id: { randomRarity: 'uncommon' } }],
        onSuppress: [{ op: 'glimmers', n: 30 }],
      },
    ]);
    expect(ev(pack.fallbackEvent).title).toBe('A Quiet Moment');
  });
});

describe('small tables: afflictions (4.6), Afterglows (4.9), Companions (6.12), Mo (13), coach marks (17.3)', () => {
  it('afflictions: one per Shade plus Numb, all decaying at the end of your turn', () => {
    const rows = ['seething', 'heavy', 'isolated', 'trembling', 'hollow', 'restless', 'numb'].map((id) => [
      pack.statuses[id]!.name,
      pack.statuses[id]!.affliction,
    ]);
    expect(rows).toEqual([
      ['Seething', 'seething'],
      ['Heavy', 'heavy'],
      ['Isolated', 'isolated'],
      ['Trembling', 'trembling'],
      ['Hollow', 'hollow'],
      ['Restless', 'restless'],
      ['Numb', 'numb'],
    ]);
  });

  it('Afterglow effects', () => {
    const a = pack.afterglows;
    expect(a.anger.effects).toEqual([{ op: 'status', id: 'nerve', stacks: 1, to: 'player' }]);
    expect(a.sadness.effects).toEqual([{ op: 'mend', amount: 4, to: 'player' }]);
    expect(a.loneliness.effects).toEqual([{ op: 'status', id: 'next_draw', stacks: 2, to: 'player' }]);
    expect(a.fear.effects).toEqual([{ op: 'guard', amount: 6 }]);
    expect(a.despair.effects).toEqual([{ op: 'removeAfflictions' }, { op: 'draw', n: 1 }]);
    expect(a.anxiety.effects).toEqual([{ op: 'status', id: 'next_spirit', stacks: 1, to: 'player' }]);
  });

  it('Companions', () => {
    const c = pack.companions;
    expect(c['comp.lantern_moth']).toMatchObject({ name: 'Lantern Moth', lights: ['friendship'], act: [{ op: 'hit', amount: 3 }] });
    expect(c['comp.burrow_hare']).toMatchObject({ name: 'Burrow Hare', lights: ['friendship'], act: [{ op: 'guard', amount: 3 }] });
    expect(c['comp.old_dog']).toMatchObject({ name: 'Old Dog', lights: ['friendship'], act: [{ op: 'hit', amount: 6 }] });
  });

  it("Mo's lines and the endings", () => {
    expect(content.MO_LINES).toEqual([
      'Found it on a Tuesday.',
      "No refunds. Herons don't do refunds.",
      "Shiny. Very shiny. You'll want that.",
    ]);
    expect(content.DEFEAT_TEXT).toBe("Your Heart needs rest. The Lights will keep until you're back.");
  });

  it('coach marks C1 to C14 carry the 17.3 copy', () => {
    const copy = Object.fromEntries(content.COACH_MARKS.map((m) => [m.id, m.copy]));
    expect(copy).toMatchObject({
      C1: 'Shades show their next move. This one will strike for 5.',
      C2: "Kind Word is Love. Love is Anger's opposite, so it Eases double.",
      C3: 'Out of Spirit. End your turn and you get 3 back.',
      C4: 'Finish a Shade with its opposite to Resolve it. It heals instead of vanishing.',
      C5: "'{line}' {Light} alone deepens {Shade}: half, and it Flares.",
      C6: 'The Compass remembers your last Light. Its neighbours Harmonize and count as both.',
      C7: '{Card} sits next to {Light}. Play it now and it counts as both.',
      C8: "Not its opposite, so this Suppresses it. You'll carry it as a Buried card.",
      C9: '{Affliction} {short effect}. {Light} soothes it. Play {Light} on yourself to clear it.',
      C10: 'Drop a card on yourself: clear your feeling and Tend what you buried.',
      C11: 'Buried {Shade} hurts while held. Play {Light} Inward to Tend it.',
      C12: 'Companions never finish a Shade the wrong way. Finish it yourself.',
      C13: 'Sigils show which Shades wait on each path. Pick fights your deck answers.',
      C14: 'Two feelings. OPPOSITE hits turn it. A Blend answers both at once.',
    });
  });
});
