# Heartward balance report

Generated 2026-09-24T12:09:39.236Z by `sim/cli.ts` (DESIGN 21). Seeds start at 1; seeds are paired across bots. Runs per bot: arc3-love 1000, aware 2000, aware-noHarmony 2000, aware-noInward 2000, aware-noResolve 2000, blind 2000, buryAll 1000, confused 2000, greedyType 2000, mono-courage 1000, mono-love 1000, pair-delight 1000, rainbow 1000, random 2000, resolveOnly 1000. Rules: DEFAULT_RULES (no overrides). Content scaling: none. Content patch: none. Strict invariant checks: on. Wall time 322 s.

Summary: 21 of 40 21.3 targets pass (18 fail); 5 of 6 CI gates pass.

## CI gates (M14; the gate itself runs on 300 fixed seeds in `npm run test:balance`)

| Status | Metric | Target | Value |
| --- | --- | --- | --- |
| PASS | `aware` win rate | >= 30% | 98.0% |
| PASS | `aware` - `blind` | >= +8.0 pp and one-sided McNemar p < 0.05 | +25.8 pp (n=2000, McNemar p=0.0000, mid-p=0.0000) |
| PASS | `aware` - `greedyType` | >= +2.0 pp and one-sided McNemar p < 0.05 | +13.5 pp (n=2000, McNemar p=0.0000, mid-p=0.0000) |
| **FAIL** | `blind` - `confused` | > 0 and one-sided McNemar p < 0.05 | -7.0 pp (p=1.0000) |
| PASS | `random` win rate | < 5% | 0.0% |
| PASS | Invariant violations, softlocks, RunawayTriggers | 0 | 0 |

## 21.3 targets

| Status | Metric | Target | Value |
| --- | --- | --- | --- |
| **FAIL** | `aware` win rate | 45-65% | 98.0% |
| PASS | `aware` - `blind` paired win rate | >= +15.0 pp | +25.8 pp (n=2000, McNemar p=0.0000, mid-p=0.0000) |
| PASS | `aware` - `greedyType` paired win rate | >= +8.0 pp | +13.5 pp (n=2000, McNemar p=0.0000, mid-p=0.0000) |
| **FAIL** | Ladder `random < confused < blind < greedyType < aware` | holds | random 0.0% < confused 79.2% < blind 72.3% < greedyType 84.5% < aware 98.0% |
| **FAIL** | Decision divergence (aware vs greedyType, combat decisions) | >= 25% | 13.5% of 282479 |
| **FAIL** | Type-flip rate (aware vs blind, combat decisions) | >= 35% | 31.7% of 282479 |
| PASS | OPPOSITE share of card damage, aware | >= 45% | 49.0% |
| **FAIL** | OPPOSITE share of card damage, blind | <= 30% | 35.0% |
| PASS | DISSONANT share of card damage, aware | <= 5% | 0.3% |
| **FAIL** | DISSONANT share of card damage, blind | >= 10% | 2.8% |
| PASS | Resolve share of named kills, aware | 60-80% | 63.4% |
| **FAIL** | Resolve share of named kills, blind | 25-45% | 51.7% |
| **FAIL** | Ablation `aware-noResolve` below aware | >= +5.0 pp | +0.4 pp (p=0.1620) |
| **FAIL** | Ablation `aware-noHarmony` below aware | >= +5.0 pp | +0.3 pp (p=0.3101) |
| PASS | Ablation `aware-noInward` below aware | >= +3.0 pp | +6.2 pp (p=0.0000) |
| **FAIL** | Harmonized share of cards played after the Compass, aware | 25-45% | 53.8% |
| PASS | Median Tends per run, aware | >= 2 | 4.0 |
| **FAIL** | `buryAll` vs `resolveOnly`: within 10 pp, both >= 10 pp below aware | within 10 pp; both <= aware - 10 pp | buryAll 96.6%, resolveOnly 78.6%, aware 98.0% |
| PASS | Win rate by Charm (aware), each within +/-8 pp of the mean | +/-8 pp | brave_pebble 97% (n=482), sun_charm 97% (n=485), warm_locket 100% (n=491), woven_bracelet 98% (n=542) |
| PASS | Win rate by dominant deck Light (aware), each within +/-10 pp of the mean | +/-10 pp (groups with n >= 15) | courage 99% (n=436), friendship 98% (n=757), joy 98% (n=372), love 97% (n=429) |
| **FAIL** | Policy bot `pair-delight` | 25-55%, not above aware + 5 pp | 72.9% |
| **FAIL** | Policy bot `arc3-love` | 25-55%, not above aware + 5 pp | 76.8% |
| **FAIL** | Policy bot `rainbow` | 25-55%, not above aware + 5 pp | 98.1% |
| **FAIL** | `mono-love` overall | 15-45% | 63.4% |
| **FAIL** | `mono-courage` overall | 15-45% | 59.0% |
| PASS | The Numbness win rate given reached, aware | >= 60% | 100.0% (1960/1960) |
| **FAIL** | The Numbness win rate given reached, blind | <= 35% | 99.7% (1445/1450) |
| PASS | `mono-love` vs The Numbness given reached, relative to arc3-love | >= 30% of arc3 rate | 100.0% (634/634) vs arc3 99.9% (768/769) |
| PASS | `mono-courage` vs The Numbness given reached, relative to arc3-love | >= 30% of arc3 rate | 99.8% (590/591) vs arc3 99.9% (768/769) |
| PASS | Median total Buried Weight on reaching The Deep, aware | 1-4 | 1.0 |
| PASS | Heart lost per fight, blind / aware, normals | 1.1-1.5x | 1.47x [1.45, 1.51] (blind 6.9 / aware 4.7) |
| PASS | Heart lost per fight, blind / aware, elites | >= 1.5x | 1.60x [1.55, 1.65] (blind 18.9 / aware 11.8) |
| PASS | Heart lost per fight, blind / aware, act bosses | >= 1.5x | 1.81x [1.75, 1.86] (blind 27.6 / aware 15.3) |
| **FAIL** | Heart lost per fight, blind / aware, The Numbness | >= 1.5x | 1.37x [1.30, 1.44] (blind 15.8 / aware 11.5) |
| PASS | `random` win rate | < 2% | 0.0% |
| PASS | Median turns per normal fight, aware | 3-6 | 3.0 |
| PASS | p99 combat length, aware | < 20 turns | 8.0 |
| PASS | Max cards played in one turn, all bots | <= 25 | 13 |
| PASS | Invariant violations, softlocks, RunawayTriggers (runs affected) | 0 | 0 |
| N/A | Preview/apply mismatches | 0 | covered by tests/slow/combat.previewVsStep.test.ts |

## Bots

| Bot | Runs | Win % [95% CI] | Reached Act 2 / Deep | Numbness won / reached | Heart per fight N/E/B/F | Median turns (normal) | Resolve share | OPP / DIS dmg | ms/run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| arc3-love | 1000 | 76.8% [74.1%, 79.3%] | 95% / 77% | 768/769 (100%) | 6.5 / 19.2 / 32.9 / 17.1 | 3.0 | 55% | 41% / 0% | 60 |
| aware | 2000 | 98.0% [97.3%, 98.5%] | 99% / 98% | 1960/1960 (100%) | 4.7 / 11.8 / 15.3 / 11.5 | 3.0 | 63% | 49% / 0% | 62 |
| aware-noHarmony | 2000 | 97.8% [97.0%, 98.3%] | 98% / 98% | 1955/1955 (100%) | 4.5 / 11.3 / 15.4 / 11.0 | 3.0 | 64% | 49% / 0% | 57 |
| aware-noInward | 2000 | 91.8% [90.6%, 93.0%] | 96% / 92% | 1837/1839 (100%) | 5.5 / 15.4 / 22.0 / 16.4 | 3.0 | 62% | 48% / 0% | 61 |
| aware-noResolve | 2000 | 97.7% [96.9%, 98.2%] | 99% / 98% | 1953/1953 (100%) | 4.8 / 12.6 / 16.6 / 11.5 | 3.0 | 56% | 47% / 0% | 60 |
| blind | 2000 | 72.3% [70.2%, 74.2%] | 91% / 73% | 1445/1450 (100%) | 6.9 / 18.9 / 27.6 / 15.8 | 3.0 | 52% | 35% / 3% | 57 |
| buryAll | 1000 | 96.6% [95.3%, 97.6%] | 97% / 97% | 966/966 (100%) | 4.8 / 12.3 / 14.6 / 11.0 | 3.0 | 57% | 48% / 0% | 60 |
| confused | 2000 | 79.2% [77.4%, 80.9%] | 85% / 79% | 1584/1585 (100%) | 8.4 / 16.5 / 20.7 / 13.4 | 3.0 | 56% | 39% / 5% | 66 |
| greedyType | 2000 | 84.5% [82.8%, 86.0%] | 98% / 85% | 1690/1693 (100%) | 5.5 / 16.1 / 24.2 / 13.5 | 3.0 | 51% | 42% / 1% | 53 |
| mono-courage | 1000 | 59.0% [55.9%, 62.0%] | 87% / 59% | 590/591 (100%) | 6.5 / 17.3 / 34.3 / 13.9 | 3.0 | 53% | 42% / 1% | 51 |
| mono-love | 1000 | 63.4% [60.4%, 66.3%] | 88% / 63% | 634/634 (100%) | 7.4 / 21.8 / 43.1 / 16.2 | 3.0 | 53% | 42% / 0% | 58 |
| pair-delight | 1000 | 72.9% [70.1%, 75.6%] | 94% / 73% | 729/729 (100%) | 6.3 / 19.2 / 40.4 / 17.6 | 3.0 | 54% | 39% / 0% | 61 |
| rainbow | 1000 | 98.1% [97.1%, 98.8%] | 99% / 98% | 981/981 (100%) | 4.7 / 11.8 / 14.8 / 11.6 | 3.0 | 64% | 50% / 0% | 62 |
| random | 2000 | 0.0% [0.0%, 0.2%] | 0% / 0% | 0/0 (0%) | 25.8 / 29.0 / 37.3 / n/a | 5.0 | 47% | 45% / 7% | 9 |
| resolveOnly | 1000 | 78.6% [76.0%, 81.0%] | 97% / 79% | 786/788 (100%) | 10.3 / 13.2 / 15.7 / 11.9 | 3.0 | 92% | 54% / 0% | 62 |

Heart per fight is the mean Heart lost per fight of that tier (N normal, E elite, B act boss, F The Numbness). OPP / DIS are the OPPOSITE and DISSONANT shares of card damage.

## Paired gaps

| A - B | Paired seeds | Win-rate gap | A only / B only wins | One-sided McNemar p (exact) | mid-p |
| --- | --- | --- | --- | --- | --- |
| aware - blind | 2000 | +25.8 pp | 543 / 28 | < 0.0001 | < 0.0001 |
| aware - greedyType | 2000 | +13.5 pp | 298 / 28 | < 0.0001 | < 0.0001 |
| greedyType - blind | 2000 | +12.3 pp | 388 / 143 | < 0.0001 | < 0.0001 |
| blind - confused | 2000 | -7.0 pp | 270 / 409 | 1.0000 | 1.0000 |
| confused - random | 2000 | +79.2 pp | 1584 / 0 | < 0.0001 | < 0.0001 |
| aware - aware-noResolve | 2000 | +0.4 pp | 22 / 15 | 0.1620 | 0.1279 |
| aware - aware-noHarmony | 2000 | +0.3 pp | 35 / 30 | 0.3101 | 0.2693 |
| aware - aware-noInward | 2000 | +6.2 pp | 149 / 26 | < 0.0001 | < 0.0001 |
| aware - buryAll | 1000 | +1.1 pp | 26 / 15 | 0.0586 | 0.0442 |
| aware - resolveOnly | 1000 | +19.1 pp | 205 / 14 | < 0.0001 | < 0.0001 |
| resolveOnly - buryAll | 1000 | -18.0 pp | 27 / 207 | 1.0000 | 1.0000 |
| aware - mono-love | 1000 | +34.3 pp | 350 / 7 | < 0.0001 | < 0.0001 |
| aware - mono-courage | 1000 | +38.7 pp | 399 / 12 | < 0.0001 | < 0.0001 |
| aware - pair-delight | 1000 | +24.8 pp | 263 / 15 | < 0.0001 | < 0.0001 |
| aware - arc3-love | 1000 | +20.9 pp | 220 / 11 | < 0.0001 | < 0.0001 |
| aware - rainbow | 1000 | -0.4 pp | 6 / 10 | 0.8949 | 0.8338 |

## Diagnosis

**The default content is far too easy for every non-random bot.** `aware` wins 98.0% (target 45-65%), `blind` 72.3%, `confused` 79.2%, `greedyType` 84.5%, and every bot that reaches The Numbness beats it (aware 1960/1960, blind 1445/1450). Only 40 of 2000 aware runs are lost (16 at The Mask, 16 at The Spiral). Because nearly every good run wins, most gaps and ablations are compressed against the 100% ceiling, and the 21.3 checks that compare bots cannot be read at this difficulty.

Where the Heart goes (aware, default): normal fights cost 4.7 Heart and last a median 3 turns (the bottom of the 3-6 band). Act 2 normal fights are *cheaper* than Act 1 ones (Fret 1.3, Dread 1.8, Old Grudge 3.2, Longing 3.3 Heart per fight against Mope 5.7, Two Skitters 10.3): the Act 2 roster does not keep pace with the deck. Apathy, an Act 2 elite, costs 3.6 Heart in 2.9 turns. The Numbness costs 11.5 Heart in 3.7 turns: two-Light hits are FELT x2 and after the Compass more than half of all plays carry two Lights (Harmonized or Blend), so 180 Intensity melts. Warm Locket's Mend 8 after every win and the between-act Mend to full refill most of that.

**Structural findings (hold at every difficulty tested, so they are not number problems):**

1. **Harmony is automatic and huge, so knowing it adds nothing.** With the Compass disabled (`--set rules.compassAfterWins=99`, stage-1 scaling) aware falls from 57.7% to 7.3%. But `aware-noHarmony` is never below aware (default +0.3 pp; stage 1 it is 6.0 pp *above* aware, p = 0.9999 one-sided): the preview already scores every Harmonized play for every bot, and the 21.1 bonuses (+2 Harmonized, +1 Harmonizable card left) make aware pick slightly worse plays. The ablation as specified cannot reach 5 pp.
2. **Inward is the most valuable skill.** `aware-noInward` is 6.2 pp below aware at default and 27.7 pp below at stage 1 (Spiral deaths 70 -> 186). This is also why the ladder breaks: `confused` has knowsCleanse (M15, all knows* true) and beats `blind` by 7.0 pp at default and 8.6 to 12 pp at every harder setting (p = 1.0). The chart is worth less than Inward plus Harmony knowledge.
3. **Suppress is almost free.** `aware-noResolve` is within 1 pp of aware everywhere, and `buryAll` is 1.1 pp (default) / 2.6 pp (tuned) below aware. Buried cards are cleared by Inward Tend, Haven Reflect and Talk it through (median 4 Tends per aware run, median Buried Weight 1 on reaching The Deep) and paid back as Insight. `resolveOnly` loses 19 to 27 pp because refusing Suppress stretches fights (Slump and Fret kill it: they need Hope or Calm, which Act 2 decks lack early). Doubling the Resolve Glimmer bonus (8/20/40 -> 16/35/60) left the noResolve gap at +1 pp or less. So `buryAll` vs `resolveOnly` within 10 pp and the noResolve ablation fail for rule reasons, not numbers.
4. **Two-Light plays hide the chart from blind play.** 52% of blind's card plays carry two Lights; those are never DISSONANT and are OPPOSITE whenever either Light cures the face. Blind's DISSONANT share is 2.8% (target >= 10%), OPPOSITE 35.0% (target <= 30%) and Resolve share 51.7% (target 25-45%). Only 16% of blind's single-Light hits are DISSONANT. Harmonized share of aware's plays is 53.8% (target 25-45%), but aware-noHarmony still plays 49% Harmonized and blind 41%: with four adjacent Act 1 Lights it happens by itself.
5. **Decision divergence 13.5% (target 25%) and type-flip 31.7% (target 35%)** over 282k combat decisions: in most turns the best play does not depend on Resolve, Flare, cleanse or face knowledge. Card-reward picks differ in 28.7% of offers (greedyType and blind share one run policy, so both reward rates are equal).
6. **Restricted drafts hit hard counters.** At default the policy bots are too strong (pair-delight 72.9%, arc3-love 76.8%, rainbow 98.1% = aware, mono 59-63%); at stage 1 they collapse to 6-10% (rainbow 61.2%, on par with aware). They die at The Spiral (Coil only unwinds on Hope/Calm cards and face turns; an Act-1-Light deck has no cure for either face), The Mask (needs all four Act 1 Lights) and The Looming (Grows in the Dark adds Flare every turn without Courage). Letting them take neutral cards or Set Down off-Light starters changed these rates by about 2 pp at most (within noise).
7. **The combat lab** (`sim/out/lab.md`, 12-card decks x every encounter x 20 seeds) shows two content risks. A deck without Joy cannot beat Mope (mono-Love: 0% wins, every fight reaches the 40-turn limit; Wallow's Mend 5 plus `curl_up` Guard 10 outpace Love at x1/2), and the same happens against Longing; no deck without Hope or Calm beats The Spiral, and mono-Love and Love+Courage never beat The Numbness (no FELT). The neutral-only control deck (6 Push It Down, 4 Name It, 2 Pause) loses 25.5 Heart per fight on average, less than mono-Love (61.6), Love+Courage (64.3) and Love+Joy (32.9): Push It Down's Ease 9 x1 beats typed Ease 6 unless the typed card is OPPOSITE.

## Tuning suggestions (21.3 order)

All numbers below were measured with `--scale` / `--patch`, which change an in-memory copy of the pack only. Reproduce with `npx vite-node sim/parallel.ts -- --bots all --runs 1000 --policy-runs 500 --scale hp.a1=1.2,strike.a1=1.25,hp.a2=1.4,strike.a2=1.4,hp.final=2.2,strike.final=1.6 [--patch sim/patches/tuning-candidate.ts] --strict`. Full reports: `sim/out/stage1/report.md` (step 1 only) and `sim/out/tuned/report.md` (steps 1 and 2).

**1. Enemy Intensity and strikes (first knob, 24.1).**

| Group | Change | Examples |
|---|---|---|
| Act 1 Shades (incl. The Looming, The Kettle, The Mask) | Intensity x1.2, strikes x1.25 | Grumble 40-44 -> 48-53, `snap` 7 -> 9; Mope 46-50 -> 55-60, `sigh` 6 -> 8; Skitter `lunge` 10 -> 13; The Looming 84-88 -> 101-106, `pounce` 14 -> 18; The Kettle 90-94 -> 108-113, `boil_over` 24 -> 30; The Mask 150 -> 180, `rage` 12 -> 15 |
| Act 2 Shades (incl. The Knot, Apathy, The Spiral) | Intensity x1.4, strikes x1.4 | Fret 42-46 -> 59-64; Slump 50-54 -> 70-76, `collapse` 15 -> 21; Old Grudge 60-64 -> 84-90; Dread `the_thing` 24 -> 34; The Knot 108-112 -> 151-157, `snap` 22 -> 31; Apathy 90-94 -> 126-132, `shrug` 10 -> 14; The Spiral 200 -> 280, `around_again` 12 -> 17 |
| The Numbness | Intensity 180 -> 396 (x2.2), strikes x1.6 | `static` 12 -> 19, `nothing_much` 8 -> 13, `flatline` 18 -> 29, `static_storm` 4x4 -> 6x4 (Thaw stays at 50%) |

Encounter HP overrides scale with their act (for example Act 2's Grumble 34-38 -> 48-53). Result on 1000 paired seeds: aware **57.7%** [54.6, 60.7], greedyType 18.9%, confused 19.1%, blind 10.0%; aware - blind +47.7 pp, aware - greedyType +38.8 pp (both p < 0.0001); The Numbness given reached aware 93.1%, blind 67.6%; Heart lost per fight, aware: normal 9.8, elite 22.5, boss 26.9, Numbness 36.6. Median normal fight is still 3 turns (p99 10.7). A uniform x1.3 on everything gives aware 54-55% (300 seeds) but leaves The Numbness at 100% given reached (162/162).

**2. Card and Keepsake numbers** (tested together in `sim/patches/tuning-candidate.ts`):
- Push It Down Ease 9 -> 7 (upgraded 12 -> 10), so the neutral control stops out-trading typed cards.
- Warm Locket Mend 8 -> 5, Brave Pebble 1 -> 2 Nerve, Sun Charm 2 -> 3 extra cards on turn 1. Aware by Charm moves from 47 / 50 / 73 / 59% (Pebble / Sun / Locket / Bracelet, stage 1) to 63 / 52 / 68 / 59%: Sun Charm is still about 9 pp under the mean; next try Sun Charm +1 Spirit on turn 1 as well.
- Joy-dominant decks trail (aware 44% vs Courage 70%, Friendship 66%, Love 58% at the tuned setting). Untested suggestion: Confetti 3 x2 -> 4 x2 and Belly Laugh Ease 8 -> 10.
- With both steps: aware **60.7%** [57.6, 63.7], rainbow 62.0%, greedyType 22.6%, confused 19.9%, blind 11.3%, The Numbness given reached aware 94.8% / blind 74.3%.

**3. Glimmers and prices:** no change recommended. Doubling Resolve Glimmers did not open the noResolve or buryAll gaps (both stayed within 2 pp).

**4. Rule percents (last):** `feltPct` 200 -> 150 on top of step 1 moves The Numbness given reached from 95% to 88% (aware) and from 72% to 58-69% (blind), and aware's overall win rate from 57.7% to 54%. The blind target (<= 35% given reached) is partly a survivor effect: only the strongest 15% of blind runs reach The Deep. Prefer The Numbness's Intensity (step 1) and try `feltPct` 150 only if the given-reached gap stays under 20 pp.

**Lead decisions the numbers cannot fix** (see the structural findings): the noHarmony ablation (redefine it as "no Compass", `rules.compassAfterWins=99`, which shows Harmony worth about 50 pp, or give knowsHarmony a Note-planning lookahead); the Resolve/Suppress weight (Buried in hand = Weight + 1 stacks, overflow 3 -> 5 max Heart, or weaker Insight); `confused` keeping knowsCleanse (M15); the blind relation-share targets while more than half of plays carry two Lights; and softer hard counters for restricted drafts (The Spiral also unwinds 1 Coil on any OPPOSITE hit; Grows in the Dark capped at 3 Flare; Mope's Wallow restores 3).

## Where runs end

| Run ended at | aware | greedyType | blind | confused | mono-love | mono-courage | resolveOnly |
| --- | --- | --- | --- | --- | --- | --- | --- |
| enc.a1.mask | 16 | 14 | 76 | 56 | 68 | 110 | 21 |
| enc.a2.spiral | 16 | 254 | 342 | 98 | 231 | 247 | 23 |
| enc.a1.looming | 4 | 8 | 50 | 120 | 28 | 6 | 2 |
| enc.a1.two_skitters | 1 | 2 | 14 | 32 | 8 | 0 | 1 |
| enc.a1.kettle | 1 | 9 | 23 | 15 | 5 | 8 | 0 |
| enc.a1.two_grumbles | 1 | 2 | 0 | 3 | 0 | 0 | 1 |
| enc.a1.mope_skitter | 1 | 0 | 11 | 33 | 3 | 1 | 0 |
| enc.a2.slump_echo | 0 | 4 | 8 | 3 | 1 | 4 | 11 |
| enc.a2.knot | 0 | 4 | 11 | 3 | 5 | 14 | 11 |
| enc.deep.numbness | 0 | 3 | 5 | 1 | 0 | 1 | 2 |
| enc.a2.longing | 0 | 2 | 1 | 1 | 3 | 2 | 10 |
| enc.a1.echo_mope | 0 | 2 | 5 | 26 | 3 | 1 | 0 |
| enc.a2.dread | 0 | 1 | 0 | 2 | 1 | 1 | 11 |
| enc.a1.grumble_echo | 0 | 1 | 5 | 5 | 2 | 2 | 1 |
| enc.a2.apathy | 0 | 1 | 0 | 3 | 0 | 6 | 1 |
| enc.a2.wallflower_fret | 0 | 1 | 1 | 1 | 4 | 2 | 3 |
| enc.a2.wallflower_grumble | 0 | 1 | 0 | 0 | 2 | 1 | 6 |
| enc.a2.old_grudge | 0 | 1 | 1 | 1 | 1 | 2 | 13 |
| enc.a2.two_frets | 0 | 0 | 2 | 1 | 0 | 1 | 8 |
| enc.a1.mope | 0 | 0 | 0 | 11 | 0 | 0 | 0 |
| enc.a1.echo | 0 | 0 | 0 | 1 | 1 | 1 | 0 |
| enc.a2.slump | 0 | 0 | 0 | 0 | 0 | 0 | 50 |
| enc.a2.fret | 0 | 0 | 0 | 0 | 0 | 0 | 39 |
| (all losses: heart) | 40 | 310 | 555 | 416 | 366 | 410 | 214 |

## Heart lost per encounter

| Encounter | Tier | aware: Heart lost/fight (turns, fights, losses) | greedyType: Heart lost/fight (turns, fights, losses) | blind: Heart lost/fight (turns, fights, losses) |
| --- | --- | --- | --- | --- |
| enc.a1.looming | elite | 19.4 (4.9t, 1028f, 4L) | 21.0 (5.2t, 1004f, 8L) | 25.4 (6.0t, 857f, 50L) |
| enc.a1.mask | boss | 18.2 (5.7t, 1992f, 16L) | 19.2 (5.6t, 1976f, 14L) | 24.4 (6.2t, 1892f, 76L) |
| enc.a2.spiral | boss | 12.3 (6.6t, 1976f, 16L) | 29.2 (8.3t, 1947f, 254L) | 31.0 (8.4t, 1792f, 342L) |
| enc.a2.knot | elite | 12.2 (4.1t, 1097f, 0L) | 21.0 (4.9t, 926f, 4L) | 21.1 (4.9t, 805f, 11L) |
| enc.a1.kettle | elite | 11.8 (3.7t, 1030f, 1L) | 14.1 (4.1t, 1007f, 9L) | 18.3 (4.5t, 840f, 23L) |
| enc.deep.numbness | final | 11.5 (3.7t, 1960f, 0L) | 13.5 (4.3t, 1693f, 3L) | 15.8 (5.3t, 1450f, 5L) |
| enc.a1.two_skitters | normal | 10.3 (3.3t, 667f, 1L) | 10.9 (3.3t, 522f, 2L) | 13.6 (3.8t, 544f, 14L) |
| enc.a1.mope_skitter | normal | 8.6 (3.4t, 654f, 1L) | 9.1 (3.6t, 528f, 0L) | 12.7 (4.4t, 528f, 11L) |
| enc.a1.grumble_echo | normal | 6.5 (2.9t, 701f, 0L) | 7.2 (3.1t, 512f, 1L) | 8.6 (3.8t, 546f, 5L) |
| enc.a2.slump | normal | 6.2 (2.9t, 1984f, 0L) | 7.9 (3.2t, 1966f, 0L) | 8.5 (3.3t, 1830f, 0L) |
| enc.a1.echo_mope | normal | 6.0 (3.2t, 668f, 0L) | 6.0 (3.4t, 520f, 2L) | 8.8 (4.1t, 546f, 5L) |
| enc.a1.mope | normal | 5.7 (3.4t, 1874f, 0L) | 6.2 (3.4t, 1743f, 0L) | 9.9 (3.7t, 1738f, 0L) |
| enc.a2.slump_echo | normal | 5.6 (3.0t, 411f, 0L) | 10.1 (3.8t, 389f, 4L) | 12.8 (4.3t, 375f, 8L) |
| enc.a1.skitter | normal | 5.5 (2.4t, 1847f, 0L) | 5.4 (2.3t, 1726f, 0L) | 7.2 (2.7t, 1721f, 0L) |
| enc.a1.grumble | normal | 5.1 (2.2t, 1827f, 0L) | 4.9 (2.2t, 1735f, 0L) | 6.0 (2.5t, 1728f, 0L) |
| enc.a1.two_grumbles | normal | 4.8 (2.6t, 692f, 1L) | 5.9 (2.7t, 512f, 2L) | 6.4 (2.9t, 557f, 0L) |
| enc.a2.apathy | elite | 3.6 (2.9t, 984f, 0L) | 7.7 (3.8t, 885f, 1L) | 10.3 (4.7t, 791f, 0L) |
| enc.a2.longing | normal | 3.3 (2.4t, 904f, 0L) | 5.4 (2.6t, 619f, 2L) | 6.5 (2.8t, 586f, 1L) |
| enc.a2.wallflower_fret | normal | 3.2 (3.1t, 453f, 0L) | 4.6 (3.1t, 362f, 1L) | 4.3 (3.2t, 349f, 1L) |
| enc.a2.old_grudge | normal | 3.2 (2.4t, 957f, 0L) | 5.6 (2.6t, 602f, 1L) | 7.0 (2.9t, 584f, 1L) |
| enc.a2.wallflower_grumble | normal | 3.0 (2.5t, 561f, 0L) | 3.9 (2.6t, 372f, 1L) | 5.3 (3.0t, 337f, 0L) |
| enc.a2.two_frets | normal | 1.9 (3.0t, 269f, 0L) | 4.1 (3.4t, 401f, 0L) | 4.3 (3.5t, 389f, 2L) |
| enc.a2.dread | normal | 1.8 (2.3t, 571f, 0L) | 2.2 (2.5t, 638f, 1L) | 2.6 (2.6t, 600f, 0L) |
| enc.a1.echo | normal | 1.3 (1.9t, 700f, 0L) | 1.3 (2.0t, 499f, 0L) | 1.7 (2.3t, 512f, 0L) |
| enc.a2.fret | normal | 1.3 (2.3t, 1968f, 0L) | 1.5 (2.4t, 1958f, 0L) | 1.7 (2.4t, 1802f, 0L) |
| enc.mem.echo | event | 1.1 (1.8t, 271f, 0L) | 1.1 (1.9t, 476f, 0L) | 1.9 (2.2t, 408f, 0L) |

### aware by Charm

| Group | Runs | Win % [95% CI] |
| --- | --- | --- |
| ks.brave_pebble | 482 | 97.3% [95.4%, 98.4%] |
| ks.sun_charm | 485 | 96.9% [95.0%, 98.1%] |
| ks.warm_locket | 491 | 99.6% [98.5%, 99.9%] |
| ks.woven_bracelet | 542 | 98.2% [96.6%, 99.0%] |

### aware by dominant deck Light (most common Light among ease cards at the end of the run)

| Group | Runs | Win % [95% CI] |
| --- | --- | --- |
| calm | 1 | 100.0% [20.7%, 100.0%] |
| courage | 436 | 98.6% [97.0%, 99.4%] |
| friendship | 757 | 98.3% [97.1%, 99.0%] |
| hope | 5 | 100.0% [56.6%, 100.0%] |
| joy | 372 | 97.8% [95.8%, 98.9%] |
| love | 429 | 97.0% [94.9%, 98.2%] |

## Engine issues found by the runs

No engine errors, invariant violations or softlocks.
