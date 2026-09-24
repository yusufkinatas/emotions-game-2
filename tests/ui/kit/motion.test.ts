import { afterEach, describe, expect, it, vi } from 'vitest';
import { hitStop, prefersReducedMotion } from '../../../src/ui/kit/motion';

/** A tiny stand-in for an element: attributes, a class list and an empty query. */
function fakeEl(attrs: Record<string, string> = {}) {
  const classes = new Set<string>();
  return {
    getAttribute: (k: string) => attrs[k] ?? null,
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
    querySelectorAll: () => [],
    classes,
  };
}

describe('motion helpers (18.1, 19)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reads the root switch before the OS setting', () => {
    expect(prefersReducedMotion(fakeEl({ 'data-motion': 'reduced' }) as unknown as Element)).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(prefersReducedMotion(fakeEl({ 'data-motion': 'full' }) as unknown as Element)).toBe(false);
    expect(prefersReducedMotion(fakeEl() as unknown as Element)).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion(fakeEl() as unknown as Element)).toBe(false);
    expect(prefersReducedMotion(null)).toBe(false);
  });

  it('hit-stop pauses for the given time and then ends', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { documentElement: fakeEl() });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('SVGSVGElement', class {});
    const el = fakeEl();
    hitStop(el as unknown as Element, 60);
    expect(el.classes.has('is-hitstop')).toBe(true);
    vi.advanceTimersByTime(59);
    expect(el.classes.has('is-hitstop')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.classes.has('is-hitstop')).toBe(false);
  });

  it('hit-stop is off under reduced motion', () => {
    vi.stubGlobal('document', { documentElement: fakeEl({ 'data-motion': 'reduced' }) });
    const el = fakeEl();
    const end = hitStop(el as unknown as Element, 110);
    expect(el.classes.has('is-hitstop')).toBe(false);
    expect(() => end()).not.toThrow();
  });

  it('can be ended early', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { documentElement: fakeEl() });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('SVGSVGElement', class {});
    const el = fakeEl();
    const end = hitStop(el as unknown as Element, 110);
    end();
    expect(el.classes.has('is-hitstop')).toBe(false);
  });
});
