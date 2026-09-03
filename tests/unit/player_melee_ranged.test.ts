import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlayerKinematics, PlayerActionState, PlayerInputSnapshot } from '../../src/core/player/PlayerKinematics';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';

class MockEnemy implements GameEntity {
  public position = { x: 0, y: 0 };
  public velocity = { x: 0, y: 0 };
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public health: number = 3.0;

  constructor(
    public id: string,
    public type: string = 'SOLDIER_RIFLE',
    x: number = 0,
    y: number = 0,
    public isMeleeVulnerable: boolean = true
  ) {
    this.position = { x, y };
    this.bounds = createAABB(x - 10, y - 30, 20, 30);
  }

  update(): void {}

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

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

describe('Melee vs Ranged Combat Arbitration Suite', () => {
  it('should generate forward knife scan box with 38px forward, 6px rear, [-34, +10]px vertical', () => {
    // Player anchor at (100, 200), facing right (1)
    const rightBox = PlayerKinematics.getMeleeScanBox(100, 200, 1);
    expect(rightBox.x).toBe(100 - 6); // 94
    expect(rightBox.width).toBeCloseTo(44.05, 2); // 38.05 + 6
    expect(rightBox.y).toBe(200 - 34); // 166
    expect(rightBox.height).toBe(34 + 10); // 44

    // Facing left (-1)
    const leftBox = PlayerKinematics.getMeleeScanBox(100, 200, -1);
    expect(leftBox.x).toBeCloseTo(61.95, 2); // 100 - 38.05
    expect(leftBox.width).toBeCloseTo(44.05, 2);
    expect(leftBox.y).toBe(166);
    expect(leftBox.height).toBe(44);
  });

  it('should trigger knife slash and SUPPRESS bullet firing when living vulnerable enemy is in melee scan box', () => {
    const engine = new GameEngine();
    engine.start();

    // Player at (100, 200) facing right
    const player = new PlayerController(vec2(100, 200));
    player.facing = 1;
    engine.addEntity(player);

    // Living enemy at (120, 200) - within 38px reach
    const enemy = new MockEnemy('rebel_1', 'SOLDIER_RIFLE', 120, 200, true);
    engine.addEntity(enemy);

    // Initial tick to register entities in spatial grid
    engine.tick();

    const knifeListener = vi.fn();
    engine.eventBus.on('knife_slash_started', knifeListener);

    // Press Shoot
    player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);

    // Should allocate knife slash state
    expect(player.isAttackingMelee).toBe(true);
    expect(player.actionState).toBe(PlayerActionState.MELEE_SLASH);
    expect(knifeListener).toHaveBeenCalled();

    // Verify BULLET IS SUPPRESSED: No projectiles should exist in engine
    const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
    expect(projectiles.length).toBe(0);

    // Advance frames to active window (frames 5-9)
    for (let frame = 0; frame < 6; frame++) {
      player.handleInput(makeInput(), 1 / 60, engine);
      engine.tick();
    }

    // Damage (3.0 HP) should have been delivered to enemy
    expect(enemy.health).toBe(0);
    expect(enemy.isAlive).toBe(false);
    expect(player.score).toBe(500); // 500 bonus points for melee kill

    // Advance to end of knife slash (18 frames total)
    for (let frame = 6; frame <= 18; frame++) {
      player.handleInput(makeInput(), 1 / 60, engine);
      engine.tick();
    }
    expect(player.isAttackingMelee).toBe(false);
  });

  it('should fire ranged weapon when enemy is out of melee range', () => {
    const engine = new GameEngine();
    engine.start();

    // Player at (100, 200)
    const player = new PlayerController(vec2(100, 200));
    player.facing = 1;
    engine.addEntity(player);

    // Enemy far away at (300, 200)
    const farEnemy = new MockEnemy('far_rebel', 'SOLDIER_RIFLE', 300, 200, true);
    engine.addEntity(farEnemy);
    engine.tick();

    // Press Shoot
    player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
    engine.tick();

    // Knife should NOT be triggered
    expect(player.isAttackingMelee).toBe(false);

    // Ranged bullet SHOULD be spawned
    const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
    expect(projectiles.length).toBe(1);
    expect((projectiles[0] as any).weaponType).toBe('PISTOL');
  });

  it('should execute ranged weapon instead of knife when target is NOT melee-vulnerable (e.g. Armored Boss / Heavy Vehicle)', () => {
    const engine = new GameEngine();
    engine.start();

    const player = new PlayerController(vec2(100, 200));
    player.facing = 1;
    engine.addEntity(player);

    // Heavy vehicle right next to player, but melee-invulnerable
    const tank = new MockEnemy('tank_boss', 'MID_BOSS_VEHICLE', 115, 200, false);
    engine.addEntity(tank);
    engine.tick();

    // Press Shoot
    player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
    engine.tick();

    // Knife slash rejected
    expect(player.isAttackingMelee).toBe(false);

    // Ranged bullet spawned into tank
    const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
    expect(projectiles.length).toBe(1);
  });
});
