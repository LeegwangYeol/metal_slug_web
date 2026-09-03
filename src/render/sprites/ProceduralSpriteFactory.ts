/**
 * Procedural Pixel-Art Sprite Engine.
 * Generates and caches authentic 16-color Neo Geo / Metal Slug sprites into Canvas / OffscreenCanvas buffers.
 * Zero external asset dependencies.
 */

import { PALETTES, hexToRgba } from './Palette';

export interface CanvasContext2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  drawImage(image: any, ...args: number[]): void;
  fillText?(text: string, x: number, y: number): void;
  measureText?(text: string): { width: number };
  createLinearGradient?(x0: number, y0: number, x1: number, y1: number): any;
  createRadialGradient?(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any;
  getImageData?(sx: number, sy: number, sw: number, sh: number): any;
  putImageData?(imagedata: any, dx: number, dy: number): void;
}

export interface CanvasBuffer {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasContext2DLike | null;
}

/**
 * Universal canvas buffer creator that runs in browsers (OffscreenCanvas or HTMLCanvasElement)
 * and in Node.js headless environments (using an in-memory 2D context mock).
 */
export function createCanvasBuffer(width: number, height: number): CanvasBuffer {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as CanvasBuffer;
  }
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c as unknown as CanvasBuffer;
  }

  // Headless in-memory mock for Node.js Vitest environments
  return createMockCanvasBuffer(width, height);
}

function createMockCanvasBuffer(width: number, height: number): CanvasBuffer {
  const pixelData = new Uint8Array(width * height * 4);

  const mockCtx: CanvasContext2DLike = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1.0,
    imageSmoothingEnabled: false,

    fillRect(x: number, y: number, w: number, h: number) {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width, Math.ceil(x + w));
      const y1 = Math.min(height, Math.ceil(y + h));

      let [r, g, b, a] = [255, 255, 255, 255];
      if (typeof this.fillStyle === 'string') {
        [r, g, b, a] = hexToRgba(this.fillStyle, this.globalAlpha);
      }

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * width + px) * 4;
          pixelData[idx] = r;
          pixelData[idx + 1] = g;
          pixelData[idx + 2] = b;
          pixelData[idx + 3] = a;
        }
      }
    },

    strokeRect(_x: number, _y: number, _w: number, _h: number) {},
    clearRect(x: number, y: number, w: number, h: number) {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width, Math.ceil(x + w));
      const y1 = Math.min(height, Math.ceil(y + h));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * width + px) * 4;
          pixelData[idx] = 0;
          pixelData[idx + 1] = 0;
          pixelData[idx + 2] = 0;
          pixelData[idx + 3] = 0;
        }
      }
    },

    beginPath() {},
    closePath() {},
    moveTo(_x: number, _y: number) {},
    lineTo(_x: number, _y: number) {},
    arc(x: number, y: number, radius: number) {
      this.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    },
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate(_x: number, _y: number) {},
    rotate(_angle: number) {},
    scale(_x: number, _y: number) {},
    drawImage(_image: any, ..._args: number[]) {},
    fillText(_text: string, _x: number, _y: number) {},
    measureText(_text: string) { return { width: 10 }; },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      return { data: pixelData.slice((sy * width + sx) * 4, ((sy + sh) * width + (sx + sw)) * 4) };
    },
    putImageData() {}
  };

  return {
    width,
    height,
    getContext: () => mockCtx,
  };
}

export interface SpriteFrame {
  canvas: CanvasBuffer;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface DrawSpriteOptions {
  flipX?: boolean;
  flipY?: boolean;
  rotation?: number;
  scale?: number;
  alpha?: number;
}

/**
 * ProceduralSpriteFactory - Generates and caches complete sprite sheets for:
 * Player, Rebel Soldiers, POW Hostages, Mid-Boss, Tetsuyuki War Fortress, Projectiles, Explosions, and HUD.
 */
export class ProceduralSpriteFactory {
  private static instance: ProceduralSpriteFactory | null = null;
  private spriteCache: Map<string, SpriteFrame> = new Map();
  private initialized: boolean = false;

  public static getInstance(): ProceduralSpriteFactory {
    if (!ProceduralSpriteFactory.instance) {
      ProceduralSpriteFactory.instance = new ProceduralSpriteFactory();
    }
    return ProceduralSpriteFactory.instance;
  }

  constructor() {
    this.init();
  }

  public init(): void {
    if (this.initialized) return;

    this.generatePlayerSprites();
    this.generateRebelSprites();
    this.generatePowSprites();
    this.generateVehicleSprites();
    this.generateFortressSprites();
    this.generateProjectileSprites();
    this.generateExplosionSprites();
    this.generateHudSprites();

    this.initialized = true;
  }

  public getSprite(key: string): SpriteFrame | undefined {
    return this.spriteCache.get(key);
  }

  public hasSprite(key: string): boolean {
    return this.spriteCache.has(key);
  }

  public getAllKeys(): string[] {
    return Array.from(this.spriteCache.keys());
  }

  public count(): number {
    return this.spriteCache.size;
  }

  /**
   * Draws a cached sprite frame onto target canvas context with anchor centering, flipping, and rotation.
   */
  public drawSprite(
    ctx: CanvasContext2DLike,
    key: string,
    x: number,
    y: number,
    options: DrawSpriteOptions = {}
  ): boolean {
    const frame = this.spriteCache.get(key);
    if (!frame) return false;

    const { flipX = false, flipY = false, rotation = 0, scale = 1, alpha = 1 } = options;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    if (alpha !== 1) {
      ctx.globalAlpha *= alpha;
    }

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (flipX || flipY || scale !== 1) {
      ctx.scale(flipX ? -scale : scale, flipY ? -scale : scale);
    }

    ctx.drawImage(frame.canvas as any, -frame.anchorX, -frame.anchorY);
    ctx.restore();
    return true;
  }

  // --- Helper to register a frame ---
  private registerSprite(
    key: string,
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
    renderFn: (ctx: CanvasContext2DLike) => void
  ): SpriteFrame {
    const canvas = createCanvasBuffer(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      renderFn(ctx);
    }
    const frame: SpriteFrame = { canvas, width, height, anchorX, anchorY };
    this.spriteCache.set(key, frame);
    return frame;
  }

  // ==========================================
  // 1. PLAYER (MARCO SOLDIER) SPRITE GENERATION
  // ==========================================
  private generatePlayerSprites(): void {
    const W = 36;
    const H = 40;
    const AX = 18;
    const AY = 38;
    const P = PALETTES.PLAYER;

    // Helper: Draw base soldier body parts
    const drawSoldier = (
      ctx: CanvasContext2DLike,
      opts: {
        legOffsetL?: number;
        legOffsetR?: number;
        torsoBob?: number;
        aimAngle?: number;
        headbandFlutter?: number;
        crouch?: boolean;
        knife?: number; // 0=none, 1=windup, 2=slash, 3=follow
        fire?: boolean;
        death?: number; // 0=none, 1=hit, 2=fly, 3=down
      }
    ) => {
      const bob = opts.torsoBob ?? 0;
      const isCrouch = !!opts.crouch;

      if (opts.death) {
        // Death animation frames
        const d = opts.death;
        if (d === 1) {
          // Flinch
          ctx.fillStyle = P[1]; ctx.fillRect(8, 12, 18, 24);
          ctx.fillStyle = P[4]; ctx.fillRect(8, 10, 16, 4); // Red headband
          ctx.fillStyle = P[2]; ctx.fillRect(10, 6, 12, 6);  // Blonde hair
          ctx.fillStyle = P[7]; ctx.fillRect(10, 14, 12, 6); // Face
          ctx.fillStyle = P[11]; ctx.fillRect(9, 20, 15, 10); // Vest
          ctx.fillStyle = P[13]; ctx.fillRect(7, 30, 17, 8); // Pants
        } else if (d === 2) {
          // Airborne tumble
          ctx.fillStyle = P[1]; ctx.fillRect(4, 16, 24, 16);
          ctx.fillStyle = P[2]; ctx.fillRect(20, 14, 10, 8); // Blonde
          ctx.fillStyle = P[4]; ctx.fillRect(24, 8, 8, 4);   // Flying headband
          ctx.fillStyle = P[11]; ctx.fillRect(12, 18, 12, 10);
          ctx.fillStyle = P[13]; ctx.fillRect(6, 20, 8, 12);
        } else {
          // Lying flat on ground
          ctx.fillStyle = P[1]; ctx.fillRect(2, 30, 32, 8);
          ctx.fillStyle = P[2]; ctx.fillRect(4, 30, 8, 6);
          ctx.fillStyle = P[11]; ctx.fillRect(12, 30, 12, 6);
          ctx.fillStyle = P[13]; ctx.fillRect(24, 31, 8, 5);
          ctx.fillStyle = P[4]; ctx.fillRect(30, 26, 4, 4); // Headband dropped
        }
        return;
      }

      // 1. Legs & Boots
      const legY = isCrouch ? 24 : 22 + bob;
      const legL = opts.legOffsetL ?? 0;
      const legR = opts.legOffsetR ?? 0;

      // Dark pants shadow & khaki trousers
      ctx.fillStyle = P[14];
      ctx.fillRect(11 + legL, legY, 6, isCrouch ? 8 : 10);
      ctx.fillRect(17 + legR, legY, 6, isCrouch ? 8 : 10);
      ctx.fillStyle = P[13];
      ctx.fillRect(12 + legL, legY, 4, isCrouch ? 7 : 9);
      ctx.fillRect(18 + legR, legY, 4, isCrouch ? 7 : 9);

      // Leather combat boots
      ctx.fillStyle = P[15];
      ctx.fillRect(10 + legL, legY + (isCrouch ? 8 : 10), 7, 5);
      ctx.fillRect(18 + legR, legY + (isCrouch ? 8 : 10), 7, 5);

      // 2. Torso (Khaki shirt & Olive vest)
      const torsoY = isCrouch ? 14 : 12 + bob;
      // White undershirt
      ctx.fillStyle = P[9];
      ctx.fillRect(13, torsoY + 2, 8, 8);
      // Olive tactical vest
      ctx.fillStyle = P[12];
      ctx.fillRect(11, torsoY, 12, 10);
      ctx.fillStyle = P[11];
      ctx.fillRect(12, torsoY + 1, 4, 8);
      ctx.fillRect(18, torsoY + 1, 4, 8);
      // Brass pocket snaps
      ctx.fillStyle = P[2];
      ctx.fillRect(13, torsoY + 3, 2, 2);
      ctx.fillRect(19, torsoY + 3, 2, 2);

      // 3. Head & Headband
      const headY = isCrouch ? 6 : 4 + bob;
      // Blonde hair
      ctx.fillStyle = P[3];
      ctx.fillRect(12, headY, 11, 8);
      ctx.fillStyle = P[2];
      ctx.fillRect(13, headY - 1, 9, 6);
      // Hair spikes
      ctx.fillRect(11, headY - 2, 3, 3);
      ctx.fillRect(15, headY - 3, 4, 3);
      ctx.fillRect(20, headY - 2, 3, 3);

      // Red Headband
      ctx.fillStyle = P[5];
      ctx.fillRect(11, headY + 3, 13, 3);
      ctx.fillStyle = P[4];
      ctx.fillRect(12, headY + 3, 11, 2);

      // Headband knot & fluttering tails
      const flutter = opts.headbandFlutter ?? 0;
      ctx.fillStyle = P[4];
      ctx.fillRect(8, headY + 4 + flutter, 4, 2);
      ctx.fillRect(6, headY + 5 + flutter * 1.5, 3, 2);

      // Face & Skin
      ctx.fillStyle = P[7];
      ctx.fillRect(13, headY + 6, 9, 5);
      ctx.fillStyle = P[6];
      ctx.fillRect(14, headY + 6, 7, 3);
      // Eye
      ctx.fillStyle = P[1];
      ctx.fillRect(19, headY + 7, 2, 2);

      // 4. Arms, Hands & Weapon / Knife
      const armY = isCrouch ? 15 : 13 + bob;

      if (opts.knife) {
        // Melee knife slash action
        if (opts.knife === 1) {
          // Windup: arm drawn back
          ctx.fillStyle = P[7]; ctx.fillRect(8, armY, 4, 7);
          ctx.fillStyle = P[10]; ctx.fillRect(6, armY - 3, 3, 8); // Knife handle
          ctx.fillStyle = P[9]; ctx.fillRect(6, armY - 9, 3, 6);  // Blade
        } else if (opts.knife === 2) {
          // Active slash arc
          ctx.fillStyle = P[7]; ctx.fillRect(16, armY - 1, 9, 4);
          ctx.fillStyle = P[9]; ctx.fillRect(25, armY - 3, 8, 3); // Knife blade
          // Slashing silver arc
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(22, armY - 8, 3, 14);
          ctx.fillRect(25, armY - 6, 6, 10);
        } else {
          // Follow through
          ctx.fillStyle = P[7]; ctx.fillRect(18, armY + 2, 8, 4);
          ctx.fillStyle = P[9]; ctx.fillRect(24, armY + 4, 6, 3);
        }
      } else {
        // Standard gun holding / aiming
        const aim = opts.aimAngle ?? 0; // 0=right, 1=up-right, 2=up, 3=up-left, 4=left, 5=down-left, 6=down, 7=down-right
        ctx.fillStyle = P[7];
        ctx.fillRect(16, armY, 5, 5);

        // Gun barrel direction
        ctx.fillStyle = P[15];
        if (aim === 0) { // Right
          ctx.fillRect(19, armY + 1, 9, 3);
          ctx.fillRect(19, armY + 3, 3, 3);
        } else if (aim === 1) { // Up-Right
          ctx.fillRect(18, armY - 5, 7, 7);
          ctx.fillRect(23, armY - 7, 4, 4);
        } else if (aim === 2) { // Up
          ctx.fillRect(16, armY - 9, 3, 10);
          ctx.fillRect(15, armY, 4, 3);
        } else if (aim === 3) { // Up-Left
          ctx.fillRect(9, armY - 5, 7, 7);
          ctx.fillRect(7, armY - 7, 4, 4);
        } else if (aim === 4) { // Left
          ctx.fillRect(6, armY + 1, 9, 3);
          ctx.fillRect(12, armY + 3, 3, 3);
        } else if (aim === 5) { // Down-Left
          ctx.fillRect(9, armY + 4, 6, 6);
          ctx.fillRect(7, armY + 8, 4, 4);
        } else if (aim === 6) { // Down
          ctx.fillRect(16, armY + 4, 3, 9);
        } else if (aim === 7) { // Down-Right
          ctx.fillRect(19, armY + 4, 6, 6);
          ctx.fillRect(23, armY + 8, 4, 4);
        }

        if (opts.fire) {
          // Muzzle flash burst
          ctx.fillStyle = PALETTES.FIRE[1];
          const mfx = aim === 2 ? 16 : aim === 6 ? 16 : 28;
          const mfy = aim === 2 ? armY - 11 : aim === 6 ? armY + 13 : armY + 1;
          ctx.fillRect(mfx - 2, mfy - 2, 5, 5);
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(mfx - 4, mfy - 4, 9, 9);
        }
      }
    };

    // Idle frames (4 frames)
    for (let i = 0; i < 4; i++) {
      const bob = i === 1 || i === 2 ? 1 : 0;
      const flut = Math.sin((i * Math.PI) / 2);
      this.registerSprite(`player_idle_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { torsoBob: bob, headbandFlutter: flut });
      });
    }

    // Run cycle (6 frames)
    const runOffsets = [
      { l: -4, r: 4, bob: 0 },
      { l: -2, r: 2, bob: 1 },
      { l: 0, r: 0, bob: 2 },
      { l: 4, r: -4, bob: 0 },
      { l: 2, r: -2, bob: 1 },
      { l: 0, r: 0, bob: 2 },
    ];
    for (let i = 0; i < 6; i++) {
      const ro = runOffsets[i];
      this.registerSprite(`player_run_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { legOffsetL: ro.l, legOffsetR: ro.r, torsoBob: ro.bob, headbandFlutter: -1 });
      });
    }

    // Jump frames
    this.registerSprite('player_jump_rise', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -2, legOffsetR: -2, torsoBob: -2, headbandFlutter: 2 });
    });
    this.registerSprite('player_jump_fall', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: 1, legOffsetR: 3, torsoBob: 1, headbandFlutter: -2 });
    });

    // Crouch & Crawl
    this.registerSprite('player_crouch_idle', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { crouch: true, torsoBob: 0 });
    });
    this.registerSprite('player_crouch_crawl', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { crouch: true, legOffsetL: -3, legOffsetR: 3, torsoBob: 1 });
    });

    // Aim 8 Directions
    for (let aim = 0; aim < 8; aim++) {
      this.registerSprite(`player_aim_${aim}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { aimAngle: aim });
      });
    }

    // Knife Slash (3 frames)
    for (let k = 0; k < 3; k++) {
      this.registerSprite(`player_knife_${k}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { knife: k + 1 });
      });
    }

    // Fire recoil (2 frames)
    this.registerSprite('player_fire_0', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { fire: true, torsoBob: -1 });
    });
    this.registerSprite('player_fire_1', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { torsoBob: 0 });
    });

    // Death frames (4 frames)
    for (let d = 0; d < 4; d++) {
      this.registerSprite(`player_death_${d}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { death: d + 1 });
      });
    }
  }

  // ==========================================
  // 2. REBEL SOLDIERS (4 TYPES)
  // ==========================================
  private generateRebelSprites(): void {
    const W = 36;
    const H = 40;
    const AX = 18;
    const AY = 38;
    const R = PALETTES.REBEL;

    const drawRebelBase = (
      ctx: CanvasContext2DLike,
      opts: {
        legL?: number;
        legR?: number;
        torsoBob?: number;
        type: 'rifle' | 'knife' | 'grenade' | 'shield';
        action?: string;
      }
    ) => {
      const bob = opts.torsoBob ?? 0;
      const legL = opts.legL ?? 0;
      const legR = opts.legR ?? 0;

      // Boots & Green uniform trousers
      ctx.fillStyle = R[14]; // Boots
      ctx.fillRect(11 + legL, 33, 6, 5);
      ctx.fillRect(18 + legR, 33, 6, 5);
      ctx.fillStyle = R[7];  // Pants shadow
      ctx.fillRect(12 + legL, 23 + bob, 5, 10);
      ctx.fillRect(18 + legR, 23 + bob, 5, 10);
      ctx.fillStyle = R[6];  // Uniform green
      ctx.fillRect(13 + legL, 23 + bob, 4, 9);
      ctx.fillRect(19 + legR, 23 + bob, 4, 9);

      // Torso & Red Rebel Armband
      ctx.fillStyle = R[7];
      ctx.fillRect(11, 13 + bob, 13, 10);
      ctx.fillStyle = R[6];
      ctx.fillRect(12, 13 + bob, 11, 9);
      ctx.fillStyle = R[12]; // Red armband
      ctx.fillRect(10, 15 + bob, 3, 4);

      // Head & Steel Stalhelm Helmet
      ctx.fillStyle = R[3]; // Helmet shadow
      ctx.fillRect(11, 4 + bob, 13, 8);
      ctx.fillStyle = R[2]; // Helmet grey
      ctx.fillRect(12, 3 + bob, 11, 7);
      ctx.fillRect(10, 8 + bob, 15, 3); // Helmet rim
      // Face
      ctx.fillStyle = R[5];
      ctx.fillRect(13, 8 + bob, 8, 5);
      ctx.fillStyle = R[4];
      ctx.fillRect(14, 8 + bob, 7, 4);

      // Weapon / Type specific arms
      if (opts.type === 'rifle') {
        ctx.fillStyle = R[11]; // Wooden stock
        ctx.fillRect(16, 16 + bob, 6, 3);
        ctx.fillStyle = R[9];  // Barrel
        ctx.fillRect(22, 15 + bob, 9, 2);

        if (opts.action === 'fire') {
          ctx.fillStyle = PALETTES.FIRE[1];
          ctx.fillRect(30, 14 + bob, 4, 4);
        }
      } else if (opts.type === 'knife') {
        if (opts.action === 'leap') {
          // Jumping leap with knife overhead
          ctx.fillStyle = R[9];
          ctx.fillRect(20, 2 + bob, 3, 8); // Blade up
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(21, 1 + bob, 2, 6);
        } else {
          // Raised knife
          ctx.fillStyle = R[9];
          ctx.fillRect(22, 13 + bob, 7, 3);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(25, 12 + bob, 4, 2);
        }
      } else if (opts.type === 'grenade') {
        if (opts.action === 'throw') {
          ctx.fillStyle = R[4]; ctx.fillRect(20, 10 + bob, 6, 3); // Extended arm
          ctx.fillStyle = '#3A5F20'; ctx.fillRect(27, 8 + bob, 4, 5); // Grenade in air
        } else {
          ctx.fillStyle = '#3A5F20'; ctx.fillRect(17, 16 + bob, 4, 5); // Pin pull
        }
      } else if (opts.type === 'shield') {
        // Large ballistic shield
        const sx = opts.action === 'bash' ? 24 : 20;
        ctx.fillStyle = '#2C343E';
        ctx.fillRect(sx, 10 + bob, 7, 24);
        ctx.fillStyle = '#606E7D';
        ctx.fillRect(sx + 1, 11 + bob, 5, 22);
        // Visor slit
        ctx.fillStyle = '#101010';
        ctx.fillRect(sx + 2, 14 + bob, 3, 2);
        // Rebel emblem on shield
        ctx.fillStyle = R[12];
        ctx.fillRect(sx + 2, 20 + bob, 3, 3);
      }
    };

    // 1. Rebel Rifleman
    this.registerSprite('rebel_rifle_idle', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'rifle' });
    });
    for (let i = 0; i < 4; i++) {
      const offsets = [{ l: -3, r: 3 }, { l: 0, r: 0 }, { l: 3, r: -3 }, { l: 0, r: 0 }];
      this.registerSprite(`rebel_rifle_walk_${i}`, W, H, AX, AY, (ctx) => {
        drawRebelBase(ctx, { type: 'rifle', legL: offsets[i].l, legR: offsets[i].r, torsoBob: i % 2 });
      });
    }
    this.registerSprite('rebel_rifle_fire_0', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'rifle', action: 'fire', torsoBob: -1 });
    });
    this.registerSprite('rebel_rifle_death_0', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = R[1]; ctx.fillRect(6, 16, 24, 18);
      ctx.fillStyle = R[2]; ctx.fillRect(22, 10, 8, 6); // Helmet flying
      ctx.fillStyle = R[6]; ctx.fillRect(8, 20, 16, 12);
    });

    // 2. Knife Charger
    this.registerSprite('rebel_knife_idle', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'knife' });
    });
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`rebel_knife_run_${i}`, W, H, AX, AY, (ctx) => {
        drawRebelBase(ctx, { type: 'knife', legL: i % 2 ? -4 : 4, legR: i % 2 ? 4 : -4, torsoBob: 1 });
      });
    }
    this.registerSprite('rebel_knife_leap', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'knife', action: 'leap', torsoBob: -3 });
    });

    // 3. Grenade Thrower
    this.registerSprite('rebel_grenade_idle', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'grenade' });
    });
    this.registerSprite('rebel_grenade_throw', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'grenade', action: 'throw' });
    });

    // 4. Shield Trooper
    this.registerSprite('rebel_shield_idle', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'shield' });
    });
    this.registerSprite('rebel_shield_bash', W, H, AX, AY, (ctx) => {
      drawRebelBase(ctx, { type: 'shield', action: 'bash' });
    });
  }

  // ==========================================
  // 3. HOSTAGE POW (PRISONER OF WAR)
  // ==========================================
  private generatePowSprites(): void {
    const W = 32;
    const H = 36;
    const AX = 16;
    const AY = 34;
    const P = PALETTES.POW;

    // Tied state (sitting, bound with hemp rope, long yellow beard)
    this.registerSprite('pow_tied_0', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = P[4]; ctx.fillRect(12, 10, 8, 7);  // Face
      ctx.fillStyle = P[2]; ctx.fillRect(9, 6, 14, 6);   // Bright yellow hair
      ctx.fillStyle = P[2]; ctx.fillRect(10, 14, 12, 12); // Long bushy beard
      ctx.fillStyle = P[6]; ctx.fillRect(9, 24, 14, 7);  // Blue shorts
      ctx.fillStyle = P[8]; ctx.fillRect(8, 18, 16, 4);  // Rope binding
      ctx.fillStyle = P[9]; ctx.fillRect(8, 20, 16, 2);  // Rope shade
    });
    this.registerSprite('pow_tied_1', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = P[4]; ctx.fillRect(12, 11, 8, 7);
      ctx.fillStyle = P[2]; ctx.fillRect(9, 7, 14, 6);
      ctx.fillStyle = P[2]; ctx.fillRect(11, 15, 12, 12); // Beard swaying slightly
      ctx.fillStyle = P[6]; ctx.fillRect(9, 25, 14, 7);
      ctx.fillStyle = P[8]; ctx.fillRect(8, 19, 16, 4);
    });

    // Freed state
    this.registerSprite('pow_freed', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = P[4]; ctx.fillRect(12, 6, 8, 6);   // Face
      ctx.fillStyle = P[2]; ctx.fillRect(9, 2, 14, 6);   // Hair
      ctx.fillStyle = P[2]; ctx.fillRect(11, 10, 10, 10); // Beard
      ctx.fillStyle = P[4]; ctx.fillRect(6, 4, 4, 8);    // Left arm raised
      ctx.fillStyle = P[4]; ctx.fillRect(22, 4, 4, 8);   // Right arm raised
      ctx.fillStyle = P[6]; ctx.fillRect(10, 20, 12, 8); // Blue shorts
      ctx.fillStyle = P[4]; ctx.fillRect(11, 28, 4, 6);  // Legs
      ctx.fillStyle = P[4]; ctx.fillRect(17, 28, 4, 6);
    });

    // Salute ("THANK YOU!")
    this.registerSprite('pow_salute_0', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = P[4]; ctx.fillRect(12, 6, 8, 6);
      ctx.fillStyle = P[2]; ctx.fillRect(9, 2, 14, 6);
      ctx.fillStyle = P[2]; ctx.fillRect(11, 10, 10, 10);
      ctx.fillStyle = P[4]; ctx.fillRect(18, 4, 8, 4);   // Right arm saluting
      ctx.fillStyle = P[6]; ctx.fillRect(10, 20, 12, 8);
      ctx.fillStyle = P[4]; ctx.fillRect(11, 28, 4, 6);
      ctx.fillStyle = P[4]; ctx.fillRect(17, 28, 4, 6);
    });

    // Drop item (digging into shorts, holds item gift crate)
    this.registerSprite('pow_drop_item', W, H, AX, AY, (ctx) => {
      ctx.fillStyle = P[4]; ctx.fillRect(12, 8, 8, 6);
      ctx.fillStyle = P[2]; ctx.fillRect(9, 4, 14, 6);
      ctx.fillStyle = P[2]; ctx.fillRect(11, 12, 10, 8);
      ctx.fillStyle = P[6]; ctx.fillRect(10, 20, 12, 8);
      // Red item box with gold ribbon
      ctx.fillStyle = P[12]; ctx.fillRect(20, 16, 9, 8);
      ctx.fillStyle = P[13]; ctx.fillRect(24, 16, 2, 8);
      ctx.fillStyle = P[13]; ctx.fillRect(20, 19, 9, 2);
    });

    // Escape run cycle (4 frames)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`pow_escape_${i}`, W, H, AX, AY, (ctx) => {
        const off = i % 2 ? -3 : 3;
        ctx.fillStyle = P[4]; ctx.fillRect(12, 7, 8, 6);
        ctx.fillStyle = P[2]; ctx.fillRect(9, 3, 14, 6);
        ctx.fillStyle = P[2]; ctx.fillRect(12, 11, 8, 9);
        ctx.fillStyle = P[6]; ctx.fillRect(10, 19, 12, 7);
        ctx.fillStyle = P[4]; ctx.fillRect(11 + off, 26, 4, 8);
        ctx.fillStyle = P[4]; ctx.fillRect(17 - off, 26, 4, 8);
      });
    }
  }

  // ==========================================
  // 4. MID-BOSS: IRON TECHNICAL VEHICLE
  // ==========================================
  private generateVehicleSprites(): void {
    const V = PALETTES.VEHICLE;

    // 1. Tank Hull (Width 136, Height 68)
    this.registerSprite('iron_technical_hull', 136, 68, 68, 60, (ctx) => {
      // Main chassis base
      ctx.fillStyle = V[1]; ctx.fillRect(8, 16, 120, 36);
      ctx.fillStyle = V[4]; ctx.fillRect(10, 18, 116, 32);
      ctx.fillStyle = V[2]; ctx.fillRect(12, 20, 112, 24);
      ctx.fillStyle = V[3]; ctx.fillRect(14, 20, 108, 6); // Highlight rim

      // Rivets
      ctx.fillStyle = V[8];
      for (let x = 16; x < 120; x += 14) {
        ctx.fillRect(x, 22, 2, 2);
        ctx.fillRect(x, 38, 2, 2);
      }

      // Bull-bar bumper on front right
      ctx.fillStyle = V[7];
      ctx.fillRect(120, 28, 8, 16);
      ctx.fillRect(124, 24, 4, 6);

      // Exhaust pipe on left
      ctx.fillStyle = V[10]; ctx.fillRect(12, 10, 6, 10);
      ctx.fillStyle = V[11]; ctx.fillRect(10, 8, 10, 4);

      // Hazard warning stripes on side
      ctx.fillStyle = V[14]; ctx.fillRect(40, 28, 24, 6);
      ctx.fillStyle = V[1];
      ctx.fillRect(44, 28, 4, 6);
      ctx.fillRect(52, 28, 4, 6);
    });

    // 2. Animated Treads (4 frames)
    for (let frame = 0; frame < 4; frame++) {
      this.registerSprite(`iron_technical_treads_${frame}`, 136, 24, 68, 12, (ctx) => {
        // Continuous rubber track band
        ctx.fillStyle = V[5]; ctx.fillRect(6, 2, 124, 18);
        ctx.fillStyle = V[6]; ctx.fillRect(8, 4, 120, 14);

        // Road wheels with spinning spokes
        const wheelCenters = [20, 44, 68, 92, 116];
        for (const cx of wheelCenters) {
          ctx.fillStyle = V[7];
          ctx.beginPath();
          ctx.arc(cx, 11, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = V[10];
          ctx.beginPath();
          ctx.arc(cx, 11, 3, 0, Math.PI * 2);
          ctx.fill();

          // Spoke rotation by frame
          const ang = (frame * Math.PI) / 2;
          ctx.fillStyle = V[6];
          ctx.fillRect(cx + Math.cos(ang) * 4 - 1, 11 + Math.sin(ang) * 4 - 1, 3, 3);
        }

        // Cleats on outer tread loop
        ctx.fillStyle = V[1];
        const offset = (frame * 4) % 10;
        for (let x = 8 + offset; x < 124; x += 10) {
          ctx.fillRect(x, 1, 3, 2);
          ctx.fillRect(x, 19, 3, 2);
        }
      });
    }

    // 3. Rotating 360° Autocannon Turret (48x28)
    this.registerSprite('iron_technical_turret', 48, 28, 24, 20, (ctx) => {
      // Cupola armored dome
      ctx.fillStyle = V[1]; ctx.fillRect(10, 8, 28, 16);
      ctx.fillStyle = V[9]; ctx.fillRect(12, 10, 24, 12);
      ctx.fillStyle = V[3]; ctx.fillRect(14, 10, 20, 4);

      // Double-fluted autocannon barrels extending forward
      ctx.fillStyle = V[10];
      ctx.fillRect(32, 12, 14, 3);
      ctx.fillRect(32, 17, 14, 3);
      // Flash suppressor tips
      ctx.fillStyle = V[7];
      ctx.fillRect(44, 11, 3, 5);
      ctx.fillRect(44, 16, 3, 5);
    });

    // 4. Burnt-out Wreckage
    this.registerSprite('iron_technical_wreckage', 136, 68, 68, 60, (ctx) => {
      ctx.fillStyle = '#1A1A1A'; ctx.fillRect(10, 20, 116, 36);
      ctx.fillStyle = '#332014'; ctx.fillRect(14, 24, 108, 28);
      ctx.fillStyle = '#0D0D0D'; ctx.fillRect(20, 28, 40, 16); // Engine blast hole
    });
  }

  // ==========================================
  // 5. STAGE 1 END-BOSS: TETSUYUKI WAR FORTRESS
  // ==========================================
  private generateFortressSprites(): void {
    const F = PALETTES.FORTRESS;

    // 1. Intact Hull Phase 1 (260x140)
    this.registerSprite('tetsuyuki_hull_p1', 260, 140, 130, 70, (ctx) => {
      // Giant fuselage body
      ctx.fillStyle = F[1]; ctx.fillRect(10, 20, 240, 100);
      ctx.fillStyle = F[4]; ctx.fillRect(14, 24, 232, 92);
      ctx.fillStyle = F[2]; ctx.fillRect(18, 28, 224, 84);
      ctx.fillStyle = F[3]; ctx.fillRect(22, 28, 216, 12); // Light ridge

      // Riveted plating panels
      ctx.fillStyle = F[5];
      for (let x = 30; x < 240; x += 36) {
        ctx.fillRect(x, 28, 2, 84);
      }
      ctx.fillRect(18, 64, 224, 2);

      // Warning hazard stripes on lower belly
      ctx.fillStyle = F[6]; ctx.fillRect(40, 96, 120, 12);
      ctx.fillStyle = F[7];
      for (let x = 40; x < 160; x += 16) {
        ctx.fillRect(x, 96, 8, 12);
      }

      // Coastal cliff foundation brackets
      ctx.fillStyle = '#30261C';
      ctx.fillRect(20, 112, 40, 18);
      ctx.fillRect(180, 112, 50, 18);
    });

    // 2. Hull Phase 2 (Damaged & Breached)
    this.registerSprite('tetsuyuki_hull_p2', 260, 140, 130, 70, (ctx) => {
      // Base fuselage
      ctx.fillStyle = F[1]; ctx.fillRect(10, 20, 240, 100);
      ctx.fillStyle = F[4]; ctx.fillRect(14, 24, 232, 92);
      ctx.fillStyle = F[2]; ctx.fillRect(18, 28, 224, 84);

      // Huge torn breach in front section
      ctx.fillStyle = '#0E1116';
      ctx.fillRect(20, 34, 70, 60);

      // Exposed structural steel girders
      ctx.fillStyle = F[7];
      ctx.fillRect(30, 36, 4, 56);
      ctx.fillRect(50, 36, 4, 56);
      ctx.fillRect(22, 58, 66, 4);

      // Copper wires & hydraulic leaks
      ctx.fillStyle = F[14];
      ctx.fillRect(36, 68, 16, 3);
      ctx.fillRect(42, 74, 18, 3);

      // Charred battle damage rust
      ctx.fillStyle = F[12];
      ctx.fillRect(80, 30, 40, 40);
    });

    // 3. Hull Phase 3 (Critical Overheating & Weak Point Chamber)
    this.registerSprite('tetsuyuki_hull_p3', 260, 140, 130, 70, (ctx) => {
      ctx.fillStyle = F[1]; ctx.fillRect(10, 20, 240, 100);
      ctx.fillStyle = '#2A1008'; ctx.fillRect(14, 24, 232, 92); // Overheated glowing hull

      // Open reactor core chamber in center
      ctx.fillStyle = '#05070A';
      ctx.fillRect(100, 38, 60, 60);

      // Warning hazard stripes around core hatch
      ctx.fillStyle = F[6];
      ctx.fillRect(96, 34, 68, 4);
      ctx.fillRect(96, 98, 68, 4);

      // Red overheating exhaust vents
      ctx.fillStyle = F[13];
      ctx.fillRect(170, 40, 40, 8);
      ctx.fillRect(170, 56, 40, 8);
      ctx.fillRect(170, 72, 40, 8);
    });

    // 4. Underside Artillery Cannon (64x32)
    this.registerSprite('tetsuyuki_cannon', 64, 32, 16, 16, (ctx) => {
      // Heavy swivel base
      ctx.fillStyle = F[1]; ctx.fillRect(4, 4, 24, 24);
      ctx.fillStyle = F[4]; ctx.fillRect(6, 6, 20, 20);

      // Massive 60mm artillery barrel extending leftwards
      ctx.fillStyle = F[1]; ctx.fillRect(20, 10, 40, 12);
      ctx.fillStyle = F[3]; ctx.fillRect(22, 12, 36, 8);
      // Muzzle crown
      ctx.fillStyle = F[5]; ctx.fillRect(58, 9, 4, 14);
    });

    // 5. Dorsal Rocket Launcher (48x36)
    this.registerSprite('tetsuyuki_rocket_pod_open', 48, 36, 24, 30, (ctx) => {
      ctx.fillStyle = F[1]; ctx.fillRect(6, 8, 36, 26);
      ctx.fillStyle = F[2]; ctx.fillRect(8, 10, 32, 22);

      // 5 Missile tube silos
      const tubes = [11, 17, 23, 29, 35];
      for (const tx of tubes) {
        ctx.fillStyle = '#101010';
        ctx.fillRect(tx, 14, 4, 12);
        // Missile warhead tip
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(tx, 12, 4, 4);
      }
    });

    // 6. Forward Rotary Gatling Gun (36x24)
    this.registerSprite('tetsuyuki_gatling', 36, 24, 18, 12, (ctx) => {
      ctx.fillStyle = F[1]; ctx.fillRect(4, 4, 16, 16);
      // 6 Rotating barrels
      ctx.fillStyle = F[5];
      ctx.fillRect(18, 6, 16, 2);
      ctx.fillRect(18, 10, 16, 2);
      ctx.fillRect(18, 14, 16, 2);
      ctx.fillRect(18, 18, 16, 2);
      // Barrel bracket
      ctx.fillStyle = F[3]; ctx.fillRect(26, 5, 4, 16);
    });

    // 7. Thermal Laser Beam (240x24)
    this.registerSprite('tetsuyuki_laser_beam', 240, 24, 0, 12, (ctx) => {
      // Intense plasma red outer aura
      ctx.fillStyle = F[10]; ctx.fillRect(0, 2, 240, 20);
      // Hot orange mid-beam
      ctx.fillStyle = '#FF8800'; ctx.fillRect(0, 5, 240, 14);
      // Pure white blinding core
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 8, 240, 8);
    });

    // 8. Pulsing Reactor Core (48x48)
    this.registerSprite('tetsuyuki_reactor_core', 48, 48, 24, 24, (ctx) => {
      // Outer containment ring
      ctx.fillStyle = F[8];
      ctx.beginPath();
      ctx.arc(24, 24, 20, 0, Math.PI * 2);
      ctx.fill();

      // Bright white-hot plasma center
      ctx.fillStyle = F[9];
      ctx.beginPath();
      ctx.arc(24, 24, 12, 0, Math.PI * 2);
      ctx.fill();

      // Energy spikes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(22, 0, 4, 48);
      ctx.fillRect(0, 22, 48, 4);
    });
  }

  // ==========================================
  // 6. PROJECTILES & WEAPON EFFECTS
  // ==========================================
  private generateProjectileSprites(): void {
    // Handgun bullet (6x3)
    this.registerSprite('proj_bullet_handgun', 8, 4, 4, 2, (ctx) => {
      ctx.fillStyle = '#FFF060'; ctx.fillRect(2, 1, 5, 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(5, 1, 2, 2);
      ctx.fillStyle = '#FFA010'; ctx.fillRect(0, 1, 2, 2); // Trail
    });

    // Heavy Machine Gun tracer (10x4)
    this.registerSprite('proj_bullet_hmg', 12, 6, 6, 3, (ctx) => {
      ctx.fillStyle = '#3A7BD5'; ctx.fillRect(0, 1, 10, 4); // Blue aura
      ctx.fillStyle = '#FFF060'; ctx.fillRect(2, 2, 8, 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(6, 2, 5, 2);  // White core
    });

    // Brass shell casings tumbling (4 angles)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`casing_brass_${i}`, 6, 6, 3, 3, (ctx) => {
        ctx.save();
        ctx.translate(3, 3);
        ctx.rotate((i * Math.PI) / 2);
        ctx.fillStyle = '#D8C890'; ctx.fillRect(-2, -1, 4, 2);
        ctx.fillStyle = '#908050'; ctx.fillRect(-2, -1, 1, 2); // Primer end
        ctx.restore();
      });
    }

    // Flame stream fireballs (5 expanding sizes)
    const flameRadii = [6, 10, 15, 20, 25];
    for (let i = 0; i < flameRadii.length; i++) {
      const r = flameRadii[i];
      const size = r * 2 + 4;
      this.registerSprite(`proj_flame_${i}`, size, size, size / 2, size / 2, (ctx) => {
        // Red edge
        ctx.fillStyle = PALETTES.FIRE[4];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.fill();
        // Orange body
        ctx.fillStyle = PALETTES.FIRE[3];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.75, 0, Math.PI * 2); ctx.fill();
        // Yellow hot midtone
        ctx.fillStyle = PALETTES.FIRE[2];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.5, 0, Math.PI * 2); ctx.fill();
        // White core
        ctx.fillStyle = PALETTES.FIRE[1];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.25, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Hand Grenade (12x12, 4 rotation angles)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`proj_grenade_${i}`, 14, 14, 7, 7, (ctx) => {
        ctx.save();
        ctx.translate(7, 7);
        ctx.rotate((i * Math.PI) / 2);
        // Pineapple body
        ctx.fillStyle = '#2D451C'; ctx.fillRect(-4, -4, 8, 9);
        ctx.fillStyle = '#4D6B35'; ctx.fillRect(-3, -3, 6, 7);
        // Segment grid
        ctx.fillStyle = '#1D2E12';
        ctx.fillRect(-4, -1, 8, 1);
        ctx.fillRect(-1, -4, 1, 9);
        // Fuse & spoon
        ctx.fillStyle = '#808890'; ctx.fillRect(-2, -6, 3, 2);
        ctx.restore();
      });
    }

    // Homing micro-rocket (16x8)
    this.registerSprite('proj_rocket', 18, 10, 9, 5, (ctx) => {
      // Missile body
      ctx.fillStyle = '#E8F0F8'; ctx.fillRect(4, 3, 10, 4);
      // Red warhead tip
      ctx.fillStyle = '#E74C3C'; ctx.fillRect(14, 3, 3, 4);
      // Stabilizing fins
      ctx.fillStyle = '#384048';
      ctx.fillRect(2, 1, 4, 2);
      ctx.fillRect(2, 7, 4, 2);
      // Exhaust fire
      ctx.fillStyle = '#FFA010'; ctx.fillRect(0, 3, 3, 4);
    });

    // Heavy mortar shell (14x10)
    this.registerSprite('proj_mortar', 16, 12, 8, 6, (ctx) => {
      ctx.fillStyle = '#202020'; ctx.fillRect(2, 2, 12, 8);
      ctx.fillStyle = '#7F8C8D'; ctx.fillRect(4, 3, 8, 6);
      ctx.fillStyle = '#E74C3C'; ctx.fillRect(12, 4, 3, 4);
    });
  }

  // ==========================================
  // 7. MULTI-FRAME EXPLOSIONS
  // ==========================================
  private generateExplosionSprites(): void {
    // 1. Small Explosion (4 frames, 24x24)
    for (let f = 0; f < 4; f++) {
      const size = 28;
      this.registerSprite(`explosion_small_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const rad = 4 + f * 3;
        if (f < 2) {
          ctx.fillStyle = PALETTES.FIRE[1]; ctx.beginPath(); ctx.arc(14, 14, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[2]; ctx.beginPath(); ctx.arc(14, 14, rad * 0.7, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = PALETTES.FIRE[4]; ctx.beginPath(); ctx.arc(14, 14, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[7]; ctx.fillRect(8, 8, 12, 12); // Smoke puff
        }
      });
    }

    // 2. Medium Explosion (6 frames, 48x48)
    for (let f = 0; f < 6; f++) {
      const size = 52;
      this.registerSprite(`explosion_medium_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const rad = 6 + f * 3.5;
        const col = f < 2 ? PALETTES.FIRE[1] : f < 4 ? PALETTES.FIRE[3] : PALETTES.FIRE[7];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(26, 26, rad, 0, Math.PI * 2); ctx.fill();

        // Edge sparks
        if (f < 4) {
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(26 - rad - 2, 26, 3, 3);
          ctx.fillRect(26 + rad - 1, 26, 3, 3);
          ctx.fillRect(26, 26 - rad - 2, 3, 3);
          ctx.fillRect(26, 26 + rad - 1, 3, 3);
        }
      });
    }

    // 3. Large Boss Detonation (8 frames, 96x96)
    for (let f = 0; f < 8; f++) {
      const size = 100;
      this.registerSprite(`explosion_large_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const progress = f / 7;
        const rad = 10 + progress * 36;

        if (progress < 0.5) {
          // Shockwave expansion ring
          ctx.strokeStyle = PALETTES.FIRE[1];
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(50, 50, rad * 1.1, 0, Math.PI * 2); ctx.stroke();

          // Blazing white & orange core
          ctx.fillStyle = PALETTES.FIRE[2]; ctx.beginPath(); ctx.arc(50, 50, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[1]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.5, 0, Math.PI * 2); ctx.fill();
        } else {
          // Billowing dark soot and smoke
          ctx.fillStyle = PALETTES.FIRE[8]; ctx.beginPath(); ctx.arc(50, 50, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[5]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.4, 0, Math.PI * 2); ctx.fill();
        }
      });
    }
  }

  // ==========================================
  // 8. RETRO ARCADE HUD BADGES & DIGITS
  // ==========================================
  private generateHudSprites(): void {
    const H = PALETTES.HUD;

    // "H" Heavy Machine Gun Badge (24x20)
    this.registerSprite('hud_badge_hmg', 24, 20, 0, 0, (ctx) => {
      // Golden beveled border
      ctx.fillStyle = H[2]; ctx.fillRect(0, 0, 24, 20);
      ctx.fillStyle = H[3]; ctx.fillRect(1, 1, 22, 18);
      // Blue fill
      ctx.fillStyle = H[4]; ctx.fillRect(2, 2, 20, 16);
      // Bold letter 'H'
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 5, 3, 10);
      ctx.fillRect(15, 5, 3, 10);
      ctx.fillRect(9, 9, 6, 3);
    });

    // "F" Flame Shot Badge (24x20)
    this.registerSprite('hud_badge_flame', 24, 20, 0, 0, (ctx) => {
      ctx.fillStyle = H[2]; ctx.fillRect(0, 0, 24, 20);
      ctx.fillStyle = H[3]; ctx.fillRect(1, 1, 22, 18);
      // Red fill
      ctx.fillStyle = H[5]; ctx.fillRect(2, 2, 20, 16);
      // Bold letter 'F'
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 5, 3, 10);
      ctx.fillRect(10, 5, 7, 3);
      ctx.fillRect(10, 9, 5, 3);
    });

    // Default Handgun Badge (24x20)
    this.registerSprite('hud_badge_pistol', 24, 20, 0, 0, (ctx) => {
      ctx.fillStyle = H[2]; ctx.fillRect(0, 0, 24, 20);
      ctx.fillStyle = H[3]; ctx.fillRect(1, 1, 22, 18);
      ctx.fillStyle = '#455A64'; ctx.fillRect(2, 2, 20, 16);
      // Pistol icon
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 7, 10, 3);
      ctx.fillRect(12, 10, 4, 5);
    });

    // Grenade Icon (16x16)
    this.registerSprite('hud_icon_grenade', 16, 16, 0, 0, (ctx) => {
      ctx.fillStyle = H[9]; ctx.fillRect(3, 4, 10, 10);
      ctx.fillStyle = H[10]; ctx.fillRect(4, 5, 8, 8);
      ctx.fillStyle = '#D4AC0D'; ctx.fillRect(6, 1, 4, 3);
    });

    // POW Hostage Icon (16x16)
    this.registerSprite('hud_icon_pow', 16, 16, 0, 0, (ctx) => {
      ctx.fillStyle = '#F8E060'; ctx.fillRect(3, 2, 10, 6);
      ctx.fillStyle = '#F0B070'; ctx.fillRect(4, 6, 8, 4);
      ctx.fillStyle = '#F8E060'; ctx.fillRect(3, 9, 10, 6); // Beard
    });

    // Score & Ammo Digits 0 to 9 (8x12 each)
    const digitBitmaps: Record<string, string[]> = {
      '0': ['1111', '1001', '1001', '1001', '1001', '1111'],
      '1': ['0010', '0110', '0010', '0010', '0010', '0111'],
      '2': ['1111', '0001', '1111', '1000', '1000', '1111'],
      '3': ['1111', '0001', '0111', '0001', '0001', '1111'],
      '4': ['1001', '1001', '1111', '0001', '0001', '0001'],
      '5': ['1111', '1000', '1111', '0001', '0001', '1111'],
      '6': ['1111', '1000', '1111', '1001', '1001', '1111'],
      '7': ['1111', '0001', '0010', '0010', '0100', '0100'],
      '8': ['1111', '1001', '1111', '1001', '1001', '1111'],
      '9': ['1111', '1001', '1111', '0001', '0001', '1111'],
    };

    for (let d = 0; d <= 9; d++) {
      const digitKey = String(d);
      const rows = digitBitmaps[digitKey];
      this.registerSprite(`hud_digit_${d}`, 8, 12, 0, 0, (ctx) => {
        // Drop shadow
        ctx.fillStyle = H[1];
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] === '1') {
              ctx.fillRect(x * 2 + 1, y * 2 + 1, 2, 2);
            }
          }
        }
        // Gold face
        ctx.fillStyle = H[7];
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] === '1') {
              ctx.fillRect(x * 2, y * 2, 2, 2);
            }
          }
        }
      });
    }

    // Special symbol 'infinity' (for default handgun ammo)
    this.registerSprite('hud_symbol_infinity', 12, 10, 0, 0, (ctx) => {
      ctx.fillStyle = H[6];
      ctx.fillRect(1, 3, 4, 4);
      ctx.fillRect(7, 3, 4, 4);
      ctx.fillRect(3, 4, 6, 2);
    });

    // Boss Health Bar Frame (180x10)
    this.registerSprite('hud_boss_bar_frame', 184, 12, 0, 0, (ctx) => {
      ctx.fillStyle = H[1]; ctx.fillRect(0, 0, 184, 12);
      ctx.fillStyle = H[2]; ctx.fillRect(1, 1, 182, 10);
      ctx.fillStyle = '#222222'; ctx.fillRect(2, 2, 180, 8);
    });
  }
}
