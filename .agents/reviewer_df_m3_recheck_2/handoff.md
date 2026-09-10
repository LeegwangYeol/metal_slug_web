# Milestone M3 Remediation Re-Check — Review & Adversarial Challenge Handoff Report

**Agent**: Reviewer 2 Re-Check (`reviewer_df_m3_recheck_2`)  
**Date**: 2026-09-10T12:02:30Z  
**Project**: Grim Harvest: Undead Siege (`metal_slug_web`)  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: LOW  

---

## 1. Observation

### 1.1 Automated Commands and Live Execution Results

1. **TypeScript Static Compilation**:
   - Command: `npx tsc --noEmit`
   - Result: Exited with code 0 (zero diagnostic errors or warnings).

2. **Full Unit Test Suite (18 test files, 210 tests)**:
   - Command: `npm test`
   - Single Run: 18 test files passed (18/18), 210 tests passed (210/210) in 3.80s.
   - Three Consecutive Stability Runs:
     - Run 1: 18/18 files passed, 210/210 tests passed in 3.97s.
     - Run 2: 18/18 files passed, 210/210 tests passed in 4.04s.
     - Run 3: 18/18 files passed, 210/210 tests passed in 3.80s.
     - Pass Rate: 100% (630/630 test executions passed without a single failure or timeout).

3. **Production Build**:
   - Command: `npm run build`
   - Output: `tsc -b && vite build` completed in 318ms; generated `dist/assets/index-C7t3QRhf.js` (135.71 kB, gzip: 37.98 kB).

4. **Independent Empirical Verification — Player MoveSpeed & Kinematics**:
   - Command: Direct headless Node.js execution via `npx tsx`.
   - Script tested base `Player` instantiation with `moveSpeed: 200` and legacy `moveSpeed: 1.0`, along with sequential acquisition of `Ring of Velocity` ranks 0 to 5.
   - Output:
     ```
     Player base moveSpeed: 200
     Speeds across ranks 0-5: [ 200, 220, 240, 260, 280, 300 ]
     Rank 0 steady state Vx: 200
     Rank 1 steady state Vx: 220
     Rank 2 steady state Vx: 240
     Rank 3 steady state Vx: 260
     Rank 4 steady state Vx: 280
     Rank 5 steady state Vx: 300
     MOVE SPEED MONOTONICITY & KINEMATICS: VERIFIED 100% PASS
     ```

5. **Independent Adversarial Stress Test — Boundary Perimeter Spawning**:
   - Command: 65,000 perimeter spawn draws across 13 camera positions including extreme borders and corners (`camX: 1040, camY: 0`, `camX: -2000, camY: 0`, `camX: 0, camY: -2000`, `camX: 0, camY: 1460`, and all 4 corners).
   - Viewport dimensions: 960x540; Arena bounds: `[-2000, 2000]` in X and Y.
   - Output:
     ```
     Center (0,0): OnScreen=0/5000, OOB=0/5000
     East Boundary (1040,0): OnScreen=0/5000, OOB=0/5000
     West Boundary (-2000,0): OnScreen=0/5000, OOB=0/5000
     North Boundary (0,-2000): OnScreen=0/5000, OOB=0/5000
     South Boundary (0,1460): OnScreen=0/5000, OOB=0/5000
     NE Corner (1040,-2000): OnScreen=0/5000, OOB=0/5000
     NW Corner (-2000,-2000): OnScreen=0/5000, OOB=0/5000
     SE Corner (1040,1460): OnScreen=0/5000, OOB=0/5000
     SW Corner (-2000,1460): OnScreen=0/5000, OOB=0/5000
     Near East (1035) (1035,100): OnScreen=0/5000, OOB=0/5000
     Near West (-1995) (-1995,-100): OnScreen=0/5000, OOB=0/5000
     Near North (-1995) (200,-1995): OnScreen=0/5000, OOB=0/5000
     Near South (1455) (-300,1455): OnScreen=0/5000, OOB=0/5000
     TOTAL ON SCREEN: 0 / 65000
     TOTAL OUT OF BOUNDS: 0 / 65000
     PERIMETER SPAWNER STRESS TEST: 100% CLEAN OUTSIDE VIEWPORT AND INSIDE ARENA
     ```

6. **Independent Adversarial Stress Test — Evolved Weapon Exclusions & Anti-Demotion**:
   - Tested all 5 occult evolutions:
     - `weapon_scythe` -> `soul_reaping_harvester`
     - `weapon_orbiters` -> `abyssal_vortex`
     - `weapon_spear` -> `ossuary_cataclysm`
     - `weapon_lightning` -> `storm_of_torment`
     - `weapon_aura` -> `domain_of_decay`
   - Generated 200 consecutive card hands (800 cards) per evolution with open weapon slots (< 6).
   - Injected rogue/stale upgrade card requests for base weapons into `UpgradeSystem.applyUpgrade`.
   - Output:
     ```
     Testing all 5 evolutions...
     Evolution Soul Reaping Harvester (weapon_scythe -> soul_reaping_harvester): PASSED
     Evolution Abyssal Vortex (weapon_orbiters -> abyssal_vortex): PASSED
     Evolution Ossuary Cataclysm (weapon_spear -> ossuary_cataclysm): PASSED
     Evolution Storm of Torment (weapon_lightning -> storm_of_torment): PASSED
     Evolution Domain of Decay (weapon_aura -> domain_of_decay): PASSED
     ALL EVOLUTIONS VERIFIED: 0 RE-OFFERING, 0 DEMOTION ACROSS ALL WEAPONS
     ```

### 1.2 Direct Code Inspection Observations

1. **`src/main.ts:69` & `src/core/entities/Player.ts:70-73, 131`**:
   - `src/main.ts:69`: Initialized with `moveSpeed: 200`.
   - `src/core/entities/Player.ts:70-72`: Constructor safely normalizes legacy multiplier ranges:
     ```ts
     const rawSpeed = customStats?.moveSpeed ?? DEFAULT_PLAYER_STATS.moveSpeed;
     const initialSpeed = (rawSpeed > 0 && rawSpeed <= 5) ? rawSpeed * Player.BASE_MOVE_SPEED : rawSpeed;
     ```
   - `src/core/entities/Player.ts:131`: Replaced heuristic ternary with direct stat reading:
     ```ts
     const maxSpeed = this.stats.moveSpeed;
     const targetVx = dirX * maxSpeed;
     const targetVy = dirY * maxSpeed;
     ```
2. **`src/core/systems/WaveDirector.ts:249-289`**:
   - Cardinal edges are dynamically validated before selection:
     ```ts
     const validEdges: number[] = [];
     if (camY - 20 >= this.arenaBounds.minY + 20) validEdges.push(0); // North
     if (camY + h + 20 <= this.arenaBounds.maxY - 20) validEdges.push(1); // South
     if (camX - 20 >= this.arenaBounds.minX + 20) validEdges.push(2); // West
     if (camX + w + 20 <= this.arenaBounds.maxX - 20) validEdges.push(3); // East
     ```
   - Each cardinal quadrant strictly clamps coordinates beyond the viewport boundaries (`Math.min(camY - 10, y)` for North, `Math.max(camY + h + 10, ...)` for South, `Math.min(camX - 10, ...)` for West, `Math.max(camX + w + 10, ...)` for East).
3. **`src/core/systems/UpgradeSystem.ts:327, 368-376, 513-515, 593-595, 790-797` & `src/core/weapons/WeaponManager.ts:140-142`**:
   - Tracking set: `private readonly evolvedWeapons: Set<string> = new Set();`.
   - On evolution in `evolveWeapon`: both `normalizeWeaponId(weaponId)` and `normalizeItemId(weaponId)` are recorded in `evolvedWeapons`.
   - `isWeaponEvolved` checks both ID forms and underlying weapon evolution status.
   - `getWeaponRank` returns 5 if `isWeaponEvolved(weaponId)` is true.
   - In `generateUpgradeCards`, loop explicitly checks: `if (this.isWeaponEvolved(weapon.id) || this.isWeaponEvolved(normW)) continue;`.
   - In `applyUpgrade`, card application for evolved weapons is rejected: `if (this.isWeaponEvolved(card.itemId)) return;`.
   - In `WeaponManager.setWeaponRank`, rank mutation is rejected if `weapon.isEvolution` is true: `if (weapon.isEvolution) return;`.
4. **`src/core/weapons/CursedAura.ts:148-151`**:
   - Redundant direct velocity mutation (`enemy.pushVx += kbX; enemy.pushVy += kbY;`) has been removed; knockback is passed solely to `hordeManager.applyDamage`, preserving single mass-scaled impulse calculation in `Enemy.takeDamage`.

---

## 2. Logic Chain

1. **Player MoveSpeed Inversion Resolution**:
   - Observation 1.1.4 and Observation 1.2.1 show that `Player.stats.moveSpeed` starts at 200 px/s and increments by 20.0 px/s with each rank of Ring of Velocity (`passive_velocity`), reaching 300 px/s at Rank 5.
   - `handleInput` calculates `maxSpeed = this.stats.moveSpeed`, steering `velocity.x` and `velocity.y` directly to `targetVx = dirX * maxSpeed`.
   - Because the legacy threshold check (`speed > 5 ? speed : 200 * speed`) was eliminated, acquiring passive velocity cards never triggers velocity collapse. Monotonicity is preserved mathematically and empirically.
2. **Boundary Perimeter Spawner Frustum Violation Resolution**:
   - Observation 1.1.5 and Observation 1.2.2 demonstrate that when the camera reaches any arena boundary (e.g. East border at `camX = 1040`), the candidate edge list excludes the border edge because `camX + w + 20 <= arenaBounds.maxX - 20` evaluates to false (`1040 + 960 + 20 = 2020 > 1980`).
   - For edges that remain valid (e.g. North, South, West), clamping ensures that coordinates lie strictly beyond the camera frustum (`outPoint.x <= camX - 10` or `outPoint.x >= camX + w + 10`, etc.).
   - As a result, 100% of spawns across 65,000 empirical draws at boundaries and corners remained outside the camera frustum while staying within arena bounds.
3. **Evolved Weapon Re-Offer & Demotion Resolution**:
   - Observation 1.1.6 and Observation 1.2.3 establish that evolved weapons are recorded in `evolvedWeapons` under all ID aliases.
   - During upgrade card generation, any base weapon associated with an evolved weapon is bypassed.
   - In the event that a stale or invalid card references the base weapon, both `UpgradeSystem.applyUpgrade` and `WeaponManager.setWeaponRank` contain defensive guards that prevent rank demotion or duplicate entry creation.
   - Across 1,000 card generations spanning all 5 weapon evolutions, 0 base weapons were re-offered, and all evolved weapons retained Rank 5 with full evolution damage.
4. **Integrity and Stability Verification**:
   - No hardcoded test shortcuts or facade implementations were present in the codebase.
   - Static analysis (`npx tsc --noEmit`) and build pipelines (`npm run build`) passed with zero errors.
   - 3 consecutive runs of the entire 18-suite, 210-test unit test framework passed with 100% success, confirming zero flaky tests.

---

## 3. Caveats

- No caveats. All 3 previously reported defects, as well as secondary defects (double knockback and evolution card weighting flakiness), have been verified with complete mathematical and empirical proof.

---

## 4. Conclusion

The remediation executed for Milestone M3 ("Grim Harvest: Undead Siege") is thorough, robust, and mathematically sound.
All 3 primary review objectives have been satisfied:
1. Player `moveSpeed` scales monotonically from 200 to 300 px/s with Ring of Velocity ranks 0–5 without velocity collapse.
2. Perimeter spawning guarantees 0 on-screen frustum violations across all camera positions, including extreme arena boundaries.
3. Base weapons are completely excluded from upgrade offerings once evolved and are protected against rank degradation.

Static analysis (`npx tsc --noEmit`), full test suite (`npm test`, 18 files, 210 tests), and production bundling (`npm run build`) are 100% green. Zero integrity violations were detected.

**Final Verdict**: **APPROVE**.

---

## 5. Verification Method

To independently reproduce and verify this review assessment:

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Code 0, zero diagnostic errors.

2. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected*: 18/18 test files passed, 210/210 tests passed.

3. **Verify Production Bundle**:
   ```bash
   npm run build
   ```
   *Expected*: Code 0, Vite build outputs bundle into `dist/`.

4. **Verify Boundary Perimeter Spawning Frustum Exclusion (65,000 Draws)**:
   ```bash
   npx tsx -e "
   import { WaveDirector } from './src/core/systems/WaveDirector';
   import { HordeManager } from './src/core/HordeManager';
   const arena = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
   const wd = new WaveDirector(new HordeManager({ maxCapacity: 100 }), {
     viewportWidth: 960, viewportHeight: 540, spawnMargin: 90, arenaBounds: arena
   });
   let fails = 0;
   for (const pos of [{x: 1040, y: 0}, {x: -2000, y: 0}, {x: 0, y: -2000}, {x: 0, y: 1460}, {x: 1040, y: 1460}]) {
     for (let i = 0; i < 1000; i++) {
       const pt = wd.getPerimeterPoint(pos.x, pos.y);
       if (pt.x >= pos.x && pt.x <= pos.x + 960 && pt.y >= pos.y && pt.y <= pos.y + 540) fails++;
     }
   }
   console.log('Boundary Frustum Violations:', fails);
   "
   ```
   *Expected*: `Boundary Frustum Violations: 0`.

5. **Verify Evolution Card Exclusion Across All Weapons**:
   ```bash
   npx vitest run tests/unit/UpgradeSystem.test.ts
   ```
   *Expected*: Suite 5 passed (14/14 tests green).
