import { describe, it, expect } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { DeathCorpseManager } from '../../src/core/entities/enemies/DeathCorpseManager';
import { PlayerController } from '../../src/core/player/PlayerController';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';

describe('Adversarial Challenge: Varied Death Animations & Decoupled Corpse Simulation (R2 & R3)', () => {
  // =========================================================================
  // 1. High-Volume Stress Test: 150 Simultaneous Casualties, Corpse Pool & Zero Leaks
  // =========================================================================
  it('HIGH-VOLUME STRESS TEST: 150 simultaneous mixed casualties maintain corpse pool bounds and zero engine leaks', () => {
    const engine = new GameEngine();
    engine.start();
    const corpseManager = new DeathCorpseManager(engine);

    const roles: Array<'SOLDIER_RIFLE' | 'SOLDIER_KNIFE' | 'SOLDIER_GRENADE' | 'SOLDIER_SHIELD'> = [
      'SOLDIER_RIFLE',
      'SOLDIER_KNIFE',
      'SOLDIER_GRENADE',
      'SOLDIER_SHIELD',
    ];

    const damageTypes: Array<'bullet' | 'explosion' | 'fire' | 'melee'> = [
      'bullet',
      'explosion',
      'fire',
      'melee',
    ];

    const totalSoldiers = 150;
    const soldiers: SoldierEnemy[] = [];

    for (let i = 0; i < totalSoldiers; i++) {
      const roleType = roles[i % roles.length];
      const soldier = new SoldierEnemy(`stress_soldier_${i}`, roleType, vec2(100 + (i % 20) * 15, 192));
      soldiers.push(soldier);
      engine.addEntity(soldier);
    }

    // Process pending additions into engine entity collection
    engine.tick(1 / 60);
    expect(engine.getAllEntities().length).toBe(totalSoldiers);

    // Simultaneously eliminate all 150 soldiers with mixed damage types
    for (let i = 0; i < totalSoldiers; i++) {
      const dmgType = damageTypes[i % damageTypes.length];
      const s = soldiers[i];
      const damageAmount = 10; // lethal to all roles
      const blastOrigin = dmgType === 'explosion' ? vec2(s.position.x - 20, s.position.y) : undefined;
      s.takeDamage(damageAmount, dmgType, blastOrigin);
    }

    // Invariant: All 150 soldiers must be strictly dead immediately
    for (let i = 0; i < totalSoldiers; i++) {
      const s = soldiers[i];
      expect(s.isAlive).toBe(false);
      expect(s.health).toBe(0);
      expect(s.state).toBe('DEAD');
    }

    // Engine dead entity culling:
    // Tick 1 marks dead entities in entityIdsToRemove
    // Tick 2 flushes entityIdsToRemove and purges from engine.entities
    engine.tick(1 / 60);
    engine.tick(1 / 60);
    expect(engine.getAllEntities().length).toBe(0);

    // Corpse manager pool bound: MAX_CORPSES = 32 prevents unbounded memory accumulation
    const activeCorpses = corpseManager.getActiveCorpses();
    expect(activeCorpses.length).toBeLessThanOrEqual(32);
    expect(corpseManager.getCorpseCount()).toBeLessThanOrEqual(32);

    // Run simulation loop forward: all corpses have duration <= 1.30s
    // Step forward 1.5s in 0.05s steps
    for (let step = 0; step < 30; step++) {
      corpseManager.update(0.05);
    }

    // After 1.5s, all active corpses must be fully expired and culled
    expect(corpseManager.getCorpseCount()).toBe(0);
    expect(corpseManager.getRenderStates().length).toBe(0);
  });

  // =========================================================================
  // 2. Immediate isAlive === false invariant across all 4 soldier roles
  // =========================================================================
  it('ROLE INVARIANT: Immediate death state and event emission across all 4 soldier archetypes', () => {
    const engine = new GameEngine();
    engine.start();
    const emittedEvents: any[] = [];
    engine.eventBus.on('enemy_death', (evt: any) => {
      emittedEvents.push(evt);
    });

    const archetypes: Array<{ type: any; role: string; hp: number }> = [
      { type: 'SOLDIER_RIFLE', role: 'RIFLE', hp: 1 },
      { type: 'SOLDIER_KNIFE', role: 'KNIFE', hp: 2 },
      { type: 'SOLDIER_GRENADE', role: 'GRENADE', hp: 2 },
      { type: 'SOLDIER_SHIELD', role: 'SHIELD', hp: 4 },
    ];

    archetypes.forEach(({ type, role, hp }, idx) => {
      const soldier = new SoldierEnemy(`role_soldier_${idx}`, type, vec2(200, 192));
      engine.addEntity(soldier);
      engine.tick(1 / 60);

      expect(soldier.isAlive).toBe(true);
      expect(soldier.health).toBe(hp);

      // Melee is lethal to all roles
      soldier.takeDamage(hp, 'melee');

      expect(soldier.isAlive).toBe(false);
      expect(soldier.health).toBe(0);
      expect(soldier.state).toBe('DEAD');
      expect(soldier.role).toBe(role);
    });

    expect(emittedEvents.length).toBe(4);
  });

  // =========================================================================
  // 3. Explosion Blowback Ballistic Kinematics, Tumbling & Detached Helmet Physics
  // =========================================================================
  describe('Explosion Blowback Ballistic Kinematics & Detached Helmet Physics', () => {
    it('Rightward blast impulse: vx = +200, vy = -300, angularVelocity = +8.5, detached helmet launch', () => {
      const manager = new DeathCorpseManager();
      const corpse = manager.spawnCorpse({
        id: 'blowback_right',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: vec2(300, 192),
        velocity: vec2(0, 0),
        facing: -1,
        deathType: 'explosion',
        origin: vec2(250, 200), // Epicenter on the left -> blowback to the right (+1)
      });

      expect(corpse.deathType).toBe('explosion');
      expect(corpse.facing).toBe(1);
      expect(corpse.vx).toBe(200);
      expect(corpse.vy).toBe(-300);
      expect(corpse.angularVelocity).toBe(8.5);
      expect(corpse.isGrounded).toBe(false);
      expect(corpse.duration).toBe(1.10);

      // Verify detached helmet initial physics
      expect(corpse.helmet).toBeDefined();
      const helmet = corpse.helmet!;
      expect(helmet.vx).toBe(240);
      expect(helmet.vy).toBe(-360);
      expect(helmet.angularVelocity).toBe(18.0);
      expect(helmet.isGrounded).toBe(false);

      // Step simulation mid-air (0.1s)
      const prevY = corpse.y;
      const prevRot = corpse.rotation;
      const prevHelmetY = helmet.y;
      const prevHelmetRot = helmet.rotation;

      manager.update(0.1);

      // Corpse position and rotation check
      expect(corpse.x).toBeCloseTo(300 + 200 * 0.1, 1);
      // vy integrates: -300 + 720 * 0.1 = -228 px/s, y should move upward initially (y < prevY)
      expect(corpse.y).toBeLessThan(prevY);
      expect(corpse.rotation).toBeGreaterThan(prevRot);
      expect(corpse.rotation).toBeCloseTo(0.85, 2);

      // Helmet check: vy integrates -360 + 648 * 0.1 = -295.2 px/s
      expect(helmet.y).toBeLessThan(prevHelmetY);
      expect(helmet.rotation).toBeGreaterThan(prevHelmetRot);
      expect(helmet.rotation).toBeCloseTo(1.8, 2);

      // Advance to ground impact (~0.86s). At t = 0.90s (16 steps of 0.05s after initial 0.1s):
      for (let i = 0; i < 16; i++) {
        manager.update(0.05);
      }

      // Corpse has made ground contact: isGrounded is true, rotation reset, angularVelocity zeroed
      expect(corpse.isGrounded).toBe(true);
      expect(corpse.angularVelocity).toBe(0);
      expect(corpse.rotation).toBe(0);
      // Recoil bounce keeps y within 3px of ground plane (200 - 30)
      expect(corpse.y).toBeGreaterThanOrEqual(corpse.groundY - 35);
      expect(corpse.y).toBeLessThanOrEqual(corpse.groundY - 30 + 5);

      // Dust particles spawned on ground impact
      expect(corpse.particles.length).toBeGreaterThan(0);
    });

    it('Leftward blast impulse: epicenter on right reverses horizontal & angular velocities', () => {
      const manager = new DeathCorpseManager();
      const corpse = manager.spawnCorpse({
        id: 'blowback_left',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: vec2(300, 192),
        velocity: vec2(0, 0),
        facing: 1,
        deathType: 'explosion',
        origin: vec2(350, 200), // Epicenter on right -> blast impulse to left (-1)
      });

      expect(corpse.facing).toBe(-1);
      expect(corpse.vx).toBe(-200);
      expect(corpse.vy).toBe(-300);
      expect(corpse.angularVelocity).toBe(-8.5);

      expect(corpse.helmet).toBeDefined();
      expect(corpse.helmet!.vx).toBe(-240);
      expect(corpse.helmet!.vy).toBe(-360);
      expect(corpse.helmet!.angularVelocity).toBe(-18.0);

      manager.update(0.1);
      expect(corpse.x).toBeLessThan(300);
      expect(corpse.rotation).toBeLessThan(0);
      expect(corpse.helmet!.rotation).toBeLessThan(0);
    });
  });

  // =========================================================================
  // 4. Flamethrower Burning Death: Strict Stage Transitions (Thrash -> Charcoal -> Ash)
  // =========================================================================
  describe('Flamethrower Burning Death Progression', () => {
    it('Transitions through Thrash (0-0.65s), Charcoal (0.65-0.95s), and Ash (0.95-1.30s)', () => {
      const manager = new DeathCorpseManager();
      const corpse = manager.spawnCorpse({
        id: 'burning_soldier',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: vec2(200, 192),
        velocity: vec2(0, 0),
        facing: 1,
        deathType: 'fire',
      });

      expect(corpse.deathType).toBe('fire');
      expect(corpse.stage).toBe('thrash');
      expect(corpse.isGrounded).toBe(true);
      expect(corpse.duration).toBe(1.30);
      expect(corpse.alpha).toBe(1.0);

      // Phase 1: Agonized Thrashing (0.00s - 0.64s)
      manager.update(0.1);
      expect(corpse.stage).toBe('thrash');
      expect(corpse.frame).toBe(Math.floor(corpse.elapsedTime * 8) % 2);

      manager.update(0.2); // total 0.3s
      expect(corpse.stage).toBe('thrash');
      // Verify flame particles emitted
      expect(corpse.particles.some((p) => ['#FFF060', '#FFA010', '#E84800', '#FF7700'].includes(p.color))).toBe(true);

      // Phase 2: Charred Charcoal Silhouette (0.65s - 0.94s)
      manager.update(0.4); // total 0.7s
      expect(corpse.stage).toBe('charcoal');
      expect(corpse.frame).toBe(0);

      // Phase 3: Crumbling Ash (0.95s - 1.30s)
      manager.update(0.3); // total 1.0s
      expect(corpse.stage).toBe('ash');
      expect(corpse.frame).toBe(0); // t < 1.10s -> frame 0

      manager.update(0.15); // total 1.15s
      expect(corpse.stage).toBe('ash');
      expect(corpse.frame).toBe(1); // t >= 1.10s -> frame 1
      expect(corpse.alpha).toBeLessThan(1.0); // fading out in final 0.20s

      // Expiration check (> 1.30s)
      manager.update(0.2); // total 1.35s
      expect(manager.getCorpseCount()).toBe(0);
    });
  });

  // =========================================================================
  // 5. Player Damage Collision & Invulnerability Window (Bug-03 Remediation)
  // =========================================================================
  describe('Player Damage Collision Remediation (Bug-03)', () => {
    it('Player takes damage and loses a life upon enemy bullet collision', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController();
      player.position = { x: 200, y: 192 };
      player.bounds = createAABB(200, 192, 24, 38);
      player.health = 1.0;
      player.lives = 3;
      player.invulnerabilityTimer = 0;
      engine.addEntity(player);
      engine.tick(1 / 60);

      // Create enemy bullet colliding with player
      const enemyBullet: GameEntity = {
        id: 'enemy_bullet_1',
        type: 'ENEMY_BULLET',
        position: { x: 205, y: 195 },
        velocity: { x: -300, y: 0 },
        bounds: createAABB(205, 195, 6, 6),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(enemyBullet);
      engine.tick(1 / 60);

      // Trigger collision
      player.onCollision(enemyBullet, engine);

      // Verify damage application
      expect(player.lives).toBe(2); // Lost 1 life
      expect(player.health).toBe(player.maxHealth); // Respawned with full health
      expect(player.invulnerabilityTimer).toBe(2.0); // 2 seconds of respawn invulnerability
      expect(enemyBullet.isAlive).toBe(false); // Bullet destroyed
    });

    it('Invulnerability timer protects player from back-to-back bullet collisions', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController();
      player.position = { x: 200, y: 192 };
      player.bounds = createAABB(200, 192, 24, 38);
      player.health = 1.0;
      player.lives = 2;
      player.invulnerabilityTimer = 1.5; // Currently invulnerable
      engine.addEntity(player);
      engine.tick(1 / 60);

      const secondBullet: GameEntity = {
        id: 'enemy_bullet_2',
        type: 'ENEMY_BULLET',
        position: { x: 205, y: 195 },
        velocity: { x: -300, y: 0 },
        bounds: createAABB(205, 195, 6, 6),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(secondBullet);
      engine.tick(1 / 60);

      player.onCollision(secondBullet, engine);

      // Lives and health must remain unchanged while invulnerable
      expect(player.lives).toBe(2);
      expect(player.health).toBe(1.0);
    });

    it('Player takes damage from SoldierEnemy melee attack box', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController();
      player.position = { x: 200, y: 230 }; // Standing foot anchor at terrain y = 230
      player.bounds = createAABB(188, 192, 24, 38);
      player.health = 1.0;
      player.lives = 3;
      player.invulnerabilityTimer = 0;
      engine.addEntity(player);

      const knifeSoldier = SoldierEnemy.createKnifeCharger('knife_attacker', vec2(215, 192));
      engine.addEntity(knifeSoldier);

      // Flush additions so engine.getEntity('player') resolves
      engine.tick(1 / 60);

      // Trigger melee attack with attack box overlapping player torso (y in [192, 230])
      (knifeSoldier as any).isAttackingMelee = true;
      (knifeSoldier as any).meleeAttackBox = createAABB(185, 195, 30, 30);

      // Run soldier update
      knifeSoldier.update(1 / 60, engine);

      // Player must have taken melee damage
      expect(player.lives).toBe(2);
      expect(player.invulnerabilityTimer).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 6. Shield Trooper Frontal vs Weakness Verification
  // =========================================================================
  describe('Shield Trooper Directional Armor & Weakness Suite', () => {
    it('Deflects frontal bullets, but takes rear, grenade, flame, and melee damage', () => {
      const engine = new GameEngine();
      engine.start();

      // Shield trooper facing left (-1) at x = 200
      const shieldTrooper = SoldierEnemy.createShieldTrooper('shield_unit', vec2(200, 192));
      shieldTrooper.facing = -1;
      engine.addEntity(shieldTrooper);
      engine.tick(1 / 60);

      const initialHp = shieldTrooper.health; // 4 HP

      // 1. Frontal bullet: attacker at x = 100 (in front of facing -1)
      const deflected = shieldTrooper.takeDamage(1, 'bullet', vec2(100, 192));
      expect(deflected).toBe(false);
      expect(shieldTrooper.health).toBe(initialHp);

      // 2. Rear bullet: attacker at x = 300 (behind facing -1)
      const rearHit = shieldTrooper.takeDamage(1, 'bullet', vec2(300, 192));
      expect(rearHit).toBe(true);
      expect(shieldTrooper.health).toBe(initialHp - 1);

      // 3. Frontal grenade explosion: damages and causes STAGGER
      const explosionHit = shieldTrooper.takeDamage(1, 'explosion', vec2(100, 192));
      expect(explosionHit).toBe(true);
      expect(shieldTrooper.state).toBe('STAGGER');

      // 4. Flame attack: pierces shield
      const flameHit = shieldTrooper.takeDamage(1, 'fire', vec2(100, 192));
      expect(flameHit).toBe(true);

      // 5. Melee knife attack: pierces shield
      const meleeHit = shieldTrooper.takeDamage(1, 'melee', vec2(100, 192));
      expect(meleeHit).toBe(true);
      expect(shieldTrooper.health).toBe(0);
      expect(shieldTrooper.isAlive).toBe(false);
    });
  });

  // =========================================================================
  // 7. Mid-Boss Add Ground Coordinate Integrity (Bug-05 Remediation)
  // =========================================================================
  describe('Mid-Boss Add Coordinate Integrity (Bug-05)', () => {
    it('Guarantees midboss_add_ entities strictly spawn at y = 192 with ground line contact at y+38 = 230', () => {
      const midBossAdd = new SoldierEnemy('midboss_add_001', 'SOLDIER_RIFLE', vec2(900, 230), {
        cameraX: 720,
      });

      expect(midBossAdd.position.y).toBe(192);
      expect(midBossAdd.bounds.y).toBe(192);
      expect(midBossAdd.position.y + midBossAdd.bounds.height).toBe(230);
      expect(midBossAdd.position.x).toBeGreaterThanOrEqual(1220);
    });
  });
});
