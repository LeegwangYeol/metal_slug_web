import { GameEngine } from '../engine/GameEngine';
import { AABB, createAABB, BoundingBox } from '../physics/AABB';
import { PlayerController } from './PlayerController';
import { SoldierEnemy } from '../entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from '../entities/boss/TetsuyukiBoss';
import { IronNokanaBoss } from '../entities/boss/IronNokanaBoss';
import { AllyNPC } from '../entities/allies/AllyNPC';
import { AllyKiBlast } from '../entities/allies/AllyKiBlast';
import { PowEntity } from '../entities/pow/PowEntity';
import type { RenderCinematicFXState } from '../../render/CanvasRenderer';

export type { RenderCinematicFXState };

export enum UltimatePhase {
  IDLE = 'IDLE',
  READY = 'IDLE',
  FREEZE = 'FREEZE',
  STRIKE_PASS = 'STRIKE_PASS',
  DETONATION = 'DETONATION',
  RECOVERY = 'RECOVERY',
}

export interface UltimateConfig {
  initialStock?: number;
  maxStock?: number;
  freezeDuration?: number;     // default 0.5s
  strikeDuration?: number;     // default 0.6s
  strikePassDuration?: number; // alias for strikeDuration
  detonationDuration?: number; // default 0.4s
  recoveryDuration?: number;   // default 0.3s
  bossDamage?: number;         // default 120.0
}

export interface DetonationResult {
  minionsCleared: number;
  bossesHit: number;
  bossDamageDealt: number;
  culledProjectiles: number;
}

/**
 * UltimateManager - Coordinates the 4-phase cinematic screen-clearing Ultimate Move.
 *
 * Phase Progression:
 * 1. FREEZE (0.5s): Time dilation / freeze, air-raid siren sound effect.
 * 2. STRIKE_PASS (0.6-0.8s): Tactical bomber cross-screen flyover.
 * 3. DETONATION (0.4-0.5s): Screen flash, heavy camera shake, 100% minion elimination, 120 HP boss damage.
 * 4. RECOVERY (0.3s): Effects dissipate, simulation unfreezes.
 * -> IDLE / READY.
 */
export class UltimateManager {
  public phase: UltimatePhase = UltimatePhase.IDLE;
  public phaseTimer: number = 0;
  public totalTime: number = 0;
  public stock: number = 1;
  public maxStock: number = 3;

  public readonly freezeDuration: number;
  public readonly strikeDuration: number;
  public readonly detonationDuration: number;
  public readonly recoveryDuration: number;
  public readonly bossDamage: number;

  public flyoverProgress: number = 0; // 0.0 to 1.0
  public strikePassX: number = 0;
  public strikePassY: number = 45;
  public detonationExecuted: boolean = false;
  public lastResult: DetonationResult | null = null;
  public isSimulationFrozen: boolean = false;
  public lastCamX: number = 0;

  constructor(config: UltimateConfig = {}) {
    this.stock = config.initialStock ?? 1;
    this.maxStock = config.maxStock ?? 3;
    this.freezeDuration = config.freezeDuration ?? 0.5;
    this.strikeDuration = config.strikeDuration ?? config.strikePassDuration ?? 0.6;
    this.detonationDuration = config.detonationDuration ?? 0.4;
    this.recoveryDuration = config.recoveryDuration ?? 0.3;
    this.bossDamage = config.bossDamage ?? 120.0;
  }

  public get strikePassDuration(): number {
    return this.strikeDuration;
  }

  public get strikePassProgress(): number {
    return this.flyoverProgress;
  }

  public set strikePassProgress(value: number) {
    this.flyoverProgress = value;
  }

  public get isActive(): boolean {
    return this.phase !== UltimatePhase.IDLE;
  }

  public get cameraShakeOffset(): { x: number; y: number } {
    if (this.phase === UltimatePhase.DETONATION) {
      const progress = Math.min(
        1.0,
        Math.max(0.0, 1.0 - this.phaseTimer / this.detonationDuration)
      );
      const intensity = Math.max(0, 18 * (1.0 - progress));
      return {
        x: Math.sin(this.totalTime * 60) * intensity,
        y: Math.cos(this.totalTime * 50) * intensity,
      };
    }
    return { x: 0, y: 0 };
  }

  public getCinematicState(): RenderCinematicFXState | undefined {
    if (this.phase === UltimatePhase.IDLE) {
      return undefined;
    }

    const state: RenderCinematicFXState = {};

    switch (this.phase) {
      case UltimatePhase.FREEZE: {
        const pulse = Math.sin(this.phaseTimer * 12) * 0.15 + 0.15;
        state.screenFlashAlpha = pulse;
        state.screenFlashColor = 'rgba(255, 220, 100, 0.2)';
        break;
      }

      case UltimatePhase.STRIKE_PASS: {
        state.bomber = {
          x: this.strikePassX,
          y: this.strikePassY,
          shadowY: 226,
          progress: this.flyoverProgress,
          dropBombs: this.flyoverProgress > 0.25 && this.flyoverProgress < 0.85,
        };
        state.cameraShake = {
          intensity: 2,
        };
        break;
      }

      case UltimatePhase.DETONATION: {
        const progress = Math.min(
          1.0,
          Math.max(0.0, 1.0 - this.phaseTimer / this.detonationDuration)
        );
        state.screenFlashAlpha = Math.max(0, 1.0 - progress);
        state.screenFlashColor = progress < 0.3 ? '#ffffff' : 'rgba(255, 140, 20, 0.7)';
        state.cameraShake = {
          intensity: Math.max(0, 18 * (1.0 - progress)),
        };
        state.shockwaves = [
          {
            x: this.lastCamX + 240,
            y: 135,
            radius: progress * 280,
            alpha: Math.max(0, 1.0 - progress),
            color: '#ff9900',
          },
          {
            x: this.lastCamX + 240,
            y: 135,
            radius: progress * 180,
            alpha: Math.max(0, 1.0 - progress * 0.8),
            color: '#ffffff',
          },
        ];
        break;
      }

      case UltimatePhase.RECOVERY: {
        const progress = Math.min(
          1.0,
          Math.max(0.0, 1.0 - this.phaseTimer / this.recoveryDuration)
        );
        state.screenFlashAlpha = Math.max(0, (1.0 - progress) * 0.25);
        state.screenFlashColor = 'rgba(255, 160, 40, 0.3)';
        state.cameraShake = {
          intensity: Math.max(0, 4 * (1.0 - progress)),
        };
        break;
      }
    }

    return state;
  }

  public canTrigger(): boolean {
    return !this.isActive && this.stock > 0;
  }

  public addStock(amount: number = 1): void {
    this.stock = Math.min(this.maxStock, this.stock + Math.max(0, amount));
  }

  public trigger(engine: GameEngine, _player?: PlayerController): boolean {
    if (!this.canTrigger()) {
      return false;
    }

    this.stock--;
    this.phase = UltimatePhase.FREEZE;
    this.phaseTimer = this.freezeDuration;
    this.totalTime = 0;
    this.flyoverProgress = 0;
    this.detonationExecuted = false;
    this.lastResult = null;
    this.isSimulationFrozen = true;

    // Dispatch freeze events & air-raid siren SFX
    engine.eventBus.emit('ultimate_freeze_started', { duration: this.freezeDuration });
    engine.eventBus.emit('ultimate_freeze_start', { duration: this.freezeDuration });
    engine.eventBus.emit('play_sound', { sound: 'sfx_air_raid_siren' });
    engine.eventBus.emit('play_sound', { sound: 'sfx_ultimate_siren' });

    return true;
  }

  public update(
    dt: number,
    engine: GameEngine,
    viewportOrCam?: number | AABB | { x: number; y: number; width: number; height: number }
  ): void {
    if (this.phase === UltimatePhase.IDLE) return;

    this.totalTime += dt;
    this.phaseTimer -= dt;

    let camX = 0;
    let explicitViewport: AABB | undefined;

    if (typeof viewportOrCam === 'number') {
      camX = viewportOrCam;
    } else if (viewportOrCam && typeof viewportOrCam === 'object') {
      camX = viewportOrCam.x ?? 0;
      explicitViewport = createAABB(
        viewportOrCam.x,
        viewportOrCam.y,
        viewportOrCam.width,
        viewportOrCam.height
      );
    } else {
      camX = (engine as any).cameraX ?? 0;
    }
    this.lastCamX = camX;

    switch (this.phase) {
      case UltimatePhase.FREEZE: {
        this.isSimulationFrozen = true;
        if (this.phaseTimer <= 0.0001) {
          this.phase = UltimatePhase.STRIKE_PASS;
          this.phaseTimer = this.strikeDuration;
          engine.eventBus.emit('ultimate_strike_pass', { type: 'HEAVY_BOMBER' });
          engine.eventBus.emit('ultimate_strike_pass_start', { type: 'HEAVY_BOMBER' });
          engine.eventBus.emit('play_sound', { sound: 'sfx_bomber_flyover' });
          engine.eventBus.emit('play_sound', { sound: 'sfx_flyover_roar' });
        }
        break;
      }

      case UltimatePhase.STRIKE_PASS: {
        const progress = Math.min(
          1.0,
          Math.max(0.0, 1.0 - this.phaseTimer / this.strikeDuration)
        );
        this.flyoverProgress = progress;
        this.strikePassX = camX - 100 + progress * (480 + 200);
        this.strikePassY = 45;

        if (this.phaseTimer <= 0.0001) {
          this.phase = UltimatePhase.DETONATION;
          this.phaseTimer = this.detonationDuration;
          this.executeDetonation(engine, camX, explicitViewport);
        }
        break;
      }

      case UltimatePhase.DETONATION: {
        if (this.phaseTimer <= 0.0001) {
          this.phase = UltimatePhase.RECOVERY;
          this.phaseTimer = this.recoveryDuration;
          engine.eventBus.emit('ultimate_unfreeze', { duration: this.recoveryDuration });
        }
        break;
      }

      case UltimatePhase.RECOVERY: {
        if (this.phaseTimer <= 0.0001) {
          this.phase = UltimatePhase.IDLE;
          this.isSimulationFrozen = false;
          this.detonationExecuted = false;
          engine.eventBus.emit('ultimate_completed', this.lastResult);
        }
        break;
      }
    }
  }

  public executeDetonation(
    engine: GameEngine,
    cameraX?: number,
    explicitViewport?: AABB
  ): DetonationResult {
    const camX = cameraX ?? (engine as any).cameraX ?? this.lastCamX ?? 0;
    this.lastCamX = camX;
    const viewport = explicitViewport ?? createAABB(camX, 0, 480, 270);

    let minionsCleared = 0;
    let bossesHit = 0;
    let bossDamageDealt = 0;
    let culledProjectiles = 0;

    const entities = engine.getAllEntities();
    if (Array.isArray((engine as any).entitiesToAdd)) {
      for (const ent of (engine as any).entitiesToAdd) {
        if (!entities.some((e) => e.id === ent.id)) {
          entities.push(ent);
        }
      }
    }

    for (const ent of entities) {
      if (!ent.isAlive) continue;

      // 1. Zero Friendly Fire: Player, Ally NPCs, Ki Blasts, and POWs are completely immune
      if (
        ent.id === 'player' ||
        ent.type === 'PLAYER' ||
        ent instanceof PlayerController ||
        ent.type === 'ALLY_NPC' ||
        ent.type === 'ALLY_PROJECTILE' ||
        ent instanceof AllyNPC ||
        ent instanceof AllyKiBlast ||
        ent.type === 'POW' ||
        ent instanceof PowEntity ||
        ent.type === 'ITEM_PICKUP'
      ) {
        continue;
      }

      // 2. Viewport Geometry: Strictly preserve entities outside the active viewport bounding box
      if (!BoundingBox.intersects(ent.bounds, viewport)) {
        continue;
      }

      // 3. Clear Hostile Projectiles & Grenades
      if (
        ent.type === 'ENEMY_BULLET' ||
        ent.type === 'ENEMY_GRENADE' ||
        ent.type === 'CANNON_SHELL' ||
        ent.type === 'ARTILLERY_SHELL' ||
        ent.type === 'HOMING_MISSILE'
      ) {
        ent.isAlive = false;
        engine.removeEntity(ent.id);
        if ((engine as any).entities instanceof Map) {
          (engine as any).entities.delete(ent.id);
        }
        if (Array.isArray((engine as any).entitiesToAdd)) {
          const idx = (engine as any).entitiesToAdd.findIndex((e: any) => e.id === ent.id);
          if (idx !== -1) {
            (engine as any).entitiesToAdd.splice(idx, 1);
          }
        }
        culledProjectiles++;
        continue;
      }

      // 4. Boss & Mid-Boss Burst Damage (120 HP)
      const isBoss =
        ent instanceof IronNokanaBoss ||
        ent instanceof TetsuyukiBoss ||
        ent instanceof MidBossVehicle ||
        ent.type === 'MID_BOSS_VEHICLE' ||
        ent.type.includes('BOSS');

      if (isBoss) {
        if (ent.type === 'MID_BOSS_VEHICLE' || ent instanceof MidBossVehicle) {
          (ent as any).takeDamage(this.bossDamage, 'explosion');
        } else if (typeof (ent as any).takeDamage === 'function') {
          (ent as any).takeDamage(this.bossDamage, false);
        } else if ((ent as any).health !== undefined) {
          (ent as any).health = Math.max(0, (ent as any).health - this.bossDamage);
        }
        bossesHit++;
        bossDamageDealt += this.bossDamage;
        continue;
      }

      // 5. Standard Minions: 100% Lethal Screen Clearing (999 explosion damage)
      const isMinion =
        ent instanceof SoldierEnemy ||
        ent.type.startsWith('SOLDIER_') ||
        ent.type === 'minion' ||
        ent.type === 'enemy' ||
        ent.type.startsWith('REBEL_');

      if (isMinion) {
        if (typeof (ent as any).takeDamage === 'function') {
          (ent as any).takeDamage(999, 'explosion');
        }
        ent.isAlive = false;
        if ((ent as any).health !== undefined) {
          (ent as any).health = 0;
        }
        minionsCleared++;
      }
    }

    this.detonationExecuted = true;
    this.lastResult = { minionsCleared, bossesHit, bossDamageDealt, culledProjectiles };

    // Emit cinematic detonation events, screen shake, and cataclysmic explosion SFX
    engine.eventBus.emit('ultimate_detonation_start', this.lastResult);
    engine.eventBus.emit('ultimate_detonation', this.lastResult);
    engine.eventBus.emit('camera_shake', { intensity: 18, duration: 0.6 });
    engine.eventBus.emit('screen_shake', { amplitude: 18, durationFrames: 24, duration: 0.6 });
    engine.eventBus.emit('play_sound', { sound: 'sfx_heavy_detonation' });
    engine.eventBus.emit('play_sound', { sound: 'sfx_apocalyptic_blast' });

    return this.lastResult;
  }
}
