import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { BulletProjectile } from '../../src/core/weapons/ProjectileManager';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { PowEntity, PowState, ItemPickupEntity } from '../../src/core/entities/pow/PowEntity';
import { vec2 } from '../../src/core/math/Vector2D';
import { PlayerInputSnapshot } from '../../src/core/player/PlayerKinematics';

function createBlankInput(): PlayerInputSnapshot {
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
  };
}

describe('Player Weapon State & Inventory Suite', () => {
  let engine: GameEngine;
  let player: PlayerController;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);
    engine.tick(); // Commit player to engine
  });

  describe('Initial Default Handgun State', () => {
    it('should initialize with default Handgun having infinite ammo and semi-auto behavior', () => {
      const state = player.getPlayerState();
      expect(state.currentWeapon.type).toBe('PISTOL');
      expect(state.currentWeapon.ammo).toBe(Infinity);
      expect(state.currentWeapon.maxAmmo).toBe(Infinity);
      expect(state.currentWeapon.isAutomatic).toBe(false);
      expect(state.currentWeapon.fireRate).toBeCloseTo(60 / 9, 2); // 9 frames = ~6.67 shots/s
      expect(state.grenadeCount).toBe(10);
    });

    it('should require fresh shootPressed input for semi-automatic Handgun', () => {
      const input = createBlankInput();
      input.shootPressed = false;
      input.shootHeld = true; // holding without press should not fire semi-auto

      player.handleInput(input, 1 / 60, engine);
      engine.tick();
      const bullets = engine.getAllEntities().filter((e) => e instanceof BulletProjectile);
      expect(bullets.length).toBe(0);

      // Fresh key press fires bullet
      input.shootPressed = true;
      player.handleInput(input, 1 / 60, engine);
      engine.tick();
      const bulletsAfter = engine.getAllEntities().filter((e) => e instanceof BulletProjectile);
      expect(bulletsAfter.length).toBe(1);
      expect(bulletsAfter[0].damage).toBe(1.0);
      expect(bulletsAfter[0].pierces).toBe(false);
    });

    it('should throttle on-screen handgun projectiles to maximum 4 concurrent bullets', () => {
      const input = createBlankInput();

      // Fire 4 distinct shots with simulated cooldown elapsed
      for (let i = 0; i < 4; i++) {
        input.shootPressed = true;
        player.handleInput(input, 1 / 60, engine);
        engine.tick();
        // Advance time past cooldown (9 frames = 0.15s)
        player.update(0.2, engine);
      }

      let activeBullets = engine
        .getAllEntities()
        .filter((e) => e instanceof BulletProjectile && e.isAlive && e.weaponType === 'PISTOL');
      expect(activeBullets.length).toBe(4);

      // Attempt to fire 5th shot while 4 bullets are active
      input.shootPressed = true;
      player.handleInput(input, 1 / 60, engine);
      engine.tick();

      activeBullets = engine
        .getAllEntities()
        .filter((e) => e instanceof BulletProjectile && e.isAlive && e.weaponType === 'PISTOL');
      expect(activeBullets.length).toBe(4); // Still 4: 5th bullet suppressed

      // Despawn one bullet
      activeBullets[0].isAlive = false;

      // 5th shot now allowed
      input.shootPressed = true;
      player.handleInput(input, 1 / 60, engine);
      engine.tick();

      const updatedBullets = engine
        .getAllEntities()
        .filter((e) => e instanceof BulletProjectile && e.isAlive && e.weaponType === 'PISTOL');
      expect(updatedBullets.length).toBe(4);
    });
  });

  describe('Heavy Machine Gun (HMG) Acquisition & Firing', () => {
    it('should upgrade to HMG with 200 rounds and automatic rapid fire rate', () => {
      const voiceHandler = vi.fn();
      engine.eventBus.on('play_voice', voiceHandler);

      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);

      const state = player.getPlayerState();
      expect(state.currentWeapon.type).toBe('HEAVY_MACHINE_GUN');
      expect(state.currentWeapon.ammo).toBe(200);
      expect(state.currentWeapon.maxAmmo).toBe(999);
      expect(state.currentWeapon.isAutomatic).toBe(true);
      expect(state.currentWeapon.fireRate).toBe(15); // 60 / 4 = 15 shots/s
      expect(voiceHandler).toHaveBeenCalledWith({ voice: 'voice_heavy_machine_gun' });
    });

    it('should fire continuously when shootHeld is true and decrement ammo', () => {
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;

      // First shot
      player.handleInput(input, 1 / 60, engine);
      expect(player.weaponManager.getAmmo()).toBe(199);

      // Cooldown in progress (4 frames = 4/60s)
      input.shootPressed = false;
      player.update(1 / 60, engine);
      player.handleInput(input, 1 / 60, engine);
      expect(player.weaponManager.getAmmo()).toBe(199); // Still on cooldown

      // Advance time by remaining cooldown (3 frames)
      player.update(3 / 60, engine);
      player.handleInput(input, 1 / 60, engine);
      expect(player.weaponManager.getAmmo()).toBe(198);
    });

    it('should stack ammo up to 999 when picking up additional HMG badges', () => {
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
      expect(player.weaponManager.getAmmo()).toBe(200);

      // Pick up another HMG badge (+200)
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
      expect(player.weaponManager.getAmmo()).toBe(400);

      // Add large ammo amount exceeding cap (999)
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 700, engine);
      expect(player.weaponManager.getAmmo()).toBe(999);
    });

    it('should eject brass casings on firing HMG', () => {
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;
      player.handleInput(input, 1 / 60, engine);

      const casings = player.weaponManager.projectileManager.getBrassCasings();
      expect(casings.length).toBe(1);
      expect(casings[0].velocity.y).toBeLessThan(0); // Upward eject
    });
  });

  describe('HMG Ammo Depletion & Seamless Fallback', () => {
    it('should seamlessly fallback to PISTOL when HMG ammo reaches 0', () => {
      const weaponChangeHandler = vi.fn();
      engine.eventBus.on('weapon_changed', weaponChangeHandler);

      // Set ammo to exactly 1 round
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 1, engine);
      expect(player.weaponManager.getAmmo()).toBe(1);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;

      // Fire the last round
      player.handleInput(input, 1 / 60, engine);

      // State should immediately revert to PISTOL
      const state = player.getPlayerState();
      expect(state.currentWeapon.type).toBe('PISTOL');
      expect(state.currentWeapon.ammo).toBe(Infinity);
      expect(state.currentWeapon.isAutomatic).toBe(false);

      expect(weaponChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          previousWeapon: 'HEAVY_MACHINE_GUN',
          currentWeapon: 'PISTOL',
          ammo: Infinity,
        })
      );
    });

    it('should preserve in-flight HMG bullets after fallback occurs', () => {
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 1, engine);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;
      player.handleInput(input, 1 / 60, engine);
      engine.tick();

      // Player reverted to PISTOL
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');

      // But in-flight HMG bullet is still alive and traveling
      const hmgBullets = engine
        .getAllEntities()
        .filter((e) => e instanceof BulletProjectile && e.weaponType === 'HEAVY_MACHINE_GUN');
      expect(hmgBullets.length).toBe(1);
      expect(hmgBullets[0].isAlive).toBe(true);

      // Update engine simulation
      engine.update(1 / 60);
      expect(hmgBullets[0].position.x).toBeGreaterThan(100);
    });
  });

  describe('Flame Shot Weapon Upgrade & Behavior', () => {
    it('should upgrade to Flame Shot with 30 ammo and voice announcement', () => {
      const voiceHandler = vi.fn();
      engine.eventBus.on('play_voice', voiceHandler);

      player.weaponManager.acquireWeapon('FLAME_SHOT', 30, engine);

      const state = player.getPlayerState();
      expect(state.currentWeapon.type).toBe('FLAME_SHOT');
      expect(state.currentWeapon.ammo).toBe(30);
      expect(state.currentWeapon.maxAmmo).toBe(99);
      expect(voiceHandler).toHaveBeenCalledWith({ voice: 'voice_flame_shot' });
    });

    it('should spawn expanding piercing fireballs that expand over time', () => {
      player.weaponManager.acquireWeapon('FLAME_SHOT', 30, engine);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;
      player.handleInput(input, 1 / 60, engine);
      engine.tick();

      const flames = engine
        .getAllEntities()
        .filter((e) => e instanceof BulletProjectile && e.weaponType === 'FLAME_SHOT');
      expect(flames.length).toBe(1);

      const flame = flames[0] as BulletProjectile;
      expect(flame.pierces).toBe(true);
      expect(flame.currentRadius).toBeGreaterThanOrEqual(10.0);
      expect(flame.currentRadius).toBeLessThan(12.0);

      // Advance time half-way through its 0.55s lifetime
      flame.update(0.275, engine);
      expect(flame.currentRadius).toBeGreaterThan(20.0);
      expect(flame.currentRadius).toBeLessThanOrEqual(36.0);
    });

    it('should automatically fallback to PISTOL when Flame Shot ammo reaches 0', () => {
      player.weaponManager.acquireWeapon('FLAME_SHOT', 1, engine);
      expect(player.weaponManager.getAmmo()).toBe(1);

      const input = createBlankInput();
      input.shootPressed = true;
      input.shootHeld = true;
      player.handleInput(input, 1 / 60, engine);

      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');
      expect(player.weaponManager.getAmmo()).toBe(Infinity);
    });

    it('should replace active HMG when Flame Shot badge is picked up', () => {
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 120, engine);
      expect(player.weaponManager.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');

      // Pickup Flame Shot
      player.weaponManager.applyItemPickup(ItemDropType.WEAPON_FLAME, engine);
      expect(player.weaponManager.getActiveWeapon()).toBe('FLAME_SHOT');
      expect(player.weaponManager.getAmmo()).toBe(30);
    });
  });

  describe('Secondary Weapon: Grenades', () => {
    it('should decrement grenade inventory on toss and clamp at zero', () => {
      expect(player.weaponManager.getGrenadeCount()).toBe(10);

      const input = createBlankInput();
      input.grenadePressed = true;

      player.handleInput(input, 1 / 60, engine);
      expect(player.weaponManager.getGrenadeCount()).toBe(9);

      // Manually set grenades to 0
      player.weaponManager.setGrenadeCount(0);
      expect(player.weaponManager.getGrenadeCount()).toBe(0);

      // Attempt to toss with 0 grenades
      player.handleInput(input, 1 / 60, engine);
      expect(player.weaponManager.getGrenadeCount()).toBe(0);
    });

    it('should replenish grenades via grenade crate pickup up to 99', () => {
      player.weaponManager.setGrenadeCount(95);

      player.weaponManager.applyItemPickup(ItemDropType.GRENADE_CRATE, engine);
      expect(player.weaponManager.getGrenadeCount()).toBe(99); // Capped at 99
    });
  });

  describe('Hostage POW Rescue State Machine & Loot Generation', () => {
    it('should progress through 6 states: TIED_UP -> FREED -> SALUTE -> OFFERING_ITEM -> ESCAPING -> SAVED', () => {
      const pow = new PowEntity('pow_1', vec2(300, 200), ItemDropType.WEAPON_HMG);
      engine.addEntity(pow);
      engine.tick();

      expect(pow.state).toBe(PowState.TIED_UP);

      // 1. Free hostage via player bullet/knife/touch
      pow.freeHostage();
      expect(pow.state).toBe(PowState.FREED);

      const dt = 1 / 60;

      // 2. Advance through FREED duration (30 frames)
      for (let i = 0; i < PowEntity.FREED_FRAMES + 1; i++) {
        pow.update(dt, engine);
      }
      expect(pow.state).toBe(PowState.SALUTE);

      // 3. Advance through SALUTE duration (25 frames)
      for (let i = 0; i < PowEntity.SALUTE_FRAMES + 1; i++) {
        pow.update(dt, engine);
      }
      expect(pow.state).toBe(PowState.OFFERING_ITEM);

      // Update once in OFFERING_ITEM to execute item spawn
      pow.update(dt, engine);
      engine.tick();

      const drops = engine.getAllEntities().filter((e) => e instanceof ItemPickupEntity);
      expect(drops.length).toBe(1);
      expect((drops[0] as ItemPickupEntity).dropType).toBe(ItemDropType.WEAPON_HMG);

      // 4. Advance through remainder of OFFERING_ITEM duration (35 frames)
      for (let i = 0; i < PowEntity.OFFERING_FRAMES; i++) {
        pow.update(dt, engine);
      }
      expect(pow.state).toBe(PowState.ESCAPING);
      expect(pow.velocity.x).not.toBe(0);

      // 5. POW runs off screen or times out -> SAVED
      pow.markSaved(engine);
      expect(pow.state).toBe(PowState.SAVED);
      expect(pow.isAlive).toBe(false);
      expect(player.rescuedPowCount).toBe(1);
      expect(player.score).toBe(10000); // 10,000 pts saved bonus
    });

    it('should award score bonuses for food and treasure pickups', () => {
      player.weaponManager.applyItemPickup(ItemDropType.SCORE_BANANA, engine);
      let scoreAwarded = 0;
      engine.eventBus.on('award_score', (e: any) => {
        scoreAwarded += e.score;
      });

      player.weaponManager.applyItemPickup(ItemDropType.SCORE_CHICKEN, engine);
      expect(scoreAwarded).toBe(1000); // Roast chicken awards 1000 pts
    });
  });
});
