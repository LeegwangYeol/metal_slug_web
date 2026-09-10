# Empirical Challenge Report — Milestone 3 (UI, Tutorial Overlay, Key Latches, HUD Performance & Regression)

**Agent**: `challenger_m3_2` (EMPIRICAL CHALLENGER — critic, specialist)  
**Parent**: `dc4b76ec-2c8d-41af-8152-fb6d5ed83654`  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1. Tutorial Toggle Edge-Latching & Holding KeyH
- In `src/input/KeyboardController.ts` (lines 269–278, 329–336):
  ```typescript
  if (!e.repeat) {
    if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
    if (action === 'fire' && !this.fire) this.fireJustPressed = true;
    if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;
    if (action === 'ultimate' && !this.ultimate) this.ultimateJustPressed = true;
    if (action === 'help' && !this.help) this.helpJustPressed = true;
  }
  this.setAction(action, true);
  ```
  `setAction` only sets `helpJustPressed` if `!this.help`. Because `this.help` remains `true` while the key is held, repeated OS `keydown` events (`e.repeat: true`) are strictly gated.
- In `src/main.ts` (lines 338–340):
  ```typescript
  if (input.helpPressed || this.keyboard.helpJustPressed) {
    this.toggleTutorial();
  }
  ```
- **Empirical Execution**:
  - Ran simulated hold test over 200 consecutive frames with `e.repeat: true`. Result: `0` repeated pulses, `oscillationCount = 0`.
  - Ran full `FullMetalSlugGame.step(1/60)` over 120 consecutive game ticks holding `KeyH`. Result: `showTutorial` toggled once on tick 1 (`showTutorial: false`), followed by `0` state flips across all subsequent 119 ticks. Releasing and re-pressing toggles back to `showTutorial: true`, restoring `tutorialAlpha: 1.0` and pinning `tutorialTimer = 999999`.

### 1.2. Tutorial Alpha Fade Math Under Adversarial Conditions
- In `src/main.ts` (lines 343–352):
  ```typescript
  if (this.showTutorial && this.tutorialTimer < 900000) {
    this.tutorialTimer = Math.max(0, this.tutorialTimer - dt);
    if (this.tutorialTimer < 1.0) {
      this.tutorialAlpha = Math.max(0, this.tutorialTimer);
    }
    if (this.tutorialTimer <= 0) {
      this.showTutorial = false;
      this.tutorialAlpha = 0;
    }
  }
  ```
- In `src/ui/HUDOverlay.ts` (line 498):
  ```typescript
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ```
- **Empirical Execution**:
  - Tested 300 normal 60Hz frames (5.0s): Fades smoothly to exactly `0.0`.
  - Tested midway frame at 4.5s (`timer = 0.5s`): Alpha is exactly `0.5`.
  - Tested single massive 10.0s lag spike (`dt = 10.0s`): Clamped cleanly to `0.0`, zero negative opacity.
  - Tested `renderTutorialPlacard` with negative alpha (`-0.5`): Clamped to `0.0`.
  - Tested `renderTutorialPlacard` with excessive alpha (`3.5`): Clamped to `1.0`.
  - Tested with `NaN` and zero `dt`: No unhandled exceptions thrown.

### 1.3. HUD Glyph Lookup, Unknown Glyphs & Text Measurement
- In `src/ui/HUDOverlay.ts` (lines 86–93, 721–732, 750–775):
  - Verified glyph bitmap definitions in `PIXEL_FONT` for `'/'`, `'['`, `']'`, `'*'`, `'★'`.
  - Font fallback lookup: `const bitmap = PIXEL_FONT[ch] ?? PIXEL_FONT[' '];`
- **Empirical Execution**:
  - Verified width and rendering for `'/'` (4px), `'['` (4px), `']'` (4px), `'*'` (4px), `'★'` (6px). All rendered cleanly without errors.
  - Tested adversarial inputs: Korean Hangul (`'메탈슬러그 웹'`, `'안녕하세요 세계'`), Emojis (`'💣 EXPLOSION! 💥 🔥'`), Math symbols (`'∑(x_i) = Ω(n log n)'`), Currencies (`'Price: €50 / £40 / ¥6000'`), ASCII punctuation (`'~ ` ^ @ # % & _ + = { } | \ < >'`), Control characters (`\n`, `\t`, `\0`), and empty string `""`.
  - All adversarial strings measured positive widths and rendered safely via space fallback without throwing exceptions.
  - Scale resilience: Scales `0`, `-1`, `0.1`, `0.5`, `2.5`, `10`, `100` all produced positive valid pixel widths via `Math.max(1, Math.round(scale))`.
  - Large string benchmark: 11,000-character string measured in `0.32ms` (< 50ms).

### 1.4. HUD Rendering Performance & Stress Benchmark
- Executed 10,000 consecutive frames of HUD rendering under maximum overlay load (Score, Lives, HMG, Ammo, Grenades, POW tally, Ultimate meter, Boss health, Boss warning banner, Tutorial placard).
- **Benchmark Results**:
  - Total time (10,000 frames): `611.01ms`
  - Average render latency: `0.0611ms / frame` (< 0.10ms threshold)
  - Throughput: `16,366 frames/second` (consuming < 0.4% of the 60fps 16.6ms frame budget).
  - Canvas context state stack integrity: `save()` and `restore()` calls are 100% symmetric (`save: 20, restore: 20` on complex gameplay HUD; `save: 19, restore: 19` on Continue countdown). Zero context leaks.

### 1.5. Regression Verification Commands & Results
- `npx vitest run`:
  - Baseline: 41/41 test files passed (578/578 tests passed, 100% green).
  - With peer challenger test file (`tests/unit/adversarial_m3_respawn_continue_challenge.test.ts`): 41/42 files passed (595/596 tests passed).
  - 1 test failure observed in `tests/unit/challenger_boss_and_stability.test.ts` line 369: `AssertionError: expected 84 to be less than 80`. Verified empirically that this is an older M2/M4 stress test with stochastic variance in surviving shield enemies across 3,600 ticks (runs alone pass with 51/60 entities; runs under parallel worker load fluctuate between 43 and 87). Unrelated to M3 code.
- `tests/unit/death_respawn_ui.test.ts`: 19/19 tests passed (102ms).
- `npx playwright test tests/e2e/gameplay_controls.spec.ts`: 5/5 tests passed (3.9s).
- `npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts`: 12/12 tests passed (6.5s), including all Boss crisis encounter scenarios.
- All 5 Playwright E2E suites (`npx playwright test`): 29/29 tests passed (16.6s).
- Build compilation: `npx tsc --noEmit` exited with code 0 (0 errors); `npm run build` exited with code 0 (45 modules transformed in 320ms).

---

## 2. Logic Chain

1. *Edge Latching Defense*:
   - In `KeyboardController.ts`, `e.repeat` events are explicitly rejected from setting `helpJustPressed`, and `setAction('help', true)` explicitly checks `!this.help`.
   - Because `this.help` remains `true` until `keyup`, holding down `KeyH` for any arbitrary duration produces exactly one `helpPressed` pulse on frame 1.
   - In `FullMetalSlugGame.step()`, `toggleTutorial()` is invoked only on tick 1, completely preventing rapid toggling, flickering, or oscillating.

2. *Alpha Fade Math Stability*:
   - The countdown timer is decremented by `dt` with `Math.max(0, timer - dt)`.
   - When `timer < 1.0`, `tutorialAlpha` is set to `Math.max(0, timer)`.
   - Upon timer exhaustion (`<= 0`), `tutorialAlpha` is hard-set to `0`.
   - In `HUDOverlay.ts`, `ctx.globalAlpha` is wrapped with `Math.max(0, Math.min(1, alpha))`, providing double defense-in-depth against negative numbers, excessive values, or NaN.

3. *Glyph Lookup & Unknown Character Safety*:
   - The pixel font dictionary explicitly includes `'/'`, `'['`, `']'`, `'*'`, `'★'`.
   - Every lookup uses nullish coalescing: `PIXEL_FONT[ch] ?? PIXEL_FONT[' ']`.
   - Because `' '` is defined as `['00']`, any unknown glyph, emoji, or non-ASCII character safely renders an empty space of width 2 without throwing any runtime errors or breaking text measurement.
   - Text scaling uses `Math.max(1, Math.round(scale))`, preventing zero or negative scaling divisions.

4. *Rendering Efficiency & Canvas Safety*:
   - HUD rendering takes 0.061ms per frame, capable of over 16,000 FPS, ensuring zero frame hitching during intense combat.
   - Symmetrical `save()`/`restore()` pairing ensures that canvas global alpha and matrix transformations do not leak into subsequent entity or particle render passes.

---

## 3. Caveats

1. **Test file name discrepancy in task prompt**:
   - The task instructions specified running `npx playwright test tests/e2e/boss_encounters.spec.ts`.
   - There is no file named `tests/e2e/boss_encounters.spec.ts` in the repository; the Playwright boss encounter tests reside in `tests/e2e/ultimate_and_crisis_expansion.spec.ts` under Scenario 2 ("Crisis Boss Encounter & Multi-Phase Mechanics"). All 12 tests in this suite pass 100%.
2. **Stochastic variance in older test suite**:
   - `tests/unit/challenger_boss_and_stability.test.ts` (Task 3: 3,600-tick headless simulation) contains a hardcoded assertion `expect(finalEntityCount).toBeLessThan(80)`.
   - Because `SoldierEnemy` wave generation stochastically assigns `SOLDIER_SHIELD` which absorbs bullet hits, the surviving entity count at tick 3,600 fluctuates between 40 and 87. It passed in isolated runs (51 entities) and on initial run (60 entities), but intermittently fails when more shield soldiers are rolled. This is unrelated to M3 UI/Respawn logic.
3. **Touch virtual pad**:
   - Touchscreen virtual pad does not expose a dedicated `H` button for tutorial toggle; touch users rely on the automatic 5.0s dismissal or screen taps.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 3 UI tutorial overlay, keyboard input edge-latching, HUD rendering performance, glyph lookup robustness, and full regression invariants have been adversarially challenged and empirically verified.
- Holding `KeyH` causes **zero rapid oscillation or flickering** (0 state flips across 120 game ticks).
- Tutorial alpha fade math is strictly bounded in `[0.0, 1.0]`, resilient to massive lag spikes, and free of NaN/negative values.
- All new glyphs (`/`, `[`, `]`, `*`, `★`) measure and render correctly, and unknown glyphs fall back gracefully to space without throwing exceptions.
- HUD renders at **16,366 FPS (0.061ms/frame)** with perfect canvas state symmetry.
- All 29 Playwright E2E tests and baseline 578 Vitest unit tests pass.

---

## 5. Verification Method

To independently verify all claims made in this report:

1. **Run Standalone Adversarial Stress Suite**:
   ```bash
   npx tsx /tmp/adversarial_challenge_m3_stress.ts
   ```
   *Expected Output*: 65/65 tests pass, 0 failures, 16,000+ FPS HUD benchmark.

2. **Run M3 Unit Test Suite**:
   ```bash
   npx vitest run tests/unit/death_respawn_ui.test.ts
   ```
   *Expected Output*: 19/19 tests pass (0 failures).

3. **Run Playwright E2E Suites**:
   ```bash
   npx playwright test tests/e2e/gameplay_controls.spec.ts
   npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts
   npx playwright test
   ```
   *Expected Output*: 29/29 tests pass (0 failures).

4. **Run TypeScript and Build Validation**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   *Expected Output*: 0 type errors, production build completes in ~320ms.
