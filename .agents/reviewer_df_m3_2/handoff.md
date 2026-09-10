# Milestone M3: Occult Arsenal, Upgrades & Horde Director — Review & Adversarial Challenge Report

## Review Summary

**Verdict**: **REQUEST_CHANGES**
**Overall Risk Assessment**: HIGH

Reviewer 2 performed an in-depth code audit, build and test verification, and adversarial stress-testing of Milestone M3 (`src/core/systems/UpgradeSystem.ts`, `src/ui/UpgradeModal.ts`, `src/core/systems/WaveDirector.ts`, `src/main.ts`, and `src/core/weapons/*`).

While the architecture demonstrates strong software engineering practices (zero-allocation projectile pooling, flat intrusive hit arrays, clean fixed-timestep timing resets on modal closure, and 4-phase mathematical wave scaling), adversarial testing uncovered **two Critical functional bugs** and **one Major simulation defect** that break core progression and combat gameplay:
1. **Critical Finding 1**: Base weapons are re-offered as upgrade cards after evolving, and selecting them demotes the evolved weapon from Rank 5 back to Rank 1.
2. **Critical Finding 2**: Picking up the "Ring of Velocity" passive causes the player's movement speed to drop by nearly 90% (from 200 px/s down to 21 px/s) due to stat representation mismatch in `main.ts` and `Player.ts`.
3. **Major Finding 3**: Off-screen perimeter spawning clamps inside the camera viewport when near arena boundaries, causing ~19.5% of enemies to pop directly onto the screen.

No integrity violations (hardcoded test hacks or facade dummy logic) were detected; the implementation logic is authentic and sophisticated. However, the identified defects require targeted remediation before M3 can be approved.

---

## 1. Observation

### 1.1 Tool Commands & Test Execution
1. **TypeScript Static Type Check**:
   - Command: `npx tsc --noEmit`
   - Output: Exited with code 0 (zero diagnostic errors).
2. **Unit Test Suite**:
   - Command: `npm test`
   - Initial Run: 1 failed, 15 passed (176 tests).
     - Verbatim error:
       ```
       FAIL tests/unit/HordeManager.test.ts > HordeManager & SpatialHashGrid > Suite 2 > executes 1,000 spatial queries across 1,000 enemies in < 50ms total
       AssertionError: expected 52.653041999999914 to be less than 50
        ❯ tests/unit/HordeManager.test.ts:127:31
       ```
   - Second Run: 16 passed, 176 passed in 6.73s (benchmark passed under lighter CPU load).
3. **Production Build**:
   - Command: `npm run build`
   - Output: `vite v6.4.3 building for production... ✓ built in 1.06s` (dist bundle 134.68 kB).

### 1.2 Code Inspection Observations
1. **Post-Evolution Deletion and Re-Offering in `src/core/systems/UpgradeSystem.ts`**:
   - Lines 498–509:
     ```ts
     public evolveWeapon(weaponId: string, evolutionId: string): void {
       const normBase = normalizeItemId(weaponId);
       const weapon = this.weapons.get(normBase);
       if (weapon) {
         this.weapons.delete(normBase);
         const normEvo = normalizeItemId(evolutionId);
         this.weapons.set(normEvo, {
           rank: 5,
           isEvolution: true,
           rawId: evolutionId,
         });
       }
     }
     ```
   - Lines 575–600:
     ```ts
     for (const weapon of Object.values(OCCULT_WEAPONS)) {
       const normW = normalizeItemId(weapon.id);
       const rank = this.getWeaponRank(normW);
       const isEvolved = this.isWeaponEvolved(normW);

       if (isEvolved) continue;

       if (rank > 0 && rank < 5) {
         // ...
       } else if (rank === 0 && canAddWeapon) {
         candidates.push({
           id: `${weapon.id}_unlock`,
           itemId: weapon.id,
           name: weapon.name,
           subtitle: 'NEW WEAPON',
           category: 'weapon',
           type: UpgradeType.WEAPON_UNLOCK,
           // ...
         });
       }
     }
     ```
   - Lines 767–771:
     ```ts
     if (card.category === 'weapon') {
       this.upgradeItem(card.itemId);
       weaponManager?.setWeaponRank?.(card.itemId, card.newRank);
       return;
     }
     ```
   - In `src/core/weapons/WeaponManager.ts` lines 134–142:
     ```ts
     public setWeaponRank(id: string, rank: number): void {
       const normId = normalizeWeaponId(id);
       let weapon = this.getWeapon(normId);
       if (!weapon) {
         this.addWeapon(normId, rank);
       } else {
         weapon.rank = rank;
       }
     }
     ```

2. **Player Movement Speed Stat Mismatch**:
   - In `src/main.ts` lines 66–72:
     ```ts
     this.player = new Player(0, 0, {
       maxHealth: 100,
       currentHealth: 100,
       moveSpeed: 1.0, // <-- Initialized as 1.0
       armor: 0,
       magnetRadius: 100,
     });
     ```
   - In `src/core/entities/Player.ts` lines 128–130:
     ```ts
     const maxSpeed = (this.stats.moveSpeed > 5 ? this.stats.moveSpeed : Player.BASE_MOVE_SPEED * this.stats.moveSpeed);
     const targetVx = dirX * maxSpeed;
     const targetVy = dirY * maxSpeed;
     ```
   - In `src/core/systems/UpgradeSystem.ts` lines 91–97:
     ```ts
     passive_velocity: {
       id: 'passive_velocity',
       name: 'Ring of Velocity',
       icon: 'ring',
       stat: 'moveSpeed',
       deltaPerRank: 20.0, // +10% base speed (base 200)
     ```

3. **Perimeter Spawning Boundary Clamping**:
   - In `src/core/systems/WaveDirector.ts` lines 240–277:
     ```ts
     case 3: // East
     default:
       x = camX + w + m + Math.random() * 60;
       y = camY - 60 + Math.random() * (h + 120);
       break;
     // ...
     outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(this.arenaBounds.maxX - 20, x));
     outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(this.arenaBounds.maxY - 20, y));
     ```
   - Camera bounds in `src/main.ts`: `minX: -2000, maxX: 2000, minY: -2000, maxY: 2000`.
   - Viewport: `w = 960, h = 540`.
   - Maximum camera X: `2000 - 960 = 1040`.

---

## 2. Logic Chain

### 2.1 Post-Evolution Base Weapon Re-Offering & Degradation (Critical Finding 1)
1. When a player evolves a weapon (e.g. `Arcane Scythe` into `Soul Reaping Harvester`), `UpgradeSystem.evolveWeapon` executes `this.weapons.delete('weapon_scythe')` and adds `'soul_reaping_harvester'`.
2. On subsequent level-ups, `UpgradeSystem.generateUpgradeCards` iterates through `OCCULT_WEAPONS`. For `weapon_scythe`, `this.getWeaponRank('weapon_scythe')` returns `0`, and `this.isWeaponEvolved('weapon_scythe')` returns `false` because `'weapon_scythe'` is no longer in `this.weapons`.
3. Because the player still has available weapon slots (< 6), the condition `rank === 0 && canAddWeapon` evaluates to `true`.
4. `UpgradeSystem` generates `Arcane Scythe [NEW WEAPON]` and offers it to the player.
5. If chosen, `applyUpgrade` invokes `weaponManager.setWeaponRank('weapon_scythe', 1)`.
6. In `WeaponManager`, `normalizeWeaponId('weapon_scythe')` resolves to `'scythe'`. The weapon object at `'scythe'` is the existing evolved weapon instance.
7. `weaponManager.setWeaponRank` directly mutates `weapon.rank = 1`.
8. Empirical test confirmed:
   ```
   Applying evolution: Soul Reaping Harvester
   After evolution: has weapon_scythe? false
   WM scythe isEvolution: true rank: 5
   ...
   BUG DETECTED: Arcane Scythe re-offered after evolution!
   WM scythe after re-upgrade: isEvolution: true rank: 1
   ```
   The evolved weapon is permanently degraded to Rank 1 stats, and an extra duplicate base weapon entry is created in `UpgradeSystem`.

### 2.2 Player MoveSpeed Inversion (Critical Finding 2)
1. `src/main.ts` initializes `Player` with `moveSpeed: 1.0`.
2. `Player.handleInput` uses a heuristic: `this.stats.moveSpeed > 5 ? this.stats.moveSpeed : Player.BASE_MOVE_SPEED * this.stats.moveSpeed`.
   - Initially, `1.0 <= 5`, so `maxSpeed = 200 * 1.0 = 200 px/s`.
3. When the player acquires `Ring of Velocity` Rank 1, `UpgradeSystem.applyPassiveStats` adds `20.0` to `player.stats.moveSpeed`, changing it to `21.0`.
4. On the next tick in `Player.handleInput`, `this.stats.moveSpeed > 5` evaluates to `true` (`21.0 > 5`).
5. `maxSpeed` is set directly to `21.0 px/s` instead of `220 px/s`.
6. Empirical test confirmed:
   ```
   Initial velocity X after 1s: 200
   Player moveSpeed stat: 21
   Velocity X with Ring of Velocity Rank 1: 21
   ```
   The player moves 10x slower as soon as they acquire the speed-enhancing passive relic.

### 2.3 Boundary Perimeter Spawning Frustum Invasion (Major Finding 3)
1. `Camera` clamps at `arenaBounds.maxX - viewportWidth = 2000 - 960 = 1040`.
2. When the player navigates to the right boundary, `camX = 1040`. The camera viewport renders world coordinates from `x = 1040` to `x = 2000`.
3. `WaveDirector.getPerimeterPoint` picks edge 3 (East), calculating `x = camX + w + m = 1040 + 960 + 90 = 2090`.
4. The method clamps `x` to `arenaBounds.maxX - 20 = 1980`.
5. Since `1980` is between `1040` and `2000`, the enemy spawns 20 pixels inside the visible viewport on screen.
6. Empirical Monte Carlo simulation of 1,000 spawns at `camX = 1040` confirmed:
   ```
   On-screen spawns at arena boundary: 195 / 1000 (19.5% failure rate)
   ```
   This directly violates the architectural contract for off-screen perimeter spawning.

---

## 3. Findings & Detailed Recommendations

### Finding 1: Base Weapon Re-Offer & Rank Demotion After Evolution [CRITICAL]
- **Where**: `src/core/systems/UpgradeSystem.ts:498-509, 575-600` and `src/core/weapons/WeaponManager.ts:134-151`.
- **Why**: Re-offering evolved base weapons clutters the upgrade pool with invalid options and resets the evolved weapon's rank to 1 upon selection.
- **Suggestion**:
  1. In `UpgradeSystem.ts`, do not completely purge base weapon ownership. Either retain an `isEvolved: true` record for `normBase`, or in `generateUpgradeCards`, inspect `OCCULT_EVOLUTIONS` to see if any evolution of `weapon.id` is currently owned (`this.hasWeapon(evo.id)`). If so, do not add `weapon_unlock` to candidates.
  2. In `WeaponManager.ts`, update `setWeaponRank` to prevent resetting `weapon.rank` if `weapon.isEvolution` is `true`.

### Finding 2: MoveSpeed Drop from 200 px/s to 21 px/s on Ring of Velocity [CRITICAL]
- **Where**: `src/main.ts:69`, `src/core/entities/Player.ts:128`, and `src/core/systems/UpgradeSystem.ts:96`.
- **Why**: `main.ts` supplies `moveSpeed: 1.0` as a multiplier, but `UpgradeSystem` applies `deltaPerRank: 20.0` as a flat pixel increment. The threshold check `> 5` flips from multiplier mode to pixel mode, reducing player speed by 89.5%.
- **Suggestion**:
  - In `src/main.ts:69`, initialize `moveSpeed: 200` (matching `DEFAULT_PLAYER_STATS.moveSpeed`), OR update `Player.ts` so `moveSpeed` is strictly an additive flat or percentage multiplier without the ambiguous `> 5` ternary.

### Finding 3: Perimeter Spawner Infiltrates Camera Viewport at Arena Edges [MAJOR]
- **Where**: `src/core/systems/WaveDirector.ts:240–278`.
- **Why**: Clamping raw perimeter points to the arena boundary forces points back into the camera frustum when the camera itself is resting at that boundary.
- **Suggestion**:
  - In `WaveDirector.getPerimeterPoint`, check if the clamped candidate point lies within `[camX, camX + viewportWidth] x [camY, camY + viewportHeight]`. If it does, pick an alternate unblocked cardinal edge (e.g. if East is blocked by the boundary, spawn from North, South, or West). Alternatively, ensure `arenaBounds` in the director has a buffer margin of at least `spawnMargin + 100` beyond camera limits.

### Finding 4: Handoff Report Passive Names Discrepancy [MINOR]
- **Where**: `.agents/worker_df_m3_1/handoff.md:16`.
- **Why**: Worker handoff text cited "Boots of Celerity, Chrono Hourglass, Eldritch Compass", whereas the codebase implements "Ring of Velocity, Eldritch Magnet, Obsidian Armor" matching `PROJECT.md`.
- **Suggestion**: Ensure worker documentation accurately reflects the implemented identifiers.

### Finding 5: Timing Benchmark Flakiness in HordeManager Test [MINOR]
- **Where**: `tests/unit/HordeManager.test.ts:127`.
- **Why**: `expect(queryDurationMs).toBeLessThan(50)` intermittently failed at 52.65ms when run in parallel with heavy benchmarks.
- **Suggestion**: Relax the benchmark threshold to 75ms or isolate performance benchmarks to separate non-parallel suites.

---

## 4. Verified Claims

| Claim from Worker Handoff | Verification Method | Result | Notes |
| :--- | :--- | :--- | :--- |
| Zero diagnostic TypeScript errors | `npx tsc --noEmit` | **PASS** | Exit code 0 |
| Production build passes | `npm run build` | **PASS** | Vite bundle generated cleanly |
| 5 Passives across ranks 1–5 | Source inspection of `UpgradeSystem.ts` | **PASS** | All 5 passives defined with rank descriptions and stat deltas |
| 5 Weapons across ranks 1–5 | Source inspection of `Weapon.ts` & subclasses | **PASS** | All 5 weapons implement scaling rank stats |
| 5 Evolutions require Rank 5 + Passive | Source inspection & test execution | **PASS** | Checked via `isEvolutionEligible` |
| 6-weapon and 6-passive slot limits | Unit test suite | **PASS** | Limits enforced |
| Zero-garbage projectile pooling | Source inspection of `Projectile.ts` | **PASS** | Swap-and-pop, `Int16Array` intrusive hit tracking |
| Pause / resume timing reset in `main.ts` | Source inspection of `main.ts:133-135` | **PASS** | Resets `lastTime` and sets `accumulator = 0` |
| Post-evolution card pool cleanliness | Adversarial simulation script | **FAIL** | Evolved base weapon re-offered and degrades rank |
| Passive velocity speed scaling | Adversarial simulation script | **FAIL** | Speed drops from 200 to 21 px/s |
| Strict off-screen perimeter spawning | Monte Carlo boundary simulation | **FAIL** | 19.5% spawns breach viewport at arena borders |

---

## 5. Caveats

- Playwright browser E2E test execution was not run during this unit review turn, as full headless browser playtesting and visual screenshot artifact generation are designated for Milestone M4.
- Rendering quality on canvas 2D context was verified structurally and mathematically; visual appearance will be evaluated via Playwright screenshot captures in M4.

---

## 6. Conclusion

The foundational architecture for Milestone M3 is structurally sound, clean, and completely free of dummy facades or hardcoded cheating. However, the three identified bugs (post-evolution re-offering, movement speed reduction, and boundary perimeter frustum invasion) directly degrade gameplay and progression.

Therefore, the verdict is **REQUEST_CHANGES**. Worker agent must address the remediation items in Findings 1, 2, and 3.

---

## 7. Verification Method

To independently verify all findings and confirm remediation:
1. **Verify TypeScript & Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
2. **Reproduce Post-Evolution Re-Offer Bug**:
   ```bash
   npx tsx -e "
   import { UpgradeSystem, UpgradeType } from './src/core/systems/UpgradeSystem';
   import { WeaponManager } from './src/core/weapons/WeaponManager';
   import { HordeManager } from './src/core/HordeManager';
   import { Player } from './src/core/entities/Player';

   const p = new Player(0, 0);
   const wm = new WeaponManager(new HordeManager({ maxCapacity: 100 }), p);
   wm.addWeapon('scythe', 1);
   const u = new UpgradeSystem(p);
   u.addWeapon('weapon_scythe', 5);
   u.addPassive('passive_chalice', 1);

   let evoCard;
   while (!evoCard) {
     const cards = u.generateUpgradeCards(4);
     evoCard = cards.find(c => c.type === UpgradeType.WEAPON_EVOLUTION);
   }
   u.applyUpgrade(evoCard, p, wm);

   for (let i = 0; i < 10; i++) {
     const nextCards = u.generateUpgradeCards(3);
     const reoffer = nextCards.find(c => c.itemId === 'weapon_scythe');
     if (reoffer) {
       console.log('BUG CONFIRMED: Arcane Scythe re-offered after evolution!');
       u.applyUpgrade(reoffer, p, wm);
       console.log('Demoted rank:', wm.getWeapon('scythe')?.rank);
       break;
     }
   }
   "
   ```
3. **Reproduce MoveSpeed Reduction Bug**:
   ```bash
   npx tsx -e "
   import { Player } from './src/core/entities/Player';
   import { UpgradeSystem } from './src/core/systems/UpgradeSystem';

   const player = new Player(0, 0, { maxHealth: 100, currentHealth: 100, moveSpeed: 1.0, armor: 0, magnetRadius: 100 });
   player.handleInput({ up: false, down: false, left: false, right: true }, 1.0);
   const speedBefore = player.velocity.x;

   const u = new UpgradeSystem(player);
   u.upgradeItem('passive_velocity');
   player.velocity.x = 0;
   player.handleInput({ up: false, down: false, left: false, right: true }, 1.0);
   const speedAfter = player.velocity.x;

   console.log('Speed before:', speedBefore, 'Speed after:', speedAfter);
   "
   ```
4. **Reproduce Boundary Perimeter Spawning Bug**:
   ```bash
   npx tsx -e "
   import { WaveDirector } from './src/core/systems/WaveDirector';
   import { HordeManager } from './src/core/HordeManager';

   const wd = new WaveDirector(new HordeManager({ maxCapacity: 100 }), {
     viewportWidth: 960, viewportHeight: 540, spawnMargin: 90,
     arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 }
   });
   let count = 0;
   for (let i = 0; i < 1000; i++) {
     const pt = wd.getPerimeterPoint(1040, 0);
     if (pt.x >= 1040 && pt.x <= 2000 && pt.y >= 0 && pt.y <= 540) count++;
   }
   console.log('On-screen spawns at boundary:', count, '/ 1000');
   "
   ```
