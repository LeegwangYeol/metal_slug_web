import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlayerActionState, AimAngle } from '../../src/core/player/PlayerKinematics';
import { Platform } from '../../src/core/physics/Platform';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { FullMetalSlugGame } from '../../src/main';
import { EnemyBullet } from '../../src/core/entities/enemies/SoldierEnemy';

describe('CHALLENGER_M3: Adversarial State Machine & Edge Case Stress Suite', () => {
  let engine: GameEngine;
  let player: PlayerController;

  beforeEach(() => {
    engine = new GameEngine();
    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);
  });

  // =========================================================================
  // TASK 1: Lethal Damage Invariants & State Machine Integrity (DYING & RESPAWN)
  // =========================================================================
  describe('Task 1: Lethal Damage Edge Cases & State Invariants', () => {
    it('EMPIRICAL 1A: Taking lethal damage while in DYING state is strictly rejected and does not decrement lives or alter arc', () => {
      player.facing = 1;
      player.lives = 2;
      player.health = 1.0;

      // Initial lethal damage
      player.takeDamage(10.0, engine);
      expect(player.actionState).toBe(PlayerActionState.DYING);
      expect(player.lives).toBe(1);
      expect(player.health).toBe(0);
      expect(player.deathTimer).toBe(PlayerController.DEATH_DURATION);
      expect(player.velocity.y).toBe(-260);
      expect(player.velocity.x).toBe(-80);

      // Repeatedly deliver massive lethal damage while in DYING
      for (let i = 0; i < 10; i++) {
        player.takeDamage(9999.0, engine);
      }

      // Assert invariants
      expect(player.actionState).toBe(PlayerActionState.DYING);
      expect(player.lives).toBe(1); // Must NOT decrement lives again
      expect(player.health).toBe(0);
      expect(player.deathTimer).toBe(PlayerController.DEATH_DURATION); // Must NOT reset timer
      expect(player.velocity.y).toBe(-260); // Must NOT re-apply knockback impulse
      expect(player.velocity.x).toBe(-80);
    });

    it('EMPIRICAL 1B: Enemy bullet collision during DYING state is rejected and does not double-kill', () => {
      player.lives = 2;
      player.takeDamage(10.0, engine);
      expect(player.actionState).toBe(PlayerActionState.DYING);
      expect(player.lives).toBe(1);

      // Force invulnerabilityTimer to 0 to test actionState-level immunity
      player.invulnerabilityTimer = 0;

      const bullet = new EnemyBullet('test_bullet', vec2(player.position.x, player.position.y), vec2(-1, 0), 10.0);
      player.onCollision(bullet, engine);

      expect(player.lives).toBe(1);
      expect(player.actionState).toBe(PlayerActionState.DYING);
    });

    it('EMPIRICAL 1C: Parachute respawn initial invulnerability prevents damage at t < 2.5s', () => {
      player.lives = 2;
      player.startParachuteRespawn(150, 20);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.invulnerabilityTimer).toBe(2.5);

      // Advance 1.0s (60 frames)
      for (let i = 0; i < 60; i++) {
        player.update(1 / 60, engine);
      }
      expect(player.invulnerabilityTimer).toBeCloseTo(1.5, 2);

      // Attempt to deal damage
      player.takeDamage(10.0, engine);

      // Invariants maintained
      expect(player.lives).toBe(2);
      expect(player.health).toBe(player.maxHealth);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isParachuting).toBe(true);
    });

    it('EMPIRICAL 1D (ADVERSARIAL PROBE): Parachute descent beyond 2.5s window vs damage vulnerability', () => {
      // Screen top entry at Y=20, descent speed = 60 px/s, ground at Y=230.
      // Total descent time to ground = (230 - 20) / 60 = 3.5s.
      // After 2.5s (150 frames), invulnerabilityTimer expires to 0.
      player.lives = 2;
      player.startParachuteRespawn(150, 20);

      // Advance 2.6s (156 frames)
      for (let i = 0; i < 156; i++) {
        player.update(1 / 60, engine);
      }

      // Player is at Y = 20 + 60 * 2.6 = 176px (still in mid-air above Y=230)
      expect(player.position.y).toBeCloseTo(176, 1);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.invulnerabilityTimer).toBe(0);

      // Probe: If damage is dealt at t=2.6s while in RESPAWNING_PARACHUTE
      player.takeDamage(10.0, engine);

      // Check whether state machine handles this cleanly or exposes vulnerability/broken flags:
      console.log('[PROBE 1D RESULT] actionState after damage during descent:', player.actionState);
      console.log('[PROBE 1D RESULT] lives after damage:', player.lives);
      console.log('[PROBE 1D RESULT] isParachuting flag:', player.isParachuting);

      // If damage was absorbed, actionState should still be RESPAWNING_PARACHUTE.
      // If damage was accepted, player transitioned to DYING.
      // Check for state corruption: lives must never be negative.
      expect(player.lives).toBeGreaterThanOrEqual(0);
    });

    it('EMPIRICAL 1F: Parachute invulnerability protects player during descent, rejecting damage and preserving lives', () => {
      // Taking damage while in RESPAWNING_PARACHUTE is cleanly rejected even if invulnerabilityTimer is 0
      const p1 = new PlayerController();
      p1.lives = 2;
      p1.startParachuteRespawn(100, 20);
      p1.invulnerabilityTimer = 0; // Even if timer reached 0 during descent
      p1.takeDamage(10.0, engine);

      // Damage rejected: player remains in RESPAWNING_PARACHUTE with full health and intact lives
      expect(p1.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(p1.health).toBe(p1.maxHealth);
      expect(p1.lives).toBe(2);
      expect(p1.isParachuting).toBe(true);

      // Taking damage in RESPAWNING_PARACHUTE when lives is 0 preserves lives >= 0 and rejects damage
      const p2 = new PlayerController();
      p2.lives = 0;
      p2.startParachuteRespawn(100, 20);
      p2.invulnerabilityTimer = 0;
      p2.takeDamage(10.0, engine);
      expect(p2.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(p2.health).toBe(p2.maxHealth);
      expect(p2.lives).toBe(0);
      expect(p2.isParachuting).toBe(true);
    });

    it('EMPIRICAL 1E: Life invariant — player.lives never drops below zero under pathological zero-life damage', () => {
      player.lives = 0;
      player.actionState = PlayerActionState.CONTINUE_COUNTDOWN;

      player.takeDamage(10.0, engine);
      expect(player.lives).toBe(0);

      player.actionState = PlayerActionState.DEAD;
      player.isAlive = false;
      player.takeDamage(10.0, engine);
      expect(player.lives).toBe(0);

      player.actionState = PlayerActionState.DYING;
      player.takeDamage(10.0, engine);
      expect(player.lives).toBe(0);
    });
  });

  // =========================================================================
  // TASK 2: Continue Countdown Boundary Conditions (0.1s, 5.0s, 9.9s vs 10.0s)
  // =========================================================================
  describe('Task 2: Continue Countdown Boundary Conditions', () => {
    it('EMPIRICAL 2A: Continuing at t = 0.1s (9.9s remaining) via Fire input restores 3 lives and parachute drops', () => {
      player.lives = 0;
      player.startContinueCountdown();
      expect(player.continueTimer).toBe(10.0);

      // Advance 0.1s (6 frames)
      for (let i = 0; i < 6; i++) {
        player.update(1 / 60, engine);
      }
      expect(player.continueTimer).toBeCloseTo(9.9, 1);
      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);

      // Press Fire (J/Z)
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: true, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      expect(player.lives).toBe(3);
      expect(player.health).toBe(player.maxHealth);
      expect(player.isContinueActive).toBe(false);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.position.y).toBe(20);
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');
    });

    it('EMPIRICAL 2B: Continuing at t = 5.0s (5.0s remaining) via Jump input restores 3 lives and parachute drops', () => {
      player.lives = 0;
      player.startContinueCountdown();

      // Advance 5.0s (300 frames)
      for (let i = 0; i < 300; i++) {
        player.update(1 / 60, engine);
      }
      expect(player.continueTimer).toBeCloseTo(5.0, 1);
      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);

      // Press Jump (K/X/Space)
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: true, jumpHeld: false,
          shootPressed: false, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      expect(player.lives).toBe(3);
      expect(player.isContinueActive).toBe(false);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
    });

    it('EMPIRICAL 2C: Continuing at t = 9.9s (0.1s remaining) via Fire input restores 3 lives and parachute drops', () => {
      player.lives = 0;
      player.startContinueCountdown();

      // Advance 9.9s (594 frames)
      for (let i = 0; i < 594; i++) {
        player.update(1 / 60, engine);
      }
      expect(player.continueTimer).toBeCloseTo(0.1, 1);
      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);

      // Press Fire at the very last moment
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: true, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      expect(player.lives).toBe(3);
      expect(player.isContinueActive).toBe(false);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
    });

    it('EMPIRICAL 2D: Expiry at t >= 10.0s transitions unconditionally to DEAD with no resurrection possible', () => {
      player.lives = 0;
      player.startContinueCountdown();

      // Advance past 10.0s (601 frames = 10.016s)
      for (let i = 0; i < 601; i++) {
        player.update(1 / 60, engine);
      }

      expect(player.continueTimer).toBe(0);
      expect(player.actionState).toBe(PlayerActionState.DEAD);
      expect(player.isAlive).toBe(false);
      expect(player.isContinueActive).toBe(false);

      // Attempt to press Fire and Jump after expiry
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: true, jumpHeld: true,
          shootPressed: true, shootHeld: true,
          grenadePressed: true,
        },
        1 / 60,
        engine
      );

      // Must remain strictly DEAD
      expect(player.actionState).toBe(PlayerActionState.DEAD);
      expect(player.isAlive).toBe(false);
      expect(player.lives).toBe(0);
    });
  });

  // =========================================================================
  // TASK 3: Parachute Touchdown Resolution on Elevated Platforms vs Ground
  // =========================================================================
  describe('Task 3: Parachute Touchdown Resolution on Elevated Platforms vs Ground', () => {
    it('EMPIRICAL 3A: Lands cleanly on elevated platform at Y = 125 without clipping through to ground', () => {
      const plat125: Platform = {
        id: 'plat_tower_125',
        bounds: createAABB(100, 125, 200, 16),
        type: 'SEMI_SOLID',
      };
      engine.addPlatform(plat125);

      player.startParachuteRespawn(150, 20);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);

      // Drop until touchdown (from Y=20 to Y=125 is 105px at 60px/s => ~1.75s = 105 frames)
      let landed = false;
      for (let frame = 0; frame < 150; frame++) {
        player.update(1 / 60, engine);
        if (player.actionState === PlayerActionState.IDLE) {
          landed = true;
          break;
        }
      }

      expect(landed).toBe(true);
      expect(player.position.y).toBe(125); // Exactly at platform Y=125
      expect(player.isGrounded).toBe(true);
      expect(player.isParachuting).toBe(false);
      expect(player.velocity.y).toBe(0);
      expect(player.invulnerabilityTimer).toBe(2.5); // 2.5s post-landing invulnerability
    });

    it('EMPIRICAL 3B: Lands cleanly on elevated platform at Y = 175 without clipping through to ground', () => {
      const plat175: Platform = {
        id: 'plat_catwalk_175',
        bounds: createAABB(100, 175, 200, 16),
        type: 'SEMI_SOLID',
      };
      engine.addPlatform(plat175);

      player.startParachuteRespawn(150, 20);

      let landed = false;
      for (let frame = 0; frame < 200; frame++) {
        player.update(1 / 60, engine);
        if (player.actionState === PlayerActionState.IDLE) {
          landed = true;
          break;
        }
      }

      expect(landed).toBe(true);
      expect(player.position.y).toBe(175); // Exactly at platform Y=175
      expect(player.isGrounded).toBe(true);
      expect(player.isParachuting).toBe(false);
      expect(player.invulnerabilityTimer).toBe(2.5);
    });

    it('EMPIRICAL 3C: Lands cleanly on upper platform when two platforms are vertically stacked (Y=125 over Y=175)', () => {
      const platTop: Platform = {
        id: 'plat_top_125',
        bounds: createAABB(100, 125, 200, 16),
        type: 'SEMI_SOLID',
      };
      const platBottom: Platform = {
        id: 'plat_bottom_175',
        bounds: createAABB(100, 175, 200, 16),
        type: 'SEMI_SOLID',
      };
      engine.addPlatform(platTop);
      engine.addPlatform(platBottom);

      player.startParachuteRespawn(150, 20);

      for (let frame = 0; frame < 150; frame++) {
        player.update(1 / 60, engine);
        if (player.actionState === PlayerActionState.IDLE) {
          break;
        }
      }

      expect(player.position.y).toBe(125); // Caught by upper platform Y=125, NOT penetrated to Y=175
      expect(player.isGrounded).toBe(true);
      expect(player.isParachuting).toBe(false);
    });

    it('EMPIRICAL 3D: Lands on ground Y = 230 when no elevated platforms are present', () => {
      player.startParachuteRespawn(500, 20); // No platforms at X=500

      for (let frame = 0; frame < 250; frame++) {
        player.update(1 / 60, engine);
        if (player.actionState === PlayerActionState.IDLE) {
          break;
        }
      }

      expect(player.position.y).toBe(230);
      expect(player.isGrounded).toBe(true);
      expect(player.isParachuting).toBe(false);
      expect(player.invulnerabilityTimer).toBe(2.5);
    });
  });

  // =========================================================================
  // TASK 4: Mid-Air Parachute Steering & Weapons Firing
  // =========================================================================
  describe('Task 4: Mid-Air Parachute Steering & Weapons Firing', () => {
    it('EMPIRICAL 4A: Player can steer horizontally with vx = ±40 during descent', () => {
      player.startParachuteRespawn(200, 50);

      // Steer Right
      player.handleInput(
        {
          left: false, right: true, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: false, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );
      expect(player.velocity.x).toBe(40);
      expect(player.facing).toBe(1);

      // Steer Left
      player.handleInput(
        {
          left: true, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: false, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );
      expect(player.velocity.x).toBe(-40);
      expect(player.facing).toBe(-1);

      // Neutral steering
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: false, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );
      expect(player.velocity.x).toBe(0);
    });

    it('EMPIRICAL 4B: Player can fire bullets and throw grenades mid-air while parachute remains attached', () => {
      player.startParachuteRespawn(200, 50);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isParachuting).toBe(true);

      const entityCountBefore = engine.getAllEntities().length;

      // Fire pistol while descending
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: true, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      // Update engine to flush entity additions
      engine.tick(1 / 60);

      const entityCountAfterShoot = engine.getAllEntities().length;
      expect(entityCountAfterShoot).toBeGreaterThan(entityCountBefore); // Bullet added
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE); // Parachute state preserved
      expect(player.isParachuting).toBe(true); // Canopy remains attached

      // Throw grenade while descending
      const grenadesBefore = player.weaponManager.getGrenadeCount();
      player.handleInput(
        {
          left: false, right: false, up: false, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: false, shootHeld: false,
          grenadePressed: true,
        },
        1 / 60,
        engine
      );
      engine.tick(1 / 60);

      expect(player.weaponManager.getGrenadeCount()).toBe(grenadesBefore - 1);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isParachuting).toBe(true);
    });

    it('EMPIRICAL 4C: Aiming UP during parachute descent angles fire upward while descending', () => {
      player.startParachuteRespawn(200, 50);

      player.handleInput(
        {
          left: false, right: false, up: true, down: false,
          jumpPressed: false, jumpHeld: false,
          shootPressed: true, shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      expect(player.aimAngle).toBe(AimAngle.UP);
      expect(player.aimDirection.x).toBe(0);
      expect(player.aimDirection.y).toBe(-1);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isParachuting).toBe(true);
    });

    it('EMPIRICAL 4D: In FullMetalSlugGame, parachute render state resolves to "parachute" with isParachuting true even while shooting', () => {
      const game = new FullMetalSlugGame();
      const p = game.player;
      p.startParachuteRespawn(200, 50);

      const input = {
        left: false, right: true, up: false, down: false,
        jumpPressed: false, jumpHeld: false,
        shootPressed: true, shootHeld: true,
        grenadePressed: false,
      };
      (game as any).lastInputSnapshot = input;
      p.handleInput(input, 1 / 60, game.engine);

      const renderScene = (game as any).buildRenderSceneState();
      expect(renderScene.player.state).toBe('parachute');
      expect(renderScene.player.isParachuting).toBe(true);
      expect(renderScene.player.isFiring).toBe(true);
    });
  });
});
