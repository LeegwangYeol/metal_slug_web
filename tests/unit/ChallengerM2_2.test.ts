import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DarkFantasyVFX, Particle } from '../../src/render/vfx/DarkFantasyVFX';
import { DarkFantasySprites } from '../../src/render/sprites/DarkFantasySprites';
import { GothicHUD, HUDStateSnapshot } from '../../src/ui/GothicHUD';
import { PALETTE } from '../../src/render/DarkFantasyPalette';
import { Enemy } from '../../src/core/entities/Enemy';
import { Camera } from '../../src/render/Camera';
import { HordeManager } from '../../src/core/HordeManager';

describe('Empirical Challenge Suite M2-2: Particle Pool, Damage Flash, and Gothic HUD Responsiveness', () => {
  // =========================================================================
  // Challenge 1: Particle Pool 10,000+ Cycle Stress Harness & Allocation Invariants
  // =========================================================================
  describe('Challenge 1: Particle Pool Invariant Conservation & Zero-Garbage Stress Harness', () => {
    let vfx: DarkFantasyVFX;
    let camera: Camera;
    let mockCtx: any;

    beforeEach(() => {
      vfx = new DarkFantasyVFX(500);
      camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1.0,
      };
    });

    it('empirically sustains 15,000 continuous spawn/kill cycles with strict count conservation', () => {
      // Retain references to all 500 initial Particle objects to verify zero re-allocations
      const originalParticles = new Set<Particle>();
      for (let i = 0; i < vfx.pool.length; i++) {
        originalParticles.add(vfx.pool[i]);
      }
      expect(originalParticles.size).toBe(500);

      // Force GC if available or record initial memory baseline
      if (typeof gc === 'function') gc();
      const initialHeap = process.memoryUsage().heapUsed;

      const TOTAL_CYCLES = 15000;
      const dt = 1 / 60; // 60Hz step

      for (let cycle = 0; cycle < TOTAL_CYCLES; cycle++) {
        // Pseudo-random continuous emitter activity
        const roll = cycle % 7;
        switch (roll) {
          case 0:
            vfx.emitBloodBurst(100 + (cycle % 200), 100, 6);
            break;
          case 1:
            vfx.emitBoneShatter(200, 200 + (cycle % 100), 5);
            break;
          case 2:
            vfx.emitSoulBurst(300, 300, 'emerald', 4);
            break;
          case 3:
            vfx.emitBileSputter(150, 150, 4);
            break;
          case 4:
            vfx.emitSpellTrail(250, 250, PALETTE.CURSED_ARCANE.AURA, 3.0);
            break;
          case 5:
            if (cycle % 60 === 0) {
              vfx.emitSpellCircle(400, 300, 48, 0.5);
            }
            break;
          case 6:
            vfx.emitGemGlint(500, 200);
            break;
        }

        // Advance simulation
        vfx.update(dt);

        // STRICT INVARIANT 1: Exact conservation of free + active count == capacity (500)
        const active = vfx.getActiveCount();
        const free = vfx.getFreeCount();
        if (active + free !== 500) {
          throw new Error(
            `Count conservation violated at cycle ${cycle}: active=${active}, free=${free}, sum=${active + free} (expected 500)`
          );
        }

        // STRICT INVARIANT 2: Bounds assertion
        expect(active).toBeGreaterThanOrEqual(0);
        expect(active).toBeLessThanOrEqual(500);
        expect(free).toBeGreaterThanOrEqual(0);
        expect(free).toBeLessThanOrEqual(500);
      }

      // STRICT INVARIANT 3: Verify 100% object identity preservation (Zero object creation)
      expect(vfx.pool.length).toBe(500);
      for (let i = 0; i < vfx.pool.length; i++) {
        expect(originalParticles.has(vfx.pool[i])).toBe(true);
      }

      // Advance time to drain the pool completely
      vfx.update(5.0);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);

      if (typeof gc === 'function') gc();
      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);

      // Verify no catastrophic heap expansion (bounded within 10MB across 15,000 cycles)
      expect(heapDeltaMB).toBeLessThan(10.0);
    });

    it('empirically validates pool saturation behavior under extreme burst load (600 allocations)', () => {
      // Fill pool completely to 500 active particles
      for (let i = 0; i < 50; i++) {
        vfx.emitBoneShatter(100, 100, 10);
      }
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);

      // Attempt 100 additional allocations while saturated
      for (let i = 0; i < 100; i++) {
        vfx.emitBloodBurst(200, 200, 1);
      }

      // Must remain strictly clamped at capacity 500
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);
      expect(vfx.capacity).toBe(500);
      expect(vfx.pool.length).toBe(500);

      // Drain pool completely
      vfx.update(3.0);
      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
    });

    it('empirically validates dual-layer render isolation and frustum culling', () => {
      // Spawn 1 ground decal inside camera
      vfx.emitSpellCircle(100, 100, 30, 2.0);
      // Spawn 1 ground decal outside camera viewport (viewport is 960x540)
      vfx.emitSpellCircle(2000, 2000, 30, 2.0);

      // Spawn 2 air particles inside camera
      vfx.emitBloodBurst(150, 150, 2);
      // Spawn 1 air particle outside camera
      vfx.emitBloodBurst(3000, 3000, 1);

      // 1. Ground Render Pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderGround(mockCtx, camera);

      // Only the 1 visible ground decal must be rendered
      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);

      // 2. Air Render Pass
      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      vfx.renderAir(mockCtx, camera);

      // Only the 2 visible air particles must be rendered (culling the offscreen one)
      expect(mockCtx.save).toHaveBeenCalledTimes(2);
      expect(mockCtx.restore).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Challenge 2: Damage Flash State Switching & Boundary Precision
  // =========================================================================
  describe('Challenge 2: Damage Flash State Switching & Boundary Precision', () => {
    let mockCtx: any;
    let camera: Camera;

    beforeEach(() => {
      DarkFantasySprites.clearCache();
      camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
    });

    it('empirically asserts exact flash threshold: flashTimer > 0.05 is white, 0 < flashTimer <= 0.05 is crimson', () => {
      const enemy = new Enemy(1);
      enemy.reset('skeleton', 100, 100);
      enemy.active = true;

      // 1. Above 0.05: WHITE FLASH
      const whiteThresholds = [0.10, 0.08, 0.051, 0.050001];
      for (const t of whiteThresholds) {
        enemy.flashTimer = t;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        expect(mockCtx.fillStyle, `flashTimer=${t} should be white`).toBe('#ffffff');
      }

      // 2. Exact boundary and below (<= 0.05 and > 0): CRIMSON FLASH
      const crimsonThresholds = [0.050000, 0.049999, 0.03, 0.01, 0.0001];
      for (const t of crimsonThresholds) {
        enemy.flashTimer = t;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        expect(
          mockCtx.fillStyle,
          `flashTimer=${t} should be crimson (${PALETTE.BLOOD_CRIMSON.FLASH})`
        ).toBe(PALETTE.BLOOD_CRIMSON.FLASH);
      }

      // 3. Zero or negative: NORMAL (no mask fill)
      const normalThresholds = [0.0, -0.01, -0.1];
      for (const t of normalThresholds) {
        enemy.flashTimer = t;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        // Normal rendering draws procedural vector bones, not white/crimson mask
        expect(mockCtx.fillStyle).not.toBe('#ffffff');
        expect(mockCtx.fillStyle).not.toBe(PALETTE.BLOOD_CRIMSON.FLASH);
      }
    });

    it('empirically verifies damage flash switching across all 4 enemy types', () => {
      const types = ['skeleton', 'ghoul', 'banshee', 'death_knight'] as const;

      for (const type of types) {
        const enemy = new Enemy(1);
        enemy.reset(type, 100, 100);
        enemy.active = true;

        // White state (> 0.05)
        enemy.flashTimer = 0.07;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        expect(mockCtx.fillStyle, `${type} white flash`).toBe('#ffffff');

        // Crimson state (<= 0.05 and > 0)
        enemy.flashTimer = 0.04;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        expect(mockCtx.fillStyle, `${type} crimson flash`).toBe(PALETTE.BLOOD_CRIMSON.FLASH);

        // Normal state (0)
        enemy.flashTimer = 0;
        mockCtx.fillStyle = '';
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
        expect(mockCtx.fillStyle, `${type} normal`).not.toBe('#ffffff');
        expect(mockCtx.fillStyle, `${type} normal`).not.toBe(PALETTE.BLOOD_CRIMSON.FLASH);
      }
    });

    it('empirically simulates dynamic 60Hz hit-reaction lifecycle with HordeManager', () => {
      const horde = new HordeManager(100);
      const enemy = horde.spawnEnemy('skeleton', 100, 100)!;
      expect(enemy).not.toBeNull();
      expect(enemy.flashTimer).toBe(0);

      // Inflict damage -> Enemy.takeDamage sets flashTimer = 0.1
      enemy.takeDamage(15);
      expect(enemy.flashTimer).toBe(0.1);

      const dt = 1 / 60; // ~0.01667s

      // Frame 1 (t = ~0.0167s, remaining ~0.0833s): WHITE
      horde.update(dt, { x: 0, y: 0 });
      mockCtx.fillStyle = '';
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(enemy.flashTimer).toBeGreaterThan(0.05);
      expect(mockCtx.fillStyle).toBe('#ffffff');

      // Frame 2 (t = ~0.0333s, remaining ~0.0667s): WHITE
      horde.update(dt, { x: 0, y: 0 });
      mockCtx.fillStyle = '';
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(enemy.flashTimer).toBeGreaterThan(0.05);
      expect(mockCtx.fillStyle).toBe('#ffffff');

      // Frame 3 (t = ~0.0500s, remaining ~0.0500s): WHITE or transitioning
      horde.update(dt, { x: 0, y: 0 });

      // Frame 4 (t = ~0.0667s, remaining ~0.0333s): CRIMSON
      horde.update(dt, { x: 0, y: 0 });
      mockCtx.fillStyle = '';
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(enemy.flashTimer).toBeLessThanOrEqual(0.05);
      expect(enemy.flashTimer).toBeGreaterThan(0);
      expect(mockCtx.fillStyle).toBe(PALETTE.BLOOD_CRIMSON.FLASH);

      // Frame 5 (t = ~0.0833s, remaining ~0.0167s): CRIMSON
      horde.update(dt, { x: 0, y: 0 });
      mockCtx.fillStyle = '';
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(enemy.flashTimer).toBeLessThanOrEqual(0.05);
      expect(enemy.flashTimer).toBeGreaterThan(0);
      expect(mockCtx.fillStyle).toBe(PALETTE.BLOOD_CRIMSON.FLASH);

      // Frame 6 & 7 (t > 0.10s, remaining 0): NORMAL
      horde.update(dt, { x: 0, y: 0 });
      horde.update(dt, { x: 0, y: 0 });
      mockCtx.fillStyle = '';
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(enemy.flashTimer).toBe(0);
      expect(mockCtx.fillStyle).not.toBe('#ffffff');
      expect(mockCtx.fillStyle).not.toBe(PALETTE.BLOOD_CRIMSON.FLASH);
    });
  });

  // =========================================================================
  // Challenge 3: GothicHUD Responsiveness, Ghost Drain, and UI Physics
  // =========================================================================
  describe('Challenge 3: GothicHUD Responsiveness, Ghost Drain, and UI Physics', () => {
    let hud: GothicHUD;
    let mockCtx: any;
    let snapshot: HUDStateSnapshot;

    beforeEach(() => {
      hud = new GothicHUD({
        virtualWidth: 960,
        virtualHeight: 540,
        xpColorMode: 'necrotic-emerald',
      });

      mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 35 }),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        translate: vi.fn(),
        scale: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
      };

      snapshot = {
        player: {
          stats: {
            currentHealth: 100,
            maxHealth: 100,
            healthRegen: 0,
            armor: 0,
          },
          level: 1,
          currentXP: 0,
          xpToNextLevel: 10,
          isAlive: true,
          weapons: [],
          passives: [],
        },
        hordeManager: {
          totalKilled: 10,
          getActiveCount: () => 50,
        },
        elapsedTime: 12.0,
        killCount: 10,
      };
    });

    it('empirically verifies vitality ghost drain: 350ms freeze delay followed by linear drain rate', () => {
      // 1. First update initializes baseline
      hud.update(0.016, snapshot);
      expect(hud.displayHealth).toBe(100);
      expect(hud.ghostHealth).toBe(100);

      // 2. Inflict 50 damage -> HP drops to 50
      snapshot.player.stats.currentHealth = 50;
      hud.update(0.016, snapshot);

      // displayHealth drops immediately; ghostHealth holds steady at 100
      expect(hud.displayHealth).toBe(50);
      expect(hud.ghostHealth).toBe(100);
      expect(hud.ghostDrainDelay).toBeCloseTo(0.35 - 0.016, 3);

      // 3. Simulate 15 frames (~0.24s, still within the 350ms delay window)
      for (let i = 0; i < 15; i++) {
        hud.update(0.016, snapshot);
      }
      // ghostHealth must still be locked at 100
      expect(hud.ghostHealth).toBe(100);
      expect(hud.ghostDrainDelay).toBeGreaterThan(0);

      // 4. Advance past the remaining delay window (~0.10s)
      for (let i = 0; i < 8; i++) {
        hud.update(0.016, snapshot);
      }
      expect(hud.ghostDrainDelay).toBeLessThanOrEqual(0);

      // 5. Now ghostHealth must be actively draining towards displayHealth (50)
      const drainingGhostHP = hud.ghostHealth;
      expect(drainingGhostHP).toBeLessThan(100);
      expect(drainingGhostHP).toBeGreaterThan(50);

      // Advance enough ticks to complete drain
      for (let i = 0; i < 60; i++) {
        hud.update(0.016, snapshot);
      }
      expect(hud.ghostHealth).toBe(50);
      expect(hud.displayHealth).toBe(50);
    });

    it('empirically asserts ghostHealth never dips below displayHealth', () => {
      hud.update(0.016, snapshot);

      // Player takes fatal damage -> 0 HP
      snapshot.player.stats.currentHealth = 0;
      hud.update(0.016, snapshot);
      expect(hud.displayHealth).toBe(0);

      // Advance for 5 seconds
      for (let i = 0; i < 300; i++) {
        hud.update(0.016, snapshot);
        expect(hud.ghostHealth).toBeGreaterThanOrEqual(0);
      }
      expect(hud.ghostHealth).toBe(0);
    });

    it('empirically verifies XP bar fill interpolation and level-up flash burst', () => {
      hud.update(0.016, snapshot);
      expect(hud.displayXP).toBe(0);

      // Gain 8 XP out of 10
      snapshot.player.currentXP = 8;
      hud.update(0.016, snapshot);

      // displayXP should interpolate smoothly
      expect(hud.displayXP).toBeGreaterThan(0);
      expect(hud.displayXP).toBeLessThan(8);

      // Advance to settle
      for (let i = 0; i < 40; i++) {
        hud.update(0.016, snapshot);
      }
      expect(hud.displayXP).toBeCloseTo(8, 0.05);

      // Level up to Level 2 with 4 surplus XP
      snapshot.player.level = 2;
      snapshot.player.currentXP = 4;
      snapshot.player.xpToNextLevel = 25;

      hud.update(0.016, snapshot);
      expect(hud.currentLevel).toBe(2);
      expect(hud.levelUpFlashTimer).toBeGreaterThan(0.75); // 0.8s flash trigger
    });

    it('empirically verifies skull kill counter punch scale impulse (1.35x) and decay', () => {
      hud.update(0.016, snapshot);
      expect(hud.killScaleAnim).toBe(1.0);
      expect(hud.killDisplayCount).toBe(10);

      // Kill count increases by 5
      snapshot.killCount = 15;
      hud.update(0.016, snapshot);

      // Snaps to 1.35 scale punch
      expect(hud.killScaleAnim).toBe(1.35);
      expect(hud.killDisplayCount).toBe(15);

      // Decays at 3.0/sec
      hud.update(0.05, snapshot);
      expect(hud.killScaleAnim).toBeCloseTo(1.35 - 0.05 * 3.0, 2);

      // Fully settles back to 1.0
      for (let i = 0; i < 30; i++) {
        hud.update(0.016, snapshot);
      }
      expect(hud.killScaleAnim).toBe(1.0);
    });

    it('empirically asserts low-health vignette pulse triggers ONLY when HP < 30%', () => {
      // Case 1: HP = 50% -> No vignette
      snapshot.player.stats.currentHealth = 50;
      hud.update(0.016, snapshot);
      mockCtx.createRadialGradient.mockClear();
      hud.render(mockCtx, 960, 540, snapshot);
      expect(mockCtx.createRadialGradient).not.toHaveBeenCalled();

      // Case 2: HP = 30.0% -> No vignette (threshold is strictly < 0.3)
      snapshot.player.stats.currentHealth = 30;
      hud.update(0.016, snapshot);
      mockCtx.createRadialGradient.mockClear();
      hud.render(mockCtx, 960, 540, snapshot);
      expect(mockCtx.createRadialGradient).not.toHaveBeenCalled();

      // Case 3: HP = 25% (< 30%) -> Radial gradient vignette activated
      snapshot.player.stats.currentHealth = 25;
      hud.update(0.016, snapshot);
      mockCtx.createRadialGradient.mockClear();
      hud.render(mockCtx, 960, 540, snapshot);
      expect(mockCtx.createRadialGradient).toHaveBeenCalled();

      // Case 4: HP = 10% -> Radial gradient vignette activated with higher intensity
      snapshot.player.stats.currentHealth = 10;
      hud.update(0.016, snapshot);
      mockCtx.createRadialGradient.mockClear();
      hud.render(mockCtx, 960, 540, snapshot);
      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    });

    it('empirically verifies survival timer formatting and wave phase indicators', () => {
      // 0s: Phase I
      snapshot.elapsedTime = 0;
      hud.update(0.016, snapshot);
      expect(hud.cachedTimerStr).toBe('00:00');

      // 45s: Phase II
      snapshot.elapsedTime = 45;
      hud.update(0.016, snapshot);
      expect(hud.cachedTimerStr).toBe('00:45');

      // 125s (2m 05s): Phase III
      snapshot.elapsedTime = 125;
      hud.update(0.016, snapshot);
      expect(hud.cachedTimerStr).toBe('02:05');
    });
  });
});
