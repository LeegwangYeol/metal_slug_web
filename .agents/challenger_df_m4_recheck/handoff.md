# Milestone M4 Re-Check Empirical Challenger Report — challenger_df_m4_recheck

**Author**: `challenger_df_m4_recheck` (Empirical Challenger / Critic)  
**Target Milestone**: M4 Re-Check (Automated E2E Playtesting & Hardening)  
**Date**: 2026-09-10T14:06:40Z  
**Verdict**: ❌ **REQUEST_CHANGES** (Empirical Pass Rate: 0/3 Runs Passed — 100% Failure Rate on Test 1)

---

## 1. Observation

### 1.1 Playwright E2E Test Suite Execution (3 Consecutive Empirical Runs)
We executed `npx playwright test` across three consecutive independent runs without modifying any implementation code.

#### Run 1:
- Command: `npx playwright test`
- Exit Code: `1`
- Duration: `57.1s`
- Summary: `8 passed, 1 failed`
- Verbatim Failure:
```text
  1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors 

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 10
    Received:    9

      487 |     expect(finalReport.health).toBeGreaterThan(0);
      488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
          |                                 ^
      490 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
      491 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
      492 |     expect(finalReport.isPaused).toBe(false);
        at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:489:33
```
- Telemetry at loop exit:
`[E2E Survival] t=45.10s | HP=68.0 | Pos=(359.2, 213.0) | Kills=10 | XP=9 | Lvl=1`

#### Run 2:
- Command: `npx playwright test`
- Exit Code: `1`
- Duration: `56.9s`
- Summary: `8 passed, 1 failed`
- Verbatim Failure:
```text
  1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors 

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 10
    Received:    6

      487 |     expect(finalReport.health).toBeGreaterThan(0);
      488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
          |                                 ^
      490 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
      491 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
      492 |     expect(finalReport.isPaused).toBe(false);
        at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:489:33
```
- Telemetry at loop exit:
`[E2E Survival] t=45.10s | HP=68.0 | Pos=(309.5, -311.6) | Kills=10 | XP=6 | Lvl=1`

#### Run 3:
- Command: `npx playwright test`
- Exit Code: `1`
- Duration: `56.8s`
- Summary: `8 passed, 1 failed`
- Verbatim Failure:
```text
  1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors 

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 10
    Received:    5

      487 |     expect(finalReport.health).toBeGreaterThan(0);
      488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
          |                                 ^
      490 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
      491 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
      492 |     expect(finalReport.isPaused).toBe(false);
        at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:489:33
```
- Telemetry at loop exit:
`[E2E Survival] t=45.03s | HP=53.0 | Pos=(-310.8, 141.5) | Kills=5 | XP=5 | Lvl=1`

### 1.2 Inspection of Steering Algorithm in `tests/e2e/horde_survival.spec.ts`
1. In `tests/e2e/horde_survival.spec.ts:365-374`:
   ```ts
   // Severe multi-tier danger penalties preventing contact (lethal contact < 29px)
   if (fdist < 34) {
     score -= 1000000 * ((34 - fdist) / 34);
   } else if (fdist < 52) {
     score -= 200000 * ((52 - fdist) / 52);
   } else if (fdist < 72) {
     score -= 40000 * ((72 - fdist) / 72);
   } else if (fdist < 90) {
     score -= 5000 * ((90 - fdist) / 90);
   }
   ```
2. In `tests/e2e/horde_survival.spec.ts:421-428`:
   ```ts
   // E. Soul Gem / XP attraction (only when clearance is safe: minFutureDist >= 65)
   if (bestGemDist < 400 && minFutureDist >= 65) {
     const gdot = c.dx * gemDirX + c.dy * gemDirY;
     if (gdot > 0) {
       const priority = (p.level < 2 ? 1600 : 250) * bestGemVal;
       const distFactor = Math.max(0.25, 1 - bestGemDist / 400);
       score += gdot * priority * distFactor;
     }
   }
   ```
3. Arcane Scythe effective reach is 75px. Player speed is 200 px/s, enemy speed is 65 px/s. Magnet radius is 90px.
4. During all runs, the bot achieved 5–10 initial kills in the first 5–8 seconds, then fled outward to radius 380–450px.
5. For the remaining 35+ seconds of the 45-second simulation, `curMinD` remained locked at 110–135px, well outside the 75px reach of the Arcane Scythe.
6. Dropped gems near center (or near skeletons) had `minFutureDist < 65` or incurred danger penalties that completely overwhelmed the gem attraction score (+1600 vs -40,000 to -1,000,000). The bot permanently abandoned the gems and circled the perimeter, stalling at 5–9 XP until the 45s timeout forced test completion.

### 1.3 Inspection of Visual Proof Artifacts
We inspected the artifacts in `artifacts/dark_fantasy/`:
- `artifacts/dark_fantasy/horde_swarm.png`: 290,520 bytes (> 50KB). Verified valid 960x540 PNG.
- `artifacts/dark_fantasy/level_up_modal.png`: 217,461 bytes (> 50KB). Verified valid 960x540 PNG.
- `artifacts/dark_fantasy/survival_gameplay.png`: 371,275 bytes (> 50KB). Verified valid 960x540 PNG.
All 3 visual proof artifacts exist, are valid, and satisfy criteria.

### 1.4 Inspection of Unit Tests & Production Build
- `npm test`: 18 test files passed (210/210 unit tests green in 2.99s).
- `npm run build`: `tsc -b && vite build` bundled 34 modules in 195ms with 0 errors.
- Console Errors: 0 fatal console errors and 0 unhandled page errors across all runs.

---

## 2. Logic Chain

1. **Test 1 Specification & Requirements**:
   - `tests/e2e/horde_survival.spec.ts` Test 1 requires:
     - Player actively survives >= 30 seconds (`elapsedTime >= 30.0`, `isAlive === true`, `health > 0`).
     - Player collects at least 10 XP (`expect(finalReport.totalXP).toBeGreaterThanOrEqual(10)`).
     - Player reaches Level 2 (`expect(finalReport.level).toBeGreaterThanOrEqual(2)`).
     - Level-Up Modal opens, pauses simulation, and player selects upgrade card via keypress `Digit1` (`expect(modalSelectedCount).toBeGreaterThanOrEqual(1)`).
     - Simulation resumes cleanly with `isPaused === false`.

2. **Empirical Failure Verification**:
   - Across 3 consecutive runs (Run 1, Run 2, Run 3), the test failed 3 out of 3 times on line 489:
     - Run 1: TotalXP = 9 (< 10), Level = 1 (< 2), Modal selections = 0 (< 1).
     - Run 2: TotalXP = 6 (< 10), Level = 1 (< 2), Modal selections = 0 (< 1).
     - Run 3: TotalXP = 5 (< 10), Level = 1 (< 2), Modal selections = 0 (< 1).

3. **Root Cause Analysis (Combat Distance Starvation & Gem Abandonment)**:
   - Skeletons deal contact damage only when distance is `< 29px` (`Player.COLLISION_RADIUS(14) + Enemy.radius(12) + 3px tolerance`).
   - However, the steering evaluator penalizes any future distance `< 90px` with up to -5,000 points, `< 72px` with up to -40,000 points, and `< 52px` with up to -200,000 points.
   - The player's only starter weapon, Arcane Scythe, has a reach of only 75px.
   - Because the danger penalty triggers at 90px, the steering algorithm drives the player away whenever an enemy approaches closer than 90px.
   - As observed in the telemetry logs, the bot stably settles at `curMinD = 110–135px`. At this distance, the Arcane Scythe cannot reach or cleave any skeletons.
   - Furthermore, the gem attraction bonus (+1600) is strictly gated on `minFutureDist >= 65px`. When a gem lies near oncoming enemies, moving toward the gem causes `minFutureDist < 65px` or triggers the -40,000 danger penalty, causing the bot to flee away from the gem.
   - Once the bot flees > 90px away from the dropped gems, they fall outside the player's 90px magnet radius and are abandoned.
   - Consequently, the player easily survives 45s without taking damage, but stalls at 5–9 XP and 5–10 kills, never reaching 10 XP, never triggering Level 2, and never interacting with the Upgrade Modal.

---

## 3. Caveats

- **Visual Proof & Unit Suites**: The 3 visual proof screenshot tests, visual audit, zero-lag benchmark, and all 210 unit tests are completely sound and 100% green.
- **Engine Stability**: There are zero engine freezes, zero console errors, zero page errors, and zero GPU crashes. The engine itself is solid.
- **Scope of Defect**: The defect is strictly confined to the automated playtest steering weights and gem collection logic in `tests/e2e/horde_survival.spec.ts`.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The M4 Remediation does NOT pass the acceptance criteria:
- **Required**: 100% pass rate across at least 3 consecutive runs of `npx playwright test` (9/9 passed, 0 failures).
- **Actual**: 0% pass rate across 3 consecutive runs (8 passed, 1 failed in every run).
- Test 1 ("Playable Horde Loop") systematically fails because the bot suffers from Combat Distance Starvation and Gem Abandonment, failing to reach 10 XP, failing to reach Level 2, and failing to trigger/select an upgrade card from the Upgrade Modal.

### Actionable Remediation Guidance for Worker:
In `tests/e2e/horde_survival.spec.ts`:
1. **Relax Contact Danger Margins to Match Combat Reach**:
   - Contact damage only occurs at `< 29px`. Penalizing `< 90px` and `< 72px` prevents the 75px Arcane Scythe from cleaving enemies.
   - Adjust danger tiers: e.g. reserve heavy penalties (-40,000 to -1,000,000) for `fdist < 36px` to `42px`. Allow safe clearance in the 55–75px band so skeletons can enter the scythe's 75px cleave arc.
2. **Prioritize Early Gem Sweeping When Level 1**:
   - While `p.level < 2`, when skeletons are slain, ensure the bot does not instantly sprint 200 px/s away. Skeletons die at ~65–75px; because magnet radius is 90px, maintaining proximity or executing a brief circle/sweep will vacuum the gems instantly.
   - Ensure gem attraction is not completely disabled when clearance is between 45px and 65px.
3. **Verify 3 Consecutive Runs**:
   - Verify that all 3 runs achieve Level >= 2, trigger the modal, select Boon 1 via 'Digit1', unpause, and complete with `totalXP >= 10` and `level >= 2`.

---

## 5. Verification Method

To independently reproduce this finding:
```bash
# Run 1
npx playwright test
# Expected failure on Test 1 (Playable Horde Loop: expect(totalXP).toBeGreaterThanOrEqual(10), received 5–9)

# Run 2
npx playwright test

# Run 3
npx playwright test
```
*Invalidation Condition*: If `npx playwright test` is run 3 consecutive times and passes 9/9 green (0 failures, with Test 1 confirming player survives >= 30.5s, reaches Level 2, pauses for Upgrade Modal, selects card via '1', and unpauses cleanly), this finding is resolved.
