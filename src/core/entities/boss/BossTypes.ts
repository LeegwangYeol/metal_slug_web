import { Vector2D } from '../../math/Vector2D';
import { AABB } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { CameraBounds } from '../../engine/StageManager';

/**
 * Multi-phase state machine states for Stage 1 End-Boss: Tetsuyuki War Fortress.
 */
export type BossPhase =
  | 'PHASE_1_ARTILLERY'
  | 'PHASE_2_LASER_SWEEP'
  | 'PHASE_3_MELTDOWN'
  | 'DEATH_EXPLODING'
  | 'DESTROYED';

/**
 * Multi-phase state machine states for Heavy Armored Dreadnought: Iron Nokana.
 */
export type IronNokanaPhase =
  | 'PHASE_1_CRAWLER_BARRAGE'
  | 'PHASE_2_FLAME_SWEEP'
  | 'PHASE_3_GIRIDA_DEPLOY'
  | 'PHASE_4_OVERDRIVE_RAGE'
  | 'DEATH_EXPLODING'
  | 'DESTROYED';

/**
 * Core interface contract for boss entities as specified in PROJECT.md.
 */
export interface BossEntity {
  health: number;
  maxHealth: number;
  phase: BossPhase | IronNokanaPhase | string;
  position: Vector2D;
  turretsAlive: number;
  weakPointExposed: boolean;
  weakPointBox: AABB;
  isAlive: boolean;
  isRaging?: boolean;
  rageSpeedMultiplier?: number;
  takeDamage(amount: number, isWeakPoint?: boolean): void;
  update(dt: number, engine?: GameEngine): void;
}

/**
 * Extended boss contract incorporating GameEntity capabilities.
 */
export interface GameBossEntity extends BossEntity, GameEntity {
  update(dt: number, engine: GameEngine): void;
}

/**
 * Crisis severity tiers.
 */
export type CrisisSeverity = 'WARNING' | 'CRITICAL' | 'OVERDRIVE';

/**
 * Crisis Action Execution Context.
 */
export interface CrisisActionContext {
  engine: GameEngine;
  stageManager?: any;
  boss: BossEntity;
  thresholdRatio: number;
}

/**
 * Crisis Event Configuration.
 */
export interface CrisisEventConfig {
  id: string;
  thresholdRatio: number; // e.g. 0.75, 0.50, 0.25
  name: string;
  description: string;
  severity?: CrisisSeverity;
  action: (context: CrisisActionContext) => void;
}

/**
 * Payload broadcast when a crisis event fires.
 */
export interface CrisisEventPayload {
  id: string;
  name: string;
  bossId: string;
  thresholdRatio: number;
  severity?: CrisisSeverity;
  timestamp: number;
}

/**
 * Payload broadcast when a platform collapses.
 */
export interface PlatformCollapsePayload {
  platformId: string;
  bounds: AABB;
}

/**
 * Payload broadcast when camera bounds change.
 */
export interface CameraBoundsChangePayload {
  previousBounds: CameraBounds;
  currentBounds: CameraBounds;
}

/**
 * Payload broadcast when a hazard spawns.
 */
export interface HazardSpawnPayload {
  id: string;
  type: 'ARTILLERY_SHELL' | 'FALLING_DEBRIS' | 'GROUND_FLAME';
  position: Vector2D;
  blastRadius: number;
  damage: number;
}
