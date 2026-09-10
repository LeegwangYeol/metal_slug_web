# Milestone M3: Occult Arsenal & Weapon Architecture — Handoff Report

**Agent**: Explorer 1 (`explorer_df_m3_1`)  
**Mission**: Milestone M3 — Occult Arsenal, Upgrades & Horde Director Architecture Design  
**Date**: 2026-09-10  
**Target Project**: Grim Harvest: Undead Siege (`/Users/user/teamwork_projects/metal_slug_web`)

---

## 1. Observation

Direct code inspection of the existing codebase revealed the following structural foundations, interfaces, and constraints:

### 1.1 Spatial Partitioning & Query Capabilities (`src/core/SpatialHashGrid.ts`)
- **Center-Registered Grid**: Lines 80–102 (`SpatialHashGrid.insert`) register each entity by center coordinates into a flat `Int32Array` linked list (`cellHeads` and `entityNext`).
- **Radius Query**: Lines 128–168 (`SpatialHashGrid.queryRadius(x, y, radius, outIds)`):
  ```typescript
  public queryRadius(x: number, y: number, radius: number, outIds: Int32Array | number[]): number
  ```
  Zero allocations when passed a pre-allocated buffer `outIds`.
- **Iteration without Arrays**: Lines 222–256 (`SpatialHashGrid.forEachInRadius(x, y, radius, callback)`):
  Permits early exit (`return false`), optimal for finding nearest targets without filling buffers.
- **Coordinates Cache**: Lines 42–43 (`entityX`, `entityY` as contiguous `Float32Array`), enabling sub-50ns narrowphase distance evaluations.

### 1.2 Horde Management & Hit Detection (`src/core/HordeManager.ts` & `src/core/entities/Enemy.ts`)
- **Pre-allocated Pool**: `HordeManager` maintains a 2048-entity pool with O(1) swap-and-pop recycling (`pool: Enemy[]`, lines 77–92).
- **Damage Application**: Lines 204–238 (`HordeManager.applyDamage(id, amount, knockbackX, knockbackY)`):
  ```typescript
  export interface DamageResult {
    killed: boolean;
    xpValue: number;
    gemType: GemType; // 'emerald' | 'ruby' | 'violet' | 'chest'
    x: number;
    y: number;
    enemyType: EnemyType;
  }
  ```
  - Directly reduces enemy HP: `enemy.takeDamage(amount, knockbackX, knockbackY)` (Enemy.ts lines 116–134).
  - Automatically handles despawning and pool recycling on kill: `if (killed) { this.despawn(id); }` (HordeManager.ts line 234).
  - Automatically increments `this.totalKilled++` (HordeManager.ts line 194).
- **Spatial Helper Queries**:
  - `getNearestEnemy(x, y, maxRadius)` (lines 405–423): Finds the closest living enemy using spatial grid iteration.
  - `getEnemiesInRadius(x, y, radius, outIds)` (lines 393–400): Zero-allocation query writing into caller's buffer.

### 1.3 Player Entity & Core Statistics (`src/core/entities/Player.ts` & `src/core/player/PlayerStats.ts`)
- **Player Stats Interface**:
  ```typescript
  export interface PlayerStats {
    maxHealth: number;
    currentHealth: number;
    healthRegen: number;
    armor: number;
    moveSpeed: number;
    might: number;              // Damage multiplier (e.g., 1.0, 1.25)
    area: number;               // Radius / AoE multiplier (e.g., 1.0, 1.25)
    projSpeed: number;          // Projectile / orbital velocity multiplier
    cooldownReduction: number;  // Hard clamped [0.0, 0.50] (50% max CDR ceiling)
    magnetRadius: number;
    luck: number;               // Crit / drop multiplier
  }
  ```
- **Player Position & Orientation**:
  - `position: Vector2D` (`{ x: number, y: number }`)
  - `facingAngle: number` (radians, top-down 360°)
  - `facingDirection: 1 | -1`

### 1.4 Loot Spawning & Drops (`src/core/systems/LootManager.ts`)
- **Loot Drop Types**:
  - `'emerald'` -> `LootDropType.EMERALD_SHARD` (1 XP)
  - `'ruby'` -> `LootDropType.RUBY_GEM` (5 XP)
  - `'violet'` -> `LootDropType.VIOLET_ABYSSAL` (25 XP)
  - `'chest'` -> `LootDropType.SOUL_CHEST` (100 XP + 50 HP)
- **Spawn Method**: `lootManager.spawnDrop(dropType, x, y, scatter)` (lines 149–173).

### 1.5 Gothic Render, Palette & VFX (`src/render/`)
- **Gothic Palette (`src/render/DarkFantasyPalette.ts`)**:
  - `PALETTE.CURSED_ARCANE`: `AURA` (`#b794f6`), `VIOLET` (`#7038b8`), `DEEP` (`#1a0c2e`)
  - `PALETTE.NECROTIC_EMERALD`: `GLOW` (`#68d391`), `BRIGHT` (`#28a745`), `CORE` (`#19633e`)
  - `PALETTE.BLOOD_CRIMSON`: `FLASH` (`#e53e3e`), `VIVID` (`#a81d1d`), `DRIED` (`#380a0a`)
  - `PALETTE.BONE_IVORY`: `POLISHED` (`#ede5de`), `BLEACHED` (`#b8aea5`)
- **VFX Particle Emission (`src/render/vfx/DarkFantasyVFX.ts`)**:
  - `vfx.emitBloodBurst(x, y, count, dirX, dirY)` (lines 196–239)
  - `vfx.emitBoneShatter(x, y, count)` (lines 241–274)
  - `vfx.emitSoulBurst(x, y, gemType, count)` (lines 276–317)
  - `vfx.emitSpellTrail(x, y, color, size)` (lines 354–386)
  - `vfx.emitSpellCircle(x, y, radius, duration, color)` (lines 388–422)
- **Gothic HUD Slots (`src/ui/GothicHUD.ts`)**:
  - Lines 65–73: `InventorySlotData` expects exact weapon icons: `'scythe' | 'orbiters' | 'lightning' | 'spear' | 'aura'`.
  - Line 87: `player.weapons?: InventorySlotData[]` rendered directly into the top left gothic weapon slots with rank pips (I to V).

---

## 2. Logic Chain

### 2.1 Cooldown & Cooldown Reduction (CDR) Application
- **Observation**: `PlayerStats.cooldownReduction` is hard-clamped to `[0.0, 0.50]` by `PlayerStatsManager.getEffectiveStats()` (PlayerStats.ts lines 105–107).
- **Inference**: Every weapon must apply CDR dynamically on each frame tick:
  $$\text{effectiveCooldown} = \text{baseCooldown} \times (1.0 - \text{player.stats.cooldownReduction})$$
- **Overflow Compensation**: Internal timers must subtract `effectiveCooldown` rather than resetting to `0` to prevent frame-rate dependent fire delay:
  ```typescript
  this.timer += dt;
  if (this.timer >= effectiveCooldown) {
    this.timer -= effectiveCooldown;
    this.fire(...);
  }
  ```

### 2.2 Stat Scaling Integration
- **Damage (Might)**:
  $$\text{damage} = \text{Math.round}(\text{baseDamage} \times \text{player.stats.might})$$
- **Area of Effect (Area)**:
  $$\text{effectiveRadius} = \text{baseRadius} \times \text{player.stats.area}$$
  (Scales Arcane Scythe cleave radius, Soul Orbiters distance, Cursed Aura pulse radius, and Lightning search radius).
- **Projectile Speed**:
  $$\text{effectiveSpeed} = \text{baseSpeed} \times \text{player.stats.projSpeed}$$
  (Scales Bone Spear velocity and Soul Orbiters angular orbital velocity $\omega$).

### 2.3 Zero Heap Allocation Invariant in 60Hz Loop
- **Problem**: Projectiles, lightning bolts, and spatial query arrays spawned repeatedly in the 60Hz loop will trigger garbage collection pauses, breaking locked 60Hz performance.
- **Solution**:
  1. **Pooled Projectiles (`ProjectilePool`)**: Fixed capacity of 256 `Projectile` instances with integer free list and swap-and-pop active tracking.
  2. **Intrusive Hit Memory on Projectiles**: Each `Projectile` has a fixed-size `hitEnemyIds: Int16Array(16)` and `hitCount: number`. Testing whether an enemy was already hit is an O(k) linear scan over $k \le 16$, without creating `Set` or `Array` allocations.
  3. **Continuous Contact Hit Cooldown**: For `Soul Orbiters` and `Cursed Aura`, a flat `lastHitTimestamps = new Float32Array(2048)` array indexed directly by `enemy.id` (0 to 2047) prevents allocating hit cooldown objects:
     $$\text{simTime} - \text{lastHitTimestamps}[\text{enemy.id}] \ge \text{hitCooldown}$$
  4. **Scratch Query Buffers**: A pre-allocated `scratchEnemyIds = new Int32Array(1024)` in `WeaponManager` reused for all spatial queries.

### 2.4 The 5 Occult Weapons: Mechanics & Rank 1–5 Progression

#### 1. Arcane Scythe (`id: 'scythe'`)
- **Archetype**: Melee sweeping arc cleave.
- **Targeting**: Queries nearest enemy within 250px via `hordeManager.getNearestEnemy`. If none, aims at `player.facingAngle`.
- **Hit Detection**:
  - Range: $R = \text{baseRadius} \times \text{player.stats.area}$.
  - Sector angle: $\theta = \text{arcDegrees} \times \frac{\pi}{180}$.
  - Query `hordeManager.getEnemiesInRadius(player.x, player.y, R, scratch)`.
  - For each enemy: calculate relative angle $\Delta \phi = \text{normalizeAngle}(\text{atan2}(dy, dx) - \text{aimAngle})$.
  - If $|\Delta \phi| \le \frac{\theta}{2}$, apply damage and knockback along $\text{aimAngle}$.
- **Ranks**:
  - Rank 1: Damage 25, Cooldown 1.4s, Arc 110°, Radius 75px, Knockback 120.
  - Rank 2: Damage 35, Cooldown 1.3s, Arc 120°, Radius 85px, Knockback 140.
  - Rank 3: Damage 50, Cooldown 1.2s, Arc 135°, Radius 95px, Knockback 160 (+1 phantom reverse slash).
  - Rank 4: Damage 70, Cooldown 1.05s, Arc 150°, Radius 110px, Knockback 180.
  - Rank 5: Damage 95, Cooldown 0.9s, Arc 180°, Radius 130px, Knockback 220 (Dual blades cleave 180° semi-circle).

#### 2. Soul Orbiters (`id: 'orbiters'`)
- **Archetype**: Continuous contact orbital barrier.
- **Targeting**: Autonomous orbital kinematics around player.
- **Hit Detection**:
  - $N = 2 + (\text{rank} - 1)$ skulls (2 to 6).
  - Orbital radius: $R = 80\text{px} \times \text{player.stats.area}$.
  - Angular velocity: $\omega = 2.4\text{ rad/s} \times \text{player.stats.projSpeed}$.
  - Position of skull $i$: $(x_p + R \cos(\theta_i), y_p + R \sin(\theta_i))$ where $\theta_i = \theta_{\text{base}} + \frac{2\pi i}{N}$.
  - Contact query: `hordeManager.getEnemiesInRadius(skullX, skullY, 16 + enemy.radius, scratch)`.
  - Damage applied if `simTime - lastHit[enemy.id] >= hitCooldown` (hit cooldown 0.40s down to 0.28s).
- **Ranks**:
  - Rank 1: 2 Skulls, Damage 14, Hit CD 0.40s, Orbit R 75px.
  - Rank 2: 3 Skulls, Damage 18, Hit CD 0.38s, Orbit R 80px.
  - Rank 3: 4 Skulls, Damage 24, Hit CD 0.35s, Orbit R 85px.
  - Rank 4: 5 Skulls, Damage 30, Hit CD 0.32s, Orbit R 90px.
  - Rank 5: 6 Skulls, Damage 42, Hit CD 0.28s, Orbit R 95px (Vortex of soul fire).

#### 3. Abyssal Lightning (`id: 'lightning'`)
- **Archetype**: Necrotic electrical strikes + chain arcs.
- **Targeting**: Finds up to $K$ random enemies within $\text{range} \times \text{player.stats.area}$ (320px to 440px).
- **Chain Mechanics**:
  - From each struck target, queries `hordeManager.getEnemiesInRadius(target.x, target.y, 110px, scratch)`.
  - Leaps to up to $B$ secondary targets (1 to 4 bounces).
  - Damage falloff: $D_{\text{bounce}} = D_{\text{primary}} \times (0.75)^{\text{bounce}}$.
  - Stores visual bolt vertices for multi-frame rendering.
- **Ranks**:
  - Rank 1: 1 Strike, 1 Bounce, Damage 45, Cooldown 2.0s, Range 320px.
  - Rank 2: 2 Strikes, 2 Bounces, Damage 60, Cooldown 1.85s, Range 350px.
  - Rank 3: 2 Strikes, 3 Bounces, Damage 80, Cooldown 1.70s, Range 380px.
  - Rank 4: 3 Strikes, 3 Bounces, Damage 105, Cooldown 1.55s, Range 410px.
  - Rank 5: 4 Strikes, 4 Bounces, Damage 140, Cooldown 1.35s, Range 450px (Catastrophic thunderstorm).

#### 4. Bone Spear (`id: 'spear'`)
- **Archetype**: High-velocity piercing projectile.
- **Targeting**: Aims directly at closest enemy within 450px via `hordeManager.getNearestEnemy`. If none, fires in `player.facingAngle`.
- **Kinematics & Pierce**:
  - Spawns $C$ spears (1 to 3). Multiple spears fan out at $10^\circ$ increments.
  - Velocity: $v = 520\text{ px/s} \times \text{player.stats.projSpeed}$.
  - Projectile steps forward: $x \leftarrow x + v_x dt, y \leftarrow y + v_y dt$.
  - Spatial query at $(x, y)$ for radius $r = 14\text{px}$.
  - Each pierced enemy checked against projectile's `hitEnemyIds`.
  - Decrements `pierceRemaining`. Despawns when `pierceRemaining <= 0` or lifetimer expires (1.8s).
- **Ranks**:
  - Rank 1: 1 Spear, 3 Pierce, Damage 30, Cooldown 1.3s, Speed 500 px/s.
  - Rank 2: 1 Spear, 5 Pierce, Damage 42, Cooldown 1.2s, Speed 540 px/s.
  - Rank 3: 2 Spears (Spread), 6 Pierce, Damage 55, Cooldown 1.1s, Speed 580 px/s.
  - Rank 4: 2 Spears (Spread), 8 Pierce, Damage 72, Cooldown 1.0s, Speed 620 px/s.
  - Rank 5: 3 Spears (Fan), 12 Pierce, Damage 95, Cooldown 0.85s, Speed 680 px/s.

#### 5. Cursed Aura / Death Sigil (`id: 'aura'`)
- **Archetype**: Periodic expanding radial shockwave pulse centered on player.
- **Mechanics**:
  - Pulses every $T = \text{baseInterval} \times (1.0 - \text{player.stats.cooldownReduction})$.
  - Radius: $R = \text{baseRadius} \times \text{player.stats.area}$ (85px to 155px).
  - On pulse: queries all enemies within $R$ using `hordeManager.forEachEnemyInRadius`.
  - Inflicts damage and radial knockback:
    $$\vec{k} = \frac{\text{enemyPos} - \text{playerPos}}{\|\text{enemyPos} - \text{playerPos}\|} \times \text{knockbackForce}$$
  - Triggers visual expanding runic ring on ground canvas.
- **Ranks**:
  - Rank 1: Damage 20, Interval 1.2s, Radius 85px, Knockback 100.
  - Rank 2: Damage 28, Interval 1.1s, Radius 95px, Knockback 120.
  - Rank 3: Damage 38, Interval 1.0s, Radius 110px, Knockback 145.
  - Rank 4: Damage 52, Interval 0.9s, Radius 130px, Knockback 175.
  - Rank 5: Damage 72, Interval 0.75s, Radius 155px, Knockback 215.

### 2.5 Complete Lifecycle & Loot/VFX Resolution
When any weapon or projectile hits an enemy:
1. `damage = Math.round(baseDamage * player.stats.might)`
2. `result = hordeManager.applyDamage(enemy.id, damage, knockbackX, knockbackY)`
3. If `result.killed`:
   - Map `result.gemType` to `LootDropType`:
     - `'ruby'` $\to$ `LootDropType.RUBY_GEM`
     - `'violet'` $\to$ `LootDropType.VIOLET_ABYSSAL`
     - `'chest'` $\to$ `LootDropType.SOUL_CHEST`
     - default $\to$ `LootDropType.EMERALD_SHARD`
   - Call `lootManager.spawnDrop(dropType, result.x, result.y, true)`
   - Call `vfx.emitSoulBurst(result.x, result.y, result.gemType, 8)`
   - Call `vfx.emitBloodBurst(result.x, result.y, 6)`
   - Emit engine event: `engine?.eventBus?.emit('enemy_killed', result)`
4. Else (survived):
   - Call `vfx.emitBloodBurst(result.x, result.y, 3, dirX, dirY)`

---

## 3. Caveats

1. **Rogue-Lite Upgrade UI & Synergies**: This report focuses on the core Weapon Engine, projectile pooling, spatial hit detection, and the 5 Occult Weapons (Ranks 1 to 5). The Level-Up Card Modal and Synergies/Evolutions will be coordinated with the UpgradeSystem specialist in M3.
2. **Audio/SFX**: Audio synthesis hooks (`SoundEngine`) should be invoked through event bus events (`'weapon_fired'`, `'enemy_hit'`, `'enemy_killed'`) rather than coupled directly into the weapon physics loop.
3. **Canvas Performance**: All weapon visual rendering (slashes, skulls, lightning bolts) must be camera-culled against `Camera.viewportWidth` and `Camera.viewportHeight` to maintain 60Hz when hundreds of projectiles/particles are active.

---

## 4. Conclusion & Concrete File Blueprints for Worker

The weapon architecture must be decomposed into modular files under `src/core/weapons/`. Below are the complete TypeScript blueprints:

### Blueprint 1: `src/core/weapons/WeaponTypes.ts`
```typescript
/**
 * WeaponTypes.ts - Type definitions for Occult Weapons, stats, and ranks.
 */

export type WeaponId = 'scythe' | 'orbiters' | 'lightning' | 'spear' | 'aura';

export interface WeaponRankStats {
  rank: number;
  damage: number;
  cooldown: number; // in seconds
  area: number;     // radius in px or reach
  speed: number;    // projectile speed or angular velocity
  count: number;    // number of projectiles / skulls / strikes
  pierce?: number;  // pierce count for projectiles
  knockback: number;
  description: string;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  icon: string;
  maxRank: number;
  ranks: Record<number, WeaponRankStats>;
}
```

### Blueprint 2: `src/core/weapons/Projectile.ts`
```typescript
/**
 * Projectile.ts - Pre-allocated Pooled Projectile Entity.
 * Zero-garbage recycling with flat intrusive hit tracking.
 */

import { WeaponId } from './WeaponTypes';

export class Projectile {
  public readonly id: number;
  public active: boolean = false;
  public weaponId: WeaponId = 'spear';

  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public speed: number = 0;
  public radius: number = 8;
  public damage: number = 20;
  public knockback: number = 100;
  public pierceRemaining: number = 3;
  public life: number = 0;
  public maxLife: number = 2.0;
  public rotation: number = 0;

  // Intrusive hit history buffer to prevent multiple hits on the same enemy
  public readonly hitEnemyIds: Int16Array = new Int16Array(16);
  public hitCount: number = 0;

  constructor(id: number) {
    this.id = id;
  }

  public reset(
    weaponId: WeaponId,
    x: number,
    y: number,
    vx: number,
    vy: number,
    speed: number,
    radius: number,
    damage: number,
    knockback: number,
    pierce: number,
    maxLife: number = 2.0
  ): void {
    this.weaponId = weaponId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.speed = speed;
    this.radius = radius;
    this.damage = damage;
    this.knockback = knockback;
    this.pierceRemaining = pierce;
    this.life = 0;
    this.maxLife = maxLife;
    this.rotation = Math.atan2(vy, vx);
    this.hitCount = 0;
    this.hitEnemyIds.fill(-1);
    this.active = true;
  }

  public hasHit(enemyId: number): boolean {
    for (let i = 0; i < this.hitCount; i++) {
      if (this.hitEnemyIds[i] === enemyId) return true;
    }
    return false;
  }

  public recordHit(enemyId: number): void {
    if (this.hitCount < 16) {
      this.hitEnemyIds[this.hitCount++] = enemyId;
    }
  }
}

export class ProjectilePool {
  public readonly capacity: number;
  public readonly pool: Projectile[];
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private readonly activeIndices: Int32Array;
  private activeCount: number;
  private readonly indexInActive: Int32Array;

  constructor(capacity: number = 256) {
    this.capacity = capacity;
    this.pool = new Array(capacity);
    this.freeIndices = new Int32Array(capacity);
    this.activeIndices = new Int32Array(capacity);
    this.indexInActive = new Int32Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.pool[i] = new Projectile(i);
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }
    this.freeCount = capacity;
    this.activeCount = 0;
  }

  public spawn(): Projectile | null {
    if (this.freeCount <= 0) return null;
    const idx = this.freeIndices[--this.freeCount];
    const p = this.pool[idx];
    const activeIdx = this.activeCount++;
    this.activeIndices[activeIdx] = idx;
    this.indexInActive[idx] = activeIdx;
    return p;
  }

  public free(idx: number): void {
    if (idx < 0 || idx >= this.capacity) return;
    const p = this.pool[idx];
    if (!p.active) return;
    p.active = false;

    const activeIdx = this.indexInActive[idx];
    if (activeIdx >= 0 && activeIdx < this.activeCount) {
      const lastIdx = --this.activeCount;
      const lastId = this.activeIndices[lastIdx];
      if (activeIdx !== lastIdx) {
        this.activeIndices[activeIdx] = lastId;
        this.indexInActive[lastId] = activeIdx;
      }
      this.indexInActive[idx] = -1;
      this.freeIndices[this.freeCount++] = idx;
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getActiveProjectile(index: number): Projectile {
    return this.pool[this.activeIndices[index]];
  }

  public clear(): void {
    while (this.activeCount > 0) {
      this.free(this.activeIndices[this.activeCount - 1]);
    }
  }
}
```

### Blueprint 3: `src/core/weapons/Weapon.ts`
```typescript
/**
 * Weapon.ts - Base Weapon Interface and Abstract Class.
 */

import { WeaponId, WeaponRankStats } from './WeaponTypes';
import { Player } from '../entities/Player';
import { HordeManager } from '../HordeManager';
import { ProjectilePool } from './Projectile';
import { DarkFantasyVFX } from '../../render/vfx/DarkFantasyVFX';
import { Camera } from '../../render/Camera';
import { WeaponManager } from './WeaponManager';

export interface Weapon {
  readonly id: WeaponId;
  readonly name: string;
  readonly icon: string;
  rank: number;
  maxRank: number;

  getStats(): WeaponRankStats;
  canUpgrade(): boolean;
  upgrade(): boolean;

  update(
    dt: number,
    player: Player,
    hordeManager: HordeManager,
    pool: ProjectilePool,
    vfx: DarkFantasyVFX,
    scratchIds: Int32Array,
    simTime: number,
    manager: WeaponManager
  ): void;

  render?(ctx: CanvasRenderingContext2D, camera: Camera): void;
}
```

### Blueprint 4: 5 Weapon Implementations
1. `src/core/weapons/ArcaneScythe.ts`:
   - Ranks 1 to 5 definitions.
   - Cleave arc sweep with angle normalization: `Math.atan2(dy, dx) - aimAngle`.
   - Dual blade sweep at Rank 5.
   - Slashing visual rendered as purple arc crescent.
2. `src/core/weapons/SoulOrbiters.ts`:
   - Ranks 1 to 5: 2 to 6 spectral skulls orbiting player.
   - Angular velocity $\omega \times dt$.
   - Hit cooldown check via `manager.getHitCooldown(enemyId)`.
   - Render: Flaming skulls with glowing eye sockets & trailing sparks.
3. `src/core/weapons/AbyssalLightning.ts`:
   - Ranks 1 to 5: 1 to 4 primary strikes, 1 to 4 chain bounces.
   - Branching lightning calculation using spatial grid radius search.
   - Multi-segment jittered bolt rendering with dual-core cyan/violet colors.
4. `src/core/weapons/BoneSpear.ts`:
   - Ranks 1 to 5: 1 to 3 piercing bone spears with angular spread.
   - Projectile pool integration and pierce decrementing.
   - Bone shatter particles on each enemy pierced.
5. `src/core/weapons/CursedAura.ts`:
   - Ranks 1 to 5: 85px to 155px pulsing necrotic ring.
   - Radial knockback away from player center.
   - Expanding runic ground circle VFX.

### Blueprint 5: `src/core/weapons/WeaponManager.ts`
```typescript
/**
 * WeaponManager.ts - Master Coordinator for Active Weapons & Projectiles.
 */

export class WeaponManager {
  private readonly weapons: Map<WeaponId, Weapon> = new Map();
  public readonly projectilePool: ProjectilePool = new ProjectilePool(256);

  // Scratch buffers (zero allocation)
  private readonly scratchEnemyIds: Int32Array = new Int32Array(1024);
  private readonly hitCooldownBuffer: Float32Array = new Float32Array(2048);

  public simulationTime: number = 0;

  public addWeapon(id: WeaponId, rank: number = 1): Weapon | null;
  public getWeapon(id: WeaponId): Weapon | undefined;
  public hasWeapon(id: WeaponId): boolean;
  public upgradeWeapon(id: WeaponId): boolean;
  public getActiveWeapons(): Weapon[];
  public getInventorySlotData(): InventorySlotData[];

  public checkEnemyHitCooldown(enemyId: number, cooldown: number): boolean {
    if (this.simulationTime - this.hitCooldownBuffer[enemyId] >= cooldown) {
      this.hitCooldownBuffer[enemyId] = this.simulationTime;
      return true;
    }
    return false;
  }

  public applyWeaponDamage(
    enemyId: number,
    baseDamage: number,
    knockbackX: number,
    knockbackY: number,
    player: Player,
    hordeManager: HordeManager,
    lootManager: LootManager,
    vfx: DarkFantasyVFX,
    engine?: any
  ): void {
    const damage = Math.round(baseDamage * player.stats.might);
    const result = hordeManager.applyDamage(enemyId, damage, knockbackX, knockbackY);

    if (result.killed) {
      let dropType = LootDropType.EMERALD_SHARD;
      if (result.gemType === 'ruby') dropType = LootDropType.RUBY_GEM;
      else if (result.gemType === 'violet') dropType = LootDropType.VIOLET_ABYSSAL;
      else if (result.gemType === 'chest') dropType = LootDropType.SOUL_CHEST;

      lootManager.spawnDrop(dropType, result.x, result.y, true);
      vfx.emitSoulBurst(result.x, result.y, result.gemType, 8);
      vfx.emitBloodBurst(result.x, result.y, 6);
      engine?.eventBus?.emit('enemy_killed', result);
    } else {
      vfx.emitBloodBurst(result.x, result.y, 3);
    }
  }

  public update(
    dt: number,
    player: Player,
    hordeManager: HordeManager,
    lootManager: LootManager,
    vfx: DarkFantasyVFX,
    engine?: any
  ): void;

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void;
  public clear(): void;
}
```

---

## 5. Verification Method

### 5.1 Unit Verification Commands
To independently verify the weapon system once implemented by the Worker:
```bash
npm test
```
All 139 existing unit tests must remain 100% green, plus a new dedicated test suite:
`tests/unit/WeaponsArsenal.test.ts` verifying:
1. **Auto-Firing & CDR Scaling**: Assert effective cooldown scales correctly with player CDR, respects the 50% cap, and does not lose time across ticks.
2. **Might Scaling**: Assert inflicted damage strictly equals `Math.round(baseDamage * might)`.
3. **Pierce Limit**: Assert `BoneSpear` pierces exactly $N$ enemies and is returned to the pool after the $N$-th hit.
4. **Soul Orbiters Contact Rate**: Assert an enemy standing inside the orbital ring only takes damage at the configured `hitCooldown` intervals (e.g. at most 3 times per second, not 60 times).
5. **Spatial Query & Nearest Enemy Targeting**: Assert `ArcaneScythe` and `BoneSpear` aim towards the closest enemy within range.
6. **Loot Drop & Death VFX Trigger**: Assert killing an enemy via any weapon spawns the corresponding loot gem and fires soul/blood bursts.
7. **Zero Allocation Invariant**: Simulate 1,000 weapon firings and assert `projectilePool.getActiveCount()` properly increments and decrements without memory leak.

### 5.2 Invalidation Conditions
The weapon design will be considered invalidated if:
- Projectile firing creates new heap objects (`new Object()`, `[]`, or closures) inside the 60Hz loop.
- Weapon cooldown does not scale with `PlayerStats.cooldownReduction`.
- Any of the 5 occult weapons fails to upgrade cleanly across Ranks 1 to 5.
- Existing tests in `HordeManager.test.ts` or `PlayerAndLoot.test.ts` break.
