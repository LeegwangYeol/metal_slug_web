import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { FullMetalSlugGame } from '../../src/main';

describe('CHALLENGER_M2_OVERHAUL_1: Adversarial Platform Physics & Drop-Through Stress Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  // =========================================================================
  // TASK 1: Drop-Through Under Rapid Down+Jump Pressing
  // =========================================================================
  describe('Task 1: Drop-Through Under Rapid Down+Jump Pressing', () => {
    it('1A: Rapid spamming of Down+Jump while falling through does not freeze, re-snap, or corrupt velocity', () => {
      // Platform at Y=175, ground at Y=230
      const plat1: Platform = {
        id: 'plat_semi_175',
        type: 'SEMI_SOLID',
        bounds: createAABB(100, 175, 200, 12),
      };
      const groundPlat: Platform = {
        id: 'ground_230',
        type: 'SOLID',
        bounds: createAABB(0, 230, 600, 40),
      };
      engine.setPlatforms([plat1, groundPlat]);

      const player = new PlayerController(vec2(200, 175));
      engine.addEntity(player);

      // Frame 0: settle on platform
      engine.tick(1 / 60);
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(175);
      expect(player.getActivePlatform()?.id).toBe('plat_semi_175');

      // Frame 1: initiate drop-through
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIsDroppingThrough()).toBe(true);
      expect(player.getIgnoredPlatformId()).toBe('plat_semi_175');
      expect(player.velocity.y).toBeGreaterThan(0);

      // Frames 2 to 10: Continuously spam Down+Jump every single frame while airborne
      for (let f = 0; f < 9; f++) {
        player.handleInput(
          { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: true, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
          1 / 60,
          engine
        );
        engine.tick(1 / 60);

        // Assert player is descending monotonically past Y=175 without re-snapping
        expect(player.position.y).toBeGreaterThan(175);
        expect(Number.isFinite(player.position.y)).toBe(true);
        expect(Number.isFinite(player.velocity.y)).toBe(true);
        expect(player.velocity.y).toBeGreaterThan(0); // positive downward
      }

      // Step until landing on ground
      for (let f = 0; f < 30; f++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }

      // Must cleanly land on ground at Y=230
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
      expect(player.velocity.y).toBe(0);
      expect(player.getIsDroppingThrough()).toBe(false);
      expect(player.getIgnoredPlatformId()).toBeNull();
      expect(player.getActivePlatform()?.id).toBe('ground_230');
    });

    it('1B: Multi-Tier Rapid Drop-Through: cascades through 3 stacked semi-solid platforms (Y=125 -> Y=160 -> Y=175 -> Y=230)', () => {
      // 3 stacked platforms directly above one another
      const p125: Platform = { id: 'plat_125', type: 'SEMI_SOLID', bounds: createAABB(100, 125, 200, 10) };
      const p160: Platform = { id: 'plat_160', type: 'SEMI_SOLID', bounds: createAABB(100, 160, 200, 10) };
      const p175: Platform = { id: 'plat_175', type: 'SEMI_SOLID', bounds: createAABB(100, 175, 200, 10) };
      const pGround: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(50, 230, 400, 40) };
      engine.setPlatforms([p125, p160, p175, pGround]);

      const player = new PlayerController(vec2(200, 125));
      engine.addEntity(player);
      engine.tick(1 / 60);
      expect(player.position.y).toBe(125);
      expect(player.getActivePlatform()?.id).toBe('plat_125');

      // Drop through Tier 1 (125)
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIgnoredPlatformId()).toBe('plat_125');

      // Descend to Tier 2 (160)
      for (let i = 0; i < 20; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(160);
      expect(player.getActivePlatform()?.id).toBe('plat_160');

      // Immediately drop through Tier 2 (160)
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIgnoredPlatformId()).toBe('plat_160');

      // Descend to Tier 3 (175)
      for (let i = 0; i < 20; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(175);
      expect(player.getActivePlatform()?.id).toBe('plat_175');

      // Immediately drop through Tier 3 (175)
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIgnoredPlatformId()).toBe('plat_175');

      // Descend to Ground (230)
      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
      expect(player.getActivePlatform()?.id).toBe('plat_ground');
      expect(player.getIsDroppingThrough()).toBe(false);
      expect(player.getIgnoredPlatformId()).toBeNull();
    });

    it('1C: Alternating rapid Down+Jump / release / Down+Jump does not clear ignoredPlatformId prematurely', () => {
      const plat: Platform = { id: 'plat_175', type: 'SEMI_SOLID', bounds: createAABB(100, 175, 200, 10) };
      const ground: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([plat, ground]);

      const player = new PlayerController(vec2(200, 175));
      engine.addEntity(player);
      engine.tick(1 / 60);

      // Frame 1: Down+Jump
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIgnoredPlatformId()).toBe('plat_175');

      // Frame 2: Neutral input (release all keys)
      player.handleInput(
        { left: false, right: false, up: false, down: false, jumpPressed: false, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      engine.tick(1 / 60);
      // Still dropping through while timer is active
      expect(player.getIsDroppingThrough()).toBe(true);
      expect(player.getIgnoredPlatformId()).toBe('plat_175');

      // Frame 3: Down+Jump again
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      engine.tick(1 / 60);
      expect(player.position.y).toBeGreaterThan(175);

      // Lands on ground
      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
    });
  });

  // =========================================================================
  // TASK 2: Drop-Through From Elevated Platforms Onto Ground
  // =========================================================================
  describe('Task 2: Drop-Through From Elevated Platforms Onto Ground', () => {
    const elevatedHeights = [80, 100, 125, 150, 160, 175, 200];

    elevatedHeights.forEach((elevY) => {
      it(`2A: drops cleanly from elevated platform at Y=${elevY} onto ground at Y=230 without penetration or NaN`, () => {
        const elevPlat: Platform = {
          id: `elev_${elevY}`,
          type: 'SEMI_SOLID',
          bounds: createAABB(100, elevY, 150, 12),
        };
        const groundPlat: Platform = {
          id: 'ground_floor',
          type: 'SOLID',
          bounds: createAABB(0, 230, 500, 40),
        };
        engine.setPlatforms([elevPlat, groundPlat]);

        const player = new PlayerController(vec2(150, elevY));
        engine.addEntity(player);
        engine.tick(1 / 60);

        expect(player.position.y).toBe(elevY);
        expect(player.isGrounded).toBe(true);

        // Initiate drop-through
        player.initiateDropThrough(engine);
        expect(player.getIsDroppingThrough()).toBe(true);
        expect(player.getIgnoredPlatformId()).toBe(`elev_${elevY}`);

        // Fall until grounded
        let ticks = 0;
        const maxTicks = 60; // 1 second max
        while (!player.isGrounded && ticks < maxTicks) {
          engine.tick(1 / 60);
          ticks++;
          // Velocity should never exceed terminal velocity (600)
          expect(player.velocity.y).toBeLessThanOrEqual(600);
          expect(Number.isFinite(player.position.y)).toBe(true);
          expect(Number.isFinite(player.velocity.y)).toBe(true);
        }

        // Must be grounded exactly at ground Y=230
        expect(player.isGrounded).toBe(true);
        expect(player.position.y).toBe(230);
        expect(player.velocity.y).toBe(0);
        expect(player.getIsDroppingThrough()).toBe(false);
        expect(player.getIgnoredPlatformId()).toBeNull();
        expect(player.getActivePlatform()?.id).toBe('ground_floor');

        // Verify player can immediately jump upon landing
        player.handleInput(
          { left: false, right: false, up: false, down: false, jumpPressed: true, jumpHeld: true, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
          1 / 60,
          engine
        );
        expect(player.velocity.y).toBeLessThan(0); // jumping upward
      });
    });

    it('2B: Attempting drop-through on SOLID ground at Y=230 does NOT clip or fall through the world', () => {
      const groundPlat: Platform = {
        id: 'ground_floor',
        type: 'SOLID',
        bounds: createAABB(0, 230, 500, 40),
      };
      engine.setPlatforms([groundPlat]);

      const player = new PlayerController(vec2(150, 230));
      engine.addEntity(player);
      engine.tick(1 / 60);

      expect(player.position.y).toBe(230);
      expect(player.isGrounded).toBe(true);

      // Press Down+Jump while on solid ground
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      engine.tick(1 / 60);

      // Player must remain safely supported at Y=230, never clipping into void
      expect(player.position.y).toBe(230);
      expect(player.isGrounded).toBe(true);
      expect(player.velocity.y).toBe(0);
    });
  });

  // =========================================================================
  // TASK 3: Drop-Through Off Platform Edges
  // =========================================================================
  describe('Task 3: Drop-Through Off Platform Edges', () => {
    const platLeft = 100;
    const platWidth = 100;
    const platRight = platLeft + platWidth; // 200
    const platY = 175;

    it('3A: Drop-through at exact left edge (X=100) resolves correctly and falls to ground', () => {
      const plat: Platform = { id: 'plat_edge', type: 'SEMI_SOLID', bounds: createAABB(platLeft, platY, platWidth, 12) };
      const ground: Platform = { id: 'ground_floor', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([plat, ground]);

      const player = new PlayerController(vec2(platLeft, platY));
      engine.addEntity(player);
      engine.tick(1 / 60);

      expect(player.isGrounded).toBe(true);
      expect(player.getActivePlatform()?.id).toBe('plat_edge');

      player.initiateDropThrough(engine);
      expect(player.getIgnoredPlatformId()).toBe('plat_edge');

      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
    });

    it('3B: Drop-through at exact right edge (X=200) resolves correctly and falls to ground', () => {
      const plat: Platform = { id: 'plat_edge', type: 'SEMI_SOLID', bounds: createAABB(platLeft, platY, platWidth, 12) };
      const ground: Platform = { id: 'ground_floor', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([plat, ground]);

      const player = new PlayerController(vec2(platRight, platY));
      engine.addEntity(player);
      engine.tick(1 / 60);

      expect(player.isGrounded).toBe(true);
      expect(player.getActivePlatform()?.id).toBe('plat_edge');

      player.initiateDropThrough(engine);
      expect(player.getIgnoredPlatformId()).toBe('plat_edge');

      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
    });

    it('3C: Drop-through initiated with simultaneous lateral crawl/run off the edge', () => {
      const plat: Platform = { id: 'plat_edge', type: 'SEMI_SOLID', bounds: createAABB(platLeft, platY, platWidth, 12) };
      const ground: Platform = { id: 'ground_floor', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([plat, ground]);

      // Player near left edge (X = 105)
      const player = new PlayerController(vec2(105, platY));
      engine.addEntity(player);
      engine.tick(1 / 60);

      // Down + Jump + Left simultaneously
      player.handleInput(
        { left: true, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIsDroppingThrough()).toBe(true);

      // Continue holding left while dropping
      for (let i = 0; i < 30; i++) {
        player.handleInput(
          { left: true, right: false, up: false, down: false, jumpPressed: false, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
          1 / 60,
          engine
        );
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }

      // Must have traversed past left edge and landed on ground
      expect(player.position.x).toBeLessThan(100);
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
      expect(player.getActivePlatform()?.id).toBe('ground_floor');
    });

    it('3D: Walking completely off platform edge without jump transitions cleanly to airborne falling', () => {
      const plat: Platform = { id: 'plat_edge', type: 'SEMI_SOLID', bounds: createAABB(platLeft, platY, platWidth, 12) };
      const ground: Platform = { id: 'ground_floor', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([plat, ground]);

      // Stand at X=105, facing left, run left
      const player = new PlayerController(vec2(105, platY));
      player.facing = -1;
      engine.addEntity(player);
      engine.tick(1 / 60);

      // Run left across 20 frames without pressing jump
      for (let i = 0; i < 20; i++) {
        player.handleInput(
          { left: true, right: false, up: false, down: false, jumpPressed: false, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
          1 / 60,
          engine
        );
        engine.tick(1 / 60);
      }

      // X is now < 88 (completely past left edge including halfWidth)
      expect(player.position.x).toBeLessThan(88);
      // Lands on ground at Y=230
      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(230);
    });
  });

  // =========================================================================
  // TASK 4: Paratrooper Descent on Multiple Platform Elevations (Y=125, Y=160, Y=175)
  // =========================================================================
  describe('Task 4: Paratrooper Descent on Multiple Platform Elevations', () => {
    const testElevations = [
      { name: 'Watchtower High Catwalk', elevationY: 125, platformX: 500, width: 120 },
      { name: 'Dune Redoubt Terrace', elevationY: 160, platformX: 700, width: 120 },
      { name: 'Stilt Pier / Bridge', elevationY: 175, platformX: 300, width: 120 },
    ];

    testElevations.forEach(({ name, elevationY, platformX, width }) => {
      it(`4A: Paratrooper lands cleanly on ${name} at Y=${elevationY} with exact feet touchdown and zero clipping`, () => {
        const elevatedPlat: Platform = {
          id: `plat_elev_${elevationY}`,
          type: 'SEMI_SOLID',
          bounds: createAABB(platformX, elevationY, width, 12),
        };
        const groundPlat: Platform = {
          id: 'ground_floor',
          type: 'SOLID',
          bounds: createAABB(0, 230, 1500, 40),
        };
        engine.setPlatforms([elevatedPlat, groundPlat]);

        const spawnX = platformX + width / 2; // centered above platform
        const spawnY = 20;

        const paratrooper = SoldierEnemy.createParatrooper(
          `para_${elevationY}`,
          'SOLDIER_RIFLE',
          vec2(spawnX, spawnY),
          {
            anchorX: spawnX,
            descentSpeed: 55,
            swayAmplitude: 12,
            swayFrequency: 2.5,
            targetGroundY: 230,
          }
        );
        engine.addEntity(paratrooper);

        // Step simulation until touchdown
        let landed = false;
        for (let frame = 0; frame < 240; frame++) {
          engine.tick(1 / 60);
          if (!paratrooper.isParachuteActive) {
            landed = true;
            break;
          }
        }

        expect(landed).toBe(true);
        expect(paratrooper.isParachuteActive).toBe(false);
        expect(paratrooper.state).toBe('PARACHUTE_LANDING');

        // MATHEMATICAL INVARIANT:
        // feet Y = position.y + height == elevationY exactly (zero clipping, zero hover)
        const soldierHeight = paratrooper.height; // 38px
        const expectedPosY = elevationY - soldierHeight;
        expect(paratrooper.position.y).toBe(expectedPosY);

        const footContactY = paratrooper.position.y + paratrooper.height;
        expect(footContactY).toBe(elevationY);

        // Bounding box bottom must align precisely with platform top
        expect(paratrooper.bounds.y + paratrooper.bounds.height).toBe(elevatedPlat.bounds.y);

        // Transition through landing recovery (0.25s = 15 frames) into PATROL
        for (let frame = 0; frame < 20; frame++) {
          engine.tick(1 / 60);
        }
        expect(paratrooper.state).toBe('PATROL');
        // Paratrooper position.y must remain stable at elevated platform surface during patrol
        expect(paratrooper.position.y).toBe(expectedPosY);
      });
    });

    it('4B: Paratroopers of all 4 enemy variants touchdown accurately at Y=160', () => {
      const variants: ('SOLDIER_RIFLE' | 'SOLDIER_GRENADE' | 'SOLDIER_KNIFE' | 'SOLDIER_SHIELD')[] = [
        'SOLDIER_RIFLE',
        'SOLDIER_GRENADE',
        'SOLDIER_KNIFE',
        'SOLDIER_SHIELD',
      ];

      const platformY = 160;
      const elevatedPlat: Platform = {
        id: 'plat_terrace_160',
        type: 'SEMI_SOLID',
        bounds: createAABB(400, platformY, 500, 12),
      };
      const groundPlat: Platform = {
        id: 'ground_floor',
        type: 'SOLID',
        bounds: createAABB(0, 230, 1500, 40),
      };
      engine.setPlatforms([elevatedPlat, groundPlat]);

      variants.forEach((variant, index) => {
        const posX = 450 + index * 90;
        const paratrooper = SoldierEnemy.createParatrooper(
          `para_var_${index}`,
          variant,
          vec2(posX, 15),
          {
            anchorX: posX,
            descentSpeed: 60,
            swayAmplitude: 8,
            swayFrequency: 2.0,
            targetGroundY: 230,
          }
        );
        engine.addEntity(paratrooper);
      });

      // Advance simulation 3 seconds
      for (let f = 0; f < 180; f++) {
        engine.tick(1 / 60);
      }

      const allSoldiers = engine.getAllEntities().filter((e) => e instanceof SoldierEnemy) as SoldierEnemy[];
      expect(allSoldiers.length).toBe(4);

      for (const soldier of allSoldiers) {
        expect(soldier.isParachuteActive).toBe(false);
        // Feet touchdown invariant
        expect(soldier.position.y + soldier.height).toBe(platformY);
        expect(soldier.position.y).toBe(platformY - soldier.height);
      }
    });

    it('4C: Paratrooper swaying off the edge of elevated platform at Y=125 falls cleanly to ground at Y=230', () => {
      // Narrow elevated platform at [500..540], Y=125
      const narrowPlat: Platform = {
        id: 'plat_narrow_125',
        type: 'SEMI_SOLID',
        bounds: createAABB(500, 125, 40, 10),
      };
      const groundPlat: Platform = {
        id: 'ground_floor',
        type: 'SOLID',
        bounds: createAABB(0, 230, 1000, 40),
      };
      engine.setPlatforms([narrowPlat, groundPlat]);

      // Paratrooper anchored at X = 570 (outside platform [500..540], sway [555..585])
      const paratrooper = SoldierEnemy.createParatrooper(
        'para_miss',
        'SOLDIER_RIFLE',
        vec2(570, 20),
        {
          anchorX: 570,
          descentSpeed: 60,
          swayAmplitude: 15,
          swayFrequency: 2.0,
          targetGroundY: 230,
        }
      );
      engine.addEntity(paratrooper);

      // Advance simulation
      for (let f = 0; f < 250; f++) {
        engine.tick(1 / 60);
        if (!paratrooper.isParachuteActive) break;
      }

      // Paratrooper missed narrow platform and landed cleanly on ground at Y=230
      expect(paratrooper.isParachuteActive).toBe(false);
      expect(paratrooper.position.y).toBe(230 - paratrooper.height);
      expect(paratrooper.bounds.y + paratrooper.bounds.height).toBe(230);
    });
  });

  // =========================================================================
  // TASK 5: Full Stage 1 Terrain Integration Verification
  // =========================================================================
  describe('Task 5: Stage 1 Level Terrain Integration Verification', () => {
    it('5A: Verifies all Stage 1 semi-solid platforms support drop-through down to next platform or continuous ground', () => {
      const fullGame = new FullMetalSlugGame();
      const stageData = fullGame.buildStage1Data();
      const semiSolidPlatforms = stageData.platforms.filter((p) => p.type === 'SEMI_SOLID');

      expect(semiSolidPlatforms.length).toBeGreaterThanOrEqual(15);

      // For every semi-solid platform, test that a player placed on it can drop through to lower terrain
      for (const plat of semiSolidPlatforms) {
        const testEngine = new GameEngine();
        testEngine.setPlatforms(stageData.platforms);

        const playerX = plat.bounds.x + plat.bounds.width / 2;
        const playerY = plat.bounds.y;
        const player = new PlayerController(vec2(playerX, playerY));
        testEngine.addEntity(player);

        // Frame 0: stabilize
        testEngine.tick(1 / 60);
        expect(player.isGrounded).toBe(true);
        expect(player.position.y).toBe(playerY);

        // Initiate drop-through
        player.initiateDropThrough(testEngine);
        expect(player.getIsDroppingThrough()).toBe(true);
        expect(player.getIgnoredPlatformId()).toBe(plat.id);

        // Advance up to 60 ticks to reach lower platform or ground
        for (let t = 0; t < 60; t++) {
          testEngine.tick(1 / 60);
          if (player.isGrounded) break;
        }

        // Must be grounded below the dropped platform
        expect(player.isGrounded).toBe(true);
        expect(player.position.y).toBeGreaterThan(playerY);
        expect(player.position.y).toBeLessThanOrEqual(230);
        expect(player.getIsDroppingThrough()).toBe(false);
        expect(player.getIgnoredPlatformId()).toBeNull();
      }
    });
  });

  // =========================================================================
  // TASK 6: Variable Timestep Drop-Through Stress
  // =========================================================================
  describe('Task 6: Variable Timestep Drop-Through Stress (30Hz, 60Hz, 120Hz)', () => {
    const timesteps = [
      { name: '120Hz (8.33ms)', dt: 1 / 120 },
      { name: '60Hz (16.67ms)', dt: 1 / 60 },
      { name: '30Hz (33.33ms)', dt: 1 / 30 },
    ];

    timesteps.forEach(({ name, dt }) => {
      it(`6A: Drop-through behaves stably under ${name}`, () => {
        const plat: Platform = { id: 'plat_fps', type: 'SEMI_SOLID', bounds: createAABB(100, 160, 200, 12) };
        const ground: Platform = { id: 'ground_fps', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
        engine.setPlatforms([plat, ground]);

        const player = new PlayerController(vec2(200, 160));
        engine.addEntity(player);

        // Stabilize
        engine.tick(dt);
        expect(player.position.y).toBe(160);

        player.handleInput(
          { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
          dt,
          engine
        );
        expect(player.getIsDroppingThrough()).toBe(true);
        expect(player.getIgnoredPlatformId()).toBe('plat_fps');

        // Step until grounded
        for (let i = 0; i < 120; i++) {
          engine.tick(dt);
          if (player.isGrounded) break;
        }

        expect(player.isGrounded).toBe(true);
        expect(player.position.y).toBe(230);
        expect(player.velocity.y).toBe(0);
        expect(player.getIsDroppingThrough()).toBe(false);
      });
    });
  });

  // =========================================================================
  // TASK 7: Closely-Stacked Platforms Drop-Through
  // =========================================================================
  describe('Task 7: Closely-Stacked Platforms Drop-Through (8px separation)', () => {
    it('7A: Drops from Upper Platform (Y=160) and lands on immediately adjacent Lower Platform (Y=168)', () => {
      const pUpper: Platform = { id: 'plat_upper', type: 'SEMI_SOLID', bounds: createAABB(100, 160, 200, 8) };
      const pLower: Platform = { id: 'plat_lower', type: 'SEMI_SOLID', bounds: createAABB(100, 168, 200, 8) };
      const pGround: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([pUpper, pLower, pGround]);

      const player = new PlayerController(vec2(200, 160));
      engine.addEntity(player);
      engine.tick(1 / 60);

      expect(player.position.y).toBe(160);
      expect(player.getActivePlatform()?.id).toBe('plat_upper');

      // Drop through upper platform
      player.handleInput(
        { left: false, right: false, up: false, down: true, jumpPressed: true, jumpHeld: false, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.getIgnoredPlatformId()).toBe('plat_upper');

      // Step physics: should land directly on pLower at Y=168
      for (let i = 0; i < 15; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }

      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(168);
      expect(player.getActivePlatform()?.id).toBe('plat_lower');
      expect(player.getIsDroppingThrough()).toBe(false);
      expect(player.getIgnoredPlatformId()).toBeNull();
    });
  });

  // =========================================================================
  // TASK 8: Upward Jump Ascent Through Semi-Solid Platform
  // =========================================================================
  describe('Task 8: Upward Jump Ascent Through Semi-Solid Platform', () => {
    it('8A: Jumps from ground Y=230 UP through semi-solid platform at Y=175 and lands atop it', () => {
      const pSemi: Platform = { id: 'plat_overhead', type: 'SEMI_SOLID', bounds: createAABB(100, 175, 200, 12) };
      const pGround: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(0, 230, 400, 40) };
      engine.setPlatforms([pSemi, pGround]);

      const player = new PlayerController(vec2(200, 230));
      engine.addEntity(player);
      engine.tick(1 / 60);

      expect(player.position.y).toBe(230);

      // Perform full jump upward (impulse is -380 px/s, reaches apex ~73px above ground, Y ~= 157)
      player.handleInput(
        { left: false, right: false, up: false, down: false, jumpPressed: true, jumpHeld: true, shootPressed: false, shootHeld: false, grenadePressed: false, ultimatePressed: false },
        1 / 60,
        engine
      );
      expect(player.velocity.y).toBeLessThan(0);

      let crossedAbove175 = false;
      // Ascend through 175
      for (let i = 0; i < 30; i++) {
        engine.tick(1 / 60);
        if (player.position.y < 175) {
          crossedAbove175 = true;
          break;
        }
      }
      expect(crossedAbove175).toBe(true);

      // Continue stepping until landing on overhead platform
      for (let i = 0; i < 40; i++) {
        engine.tick(1 / 60);
        if (player.isGrounded) break;
      }

      // Player must have passed through going up and landed cleanly on top at Y=175
      expect(player.isGrounded).toBe(true);
      expect(player.position.y).toBe(175);
      expect(player.getActivePlatform()?.id).toBe('plat_overhead');
    });
  });

  // =========================================================================
  // TASK 9: Paratrooper Extreme Sway & Multi-Drop Dynamics
  // =========================================================================
  describe('Task 9: Paratrooper Extreme Sway & Multi-Drop Dynamics', () => {
    it('9A: Paratrooper with high sway frequency lands cleanly without jitter', () => {
      const pPlatform: Platform = { id: 'plat_tower', type: 'SEMI_SOLID', bounds: createAABB(400, 140, 200, 12) };
      const pGround: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(0, 230, 1000, 40) };
      engine.setPlatforms([pPlatform, pGround]);

      const paratrooper = SoldierEnemy.createParatrooper(
        'para_fast_sway',
        'SOLDIER_RIFLE',
        vec2(500, 10),
        {
          anchorX: 500,
          descentSpeed: 60,
          swayAmplitude: 25, // Large sway: 500 +- 25 = [475..525], within [400..600]
          swayFrequency: 4.5, // High frequency sway
          targetGroundY: 230,
        }
      );
      engine.addEntity(paratrooper);

      for (let f = 0; f < 200; f++) {
        engine.tick(1 / 60);
        if (!paratrooper.isParachuteActive) break;
      }

      expect(paratrooper.isParachuteActive).toBe(false);
      expect(paratrooper.position.y).toBe(140 - paratrooper.height);
      expect(paratrooper.bounds.y + paratrooper.bounds.height).toBe(140);
    });

    it('9B: Paratrooper transitions to PATROL on elevated platform and stays at elevated height while within platform bounds', () => {
      const pPlatform: Platform = { id: 'plat_patrol', type: 'SEMI_SOLID', bounds: createAABB(400, 160, 200, 12) };
      const pGround: Platform = { id: 'plat_ground', type: 'SOLID', bounds: createAABB(0, 230, 1000, 40) };
      engine.setPlatforms([pPlatform, pGround]);

      const paratrooper = SoldierEnemy.createParatrooper(
        'para_patrol_stay',
        'SOLDIER_RIFLE',
        vec2(500, 20),
        {
          anchorX: 500,
          descentSpeed: 60,
          swayAmplitude: 5,
          swayFrequency: 1.0,
          targetGroundY: 230,
        }
      );
      // Confine patrol bounds to platform [420..580]
      (paratrooper as any).patrolMinX = 420;
      (paratrooper as any).patrolMaxX = 580;

      engine.addEntity(paratrooper);

      // Descend
      for (let f = 0; f < 200; f++) {
        engine.tick(1 / 60);
        if (!paratrooper.isParachuteActive) break;
      }

      // Recover into PATROL
      for (let f = 0; f < 25; f++) {
        engine.tick(1 / 60);
      }
      expect(paratrooper.state).toBe('PATROL');

      // Patrol for 60 ticks (1 second)
      for (let f = 0; f < 60; f++) {
        engine.tick(1 / 60);
        // Elevation must remain rock solid at Y = 160 - 38 = 122
        expect(paratrooper.position.y).toBe(160 - 38);
        expect(paratrooper.bounds.y + paratrooper.bounds.height).toBe(160);
      }
    });
  });
});
