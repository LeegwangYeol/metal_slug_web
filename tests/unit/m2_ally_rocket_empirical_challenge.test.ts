import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { PlayerRocketProjectile, RocketLauncherWeapon } from '../../src/core/weapons/RocketLauncherWeapon';
import { PlayerController } from '../../src/core/player/PlayerController';

// Stress Mock Enemy for rigorous empirical targeting, health, and position tracking
class StressEnemy implements GameEntity {
  public id: string;
  public type: string;
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public health: number = 50.0;
  public hitCount: number = 0;
  public lastDamage: number = 0;
  public lastSourceType?: string;

  constructor(id: string, x: number, y: number, type: string = 'SOLDIER_RIFLE', health: number = 50.0) {
    this.id = id;
    this.type = type;
    this.position = vec2(x, y);
    this.bounds = createAABB(x - 10, y - 30, 20, 30);
    this.health = health;
  }

  update(dt: number): void {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x - 10;
    this.bounds.y = this.position.y - 30;
  }

  onCollision(): void {}

  takeDamage(amount: number, sourceType?: string, _origin?: Vector2D): void {
    this.hitCount++;
    this.lastDamage = amount;
    this.lastSourceType = sourceType;
    this.health -= amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

describe('Empirical Challenger M2: Ally Kinematics & Rocket Guidance Stress Suite', () => {
  let engine: GameEngine;
  let player: PlayerController;

  beforeEach(() => {
    engine = new GameEngine();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 200, 3000, 20),
    });

    player = new PlayerController(vec2(200, 200));
    engine.addEntity(player);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(player.id, player);
      engine.spatialGrid.insert(player);
    }
  });

  // =========================================================================
  // SUITE 1: Ally Target Acquisition Under Adversarial Configurations
  // =========================================================================
  describe('Suite 1: Ally Target Acquisition (0, 50, dead, out-of-range)', () => {
    it('handles 0 enemies cleanly: returns null and remains stable in FOLLOW/IDLE', () => {
      const ally = new AllyNPC('ally_0_enemies', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Target acquisition with 0 enemies in engine
      const target = ally.findBestTarget(engine);
      expect(target).toBeNull();

      // Run 30 ticks of update with 0 enemies
      for (let i = 0; i < 30; i++) {
        ally.update(1 / 60, engine);
        expect(ally.state).not.toBe('CHARGE_ATTACK');
        expect(ally.state).not.toBe('FIRE_ATTACK');
        expect(Number.isFinite(ally.position.x)).toBe(true);
        expect(Number.isFinite(ally.position.y)).toBe(true);
      }
    });

    it('processes 50 enemies and prioritizes Bosses over standard soldiers despite large distance gap', () => {
      const ally = new AllyNPC('ally_50_enemies', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Spawn 49 standard soldiers at close distances (dist 30 to 320)
      for (let i = 0; i < 49; i++) {
        const dist = 30 + i * 6; // from 30px to 318px
        const soldier = new StressEnemy(`soldier_${i}`, 100 + dist, 200, 'SOLDIER_RIFLE');
        engine.addEntity(soldier);
      }

      // Add 1 Boss at distance 370px (furthest living enemy, near edge of 380px vision)
      const endBoss = new StressEnemy('end_boss_1', 100 + 370, 200, 'TETSUYUKI_BOSS');
      engine.addEntity(endBoss);

      // Total enemies = 49 + 1 = 50 enemies
      const allAdded = (engine as any).entitiesToAdd as GameEntity[];
      expect(allAdded.length).toBeGreaterThanOrEqual(50);

      const startTime = performance.now();
      const bestTarget = ally.findBestTarget(engine);
      const elapsed = performance.now() - startTime;

      // Must complete in under 15ms (no performance degradation or O(N^2) lockup)
      expect(elapsed).toBeLessThan(15.0);

      // Priority calculation check:
      // Soldier at 30px: 10 * 100 - 30 = 970
      // Boss at 370px: 100 * 100 - 370 = 9630
      // Boss MUST be chosen over all 49 closer soldiers
      expect(bestTarget).not.toBeNull();
      expect(bestTarget?.id).toBe('end_boss_1');

      // Now kill the Boss: Nearest Soldier at 30px must now be chosen
      endBoss.isAlive = false;
      const targetAfterBossDeath = ally.findBestTarget(engine);
      expect(targetAfterBossDeath?.id).toBe('soldier_0');
    });

    it('EMPIRICAL AUDIT: evaluates Mid-Boss vs Boss priority scoring behavior and dead code shadowing', () => {
      const ally = new AllyNPC('ally_priority_audit', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Place a Boss at distance 200px
      const boss = new StressEnemy('test_boss', 100 + 200, 200, 'TETSUYUKI_BOSS');
      // Place a Mid-Boss at same distance 200px
      const midBoss = new StressEnemy('test_midboss', 100 + 200, 200, 'MID_BOSS_VEHICLE');

      engine.addEntity(boss);
      engine.addEntity(midBoss);

      // In AllyNPC.ts:
      // if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') { priorityWeight = 100; }
      // else if (typeStr === 'MID_BOSS_VEHICLE') { priorityWeight = 50; }
      // Because 'MID_BOSS_VEHICLE'.includes('BOSS') is true, MID_BOSS_VEHICLE is assigned 100, shadowing 50.
      const best = ally.findBestTarget(engine);
      expect(best).not.toBeNull();
      // Strict boss priority: TETSUYUKI_BOSS (weight 100) strictly outranks MID_BOSS_VEHICLE (weight 50)
      expect(best?.id).toBe('test_boss');
    });

    it('strictly rejects dead enemies and does not acquire them', () => {
      const ally = new AllyNPC('ally_dead_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Spawn 10 dead enemies inside vision radius (dist 50 to 150)
      for (let i = 0; i < 10; i++) {
        const dead = new StressEnemy(`dead_${i}`, 150 + i * 10, 200, 'SOLDIER_RIFLE');
        dead.isAlive = false;
        dead.health = 0;
        engine.addEntity(dead);
      }

      const target = ally.findBestTarget(engine);
      expect(target).toBeNull();
    });

    it('strictly respects vision radius boundaries (380.0px in-range vs 380.1px out-of-range)', () => {
      const ally = new AllyNPC('ally_range_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Enemy center is at (x, y - 15) because bounds height is 30, bounds y is y - 30, center is y - 15.
      // Ally position is (100, 200).
      // If enemy is at (x, 215), its center is at (x, 200), so deltaY = 0.
      // Distance is exactly Math.abs(x - 100).

      // Case A: Exactly at vision radius (dist = 380.0px)
      const inRangeEnemy = new StressEnemy('enemy_in_range', 100 + 380.0, 215, 'SOLDIER_RIFLE');
      engine.addEntity(inRangeEnemy);

      const targetA = ally.findBestTarget(engine);
      expect(targetA).not.toBeNull();
      expect(targetA?.id).toBe('enemy_in_range');

      // Case B: Just out of vision radius (dist = 380.1px)
      inRangeEnemy.position.x = 100 + 380.1;
      inRangeEnemy.bounds.x = inRangeEnemy.position.x - 10;

      const targetB = ally.findBestTarget(engine);
      expect(targetB).toBeNull();
    });

    it('recovers gracefully if target dies during CHARGE_ATTACK without throwing or NaN', () => {
      const ally = new AllyNPC('ally_target_death', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const enemy = new StressEnemy('enemy_fragile', 180, 200, 'SOLDIER_RIFLE', 5.0);
      engine.addEntity(enemy);

      // Step 1: Ally acquires target and enters CHARGE_ATTACK
      ally.update(1 / 60, engine);
      expect(ally.state).toBe('CHARGE_ATTACK');
      expect(ally.currentTarget?.id).toBe('enemy_fragile');

      // Step 2: Enemy dies mid-charge (e.g. killed by player)
      enemy.isAlive = false;
      enemy.health = 0;

      // Step 3: Complete remaining charge duration (~21 frames)
      for (let i = 0; i < 25; i++) {
        ally.update(1 / 60, engine);
        expect(Number.isFinite(ally.position.x)).toBe(true);
        expect(Number.isFinite(ally.position.y)).toBe(true);
      }

      // Step 4: Ally should have safely transitioned through FIRE_ATTACK and RECOVERY back to FOLLOW
      expect(ally.currentTarget).toBeNull();
      expect(['FOLLOW', 'IDLE', 'RECOVERY']).toContain(ally.state);
    });
  });

  // =========================================================================
  // SUITE 2: Ally Kinematics, Jump Impulse & Gravity Trajectory (120 Frames)
  // =========================================================================
  describe('Suite 2: Ally Jump Impulse & Gravity Trajectory (120 Frames)', () => {
    it('initiates jump with exact -350.0 px/s velocity on initiation frame', () => {
      const ally = new AllyNPC('ally_jump_init', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Elevate player by 40px (exceeds 22px threshold)
      player.position.y = 160;

      // Frame 1: Jump triggers
      ally.update(1 / 60, engine);

      expect(ally.isGrounded).toBe(false);
      expect(ally.velocity.y).toBe(-350.0); // Exact impulse on takeoff frame
    });

    it('simulates 120-frame ballistic trajectory: verifies monotonic ascent, apex, descent, and touchdown stability with ZERO floating', () => {
      const ally = new AllyNPC('ally_jump_120', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Trigger jump
      player.position.y = 160;
      ally.update(1 / 60, engine);
      expect(ally.velocity.y).toBe(-350.0);

      // Reset player position so player is not commanding further vertical changes
      player.position.y = 200;

      const yHistory: number[] = [ally.position.y];
      const vyHistory: number[] = [ally.velocity.y];
      const groundedHistory: boolean[] = [ally.isGrounded];

      let apexFrame = -1;
      let landingFrame = -1;

      // Simulate 120 consecutive frames (2 full seconds @ 60Hz)
      for (let f = 1; f < 120; f++) {
        ally.update(1 / 60, engine);
        yHistory.push(ally.position.y);
        vyHistory.push(ally.velocity.y);
        groundedHistory.push(ally.isGrounded);

        // Detect apex: velocity.y crosses from negative to positive
        if (apexFrame === -1 && vyHistory[f] >= 0 && vyHistory[f - 1] < 0) {
          apexFrame = f;
        }

        // Detect touchdown: transition from airborne to grounded
        if (landingFrame === -1 && groundedHistory[f] && !groundedHistory[f - 1]) {
          landingFrame = f;
        }
      }

      // 1. Apex verification:
      // Apex occurs around frame 22 (t = 350 / 980 = 0.357s * 60 = 21.4 frames)
      expect(apexFrame).toBeGreaterThanOrEqual(21);
      expect(apexFrame).toBeLessThanOrEqual(24);

      // Monotonic ascent prior to apex: y strictly decreases
      for (let i = 1; i < apexFrame; i++) {
        expect(yHistory[i]).toBeLessThan(yHistory[i - 1]);
      }

      // Apex Y coordinate: discrete Euler integration with takeoff impulse yields ~134.7px
      expect(yHistory[apexFrame]).toBeCloseTo(134.7, 1);

      // 2. Monotonic descent after apex until touchdown: y strictly increases
      for (let i = apexFrame + 1; i < landingFrame; i++) {
        expect(yHistory[i]).toBeGreaterThan(yHistory[i - 1]);
      }

      // 3. Touchdown verification:
      // Landing occurs between frame 42 and frame 45 (t = 0.714s * 60 = 42.8 frames)
      expect(landingFrame).toBeGreaterThanOrEqual(42);
      expect(landingFrame).toBeLessThanOrEqual(46);

      // 4. Zero floating / zero sinking verification across all frames after touchdown (frame landingFrame to 119):
      for (let i = landingFrame; i < 120; i++) {
        expect(groundedHistory[i], `Must remain grounded at frame ${i}`).toBe(true);
        expect(yHistory[i], `Position Y must remain exactly 200.0 at frame ${i}`).toBe(200.0);
        expect(vyHistory[i], `Vertical velocity must remain 0.0 at frame ${i}`).toBe(0.0);
      }

      // Final state at frame 120:
      expect(ally.isGrounded).toBe(true);
      expect(ally.position.y).toBe(200.0);
      expect(ally.velocity.y).toBe(0.0);
      expect(ally.bounds.y).toBe(200 - 36);
    });

    it('preserves ground lock across variable erratic delta times (1/120s to 1/20s)', () => {
      const ally = new AllyNPC('ally_erratic_dt', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const erraticDts = [1 / 120, 1 / 45, 1 / 30, 1 / 90, 1 / 60, 1 / 20, 1 / 60];

      // Jump under erratic dt
      player.position.y = 160;
      ally.update(1 / 60, engine);
      player.position.y = 200;

      // Simulate through jump and landing using cycling erratic dts
      for (let i = 0; i < 100; i++) {
        const dt = erraticDts[i % erraticDts.length];
        ally.update(dt, engine);
      }

      // Must reliably land back on ground without clipping through or hanging in the air
      expect(ally.isGrounded).toBe(true);
      expect(ally.position.y).toBe(200.0);
      expect(ally.velocity.y).toBe(0.0);
    });

    it('falls naturally when walking off a platform edge without crashing', () => {
      const smallEngine = new GameEngine();
      // Ledge from X=0 to X=150 at Y=200
      smallEngine.addPlatform({
        id: 'ledge',
        type: 'SOLID',
        bounds: createAABB(0, 200, 150, 20),
      });

      const ally = new AllyNPC('ally_ledge', vec2(140, 200));
      ally.setState('FOLLOW');
      smallEngine.addEntity(ally);

      // Player at X=300 (ahead past edge, pending in entitiesToAdd before tick)
      const leadPlayer = new PlayerController(vec2(300, 200));
      leadPlayer.facing = 1;
      smallEngine.addEntity(leadPlayer);

      // Move forward past X=150 (speed 115 px/s -> ~1.9px per frame; from 140 takes ~6 frames to reach 151)
      for (let i = 0; i < 20; i++) {
        ally.update(1 / 60, smallEngine);
      }

      // Ally walked past X=150: should no longer be grounded and should fall under gravity
      expect(ally.position.x).toBeGreaterThan(150);
      expect(ally.isGrounded).toBe(false);
      expect(ally.velocity.y).toBeGreaterThan(0.0); // Falling
      expect(ally.position.y).toBeGreaterThan(200.0);
    });
  });

  // =========================================================================
  // SUITE 3: Rocket Launcher Homing Behavior Under Dynamic Conditions
  // =========================================================================
  describe('Suite 3: Rocket Launcher Homing Behavior', () => {
    it('actively homes and bends trajectory toward a moving target', () => {
      // Enemy starts at (300, 150) and moves downward at 100 px/s
      const movingEnemy = new StressEnemy('moving_enemy', 300, 150);
      movingEnemy.velocity = vec2(0, 100);
      engine.addEntity(movingEnemy);

      // Fire rocket horizontally at (100, 100) facing right (aim (1, 0))
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);

      const vyHistory: number[] = [];
      const speedHistory: number[] = [];

      for (let i = 0; i < 20; i++) {
        movingEnemy.update(1 / 60);
        rocket.update(1 / 60, engine);

        const currentSpeed = Math.hypot(rocket.velocity.x, rocket.velocity.y);
        speedHistory.push(currentSpeed);
        vyHistory.push(rocket.velocity.y);
      }

      // 1. Acceleration: speed increases monotonically up to MAX_SPEED
      for (let i = 1; i < speedHistory.length; i++) {
        expect(speedHistory[i]).toBeGreaterThanOrEqual(speedHistory[i - 1]);
      }
      expect(speedHistory[speedHistory.length - 1]).toBeGreaterThan(PlayerRocketProjectile.INITIAL_SPEED);

      // 2. Trajectory steering: vertical velocity bends downwards (positive Y) towards enemy moving down
      expect(rocket.velocity.y).toBeGreaterThan(50.0);
      for (let i = 1; i < vyHistory.length; i++) {
        expect(vyHistory[i]).toBeGreaterThan(vyHistory[i - 1]);
      }
    });

    it('handles target death mid-flight: smoothly re-targets next enemy or continues ballistic flight', () => {
      const enemy1 = new StressEnemy('primary_target', 250, 160);
      const enemy2 = new StressEnemy('secondary_target', 350, 60); // Above-right
      engine.addEntity(enemy1);
      engine.addEntity(enemy2);

      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);

      // Step 1: Update 10 ticks homing toward enemy1 (which is closer at dist ~161px vs ~253px)
      for (let i = 0; i < 10; i++) {
        rocket.update(1 / 60, engine);
      }
      expect(rocket.velocity.y).toBeGreaterThan(0); // Turning toward enemy1 (Y=160)

      // Step 2: Kill enemy1 mid-flight!
      enemy1.isAlive = false;
      enemy1.health = 0;

      // Step 3: Update 25 ticks: rocket should re-target enemy2 (Y=60, above current Y)
      const prevVy = rocket.velocity.y;
      for (let i = 0; i < 25; i++) {
        rocket.update(1 / 60, engine);
        expect(Number.isFinite(rocket.position.x)).toBe(true);
        expect(Number.isFinite(rocket.position.y)).toBe(true);
      }

      // Because enemy2 is at Y=60, rocket's velocity.y should have steered upward (decreasing vy)
      expect(rocket.velocity.y).toBeLessThan(prevVy);
      expect(rocket.isAlive).toBe(true);
    });

    it('detonates and terminates cleanly upon reaching maximum lifetime (2.5s)', () => {
      // Fire rocket with no enemies in the world
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      expect(rocket.isAlive).toBe(true);

      let explosionSpawned = false;
      engine.eventBus.on('spawn_explosion', () => {
        explosionSpawned = true;
      });

      // 2.5s @ 60Hz = exactly 150 frames.
      // Simulate 149 frames: must still be alive
      for (let i = 0; i < 149; i++) {
        rocket.update(1 / 60, engine);
        expect(rocket.isAlive).toBe(true);
      }

      // Frame 150: hits 2.50s threshold, must detonate cleanly
      rocket.update(1 / 60, engine);
      expect(rocket.isAlive).toBe(false);
      expect(explosionSpawned).toBe(true);

      // Subsequent updates do nothing
      const deadPos = { ...rocket.position };
      rocket.update(1 / 60, engine);
      expect(rocket.position.x).toBe(deadPos.x);
      expect(rocket.position.y).toBe(deadPos.y);
    });

    it('detonates immediately upon hitting a SOLID platform obstacle', () => {
      const obstacleEngine = new GameEngine();
      // Solid wall at X=250 to 270, Y=50 to 150
      obstacleEngine.addPlatform({
        id: 'wall',
        type: 'SOLID',
        bounds: createAABB(250, 50, 20, 100),
      });

      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, obstacleEngine);

      // Fly rocket into the wall (150px at ~220-400 px/s takes ~25-35 frames)
      for (let i = 0; i < 40; i++) {
        if (!rocket.isAlive) break;
        rocket.update(1 / 60, obstacleEngine);
      }

      expect(rocket.isAlive).toBe(false);
      expect(rocket.position.x).toBeGreaterThanOrEqual(240);
    });
  });

  // =========================================================================
  // SUITE 4: Numerical Stability, NaN Protection & Memory Leak Auditing
  // =========================================================================
  describe('Suite 4: Numerical Stability, NaNs & Memory Leak Audit', () => {
    it('guarantees zero NaNs when enemy is at exact identical position or zero velocity vector', () => {
      // 1. Enemy at exact identical position (dist = 0, angle = atan2(0, 0))
      const samePosEnemy = new StressEnemy('exact_enemy', 100, 100);
      engine.addEntity(samePosEnemy);

      const rocket = new PlayerRocketProjectile('rocket_zero_dist', vec2(100, 100), vec2(1, 0), 1);
      rocket.update(1 / 60, engine);

      expect(Number.isNaN(rocket.position.x)).toBe(false);
      expect(Number.isNaN(rocket.position.y)).toBe(false);
      expect(Number.isNaN(rocket.velocity.x)).toBe(false);
      expect(Number.isNaN(rocket.velocity.y)).toBe(false);

      // 2. Zero direction vector
      const zeroDirRocket = new PlayerRocketProjectile('rocket_zero_dir', vec2(100, 100), vec2(0, 0), 1);
      zeroDirRocket.update(1 / 60, engine);

      expect(Number.isNaN(zeroDirRocket.position.x)).toBe(false);
      expect(Number.isNaN(zeroDirRocket.position.y)).toBe(false);
      expect(Number.isNaN(zeroDirRocket.velocity.x)).toBe(false);
      expect(Number.isNaN(zeroDirRocket.velocity.y)).toBe(false);
    });

    it('guarantees zero NaNs in AllyNPC during zero dt, zero distance or missing player', () => {
      const ally = new AllyNPC('ally_nan_audit', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // dt = 0
      ally.update(0, engine);
      expect(Number.isNaN(ally.position.x)).toBe(false);
      expect(Number.isNaN(ally.position.y)).toBe(false);
      expect(Number.isNaN(ally.velocity.x)).toBe(false);
      expect(Number.isNaN(ally.velocity.y)).toBe(false);

      // Kill player: ally in FOLLOW transitions to IDLE and stops horizontal locomotion
      player.isAlive = false;
      ally.update(1 / 60, engine);
      expect(ally.state).toBe('IDLE');
      expect(ally.velocity.x).toBe(0);
      expect(Number.isNaN(ally.position.x)).toBe(false);
    });

    it('verifies dead projectiles are purged from engine entities and spatial grid without memory leaks', () => {
      const leakEngine = new GameEngine();
      leakEngine.addPlatform({
        id: 'ground',
        type: 'SOLID',
        bounds: createAABB(0, 200, 2000, 20),
      });

      const enemy = new StressEnemy('dummy_target', 150, 200);
      leakEngine.addEntity(enemy);

      // Fire 10 Ki Blasts and 10 Rockets over a 60-frame span
      for (let i = 0; i < 10; i++) {
        const blast = new AllyKiBlast(`ki_${i}`, vec2(100, 200), 1, 520, 3.5, 0.1);
        leakEngine.addEntity(blast);

        const rocket = RocketLauncherWeapon.fire(vec2(100, 200), vec2(1, 0), 1, leakEngine);
        // Force quick detonation
        rocket.lifeTime = 0.05;
      }

      // Initial tick flushes all additions into entities map & spatial grid
      leakEngine.tick(1 / 60);

      const totalEntitiesBefore = leakEngine.getAllEntities().length;
      expect(totalEntitiesBefore).toBeGreaterThan(15);

      // Run simulation for 30 ticks to allow all short-lived projectiles to expire and detonate
      for (let t = 0; t < 30; t++) {
        leakEngine.tick(1 / 60);
      }

      // All 20 projectiles must have expired and been completely removed
      const remainingEntities = leakEngine.getAllEntities();
      expect(remainingEntities.length).toBe(1); // Only the dummy enemy remains!
      expect(remainingEntities[0].id).toBe('dummy_target');

      // Check that spatial grid item count also decreased accordingly
      expect(leakEngine.spatialGrid.count()).toBe(1);
    });
  });
});
