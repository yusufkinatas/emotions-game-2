import { describe, expect, it } from 'vitest';
import {
  ICON_NAMES,
  intentIcon,
  keepsakeIcon,
  markIcon,
  nodeIcon,
  numbBadge,
  resourceIcon,
  sigil,
  sigilBody,
} from '../../../src/ui/kit/sigils';

const BRIEF_HINTS = [
  'compass', 'locket', 'sun', 'bracelet', 'pebble', 'fork', 'flower', 'umbrella', 'tea', 'socks', 'prism',
  'journal', 'lantern', 'mat', 'crane', 'diary', 'teacup', 'shell', 'box', 'mirror', 'key', 'rod',
];

function allIcons(): { name: string; markup: string }[] {
  return [
    ...[...ICON_NAMES.lights, ...ICON_NAMES.shades, ...ICON_NAMES.extras].map((nm) => ({ name: `sigil:${nm}`, markup: sigil(nm) })),
    ...ICON_NAMES.intents.map((nm) => ({ name: `intent:${nm}`, markup: intentIcon(nm) })),
    ...ICON_NAMES.nodes.map((nm) => ({ name: `node:${nm}`, markup: nodeIcon(nm) })),
    ...ICON_NAMES.resources.map((nm) => ({ name: `res:${nm}`, markup: resourceIcon(nm) })),
    ...ICON_NAMES.marks.map((nm) => ({ name: `mark:${nm}`, markup: markIcon(nm) })),
    ...ICON_NAMES.keepsakes.map((nm) => ({ name: `keepsake:${nm}`, markup: keepsakeIcon(nm) })),
  ];
}

describe('sigils and icons', () => {
  it('every icon is a 24-unit SVG drawn in currentColor with no hard-coded colours', () => {
    for (const { name, markup } of allIcons()) {
      expect(markup, name).toMatch(/^<svg[^>]*viewBox="0 0 24 24"/);
      expect(markup, name).toContain('currentColor');
      expect(markup, name).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(markup, name).not.toMatch(/NaN|undefined/);
    }
  });

  it('draws every required family', () => {
    expect(ICON_NAMES.lights).toHaveLength(6);
    expect(ICON_NAMES.shades).toHaveLength(6);
    expect(ICON_NAMES.extras).toEqual(expect.arrayContaining(['numb', 'doubt']));
    expect(ICON_NAMES.intents).toEqual(['strike', 'guard', 'afflict', 'buff', 'mend', 'summon', 'scatter']);
    expect(ICON_NAMES.nodes).toEqual(['fight', 'elite', 'haven', 'sanctuary', 'memory', 'chest', 'boss']);
    expect(ICON_NAMES.resources).toEqual(['heart', 'spirit', 'guard', 'glimmer']);
    expect([...ICON_NAMES.keepsakes]).toEqual(expect.arrayContaining(BRIEF_HINTS));
  });

  it('no two sigils share a glyph', () => {
    const names = [...ICON_NAMES.lights, ...ICON_NAMES.shades, ...ICON_NAMES.extras];
    const bodies = new Set(names.map((nm) => sigilBody(nm)));
    expect(bodies.size).toBe(names.length);
  });

  it('keepsake hints map to their shapes and unknown hints get the default charm', () => {
    expect(keepsakeIcon('compass')).toContain('data-icon="compass"');
    expect(keepsakeIcon('something-new')).toContain('data-icon="charm"');
    expect(keepsakeIcon(undefined)).toContain('data-icon="charm"');
    expect(keepsakeIcon('toString')).toContain('data-icon="charm"');
  });

  it('is decorative by default and labelled when given a title', () => {
    expect(sigil('love')).toContain('aria-hidden="true"');
    const labelled = sigil('love', { title: 'Love <3' });
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Love &lt;3"');
    expect(labelled).toContain('<title>Love &lt;3</title>');
  });

  it('sizes and tints on request', () => {
    expect(sigil('joy', { size: 14 })).toContain('width:14px;height:14px');
    expect(sigil('joy', { size: 'calc(var(--u) * 24)' })).toContain('width:calc(var(--u) * 24)');
    expect(sigil('joy', { tint: true })).toContain('sigil--tint');
    expect(numbBadge({ size: 24 })).toContain('NUMB');
  });

  it('rejects unknown sigils', () => {
    expect(() => sigil('rage' as never)).toThrow(/Unknown sigil/);
  });
});
