# HEARTWARD: Game Design Document v1.1 (Build Spec)

> Tagline: *Every feeling has a light.*
> Genre: turn-based roguelike deckbuilder (browser, TypeScript + Vite, Vitest).
> Status: FINAL BUILD SPEC v1.1. This document replaces the seed brief, the four reviews and v1.0. v1.1 applies the lead's decisions on the red-team review. Section 25 lists every change. Where this doc and any earlier text disagree, this doc wins. Every id, name and number here is canonical. Numbers marked "tuning knob" may be changed only through `src/content/rules.ts` or content data after the simulator says so (section 21).

---

## 0. Merge decisions (what was adopted, from whom, and why)

| # | Decision | Source | Why |
|---|---|---|---|
| D1 | Title **Heartward** (matches the repo/package name). Setting: the Mere. Acts: The Shallows, The Undertow, The Deep. | seed, content | No rename churn; content's setting and act names are strong. |
| D2 | **Dissonance = one structural rule:** each Light is DISSONANT against the Shade cured by its clockwise neighbour. | systems | One rule instead of six facts; strong flavour on all six pairs; a Light's blind spot is covered by its Harmony partner; blends are never Dissonant with no special case. |
| D3 | **Act 1 uses exactly the user's four pairs** (Anger/Love, Sadness/Joy, Fear/Courage, Loneliness/Friendship). Hope, Calm, Anxiety, Despair arrive at the start of Act 2 ("the wheel closes"). Hope and Calm cards are not offered in Act 1, so they are never dead draws. | clarity (solves systems W4 differently) | Learnability; Act 1 has 11 nouns, all from the user's prompt. |
| D4 | UI words: **OPPOSITE x2**, **DISSONANT x1/2**. Shade HP = **Intensity**. Shade strength = **Flare**. Player strength = **Nerve**. Damage verb on cards = **Ease**. Resolve reward = **Afterglow**. | clarity, systems, content | Removes the "Intensity" collision and the three "Res-" words. "Echo" is the Loneliness Shade's name, so the Resolve reward is "Afterglow". |
| D5 | **Harmony is a state** ("the Note"): persists across turns inside a combat, same Light holds it, colourless cards ignore it, no global number bonus, payoffs printed as "Harmony:" riders. Gated behind **The Compass** Keepsake, granted after the 2nd combat won in every run. | systems + clarity | Depth (what you end your turn on matters) with zero hidden tracking: the Compass HUD shows the Note. |
| D6 | **Faced Shades** (compounds and The Mask): only the showing face counts; an OPPOSITE hit turns the face. Compounds are the six adjacent Shade pairs, and the outer face is always the one whose cure is DISSONANT against the inner face. | systems, clarity (six mirror-adjacent compounds), engineering | Every compound is a Harmony puzzle with no extra rule. Seed's Fear+Anxiety "Dread" is replaced by Fear+Despair. |
| D7 | **Only your cards can go wrong** (automatic hits are never DISSONANT and never Suppress; they leave a Shade Wavering at 1). | clarity | Kills feel-bad accidental Suppresses. |
| D8 | **Inward play**: any Light card can be played on yourself to clear all stacks of its affliction and Tend one Buried card. Outward plays still clear 1 stack. | systems | Gives the "right" Light a competing use; makes "therapy" a real verb. |
| D9 | **Buried cards merge by type with Weight 1 to 3.** Insight comes from Tending a Buried card to Weight 0, or from Resolving its Surfaced Shade (upgraded if its peak Weight was 2+). A Surfaced Resolve is not a Tend: Journal doesn't trigger, Lead Box doesn't block it, and Worn Diary's upgrade applies. **Each Insight id can be created at most once per run.** Resolving a normal Shade pays Glimmers and an Afterglow, never Insight. | systems, clarity, red team (B3, M3) | Prevents the curse death spiral; both sources tie one Insight to one Buried card, and once per run stops Suppress-and-Tend farming. |
| D10 | Afflictions share **one shape** (stacks, lose 1 at end of your turn). Restless is deterministic ("first card costs +1"). Isolated blocks Harmony and stops your Companions acting. | clarity, red team (minor-27) | Previewable, no randomness, one rule family. |
| D11 | **The Numbness** = Muffled (one Light x1/2, two Lights FELT x2) + **Surfacing** (your Buried cards rise as Shades first) + Numb affliction. Buried Weight left hidden, and every Surfaced Shade you Suppress, grow the boss's max Intensity. Previewed by the Act 2 elite **Apathy**; meter in the top bar from your first Buried card. | systems, content, engineering, red team (B2) | The final fight is personalised by your whole run and is never a surprise rule. |
| D12 | Roster, barks, events, card names mostly from content; intent distortion (all variants) **cut** (clarity: no "?" intents). | content, clarity | Tone + readability. |
| D13 | Engine = pure reducer, data-first effect DSL with <= 10 custom hooks, one damage pipeline, preview = real interpreter on a clone, seeded streams per node, belief-based bot ladder. | engineering | Testability and proof that emotions matter. |
| D14 | **Structure: 2 full acts of 10 floors + The Deep (3 fixed floors ending in The Numbness)** = 23 floors, 12 to 16 combats, about 60 minutes. | lead | See 3.1. |

---

## 1. Vision

### 1.1 Premise (title screen text)
> Something in you has gone quiet and grey. You take your lantern and wade into the Mere, the lake where feelings go when nobody tends them. The Shades there aren't monsters. They're feelings that got too big to carry alone.

### 1.2 Pillars
1. **Emotions are the damage system.** Every card and every Shade has an emotional type, and the type chart decides damage, finishing blows, afflictions and long-term deck health. A type-blind player must measurably lose (section 21).
2. **Answer, don't just defeat.** Finishing a Shade with its opposite **Resolves** it (it transforms and helps you). Anything else **Suppresses** it (you carry it as a Buried card). Every lethal hit is a planned choice, shown before you commit.
3. **Feel many things at once.** Harmony (playing wheel neighbours in sequence) and Blends are how you reach compounds and, finally, The Numbness. A mono deck (one Light) is intentionally the weakest archetype at the finale: it can still win there, mostly through Blends from The Deep's Sanctuary (13), but less often than a deck that walks the wheel.
4. **Nothing hidden that matters.** Every number that will change is previewed. No random targets, no "?" intents, no random discards.
5. **Warm, never preachy.** Suppressing is allowed and sometimes right. Shades are overwhelmed feelings, not villains. No clinical language in game text.

### 1.3 Scope budget (hard caps for v1)
| Bucket | Count |
|---|---|
| Starter cards (unique) | 5 (11-card starter deck + 1 card from the starting Charm) |
| Light cards | 36 (6 per Light: 3 common, 2 uncommon, 1 rare) |
| Blend cards | 6 |
| Neutral cards | 5 |
| Buried cards / Insight cards | 6 / 6 |
| Companions | 3 |
| Enemy definitions | 28 (12 Act 1 incl. 4 tutorial variants, 9 Act 2, 7 The Deep incl. 6 Surfaced variants) |
| Encounters | 30 |
| Keepsakes | 23 (1 Compass, 4 Charms, 12 pool, 6 boss) |
| Memory events | 6 |
| Statuses | 21 |

---

## 2. Glossary (UI word, meaning, engine name)

| UI word | Meaning | Engine name |
|---|---|---|
| Heart | Player HP. Starts 70/70. | `run.heart`, `run.maxHeart`; in combat `player.hp`, `player.maxHp` |
| Spirit | Energy. 3 per turn. | `combat.energy` |
| Guard | Block. Player Guard is removed at the start of your turn. A Shade's Guard is removed when that Shade starts its action. | `guard` |
| Intensity | Shade HP. | `enemy.hp`, `enemy.maxHp` |
| Ease X | Reduce a Shade's Intensity by X through the damage pipeline (5.4). | effect op `hit` |
| Mend X | Restore X Heart (never above max Heart). | effect op `mend` |
| Light | Player emotion type: Love, Joy, Friendship, Courage, Hope, Calm. | `Light` |
| Shade | Enemy (a negative emotion): Anger, Sadness, Loneliness, Fear, Despair, Anxiety. Also the name for any enemy. | `Shade` type / `EnemyState` |
| Blend | A pair of adjacent Lights: Delight, Playfulness, Loyalty, Determination, Patience, Compassion. Also the 6 dual-Light cards. | `Blend` |
| OPPOSITE x2 | The hit contains the Light that cures the target's showing face. | relation `opposite` |
| DISSONANT x1/2 | The hit's only relevant Light is the target's "bad advice" Light. | relation `dissonant` |
| FELT x2 / MUFFLED x1/2 | Against The Numbness and Apathy: two Lights / fewer than two Lights. | relations `felt` / `muffled` |
| VEILED | The Numbness or Apathy while a Surfaced Shade stands: can't be targeted, takes no damage. | relation `veiled` |
| Flare | Shade strength: +1 to each of its strikes per stack. | status `flare` |
| Nerve | Player strength: +1 to each hit from your cards per stack. | status `nerve` |
| Note | The Light(s) of the last Light card you played this combat. Shown on the Compass. | `combat.note` |
| Harmonized | A card with a printed Light adjacent on the wheel to a Note Light that is not one of its own printed Lights. It counts as both Lights. | `harmonized` |
| Face | The feeling a Faced Shade is currently showing. | `enemy.faces`, `enemy.faceIndex` |
| Affliction | A player debuff inflicted by a Shade: Seething, Heavy, Isolated, Trembling, Hollow, Restless, Numb. | status ids |
| Inward | Playing a Light card on yourself (4.7). | `Action.inward = true` |
| RESOLVE / DEEP RESOLVE | Shade finished by its opposite (both opposites for a two-faced Shade). | outcome `resolve` / `deepResolve` |
| SUPPRESS | Shade finished any other way by your card. | outcome `suppress` |
| Afterglow | The immediate gift a Resolved Shade leaves. | `afterglow` |
| Wavering | A Shade held at 1 Intensity by an automatic hit that would have Suppressed it. | status `wavering` |
| Fleeting | A summoned minion (Doubt). Fades at 0 with no Resolve/Suppress. | `EnemyDef.fleeting` |
| Buried <Shade> | Unplayable curse card from Suppressing. Has Weight 1 to 3. | card `buried.<shade>`, `CardInstance.weight` |
| Weight | Pips on a Buried card: how heavy it is. | `weight`, `peakWeight` |
| Tend | Lower a Buried card's Weight by 1. At 0 it becomes Insight (or is removed if that Insight was already created this run). | `tend` |
| Insight | Permanent strong card made from a Buried card Tended to Weight 0 or Resolved as a Surfaced Shade. Each Insight id at most once per run. | card `insight.*` |
| Understood | Your next hit on this Shade counts as OPPOSITE. | status `understood` |
| Companion | Friendship ally with no HP that acts at the end of your turn (not while you have Isolated). | `CompanionState` |
| Promise | "At the start of your next turn: ..." | effect op `promise` |
| Linger | This card stays in hand at end of turn. | keyword `linger` |
| Let Go | Removed for the rest of this combat after it is played. | keyword `letGo` |
| Innate | Starts in your opening hand. | keyword `innate` |
| Mood | Card kind: played once, its effect lasts the whole combat. | kind `mood` |
| Hush X | The Shade's next attack move deals X less per strike. | status `hush` |
| Glimmers | Currency. Start with 50. | `run.glimmers` |
| Keepsake | Relic. | `KeepsakeDef` |
| Charm | Starting Keepsake (choose 1 of 4). | rarity `charm` |
| Haven / Sanctuary / Memory / Chest | Rest site / shop / event / Keepsake chest map nodes. | node kinds `haven`, `sanctuary`, `memory`, `chest` |
| Full Bloom | Every non-Fleeting Shade in a fight was Resolved: the card reward gets a 4th option. | `combat.allResolved` |
| Festering | From turn 12, every Shade gains 1 Flare at the start of each enemy phase. | rule `festerTurn` |

Banned in game text: "damage" on cards (use Ease), "kill/defeat/destroy" (use Resolve/Suppress), "enemy/monster", "curse", "you died", and any clinical term (therapy, depression, trauma, disorder, mental illness). Defeat text: *"Your Heart needs rest. The Lights will keep until you're back."*

---

## 3. Run structure

### 3.1 Acts and floors (and why)

| Segment | Floors | Contents |
|---|---|---|
| **Act 1: The Shallows** | 10 (rows 1 to 9 + boss row 10) | Four Lights (Love, Joy, Friendship, Courage) and their four Shades. Compass after 2nd combat. Boss: The Mask. |
| **Act 2: The Undertow** | 10 (rows 1 to 9 + boss row 10) | "The wheel closes": Hope and Calm cards unlock, Anxiety and Despair Shades, compound (two-faced) Shades, the Apathy elite. Boss: The Spiral. |
| **The Deep** | 3 fixed nodes | Sanctuary (stocks 3 Blend cards, always including both Blends that contain your most common Light) -> Haven -> The Numbness. |

Total 23 floors. Typical run: 8 to 11 normal fights, 1 to 3 elites, 2 bosses and The Numbness (12 to 16 combats), about 60 minutes.

**Justification.** A full third act would need a third roster (skip-one "bridge" compounds) that adds nouns without adding a rule. The Numbness is a *rule* payoff (Muffled + Surfacing), not a content act, so a short approach with a final shop and rest is enough and lets the player prepare for it (buy Blends, Reflect on Buried cards). Two 10-floor acts give each new rule set (Act 1: chart, Resolve, Harmony, afflictions, Inward, Buried; Act 2: the full wheel, faces, Muffled/Surfacing preview) its own act. Shorter runs mean more runs per player-hour for learning and 2000 simulated runs per bot in under 2 minutes.

### 3.2 Run flow
1. Title -> New Run -> Charm select -> Act 1 map. On a profile's first run the Charm select is skipped (Warm Locket is given), the tutorial map is used (11.3), and the run starts directly inside the combat of row 1's middle node (`enc.t1`). If `tutorialDone` can't be read (blocked storage), New Run shows a "Skip tutorial" option.
2. Walk the map bottom to top. Each node resolves (combat, reward, event, shop, rest, chest).
3. After the 2nd combat won in the run, the reward screen grants **The Compass** (`ks.compass`) in addition to normal rewards.
4. Act 1 boss -> boss rewards -> Mend to full (with Spiral Shell: Mend 50% of missing Heart) -> "The wheel closes" (choose 1 of 3 Hope/Calm cards, 12.5) -> Act 2 map.
5. Act 2 boss -> boss rewards -> Mend to full (with Spiral Shell: Mend 50% of missing Heart) -> The Deep (Sanctuary, Haven, The Numbness).
6. The Numbness Resolved or Suppressed = run won (two endings, 15.3). Heart 0 anywhere = run lost.

---

## 4. Rules reference

Rule ids (R-x) are referenced by tests (`tests/engine/rules.R-x.test.ts` naming is recommended).

### 4.1 The wheel (R-1)

Lights clockwise from the top of the Compass, index 0 to 5: **Love(0), Joy(1), Friendship(2), Courage(3), Hope(4), Calm(5)**.
Shades share the index of the Light that cures them: **Anger(0), Sadness(1), Loneliness(2), Fear(3), Despair(4), Anxiety(5)**.

- `opposite(shade) = LIGHTS[index(shade)]` (the cure).
- Two Lights are **adjacent** if their indices differ by 1 or 5.
- Two Lights are **across** if their indices differ by 3 (only used by the Mirror Shard Keepsake).
- **Blends** (adjacent pairs): Love+Joy = **Delight**, Joy+Friendship = **Playfulness**, Friendship+Courage = **Loyalty**, Courage+Hope = **Determination**, Hope+Calm = **Patience**, Calm+Love = **Compassion**. `BLENDS[i] = LIGHTS[i] + LIGHTS[(i+1) % 6]`.

### 4.2 Type chart (R-2)

**Rule text:** *"Every Shade is answered by its opposite Light: x2. Each Light is DISSONANT against the Shade its clockwise neighbour cures: x1/2, and that Shade gains 1 Flare. Everything else is x1."*

Engine: Light index `l`, Shade index `s`: opposite iff `s == l`; dissonant iff `s == (l + 1) % 6`; otherwise neutral.

Full chart (row = Light used, column = Shade's showing face):

| Light \ Shade | Anger | Sadness | Loneliness | Fear | Despair | Anxiety |
|---|---|---|---|---|---|---|
| **Love** | **x2** | x1/2 | x1 | x1 | x1 | x1 |
| **Joy** | x1 | **x2** | x1/2 | x1 | x1 | x1 |
| **Friendship** | x1 | x1 | **x2** | x1/2 | x1 | x1 |
| **Courage** | x1 | x1 | x1 | **x2** | x1/2 | x1 |
| **Hope** | x1 | x1 | x1 | x1 | **x2** | x1/2 |
| **Calm** | x1/2 | x1 | x1 | x1 | x1 | **x2** |
| Neutral card | x1 | x1 | x1 | x1 | x1 | x1 |

Shade view (for nameplates and the Codex), with the "bad advice" line shown in the DISSONANT tooltip and floating text:

| Shade | Act | OPPOSITE x2 | DISSONANT x1/2 | Bad-advice line | Affliction |
|---|---|---|---|---|---|
| Anger | 1 | Love | Calm | "Just calm down." | Seething |
| Sadness | 1 | Joy | Love | "At least you have people who love you." | Heavy |
| Loneliness | 1 | Friendship | Joy | "Just go out and have fun!" | Isolated |
| Fear | 1 | Courage | Friendship | "Come on, everyone else is doing it." | Trembling |
| Despair | 2 | Hope | Courage | "Just pull yourself together." | Hollow |
| Anxiety | 2 | Calm | Hope | "Don't worry, it'll all work out." | Restless |

**Multi-Light hits (R-2a):** a hit with two Lights (Blend card or Harmonized card) uses the **best** relation among its Lights: OPPOSITE if either Light is opposite, else NEUTRAL if either is neutral, else DISSONANT. Because each Shade has exactly one DISSONANT Light, a two-Light hit is never DISSONANT. Multipliers never stack: the maximum is x2.

**Effective Lights in rule text (R-2b):** "A card/hit with <Light>" always means its effective Lights at play time. A Numb-greyed card has none. This applies to every passive, gauge and condition in section 7 (Kettle Pressure, Short Fuse, Grows in the Dark, Dread's push, Spiral unwind, Fret's Worry, both Wallows, the Knot's Tension).

**Relation to pct (integer percent):** opposite 200, neutral 100, dissonant 50, felt 200, muffled 50, veiled 0.

### 4.3 Flare (R-3)
- Flare is a Shade status. Each stack adds +1 to **each strike** of that Shade's attacks.
- A **non-lethal DISSONANT** hit from your card gives the target +1 Flare (after damage).
- A **non-lethal OPPOSITE** hit removes 1 Flare from the target (if it has any), after damage.
- Shade moves and passives may also grant Flare (listed per Shade). Flare has no cap and lasts the combat.
- Automatic hits (4.11) never give Flare. FELT/MUFFLED hits never change Flare.

### 4.4 Harmony and the Note (R-4)
Rule text (Codex): *"The Compass remembers the last Light you played. A card whose Light is next to it on the wheel is Harmonized: it counts as both Lights."*

1. **Enabled only while you own The Compass** (`ks.compass`). Without it, cards are never Harmonized (the Note is still tracked by the engine but not shown).
2. **The Note** = the printed Lights of the last Light-typed card you played in this combat (a Blend card sets both of its Lights). It starts empty at combat start and **persists across turns**.
3. A card with printed Lights is **Harmonized** if one of its printed Lights is adjacent to a Light in the Note that is not one of the card's own printed Lights. It then has **effective Lights** = its printed Lights plus that adjacent Note Light. Effective Lights never exceed 2 (a Harmonized Blend keeps its own two Lights). If more than one Note Light qualifies, the card gains the one that is first going clockwise from the card's own Light. A Blend card therefore Harmonizes only with an adjacent Light outside its own pair (Note Friendship, play Sunbeam: Harmonized through Joy; Sunbeam after Sunbeam: not Harmonized).
4. A card whose Light is **the same** as the Note (and not adjacent to another Note Light) is not Harmonized; the Note stays the same. A non-adjacent Light is not Harmonized and the Note moves to it.
5. **Neutral cards, Buried cards and Numb-greyed cards do not change the Note** and are never Harmonized.
6. After Harmony is determined, the Note becomes the card's **printed** Lights.
7. **Isolated:** while you have 1+ Isolated, your cards are never Harmonized (the Note still updates) and your Companions don't act (4.13).
8. Harmony has **no global bonus**. Its value is coverage (two Lights for type matching, cleansing, Tending, Resolve, FELT) plus printed riders ("Harmony: ..."), which trigger only if the card is Harmonized.
9. Harmony is determined **before** cost is paid and before cleansing (so the Friendship card that clears Isolated is not itself Harmonized).
10. Examples: Note Love, play Joy -> Joy+Love (Delight). Note Joy, play Joy -> Joy only, Note stays Joy. Note Delight (Love+Joy), play Friendship -> Friendship+Joy. Note Love, play Courage -> Courage only, Note becomes Courage.

### 4.5 Faced Shades (R-5)
- Every Shade has a list of **faces** (`faces: Shade[]`). Single Shades have 1 face. **Compounds** have 2 faces (outer first). **The Mask** has 4. The Numbness, Apathy and their Surfaced partners follow 4.16.
- Only the **showing face** counts for the type chart, Resolve and the Buried card on Suppress.
- **Turning:** after a **non-lethal OPPOSITE hit** (including Understood hits and automatic OPPOSITE hits), a Faced Shade with 2+ faces turns to its next face (index + 1, wrapping). Each hit of a multi-hit card is evaluated against the face showing at that moment.
- The Mask also turns at the end of each of its own actions, and your hits can turn it at most twice per player turn (7.1).
- Compound design rule (for content authors): outer face = the Shade whose cure is DISSONANT against the inner face. Consequence: spamming the outer cure backfires (x2, turn, then x1/2 + Flare), while the matching Blend or a Harmonized pair hits x2 on both faces.

### 4.6 Afflictions (R-6)
**One shape for all:** an affliction has stacks. Its effect applies while it has 1+ stacks (or at its stated timing). **At the end of your turn, after its end-of-turn effect, it loses 1 stack.** New stacks add to existing stacks.

| Id | Name | From | Effect | Cleansed by (outward: -1 stack; Inward: all) |
|---|---|---|---|---|
| `seething` | Seething | Anger | At the end of your turn, lose Heart equal to its stacks (ignores Guard). | Love |
| `heavy` | Heavy | Sadness | Hits from your cards deal x3/4 (pct 75). | Joy |
| `isolated` | Isolated | Loneliness | Your cards can't be Harmonized and your Companions don't act. | Friendship |
| `trembling` | Trembling | Fear | Guard you gain from cards is x3/4 (pct 75). | Courage |
| `hollow` | Hollow | Despair | At the start of your turn, gain 1 less Spirit. | Hope |
| `restless` | Restless | Anxiety | The first card you play each turn costs 1 more. | Calm |
| `numb` | Numb | The Numbness, Apathy | The first card you play each turn has no Light: it counts as a neutral card (no Harmony, no cleanse, can't be played Inward, doesn't change the Note, MUFFLED, and a lethal hit Suppresses unless the target is Understood). | none |

**Automatic cleanse (R-6a):** each card you play **outward** removes 1 stack of the affliction that each of its effective Lights cleanses (Love: Seething, Joy: Heavy, Friendship: Isolated, Courage: Trembling, Hope: Hollow, Calm: Restless). A Harmonized Love+Joy card removes 1 Seething and 1 Heavy. Inward plays remove **all** stacks (4.7). Numb is never cleansed (Perspective removes every affliction except Numb, 4.9). Yellow Umbrella blocks the first affliction stacks from any source, including Chipped Teacup and Numb (9.3).

### 4.7 Inward plays (R-7)
Rule text: *"Play a Light card on yourself instead of a Shade to soothe your own feelings: clear all of its affliction and Tend one of its Buried cards."*

- Any card with 1+ printed Lights and a numeric cost can be played **Inward** (targeting your own Heart). This includes Moods and Insight cards.
- It costs its normal Spirit (including Restless, Prism Shard, Center). Its printed effects **do not happen**. Instead:
  1. For each effective Light, remove **all** stacks of that Light's affliction.
  2. **Tend** one Buried card in your hand whose Shade is cured by one of the effective Lights and that has not been Tended this combat. If several qualify: highest Weight first, then wheel order of the Shade.
- Inward is **legal only if step 1 or step 2 would do something.**
- The card goes to the discard pile (or is Let Go if it has Let Go; a Mood played Inward goes to the discard pile, not into play).
- An Inward play is a card played: it sets the Note, can be Harmonized, counts for "cards played earlier this turn", triggers "whenever you play a card" effects and Shade passives that count cards (Knot, Spiral, Looming).

### 4.8 Lethal outcomes (R-8)
When a hit reduces a Shade to 0 Intensity or less, exactly one outcome happens:

| Outcome | Condition | Result |
|---|---|---|
| **FADE** | The Shade is Fleeting. | Removed. No Glimmers, no Afterglow, no Buried card. |
| **DEEP RESOLVE** | Hit from your card; the Shade has exactly 2 faces; the hit's effective Lights contain the opposites of **both** faces. | As Resolve, and you gain **both** faces' Afterglows. |
| **RESOLVE** | Hit (from your card or automatic) whose effective Lights contain the opposite of the showing face, or a card hit on an Understood Shade. The Numbness/Apathy: the hit is FELT (card or automatic, 4.16). | Shade transforms and leaves. Afterglow of the showing face (faceless Shades give none). Glimmer bonus (12.1). Surfaced Shades: Insight instead of Glimmers (4.16). |
| **WAVERING** | Automatic hit (4.11) that would not Resolve. | Intensity is set to 1 instead; the Shade gets `wavering` (UI chip "Finish it yourself"). Wavering is removed when any card hit lands on it. |
| **SUPPRESS** | Any other hit from your card (wrong Light, neutral card, Numb-greyed card). | Shade leaves. No Glimmer bonus, no Afterglow. Its **showing face** is Buried (4.10). The Numbness/Apathy: no Buried card (nothing to bury). Surfaced Shades: never Bury, their card returns unchanged and the boss grows (4.16). |

Only damage through `applyHit` can reduce a Shade's Intensity; there is no other way for a Shade to leave (except Fade on summoner leaving, R-8a). Seething and other self-damage only affect the player.

**R-8a Summoner rule:** when a summoner (Skitter, The Looming) leaves by any outcome, all Fleeting Shades it summoned Fade. The end of combat is R-8b.

**R-8b Immediate win check:** After every hit and every Shade removal from any source, if no non-Fleeting Shade remains, all Fleeting Shades Fade and the combat is won immediately. No later step of the current phase runs (no ticks, decay, Buried stacks or enemy phase). The Heart-0 check is likewise immediate. In the same step, the win check runs before the Heart-0 check.

### 4.9 Afterglows (R-9)
Applied immediately when the Shade Resolves (queued as a trigger after the current effect finishes).

| Shade (face) Resolved | Afterglow | Effect |
|---|---|---|
| Anger | Conviction | Gain 1 Nerve. |
| Sadness | Release | Mend 4. |
| Loneliness | Belonging | At the start of your next turn, draw 2 more cards (status `next_draw` +2). |
| Fear | Caution | Gain 6 Guard. |
| Despair | Perspective | Remove all your afflictions except Numb. Draw 1. |
| Anxiety | Clarity | At the start of your next turn, gain 1 more Spirit (status `next_spirit` +1). |

The lethal preview shows the Afterglow ("RESOLVE +8 Glimmers, Caution: +6 Guard"). Apathy and The Numbness have no face and give no Afterglow.

### 4.10 Buried cards, Weight, Tending, Insight (R-10)
- **One Buried card per Shade type.** Ids: `buried.anger`, `buried.sadness`, `buried.loneliness`, `buried.fear`, `buried.despair`, `buried.anxiety`. Unplayable. Weight 1 to 3 (shown as pips).
- **On Suppress** of a Shade whose showing face is X (applied to the run deck when combat ends, in chronological order with other deck mutations):
  - no Buried X in deck: add Buried X at Weight 1 (peakWeight 1);
  - Buried X at Weight 1 or 2: Weight +1 (peakWeight = max);
  - Buried X at Weight 3: lose 3 max Heart instead (Heart is capped to the new max). Preview text: "Buried Anger is full: lose 3 max Heart."
- **Surfaced Shades never Bury.** On Suppress, their card returns to the discard pile unchanged (`returnSurfaced` only, no `suppress` mutation).
- **In hand:** at the end of your turn, if a Buried card is in your hand, you gain stacks of its Shade's affliction equal to its Weight. This happens **after** afflictions tick and decay (5.6), so the stacks affect your next turn. Buried cards are discarded at end of turn like other cards (they never Linger, even with Serenity).
- **Tend:** Weight -1. Sources: Inward play (4.7), Sit With It, Haven Reflect, Sanctuary "Talk it through", Memory "The Unsent Letter". In combat, each Buried card can be Tended **at most once per combat**. Lead Box forbids Tending.
- **Insight:** Insight comes from Tending a Buried card to Weight 0, or from Resolving its Surfaced Shade. A Surfaced Resolve is not a Tend: Journal doesn't trigger, Lead Box doesn't block it, and Worn Diary's upgrade applies. The Buried card transforms permanently into its Insight card. The Insight is **upgraded** if its peakWeight was 2 or more (or if you own Worn Diary). In combat the transformed card stays in your hand and is playable that same turn.
- **One of each Insight per run:** each Insight id can be created at most once per run (tracked in `run.insightsMade`). A Buried card whose Insight you already own is removed from your deck when it reaches Weight 0 ("You've already made peace with this one."). Resolving a Surfaced Shade whose Insight you already own likewise removes its Buried card instead of transforming it. "Already own" means created earlier this run, even if that Insight has since left the deck. Invariant: at most one of each `insight.*` in the deck.
- Minions (Fleeting) never Bury. The Numbness and Apathy never Bury.

| Buried card | Affliction while in hand | Tended by | Insight |
|---|---|---|---|
| `buried.anger` Buried Anger | Seething x Weight | Love | `insight.passion` Passion |
| `buried.sadness` Buried Sadness | Heavy x Weight | Joy | `insight.bittersweet` Bittersweet |
| `buried.loneliness` Buried Loneliness | Isolated x Weight | Friendship | `insight.solitude` Solitude |
| `buried.fear` Buried Fear | Trembling x Weight | Courage | `insight.instinct` Instinct |
| `buried.despair` Buried Despair | Hollow x Weight | Hope | `insight.resilience` Resilience |
| `buried.anxiety` Buried Anxiety | Restless x Weight | Calm | `insight.foresight` Foresight |

Buried card text: *"Unplayable. End of turn in hand: gain [W] Seething. Play a Love card Inward to Tend."* Flavour: *"Not gone. Just quiet."* On Insight: *"Oh. So that's what it was."* On removal because the Insight already exists: *"You've already made peace with this one."*

### 4.11 Automatic hits (R-11)
An **automatic hit** is any hit that does not come from the card you are playing right now: Companion actions, Promises, and keepsake effects.
- Never DISSONANT: a dissonant relation is treated as neutral (x1) and gives no Flare.
- No Nerve and no Heavy apply.
- Can't Suppress: see WAVERING (4.8). Can Resolve (if OPPOSITE), and can Fade Fleeting Shades.
- Can be MUFFLED (x1/2) against The Numbness/Apathy; FELT if it carries 2 Lights. A FELT automatic finishing hit Resolves them. A MUFFLED one leaves them Wavering (4.16).
- An automatic OPPOSITE hit does turn faces and removes 1 Flare (it is still being understood).

### 4.12 Understood (R-12)
`understood` (1 stack max) on a Shade: the next hit **from a card you play** on that Shade counts as OPPOSITE to its showing face (x2, can Resolve, turns the face, removes 1 Flare), then Understood is removed. The Numbness and Apathy can't be Understood. Only source in v1: Name It.

### 4.13 Companions (R-13)
- Summoned by cards. **Max 3.** Summoning a 4th: your oldest Companion leaves ("waves goodbye").
- **No HP.** Shades never target Companions. **Scatter N** (a Shade move) makes your N oldest Companions leave.
- **Act at the end of your turn**, in summon order (5.6 step 2), except while you have 1+ Isolated: then they don't act at all (end of turn or "act now"). Each Companion hit is followed by the R-8b win check. Hits target **your last target**: the Shade you most recently targeted with a card this combat; if there is none, it is gone, or it is Veiled, the leftmost Shade that isn't Veiled. Companions can hit Shy Shades.
- Companion hits are **Friendship-typed automatic hits** (4.11).
- `comp.lantern_moth` Lantern Moth: Ease 3 to your last target. `comp.burrow_hare` Burrow Hare: you gain 3 Guard. `comp.old_dog` Old Dog: Ease 6 to your last target.

### 4.14 Promises (R-14)
- "Promise: E" creates a pending effect that resolves at the **start of your next turn**, after drawing (5.2 step 6), in creation order.
- A Promise hit targets the same Shade; if it is gone or Veiled, the leftmost Shade that isn't Veiled (Shy Shades can be hit). It carries the **effective Lights of the card at play time** (so a Harmonized Wish on a Star keeps Hope+Courage). It is an automatic hit (4.11), followed by the R-8b win check.
- Pending Promises on a Shade are shown at its feet; Promises on you are shown in the Promise tray.
- Promises vanish if the combat ends.

### 4.15 Card keywords (R-15)
- **Linger:** at the end of your turn this card stays in your hand. (Count to Ten and Wait It Out track "turns lingered" per card instance per combat.) Buried cards never Linger.
- **Let Go:** after being played, the card is removed for the rest of this combat (it returns to your deck next combat).
- **Innate:** at combat start this card is put into your opening hand (counts toward the 5).
- **Unplayable:** can't be played outward or Inward.
- **Spark +N:** +N Ease for each card you played earlier this turn.
- **Reaches Shy:** can target Shy Shades.
- **Mood:** when played outward, the card leaves play and its effect lasts for the rest of the combat.
- **Hand limit 10:** cards drawn with 10 in hand go to the discard pile.

### 4.16 The Numbness family: Muffled, Veiled, Surfacing, Numb (R-16)
Applies to `shade.numbness` (final boss) and `shade.apathy` (Act 2 elite).
- **Muffled:** they have no face and no type. Hits with fewer than 2 effective Lights (including neutral) are **MUFFLED x1/2**. Hits with 2 effective Lights are **FELT x2**. No Flare is gained or removed by these hits. They can't be Understood.
- **Resolve:** any FELT finishing hit Resolves (from your card or automatic). A non-FELT automatic finishing hit leaves it Wavering. A non-FELT finishing hit from your card Suppresses it (no Buried card).
- **Surfacing (combat start):** your Buried cards rise. Apathy: your 1 heaviest Buried card. The Numbness: your 3 heaviest (ties: wheel order of the Shade). Each becomes a Surfaced Shade of that type (`shade.surfaced_<shade>`) with Intensity **12 x Weight** (x1.5 with Lead Box, rounded down), placed to the left of the boss. That Buried card is removed from your draw pile for this combat. Surfaced Shades exist before the first enemy phase starts, so they are in its snapshot and act in it (5.7).
  - While any Surfaced Shade stands, the boss is **Veiled**: it can't be targeted and ALL-Shade hits skip it. It still acts.
  - **Resolve** a Surfaced Shade: its Buried card becomes its Insight (upgraded if peakWeight >= 2 or with Worn Diary) and is put into your hand (permanent). If you already own that Insight (created earlier this run, 4.10), the Buried card is removed from your deck instead. A Surfaced Resolve is not a Tend: Journal doesn't trigger, Lead Box doesn't block it, and Worn Diary's upgrade applies. Afterglow as normal. No Glimmers.
  - **Suppress** a Surfaced Shade: Surfaced Shades never Bury. Its card returns to your discard pile unchanged (`returnSurfaced` only, no `suppress` mutation), and the boss (Apathy or The Numbness) gains **+10 x Weight max Intensity and Intensity**. SUPPRESS banner sub-line: "The Numbness +20 Intensity" (W2).
  - The Numbness only, combat start: **+6 max Intensity and Intensity per Weight of Buried cards not Surfaced.**
  - Intensity thresholds (Thaw, 7.3) are a percent of **current** max Intensity, so this growth moves them up with it.
- **Numb** affliction (4.6): applied by their moves.
- Top-bar meter (from the moment you own a Buried card): grey oval icon "The Numbness: N will surface", N = min(3, number of Buried cards). Tooltip lists the cards that will surface and the Intensity the rest add ("+6 per Weight").

### 4.17 Festering and limits (R-17)
- **Festering:** at the start of each enemy phase from **turn 12** (`festerTurn`), every Shade gains 1 Flare. Banner: "The Shades fester."
- **Turn limit:** if a combat reaches the end of turn 40 (`turnLimit`), the run is lost ("stalemate"; engine safety for bots). From turn 30 the combat screen shows a "Turn 32/40" counter (16.2).
- **Max Shades on the field: 4.** Summons and spawns fail silently when full (the move's other effects still happen).
- **Trigger cap:** more than 1000 triggers in one `step` throws `RunawayTriggers` (test failure, never shipped).

---

### 4.18 Lead rulings (v1.1, resolve editor-noted gaps)
- **R-8b ordering:** the finishing hit is handled completely before the win check: its lethal outcome, the Afterglow it earns, and Keepsake `resolved` triggers (Pressed Flower) all apply. Then the win check ends the combat: the rest of the card's effect list, end-of-turn steps and the enemy phase do not run. Keepsake `combatWon` hooks (Warm Locket) then run, then `buildCombatResult`.
- **Intent conditions:** card conditions that read intents ("if the target intends to attack", Lionheart's "any Shade intends to attack", Instinct's "incoming" total) read the **current** intent (the stored move with current Flare and Hush), not the M2 projection. The pill shows the projection with its "after end of turn" tag; the card-face number and preview use the current intent. Both are engine data, so they never disagree with what actually resolves at the moment the card is played.
- **Unconditional:** `MoodDef.oncePerEnemyPhase` with `CombatState.moodFiredThisPhase` (reset at the start of each enemy phase).

---

## 5. Combat procedure (exact order)

The immediate win check (R-8b) and the Heart-0 check (5.5) run after every hit and every Shade removal, in any step below, and end the combat on the spot.

### 5.1 Combat start
1. Copy the run deck into `combat.cards` (combat copies keep the deck instance `uid`). Shuffle into the draw pile with the node's `shuffle` stream. Put Innate cards (and Worn Diary's Buried card) on top.
2. Spawn Shades in encounter order, left to right (HP pre-rolled at map generation). Roll each normal Shade's pattern start offset with the `ai` stream (elites, bosses, Surfaced, and every member of `enc.t1` to `enc.t4`: offset 0).
3. Surfacing, then The Numbness's hidden-Weight growth (Numbness/Apathy only, 4.16).
4. Combat-start triggers in order: player Keepsakes (acquisition order), then Shade passives (position order). Examples: Chipped Teacup gives 3 Seething; Skitter summons a Doubt; Echo's Last One Left. (Woven Bracelet summons at 5.2 step 5 on turn 1, L7.)
5. Roll every Shade's intent.
6. `note = []`, `turn = 0`. Go to 5.2.

### 5.2 Player turn start
1. `turn += 1`.
2. Remove all player Guard.
3. `energy = 3 + keepsake bonuses (+1 Chipped Teacup, +1 Spiral Shell, +1 Morning Tea on turn 1) + next_spirit - (1 if Hollow >= 1)`, minimum 0. Clear `next_spirit`.
4. Draw 5 + `next_draw` (+2 Sun Charm on turn 1). Clear `next_draw`. If the draw pile is empty when drawing, shuffle the discard pile into it (`shuffle` stream).
5. Turn-start triggers: Moods (Better Days, Lionheart), then Keepsakes (Warm Socks and Woven Bracelet on turn 1).
6. Resolve due Promises (creation order). Win check: R-8b after each Promise hit (a Promise that finishes the last Shade wins before the player acts).
7. Player may act: `play`, `endTurn` (and `choose`/`confirm` while a choice is pending).

### 5.3 Playing a card (action `{ t: 'play', card, target?, inward? }`)
1. **Legality:** card in hand, not Unplayable, no pending choice, target valid (enemy target must be targetable: alive, not Veiled, not Shy unless Reaches Shy), Inward legal (4.7), final cost <= energy.
2. **Effective Lights** (pure): if Numb >= 1 and this is the first card played this turn -> `[]` (greyed). Else printed Lights, plus Harmony (4.4).
3. **Cost:** printed cost (upgraded cost if upgraded) + `costMod` (Count to Ten: -1 per turn lingered; Daybreak: -1 per Promise made this combat) + 1 if Restless >= 1 and this is the first card this turn - 1 if Prism Shard and Harmonized and no Harmonized card was played yet this turn; minimum 0. If Center is active, cost = 0 (and Center is consumed). Pay.
4. Move the card out of the hand. If targeted at a Shade, set `lastTarget`. Emit the `cardPlayed` event; add its effective Lights to `lightsThisTurn`. If Harmonized: `harmonies += 1`, emit `harmony` (its Keepsake `harmonized` triggers wait for the end of step 7).
5. **Note:** if the card has printed Lights and was not greyed, `note = printed Lights`.
6. **Cleanse:** outward: -1 stack per effective Light's affliction. Inward: all stacks, then Tend (4.7), then skip to the end of step 7 (the `harmonized` triggers).
7. **Effects:** run the card's effect list in order through the interpreter. Hits go through 5.4. Triggers queued by effects (Afterglows, passives such as Kettle Pressure) run FIFO after each effect completes. **When the effect list has finished**, if the card is Harmonized, fire Keepsake `harmonized` triggers (Tuning Fork) and run what they queue, still before step 8 (L5). After a pending choice this is once the rest of the effect list has run. For an Inward play it comes after the cleanse and Tend, so the Tend target is chosen before any Keepsake draw. If the card ended the combat (R-8b), the triggers don't fire. (So a sealed preview shows the card's hits and its RESOLVE/SUPPRESS banner before a Keepsake draw stops it.)
8. **Cleanup:** move the card to discard (Let Go -> `letGo` pile for this combat; outward Mood -> `moods` pile, its effect registered). `played += 1`, `timesPlayed += 1` on the card. Fire Shade passives `cardHitResolved` (Kettle Pressure, Fret Worry removal) for each Shade the card hit, then `cardPlayed` (Knot Tension, Spiral unwind).
9. Win check: R-8b (it has already run after every hit and removal in steps 6 to 8, and a win there skips the rest of the play).

### 5.4 Damage pipeline (player-side hits)
`computeHit(state, spec)` is pure and returns a `HitBreakdown`. `applyHit` writes exactly that breakdown. The order is fixed:

1. **Base** `B`: the card's number after its own amount expression (upgrade, Spark, per-Companion, Growing Light, Flare-scaling).
2. **Flat** `F`: + Nerve stacks (card hits only). No other flat sources in v1.
3. **Own affliction pct** `H`: 75 if Heavy >= 1 and the hit is from a card; else 100.
4. **Relation pct** `T`: from 4.2 / 4.16 / 4.12 for the target's showing face and the hit's effective Lights. Automatic hits: dissonant -> 100. Lightning Rod: dissonant -> 100 (Flare still gained). Veiled: 0.
5. **Damage** `D = floor((B + F) * H * T / 10000)`; if `B + F > 0` and `T > 0` then `D = max(1, D)`.
6. **Guard:** `blocked = min(guard, D)`, `hpLoss = D - blocked`, `guardAfter = guard - blocked`.
7. **Lethal check:** if `hp - hpLoss <= 0` -> outcome by 4.8 (Wavering sets hp to 1).
8. **Side effects (non-lethal only):** dissonant (card hit) -> +1 Flare; opposite -> -1 Flare, then turn face (The Mask: at most twice per player turn from your hits, 7.1; the Spiral unwinds 1 Coil when it turns, 7.2); Understood consumed; Wavering cleared if card hit. Emit `hit` event with the breakdown.

Worked example: Kind Word (Ease 6), you have 1 Nerve and Heavy, the card is Harmonized after Joy (Love+Joy), target Old Grudge showing Sadness with 4 Guard. `B=6, F=1, H=75`, Joy is opposite to Sadness so `T=200`: `D = floor(7*75*200/10000) = floor(10.5) = 10`. Guard blocks 4, Intensity -6. Non-lethal OPPOSITE: -1 Flare, face turns to Anger.

**Multi-hit and ALL:** "twice"/"xN" run the pipeline once per hit against the state after the previous hit. ALL-Shade effects hit each targetable Shade left to right. A hit on a Shade that is already gone fizzles.

### 5.5 Guard, Mend and Shade strikes
- **Player Guard from cards:** `G = floor(base * Tr / 100)`, `Tr = 75` if Trembling >= 1 else 100. Guard from Keepsakes, Companions and Afterglows ignores Trembling.
- **Mend:** `min(amount, maxHp - hp)`. No modifiers.
- **Shade strike vs player:** per strike `S = max(0, base + Flare - Hush)`, where `base` is the move's own amount expression (for example Old Grudge's `rehash`: 4 + 3 per Tally). Guard absorbs, the rest is lost Heart. Hush is removed after the Shade's next attack move completes (all its strikes). Shade Guard gain is unmodified.
- If Heart reaches 0: Paper Crane (once per run: Mend to 25) or defeat, immediately. In combat, Paper Crane's use is tracked in `combat.paperCraneUsed` (copied from the run at combat start) and committed through `CombatResult.keepsakeCounters`. The run is never written mid-combat.

### 5.6 Player turn end (action `endTurn`)
1. End-of-turn Moods and Keepsakes: Unhurried (Guard per unspent Spirit), Serenity (mark every non-Buried card in hand as Linger).
2. **Companions act** in summon order (skip if none, or if you have 1+ Isolated). Win check: R-8b after each Companion hit. A win here ends the combat before step 3 (no ticks, no enemy phase).
3. **Ticks:** Seething: lose Heart = stacks. Warmth: Mend = stacks (Warmth max 6).
4. **Decay:** each affliction -1 stack; Warmth -1.
5. **Buried in hand:** each gives Weight stacks of its affliction (after decay, so they last through your next turn).
6. **Shade end-of-your-turn passives** (position order): Grumble Short Fuse, The Looming Grows in the Dark, Dread's push reset.
7. **Discard hand** except Linger cards (never Buried cards); each Lingering card's `lingered += 1`.
8. Store `playedLastTurn = played`, then reset per-turn flags (`played`, `harmonies`, `firstCardDone`, `lightsThisTurn`, Center, Prism Shard, Tuning Fork, and each Mask's hit-turns counter back to 2). The Note is **not** reset.
9. Go to 5.7.

Steps 1 to 6 are deterministic, so IntentView projects them: every intent pill shows the intent the Shade will have after step 6 (5.7.1).

### 5.7 Enemy phase
**Order and override rules.** 5.7 iterates over a snapshot of Shade uids taken at phase start. Summoned Shades act from the next phase. Every override applies only while its condition holds, re-derived on each gauge change. Override moves don't advance `pattern.index`. When an override lifts, the intent is the cycle move at the current index. The snapshot rule also covers Surfaced Shades spawned at combat start: they exist before the first enemy phase starts, so they act in it. The Heart-0 check and R-8b are immediate throughout.

1. If `turn >= 12`: every Shade gains 1 Flare (Festering).
2. For each Shade uid in the phase-start snapshot, left to right, if still present:
   a. Remove its Guard.
   b. Execute its intent move (effects in order). Summons are inserted directly to the right of the summoner and roll their intent immediately. They are not in the snapshot, so they act from the next phase (Skitter's `hide` Doubt does not act this phase).
   c. Its own end-of-action passives (Mope Wallow, Longing Wallow, Fret Worry, Dread countdown, The Mask turning, Spiral Coil, Slump Heavy Silence).
   d. Roll its next intent (5.7.1).
3. Go to 5.2.

**5.7.1 Intent patterns.** Stored intent is only `{ moveId }`; displayed numbers are derived live. Pattern kinds used in v1: `cycle` (moves in order, starting at the rolled offset), `byFace` (the move is chosen by the face showing when it acts; intent re-derives whenever the face turns), `override` (a gauge or countdown forces a move, section 7; order and override rules above), `phases` (switch pattern at an Intensity threshold; the current intent is re-derived immediately on crossing). All v1 intents are fully known; there is no `unknown` intent.

**Projected intents.** IntentView shows the projected intent after 5.6 steps 1 to 6, taken from `preview({t:'endTurn'})`. When it differs from the current intent, the pill shows the projected one with an "after end of turn" tag. Tooltip: "Lantern Moth will turn it to Fear." (Other causes: Short Fuse and Grows in the Dark adding Flare, a Companion hit turning a face or moving a gauge.) From the player turn whose enemy phase will Fester (`turn >= festerTurn`, 4.17), the projection also includes Festering (5.7 step 1): strikes show the +1 Flare and the tooltip adds "The Shades fester: +1 Flare." (joined with any other cause), so the shown per-strike number is what lands. A play preview's `intentAfter` is the pill the Shade will show after that play, from the same projection.

### 5.8 Combat end
- **Won:** all non-Fleeting Shades gone (R-8b). Build `CombatResult` (heart after, Glimmers, deck mutations in order: Buried adds/Weight changes, Tends, Insight transforms, removals of Buried cards whose Insight was already created (4.10); Keepsake counters incl. Paper Crane; stats). Warm Locket Mends 8. Go to rewards (12).
- **Lost:** Heart 0 with no Paper Crane, or turn limit. Go to defeat screen.

---

## 6. Cards

### 6.0 Conventions
- Columns: **id**, **name**, **Lights** (printed), **kind** (`ease` = hits Shades, `skill`, `mood`, `buried`), **cost**, **rarity** (S starter, C common, U uncommon, R rare, B blend-pool uncommon, X special), **target** (`enemy`, `all` = all Shades, `self`, `none`), **effect text** (exact card text; numbers in bold in UI), **upgrade** (only what changes; name gets a "+").
- Card text uses these exact words: Ease, Gain X Guard, Mend, Draw, Summon, Promise, Hush, Linger, Let Go, Innate, Spark, Harmony:, Reaches Shy.
- Every Light card can also be played **Inward** (4.7); this is a global rule, not printed on cards. The UI shows it as a heart outline on the player when legal.
- "Harmony:" riders trigger only if the card is Harmonized when played outward.
- Availability: Love, Joy, Friendship, Courage cards from Act 1; Hope and Calm cards from Act 2 ("the wheel closes"). Blends: Delight, Playfulness, Loyalty from Act 1; all six from Act 2.

### 6.1 Starter cards and starter deck

| id | name | Lights | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|---|
| `love.kind_word` | Kind Word | Love | ease | 1 | S | enemy | Ease 6. | Ease 9. |
| `joy.bright_spark` | Bright Spark | Joy | ease | 1 | S | enemy | Ease 4. Draw 1. | Ease 6. Draw 1. |
| `friendship.reach_out` | Reach Out | Friendship | ease | 1 | S | enemy | Ease 6. | Ease 9. |
| `courage.brave_strike` | Brave Strike | Courage | ease | 1 | S | enemy | Ease 6. | Ease 9. |
| `courage.stand_firm` | Stand Firm | Courage | skill | 1 | S | self | Gain 5 Guard. | Gain 8 Guard. |

**Starter deck (11 cards):** Kind Word x2, Bright Spark x2, Reach Out x2, Brave Strike x2, Stand Firm x3. The starting Charm adds 1 more card (12 total). Every Act 1 Shade has 2 OPPOSITE attacks in the starter; all starter cards are typed (every play moves the Note); no starter card has Harmony riders, Companions, Promises or conditions.

### 6.2 Love: *Warmth* (Mend, Warmth). Cures Anger, clears Seething, DISSONANT vs Sadness.
`warmth` (player status, max 6): at the end of your turn, Mend equal to its stacks, then it loses 1 stack.

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `love.soft_spot` | Soft Spot | ease | 1 | C | enemy | Ease 6. Mend 2. | Ease 8. Mend 3. |
| `love.warm_embrace` | Warm Embrace | skill | 1 | C | self | Gain 5 Guard. Gain 2 Warmth. | 7 Guard, 3 Warmth. |
| `love.unguarded` | Unguarded | ease | 1 | C | enemy | Ease 5. If you have no Guard, Ease 11 instead. | Ease 7, or 15. |
| `love.forgive` | Forgive | ease | 2 | U | enemy | Ease 8, +4 for each Flare on the target. Then remove all its Flare. | Ease 11, +5 per Flare. |
| `love.tender_tune` | Tender Tune | skill | 1 | U | self | Gain 4 Warmth. Harmony: also gain 5 Guard. Let Go. | 6 Warmth, Harmony 7 Guard. |
| `love.unconditional` | Unconditional | mood | 2 | R | none | The first time each enemy phase a Shade's move makes you lose Heart, gain 2 Warmth. | Cost 1. |

Forgive counts Flare **before** the hit (the OPPOSITE hit's -1 Flare happens after damage; "remove all" then clears the rest).

### 6.3 Joy: *Spark* (draw, Spirit, chaining). Cures Sadness, clears Heavy, DISSONANT vs Loneliness.

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `joy.giggle` | Giggle | ease | 0 | C | enemy | Ease 3. Spark +1. | Ease 4. Spark +2. |
| `joy.confetti` | Confetti | ease | 1 | C | all | Ease 3 to ALL Shades twice. | Ease 4 twice. |
| `joy.skip_along` | Skip Along | skill | 1 | C | self | Gain 5 Guard. Draw 1. Harmony: draw 1 more. | Gain 8 Guard. |
| `joy.belly_laugh` | Belly Laugh | ease | 2 | U | enemy | Ease 8. Spark +2. | Ease 10. Spark +3. |
| `joy.zoomies` | Zoomies | skill | 0 | U | none | Gain 1 Spirit. Draw 1. Harmony: draw 1 more. Let Go. | Draw 2 (Harmony: 1 more). |
| `joy.grand_finale` | Grand Finale | ease | 2 | R | all | Ease 4 to ALL Shades once for each card you played earlier this turn (at least once). Let Go. | Ease 5. |

### 6.4 Friendship: *Kinship* (Companions, hit-all). Cures Loneliness, clears Isolated, DISSONANT vs Fear.

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `friendship.call_a_friend` | Call a Friend | skill | 1 | C | none | Summon a Lantern Moth. | Also draw 1. |
| `friendship.buddy_up` | Buddy Up | skill | 1 | C | self | Gain 4 Guard. Summon a Burrow Hare. | Gain 7 Guard. |
| `friendship.high_five` | High Five | ease | 1 | C | enemy | Ease 5, +2 per Companion. Harmony: your Companions act now. | Ease 7, +3 per Companion. |
| `friendship.group_hug` | Group Hug | skill | 2 | U | self | Gain 8 Guard, +3 per Companion. | 11, +4 per Companion. |
| `friendship.pile_on` | Pile On | ease | 2 | U | all | Ease 5 to ALL Shades, +2 per Companion. | Ease 7, +3 per Companion. |
| `friendship.best_friend` | Best Friend | skill | 2 | R | none | Summon an Old Dog. | Cost 1. |

"Your Companions act now" runs each Companion's action immediately (automatic hits, R-8b after each), in addition to their normal end-of-turn action. While you have Isolated, Companions don't act (4.13).

### 6.5 Courage: *Stand* (Guard, big hits, Nerve). Cures Fear, clears Trembling, DISSONANT vs Despair.

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `courage.hold_the_line` | Hold the Line | skill | 1 | C | self | Gain 8 Guard. | Gain 11 Guard. |
| `courage.face_the_storm` | Face the Storm | ease | 1 | C | enemy | Ease 7. If the target intends to attack, Ease 10 instead. Harmony: always Ease 10. | 9, or 13. |
| `courage.chin_up` | Chin Up | ease | 1 | C | enemy | Ease 5. Gain 5 Guard. | Ease 7. Gain 7 Guard. |
| `courage.find_your_nerve` | Find Your Nerve | mood | 1 | U | none | Gain 2 Nerve. | Gain 3 Nerve. |
| `courage.bold_leap` | Bold Leap | ease | 2 | U | enemy | Ease 15. If the target intends to attack, also gain 8 Guard. | Ease 19, 10 Guard. |
| `courage.lionheart` | Lionheart | mood | 2 | R | none | At the start of your turn, if any Shade intends to attack, gain 1 Nerve. | Cost 1. |

"Intends to attack" = the target's current intent includes a Strike.

### 6.6 Hope: *Promise* (next-turn payoffs, growth). Cures Despair, clears Hollow, DISSONANT vs Anxiety. (Act 2+)

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `hope.wish_on_a_star` | Wish on a Star | ease | 1 | C | enemy | Ease 4. Promise: Ease 8 to the same Shade. Harmony: the Promise Eases 12 instead. | Ease 5. Promise 11 (Harmony 15). |
| `hope.silver_lining` | Silver Lining | skill | 1 | C | self | Gain 5 Guard. Promise: gain 5 Guard and draw 1. | 7 Guard, Promise 7 Guard. |
| `hope.plant_a_seed` | Plant a Seed | skill | 0 | C | none | Promise: gain 1 Spirit and draw 1. Let Go. | Promise: 1 Spirit, draw 2. |
| `hope.growing_light` | Growing Light | ease | 1 | U | enemy | Ease 6. Each time you play this, it Eases 3 more for the rest of this combat. | Ease 8, grows 4. |
| `hope.better_days` | Better Days | mood | 1 | U | none | At the start of your turn, gain Guard equal to the turn number (max 8). | Cost 0. |
| `hope.daybreak` | Daybreak | ease | 3 | R | all | Ease 18 to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go. | Ease 24. |

### 6.7 Calm: *Stillness* (Hush, Linger, unspent Spirit). Cures Anxiety, clears Restless, DISSONANT vs Anger. (Act 2+)
`hush` (Shade status): its next attack move deals X less per strike (min 0), then Hush is removed. Stacks add.

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `calm.still_water` | Still Water | skill | 1 | C | self | Gain 7 Guard. Linger. | Gain 10 Guard. |
| `calm.lullaby` | Lullaby | ease | 1 | C | enemy | Ease 5. Hush 4. Harmony: Hush ALL Shades instead. | Ease 7. Hush 5. |
| `calm.count_to_ten` | Count to Ten | ease | 2 | C | enemy | Ease 13. Linger. Costs 1 less for each turn it has Lingered this combat. | Ease 17. |
| `calm.center` | Center | skill | 1 | U | none | The next card you play this turn costs 0. Draw 1. | Cost 0. |
| `calm.unhurried` | Unhurried | mood | 1 | U | none | At the end of your turn, gain 4 Guard for each unspent Spirit. | 6 per Spirit. |
| `calm.serenity` | Serenity | mood | 2 | R | none | At the end of your turn, every non-Buried card in your hand Lingers. | Cost 1. |

### 6.8 Blend cards (pool `blend`, rarity B = priced and weighted as uncommon)
Offered: the 4th option of a Full Bloom reward, one guaranteed option in every elite card reward, slot 3 of the card offer after your 2nd combat win (an Act 1 Blend, 12.2), 2 Sanctuary slots (3 in The Deep, always including both Blends that contain your most common Light, and one Blend slot is the sale item, 13). All are `ease` so a Blend can land a DEEP RESOLVE.

| id | name | Lights (Blend) | cost | target | text | upgrade | Key to |
|---|---|---|---|---|---|---|---|
| `blend.sunbeam` | Sunbeam | Love+Joy (Delight) | 1 | enemy | Ease 7. Mend 2. Draw 1. | Ease 9. Mend 3. | Old Grudge |
| `blend.tag_youre_it` | Tag, You're It! | Joy+Friendship (Playfulness) | 1 | enemy | Ease 5. Spark +1. Summon a Lantern Moth. | Ease 7. Spark +2. | Longing |
| `blend.shoulder_to_shoulder` | Shoulder to Shoulder | Friendship+Courage (Loyalty) | 1 | enemy | Ease 6 and gain 6 Guard, +2 each per Companion. Reaches Shy. | Ease 8, 8 Guard. | Wallflower |
| `blend.against_the_odds` | Against the Odds | Courage+Hope (Determination) | 2 | enemy | Ease 10. Promise: Ease 10 to the same Shade. | Ease 13. Promise 13. | Dread |
| `blend.wait_it_out` | Wait It Out | Hope+Calm (Patience) | 1 | enemy | Ease 7. Linger. Eases 4 more for each turn it has Lingered this combat. | Ease 10, +5 per turn. | The Spiral |
| `blend.gentle_hands` | Gentle Hands | Calm+Love (Compassion) | 1 | enemy | Ease 6. Hush 5. Mend 3. | Ease 8. Hush 7. Mend 4. | The Knot |

A Blend card's Note is both Lights. A Blend card is Harmonized only by an adjacent Note Light outside its own pair (4.4 rule 3: Sunbeam after Sunbeam is not Harmonized, Sunbeam after Friendship is). When Harmonized it counts for Prism Shard, Tuning Fork and the Harmony count, but never gains a third Light.

### 6.9 Neutral cards (no Light; never change the Note; can't be played Inward)

| id | name | kind | cost | rar | target | text | upgrade |
|---|---|---|---|---|---|---|---|
| `neutral.name_it` | Name It | ease | 1 | C | enemy | Ease 4. Then the target becomes Understood. | Ease 7. |
| `neutral.pause` | Pause | skill | 0 | C | none | Draw 2. Let Go. | Draw 3. |
| `neutral.push_it_down` | Push It Down | ease | 1 | C | enemy | Ease 9. If this Suppresses a Shade, gain 2 Spirit. | Ease 12. |
| `neutral.look_inward` | Look Inward | skill | 1 | U | none | Put a Buried card from your draw or discard pile into your hand. Draw 1. | Cost 0. |
| `neutral.sit_with_it` | Sit With It | skill | 1 | R | none | Tend a Buried card in your hand, whatever its type. Let Go. | Cost 0. |

Look Inward and Sit With It open a choice (`pending`) only if 2+ cards qualify; with exactly 1 it is chosen automatically; with 0 the Buried part does nothing (the card stays playable). Name It's own hit is not boosted by Understood (it is applied after).

### 6.10 Buried cards (rarity X, kind `buried`, cost `unplayable`, no Lights)
See 4.10 for the full table. Text template: *"Weight [W]. Unplayable. End of turn in hand: gain [W] <Affliction>. Play a <Light> card Inward to Tend."*

### 6.11 Insight cards (rarity X; never offered as rewards; created only by Tending a Buried card to Weight 0 or by Resolving its Surfaced Shade; each id at most once per run, 4.10)

| id | name | Lights | kind | cost | target | text | upgrade (created upgraded if peakWeight >= 2) |
|---|---|---|---|---|---|---|---|
| `insight.passion` | Passion | Love | ease | 1 | enemy | Ease 9, +3 for each Flare on the target. Gain 1 Nerve. | Ease 12, +4 per Flare. |
| `insight.bittersweet` | Bittersweet | Joy | skill | 1 | self | Mend 4. Draw 2. Linger. | Mend 6. |
| `insight.solitude` | Solitude | Friendship | ease | 2 | enemy | Ease 10. If you have no Companions, Ease 20 instead. Then Summon a Lantern Moth. | 13, or 26. |
| `insight.instinct` | Instinct | Courage | skill | 1 | self | Innate. Gain Guard equal to the total of all Shades' incoming strikes (max 30). | Cost 0. |
| `insight.resilience` | Resilience | Hope | skill | 0 | self | Gain 6 Guard. Promise: gain 1 Spirit and draw 1. | Gain 9 Guard. |
| `insight.foresight` | Foresight | Calm | skill | 0 | none | Draw 2. Hush 3 on ALL Shades. Linger. | Hush 5. |

"The total of all Shades' incoming strikes" = the sum of every Shade's displayed intent strike totals (after Flare and Hush, before your Guard). Instinct and Passion use Trembling / Heavy normally.

A Surfaced Resolve creates the Insight with the same upgrade rule (peakWeight >= 2 or Worn Diary). If the Insight was already created this run, no Insight is created and the Buried card is removed instead (4.10).

### 6.12 Companions (see 4.13)

| id | name | End of your turn | Summoned by |
|---|---|---|---|
| `comp.lantern_moth` | Lantern Moth | Ease 3 to your last target (Friendship, automatic). | Call a Friend, "Tag, You're It!", Solitude, Woven Bracelet |
| `comp.burrow_hare` | Burrow Hare | You gain 3 Guard. | Buddy Up |
| `comp.old_dog` | Old Dog | Ease 6 to your last target (Friendship, automatic). | Best Friend |

Companions don't act while you have 1+ Isolated (4.13).

---

## 7. Shades

### 7.0 Conventions
- **Move notation:** `Strike N` (one strike), `Strike N x K` (K strikes), `Guard N` (the Shade gains N Guard), `N <Affliction>` (applies stacks to you), `Flare +N`, `Summon <id> (max M)` (M = this summoner's live Fleeting count cap; field cap 4), `Scatter N` (your N oldest Companions leave), `<Gauge> +N`.
- **HP** is `[min, max]`, rolled (integer, uniform) at map generation with the node's encounter stream. Encounter entries may override HP.
- **Pattern:** `cycle` unless stated. Normal Shades start at a random offset (combat `ai` stream); elites, bosses, Surfaced Shades and every member of `enc.t1` to `enc.t4` (including the full Grumble in `enc.t4`) start at offset 0.
- **Overrides** follow the 5.7 order and override rules: an override holds only while its condition holds (re-derived on each gauge change), doesn't advance `pattern.index`, and when it lifts the intent is the cycle move at the current index.
- **"A card/hit with <Light>"** in any passive means its effective Lights at play time (R-2b). A Numb-greyed card has none.
- **Design principle:** each Shade's mechanic makes its DISSONANT Light look tempting (e.g. Despair's Guard shell tempts Courage's big hits; Anger's big telegraphed hits tempt Calm's Hush). The correct cure also shuts the mechanic down.
- All barks are speech bubbles shown on spawn and on its first action; farewells show for 1.2 s on Resolve/Suppress.

### 7.1 Act 1: The Shallows

| id | name | faces | HP | passives | moves (pattern order) |
|---|---|---|---|---|---|
| `shade.grumble` | Grumble | anger | 40-44 | **Short Fuse:** at the end of your turn, if a card without Love hit it this turn, Flare +1 (once per turn). | `snap` Strike 7 -> `stomp` Strike 5, 2 Seething -> `huff` Guard 6, Flare +1 |
| `shade.mope` | Mope | sadness | 46-50 | **Wallow:** after its action, restores 5 Intensity unless a hit with Joy landed on it since its previous action. | `sigh` Strike 6, 1 Heavy -> `drizzle` Strike 2 x 3 -> `curl_up` Guard 10 |
| `shade.skitter` | Skitter | fear | 26-30 | **Summoner:** combat start: Summon Doubt. Its Doubts Fade when it leaves (R-8a). | `hide` Guard 8, Summon Doubt (max 2) -> `lunge` Strike 10 -> `shiver` Strike 4, 2 Trembling |
| `shade.doubt` | Doubt | fear | 7 | **Fleeting.** | `nag` Strike 3 (every turn) |
| `shade.echo` | Echo | loneliness | 32-36 | **Last One Left:** the first time it is the only Shade on the field (checked at combat start and whenever a Shade leaves), Flare +2 and Guard 10. | `call_out` Strike 6 -> `cold_shoulder` Strike 4, 2 Isolated -> `drift` Guard 8, Scatter 1 |
| `shade.looming` | The Looming (elite) | fear | 84-88 | **Summoner:** combat start: Summon Doubt x2. **Grows in the Dark:** at the end of your turn, if you played no card with Courage this turn, Flare +1. | `loom` Guard 12, Summon Doubt (max 3) -> `pounce` Strike 14 -> `shriek` Strike 4 x 3, 2 Trembling |
| `shade.kettle` | The Kettle (elite) | anger | 90-94 | **Pressure** (gauge 0 to 6, starts 0): after each of your cards that hit it resolves, Pressure +1 if the card has no Love, or -2 (min 0) if it has Love. While Pressure is 6, its intent is overridden to `boil_over` (lifted again if Pressure drops below 6 before it acts). After `boil_over`, Pressure = 0. | `rattle` Strike 8 -> `whistle` Strike 5 x 2, 2 Seething -> `simmer` Guard 12, Pressure +2; override `boil_over` Strike 24, 3 Seething |
| `shade.mask` | The Mask (boss) | anger, sadness, loneliness, fear | 150 | **Many Faces:** turns on OPPOSITE hits (R-5) and also at the end of each of its actions. Its forehead shows the next face. Your hits (card or automatic) can turn it at most twice per player turn. Further OPPOSITE hits still deal x2 and remove Flare but don't turn it. Chip: "Turns left 2/1/0" (resets at the end of your turn, 5.6 step 8). **Cracked:** the first time it is at 50% of its max Intensity or less (75 of 150), Flare +3. | `byFace`: anger -> `rage` Strike 12; sadness -> `weep` Strike 5 x 2, 2 Heavy; loneliness -> `turn_away` Guard 15, 2 Isolated; fear -> `startle` Strike 8, 2 Trembling |

The Mask is the Harmony walk made into a boss: Love, then Joy, then Friendship, then Courage each hit x2 because every OPPOSITE hit turns it to the face the next Light cures, and a Harmonized card covers two faces. Turning it on purpose also chooses which move it makes (turn it to Loneliness and it only Guards). Because your hits can turn it at most twice per player turn, its face moves 1 to 3 steps per cycle of 4, so Loneliness comes up at most every other turn and the turns in between cost you `weep`, `startle` or `rage`: it can't be locked on `turn_away`.

**Tutorial variants** (used only by the tutorial encounters, no passives, offset 0):

| id | name | faces | HP | moves |
|---|---|---|---|---|
| `shade.tut_grumble` | Little Grumble | anger | 18 | `snap5` Strike 5 -> `snap6` Strike 6 -> `snap7` Strike 7 |
| `shade.tut_mope` | Little Mope | sadness | 22 | `sigh` Strike 5 -> `curl_up` Guard 6 -> `drizzle` Strike 2 x 2 |
| `shade.tut_echo` | Little Echo | loneliness | 24 | `call_out` Strike 5 -> `drift` Guard 6 |
| `shade.tut_skitter` | Little Skitter | fear | 24 | `shiver` Strike 4, 2 Trembling -> `lunge` Strike 7 |

### 7.2 Act 2: The Undertow

Compound faces are listed outer first; the outer face's cure is DISSONANT against the inner face (4.5).

| id | name | faces | HP | passives | moves (pattern order) |
|---|---|---|---|---|---|
| `shade.fret` | Fret | anxiety | 42-46 | **Worry** (starts 0, max 6): after its action, Worry +1. Each of your cards with Calm that hits it removes 2 Worry. | `flurry` Strike 3 x (1 + Worry) -> `fidget` Worry +2, 2 Restless -> `pace` Guard 8 |
| `shade.slump` | Slump | despair | 50-54 | **Heavy Silence:** after its action, if you played 2 or fewer cards during your last turn, Guard 8. | `sigh_deeply` Strike 6, 1 Hollow -> `sink` Guard 12 -> `collapse` Strike 15 |
| `shade.old_grudge` | Old Grudge | anger / sadness | 60-64 | **Keeps Score:** each hit from your cards that isn't OPPOSITE adds 1 Tally (max 6). | `mutter` Strike 6, 2 Seething -> `rehash` Strike 4 + 3 per Tally, then Tally = 0 -> `brood` Guard 10, 1 Heavy |
| `shade.longing` | Longing | sadness / loneliness | 58-62 | **Wallow:** after its action, restores 5 Intensity unless a hit with Joy or Friendship landed on it since its previous action. | `reach_back` Strike 9 -> `remember` Guard 10, 1 Heavy, 1 Isolated -> `ache` Strike 4 x 3 |
| `shade.wallflower` | Wallflower | loneliness / fear | 38-42 | **Shy:** while another Shade stands, cards can't target it unless they Reach Shy (ALL hits and Companions still reach it). **Cornered:** the first time it is the only Shade, Flare +3. | `peek` 2 Trembling -> `wilt` Scatter 1, 2 Isolated -> `prickle` Strike 8 |
| `shade.dread` | Dread | fear / despair | 56-60 | **Countdown** (starts 3): while 0, intent is overridden to `the_thing`. After it acts: Countdown = 3 if it used `the_thing`, else -1. Once per your turn, a hit from a card with Courage or Hope pushes Countdown +1 (max 3). | `creak` Strike 6 -> `shadow` 2 Trembling, 1 Hollow; override `the_thing` Strike 24 |
| `shade.knot` | The Knot (elite) | anxiety / anger | 108-112 | **Tension** (0 to 6): +1 for each card you play (outward or Inward) whose effective Lights include neither Calm nor Love. Each hit on it from a card with Calm or Love: -1 (min 0). While 6, intent is overridden to `snap`; after `snap`, Tension = 0. | `twist` Strike 6 x 2 -> `clench` Guard 16, Tension +2 -> `lash` Strike 14; override `snap` Strike 22 |
| `shade.apathy` | Apathy (elite) | none (numb rules) | 90-94 | **Muffled, Veiled, Surfacing (your 1 heaviest Buried card)** (R-16). Suppressing its Surfaced Shade: Apathy gains +10 x Weight max Intensity and Intensity. Can't be Understood. Suppress adds no Buried card. | `shrug` Strike 10 -> `grey_out` 2 Numb, Guard 10 -> `sigh` Strike 6 x 2 |
| `shade.spiral` | The Spiral (boss) | despair / anxiety | 200 | **Coil** (starts 2, max 6): after its action, Coil +1. Each card you play (outward or Inward) with Hope or Calm unwinds 1 Coil, or 2 if it has both (min 1). It also unwinds 1 whenever the Spiral's face turns (so Name It gives any deck a way to unwind it). `what_if` peaks at Strike 3 x 6 = 18 (30 with Deepening). **Deepening:** the first time it is at 50% of its max Intensity or less (100 of 200), Flare +2. | `what_if` Strike 3 x Coil, 1 Restless -> `whats_the_point` 2 Hollow, Guard 15 -> `around_again` Strike 12, Coil +1 |

### 7.3 The Deep

| id | name | faces | HP | passives | moves |
|---|---|---|---|---|---|
| `shade.numbness` | The Numbness (final boss) | none (numb rules) | 180 | **Muffled, Veiled, Surfacing (your 3 heaviest Buried cards)** (R-16). Combat start: +6 max Intensity and Intensity per Weight of Buried cards not Surfaced. Suppressing a Surfaced Shade: +10 x Weight max Intensity and Intensity. Can't be Understood. **Thaw:** when it first drops to 50% of its current max Intensity or less (90 of 180; growth raises it), its pattern switches to Phase 2 and its intent re-derives to `flatline`. | Phase 1: `static` Strike 12 -> `fog` Guard 14, 1 Numb -> `nothing_much` Strike 8, 1 Heavy, 1 Hollow. Phase 2: `flatline` Strike 18 -> `fog2` Guard 14, 2 Numb -> `static_storm` Strike 4 x 4 |
| `shade.surfaced_anger` | Surfaced Anger | anger | 12 x Weight | none | `flare_up` Strike 8 -> `smolder` Strike 5, 2 Seething |
| `shade.surfaced_sadness` | Surfaced Sadness | sadness | 12 x Weight | none | `sigh` Strike 6, 1 Heavy -> `curl_up` Guard 8 |
| `shade.surfaced_loneliness` | Surfaced Loneliness | loneliness | 12 x Weight | none | `call_out` Strike 6 -> `cold_shoulder` Strike 4, 2 Isolated |
| `shade.surfaced_fear` | Surfaced Fear | fear | 12 x Weight | none | `lunge` Strike 9 -> `shiver` Strike 4, 2 Trembling |
| `shade.surfaced_despair` | Surfaced Despair | despair | 12 x Weight | none | `sigh_deeply` Strike 7, 1 Hollow -> `sink` Guard 10 |
| `shade.surfaced_anxiety` | Surfaced Anxiety | anxiety | 12 x Weight | none | `flurry` Strike 3 x 3 -> `fidget` 2 Restless, Guard 6 |

Surfaced Shades are named (not Fleeting). They act in the first enemy phase (5.7 snapshot). Their Resolve gives an Afterglow and turns the Buried card into Insight in your hand (or removes it if that Insight was already created this run, 4.10); no Glimmers are paid in The Deep. Their Suppress returns the card unchanged and grows the boss (4.16). Apathy and The Numbness use a grey oval sigil labelled "NUMB" on map nodes and nameplates (16.0).

### 7.4 Barks and farewells

| Shade | Bark | Resolved | Suppressed |
|---|---|---|---|
| Grumble | "HMPH." / "Nobody LISTENS." | Cools into a small ember and curls up by your boots. It's very warm, actually. | It goes quiet. Not calm. Just quiet. |
| Mope | "...It's fine." / "Don't mind me." | The drizzle stops. Mope blinks, and a very small rainbow peeks out from behind it. | It sinks out of sight, still damp. |
| Skitter | "What was that?!" | It uncurls. It was a moth all along. It would like to sit on your lantern. | It scurries under a stone. You can still hear it, a little. |
| Doubt | "...are you sure?" | (Fades: pops like a soap bubble.) | (Fades.) |
| Echo | "Anyone? ...anyone?" | It calls out, and this time something answers. It's you. | The echo fades. The quiet it leaves is louder. |
| The Looming | "I'M ENORMOUS." | Up close, it's only a coat on a hook. It seems embarrassed about the whole thing. | It shrinks back into the corner. The corner stays dark. |
| The Kettle | "Hhhhhhhhhhh." | It clicks off. Somewhere, two cups of tea are poured. One is for you. | The lid is jammed on tight. Now and then you'll hear it rattle. |
| The Mask | (no words; its face shifts) | The mask falls away. Underneath is a face of pearl light, and it looks like yours. | The mask settles on one expression and stays that way. |
| Fret | "Did I leave the... what if..." | It stops pacing, sits down and says "oh" very softly, like someone who just remembered to breathe. | It hurries off. It'll be back to check on things. |
| Slump | "Why bother." | It sits up. Then stands. Then, astonishingly, stretches. | It sinks a little deeper. So do you. |
| Old Grudge | "I haven't forgotten." / "That's another one." | It puts down the chalk. It can't remember what the tally was for. | It pockets the chalk. It's still counting. |
| Longing | "Remember when...?" | It gives everything back, one thing at a time. It was keeping them safe. | It lets go all at once and doesn't look back. |
| Wallflower | "Don't look at me." | It steps off the wall. It's a sunflower, and it turns toward you. | It presses flatter against the wall until you can't see it. |
| Dread | "It's coming." / "Three." | The countdown reaches zero. The Thing arrives. It's morning. | The countdown freezes at one. It'll wait. |
| The Knot | "Too much. Too much. Too much." | It loosens, and loosens, and turns out to be a very long, very warm scarf. | It pulls itself tighter and rolls away. |
| Apathy | "Meh." | It blinks, slowly, like it just noticed the colour of the sky. | It shrugs and drifts off. It didn't care anyway. Probably. |
| The Spiral | "What if... what's the point... what if..." | It slows to a curl, then a line, then a path. It leads forward. | It winds itself small and burrows down. Some nights you'll feel it turning. |
| Surfaced (any) | (the Shade's own bark, quieter) | It was yours all along. You can hold it now. | It sinks back down. The grey grows thicker. |
| The Numbness | (a flat line, no words) | see 15.3 | see 15.3 |

---

## 8. Encounters

`EncounterDef = { id, members: { enemy, hp? }[] }`. Members spawn left to right. All weights are 1 (uniform). A node's encounter must differ from each parent node's encounter (reroll up to 5 times, then keep the last roll). Every member of `enc.t1` to `enc.t4` starts at pattern offset 0.

| id | members (HP override) | used in |
|---|---|---|
| `enc.t1` | tut_grumble | Tutorial row 1 |
| `enc.t2` | tut_mope | Tutorial row 2 |
| `enc.t3` | tut_echo, tut_mope (14) | Tutorial row 3 |
| `enc.t4` | tut_skitter, grumble (28-30) | Tutorial row 4 |
| `enc.a1.grumble` | grumble | Act 1 early |
| `enc.a1.mope` | mope | Act 1 early |
| `enc.a1.skitter` | skitter (+1 Doubt from its passive) | Act 1 early |
| `enc.a1.grumble_echo` | grumble, echo | Act 1 standard |
| `enc.a1.mope_skitter` | mope (40-44), skitter | Act 1 standard |
| `enc.a1.two_grumbles` | grumble (26-30), grumble (26-30) | Act 1 standard |
| `enc.a1.echo_mope` | echo, mope (40-44) | Act 1 standard |
| `enc.a1.two_skitters` | skitter (22-26), skitter (22-26) | Act 1 standard |
| `enc.a1.echo` | echo | Act 1 standard |
| `enc.a1.looming` | looming (+2 Doubts) | Act 1 elite |
| `enc.a1.kettle` | kettle | Act 1 elite |
| `enc.a1.mask` | mask | Act 1 boss |
| `enc.a2.fret` | fret | Act 2 early |
| `enc.a2.slump` | slump | Act 2 early |
| `enc.a2.old_grudge` | old_grudge | Act 2 standard |
| `enc.a2.longing` | longing | Act 2 standard |
| `enc.a2.dread` | dread | Act 2 standard |
| `enc.a2.wallflower_grumble` | grumble (34-38), wallflower | Act 2 standard |
| `enc.a2.wallflower_fret` | fret (34-38), wallflower | Act 2 standard |
| `enc.a2.two_frets` | fret (32-36), fret (32-36) | Act 2 standard |
| `enc.a2.slump_echo` | slump, echo (28-32) | Act 2 standard |
| `enc.a2.knot` | knot | Act 2 elite |
| `enc.a2.apathy` | apathy | Act 2 elite |
| `enc.a2.spiral` | spiral | Act 2 boss |
| `enc.deep.numbness` | numbness (+ Surfaced) | The Deep |
| `enc.mem.echo` | echo (32-36) | Memory "The Wishing Well" (pays base 10 + Resolve 8, counts as a win, no card reward) |

**Pools by row** (normal run; tutorial differences in 11.3):

| Act | Rows 1-2 fights | Rows 3-4 fights | Rows 6-8 fights | Elites (rows 6-8) | Boss |
|---|---|---|---|---|---|
| 1 | early: a1.grumble, a1.mope, a1.skitter | row 3 early; row 4 standard | standard: 6 encounters | a1.looming, a1.kettle | a1.mask |
| 2 | early: a2.fret, a2.slump | standard: 7 encounters | standard | a2.knot, a2.apathy | a2.spiral |

Act 2 row 3 fight nodes draw only from `{a2.old_grudge, a2.longing, a2.dread}` so the first compound is met early and alone.

**Elites per row:** each act's two elites are split by row so one path never meets the same elite twice. The `map` stream orders the act's elite pool: every row-6 Elite node uses the first, every row-8 Elite node uses the second, and each row-7 Elite node picks one of the two at random (`map` stream).

---

## 9. Keepsakes

No duplicates in a run. Pool draws skip owned Keepsakes; if a rarity is exhausted, use the next higher rarity; if all are exhausted, give 50 Glimmers.

### 9.1 Fixed
| id | name | effect | source |
|---|---|---|---|
| `ks.compass` | The Compass | Enables Harmony (R-4). Shows the Compass ring around the Spirit orb. | Granted on the reward screen after your 2nd combat win in every run. Never in pools. |

### 9.2 Charms (choose 1 of 4 at run start; the profile's first run gets Warm Locket automatically)
| id | name | effect | adds card |
|---|---|---|---|
| `ks.warm_locket` | Warm Locket | At the end of each combat you win, Mend 8. | Kind Word |
| `ks.sun_charm` | Sun Charm | On turn 1 of each combat, draw 2 extra cards. | Bright Spark |
| `ks.woven_bracelet` | Woven Bracelet | At the start of each combat, Summon a Lantern Moth. | Reach Out |
| `ks.brave_pebble` | Brave Pebble | At the start of each combat, gain 1 Nerve. | Brave Strike |

### 9.3 Pool (elite rewards, Chests, Sanctuary, events). Rarity weights for random draws: Common 50, Uncommon 35, Rare 15.
| id | name | rarity | effect |
|---|---|---|---|
| `ks.tuning_fork` | Tuning Fork | common | The first time a card is Harmonized each turn, draw 1. |
| `ks.pressed_flower` | Pressed Flower | common | Whenever you Resolve a Shade, Mend 3. |
| `ks.yellow_umbrella` | Yellow Umbrella | common | The first time each combat you would gain affliction stacks, gain none (from any source, including Chipped Teacup and Numb). |
| `ks.morning_tea` | Morning Tea | common | On turn 1 of each combat, gain 1 extra Spirit. |
| `ks.warm_socks` | Warm Socks | common | On turn 1 of each combat, gain 6 Guard. |
| `ks.prism_shard` | Prism Shard | uncommon | Your first Harmonized card each turn costs 1 less. |
| `ks.journal` | Journal | uncommon | Whenever you Tend a Buried card in combat, draw 1 and gain 3 Guard. (A Surfaced Resolve is not a Tend.) |
| `ks.ember_lantern` | Ember Lantern | uncommon | Whenever a Shade gains Flare, gain 2 Guard. |
| `ks.welcome_mat` | Welcome Mat | uncommon | Whenever you Summon a Companion, gain 3 Guard. |
| `ks.paper_crane` | Paper Crane | rare | Once per run, when your Heart would drop to 0, Mend to 25 instead. (In combat: `combat.paperCraneUsed`, committed through `CombatResult.keepsakeCounters`, 5.5.) |
| `ks.worn_diary` | Worn Diary | rare | At the start of each combat, put your heaviest Buried card into your opening hand. Insights you create are always upgraded (including by a Surfaced Resolve). |
| `ks.friendship_bracelet` | Friendship Bracelet | rare | Your Companions' hits count as the Lights of the Note (if the Note is empty: Friendship). |

### 9.4 Boss Keepsakes (after each act boss, choose 1 of 3 random from these 6; you may skip)
| id | name | effect |
|---|---|---|
| `ks.chipped_teacup` | Chipped Teacup | +1 Spirit each turn. At the start of each combat, gain 3 Seething. |
| `ks.spiral_shell` | Spiral Shell | +1 Spirit each turn. You can't Rest at Havens, and between acts you Mend only 50% of your missing Heart instead of to full. |
| `ks.lead_box` | Lead Box | Buried cards in your hand never afflict you. You can't Tend. Surfaced Shades have +50% Intensity. (Resolving a Surfaced Shade still creates its Insight: it is not a Tend.) |
| `ks.mirror_shard` | Mirror Shard | Lights directly across the wheel also Harmonize (Love-Courage, Joy-Hope, Friendship-Calm). |
| `ks.skeleton_key` | Skeleton Key | Inward plays can Tend any Buried card, whatever its type. |
| `ks.lightning_rod` | Lightning Rod | DISSONANT hits deal x1 instead of x1/2 (the Shade still gains 1 Flare). |

---

## 10. Memories (events)

Memory nodes pick an unused event (uniform, `event` stream); each event appears at most once per run. If all are used: "A Quiet Moment: Mend 10." Every option shows its mechanical result in brackets. Options whose requirement fails are shown disabled with the reason. Options whose Heart cost is >= your current Heart are disabled ("Not enough Heart").

**`mem.unsent_letter` The Unsent Letter**
*Tucked in the reeds is a letter in your handwriting. You never sent it. You remember exactly what it says.*
1. Read it aloud [Lose 6 Heart. Tend a Buried card of your choice. If you have none: upgrade 2 random cards.]
2. Fold it into a paper crane [Gain Paper Crane. Gain Buried Sadness (or +1 Weight; at Weight 3, lose 3 max Heart instead).] *"Some things fly better folded."* (disabled if you own Paper Crane)
3. Put it back [Nothing.] *"Not today. That's allowed."*

**`mem.campfire` The Campfire**
*Three travellers wave you over. There's room on the log. Someone is toasting something that was probably bread once.*
1. Sit with them [Mend 16.]
2. Swap stories [Add a random upgraded Friendship card.]
3. Take the first watch [Lose 5 Heart. Gain 45 Glimmers.] *They insist on paying you, mostly in toast.*

**`mem.mirror_pond` The Mirror Pond**
*The water is perfectly still. Your reflection looks like it's been waiting for you.*
1. Look closer [Duplicate a card of your choice (not Buried, not Insight).]
2. Make a face [Transform a card of your choice into a random upgraded card of a Light adjacent to its own (available Lights only). Neutral, Buried and Blend cards can't be chosen.]
3. Skip a stone [Gain 20 Glimmers.] *It skips four times. You'll take that as a sign.*

**`mem.stuck_balloon` The Stuck Balloon**
*A very small Mope sits under a tree. Its red balloon is caught in the branches. It isn't crying, exactly. It's being very brave about it.*
1. Climb up [Lose 7 Heart. Gain a random common Keepsake.]
2. Tell it a joke [If you have 3+ Joy cards: upgrade 2 random Joy cards. Otherwise: gain 10 Glimmers.]
3. Sit with it [Mend 8. Remove a card of your choice.] *Nothing happens for a while. Then it leans on you.*

**`mem.tea_slowly` Tea, Slowly**
*An old tortoise runs a tea stall at the crossroads. The sign says OPEN, SLOWLY.*
1. Chamomile [Mend 12.]
2. Strong brew [Pay 25 Glimmers. Upgrade 2 random cards.] (requires 25 Glimmers)
3. Ask for advice [Remove a card of your choice. If it was a Buried card, also Mend 6.] *"Put that down, dear. You've been carrying it all day."*

**`mem.wishing_well` The Wishing Well**
*A well with a tin cup on a string. Someone scratched WISHES 10G on the rim, crossed out the 10, and wrote "whatever you can spare."*
1. Toss in 20 Glimmers [Add a random upgraded card: Hope in Act 2, any available Light in Act 1.] (requires 20)
2. Toss in everything [Pay all Glimmers (min 1). Add a random rare card. If you paid 80+, also gain a random Keepsake.] (requires 1)
3. Shout into it [Fight an Echo (`enc.mem.echo`). Resolve it: gain a random uncommon Keepsake. Suppress it: gain 30 Glimmers.] The fight pays Glimmers as a normal fight (base 10, +8 if Resolved), counts as a win (`combatsWon`), and gives no card reward.

"Random upgraded card" / "random rare card" draw from the Light cards available in the current act (6.0), uniform, `event` stream.

---

## 11. Map

### 11.1 Shape
- Acts 1 and 2: rows 1 to 9 of 3 or 4 nodes, plus row 10 = the boss (1 node). Row 1 has exactly 3 nodes; rows 2 to 9 have 3 or 4 (50/50, `map` stream).
- The Deep: a fixed line of 3 nodes: Sanctuary -> Haven -> The Numbness.
- Node x positions: evenly spaced per row; y by row. Start at the bottom.

### 11.2 Edges (non-crossing staircase)
For consecutive rows of sizes `a` and `b` (columns indexed left to right): build a monotone path of index pairs from `(0,0)` to `(a-1, b-1)` and add one edge per visited pair.
1. Let `dA = a-1`, `dB = b-1`. Roll `k` (number of "advance both" steps) uniformly in `[0, min(dA, dB)]` with the `map` stream.
2. Form the move multiset `{both x k, i x (dA-k), j x (dB-k)}` and shuffle it (`map` stream). Reject and reshuffle if two identical single moves (`i,i` or `j,j`) are consecutive, because that would give a node 3 edges. After 50 rejections, use `k = min(dA, dB)`.
3. Add edge `(0,0)`, then walk the moves from `(0,0)`, adding edge `(i,j)` after each move.

Result: edges never cross, every node has 1 or 2 out-edges and 1 or 2 in-edges. All row-9 nodes connect to the boss.

### 11.3 Node kinds
| Row | Normal run (weights) | Tutorial run (profile's first run, Act 1 only) |
|---|---|---|
| 1 | Fight | Fight (`enc.t1`) |
| 2 | Fight | Fight (`enc.t2`) |
| 3 | Fight 50, Memory 30, Sanctuary 20 | Fight (`enc.t3`) |
| 4 | Fight 45, Memory 25, Haven 15, Sanctuary 15 | Fight (`enc.t4`) |
| 5 | Chest | Chest |
| 6 | Fight 40, Elite 30, Memory 20, Sanctuary 10 | as normal |
| 7 | Fight 45, Elite 25, Memory 20, Haven 10 | as normal |
| 8 | Fight 40, Elite 25, Memory 20, Sanctuary 15 | as normal |
| 9 | Haven | Haven |
| 10 | Boss | Boss |

**Repair pass** (in order, max 10 rerolls per node, then set to Fight):
1. No edge may connect two Havens, two Sanctuaries or two Elites.
2. At least 2 Elite nodes in rows 6 to 8 (convert random Fight nodes in rows 6 to 8 that have no Elite neighbour). Then re-run rule 1.
3. At least 1 Sanctuary in rows 3 to 8 (convert a random Fight or Memory node in rows 3 to 8; never in the tutorial rows 3 to 4).
4. Encounters: roll per fight/elite node from its row pool (section 8), differing from parents (up to 5 rerolls, then keep the last roll); Elite nodes follow the per-row elite split (section 8); roll member HP.

Each node stores `seed = hash32(runSeed, act, nodeId)`; all node-local streams derive from it.

### 11.4 What the map shows
- Fight and Elite nodes show the sigils of their Shades' faces (1 to 3 sigils; a compound shows its two sigils joined by a small bar; Apathy shows the grey "NUMB" oval). Memory contents are hidden until entered.
- The boss node shows its silhouette and name from the start of the act.
- Hover or focus on a fight node shows the node detail card (16.4).

---

## 12. Rewards and economy

### 12.1 Glimmers
- Start of run: 50.
- Combat win, base: normal 10, elite 25, boss 60, The Numbness 0 (`glimmersBase.final`).
- Resolve bonus per Shade Resolved (not Fleeting, not Surfaced): normal Shade +8, elite +20, boss +40, The Numbness 0 (`glimmersResolve.final`). Deep Resolve pays the same bonus.
- Suppress: +0.
- The Wishing Well's Echo fight (`enc.mem.echo`) pays as a normal fight: base 10, +8 if Resolved.

### 12.2 Card reward (after normal and elite fights; not after The Numbness or `enc.mem.echo`)
- **3 options**, rolled with the node's `reward` stream. Per slot rarity: normal fight C 60 / U 33 / R 7; elite C 45 / U 40 / R 15.
- **Most common Light** (used here, in the node detail (16.4), in The Deep's Sanctuary (13) and by bots): count only `ease` cards in the deck, by printed Light (a Blend counts for both of its Lights), ties broken by wheel order.
- **Slot rules:** slot 1 = a random Light among your two most common deck Lights; slot 2 = a uniformly random available Light; slot 3 = the Light that Tends your heaviest Buried card if you have one, else a uniformly random available Light. Each slot independently has an 8% chance to be a random neutral card instead (rarity rolled the same way). No duplicate card ids within one offer (reroll the slot up to 5 times, then keep the last roll).
- **Elite:** slot 3 is replaced by a random available Blend card.
- **Full Bloom:** if every non-Fleeting Shade in the fight was Resolved (or Deep Resolved), add a 4th option: a random available Blend if you own The Compass, otherwise a random available Light card.
- The player may take 1 or skip.
- After the 2nd combat win of the run, The Compass is granted first on the same screen, and the offer's slot 3 is always a random Act 1 Blend (Sunbeam, "Tag, You're It!", or Shoulder to Shoulder).

### 12.3 Keepsake rewards
- Elite: 1 random pool Keepsake (weights 9.3).
- Chest node: 1 random pool Keepsake.
- Boss: choose 1 of 3 boss Keepsakes (9.4) or skip.

### 12.4 Boss reward
Glimmers (60 + Resolve bonus), choose 1 of 3 random rare Light cards from the available Lights (or skip), choose 1 of 3 boss Keepsakes (or skip), then Mend to full. With Spiral Shell (including one just taken), Mend 50% of your missing Heart instead (rounded down).

### 12.5 "The wheel closes" (entering Act 2)
Hope and Calm unlock. Choose 1 of 3 (or skip): a random Hope common, a random Calm common, a random Hope-or-Calm uncommon.

---

## 13. Sanctuary (shop), run by Mo the heron

Stock rolled on entry with the node's `shop` stream.
| Slot | Count | Base price |
|---|---|---|
| Light cards | 5: 2 common, 2 uncommon, 1 rare (available Lights) | C 45, U 70, R 115 |
| Blend cards | 2 (3 in The Deep: always both Blends that contain your most common Light (12.2), plus 1 random other Blend) | 85 |
| Neutral card | 1 (rarity rolled C 60 / U 30 / R 10) | by rarity (C 45, U 70, R 115) |
| Keepsakes | 3: one each of common, uncommon, rare (pool) | C 130, U 170, R 220 |
| Service: Set Down a card | once per visit | 60, +20 for each earlier use this run: remove a card of your choice from your deck (any card, including Buried) |
| Service: Talk it through | once per visit, only with a Buried card | 35: Tend a Buried card of your choice |

- Price jitter: each item's price x one of {0.90, 0.95, 1.00, 1.05, 1.10} (uniform), rounded to the nearest integer. Services are not jittered.
- One random card slot is on sale at 50% (rounded down). In The Deep, the sale item is always one of the 3 Blend slots (chosen with the `shop` stream).
- Bought slots show "Sold". Leaving is free.
- Mo's lines (random on entry): "Found it on a Tuesday." / "No refunds. Herons don't do refunds." / "Shiny. Very shiny. You'll want that."

---

## 14. Haven (rest)

Choose exactly one:
| Option | Effect | Availability |
|---|---|---|
| Rest | Mend 30% of max Heart (rounded down). | Not with Spiral Shell. |
| Kindle | Upgrade a card of your choice (before/after preview). | If any upgradable card. |
| Reflect | Tend a Buried card of your choice (any type). At Weight 0 it becomes Insight (upgraded if peakWeight >= 2 or with Worn Diary), or is removed if that Insight was already created this run (4.10). | If you own a Buried card and not Lead Box. |

---

## 15. Act flow, victory, defeat

### 15.1 Transitions
- **Act 1 -> 2:** boss reward (12.4) -> Mend to full (Spiral Shell: 50% of missing Heart) -> "The wheel closes" cinematic (1.5 s: Hope and Calm segments ignite on the Compass; the three new Blend edges light) -> 12.5 card choice -> Act 2 map.
- **Act 2 -> The Deep:** boss reward -> Mend to full (Spiral Shell: 50% of missing Heart) -> "The Deep" title card: *"It's very quiet down here."* -> Sanctuary.

### 15.2 Defeat
Heart 0 (after Paper Crane) or turn limit. Screen: *"Your Heart needs rest. The Lights will keep until you're back."* Show run stats (15.4). Buttons: New Run, Title.

### 15.3 Victory (The Numbness gone)
- **Resolved ending:** *"Colour comes back all at once. It's loud. It's a lot. You laugh, and you're also crying a little, and that seems exactly right."*
- **Suppressed ending (still a win):** *"The grey settles. It's quiet. You made it through, and that counts. Some colours are still missing. Maybe next time."*

### 15.4 Run stats (victory and defeat)
Floors reached, Shades Resolved / Deep Resolved / Suppressed, Insights found, Lights used (card plays per Light as a six-segment ring), Harmonies played, most-played card, seed (copyable).

---

## 16. UI specification

### 16.0 Global
- **Reference canvas 1280x720.** Size everything in `calc(var(--u) * Npx)` with `--u = min(100vw/1280, 100vh/720)` (no CSS transform scaling; it blurs text). Minimum 1024x576. Desktop first; tablet landscape fully supported through tap-to-select; phone portrait out of scope. **Every tappable element is at least 56 reference px** in both dimensions (about 45 CSS px at `--u = 0.8`, a 1024-wide tablet).
- **Fonts:** `ui-rounded, system-ui, sans-serif` for UI; `ui-serif, Georgia, serif` for banners and titles; `font-variant-numeric: tabular-nums` for all numbers.
- **Neutral tokens (CSS custom properties on `:root`):** `--bg-0 #0E0C16`, `--bg-1 #1C1830` (background gradient), `--surface #231E33`, `--text #EDE8F5`, `--text-2 #A89FBF`, `--pearl #F4EFE6` (Heart, Spirit, focus), `--silver #C7CEDB` (Guard), `--ink #15121F` and `--ink-rim #2E2645` (Shades). The game is dark by design; there is no light theme.
- **Light colours** (default / colour-blind Okabe-Ito) and sigils:

| Light | Default | CB palette | Sigil (open, rounded) | Frame pattern | Voice note |
|---|---|---|---|---|---|
| Love | `#FF5C8A` | `#CC79A7` | heart | small dots | C5 |
| Joy | `#FFD23F` | `#F0E442` | 8-ray sun | radial rays | D5 |
| Friendship | `#3DDC84` | `#009E73` | two linked rings | chain links | E5 |
| Courage | `#FF8C42` | `#E69F00` | rising chevron | stacked chevrons | G5 |
| Hope | `#B18CFF` | `#0072B2` | 4-point star | tiny stars | A5 |
| Calm | `#4CC9F0` | `#56B4E9` | horizontal wave | horizontal waves | C6 |

- **Shade sigils (closed, pointed):** Anger jagged crown, Sadness falling teardrop, Loneliness lone dot in an empty ring, Fear wide eye, Despair downward funnel, Anxiety tangled scribble. Apathy and The Numbness: a grey oval labelled "NUMB" (map nodes, nameplates, the Numbness meter). All sigils on a 24-unit grid, legible at 14px, distinct in greyscale.
- **Colour rule:** saturated hue always means a Light. Shades are ink-dark; their cracks glow in the colour of the Light that Resolves their showing face. Affliction chips and Buried cards use an ink body with a rim in the cure's colour. Every colour signal is backed by a sigil and a text label.
- **Layers (bottom to top):** stage, hand, lifted card, overlays, tooltips, coach marks.
- **Rendering:** vanilla DOM + inline SVG, keyed reconciliation by `uid` (no framework). The UI never computes game rules; every number comes from the engine (`preview`, `intents`, `cardText`, `handHints`).

### 16.1 Combat screen layout (1280x720)
```
+------------------------------------------------------------------------------------------+
| TOP BAR y0-44: Heart 54/70 | Glimmers 32 | Keepsakes | Act 1 . Floor 3 | Deck 12 (1 Bur.) |
|                Numbness meter (if any Buried) | Codex (C) | Settings                      |
+-------------------------------------------+----------------------------------------------+
| PLAYER x40-380                            | SHADES x420-1240, 4 slots of 205px           |
|        [Wanderer avatar + lantern]        |  (1)[STRIKE 8]        (2)[AFFLICT Heavy 1]   |
|        Companions ( o )( o )(   )         |   [silhouette]          [silhouette]         |
|  [Guard 5] Heart [########....] 54/70     |  ANGER . Grumble       SADNESS . Mope        |
|  Incoming: strikes 8, Guard 5, Seething 2 |  [####----] 24/42      [########-] 44/48     |
|            -> you lose 5                  |  Love x2 | Calm x1/2   Joy x2 | Love x1/2    |
|  [Seething 2] [Heavy 1]   Promise tray    |  Flare 1 | Short Fuse  Wallow                |
+------------------+------------------------+-----------------------------+----------------+
| COMPASS x16-216  | PLAY LINE y470-492                                   | END TURN (E)   |
| ring + Spirit    | HAND x232-1048: fan, wheel-ordered, up to 10 cards   | 2 Spirit unused|
| Note, Harmonies  | of 130x182                                           | Undo (Z)       |
| Draw 7           |                                                      | Discard 3 | Log|
+------------------+------------------------------------------------------+----------------+
```
Regions: top bar y 0-44; stage y 44-468; bottom band y 468-720 (Compass x 16-216, hand x 232-1048, right column x 1064-1264).

Targeting: click/tap a card to select, then click/tap a Shade or the INWARD heart; keys as in 19. There is no drag targeting.

### 16.2 Combat components
**Shade slot (205px wide, top to bottom)**
- Intent pill (y 64-104): intent icon(s) + final number(s); order badge 1-4 when 2+ Shades act. The pill shows the projected intent after end-of-turn steps 1 to 6 (5.7.1). When it differs from the current intent it carries an "after end of turn" tag and its tooltip names the cause ("Lantern Moth will turn it to Fear.").
- Silhouette (y 108-316): procedural SVG (16.7) with ground shadow. Pending Promise chips and the Wavering chip sit at its feet.
- Nameplate (y 320-460):
  - Row 1: showing-face sigil (18px), TYPE caps 12px, name bold 14px (e.g. `ANGER . Grumble`). Two-faced Shades add a small "beneath:" sigil of the other face and a turn arrow; The Mask adds the next-face sigil.
  - Row 2: Intensity bar 180x14 with "24/42" inside; silver Guard badge left of the bar when Guard > 0.
  - Row 3 (always visible): matchup chips for the showing face: `[cure sigil] x2` in the cure colour with a double up-chevron; `[bad-advice sigil] x1/2` in grey with a down-chevron. The Numbness/Apathy show `FELT x2: two Lights` and `MUFFLED x1/2: one Light`. Tooltips: "OPPOSITE: Love deals double and Resolves Anger." / "DISSONANT: 'Just calm down.' Calm deals half and gives Anger 1 Flare."
  - Row 4: status chips: Flare n, gauges (Pressure 4/6, Tension 3/6, Worry 2, Tally 3, Countdown 2, Coil 5, The Mask's "Turns left 2/1/0"), passive name, Shy, Fleeting, Understood, Hush n, Veiled. More than 3 chips collapse to "+N" (expand on hover).
- Preview overlay while a card is selected: hatched ghost on the Intensity bar, callout "-12 OPPOSITE x2" (or "-3 x1/2 DISSONANT +1 Flare" with an arrow into the intent "8 -> 9"), face-turn arrow if the hit turns it, gauge change ("Pressure 5 -> 6: next move BOIL OVER"). Lethal replaces the callout with a banner (below).

**Intent icons** (unique shapes, never colour-only): Strike = jagged starburst (number, or "3x4"), Guard = shield, Afflict = the affliction's drop chip with stacks, Buff (Flare/gauge) = upward notched triangle, Mend = cross in a drop, Summon = small silhouette with "+", Scatter = two figures drifting apart. Combined intents show icons side by side. The tooltip gives the consequence: "Strikes for 8 (7 + 1 Flare). Your Guard blocks 5. You lose 3."

**Player panel**
- Wanderer avatar (SVG, 160px). Lantern flame colour = the Note's Light (split flame for two Lights; grey if empty or no Compass).
- Guard: translucent silver hexagon bubble + shield badge with the number left of the Heart bar.
- Heart bar 240x18 pearl, "54/70" inside. Predicted loss = hatched segment at the fill's right edge (this turn's Seething tick + enemy strikes after Guard, from `preview({t:'endTurn'})`). "Incoming" line lists parts. If predicted loss >= Heart: bar outline pulses and the line reads "Lethal: you will fall" with a broken-heart icon. Mend previews show a bright outline extension "+4".
- **Inward target:** when a selected card can be played Inward, a heart-shaped outline appears around the avatar labelled "INWARD" with a preview: "Clear 2 Seething. Tend Buried Anger (W2 -> W1)." Not shown when illegal.
- Afflictions row: drop chips (ink body, cure-colour rim, Shade sigil, stacks). Tooltip: "Seething 2: at the end of your turn you lose 2 Heart, then it drops to 1. Love cards soothe 1. Play Love Inward to clear it all."
- Companions row (only after you first own a Companion card): three 56px slots with icon, action number, and a dotted line to the last target. While you have Isolated the slots grey out with the label "Isolated: won't act".
- Promise tray: pending Promises that target you ("Next turn: +5 Guard, draw 1").

**Compass HUD (200x200, bottom-left)**
- Before The Compass: only the Spirit orb. When granted, the ring grows out of the orb (1.2 s).
- Ring of 6 segments clockwise from the top: Love, Joy, Friendship, Courage, Hope, Calm, each with its sigil (24px). In Act 1, Hope and Calm are dark ("Awakens in Act 2"). Segments for Lights you own no cards of are dimmed.
- Centre: Spirit orb 72px, "3" large, "/3" small; Hollow draws a crack across it.
- **Note:** the Note's segment(s) fill bright with a notch; the two neighbours get a pulsing outline and a small chevron ("next"). Label under the ring: "Harmonies this turn: 2".
- Outer markers: outside each segment, a 14px ink sigil of the Shade that Light cures; its rim lights up while that Shade (showing face) is in the fight. Hover: "Love answers Anger." A small grey arrow from each segment to the next segment's marker shows the DISSONANT rule ("Love alone deepens Sadness").
- Edges: hovering the edge between two segments shows the Blend name. A two-faced Shade in the fight makes its matching edge glow.
- Isolated lays grey fog over the ring ("Isolated 1"); a Friendship play blows it away.

**Hand and card face (130x182)**
- Auto-sorted in wheel order so a Harmony walk reads left to right. Sort key: mono Light index `i` -> `2i`; Blend `(i, i+1)` -> `2i+1` (Compassion -> 11); Insight -> its Light's key; neutral -> 12; Buried -> 13; ties by name then uid. Hovered card rises to 1.12x, neighbours shift 24px.
- Frame: 4px border in the Light colour + its pattern; Blend cards are split diagonally.
- Cost gem (top-left, 30px pearl circle, 18px number). Unaffordable: outline gem, card at 60% brightness. Restless: raised cost with an up-tick until the first card is played.
- Sigil badge (top-right 28px), name (14px bold, 1 line), art band (70px, procedural motif from the sigil), rules text (13px, max 3 lines; numbers bold 16px and contextual: with no target hovered they include your own Nerve/Heavy/Trembling; with a target focused they are the final number with an up or down triangle), footer "LOVE . EASE" (10px caps).
- Context chips above the card (max 2, priority order): `Tends Buried Fear`, `HARMONY -> Delight`, `Soothes Heavy`.
- Greyed (Numb) card: desaturated with "NO LIGHT" footer on the first card slot until a card is played.
- States: playable (soft pearl glow), selected (lifted 40px, 1.15x, bright outline), unaffordable (dimmed).
- **Buried cards:** ink body, cracked border in the cure's colour, Weight pips (1 to 3), text per 6.10. When an eligible Light card is selected, an SVG thread of light joins the two cards and the Inward target lights up.
- **Insight cards:** pearl frame with an iridescent six-hue sheen, label "INSIGHT" (no gold: gold belongs to Joy).

**Targeting flow** (click, tap or keyboard only: no drag, no target-first hover)
1. Select: click or tap a card, or keys 1-9, 0. All valid targets (Shades and, if legal, INWARD) show previews at once.
2. Confirm: click or tap a Shade or the INWARD heart, or cycle with Left/Right (INWARD is the leftmost target) and press Enter/Space.
3. Untargeted cards: click or tap the card then the stage, or press Enter. ALL cards preview on every Shade.
4. Cancel: Esc, right-click, or clicking the card again.

**Lethal banners** (replace the callout on the target)
- RESOLVE: banner in the finishing Light's colour, sunburst, "RESOLVE", sub-line "+8 Glimmers . Caution: +6 Guard". Surfaced Shade: "Insight: Passion joins your hand" or, if that Insight was already created this run, "Buried Anger is released".
- DEEP RESOLVE: two-colour banner, "DEEP RESOLVE", both Afterglows listed.
- SUPPRESS: ink banner, pearl text, seal, "SUPPRESS", sub-line "Buried Anger joins your deck (Weight 1)" or "Buried Anger W2 -> W3" or "Buried Anger is full: lose 3 max Heart". Surfaced Shade: "The Numbness +20 Intensity" (10 x Weight; "Apathy +10 Intensity" at W1). If another card in hand could Resolve this target this turn, add "Resolve with: Kind Word" and make that card glow.
- FADES: grey banner (Fleeting).
- WAVERING: Companion/Promise previews show "stops at 1".

**Play Line** (y 470-492, `aria-live="polite"`): one sentence whenever a card is selected and a target is focused. Example: *"Kind Word -> Grumble: 12 (OPPOSITE x2). Finishes it: RESOLVE, +8 Glimmers, Conviction +1 Nerve."*

**Piles, End Turn, Undo, Log**
- Draw pile count under the Compass; click or D opens a grid grouped by Light (order hidden). Discard pile in the right column (F). Buried count in the top bar.
- End Turn button 180x56 "End Turn (E)". If Spirit and a playable card remain: second line "2 Spirit unused" (information, no confirmation). Pulses gently when nothing is playable. From turn 30, a "Turn 32/40" counter sits above the button (the run is lost at the end of turn 40, 4.17).
- Undo (Z): undoes the last card played this turn if the engine flagged it `revealedHiddenInfo = false` (no draw, no shuffle). Disabled tooltip gives the reason ("New cards were revealed").
- Log (L): slide-out panel with every event in plain text.

**Enemy turn presentation:** banner "The Shades stir" (250 ms). Shades act in order: each steps 60px toward the player, acts, returns (about 300 ms per action at 1x). Whole enemy phase <= 1.5 s at 1x (1.45 s with 4 Shades). Next intents pop in immediately. Input is never blocked more than 250 ms; any click or Space fast-forwards the queue.

### 16.3 Title and Charm select
- Title: game name (serif), premise text on first launch only, buttons Continue (if a save exists), New Run, Codex, Settings. Background: slow ink-water drift with six faint Light motes.
- New Run: if `tutorialDone` can't be read (blocked storage), a "Skip tutorial" option appears so the player isn't sent through the tutorial every time.
- Charm select (not on the profile's first run): 4 large cards (Warm Locket, Sun Charm, Woven Bracelet, Brave Pebble) showing effect and the added card; keys 1-4, Enter.
- First run: Begin drops straight into combat `enc.t1` (the map appears after it). Goal: first card played within 20 s of pressing Begin.

### 16.4 Map screen
- Centre column x 240-1040: vertical scroll, start at the bottom, boss at the top.
- Left panel x 16-224: Heart, Glimmers, Keepsakes, Buried cards (with Weight), Numbness meter.
- Right panel x 1056-1264: legend (icon + label for every node kind, always visible) and the detail card of the hovered/focused node.
- Nodes (56px circles, unique icons): Fight = ink circle with the Shade sigils; Elite = ink circle with a spiked double ring + sigils; Haven = lantern; Sanctuary = open door with a Glimmer; Memory = open book; Chest = small gift box; Boss = 80px circle with its silhouette.
- States: visited (filled, solid trail), reachable (pulsing ring + key number 1-4), unreachable (40% opacity). Future edges dotted, travelled solid; hover brightens the route to that node.
- Node detail card (engine-computed): "Fight: Fear + Anger. Fear inflicts Trembling. Your deck: 2 cards OPPOSITE to Fear (Courage), 2 OPPOSITE to Anger (Love), 2 DISSONANT to Fear (Friendship). Rewards: card, Glimmers." The counts use only `ease` cards, the same definition as "most common Light" (12.2).
- Light Mix bar (x 240-1040, y 680-704): one segment per Light in wheel order with sigil and count; Blends split; Buried = ink segment with cure rim; Insight = pearl. Click -> deck view.
- Keys: 1-4 or Left/Right to pick a reachable node, Enter to travel, Up/Down to scroll, D deck, C Codex.

### 16.5 Reward screen
1. Outcome strip (top, 1.2 s, skippable): per non-Fleeting Shade a tile: Resolved (light mote, "Resolved", "+8"), Deep Resolved (two-colour mote), Suppressed (sealed ink tile with a mini Buried card; hover shows its text and how to Tend it).
2. Reward stack (centre): Glimmers (auto-added, count-up), The Compass (2nd win only, with a 3 s ring demo), Keepsake (elite/chest/boss), "Choose a card".
3. Card choice: 3 or 4 cards at 1.4x. Under each: "Answers: [Anger] x2", "Harmonizes with: Joy, Calm" (mini Compass), "DISSONANT vs: [Sadness]", and "Tends: Buried Anger" if relevant. The Light Mix bar shows a "+1" ghost for the hovered card. Skip (S).
4. Continue (Enter).

### 16.6 Other screens
- **Haven:** three large options with outcomes: "Rest: Heart 40 -> 61", "Kindle: upgrade a card" (before/after), "Reflect: Tend a Buried card (W2 -> W1)".
- **Sanctuary:** shelves (Light cards, Blends, neutral, Keepsakes), prices, sale tag, services, Light Mix preview on hover, Mo's line in a speech bubble.
- **Memory:** illustration panel (procedural SVG motif), italic text, 1 to 3 option buttons with bracketed results.
- **Deck view (D):** grouped by Light in wheel order, Blends, neutral, then Insight and Buried groups; upgrade toggle.
- **Deck select (remove/upgrade/transform/duplicate/Tend):** same grid, eligible cards highlighted, confirm button.
- **Codex (C):** tab 1: 6x6 chart with x2 / x1/2 marks and the bad-advice lines (opposites always shown; a Shade's row fills in once met). Tab 2: Blends, compounds and which Blend answers each. Tab 3: afflictions. Tab 4: rules summary (4.2 to 4.16 in one sentence each).
- **Settings:** master/SFX/ambience volume, mute (M), animation speed (1x, 2x, Instant), reduced motion (default follows `prefers-reduced-motion`), colour-blind palette, reset tips. (Pattern strength and UI scale settings are cut, 24.2.)
- **Pause (Esc with nothing selected):** Resume, Settings, Codex, Abandon run.
- **Act transition / The Deep title cards** per 15.1. **Victory / Defeat** per 15.2 to 15.4.

### 16.7 Procedural Shade silhouettes (SVG, no bitmaps)
Each instance varies by a UI-side hash of its uid (not the engine RNG): height +/-10%, spike count, eye/limb count, sway timing, crack path. One path generator per family (`EnemyDef.visual.family`). All variety comes from the uid hash.

| Shade | Silhouette | Idle | Crack glow | Flare look | Resolved form |
|---|---|---|---|---|---|
| Anger | hunched, broad, crown of 5 to 9 spikes | fast breathing (scale 0.98 to 1.02 per 0.8 s), heat shimmer (one distortion filter) | Love rose | spikes lengthen per stack | ember curling into a heart-shaped flame |
| Sadness | tall, drooping raincloud hood, long arms | slow 4 s sway, falling tears | Joy gold in the chest | hood darkens | gold drop opening into a small flower |
| Loneliness | small figure set back inside a wide empty ring | slow drift, glances at others | one green point | ring widens | green firefly circling your avatar |
| Fear | spindly, many limbs, 3 to 7 eyes | 1px shiver at 12 Hz, seeded blinks | orange irises | more eyes open | spark standing up into a small flame figure |
| Despair | a pit with a figure sinking into it | particles flow inward and down | violet glint at the bottom | pit widens | violet star rising |
| Anxiety | tangled scribble mass with small arms | constant vibration, scribble redraws | sky-blue threads | tangles thicken | ripple settling into a still circle |
| Doubt | question-mark wisp | bobbing | orange flicker | n/a | pops |
| Compounds | the outer face's silhouette plus a sigil badge of the inner face (the badge lights while the inner face shows) | outer face idle | showing face's cure | as face | both forms at once |
| The Mask | floating mask with an ink hood; face changes crossfade between the four sigils | slow rotation; next face on the forehead | eyes in the showing face's cure | cracks spread | falls away to a pearl face |
| Apathy / The Numbness | smooth featureless grey oval (Apathy smaller, slouched) | deliberately still, faint static | none until a FELT hit, which leaves a lasting two-colour crack | n/a | every crack colour floods out at once |

Hover reactions (extra feedback only): hovering an OPPOSITE card makes the Shade flinch back 6px; a DISSONANT card makes it swell 3% and glow brighter.

---

## 17. Introduction order and coach marks

### 17.1 Tutorial run (profile's first run)
| Step | Encounter | New this fight | Deliberately absent | Success signal |
|---|---|---|---|---|
| T1 (row 1) | `enc.t1` Little Grumble (18; strikes 5, 6, 7) | Spirit, playing cards, intents, Guard, OPPOSITE x2, lethal preview, RESOLVE, Afterglow, Glimmers | Dissonance, afflictions, passives, multiple Shades, Harmony | Resolves with Love |
| T2 (row 2) | `enc.t2` Little Mope (22) | DISSONANT x1/2 and Flare, taught through Love (T1's hero card); Shade Guard | afflictions, passives | Sees the DISSONANT preview and switches to Joy |
| after T2 | Reward: **The Compass** + card choice whose slot 3 is an Act 1 Blend (Sunbeam, "Tag, You're It!" or Shoulder to Shoulder) | Harmony, Compass HUD, the Note | | |
| T3 (row 3) | `enc.t3` Little Echo (24) + Little Mope (14) | Two Shades, targeting, Harmony: Bright Spark then Reach Out = Playfulness, x2 on both. Joy alone vs Echo is DISSONANT (trap the preview reveals) | afflictions, passives | At least one Harmonized play |
| T4 (row 4) | `enc.t4` Little Skitter (24) + Grumble (28-30), both at pattern offset 0 | Afflictions (Trembling), outward soothing, **Inward** (coach mark), first passive chip (Short Fuse). First Suppress is likely here | Doubts | Clears an affliction (outward or Inward) |
| Chest (row 5) | Keepsake | Keepsakes | | |
| Rows 6-8 | Act 1 standard pool + elites | Passives (Wallow, Last One Left), Seething, Isolated, Fleeting Doubts, gauges (Kettle) | | |
| Boss | The Mask | Faces turning, choosing its move by turning it | | |

**Kind opening hands (tutorial T1 to T4 only):** after the shuffle, if none of the top 5 cards is OPPOSITE to a Shade in the fight, swap the first such card in the draw pile into position 5.

Taught when they first happen (any run, first time per profile):
- Buried cards: on the first SUPPRESS preview (banner note), on the reward outcome tile, and when the first Buried card is drawn (coach mark + light thread if an eligible Light card is in hand).
- Companions: first reward offering one (tooltip), first summon (coach mark on the slot).
- Weight: first time a Buried card reaches Weight 2.

### 17.2 Acts 2 and The Deep
- Act 2 start: "The wheel closes" cinematic; rows 1-2 are single Fret or Slump (Worry and Restless; Hollow and Heavy Silence); row 3 is a lone compound (Old Grudge, Longing or Dread): coach mark C14. The matching Compass edge glows.
- Apathy (Act 2 elite): coach marks for MUFFLED/FELT and Surfacing. The Numbness meter already sits in the top bar from your first Buried card.
- The Numbness: coach mark "One feeling isn't enough here. Feel two at once."

### 17.3 Coach marks
First run of a profile; never block input; one visible at a time, others queue; max 18 words; anchored with an arrow; dismissed by the relevant action or a click; each shows once per profile; Settings has "Reset tips". Braced names (`{Shade}`, `{Light}`, `{Card}`, `{Affliction}`, `{line}`) are filled from the trigger event, never hard-coded.

| id | Trigger | Anchor | Copy |
|---|---|---|---|
| C1 | T1 start | Shade intent | "Shades show their next move. This one will strike for 5." |
| C2 | T1 start | Kind Word | "Kind Word is Love. Love is Anger's opposite, so it Eases double." |
| C3 | T1, Spirit reaches 0 | End Turn | "Out of Spirit. End your turn and you get 3 back." |
| C4 | first RESOLVE preview | banner | "Finish a Shade with its opposite to Resolve it. It heals instead of vanishing." |
| C5 | first DISSONANT preview | x1/2 badge | "'{line}' {Light} alone deepens {Shade}: half, and it Flares." ({line} = that Shade's exact bad-advice line, 4.2; T2 gives "'At least you have people who love you.' Love alone deepens Sadness: half, and it Flares.") |
| C6 | Compass granted | Compass | "The Compass remembers your last Light. Its neighbours Harmonize and count as both." |
| C7 | first Harmony chip in hand | that card | "{Card} sits next to {Light}. Play it now and it counts as both." ({Light} = the Note Light it would gain) |
| C8 | first SUPPRESS preview | banner | "Not its opposite, so this Suppresses it. You'll carry it as a Buried card." |
| C9 | first affliction received | affliction chip | "{Affliction} {short effect}. {Light} soothes it. Play {Light} on yourself to clear it." ({short effect} from the affliction's tooltip, e.g. "Trembling weakens your Guard."; not shown for Numb) |
| C10 | first INWARD target shown | Inward outline | "Drop a card on yourself: clear your feeling and Tend what you buried." |
| C11 | first Buried card drawn | that card | "Buried {Shade} hurts while held. Play {Light} Inward to Tend it." |
| C12 | first Wavering | Shade | "Companions never finish a Shade the wrong way. Finish it yourself." |
| C13 | first map | legend | "Sigils show which Shades wait on each path. Pick fights your deck answers." |
| C14 | first two-faced Shade | nameplate | "Two feelings. OPPOSITE hits turn it. A Blend answers both at once." |

---

## 18. Juice (CSS transforms/opacity, SVG, WebAudio only)

### 18.1 Motion
| Moment | Effect | Timing | Reduced motion |
|---|---|---|---|
| Card hover | lift 28px, scale 1.12, neighbours spread 24px, tilt toward cursor up to 5 deg | 120 ms ease-out | no tilt |
| Card play | card shrinks and flies to its target | 180 ms ease-in | fade in place |
| Inward play | card flies into the avatar's heart; a ring of the card's colour pulses outward; affliction chips dissolve | 250 ms | fade |
| Impact | Shade squash (1.08 wide, 0.92 tall), recoil 10px, white flash as an opacity overlay. Impacts within 333 ms merge into one flash; the extra impacts use squash only | 90 ms | flash at 30% only |
| Hit-stop | stage animations paused (`animation-play-state`) | 60 ms OPPOSITE hit, 110 ms Resolve | off |
| Floating numbers | rise 40px, fade in last 250 ms. OPPOSITE: 40px bold in Light colour, "x2" tag, pop 1.3 -> 1.0. Neutral: 28px pearl. DISSONANT: 22px grey, drifts down 12px, bad-advice line in italics for 1.2 s. FELT: two-colour 40px. MUFFLED: 22px grey. | 700 ms | fade only |
| Intensity / Heart lag | bar drops instantly, pale lag chunk drains | 400 ms delay, 300 ms drain | same |
| Flare gained | intent number flips like an odometer, Shade grows 4% per stack | 200 ms | number change only |
| Face turn | nameplate sigil flips like a card; a compound's inner-face badge lights or dims; The Mask's face crossfades | 300 ms | crossfade |
| Harmony | Compass draws a bright arc from the old Note to the new segment; card trail blends both colours; "HARMONY" pops beside the Compass | 250 ms | arc without draw animation |
| Resolve | 110 ms hit-stop, soft radial bloom (peak opacity 0.3), ink dissolves outward from the cracks (animated SVG mask), the light form rises and flies to the Glimmer counter, background lightens one step, stage breathes (scale 1.00 -> 1.015 -> 1.00) | about 1.1 s, input free after 250 ms | crossfade to the mote |
| Deep Resolve | as Resolve with two-colour bloom and both forms | about 1.3 s | crossfade |
| Suppress | Shade crushed down (to 10% height, down 40px), ink seal closes over the spot, 8px vertical shake, 20% desaturation for 400 ms, a mini Buried card flies to the deck counter ("+1 Buried" or "W2") | about 900 ms | no shake, desaturation only |
| Tend | Buried card shakes, a crack mends with a line of the cure colour (kintsugi) | 400 ms | crossfade |
| Buried -> Insight | cracks flare, card flips into the Insight with a sheen sweep; *"Oh. So that's what it was."* | 700 ms | crossfade |
| Buried released (Insight already created) | cracks mend fully, the card fades to pearl and drifts away; *"You've already made peace with this one."* | 700 ms | fade |
| Player hit | dark vignette pulse, Heart lag chunk, avatar flicker, horizontal shake 4px (8px if the hit is 20%+ of max Heart) | 180 to 300 ms | vignette only |
| Guard | silver hexagon bubble cracks when hit, shatters into 6 shards when broken, "Blocked 5" floats | 250 ms | fade |
| Enemy strike | lean back 80 ms, lunge 60px in 80 ms, return | 300 ms | step forward only |
| Buried in hand | ink wisps rise, cure-colour cracks pulse | 2 s loop | static cracks |
| Low Heart (< 30%) | edge vignette pulses with a heartbeat sound | 1.1 s loop | static vignette |
| Surfacing | grey water ripples; each Surfaced Shade rises from the floor; the boss's veil thickens | 1.2 s | fade in |
| Map travel | path draws to the chosen node, which pops | 400 ms | instant |
| Reward cards | deal in with 60 ms stagger; rare cards get a sheen sweep | 300 ms | fade |
| The wheel closes | Hope and Calm segments ignite, ring stroke completes, chord | 1.5 s | static + chord |

Ambient: the background takes a faint tint from the Shades' crack glows; it lightens one step per Resolve; a Suppress leaves a small ink smudge on the stage floor for the rest of the fight; act backgrounds warm slightly over the run.

### 18.2 Audio (WebAudio synthesis, no files)
- One `AudioContext`, created on first input. Chain: master -> compressor -> destination, with SFX, UI and ambience buses. One 1 s noise buffer generated at boot; reverb impulse from decaying noise.
- **Light voices** (pentatonic in wheel order, so walking the wheel plays a rising scale): Love C5 soft sine, slow attack; Joy D5 triangle pluck; Friendship E5 two detuned saws through a lowpass; Courage G5 square through a lowpass (brassy); Hope A5 sine with octave shimmer; Calm C6 sine, long release, reverb.
- OPPOSITE hit: the note + its octave. DISSONANT: the note + a second oscillator one semitone up, fast decay, slight downward bend. FELT: two Light notes together. MUFFLED: the note through a 400 Hz lowpass.
- Harmony: previous and current notes sound together; a chain keeps adding notes.
- Resolve: major arpeggio from the Light's root (3 notes, 60 ms apart) + filtered-noise shimmer. Deep Resolve: arpeggio of both roots.
- Suppress: thump 80 -> 40 Hz, low-passed noise, a tritone pair.
- Inward: soft reversed swell into the Light's note.
- Shade strikes: band-passed noise + low sine, flavoured by type (Anger harsh and distorted, Sadness low-passed long release, Fear fast tremolo, Loneliness thin sine with long echo, Anxiety rapid ticks, Despair very low sub-thud).
- UI: quiet hover tick, whoosh on play, pluck on Spirit spent, dull double-thud for "not enough Spirit", Glimmer ticks (max 12 per count-up).
- Ambience: per-act drone (two detuned oscillators, slow filter drift); the filter opens a notch per Resolve in the fight. The Deep: almost silent, a single sine.
- Every sound has a visual equivalent; muting loses no information.

### 18.3 Performance budget
60 fps on a mid-range laptop. HTML elements animate only `transform` and `opacity`. At most 2 SVG attributes animate at once (for example a Resolve's dissolving mask and a crack path). The impact flash is an opacity overlay, not a filter, so Anger's heat shimmer is the only animated SVG filter on screen (drop it when 2+ Anger Shades). Hit-stop pauses animations (`animation-play-state`) and animates nothing. At most 60 particle nodes; pooled floating-number elements. Animation queue auto-speeds to 2x when 3+ events are waiting.

---

## 19. Accessibility

- **Never colour alone:** every signal has colour + shape + text:

| Information | Colour | Shape | Text |
|---|---|---|---|
| Light type | hue | sigil + frame pattern | footer and chip type word |
| Shade face | ink + crack glow | own sigil + silhouette | nameplate |
| OPPOSITE / DISSONANT | Light colour / grey | double up-chevron / down-chevron | "OPPOSITE x2" / "DISSONANT x1/2" |
| FELT / MUFFLED | two colours / grey | double ring / single ring | "FELT x2" / "MUFFLED x1/2" |
| RESOLVE / SUPPRESS | Light colour / ink | sunburst / seal | "RESOLVE" / "SUPPRESS" |
| Number up / down | Light colour / grey | up / down triangle | the number |
| Harmony | two-colour border | ring badge | "HARMONY -> Delight" |
| Heart / Guard | pearl / silver | heart / shield | numbers |
| Weight | cure-colour rim | 1 to 3 pips | "Weight 2" |
| Intents, map nodes | not used | unique icon each | legend + tooltip sentence |

- Colour-blind palette (Okabe-Ito, 16.0); pattern overlays always on (one strength, no setting); `?gray=1` URL switch applies `filter: grayscale(1)` to the root and every screen must stay playable.
- **Keyboard (complete play without a mouse):**

| Key | Combat | Map | Reward / shop / event |
|---|---|---|---|
| 1-9, 0 | select card 1-10 | pick reachable node | pick option |
| Left / Right | cycle targets (INWARD first) or hand focus | cycle nodes | cycle options |
| Up / Down | move between hand and Shade row | scroll | |
| Enter / Space | play on focused target / confirm | travel | take |
| Esc / right-click | cancel or close; with nothing selected opens Pause | menu | back |
| E | end turn | | |
| Z | undo (if allowed) | | |
| Tab / Shift+Tab | move focus between regions | regions | regions |
| Shift (hold) | math breakdown | | |
| D / F | draw pile / discard pile | deck | deck |
| C / L / M | Codex / log / mute | Codex | Codex |
| S | | | skip |
| T | pin tooltip | pin tooltip | pin tooltip |

  Roving focus inside regions; focus ring 2px pearl with 2px offset, never removed; after a play, focus moves to the next card.
- **Math breakdown (Shift):**
```
Kind Word                 6
Nerve                    +1
Heavy                   x3/4
OPPOSITE Joy > Sadness   x2   (Harmonized: Love+Joy)
                       = 10
Guard absorbs            -4
Intensity          42 -> 36
```
- **Motion:** follows `prefers-reduced-motion` by default plus an in-game switch (removes shake, hit-stop, bloom, tilt, particle bursts; fallbacks in 18.1). Flashes <= 30% opacity and <= 3 per second (impacts within 333 ms merge into one flash, 18.1); no full-screen strobe.
- **Text:** body 14px at reference size, chips >= 12px, key numbers >= 16px; WCAG AA contrast (4.5:1); caps only for 1-2 word labels; tooltip lines <= 60 characters.
- **Screen readers:** cards, Shades, map nodes and options are `<button>` elements with labels built from engine data ("Kind Word, Love, cost 1. Ease 6. Against Grumble: 12, opposite, lethal, Resolve."). Play Line and log are `aria-live="polite"`. The enemy phase is announced once as a summary ("Grumble struck for 8. Guard blocked 5. You lost 3 Heart.").
- **Input and pacing:** click/tap/keyboard only (there is no drag targeting); every tappable element >= 56 reference px (16.0); no timers; pause anywhere.

---

## 20. Engine architecture and data model

Stack (fixed, already in the repo): TypeScript 6.0.3, Vite 8.3, Vitest 5.0.1, vite-node 6.0, Node 22.22. tsconfig has `strict`, `verbatimModuleSyntax` (always `import type` for types), `noUnusedLocals`, `noUnusedParameters`.

### 20.1 Principles
1. **Pure reducer over plain JSON.** `createEngine(pack)` returns an `Engine`. `step(state, action) -> { state, events }` never mutates its input. The UI and every bot use exactly the same API.
2. **No DOM, no `Math.random`, no `Date.now`/`performance.now` in `src/engine` or `src/content`.** All randomness comes from seeded streams.
3. **The engine never imports content.** Content is a `ContentPack` passed to `createEngine`. Engine tests use `tests/fixtures/miniPack.ts`.
4. **Data-first content.** Cards, statuses, Shades, Keepsakes, events are data in a small effect DSL. At most 10 named custom hooks (`op: 'custom'`), each unit-tested; v1 expects 0 to 3.
5. **One damage pipeline** (`computeHit`, 5.4). Preview, intents, card-face numbers and bot beliefs all call it.
6. **Preview is the real interpreter run on a clone** in sealed mode; a property test proves preview == result.
7. **Only `primitives.ts` mutates** hp, guard, energy, statuses, piles, faces; each mutation emits exactly one event.
8. **Internal names are mechanical** (`hp`, `guard`, `energy`); display words live in `src/content/glossary.ts`.

### 20.2 File layout
```
index.html                         Vite entry
tsconfig.json                      existing (DOM lib, all folders, plus vitest.*.config.ts in include)
tsconfig.engine.json               NEW: lib ["ES2022"], types [], include src/engine and src/content only -> any DOM or Node use fails typecheck
tsconfig.sim.json                  NEW: lib ["ES2022"], types ["node"], include sim (node:util, child processes, fs)
vite.config.ts                     existing (npm test, excluding tests/slow/** and tests/balance/**)
vitest.slow.config.ts              NEW: tests/slow/** (preview-vs-step 300 seeds, map 2000 seeds, determinism 50 seeds, perf)
vitest.balance.config.ts           NEW: tests/balance/**, testTimeout 120000

src/engine/
  index.ts          createEngine(pack): Engine (the only module UI/sim may import from engine, and it re-exports every type
                    from types.ts and emotions.ts). Run-side owner: wires combat/index.ts and run/**
  types.ts          THE CONTRACT: all state/def/action/event/preview types (lead-owned)
  emotions.ts       wheel, cureOf, dissonantShadeOf, adjacent, across, blendOf, relationOf, harmonize, lethalOutcome
  rules.ts          RulesConfig + DEFAULT_RULES
  dsl.ts            builders for content: ease(6), guard(5), mend(2), status('warmth', 2, 'self'), promise([...]), ifH([...])
  rng.ts            mulberry32, hash32(...parts), streams, sealedRng (preview)
  damage.ts         computeHit / computeGuard / computeMend / computeStrike (pure) + recombine() for bot beliefs
  primitives.ts     the ONLY mutators; each emits a GameEvent
  interpreter.ts    runEffects + FIFO trigger queue + pending-choice continuations
  conditions.ts     evalCond, evalAmount
  clone.ts          cloneCombat / cloneState (hand-rolled recursive clone for plain JSON)
  combat/index.ts   the combat module's public API: startCombat, combatLegalActions, stepCombat,
                    previewCombat, buildCombatResult, intents, handHints, cardText
                    (consumed by step.ts and index.ts)
  combat/setup.ts   startCombat(run, node) incl. Surfacing and the Numbness's hidden-Weight growth
  combat/turn.ts    5.2, 5.6 phases
  combat/play.ts    5.3 (Harmony, cost, Note, cleanse, Inward, effects)
  combat/enemy.ts   5.7 snapshot order, intents, patterns, overrides, byFace, phases
  combat/lethal.ts  R-8 outcomes, R-8b win check, Afterglows, Buried bookkeeping, Insight once per run, Fade, Wavering
  combat/finish.ts  buildCombatResult
  combat/legal.ts   combat legal actions (incl. Inward legality, Shy, Veiled)
  combat/preview.ts preview(): cloneCombat + sealed interpreter + summarize
  combat/view.ts    intents() (IntentView incl. the projected after-end-of-turn intent, 5.7.1), handHints(), cardText()
  run/newRun.ts     starter deck, Charm, tutorial flag, Act 1 map
  run/map.ts        section 11 generation + reachability
  run/rewards.ts    section 12
  run/shop.ts  run/haven.ts  run/events.ts  run/progression.ts (acts, The Deep, victory/defeat)
  run/finishCombat.ts  (run, CombatResult) -> run (Buried Weight, overflow, Insight transforms, Buried removals,
                    insightsMade, Paper Crane)
  run/legal.ts
  run/view.ts       nodeDetail(), deck and Light-mix summaries (most common Light, 12.2)
  step.ts           dispatch: handlers[phase.kind][action.t]
  serialize.ts      toJSON/fromJSON, version check, FNV-1a hash of canonical JSON
  invariants.ts     assertInvariants(state) (tests and sim --strict)

src/content/        DATA. May import only engine/types, engine/dsl, engine/rules.
  index.ts          export const defaultPack: ContentPack
  glossary.ts       hp -> "Intensity"/"Heart", energy -> "Spirit", flare -> "Flare", nerve -> "Nerve", ...
  rules.ts          designer overrides of DEFAULT_RULES (empty at start)
  cards/{starter,love,joy,friendship,courage,hope,calm,blends,neutral,buried,insight}.ts
  statuses.ts  companions.ts  keepsakes.ts  events.ts  encounters.ts  afterglows.ts  lines.ts (barks, farewells, bad-advice lines)
  enemies/{act1,tutorial,act2,deep}.ts
  custom.ts         named custom hooks (<= 10)

src/ui/
  main.ts           boot, URL params (?seed=, ?debug=1, ?encounter=, ?gray=1)
  app.ts            controller: holds GameState, dispatch(action), autosave
  dom.ts            h() + keyed list reconcile (~100 lines)
  anim/queue.ts     GameEvent[] -> Web Animations; skippable; speed 1x/2x/instant
  screens/          title charm map combat reward wheelCloses shop haven event deck codex settings victory defeat
  components/       card shade intent statusChip compass tooltip banner floatingNumber playLine heartBar
  shade/generate.ts procedural SVG from EnemyDef.visual + uid hash (UI hash, never engine RNG)
  audio/synth.ts    WebAudio voices (18.2)
  styles/tokens.css, *.css

sim/
  cli.ts            node:util parseArgs: --bots --runs --seed-start --shard k/n --set rules.x=v --policy --out --strict
  parallel.ts       spawn N vite-node child processes, merge JSON
  runner.ts         playRun(engine, seed, bot) -> RunRecord (metrics reduced from events on the fly)
  lab.ts            fixed deck x encounter x seed combat benchmark
  bots/ types.ts random.ts belief.ts greedy.ts runPolicy.ts policies.ts
  metrics.ts  stats.ts (Wilson CI, McNemar, paired bootstrap)  report.ts (markdown + JSON to sim/out)

tests/
  architecture.test.ts   import graph + banned APIs + mutation grep
  helpers/scenario.ts    fluent combat scenario builder
  fixtures/miniPack.ts   6 cards, 3 Shades, 2 statuses, 1 Keepsake
  engine/*.test.ts  content/registry.test.ts  property/*.test.ts (30 seeds)  contract/engine.contract.test.ts
  slow/*.test.ts         (vitest.slow.config.ts only: 300-seed preview-vs-step, 2000-seed map, 50-seed determinism, perf)
  balance/*.test.ts      (vitest.balance.config.ts only)
```

**Layering rules** (enforced by `tests/architecture.test.ts` with `fs` + regex, no ESLint): `src/engine/**` must not import `src/content`, `src/ui`, `sim`, and must not contain `Math.random`, `Date.now`, `performance.now`, or match `\b(document|window)\.` (engine only, and the trailing `.` lets a comment that merely mentions the word pass). `src/content/**` imports only `engine/types`, `engine/dsl`, `engine/rules`. `src/ui/**` and `sim/**` import only `engine/index` and `content/index`, so `engine/index.ts` must re-export every type they use. Outside `primitives.ts`, the regex `\.(hp|guard|energy)\s*([-+*/]?=(?!=)|\+\+|--)` (assignments, compound assignments and increments, not comparisons) and pile-array writes (`piles.<name>.push/splice/=`) fail the test.

**package.json scripts** (final set: dev, build, preview, test, test:watch and sim already exist, typecheck is extended, test:slow and test:balance are new):
```json
"dev": "vite",
"build": "tsc --noEmit && vite build",
"preview": "vite preview",
"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.engine.json && tsc --noEmit -p tsconfig.sim.json",
"test": "vitest run",
"test:watch": "vitest",
"test:slow": "vitest run -c vitest.slow.config.ts",
"test:balance": "vitest run -c vitest.balance.config.ts",
"sim": "vite-node sim/cli.ts"
```

### 20.3 Core types (`src/engine/types.ts` + `emotions.ts`)

> **Canonical source (v1.1 lead note):** the committed files `src/engine/types.ts`, `src/engine/emotions.ts`, `src/engine/damage.ts`, `src/engine/rules.ts`, `src/engine/dsl.ts`, `src/engine/rng.ts` and `src/engine/combat/index.ts` ARE the contract. The snippets in 20.3 to 20.7 describe the same model and are kept for reading; where a name or field differs, the code wins (for example `MoodDef.oncePerEnemyPhase`, `DeckMutation { k: 'remove' }`, event `peace`, `run.insightsMade`, `EffectCtx.source`, `Phase.deckSelect.options`, `RewardOffer.then`, `IntentView.projected`). Additive changes to types.ts go through the lead.

```ts
// ---------- emotions.ts ----------
export const LIGHTS = ['love', 'joy', 'friendship', 'courage', 'hope', 'calm'] as const;
export const SHADES = ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety'] as const;
export const BLENDS = ['delight', 'playfulness', 'loyalty', 'determination', 'patience', 'compassion'] as const;
export type Light = (typeof LIGHTS)[number];
export type Shade = (typeof SHADES)[number];
export type Blend = (typeof BLENDS)[number];               // BLENDS[i] = LIGHTS[i] + LIGHTS[(i+1)%6]
export type Relation = 'opposite' | 'neutral' | 'dissonant' | 'felt' | 'muffled' | 'veiled';
export type AfflictionId = 'seething' | 'heavy' | 'isolated' | 'trembling' | 'hollow' | 'restless';
export const AFFLICTION_OF: Record<Shade, AfflictionId> = {
  anger: 'seething', sadness: 'heavy', loneliness: 'isolated', fear: 'trembling', despair: 'hollow', anxiety: 'restless',
};
const li = (l: Light) => LIGHTS.indexOf(l);
const si = (s: Shade) => SHADES.indexOf(s);
export const cureOf = (s: Shade): Light => LIGHTS[si(s)]!;
export const shadeCuredBy = (l: Light): Shade => SHADES[li(l)]!;
export const dissonantShadeOf = (l: Light): Shade => SHADES[(li(l) + 1) % 6]!;   // R-2 clockwise rule
export const adjacent = (a: Light, b: Light) => { const d = Math.abs(li(a) - li(b)); return d === 1 || d === 5; };
export const across = (a: Light, b: Light) => Math.abs(li(a) - li(b)) === 3;
export const blendOf = (a: Light, b: Light): Blend | null => {
  if (!adjacent(a, b)) return null;
  const lo = (li(a) + 1) % 6 === li(b) ? li(a) : li(b);
  return BLENDS[lo]!;
};

export type TargetTyping =
  | { rule: 'standard'; face: Shade; understood: boolean }
  | { rule: 'numb'; veiled: boolean };

export interface RelationOpts { fromCard: boolean; lightningRod: boolean }

/** R-2, R-2a, R-11, R-12, R-16. Returns relation + integer pct. */
export function relationOf(lights: readonly Light[], t: TargetTyping, o: RelationOpts): { relation: Relation; pct: number } {
  if (t.rule === 'numb') {
    if (t.veiled) return { relation: 'veiled', pct: 0 };
    return lights.length >= 2 ? { relation: 'felt', pct: 200 } : { relation: 'muffled', pct: 50 };
  }
  if (t.understood && o.fromCard) return { relation: 'opposite', pct: 200 };
  if (lights.length === 0) return { relation: 'neutral', pct: 100 };
  if (lights.some(l => cureOf(t.face) === l)) return { relation: 'opposite', pct: 200 };
  if (lights.some(l => dissonantShadeOf(l) !== t.face)) return { relation: 'neutral', pct: 100 };
  if (!o.fromCard) return { relation: 'neutral', pct: 100 };                 // automatic hits are never dissonant
  return { relation: 'dissonant', pct: o.lightningRod ? 100 : 50 };
}

/** R-4. A Blend Harmonizes only with an adjacent Note Light outside its own pair (Sunbeam after Sunbeam: false). */
export function harmonize(note: readonly Light[], printed: readonly Light[], o: { enabled: boolean; isolated: boolean; mirror: boolean }):
  { effective: Light[]; harmonized: boolean } {
  if (!o.enabled || o.isolated || printed.length === 0 || note.length === 0) return { effective: [...printed], harmonized: false };
  const partners = (l: Light) => note.filter(n => n !== l && (adjacent(n, l) || (o.mirror && across(n, l))));
  for (const own of printed) {
    const cands = partners(own).filter(n => !printed.includes(n));
    if (cands.length > 0) {
      const pick = [...cands].sort((a, b) => ((li(a) - li(own) + 6) % 6) - ((li(b) - li(own) + 6) % 6))[0]!;
      return { effective: printed.length === 2 ? [...printed] : [own, pick], harmonized: true };
    }
  }
  return { effective: [...printed], harmonized: false };
}

export type LethalOutcome = 'resolve' | 'deepResolve' | 'suppress' | 'wavering' | 'fade';
/** R-8. faces = the Shade's face list; face = showing face (null for numb rules).
 *  Numb rules: any FELT finishing hit Resolves, from a card or automatic (4.16), so there is no fromCard check. */
export function lethalOutcome(lights: readonly Light[], faces: readonly Shade[], face: Shade | null, rel: Relation,
  o: { fromCard: boolean; fleeting: boolean; understood: boolean }): LethalOutcome {
  if (o.fleeting) return 'fade';
  const resolves = face === null ? rel === 'felt' : (o.understood && o.fromCard) || lights.includes(cureOf(face));
  if (resolves) {
    const deep = faces.length === 2 && faces.every(f => lights.includes(cureOf(f)));
    return deep && o.fromCard ? 'deepResolve' : 'resolve';
  }
  return o.fromCard ? 'suppress' : 'wavering';
}

// ---------- types.ts ----------
export type Uid = number;
export type CardId = string; export type EnemyId = string; export type StatusId = string; export type KeepsakeId = string;
export type EventId = string; export type EncounterId = string; export type CompanionId = string;

export interface GameState {
  v: 1;
  contentHash: string;              // hash of pack ids + rules; saves from another build are discarded
  seed: number;
  nextUid: Uid;
  phase: Phase;
  run: RunState;
  combat: CombatState | null;       // non-null iff phase.kind === 'combat'
}

export type Phase =
  | { kind: 'charmSelect'; options: KeepsakeId[] }
  | { kind: 'map' }
  | { kind: 'combat'; nodeId: number }
  | { kind: 'reward'; offer: RewardOffer }
  | { kind: 'wheelCloses'; options: CardId[] }
  | { kind: 'shop'; stock: ShopStock }
  | { kind: 'haven' }
  | { kind: 'event'; eventId: EventId }
  | { kind: 'deckSelect'; purpose: 'remove' | 'upgrade' | 'transform' | 'duplicate' | 'tend'; filter: CardFilter; then: Phase }
  | { kind: 'victory'; ending: 'resolved' | 'suppressed' }
  | { kind: 'defeat'; cause: 'heart' | 'turnLimit' };

export interface RunState {
  heart: number; maxHeart: number; glimmers: number;
  deck: CardInstance[];
  keepsakes: KeepsakeInstance[];     // acquisition order = trigger order
  act: 1 | 2 | 3;                    // 3 = The Deep
  floor: number;
  tutorial: boolean;
  map: MapState;
  combatsWon: number;                // Compass at 2 (the Wishing Well's Echo fight counts)
  usedEvents: EventId[];
  shopRemovals: number;
  paperCraneUsed: boolean;           // written only between combats (via CombatResult.keepsakeCounters)
  insightsMade: CardId[];         // B3: each insight.* id at most once per run, even if it later leaves the deck
  stats: RunStats;
}

export interface CardInstance {
  uid: Uid; defId: CardId; upgraded: boolean;
  weight?: 1 | 2 | 3; peakWeight?: 1 | 2 | 3;   // Buried only
}

export interface CombatCard extends CardInstance {
  temp?: true;
  mem: { lingered: number; timesPlayed: number; tended: boolean };
}

export type StatusBag = Partial<Record<StatusId, number>>;

export interface CombatState {
  turn: number;
  energy: number;
  player: { hp: number; maxHp: number; guard: number; statuses: StatusBag };
  cards: Record<Uid, CombatCard>;               // combat copies keep the deck uid
  piles: { draw: Uid[]; hand: Uid[]; discard: Uid[]; letGo: Uid[]; moods: Uid[]; removed: Uid[] };
                                                // removed = Surfaced Buried, and Buried cards released because their Insight exists
  enemies: EnemyState[];                        // array order = position = action order
  companions: CompanionState[];                 // summon order
  note: Light[];                                // R-4
  lastTarget: Uid | null;                       // R-13
  turnFlags: { played: number; harmonies: number; firstCardDone: boolean; centerActive: boolean;
               prismUsed: boolean; tuningForkUsed: boolean; lightsThisTurn: Light[] };
  playedLastTurn: number;                       // Slump's Heavy Silence
  promises: PromiseState[];
  promisesMade: number;
  pending: PendingChoice | null;                // only choose/confirm legal while set
  rng: { shuffle: number; ai: number };         // stream states
  umbrellaUsed: boolean;
  paperCraneUsed: boolean;                      // copied from run at start, committed via CombatResult.keepsakeCounters
  insightsMade: CardId[];                    // copied from run at start, extended when combat creates an Insight
  mutations: DeckMutation[];                    // chronological, applied by finishCombat
  glimmers: number;                             // earned this combat (base added at finish)
  allResolved: boolean;                         // Full Bloom tracking
  outcome: null | 'won' | 'lost';
}

export interface EnemyState {
  uid: Uid; defId: EnemyId;
  hp: number; maxHp: number; guard: number;
  statuses: StatusBag;                          // flare, hush, understood, wavering, worry, pressure, tension, tally, countdown, coil
  faces: Shade[]; faceIndex: number;            // faces.length === 0 -> numb rules
  intent: { moveId: string } | null;            // cause only; numbers derived by view.intents()
  pattern: { index: number; phase: number };
  fleeting: boolean; summonerUid: Uid | null;
  surfacedFrom: Uid | null;                     // Buried card uid this Surfaced Shade came from
  memory: Record<string, number>;               // passive flags (e.g. soothed: 1, provoked: 1, onceDone: 1, turnsLeft: 2 for The Mask)
  thresholdsFired: number[];
}

export interface CompanionState { uid: Uid; defId: CompanionId }
export interface PromiseState { dueTurn: number; effects: Effect[]; lights: Light[]; targetUid: Uid | null; sourceUid: Uid }
export interface PendingChoice { from: 'hand' | 'drawOrDiscard'; filter: CardFilter; then: 'toHand' | 'tend'; continuation: Frame[] }
export interface Frame { effects: Effect[]; pc: number; ctx: EffectCtx }
export interface EffectCtx { sourceUid: Uid; targetUid: Uid | null; lights: Light[]; harmonized: boolean; fromCard: boolean }

export interface CombatResult {                   // the ONLY way combat changes the run
  outcome: 'won' | 'lost';
  heartAfter: number; maxHeartDelta: number; glimmers: number;
  mutations: DeckMutation[];
  keepsakeCounters: Record<KeepsakeId, number>;
  allResolved: boolean;
  stats: Partial<RunStats>;
}
export type DeckMutation =
  | { k: 'suppress'; shade: Shade }                         // add Buried W1, or +1 Weight, or overflow -3 max Heart
  | { k: 'tend'; uid: Uid }                                  // Weight -1 (in-combat Tend)
  | { k: 'transform'; uid: Uid; to: CardId; upgraded: boolean }   // Buried -> Insight (Tend to 0 or Surfaced Resolve)
  | { k: 'remove'; uid: Uid }                          // B3: Buried reached 0 / Surfaced Resolved, Insight already created
  | { k: 'returnSurfaced'; uid: Uid };                       // Surfaced Suppressed: card unchanged, never a 'suppress'

// ---------- cards ----------
export type CardKind = 'ease' | 'skill' | 'mood' | 'buried';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'blend' | 'special';
export type Keyword = 'linger' | 'letGo' | 'innate' | 'reachesShy';
export interface CardDef {
  id: CardId; name: string;
  lights: readonly Light[];                     // [] neutral/buried, 1 mono, 2 blend
  kind: CardKind; rarity: Rarity;
  cost: number | 'unplayable';
  costMod?: { per: Countable; mult: number };   // Count to Ten (lingered, -1), Daybreak (promisesMade, -1)
  target: 'enemy' | 'all' | 'self' | 'none';
  effects: Effect[];
  keywords?: Keyword[];
  upgrade?: { cost?: number; effects?: Effect[]; keywords?: Keyword[] };
  text: string;                                 // template: 'Ease {0}. Mend {1}.' slots index numeric leaves in effect order
  buried?: { shade: Shade; insight: CardId };
  mood?: { on: 'turnStart' | 'turnEnd' | 'heartLostFromMove'; if?: Cond; effects: Effect[];
           oncePerEnemyPhase?: boolean }[];          // lasting Mood effects (Unconditional: heartLostFromMove, oncePerEnemyPhase)
  availableFromAct: 1 | 2;
}

// ---------- effect DSL ----------
export type Countable =
  | 'playedThisTurn' | 'companions' | 'turn' | 'unspentEnergy' | 'incoming' | 'promisesMade' | 'lingered' | 'timesPlayed'
  | { status: StatusId; on: 'self' | 'target' | 'player' };
export type Amount = number | { add: number; per?: Countable; mult?: number; min?: number; max?: number };
export type Cond =
  | { c: 'harmonized' } | { c: 'targetIntendsAttack' } | { c: 'noGuard' } | { c: 'noCompanions' } | { c: 'suppressedTarget' }
  | { c: 'onlyShade' }                                          // self is the only Shade on the field
  | { c: 'sourceLights'; has: Light[]; mode: 'any' | 'none' }  // the triggering card/hit's effective Lights
  | { c: 'marked'; key: string }
  | { c: 'status'; id: StatusId; on: 'self' | 'player'; op: '>=' | '<=' | '=='; n: number }
  | { c: 'playedLastTurn'; op: '<=' | '>='; n: number }
  | { c: 'playedLightThisTurn'; light: Light }                 // The Looming
  | { c: 'hitFromCard' } | { c: 'relation'; is: Relation[] }   // in hitTaken passives (Old Grudge, Short Fuse, Dread)
  | { c: 'count'; of: Countable; op: '>=' | '<=' | '=='; n: number }
  | { c: 'and' | 'or'; of: Cond[] } | { c: 'not'; of: Cond };
export type Effect =
  // player-side
  | { op: 'hit'; amount: Amount; times?: Amount; to?: 'target' | 'all' }
  | { op: 'guard'; amount: Amount }
  | { op: 'mend'; amount: Amount; to?: 'player' | 'self' }
  | { op: 'status'; id: StatusId; stacks: Amount; to: 'player' | 'target' | 'all' | 'self' }
  | { op: 'clearStatus'; id: StatusId; to: 'target' | 'self' | 'player' }
  | { op: 'draw'; n: Amount } | { op: 'energy'; n: number }
  | { op: 'summon'; companion: CompanionId } | { op: 'companionsAct' }
  | { op: 'promise'; effects: Effect[] }
  | { op: 'nextCardFree' }
  | { op: 'fetchBuried' } | { op: 'tendAny' }
  | { op: 'removeAfflictions' }
  // Shade-side (moves and passives; 'self' = the Shade)
  | { op: 'strike'; amount: Amount; times?: Amount }
  | { op: 'afflict'; id: AfflictionId | 'numb'; stacks: number }
  | { op: 'spawn'; enemy: EnemyId; max: number }
  | { op: 'scatter'; n: number }
  | { op: 'mark'; key: string } | { op: 'unmark'; key: string }
  // In a Shade's moves and passives, 'guard', 'mend' (to 'self') and 'status' (to 'self') apply to that Shade.
  // shared
  | { op: 'if'; cond: Cond; then: Effect[]; else?: Effect[] }
  | { op: 'custom'; id: string; args?: Record<string, number | string> };

// ---------- statuses ----------
export interface StatusDef {
  id: StatusId; name: string; owner: 'player' | 'enemy';
  polarity: 'buff' | 'debuff' | 'gauge' | 'flag';
  affliction?: Shade | 'numb';                 // afflictions: decay 1 at end of your turn (R-6)
  decay?: 'playerTurnEnd' | 'never' | 'consumedOnUse';
  max?: number; min?: number;                  // Pressure/Tension/Tally/Worry max 6, Coil max 6 min 1, Warmth max 6, Countdown max 3, Understood max 1
}
// v1 status ids (21): player: nerve, warmth, seething, heavy, isolated, trembling, hollow, restless, numb, next_draw, next_spirit
//                      enemy: flare, hush, understood, wavering, worry, pressure, tension, tally, countdown, coil

// ---------- Shades ----------
export type IntentKind = 'strike' | 'guard' | 'afflict' | 'buff' | 'mend' | 'summon' | 'scatter';
export interface MoveDef { name: string; intent: IntentKind[]; effects: Effect[] }
export type IntentPattern =
  | { kind: 'cycle'; moves: string[]; overrides?: { if: Cond; move: string }[] }
  | { kind: 'byFace'; moves: Partial<Record<Shade, string>> }
  | { kind: 'phases'; phases: { atOrBelowHp: number; pattern: IntentPattern }[] };
      // first phase is active from combat start whatever its atOrBelowHp (B2 growth can lift maxHp above the def's).
      // each later phase switches in once, the first time hp drops to its threshold (EnemyState.thresholdsFired)
export type PassiveTrigger =
  | 'combatStart' | 'afterOwnAction' | 'playerTurnEnd' | 'hitTaken' | 'cardHitResolved' | 'cardPlayed' | 'shadeLeft' | 'hpThreshold';
export interface PassiveDef { name: string; on: PassiveTrigger; threshold?: number; if?: Cond; effects: Effect[]; once?: boolean }
export interface EnemyDef {
  id: EnemyId; name: string;
  faces: readonly Shade[];                      // [] = numb rules (Apathy, The Numbness)
  hp: [min: number, max: number];
  tier: 'normal' | 'elite' | 'boss' | 'final' | 'minion' | 'surfaced';   // 'final' = The Numbness (glimmers*.final)
  fleeting?: true; summoner?: true; shy?: true;
  turnsAfterAction?: true;                      // The Mask
  hitTurnsPerPlayerTurn?: number;               // The Mask: 2 (your hits turn it at most twice per player turn)
  numbRules?: { surface: 1 | 3; hpPerHiddenWeight: number };   // Apathy {1, 0}; The Numbness {3, 6}
  moves: Record<string, MoveDef>;
  pattern: IntentPattern;
  passives?: PassiveDef[];
  lines: { bark: string[]; resolved: string; suppressed: string };
  visual: { family: Shade | 'doubt' | 'mask' | 'numb'; scale: number };
}
export interface EncounterDef { id: EncounterId; members: { enemy: EnemyId; hp?: [number, number] }[] }

// ---------- companions, keepsakes, events ----------
export interface CompanionDef { id: CompanionId; name: string; lights: readonly Light[]; act: Effect[] }
export type KeepsakeTrigger = 'combatStart' | 'turnStart' | 'turn1Start' | 'turnEnd' | 'harmonized' | 'resolved'
  | 'summoned' | 'tended' | 'shadeGainedFlare' | 'combatWon' | 'wouldDie';
export interface KeepsakeDef {
  id: KeepsakeId; name: string; rarity: 'fixed' | 'charm' | 'common' | 'uncommon' | 'rare' | 'boss'; text: string;
  on?: Partial<Record<KeepsakeTrigger, Effect[]>>;
  flags?: ('harmony' | 'mirror' | 'lightningRod' | 'leadBox' | 'skeletonKey' | 'noRest' | 'halfActMend' | 'insightUpgraded'
           | 'companionsUseNote' | 'prism' | 'umbrella' | 'paperCrane' | 'wornDiary')[];   // Spiral Shell: noRest + halfActMend
  energyPerTurn?: number;
  addsCard?: CardId;
}
export interface KeepsakeInstance { id: KeepsakeId; counter: number }
export type RunEffect =
  | { op: 'heart' | 'maxHeart' | 'glimmers'; n: number }
  | { op: 'addCard'; card: CardId | { random: CardFilter; upgraded: boolean } }
  | { op: 'addBuried'; shade: Shade }
  | { op: 'upgradeRandom'; n: number; filter?: CardFilter }
  | { op: 'deckSelect'; purpose: 'remove' | 'upgrade' | 'transform' | 'duplicate' | 'tend'; filter?: CardFilter }
  | { op: 'keepsake'; id: KeepsakeId | { randomRarity: 'common' | 'uncommon' | 'rare' | 'weighted' } }
  | { op: 'combat'; encounter: EncounterId; onResolve: RunEffect[]; onSuppress: RunEffect[] }
  | { op: 'if'; cond: RunCond; then: RunEffect[]; else?: RunEffect[] };
export type RunCond = { c: 'glimmers' | 'buriedCount' | 'lightCount'; light?: Light; op: '>=' | '<='; n: number } | { c: 'hasKeepsake'; id: KeepsakeId };
export interface EventDef { id: EventId; title: string; text: string; options: { label: string; result: string; requires?: RunCond; effects: RunEffect[] }[] }
export interface CardFilter { kinds?: CardKind[]; lights?: Light[]; rarity?: Rarity[]; notBuried?: boolean; buriedOnly?: boolean;
  notInsight?: boolean; upgradable?: boolean }   // Mirror Pond "Look closer": notBuried + notInsight

// ---------- map ----------
export interface MapState { act: 1 | 2 | 3; nodes: MapNode[]; current: number | null; visited: number[] }
export interface MapNode {
  id: number; row: number; col: number; next: number[];
  kind: 'fight' | 'elite' | 'haven' | 'sanctuary' | 'memory' | 'chest' | 'boss';
  encounter?: { id: EncounterId; hps: number[] };  // pre-rolled
  seed: number;                                     // hash32(runSeed, act, id)
}

export interface ContentPack {
  cards: Record<CardId, CardDef>; enemies: Record<EnemyId, EnemyDef>; encounters: Record<EncounterId, EncounterDef>;
  statuses: Record<StatusId, StatusDef>; companions: Record<CompanionId, CompanionDef>;
  keepsakes: Record<KeepsakeId, KeepsakeDef>; events: Record<EventId, EventDef>;
  afterglows: Record<Shade, { name: string; effects: Effect[]; text: string }>;
  pools: { act1: RowPools; act2: RowPools; deep: EncounterId; tutorialRows: EncounterId[] };
  starter: { deck: CardId[]; charms: KeepsakeId[] };
  rules: Partial<RulesConfig>;
}
export interface RowPools { early: EncounterId[]; row3?: EncounterId[]; standard: EncounterId[]; elite: EncounterId[]; boss: EncounterId }

// ---------- offers, views, stats ----------
export interface RewardOffer { glimmers: number; compass: boolean; keepsakes: KeepsakeId[]; keepsakeChoice: boolean;
  cards: CardId[]; taken: { glimmers: boolean; keepsake: boolean; card: boolean }; outcomes: { enemy: EnemyId; outcome: LethalOutcome }[] }
export interface ShopStock { items: { kind: 'card' | 'keepsake'; id: CardId | KeepsakeId; price: number; sale: boolean; sold: boolean }[];
  removeUsed: boolean; talkUsed: boolean; removePrice: number }
export interface HandHint { uid: Uid; playable: boolean; inwardLegal: boolean; harmonizesNow: boolean; blend: Blend | null;
  relations: { enemy: Uid; relation: Relation }[]; tends: Uid | null; soothes: AfflictionId[] }
export interface NodeDetail { kind: MapNode['kind']; shades: Shade[][]; afflictions: AfflictionId[];
  deckAnswers: { shade: Shade; opposite: number; dissonant: number }[]; rewards: string[] }
export interface RunStats { floors: number; resolved: number; deepResolved: number; suppressed: number; insights: number;
  harmonies: number; playsByLight: Record<Light, number>; mostPlayed: CardId | null;
  dmgByRelation: Record<Relation, number>; tends: number; combats: number }
```

Content example (exact shape):
```ts
// src/content/cards/love.ts
import type { CardDef } from '../../engine/types';
import { ease, mend } from '../../engine/dsl';
export const softSpot = {
  id: 'love.soft_spot', name: 'Soft Spot', lights: ['love'], kind: 'ease', rarity: 'common', cost: 1, target: 'enemy',
  effects: [ease(6), mend(2)], upgrade: { effects: [ease(8), mend(3)] },
  text: 'Ease {0}. Mend {1}.', availableFromAct: 1,
} satisfies CardDef;

// src/content/enemies/act1.ts (Mope's Wallow as pure data)
passives: [
  { name: 'Wallow', on: 'hitTaken', if: { c: 'sourceLights', has: ['joy'], mode: 'any' }, effects: [{ op: 'mark', key: 'soothed' }] },
  { name: 'Wallow', on: 'afterOwnAction', if: { c: 'not', of: { c: 'marked', key: 'soothed' } }, effects: [{ op: 'mend', amount: 5, to: 'self' }] },
  { name: 'Wallow', on: 'afterOwnAction', effects: [{ op: 'unmark', key: 'soothed' }] },
],
```

### 20.4 Rules config (`src/engine/rules.ts`)
```ts
export interface RulesConfig {
  startHeart: number; startGlimmers: number; energyPerTurn: number; handSize: number; maxHand: number;
  oppositePct: number; neutralPct: number; dissonantPct: number; feltPct: number; muffledPct: number;
  heavyPct: number; tremblingPct: number;
  dissonanceFlare: number; oppositeFlareRemove: number; cleansePerOutwardPlay: number;
  buriedMaxWeight: number; buriedOverflowMaxHeart: number;
  surfacedHpPerWeight: number; surfacedSuppressGrowPerWeight: number;   // grow = +max Intensity and Intensity
  maxCompanions: number; maxShades: number; festerTurn: number; turnLimit: number; triggerCap: number;
  compassAfterWins: number; havenRestPct: number; bossMendToFull: boolean;
  shellActMendPct: number;                             // Spiral Shell: % of missing Heart Mended between acts
  glimmersBase: { normal: number; elite: number; boss: number; final: number };
  glimmersResolve: { normal: number; elite: number; boss: number; final: number };
  dissonance: 'clockwise' | Record<Shade, Light>;      // table form exists only for tests/sweeps
}
export const DEFAULT_RULES: RulesConfig = {
  startHeart: 70, startGlimmers: 50, energyPerTurn: 3, handSize: 5, maxHand: 10,
  oppositePct: 200, neutralPct: 100, dissonantPct: 50, feltPct: 200, muffledPct: 50,
  heavyPct: 75, tremblingPct: 75,
  dissonanceFlare: 1, oppositeFlareRemove: 1, cleansePerOutwardPlay: 1,
  buriedMaxWeight: 3, buriedOverflowMaxHeart: 3,
  surfacedHpPerWeight: 12, surfacedSuppressGrowPerWeight: 10,
  maxCompanions: 3, maxShades: 4, festerTurn: 12, turnLimit: 40, triggerCap: 1000,
  compassAfterWins: 2, havenRestPct: 30, bossMendToFull: true,
  shellActMendPct: 50,
  glimmersBase: { normal: 10, elite: 25, boss: 60, final: 0 },
  glimmersResolve: { normal: 8, elite: 20, boss: 40, final: 0 },
  dissonance: 'clockwise',
};
```
The Numbness's hidden-Weight growth (+6 per Weight) is `EnemyDef.numbRules.hpPerHiddenWeight` (content), not a `RulesConfig` field.
`relationOf` in 20.3 is written against the default percents for readability; the implementation reads them from `RulesConfig`.

### 20.5 RNG and determinism
- `mulberry32(seed)` generator; `hash32(...parts: (number | string)[])` = FNV-1a over the UTF-8 of the joined parts, then a murmur3 finalizer.
- Streams: `map = hash32(seed, 'map', act)`; encounter HP = `hash32(node.seed, 'enc')`; combat `shuffle = hash32(node.seed, 'shuffle')`, `ai = hash32(node.seed, 'ai')`; rewards `hash32(node.seed, 'reward')`; shop `hash32(node.seed, 'shop')`; events `hash32(node.seed, 'event')`; charm options `hash32(seed, 'charm')`; wheel-closes offer `hash32(seed, 'wheel')`.
- Combat randomness is limited to shuffles and pattern start offsets. No card or Shade effect has a random target (design rule; the registry test rejects `randomEnemy`).
- Same seed + same action list => same `hash(state)` (tested on 30 seeds in `npm test` and 50 in `npm run test:slow`). The UI's procedural visuals use their own hash of `uid`, never engine streams.

### 20.6 Engine API
```ts
export type Action =
  | { t: 'pickCharm'; i: number }
  | { t: 'move'; node: number }
  | { t: 'play'; card: Uid; target?: Uid; inward?: true }
  | { t: 'endTurn' }
  | { t: 'choose'; uid: Uid } | { t: 'confirm' }
  | { t: 'takeCard'; i: number } | { t: 'takeKeepsake'; i: number } | { t: 'skip' } | { t: 'continue' }
  | { t: 'buy'; slot: number } | { t: 'service'; id: 'remove' | 'talk' } | { t: 'leave' }
  | { t: 'rest' } | { t: 'kindle' } | { t: 'reflect' }
  | { t: 'option'; i: number };

export interface StepResult { state: GameState; events: GameEvent[]; revealedHiddenInfo: boolean }

export interface Engine {
  readonly pack: ContentPack;
  readonly rules: RulesConfig;
  newRun(seed: number, opts?: { tutorial?: boolean; charm?: KeepsakeId; rules?: Partial<RulesConfig> }): GameState;
  legalActions(s: GameState): Action[];              // canonical order; empty only in victory/defeat
  step(s: GameState, a: Action): StepResult;          // pure at the boundary; throws IllegalAction
  preview(s: GameState, a: Action): Preview | null;   // 'play' and 'endTurn'
  intents(s: GameState): IntentView[];               // projected after 5.6 steps 1 to 6 (5.7.1)
  handHints(s: GameState): HandHint[];                // per card: relation per Shade, harmonizes-now, inward-legal, tends
  cardText(s: GameState, uid: Uid, target?: Uid): string;
  nodeDetail(s: GameState, nodeId: number): NodeDetail;
  hash(s: GameState): string;
  serialize(s: GameState): string; deserialize(json: string): GameState | null;
  debug: { startCombat(s: GameState, e: EncounterId): GameState; setHand(s: GameState, ids: CardId[]): GameState };
}

export interface IntentView { enemy: Uid; moveId: string; name: string; kinds: IntentKind[];
  strikes: { perStrike: number; count: number } | null; guard: number | null; afflict: { id: string; stacks: number } | null;
  overriddenBy: string | null;                        // e.g. 'pressure'
  afterEndTurn: boolean;                              // true when this projected intent differs from the current one
  cause: string | null }                              // tooltip when afterEndTurn, e.g. 'Lantern Moth will turn it to Fear.'
export interface Preview {                            // targets = every Shade whose values change (incl. a boss grown by B2)
  targets: { uid: Uid; hpBefore: number; hpAfter: number; maxHpAfter: number; guardAfter: number; hits: HitBreakdown[];
             outcome: LethalOutcome | null; flareDelta: number; faceAfter: Shade | null;
             gauges: Record<string, [number, number]>; intentAfter: IntentView | null;
             buried: { shade: Shade; weightAfter: 1 | 2 | 3 | null; overflow: boolean } | null; afterglows: Shade[] }[];
  player: { hpAfter: number; guardAfter: number; energyAfter: number; cleansed: StatusBag;
            tended: { uid: Uid; weightAfter: number; insight: CardId | null } | null; incomingAfter: number };
  harmonized: boolean; effectiveLights: Light[]; noteAfter: Light[];
  uncertain: boolean;                                 // a draw/shuffle or later condition depended on hidden info
  partial: boolean;                                   // stopped at a pending choice
}
export interface HitBreakdown {
  base: number; flat: number; afflictionPct: number; relation: Relation; typePct: number;
  damage: number; blocked: number; hpLoss: number; hpBefore: number; hpAfter: number; guardAfter: number;
  lethal: boolean; outcome: LethalOutcome | null; fromCard: boolean;
  trace: { label: string; value: string }[];          // for the Shift breakdown
}
```
Rules: `legalActions` is the single source of truth (the UI greys cards not in it). Choices are sequential single picks. `endTurn` is one action covering 5.6, 5.7 and the next 5.2 (all events returned at once). `preview({t:'endTurn'})` covers only the deterministic part (Companions, Buried, Seething, Warmth, Shade passives, and enemy strikes against current Guard) and returns `uncertain` for anything after the next draw. `intents()` takes its projected intents from the state after 5.6 steps 1 to 6 of that same preview. Combat-phase `step` clones only `combat` (run is read-only in combat: Paper Crane and Insight creation are tracked on `combat` and committed through `CombatResult`); run-phase actions clone the whole state. Hand-rolled clone measured at about 13 microseconds for a 4.4 KB combat state (vs 61 for `structuredClone`); never use `structuredClone` on hot paths.

### 20.7 Events (emitted only by `primitives.ts`, carrying absolute after-values)
```ts
export type EntityRef = { side: 'player' } | { side: 'enemy'; uid: Uid } | { side: 'companion'; uid: Uid };
export type GameEvent =
  | { e: 'turn'; side: 'player' | 'enemy'; n: number }
  | { e: 'draw'; uids: Uid[] } | { e: 'discard'; uids: Uid[] } | { e: 'shuffle'; count: number } | { e: 'letGo'; uid: Uid }
  | { e: 'cardPlayed'; uid: Uid; defId: CardId; inward: boolean; effectiveLights: Light[]; harmonized: boolean; energyAfter: number }
  | { e: 'note'; lights: Light[] }
  | { e: 'harmony'; blend: Blend | null; count: number }
  | { e: 'hit'; from: EntityRef; to: EntityRef; b: HitBreakdown }
  | { e: 'strike'; enemy: Uid; amount: number; blocked: number; hpAfter: number; guardAfter: number }
  | { e: 'guard'; to: EntityRef; amount: number; after: number }
  | { e: 'mend'; to: EntityRef; amount: number; after: number }
  | { e: 'status'; to: EntityRef; id: StatusId; delta: number; after: number }
  | { e: 'cleanse'; id: AfflictionId; removed: number; byLight: Light; inward: boolean }
  | { e: 'face'; enemy: Uid; face: Shade }
  | { e: 'intent'; enemy: Uid; moveId: string }
  | { e: 'enemyMove'; enemy: Uid; moveId: string }
  | { e: 'summon'; companion: Uid; defId: CompanionId } | { e: 'companionLeft'; companion: Uid } | { e: 'companionAct'; companion: Uid }
  | { e: 'spawn'; enemy: Uid; defId: EnemyId } | { e: 'surfaced'; enemy: Uid; fromBuried: Uid }
  | { e: 'resolved'; enemy: Uid; deep: boolean; by: Light[]; glimmers: number; afterglows: Shade[] }
  | { e: 'suppressed'; enemy: Uid; buried: Shade | null }
  | { e: 'faded'; enemy: Uid } | { e: 'wavering'; enemy: Uid }
  | { e: 'tended'; uid: Uid; weightAfter: number }
  | { e: 'insight'; uid: Uid; to: CardId; upgraded: boolean }
  | { e: 'peace'; uid: Uid }      // B3: that Insight was already created this run
  | { e: 'promise'; created: boolean; targetUid: Uid | null }
  | { e: 'festering' }
  | { e: 'keepsake'; id: KeepsakeId }
  | { e: 'combatEnd'; outcome: 'won' | 'lost' }
  | { e: 'phase'; kind: Phase['kind'] }
  | { e: 'run'; what: 'glimmers' | 'heart' | 'maxHeart' | 'deck' | 'keepsake'; after: number | string };
```
Consumers: UI animator (queue), sim metrics reducers, coach-mark triggers, end-of-run stats.

### 20.8 UI loop and saves
```ts
async function dispatch(a: Action) {
  if (busy || !engine.legalActions(state).some(x => sameAction(x, a))) return;
  busy = true;
  const { state: next, events, revealedHiddenInfo } = engine.step(state, a);
  undoStack = revealedHiddenInfo || a.t !== 'play' ? [] : [...undoStack, state];
  await animator.play(events);          // click/Space fast-forwards
  state = next; render(state); save(state); busy = false;
}
```
Autosave the full state JSON to `localStorage['heartward.save']` (with `v` and `contentHash`) after every action; profile flags (`tutorialDone`, seen coach marks, settings) in `localStorage['heartward.profile']`. All storage access is wrapped in try/catch and the game runs without it. If `tutorialDone` can't be read, New Run offers "Skip tutorial" (3.2). A debug "Copy replay" button copies `{ seed, opts, actions[] }` for bug reports that paste into a Vitest regression test.

---

## 21. Simulation, bots and metrics

### 21.1 Bots (all use the Engine API only)
Every non-random bot shares one scoring core (`greedy.ts`) and differs only in its **Belief** (what it thinks the rules are) and flags. The real engine always applies the true rules; beliefs only change how the bot scores previews (`damage.recombine(breakdown, beliefPcts)` re-derives damage, lethal and outcome).

```ts
export interface Belief {
  name: string;
  typePct(lights: readonly Light[], t: TargetTyping): number;   // aware: engine relation; blind: 100; confused: chart rotated -1
  knowsResolve: boolean;       // values RESOLVE/SUPPRESS/Afterglow, avoids Buried
  knowsHarmony: boolean;       // values Harmonized plays and Note setup
  knowsFlare: boolean;         // penalises feeding Flare
  knowsCleanse: boolean;       // values soothing and Inward
  knowsFaces: boolean;         // values turning faces toward its cures
  usesMapHints: boolean;       // routes toward Shades it counters
  draftsForCoverage: boolean;  // rewards weighted by coverage of upcoming Shades and Tend needs
}
```

| Bot | Belief / behaviour | Purpose |
|---|---|---|
| `random` | uniform over `legalActions` | floor; softlock and invariant fuzzer |
| `confused` | chart rotated by -1 wheel step: its believed cure for each Shade is that Shade's actual DISSONANT Light (the "bad advice" bot, still a derangement of the true opposites). All knows* flags true, and map hints and the coverage draft are on, read through its rotated chart | must lose to `blind`: the chart is real information |
| `blind` | typePct 100, all knows* false, no map hints, no coverage draft | type-blind baseline |
| `greedyType` | true chart for damage only (opposite/dissonant); knowsResolve/Harmony/Flare/Cleanse/Faces false | "match the colour" autopilot |
| `aware` | everything true | reference skilled bot |
| `aware-noResolve`, `aware-noHarmony`, `aware-noInward` | aware with one flag off (noInward also removes Inward actions) | ablations: each subsystem pulls weight |
| Policy bots (7) | aware combat, forced draft/route policy: `mono-love`, `mono-courage`, `pair-delight`, `arc3-love`, `rainbow`, `buryAll` (never values Resolve, always Tends when possible), `resolveOnly` (never plays a Suppressing lethal unless it would otherwise die this turn) | archetype viability, degenerate-strategy checks |

v1 ships exactly these 15 bots: `random`, `confused`, `blind`, `greedyType`, `aware`, the 3 ablations and the 7 policy bots. The planner bot and the other policy variants are cut (24.2). A full report (15 bots x 2000 runs at about 0.175 s per run on 4 cores) takes about 22 minutes.

**Combat scoring (1-ply, re-plans after every action):** enumerate `distinct(legalActions)` (merge identical def+upgrade+target), preview each, score under the belief, play the best if score > 0, else `endTurn`.
```
score(a) = sum over targets [ hpLoss * (1 + threat_t / hp_t) + (killed ? 5 + 1.5 * threat_t : 0) ]
         + min(guardGain, max(0, incoming - guard)) + 0.1 * overflowGuard
         + 0.8 * mend (if hp < 70% max) + 3 * stacksCleansed + 2.5 * cardsDrawn + 3 * energyGained
         + [knowsResolve]  (resolve ? +8 + afterglowValue : suppress ? -S(floorsLeft, weightAfter) : 0)
         + [knowsCleanse]  (tended ? +6 (+6 more if it creates Insight) : 0)
         + [knowsHarmony]  (harmonized ? 2 : 0) + (leaves a Harmonizable card in hand ? 1 : 0)
         + [knowsFaces]    (faceAfter's cure is in hand ? 2 : 0)
         - [knowsFlare]    flareDelta * expectedStrikesLeft * 1.5
         - 0.5 * energyCost
```
`threat_t` = the target's intent strike total (`engine.intents`). `S = 4 + 1.5 * weightAfter` scaled by `(floorsLeft / 23)`, or `12` if the Suppress would overflow (max Heart loss). `afterglowValue`: Conviction 4, Release 4, Belonging 5, Caution 6, Perspective 2 + stacks removed, Clarity 5.

**Run policy:** card rewards and shop use a static card value (walk the DSL: Ease 1/pt, Guard 0.8/pt, draw 2.5, Spirit 3, Promise x0.9, Mood x3) + (coverage flag) +6 for a Light that cures a Shade on the remaining map rows and +4 for the Light that Tends the heaviest Buried card + adjacency bonus +2 with the deck's two most common Lights (12.2 definition: `ease` cards only); skip if the best value is below the deck average. Pathing: prefer Havens below 50% Heart, Sanctuaries with 120+ Glimmers, elites above 70% Heart, and (map hints) fights whose Shades the deck answers. Haven: Rest below 50% Heart, else Reflect if a Buried card has Weight 2+, else Kindle. Events: small scripted value table per option.

### 21.2 Pairing and statistics
Seeds are paired: a seed fixes the map, encounters, HP rolls, reward/shop offers per node and each fight's streams. Report per-bot Wilson 95% CIs, McNemar's test on discordant pairs, and a paired bootstrap for continuous metrics. 500 paired seeds give about +/-4 pp. `sim/lab.ts` isolates combat skill: fixed decks (mono-Love, Love+Joy, Love+Courage (non-adjacent), rainbow, neutral-only control) x every encounter x 20 seeds, measuring Heart lost and turns.

### 21.3 Metrics and thresholds (reference difficulty = DEFAULT_RULES, normal runs, random Charm)

| Metric | Target (full report, 2000 paired seeds) | CI gate (`test:balance`, 300 fixed seeds; point estimate AND one-sided McNemar p < 0.05 for paired gaps) |
|---|---|---|
| `aware` win rate | 45-65% | >= 30% |
| `aware` - `blind` paired win rate | >= +15 pp | point estimate >= +8 pp and McNemar p < 0.05 |
| Ladder `random < confused < blind < greedyType < aware` | holds | `blind` - `confused` point estimate > 0 and McNemar p < 0.05 (`aware` > `blind` is the row above) |
| `aware` - `greedyType` (depth beyond matching colours) | >= +8 pp | point estimate >= +2 pp and McNemar p < 0.05 |
| Decision divergence: share of decisions (2+ distinct options) where `aware`'s pick differs from `greedyType`'s | >= 25% | |
| Type-flip rate: same, `aware` vs `blind` | >= 35% | |
| OPPOSITE share of card damage | aware >= 45%; blind <= 30% | |
| DISSONANT share of card damage | aware <= 5%; blind >= 10% | |
| Resolve share of named kills (Resolve + Deep) | aware 60-80%; blind 25-45% | |
| Ablations `aware-noResolve`, `aware-noHarmony` | each >= 5 pp below aware | |
| Ablation `aware-noInward` | >= 3 pp below aware | |
| Harmonized share of cards played after the Compass | aware 25-45% | |
| Median Tends per run (aware) | >= 2 | |
| `buryAll` vs `resolveOnly` | within 10 pp of each other, both >= 10 pp below aware | |
| Win rate by Charm (aware) | each within +/-8 pp of the mean | |
| Win rate by dominant deck Light (aware) | each within +/-10 pp of the mean | |
| Policy bots `pair-delight`, `arc3-love`, `rainbow` | each 25-55%, none above aware + 5 pp | |
| `mono-<light>` overall (`mono-love`, `mono-courage`) | each 15-45% (mono is intentionally weakest at the finale, 1.2) | |
| The Numbness win rate given reached | aware >= 60%; blind <= 35% | |
| Mono vs The Numbness given reached | >= 30% of `arc3`'s rate | |
| Median total Buried Weight on reaching The Deep (aware) | 1-4 | |
| Heart lost per fight, blind / aware | elites and bosses >= 1.5x; normals 1.1-1.5x | |
| `random` win rate | < 2% | < 5% |
| Median turns per normal fight (aware) | 3-6 | |
| p99 combat length (aware) | < 20 turns | |
| Max cards played in one turn (10k runs, all bots) | <= 25 | |
| Invariant violations, softlocks, RunawayTriggers | 0 | 0 |
| Preview/apply mismatches (property test) | 0 | 0 |

**Gate rule.** Each CI gate runs on the same 300 fixed seeds (the 5 gate bots `random`, `confused`, `blind`, `greedyType`, `aware` x 300 runs x about 0.175 s / 4 cores, about 70 s). A paired-gap gate passes only when both hold: the point estimate meets its floor (+8 pp for aware-blind, +2 pp for aware-greedyType, above 0 for blind-confused), and a one-sided McNemar test on the discordant pairs gives p < 0.05.

When a target is missed, tune in this order: enemy HP/strike numbers, card numbers, Glimmer/price numbers, then `RulesConfig` percents (via `--set rules.x=a,b,c` sweeps on paired seeds). The chart structure and Harmony rules are not tuning knobs. The Resolve/Suppress rules are not swept either, but they are not frozen: if `buryAll` beats `resolveOnly` or another degenerate loop appears, the lead may change them by a recorded design decision (as v1.1 did with one Insight per id per run, B3).

### 21.4 CLI and throughput
- `npm run sim -- --runs 2000 --bots aware,blind,confused,greedyType,random --seed-start 1 --out sim/out` -> `sim/out/report.md` + `report.json`.
- `--shard k/n` runs a slice; `sim/parallel.ts` spawns 4 vite-node children and merges.
- Budget: about 6000 previews per run at 20-30 microseconds = 0.15-0.2 s per run; 2000 runs per bot in about 80 s on 4 cores (a full 15-bot report in about 22 minutes). A perf test in `npm run test:slow` asserts 20 `aware` runs finish within 15 s.

---

## 22. Test plan and acceptance

**Unit/rules (`npm test`, < 30 s total, property tests at 30 seeds):**
- `emotions.test.ts`: the full 6x6 chart equals 4.2; the clockwise mapping is a permutation and a derangement of opposites; every two-Light hit is never dissonant (exhaustive); `harmonize` examples of 4.4.10; a Blend is never Harmonized by its own pair (Sunbeam after Sunbeam) and is Harmonized by an adjacent outside Light; `blendOf` for all 15 Light pairs.
- `damage.test.ts`: table tests for 5.4 incl. the worked example (= 10, Intensity -6), min-1 rule, Veiled 0, Lightning Rod, automatic hits, Heavy, Trembling.
- Scenario tests (one per R-rule): Flare gain/removal; R-2b effective Lights in passives (a Harmonized Joy card after Love lowers Kettle Pressure; a Numb-greyed card counts as no Light); Note persistence across turns; Isolated (no Harmony, Companions don't act); face turning incl. multi-hit; The Mask turns at most twice per player turn from your hits; Inward legality and Tend ordering; each lethal outcome; Wavering; Fade on summoner leaving; R-8b finishing blows from a Companion (no Seething tick after), a Promise (no enemy phase on an empty field) and High Five's "Companions act now", and win-before-Heart-0 in the same step; Afterglows; Perspective leaves Numb; Buried Weight add/+1/overflow; Buried-in-hand stacks applied after decay; Buried cards never Linger (Serenity); Tend once per combat; Insight upgraded at peakWeight 2; Insight once per run (Tend to 0 and Surfaced Resolve with the Insight already created remove the Buried card); Surfacing/Veil; Surfaced Suppress returns the card unchanged and grows the boss +10 x Weight max Intensity and Intensity; The Numbness +6 max Intensity per hidden Weight; an automatic FELT finishing hit (Friendship Bracelet with a Blend Note) Resolves The Numbness; Numb greys only the first card; Restless cost; Warmth max 6; Unconditional once per enemy phase; Festering at turn 12; turn limit; max Shades 4; Companions' last target; Promise Light carry-over; Yellow Umbrella blocks Chipped Teacup and Numb.
- Enemy phase (5.7): the phase-start snapshot (Skitter's `hide` Doubt acts next phase; Surfaced Shades act in the first phase); overrides hold only while their condition holds, don't advance `pattern.index`, and lift back to the cycle move at the current index; projected intents after end-of-turn steps 1 to 6 (a Lantern Moth turning The Mask shows `startle` with the "after end of turn" tag).
- Every Shade: pattern order, overrides (Kettle, Knot, Dread), byFace (Mask), phases and thresholds (Numbness, Mask, Spiral), Spiral Coil max 6 and unwind on face turn, Worry max 6.
- Map property test (30 seeds in `npm test`, 2000 in `test:slow`): reachability, no crossing edges, degrees 1-2, edge (0,0) present, repair constraints (no Elite-Elite edge after rule 2), row-6/row-8 elite split, Compass after the 2nd win.
- `content/registry.test.ts`: every referenced id exists; 6 Buried <-> 6 Insight pairs; each Light has 3 C / 2 U / 1 R; 6 Blends cover all adjacent pairs; each compound's outer face cure is dissonant vs its inner face; every text slot resolves; no `randomEnemy`; every encounter id is used by a pool; every enemy move is reachable; afterglows cover all 6 Shades.
- `architecture.test.ts` (20.2).

**Property tests (`npm test`, 30 seeds):** preview == step for every deterministic legal play across 30 random-bot seeds (compare every target's hpAfter, guardAfter, outcome, faceAfter, flare, and the player's hp, guard, energy, statuses); purity (deep-frozen input never mutated); invariants after every step (hp <= maxHp, no negative stacks, piles partition `cards`, `combat` non-null iff combat phase, legal actions non-empty unless terminal, at most one of each `insight.*` in the deck); determinism (same seed + actions => same hash, 30 seeds); serialize round-trip.

**Slow tests (`npm run test:slow`, `vitest.slow.config.ts`, `tests/slow/**`):** preview == step across 300 random-bot seeds; map property test on 2000 seeds; determinism on 50 seeds; the perf test (20 `aware` runs within 15 s, 21.4).

**Contract test:** `tests/contract/engine.contract.test.ts` runs against any `Engine` (miniPack and defaultPack).

**Balance (`npm run test:balance`, `vitest.balance.config.ts`, `tests/balance/**`):** 21.3 CI gates on 300 fixed seeds (point estimate floor and one-sided McNemar p < 0.05).

**UX acceptance checklist:**
- [ ] First card played within 20 s of Begin (profile's first run).
- [ ] Every number that will change on commit is previewed first; no Suppress happens without a SUPPRESS banner having been shown for that action.
- [ ] No "?" intents anywhere.
- [ ] Full game playable with keyboard only, mouse only, touch only, and in greyscale.
- [ ] Reduced motion removes shake, hit-stop and bloom.
- [ ] At most one coach mark visible; none blocks input.
- [ ] Enemy phase <= 1.5 s at 1x; input never blocked > 250 ms.
- [ ] A card never shows more than 2 chips; a Shade never more than 3 uncollapsed status chips.
- [ ] `npm run typecheck && npm test && npm run test:slow && npm run test:balance && npm run build` green after every merge.

---

## 23. Build plan

**M0 Contract (lead, first, serial):** `engine/types.ts`, `engine/emotions.ts` (complete + tests), `engine/damage.ts` (complete + tests), `engine/rules.ts`, `engine/dsl.ts` signatures, `engine/rng.ts`, `engine/index.ts` (stubs), `engine/combat/index.ts` (signatures), `tests/fixtures/miniPack.ts`, `tests/architecture.test.ts`, `tsconfig.engine.json`, `tsconfig.sim.json`, `vitest.slow.config.ts`, `vitest.balance.config.ts`, the `vite.config.ts` test excludes, package scripts (20.2), `content/glossary.ts`. Types are additive-only after M0; changes go through the lead.

**M1 (parallel, exclusive write ownership):**
| Agent | Owns | Done when |
|---|---|---|
| A Engine-Combat (critical path) | `engine/{primitives,interpreter,conditions,clone}.ts`, `engine/combat/**` (incl. `combat/index.ts` and `combat/view.ts`), `tests/engine/combat*`, `tests/helpers/scenario.ts`, `tests/property/*`, the preview-vs-step and determinism files in `tests/slow/` | miniPack fight fully playable via `step`; preview==actual green; every R-rule scenario test green |
| B Engine-Run | `engine/run/**` (incl. `run/view.ts`), `engine/step.ts`, `engine/index.ts` (after M0), `serialize.ts`, `invariants.ts`, the map file in `tests/slow/` | map property tests; all phase transitions; rewards/shop/haven/events/deckSelect; save round-trip |
| C Content | `src/content/**`, `tests/content/**` | every table in sections 6 to 10 as data; registry test green; lines and visuals |
| D UI | `src/ui/**`, `index.html`, styles | all screens render from fixture states; animator plays canned event lists; Compass, Shade SVGs, previews wired to the `Preview` shape |
| E Sim | `sim/**`, `tests/balance/**`, `tests/contract/**`, the perf file in `tests/slow/` | runner, random bot, beliefs, greedy core, the 15 bots of 21.1, metrics, stats, CLI, sharding, report on miniPack |

If A falls behind, split at `interpreter.ts`: statuses/afflictions/Companions/Promises move to a sixth agent once primitives and the interpreter exist.

**M2 Integration:** defaultPack into A+B; full runs in the sim; UI on the real engine with `?debug=1&encounter=` shortcuts; E regenerates fixture states from real runs.
**M3 Balance loop:** E publishes the 21.3 report; C tunes content numbers; D polishes juice/accessibility; gates after every merge.
**M4 Freeze:** golden replays (fixed seeds + action logs + expected hashes), regenerated only by an explicit script.

---

## 24. Tuning knobs, cut list, risks

### 24.1 First knobs to turn (in order)
1. Enemy HP and strike values (sections 7.1 to 7.3) against "Median turns per normal fight 3-6" and "aware win 45-65%".
2. The Numbness Intensity 180 (Thaw at 90, `fog`/`fog2` Guard 14), Surfacing `12 x Weight`, hidden-Weight growth (+6 per Weight) and Surfaced Suppress growth (+10 x Weight) against "Numbness win given reached" and p99 combat length.
3. Resolve Glimmer bonus (8/20/40) and Buried overflow (3 max Heart) against Resolve share and `buryAll` vs `resolveOnly`.
4. `festerTurn` 12 against p99 combat length.
5. Card numbers flagged hot: Unconditional (once per enemy phase, Warmth max 6), Plant a Seed and Daybreak (now Let Go), Zoomies + Grand Finale loops (max cards per turn), Serenity + Count to Ten + Unhurried, Growing Light, Forgive with deliberate Flare.

### 24.2 Cut list (already cut from v1; do not build)
Intent distortion (all variants) and the Night Light keepsake; Emotional Weather; Act 3 skip-one "bridge" compounds; Longing's card-holding; The Numbness borrowing six Shade moves and Flatten/Drain Colour; Songbird companion; Change of Heart; Kaleidoscope; Mood Ring; Wind Chime; Hope/Calm Charms; potions; ascension levels; phone portrait layout; the seed's hand-written dissonance table.

Cut in v1.1 (M17): the planner bot; every policy bot except `mono-love`, `mono-courage`, `pair-delight`, `arc3-love`, `rainbow`, `buryAll` and `resolveOnly`; per-type silhouette generator sets (now 1 generator per family with uid-hash variation), the 30% compound show-through (now outer-face silhouette + inner-face sigil badge) and The Mask's face morph (now a crossfade); target-first hover; the Alt/? label overlay; drag targeting (click/tap/keyboard only); the UI scale setting; the pattern strength setting.

### 24.3 If scope bites (cut in this order)
1. Wallflower (Loyalty stays useful). 2. Mirror Pond and Wishing Well events. 3. The Kettle (Act 1 keeps one elite).

Never cut Deep Resolve: it is the reason Blends exist ("a Blend can land a DEEP RESOLVE").

### 24.4 Risks
| Risk | Mitigation |
|---|---|
| "Love is DISSONANT vs Sadness" feels wrong on first contact | T2 teaches it with the bad-advice line and immediately shows Joy as the answer; Harmony (Love then Joy) turns the blind spot into a strength. |
| Inward is hard to discover | Heart outline only when legal, previewed result, coach marks C9 to C11 in T4; bots measure its value (ablation). |
| Buried spiral | Weight merging + cap, once-per-combat Tend, Haven Reflect, Sanctuary Talk it through and Set Down, card slot 3 offers the cure; metric "median Buried Weight at The Deep 1-4". |
| Surfacing spikes | Cap 3, 12 HP per Weight, Deep Haven Reflect before the fight; the growth penalties (+6 max Intensity per hidden Weight, +10 x Weight per Suppressed Surfaced Shade) are shown in the Numbness meter tooltip and the SUPPRESS banner; the 0-Buried Numbness fight is tested separately. |
| Suppress-and-Tend Insight farming | Each Insight id at most once per run (B3); a repeat Buried card is released at Weight 0; metric `buryAll` vs `resolveOnly`. |
| Preview lies | Single pipeline + property test; `uncertain` flag instead of guessing. |
| Determinism leaks | architecture grep, DOM-free tsconfig, UI-only visual hash. |
| Preachiness | Suppress is always legal and sometimes optimal; Insight cards are strong and unique; no lesson text anywhere. |

---

## 25. Changelog v1.0 -> v1.1

Each line names the red-team finding (B = blocker, M = major, minor-N = minor item N) or the lead's own decision (L1 to L7), then the sections it touched.

**Blockers**
- **B1** New rule R-8b (immediate win check after every hit and Shade removal from any source, win check before the Heart-0 check in the same step), referenced from 5.2, 5.3, 5.6, 5.7 and the section 5 preamble. 5.3 step 9 is now "Win check: R-8b", R-8a no longer ends the combat, and scenario tests cover Companion, Promise and High Five finishing blows (4.8, 5, 4.13, 4.14, 6.4, 22).
- **B2** Both Surfacing penalties replaced by max-Intensity growth: The Numbness gains +6 max Intensity and Intensity per Weight of Buried cards not Surfaced, and Suppressing a Surfaced Shade gives Apathy or The Numbness +10 x Weight max Intensity and Intensity (banner "The Numbness +20 Intensity"). Renamed `numbRules.guardPerHiddenWeight` -> `hpPerHiddenWeight` and `surfacedSuppressHealPerWeight` -> `surfacedSuppressGrowPerWeight`. Preview targets gain `maxHpAfter` (the boss is listed when a Surfaced Suppress grows it), and the `phases` pattern's first phase no longer depends on its `atOrBelowHp` so growth above the def's max Intensity can't skip Phase 1 (D11, 4.16, 7.2, 7.3, 16.2, 20.3, 20.4, 20.6, 22, 24.1, 24.4).
- **B3** Each Insight id can be created at most once per run (`run.insightsMade`). A Buried card whose Insight was already created is removed at Weight 0 ("You've already made peace with this one."), and so is one whose Surfaced Shade is Resolved. Mirror Pond "Look closer" excludes Buried and Insight cards. New invariant "at most one of each `insight.*` in the deck", new `remove` mutation, `peace` event and `CardFilter.notInsight`. 21.3 no longer forbids changing the Resolve/Suppress rules (D9, 2, 4.10, 4.16, 6.11, 7.3, 10, 14, 16.2, 18.1, 20.3, 20.7, 21.3, 22, 24.4).

**Major**
- **M1** The Mask: your hits (card or automatic) turn it at most twice per player turn, further OPPOSITE hits still deal x2 and remove Flare, chip "Turns left 2/1/0", `EnemyDef.hitTurnsPerPlayerTurn: 2` (4.5, 5.4, 5.6, 7.1, 16.2, 20.3, 22).
- **M2** IntentView shows the projected intent after 5.6 steps 1 to 6 from `preview({t:'endTurn'})`, with an "after end of turn" tag and a cause tooltip, new `IntentView.afterEndTurn` and `cause` (5.6, 5.7.1, 16.2, 20.2, 20.6, 22).
- **M3** Insight has two sources (Tending to Weight 0, Resolving its Surfaced Shade). A Surfaced Resolve is not a Tend: Journal doesn't trigger, Lead Box doesn't block it, Worn Diary's upgrade applies (D9, 2, 4.10, 4.16, 6.11, 9.3, 9.4).
- **M4** Surfaced Shades never Bury. On Suppress their card returns to the discard pile unchanged (`returnSurfaced` only, no `suppress` mutation) (4.8, 4.10, 4.16, 7.3, 20.3).
- **M5** Any FELT finishing hit, from a card or automatic, Resolves Apathy or The Numbness. A non-FELT automatic finishing hit leaves it Wavering. `lethalOutcome` is unchanged and a scenario test was added (4.8, 4.11, 4.16, 20.3, 22).
- **M6** Plant a Seed and Daybreak gain Let Go. Daybreak keeps its per-combat discount (6.6, 24.1).
- **M7** Warmth max 6. Unconditional: "The first time each enemy phase a Shade's move makes you lose Heart, gain 2 Warmth." New `MoodDef.oncePerEnemyPhase` field (5.6, 6.2, 20.3, 22, 24.1).
- **M8** Serenity: "every non-Buried card in your hand Lingers." Buried cards never Linger, even with Serenity (4.10, 4.15, 5.6, 6.7, 22).
- **M9** Spiral Coil starts 2, max 6 (was 8), and unwinds 1 whenever the Spiral's face turns. `what_if` peaks at 18 (30 with Deepening) (5.4, 7.2, 20.3, 22).
- **M10** The Deep's Sanctuary always stocks both Blends that contain your most common Light, and one Blend slot is the sale item. Targets are now "mono given reached >= 30% of arc3" and "mono-<light> overall 15-45%". 1.2 states that mono is intentionally weakest at the finale (1.2, 3.1, 6.8, 13, 21.3).
- **M11** The Numbness Intensity 240 -> 180, Thaw at 120 -> 90, `fog` and `fog2` Guard 20 -> 14 (7.3, 24.1).
- **M12** New rule R-2b: "a card/hit with <Light>" always means its effective Lights at play time, and a Numb-greyed card has none (4.2, 7.0, 22).
- **M13** 5.7 iterates over a snapshot of Shade uids taken at phase start, summoned Shades act from the next phase, overrides apply only while their condition holds (re-derived on each gauge change), override moves don't advance `pattern.index`, and a lifted override returns to the cycle move at the current index (5.7, 5.7.1, 7.0, 22).
- **M14** Balance gates run on 300 fixed seeds. Floors: +8 pp aware-blind, +2 pp aware-greedyType, above 0 blind-confused, and each also needs a one-sided McNemar p < 0.05 (21.3, 22).
- **M15** The `confused` bot rotates the chart -1, so its believed cure is the actual DISSONANT Light, with all knows* flags true (21.1).
- **M16** `tsconfig.engine.json` covers only src/engine and src/content. New `tsconfig.sim.json` (lib ES2022, types ["node"], include sim). The typecheck script runs all three configs (20.2, 23).
- **M17** Cuts applied now and listed in 24.2: planner bot, policy bots reduced to `mono-love`, `mono-courage`, `pair-delight`, `arc3-love`, `rainbow`, `buryAll`, `resolveOnly`, one silhouette generator per family with uid-hash variation, compounds as outer-face silhouette plus inner-face sigil badge, The Mask's face change as a crossfade, target-first hover, the Alt label overlay, drag targeting, the UI scale setting and the pattern strength setting. Deep Resolve, Wallflower, the Kettle and all 6 events stay. Typical playtime restated as about 60 minutes. 24.3 is now Wallflower, then Mirror Pond and Wishing Well, then the Kettle, and Deep Resolve is never cut (D14, 3.1, 16.1, 16.2, 16.6, 16.7, 18.1, 19, 20.2, 21.1, 21.3, 23, 24.2, 24.3).

**Minor**
- **minor-1** Perspective: "Remove all your afflictions except Numb. Draw 1." Yellow Umbrella blocks the first affliction from any source, including Chipped Teacup and Numb (4.6, 4.9, 9.3, 22).
- **minor-2** Deleted the `printed.length === 2 && partners(own).length > 0` branch of `harmonize`. A Blend Harmonizes only with an adjacent Light outside its own pair (2, 4.4, 6.8, 20.3, 22).
- **minor-3** Worry max 6 (7.2, 20.3, 22).
- **minor-4** `passiveFlat` deleted. Old Grudge's Tally is part of `rehash`'s base amount (5.5).
- **minor-5** `glimmersBase` gains `final: 0` so The Numbness pays no Glimmers (7.3 already says The Deep pays no Glimmers, so `glimmersResolve.final: 0` and an EnemyDef tier `final` were added too) (12.1, 20.3, 20.4).
- **minor-6** Paper Crane is tracked in `combat.paperCraneUsed` and committed through `CombatResult.keepsakeCounters` (5.5, 9.3, 20.3, 20.6).
- **minor-7** Map step 3: "Add edge (0,0), then walk the moves." (11.2, 22).
- **minor-8** Repair rule 2 converts only Fight nodes with no Elite neighbour, and rule 1 re-runs afterwards (11.3, 22).
- **minor-9** Row-6 Elite nodes all use one elite (map stream), row 8 uses the other, row 7 picks at random (8, 11.3, 22).
- **minor-10** "After 5 rerolls, keep the last roll" for parent-differing encounters and for duplicate card ids in reward offers (8, 11.3, 12.2).
- **minor-11** The Wishing Well's Echo fight pays base 10 + Resolve 8, counts as a win and gives no card reward (8, 10, 12.1, 20.3).
- **minor-12** Event options whose Heart cost is >= current Heart are disabled ("Not enough Heart") (10).
- **minor-13** New Run shows "Skip tutorial" when `tutorialDone` can't be read (3.2, 16.3, 20.8).
- **minor-14** All members of `enc.t1` to `enc.t4` start at pattern offset 0 (5.1, 7.0, 8, 17.1).
- **minor-15** Instinct: "Gain Guard equal to the total of all Shades' incoming strikes (max 30)." (6.11).
- **minor-16** Coach marks fill names from the trigger event. C5 quotes the real bad-advice line, C7 and C9 are templated, C11 is "Buried {Shade} hurts while held. Play {Light} Inward to Tend it." (17.3).
- **minor-17** Compass label "Harmonies this turn: 2" (16.1, 16.2).
- **minor-18** One spelling, "Tag, You're It!", everywhere. The cut-list entry is renamed "intent distortion (all variants)" (D12, 6.12, 12.2, 17.1, 24.2).
- **minor-19** Enemy phase presentation: 250 ms banner and about 300 ms per action, 1.45 s with 4 Shades (16.2, 18.1).
- **minor-20** HTML animates transform and opacity only, at most 2 SVG attributes animate at once, and the impact flash is an opacity overlay (18.1, 18.3).
- **minor-21** Impacts within 333 ms merge into one flash, and the extras use squash only (18.1, 19).
- **minor-22** Every tappable element is at least 56 reference px. Map nodes and Companion slots grow from 48 to 56 px (16.0, 16.2, 16.4, 19).
- **minor-23** Mutation regex `\.(hp|guard|energy)\s*([-+*/]?=(?!=)|\+\+|--)`, DOM ban `\b(document|window)\.` in the engine only, and `engine/index.ts` re-exports every type (20.2).
- **minor-24** `npm test` stays under 30 s with 30 seeds. The 300-seed preview-vs-step, 2000-seed map, 50-seed determinism and perf tests move to `npm run test:slow` (`vitest.slow.config.ts`, tests/slow/**). Balance gates stay in `npm run test:balance` (`vitest.balance.config.ts`, tests/balance/**). `vite.config.ts` excludes both folders (20.2, 20.5, 21.4, 22, 23).
- **minor-25** "Most common Light" counts only `ease` cards, with the same definition in the node detail, The Deep's Sanctuary and the bots (12.2, 13, 16.4, 21.1).
- **minor-26** Warm Locket Mends 8 (was 5). Spiral Shell: "+1 Spirit each turn. You can't Rest at Havens, and between acts you Mend only 50% of your missing Heart instead of to full." All other runs still Mend to full. New Keepsake flag `halfActMend` and rule `shellActMendPct: 50` (3.2, 5.8, 9.2, 9.4, 12.4, 15.1, 20.3, 20.4).
- **minor-27** Isolated: "your cards can't be Harmonized and your Companions don't act." (D10, 2, 4.4, 4.6, 4.13, 5.6, 6.4, 6.12, 16.2, 22).
- **minor-28** Apathy and The Numbness use a grey oval sigil labelled "NUMB" on map nodes and nameplates (7.3, 11.4, 16.0).
- **minor-29** A "Turn 32/40" counter shows from turn 30 (4.17, 16.2).
- **minor-30** Longing's Wallow added to the 5.7 step 2c list. 6.8's Blend sources include the Blend offered after the 2nd combat win (5.7, 6.8).

**Lead decisions**
- **L1** The M13 snapshot rule also covers Surfaced Shades spawned at combat start: they exist before the first enemy phase starts, so they act in it (4.16, 5.7, 7.3, 22).
- **L2** `view.ts` is split into `src/engine/combat/view.ts` (intents, handHints, cardText) and `src/engine/run/view.ts` (nodeDetail, deck and Light-mix summaries). `src/engine/combat/index.ts` is the combat module's public surface (startCombat, combatLegalActions, stepCombat, previewCombat, buildCombatResult, intents, handHints, cardText), consumed by `src/engine/step.ts` and `src/engine/index.ts` (run-side owner). The old `pileCounts()` helper is dropped because the Engine API never exposed it (20.2, 23).
- **L3** Targeting: click/tap a card to select, then click/tap a Shade or the INWARD heart. Keys as in 19 (16.1, 16.2, 19).
- **L4** The package.json script list shows the final set: dev, build, preview, typecheck (3 tsconfigs), test, test:watch, test:slow, test:balance, sim (20.2).
- **L5 lead: harmonized Keepsake triggers after the card's effects.** Keepsake `harmonized` triggers (Tuning Fork) fire once the card's effect list has finished (after 5.3 step 7, before step 8 cleanup), not at step 4: a draw at step 4 stopped the sealed preview before the card's hits, so the first Harmonized card each turn showed no RESOLVE/SUPPRESS banner. An Inward play's Tend target is chosen before any Keepsake draw. A card that ends the combat (R-8b) fires no trigger (5.3).
- **L6 lead: Intensity thresholds are percent of current max Intensity.** The Mask's Cracked, the Spiral's Deepening and The Numbness's Thaw trigger at 50% of current max Intensity (75 of 150, 100 of 200, 90 of 180), so B2 growth raises the Thaw point (4.16, 7.1, 7.2, 7.3).
- **L7 lead: Woven Bracelet summons on turn 1 start.** Its Lantern Moth moves from the combat-start triggers (5.1 step 4) to the turn-1 Keepsake triggers (5.2 step 5), after the turn-1 Guard reset, so Welcome Mat's +3 Guard from that summon is kept (5.1, 5.2).

**Editor's clarifications** (needed to apply the decisions above consistently)
- **B3** "Already own" an Insight means created earlier this run, even if it has since left the deck. This reconciles "created at most once per run" with "whose Insight you already own" (4.10, 20.3).
- **M15** The `confused` bot also uses map hints and the coverage draft, read through its rotated chart, like `aware` with a wrong chart (21.1).
- **minor-26** Mend happens after the boss Keepsake pick, so a Spiral Shell taken at that boss already halves that act transition's Mend (12.4).
- **M10** The Deep's sale Blend slot is chosen with the `shop` stream, and the third Blend is random (13).
- **Header** Title and status line updated to v1.1.
