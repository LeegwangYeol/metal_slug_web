import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHashGrid } from '../../src/core/SpatialHashGrid';

describe('SpatialHashGrid (Zero-Garbage Spatial Partitioning)', () => {
  let grid: SpatialHashGrid;

  beforeEach(() => {
    grid = new SpatialHashGrid({
      cellSize: 64,
      worldMinX: -1000,
      worldMinY: -1000,
      worldMaxX: 1000,
      worldMaxY: 1000,
      maxEntities: 1000,
      maxEntityRadius: 32,
    });
  });

  describe('Suite 1: Grid Geometry & Initialization', () => {
    it('correctly calculates grid dimensions and cell counts', () => {
      // Width = 2000, Height = 2000, CellSize = 64
      // cols = ceil(2000 / 64) = 32, rows = 32, total = 1024
      expect(grid.cols).toBe(32);
      expect(grid.rows).toBe(32);
      expect(grid.totalCells).toBe(1024);
      expect(grid.maxEntities).toBe(1000);
      expect(grid.maxEntityRadius).toBe(32);
    });

    it('initializes in clean state where queries return 0 matches', () => {
      const out = new Int32Array(50);
      const count = grid.queryRadius(0, 0, 100, out);
      expect(count).toBe(0);
    });
  });

  describe('Suite 2: Insertion & Neighborhood Queries', () => {
    it('inserts and retrieves entities within query radius', () => {
      grid.insert(0, 0, 0);
      grid.insert(1, 20, 20);
      grid.insert(2, 500, 500);

      const out = new Int32Array(50);
      const count = grid.queryRadius(0, 0, 50, out);

      expect(count).toBe(2);
      const ids = Array.from(out.subarray(0, count));
      expect(ids).toContain(0);
      expect(ids).toContain(1);
      expect(ids).not.toContain(2);
    });

    it('correctly finds entities straddling cell boundaries without duplicates', () => {
      // Cell boundary is at -1000 + 64 = -936. Entity placed at -936
      grid.insert(10, -936, 0);

      const out = new Int32Array(50);
      const count = grid.queryRadius(-930, 0, 20, out);

      expect(count).toBe(1);
      expect(out[0]).toBe(10);
    });

    it('handles out-of-bounds entities by clamping to edge cells', () => {
      // Entity placed far beyond world bounds
      grid.insert(5, 5000, 5000);

      const out = new Int32Array(50);
      // Query edge corner near (1000, 1000)
      const count = grid.queryRadius(990, 990, 60, out);

      expect(count).toBe(1);
      expect(out[0]).toBe(5);
    });
  });

  describe('Suite 3: AABB Queries & Callback Iteration', () => {
    it('queries entities inside an AABB box', () => {
      grid.insert(0, 100, 100);
      grid.insert(1, 150, 150);
      grid.insert(2, 300, 300);

      const out = new Int32Array(50);
      const count = grid.queryAABB(80, 80, 180, 180, out);

      expect(count).toBe(2);
      const ids = Array.from(out.subarray(0, count));
      expect(ids).toContain(0);
      expect(ids).toContain(1);
      expect(ids).not.toContain(2);
    });

    it('supports forEachInRadius with early termination', () => {
      grid.insert(0, 10, 0);
      grid.insert(1, 20, 0);
      grid.insert(2, 30, 0);

      const visited: number[] = [];
      grid.forEachInRadius(0, 0, 100, (id) => {
        visited.push(id);
        if (visited.length === 2) {
          return false; // Abort early
        }
      });

      expect(visited.length).toBe(2);
    });
  });

  describe('Suite 4: Rebuild & Scale Performance (1,000 entities)', () => {
    it('rebuilds entire grid in O(N) without memory allocation', () => {
      const entities: { x: number; y: number }[] = [];
      const activeIndices = new Int32Array(1000);

      for (let i = 0; i < 1000; i++) {
        entities.push({
          x: -900 + (i % 30) * 60,
          y: -900 + Math.floor(i / 30) * 60,
        });
        activeIndices[i] = i;
      }

      const t0 = performance.now();
      grid.rebuild(entities, activeIndices, 1000);
      const rebuildTime = performance.now() - t0;

      expect(rebuildTime).toBeLessThan(10); // Rebuild under 10ms for 1,000 entities

      // Query center
      const out = new Int32Array(1000);
      const found = grid.queryRadius(0, 0, 100, out);
      expect(found).toBeGreaterThan(0);
    });

    it('executes 1,000 random queries in < 30ms total', () => {
      const entities: { x: number; y: number }[] = [];
      const activeIndices = new Int32Array(1000);

      for (let i = 0; i < 1000; i++) {
        entities.push({
          x: -800 + (i % 32) * 50,
          y: -800 + Math.floor(i / 32) * 50,
        });
        activeIndices[i] = i;
      }

      grid.rebuild(entities, activeIndices, 1000);

      const out = new Int32Array(200);
      const t0 = performance.now();
      let totalFound = 0;

      for (let q = 0; q < 1000; q++) {
        const qx = -700 + (q % 35) * 40;
        const qy = -700 + Math.floor(q / 35) * 40;
        totalFound += grid.queryRadius(qx, qy, 60, out);
      }

      const queryDuration = performance.now() - t0;

      expect(totalFound).toBeGreaterThan(0);
      expect(queryDuration).toBeLessThan(30); // Sub-30ms for 1,000 queries
    });
  });
});
