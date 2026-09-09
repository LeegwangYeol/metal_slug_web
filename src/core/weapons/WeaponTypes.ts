import { Vector2D } from '../math/Vector2D';
import { AABB } from '../physics/AABB';

export type WeaponType =
  | 'PISTOL'
  | 'HEAVY_MACHINE_GUN'
  | 'FLAME_SHOT'
  | 'SHOTGUN'
  | 'LASER_GUN'
  | 'ROCKET_LAUNCHER';
export const HANDGUN: WeaponType = 'PISTOL';

export interface WeaponState {
  type: WeaponType;
  ammo: number; // Infinity for PISTOL, 200 for HMG, 30 for FLAME_SHOT, etc.
  maxAmmo: number;
  fireRate: number; // shots per second
  cooldownRemaining: number;
  isAutomatic: boolean;
}

export interface WeaponConfig {
  type: WeaponType;
  name: string;
  isAutomatic: boolean;
  fireCooldownFrames: number;
  initialAmmo: number;
  maxAmmo: number;
  projectileSpeed: number;
  projectileDamage: number;
  piercing: boolean;
  soundKey: string;
  announcerKey?: string;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  PISTOL: {
    type: 'PISTOL',
    name: 'Pistol',
    isAutomatic: false,
    fireCooldownFrames: 9, // ~6.67 shots/s at 60Hz
    initialAmmo: Infinity,
    maxAmmo: Infinity,
    projectileSpeed: 660.0, // px/s
    projectileDamage: 1.0,
    piercing: false,
    soundKey: 'sfx_pistol_fire',
  },
  HEAVY_MACHINE_GUN: {
    type: 'HEAVY_MACHINE_GUN',
    name: 'Heavy Machine Gun',
    isAutomatic: true,
    fireCooldownFrames: 4, // 15 shots/s at 60Hz
    initialAmmo: 200,
    maxAmmo: 999,
    projectileSpeed: 780.0, // px/s
    projectileDamage: 1.0,
    piercing: false,
    soundKey: 'sfx_hmg_fire',
    announcerKey: 'voice_heavy_machine_gun',
  },
  FLAME_SHOT: {
    type: 'FLAME_SHOT',
    name: 'Flame Shot',
    isAutomatic: true,
    fireCooldownFrames: 18, // ~3.33 shots/s (every 300ms)
    initialAmmo: 30,
    maxAmmo: 99,
    projectileSpeed: 330.0, // px/s
    projectileDamage: 1.5,
    piercing: true,
    soundKey: 'sfx_flame_fire',
    announcerKey: 'voice_flame_shot',
  },
  SHOTGUN: {
    type: 'SHOTGUN',
    name: 'Shotgun',
    isAutomatic: false,
    fireCooldownFrames: 32, // ~1.875 shots/s at 60Hz
    initialAmmo: 30,
    maxAmmo: 99,
    projectileSpeed: 680.0, // px/s
    projectileDamage: 2.0, // 2.0 per pellet (14.0 point-blank)
    piercing: false,
    soundKey: 'sfx_shotgun_fire',
    announcerKey: 'voice_shotgun',
  },
  LASER_GUN: {
    type: 'LASER_GUN',
    name: 'Laser Gun',
    isAutomatic: true,
    fireCooldownFrames: 4, // 15 shots/s at 60Hz
    initialAmmo: 200,
    maxAmmo: 999,
    projectileSpeed: 1200.0, // px/s continuous beam
    projectileDamage: 1.2, // 1.2 per tick
    piercing: true,
    soundKey: 'sfx_laser_fire',
    announcerKey: 'voice_laser_gun',
  },
  ROCKET_LAUNCHER: {
    type: 'ROCKET_LAUNCHER',
    name: 'Rocket Launcher',
    isAutomatic: false,
    fireCooldownFrames: 24, // 2.5 shots/s at 60Hz
    initialAmmo: 30,
    maxAmmo: 99,
    projectileSpeed: 220.0, // accelerates to 650 px/s
    projectileDamage: 8.0, // max explosive blast damage
    piercing: false,
    soundKey: 'sfx_rocket_fire',
    announcerKey: 'voice_rocket_launcher',
  },
};

export interface BrassCasing {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  isGrounded: boolean;
  lifeFrames: number;
  maxLifeFrames: number;
  rotation: number;
}

export interface GroundFireAOE {
  id: string;
  position: Vector2D;
  bounds: AABB;
  damage: number;
  tickIntervalFrames: number;
  lifeFrames: number;
  maxLifeFrames: number;
  isAlive: boolean;
}

export enum ItemDropType {
  WEAPON_HMG = 'ITEM_WEAPON_HMG',
  WEAPON_FLAME = 'ITEM_WEAPON_FLAME',
  WEAPON_SHOTGUN = 'ITEM_WEAPON_SHOTGUN',
  WEAPON_LASER = 'ITEM_WEAPON_LASER',
  WEAPON_ROCKET = 'ITEM_WEAPON_ROCKET',
  GRENADE_CRATE = 'ITEM_GRENADE_BOX',
  MEDKIT = 'ITEM_MEDKIT',
  SHIELD = 'ITEM_SHIELD',
  SCORE_BANANA = 'ITEM_SCORE_BANANA',
  SCORE_CHICKEN = 'ITEM_SCORE_CHICKEN',
  SCORE_COIN = 'ITEM_SCORE_COIN',
  SCORE_JEWEL = 'ITEM_SCORE_JEWEL',
}

export interface LootTableEntry {
  type: ItemDropType;
  weight: number;
  scoreBonus?: number;
  ammoBonus?: number;
  grenadeBonus?: number;
}

export const POW_LOOT_TABLE: LootTableEntry[] = [
  { type: ItemDropType.WEAPON_HMG, weight: 35, ammoBonus: 200 },
  { type: ItemDropType.WEAPON_FLAME, weight: 25, ammoBonus: 30 },
  { type: ItemDropType.WEAPON_SHOTGUN, weight: 15, ammoBonus: 30 },
  { type: ItemDropType.WEAPON_LASER, weight: 15, ammoBonus: 200 },
  { type: ItemDropType.WEAPON_ROCKET, weight: 15, ammoBonus: 30 },
  { type: ItemDropType.GRENADE_CRATE, weight: 20, grenadeBonus: 10 },
  { type: ItemDropType.MEDKIT, weight: 8 },
  { type: ItemDropType.SHIELD, weight: 5 },
  { type: ItemDropType.SCORE_BANANA, weight: 8, scoreBonus: 500 },
  { type: ItemDropType.SCORE_CHICKEN, weight: 6, scoreBonus: 1000 },
  { type: ItemDropType.SCORE_COIN, weight: 4, scoreBonus: 100 },
  { type: ItemDropType.SCORE_JEWEL, weight: 2, scoreBonus: 3000 },
];
