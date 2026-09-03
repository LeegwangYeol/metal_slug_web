import { Vector2D } from '../../math/Vector2D';
import { AABB } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';

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
 * Core interface contract for boss entities as specified in PROJECT.md.
 */
export interface BossEntity {
  health: number;
  maxHealth: number;
  phase: BossPhase;
  position: Vector2D;
  turretsAlive: number;
  weakPointExposed: boolean;
  weakPointBox: AABB;
  takeDamage(amount: number, isWeakPoint?: boolean): void;
  update(dt: number, engine?: GameEngine): void;
}

/**
 * Extended boss contract incorporating GameEntity capabilities.
 */
export interface GameBossEntity extends BossEntity, GameEntity {
  update(dt: number, engine: GameEngine): void;
}
