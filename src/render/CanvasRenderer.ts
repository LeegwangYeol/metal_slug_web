/**
 * High-Performance HTML5 2D Canvas Renderer.
 * - Virtual 480x270 letterbox scaling with nearest-neighbor crisp pixel rendering.
 * - Render Passes: Background Parallax -> Terrain/Platforms -> Entities -> Projectiles & Explosions -> Retro Arcade HUD.
 */

import { Platform } from '../core/physics/Platform';
import { Camera } from './Camera';
import { ParallaxBackground } from './ParallaxBackground';
import { PALETTES } from './sprites/Palette';
import {
  CanvasBuffer,
  CanvasContext2DLike,
  ProceduralSpriteFactory,
  createCanvasBuffer,
} from './sprites/ProceduralSpriteFactory';
import { HUDOverlay } from '../ui/HUDOverlay';

export interface LetterboxBounds {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface RenderPlayerState {
  x: number;
  y: number;
  facing: 1 | -1;
  state: 'idle' | 'run' | 'jump' | 'crouch' | 'aim' | 'knife' | 'fire' | 'death';
  aimAngle?: number; // 0..7
  animFrame?: number;
  isMelee?: boolean;
}

export interface RenderEnemyState {
  id: string;
  type: string; // 'SOLDIER_RIFLE' | 'SOLDIER_KNIFE' | 'SOLDIER_GRENADE' | 'SOLDIER_SHIELD' | 'MID_BOSS_VEHICLE' | string
  x: number;
  y: number;
  facing: 1 | -1;
  state: string;
  animFrame?: number;
  health?: number;
  maxHealth?: number;
  turretAngle?: number;
  phase?: string;
  isDead?: boolean;
}

export interface RenderBossState {
  id?: string;
  x: number;
  y: number;
  phase: 'PHASE_1_ARTILLERY' | 'PHASE_2_LASER_SWEEP' | 'PHASE_3_MELTDOWN' | 'DEATH_EXPLODING' | 'DESTROYED' | string;
  health: number;
  maxHealth: number;
  turretAngle?: number;
  laserSweepActive?: boolean;
  laserY?: number;
  weakPointExposed?: boolean;
}

export interface RenderPowState {
  id: string;
  x: number;
  y: number;
  state: 'tied' | 'freed' | 'salute' | 'drop' | 'escape';
  animFrame?: number;
  facing?: 1 | -1;
}

export interface RenderProjectileState {
  id: string;
  type: 'handgun' | 'hmg' | 'casing' | 'flame' | 'grenade' | 'rocket' | 'mortar';
  x: number;
  y: number;
  rotation?: number;
  frame?: number;
}

export interface RenderExplosionState {
  id: string;
  type: 'small' | 'medium' | 'large';
  x: number;
  y: number;
  progress: number; // 0.0 to 1.0
}

export interface RenderHUDState {
  score: number;
  lives: number;
  weaponType: 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT';
  ammo: number; // Infinity or number
  grenades: number;
  hostagesRescued: number;
  bossHealth?: number;
  bossMaxHealth?: number;
  bossName?: string;
  showBossWarning?: boolean;
  bossWarningTimer?: number;
  isPaused?: boolean;
  isGameOver?: boolean;
  isStageClear?: boolean;
}

export interface RenderSceneState {
  time?: number;
  camera: Camera;
  platforms?: Platform[];
  player?: RenderPlayerState;
  enemies?: RenderEnemyState[];
  boss?: RenderBossState;
  pows?: RenderPowState[];
  projectiles?: RenderProjectileState[];
  explosions?: RenderExplosionState[];
  hud?: RenderHUDState;
}

export class CanvasRenderer {
  public static readonly VIRTUAL_WIDTH = 480;
  public static readonly VIRTUAL_HEIGHT = 270;

  // Off-screen virtual framebuffer buffer (480x270)
  public readonly virtualBuffer: CanvasBuffer;
  public readonly virtualCtx: CanvasContext2DLike;

  // Render Subsystems
  public readonly camera: Camera;
  public readonly parallax: ParallaxBackground;
  public readonly spriteFactory: ProceduralSpriteFactory;
  public readonly hudOverlay: HUDOverlay;

  // Accumulated render time for animations
  private elapsedTime: number = 0;

  constructor(options?: { camera?: Camera; parallax?: ParallaxBackground; spriteFactory?: ProceduralSpriteFactory; hudOverlay?: HUDOverlay }) {
    this.virtualBuffer = createCanvasBuffer(CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
    const ctx = this.virtualBuffer.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create virtual 2D canvas context');
    }
    this.virtualCtx = ctx;
    this.virtualCtx.imageSmoothingEnabled = false;

    this.spriteFactory = options?.spriteFactory ?? ProceduralSpriteFactory.getInstance();
    this.parallax = options?.parallax ?? new ParallaxBackground();
    this.camera = options?.camera ?? new Camera({ viewportWidth: CanvasRenderer.VIRTUAL_WIDTH, viewportHeight: CanvasRenderer.VIRTUAL_HEIGHT });
    this.hudOverlay = options?.hudOverlay ?? new HUDOverlay(this.spriteFactory);
  }

  public getVirtualBuffer(): CanvasBuffer {
    return this.virtualBuffer;
  }

  /**
   * Calculates crisp letterbox / pillarbox scaling parameters for a target canvas of arbitrary dimensions.
   */
  public static calculateLetterbox(destWidth: number, destHeight: number): LetterboxBounds {
    const scale = Math.min(
      destWidth / CanvasRenderer.VIRTUAL_WIDTH,
      destHeight / CanvasRenderer.VIRTUAL_HEIGHT
    );
    const width = Math.floor(CanvasRenderer.VIRTUAL_WIDTH * scale);
    const height = Math.floor(CanvasRenderer.VIRTUAL_HEIGHT * scale);
    const offsetX = Math.floor((destWidth - width) / 2);
    const offsetY = Math.floor((destHeight - height) / 2);

    return { scale, offsetX, offsetY, width, height };
  }

  /**
   * Clears virtual framebuffer with deep dark background.
   */
  public clear(): void {
    this.virtualCtx.fillStyle = '#0E141C';
    this.virtualCtx.fillRect(0, 0, CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
  }

  /**
   * Main render execution: processes all passes into the virtual buffer.
   */
  public renderScene(scene: RenderSceneState): void {
    const time = scene.time ?? this.elapsedTime;
    const cam = scene.camera;

    this.clear();

    // Pass 1: Background Parallax (4 layers)
    this.renderParallaxPass(cam, time);

    // Pass 2: Terrain & Platforms
    if (scene.platforms && scene.platforms.length > 0) {
      this.renderPlatformsPass(scene.platforms, cam);
    }

    // Pass 3: Entities (POWs, Boss, Enemies, Player)
    this.renderEntitiesPass(scene, cam, time);

    // Pass 4: Projectiles & Explosions
    this.renderProjectilesAndExplosionsPass(scene.projectiles ?? [], scene.explosions ?? [], cam, time);

    // Pass 5: Retro Arcade HUD Overlay (Screen Space)
    if (scene.hud) {
      this.renderHudPass(scene.hud);
    }
  }

  /**
   * Blits the rendered virtual framebuffer to the destination canvas with letterbox scaling.
   */
  public blitToCanvas(targetCanvas: { width: number; height: number; getContext: (id: '2d') => any }): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const bounds = CanvasRenderer.calculateLetterbox(targetCanvas.width, targetCanvas.height);

    // Disable smoothing for crisp retro nearest-neighbor pixels
    ctx.imageSmoothingEnabled = false;

    // Fill letterbox / pillarbox margins
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    // Blit virtual buffer
    ctx.drawImage(
      this.virtualBuffer as any,
      0,
      0,
      CanvasRenderer.VIRTUAL_WIDTH,
      CanvasRenderer.VIRTUAL_HEIGHT,
      bounds.offsetX,
      bounds.offsetY,
      bounds.width,
      bounds.height
    );
  }

  // ==========================================
  // PASS 1: PARALLAX BACKGROUND
  // ==========================================
  private renderParallaxPass(camera: Camera, time: number): void {
    this.parallax.render(this.virtualCtx, camera.renderX, camera.renderY, time);
  }

  // ==========================================
  // PASS 2: TERRAIN & PLATFORMS
  // ==========================================
  private renderPlatformsPass(platforms: Platform[], camera: Camera): void {
    const ctx = this.virtualCtx;
    const T = PALETTES.TERRAIN;

    for (const plat of platforms) {
      if (!camera.isVisible(plat.bounds)) continue;

      const screenPos = camera.worldToScreen(plat.bounds.x, plat.bounds.y);
      const sx = Math.round(screenPos.x);
      const sy = Math.round(screenPos.y);
      const w = plat.bounds.width;
      const h = plat.bounds.height;

      if (plat.type === 'SOLID') {
        // Ground / Solid obstacle: Beach sand surface, mud layer, and concrete / steel base
        // Top sand layer
        ctx.fillStyle = T[2];
        ctx.fillRect(sx, sy, w, Math.min(4, h));
        // Mud & dirt layer
        ctx.fillStyle = T[4];
        ctx.fillRect(sx, sy + 4, w, Math.min(8, Math.max(0, h - 4)));
        // Deep rock / steel structure
        if (h > 12) {
          ctx.fillStyle = T[5];
          ctx.fillRect(sx, sy + 12, w, h - 12);
          // Steel rivets
          ctx.fillStyle = T[6];
          for (let rx = sx + 8; rx < sx + w; rx += 24) {
            ctx.fillRect(rx, sy + 15, 2, 2);
          }
        }
      } else {
        // SEMI_SOLID: Wooden pier dock planks / rustic scaffolding
        ctx.fillStyle = T[8]; // Wooden deck top
        ctx.fillRect(sx, sy, w, Math.min(5, h));
        ctx.fillStyle = T[9]; // Wood grain seams
        for (let bx = sx + 12; bx < sx + w; bx += 16) {
          ctx.fillRect(bx, sy, 1, Math.min(5, h));
        }
        // Support crossbeams underneath
        if (h > 5) {
          ctx.fillStyle = T[9];
          ctx.fillRect(sx, sy + 5, w, h - 5);
          ctx.fillStyle = T[7]; // Steel bracket supports
          ctx.fillRect(sx + 4, sy + 5, 4, h - 5);
          if (w > 30) {
            ctx.fillRect(sx + w - 8, sy + 5, 4, h - 5);
          }
        }
      }
    }
  }

  // ==========================================
  // PASS 3: ENTITIES
  // ==========================================
  private renderEntitiesPass(scene: RenderSceneState, camera: Camera, time: number): void {
    const ctx = this.virtualCtx;

    // 1. Render POW Hostages
    if (scene.pows) {
      for (const pow of scene.pows) {
        const screen = camera.worldToScreen(pow.x, pow.y);
        let spriteKey = 'pow_tied_0';
        if (pow.state === 'tied') {
          spriteKey = Math.floor(time * 3) % 2 === 0 ? 'pow_tied_0' : 'pow_tied_1';
        } else if (pow.state === 'freed') {
          spriteKey = 'pow_freed';
        } else if (pow.state === 'salute') {
          spriteKey = 'pow_salute_0';
        } else if (pow.state === 'drop') {
          spriteKey = 'pow_drop_item';
        } else if (pow.state === 'escape') {
          const f = Math.floor(time * 8) % 4;
          spriteKey = `pow_escape_${f}`;
        }
        this.spriteFactory.drawSprite(ctx, spriteKey, screen.x, screen.y, { flipX: pow.facing === -1 });
      }
    }

    // 2. Render Stage 1 Boss (Tetsuyuki War Fortress)
    if (scene.boss) {
      const boss = scene.boss;
      const screen = camera.worldToScreen(boss.x, boss.y);

      // Select hull based on phase
      let hullKey = 'tetsuyuki_hull_p1';
      if (boss.phase === 'PHASE_2_LASER_SWEEP') {
        hullKey = 'tetsuyuki_hull_p2';
      } else if (boss.phase === 'PHASE_3_MELTDOWN' || boss.phase === 'DEATH_EXPLODING') {
        hullKey = 'tetsuyuki_hull_p3';
      }
      this.spriteFactory.drawSprite(ctx, hullKey, screen.x, screen.y);

      // Underside Cannon (Phase 1)
      if (boss.phase === 'PHASE_1_ARTILLERY') {
        this.spriteFactory.drawSprite(ctx, 'tetsuyuki_cannon', screen.x + 20, screen.y + 40);
      }

      // Dorsal Rocket Pod
      this.spriteFactory.drawSprite(ctx, 'tetsuyuki_rocket_pod_open', screen.x + 60, screen.y - 30);

      // Gatling Minigun (Phase 2 & 3)
      if (boss.phase !== 'PHASE_1_ARTILLERY') {
        this.spriteFactory.drawSprite(ctx, 'tetsuyuki_gatling', screen.x - 30, screen.y + 10);
      }

      // Exposed Weak Point Core (Phase 3)
      if (boss.weakPointExposed || boss.phase === 'PHASE_3_MELTDOWN') {
        const pulse = 1 + Math.sin(time * 12) * 0.1;
        this.spriteFactory.drawSprite(ctx, 'tetsuyuki_reactor_core', screen.x - 10, screen.y - 6, {
          scale: pulse,
        });
      }

      // Laser Sweep Beam (Hazard)
      if (boss.laserSweepActive) {
        const laserY = boss.laserY !== undefined ? camera.worldToScreen(0, boss.laserY).y : screen.y + 50;
        this.spriteFactory.drawSprite(ctx, 'tetsuyuki_laser_beam', 0, laserY);
      }
    }

    // 3. Render Enemies & Mid-Boss
    if (scene.enemies) {
      for (const enemy of scene.enemies) {
        if (enemy.isDead) continue;
        const screen = camera.worldToScreen(enemy.x, enemy.y);
        const flip = enemy.facing === -1;

        if (enemy.type === 'MID_BOSS_VEHICLE') {
          // Mid-Boss: Iron Technical Half-track Tank
          this.spriteFactory.drawSprite(ctx, 'iron_technical_hull', screen.x, screen.y, { flipX: flip });
          const treadF = Math.floor(time * 10) % 4;
          this.spriteFactory.drawSprite(ctx, `iron_technical_treads_${treadF}`, screen.x, screen.y + 20, { flipX: flip });

          // 360° Rotating Turret
          const turretRot = enemy.turretAngle ?? 0;
          this.spriteFactory.drawSprite(ctx, 'iron_technical_turret', screen.x + (flip ? -20 : 20), screen.y - 14, {
            rotation: turretRot,
          });
        } else if (enemy.type === 'SOLDIER_KNIFE') {
          let sKey = 'rebel_knife_idle';
          if (enemy.state === 'SPRINT') {
            const f = Math.floor(time * 10) % 4;
            sKey = `rebel_knife_run_${f}`;
          } else if (enemy.state === 'LEAP_LUNGE') {
            sKey = 'rebel_knife_leap';
          }
          this.spriteFactory.drawSprite(ctx, sKey, screen.x, screen.y, { flipX: flip });
        } else if (enemy.type === 'SOLDIER_GRENADE') {
          const sKey = enemy.state === 'THROW' ? 'rebel_grenade_throw' : 'rebel_grenade_idle';
          this.spriteFactory.drawSprite(ctx, sKey, screen.x, screen.y, { flipX: flip });
        } else if (enemy.type === 'SOLDIER_SHIELD') {
          const sKey = enemy.state === 'SHIELD_BASH' ? 'rebel_shield_bash' : 'rebel_shield_idle';
          this.spriteFactory.drawSprite(ctx, sKey, screen.x, screen.y, { flipX: flip });
        } else {
          // Default Rebel Rifleman
          let sKey = 'rebel_rifle_idle';
          if (enemy.state === 'PATROL' || enemy.state === 'WALK') {
            const f = Math.floor(time * 6) % 4;
            sKey = `rebel_rifle_walk_${f}`;
          } else if (enemy.state === 'FIRE') {
            sKey = 'rebel_rifle_fire_0';
          }
          this.spriteFactory.drawSprite(ctx, sKey, screen.x, screen.y, { flipX: flip });
        }
      }
    }

    // 4. Render Player (Marco Rossi)
    if (scene.player) {
      const p = scene.player;
      const screen = camera.worldToScreen(p.x, p.y);
      const flip = p.facing === -1;

      let spriteKey = 'player_idle_0';

      if (p.state === 'death') {
        const d = p.animFrame !== undefined ? Math.min(3, p.animFrame) : 2;
        spriteKey = `player_death_${d}`;
      } else if (p.state === 'knife' || p.isMelee) {
        const k = p.animFrame !== undefined ? Math.min(2, p.animFrame) : 1;
        spriteKey = `player_knife_${k}`;
      } else if (p.state === 'crouch') {
        spriteKey = 'player_crouch_idle';
      } else if (p.state === 'jump') {
        spriteKey = p.animFrame === 1 ? 'player_jump_fall' : 'player_jump_rise';
      } else if (p.state === 'run') {
        const f = p.animFrame !== undefined ? p.animFrame % 6 : Math.floor(time * 12) % 6;
        spriteKey = `player_run_${f}`;
      } else if (p.state === 'aim') {
        const aim = p.aimAngle ?? (flip ? 4 : 0);
        spriteKey = `player_aim_${aim}`;
      } else if (p.state === 'fire') {
        spriteKey = 'player_fire_0';
      } else {
        const f = Math.floor(time * 4) % 4;
        spriteKey = `player_idle_${f}`;
      }

      this.spriteFactory.drawSprite(ctx, spriteKey, screen.x, screen.y, { flipX: flip });
    }
  }

  // ==========================================
  // PASS 4: PROJECTILES & EXPLOSIONS
  // ==========================================
  private renderProjectilesAndExplosionsPass(
    projectiles: RenderProjectileState[],
    explosions: RenderExplosionState[],
    camera: Camera,
    time: number
  ): void {
    const ctx = this.virtualCtx;

    // 1. Projectiles
    for (const proj of projectiles) {
      const screen = camera.worldToScreen(proj.x, proj.y);

      if (proj.type === 'handgun') {
        this.spriteFactory.drawSprite(ctx, 'proj_bullet_handgun', screen.x, screen.y, { rotation: proj.rotation });
      } else if (proj.type === 'hmg') {
        this.spriteFactory.drawSprite(ctx, 'proj_bullet_hmg', screen.x, screen.y, { rotation: proj.rotation });
      } else if (proj.type === 'casing') {
        const f = proj.frame ?? Math.floor(time * 16) % 4;
        this.spriteFactory.drawSprite(ctx, `casing_brass_${f}`, screen.x, screen.y);
      } else if (proj.type === 'flame') {
        const f = proj.frame !== undefined ? Math.min(4, proj.frame) : Math.floor(time * 10) % 5;
        this.spriteFactory.drawSprite(ctx, `proj_flame_${f}`, screen.x, screen.y);
      } else if (proj.type === 'grenade') {
        const f = proj.frame ?? Math.floor(time * 12) % 4;
        this.spriteFactory.drawSprite(ctx, `proj_grenade_${f}`, screen.x, screen.y, { rotation: proj.rotation });
      } else if (proj.type === 'rocket') {
        this.spriteFactory.drawSprite(ctx, 'proj_rocket', screen.x, screen.y, { rotation: proj.rotation });
      } else if (proj.type === 'mortar') {
        this.spriteFactory.drawSprite(ctx, 'proj_mortar', screen.x, screen.y, { rotation: proj.rotation });
      }
    }

    // 2. Multi-frame Explosions
    for (const exp of explosions) {
      const screen = camera.worldToScreen(exp.x, exp.y);
      const prog = Math.max(0, Math.min(1, exp.progress));

      if (exp.type === 'small') {
        const frame = Math.min(3, Math.floor(prog * 4));
        this.spriteFactory.drawSprite(ctx, `explosion_small_${frame}`, screen.x, screen.y);
      } else if (exp.type === 'medium') {
        const frame = Math.min(5, Math.floor(prog * 6));
        this.spriteFactory.drawSprite(ctx, `explosion_medium_${frame}`, screen.x, screen.y);
      } else {
        // Large
        const frame = Math.min(7, Math.floor(prog * 8));
        this.spriteFactory.drawSprite(ctx, `explosion_large_${frame}`, screen.x, screen.y);
      }
    }
  }

  // ==========================================
  // PASS 5: RETRO ARCADE HUD OVERLAY
  // ==========================================
  private renderHudPass(hud: RenderHUDState): void {
    this.hudOverlay.render(this.virtualCtx, hud, this.elapsedTime);
  }

  /**
   * Advances renderer internal timer.
   */
  public update(dt: number): void {
    this.elapsedTime += dt;
  }
}
