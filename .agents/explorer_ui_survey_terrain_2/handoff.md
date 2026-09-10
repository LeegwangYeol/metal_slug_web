# Handoff Report — Level Design & Terrain System Survey

**Agent**: `explorer_ui_survey_terrain_2`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_terrain_2`  
**Parent ID**: `dc4b76ec-2c8d-41af-8152-fb6d5ed83654`  
**Type**: Hard Handoff (Investigation Complete)  
**Target File**: `survey_report.md`

---

## 1. Observation

1. **Stage & Platform Representation**:
   - `src/main.ts` lines 712–746 (`buildStage1Data()`): Defines `STAGE_WIDTH = 2400`, `STAGE_HEIGHT = 270`. Ground is a single flat box `createAABB(0, 230, STAGE_WIDTH, 40)`. Exactly 10 elevated platforms are defined across 2400px (only ~1 per 240px average), with dead zones of 160–220px of barren ground.
   - `src/core/engine/StageManager.ts` lines 35–43 (`StageData`): Defines `{ id, name, width, height, initialCameraBounds, platforms, triggers }`.
   - `src/core/physics/Platform.ts` lines 4–11: Platforms support two types: `'SOLID'` and `'SEMI_SOLID'`.

2. **Platform Collision Solver**:
   - `src/core/physics/Platform.ts` lines 53–98 (`checkSemiSolidLanding`): Allows upward penetration (`vy < 0`); lands when `vy >= 0`, `footX ± halfWidth` overlaps, and `prevFootY <= platTop + 4.0 && currFootY >= platTop`.
   - `src/core/physics/Platform.ts` lines 165–208 (`resolveSolidAABB`): Resolves AABB penetration against `'SOLID'` platforms (floors, ceilings, walls).

3. **Player Collision & Drop-Through Flaw**:
   - `src/core/player/PlayerController.ts` lines 200–204: Initiates drop-through when `this.isGrounded && input.down && input.jumpPressed`.
   - `src/core/player/PlayerController.ts` lines 446–453 (`initiateDropThrough`): Sets `this.isDroppingThrough = true`, `velocity.y = 120.0`, but **does NOT initialize `this.ignoredPlatformId`**.
   - `src/core/player/PlayerController.ts` lines 516–536: In `update()`, on frame 1 of drop-through, `this.ignoredPlatformId` is `null`. `resolveGroundContact()` evaluates `currFootY >= platTop` and snaps `position.y = contact.groundY` with `velocity.y = 0`, freezing the player on the platform rather than smoothly dropping through.

4. **Enemy Platform Navigation**:
   - `src/core/entities/enemies/SoldierEnemy.ts` lines 609–625 (`applyPhysics`): Grounded soldiers check `PlatformPhysics.resolveGroundContact`. If an enemy walks past the platform edge, they fall off.
   - `src/core/entities/enemies/SoldierEnemy.ts` lines 632–652 (`updateParachuteAI`): Hardcodes `targetGroundY: cfg.targetGroundY ?? 230`. Paratroopers do not query `engine.getPlatforms()`, causing them to clip through elevated watchtowers and bridges down to Y = 230.
   - Enemies lack jump logic (only `AMBUSH_LEAP` exists).

5. **Projectile Terrain Collision**:
   - `src/core/weapons/ProjectileManager.ts` lines 111–124: Bullets check `plat.type === 'SOLID' && BoundingBox.intersects(this.bounds, plat.bounds)`. Hit bullets are destroyed. Bullets freely penetrate `'SEMI_SOLID'` platforms.
   - `src/core/weapons/Grenade.ts` lines 102–124: Grenades bounce off both `'SOLID'` and `'SEMI_SOLID'` platforms via `resolveGroundContact`.
   - `src/core/entities/enemies/MidBossVehicle.ts` lines 39–46: Cannon shells explode upon contacting `'SOLID'` platforms.

6. **Rendering Aesthetics**:
   - `src/render/CanvasRenderer.ts` lines 297–348 (`renderPlatformsPass`): Platforms are rendered as flat rectangles (sand layer + dirt + rock) or wooden planks with 4px brackets. No vertical stilts, pilings, concrete walls, or sandbags touch the ground, creating a detached "floating box" appearance.
   - There are zero destructible barricades, crates, or explosive barrels anywhere in `src/`.

7. **Critical Invariant Tests**:
   - `tests/unit/boss_crisis_events.test.ts` lines 159–176 & `tests/e2e/ultimate_and_crisis_expansion.spec.ts` lines 405–415: Expect platform ID `'boss_arena_left'` to exist and be removed during the 50% HP terrain collapse event.
   - `tests/e2e/gameplay_controls.spec.ts` lines 17–83: Asserts player begins grounded at `(80, 230)`.
   - `tests/unit/empirical_physics_spawning_challenge.test.ts` lines 385–420: Asserts all wave spawn coordinates in `stage.triggers` have `spawnX >= cameraX + 510`.
   - `tests/unit/adversarial_m3_challenger_stress.test.ts` lines 27–60: Asserts `ProceduralSpriteFactory.getAllKeys().length === 164` exactly.

---

## 2. Logic Chain

1. From **Observation 1 & 6**, the game's level design feels empty and "stifling / claustrophobic" because 2400px of flat ground at Y = 230 contains only 10 floating box platforms with no terrain elevation changes, no ground barricades, and no environmental storytelling props.
2. To satisfy the user's feedback ("cute/charming/appealing" — 아기자기한 느낌), the stage must be structured into distinct themed micro-zones with miniature arcade details: stepped sand dunes, beach stilt docks with pilings, wooden watchtowers with ladders, concrete pillboxes with embrasures, destructible sandbags, supply crates, and red explosive barrels.
3. From **Observation 3**, the existing drop-through mechanic fails because `ignoredPlatformId` is unassigned at initiation. Finding the active platform at `(footX, footY)` and assigning `this.ignoredPlatformId = currentPlat.id` inside `initiateDropThrough()` directly eliminates the freeze/re-ground bug.
4. From **Observation 4**, enabling paratroopers to query `engine.getPlatforms()` during descent allows them to land dynamically on elevated watchtower decks, roofs, or bridges, creating surprising tactical encounters.
5. From **Observation 5**, introducing a `DestructibleObstacle` entity (`SANDBAG_BARRICADE`, `SUPPLY_CRATE`, `EXPLOSIVE_BARREL`) seamlessly integrates with `BulletProjectile` and `Grenade`, providing destructible cover and explosive chain reactions without modifying core engine physics.
6. From **Observation 7**, any overhaul must preserve critical platform IDs (`boss_arena_left` at `1860, 170, 100, 12`, `midboss_dock_left`, `midboss_dock_right`, `tower_platform`, `bunker_2`), starting ground at `(80, 230)`, trigger spawn spacing (`>= cameraX + 510`), and render terrain props procedurally in `CanvasRenderer.ts` to avoid breaking the 164-key invariant in `ProceduralSpriteFactory`.

---

## 3. Caveats

1. **Read-Only Investigation**: No source code files or tests were modified during this investigation. Implementation must be carried out by downstream worker agents with explicit user authorization.
2. **Camera Widescreen Expansion**: Viewport dimensions (`CanvasRenderer.VIRTUAL_WIDTH/HEIGHT`) are being surveyed in parallel by `explorer_ui_survey_viewport_1`. The 24-platform blueprint is designed with modular horizontal segments (Zones 1–5) that scale smoothly across 480px up to 960px viewports.
3. **Destructible Obstacle Entity Registration**: Downstream workers should register `DestructibleObstacle` in `GameEngine.entities` and spatial grid, similar to `PowEntity` and `ItemPickup`.

---

## 4. Conclusion

1. The level design overhaul requires expanding from 10 floating platforms to **24 multi-tier platforms and 10 interactive destructible obstacles** across 5 distinct zones:
   - **Zone 1 (0–500px)**: Beachhead Landing & Stilt Docks (Y: 230, Y: 234 tidal dip, stilt dock Y: 175, bunker 1 Y: 160, sandbag barricade, supply crate).
   - **Zone 2 (500–1000px)**: Fortified Dune Redoubt & High Watchtower (Y: 220 dune terrace, watchtower alpha Y: 125, redoubt Y: 175, explosive barrel).
   - **Zone 3 (1000–1450px)**: River Basin & Mid-Boss Arena (arena floor Y: 230, dual side docks Y: 168, center overhead catwalk Y: 115).
   - **Zone 4 (1450–1800px)**: Trench Gorge & Suspension Bridges (sunken trench Y: 236, suspension bridge Y: 160, tower platform Y: 125, bunker 2 Y: 175, explosive barrel).
   - **Zone 5 (1800–2400px)**: Tetsuyuki Citadel Arena (citadel floor Y: 230, preserved `boss_arena_left` Y: 170, `boss_arena_right` Y: 170, high crane staging Y: 110).
2. The drop-through bug in `PlayerController.ts` can be cleanly fixed in 8 lines of code by caching `this.ignoredPlatformId = currentPlat.id` in `initiateDropThrough()`.
3. Paratrooper landing can be made dynamic by evaluating `PlatformPhysics.resolveGroundContact` in `updateParachuteAI()`.
4. Rendering of all platforms, pilings, ladders, and sandbags can be performed procedurally in `CanvasRenderer.renderPlatformsPass()`, producing gorgeous retro arcade pixel art while preserving 100% test compatibility.

---

## 5. Verification Method

1. **Full Test Suite Execution**:
   Run `npx vitest run` to verify all 463 tests pass:
   ```bash
   npx vitest run
   ```
2. **Specific Stage & Crisis Invariant Verification**:
   ```bash
   npx vitest run tests/unit/boss_crisis_events.test.ts
   npx vitest run tests/unit/empirical_physics_spawning_challenge.test.ts
   npx vitest run tests/unit/adversarial_m3_challenger_stress.test.ts
   ```
3. **E2E Browser Gameplay Controls & Physics**:
   ```bash
   npm run build && npx playwright test tests/e2e/gameplay_controls.spec.ts
   ```
4. **Invalidation Conditions**:
   - If `boss_arena_left` is renamed, omitted, or shifted away from `x: 1860, y: 170, w: 100, h: 12`, `boss_crisis_events.test.ts` and `ultimate_and_crisis_expansion.spec.ts` will fail.
   - If wave triggers spawn minions at `< cameraX + 510`, `empirical_physics_spawning_challenge.test.ts` will fail.
   - If sprite keys are inserted into `ProceduralSpriteFactory`, `adversarial_m3_challenger_stress.test.ts` (Focus 1A) will fail.
