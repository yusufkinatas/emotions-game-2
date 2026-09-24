import { describe, expect, it } from 'vitest';
import {
  WANDERER_HEART,
  companionSlotsMarkup,
  inwardTargetMarkup,
  promiseTrayMarkup,
  wandererMarkup,
} from '../../../src/ui/kit/player';

const fireFill = (m: string): string => /class="wanderer__fire"[^>]*style="fill:([^"]+)"/.exec(m)?.[1] ?? '';

describe('the Wanderer (16.2)', () => {
  it('lights the lantern flame with the Note', () => {
    const m = wandererMarkup({ note: ['love'], compass: true });
    expect(fireFill(m)).toBe('var(--love)');
    expect(m).toContain('data-lit="true"');
    expect(m).toContain('aria-label="You, your lantern lit by Love"');
    expect(m).toMatch(/^<svg[^>]*role="img"/);
  });

  it('splits the flame with a hard edge for two Lights', () => {
    const m = wandererMarkup({ note: ['love', 'joy'], compass: true });
    expect(fireFill(m)).toMatch(/^url\(#wd\d+_f\)$/);
    expect(m).toContain('<stop offset="0.5" stop-color="var(--love)"/><stop offset="0.5" stop-color="var(--joy)"/>');
    expect(m).toContain('lit by Love and Joy');
  });

  it('keeps the flame grey with an empty Note or before The Compass', () => {
    for (const m of [wandererMarkup({ note: [], compass: true }), wandererMarkup({ note: ['calm'], compass: false })]) {
      expect(fireFill(m)).toBe('var(--numb)');
      expect(m).toContain('data-lit="false"');
      expect(m).toContain('waiting for a Light');
    }
  });

  it('keeps the heart point inside the frame and honours size and label', () => {
    const [x, y] = WANDERER_HEART;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(160);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(180);
    const m = wandererMarkup({ note: ['hope'], compass: true, size: 150, label: 'You' });
    expect(m).toContain('height:150px');
    expect(m).toContain('aria-label="You"');
  });
});

describe('the INWARD target', () => {
  it('shows the INWARD label and the engine preview, with the arrow drawn', () => {
    const m = inwardTargetMarkup({ preview: 'Clear 2 Seething. Tend Buried Anger (W2 -> W1).' });
    expect(m).toContain('INWARD');
    expect(m).toContain('Tend Buried Anger (W2 → W1).');
    expect(m).toContain('aria-label="Play Inward. Clear 2 Seething. Tend Buried Anger (W2 -&gt; W1)."');
    expect(m).not.toContain('data-focused');
  });

  it('can be a focused button', () => {
    const m = inwardTargetMarkup({ preview: 'Clear 1 Heavy.', focused: true, tag: 'button' });
    expect(m).toMatch(/^<button[^>]*type="button"/);
    expect(m).toContain('data-focused="true"');
    expect(m.endsWith('</button>')).toBe(true);
  });
});

describe('Companion slots', () => {
  const moth = { icon: 'moth' as const, name: 'Lantern Moth', value: 3, action: 'ease' as const, title: 'Lantern Moth: at the end of your turn, Ease 3 to your last target.' };

  it('always draws three slots with icons and action numbers', () => {
    const m = companionSlotsMarkup({ slots: [moth, { icon: 'hare', name: 'Burrow Hare', value: 3, action: 'guard' }], isolated: false });
    expect((m.match(/class="companion-slot[ "]/g) ?? []).length).toBe(3);
    expect(m).toContain('companion-slot--empty');
    expect(m).toContain('data-icon="moth"');
    expect(m).toContain('data-action="guard"');
    expect(m).toContain('<b class="companion-slot__n num">3</b>');
    expect(m).toContain('Lantern Moth, Ease 3');
    expect(m).toContain('data-tip="Lantern Moth: at the end of your turn');
    expect(m).not.toContain("won't act");
  });

  it('greys out and says why while Isolated', () => {
    const m = companionSlotsMarkup({ slots: [moth], isolated: true });
    expect(m).toContain('data-isolated="true"');
    expect(m).toContain("Isolated: won't act");
    expect(m).toContain('data-tip="Lantern Moth won&#39;t act while you are Isolated."');
  });
});

describe('the Promise tray', () => {
  it('lists each engine line and is empty without Promises', () => {
    const m = promiseTrayMarkup(['+5 Guard, draw 1.', 'Gain 1 Spirit.']);
    expect(m).toContain('Next turn');
    expect((m.match(/promise-tray__line/g) ?? []).length).toBe(2);
    expect(promiseTrayMarkup([])).toBe('');
  });
});
