import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PowEntity, PowState, ItemPickupEntity } from '../../src/core/entities/pow/PowEntity';
import { PlayerController } from '../../src/core/player/PlayerController';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { vec2 } from '../../src/core/math/Vector2D';

describe('Hostage POW Rescue State Machine Suite', () => {
  it('should follow complete 6-state progression: TIED_UP -> FREED -> SALUTE -> OFFERING_ITEM -> ESCAPING -> SAVED', () => {
    const engine = new GameEngine();
    engine.start();

    const player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);

    const pow = new PowEntity('pow_1', vec2(150, 200), ItemDropType.WEAPON_HMG);
    engine.addEntity(pow);
    engine.tick();

    // 1. Initial State: TIED_UP
    expect(pow.state).toBe(PowState.TIED_UP);
    expect(pow.isAlive).toBe(true);

    const thankYouSpy = vi.fn();
    engine.eventBus.on('play_voice', thankYouSpy);

    // 2. Free POW via bullet hit / contact
    pow.freeHostage();
    expect(pow.state).toBe(PowState.FREED);

    // 3. Advance through FREED duration (30 frames = 0.5s)
    pow.update(0.5, engine);
    expect(pow.state).toBe(PowState.SALUTE);
    expect(thankYouSpy).toHaveBeenCalledWith({ voice: 'voice_thank_you' });

    // 4. Advance through SALUTE duration (25 frames ~ 0.42s)
    pow.update(0.42, engine);
    expect(pow.state).toBe(PowState.OFFERING_ITEM);

    // 5. Advance through OFFERING_ITEM duration (35 frames = 35/60s)
    pow.update(35 / 60 + 0.05, engine);
    expect(pow.state).toBe(PowState.ESCAPING);
    expect(pow.velocity.x).not.toBe(0); // Running away

    // Verify item drop entity was spawned into the simulation
    const itemEntities = engine.getAllEntities().filter((e) => e.type === 'ITEM_PICKUP');
    expect(itemEntities.length).toBe(1);
    const drop = itemEntities[0] as ItemPickupEntity;
    expect(drop.dropType).toBe(ItemDropType.WEAPON_HMG);

    // 6. POW reaches screen edge / saved
    const savedSpy = vi.fn();
    engine.eventBus.on('pow_saved', savedSpy);

    pow.markSaved(engine);
    expect(pow.state).toBe(PowState.SAVED);
    expect(pow.isAlive).toBe(false); // Cleaned up

    // Verify player rescued count and +10,000 score bonus
    expect(player.rescuedPowCount).toBe(1);
    expect(player.score).toBe(10000);
    expect(savedSpy).toHaveBeenCalledWith({
      powId: 'pow_1',
      scoreAwarded: 10000,
    });
  });

  it('should sample from weighted loot drop table', () => {
    const samples: Record<string, number> = {};
    const N = 1000;

    for (let i = 0; i < N; i++) {
      const drop = PowEntity.selectWeightedDrop();
      samples[drop] = (samples[drop] ?? 0) + 1;
    }

    // Check that common items (HMG 35%, Flame 25%, Grenades 20%) appear significantly more than rare items (Jewel 2%)
    expect(samples[ItemDropType.WEAPON_HMG]).toBeGreaterThan(200);
    expect(samples[ItemDropType.WEAPON_FLAME]).toBeGreaterThan(150);
    expect(samples[ItemDropType.GRENADE_CRATE]).toBeGreaterThan(120);
    expect(samples[ItemDropType.SCORE_JEWEL]).toBeLessThan(100);
  });

  it('should allow player to collect dropped item to upgrade weapon', () => {
    const engine = new GameEngine();
    engine.start();

    const player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);
    expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');

    // Create item drop entity directly at player position
    const item = new ItemPickupEntity('pickup_1', ItemDropType.WEAPON_FLAME, vec2(100, 200));
    engine.addEntity(item);

    // Player collides with item
    player.onCollision(item, engine);

    expect(player.weaponManager.getActiveWeapon()).toBe('FLAME_SHOT');
    expect(player.weaponManager.getAmmo()).toBe(30);
    expect(item.isAlive).toBe(false); // Consumed
  });
});
