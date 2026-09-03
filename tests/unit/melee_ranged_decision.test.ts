import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlayerKinematics, PlayerActionState, PlayerInputSnapshot } from '../../src/core/player/PlayerKinematics';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { vec2 } from '../../src/core/math/Vector2D';

function makeInput(overrides: Partial<PlayerInputSnapshot> = {}): PlayerInputSnapshot {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpPressed: false,
    jumpHeld: false,
    shootPressed: false,
    shootHeld: false,
    grenadePressed: false,
    ...overrides,
  };
}

describe('Melee vs Ranged Combat Decision Matrix Suite', () => {
  let engine: GameEngine;
  let player: PlayerController;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    player = new PlayerController(vec2(100, 200));
    player.facing = 1; // Facing right
    engine.addEntity(player);
    engine.tick();
  });

  describe('Melee Scan Reach Box Geometry', () => {
    it('should construct scan reach box with 38px forward reach, 6px rear tolerance, and [-34, +10]px vertical bounds', () => {
      // Facing right (1) at anchor (100, 200)
      const rightBox = PlayerKinematics.getMeleeScanBox(100, 200, 1);
      expect(rightBox.x).toBe(94); // 100 - 6 (rear reach)
      expect(rightBox.width).toBeCloseTo(44.05, 2); // 38.05 + 6
      expect(rightBox.y).toBe(166); // 200 - 34
      expect(rightBox.height).toBe(44); // 34 + 10

      // Facing left (-1) at anchor (100, 200)
      const leftBox = PlayerKinematics.getMeleeScanBox(100, 200, -1);
      expect(leftBox.x).toBeCloseTo(61.95, 2); // 100 - 38.05
      expect(leftBox.width).toBeCloseTo(44.05, 2);
      expect(leftBox.y).toBe(166);
      expect(leftBox.height).toBe(44);
    });
  });

  describe('Melee Triggering Within Distance Threshold (<= 38px)', () => {
    it('should trigger knife slash and SUPPRESS ranged projectile when living infantry is within melee reach', () => {
      // Soldier standing in front of player within reach: x = 120 (distance = 20px <= 38px)
      const soldier = SoldierEnemy.createRifleman('rebel_rifle_melee', { x: 120, y: 162 });
      engine.addEntity(soldier);
      engine.tick();

      const knifeStartSpy = vi.fn();
      engine.eventBus.on('knife_slash_started', knifeStartSpy);

      // Player presses shoot button
      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife slash state activated
      expect(player.isAttackingMelee).toBe(true);
      expect(player.actionState).toBe(PlayerActionState.MELEE_SLASH);
      expect(knifeStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          facing: 1,
        })
      );

      // Verify projectile firing is SUPPRESSED: exactly 0 projectiles spawned
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(0);
    });

    it('should inflict 3.0 HP knife damage on active frames 5-9, killing infantry and awarding 500 score points', () => {
      const soldier = SoldierEnemy.createRifleman('rebel_target', { x: 120, y: 162 });
      engine.addEntity(soldier);
      engine.tick();

      expect(soldier.health).toBe(1);
      expect(soldier.isAlive).toBe(true);
      const initialScore = player.score;

      // Initiate melee slash on frame 0
      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();
      expect(player.isAttackingMelee).toBe(true);

      // Advance frames 1 to 4 (pre-active frames: knife windup)
      for (let f = 1; f < 5; f++) {
        player.handleInput(makeInput(), 1 / 60, engine);
        engine.tick();
      }
      expect(soldier.isAlive).toBe(true); // Still alive before frame 5

      // Advance to frame 5 (active damage window start)
      player.handleInput(makeInput(), 1 / 60, engine);
      engine.tick();

      // Damage (3.0 HP) must have been delivered to soldier
      expect(soldier.health).toBe(0);
      expect(soldier.isAlive).toBe(false);
      expect(soldier.state).toBe('DEAD');

      // 500 bonus points awarded for melee kill
      expect(player.score).toBe(initialScore + 500);

      // Advance through remainder of 18-frame melee animation
      for (let f = 6; f <= 18; f++) {
        player.handleInput(makeInput(), 1 / 60, engine);
        engine.tick();
      }
      expect(player.isAttackingMelee).toBe(false);
      expect(player.actionState).toBe(PlayerActionState.IDLE);
    });
  });

  describe('Ranged Weapon Triggering Outside Melee Reach (> 38px)', () => {
    it('should fire ranged projectile and NOT trigger knife slash when enemy is beyond 38px distance', () => {
      // Soldier standing 70px away at x = 170 (beyond 38px reach)
      const farSoldier = SoldierEnemy.createRifleman('far_soldier', { x: 170, y: 162 });
      engine.addEntity(farSoldier);
      engine.tick();

      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife slash must NOT be triggered
      expect(player.isAttackingMelee).toBe(false);
      expect(player.actionState).not.toBe(PlayerActionState.MELEE_SLASH);

      // Ranged projectile MUST be spawned
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
      expect((projectiles[0] as any).weaponType).toBe('PISTOL');
    });

    it('should fire ranged projectile when enemy in range is already dead (isAlive: false)', () => {
      // Dead soldier in melee proximity
      const deadSoldier = SoldierEnemy.createRifleman('dead_soldier', { x: 120, y: 162 });
      deadSoldier.health = 0;
      deadSoldier.isAlive = false;
      engine.addEntity(deadSoldier);
      engine.tick();

      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife ignored on dead enemy -> ranged shot executed
      expect(player.isAttackingMelee).toBe(false);
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
    });
  });

  describe('Armored Entities Rejection of Melee Knife (Point-Blank Range)', () => {
    it('should reject knife attacks on Mid-Boss vehicle (isMeleeVulnerable: false) and fire projectile instead', () => {
      // Place Mid-Boss vehicle right next to player at point-blank range
      const midboss = new MidBossVehicle('midboss_close', { x: 115, y: 150 });
      expect(midboss.isMeleeVulnerable).toBe(false);
      engine.addEntity(midboss);
      engine.tick();

      // Shoot pressed at point-blank range
      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife slash MUST be rejected
      expect(player.isAttackingMelee).toBe(false);

      // Projectile MUST be fired into the vehicle
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
      expect((projectiles[0] as any).weaponType).toBe('PISTOL');
    });

    it('should reject knife attacks on Tetsuyuki Boss at point-blank range and fire projectile instead', () => {
      const boss = new TetsuyukiBoss('tetsuyuki_close', { x: 110, y: 100 });
      // Armored boss fortress rejects knife attacks
      (boss as any).isMeleeVulnerable = false;
      engine.addEntity(boss);
      engine.tick();

      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife slash MUST be rejected
      expect(player.isAttackingMelee).toBe(false);

      // Projectile MUST be fired
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
    });
  });
});
