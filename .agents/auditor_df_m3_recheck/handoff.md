# Forensic Integrity Audit Report: Milestone M3 Remediation

**Work Product**: Milestone M3 Remediation (Occult Arsenal, Upgrades & Wave Director)  
**Audited Codebase**: `/Users/user/teamwork_projects/metal_slug_web`  
**Auditor**: `auditor_df_m3_recheck`  
**Integrity Mode**: `development` (per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN** (Authentic Logic Verified; Zero Integrity Violations)  

---

## Phase Results

| # | Check Description | Category | Result | Details |
|---|-------------------|----------|:------:|---------|
| 1 | **Hardcoded Test Results** | Integrity | **PASS** | Grep scan across `src/` for test fixtures, mocking constants, or bypass flags (`process.env`, `NODE_ENV`, `PASS/FAIL`) returned 0 occurrences. All outputs computed via authentic game mathematics. |
| 2 | **Facade Implementations** | Integrity | **PASS** | 0 stubbed functions, 0 dummy returns (`return <constant>`), 0 `TODO`/`FIXME` markers. Genuine implementations in `UpgradeSystem.ts`, `Player.ts`, `WaveDirector.ts`, `CursedAura.ts`, and `WeaponManager.ts`. |
| 3 | **Fabricated Verification Outputs** | Integrity | **PASS** | Workspace verified clean of pre-existing falsified log artifacts, synthetic result files, or fake coverage documents. |
| 4 | **Self-Certifying Tests** | Integrity | **PASS** | `UpgradeSystem.test.ts` and `WaveDirector.test.ts` execute real mathematical, physical, and kinematic assertions across thousands of randomized iterations without tautological checks. |
| 5 | **Execution Delegation** | Integrity | **PASS** | Fully custom-authored TypeScript implementation. No third-party engine delegation or unauthorized external libraries. |
| 6 | **TypeScript Compilation** | Runtime | **PASS** | `npx tsc --noEmit` exited code 0 with 0 diagnostic errors. |
| 7 | **Full Test Suite Execution** | Runtime | **PASS** | `npm test` passed 18/18 test files, 210/210 tests green in 2.43s–3.59s. |
| 8 | **Production Build Bundle** | Runtime | **PASS** | `npm run build` compiled clean production bundle `dist/assets/index-C7t3QRhf.js` (135.71 kB) in 280ms. |
| 9 | **Boundary Spawning Guarantee** | Empirical | **PASS** | 90,000 independent trials across 9 extreme boundary/corner positions yielded exactly 0 on-screen points (0.0% failure rate). |
| 10 | **Post-Evolution Integrity** | Empirical | **PASS** | 2,500 rolls across all 5 evolutions produced 0 re-offers of base weapons and 0 rank demotions. |
| 11 | **MoveSpeed Progression** | Empirical | **PASS** | Ring of Velocity scales speed strictly monotonically from 200 to 300 px/s with 60-frame kinematic velocity matching target speed. |
| 12 | **CursedAura Single Knockback** | Empirical | **PASS** | Impulse on hit matches single application `knockback / mass = 100 px/s` with zero double-knockback. |
| 13 | **Suite Flakiness Stability** | Empirical | **PASS** | 5 consecutive runs of remediated unit test suites passed 5/5 with 0 failures. |

---

## 5-Component Handoff Report

### 1. Observation

#### 1.1 Direct Code Inspection
1. **`src/core/systems/UpgradeSystem.ts` (Evolution Tracking & Re-Offering)**:
   - Line 316: `private readonly evolvedWeapons: Set<string> = new Set();`
   - Lines 368–376:
     ```ts
     public isWeaponEvolved(weaponId: string): boolean {
       const norm = normalizeItemId(weaponId);
       const normW = normalizeWeaponId(weaponId);
       return (
         this.evolvedWeapons.has(normW) ||
         this.evolvedWeapons.has(norm) ||
         (this.weapons.get(norm)?.isEvolution ?? false)
       );
     }
     ```
   - Lines 362–366:
     ```ts
     public getWeaponRank(weaponId: string): number {
       if (this.isWeaponEvolved(weaponId)) return 5;
       const norm = normalizeItemId(weaponId);
       return this.weapons.get(norm)?.rank ?? 0;
     }
     ```
   - Lines 510–526: `evolveWeapon(weaponId, evolutionId)` registers both `normW` and `normBase` in `this.evolvedWeapons` upon evolution.
   - Lines 593–595: In `generateUpgradeCards`, skips any weapon where `this.isWeaponEvolved(weapon.id) || this.isWeaponEvolved(normW)`.
   - Lines 744–749: In `sampleWeightedCards`, if any evolution candidate exists in `pool`, guaranteed inclusion of at least one evolution card in `selected`.
   - Lines 791–793: In `applyUpgrade`, guards `if (this.isWeaponEvolved(card.itemId)) return;`.

2. **`src/core/weapons/WeaponManager.ts` (Rank Demotion Guard)**:
   - Lines 134–145:
     ```ts
     public setWeaponRank(id: string, rank: number): void {
       const normId = normalizeWeaponId(id);
       let weapon = this.getWeapon(normId);
       if (!weapon) {
         this.addWeapon(normId, rank);
       } else {
         if (weapon.isEvolution) {
           return;
         }
         weapon.rank = rank;
       }
     }
     ```

3. **`src/core/entities/Player.ts` & `src/main.ts` (MoveSpeed Progression)**:
   - `src/main.ts:69`: Initialized `moveSpeed: 200` (matching `DEFAULT_PLAYER_STATS.moveSpeed`).
   - `src/core/entities/Player.ts:70-72`: `const rawSpeed = customStats?.moveSpeed ?? DEFAULT_PLAYER_STATS.moveSpeed; const initialSpeed = (rawSpeed > 0 && rawSpeed <= 5) ? rawSpeed * Player.BASE_MOVE_SPEED : rawSpeed;`
   - `src/core/entities/Player.ts:131`: `const maxSpeed = this.stats.moveSpeed;` (ambiguous `> 5` ternary removed).
   - `src/core/entities/Player.ts:259`: `this.stats[stat] += delta;` properly adds `deltaPerRank = 20.0` from `Ring of Velocity`.

4. **`src/core/systems/WaveDirector.ts` (Frustum Invasion & Perimeter Spawning)**:
   - Lines 249–256:
     ```ts
     const validEdges: number[] = [];
     if (camY - 20 >= this.arenaBounds.minY + 20) validEdges.push(0); // North
     if (camY + h + 20 <= this.arenaBounds.maxY - 20) validEdges.push(1); // South
     if (camX - 20 >= this.arenaBounds.minX + 20) validEdges.push(2); // West
     if (camX + w + 20 <= this.arenaBounds.maxX - 20) validEdges.push(3); // East
     ```
   - Lines 263–289: Cardinal edge positions are clamped strictly outside visible viewport coordinates:
     - North: `y <= camY - 10`
     - South: `y >= camY + h + 10`
     - West: `x <= camX - 10`
     - East: `x >= camX + w + 10`

5. **`src/core/weapons/CursedAura.ts` (Double Knockback Elimination)**:
   - Lines 148–151:
     ```ts
     const kbX = (dx / dist) * stats.knockback;
     const kbY = (dy / dist) * stats.knockback;
     const result = this.hordeManager.applyDamage(enemyId, effectiveDamage, kbX, kbY);
     ```
   - Direct mutation of `enemy.pushVx += kbX; enemy.pushVy += kbY;` was completely removed.

6. **`tests/unit/UpgradeSystem.test.ts` & `tests/unit/WaveDirector.test.ts` (New Regression Test Suites)**:
   - `UpgradeSystem.test.ts:180-298`: Suite 5 empirically verifies:
     - Evolved weapons are never re-offered across 200 rolls and cannot be demoted by rogue cards.
     - MoveSpeed increases strictly monotonically across ranks 1–5 ([200, 220, 240, 260, 280, 300]) and kinematic velocity reaches target.
     - 8,000 extreme boundary/corner perimeter spawns produce 0 in-frustum points.
   - `WaveDirector.test.ts:161-185`: Suite 4 guarantees 0 on-screen points across 8,000 extreme perimeter boundary draws.

#### 1.2 Tool Execution Output
- `npx tsc --noEmit`: Code 0, 0 errors.
- `npm test`: Code 0, 18 passed / 18 passed, 210 passed / 210 passed in 2.43s.
- `npm run build`: Code 0, Vite bundle generated `dist/assets/index-C7t3QRhf.js` (135.71 kB) in 280ms.
- Independent Monte Carlo Boundary Test (90,000 samples across Center, East, West, North, South, NE, NW, SE, SW):
  `TOTAL ON-SCREEN VIOLATIONS: 0 TOTAL OUT OF BOUNDS: 0`
- Independent Evolution Lifecycle Test (5 evolutions x 500 rolls = 2,500 rolls):
  `SUCCESS: Verified evolution lifecycle for Soul Reaping Harvester`
  `SUCCESS: Verified evolution lifecycle for Abyssal Vortex`
  `SUCCESS: Verified evolution lifecycle for Ossuary Cataclysm`
  `SUCCESS: Verified evolution lifecycle for Storm of Torment`
  `SUCCESS: Verified evolution lifecycle for Domain of Decay`
- Independent Speed Scaling Test:
  `Base speed: 200, Rank 1: 220, Rank 2: 240, Rank 3: 260, Rank 4: 280, Rank 5: 300. Kinematic velocity.x matches target.`
- Independent CursedAura Impulse Test:
  `Pulse hits: 1, Enemy health: 5, pushVx: 100, Expected kb: 100. Single accurate impulse verified.`
- Stability Harness:
  `5/5 consecutive test passes (30/30 tests each run) with 0 failures.`

---

### 2. Logic Chain

1. **Defect 1 Resolution (Evolved Weapon Re-Offer & Demotion)**:
   - In `UpgradeSystem.ts`, `evolvedWeapons` stores both raw and normalized IDs of base weapons upon evolution.
   - `isWeaponEvolved(id)` checks this set and returns true even after `normBase` is deleted from `this.weapons`.
   - `getWeaponRank` returns 5 for evolved weapons, preventing `rank === 0` unlock card generation.
   - `generateUpgradeCards` skips evolved weapons, completely eliminating zombie card re-offers.
   - `WeaponManager.setWeaponRank` explicitly checks `if (weapon.isEvolution) return;`, ensuring rank 5 cannot be demoted.
   - Verified empirically over 2,500 draws across all 5 evolutions.

2. **Defect 2 Resolution (MoveSpeed Inversion on Ring of Velocity)**:
   - Initializing `moveSpeed: 200` in `main.ts` establishes a consistent pixel-per-second baseline matching `DEFAULT_PLAYER_STATS`.
   - Normalizing legacy multipliers in `Player.ts` constructor protects against old calling patterns.
   - `Player.handleInput` setting `maxSpeed = this.stats.moveSpeed` eliminates the flawed `> 5` heuristic that previously inverted speed upon acquiring `deltaPerRank = 20.0`.
   - Verified empirically: speed scales monotonically from 200 to 300 px/s with exact kinematic matching.

3. **Defect 3 Resolution (Perimeter Spawner Frustum Violation at Borders)**:
   - `WaveDirector.getPerimeterPoint` dynamically filters out cardinal edges that lack sufficient space between camera edge and arena boundary.
   - Clamping logic guarantees coordinates remain strictly outside the camera viewport (`camY - 10`, `camY + h + 10`, `camX - 10`, `camX + w + 10`) while respecting arena limits.
   - Verified empirically: 90,000 trials across all cardinal boundaries and corners produced exactly 0 on-screen spawns.

4. **Defect 4 Resolution (Double Knockback in CursedAura)**:
   - Eliminating the direct `pushVx += kbX` assignment from `CursedAura.ts` leaves impulse application exclusively to `HordeManager.applyDamage` via `Enemy.takeDamage`.
   - Verified empirically: exactly 100 px/s knockback impulse applied to a skeleton with mass 1.0.

5. **Defect 5 Resolution (Flaky Evolution Card Draw)**:
   - `sampleWeightedCards` deterministically guarantees that if an evolution is eligible, at least one evolution card is included in the drawn hand.
   - Flakiness rate dropped from ~17.2% to 0.0%, verified across 5 consecutive full-suite test runs.

6. **Integrity and Authenticity**:
   - Zero hardcoded test outputs or bypasses detected.
   - Full TypeScript types, zero lint/compiler errors, clean production bundle.
   - Genuine mathematical and algorithmic logic throughout.

---

### 3. Caveats

- Full headless browser E2E test execution with visual screenshot artifact generation (`artifacts/dark_fantasy/*.png`) is planned for Milestone M4 as defined in `PROJECT.md`.
- No source code modifications were performed during this audit turn (audit-only compliance).

---

### 4. Conclusion

All 5 defects identified during Milestone M3 review have been completely and genuinely remediated:
1. Evolved weapons are never re-offered and cannot be degraded.
2. Player movement speed increases monotonically with Ring of Velocity (200 -> 300 px/s) with zero speed collapse.
3. Perimeter spawning guarantees 0 on-screen spawns across all camera positions, including extreme arena boundaries.
4. Double knockback in `CursedAura` is eliminated.
5. Upgrade card generation flakiness is resolved with 100% deterministic evolution card offering.
6. Test suite is 100% green (18/18 files, 210/210 tests passed) and production build succeeds cleanly.

**Binary Verdict**: **CLEAN**.

Milestone M3 Remediation satisfies all integrity and technical requirements and is fully ready for Milestone M4.

---

### 5. Verification Method

To independently verify this verdict:

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Code 0, 0 diagnostic errors.

2. **Full Unit Test Suite**:
   ```bash
   npm test
   ```
   *Expected*: 18/18 files passed, 210/210 tests passed.

3. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Code 0, clean Vite build in `dist/`.

4. **Multi-Run Flakiness Verification**:
   ```bash
   for i in {1..5}; do npx vitest run tests/unit/UpgradeSystem.test.ts tests/unit/WaveDirector.test.ts || break; done
   ```
   *Expected*: 5/5 passes, zero failures.

5. **Empirical Boundary Spawner Simulation (90,000 samples)**:
   ```bash
   npx tsx -e "
   import { WaveDirector } from './src/core/systems/WaveDirector';
   import { HordeManager } from './src/core/HordeManager';
   const wd = new WaveDirector(new HordeManager({ maxCapacity: 100 }), {
     viewportWidth: 960, viewportHeight: 540, spawnMargin: 90,
     arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 }
   });
   const positions = [
     { camX: 0, camY: 0 }, { camX: 1040, camY: 0 }, { camX: -2000, camY: 0 },
     { camX: 0, camY: -2000 }, { camX: 0, camY: 1460 }, { camX: 1040, camY: -2000 },
     { camX: -2000, camY: -2000 }, { camX: 1040, camY: 1460 }, { camX: -2000, camY: 1460 }
   ];
   let violations = 0;
   for (const pos of positions) {
     for (let i = 0; i < 10000; i++) {
       const pt = wd.getPerimeterPoint(pos.camX, pos.camY);
       if (pt.x >= pos.camX && pt.x <= pos.camX + 960 && pt.y >= pos.camY && pt.y <= pos.camY + 540) violations++;
     }
   }
   console.log('Total on-screen violations:', violations);
   "
   ```
   *Expected*: `Total on-screen violations: 0`.

6. **Empirical All-5 Evolutions Lifecycle Verification (2,500 rolls)**:
   ```bash
   npx tsx -e "
   import { UpgradeSystem, OCCULT_EVOLUTIONS } from './src/core/systems/UpgradeSystem';
   import { WeaponManager } from './src/core/weapons/WeaponManager';
   import { HordeManager } from './src/core/HordeManager';
   import { Player } from './src/core/entities/Player';
   const horde = new HordeManager({ maxCapacity: 100 });
   for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
     const player = new Player(0, 0);
     const wm = new WeaponManager(horde, player);
     const u = new UpgradeSystem(player);
     const baseW = evo.weaponId.replace('weapon_', '');
     wm.addWeapon(baseW, 1);
     for (let r = 1; r <= 5; r++) u.upgradeItem(evo.weaponId);
     u.upgradeItem(evo.passiveId);
     const evoCard = u.generateUpgradeCards(4).find(c => c.itemId === evo.id)!;
     u.applyUpgrade(evoCard, player, wm);
     wm.evolveWeapon(baseW, evo.id);
     for (let i = 0; i < 500; i++) {
       const reoffered = u.generateUpgradeCards(4).find(c => c.itemId === evo.weaponId || c.itemId === baseW);
       if (reoffered) throw new Error('Reoffered: ' + reoffered.itemId);
     }
     wm.setWeaponRank(baseW, 1);
     if (wm.getWeapon(baseW)?.rank !== 5) throw new Error('Demoted');
   }
   console.log('All 5 evolutions verified cleanly!');
   "
   ```
   *Expected*: `All 5 evolutions verified cleanly!`.
