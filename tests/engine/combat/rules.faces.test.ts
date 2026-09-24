// R-5 Faced Shades, M1 The Mask's hit-turn limit, R-12 Understood.
import { describe, expect, it } from 'vitest';
import { MEM_TURNS_LEFT } from '../../../src/engine/constants';
import { scenario } from '../../helpers/scenario';

describe('R-5 face turning', () => {
  it('a non-lethal OPPOSITE hit turns a compound to its next face', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.old_grudge', { hp: 60 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(48);
    expect(t.enemy(0).faces[t.enemy(0).faceIndex]).toBe('sadness');
    expect(t.eventsOf('face')[0]!.face).toBe('sadness');
  });

  it('each hit of a multi-hit card is evaluated against the face showing at that moment', () => {
    const t = scenario().hand('joy.confetti').enemy('shade.old_grudge', { hp: 60, faceIndex: 1 }).build();
    t.play('joy.confetti');
    const hits = t.eventsOf('hit');
    expect(hits.map((h) => h.b.relation)).toEqual(['opposite', 'neutral']);
    expect(t.enemy(0).hp).toBe(60 - 6 - 3);
  });

  it('spamming the outer cure backfires: x2 and turn, then x1/2 and Flare', () => {
    const t = scenario().hand('love.kind_word', 'love.kind_word').enemy('shade.old_grudge', { hp: 60 }).build();
    t.play(t.uid('love.kind_word', 0), 0);
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(60 - 12 - 3);
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('The Mask: your hits turn it at most twice per player turn; further OPPOSITE hits still deal x2', () => {
    const t = scenario().hand('love.kind_word', 'joy.bright_spark', 'friendship.reach_out').draw('courage.stand_firm')
      .enemy('shade.mask', { hp: 150, statuses: { flare: 2 } }).build();
    t.play('love.kind_word', 0);
    t.play('joy.bright_spark', 0);
    expect(t.enemy(0).faces[t.enemy(0).faceIndex]).toBe('loneliness');
    expect(t.enemy(0).memory[MEM_TURNS_LEFT]).toBe(0);
    t.play('friendship.reach_out', 0);
    expect(t.eventsOf('hit')[0]!.b.damage).toBe(12);
    expect(t.enemy(0).faces[t.enemy(0).faceIndex]).toBe('loneliness');
    expect(t.enemy(0).statuses.flare ?? 0).toBe(0);
  });

  it('The Mask turns at the end of each of its own actions and its hit-turn counter resets at your turn end', () => {
    const t = scenario().enemy('shade.mask', { hp: 150, memory: { [MEM_TURNS_LEFT]: 0 } }).draw('courage.stand_firm').build();
    expect(t.enemy(0).intent!.moveId).toBe('rage');
    t.endTurn();
    expect(t.enemy(0).faces[t.enemy(0).faceIndex]).toBe('sadness');
    expect(t.enemy(0).intent!.moveId).toBe('weep');
    expect(t.enemy(0).memory[MEM_TURNS_LEFT]).toBe(2);
  });

  it('byFace: turning The Mask on purpose re-derives its intent', () => {
    const t = scenario().hand('love.kind_word').draw('courage.stand_firm').enemy('shade.mask', { hp: 150 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).intent!.moveId).toBe('weep');
  });

  it('The Mask Cracked: the first time it is at half Intensity, Flare +3 (once)', () => {
    const t = scenario().hand('courage.brave_strike', 'courage.brave_strike').enemy('shade.mask', { hp: 80, faceIndex: 3 }).build();
    t.play(t.uid('courage.brave_strike', 0), 0);
    expect(t.enemy(0).statuses.flare).toBe(3);
    t.play('courage.brave_strike', 0);
    expect(t.enemy(0).statuses.flare).toBe(3);
  });

  it('an automatic OPPOSITE hit turns faces and removes Flare (Lantern Moth vs Wallflower)', () => {
    const t = scenario().companions('comp.lantern_moth').enemy('shade.wallflower', { hp: 40, statuses: { flare: 1 }, intent: 'peek' }).build();
    t.endTurn();
    const hit = t.eventsOf('hit')[0]!;
    expect(hit.b.relation).toBe('opposite');
    expect(t.eventsOf('face')[0]!.face).toBe('fear');
    expect(t.enemy(0).statuses.flare ?? 0).toBe(0);
  });

  it('the Spiral unwinds 1 Coil whenever its face turns', () => {
    const t = scenario().hand('neutral.name_it', 'courage.brave_strike').enemy('shade.spiral', { hp: 200, statuses: { coil: 4 } }).build();
    t.play('neutral.name_it', 0);
    t.play('courage.brave_strike', 0); // Understood: counts as OPPOSITE, turns the face
    expect(t.enemy(0).faces[t.enemy(0).faceIndex]).toBe('anxiety');
    expect(t.enemy(0).statuses.coil).toBe(3);
  });
});

describe('R-12 Understood', () => {
  it('the next card hit counts as OPPOSITE (x2, can Resolve), then Understood is removed', () => {
    const t = scenario().hand('neutral.name_it', 'courage.brave_strike', 'courage.brave_strike').enemy('shade.grumble', { hp: 40, statuses: { flare: 1 } }).build();
    t.play('neutral.name_it', 0);
    expect(t.enemy(0).hp).toBe(36); // Name It's own hit is not boosted
    expect(t.enemy(0).statuses.understood).toBe(1);
    t.play(t.uid('courage.brave_strike', 0), 0);
    expect(t.eventsOf('hit')[0]!.b.relation).toBe('opposite');
    expect(t.enemy(0).hp).toBe(24);
    expect(t.enemy(0).statuses.understood ?? 0).toBe(0);
    expect(t.enemy(0).statuses.flare ?? 0).toBe(0);
    t.play('courage.brave_strike', 0);
    expect(t.eventsOf('hit')[0]!.b.relation).toBe('neutral');
  });

  it('an Understood card finishing hit Resolves', () => {
    const t = scenario().hand('neutral.name_it', 'courage.brave_strike').enemy('shade.grumble', { hp: 14 }).build();
    t.play('neutral.name_it', 0);
    t.play('courage.brave_strike', 0);
    expect(t.c.gone[0]!.outcome).toBe('resolve');
  });

  it('automatic hits do not use Understood', () => {
    const t = scenario().companions('comp.lantern_moth').enemy('shade.grumble', { hp: 40, statuses: { understood: 1 }, intent: 'huff' }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.b.relation).toBe('neutral');
    expect(t.enemy(0).statuses.understood).toBe(1);
  });

  it('The Numbness cannot be Understood', () => {
    const t = scenario().hand('neutral.name_it').enemy('shade.numbness', { hp: 180 }).build();
    t.play('neutral.name_it', 0);
    expect(t.enemy(0).statuses.understood ?? 0).toBe(0);
  });
});
