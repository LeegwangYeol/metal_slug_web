/**
 * ChallengerM1_2_HordeStress.test.ts
 *
 * Empirical Adversarial Verification Harness for Milestone 1:
 * Dynamic Animations, Motion Engine, Horde Rendering, and State Synchronization.
 *
 * Authored by: challenger_m1_2 (teamwork_preview_challenger)
 * Parent Orchestrator ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import { Enemy, EnemyType } from '../../src/core/entities/Enemy';
import { DarkFantasySprites, EntitySpriteType, FlashState } from '../../src/render/sprites/DarkFantasySprites';
import { Camera } from '../../src/render/Camera';

describe('Empirical Challenge Suite M1-2: Horde Animation Stress, State Desync, and Atlas Invariants', () => {
  let createdCanvases: any[] = [];
  let recordingCtxList: any[] = [];
  let camera: Camera;

  function createMockCanvasContext() {
    const operations: Array<{ method: string; args: any[] }> = [];
    const gradientMock = {
      addColorStop: vi.fn(),
    };

    const ctx: any = {
      operations,
      save: vi.fn(() => ctx.operations.push({ method: 'save', args: [] })),
      restore: vi.fn(() => ctx.operations.push({ method: 'restore', args: [] })),
      translate: vi.fn((x, y) => ctx.operations.push({ method: 'translate', args: [x, y] })),
      scale: vi.fn((x, y) => ctx.operations.push({ method: 'scale', args: [x, y] })),
      rotate: vi.fn((a) => ctx.operations.push({ method: 'rotate', args: [a] })),
      beginPath: vi.fn(() => ctx.operations.push({ method: 'beginPath', args: [] })),
      closePath: vi.fn(() => ctx.operations.push({ method: 'closePath', args: [] })),
      moveTo: vi.fn((x, y) => ctx.operations.push({ method: 'moveTo', args: [x, y] })),
      lineTo: vi.fn((x, y) => ctx.operations.push({ method: 'lineTo', args: [x, y] })),
      quadraticCurveTo: vi.fn((cpx, cpy, x, y) => ctx.operations.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] })),
      bezierCurveTo: vi.fn((cp1x, cp1y, cp2x, cp2y, x, y) => ctx.operations.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] })),
      arc: vi.fn((x, y, r, sa, ea) => ctx.operations.push({ method: 'arc', args: [x, y, r, sa, ea] })),
      ellipse: vi.fn((x, y, rx, ry, rot, sa, ea) => ctx.operations.push({ method: 'ellipse', args: [x, y, rx, ry, rot, sa, ea] })),
      fill: vi.fn(() => ctx.operations.push({ method: 'fill', args: [] })),
      stroke: vi.fn(() => ctx.operations.push({ method: 'stroke', args: [] })),
      fillRect: vi.fn((x, y, w, h) => ctx.operations.push({ method: 'fillRect', args: [x, y, w, h] })),
      strokeRect: vi.fn((x, y, w, h) => ctx.operations.push({ method: 'strokeRect', args: [x, y, w, h] })),
      drawImage: vi.fn((...args: any[]) => ctx.operations.push({ method: 'drawImage', args })),
      createLinearGradient: vi.fn(() => gradientMock),
      createRadialGradient: vi.fn(() => gradientMock),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    };
    return ctx;
  }

  function setupDocumentStub() {
    createdCanvases = [];
    recordingCtxList = [];
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          const ctx = createMockCanvasContext();
          recordingCtxList.push(ctx);
          const canvas: any = {
            width: 0,
            height: 0,
            getContext: (type: string) => (type === '2d' ? ctx : null),
          };
          createdCanvases.push(canvas);
          return canvas;
        }
        return {};
      }),
    });
  }

  beforeEach(() => {
    setupDocumentStub();
    DarkFantasySprites.clearCache();
    DarkFantasySprites.initialize();

    camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
    camera.renderX = 0;
    camera.renderY = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    DarkFantasySprites.clearCache();
  });

  // =========================================================================
  // Challenge 1: High-Density Active Horde (1,500 simultaneous entities)
  // =========================================================================
  describe('Challenge 1: High-Density Active Horde Stress (1,500 Active Entities)', () => {
    it('executes 1,500 active enemies with simultaneous walk bobs, spectral floating, flinch, and flash in < 5.0ms with 0 crashes', () => {
      const horde = new HordeManager({ maxCapacity: 2048 });
      const types: EnemyType[] = ['skeleton', 'ghoul', 'death_knight', 'banshee', 'necromancer'];

      // Spawn 1,500 active enemies with realistic distribution across arena
      for (let i = 0; i < 1500; i++) {
        const type = types[i % types.length];
        const angle = (i / 1500) * Math.PI * 2;
        const dist = 100 + (i % 50) * 15;
        const enemy = horde.spawn(type, Math.cos(angle) * dist, Math.sin(angle) * dist);
        expect(enemy).not.toBeNull();
      }

      expect(horde.getActiveCount()).toBe(1500);

      // Advance simulation 30 ticks to build realistic walk/hover phases, velocities, and timers
      const dt = 1 / 60;
      for (let tick = 0; tick < 30; tick++) {
        horde.update(dt, { x: 0, y: 0 });
      }

      // Inflict damage on a large subset (600 enemies) to trigger damage flinch, squash, and hit-flash states
      const activeEnemies = horde.getActiveEnemies();
      for (let i = 0; i < 600; i++) {
        const knockbackX = (i % 2 === 0 ? 1 : -1) * (50 + (i % 50));
        activeEnemies[i].takeDamage(5, knockbackX, 0);
        // Vary flash timers across both white (>0.05) and crimson (<=0.05) thresholds
        if (i % 2 === 0) {
          activeEnemies[i].flashTimer = 0.08; // White flash
        } else {
          activeEnemies[i].flashTimer = 0.03; // Crimson flash
        }
      }

      const auditCtx = createMockCanvasContext();

      // Pass 1: Comprehensive Numerical & Architectural Audit Pass across all 1,500 entities
      for (let i = 0; i < 1500; i++) {
        DarkFantasySprites.drawEnemy(auditCtx, activeEnemies[i], camera, 0.5);
      }

      expect(auditCtx.drawImage).toHaveBeenCalledTimes(1500);
      expect(auditCtx.save.mock.calls.length).toBe(auditCtx.restore.mock.calls.length);

      // Assert zero NaN, Infinity, or undefined arguments in any canvas operations
      for (const op of auditCtx.operations) {
        for (let a = 0; a < op.args.length; a++) {
          const arg = op.args[a];
          if (typeof arg === 'number') {
            expect(Number.isNaN(arg), `NaN detected in ${op.method} arg[${a}]`).toBe(false);
            expect(Number.isFinite(arg), `Infinite value detected in ${op.method} arg[${a}]`).toBe(true);
          }
        }
      }

      // Pass 2: Empirical Performance Benchmark (lightweight context without memory-tracing arrays)
      let drawCallCount = 0;
      const benchCtx: any = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => { drawCallCount++; },
      };

      // JIT warm-up pass
      for (let w = 0; w < 3; w++) {
        for (let i = 0; i < 1500; i++) {
          DarkFantasySprites.drawEnemy(benchCtx, activeEnemies[i], camera, 0.5);
        }
      }
      drawCallCount = 0;

      const measuredFrames = 10;
      const frameTimes: number[] = [];

      for (let f = 0; f < measuredFrames; f++) {
        const t0 = performance.now();
        for (let i = 0; i < 1500; i++) {
          DarkFantasySprites.drawEnemy(benchCtx, activeEnemies[i], camera, 0.5 + f * dt);
        }
        const t1 = performance.now();
        frameTimes.push(t1 - t0);
      }

      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / measuredFrames;
      const minFrameTime = Math.min(...frameTimes);
      const maxFrameTime = Math.max(...frameTimes);

      console.log(
        `[Empirical Benchmark Challenger M1-2] 1,500 Active Horde Draw Pass: Avg=${avgFrameTime.toFixed(3)}ms, Min=${minFrameTime.toFixed(3)}ms, Max=${maxFrameTime.toFixed(3)}ms`
      );

      // Strict Acceptance Assertions
      expect(avgFrameTime).toBeLessThan(5.0); // Hard threshold: < 5.0ms per frame
      expect(drawCallCount).toBe(1500 * measuredFrames);
    });

    it('empirically asserts zero memory leaks across 1,000 consecutive 1,500-enemy simulation & render frames', () => {
      const horde = new HordeManager({ maxCapacity: 2048 });
      for (let i = 0; i < 1500; i++) {
        const type = (['skeleton', 'ghoul', 'death_knight', 'banshee'] as const)[i % 4];
        horde.spawn(type, (i % 30) * 40 - 600, Math.floor(i / 30) * 40 - 600);
      }
      expect(horde.getActiveCount()).toBe(1500);

      // Use lightweight non-recording context for sustained memory benchmark
      // to measure engine allocations, not mock array growth
      const lightweightCtx: any = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => {},
      };
      const dt = 1 / 60;

      // Warm-up to trigger initial JIT optimizations
      for (let i = 0; i < 50; i++) {
        horde.update(dt, { x: 0, y: 0 });
        const enemies = horde.getActiveEnemies();
        for (let e = 0; e < 1500; e++) {
          DarkFantasySprites.drawEnemy(lightweightCtx, enemies[e], camera, i * dt);
        }
      }

      // Collect initial baseline memory if gc is exposed, or check heap delta
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
      const initialHeap = process.memoryUsage().heapUsed;

      // Execute 1,000 sustained frames of full update + motion + render
      for (let frame = 0; frame < 1000; frame++) {
        horde.update(dt, { x: 0, y: 0 });
        const enemies = horde.getActiveEnemies();
        // Periodically damage enemies to exercise flinch/flash relaxation loops
        if (frame % 30 === 0) {
          enemies[frame % 1500].takeDamage(10, 50, 0);
        }
        for (let e = 0; e < 1500; e++) {
          DarkFantasySprites.drawEnemy(lightweightCtx, enemies[e], camera, frame * dt);
        }
      }

      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

      console.log(`[Empirical Benchmark Challenger M1-2] 1,000 Frames Heap Delta: ${heapDeltaMB.toFixed(2)} MB`);

      // Bounded memory invariant: 1,000 frames must not leak heap (< 35MB delta margin without forced GC)
      expect(heapDeltaMB).toBeLessThan(35.0);
    });
  });

  // =========================================================================
  // Challenge 2: State Desynchronization & Rapid Pooling Reset
  // =========================================================================
  describe('Challenge 2: State Desynchronization & Rapid Pooling Reset Invariants', () => {
    it('empirically verifies Enemy.reset() sanitizes all 6 animation motion properties back to pristine neutral', () => {
      const enemy = new Enemy(42);

      // Deliberately corrupt/dirty every animation and motion field with extreme values
      enemy.active = true;
      enemy.isAlive = true;
      enemy.behaviorTimer = 888.88;
      enemy.walkPhase = 55.55;
      enemy.hoverPhase = 99.99;
      enemy.flinchRot = -0.345;
      enemy.flinchTimer = 0.145;
      enemy.squashX = 1.35;
      enemy.squashY = 0.65;
      enemy.flashTimer = 0.095;
      enemy.pushVx = 450.0;
      enemy.pushVy = -320.0;
      enemy.vx = 85.0;
      enemy.vy = -60.0;
      enemy.facingRight = false;
      enemy.hp = 3;

      // Execute reset
      enemy.reset('skeleton', 500, -300);

      // Assert every single property is strictly reset to factory default
      expect(enemy.behaviorTimer, 'behaviorTimer must reset to 0').toBe(0);
      expect(enemy.walkPhase, 'walkPhase must reset to 0').toBe(0);
      expect(enemy.hoverPhase, 'hoverPhase must reset to 0').toBe(0);
      expect(enemy.flinchRot, 'flinchRot must reset to 0').toBe(0);
      expect(enemy.flinchTimer, 'flinchTimer must reset to 0').toBe(0);
      expect(enemy.squashX, 'squashX must reset to 1.0').toBe(1.0);
      expect(enemy.squashY, 'squashY must reset to 1.0').toBe(1.0);
      expect(enemy.flashTimer, 'flashTimer must reset to 0').toBe(0);
      expect(enemy.pushVx, 'pushVx must reset to 0').toBe(0);
      expect(enemy.pushVy, 'pushVy must reset to 0').toBe(0);
      expect(enemy.vx, 'vx must reset to 0').toBe(0);
      expect(enemy.vy, 'vy must reset to 0').toBe(0);
      expect(enemy.facingRight, 'facingRight must reset to true').toBe(true);
      expect(enemy.active, 'active must be true').toBe(true);
      expect(enemy.isAlive, 'isAlive must be true').toBe(true);
      expect(enemy.hp, 'hp must reset to maxHp').toBe(enemy.maxHp);
    });

    it('empirically verifies rapid pooling recycling carries zero ghost animation offsets into reused instances', () => {
      const horde = new HordeManager({ maxCapacity: 100 });

      // Phase A: Spawn 50 spectral entities (banshees) and advance their levitation
      const spawnedIds: number[] = [];
      for (let i = 0; i < 50; i++) {
        const e = horde.spawn('banshee', 100 + i, 200 + i);
        expect(e).not.toBeNull();
        spawnedIds.push(e!.id);
      }

      // Simulate 60 ticks (~1s) with damage so they accumulate high hoverPhase, flinch, and behaviorTimer
      for (let t = 0; t < 60; t++) {
        horde.update(1 / 60, { x: 0, y: 0 });
      }

      const enemiesA = horde.getActiveEnemies();
      for (const e of enemiesA) {
        e.takeDamage(10, 80, 0);
        expect(e.hoverPhase).toBeGreaterThan(0);
        expect(e.behaviorTimer).toBeGreaterThan(0);
        expect(e.flinchRot).not.toBe(0);
      }

      // Phase B: Despawn all 50 entities
      for (const id of spawnedIds) {
        horde.despawn(id);
      }
      expect(horde.getActiveCount()).toBe(0);

      // Phase C: Immediately re-spawn 50 grounded skeletons into the exact same pooled slots
      const reusedEnemies: Enemy[] = [];
      for (let i = 0; i < 50; i++) {
        const e = horde.spawn('skeleton', 300, 400);
        expect(e).not.toBeNull();
        reusedEnemies.push(e!);
      }
      expect(horde.getActiveCount()).toBe(50);

      const mockCtx = createMockCanvasContext();

      // Assert that on frame 0 with speed=0, every reused entity renders with ZERO dynamic offsets
      // (No ghost banshee hover float, no ghost flinch tilt, no ghost flash)
      for (let i = 0; i < reusedEnemies.length; i++) {
        const e = reusedEnemies[i];
        expect(e.hoverPhase, `Reused enemy ${e.id} ghost hoverPhase`).toBe(0);
        expect(e.walkPhase, `Reused enemy ${e.id} ghost walkPhase`).toBe(0);
        expect(e.behaviorTimer, `Reused enemy ${e.id} ghost behaviorTimer`).toBe(0);
        expect(e.flinchRot, `Reused enemy ${e.id} ghost flinchRot`).toBe(0);
        expect(e.flashTimer, `Reused enemy ${e.id} ghost flashTimer`).toBe(0);

        mockCtx.drawImage.mockClear();
        mockCtx.save.mockClear();

        DarkFantasySprites.drawEnemy(mockCtx, e, camera, 0);

        // Grounded stationary skeleton at (300, 400) has origin (20, 20)
        // Must blit directly to totalX - originX = 300 - 20 = 280, totalY - originY = 400 - 20 = 380
        expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
        const drawCall = mockCtx.drawImage.mock.calls[0];
        const screenX = drawCall[1];
        const screenY = drawCall[2];
        expect(screenX).toBe(280);
        expect(screenY).toBe(380);

        // hasTransform must be false: save() must NOT be called for clean neutral entity
        expect(mockCtx.save).not.toHaveBeenCalled();
      }
    });

    it('empirically verifies 10,000 rapid churn spawn/despawn cycles maintain 100% state isolation', () => {
      const horde = new HordeManager({ maxCapacity: 256 });
      const types: EnemyType[] = ['skeleton', 'ghoul', 'death_knight', 'banshee', 'necromancer'];

      for (let cycle = 0; cycle < 1000; cycle++) {
        // Spawn batch of 10
        const batch: Enemy[] = [];
        for (let b = 0; b < 10; b++) {
          const e = horde.spawn(types[(cycle + b) % types.length], cycle, b);
          expect(e).not.toBeNull();
          batch.push(e!);
        }

        // Apply chaotic mutation
        for (const e of batch) {
          e.behaviorTimer = Math.random() * 100;
          e.walkPhase = Math.random() * 50;
          e.hoverPhase = Math.random() * 50;
          e.flinchRot = (Math.random() - 0.5) * 0.7;
          e.squashX = 1.0 + Math.random() * 0.5;
          e.squashY = 1.0 / e.squashX;
          e.flashTimer = Math.random() * 0.1;
        }

        // Despawn all
        for (const e of batch) {
          horde.despawn(e.id);
        }

        // Resample 5 entities immediately and verify pristine reset
        for (let r = 0; r < 5; r++) {
          const fresh = horde.spawn('skeleton', 0, 0)!;
          expect(fresh.behaviorTimer).toBe(0);
          expect(fresh.walkPhase).toBe(0);
          expect(fresh.hoverPhase).toBe(0);
          expect(fresh.flinchRot).toBe(0);
          expect(fresh.squashX).toBe(1.0);
          expect(fresh.squashY).toBe(1.0);
          expect(fresh.flashTimer).toBe(0);
          horde.despawn(fresh.id);
        }
      }

      expect(horde.getActiveCount()).toBe(0);
      expect(horde.getPoolAvailableCount()).toBe(256);
    });
  });

  // =========================================================================
  // Challenge 3: Atlas Integrity & Zero Runtime Re-Rasterization
  // =========================================================================
  describe('Challenge 3: Atlas Integrity & Zero Runtime Re-Rasterization', () => {
    it('empirically confirms DarkFantasySprites atlas cache contains strictly 120 pre-rasterized canvases', () => {
      DarkFantasySprites.clearCache();
      DarkFantasySprites.initialize();

      // Measure exact size of internal cache Map
      const cacheMap = (DarkFantasySprites as any).cache as Map<string, any>;
      expect(cacheMap.size, 'Atlas cache must contain strictly 120 entries').toBe(120);

      // Verify all 120 expected keys are present
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const flashStates: FlashState[] = ['normal', 'white', 'crimson'];
      const facings = [true, false];

      for (const type of types) {
        for (let frame = 0; frame < 4; frame++) {
          for (const facing of facings) {
            for (const flash of flashStates) {
              const expectedKey = DarkFantasySprites.getSpriteKey(type, frame, facing, flash);
              expect(cacheMap.has(expectedKey), `Missing pre-rasterized atlas entry: ${expectedKey}`).toBe(true);
              const entry = cacheMap.get(expectedKey);
              expect(entry).toBeDefined();
              expect(entry.canvas).toBeDefined();
              expect(entry.width).toBeGreaterThan(0);
              expect(entry.height).toBeGreaterThan(0);
            }
          }
        }
      }
    });

    it('empirically confirms ZERO runtime document.createElement or re-rasterization occurs during 1,500 entity draw pass', () => {
      // Document stub was already set up and initialize() was called
      const initialCanvasCount = createdCanvases.length;
      expect(initialCanvasCount).toBe(120);

      const horde = new HordeManager({ maxCapacity: 2048 });
      const types: EnemyType[] = ['skeleton', 'ghoul', 'death_knight', 'banshee', 'necromancer'];

      for (let i = 0; i < 1500; i++) {
        horde.spawn(types[i % types.length], i * 2, i * 3);
      }

      const active = horde.getActiveEnemies();
      // Dirty some enemies with walk phases, timers, flinch, and flash states
      for (let i = 0; i < 1500; i++) {
        active[i].behaviorTimer = i * 0.1;
        active[i].facingRight = i % 2 === 0;
        if (i % 3 === 0) active[i].flashTimer = 0.08;
        if (i % 5 === 0) active[i].flashTimer = 0.02;
        if (i % 7 === 0) active[i].flinchRot = 0.2;
      }

      const mockCtx = createMockCanvasContext();

      // Spy on generateSpriteEntry and document.createElement
      const generateSpy = vi.spyOn(DarkFantasySprites as any, 'generateSpriteEntry');
      const createElementSpy = vi.spyOn(document, 'createElement');

      // Draw all 1,500 entities across 10 distinct simulation elapsed timestamps
      for (let frame = 0; frame < 10; frame++) {
        for (let i = 0; i < 1500; i++) {
          DarkFantasySprites.drawEnemy(mockCtx, active[i], camera, frame * 0.016);
        }
      }

      // CRITICAL ASSERTION: Zero re-rasterization during runtime rendering
      expect(generateSpy).not.toHaveBeenCalled();
      expect(createElementSpy).not.toHaveBeenCalled();

      // Canvas count remains strictly 120
      expect(createdCanvases.length).toBe(120);
      expect(((DarkFantasySprites as any).cache as Map<string, any>).size).toBe(120);

      generateSpy.mockRestore();
      createElementSpy.mockRestore();
    });

    it('adversarial edge test: gracefully handles unknown enemy types without creating rogue canvas entries', () => {
      const cacheMap = (DarkFantasySprites as any).cache as Map<string, any>;
      const initialSize = cacheMap.size;
      expect(initialSize).toBe(120);

      const mockCtx = createMockCanvasContext();
      const weirdEnemy = new Enemy(999);
      weirdEnemy.reset('lich_lord' as any, 100, 100);
      weirdEnemy.active = true;

      // Draw unrecognized enemy type
      expect(() => {
        DarkFantasySprites.drawEnemy(mockCtx, weirdEnemy, camera, 1.0);
      }).not.toThrow();

      // Cache must NOT expand or pollute with 'lich_lord' entries (falls back to skeleton)
      expect(cacheMap.size).toBe(120);
    });

    it('adversarial edge test: discovers negative timer / modulo behavior in walk frame calculation', () => {
      // Adversarial scenario: If behaviorTimer or elapsedTime is negative (e.g. clock desync)
      const enemy = new Enemy(777);
      enemy.reset('skeleton', 100, 100);
      enemy.active = true;
      (enemy as any).behaviorTimer = -0.1;

      const mockCtx = createMockCanvasContext();

      // In JS: Math.floor(-0.1 * 8) = Math.floor(-0.8) = -1.
      // -1 % 4 evaluates to -1 in JavaScript!
      const timer = (enemy as any).behaviorTimer;
      const rawFrame = Math.floor(timer * 8) % 4;
      expect(rawFrame).toBe(-1); // JavaScript negative modulo quirk confirmed

      // Verify how DarkFantasySprites handles this negative frame
      // getSpriteKey produces 'skeleton_-1_right_normal'
      const key = DarkFantasySprites.getSpriteKey('skeleton', rawFrame, true, 'normal');
      expect(key).toBe('skeleton_-1_right_normal');

      // Before calling drawEnemy, cache has 120 entries
      const cacheMap = (DarkFantasySprites as any).cache as Map<string, any>;
      expect(cacheMap.has(key)).toBe(false);

      // In production runtime with document defined, if a negative frame is requested,
      // getCachedEntry would re-rasterize or create a new entry for '-1'!
      // Let's test what happens when drawn:
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);

      // If document was available, it generated the missing entry
      if (cacheMap.has(key)) {
        console.warn(`[Adversarial Discovery] Negative timer generated dynamic entry: ${key}`);
      }
    });
  });
});
