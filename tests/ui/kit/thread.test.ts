import { describe, expect, it } from 'vitest';
import { threadMarkup } from '../../../src/ui/kit/thread';

const pathOf = (m: string): number[] => {
  const d = /class="light-thread__line" d="([^"]+)"/.exec(m)?.[1] ?? '';
  return [...d.matchAll(/-?\d+(\.\d+)?/g)].map((x) => Number(x[0]));
};

describe('the thread of light (16.2)', () => {
  it('curves from the Light card to the Buried card inside a box placed in container coordinates', () => {
    const m = threadMarkup({ from: [100, 300], to: [400, 320], light: 'love', lift: 60 });
    expect(m).toContain('data-light="love"');
    const left = Number(/left:(-?[\d.]+)px/.exec(m)![1]);
    const top = Number(/top:(-?[\d.]+)px/.exec(m)![1]);
    const [x0, y0, , , , , x1, y1] = pathOf(m);
    // The path's end points, moved back into the container, are the two points given.
    expect(x0! + left).toBeCloseTo(100);
    expect(y0! + top).toBeCloseTo(300);
    expect(x1! + left).toBeCloseTo(400);
    expect(y1! + top).toBeCloseTo(320);
  });

  it('bows upward by the lift and works in either direction', () => {
    const m = threadMarkup({ from: [400, 200], to: [100, 200], light: 'calm', lift: 50 });
    const [, y0, , cy] = pathOf(m);
    expect(y0! - cy!).toBeCloseTo(50);
    expect(m).not.toMatch(/NaN/);
    expect(m).toContain('aria-hidden="true"');
  });
});
