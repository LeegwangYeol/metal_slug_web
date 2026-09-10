/**
 * ChallengerM2_1AdversarialHarness.test.ts
 *
 * Empirical Challenger Verification Suite for Milestone M2:
 * 1. 60Hz rendering performance benchmark across 120 frames with 1,000 simultaneous active entities.
 * 2. Strict assertion of 0 NaN / infinite coordinates and 0 canvas rendering exceptions.
 * 3. Empirical verification of 100% offscreen atlas caching hit rate (zero dynamic re-rasterizations).
 * 4. Adversarial edge-case fuzzing (extreme coordinates, boundary flash timers, unusual entity types, dead culling).
 * 5. Full GrimHarvestGame 120-frame headless gameplay integration with 1,000+ active horde entities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DarkFantasySprites, EntitySpriteType, FlashState } from '../../src/render/sprites/DarkFantasySprites';
import { Player } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';
import { GrimHarvestGame } from '../../src/main';

describe('Challenger M2-1: Sprite Engine Adversarial Stress & 60Hz Empirical Verification Suite', () => {
  let createdCanvases: any[] = [];
  let dynamicCanvasAllocations = 0;
  let drawImageCalls: Array<{
    image: any;
    dx: number;
    dy: number;
    dWidth?: number;
    dHeight?: number;
  }> = [];
  let camera: Camera;

  // High-performance mock 2D rendering context
  function createMockCanvasContext() {
    const ctx: any = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      drawImage: vi.fn((...args: any[]) => {
        drawImageCalls.push({
          image: args[0],
          dx: args[1],
          dy: args[2],
          dWidth: args[3] ?? args[0]?.width,
          dHeight: args[4] ?? args[0]?.height,
        });
      }),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    };
    return ctx;
  }

  function setupDocumentHarness() {
    createdCanvases = [];
    dynamicCanvasAllocations = 0;
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          dynamicCanvasAllocations++;
          const ctx = createMockCanvasContext();
          const canvas: any = {
            width: 0,
            height: 0,
            getContext: (type: string) => (type === '2d' ? ctx : null),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
          createdCanvases.push(canvas);
          return canvas;
        }
        return {};
      },
    });
  }

  beforeEach(() => {
    drawImageCalls = [];
    DarkFantasySprites.clearCache();
    setupDocumentHarness();
    camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    DarkFantasySprites.clearCache();
  });

  // =========================================================================
  // Test Suite 1: 1,000 Entities Across 120 Frames Empirical Simulation Harness
  // =========================================================================
  describe('Adversarial Challenge 1: 1,000 Entities Blitted Across 120 Consecutive Frames (60Hz Performance)', () => {
    it('blits 1,000 dynamic entities across 120 frames with 0 NaNs, 0 exceptions, and stable frame execution', () => {
      // 1. Initialize Sprite Atlas
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      const initialCanvasesCount = createdCanvases.length;
      expect(initialCanvasesCount).toBe(120); // 5 types * 4 frames * 2 facings * 3 flashes

      // Reset dynamic allocation tracker to assert ZERO allocations during gameplay
      dynamicCanvasAllocations = 0;

      // 2. Prepare 1,000 Active Entities with diverse types and positions
      const ENTITY_COUNT = 1000;
      const enemyTypes = ['skeleton', 'ghoul', 'banshee', 'death_knight'] as const;
      const enemies: Enemy[] = [];

      for (let i = 0; i < ENTITY_COUNT; i++) {
        const enemy = new Enemy(i);
        const type = enemyTypes[i % enemyTypes.length];
        const gridX = (i % 40) * 30 - 600;
        const gridY = Math.floor(i / 40) * 30 - 375;
        enemy.reset(type, gridX, gridY);
        enemy.active = true;
        enemy.isAlive = true;
        enemy.vx = (Math.random() - 0.5) * 40;
        enemy.vy = (Math.random() - 0.5) * 40;
        enemy.facingRight = i % 2 === 0;
        enemy.flashTimer = (i % 7 === 0) ? 0.08 : 0;
        enemy.behaviorTimer = (i * 0.05) % 4.0;
        enemies.push(enemy);
      }

      // Player entity
      const player = new Player(0, 0);
      player.velocity.x = 25;
      player.velocity.y = -15;

      const mockCtx = createMockCanvasContext();

      // Warm up JIT execution pathways
      for (let i = 0; i < 50; i++) {
        DarkFantasySprites.drawEnemy(mockCtx, enemies[i], camera, 0);
      }
      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 0);
      drawImageCalls = [];

      const TOTAL_FRAMES = 120;
      const dt = 1 / 60; // 60Hz step
      let simulationTime = 0.0;

      const frameDurations: number[] = [];
      let totalBlitCount = 0;
      let nanCoordinateCount = 0;
      let caughtExceptions = 0;

      // 3. Execute 120 Consecutive Frames
      for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
        simulationTime += dt;

        // Advance entities dynamically
        for (let i = 0; i < ENTITY_COUNT; i++) {
          const e = enemies[i];
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.behaviorTimer += dt;
          if (e.flashTimer > 0) {
            e.flashTimer = Math.max(0, e.flashTimer - dt);
          }
          // Periodically trigger damage flash on subset of horde
          if ((frame + i) % 45 === 0) {
            e.flashTimer = 0.08;
          }
          // Dynamic directional flips
          if ((frame + i) % 60 === 0) {
            e.facingRight = !e.facingRight;
          }
        }

        // Advance Player
        player.position.x += player.velocity.x * dt;
        player.position.y += player.velocity.y * dt;
        if (frame % 30 === 0) {
          player.invulnerabilityTimer = 0.2;
        } else if (player.invulnerabilityTimer > 0) {
          player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt);
        }

        // Camera follow with dynamic offset
        camera.update(player.position.x, player.position.y, dt);

        // Clear per-frame trace buffer
        drawImageCalls = [];

        // Timed frame blit execution
        const frameStart = performance.now();
        try {
          // Draw all 1,000 enemies
          for (let i = 0; i < ENTITY_COUNT; i++) {
            DarkFantasySprites.drawEnemy(mockCtx, enemies[i], camera, simulationTime);
          }
          // Draw player
          DarkFantasySprites.drawPlayer(mockCtx, player, camera, simulationTime);
        } catch (err) {
          caughtExceptions++;
        }
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        frameDurations.push(frameTime);

        // Verify per-frame blit assertions
        const frameBlits = drawImageCalls.length;
        totalBlitCount += frameBlits;
        expect(frameBlits).toBe(ENTITY_COUNT + 1); // 1,000 enemies + 1 player

        // Coordinate integrity check: Assert 0 NaN and 0 Infinite coordinates
        for (const call of drawImageCalls) {
          if (
            Number.isNaN(call.dx) ||
            Number.isNaN(call.dy) ||
            !Number.isFinite(call.dx) ||
            !Number.isFinite(call.dy)
          ) {
            nanCoordinateCount++;
          }
        }
      }

      // 4. Performance & Metric Aggregations
      const totalTime = frameDurations.reduce((a, b) => a + b, 0);
      const avgFrameTime = totalTime / TOTAL_FRAMES;
      const sorted = [...frameDurations].sort((a, b) => a - b);
      const p95FrameTime = sorted[Math.floor(TOTAL_FRAMES * 0.95)];
      const maxFrameTime = sorted[TOTAL_FRAMES - 1];
      const minFrameTime = sorted[0];

      // Compute standard deviation for frame time stability
      const variance =
        frameDurations.reduce((acc, t) => acc + Math.pow(t - avgFrameTime, 2), 0) / TOTAL_FRAMES;
      const stdDev = Math.sqrt(variance);

      console.log(
        `[Challenger M2-1] 120-Frame Blit Benchmark (1,000 Entities + Player):\n` +
          `  Total Frames: ${TOTAL_FRAMES}\n` +
          `  Total Blits: ${totalBlitCount.toLocaleString()}\n` +
          `  Avg Frame Time: ${avgFrameTime.toFixed(3)}ms\n` +
          `  Min Frame Time: ${minFrameTime.toFixed(3)}ms\n` +
          `  p95 Frame Time: ${p95FrameTime.toFixed(3)}ms\n` +
          `  Max Frame Time: ${maxFrameTime.toFixed(3)}ms\n` +
          `  Std Dev: ${stdDev.toFixed(3)}ms\n` +
          `  NaN Coordinates: ${nanCoordinateCount}\n` +
          `  Exceptions: ${caughtExceptions}\n` +
          `  Dynamic Canvas Allocations: ${dynamicCanvasAllocations}`
      );

      // 5. Hard Empirical Invariant Assertions:
      expect(totalBlitCount).toBe(120 * 1001); // Exactly 120,120 blit calls
      expect(nanCoordinateCount).toBe(0); // STRICT: 0 NaN coordinates
      expect(caughtExceptions).toBe(0); // STRICT: 0 rendering exceptions
      expect(dynamicCanvasAllocations).toBe(0); // STRICT: 0 dynamic canvas re-allocations during gameplay

      // Performance Assertions (Budget: 16.67ms for 60Hz, target < 5.0ms for sprite pass)
      expect(avgFrameTime).toBeLessThan(5.0);
      expect(p95FrameTime).toBeLessThan(16.67); // 95th percentile strictly under 60Hz 16.67ms budget
      expect(avgFrameTime).toBeLessThan(16.67); // 60Hz locked compliance
    });
  });

  // =========================================================================
  // Test Suite 2: 100% Offscreen Atlas Caching Hit Rate (Zero Re-Rasterizations)
  // =========================================================================
  describe('Adversarial Challenge 2: 100% Offscreen Atlas Caching Hit Rate & Zero Dynamic Re-Rasterization', () => {
    it('empirically guarantees 100% cache hit rate across all permutations and zero document.createElement calls', () => {
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      dynamicCanvasAllocations = 0;

      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const flashStates: FlashState[] = ['normal', 'white', 'crimson'];
      const facings = [true, false];

      let queries = 0;
      let hits = 0;

      // Query every combination multiple times with fractional and wrapping frame numbers
      for (let cycle = 0; cycle < 50; cycle++) {
        for (const type of types) {
          for (const facing of facings) {
            for (const flash of flashStates) {
              for (let f = 0; f < 8; f++) {
                queries++;
                const entry = DarkFantasySprites.getCachedEntry(type, f, facing, flash);
                if (entry && entry.canvas) {
                  hits++;
                }
              }
            }
          }
        }
      }

      const hitRate = (hits / queries) * 100;
      console.log(
        `[Challenger M2-1] Cache Hit Rate: ${hitRate.toFixed(2)}% (${hits}/${queries} queries), Dynamic Canvas Created: ${dynamicCanvasAllocations}`
      );

      expect(queries).toBe(50 * 5 * 2 * 3 * 8); // 12,000 queries
      expect(hits).toBe(queries);
      expect(hitRate).toBe(100.0);
      expect(dynamicCanvasAllocations).toBe(0); // Zero dynamic re-rasterizations
    });

    it('handles negative frame inputs safely without breaking cache or throwing exceptions', () => {
      DarkFantasySprites.initialize();

      // Even if negative frame is passed, it should either return entry or handle gracefully
      expect(() => {
        DarkFantasySprites.getCachedEntry('skeleton', -1, true, 'normal');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Test Suite 3: Adversarial Input Fuzzing & Boundary Stress
  // =========================================================================
  describe('Adversarial Challenge 3: Extreme Coordinates, Flash Thresholds & Dead Entity Culling', () => {
    let mockCtx: any;

    beforeEach(() => {
      DarkFantasySprites.initialize();
      mockCtx = createMockCanvasContext();
    });

    it('handles extreme coordinates (1e7, -1e7, floating precision) without NaN propagation or crash', () => {
      const enemy = new Enemy(999);
      enemy.reset('skeleton', 1e7, -1e7);
      enemy.active = true;
      enemy.isAlive = true;

      camera.renderX = 1e7 - 200;
      camera.renderY = -1e7 + 200;

      drawImageCalls = [];
      expect(() => {
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      }).not.toThrow();

      expect(drawImageCalls.length).toBe(1);
      const call = drawImageCalls[0];
      expect(Number.isFinite(call.dx)).toBe(true);
      expect(Number.isFinite(call.dy)).toBe(true);
      expect(Number.isNaN(call.dx)).toBe(false);
      expect(Number.isNaN(call.dy)).toBe(false);
    });

    it('strictly culls rendering when entities are dead or inactive (zero blits)', () => {
      const enemy = new Enemy(1);
      enemy.reset('ghoul', 100, 100);
      enemy.active = false;
      enemy.isAlive = false;

      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls.length).toBe(0);

      const player = new Player(100, 100);
      player.isAlive = false;
      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 0);
      expect(drawImageCalls.length).toBe(0);

      const loot = new LootItem('gem-1');
      loot.isAlive = false;
      DarkFantasySprites.drawLoot(mockCtx, loot, camera, 0);
      expect(drawImageCalls.length).toBe(0);
    });

    it('gracefully normalizes unknown, missing, or corrupted enemy type strings to skeleton fallback in drawEnemy', () => {
      const enemy = new Enemy(2);
      enemy.active = true;
      enemy.isAlive = true;
      enemy.x = 100;
      enemy.y = 100;

      // Hostile / unpredicted type strings assigned directly to enemy
      const hostileTypes = ['abomination', 'LICH_KING', 'unknown_boss', '', null as any, undefined as any];

      for (const hType of hostileTypes) {
        (enemy as any).type = hType;

        drawImageCalls = [];
        expect(() => {
          DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        }).not.toThrow();

        expect(drawImageCalls.length).toBe(1);
        expect(Number.isNaN(drawImageCalls[0].dx)).toBe(false);
      }
    });

    it('verifies exact flash state threshold boundary conditions (>0.05 white, >0 crimson, <=0 normal)', () => {
      const enemy = new Enemy(3);
      enemy.reset('death_knight', 200, 200);
      enemy.active = true;
      enemy.isAlive = true;

      const whiteEntry = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'white');
      const crimsonEntry = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'crimson');
      const normalEntry = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'normal');

      // 1. Threshold: 0.05001 -> white
      enemy.flashTimer = 0.05001;
      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls[0].image).toBe(whiteEntry?.canvas);

      // 2. Threshold: 0.05000 -> crimson (since > 0.05 is false)
      enemy.flashTimer = 0.05;
      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls[0].image).toBe(crimsonEntry?.canvas);

      // 3. Threshold: 0.00001 -> crimson
      enemy.flashTimer = 0.00001;
      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls[0].image).toBe(crimsonEntry?.canvas);

      // 4. Threshold: 0.0 -> normal
      enemy.flashTimer = 0.0;
      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls[0].image).toBe(normalEntry?.canvas);

      // 5. Negative timer: -0.05 -> normal
      enemy.flashTimer = -0.05;
      drawImageCalls = [];
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(drawImageCalls[0].image).toBe(normalEntry?.canvas);
    });

    it('preserves balanced context save and restore calls across loot diamond rendering', () => {
      const loot = new LootItem('gem-2');
      loot.reset('gem-2', 'EMERALD_SHARD' as any, 150, 150);

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      DarkFantasySprites.drawLoot(mockCtx, loot, camera, 1.0);

      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Test Suite 4: Full GrimHarvestGame 120-Frame Headless Simulation
  // =========================================================================
  describe('Adversarial Challenge 4: Full GrimHarvestGame Headless 120-Frame Loop with 1,000+ Active Horde', () => {
    it('executes 120 full game ticks & render cycles without NaN coordinates, exceptions, or dynamic allocations', () => {
      DarkFantasySprites.initialize();

      const game = new GrimHarvestGame();
      const mockCtx = createMockCanvasContext();
      const mockCanvas: any = {
        width: 960,
        height: 540,
        getContext: () => mockCtx,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      (game as any).ctx = mockCtx;
      (game as any).canvas = mockCanvas;

      // Populate horde with 1,000 additional enemies around the player
      for (let i = 0; i < 1000; i++) {
        const angle = (i / 1000) * Math.PI * 2;
        const dist = 150 + (i % 20) * 25;
        const type = i % 4 === 0 ? 'SKELETON' : i % 4 === 1 ? 'GHOUL' : i % 4 === 2 ? 'BANSHEE' : 'DEATH_KNIGHT';
        game.hordeManager.spawnEnemy(type, Math.cos(angle) * dist, Math.sin(angle) * dist);
      }
      expect(game.hordeManager.getActiveCount()).toBeGreaterThanOrEqual(1000);

      // Reset dynamic canvas allocation tracker right before gameplay loop
      dynamicCanvasAllocations = 0;

      const TOTAL_FRAMES = 120;
      let renderCalls = 0;
      let nanFound = false;

      drawImageCalls = [];

      for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
        // Step simulation physics (heal player so they don't die instantly in dense swarm)
        game.player.heal(100);
        game.step(1 / 60);

        // Execute full game render pass
        expect(() => {
          game.render();
          renderCalls++;
        }).not.toThrow();

        // Check for NaNs in drawn coordinates
        for (const call of drawImageCalls) {
          if (Number.isNaN(call.dx) || Number.isNaN(call.dy)) {
            nanFound = true;
          }
        }
      }

      console.log(
        `[Challenger M2-1] Full Game Loop Simulation: ${renderCalls} frames rendered, ${game.hordeManager.getActiveCount()} enemies active, NaNs: ${nanFound ? 'FOUND' : 'ZERO'}, Dynamic Allocations: ${dynamicCanvasAllocations}`
      );

      expect(renderCalls).toBe(TOTAL_FRAMES);
      expect(nanFound).toBe(false);
      expect(dynamicCanvasAllocations).toBe(0); // STRICT: Zero dynamic canvas allocations during 120 frames of gameplay
    });
  });
});
