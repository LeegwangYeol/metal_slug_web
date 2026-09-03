import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { FullMetalSlugGame } from '../../src/main';
import { vec2 } from '../../src/core/math/Vector2D';

describe('R1: Diverse Enemy Spawning & Kinematics Suite', () => {
  it('PARACHUTE DROP: Spawns high above (Y < 50) and descends with terminal velocity between 40-60 px/s', () => {
    const engine = new GameEngine();
    const paratrooper = SoldierEnemy.createParatrooper(
      'para_test_1',
      'SOLDIER_RIFLE',
      vec2(200, 20),
      {
        anchorX: 200,
        descentSpeed: 50,
        swayAmplitude: 15,
        swayFrequency: 3.0,
        targetGroundY: 230,
      }
    );

    expect(paratrooper.position.y).toBeLessThan(50);
    expect(paratrooper.isParachuteActive).toBe(true);
    expect(paratrooper.state).toBe('PARACHUTE_DESCENT');
    expect(paratrooper.velocity.y).toBeGreaterThanOrEqual(40);
    expect(paratrooper.velocity.y).toBeLessThanOrEqual(60);

    engine.addEntity(paratrooper);

    // Simulate 0.5s of descent
    paratrooper.update(0.5, engine);
    expect(paratrooper.position.y).toBeCloseTo(20 + 50 * 0.5, 1);
    expect(paratrooper.isParachuteActive).toBe(true);
  });

  it('PARACHUTE SWAY: Integrates harmonic sinusoidal horizontal sway without gravity acceleration', () => {
    const engine = new GameEngine();
    const anchorX = 300;
    const amplitude = 18;
    const freq = 3.0;
    const paratrooper = SoldierEnemy.createParatrooper(
      'para_sway_test',
      'SOLDIER_KNIFE',
      vec2(anchorX, 10),
      {
        anchorX,
        descentSpeed: 45,
        swayAmplitude: amplitude,
        swayFrequency: freq,
        swayPhase: 0,
        targetGroundY: 230,
      }
    );

    // Step 0.2s
    paratrooper.update(0.2, engine);
    const expectedX = anchorX + amplitude * Math.sin(freq * 0.2);
    expect(paratrooper.position.x).toBeCloseTo(expectedX, 1);

    // Verify velocity.x represents harmonic derivative
    const expectedVx = amplitude * freq * Math.cos(freq * 0.2);
    expect(paratrooper.velocity.x).toBeCloseTo(expectedVx, 1);

    // Verify terminal descent velocity remains constant (not accelerating under 720 px/s² gravity)
    expect(paratrooper.velocity.y).toBe(45);
  });

  it('PARACHUTE TOUCHDOWN: Detaches canopy, lands at Y=230 foot line, and transitions to combat AI', () => {
    const engine = new GameEngine();
    let landedEventFired = false;
    engine.eventBus.on('enemy_parachute_landed', (data: { id: string }) => {
      if (data.id === 'para_land_test') {
        landedEventFired = true;
      }
    });

    // Start 10px above touchdown (targetGroundY = 230, soldier height = 38, so landing position.y = 192)
    const paratrooper = SoldierEnemy.createParatrooper(
      'para_land_test',
      'SOLDIER_RIFLE',
      vec2(250, 185),
      {
        anchorX: 250,
        descentSpeed: 50,
        targetGroundY: 230,
      }
    );

    engine.addEntity(paratrooper);

    // Advance until touchdown
    for (let i = 0; i < 30; i++) {
      paratrooper.update(1 / 60, engine);
      if (paratrooper.state === 'PARACHUTE_LANDING' || paratrooper.state === 'PATROL') {
        break;
      }
    }

    expect(paratrooper.position.y).toBe(192); // 230 - 38
    expect(paratrooper.isParachuteActive).toBe(false);
    expect(landedEventFired).toBe(true);

    // Advance landing recovery window (0.25s)
    for (let i = 0; i < 20; i++) {
      paratrooper.update(1 / 60, engine);
    }
    // Transitions to combat AI (rifleman -> PATROL)
    expect(paratrooper.state).toBe('PATROL');
  });

  it('STRUCTURE AMBUSH: Leaps from elevated structure with vx != 0, vy < 0 and lands via gravity arc', () => {
    const engine = new GameEngine();
    const leapVx = -140;
    const leapVy = -200;
    const ambushSoldier = SoldierEnemy.createAmbushSoldier(
      'ambush_test_1',
      'SOLDIER_KNIFE',
      vec2(400, 140),
      vec2(leapVx, leapVy),
      { facing: -1 }
    );

    expect(ambushSoldier.state).toBe('AMBUSH_LEAP');
    expect(ambushSoldier.velocity.x).toBe(leapVx);
    expect(ambushSoldier.velocity.y).toBe(leapVy);
    expect(ambushSoldier.facing).toBe(-1);

    engine.addEntity(ambushSoldier);

    // Simulating leap physics under gravity
    ambushSoldier.update(0.1, engine);
    // vy increases towards 0 under gravity
    expect(ambushSoldier.velocity.y).toBeGreaterThan(leapVy);
    expect(ambushSoldier.position.x).toBeLessThan(400);
  });

  it('STAGE DATA INTEGRATION: Diverse spawnMode populates parachute waves and ambush triggers', () => {
    const game = new FullMetalSlugGame(undefined, { spawnMode: 'diverse' });
    const stageData = game.buildStage1Data({ spawnMode: 'diverse' });

    const triggerIds = stageData.triggers.map((t) => t.id);
    expect(triggerIds).toContain('trigger_parachute_wave_1');
    expect(triggerIds).toContain('trigger_bunker_ambush');
    expect(triggerIds).toContain('trigger_parachute_wave_2');
    expect(triggerIds).toContain('trigger_bridge_ambush');

    // Verify trigger_parachute_wave_1 spawn action
    const engine = new GameEngine();
    const paraTrigger = stageData.triggers.find((t) => t.id === 'trigger_parachute_wave_1')!;
    paraTrigger.spawnAction(engine, 100);
    engine.tick(1 / 60);

    const spawned = engine.getEntity('rebel_paratrooper_1') as SoldierEnemy;

    expect(spawned).toBeDefined();
    expect(spawned.isParachuteActive).toBe(true);
    expect(spawned.position.y).toBeLessThan(50);
  });
});
