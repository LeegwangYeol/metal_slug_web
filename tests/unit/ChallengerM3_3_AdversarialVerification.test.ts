import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DarkFantasyVFX } from '../../src/render/vfx/DarkFantasyVFX';
import { Camera } from '../../src/render/Camera';
import { LootItem, LootDropType } from '../../src/core/systems/LootManager';
import { Enemy } from '../../src/core/entities/Enemy';



describe('Challenger M3-3 Adversarial Empirical Verification Suite', () => {
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
  // Challenge 1: Enemy Type Casing & Archetype Silhouette Matrix
  // =========================================================================
  describe('Challenge 1: Enemy Type Casing & Archetype Silhouette Matrix', () => {
    const archetypes = [
      {
        name: 'Skeleton',
        inputs: ['skeleton', 'SKELETON', 'Skeleton', 'skeletons'],
        expectedRx: 14,
        expectedRy: 5,
        expectedOffsetY: 14,
        expectedFill: 'rgba(0, 0, 0, 0.40)',
      },
      {
        name: 'Ghoul',
        inputs: ['ghoul', 'GHOUL', 'Ghoul', 'ghouls'],
        expectedRx: 16,
        expectedRy: 6,
        expectedOffsetY: 14,
        expectedFill: 'rgba(0, 0, 0, 0.42)',
      },
      {
        name: 'Death Knight',
        inputs: ['death_knight', 'DEATH_KNIGHT', 'Death_Knight', 'deathKnight', 'knight', 'KNIGHT'],
        expectedRx: 24,
        expectedRy: 9,
        expectedOffsetY: 22,
        expectedFill: 'rgba(0, 0, 0, 0.55)',
      },
    ];

    for (const arch of archetypes) {
      for (const input of arch.inputs) {
        it(`correctly scales ${arch.name} shadow for input "${input}" using native ellipse`, () => {
          const enemy = { type: input, x: 200, y: 100, isAlive: true };
          const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
          const mockHorde = { getActiveEnemies: () => [enemy] };
          const mockLoot = { getActiveItems: () => [] };

          mockCtx.ellipse.mockClear();
          vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

          expect(mockCtx.ellipse).toHaveBeenCalledWith(
            200,
            100 + arch.expectedOffsetY,
            arch.expectedRx,
            arch.expectedRy,
            0,
            0,
            Math.PI * 2
          );
          expect(mockCtx.fillStyle).toBe(arch.expectedFill);
        });

        it(`correctly scales ${arch.name} shadow for input "${input}" using polyfill arc/scale fallback`, () => {
          const enemy = { type: input, x: 200, y: 100, isAlive: true };
          const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
          const mockHorde = { getActiveEnemies: () => [enemy] };
          const mockLoot = { getActiveItems: () => [] };

          mockCtx.ellipse = undefined; // simulate canvas environment lacking ellipse
          mockCtx.scale.mockClear();
          mockCtx.translate.mockClear();
          mockCtx.arc.mockClear();

          vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

          expect(mockCtx.translate).toHaveBeenCalledWith(200, 100 + arch.expectedOffsetY);
          expect(mockCtx.scale).toHaveBeenCalledWith(arch.expectedRx, arch.expectedRy);
          expect(mockCtx.arc).toHaveBeenCalledWith(0, 0, 1, 0, Math.PI * 2);
          expect(mockCtx.fillStyle).toBe(arch.expectedFill);
        });
      }
    }

    it('handles Banshee with lowercase, uppercase, and mixed-case', () => {
      const bansheeInputs = ['banshee', 'BANSHEE', 'Banshee'];
      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockLoot = { getActiveItems: () => [] };

      for (const input of bansheeInputs) {
        const enemy = { type: input, x: 200, y: 100, isAlive: true };
        const mockHorde = { getActiveEnemies: () => [enemy] };

        mockCtx.ellipse.mockClear();
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

        expect(mockCtx.ellipse).toHaveBeenCalledWith(
          200,
          118,
          expect.any(Number),
          expect.any(Number),
          0,
          0,
          Math.PI * 2
        );
        expect(mockCtx.fillStyle).toContain('rgba(26, 12, 46,');
      }
    });

    it('falls back safely to default 14x5 shadow when enemy.type is undefined, null, or unknown', () => {
      const weirdEnemies = [
        { type: undefined, x: 100, y: 100, isAlive: true },
        { type: null, x: 200, y: 100, isAlive: true },
        { type: 'UNKNOWN_ABOMINATION', x: 300, y: 100, isAlive: true },
      ];
      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => weirdEnemies };
      const mockLoot = { getActiveItems: () => [] };

      mockCtx.ellipse.mockClear();
      expect(() => {
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);
      }).not.toThrow();

      // All 3 should fall back to 14x5 at y+14 with fallback fillStyle rgba(0, 0, 0, 0.38)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(100, 114, 14, 5, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 114, 14, 5, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 114, 14, 5, 0, 0, Math.PI * 2);
    });

    it('empirically verifies enemies spawned via WaveDirector receive their distinct shadows', () => {
      // Test all types that director can generate
      const testCases = [
        { type: 'ghoul', expectedRx: 16, expectedRy: 6, expectedOffsetY: 14 },
        { type: 'death_knight', expectedRx: 24, expectedRy: 9, expectedOffsetY: 22 },
        { type: 'banshee', expectedRx: expect.any(Number), expectedRy: expect.any(Number), expectedOffsetY: 18 },
        { type: 'skeleton', expectedRx: 14, expectedRy: 5, expectedOffsetY: 14 },
      ];

      for (const tc of testCases) {
        const enemy = new Enemy(99);
        enemy.reset(tc.type as any, 500, 250);

        const mockHorde = { getActiveEnemies: () => [enemy] };
        const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
        const mockLoot = { getActiveItems: () => [] };

        mockCtx.ellipse.mockClear();
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

        expect(mockCtx.ellipse).toHaveBeenCalledWith(
          500,
          250 + tc.expectedOffsetY,
          tc.expectedRx,
          tc.expectedRy,
          0,
          0,
          Math.PI * 2
        );
      }
    });
  });

  // =========================================================================
  // Challenge 2: LootItem Property Resolution & Shimmer Lighting
  // =========================================================================
  describe('Challenge 2: LootItem Property Dual-Source Resolution & Shimmer Lighting', () => {
    it('verifies all LootDropType enums on runtime LootItem instances receive intended shadows', () => {
      const cases = [
        { dropType: LootDropType.EMERALD_SHARD, rx: 5, ry: 2.5 },
        { dropType: LootDropType.RUBY_GEM, rx: 7, ry: 3.2 },
        { dropType: LootDropType.VIOLET_ABYSSAL, rx: 7, ry: 3.2 },
        { dropType: LootDropType.SOUL_CHEST, rx: 11, ry: 5 },
        { dropType: LootDropType.HEALTH_VIAL, rx: 5, ry: 2.5 },
        { dropType: LootDropType.ELDRITCH_MAGNET, rx: 5, ry: 2.5 },
      ];

      for (const c of cases) {
        const item = new LootItem('item-' + c.dropType);
        item.reset('item-' + c.dropType, c.dropType, 300, 200);

        // Verify that runtime LootItem instance retains type = 'LOOT_DROP' and dropType = c.dropType
        expect(item.type).toBe('LOOT_DROP');
        expect(item.dropType).toBe(c.dropType);

        const mockLoot = { getActiveItems: () => [item] };
        const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
        const mockHorde = { getActiveEnemies: () => [] };

        mockCtx.ellipse.mockClear();
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

        expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 208, c.rx, c.ry, 0, 0, Math.PI * 2);
      }
    });

    it('verifies synthetic mock objects with only .type receive correct shadows', () => {
      const mockItems = [
        { type: 'ruby', position: { x: 100, y: 100 }, isAlive: true },
        { type: 'RUBY_GEM', position: { x: 200, y: 100 }, isAlive: true },
        { type: 'violet', position: { x: 300, y: 100 }, isAlive: true },
        { type: 'VIOLET_ABYSSAL', position: { x: 400, y: 100 }, isAlive: true },
        { type: 'chest', position: { x: 500, y: 100 }, isAlive: true },
        { type: 'SOUL_CHEST', position: { x: 600, y: 100 }, isAlive: true },
        { type: 'emerald', position: { x: 700, y: 100 }, isAlive: true },
      ];

      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => [] };
      const mockLoot = { getActiveItems: () => mockItems };

      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      expect(mockCtx.ellipse).toHaveBeenCalledWith(100, 108, 7, 3.2, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 108, 7, 3.2, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 108, 7, 3.2, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(400, 108, 7, 3.2, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(500, 108, 11, 5, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(600, 108, 11, 5, 0, 0, Math.PI * 2);
      expect(mockCtx.ellipse).toHaveBeenCalledWith(700, 108, 5, 2.5, 0, 0, Math.PI * 2);
    });

    it('verifies dynamic shimmer lighting strictly activates for Ruby, Violet, Chest and NOT Emerald', () => {
      const ruby = new LootItem('ruby-1');
      ruby.reset('ruby-1', LootDropType.RUBY_GEM, 200, 200);

      const violet = new LootItem('violet-1');
      violet.reset('violet-1', LootDropType.VIOLET_ABYSSAL, 300, 200);

      const chest = new LootItem('chest-1');
      chest.reset('chest-1', LootDropType.SOUL_CHEST, 400, 200);

      const emerald = new LootItem('emerald-1');
      emerald.reset('emerald-1', LootDropType.EMERALD_SHARD, 500, 200);

      const scene = {
        player: { position: { x: 0, y: 0 }, isAlive: true },
        elapsedTime: 1.0,
        lootManager: {
          getActiveItems: () => [ruby, violet, chest, emerald],
        },
      };

      // Mock offscreen light canvas and full context
      const mockLCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        globalAlpha: 1.0,
        globalCompositeOperation: 'source-over',
      };
      const mockCanvas = { width: 960, height: 540 };

      vfx.lighting.lightCanvas = mockCanvas as any;
      vfx.lighting.lightCtx = mockLCtx as any;
      vfx.lighting.pointStencilCanvas = {} as any;

      vfx.renderLighting(mockCtx, camera, scene as any);

      // Shimmer lights draw pointStencilCanvas at item positions (gx-25, gy-25, 50, 50)
      const shimmerDraws = mockLCtx.drawImage.mock.calls.filter(call => {
        return call[3] === 50 && call[4] === 50;
      });

      // Exactly 3 shimmer draws: ruby (x=200), violet (x=300), chest (x=400). Emerald must NOT have one!
      expect(shimmerDraws.length).toBe(3);
      expect(shimmerDraws.some(c => c[1] === 200 - 25)).toBe(true);
      expect(shimmerDraws.some(c => c[1] === 300 - 25)).toBe(true);
      expect(shimmerDraws.some(c => c[1] === 400 - 25)).toBe(true);
      expect(shimmerDraws.some(c => c[1] === 500 - 25)).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: Banshee Shadow Height Attenuation Monotonicity
  // =========================================================================
  describe('Challenge 3: Banshee Shadow Height Attenuation Monotonicity', () => {
    it('empirically verifies strict inverse relationship between height and scale/alpha over 1,000 time steps', () => {
      const banshee = [{ type: 'banshee', x: 400, y: 300, isAlive: true }];
      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => banshee };
      const mockLoot = { getActiveItems: () => [] };

      const samples: { t: number; yBob: number; rx: number; ry: number; alpha: number }[] = [];

      for (let i = 0; i <= 1000; i++) {
        const t = (i / 1000) * 10.0;
        const yBob = Math.sin(t * 3.0) * 3.0;

        mockCtx.ellipse.mockClear();
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, t);

        const call = mockCtx.ellipse.mock.calls[0];
        expect(call).toBeDefined();

        const rx = call[2];
        const ry = call[3];
        const alphaMatch = mockCtx.fillStyle.match(/rgba\(26,\s*12,\s*46,\s*([0-9.]+)\)/);
        expect(alphaMatch).not.toBeNull();
        const alpha = parseFloat(alphaMatch![1]);

        samples.push({ t, yBob, rx, ry, alpha });
      }

      // Assert boundary invariants
      for (const s of samples) {
        expect(s.rx).toBeGreaterThanOrEqual(14 * 0.65 - 0.001);
        expect(s.rx).toBeLessThanOrEqual(14 * 1.15 + 0.001);
        expect(s.alpha).toBeGreaterThanOrEqual(0.12);
        expect(s.alpha).toBeLessThanOrEqual(0.40);
      }

      // Sort samples by yBob (lowest float to highest float)
      const sorted = [...samples].sort((a, b) => a.yBob - b.yBob);

      // Monotonicity assertion: as yBob increases (higher float):
      // scale MUST NOT increase (monotonically non-increasing)
      // alpha MUST NOT increase (monotonically non-increasing)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (curr.yBob > prev.yBob + 0.05) {
          expect(curr.rx).toBeLessThanOrEqual(prev.rx + 1e-6);
          expect(curr.alpha).toBeLessThanOrEqual(prev.alpha + 1e-6);
        }
      }

      // Lowest float sample (yBob ≈ -3.0): highest scale (16.1), highest alpha (0.40)
      const lowest = sorted[0];
      expect(lowest.yBob).toBeCloseTo(-3.0, 1);
      expect(lowest.rx).toBeCloseTo(16.1, 1);
      expect(lowest.alpha).toBeCloseTo(0.40, 2);

      // Highest float sample (yBob ≈ +3.0): lowest scale (11.9), lowest alpha (0.18)
      const highest = sorted[sorted.length - 1];
      expect(highest.yBob).toBeCloseTo(3.0, 1);
      expect(highest.rx).toBeCloseTo(11.9, 1);
      expect(highest.alpha).toBeCloseTo(0.18, 2);
    });
  });

  // =========================================================================
  // Challenge 4: Build & Export Integrity
  // =========================================================================
  describe('Challenge 4: Build & Export Integrity', () => {
    it('verifies DarkFantasyVFX exports all required classes and interfaces without runtime breakage', () => {
      expect(DarkFantasyVFX).toBeDefined();
      const testVfx = new DarkFantasyVFX(100);
      expect(testVfx.capacity).toBe(100);
      expect(testVfx.lighting).toBeDefined();
      expect(typeof testVfx.renderContactDropShadows).toBe('function');
      expect(typeof testVfx.renderLighting).toBe('function');
      expect(typeof testVfx.clear).toBe('function');
    });
  });
});
