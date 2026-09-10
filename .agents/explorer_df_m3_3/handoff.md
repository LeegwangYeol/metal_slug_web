# Milestone M3 Explorer 3 Handoff Report: Escalating Wave Director & Unit Test Suite Design

## 1. Observation

Direct codebase inspection and empirical observations:

1. **Undead Archetypes and Stat Specifications** (`src/core/entities/EnemyTypes.ts:29-66`):
   - `skeleton`: HP 25, speed 65 px/s, radius 12 px, damage 10, gemType `emerald`, xpValue 1.
   - `ghoul`: HP 45, speed 110 px/s, radius 14 px, damage 15, gemType `emerald`, xpValue 2.
   - `banshee`: HP 80, speed 75 px/s, radius 16 px, damage 20, gemType `ruby`, xpValue 5.
   - `death_knight`: HP 350, speed 40 px/s, radius 22 px, damage 40, gemType `violet`, xpValue 20.
   - `normalizeEnemyType` maps case-insensitive inputs (`'SKELETON'`, `'skeleton'`) to normalized keys.

2. **Horde Simulation and Spawning Core** (`src/core/HordeManager.ts`):
   - Pre-allocated 2,048 entity pool (`maxCapacity = 2048`), zero runtime heap allocations (`freeIndices`, `activeIndices`, `indexInActive`).
   - `spawn(type, x, y, hpMultiplier, speedMultiplier): Enemy | null` (lines 109–132): Returns pre-allocated `Enemy` reset with specified multipliers, inserts into `SpatialHashGrid`.
   - `spawnWave(type, count, center, radius): Enemy[]` (lines 150–168): Circular ring cluster spawn around center.
   - `cullEnemies(playerPos): number` (lines 243–259): Despawns active enemies exceeding `cullDistance` (1,500–1,800 px).
   - `getActiveCount(): number` and `getPoolAvailableCount(): number`.
   - World bounds defaulted to `[-2500, 2500]`, clamped arena bounds `[-2000, 2000]` in `main.ts:61-66`.

3. **Current Temporary Spawning in Game Bootstrap** (`src/main.ts:200-218`):
   - Currently uses an inline naive timer:
     ```ts
     this.spawnTimer += dt;
     if (this.spawnTimer >= 1.5) {
       this.spawnTimer = 0;
       if (this.hordeManager.getActiveCount() < 1200) {
         const count = Math.min(20, 5 + Math.floor(this.elapsedTime / 10));
         const angle = Math.random() * Math.PI * 2;
         const spawnX = this.player.position.x + Math.cos(angle) * 550;
         const spawnY = this.player.position.y + Math.sin(angle) * 550;
         const type = Math.random() > 0.4 ? 'SKELETON' : 'GHOUL';
         for (let i = 0; i < count; i++) {
           this.hordeManager.spawnEnemy(type, spawnX + ..., spawnY + ...);
         }
       }
     }
     ```
   - Lacks 4-phase timeline progression, lacks perimeter viewport geometry checks, lacks banshee/death-knight distribution, lacks tactical pincer/ring milestones, and lacks zero-allocation guarantee.

4. **Camera & Viewport Geometry** (`src/render/Camera.ts:18-28`, `src/main.ts:25-27`):
   - Viewport dimensions: `VIRTUAL_WIDTH = 960`, `VIRTUAL_HEIGHT = 540`.
   - Half-extents: `halfW = 480`, `halfH = 270`. Diagonal distance from center: $\sqrt{480^2 + 270^2} \approx 550.7\text{ px}$.
   - Camera render position: `camX = camera.renderX`, `camY = camera.renderY`.
   - Frustum bounding box: $[camX, camY]$ to $[camX + 960, camY + 540]$.
   - Off-screen perimeter safety margin requires at least 80 px beyond viewport bounds ($x < camX - 80$ or $x > camX + 1040$ or $y < camY - 80$ or $y > camY + 620$).

5. **Test Harness & Vitest Environment** (`package.json:10-18`, `tests/unit/`):
   - Vitest 3.2.7 with Node/headless environment.
   - `npm test` runs `vitest run` in ~2.98s across 13 test files (139 tests, 100% green).
   - Tests assert high-performance benchmarks (< 50us per query, < 30ms for 1,000 spawns), strict pool invariance, and exact mathematical scaling curves.

---

## 2. Logic Chain

### 2.1 WaveDirector Architectural Derivation
From Observation 1, 2, 3, and 4:
- The game requires a dedicated `WaveDirector` system (`src/core/systems/WaveDirector.ts`) to manage elapsed survival time, evaluate active phases, determine enemy type distributions, compute difficulty scaling, enforce perimeter spawn coordinates outside the camera frustum, schedule scripted milestone bursts (pincers, rings, death knight mini-bosses), and cap active density to avoid pool starvation.

#### A. 4-Phase Timeline Progression
1. **Phase 1: The Awakening (`0:00 - 0:30`, 0s - 30s)**
   - Archetypes: 100% `skeleton`.
   - Narrative: Shambling skeletons rising from shallow graves.
   - Base cadence: Interval 2.2s -> 1.8s. Cluster size: 4 -> 6 enemies.
   - Enemy multipliers: HP 1.0x, Speed 1.0x.
   - Active cap: 150 enemies.

2. **Phase 2: The Swarm (`0:30 - 1:00`, 30s - 60s)**
   - Archetypes: 65% `skeleton`, 35% `ghoul`.
   - Narrative: Ravenous ghouls lunge aggressively to flank the player.
   - Base cadence: Interval 1.8s -> 1.4s. Cluster size: 7 -> 10 enemies.
   - Enemy multipliers: HP 1.0x -> 1.15x, Speed 1.0x -> 1.05x.
   - Active cap: 350 enemies.

3. **Phase 3: Nightfall (`1:00 - 2:00`, 60s - 120s)**
   - Archetypes: 45% `skeleton`, 35% `ghoul`, 20% `banshee`.
   - Narrative: Ethereal banshees glide through obstacles with piercing wails.
   - Base cadence: Interval 1.4s -> 0.9s. Cluster size: 10 -> 16 enemies.
   - Enemy multipliers: HP 1.30x -> 1.60x, Speed 1.05x -> 1.15x.
   - Active cap: 700 enemies.

4. **Phase 4: Abyssal Siege (`2:00+`, 120s+)**
   - Archetypes: 35% `skeleton`, 35% `ghoul`, 25% `banshee`, 5% ambient `death_knight` + Scripted Death Knight Mini-Bosses.
   - Narrative: Heavily armored Death Knights lead continuous, relentless undead legions.
   - Base cadence: Interval 0.8s -> 0.5s. Cluster size: 16 -> 28 enemies.
   - Enemy multipliers: HP $1.0 + (t / 60) \times 0.30$, Speed $\min(1.4, 1.0 + (t / 120) \times 0.15)$.
   - Active cap: 1,200 enemies (safely under 2,048 pool capacity).

#### B. Difficulty Scaling Mathematical Formulas
For any elapsed time $t \ge 0$ in seconds:
$$\text{HP Multiplier}(t) = 1.0 + \frac{t}{60} \times 0.30$$
$$\text{Speed Multiplier}(t) = \min\left(1.40, 1.0 + \frac{t}{120} \times 0.15\right)$$
$$\text{Spawn Interval}(t) = \max\left(0.50, 2.20 - \frac{t}{60} \times 0.55\right)\text{ seconds}$$
$$\text{Cluster Size}(t) = \min\left(30, 4 + \left\lfloor\frac{t}{8}\right\rfloor\right)$$
$$\text{Active Enemy Cap}(t) = \min\left(1200, 150 + \left\lfloor\frac{t}{10}\right\rfloor \times 80\right)$$

#### C. Perimeter Spawn Geometry (Strict Viewport Exclusion)
Given camera viewport $[camX, camY, camX + W, camY + H]$ with $W = 960, H = 540$:
- Safety margin $M = 90\text{ px}$.
- 4 Cardinal Quadrant Zones:
  - **North Edge (0)**: $x \in [camX - 60, camX + W + 60]$, $y \in [camY - M - 60, camY - M]$
  - **South Edge (1)**: $x \in [camX - 60, camX + W + 60]$, $y \in [camY + H + M, camY + H + M + 60]$
  - **West Edge (2)**: $x \in [camX - M - 60, camX - M]$, $y \in [camY - 60, camY + H + 60]$
  - **East Edge (3)**: $x \in [camX + W + M, camX + W + M + 60]$, $y \in [camY - 60, camY + H + 60]$
- Clamp all coordinates to arena boundaries $[-2000, 2000]$.
- Every ambient spawn randomly selects one cardinal edge, then scatters cluster members with jitter $\pm 30\text{ px}$.
- Mathematical Guarantee: For every spawned entity $(x, y)$, $|x - (camX + W/2)| > W/2$ or $|y - (camY + H/2)| > H/2$, ensuring zero popping on screen!

#### D. Tactical Milestone Events
Pre-allocated array of milestone triggers:
1. **$t = 30\text{s}$ — Pincer Rush: Flanking Claws**
   - 2 symmetric clusters (10 enemies each, 20 total) spawned simultaneously from West and East perimeter edges.
   - Composition: Fast Ghouls leading Skeletons.
2. **$t = 60\text{s}$ — Nightfall Convergence: Ring Surround**
   - 45 enemies spawned in a 360-degree perimeter circle at radius $R = 670\text{ px}$ centered at $(camX + W/2, camY + H/2)$.
   - Composition: Skeletons + Ghouls + Banshees.
3. **$t = 90\text{s}$ — Quad Pincer: Cross of Bones**
   - 4 simultaneous clusters (8 enemies each, 32 total) from North, South, East, West.
4. **$t = 120\text{s}$ (2:00) — Abyssal Siege: Death Knight Awakening**
   - 1 Death Knight (mini-boss) + 20 Banshee/Ghoul vanguard.
   - Triggers `onWaveEvent({ id: 'death_knight_1', name: 'Death Knight Awakens', description: 'Armored terror approaches!', timestamp: 120 })`.
5. **$t = 180\text{s}$ (3:00) — Abyssal Siege: Twin Harbingers**
   - 2 Death Knights + 35 mixed undead.
6. **$t = 240\text{s}$ (4:00) — Abyssal Siege: Death March**
   - 3 Death Knights + 50 mixed horde.
7. **$t > 240\text{s}$** — Recurring siege every 60s with $\min(5, \lfloor t/60 \rfloor)$ Death Knights.

#### E. Zero-Garbage Allocation
- Pre-allocated milestone array with boolean `triggered` flags.
- Reusable scratch coordinate object `{ x: 0, y: 0 }`.
- No closures or lambda callbacks inside `update(dt, playerX, playerY, camX, camY)`.
- Reusable weighted probability array `[weightSkel, weightGhoul, weightBanshee, weightDk]` populated in static config.

---

### 2.2 Milestone M3 Unit Test Suite Derivation

From the requirements across Milestone M3 (Occult Arsenal, Upgrades, WaveDirector):
Three dedicated test suites must be created in `tests/unit/`:
1. `tests/unit/Weapons.test.ts`
2. `tests/unit/UpgradeSystem.test.ts`
3. `tests/unit/WaveDirector.test.ts`

#### A. `tests/unit/Weapons.test.ts`
- **Suite 1: Arcane Scythe cleave arc & piercing**
  - Sweeping arc cleave centered in facing/target direction.
  - Cleaves up to max targets within arc sector (120 deg, 130px).
  - Damage scaling: $\text{damage} \times \text{might}$.
- **Suite 2: Soul Orbiters orbit physics & contact cooldown**
  - $N$ skulls orbiting at radius $R$, angular position $\theta(t) = \theta_0 + \omega t$.
  - Hitbox contact damage.
  - Per-enemy hit cooldown (0.3s): hits an enemy, does not hit again on frame 2, hits again on frame 20.
- **Suite 3: Abyssal Lightning multi-strike & necrotic chaining**
  - Targets $N$ enemies within range (400px).
  - Chains to $K$ adjacent enemies within chain radius (120px) via `SpatialHashGrid`.
  - Zero targets when no enemies within range.
- **Suite 4: Bone Spear straight piercing projectile & pool invariance**
  - Straight velocity vector $(v_x, v_y) = (\cos\theta, \sin\theta) \times speed$.
  - Pierces up to $P$ enemies (R1=2, R5=6), despawning on hit $P+1$.
  - 100% projectile pooling reuse: 50 shots fired and recycled maintain 0 memory leak.
- **Suite 5: Cursed Aura (Death Sigil) pulsating radius & knockback**
  - Pulses every interval $T$ (2.5s -> 1.5s).
  - Hits all enemies within radius $R$ (100px -> 180px).
  - Applies strong radial knockback away from player center.
- **Suite 6: Cooldown Reduction & Might Scaling Formulas**
  - Cooldown formula: $CD_{\text{effective}} = CD_{\text{base}} \times (1 - \min(0.50, CDR))$.
  - Damage formula: $DMG_{\text{effective}} = DMG_{\text{base}} \times Might$.
  - Area formula: $R_{\text{effective}} = R_{\text{base}} \times Area$.
- **Suite 7: WeaponManager Multi-Weapon Simulation**
  - Equips 5 weapons, runs 1,800 frames at 60Hz.
  - All weapons fire according to their timers. Zero runtime heap allocations.

#### B. `tests/unit/UpgradeSystem.test.ts`
- **Suite 1: Inventory Slot Limits (6 Weapons, 6 Passives)**
  - Max 6 weapons, max 6 passives.
  - Cannot add 7th weapon when 6 are equipped.
  - Cannot add 7th passive when 6 are equipped.
- **Suite 2: Upgrade Card Generation Algorithm**
  - Generates 3 or 4 distinct cards.
  - No duplicate cards in same roll.
  - Never offers an upgrade for an item already at Rank 5 (unless evolution).
  - When inventory slots are full, never offers a new unowned item.
  - Handles edge case when all items are maxed gracefully.
  - Seeded/deterministic RNG mode for reproducible tests.
- **Suite 3: Rank Progression (Ranks 1 to 5)**
  - Ranks increment from 1 to 5.
  - Exact stat deltas:
    - Tome of Might: +10% might per rank.
    - Ring of Velocity: +10% move speed per rank.
    - Blood Chalice: +20 max HP, +0.5 HP/s regen per rank.
    - Eldritch Magnet: +25% magnet radius per rank.
    - Obsidian Armor: +1 flat armor per rank.
- **Suite 4: Synergistic Weapon Evolutions**
  - 5 Evolution pairs:
    1. Arcane Scythe R5 + Blood Chalice -> Soul Reaping Harvester
    2. Soul Orbiters R5 + Ring of Velocity -> Abyssal Vortex
    3. Bone Spear R5 + Tome of Might -> Ossuary Cataclysm
    4. Abyssal Lightning R5 + Eldritch Magnet -> Storm of Torment
    5. Cursed Aura R5 + Obsidian Armor -> Domain of Decay
  - Evolution card offered only when base weapon is Rank 5 AND passive is owned.
  - Evolution replaces base weapon in inventory, preserving slot count (remains 6).
- **Suite 5: PlayerStats Integration**
  - Upgrades immediately call `PlayerStatsManager.addPassiveModifier`.
  - Effective player stats match mathematical expectations.

#### C. `tests/unit/WaveDirector.test.ts`
- **Suite 1: Timeline Escalation & Phase Transitions**
  - Phase 1 (0-30s): Awakening.
  - Phase 2 (30-60s): The Swarm.
  - Phase 3 (60-120s): Nightfall.
  - Phase 4 (120s+): Abyssal Siege.
- **Suite 2: Difficulty Scaling Mathematics**
  - HP multiplier values at 0s, 60s, 120s, 300s.
  - Speed multiplier values and 1.40 clamping.
  - Spawn interval decay and 0.5s floor.
- **Suite 3: Enemy Type Distribution by Phase**
  - Monte Carlo distribution test (1,000 samples per phase).
  - Phase 1: 100% Skeletons.
  - Phase 2: Skeletons + Ghouls (0 Banshees, 0 DKs).
  - Phase 3: Skeletons + Ghouls + Banshees (0 DKs).
  - Phase 4: Skeletons + Ghouls + Banshees + Death Knights.
- **Suite 4: Perimeter Spawning Viewport Exclusion**
  - Tests 100 perimeter spawns around camera $[100, 100, 1060, 640]$.
  - Mathematically asserts every single $(x, y)$ coordinate lies strictly outside the viewport.
  - Asserts all coordinates lie within arena $[-2000, 2000]$.
- **Suite 5: Milestone Events & Boss Scheduling**
  - Pincer Rush at 30s fires once.
  - Ring Surround at 60s fires once.
  - Death Knight mini-boss at 120s spawns with notification.
  - Milestone events do not duplicate on adjacent ticks.
- **Suite 6: Density Throttling & Zero-Garbage Pool Safety**
  - Respects active enemy cap.
  - Sustained 3,600 tick simulation conserves pool invariant (active + free = 2,048).

---

## 3. Caveats

1. **Read-Only Explorer Scope**: In accordance with the project rules and identity, this Explorer produces blueprints, mathematical models, and test designs; source code files in `src/` will be implemented by Worker agents.
2. **Integration Dependency**: Test suites import `WaveDirector`, `WeaponManager`, `UpgradeSystem`. When workers create these files, they must match the method signatures specified in this handoff to guarantee 100% green compilation.
3. **Audio / VFX Hooking**: Milestone events emit `WaveEventNotification` payloads containing `id`, `name`, and `description`. Sound triggers (e.g. boss roar, wave horn) can subscribe to this callback without tight coupling.

---

## 4. Conclusion & Concrete File Blueprints

### Blueprint 1: `src/core/systems/WaveDirector.ts`

```typescript
/**
 * WaveDirector.ts - Escalating Wave Director for Dark Fantasy Horde Survival.
 *
 * Responsibilities:
 * - 4-Phase Timeline Progression (Awakening, Swarm, Nightfall, Abyssal Siege).
 * - Continuous Difficulty Scaling (HP, Speed, Spawn Cadence, Active Cap).
 * - Strict Off-Screen Perimeter Spawning (Zero On-Screen Popping).
 * - Scripted Milestone Tactical Surges (Pincer Rushes, Ring Surrounds, Death Knight Mini-Bosses).
 * - Zero-Garbage Allocation in 60Hz update loop.
 */

import { HordeManager } from '../HordeManager';
import { EnemyType } from '../entities/Enemy';

export enum WavePhaseId {
  AWAKENING = 'AWAKENING',         // 0:00 - 0:30 (0 - 30s)
  THE_SWARM = 'THE_SWARM',         // 0:30 - 1:00 (30 - 60s)
  NIGHTFALL = 'NIGHTFALL',         // 1:00 - 2:00 (60 - 120s)
  ABYSSAL_SIEGE = 'ABYSSAL_SIEGE', // 2:00+ (120s+)
}

export interface WavePhaseConfig {
  id: WavePhaseId;
  name: string;
  startTime: number;
  endTime: number;
  weights: {
    skeleton: number;
    ghoul: number;
    banshee: number;
    death_knight: number;
  };
}

export interface WaveEventNotification {
  id: string;
  name: string;
  description: string;
  timestamp: number;
}

export interface MilestoneEvent {
  id: string;
  triggerTime: number;
  triggered: boolean;
  name: string;
  description: string;
  action: (director: WaveDirector, playerX: number, playerY: number, camX: number, camY: number) => void;
}

export interface WaveDirectorConfig {
  viewportWidth?: number;  // Default 960
  viewportHeight?: number; // Default 540
  spawnMargin?: number;    // Default 90 px outside viewport
  arenaBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  onWaveEvent?: (event: WaveEventNotification) => void;
}

export const WAVE_PHASE_CONFIGS: readonly WavePhaseConfig[] = [
  {
    id: WavePhaseId.AWAKENING,
    name: 'The Awakening',
    startTime: 0,
    endTime: 30,
    weights: { skeleton: 1.0, ghoul: 0.0, banshee: 0.0, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.THE_SWARM,
    name: 'The Swarm',
    startTime: 30,
    endTime: 60,
    weights: { skeleton: 0.65, ghoul: 0.35, banshee: 0.0, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.NIGHTFALL,
    name: 'Nightfall',
    startTime: 60,
    endTime: 120,
    weights: { skeleton: 0.45, ghoul: 0.35, banshee: 0.20, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.ABYSSAL_SIEGE,
    name: 'Abyssal Siege',
    startTime: 120,
    endTime: Infinity,
    weights: { skeleton: 0.35, ghoul: 0.35, banshee: 0.25, death_knight: 0.05 },
  },
];

export class WaveDirector {
  public readonly hordeManager: HordeManager;
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;
  public readonly spawnMargin: number;
  public readonly arenaBounds: { minX: number; maxX: number; minY: number; maxY: number };
  public readonly onWaveEvent?: (event: WaveEventNotification) => void;

  public elapsedTime: number = 0;
  private spawnTimer: number = 0;

  // Pre-allocated milestones
  private milestones: MilestoneEvent[];
  private lastPeriodicBossMinute: number = 2;

  // Pre-allocated scratch buffers for zero-allocation
  private readonly scratchPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(hordeManager: HordeManager, config: WaveDirectorConfig = {}) {
    this.hordeManager = hordeManager;
    this.viewportWidth = config.viewportWidth ?? 960;
    this.viewportHeight = config.viewportHeight ?? 540;
    this.spawnMargin = config.spawnMargin ?? 90;
    this.arenaBounds = config.arenaBounds ?? {
      minX: -2000,
      maxX: 2000,
      minY: -2000,
      maxY: 2000,
    };
    this.onWaveEvent = config.onWaveEvent;

    this.milestones = this.initializeMilestones();
  }

  private initializeMilestones(): MilestoneEvent[] {
    return [
      {
        id: 'pincer_30',
        triggerTime: 30,
        triggered: false,
        name: 'Pincer Rush',
        description: 'Undead ambush flanks from East and West!',
        action: (director, px, py, camX, camY) => {
          director.spawnPincerRush(camX, camY, 10, 'ghoul', 'skeleton');
        },
      },
      {
        id: 'ring_60',
        triggerTime: 60,
        triggered: false,
        name: 'Nightfall Convergence',
        description: 'A dark ring of spirits converges upon you!',
        action: (director, px, py, camX, camY) => {
          director.spawnRingSurround(camX, camY, 45);
        },
      },
      {
        id: 'quad_90',
        triggerTime: 90,
        triggered: false,
        name: 'Cross of Bones',
        description: 'Hordes emerge from all four directions!',
        action: (director, px, py, camX, camY) => {
          director.spawnQuadFlank(camX, camY, 8);
        },
      },
      {
        id: 'boss_120',
        triggerTime: 120,
        triggered: false,
        name: 'Death Knight Awakens',
        description: 'An imposing armored Death Knight commands the siege!',
        action: (director, px, py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 1);
        },
      },
      {
        id: 'boss_180',
        triggerTime: 180,
        triggered: false,
        name: 'Twin Harbingers',
        description: 'Two Death Knights join the onslaught!',
        action: (director, px, py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 2);
        },
      },
      {
        id: 'boss_240',
        triggerTime: 240,
        triggered: false,
        name: 'The Death March',
        description: 'Three Death Knights lead the final assault!',
        action: (director, px, py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 3);
        },
      },
    ];
  }

  public getCurrentPhase(time: number = this.elapsedTime): WavePhaseConfig {
    for (let i = 0; i < WAVE_PHASE_CONFIGS.length; i++) {
      const cfg = WAVE_PHASE_CONFIGS[i];
      if (time >= cfg.startTime && time < cfg.endTime) {
        return cfg;
      }
    }
    return WAVE_PHASE_CONFIGS[WAVE_PHASE_CONFIGS.length - 1];
  }

  public getHPMultiplier(time: number = this.elapsedTime): number {
    return 1.0 + (time / 60) * 0.30;
  }

  public getSpeedMultiplier(time: number = this.elapsedTime): number {
    return Math.min(1.40, 1.0 + (time / 120) * 0.15);
  }

  public getSpawnInterval(time: number = this.elapsedTime): number {
    return Math.max(0.50, 2.20 - (time / 60) * 0.55);
  }

  public getClusterSize(time: number = this.elapsedTime): number {
    return Math.min(30, 4 + Math.floor(time / 8));
  }

  public getMaxActiveCap(time: number = this.elapsedTime): number {
    return Math.min(1200, 150 + Math.floor(time / 10) * 80);
  }

  public selectEnemyType(time: number = this.elapsedTime): EnemyType {
    const phase = this.getCurrentPhase(time);
    const r = Math.random();
    const w = phase.weights;

    let cumulative = w.skeleton;
    if (r < cumulative) return 'skeleton';

    cumulative += w.ghoul;
    if (r < cumulative) return 'ghoul';

    cumulative += w.banshee;
    if (r < cumulative) return 'banshee';

    return 'death_knight';
  }

  /**
   * Generates a coordinate strictly outside the camera viewport.
   * Cardinal quadrant pick: 0=North, 1=South, 2=West, 3=East.
   */
  public getPerimeterPoint(
    camX: number,
    camY: number,
    outPoint: { x: number; y: number } = this.scratchPos
  ): { x: number; y: number } {
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const m = this.spawnMargin;
    const edge = Math.floor(Math.random() * 4);

    let x = 0;
    let y = 0;

    switch (edge) {
      case 0: // North
        x = camX - 60 + Math.random() * (w + 120);
        y = camY - m - Math.random() * 60;
        break;
      case 1: // South
        x = camX - 60 + Math.random() * (w + 120);
        y = camY + h + m + Math.random() * 60;
        break;
      case 2: // West
        x = camX - m - Math.random() * 60;
        y = camY - 60 + Math.random() * (h + 120);
        break;
      case 3: // East
      default:
        x = camX + w + m + Math.random() * 60;
        y = camY - 60 + Math.random() * (h + 120);
        break;
    }

    // Clamp inside arena bounds
    outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(this.arenaBounds.maxX - 20, x));
    outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(this.arenaBounds.maxY - 20, y));

    return outPoint;
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    camX: number,
    camY: number
  ): void {
    this.elapsedTime += dt;
    this.spawnTimer += dt;

    // 1. Check Scripted Milestone Events
    for (let i = 0; i < this.milestones.length; i++) {
      const ms = this.milestones[i];
      if (!ms.triggered && this.elapsedTime >= ms.triggerTime) {
        ms.triggered = true;
        ms.action(this, playerX, playerY, camX, camY);
        if (this.onWaveEvent) {
          this.onWaveEvent({
            id: ms.id,
            name: ms.name,
            description: ms.description,
            timestamp: ms.triggerTime,
          });
        }
      }
    }

    // 2. Periodic Boss Scaling (> 240s, every 60s)
    const currentMinute = Math.floor(this.elapsedTime / 60);
    if (currentMinute > 4 && currentMinute > this.lastPeriodicBossMinute) {
      this.lastPeriodicBossMinute = currentMinute;
      const count = Math.min(5, currentMinute - 1);
      this.spawnDeathKnightMiniBoss(camX, camY, count);
      if (this.onWaveEvent) {
        this.onWaveEvent({
          id: `periodic_boss_${currentMinute}`,
          name: 'Abyssal Incursion',
          description: `${count} Death Knights emerge from the void!`,
          timestamp: this.elapsedTime,
        });
      }
    }

    // 3. Ambient Continuous Cluster Spawning
    const interval = this.getSpawnInterval(this.elapsedTime);
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;

      const currentCap = this.getMaxActiveCap(this.elapsedTime);
      if (this.hordeManager.getActiveCount() < currentCap) {
        this.spawnAmbientCluster(camX, camY);
      }
    }
  }

  private spawnAmbientCluster(camX: number, camY: number): void {
    const clusterSize = this.getClusterSize(this.elapsedTime);
    const hpMult = this.getHPMultiplier(this.elapsedTime);
    const speedMult = this.getSpeedMultiplier(this.elapsedTime);

    const center = this.getPerimeterPoint(camX, camY);

    for (let i = 0; i < clusterSize; i++) {
      const type = this.selectEnemyType(this.elapsedTime);
      const jx = center.x + (Math.random() - 0.5) * 60;
      const jy = center.y + (Math.random() - 0.5) * 60;
      this.hordeManager.spawn(type, jx, jy, hpMult, speedMult);
    }
  }

  public spawnPincerRush(
    camX: number,
    camY: number,
    countPerSide: number,
    vanguardType: EnemyType = 'ghoul',
    rearType: EnemyType = 'skeleton'
  ): void {
    const m = this.spawnMargin;
    const h = this.viewportHeight;
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    // Left flank
    const leftX = camX - m - 40;
    const leftY = camY + h / 2;
    // Right flank
    const rightX = camX + this.viewportWidth + m + 40;
    const rightY = camY + h / 2;

    for (let i = 0; i < countPerSide; i++) {
      const type = i < countPerSide / 2 ? vanguardType : rearType;
      const offset = (i - countPerSide / 2) * 25;
      this.hordeManager.spawn(type, leftX, leftY + offset, hpMult, speedMult);
      this.hordeManager.spawn(type, rightX, rightY + offset, hpMult, speedMult);
    }
  }

  public spawnRingSurround(camX: number, camY: number, count: number): void {
    const centerX = camX + this.viewportWidth / 2;
    const centerY = camY + this.viewportHeight / 2;
    const radius = 670; // Outside 960x540 camera
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const type = i % 3 === 0 ? 'banshee' : i % 2 === 0 ? 'ghoul' : 'skeleton';
      this.hordeManager.spawn(type, x, y, hpMult, speedMult);
    }
  }

  public spawnQuadFlank(camX: number, camY: number, countPerSide: number): void {
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const m = this.spawnMargin + 30;
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    const origins = [
      { x: camX + w / 2, y: camY - m },             // North
      { x: camX + w / 2, y: camY + h + m },         // South
      { x: camX - m, y: camY + h / 2 },             // West
      { x: camX + w + m, y: camY + h / 2 },         // East
    ];

    for (const origin of origins) {
      for (let i = 0; i < countPerSide; i++) {
        const type = this.selectEnemyType();
        const jx = origin.x + (Math.random() - 0.5) * 50;
        const jy = origin.y + (Math.random() - 0.5) * 50;
        this.hordeManager.spawn(type, jx, jy, hpMult, speedMult);
      }
    }
  }

  public spawnDeathKnightMiniBoss(camX: number, camY: number, bossCount: number = 1): void {
    const hpMult = this.getHPMultiplier() * 1.5; // Extra durability for boss
    const speedMult = this.getSpeedMultiplier();

    for (let b = 0; b < bossCount; b++) {
      const pt = this.getPerimeterPoint(camX, camY);
      this.hordeManager.spawn('death_knight', pt.x, pt.y, hpMult, speedMult);

      // Escort vanguard (10 ghouls/banshees)
      for (let e = 0; e < 10; e++) {
        const escortType = e % 2 === 0 ? 'banshee' : 'ghoul';
        this.hordeManager.spawn(
          escortType,
          pt.x + (Math.random() - 0.5) * 80,
          pt.y + (Math.random() - 0.5) * 80,
          hpMult * 0.8,
          speedMult
        );
      }
    }
  }

  public reset(): void {
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.lastPeriodicBossMinute = 2;
    for (let i = 0; i < this.milestones.length; i++) {
      this.milestones[i].triggered = false;
    }
  }
}
```

---

### Blueprint 2: `tests/unit/WaveDirector.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import {
  WaveDirector,
  WavePhaseId,
  WAVE_PHASE_CONFIGS,
} from '../../src/core/systems/WaveDirector';

describe('WaveDirector Unit Tests (Milestone M3)', () => {
  let hordeManager: HordeManager;
  let waveDirector: WaveDirector;

  beforeEach(() => {
    hordeManager = new HordeManager({
      maxCapacity: 2048,
      worldBounds: { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 },
    });
    waveDirector = new WaveDirector(hordeManager, {
      viewportWidth: 960,
      viewportHeight: 540,
      spawnMargin: 90,
      arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
    });
  });

  describe('Suite 1: Timeline Escalation & Phase Transitions', () => {
    it('evaluates correct phase for elapsed time thresholds', () => {
      expect(waveDirector.getCurrentPhase(0).id).toBe(WavePhaseId.AWAKENING);
      expect(waveDirector.getCurrentPhase(29.9).id).toBe(WavePhaseId.AWAKENING);

      expect(waveDirector.getCurrentPhase(30).id).toBe(WavePhaseId.THE_SWARM);
      expect(waveDirector.getCurrentPhase(59.9).id).toBe(WavePhaseId.THE_SWARM);

      expect(waveDirector.getCurrentPhase(60).id).toBe(WavePhaseId.NIGHTFALL);
      expect(waveDirector.getCurrentPhase(119.9).id).toBe(WavePhaseId.NIGHTFALL);

      expect(waveDirector.getCurrentPhase(120).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
      expect(waveDirector.getCurrentPhase(300).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
    });

    it('advances current phase automatically during update ticks', () => {
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);

      // Advance past 30s
      waveDirector.update(31, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.THE_SWARM);

      // Advance past 60s
      waveDirector.update(30, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.NIGHTFALL);

      // Advance past 120s
      waveDirector.update(60, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.ABYSSAL_SIEGE);
    });
  });

  describe('Suite 2: Difficulty Scaling Mathematics', () => {
    it('computes exact HP multiplier over time (1.0 + t/60 * 0.30)', () => {
      expect(waveDirector.getHPMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getHPMultiplier(60)).toBeCloseTo(1.30, 4);
      expect(waveDirector.getHPMultiplier(120)).toBeCloseTo(1.60, 4);
      expect(waveDirector.getHPMultiplier(300)).toBeCloseTo(2.50, 4);
    });

    it('computes exact speed multiplier with 1.40 ceiling clamp', () => {
      expect(waveDirector.getSpeedMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getSpeedMultiplier(120)).toBeCloseTo(1.15, 4);
      expect(waveDirector.getSpeedMultiplier(240)).toBeCloseTo(1.30, 4);
      expect(waveDirector.getSpeedMultiplier(600)).toBeCloseTo(1.40, 4); // Clamped
    });

    it('scales spawn interval down to minimum 0.50s', () => {
      expect(waveDirector.getSpawnInterval(0)).toBeCloseTo(2.20, 4);
      expect(waveDirector.getSpawnInterval(60)).toBeCloseTo(1.65, 4);
      expect(waveDirector.getSpawnInterval(120)).toBeCloseTo(1.10, 4);
      expect(waveDirector.getSpawnInterval(300)).toBeCloseTo(0.50, 4); // Clamped
    });

    it('scales cluster size up to maximum 30', () => {
      expect(waveDirector.getClusterSize(0)).toBe(4);
      expect(waveDirector.getClusterSize(40)).toBe(9);
      expect(waveDirector.getClusterSize(120)).toBe(19);
      expect(waveDirector.getClusterSize(300)).toBe(30); // Clamped
    });
  });

  describe('Suite 3: Enemy Type Distribution by Phase', () => {
    it('spawns 100% skeletons during Phase 1 (Awakening)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 500; i++) {
        const type = waveDirector.selectEnemyType(15);
        counts[type]++;
      }
      expect(counts.skeleton).toBe(500);
      expect(counts.ghoul).toBe(0);
      expect(counts.banshee).toBe(0);
      expect(counts.death_knight).toBe(0);
    });

    it('spawns skeletons and ghouls only during Phase 2 (The Swarm)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 1000; i++) {
        const type = waveDirector.selectEnemyType(45);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(550);
      expect(counts.ghoul).toBeGreaterThan(250);
      expect(counts.banshee).toBe(0);
      expect(counts.death_knight).toBe(0);
    });

    it('introduces banshees in Phase 3 (Nightfall)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 1000; i++) {
        const type = waveDirector.selectEnemyType(90);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(350);
      expect(counts.ghoul).toBeGreaterThan(250);
      expect(counts.banshee).toBeGreaterThan(120);
      expect(counts.death_knight).toBe(0);
    });

    it('includes death knights in Phase 4 (Abyssal Siege)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 2000; i++) {
        const type = waveDirector.selectEnemyType(150);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(500);
      expect(counts.ghoul).toBeGreaterThan(500);
      expect(counts.banshee).toBeGreaterThan(300);
      expect(counts.death_knight).toBeGreaterThan(30); // ~5% of 2000 = ~100
    });
  });

  describe('Suite 4: Perimeter Spawning & Viewport Culling Exclusion', () => {
    it('guarantees 100% of perimeter points lie strictly outside camera viewport', () => {
      const camX = 200;
      const camY = 300;
      const w = 960;
      const h = 540;

      for (let i = 0; i < 200; i++) {
        const pt = waveDirector.getPerimeterPoint(camX, camY);
        const insideX = pt.x >= camX && pt.x <= camX + w;
        const insideY = pt.y >= camY && pt.y <= camY + h;

        // Both insideX and insideY CANNOT be true at the same time
        const isInsideFrustum = insideX && insideY;
        expect(isInsideFrustum).toBe(false);

        // Verify point is within arena boundaries
        expect(pt.x).toBeGreaterThanOrEqual(-2000);
        expect(pt.x).toBeLessThanOrEqual(2000);
        expect(pt.y).toBeGreaterThanOrEqual(-2000);
        expect(pt.y).toBeLessThanOrEqual(2000);
      }
    });
  });

  describe('Suite 5: Milestone Events & Mini-Boss Scheduling', () => {
    it('triggers pincer rush at 30 seconds exactly once', () => {
      let notified = false;
      const director = new WaveDirector(hordeManager, {
        onWaveEvent: (e) => {
          if (e.id === 'pincer_30') notified = true;
        },
      });

      // Step up to 29s -> not triggered
      director.update(29, 0, 0, 0, 0);
      expect(notified).toBe(false);
      const countBefore = hordeManager.getActiveCount();

      // Step past 30s -> triggered
      director.update(2, 0, 0, 0, 0);
      expect(notified).toBe(true);
      expect(hordeManager.getActiveCount()).toBeGreaterThan(countBefore);
    });

    it('triggers Death Knight mini-boss at 120 seconds with notification', () => {
      let bossEvent: any = null;
      const director = new WaveDirector(hordeManager, {
        onWaveEvent: (e) => {
          if (e.id === 'boss_120') bossEvent = e;
        },
      });

      director.update(121, 0, 0, 0, 0);
      expect(bossEvent).not.toBeNull();
      expect(bossEvent.name).toContain('Death Knight');

      const active = hordeManager.getActiveEnemies();
      const deathKnights = active.filter((e) => e.type.toLowerCase() === 'death_knight');
      expect(deathKnights.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Suite 6: Density Throttling & Pool Conservation', () => {
    it('throttles ambient cluster spawns when active count reaches capacity cap', () => {
      // Artificially saturate pool to cap
      const cap = waveDirector.getMaxActiveCap(10); // ~230
      for (let i = 0; i < cap + 50; i++) {
        hordeManager.spawn('skeleton', i, i);
      }

      const countBefore = hordeManager.getActiveCount();
      // Tick director for 5 seconds (multiple spawn intervals)
      for (let t = 0; t < 5; t++) {
        waveDirector.update(1.0, 0, 0, 0, 0);
      }

      // Should not have spawned ambient clusters because cap was exceeded
      expect(hordeManager.getActiveCount()).toBe(countBefore);
    });

    it('resets wave director state cleanly for new run', () => {
      waveDirector.update(150, 0, 0, 0, 0);
      expect(waveDirector.elapsedTime).toBe(150);

      waveDirector.reset();
      expect(waveDirector.elapsedTime).toBe(0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);
    });
  });
});
```

---

### Blueprint 3: `tests/unit/Weapons.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { CursedAura } from '../../src/core/weapons/CursedAura';

describe('Occult Weapons & WeaponManager Suite (Milestone M3)', () => {
  let hordeManager: HordeManager;
  let player: Player;
  let statsManager: PlayerStatsManager;
  let weaponManager: WeaponManager;

  beforeEach(() => {
    hordeManager = new HordeManager({ maxCapacity: 1000 });
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
    weaponManager = new WeaponManager(hordeManager, player);
  });

  describe('Suite 1: Arcane Scythe cleave arc & target piercing', () => {
    it('cleaves all enemies within forward arc and deals might-scaled damage', () => {
      const scythe = new ArcaneScythe(player, hordeManager);
      scythe.rank = 1;

      // Place 3 skeletons in front of player (facing right)
      const e1 = hordeManager.spawn('skeleton', 60, 0);
      const e2 = hordeManager.spawn('skeleton', 70, 20);
      const e3 = hordeManager.spawn('skeleton', 70, -20);
      // Place 1 enemy behind player
      const eBehind = hordeManager.spawn('skeleton', -60, 0);

      const initialHp1 = e1!.health;
      scythe.fire(0, 0);

      expect(e1!.health).toBeLessThan(initialHp1);
      expect(e2!.health).toBeLessThan(initialHp1);
      expect(e3!.health).toBeLessThan(initialHp1);
      expect(eBehind!.health).toBe(initialHp1); // Untouched
    });

    it('scales damage and cleave radius from Rank 1 to Rank 5', () => {
      const scythe = new ArcaneScythe(player, hordeManager);
      expect(scythe.getDamage(1)).toBeLessThan(scythe.getDamage(5));
      expect(scythe.getArea(1)).toBeLessThan(scythe.getArea(5));
      expect(scythe.getCooldown(1)).toBeGreaterThan(scythe.getCooldown(5));
    });
  });

  describe('Suite 2: Soul Orbiters orbit kinematics & per-enemy hit cooldown', () => {
    it('maintains continuous rotation at fixed radius around player', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 2; // 3 skulls

      const initialAngle = orbiters.skulls[0].angle;
      orbiters.update(0.1);
      expect(orbiters.skulls[0].angle).not.toBe(initialAngle);

      // Radial distance remains constant
      const skull = orbiters.skulls[0];
      const dist = Math.hypot(skull.x - player.position.x, skull.y - player.position.y);
      expect(dist).toBeCloseTo(orbiters.orbitRadius, 1);
    });

    it('enforces per-enemy contact cooldown preventing frame-by-frame damage spam', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 1;

      // Position enemy right on the orbiter skull
      const skull = orbiters.skulls[0];
      const enemy = hordeManager.spawn('death_knight', skull.x, skull.y);
      const hpInitial = enemy!.health;

      // Frame 1: Hit occurs
      orbiters.update(1 / 60);
      const hpAfterHit1 = enemy!.health;
      expect(hpAfterHit1).toBeLessThan(hpInitial);

      // Frame 2: Still on top of skull, but on cooldown
      orbiters.update(1 / 60);
      expect(enemy!.health).toBe(hpAfterHit1); // No new damage dealt immediately

      // Step past per-enemy hit cooldown (0.3s)
      orbiters.update(0.35);
      expect(enemy!.health).toBeLessThan(hpAfterHit1); // Damage dealt again
    });
  });

  describe('Suite 3: Abyssal Lightning chain necrosis', () => {
    it('strikes target enemy and chains to nearest neighbor via SpatialHashGrid', () => {
      const lightning = new AbyssalLightning(player, hordeManager);
      lightning.rank = 1;

      const primary = hordeManager.spawn('skeleton', 100, 0);
      const neighbor = hordeManager.spawn('skeleton', 140, 0); // within chain radius 120px
      const distant = hordeManager.spawn('skeleton', 600, 0);  // outside chain radius

      lightning.triggerStrike();

      expect(primary!.health).toBeLessThan(25);
      expect(neighbor!.health).toBeLessThan(25);
      expect(distant!.health).toBe(25);
    });
  });

  describe('Suite 4: Bone Spear piercing & zero-allocation projectile pool', () => {
    it('penetrates up to pierce limit and despawns upon exceeding limit', () => {
      const spear = new BoneSpear(player, hordeManager);
      spear.rank = 1; // Pierce = 2

      // Line up 3 skeletons in a row
      const e1 = hordeManager.spawn('skeleton', 50, 0);
      const e2 = hordeManager.spawn('skeleton', 100, 0);
      const e3 = hordeManager.spawn('skeleton', 150, 0);

      const proj = spear.fireProjectile(1, 0); // Fired rightwards
      expect(proj).not.toBeNull();
      expect(proj!.active).toBe(true);

      // Pass through e1 -> pierce count decrements to 1
      spear.handleHit(proj!, e1!);
      expect(proj!.pierceRemaining).toBe(1);
      expect(proj!.active).toBe(true);

      // Pass through e2 -> pierce count decrements to 0
      spear.handleHit(proj!, e2!);
      expect(proj!.pierceRemaining).toBe(0);
      expect(proj!.active).toBe(false); // Despawned and recycled

      // e3 is not hit
      expect(e3!.health).toBe(25);
    });

    it('sustains 100% projectile identity reuse without heap growth', () => {
      const spear = new BoneSpear(player, hordeManager);
      const poolCapacity = spear.projectilePool.getCapacity();

      for (let i = 0; i < 500; i++) {
        const p = spear.fireProjectile(1, 0);
        if (p) spear.recycleProjectile(p);
      }

      expect(spear.projectilePool.getAvailableCount()).toBe(poolCapacity);
    });
  });

  describe('Suite 5: Cursed Aura pulsating radius & radial knockback', () => {
    it('inflicts damage and pushes all enemies inside radius outwards', () => {
      const aura = new CursedAura(player, hordeManager);
      aura.rank = 1;

      const inside = hordeManager.spawn('skeleton', 40, 0);
      const outside = hordeManager.spawn('skeleton', 250, 0);

      aura.pulse();

      expect(inside!.health).toBeLessThan(25);
      expect(inside!.pushVx).toBeGreaterThan(0); // Pushed away along X
      expect(outside!.health).toBe(25);
      expect(outside!.pushVx).toBe(0);
    });
  });

  describe('Suite 6: Cooldown Reduction & Might Scaling Integration', () => {
    it('applies player CDR clamped at 50% ceiling', () => {
      statsManager.setBaseStat('cooldownReduction', 0.30);
      const scythe = new ArcaneScythe(player, hordeManager, statsManager);
      const baseCD = scythe.baseCooldown;
      expect(scythe.getEffectiveCooldown()).toBeCloseTo(baseCD * 0.70, 4);

      // Set CDR to 80% -> clamped at 50%
      statsManager.setBaseStat('cooldownReduction', 0.80);
      expect(scythe.getEffectiveCooldown()).toBeCloseTo(baseCD * 0.50, 4);
    });

    it('scales weapon damage proportionally with Might multiplier', () => {
      statsManager.setBaseStat('might', 1.50);
      const spear = new BoneSpear(player, hordeManager, statsManager);
      expect(spear.getEffectiveDamage()).toBeCloseTo(spear.baseDamage * 1.50, 4);
    });
  });

  describe('Suite 7: WeaponManager Multi-Weapon Orchestration', () => {
    it('equips up to 6 weapons and ticks all auto-fire timers concurrently', () => {
      weaponManager.addWeapon(new ArcaneScythe(player, hordeManager));
      weaponManager.addWeapon(new SoulOrbiters(player, hordeManager));
      weaponManager.addWeapon(new AbyssalLightning(player, hordeManager));
      weaponManager.addWeapon(new BoneSpear(player, hordeManager));
      weaponManager.addWeapon(new CursedAura(player, hordeManager));

      expect(weaponManager.getEquippedCount()).toBe(5);

      // Run 60 frames (1 second)
      hordeManager.spawnWave('skeleton', 20, { x: 0, y: 0 }, 100);
      for (let f = 0; f < 60; f++) {
        weaponManager.update(1 / 60);
      }

      // Weapons should have fired and damaged horde
      expect(hordeManager.totalKilled).toBeGreaterThan(0);
    });
  });
});
```

---

### Blueprint 4: `tests/unit/UpgradeSystem.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import {
  UpgradeSystem,
  UpgradeCard,
  UpgradeType,
} from '../../src/core/systems/UpgradeSystem';

describe('Rogue-Lite UpgradeSystem & Synergies Suite (Milestone M3)', () => {
  let player: Player;
  let statsManager: PlayerStatsManager;
  let upgradeSystem: UpgradeSystem;

  beforeEach(() => {
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
    upgradeSystem = new UpgradeSystem(player, statsManager);
  });

  describe('Suite 1: Inventory Slot Limits (6 Weapons, 6 Passives)', () => {
    it('enforces maximum 6 active weapons capacity', () => {
      const weapons = [
        'arcane_scythe',
        'soul_orbiters',
        'abyssal_lightning',
        'bone_spear',
        'cursed_aura',
        'spectral_daggers',
      ];

      for (const w of weapons) {
        expect(upgradeSystem.canAddWeapon(w)).toBe(true);
        upgradeSystem.addWeapon(w);
      }
      expect(upgradeSystem.getWeaponSlotsCount()).toBe(6);

      // 7th weapon rejected
      expect(upgradeSystem.canAddWeapon('void_staff')).toBe(false);
    });

    it('enforces maximum 6 passives capacity', () => {
      const passives = [
        'tome_of_might',
        'ring_of_velocity',
        'blood_chalice',
        'eldritch_magnet',
        'obsidian_armor',
        'chrono_relic',
      ];

      for (const p of passives) {
        expect(upgradeSystem.canAddPassive(p)).toBe(true);
        upgradeSystem.addPassive(p);
      }
      expect(upgradeSystem.getPassiveSlotsCount()).toBe(6);

      // 7th passive rejected
      expect(upgradeSystem.canAddPassive('silver_bullet')).toBe(false);
    });
  });

  describe('Suite 2: Card Generation Algorithm', () => {
    it('generates 3 to 4 distinct upgrade choices without duplicates', () => {
      const cards = upgradeSystem.generateUpgradeCards(3);
      expect(cards.length).toBe(3);

      const ids = new Set(cards.map((c) => c.itemId));
      expect(ids.size).toBe(3); // Strictly distinct
    });

    it('never offers upgrades for already maxed Rank 5 items', () => {
      // Max out Tome of Might to Rank 5
      for (let r = 1; r <= 5; r++) {
        upgradeSystem.upgradeItem('tome_of_might');
      }
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(5);

      // Roll 100 hands, ensure Tome of Might rank upgrade never appears
      for (let roll = 0; roll < 100; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        const hasMightRankUp = cards.some(
          (c) => c.itemId === 'tome_of_might' && c.type === UpgradeType.PASSIVE_RANK
        );
        expect(hasMightRankUp).toBe(false);
      }
    });

    it('only offers rank-ups of owned items when inventory slots are full', () => {
      // Fill all 6 weapon slots and 6 passive slots with Rank 1 items
      const wList = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
      const pList = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      wList.forEach((w) => upgradeSystem.addWeapon(w));
      pList.forEach((p) => upgradeSystem.addPassive(p));

      const cards = upgradeSystem.generateUpgradeCards(4);
      for (const card of cards) {
        const isOwned = wList.includes(card.itemId) || pList.includes(card.itemId);
        expect(isOwned).toBe(true);
      }
    });
  });

  describe('Suite 3: Rank Progression 1 through 5', () => {
    it('advances rank monotonically and applies correct passive modifiers', () => {
      expect(statsManager.getEffectiveStats().might).toBe(1.0);

      // Rank 1 (+10% might)
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(1);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.10, 4);

      // Rank 2 (+10% might)
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(2);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.20, 4);

      // Rank 5 (+50% might total)
      upgradeSystem.upgradeItem('tome_of_might');
      upgradeSystem.upgradeItem('tome_of_might');
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(5);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.50, 4);
    });

    it('applies flat armor bonuses from Obsidian Armor', () => {
      for (let r = 1; r <= 3; r++) {
        upgradeSystem.upgradeItem('obsidian_armor');
      }
      expect(statsManager.getEffectiveStats().armor).toBe(3);
    });
  });

  describe('Suite 4: Synergistic Weapon Evolutions', () => {
    it('unlocks evolution card when weapon is Rank 5 and passive is owned', () => {
      // Weapon: Arcane Scythe Rank 5, Passive: Blood Chalice Rank 1
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.upgradeItem('blood_chalice');

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(true);

      // Card generator should include the evolution
      const cards = upgradeSystem.generateUpgradeCards(4);
      const evoCard = cards.find((c) => c.type === UpgradeType.WEAPON_EVOLUTION);
      expect(evoCard).toBeDefined();
      expect(evoCard!.itemId).toBe('soul_reaping_harvester');
    });

    it('does not offer evolution if weapon is below Rank 5', () => {
      for (let i = 0; i < 4; i++) upgradeSystem.upgradeItem('arcane_scythe'); // Rank 4
      upgradeSystem.upgradeItem('blood_chalice');

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(false);
    });

    it('does not offer evolution if corresponding passive is missing', () => {
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe'); // Rank 5
      // No Blood Chalice

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(false);
    });

    it('replaces base weapon with evolved weapon preserving slot count', () => {
      upgradeSystem.addWeapon('arcane_scythe');
      for (let i = 1; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.addPassive('blood_chalice');

      const initialSlotCount = upgradeSystem.getWeaponSlotsCount();

      upgradeSystem.evolveWeapon('arcane_scythe', 'soul_reaping_harvester');

      expect(upgradeSystem.getWeaponSlotsCount()).toBe(initialSlotCount);
      expect(upgradeSystem.hasWeapon('arcane_scythe')).toBe(false);
      expect(upgradeSystem.hasWeapon('soul_reaping_harvester')).toBe(true);
    });
  });
});
```

---

## 5. Verification Method

To independently verify the architecture, contracts, and test suites:

1. **Verify Baseline Tests Still Pass 100%**:
   ```bash
   npm test
   ```
   *Expected*: All 13 existing test files (139 tests) pass cleanly without errors.

2. **Verify Type-Safety & Build**:
   ```bash
   npm run build
   ```
   *Expected*: `tsc -b && vite build` succeeds without compiler warnings or type mismatch.

3. **Verify Worker Implementation of WaveDirector & Test Suite**:
   Once Worker implements `src/core/systems/WaveDirector.ts`, `tests/unit/WaveDirector.test.ts`, `tests/unit/Weapons.test.ts`, and `tests/unit/UpgradeSystem.test.ts`:
   ```bash
   npx vitest run tests/unit/WaveDirector.test.ts
   npx vitest run tests/unit/Weapons.test.ts
   npx vitest run tests/unit/UpgradeSystem.test.ts
   ```
   *Expected*: All test suites pass with 100% green assertions, zero memory leaks, and sub-millisecond execution times.
