# Heartward UI kit

Visual and audio building blocks for the screens (DESIGN 16, 16.7, 18, 19). Vanilla TypeScript, inline SVG,
no framework, no external assets, system fonts only. The kit never computes game rules: every number,
sentence and state comes in through props from the engine (`preview`, `intents`, `handHints`, `cardText`,
`nodeDetail`).

Open `gallery.html` in the dev server (`npx vite`, then `/gallery.html`) to see every piece and state, both
palettes, greyscale, reduced motion and every sound. `?palette=cb`, `?gray=1` and `?motion=reduced` set the
switches from the URL. Screenshots of each gallery section are saved as `docs/screenshots/kit-*.png`
(that folder is gitignored scratch space; regenerate them from the gallery).

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
| `data-motion="reduced"` | Reduced motion (18.1 fallbacks). Without the attribute the OS `prefers-reduced-motion` is followed; `data-motion="full"` forces full motion (the Settings switch). |
| `data-gray="1"` | `filter: grayscale(1)` on the root (the `?gray=1` switch, 19). |

## Conventions (read these first)

- **Seed = the Shade's uid.** Pass `seed: shade.uid` to `shadeMarkup`/`renderShade`. Art varies only by a
  UI-side hash of the seed (one seeded stream per feature), never by the engine RNG and never by
  `Math.random`, so a Shade keeps its cracks, body and idle timing as it Flares 0 to 5.
- **Heat shimmer.** Pass `shimmer: false` to every Anger Shade when two or more Anger Shades are on screen
  (18.3: the shimmer is the one animated SVG filter allowed).
- **No hit-stop under reduced motion.** Use `hitStop(el, ms)` (60 ms OPPOSITE, 110 ms Resolve). It does
  nothing under reduced motion and also pauses the SVG shimmer. If you add `is-hitstop` yourself, don't add
  it under reduced motion; the CSS ignores it there anyway.
- **`fitCards` after mount.** Card markup picks a layout from a width estimate; call `fitCards(container)`
  once after a hand, grid or reward row is in the document (and again after the font or scale changes). It
  wraps names that still overflow and moves text to a roomier tier. It reads layout, so call it once per
  mount, not per frame.
- **Aria labels from engine text.** Components speak the strings you pass: `IntentPillProps.title`
  (`IntentView.text` plus the projected cause), chip and meter tooltips, card `ariaLabel` (build it from
  `describeCard` and the target preview), map node `label` (node detail). Tooltip sentences are reachable by
  hover, focus and tap (`.has-tip[data-tip]`, `tabindex="0"`) and are also screen-reader text. There is no
  bare `title` tooltip anywhere. Lethal banners are not live regions: only the Play Line (`aria-live`) should
  announce the focused target.
- **IDs differ between calls.** SVG defs use `uniqueId()` from a global counter (`prefix + counter + '_'`),
  so any number of Shades and Compasses share a document, but two markup strings for the same props are not
  byte-identical. Compare markup with the ids stripped (`/sa\d+_/g`, `/wd\d+_/g`, ...).
- **Tap size.** Every tappable element is at least 56 reference px (`--tap`). `.btn--small` looks 40px tall
  but carries an invisible 8px hit-area extension on every side; keep 16 reference px between small buttons.
- **Sizing.** `--u` is one reference pixel of the 1280x720 canvas: `min(100vw / 1280, 100vh / 720)`. It is
  a length, so write `calc(var(--u) * 130)`. Cards use `--cu` (card unit, defaults to `--u`); set
  `style="--cu: calc(var(--u) * 1.4)"` or use `card-face--large` / `card-face--mini`. Nothing in the kit
  sets text below 12 reference px except the 10px caps card footer (16.2).
- **Colour binding.** Any element with `data-light="love"` gets `--c` (and `data-light2` gets `--c2`) plus
  `--on-c`, the readable text colour on a `--c` fill. Any element with `data-face="anger"` gets `--cure`
  (the answering Light's colour; `data-face="none"` gives the numb grey). Kit components colour themselves
  only through these, so the colour-blind palette just works. Saturated hue always means a Light: Shades,
  rims, bars and the Wanderer are neutral; two Lights are always a hard split, never a blend.
- **Markup first.** Every renderer has a pure `...Markup(props): string` (testable in Node) and most have a
  `render...(props)` element variant. Markup is trusted kit output; text you pass is escaped by the kit.
- **Animation.** HTML animates only transform and opacity (18.3). Every animation name goes through a
  `--a-*` variable in `tokens.css`; reduced motion swaps those names for fades or `none`.
- **Numbers** use tabular figures (`.num` or the component classes).

## Files

| File | What |
|---|---|
| `styles/tokens.css` | all 16.0 tokens, palettes, fonts, focus ring, `--u`, `--tap`, spacing, motion switches, reduced motion |
| `styles/base.css` | reset, ink-gradient body, `.btn`, `.panel`, `.tooltip`, `.has-tip`, `.chip`, `.bar`, `.scroll`, `.kbd`, `.caps`, `.sr-only` |
| `styles/kit.css` | imports `kit-motion`, `kit-sigil`, `kit-card`, `kit-shade`, `kit-compass`, `kit-hud`, `kit-player`, `kit-run` |
| `styles/index.css` | tokens + base + kit in order |
| `kit/sigils.ts` | all sigils and icons |
| `kit/shadeArt.ts` | Shade renderer and reactions (`shadeFamilies.ts` generators, `shadeGeometry.ts` helpers, `shadeOrnaments.ts` elite and boss dressing) |
| `kit/cardFace.ts`, `kit/cardFit.ts` | card faces and their text fitting |
| `kit/compass.ts` | Compass HUD |
| `kit/widgets.ts` | chips, bars, Guard, intent pills, floating numbers, banners, nameplate, tooltip |
| `kit/player.ts` | the Wanderer, INWARD target, Companion slots, Promise tray, incoming line |
| `kit/callouts.ts` | barks, coach marks, Promise and Wavering chips at a Shade's feet |
| `kit/runHud.ts` | Numbness meter, Light Mix bar, map nodes, edges and legend |
| `kit/thread.ts` | the thread of light between a Light card and a Buried card |
| `kit/motion.ts` | reduced-motion detection and hit-stop |
| `kit/names.ts` | display names and palette hex values |
| `kit/hash.ts`, `kit/svg.ts` | seeded hash, markup helpers |
| `kit/index.ts` | barrel: `import { sigil, renderShade, ... } from './kit'` |
| `audio/synth.ts` | WebAudio synth API (`voices.ts` building blocks, `notes.ts` pitch and timbre tables) |

## Sigils and icons (`sigils.ts`)

All return an `<svg>` string on a 24-unit grid drawn in `currentColor`. Default size is 1em (`.sigil`).

```ts
interface IconOpts { size?: number | string; title?: string; className?: string; tint?: boolean }
type SigilName = Light | Shade | 'numb' | 'doubt' | 'neutral'
sigil(name: SigilName, o?: IconOpts): string
sigilBody(name: SigilName): string          // inner markup only, for composing into your own SVG
intentIcon(kind: IntentKind, o?): string    // strike starburst, guard shield, afflict drop, buff notched
                                            // triangle, mend cross-in-drop, summon, scatter
nodeIcon(kind: NodeIconName, o?): string    // 'fight' | 'elite' | 'haven' | 'sanctuary' | 'memory' | 'chest' | 'boss'
resourceIcon(kind: ResourceIconName, o?)    // 'heart' | 'spirit' | 'guard' | 'glimmer'
markIcon(name: MarkIconName, o?): string    // chevronUp2, chevronDown, ringDouble, ringSingle, triUp,
                                            // triDown, sunburst, seal, brokenHeart, turn, lock, harmony,
                                            // promise, fade, moth, hare, dog, deck, draw, discard, codex,
                                            // settings, log, undo, sound, mute, close, inward
markBody(name: MarkIconName): string
keepsakeIcon(hint: string | undefined, o?)  // KeepsakeDef.icon hint; unknown hints get a default charm
numbBadge(o?): string                        // grey oval labelled NUMB; render it 24px+ tall for 12px text
iconElement(markup: string): SVGSVGElement
ICON_NAMES                                   // { lights, shades, extras, intents, nodes, resources, marks, keepsakes }
KEEPSAKE_HINTS: readonly string[]
```

- `title` makes the icon `role="img"` with that label; without it icons are `aria-hidden`.
- `tint: true` colours a Light sigil with its Light (and the numb oval grey).
- Keepsake hints drawn: compass, locket, sun, bracelet, pebble, fork, flower, umbrella, tea, socks, prism,
  journal, lantern, mat, crane, diary, teacup, shell, box, mirror, key, rod.
- `.shade-disc` (CSS): ink disc with a cure-colour rim; put `data-face` on it.

## Shade silhouettes (`shadeArt.ts`, `shadeOrnaments.ts`)

```ts
type ShadeFamily = Shade | 'doubt' | 'mask' | 'numb';
interface ShadeArtOpts {
  family: ShadeFamily;             // EnemyDef.visual.family
  seed: number;                    // the Shade's uid
  face: Shade | null;              // showing face; null for Apathy and The Numbness
  innerFace?: Shade | null;        // compounds: the inner face (badge lights, expression follows)
  nextFace?: Shade | null;         // The Mask: forehead sigil, dashed disc in its crown
  flare?: number;                  // look grows to 5 (4% per stack, family looks)
  size?: number | string;          // rendered height, default calc(var(--u) * 200)
  scale?: number;                  // EnemyDef.visual.scale, clamped to SHADE_SCALE (0.45..1.35)
  ornament?: ShadeOrnament | null; // ornamentFor(def.id)
  gauge?: number;                  // The Spiral: Coil rings 0..6 (default 2); The Numbness: veil 0..3 (default 1)
  faces?: readonly Shade[];        // The Mask: EnemyDef.faces for its crown (default the four content faces)
  feltCracks?: [Light, Light][];   // numb family: lasting two-colour cracks from FELT hits, oldest first
  slouched?: boolean;              // Apathy's smaller slouched oval
  shimmer?: boolean;               // Anger heat shimmer; false with 2+ Anger Shades on screen
  label?: string;                  // accessible name, e.g. "Grumble, Anger"
  className?: string;
}
shadeMarkup(o: ShadeArtOpts): string
renderShade(o: ShadeArtOpts): SVGSVGElement
setShadeFace(svg, face: Shade, nextFace?: Shade | null)   // turn without re-rendering
setShadeFlare(svg, flare: number)                          // CSS-driven Flare look; re-render for geometry
setShadeGauge(svg, gauge: number)                          // Spiral coils or Numbness veil
setShadeReaction(svg, r: ShadeReaction | null)             // 'flinch' | 'swell' | 'hit' | 'resolving'
                                                           // | 'deepResolving' | 'suppressed'
resolvedFormMarkup(light: Light, { size?, className? }): string   // the light form (reward tiles)
SHADE_SCALE = { min: 0.45, max: 1.35 }

type ShadeOrnament = 'kettle' | 'knot' | 'spiral' | 'looming' | 'mask' | 'apathy' | 'numbness'
ORNAMENT_OF: Record<EnemyId, ShadeOrnament>   // shade.kettle, shade.knot, shade.spiral, shade.looming,
                                              // shade.mask, shade.apathy, shade.numbness
ornamentFor(enemyId: EnemyId): ShadeOrnament | null
MAX_COILS = 6; MAX_VEIL = 3; MASK_FACES
ornamentLayers(kind, parts, rand, ctx?): OrnamentLayers   // used by shadeMarkup
```

- The frame is a fixed 200x210 viewBox with the ground at y 196, so every family lines up in a slot. The
  body scales from the ground, so above scale 1 (and with Flare growth) it rises past the top of the frame;
  the SVG overflows visibly. Content bosses at 1.4 to 1.6 draw at 1.35. Give a lone boss the
  `.shade-slot--tall` slot (290 reference px of art) so it doesn't cover the row above.
- Families: Anger (hunched, 5 to 9 spike crown, breathing, heat shimmer), Sadness (raincloud hood drooping
  over the face, long arms, sway, tears, rain from the hem), Loneliness (small figure in a wide empty ring,
  drift, glances, one green point), Fear (a scared fur ball on spindly ink legs, 3 to 7 eyes with pinprick
  pupils, 12 Hz shiver, blinks; Flare opens more eyes), Despair (figure sinking into a pit, inward
  particles, violet glint; Flare widens the pit), Anxiety (self-crossing scribbled outline, hands clutching
  each other, vibration, redraws), Doubt (question-mark wisp, bob, ember), The Mask (ink cowl, a mask with
  its own expression per face, the face sigil on the cheek, next face on the forehead, fissures spread with
  Flare), numb (smooth grey oval, still, faint static).
- Compounds: the expression follows the showing face; the inner-face badge sits on the body, a dashed
  outline while dim and a filled disc while lit (reads in greyscale).
- Ornaments: The Kettle (lid and steam), The Knot (cinched yarn knot), The Spiral (Coil rings and a spiral
  in the pit), The Looming (tall shadow with eyes), The Mask (crown of its faces: showing one lit, next one
  dashed), Apathy (melting into a puddle, a flat sigh), The Numbness (a grey shroud whose layers follow
  `gauge`, one per Surfaced Shade standing, and still-water ripples).
- Hover reactions are extra feedback only: `flinch` for an OPPOSITE card (6px back), `swell` for a
  DISSONANT card (3% and brighter). Clear with `setShadeReaction(svg, null)`.
- `resolving` (about 1.1 s: cracks flare 0 to 150 ms, ink dissolves outward along the cracks, a 50px light
  form rises, holds about 300 ms and flies up), `deepResolving` (also the inner face's form) and
  `suppressed` (about 0.9 s: crushed to 10% height, ink seal) end with the Shade hidden; remove the element
  afterwards.
- Slot layout: `.shade-slot` (205px grid: intent, silhouette, nameplate; the intent pill always stays above
  the art) with `.shade-slot__intent`, `.shade-slot__art` (lit floor pool and back-glow),
  `.shade-slot__feet` (Promise and Wavering chips), `.shade-slot--tall`, `data-focused="true"` for the
  keyboard target, `data-targetable="true"`, `.is-striking` (lunge; set `--lunge-x`) and `.is-shaking`.

## Card faces (`cardFace.ts`, `cardFit.ts`)

```ts
interface CardFaceProps {
  name: string; lights: Light[]; cost: number | null;
  costState?: 'normal' | 'raised' | 'lowered' | 'unaffordable';
  kindLabel: string;                    // 'Ease' | 'Skill' | 'Mood' | 'Buried' | 'Insight'
  text: string;                         // engine cardText / describeCard; the kit bolds every number
  rarity: Rarity; upgraded?: boolean;
  buried?: { weight: number; shade: Shade };
  insight?: boolean;
  chips?: string[];                     // handHints chips, max 2 shown (engine priority order)
  state?: 'idle' | 'playable' | 'selected' | 'unaffordable' | 'numbed';
  footer?: string;                      // default "LOVE · EASE"; numbed shows "NO LIGHT"
  numberTrends?: ('up' | 'down' | null)[];   // triangle after the Nth number (contextual numbers)
  tag?: 'div' | 'button'; ariaLabel?: string; className?: string; seed?: number;
}
cardFaceMarkup(p: CardFaceProps): string
renderCardFace(p: CardFaceProps): HTMLElement
fitCards(root: ParentNode): void        // after mounting (fitCardNames is the same function)
formatCardText(text: string, trends?): string   // escape, bold numbers, mark keywords
defaultFooter(p): string                // "LOVE · EASE", "DELIGHT", "NEUTRAL · SKILL", "BURIED · FEAR", "CALM · INSIGHT"
cardChipMarkup(chip: string): string    // styles "HARMONY -> Delight", "Tends Buried Fear", "Soothes Heavy"

// cardFit.ts: the fitting model (widths from DejaVu Sans, the widest common fallback)
fitCard(name: string, text: string): CardFit       // { tier, name: { size, lines }, lines, fits }
nameLayout(name: string): NameLayout               // 14 -> 13 -> 12px on one line, else 12px on two
textLines(text, tier, width?): number; textBoxHeight(tier, nameLines): number
textWidth(s, px, bold?, letterSpacingEm?): number; footerFits(footer, px?, spacing?): boolean
TIERS (art 70 / 56 / 40 / 26px), TEXT_FLOOR = 12, NAME_SIZES, TEXT_W, NAME_W, FOOTER_W
CARD_KEYWORDS, CARD_KEYWORD_RE
```

- 130x182 reference: frame per Light with its pattern (dots, rays, chain links, chevrons, stars, waves),
  Blend diagonal split, cost gem (30px pearl, 18px number; raised/lowered tick, unaffordable outline),
  sigil badge, name plate, art band with a seeded motif, rules text, footer with a rarity pip.
- Text never drops below 12px: long rules texts give up art-band height (70 -> 56 -> 40 -> 26px) and long
  names wrap to two lines at 12px; nothing is ellipsised or line-clamped. Every card in the content pack,
  upgraded or not, fits (tested). A Blend footer is its Blend's name (every Blend is an Ease card); other
  footers drop the kind word when it doesn't fit.
- Buried: ink body, cracks in the cure colour kept to a 10px border band (pulsing), Weight pips plus a
  "W2" label, rising wisps; the default label says "Weight 2, unplayable".
- Insight: a turning six-hue border (static under reduced motion), a prism mark and the INSIGHT label (no
  gold). Selected is different: lifted 40px at 1.15x with a glow in the card's own Light.
- Chips sit above the card, compact (icon and one word, never wider than the card); the hovered, focused
  or selected card shows the full sentence. Put `.card-chips--icons` on a crowded hand (cards overlapping,
  pitch below about 110 reference px) to collapse chips to icons. Chips are aria-hidden; the default
  `ariaLabel` speaks them ("Tends Buried Anger. Harmony: Delight.").
- Hand classes: `.is-hover` (lift 28px, 1.12x; tilt via `--tilt-deg`, zeroed in reduced motion),
  `.is-playing` (fly to `--fly-x`/`--fly-y`), `.is-dealing`, `.is-tending`.
- `card-face--mini` (piles, reward tiles) shows only the gem, badge and name.

## Compass HUD (`compass.ts`)

```ts
interface CompassProps {
  enabled: boolean; note: Light[]; harmoniesThisTurn: number;
  energy: number; maxEnergy: number; hollow: boolean;
  isolated: boolean; isolatedStacks?: number;     // label "Isolated 2: no Harmony" under the ring
  act2Unlocked: boolean; ownedLights: Light[]; activeShades: Shade[];
  glowEdges?: [Light, Light][];      // a two-faced Shade in the fight makes its Blend edge glow
  harmonyArc?: [Light, Light] | null;// draw the 250 ms arc from the old Note to the new one
  granting?: boolean;                // ring grows out of the orb (1.2 s)
  wheelCloses?: boolean;             // Hope and Calm ignite (1.5 s)
  size?: number | string;            // width, default calc(var(--u) * 200)
}
compassMarkup(p: CompassProps): string
renderCompass(p: CompassProps): HTMLElement   // <div class="compass-hud"> with the SVG and the Harmonies label
```

Segment states (`data-state`): `note`, `next` (pulsing neighbour with a chevron), `owned`, `dim` (no cards
of that Light: dashed outline), `locked` (Act 1 Hope and Calm, "Awakens in Act 2"). At 0 Spirit the orb
turns ink with a pearl outline and a full-pearl number; Hollow's crack stays on the rim. Outer markers
light while that Shade shows in the fight; grey arrows show the DISSONANT rule; every piece has a `<title>`
tooltip. Add `is-fog-clearing` to blow the Isolated fog away and `is-harmony` to pop the HARMONY label.

## HUD pieces (`widgets.ts`)

```ts
statusChipMarkup({ label, value?, kind: 'affliction'|'buff'|'debuff'|'gauge'|'flag', affliction?, icon?, title? })
chipRowMarkup(chips, max = 3)                  // collapses to "+N" (expands on hover and focus)
afflictionDrop(id: AfflictionId | 'numb', { size? })   // ink drop, cure rim, Shade sigil
matchupChipMarkup({ kind: 'opposite'|'dissonant'|'felt'|'muffled', light?, title? })
defaultMatchups(face: Shade | null, badAdviceLine?: string)   // cure x2 and the wheel's DISSONANT Light x1/2
                                                               // (FELT/MUFFLED for null), with 16.2 tooltips
barMarkup({ kind: 'heart'|'intensity', value, max, previewLoss?, previewGain?, lethal?, width?, label? })
setBarValue(barEl, value, max, label?)         // fill drops now, lag chunk drains after 400 ms (CSS)
guardBadgeMarkup(guard, { after?, reserve?, title? })   // reserve keeps an empty slot at 0
guardBubbleMarkup({ state?: 'idle'|'crack'|'shatter', size? })   // player's hexagon bubble, 6 shards
intentPillMarkup({ items: IntentItem[], order?, projected?, title?, label? })
floatingNumberMarkup({ kind, value, lights?, line? })   // opposite | neutral | dissonant | felt | muffled
                                                         // | blocked | mend | loss
spawnFloatingNumber(container, props, x, y): HTMLElement // positioned child, removes itself afterwards
lethalBannerMarkup({ kind: 'resolve'|'deepResolve'|'suppress'|'fade'|'wavering', lights?, sub?, resolveWith? })
nameplateMarkup({ face, name, beneath?, nextFace?, hp, maxHp, guard, previewLoss?, matchups, chips })
tooltipMarkup({ title?, lines, arrow?: 'up'|'down' })
tipAttrs(tip?), tipText(tip?)                   // make your own element a reachable tooltip anchor
soothingLight(affliction): Light; widgetElement(markup)
```

- `IntentItem = { kind, value?, count?, affliction?, stacks? }`; a strike with `count > 1` reads "3x4".
  The pill is spoken as `label ?? title ?? a summary`, prefixed "Acts 2." and "After end of turn:". Put
  `IntentView.text` and the projected cause in `title`. `projected` adds the "after end of turn" tag; add
  `.is-flipping` for the Flare odometer flip.
- The nameplate keeps the Guard slot reserved left of the bar, stacks a long name on its own line (never
  ellipsised), drops a caps type word the name already contains ("Surfaced Loneliness") and always labels
  the grey oval NUMB.
- Floating numbers centre on (x, y) and rise 40px (DISSONANT sinks 12px and shows the bad-advice line).
  FELT is a hard two-tone split with both sigils.
- Screen-level juice classes: `.vignette` (`.is-hit`, `.is-low-heart`), `.bloom`, `.inward-ring`,
  `.is-shake-h` (`--shake-amp`), `.is-shake-v`, `.is-breathing`, `.is-hitstop` (prefer `hitStop`).

## Player side (`player.ts`)

```ts
wandererMarkup({ note: Light[], compass: boolean, size?, label?, className? }): string
renderWanderer(p): SVGSVGElement
WANDERER_HEART: [x, y]                       // heart point in the 160x180 viewBox (Inward plays land here)
wandererHeartPoint(svg): { x, y }            // that point in client px, for the Inward fly and the thread
inwardTargetMarkup({ preview: string, focused?, size?, tag?: 'div'|'button' }): string
companionSlotsMarkup({ slots: (CompanionSlot | null)[], isolated: boolean }): string
  // CompanionSlot = { icon: 'moth'|'hare'|'dog', name, value, action: 'ease'|'guard', title? }
promiseTrayMarkup(lines: string[]): string   // '' without Promises
incomingLineMarkup({ text: string, lethal?: boolean }): string   // "Lethal: you will fall" with a broken heart
```

- The Wanderer is neutral warm grey with a pearl face; only the lantern flame carries hue: the Note's Light,
  a hard split flame for two Lights, grey with an empty Note or before The Compass. Its light pools on the
  ground. `.is-hit` flickers it (18.1); pair it with the screen's vignette and shake.
- The INWARD target is a heart outline sized to go around the avatar, labelled INWARD, with the engine's
  preview hanging below its point ("->" is drawn as an arrow). Show it only when Inward is legal.
- Companion slots are 56px with the icon and action number (silver for Guard); Isolated greys them with
  "Isolated: won't act". The dotted line to the last target is the screen's to draw.

## Speech and guidance (`callouts.ts`)

```ts
barkMarkup({ text, tail?: 'down'|'up'|'left'|'right', farewell? }): string   // aria-hidden; the log announces lines
coachMarkMarkup({ text, arrow?: Tail, id? }): string    // pearl bubble, never blocks input, labelled close button
promiseChipMarkup({ text, lights?, title? }): string    // at a Shade's feet, rim split in the Promise's Lights
waveringChipMarkup({ title? }?): string                 // "Finish it yourself"
```

## Run HUD and map (`runHud.ts`)

```ts
numbnessMeterMarkup({ count, title? }): string   // grey oval, "The Numbness: N will surface" (N clamped 0..3)
lightMixMarkup({ segments: LightMixSegment[], ghost?: number, width?, button? }): string
  // LightMixSegment = { kind: 'light', light, count } | { kind: 'blend', lights: [a, b], count }
  //   | { kind: 'neutral', count } | { kind: 'insight', light, count } | { kind: 'buried', shade, count }
mapNodeMarkup({ kind: NodeIconName, state: 'reachable'|'visited'|'unreachable'|'current',
                shades?: (Shade | 'numb')[][], silhouette?, key?, label }): string
mapEdgesMarkup({ width, height, edges: { from, to, state: 'future'|'travelled'|'route' }[], inset? }): string
mapLegendMarkup(): string
```

- Light Mix: pass segments in wheel order, then Blends, neutral, Insight, Buried; zero counts are skipped.
  Blends are a hard diagonal split, Buried an ink segment with a cure rim, Insight pearl. `ghost` marks a
  segment index with "+1" (hovered reward card). `button: true` makes the bar one button that opens the
  deck view (its segments then show tips on hover only).
- Map nodes: fights and elites show one group of sigils per Shade (a compound's two faces joined by a bar,
  `'numb'` draws the NUMB oval), sized by how many share the circle; elites add the spiked double ring; a
  boss node (80px) can show `silhouette` (ShadeArtOpts subset) instead of its icon. Reachable nodes pulse
  and show `key`; unreachable ones are disabled at 40%.
- Edges are one SVG covering the map container: future dotted, travelled solid, the hovered route bright.

## Thread of light (`thread.ts`)

```ts
threadMarkup({ from: [x, y], to: [x, y], light: Light, lift? }): string   // absolutely positioned SVG
renderThread(p): SVGSVGElement
```

Measure the selected Light card and the Buried card it can Tend in the coordinates of a positioned
container (for example `rect.left - container.left`), pass both points and append the result to that
container. The curve bows upward by `lift` (default 60px) and carries a slow flow of light.

## Motion (`motion.ts`)

```ts
prefersReducedMotion(root?: Element | null): boolean   // data-motion on <html>, else the OS setting
hitStop(el: Element, ms: number): () => void            // no-op under reduced motion; returns an early end
```

## Helpers

```ts
LIGHT_NAME, SHADE_NAME, BLEND_NAME, AFFLICTION_NAME, LIGHT_HEX, lightVar(l)   // names.ts
hashSeed(...parts): number; rand(seed): Rand                                 // hash.ts
esc, attrs, toElement, svgElement, uniqueId, cssLen, n, polar                // svg.ts
```

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
synth.harmony(lights)               // chain within 3 s keeps adding notes; synth.resetHarmony() at end of turn
synth.resolve(lights, deep?)        // arpeggio (+ both roots when deep) and shimmer
synth.suppress(); synth.inward(light); synth.strike(face | 'numb')
synth.ui('hover' | 'play' | 'spirit' | 'notEnough' | 'glimmer' | 'confirm' | 'cancel')
synth.glimmers(count)               // count-up ticks, max 12
synth.ambience(1 | 2 | 'deep' | null); synth.ambienceBrighten()   // one notch per Resolve
synth.wheelCloses(); synth.heartbeat(); synth.dispose()
createSynth({ AudioContext?, gestureTarget? })   // tests inject a fake context
```

Lights are pentatonic in wheel order (Love C5, Joy D5, Friendship E5, Courage G5, Hope A5, Calm C6). Every
method is a no-op before the first gesture or without WebAudio, and never throws. Strike effects (echo
sends, the Anger distortion curve) are built once per graph and reused.
