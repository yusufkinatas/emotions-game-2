# Heartward UI kit

Visual and audio building blocks for the screens (DESIGN 16, 16.7, 18, 19). Vanilla TypeScript, inline SVG,
no framework, no external assets, system fonts only. The kit never computes game rules: every number,
sentence and state comes in through props from the engine (`preview`, `intents`, `handHints`, `cardText`,
`nodeDetail`).

Open `gallery.html` in the dev server (`npx vite`, then `/gallery.html`) to see every piece, both palettes,
greyscale, reduced motion and every sound. Screenshots live in `docs/screenshots/kit-*.png`.

## Setup

```ts
import './styles/index.css';          // tokens.css + base.css + kit.css (from src/ui)
import { synth } from './audio/synth';
synth.init();                         // AudioContext is created on the first pointer/key/touch
```

Root switches (set on `<html>`):

| Attribute | Effect |
|---|---|
| `data-palette="cb"` | Okabe-Ito colour-blind palette. Also works on any container. `data-palette="default"` forces the default inside a CB root. |
| `data-motion="reduced"` | Reduced motion (18.1 fallbacks). Without the attribute the OS `prefers-reduced-motion` is followed; `data-motion="full"` forces full motion. |
| `data-gray="1"` | `filter: grayscale(1)` on the root (the `?gray=1` switch, 19). |

## Conventions

- **Sizing.** `--u` is one reference pixel of the 1280x720 canvas: `min(100vw / 1280, 100vh / 720)`. It is a
  length, so write `calc(var(--u) * 130)`. Cards use `--cu` (card unit, defaults to `--u`); set
  `style="--cu: calc(var(--u) * 1.4)"` or the classes `card-face--large` / `card-face--mini` to scale one.
- **Colour binding.** Any element with `data-light="love"` gets `--c` (and `data-light2` gets `--c2`) plus
  `--on-c`, the readable text colour on a `--c` fill. Any element with `data-face="anger"` gets `--cure`
  (the answering Light's colour; `data-face="none"` gives the numb grey). Kit components colour themselves
  only through these, so the colour-blind palette just works.
- **Markup first.** Every renderer has a `...Markup(props): string` (pure, testable in Node) and most have a
  `render...(props)` element variant built with a `<template>`. Markup is trusted kit output; user text is
  escaped by the kit.
- **Animation.** HTML animates only transform and opacity (18.3). Every animation name goes through a
  `--a-*` variable in `tokens.css`; reduced motion swaps those names for fades or `none`. Add `is-hitstop`
  to an ancestor for 60 ms (OPPOSITE) or 110 ms (Resolve) to pause stage animations.
- **Numbers** use tabular figures (`.num` or the component classes).
- **IDs.** SVG defs use `uniqueId()` (format `prefix + counter + '_'`), so any number of Shades and Compasses
  can share a document.

## Files

| File | What |
|---|---|
| `styles/tokens.css` | all 16.0 tokens, palettes, fonts, focus ring, `--u`, spacing, motion switches, reduced motion |
| `styles/base.css` | reset, ink-gradient body, `.btn`, `.panel`, `.tooltip`, `.chip`, `.bar`, `.scroll`, `.kbd`, `.sr-only` |
| `styles/kit.css` | imports `kit-motion.css` (keyframes), `kit-sigil.css`, `kit-card.css`, `kit-shade.css`, `kit-compass.css`, `kit-hud.css` |
| `styles/index.css` | tokens + base + kit in order |
| `kit/sigils.ts` | all sigils and icons |
| `kit/shadeArt.ts` | Shade silhouette renderer and reactions (`shadeFamilies.ts` generators, `shadeGeometry.ts` helpers) |
| `kit/cardFace.ts` | card faces |
| `kit/compass.ts` | Compass HUD |
| `kit/widgets.ts` | chips, bars, Guard, intent pills, floating numbers, banners, nameplate, tooltip |
| `kit/names.ts` | display names and palette hex values |
| `kit/hash.ts`, `kit/svg.ts` | seeded hash, markup helpers |
| `kit/index.ts` | barrel: `import { sigil, renderShade, ... } from './kit'` |
| `audio/synth.ts` | WebAudio synth API (`voices.ts` building blocks, `notes.ts` pitch and timbre tables) |

## Sigils and icons (`sigils.ts`)

All return an `<svg>` string on a 24-unit grid drawn in `currentColor`. Default size is 1em (`.sigil`).

```ts
interface IconOpts { size?: number | string; title?: string; className?: string; tint?: boolean }
sigil(name: SigilName, o?): string          // Light | Shade | 'numb' | 'doubt' | 'neutral'
sigilBody(name: SigilName): string          // inner markup only, for composing into your own SVG
intentIcon(kind: IntentKind, o?): string    // strike starburst, guard shield, afflict drop, buff notched
                                            // triangle, mend cross-in-drop, summon, scatter
nodeIcon(kind: NodeIconName, o?): string    // fight, elite, haven, sanctuary, memory, chest, boss
resourceIcon(kind: ResourceIconName, o?)    // heart, spirit, guard, glimmer
markIcon(name: MarkIconName, o?): string    // chevronUp2, chevronDown, ringDouble, ringSingle, triUp,
                                            // triDown, sunburst, seal, brokenHeart, turn, lock, harmony,
                                            // promise, fade, moth, hare, dog, deck, draw, discard, codex,
                                            // settings, log, undo, sound, mute, close, inward
markBody(name: MarkIconName): string
keepsakeIcon(hint: string | undefined, o?)  // KeepsakeDef.icon hint; unknown hints get a default charm
numbBadge(o?): string                        // grey oval labelled NUMB (Apathy, The Numbness)
iconElement(markup): SVGSVGElement
ICON_NAMES, KEEPSAKE_HINTS                   // every name per family
```

- `title` makes the icon `role="img"` with that label; without it icons are `aria-hidden`.
- `tint: true` colours a Light sigil with its Light (and the numb oval grey).
- Keepsake hints drawn: compass, locket, sun, bracelet, pebble, fork, flower, umbrella, tea, socks, prism,
  journal, lantern, mat, crane, diary, teacup, shell, box, mirror, key, rod.
- CSS helpers: `.shade-disc` (ink disc with a cure-colour rim; put `data-face` on it), `.map-node`
  (56px node shell; `data-kind` = node kind, `data-state` = `reachable | visited | unreachable`, holds a
  `nodeIcon` or a `.map-node__sigils` row with `.joiner` bars for compounds).

## Shade silhouettes (`shadeArt.ts`)

```ts
type ShadeFamily = Shade | 'doubt' | 'mask' | 'numb';
interface ShadeArtOpts {
  family: ShadeFamily;             // EnemyDef.visual.family
  seed: number;                    // use the uid; same seed, same Shade
  face: Shade | null;              // showing face; null for Apathy and The Numbness
  innerFace?: Shade | null;        // compounds: inner face (badge lights while it shows)
  nextFace?: Shade | null;         // The Mask: forehead sigil
  flare?: number;                  // look grows to 5 (4% per stack, family looks)
  size?: number | string;          // rendered height, default calc(var(--u) * 200)
  scale?: number;                  // EnemyDef.visual.scale, 0.45..1.15 (Doubt ~0.6, The Looming ~1.15)
  feltCracks?: [Light, Light][];   // numb family: lasting two-colour cracks from FELT hits
  slouched?: boolean;              // Apathy's smaller slouched oval
  shimmer?: boolean;               // Anger heat shimmer; pass false with 2+ Anger Shades on screen
  label?: string;                  // accessible name, e.g. "Grumble, Anger"
  className?: string;
}
shadeMarkup(o): string
renderShade(o): SVGSVGElement
setShadeFace(svg, face, nextFace?)       // turn without re-rendering: cracks, badge, Mask crossfade
setShadeFlare(svg, flare)                // CSS-driven Flare look (growth, Mask cracks); re-render for geometry
setShadeReaction(svg, r | null)          // 'flinch' | 'swell' | 'hit' | 'resolving' | 'deepResolving' | 'suppressed'
resolvedFormMarkup(light, { size?, className? })   // the light form a Shade becomes (reward tiles)
```

- The frame is a fixed 200x210 viewBox with the ground at y 196, so every family lines up in a slot.
- Families: Anger (hunched, 5 to 9 spike crown, breathing, heat shimmer), Sadness (raincloud hood, long
  arms, sway, tears), Loneliness (small figure in a wide empty ring, drift, glances, one green point), Fear
  (spindly legs, 3 to 7 eyes, 12 Hz shiver, blinks; Flare opens more eyes), Despair (figure sinking into a
  pit, inward particles, violet glint; Flare widens the pit), Anxiety (scribble mass with small arms,
  vibration, redraws; Flare thickens the tangle), Doubt (question-mark wisp, bob, ember), The Mask (hood +
  mask showing its face sigil, next face on the forehead, slow rotation, cracks spread with Flare), numb
  (smooth grey oval, still, faint static).
- Hover reactions are extra feedback only: `flinch` for an OPPOSITE card (6px back), `swell` for a
  DISSONANT card (3% and brighter). Clear with `setShadeReaction(svg, null)`.
- `resolving` (about 1.1 s: hit-stop gap, bloom, ink dissolves outward from the cracks, the light form
  rises) and `suppressed` (about 0.9 s: crushed to 10% height, ink seal) end with the Shade hidden; remove
  the element afterwards. `deepResolving` also raises the inner face's form.
- The Mask: all six face sigils are in the SVG; `setShadeFace` crossfades them.
- Slot layout: `.shade-slot` (205px grid: intent, silhouette, nameplate) with `.shade-slot__intent`,
  `.shade-slot__art`, `.shade-slot__feet` (Promise and Wavering chips), `data-focused="true"` for the
  keyboard target, `.is-striking` (lunge; set `--lunge-x`) and `.is-shaking`.

## Card faces (`cardFace.ts`)

```ts
interface CardFaceProps {
  name: string; lights: Light[]; cost: number | null;
  costState?: 'normal' | 'raised' | 'lowered' | 'unaffordable';
  kindLabel: string;                    // 'Ease' | 'Skill' | 'Mood' | 'Buried' | 'Insight'
  text: string;                         // engine cardText / describeCard; the kit bolds every number
  rarity: Rarity; upgraded?: boolean;
  buried?: { weight: number; shade: Shade };
  insight?: boolean;
  chips?: string[];                     // handHints chips, max 2 shown
  state?: 'idle' | 'playable' | 'selected' | 'unaffordable' | 'numbed';
  footer?: string;                      // default "LOVE · EASE"; numbed shows "NO LIGHT"
  numberTrends?: ('up' | 'down' | null)[];   // triangle after the Nth number (contextual numbers)
  tag?: 'div' | 'button'; ariaLabel?: string; className?: string; seed?: number;
}
cardFaceMarkup(p): string
renderCardFace(p): HTMLElement
fitCardNames(root)                      // after mounting: shrink names that still overflow on this font
formatCardText(text, trends?): string   // escape, bold numbers, mark keywords
defaultFooter(p): string
cardChipMarkup(chip): string            // styles "HARMONY -> Delight", "Tends Buried Fear", "Soothes Heavy"
```

- 130x182 reference: frame per Light with its pattern (dots, rays, chain links, chevrons, stars, waves),
  Blend diagonal split, cost gem (30px pearl, 18px number; raised/lowered tick, unaffordable outline),
  sigil badge, name plate, art band with a seeded motif of the sigil, rules text, footer with a rarity pip.
- Buried: ink body, cracked border in the cure colour (pulsing), Weight pips instead of a gem, rising wisps.
- Insight: pearl frame with the six-hue sheen and an INSIGHT label (no gold).
- States: `playable` soft pearl glow, `selected` lifted 40px at 1.15x with a bright outline, `unaffordable`
  60% brightness, `numbed` grey with NO LIGHT. Classes for the hand: `.is-hover` (lift 28px, 1.12x; tilt
  via `--tilt-deg`, zeroed in reduced motion), `.is-playing` (fly to `--fly-x`/`--fly-y`), `.is-dealing`,
  `.is-tending`.
- Long names and rules texts step down in size so every 6.x card fits (see deviations in the report).
- Chips sit above the card (`position: absolute; bottom: 100%`); leave room in the hand.

## Compass HUD (`compass.ts`)

```ts
interface CompassProps {
  enabled: boolean; note: Light[]; harmoniesThisTurn: number;
  energy: number; maxEnergy: number; hollow: boolean; isolated: boolean;
  act2Unlocked: boolean; ownedLights: Light[]; activeShades: Shade[];
  glowEdges?: [Light, Light][];      // a two-faced Shade in the fight makes its Blend edge glow
  harmonyArc?: [Light, Light] | null;// draw the 250 ms arc from the old Note to the new one
  granting?: boolean;                // ring grows out of the orb (1.2 s)
  wheelCloses?: boolean;             // Hope and Calm ignite (1.5 s)
  size?: number | string;            // width, default calc(var(--u) * 200)
}
compassMarkup(p): string
renderCompass(p): HTMLElement        // <div class="compass-hud"> with the SVG and the Harmonies label
```

Segment states (`data-state`): `note`, `next` (pulsing neighbour with a chevron), `owned`, `dim` (no cards
of that Light), `locked` (Act 1 Hope and Calm, "Awakens in Act 2"). Outer markers light while that Shade
shows in the fight; grey arrows show the DISSONANT rule; every piece has a `<title>` tooltip. Add
`is-fog-clearing` to blow the Isolated fog away and `is-harmony` to pop the HARMONY label.

## HUD pieces (`widgets.ts`)

```ts
statusChipMarkup({ label, value?, kind: 'affliction'|'buff'|'debuff'|'gauge'|'flag', affliction?, icon?, title? })
chipRowMarkup(chips, max = 3)                  // collapses to "+N" (expands on hover/focus)
afflictionDrop(id, { size? })                  // ink drop, cure rim, Shade sigil
matchupChipMarkup({ kind: 'opposite'|'dissonant'|'felt'|'muffled', light?, title? })
defaultMatchups(face, badAdvice?)              // 16.2 chips and tooltips for a face (or FELT/MUFFLED)
barMarkup({ kind: 'heart'|'intensity', value, max, previewLoss?, previewGain?, lethal?, width?, label? })
setBarValue(barEl, value, max, label?)         // fill drops now, lag chunk drains after 400 ms (CSS)
guardBadgeMarkup(guard, { after? })            // silver shield with the number
guardBubbleMarkup({ state?: 'idle'|'crack'|'shatter', size? })   // player's hexagon bubble, 6 shards
intentPillMarkup({ items: IntentItem[], order?, projected?, title? })
floatingNumberMarkup({ kind, value, lights?, line? })   // opposite | neutral | dissonant | felt | muffled
                                                         // | blocked | mend | loss
spawnFloatingNumber(container, props, x, y)    // positioned child, removes itself after its animation
lethalBannerMarkup({ kind: 'resolve'|'deepResolve'|'suppress'|'fade'|'wavering', lights?, sub?, resolveWith? })
nameplateMarkup({ face, name, beneath?, nextFace?, hp, maxHp, guard, previewLoss?, matchups, chips })
tooltipMarkup({ title?, lines, arrow? })
soothingLight(affliction), widgetElement(markup)
```

- `IntentItem = { kind, value?, count?, affliction?, stacks? }`; a strike with `count > 1` reads "3x4".
  `projected` adds the "after end of turn" tag; put `IntentView.text` and `projectedReason` in `title`.
  Add `.is-flipping` to the pill for the Flare odometer flip.
- Floating numbers centre on (x, y) and rise 40px (DISSONANT sinks 12px and shows the bad-advice line).
- Screen-level juice classes: `.vignette` (`.is-hit`, `.is-low-heart`), `.bloom`, `.inward-ring`,
  `.is-shake-h` (`--shake-amp`), `.is-shake-v`, `.is-breathing`, `.is-hitstop`.

## Audio (`audio/synth.ts`)

```ts
import { synth, createSynth } from './audio/synth';
synth.init()                        // gesture listeners; context created on first pointer/key/touch
synth.unlock()                      // create/resume now (call inside a gesture handler)
synth.ready                         // true once the graph exists
synth.setVolume(bus, v)             // bus: 'master' | 'sfx' | 'ui' | 'ambience', v 0..1 (remembered early)
synth.getVolume(bus); synth.setMuted(b); synth.muted
synth.light(lights, relation?)      // Light voice shaped by 'opposite' | 'dissonant' | 'felt' | 'muffled'
                                    // | 'neutral' | 'veiled'; pass both Lights for FELT
synth.harmony(lights)               // chain within 3 s keeps adding notes; synth.resetHarmony()
synth.resolve(lights, deep?)        // arpeggio (+ both roots when deep) and shimmer
synth.suppress(); synth.inward(light); synth.strike(face | 'numb')
synth.ui('hover' | 'play' | 'spirit' | 'notEnough' | 'glimmer' | 'confirm' | 'cancel')
synth.glimmers(count)               // count-up ticks, max 12
synth.ambience(1 | 2 | 'deep' | null); synth.ambienceBrighten()   // one notch per Resolve
synth.wheelCloses(); synth.heartbeat(); synth.dispose()
createSynth({ AudioContext?, gestureTarget? })   // tests inject a fake context
```

Lights are pentatonic in wheel order (Love C5, Joy D5, Friendship E5, Courage G5, Hope A5, Calm C6). Every
method is a no-op before the first gesture or without WebAudio, and never throws.
