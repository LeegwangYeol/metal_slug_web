# Handoff Report: Challenger 2 — Adversarial Stress-Test & Empirical Verification

**Agent**: Challenger 2 (`challenger_2`)  
**Role**: critic, specialist (Empirical Challenger)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_2`  
**Target Scope**: Spawning Logic (`src/main.ts`, `SoldierEnemy.ts`, `StageManager.ts`) and Boss Health State Machine (`TetsuyukiBoss.ts`)  
**Date**: 2026-09-03T17:55:00+09:00  
**Explicit Verdict**: `APPROVE`  

---

## Challenge Summary

**Overall Risk Assessment**: **LOW**

The implementations by Worker 2 (Spawning Logic Overhaul), Worker 3 (Boss Health Rebalance), and Worker 4 (Test Suite Modernization) were adversarially challenged through an independent 15-test stress suite (`tests/unit/challenger_2_empirical_stress.test.ts`). All critical requirements have been empirically verified:
1. **Viewport Spawning Safety**: Across scrolling speeds from 132 px/s (1x run speed) up to 2,000 px/s (15x run speed), 100% of wave-spawned enemies appear strictly outside the active visible viewport ($X \ge \text{cameraX} + 480$).
2. **Terrain Integrity**: Soldiers spawned at $Y = 192$ (feet at $Y = 230$) maintain $Y = 192.0$ with `isGrounded = true` and $v_y = 0.0$ across 1,200 continuous physics ticks (20s @ 60Hz) with zero sinking or abyss falling.
3. **Zero Timer Popping**: Idle gameplay over 1,800 frames (30s) produces zero popped entities; all 4 POWs are statically pre-placed at stage load.
4. **Boss Burst Damage Clamping**: Massive 5,000 HP and 100,000 HP attacks clamp at 260 HP (Phase 2) and 120 HP (Phase 3), preventing multi-phase skips and premature deaths.
5. **Clean Lifecycle & Event Emission**: Transitions Phase 1 $\to$ Phase 2 $\to$ Phase 3 $\to$ Death $\to$ Destroyed fire exactly once, emitting single instances of `boss_destroyed` and `mission_complete`.

---

## 1. Observation

### 1.1 Spawning Invariants Under High Scrolling Speeds
- In `src/main.ts` (lines 698, 713, 739, 757):
  ```typescript
  const spawnBaseX = cameraX + 520;
  eng.addEntity(new SoldierEnemy('rebel_rifle_1', 'SOLDIER_RIFLE', vec2(spawnBaseX, 192), { cameraX }));
  ```
  Viewport width is 480 px. The spawn base formula provides an initial $40\text{ px}$ buffer beyond the right camera boundary:
  $$\text{spawnBaseX} - (\text{cameraX} + 480) = 40\text{ px}$$
- Empirical speed sweep across $[132, 264, 500, 1000, 1500, 2000, 2250, 2300, 2400, 3000]\text{ px/s}$:
  - Speeds $132$ to $2,250\text{ px/s}$: 0 spawned enemies inside viewport (100% PASS).
  - Speeds $> 2,290\text{ px/s}$ (e.g. $2,300\text{ px/s}$): In `FullMetalSlugGame.step()`, `this.stageManager.update(cameraX, playerX)` executes before `this.camera.update(playerX, ...)`. At $v > 2,290\text{ px/s}$ ($\Delta X > 38.17\text{ px/frame}$), the subsequent camera update catches up to the 40px buffer, causing sub-pixel intrusion ($0.17\text{px}$ at $2,300\text{ px/s}$). Because normal player run speed is $132\text{ px/s}$ ($\Delta X = 2.2\text{ px/frame}$), there is a massive $36\text{ px}$ safety margin on every tick in genuine gameplay.

### 1.2 Soldier Ground Physics & Abyss Falling Audit
- In `src/core/entities/enemies/SoldierEnemy.ts`:
  - Soldier dimensions: `width = 24, height = 38` (lines 166-167).
  - Spawn coordinate: $Y = 192$.
  - Foot anchor: $Y_{\text{foot}} = 192 + 38 = 230.0$.
  - Platform top surface in `src/main.ts`: $Y = 230.0$.
- Empirical testing over 1,200 continuous physics steps (20 seconds @ 60Hz) across all four roles (`SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`):
  - `soldier.position.y`: strictly $192.0$ on every tick.
  - `soldier.isGrounded`: strictly `true` on every tick.
  - `soldier.velocity.y`: strictly $0.0\text{ px/s}$ on every tick.
  - premature despawns / abyss falls: 0.

### 1.3 Spontaneous Popping & Static POW Audit
- Player idle simulation at starting position $(X = 80, Y = 192)$ for 1,800 frames (30 seconds @ 60Hz):
  - Initial entity count: 5 (`player`, `pow_1`, `pow_2`, `pow_3`, `pow_4`).
  - Intermediate entity count sampled every 300 frames (5s): strictly 5.
  - Final entity count: strictly 5.
  - Spontaneous pop-in count: 0.
- All 4 POWs are verified pre-placed at stage load time:
  - `pow_1`: $(320, 175)$
  - `pow_2`: $(850, 175)$
  - `pow_3`: $(1450, 165)$
  - `pow_4`: $(1710, 175)$
- Zero stage triggers dynamically instantiate `PowEntity` at runtime.

### 1.4 Boss Health Clamping & Phase Gating
- In `src/core/entities/boss/TetsuyukiBoss.ts` (lines 689-714):
  ```typescript
  const p1Threshold = Math.round(this.maxHealth * 0.65); // 260 HP
  const p2Threshold = Math.round(this.maxHealth * 0.30); // 120 HP

  if (this.phase === 'PHASE_1_ARTILLERY') {
    this.health = Math.max(p1Threshold, this.health - effectiveDamage);
    if (this.health <= p1Threshold) {
      this.transitionToPhase2();
    }
    return;
  }
  ```
- Empirical burst attacks tested:
  - Single hit of 5,000 damage on Phase 1: Clamped to 260 HP, entered `PHASE_2_LASER_SWEEP`. Did NOT skip to Phase 3 or Death.
  - Single hit of 5,000 damage on Phase 2: Clamped to 120 HP, entered `PHASE_3_MELTDOWN`. Did NOT skip to Death.
  - Single hit of 5,000 damage on Phase 3: Reduced by armor ($5000 \times 0.25 = 1250$), dropped to 0 HP, entered `DEATH_EXPLODING`.
  - Single hit of 100,000 damage against fresh boss: Clamped to 260 HP in Phase 2.
  - Post-mortem damage (10,000 HP) while in `DEATH_EXPLODING`: early return at line 675; health remained 0, no exception.

### 1.5 Boundary Inputs: Zero, Fractional, and Negative Damage
- Zero Damage (`takeDamage(0)`): Health remained invariant; zero phase transitions triggered across all phases.
- Fractional Damage ($0.1, 0.25, 0.333, \pi$):
  - 1,400 consecutive hits of 0.1 damage cleanly transitioned Phase 1 to Phase 2 at exactly 260.0 HP without numerical drift, NaN, or Infinity.
- Negative Damage (`takeDamage(-50)`):
  - In Phase 1, `this.health = Math.max(260, 400 - (-50)) = 450 HP`. Negative damage increases health but does not crash or corrupt the state machine.
  - In Phase 2, negative damage does not regress the boss back to Phase 1.
  - In death states (`DEATH_EXPLODING`, `DESTROYED`), early guard `if (!this.isAlive || this.phase === 'DEATH_EXPLODING' ...)` strictly rejects negative damage, preventing resurrection.

### 1.6 Transition Lifecycle & Event Sequence
- Complete death sequence simulation across 3.2 seconds (200 ticks @ 60Hz):
  - Ticks 0 - 48 (0.0s - 0.8s): Stage 1 (localized sparks).
  - Ticks 48 - 120 (0.8s - 2.0s): Stage 2 (fireballs + camera shake).
  - Ticks 120 - 192 (2.0s - 3.2s): Stage 3 (reactor detonation + shockwave).
  - Tick 193 (t >= 3.2s): Stage 4, `phase = 'DESTROYED'`, `isAlive = false`.
  - Event listener verified:
    - `boss_destroyed`: emitted exactly 1 time.
    - `mission_complete`: emitted exactly 1 time.
  - Over subsequent 300 ticks, dead boss remained destroyed with zero duplicate events.

---

## 2. Logic Chain

1. **Spawning Safety Validation (Observation 1.1 $\to$ Conclusion)**:
   The formula `spawnBaseX = cameraX + 520` guarantees that all wave enemies are placed $40\text{ px}$ to the right of the visible screen edge ($480\text{ px}$). Under normal gameplay, the player runs at $132\text{ px/s}$ ($2.2\text{ px/frame}$). The enemy advances left at $110\text{ px/s}$ ($1.83\text{ px/frame}$). Total relative closure is $4.03\text{ px/frame}$, requiring $\sim 10$ frames ($\sim 160\text{ms}$) before the enemy reaches the viewport edge. This satisfies the out-of-bounds entrance requirement.

2. **Terrain Snapping Validation (Observation 1.2 $\to$ Conclusion)**:
   Soldiers have bounding box height 38. Spawning at top-left $Y = 192$ aligns foot position $Y_{\text{foot}} = 192 + 38 = 230.0$, matching the top surface of the ground platform ($Y = 230$). On the spawn frame, `PlatformPhysics.resolveGroundContact` evaluates $prevFootY \le platTop + snapTolerance$ as $230 \le 234$ (true), snapping the entity immediately and setting `isGrounded = true`. Gravity does not pull the soldier into the abyss.

3. **Pop-in Elimination Validation (Observation 1.3 $\to$ Conclusion)**:
   Pre-allocating hostages in `FullMetalSlugGame.initStaticPows()` at stage boot ensures all POWs are part of the static scene geometry ahead of the player. Removing `PowEntity` instantiation from runtime triggers prevents hostages from popping directly onto the player's coordinates.

4. **Boss Gating Validation (Observation 1.4, 1.5, 1.6 $\to$ Conclusion)**:
   Dynamic thresholds $p1 = \text{round}(400 \times 0.65) = 260$ and $p2 = \text{round}(400 \times 0.30) = 120$ dynamically gate damage using `Math.max(threshold, health - damage)`. Even a single 100,000 HP hit cannot reduce health below 260 in Phase 1 or below 120 in Phase 2. The phase state transitions advance monotonically (1 $\to$ 2 $\to$ 3 $\to$ Death $\to$ Destroyed), ensuring that each phase plays out and the player experiences the full boss encounter.

---

## 3. Caveats & Adversarial Edge Cases

1. **Extreme Camera Panning (> 2,290 px/s)**:
   If camera panning exceeds $2,290\text{ px/s}$ (17.3x normal player speed), the 1-frame lag in `FullMetalSlugGame.step()` (where `stageManager.update()` is called before `camera.update()`) allows the camera to advance past the 40px spawn margin on the first frame.
   *Mitigation (Recommendation for future refactors)*: In `FullMetalSlugGame.step()`, call `camera.update()` prior to `stageManager.update()`. In production gameplay, this has zero impact because player movement is strictly capped at $132\text{ px/s}$.
2. **Negative Damage Healing**:
   Calling `takeDamage()` with negative numbers increases current HP within the current phase because `amount <= 0` is not explicitly rejected.
   *Mitigation*: Negligible risk because no weapon or entity delivers negative damage in the game.
3. **Mid-Boss Spawning Arena Lock**:
   During the mid-boss fight at $X = 740$, subsequent wave triggers are suppressed until the mid-boss vehicle is destroyed, which is intentional arcade arena design.

---

## 4. Conclusion

**Verdict**: **APPROVE**

Milestones M2 (Spawning Logic Overhaul) and M3 (Boss Health Rebalance) have passed all empirical stress tests:
- Enemy spawn coordinates strictly out-of-bounds ($X \ge \text{cameraX} + 480$).
- Ground platform collision alignment ($Y = 192$, feet at $230$) eliminates abyss falling.
- Zero timer-based popping; POWs statically pre-placed.
- Boss health rebalanced to 400 HP ($\le 500$ HP).
- Dynamic phase gating (260 HP / 120 HP) prevents multi-phase skips under massive damage bursts.
- Clean death sequence and single event dispatch verified.

---

## 5. Verification Method

### 5.1 Typecheck and Production Build
```bash
npm run build
```
*Result*: Exit code 0. Clean TypeScript compilation and Vite production bundle (`dist/assets/index-Cy7S9ANT.js`).

### 5.2 Challenger 2 Dedicated Empirical Test Suite
```bash
npx vitest run tests/unit/challenger_2_empirical_stress.test.ts
```
*Result*: 15 passed (15 tests, 100% green).

### 5.3 Complete Vitest Suite (All 20 Test Suites)
```bash
npx vitest run
```
*Result*: 20 passed (20 test files, 257 tests passed, 0 failures).

### 5.4 Playwright Headless Browser E2E Suite
```bash
npx playwright test
```
*Result*: 14 passed (14 tests across 3 spec files, 100% green).

### 5.5 Invalidation Conditions
- If any enemy spawns with $X < \text{cameraX} + 480$ under normal player run speed ($132\text{ px/s}$).
- If a soldier spawned at $Y = 192$ has `isGrounded === false` or $Y > 192$ while on the ground platform.
- If `TetsuyukiBoss` with 400 HP skips Phase 2 (health $< 260$ in Phase 1) or Phase 3 (health $< 120$ in Phase 2) upon receiving 5,000 damage.
- If `npm run build` or `npx vitest run` produces any failures.
