import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { StageManager, StageData } from '../../src/core/engine/StageManager';
import { CrisisEventManager } from '../../src/core/entities/boss/CrisisEventManager';
import { IronNokanaBoss } from '../../src/core/entities/boss/IronNokanaBoss';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import {
  ArtilleryShellHazard,
  FallingDebrisHazard,
  GroundFlameHazard,
} from '../../src/core/entities/boss/EnvironmentalHazard';
import { PlayerController } from '../../src/core/player/PlayerController';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';

describe('Milestone M1: Epic Bosses & Dynamic Crisis Events Suite', () => {
  let engine: GameEngine;
  let stageManager: StageManager;
  let crisisManager: CrisisEventManager;

  const makePlatform = (id: string, x: number, y: number, w: number, h: number, type: 'SOLID' | 'SEMI_SOLID' = 'SOLID'): Platform => ({
    id,
    type,
    bounds: createAABB(x, y, w, h),
  });

  const createMockStage = (): StageData => ({
    id: 'stage_1_boss_arena',
    name: 'Boss Arena Stage',
    width: 2400,
    height: 300,
    initialCameraBounds: { minX: 1800, maxX: 2280, minY: 0, maxY: 270 },
    platforms: [
      makePlatform('boss_arena_floor', 1800, 230, 480, 20),
      makePlatform('boss_arena_left', 1860, 170, 100, 12),
      makePlatform('boss_arena_right', 2100, 170, 100, 12),
    ],
    triggers: [],
  });

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    stageManager = new StageManager(engine);
    stageManager.loadStage(createMockStage());
    stageManager.lockCamera({ minX: 1800, maxX: 2280, minY: 0, maxY: 270 });

    crisisManager = new CrisisEventManager(engine, stageManager);
    crisisManager.registerDefaultCrises('boss_arena_left', 1880);
  });

  describe('1. Boss Health Threshold Checkpoints (75%, 50%, 25%)', () => {
    it('should trigger CRISIS_ARTILLERY_STRIKE when boss HP reaches <= 75%', () => {
      const boss = new IronNokanaBoss('boss_nokana_1', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(false);
      expect(crisisManager.isCrisisTriggered('crisis_artillery_75')).toBe(false);

      // Inflict 99 damage (301 HP / 400 = 75.25%) -> not triggered
      boss.takeDamage(99);
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(false);

      // Inflict 1 damage (300 HP / 400 = 75.0%) -> triggers artillery crisis
      boss.takeDamage(1);
      crisisManager.update(1 / 60);

      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('crisis_artillery_75')).toBe(true);
      // Other thresholds remain un-triggered
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(false);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(false);
    });

    it('should trigger CRISIS_TERRAIN_COLLAPSE when boss HP reaches <= 50%', () => {
      const boss = new IronNokanaBoss('boss_nokana_2', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      // Inflict damage down to 200 HP (50%): 100 in P1, 100 in P2
      boss.takeDamage(100);
      boss.takeDamage(100);
      crisisManager.update(1 / 60);

      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('crisis_collapse_50')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(false);
    });

    it('should trigger CRISIS_RAGE_OVERDRIVE when boss HP reaches <= 25%', () => {
      const boss = new IronNokanaBoss('boss_nokana_3', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      // Inflict damage down to 100 HP (25%): 100 in P1, 100 in P2, 100 in P3
      boss.takeDamage(100);
      boss.takeDamage(100);
      boss.takeDamage(100);
      crisisManager.update(1 / 60);

      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('crisis_rage_25')).toBe(true);
    });
  });

  describe('2. Environmental Hazard Generation at 75% HP', () => {
    it('75% HP threshold must spawn concrete ArtilleryShellHazard entities in GameEngine', () => {
      const boss = new IronNokanaBoss('boss_nokana_hazards', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      boss.takeDamage(100); // 300 HP = 75%
      crisisManager.update(1 / 60);
      engine.tick(1 / 60); // Process additions

      const allEntities = engine.getAllEntities();
      const shells = allEntities.filter(
        (e) => e instanceof ArtilleryShellHazard || e.type === 'ENVIRONMENTAL_HAZARD'
      ) as ArtilleryShellHazard[];

      expect(shells.length).toBeGreaterThanOrEqual(4);

      const firstShell = shells[0];
      expect(firstShell.type).toBe('ENVIRONMENTAL_HAZARD');
      expect(firstShell.hazardSubtype).toBe('ARTILLERY_SHELL');
      expect(firstShell.velocity.y).toBeGreaterThan(0);
      expect(firstShell.damage).toBe(2);
      expect(firstShell.blastRadius).toBeGreaterThanOrEqual(40);
    });

    it('artillery shells must fall and detonate upon reaching ground level', () => {
      const shell = new ArtilleryShellHazard('test_shell_detonation', 1950, 200, 400, 230);
      engine.addEntity(shell);
      engine.tick(1 / 60);

      let explosionEmitted = false;
      engine.eventBus.on('explosion_spawned', (data: any) => {
        explosionEmitted = true;
        expect(data.radius).toBe(55);
        expect(data.damage).toBe(2);
      });

      // Update for 0.1s -> shell moves from 200 to 200 + 400*0.1 = 240 >= 230 targetGroundY
      engine.tick(0.1);

      expect(shell.isAlive).toBe(false);
      expect(explosionEmitted).toBe(true);
    });
  });

  describe('3. Dynamic Arena & Platform Collapse at 50% HP', () => {
    it('50% HP threshold must collapse boss_arena_left platform and contract camera bounds', () => {
      const boss = new IronNokanaBoss('boss_nokana_collapse', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      // Check pre-collapse platforms
      expect(stageManager.getPlatforms().some((p) => p.id === 'boss_arena_left')).toBe(true);
      expect(engine.getPlatforms().some((p) => p.id === 'boss_arena_left')).toBe(true);
      expect(stageManager.getCameraBounds().minX).toBe(1800);

      let collapseEventFired = false;
      engine.eventBus.on('platform_collapsed', (data: any) => {
        collapseEventFired = true;
        expect(data.platformId).toBe('boss_arena_left');
      });

      // Damage boss to 50%: 100 in P1, 100 in P2
      boss.takeDamage(100);
      boss.takeDamage(100);
      crisisManager.update(1 / 60);

      // Assert platform is removed from both StageManager and GameEngine
      expect(stageManager.getPlatforms().some((p) => p.id === 'boss_arena_left')).toBe(false);
      expect(engine.getPlatforms().some((p) => p.id === 'boss_arena_left')).toBe(false);
      expect(collapseEventFired).toBe(true);

      // Assert camera bounds contracted from 1800 to 1880
      expect(stageManager.getCameraBounds().minX).toBe(1880);
      expect(stageManager.getCameraBounds().maxX).toBe(2280);

      // Assert falling debris hazards were added
      engine.tick(1 / 60);
      const debris = engine.getAllEntities().filter((e) => e instanceof FallingDebrisHazard);
      expect(debris.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('4. Rage State Activation at 25% HP', () => {
    it('25% HP threshold must put boss into Rage Overdrive and spawn GroundFlameHazard', () => {
      const boss = new IronNokanaBoss('boss_nokana_rage', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      expect(boss.isRaging).toBe(false);

      // Inflict damage down to 100 HP (25%): 100 in P1, 100 in P2, 100 in P3
      boss.takeDamage(100);
      boss.takeDamage(100);
      boss.takeDamage(100);
      crisisManager.update(1 / 60);

      expect(boss.isRaging).toBe(true);
      expect(boss.rageSpeedMultiplier).toBe(1.5);

      engine.tick(1 / 60);
      const flames = engine.getAllEntities().filter((e) => e instanceof GroundFlameHazard);
      expect(flames.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Robustness Under Massive Burst Damage (Sequential Clamping)', () => {
    it('should fire all three crisis events in strict order under 5000 burst damage', () => {
      const boss = new IronNokanaBoss('boss_burst', vec2(2050, 90), { customHp: 400 });
      crisisManager.setBoss(boss);

      const triggeredOrder: string[] = [];
      engine.eventBus.on('crisis_event_triggered', (data: any) => {
        triggeredOrder.push(data.id);
      });

      // Massive single hit damage
      boss.takeDamage(5000);
      crisisManager.update(1 / 60);

      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
      expect(crisisManager.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE')).toBe(true);

      // Verify sequential execution order (75% -> 50% -> 25%)
      expect(triggeredOrder).toEqual([
        'CRISIS_ARTILLERY_STRIKE',
        'CRISIS_TERRAIN_COLLAPSE',
        'CRISIS_RAGE_OVERDRIVE',
      ]);
    });
  });

  describe('6. Player Collision with Environmental Hazards', () => {
    it('player taking direct hit from ArtilleryShellHazard takes damage', () => {
      const player = new PlayerController(vec2(1900, 200));
      player.health = 5;
      player.maxHealth = 5;
      player.invulnerabilityTimer = 0;
      engine.addEntity(player);

      const initialHealth = player.health;
      const shell = new ArtilleryShellHazard('shell_player_hit', 1900, 200, 0, 230);
      engine.addEntity(shell);
      engine.tick(1 / 60);

      // Trigger collision
      player.onCollision(shell, engine);

      expect(player.health).toBeLessThan(initialHealth);
      expect(shell.isAlive).toBe(false);
    });
  });

  describe('7. Decoupled Compatibility with TetsuyukiBoss', () => {
    it('works seamlessly with TetsuyukiBoss as well', () => {
      const tetsuyuki = new TetsuyukiBoss('tetsuyuki_crisis', vec2(2050, 70), { customHp: 400 });
      crisisManager.setBoss(tetsuyuki);

      tetsuyuki.takeDamage(100); // 300 HP = 75%
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);

      tetsuyuki.takeDamage(40); // 260 HP (P1 clamp)
      tetsuyuki.takeDamage(60); // 200 HP = 50%
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
    });
  });
});
