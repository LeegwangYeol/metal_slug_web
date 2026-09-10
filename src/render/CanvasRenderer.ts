/**
 * High-Performance HTML5 2D Canvas Renderer.
 * - Virtual 960x540 letterbox scaling with nearest-neighbor crisp pixel rendering.
 * - Render Passes: Background Parallax -> Terrain/Platforms -> Entities -> Projectiles & Explosions -> Retro Arcade HUD.
 */

import { Platform } from '../core/physics/Platform';
import { Camera } from './Camera';
import { ParallaxBackground } from './ParallaxBackground';
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
import {
  RenderBubbleState,
  RenderPetState,
  RenderAltarState,
  RenderPickupState,
  RenderFeverState,
  RenderPerkCardState,
  CuteEnemyState,
} from '../core/cute/CuteGameTypes';

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
  cuteFever?: RenderFeverState;
  cutePerks?: {
    active: boolean;
    cards: RenderPerkCardState[];
    selectedIndex?: number;
  };
  cuteAltars?: RenderAltarState[];
  cuteLoopState?: string;
  bannerText?: string;
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
  cuteBubbles?: RenderBubbleState[];
  cutePet?: RenderPetState;
  cuteAltars?: RenderAltarState[];
  cutePickups?: RenderPickupState[];
  cuteEnemies?: CuteEnemyState[];
  cuteOrbiters?: Array<{ angle: number; radius: number }>;
  cuteTrails?: Array<{ x: number; y: number; age: number; maxAge: number; color: string }>;
}

export interface ScorePopup {
  text: string;
  x: number;
  y: number;
  startY: number;
  time: number;
  duration: number;
  color?: string;
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

  // Floating score popups
  private scorePopups: ScorePopup[] = [];
  private lastScore: number = 0;

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
   * Clears virtual framebuffer with deep dark cute plum background.
   */
  public clear(): void {
    this.virtualCtx.fillStyle = '#1E162B';
    this.virtualCtx.fillRect(0, 0, CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
  }

  /**
   * Main render execution: processes all passes into the virtual buffer.
   */
  public renderScene(scene: RenderSceneState): void {
    const time = scene.time ?? this.elapsedTime;
    const cam = scene.camera;
    const dt = 0.016;

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

    // Pass 2.8: Cute Blossom Altars
    if (scene.cuteAltars && scene.cuteAltars.length > 0) {
      this.renderCuteAltarsPass(scene.cuteAltars, cam, time);
    }

    // Pass 2.9: Cute Pickups (Candies, Stars)
    if (scene.cutePickups && scene.cutePickups.length > 0) {
      this.renderCutePickupsPass(scene.cutePickups, cam, time);
    }

    // Pass 3: Entities (POWs, Boss, Enemies, Player)
    this.renderEntitiesPass(scene, cam, time);

    // Pass 3.1: Cute Living Enemies (Slimes, Bees, Donut Rollers, Gummy Colossus, Cubs)
    if (scene.cuteEnemies && scene.cuteEnemies.length > 0) {
      this.renderCuteEnemiesPass(scene.cuteEnemies, cam, time);
    }

    // Pass 3.2: Cute Pet Companion ("Mochi the Cloud Bunny")
    if (scene.cutePet) {
      this.renderCutePetPass(scene.cutePet, cam, time);
    }

    // Pass 3.3: Cute Bubbles (Trapped & Free)
    if (scene.cuteBubbles && scene.cuteBubbles.length > 0) {
      this.renderCuteBubblesPass(scene.cuteBubbles, cam, time);
    }

    // Pass 3.4: Orbiting Bubbles & Sugar Trails
    if (scene.cuteOrbiters || scene.cuteTrails) {
      this.renderCutePerkVisualsPass(scene, cam, time);
    }

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

    // Pass 4.8: Bouncy Floating Score Popups
    this.renderScorePopupsPass(dt);

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
  // PASS 2: TERRAIN & PLATFORMS (CONFECTIONERY)
  // ==========================================
  private renderPlatformsPass(platforms: Platform[], camera: Camera): void {
    const ctx = this.virtualCtx;

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
          // Gingerbread cookie bunker / frosted candy barrier
          ctx.fillStyle = '#8D5B4C'; // warm gingerbread
          ctx.fillRect(sx, sy, w, h);

          // Frosted royal icing top border
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx, sy, w, Math.min(4, h));
          // Scalloped icing drops
          for (let ix = sx + 4; ix < sx + w - 2; ix += 10) {
            ctx.beginPath();
            ctx.arc(ix, sy + Math.min(4, h), 3, 0, Math.PI);
            ctx.fill();
          }

          // Candy sprinkles & sugar pearl buttons
          const candyHues = ['#FB7185', '#38BDF8', '#FDE047', '#4ADE80'];
          for (let px = sx + 14; px < sx + w - 6; px += 18) {
            ctx.fillStyle = candyHues[(px >> 4) % candyHues.length];
            ctx.fillRect(px, sy + 7, 4, 3);
          }

          // Archway cookie embrasure if wide enough
          if (w >= 50 && h >= 20) {
            const slitX = sx + Math.floor(w / 2) - 16;
            const slitY = sy + 10;
            ctx.fillStyle = '#4A2E50';
            ctx.fillRect(slitX, slitY, 32, 6);
            ctx.fillStyle = '#FDE047';
            ctx.fillRect(slitX + 2, slitY + 1, 28, 4);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(slitX - 2, slitY - 2, 36, 2);
          }
        } else {
          // Ground terrain: Shortcake Strata!
          // Capped at 42px depth to reveal tropical parallax background scenery beneath!
          const renderH = Math.min(h, 42);

          // Layer 1: Strawberry jelly glaze crest with white sugar crystal sprinkles (0..4px)
          ctx.fillStyle = '#FB7185';
          ctx.fillRect(sx, sy, w, Math.min(4, renderH));
          ctx.fillStyle = '#FFFFFF';
          for (let gx = sx + (Math.abs(plat.bounds.x) % 7); gx < sx + w; gx += 12) {
            ctx.fillRect(gx, sy + 1, 2, 1);
            ctx.fillRect(gx + 4, sy + 2, 1, 1);
          }

          // Layer 2: Whipped vanilla marshmallow cream filling layer (4..12px)
          if (renderH > 4) {
            ctx.fillStyle = '#FFF7ED';
            ctx.fillRect(sx, sy + 4, w, Math.min(8, renderH - 4));
            ctx.fillStyle = '#FFFFFF';
            for (let cx = sx + 4; cx < sx + w; cx += 14) {
              ctx.beginPath();
              ctx.arc(cx, sy + 7, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Layer 3: Fluffy golden sponge cake layer (12..24px)
          if (renderH > 12) {
            ctx.fillStyle = '#FED7AA';
            ctx.fillRect(sx, sy + 12, w, Math.min(12, renderH - 12));
            ctx.fillStyle = '#FB923C';
            for (let rx = sx + 6; rx < sx + w; rx += 16) {
              ctx.fillRect(rx, sy + 15, 3, 2);
            }
          }

          // Layer 4: Crunchy chocolate biscuit crumb base (24..42px)
          if (renderH > 24) {
            ctx.fillStyle = '#7C4A2D';
            ctx.fillRect(sx, sy + 24, w, renderH - 24);
            ctx.fillStyle = '#4A2E50';
            for (let bx = sx; bx < sx + w; bx += 8) {
              const toothH = (bx % 3) + 1;
              ctx.fillRect(bx, sy + renderH - toothH, 6, toothH);
            }
          }
        }
      } else {
        // SEMI_SOLID: Crispy baked wafer biscuit platforms with candy cane stilts!
        // 1. Crispy golden wafer deck
        ctx.fillStyle = '#FED7AA';
        ctx.fillRect(sx, sy, w, Math.min(5, h));
        // Waffle diamond grid accent
        ctx.fillStyle = '#FB923C';
        for (let bx = sx + 10; bx < sx + w; bx += 12) {
          ctx.fillRect(bx, sy, 2, Math.min(5, h));
        }
        // Scalloped sugar frosting drips on edge
        ctx.fillStyle = '#FFFFFF';
        for (let fx = sx + 4; fx < sx + w; fx += 10) {
          ctx.beginPath();
          ctx.arc(fx, sy + Math.min(5, h), 2.5, 0, Math.PI);
          ctx.fill();
        }

        // 2. Horizontal chocolate wafer support beam underneath
        if (h > 5) {
          ctx.fillStyle = '#7C4A2D';
          ctx.fillRect(sx, sy + 5, w, Math.min(6, h - 5));
          ctx.fillStyle = '#A0633C';
          ctx.fillRect(sx, sy + 6, w, 2);
        }

        // 3. Striped Peppermint Candy Cane Stilts
        const isTower = plat.id.includes('tower') || plat.id.includes('crane') || plat.id.includes('catwalk');
        const stiltHeight = isTower ? 90 : 54;

        for (let px = sx + 12; px < sx + w - 8; px += 36) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px, sy + h, 6, stiltHeight);
          // Red candy cane diagonal stripes
          ctx.fillStyle = '#FB7185';
          for (let py = sy + h + 2; py < sy + h + stiltHeight; py += 8) {
            ctx.fillRect(px, py, 6, 3);
          }
        }

        // Diagonal licorice cross-bracing
        if (w >= 70) {
          ctx.fillStyle = '#4A2E50';
          ctx.fillRect(sx + 14, sy + h + 14, w - 28, 2);
          ctx.fillRect(sx + 14, sy + h + 32, w - 28, 2);
        }

        // 4. Candy Rope Ladder if tower
        if (isTower) {
          const ladderX = sx + 10;
          const ladderH = 80;
          ctx.fillStyle = '#FDE047'; // golden sugar rope
          ctx.fillRect(ladderX, sy + h, 2, ladderH);
          ctx.fillRect(ladderX + 10, sy + h, 2, ladderH);
          ctx.fillStyle = '#F472B6'; // pink candy rungs
          for (let ry = sy + h + 6; ry < sy + h + ladderH - 4; ry += 8) {
            ctx.fillRect(ladderX + 2, ry, 8, 2);
          }
        }
      }
    }
  }

  // ==========================================
  // PASS 2.5: DESTRUCTIBLE OBSTACLES (WHIMSICAL)
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
          // Stacked marshmallow cushions!
          const bagH = Math.floor(h * 0.55);
          const bottomY = sy + h - bagH;

          // Bottom marshmallow row (Soft pastel mint #A7F3D0)
          ctx.fillStyle = '#6EE7B7';
          ctx.fillRect(sx, bottomY, w, bagH);
          ctx.fillStyle = '#A7F3D0';
          ctx.fillRect(sx + 1, bottomY + 1, w - 2, bagH - 2);
          ctx.fillStyle = '#E0F2FE';
          ctx.fillRect(sx + 2, bottomY + 1, w - 4, 2);

          // Top marshmallow row (Soft pastel pink #FBCFE8)
          const topH = h - bagH + 1;
          const topW = w - 6;
          ctx.fillStyle = '#F472B6';
          ctx.fillRect(sx + 3, sy, topW, topH);
          ctx.fillStyle = '#FBCFE8';
          ctx.fillRect(sx + 4, sy + 1, topW - 2, topH - 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx + 5, sy + 1, topW - 4, 2);

          // Golden honey satin ribbon tie
          ctx.fillStyle = '#FDE047';
          ctx.fillRect(sx + Math.floor(w * 0.4), sy, 3, h);
          break;
        }
        case 'SUPPLY_CRATE': {
          // Whimsical Gift Box Crate with Satin Ribbon & Bow!
          ctx.fillStyle = '#B388D6';
          ctx.fillRect(sx, sy, w, h);
          ctx.fillStyle = '#D8B4E2';
          ctx.fillRect(sx + 1, sy + 1, w - 2, h - 2);
          ctx.fillStyle = '#F3E8FF';
          ctx.fillRect(sx + 2, sy + 2, w - 4, 2);

          // Bright lemon-gold satin ribbon (horizontal & vertical)
          ctx.fillStyle = '#FDE047';
          const midX = sx + Math.floor(w / 2) - 2;
          const midY = sy + Math.floor(h / 2) - 2;
          ctx.fillRect(midX, sy, 4, h);
          ctx.fillRect(sx, midY, w, 4);

          // Cute ribbon bow on top
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(midX, sy - 1, 3, 0, Math.PI * 2);
          ctx.arc(midX + 4, sy - 1, 3, 0, Math.PI * 2);
          ctx.fill();

          // Star gift tag
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(midX + 1, midY + 1, 2, 2);
          break;
        }
        case 'EXPLOSIVE_BARREL': {
          // Fruity Soda Pop Can / Strawberry Fizz Barrel
          ctx.fillStyle = '#DB2777';
          ctx.fillRect(sx, sy, w, h);
          ctx.fillStyle = '#FB7185';
          ctx.fillRect(sx + 1, sy + 1, w - 2, h - 2);
          ctx.fillStyle = '#FDA4AF';
          ctx.fillRect(sx + 2, sy + 1, 3, h - 2);

          // Shiny metallic rims
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx, sy + 1, w, 2);
          ctx.fillRect(sx, sy + h - 3, w, 2);

          // Cheerful bubbly wave band across middle
          const bandY = sy + Math.floor(h / 2) - 2;
          ctx.fillStyle = '#67E8F9';
          ctx.fillRect(sx + 1, bandY, w - 2, 4);
          // Soda fizz bubbles
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx + 3, bandY + 1, 2, 2);
          ctx.fillRect(sx + 8, bandY + 1, 2, 2);
          if (w > 12) ctx.fillRect(sx + 13, bandY + 1, 2, 2);

          // Cute smiling fruit face on barrel
          ctx.fillStyle = '#2C1A2E';
          ctx.fillRect(sx + Math.floor(w / 2) - 3, bandY - 4, 1, 2);
          ctx.fillRect(sx + Math.floor(w / 2) + 2, bandY - 4, 1, 2);
          ctx.fillRect(sx + Math.floor(w / 2) - 1, bandY - 2, 2, 1);
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
  // PASS 4.8: BOUNCY FLOATING SCORE POPUPS
  // ==========================================
  public addScorePopup(text: string, x: number, y: number, color: string = '#FDE047'): void {
    this.scorePopups.push({
      text,
      x,
      y,
      startY: y,
      time: 0,
      duration: 0.85,
      color,
    });
    if (this.scorePopups.length > 20) {
      this.scorePopups.shift();
    }
  }

  private renderScorePopupsPass(dt: number): void {
    const ctx = this.virtualCtx;
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const p = this.scorePopups[i];
      p.time += dt;
      if (p.time >= p.duration) {
        this.scorePopups.splice(i, 1);
        continue;
      }
      const progress = p.time / p.duration;
      // Bouncy upward float
      const currentY = p.startY - Math.sin(progress * Math.PI * 0.5) * 32;
      const alpha = Math.max(0, 1 - progress * progress);

      ctx.save();
      ctx.globalAlpha = alpha;
      if (typeof ctx.fillText === 'function') {
        (ctx as any).font = 'bold 14px sans-serif';
        (ctx as any).textAlign = 'center';
        // Confectionery drop shadow
        ctx.fillStyle = '#2C1A2E';
        ctx.fillText(p.text, p.x + 1, currentY + 1);
        // Main glowing honey-gold text
        ctx.fillStyle = p.color ?? '#FDE047';
        ctx.fillText(p.text, p.x, currentY);
      } else {
        ctx.fillStyle = p.color ?? '#FDE047';
        ctx.fillRect(p.x - 2, currentY - 2, 4, 4);
      }
      ctx.restore();
    }
  }

  // ==========================================
  // PASS 5: RETRO ARCADE HUD OVERLAY
  // ==========================================
  private renderHudPass(hud: RenderHUDState): void {
    if (this.lastScore > 0 && hud.score > this.lastScore) {
      const diff = hud.score - this.lastScore;
      const word = diff >= 500 ? 'SWEET! +' + diff : (diff >= 200 ? 'POP! +' + diff : '+' + diff);
      this.addScorePopup(word, 480 + (Math.sin(this.elapsedTime * 10) * 60), 240, '#FDE047');
    }
    this.lastScore = hud.score;
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
   * Pistol Reticle: Sparkling Star Reticle (Golden dashed laser tracer, 4 corner star brackets, central radiant star pip).
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

    // 1. Faint dashed golden tracer line from muzzle to crosshair
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
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

    // 2. 4 Corner star-shaped bracket marks framing the crosshair (radius 6px)
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Top-Left corner
    ctx.moveTo(rx - 6, ry - 3); ctx.lineTo(rx - 6, ry - 6); ctx.lineTo(rx - 3, ry - 6);
    // Top-Right corner
    ctx.moveTo(rx + 3, ry - 6); ctx.lineTo(rx + 6, ry - 6); ctx.lineTo(rx + 6, ry - 3);
    // Bottom-Left corner
    ctx.moveTo(rx - 6, ry + 3); ctx.lineTo(rx - 6, ry + 6); ctx.lineTo(rx - 3, ry + 6);
    // Bottom-Right corner
    ctx.moveTo(rx + 3, ry + 6); ctx.lineTo(rx + 6, ry + 6); ctx.lineTo(rx + 6, ry + 3);
    ctx.stroke();

    // 3. Central sparkling pastel golden star with white core
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(rx - 2, ry - 2, 4, 4);
    ctx.fillStyle = '#FEF9C3';
    ctx.fillRect(rx - 3, ry - 1, 6, 2);
    ctx.fillRect(rx - 1, ry - 3, 2, 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 1, ry - 1, 2, 2);

    ctx.restore();
  }

  /**
   * Heavy Machine Gun Reticle: Sweet Aqua Bubble Reticle (Translucent bubble ring,
   * cardinal tick marks, sweet strawberry gumdrop spread pips).
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

    ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(pip1X, pip1Y);
    ctx.moveTo(mx, my);
    ctx.lineTo(pip2X, pip2Y);
    ctx.stroke();

    // 2. Sweet aqua bubble ring
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 4 Cardinal tick marks extending outward 3px
    ctx.strokeStyle = '#67E8F9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, ry - ringRadius - 3); ctx.lineTo(rx, ry - ringRadius);
    ctx.moveTo(rx, ry + ringRadius); ctx.lineTo(rx, ry + ringRadius + 3);
    ctx.moveTo(rx - ringRadius - 3, ry); ctx.lineTo(rx - ringRadius, ry);
    ctx.moveTo(rx + ringRadius, ry); ctx.lineTo(rx + ringRadius + 3, ry);
    ctx.stroke();

    // 4. Bullet spread pips styled as sweet pastel strawberry gumdrops
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(pip1X - 1, pip1Y - 1, 2, 2);
    ctx.fillRect(pip2X - 1, pip2Y - 1, 2, 2);

    // 5. Center sparkling white sugar pip
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 1, ry - 1, 2, 2);

    ctx.restore();
  }

  /**
   * Flame Shot Reticle: Pulsing Heart Reticle (Tapered peach flame rays,
   * cotton-candy heat arcs, and central sweet candy heart marker).
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

    // 1. Radiating peach cone rays from muzzle to outer arc endpoints
    const end1X = mx + dFlame * Math.cos(aimAngleRad - halfSpread);
    const end1Y = my + dFlame * Math.sin(aimAngleRad - halfSpread);
    const end2X = mx + dFlame * Math.cos(aimAngleRad + halfSpread);
    const end2Y = my + dFlame * Math.sin(aimAngleRad + halfSpread);

    ctx.strokeStyle = 'rgba(251, 113, 133, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(end1X, end1Y);
    ctx.moveTo(mx, my);
    ctx.lineTo(end2X, end2Y);
    ctx.stroke();

    // 2. Swept impact arcs in cotton candy rainbow gradient
    // Outer arc (Strawberry rose)
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, dFlame, aimAngleRad - halfSpread, aimAngleRad + halfSpread);
    ctx.stroke();

    // Mid heat arc (Soft peach)
    const midD = Math.max(8, dFlame - 6);
    ctx.strokeStyle = '#FDBA74';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, midD, aimAngleRad - halfSpread * 0.8, aimAngleRad + halfSpread * 0.8);
    ctx.stroke();

    // Core heat arc (Buttercream yellow)
    const coreD = Math.max(4, dFlame - 12);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, coreD, aimAngleRad - halfSpread * 0.6, aimAngleRad + halfSpread * 0.6);
    ctx.stroke();

    // 3. Central pink candy heart marker at reticle point
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(rx - 2, ry - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(rx + 2, ry - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rx - 4, ry);
    ctx.lineTo(rx + 4, ry);
    ctx.lineTo(rx, ry + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 1, ry - 1, 1, 1);

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

  // ==========================================
  // PASS 2.8: CUTE BLOSSOM ALTARS
  // ==========================================
  private renderCuteAltarsPass(altars: RenderAltarState[], camera: Camera, time: number): void {
    const ctx = this.virtualCtx;

    for (const altar of altars) {
      const screen = camera.worldToScreen(altar.x, altar.y);

      ctx.save();
      // Frosted altar base circle
      ctx.fillStyle = altar.isBloomed ? 'rgba(181, 234, 215, 0.45)' : 'rgba(255, 218, 193, 0.35)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y + 4, 30, 0, Math.PI * 2);
      ctx.fill();

      // Golden sugar rim
      ctx.strokeStyle = '#F4D06F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y + 4, 30, 0, Math.PI * 2);
      ctx.stroke();

      // Purification progress ring
      const progress = Math.min(1.0, Math.max(0.0, altar.purificationProgress));
      if (progress > 0 && !altar.isBloomed) {
        ctx.strokeStyle = '#67E8F9';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y + 4, 34, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      }

      // Altar pedestal pillar
      ctx.fillStyle = '#FFF5EA';
      ctx.fillRect(screen.x - 12, screen.y - 18, 24, 20);
      ctx.fillStyle = '#FFB7B2';
      ctx.fillRect(screen.x - 14, screen.y - 20, 28, 4);

      // Flower petals
      const petalCount = altar.bloomPetals ?? 6;
      const petalRadius = altar.isBloomed ? 14 : 7;
      const petalDist = altar.isBloomed ? 12 : 5;
      const spin = time * (altar.isBloomed ? 1.2 : 0.4);

      for (let k = 0; k < petalCount; k++) {
        const angle = spin + (k * Math.PI * 2) / petalCount;
        const px = screen.x + Math.cos(angle) * petalDist;
        const py = screen.y - 26 + Math.sin(angle) * petalDist;
        ctx.fillStyle = altar.isBloomed ? '#FF85A2' : '#FFDAC1';
        ctx.beginPath();
        ctx.arc(px, py, petalRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Golden flower center
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 26, altar.isBloomed ? 9 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Specular glint
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(screen.x - 2, screen.y - 29, 3, 3);

      ctx.restore();
    }
  }

  // ==========================================
  // PASS 2.9: CUTE PICKUPS (CANDIES & STARS)
  // ==========================================
  private renderCutePickupsPass(pickups: RenderPickupState[], camera: Camera, time: number): void {
    const ctx = this.virtualCtx;

    for (const p of pickups) {
      const screen = camera.worldToScreen(p.x, p.y);
      const bob = Math.sin(time * 6 + p.x * 0.1) * 3;
      const cy = screen.y + bob;

      ctx.save();
      if (p.type === 'star') {
        // Shimmering 5-point Star Crystal
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2 + time * 2;
          const r1 = 9;
          const r2 = 4;
          const sx = screen.x + Math.cos(a) * r1;
          const sy = cy + Math.sin(a) * r1;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
          const aMid = a + Math.PI / 5;
          ctx.lineTo(screen.x + Math.cos(aMid) * r2, cy + Math.sin(aMid) * r2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(screen.x - 1, cy - 2, 3, 3);
      } else if (p.type === 'heart') {
        // Sweet Pulsing Heart
        ctx.fillStyle = '#FF6584';
        ctx.beginPath();
        ctx.arc(screen.x - 3, cy - 2, 4, 0, Math.PI * 2);
        ctx.arc(screen.x + 3, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screen.x - 7, cy);
        ctx.lineTo(screen.x + 7, cy);
        ctx.lineTo(screen.x, cy + 7);
        ctx.closePath();
        ctx.fill();
      } else {
        // Wrapped Pastel Candy Bonbon
        ctx.fillStyle = '#FF85A2';
        ctx.beginPath();
        ctx.arc(screen.x, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Wrapper twist ends
        ctx.fillStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.moveTo(screen.x - 6, cy);
        ctx.lineTo(screen.x - 11, cy - 4);
        ctx.lineTo(screen.x - 11, cy + 4);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screen.x + 6, cy);
        ctx.lineTo(screen.x + 11, cy - 4);
        ctx.lineTo(screen.x + 11, cy + 4);
        ctx.closePath();
        ctx.fill();

        // White sugar stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(screen.x - 1, cy - 5, 2, 10);
      }
      ctx.restore();
    }
  }

  // ==========================================
  // PASS 3.2: CUTE PET COMPANION ("MOCHI")
  // ==========================================
  private renderCutePetPass(pet: RenderPetState, camera: Camera, time: number): void {
    const ctx = this.virtualCtx;
    const screen = camera.worldToScreen(pet.x, pet.y);
    const facing = pet.facing;

    ctx.save();

    // 1. Shimmering Bubble Shield
    if (pet.shieldActive) {
      const shieldPulse = Math.sin(time * 4) * 2;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 22 + shieldPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular highlight on shield
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x - 6, screen.y - 6, 12, -Math.PI * 0.7, -Math.PI * 0.2);
      ctx.stroke();
    }

    // 2. Mochi Bunny Body (Fluffy marshmallow cloud shape)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x, screen.y, 14, 12, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(screen.x, screen.y, 13, 0, Math.PI * 2);
    }
    ctx.fill();

    // Soft lavender shadow on bottom
    ctx.fillStyle = '#EDE9FE';
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x, screen.y + 4, 10, 6, 0, 0, Math.PI);
    } else {
      ctx.arc(screen.x, screen.y + 4, 7, 0, Math.PI);
    }
    ctx.fill();

    // 3. Floppy Ears
    const earWiggle = pet.state === 'cheer' ? Math.sin(time * 12) * 0.25 : 0;
    // Ear 1
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x - 5 * facing, screen.y - 14, 4, 9, -0.2 + earWiggle, 0, Math.PI * 2);
    } else {
      ctx.arc(screen.x - 5 * facing, screen.y - 14, 5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#FFB7B2'; // Pink inner ear
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x - 5 * facing, screen.y - 14, 2, 6, -0.2 + earWiggle, 0, Math.PI * 2);
    } else {
      ctx.arc(screen.x - 5 * facing, screen.y - 14, 3, 0, Math.PI * 2);
    }
    ctx.fill();

    // Ear 2
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x + 3 * facing, screen.y - 13, 4, 8, 0.15 - earWiggle, 0, Math.PI * 2);
    } else {
      ctx.arc(screen.x + 3 * facing, screen.y - 13, 4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#FFB7B2';
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(screen.x + 3 * facing, screen.y - 13, 2, 5, 0.15 - earWiggle, 0, Math.PI * 2);
    } else {
      ctx.arc(screen.x + 3 * facing, screen.y - 13, 2, 0, Math.PI * 2);
    }
    ctx.fill();

    // 4. Face: Expressive Anime Eyes & Blushing Cheeks
    const eyeX = screen.x + 4 * facing;
    const eyeY = screen.y - 2;
    ctx.fillStyle = '#1E162B';
    ctx.fillRect(eyeX - 1, eyeY - 1, 3, 3);
    ctx.fillStyle = '#FFFFFF'; // Specular catchlight
    ctx.fillRect(eyeX, eyeY - 1, 1, 1);

    // Rosy blushing cheek
    ctx.fillStyle = '#FFAAA6';
    ctx.beginPath();
    ctx.arc(screen.x + 6 * facing, screen.y + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pink button nose
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(screen.x + 7 * facing, screen.y, 2, 2);

    // 5. Golden Star Badge on chest
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(screen.x - 2, screen.y + 3, 4, 4);

    ctx.restore();
  }

  // ==========================================
  // PASS 3.3: CUTE BUBBLES (TRAPPED & FREE)
  // ==========================================
  private renderCuteBubblesPass(bubbles: RenderBubbleState[], camera: Camera, time: number): void {
    const ctx = this.virtualCtx;

    for (const b of bubbles) {
      const screen = camera.worldToScreen(b.x, b.y);
      const r = b.radius;

      ctx.save();
      if (b.isPopping) {
        // Popping burst ring
        const pop = Math.min(1.0, Math.max(0.0, b.popProgress ?? 0));
        const burstRadius = r + pop * 24;
        const alpha = Math.max(0, 1.0 - pop);

        ctx.strokeStyle = `rgba(251, 207, 232, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, burstRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Radial burst sparkles
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const dist = pop * 40;
          ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
          ctx.fillRect(screen.x + Math.cos(a) * dist - 2, screen.y + Math.sin(a) * dist - 2, 4, 4);
        }
      } else {
        // Intact Iridescent Bubble
        const sway = b.swayAngle ?? 0;

        // Translucent bubble fill
        ctx.fillStyle = b.color ? `${b.color}55` : 'rgba(186, 230, 253, 0.35)';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Soft pastel border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bottom-right iridescent pink sheen
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r - 2, Math.PI * 0.2, Math.PI * 0.6);
        ctx.stroke();

        // Top-left curved specular white glint
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r - 4, -Math.PI * 0.8 + sway, -Math.PI * 0.3 + sway);
        ctx.stroke();

        // If holding a trapped enemy, draw cute suspended foe!
        if (b.trappedType) {
          ctx.save();
          // Gentle floating bob
          const enemyBob = Math.sin(time * 5 + screen.x) * 2;
          ctx.translate(screen.x, screen.y + enemyBob);

          if (b.trappedType.includes('SLIME')) {
            // Marshmallow slime inside
            ctx.fillStyle = '#FBCFE8';
            ctx.beginPath();
            if (typeof (ctx as any).ellipse === 'function') {
              (ctx as any).ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
            } else {
              ctx.arc(0, 0, 9, 0, Math.PI * 2);
            }
            ctx.fill();
            // Funny dizzy spiral eyes
            if (typeof ctx.fillText === 'function') {
              (ctx as any).font = '10px monospace';
              ctx.fillStyle = '#1E162B';
              ctx.fillText('@_@', -9, 3);
            }
          } else if (b.trappedType.includes('BEE')) {
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#78350F';
            ctx.fillRect(-2, -6, 2, 12);
            if (typeof ctx.fillText === 'function') {
              (ctx as any).font = '9px monospace';
              ctx.fillStyle = '#1E162B';
              ctx.fillText('@_@', -7, 3);
            }
          } else if (b.trappedType.includes('DONUT')) {
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F472B6';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1E162B';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.trappedType.includes('CUB')) {
            ctx.fillStyle = '#4ADE80';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            if (typeof ctx.fillText === 'function') {
              (ctx as any).font = '8px monospace';
              ctx.fillStyle = '#1E162B';
              ctx.fillText('@_@', -6, 3);
            }
          } else {
            // General cute trapped foe
            ctx.fillStyle = '#BAE6FD';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-3, -3, 6, 2);
          }
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  // ==========================================
  // PASS 3.1: LIVING CUTE ENEMIES (M2)
  // ==========================================

  private renderCuteEnemiesPass(enemies: CuteEnemyState[], camera: Camera, time: number): void {
    const ctx = this.virtualCtx;

    for (const enemy of enemies) {
      // Omit bubbled or dead enemies (bubbled enemies are rendered inside floating bubbles)
      if (!enemy.isAlive || enemy.isBubbled) continue;

      const screen = camera.worldToScreen(enemy.x, enemy.y);
      const flip = enemy.facing === -1;

      switch (enemy.type) {
        case 'MARSHMALLOW_SLIME': {
          const stretch = enemy.squashStretch ?? 1.0;
          const drawn = this.spriteFactory.drawSprite(ctx, 'cute_marshmallow_slime', screen.x, screen.y, {
            flipX: flip,
            scale: stretch,
          });
          if (!drawn) {
            ctx.save();
            ctx.fillStyle = '#FBCFE8';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - 6, 10 * stretch, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }

        case 'HONEY_BEE': {
          const wingFlutter = Math.sin(time * 28);
          ctx.save();
          ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
          ctx.beginPath();
          if (typeof (ctx as any).ellipse === 'function') {
            (ctx as any).ellipse(screen.x - 4 * (flip ? -1 : 1), screen.y - 12, 6, Math.abs(wingFlutter) * 7 + 2, 0.2, 0, Math.PI * 2);
          } else {
            ctx.arc(screen.x - 4 * (flip ? -1 : 1), screen.y - 12, 6, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();

          const drawn = this.spriteFactory.drawSprite(ctx, 'cute_honey_bee', screen.x, screen.y, {
            flipX: flip,
          });
          if (!drawn) {
            ctx.save();
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }

        case 'DONUT_ROLLER': {
          const rollAngle = enemy.x / 14;
          const drawn = this.spriteFactory.drawSprite(ctx, 'cute_donut_roller', screen.x, screen.y, {
            rotation: rollAngle * (flip ? -1 : 1),
          });
          if (!drawn) {
            ctx.save();
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }

        case 'GUMMY_COLOSSUS': {
          const wobble = 1 + Math.sin(time * 4) * 0.03;
          const drawn = this.spriteFactory.drawSprite(ctx, 'cute_gummy_colossus', screen.x, screen.y, {
            flipX: flip,
            scale: wobble,
          });
          if (!drawn) {
            ctx.save();
            ctx.fillStyle = '#F43F5E';
            ctx.fillRect(screen.x - 30, screen.y - 70, 60, 70);
            ctx.restore();
          }

          // Render Boss Health Bar Above Head
          const barWidth = 100;
          const barHeight = 8;
          const barX = screen.x - barWidth / 2;
          const barY = screen.y - 88;
          const hpRatio = Math.max(0, Math.min(1, enemy.health / (enemy.maxHealth || 250)));

          ctx.save();
          ctx.fillStyle = 'rgba(30, 22, 43, 0.6)';
          ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
          ctx.fillStyle = '#4C1D95';
          ctx.fillRect(barX, barY, barWidth, barHeight);
          ctx.fillStyle = '#F43F5E';
          ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
          ctx.fillStyle = '#FDE047';
          if (typeof ctx.fillText === 'function') {
            (ctx as any).font = 'bold 9px monospace';
            ctx.fillText('👑 GUMMY COLOSSUS', barX, barY - 3);
          }
          ctx.restore();
          break;
        }

        case 'GUMMY_CUB': {
          const hopWobble = 1 + Math.sin(time * 8 + enemy.x) * 0.08;
          const drawn = this.spriteFactory.drawSprite(ctx, 'cute_gummy_cub', screen.x, screen.y, {
            flipX: flip,
            scale: hopWobble,
          });
          if (!drawn) {
            ctx.save();
            ctx.fillStyle = '#4ADE80';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }
      }
    }
  }

  // ==========================================
  // PASS 3.4: CUTE PERK VISUALS (ORBITERS & TRAILS)
  // ==========================================
  private renderCutePerkVisualsPass(scene: RenderSceneState, camera: Camera, _time: number): void {
    const ctx = this.virtualCtx;

    // 1. Orbiting Bubbles
    if (scene.cuteOrbiters && scene.player) {
      const playerScreen = camera.worldToScreen(scene.player.x, scene.player.y);
      for (const orb of scene.cuteOrbiters) {
        const ox = playerScreen.x + Math.cos(orb.angle) * orb.radius;
        const oy = playerScreen.y - 16 + Math.sin(orb.angle) * orb.radius;

        ctx.save();
        ctx.fillStyle = 'rgba(251, 207, 232, 0.45)';
        ctx.beginPath();
        ctx.arc(ox, oy, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Specular glint
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ox - 4, oy - 4, 3, 3);
        ctx.restore();
      }
    }

    // 2. Sugar Dash Trail
    if (scene.cuteTrails && scene.cuteTrails.length > 0) {
      for (const trail of scene.cuteTrails) {
        const screen = camera.worldToScreen(trail.x, trail.y);
        const alpha = Math.max(0, 1.0 - trail.age / trail.maxAge);
        const radius = 3 + (trail.age / trail.maxAge) * 4;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = trail.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /**
   * Advances renderer internal timer.
   */
  public update(dt: number): void {
    this.elapsedTime += dt;
  }
}
