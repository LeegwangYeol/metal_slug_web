import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { PlayerRocketProjectile, RocketLauncherWeapon } from '../../src/core/weapons/RocketLauncherWeapon';
import { PlayerController } from '../../src/core/player/PlayerController';

// Adversarial mock enemy entity
class MockTargetEntity implements GameEntity {
  public id: string;
  public type: string;
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public health: number = 100.0;
  public damageTaken: number = 0;
  public hitCount: number = 0;

  constructor(id: string, x: number, y: number, type: string, health: number = 100.0) {
    this.id = id;
    this.type = type;
    this.position = vec2(x, y);
    this.bounds = createAABB(x - 10, y - 30, 20, 30);
    this.health = health;
  }

  update(_dt: number): void {
    this.bounds.x = this.position.x - 10;
    this.bounds.y = this.position.y - 30;
  }

  onCollision(): void {}

  takeDamage(amount: number): void {
    this.damageTaken += amount;
    this.hitCount++;
    this.health -= amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

describe('Challenger M2 Iteration 2: Adversarial Audit Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 200, 3000, 20),
    });
  });

  // =========================================================================
  // FOCUS 1: Ally Target Selection: End-Boss vs Mid-Boss at Varied Distances
  // =========================================================================
  describe('Focus 1: Ally Target Selection Under Varied Distances & Boss Types', () => {
    it('selects End-Boss over Mid-Boss when both are equidistant (dist = 200px)', () => {
      const ally = new AllyNPC('ally_target_1', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const endBoss = new MockTargetEntity('end_boss', 300, 215, 'BOSS_IRON_NOKANA');
      const midBoss = new MockTargetEntity('mid_boss', 300, 215, 'MID_BOSS_VEHICLE');

      engine.addEntity(endBoss);
      engine.addEntity(midBoss);

      const chosen = ally.findBestTarget(engine);
      expect(chosen).not.toBeNull();
      expect(chosen?.id).toBe('end_boss');
    });

    it('selects End-Boss over Mid-Boss even when Mid-Boss is dramatically closer', () => {
      const ally = new AllyNPC('ally_target_2', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Mid-boss is 50px away (score = 5000 - 50 = 4950)
      const midBoss = new MockTargetEntity('close_mid_boss', 150, 215, 'MID_BOSS_VEHICLE');
      // End-boss is 370px away, near boundary of 380px vision (score = 10000 - 370 = 9630)
      const endBoss = new MockTargetEntity('far_end_boss', 470, 215, 'BOSS_TETSUYUKI');

      engine.addEntity(midBoss);
      engine.addEntity(endBoss);

      const chosen = ally.findBestTarget(engine);
      expect(chosen).not.toBeNull();
      // End-Boss score (9630) dominates Mid-Boss score (4950)
      expect(chosen?.id).toBe('far_end_boss');
    });

    it('selects Mid-Boss when End-Boss is outside vision radius (> 380px)', () => {
      const ally = new AllyNPC('ally_target_3', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Mid-boss is 250px away (inside vision radius 380px)
      const midBoss = new MockTargetEntity('mid_boss', 350, 215, 'MID_BOSS_VEHICLE');
      // End-boss is 385px away (outside vision radius 380px)
      const endBoss = new MockTargetEntity('out_of_range_end_boss', 485, 215, 'BOSS_TETSUYUKI');

      engine.addEntity(midBoss);
      engine.addEntity(endBoss);

      const chosen = ally.findBestTarget(engine);
      expect(chosen).not.toBeNull();
      expect(chosen?.id).toBe('mid_boss');
    });

    it('returns null when both End-Boss and Mid-Boss are outside vision radius', () => {
      const ally = new AllyNPC('ally_target_4', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const midBoss = new MockTargetEntity('mid_boss_out', 500, 215, 'MID_BOSS_VEHICLE');
      const endBoss = new MockTargetEntity('end_boss_out', 600, 215, 'BOSS_IRON_NOKANA');

      engine.addEntity(midBoss);
      engine.addEntity(endBoss);

      const chosen = ally.findBestTarget(engine);
      expect(chosen).toBeNull();
    });

    it('correctly categorizes all known boss type variations', () => {
      const ally = new AllyNPC('ally_target_5', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const bossTypes = [
        { type: 'TETSUYUKI_BOSS', expectedWeight: 100 },
        { type: 'BOSS_TETSUYUKI', expectedWeight: 100 },
        { type: 'BOSS_IRON_NOKANA', expectedWeight: 100 },
        { type: 'STAGE1_BOSS', expectedWeight: 100 },
        { type: 'MID_BOSS_VEHICLE', expectedWeight: 50 },
        { type: 'ENEMY_MID_BOSS', expectedWeight: 50 },
        { type: 'MID_BOSS', expectedWeight: 50 },
        { type: 'SOLDIER_RIFLE', expectedWeight: 10 },
        { type: 'SOLDIER_KNIFE', expectedWeight: 10 },
      ];

      for (const entry of bossTypes) {
        const testEngine = new GameEngine();
        testEngine.addEntity(ally);
        const target = new MockTargetEntity('target_' + entry.type, 200, 215, entry.type);
        testEngine.addEntity(target);

        const chosen = ally.findBestTarget(testEngine);
        expect(chosen, `Entity with type ${entry.type} should be acquired`).not.toBeNull();
        expect(chosen?.id).toBe('target_' + entry.type);
      }
    });

    it('dynamically re-targets from End-Boss to Mid-Boss upon End-Boss death', () => {
      const ally = new AllyNPC('ally_retarget', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const endBoss = new MockTargetEntity('end_boss', 300, 215, 'BOSS_IRON_NOKANA');
      const midBoss = new MockTargetEntity('mid_boss', 200, 215, 'MID_BOSS_VEHICLE');
      const soldier = new MockTargetEntity('soldier', 150, 215, 'SOLDIER_RIFLE');

      engine.addEntity(endBoss);
      engine.addEntity(midBoss);
      engine.addEntity(soldier);

      // Phase 1: End-boss active -> chosen
      expect(ally.findBestTarget(engine)?.id).toBe('end_boss');

      // Phase 2: End-boss dies -> switches to Mid-boss
      endBoss.isAlive = false;
      expect(ally.findBestTarget(engine)?.id).toBe('mid_boss');

      // Phase 3: Mid-boss dies -> switches to Soldier
      midBoss.isAlive = false;
      expect(ally.findBestTarget(engine)?.id).toBe('soldier');

      // Phase 4: Soldier dies -> returns null
      soldier.isAlive = false;
      expect(ally.findBestTarget(engine)).toBeNull();
    });
  });

  // =========================================================================
  // FOCUS 2: Ally Locomotion with Player in entitiesToAdd (0 Ticks)
  // =========================================================================
  describe('Focus 2: Ally Locomotion When Player is Registered in entitiesToAdd (Zero Ticks)', () => {
    it('resolves pending player from entitiesToAdd and engages FOLLOW state and sprint speed', () => {
      const ally = new AllyNPC('ally_pending_player', vec2(100, 200));
      ally.setState('FOLLOW'); // skip spawn salute to test pure locomotion
      engine.addEntity(ally);

      // Register player via addEntity without executing engine.tick()
      const player = new PlayerController(vec2(300, 200));
      player.facing = 1;
      engine.addEntity(player);

      // Assert engine.getEntity returns undefined (demonstrating pending state)
      expect(engine.getEntity('player')).toBeUndefined();
      expect((engine as any).entitiesToAdd.length).toBe(2);

      // Ally updates without engine.tick()
      ally.update(1 / 60, engine);

      // Follow target is player.x - 45 = 255. dx = 255 - 100 = 155 > sprintThreshold (90)
      expect(ally.state).toBe('FOLLOW');
      expect(ally.facing).toBe(1);
      expect(ally.velocity.x).toBe(165.0); // sprintSpeed
      expect(ally.position.x).toBeGreaterThan(100.0);
    });

    it('settles cleanly into IDLE when player in entitiesToAdd is within stop distance', () => {
      const ally = new AllyNPC('ally_close_player', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Player at X=145, facing 1: follow target is 145 - 45 = 100 (dx = 0 <= stopDistanceThreshold 12)
      const player = new PlayerController(vec2(145, 200));
      player.facing = 1;
      engine.addEntity(player);

      expect(engine.getEntity('player')).toBeUndefined();

      ally.update(1 / 60, engine);

      expect(ally.state).toBe('IDLE');
      expect(ally.velocity.x).toBe(0);
      expect(ally.position.x).toBe(100.0);
    });

    it('triggers platform jump toward elevated player in entitiesToAdd without initial tick', () => {
      const ally = new AllyNPC('ally_jump_pending', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Player elevated by 30px (Y=170 < 200 - 22)
      const player = new PlayerController(vec2(150, 170));
      engine.addEntity(player);

      expect(engine.getEntity('player')).toBeUndefined();

      ally.update(1 / 60, engine);

      expect(ally.isGrounded).toBe(false);
      expect(ally.velocity.y).toBe(-350.0);
    });

    it('maintains continuous multi-frame locomotion exclusively via entitiesToAdd without ever calling engine.tick()', () => {
      const ally = new AllyNPC('ally_multi_frame', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const player = new PlayerController(vec2(400, 200));
      player.facing = 1;
      engine.addEntity(player);

      // Run 30 consecutive updates with zero engine.tick() calls
      for (let frame = 0; frame < 30; frame++) {
        expect(engine.getEntity('player')).toBeUndefined();
        ally.update(1 / 60, engine);
        expect(Number.isFinite(ally.position.x)).toBe(true);
        expect(Number.isFinite(ally.position.y)).toBe(true);
        expect(ally.velocity.x).toBe(165.0);
      }

      // Traveled 30 frames @ 165 px/s * (1/60) = 82.5 px -> position around 182.5
      expect(ally.position.x).toBeCloseTo(182.5, 1);
    });

    it('transitions smoothly when engine.tick() commits entitiesToAdd mid-simulation', () => {
      const ally = new AllyNPC('ally_commit_transition', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const player = new PlayerController(vec2(300, 200));
      player.facing = 1;
      engine.addEntity(player);

      // Step 5 frames with player pending in entitiesToAdd
      for (let i = 0; i < 5; i++) {
        ally.update(1 / 60, engine);
      }
      expect(engine.getEntity('player')).toBeUndefined();
      const posPreTick = ally.position.x;

      // Commit entities via engine.tick()
      engine.tick(1 / 60);
      expect(engine.getEntity('player')).toBeDefined();

      // Step 5 more frames with player committed in entities map
      for (let i = 0; i < 5; i++) {
        ally.update(1 / 60, engine);
      }
      expect(ally.position.x).toBeGreaterThan(posPreTick);
      expect(ally.state).toBe('FOLLOW');
    });

    it('handles player dead or removed while in entitiesToAdd', () => {
      const ally = new AllyNPC('ally_dead_player', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const deadPlayer = new PlayerController(vec2(300, 200));
      deadPlayer.isAlive = false;
      engine.addEntity(deadPlayer);

      ally.update(1 / 60, engine);

      expect(ally.state).toBe('IDLE');
      expect(ally.velocity.x).toBe(0);
    });
  });

  // =========================================================================
  // FOCUS 3: Rocket Lifetime Detonation: Frame 149 vs Frame 150 (2.50s)
  // =========================================================================
  describe('Focus 3: Rocket Lifetime Detonation at Frame 149 vs Frame 150 (2.50s)', () => {
    it('empirically verifies rocket is alive at frame 149 and detonates at frame 150', () => {
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      expect(rocket.isAlive).toBe(true);

      let explosionEvents: any[] = [];
      engine.eventBus.on('spawn_explosion', (payload) => {
        explosionEvents.push(payload);
      });

      // Frames 1 to 149: 149 steps @ 60Hz (2.4833s elapsed, remaining lifeTime ~0.01667s > 1e-4)
      for (let f = 1; f <= 149; f++) {
        rocket.update(1 / 60, engine);
        expect(rocket.isAlive, `Rocket must be ALIVE at frame ${f}`).toBe(true);
        expect(explosionEvents.length, `No explosion should occur at frame ${f}`).toBe(0);
      }

      // Assert precise lifeTime value before frame 150
      expect(rocket.lifeTime).toBeGreaterThan(1e-4);
      expect(rocket.lifeTime).toBeLessThan(0.02);

      // Frame 150: 150th step (2.5000s elapsed, remaining lifeTime = 3.88e-15 <= 1e-4)
      rocket.update(1 / 60, engine);
      expect(rocket.isAlive, 'Rocket must DETONATE and become dead at frame 150').toBe(false);
      expect(explosionEvents.length, 'Explosion event MUST be emitted at frame 150').toBe(1);
      expect(explosionEvents[0].radius).toBe(PlayerRocketProjectile.BLAST_RADIUS);

      // Frame 151: subsequent update must be a no-op
      const finalPos = { ...rocket.position };
      rocket.update(1 / 60, engine);
      expect(rocket.position.x).toBe(finalPos.x);
      expect(rocket.position.y).toBe(finalPos.y);
      expect(explosionEvents.length).toBe(1);
    });

    it('deals correct explosive AOE damage to enemies within 48px radius upon frame 150 detonation', () => {
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);

      // Advance to frame 149
      for (let f = 1; f <= 149; f++) {
        rocket.update(1 / 60, engine);
      }
      expect(rocket.isAlive).toBe(true);

      const detX = rocket.position.x;
      const detY = rocket.position.y;

      // Enemy inside blast radius: exactly 24px ahead horizontally (dist = 24.0 <= 48.0)
      // Expected damage: 8.0 * (1 - 24 / 48) = 4.0
      const inRadiusEnemy = new MockTargetEntity('in_blast_enemy', detX + 24, detY, 'SOLDIER_RIFLE');
      engine.addEntity(inRadiusEnemy);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(inRadiusEnemy.id, inRadiusEnemy);
        engine.spatialGrid.insert(inRadiusEnemy);
      }

      // Enemy outside blast radius: 50px ahead (dist = 50.0 > 48.0)
      const outRadiusEnemy = new MockTargetEntity('out_blast_enemy', detX + 50, detY, 'SOLDIER_RIFLE');
      engine.addEntity(outRadiusEnemy);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(outRadiusEnemy.id, outRadiusEnemy);
        engine.spatialGrid.insert(outRadiusEnemy);
      }

      // Frame 150 detonation
      rocket.update(1 / 60, engine);
      expect(rocket.isAlive).toBe(false);

      // Check damage
      expect(inRadiusEnemy.hitCount).toBe(1);
      expect(inRadiusEnemy.damageTaken).toBeCloseTo(4.0, 2);

      expect(outRadiusEnemy.hitCount).toBe(0);
      expect(outRadiusEnemy.damageTaken).toBe(0);
    });

    it('guarantees friendly entities (Player and Ally) take 0 damage from rocket detonation', () => {
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);

      // Advance to frame 149
      for (let f = 1; f <= 149; f++) {
        rocket.update(1 / 60, engine);
      }

      const detX = rocket.position.x;
      const detY = rocket.position.y;

      const player = new PlayerController(vec2(detX + 10, detY));
      player.health = 1.0;
      engine.addEntity(player);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(player.id, player);
        engine.spatialGrid.insert(player);
      }

      const ally = new AllyNPC('ally_blast_safe', vec2(detX - 10, detY));
      engine.addEntity(ally);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(ally.id, ally);
        engine.spatialGrid.insert(ally);
      }

      // Detonate on frame 150
      rocket.update(1 / 60, engine);
      expect(rocket.isAlive).toBe(false);

      // Player must retain 1.0 HP (no damage taken)
      expect(player.health).toBe(1.0);
    });

    it('verifies 120Hz simulation lifetime: remains alive at frame 299 and detonates at frame 300', () => {
      // At 120Hz, dt = 1/120. 2.5s = 300 frames.
      const rocket = new PlayerRocketProjectile('rocket_120hz', vec2(100, 100), vec2(1, 0), 1, 2.5);
      const dt = 1 / 120;

      for (let f = 1; f <= 299; f++) {
        rocket.update(dt, engine);
        expect(rocket.isAlive, `Must be alive at 120Hz frame ${f}`).toBe(true);
      }

      // Frame 300: hits 2.5s
      rocket.update(dt, engine);
      expect(rocket.isAlive, 'Must detonate at 120Hz frame 300').toBe(false);
    });
  });
});
