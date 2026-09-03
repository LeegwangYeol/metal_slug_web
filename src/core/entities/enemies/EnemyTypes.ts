import { Vector2D } from '../../math/Vector2D';
import { AABB } from '../../physics/AABB';
import { GameEntity } from '../../engine/GameEngine';

/**
 * EnemyType identifiers for all infantry and vehicle adversaries.
 */
export type EnemyType =
  | 'SOLDIER_RIFLE'
  | 'SOLDIER_KNIFE'
  | 'SOLDIER_GRENADE'
  | 'SOLDIER_SHIELD'
  | 'MID_BOSS_VEHICLE';

/**
 * Soldier role classification.
 */
export type SoldierRole = 'RIFLE' | 'KNIFE' | 'GRENADE' | 'SHIELD';

/**
 * Damage types supported by the simulation combat engine.
 */
export type DamageSourceType =
  | 'bullet'
  | 'flame'
  | 'fire'
  | 'grenade'
  | 'explosion'
  | 'melee';

/**
 * Varied death animation classifications based on damage source.
 */
export type EnemyDeathType = 'standard' | 'explosion' | 'fire';

/**
 * Minion spawn behavior types for diverse entrance mechanics.
 */
export type SoldierSpawnBehavior = 'INGRESS_WALK' | 'PARACHUTE_DROP' | 'STRUCTURE_AMBUSH';

/**
 * Configuration parameters for airborne parachute descent.
 */
export interface ParachuteConfig {
  descentSpeed?: number;    // Terminal descent velocity (default: 50 px/s, range: 40-60)
  swayAmplitude?: number;   // Horizontal sway amplitude (default: 18 px)
  swayFrequency?: number;   // Angular frequency (default: 3.0 rad/s)
  swayPhase?: number;       // Initial phase offset in radians (default: 0)
  anchorX?: number;         // Equilibrium X coordinate for sinusoidal oscillation
  targetGroundY?: number;   // Ground collision line (default: 230)
}

/**
 * Configuration parameters for trench/structure ambush leap ingress.
 */
export interface AmbushConfig {
  leapVelocityX: number;    // Horizontal leap speed (e.g., -130 px/s)
  leapVelocityY: number;    // Upward launch impulse (e.g., -220 px/s)
  ambushOriginX?: number;
  ambushOriginY?: number;
}

/**
 * Combat damage event structure.
 */
export interface DamageEvent {
  amount: number;
  sourceType: DamageSourceType;
  origin?: Vector2D;
  direction?: Vector2D;
  isWeakPoint?: boolean;
}

/**
 * Enemy casualty event dispatched when health reaches 0.
 * Used by decoupled DeathCorpseManager for authentic visual death simulation.
 */
export interface EnemyDeathEvent {
  id: string;
  type: EnemyType;
  role: SoldierRole;
  position: Vector2D;
  velocity: Vector2D;
  facing: 1 | -1;
  deathType: EnemyDeathType;
  origin?: Vector2D;
}


/**
 * Core interface for enemy entities adhering to the decoupled simulation architecture.
 * Implements GameEntity for seamless spatial partitioning and physics integration.
 */
export interface EnemyEntity extends GameEntity {
  id: string;
  type: EnemyType;
  position: Vector2D;
  velocity: Vector2D;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isMeleeVulnerable: boolean;
  boundingBox: AABB; // Matches PROJECT.md contract
  bounds: AABB;      // Matches GameEntity contract (bounds === boundingBox)
  facing: 1 | -1;    // 1 = facing right, -1 = facing left
  state: string;

  takeDamage(amount: number, sourceType?: DamageSourceType, origin?: Vector2D): boolean;
}

/**
 * Target representation passed to enemy AI logic for line of sight, aiming, and tracking.
 */
export interface TargetPlayer {
  position: Vector2D;
  velocity?: Vector2D;
  bounds?: AABB;
  isCrouching?: boolean;
  isAlive?: boolean;
}
