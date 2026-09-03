import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { DeathCorpseManager } from '../../src/core/entities/enemies/DeathCorpseManager';
import { ProceduralSpriteFactory, createCanvasBuffer } from '../../src/render/sprites/ProceduralSpriteFactory';
import { vec2 } from '../../src/core/math/Vector2D';

describe('R2: Authentic Death Animations & Decoupled Corpse Management Suite', () => {
  it('DECOUPLING INVARIANT: SoldierEnemy.isAlive becomes false immediately when health <= 0', () => {
    const engine = new GameEngine();
    let deathEventEmitted = false;
    let deathType: string | undefined;

    engine.eventBus.on('enemy_death', (event: any) => {
      deathEventEmitted = true;
      deathType = event.deathType;
    });

    const soldier = SoldierEnemy.createRifleman('rebel_test_die', vec2(200, 192));
    engine.addEntity(soldier);

    // Initial state
    expect(soldier.isAlive).toBe(true);
    expect(soldier.health).toBe(1);

    // Advance 1 tick so engine reference is attached
    soldier.update(1 / 60, engine);

    // Deliver lethal bullet hit
    soldier.takeDamage(1, 'bullet');

    // Strict Unit Test Invariant
    expect(soldier.health).toBe(0);
    expect(soldier.isAlive).toBe(false);
    expect(soldier.state).toBe('DEAD');
    expect(deathEventEmitted).toBe(true);
    expect(deathType).toBe('standard');
  });

  it('DAMAGE NORMALIZATION: Correctly resolves bullet, explosion, and flame damage sources', () => {
    const engine = new GameEngine();

    // 1. Explosion via boolean (Grenade caller signature)
    const s1 = SoldierEnemy.createRifleman('rebel_s1', vec2(100, 192));
    engine.addEntity(s1);
    s1.update(1 / 60, engine);
    s1.takeDamage(1, true); // boolean true indicates explosive damage
    expect(s1.deathType).toBe('explosion');

    // 2. Fire via boolean origin (Flame shot legacy caller signature)
    const s2 = SoldierEnemy.createRifleman('rebel_s2', vec2(100, 192));
    engine.addEntity(s2);
    s2.update(1 / 60, engine);
    s2.takeDamage(1, false, true); // boolean true for origin indicates fire
    expect(s2.deathType).toBe('fire');

    // 3. Fire via explicit string
    const s3 = SoldierEnemy.createRifleman('rebel_s3', vec2(100, 192));
    engine.addEntity(s3);
    s3.update(1 / 60, engine);
    s3.takeDamage(1, 'flame');
    expect(s3.deathType).toBe('fire');
  });

  it('STANDARD FALLING DEATH: Decoupled corpse animates stagger, knee buckle, and ground collapse', () => {
    const engine = new GameEngine();
    const manager = new DeathCorpseManager(engine);

    manager.spawnCorpse({
      id: 'test_standard_corpse',
      type: 'SOLDIER_RIFLE',
      role: 'RIFLE',
      position: vec2(200, 192),
      velocity: vec2(0, 0),
      facing: -1,
      deathType: 'standard',
    });

    const initial = manager.getRenderStates();
    expect(initial.length).toBe(1);
    expect(initial[0].deathType).toBe('standard');
    expect(initial[0].frame).toBe(0);

    // Advance 0.18s -> Knee buckle (frame 1)
    manager.update(0.18);
    expect(manager.getRenderStates()[0].frame).toBe(1);

    // Advance 0.18s (total 0.36s) -> Back slam (frame 2)
    manager.update(0.18);
    expect(manager.getRenderStates()[0].frame).toBe(2);

    // Advance 0.18s (total 0.54s) -> Collapsed corpse (frame 3)
    manager.update(0.18);
    expect(manager.getRenderStates()[0].frame).toBe(3);
  });


  it('EXPLOSION BLOWBACK: Ballistic air launch (vy=-300, vx=±200), rotation (8.5 rad/s), detached helmet', () => {
    const engine = new GameEngine();
    const manager = new DeathCorpseManager(engine);

    manager.spawnCorpse({
      id: 'test_explosion_corpse',
      type: 'SOLDIER_RIFLE',
      role: 'RIFLE',
      position: vec2(300, 192),
      velocity: vec2(0, 0),
      facing: -1,
      deathType: 'explosion',
      origin: vec2(280, 200), // Epicenter to the left -> blast sends right
    });

    const states = manager.getRenderStates();
    expect(states.length).toBe(1);
    const corpse = states[0];
    expect(corpse.deathType).toBe('explosion');
    expect(corpse.isGrounded).toBe(false);
    expect(corpse.helmet).toBeDefined();

    // Advance 0.2s mid-air
    manager.update(0.2);
    const midAir = manager.getRenderStates()[0];
    expect(midAir.rotation).toBeGreaterThan(0);
    expect(midAir.helmet!.rotation).toBeGreaterThan(0);
    expect(midAir.particles.length).toBeGreaterThan(0);
  });

  it('FLAMETHROWER BURNING: Thrash with flame particles, charcoal silhouette with glowing embers, and ash', () => {
    const engine = new GameEngine();
    const manager = new DeathCorpseManager(engine);

    manager.spawnCorpse({
      id: 'test_burn_corpse',
      type: 'SOLDIER_RIFLE',
      role: 'RIFLE',
      position: vec2(200, 192),
      velocity: vec2(0, 0),
      facing: -1,
      deathType: 'fire',
    });

    // Stage 1: Thrashing (0.0s - 0.65s)
    manager.update(0.3);
    let st = manager.getRenderStates()[0];
    expect(st.stage).toBe('thrash');
    expect(st.particles.length).toBeGreaterThan(0);

    // Stage 2: Charcoal with glowing embers (0.65s - 1.1s)
    manager.update(0.45); // total 0.75s
    st = manager.getRenderStates()[0];
    expect(st.stage).toBe('charcoal');

    // Stage 3: Crumbling Ash (1.1s - 1.4s)
    manager.update(0.4); // total 1.15s
    st = manager.getRenderStates()[0];
    expect(st.stage).toBe('ash');
  });

  it('SPRITE REGISTRY: All 12 death animation frames and parachute canopy are registered and renderable', () => {
    const factory = new ProceduralSpriteFactory();
    const mockBuffer = createCanvasBuffer(64, 64);
    const mockCtx = mockBuffer.getContext('2d')!;

    const requiredKeys = [
      'parachute_canopy',
      'rebel_death_standard_0',
      'rebel_death_standard_1',
      'rebel_death_standard_2',
      'rebel_death_standard_3',
      'rebel_death_explosion_air',
      'rebel_death_explosion_helmet',
      'rebel_death_explosion_land_0',
      'rebel_death_explosion_land_1',
      'rebel_death_burn_thrash_0',
      'rebel_death_burn_thrash_1',
      'rebel_death_burn_charcoal_0',
      'rebel_death_burn_ash_0',
      'rebel_death_burn_ash_1',
    ];

    for (const key of requiredKeys) {
      expect(factory.hasSprite(key)).toBe(true);
      const frame = factory.getSprite(key);
      expect(frame).toBeDefined();
      expect(frame!.width).toBeGreaterThan(0);
      expect(frame!.height).toBeGreaterThan(0);

      const drawn = factory.drawSprite(mockCtx, key, 32, 32);
      expect(drawn).toBe(true);
    }
  });
});
