// Coach mark placement (17.3): a tip sits next to its anchor, inside the viewport, and away from the UI
// it would otherwise cover (End Turn, the top bar, banners). DOM-free geometry.
import { describe, expect, it } from 'vitest';
import { placeTip, type Avoid, type Rect } from '../../src/ui/tipPlace';

const view = { w: 1280, h: 720 };
const bubble = { w: 280, h: 76 };
const box = (p: { left: number; top: number }): Rect => ({ left: p.left, top: p.top, right: p.left + bubble.w, bottom: p.top + bubble.h });
const overlaps = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inView = (r: Rect): boolean => r.left >= 8 && r.top >= 8 && r.right <= view.w - 8 && r.bottom <= view.h - 8;

describe('coach mark placement', () => {
  it('prefers the space above the anchor when nothing is in the way', () => {
    const anchor = { left: 600, top: 400, right: 700, bottom: 460 };
    const p = placeTip({ anchor, bubble, view, avoid: [], u: 1 });
    expect(p.arrow).toBe('down');
    expect(box(p).bottom).toBeLessThanOrEqual(anchor.top);
    expect(inView(box(p))).toBe(true);
  });

  it('never covers End Turn when a card next to it is the anchor', () => {
    const anchor = { left: 850, top: 520, right: 990, bottom: 710 };
    const endTurn: Avoid = { left: 1064, top: 476, right: 1264, bottom: 532, weight: 3 };
    const p = placeTip({ anchor, bubble, view, avoid: [endTurn], u: 1 });
    expect(overlaps(box(p), endTurn)).toBe(false);
    expect(overlaps(box(p), anchor)).toBe(false);
    expect(inView(box(p))).toBe(true);
  });

  it('moves beside a banner near the top instead of over the top bar or the Shade below it', () => {
    const anchor = { left: 728, top: 96, right: 933, bottom: 168 };
    const avoid: Avoid[] = [
      { left: 0, top: 0, right: 1280, bottom: 44, weight: 2 },
      { left: 735, top: 170, right: 925, bottom: 304, weight: 0.7 },
    ];
    const p = placeTip({ anchor, bubble, view, avoid, u: 1 });
    expect(['left', 'right']).toContain(p.arrow);
    for (const r of avoid) expect(overlaps(box(p), r)).toBe(false);
  });

  it('keeps the arrow pointing into the anchor when the bubble is pushed in from an edge', () => {
    const anchor = { left: 1200, top: 400, right: 1260, bottom: 440 };
    const p = placeTip({ anchor, bubble, view, avoid: [], u: 1 });
    expect(p.arrow).toBe('down');
    const tipX = p.left + (p.arrowAt ?? 0) + 7;
    expect(tipX).toBeGreaterThanOrEqual(anchor.left - 1);
    expect(tipX).toBeLessThanOrEqual(anchor.right + 1);
  });

  it('with no anchor it sits top centre with no arrow', () => {
    const p = placeTip({ anchor: null, bubble, view, avoid: [], u: 1 });
    expect(p.arrow).toBe('none');
    expect(p.left).toBe((view.w - bubble.w) / 2);
  });
});
