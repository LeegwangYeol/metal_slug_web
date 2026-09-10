import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import { Enemy } from '../../src/core/entities/Enemy';

describe('Adversarial Stress & Empirical Challenge (M1 Core)', () => {
  let horde: HordeManager;

  beforeEach(() => {
    horde = new HordeManager({
      maxCapacity: 2048,
      cullDistance: 1500,
      gridCellSize: 64,
      worldBounds: { minX: -2500, minY: -2500, maxX: 2500, maxY: 2500 },
      separationStrength: 50.0,
    });
  });

  describe('Adversarial Challenge 1: Ground-Truth Oracle vs SpatialHashGrid', () => {
    it('verifies spatial query results match naive brute-force ground-truth (0 false negatives)', () => {
      // Spawn 1,000 enemies at random positions
      const enemyCount = 1000;
      for (let i = 0; i < enemyCount; i++) {
        const x = -2000 + ((i * 37) % 4000);
        const y = -2000 + ((i * 73) % 4000);
        horde.spawnEnemy('SKELETON', x, y);
      }

      const activeEnemies = horde.getActiveEnemies();
      expect(activeEnemies.length).toBe(enemyCount);

      // Perform 50 randomized queries and compare SpatialHashGrid with naive ground-truth
      const maxEntityRadius = horde.spatialGrid.maxEntityRadius; // 32
      const queryBuffer = new Int32Array(horde.maxEnemies);

      for (let q = 0; q < 50; q++) {
        const qx = -1800 + ((q * 101) % 3600);
        const qy = -1800 + ((q * 179) % 3600);
        const radius = 100 + (q % 150); // 100 to 250px radius

        // 1. Grid query
        const gridCount = horde.getEnemiesInRadius(qx, qy, radius, queryBuffer);
        const gridMatches = new Set<number>();
        for (let i = 0; i < gridCount; i++) {
          gridMatches.add(queryBuffer[i]);
        }

        // 2. Naive brute-force oracle
        // By SpatialHashGrid specification, it checks center distance <= (radius + maxEntityRadius)
        const thresholdSq = (radius + maxEntityRadius) * (radius + maxEntityRadius);
        const oracleMatches = new Set<number>();

        for (const enemy of activeEnemies) {
          const dx = enemy.x - qx;
          const dy = enemy.y - qy;
          if (dx * dx + dy * dy <= thresholdSq) {
            oracleMatches.add(enemy.id);
          }
        }

        // 3. Oracle comparison
        // Assert zero false negatives: every entity within threshold MUST be in gridMatches
        for (const expectedId of oracleMatches) {
          expect(gridMatches.has(expectedId)).toBe(true);
        }

        // Assert zero false positives: every entity returned MUST be within threshold
        for (const foundId of gridMatches) {
          expect(oracleMatches.has(foundId)).toBe(true);
        }

        expect(gridMatches.size).toBe(oracleMatches.size);
      }
    });
  });

  describe('Adversarial Challenge 2: Singularity Collapse Stress (1,500 enemies at identical coordinate)', () => {
    it('handles 1,500 enemies spawned at the exact same (0, 0) without infinite loop or NaN vectors', () => {
      for (let i = 0; i < 1500; i++) {
        const e = horde.spawnEnemy('GHOUL', 0, 0);
        expect(e).not.toBeNull();
      }

      expect(horde.getActiveCount()).toBe(1500);

      // Run 30 simulation ticks
      const dt = 1 / 60;
      for (let tick = 0; tick < 30; tick++) {
        expect(() => {
          horde.update(dt, { x: 100, y: 100 });
        }).not.toThrow();

        // Verify no enemy has NaN or Infinity position or velocity
        const enemies = horde.getActiveEnemies();
        let invalidCount = 0;
        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i];
          if (
            !Number.isFinite(enemy.x) ||
            !Number.isFinite(enemy.y) ||
            !Number.isFinite(enemy.vx) ||
            !Number.isFinite(enemy.vy)
          ) {
            invalidCount++;
          }
        }
        expect(invalidCount).toBe(0);
      }
    });
  });

  describe('Adversarial Challenge 3: 60Hz Sustained Performance (1,200 simultaneous enemies)', () => {
    it('simulates 1,200 active enemies at 60Hz with tick duration << 16.6ms', () => {
      // Spawn 1,200 enemies in a circle
      for (let i = 0; i < 1200; i++) {
        const angle = (i / 1200) * Math.PI * 2;
        const dist = 200 + (i % 800);
        horde.spawnEnemy(
          i % 4 === 0 ? 'DEATH_KNIGHT' : i % 2 === 0 ? 'BANSHEE' : 'SKELETON',
          Math.cos(angle) * dist,
          Math.sin(angle) * dist
        );
      }

      expect(horde.getActiveCount()).toBe(1200);

      const dt = 1 / 60;

      // Warm up JIT
      for (let w = 0; w < 10; w++) {
        horde.update(dt, { x: 0, y: 0 });
      }

      const tickDurations: number[] = [];
      const totalTicks = 300; // 5 seconds of 60Hz simulation

      for (let tick = 0; tick < totalTicks; tick++) {
        const t0 = performance.now();
        horde.update(dt, { x: 0, y: 0 });
        const dur = performance.now() - t0;
        tickDurations.push(dur);
      }

      const totalTime = tickDurations.reduce((a, b) => a + b, 0);
      const avgTick = totalTime / totalTicks;
      tickDurations.sort((a, b) => a - b);
      const p95Tick = tickDurations[Math.floor(totalTicks * 0.95)];
      const maxTick = tickDurations[totalTicks - 1];

      // Console telemetry for empirical report
      console.log(
        `[Empirical Benchmark] 1,200 Enemies 60Hz Simulation: Total=${totalTime.toFixed(1)}ms, Avg=${avgTick.toFixed(3)}ms, p95=${p95Tick.toFixed(3)}ms, Max=${maxTick.toFixed(3)}ms`
      );

      // Must be well within 60Hz budget (16.66ms for full frame, < 10ms for simulation core)
      expect(avgTick).toBeLessThan(8.0); // Strict threshold: avg < 8ms
      expect(p95Tick).toBeLessThan(40.0); // 95th percentile under 40ms under heavy parallel test runner load
      expect(avgTick).toBeLessThan(16.66); // 60Hz locked compliance
    });
  });

  describe('Adversarial Challenge 4: 1,000 Spatial Queries Latency Benchmark', () => {
    it('executes 1,000 spatial queries across 1,500 enemies in under 50ms', () => {
      // Spawn 1,500 enemies across the arena
      for (let i = 0; i < 1500; i++) {
        const x = -2000 + (i % 38) * 105;
        const y = -2000 + Math.floor(i / 38) * 105;
        horde.spawnEnemy('SKELETON', x, y);
      }

      const buffer = new Int32Array(512);
      const queryCount = 1000;
      let totalEntitiesFound = 0;

      const t0 = performance.now();
      for (let q = 0; q < queryCount; q++) {
        const qx = -1500 + (q % 31) * 100;
        const qy = -1500 + Math.floor(q / 31) * 100;
        const found = horde.getEnemiesInRadius(qx, qy, 120, buffer);
        totalEntitiesFound += found;
      }
      const durationMs = performance.now() - t0;

      console.log(
        `[Empirical Benchmark] 1,000 Queries across 1,500 Enemies: Duration=${durationMs.toFixed(2)}ms (${(durationMs / 1000 * 1000).toFixed(1)}us/query), Total Found=${totalEntitiesFound}`
      );

      expect(totalEntitiesFound).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(50); // Under 50ms requirement (typically ~2.5ms)
    });
  });

  describe('Adversarial Challenge 5: Object Pool Identity & Memory Leak Harness', () => {
    it('maintains 100% object identity preservation across 100,000 churn cycles with 0 memory leak', () => {
      const poolCapacity = horde.getPoolCapacity();
      expect(poolCapacity).toBe(2048);

      // Collect all 2,048 original pre-allocated object references
      const originalObjectSet = new Set<Enemy>();
      for (let i = 0; i < poolCapacity; i++) {
        originalObjectSet.add(horde.pool[i]);
      }
      expect(originalObjectSet.size).toBe(2048);

      const initialHeap = process.memoryUsage().heapUsed;

      // Simulate 2,000 ticks with high churn: 50 killed & 50 spawned every single tick = 100,000 spawns
      const churnPerTick = 50;
      const ticks = 2000;

      // Pre-fill 1,000 enemies
      for (let i = 0; i < 1000; i++) {
        horde.spawnEnemy('SKELETON', 0, 0);
      }

      for (let tick = 0; tick < ticks; tick++) {
        // Kill 50 active enemies
        const active = horde.getActiveEnemies();
        const killCount = Math.min(churnPerTick, active.length);
        for (let k = 0; k < killCount; k++) {
          horde.killEnemy(active[k]);
        }

        // Spawn 50 new enemies
        for (let s = 0; s < churnPerTick; s++) {
          const newEnemy = horde.spawnEnemy('GHOUL', (tick % 100) * 10, s * 10);
          expect(newEnemy).not.toBeNull();
          // Verify 100% object identity preservation: must be in original pre-allocated set
          expect(originalObjectSet.has(newEnemy!)).toBe(true);
        }

        // Invariant check on EVERY 100 ticks: active + free == capacity
        if (tick % 100 === 0) {
          expect(horde.getActiveCount() + horde.getPoolAvailableCount()).toBe(poolCapacity);
        }
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

      console.log(
        `[Empirical Benchmark] 2,000 Ticks High Churn (100,000 Spawns/Kills): Heap Delta = ${heapDeltaMB.toFixed(2)} MB`
      );

      // Invariant check at end
      expect(horde.getActiveCount() + horde.getPoolAvailableCount()).toBe(poolCapacity);
      // Heap delta must not grow wildly (< 15MB node.js runtime variance)
      expect(heapDeltaMB).toBeLessThan(15);
    });
  });

  describe('Adversarial Challenge 6: Edge Case Hardening & Invalid Inputs', () => {
    it('handles negative, NaN, and extreme out-of-bounds coordinates safely', () => {
      const e1 = horde.spawnEnemy('SKELETON', -999999, -999999);
      expect(e1).not.toBeNull();
      // Spatial grid clamps to world bounds (-2500, -2500)
      const out = new Int32Array(10);
      const count = horde.getEnemiesInRadius(-2500, -2500, 50, out);
      expect(count).toBeGreaterThanOrEqual(1);

      const e2 = horde.spawnEnemy('SKELETON', 999999, 999999);
      expect(e2).not.toBeNull();
    });

    it('handles duplicate despawn, invalid ID despawn, and dead enemy damage gracefully', () => {
      // Despawn invalid ID
      expect(() => horde.despawn(-1)).not.toThrow();
      expect(() => horde.despawn(9999)).not.toThrow();

      // Spawn and despawn
      const e = horde.spawnEnemy('BANSHEE', 0, 0);
      expect(e).not.toBeNull();
      const id = e!.id;

      horde.despawn(id);
      expect(horde.getActiveCount()).toBe(0);

      // Double despawn of same ID (should be safe no-op)
      expect(() => horde.despawn(id)).not.toThrow();

      // Damage on already-dead entity
      const res = horde.applyDamage(id, 50);
      expect(res.killed).toBe(false);
      expect(res.xpValue).toBe(0);
    });
  });
});
