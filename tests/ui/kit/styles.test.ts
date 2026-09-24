import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../../src/ui/styles');
const css = (f: string) => readFileSync(join(DIR, f), 'utf8');
const all = () => readdirSync(DIR).filter((f) => f.endsWith('.css')).map((f) => [f, css(f)] as const);

describe('styles', () => {
  it('defines every 16.0 token with its exact value', () => {
    const t = css('tokens.css').toLowerCase();
    const tokens: Record<string, string> = {
      '--bg-0': '#0e0c16',
      '--bg-1': '#1c1830',
      '--surface': '#231e33',
      '--text': '#ede8f5',
      '--text-2': '#a89fbf',
      '--pearl': '#f4efe6',
      '--silver': '#c7cedb',
      '--ink': '#15121f',
      '--ink-rim': '#2e2645',
      '--love': '#ff5c8a',
      '--joy': '#ffd23f',
      '--friendship': '#3ddc84',
      '--courage': '#ff8c42',
      '--hope': '#b18cff',
      '--calm': '#4cc9f0',
    };
    for (const [k, v] of Object.entries(tokens)) expect(t, k).toContain(`${k}: ${v};`);
    const cb = t.slice(t.indexOf("[data-palette='cb']"));
    for (const [k, v] of Object.entries({ '--love': '#cc79a7', '--joy': '#f0e442', '--friendship': '#009e73', '--courage': '#e69f00', '--hope': '#0072b2', '--calm': '#56b4e9' })) {
      expect(cb, k).toContain(`${k}: ${v};`);
    }
    expect(t).toContain('--u: min(calc(100vw / 1280), calc(100vh / 720));');
    expect(t).toContain(":root[data-motion='reduced']");
    expect(t).toContain('@media (prefers-reduced-motion: reduce)');
    expect(t).toContain('ui-rounded, system-ui, sans-serif');
    expect(t).toContain('ui-serif, georgia, serif');
  });

  it('keyframes animate transform and opacity only (18.3)', () => {
    // The Harmony arc's dash draw is the one allowed SVG attribute animation in CSS.
    const allowed = /^(transform|opacity|stroke-dashoffset)$/;
    for (const [file, text] of all()) {
      for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
        for (const prop of m[2]!.matchAll(/([a-z-]+)\s*:/g)) {
          expect(prop[1], `${file} ${m[1]}`).toMatch(allowed);
        }
      }
    }
  });

  it('reduced motion switches every kit animation variable', () => {
    const t = css('tokens.css');
    const defaults = new Set([...t.slice(0, t.indexOf("[data-palette='cb']")).matchAll(/(--a-[\w-]+):/g)].map((m) => m[1]));
    const reducedBlock = t.slice(t.indexOf(":root[data-motion='reduced']"), t.indexOf('@media (prefers-reduced-motion'));
    const reduced = new Set([...reducedBlock.matchAll(/(--a-[\w-]+):/g)].map((m) => m[1]));
    for (const name of defaults) {
      if (name === '--a-idle-numb') continue;
      expect(reduced.has(name), name).toBe(true);
    }
  });

  it('uses no external assets, web fonts or em dashes', () => {
    for (const [file, text] of all()) {
      expect(text, file).not.toMatch(/url\((?!["']?data:|#)/);
      expect(text, file).not.toMatch(/@font-face|@import\s+url\(\s*['"]?https?:/);
      expect(text, file).not.toContain('\u2014');
    }
  });

  it('turns hit-stop off under reduced motion (18.1)', () => {
    const shade = css('kit-shade.css');
    expect(shade).toContain(":root:not([data-motion='reduced']) .is-hitstop");
    const media = shade.slice(shade.indexOf('@media (prefers-reduced-motion: reduce)', shade.indexOf('Hit-stop')));
    expect(media).toMatch(/:root:not\(\[data-motion='full'\]\) \.is-hitstop[\s\S]*?animation-play-state: running/);
  });

  it('keeps every tappable element at 56 reference px (16.0), small buttons through a hit-area extension', () => {
    const base = css('base.css');
    expect(css('tokens.css')).toMatch(/--tap: calc\(var\(--u\) \* 56\)/);
    expect(base).toMatch(/\.btn \{[\s\S]*?min-width: var\(--tap\);[\s\S]*?min-height: var\(--tap\);/);
    // 40 visible + 2 x 8 extension = 56 in both directions.
    expect(base).toMatch(/\.btn--small \{[\s\S]*?min-height: calc\(var\(--u\) \* 40\);[\s\S]*?min-width: calc\(var\(--u\) \* 40\);/);
    expect(base).toMatch(/\.btn--small::before \{[\s\S]*?inset: calc\(var\(--u\) \* -8\);/);
  });

  it('never clamps card text and sets no kit text below 12px except the 10px caps footer (19)', () => {
    for (const [file, text] of all()) {
      if (file === 'gallery.css') continue;
      expect(text, file).not.toMatch(/line-clamp/);
      for (const m of text.matchAll(/font-size: calc\(var\(--c?u\) \* ([\d.]+)\)/g)) {
        const px = Number(m[1]);
        const at = text.slice(Math.max(0, m.index! - 400), m.index!);
        const selector = at.slice(at.lastIndexOf('}') + 1).trim();
        if (px < 12) expect(selector, `${file}: ${px}px`).toMatch(/card-face__footer|caps/);
      }
    }
  });

});
