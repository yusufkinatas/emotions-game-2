import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { Rng } from '../../../src/engine/rng';
import { drawBossKeepsakes, drawPoolKeepsake } from '../../../src/engine/run/keepsakes';
import { chestReward, heaviestBuried, rollBossCards, rollCardOffer, rollWheelCloses } from '../../../src/engine/run/rewards';
import { cloneJson } from '../../../src/engine/run/clone';
import type { CardDef, GameState } from '../../../src/engine/types';
import { ctx, freshRun, giveBuried, giveCard } from './helpers';

const def = (id: string): CardDef => ctx.pack.cards[id]!;
const N = 1500;
const normal = { elite: false, compassScreen: false, fullBloom: false, ownsCompass: false };

function offers(s: GameState, spec = normal): string[][] {
  const out: string[][] = [];
  for (let seed = 1; seed <= N; seed++) out.push(rollCardOffer(s.run, ctx, new Rng(seed), spec));
  return out;
}

describe('card reward slots (12.2, minor-25)', () => {
  it('3 distinct options of available cards; Act 1 never offers Hope or Calm', () => {
    const s = freshRun(1);
    for (const o of offers(s)) {
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
      for (const id of o) {
        const d = def(id);
        expect(['common', 'uncommon', 'rare']).toContain(d.rarity);
        expect(d.availableFromAct).toBe(1);
        expect(d.lights.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('slot 1 is one of your two most common Lights, counting ease cards only', () => {
    const s = freshRun(2);
    // Six Courage skills would win a count of all cards; ease cards only keep Love and Joy on top.
    for (let i = 0; i < 6; i++) giveCard(s, 'courage.find_your_nerve');
    giveCard(s, 'joy.giggle');
    for (const o of offers(s)) {
      const d = def(o[0]!);
      if (d.lights.length === 0) continue;
      expect(['love', 'joy']).toContain(d.lights[0]);
    }
  });

  it('slot 3 is the Light that Tends your heaviest Buried card (ties by wheel order)', () => {
    const s = freshRun(3);
    giveBuried(s, 'fear', 2);
    giveBuried(s, 'anger', 1);
    expect(heaviestBuried(s.run, ctx)!.defId).toBe('buried.fear');
    let courage = 0;
    for (const o of offers(s)) {
      const d = def(o[2]!);
      if (d.lights.length > 0 && d.lights[0] === 'courage') courage += 1;
    }
    expect(courage / N).toBeGreaterThan(0.85);
    const t = freshRun(3);
    giveBuried(t, 'fear', 2);
    giveBuried(t, 'anger', 2);
    expect(heaviestBuried(t.run, ctx)!.defId).toBe('buried.anger');
  });

  it('rarity per slot is C 60 / U 33 / R 7 and 8% of slots are neutral', () => {
    const s = freshRun(4);
    const tally = { common: 0, uncommon: 0, rare: 0, neutral: 0 };
    for (const o of offers(s)) {
      const d = def(o[1]!);
      if (d.lights.length === 0) tally.neutral += 1;
      else tally[d.rarity as 'common' | 'uncommon' | 'rare'] += 1;
    }
    expect(tally.neutral / N).toBeGreaterThan(0.05);
    expect(tally.neutral / N).toBeLessThan(0.11);
    const light = N - tally.neutral;
    expect(tally.common / light).toBeGreaterThan(0.54);
    expect(tally.common / light).toBeLessThan(0.66);
    expect(tally.rare / light).toBeGreaterThan(0.04);
    expect(tally.rare / light).toBeLessThan(0.1);
  });

  it('elite: slot 3 is an available Blend', () => {
    const s = freshRun(5);
    for (const o of offers(s, { ...normal, elite: true })) {
      expect(def(o[2]!).rarity).toBe('blend');
      expect(def(o[2]!).availableFromAct).toBe(1);
    }
  });

  it('the Compass screen: slot 3 is always an Act 1 Blend, even in Act 2', () => {
    const s = freshRun(6);
    s.run.act = 2;
    const act1 = ['blend.sunbeam', 'blend.tag_youre_it', 'blend.shoulder_to_shoulder'];
    const seen = new Set<string>();
    for (const o of offers(s, { ...normal, compassScreen: true })) {
      expect(act1).toContain(o[2]);
      seen.add(o[2]!);
    }
    expect(seen.size).toBe(3);
  });

  it('Full Bloom adds a 4th option: a Blend with The Compass, else a Light card', () => {
    const s = freshRun(7);
    for (const o of offers(s, { ...normal, fullBloom: true, ownsCompass: true })) {
      expect(o).toHaveLength(4);
      expect(def(o[3]!).rarity).toBe('blend');
    }
    for (const o of offers(s, { ...normal, fullBloom: true, ownsCompass: false })) {
      expect(o).toHaveLength(4);
      expect(def(o[3]!).lights).toHaveLength(1);
      expect(new Set(o).size).toBe(4);
    }
  });

  it('Act 2 offers all six Lights and all Blends', () => {
    const s = freshRun(8);
    s.run.act = 2;
    const lights = new Set<string>();
    for (const o of offers(s)) for (const id of o) for (const l of def(id).lights) lights.add(l);
    expect(lights.size).toBe(6);
    const blends = new Set<string>();
    for (const o of offers(s, { ...normal, elite: true })) blends.add(o[2]!);
    expect(blends.size).toBe(6);
  });
});

describe('boss rewards (12.4) and the wheel closes (12.5)', () => {
  it('3 distinct rare Light cards of the available Lights', () => {
    const s = freshRun(9);
    for (let seed = 1; seed <= 200; seed++) {
      const o = rollBossCards(s.run, ctx, new Rng(seed));
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
      for (const id of o) expect(def(id)).toMatchObject({ rarity: 'rare', availableFromAct: 1 });
    }
  });

  it('3 distinct unowned boss Keepsakes (fewer when fewer remain)', () => {
    const s = freshRun(10);
    s.run.keepsakes.push({ id: 'ks.lead_box', counter: 0 }, { id: 'ks.mirror_shard', counter: 0 }, { id: 'ks.skeleton_key', counter: 0 }, { id: 'ks.lightning_rod', counter: 0 });
    const o = drawBossKeepsakes(s.run, ctx, new Rng(1), 3);
    expect(o.sort()).toEqual(['ks.chipped_teacup', 'ks.spiral_shell']);
  });

  it('wheel closes: Hope common, Calm common, Hope-or-Calm uncommon; deterministic per seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const o = rollWheelCloses(ctx, seed);
      expect(def(o[0]!)).toMatchObject({ lights: ['hope'], rarity: 'common' });
      expect(def(o[1]!)).toMatchObject({ lights: ['calm'], rarity: 'common' });
      expect(def(o[2]!).rarity).toBe('uncommon');
      expect(['hope', 'calm']).toContain(def(o[2]!).lights[0]);
      expect(rollWheelCloses(ctx, seed)).toEqual(o);
    }
  });
});

describe('Keepsake pools (9)', () => {
  it('weighted draws follow C 50 / U 35 / R 15 and skip owned Keepsakes', () => {
    const s = freshRun(11);
    s.run.keepsakes.push({ id: 'ks.tuning_fork', counter: 0 });
    const tally: Record<string, number> = {};
    for (let seed = 1; seed <= 3000; seed++) {
      const id = drawPoolKeepsake(s.run, ctx, new Rng(seed), 'weighted')!;
      expect(id).not.toBe('ks.tuning_fork');
      const r = ctx.pack.keepsakes[id]!.rarity;
      tally[r] = (tally[r] ?? 0) + 1;
    }
    expect(tally['common']! / 3000).toBeGreaterThan(0.45);
    expect(tally['common']! / 3000).toBeLessThan(0.55);
    expect(tally['rare']! / 3000).toBeGreaterThan(0.11);
    expect(tally['rare']! / 3000).toBeLessThan(0.19);
  });

  it('an exhausted rarity moves to the next higher one, and all owned gives null', () => {
    const s = freshRun(12);
    for (const k of Object.values(ctx.pack.keepsakes)) if (k.rarity === 'common') s.run.keepsakes.push({ id: k.id, counter: 0 });
    for (let seed = 1; seed <= 50; seed++) {
      expect(ctx.pack.keepsakes[drawPoolKeepsake(s.run, ctx, new Rng(seed), 'common')!]!.rarity).toBe('uncommon');
    }
    for (const k of Object.values(ctx.pack.keepsakes)) {
      if (['uncommon', 'rare'].includes(k.rarity)) s.run.keepsakes.push({ id: k.id, counter: 0 });
    }
    expect(drawPoolKeepsake(s.run, ctx, new Rng(1), 'weighted')).toBeNull();
    const d = cloneJson(s);
    const offer = chestReward(d, ctx, 99);
    expect(offer.keepsakes).toEqual([]);
    expect(offer.glimmers).toBe(50);
    expect(d.run.glimmers).toBe(s.run.glimmers + 50);
  });
});
