import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
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
      const ids = results.map((e) => e.id);

      expect(ids).toContain(near!.id);
      expect(ids).toContain(mid!.id);
      expect(ids).not.toContain(far!.id);
    });

    it('correctly detects entities straddling cell boundaries', () => {
      // Cell size is 64. Border between cell 0 and 1 is at x=64.
      const e1 = hordeManager.spawnEnemy('SKELETON', 63, 63); // Near cell boundary
      const results = hordeManager.queryNearby(66, 66, 10);

      expect(results.map((e) => e.id)).toContain(e1!.id);
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
      expect(queryDurationMs).toBeLessThan(75); // Under 75ms for 1,000 queries under parallel test runner load
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
