import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvedFormMarkup, shadeMarkup } from '../../../src/ui/kit/shadeArt';
import type { ShadeArtOpts, ShadeFamily } from '../../../src/ui/kit/shadeArt';

const FAMILIES: ShadeFamily[] = ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety', 'doubt', 'mask', 'numb'];
const faceOf = (f: ShadeFamily): ShadeArtOpts['face'] => (f === 'numb' ? null : f === 'doubt' ? 'fear' : f === 'mask' ? 'anger' : f);

/** Strip per-instance ids so two renders can be compared. */
const stable = (m: string) => m.replace(/sa\d+_/g, 'ID_');

describe('shade art', () => {
  it('renders every family deterministically from the seed', () => {
    for (const family of FAMILIES) {
      const o = { family, seed: 42, face: faceOf(family) };
      const a = stable(shadeMarkup(o));
      const b = stable(shadeMarkup(o));
      expect(a, family).toBe(b);
      expect(a, family).toMatch(/^<svg[^>]*class="shade-art"/);
      expect(a, family).toContain(`data-family="${family}"`);
      expect(a, family).toContain('viewBox="0 0 200 210"');
      expect(a, family).toContain('role="img"');
      expect(a, family).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('varies geometry by seed', () => {
    for (const family of FAMILIES.filter((f) => f !== 'numb' && f !== 'doubt')) {
      const shapes = new Set([1, 2, 3, 4].map((seed) => stable(shadeMarkup({ family, seed, face: faceOf(family) }))));
      expect(shapes.size, family).toBe(4);
    }
  });

  it('never uses Math.random', () => {
    for (const f of ['shadeArt.ts', 'shadeFamilies.ts', 'shadeGeometry.ts', 'hash.ts']) {
      const src = readFileSync(join(__dirname, '../../../src/ui/kit', f), 'utf8').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/Math\.random/);
    }
  });

  it('binds the crack colour to the showing face', () => {
    expect(shadeMarkup({ family: 'anger', seed: 1, face: 'anger' })).toContain('data-face="anger"');
    expect(shadeMarkup({ family: 'numb', seed: 1, face: null })).toContain('data-face="none"');
  });

  it('compounds carry an inner-face badge that knows which face is showing', () => {
    const outer = shadeMarkup({ family: 'anger', seed: 5, face: 'anger', innerFace: 'sadness' });
    const inner = shadeMarkup({ family: 'anger', seed: 5, face: 'sadness', innerFace: 'sadness' });
    expect(outer).toContain('data-showing="outer"');
    expect(inner).toContain('data-showing="inner"');
    expect(outer).toContain('sa-badge');
    expect(shadeMarkup({ family: 'anger', seed: 5, face: 'anger' })).not.toContain('sa-badge');
  });

  it('The Mask holds every face sigil for the crossfade and shows its next face', () => {
    const m = shadeMarkup({ family: 'mask', seed: 1, face: 'fear', nextFace: 'anger' });
    for (const s of ['anger', 'sadness', 'loneliness', 'fear']) expect(m).toContain(`sa-mface--${s}`);
    expect(m).toContain('data-next="anger"');
  });

  it('Flare caps its look at 5 and opens more Fear eyes', () => {
    expect(shadeMarkup({ family: 'anger', seed: 1, face: 'anger', flare: 9 })).toContain('data-flare="5"');
    const eyes = (flare: number) => (shadeMarkup({ family: 'fear', seed: 7, face: 'fear', flare }).match(/class="sa-eye /g) ?? []).length;
    expect(eyes(0)).toBeGreaterThanOrEqual(2);
    expect(eyes(5)).toBeGreaterThanOrEqual(eyes(0));
    expect(eyes(0)).toBeLessThanOrEqual(7);
  });

  it('Felt hits leave two-colour cracks on the numb family', () => {
    const m = shadeMarkup({ family: 'numb', seed: 3, face: null, feltCracks: [['love', 'joy']] });
    expect(m).toContain('stroke:var(--love)');
    expect(m).toContain('stroke:var(--joy)');
    expect(shadeMarkup({ family: 'numb', seed: 3, face: null, slouched: true })).toContain('data-slouched="true"');
  });

  it('uses the given label and size', () => {
    const m = shadeMarkup({ family: 'sadness', seed: 2, face: 'sadness', label: 'Mope, Sadness', size: 180 });
    expect(m).toContain('aria-label="Mope, Sadness"');
    expect(m).toContain('height:180px');
  });

  it('draws a resolved form per Light', () => {
    for (const l of ['love', 'joy', 'friendship', 'courage', 'hope', 'calm'] as const) {
      expect(resolvedFormMarkup(l)).toContain(`data-light="${l}"`);
    }
  });
});
