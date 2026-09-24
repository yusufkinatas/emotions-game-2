> **Quick pass (B-1, 2026-09-24).** One-pass balance change written into `src/content` from the simulator's tuning suggestions: Act 1 Shades Intensity x1.2 and strikes x1.25, Act 2 Shades x1.4 on both, The Numbness 180 -> 396 Intensity and strikes x1.6 (tutorial Shades unchanged), Push It Down Ease 9 -> 7 (12 -> 10), Warm Locket Mend 8 -> 5, Brave Pebble 1 -> 2 Nerve, Sun Charm 2 -> 3 extra cards on turn 1. Stall fixes: Mope and Longing stop Wallowing once at half Intensity or less, an OPPOSITE card hit unwinds 1 more Coil on The Spiral, Grows in the Dark only adds Flare below 3 Flare. One check run (300 paired seeds, aware / blind / greedyType / random, `--strict`): aware 64.3%, aware - blind +55.3 pp, both inside the brief (40-75%, >= +15 pp), so no second adjustment was made. Not re-tuned: Sun Charm (54%) and Warm Locket (75%) are still outside +/-8 pp of the Charm mean, Joy-dominant decks still trail (50% against 67-68%), and `confused` was not run, so the `blind` - `confused` gate is not measured here. Reproduce with `npx vite-node sim/parallel.ts -- --bots aware,blind,greedyType,random --runs 300 --strict --out sim/out/quick`.

# Heartward balance report

Generated 2026-09-24T12:21:49.819Z by `sim/cli.ts` (DESIGN 21). Seeds start at 1; seeds are paired across bots. Runs per bot: aware 300, blind 300, greedyType 300, random 300. Rules: DEFAULT_RULES (no overrides). Content scaling: none. Content patch: none. Strict invariant checks: on. Wall time 21 s.

Summary: 15 of 40 21.3 targets pass (12 fail); 6 of 6 CI gates pass.

## CI gates (M14; the gate itself runs on 300 fixed seeds in `npm run test:balance`)

| Status | Metric | Target | Value |
| --- | --- | --- | --- |
| PASS | `aware` win rate | >= 30% | 64.3% |
| PASS | `aware` - `blind` | >= +8.0 pp and one-sided McNemar p < 0.05 | +55.3 pp (n=300, McNemar p=0.0000, mid-p=0.0000) |
| PASS | `aware` - `greedyType` | >= +2.0 pp and one-sided McNemar p < 0.05 | +37.7 pp (n=300, McNemar p=0.0000, mid-p=0.0000) |
| N/A | `blind` - `confused` | > 0 and one-sided McNemar p < 0.05 | n/a |
| PASS | `random` win rate | < 5% | 0.0% |
| PASS | Invariant violations, softlocks, RunawayTriggers | 0 | 0 |

## 21.3 targets

| Status | Metric | Target | Value |
| --- | --- | --- | --- |
| PASS | `aware` win rate | 45-65% | 64.3% |
| PASS | `aware` - `blind` paired win rate | >= +15.0 pp | +55.3 pp (n=300, McNemar p=0.0000, mid-p=0.0000) |
| PASS | `aware` - `greedyType` paired win rate | >= +8.0 pp | +37.7 pp (n=300, McNemar p=0.0000, mid-p=0.0000) |
| N/A | Ladder `random < confused < blind < greedyType < aware` | holds | random 0.0% < confused n/a < blind 9.0% < greedyType 26.7% < aware 64.3% |
| **FAIL** | Decision divergence (aware vs greedyType, combat decisions) | >= 25% | 13.0% of 45308 |
| **FAIL** | Type-flip rate (aware vs blind, combat decisions) | >= 35% | 31.9% of 45308 |
| PASS | OPPOSITE share of card damage, aware | >= 45% | 47.3% |
| **FAIL** | OPPOSITE share of card damage, blind | <= 30% | 41.9% |
| PASS | DISSONANT share of card damage, aware | <= 5% | 0.3% |
| **FAIL** | DISSONANT share of card damage, blind | >= 10% | 3.2% |
| PASS | Resolve share of named kills, aware | 60-80% | 64.6% |
| **FAIL** | Resolve share of named kills, blind | 25-45% | 55.7% |
| N/A | Ablation `aware-noResolve` below aware | >= +5.0 pp | n/a |
| N/A | Ablation `aware-noHarmony` below aware | >= +5.0 pp | n/a |
| N/A | Ablation `aware-noInward` below aware | >= +3.0 pp | n/a |
| **FAIL** | Harmonized share of cards played after the Compass, aware | 25-45% | 54.2% |
| PASS | Median Tends per run, aware | >= 2 | 3.0 |
| N/A | `buryAll` vs `resolveOnly`: within 10 pp, both >= 10 pp below aware | within 10 pp; both <= aware - 10 pp | buryAll n/a, resolveOnly n/a, aware 64.3% |
| **FAIL** | Win rate by Charm (aware), each within +/-8 pp of the mean | +/-8 pp | brave_pebble 61% (n=64), sun_charm 54% (n=78), warm_locket 75% (n=81), woven_bracelet 66% (n=77) |
| **FAIL** | Win rate by dominant deck Light (aware), each within +/-10 pp of the mean | +/-10 pp (groups with n >= 15) | courage 68% (n=62), friendship 68% (n=106), joy 50% (n=58), love 67% (n=73) |
| N/A | Policy bot `pair-delight` | 25-55%, not above aware + 5 pp | n/a |
| N/A | Policy bot `arc3-love` | 25-55%, not above aware + 5 pp | n/a |
| N/A | Policy bot `rainbow` | 25-55%, not above aware + 5 pp | n/a |
| N/A | `mono-love` overall | 15-45% | n/a |
| N/A | `mono-courage` overall | 15-45% | n/a |
| PASS | The Numbness win rate given reached, aware | >= 60% | 95.1% (193/203) |
| **FAIL** | The Numbness win rate given reached, blind | <= 35% | 67.5% (27/40) |
| N/A | `mono-love` vs The Numbness given reached, relative to arc3-love | >= 30% of arc3 rate | n/a vs arc3 n/a |
| N/A | `mono-courage` vs The Numbness given reached, relative to arc3-love | >= 30% of arc3 rate | n/a vs arc3 n/a |
| PASS | Median total Buried Weight on reaching The Deep, aware | 1-4 | 1.0 |
| PASS | Heart lost per fight, blind / aware, normals | 1.1-1.5x | 1.47x [1.40, 1.52] (blind 13.3 / aware 9.0) |
| **FAIL** | Heart lost per fight, blind / aware, elites | >= 1.5x | 1.39x [1.28, 1.51] (blind 29.2 / aware 21.0) |
| **FAIL** | Heart lost per fight, blind / aware, act bosses | >= 1.5x | 1.45x [1.36, 1.54] (blind 38.6 / aware 26.6) |
| **FAIL** | Heart lost per fight, blind / aware, The Numbness | >= 1.5x | 1.38x [1.20, 1.55] (blind 50.3 / aware 36.5) |
| PASS | `random` win rate | < 2% | 0.0% |
| PASS | Median turns per normal fight, aware | 3-6 | 3.0 |
| PASS | p99 combat length, aware | < 20 turns | 11.0 |
| PASS | Max cards played in one turn, all bots | <= 25 | 10 |
| PASS | Invariant violations, softlocks, RunawayTriggers (runs affected) | 0 | 0 |
| N/A | Preview/apply mismatches | 0 | covered by tests/slow/combat.previewVsStep.test.ts |

## Bots

| Bot | Runs | Win % [95% CI] | Reached Act 2 / Deep | Numbness won / reached | Heart per fight N/E/B/F | Median turns (normal) | Resolve share | OPP / DIS dmg | ms/run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aware | 300 | 64.3% [58.8%, 69.5%] | 81% / 68% | 193/203 (95%) | 9.0 / 21.0 / 26.6 / 36.5 | 3.0 | 65% | 47% / 0% | 129 |
| blind | 300 | 9.0% [6.3%, 12.8%] | 53% / 13% | 27/40 (68%) | 13.3 / 29.2 / 38.6 / 50.3 | 4.0 | 56% | 42% / 3% | 54 |
| greedyType | 300 | 26.7% [22.0%, 31.9%] | 76% / 30% | 80/89 (90%) | 11.0 / 27.8 / 33.7 / 42.9 | 3.0 | 53% | 47% / 1% | 53 |
| random | 300 | 0.0% [0.0%, 1.3%] | 0% / 0% | 0/0 (0%) | 31.7 / 29.1 / 40.2 / n/a | 6.0 | 40% | 42% / 9% | 3 |

Heart per fight is the mean Heart lost per fight of that tier (N normal, E elite, B act boss, F The Numbness). OPP / DIS are the OPPOSITE and DISSONANT shares of card damage.

## Paired gaps

| A - B | Paired seeds | Win-rate gap | A only / B only wins | One-sided McNemar p (exact) | mid-p |
| --- | --- | --- | --- | --- | --- |
| aware - blind | 300 | +55.3 pp | 171 / 5 | < 0.0001 | < 0.0001 |
| aware - greedyType | 300 | +37.7 pp | 139 / 26 | < 0.0001 | < 0.0001 |
| greedyType - blind | 300 | +17.7 pp | 67 / 14 | < 0.0001 | < 0.0001 |

## Where runs end

| Run ended at | aware | greedyType | blind |
| --- | --- | --- | --- |
| enc.a1.mask | 26 | 29 | 49 |
| enc.a2.spiral | 23 | 83 | 79 |
| enc.a1.looming | 14 | 17 | 20 |
| enc.deep.numbness | 10 | 9 | 13 |
| enc.a1.kettle | 8 | 4 | 16 |
| enc.a2.slump_echo | 6 | 9 | 8 |
| enc.a2.knot | 5 | 14 | 16 |
| enc.a1.mope_skitter | 4 | 9 | 17 |
| enc.a2.longing | 3 | 8 | 4 |
| enc.a1.two_skitters | 3 | 7 | 15 |
| enc.a1.grumble_echo | 2 | 2 | 7 |
| enc.a2.wallflower_fret | 1 | 3 | 1 |
| enc.a2.old_grudge | 1 | 4 | 2 |
| enc.a1.two_grumbles | 1 | 1 | 7 |
| enc.a2.apathy | 0 | 7 | 7 |
| enc.a2.two_frets | 0 | 4 | 1 |
| enc.a2.wallflower_grumble | 0 | 3 | 1 |
| enc.a2.dread | 0 | 3 | 1 |
| enc.a1.echo_mope | 0 | 3 | 9 |
| enc.a2.fret | 0 | 1 | 0 |
| (all losses: heart) | 107 | 220 | 273 |

## Heart lost per encounter

| Encounter | Tier | aware: Heart lost/fight (turns, fights, losses) | greedyType: Heart lost/fight (turns, fights, losses) | blind: Heart lost/fight (turns, fights, losses) |
| --- | --- | --- | --- | --- |
| enc.deep.numbness | final | 36.5 (7.2t, 203f, 10L) | 42.9 (7.8t, 89f, 9L) | 50.3 (8.8t, 40f, 13L) |
| enc.a1.looming | elite | 29.3 (5.1t, 106f, 14L) | 33.1 (5.7t, 98f, 17L) | 32.5 (5.7t, 70f, 20L) |
| enc.a2.knot | elite | 28.5 (5.0t, 96f, 5L) | 40.2 (5.7t, 61f, 14L) | 39.7 (5.4t, 45f, 16L) |
| enc.a1.mask | boss | 27.2 (6.6t, 268f, 26L) | 30.2 (6.5t, 257f, 29L) | 35.6 (6.7t, 209f, 49L) |
| enc.a2.spiral | boss | 25.9 (8.4t, 226f, 23L) | 38.9 (9.0t, 172f, 83L) | 43.7 (9.1t, 119f, 79L) |
| enc.a1.kettle | elite | 17.2 (4.2t, 107f, 8L) | 20.6 (4.6t, 101f, 4L) | 23.6 (4.7t, 74f, 16L) |
| enc.a1.two_skitters | normal | 15.4 (3.5t, 102f, 3L) | 15.9 (3.5t, 86f, 7L) | 21.0 (3.8t, 84f, 15L) |
| enc.a2.slump_echo | normal | 15.4 (4.0t, 62f, 6L) | 20.9 (4.6t, 49f, 9L) | 23.7 (4.8t, 40f, 8L) |
| enc.a1.mope_skitter | normal | 15.0 (3.7t, 110f, 4L) | 17.6 (4.0t, 90f, 9L) | 21.6 (4.8t, 90f, 17L) |
| enc.a2.slump | normal | 13.8 (3.9t, 236f, 0L) | 19.5 (4.5t, 230f, 0L) | 20.1 (4.4t, 162f, 0L) |
| enc.a1.grumble_echo | normal | 11.1 (3.3t, 105f, 2L) | 11.5 (3.5t, 88f, 2L) | 16.5 (4.3t, 82f, 7L) |
| enc.a1.echo_mope | normal | 10.8 (3.6t, 101f, 0L) | 11.6 (3.7t, 76f, 3L) | 16.5 (4.5t, 73f, 9L) |
| enc.a1.mope | normal | 10.5 (3.8t, 292f, 0L) | 11.2 (3.8t, 268f, 0L) | 16.3 (4.3t, 263f, 0L) |
| enc.a2.longing | normal | 10.3 (3.0t, 115f, 3L) | 15.0 (3.1t, 68f, 8L) | 17.4 (3.5t, 39f, 4L) |
| enc.a1.two_grumbles | normal | 8.7 (2.9t, 114f, 1L) | 10.3 (3.1t, 94f, 1L) | 10.1 (3.2t, 97f, 7L) |
| enc.a1.skitter | normal | 8.7 (2.7t, 282f, 0L) | 8.8 (2.6t, 263f, 0L) | 11.3 (3.1t, 268f, 0L) |
| enc.a1.grumble | normal | 8.1 (2.5t, 263f, 0L) | 8.0 (2.6t, 252f, 0L) | 9.9 (3.0t, 254f, 0L) |
| enc.a2.apathy | elite | 7.9 (3.6t, 90f, 0L) | 17.1 (4.3t, 51f, 7L) | 21.8 (5.6t, 38f, 7L) |
| enc.a2.old_grudge | normal | 7.7 (3.1t, 126f, 1L) | 10.3 (3.5t, 71f, 4L) | 12.9 (3.9t, 53f, 2L) |
| enc.a2.wallflower_fret | normal | 6.9 (3.9t, 69f, 1L) | 12.3 (4.1t, 50f, 3L) | 12.6 (4.6t, 32f, 1L) |
| enc.a2.wallflower_grumble | normal | 5.8 (3.1t, 73f, 0L) | 8.4 (3.4t, 49f, 3L) | 11.0 (3.9t, 36f, 1L) |
| enc.a2.two_frets | normal | 4.2 (3.7t, 36f, 0L) | 15.3 (4.3t, 37f, 4L) | 14.4 (4.3t, 27f, 1L) |
| enc.a2.dread | normal | 3.4 (3.0t, 70f, 0L) | 4.6 (3.2t, 88f, 3L) | 6.1 (3.2t, 49f, 1L) |
| enc.a2.fret | normal | 3.0 (3.0t, 248f, 0L) | 5.4 (3.3t, 226f, 1L) | 4.1 (3.2t, 158f, 0L) |
| enc.a1.echo | normal | 2.2 (2.0t, 109f, 0L) | 2.0 (2.2t, 83f, 0L) | 3.3 (2.6t, 79f, 0L) |
| enc.mem.echo | event | 1.9 (2.0t, 25f, 0L) | 1.6 (2.0t, 40f, 0L) | 3.0 (2.6t, 33f, 0L) |

### aware by Charm

| Group | Runs | Win % [95% CI] |
| --- | --- | --- |
| ks.brave_pebble | 64 | 60.9% [48.7%, 71.9%] |
| ks.sun_charm | 78 | 53.8% [42.9%, 64.5%] |
| ks.warm_locket | 81 | 75.3% [64.9%, 83.4%] |
| ks.woven_bracelet | 77 | 66.2% [55.1%, 75.8%] |

### aware by dominant deck Light (most common Light among ease cards at the end of the run)

| Group | Runs | Win % [95% CI] |
| --- | --- | --- |
| courage | 62 | 67.7% [55.4%, 78.0%] |
| friendship | 106 | 67.9% [58.5%, 76.0%] |
| hope | 1 | 100.0% [20.7%, 100.0%] |
| joy | 58 | 50.0% [37.5%, 62.5%] |
| love | 73 | 67.1% [55.7%, 76.8%] |

## Engine issues found by the runs

No engine errors, invariant violations or softlocks.
