import { describe, expect, it } from 'vitest';
import { barkMarkup, coachMarkMarkup, promiseChipMarkup, waveringChipMarkup } from '../../../src/ui/kit/callouts';

describe('barks and coach marks', () => {
  it('bark bubbles escape their text, point their tail and stay out of the accessibility tree', () => {
    const m = barkMarkup({ text: 'Nobody <LISTENS>.' });
    expect(m).toContain('Nobody &lt;LISTENS&gt;.');
    expect(m).toContain('data-tail="down"');
    expect(m).toContain('aria-hidden="true"');
    expect(barkMarkup({ text: 'Quiet.', tail: 'left', farewell: true })).toContain('class="bark bark--farewell" data-tail="left"');
  });

  it('coach marks carry an arrow, an id and a labelled close button', () => {
    const m = coachMarkMarkup({ text: 'Shades show their next move.', arrow: 'up', id: 'C1' });
    expect(m).toContain('data-arrow="up"');
    expect(m).toContain('data-coach="C1"');
    expect(m).toContain('role="note"');
    expect(m).toContain('aria-label="Dismiss tip"');
    expect(coachMarkMarkup({ text: 'x' })).toContain('data-arrow="down"');
  });
});

describe("chips at a Shade's feet", () => {
  it('a pending Promise shows its Lights as a two-colour rim and a reachable tip', () => {
    const m = promiseChipMarkup({ text: 'Promise: Ease 8', lights: ['hope', 'courage'] });
    expect(m).toContain('data-light="hope" data-light2="courage"');
    expect(m).toContain('Promise: Ease 8');
    expect(m).toContain('tabindex="0"');
    expect(m).toContain('A Promise carrying Hope and Courage');
    expect(promiseChipMarkup({ text: 'Promise: Ease 4', lights: ['hope'] })).toContain('data-light="hope" data-light2="hope"');
  });

  it('the Wavering chip says what to do', () => {
    const m = waveringChipMarkup();
    expect(m).toContain('feet-chip--wavering');
    expect(m).toContain('Finish it yourself');
    expect(m).toContain('data-tip="Wavering: it stops at 1. Finish it yourself."');
    expect(waveringChipMarkup({ title: 'Stops at 1.' })).toContain('data-tip="Stops at 1."');
  });
});
