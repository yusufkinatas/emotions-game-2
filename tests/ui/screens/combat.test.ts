// Combat screen view model: wheel-order hand, targeting options and previews come from the engine.
import { describe, expect, it } from 'vitest';
import { defaultPack } from '../../../src/content/index';
import { createEngine } from '../../../src/engine/index';
import type { GameState } from '../../../src/engine/types';
import type { App } from '../../../src/ui/app';
import { buildModel, handSortKey, inwardText } from '../../../src/ui/screens/combat/model';
import { buildSelection, cycleFocus } from '../../../src/ui/screens/combat/selection';
import { intentItems, promiseText, relationLabel, shadeChips } from '../../../src/ui/screens/combat/text';

const engine = createEngine(defaultPack);
const fakeApp = { engine, canUndo: () => false, busy: false } as unknown as App;

function fight(enc: string, hand: string[], tweak?: (s: GameState) => void): GameState {
  let s = engine.newRun(9, { tutorial: false });
  s = engine.debug.startCombat(s, enc);
  s = engine.debug.setHand(s, hand);
  tweak?.(s);
  return s;
}

const noExtras = { sel: null, hoverCard: null, endTurnHover: false, feltCracks: new Map() };

describe('combat view model', () => {
  it('sorts the hand in wheel order (16.2)', () => {
    const key = (id: string) => handSortKey(defaultPack.cards[id]!);
    expect(key('love.kind_word')).toBe(0);
    expect(key('blend.sunbeam')).toBe(1);
    expect(key('joy.bright_spark')).toBe(2);
    expect(key('buried.anger')).toBe(13);
    const s = fight('enc.a1.kettle', ['courage.stand_firm', 'buried.anger', 'love.kind_word', 'joy.bright_spark']);
    const m = buildModel(fakeApp, s, noExtras);
    expect(m.hand.map((c) => c.def.id)).toEqual(['love.kind_word', 'joy.bright_spark', 'courage.stand_firm', 'buried.anger']);
  });

  it('lists every legal target with its preview, INWARD first', () => {
    const s = fight('enc.a1.two_grumbles', ['love.kind_word', 'joy.bright_spark'], (x) => {
      x.combat!.player.statuses.seething = 2;
    });
    const uid = s.combat!.piles.hand.find((u) => s.combat!.cards[u]!.defId === 'love.kind_word')!;
    const sel = buildSelection(fakeApp, s, uid)!;
    expect(sel.options[0]!.key).toBe('inward');
    expect(sel.options.filter((o) => typeof o.key === 'number')).toHaveLength(2);
    expect(typeof sel.focus).toBe('number');
    expect(cycleFocus(sel, -1)).toBe('inward');
    const m = buildModel(fakeApp, s, { ...noExtras, sel });
    expect(m.shades.every((sh) => sh.targetable && sh.preview?.callout?.label === 'OPPOSITE x2')).toBe(true);
    expect(m.inward?.text).toMatch(/^Clear 2 Seething/);
    expect(m.playLine).toContain('OPPOSITE x2');
  });

  it('shows a lethal banner with engine sub-lines', () => {
    const s = fight('enc.a1.kettle', ['love.kind_word', 'courage.brave_strike'], (x) => {
      x.combat!.enemies[0]!.hp = 5;
    });
    const hand = s.combat!.piles.hand;
    const love = hand.find((u) => s.combat!.cards[u]!.defId === 'love.kind_word')!;
    const brave = hand.find((u) => s.combat!.cards[u]!.defId === 'courage.brave_strike')!;
    const resolve = buildModel(fakeApp, s, { ...noExtras, sel: buildSelection(fakeApp, s, love) });
    expect(resolve.shades[0]!.preview?.banner?.kind).toBe('resolve');
    expect(resolve.shades[0]!.preview?.banner?.sub?.some((x) => x.includes('Glimmers'))).toBe(true);
    const suppress = buildModel(fakeApp, s, { ...noExtras, sel: buildSelection(fakeApp, s, brave) });
    const banner = suppress.shades[0]!.preview?.banner;
    expect(banner?.kind).toBe('suppress');
    expect(banner?.resolveWith).toBe('Kind Word');
    expect(suppress.hand.find((c) => c.uid === love)?.resolveWith).toBe(true);
  });

  it('builds intent items, chips and promise text from engine data', () => {
    const s = fight('enc.a1.kettle', ['love.kind_word']);
    const iv = engine.intents(s)[0]!;
    expect(intentItems(iv).length).toBeGreaterThan(0);
    const e = s.combat!.enemies[0]!;
    const chips = shadeChips(defaultPack, e, defaultPack.enemies[e.defId]!);
    expect(chips.some((c) => c.label === 'Pressure' && String(c.value).includes('/'))).toBe(true);
    expect(chips.filter((c) => c.label === 'Pressure')).toHaveLength(1);
    expect(promiseText(defaultPack, defaultPack.cards['hope.silver_lining']!.effects.flatMap((x) => (x.op === 'promise' ? x.effects : [])))).toBe('+5 Guard, draw 1');
    expect(relationLabel({ relation: 'dissonant', typePct: 50 })).toBe('DISSONANT x1/2');
  });

  it('turns the engine Inward line into the target preview', () => {
    expect(inwardText({ line: 'Kind Word -> Inward: clear 2 Seething. Tend Buried Anger (W2 -> W1).' } as never)).toBe(
      'Clear 2 Seething. Tend Buried Anger (W2 -> W1).',
    );
  });
});
