# Handoff Report: Boss & Crisis Event Architecture Survey

**Agent**: `survey_explorer_boss`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss`  
**Milestone**: Boss and Crisis Event Architecture Survey (Metal Slug Web Massive Expansion)  
**Date**: 2026-09-04  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Current Boss Entities**:
   - `src/core/entities/boss/BossTypes.ts` (lines 8-28): Defines `BossPhase` strictly for `TetsuyukiBoss` (`PHASE_1_ARTILLERY`, `PHASE_2_LASER_SWEEP`, `PHASE_3_MELTDOWN`, `DEATH_EXPLODING`, `DESTROYED`) and contract `BossEntity` with `health`, `maxHealth`, `turretsAlive`, `weakPointExposed`, `weakPointBox`, `takeDamage()`.
   - `src/core/entities/boss/TetsuyukiBoss.ts` (lines 201-715): Boss is rebalanced to 400 HP (lines 207, 265). Multi-phase state machine transitions at fixed 65% (260 HP) and 30% (120 HP). Burst-damage clamping protects phase transitions (lines 693, 702). Attacks include `TetsuyukiArtilleryShell` (line 393), `TetsuyukiHomingMissile` (line 412), `laserFloorHitbox` (line 458), and `TetsuyukiShockwave` (line 532).
   - `src/core/entities/enemies/MidBossVehicle.ts` (lines 92-148): Iron Technical armored half-track tank (320 HP) with 360° turret, `CannonShell`, and infantry deployment.

2. **Stage Progression & Camera Lockdown**:
   - `src/core/engine/StageManager.ts` (lines 15-29, 89-116): Controls `CameraBounds = { minX, maxX, minY, maxY }`. `lockCamera(bounds)` locks camera.
   - `src/main.ts` (lines 800-819): End-boss trigger locks camera bounds to `{ minX: 1800, maxX: 2280, minY: 0, maxY: 270 }` (width 480px) and spawns `TetsuyukiBoss` at `x = 2050, y = 70`.
   - `src/main.ts` (line 269): `this.camera.bounds = { ...stageBounds };` synchronizes camera bounds from `StageManager` every tick.

3. **Platform Management**:
   - `src/core/engine/GameEngine.ts` (lines 77, 108-118): Only provides `setPlatforms(platforms)` and `addPlatform(platform)`. It does NOT have a `removePlatform(id)` method.
   - `src/core/engine/StageManager.ts` (lines 66, 195-197): Loads initial platforms into engine, but has no API to collapse, delete, or modify individual platforms at runtime.

4. **Hazard Collision Gaps**:
   - `src/core/player/PlayerController.ts` (lines 567-595): `onCollision` only processes `ITEM_PICKUP`, `POW`, and `ENEMY_BULLET`. It does not detect `THRUSTER_SHOCKWAVE`, `HOMING_MISSILE`, `ARTILLERY_SHELL`, `CANNON_SHELL`, or hazards.
   - `src/core/entities/boss/TetsuyukiBoss.ts` (line 492): Emits `falling_debris` event on `engine.eventBus`, but no corresponding entity or hitbox is added to `GameEngine`.
   - `src/main.ts` (lines 609-615): `explosion_spawned` listener only triggers sound and visual explosion states. Only `grenade_exploded` (lines 637-649) inflicts proximity damage to the player.

5. **Test Suite Baseline**:
   - Command: `npm test` (`npx vitest run`).
   - Result: 24 test files passed, 294 tests passed (100% green), execution time 27.23s.

---

## 2. Logic Chain

1. **Need for Decoupled Crisis Architecture**:
   - Observations 1 and 4 show that boss phase transitions currently operate strictly via internal member functions (`takeDamage`) and emit disconnected events.
   - Requirement R1 in `ORIGINAL_REQUEST.md` and `COLLABORATION.md` requires dynamic crisis situations at specific HP thresholds (75%, 50%, 25%) that alter active platforms, bounds, and spawn hazards.
   - Hardcoding these triggers inside individual boss classes would violate architectural separation, prevent reusability across different bosses (e.g. Tetsuyuki vs. Iron Nokana), and make unit testing brittle.
   - Therefore, a dedicated `CrisisEventManager` class must be created to decouple health threshold monitoring from specific boss entities and coordinate environmental alterations.

2. **Need for Platform & Camera Mutation APIs**:
   - Observation 3 confirms `GameEngine` lacks `removePlatform` and `StageManager` lacks `collapsePlatform` and `setCameraBounds`.
   - Observation 2 confirms that `Camera.bounds` dynamically mirrors `StageManager.getCameraBounds()` every frame.
   - Therefore, adding `removePlatform(id: string): boolean` to `GameEngine` and `collapsePlatform(platformId: string): boolean` / `setCameraBounds(bounds: CameraBounds): void` to `StageManager` is the minimal, zero-regression solution to enable collapsing bridges and shrinking arena bounds.

3. **Need for Concrete Environmental Hazard Entities**:
   - Observation 4 reveals that `falling_debris` and other boss attacks currently exist only as event strings or unhandled collision types.
   - To satisfy acceptance criteria ("spawning hazards or changing active bounds" verified via automated tests), hazards must exist as concrete `GameEntity` implementations (`ArtilleryShellHazard`, `FallingDebrisHazard`, `GroundFlameHazard`) registered in `GameEngine.spatialGrid` with physical AABB bounds, kinematic velocity, and damage dispatch.
   - Extending `PlayerController.onCollision` to handle `HAZARD` / `ENVIRONMENTAL_HAZARD` and updating `main.ts`'s `explosion_spawned` handler ensures hazards deal actual damage.

4. **Epic Boss Encounter (Iron Nokana)**:
   - Observation 1 shows Tetsuyuki is an aerial fortress.
   - Adding `IronNokanaBoss` introduces a heavy armored rolling siege tank on ground tracks with 4 distinct phases:
     - Phase 1: Heavy Cannon + 4-Missile Quad Salvo
     - Phase 2: Telegraphed Hydraulic Underbelly Flame Sweep (0.8s warning) + Mortars
     - Phase 3: Rear Girida-O Auxiliary Mini-Tank Deployment + Tread Ramming Surges
     - Phase 4: Overdrive Rage State (red aura, 50% cooldowns, screen-filling napalm sweep)
   - This provides the authentic arcade variety and multi-phase depth requested in R1.

5. **Testability & Verification**:
   - Acceptance criteria require unit tests verifying that specific HP thresholds trigger crisis events.
   - By structuring `CrisisEventManager` with deterministic threshold tracking and event callbacks, automated tests can assert:
     - At 75% HP: `ArtilleryShellHazard` entities appear in `engine.getAllEntities()`.
     - At 50% HP: `boss_arena_left` platform is removed and `stageManager.getCameraBounds().minX` contracts.
     - At 25% HP: `boss.isRaging` is activated and cooldowns reduce.
     - Under 5,000 burst damage: all thresholds trigger in strict sequence without corruption.

---

## 3. Caveats

1. **Rendering & Sprites**:
   - As an explorer agent operating under read-only mode, I designed procedural sprite specifications for Iron Nokana (hull, treads, flame nozzle, auxiliary turret) and crisis reticles in `analysis.md`. The actual drawing functions in `ProceduralSpriteFactory.ts` will need to be written by the implementation worker.
2. **Audio Assets**:
   - The audio synthesis functions for hydraulic hiss (`sfx_hydraulic_hiss`) and warning sirens are recommended to use existing procedural Web Audio oscillators in `SoundEngine.ts`.
3. **Stage Integration**:
   - The stage can either support `IronNokanaBoss` as an alternate encounter, an escalation in Stage 1 Section 2, or as the Stage 2 Boss. The blueprint is designed modularly to support any of these configurations without breaking Stage 1's existing `TetsuyukiBoss` setup.

---

## 4. Conclusion

1. **Architecture Ready**: The design for `CrisisEventManager`, `IronNokanaBoss`, and `EnvironmentalHazard` is fully specified with exact TypeScript interfaces, event flows, and integration contracts.
2. **Zero Breaking Changes**: The proposed additions (`GameEngine.removePlatform`, `StageManager.collapsePlatform`, `StageManager.setCameraBounds`) are additive and will not regress existing gameplay or the 294 passing tests.
3. **Verification Ready**: Automated unit test specifications (`tests/unit/boss_crisis_events.test.ts` and `tests/unit/iron_nokana_boss.test.ts`) have been outlined to provide 100% green coverage against all acceptance criteria.

---

## 5. Verification Method

1. **Inspect Artifacts**:
   - Check analysis report: `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/analysis.md`
   - Check handoff report: `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/handoff.md`
2. **Verify Existing Test Suite Baseline**:
   - Run command: `npm test`
   - Invalidation condition: Any test failure or compilation error indicates environment regression.
3. **Verify Implementation Plan Feasibility**:
   - Run command: `npx tsc --noEmit` to confirm TypeScript baseline remains clean.
   - Inspect proposed files and interfaces against existing types in `src/core/engine/GameEngine.ts`, `src/core/engine/StageManager.ts`, and `src/core/entities/boss/BossTypes.ts`.
