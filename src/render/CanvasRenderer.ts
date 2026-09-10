/**
 * High-Performance HTML5 2D Canvas Renderer.
 * - Virtual 960x540 letterbox scaling with nearest-neighbor crisp pixel rendering.
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
import { Vector2D, vec2 } from '../core/math/Vector2D';
import { AimAngle, PlayerKinematics, PlayerPosture } from '../core/player/PlayerKinematics';
import { RenderCorpseState } from '../core/entities/enemies/DeathCorpseManager';
import { WeaponType } from '../core/weapons/WeaponTypes';

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
  state: 'idle' | 'run' | 'jump' | 'crouch' | 'aim' | 'knife' | 'fire' | 'death' | 'parachute';
  aimAngle?: any;
  aimDirection?: Vector2D;
  weaponType?: WeaponType;
  animFrame?: number;
  isMelee?: boolean;
  isFiring?: boolean;
  isParachuting?: boolean;
  parachuteSwayAngle?: number;
  invulnerabilityTimer?: number;
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
  isParachuteActive?: boolean;
  parachuteSwayAngle?: number;
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
  weaponType: WeaponType;
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
  ultimateStock?: number;
  maxUltimateStock?: number;
  isContinueActive?: boolean;
  continueCountdown?: number;
  showTutorial?: boolean;
  tutorialAlpha?: number;
}

export interface RenderCinematicFXState {
  screenFlashAlpha?: number;     // 0.0 to 1.0
  screenFlashColor?: string;     // e.g. '#ffffff' or 'rgba(255, 120, 0, 0.7)'
  cameraShake?: {
    intensity: number;
    offsetX?: number;
    offsetY?: number;
  };
  bomber?: {
    x: number;
    y: number;
    shadowY?: number;
    progress?: number;
    dropBombs?: boolean;
  };
  shockwaves?: Array<{
    x: number;
    y: number;
    radius: number;
    maxRadius?: number;
    alpha?: number;
    color?: string;
  }>;
}

export interface RenderObstacleState {
  id: string;
  obstacleType: 'SANDBAG_BARRICADE' | 'SUPPLY_CRATE' | 'EXPLOSIVE_BARREL';
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
}

export interface RenderSceneState {
  time?: number;
  camera: Camera;
  platforms?: Platform[];
  obstacles?: RenderObstacleState[];
  player?: RenderPlayerState;
  enemies?: RenderEnemyState[];
  corpses?: RenderCorpseState[];
  boss?: RenderBossState;
  pows?: RenderPowState[];
  projectiles?: RenderProjectileState[];
  explosions?: RenderExplosionState[];
  hud?: RenderHUDState;
  cinematicFX?: RenderCinematicFXState;
}


export class CanvasRenderer {
  public static readonly VIRTUAL_WIDTH = 960;
  public static readonly VIRTUAL_HEIGHT = 540;

  // Off-screen virtual framebuffer buffer (960x540)
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

    // Pass 2.5: Destructible Obstacles
    if (scene.obstacles && scene.obstacles.length > 0) {
      this.renderObstaclesPass(scene.obstacles, cam);
    }

    // Pass 3: Entities (POWs, Boss, Enemies, Player)
    this.renderEntitiesPass(scene, cam, time);

    // Pass 3.5: Tactical Aiming Reticle / Crosshair
    if (scene.player && scene.player.state !== 'death') {
      this.renderCrosshairPass(scene.player, cam, time);
    }

    // Pass 4: Projectiles & Explosions
    this.renderProjectilesAndExplosionsPass(scene.projectiles ?? [], scene.explosions ?? [], cam, time);

    // Pass 4.5: Cinematic FX (Bomber flyover, shockwaves, screen flash, camera shake)
    if (scene.cinematicFX) {
      this.renderCinematicFXPass(scene.cinematicFX, cam, time);
    }

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
        const isBunkerOrWall = plat.id.includes('bunker') || plat.id.includes('wall') || plat.id.includes('redoubt');
        if (isBunkerOrWall) {
          // Military reinforced concrete bunker / blast wall
          ctx.fillStyle = '#4B5563'; // concrete slab top
          ctx.fillRect(sx, sy, w, Math.min(6, h));
          ctx.fillStyle = '#9CA3AF'; // bevel highlight
          ctx.fillRect(sx, sy, w, 2);

          if (h > 6) {
            ctx.fillStyle = '#374151'; // darker concrete facade
            ctx.fillRect(sx, sy + 6, w, h - 6);

            // Vertical armor panel seams every 24px
            ctx.fillStyle = '#1F2937';
            for (let px = sx + 20; px < sx + w - 4; px += 24) {
              ctx.fillRect(px, sy + 6, 2, h - 6);
              // Rivets on seams
              ctx.fillStyle = '#9CA3AF';
              ctx.fillRect(px - 1, sy + 8, 2, 2);
              if (h > 24) ctx.fillRect(px - 1, sy + 20, 2, 2);
              ctx.fillStyle = '#1F2937';
            }

            // Pillbox embrasure firing slit if bunker has sufficient width
            if (w >= 50 && h >= 20) {
              const slitX = sx + Math.floor(w / 2) - 16;
              const slitY = sy + 10;
              ctx.fillStyle = '#111827';
              ctx.fillRect(slitX, slitY, 32, 6);
              ctx.fillStyle = '#1F2937';
              ctx.fillRect(slitX + 2, slitY + 1, 28, 4);
              ctx.fillStyle = '#6B7280';
              ctx.fillRect(slitX - 2, slitY - 2, 36, 2);
            }
          }
        } else {
          // Ground terrain: multi-layered sand crest, strata, and rocky earth base
          // Capped at 42px depth to reveal tropical parallax background scenery beneath!
          const renderH = Math.min(h, 42);

          // Layer 1: Sunlit golden sand crest (0..5px)
          ctx.fillStyle = T[2];
          ctx.fillRect(sx, sy, w, Math.min(4, renderH));
          ctx.fillStyle = '#FFF3D0';
          for (let gx = sx + (Math.abs(plat.bounds.x) % 7); gx < sx + w; gx += 14) {
            ctx.fillRect(gx, sy, 2, 1);
          }

          // Layer 2: Dune / Sandstone strata (4..12px)
          if (renderH > 4) {
            ctx.fillStyle = T[3];
            ctx.fillRect(sx, sy + 4, w, Math.min(8, renderH - 4));
            ctx.fillStyle = '#C29B62';
            for (let gx = sx + 4; gx < sx + w; gx += 16) {
              ctx.fillRect(gx, sy + 6, 3, 2);
            }
          }

          // Layer 3: Compressed earth & rock strata (12..24px)
          if (renderH > 12) {
            ctx.fillStyle = T[4];
            ctx.fillRect(sx, sy + 12, w, Math.min(12, renderH - 12));
            ctx.fillStyle = '#3D2614';
            for (let rx = sx + 8; rx < sx + w; rx += 20) {
              ctx.fillRect(rx, sy + 16, 3, 2);
              ctx.fillRect(rx + 8, sy + 20, 2, 2);
            }
          }

          // Layer 4: Rocky shoreline base (24..42px)
          if (renderH > 24) {
            ctx.fillStyle = '#2D1B0D';
            ctx.fillRect(sx, sy + 24, w, renderH - 24);
            ctx.fillStyle = '#1A1612';
            for (let bx = sx; bx < sx + w; bx += 8) {
              const toothH = (bx % 3) + 1;
              ctx.fillRect(bx, sy + renderH - toothH, 6, toothH);
            }
          }
        }
      } else {
        // SEMI_SOLID: Wooden pier dock planks, high bridges, watchtowers, crane decks
        // 1. Deck top planks
        ctx.fillStyle = T[8];
        ctx.fillRect(sx, sy, w, Math.min(5, h));
        ctx.fillStyle = T[9];
        for (let bx = sx + 12; bx < sx + w; bx += 14) {
          ctx.fillRect(bx, sy, 1, Math.min(5, h));
        }

        // 2. Horizontal bearer beam underneath
        if (h > 5) {
          ctx.fillStyle = T[9];
          ctx.fillRect(sx, sy + 5, w, Math.min(6, h - 5));
          ctx.fillStyle = T[7];
          ctx.fillRect(sx + 2, sy + 5, 4, Math.min(6, h - 5));
          if (w > 20) {
            ctx.fillRect(sx + w - 6, sy + 5, 4, Math.min(6, h - 5));
          }
        }

        // 3. Timber Stilts / Pilings extending downwards
        const isTower = plat.id.includes('tower') || plat.id.includes('crane') || plat.id.includes('catwalk');
        const stiltHeight = isTower ? 90 : 54;

        for (let px = sx + 12; px < sx + w - 8; px += 36) {
          ctx.fillStyle = '#3D2614';
          ctx.fillRect(px, sy + h, 6, stiltHeight);
          ctx.fillStyle = '#7D5836';
          ctx.fillRect(px + 1, sy + h, 2, stiltHeight);
          ctx.fillStyle = '#9AA0AB';
          ctx.fillRect(px + 2, sy + h + 2, 2, 2);
        }

        // Diagonal cross bracing between pilings if wide enough
        if (w >= 70) {
          ctx.fillStyle = '#2A1A0D';
          ctx.fillRect(sx + 14, sy + h + 14, w - 28, 3);
          ctx.fillRect(sx + 14, sy + h + 32, w - 28, 3);
        }

        // 4. Watchtower ladder if tower platform
        if (isTower) {
          const ladderX = sx + 10;
          const ladderH = 80;
          ctx.fillStyle = '#4E331A';
          ctx.fillRect(ladderX, sy + h, 2, ladderH);
          ctx.fillRect(ladderX + 10, sy + h, 2, ladderH);
          ctx.fillStyle = '#A88850';
          for (let ry = sy + h + 6; ry < sy + h + ladderH - 4; ry += 8) {
            ctx.fillRect(ladderX + 2, ry, 8, 2);
          }
        }
      }
    }
  }

  // ==========================================
  // PASS 2.5: DESTRUCTIBLE OBSTACLES
  // ==========================================
  private renderObstaclesPass(obstacles: RenderObstacleState[], camera: Camera): void {
    const ctx = this.virtualCtx;

    for (const obs of obstacles) {
      if (!camera.isVisible({ x: obs.x, y: obs.y, width: obs.width, height: obs.height })) continue;

      const screenPos = camera.worldToScreen(obs.x, obs.y);
      const sx = Math.round(screenPos.x);
      const sy = Math.round(screenPos.y);
      const w = obs.width;
      const h = obs.height;

      switch (obs.obstacleType) {
        case 'SANDBAG_BARRICADE': {
          // Double-stacked burlap sandbags
          const bagH = Math.floor(h * 0.55);
          const bottomY = sy + h - bagH;

          // Bottom row
          ctx.fillStyle = '#8B8070';
          ctx.fillRect(sx, bottomY, w, bagH);
          ctx.fillStyle = '#A69B88';
          ctx.fillRect(sx + 1, bottomY + 1, w - 2, bagH - 2);
          ctx.fillStyle = '#C2B8A3';
          ctx.fillRect(sx + 2, bottomY + 1, w - 4, 2);

          // Top row (staggered)
          const topH = h - bagH + 1;
          const topW = w - 6;
          ctx.fillStyle = '#8B8070';
          ctx.fillRect(sx + 3, sy, topW, topH);
          ctx.fillStyle = '#B5AA96';
          ctx.fillRect(sx + 4, sy + 1, topW - 2, topH - 2);
          ctx.fillStyle = '#D6CCB8';
          ctx.fillRect(sx + 5, sy + 1, topW - 4, 2);

          // Rope ties & seams
          ctx.fillStyle = '#5A5244';
          ctx.fillRect(sx + Math.floor(w * 0.35), sy, 2, h);
          ctx.fillRect(sx + Math.floor(w * 0.7), bottomY, 2, bagH);
          break;
        }
        case 'SUPPLY_CRATE': {
          // Military supply crate
          ctx.fillStyle = '#5A3D1E';
          ctx.fillRect(sx, sy, w, h);
          ctx.fillStyle = '#8B6232';
          ctx.fillRect(sx + 1, sy + 1, w - 2, h - 2);
          ctx.fillStyle = '#A67C46';
          ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);

          // Diagonal / edge cross bracing
          ctx.fillStyle = '#5A3D1E';
          ctx.fillRect(sx + 2, sy + 2, 2, h - 4);
          ctx.fillRect(sx + w - 4, sy + 2, 2, h - 4);
          ctx.fillRect(sx + 2, sy + 2, w - 4, 2);
          ctx.fillRect(sx + 2, sy + h - 4, w - 4, 2);

          // Ammo stencil icon (gold diamond/star)
          ctx.fillStyle = '#FCE071';
          const cx = sx + Math.floor(w / 2);
          const cy = sy + Math.floor(h / 2);
          ctx.fillRect(cx - 2, cy - 2, 5, 5);
          ctx.fillStyle = '#FFF3B0';
          ctx.fillRect(cx - 1, cy - 1, 3, 3);
          break;
        }
        case 'EXPLOSIVE_BARREL': {
          // Red explosive fuel barrel
          ctx.fillStyle = '#881212';
          ctx.fillRect(sx, sy, w, h);
          ctx.fillStyle = '#D32F2F';
          ctx.fillRect(sx + 1, sy + 1, w - 2, h - 2);
          ctx.fillStyle = '#EF5350';
          ctx.fillRect(sx + 2, sy + 1, 3, h - 2);

          // Steel rims (top and bottom)
          ctx.fillStyle = '#374151';
          ctx.fillRect(sx, sy + 2, w, 2);
          ctx.fillRect(sx, sy + h - 4, w, 2);
          ctx.fillStyle = '#9CA3AF';
          ctx.fillRect(sx + 2, sy + 2, w - 4, 1);
          ctx.fillRect(sx + 2, sy + h - 4, w - 4, 1);

          // Hazard yellow caution band
          const bandY = sy + Math.floor(h / 2) - 2;
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(sx + 1, bandY, w - 2, 5);
          // Caution slashes
          ctx.fillStyle = '#111827';
          ctx.fillRect(sx + 3, bandY, 2, 5);
          ctx.fillRect(sx + 8, bandY, 2, 5);
          if (w > 12) ctx.fillRect(sx + 13, bandY, 2, 5);

          // Barrel cap
          ctx.fillStyle = '#1F2937';
          ctx.fillRect(sx + Math.floor(w / 2) - 2, sy - 1, 4, 2);
          break;
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
          if (enemy.state === 'PATROL' || enemy.state === 'WALK' || enemy.state === 'INGRESS') {
            const f = Math.floor(time * 6) % 4;
            sKey = `rebel_rifle_walk_${f}`;
          } else if (enemy.state === 'FIRE') {
            sKey = 'rebel_rifle_fire_0';
          }
          this.spriteFactory.drawSprite(ctx, sKey, screen.x, screen.y, { flipX: flip });
        }

        // Parachute Descent Rendering (Cords & Canopy)
        if (enemy.isParachuteActive || enemy.state === 'PARACHUTE_DESCENT') {
          const canopyY = screen.y - 56;
          const shoulderY = screen.y - 26;

          ctx.save();
          ctx.strokeStyle = '#4A5A38';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(screen.x, shoulderY);
          ctx.lineTo(screen.x - 18, canopyY);
          ctx.moveTo(screen.x, shoulderY);
          ctx.lineTo(screen.x - 7, canopyY);
          ctx.moveTo(screen.x, shoulderY);
          ctx.lineTo(screen.x + 7, canopyY);
          ctx.moveTo(screen.x, shoulderY);
          ctx.lineTo(screen.x + 18, canopyY);
          ctx.stroke();
          ctx.restore();

          const tilt = enemy.parachuteSwayAngle ?? 0;
          this.spriteFactory.drawSprite(ctx, 'parachute_canopy', screen.x, canopyY, {
            rotation: tilt,
          });
        }

      }
    }

    // 3.5. Render Decoupled Corpses & Casualty Animations (R2)
    if (scene.corpses && scene.corpses.length > 0) {
      for (const corpse of scene.corpses) {
        const screen = camera.worldToScreen(corpse.x, corpse.y);
        const flip = corpse.facing === -1;
        const alpha = corpse.alpha !== undefined ? corpse.alpha : 1.0;

        if (corpse.deathType === 'explosion') {
          if (!corpse.isGrounded) {
            // Mid-air tumbling soldier
            this.spriteFactory.drawSprite(ctx, 'rebel_death_explosion_air', screen.x, screen.y, {
              rotation: corpse.rotation,
              flipX: flip,
              alpha,
            });
            // Flying detached helmet
            if (corpse.helmet) {
              const hScreen = camera.worldToScreen(corpse.helmet.x, corpse.helmet.y);
              this.spriteFactory.drawSprite(ctx, 'rebel_death_explosion_helmet', hScreen.x, hScreen.y, {
                rotation: corpse.helmet.rotation,
                alpha,
              });
            }
          } else {
            const landKey = corpse.frame === 0 ? 'rebel_death_explosion_land_0' : 'rebel_death_explosion_land_1';
            this.spriteFactory.drawSprite(ctx, landKey, screen.x, screen.y, {
              flipX: flip,
              alpha,
            });
          }
        } else if (corpse.deathType === 'fire') {
          let burnKey = 'rebel_death_burn_thrash_0';
          if (corpse.stage === 'thrash') {
            burnKey = corpse.frame % 2 === 0 ? 'rebel_death_burn_thrash_0' : 'rebel_death_burn_thrash_1';
          } else if (corpse.stage === 'charcoal') {
            burnKey = 'rebel_death_burn_charcoal_0';
          } else {
            burnKey = corpse.frame === 0 ? 'rebel_death_burn_ash_0' : 'rebel_death_burn_ash_1';
          }
          this.spriteFactory.drawSprite(ctx, burnKey, screen.x, screen.y, {
            flipX: flip,
            alpha,
          });
        } else {
          // Standard falling death
          const f = Math.min(3, Math.max(0, corpse.frame ?? 0));
          this.spriteFactory.drawSprite(ctx, `rebel_death_standard_${f}`, screen.x, screen.y, {
            flipX: flip,
            alpha,
          });
        }

        // Render corpse particles (flames, smoke, impact dust)
        if (corpse.particles && corpse.particles.length > 0) {
          for (const p of corpse.particles) {
            const pScreen = camera.worldToScreen(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillRect(pScreen.x, pScreen.y, p.size, p.size);
          }
        }
      }
    }

    // 4. Render Player (Marco Rossi)
    if (scene.player) {
      const p = scene.player;
      const screen = camera.worldToScreen(p.x, p.y);
      const flip = p.facing === -1;

      // Parachute canopy & suspension lines pass during parachute descent
      if (p.isParachuting || p.state === 'parachute') {
        const canopyY = screen.y - 56;
        const shoulderY = screen.y - 24;

        ctx.save();
        ctx.strokeStyle = '#D4C4A8'; // Parachute suspension cords
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screen.x - 3, shoulderY);
        ctx.lineTo(screen.x - 18, canopyY);
        ctx.moveTo(screen.x - 1, shoulderY);
        ctx.lineTo(screen.x - 7, canopyY);
        ctx.moveTo(screen.x + 1, shoulderY);
        ctx.lineTo(screen.x + 7, canopyY);
        ctx.moveTo(screen.x + 3, shoulderY);
        ctx.lineTo(screen.x + 18, canopyY);
        ctx.stroke();
        ctx.restore();

        const tilt = p.parachuteSwayAngle ?? 0;
        this.spriteFactory.drawSprite(ctx, 'parachute_canopy', screen.x, canopyY, {
          rotation: tilt,
        });
      }

      // Invulnerability flashing (e.g. 2.5s upon landing or hit stun)
      let alpha = 1.0;
      if (p.invulnerabilityTimer !== undefined && p.invulnerabilityTimer > 0) {
        alpha = Math.floor(time * 16) % 2 === 0 ? 0.35 : 1.0;
      }

      const spriteKey = this.resolvePlayerSpriteKey(p, time);
      this.spriteFactory.drawSprite(ctx, spriteKey, screen.x, screen.y, {
        flipX: flip,
        alpha,
      });
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

  // ==========================================
  // PASS 3.5: TACTICAL AIMING RETICLE / CROSSHAIR
  // ==========================================

  /**
   * Resolves an arbitrary aimAngle (enum, string, or legacy number) into a standard AimAngle enum.
   */
  public resolveAimAngleEnum(aimAngle?: any): AimAngle {
    if (aimAngle === undefined || aimAngle === null) return AimAngle.FORWARD;
    if (typeof aimAngle === 'string') {
      const u = aimAngle.toUpperCase();
      if (u.includes('UP_FORWARD') || u === 'UPFORWARD' || u === 'UP_RIGHT' || u === 'UP_LEFT') return AimAngle.UP_FORWARD;
      if (u.includes('DOWN_FORWARD') || u === 'DOWNFORWARD' || u === 'DOWN_RIGHT' || u === 'DOWN_LEFT') return AimAngle.DOWN_FORWARD;
      if (u === 'UP') return AimAngle.UP;
      if (u === 'DOWN') return AimAngle.DOWN;
      return AimAngle.FORWARD;
    }
    if (typeof aimAngle === 'number') {
      // 0..7 mapping: 0=forward, 1=up-forward, 2=up, 3=up-forward (back), 4=forward (back), 5=down-forward (back), 6=down, 7=down-forward
      if (aimAngle === 1 || aimAngle === 3) return AimAngle.UP_FORWARD;
      if (aimAngle === 2) return AimAngle.UP;
      if (aimAngle === 6) return AimAngle.DOWN;
      if (aimAngle === 7 || aimAngle === 5) return AimAngle.DOWN_FORWARD;
      return AimAngle.FORWARD;
    }
    return AimAngle.FORWARD;
  }

  /**
   * Selects high-resolution composite directional player sprites pre-baked by ProceduralSpriteFactory,
   * with graceful fallbacks to base locomotion or legacy player_aim_${aimAngle} keys.
   */
  public resolvePlayerSpriteKey(p: RenderPlayerState, time: number): string {
    if (p.state === 'death') {
      const d = p.animFrame !== undefined ? Math.min(3, Math.max(0, p.animFrame)) : 2;
      return `player_death_${d}`;
    }
    if (p.state === 'parachute') {
      return 'player_jump_rise';
    }
    if (p.state === 'knife' || p.isMelee) {
      const k = p.animFrame !== undefined ? Math.min(2, p.animFrame) : 1;
      return `player_knife_${k}`;
    }

    const angleEnum = this.resolveAimAngleEnum(p.aimAngle);
    const aimName = angleEnum.toString();

    // 1. Crouch State (grounded crouch)
    if (p.state === 'crouch') {
      const candidate = `player_crouch_aim_${aimName}`;
      if (this.spriteFactory.hasSprite(candidate)) return candidate;
      if (this.spriteFactory.hasSprite('player_crouch_aim_FORWARD')) return 'player_crouch_aim_FORWARD';
      return 'player_crouch_idle';
    }

    // 2. Jump State (airborne directional aiming)
    if (p.state === 'jump') {
      const candidate = `player_jump_aim_${aimName}`;
      if (this.spriteFactory.hasSprite(candidate)) return candidate;
      if (p.animFrame === 1 && this.spriteFactory.hasSprite('player_jump_fall')) {
        return 'player_jump_fall';
      }
      return 'player_jump_rise';
    }

    // 3. Run State (running with directional aiming)
    if (p.state === 'run') {
      const f = p.animFrame !== undefined ? p.animFrame % 6 : Math.floor(time * 12) % 6;
      const candidate = `player_run_aim_${aimName}_${f}`;
      if (this.spriteFactory.hasSprite(candidate)) return candidate;
      const baseRun = `player_run_${f}`;
      if (this.spriteFactory.hasSprite(baseRun)) return baseRun;
    }

    // 4. Aim State (explicit aiming stance)
    if (p.state === 'aim') {
      const candidate = `player_idle_aim_${aimName}_0`;
      if (this.spriteFactory.hasSprite(candidate)) return candidate;
      const legacyKey = `player_aim_${p.aimAngle ?? 0}`;
      if (this.spriteFactory.hasSprite(legacyKey)) return legacyKey;
    }

    // 5. Fire State
    if (p.state === 'fire') {
      const candidate = `player_idle_aim_${aimName}_0`;
      if (this.spriteFactory.hasSprite(candidate)) return candidate;
      return 'player_fire_0';
    }

    // 6. Idle State (standing with directional aiming)
    const f = p.animFrame !== undefined ? p.animFrame % 4 : Math.floor(time * 4) % 4;
    const candidate = `player_idle_aim_${aimName}_${f}`;
    if (this.spriteFactory.hasSprite(candidate)) return candidate;
    const baseIdle = `player_idle_${f}`;
    if (this.spriteFactory.hasSprite(baseIdle)) return baseIdle;

    // Graceful fallback to player_aim_${aimAngle} or base locomotion sprite
    if (p.aimAngle !== undefined) {
      const legacyKey = `player_aim_${p.aimAngle}`;
      if (this.spriteFactory.hasSprite(legacyKey)) return legacyKey;
    }
    return 'player_idle_0';
  }

  /**
   * Computes mathematical projection of muzzle origin, unit aim vector, tactical distance,
   * and world reticle coordinates for the player crosshair.
   */
  public calculateCrosshairGeometry(p: RenderPlayerState, time: number = 0): {
    muzzle: Vector2D;
    aimDir: Vector2D;
    worldReticle: Vector2D;
    distance: number;
    weaponType: WeaponType;
  } {
    let posture = PlayerPosture.STANDING;
    if (p.state === 'crouch') {
      posture = PlayerPosture.CROUCHING;
    } else if (p.state === 'jump') {
      posture = PlayerPosture.AIRBORNE;
    }

    const angleEnum = this.resolveAimAngleEnum(p.aimAngle);
    const muzzle = PlayerKinematics.getMuzzlePosition(p.x, p.y, p.facing, posture, angleEnum);

    let dirX = p.aimDirection ? p.aimDirection.x : 0;
    let dirY = p.aimDirection ? p.aimDirection.y : 0;
    const len = Math.hypot(dirX, dirY);

    if (len > 0.0001) {
      dirX /= len;
      dirY /= len;
    } else {
      if (angleEnum === AimAngle.UP) {
        dirX = 0;
        dirY = -1;
      } else if (angleEnum === AimAngle.DOWN) {
        dirX = 0;
        dirY = 1;
      } else if (angleEnum === AimAngle.UP_FORWARD) {
        dirX = p.facing * Math.SQRT1_2;
        dirY = -Math.SQRT1_2;
      } else if (angleEnum === AimAngle.DOWN_FORWARD) {
        dirX = p.facing * Math.SQRT1_2;
        dirY = Math.SQRT1_2;
      } else {
        dirX = p.facing;
        dirY = 0;
      }
    }

    const weaponType = p.weaponType ?? 'PISTOL';
    let baseDistance = 44;
    if (weaponType === 'HEAVY_MACHINE_GUN') {
      baseDistance = 48;
    } else if (weaponType === 'FLAME_SHOT') {
      baseDistance = 52;
    }

    // Subtle breathing / flame surge pulse
    const distPulse = weaponType === 'FLAME_SHOT'
      ? Math.sin(time * 18) * 2.0
      : (weaponType === 'PISTOL' ? Math.sin(time * 4) * 1.5 : 0);
    const distance = baseDistance + distPulse;

    const worldReticle = vec2(muzzle.x + dirX * distance, muzzle.y + dirY * distance);
    const aimDir = vec2(dirX, dirY);

    return { muzzle, aimDir, worldReticle, distance, weaponType };
  }

  /**
   * Pass 3.5: Renders weapon-specific tactical crosshairs projected along the aim vector.
   * Handles facing left/right and vertical aiming seamlessly.
   */
  private renderCrosshairPass(p: RenderPlayerState, camera: Camera, time: number): void {
    const geom = this.calculateCrosshairGeometry(p, time);
    const screenMuzzle = camera.worldToScreen(geom.muzzle.x, geom.muzzle.y);
    const screenReticle = camera.worldToScreen(geom.worldReticle.x, geom.worldReticle.y);

    const mx = Math.round(screenMuzzle.x);
    const my = Math.round(screenMuzzle.y);
    const rx = Math.round(screenReticle.x);
    const ry = Math.round(screenReticle.y);

    const ctx = this.virtualCtx;

    switch (geom.weaponType) {
      case 'HEAVY_MACHINE_GUN':
        this.drawHmgCrosshair(ctx, rx, ry, mx, my, geom.aimDir, time, p.isFiring ?? false);
        break;
      case 'FLAME_SHOT':
        this.drawFlameCrosshair(ctx, rx, ry, mx, my, geom.aimDir, time);
        break;
      case 'PISTOL':
      default:
        this.drawPistolCrosshair(ctx, rx, ry, mx, my, time);
        break;
    }
  }

  /**
   * Pistol Reticle: Precision laser targeting pip, 4 corner brackets, and faint tracer line.
   */
  private drawPistolCrosshair(
    ctx: CanvasContext2DLike,
    rx: number,
    ry: number,
    mx: number,
    my: number,
    _time: number
  ): void {
    ctx.save();

    // 1. Faint dashed laser tracer line from muzzle to crosshair
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
    ctx.lineWidth = 1;
    if (typeof (ctx as any).setLineDash === 'function') {
      (ctx as any).setLineDash([2, 3]);
    }
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    if (typeof (ctx as any).setLineDash === 'function') {
      (ctx as any).setLineDash([]);
    }

    // 2. 4 Corner brackets (L-shaped) framing the crosshair (radius 6px)
    ctx.strokeStyle = '#2ECC71';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Top-Left corner
    ctx.moveTo(rx - 6, ry - 3);
    ctx.lineTo(rx - 6, ry - 6);
    ctx.lineTo(rx - 3, ry - 6);
    // Top-Right corner
    ctx.moveTo(rx + 3, ry - 6);
    ctx.lineTo(rx + 6, ry - 6);
    ctx.lineTo(rx + 6, ry - 3);
    // Bottom-Left corner
    ctx.moveTo(rx - 6, ry + 3);
    ctx.lineTo(rx - 6, ry + 6);
    ctx.lineTo(rx - 3, ry + 6);
    // Bottom-Right corner
    ctx.moveTo(rx + 3, ry + 6);
    ctx.lineTo(rx + 6, ry + 6);
    ctx.lineTo(rx + 6, ry + 3);
    ctx.stroke();

    // 3. Central bright green laser dot with white core
    ctx.fillStyle = '#2ECC71';
    ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 0.5, ry - 0.5, 1, 1);

    ctx.restore();
  }

  /**
   * Heavy Machine Gun Reticle: Tactical circular ring with 4 cardinal ticks,
   * bullet spread pips along normal axis, and spread cone boundary lines.
   */
  private drawHmgCrosshair(
    ctx: CanvasContext2DLike,
    rx: number,
    ry: number,
    mx: number,
    my: number,
    aimDir: Vector2D,
    _time: number,
    isFiring: boolean
  ): void {
    ctx.save();

    const baseRadius = 8;
    const ringRadius = isFiring ? baseRadius + 2.5 : baseRadius;

    // Normal vector perpendicular to aim direction: (-dy, dx)
    const nx = -aimDir.y;
    const ny = aimDir.x;

    // 1. Dual faint trajectory spread cone lines from muzzle to spread pips
    const spreadDistance = ringRadius + 4;
    const pip1X = Math.round(rx + nx * spreadDistance);
    const pip1Y = Math.round(ry + ny * spreadDistance);
    const pip2X = Math.round(rx - nx * spreadDistance);
    const pip2Y = Math.round(ry - ny * spreadDistance);

    ctx.strokeStyle = 'rgba(241, 196, 15, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(pip1X, pip1Y);
    ctx.moveTo(mx, my);
    ctx.lineTo(pip2X, pip2Y);
    ctx.stroke();

    // 2. Tactical circular ring
    ctx.strokeStyle = '#F1C40F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 4 Cardinal tick marks extending outward 3px
    ctx.beginPath();
    ctx.moveTo(rx, ry - ringRadius - 3);
    ctx.lineTo(rx, ry - ringRadius);
    ctx.moveTo(rx, ry + ringRadius);
    ctx.lineTo(rx, ry + ringRadius + 3);
    ctx.moveTo(rx - ringRadius - 3, ry);
    ctx.lineTo(rx - ringRadius, ry);
    ctx.moveTo(rx + ringRadius, ry);
    ctx.lineTo(rx + ringRadius + 3, ry);
    ctx.stroke();

    // 4. Bullet spread pips
    ctx.fillStyle = '#FFAA00';
    ctx.fillRect(pip1X - 1, pip1Y - 1, 2, 2);
    ctx.fillRect(pip2X - 1, pip2Y - 1, 2, 2);

    // 5. Center targeting pip
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 1, ry - 1, 2, 2);

    ctx.restore();
  }

  /**
   * Flame Shot Reticle: Tapered incendiary arc and cone indicator with
   * swept fireball arcs, flame flicker waves, and hazard diamond.
   */
  private drawFlameCrosshair(
    ctx: CanvasContext2DLike,
    rx: number,
    ry: number,
    mx: number,
    my: number,
    aimDir: Vector2D,
    _time: number
  ): void {
    ctx.save();

    const aimAngleRad = Math.atan2(aimDir.y, aimDir.x);
    const halfSpread = (24 * Math.PI) / 180; // ~24 degrees half-angle
    const dFlame = Math.max(12, Math.hypot(rx - mx, ry - my));

    // 1. Radiating incendiary cone rays from muzzle to outer arc endpoints
    const end1X = mx + dFlame * Math.cos(aimAngleRad - halfSpread);
    const end1Y = my + dFlame * Math.sin(aimAngleRad - halfSpread);
    const end2X = mx + dFlame * Math.cos(aimAngleRad + halfSpread);
    const end2Y = my + dFlame * Math.sin(aimAngleRad + halfSpread);

    ctx.strokeStyle = 'rgba(232, 72, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(end1X, end1Y);
    ctx.moveTo(mx, my);
    ctx.lineTo(end2X, end2Y);
    ctx.stroke();

    // 2. Swept impact arcs (concentric pressure waves)
    // Outer arc (Red-orange)
    ctx.strokeStyle = '#E84800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, dFlame, aimAngleRad - halfSpread, aimAngleRad + halfSpread);
    ctx.stroke();

    // Mid heat arc (Golden Amber)
    const midD = Math.max(8, dFlame - 6);
    ctx.strokeStyle = '#FFA010';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, midD, aimAngleRad - halfSpread * 0.8, aimAngleRad + halfSpread * 0.8);
    ctx.stroke();

    // Core heat arc (Bright Yellow)
    const coreD = Math.max(4, dFlame - 12);
    ctx.strokeStyle = '#FFF060';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, coreD, aimAngleRad - halfSpread * 0.6, aimAngleRad + halfSpread * 0.6);
    ctx.stroke();

    // 3. Central incendiary diamond marker at reticle point
    ctx.fillStyle = '#FFF060';
    ctx.beginPath();
    ctx.moveTo(rx, ry - 3);
    ctx.lineTo(rx + 3, ry);
    ctx.lineTo(rx, ry + 3);
    ctx.lineTo(rx - 3, ry);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#E84800';
    ctx.fillRect(rx - 1, ry - 1, 2, 2);

    ctx.restore();
  }

  /**
   * Pass 4.5: Cinematic FX (Tactical Bomber Flyover & Shadow, Expanding Shockwaves, Screen Flash, Detonation Shake).
   */
  public renderCinematicFXPass(fx: RenderCinematicFXState, cam: Camera, time: number): void {
    const ctx = this.virtualCtx;

    // 1. Camera Shake Jitter
    if (fx.cameraShake && fx.cameraShake.intensity > 0) {
      const shakeX = fx.cameraShake.offsetX ?? Math.sin(time * 60) * fx.cameraShake.intensity;
      const shakeY = fx.cameraShake.offsetY ?? Math.cos(time * 50) * fx.cameraShake.intensity;
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // 2. Tactical Bomber Aircraft & Ground Shadow
    if (fx.bomber) {
      const screenX = fx.bomber.x - cam.renderX;
      const screenY = fx.bomber.y;
      const shadowY = fx.bomber.shadowY ?? 226;

      // Ground shadow
      if (this.spriteFactory.hasSprite('tactical_bomber_shadow')) {
        this.spriteFactory.drawSprite(ctx, 'tactical_bomber_shadow', screenX, shadowY);
      } else {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.45)';
        ctx.fillRect(screenX - 24, shadowY - 4, 48, 8);
      }

      // Bomber aircraft
      if (this.spriteFactory.hasSprite('tactical_bomber')) {
        this.spriteFactory.drawSprite(ctx, 'tactical_bomber', screenX, screenY);
      } else {
        ctx.fillStyle = '#485848';
        ctx.fillRect(screenX - 32, screenY - 8, 64, 16);
      }

      // Dropped bombs
      if (fx.bomber.dropBombs && this.spriteFactory.hasSprite('air_bomb_falling_0')) {
        this.spriteFactory.drawSprite(ctx, 'air_bomb_falling_0', screenX - 16, screenY + 16);
      }
    }

    // 3. Expanding Shockwave Rings
    if (fx.shockwaves && fx.shockwaves.length > 0) {
      for (const wave of fx.shockwaves) {
        const waveScreenX = wave.x - cam.renderX;
        const waveScreenY = wave.y;
        const alpha = wave.alpha ?? 1.0;
        const radius = Math.max(1, wave.radius);

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        // Outer glow arc
        ctx.strokeStyle = wave.color ?? '#ffaa33';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(waveScreenX, waveScreenY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // High-intensity white inner ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(waveScreenX, waveScreenY, Math.max(1, radius * 0.85), 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 4. Apocalyptic Screen Flash (White / Orange Full-Screen Alpha Overlay)
    if (fx.screenFlashAlpha && fx.screenFlashAlpha > 0.001) {
      const alpha = Math.min(1.0, Math.max(0.0, fx.screenFlashAlpha));
      ctx.save();
      ctx.fillStyle = fx.screenFlashColor ?? `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
      ctx.restore();
    }

    if (fx.cameraShake && fx.cameraShake.intensity > 0) {
      ctx.restore();
    }
  }

  /**
   * Advances renderer internal timer.
   */
  public update(dt: number): void {
    this.elapsedTime += dt;
  }
}
