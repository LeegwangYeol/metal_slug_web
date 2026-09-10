# Empirical Challenge Report — Milestone M2: Platform Physics & Drop-Through Mechanics

**Agent**: `challenger_m2_overhaul_1`  
**Date**: 2026-09-10  
**Verdict**: **APPROVE**  

---

## 1. Observation

### A. Code Review Findings
1. **Player Drop-Through Caching & Execution**:
   - `src/core/player/PlayerController.ts:447-476`: `initiateDropThrough(engine?: GameEngine)` resolves the platform at the player's feet via `platforms.find(...)` or `this.activePlatform`, explicitly sets `this.ignoredPlatformId = currentPlat.id; this.isDroppingThrough = true; this.velocity.y = PlayerKinematics.DROP_THROUGH_IMPULSE (120 px/s); this.coyoteTimer = 0; this.jumpBufferTimer = 0;`.
   - `src/core/player/PlayerController.ts:536-562`: In `update`, `PlatformPhysics.resolveGroundContact` receives `this.isDroppingThrough ? this.ignoredPlatformId : null`. On subsequent ground contact, `this.isDroppingThrough = false; this.ignoredPlatformId = null;`.
   - `src/core/player/PlayerController.ts:200-204`: Down+Jump input condition: `if (this.isGrounded && input.down && input.jumpPressed) { this.initiateDropThrough(engine); return; }`.
   - `src/core/player/PlayerController.ts:155-158`: Jump input buffering condition: `if (input.jumpPressed && !input.down) { this.jumpBufferTimer = PlayerKinematics.JUMP_BUFFER_FRAMES * timestep; }`. Holding down prevents unintended jump buffering while crouching or initiating drop-through.

2. **Paratrooper Dynamic Platform Contact**:
   - `src/core/entities/enemies/SoldierEnemy.ts:651-683`: In `updateParachuteAI`, queries `PlatformPhysics.resolveGroundContact` with `footX = this.position.x + this.width / 2`, `prevFootY = this.position.y + this.height`, `currFootY = this.position.y + this.height`, `vy = this.velocity.y`, and `halfWidth = this.width / 2`.
   - On contact with any platform or ground: `this.position.y = finalGroundY - this.height; this.velocity.x = 0; this.velocity.y = 0; this.isGrounded = true; this.isParachuteActive = false; this.transitionTo('PARACHUTE_LANDING');`.
   - `src/core/entities/enemies/SoldierEnemy.ts:587-630`: In `applyPhysics`, during active states (`PATROL`, `ALERT`, `AIM`, etc.), `PlatformPhysics.resolveGroundContact` continuously runs, maintaining the soldier on elevated platforms (`groundContact.groundY - this.height`) or applying gravity if they walk off the edge.

### B. Empirical Test Suites Executed
1. **Vitest Unit Test Suite (`tests/unit/adversarial_m2_platform_physics_challenge.test.ts`)**:
   - Command: `npx vitest run tests/unit/adversarial_m2_platform_physics_challenge.test.ts`
   - Result: 28 unit tests, 28 passed (100% green in 81ms).
   - Test breakdown:
     - Task 1: Rapid Down+Jump spamming, 3-tier cascade (`Y=125 -> 160 -> 175 -> 230`), alternating Down+Jump release (3 tests, all passed).
     - Task 2: Drop-through from 7 elevated platform heights (`Y=80, 100, 125, 150, 160, 175, 200`) onto ground `Y=230`, and drop-through rejection on solid ground (8 tests, all passed).
     - Task 3: Edge drop-through: exact left edge (`X=100`), exact right edge (`X=200`), lateral crawl off edge while dropping, running off edge into airborne fall (4 tests, all passed).
     - Task 4: Paratrooper descent on `Y=125`, `Y=160`, `Y=175`, all 4 soldier variants (`RIFLE`, `GRENADE`, `KNIFE`, `SHIELD`), swaying past narrow platforms to ground (5 tests, all passed).
     - Task 5: Full Stage 1 all-platform drop-through integration across 19 semi-solid platforms (1 test, passed).
     - Task 6: Variable timestep stability (`120Hz`, `60Hz`, `30Hz`) (3 tests, all passed).
     - Task 7: Closely stacked platforms (8px separation between `Y=160` and `Y=168`) (1 test, passed).
     - Task 8: Upward jump pass-through and landing on descent (1 test, passed).
     - Task 9: Extreme paratrooper sway (frequency 4.5, amplitude 25px) and elevated platform patrol stability (2 tests, all passed).

2. **Monte Carlo Empirical Stress Harness (`scripts/empirical_challenge_m2_platform_physics.ts`)**:
   - Command: `npx tsx scripts/empirical_challenge_m2_platform_physics.ts`
   - Total Iterations Executed: **3,141 iterations**
   - Results:
     - Test 1A (Down+Jump Rapid Spamming, 30Hz pulse over 60 frames): `1,000/1,000` clean landings (100.0% pass, 0 freezes, 0 NaN, 0 re-snaps).
     - Test 1B (Multi-Tier Cascading Drop-Through across 3 stacked platforms): `1,000/1,000` perfect cascades (100.0% pass, 0 failures).
     - Test 2 (Platform Edge Discretization Sweep, every 1px from `x - 20` to `x + width + 20`): `141/141` clean descents (100.0% pass).
     - Test 3 (Paratrooper Touchdown Precision across `Y=125, 160, 175, 230`): `1,000/1,000` exact touchdowns (100.0% pass, 0 clipping, 0 hovering, 0 state errors).
     - Test 4 (Stage 1 All 27 Platforms Drop & Land Integrity): `19/19` semi-solid platforms verified (100.0% pass).

3. **Global Repository Verification**:
   - `npx tsc --noEmit`: Exited with code 0 (0 errors).
   - `npm test`: 40 test files passed, 559 unit tests passed (100% green).
   - `npm run build`: Exited with code 0, bundle built in 294ms.

---

## 2. Logic Chain

1. **Down+Jump Rapid Pressing & Anti-Resnapping Mechanism**:
   - In previous iterations, clearing `isGrounded = false` without recording which platform was dropped through allowed `PlatformPhysics.resolveGroundContact` to immediately re-snap the player to the same platform on frame 1 (`prevFootY <= platTop + 4 && currFootY >= platTop`).
   - In the overhauled code (`PlayerController.ts:467`), `this.ignoredPlatformId = currentPlat.id` is cached at initiation.
   - `PlatformPhysics.checkSemiSolidLanding` (lines 69-71) explicitly bypasses the ignored platform: `if (ignoredPlatformId && platform.id === ignoredPlatformId) return { isGrounded: false, groundY: currFootY, platform: null };`.
   - Repeatedly pressing Down+Jump while airborne cannot re-trigger or reset `ignoredPlatformId` because line 201 guards on `this.isGrounded`.
   - Therefore, the player descends cleanly without stutter, re-snapping, or freezing. Verified empirically across 1,000 iterations (Test 1A).

2. **Cascading Drop-Through on Multi-Tier Platforms**:
   - When descending from `Y=125` onto `Y=160`, `contact.isGrounded` becomes `true`. Lines 558-561 clear `this.isDroppingThrough = false; this.ignoredPlatformId = null;` and set `this.activePlatform = plat_160`.
   - On the very next tick, pressing Down+Jump immediately caches `this.ignoredPlatformId = 'plat_160'`, allowing instant drop-through to `Y=175`, and subsequently to `Y=230`.
   - Multi-tier cascades operate deterministically without input lag or missed frames. Verified empirically in Task 1B (1,000/1,000 runs).

3. **Boundary Edge & Overhang Mechanics**:
   - The player's foot collision check uses `halfWidth = STANDING_WIDTH / 2 = 12px`.
   - When the player stands at the exact edge (`footX = plat.bounds.x` or `footX = plat.bounds.x + width`), `footX + halfWidth > platLeft && footX - halfWidth < platRight` remains true.
   - In `initiateDropThrough`, `this.activePlatform` serves as fallback even if floating-point edge discrepancies occur.
   - Walking off the edge naturally transitions to airborne gravity integration without clipping. Verified across 141 individual 1px steps in Test 2.

4. **Paratrooper Feet Touchdown & Zero-Clipping Invariant**:
   - Paratroopers descend at `40..60 px/s` with harmonic sway `amplitude * sin(freq * t + phase)`.
   - `updateParachuteAI` (lines 654-665) queries `PlatformPhysics.resolveGroundContact` each tick.
   - For elevated platforms at `Y = 125, 160, 175`: the surface is crossed from above (`prevFootY <= platTop + 4 && currFootY >= platTop`).
   - `this.position.y` is set to `finalGroundY - this.height` (where `height = 38`).
   - Consequently, `feetY = position.y + height = finalGroundY` exactly matches the platform top surface:
     - At `Y = 125`: `position.y = 87`, feet at `125.0000`.
     - At `Y = 160`: `position.y = 122`, feet at `160.0000`.
     - At `Y = 175`: `position.y = 137`, feet at `175.0000`.
     - At `Y = 230`: `position.y = 192`, feet at `230.0000`.
   - `isParachuteActive` is set to `false`, entering `PARACHUTE_LANDING` for 0.25s, then transitioning into `PATROL` at that exact elevation. Verified across 1,000 drops in Test 3 with 0 clipping and 0 hovering errors.

---

## 3. Caveats

1. **Simulation vs Browser Frame Rates**:
   - Unit and stress tests execute in headless Node.js at 60Hz, 30Hz, and 120Hz fixed semi-implicit Euler integration.
   - On extreme lag spikes (e.g., `dt > 0.25s`), `dt` should be clamped by the game loop engine to prevent large displacement skips (handled by `GameEngine.DEFAULT_TIMESTEP`).
2. **Concurrent Peer Challenger Test File**:
   - `challenger_m2_overhaul_2` was active in parallel creating `adversarial_m2_overhaul_2_challenger.test.ts`. All TypeScript type signatures in that test file were resolved, confirming repository-wide build compatibility (`npx tsc --noEmit` exits with 0 errors).

---

## 4. Conclusion

**Verdict: APPROVE**

The platform physics, drop-through mechanics, and paratrooper elevation landing systems implemented in Milestone M2 have undergone rigorous, empirical stress testing:
- Drop-through under rapid Down+Jump pressing is 100% stable: no freezing, no re-snapping, no NaN corruption across 1,000 Monte Carlo runs.
- Multi-tier cascading drop-through (`Y=125 -> 160 -> 175 -> 230`) functions with 100% repeatability.
- Drop-through off platform edges and overhangs functions cleanly without boundary glitches across 141 1px discretized positions.
- Paratrooper descent on elevated platforms (`Y=125, 160, 175`) achieves 100% exact feet touchdown with 0 clipping, 0 hover, and seamless transitions into `PARACHUTE_LANDING` and `PATROL`.
- The complete test suite (40 files, 559 tests) is 100% green, with zero TypeScript compiler errors and a clean production build.

---

## 5. Verification Method

To independently reproduce and verify these findings from `/Users/user/teamwork_projects/metal_slug_web`:

1. **Run Dedicated Adversarial Test Suite**:
   ```bash
   npx vitest run tests/unit/adversarial_m2_platform_physics_challenge.test.ts
   ```
   *Expected*: 28 tests passing (100% green).

2. **Run Monte Carlo Empirical Stress Harness (3,141 iterations)**:
   ```bash
   npx tsx scripts/empirical_challenge_m2_platform_physics.ts
   ```
   *Expected*:
   - Clean Landings: 1,000/1,000 (100.0%)
   - Perfect Cascades: 1,000/1,000 (100.0%)
   - Clean Edge Descents: 141/141 (100.0%)
   - Exact Touchdowns: 1,000/1,000 (100.0%, 0 clipping, 0 hover)
   - Semi-solid platforms: 19/19 (100.0%)

3. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected*: 40 test files passed, 559 tests passed.

4. **Verify TypeScript & Production Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   *Expected*: Exit code 0, 0 compilation errors, production bundle generated in `dist/`.
