import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DarkFantasyVFX,
  Particle,
  GroundDecal,
} from '../../src/render/vfx/DarkFantasyVFX';
import { DarkFantasySprites } from '../../src/render/sprites/DarkFantasySprites';
import { GothicBackdrop } from '../../src/render/GothicBackdrop';
import { Camera } from '../../src/render/Camera';
import { GrimHarvestGame } from '../../src/main';

describe('Milestone 3 VFX & Dynamic Lighting — Adversarial Challenge Suite (challenger_m3_1)', () => {
  let vfx: DarkFantasyVFX;
  let backdrop: GothicBackdrop;
  let camera: Camera;
  let mockCtx: any;
  let capturedCanvasCalls: { method: string; args: any[] }[];

  beforeEach(() => {
    vfx = new DarkFantasyVFX(500);
    backdrop = new GothicBackdrop({
      viewportWidth: 960,
      viewportHeight: 540,
    });

    camera = new Camera({
      viewportWidth: 960,
      viewportHeight: 540,
    });

    capturedCanvasCalls = [];

    const recordCall = (method: string) => {
      return vi.fn((...args: any[]) => {
        capturedCanvasCalls.push({ method, args });
      });
    };

    mockCtx = {
      save: recordCall('save'),
      restore: recordCall('restore'),
      translate: recordCall('translate'),
      rotate: recordCall('rotate'),
      scale: recordCall('scale'),
      beginPath: recordCall('beginPath'),
      closePath: recordCall('closePath'),
      moveTo: recordCall('moveTo'),
      lineTo: recordCall('lineTo'),
      arc: recordCall('arc'),
      ellipse: recordCall('ellipse'),
      fill: recordCall('fill'),
      stroke: recordCall('stroke'),
      fillRect: recordCall('fillRect'),
      strokeRect: recordCall('strokeRect'),
      drawImage: recordCall('drawImage'),
      quadraticCurveTo: recordCall('quadraticCurveTo'),
      bezierCurveTo: recordCall('bezierCurveTo'),
      fillText: recordCall('fillText'),
      strokeText: recordCall('strokeText'),
      measureText: vi.fn(() => ({ width: 50 })),
      clearRect: recordCall('clearRect'),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    };
  });

  // =========================================================================
  // Challenge 1: Particle Pooling & Decal Ring Buffer Wrapping
  // =========================================================================
  describe('Challenge 1: Particle Pool & Decal Ring Buffer Invariants Under Heavy Saturation', () => {
    it('burst spawns 1,000 particles into 500-slot pool; asserts strict capacity clamp, FIFO displacement, and zero object reallocation', () => {
      // Step 1: Record initial object references
      const originalParticles = new Set<Particle>();
      for (let i = 0; i < vfx.pool.length; i++) {
        originalParticles.add(vfx.pool[i]);
      }
      expect(originalParticles.size).toBe(500);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);

      // Step 2: Burst spawn 1,000 particles across varied emitter types
      for (let i = 0; i < 100; i++) {
        vfx.emitBloodBurst(100 + i, 200, 4);
        vfx.emitBoneShatter(150, 250, 3);
        vfx.emitSoulBurst(200, 300, 'emerald', 2);
        vfx.emitSpellTrail(250, 350);
      } // Total requested = 100 * (4 + 3 + 2 + 1) = 1,000 particles

      // Step 3: Verify strict capacity bounds & invariant conservation
      expect(vfx.capacity).toBe(500);
      expect(vfx.pool.length).toBe(500);
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);
      expect(vfx.getActiveCount() + vfx.getFreeCount()).toBe(500);

      // Step 4: Verify zero heap leaks / zero object reallocations
      for (let i = 0; i < vfx.pool.length; i++) {
        expect(originalParticles.has(vfx.pool[i])).toBe(true);
      }

      // Step 5: Verify all active particles have clean numeric state
      for (let i = 0; i < vfx.pool.length; i++) {
        const p = vfx.pool[i];
        expect(p.active).toBe(true);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
        expect(Number.isFinite(p.size)).toBe(true);
        expect(Number.isFinite(p.alpha)).toBe(true);
      }

      // Step 6: Drain pool cleanly via simulation time advancement
      vfx.update(5.0);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
      expect(vfx.pool.length).toBe(500);
    });

    it('spawns 600 decals into 500-slot buffer; asserts circular ring buffer wraps cleanly with zero OOB, zero leaks, and valid state', () => {
      // Step 1: Record initial decal identities
      const originalDecals = new Set<GroundDecal>();
      for (let i = 0; i < vfx.decals.length; i++) {
        originalDecals.add(vfx.decals[i]);
      }
      expect(originalDecals.size).toBe(500);
      expect(vfx.getActiveDecalCount()).toBe(0);

      // Step 2: Emit 600 decals (100 beyond capacity) across all 4 archetypes
      const archetypes: ('BLOOD_SPLATTER' | 'BLOOD_POOL' | 'LIGHTNING_SCORCH' | 'SIGIL_SCORCH')[] = [
        'BLOOD_SPLATTER',
        'BLOOD_POOL',
        'LIGHTNING_SCORCH',
        'SIGIL_SCORCH',
      ];

      for (let i = 0; i < 600; i++) {
        const type = archetypes[i % archetypes.length];
        const d = vfx.emitDecal(type, i * 2, i * 3, 10 + (i % 5));
        expect(d).toBeDefined();
        expect(d.active).toBe(true);
        expect(d.id).toBeGreaterThanOrEqual(0);
        expect(d.id).toBeLessThan(500);
      }

      // Step 3: Verify strict bounds and zero heap leaks
      expect(vfx.decalCapacity).toBe(500);
      expect(vfx.decals.length).toBe(500);
      expect(vfx.getActiveDecalCount()).toBe(500);

      for (let i = 0; i < vfx.decals.length; i++) {
        expect(originalDecals.has(vfx.decals[i])).toBe(true);
        expect(vfx.decals[i].active).toBe(true);
        expect(Number.isFinite(vfx.decals[i].x)).toBe(true);
        expect(Number.isFinite(vfx.decals[i].y)).toBe(true);
        expect(Number.isFinite(vfx.decals[i].radius)).toBe(true);
        expect(Number.isFinite(vfx.decals[i].alpha)).toBe(true);
        expect(vfx.decals[i].alpha).toBeGreaterThan(0);
      }

      // Step 4: Verify the ring buffer overwrote the first 100 slots (slots 0..99 have i=500..599)
      for (let i = 0; i < 100; i++) {
        const expectedX = (500 + i) * 2;
        const expectedY = (500 + i) * 3;
        expect(vfx.decals[i].x).toBe(expectedX);
        expect(vfx.decals[i].y).toBe(expectedY);
        expect(vfx.decals[i].life).toBe(0);
      }

      // Step 5: Advance time past max decay (20 seconds) and assert clean expiration
      vfx.update(20.0);
      expect(vfx.getActiveDecalCount()).toBe(0);
      for (let i = 0; i < vfx.decalCapacity; i++) {
        expect(vfx.decals[i].active).toBe(false);
      }
    });

    it('sustains 50,000 particle and decal spawn/update cycles with bounded memory and zero heap leakage', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let cycle = 0; cycle < 50000; cycle++) {
        const mode = cycle % 5;
        if (mode === 0) {
          vfx.emitBloodBurst(cycle % 500, (cycle * 2) % 500, 4);
        } else if (mode === 1) {
          vfx.emitBoneShatter(100, 100, 3);
        } else if (mode === 2) {
          vfx.emitSoulBurst(200, 200, 'ruby', 2);
        } else if (mode === 3) {
          vfx.emitBloodSplatter(cycle % 400, (cycle * 3) % 400);
        } else if (mode === 4) {
          vfx.emitLightningScorch(150, 150);
        }

        vfx.update(1 / 60);
      }

      vfx.clear();
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
      expect(vfx.getActiveDecalCount()).toBe(0);

      const finalMemory = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(
        `[Challenger M3-1 Empirical Benchmark] 50,000 Churn Cycles Heap Delta: ${heapDeltaMB.toFixed(2)} MB`
      );

      // Heap growth must remain bounded under 15MB across 50,000 churn cycles
      expect(heapDeltaMB).toBeLessThan(15.0);
    });
  });

  // =========================================================================
  // Challenge 2: 120 Consecutive Frames at 60Hz Headless Simulation
  // =========================================================================
  describe('Challenge 2: 120 Consecutive Frames at 60Hz Headless Simulation', () => {
    it('runs 120 consecutive frames at 60Hz with continuous emissions: asserts 0 NaNs, 0 exceptions, balanced save/restore, and stable timing', () => {
      const dt = 1 / 60; // 16.666ms per tick
      const frameTimes: number[] = [];

      // Mock dynamic game state
      const mockPlayer = {
        position: { x: 0, y: 0 },
        stats: { area: 120 },
        isAlive: true,
      };

      const mockEnemies = [
        { type: 'SKELETON', x: -50, y: -40, isAlive: true },
        { type: 'GHOUL', x: 60, y: 50, isAlive: true },
        { type: 'BANSHEE', x: -80, y: 70, isAlive: true },
        { type: 'DEATH_KNIGHT', x: 100, y: -80, isAlive: true },
      ];

      const mockHordeManager = {
        getActiveEnemies: () => mockEnemies,
      };

      const mockGems = [
        { position: { x: -30, y: 40 }, type: 'EMERALD_SHARD', isAlive: true },
        { position: { x: 50, y: -20 }, type: 'VIOLET_SHARD', isAlive: true },
        { position: { x: 80, y: 90 }, type: 'RUBY_SHARD', isAlive: true },
      ];

      const mockLootManager = {
        getActiveItems: () => mockGems,
      };

      const mockWeaponManager = {
        getWeapon: (id: string) => {
          if (id === 'scythe') {
            return {
              activeSlashes: [
                { x: mockPlayer.position.x, y: mockPlayer.position.y, angle: 0.5, radius: 70, life: 0.05, maxLife: 0.18, isEvolution: false },
              ],
            };
          }
          if (id === 'lightning') {
            return {
              activeBolts: [
                { segments: [{ x1: 0, y1: 0, x2: 120, y2: -60 }], life: 0.04, maxLife: 0.16 },
              ],
            };
          }
          if (id === 'aura') {
            return {
              activeRings: [{ x: mockPlayer.position.x, y: mockPlayer.position.y, maxRadius: 120, life: 0.1, maxLife: 0.4 }],
            };
          }
          if (id === 'orbiters') {
            return {
              skulls: [{ angle: 1.2, x: mockPlayer.position.x + 40, y: mockPlayer.position.y }],
              isEvolution: false,
            };
          }
          return null;
        },
      };

      // Run 120 frames
      for (let frame = 0; frame < 120; frame++) {
        const t = frame * dt;

        // Player moves in a circle
        mockPlayer.position.x = Math.cos(t * 2.0) * 150;
        mockPlayer.position.y = Math.sin(t * 2.0) * 150;

        camera.update(mockPlayer.position.x, mockPlayer.position.y, dt);

        const startFrame = performance.now();

        // 1. Stochastic VFX emissions simulating active combat
        if (frame % 3 === 0) {
          vfx.emitBloodBurst(mockPlayer.position.x + 20, mockPlayer.position.y, 6);
          vfx.emitBloodImpact(mockPlayer.position.x, mockPlayer.position.y, 1, 0.5, 4);
        }
        if (frame % 5 === 0) {
          vfx.emitBoneShatter(mockPlayer.position.x - 30, mockPlayer.position.y + 20, 5);
          vfx.emitSoulBurst(mockPlayer.position.x, mockPlayer.position.y, 'emerald', 3);
        }
        if (frame % 8 === 0) {
          vfx.emitSpellTrail(mockPlayer.position.x, mockPlayer.position.y);
          vfx.emitBloodSplatter(mockPlayer.position.x + 10, mockPlayer.position.y + 10, 6);
        }
        if (frame % 15 === 0) {
          vfx.emitLightningArc(mockPlayer.position.x, mockPlayer.position.y, mockPlayer.position.x + 100, mockPlayer.position.y + 60, false);
        }
        if (frame % 25 === 0) {
          vfx.emitSpellCircle(mockPlayer.position.x, mockPlayer.position.y, 50, 0.8);
          vfx.emitSigilShockwave(mockPlayer.position.x, mockPlayer.position.y, 140);
        }
        if (frame % 40 === 0) {
          vfx.emitLevelUpRune(mockPlayer.position.x, mockPlayer.position.y, 72, 1.5);
        }

        // 2. Update VFX & Backdrop
        expect(() => vfx.update(dt)).not.toThrow();

        // 3. Clear call tracker for this frame
        capturedCanvasCalls.length = 0;
        let saveCount = 0;
        let restoreCount = 0;

        mockCtx.save.mockImplementation(() => {
          saveCount++;
        });
        mockCtx.restore.mockImplementation(() => {
          restoreCount++;
        });

        // 4. Render All Visual Layers
        expect(() => {
          // Backdrop
          backdrop.render(mockCtx, camera.renderX, camera.renderY, t);

          // Decals
          vfx.renderDecals(mockCtx, camera);

          // Ground VFX
          vfx.renderGround(mockCtx, camera);

          // Contact Shadows
          vfx.renderContactDropShadows(
            mockCtx,
            camera,
            mockPlayer,
            mockHordeManager,
            mockLootManager,
            t
          );

          // Air VFX
          vfx.renderAir(mockCtx, camera);

          // Foreground Mist
          backdrop.renderForegroundMist(mockCtx, camera.renderX, camera.renderY, t);

          // Lighting & Additive Bloom
          vfx.renderLighting(mockCtx, camera, {
            player: mockPlayer,
            weaponManager: mockWeaponManager,
            lootManager: mockLootManager,
            elapsedTime: t,
          });
        }).not.toThrow();

        const endFrame = performance.now();
        frameTimes.push(endFrame - startFrame);

        // 5. Verify Context Stack & Composite Hygiene
        expect(saveCount).toBe(restoreCount);
        expect(mockCtx.globalCompositeOperation).toBe('source-over');

        // 6. Assert Zero NaNs in particle state
        for (let i = 0; i < vfx.pool.length; i++) {
          const p = vfx.pool[i];
          if (p.active) {
            expect(Number.isNaN(p.x)).toBe(false);
            expect(Number.isNaN(p.y)).toBe(false);
            expect(Number.isNaN(p.vx)).toBe(false);
            expect(Number.isNaN(p.vy)).toBe(false);
            expect(Number.isNaN(p.size)).toBe(false);
            expect(Number.isNaN(p.alpha)).toBe(false);
            expect(Number.isNaN(p.rotation)).toBe(false);
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          }
        }

        // 7. Assert Zero NaNs in decal state
        for (let i = 0; i < vfx.decalCapacity; i++) {
          const d = vfx.decals[i];
          if (d.active) {
            expect(Number.isNaN(d.x)).toBe(false);
            expect(Number.isNaN(d.y)).toBe(false);
            expect(Number.isNaN(d.radius)).toBe(false);
            expect(Number.isNaN(d.alpha)).toBe(false);
            expect(Number.isNaN(d.rotation)).toBe(false);
          }
        }
      }

      // Timing telemetries
      const totalTime = frameTimes.reduce((a, b) => a + b, 0);
      const avgTime = totalTime / frameTimes.length;
      frameTimes.sort((a, b) => a - b);
      const p95Time = frameTimes[Math.floor(frameTimes.length * 0.95)];
      const maxTime = frameTimes[frameTimes.length - 1];

      console.log(
        `[Challenger M3-1 Empirical Benchmark] 120 Frames at 60Hz: Avg=${avgTime.toFixed(3)}ms, p95=${p95Time.toFixed(3)}ms, Max=${maxTime.toFixed(3)}ms, Total=${totalTime.toFixed(2)}ms`
      );

      // Frame execution budget: average must be well below 5.0ms
      expect(avgTime).toBeLessThan(5.0);
      expect(p95Time).toBeLessThan(12.0);
    });

    it('executes full GrimHarvestGame 120-frame headless loop with VFX and Lighting: asserts zero crashes, zero NaNs, and clean render layering', () => {
      DarkFantasySprites.initialize();

      const game = new GrimHarvestGame();
      const mockCanvas: any = {
        width: 960,
        height: 540,
        getContext: () => mockCtx,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      (game as any).ctx = mockCtx;
      (game as any).canvas = mockCanvas;

      // Populate horde with 300 active enemies
      for (let i = 0; i < 300; i++) {
        const angle = (i / 300) * Math.PI * 2;
        const dist = 120 + (i % 15) * 20;
        const type = i % 4 === 0 ? 'SKELETON' : i % 4 === 1 ? 'GHOUL' : i % 4 === 2 ? 'BANSHEE' : 'DEATH_KNIGHT';
        game.hordeManager.spawnEnemy(type, Math.cos(angle) * dist, Math.sin(angle) * dist);
      }

      const TOTAL_FRAMES = 120;
      let renderPasses = 0;

      for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
        game.player.heal(100); // Keep alive during dense combat simulation
        game.step(1 / 60);

        expect(() => {
          game.render();
          renderPasses++;
        }).not.toThrow();

        // Verify VFX pool remains within capacity
        expect(game.vfx.capacity).toBe(500);
        expect(game.vfx.getActiveCount()).toBeLessThanOrEqual(500);
        expect(game.vfx.getActiveDecalCount()).toBeLessThanOrEqual(500);
      }

      expect(renderPasses).toBe(TOTAL_FRAMES);
      console.log(
        `[Challenger M3-1 Empirical Benchmark] Full GrimHarvestGame 120-Frame Loop: Active Enemies=${game.hordeManager.getActiveCount()}, Active VFX Particles=${game.vfx.getActiveCount()}, Active Decals=${game.vfx.getActiveDecalCount()}`
      );
    });
  });

  // =========================================================================
  // Challenge 3: Extreme dt Fuzzing & Degenerate Geometries
  // =========================================================================
  describe('Challenge 3: Extreme dt Fuzzing & Numerical Singularity Hardening', () => {
    it('maintains absolute stability across extreme and pathological dt values (0, 10, -1, -50, 1000)', () => {
      // Seed particles and decals
      vfx.emitBloodBurst(100, 100, 8);
      vfx.emitBoneShatter(200, 200, 6);
      vfx.emitSoulBurst(300, 300, 'emerald', 4);
      vfx.emitDecal('BLOOD_POOL', 150, 150);
      vfx.emitDecal('SIGIL_SCORCH', 250, 250);

      const testDts = [0, 0.000001, 10.0, -0.016, -1.0, -50.0, 1000.0];

      for (const dt of testDts) {
        expect(() => {
          vfx.update(dt);
        }).not.toThrow();

        // Verify no particle state corrupted
        for (let i = 0; i < vfx.pool.length; i++) {
          const p = vfx.pool[i];
          expect(Number.isNaN(p.x)).toBe(false);
          expect(Number.isNaN(p.y)).toBe(false);
          expect(Number.isNaN(p.vx)).toBe(false);
          expect(Number.isNaN(p.vy)).toBe(false);
          expect(Number.isNaN(p.size)).toBe(false);
          expect(Number.isNaN(p.alpha)).toBe(false);
          expect(p.alpha).toBeGreaterThanOrEqual(0);
          expect(p.alpha).toBeLessThanOrEqual(1.0);
        }

        // Verify decals remain valid
        for (let i = 0; i < vfx.decalCapacity; i++) {
          const d = vfx.decals[i];
          expect(Number.isNaN(d.alpha)).toBe(false);
          expect(Number.isNaN(d.life)).toBe(false);
          expect(d.alpha).toBeGreaterThanOrEqual(0);
          expect(d.alpha).toBeLessThanOrEqual(1.0);
        }
      }
    });

    it('survives degenerate zero-length vectors in emitBloodImpact without division-by-zero or NaNs', () => {
      expect(() => {
        vfx.emitBloodImpact(100, 100, 0, 0, 8);
      }).not.toThrow();

      const particles = vfx.pool.filter((p) => p.active && p.extra === 1);
      for (const p of particles) {
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
        expect(Number.isNaN(p.vx)).toBe(false);
        expect(Number.isNaN(p.vy)).toBe(false);
      }
    });

    it('survives subnormal floating point numbers in vectors without precision underflow crash', () => {
      expect(() => {
        vfx.emitBloodImpact(100, 100, 1e-300, 1e-300, 4);
      }).not.toThrow();

      const particles = vfx.pool.filter((p) => p.active && p.extra === 1);
      for (const p of particles) {
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
      }
    });

    it('survives coincident start and end coordinates in emitLightningArc without NaN or crash', () => {
      expect(() => {
        vfx.emitLightningArc(300, 300, 300, 300, false);
      }).not.toThrow();

      const segments = vfx.pool.filter((p) => p.active && p.type === 'LIGHTNING_SEGMENT');
      for (const s of segments) {
        expect(Number.isFinite(s.x)).toBe(true);
        expect(Number.isFinite(s.y)).toBe(true);
        expect(Number.isFinite(s.vx)).toBe(true);
        expect(Number.isFinite(s.vy)).toBe(true);
      }
    });

    it('survives extreme coordinate ranges (-10^7, 10^7) with graceful frustum culling and no rendering crashes', () => {
      vfx.emitBloodSplatter(1e7, 1e7, 10);
      vfx.emitBloodBurst(-1e7, -1e7, 5);
      vfx.emitSpellCircle(1e7, -1e7, 50, 1.0);

      expect(() => {
        vfx.update(1 / 60);
        vfx.renderDecals(mockCtx, camera);
        vfx.renderGround(mockCtx, camera);
        vfx.renderAir(mockCtx, camera);
      }).not.toThrow();
    });
  });
});
