# Handoff Report — Milestone M2: Empirical Challenge (Destructibles, Mid-Boss & Combat Interactions)

## 1. Observation

### A. Test Execution Results
- **Vitest Unit Suite**:
  - Command: `npx vitest run`
  - Output: `40 passed (40)` test files, `559 passed (559)` tests (100% green). Duration: 2.89s.
  - Critical unit invariant suites verified passing:
    - `tests/unit/terrain_and_obstacles.test.ts` (16 passed)
    - `tests/unit/boss_crisis_events.test.ts` (10 passed)
    - `tests/unit/adversarial_m1_camera_arenas_spawner.test.ts` (17 passed)
    - `tests/unit/adversarial_m2_platform_physics_challenge.test.ts` (28 passed)
    - `tests/unit/adversarial_m2_overhaul_2_challenger.test.ts` (15 passed)
- **TypeScript & Production Build**:
  - Command: `npx tsc --noEmit && npm run build`
  - Output: Exit code 0, 0 type errors. Production bundle built in 293ms (`dist/assets/index-BcLqCI5_.js`, 268.46 kB).
- **Playwright Controls E2E Suite**:
  - Command: `npx playwright test tests/e2e/gameplay_controls.spec.ts`
  - Output: 5 passed in 4.3s (Jump Spacebar, Jump KeyK, Movement ArrowKeys, Movement WASD, Combined air mobility).
- **Playwright Full E2E Suite**:
  - Command: `npx playwright test`
  - Output: 28 passed, 1 failed (total 29 tests, 15.1s).
  - Verbatim failure:
    ```
    1) [chromium] › tests/e2e/ultimate_and_crisis_expansion.spec.ts:326:5 › Milestone M4: Ultimate Move, Crisis Boss & Ally Expansion E2E Suite › Scenario 2: Crisis Boss Encounter & Multi-Phase Mechanics › 2.1: Mid-Boss Vehicle triggers and locks camera during Section 1 battle 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 1200
    Received: 1820
      353 |       expect(midBossStatus.stageState).toBe('MID_BOSS_BATTLE');
      354 |       expect(midBossStatus.boundsMinX).toBe(720);
    > 355 |       expect(midBossStatus.boundsMaxX).toBe(1200);
          |                                        ^
      356 |     });
    ```

### B. Destructible Obstacles Empirical Observations
- `src/core/entities/obstacles/DestructibleObstacle.ts:47-70`:
  - `SANDBAG_BARRICADE`: Default health = 20, blastRadius = 0, blastDamage = 0.
  - `SUPPLY_CRATE`: Default health = 8, dropItem = `ItemDropType.WEAPON_HMG`.
  - `EXPLOSIVE_BARREL`: Default health = 10, blastRadius = 54, blastDamage = 10.
- `src/core/entities/obstacles/DestructibleObstacle.ts:75-92`:
  - `takeDamage` subtracts damage amount, emits `sfx_bullet_hit`, and when `health <= 0` clamps health at 0 and invokes `destroy(engine)`. Dead obstacles ignore subsequent hits.
- `src/core/entities/obstacles/DestructibleObstacle.ts:173-190`:
  - Non-piercing projectiles (`pierces: false`) deal damage and are consumed (`bullet.isAlive = false`). Piercing projectiles survive (`bullet.isAlive = true`).
  - Grenades detonate immediately upon contact via `grenade.detonate(engine)` and deal 10 damage to the obstacle.
- `src/core/entities/obstacles/DestructibleObstacle.ts:129-140`:
  - `SUPPLY_CRATE` drops `ItemPickup` with ID `drop_${this.id}` at `(bounds.x + bounds.width / 2, bounds.y)` with initial upward impulse `{ x: 0, y: -120 }`.
  - Player touching the dropped item triggers `PlayerController.onCollision` -> `WeaponManager.applyItemPickup`, granting the weapon (e.g. HMG with 200 ammo).
- `src/core/entities/obstacles/DestructibleObstacle.ts:110-128, 151-168`:
  - `EXPLOSIVE_BARREL` emits `explosion_spawned` (radius 54, damage 10, isLarge: true), `screen_shake` (amplitude 6.0, duration 14 frames), `play_sound` (`sfx_grenade_explosion`).
  - Mathematical boundary oracle in `adversarial_m2_overhaul_2_challenger.test.ts`:
    - Distance 0.0px (center) -> 10 damage.
    - Distance 27.0px (half radius) -> 10 damage.
    - Distance 53.0px (inside) -> 10 damage.
    - Distance 53.9px (inside) -> 10 damage.
    - Distance 54.0px (exact boundary) -> 10 damage.
    - Distance 54.1px (outside) -> 0 damage.
    - Distance 55.0px (outside) -> 0 damage.
    - Distance 80.0px (outside) -> 0 damage.
  - Chain reaction issue: `DestructibleObstacle.dealAreaDamage` calls `(ent as any).takeDamage(this.blastDamage, 'explosion', { x: centerX, y: centerY })`. If the secondary barrel's `engineRef` has not been initialized via `update` or `onCollision`, `takeDamage` receives no engine, resulting in `const eng = engine ?? this.engineRef;` being null. Thus, the secondary barrel explodes locally but skips area damage and event emissions.

### C. Mid-Boss Patrol & 1100px Arena Camera Bounds Observations
- `src/main.ts:850-862`:
  - Mid-Boss trigger at `triggerX: 740` sets `lockCameraBounds: { minX: 720, maxX: 1820, minY: 0, maxY: 540 }`. Arena width = `1820 - 720 = 1100px`.
  - MidBossVehicle instantiated with `patrolMinX: 800, patrolMaxX: 1650`, width = 130px.
- `src/render/Camera.ts:207-215`:
  - In 960x540 viewport, camera.x is clamped between `720` and `1820 - 960 = 860`. Visible screen world space spans `[720, 1820]`.
- `src/core/entities/enemies/MidBossVehicle.ts:288-296`:
  - In Phase 1 and Phase 2, `position.x` patrols between `800` and `1650`.
  - Left bound: `position.x = 800 >= 720`.
  - Right bound: `position.x + width = 1650.75 + 130 = 1780.75 <= 1820` (accounting for 0.75px/tick discrete Euler step).
  - Mid-Boss stays strictly within camera bounds throughout Phase 1 and 2.
- `src/core/entities/enemies/MidBossVehicle.ts:401-409`:
  - In Phase 3 (Ramming), turnaround points are `patrolMinX - 50 = 750` and `patrolMaxX + 50 = 1700`.
  - At right turnaround: `1700 + 130 = 1830px`. This extends 10px past `lockCameraBounds.maxX = 1820px`.

---

## 2. Logic Chain

1. **Destructible Obstacles System Integrity**:
   - `DestructibleObstacle` properly depletes HP across multiple discrete hits and clamps at 0 upon overkill.
   - Non-piercing bullets are absorbed (`bullet.isAlive = false`) and grenades detonate immediately upon contact.
   - Supply crates drop items with upward velocity `vy = -120` that are collected by the player to equip weapons and replenish ammo.
   - Explosive barrels strictly respect the 54px Euclidean radius (damage dealt at `<= 54.0px`, zero damage at `>= 54.1px`) and deal 10 damage with screen shake amplitude 6.0 and explosion events.
2. **Chain Reaction Robustness**:
   - When a barrel explodes, `dealAreaDamage` invokes `takeDamage(10, 'explosion', {x, y})`. In `DestructibleObstacle.takeDamage`, `engine` is resolved by checking if `args[0]` or `args[1]` has `eventBus`/`emit`, falling back to `this.engineRef`. Because `args[0]` is `'explosion'` (string) and `args[1]` is `{x, y}` (vector), if a secondary barrel has not yet executed `update(dt, engine)`, `this.engineRef` is null, preventing the secondary barrel from propagating its blast to surrounding entities.
3. **Mid-Boss Arena & Camera Bounds**:
   - In Milestone M1/M2, the stage design was upgraded from the legacy 480x270 viewport (where mid-boss arena was `[720..1200]`, 480px width) to modern 16:9 widescreen HD 960x540 with an expanded 1100px arena (`[720..1820]`).
   - Mid-boss vehicle patrols up to 1650 without exceeding camera bounds during Phase 1 and Phase 2 (`bounds.x + width = 1780.75 <= 1820`).
   - In Phase 3 ramming, turnaround occurs at `position.x >= patrolMaxX + 50 = 1700`, reaching `1830px` (10px past the 1820 camera maxX).
4. **Playwright E2E Suite Failure**:
   - While `gameplay_controls.spec.ts` passes 5/5 and 28 out of 29 Playwright tests pass, `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355` explicitly asserts the legacy bound `expect(midBossStatus.boundsMaxX).toBe(1200);`.
   - Because `lockCameraBounds.maxX` in `src/main.ts:853` was correctly updated to `1820` for the 1100px arena, this test fails with `Expected: 1200, Received: 1820`.
   - Per `PROJECT.md` and `COLLABORATION.md`, the acceptance criterion requires a 100% green test suite (Vitest and Playwright).

---

## 3. Caveats

- In headless unit tests, `DestructibleObstacle` chain reactions require obstacles to be updated with `engineRef` or have `engine` passed directly.
- The 10px overhang in Phase 3 ramming occurs only at the right turnaround boundary (`1830px` vs `1820px`) and lasts for less than 1 second before charging back towards the player.
- The failure in `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355` is caused by a stale assertion expectation (`1200` vs `1820`) rather than a defect in the game engine or level layout.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

While all core M2 features (DestructibleObstacle depletion, bullet absorption, supply crate drops, 54px blast radius / 10 damage oracle, continuous Y=230 ground, and Phase 1/2 mid-boss patrol up to 1650) are functioning correctly and all 40 Vitest unit test files (559 tests) pass 100% green, changes are requested for the following 3 items to achieve full production quality and 100% green E2E test compliance:

### Required Changes:
1. **Update Stale E2E Assertion**:
   - File: `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355`
   - Change `expect(midBossStatus.boundsMaxX).toBe(1200);` to `expect(midBossStatus.boundsMaxX).toBe(1820);` (or `toBeGreaterThanOrEqual(1200)` and `toBe(1820)`), aligning the test with the M1/M2 1100px arena contract (`1820 - 720 = 1100`).
2. **Harden Obstacle Area Damage for Secondary Cascades**:
   - File: `src/core/entities/obstacles/DestructibleObstacle.ts:162`
   - In `dealAreaDamage`, pass `engine` so secondary obstacles receive the engine reference during chain reactions:
     `(ent as any).takeDamage(this.blastDamage, engine, 'explosion', { x: centerX, y: centerY });`
3. **Clamp Mid-Boss Phase 3 Ramming Bound to Camera maxX**:
   - File: `src/core/entities/enemies/MidBossVehicle.ts:405`
   - Change turnaround from `patrolMaxX + 50` (1700) to `Math.min(patrolMaxX + 50, 1820 - this.width)` (1690), ensuring the vehicle never extends beyond 1820px even during desperate ramming.

---

## 5. Verification Method

Execute the following commands from `/Users/user/teamwork_projects/metal_slug_web`:

1. **Vitest Unit & Empirical Suite**:
   ```bash
   npx vitest run tests/unit/adversarial_m2_overhaul_2_challenger.test.ts
   npx vitest run tests/unit/terrain_and_obstacles.test.ts
   npx vitest run tests/unit/boss_crisis_events.test.ts
   npx vitest run
   ```
   - Must pass all 40 test files and 559 tests with 0 failures.

2. **TypeScript & Build Verification**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
   - Must complete with exit code 0 and 0 compilation errors.

3. **Playwright E2E Verification**:
   ```bash
   npx playwright test tests/e2e/gameplay_controls.spec.ts
   npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts
   npx playwright test
   ```
   - `gameplay_controls.spec.ts`: 5/5 passed.
   - `ultimate_and_crisis_expansion.spec.ts`: Observe failure at line 355 (`Expected: 1200, Received: 1820`). Once updated to 1820, all 29 tests must pass 100% green.
