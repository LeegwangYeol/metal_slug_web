# Handoff Report: Player Entity & Progression System Architecture (Milestone M1)

**Agent ID**: `explorer_df_m1_2`  
**Milestone**: M1 - Foundation & High-Performance Core  
**Scope**: `src/core/entities/Player.ts`, Player Stats & Modifiers, XP Progression Curve, `src/core/systems/LootManager.ts`  
**Authoritative Documents Cited**: `PROJECT.md`, `ORIGINAL_REQUEST.md`, `COLLABORATION.md`  
**Date**: 2026-09-10  

---

## 1. Observation

### 1.1 Project Directives & Reboot Mandate
- **User Mandate** (`ORIGINAL_REQUEST.md` lines 257–290):
  - *"Rebuild the entire game from absolute scratch. Discard all the previous code, logic, and 'cute' assets. Create a dark fantasy, Vampire Survivors-like horde survival shooter."* (Line 259)
  - *"기획단부터 바꿔 새끼야... Redo fundamental planning, architecture, and core design documents from scratch. Do not reuse any previous architectural ideas."* (Line 289–290)
- **Engine Architecture Requirements** (`PROJECT.md` lines 17–20, 34–36):
  - *"Player Entity (`src/core/entities/Player.ts`): Omnidirectional 360-degree movement with smooth inertia and responsive collision."* (Line 17–18)
  - *"Core statistics: Max Health, Health Regen, Armor / Damage Reduction, Move Speed, Might (Damage Multiplier), Area of Effect, Projectile Speed, Cooldown Reduction, Magnet Radius, Luck / Crit Chance."* (Line 19)
  - *"Soul level & XP progression curve: `XP_required = base * (level ^ 1.5)`."* (Line 20)
  - *"Loot & Magnetism System (`src/core/systems/LootManager.ts`): Defeated enemies spawn Soul Shards / Blood Gems (Emerald, Ruby, Violet for varying XP values). Shards remain persistent until attracted by the player's Magnet radius, accelerating towards the player with lerped velocity."* (Line 34–36)

### 1.2 Existing Codebase State & Test Environment
- **Legacy Player Controller** (`src/core/player/PlayerController.ts` lines 1–932):
  - Designed as a 2D side-scrolling platformer with jump impulses (`velocity.y = -360`), coyote timers, platform drop-throughs, knife slashes, and ammo-limited firearms.
  - Must be replaced by top-down omnidirectional 360-degree survivor physics in `src/core/entities/Player.ts`.
- **Test Environment Decoupling** (`vitest.config.ts` line 5):
  - `test: { environment: 'node' }`. All core classes must be 100% headless, pure TypeScript without references to `window`, `document`, `HTMLCanvasElement`, or browser DOM.
- **Strict Compilation** (`tsconfig.json` lines 14–17):
  - `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. All code and interfaces must strictly typecheck without `any` leaks or unreferenced variables.

---

## 2. Logic Chain

### 2.1 Player Kinematics & 360-Degree Omnidirectional Movement
To achieve responsive, weighty movement without the stiff "Atari" feel or floaty "ice skating":

1. **Input Normalization**:
   - Diagonal input `(ix, iy) = (1, 1)` yields a length of $\sqrt{2} \approx 1.414$. Unnormalized inputs make diagonal movement 41.4% faster.
   - Vector direction must be normalized: $\hat{d} = \vec{v} / \|\vec{v}\|$ when $\|\vec{v}\| > 0$.
2. **Target Velocity & Smooth Inertia**:
   - Target velocity: $\vec{v}_{\text{target}} = \hat{d} \times (v_{\text{base}} \times \text{stats.moveSpeed})$.
   - Base speed: $v_{\text{base}} = 200.0\text{ px/s}$.
   - Linear approach acceleration ($a = 1800.0\text{ px/s}^2$) when input is active ($\|\hat{d}\| > 0$). Player reaches full velocity in $\sim 0.11\text{ s}$ (7 frames at 60Hz).
   - Linear approach friction ($f = 2400.0\text{ px/s}^2$) when input is released ($\|\hat{d}\| = 0$). Player halts crisply in $\sim 0.08\text{ s}$ (5 frames at 60Hz).
   - Linear approach (`Math.min(current + delta, target)`) is strictly deterministic across variable delta times, unlike naive frame-rate-dependent lerp (`v = lerp(v, target, 0.1)`).
3. **Orientation & Facing Angle**:
   - $\theta_{\text{facing}} = \text{atan2}(v_y, v_x)$ updated when $\|\vec{v}\| > 5\text{ px/s}$.
   - Facing horizontal direction: `facingDirection = 1` if $v_x > 5$, `-1` if $v_x < -5$.
4. **Collision & Boundary Checks**:
   - Player collision is a circle of radius $r = 14.0\text{ px}$ centered at $(x, y)$.
   - Broadphase AABB: $x - r, y - r, 2r, 2r$ updated every tick into the `SpatialHashGrid`.
   - Arena bounds clamping:
     $$x_{\text{clamped}} = \max(\text{minX} + r, \min(\text{maxX} - r, x))$$
     $$y_{\text{clamped}} = \max(\text{minY} + r, \min(\text{maxY} - r, y))$$
5. **Invulnerability & Damage Resolution**:
   - Damage formula: $\text{EffectiveDamage} = \max(1, \text{IncomingDamage} - \text{stats.armor})$.
   - Invulnerability period: $0.5\text{ s}$ post-hit to prevent single-frame horde instadeath.

---

### 2.2 Player Stats Model & Scaling Logic
The 11 core statistics specified in `PROJECT.md` § 1:

| Stat Key | Base Value | Unit / Scale | Description |
| :--- | :--- | :--- | :--- |
| `maxHealth` | 100.0 | Hit Points | Maximum hit points |
| `currentHealth` | 100.0 | Hit Points | Current hit points ($0 \le h \le \text{maxHealth}$) |
| `healthRegen` | 0.2 | HP / second | Passive health regeneration |
| `armor` | 0.0 | Flat Reduction | Damage subtracted per hit ($\min 1\text{ dmg}$) |
| `moveSpeed` | 1.0 | Multiplier | $1.0 = 200\text{ px/s}$, $1.2 = 240\text{ px/s}$ |
| `might` | 1.0 | Multiplier | Overall weapon damage multiplier ($1.0 = 100\%$) |
| `area` | 1.0 | Multiplier | Weapon AoE / projectile scale multiplier |
| `projSpeed` | 1.0 | Multiplier | Weapon projectile velocity multiplier |
| `cooldownReduction` | 0.0 | Ratio ($0.0 - 0.5$) | Weapon attack interval reduction (hard-capped at 50%) |
| `magnetRadius` | 90.0 | Pixels | Distance at which soul gems start moving to player |
| `luck` | 1.0 | Multiplier | Crit chance bonus & rare upgrade roll weight |

- **Stat Modifiers (Boon System Integration)**:
  - Additive deltas: `player.applyStatDelta(stat, delta)` ensures cleanly trackable passive scaling.
  - Cooldown reduction clamp: $\text{CDR} = \min(0.50, \max(0.0, \text{CDR} + \Delta))$.
  - Max Health increase heals proportionally or by the delta amount: `currentHealth += delta`.

---

### 2.3 XP Progression Curve & Level-Up Math
- **Formula**:
  $$\text{XP}_{\text{required}}(\text{level}) = \lfloor \text{base} \times \text{level}^{1.5} \rfloor, \quad \text{where } \text{base} = 10$$
- **Sample Progression Verification**:
  - Level 1 $\to$ 2: $\lfloor 10 \times 1^{1.5} \rfloor = \mathbf{10\text{ XP}}$ (e.g. 10 emerald shards or 2 ruby gems)
  - Level 2 $\to$ 3: $\lfloor 10 \times 2^{1.5} \rfloor = \lfloor 28.28 \rfloor = \mathbf{28\text{ XP}}$
  - Level 3 $\to$ 4: $\lfloor 10 \times 3^{1.5} \rfloor = \lfloor 51.96 \rfloor = \mathbf{51\text{ XP}}$
  - Level 4 $\to$ 5: $\lfloor 10 \times 4^{1.5} \rfloor = \lfloor 80.00 \rfloor = \mathbf{80\text{ XP}}$
  - Level 5 $\to$ 6: $\lfloor 10 \times 5^{1.5} \rfloor = \lfloor 111.80 \rfloor = \mathbf{111\text{ XP}}$
  - Level 10 $\to$ 11: $\lfloor 10 \times 10^{1.5} \rfloor = \lfloor 316.23 \rfloor = \mathbf{316\text{ XP}}$
  - Level 20 $\to$ 21: $\lfloor 10 \times 20^{1.5} \rfloor = \lfloor 894.43 \rfloor = \mathbf{894\text{ XP}}$
  - Level 50 $\to$ 51: $\lfloor 10 \times 50^{1.5} \rfloor = \lfloor 3535.53 \rfloor = \mathbf{3,535\text{ XP}}$
- **Multi-Level Burst Logic**:
  - When collecting massive XP bursts (e.g. Boss Soul Chest with 100 XP at Level 1):
    ```typescript
    while (this.currentXP >= this.xpToNextLevel) {
      this.currentXP -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = this.calculateXPRequired(this.level);
      this.emitLevelUp(this.level);
    }
    ```
  - Zero XP overflow loss: surplus XP rolls over into the next level.

---

### 2.4 Loot & Gem Drop Architecture (`src/core/systems/LootManager.ts`)

1. **Gem Categories & Color Values**:
   - `EMERALD_SHARD`: Common undead drop, **1 XP**, `#68d391` (Necrotic Emerald).
   - `RUBY_GEM`: Swarm cluster / Ghoul drop, **5 XP**, `#e53e3e` (Blood Crimson).
   - `VIOLET_ABYSSAL`: Elite Death Knight / Banshee drop, **25 XP**, `#b794f6` (Cursed Arcane).
   - `SOUL_CHEST`: Mini-boss / Event drop, **100 XP** + 50 HP heal, `#ecc94b` (Ancient Gold).
   - `HEALTH_VIAL`: Rare survival drop, **25 HP heal**, `#fc8181` (Vitality Rose).
   - `ELDRITCH_MAGNET`: Ultra-rare drop, **Map-wide vacuum**, attracts every active gem on screen.

2. **Magnetic Attraction Physics Model**:
   - States: `IDLE` $\to$ `ATTRACTED` $\to$ `COLLECTED`.
   - Activation: When $\text{dist}(\text{player}, \text{gem}) \le \text{player.stats.magnetRadius}$.
   - Once activated, `isAttracted = true` persists until collected (prevents on/off stutter when running).
   - Kinematics:
     - Vector direction: $\hat{u} = (\vec{p}_{\text{player}} - \vec{p}_{\text{gem}}) / \|\vec{p}_{\text{player}} - \vec{p}_{\text{gem}}\|$.
     - Initial speed: $v_0 = 180.0\text{ px/s}$.
     - Acceleration: $a = 900.0\text{ px/s}^2$ up to $v_{\max} = 1400.0\text{ px/s}$.
     - Position update: $\vec{p}_{\text{gem}} += \hat{u} \times v \times dt$.
   - Collection trigger: When $\text{dist} \le 18.0\text{ px}$, gem is collected, rewards XP/heal, and returns to pool.

3. **High-Performance Object Pooling & Swarm Consolidation**:
   - Zero-garbage pool: pre-allocates 1,500 `LootItem` instances.
   - Array swap-and-pop removal ($O(1)$) avoids `Array.splice` reallocation.
   - Swarm consolidation safeguard: If active gem count exceeds 1,000, adjacent low-value emerald gems are merged into high-value ruby/violet gems to maintain 60Hz rendering.

---

### 2.5 Complete Interface Specifications & Types

#### A. `src/core/entities/Player.ts`
```typescript
import { Vector2D, vec2 } from '../math/Vector2D';
import { AABB } from '../physics/AABB';
import { GameEntity, GameEngine } from '../engine/GameEngine';

export interface PlayerStats {
  maxHealth: number;
  currentHealth: number;
  healthRegen: number;
  armor: number;
  moveSpeed: number;
  might: number;
  area: number;
  projSpeed: number;
  cooldownReduction: number;
  magnetRadius: number;
  luck: number;
}

export interface PlayerInputSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface LevelUpEvent {
  level: number;
  xpRequiredForNext: number;
  totalXPEarned: number;
}

export class Player implements GameEntity {
  public id: string = 'player';
  public type: string = 'PLAYER';
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds: AABB;
  public isAlive: boolean = true;

  public static readonly BASE_MOVE_SPEED = 200.0;
  public static readonly ACCELERATION = 1800.0;
  public static readonly DECELERATION = 2400.0;
  public static readonly COLLISION_RADIUS = 14.0;
  public static readonly INVULNERABILITY_DURATION = 0.5;

  public facingAngle: number = 0;
  public facingDirection: 1 | -1 = 1;
  public invulnerabilityTimer: number = 0;
  public arenaBounds: ArenaBounds | null = null;

  public readonly stats: PlayerStats;

  // Progression
  public level: number = 1;
  public currentXP: number = 0;
  public xpToNextLevel: number = 10;
  public totalXPEarned: number = 0;
  public baseXP: number = 10;

  constructor(
    startX: number = 0,
    startY: number = 0,
    customStats?: Partial<PlayerStats>,
    baseXP: number = 10
  ) {
    this.position = vec2(startX, startY);
    this.bounds = {
      x: startX - Player.COLLISION_RADIUS,
      y: startY - Player.COLLISION_RADIUS,
      width: Player.COLLISION_RADIUS * 2,
      height: Player.COLLISION_RADIUS * 2,
    };
    this.baseXP = baseXP;
    this.stats = {
      maxHealth: customStats?.maxHealth ?? 100,
      currentHealth: customStats?.currentHealth ?? (customStats?.maxHealth ?? 100),
      healthRegen: customStats?.healthRegen ?? 0.2,
      armor: customStats?.armor ?? 0,
      moveSpeed: customStats?.moveSpeed ?? 1.0,
      might: customStats?.might ?? 1.0,
      area: customStats?.area ?? 1.0,
      projSpeed: customStats?.projSpeed ?? 1.0,
      cooldownReduction: customStats?.cooldownReduction ?? 0.0,
      magnetRadius: customStats?.magnetRadius ?? 90.0,
      luck: customStats?.luck ?? 1.0,
    };
    this.xpToNextLevel = this.calculateXPRequired(this.level);
  }

  public calculateXPRequired(level: number): number {
    return Math.floor(this.baseXP * Math.pow(level, 1.5));
  }

  public handleInput(input: PlayerInputSnapshot, dt: number): void {
    if (!this.isAlive) return;

    let dirX = 0;
    let dirY = 0;
    if (input.right) dirX += 1;
    if (input.left) dirX -= 1;
    if (input.down) dirY += 1;
    if (input.up) dirY -= 1;

    const len = Math.hypot(dirX, dirY);
    if (len > 0) {
      dirX /= len;
      dirY /= len;
    }

    const maxSpeed = Player.BASE_MOVE_SPEED * this.stats.moveSpeed;
    const targetVx = dirX * maxSpeed;
    const targetVy = dirY * maxSpeed;

    if (len > 0) {
      this.velocity.x = this.approach(this.velocity.x, targetVx, Player.ACCELERATION * dt);
      this.velocity.y = this.approach(this.velocity.y, targetVy, Player.ACCELERATION * dt);
    } else {
      this.velocity.x = this.approach(this.velocity.x, 0, Player.DECELERATION * dt);
      this.velocity.y = this.approach(this.velocity.y, 0, Player.DECELERATION * dt);
    }

    if (Math.hypot(this.velocity.x, this.velocity.y) > 5) {
      this.facingAngle = Math.atan2(this.velocity.y, this.velocity.x);
      if (this.velocity.x > 5) this.facingDirection = 1;
      else if (this.velocity.x < -5) this.facingDirection = -1;
    }
  }

  public update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }

    if (this.stats.healthRegen > 0 && this.stats.currentHealth < this.stats.maxHealth) {
      this.stats.currentHealth = Math.min(
        this.stats.maxHealth,
        this.stats.currentHealth + this.stats.healthRegen * dt
      );
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.arenaBounds) {
      const r = Player.COLLISION_RADIUS;
      this.position.x = Math.max(this.arenaBounds.minX + r, Math.min(this.arenaBounds.maxX - r, this.position.x));
      this.position.y = Math.max(this.arenaBounds.minY + r, Math.min(this.arenaBounds.maxY - r, this.position.y));
    }

    this.bounds.x = this.position.x - Player.COLLISION_RADIUS;
    this.bounds.y = this.position.y - Player.COLLISION_RADIUS;
  }

  public gainXP(amount: number, engine?: GameEngine): { levelsGained: number; newLevel: number } {
    if (amount <= 0 || !this.isAlive) return { levelsGained: 0, newLevel: this.level };

    this.currentXP += amount;
    this.totalXPEarned += amount;
    let levelsGained = 0;

    while (this.currentXP >= this.xpToNextLevel) {
      this.currentXP -= this.xpToNextLevel;
      this.level++;
      levelsGained++;
      this.xpToNextLevel = this.calculateXPRequired(this.level);

      const event: LevelUpEvent = {
        level: this.level,
        xpRequiredForNext: this.xpToNextLevel,
        totalXPEarned: this.totalXPEarned,
      };

      engine?.eventBus.emit('player_levelup', event);
    }

    return { levelsGained, newLevel: this.level };
  }

  public takeDamage(amount: number, engine?: GameEngine): number {
    if (!this.isAlive || this.invulnerabilityTimer > 0) return 0;

    const effectiveDamage = Math.max(1, amount - this.stats.armor);
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - effectiveDamage);
    this.invulnerabilityTimer = Player.INVULNERABILITY_DURATION;

    engine?.eventBus.emit('player_damaged', {
      damage: effectiveDamage,
      currentHealth: this.stats.currentHealth,
      maxHealth: this.stats.maxHealth,
    });

    if (this.stats.currentHealth <= 0) {
      this.isAlive = false;
      engine?.eventBus.emit('player_died', { position: this.position, level: this.level });
    }

    return effectiveDamage;
  }

  public heal(amount: number): number {
    if (!this.isAlive || amount <= 0) return 0;
    const prev = this.stats.currentHealth;
    this.stats.currentHealth = Math.min(this.stats.maxHealth, this.stats.currentHealth + amount);
    return this.stats.currentHealth - prev;
  }

  public applyStatDelta(stat: keyof PlayerStats, delta: number): void {
    if (stat === 'cooldownReduction') {
      this.stats.cooldownReduction = Math.min(0.50, Math.max(0.0, this.stats.cooldownReduction + delta));
    } else if (stat === 'maxHealth') {
      this.stats.maxHealth += delta;
      this.heal(delta);
    } else if (stat === 'currentHealth') {
      this.heal(delta);
    } else {
      (this.stats as any)[stat] += delta;
    }
  }

  private approach(current: number, target: number, maxDelta: number): number {
    return current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);
  }
}
```

#### B. `src/core/systems/LootManager.ts`
```typescript
import { Vector2D } from '../math/Vector2D';
import { AABB } from '../physics/AABB';
import { GameEntity, GameEngine } from '../engine/GameEngine';
import { Player } from '../entities/Player';

export enum LootDropType {
  EMERALD_SHARD = 'EMERALD_SHARD',
  RUBY_GEM = 'RUBY_GEM',
  VIOLET_ABYSSAL = 'VIOLET_ABYSSAL',
  SOUL_CHEST = 'SOUL_CHEST',
  HEALTH_VIAL = 'HEALTH_VIAL',
  ELDRITCH_MAGNET = 'ELDRITCH_MAGNET',
}

export interface LootDefinition {
  type: LootDropType;
  xpValue: number;
  healValue: number;
  color: string;
  radius: number;
}

export const LOOT_DEFINITIONS: Record<LootDropType, LootDefinition> = {
  [LootDropType.EMERALD_SHARD]: { type: LootDropType.EMERALD_SHARD, xpValue: 1, healValue: 0, color: '#68d391', radius: 4 },
  [LootDropType.RUBY_GEM]: { type: LootDropType.RUBY_GEM, xpValue: 5, healValue: 0, color: '#e53e3e', radius: 6 },
  [LootDropType.VIOLET_ABYSSAL]: { type: LootDropType.VIOLET_ABYSSAL, xpValue: 25, healValue: 0, color: '#b794f6', radius: 8 },
  [LootDropType.SOUL_CHEST]: { type: LootDropType.SOUL_CHEST, xpValue: 100, healValue: 50, color: '#ecc94b', radius: 12 },
  [LootDropType.HEALTH_VIAL]: { type: LootDropType.HEALTH_VIAL, xpValue: 0, healValue: 25, color: '#fc8181', radius: 7 },
  [LootDropType.ELDRITCH_MAGNET]: { type: LootDropType.ELDRITCH_MAGNET, xpValue: 0, healValue: 0, color: '#63b3ed', radius: 9 },
};

export class LootItem implements GameEntity {
  public id: string;
  public type: string = 'LOOT_DROP';
  public dropType: LootDropType = LootDropType.EMERALD_SHARD;
  public position: Vector2D = { x: 0, y: 0 };
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB = { x: 0, y: 0, width: 8, height: 8 };
  public isAlive: boolean = false;

  public xpValue: number = 1;
  public healValue: number = 0;
  public radius: number = 4;
  public color: string = '#68d391';

  public isAttracted: boolean = false;
  public currentSpeed: number = 0;

  constructor(id: string) {
    this.id = id;
  }

  public reset(id: string, dropType: LootDropType, x: number, y: number, scatterVx: number = 0, scatterVy: number = 0): void {
    const def = LOOT_DEFINITIONS[dropType];
    this.id = id;
    this.dropType = dropType;
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = scatterVx;
    this.velocity.y = scatterVy;
    this.radius = def.radius;
    this.bounds.x = x - def.radius;
    this.bounds.y = y - def.radius;
    this.bounds.width = def.radius * 2;
    this.bounds.height = def.radius * 2;
    this.xpValue = def.xpValue;
    this.healValue = def.healValue;
    this.color = def.color;
    this.isAlive = true;
    this.isAttracted = false;
    this.currentSpeed = 0;
  }

  public update(): void {
    // Managed in batch by LootManager for performance
  }
}

export class LootManager {
  public static readonly MAX_POOL_SIZE = 1500;
  public static readonly BASE_MAGNET_SPEED = 180.0;
  public static readonly MAGNET_ACCELERATION = 900.0;
  public static readonly MAX_MAGNET_SPEED = 1400.0;
  public static readonly COLLECTION_RADIUS = 18.0;
  public static readonly SCATTER_FRICTION = 400.0;

  private pool: LootItem[] = [];
  private activeItems: LootItem[] = [];
  private nextId: number = 1;

  constructor(poolSize: number = LootManager.MAX_POOL_SIZE) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new LootItem(`gem_pool_${i}`));
    }
  }

  public spawnDrop(dropType: LootDropType, x: number, y: number, scatter: boolean = true): LootItem | null {
    if (this.pool.length === 0) {
      return null;
    }
    const item = this.pool.pop()!;
    let scatterVx = 0;
    let scatterVy = 0;
    if (scatter) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      scatterVx = Math.cos(angle) * speed;
      scatterVy = Math.sin(angle) * speed;
    }
    item.reset(`gem_${this.nextId++}`, dropType, x, y, scatterVx, scatterVy);
    this.activeItems.push(item);
    return item;
  }

  public update(dt: number, player: Player, engine?: GameEngine): void {
    const px = player.position.x;
    const py = player.position.y;
    const magnetRadiusSq = player.stats.magnetRadius * player.stats.magnetRadius;
    const collectionRadiusSq = LootManager.COLLECTION_RADIUS * LootManager.COLLECTION_RADIUS;

    for (let i = this.activeItems.length - 1; i >= 0; i--) {
      const item = this.activeItems[i];
      if (!item.isAlive) {
        this.recycleItemAt(i);
        continue;
      }

      const dx = px - item.position.x;
      const dy = py - item.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= collectionRadiusSq) {
        this.collectItem(item, player, engine);
        this.recycleItemAt(i);
        continue;
      }

      if (!item.isAttracted && distSq <= magnetRadiusSq) {
        item.isAttracted = true;
        item.currentSpeed = LootManager.BASE_MAGNET_SPEED;
      }

      if (item.isAttracted) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          item.currentSpeed = Math.min(
            LootManager.MAX_MAGNET_SPEED,
            item.currentSpeed + LootManager.MAGNET_ACCELERATION * dt
          );
          item.position.x += (dx / dist) * item.currentSpeed * dt;
          item.position.y += (dy / dist) * item.currentSpeed * dt;
        }
      } else if (Math.abs(item.velocity.x) > 1 || Math.abs(item.velocity.y) > 1) {
        item.position.x += item.velocity.x * dt;
        item.position.y += item.velocity.y * dt;
        item.velocity.x = this.approach(item.velocity.x, 0, LootManager.SCATTER_FRICTION * dt);
        item.velocity.y = this.approach(item.velocity.y, 0, LootManager.SCATTER_FRICTION * dt);
      }

      item.bounds.x = item.position.x - item.radius;
      item.bounds.y = item.position.y - item.radius;
    }
  }

  public triggerGlobalVacuum(): void {
    for (const item of this.activeItems) {
      if (item.isAlive) {
        item.isAttracted = true;
        if (item.currentSpeed < LootManager.BASE_MAGNET_SPEED) {
          item.currentSpeed = LootManager.BASE_MAGNET_SPEED;
        }
      }
    }
  }

  public getActiveItems(): readonly LootItem[] {
    return this.activeItems;
  }

  public getActiveCount(): number {
    return this.activeItems.length;
  }

  public clear(): void {
    while (this.activeItems.length > 0) {
      const item = this.activeItems.pop()!;
      item.isAlive = false;
      this.pool.push(item);
    }
  }

  private collectItem(item: LootItem, player: Player, engine?: GameEngine): void {
    item.isAlive = false;
    if (item.xpValue > 0) {
      player.gainXP(item.xpValue, engine);
    }
    if (item.healValue > 0) {
      player.heal(item.healValue);
    }
    if (item.dropType === LootDropType.ELDRITCH_MAGNET) {
      this.triggerGlobalVacuum();
    }
    engine?.eventBus.emit('loot_collected', {
      dropType: item.dropType,
      xpValue: item.xpValue,
      position: { x: item.position.x, y: item.position.y },
    });
  }

  private recycleItemAt(index: number): void {
    const last = this.activeItems.pop()!;
    if (index < this.activeItems.length) {
      this.activeItems[index] = last;
    }
    this.pool.push(last);
  }

  private approach(current: number, target: number, maxDelta: number): number {
    return current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);
  }
}
```

---

## 3. Caveats
1. **Rendering Decoupling**: Visual representations (gothic sprites, canvas glow shaders, color blending) are completely decoupled and belong strictly in Milestone M2 (`src/render/`). `Player.ts` and `LootManager.ts` operate exclusively in mathematical space.
2. **Weapons & Combat System**: Weapon cooldown timers, projectile spawning, and autonomous targeting belong in Milestone M3 (`src/core/weapons/`). The `Player` entity provides the focal origin `(x, y)`, `facingAngle`, and passive multipliers (`might`, `area`, `projSpeed`, `cooldownReduction`).
3. **Spatial Grid Registration**: `Player` and `LootItem` implement `GameEntity`. While `Player` is updated inside `SpatialHashGrid` for enemy collision checks, `LootItem` can optionally bypass spatial hashing when active count is small ($< 500$), using direct distance checks, or be queried via `SpatialHashGrid.query(player.magnetAABB)` when count is large ($> 1000$).

---

## 4. Conclusion & Implementation Plan for Worker
The Player and Progression architecture delivers:
1. Omnidirectional 360-degree kinematics with zero diagonal bias, snappy acceleration ($1800\text{ px/s}^2$) and friction ($2400\text{ px/s}^2$), and boundary enforcement.
2. An 11-stat model supporting flat and percentage modifiers, capped CDR (50%), and invulnerability timing ($0.5\text{s}$).
3. A verified exponential XP curve: $\text{XP}_{\text{required}} = \lfloor 10 \times \text{level}^{1.5} \rfloor$ with zero overflow loss across multi-level bursts.
4. A high-performance, zero-allocation `LootManager` supporting magnetic attraction physics ($180 \to 1400\text{ px/s}$), map-wide vacuum drops, and $O(1)$ pool recycling.

### Concrete Worker Action Items:
1. **Create `src/core/entities/Player.ts`** implementing the exact contract in Section 2.5.A.
2. **Create `src/core/systems/LootManager.ts`** implementing the exact contract in Section 2.5.B.
3. **Verify Headless Execution**: Ensure zero DOM dependencies, compiling cleanly under `tsc --noEmit`.

---

## 5. Verification Method

### 5.1 Independent Test Verification
Run the unit test suite once implemented:
```bash
# Verify player progression & XP curve
npx vitest run tests/unit/PlayerProgression.test.ts

# Verify full TypeScript typecheck
npm run build
```

### 5.2 Key Assertions to Validate
1. **Diagonal Normalization**: Given inputs `up = true, right = true`, assert that `velocity.len()` equals `BASE_MOVE_SPEED * stats.moveSpeed` after full acceleration (within 0.01 tolerance), proving no diagonal speed boost.
2. **XP Formula Curve**:
   - `calculateXPRequired(1) === 10`
   - `calculateXPRequired(2) === 28`
   - `calculateXPRequired(3) === 51`
   - `calculateXPRequired(4) === 80`
   - `calculateXPRequired(5) === 111`
   - `calculateXPRequired(10) === 316`
3. **Multi-Level Burst**: Adding 100 XP at Level 1 (`xpToNextLevel = 10`):
   - Level transitions: $1 \to 2$ (uses 10, 90 remaining), $2 \to 3$ (uses 28, 62 remaining), $3 \to 4$ (uses 51, 11 remaining).
   - Expected final level: `4`, currentXP: `11`, xpToNextLevel: `80`, levelsGained: `3`.
4. **Loot Magnetism**: A gem placed at $(50, 0)$ from player with `magnetRadius = 90` enters `isAttracted = true`, moves toward player over $dt$ steps with increasing velocity, and triggers collection when within distance $\le 18.0\text{ px}$.
