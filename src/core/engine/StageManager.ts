import { Platform } from '../physics/Platform';
import { GameEngine } from './GameEngine';
import { SoldierEnemy } from '../entities/enemies/SoldierEnemy';

export enum StageState {
  INITIALIZING = 'INITIALIZING',
  SECTION_1_ADVANCE = 'SECTION_1_ADVANCE',
  MID_BOSS_BATTLE = 'MID_BOSS_BATTLE',
  SECTION_2_ADVANCE = 'SECTION_2_ADVANCE',
  BOSS_BATTLE = 'BOSS_BATTLE',
  STAGE_CLEAR = 'STAGE_CLEAR',
  GAME_OVER = 'GAME_OVER',
}

export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface StageTrigger {
  id: string;
  triggerX: number;
  triggered: boolean;
  lockCameraBounds?: CameraBounds;
  spawnAction: (engine: GameEngine, cameraX: number) => void;
  isCompleted?: (engine: GameEngine) => boolean;
}

// Retain SpawnTrigger alias for backwards compatibility
export type SpawnTrigger = StageTrigger;

export interface StageData {
  id: string;
  name: string;
  width: number;
  height: number;
  initialCameraBounds: CameraBounds;
  platforms: Platform[];
  triggers: StageTrigger[];
}

/**
 * StageManager - Controls stage progression, camera advancement boundaries,
 * platform layouts, and scripted enemy/boss spawn triggers.
 */
export class StageManager {
  private currentStage: StageData | null = null;
  private state: StageState = StageState.INITIALIZING;
  private cameraBounds: CameraBounds = { minX: 0, maxX: 480, minY: 0, maxY: 270 };
  private cameraLocked: boolean = false;
  private activeLockTrigger: StageTrigger | null = null;
  private currentCameraX: number = 0;

  constructor(private readonly engine: GameEngine) {}

  loadStage(stageData: StageData): void {
    this.currentStage = stageData;
    this.state = StageState.SECTION_1_ADVANCE;
    this.cameraBounds = { ...stageData.initialCameraBounds };
    this.cameraLocked = false;
    this.activeLockTrigger = null;

    // Load platforms into the game engine
    this.engine.setPlatforms(stageData.platforms);

    this.engine.eventBus.emit('stage_loaded', {
      stageId: stageData.id,
      name: stageData.name,
      width: stageData.width,
    });
  }

  getCurrentStage(): StageData | null {
    return this.currentStage;
  }

  getState(): StageState {
    return this.state;
  }

  setState(newState: StageState): void {
    const oldState = this.state;
    this.state = newState;
    this.engine.eventBus.emit('stage_state_changed', { from: oldState, to: newState });
  }

  getCameraBounds(): CameraBounds {
    return this.cameraBounds;
  }

  getCameraX(): number {
    return this.currentCameraX;
  }

  isCameraLocked(): boolean {
    return this.cameraLocked;
  }

  lockCamera(bounds: CameraBounds): void {
    this.cameraBounds = { ...bounds };
    this.cameraLocked = true;
    this.engine.eventBus.emit('camera_locked', bounds);
  }

  unlockCamera(newMaxX?: number): void {
    this.cameraLocked = false;
    this.activeLockTrigger = null;
    if (newMaxX !== undefined && this.currentStage) {
      this.cameraBounds.maxX = Math.min(newMaxX, this.currentStage.width);
    } else if (this.currentStage) {
      this.cameraBounds.maxX = this.currentStage.width;
    }
    this.engine.eventBus.emit('camera_unlocked', this.cameraBounds);
  }

  /**
   * Evaluates camera and player positions against spawn triggers and cleans up off-screen entities.
   */
  update(cameraX: number, playerX: number): void {
    this.currentCameraX = cameraX;
    // Expose current cameraX on engine for entities that query engine
    (this.engine as any).cameraX = cameraX;

    if (!this.currentStage) return;

    // If currently camera-locked by an active trigger, evaluate completion
    if (this.cameraLocked && this.activeLockTrigger) {
      if (this.activeLockTrigger.isCompleted && this.activeLockTrigger.isCompleted(this.engine)) {
        this.unlockCamera();
      }
      this.despawnOffscreenEntities(cameraX);
      return;
    }

    // Check triggers that haven't fired yet
    for (const trigger of this.currentStage.triggers) {
      if (!trigger.triggered && playerX >= trigger.triggerX) {
        trigger.triggered = true;

        if (trigger.lockCameraBounds) {
          this.activeLockTrigger = trigger;
          this.lockCamera(trigger.lockCameraBounds);
        }

        trigger.spawnAction(this.engine, cameraX);
        this.engine.eventBus.emit('spawn_trigger_fired', { id: trigger.id, cameraX });
      }
    }

    // Cleanly despawn off-screen minions and projectiles behind camera or below stage
    this.despawnOffscreenEntities(cameraX);
  }

  /**
   * Scans active minions and cleanly despawns any minion that falls behind the camera
   * (x < cameraX - 180) or drops below stage (y > 320), removing them from the engine
   * to prevent memory leaks and spatial grid clutter.
   */
  despawnOffscreenEntities(cameraX: number = this.currentCameraX): void {
    const allEntities = this.engine.getAllEntities();
    for (const entity of allEntities) {
      if (!entity.isAlive) continue;

      // Player, Bosses, and POWs are never despawned by off-screen culling
      if (
        entity.id === 'player' ||
        entity.type === 'PLAYER' ||
        entity.type === 'BOSS_TETSUYUKI' ||
        entity.type === 'MID_BOSS_VEHICLE' ||
        entity.type === 'POW'
      ) {
        continue;
      }

      // Check minion classification
      const isMinion =
        entity instanceof SoldierEnemy ||
        entity.type.startsWith('SOLDIER_') ||
        entity.type === 'minion' ||
        entity.type === 'ENEMY_BULLET' ||
        entity.type === 'ENEMY_GRENADE';

      if (isMinion) {
        if (entity.position.x < cameraX - 180 || entity.position.y > 320) {
          entity.isAlive = false;
          this.engine.removeEntity(entity.id);
          this.engine.eventBus.emit('entity_despawned', { id: entity.id, type: entity.type });
        }
      }
    }
  }

  getPlatforms(): Platform[] {
    return this.currentStage ? this.currentStage.platforms : [];
  }
}
