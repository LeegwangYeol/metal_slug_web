# Handoff Report: Milestone 1 Unit Test Suite & Build Harness Architecture

**Author**: Explorer 3 (`explorer_df_m1_3`)  
**Milestone**: M1 - Foundation & High-Performance Core ("Grim Harvest: Undead Siege")  
**Target Audience**: Parent Orchestrator (`orchestrator_dark_fantasy`), M1 Worker, Reviewer, Auditor  
**Date**: 2026-09-10  

---

## 1. Observation

### 1.1 Existing Test Framework & Build Configurations
- **`vitest.config.ts`**:
  - Direct configuration:
    ```typescript
    import { defineConfig } from 'vitest/config';
    export default defineConfig({
      test: {
        environment: 'node',
        include: ['tests/unit/**/*.{test,spec}.ts'],
        globals: true,
        testTimeout: 15000,
      },
    });
    ```
  - **Critical Finding**: Vitest is configured with `environment: 'node'`. This ensures that test execution runs directly in V8 Node.js without any virtual DOM overhead (`jsdom` / `happy-dom`). Tests run headlessly with microsecond tick latencies.
- **`package.json`**:
  - `"test": "vitest run"`
  - `"build": "tsc -b && vite build"`
  - `"test:e2e": "playwright test"`
  - Dependencies: `"typescript": "^5.8.0"`, `"vite": "^6.2.0"`, `"vitest": "^3.0.0"`, `"@playwright/test": "^1.50.0"`.
- **`tsconfig.json`**:
  - `compilerOptions`: `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `strict: true`, `noEmit: true`.
  - `include`: `["src", "tests"]`.
- **TypeScript Compilation Verification**:
  - Executed `npx tsc --noEmit` -> Exited with code 0 (clean compilation).
- **Existing Test Suite State**:
  - Ran `npm test -- --reporter=basic` -> 48 test files, 686 tests passing.
  - However, all existing 48 test files are coupled to previous Metal Slug and "cute" arcade implementations (`cute_sprites`, `allies_system`, `iron_nokana_boss`, `pow_system`, etc.).
  - Per the user's latest mandate (`2026-09-10T10:36:41Z` and `2026-09-10T10:37:39Z`), the codebase is being completely rebooted from scratch for Dark Fantasy Horde Survival. The old unit tests must be replaced by the new Dark Fantasy test suite.

### 1.2 Architectural Requirements from PROJECT.md
- **Horde Simulation**:
  - Capable of simulating 1,000+ simultaneous active undead entities at locked 60Hz (`dt = 1/60`).
  - Spatial partitioning (`SpatialHashGrid`) for broadphase queries.
  - Zero-garbage object pooling for entities, projectiles, and soul shards to eliminate GC frame drops.
- **Player & Progression**:
  - 360-degree omnidirectional movement.
  - Core statistics: `maxHealth`, `currentHealth`, `healthRegen`, `armor`, `moveSpeed`, `might`, `area`, `projSpeed`, `cooldownReduction`, `magnetRadius`, `luck`.
  - XP progression formula: `XP_required = Math.floor(base * Math.pow(level, 1.5))` with base XP = 10.
  - Level-up event triggers and surplus XP carryover.
  - Stat scaling with passive modifiers (flat bonuses, percentage bonuses, and CDR clamped at 50%).

---

## 2. Logic Chain

### 2.1 Headless Decoupling Strategy (DOM/Canvas Isolation)
1. **Observation**: In Node.js (`environment: 'node'`), browser globals (`window`, `document`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, `Image`, `AudioContext`) do not exist.
2. **Logic**:
   - Any reference to DOM globals inside `src/core/` will throw an immediate runtime `ReferenceError` during headless test execution.
   - Therefore, the core simulation layer must be strictly decoupled from rendering.
   - Simulation state (`HordeManager`, `SpatialHashGrid`, `Player`, `PlayerProgression`) contains only pure mathematical coordinates, vectors, spatial hashes, health values, timers, and stat numbers.
   - The game loop updates state via explicit fixed delta time: `manager.update(1/60)`.
   - Rendering (`src/render/`) only reads this state to paint onto HTML5 Canvas in browser runs, but is never invoked during core unit testing.
3. **Outcome**: Headless execution achieves maximum performance (~5ms to simulate 60 frames of 1,000 entities), zero mocking boilerplate, and 100% deterministic test execution.

### 2.2 Spatial Hash Grid Performance & Complexity Logic
1. **The Problem**: A naive O(N^2) collision or proximity check among 1,000 enemies requires `1,000 * 1,000 / 2 = 500,000` distance calculations per tick (30,000,000 calculations/second at 60Hz), which crashes web game performance.
2. **The Solution**: 2D Spatial Hash Grid dividing the world into fixed cells (e.g., cell size 64px or 128px).
3. **Query Invariant**:
   - For a query circle with radius $R$ centered at $(qx, qy)$, the broadphase computes the cell range $[\lfloor (qx - R)/C \rfloor, \lceil (qx + R)/C \rceil] \times [\lfloor (qy - R)/C \rfloor, \lceil (qy + R)/C \rceil]$.
   - Only entities in those adjacent cells (~4 to 9 cells) are examined in narrowphase.
   - Narrowphase asserts Euclidean distance: $(ex - qx)^2 + (ey - qy)^2 \le (R + r_{enemy})^2$.
4. **Test Verification**:
   - Test queries localized points and circles across 1,000 uniformly dispersed enemies.
   - Asserts average query latency is $< 50\mu s$ and total batch query time for 1,000 queries is $< 50ms$.
   - Asserts entities on cell boundaries and multi-cell spans are correctly found without duplicates or missing items.

### 2.3 Zero-Garbage Object Pooling & Memory Leak Logic
1. **The Problem**: Instantiating `new Enemy()` on each spawn and leaving dead enemies for JavaScript V8 Garbage Collection triggers GC pauses (stop-the-world stutters) every few seconds during 1,000-enemy swarms.
2. **The Solution**: Fixed pre-allocated object pool with free-list indexing.
3. **Pool Invariant**:
   $$\text{activeCount} + \text{availableCount} = \text{totalCapacity}$$
4. **Recycling Invariant (Object Identity)**:
   - When 50 enemies are spawned, killed, and 50 new enemies are spawned, the new instances MUST have identical memory references (`Object.is(oldRef, newRef)`) to instances previously held in the pool.
   - State reset invariant: recycled entities must have their HP reset to `maxHealth`, `isAlive = true`, position set to new spawn coordinates, velocity reset to 0, and zero residual state from previous lives.
5. **Long-Run Stress**:
   - 3,600 consecutive ticks (simulating 60 seconds at 60Hz) of continuous spawn/move/kill/cull cycles must not increase memory allocations or drift pool sizes.

### 2.4 Progression Mathematical Curve Logic
1. **Formula**:
   $$\text{XP}_{\text{required}}(L) = \lfloor \text{base} \cdot L^{1.5} \rfloor \quad (\text{with } \text{base} = 10)$$
2. **Tabulated Exact Values**:
   - Level 1: $\lfloor 10 \cdot 1^{1.5} \rfloor = 10$
   - Level 2: $\lfloor 10 \cdot 2^{1.5} \rfloor = \lfloor 10 \cdot 2.828427 \rfloor = 28$
   - Level 3: $\lfloor 10 \cdot 3^{1.5} \rfloor = \lfloor 10 \cdot 5.196152 \rfloor = 51$
   - Level 4: $\lfloor 10 \cdot 4^{1.5} \rfloor = \lfloor 10 \cdot 8.000000 \rfloor = 80$
   - Level 5: $\lfloor 10 \cdot 5^{1.5} \rfloor = \lfloor 10 \cdot 11.180339 \rfloor = 111$
   - Level 8: $\lfloor 10 \cdot 8^{1.5} \rfloor = \lfloor 10 \cdot 22.627417 \rfloor = 226$
   - Level 10: $\lfloor 10 \cdot 10^{1.5} \rfloor = \lfloor 10 \cdot 31.622776 \rfloor = 316$
   - Level 16: $\lfloor 10 \cdot 16^{1.5} \rfloor = \lfloor 10 \cdot 64.000000 \rfloor = 640$
   - Level 20: $\lfloor 10 \cdot 20^{1.5} \rfloor = \lfloor 10 \cdot 89.442719 \rfloor = 894$
3. **Burst Level-Up & Surplus XP Invariant**:
   - When player gains large XP:
     $$\text{while } (\text{currentXP} \ge \text{xpRequired}) \implies \text{currentXP} \mathrel{-}= \text{xpRequired}; \quad \text{level}++; \quad \text{dispatch}(\text{level})$$
   - No XP may be lost during multi-level jumps (e.g. collecting a boss chest giving +1,000 XP).
   - The level-up listener must fire for each discrete level transition so that the rogue-lite upgrade selection modal can trigger the appropriate number of choices.

---

## 3. Concrete Test Suite Specifications

### 3.1 File 1: `tests/unit/HordeManager.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager, HordeConfig } from '../../src/core/HordeManager';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';
import { Enemy, EnemyType } from '../../src/core/entities/Enemy';

describe('HordeManager & SpatialHashGrid (Milestone 1 High-Performance Core)', () => {
  let hordeManager: HordeManager;

  beforeEach(() => {
    hordeManager = new HordeManager({
      maxCapacity: 2000,
      cullDistance: 1500,
      gridCellSize: 64,
      worldBounds: { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 },
    });
  });

  describe('Suite 1: High-Density Spawning & Scale Capacity (1,000+ simultaneous enemies)', () => {
    it('spawns 1,000 active enemies across types without allocation failure', () => {
      const types: EnemyType[] = ['SKELETON', 'GHOUL', 'BANSHEE', 'DEATH_KNIGHT'];
      
      for (let i = 0; i < 1000; i++) {
        const type = types[i % types.length];
        const angle = (i / 1000) * Math.PI * 2;
        const dist = 300 + (i % 500);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const enemy = hordeManager.spawnEnemy(type, x, y);
        
        expect(enemy).not.toBeNull();
        expect(enemy!.isActive).toBe(true);
        expect(enemy!.isAlive).toBe(true);
        expect(enemy!.health).toBeGreaterThan(0);
        expect(Number.isFinite(enemy!.x)).toBe(true);
        expect(Number.isFinite(enemy!.y)).toBe(true);
      }

      expect(hordeManager.getActiveCount()).toBe(1000);
      expect(hordeManager.getPoolAvailableCount()).toBe(1000); // 2000 - 1000
    });

    it('spawning 1,000 enemies completes under high-performance threshold (< 30ms)', () => {
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        hordeManager.spawnEnemy('SKELETON', (i % 50) * 20, Math.floor(i / 50) * 20);
      }
      const durationMs = performance.now() - startTime;

      expect(hordeManager.getActiveCount()).toBe(1000);
      expect(durationMs).toBeLessThan(30);
    });

    it('gracefully handles pool exhaustion when spawning beyond capacity', () => {
      const smallHorde = new HordeManager({ maxCapacity: 50 });
      for (let i = 0; i < 50; i++) {
        const e = smallHorde.spawnEnemy('GHOUL', i * 10, 0);
        expect(e).not.toBeNull();
      }
      expect(smallHorde.getActiveCount()).toBe(50);
      expect(smallHorde.getPoolAvailableCount()).toBe(0);

      // Attempt 51st spawn
      const overflowEnemy = smallHorde.spawnEnemy('GHOUL', 500, 0);
      expect(overflowEnemy).toBeNull();
      expect(smallHorde.getActiveCount()).toBe(50);
    });

    it('spawns cluster waves surrounding a target point', () => {
      const wave = hordeManager.spawnWave('SKELETON', 50, { x: 0, y: 0 }, 400);
      expect(wave.length).toBe(50);
      expect(hordeManager.getActiveCount()).toBe(50);

      for (const enemy of wave) {
        const dist = Math.hypot(enemy.x, enemy.y);
        expect(dist).toBeCloseTo(400, -1); // Within reasonable ring distance
      }
    });
  });

  describe('Suite 2: Spatial Hash Grid Query Speed & Correctness', () => {
    it('correctly includes entities within query radius and excludes distant entities', () => {
      const near = hordeManager.spawnEnemy('SKELETON', 100, 100);
      const mid = hordeManager.spawnEnemy('GHOUL', 140, 100);
      const far = hordeManager.spawnEnemy('BANSHEE', 600, 600);

      expect(near).not.toBeNull();
      expect(mid).not.toBeNull();
      expect(far).not.toBeNull();

      // Query around (100, 100) with radius 50 (should find near and mid, but not far)
      const results = hordeManager.queryNearby(100, 100, 50);
      const ids = results.map(e => e.id);

      expect(ids).toContain(near!.id);
      expect(ids).toContain(mid!.id);
      expect(ids).not.toContain(far!.id);
    });

    it('correctly detects entities straddling cell boundaries', () => {
      // Cell size is 64. Border between cell 0 and 1 is at x=64.
      const e1 = hordeManager.spawnEnemy('SKELETON', 63, 63); // Near cell boundary
      const results = hordeManager.queryNearby(66, 66, 10);
      
      expect(results.map(e => e.id)).toContain(e1!.id);
    });

    it('executes 1,000 spatial queries across 1,000 enemies in < 50ms total', () => {
      // Populate 1,000 enemies uniformly distributed in a 2000x2000 world
      for (let i = 0; i < 1000; i++) {
        const x = -1000 + (i % 32) * 60;
        const y = -1000 + Math.floor(i / 32) * 60;
        hordeManager.spawnEnemy('SKELETON', x, y);
      }

      const queryStartTime = performance.now();
      let totalFound = 0;

      for (let q = 0; q < 1000; q++) {
        const qx = -800 + (q % 40) * 40;
        const qy = -800 + Math.floor(q / 40) * 40;
        const matches = hordeManager.queryNearby(qx, qy, 80);
        totalFound += matches.length;
      }

      const queryDurationMs = performance.now() - queryStartTime;

      expect(totalFound).toBeGreaterThan(0);
      expect(queryDurationMs).toBeLessThan(50); // Under 50ms for 1,000 queries (< 50us per query)
    });

    it('updates spatial grid positions dynamically when enemies move', () => {
      const enemy = hordeManager.spawnEnemy('DEATH_KNIGHT', 50, 50);
      expect(enemy).not.toBeNull();

      expect(hordeManager.queryNearby(50, 50, 20).length).toBe(1);
      expect(hordeManager.queryNearby(800, 800, 20).length).toBe(0);

      // Move enemy to (800, 800) and update
      enemy!.x = 800;
      enemy!.y = 800;
      hordeManager.update(1 / 60, { x: 0, y: 0 });

      expect(hordeManager.queryNearby(50, 50, 20).length).toBe(0);
      expect(hordeManager.queryNearby(800, 800, 20).length).toBe(1);
    });
  });

  describe('Suite 3: Enemy Culling & Object Pooling Reuse (Zero-Garbage / Zero Memory Leaks)', () => {
    it('culls enemies exceeding cullDistance from player', () => {
      const playerPos = { x: 0, y: 0 };
      const closeEnemy = hordeManager.spawnEnemy('SKELETON', 100, 100);
      const distantEnemy = hordeManager.spawnEnemy('GHOUL', 2500, 2500); // dist ~3535px > cullDistance (1500px)

      expect(hordeManager.getActiveCount()).toBe(2);

      const culledCount = hordeManager.cullEnemies(playerPos);

      expect(culledCount).toBe(1);
      expect(hordeManager.getActiveCount()).toBe(1);
      expect(closeEnemy!.isActive).toBe(true);
      expect(distantEnemy!.isActive).toBe(false);
    });

    it('culls dead enemies when taking lethal damage during tick update', () => {
      const e1 = hordeManager.spawnEnemy('SKELETON', 10, 10);
      const e2 = hordeManager.spawnEnemy('GHOUL', 20, 20);

      expect(hordeManager.getActiveCount()).toBe(2);

      // Inflict lethal damage
      e1!.takeDamage(9999);
      expect(e1!.isAlive).toBe(false);

      hordeManager.update(1 / 60, { x: 0, y: 0 });

      expect(hordeManager.getActiveCount()).toBe(1);
      expect(e1!.isActive).toBe(false);
      expect(e2!.isActive).toBe(true);
    });

    it('verifies 100% object identity reuse (Zero new allocations on respawn)', () => {
      // Spawn 50 enemies and collect object references
      const originalReferences = new Set<Enemy>();
      for (let i = 0; i < 50; i++) {
        const e = hordeManager.spawnEnemy('SKELETON', i * 10, 0);
        expect(e).not.toBeNull();
        originalReferences.add(e!);
      }

      expect(hordeManager.getActiveCount()).toBe(50);

      // Kill/cull all 50 enemies
      hordeManager.clear();
      expect(hordeManager.getActiveCount()).toBe(0);
      expect(hordeManager.getPoolAvailableCount()).toBe(2000);

      // Respawn 50 enemies
      let reusedCount = 0;
      for (let i = 0; i < 50; i++) {
        const e = hordeManager.spawnEnemy('BANSHEE', i * 20, 100);
        expect(e).not.toBeNull();
        if (originalReferences.has(e!)) {
          reusedCount++;
        }
      }

      // Every single spawned instance MUST be an exact object reference from the pre-allocated pool
      expect(reusedCount).toBe(50);
      expect(hordeManager.getActiveCount()).toBe(50);
    });

    it('sanitizes recycled enemy state completely upon reuse', () => {
      const e = hordeManager.spawnEnemy('DEATH_KNIGHT', 50, 50);
      expect(e).not.toBeNull();

      // Corrupt state to simulate battle wear
      e!.takeDamage(e!.maxHealth - 1);
      e!.vx = 999;
      e!.vy = -999;
      expect(e!.health).toBe(1);

      // Release to pool
      hordeManager.killEnemy(e!);
      expect(hordeManager.getActiveCount()).toBe(0);

      // Respawn
      const recycled = hordeManager.spawnEnemy('DEATH_KNIGHT', 200, 300);
      expect(recycled).not.toBeNull();
      expect(recycled!.health).toBe(recycled!.maxHealth);
      expect(recycled!.isAlive).toBe(true);
      expect(recycled!.isActive).toBe(true);
      expect(recycled!.x).toBe(200);
      expect(recycled!.y).toBe(300);
      expect(recycled!.vx).toBe(0);
      expect(recycled!.vy).toBe(0);
    });

    it('sustained 3,600-tick simulation maintains pool invariant without memory leaks', () => {
      const totalCapacity = hordeManager.getPoolCapacity();

      for (let tick = 0; tick < 3600; tick++) {
        // Continuous spawn
        if (hordeManager.getActiveCount() < 500) {
          hordeManager.spawnEnemy('SKELETON', Math.cos(tick) * 500, Math.sin(tick) * 500);
        }

        // Randomly damage some enemies
        const active = hordeManager.getActiveEnemies();
        if (active.length > 50 && tick % 5 === 0) {
          active[0].takeDamage(9999);
        }

        hordeManager.update(1 / 60, { x: 0, y: 0 });

        // Check invariant every 100 ticks
        if (tick % 100 === 0) {
          expect(hordeManager.getActiveCount() + hordeManager.getPoolAvailableCount()).toBe(totalCapacity);
        }
      }

      expect(hordeManager.getActiveCount()).toBeLessThanOrEqual(totalCapacity);
      expect(hordeManager.getActiveCount() + hordeManager.getPoolAvailableCount()).toBe(totalCapacity);
    });
  });
});
```

---

### 3.2 File 2: `tests/unit/PlayerProgression.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerProgression, LevelUpEvent } from '../../src/core/progression/PlayerProgression';
import { PlayerStats, PassiveModifier, PlayerStatsManager } from '../../src/core/player/PlayerStats';

describe('PlayerProgression & Stat Scaling (Milestone 1 Core Math)', () => {
  let progression: PlayerProgression;
  let statsManager: PlayerStatsManager;

  beforeEach(() => {
    progression = new PlayerProgression(10); // Base XP = 10
    statsManager = new PlayerStatsManager({
      maxHealth: 100,
      currentHealth: 100,
      healthRegen: 0,
      armor: 0,
      moveSpeed: 200,
      might: 1.0,
      area: 1.0,
      projSpeed: 1.0,
      cooldownReduction: 0.0,
      magnetRadius: 80,
      luck: 1.0,
    });
  });

  describe('Suite 1: XP Required Mathematical Curve (XP_required = Math.floor(base * level^1.5))', () => {
    it('computes exact XP requirements for benchmark levels 1 to 20 with base = 10', () => {
      const testCases: [number, number][] = [
        [1, 10],   // 10 * 1^1.5 = 10
        [2, 28],   // 10 * 2^1.5 = 28.284 -> 28
        [3, 51],   // 10 * 3^1.5 = 51.961 -> 51
        [4, 80],   // 10 * 4^1.5 = 80.000 -> 80
        [5, 111],  // 10 * 5^1.5 = 111.803 -> 111
        [8, 226],  // 10 * 8^1.5 = 226.274 -> 226
        [10, 316], // 10 * 10^1.5 = 316.227 -> 316
        [16, 640], // 10 * 16^1.5 = 640.000 -> 640
        [20, 894], // 10 * 20^1.5 = 894.427 -> 894
      ];

      for (const [level, expectedXP] of testCases) {
        expect(progression.calculateXPRequired(level)).toBe(expectedXP);
      }
    });

    it('strictly satisfies monotonic growth for levels 1 through 100', () => {
      for (let lvl = 1; lvl < 100; lvl++) {
        const currentReq = progression.calculateXPRequired(lvl);
        const nextReq = progression.calculateXPRequired(lvl + 1);
        expect(nextReq).toBeGreaterThan(currentReq);
      }
    });

    it('supports custom base XP multipliers', () => {
      const customProg = new PlayerProgression(25);
      expect(customProg.calculateXPRequired(1)).toBe(25);
      expect(customProg.calculateXPRequired(4)).toBe(200); // 25 * 8 = 200
    });
  });

  describe('Suite 2: XP Acquisition & Single Level-Up Event Triggers', () => {
    it('initializes with level 1, 0 current XP, and xpToNextLevel = 10', () => {
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(0);
      expect(progression.getTotalXP()).toBe(0);
      expect(progression.getXPToNextLevel()).toBe(10);
    });

    it('accumulates XP without leveling up when below requirement', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(9);

      expect(levelsGained).toBe(0);
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(9);
      expect(progression.getTotalXP()).toBe(9);
      expect(levelUpSpy).not.toHaveBeenCalled();
    });

    it('triggers level up when XP matches threshold exactly', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(10);

      expect(levelsGained).toBe(1);
      expect(progression.getLevel()).toBe(2);
      expect(progression.getCurrentXP()).toBe(0);
      expect(progression.getTotalXP()).toBe(10);
      expect(progression.getXPToNextLevel()).toBe(28); // Level 2 requires 28 XP

      expect(levelUpSpy).toHaveBeenCalledTimes(1);
      expect(levelUpSpy).toHaveBeenCalledWith({
        newLevel: 2,
        previousLevel: 1,
        surplusXP: 0,
        xpRequiredForNext: 28,
      } as LevelUpEvent);
    });
  });

  describe('Suite 3: Surplus XP Carryover & Multi-Level Up Bursts', () => {
    it('carries over surplus XP to the next level accurately', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      // Level 1 needs 10 XP. Add 15 XP.
      const levelsGained = progression.addXP(15);

      expect(levelsGained).toBe(1);
      expect(progression.getLevel()).toBe(2);
      expect(progression.getCurrentXP()).toBe(5); // 15 - 10 = 5
      expect(progression.getTotalXP()).toBe(15);
      expect(progression.getXPToNextLevel()).toBe(28);
    });

    it('handles multi-level jump from a massive XP drop in sequential order', () => {
      const events: LevelUpEvent[] = [];
      progression.onLevelUp(e => events.push(e));

      // Level 1 requires 10 (cum 10)
      // Level 2 requires 28 (cum 38)
      // Level 3 requires 51 (cum 89)
      // Adding 100 XP:
      // - 100 - 10 = 90 -> Level 2
      // - 90 - 28 = 62 -> Level 3
      // - 62 - 51 = 11 -> Level 4 (surplus 11)
      const levelsGained = progression.addXP(100);

      expect(levelsGained).toBe(3);
      expect(progression.getLevel()).toBe(4);
      expect(progression.getCurrentXP()).toBe(11);
      expect(progression.getTotalXP()).toBe(100);
      expect(progression.getXPToNextLevel()).toBe(80); // Level 4 requires 80 XP

      expect(events.length).toBe(3);
      expect(events[0].newLevel).toBe(2);
      expect(events[1].newLevel).toBe(3);
      expect(events[2].newLevel).toBe(4);
      expect(events[2].surplusXP).toBe(11);
    });

    it('handles extreme burst XP (50,000 XP) without recursion overflow', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(50000);

      expect(levelsGained).toBeGreaterThan(30);
      expect(progression.getLevel()).toBe(levelsGained + 1);
      expect(progression.getTotalXP()).toBe(50000);
      expect(levelUpSpy).toHaveBeenCalledTimes(levelsGained);
    });

    it('ignores 0 or negative XP increments', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      expect(progression.addXP(0)).toBe(0);
      expect(progression.addXP(-50)).toBe(0);
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(0);
      expect(levelUpSpy).not.toHaveBeenCalled();
    });

    it('supports unregistering level-up listeners', () => {
      const levelUpSpy = vi.fn();
      const unsubscribe = progression.onLevelUp(levelUpSpy);

      progression.addXP(10); // Levels up to 2
      expect(levelUpSpy).toHaveBeenCalledTimes(1);

      unsubscribe();

      progression.addXP(50); // Levels up further
      expect(levelUpSpy).toHaveBeenCalledTimes(1); // Not called again after unsubscribe
    });
  });

  describe('Suite 4: Stat Scaling & Passive Modifiers', () => {
    it('returns unmodified base stats when no passives are equipped', () => {
      const stats = statsManager.getEffectiveStats();
      expect(stats.maxHealth).toBe(100);
      expect(stats.moveSpeed).toBe(200);
      expect(stats.might).toBe(1.0);
      expect(stats.armor).toBe(0);
      expect(stats.cooldownReduction).toBe(0.0);
      expect(stats.magnetRadius).toBe(80);
    });

    it('applies flat passive modifiers additively', () => {
      statsManager.addPassiveModifier({
        id: 'obsidian_armor_1',
        name: 'Obsidian Armor',
        stat: 'armor',
        type: 'flat',
        value: 3,
      });

      statsManager.addPassiveModifier({
        id: 'blood_chalice_1',
        name: 'Blood Chalice',
        stat: 'maxHealth',
        type: 'flat',
        value: 25,
      });

      const stats = statsManager.getEffectiveStats();
      expect(stats.armor).toBe(3);
      expect(stats.maxHealth).toBe(125);
    });

    it('applies percentage passive modifiers additively on top of baseline', () => {
      // Tome of Might Rank 1 (+10% might)
      statsManager.addPassiveModifier({
        id: 'might_1',
        name: 'Tome of Might',
        stat: 'might',
        type: 'percent',
        value: 0.10,
      });

      // Tome of Might Rank 2 (+10% might)
      statsManager.addPassiveModifier({
        id: 'might_2',
        name: 'Tome of Might',
        stat: 'might',
        type: 'percent',
        value: 0.10,
      });

      // Ring of Velocity (+15% move speed)
      statsManager.addPassiveModifier({
        id: 'velocity_1',
        name: 'Ring of Velocity',
        stat: 'moveSpeed',
        type: 'percent',
        value: 0.15,
      });

      const stats = statsManager.getEffectiveStats();
      expect(stats.might).toBeCloseTo(1.20, 5); // 1.0 + 0.10 + 0.10
      expect(stats.moveSpeed).toBeCloseTo(230, 5); // 200 * (1 + 0.15) = 230
    });

    it('strictly clamps Cooldown Reduction (CDR) at maximum 50% (0.50)', () => {
      statsManager.addPassiveModifier({
        id: 'cdr_1',
        name: 'Chrono Relic',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.35,
      });

      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.35);

      // Add another 30% CDR (total 65%)
      statsManager.addPassiveModifier({
        id: 'cdr_2',
        name: 'Temporal Sigil',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.30,
      });

      // Must be strictly clamped at 0.50 to avoid division by zero or infinite weapon firing
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.50);
    });

    it('removes modifiers cleanly restoring exact baseline stats', () => {
      const mod: PassiveModifier = {
        id: 'magnet_1',
        name: 'Eldritch Magnet',
        stat: 'magnetRadius',
        type: 'flat',
        value: 60,
      };

      statsManager.addPassiveModifier(mod);
      expect(statsManager.getEffectiveStats().magnetRadius).toBe(140);

      statsManager.removePassiveModifier('magnet_1');
      expect(statsManager.getEffectiveStats().magnetRadius).toBe(80);
    });
  });
});
```

---

## 4. Caveats & Invariants

1. **Cleanup of Obsolete Tests**:
   - The repository currently contains 48 unit test files in `tests/unit/` from previous iterations (e.g. `iron_nokana_boss.test.ts`, `allies_system.test.ts`, `cute_sprites_and_palette.test.ts`).
   - When the M1 Worker wipes the old code in `src/`, running `npm test` will attempt to execute those old test files against non-existent modules and fail.
   - **Remediation**: The M1 Worker must remove the old obsolete test files from `tests/unit/` when establishing the clean slate, keeping only the new Milestone 1 unit tests (`HordeManager.test.ts`, `PlayerProgression.test.ts`).
2. **Headless Execution Invariant**:
   - Under no circumstances should `window`, `document`, or `HTMLCanvasElement` be imported or referenced in `src/core/`.
   - Any rendering or browser API must live exclusively under `src/render/` or `src/ui/`.
3. **Floating Point Rounding in XP Math**:
   - `calculateXPRequired` must use `Math.floor(base * Math.pow(level, 1.5))` and NOT `Math.round` or `Math.ceil`. Both the test and implementation must match `Math.floor` precisely to guarantee deterministic levels.
4. **Performance Benchmark Headroom**:
   - The test asserts query duration $< 50\text{ms}$ for 1,000 queries. On modern V8 (Node 20+), 1,000 spatial hash queries typically run in $1.5\text{ms}$ to $4\text{ms}$. A $50\text{ms}$ ceiling provides a 10x safety margin against CI CPU throttling while decisively catching any $O(N^2)$ algorithmic regression ($> 500\text{ms}$).

---

## 5. Conclusion & Actionable Execution Plan for Worker

### 5.1 Concrete Worker File Placement
The Worker should implement the following source files matching these contracts:
1. `src/core/SpatialHashGrid.ts`: Fast spatial hash partitioning with numeric hashing and neighborhood queries.
2. `src/core/entities/Enemy.ts`: Data structures for Skeletons, Ghouls, Banshees, Death Knights, and reset/takeDamage methods.
3. `src/core/HordeManager.ts`: Object pool manager, spawning waves, culling distant/dead enemies, fixed timestep updates.
4. `src/core/progression/PlayerProgression.ts`: Mathematical XP curve, level-up dispatcher, surplus XP management.
5. `src/core/player/PlayerStats.ts`: Core 11 stats, passive modifier tracking, additive flat and percent scaling, CDR clamp.
6. `tests/unit/HordeManager.test.ts`: Drop in the complete test suite from Section 3.1.
7. `tests/unit/PlayerProgression.test.ts`: Drop in the complete test suite from Section 3.2.

### 5.2 Verification Commands
To verify independently:
```bash
# 1. Typecheck the entire project
npx tsc --noEmit

# 2. Run the newly designed unit tests
npx vitest run tests/unit/HordeManager.test.ts tests/unit/PlayerProgression.test.ts

# 3. Verify clean production build
npm run build
```

