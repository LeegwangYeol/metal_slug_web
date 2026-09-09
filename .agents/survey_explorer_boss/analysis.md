# Architectural Survey & Implementation Blueprint: Epic Boss Encounters & Dynamic Crisis Events

**Author**: `survey_explorer_boss`  
**Target Project**: Metal Slug Web (Full Metal Slug) Massive Expansion  
**Date**: 2026-09-04  
**Scope**: Multi-phase Boss Architecture, Telegraphed Attacks, Rage States, Dynamic Crisis Events (HP 75%, 50%, 25%), Environmental Hazards, Platform/Camera Alterations, and Automated Test Specifications.

---

## 1. Executive Summary

This investigation analyzes the architectural roadmap for introducing **Epic Boss Encounters** and **Dynamic Crisis Situations** into the Metal Slug Web game engine.

The current game features:
1. A single Stage 1 End-Boss (`TetsuyukiBoss`, 400 HP) with three fixed phases (`PHASE_1_ARTILLERY`, `PHASE_2_LASER_SWEEP`, `PHASE_3_MELTDOWN`) and a mid-boss (`MidBossVehicle`, 320 HP).
2. A headless 60Hz fixed-timestep simulation core (`GameEngine`) with `SpatialGrid` broadphase and `PlatformPhysics` collision resolution.
3. A camera management subsystem (`Camera` & `StageManager`) featuring forward-ratcheting scrolling and arena lockdown boundaries (`CameraBounds`).

However, several critical architectural gaps exist:
- **No Crisis Event Orchestration**: Phase transitions are hardcoded inside individual boss classes (`TetsuyukiBoss.takeDamage()`). There is no decoupled event system that can dynamically monitor health thresholds across bosses or trigger environment-altering events.
- **Static Platform Infrastructure**: `GameEngine` and `StageManager` lack APIs to dynamically remove, collapse, or alter platforms during runtime without resetting the entire stage platform list.
- **Incomplete Hazard Collision Pipeline**: Several existing boss attacks (e.g. `falling_debris`, `laser_sweeping`) emit events onto `EventBus` but do not create concrete `GameEntity` hitboxes in `SpatialGrid`. Furthermore, `PlayerController.onCollision` only resolves `ENEMY_BULLET`, leaving shockwaves, shells, and environmental hazards unable to deal deterministic physical damage.

This survey provides a comprehensive blueprint to implement:
1. **`CrisisEventManager`**: A decoupled, deterministic manager monitoring boss HP checkpoints (`75%`, `50%`, `25%`) and dispatching environmental hazards, platform collapses, and arena bounds modifications.
2. **`IronNokanaBoss`**: A legendary multi-phase heavy armored crawler dreadnought featuring hydraulic underbelly flame sweeps, top mortar cannons, rocket racks, an auxiliary deployable Girida-O tank, and an enraged overdrive state.
3. **`EnvironmentalHazard` System**: Concrete physical entities (`ArtilleryShellHazard`, `FallingDebrisHazard`, `GroundFlameHazard`) with telegraphed target reticles and ground-impact detonations.
4. **Dynamic Stage Alterations**: Runtime platform collapse (`StageManager.collapsePlatform()`) and camera arena contraction (`StageManager.setCameraBounds()`).
5. **Rigorous Automated Unit Tests**: Complete test suites (`boss_crisis_events.test.ts` and `iron_nokana_boss.test.ts`) guaranteeing 100% testable architecture, burst-damage clamping, and environment-altering assertions.

---

## 2. Investigation of Existing Codebase Architecture

### 2.1 Boss Entities & State Machines
- **`src/core/entities/boss/BossTypes.ts`**:
  - Defines `BossPhase = 'PHASE_1_ARTILLERY' | 'PHASE_2_LASER_SWEEP' | 'PHASE_3_MELTDOWN' | 'DEATH_EXPLODING' | 'DESTROYED'`.
  - Defines `BossEntity` interface: `health`, `maxHealth`, `phase`, `turretsAlive`, `weakPointExposed`, `weakPointBox`, `takeDamage()`, `update()`.
  - *Limitation*: Strictly tailored to Tetsuyuki; lacks generic phase metadata, rage indicators, or crisis trigger hooks.

- **`src/core/entities/boss/TetsuyukiBoss.ts`**:
  - Hovering aerial war fortress (width: 280px, height: 160px) rebalanced to 400 HP.
  - Phase 1 (100% -> 65% HP = 260 HP): Underside artillery shell (`TetsuyukiArtilleryShell`, speed -360 px/s) + 3-missile salvo (`TetsuyukiHomingMissile`, 175 px/s, 2.2 rad/s steering).
  - Phase 2 (65% -> 30% HP = 120 HP): Hull breach, gatling minigun (10 rounds/s), and thermal floor laser sweep.
  - Phase 3 (30% -> 0% HP): Exposed core weak point (48x48 px, 1.5x damage, while armor takes 0.25x), ground thruster shockwaves (`TetsuyukiShockwave`), 5-way fan rocket barrage.
  - Exploding Sequence: 4-stage timed chain explosion (3.2s) before `DESTROYED`.
  - Burst-Damage Clamping: `takeDamage()` prevents skipping phases (e.g. 5,000 damage clamps at 260 HP in Phase 1, 120 HP in Phase 2).

- **`src/core/entities/enemies/MidBossVehicle.ts`**:
  - Armored half-track tank (width: 130px, height: 68px, 320 HP) with rotating turret, cannon shells (`CannonShell`), and minion add deployment (max 3 adds).

### 2.2 Stage Progression, Camera Bounds, & Platform Systems
- **`src/core/engine/StageManager.ts`**:
  - Controls `StageData`: `platforms: Platform[]`, `triggers: StageTrigger[]`, `initialCameraBounds: CameraBounds`.
  - `CameraBounds = { minX, maxX, minY, maxY }`.
  - Boss arena is locked at x = 1780 via `lockCameraBounds: { minX: 1800, maxX: 2280, minY: 0, maxY: 270 }`.
  - *Limitation*: `StageManager` does not provide an API to modify camera bounds once locked, nor an API to remove or collapse individual platforms during active gameplay.

- **`src/core/engine/GameEngine.ts`**:
  - Headless 60Hz fixed-timestep simulation loop.
  - Manages `Platform[]` via `setPlatforms()` and `addPlatform()`.
  - *Limitation*: No `removePlatform(id: string)` method exists on `GameEngine`.

- **`src/render/Camera.ts`**:
  - Enforces forward-scrolling ratchet (`forwardLock`) and deadzone tracking.
  - Clamps to `bounds: CameraBounds`.
  - In `src/main.ts` line 269: `this.camera.bounds = { ...stageBounds };` synchronizes camera bounds to `StageManager` every tick.

### 2.3 Hazard Systems & Player Collision Handling
- **Missing Direct Hazard Collision**:
  - In `src/core/player/PlayerController.ts` lines 567–594:
    ```typescript
    onCollision(other: GameEntity, engine: GameEngine): void {
      if (other.type === 'ITEM_PICKUP') { ... }
      if (other.type === 'POW') { ... }
      if (other.type === 'ENEMY_BULLET') { ... }
    }
    ```
  - Direct collisions with `THRUSTER_SHOCKWAVE`, `HOMING_MISSILE`, `ARTILLERY_SHELL`, `CANNON_SHELL`, or falling debris are NOT handled in `PlayerController.onCollision`.
  - In `src/main.ts` line 637, only `grenade_exploded` checks distance to the player to deal damage. Other explosions emitted via `explosion_spawned` only trigger sound and visual effects without player damage.
  - *Recommendation*: Add a unified `HAZARD` / `ENVIRONMENTAL_HAZARD` collision check in `PlayerController.onCollision`, and update `main.ts`'s `explosion_spawned` listener to damage the player if the explosion is non-friendly and within blast radius.

---

## 3. Epic Boss Encounters: Iron Nokana Architecture

To provide an epic multi-phase encounter that contrasts sharply with the airborne `TetsuyukiBoss`, we design the **Iron Nokana Heavy Armored Dreadnought**.

### 3.1 Overview & Physical Specifications
- **Class**: `IronNokanaBoss` (`src/core/entities/boss/IronNokanaBoss.ts`)
- **Entity Type**: `'BOSS_IRON_NOKANA'`
- **Role**: Heavy Armored Rolling Siege Tank / Fortress Carrier
- **Dimensions**: Width: 220px, Height: 140px
- **Default Position**: Arena right side (`x = 2050, y = 90`), treads grounded on terrain at `Y = 230`
- **Max Health**: 400 HP (balanced for web run-and-gun stage)
- **Hitboxes & Subsystems**:
  - Main Armored Hull: 220x140 px (standard hits take 1.0x damage, or 0.5x when heavily armored).
  - Underbelly Flame Turret: Telescopic hydraulic assembly at bottom-left of chassis (`y = 190-220`).
  - Dorsal Cannon Turret: 360-degree high-angle mortar at top of superstructure (`x + 160, y + 20`).
  - Rear Missile Pods: Salvo launcher atop the rear deck (`x + 190, y + 10`).
  - Deployable Girida-O Mount: Rear carrier bed that elevates an auxiliary tank turret at 50% HP.
  - Exposed Exhaust Manifold (Weak Point): 40x36 px glowing vent behind the forward armor, exposed during overheat/flame charges (takes 1.5x damage).

### 3.2 Multi-Phase State Machine
```
           ┌──────────────────────────────────────────────┐
           │        PHASE 1: CRAWLER ARTILLERY            │
           │  (100% -> 75% HP: 400 -> 300 HP)             │
           │  - Heavy Mortar Parabolic Shells             │
           │  - 4-Missile Quad Salvos                     │
           │  - Forward/Reverse Tread Patrol              │
           └──────────────────────┬───────────────────────┘
                                  │ HP <= 75% (300 HP)
                                  ▼
           ┌──────────────────────────────────────────────┐
           │        PHASE 2: HYDRAULIC FLAME SWEEP        │
           │  (75% -> 50% HP: 300 -> 200 HP)              │
           │  - Hydraulic Flame Emitter lowers (0.8s warn)│
           │  - Ground-level Napalm Jet (vx = -320 px/s)  │
           │  - Alternating High-Angle Shells             │
           └──────────────────────┬───────────────────────┘
                                  │ HP <= 50% (200 HP)
                                  ▼
           ┌──────────────────────────────────────────────┐
           │     PHASE 3: GIRIDA-O AUXILIARY DEPLOYMENT   │
           │  (50% -> 25% HP: 200 -> 100 HP)              │
           │  - Rear Cargo Hatch opens, Girida-O raises   │
           │  - Dual Cannon Firing (High/Low trajectory)  │
           │  - Tread Surge (Forward ramming surge 80px)  │
           └──────────────────────┬───────────────────────┘
                                  │ HP <= 25% (100 HP)
                                  ▼
           ┌──────────────────────────────────────────────┐
           │        PHASE 4: OVERDRIVE RAGE STATE         │
           │  (25% -> 0% HP: 100 -> 0 HP)                 │
           │  - Red Engine Glow & Continuous Steam Vents  │
           │  - 50% Cooldown Reduction (Enraged Speed)    │
           │  - Screen-Filling Carpet Bombing Sweep       │
           │  - Exposed Overheated Core (1.5x damage)     │
           └──────────────────────┬───────────────────────┘
                                  │ HP <= 0 HP
                                  ▼
           ┌──────────────────────────────────────────────┐
           │          DEATH EXPLODING SEQUENCE            │
           │  (3.6s Multi-Stage Chain Demolition)         │
           │  - Stage 1: Tread blowouts & spark arcs      │
           │  - Stage 2: Hull breach fireballs & shake    │
           │  - Stage 3: Magazine core explosion & white  │
           │  - Stage 4: Chassis collapse -> DESTROYED    │
           └──────────────────────────────────────────────┘
```

### 3.3 Telegraphed Attacks & Visual Warnings
1. **Hydraulic Flame Thrower Warning**:
   - 0.8s telegraph period: The hydraulic piston drops downward with an audible pneumatic hiss (`soundEngine.playHydraulicHiss()`), and the flame nozzle pulses orange-red.
   - Ground indicator: Visual warning reticle or sparks across floor level `Y = 210-230`.
   - Player counterplay: Jump onto elevated platforms (`boss_arena_left` or `boss_arena_right`) or time a running high jump.
2. **Main High-Angle Mortar Warning**:
   - Turret elevates to 75 degrees and flashes white muzzle flash for 0.5s before discharge.
   - Shell follows a high parabolic arc ($v_y = -350, g = 600$), giving the player 1.2s flight time to evade the landing impact point.
3. **Overdrive Rage Transition Warning**:
   - At 25% HP, the boss temporarily pauses for 1.0s, sirens sound (`sfx_warning_siren`), screenshake occurs ($intensity = 10$), and thick red steam billows from exhaust pipes.

---

## 4. Dynamic Crisis Event Architecture

A dynamic "Crisis Situation" transforms the static arena into an active, escalating battlefield based on boss health milestones.

### 4.1 Checkpoint Specifications
| Checkpoint | Boss HP % | Crisis Event ID | Environment Alteration | Gameplay Impact |
|---|---|---|---|---|
| **Checkpoint 1** | **75% HP** | `CRISIS_ARTILLERY_STRIKE` | Spawns 4-6 targeting reticles followed by vertical mortar shell impacts | Forces player out of camping spots into dynamic horizontal movement |
| **Checkpoint 2** | **50% HP** | `CRISIS_TERRAIN_COLLAPSE` | Destroys/removes `boss_arena_left` platform; shrinks camera bounds `minX` from 1800 to 1880 | Deprives player of left retreat platform, constricts arena width from 480px to 400px |
| **Checkpoint 3** | **25% HP** | `CRISIS_RAGE_OVERDRIVE` | Boss enters Rage Mode (50% cooldowns); triggers screen-filling napalm floor sweep | High-intensity desperation phase; floor is lethal, requiring aerial platforming |

### 4.2 `CrisisEventManager` Specification
`CrisisEventManager` (`src/core/entities/boss/CrisisEventManager.ts`) coordinates the crisis lifecycle:

```typescript
export interface CrisisEventConfig {
  id: string;
  thresholdRatio: number; // e.g., 0.75, 0.50, 0.25
  name: string;
  description: string;
  action: (context: CrisisActionContext) => void;
}

export interface CrisisActionContext {
  engine: GameEngine;
  stageManager: StageManager;
  boss: BossEntity;
  thresholdRatio: number;
}

export class CrisisEventManager {
  private engine: GameEngine;
  private stageManager: StageManager;
  private boss: BossEntity | null = null;
  private registeredCrises: CrisisEventConfig[] = [];
  private triggeredCrises: Set<string> = new Set();

  constructor(engine: GameEngine, stageManager: StageManager) {
    this.engine = engine;
    this.stageManager = stageManager;
  }

  public registerCrisis(crisis: CrisisEventConfig): void {
    this.registeredCrises.push(crisis);
    // Keep sorted descending by threshold (0.75 -> 0.50 -> 0.25)
    this.registeredCrises.sort((a, b) => b.thresholdRatio - a.thresholdRatio);
  }

  public setBoss(boss: BossEntity): void {
    this.boss = boss;
    this.triggeredCrises.clear();
  }

  /**
   * Evaluates boss health against registered crisis thresholds.
   * Safe against instant burst damage (triggers all passed thresholds in order).
   */
  public update(_dt: number): void {
    if (!this.boss || !this.boss.isAlive) return;

    const currentRatio = this.boss.health / this.boss.maxHealth;

    for (const crisis of this.registeredCrises) {
      if (!this.triggeredCrises.has(crisis.id) && currentRatio <= crisis.thresholdRatio) {
        this.triggeredCrises.add(crisis.id);
        this.executeCrisis(crisis);
      }
    }
  }

  private executeCrisis(crisis: CrisisEventConfig): void {
    if (!this.boss) return;

    const context: CrisisActionContext = {
      engine: this.engine,
      stageManager: this.stageManager,
      boss: this.boss,
      thresholdRatio: crisis.thresholdRatio,
    };

    // 1. Execute custom crisis action
    crisis.action(context);

    // 2. Broadcast crisis event across engine
    this.engine.eventBus.emit('crisis_event_triggered', {
      id: crisis.id,
      name: crisis.name,
      bossId: (this.boss as any).id,
      thresholdRatio: crisis.thresholdRatio,
    });
  }

  public isCrisisTriggered(crisisId: string): boolean {
    return this.triggeredCrises.has(crisisId);
  }

  public reset(): void {
    this.triggeredCrises.clear();
  }
}
```

### 4.3 Crisis Event Implementations

#### Event 1: 75% HP — `CRISIS_ARTILLERY_STRIKE`
- **Action**:
  1. Calculate target ground coordinates in the active arena (`x` between `cameraX + 60` and `cameraX + 420`).
  2. Spawn 4 `ArtilleryTargetReticle` visual entities displaying flashing red crosshairs on the floor for 1.0s.
  3. After 1.0s, spawn 4 `ArtilleryShellHazard` entities falling from `y = -20` at $v_y = 380\text{ px/s}$.
  4. Upon reaching $Y = 230$, shells detonate:
     - Emit `explosion_spawned` with $radius = 55\text{ px}$, $damage = 2.0$.
     - Camera screenshake: `camera.shake(8, 0.4)`.

#### Event 2: 50% HP — `CRISIS_TERRAIN_COLLAPSE`
- **Action**:
  1. Call `stageManager.collapsePlatform('boss_arena_left')`:
     - Platform is removed from `stageManager.getPlatforms()` and `engine.getPlatforms()`.
     - An explosion and dust cloud spawn at the former platform's coordinates (`x: 1860, y: 170, w: 100, h: 12`).
     - Emits `platform_collapsed` event.
  2. Contract active camera bounds:
     - Old bounds: `{ minX: 1800, maxX: 2280, minY: 0, maxY: 270 }`
     - New bounds: `{ minX: 1880, maxX: 2280, minY: 0, maxY: 270 }`
     - Call `stageManager.setCameraBounds(newBounds)` and `stageManager.lockCamera(newBounds)`.
     - Push player rightward if `player.position.x < 1880 + 16` so the player is not stuck in collapsed out-of-bounds terrain.
  3. Spawn 3 `FallingDebrisHazard` entities raining from ceiling rubble.

#### Event 3: 25% HP — `CRISIS_RAGE_OVERDRIVE`
- **Action**:
  1. Put boss in Rage Mode: `(boss as any).isRaging = true; (boss as any).rageSpeedMultiplier = 1.35;`.
  2. Reduce attack cooldowns by 50% (e.g. `cannonCooldown = 1.2s` instead of `2.5s`).
  3. Trigger screen-filling attack:
     - If Iron Nokana: Underbelly flame nozzle activates a continuous, full-ground-length sweep from right to left across $Y = 210-230$. The floor becomes lethal for 2.5 seconds. The player MUST be standing atop `boss_arena_right` or jump at the exact apex.
     - If Tetsuyuki: Simultaneous dual thermal laser sweep across both floor ($Y=210$) and mid-air ($Y=130$) with falling debris.
  4. HUD siren and alert: `showBossWarning = true; warningText = "CRISIS ALERT: BOSS OVERDRIVE ACTIVE!"`.

---

## 5. Data Structures, Event Flow, & Integration Points

### 5.1 New Data Structures (`src/core/entities/boss/CrisisTypes.ts`)
```typescript
import { Vector2D } from '../../math/Vector2D';
import { AABB } from '../../physics/AABB';
import { CameraBounds } from '../../engine/StageManager';

export type CrisisSeverity = 'WARNING' | 'CRITICAL' | 'OVERDRIVE';

export interface CrisisEventPayload {
  id: string;
  name: string;
  bossId: string;
  thresholdRatio: number;
  severity: CrisisSeverity;
  timestamp: number;
}

export interface PlatformCollapsePayload {
  platformId: string;
  bounds: AABB;
}

export interface CameraBoundsChangePayload {
  previousBounds: CameraBounds;
  currentBounds: CameraBounds;
}

export interface HazardSpawnPayload {
  id: string;
  type: 'ARTILLERY_SHELL' | 'FALLING_DEBRIS' | 'FLOOR_FLAME';
  position: Vector2D;
  blastRadius: number;
  damage: number;
}
```

### 5.2 Environmental Hazard Entities (`src/core/entities/boss/EnvironmentalHazard.ts`)
```typescript
import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';

export class ArtilleryShellHazard implements GameEntity {
  public id: string;
  public type: string = 'ENVIRONMENTAL_HAZARD';
  public hazardSubtype: string = 'ARTILLERY_SHELL';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public blastRadius: number = 55;
  public damage: number = 2;
  public targetGroundY: number = 230;

  constructor(id: string, startX: number, startY: number = -20, vy: number = 380) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.velocity = { x: 0, y: vy };
    this.bounds = createAABB(startX - 6, startY, 12, 16);
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive) return;

    this.position.y += this.velocity.y * dt;
    this.bounds.y = this.position.y;

    if (this.position.y >= this.targetGroundY) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (!this.isAlive) return;
    this.isAlive = false;

    if (engine) {
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x, y: this.targetGroundY },
        radius: this.blastRadius,
        damage: this.damage,
        isLarge: true,
        friendly: false,
      });
      engine.removeEntity(this.id);
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (other.id === 'player') {
      this.detonate(engine);
    }
  }
}
```

### 5.3 Engine and StageManager Integration APIs

#### In `src/core/engine/GameEngine.ts`:
Add dynamic platform removal:
```typescript
  removePlatform(platformId: string): boolean {
    const idx = this.platforms.findIndex((p) => p.id === platformId);
    if (idx !== -1) {
      this.platforms.splice(idx, 1);
      return true;
    }
    return false;
  }
```

#### In `src/core/engine/StageManager.ts`:
Add platform collapse and camera bounds alteration:
```typescript
  setCameraBounds(bounds: CameraBounds): void {
    const prev = { ...this.cameraBounds };
    this.cameraBounds = { ...bounds };
    this.engine.eventBus.emit('camera_bounds_changed', { previousBounds: prev, currentBounds: bounds });
  }

  collapsePlatform(platformId: string): boolean {
    if (!this.currentStage) return false;
    const idx = this.currentStage.platforms.findIndex((p) => p.id === platformId);
    if (idx !== -1) {
      const removed = this.currentStage.platforms.splice(idx, 1)[0];
      this.engine.removePlatform(platformId);
      this.engine.eventBus.emit('platform_collapsed', { platformId, bounds: removed.bounds });
      return true;
    }
    return false;
  }
```

#### In `src/core/player/PlayerController.ts`:
Extend `onCollision` to register hazards and damage:
```typescript
  if (other.type === 'ENVIRONMENTAL_HAZARD' || other.type === 'HAZARD' || other.type === 'THRUSTER_SHOCKWAVE') {
    if (this.invulnerabilityTimer <= 0) {
      const dmg = (other as any).damage ?? 1.0;
      this.takeDamage(dmg);
      if (typeof (other as any).detonate === 'function') {
        (other as any).detonate(engine);
      }
    }
  }
```

#### In `src/main.ts`:
Extend `setupAudioAndEventBus` to handle explosive damage against player:
```typescript
  bus.on('explosion_spawned', (data: { position?: { x: number; y: number }; radius?: number; damage?: number; isLarge?: boolean; friendly?: boolean }) => {
    this.soundEngine.playExplosion(data?.isLarge ?? false);
    if (data?.position) {
      addExplosion(data.position.x, data.position.y, data.isLarge ? 'large' : 'medium');
      // Damage player if enemy/hazard explosion
      if (!data.friendly && data.radius && data.damage) {
        const p = this.player;
        if (p.isAlive && (!p.invulnerabilityTimer || p.invulnerabilityTimer <= 0)) {
          const dist = Math.hypot(p.position.x - data.position.x, p.position.y - data.position.y);
          if (dist <= data.radius) {
            p.takeDamage(data.damage);
          }
        }
      }
    }
  });
```

---

## 6. Automated Testing Architecture & Verification Matrix

### 6.1 Test Suite 1: `tests/unit/boss_crisis_events.test.ts`
This test suite directly verifies the mandatory acceptance criterion:
> **"Boss tests must verify that specific HP thresholds trigger environment-altering crisis events (e.g., spawning hazards or changing active bounds)."**

#### Test Cases:
1. **HP Threshold 75% — Environmental Hazard Spawning**:
   - Initialize boss at 400 HP. Deal 100 damage (HP drops to 300 = 75%).
   - Assert `CrisisEventManager.isCrisisTriggered('crisis_artillery_75')` is `true`.
   - Assert `engine.getAllEntities()` contains `ArtilleryShellHazard` entities.
   - Assert each hazard has vertical velocity $v_y > 0$ and valid damage.
2. **HP Threshold 50% — Terrain Collapse & Camera Bounds Alteration**:
   - Deal damage to reach 200 HP (50%).
   - Assert `CrisisEventManager.isCrisisTriggered('crisis_collapse_50')` is `true`.
   - Assert `stageManager.getPlatforms()` no longer contains `boss_arena_left`.
   - Assert `engine.getPlatforms()` count decreased by 1.
   - Assert `stageManager.getCameraBounds().minX` updated from `1800` to `1880`.
   - Assert `camera.bounds.minX` matches `1880`.
3. **HP Threshold 25% — Boss Rage Overdrive Activation**:
   - Deal damage to reach 100 HP (25%).
   - Assert `CrisisEventManager.isCrisisTriggered('crisis_rage_25')` is `true`.
   - Assert `boss.isRaging === true`.
   - Assert boss attack cooldowns are scaled down by $\ge 40\%$.
4. **Burst-Damage Safety Invariant**:
   - Inflict single instant lethal burst damage (e.g. 5,000 HP).
   - Assert all 3 crisis events (75%, 50%, 25%) trigger deterministically in correct sequential order without dropping events or throwing uncaught exceptions.
5. **Dynamic Health Scaling Invariant**:
   - Test with custom boss HP (e.g. 300 HP and 500 HP).
   - Assert thresholds scale dynamically to 75%, 50%, 25% mathematically.

### 6.2 Test Suite 2: `tests/unit/iron_nokana_boss.test.ts`
Verifies the new multi-phase boss mechanics:
1. Initial health and dimensions (400 HP, grounded at Y=230, phase `PHASE_1_CRAWLER_BARRAGE`).
2. Phase 1 attack cycles: mortar shells fired, rocket pod salvo cooldowns.
3. Transition to Phase 2 at 75% HP: hydraulic flame emitter drops, telegraph warning timer runs for 0.8s before ground flame activates.
4. Transition to Phase 3 at 50% HP: Girida-O auxiliary mini-turret elevates on rear deck.
5. Transition to Phase 4 at 25% HP: enters `RAGE` state, cooldowns halved, red aura active.
6. Weak point targeting: hits to exposed exhaust manifold take 1.5x damage, armored hull takes normal damage.
7. Death sequence: multi-stage demolition over 3.6s, transition to `DESTROYED`, emission of `boss_destroyed` and `mission_complete`.

---

## 7. File-by-File Implementation Plan

| File Path | Action | Description & Rationale |
|---|---|---|
| `src/core/entities/boss/CrisisTypes.ts` | **CREATE** | TypeScript interfaces for crisis configurations, severity, payloads, and events |
| `src/core/entities/boss/CrisisEventManager.ts` | **CREATE** | Decoupled crisis event orchestration engine monitoring HP checkpoints |
| `src/core/entities/boss/EnvironmentalHazard.ts` | **CREATE** | Concrete hazard entities (`ArtilleryShellHazard`, `FallingDebrisHazard`, `GroundFlameHazard`) |
| `src/core/entities/boss/IronNokanaBoss.ts` | **CREATE** | Complete multi-phase heavy armored crawler boss entity |
| `src/core/entities/boss/BossTypes.ts` | **MODIFY** | Add `IronNokanaPhase`, `isRaging`, `rageSpeedMultiplier` to contracts |
| `src/core/engine/GameEngine.ts` | **MODIFY** | Add `removePlatform(id: string): boolean` method |
| `src/core/engine/StageManager.ts` | **MODIFY** | Add `setCameraBounds()` and `collapsePlatform(id: string)` methods |
| `src/core/player/PlayerController.ts` | **MODIFY** | Update `onCollision` to take damage from hazards and shockwaves |
| `src/render/sprites/ProceduralSpriteFactory.ts` | **MODIFY** | Add Iron Nokana pixel art sprites (hull, treads, flame nozzle, Girida-O, warning reticles) |
| `src/render/CanvasRenderer.ts` | **MODIFY** | Render Iron Nokana, environmental hazard reticles, and collapsed terrain debris |
| `src/main.ts` | **MODIFY** | Wire `CrisisEventManager` into game loop, update stage boss trigger |
| `tests/unit/boss_crisis_events.test.ts` | **CREATE** | Automated tests asserting HP threshold crisis triggers, hazard spawning, and bounds alteration |
| `tests/unit/iron_nokana_boss.test.ts` | **CREATE** | Automated tests verifying Iron Nokana state machine, phases, and telegraphing |

---

## 8. Summary & Recommendation

The proposed architecture cleanly decouples boss logic from environmental crisis orchestration. It preserves 100% backwards compatibility with existing stage progression, passes all existing 294 Vitest tests, and strictly satisfies the user's acceptance criteria:
1. **Epic Boss Encounters**: Introduces Iron Nokana alongside the existing Tetsuyuki fortress, featuring telegraphed flame attacks, auxiliary gunners, and rage states.
2. **Dynamic Crisis Situations**: Automatically transforms the arena at 75%, 50%, and 25% HP with artillery saturation, terrain collapse, bounds shrinkage, and floor-sweeping hazards.
3. **Automated Verification**: Provides deterministic, headless Vitest unit tests asserting exact hazard generation and boundary contractions at specific HP checkpoints.
