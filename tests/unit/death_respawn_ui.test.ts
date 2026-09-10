import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlayerActionState, PlayerPosture } from '../../src/core/player/PlayerKinematics';
import { KeyboardController } from '../../src/input/KeyboardController';
import { FullMetalSlugGame } from '../../src/main';
import { HUDOverlay } from '../../src/ui/HUDOverlay';
import { CanvasRenderer } from '../../src/render/CanvasRenderer';
import { vec2 } from '../../src/core/math/Vector2D';
import { WeaponType } from '../../src/core/weapons/WeaponTypes';

describe('M3: Death Sequence, Parachute Respawn, Continue Countdown & Tutorial UI', () => {
  let engine: GameEngine;
  let player: PlayerController;

  beforeEach(() => {
    engine = new GameEngine();
    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);
  });

  // =========================================================================
  // 1. AUTHENTIC PLAYER DEATH SEQUENCE
  // =========================================================================
  describe('1. Authentic Player Death Sequence', () => {
    it('should transition to DYING with authentic knockback arc upon lethal damage', () => {
      player.facing = 1; // Facing right
      player.lives = 3;
      player.health = 1.0;

      // Deliver lethal damage
      player.takeDamage(10.0, engine);

      expect(player.health).toBe(0);
      expect(player.lives).toBe(2);
      expect(player.actionState).toBe(PlayerActionState.DYING);
      expect(player.deathTimer).toBe(PlayerController.DEATH_DURATION); // Exactly 1.2s
      expect(player.invulnerabilityTimer).toBe(2.0);

      // Knockback arc physics: vy = -260 (upward impulse), vx = -80 * facing (recoil backward)
      expect(player.velocity.y).toBe(-260);
      expect(player.velocity.x).toBe(-80);
      expect(player.posture).toBe(PlayerPosture.AIRBORNE);
    });

    it('should knock back to the right when facing left', () => {
      player.facing = -1; // Facing left
      player.takeDamage(10.0, engine);

      expect(player.velocity.x).toBe(80); // Recoils backward (positive X)
      expect(player.velocity.y).toBe(-260);
    });

    it('should lock input controls during DYING state', () => {
      player.takeDamage(10.0, engine);
      expect(player.actionState).toBe(PlayerActionState.DYING);

      const vxBefore = player.velocity.x;
      const vyBefore = player.velocity.y;

      // Attempt to move, jump, shoot, and throw grenades
      player.handleInput(
        {
          left: false,
          right: true,
          up: false,
          down: false,
          jumpPressed: true,
          jumpHeld: true,
          shootPressed: true,
          shootHeld: true,
          grenadePressed: true,
        },
        1 / 60,
        engine
      );

      // Input must be strictly ignored; velocity remains untouched by input
      expect(player.velocity.x).toBe(vxBefore);
      expect(player.velocity.y).toBe(vyBefore);
      expect(player.actionState).toBe(PlayerActionState.DYING);
    });

    it('should integrate gravity and simulate ground sprawl friction during death arc', () => {
      player.takeDamage(10.0, engine);
      expect(player.velocity.y).toBe(-260);

      // Advance physics simulation through the arc until landing on ground (Y = 230)
      // Knockback arc takes ~50-60 ticks (0.83-1.0s) to apex and fall to Y=230
      for (let i = 0; i < 60; i++) {
        player.update(1 / 60, engine);
      }

      // Player lands on ground, ground friction dampens horizontal recoil
      expect(player.position.y).toBe(230);
      expect(player.isGrounded).toBe(true);
      expect(Math.abs(player.velocity.x)).toBeLessThan(80);
    });
  });

  // =========================================================================
  // 2. TACTICAL PARACHUTE RESPAWN LOOP
  // =========================================================================
  describe('2. Tactical Parachute Respawn Loop', () => {
    it('should transition from DYING to RESPAWNING_PARACHUTE when lives > 0', () => {
      player.lives = 2; // Has remaining life after death
      player.takeDamage(10.0, engine);
      expect(player.lives).toBe(1);

      // Advance through death duration until transition to RESPAWNING_PARACHUTE
      while (player.actionState === PlayerActionState.DYING) {
        player.update(1 / 60, engine);
      }

      // Must now be in parachute respawn state
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isParachuting).toBe(true);
      expect(player.position.y).toBe(20); // Screen top entry
      expect(player.velocity.y).toBe(PlayerController.PARACHUTE_DESCENT_SPEED); // 60 px/s
      expect(player.health).toBe(player.maxHealth);
    });

    it('should allow lateral steering and aiming/shooting during parachute descent', () => {
      player.startParachuteRespawn(150, 20);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);

      // Steer right
      player.handleInput(
        {
          left: false,
          right: true,
          up: false,
          down: false,
          jumpPressed: false,
          jumpHeld: false,
          shootPressed: false,
          shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );
      expect(player.velocity.x).toBe(40);
      expect(player.facing).toBe(1);

      // Steer left
      player.handleInput(
        {
          left: true,
          right: false,
          up: false,
          down: false,
          jumpPressed: false,
          jumpHeld: false,
          shootPressed: false,
          shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );
      expect(player.velocity.x).toBe(-40);
      expect(player.facing).toBe(-1);
    });

    it('should touchdown on ground, transition to IDLE, and grant 2.5s invulnerability', () => {
      player.startParachuteRespawn(200, 228); // 2px above ground line (230)
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);

      // Advance physics until landing on ground (Y = 230)
      player.update(1 / 60, engine);
      player.update(1 / 60, engine);

      expect(player.position.y).toBe(230);
      expect(player.actionState).toBe(PlayerActionState.IDLE);
      expect(player.isGrounded).toBe(true);
      expect(player.isParachuting).toBe(false);
      expect(player.invulnerabilityTimer).toBe(2.5); // 2.5s post-landing invulnerability
    });
  });

  // =========================================================================
  // 3. CLASSIC ARCADE CONTINUE COUNTDOWN
  // =========================================================================
  describe('3. Classic Arcade Continue Countdown', () => {
    it('should enter CONTINUE_COUNTDOWN when last life is depleted', () => {
      player.lives = 1; // Last life
      player.takeDamage(10.0, engine);

      expect(player.lives).toBe(0);
      expect(player.actionState).toBe(PlayerActionState.DYING);

      // Advance through death duration until transition
      while (player.actionState === PlayerActionState.DYING) {
        player.update(1 / 60, engine);
      }

      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);
      expect(player.isContinueActive).toBe(true);
      expect(player.continueTimer).toBe(PlayerController.CONTINUE_DURATION); // Exactly 10.0s
    });

    it('should count down 10s timer towards zero', () => {
      player.startContinueCountdown();
      expect(player.continueTimer).toBe(10.0);

      player.update(1.0, engine);
      expect(player.continueTimer).toBeCloseTo(9.0, 2);

      player.update(2.5, engine);
      expect(player.continueTimer).toBeCloseTo(6.5, 2);
    });

    it('should continue game and reset lives to 3 when Fire or Jump is pressed', () => {
      player.lives = 0;
      player.startContinueCountdown();
      expect(player.isContinueActive).toBe(true);
      expect(player.lives).toBe(0);

      // Press Fire to continue
      player.handleInput(
        {
          left: false,
          right: false,
          up: false,
          down: false,
          jumpPressed: false,
          jumpHeld: false,
          shootPressed: true,
          shootHeld: false,
          grenadePressed: false,
        },
        1 / 60,
        engine
      );

      // Should have restored 3 lives, reset weapons, and launched parachute respawn
      expect(player.lives).toBe(3);
      expect(player.health).toBe(player.maxHealth);
      expect(player.isAlive).toBe(true);
      expect(player.isContinueActive).toBe(false);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.position.y).toBe(20);
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');
      expect(player.weaponManager.getGrenadeCount()).toBe(10);
    });

    it('should transition to final DEAD state when continue timer expires without input', () => {
      player.startContinueCountdown();
      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);

      // Advance past 10.0 seconds
      player.update(10.1, engine);

      expect(player.continueTimer).toBe(0);
      expect(player.actionState).toBe(PlayerActionState.DEAD);
      expect(player.isAlive).toBe(false);
      expect(player.isContinueActive).toBe(false);
    });
  });

  // =========================================================================
  // 4. ON-SCREEN TUTORIAL & KEYBOARD HELP CONTROLS
  // =========================================================================
  describe('4. On-Screen Tutorial & Keyboard Help Controls', () => {
    it('should have tutorial active by default and auto-dismiss after 5s', () => {
      const game = new FullMetalSlugGame();
      expect(game.showTutorial).toBe(true);
      expect(game.tutorialTimer).toBe(5.0);
      expect(game.tutorialAlpha).toBe(1.0);

      // Advance 4.5 seconds (in fade-out window < 1.0s)
      for (let i = 0; i < 270; i++) {
        game.step(1 / 60);
      }
      expect(game.tutorialTimer).toBeCloseTo(0.5, 1);
      expect(game.tutorialAlpha).toBeLessThan(1.0);

      // Advance past 5.0 seconds
      for (let i = 0; i < 40; i++) {
        game.step(1 / 60);
      }
      expect(game.showTutorial).toBe(false);
      expect(game.tutorialAlpha).toBe(0.0);
    });

    it('should allow toggling tutorial placard with toggleTutorial()', () => {
      const game = new FullMetalSlugGame();
      game.showTutorial = false;
      game.tutorialAlpha = 0.0;

      game.toggleTutorial();
      expect(game.showTutorial).toBe(true);
      expect(game.tutorialAlpha).toBe(1.0);
      expect(game.tutorialTimer).toBeGreaterThan(1000); // Pinned open

      game.toggleTutorial();
      expect(game.showTutorial).toBe(false);
      expect(game.tutorialAlpha).toBe(0.0);
    });

    it('should recognize KeyH in KeyboardController snapshot', () => {
      const keyboard = new KeyboardController();
      let snapshot = keyboard.getSnapshot();
      expect(snapshot.helpPressed).toBe(false);

      expect(keyboard.codeMap['KeyH']).toBe('help');

      (keyboard as any).handleKeyDown({ code: 'KeyH', key: 'h', preventDefault: () => {} } as any);
      snapshot = keyboard.getSnapshot();
      expect(snapshot.helpPressed).toBe(true);

      // Second snapshot consumes single-frame latch
      const nextSnapshot = keyboard.getSnapshot();
      expect(nextSnapshot.helpPressed).toBe(false);
    });
  });

  // =========================================================================
  // 5. HUD OVERLAY & RENDER INTEGRITY
  // =========================================================================
  describe('5. HUD Overlay & Canvas Render Integrity', () => {
    let hud: HUDOverlay;
    let mockCtx: any;

    beforeEach(() => {
      hud = new HUDOverlay();
      mockCtx = {
        canvas: { width: 960, height: 540 },
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        rect: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 40 }),
        drawImage: () => {},
        createLinearGradient: () => ({
          addColorStop: () => {},
        }),
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        globalAlpha: 1.0,
      };
    });

    it('should render standard HUD with metallic frame, cute Marco, and Ultimate stock without throwing', () => {
      expect(() => {
        hud.render(
          mockCtx,
          {
            score: 50000,
            lives: 3,
            weaponType: 'HEAVY_MACHINE_GUN' as WeaponType,
            ammo: 150,
            grenades: 8,
            hostagesRescued: 2,
            ultimateStock: 2,
            maxUltimateStock: 3,
            showTutorial: false,
            isContinueActive: false,
          },
          1.5
        );
      }).not.toThrow();
    });

    it('should render arcade tutorial placard cleanly without throwing', () => {
      expect(() => {
        hud.render(
          mockCtx,
          {
            score: 1000,
            lives: 3,
            weaponType: 'PISTOL' as WeaponType,
            ammo: Infinity,
            grenades: 10,
            hostagesRescued: 0,
            showTutorial: true,
            tutorialAlpha: 1.0,
          },
          0.5
        );
      }).not.toThrow();
    });

    it('should render continue countdown screen with 10s timer without throwing', () => {
      expect(() => {
        hud.render(
          mockCtx,
          {
            score: 0,
            lives: 0,
            weaponType: 'PISTOL' as WeaponType,
            ammo: Infinity,
            grenades: 0,
            hostagesRescued: 0,
            isContinueActive: true,
            continueCountdown: 8.5,
          },
          1.0
        );
      }).not.toThrow();
    });

    it('should render final game over screen without throwing', () => {
      expect(() => {
        hud.render(
          mockCtx,
          {
            score: 25000,
            lives: 0,
            weaponType: 'PISTOL' as WeaponType,
            ammo: 0,
            grenades: 0,
            hostagesRescued: 1,
            isGameOver: true,
            isContinueActive: false,
            continueCountdown: 0,
          },
          2.0
        );
      }).not.toThrow();
    });

    it('should resolve player parachute and death sprite keys in CanvasRenderer', () => {
      const renderer = new CanvasRenderer();
      expect(renderer.resolvePlayerSpriteKey({ state: 'parachute', facing: 1, x: 0, y: 0 }, 0)).toBe('player_jump_rise');
      expect(renderer.resolvePlayerSpriteKey({ state: 'death', animFrame: 0, facing: 1, x: 0, y: 0 }, 0)).toBe('player_death_0');
      expect(renderer.resolvePlayerSpriteKey({ state: 'death', animFrame: 1, facing: 1, x: 0, y: 0 }, 0)).toBe('player_death_1');
      expect(renderer.resolvePlayerSpriteKey({ state: 'death', animFrame: 2, facing: 1, x: 0, y: 0 }, 0)).toBe('player_death_2');
      expect(renderer.resolvePlayerSpriteKey({ state: 'death', animFrame: 3, facing: 1, x: 0, y: 0 }, 0)).toBe('player_death_3');
    });
  });
});
