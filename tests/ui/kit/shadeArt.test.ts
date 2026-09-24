import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHADE_SCALE, resolvedFormMarkup, shadeMarkup } from '../../../src/ui/kit/shadeArt';
import { MASK_FACES, ORNAMENT_OF, ornamentFor } from '../../../src/ui/kit/shadeOrnaments';
import { defaultPack } from '../../../src/content/index';
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

  it('keeps the same cracks, body and idle timing as it Flares 0 to 5 (review 15)', () => {
    // Everything but the Flare-driven geometry (open eyes, spikes, ring, pit) must stay put.
    const cracksOf = (m: string) => [...m.matchAll(/class="sa-crack" d="([^"]+)"/g)].map((x) => x[1]).join('|');
    const timingOf = (m: string) => /--idle-rate:[^;]+;--idle-delay:[^;]+;/.exec(m)?.[0];
    const legsOf = (m: string) => [...m.matchAll(/class="sa-limb sa-limb--leg"><path class="sa-limb__rim" d="([^"]+)"/g)].map((x) => x[1]).join('|');
    for (const seed of [7, 40, 11, 204, 3071]) {
      const fear = [0, 1, 2, 3, 4, 5].map((flare) => shadeMarkup({ family: 'fear', seed, face: 'fear', flare }));
      const bodyOf = (m: string) => /class="sa-ink" d="([^"]+)"/.exec(m)?.[1];
      for (const m of fear) {
        expect(cracksOf(m), `fear ${seed}`).toBe(cracksOf(fear[0]!));
        expect(cracksOf(m).length).toBeGreaterThan(0);
        expect(timingOf(m), `fear ${seed}`).toBe(timingOf(fear[0]!));
        expect(bodyOf(m), `fear ${seed}`).toBe(bodyOf(fear[0]!));
        expect(legsOf(m), `fear ${seed}`).toBe(legsOf(fear[0]!));
      }
      for (const family of FAMILIES) {
        const art = [0, 5].map((flare) => shadeMarkup({ family, seed, face: faceOf(family), flare }));
        expect(cracksOf(art[1]!), `${family} ${seed}`).toBe(cracksOf(art[0]!));
        expect(timingOf(art[1]!), `${family} ${seed}`).toBe(timingOf(art[0]!));
      }
    }
  });

  it('opens Fear eyes with Flare without moving the ones already open', () => {
    const eyesOf = (m: string) => [...m.matchAll(/class="sa-eye__white" cx="([\d.]+)" cy="([\d.]+)"/g)].map((x) => `${x[1]},${x[2]}`);
    for (const seed of [7, 40]) {
      const calm = eyesOf(shadeMarkup({ family: 'fear', seed, face: 'fear', flare: 0 }));
      const flared = eyesOf(shadeMarkup({ family: 'fear', seed, face: 'fear', flare: 5 }));
      expect(calm.length).toBeGreaterThanOrEqual(2);
      expect(flared.length).toBeGreaterThanOrEqual(calm.length);
      for (const e of calm) expect(flared).toContain(e);
    }
  });

  it('seeds each family on its own stream (anger and doubt, fear and mask no longer share offsets)', () => {
    const idle = (family: ShadeFamily) => /--idle-rate:([^;]+);/.exec(shadeMarkup({ family, seed: 40, face: faceOf(family) }))?.[1];
    expect(idle('anger')).not.toBe(idle('doubt'));
    expect(idle('fear')).not.toBe(idle('mask'));
    expect(idle('mask')).not.toBe(idle('numb'));
  });

  it('maps every elite and boss id to an ornament, and every mapped id exists in content', () => {
    const ids = ['shade.kettle', 'shade.knot', 'shade.spiral', 'shade.looming', 'shade.mask', 'shade.apathy', 'shade.numbness'];
    expect(Object.keys(ORNAMENT_OF).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(defaultPack.enemies[id], id).toBeDefined();
      expect(ornamentFor(id), id).toBe(ORNAMENT_OF[id]);
    }
    expect(ornamentFor('shade.grumble')).toBeNull();
    expect(ornamentFor('toString')).toBeNull();
    for (const [id, orn] of Object.entries(ORNAMENT_OF)) {
      const def = defaultPack.enemies[id]!;
      const m = shadeMarkup({ family: def.visual.family, seed: 3, face: def.faces[0] ?? null, ornament: orn, scale: def.visual.scale });
      expect(m, id).toContain(`data-ornament="${orn}"`);
      expect(m, id).toContain('sa-orn');
      expect(m, id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('The Mask wears a crown of its faces; the CSS lights the showing one', () => {
    const m = shadeMarkup({ family: 'mask', seed: 1, face: 'sadness', nextFace: 'loneliness', ornament: 'mask' });
    for (const f of MASK_FACES) expect(m).toContain(`sa-halo__face--${f}`);
    expect((m.match(/class="sa-halo__disc"/g) ?? []).length).toBe(4);
    const three = shadeMarkup({ family: 'mask', seed: 1, face: 'anger', ornament: 'mask', faces: ['anger', 'fear', 'despair'] });
    expect((three.match(/class="sa-halo__disc"/g) ?? []).length).toBe(3);
    expect(three).toContain('sa-halo__face--despair');
  });

  it('gauges drive The Spiral\'s coils and The Numbness\'s veil', () => {
    expect(shadeMarkup({ family: 'despair', seed: 1, face: 'despair', ornament: 'spiral', gauge: 5 })).toContain('--coil:5;');
    expect(shadeMarkup({ family: 'despair', seed: 1, face: 'despair', ornament: 'spiral', gauge: 99 })).toContain('--coil:6;');
    expect(shadeMarkup({ family: 'numb', seed: 1, face: null, ornament: 'numbness', gauge: 3 })).toContain('--veil:3;');
    expect(shadeMarkup({ family: 'numb', seed: 1, face: null, ornament: 'numbness' })).toContain('--veil:1;');
    expect(shadeMarkup({ family: 'numb', seed: 1, face: null, ornament: 'apathy', slouched: true })).toContain('sa-sigh');
  });

  it('clamps scale to the frame range (content bosses above 1.35 draw at 1.35)', () => {
    expect(SHADE_SCALE).toEqual({ min: 0.45, max: 1.35 });
    expect(shadeMarkup({ family: 'numb', seed: 1, face: null, scale: 1.6 })).toContain('scale(1.35)');
    expect(shadeMarkup({ family: 'doubt', seed: 1, face: 'fear', scale: 0.2 })).toContain('scale(0.45)');
  });

  it('drops the heat shimmer filter on request (2+ Anger Shades on screen)', () => {
    const on = shadeMarkup({ family: 'anger', seed: 1, face: 'anger' });
    const off = shadeMarkup({ family: 'anger', seed: 1, face: 'anger', shimmer: false });
    expect(on).toContain('feTurbulence');
    expect(off).not.toContain('feTurbulence');
  });

  it('writes well-formed path data everywhere, ornaments included', () => {
    const ARITY: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
    const check = (d: string, where: string) => {
      for (const seg of d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? []) {
        const cmd = seg[0]!.toLowerCase();
        const args = (seg.slice(1).match(/-?\d*\.?\d+(e-?\d+)?/g) ?? []).length;
        expect(ARITY[cmd], `${where}: unknown command in ${seg}`).toBeDefined();
        if (cmd === 'z') expect(args, where).toBe(0);
        else expect(args % ARITY[cmd]! === 0 && args > 0, `${where}: "${seg.trim()}"`).toBe(true);
      }
    };
    const variants: ShadeArtOpts[] = [
      ...FAMILIES.map((family) => ({ family, seed: 9, face: faceOf(family), flare: 3, innerFace: family === 'anger' ? ('sadness' as const) : null })),
      ...Object.entries(ORNAMENT_OF).map(([id, ornament]) => {
        const def = defaultPack.enemies[id]!;
        return { family: def.visual.family, seed: 4, face: def.faces[0] ?? null, ornament, gauge: 3, scale: def.visual.scale };
      }),
    ];
    for (const o of variants) {
      const m = shadeMarkup(o);
      for (const x of m.matchAll(/ d="([^"]*)"/g)) check(x[1]!, `${o.family}/${o.ornament ?? '-'}`);
    }
  });
});
