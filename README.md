# Heartward

*Every feeling has a light.*

A roguelike deckbuilder for the browser where **emotions are the damage system**. You wade into the Mere, the lake where feelings go when nobody tends them, and meet Shades: feelings that got too big to carry alone. You answer each one with its opposite.

| Shade | Answered by (OPPOSITE x2) | "Bad advice" (DISSONANT x1/2) |
|---|---|---|
| Anger | Love | Calm ("Just calm down.") |
| Sadness | Joy | Love ("At least you have people who love you.") |
| Loneliness | Friendship | Joy ("Just go out and have fun!") |
| Fear | Courage | Friendship ("Come on, everyone else is doing it.") |
| Despair | Hope | Courage ("Just pull yourself together.") |
| Anxiety | Calm | Hope ("Don't worry, it'll all work out.") |

## How emotions work as a system

- **Type chart.** Every card carries one or two Lights, and every Shade shows a face. The opposite Light eases double. Each Light is DISSONANT against the Shade its clockwise wheel neighbour cures: half effect, and the Shade flares up. One rule covers all six pairs.
- **Resolve or Suppress.** The finishing blow matters. Finish a Shade with its opposite and it **Resolves**: it transforms and leaves you an Afterglow. Finish it any other way and it is **Suppressed**: a *Buried* card joins your deck and troubles you while it sits in your hand.
- **Buried and Insight.** Play the right Light *Inward* (on yourself) to Tend a Buried card. Tend it down to nothing and it becomes a unique, powerful Insight card.
- **Harmony.** Lights sit on a wheel (Love, Joy, Friendship, Courage, Hope, Calm). Play a wheel neighbour after the last Light you played and the card counts as both, which lets you answer two-faced Shades such as Old Grudge (Anger over Sadness).
- **Afflictions.** Shades inflict their feeling on you (Seething, Heavy, Isolated, Trembling, Hollow, Restless), and their opposite Light soothes it.
- **The Numbness.** The final boss is the absence of feeling. Single feelings are muffled, only two at once get through, and everything you buried surfaces to meet you first.

Every number that will change is previewed before you commit, including whether a lethal hit will Resolve or Suppress.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/, playable from any static host
```

Mouse, touch or keyboard only (1-9 cards, arrows to target, Enter to play, E end turn, Z undo, C codex, D deck, M mute). The first run is a gentle tutorial. Settings include a colour-blind palette, reduced motion and animation speed. URL switches: `?seed=123`, `?tutorial=0`, `?gray=1`, `?debug=1`, `?encounter=enc.a1.mask`.

## Project layout

| Path | What |
|---|---|
| `docs/DESIGN.md` | The full design and build spec (rules, content tables, UI, audio, accessibility, simulation targets). |
| `src/engine/` | Pure, deterministic game engine: seeded RNG, one damage pipeline, previews that are the real interpreter run on a clone. No DOM. |
| `src/content/` | All cards, Shades, encounters, Keepsakes and events as data in a small effect DSL. |
| `src/ui/` | Vanilla TypeScript DOM + inline SVG. `kit/` holds the procedural Shade art, card faces, Compass and widgets; `audio/` synthesizes every sound with WebAudio (no asset files). `gallery.html` shows the whole kit. |
| `sim/` | Headless simulator with a ladder of bots (random, type-blind, colour-matching, fully aware, ablations, archetype policies) and balance metrics. |
| `tests/` | Rule, property (preview equals result), content registry, run-flow, UI kit and architecture tests. |

## Checks

```bash
npm test               # fast suite
npm run typecheck      # app, DOM-free engine, and sim configs
npm run test:slow      # 300-seed property tests, map properties, perf
npm run test:balance   # simulator gates (about a minute)
npm run sim -- --bots aware,blind --runs 300 --strict   # full report in sim/out
```

The latest balance report is `docs/balance-report.md`. A bot that uses the type chart wins far more often than a type-blind bot over the same seeds, which is the proof that the emotion system carries the game.
