import { describe, it, expect, vi } from 'vitest';
import { Vec2, vec2, vec2Add, vec2Sub, vec2Scale, vec2Dot, vec2Normalize, vec2Dist, vec2Rotate, vec2Lerp } from '../../src/core/math/Vector2D';
import { BoundingBox, createAABB } from '../../src/core/physics/AABB';
import { SpatialGrid } from '../../src/core/physics/SpatialGrid';
import { Platform, PlatformPhysics } from '../../src/core/physics/Platform';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { StageManager, StageState, StageData } from '../../src/core/engine/StageManager';

describe('Vector2D Math Suite', () => {
  it('should create and clone vectors accurately', () => {
    const v = vec2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
    const cloned = Vec2.clone(v);
    expect(cloned).toEqual(v);
    expect(cloned).not.toBe(v);
  });

  it('should perform arithmetic operations: add, sub, scale', () => {
    const a = vec2(10, 20);
    const b = vec2(5, 8);
    expect(vec2Add(a, b)).toEqual({ x: 15, y: 28 });
    expect(vec2Sub(a, b)).toEqual({ x: 5, y: 12 });
    expect(vec2Scale(a, 2)).toEqual({ x: 20, y: 40 });
  });

  it('should calculate dot product and magnitude correctly', () => {
    const a = vec2(3, 4);
    expect(Vec2.lenSq(a)).toBe(25);
    expect(Vec2.len(a)).toBe(5);
    expect(vec2Dot(a, vec2(2, 3))).toBe(18); // 3*2 + 4*3 = 18
  });

  it('should normalize vectors safely, handling zero vectors', () => {
    const v = vec2(0, 10);
    const norm = vec2Normalize(v);
    expect(norm.x).toBeCloseTo(0);
    expect(norm.y).toBeCloseTo(1);

    const zero = vec2(0, 0);
    const zeroNorm = vec2Normalize(zero);
    expect(zeroNorm).toEqual({ x: 0, y: 0 });
  });

  it('should calculate distance and angle between vectors', () => {
    const a = vec2(0, 0);
    const b = vec2(3, 4);
    expect(vec2Dist(a, b)).toBe(5);

    const right = vec2(1, 0);
    const up = vec2(0, -1);
    expect(Vec2.angle(right)).toBe(0);
    expect(Vec2.angle(up)).toBeCloseTo(-Math.PI / 2);
  });

  it('should rotate vectors correctly', () => {
    const right = vec2(1, 0);
    const rotated = vec2Rotate(right, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('should interpolate vectors via lerp', () => {
    const a = vec2(0, 0);
    const b = vec2(100, 200);
    expect(vec2Lerp(a, b, 0.5)).toEqual({ x: 50, y: 100 });
    expect(vec2Lerp(a, b, 0)).toEqual({ x: 0, y: 0 });
    expect(vec2Lerp(a, b, 1)).toEqual({ x: 100, y: 200 });
  });
});

describe('AABB Bounding Box Suite', () => {
  it('should detect intersections between overlapping boxes', () => {
    const boxA = createAABB(0, 0, 50, 50);
    const boxB = createAABB(25, 25, 50, 50);
    const boxC = createAABB(100, 100, 50, 50);

    expect(BoundingBox.intersects(boxA, boxB)).toBe(true);
    expect(BoundingBox.intersects(boxA, boxC)).toBe(false);
  });

  it('should detect point containment', () => {
    const box = createAABB(10, 20, 100, 50);
    expect(BoundingBox.containsPoint(box, vec2(50, 40))).toBe(true);
    expect(BoundingBox.containsPoint(box, vec2(5, 40))).toBe(false);
    expect(BoundingBox.containsPoint(box, vec2(50, 80))).toBe(false);
  });

  it('should calculate center, expansion, and offset', () => {
    const box = createAABB(10, 20, 40, 60);
    expect(BoundingBox.getCenter(box)).toEqual({ x: 30, y: 50 });

    const expanded = BoundingBox.expand(box, 5);
    expect(expanded).toEqual({ x: 5, y: 15, width: 50, height: 70 });

    const offset = BoundingBox.offset(box, vec2(10, -5));
    expect(offset).toEqual({ x: 20, y: 15, width: 40, height: 60 });
  });

  it('should compute penetration vector for separation', () => {
    const a = createAABB(0, 0, 20, 20);
    const b = createAABB(15, 0, 20, 20); // 5px horizontal overlap
    const pen = BoundingBox.getPenetration(a, b);
    expect(pen).not.toBeNull();
    expect(pen?.x).toBe(-5);
    expect(pen?.y).toBe(0);
  });
});

describe('SpatialGrid Broadphase Suite', () => {
  it('should insert, query, and remove items correctly', () => {
    const grid = new SpatialGrid(64);
    const item1 = { id: 'entity-1', bounds: createAABB(10, 10, 20, 20) };
    const item2 = { id: 'entity-2', bounds: createAABB(500, 500, 20, 20) };

    grid.insert(item1);
    grid.insert(item2);
    expect(grid.count()).toBe(2);

    const queryResults = grid.query(createAABB(0, 0, 50, 50));
    expect(queryResults.length).toBe(1);
    expect(queryResults[0].id).toBe('entity-1');

    grid.remove(item1);
    expect(grid.count()).toBe(1);
    expect(grid.query(createAABB(0, 0, 50, 50)).length).toBe(0);
  });
});

describe('Platform Physics & One-Way Drop Suite', () => {
  const solidFloor: Platform = {
    id: 'floor',
    type: 'SOLID',
    bounds: createAABB(0, 200, 1000, 40),
  };

  const semiSolidLedge: Platform = {
    id: 'ledge-1',
    type: 'SEMI_SOLID',
    bounds: createAABB(100, 120, 200, 10),
  };

  it('should land entity on top of semi-solid platform when falling downwards', () => {
    const result = PlatformPhysics.checkSemiSolidLanding(
      150, // footX
      118, // prevFootY (above ledge at 120)
      122, // currFootY (crossing ledge top)
      4.0, // vy > 0 (falling)
      12,  // halfWidth
      semiSolidLedge
    );

    expect(result.isGrounded).toBe(true);
    expect(result.groundY).toBe(120);
    expect(result.platform?.id).toBe('ledge-1');
  });

  it('should allow upward jumping pass-through on semi-solid platform', () => {
    const result = PlatformPhysics.checkSemiSolidLanding(
      150,
      130, // prevFootY (below ledge)
      115, // currFootY (crossing upward)
      -5.0, // vy < 0 (jumping upward)
      12,
      semiSolidLedge
    );

    expect(result.isGrounded).toBe(false);
  });

  it('should ignore landing when drop-through is active for that platform', () => {
    const result = PlatformPhysics.checkSemiSolidLanding(
      150,
      118,
      122,
      4.0,
      12,
      semiSolidLedge,
      'ledge-1' // ignoredPlatformId
    );

    expect(result.isGrounded).toBe(false);
  });

  it('should resolve ground contact against multiple platforms', () => {
    const platforms = [solidFloor, semiSolidLedge];
    const result = PlatformPhysics.resolveGroundContact(
      150,
      115,
      125,
      5.0,
      12,
      platforms
    );

    expect(result.isGrounded).toBe(true);
    expect(result.groundY).toBe(120); // lands on the higher ledge
  });
});

describe('GameEngine & StageManager Suite', () => {
  class TestEntity implements GameEntity {
    constructor(
      public id: string,
      public type: string,
      public position = { x: 0, y: 0 },
      public velocity = { x: 0, y: 0 },
      public bounds = createAABB(0, 0, 20, 20),
      public isAlive = true
    ) {}

    update(dt: number): void {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.bounds.x = this.position.x;
      this.bounds.y = this.position.y;
    }
  }

  it('should run deterministic 60Hz ticks with accumulator', () => {
    const engine = new GameEngine();
    engine.start();

    const entity = new TestEntity('mover', 'TEST_TYPE', { x: 0, y: 0 }, { x: 60, y: 0 });
    engine.addEntity(entity);

    // Initial update with dt = 1/60s (exactly one tick)
    engine.update(1 / 60);

    expect(engine.getTickCount()).toBe(1);
    expect(entity.position.x).toBeCloseTo(1.0); // 60 * (1/60) = 1.0

    // Advance by another 2 ticks (2/60s)
    engine.update(2 / 60);
    expect(engine.getTickCount()).toBe(3);
    expect(entity.position.x).toBeCloseTo(3.0);
  });

  it('should emit and receive events via EventBus', () => {
    const engine = new GameEngine();
    const handler = vi.fn();

    engine.eventBus.on('weapon_fired', handler);
    engine.eventBus.emit('weapon_fired', { type: 'HEAVY_MACHINE_GUN', ammo: 199 });

    expect(handler).toHaveBeenCalledWith({ type: 'HEAVY_MACHINE_GUN', ammo: 199 });
  });

  it('should advance stage state and fire spawn triggers in StageManager', () => {
    const engine = new GameEngine();
    const stageManager = new StageManager(engine);

    const spawnFn = vi.fn();

    const testStage: StageData = {
      id: 'stage-1',
      name: 'Beach Landing',
      width: 2000,
      height: 270,
      initialCameraBounds: { minX: 0, maxX: 480, minY: 0, maxY: 270 },
      platforms: [{ id: 'p1', type: 'SOLID', bounds: createAABB(0, 240, 2000, 30) }],
      triggers: [
        {
          id: 'wave-1',
          triggerX: 300,
          triggered: false,
          lockCameraBounds: { minX: 200, maxX: 680, minY: 0, maxY: 270 },
          spawnAction: spawnFn,
        },
      ],
    };

    stageManager.loadStage(testStage);
    expect(stageManager.getState()).toBe(StageState.SECTION_1_ADVANCE);
    expect(stageManager.isCameraLocked()).toBe(false);

    // Player before trigger
    stageManager.update(100, 250);
    expect(spawnFn).not.toHaveBeenCalled();
    expect(stageManager.isCameraLocked()).toBe(false);

    // Player crosses trigger at X = 300
    stageManager.update(200, 320);
    expect(spawnFn).toHaveBeenCalled();
    expect(stageManager.isCameraLocked()).toBe(true);
    expect(stageManager.getCameraBounds().maxX).toBe(680);
  });
});
