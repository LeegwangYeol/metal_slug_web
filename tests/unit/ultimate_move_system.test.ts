import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { PlayerController } from '../../src/core/player/PlayerController';
import { KeyboardController } from '../../src/input/KeyboardController';
import { UltimateManager, UltimatePhase } from '../../src/core/player/UltimateManager';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { IronNokanaBoss } from '../../src/core/entities/boss/IronNokanaBoss';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { PowEntity, PowState } from '../../src/core/entities/pow/PowEntity';
import { StageManager } from '../../src/core/engine/StageManager';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { ProceduralSpriteFactory } from '../../src/render/sprites/ProceduralSpriteFactory';
import { SoundEngine } from '../../src/audio/SoundEngine';

describe('Milestone M3: Ultimate Move System & Procedural Sprites / FX', () => {
  let engine: GameEngine;
  let stageManager: StageManager;
  let player: PlayerController;
  let ultimateManager: UltimateManager;
  let keyboard: KeyboardController;

  const viewport = { x: 0, y: 0, width: 480, height: 270 };

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    stageManager = new StageManager(engine);
    (engine as any).cameraX = 0;

    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 220, 2000, 50),
    });

    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);

    ultimateManager = new UltimateManager({
      initialStock: 1,
      maxStock: 3,
      freezeDuration: 0.5,
      strikeDuration: 0.6,
      detonationDuration: 0.4,
      recoveryDuration: 0.3,
      bossDamage: 120,
    });
    keyboard = new KeyboardController();
  });

  // =========================================================================
  // SUITE 1: Dedicated KeyU Input & Stock / Cooldown Management
  // =========================================================================
  describe('1. Dedicated KeyU Input & Stock Management', () => {
    it('KeyboardController maps KeyU to ultimate action and edge-triggered snapshot', () => {
      expect(keyboard.codeMap['KeyU']).toBe('ultimate');

      (keyboard as any).handleKeyDown({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);
      expect(keyboard.ultimate).toBe(true);

      const snap = keyboard.getSnapshot();
      expect(snap.ultimatePressed).toBe(true);

      // Edge trigger resets on next frame
      const snap2 = keyboard.getSnapshot();
      expect(snap2.ultimatePressed).toBe(false);
    });

    it('KeyX remains bound to jump and does NOT trigger ultimate', () => {
      expect(keyboard.codeMap['KeyX']).toBe('jump');

      (keyboard as any).handleKeyDown({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.jumpPressed).toBe(true);
      expect(snap.ultimatePressed).toBe(false);
    });

    it('initializes with stock = 1 and phase = IDLE (READY)', () => {
      expect(ultimateManager.stock).toBe(1);
      expect(ultimateManager.phase).toBe(UltimatePhase.IDLE);
      expect(ultimateManager.phase).toBe(UltimatePhase.READY);
      expect(ultimateManager.canTrigger()).toBe(true);
      expect(ultimateManager.isSimulationFrozen).toBe(false);
    });

    it('triggers successfully with stock > 0, decrements stock, and transitions to FREEZE', () => {
      const activated = ultimateManager.trigger(engine);
      expect(activated).toBe(true);
      expect(ultimateManager.stock).toBe(0);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(ultimateManager.isSimulationFrozen).toBe(true);
    });

    it('fails to trigger when stock = 0', () => {
      ultimateManager.stock = 0;
      expect(ultimateManager.canTrigger()).toBe(false);

      const activated = ultimateManager.trigger(engine);
      expect(activated).toBe(false);
      expect(ultimateManager.phase).toBe(UltimatePhase.IDLE);
    });

    it('rejects re-triggering while an ultimate move is already active', () => {
      ultimateManager.stock = 2;
      ultimateManager.trigger(engine);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);

      // Attempt second trigger during active move
      const secondAttempt = ultimateManager.trigger(engine);
      expect(secondAttempt).toBe(false);
      expect(ultimateManager.stock).toBe(1); // stock not consumed
    });

    it('allows stock replenishment up to maxStock ceiling', () => {
      ultimateManager.stock = 1;
      ultimateManager.addStock(1);
      expect(ultimateManager.stock).toBe(2);

      ultimateManager.addStock(5); // Exceeds maxStock = 3
      expect(ultimateManager.stock).toBe(3);
    });

    it('PlayerController exposes triggerUltimateMove delegating to ultimateManager', () => {
      expect(player.ultimateManager.stock).toBe(1);
      const res = player.triggerUltimateMove(engine);
      expect(res).toBe(true);
      expect(player.ultimateManager.stock).toBe(0);
      expect(player.ultimateManager.phase).toBe(UltimatePhase.FREEZE);
    });

    it('PlayerController input loop executes ultimate move on ultimatePressed', () => {
      expect(player.ultimateManager.canTrigger()).toBe(true);

      const inputSnapshot = {
        left: false,
        right: false,
        up: false,
        down: false,
        jumpPressed: false,
        jumpHeld: false,
        shootPressed: false,
        shootHeld: false,
        grenadePressed: false,
        ultimatePressed: true,
      };

      player.handleInput(inputSnapshot, 1 / 60, engine);
      expect(player.ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(player.ultimateManager.stock).toBe(0);
    });
  });

  // =========================================================================
  // SUITE 2: 4-Phase State Progression Pipeline
  // =========================================================================
  describe('2. 4-Phase Cinematic Progression Pipeline', () => {
    it('progresses through Freeze -> Strike Pass -> Detonation -> Recovery -> Idle', () => {
      const events: string[] = [];
      engine.eventBus.on('ultimate_freeze_started', () => events.push('freeze'));
      engine.eventBus.on('ultimate_strike_pass', () => events.push('strike'));
      engine.eventBus.on('ultimate_detonation', () => events.push('detonation'));
      engine.eventBus.on('ultimate_completed', () => events.push('completed'));

      ultimateManager.trigger(engine);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(ultimateManager.isSimulationFrozen).toBe(true);

      // Step Phase 1 (Freeze, 0.5s = 30 ticks)
      for (let i = 0; i < 30; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.STRIKE_PASS);
      expect(events).toContain('freeze');
      expect(events).toContain('strike');

      // Step Phase 2 (Strike Pass, 0.6s = 36 ticks)
      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.flyoverProgress).toBeGreaterThan(0.4);
      expect(ultimateManager.flyoverProgress).toBeLessThan(0.6);

      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.DETONATION);
      expect(events).toContain('detonation');

      // Step Phase 3 (Detonation, 0.4s = 24 ticks)
      for (let i = 0; i < 24; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.RECOVERY);

      // Step Phase 4 (Recovery, 0.3s = 18 ticks)
      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.IDLE);
      expect(ultimateManager.isSimulationFrozen).toBe(false);
      expect(events).toContain('completed');
    });

    it('emits screen shake and camera shake on detonation phase', () => {
      let shakeEmitted = false;
      let shakeAmplitude = 0;
      engine.eventBus.on('screen_shake', (data: { amplitude: number }) => {
        shakeEmitted = true;
        shakeAmplitude = data.amplitude;
      });

      ultimateManager.trigger(engine);
      // Fast forward to detonation (0.5s + 0.6s = 66 ticks)
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(shakeEmitted).toBe(true);
      expect(shakeAmplitude).toBeGreaterThanOrEqual(15);
    });
  });

  // =========================================================================
  // SUITE 3: 100% On-Screen Minion Elimination
  // =========================================================================
  describe('3. 100% Elimination of On-Screen Minions', () => {
    it('wipes all standard infantry minions (Rifle, Knife, Grenade) in viewport', () => {
      const s1 = new SoldierEnemy('m_rifle', 'SOLDIER_RIFLE', vec2(150, 190));
      const s2 = new SoldierEnemy('m_knife', 'SOLDIER_KNIFE', vec2(250, 190));
      const s3 = new SoldierEnemy('m_grenade', 'SOLDIER_GRENADE', vec2(350, 190));
      engine.addEntity(s1);
      engine.addEntity(s2);
      engine.addEntity(s3);
      engine.tick(1 / 60);

      expect(s1.isAlive).toBe(true);
      expect(s2.isAlive).toBe(true);
      expect(s3.isAlive).toBe(true);

      ultimateManager.trigger(engine);
      // Fast forward through freeze and strike pass to detonation (66 ticks)
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(s1.isAlive).toBe(false);
      expect(s2.isAlive).toBe(false);
      expect(s3.isAlive).toBe(false);
      expect(s1.health).toBe(0);
      expect(s2.health).toBe(0);
      expect(s3.health).toBe(0);
    });

    it('wipes on-screen shield troopers even with frontal directional defense', () => {
      const shieldTrooper = new SoldierEnemy('m_shield', 'SOLDIER_SHIELD', vec2(280, 190));
      shieldTrooper.facing = -1; // Facing left toward player
      engine.addEntity(shieldTrooper);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(shieldTrooper.isAlive).toBe(false);
      expect(shieldTrooper.health).toBe(0);
    });

    it('vaporizes on-screen hostile enemy projectiles and removes them from engine', () => {
      const bullet: GameEntity = {
        id: 'hostile_bullet',
        type: 'ENEMY_BULLET',
        position: vec2(200, 150),
        velocity: vec2(-200, 0),
        bounds: createAABB(198, 148, 4, 4),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(bullet);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(bullet.isAlive).toBe(false);
      expect(engine.getAllEntities().some((e) => e.id === 'hostile_bullet')).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: 120 HP Burst Damage to Bosses & Health Gates
  // =========================================================================
  describe('4. 120 HP Burst Damage to Bosses', () => {
    it('deals 120 HP burst damage to on-screen Iron Nokana Boss and triggers Phase 2 gate', () => {
      const nokana = new IronNokanaBoss('boss_nokana', vec2(300, 100), {
        customHp: 400,
        patrolMinX: 100,
        patrolMaxX: 400,
      });
      engine.addEntity(nokana);
      engine.tick(1 / 60);

      expect(nokana.health).toBe(400);
      expect(nokana.phase).toBe('PHASE_1_CRAWLER_BARRAGE');

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // Iron Nokana has a 75% gate (300 HP). 400 - 120 = 280, clamped to 300 HP with Phase 2 transition
      expect(nokana.health).toBe(300);
      expect(nokana.phase).toBe('PHASE_2_FLAME_SWEEP');
      expect(nokana.isAlive).toBe(true); // NOT insta-killed
    });

    it('deals 120 HP burst damage to Tetsuyuki Boss', () => {
      const tetsuyuki = new TetsuyukiBoss('boss_tetsuyuki', vec2(250, 40));
      tetsuyuki.health = 400;
      tetsuyuki.maxHealth = 400;
      engine.addEntity(tetsuyuki);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // 400 - 120 = 280 HP
      expect(tetsuyuki.health).toBe(280);
      expect(tetsuyuki.isAlive).toBe(true);
    });

    it('deals 120 HP burst damage to MidBossVehicle and respects health', () => {
      const midboss = new MidBossVehicle('midboss_1', vec2(320, 160));
      midboss.health = 400;
      engine.addEntity(midboss);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // 400 - 120 = 280 HP
      expect(midboss.health).toBe(280);
      expect(midboss.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: Off-Screen Minion Preservation
  // =========================================================================
  describe('5. Off-Screen Minion Preservation (Spatial Frustum Safety)', () => {
    it('preserves minions strictly outside the active camera viewport', () => {
      // In-screen minion
      const insideSoldier = new SoldierEnemy('s_inside', 'SOLDIER_RIFLE', vec2(200, 190));
      // Off-screen right minion (cameraX=0, viewport width=480, spawn at x=600)
      const outsideRightSoldier = new SoldierEnemy('s_outside_right', 'SOLDIER_RIFLE', vec2(600, 190));
      // Off-screen left minion (behind camera, x=-100)
      const outsideLeftSoldier = new SoldierEnemy('s_outside_left', 'SOLDIER_RIFLE', vec2(-100, 190));

      engine.addEntity(insideSoldier);
      engine.addEntity(outsideRightSoldier);
      engine.addEntity(outsideLeftSoldier);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(insideSoldier.isAlive).toBe(false);
      expect(outsideRightSoldier.isAlive).toBe(true);
      expect(outsideRightSoldier.health).toBe(outsideRightSoldier.maxHealth);
      expect(outsideLeftSoldier.isAlive).toBe(true);
    });

    it('rigorously tests viewport boundary edges (x = 465 vs x = 520)', () => {
      const edgeInside = new SoldierEnemy('edge_in', 'SOLDIER_RIFLE', vec2(465, 190));
      const edgeOutside = new SoldierEnemy('edge_out', 'SOLDIER_RIFLE', vec2(520, 190));

      engine.addEntity(edgeInside);
      engine.addEntity(edgeOutside);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(edgeInside.isAlive).toBe(false);
      expect(edgeOutside.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 6: Zero Friendly Fire
  // =========================================================================
  describe('6. Zero Friendly Fire Against Player, Allies & POWs', () => {
    it('inflicts zero damage to player during detonation', () => {
      player.health = 1.0;
      player.shieldCharges = 2;

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(player.isAlive).toBe(true);
      expect(player.health).toBe(1.0);
      expect(player.shieldCharges).toBe(2);
    });

    it('inflicts zero damage to autonomous AllyNPC (Hyakutaro Ichimonji)', () => {
      const ally = new AllyNPC('ally_1', vec2(180, 200));
      engine.addEntity(ally);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(ally.isAlive).toBe(true);
    });

    it('does not destroy friendly ally projectiles (AllyKiBlast)', () => {
      const kiBlast = new AllyKiBlast('ki_1', vec2(220, 180), 1);
      engine.addEntity(kiBlast);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(kiBlast.isAlive).toBe(true);
    });

    it('does not harm or kill rescued / tied POWs in viewport', () => {
      const pow = new PowEntity('pow_1', vec2(200, 190), ItemDropType.WEAPON_SHOTGUN);
      engine.addEntity(pow);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(pow.isAlive).toBe(true);
      expect(pow.state).toBe(PowState.TIED_UP); // remains tied/rescuable
    });
  });

  // =========================================================================
  // SUITE 7: Preservation of 164 Baseline Sprite Key Invariant & Expansion Sprites
  // =========================================================================
  describe('7. Preservation of 164 Baseline Sprite Key Invariant', () => {
    it('default getAllKeys() returns exactly 164 keys', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const keys = factory.getAllKeys();
      expect(keys.length).toBe(164);
    });

    it('expansion sprite keys are isolated and returned only when includeExpansion is true', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const baselineKeys = factory.getAllKeys(false, false);
      const allWithExpansion = factory.getAllKeys(false, true);

      expect(baselineKeys.length).toBe(164);
      expect(allWithExpansion.length).toBeGreaterThan(164);

      // Verify no duplicate keys across registry
      const uniqueSet = new Set(allWithExpansion);
      expect(uniqueSet.size).toBe(allWithExpansion.length);
    });

    it('expansion sprites (bomber, bomb, shockwave, hazards, items) are registered and queryable', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      expect(factory.hasSprite('tactical_bomber')).toBe(true);
      expect(factory.hasSprite('tactical_bomber_shadow')).toBe(true);
      expect(factory.hasSprite('air_bomb_falling_0')).toBe(true);
      expect(factory.hasSprite('shockwave_ring_0')).toBe(true);
      expect(factory.hasSprite('iron_nokana_hull')).toBe(true);
      expect(factory.hasSprite('hazard_reticle_artillery')).toBe(true);
      expect(factory.hasSprite('ally_hyakutaro_idle_0')).toBe(true);
      expect(factory.hasSprite('item_crate_shotgun')).toBe(true);
      expect(factory.hasSprite('player_shield_bubble')).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 8: Audio Engine Synthesis API Safety
  // =========================================================================
  describe('8. Procedural Audio Engine Method Verification', () => {
    it('SoundEngine exposes playUltimateSiren, playFlyoverRoar, and playApocalypticBlast safely', () => {
      const sound = new SoundEngine();
      expect(typeof sound.playUltimateSiren).toBe('function');
      expect(typeof sound.playFlyoverRoar).toBe('function');
      expect(typeof sound.playApocalypticBlast).toBe('function');

      // Safe execution in headless test environment (does not throw)
      expect(() => sound.playUltimateSiren()).not.toThrow();
      expect(() => sound.playFlyoverRoar()).not.toThrow();
      expect(() => sound.playApocalypticBlast()).not.toThrow();
    });
  });

  // =========================================================================
  // SUITE 9: StageManager Viewport Integration
  // =========================================================================
  describe('9. StageManager Viewport Integration', () => {
    it('exposes getCamera and getViewportBoundingBox with correct dimensions', () => {
      stageManager.update(150, 200);
      const cam = stageManager.getCamera();
      expect(cam).toEqual({
        x: 150,
        y: 0,
        width: 480,
        height: 270,
      });

      const bbox = stageManager.getViewportBoundingBox();
      expect(bbox).toEqual(createAABB(150, 0, 480, 270));
    });
  });
});
