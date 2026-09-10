/**
 * PlayerTypes.ts - Type and enum definitions for Player subsystem.
 */

export type {
  FacingDirection,
  AimResult,
  PlayerInputSnapshot,
} from './PlayerKinematics';

export {
  PlayerPosture,
  PlayerActionState,
  AimAngle,
} from './PlayerKinematics';

export type { PlayerState } from './PlayerController';
