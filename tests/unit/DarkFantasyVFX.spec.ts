import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DarkFantasyVFX,
  Particle,
  GroundDecal,
  DynamicLightingEngine,
  LightingSceneData,
} from '../../src/render/vfx/DarkFantasyVFX';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';

describe('DarkFantasyVFX Comprehensive Specification Suite (Milestone M3)', () => {
  let vfx: DarkFantasyVFX;
  let camera: Camera;
  let mockCtx: any;

  beforeEach(() => {
    vfx = new DarkFantasyVFX(500);

    camera = new Camera({
      viewportWidth: 960,
      viewportHeight: 540,
    });

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
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
  // Suite 1: Particle Pool Pre-allocation & Zero-Garbage Lifecycles
  // =========================================================================
  describe('Suite 1: Particle Pool Pre-allocation & Invariant Conservation', () => {
    it('initializes exact 500-slot capacity with 0 active particles', () => {
      expect(vfx.capacity).toBe(500);
      expect(vfx.pool.length).toBe(500);
      expect(vfx.getFreeCount()).toBe(500);
      expect(vfx.getActiveCount()).toBe(0);
    });

    it('allocates particles and maintains exact active + free === capacity across 25,000 high-churn cycles', () => {
      const originalParticles = new Set<Particle>();
      for (let i = 0; i < vfx.pool.length; i++) {
        originalParticles.add(vfx.pool[i]);
      }
      expect(originalParticles.size).toBe(500);

      const dt = 1 / 60;
      for (let cycle = 0; cycle < 25000; cycle++) {
        const roll = cycle % 6;
        switch (roll) {
          case 0:
            vfx.emitBloodBurst(100 + (cycle % 100), 100, 6);
            break;
          case 1:
            vfx.emitBoneShatter(200, 200, 5);
            break;
          case 2:
            vfx.emitSoulBurst(300, 300, 'emerald', 4);
            break;
          case 3:
            vfx.emitSpellTrail(150, 150);
            break;
          case 4:
            vfx.emitBloodImpact(120, 120, 1, 0, 4);
            break;
          case 5:
            if (cycle % 30 === 0) {
              vfx.emitSpellCircle(400, 400, 40, 0.4);
            }
            break;
        }

        vfx.update(dt);

        const active = vfx.getActiveCount();
        const free = vfx.getFreeCount();
        if (active + free !== 500) {
          throw new Error(
            `Count conservation violated at cycle ${cycle}: active=${active}, free=${free}, sum=${active + free} (expected 500)`
          );
        }
      }

      // Zero object reallocations
      expect(vfx.pool.length).toBe(500);
      for (let i = 0; i < vfx.pool.length; i++) {
        expect(originalParticles.has(vfx.pool[i])).toBe(true);
      }

      // Drain pool
      vfx.update(5.0);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
    });

    it('handles pool saturation under 200% burst load (1,000 allocations) with FIFO oldest displacement', () => {
      // Fill pool completely
      for (let i = 0; i < 50; i++) {
        vfx.emitBoneShatter(100, 100, 10);
      }
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);

      // Allocate 500 more particles while saturated
      for (let i = 0; i < 500; i++) {
        vfx.emitSpellTrail(200, 200);
      }

      // Capacity must remain clamped at 500
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);
      expect(vfx.capacity).toBe(500);

      // Drain pool completely
      vfx.update(4.0);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
    });
  });

  // =========================================================================
  // Suite 2: Ground Decal Circular Ring Buffer (500 slots)
  // =========================================================================
  describe('Suite 2: Ground Decal System (500-slot Ring Buffer)', () => {
    it('initializes 500-slot decal buffer with 0 active count', () => {
      expect(vfx.decalCapacity).toBe(500);
      expect(vfx.decals.length).toBe(500);
      expect(vfx.getActiveDecalCount()).toBe(0);
    });

    it('supports all 4 ground decal archetypes with appropriate parameters', () => {
      const splatter = vfx.emitDecal('BLOOD_SPLATTER', 100, 100);
      expect(splatter.active).toBe(true);
      expect(splatter.type).toBe('BLOOD_SPLATTER');
      expect(splatter.maxLife).toBe(12.0);
      expect(splatter.alpha).toBe(0.85);

      const pool = vfx.emitDecal('BLOOD_POOL', 150, 150);
      expect(pool.active).toBe(true);
      expect(pool.type).toBe('BLOOD_POOL');
      expect(pool.maxLife).toBe(15.0);
      expect(pool.alpha).toBe(0.90);

      const lightningScorch = vfx.emitDecal('LIGHTNING_SCORCH', 200, 200);
      expect(lightningScorch.active).toBe(true);
      expect(lightningScorch.type).toBe('LIGHTNING_SCORCH');
      expect(lightningScorch.maxLife).toBe(10.0);

      const sigilScorch = vfx.emitDecal('SIGIL_SCORCH', 250, 250);
      expect(sigilScorch.active).toBe(true);
      expect(sigilScorch.type).toBe('SIGIL_SCORCH');
      expect(sigilScorch.maxLife).toBe(12.0);

      expect(vfx.getActiveDecalCount()).toBe(4);
    });

    it('cycles ring buffer across 750 emissions without re-allocating memory', () => {
      const originalDecals = new Set<GroundDecal>();
      for (let i = 0; i < vfx.decals.length; i++) {
        originalDecals.add(vfx.decals[i]);
      }
      expect(originalDecals.size).toBe(500);

      for (let i = 0; i < 750; i++) {
        vfx.emitBloodSplatter(i, i);
      }

      // Active count clamped at 500
      expect(vfx.getActiveDecalCount()).toBe(500);
      expect(vfx.decals.length).toBe(500);

      // Zero object identity churn
      for (let i = 0; i < vfx.decals.length; i++) {
        expect(originalDecals.has(vfx.decals[i])).toBe(true);
      }
    });

    it('empirically validates organic multi-stage alpha decay curves (hold then smooth fade)', () => {
      const decal = vfx.emitDecal('BLOOD_POOL', 100, 100);
      expect(decal.alpha).toBe(0.90);

      // Advance 5.0 seconds (still within 10.0s hold period)
      vfx.update(5.0);
      expect(decal.alpha).toBe(0.90);

      // Advance past 10.0s into the 5.0s fade period (total 12.5s -> 50% fade)
      vfx.update(7.5);
      expect(decal.alpha).toBeCloseTo(0.45, 1);

      // Advance past 15.0s total -> expired
      vfx.update(3.0);
      expect(decal.active).toBe(false);
    });

    it('clears all decals and resets ring buffer on clear()', () => {
      for (let i = 0; i < 20; i++) {
        vfx.emitBloodSplatter(i * 10, i * 10);
      }
      expect(vfx.getActiveDecalCount()).toBe(20);

      vfx.clear();

      expect(vfx.getActiveDecalCount()).toBe(0);
      for (let i = 0; i < vfx.decalCapacity; i++) {
        expect(vfx.decals[i].active).toBe(false);
        expect(vfx.decals[i].life).toBe(0);
      }
    });

    it('renderDecals culls off-screen decals from rendering', () => {
      // 1 on-screen decal
      vfx.emitBloodSplatter(200, 200, 8);
      // 1 off-screen decal
      vfx.emitBloodSplatter(3000, 3000, 8);

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderDecals(mockCtx, camera);

      // Exactly 1 decal drawn
      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Suite 3: Branching Abyssal Lightning & Dissipation Timeline
  // =========================================================================
  describe('Suite 3: Branching Abyssal Lightning & Dissipation', () => {
    it('creates recursive midpoint displacement segments with cyan/violet corona and core', () => {
      vfx.emitLightningArc(100, 100, 500, 100, false);

      const activeSegments = vfx.pool.filter(
        (p) => p.active && p.type === 'LIGHTNING_SEGMENT'
      );
      expect(activeSegments.length).toBeGreaterThan(4);

      // Verify leaf segment line widths
      const trunkSegment = activeSegments.find((p) => p.extra === 0);
      expect(trunkSegment).toBeDefined();
      expect(trunkSegment!.startSize).toBeGreaterThanOrEqual(3.0);

      // Verify screen-wide lightning flash was triggered
      expect(vfx.lighting.lightningFlash).toBeGreaterThan(0.3);
    });

    it('stamps lightning scorch decal at the impact coordinate', () => {
      vfx.emitLightningArc(100, 100, 350, 250, false);

      const activeScorch = vfx.decals.find(
        (d) => d.active && d.type === 'LIGHTNING_SCORCH'
      );
      expect(activeScorch).toBeDefined();
      expect(activeScorch!.x).toBe(350);
      expect(activeScorch!.y).toBe(250);
    });

    it('renders lightning segments with additive lighter blending in renderAir', () => {
      vfx.emitLightningArc(200, 200, 400, 200, false);

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderAir(mockCtx, camera);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      // Verifies globalCompositeOperation was reset to source-over
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });
  });

  // =========================================================================
  // Suite 4: Swirling Necrotic Soul Motes & Additive Blending
  // =========================================================================
  describe('Suite 4: Swirling Necrotic Soul Motes & Additive Blending', () => {
    it('exhibits multi-harmonic 2D sinusoidal drift and upward ethereal lift', () => {
      vfx.emitSoulBurst(200, 200, 'emerald', 1);

      const p = vfx.pool.find((item) => item.active && item.type === 'SOUL_SPARK')!;
      expect(p).toBeDefined();
      expect(p.gravity).toBeLessThan(0); // Inverted gravity for upward float

      const initialVx = p.vx;
      const initialVy = p.vy;

      vfx.update(0.1);

      // Both vx and vy must be modulated by multi-harmonic sinusoidal drift
      expect(p.vx).not.toBe(initialVx);
      expect(p.vy).not.toBe(initialVy);
    });

    it('renders luminous soul sparks with outer halo and white core in renderAir', () => {
      vfx.emitSoulBurst(250, 250, 'violet', 2);

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderAir(mockCtx, camera);

      expect(mockCtx.save).toHaveBeenCalledTimes(2);
      expect(mockCtx.restore).toHaveBeenCalledTimes(2);
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });
  });

  // =========================================================================
  // Suite 5: Bone Fragments & Visceral Blood Particles
  // =========================================================================
  describe('Suite 5: Bone Fragments & Visceral Blood Droplets', () => {
    it('aligns directional blood impact droplets with attack vector', () => {
      vfx.emitBloodImpact(150, 150, 1.0, 0.0, 4);

      const bloodDroplets = vfx.pool.filter(
        (p) => p.active && p.type === 'BLOOD_DROPLET' && p.extra === 1
      );
      expect(bloodDroplets.length).toBe(4);

      // Majority of horizontal velocity should be positive (along dirX = 1)
      for (const d of bloodDroplets) {
        expect(d.vx).toBeGreaterThan(0);
      }
    });

    it('simulates 3D cosine tumble and ground bounce for bone fragments', () => {
      vfx.emitBoneShatter(300, 300, 5);

      const bones = vfx.pool.filter((p) => p.active && p.type === 'BONE_CHIP');
      expect(bones.length).toBe(5);

      for (const b of bones) {
        expect(b.vRot).not.toBe(0);
        expect(b.extra).toBeGreaterThanOrEqual(0);
        expect(b.extra).toBeLessThanOrEqual(2);
      }

      // Advance into bounce window (progress > 0.65)
      vfx.update(0.45);

      // Verify fragments remain valid without NaNs
      for (const b of bones) {
        if (b.active) {
          expect(Number.isFinite(b.x)).toBe(true);
          expect(Number.isFinite(b.y)).toBe(true);
          expect(Number.isFinite(b.rotation)).toBe(true);
        }
      }
    });

    it('emitDeathGore combines blood burst, bone shatter, soul sparks, and blood pool', () => {
      const initialDecalCount = vfx.getActiveDecalCount();
      vfx.emitDeathGore(200, 200, 'emerald');

      // Decal added
      expect(vfx.getActiveDecalCount()).toBe(initialDecalCount + 1);

      // Particles allocated
      const activeBlood = vfx.pool.filter((p) => p.active && p.type === 'BLOOD_DROPLET');
      const activeBone = vfx.pool.filter((p) => p.active && p.type === 'BONE_CHIP');
      const activeSoul = vfx.pool.filter((p) => p.active && p.type === 'SOUL_SPARK');

      expect(activeBlood.length).toBeGreaterThanOrEqual(10);
      expect(activeBone.length).toBeGreaterThanOrEqual(6);
      expect(activeSoul.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // Suite 6: Occult Rune Circles (Level-Up & Sigil Shockwaves)
  // =========================================================================
  describe('Suite 6: Occult Rune Circles (Level-Up & Sigils)', () => {
    it('emitLevelUpRune spawns multi-tier ceremonial occult seal and ascending soul motes', () => {
      vfx.emitLevelUpRune(400, 400, 72, 2.4);

      const seal = vfx.pool.find((p) => p.active && p.type === 'OCCULT_SEAL');
      expect(seal).toBeDefined();
      expect(seal!.size).toBe(72);
      expect(seal!.maxLife).toBe(2.4);
      expect(seal!.extra).toBe(0); // Ceremonial level-up seal

      // Perimeter rising soul motes
      const perimeterSparks = vfx.pool.filter(
        (p) => p.active && p.type === 'SOUL_SPARK'
      );
      expect(perimeterSparks.length).toBe(12);
    });

    it('emitSigilShockwave spawns explosive shockwave ring and stamps sigil scorch mark', () => {
      const initialDecals = vfx.getActiveDecalCount();
      vfx.emitSigilShockwave(500, 500, 180);

      const shockwave = vfx.pool.find(
        (p) => p.active && p.type === 'OCCULT_SEAL' && p.extra === 1
      );
      expect(shockwave).toBeDefined();
      expect(shockwave!.endSize).toBe(180);

      // Scorch mark stamped
      expect(vfx.getActiveDecalCount()).toBe(initialDecals + 1);
      const scorch = vfx.decals.find(
        (d) => d.active && d.type === 'SIGIL_SCORCH' && d.x === 500 && d.y === 500
      );
      expect(scorch).toBeDefined();
    });

    it('renderGround draws occult runes and culls off-screen seals', () => {
      vfx.emitLevelUpRune(300, 300, 72, 2.0); // Inside camera
      vfx.emitLevelUpRune(4000, 4000, 72, 2.0); // Outside camera

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderGround(mockCtx, camera);

      // Exactly 1 seal drawn on ground (each ceremonial seal uses 2 saves: outer translation/rotation + inner counter-rotating ring)
      expect(mockCtx.save).toHaveBeenCalledTimes(2);
      expect(mockCtx.restore).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Suite 7: Pre-Entity Contact Drop Shadows
  // =========================================================================
  describe('Suite 7: Pre-Entity Contact Drop Shadows', () => {
    it('renders grounded elliptical shadows beneath Player (18x7)', () => {
      const mockPlayer = { position: { x: 200, y: 200 }, isAlive: true };
      const mockHorde = { getActiveEnemies: () => [] };
      const mockLoot = { getActiveItems: () => [] };

      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 216, 18, 7, 0, 0, Math.PI * 2);
    });

    it('renders correct shadow dimensions across all enemy types', () => {
      const enemies = [
        { type: 'SKELETON', x: 100, y: 100, isAlive: true },
        { type: 'GHOUL', x: 200, y: 100, isAlive: true },
        { type: 'DEATH_KNIGHT', x: 300, y: 100, isAlive: true },
        { type: 'BANSHEE', x: 400, y: 100, isAlive: true },
      ];
      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => enemies };
      const mockLoot = { getActiveItems: () => [] };

      mockCtx.ellipse.mockClear();

      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      // Skeleton (14x5 at y+14)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(100, 114, 14, 5, 0, 0, Math.PI * 2);

      // Ghoul (16x6 at y+14)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 114, 16, 6, 0, 0, Math.PI * 2);

      // Death Knight (24x9 at y+22)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 122, 24, 9, 0, 0, Math.PI * 2);

      // Banshee (floating diffuse shadow at y+18)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(
        400,
        118,
        expect.any(Number),
        expect.any(Number),
        0,
        0,
        Math.PI * 2
      );
    });

    it('modulates Banshee floating diffuse shadow with vertical oscillation', () => {
      const banshee = [{ type: 'BANSHEE', x: 300, y: 200, isAlive: true }];
      const mockPlayer = { position: { x: -500, y: -500 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => banshee };
      const mockLoot = { getActiveItems: () => [] };

      // Time 1: yBob = 0
      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);
      const call1 = mockCtx.ellipse.mock.calls[0];

      // Time 2: peak float
      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(
        mockCtx,
        camera,
        mockPlayer,
        mockHorde,
        mockLoot,
        Math.PI / 6
      );
      const call2 = mockCtx.ellipse.mock.calls[0];

      // Shadow dimensions must modulate dynamically
      expect(call1[2]).not.toBe(call2[2]);
    });

    it('renders grounded shadows for Soul Gems at floor level', () => {
      const lootItem = new LootItem('gem-1');
      lootItem.reset('gem-1', 'EMERALD_SHARD' as any, 180, 240);

      const mockPlayer = { position: { x: -500, y: -500 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => [] };
      const mockLoot = { getActiveItems: () => [lootItem] };

      mockCtx.ellipse.mockClear();

      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 1.0);

      // Shadow grounded at y + 8 = 248
      expect(mockCtx.ellipse).toHaveBeenCalledWith(180, 248, 5, 2.5, 0, 0, Math.PI * 2);
    });
  });

  // =========================================================================
  // Suite 8: Dynamic Radial Lighting & Additive Bloom Engine
  // =========================================================================
  describe('Suite 8: Dynamic Radial Lighting & Additive Bloom Engine', () => {
    let lighting: DynamicLightingEngine;

    beforeEach(() => {
      lighting = vfx.lighting;
    });

    it('initializes 960x540 offscreen buffer and stencils', () => {
      expect(lighting.width).toBe(960);
      expect(lighting.height).toBe(540);
      expect(lighting.ambientDarkness).toBe(0.84);
      expect(lighting.lightningFlash).toBe(0);
    });

    it('triggers and decays global lightning flash over time', () => {
      lighting.triggerLightningFlash(0.45);
      expect(lighting.lightningFlash).toBe(0.45);

      lighting.update(0.1);
      expect(lighting.lightningFlash).toBeLessThan(0.45);

      lighting.update(2.0);
      expect(lighting.lightningFlash).toBe(0);
    });

    it('executes additive bloom pass with warm amber glow (#f59e0b) for player torch', () => {
      const scene: LightingSceneData = {
        player: { position: { x: 250, y: 250 }, isAlive: true },
        elapsedTime: 1.5,
      };

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      lighting.render(mockCtx, camera, scene);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      // Verifies globalCompositeOperation was reset to source-over
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });

    it('renders spell flash blooms for active scythe, lightning, aura, and orbiters', () => {
      const mockWeaponManager = {
        getWeapon: (id: string) => {
          if (id === 'scythe') {
            return {
              activeSlashes: [
                {
                  x: 300,
                  y: 300,
                  angle: 0,
                  radius: 80,
                  life: 0.05,
                  maxLife: 0.18,
                  isEvolution: false,
                },
              ],
            };
          }
          if (id === 'lightning') {
            return {
              activeBolts: [
                {
                  segments: [{ x1: 200, y1: 200, x2: 400, y2: 200 }],
                  life: 0.05,
                  maxLife: 0.16,
                },
              ],
            };
          }
          if (id === 'aura') {
            return {
              activeRings: [
                { x: 250, y: 250, maxRadius: 100, life: 0.1, maxLife: 0.35 },
              ],
            };
          }
          if (id === 'orbiters') {
            return {
              skulls: [{ angle: 0, x: 280, y: 250 }],
              isEvolution: false,
            };
          }
          return null;
        },
      };

      const scene: LightingSceneData = {
        player: { position: { x: 250, y: 250 }, isAlive: true },
        weaponManager: mockWeaponManager,
        elapsedTime: 2.0,
      };

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      lighting.render(mockCtx, camera, scene);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });

    it('resets lighting engine state on reset()', () => {
      lighting.triggerLightningFlash(0.45);
      expect(lighting.lightningFlash).toBe(0.45);

      lighting.reset();
      expect(lighting.lightningFlash).toBe(0);
    });
  });

  // =========================================================================
  // Suite 9: Numerical Hygiene & Extreme Fuzzing Harness
  // =========================================================================
  describe('Suite 9: Numerical Hygiene & Extreme Fuzzing Harness', () => {
    it('produces ZERO NaNs and ZERO Infinities across extreme dt values (dt=0, dt=10, dt=-1)', () => {
      vfx.emitBloodBurst(100, 100, 5);
      vfx.emitBoneShatter(200, 200, 5);
      vfx.emitSoulBurst(300, 300, 'ruby', 4);
      vfx.emitDecal('BLOOD_POOL', 150, 150);

      // Extreme dt = 0
      expect(() => vfx.update(0)).not.toThrow();

      // Extreme dt = 10 (huge jump)
      expect(() => vfx.update(10.0)).not.toThrow();

      // Negative dt = -1 (clock reversal guard)
      expect(() => vfx.update(-1.0)).not.toThrow();

      for (let i = 0; i < vfx.pool.length; i++) {
        const p = vfx.pool[i];
        expect(Number.isNaN(p.x)).toBe(false);
        expect(Number.isNaN(p.y)).toBe(false);
        expect(Number.isNaN(p.vx)).toBe(false);
        expect(Number.isNaN(p.vy)).toBe(false);
        expect(Number.isNaN(p.alpha)).toBe(false);
        expect(Number.isNaN(p.size)).toBe(false);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }

      for (let i = 0; i < vfx.decalCapacity; i++) {
        const d = vfx.decals[i];
        expect(Number.isNaN(d.alpha)).toBe(false);
        expect(Number.isNaN(d.life)).toBe(false);
      }
    });

    it('handles zero-length directional vectors (dirX=0, dirY=0) without producing NaN', () => {
      expect(() => {
        vfx.emitBloodImpact(100, 100, 0, 0, 5);
      }).not.toThrow();

      const impactParticles = vfx.pool.filter((p) => p.active && p.extra === 1);
      for (const p of impactParticles) {
        expect(Number.isNaN(p.vx)).toBe(false);
        expect(Number.isNaN(p.vy)).toBe(false);
        expect(Number.isFinite(p.vx)).toBe(true);
        expect(Number.isFinite(p.vy)).toBe(true);
      }
    });

    it('handles identical start and end coordinates in emitLightningArc without divide-by-zero crash', () => {
      expect(() => {
        vfx.emitLightningArc(200, 200, 200, 200, false);
      }).not.toThrow();

      const segments = vfx.pool.filter(
        (p) => p.active && p.type === 'LIGHTNING_SEGMENT'
      );
      for (const s of segments) {
        expect(Number.isNaN(s.x)).toBe(false);
        expect(Number.isNaN(s.y)).toBe(false);
        expect(Number.isNaN(s.vx)).toBe(false);
        expect(Number.isNaN(s.vy)).toBe(false);
      }
    });

    it('guarantees 1:1 context save and restore balance across all rendering passes', () => {
      vfx.emitSpellCircle(100, 100, 40, 2.0);
      vfx.emitBloodBurst(150, 150, 4);
      vfx.emitDecal('BLOOD_SPLATTER', 200, 200);

      // 1. Decals pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderDecals(mockCtx, camera);
      expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);

      // 2. Ground pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderGround(mockCtx, camera);
      expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);

      // 3. Contact shadows pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      const mockPlayer = { position: { x: 200, y: 200 }, isAlive: true };
      const mockHorde = { getActiveEnemies: () => [] };
      const mockLoot = { getActiveItems: () => [] };
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);
      expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);

      // 4. Air pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderAir(mockCtx, camera);
      expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);

      // 5. Lighting pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderLighting(mockCtx, camera, {
        player: mockPlayer,
        elapsedTime: 1.0,
      });
      expect(mockCtx.save).toHaveBeenCalledTimes(mockCtx.restore.mock.calls.length);
    });

    it('ensures globalCompositeOperation is strictly source-over after every render routine', () => {
      vfx.emitSoulBurst(100, 100, 'emerald', 3);
      vfx.emitLightningArc(100, 100, 300, 100, false);

      vfx.renderAir(mockCtx, camera);
      expect(mockCtx.globalCompositeOperation).toBe('source-over');

      vfx.renderLighting(mockCtx, camera, {
        player: { position: { x: 200, y: 200 }, isAlive: true },
        elapsedTime: 1.0,
      });
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });
  });
});
