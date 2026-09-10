/**
 * CuteGameTypes.ts
 *
 * Core domain types and interfaces for the novel "Sugar Pop Blossom: Cozy Star Arena"
 * autonomous gameplay reinvention.
 */

export type CuteGameLoopState =
  | 'ARENA_INTRO'
  | 'WAVE_ACTIVE'
  | 'SWEET_FEVER'
  | 'PERK_SELECTION'
  | 'WAVE_CLEARED'
  | 'BOSS_SHOWDOWN'
  | 'GARDEN_PURIFIED';

export type CuteEnemyType =
  | 'MARSHMALLOW_SLIME'
  | 'HONEY_BEE'
  | 'DONUT_ROLLER'
  | 'GUMMY_COLOSSUS'
  | 'GUMMY_CUB';

export type PerkCategory =
  | 'sprinkles'
  | 'orbiters'
  | 'dash'
  | 'pet'
  | 'magnet'
  | 'shield';

export type PerkRarity = 'common' | 'rare' | 'legendary';

export interface SweetPerkCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: PerkRarity;
  category: PerkCategory;
}

export interface RenderBubbleState {
  id: string;
  x: number;
  y: number;
  radius: number;
  trappedType?: string;
  trappedHp?: number;
  isPopping?: boolean;
  popProgress?: number; // 0.0 to 1.0
  swayAngle?: number;
  color?: string;
}

export interface RenderPetState {
  x: number;
  y: number;
  facing: 1 | -1;
  state: 'hover' | 'fetch' | 'zap' | 'cheer';
  actionProgress?: number;
  shieldActive?: boolean;
  targetX?: number;
  targetY?: number;
}

export interface RenderAltarState {
  id: string;
  name: string;
  x: number;
  y: number;
  purificationProgress: number; // 0.0 to 1.0
  isBloomed: boolean;
  bloomPetals?: number;
}

export interface RenderFeverState {
  isActive: boolean;
  meterProgress: number; // 0.0 to 1.0
  remainingTime: number; // in seconds
  multiplier: number;
}

export interface RenderPerkCardState {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: PerkRarity;
  category: PerkCategory;
}

export interface RenderPickupState {
  id: string;
  type: 'candy' | 'star' | 'heart' | 'cake';
  x: number;
  y: number;
  value: number;
  feverCharge: number;
  animFrame?: number;
}

export interface CuteEnemyState {
  id: string;
  type: CuteEnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  maxHealth: number;
  isBubbled: boolean;
  bubbleId?: string;
  animationState: string;
  squashStretch?: number;
  isAlive: boolean;
}

export interface StarShard {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  age: number;
  maxAge: number; // 0.35s
  comboStep: number;
}

export interface HeartBolt {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId?: string;
  age: number;
  maxAge: number;
  damage: number;
}
