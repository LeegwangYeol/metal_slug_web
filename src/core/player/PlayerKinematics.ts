/**
 * PlayerKinematics.ts - Input snapshot and kinematic contracts for Player.
 */

export interface PlayerInputSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  shootPressed?: boolean;
  shootHeld?: boolean;
  grenadePressed?: boolean;
  ultimatePressed?: boolean;
  helpPressed?: boolean;
}
