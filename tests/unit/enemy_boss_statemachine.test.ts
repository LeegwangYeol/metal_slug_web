import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';

describe('Enemy & Boss State Machine Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
  });

  describe('Rebel Infantry AI: Soldier Roles & State Transitions', () => {
    it('should transition Rifleman through PATROL -> ALERT -> AIM -> FIRE -> COOLDOWN', () => {
      const rifleman = SoldierEnemy.createRifleman('rebel_rifle_1', { x: 300, y: 162 }, {
        patrolMinX: 200,
        patrolMaxX: 400,
      });
      engine.addEntity(rifleman);
      engine.tick();

      expect(rifleman.state).toBe('PATROL');
      expect(rifleman.isAlive).toBe(true);
      expect(rifleman.health).toBe(1);
      expect(rifleman.isMeleeVulnerable).toBe(true);

      // Place player within vision frustum (<= 240px, in front)
      rifleman.facing = -1; // Facing left toward player at x = 150
      rifleman.setTargetPlayer({
        position: { x: 150, y: 162 },
        isAlive: true,
      });

      // 1. Advance tick to trigger ALERT
      rifleman.update(0.05, engine);
      expect(rifleman.state).toBe('ALERT');

      // 2. Advance 0.2s to trigger AIM
      rifleman.update(0.21, engine);
      expect(rifleman.state).toBe('AIM');

      // 3. Advance 0.25s to trigger FIRE
      rifleman.update(0.26, engine);
      expect(rifleman.state).toBe('FIRE');

      // 4. Update during FIRE to spawn rifle burst bullets
      rifleman.update(0.4, engine);
      engine.tick();

      const enemyBullets = engine.getAllEntities().filter((e) => e.type === 'ENEMY_BULLET');
      expect(enemyBullets.length).toBeGreaterThan(0);
      expect(rifleman.state).toBe('COOLDOWN');
    });

    it('should transition Knife Charger from IDLE -> SPRINT -> LEAP_LUNGE -> LAND_RECOVERY', () => {
      // Add platform so isGrounded is physically simulated
      engine.addPlatform({
        id: 'floor',
        type: 'SOLID',
        bounds: { x: 0, y: 200, width: 1000, height: 40 },
      });

      const charger = SoldierEnemy.createKnifeCharger('rebel_knife_1', { x: 200, y: 162 });
      engine.addEntity(charger);
      engine.tick();

      expect(charger.state).toBe('IDLE');
      expect(charger.health).toBe(2);
      expect(charger.isMeleeVulnerable).toBe(true);

      // Player detected at 150px distance (<= 180px detection range)
      charger.setTargetPlayer({
        position: { x: 50, y: 162 },
        isAlive: true,
      });

      // 1. Enters SPRINT
      charger.update(1 / 60, engine);
      expect(charger.state).toBe('SPRINT');
      expect(charger.velocity.x).toBeLessThan(0); // Charging left

      // 2. Close to leap range (<= 65px)
      charger.position.x = 90; // |90 - 50| = 40px <= 65px
      charger.update(1 / 60, engine);
      expect(charger.state).toBe('LEAP_LUNGE');

      // Update into LEAP_LUNGE state
      charger.update(1 / 60, engine);
      expect(charger.isAttackingMelee).toBe(true);
      expect(charger.meleeAttackBox).not.toBeNull();

      // 3. Completes airborne leap arc, lands on ground, and enters LAND_RECOVERY
      // Total jump flight time: 2 * (190 / 720) ≈ 0.53s
      for (let i = 0; i < 36; i++) {
        charger.update(1 / 60, engine);
      }
      expect(charger.state).toBe('LAND_RECOVERY');
      expect(charger.isAttackingMelee).toBe(false);
    });

    it('should transition Grenade Thrower through SEEK_STANDOFF -> PULL_PIN -> WINDUP -> THROW -> COOLDOWN', () => {
      const thrower = SoldierEnemy.createGrenadeThrower('rebel_grenade_1', { x: 300, y: 162 });
      engine.addEntity(thrower);
      engine.tick();

      expect(thrower.role).toBe('GRENADE');
      expect(thrower.health).toBe(2);
      expect(thrower.isMeleeVulnerable).toBe(true);

      // Target player at 160px distance (within 120-220px standoff range)
      thrower.setTargetPlayer({
        position: { x: 140, y: 162 },
        isAlive: true,
      });

      // 1. Standoff satisfied -> PULL_PIN
      thrower.update(0.05, engine);
      expect(thrower.state).toBe('PULL_PIN');

      // 2. 0.3s elapsed -> WINDUP
      thrower.update(0.35, engine);
      expect(thrower.state).toBe('WINDUP');

      // 3. 0.2s elapsed -> THROW and enters COOLDOWN
      thrower.update(0.25, engine);
      expect(thrower.state).toBe('COOLDOWN');

      // Flush engine additions
      engine.tick();
      const grenades = engine.getAllEntities().filter((e) => e.type === 'ENEMY_GRENADE');
      expect(grenades.length).toBeGreaterThan(0);
      expect(grenades[0].velocity.x).toBeLessThan(0); // Tossed left toward player
      expect(grenades[0].velocity.y).toBeLessThan(0); // Upward parabolic arc
    });

    it('should remove dead soldiers from active simulation upon health reaching 0', () => {
      const rifleman = SoldierEnemy.createRifleman('rebel_dead_1', { x: 100, y: 162 });
      engine.addEntity(rifleman);
      engine.tick();

      expect(engine.getAllEntities()).toContain(rifleman);

      // Apply lethal bullet damage
      const damaged = rifleman.takeDamage(1.0, 'bullet');
      expect(damaged).toBe(true);
      expect(rifleman.health).toBe(0);
      expect(rifleman.isAlive).toBe(false);
      expect(rifleman.state).toBe('DEAD');

      // Engine tick marks for removal, second tick purges from collection
      engine.tick();
      engine.tick();
      expect(engine.getAllEntities().filter((e) => e.id === 'rebel_dead_1').length).toBe(0);
    });
  });

  describe('Shield Trooper Frontal Deflection vs Rear & Explosive Vulnerability', () => {
    let trooper: SoldierEnemy;

    beforeEach(() => {
      trooper = SoldierEnemy.createShieldTrooper('shield_1', { x: 200, y: 162 });
      trooper.facing = -1; // Facing LEFT
      engine.addEntity(trooper);
      engine.tick();
    });

    it('should DEFLECT frontal bullets without taking damage', () => {
      expect(trooper.health).toBe(4);

      // Bullet coming from the front (left of trooper, since trooper faces left)
      const frontalOrigin = { x: 150, y: 162 };
      const damaged = trooper.takeDamage(1.0, 'bullet', frontalOrigin);

      expect(damaged).toBe(false); // Deflected!
      expect(trooper.health).toBe(4); // No damage taken
    });

    it('should take full damage from REAR bullet attacks (flanking)', () => {
      expect(trooper.health).toBe(4);

      // Bullet coming from behind (right of trooper, x > 200)
      const rearOrigin = { x: 250, y: 162 };
      const damaged = trooper.takeDamage(1.0, 'bullet', rearOrigin);

      expect(damaged).toBe(true);
      expect(trooper.health).toBe(3); // Damaged!
    });

    it('should take damage and enter STAGGER state from frontal explosive grenades', () => {
      expect(trooper.health).toBe(4);

      const frontalOrigin = { x: 150, y: 162 };
      const damaged = trooper.takeDamage(2.0, 'grenade', frontalOrigin);

      expect(damaged).toBe(true);
      expect(trooper.health).toBe(2);
      expect(trooper.state).toBe('STAGGER');
    });

    it('should be vulnerable to melee knife attacks even from the front', () => {
      expect(trooper.isMeleeVulnerable).toBe(true);

      // Combat knife slash deals 3.0 HP damage
      const damaged = trooper.takeDamage(3.0, 'melee');
      expect(damaged).toBe(true);
      expect(trooper.health).toBe(1);
    });
  });

  describe('Mid-Boss Iron Technical: Turret Tracking, Add Cap & Health Gates', () => {
    let midboss: MidBossVehicle;

    beforeEach(() => {
      midboss = new MidBossVehicle('midboss_1', { x: 400, y: 180 });
      engine.addEntity(midboss);
      engine.tick();
    });

    it('should reject melee knife attacks (isMeleeVulnerable: false)', () => {
      expect(midboss.isMeleeVulnerable).toBe(false);
      const damaged = midboss.takeDamage(3.0, 'melee');
      expect(damaged).toBe(false);
      expect(midboss.health).toBe(400);
    });

    it('should track player with 360° turret slew clamped at max 1.8 rad/s', () => {
      // Point turret directly right initially (0 radians)
      midboss.turretAngle = 0;

      // Place player directly above the vehicle (target angle = -Math.PI / 2 ≈ -1.57 rad)
      const pivot = midboss.getTurretPivot();
      midboss.setTargetPlayer({
        position: { x: pivot.x, y: pivot.y - 100 },
        isAlive: true,
      });

      // Update with dt = 0.5s: max angular step is 1.8 * 0.5 = 0.9 radians
      midboss.update(0.5, engine);

      // Angle should have slewed by exactly -0.9 rad
      expect(midboss.turretAngle).toBeCloseTo(-0.9, 2);
    });

    it('should strictly cap reinforcement troop deployment at 3 active adds', () => {
      expect(midboss.getActiveAddsCount()).toBe(0);

      // Spawn 1st add
      const add1 = midboss.trySpawnTroops(engine);
      expect(add1).not.toBeNull();
      expect(midboss.getActiveAddsCount()).toBe(1);

      // Spawn 2nd add
      const add2 = midboss.trySpawnTroops(engine);
      expect(add2).not.toBeNull();
      expect(midboss.getActiveAddsCount()).toBe(2);

      // Spawn 3rd add
      const add3 = midboss.trySpawnTroops(engine);
      expect(add3).not.toBeNull();
      expect(midboss.getActiveAddsCount()).toBe(3);

      // 4th spawn attempt MUST be rejected by add cap
      const add4 = midboss.trySpawnTroops(engine);
      expect(add4).toBeNull();
      expect(midboss.getActiveAddsCount()).toBe(3);

      // Kill one add
      add1!.health = 0;
      add1!.isAlive = false;

      // Now 4th spawn attempt succeeds
      const replacementAdd = midboss.trySpawnTroops(engine);
      expect(replacementAdd).not.toBeNull();
      expect(midboss.getActiveAddsCount()).toBe(3);
    });

    it('should enforce Health Gate 1 (240 HP) on burst damage and prevent skipping Phase 2', () => {
      expect(midboss.health).toBe(400);
      expect(midboss.phase).toBe('PHASE_1_PATROL');

      // Attempt to deal 300 damage in a single frame (400 - 300 = 100, which would skip Phase 2)
      midboss.takeDamage(300, 'bullet');

      // Health Gate 1 clamps HP at 240
      expect(midboss.health).toBe(240);
      expect(midboss.phase).toBe('GATE_1_TRANSITION');

      // While gate transition is active, damage is locked
      const damagedDuringGate = midboss.takeDamage(50, 'bullet');
      expect(damagedDuringGate).toBe(false);
      expect(midboss.health).toBe(240);

      // Advance past gate timer (1.0s) into Phase 2
      midboss.update(1.1, engine);
      expect(midboss.phase).toBe('PHASE_2_MORTAR');
    });

    it('should enforce Health Gate 2 (80 HP) and progress to Phase 3 Ramming and Destruction', () => {
      // Jump directly to Phase 2 for focused gate 2 test
      midboss.phase = 'PHASE_2_MORTAR';
      midboss.health = 240;

      // Burst damage of 200 HP (240 - 200 = 40, below Gate 2 of 80 HP)
      midboss.takeDamage(200, 'bullet');

      // Clamped at 80 HP
      expect(midboss.health).toBe(80);
      expect(midboss.phase).toBe('GATE_2_TRANSITION');

      // Advance past gate timer (0.8s) into Phase 3
      midboss.update(0.9, engine);
      expect(midboss.phase).toBe('PHASE_3_RAMMING');

      // Deplete final 80 HP
      midboss.takeDamage(80, 'bullet');
      expect(midboss.health).toBe(0);
      expect(midboss.phase).toBe('DESTRUCTION_SEQUENCE');

      // Advance past destruction timer (0.8s) -> WRECKAGE
      midboss.update(0.85, engine);
      expect(midboss.phase).toBe('WRECKAGE');
      expect(midboss.isAlive).toBe(false);
    });
  });

  describe('Stage 1 End-Boss: Tetsuyuki War Fortress Multi-Phase Progression', () => {
    let boss: TetsuyukiBoss;

    beforeEach(() => {
      boss = new TetsuyukiBoss('tetsuyuki_1', { x: 360, y: 50 });
      engine.addEntity(boss);
      engine.tick();
    });

    it('should start in PHASE_1_ARTILLERY with full health (400 HP) and 2 turrets alive', () => {
      expect(boss.health).toBe(400);
      expect(boss.maxHealth).toBe(400);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');
      expect(boss.turretsAlive).toBe(2);
      expect(boss.weakPointExposed).toBe(false);
      expect(boss.isAlive).toBe(true);
    });

    it('should transition to PHASE_2_LASER_SWEEP when health drops below 260 HP (65%)', () => {
      // Deal 200 damage (400 -> clamped at 260 HP threshold)
      boss.takeDamage(200);

      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.turretsAlive).toBe(1);

      // Verify laser cycle starts and hull breach flag is activated
      boss.update(0.1, engine);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.isHullBreached).toBe(true);
    });

    it('should transition to PHASE_3_MELTDOWN when health drops below 120 HP (30%) and expose core weak point', () => {
      // Transition through phase 2 to phase 3
      boss.takeDamage(200); // clamps at 260 HP (Phase 2)
      boss.takeDamage(200); // 260 - 200 <= 120 -> clamps at 120 HP (Phase 3)

      expect(boss.health).toBe(120);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
      expect(boss.turretsAlive).toBe(0);
      expect(boss.weakPointExposed).toBe(true);
      expect(boss.weakPointBox.width).toBe(48);
      expect(boss.weakPointBox.height).toBe(48);
    });

    it('should scale damage in Phase 3: 1.5x on exposed core vs 0.25x on armored superstructure', () => {
      // Set to Phase 3
      boss.phase = 'PHASE_3_MELTDOWN';
      boss.health = 400;

      // 1. Hit to armored hull (isWeakPoint = false): 100 dmg * 0.25 = 25 effective damage
      boss.takeDamage(100, false);
      expect(boss.health).toBe(375); // 400 - 25 = 375

      // 2. Hit to exposed core weak point (isWeakPoint = true): 100 dmg * 1.5 = 150 effective damage
      boss.takeDamage(100, true);
      expect(boss.health).toBe(225); // 375 - 150 = 225
    });

    it('should execute 4-stage timed death explosion sequence over 3.2s culminating in DESTROYED state', () => {
      boss.phase = 'PHASE_3_MELTDOWN';
      boss.health = 100;

      // Apply lethal damage to core
      boss.takeDamage(100, true);
      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.deathStage).toBe(1);

      // Stage 1: t in [0.0s, 0.8s) - localized sparks
      boss.update(0.4, engine);
      expect(boss.deathStage).toBe(1);
      expect(boss.phase).toBe('DEATH_EXPLODING');

      // Stage 2: t in [0.8s, 2.0s) - armor tear fireballs & camera shake
      boss.update(0.6, engine); // total t = 1.0s
      expect(boss.deathStage).toBe(2);
      expect(boss.screenShakeOffset).not.toBe(0);

      // Stage 3: t in [2.0s, 3.2s) - reactor core shockwave ring
      boss.update(1.2, engine); // total t = 2.2s
      expect(boss.deathStage).toBe(3);

      // Stage 4: t >= 3.2s - final collapse and DESTROYED state
      boss.update(1.1, engine); // total t = 3.3s
      expect(boss.deathStage).toBe(4);
      expect(boss.phase).toBe('DESTROYED');
      expect(boss.isAlive).toBe(false);
    });
  });
});
