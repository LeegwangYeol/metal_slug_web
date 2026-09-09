# Handoff Report: Allies, Items, and Ultimate Move Expansion Survey

- **Agent**: `survey_explorer_allies_items`
- **Role**: Teamwork Explorer
- **Date**: 2026-09-04
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_allies_items`

---

## 1. Observation

1. **Current Test Status & Baseline Health**:
   - Ran `npm test` (`vitest run`).
   - Verbatim test output:
     ```
     Test Files  24 passed (24)
          Tests  294 passed (294)
       Duration  10.15s
     ```
   - 100% green across all 24 test suites with zero regressions.

2. **Entity Architecture Invariant (`src/core/engine/GameEngine.ts`)**:
   - `GameEngine` manages entities via `Map<string, GameEntity>` and `SpatialGrid<GameEntity>`.
   - Lines 179-184: Pending additions queued in `entitiesToAdd` and inserted into the spatial grid at tick start.
   - Lines 216-231: Narrowphase collision detection queries `spatialGrid.query(entity.bounds)` and calls `entity.onCollision(other, this)`.
   - Any new entity (such as `AllyNPC`, `AllyKiBlast`, or `PlayerRocketProjectile`) that implements `GameEntity` integrates seamlessly without modifying core engine physics.

3. **Item Pickup Mechanism (`src/core/player/PlayerController.ts` lines 570-578 & `src/core/weapons/WeaponManager.ts` lines 243-273)**:
   - `PlayerController.onCollision`:
     ```ts
     if (other.type === 'ITEM_PICKUP') {
       const dropType = (other as any).dropType as ItemDropType;
       if (dropType) {
         this.weaponManager.applyItemPickup(dropType, engine);
         (other as any).isAlive = false;
       }
     }
     ```
   - Currently, `ItemDropType` handles only `WEAPON_HMG`, `WEAPON_FLAME`, `GRENADE_CRATE`, and 4 score items.
   - Player health is currently fixed (`health = 1.0`, `maxHealth = 1.0`). `takeDamage` has no shield absorption logic.

4. **Weapons & Projectile Dispatch (`src/core/weapons/`)**:
   - `WeaponTypes.ts` defines `WeaponType = 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT'`.
   - `ProjectileManager.ts` lines 127-172: In `BulletProjectile.onCollision`:
     ```ts
     if (typeStr === 'PLAYER' || typeStr === 'PROJECTILE' || typeStr === 'GRENADE') {
       return;
     }
     ```
     Friendly fire is guarded by string type matching.
   - Flame Shot already demonstrates piercing tick immunity (`targetImmunityMap`, 6 frames = 0.1s tick interval), providing an exact reference pattern for Laser Gun beam piercing.

5. **Input Pipeline (`src/input/KeyboardController.ts` & `src/core/player/PlayerKinematics.ts`)**:
   - `KeyboardController.ts` lines 64-94: `codeMap` maps movement, fire (`KeyJ`, `KeyZ`), jump (`Space`, `KeyK`, `KeyX`), grenade (`KeyL`, `KeyC`), and pause (`Enter`, `Escape`).
   - `PlayerInputSnapshot` lines 38-48: Lacks an edge-detected `ultimatePressed` field.

6. **Target & Casualty Events (`src/core/entities/enemies/SoldierEnemy.ts` lines 1158-1186)**:
   - Enemies emit `enemy_death` event with `deathType: 'standard' | 'explosion' | 'fire'`.
   - Normalization already maps `'explosion' | 'grenade'` to `'explosion'`, triggering high-arc ballistic corpse launch with flying Stahlhelm helmets in `DeathCorpseManager`.

---

## 2. Logic Chain

1. **Autonomous Ally NPCs**:
   - From **Observation 2**, `GameEngine` is decoupled from player input and processes all `GameEntity` instances independently in its 60Hz tick.
   - By creating `AllyNPC` implementing `GameEntity`, the entity will update every tick regardless of player actions.
   - From **Observation 4**, `BulletProjectile` ignores entities based on `typeStr`. By assigning `type: 'ALLY_PROJECTILE'` to `AllyKiBlast` and making it ignore `PLAYER` and `ALLY_NPC`, it will damage only enemy entities (`SOLDIER_*`, `MID_BOSS_*`, `BOSS_*`).
   - Implementing target acquisition as a distance and threat-weighted search across `engine.getAllEntities()` gives the ally full autonomy to acquire and destroy enemies without player input.

2. **Diverse Items & Power-ups**:
   - From **Observation 3**, item pickup dispatch routes through `applyItemPickup(dropType, engine)`.
   - Extending `ItemDropType` with `WEAPON_SHOTGUN`, `WEAPON_LASER`, `WEAPON_ROCKET`, `MEDKIT`, and `SHIELD` allows POWs and loot drops to grant new capabilities via the existing collision event flow.
   - For `SHOTGUN`: Spawning 7 pellets with angular spread $\theta_i \in [-14^\circ, +14^\circ]$ and short lifetime (0.18s) gives the authentic close-range blast.
   - For `LASER_GUN`: Using the piercing tick-immunity pattern observed in Flame Shot (**Observation 4**) allows continuous 1200 px/s beams to penetrate multiple aligned enemies without duplicate single-frame damage bugs.
   - For `ROCKET_LAUNCHER`: Steering angular kinematics ($\omega = 3.5\text{ rad/s}$) and a 48px explosive blast AOE create a satisfying homing missile.
   - For `MEDKIT` & `SHIELD`: Adding `shieldCharges` to `PlayerController` and checking it inside `takeDamage` before HP subtraction prevents damage and lives loss.

3. **Ultimate Move Mechanic**:
   - From **Observation 5**, adding `KeyU: 'ultimate'` to `KeyboardController` and `ultimatePressed` to `PlayerInputSnapshot` provides dedicated activation input without conflicting with existing controls.
   - From **Observation 6**, enemy casualties caused by explosion damage trigger `deathType = 'explosion'` with flying helmets.
   - An `UltimateManager` executing a 4-phase cinematic sequence (Freeze & Siren $\to$ Strike Pass $\to$ Detonation $\to$ Recovery) can query all entities within the active camera frustum $[x_{cam} - 20, x_{cam} + 500]$ and dispatch fatal 999 damage to standard soldiers and 120 HP burst damage to bosses, satisfying the screen-clearing contract.

4. **Automated Unit & E2E Testing**:
   - From **Observation 1**, the Vitest harness executes headless simulation in $< 11$ seconds. Dedicated test files (`allies_system.test.ts`, `diverse_weapons_items.test.ts`, `ultimate_move_system.test.ts`) can assert all kinematics and state transitions headlessly at 60Hz.
   - Playwright browser tests can simulate pressing `KeyU` and assert that on-screen enemy counts drop to 0 while capturing visual screenshots to `artifacts/expansion/`.

---

## 3. Caveats

- **Key Mapping Precedence**: `KeyX` was historically mapped to `jump` alongside `Space` and `KeyK` in `KeyboardController.ts`. To prevent breaking jump tests or player habits, `KeyU` is established as the primary Ultimate Move key, while `KeyX` can optionally be aliased if jump is reconfigured.
- **Boss Meltdown Invulnerability**: When the Tetsuyuki Boss enters `PHASE_1 -> PHASE_2` or `PHASE_2 -> PHASE_3`, it clamps health to phase thresholds (65% and 30%). An Ultimate Move triggered during Phase 1 will cleanly reduce Boss HP to the 65% threshold (triggering Phase 2), preventing phase sequence skipping.
- **Visual Asset Rendering**: The project utilizes procedural pixel-art canvas drawing (`ProceduralSpriteFactory.ts`). All new sprites (Hyakutaro, Ki Blast, Shotgun, Laser, Rocket, Medkit, Shield, Bomber/SV-001) will be generated procedurally rather than loading external binary image files.

---

## 4. Conclusion

The existing simulation and presentation layers are exceptionally clean, decoupled, and primed for this expansion. The architecture for Autonomous Ally NPCs, Diverse Items/Power-ups, and the Ultimate Move mechanic has been completely mapped out in `analysis.md` with:
- Exact class hierarchies (`AllyNPC`, `AllyKiBlast`, `AllyManager`, `UltimateManager`).
- Mathematical models for spread fans, homing kinematics, tethering, and screen-clearing queries.
- Concrete file inventories covering 9 new files and modifications to 11 existing files.
- Comprehensive test specifications ensuring 100% test verification and zero regressions.

---

## 5. Verification Method

1. **Verify Baseline Test Suite**:
   ```bash
   cd /Users/user/teamwork_projects/metal_slug_web
   npm test
   ```
   *Expectation*: 24 test files passed, 294 tests passed, 0 failures.

2. **Inspect Survey Artifacts**:
   - Confirm analysis report existence and completeness:
     ```bash
     ls -la /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_allies_items/analysis.md
     ```
   - Verify all sections (Subsystems 1-3, Mathematical Models, File Inventories, Test Plans) are present.

3. **Invalidation Conditions**:
   - If `AllyNPC` requires player keyboard input to acquire targets or fire, this violates autonomous companion requirements.
   - If Shotgun does not apply kinetic knockback or Laser does not pierce, weapon mechanics are invalid.
   - If Ultimate Move does not eliminate all on-screen standard minions or fails to damage bosses, the screen-clearing acceptance criterion is violated.
