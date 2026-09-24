// Run policy (DESIGN 21.1): Charm pick, pathing, card rewards, the wheel-closes pick, Sanctuary, Haven,
// Memories (a small value table), deck selections and boss Keepsakes. Deterministic given the state.

import {
  hash32,
  type Action,
  type CardInstance,
  type ContentPack,
  type Engine,
  type GameState,
  type KeepsakeId,
  type Phase,
  type Uid,
} from '../../src/engine/index';
import type { Belief } from './belief';
import { cardValue } from './cardValue';
import { deckAverage, easeByLight, offerValue, upcoming, type DraftPolicy, type Upcoming } from './draft';
import { pickPath } from './pathing';

export interface RunPolicyCfg {
  belief: Belief;
  draft: DraftPolicy | null;
  /** buryAll: Tend whenever a Tend is on offer. */
  alwaysTend: boolean;
}

/** Keepsake values in card-value points (boss picks and Sanctuary buys). */
const KEEPSAKE_VALUE: Record<KeepsakeId, number> = {
  'ks.chipped_teacup': 10,
  'ks.spiral_shell': 7,
  'ks.lead_box': 3,
  'ks.mirror_shard': 5,
  'ks.skeleton_key': 3,
  'ks.lightning_rod': 3,
  'ks.tuning_fork': 5,
  'ks.pressed_flower': 4,
  'ks.yellow_umbrella': 3,
  'ks.morning_tea': 5,
  'ks.warm_socks': 4,
  'ks.prism_shard': 6,
  'ks.journal': 3,
  'ks.ember_lantern': 3,
  'ks.welcome_mat': 2,
  'ks.paper_crane': 8,
  'ks.worn_diary': 2,
  'ks.friendship_bracelet': 4,
};

/** Glimmers per card-value point when shopping; nothing is worth saving for in The Deep. */
const glimmersPerPoint = (s: GameState): number => (s.run.act === 3 ? 1000 : s.run.act === 2 ? 14 : 12);

const heartPct = (s: GameState): number => s.run.heart / Math.max(1, s.run.maxHeart);
const heartValue = (s: GameState, n: number): number => n * (heartPct(s) < 0.5 ? 0.6 : 0.35);
const mendValue = (s: GameState, n: number): number => heartValue(s, Math.min(n, s.run.maxHeart - s.run.heart));

function isBuried(pack: ContentPack, c: CardInstance): boolean {
  return pack.cards[c.defId]?.kind === 'buried';
}

function heaviestBuried(s: GameState, pack: ContentPack): CardInstance | null {
  let best: CardInstance | null = null;
  for (const c of s.run.deck) if (isBuried(pack, c) && (!best || (c.weight ?? 1) > (best.weight ?? 1))) best = c;
  return best;
}

function ksValue(id: KeepsakeId, s: GameState, pack: ContentPack, b: Belief): number {
  let v = KEEPSAKE_VALUE[id] ?? 3;
  const buried = s.run.deck.filter((c) => isBuried(pack, c)).length;
  if (id === 'ks.lead_box' && b.knowsResolve) v += buried >= 2 ? 3 : -2;
  if (id === 'ks.skeleton_key' && buried > 0) v += 2;
  if (id === 'ks.spiral_shell' && s.run.act >= 2) v -= 2;
  if (id === 'ks.lightning_rod' && !b.knowsFlare) v += 2;
  return v;
}

/** Value of Set Down for a card: a Buried card, an off-policy card, or deck thinning of the weakest card. */
function removalGain(c: CardInstance, s: GameState, pack: ContentPack, cfg: RunPolicyCfg, avg: number): number {
  const def = pack.cards[c.defId];
  if (!def) return 0;
  if (def.kind === 'buried') return 8 + 4 * (c.weight ?? 1);
  let gain = avg - cardValue(pack, c.defId, c.upgraded) + 1;
  if (cfg.draft?.pruneOffPolicy && !cfg.draft.accepts(def, s)) gain += 4;
  return gain;
}

function bestRemoval(s: GameState, pack: ContentPack, cfg: RunPolicyCfg, options?: readonly Uid[]): { uid: Uid; gain: number } | null {
  const avg = deckAverage(s, pack);
  let best: { uid: Uid; gain: number } | null = null;
  for (const c of s.run.deck) {
    if (options && !options.includes(c.uid)) continue;
    const gain = removalGain(c, s, pack, cfg, avg);
    if (!best || gain > best.gain) best = { uid: c.uid, gain };
  }
  return best;
}

function bestUpgrade(s: GameState, pack: ContentPack, options: readonly Uid[]): Uid | null {
  let best: Uid | null = null;
  let gain = Number.NEGATIVE_INFINITY;
  for (const c of s.run.deck) {
    if (!options.includes(c.uid)) continue;
    const g = cardValue(pack, c.defId, true) - cardValue(pack, c.defId, false);
    if (g > gain) {
      gain = g;
      best = c.uid;
    }
  }
  return best;
}

/** Best of several card ids to add, or -1 when none reaches the deck average (21.1 skip rule). */
function bestOffer(ids: readonly string[], s: GameState, pack: ContentPack, cfg: RunPolicyCfg, up: Upcoming): { i: number; value: number } {
  const avg = deckAverage(s, pack);
  let i = -1;
  let value = Number.NEGATIVE_INFINITY;
  ids.forEach((id, k) => {
    const v = offerValue(id, s, pack, cfg.belief, cfg.draft, up);
    if (v !== null && v > value) {
      value = v;
      i = k;
    }
  });
  return value >= avg ? { i, value } : { i: -1, value };
}

function rewardAction(s: GameState, legal: Action[], pack: ContentPack, cfg: RunPolicyCfg): Action {
  const ph = s.phase as Extract<Phase, { kind: 'reward' }>;
  const o = ph.offer;
  const ks = legal.filter((a) => a.t === 'takeKeepsake');
  if (ks.length > 0) {
    if (!o.keepsakeChoice) return ks[0]!;
    let best: Action | null = null;
    let top = 0;
    for (const a of ks) {
      if (a.t !== 'takeKeepsake') continue;
      const v = ksValue(o.keepsakes[a.i]!, s, pack, cfg.belief);
      if (v > top) {
        top = v;
        best = a;
      }
    }
    if (best) return best;
  }
  if (legal.some((a) => a.t === 'takeCard')) {
    const pick = bestOffer(o.cards, s, pack, cfg, upcoming(s, pack));
    if (pick.i >= 0) return { t: 'takeCard', i: pick.i };
    if (legal.some((a) => a.t === 'skip')) return { t: 'skip' };
  }
  return legal.find((a) => a.t === 'continue') ?? legal[0]!;
}

function wheelAction(s: GameState, pack: ContentPack, cfg: RunPolicyCfg): Action {
  const ph = s.phase as Extract<Phase, { kind: 'wheelCloses' }>;
  const pick = bestOffer(ph.options, s, pack, cfg, upcoming(s, pack));
  return pick.i >= 0 ? { t: 'takeCard', i: pick.i } : { t: 'skip' };
}

function shopAction(s: GameState, legal: Action[], pack: ContentPack, cfg: RunPolicyCfg): Action {
  const ph = s.phase as Extract<Phase, { kind: 'shop' }>;
  const stock = ph.stock;
  const perPoint = glimmersPerPoint(s);
  const avg = deckAverage(s, pack);
  const up = upcoming(s, pack);
  let best: Action = { t: 'leave' };
  let top = 0;
  const consider = (a: Action, utility: number) => {
    if (utility > top) {
      top = utility;
      best = a;
    }
  };
  for (const a of legal) {
    if (a.t === 'buy') {
      const item = stock.items[a.slot]!;
      if (item.kind === 'card') {
        const v = offerValue(item.id, s, pack, cfg.belief, cfg.draft, up);
        if (v !== null) consider(a, v - avg - item.price / perPoint);
      } else consider(a, ksValue(item.id, s, pack, cfg.belief) - item.price / perPoint);
    } else if (a.t === 'service' && a.id === 'remove') {
      const r = bestRemoval(s, pack, cfg);
      if (r) consider(a, r.gain - stock.removePrice / perPoint);
    } else if (a.t === 'service' && a.id === 'talk') {
      const heavy = heaviestBuried(s, pack);
      if (heavy && (cfg.belief.knowsCleanse || cfg.alwaysTend)) {
        const v = 6 + ((heavy.weight ?? 1) === 1 ? 6 : 0) + (cfg.alwaysTend ? 20 : 0);
        consider(a, v - stock.talkPrice / perPoint);
      }
    }
  }
  return best;
}

function havenAction(s: GameState, legal: Action[], pack: ContentPack, cfg: RunPolicyCfg): Action {
  const has = (t: Action['t']) => legal.some((a) => a.t === t);
  const map = s.run.map;
  const node = map.current !== null ? map.nodes[map.current] : undefined;
  const beforeBoss = node ? node.next.some((n) => map.nodes[n]?.kind === 'boss') : false;
  const restBelow = beforeBoss ? 0.6 : 0.5;
  const heavy = heaviestBuried(s, pack);
  const tends = cfg.belief.knowsCleanse || cfg.belief.knowsResolve;
  if (has('reflect') && heavy && cfg.alwaysTend) return { t: 'reflect' };
  if (has('rest') && heartPct(s) < restBelow) return { t: 'rest' };
  if (has('reflect') && heavy && tends && (heavy.weight ?? 1) >= 2) return { t: 'reflect' };
  if (has('kindle')) return { t: 'kindle' };
  if (has('rest')) return { t: 'rest' };
  if (has('reflect')) return { t: 'reflect' };
  return legal[0]!;
}

/** Memory option values (21.1 "small scripted value table per option"), in card-value points. */
function eventOptionValue(id: string, i: number, s: GameState, pack: ContentPack, cfg: RunPolicyCfg): number {
  const b = cfg.belief;
  const buried = heaviestBuried(s, pack);
  const avg = deckAverage(s, pack);
  const removal = bestRemoval(s, pack, cfg)?.gain ?? 0;
  const g = s.run.glimmers;
  const offPolicy = cfg.draft !== null && cfg.draft.name !== 'rainbow';
  const randomCard = offPolicy ? -1 : 5;
  switch (id) {
    case 'mem.unsent_letter':
      if (i === 0) return (buried ? (b.knowsCleanse || cfg.alwaysTend ? 7 : 1) : 5) - heartValue(s, 6);
      if (i === 1) return 8 - (b.knowsResolve ? 8 : 2);
      return 0;
    case 'mem.campfire':
      if (i === 0) return mendValue(s, 16);
      if (i === 1) return cfg.draft && !cfg.draft.accepts({ ...pack.cards['friendship.reach_out']! }, s) ? -1 : 6;
      return 45 / 10 - heartValue(s, 5);
    case 'mem.mirror_pond': {
      if (i === 0) {
        let top = 0;
        for (const c of s.run.deck) {
          const d = pack.cards[c.defId];
          if (d && d.kind !== 'buried' && !d.insightOf && (!cfg.draft || cfg.draft.accepts(d, s))) {
            top = Math.max(top, cardValue(pack, c.defId, c.upgraded));
          }
        }
        return top - avg + 2;
      }
      if (i === 1) return offPolicy ? -1 : 2;
      return 2;
    }
    case 'mem.stuck_balloon':
      if (i === 0) return 5 - heartValue(s, 7);
      if (i === 1) return easeByLight(s, pack).joy >= 3 ? 5 : 1;
      return mendValue(s, 8) + removal;
    case 'mem.tea_slowly':
      if (i === 0) return mendValue(s, 12);
      if (i === 1) return 5 - 25 / 10;
      return removal + (buried ? mendValue(s, 6) : 0);
    case 'mem.wishing_well':
      if (i === 0) return randomCard - 2;
      if (i === 1) return (offPolicy ? 0 : 7) + (g >= 80 ? 8 : 0) - g / 10;
      return heartPct(s) > 0.5 ? 4 : -3;
    default:
      return mendValue(s, 10);
  }
}

function eventAction(s: GameState, legal: Action[], pack: ContentPack, cfg: RunPolicyCfg): Action {
  const ph = s.phase as Extract<Phase, { kind: 'event' }>;
  let best: Action = legal[0]!;
  let top = Number.NEGATIVE_INFINITY;
  for (const a of legal) {
    if (a.t !== 'option') continue;
    const v = eventOptionValue(ph.eventId, a.i, s, pack, cfg);
    if (v > top) {
      top = v;
      best = a;
    }
  }
  return best;
}

function deckSelectAction(s: GameState, legal: Action[], pack: ContentPack, cfg: RunPolicyCfg): Action {
  const ph = s.phase as Extract<Phase, { kind: 'deckSelect' }>;
  const opts = ph.options;
  if (opts.length === 0) return legal.find((a) => a.t === 'skip') ?? legal[0]!;
  const byUid = new Map(s.run.deck.map((c) => [c.uid, c]));
  let uid: Uid | null = null;
  switch (ph.purpose) {
    case 'remove':
      uid = bestRemoval(s, pack, cfg, opts)?.uid ?? null;
      break;
    case 'upgrade':
      uid = bestUpgrade(s, pack, opts);
      break;
    case 'tend': {
      let w = 0;
      for (const u of opts) {
        const cw = byUid.get(u)?.weight ?? 1;
        if (cw > w) {
          w = cw;
          uid = u;
        }
      }
      break;
    }
    case 'transform': {
      let low = Number.POSITIVE_INFINITY;
      for (const u of opts) {
        const c = byUid.get(u)!;
        const v = cardValue(pack, c.defId, c.upgraded);
        if (v < low) {
          low = v;
          uid = u;
        }
      }
      break;
    }
    case 'duplicate': {
      let high = Number.NEGATIVE_INFINITY;
      for (const u of opts) {
        const c = byUid.get(u)!;
        const d = pack.cards[c.defId];
        if (cfg.draft && d && !cfg.draft.accepts(d, s)) continue;
        const v = cardValue(pack, c.defId, c.upgraded);
        if (v > high) {
          high = v;
          uid = u;
        }
      }
      break;
    }
  }
  if (uid === null) uid = opts[0]!;
  return { t: 'choose', uid };
}

/** 21.3 reference: a random Charm per seed, the same for every bot so seeds stay paired. */
export function charmIndex(seed: number, options: number): number {
  return options > 0 ? hash32(seed, 'sim-charm') % options : 0;
}

/** One non-combat decision. */
export function runDecision(engine: Engine, s: GameState, legal: Action[], cfg: RunPolicyCfg): Action {
  const pack = engine.pack;
  switch (s.phase.kind) {
    case 'charmSelect':
      return { t: 'pickCharm', i: charmIndex(s.seed, s.phase.options.length) };
    case 'map': {
      const reachable = legal.filter((a): a is Extract<Action, { t: 'move' }> => a.t === 'move').map((a) => a.node);
      return reachable.length > 0 ? { t: 'move', node: pickPath(s, reachable, pack, cfg.belief) } : legal[0]!;
    }
    case 'reward':
      return rewardAction(s, legal, pack, cfg);
    case 'wheelCloses':
      return wheelAction(s, pack, cfg);
    case 'shop':
      return shopAction(s, legal, pack, cfg);
    case 'haven':
      return havenAction(s, legal, pack, cfg);
    case 'event':
      return legal.some((a) => a.t === 'option') ? eventAction(s, legal, pack, cfg) : legal[0]!;
    case 'deckSelect':
      return deckSelectAction(s, legal, pack, cfg);
    default:
      return legal[0]!;
  }
}

/** The card-reward pick alone (for the divergence probe): index into offer.cards, or -1 for skip. */
export function rewardCardPick(engine: Engine, s: GameState, cfg: RunPolicyCfg): number {
  if (s.phase.kind !== 'reward') return -1;
  return bestOffer(s.phase.offer.cards, s, engine.pack, cfg, upcoming(s, engine.pack)).i;
}
