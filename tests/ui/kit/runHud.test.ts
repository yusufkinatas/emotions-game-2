import { describe, expect, it } from 'vitest';
import { lightMixMarkup, mapNodeMarkup, numbnessMeterMarkup } from '../../../src/ui/kit/runHud';
import type { LightMixSegment } from '../../../src/ui/kit/runHud';

describe('the Numbness meter (4.16)', () => {
  it('shows the grey oval and "N will surface", clamped to 0..3', () => {
    const m = numbnessMeterMarkup({ count: 2 });
    expect(m).toContain('data-icon="numb"');
    expect(m.replace(/<[^>]+>/g, '')).toContain('The Numbness: 2 will surface');
    expect((m.match(/numb-meter__pip is-on/g) ?? []).length).toBe(2);
    expect(numbnessMeterMarkup({ count: 7 }).replace(/<[^>]+>/g, '')).toContain(': 3 will surface');
    expect(numbnessMeterMarkup({ count: -1 }).replace(/<[^>]+>/g, '')).toContain(': 0 will surface');
  });

  it('carries the tooltip sentence as a reachable tip', () => {
    const m = numbnessMeterMarkup({ count: 1, title: 'Buried Anger (W2) will surface.' });
    expect(m).toContain('tabindex="0"');
    expect(m).toContain('data-tip="Buried Anger (W2) will surface."');
  });
});

describe('the Light Mix bar (16.4)', () => {
  const segments: LightMixSegment[] = [
    { kind: 'light', light: 'love', count: 4 },
    { kind: 'light', light: 'joy', count: 0 },
    { kind: 'blend', lights: ['love', 'joy'], count: 1 },
    { kind: 'neutral', count: 1 },
    { kind: 'insight', light: 'calm', count: 1 },
    { kind: 'buried', shade: 'anger', count: 2 },
  ];

  it('draws one segment per non-empty entry, in the order given, sized by count', () => {
    const m = lightMixMarkup({ segments });
    const kinds = [...m.matchAll(/mix__seg--(\w+)/g)].map((x) => x[1]);
    expect(kinds).toEqual(['light', 'blend', 'neutral', 'insight', 'buried']);
    expect(m).toContain('style="flex:4 1 0"');
    expect(m).toContain('aria-label="Light Mix, 9 cards"');
  });

  it('splits Blends, gives Buried its cure rim and Insight its Light', () => {
    const m = lightMixMarkup({ segments });
    expect(m).toContain('data-light="love" data-light2="joy"');
    expect(m).toContain('data-face="anger"');
    expect(m).toContain('data-tip="Buried Anger: 2"');
    expect(m).toContain('data-tip="Insight (Calm): 1"');
    expect(m).toContain('data-tip="Delight: 1"');
  });

  it('marks the hovered reward card with a +1 ghost', () => {
    const m = lightMixMarkup({ segments, ghost: 2 });
    expect((m.match(/is-ghost/g) ?? []).length).toBe(1);
    expect(m).toMatch(/mix__seg--blend is-ghost/);
    expect(m).toContain('<span class="mix__ghost">+1</span>');
  });

  it('can be one button that opens the deck view, with no focusable children', () => {
    const m = lightMixMarkup({ segments, button: true });
    expect(m).toMatch(/^<button[^>]*class="mix mix--button"[^>]*type="button"/);
    expect(m).toContain('Open the deck view');
    expect(m).not.toContain('tabindex');
  });
});

describe('map nodes (11.4, 16.4)', () => {
  it('fights show their Shade sigils, sized by how many share the circle', () => {
    const m = mapNodeMarkup({ kind: 'fight', state: 'reachable', key: 1, shades: [['fear'], ['anger']], label: 'Fight: Fear and Anger' });
    expect(m).toContain('data-n="2"');
    expect(m).toContain('data-face="fear"');
    expect(m).toContain('data-face="anger"');
    expect(m).toContain('aria-label="Fight: Fear and Anger"');
    expect(m).toContain('<span class="map-node__key" aria-hidden="true">1</span>');
    expect(m).not.toContain('data-icon="fight"');
  });

  it('joins a compound\'s two sigils with a bar', () => {
    const m = mapNodeMarkup({ kind: 'fight', state: 'reachable', shades: [['anger', 'sadness']], label: 'Fight: Old Grudge' });
    expect((m.match(/class="joiner"/g) ?? []).length).toBe(1);
    expect(m).toContain('data-n="2"');
  });

  it('labels Apathy with the NUMB oval', () => {
    const m = mapNodeMarkup({ kind: 'elite', state: 'reachable', shades: [['numb']], label: 'Elite: Apathy' });
    expect(m).toContain('map-node__numb');
    expect(m).toContain('<b>NUMB</b>');
  });

  it('uses the kind icon for other nodes and shows states', () => {
    for (const kind of ['haven', 'sanctuary', 'memory', 'chest', 'boss'] as const) {
      expect(mapNodeMarkup({ kind, state: 'visited', label: kind })).toContain(`data-icon="${kind}"`);
    }
    expect(mapNodeMarkup({ kind: 'fight', state: 'visited', label: 'x' })).toContain('data-icon="fight"');
    const off = mapNodeMarkup({ kind: 'memory', state: 'unreachable', key: 2, label: 'Memory' });
    expect(off).toContain('data-state="unreachable"');
    expect(off).toContain(' disabled');
    expect(off).not.toContain('map-node__key');
  });

  it('a boss node can draw the boss silhouette', () => {
    const m = mapNodeMarkup({ kind: 'boss', state: 'unreachable', label: 'Boss: The Mask', silhouette: { family: 'mask', seed: 9, face: 'anger', ornament: 'mask' } });
    expect(m).toContain('class="shade-art"');
    expect(m).toContain('data-family="mask"');
    expect(m).toContain('aria-label="Boss: The Mask"');
  });
});
