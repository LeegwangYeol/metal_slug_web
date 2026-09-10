/**
 * Full Metal Slug - Main Game Assembly & Bootstrap.
 *
 * Coordinates:
 * - Headless Simulation Engine: GameEngine & StageManager
 * - Player State & Kinematics: PlayerController
 * - Presentation: Camera, ParallaxBackground, CanvasRenderer, HUDOverlay
 * - Audio & Speech: SoundEngine & SpeechSynthesizer
 * - Input: KeyboardController & TouchVirtualPad
 * - Stage 1 Level Assembly: Ground platforms, bridges, bunkers, soldier patrol waves, POWs, Mid-Boss & Boss.
 * - Fixed 60Hz Timestep Accumulator Loop with requestAnimationFrame.
 */

import { GameEngine } from './core/engine/GameEngine';
import { StageManager, StageData, StageState } from './core/engine/StageManager';
import { PlayerController } from './core/player/PlayerController';
import { PlayerActionState, PlayerInputSnapshot } from './core/player/PlayerKinematics';
import { Platform } from './core/physics/Platform';
import { createAABB } from './core/physics/AABB';
import { Camera } from './render/Camera';
import { ParallaxBackground } from './render/ParallaxBackground';
import {
  CanvasRenderer,
  RenderSceneState,
  RenderPlayerState,
  RenderEnemyState,
  RenderBossState,
  RenderPowState,
  RenderProjectileState,
  RenderExplosionState,
  RenderHUDState,
  RenderObstacleState,
} from './render/CanvasRenderer';
import { SoundEngine } from './audio/SoundEngine';
import { KeyboardController } from './input/KeyboardController';
import { TouchVirtualPad } from './input/TouchVirtualPad';
import { HUDOverlay } from './ui/HUDOverlay';
import { SoldierEnemy } from './core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from './core/entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from './core/entities/boss/TetsuyukiBoss';
import { PowEntity, PowState } from './core/entities/pow/PowEntity';
import { DestructibleObstacle } from './core/entities/obstacles/DestructibleObstacle';
import { ItemDropType } from './core/weapons/WeaponTypes';
import { vec2 } from './core/math/Vector2D';
import type { Vector2D } from './core/math/Vector2D';
import { DeathCorpseManager } from './core/entities/enemies/DeathCorpseManager';
import { IronNokanaBoss } from './core/entities/boss/IronNokanaBoss';
import { CrisisEventManager } from './core/entities/boss/CrisisEventManager';
import { AllyNPC } from './core/entities/allies/AllyNPC';
import { AllyManager } from './core/entities/allies/AllyManager';
import { ItemPickupEntity } from './core/entities/items/ItemPickup';
import {
  ArtilleryTargetReticle,
  ArtilleryShellHazard,
  FallingDebrisHazard,
  GroundFlameHazard,
} from './core/entities/boss/EnvironmentalHazard';
import { AllyKiBlast } from './core/entities/allies/AllyKiBlast';

export type { RenderPlayerState, Vector2D };

export interface GameOptions {
  spawnMode?: 'classic' | 'diverse';
  includeObstacles?: boolean;
}

export class FullMetalSlugGame {
  public readonly engine: GameEngine;
  public readonly stageManager: StageManager;
  public readonly corpseManager: DeathCorpseManager;
  public readonly player: PlayerController;
  public readonly camera: Camera;
  public readonly parallax: ParallaxBackground;
  public readonly renderer: CanvasRenderer;
  public readonly soundEngine: SoundEngine;
  public readonly keyboard: KeyboardController;
  public readonly touchPad: TouchVirtualPad;
  public readonly hudOverlay: HUDOverlay;

  private canvas: HTMLCanvasElement | null = null;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  // Fixed 60Hz Physics Accumulator
  public static readonly FIXED_TIMESTEP: number = 1 / 60; // ~0.016667s
  private lastTime: number = 0;
  private accumulator: number = 0;
  private elapsedTime: number = 0;

  // Boss / Warning State
  public bossWarningTimer: number = 0;
  public isStageClear: boolean = false;

  // Dynamic Explosions Tracker
  private activeExplosions: RenderExplosionState[] = [];
  private nextExplosionId: number = 1;

  // Last input snapshot for renderer animation & crosshair state
  private lastInputSnapshot: PlayerInputSnapshot | null = null;

  // On-Screen Tutorial & Controls State (M3)
  public showTutorial: boolean = true;
  public tutorialTimer: number = 5.0; // 5.0s auto-dismiss
  public tutorialAlpha: number = 1.0;

  /**
   * Toggles tutorial placard visibility manually.
   */
  public toggleTutorial(): boolean {
    this.showTutorial = !this.showTutorial;
    this.tutorialAlpha = this.showTutorial ? 1.0 : 0.0;
    if (this.showTutorial) {
      this.tutorialTimer = 999999; // Pin open when manually toggled
    }
    return this.showTutorial;
  }

  constructor(container?: HTMLElement, options: GameOptions = {}) {
    // 1. Simulation Core
    this.engine = new GameEngine();
    this.stageManager = new StageManager(this.engine);
    this.corpseManager = new DeathCorpseManager(this.engine);
    this.player = new PlayerController(vec2(80, 230));
    this.engine.addEntity(this.player);

    // 2. Camera & Rendering
    this.camera = new Camera({
      viewportWidth: CanvasRenderer.VIRTUAL_WIDTH,
      viewportHeight: CanvasRenderer.VIRTUAL_HEIGHT,
      forwardLock: true,
    });
    this.parallax = new ParallaxBackground();
    this.renderer = new CanvasRenderer({
      camera: this.camera,
      parallax: this.parallax,
    });
    this.hudOverlay = this.renderer.hudOverlay;

    // 3. Audio & Voice Engine
    this.soundEngine = new SoundEngine();

    // 4. Input Controllers
    this.keyboard = new KeyboardController();
    this.touchPad = new TouchVirtualPad();

    // 5. Wire Audio & Event Bus
    this.setupAudioAndEventBus();

    // 6. Build Stage 1 Data & Populate
    const stage1Data = this.buildStage1Data(options);
    this.stageManager.loadStage(stage1Data);

    // Pre-place POW hostages statically at stage load time ahead of player
    this.initStaticPows();
    if (options.includeObstacles ?? (options.spawnMode === 'diverse')) {
      this.initStaticObstacles();
    }

    // 7. Mount to DOM if container provided
    if (container) {
      this.mount(container);
    }
  }


  /**
   * Pre-places POW hostages statically at stage load time ahead of the player,
   * securely tied to stage structures (elevated piers, redoubts, bridges, bunkers).
   * Eliminates runtime trigger pop-ins and ensures authentic Metal Slug stage exploration.
   */
  public initStaticPows(): void {
    const staticPows = [
      // POW 1: Tied atop elevated bunker 1 ahead of player spawn (Section 1)
      new PowEntity('pow_1', vec2(320, 175), ItemDropType.WEAPON_HMG),
      // POW 2: Tied on midboss dock platform in Section 1
      new PowEntity('pow_2', vec2(850, 175), ItemDropType.WEAPON_FLAME),
      // POW 3: Tied on elevated wooden bridge 2 in Section 2
      new PowEntity('pow_3', vec2(1450, 165), ItemDropType.GRENADE_CRATE),
      // POW 4: Tied on top of defense bunker 2 before boss arena
      new PowEntity('pow_4', vec2(1710, 175), ItemDropType.WEAPON_HMG),
    ];
    for (const pow of staticPows) {
      this.engine.addEntity(pow);
    }

    // Flush initial additions (player & static POWs) into engine registry so they are immediately accessible
    const eng = this.engine as any;
    if (eng.entitiesToAdd && eng.entitiesToAdd.length > 0) {
      for (const entity of eng.entitiesToAdd) {
        eng.entities.set(entity.id, entity);
        eng.spatialGrid.insert(entity);
      }
      eng.entitiesToAdd = [];
    }
  }

  /**
   * Pre-places tactical destructible cover and hazards statically at stage load time:
   * sandbag barricades, supply crates, and red explosive fuel barrels.
   */
  public initStaticObstacles(): void {
    const staticObstacles = [
      // Zone 1: Beachhead Stilt Docks
      new DestructibleObstacle('sandbag_1', 'SANDBAG_BARRICADE', vec2(260, 216), 28, 14, { health: 15 }),
      new DestructibleObstacle('crate_1', 'SUPPLY_CRATE', vec2(150, 157), 18, 18, { health: 8, dropItem: ItemDropType.WEAPON_HMG }),
      // Zone 2: Dune Redoubt & High Watchtower
      new DestructibleObstacle('sandbag_2', 'SANDBAG_BARRICADE', vec2(630, 208), 28, 14, { health: 20 }),
      new DestructibleObstacle('barrel_1', 'EXPLOSIVE_BARREL', vec2(730, 204), 16, 18, { health: 10, blastRadius: 54, blastDamage: 10 }),
      new DestructibleObstacle('sandbag_3', 'SANDBAG_BARRICADE', vec2(840, 161), 24, 14, { health: 15 }),
      // Zone 3: River Basin & Mid-Boss Arena
      new DestructibleObstacle('sandbag_mb_left', 'SANDBAG_BARRICADE', vec2(1005, 216), 24, 14, { health: 20 }),
      new DestructibleObstacle('sandbag_mb_right', 'SANDBAG_BARRICADE', vec2(1430, 216), 24, 14, { health: 20 }),
      // Zone 4: Trench Gorge & Suspension Bridges
      new DestructibleObstacle('barrel_2', 'EXPLOSIVE_BARREL', vec2(1520, 216), 16, 18, { health: 10, blastRadius: 54, blastDamage: 10 }),
      new DestructibleObstacle('crate_2', 'SUPPLY_CRATE', vec2(1750, 157), 18, 18, { health: 8, dropItem: ItemDropType.WEAPON_FLAME }),
      // Zone 5: Tetsuyuki Citadel Arena
      new DestructibleObstacle('sandbag_citadel_1', 'SANDBAG_BARRICADE', vec2(1840, 216), 24, 14, { health: 25 }),
      new DestructibleObstacle('sandbag_citadel_2', 'SANDBAG_BARRICADE', vec2(2190, 216), 24, 14, { health: 25 }),
    ];

    for (const obs of staticObstacles) {
      this.engine.addEntity(obs);
    }

    const eng = this.engine as any;
    if (eng.entitiesToAdd && eng.entitiesToAdd.length > 0) {
      for (const entity of eng.entitiesToAdd) {
        eng.entities.set(entity.id, entity);
        eng.spatialGrid.insert(entity);
      }
      eng.entitiesToAdd = [];
    }
  }

  /**
   * Mounts the game canvas and virtual touch pad to the DOM container.
   */
  public mount(container: HTMLElement): void {
    let canvas = container.querySelector<HTMLCanvasElement>('canvas#game-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      canvas.width = CanvasRenderer.VIRTUAL_WIDTH;
      canvas.height = CanvasRenderer.VIRTUAL_HEIGHT;
      container.appendChild(canvas);
    }
    this.canvas = canvas;

    // Mount touch controls over container
    this.touchPad.mount(container);

    // Auto-detect touch device or small screens to show touch controls
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.touchPad.setVisible(isTouchDevice);
  }

  /**
   * Starts the 60 FPS requestAnimationFrame loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.engine.start();
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.accumulator = 0;

    const tickFrame = (now: number) => {
      if (!this.isRunning) return;

      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      // Check Pause Toggle
      const isPaused = this.keyboard.isPaused() || this.touchPad.isPaused();

      if (!isPaused) {
        this.accumulator += dt;
        while (this.accumulator >= FullMetalSlugGame.FIXED_TIMESTEP) {
          this.step(FullMetalSlugGame.FIXED_TIMESTEP);
          this.accumulator -= FullMetalSlugGame.FIXED_TIMESTEP;
        }
      }

      this.render();

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tickFrame);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tickFrame);
    }
  }

  /**
   * Stops the running loop.
   */
  public stop(): void {
    this.isRunning = false;
    this.engine.stop();
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Discrete simulation step for fixed timestep updates or automated unit tests.
   */
  public step(dt: number = FullMetalSlugGame.FIXED_TIMESTEP): void {
    this.elapsedTime += dt;
    (this.engine as any).cameraX = this.camera.x;

    // 1. Process Combined Keyboard & Touch Inputs
    const kbSnap = this.keyboard.getSnapshot();
    const touchSnap = this.touchPad.getSnapshot();

    const input: PlayerInputSnapshot = {
      left: kbSnap.left || touchSnap.left,
      right: kbSnap.right || touchSnap.right,
      up: kbSnap.up || touchSnap.up,
      down: kbSnap.down || touchSnap.down,
      jumpPressed: kbSnap.jumpPressed || touchSnap.jumpPressed,
      jumpHeld: kbSnap.jumpHeld || touchSnap.jumpHeld,
      shootPressed: kbSnap.shootPressed || touchSnap.shootPressed,
      shootHeld: kbSnap.shootHeld || touchSnap.shootHeld,
      grenadePressed: kbSnap.grenadePressed || touchSnap.grenadePressed,
      ultimatePressed: kbSnap.ultimatePressed,
      helpPressed: kbSnap.helpPressed,
    };

    this.lastInputSnapshot = input;

    // Process Tutorial Toggle from Keyboard (KeyH)
    if (input.helpPressed || this.keyboard.helpJustPressed) {
      this.toggleTutorial();
    }

    // Auto-dismiss tutorial after 5.0 seconds with smooth 1.0s fade
    if (this.showTutorial && this.tutorialTimer < 900000) {
      this.tutorialTimer = Math.max(0, this.tutorialTimer - dt);
      if (this.tutorialTimer < 1.0) {
        this.tutorialAlpha = Math.max(0, this.tutorialTimer);
      }
      if (this.tutorialTimer <= 0) {
        this.showTutorial = false;
        this.tutorialAlpha = 0;
      }
    }

    // Update Player controller with input (handles gameplay, dying, continue countdown, and parachute)
    this.player.handleInput(input, dt, this.engine);

    // 2. Stage Progression & Camera Trigger Evaluation
    this.stageManager.update(this.camera.x, this.player.position.x);

    // Sync camera bounds with stage manager
    const stageBounds = this.stageManager.getCameraBounds();
    this.camera.bounds = { ...stageBounds };

    // 3. Advance Headless Physics Simulation (Entities & Collisions)
    this.engine.tick(dt);

    // 3.5. Advance Decoupled Corpse Simulation
    this.corpseManager.update(dt);

    // 4. Update Camera Tracking Player
    this.camera.update(this.player.position.x, this.player.position.y - 10, dt);

    // 5. Update Boss Warning Timer
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer = Math.max(0, this.bossWarningTimer - dt);
    }

    // 6. Update Active Explosions Progress
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.progress += dt * 3.2; // ~300ms total duration
      if (exp.progress >= 1.0) {
        this.activeExplosions.splice(i, 1);
      }
    }

    // 7. Update Renderer Internal Clock
    this.renderer.update(dt);
  }

  /**
   * Executes a complete render cycle and blits to target canvas.
   */
  public render(): void {
    const scene = this.buildRenderSceneState();
    this.renderer.renderScene(scene);

    if (this.canvas) {
      this.renderer.blitToCanvas(this.canvas);
    }
  }

  // =========================================================================
  // SCENE GRAPH COMPILATION
  // =========================================================================

  private buildRenderSceneState(): RenderSceneState {
    const entities = this.engine.getAllEntities();

    // 1. Compile Player Render State
    let playerAnimFrame: number | undefined = undefined;
    if (this.player.actionState === PlayerActionState.DYING) {
      const progress = Math.min(1.0, Math.max(0, 1.0 - (this.player.deathTimer / PlayerController.DEATH_DURATION)));
      playerAnimFrame = Math.min(3, Math.floor(progress * 4));
    }

    const playerRenderState: RenderPlayerState = {
      x: this.player.position.x,
      y: this.player.position.y,
      facing: this.player.facing,
      state: this.resolvePlayerRenderState(),
      animFrame: playerAnimFrame,
      isMelee: this.player.isAttackingMelee,
      aimAngle: this.player.aimAngle,
      aimDirection: this.player.aimDirection,
      weaponType: this.player.weaponManager.getActiveWeapon(),
      isFiring: this.lastInputSnapshot
        ? this.lastInputSnapshot.shootPressed || (this.lastInputSnapshot.shootHeld && this.player.weaponManager.getWeaponState().isAutomatic)
        : false,
      isParachuting: this.player.isParachuting || this.player.actionState === PlayerActionState.RESPAWNING_PARACHUTE,
      parachuteSwayAngle: this.player.parachuteSwayAngle,
      invulnerabilityTimer: this.player.invulnerabilityTimer,
    };

    // 2. Compile Living Enemies, Obstacles, POWs & Boss
    const enemyStates: RenderEnemyState[] = [];
    const obstacleStates: RenderObstacleState[] = [];
    let bossState: RenderBossState | undefined = undefined;
    const powStates: RenderPowState[] = [];
    const projectileStates: RenderProjectileState[] = [];

    for (const ent of entities) {
      if (!ent.isAlive) continue;

      if (ent.type === 'SOLDIER_RIFLE' || ent.type === 'SOLDIER_KNIFE' ||
          ent.type === 'SOLDIER_GRENADE' || ent.type === 'SOLDIER_SHIELD') {
        const soldier = ent as SoldierEnemy;
        enemyStates.push({
          id: soldier.id,
          type: soldier.type,
          x: soldier.position.x,
          y: soldier.position.y + soldier.height,
          facing: soldier.facing,
          state: soldier.state,
          health: soldier.health,
          maxHealth: soldier.maxHealth,
          isParachuteActive: soldier.isParachuteActive,
          parachuteSwayAngle: soldier.isParachuteActive
            ? Math.max(-0.25, Math.min(0.25, soldier.velocity.x * 0.004))
            : undefined,
        });
      } else if (ent.type === 'MID_BOSS_VEHICLE') {
        const mb = ent as MidBossVehicle;
        enemyStates.push({
          id: mb.id,
          type: 'MID_BOSS_VEHICLE',
          x: mb.position.x,
          y: mb.position.y,
          facing: mb.facing,
          state: mb.phase,
          turretAngle: mb.turretAngle,
          health: mb.health,
          maxHealth: mb.maxHealth,
        });
      } else if (ent.type === 'BOSS_TETSUYUKI') {
        const b = ent as TetsuyukiBoss;
        bossState = {
          id: b.id,
          x: b.position.x,
          y: b.position.y,
          phase: b.phase,
          health: b.health,
          maxHealth: b.maxHealth,
          weakPointExposed: b.weakPointExposed,
          laserSweepActive: b.isLaserActive,
          laserY: b.laserFloorHitbox ? b.laserFloorHitbox.y : undefined,
        };
      } else if (ent.type === 'POW') {
        const pow = ent as PowEntity;
        powStates.push({
          id: pow.id,
          x: pow.position.x,
          y: pow.position.y,
          state: this.mapPowRenderState(pow.state),
          facing: pow.facing,
        });
      } else if (ent.type === 'PROJECTILE') {
        const p = ent as any;
        let projType: 'handgun' | 'hmg' | 'flame' = 'handgun';
        if (p.weaponType === 'HEAVY_MACHINE_GUN') projType = 'hmg';
        else if (p.weaponType === 'FLAME_SHOT') projType = 'flame';

        projectileStates.push({
          id: p.id,
          type: projType,
          x: p.position.x,
          y: p.position.y,
        });
      } else if (ent.type === 'GRENADE') {
        projectileStates.push({
          id: ent.id,
          type: 'grenade',
          x: ent.position.x,
          y: ent.position.y,
        });
      } else if (ent.type === 'HOMING_MISSILE') {
        projectileStates.push({
          id: ent.id,
          type: 'rocket',
          x: ent.position.x,
          y: ent.position.y,
        });
      } else if (ent.type === 'CANNON_SHELL' || ent.type === 'TETSUYUKI_SHELL' || ent.type === 'ENEMY_GRENADE') {
        projectileStates.push({
          id: ent.id,
          type: 'mortar',
          x: ent.position.x,
          y: ent.position.y,
        });
      } else if (ent.type === 'ENEMY_BULLET') {
        projectileStates.push({
          id: ent.id,
          type: 'handgun',
          x: ent.position.x,
          y: ent.position.y,
        });
      } else if (ent.type.startsWith('OBSTACLE_')) {
        const obs = ent as DestructibleObstacle;
        obstacleStates.push({
          id: obs.id,
          obstacleType: obs.obstacleType,
          x: obs.bounds.x,
          y: obs.bounds.y,
          width: obs.bounds.width,
          height: obs.bounds.height,
          health: obs.health,
          maxHealth: obs.maxHealth,
        });
      }
    }

    // Add brass casings
    const casings = this.player.weaponManager.projectileManager.getBrassCasings();
    for (const c of casings) {
      projectileStates.push({
        id: c.id,
        type: 'casing',
        x: c.position.x,
        y: c.position.y,
        rotation: c.rotation,
      });
    }

    // 3. Compile Retro HUD State
    const activeMidBoss = enemyStates.find((e) => e.type === 'MID_BOSS_VEHICLE');
    const isPaused = this.keyboard.isPaused() || this.touchPad.isPaused();

    const hudState: RenderHUDState = {
      score: this.player.score,
      lives: this.player.lives,
      weaponType: this.player.weaponManager.getActiveWeapon(),
      ammo: this.player.weaponManager.getAmmo(),
      grenades: this.player.weaponManager.getGrenadeCount(),
      hostagesRescued: this.player.rescuedPowCount,
      bossHealth: bossState ? bossState.health : activeMidBoss ? activeMidBoss.health : undefined,
      bossMaxHealth: bossState ? bossState.maxHealth : activeMidBoss ? activeMidBoss.maxHealth : undefined,
      bossName: bossState ? 'STAGE 1 BOSS: TETSUYUKI' : activeMidBoss ? 'MID-BOSS: IRON TECHNICAL' : undefined,
      showBossWarning: this.bossWarningTimer > 0,
      bossWarningTimer: this.bossWarningTimer,
      isPaused,
      isGameOver: (!this.player.isAlive && !this.player.isContinueActive) || this.player.actionState === PlayerActionState.DEAD,
      isStageClear: this.isStageClear,
      ultimateStock: this.player.ultimateManager ? this.player.ultimateManager.stock : 0,
      maxUltimateStock: this.player.ultimateManager ? this.player.ultimateManager.maxStock : 3,
      isContinueActive: this.player.isContinueActive,
      continueCountdown: this.player.continueTimer,
      showTutorial: this.showTutorial,
      tutorialAlpha: this.tutorialAlpha,
    };

    return {
      time: this.elapsedTime,
      camera: this.camera,
      platforms: this.stageManager.getPlatforms(),
      obstacles: obstacleStates,
      player: playerRenderState,
      enemies: enemyStates,
      corpses: this.corpseManager.getRenderStates(),
      boss: bossState,
      pows: powStates,
      projectiles: projectileStates,
      explosions: this.activeExplosions,
      hud: hudState,
      cinematicFX: this.player.ultimateManager?.getCinematicState(),
    };
  }


  private resolvePlayerRenderState(): 'idle' | 'run' | 'jump' | 'crouch' | 'aim' | 'knife' | 'fire' | 'death' | 'parachute' {
    if (!this.player.isAlive || this.player.actionState === PlayerActionState.DEAD || this.player.actionState === PlayerActionState.DYING) {
      return 'death';
    }
    if (this.player.actionState === PlayerActionState.RESPAWNING_PARACHUTE || this.player.isParachuting) {
      return 'parachute';
    }
    if (this.player.isAttackingMelee) {
      return 'knife';
    }
    if (this.player.isCrouching || this.player.actionState === PlayerActionState.CRAWLING ||
        this.player.actionState === PlayerActionState.CROUCH_IDLE) {
      return 'crouch';
    }
    if (!this.player.isGrounded || this.player.actionState === PlayerActionState.JUMPING ||
        this.player.actionState === PlayerActionState.FALLING) {
      return 'jump';
    }
    if (this.player.actionState === PlayerActionState.RUNNING) {
      return 'run';
    }
    return 'idle';
  }

  private mapPowRenderState(state: PowState): 'tied' | 'freed' | 'salute' | 'drop' | 'escape' {
    switch (state) {
      case PowState.TIED_UP: return 'tied';
      case PowState.FREED: return 'freed';
      case PowState.SALUTE: return 'salute';
      case PowState.OFFERING_ITEM: return 'drop';
      case PowState.ESCAPING:
      case PowState.SAVED: return 'escape';
      default: return 'tied';
    }
  }

  // =========================================================================
  // AUDIO & EVENT BUS WIRING
  // =========================================================================

  private setupAudioAndEventBus(): void {
    const bus = this.engine.eventBus;

    // SFX Events
    bus.on('play_sound', (data: { sound: string }) => {
      switch (data.sound) {
        case 'sfx_pistol_fire':
          this.soundEngine.playPistol();
          break;
        case 'sfx_hmg_fire':
          this.soundEngine.playHeavyMachineGun();
          break;
        case 'sfx_flame_fire':
          this.soundEngine.playFlameShot();
          break;
        case 'sfx_grenade_throw':
          this.soundEngine.playGrenadeLaunch();
          break;
        case 'sfx_grenade_bounce':
          this.soundEngine.playGrenadeBounce();
          break;
        case 'sfx_grenade_explosion':
          this.soundEngine.playExplosion(true);
          break;
        case 'sfx_knife_slash':
          this.soundEngine.playKnifeSlash();
          break;
        case 'sfx_knife_hit':
          this.soundEngine.playKnifeSlash();
          this.soundEngine.playBulletHit(true);
          break;
        case 'sfx_item_pickup':
        case 'sfx_weapon_pickup':
        case 'sfx_ammo_pickup':
        case 'sfx_grenade_pickup':
          this.soundEngine.playItemPickup();
          break;
        case 'sfx_pow_freed':
        case 'sfx_pow_saved':
          this.soundEngine.playItemPickup();
          break;
        case 'sfx_air_raid_siren':
        case 'sfx_ultimate_siren':
          this.soundEngine.playUltimateSiren();
          break;
        case 'sfx_bomber_flyover':
        case 'sfx_flyover_roar':
          this.soundEngine.playFlyoverRoar();
          break;
        case 'sfx_heavy_detonation':
        case 'sfx_apocalyptic_blast':
          this.soundEngine.playApocalypticBlast();
          break;
      }
    });

    // Arcade Announcer Voice Callouts
    bus.on('play_voice', (data: { voice: string }) => {
      switch (data.voice) {
        case 'voice_heavy_machine_gun':
          this.soundEngine.speech.playHeavyMachineGun();
          break;
        case 'voice_flame_shot':
          this.soundEngine.speech.playFlameShot();
          break;
        case 'voice_thank_you':
          this.soundEngine.speech.playThankYou();
          break;
        case 'voice_ok':
          this.soundEngine.speech.playOk();
          break;
        case 'voice_mission_complete':
          this.soundEngine.speech.playMissionComplete();
          break;
      }
    });

    // Boss Defeat -> Mission Complete Callout
    bus.on('mission_complete', () => {
      this.isStageClear = true;
      this.soundEngine.speech.playMissionComplete();
    });

    bus.on('boss_destroyed', () => {
      this.isStageClear = true;
      this.soundEngine.speech.playMissionComplete();
    });

    // Explosions Spawning & SFX
    const addExplosion = (x: number, y: number, type: 'small' | 'medium' | 'large') => {
      this.activeExplosions.push({
        id: `exp_${this.nextExplosionId++}`,
        type,
        x,
        y,
        progress: 0.0,
      });
    };

    bus.on('explosion_spawned', (data: { position?: { x: number; y: number }; isLarge?: boolean }) => {
      this.soundEngine.playExplosion(data?.isLarge ?? false);
      if (data?.position) {
        addExplosion(data.position.x, data.position.y, data.isLarge ? 'large' : 'medium');
      }
    });

    bus.on('boss_spark_explosion', (data: { position?: { x: number; y: number } }) => {
      this.soundEngine.playExplosion(false);
      if (data?.position) {
        addExplosion(data.position.x, data.position.y, 'small');
      }
    });

    bus.on('boss_armor_explosion', (data: { position?: { x: number; y: number } }) => {
      this.soundEngine.playExplosion(true);
      if (data?.position) {
        addExplosion(data.position.x, data.position.y, 'large');
      }
    });

    bus.on('boss_core_detonation', (data: { position?: { x: number; y: number } }) => {
      this.soundEngine.playExplosion(true);
      if (data?.position) {
        addExplosion(data.position.x, data.position.y, 'large');
      }
    });

    bus.on('grenade_exploded', (data: { blastCenter?: { x: number; y: number } }) => {
      if (data?.blastCenter) {
        addExplosion(data.blastCenter.x, data.blastCenter.y, 'large');
        const p = this.player;
        if (p.isAlive && (!p.invulnerabilityTimer || p.invulnerabilityTimer <= 0)) {
          const dx = p.position.x - data.blastCenter.x;
          const dy = p.position.y - data.blastCenter.y;
          if (Math.hypot(dx, dy) <= 50) {
            p.takeDamage(1.0);
          }
        }
      }
    });

    // Soldier Casualty Death SFX
    bus.on('enemy_death', (data: { deathType?: string }) => {
      const type = (data?.deathType as 'standard' | 'explosion' | 'fire') || 'standard';
      this.soundEngine.playSoldierDeath(type);
    });


    // Screen Shake
    bus.on('screen_shake', (data: { amplitude: number; durationFrames?: number }) => {
      this.camera.shake(data.amplitude, (data.durationFrames ?? 12) / 60);
    });

    // Bullet Impacts
    bus.on('projectile_hit', () => {
      this.soundEngine.playBulletHit(false);
    });

    // POW Rescue Tally & Score
    bus.on('pow_saved', () => {
      this.player.rescuedPowCount++;
      this.player.score += PowEntity.SAVED_SCORE_BONUS;
    });

    bus.on('award_score', (data: { score: number }) => {
      if (data?.score) {
        this.player.score += data.score;
      }
    });
  }

  // =========================================================================
  // STAGE 1 LEVEL POPULATION
  // =========================================================================

  public buildStage1Data(options: GameOptions = {}): StageData {
    const STAGE_WIDTH = 3600;
    const STAGE_HEIGHT = 540;

    // 1. Platforms (27 Multi-Tier Platforms Across 5 Micro-Zones)
    const platforms: Platform[] = [
      // ZONE 1: Beachhead Landing & Stilt Docks (0..500)
      { id: 'ground_main', type: 'SOLID', bounds: createAABB(0, 230, 500, 40) },
      { id: 'dock_1', type: 'SEMI_SOLID', bounds: createAABB(110, 175, 120, 10) },
      { id: 'dock_high_perch', type: 'SEMI_SOLID', bounds: createAABB(140, 120, 70, 10) },
      { id: 'bunker_1', type: 'SOLID', bounds: createAABB(240, 160, 95, 16) },
      { id: 'bridge_1', type: 'SEMI_SOLID', bounds: createAABB(420, 140, 140, 10) },

      // ZONE 2: Dune Redoubt & High Watchtower (500..1000)
      { id: 'ground_zone2_ridge', type: 'SOLID', bounds: createAABB(500, 230, 260, 40) },
      { id: 'ground_zone2_slope', type: 'SOLID', bounds: createAABB(760, 230, 240, 40) },
      { id: 'scaffold_tier1', type: 'SEMI_SOLID', bounds: createAABB(520, 170, 100, 10) },
      { id: 'watchtower_alpha', type: 'SEMI_SOLID', bounds: createAABB(660, 125, 90, 12) },
      { id: 'dune_redoubt_platform', type: 'SEMI_SOLID', bounds: createAABB(770, 175, 110, 14) },
      { id: 'dune_terrace', type: 'SEMI_SOLID', bounds: createAABB(890, 150, 90, 10) },

      // ZONE 3: River Basin & Mid-Boss Arena (1000..1450)
      { id: 'ground_midboss_floor', type: 'SOLID', bounds: createAABB(1000, 230, 450, 40) },
      { id: 'midboss_dock_left', type: 'SEMI_SOLID', bounds: createAABB(1020, 170, 110, 12) },
      { id: 'midboss_dock_right', type: 'SEMI_SOLID', bounds: createAABB(1320, 170, 110, 12) },
      { id: 'midboss_catwalk', type: 'SEMI_SOLID', bounds: createAABB(1160, 115, 120, 10) },
      { id: 'midboss_crane_left', type: 'SEMI_SOLID', bounds: createAABB(1080, 85, 70, 10) },

      // ZONE 4: Trench Gorge & Suspension Bridges (1450..1800)
      { id: 'ground_trench_dip', type: 'SOLID', bounds: createAABB(1450, 230, 210, 40) },
      { id: 'ground_fortress_approach', type: 'SOLID', bounds: createAABB(1660, 230, 140, 40) },
      { id: 'bridge_2', type: 'SEMI_SOLID', bounds: createAABB(1440, 160, 140, 10) },
      { id: 'tower_platform', type: 'SEMI_SOLID', bounds: createAABB(1600, 125, 90, 12) },
      { id: 'bunker_2', type: 'SEMI_SOLID', bounds: createAABB(1690, 175, 110, 14) },
      { id: 'ravine_scaffold', type: 'SEMI_SOLID', bounds: createAABB(1520, 195, 80, 10) },

      // ZONE 5: Tetsuyuki Citadel Arena (1800..3600)
      { id: 'ground_citadel_floor', type: 'SOLID', bounds: createAABB(1800, 230, 1800, 40) },
      { id: 'boss_arena_left', type: 'SEMI_SOLID', bounds: createAABB(1860, 170, 100, 12) },
      { id: 'boss_arena_right', type: 'SEMI_SOLID', bounds: createAABB(2080, 170, 100, 12) },
      { id: 'boss_arena_high_crane', type: 'SEMI_SOLID', bounds: createAABB(1970, 110, 80, 10) },
      { id: 'boss_arena_rampart', type: 'SEMI_SOLID', bounds: createAABB(2200, 140, 90, 10) },
    ];

    // 2. Scripted Triggers: Patrol Waves, Mid-Boss & Boss (POWs pre-placed statically)
    const triggers: any[] = [
      // Trigger Wave 1: First skirmish
      {
        id: 'trigger_wave_1',
        triggerX: 180,
        triggered: false,
        spawnAction: (eng: GameEngine, cameraX: number = 0) => {
          // Out-of-bounds right spawn: cameraX + 1000px (>960 viewport, staggered +40px)
          const spawnBaseX = cameraX + Math.max(1000, CanvasRenderer.VIRTUAL_WIDTH + 40);
          // Rebel Rifleman (smooth ingress vx = -110, y = 192 so feet align to ground at Y = 230)
          eng.addEntity(new SoldierEnemy('rebel_rifle_1', 'SOLDIER_RIFLE', vec2(spawnBaseX, 192), { cameraX }));
          // Rebel Knife Charger (staggered by +40px, y = 192)
          eng.addEntity(new SoldierEnemy('rebel_knife_1', 'SOLDIER_KNIFE', vec2(spawnBaseX + 40, 192), { cameraX }));
        },
      },

      // Trigger Wave 2: Fortified redoubt
      {
        id: 'trigger_wave_2',
        triggerX: 420,
        triggered: false,
        spawnAction: (eng: GameEngine, cameraX: number = 0) => {
          // Out-of-bounds right spawn: cameraX + 1000px (>960 viewport, staggered +40px)
          const spawnBaseX = cameraX + Math.max(1000, CanvasRenderer.VIRTUAL_WIDTH + 40);
          // Shield Trooper on ground (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_shield_1', 'SOLDIER_SHIELD', vec2(spawnBaseX, 192), { cameraX }));
          // Grenade Thrower (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_grenade_1', 'SOLDIER_GRENADE', vec2(spawnBaseX + 40, 192), { cameraX }));
          // Rear Rifleman (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_rifle_2', 'SOLDIER_RIFLE', vec2(spawnBaseX + 80, 192), { cameraX }));
        },
      },

      // Trigger Mid-Boss: Rebel Iron Technical Battle at Section 1 (Expanded 1100px Arena)
      {
        id: 'trigger_mid_boss',
        triggerX: 740,
        triggered: false,
        lockCameraBounds: { minX: 720, maxX: 1820, minY: 0, maxY: 540 },
        spawnAction: (eng: GameEngine, cameraX: number = 0) => {
          this.stageManager.setState(StageState.MID_BOSS_BATTLE);
          // Rebel Iron Technical Armored Vehicle (expanded patrol range to 1650 for 1100px arena)
          const midBoss = new MidBossVehicle('mid_boss_1', vec2(1050, 162), {
            customHp: 320,
            patrolMinX: 800,
            patrolMaxX: 1650,
          });
          eng.addEntity(midBoss);
          // Infantry support entering out-of-bounds (y = 192, x >= 1840)
          const spawnBaseX = Math.max(cameraX + CanvasRenderer.VIRTUAL_WIDTH + 40, 1840);
          eng.addEntity(new SoldierEnemy('rebel_mb_support', 'SOLDIER_RIFLE', vec2(spawnBaseX, 192), { cameraX }));
        },
        isCompleted: (eng: GameEngine) => {
          const mb = eng.getEntity('mid_boss_1');
          return !mb || !mb.isAlive;
        },
      },

      // Trigger Wave 3: Advance to Fortress Section 2
      {
        id: 'trigger_wave_3',
        triggerX: 1240,
        triggered: false,
        spawnAction: (eng: GameEngine, cameraX: number = 0) => {
          this.stageManager.setState(StageState.SECTION_2_ADVANCE);

          // Out-of-bounds right spawn: cameraX + 1000px (>960 viewport, staggered +40px)
          const spawnBaseX = cameraX + Math.max(1000, CanvasRenderer.VIRTUAL_WIDTH + 40);
          // Fast Knife Charger (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_knife_2', 'SOLDIER_KNIFE', vec2(spawnBaseX, 192), { cameraX }));
          // Shield Trooper (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_shield_2', 'SOLDIER_SHIELD', vec2(spawnBaseX + 40, 192), { cameraX }));
          // Ground Grenadier (y = 192)
          eng.addEntity(new SoldierEnemy('rebel_grenade_2', 'SOLDIER_GRENADE', vec2(spawnBaseX + 80, 192), { cameraX }));
        },
      },

      // Trigger End-Boss: Tetsuyuki War Fortress Showdown (Expanded 1100px Arena)
      {
        id: 'trigger_end_boss',
        triggerX: 1780,
        triggered: false,
        lockCameraBounds: { minX: 1800, maxX: 2900, minY: 0, maxY: 540 },
        spawnAction: (eng: GameEngine) => {
          this.stageManager.setState(StageState.BOSS_BATTLE);
          // Trigger Flashing Warning Banner
          this.bossWarningTimer = 3.5;
          // Spawn Tetsuyuki War Fortress Boss (Rebalanced to 400 HP)
          const boss = new TetsuyukiBoss('boss_tetsuyuki', vec2(2050, 70), {
            customHp: 400,
          });
          eng.addEntity(boss);
        },
        isCompleted: (eng: GameEngine) => {
          const b = eng.getEntity('boss_tetsuyuki') as TetsuyukiBoss;
          return !b || !b.isAlive;
        },
      },
    ];

    // Diverse Enemy Spawning Extensions (R1)
    if (options.spawnMode === 'diverse') {
      triggers.push(
        {
          id: 'trigger_parachute_wave_1',
          triggerX: 280,
          triggered: false,
          spawnAction: (eng: GameEngine, cameraX: number = 0) => {
            const spawnX = cameraX + 360;
            const paratrooper = SoldierEnemy.createParatrooper(
              'rebel_paratrooper_1',
              'SOLDIER_RIFLE',
              vec2(spawnX, 15),
              {
                anchorX: spawnX,
                descentSpeed: 52,
                swayAmplitude: 20,
                swayFrequency: 2.8,
                targetGroundY: 230,
                cameraX,
              }
            );
            eng.addEntity(paratrooper);
          },
        },
        {
          id: 'trigger_bunker_ambush',
          triggerX: 580,
          triggered: false,
          spawnAction: (eng: GameEngine, cameraX: number = 0) => {
            const ambushSoldier = SoldierEnemy.createAmbushSoldier(
              'rebel_ambush_1',
              'SOLDIER_KNIFE',
              vec2(cameraX + 460, 140),
              vec2(-140, -220),
              { cameraX, facing: -1 }
            );
            eng.addEntity(ambushSoldier);
          },
        },
        {
          id: 'trigger_parachute_wave_2',
          triggerX: 1360,
          triggered: false,
          spawnAction: (eng: GameEngine, cameraX: number = 0) => {
            const spawnX1 = cameraX + 320;
            const spawnX2 = cameraX + 440;
            const p1 = SoldierEnemy.createParatrooper(
              'rebel_paratrooper_2',
              'SOLDIER_GRENADE',
              vec2(spawnX1, 10),
              {
                anchorX: spawnX1,
                descentSpeed: 48,
                swayAmplitude: 16,
                swayFrequency: 3.2,
                targetGroundY: 230,
                cameraX,
              }
            );
            const p2 = SoldierEnemy.createParatrooper(
              'rebel_paratrooper_3',
              'SOLDIER_RIFLE',
              vec2(spawnX2, 30),
              {
                anchorX: spawnX2,
                descentSpeed: 54,
                swayAmplitude: 22,
                swayFrequency: 2.5,
                swayPhase: Math.PI / 2,
                targetGroundY: 230,
                cameraX,
              }
            );
            eng.addEntity(p1);
            eng.addEntity(p2);
          },
        },
        {
          id: 'trigger_bridge_ambush',
          triggerX: 1560,
          triggered: false,
          spawnAction: (eng: GameEngine, cameraX: number = 0) => {
            const ambushSoldier = SoldierEnemy.createAmbushSoldier(
              'rebel_ambush_2',
              'SOLDIER_KNIFE',
              vec2(cameraX + 450, 120),
              vec2(-120, -210),
              { cameraX, facing: -1 }
            );
            eng.addEntity(ambushSoldier);
          },
        }
      );
    }

    return {
      id: 'stage_1',
      name: 'Mission 1: Beachhead Redoubt',
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      initialCameraBounds: { minX: 0, maxX: STAGE_WIDTH, minY: 0, maxY: STAGE_HEIGHT },
      platforms,
      triggers,
    };
  }

  /**
   * Deterministic test hook for E2E and visual regression artifact capture.
   */
  public triggerEnemyDeathForTest(
    deathType: 'standard' | 'explosion' | 'fire',
    position: Vector2D = { x: 200, y: 192 },
    facing: 1 | -1 = -1
  ): void {
    this.corpseManager.spawnCorpse({
      id: `test_corpse_${Date.now()}_${Math.random()}`,
      position,
      velocity: { x: 0, y: 0 },
      facing,
      deathType,
      role: 'RIFLE',
      type: 'SOLDIER_RIFLE',
    });
  }
}

// =============================================================================
// BROWSER BOOTSTRAP ENTRY POINT
// =============================================================================

function bootstrap(): FullMetalSlugGame | null {
  if (typeof document === 'undefined') return null;

  const container = document.getElementById('game-container');
  if (!container) return null;

  const game = new FullMetalSlugGame(container, { spawnMode: 'diverse' });

  // Expose for Playwright E2E and debug automation
  if (typeof window !== 'undefined') {
    (window as any).__GAME__ = game;
    (window as any).__ENGINE__ = game.engine;
    (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
    (window as any).__CORPSE_MANAGER__ = game.corpseManager;
    (window as any).__EXPANSION__ = {
      IronNokanaBoss,
      CrisisEventManager,
      AllyNPC,
      AllyManager,
      AllyKiBlast,
      ItemPickupEntity,
      ItemDropType,
      ArtilleryTargetReticle,
      ArtilleryShellHazard,
      FallingDebrisHazard,
      GroundFlameHazard,
      PowEntity,
      PowState,
      DestructibleObstacle,
      vec2,
    };
  }

  // Start 60 FPS animation loop
  game.start();

  console.log('Metal Slug Web (Full Metal Slug) - Milestone M6 Assembly Ready at 60 FPS');
  return game;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootstrap();
    });
  } else {
    bootstrap();
  }
}

