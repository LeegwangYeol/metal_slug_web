# Project: Metal Slug Web (Full Metal Slug)

## Architecture
Decoupled multi-tier simulation and presentation architecture:
1. **Simulation Core (`src/core/`)**:
   - 100% decoupled from DOM, Window, and Canvas APIs.
   - Operates in fixed 60Hz timestep semi-implicit Euler integration (`dt = 1/60`).
   - Pure state machines for Player, Weapons, Projectiles, Enemy AI, POWs, and Stage 1 End-Boss.
   - Enables instantaneous, deterministic headless unit testing under Vitest in standard Node.js runtime.
2. **Render Layer (`src/render/`)**:
   - HTML5 2D Canvas rendering with procedural pixel-art rasterization and sprite sheet caching into OffscreenCanvas buffers.
   - 4-layer parallax scrolling background system and dynamic camera tracking with stage progression locks.
   - Virtual resolution letterboxing (480x270 scaled with crisp nearest-neighbor sampling).
3. **Audio Layer (`src/audio/`)**:
   - Web Audio API procedural sound synthesis (FM oscillators, noise bursts, exponential gain envelopes).
   - Formant speech filter announcer voice engine for iconic arcade voice clips ("HEAVY MACHINE GUN!", "FLAME SHOT!", "OK!", "MISSION COMPLETE!").
4. **Input & UI Layer (`src/input/`, `src/ui/`)**:
   - Dual input layer: Keyboard mapping (WASD/Arrows + J Fire, K Jump, L Grenade) and on-screen Touch D-pad / action buttons.
   - Retro arcade HUD rendering: score, lives, weapon icon, ammo counter, hostage rescue counter, and boss HP bar.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Simulation Core & Math | Fixed 60Hz tick, Vector2D kinematics, AABB collisions, spatial hash grid | M1 | survey |
| 2 | Player Kinematics & Physics | Run (132 px/s), Crawl (54 px/s), Jump (-348 px/s), gravity (720 px/s²), variable jump cut | M1 | survey |
| 3 | Semi-Solid Platform Engine | Pass-through from below, snap to top surface, one-way drop through on Down+Jump | M1 | survey |
| 4 | 8-Way Aiming System | Horizontal, upward, up-diagonals, airborne downward/down-diagonals | M2 | survey |
| 5 | Melee vs Ranged Decision | 38px forward reach detection -> knife slash (3.0 HP), else projectile | M2 | survey |
| 6 | Default Handgun | Infinite ammo, semi-automatic rapid firing, 4 max on-screen projectile throttle | M2 | survey |
| 7 | Heavy Machine Gun ("H") | 200 rounds, 15 shots/s auto fire, 12 rad/s angle sweep with ±2.5° spray, brass casings | M2 | survey |
| 8 | Flame Shot ("F") | 30 ammo, continuous expanding fireball (10->36px), piercing multi-hit, ground burning AOE | M2 | survey |
| 9 | Hand Grenade Toss | Parabolic arc, ground bounce restitution (ey=0.5, ex=0.7), 52px blast radius AOE | M2 | survey |
| 10 | Ammo Auto-Fallback | Instantaneous automatic fallback to pistol when special weapon ammo reaches 0 | M2 | survey |
| 11 | Hostage POW Pipeline | 6-state machine (Tied -> Freed -> Salute -> Drop -> Escape -> Saved) + loot table | M2 | survey |
| 12 | Rebel Infantry AI | Rifleman (ranged), Knife Charger (rush), Grenade Thrower (curved), Shield Trooper (frontal block) | M3 | survey |
| 13 | Mid-Boss Iron Technical | Armored vehicle, tread motion, 360° turret tracking (1.8 rad/s), cannon shells, troop spawns | M3 | survey |
| 14 | Stage 1 Boss Tetsuyuki | 3-phase fortress: Phase 1 artillery/rockets, Phase 2 hull breach/laser, Phase 3 thruster core | M3 | survey |
| 15 | Procedural Pixel-Art Engine | Dynamic 16-color procedural rasterization for soldier, rebel, POW, vehicles, effects | M4 | survey |
| 16 | Parallax Camera System | 4-layer parallax backgrounds, camera deadzone tracking, forward-only scrolling | M4 | survey |
| 17 | Web Audio SFX Engine | Procedural synthesis for gunshots, explosions, knife slashes, and impacts | M5 | survey |
| 18 | Formant Voice Announcer | Formant speech synthesis for "HEAVY MACHINE GUN!", "FLAME SHOT!", "OK!", "MISSION COMPLETE!" | M5 | survey |
| 19 | Game Integration & Input | Main game loop, keyboard/touch input handlers, retro HUD display | M6 | survey |
| 20 | Vitest Unit Test Suite | Headless unit tests for weapons, ammo fallback, state machines, melee logic | T1/T2 | survey |
| 21 | Playwright E2E Test Suite | Headless browser boot, Canvas 60 FPS loop, zero uncaught console errors | T3 | survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffolding & Core Engine | Project setup (package.json, tsconfig, vite), math/vector, physics, AABB, platform engine | None | DONE |
| M2 | Player, Weapons & POWs | 8-way aim, melee slash vs shot, Handgun, HMG, FlameShot, Grenade, fallback, POWs | M1 | DONE |
| M3 | Enemies, Mid-Boss & Boss | Rebel infantry (4 types), Mid-boss vehicle, 3-phase Tetsuyuki fortress & death sequence | M1 | DONE |
| M4 | Procedural Pixel-Art & Render | Pixel-art sprite generator, OffscreenCanvas cache, 4-layer parallax, camera system | M1 | DONE |
| M5 | Web Audio & Announcer Engine | Sound effects synthesizer (gunfire, explosions) & formant speech announcer | M1 | DONE |
| M6 | Game Integration & Polish | Complete game loop assembly, input mapping, retro HUD, stage progression | M2, M3, M4, M5 | DONE |
| T1 | Unit Test Suite (Weapons & State) | Vitest tests for player weapons, ammo fallback, melee/ranged decision | M2 | DONE |
| T2 | Unit Test Suite (Enemies & Boss) | Vitest tests for infantry AI, mid-boss, and boss phases / damage / death | M3 | DONE |
| T3 | Playwright E2E Integration | Headless browser test: canvas boot, 60 FPS loop running, 0 fatal console errors | M6 | DONE |

---

## Interface Contracts

### 1. `src/core/math/Vector2D.ts`
```typescript
export interface Vector2D {
  x: number;
  y: number;
}
```

### 2. `src/core/physics/AABB.ts`
```typescript
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### 3. `src/core/weapons/WeaponTypes.ts`
```typescript
export type WeaponType = 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT';

export interface WeaponState {
  type: WeaponType;
  ammo: number; // Infinity for PISTOL, 200 for HMG, 30 for FLAME_SHOT
  maxAmmo: number;
  fireRate: number; // shots per second
  cooldownRemaining: number;
  isAutomatic: boolean;
}
```

### 4. `src/core/player/PlayerController.ts`
```typescript
export interface PlayerState {
  position: Vector2D;
  velocity: Vector2D;
  isGrounded: boolean;
  isCrouching: boolean;
  aimDirection: Vector2D;
  currentWeapon: WeaponState;
  grenadeCount: number;
  health: number;
  lives: number;
  score: number;
  isAttackingMelee: boolean;
  meleeCooldown: number;
}
```

### 5. `src/core/entities/enemies/EnemyTypes.ts`
```typescript
export type EnemyType = 'SOLDIER_RIFLE' | 'SOLDIER_KNIFE' | 'SOLDIER_GRENADE' | 'SOLDIER_SHIELD' | 'MID_BOSS_VEHICLE';

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  position: Vector2D;
  velocity: Vector2D;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isMeleeVulnerable: boolean;
  boundingBox: AABB;
  facing: 1 | -1;
  state: string;
}
```

### 6. `src/core/entities/boss/BossTypes.ts`
```typescript
export type BossPhase = 'PHASE_1_ARTILLERY' | 'PHASE_2_LASER_SWEEP' | 'PHASE_3_MELTDOWN' | 'DEATH_EXPLODING' | 'DESTROYED';

export interface BossEntity {
  health: number;
  maxHealth: number;
  phase: BossPhase;
  position: Vector2D;
  turretsAlive: number;
  weakPointExposed: boolean;
  weakPointBox: AABB;
  takeDamage(amount: number, isWeakPoint?: boolean): void;
  update(dt: number): void;
}
```

---

## Code Layout
```
/Users/user/src/fullmetalslug/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── index.html
├── src/
│   ├── main.ts                     # Entry point & bootstrap
│   ├── core/                       # 100% PURE SIMULATION (No DOM/Canvas)
│   │   ├── math/Vector2D.ts
│   │   ├── physics/AABB.ts, SpatialGrid.ts
│   │   ├── engine/GameEngine.ts, StageManager.ts
│   │   ├── player/PlayerController.ts, PlayerKinematics.ts
│   │   ├── weapons/WeaponManager.ts, ProjectileManager.ts, Grenade.ts
│   │   └── entities/
│   │       ├── pow/PowEntity.ts
│   │       ├── enemies/SoldierEnemy.ts, MidBossVehicle.ts
│   │       └── boss/TetsuyukiBoss.ts
│   ├── render/                     # HTML5 2D Canvas & Pixel Art
│   │   ├── CanvasRenderer.ts
│   │   ├── Camera.ts
│   │   ├── ParallaxBackground.ts
│   │   └── sprites/ProceduralSpriteFactory.ts
│   ├── audio/                      # Web Audio API & Announcer
│   │   ├── SoundEngine.ts
│   │   └── SpeechSynthesizer.ts
│   └── input/                      # Input Controllers
│       ├── KeyboardController.ts
│       └── TouchVirtualPad.ts
└── tests/
    ├── unit/
    │   ├── player_weapon_state.test.ts
    │   ├── enemy_boss_statemachine.test.ts
    │   └── melee_ranged_decision.test.ts
    └── e2e/
        └── game_initialization.spec.ts
```
