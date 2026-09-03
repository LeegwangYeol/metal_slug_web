import { describe, it, expect, beforeEach } from 'vitest';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { FullMetalSlugGame } from '../../src/main';
import { vec2 } from '../../src/core/math/Vector2D';

describe('Milestone M4: Dedicated Boss Health Rebalance & Dynamic Gating Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
  });

  describe('1. Boss Health Ceiling & Default Balance Invariant', () => {
    it('default TetsuyukiBoss maxHealth must be strictly <= 500 (specifically rebalanced to 400 HP)', () => {
      const boss = new TetsuyukiBoss('boss_rebalance_1', vec2(360, 50));
      expect(boss.maxHealth).toBeLessThanOrEqual(500);
      expect(boss.maxHealth).toBe(400);
      expect(boss.health).toBe(400);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');
      expect(boss.isAlive).toBe(true);
    });

    it('stage trigger_end_boss in FullMetalSlugGame must configure boss with maxHealth <= 500', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;
      const bossTrigger = triggers.find((t: any) => t.id === 'trigger_end_boss');

      expect(bossTrigger).toBeDefined();

      const testEngine = new GameEngine();
      testEngine.start();
      bossTrigger.spawnAction(testEngine, 1780);
      testEngine.tick(1 / 60);

      const boss = testEngine.getEntity('boss_tetsuyuki') as TetsuyukiBoss;
      expect(boss).toBeDefined();
      expect(boss.maxHealth).toBeLessThanOrEqual(500);
      expect(boss.maxHealth).toBe(400);
      expect(boss.health).toBe(400);
    });
  });

  describe('2. Dynamic Phase Thresholds (65% for Phase 2, 30% for Phase 3)', () => {
    it('should transition to Phase 2 at exactly 65% maxHealth (260 HP for 400 maxHealth)', () => {
      const boss = new TetsuyukiBoss('boss_rebalance_2', vec2(360, 50));
      expect(boss.maxHealth).toBe(400);

      // Inflict 139 damage: 400 - 139 = 261 HP (> 260 HP) -> remains in Phase 1
      boss.takeDamage(139);
      expect(boss.health).toBe(261);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // Inflict 1 damage: 261 - 1 = 260 HP (<= 260 HP) -> transitions to Phase 2
      boss.takeDamage(1);
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
    });

    it('should transition to Phase 3 at exactly 30% maxHealth (120 HP for 400 maxHealth)', () => {
      const boss = new TetsuyukiBoss('boss_rebalance_3', vec2(360, 50));
      // Transition to Phase 2 first
      boss.takeDamage(140);
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Inflict 139 damage in Phase 2: 260 - 139 = 121 HP (> 120 HP) -> remains in Phase 2
      boss.takeDamage(139);
      expect(boss.health).toBe(121);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Inflict 1 damage: 121 - 1 = 120 HP (<= 120 HP) -> transitions to Phase 3
      boss.takeDamage(1);
      expect(boss.health).toBe(120);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
      expect(boss.weakPointExposed).toBe(true);
    });
  });

  describe('3. Burst Damage Clamping (Prevents Multi-Phase Skipping & Instant Kills)', () => {
    it('burst damage in Phase 1 (e.g. 5,000 HP) must clamp strictly at 260 HP and transition to Phase 2 without skipping', () => {
      const boss = new TetsuyukiBoss('boss_burst_p1', vec2(360, 50));
      expect(boss.health).toBe(400);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // Massive overkill burst
      boss.takeDamage(5000);

      // Must clamp at 65% (260 HP), NOT drop below or kill boss
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.isAlive).toBe(true);
    });

    it('burst damage in Phase 2 (e.g. 5,000 HP) must clamp strictly at 120 HP and transition to Phase 3 without skipping', () => {
      const boss = new TetsuyukiBoss('boss_burst_p2', vec2(360, 50));
      // First clamp into Phase 2
      boss.takeDamage(1000);
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Second massive overkill burst
      boss.takeDamage(5000);

      // Must clamp at 30% (120 HP), NOT drop to 0 or kill boss
      expect(boss.health).toBe(120);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
      expect(boss.weakPointExposed).toBe(true);
      expect(boss.isAlive).toBe(true);
    });

    it('lethal damage in Phase 3 drops health to 0 and initiates DEATH_EXPLODING sequence', () => {
      const boss = new TetsuyukiBoss('boss_burst_p3', vec2(360, 50));
      boss.takeDamage(1000); // clamps at 260
      boss.takeDamage(1000); // clamps at 120
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');

      // Hit weak point with lethal damage in Phase 3
      boss.takeDamage(500, true);
      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.deathStage).toBe(1);
    });
  });

  describe('4. Dynamic Threshold Scaling Across Arbitrary Max Health Values', () => {
    it('proves dynamic percentage formula works correctly for customHp = 300 (thresholds 195 and 90)', () => {
      const boss300 = new TetsuyukiBoss('boss_custom_300', vec2(360, 50), { customHp: 300 });
      expect(boss300.maxHealth).toBe(300);
      expect(boss300.health).toBe(300);

      // 300 * 0.65 = 195 HP threshold
      boss300.takeDamage(1000);
      expect(boss300.health).toBe(195);
      expect(boss300.phase).toBe('PHASE_2_LASER_SWEEP');

      // 300 * 0.30 = 90 HP threshold
      boss300.takeDamage(1000);
      expect(boss300.health).toBe(90);
      expect(boss300.phase).toBe('PHASE_3_MELTDOWN');
    });

    it('proves dynamic percentage formula works correctly for customHp = 500 (thresholds 325 and 150)', () => {
      const boss500 = new TetsuyukiBoss('boss_custom_500', vec2(360, 50), { customHp: 500 });
      expect(boss500.maxHealth).toBe(500);
      expect(boss500.health).toBe(500);

      // 500 * 0.65 = 325 HP threshold
      boss500.takeDamage(1000);
      expect(boss500.health).toBe(325);
      expect(boss500.phase).toBe('PHASE_2_LASER_SWEEP');

      // 500 * 0.30 = 150 HP threshold
      boss500.takeDamage(1000);
      expect(boss500.health).toBe(150);
      expect(boss500.phase).toBe('PHASE_3_MELTDOWN');
    });
  });
});
