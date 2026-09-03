import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2, Vec2 } from '../../src/core/math/Vector2D';

class TargetDummy implements GameEntity {
  public type: string = 'SOLDIER_TARGET';
  public position = { x: 0, y: 0 };
  public velocity = { x: 0, y: 0 };
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public hitsTaken: number = 0;
  public totalDamage: number = 0;

  constructor(public id: string, x: number, y: number) {
    this.position = { x, y };
    this.bounds = createAABB(x - 10, y - 15, 20, 30);
  }

  update(): void {}

  takeDamage(amount: number): void {
    this.hitsTaken++;
    this.totalDamage += amount;
  }
}

describe('Weapons System & Projectiles Suite', () => {
  it('PISTOL: should have infinite ammo, semi-automatic behavior, 660 px/s speed, and max 4 on-screen bullets limit', () => {
    const engine = new GameEngine();
    engine.start();

    const wm = new WeaponManager();
    expect(wm.getActiveWeapon()).toBe('PISTOL');
    expect(wm.getAmmo('PISTOL')).toBe(Infinity);

    const muzzle = vec2(100, 200);
    const aim = vec2(1, 0);

    // Fire 4 bullets rapidly
    const b1 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    engine.tick();
    wm.update(0.2, engine); // cool down
    const b2 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    engine.tick();
    wm.update(0.2, engine);
    const b3 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    engine.tick();
    wm.update(0.2, engine);
    const b4 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    engine.tick();

    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b3).not.toBeNull();
    expect(b4).not.toBeNull();

    // Verify speed
    expect(b1!.velocity.x).toBeCloseTo(660.0);
    expect(b1!.damage).toBe(1.0);

    // 5th bullet attempt while 4 are active on-screen must be BLOCKED
    wm.update(0.2, engine);
    const b5 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    expect(b5).toBeNull(); // Blocked!

    // When one bullet dies, 5th bullet can now be fired
    b1!.isAlive = false;
    engine.tick(); // sweeps dead entity
    const b6 = wm.tryFire(muzzle, aim, 1, engine, true, false);
    expect(b6).not.toBeNull();
  });

  it('HEAVY_MACHINE_GUN: should fire full-auto at 15 shots/s, sweep angle at 12 rad/s, and eject brass casings', () => {
    const engine = new GameEngine();
    engine.start();

    const wm = new WeaponManager();
    wm.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
    expect(wm.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');
    expect(wm.getAmmo()).toBe(200);

    const muzzle = vec2(100, 200);

    // Fire initial horizontal shot
    const b1 = wm.tryFire(muzzle, vec2(1, 0), 1, engine, true, true);
    expect(b1).not.toBeNull();
    expect(wm.getAmmo()).toBe(199);
    expect(b1!.weaponType).toBe('HEAVY_MACHINE_GUN');
    expect(Vec2.len(b1!.velocity)).toBeCloseTo(780.0);

    // Verify brass casing was ejected
    const casings = wm.projectileManager.getBrassCasings();
    expect(casings.length).toBe(1);
    expect(casings[0].velocity.x).toBeLessThan(0); // ejected backwards
    expect(casings[0].velocity.y).toBeLessThan(0); // ejected upwards

    // Test 12 rad/s angular sweeping: player pivots to Up (angle -PI/2) while holding fire
    wm.update(1 / 15, engine); // 1 frame later
    const b2 = wm.tryFire(muzzle, vec2(0, -1), 1, engine, false, true); // shootHeld
    expect(b2).not.toBeNull();

    // Angle of b2 should have moved toward -PI/2 by at most 12 * dt rad
    const b2Angle = Math.atan2(b2!.velocity.y, b2!.velocity.x);
    // Was 0, moving toward -PI/2 (-1.57 rad), max delta is ~0.2 rad plus jitter
    expect(b2Angle).toBeLessThan(0.1);
  });

  it('FLAME_SHOT: should have expanding fireball (10->36px), piercing multi-hit with 6-frame immunity, and ground burning AOE', () => {
    const engine = new GameEngine();
    engine.start();

    const wm = new WeaponManager();
    wm.acquireWeapon('FLAME_SHOT', 30, engine);

    const flame = wm.tryFire(vec2(100, 200), vec2(1, 0), 1, engine, true, false);
    expect(flame).not.toBeNull();
    expect(flame!.currentRadius).toBe(10.0);
    expect(flame!.pierces).toBe(true);

    // Advance 0.55s (lifetime of flame) in steps and check expansion
    flame!.update(0.275, engine); // half life
    expect(flame!.currentRadius).toBeCloseTo(23.0, 0); // 10 + 26 * 0.5 = 23

    // Create target dummy to test piercing multi-hit with 6-frame tick immunity
    const dummy = new TargetDummy('enemy_1', 120, 200);
    engine.addEntity(dummy);

    // Initial hit delivers 1.5 damage
    flame!.onCollision(dummy, engine);
    expect(dummy.hitsTaken).toBe(1);
    expect(dummy.totalDamage).toBe(1.5);
    expect(flame!.isAlive).toBe(true); // DOES NOT DESPAWN! Pierces through

    // Immediate hit on next tick (before 6 frames / 0.1s elapse) must be IGNORED by immunity timer
    flame!.update(1 / 60, engine); // 1 frame (~0.016s)
    flame!.onCollision(dummy, engine);
    expect(dummy.hitsTaken).toBe(1); // No new damage

    // Advance beyond 6-frame immunity (total 0.1s)
    flame!.update(0.1, engine);
    flame!.onCollision(dummy, engine);
    expect(dummy.hitsTaken).toBe(2); // Second tick delivered!
    expect(dummy.totalDamage).toBe(3.0);

    // Test ground burning AOE spawning
    const groundFire = wm.projectileManager.spawnGroundFire(vec2(200, 250));
    expect(groundFire.bounds.width).toBe(32);
    expect(groundFire.bounds.height).toBe(16);
    expect(groundFire.maxLifeFrames).toBe(72);
  });

  it('Ammo Depletion & Auto-Fallback: should automatically revert to PISTOL when special weapon ammo reaches 0', () => {
    const engine = new GameEngine();
    engine.start();

    const wm = new WeaponManager();
    wm.acquireWeapon('HEAVY_MACHINE_GUN', 2, engine); // exactly 2 rounds
    expect(wm.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');

    const weaponChangeSpy = vi.fn();
    engine.eventBus.on('weapon_changed', weaponChangeSpy);

    // Fire round 1
    wm.tryFire(vec2(100, 200), vec2(1, 0), 1, engine, true, false);
    expect(wm.getAmmo()).toBe(1);
    expect(wm.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');

    wm.update(0.1, engine);

    // Fire round 2 (last round)
    wm.tryFire(vec2(100, 200), vec2(1, 0), 1, engine, true, false);

    // Seamless automatic fallback to PISTOL!
    expect(wm.getActiveWeapon()).toBe('PISTOL');
    expect(wm.getAmmo('PISTOL')).toBe(Infinity);
    expect(weaponChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        previousWeapon: 'HEAVY_MACHINE_GUN',
        currentWeapon: 'PISTOL',
        ammo: Infinity,
      })
    );
  });

  it('Weapon Pickups: should stack ammo for same weapon and switch weapon with announcer voice for different weapon', () => {
    const engine = new GameEngine();
    engine.start();

    const wm = new WeaponManager();
    const voiceSpy = vi.fn();
    engine.eventBus.on('play_voice', voiceSpy);

    // 1. Pick up HMG badge
    wm.applyItemPickup(ItemDropType.WEAPON_HMG, engine);
    expect(wm.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');
    expect(wm.getAmmo()).toBe(200);
    expect(voiceSpy).toHaveBeenCalledWith({ voice: 'voice_heavy_machine_gun' });

    // 2. Pick up another HMG badge -> stacks ammo to 400
    wm.applyItemPickup(ItemDropType.WEAPON_HMG, engine);
    expect(wm.getAmmo()).toBe(400);

    // 3. Pick up Flame Shot badge -> replaces active weapon with Flame Shot and sets 30 fuel
    wm.applyItemPickup(ItemDropType.WEAPON_FLAME, engine);
    expect(wm.getActiveWeapon()).toBe('FLAME_SHOT');
    expect(wm.getAmmo()).toBe(30);
    expect(voiceSpy).toHaveBeenCalledWith({ voice: 'voice_flame_shot' });

    // 4. Pick up Grenade crate -> +10 grenades (10 -> 20)
    expect(wm.getGrenadeCount()).toBe(10);
    wm.applyItemPickup(ItemDropType.GRENADE_CRATE, engine);
    expect(wm.getGrenadeCount()).toBe(20);
  });
});
