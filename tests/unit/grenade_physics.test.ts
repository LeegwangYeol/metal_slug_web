import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Grenade } from '../../src/core/weapons/Grenade';
import { PlayerPosture } from '../../src/core/player/PlayerKinematics';
import { createAABB } from '../../src/core/physics/AABB';
import { Platform } from '../../src/core/physics/Platform';
import { vec2 } from '../../src/core/math/Vector2D';

class MockEnemy implements GameEntity {
  public position = { x: 0, y: 0 };
  public velocity = { x: 0, y: 0 };
  public type: string = 'ENEMY_SOLDIER';
  public bounds = createAABB(0, 0, 20, 20);
  public isAlive: boolean = true;
  public health: number = 20.0;
  public lastDamageTaken: number = 0;

  constructor(public id: string, x: number, y: number) {
    this.position = { x, y };
    this.bounds = createAABB(x - 10, y - 10, 20, 20);
  }

  update(): void {}

  takeDamage(amount: number): void {
    this.health -= amount;
    this.lastDamageTaken = amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

describe('Grenade Trajectory, Restitution & Blast AOE Suite', () => {
  it('should spawn with correct initial velocities for standing, crouching, and airborne down throws', () => {
    // Standing throw (Facing Right)
    const stand = Grenade.spawnForPlayer('g1', vec2(100, 200), 1, PlayerPosture.STANDING);
    expect(stand.velocity.x).toBe(240.0);
    expect(stand.velocity.y).toBe(-312.0);

    // Crouch throw: lower arc with forward roll
    const crouch = Grenade.spawnForPlayer('g2', vec2(100, 200), 1, PlayerPosture.CROUCHING);
    expect(crouch.velocity.x).toBe(288.0);
    expect(crouch.velocity.y).toBe(-90.0);

    // Airborne down throw
    const airDown = Grenade.spawnForPlayer('g3', vec2(100, 200), 1, PlayerPosture.AIRBORNE, true);
    expect(airDown.velocity.x).toBe(120.0);
    expect(airDown.velocity.y).toBe(240.0);
  });

  it('should bounce on ground with ey=0.5 and ex=0.7 restitution', () => {
    const engine = new GameEngine();
    engine.start();

    // Solid floor at y = 200
    const floor: Platform = {
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 200, 1000, 50),
    };
    engine.setPlatforms([floor]);

    // Grenade falling directly downward near floor (100, 198) with vy = 100, vx = 50
    const grenade = new Grenade('test_g', vec2(100, 198), vec2(50, 100));
    engine.addEntity(grenade);

    // Advance frames until floor contact resolves bounce
    for (let i = 0; i < 5; i++) {
      grenade.update(1 / 60, engine);
      if (grenade.velocity.y < 0) break;
    }

    expect(grenade.velocity.y).toBeLessThan(0); // upward bounce
    expect(grenade.velocity.x).toBeCloseTo(35.0, 1);
  });

  it('should detonate immediately on contact with enemy hurtbox', () => {
    const engine = new GameEngine();
    engine.start();

    const enemy = new MockEnemy('rebel_soldier', 100, 100);
    engine.addEntity(enemy);

    const grenade = new Grenade('g_contact', vec2(100, 95), vec2(0, 50));
    engine.addEntity(grenade);

    expect(grenade.isExploded).toBe(false);

    // Collide with enemy
    grenade.onCollision(enemy, engine);
    expect(grenade.isExploded).toBe(true);
  });

  it('should detonate after 1.25s fuse expiry if no contact occurs', () => {
    const engine = new GameEngine();
    engine.start();

    const grenade = new Grenade('g_fuse', vec2(100, 100), vec2(0, 0));
    engine.addEntity(grenade);

    // Advance 1.0s (less than 1.25s)
    grenade.update(1.0, engine);
    expect(grenade.isExploded).toBe(false);

    // Advance another 0.3s (total 1.3s > 1.25s)
    grenade.update(0.3, engine);
    expect(grenade.isExploded).toBe(true);
  });

  it('should deal max 10 HP in inner radius (18px) and linear falloff in outer radius (52px)', () => {
    const engine = new GameEngine();
    engine.start();

    // Enemy 1 at epicenter (dist 10px <= 18px inner radius)
    const enemyInner = new MockEnemy('inner_target', 100, 110);
    // Enemy 2 at outer radius (dist 35px from 100, 100)
    const enemyOuter = new MockEnemy('outer_target', 135, 100);
    // Enemy 3 far away (dist 80px > 52px outer radius)
    const enemyFar = new MockEnemy('far_target', 180, 100);

    engine.addEntity(enemyInner);
    engine.addEntity(enemyOuter);
    engine.addEntity(enemyFar);

    const shakeSpy = vi.fn();
    engine.eventBus.on('screen_shake', shakeSpy);

    // Detonate grenade at (100, 100)
    const grenade = new Grenade('g_blast', vec2(100, 100), vec2(0, 0));
    engine.addEntity(grenade);
    engine.tick(); // Register in spatial grid

    grenade.detonate(engine);

    // Enemy inner receives full 10.0 HP damage
    expect(enemyInner.lastDamageTaken).toBe(10.0);

    // Enemy outer (at 35px) receives falloff damage between 4.0 and 10.0 HP
    expect(enemyOuter.lastDamageTaken).toBeGreaterThan(4.0);
    expect(enemyOuter.lastDamageTaken).toBeLessThan(10.0);

    // Enemy far outside 52px blast radius takes NO damage
    expect(enemyFar.lastDamageTaken).toBe(0);

    // Screen shake event emitted with 5.0 amplitude
    expect(shakeSpy).toHaveBeenCalledWith(expect.objectContaining({ amplitude: 5.0 }));
  });
});
