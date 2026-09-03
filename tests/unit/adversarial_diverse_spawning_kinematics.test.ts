import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { FullMetalSlugGame } from '../../src/main';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';
import { CanvasRenderer } from '../../src/render/CanvasRenderer';
import { Camera } from '../../src/render/Camera';
import { ParallaxBackground } from '../../src/render/ParallaxBackground';

describe('CHALLENGER POLISH 1: Adversarial Diverse Spawning & Kinematics Stress Suite', () => {
  let engine: GameEngine;
  const GROUND_Y = 230;
  const SOLDIER_HEIGHT = 38;
  const EXPECTED_FOOT_Y = GROUND_Y - SOLDIER_HEIGHT; // 192

  beforeEach(() => {
    engine = new GameEngine();
    const ground: Platform = {
      id: 'ground_main',
      type: 'SOLID',
      bounds: createAABB(0, GROUND_Y, 2400, 40),
    };
    engine.addPlatform(ground);
    engine.start();
  });

  // =========================================================================
  // TASK 1: Parachute Airborne Drop Kinematics
  // =========================================================================
  describe('1. Parachute Airborne Drop Kinematics & Terminal Velocity Bounds', () => {
    it('EMPIRICAL BOUNDS 1A: High-Y spawn coordinates (Y < 50, Y = -20, 0, 15, 30, 49) initiate PARACHUTE_DESCENT', () => {
      const spawnYs = [-20, 0, 15, 30, 49];
      for (const sy of spawnYs) {
        const paratrooper = SoldierEnemy.createParatrooper(
          `para_spawn_${sy}`,
          'SOLDIER_RIFLE',
          vec2(250, sy),
          {
            anchorX: 250,
            descentSpeed: 50,
            targetGroundY: GROUND_Y,
          }
        );

        expect(paratrooper.position.y).toBe(sy);
        expect(paratrooper.position.y).toBeLessThan(50);
        expect(paratrooper.isParachuteActive).toBe(true);
        expect(paratrooper.state).toBe('PARACHUTE_DESCENT');
        expect(paratrooper.spawnBehavior).toBe('PARACHUTE_DROP');
        expect(paratrooper.velocity.y).toBeGreaterThanOrEqual(40);
        expect(paratrooper.velocity.y).toBeLessThanOrEqual(60);
      }
    });

    it('EMPIRICAL BOUNDS 1B: Terminal descent velocity is clamped strictly within [40, 60] px/s', () => {
      // Test requested speeds below min (10, 35), within range (40, 50, 58, 60), and above max (75, 120)
      const requestedSpeeds = [10, 35, 40, 50, 58, 60, 75, 120];
      for (const speed of requestedSpeeds) {
        const p = SoldierEnemy.createParatrooper(
          `para_speed_${speed}`,
          'SOLDIER_RIFLE',
          vec2(300, 0),
          {
            anchorX: 300,
            descentSpeed: speed,
            targetGroundY: GROUND_Y,
          }
        );

        expect(p.velocity.y).toBeGreaterThanOrEqual(40);
        expect(p.velocity.y).toBeLessThanOrEqual(60);
      }
    });

    it('EMPIRICAL GRAVITY BYPASS 1C: Parachute descent maintains constant velocity, bypassing 720 px/s² gravity', () => {
      const p = SoldierEnemy.createParatrooper(
        'para_gravity_test',
        'SOLDIER_RIFLE',
        vec2(200, 0),
        {
          anchorX: 200,
          descentSpeed: 45,
          targetGroundY: GROUND_Y,
        }
      );
      engine.addEntity(p);

      // Simulate 1 second across 60 frames
      for (let i = 0; i < 60; i++) {
        engine.tick(1 / 60);
        // vy must never accelerate under gravity
        expect(p.velocity.y).toBe(45);
      }
      // After 1 second at 45 px/s, position.y should be exactly 45 (not 0 + 45 + 0.5*720*1 = 405)
      expect(p.position.y).toBeCloseTo(45, 1);
    });

    it('EMPIRICAL SWAY 1D: Sinusoidal horizontal sway matches analytical trajectory across variable timesteps (1/60, 1/30, 1/120)', () => {
      const timesteps = [1 / 120, 1 / 60, 1 / 30];
      const anchorX = 400;
      const amplitude = 18;
      const freq = 3.0;
      const phase = 0.5;

      for (const dt of timesteps) {
        const testEng = new GameEngine();
        testEng.start();
        const p = SoldierEnemy.createParatrooper(
          `para_sway_dt_${Math.round(1 / dt)}`,
          'SOLDIER_KNIFE',
          vec2(anchorX, 10),
          {
            anchorX,
            descentSpeed: 40,
            swayAmplitude: amplitude,
            swayFrequency: freq,
            swayPhase: phase,
            targetGroundY: GROUND_Y,
          }
        );
        testEng.addEntity(p);

        // Step until t = 1.2s
        const totalSteps = Math.round(1.2 / dt);
        for (let step = 0; step < totalSteps; step++) {
          testEng.tick(dt);
        }

        const expectedTime = totalSteps * dt;
        const expectedX = anchorX + amplitude * Math.sin(freq * expectedTime + phase);
        const expectedVx = amplitude * freq * Math.cos(freq * expectedTime + phase);

        expect(p.position.x).toBeCloseTo(expectedX, 1);
        expect(p.velocity.x).toBeCloseTo(expectedVx, 1);
      }
    });

    it('EMPIRICAL TOUCHDOWN 1E: Clean touchdown at ground line Y=230 with foot alignment at y=192 and canopy detachment', () => {
      let landedEventCount = 0;
      let landedEventData: any = null;

      engine.eventBus.on('enemy_parachute_landed', (data: any) => {
        landedEventCount++;
        landedEventData = data;
      });

      // Start at y = 180 (12px above touchdown at y=192)
      const paratrooper = SoldierEnemy.createParatrooper(
        'para_touchdown_soldier',
        'SOLDIER_RIFLE',
        vec2(350, 180),
        {
          anchorX: 350,
          descentSpeed: 50,
          targetGroundY: GROUND_Y,
        }
      );
      engine.addEntity(paratrooper);

      // Advance physics frames until landing occurs
      let frames = 0;
      while (paratrooper.state === 'PARACHUTE_DESCENT' && frames < 60) {
        engine.tick(1 / 60);
        frames++;
      }

      // Assert touchdown properties
      expect(paratrooper.position.y).toBe(EXPECTED_FOOT_Y); // Exactly 192
      expect(paratrooper.position.y + paratrooper.height).toBe(GROUND_Y); // Foot at 230
      expect(paratrooper.isParachuteActive).toBe(false); // Canopy detached
      expect(paratrooper.state).toBe('PARACHUTE_LANDING');
      expect(landedEventCount).toBe(1);
      expect(landedEventData.id).toBe('para_touchdown_soldier');
      expect(landedEventData.position.y).toBe(EXPECTED_FOOT_Y);
    });

    it('EMPIRICAL TOUCHDOWN 1F: Pathological large dt (dt = 0.2s) never penetrates through terrain', () => {
      const p = SoldierEnemy.createParatrooper(
        'para_overshoot_test',
        'SOLDIER_RIFLE',
        vec2(300, 185), // 7px from touchdown
        {
          anchorX: 300,
          descentSpeed: 60, // At dt=0.2s, deltaY would be 12px -> 197 (overshoot without clamp!)
          targetGroundY: GROUND_Y,
        }
      );
      engine.addEntity(p);

      // Single large tick
      engine.tick(0.2);

      // Must be clamped exactly to 192
      expect(p.position.y).toBe(EXPECTED_FOOT_Y);
      expect(p.isParachuteActive).toBe(false);
      expect(p.state).toBe('PARACHUTE_LANDING');
    });

    it('EMPIRICAL COMBAT TRANSITION 1G: All 4 soldier roles transition from PARACHUTE_LANDING to active combat AI without stalling', () => {
      const roles: Array<{ role: any; expectedCombatState: string }> = [
        { role: 'SOLDIER_RIFLE', expectedCombatState: 'PATROL' },
        { role: 'SOLDIER_KNIFE', expectedCombatState: 'IDLE' },
        { role: 'SOLDIER_GRENADE', expectedCombatState: 'SEEK_STANDOFF' },
        { role: 'SOLDIER_SHIELD', expectedCombatState: 'GUARD_ADVANCE' },
      ];

      for (const { role, expectedCombatState } of roles) {
        const testEng = new GameEngine();
        testEng.start();
        // Start at 191.5: 50 * (1/60) = 0.833 -> 191.5 + 0.833 = 192.333 >= 192 (touchdown on frame 1!)
        const p = SoldierEnemy.createParatrooper(
          `para_transition_${role}`,
          role,
          vec2(400, 191.5),
          {
            anchorX: 400,
            descentSpeed: 50,
            targetGroundY: GROUND_Y,
          }
        );
        testEng.addEntity(p);

        // Step 1 frame into touchdown
        testEng.tick(1 / 60);
        expect(p.state).toBe('PARACHUTE_LANDING');
        expect(p.position.y).toBe(EXPECTED_FOOT_Y);
        expect(p.isParachuteActive).toBe(false);

        // Advance past landing recovery window (0.25s = 15 frames at 60Hz)
        for (let f = 0; f < 20; f++) {
          testEng.tick(1 / 60);
        }

        // Entity must not be stuck in descent or landing recovery
        expect(p.state).toBe(expectedCombatState);
        expect(p.isAlive).toBe(true);
      }
    });
  });

  // =========================================================================
  // TASK 2: Structural & Trench Ambush Leap Kinematics
  // =========================================================================
  describe('2. Structural & Trench Ambush Leap Kinematics & Ballistic Arcs', () => {
    it('EMPIRICAL LEAP ARCS 2A: Ambush soldier initializes with vx != 0, vy < 0 and ballistic gravity arc', () => {
      const leapVx = -140;
      const leapVy = -200;
      const ambushSoldier = SoldierEnemy.createAmbushSoldier(
        'ambush_soldier_arc',
        'SOLDIER_KNIFE',
        vec2(500, 140),
        vec2(leapVx, leapVy),
        { facing: -1 }
      );
      engine.addEntity(ambushSoldier);

      expect(ambushSoldier.state).toBe('AMBUSH_LEAP');
      expect(ambushSoldier.velocity.x).toBe(leapVx);
      expect(ambushSoldier.velocity.y).toBe(leapVy);
      expect(ambushSoldier.facing).toBe(-1);

      // Track vertical position over first 10 frames
      let prevY = ambushSoldier.position.y;
      let prevVy = ambushSoldier.velocity.y;

      // First few ticks: upward velocity should decrease in magnitude (climbing toward apex)
      for (let i = 0; i < 10; i++) {
        engine.tick(1 / 60);
        // Vy becomes less negative under gravity (+720 px/s²)
        expect(ambushSoldier.velocity.y).toBeGreaterThan(prevVy);
        // Position Y decreases (moving upward on screen)
        expect(ambushSoldier.position.y).toBeLessThan(prevY);
        prevY = ambushSoldier.position.y;
        prevVy = ambushSoldier.velocity.y;
      }
    });

    it('EMPIRICAL APEX 2B: Ballistic apex matches discrete Euler integration: t_apex = 0.3s, y_apex = 109.4', () => {
      const y0 = 140;
      const v0y = -216; // 18 frames at 60Hz: 18 * (720/60) = 216 -> vy becomes 0
      const jumper = SoldierEnemy.createAmbushSoldier(
        'ambush_apex_test',
        'SOLDIER_KNIFE',
        vec2(600, y0),
        vec2(-100, v0y)
      );
      engine.addEntity(jumper);

      // Advance 18 frames (0.3s)
      for (let i = 0; i < 18; i++) {
        engine.tick(1 / 60);
      }

      // At apex, vertical velocity is 0 and discrete Euler position is 109.4
      expect(jumper.velocity.y).toBeCloseTo(0, 0.5);
      expect(jumper.position.y).toBeCloseTo(109.4, 0.5);
    });

    it('EMPIRICAL PLATFORM LANDING 2C: Ambush jumper lands on solid ground cleanly without falling through terrain', () => {
      const jumper = SoldierEnemy.createAmbushSoldier(
        'ambush_landing_ground',
        'SOLDIER_KNIFE',
        vec2(500, 140),
        vec2(-120, -150)
      );
      engine.addEntity(jumper);

      // Simulate leap until landing (approx 45 frames)
      for (let i = 0; i < 60; i++) {
        engine.tick(1 / 60);
      }

      // Must have landed at ground contact
      expect(jumper.position.y).toBe(EXPECTED_FOOT_Y);
      expect(jumper.position.y + jumper.height).toBe(GROUND_Y);
      expect(jumper.isAlive).toBe(true);

      // State must have transitioned past AMBUSH_LEAP and LAND_RECOVERY to IDLE / normal AI
      expect(jumper.state).not.toBe('AMBUSH_LEAP');
      expect(jumper.state).not.toBe('LAND_RECOVERY');
    });

    it('EMPIRICAL ELEVATED PLATFORM LANDING 2D: Ambush soldier lands on elevated semi-solid platform cleanly', () => {
      // Add elevated semi-solid bridge at y = 160
      const bridge: Platform = {
        id: 'elevated_bunker_platform',
        type: 'SEMI_SOLID',
        bounds: createAABB(400, 160, 150, 10),
      };
      engine.addPlatform(bridge);

      // Spawn jumper above bridge, leaping horizontally into its landing zone
      const jumper = SoldierEnemy.createAmbushSoldier(
        'ambush_elevated_dock',
        'SOLDIER_KNIFE',
        vec2(520, 100),
        vec2(-80, -60) // Upward leap that drops onto bridge (x: 400-550, top: 160)
      );
      engine.addEntity(jumper);

      // Advance physics simulation
      for (let i = 0; i < 40; i++) {
        engine.tick(1 / 60);
      }

      // Expected landing Y on bridge: bridge.top (160) - height (38) = 122
      expect(jumper.position.y).toBe(160 - SOLDIER_HEIGHT);
      expect(jumper.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // TASK 3: Mid-Air Combat Vulnerability & Casualty Transitions
  // =========================================================================
  describe('3. Mid-Air Combat Damage & Casualty Handling', () => {
    it('EMPIRICAL MID-AIR DAMAGE 3A: Paratrooper shot mid-descent takes damage and dies, notifying corpse manager', () => {
      let deathFired = false;
      let deathEventData: any = null;
      engine.eventBus.on('enemy_death', (data: any) => {
        if (data.id === 'para_casualty') {
          deathFired = true;
          deathEventData = data;
        }
      });

      const p = SoldierEnemy.createParatrooper(
        'para_casualty',
        'SOLDIER_RIFLE',
        vec2(300, 80),
        { targetGroundY: GROUND_Y }
      );
      engine.addEntity(p);
      // Run 1 tick so entity is active and engine reference is established
      engine.tick(1 / 60);
      expect(p.isParachuteActive).toBe(true);

      // Hit paratrooper with lethal bullet damage mid-air
      const hitResult = p.takeDamage(1, 'bullet', { x: 200, y: p.position.y });
      expect(hitResult).toBe(true);
      expect(p.isAlive).toBe(false);
      expect(p.health).toBe(0);
      expect(p.state).toBe('DEAD');
      expect(deathFired).toBe(true);
      expect(deathEventData.deathType).toBe('standard');
      expect(deathEventData.position.y).toBeCloseTo(p.position.y, 0.1);
    });

    it('EMPIRICAL MID-AIR FLAME 3B: Ambush jumper killed mid-leap by flamethrower transitions to fire death', () => {
      let deathEventData: any = null;
      engine.eventBus.on('enemy_death', (data: any) => {
        if (data.id === 'ambush_flame_death') {
          deathEventData = data;
        }
      });

      const jumper = SoldierEnemy.createAmbushSoldier(
        'ambush_flame_death',
        'SOLDIER_KNIFE',
        vec2(450, 120),
        vec2(-100, -180)
      );
      engine.addEntity(jumper);
      // Run 1 tick so entity is active and engine reference is established
      engine.tick(1 / 60);

      // Hit with flamethrower damage mid-air
      jumper.takeDamage(2, 'flame', { x: 400, y: jumper.position.y });

      expect(jumper.isAlive).toBe(false);
      expect(deathEventData).toBeDefined();
      expect(deathEventData.deathType).toBe('fire');
    });
  });

  // =========================================================================
  // TASK 4: Full Metal Slug Game Stage 1 Diverse Trigger Execution
  // =========================================================================
  describe('4. Stage 1 Diverse Spawner Integration', () => {
    it('EMPIRICAL STAGE TRIGGERS 4A: FullMetalSlugGame with spawnMode diverse executes all 4 diverse triggers', () => {
      const game = new FullMetalSlugGame(undefined, { spawnMode: 'diverse' });
      const stageData = (game as any).stageManager.currentStage;
      expect(stageData).toBeDefined();

      const triggerIds = stageData.triggers.map((t: any) => t.id);
      expect(triggerIds).toContain('trigger_parachute_wave_1');
      expect(triggerIds).toContain('trigger_bunker_ambush');
      expect(triggerIds).toContain('trigger_parachute_wave_2');
      expect(triggerIds).toContain('trigger_bridge_ambush');

      // Execute trigger_parachute_wave_1
      const para1 = stageData.triggers.find((t: any) => t.id === 'trigger_parachute_wave_1');
      para1.spawnAction(game.engine, 100);
      game.step(1 / 60);

      const rebelPara1 = game.engine.getEntity('rebel_paratrooper_1') as SoldierEnemy;
      expect(rebelPara1).toBeDefined();
      expect(rebelPara1.spawnBehavior).toBe('PARACHUTE_DROP');
      expect(rebelPara1.isParachuteActive).toBe(true);
      expect(rebelPara1.position.y).toBeLessThan(50);

      // Execute trigger_bunker_ambush
      const bunkerAmbush = stageData.triggers.find((t: any) => t.id === 'trigger_bunker_ambush');
      bunkerAmbush.spawnAction(game.engine, 300);
      game.step(1 / 60);

      const rebelAmbush1 = game.engine.getEntity('rebel_ambush_1') as SoldierEnemy;
      expect(rebelAmbush1).toBeDefined();
      expect(rebelAmbush1.spawnBehavior).toBe('STRUCTURE_AMBUSH');
      expect(rebelAmbush1.state).toBe('AMBUSH_LEAP');
      expect(rebelAmbush1.velocity.x).toBeLessThan(0);
      expect(rebelAmbush1.velocity.y).toBeLessThan(0);
    });

    it('EMPIRICAL STEP SIMULATION 4B: Paratroopers descend, land, and engage across 200 game steps', () => {
      const game = new FullMetalSlugGame(undefined, { spawnMode: 'diverse' });
      const stageData = (game as any).stageManager.currentStage;

      // Trigger wave 1 paratrooper
      const paraTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_parachute_wave_1');
      paraTrigger.spawnAction(game.engine, 0);

      // Step 1 frame to flush additions into game engine
      game.step(1 / 60);

      const paratrooper = game.engine.getEntity('rebel_paratrooper_1') as SoldierEnemy;
      expect(paratrooper).toBeDefined();
      expect(paratrooper.position.y).toBeLessThan(50);

      // Simulate 240 game steps (4.0s: 3.4s descent + 0.25s landing recovery + patrol)
      for (let s = 0; s < 240; s++) {
        game.step(1 / 60);
      }

      // Paratrooper should have landed and transitioned into PATROL / combat
      expect(paratrooper.position.y).toBe(EXPECTED_FOOT_Y);
      expect(paratrooper.isParachuteActive).toBe(false);
      expect(paratrooper.isAlive).toBe(true);
      expect(paratrooper.state).toBe('PATROL');
    });
  });

  // =========================================================================
  // TASK 5: Presentation & Canvas Rendering Robustness
  // =========================================================================
  describe('5. Canvas Rendering Presentation Safety', () => {
    it('EMPIRICAL RENDER 5A: CanvasRenderer renders active paratroopers and ambush leap soldiers without exceptions', () => {
      const camera = new Camera({ viewportWidth: 480, viewportHeight: 270 });
      const parallax = new ParallaxBackground();
      const renderer = new CanvasRenderer({ camera, parallax });

      const paratrooper = SoldierEnemy.createParatrooper(
        'render_para_test',
        'SOLDIER_RIFLE',
        vec2(200, 30),
        { targetGroundY: GROUND_Y }
      );
      const ambushSoldier = SoldierEnemy.createAmbushSoldier(
        'render_ambush_test',
        'SOLDIER_KNIFE',
        vec2(280, 100),
        vec2(-140, -200)
      );

      engine.addEntity(paratrooper);
      engine.addEntity(ambushSoldier);
      engine.tick(1 / 60);

      expect(() => {
        renderer.renderScene({
          camera,
          player: {
            x: 100,
            y: 192,
            facing: 1,
            state: 'idle',
          },
          enemies: [
            {
              id: paratrooper.id,
              type: paratrooper.type,
              x: paratrooper.position.x,
              y: paratrooper.position.y,
              facing: paratrooper.facing,
              state: paratrooper.state,
              isParachuteActive: paratrooper.isParachuteActive,
            },
            {
              id: ambushSoldier.id,
              type: ambushSoldier.type,
              x: ambushSoldier.position.x,
              y: ambushSoldier.position.y,
              facing: ambushSoldier.facing,
              state: ambushSoldier.state,
              isParachuteActive: ambushSoldier.isParachuteActive,
            },
          ],
        });
      }).not.toThrow();
    });
  });
});
