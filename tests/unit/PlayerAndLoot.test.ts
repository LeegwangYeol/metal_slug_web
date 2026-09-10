import { describe, it, expect, beforeEach } from 'vitest';
import { Player, PlayerInputSnapshot } from '../../src/core/entities/Player';
import { LootManager, LootDropType } from '../../src/core/systems/LootManager';

describe('Player Kinematics & LootManager (Milestone 1 Top-Down Systems)', () => {
  let player: Player;
  let lootManager: LootManager;

  beforeEach(() => {
    player = new Player(0, 0, {
      maxHealth: 100,
      currentHealth: 100,
      healthRegen: 0,
      moveSpeed: 200,
      armor: 5,
      magnetRadius: 100,
    });
    player.arenaBounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
    lootManager = new LootManager(1500);
  });

  describe('Suite 1: 360-Degree Player Kinematics & Diagonal Normalization', () => {
    it('normalizes diagonal input so speed does not exceed maxSpeed', () => {
      const input: PlayerInputSnapshot = { up: true, down: false, left: false, right: true };

      // Simulate 1.0s of continuous acceleration (dt = 1/60)
      for (let i = 0; i < 60; i++) {
        player.handleInput(input, 1 / 60);
      }

      const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
      const expectedMax = player.stats.moveSpeed; // 200.0

      expect(currentSpeed).toBeCloseTo(expectedMax, 1);
      // Verify both components are equal
      expect(Math.abs(player.velocity.x)).toBeCloseTo(Math.abs(player.velocity.y), 1);
    });

    it('decelerates to a complete stop when input is released', () => {
      // Accelerate right for 10 frames
      for (let i = 0; i < 10; i++) {
        player.handleInput({ up: false, down: false, left: false, right: true }, 1 / 60);
      }
      expect(player.velocity.x).toBeGreaterThan(0);

      // Release input and step for 20 frames (2400 px/s² deceleration stops 200 px/s in ~5 frames)
      for (let i = 0; i < 20; i++) {
        player.handleInput({ up: false, down: false, left: false, right: false }, 1 / 60);
      }

      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);
    });

    it('strictly clamps player position inside arena boundaries', () => {
      player.position.x = 995;
      player.position.y = 995;
      player.velocity.x = 500;
      player.velocity.y = 500;

      player.update(1 / 60);

      const r = Player.COLLISION_RADIUS;
      expect(player.position.x).toBeLessThanOrEqual(1000 - r);
      expect(player.position.y).toBeLessThanOrEqual(1000 - r);
    });

    it('reduces damage via armor and activates 0.5s invulnerability window', () => {
      // Incoming damage = 20, armor = 5 -> effective damage = 15
      const dealt = player.takeDamage(20);
      expect(dealt).toBe(15);
      expect(player.stats.currentHealth).toBe(85);
      expect(player.invulnerabilityTimer).toBe(0.5);

      // Subsequent damage within invulnerability window is ignored
      const secondDealt = player.takeDamage(50);
      expect(secondDealt).toBe(0);
      expect(player.stats.currentHealth).toBe(85);

      // Step past invulnerability window
      player.update(0.6);
      expect(player.invulnerabilityTimer).toBe(0);

      // Next damage applies
      const thirdDealt = player.takeDamage(20);
      expect(thirdDealt).toBe(15);
      expect(player.stats.currentHealth).toBe(70);
    });
  });

  describe('Suite 2: LootManager Magnetism & Collection Mechanics', () => {
    it('spawns drop with initial scatter and respects pool capacity', () => {
      const drop = lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 50, 50, false);
      expect(drop).not.toBeNull();
      expect(drop!.isAlive).toBe(true);
      expect(drop!.xpValue).toBe(1);
      expect(lootManager.getActiveCount()).toBe(1);
    });

    it('attracts gems within magnet radius accelerating toward player', () => {
      // Place gem 80px away (player magnetRadius is 100px)
      const drop = lootManager.spawnDrop(LootDropType.RUBY_GEM, 80, 0, false);
      expect(drop).not.toBeNull();
      expect(drop!.isAttracted).toBe(false);

      // Step LootManager
      lootManager.update(1 / 60, player);

      expect(drop!.isAttracted).toBe(true);
      expect(drop!.currentSpeed).toBeGreaterThanOrEqual(LootManager.BASE_MAGNET_SPEED);
      expect(drop!.position.x).toBeLessThan(80); // Moved closer to player (0, 0)
    });

    it('collects gems within 18px radius and rewards player with XP', () => {
      const initialXP = player.currentXP;
      const initialLevel = player.level;

      // Place gem at (10, 0) which is < COLLECTION_RADIUS (18px)
      lootManager.spawnDrop(LootDropType.RUBY_GEM, 10, 0, false); // 5 XP
      expect(lootManager.getActiveCount()).toBe(1);

      lootManager.update(1 / 60, player);

      expect(lootManager.getActiveCount()).toBe(0); // Collected and recycled
      expect(player.currentXP).toBe(initialXP + 5);
      expect(player.level).toBe(initialLevel);
    });

    it('triggers map-wide vacuum when collecting Eldritch Magnet drop', () => {
      // Gem 1: Far away (500px) - well outside magnet radius
      const farGem = lootManager.spawnDrop(LootDropType.VIOLET_ABYSSAL, 500, 500, false);
      // Gem 2: Eldritch Magnet at player feet (5px)
      lootManager.spawnDrop(LootDropType.ELDRITCH_MAGNET, 5, 0, false);

      expect(farGem!.isAttracted).toBe(false);

      lootManager.update(1 / 60, player);

      // Eldritch magnet collected, triggering global vacuum
      expect(farGem!.isAttracted).toBe(true);
    });

    it('maintains zero memory leak by recycling 100% of collected items to pool', () => {
      for (let i = 0; i < 100; i++) {
        lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 5, 0, false);
      }
      expect(lootManager.getActiveCount()).toBe(100);

      lootManager.update(1 / 60, player);

      // All 100 drops collected within single frame
      expect(lootManager.getActiveCount()).toBe(0);
    });
  });
});
