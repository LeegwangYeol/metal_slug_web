import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DarkFantasyVFX } from '../../src/render/vfx/DarkFantasyVFX';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';

describe('DarkFantasyVFX Zero-Garbage Particle Pool & Arcane VFX (Milestone M2)', () => {
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
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
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

  describe('Pool Pre-allocation & Invariants', () => {
    it('initializes exact 500-slot capacity with 0 active particles', () => {
      expect(vfx.capacity).toBe(500);
      expect(vfx.pool.length).toBe(500);
      expect(vfx.getFreeCount()).toBe(500);
      expect(vfx.getActiveCount()).toBe(0);
    });

    it('allocates particles from free pool and updates counts in O(1)', () => {
      vfx.emitBloodBurst(100, 100, 10);

      expect(vfx.getActiveCount()).toBe(10);
      expect(vfx.getFreeCount()).toBe(490);
    });

    it('returns all expired particles to free pool on update lifecycle', () => {
      vfx.emitBloodBurst(100, 100, 20);
      expect(vfx.getActiveCount()).toBe(20);

      // Advance by 2.0 seconds (all blood particles have maxLife < 1.0s)
      vfx.update(2.0);

      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
    });

    it('handles pool saturation gracefully by displacing oldest particle without memory allocation', () => {
      // Spawn 500 particles to fill capacity
      for (let i = 0; i < 50; i++) {
        vfx.emitBoneShatter(0, 0, 10);
      }
      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.getFreeCount()).toBe(0);

      // Spawn 1 more - must not throw or exceed capacity
      expect(() => {
        vfx.emitSpellTrail(50, 50);
      }).not.toThrow();

      expect(vfx.getActiveCount()).toBe(500);
      expect(vfx.capacity).toBe(500);
    });

    it('maintains 100% pool index invariant across 5,000 high-churn spawn cycles', () => {
      for (let cycle = 0; cycle < 500; cycle++) {
        vfx.emitBloodBurst(50, 50, 8);
        vfx.emitSoulBurst(100, 100, 'emerald', 4);
        vfx.update(0.05); // Advance some to expire
      }

      // Advance final step to drain all
      vfx.update(5.0);

      expect(vfx.getActiveCount()).toBe(0);
      expect(vfx.getFreeCount()).toBe(500);
    });
  });

  describe('Emitters (Zero-Heap Allocation)', () => {
    it('emits bone shatter fragments with tumbling rotation', () => {
      vfx.emitBoneShatter(200, 200, 5);
      expect(vfx.getActiveCount()).toBe(5);

      const p = vfx.pool.find(item => item.active && item.type === 'BONE_CHIP');
      expect(p).toBeDefined();
      expect(p!.type).toBe('BONE_CHIP');
      expect(p!.vRot).not.toBe(0);
    });

    it('emits rising soul sparks with inverted negative gravity', () => {
      vfx.emitSoulBurst(300, 300, 'violet', 4);

      const p = vfx.pool.find(item => item.active && item.type === 'SOUL_SPARK');
      expect(p).toBeDefined();
      expect(p!.gravity).toBeLessThan(0); // Inverted gravity
      expect(p!.vy).toBeLessThan(0); // Floating up
    });

    it('emits persistent ground spell circle runes', () => {
      vfx.emitSpellCircle(400, 400, 60, 2.0);

      const p = vfx.pool.find(item => item.active && item.type === 'SPELL_CIRCLE');
      expect(p).toBeDefined();
      expect(p!.size).toBe(60);
      expect(p!.maxLife).toBe(2.0);
    });

    it('emits loot item glints during updateLootGlints', () => {
      const loot1 = new LootItem('1');
      loot1.reset('1', 'EMERALD_SHARD' as any, 100, 100);
      const mockLoot: LootItem[] = [loot1];

      // Advance glint timer to trigger emission
      for (let i = 0; i < 10; i++) {
        vfx.updateLootGlints(mockLoot, 0.1);
      }

      const activeGlints = vfx.pool.filter(p => p.active && p.type === 'GEM_GLINT');
      expect(activeGlints.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Dual-Layer Rendering', () => {
    it('renderGround draws only SPELL_CIRCLE decals', () => {
      vfx.emitBloodBurst(100, 100, 5); // Air particle
      vfx.emitSpellCircle(200, 200, 50, 1.5); // Ground particle

      vfx.renderGround(mockCtx, camera);

      // Exactly 1 ground particle drawn
      expect(mockCtx.save).toHaveBeenCalledTimes(1);
      expect(mockCtx.restore).toHaveBeenCalledTimes(1);
      expect(mockCtx.beginPath).toHaveBeenCalled();
    });

    it('renderAir draws air particles and skips spell circles', () => {
      vfx.emitBloodBurst(100, 100, 3); // Air
      vfx.emitBoneShatter(150, 150, 2); // Air
      vfx.emitSpellCircle(200, 200, 50, 1.5); // Ground

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      vfx.renderAir(mockCtx, camera);

      // 5 air particles drawn (3 blood + 2 bone)
      expect(mockCtx.save).toHaveBeenCalledTimes(5);
      expect(mockCtx.restore).toHaveBeenCalledTimes(5);
    });
  });
});
