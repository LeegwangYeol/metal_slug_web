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
export type DamageSourceType = 'bullet' | 'flame' | 'grenade' | 'melee';

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
