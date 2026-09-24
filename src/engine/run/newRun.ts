// New run (DESIGN 3.2, 6.1, 9.2, 17.1): starter deck, Charm select or a given Charm, Act 1 map, tutorial start.

import { rngFrom } from '../rng';
import type { EngineCtx, GameState, KeepsakeId, NewRunOpts } from '../types';
import { grantKeepsake } from './keepsakes';
import { generateActMap } from './map';
import { enterNode } from './progression';
import { emptyStats, type StepScratch } from './state';

const CHARM_CHOICES = 4;

export function charmOptions(ctx: EngineCtx, seed: number): KeepsakeId[] {
  const charms = ctx.pack.starter.charms;
  if (charms.length <= CHARM_CHOICES) return [...charms];
  return rngFrom(seed, 'charm').shuffle(charms).slice(0, CHARM_CHOICES);
}

export function newRunState(ctx: EngineCtx, seed: number, opts: NewRunOpts, contentHash: string, sc: StepScratch): GameState {
  const tutorial = opts.tutorial ?? false;
  const deck = ctx.pack.starter.deck.map((defId, i) => {
    if (!ctx.pack.cards[defId]) throw new Error(`Unknown starter card ${defId}`);
    return { uid: i + 1, defId, upgraded: false };
  });
  const d: GameState = {
    v: 1,
    contentHash,
    seed,
    nextUid: deck.length + 1,
    phase: { kind: 'charmSelect', options: charmOptions(ctx, seed) },
    run: {
      heart: ctx.rules.startHeart,
      maxHeart: ctx.rules.startHeart,
      glimmers: ctx.rules.startGlimmers,
      deck,
      keepsakes: [],
      act: 1,
      floor: 0,
      tutorial,
      map: generateActMap(ctx, seed, 1, tutorial),
      combatsWon: 0,
      usedEvents: [],
      shopRemovals: 0,
      paperCraneUsed: false,
      insightsMade: [],
      lastPaid: 0,
      lastSelected: null,
      stats: emptyStats(),
    },
    combat: null,
    eventCombat: null,
  };
  const charm = opts.charm ?? (tutorial ? ctx.pack.starter.tutorialCharm : undefined);
  if (charm !== undefined) {
    if (!ctx.pack.keepsakes[charm]) throw new Error(`Unknown Charm ${charm}`);
    grantKeepsake(d, ctx, charm);
    d.phase = { kind: 'map' };
  }
  if (!tutorial) return d;
  // 3.2: the profile's first run starts inside the combat of row 1's middle node.
  const row1 = d.run.map.nodes.filter((n) => n.row === 1);
  const start = row1[Math.floor(row1.length / 2)]!;
  return enterNode(d, sc, start.id);
}
