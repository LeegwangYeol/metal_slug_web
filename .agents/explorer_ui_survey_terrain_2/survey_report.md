# Comprehensive Level Design & Terrain System Survey
**Agent ID**: `explorer_ui_survey_terrain_2`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_terrain_2/`  
**Date**: 2026-09-10  
**Target Milestone**: UI/UX & Level Overhaul (Screen Size, Terrain & Level Design)  
**Status**: Completed (Read-Only Investigation & Blueprint Design)

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 Core User Feedback & Aesthetic Goals
* **User Feedback (2026-09-10T00:53:24Z)**:
  > *"Based on the original, it's not cute/charming at all, and it feels very stifling/claustrophobic."*  
  > *(원작에 비해서 전혀 아기자기하지 않고 너무 답답함)*
* **Visual & Gameplay Objectives**:
  1. **Aesthetic ("Cute/Charming/Appealing" — 아기자기한 느낌)**: Introduce detailed miniature arcade props, chunky sandbag redoubts, rustic wooden watchtowers with ladders, supply crates, explosive red fuel barrels, palm trees, and stepped terrain elevations reminiscent of classic Neo Geo Metal Slug Mission 1.
  2. **Eliminating the "Stifling/Claustrophobic" (답답한) Feeling**: Provide wide panoramic visibility, multi-tier alternate pathways (high catwalks vs. low ground trenches), and eliminate flat, empty dead zones across the 2400px stage.

### 1.2 Current Codebase Bottlenecks
1. **Monotonous Flat Ground**: Ground terrain is a single unbroken box `createAABB(0, 230, 2400, 40)` stretching across the entire stage. There is zero elevation change, no sand dunes, no trenches, no water hazards.
2. **Sparse Obstacle Density**: Only 10 platforms exist across 2400px (1 platform per 240px average). Entire 160–220px stretches are completely devoid of any platforms or structures.
3. **Primitive "Floating Box" Visuals**:
   - `SOLID` bunker platforms (`bunker_1`, `bunker_2`) are rendered as floating 14–16px thick colored rectangles hovering 50–70px above the sand with no walls, sandbags, or pillbox structures touching the ground.
   - `SEMI_SOLID` docks and bridges are floating planks with 4px brackets, lacking timber stilts, pilings, or ladders.
4. **Zero Destructible / Interactive Stage Elements**: There are no destructible sandbag barricades, supply crates, or explosive barrels in the codebase.
5. **Drop-Through Platform Glitch**: In `PlayerController.ts`, `initiateDropThrough()` does not store the current platform ID, resulting in a momentary ground re-snap stutter on frame 1 of drop-through.
6. **Enemy Platform Agnosticism**: Standard enemies walk in a straight line and fall off platform edges; paratroopers hardcode `targetGroundY: 230`, passing right through elevated platforms.

---

## 2. Current Architecture Survey

### 2.1 Stage Representation & Data Flow
* **Stage Specification**: Defined via interface `StageData` in `src/core/engine/StageManager.ts` (aliased in `src/core/stage/StageManager.ts`):
  ```typescript
  export interface StageData {
    id: string;
    name: string;
    width: number;
    height: number;
    initialCameraBounds: CameraBounds;
    platforms: Platform[];
    triggers: StageTrigger[];
  }
  ```
* **Stage Construction**: Created in `src/main.ts` via `buildStage1Data()` (lines 712–950) with `STAGE_WIDTH = 2400`, `STAGE_HEIGHT = 270`.
* **Platform Storage**: `GameEngine.platforms: Platform[]` holds the active collision geometry.

### 2.2 Platform Physics & Collision Solver (`src/core/physics/Platform.ts`)
* **Platform Types**:
  - `SOLID`: Solid ground or concrete walls. Evaluated via `resolveSolidAABB()` for full box penetration (push-up for ground, push-down for ceiling, push-x for walls).
  - `SEMI_SOLID`: One-way jump-through platforms. Evaluated via `checkSemiSolidLanding()`.
* **Semi-Solid Landing Invariant**:
  - Requires downward movement: `vy >= 0`.
  - Horizontal overlap: `footX + halfWidth > platLeft && footX - halfWidth < platRight`.
  - Vertical crossing: `prevFootY <= platTop + 4.0 && currFootY >= platTop`.
  - When airborne ascending (`vy < 0`), entity passes freely through from below.
* **Ground Contact Resolver**: `PlatformPhysics.resolveGroundContact()` iterates over all platforms and returns the highest valid landing surface `groundY`.

### 2.3 Player Collision & Drop-Through (`src/core/player/PlayerController.ts`)
* **Kinematics**:
  - Normal gravity: `800 px/s²` with apex float dampening (`0.65 * gravity` when `|vy| < 40 px/s`).
  - Jump impulse: `-360 px/s`. Variable jump cut: `0.5x` velocity on early release.
  - Coyote time: 4 frames (~66.7ms). Jump buffer: 4 frames (~66.7ms).
* **Drop-Through Implementation**:
  - Triggered by `isGrounded && input.down && input.jumpPressed`.
  - Sets `isDroppingThrough = true`, `dropThroughTimer = 18 * dt`, `velocity.y = 120 px/s`.
  - **Identified Defect (Line 533-535)**: `this.ignoredPlatformId` is only set if `contact.platform && this.isDroppingThrough` fires *after* `contact.isGrounded` returns true. Because `ignoredPlatformId` is initially `null`, `resolveGroundContact` detects a valid landing on frame 1, setting `position.y = contact.groundY` and `velocity.y = 0`, causing the player to freeze on the platform.

### 2.4 Enemy Kinematics & Platforms (`src/core/entities/enemies/SoldierEnemy.ts`)
* **Physics Integration**: Lines 609–625 call `PlatformPhysics.resolveGroundContact(footX, prevFootY, currFootY, this.velocity.y, width / 2, engine.getPlatforms())`.
* **Movement**:
  - `PATROL`: Paces horizontally between `patrolMinX` and `patrolMaxX`. If it walks past the platform edge, `resolveGroundContact` returns `isGrounded: false` and gravity pulls it down.
  - `PARACHUTE_DESCENT`: Line 640 hardcodes `targetGroundY: cfg.targetGroundY ?? 230`. It does NOT query `engine.getPlatforms()`, so paratroopers ignore elevated roofs/docks.
  - `AMBUSH_LEAP`: Leaps with initial velocity `(-140, -220)` and recovers upon landing.

### 2.5 Weapons & Projectiles (`src/core/weapons/`)
* **`BulletProjectile` (Pistol, HMG, Flame Shot)**:
  - Lines 112–124 of `ProjectileManager.ts`: Iterates over `engine.getPlatforms()`.
  - Collides ONLY with `plat.type === 'SOLID'`. Bullets penetrate `SEMI_SOLID` platforms unimpeded.
  - Flame shot emits `spawn_ground_fire` upon contacting a `SOLID` platform.
* **`Grenade`**:
  - Lines 102–124 of `Grenade.ts`: Evaluates `PlatformPhysics.resolveGroundContact` against all platforms (both `SOLID` and `SEMI_SOLID`).
  - Bounces with restitution `ey = 0.5`, `ex = 0.7`. Explodes on contact with enemies or upon fuse timeout (1.25s).
* **`EnemyBullet`**: Currently only tests player collision and lifetime; does not collide with terrain.
* **`EnemyGrenade`**: Bounces on platforms via `resolveGroundContact`, detonates on fuse expiration (1.6s).
* **`CannonShell` / `TetsuyukiShell`**: Explodes upon intersecting `SOLID` platforms.

---

## 3. Existing Test Suite Analysis & Regression Invariants

Running `npx vitest run` executes **35 test files, 463 tests (100% green)**. Key tests that directly constrain terrain and level changes:

| Test File | Constraint / Assertion | Required Preservation |
| :--- | :--- | :--- |
| `tests/unit/boss_crisis_events.test.ts` (L159–176) | Expects platform with ID `'boss_arena_left'` to exist and be collapsed via `collapsePlatform('boss_arena_left')` at 50% Boss HP. | **Platform ID `'boss_arena_left'` must remain exactly intact.** |
| `tests/e2e/ultimate_and_crisis_expansion.spec.ts` (L405–415) | Verifies `'boss_arena_left'` exists before 50% HP and is removed afterwards. | **Preserve `'boss_arena_left'` bounds `(1860, 170, 100, 12)`.** |
| `tests/e2e/game_initialization.spec.ts` (L202) | Asserts `expect(platformCount).toBeGreaterThan(5)`. | Expanding to 25+ platforms is fully compliant. |
| `tests/e2e/gameplay_controls.spec.ts` (L17–83) | Asserts player starts grounded at `Y = 230` (at `X = 80`), jumps with `deltaY < -20`, and lands at `Y = 230`. | **Starting spawn position at `(80, 230)` must be on ground `Y = 230`.** |
| `tests/unit/empirical_physics_spawning_challenge.test.ts` (L385–420) | **EMPRICAL INVARIANT 5A**: All wave enemy spawns in `stage.triggers` must have `spawnX >= cameraX + 510` (strictly outside viewport). | **Never place standard wave enemy spawn coordinates `< cameraX + 510`.** |
| `tests/unit/adversarial_m3_challenger_stress.test.ts` (L27–60) | **FOCUS 1A**: Asserts `ProceduralSpriteFactory.getAllKeys().length === 164` exactly. | **Render terrain props directly in CanvasRenderer (do NOT add keys to SpriteFactory without updating test count).** |

---

## 4. Architectural Design: Rich Multi-Tier Level Layout

### 4.1 Zone-by-Zone Level Blueprint (0 to 2400px)

```
[ ZONE 1: BEACHHEAD STILTS ]   [ ZONE 2: DUNE REDOUBT ]      [ ZONE 3: RIVER MID-BOSS ]     [ ZONE 4: TRENCH GORGE ]      [ ZONE 5: CITADEL ARENA ]
       (x: 0 - 500)                 (x: 500 - 1000)               (x: 1000 - 1450)              (x: 1450 - 1800)               (x: 1800 - 2400)
    +---------------+             +-----------------+            +------------------+          +------------------+           +------------------+
    | Pier Docks    |             | Watchtower Alpha|            | Overhead Catwalk |          | High Suspension  |           | Crane Staging    |
    | (Y: 175)      |             | (Y: 125)        |            | (Y: 115)         |          | Bridge (Y: 160)  |           | (Y: 110)         |
    +-------+-------+             +--------+--------+            +--------+---------+          +--------+---------+           +--------+---------+
            |                              |                              |                             |                              |
+-----------v-----------+         +--------v--------+            +--------v---------+          +--------v---------+           +--------v---------+
| Bunker 1 (Y: 160)     |         | Sandbag Redoubt |            | Mid-Boss Docks   |          | Watchtower Beta  |           | Arena Left/Right |
| + Sandbag Barricade   |         | + Fuel Barrels  |            | L/R (Y: 168)     |          | & Bunker 2       |           | (Y: 170) [CRISIS]|
+-----------+-----------+         +--------+--------+            +--------+---------+          +--------+---------+           +--------+---------+
            |                              |                              |                             |                              |
===================================================================================================================================================
Beach Ground (Y: 230)       Dune Hillock (Y: 220)       Arena Basin (Y: 230)          Trench Dip (Y: 236)            Citadel Floor (Y: 230)
```

#### Detailed Zone Breakdown:

1. **Zone 1: Beachhead Landing & Stilt Docks (x: 0 – 500)**
   - *Atmosphere*: Dawn amphibious landing, rustic wooden stilt docks over tidal waters, washed-up driftwood.
   - *Ground*: `ground_zone1_a` (0–160, Y: 230, SOLID), `ground_zone1_tidal` (160–340, Y: 234, SOLID), `ground_zone1_dune` (340–500, Y: 226, SOLID).
   - *Platforms*:
     - `dock_stilt_1`: SEMI_SOLID `(110, 175, 120, 10)` — Weathered wood dock with pilings.
     - `bunker_1`: SOLID `(290, 160, 90, 16)` — Concrete pillbox roof with tied POW 1.
     - `bunker_1_wall`: SOLID `(370, 176, 10, 50)` — Concrete vertical bunker wall connecting roof to ground!
     - `bridge_1`: SEMI_SOLID `(420, 140, 140, 10)` — High wooden walkway spanning dune rise.
   - *Props*:
     - `sandbag_1`: Destructible Sandbag Barricade `(260, 216, 26, 14, HP: 15)`.
     - `crate_1`: Destructible Supply Crate `(150, 157, 18, 18, HP: 8, drops HMG)`.

2. **Zone 2: Dune Redoubt & High Watchtower (x: 500 – 1000)**
   - *Atmosphere*: Fortified enemy outpost, barbed wire barricades, wooden watchtower with rebel sniper.
   - *Ground*: `ground_zone2_ridge` (500–760, Y: 220, SOLID), `ground_zone2_slope` (760–1000, Y: 230, SOLID).
   - *Platforms*:
     - `scaffold_tier1`: SEMI_SOLID `(520, 170, 100, 10)` — Lower timber scaffolding.
     - `watchtower_alpha`: SEMI_SOLID `(660, 125, 90, 12)` — High sniper tower with ladder rungs.
     - `dune_redoubt_platform`: SOLID `(770, 175, 110, 14)` — Fortified redoubt platform.
     - `dune_redoubt_wall`: SOLID `(770, 189, 12, 41)` — Vertical reinforced redoubt wall.
   - *Props*:
     - `sandbag_2`: Destructible Sandbag Barricade `(630, 206, 28, 14, HP: 20)`.
     - `barrel_1`: Explosive Red Fuel Barrel `(730, 202, 16, 18, HP: 10, 50px blast, 10 damage)`.
     - `sandbag_3`: Destructible Sandbag on redoubt `(840, 161, 24, 14, HP: 15)`.

3. **Zone 3: River Basin & Mid-Boss Arena (x: 1000 – 1450)**
   - *Atmosphere*: Spacious armored vehicle arena flanked by dual spectator docks and high observation catwalk.
   - *Ground*: `ground_midboss_floor` (1000–1450, Y: 230, SOLID) — flat reinforced pavement for vehicle treads.
   - *Platforms*:
     - `midboss_dock_left`: SEMI_SOLID `(1020, 170, 110, 12)` — Preserved test ID! Allows jumping over ramming vehicle.
     - `midboss_dock_right`: SEMI_SOLID `(1320, 170, 110, 12)` — Preserved test ID!
     - `midboss_catwalk`: SEMI_SOLID `(1160, 115, 120, 10)` — High catwalk spanning center arena with tied POW 2.
   - *Props*:
     - `sandbag_mb_left`: Destructible Sandbag `(1005, 216, 24, 14, HP: 20)`.
     - `sandbag_mb_right`: Destructible Sandbag `(1430, 216, 24, 14, HP: 20)`.

4. **Zone 4: Trench Gorge & Suspension Bridges (x: 1450 – 1800)**
   - *Atmosphere*: Sunken rocky ravine crossed by creaking suspension bridges leading to fortress gatehouse.
   - *Ground*: `ground_trench_dip` (1450–1660, Y: 236, SOLID), `ground_fortress_approach` (1660–1800, Y: 226, SOLID).
   - *Platforms*:
     - `bridge_2`: SEMI_SOLID `(1460, 160, 130, 10)` — Suspension rope bridge.
     - `tower_platform`: SEMI_SOLID `(1600, 125, 90, 12)` — Preserved test ID! Watchtower platform with tied POW 3.
     - `bunker_2`: SOLID `(1690, 175, 110, 14)` — Preserved test ID! Concrete bunker with tied POW 4.
     - `bunker_2_wall`: SOLID `(1690, 189, 12, 37)` — Bunker front blast wall.
   - *Props*:
     - `barrel_2`: Explosive Red Fuel Barrel `(1520, 218, 16, 18, HP: 10)`.
     - `crate_2`: Destructible Supply Crate `(1750, 157, 18, 18, HP: 8, drops Flame Shot)`.

5. **Zone 5: Tetsuyuki Fortress Citadel Arena (x: 1800 – 2400)**
   - *Atmosphere*: Massive fortress courtyard with steel ramparts and battlements under aerial siege.
   - *Ground*: `ground_citadel_floor` (1800–2400, Y: 230, SOLID) — heavy steel-reinforced flagstones.
   - *Platforms*:
     - `boss_arena_left`: SEMI_SOLID `(1860, 170, 100, 12)` — **CRITICAL**: Preserved test ID! Collapses at 50% HP.
     - `boss_arena_right`: SEMI_SOLID `(2080, 170, 100, 12)` — Preserved test ID!
     - `boss_arena_high_crane`: SEMI_SOLID `(1970, 110, 80, 10)` — High staging crane deck for aggressive aerial attack.
   - *Props*:
     - `sandbag_citadel_1`: Destructible Sandbag `(1840, 216, 24, 14, HP: 25)`.
     - `sandbag_citadel_2`: Destructible Sandbag `(2190, 216, 24, 14, HP: 25)`.

---

## 5. Destructible Obstacle System Architecture

### 5.1 Proposed Interface & Class Specification (`src/core/entities/obstacles/DestructibleObstacle.ts`)

```typescript
import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { ItemDropType } from '../../weapons/WeaponTypes';
import { ItemPickup } from '../items/ItemPickup';

export type ObstacleType = 'SANDBAG_BARRICADE' | 'SUPPLY_CRATE' | 'EXPLOSIVE_BARREL';

export interface ObstacleConfig {
  health?: number;
  dropItem?: ItemDropType;
  blastRadius?: number;
  blastDamage?: number;
}

export class DestructibleObstacle implements GameEntity {
  public id: string;
  public type: string;
  public obstacleType: ObstacleType;
  public position: Vector2D;
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB;
  public health: number;
  public maxHealth: number;
  public isAlive: boolean = true;
  public isSolid: boolean = true; // Blocks horizontal bullets and walking while alive
  public dropItem?: ItemDropType;
  public blastRadius: number;
  public blastDamage: number;

  constructor(
    id: string,
    obstacleType: ObstacleType,
    position: Vector2D,
    width: number,
    height: number,
    config: ObstacleConfig = {}
  ) {
    this.id = id;
    this.obstacleType = obstacleType;
    this.type = `OBSTACLE_${obstacleType}`;
    this.position = { x: position.x, y: position.y };
    this.bounds = createAABB(position.x, position.y, width, height);

    switch (obstacleType) {
      case 'SANDBAG_BARRICADE':
        this.maxHealth = config.health ?? 20;
        this.blastRadius = 0;
        this.blastDamage = 0;
        break;
      case 'SUPPLY_CRATE':
        this.maxHealth = config.health ?? 8;
        this.dropItem = config.dropItem ?? ItemDropType.WEAPON_HMG;
        this.blastRadius = 0;
        this.blastDamage = 0;
        break;
      case 'EXPLOSIVE_BARREL':
        this.maxHealth = config.health ?? 10;
        this.blastRadius = config.blastRadius ?? 54;
        this.blastDamage = config.blastDamage ?? 10;
        break;
    }
    this.health = this.maxHealth;
  }

  takeDamage(amount: number, engine: GameEngine): void {
    if (!this.isAlive) return;
    this.health -= amount;

    // Hit feedback
    engine.eventBus.emit('play_sound', { sound: 'sfx_bullet_hit' });

    if (this.health <= 0) {
      this.health = 0;
      this.destroy(engine);
    }
  }

  destroy(engine: GameEngine): void {
    this.isAlive = false;

    if (this.obstacleType === 'EXPLOSIVE_BARREL') {
      // Detonate barrel in fiery explosion
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.bounds.x + this.bounds.width / 2, y: this.bounds.y + this.bounds.height / 2 },
        radius: this.blastRadius,
        damage: this.blastDamage,
        isLarge: true,
      });
      // Damage nearby entities in blast radius
      this.dealAreaDamage(engine);
    } else if (this.obstacleType === 'SUPPLY_CRATE' && this.dropItem) {
      // Spawn item pickup
      const pickup = new ItemPickup(
        `drop_${this.id}`,
        this.dropItem,
        { x: this.bounds.x + 4, y: this.bounds.y },
        { x: 0, y: -120 }
      );
      engine.addEntity(pickup);
      engine.eventBus.emit('play_sound', { sound: 'sfx_knife_slash' });
    } else if (this.obstacleType === 'SANDBAG_BARRICADE') {
      // Sandbag bust sound & dust
      engine.eventBus.emit('play_sound', { sound: 'sfx_bullet_hit' });
    }

    engine.removeEntity(this.id);
  }

  private dealAreaDamage(engine: GameEngine): void {
    const center = { x: this.bounds.x + this.bounds.width / 2, y: this.bounds.y + this.bounds.height / 2 };
    for (const ent of engine.getAllEntities()) {
      if (!ent.isAlive || ent.id === this.id) continue;
      if (typeof (ent as any).takeDamage === 'function') {
        const entCenter = { x: ent.bounds.x + ent.bounds.width / 2, y: ent.bounds.y + ent.bounds.height / 2 };
        const dist = Math.hypot(entCenter.x - center.x, entCenter.y - center.y);
        if (dist <= this.blastRadius) {
          (ent as any).takeDamage(this.blastDamage, true, true);
        }
      }
    }
  }

  update(_dt: number, _engine: GameEngine): void {
    // Static obstacle
  }
}
```

### 5.2 Projectile & Obstacle Collision Arbitration
1. **Bullets (`ProjectileManager.ts`)**:
   - Query spatial grid for living `DestructibleObstacle` entities.
   - If bullet intersects an obstacle:
     - Calls `obstacle.takeDamage(bullet.damage, engine)`.
     - Bullet is consumed (`bullet.isAlive = false`) unless it is piercing.
2. **Grenades (`Grenade.ts`)**:
   - Detonate on contact with any obstacle, inflicting `10.0` damage. Instantly detonates barrels and obliterates sandbags!

---

## 6. Fixing the Semi-Solid Drop-Through Flaw

### 6.1 Diagnosis
In `src/core/player/PlayerController.ts`:
```typescript
// Current initiateDropThrough() (Line 446):
private initiateDropThrough(): void {
  this.isDroppingThrough = true;
  this.dropThroughTimer = PlayerKinematics.DROP_THROUGH_FRAMES * GameEngine.DEFAULT_TIMESTEP;
  this.velocity.y = PlayerKinematics.DROP_THROUGH_IMPULSE;
  this.isGrounded = false;
  this.coyoteTimer = 0;
  this.jumpBufferTimer = 0;
  // MISSING: this.ignoredPlatformId is not initialized!
}
```
Because `ignoredPlatformId` is `null`, on the immediately following physics tick:
`PlatformPhysics.resolveGroundContact` evaluates feet at `prevFootY = Y, currFootY = Y + 2`.
The landing test `prevFootY <= platTop + 4.0 && currFootY >= platTop` evaluates to **true**! The player immediately snaps back to `groundY` with `velocity.y = 0`!

### 6.2 Solution
1. Identify the platform under the player's feet upon initiating drop-through:
   ```typescript
   private initiateDropThrough(engine: GameEngine): void {
     const platforms = engine.getPlatforms();
     const footX = this.position.x;
     const footY = this.position.y;
     const currentPlat = platforms.find(
       (p) =>
         p.type === 'SEMI_SOLID' &&
         Math.abs(p.bounds.y - footY) <= 3.0 &&
         footX + 12 > p.bounds.x &&
         footX - 12 < p.bounds.x + p.bounds.width
     );

     // Only initiate if standing on a SEMI_SOLID platform (cannot drop through solid ground!)
     if (!currentPlat) return;

     this.isDroppingThrough = true;
     this.ignoredPlatformId = currentPlat.id;
     this.dropThroughTimer = PlayerKinematics.DROP_THROUGH_FRAMES * GameEngine.DEFAULT_TIMESTEP;
     this.velocity.y = PlayerKinematics.DROP_THROUGH_IMPULSE;
     this.isGrounded = false;
     this.coyoteTimer = 0;
     this.jumpBufferTimer = 0;
   }
   ```
2. Pass `engine` into `initiateDropThrough(engine)` from `handleInput()`.
3. Ensures immediate, smooth, zero-stutter downward drop through platforms.

---

## 7. Enemy Platform Navigation Enhancements

1. **Platform Patrol Bounds Clamping**:
   When an enemy is spawned on an elevated platform (e.g. `watchtower_alpha` or `bunker_1`), configure:
   ```typescript
   patrolMinX: platform.bounds.x + 8,
   patrolMaxX: platform.bounds.x + platform.bounds.width - 8
   ```
   Prevents the soldier from walking off the ledge unless reacting to the player.
2. **Platform Paratrooper Touchdown**:
   In `SoldierEnemy.ts`:
   ```typescript
   // Update updateParachuteAI:
   if (engine && engine.getPlatforms().length > 0) {
     const contact = PlatformPhysics.resolveGroundContact(
       this.position.x + this.width / 2,
       prevFootY,
       this.position.y + this.height,
       this.velocity.y,
       this.width / 2,
       engine.getPlatforms()
     );
     if (contact.isGrounded) {
       this.position.y = contact.groundY - this.height;
       this.velocity.y = 0;
       this.isParachuteActive = false;
       this.transitionTo('PARACHUTE_LANDING');
     }
   }
   ```
   Paratroopers naturally touch down on elevated watchtower decks, bridge walkways, or ground dunes!
3. **Leap Down Ambush**:
   When knife soldiers or grenadiers stationed on high platforms spot the player directly below (`Math.abs(dx) < 80 && playerY > enemyY + 40`), they trigger an ambush leap:
   `velocity = { x: facing * 60, y: 150 }`, dropping directly onto the player with weapon readied.

---

## 8. Retro Arcade Procedural Art Rendering Overhaul

In `CanvasRenderer.ts` (`renderPlatformsPass`):
Instead of bare monochromatic rectangles, render authentic arcade pixel structures using `PALETTES.TERRAIN`:

1. **Wooden Pier & Bridge Walkways (`SEMI_SOLID`)**:
   - Planks: `#7D5836` with dark woodgrain seams `#4E331A` every 12px.
   - Timber Pilings: Vertical 8px wide stilts (`#4E331A`, highlight `#7D5836`) reaching down to ground/water line.
   - Steel Crossbraces: `#42484F` diagonal metal brackets at corners.
2. **Reinforced Concrete Bunkers (`SOLID`)**:
   - Heavy slab roof: `#383838` concrete with `#687078` bevel highlight.
   - Front pillbox wall: Full vertical concrete facade down to the ground.
   - Embrasure slit: Narrow `#101418` dark firing aperture with rivet bolts `#687078`.
3. **Sandbag Revetments & Barricades**:
   - Double-stacked rounded burlap sacks `#8B8070` with crease shadows `#5A5244`.
   - Subtle stitched seams and cross-tied rope knots.
4. **Explosive Red Fuel Barrels**:
   - Red cylindrical body `#D32F2F` with dark red shadow `#8B0000`.
   - Black and yellow diagonal hazard stripe `#FBC02D` across the center.
   - Dual steel reinforcement hoops `#424242`.
5. **Supply Crates**:
   - Khaki wooden box `#A88850` with cross-diagonal bracing `#685028`.
   - Gold stencil ammo icon `#FCE071` and corner metal protectors.

---

## 9. Verification & Test Plan for Terrain Overhaul

### 9.1 Unit Test Specifications
* **`tests/unit/terrain_platforms.test.ts`**:
  1. *Platform Layout Integrity*: Assert `StageData.platforms.length >= 22` with balanced `SOLID` and `SEMI_SOLID` distribution.
  2. *Critical ID Preservation*: Assert `boss_arena_left`, `midboss_dock_left`, `midboss_dock_right`, `tower_platform`, and `bunker_2` exist with exact IDs.
  3. *Semi-Solid Drop-Through*: Assert player on `dock_stilt_1` initiates drop-through, `isDroppingThrough === true`, does not snap on frame 1, and reaches lower ground.
  4. *Solid Collision Wall Blocking*: Assert player running into `bunker_1_wall` is stopped horizontally (`isGrounded === true`, `position.x <= wall.bounds.x`).
  5. *Bullet Obstacle Blocking*: Assert pistol/HMG bullet hits `sandbag_1`, obstacle health decrements from 15 to 14, bullet is removed.
  6. *Explosive Barrel Chain Reaction*: Assert bullet destroying `barrel_1` emits `explosion_spawned` and damages nearby soldier enemy.
  7. *Supply Crate Loot Drop*: Assert destroying `crate_1` spawns `ItemPickup` with `dropType: WEAPON_HMG`.
  8. *Paratrooper Platform Landing*: Assert paratrooper descending over elevated watchtower lands on platform surface (`y = 125 - 38 = 87`).

### 9.2 E2E Playwright Verification
* **Test Case**: `tests/e2e/terrain_and_obstacles.spec.ts`
  1. Boot game in headless browser.
  2. Assert `platformCount >= 20`.
  3. Move player right, jump onto `dock_stilt_1` (`deltaY < -40`).
  4. Perform drop-through (`ArrowDown + Space`), assert player descends to sand ground.
  5. Fire at sandbag barricade, assert obstacle is damaged and removed.
  6. Capture high-resolution screenshot `artifacts/ui_overhaul/screen_terrain.png` demonstrating multi-tier platforms, watchtower, sandbags, and expanded viewport.
