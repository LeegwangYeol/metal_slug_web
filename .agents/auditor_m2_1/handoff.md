# Forensic Audit Report: Milestone M2 (Autonomous Ally NPCs & Diverse Items/Weapons)

- **Agent**: `teamwork_preview_auditor` (`auditor_m2_1`)
- **Role**: Forensic Auditor / Critic / Specialist
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_m2_1`
- **Target Work Product**: Milestone M2 implementation by `worker_m2_1`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Audit Date**: 2026-09-08
- **Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)
- **Binary Verdict**: **CLEAN**

---

## Forensic Audit Report Summary

```markdown
## Forensic Audit Report

**Work Product**: Milestone M2 (Autonomous Ally NPCs & Diverse Items/Weapons)
**Profile**: General Project (Development Mode)
**Verdict**: CLEAN

### Phase Results
- [Hardcoded output detection]: PASS — 0 hardcoded test results, fake returns, or mock bypasses in src/core/
- [Facade detection]: PASS — Genuine physics, kinematics, trigonometry, and state machine simulation logic across all entities
- [Pre-populated artifact detection]: PASS — No pre-populated logs, mock traces, or test results found
- [Build from source]: PASS — `npm run build` and `npx tsc --noEmit` succeed with exit code 0
- [Unit test suite execution]: PASS — 100% green across all worker M2 unit test suites (25/25 passed) and weapons stress suite (17/17 passed)
- [164-Key baseline invariant]: PASS — `ProceduralSpriteFactory.getAllKeys()` returns exactly 164 unique sprite keys

### Evidence
[See Section 1 (Observation) and Section 5 (Verification Method) below]
```

---

## 1. Observation

### 1.1 Source Code and Git Diff Analysis
A comprehensive line-by-line audit of `git diff src/ tests/` and newly added files was conducted. The files examined include:
- `src/core/entities/allies/AllyNPC.ts` (9,423 bytes, 319 lines)
- `src/core/entities/allies/AllyKiBlast.ts` (3,240 bytes, 115 lines)
- `src/core/entities/allies/AllyManager.ts` (1,197 bytes, 51 lines)
- `src/core/entities/allies/AllyTypes.ts` (1,061 bytes, 52 lines)
- `src/core/weapons/ShotgunWeapon.ts` (4,218 bytes, 134 lines)
- `src/core/weapons/LaserGunWeapon.ts` (4,395 bytes, 150 lines)
- `src/core/weapons/RocketLauncherWeapon.ts` (7,316 bytes, 239 lines)
- `src/core/entities/items/ItemPickup.ts` (2,243 bytes, 76 lines)
- `src/core/entities/pow/PowEntity.ts` & `PrisonerEntity.ts` (lines 89-287)
- `src/core/player/PlayerController.ts` (lines 43, 540-625)
- `tests/unit/allies_system.test.ts` (10,035 bytes, 283 lines)
- `tests/unit/diverse_weapons_items.test.ts` (13,765 bytes, 352 lines)
- `tests/unit/pow_system.test.ts` (lines 74-82)

#### Observations in Source:
1. **Mathematical Simulation in `ShotgunWeapon.ts`**:
   Lines 100-117 calculate genuine trigonometric pellet distribution:
   ```typescript
   const baseAngle = Math.atan2(aimVec.y, aimVec.x);
   const halfArc = ShotgunWeapon.SPREAD_ARC_RAD / 2;
   const angleStep = ShotgunWeapon.SPREAD_ARC_RAD / (ShotgunWeapon.PELLET_COUNT - 1);
   for (let i = 0; i < ShotgunWeapon.PELLET_COUNT; i++) {
     const angle = baseAngle - halfArc + i * angleStep;
     const vx = Math.cos(angle) * ShotgunWeapon.PELLET_SPEED;
     const vy = Math.sin(angle) * ShotgunWeapon.PELLET_SPEED;
   ```
   Pellet knockback applies physical impulse:
   ```typescript
   const knockbackX = this.facing * 160.0;
   const knockbackY = -80.0;
   if ((other as any).velocity) {
     (other as any).velocity.x += knockbackX;
     (other as any).velocity.y += knockbackY;
   }
   ```
2. **Kinematic Guidance and AOE Falloff in `RocketLauncherWeapon.ts`**:
   Lines 120-134 execute dynamic angular turn clamping:
   ```typescript
   let angleDiff = targetAngle - currentAngle;
   while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
   while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
   const maxSteer = PlayerRocketProjectile.STEERING_RATE * dt;
   if (Math.abs(angleDiff) <= maxSteer) {
     currentAngle = targetAngle;
   } else {
     currentAngle += Math.sign(angleDiff) * maxSteer;
   }
   this.velocity.x = Math.cos(currentAngle) * this.currentSpeed;
   this.velocity.y = Math.sin(currentAngle) * this.currentSpeed;
   ```
   Detonation damage applies linear falloff across blast radius (line 177):
   ```typescript
   const damage = PlayerRocketProjectile.MAX_DAMAGE * Math.max(0, 1.0 - dist / blastRadius);
   ```
3. **Continuous Piercing and Tick Immunity in `LaserGunWeapon.ts`**:
   Lines 42-49 and 90-101 track a Map of per-target immunity timers (`this.targetImmunityMap.set(other.id, 0.1)`), preventing multi-hit damage within 0.1 seconds while piercing targets without self-terminating.
4. **Autonomous AI State Machine in `AllyNPC.ts`**:
   State transitions follow formal timed and distance thresholds across `SPAWN_SALUTE`, `FOLLOW`, `IDLE`, `ACQUIRE_TARGET`, `CHARGE_ATTACK`, `FIRE_ATTACK`, `RECOVERY`, and `CELEBRATE`. Ground contact and airborne gravity are integrated with `PlatformPhysics.resolveGroundContact`.
5. **No Cheated Mock Assertions or Hardcoded String Returns**:
   A global grep search for `mock` and `test` in `src/core/` returned zero matches. All computations are derived from live engine state, spatial queries, and delta time.

### 1.2 Invariant Verification: 164-Key Baseline
Running `tests/unit/adversarial_sprites_crosshairs.test.ts` confirmed:
```text
[Oracle 1A] Total Registered Sprite Keys: 164
[Category Audit 1E] Verified Breakdown: {
  player: 67,
  rebel: 21,
  pow: 9,
  ironTechnical: 7,
  tetsuyuki: 8,
  projectile: 13,
  casings: 4,
  explosions: 18,
  hud: 17,
  total: 164
}
Test Files  1 passed (1)
     Tests  17 passed (17)
```
The 164-key baseline invariant is completely uncorrupted.

### 1.3 Compilation and Build Verification
Running `npm run build` (`tsc -b && vite build`):
```text
vite v6.4.3 building for production...
transforming...
✓ 35 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  1.26 kB │ gzip:  0.58 kB
dist/assets/index-UpzQE2qR.js  206.37 kB │ gzip: 53.14 kB │ map: 755.54 kB
✓ built in 4.91s
```
Exit code: 0.

Running `npx tsc --noEmit`:
Exit code: 0 (clean compilation with zero diagnostics).

### 1.4 Unit Test Suite Execution
Running `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts`:
```text
 ✓ tests/unit/pow_system.test.ts (3 tests) 29ms
 ✓ tests/unit/allies_system.test.ts (10 tests) 10ms
 ✓ tests/unit/diverse_weapons_items.test.ts (12 tests) 69ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
```
Running `npx vitest run tests/unit/m2_challenger_stress.test.ts`:
```text
 ✓ tests/unit/m2_challenger_stress.test.ts (17 tests) 195ms

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

---

## 2. Logic Chain

1. **Premise 1 (Ground-Truth Integrity Level)**: `ORIGINAL_REQUEST.md` specifies `Integrity mode: development`. Under Development Mode, the primary prohibited patterns are hardcoded test results, facade implementations, and fabricated verification outputs.
2. **Premise 2 (Empirical Source Audit)**:
   - Every file modified or created by `worker_m2_1` was verified via direct inspection and string search.
   - Zero hardcoded test constants, fake branching on test IDs, or dummy returns exist.
   - All classes (`AllyNPC`, `AllyKiBlast`, `ShotgunWeapon`, `LaserGunWeapon`, `RocketLauncherWeapon`, `ItemPickup`, `PlayerController`) implement real physics, vector mathematics, bounding box collisions, and event broadcasting.
3. **Premise 3 (Empirical Behavioral Verification)**:
   - Full TypeScript build (`npm run build`) succeeded with 0 errors.
   - All M2 unit tests authored by the worker (25/25) pass cleanly without failure.
   - The adversarial stress suite authored by `challenger_m2_2` (17/17 tests) verifies exact mathematical bounds (7-pellet spread, 1200 px/s beam with 0.1s tick immunity, rocket blast falloff at 0px, 24px, 48px, shield 2-hit depletion, medkit healing/extra lives) and all 17 tests passed cleanly.
   - The 164-key baseline invariant in `ProceduralSpriteFactory` was independently executed and empirically verified to equal exactly 164 unique keys.
4. **Conclusion**: Because all verification checks passed without a single failure or integrity violation, the binary verdict is **CLEAN**.

---

## 3. Caveats & Adversarial Observations

### 3.1 Non-Integrity Adversarial Observations (For Quality Polish in M3)
While the work product is 100% clean of integrity violations, our adversarial stress analysis of `tests/unit/m2_ally_rocket_empirical_challenge.test.ts` surfaced two subtle implementation nuances:
1. **Target Threat Precedence in `AllyNPC.findBestTarget`**:
   In `AllyNPC.ts` line 267:
   ```typescript
   if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
     priorityWeight = 100;
   } else if (typeStr === 'MID_BOSS_VEHICLE') {
     priorityWeight = 50;
   }
   ```
   Because `'MID_BOSS_VEHICLE'` contains `'BOSS'`, `typeStr.includes('BOSS')` matches first, giving mid-boss vehicles a priority weight of 100 instead of 50. Recommendation for M3: check `typeStr === 'MID_BOSS_VEHICLE'` before `typeStr.includes('BOSS')`.
2. **Discrete Euler Jump Trajectory**:
   Discrete simulation at $dt = 1/60$ results in a peak apex of $y = 134.7$ compared to continuous calculus theoretical max height of $y = 137.5$. This is standard discrete integration behavior.
3. **Pre-Tick Entity Visibility**:
   `AllyNPC.findBestTarget` and `RocketLauncherWeapon.steerTowardsNearestEnemy` check both `engine.getAllEntities()` and `(engine as any).entitiesToAdd`. However, `AllyNPC.update()` queries `engine.getEntity('player')`, which only searches committed entities. If unit tests add player via `engine.addEntity(player)` without running `engine.tick()`, `player` appears undefined until the first engine tick flushes. Tests should either call `engine.tick()` or seed entities directly.

---

## 4. Conclusion

The work product submitted by `worker_m2_1` for Milestone M2 strictly adheres to all architectural specifications, contains genuine simulation logic, passes all functional tests, preserves the 164-key baseline invariant, and compiles with zero errors.

**Binary Forensic Verdict**: **CLEAN**

The work product is approved from an integrity standpoint, and Milestone M2 is cleared for progression to Milestone M3 (Ultimate Move System & Presentation FX).

---

## 5. Verification Method

To independently verify all findings:
1. **TypeScript Build**:
   ```bash
   npm run build
   ```
   *Expected: Exit code 0, bundled assets in `dist/`.*
2. **Typecheck Diagnostics**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected: Exit code 0, 0 diagnostic messages.*
3. **Milestone M2 Unit Test Execution**:
   ```bash
   npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts
   ```
   *Expected: 3 test files passed, 25 tests passed.*
4. **Adversarial Weapons Stress Test**:
   ```bash
   npx vitest run tests/unit/m2_challenger_stress.test.ts
   ```
   *Expected: 1 test file passed, 17 tests passed.*
5. **Procedural Sprite 164-Key Invariant**:
   ```bash
   npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts
   ```
   *Expected: `[Oracle 1A] Total Registered Sprite Keys: 164`, 17 tests passed.*
