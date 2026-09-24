import { describe, expect, it } from 'vitest';
import {
  barMarkup,
  chipRowMarkup,
  defaultMatchups,
  floatingNumberMarkup,
  intentPillMarkup,
  lethalBannerMarkup,
  matchupChipMarkup,
  nameplateMarkup,
  statusChipMarkup,
} from '../../../src/ui/kit/widgets';

describe('widgets', () => {
  it('bars expose fill, preview and aria values', () => {
    const m = barMarkup({ kind: 'heart', value: 54, max: 70, previewLoss: 80 });
    expect(m).toContain('--p:0.77');
    expect(m).toContain('--loss:0.77');
    expect(m).toContain('aria-valuenow="54"');
    expect(m).toContain('54/70');
    expect(m).toContain('bar__loss');
    expect(barMarkup({ kind: 'heart', value: 40, max: 70, previewGain: 99 })).toContain('--gain:0.43');
    expect(barMarkup({ kind: 'intensity', value: 5, max: 0 })).toContain('--p:0');
    expect(barMarkup({ kind: 'heart', value: 5, max: 70, lethal: true })).toContain('data-lethal="true"');
  });

  it('affliction chips carry the Shade and a text label', () => {
    const m = statusChipMarkup({ kind: 'affliction', affliction: 'seething', label: 'Seething', value: 2 });
    expect(m).toContain('data-face="anger"');
    expect(m).toContain('Seething');
    expect(m).toContain('<b class="chip__n">2</b>');
  });

  it('collapses more than 3 status chips into +N', () => {
    const chips = ['Flare', 'Shy', 'Fleeting', 'Hush'].map((label) => ({ kind: 'flag' as const, label }));
    const row = chipRowMarkup(chips);
    expect(row).toContain('+2');
    expect(chipRowMarkup(chips.slice(0, 3))).not.toContain('chip--more');
  });

  it('matchup chips pair colour with shape and text', () => {
    expect(matchupChipMarkup({ kind: 'opposite', light: 'love' })).toContain('x2');
    expect(matchupChipMarkup({ kind: 'opposite', light: 'love' })).toContain('chevronUp2');
    expect(matchupChipMarkup({ kind: 'dissonant', light: 'calm' })).toContain('x1/2');
    expect(matchupChipMarkup({ kind: 'felt' })).toContain('FELT x2');
    expect(matchupChipMarkup({ kind: 'muffled' })).toContain('MUFFLED x1/2');
    const m = defaultMatchups('anger', { light: 'calm', line: 'Just calm down.' });
    expect(m[0]!.title).toBe('OPPOSITE: Love deals double and Resolves Anger.');
    expect(m[1]!.title).toBe("DISSONANT: 'Just calm down.' Calm deals half and gives Anger 1 Flare.");
  });

  it('intent pills show multi-strikes, order and the projected tag', () => {
    const m = intentPillMarkup({ items: [{ kind: 'strike', value: 3, count: 4 }], order: 2, projected: true });
    expect(m).toContain('3x4');
    expect(m).toContain('intent-pill__order');
    expect(m).toContain('after end of turn');
    expect(intentPillMarkup({ items: [{ kind: 'afflict', affliction: 'heavy', stacks: 1 }] })).toContain('data-face="sadness"');
  });

  it('floating numbers tag their relation', () => {
    expect(floatingNumberMarkup({ kind: 'opposite', value: 12, lights: ['love'] })).toContain('x2');
    const dis = floatingNumberMarkup({ kind: 'dissonant', value: 3, line: 'Just calm down.' });
    expect(dis).toContain('x1/2');
    expect(dis).toContain('Just calm down.');
    expect(floatingNumberMarkup({ kind: 'felt', value: 14, lights: ['love', 'joy'] })).toContain('data-light2="joy"');
    expect(floatingNumberMarkup({ kind: 'blocked', value: 5 })).toContain('Blocked 5');
  });

  it('lethal banners use the game words', () => {
    expect(lethalBannerMarkup({ kind: 'resolve', lights: ['love'] })).toContain('RESOLVE');
    expect(lethalBannerMarkup({ kind: 'deepResolve', lights: ['love', 'joy'] })).toContain('DEEP RESOLVE');
    const sup = lethalBannerMarkup({ kind: 'suppress', sub: ['Buried Anger joins your deck (Weight 1)'], resolveWith: 'Kind Word' });
    expect(sup).toContain('SUPPRESS');
    expect(sup).toContain('Resolve with: <b>Kind Word</b>');
    expect(lethalBannerMarkup({ kind: 'fade' })).toContain('FADES');
  });

  it('nameplates show type, name, bar and the NUMB label', () => {
    const m = nameplateMarkup({ face: 'anger', name: 'Grumble', hp: 24, maxHp: 42, guard: 5, matchups: [], chips: [] });
    expect(m).toContain('ANGER');
    expect(m).toContain('Grumble');
    expect(m).toContain('24/42');
    expect(m).toContain('Guard 5');
    expect(nameplateMarkup({ face: null, name: 'The Numbness', hp: 1, maxHp: 2, guard: 0, matchups: [], chips: [] })).toContain('NUMB');
  });
});
