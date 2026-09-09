import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { PlayerController } from '../../src/core/player/PlayerController';
import { UltimateManager, UltimatePhase } from '../../src/core/player/UltimateManager';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { IronNokanaBoss } from '../../src/core/entities/boss/IronNokanaBoss';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { CrisisEventManager } from '../../src/core/entities/boss/CrisisEventManager';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { PowEntity, PowState } from '../../src/core/entities/pow/PowEntity';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { StageManager } from '../../src/core/engine/StageManager';

function flushEntities(engine: GameEngine): void {
  const toAdd = (engine as any).entitiesToAdd;
  if (toAdd && toAdd.length > 0) {
    for (const entity of toAdd) {
      (engine as any).entities.set(entity.id, entity);
      (engine as any).spatialGrid.insert(entity);
    }
    (engine as any).entitiesToAdd = [];
  }
}

describe('Adversarial Challenge: Ultimate Move System & Edge Cases', () => {
  let engine: GameEngine;
  let stageManager: StageManager;
  let player: PlayerController;
  let ultimateManager: UltimateManager;

  const defaultViewport = { x: 0, y: 0, width: 480, height: 270 };

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    stageManager = new StageManager(engine);
    (engine as any).cameraX = 0;

    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 220, 3000, 50),
    });

    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);
    flushEntities(engine);

    ultimateManager = new UltimateManager({
      initialStock: 1,
      maxStock: 3,
      freezeDuration: 0.5,
      strikeDuration: 0.6,
      detonationDuration: 0.4,
      recoveryDuration: 0.3,
      bossDamage: 120,
    });
  });

  // =========================================================================
  // FOCUS 1: Viewport Boundary Edge Cases (cameraX + 479 vs cameraX + 481)
  // =========================================================================
  describe('Focus 1: Viewport Boundary Edge Cases (479 vs 481)', () => {
    it('minion at cameraX + 479 is eliminated while minion at cameraX + 481 is strictly preserved (cameraX = 0)', () => {
      (engine as any).cameraX = 0;
      const camX = 0;

      // Minion at cameraX + 479 (x = 479, y = 180, width = 24, height = 38)
      // Bounds: x in [479, 503]. Viewport right edge is 480. 479 < 480 -> INTERSECTS!
      const minionInside = new SoldierEnemy('m_edge_479', 'SOLDIER_RIFLE', vec2(camX + 479, 180));

      // Minion at cameraX + 481 (x = 481, y = 180, width = 24, height = 38)
      // Bounds: x in [481, 505]. Viewport right edge is 480. 481 < 480 is FALSE -> OUTSIDE!
      const minionOutside = new SoldierEnemy('m_edge_481', 'SOLDIER_RIFLE', vec2(camX + 481, 180));

      engine.addEntity(minionInside);
      engine.addEntity(minionOutside);
      flushEntities(engine);

      expect(minionInside.isAlive).toBe(true);
      expect(minionOutside.isAlive).toBe(true);

      ultimateManager.trigger(engine);
      // Advance to detonation (freeze 30 ticks + strike pass 36 ticks = 66 ticks)
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }

      // Assert strict boundary outcome
      expect(minionInside.isAlive).toBe(false);
      expect(minionInside.health).toBe(0);

      expect(minionOutside.isAlive).toBe(true);
      expect(minionOutside.health).toBe(minionOutside.maxHealth);
    });

    it('minion at cameraX + 479 is eliminated while minion at cameraX + 481 is strictly preserved under scrolling camera (cameraX = 250)', () => {
      const camX = 250;
      (engine as any).cameraX = camX;
      const scrolledViewport = { x: camX, y: 0, width: 480, height: 270 };

      // Viewport spans [250, 730]. Right edge is 250 + 480 = 730.
      // cameraX + 479 = 250 + 479 = 729 (< 730 -> intersects)
      const minionInside = new SoldierEnemy('m_scroll_479', 'SOLDIER_RIFLE', vec2(camX + 479, 180));

      // cameraX + 481 = 250 + 481 = 731 (> 730 -> outside)
      const minionOutside = new SoldierEnemy('m_scroll_481', 'SOLDIER_RIFLE', vec2(camX + 481, 180));

      engine.addEntity(minionInside);
      engine.addEntity(minionOutside);
      flushEntities(engine);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, scrolledViewport);
      }

      expect(minionInside.isAlive).toBe(false);
      expect(minionInside.health).toBe(0);

      expect(minionOutside.isAlive).toBe(true);
      expect(minionOutside.health).toBe(minionOutside.maxHealth);
    });

    it('boundary point at exactly cameraX + 480 is strictly preserved (non-intersecting)', () => {
      const camX = 0;
      const minionExactBoundary = new SoldierEnemy('m_edge_480', 'SOLDIER_RIFLE', vec2(camX + 480, 180));
      engine.addEntity(minionExactBoundary);
      flushEntities(engine);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }

      // x = 480 is not < 480, so it does not intersect
      expect(minionExactBoundary.isAlive).toBe(true);
      expect(minionExactBoundary.health).toBe(minionExactBoundary.maxHealth);
    });

    it('tests left boundary edges: cameraX - 23 (eliminated) vs cameraX - 25 (preserved) for width=24 minion', () => {
      const camX = 200;
      (engine as any).cameraX = camX;
      const viewport = { x: camX, y: 0, width: 480, height: 270 };

      // Left edge is 200. Minion width is 24.
      // x = 200 - 23 = 177 -> x + width = 201 > 200 (overlaps left edge -> eliminated)
      const minionLeftOverlap = new SoldierEnemy('m_left_overlap', 'SOLDIER_RIFLE', vec2(camX - 23, 180));

      // x = 200 - 25 = 175 -> x + width = 199 < 200 (outside left edge -> preserved)
      const minionLeftOutside = new SoldierEnemy('m_left_outside', 'SOLDIER_RIFLE', vec2(camX - 25, 180));

      engine.addEntity(minionLeftOverlap);
      engine.addEntity(minionLeftOutside);
      flushEntities(engine);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(minionLeftOverlap.isAlive).toBe(false);
      expect(minionLeftOutside.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // FOCUS 2: Stock Limits & Rapid Input Spam / Re-triggering Rejection
  // =========================================================================
  describe('Focus 2: Stock Limits & Rapid Double-Tap KeyU Rejection', () => {
    it('strictly rejects trigger activation when stock is 0', () => {
      ultimateManager.stock = 0;
      expect(ultimateManager.canTrigger()).toBe(false);

      const success = ultimateManager.trigger(engine);
      expect(success).toBe(false);
      expect(ultimateManager.stock).toBe(0);
      expect(ultimateManager.phase).toBe(UltimatePhase.IDLE);
      expect(ultimateManager.isSimulationFrozen).toBe(false);

      // Verify no events fired on rejected activation
      let eventFired = false;
      engine.eventBus.on('ultimate_freeze_started', () => { eventFired = true; });
      ultimateManager.trigger(engine);
      expect(eventFired).toBe(false);
    });

    it('PlayerController input handler rejects KeyU when stock is 0', () => {
      player.ultimateManager.stock = 0;

      const input = {
        left: false, right: false, up: false, down: false,
        jumpPressed: false, jumpHeld: false,
        shootPressed: false, shootHeld: false,
        grenadePressed: false,
        ultimatePressed: true,
      };

      player.handleInput(input, 1 / 60, engine);
      expect(player.ultimateManager.stock).toBe(0);
      expect(player.ultimateManager.phase).toBe(UltimatePhase.IDLE);
    });

    it('rapid double-tap KeyU during FREEZE phase is rejected without duplicate execution or stock loss', () => {
      ultimateManager.stock = 3;

      // 1st Tap: Successful activation
      const firstTrigger = ultimateManager.trigger(engine);
      expect(firstTrigger).toBe(true);
      expect(ultimateManager.stock).toBe(2);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);

      // Track duplicate event emissions
      let duplicateFreezeEvents = 0;
      engine.eventBus.on('ultimate_freeze_started', () => { duplicateFreezeEvents++; });

      // 2nd Tap on same or next tick while in FREEZE
      expect(ultimateManager.canTrigger()).toBe(false);
      const secondTrigger = ultimateManager.trigger(engine);
      expect(secondTrigger).toBe(false);
      expect(ultimateManager.stock).toBe(2); // Stock remains 2!
      expect(duplicateFreezeEvents).toBe(0);

      // Repeated spam during freeze (10 successive calls)
      for (let spam = 0; spam < 10; spam++) {
        expect(ultimateManager.trigger(engine)).toBe(false);
        expect(ultimateManager.stock).toBe(2);
      }
    });

    it('rapid double-tap KeyU during STRIKE_PASS phase is rejected without duplicate execution or stock loss', () => {
      ultimateManager.stock = 3;
      ultimateManager.trigger(engine);
      expect(ultimateManager.stock).toBe(2);

      // Advance through Freeze into Strike Pass
      for (let i = 0; i < 31; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.STRIKE_PASS);

      // Tap during Strike Pass
      const midStrikeTrigger = ultimateManager.trigger(engine);
      expect(midStrikeTrigger).toBe(false);
      expect(ultimateManager.stock).toBe(2);
      expect(ultimateManager.phase).toBe(UltimatePhase.STRIKE_PASS);
    });

    it('rapid KeyU spam during DETONATION and RECOVERY phases is strictly rejected', () => {
      ultimateManager.stock = 2;
      ultimateManager.trigger(engine);
      expect(ultimateManager.stock).toBe(1);

      // Fast forward to Detonation
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.DETONATION);

      // Spam in Detonation
      expect(ultimateManager.trigger(engine)).toBe(false);
      expect(ultimateManager.stock).toBe(1);

      // Advance to Recovery
      for (let i = 0; i < 24; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.RECOVERY);

      // Spam in Recovery
      expect(ultimateManager.trigger(engine)).toBe(false);
      expect(ultimateManager.stock).toBe(1);

      // Finish recovery back to IDLE
      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.IDLE);
      expect(ultimateManager.canTrigger()).toBe(true);

      // Now 2nd legitimate activation succeeds
      expect(ultimateManager.trigger(engine)).toBe(true);
      expect(ultimateManager.stock).toBe(0);
    });
  });

  // =========================================================================
  // FOCUS 3: Friendly Safety at Detonation Epicenter
  // =========================================================================
  describe('Focus 3: Friendly Safety at Detonation Epicenter', () => {
    it('Player, Ally NPC, Ally Ki Blast, and POW hostages at the detonation epicenter take ZERO damage while hostile entities are destroyed', () => {
      const epicenter = vec2(240, 135); // Exact center of the 480x270 viewport

      // 1. Player at epicenter with 1 HP and 2 shield charges
      player.position = vec2(epicenter.x, epicenter.y);
      player.bounds.x = epicenter.x;
      player.bounds.y = epicenter.y;
      player.health = 1.0;
      player.shieldCharges = 2;

      // 2. Ally NPC (Hyakutaro Ichimonji) at epicenter
      const ally = new AllyNPC('ally_companion', vec2(epicenter.x, epicenter.y));
      engine.addEntity(ally);

      // 3. Ally Ki Blast projectile at epicenter (airborne)
      const kiBlast = new AllyKiBlast('friendly_ki', vec2(epicenter.x, 80), 1);
      engine.addEntity(kiBlast);

      // 4. POW Hostage (Tied up) at epicenter
      const powTied = new PowEntity('pow_tied', vec2(epicenter.x, epicenter.y), ItemDropType.WEAPON_SHOTGUN);
      engine.addEntity(powTied);

      // 5. Hostile minion at same epicenter
      const hostileMinion = new SoldierEnemy('hostile_minion', 'SOLDIER_RIFLE', vec2(epicenter.x + 30, epicenter.y));
      engine.addEntity(hostileMinion);

      // 6. Hostile projectile at same epicenter
      const hostileBullet: GameEntity = {
        id: 'hostile_bullet_center',
        type: 'ENEMY_BULLET',
        position: vec2(epicenter.x, epicenter.y),
        velocity: vec2(-150, 0),
        bounds: createAABB(epicenter.x, epicenter.y, 6, 6),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(hostileBullet);

      // 7. Hostile artillery shell at same epicenter
      const hostileShell: GameEntity = {
        id: 'hostile_shell_center',
        type: 'ARTILLERY_SHELL',
        position: vec2(epicenter.x, epicenter.y),
        velocity: vec2(0, 200),
        bounds: createAABB(epicenter.x, epicenter.y, 8, 8),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(hostileShell);

      flushEntities(engine);

      // Trigger Ultimate Move & Advance to Detonation
      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }

      // Assert Friendly Safety:
      // Player: 0 damage, 0 shield loss, alive
      expect(player.isAlive).toBe(true);
      expect(player.health).toBe(1.0);
      expect(player.shieldCharges).toBe(2);

      // Ally NPC: alive
      expect(ally.isAlive).toBe(true);

      // Ally projectile: alive
      expect(kiBlast.isAlive).toBe(true);

      // POW Hostage: alive and still tied up / rescuable
      expect(powTied.isAlive).toBe(true);
      expect(powTied.state).toBe(PowState.TIED_UP);

      // Assert Hostile Destruction:
      expect(hostileMinion.isAlive).toBe(false);
      expect(hostileMinion.health).toBe(0);
      expect(hostileBullet.isAlive).toBe(false);
      expect(hostileShell.isAlive).toBe(false);
      expect(engine.getAllEntities().some(e => e.id === 'hostile_bullet_center')).toBe(false);
      expect(engine.getAllEntities().some(e => e.id === 'hostile_shell_center')).toBe(false);
    });

    it('POW hostage in freed state takes zero damage during detonation', () => {
      const powFreed = new PowEntity('pow_freed', vec2(200, 180), ItemDropType.MEDKIT);
      powFreed.state = PowState.FREED;
      engine.addEntity(powFreed);
      flushEntities(engine);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }

      expect(powFreed.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // FOCUS 4: Boss Burst Damage & Health Phases Non-Corruption
  // =========================================================================
  describe('Focus 4: Boss Burst Damage & Health Phases Integrity', () => {
    it('applies exactly 120 burst damage to Iron Nokana Boss and respects Phase 1 -> Phase 2 gate at 300 HP', () => {
      const nokana = new IronNokanaBoss('nokana_test', vec2(280, 100), {
        customHp: 400,
        patrolMinX: 100,
        patrolMaxX: 400,
      });
      engine.addEntity(nokana);
      flushEntities(engine);

      expect(nokana.health).toBe(400);
      expect(nokana.phase).toBe('PHASE_1_CRAWLER_BARRAGE');

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, defaultViewport);
      }

      // 400 - 120 = 280, clamped to 300 HP (75% gate)
      expect(nokana.health).toBe(300);
      expect(nokana.phase).toBe('PHASE_2_FLAME_SWEEP');
      expect(nokana.isAlive).toBe(true);
    });

    it('multi-strike sequence transitions Iron Nokana cleanly through all 4 phases without corrupting health or skipping', () => {
      const nokana = new IronNokanaBoss('nokana_phases', vec2(280, 100), {
        customHp: 400,
        patrolMinX: 100,
        patrolMaxX: 400,
      });
      engine.addEntity(nokana);
      flushEntities(engine);

      // Strike 1: Phase 1 (400) -> Phase 2 (300)
      ultimateManager.executeDetonation(engine, 0);
      expect(nokana.health).toBe(300);
      expect(nokana.phase).toBe('PHASE_2_FLAME_SWEEP');
      expect(nokana.isAlive).toBe(true);

      // Strike 2: Phase 2 (300) -> Phase 3 (200) (300 - 120 = 180 <= 200 gate)
      ultimateManager.executeDetonation(engine, 0);
      expect(nokana.health).toBe(200);
      expect(nokana.phase).toBe('PHASE_3_GIRIDA_DEPLOY');
      expect(nokana.isAlive).toBe(true);

      // Strike 3: Phase 3 (200) -> Phase 4 (100) (200 - 120 = 80 <= 100 gate)
      ultimateManager.executeDetonation(engine, 0);
      expect(nokana.health).toBe(100);
      expect(nokana.phase).toBe('PHASE_4_OVERDRIVE_RAGE');
      expect(nokana.isRaging).toBe(true);
      expect(nokana.isAlive).toBe(true);

      // Strike 4: Phase 4 (100) -> Death (0) (100 - 120 = -20 <= 0)
      ultimateManager.executeDetonation(engine, 0);
      expect(nokana.health).toBe(0);
      expect(nokana.phase).toBe('DEATH_EXPLODING');
    });

    it('CrisisEventManager coordinates with Iron Nokana under 120 burst damage without missing or corrupting crisis events', () => {
      const crisisManager = new CrisisEventManager(engine, stageManager);
      crisisManager.registerDefaultCrises('ground', 100);

      const nokana = new IronNokanaBoss('nokana_crisis', vec2(280, 100), {
        customHp: 400,
        patrolMinX: 100,
        patrolMaxX: 400,
      });
      engine.addEntity(nokana);
      flushEntities(engine);
      crisisManager.setBoss(nokana);

      // Initial state
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(false);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(false);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(false);

      // Strike 1: 400 -> 300 HP (75% threshold reached)
      ultimateManager.executeDetonation(engine, 0);
      crisisManager.update(1 / 60, nokana, engine, stageManager);

      expect(nokana.health).toBe(300);
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(false);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(false);

      // Strike 2: 300 -> 200 HP (50% threshold reached)
      ultimateManager.executeDetonation(engine, 0);
      crisisManager.update(1 / 60, nokana, engine, stageManager);

      expect(nokana.health).toBe(200);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(false);

      // Strike 3: 200 -> 100 HP (25% threshold reached)
      ultimateManager.executeDetonation(engine, 0);
      crisisManager.update(1 / 60, nokana, engine, stageManager);

      expect(nokana.health).toBe(100);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(true);
    });

    it('TetsuyukiBoss absorbs 120 burst damage correctly and transitions phases cleanly', () => {
      const tetsuyuki = new TetsuyukiBoss('tetsuyuki_burst', vec2(200, 50));
      tetsuyuki.health = 400;
      tetsuyuki.maxHealth = 400;
      engine.addEntity(tetsuyuki);
      flushEntities(engine);

      // Strike 1: 400 - 120 = 280 HP (p1Threshold = 260 HP, so health is 280)
      ultimateManager.executeDetonation(engine, 0);
      expect(tetsuyuki.health).toBe(280);
      expect(tetsuyuki.phase).toBe('PHASE_1_ARTILLERY');

      // Strike 2: 280 - 120 = 160 HP (p1Threshold = 260 HP, clamped to 260, transitions to Phase 2)
      ultimateManager.executeDetonation(engine, 0);
      expect(tetsuyuki.health).toBe(260);
      expect(tetsuyuki.phase).toBe('PHASE_2_LASER_SWEEP');
    });

    it('MidBossVehicle absorbs 120 burst damage with Gate 1 preservation', () => {
      const midboss = new MidBossVehicle('midboss_burst', vec2(280, 160));
      midboss.health = 400;
      midboss.maxHealth = 400;
      engine.addEntity(midboss);
      flushEntities(engine);

      // Strike 1: 400 - 120 = 280 HP (> 240 Gate 1)
      ultimateManager.executeDetonation(engine, 0);
      expect(midboss.health).toBe(280);
      expect(midboss.phase).toBe('PHASE_1_PATROL');

      // Strike 2: 280 - 120 = 160 HP (<= 240 Gate 1, clamped to 240)
      ultimateManager.executeDetonation(engine, 0);
      expect(midboss.health).toBe(240);
      expect(midboss.phase).toBe('GATE_1_TRANSITION');
    });

    it('simultaneously clears 100% of on-screen minions while dealing exactly 120 burst damage to the boss', () => {
      const nokana = new IronNokanaBoss('boss_with_minions', vec2(300, 100), {
        customHp: 400,
        patrolMinX: 100,
        patrolMaxX: 400,
      });
      const minion1 = new SoldierEnemy('m_guard_1', 'SOLDIER_RIFLE', vec2(150, 190));
      const minion2 = new SoldierEnemy('m_guard_2', 'SOLDIER_SHIELD', vec2(220, 190));
      const minion3 = new SoldierEnemy('m_guard_3', 'SOLDIER_GRENADE', vec2(400, 190));

      engine.addEntity(nokana);
      engine.addEntity(minion1);
      engine.addEntity(minion2);
      engine.addEntity(minion3);
      flushEntities(engine);

      const result = ultimateManager.executeDetonation(engine, 0);

      expect(result.minionsCleared).toBe(3);
      expect(result.bossesHit).toBe(1);
      expect(result.bossDamageDealt).toBe(120);

      expect(minion1.isAlive).toBe(false);
      expect(minion2.isAlive).toBe(false);
      expect(minion3.isAlive).toBe(false);

      expect(nokana.isAlive).toBe(true);
      expect(nokana.health).toBe(300);
    });
  });
});
