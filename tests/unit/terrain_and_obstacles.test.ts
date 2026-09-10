import { describe, it, expect, beforeEach } from 'vitest';
import { FullMetalSlugGame } from '../../src/main';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlatformPhysics, Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';
import { DestructibleObstacle } from '../../src/core/entities/obstacles/DestructibleObstacle';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { CanvasRenderer } from '../../src/render/CanvasRenderer';
import { Camera } from '../../src/render/Camera';

describe('Milestone M2: Terrain System, Multi-Tier Layout & Destructible Obstacles', () => {
  let game: FullMetalSlugGame;

  beforeEach(() => {
    game = new FullMetalSlugGame();
  });

  describe('1. Multi-Tier Platform Layout & 5 Micro-Zones Verification', () => {
    it('verifies stage 1 contains at least 24 platforms across 5 distinct micro-zones', () => {
      const stageData = game.buildStage1Data();
      const platforms = stageData.platforms;

      // Must exceed the 24 platform requirement
      expect(platforms.length).toBeGreaterThanOrEqual(24);
      expect(platforms.length).toBe(27);

      // Micro-Zone 1: Beachhead Landing & Stilt Docks (0..500)
      const zone1 = platforms.filter((p) => p.bounds.x < 500);
      expect(zone1.length).toBeGreaterThanOrEqual(4);
      expect(zone1.some((p) => p.id === 'ground_main')).toBe(true);
      expect(zone1.some((p) => p.id === 'dock_1' && p.type === 'SEMI_SOLID')).toBe(true);
      expect(zone1.some((p) => p.id === 'dock_high_perch' && p.type === 'SEMI_SOLID')).toBe(true);
      expect(zone1.some((p) => p.id === 'bunker_1' && p.type === 'SOLID')).toBe(true);
      expect(zone1.some((p) => p.id === 'bridge_1' && p.type === 'SEMI_SOLID')).toBe(true);

      // Micro-Zone 2: Dune Redoubt & High Watchtower (500..1000)
      const zone2 = platforms.filter((p) => p.bounds.x >= 500 && p.bounds.x < 1000);
      expect(zone2.length).toBeGreaterThanOrEqual(5);
      expect(zone2.some((p) => p.id === 'ground_zone2_ridge')).toBe(true);
      expect(zone2.some((p) => p.id === 'watchtower_alpha' && p.bounds.y <= 130)).toBe(true);
      expect(zone2.some((p) => p.id === 'dune_redoubt_platform')).toBe(true);

      // Micro-Zone 3: River Basin & Mid-Boss Arena (1000..1450)
      const zone3 = platforms.filter((p) => p.bounds.x >= 1000 && p.bounds.x < 1440);
      expect(zone3.length).toBeGreaterThanOrEqual(4);
      expect(zone3.some((p) => p.id === 'ground_midboss_floor')).toBe(true);
      expect(zone3.some((p) => p.id === 'midboss_catwalk' && p.bounds.y <= 120)).toBe(true);
      expect(zone3.some((p) => p.id === 'midboss_dock_left')).toBe(true);
      expect(zone3.some((p) => p.id === 'midboss_dock_right')).toBe(true);

      // Micro-Zone 4: Trench Gorge & Suspension Bridges (1440..1800)
      const zone4 = platforms.filter((p) => p.bounds.x >= 1440 && p.bounds.x < 1800);
      expect(zone4.length).toBeGreaterThanOrEqual(5);
      expect(zone4.some((p) => p.id === 'ground_trench_dip')).toBe(true);
      expect(zone4.some((p) => p.id === 'bridge_2')).toBe(true);
      expect(zone4.some((p) => p.id === 'tower_platform')).toBe(true);

      // Micro-Zone 5: Tetsuyuki Citadel Arena (1800..3600)
      const zone5 = platforms.filter((p) => p.bounds.x >= 1800);
      expect(zone5.length).toBeGreaterThanOrEqual(4);
      expect(zone5.some((p) => p.id === 'ground_citadel_floor')).toBe(true);
      expect(zone5.some((p) => p.id === 'boss_arena_left')).toBe(true);
      expect(zone5.some((p) => p.id === 'boss_arena_right')).toBe(true);
    });

    it('strictly preserves the boss_arena_left exact coordinates invariant (1860, 170, 100, 12)', () => {
      const stageData = game.buildStage1Data();
      const bossPlat = stageData.platforms.find((p) => p.id === 'boss_arena_left');
      expect(bossPlat).toBeDefined();
      expect(bossPlat!.bounds.x).toBe(1860);
      expect(bossPlat!.bounds.y).toBe(170);
      expect(bossPlat!.bounds.width).toBe(100);
      expect(bossPlat!.bounds.height).toBe(12);
      expect(bossPlat!.type).toBe('SEMI_SOLID');
    });

    it('ensures ground level is continuous at Y = 230 across the entire stage progression', () => {
      const stageData = game.buildStage1Data();
      const groundPlatforms = stageData.platforms.filter((p) => p.id.startsWith('ground_'));
      for (const gp of groundPlatforms) {
        expect(gp.bounds.y).toBe(230);
        expect(gp.type).toBe('SOLID');
      }
    });

    it('verifies mid-boss patrol range is expanded to 1650 for the 1100px arena', () => {
      const stageData = game.buildStage1Data();
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');
      expect(midBossTrigger).toBeDefined();

      const spawnedEntities: any[] = [];
      const fakeEngine = {
        addEntity: (ent: any) => {
          spawnedEntities.push(ent);
        },
      } as any;

      midBossTrigger!.spawnAction(fakeEngine, 0);
      const midBoss = spawnedEntities.find((e) => e.type === 'MID_BOSS_VEHICLE');
      expect(midBoss).toBeDefined();
      expect((midBoss as any).patrolMaxX).toBe(1650);
      expect((midBoss as any).patrolMinX).toBe(800);
    });
  });

  describe('2. Semi-Solid Platform Drop-Through Execution & Caching Invariants', () => {
    it('caches ignoredPlatformId when dropping through a semi-solid platform and descends immediately', () => {
      const engine = new GameEngine();
      const player = new PlayerController(vec2(150, 175)); // On dock_1 (y=175)
      engine.addEntity(player);

      const plat1: Platform = {
        id: 'plat_upper',
        type: 'SEMI_SOLID',
        bounds: createAABB(100, 175, 100, 10),
      };
      const platFloor: Platform = {
        id: 'plat_ground',
        type: 'SOLID',
        bounds: createAABB(0, 230, 500, 40),
      };
      engine.setPlatforms([plat1, platFloor]);

      // Tick 1 frame to ensure grounded on plat1
      engine.tick(1 / 60);
      expect(player.position.y).toBe(175);
      expect(player.isGrounded).toBe(true);
      expect(player.getActivePlatform()?.id).toBe('plat_upper');

      // Initiate drop-through
      player.initiateDropThrough(engine);

      // Verify immediate state: dropThrough active, ignoredPlatformId cached, velocity downward
      expect(player.getIsDroppingThrough()).toBe(true);
      expect(player.getIgnoredPlatformId()).toBe('plat_upper');
      expect(player.velocity.y).toBeGreaterThan(0);
      expect(player.isGrounded).toBe(false);

      // On the very next physics frame, player MUST descend through plat1 without sticking
      engine.tick(1 / 60);
      expect(player.position.y).toBeGreaterThan(175);
      expect(player.getIgnoredPlatformId()).toBe('plat_upper');

      // Simulate further descent until landing on platFloor (Y = 230)
      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }

      // Verify clean touchdown on lower solid floor
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
      expect(player.velocity.y).toBe(0);
      expect(player.getIsDroppingThrough()).toBe(false);
      expect(player.getIgnoredPlatformId()).toBeNull();
      expect(player.getActivePlatform()?.id).toBe('plat_ground');
    });

    it('resets coyoteTimer and jumpBufferTimer when initiating drop through', () => {
      const player = new PlayerController(vec2(100, 230));
      (player as any).coyoteTimer = 0.2;
      (player as any).jumpBufferTimer = 0.15;

      player.initiateDropThrough();
      expect((player as any).coyoteTimer).toBe(0);
      expect((player as any).jumpBufferTimer).toBe(0);
      expect(player.velocity.y).toBe(PlatformPhysics.DROP_THROUGH_IMPULSE);
    });
  });

  describe('3. Dynamic Paratrooper Platform Landing System', () => {
    it('lands paratrooper on elevated semi-solid platform when descending over it', () => {
      const engine = new GameEngine();
      const towerPlat: Platform = {
        id: 'watchtower_elevated',
        type: 'SEMI_SOLID',
        bounds: createAABB(600, 130, 100, 12),
      };
      const groundPlat: Platform = {
        id: 'ground_floor',
        type: 'SOLID',
        bounds: createAABB(0, 230, 1000, 40),
      };
      engine.setPlatforms([towerPlat, groundPlat]);

      // Paratrooper descending centered at X = 650
      const paratrooper = SoldierEnemy.createParatrooper(
        'para_tower',
        'SOLDIER_RIFLE',
        vec2(650, 20),
        {
          anchorX: 650,
          descentSpeed: 60,
          swayAmplitude: 10,
          swayFrequency: 2.0,
          targetGroundY: 230,
        }
      );
      engine.addEntity(paratrooper);

      // Flush additions
      engine.tick(1 / 60);

      // Descend across ticks
      for (let i = 0; i < 200; i++) {
        engine.tick(1 / 60);
        if (!paratrooper.isParachuteActive) break;
      }

      // Must have landed on the tower platform at Y = 130 - 38 = 92
      expect(paratrooper.isParachuteActive).toBe(false);
      expect(paratrooper.position.y).toBe(130 - paratrooper.height);

      // Tick recovery frames into PATROL
      for (let i = 0; i < 20; i++) {
        engine.tick(1 / 60);
      }
      expect(paratrooper.state).toBe('PATROL');
    });

    it('lands paratrooper on ground when no elevated platform is underneath', () => {
      const engine = new GameEngine();
      const groundPlat: Platform = {
        id: 'ground_floor',
        type: 'SOLID',
        bounds: createAABB(0, 230, 1000, 40),
      };
      engine.setPlatforms([groundPlat]);

      const paratrooper = SoldierEnemy.createParatrooper(
        'para_ground',
        'SOLDIER_RIFLE',
        vec2(200, 20),
        {
          anchorX: 200,
          descentSpeed: 60,
          swayAmplitude: 10,
          swayFrequency: 2.0,
          targetGroundY: 230,
        }
      );
      engine.addEntity(paratrooper);
      engine.tick(1 / 60);

      for (let i = 0; i < 240; i++) {
        engine.tick(1 / 60);
        if (!paratrooper.isParachuteActive) break;
      }

      // Lands on ground: 230 - 38 = 192
      expect(paratrooper.isParachuteActive).toBe(false);
      expect(paratrooper.position.y).toBe(230 - paratrooper.height);
    });
  });

  describe('4. Destructible Obstacles System (Barricades, Crates, Barrels)', () => {
    it('creates SANDBAG_BARRICADE, absorbs damage, and is destroyed at 0 HP', () => {
      const engine = new GameEngine();
      let soundPlayed = '';
      engine.eventBus.on('play_sound', (data: any) => {
        soundPlayed = data.sound;
      });

      const sandbag = new DestructibleObstacle(
        'sandbag_test',
        'SANDBAG_BARRICADE',
        vec2(200, 216),
        28,
        14,
        { health: 15 }
      );
      engine.addEntity(sandbag);
      engine.tick(1 / 60);

      expect(sandbag.health).toBe(15);
      expect(sandbag.isAlive).toBe(true);

      // Hit with 5 damage
      sandbag.takeDamage(5, engine);
      expect(sandbag.health).toBe(10);
      expect(sandbag.isAlive).toBe(true);
      expect(soundPlayed).toBe('sfx_bullet_hit');

      // Hit with 10 damage -> death
      sandbag.takeDamage(10, engine);
      expect(sandbag.health).toBe(0);
      expect(sandbag.isAlive).toBe(false);
    });

    it('creates SUPPLY_CRATE and drops weapon ItemPickup upon destruction', () => {
      const engine = new GameEngine();
      const crate = new DestructibleObstacle(
        'crate_test',
        'SUPPLY_CRATE',
        vec2(300, 160),
        18,
        18,
        { health: 8, dropItem: ItemDropType.WEAPON_HMG }
      );
      engine.addEntity(crate);
      engine.tick(1 / 60);

      crate.takeDamage(8, engine);
      expect(crate.isAlive).toBe(false);

      // Step to flush drop entity
      engine.tick(1 / 60);

      const entities = engine.getAllEntities();
      const dropItem = entities.find((e) => e.id === 'drop_crate_test');
      expect(dropItem).toBeDefined();
      expect((dropItem as any).dropType).toBe(ItemDropType.WEAPON_HMG);
    });

    it('creates EXPLOSIVE_BARREL and triggers 54px blast dealing 10 damage to nearby enemies', () => {
      const engine = new GameEngine();
      let explosionSpawned: any = null;
      let shakeAmplitude = 0;

      engine.eventBus.on('explosion_spawned', (data: any) => {
        explosionSpawned = data;
      });
      engine.eventBus.on('screen_shake', (data: any) => {
        shakeAmplitude = data.amplitude;
      });

      const barrel = new DestructibleObstacle(
        'barrel_test',
        'EXPLOSIVE_BARREL',
        vec2(500, 200),
        16,
        18,
        { health: 10, blastRadius: 54, blastDamage: 10 }
      );
      engine.addEntity(barrel);

      // Enemy in blast radius (dist = 30px <= 54px)
      const enemyClose = new SoldierEnemy('enemy_close', 'SOLDIER_RIFLE', vec2(520, 192));
      engine.addEntity(enemyClose);

      // Enemy outside blast radius (dist = 80px > 54px)
      const enemyFar = new SoldierEnemy('enemy_far', 'SOLDIER_RIFLE', vec2(580, 192));
      engine.addEntity(enemyFar);

      engine.tick(1 / 60);

      // Give enemies custom HP to assert exact 10 damage reduction
      enemyClose.health = 20;
      enemyFar.health = 20;
      const initialCloseHp = 20;
      const initialFarHp = 20;

      // Shoot barrel until exploded
      barrel.takeDamage(10, engine);
      expect(barrel.isAlive).toBe(false);
      expect(barrel.isExploded).toBe(true);

      // Verify explosion events
      expect(explosionSpawned).toBeDefined();
      expect(explosionSpawned.radius).toBe(54);
      expect(explosionSpawned.damage).toBe(10);
      expect(shakeAmplitude).toBe(6.0);

      // Close enemy took 10 blast damage (20 -> 10)
      expect(enemyClose.health).toBe(initialCloseHp - 10);
      // Far enemy took 0 damage (remains 20)
      expect(enemyFar.health).toBe(initialFarHp);
    });

    it('verifies grenades detonate on contact with destructible obstacles', () => {
      const engine = new GameEngine();
      const sandbag = new DestructibleObstacle(
        'sandbag_grenade',
        'SANDBAG_BARRICADE',
        vec2(400, 216),
        28,
        14,
        { health: 20 }
      );
      engine.addEntity(sandbag);

      let grenadeDetonated = false;
      const mockGrenade = {
        id: 'grenade_1',
        type: 'GRENADE',
        bounds: createAABB(405, 218, 8, 8),
        isAlive: true,
        detonate: (_eng: any) => {
          grenadeDetonated = true;
        },
      } as any;

      sandbag.onCollision(mockGrenade, engine);

      expect(grenadeDetonated).toBe(true);
      expect(sandbag.health).toBe(10); // absorbed 10 grenade damage
    });

    it('verifies non-piercing projectiles are stopped by destructible obstacles', () => {
      const engine = new GameEngine();
      const sandbag = new DestructibleObstacle(
        'sandbag_bullet',
        'SANDBAG_BARRICADE',
        vec2(300, 216),
        28,
        14,
        { health: 15 }
      );
      engine.addEntity(sandbag);

      const mockBullet = {
        id: 'bullet_1',
        type: 'PROJECTILE',
        bounds: createAABB(302, 220, 6, 4),
        isAlive: true,
        damage: 2,
        pierces: false,
      } as any;

      sandbag.onCollision(mockBullet, engine);

      expect(sandbag.health).toBe(13);
      expect(mockBullet.isAlive).toBe(false); // bullet consumed
    });

    it('loads static obstacles into FullMetalSlugGame when includeObstacles is enabled', () => {
      const obsGame = new FullMetalSlugGame(undefined, { includeObstacles: true });
      const entities = obsGame.engine.getAllEntities();
      const obstacles = entities.filter((e) => e instanceof DestructibleObstacle);

      expect(obstacles.length).toBeGreaterThanOrEqual(8);
      expect(obstacles.some((o: any) => o.obstacleType === 'SANDBAG_BARRICADE')).toBe(true);
      expect(obstacles.some((o: any) => o.obstacleType === 'SUPPLY_CRATE')).toBe(true);
      expect(obstacles.some((o: any) => o.obstacleType === 'EXPLOSIVE_BARREL')).toBe(true);
    });
  });

  describe('5. Terrain Presentation & Stylized Multi-Layer Rendering', () => {
    it('renders platforms pass with stylized sand layers and timber stilts without throwing', () => {
      const renderer = new CanvasRenderer();
      const camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      camera.update(100, 0, 3600);

      const stageData = game.buildStage1Data();

      expect(() => {
        (renderer as any).renderPlatformsPass(stageData.platforms, camera);
      }).not.toThrow();
    });

    it('renders destructible obstacles pass without throwing', () => {
      const renderer = new CanvasRenderer();
      const camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      camera.update(200, 0, 3600);

      const testObstacles = [
        { id: 'sb_1', obstacleType: 'SANDBAG_BARRICADE', x: 250, y: 216, width: 28, height: 14, healthRatio: 1.0 },
        { id: 'cr_1', obstacleType: 'SUPPLY_CRATE', x: 280, y: 160, width: 18, height: 18, healthRatio: 0.8 },
        { id: 'br_1', obstacleType: 'EXPLOSIVE_BARREL', x: 310, y: 216, width: 16, height: 18, healthRatio: 1.0 },
      ];

      expect(() => {
        (renderer as any).renderObstaclesPass(testObstacles, camera);
      }).not.toThrow();
    });
  });
});
