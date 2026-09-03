import { Vector2D, vec2 } from '../math/Vector2D';
import { GameEngine } from '../engine/GameEngine';
import { WeaponType, WeaponState, WEAPON_CONFIGS, ItemDropType } from './WeaponTypes';
import { ProjectileManager, BulletProjectile } from './ProjectileManager';
import { FacingDirection } from '../player/PlayerKinematics';

export class WeaponManager {
  static readonly HMG_SWEEP_ANGULAR_VELOCITY: number = 12.0; // rad/s (~687.5 deg/s)
  static readonly HMG_SPRAY_JITTER_RADIANS: number = 0.043633; // +/- 2.5 degrees

  private activeWeapon: WeaponType = 'PISTOL';
  private ammoPool: Record<WeaponType, number> = {
    PISTOL: Infinity,
    HEAVY_MACHINE_GUN: 0,
    FLAME_SHOT: 0,
  };
  private grenadeCount: number = 10;
  private cooldownTimer: number = 0; // seconds remaining

  // HMG dynamic angular sweep tracking
  private currentFiringAngle: number = 0; // radians
  private hasInitializedAngle: boolean = false;

  public readonly projectileManager: ProjectileManager;

  constructor(projectileManager?: ProjectileManager) {
    this.projectileManager = projectileManager ?? new ProjectileManager();
  }

  getActiveWeapon(): WeaponType {
    return this.activeWeapon;
  }

  getAmmo(type?: WeaponType): number {
    return this.ammoPool[type ?? this.activeWeapon];
  }

  getGrenadeCount(): number {
    return this.grenadeCount;
  }

  setGrenadeCount(count: number): void {
    this.grenadeCount = Math.max(0, Math.min(99, count));
  }

  consumeGrenade(): boolean {
    if (this.grenadeCount > 0) {
      this.grenadeCount--;
      return true;
    }
    return false;
  }

  getWeaponState(): WeaponState {
    const config = WEAPON_CONFIGS[this.activeWeapon];
    return {
      type: this.activeWeapon,
      ammo: this.ammoPool[this.activeWeapon],
      maxAmmo: config.maxAmmo,
      fireRate: 60 / config.fireCooldownFrames,
      cooldownRemaining: this.cooldownTimer,
      isAutomatic: config.isAutomatic,
    };
  }

  update(dt: number, engine: GameEngine): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }
    this.projectileManager.update(dt, engine);
  }

  /**
   * Attempts to fire the current active weapon.
   * Handles cooldown, HMG angular sweeping & jitter, projectile spawning,
   * ammo decrement, and automatic fallback to PISTOL upon depletion.
   */
  tryFire(
    muzzlePos: Vector2D,
    targetAimVec: Vector2D,
    facing: FacingDirection,
    engine: GameEngine,
    isShootPressed: boolean,
    isShootHeld: boolean
  ): BulletProjectile | null {
    const config = WEAPON_CONFIGS[this.activeWeapon];

    // For semi-automatic weapons (PISTOL), require fresh press (isShootPressed)
    if (!config.isAutomatic && !isShootPressed) {
      return null;
    }
    // For automatic weapons, fire if pressed or held
    if (config.isAutomatic && !isShootPressed && !isShootHeld) {
      return null;
    }

    // Check cooldown
    if (this.cooldownTimer > 0) {
      return null;
    }

    // Check ammo
    const currentAmmo = this.ammoPool[this.activeWeapon];
    if (currentAmmo <= 0) {
      this.fallbackToPistol(engine);
      return null;
    }

    const targetAngle = Math.atan2(targetAimVec.y, targetAimVec.x);

    let projectile: BulletProjectile | null = null;

    if (this.activeWeapon === 'PISTOL') {
      projectile = this.projectileManager.spawnPistolBullet(muzzlePos, targetAimVec, engine);
      if (!projectile) {
        // Suppressed by max 4 on-screen bullets limit
        return null;
      }
      this.currentFiringAngle = targetAngle;
      this.hasInitializedAngle = true;
    } else if (this.activeWeapon === 'HEAVY_MACHINE_GUN') {
      // Initialize firing angle on first shot
      if (!this.hasInitializedAngle) {
        this.currentFiringAngle = targetAngle;
        this.hasInitializedAngle = true;
      } else {
        // 12 rad/s smooth angular sweep toward target angle
        const dt = engine.fixedTimestep;
        const maxDelta = WeaponManager.HMG_SWEEP_ANGULAR_VELOCITY * dt;
        let angleDiff = targetAngle - this.currentFiringAngle;

        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        if (Math.abs(angleDiff) <= maxDelta) {
          this.currentFiringAngle = targetAngle;
        } else {
          this.currentFiringAngle += Math.sign(angleDiff) * maxDelta;
        }
      }

      // Add +/- 2.5 degree stochastic dispersion jitter
      const jitter = (Math.random() * 2 - 1) * WeaponManager.HMG_SPRAY_JITTER_RADIANS;
      const sprayAngle = this.currentFiringAngle + jitter;
      const sprayDirection = vec2(Math.cos(sprayAngle), Math.sin(sprayAngle));

      projectile = this.projectileManager.spawnHmgBullet(
        muzzlePos,
        sprayDirection,
        facing,
        engine
      );
    } else if (this.activeWeapon === 'FLAME_SHOT') {
      projectile = this.projectileManager.spawnFlameShot(muzzlePos, targetAimVec, engine);
      this.currentFiringAngle = targetAngle;
      this.hasInitializedAngle = true;
    }

    if (!projectile) {
      return null;
    }

    // Set cooldown timer
    this.cooldownTimer = config.fireCooldownFrames * engine.fixedTimestep;

    // Decrement special weapon ammo
    if (this.activeWeapon !== 'PISTOL') {
      this.ammoPool[this.activeWeapon]--;

      engine.eventBus.emit('ammo_updated', {
        weaponType: this.activeWeapon,
        ammo: this.ammoPool[this.activeWeapon],
      });

      // Automatic fallback to PISTOL when ammo reaches 0
      if (this.ammoPool[this.activeWeapon] <= 0) {
        this.fallbackToPistol(engine);
      }
    }

    // Emit firing sound event
    engine.eventBus.emit('play_sound', { sound: config.soundKey });

    return projectile;
  }

  /**
   * Seamlessly falls back to the infinite handgun when special ammo is depleted.
   */
  private fallbackToPistol(engine: GameEngine): void {
    const prevWeapon = this.activeWeapon;
    this.activeWeapon = 'PISTOL';
    this.hasInitializedAngle = false;

    engine.eventBus.emit('weapon_changed', {
      previousWeapon: prevWeapon,
      currentWeapon: 'PISTOL',
      ammo: Infinity,
    });

    engine.eventBus.emit('play_sound', { sound: 'sfx_weapon_empty' });
  }

  /**
   * Equips a new special weapon or stacks ammo for the same weapon type.
   */
  acquireWeapon(type: WeaponType, ammoBonus?: number, engine?: GameEngine): void {
    const config = WEAPON_CONFIGS[type];
    const bonus = ammoBonus ?? config.initialAmmo;

    if (this.activeWeapon === type) {
      // Same weapon: stack ammo up to max
      this.ammoPool[type] = Math.min(config.maxAmmo, this.ammoPool[type] + bonus);
      engine?.eventBus.emit('ammo_updated', {
        weaponType: type,
        ammo: this.ammoPool[type],
      });
      engine?.eventBus.emit('play_sound', { sound: 'sfx_ammo_pickup' });
    } else {
      // Different weapon: replace active weapon and set ammo
      this.activeWeapon = type;
      this.ammoPool[type] = Math.min(config.maxAmmo, bonus);
      this.cooldownTimer = 0;
      this.hasInitializedAngle = false;

      engine?.eventBus.emit('weapon_changed', {
        currentWeapon: type,
        ammo: this.ammoPool[type],
      });

      // Announcer voice event ("HEAVY MACHINE GUN!", "FLAME SHOT!")
      if (config.announcerKey) {
        engine?.eventBus.emit('play_voice', { voice: config.announcerKey });
      }
      engine?.eventBus.emit('play_sound', { sound: 'sfx_weapon_pickup' });
    }
  }

  /**
   * Applies an item pickup (e.g. from Hostage POW or crate).
   */
  applyItemPickup(dropType: ItemDropType, engine?: GameEngine): void {
    switch (dropType) {
      case ItemDropType.WEAPON_HMG:
        this.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
        break;
      case ItemDropType.WEAPON_FLAME:
        this.acquireWeapon('FLAME_SHOT', 30, engine);
        break;
      case ItemDropType.GRENADE_CRATE:
        this.grenadeCount = Math.min(99, this.grenadeCount + 10);
        engine?.eventBus.emit('play_sound', { sound: 'sfx_grenade_pickup' });
        engine?.eventBus.emit('grenades_updated', { count: this.grenadeCount });
        break;
      case ItemDropType.SCORE_BANANA:
        engine?.eventBus.emit('award_score', { score: 500, label: 'BANANA' });
        engine?.eventBus.emit('play_sound', { sound: 'sfx_item_pickup' });
        break;
      case ItemDropType.SCORE_CHICKEN:
        engine?.eventBus.emit('award_score', { score: 1000, label: 'ROAST CHICKEN' });
        engine?.eventBus.emit('play_sound', { sound: 'sfx_item_pickup' });
        break;
      case ItemDropType.SCORE_COIN:
        engine?.eventBus.emit('award_score', { score: 100, label: 'COIN' });
        engine?.eventBus.emit('play_sound', { sound: 'sfx_item_pickup' });
        break;
      case ItemDropType.SCORE_JEWEL:
        engine?.eventBus.emit('award_score', { score: 3000, label: 'JEWEL' });
        engine?.eventBus.emit('play_sound', { sound: 'sfx_item_pickup' });
        break;
    }
  }

  reset(): void {
    this.activeWeapon = 'PISTOL';
    this.ammoPool = {
      PISTOL: Infinity,
      HEAVY_MACHINE_GUN: 0,
      FLAME_SHOT: 0,
    };
    this.grenadeCount = 10;
    this.cooldownTimer = 0;
    this.hasInitializedAngle = false;
    this.projectileManager.clear();
  }
}
