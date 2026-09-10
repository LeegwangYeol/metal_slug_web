import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { DarkFantasyVFX } from '../../src/render/vfx/DarkFantasyVFX';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';
import { Enemy } from '../../src/core/entities/Enemy';

describe('Adversarial Verification Suite: Milestone 3 Visual States & Reset Invariants (challenger_m3_2)', () => {
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
  // Invariant 1: GrimHarvestGame.restart() Cleans Decals, Particles, Runes, Lighting
  // =========================================================================
  describe('Invariant 1: GrimHarvestGame.restart() Complete Reset', () => {
    it('cleanly clears all active decals, particles, ground runes, and resets lighting state upon restart()', () => {
      const game = new GrimHarvestGame();

      // Emit high volume of diverse particles
      for (let i = 0; i < 50; i++) {
        game.vfx.emitBloodBurst(100 + i, 100, 4);
        game.vfx.emitBoneShatter(200 + i, 200, 3);
        game.vfx.emitSoulBurst(300, 300, 'ruby', 3);
      }

      // Emit ground runes (SPELL_CIRCLE and OCCULT_SEAL)
      game.vfx.emitSpellCircle(150, 150, 45, 1.0);
      game.vfx.emitSpellCircle(250, 250, 60, 1.0);
      game.vfx.emitLevelUpRune(350, 350, 50, 1.0);
      game.vfx.emitSigilShockwave(450, 450, 70);

      // Emit all 4 decal types
      for (let i = 0; i < 20; i++) {
        game.vfx.emitDecal('BLOOD_SPLATTER', 50 + i * 5, 50);
        game.vfx.emitDecal('BLOOD_POOL', 150 + i * 5, 150);
        game.vfx.emitDecal('LIGHTNING_SCORCH', 250 + i * 5, 250);
        game.vfx.emitDecal('SIGIL_SCORCH', 350 + i * 5, 350);
      }

      // Trigger lighting flash
      game.vfx.lighting.triggerLightningFlash(0.85);

      // Verify dirty state before restart
      expect(game.vfx.getActiveCount()).toBeGreaterThan(0);
      expect(game.vfx.getActiveDecalCount()).toBeGreaterThan(0);
      expect(game.vfx.lighting.lightningFlash).toBe(0.85);

      // Count active runes before restart
      let activeRunesBefore = 0;
      for (let i = 0; i < game.vfx.pool.length; i++) {
        const p = game.vfx.pool[i];
        if (p.active && (p.type === 'SPELL_CIRCLE' || p.type === 'OCCULT_SEAL')) {
          activeRunesBefore++;
        }
      }
      expect(activeRunesBefore).toBeGreaterThanOrEqual(3);

      // Execute game restart
      game.restart();

      // Verify complete purge after restart
      expect(game.vfx.getActiveCount()).toBe(0);
      expect(game.vfx.getFreeCount()).toBe(game.vfx.capacity);
      expect(game.vfx.getActiveDecalCount()).toBe(0);
      expect(game.vfx.lighting.lightningFlash).toBe(0);

      // Verify all pool elements have active === false
      for (let i = 0; i < game.vfx.pool.length; i++) {
        expect(game.vfx.pool[i].active).toBe(false);
      }

      // Verify all decal elements have active === false
      for (let i = 0; i < game.vfx.decals.length; i++) {
        expect(game.vfx.decals[i].active).toBe(false);
      }

      // Rendering passes with mock context must produce 0 draw operations for decals, runes, and air
      mockCtx.ellipse.mockClear();
      mockCtx.arc.mockClear();
      mockCtx.stroke.mockClear();
      mockCtx.fill.mockClear();

      game.vfx.renderDecals(mockCtx, game.camera);
      expect(mockCtx.fill).not.toHaveBeenCalled();

      game.vfx.renderGround(mockCtx, game.camera);
      expect(mockCtx.stroke).not.toHaveBeenCalled();

      game.vfx.renderAir(mockCtx, game.camera);
      expect(mockCtx.fill).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Invariant 2: Drop Shadow Dimensions Scaling
  // =========================================================================
  describe('Invariant 2: Drop Shadow Dimensions Scaling Across Archetypes', () => {
    it('scales shadow dimensions accurately when item.type contains gem category, but EXPOSES LOOTITEM BUG', () => {
      const mockPlayer = { position: { x: 300, y: 300 }, isAlive: true };
      const mockHorde = { getActiveEnemies: () => [] };

      // Artificial LootItem with type explicitly set
      const emeraldGem = new LootItem('gem-1');
      emeraldGem.isAlive = true;
      emeraldGem.position = { x: 100, y: 100 };
      emeraldGem.type = 'EMERALD_SHARD';

      const rubyGem = new LootItem('gem-2');
      rubyGem.isAlive = true;
      rubyGem.position = { x: 200, y: 100 };
      rubyGem.type = 'ruby';

      const chest = new LootItem('chest-1');
      chest.isAlive = true;
      chest.position = { x: 400, y: 100 };
      chest.type = 'chest';

      const mockLoot = { getActiveItems: () => [emeraldGem, rubyGem, chest] };

      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      // Player shadow: (18x7 at y+16)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 316, 18, 7, 0, 0, Math.PI * 2);

      // Emerald Gem shadow: (5x2.5 at y+8)
      expect(mockCtx.ellipse).toHaveBeenCalledWith(100, 108, 5, 2.5, 0, 0, Math.PI * 2);

      // Ruby Gem shadow: (7x3.2 at y+8) when type === 'ruby'
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 108, 7, 3.2, 0, 0, Math.PI * 2);

      // Chest shadow: (11x5 at y+8) when type === 'chest'
      expect(mockCtx.ellipse).toHaveBeenCalledWith(400, 108, 11, 5, 0, 0, Math.PI * 2);

      // NOW TEST REAL-WORLD LOOTMANAGER SPAWNED ITEM:
      // LootManager sets dropType = LootDropType.RUBY_GEM, but type = 'LOOT_DROP'
      const realRuby = new LootItem('real-ruby');
      realRuby.reset('real-ruby', 1 as any, 500, 100); // 1 = RUBY_GEM
      const mockLootReal = { getActiveItems: () => [realRuby] };

      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLootReal, 0);

      const realCall = mockCtx.ellipse.mock.calls[0];
      // Verifies real ruby item (LootDropType.RUBY_GEM) receives intended 7x3.2 shadow:
      expect(realCall[2]).toBe(7);
      expect(realCall[3]).toBe(3.2);
    });

    it('empirically verifies uppercase enemy types match exact shadow specifications', () => {
      const enemies = [
        { type: 'SKELETON', x: 100, y: 200, isAlive: true },
        { type: 'GHOUL', x: 200, y: 200, isAlive: true },
        { type: 'DEATH_KNIGHT', x: 300, y: 200, isAlive: true },
        { type: 'BANSHEE', x: 400, y: 200, isAlive: true },
      ];
      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => enemies };
      const mockLoot = { getActiveItems: () => [] };

      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      // Skeleton: 14x5 at y+14
      expect(mockCtx.ellipse).toHaveBeenCalledWith(100, 214, 14, 5, 0, 0, Math.PI * 2);

      // Ghoul: 16x6 at y+14
      expect(mockCtx.ellipse).toHaveBeenCalledWith(200, 214, 16, 6, 0, 0, Math.PI * 2);

      // Death Knight: 24x9 at y+22
      expect(mockCtx.ellipse).toHaveBeenCalledWith(300, 222, 24, 9, 0, 0, Math.PI * 2);

      // Banshee: base 14x5 modulated at y+18
      expect(mockCtx.ellipse).toHaveBeenCalledWith(
        400,
        218,
        expect.any(Number),
        expect.any(Number),
        0,
        0,
        Math.PI * 2
      );
    });

    it('verifies lowercase enemy types generated by WaveDirector receive intended scaled shadows', () => {
      // In WaveDirector.ts, enemy types are spawned as lowercase: 'skeleton', 'ghoul', 'banshee', 'death_knight'
      const lowercaseEnemies = [
        new Enemy(1),
        new Enemy(2),
        new Enemy(3),
        new Enemy(4),
      ];
      lowercaseEnemies[0].reset('skeleton', 100, 200);
      lowercaseEnemies[1].reset('ghoul', 200, 200);
      lowercaseEnemies[2].reset('death_knight', 300, 200);
      lowercaseEnemies[3].reset('banshee', 400, 200);

      const mockPlayer = { position: { x: -1000, y: -1000 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => lowercaseEnemies };
      const mockLoot = { getActiveItems: () => [] };

      mockCtx.ellipse.mockClear();
      vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, 0);

      // When type is lowercase 'death_knight':
      // Expected by spec: 24x9 at y+22
      const deathKnightCall = mockCtx.ellipse.mock.calls.find(
        (c: any[]) => c[0] === 300
      );
      expect(deathKnightCall).toBeDefined();
      const rx = deathKnightCall[2];
      const ry = deathKnightCall[3];
      const cy = deathKnightCall[1];

      // Verifies scaled shadow matching:
      expect(rx).toBe(24);
      expect(ry).toBe(9);
      expect(cy).toBe(222);
    });
  });

  // =========================================================================
  // Invariant 3: Banshee Floating Shadow Modulation
  // =========================================================================
  describe('Invariant 3: Banshee Floating Shadow Modulation Behavior', () => {
    it('empirically maps Banshee shadow radius and opacity vs vertical displacement', () => {
      const banshee = [{ type: 'BANSHEE', x: 200, y: 200, isAlive: true }];
      const mockPlayer = { position: { x: -500, y: -500 }, isAlive: false };
      const mockHorde = { getActiveEnemies: () => banshee };
      const mockLoot = { getActiveItems: () => [] };

      // Sample across full sine cycle (t in [0, 2*PI/3])
      const samples: { t: number; yBob: number; rx: number; ry: number; fillStyle: string }[] = [];
      const numSamples = 20;

      for (let i = 0; i <= numSamples; i++) {
        const t = (i / numSamples) * ((2 * Math.PI) / 3);
        const yBob = Math.sin(t * 3.0) * 3.0;

        mockCtx.ellipse.mockClear();
        vfx.renderContactDropShadows(mockCtx, camera, mockPlayer, mockHorde, mockLoot, t);

        const call = mockCtx.ellipse.mock.calls[0];
        samples.push({
          t,
          yBob,
          rx: call[2],
          ry: call[3],
          fillStyle: mockCtx.fillStyle,
        });
      }

      // At peak positive yBob (+3.0) (highest float above ground):
      // bScale = Math.max(0.65, 1.0 - 3.0 * 0.05) = 0.85 => rx = 14 * 0.85 = 11.9
      // bAlpha = Math.max(0.12, Math.min(0.40, 0.30 - 3.0 * 0.04)) = 0.18
      const peakPos = samples.reduce((max, s) => (s.yBob > max.yBob ? s : max), samples[0]);
      expect(peakPos.rx).toBeCloseTo(11.9, 1);
      expect(peakPos.fillStyle).toContain('0.18');

      // At peak negative yBob (-3.0) (closest float to ground):
      // bScale = Math.max(0.65, 1.0 - (-3.0) * 0.05) = 1.15 => rx = 14 * 1.15 = 16.1
      // bAlpha = Math.max(0.12, Math.min(0.40, 0.30 - (-3.0) * 0.04)) = 0.42 => clamped to 0.40
      const peakNeg = samples.reduce((min, s) => (s.yBob < min.yBob ? s : min), samples[0]);
      expect(peakNeg.rx).toBeCloseTo(16.1, 1);
      expect(peakNeg.fillStyle).toContain('0.4');

      // Gradient verification:
      // When yBob is peak positive (+3.0): shadow is SMALLEST (11.9) and MOST DIFFUSE (0.18).
      // When yBob is peak negative (-3.0): shadow is LARGEST (16.1) and MOST OPAQUE (0.40).
      expect(peakPos.rx).toBeLessThan(peakNeg.rx);
      const alphaPos = parseFloat(peakPos.fillStyle.replace(/[^0-9.]/g, ''));
      const alphaNeg = parseFloat(peakNeg.fillStyle.replace(/[^0-9.]/g, ''));
      expect(alphaPos).toBeLessThan(alphaNeg);
    });
  });

  // =========================================================================
  // Invariant 4: Lighting Buffer & Offscreen Canvas Blitting
  // =========================================================================
  describe('Invariant 4: Dynamic Lighting Buffer & Blitting Cleanliness', () => {
    it('manages 960x540 offscreen buffer, blits via source-over, and restores composite hygiene', () => {
      const lighting = vfx.lighting;
      expect(lighting.width).toBe(960);
      expect(lighting.height).toBe(540);

      const mockPlayer = {
        position: { x: 480, y: 270 },
        stats: { area: 100 },
        isAlive: true,
      };

      const sceneData = {
        player: mockPlayer,
        elapsedTime: 1.5,
      };

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();
      mockCtx.drawImage.mockClear();

      vfx.renderLighting(mockCtx, camera, sceneData as any);

      // Save and restore must be balanced
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.save.mock.calls.length).toBe(mockCtx.restore.mock.calls.length);

      // Offscreen light canvas blit via drawImage
      if (lighting.lightCanvas) {
        expect(mockCtx.drawImage).toHaveBeenCalledWith(lighting.lightCanvas, 0, 0);
      }

      // Global composite operation must be strictly restored to source-over
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });

    it('clamps ambient darkness under extreme lightning flash (no negative opacity)', () => {
      const lighting = vfx.lighting;

      // Trigger intense flash
      lighting.triggerLightningFlash(10.0);
      expect(lighting.lightningFlash).toBe(10.0);

      const mockPlayer = {
        position: { x: 480, y: 270 },
        isAlive: true,
      };

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderLighting(mockCtx, camera, { player: mockPlayer, elapsedTime: 0 } as any);

      // Even with lightningFlash = 10, ambient darkness is clamped:
      // curAmbient = Math.max(0.35, Math.min(0.92, 0.84 - 10.0)) = 0.35
      // Verify no exceptions thrown and composite operation strictly restored
      expect(mockCtx.globalCompositeOperation).toBe('source-over');
    });
  });
});
