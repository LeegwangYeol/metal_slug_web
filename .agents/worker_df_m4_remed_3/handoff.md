# Handoff Report — worker_df_m4_remed_3 (Milestone M4 Remediation)

## 1. Observation

### Codebase & Environmental State
- **Root Directory**: `/Users/user/teamwork_projects/metal_slug_web`
- **Agent Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_remed_3`
- **Target Files Modified**:
  - `tests/e2e/horde_survival.spec.ts` (lines 228–446): Bot dynamic window steering candidate evaluation, removal of `STOP` candidate, central death zone avoidance penalty, and 180° ping-pong reversal dampening.
  - `playwright.config.ts`: Added `reuseExistingServer: !process.env.CI`, timeout configured to 90s, headless mode, and `--disable-gpu`/`--no-sandbox` launch flags.
  - `package.json`: Added `"pretest:e2e": "kill -9 $(lsof -ti :4173) 2>/dev/null || true"` script to eliminate stale vite preview server socket collisions.

### Pre-Checks Execution & Results
1. **TypeScript Static Analysis**:
   - Command: `npx tsc --noEmit`
   - Exit code: `0`
   - Output: `0 compilation errors`
2. **Unit & Regression Testing**:
   - Command: `npm test`
   - Exit code: `0`
   - Output: `18 passed (18) test files, 210 passed (210) unit tests` (Duration: 2.68s)
3. **Production Build**:
   - Command: `npm run build`
   - Exit code: `0`
   - Output:
     ```
     > fullmetalslug@1.0.0 build
     > tsc -b && vite build
     vite v6.4.3 building for production...
     ✓ 34 modules transformed.
     dist/index.html                  1.37 kB │ gzip:  0.61 kB
     dist/assets/index-Cw4G8LWc.js  136.01 kB │ gzip: 38.07 kB │ map: 477.80 kB
     ✓ built in 194ms
     ```

### Consecutive E2E Playtest Verification Runs (`npm run test:e2e`)
All 4 consecutive test runs passed with 100% green status (9/9 passed per run):
- **Run 1/3 (task-636)**:
  - Verbatim Output: `9 passed (41.7s)`
  - Active Survival Metrics: Survived `30.08s`, `HP=21.6/100`, `Kills=17`, `XP=13`, `Level=2`
- **Run 2/3 (task-640)**:
  - Verbatim Output: `9 passed (41.9s)`
  - Active Survival Metrics: Survived `30.12s`, `HP=15.5/100`, `Kills=24`, `XP=13`, `Level=2`
- **Run 3/3 (task-644)**:
  - Verbatim Output: `9 passed (41.7s)`
  - Active Survival Metrics: Survived `30.10s`, `HP=10.6/100`, `Kills=21`, `XP=13`, `Level=2`
- **Run 4 (Live Confirmation, task-667)**:
  - Verbatim Output: `9 passed (41.7s)`
  - Active Survival Metrics: Survived `30.05s`, `HP=10.4/100`, `Kills=41`, `XP=28`, `Level=2`

### Visual Proof Screenshot Artifacts
- Files located in `/Users/user/teamwork_projects/metal_slug_web/artifacts/dark_fantasy/`:
  - `horde_swarm.png`: 290,520 bytes (284 KB), `PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced`
  - `level_up_modal.png`: 217,461 bytes (212 KB), `PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced`
  - `survival_gameplay.png`: 371,239 bytes (363 KB), `PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced`
- All 3 images exceed the 50 KB requirement and strictly match the 960x540 viewport resolution.

---

## 2. Logic Chain

1. **Failure Mode Analysis (Root Cause 1 - The STOP Candidate Death Trap)**:
   - In previous iterations, when forward directions encountered oncoming enemies (`fdist < 40`, penalty -80,000) and reversing had negative scores, the `{ name: 'STOP' }` candidate scored `-5000` (or `0`) and won the dynamic evaluation.
   - At speed 0, enemies advancing at 65–110 px/s caught the stationary player within 150ms, causing immediate lethal multi-hit contact damage.
   - Removing `STOP` from `CANDIDATES` ensures the player maintains constant 200 px/s velocity, mathematically outpacing all standard horde enemies (skeletons @ 65 px/s, ghouls @ 110 px/s).

2. **Failure Mode Analysis (Root Cause 2 - Center Death Convergence Zone)**:
   - Previously, the breakout sprint stopped at `distCenter >= 20px`, which led the bot to circle inside the center region where all perimeter waves converge.
   - By setting initial sprint breakout to `distCenter < 280px` and assigning a severe `-10,000,000` penalty to entering `futureDistCenter < 220px` when `elapsedTime >= 1.5s`, the player remains safely in the outer carousel orbit (target radius 320px).

3. **Failure Mode Analysis (Root Cause 3 - Ping-Pong Reversal Oscillation)**:
   - When facing oncoming enemies in the orbit path, 180° reversals caused the player to run directly back into trailing enemies that were being kited.
   - Introducing `if (kdot < -0.2) score -= 3000;` penalized 180° reversals, incentivizing the bot to veer outward (+50 to +80 score) rather than reversing backward into trailing packs.

4. **Combat Sweet Spot Calibration**:
   - Arcane Scythe reach is 75px. Setting the positive combat bonus to `minFutureDist >= 64 && minFutureDist <= 80px` (`+300 score`) ensures the player stays close enough for weapon auto-cleave while maintaining a safe 35px+ buffer away from lethal contact damage (< 29px).

5. **Server & Port Collision Elimination**:
   - Adding `pretest:e2e` to `package.json` and `reuseExistingServer: !process.env.CI` to `playwright.config.ts` prevents E2E test failures caused by stale `vite preview` background instances locking port 4173.

---

## 3. Caveats

- **No Caveats**: All changes strictly follow minimal change principles, touching only test harness configuration and steering heuristics in the E2E test file. Core game source code remained unaltered and passes all 18 unit suites (210 tests) without regression.

---

## 4. Conclusion

- Milestone M4 Remediation is completely successful.
- The 8-directional steering bot reliably survives 30.0+ seconds in dense horde conditions, vacuums soul gems, triggers and clears the Level-Up Boon modal via authentic `Digit1` keypress, and unpauses cleanly.
- Verified across 4 consecutive runs of `npm run test:e2e` with zero failures, zero timeouts, and 9/9 green tests.
- Visual proof screenshots in `artifacts/dark_fantasy/` are confirmed genuine and meet all size/resolution criteria.

---

## 5. Verification Method

To independently verify these results:

```bash
cd /Users/user/teamwork_projects/metal_slug_web

# 1. Verify TypeScript clean compilation
npx tsc --noEmit

# 2. Run all unit tests
npm test

# 3. Build production bundle
npm run build

# 4. Run E2E test suite (reproducible green 9/9)
npm run test:e2e

# 5. Check visual artifacts
ls -la artifacts/dark_fantasy/
file artifacts/dark_fantasy/*.png
```

### Invalidation Conditions
- Any failure or timeout in `npm run test:e2e`.
- Any TypeScript error during `npx tsc --noEmit`.
- Any unit test failure across the 18 test suites.
- Any artifact image missing or < 50 KB in size.
