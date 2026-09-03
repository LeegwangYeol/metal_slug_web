import { Vector2D } from '../math/Vector2D';
import { AABB, BoundingBox } from '../physics/AABB';
import { Platform } from '../physics/Platform';
import { SpatialGrid, SpatialGridItem } from '../physics/SpatialGrid';

export interface GameEntity extends SpatialGridItem {
  id: string;
  type: string;
  position: Vector2D;
  velocity: Vector2D;
  bounds: AABB;
  isAlive: boolean;
  update(dt: number, engine: GameEngine): void;
  onCollision?(other: GameEntity, engine: GameEngine): void;
}

export type EventCallback<T = any> = (payload: T) => void;

export class EventBus {
  private handlers: Map<string, Set<EventCallback>> = new Map();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    let list = this.handlers.get(event);
    if (!list) {
      list = new Set();
      this.handlers.set(event, list);
    }
    list.add(callback as EventCallback);
    return () => {
      list?.delete(callback as EventCallback);
    };
  }

  emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event);
    if (list) {
      for (const handler of list) {
        handler(payload);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export interface GameEngineOptions {
  fixedTimestep?: number; // default 1/60 s
  maxSubSteps?: number;   // default 5 to avoid spiral of death
  spatialCellSize?: number; // default 64 px
}

/**
 * GameEngine - Headless 60Hz fixed-timestep simulation core.
 * Coordinates entity lifecycle, kinematics, collision resolution, and event broadcasting.
 * Zero DOM or Canvas dependencies.
 */
export class GameEngine {
  public static readonly DEFAULT_TIMESTEP: number = 1 / 60; // 0.0166667s

  public readonly fixedTimestep: number;
  public readonly maxSubSteps: number;

  private accumulator: number = 0;
  private tickCount: number = 0;
  private totalSimulationTime: number = 0;
  private isRunning: boolean = false;

  public readonly eventBus: EventBus = new EventBus();
  public readonly spatialGrid: SpatialGrid<GameEntity>;

  private entities: Map<string, GameEntity> = new Map();
  private entitiesToAdd: GameEntity[] = [];
  private entityIdsToRemove: Set<string> = new Set();

  private platforms: Platform[] = [];

  constructor(options: GameEngineOptions = {}) {
    this.fixedTimestep = options.fixedTimestep ?? GameEngine.DEFAULT_TIMESTEP;
    this.maxSubSteps = options.maxSubSteps ?? 5;
    this.spatialGrid = new SpatialGrid<GameEntity>(options.spatialCellSize ?? 64);
  }

  start(): void {
    this.isRunning = true;
    this.accumulator = 0;
  }

  stop(): void {
    this.isRunning = false;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  getTotalSimulationTime(): number {
    return this.totalSimulationTime;
  }

  // --- Platform Management ---

  setPlatforms(platforms: Platform[]): void {
    this.platforms = [...platforms];
  }

  addPlatform(platform: Platform): void {
    this.platforms.push(platform);
  }

  getPlatforms(): Platform[] {
    return this.platforms;
  }

  // --- Entity Management ---

  addEntity(entity: GameEntity): void {
    this.entitiesToAdd.push(entity);
  }

  removeEntity(id: string): void {
    this.entityIdsToRemove.add(id);
  }

  getEntity(id: string): GameEntity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): GameEntity[] {
    return Array.from(this.entities.values());
  }

  getEntitiesByType(type: string): GameEntity[] {
    const result: GameEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.type === type && entity.isAlive) {
        result.push(entity);
      }
    }
    return result;
  }

  // --- Simulation Integration ---

  /**
   * Main update loop call with variable delta time.
   * Accumulates time and runs fixed 60Hz ticks.
   */
  update(dt: number): void {
    if (!this.isRunning) return;

    // Guard against huge deltas (e.g. background tab return)
    const clampedDt = Math.min(dt, this.fixedTimestep * this.maxSubSteps);
    this.accumulator += clampedDt;

    let steps = 0;
    while (this.accumulator >= this.fixedTimestep && steps < this.maxSubSteps) {
      this.tick(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
      steps++;
    }
  }

  /**
   * Deterministic single fixed-timestep tick (dt = 1/60s).
   * Can be called directly by unit test runners.
   */
  tick(dt: number = this.fixedTimestep): void {
    this.tickCount++;
    this.totalSimulationTime += dt;

    // 1. Process pending additions
    if (this.entitiesToAdd.length > 0) {
      for (const entity of this.entitiesToAdd) {
        this.entities.set(entity.id, entity);
        this.spatialGrid.insert(entity);
      }
      this.entitiesToAdd = [];
    }

    // 2. Process pending removals
    if (this.entityIdsToRemove.size > 0) {
      for (const id of this.entityIdsToRemove) {
        const entity = this.entities.get(id);
        if (entity) {
          this.spatialGrid.remove(entity);
          this.entities.delete(id);
        }
      }
      this.entityIdsToRemove.clear();
    }

    // 3. Update all active entities
    for (const entity of this.entities.values()) {
      if (entity.isAlive) {
        entity.update(dt, this);
        // Refresh position in spatial grid
        this.spatialGrid.update(entity);
      } else {
        this.entityIdsToRemove.add(entity.id);
      }
    }

    // 4. Narrowphase collision resolution
    this.resolveEntityCollisions();
  }

  /**
   * Checks collisions between dynamic entities registered in the spatial grid.
   */
  private resolveEntityCollisions(): void {
    const activeEntities = Array.from(this.entities.values()).filter((e) => e.isAlive);

    for (const entity of activeEntities) {
      const candidates = this.spatialGrid.query(entity.bounds);
      for (const other of candidates) {
        if (entity.id !== other.id && other.isAlive) {
          if (BoundingBox.intersects(entity.bounds, other.bounds)) {
            if (entity.onCollision) {
              entity.onCollision(other, this);
            }
          }
        }
      }
    }
  }

  clear(): void {
    this.entities.clear();
    this.entitiesToAdd = [];
    this.entityIdsToRemove.clear();
    this.platforms = [];
    this.spatialGrid.clear();
    this.accumulator = 0;
    this.tickCount = 0;
    this.totalSimulationTime = 0;
  }
}
