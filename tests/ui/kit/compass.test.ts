import { describe, expect, it } from 'vitest';
import { compassMarkup } from '../../../src/ui/kit/compass';
import type { CompassProps } from '../../../src/ui/kit/compass';

const base: CompassProps = {
  enabled: true,
  note: ['love'],
  harmoniesThisTurn: 2,
  energy: 2,
  maxEnergy: 3,
  hollow: false,
  isolated: false,
  act2Unlocked: false,
  ownedLights: ['love', 'joy', 'friendship', 'courage'],
  activeShades: ['anger'],
};

const segState = (m: string, light: string) => m.match(new RegExp(`class="cp-seg" data-light="${light}" data-state="(\\w+)"`))?.[1];

describe('compass', () => {
  it('shows only the Spirit orb before The Compass', () => {
    const m = compassMarkup({ ...base, enabled: false });
    expect(m).not.toContain('cp-ring');
    expect(m).toContain('>2</text>');
    expect(m).toContain('>/3</text>');
    expect(m).not.toContain('Harmonies this turn');
  });

  it('highlights the Note and pulses its unlocked neighbours', () => {
    const m = compassMarkup(base);
    expect(segState(m, 'love')).toBe('note');
    expect(segState(m, 'joy')).toBe('next');
    expect(segState(m, 'calm')).toBe('locked');
    expect(m).toContain('Harmonies this turn: <b class="num">2</b>');
  });

  it('locks Hope and Calm until Act 2 and dims Lights with no cards', () => {
    expect(segState(compassMarkup(base), 'hope')).toBe('locked');
    const act2 = compassMarkup({ ...base, act2Unlocked: true, note: [], ownedLights: ['love'] });
    expect(segState(act2, 'hope')).toBe('dim');
    expect(segState(act2, 'love')).toBe('owned');
  });

  it('a Blend Note fills both segments', () => {
    const m = compassMarkup({ ...base, note: ['love', 'joy'] });
    expect(segState(m, 'love')).toBe('note');
    expect(segState(m, 'joy')).toBe('note');
    expect(segState(m, 'friendship')).toBe('next');
  });

  it('lights the markers of Shades in the fight and explains the rules in titles', () => {
    const m = compassMarkup({ ...base, activeShades: ['anger', 'fear'] });
    expect(m).toContain('data-face="anger" data-active="true"');
    expect(m).toContain('data-face="fear" data-active="true"');
    expect(m).toContain('data-face="sadness" data-active="false"');
    expect(m).toContain('Love answers Anger.');
    expect(m).toContain('Love alone deepens Sadness.');
    expect(m).toContain('Love and Joy: Delight');
  });

  it('draws Hollow, Isolated fog and glowing Blend edges', () => {
    const m = compassMarkup({ ...base, hollow: true, isolated: true, glowEdges: [['love', 'joy']] });
    expect(m).toContain('cp-orb__crack');
    expect(m).toContain('cp-fog');
    expect(m).toContain('data-light="love" data-light2="joy" data-glow="true"');
    expect(m).toContain('Isolated: no Harmony.');
  });

  it('has an accessible summary', () => {
    expect(compassMarkup(base)).toContain('aria-label="Spirit 2 of 3. Note: Love. Harmonies this turn: 2."');
  });
});
