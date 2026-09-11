/**
 * WaveDirector.ts - Escalating Wave Director for Dark Fantasy Horde Survival.
 *
 * Responsibilities:
 * - 4-Phase Timeline Progression (Awakening, Swarm, Nightfall, Abyssal Siege).
 * - Continuous Difficulty Scaling (HP, Speed, Spawn Cadence, Active Cap).
 * - Strict Off-Screen Perimeter Spawning (Zero On-Screen Popping).
 * - Scripted Milestone Tactical Surges (Pincer Rushes, Ring Surrounds, Death Knight Mini-Bosses).
 * - Zero-Garbage Allocation in 60Hz update loop.
 */

import { HordeManager } from '../HordeManager';
import { EnemyType } from '../entities/Enemy';

export enum WavePhaseId {
  AWAKENING = 'AWAKENING',         // 0:00 - 0:30 (0 - 30s)
  THE_SWARM = 'THE_SWARM',         // 0:30 - 1:00 (30 - 60s)
  NIGHTFALL = 'NIGHTFALL',         // 1:00 - 2:00 (60 - 120s)
  ABYSSAL_SIEGE = 'ABYSSAL_SIEGE', // 2:00+ (120s+)
}

export interface WavePhaseConfig {
  id: WavePhaseId;
  name: string;
  startTime: number;
  endTime: number;
  weights: {
    skeleton: number;
    ghoul: number;
    banshee: number;
    death_knight: number;
  };
}

export interface WaveEventNotification {
  id: string;
  name: string;
  description: string;
  timestamp: number;
}

export interface MilestoneEvent {
  id: string;
  triggerTime: number;
  triggered: boolean;
  name: string;
  description: string;
  action: (director: WaveDirector, playerX: number, playerY: number, camX: number, camY: number) => void;
}

export interface WaveDirectorConfig {
  viewportWidth?: number;  // Default 1200 (widened camera FOV)
  viewportHeight?: number; // Default 675
  spawnMargin?: number;    // Default 90 px outside viewport
  arenaBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  onWaveEvent?: (event: WaveEventNotification) => void;
}

export const WAVE_PHASE_CONFIGS: readonly WavePhaseConfig[] = [
  {
    id: WavePhaseId.AWAKENING,
    name: 'The Awakening',
    startTime: 0,
    endTime: 30,
    weights: { skeleton: 1.0, ghoul: 0.0, banshee: 0.0, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.THE_SWARM,
    name: 'The Swarm',
    startTime: 30,
    endTime: 60,
    weights: { skeleton: 0.65, ghoul: 0.35, banshee: 0.0, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.NIGHTFALL,
    name: 'Nightfall',
    startTime: 60,
    endTime: 120,
    weights: { skeleton: 0.45, ghoul: 0.35, banshee: 0.20, death_knight: 0.0 },
  },
  {
    id: WavePhaseId.ABYSSAL_SIEGE,
    name: 'Abyssal Siege',
    startTime: 120,
    endTime: Infinity,
    weights: { skeleton: 0.35, ghoul: 0.35, banshee: 0.25, death_knight: 0.05 },
  },
];

export class WaveDirector {
  public readonly hordeManager: HordeManager;
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;
  public readonly spawnMargin: number;
  public readonly arenaBounds: { minX: number; maxX: number; minY: number; maxY: number };
  public readonly onWaveEvent?: (event: WaveEventNotification) => void;

  public elapsedTime: number = 0;
  private spawnTimer: number = 0;

  // Pre-allocated milestones
  private milestones: MilestoneEvent[];
  private lastPeriodicBossMinute: number = 2;

  // Pre-allocated scratch buffers for zero-allocation
  private readonly scratchPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(hordeManager: HordeManager, config: WaveDirectorConfig = {}) {
    this.hordeManager = hordeManager;
    this.viewportWidth = config.viewportWidth ?? 1200;
    this.viewportHeight = config.viewportHeight ?? 675;
    this.spawnMargin = config.spawnMargin ?? 90;
    this.arenaBounds = config.arenaBounds ?? {
      minX: -2000,
      maxX: 2000,
      minY: -2000,
      maxY: 2000,
    };
    this.onWaveEvent = config.onWaveEvent;

    this.milestones = this.initializeMilestones();
  }

  private initializeMilestones(): MilestoneEvent[] {
    return [
      {
        id: 'pincer_30',
        triggerTime: 30,
        triggered: false,
        name: 'Pincer Rush',
        description: 'Undead ambush flanks from East and West!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnPincerRush(camX, camY, 10, 'ghoul', 'skeleton');
        },
      },
      {
        id: 'ring_60',
        triggerTime: 60,
        triggered: false,
        name: 'Nightfall Convergence',
        description: 'A dark ring of spirits converges upon you!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnRingSurround(camX, camY, 45);
        },
      },
      {
        id: 'quad_90',
        triggerTime: 90,
        triggered: false,
        name: 'Cross of Bones',
        description: 'Hordes emerge from all four directions!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnQuadFlank(camX, camY, 8);
        },
      },
      {
        id: 'boss_120',
        triggerTime: 120,
        triggered: false,
        name: 'Death Knight Awakens',
        description: 'An imposing armored Death Knight commands the siege!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 1);
        },
      },
      {
        id: 'boss_180',
        triggerTime: 180,
        triggered: false,
        name: 'Twin Harbingers',
        description: 'Two Death Knights join the onslaught!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 2);
        },
      },
      {
        id: 'boss_240',
        triggerTime: 240,
        triggered: false,
        name: 'The Death March',
        description: 'Three Death Knights lead the final assault!',
        action: (director, _px, _py, camX, camY) => {
          director.spawnDeathKnightMiniBoss(camX, camY, 3);
        },
      },
    ];
  }

  public getCurrentPhase(time: number = this.elapsedTime): WavePhaseConfig {
    for (let i = 0; i < WAVE_PHASE_CONFIGS.length; i++) {
      const cfg = WAVE_PHASE_CONFIGS[i];
      if (time >= cfg.startTime && time < cfg.endTime) {
        return cfg;
      }
    }
    return WAVE_PHASE_CONFIGS[WAVE_PHASE_CONFIGS.length - 1];
  }

  public getHPMultiplier(time: number = this.elapsedTime): number {
    return 1.0 + (time / 60) * 0.30;
  }

  public getSpeedMultiplier(time: number = this.elapsedTime): number {
    return Math.min(1.40, 1.0 + (time / 120) * 0.15);
  }

  public getSpawnInterval(time: number = this.elapsedTime): number {
    return Math.max(0.50, 2.20 - (time / 60) * 0.55);
  }

  public getClusterSize(time: number = this.elapsedTime): number {
    return Math.min(30, 4 + Math.floor(time / 8));
  }

  public getMaxActiveCap(time: number = this.elapsedTime): number {
    return Math.min(1200, 150 + Math.floor(time / 10) * 80);
  }

  public selectEnemyType(time: number = this.elapsedTime): EnemyType {
    const phase = this.getCurrentPhase(time);
    const r = Math.random();
    const w = phase.weights;

    let cumulative = w.skeleton;
    if (r < cumulative) return 'skeleton';

    cumulative += w.ghoul;
    if (r < cumulative) return 'ghoul';

    cumulative += w.banshee;
    if (r < cumulative) return 'banshee';

    return 'death_knight';
  }

  /**
   * Generates a coordinate strictly outside the camera viewport.
   * Cardinal quadrant pick: 0=North, 1=South, 2=West, 3=East.
   */
  public getPerimeterPoint(
    camX: number,
    camY: number,
    outPoint: { x: number; y: number } = this.scratchPos
  ): { x: number; y: number } {
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const m = this.spawnMargin;

    // Detect which cardinal edges are valid:
    // An edge is valid if its perimeter region lies outside camera viewport AND inside arena bounds.
    const validEdges: number[] = [];
    if (camY - 20 >= this.arenaBounds.minY + 20) validEdges.push(0); // North: space above camY
    if (camY + h + 20 <= this.arenaBounds.maxY - 20) validEdges.push(1); // South: space below camY + h
    if (camX - 20 >= this.arenaBounds.minX + 20) validEdges.push(2); // West: space left of camX
    if (camX + w + 20 <= this.arenaBounds.maxX - 20) validEdges.push(3); // East: space right of camX + w

    const edgeList = validEdges.length > 0 ? validEdges : [0, 1, 2, 3];
    const edge = edgeList[Math.floor(Math.random() * edgeList.length)];

    let x = 0;
    let y = 0;

    switch (edge) {
      case 0: // North
        x = camX - 60 + Math.random() * (w + 120);
        y = camY - m - Math.random() * 60;
        outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(this.arenaBounds.maxX - 20, x));
        outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(camY - 10, y));
        break;
      case 1: // South
        x = camX - 60 + Math.random() * (w + 120);
        y = camY + h + m + Math.random() * 60;
        outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(this.arenaBounds.maxX - 20, x));
        outPoint.y = Math.max(camY + h + 10, Math.min(this.arenaBounds.maxY - 20, y));
        break;
      case 2: // West
        x = camX - m - Math.random() * 60;
        y = camY - 60 + Math.random() * (h + 120);
        outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(camX - 10, x));
        outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(this.arenaBounds.maxY - 20, y));
        break;
      case 3: // East
      default:
        x = camX + w + m + Math.random() * 60;
        y = camY - 60 + Math.random() * (h + 120);
        outPoint.x = Math.max(camX + w + 10, Math.min(this.arenaBounds.maxX - 20, x));
        outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(this.arenaBounds.maxY - 20, y));
        break;
    }

    return outPoint;
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    camX: number,
    camY: number
  ): void {
    this.elapsedTime += dt;
    this.spawnTimer += dt;

    // 1. Check Scripted Milestone Events
    for (let i = 0; i < this.milestones.length; i++) {
      const ms = this.milestones[i];
      if (!ms.triggered && this.elapsedTime >= ms.triggerTime) {
        ms.triggered = true;
        ms.action(this, playerX, playerY, camX, camY);
        if (this.onWaveEvent) {
          this.onWaveEvent({
            id: ms.id,
            name: ms.name,
            description: ms.description,
            timestamp: ms.triggerTime,
          });
        }
      }
    }

    // 2. Periodic Boss Scaling (> 240s, every 60s)
    const currentMinute = Math.floor(this.elapsedTime / 60);
    if (currentMinute > 4 && currentMinute > this.lastPeriodicBossMinute) {
      this.lastPeriodicBossMinute = currentMinute;
      const count = Math.min(5, currentMinute - 1);
      this.spawnDeathKnightMiniBoss(camX, camY, count);
      if (this.onWaveEvent) {
        this.onWaveEvent({
          id: `periodic_boss_${currentMinute}`,
          name: 'Abyssal Incursion',
          description: `${count} Death Knights emerge from the void!`,
          timestamp: this.elapsedTime,
        });
      }
    }

    // 3. Ambient Continuous Cluster Spawning
    const interval = this.getSpawnInterval(this.elapsedTime);
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;

      const currentCap = this.getMaxActiveCap(this.elapsedTime);
      if (this.hordeManager.getActiveCount() < currentCap) {
        this.spawnAmbientCluster(camX, camY);
      }
    }
  }

  private spawnAmbientCluster(camX: number, camY: number): void {
    const clusterSize = this.getClusterSize(this.elapsedTime);
    const hpMult = this.getHPMultiplier(this.elapsedTime);
    const speedMult = this.getSpeedMultiplier(this.elapsedTime);

    const center = this.getPerimeterPoint(camX, camY);

    for (let i = 0; i < clusterSize; i++) {
      const type = this.selectEnemyType(this.elapsedTime);
      const jx = center.x + (Math.random() - 0.5) * 60;
      const jy = center.y + (Math.random() - 0.5) * 60;
      this.hordeManager.spawn(type, jx, jy, hpMult, speedMult);
    }
  }

  public spawnPincerRush(
    camX: number,
    camY: number,
    countPerSide: number,
    vanguardType: EnemyType = 'ghoul',
    rearType: EnemyType = 'skeleton'
  ): void {
    const m = this.spawnMargin;
    const h = this.viewportHeight;
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    // Left flank
    const leftX = camX - m - 40;
    const leftY = camY + h / 2;
    // Right flank
    const rightX = camX + this.viewportWidth + m + 40;
    const rightY = camY + h / 2;

    for (let i = 0; i < countPerSide; i++) {
      const type = i < countPerSide / 2 ? vanguardType : rearType;
      const offset = (i - countPerSide / 2) * 25;
      this.hordeManager.spawn(type, leftX, leftY + offset, hpMult, speedMult);
      this.hordeManager.spawn(type, rightX, rightY + offset, hpMult, speedMult);
    }
  }

  public spawnRingSurround(camX: number, camY: number, count: number): void {
    const centerX = camX + this.viewportWidth / 2;
    const centerY = camY + this.viewportHeight / 2;
    // Scaled from 670 to 800px to strictly lie outside the widened 1200x675 viewport (hypot(600, 337.5) = 688.4px)
    const radius = Math.max(800, Math.hypot(this.viewportWidth / 2, this.viewportHeight / 2) + 110);
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const type = i % 3 === 0 ? 'banshee' : i % 2 === 0 ? 'ghoul' : 'skeleton';
      this.hordeManager.spawn(type, x, y, hpMult, speedMult);
    }
  }

  public spawnQuadFlank(camX: number, camY: number, countPerSide: number): void {
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const m = this.spawnMargin + 30;
    const hpMult = this.getHPMultiplier();
    const speedMult = this.getSpeedMultiplier();

    const origins = [
      { x: camX + w / 2, y: camY - m },             // North
      { x: camX + w / 2, y: camY + h + m },         // South
      { x: camX - m, y: camY + h / 2 },             // West
      { x: camX + w + m, y: camY + h / 2 },         // East
    ];

    for (const origin of origins) {
      for (let i = 0; i < countPerSide; i++) {
        const type = this.selectEnemyType();
        const jx = origin.x + (Math.random() - 0.5) * 50;
        const jy = origin.y + (Math.random() - 0.5) * 50;
        this.hordeManager.spawn(type, jx, jy, hpMult, speedMult);
      }
    }
  }

  public spawnDeathKnightMiniBoss(camX: number, camY: number, bossCount: number = 1): void {
    const hpMult = this.getHPMultiplier() * 1.5; // Extra durability for boss
    const speedMult = this.getSpeedMultiplier();

    for (let b = 0; b < bossCount; b++) {
      const pt = this.getPerimeterPoint(camX, camY);
      this.hordeManager.spawn('death_knight', pt.x, pt.y, hpMult, speedMult);

      // Escort vanguard (10 ghouls/banshees)
      for (let e = 0; e < 10; e++) {
        const escortType = e % 2 === 0 ? 'banshee' : 'ghoul';
        this.hordeManager.spawn(
          escortType,
          pt.x + (Math.random() - 0.5) * 80,
          pt.y + (Math.random() - 0.5) * 80,
          hpMult * 0.8,
          speedMult
        );
      }
    }
  }

  public reset(): void {
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.lastPeriodicBossMinute = 2;
    for (let i = 0; i < this.milestones.length; i++) {
      this.milestones[i].triggered = false;
    }
  }
}
