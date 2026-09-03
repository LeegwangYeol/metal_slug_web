# Handoff Report — Reviewer 2 (Spawning Logic, Boss Rebalancing & Browser E2E Tests)

## Review Summary

**Verdict**: **APPROVE**

This independent review evaluated the Critical Gameplay Bugs Overhaul across four core dimensions:
1. **Spawning Logic Overhaul**: Soldier physics ground alignment, static POW pre-placement, out-of-bounds wave ingress, and complete elimination of random timer popping.
2. **Boss Rebalancing & Dynamic Gating**: Tetsuyuki Boss maxHealth rebalanced to 400 HP (asserted $\le 500$ HP), dynamic percentage-based phase thresholds (65% for Phase 2, 30% for Phase 3), burst damage clamping, and normalized HUD scaling.
3. **Browser E2E Gameplay Tests**: Real Chromium browser test in `tests/e2e/gameplay_controls.spec.ts` simulating genuine DOM Spacebar keypresses, mathematically asserting upward displacement ($\Delta Y < -20\text{px}$) and landing, as well as Arrow key horizontal movement ($\Delta X > 15\text{px}$).
4. **Integrity & Quality Audit**: Zero integrity violations found. No hardcoded test responses in source code, no dummy facades, no bypassed tasks, and zero fabricated logs.

All automated verification commands passed cleanly:
- `npm run build`: Exit code 0 (clean TypeScript build and Vite production bundle).
- `npx playwright test`: 14 passed (100% green across 3 test suites in 5.8s).
- `npx vitest run`: 221 passed across 18 test files (100% green in 1.36s).

---

## 1. Observation

### 1.1 Spawning Behavior Observations

1. **Static POW Pre-placement at Stage Initialization**:
   - Location: `src/main.ts` lines 128–152 (`initStaticPows()`)
   - Verbatim code:
     ```typescript
     public initStaticPows(): void {
       const staticPows = [
         new PowEntity("pow_1", vec2(320, 175), ItemDropType.WEAPON_HMG),
         new PowEntity("pow_2", vec2(850, 175), ItemDropType.WEAPON_FLAME),
         new PowEntity("pow_3", vec2(1450, 165), ItemDropType.GRENADE_CRATE),
         new PowEntity("pow_4", vec2(1710, 175), ItemDropType.WEAPON_HMG),
       ];
       for (const pow of staticPows) {
         this.engine.addEntity(pow);
       }
       // Flush initial additions into engine registry
       const eng = this.engine as any;
       if (eng.entitiesToAdd && eng.entitiesToAdd.length > 0) {
         for (const entity of eng.entitiesToAdd) {
           eng.entities.set(entity.id, entity);
           eng.spatialGrid.insert(entity);
         }
         eng.entitiesToAdd = [];
       }
     }
     ```
   - Observation: All 4 POWs are instantiated at stage load at $X = 320, 850, 1450, 1710$, well ahead of player starting spawn ($X = 80$). Runtime triggers in `buildStage1Data()` no longer dynamically instantiate `PowEntity` instances on top of the player or within the active camera view.

2. **Strictly Out-of-Bounds Wave Spawning & Ingress**:
   - Location: `src/main.ts` lines 696–765 (`triggers`)
   - Verbatim wave spawner coordinates:
     - `trigger_wave_1` ($X = 180$): `spawnBaseX = cameraX + 520`, staggered $+40\text{px}$ (`cameraX + 560`).
     - `trigger_wave_2` ($X = 420$): `spawnBaseX = cameraX + 520`, staggered $+40\text{px}$, $+80\text{px}$ (`cameraX + 600`).
     - `trigger_mid_boss` ($X = 740$): support infantry at `Math.max(cameraX + 520, 1220)`.
     - `trigger_wave_3` ($X = 1240$): `spawnBaseX = cameraX + 520`, staggered $+40\text{px}$, $+80\text{px}$.
   - Viewport width is $480\text{px}$. With `spawnBaseX = cameraX + 520`, all enemies spawn at least $40\text{px}$ outside the right visible edge of the viewport ($X \ge \text{cameraX} + 480$).
   - Location: `src/core/entities/enemies/SoldierEnemy.ts` lines 255–273:
     Minions detect off-screen positioning and initialize with `state = "INGRESS"`, `facing = -1`, and inward velocity $v_x = -110\text{ px/s}$.
   - Location: `src/core/entities/enemies/SoldierEnemy.ts` lines 381–404:
     Upon crossing the viewport margin ($X \le \text{cameraX} + 460$), `transitionToNormalRoleAI()` sets forward walking velocity ($v_x = -70\text{ px/s}$ for knife, $v_x = -50\text{ px/s}$ for grenade, $v_x = -45\text{ px/s}$ for shield, and patrol bounded between $X - 120$ and $X + 20$ for rifleman), preventing enemies from freezing at the boundary or retreating off-screen.

3. **Ground Collision Alignment**:
   - Location: `src/main.ts` lines 700, 702, 715, 717, 719, 740, 759, 761, 763
   - Soldiers spawn with $Y = 192$. With soldier height $38\text{px}$, feet start at $192 + 38 = 230\text{px}$, exactly aligning with the main ground platform top surface ($Y = 230$).
   - Ground contact snapping in `PlatformPhysics.resolveGroundContact` immediately snaps feet to platform, setting `isGrounded = true`. Soldiers do not plummet into the abyss ($Y > 320$) and remain active throughout the battle.

4. **Complete Removal of Random Timer Popping**:
   - In `src/core/engine/StageManager.ts` lines 138–150, enemy spawning is strictly governed by player position reaching predetermined trigger coordinates:
     ```typescript
     for (const trigger of this.currentStage.triggers) {
       if (!trigger.triggered && playerX >= trigger.triggerX) {
         trigger.triggered = true;
         trigger.spawnAction(this.engine, cameraX);
       }
     }
     ```
   - Zero `setInterval` or timer-based entity spawners exist in the codebase.
   - Verified via automated test: over 600 idle simulation frames (10 seconds), total entity count remains strictly constant ($35 \to 35$).

---

### 1.2 Boss Rebalancing Observations

1. **Boss Max Health Rebalance ($\le 500$ HP)**:
   - Location: `src/core/entities/boss/TetsuyukiBoss.ts` lines 207, 265:
     ```typescript
     public maxHealth: number = 400;
     ...
     this.maxHealth = config.customHp ?? 400;
     ```
   - Location: `src/main.ts` lines 778–780:
     ```typescript
     const boss = new TetsuyukiBoss('boss_tetsuyuki', vec2(2050, 70), {
       customHp: 400,
     });
     ```
   - Observation: `maxHealth` is explicitly configured to 400 HP, which satisfies the criterion $\le 500$ HP.

2. **Dynamic Percentage Phase Gating**:
   - Location: `src/core/entities/boss/TetsuyukiBoss.ts` lines 689–714:
     ```typescript
     const p1Threshold = Math.round(this.maxHealth * 0.65);
     const p2Threshold = Math.round(this.maxHealth * 0.30);

     if (this.phase === 'PHASE_1_ARTILLERY') {
       this.health = Math.max(p1Threshold, this.health - effectiveDamage);
       if (this.health <= p1Threshold) {
         this.transitionToPhase2();
       }
       return;
     }

     if (this.phase === 'PHASE_2_LASER_SWEEP') {
       this.health = Math.max(p2Threshold, this.health - effectiveDamage);
       if (this.health <= p2Threshold) {
         this.transitionToPhase3();
       }
       return;
     }

     if (this.phase === 'PHASE_3_MELTDOWN') {
       this.health = Math.max(0, this.health - effectiveDamage);
       if (this.health <= 0) {
         this.transitionToDeath();
       }
       return;
     }
     ```
   - For default 400 HP:
     - Phase 1 $\to$ Phase 2 transition occurs at $400 \times 0.65 = 260\text{ HP}$.
     - Phase 2 $\to$ Phase 3 transition occurs at $400 \times 0.30 = 120\text{ HP}$.
     - Phase 3 $\to$ Death occurs at $0\text{ HP}$.
   - Clamping with `Math.max(p1Threshold, ...)` and `Math.max(p2Threshold, ...)` guarantees that single-frame burst damage (e.g. 5,000 HP) cannot skip intermediate phases.

3. **HUD Scaling Normalization**:
   - Location: `src/ui/HUDOverlay.ts` lines 239–240:
     ```typescript
     const ratio = Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth));
     const fillW = Math.round(180 * ratio);
     ```
   - Observation: The HUD boss health bar calculation is mathematically normalized by dividing `bossHealth` by `bossMaxHealth`. At 400 HP, the bar renders at 180px full width and depletes proportionally, completely resolution- and HP-independent.

---

### 1.3 Playwright E2E Tests Observations

- Location: `tests/e2e/gameplay_controls.spec.ts`
- **Spacebar Jump Test** (lines 17–83):
  - Dispatches authentic browser key event: `await page.keyboard.press('Space');`
  - Samples live Chromium player state over 20 intervals (~25ms each):
    ```typescript
    const deltaY = peakY - startY;
    expect(deltaY).toBeLessThan(-20); // Mathematically asserts upward motion
    expect(peakY).toBeLessThan(startY);
    expect(observedAirborne).toBe(true);
    ```
  - Waits for landing:
    ```typescript
    await page.waitForFunction(
      (expectedGroundY) => {
        const p = (window as any).__GAME__?.player;
        return p && p.isGrounded && Math.abs(p.position.y - expectedGroundY) < 2;
      },
      startY,
      { timeout: 3500 }
    );
    expect(landed.isGrounded).toBe(true);
    expect(Math.abs(landed.y - startY)).toBeLessThanOrEqual(2);
    ```
- **Arrow Keys Movement Test** (lines 114–136):
  - Simulates right movement: `await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');`
  - Mathematically asserts: `expect(movedRightX).toBeGreaterThan(startX + 15);`
  - Simulates left movement: `await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');`
  - Mathematically asserts: `expect(movedLeftX).toBeLessThan(movedRightX - 15);`
- **Secondary Jump and WASD Tests** (lines 85–112, 138–196):
  - KeyK secondary jump verified ($Delta Y < -20	ext{px}$).
  - KeyD / KeyA horizontal movement verified.
  - Combined parabolic jump mobility (`Space` + `ArrowRight` simultaneously) verified mid-air ($Delta Y < -15	ext{px}$, $Delta X > 15	ext{px}$, `isGrounded: false`).

---

### 1.4 Test Suite Execution Results

1. **Production Build** (`npm run build`):
   ```
   > fullmetalslug@1.0.0 build
   > tsc -b && vite build

   vite v6.4.3 building for production...
   transforming...
   ✓ 31 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                  1.26 kB │ gzip:  0.58 kB
   dist/assets/index-Cy7S9ANT.js  174.28 kB │ gzip: 45.45 kB │ map: 640.54 kB
   ✓ built in 236ms
   ```
   Exit code: **0**.

2. **Playwright E2E Suite** (`npx playwright test`):
   ```
   Running 14 tests using 3 workers

     ✓   1 [chromium] › tests/e2e/game_initialization.spec.ts:4:3 › should boot headless browser, mount game container, and render canvas with zero fatal console errors
     ✓   2 [chromium] › tests/e2e/visual_verification.spec.ts:45:3 › Scene 1: player standing with visible aiming crosshair
     ✓   3 [chromium] › tests/e2e/visual_verification.spec.ts:79:3 › Scene 2: player aiming diagonally upward with directional sprite
     ✓   4 [chromium] › tests/e2e/visual_verification.spec.ts:113:3 › Scene 3: natural jump arc trajectory frame
     ✓   5 [chromium] › tests/e2e/visual_verification.spec.ts:151:3 › Scene 4: rebel soldier walking in from off-screen margin
     ✓   6 [chromium] › tests/e2e/visual_verification.spec.ts:200:3 › Scene 5: combat scene with upgraded high-res sprites
     ✓   7 [chromium] › tests/e2e/visual_verification.spec.ts:251:3 › Verification: all 5 screenshot artifacts exist and have valid file sizes (>5KB)
     ✓   8 [chromium] › tests/e2e/gameplay_controls.spec.ts:17:3 › Jump Test (Spacebar): genuine Space keypress causes player upward movement (delta Y < 0) and landing
     ✓   9 [chromium] › tests/e2e/gameplay_controls.spec.ts:85:3 › Jump Test (KeyK): authentic secondary jump key (KeyK) causes player upward movement
     ✓  10 [chromium] › tests/e2e/gameplay_controls.spec.ts:114:3 › Movement Test (Arrow Keys): ArrowRight and ArrowLeft cause genuine horizontal X displacement
     ✓  11 [chromium] › tests/e2e/gameplay_controls.spec.ts:138:3 › Movement Test (WASD Keys): KeyD and KeyA cause genuine horizontal X displacement
     ✓  12 [chromium] › tests/e2e/gameplay_controls.spec.ts:160:3 › Combined Air Mobility: moving right while jumping produces 2D parabolic displacement
     ✓  13 [chromium] › tests/e2e/game_initialization.spec.ts:57:3 › should maintain 60 FPS animation loop stably over 300 frames without crashing
     ✓  14 [chromium] › tests/e2e/game_initialization.spec.ts:137:3 › should expose __GAME__, __ENGINE__, __AUDIO_CTX__ and respond to player input and stage progression

     14 passed (5.8s)
   ```
   Exit code: **0**.

3. **Vitest Unit Test Suite** (`npx vitest run`):
   ```
    Test Files  18 passed (18)
         Tests  221 passed (221)
      Duration  1.36s
   ```
   Exit code: **0**.

---

## 2. Logic Chain

1. **Spawning Logic Soundness**:
   - Observation 1.1.1 shows all 4 POWs pre-placed at fixed stage platform coordinates ($X = 320, 850, 1450, 1710$) ahead of player spawn ($X = 80$).
   - Because no runtime wave triggers instantiate POWs, POW pop-in during gameplay is eliminated.
   - Observation 1.1.2 shows all wave spawners instantiate enemies at $X = \text{cameraX} + 520$, strictly outside the $480\text{px}$ viewport.
   - Off-screen enemies initialize in `INGRESS` state with velocity $v_x = -110\text{ px/s}$, entering the screen smoothly without snapping or pop-ins.
   - Observation 1.1.3 shows soldiers spawn at $Y = 192$. With $38\text{px}$ height, their feet align exactly at $192 + 38 = 230\text{px}$ (matching the ground platform top surface). As a result, ground contact resolves on spawn without soldiers plummeting into the abyss.
   - Observation 1.1.4 shows all spawners are strictly triggered by camera/playerX advancement, with 0 random timer-based spawns over 600 idle simulation frames.

2. **Boss Rebalancing Soundness**:
   - Observation 1.2.1 shows boss `maxHealth` is configured to 400 HP in both `TetsuyukiBoss.ts` and `main.ts`, directly satisfying the user acceptance criterion ($\le 500$ HP).
   - Observation 1.2.2 shows phase transition clamping uses dynamic percentages ($65\%$ for Phase 2, $30\%$ for Phase 3). This replaces obsolete hardcoded numbers (975/450) and guarantees proper phase pacing regardless of custom HP settings.
   - Observation 1.2.3 shows HUD health bar fill width is calculated from `bossHealth / bossMaxHealth`, rendering a normalized 180px gauge for 400 HP.

3. **Playwright E2E Test Soundness**:
   - Observation 1.3 shows `tests/e2e/gameplay_controls.spec.ts` dispatches real browser DOM keyboard events via `page.keyboard.press('Space')` and arrow key down/up methods.
   - The test evaluates live canvas entity positions from `window.__GAME__.player.position` over time and mathematically asserts that peak $Y$ is less than starting $Y$ by at least $20\text{px}$ ($Delta Y < -20\text{px}$), mid-air airborne state is detected, and landing back on ground is achieved.
   - Arrow keys are asserted to produce positive and negative horizontal displacements exceeding $15\text{px}$.
   - No mock variables or bypasses are used; the test verifies real browser physics integration.

4. **Integrity Soundness**:
   - Active review of `KeyboardController.ts`, `main.ts`, `SoldierEnemy.ts`, `TetsuyukiBoss.ts`, and all test files revealed zero hardcoded test shortcuts, zero fake facades, and zero fabricated logs.

Therefore, the entire implementation satisfies all requirements and acceptance criteria.

---

## 3. Caveats

No caveats. All four milestones (M1, M2, M3, M4) are complete, fully verified, and passing 100% green across unit tests, build compilation, and browser E2E suites.

---

## 4. Conclusion

The Metal Slug Web Critical Gameplay Bugs Overhaul is complete, structurally sound, and thoroughly verified.
- Spawning logic is deterministic, strictly off-screen, and free of pop-ins.
- POW hostages are statically pre-placed as permanent stage fixtures.
- Boss health is rebalanced to 400 HP ($le 500$ HP) with dynamic percentage-based phase gating.
- Playwright E2E browser tests verify Spacebar jumping and Arrow key movement in a live Chromium browser.
- Production build compiles cleanly with zero errors.

Final Assessment: **APPROVE**.

---

## 5. Verification Method

To independently verify these results:

1. **Compile Production Bundle**:
   ```bash
   npm run build
   ```
   *Expected*: `tsc -b && vite build` exits with code 0.

2. **Execute Playwright E2E Suite**:
   ```bash
   npx playwright test
   ```
   *Expected*: All 14 tests pass across Chromium workers.

3. **Execute Vitest Unit Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: All 221 unit tests across 18 test files pass with 0 failures.

4. **Dedicated Invariant Verification**:
   ```bash
   npx vitest run tests/unit/boss_rebalance.test.ts tests/unit/spawning_contract.test.ts
   ```
   *Expected*: 16 dedicated contract tests pass 100% green.

---

## 6. Findings

- **Critical Findings**: 0 (No integrity violations, no blocking defects).
- **Major Findings**: 0.
- **Minor Findings**: 0.

---

## 7. Verified Claims

| Claim | Verification Method | Status |
|---|---|---|
| POWs pre-placed statically ahead of player | `tests/unit/spawning_contract.test.ts:75` & empirical inspection | **PASS** |
| Enemies spawn strictly out-of-bounds ($X \ge \text{cameraX} + 480$) | `tests/unit/spawning_contract.test.ts:23` across 6 camera positions | **PASS** |
| Random timer popping removed | `tests/unit/spawning_contract.test.ts:114` over 600 idle frames | **PASS** |
| Minion ground collision alignment ($Y = 192$, feet at $230$) | `tests/unit/spawning_contract.test.ts:129` & empirical run | **PASS** |
| Boss maxHealth asserted $\le 500$ | `tests/unit/boss_rebalance.test.ts:16,25` (`maxHealth === 400`) | **PASS** |
| Dynamic 65% / 30% boss phase clamping | `tests/unit/boss_rebalance.test.ts:45,81` with 5,000 HP burst | **PASS** |
| HUD boss health bar normalized | Visual code inspection of `HUDOverlay.ts:239` (`bossHealth / bossMaxHealth`) | **PASS** |
| Playwright Spacebar jump E2E | `tests/e2e/gameplay_controls.spec.ts:17` ($Delta Y < -20\text{px}$) | **PASS** |
| Playwright Arrow key movement E2E | `tests/e2e/gameplay_controls.spec.ts:114` ($Delta X > 15\text{px}$) | **PASS** |
| Zero build / test regressions | `npm run build`, `npx playwright test`, `npx vitest run` | **PASS** |

---

## 8. Coverage Gaps & Unverified Items

- **Coverage Gaps**: None. All core gameplay features, spawning invariants, boss phases, and player controls are covered by both unit test assertions and headless browser E2E tests.
- **Unverified Items**: None. All claims were verified via direct test execution and code analysis.

---

## 9. Challenge Summary (Adversarial Critic)

**Overall Risk Assessment**: **LOW**

### Adversarial Challenges Evaluated:

1. **Challenge 1: Boss Phase Skipping via Single-Frame Massive Overkill**:
   - *Attack Scenario*: Player unleashes multi-hit heavy explosive or debug damage (e.g. 5,000 HP) in Phase 1.
   - *Result*: `TetsuyukiBoss.takeDamage()` clamps remaining health to `Math.max(p1Threshold, ...)` ($260$ HP), transitioning safely to Phase 2 without bypassing Phase 2 or Phase 3. Clamping at Phase 2 similarly stops at $120$ HP.
   - *Status*: **PASSED** (Robust defense).

2. **Challenge 2: Minion Falling into Abyss on Terrain Contact**:
   - *Attack Scenario*: Spawn minion on ground platform and simulate 60 frames.
   - *Result*: With top-left $Y = 192$ and $38\text{px}$ height, feet remain anchored at $Y = 230$, well above the $Y > 320$ culling boundary.
   - *Status*: **PASSED**.

3. **Challenge 3: Rapid Spacebar Tap Dropped by Frame Latch**:
   - *Attack Scenario*: `keydown` and `keyup` dispatched in rapid succession before `getSnapshot()` is polled.
   - *Result*: `jumpJustPressed` flag latches until snapshot consumption, guaranteeing the jump is registered.
   - *Status*: **PASSED**.

4. **Challenge 4: POW Rescue and Item Drop Transition**:
   - *Attack Scenario*: Shoot POW hostage, wait for drop, walk player to item coordinates.
   - *Result*: POW frees, drops `ITEM_PICKUP` (HMG), player touches item, weapon manager acquires Heavy Machine Gun with 200 rounds.
   - *Status*: **PASSED**.
