import { Platform } from '../physics/Platform';
import { GameEngine } from './GameEngine';

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

export interface SpawnTrigger {
  id: string;
  triggerX: number;
  triggered: boolean;
  lockCameraBounds?: CameraBounds;
  spawnAction: (engine: GameEngine) => void;
  isCompleted?: (engine: GameEngine) => boolean;
}

export interface StageData {
  id: string;
  name: string;
  width: number;
  height: number;
  initialCameraBounds: CameraBounds;
  platforms: Platform[];
  triggers: SpawnTrigger[];
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
  private activeLockTrigger: SpawnTrigger | null = null;

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
   * Evaluates camera and player positions against spawn triggers.
   */
  update(_cameraX: number, playerX: number): void {
    if (!this.currentStage) return;

    // If currently camera-locked by an active trigger, evaluate completion
    if (this.cameraLocked && this.activeLockTrigger) {
      if (this.activeLockTrigger.isCompleted && this.activeLockTrigger.isCompleted(this.engine)) {
        this.unlockCamera();
      }
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

        trigger.spawnAction(this.engine);
        this.engine.eventBus.emit('spawn_trigger_fired', { id: trigger.id });
      }
    }
  }

  getPlatforms(): Platform[] {
    return this.currentStage ? this.currentStage.platforms : [];
  }
}
