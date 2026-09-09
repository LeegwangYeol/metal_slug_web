import { GameEngine } from '../../engine/GameEngine';
import { CameraBounds, StageManager } from '../../engine/StageManager';
import {
  BossEntity,
  CrisisActionContext,
  CrisisEventConfig,
  CrisisEventPayload,
} from './BossTypes';
import {
  ArtilleryShellHazard,
  ArtilleryTargetReticle,
  FallingDebrisHazard,
  GroundFlameHazard,
} from './EnvironmentalHazard';

/**
 * Decoupled manager that tracks boss health checkpoints and triggers
 * dynamic, environment-altering crisis situations (artillery strikes,
 * platform collapses, camera bounds contraction, rage overdrive).
 */
export class CrisisEventManager {
  private engine: GameEngine;
  private stageManager: StageManager | null = null;
  private boss: BossEntity | null = null;
  private registeredCrises: CrisisEventConfig[] = [];
  private triggeredCrises: Set<string> = new Set();
  private aliasMap: Map<string, string> = new Map();

  constructor(engine: GameEngine, stageManager?: StageManager, boss?: BossEntity) {
    this.engine = engine;
    this.stageManager = stageManager ?? null;
    this.boss = boss ?? null;

    // Register alias mappings for standard crisis names
    this.setupAliases();
  }

  private setupAliases(): void {
    this.aliasMap.set('CRISIS_ARTILLERY_STRIKE', 'crisis_artillery_75');
    this.aliasMap.set('crisis_artillery_75', 'CRISIS_ARTILLERY_STRIKE');

    this.aliasMap.set('CRISIS_TERRAIN_COLLAPSE', 'crisis_collapse_50');
    this.aliasMap.set('crisis_collapse_50', 'CRISIS_TERRAIN_COLLAPSE');

    this.aliasMap.set('CRISIS_RAGE_OVERDRIVE', 'crisis_rage_25');
    this.aliasMap.set('crisis_rage_25', 'CRISIS_RAGE_OVERDRIVE');
  }

  public setStageManager(stageManager: StageManager): void {
    this.stageManager = stageManager;
  }

  public getStageManager(): StageManager | null {
    return this.stageManager;
  }

  public setBoss(boss: BossEntity): void {
    this.boss = boss;
    this.triggeredCrises.clear();
  }

  public getBoss(): BossEntity | null {
    return this.boss;
  }

  public registerCrisis(crisis: CrisisEventConfig): void {
    // Avoid duplicate registration of the same ID
    const existingIndex = this.registeredCrises.findIndex((c) => c.id === crisis.id);
    if (existingIndex !== -1) {
      this.registeredCrises[existingIndex] = crisis;
    } else {
      this.registeredCrises.push(crisis);
    }

    // Keep sorted descending by threshold (0.75 -> 0.50 -> 0.25)
    this.registeredCrises.sort((a, b) => b.thresholdRatio - a.thresholdRatio);
  }

  /**
   * Registers default crisis events for 75%, 50%, and 25% thresholds
   * satisfying Milestone 1 acceptance criteria.
   */
  public registerDefaultCrises(
    platformToCollapse: string = 'boss_arena_left',
    contractedMinX: number = 1880
  ): void {
    // 75% HP: Artillery Bombardment Strike
    this.registerCrisis({
      id: 'CRISIS_ARTILLERY_STRIKE',
      thresholdRatio: 0.75,
      name: 'Heavy Artillery Bombardment',
      description: 'Incoming siege battery saturates the ground arena with explosive shells',
      severity: 'WARNING',
      action: (context) => {
        const stageMgr = context.stageManager ?? this.stageManager;
        const currentCamX = stageMgr ? stageMgr.getCameraX() : (context.engine as any).cameraX ?? 1800;
        const startX = Math.max(currentCamX + 60, 1860);
        const endX = startX + 320;
        const step = (endX - startX) / 3;

        // Spawn warning reticles and falling shells across active ground arena
        for (let i = 0; i < 4; i++) {
          const spawnX = startX + i * step;
          const reticle = new ArtilleryTargetReticle(`reticle_${Date.now()}_${i}`, spawnX, 230, 0.8);
          context.engine.addEntity(reticle);

          const shell = new ArtilleryShellHazard(
            `artillery_shell_${Date.now()}_${i}`,
            spawnX,
            -20 - i * 15,
            380,
            230
          );
          context.engine.addEntity(shell);
        }
      },
    });

    // 50% HP: Terrain Collapse and Camera Bounds Contraction
    this.registerCrisis({
      id: 'CRISIS_TERRAIN_COLLAPSE',
      thresholdRatio: 0.50,
      name: 'Terrain Collapse & Arena Contraction',
      description: 'Structural failure destroys retreat platform and constricts combat arena',
      severity: 'CRITICAL',
      action: (context) => {
        const stageMgr = context.stageManager ?? this.stageManager;
        if (stageMgr) {
          // 1. Collapse the designated platform
          stageMgr.collapsePlatform(platformToCollapse);

          // 2. Contract camera bounds
          const currentBounds = stageMgr.getCameraBounds();
          const targetMinX = Math.max(currentBounds.minX, contractedMinX);
          const newBounds: CameraBounds = {
            ...currentBounds,
            minX: targetMinX,
          };
          stageMgr.setCameraBounds(newBounds);
          stageMgr.lockCamera(newBounds);

          // 3. Keep player inside safe zone
          const player = context.engine.getEntity('player') as any;
          if (player && player.position && player.position.x < targetMinX + 16) {
            player.position.x = targetMinX + 16;
          }
        }

        // 4. Spawn falling debris hazards
        for (let i = 0; i < 3; i++) {
          const debris = new FallingDebrisHazard(
            `debris_${Date.now()}_${i}`,
            1860 + i * 45,
            -15,
            (i - 1) * 20,
            260,
            230
          );
          context.engine.addEntity(debris);
        }
      },
    });

    // 25% HP: Boss Rage Overdrive State
    this.registerCrisis({
      id: 'CRISIS_RAGE_OVERDRIVE',
      thresholdRatio: 0.25,
      name: 'Overdrive Rage State',
      description: 'Boss disengages safety governors, enters enraged state with 50% attack cooldowns',
      severity: 'OVERDRIVE',
      action: (context) => {
        context.boss.isRaging = true;
        context.boss.rageSpeedMultiplier = 1.5;

        // If the boss has an explicit enterRageState hook, call it
        if (typeof (context.boss as any).enterRageState === 'function') {
          (context.boss as any).enterRageState();
        }

        // Spawn ground flame hazard during rage shockwave
        const stageMgr = context.stageManager ?? this.stageManager;
        const camX = stageMgr ? stageMgr.getCameraX() : 1800;
        const flame = new GroundFlameHazard(
          `rage_flame_${Date.now()}`,
          camX + 80,
          216,
          80,
          3.0,
          2
        );
        context.engine.addEntity(flame);
      },
    });
  }

  /**
   * Evaluates boss health against registered crisis thresholds.
   * Fully robust against instant lethal burst damage (triggers all passed thresholds in order).
   */
  public update(
    _dt: number,
    boss?: BossEntity,
    engine?: GameEngine,
    stageManager?: StageManager
  ): void {
    if (boss) this.boss = boss;
    if (engine) this.engine = engine;
    if (stageManager) this.stageManager = stageManager;

    if (!this.boss) return;

    const currentRatio = this.boss.maxHealth > 0 ? this.boss.health / this.boss.maxHealth : 0;

    for (const crisis of this.registeredCrises) {
      if (!this.triggeredCrises.has(crisis.id) && currentRatio <= crisis.thresholdRatio) {
        this.triggeredCrises.add(crisis.id);
        this.executeCrisis(crisis);
      }
    }
  }

  private executeCrisis(crisis: CrisisEventConfig): void {
    if (!this.boss) return;

    const context: CrisisActionContext = {
      engine: this.engine,
      stageManager: this.stageManager,
      boss: this.boss,
      thresholdRatio: crisis.thresholdRatio,
    };

    // 1. Execute crisis action
    crisis.action(context);

    // 2. Broadcast crisis event across engine
    const payload: CrisisEventPayload = {
      id: crisis.id,
      name: crisis.name,
      bossId: (this.boss as any).id ?? 'boss',
      thresholdRatio: crisis.thresholdRatio,
      severity: crisis.severity ?? 'WARNING',
      timestamp: Date.now(),
    };

    this.engine.eventBus.emit('crisis_event_triggered', payload);
  }

  /**
   * Checks if a crisis has triggered, checking both primary ID and aliases.
   */
  public isCrisisTriggered(crisisId: string): boolean {
    if (this.triggeredCrises.has(crisisId)) {
      return true;
    }
    const alias = this.aliasMap.get(crisisId);
    if (alias && this.triggeredCrises.has(alias)) {
      return true;
    }
    return false;
  }

  public getTriggeredCrises(): string[] {
    return Array.from(this.triggeredCrises);
  }

  public reset(): void {
    this.triggeredCrises.clear();
  }
}
