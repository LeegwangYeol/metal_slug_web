import { GameEntity } from '../../engine/GameEngine';

export type AllyState =
  | 'SPAWN_SALUTE'
  | 'IDLE'
  | 'FOLLOW'
  | 'ACQUIRE_TARGET'
  | 'CHARGE_ATTACK'
  | 'FIRE_ATTACK'
  | 'RECOVERY'
  | 'CELEBRATE';

export interface AllyConfig {
  followOffset: number;
  walkSpeed: number;
  sprintSpeed: number;
  sprintDistanceThreshold: number;
  stopDistanceThreshold: number;
  jumpVelocity: number;
  gravity: number;
  visionRadius: number;
  chargeDuration: number;
  attackCooldown: number;
  kiDamage: number;
  kiSpeed: number;
  kiLifeTime: number;
  spawnSaluteDuration: number;
}

export const DEFAULT_ALLY_CONFIG: AllyConfig = {
  followOffset: 45.0,
  walkSpeed: 115.0,
  sprintSpeed: 165.0,
  sprintDistanceThreshold: 90.0,
  stopDistanceThreshold: 12.0,
  jumpVelocity: -350.0,
  gravity: 980.0,
  visionRadius: 380.0,
  chargeDuration: 0.35,
  attackCooldown: 1.2,
  kiDamage: 3.5,
  kiSpeed: 520.0,
  kiLifeTime: 1.2,
  spawnSaluteDuration: 0.5,
};

export interface TargetScore {
  target: GameEntity;
  score: number;
  distance: number;
}
