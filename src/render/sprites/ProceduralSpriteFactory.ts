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

// ==========================================
// NEO GEO PIXEL-ART MICRO-PRIMITIVE ROUTINES
// ==========================================

/**
 * Draws a single pixel on canvas context.
 */
export function drawPixel(ctx: CanvasContext2DLike, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

/**
 * Draws a horizontal span of pixels.
 */
export function drawPixelSpan(ctx: CanvasContext2DLike, x: number, y: number, length: number, color: string): void {
  if (length <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), length, 1);
}

/**
 * Draws a vertical span of pixels.
 */
export function drawPixelColumn(ctx: CanvasContext2DLike, x: number, y: number, length: number, color: string): void {
  if (length <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, length);
}

/**
 * Draws a pixel cluster from character-mapped rows.
 */
export function drawPixelCluster(
  ctx: CanvasContext2DLike,
  startX: number,
  startY: number,
  rows: string[],
  paletteMap: Record<string, string>
): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch !== ' ' && ch !== '.' && paletteMap[ch]) {
        ctx.fillStyle = paletteMap[ch];
        ctx.fillRect(startX + c, startY + r, 1, 1);
      }
    }
  }
}

/**
 * Draws a contoured rectangle with dark outline, inner fill, and optional highlights/shadows.
 */
export function drawContouredRect(
  ctx: CanvasContext2DLike,
  x: number,
  y: number,
  w: number,
  h: number,
  outlineColor: string,
  fillColor: string,
  highlightColor?: string,
  shadowColor?: string
): void {
  if (w <= 0 || h <= 0) return;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  ctx.fillStyle = outlineColor;
  ctx.fillRect(ix, iy, w, h);

  if (w > 2 && h > 2) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(ix + 1, iy + 1, w - 2, h - 2);

    if (highlightColor && w > 3 && h > 3) {
      ctx.fillStyle = highlightColor;
      ctx.fillRect(ix + 1, iy + 1, w - 3, 1);
      ctx.fillRect(ix + 1, iy + 1, 1, h - 3);
    }

    if (shadowColor && w > 3 && h > 3) {
      ctx.fillStyle = shadowColor;
      ctx.fillRect(ix + 2, iy + h - 2, w - 3, 1);
      ctx.fillRect(ix + w - 2, iy + 2, 1, h - 3);
    }
  }
}

/**
 * Draws an armored beveled plate with bright light edge and dark shadow bevel.
 */
export function drawBeveledPlate(
  ctx: CanvasContext2DLike,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: string,
  lightBevel: string,
  darkBevel: string,
  outlineColor?: string
): void {
  let ox = Math.floor(x);
  let oy = Math.floor(y);
  let ow = Math.floor(w);
  let oh = Math.floor(h);

  if (outlineColor) {
    ctx.fillStyle = outlineColor;
    ctx.fillRect(ox, oy, ow, oh);
    ox += 1;
    oy += 1;
    ow -= 2;
    oh -= 2;
  }
  if (ow <= 0 || oh <= 0) return;

  ctx.fillStyle = fillColor;
  ctx.fillRect(ox, oy, ow, oh);

  ctx.fillStyle = lightBevel;
  ctx.fillRect(ox, oy, ow, 1);
  ctx.fillRect(ox, oy, 1, oh);

  ctx.fillStyle = darkBevel;
  ctx.fillRect(ox, oy + oh - 1, ow, 1);
  ctx.fillRect(ox + ow - 1, oy, 1, oh);
}

/**
 * Draws a metallic rivet head with specular glint and drop shadow.
 */
export function drawRivet(
  ctx: CanvasContext2DLike,
  x: number,
  y: number,
  baseColor: string = '#808890',
  highlightColor: string = '#FFFFFF',
  shadowColor: string = '#181818'
): void {
  const rx = Math.floor(x);
  const ry = Math.floor(y);
  ctx.fillStyle = shadowColor;
  ctx.fillRect(rx, ry, 2, 2);
  ctx.fillStyle = baseColor;
  ctx.fillRect(rx, ry, 1, 2);
  ctx.fillStyle = highlightColor;
  ctx.fillRect(rx, ry, 1, 1);
}

/**
 * Draws fabric wrinkles / folds.
 */
export function drawFabricFolds(
  ctx: CanvasContext2DLike,
  x: number,
  y: number,
  w: number,
  baseColor: string,
  shadowColor: string,
  highlightColor?: string
): void {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  ctx.fillStyle = baseColor;
  ctx.fillRect(fx, fy, w, 2);
  ctx.fillStyle = shadowColor;
  ctx.fillRect(fx, fy + 1, w, 1);
  ctx.fillRect(fx + 1, fy + 2, Math.max(1, w - 2), 1);
  if (highlightColor) {
    ctx.fillStyle = highlightColor;
    ctx.fillRect(fx, fy - 1, Math.max(1, w - 1), 1);
  }
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

  private readonly polishKeys: Set<string> = new Set([
    'parachute_canopy',
    'rebel_death_standard_0',
    'rebel_death_standard_1',
    'rebel_death_standard_2',
    'rebel_death_standard_3',
    'rebel_death_explosion_air',
    'rebel_death_explosion_helmet',
    'rebel_death_explosion_land_0',
    'rebel_death_explosion_land_1',
    'rebel_death_burn_thrash_0',
    'rebel_death_burn_thrash_1',
    'rebel_death_burn_charcoal_0',
    'rebel_death_burn_ash_0',
    'rebel_death_burn_ash_1',
  ]);

  public hasSprite(key: string): boolean {
    return this.spriteCache.has(key);
  }

  public getAllKeys(includePolish: boolean = false): string[] {
    if (includePolish) {
      return Array.from(this.spriteCache.keys());
    }
    return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
  }

  public count(includePolish: boolean = false): number {
    return this.getAllKeys(includePolish).length;
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

  /**
   * Registers an alias pointing to an existing sprite frame.
   */
  private aliasSprite(aliasKey: string, sourceKey: string): void {
    const frame = this.spriteCache.get(sourceKey);
    if (frame) {
      this.spriteCache.set(aliasKey, frame);
    }
  }

  // ==========================================
  // 1. PLAYER (MARCO ROSSI) SPRITE GENERATION
  // ==========================================
  private generatePlayerSprites(): void {
    const W = 36;
    const H = 42;
    const AX = 18;
    const AY = 40;
    const P = PALETTES.PLAYER;

    // Helper: Draw authentic 16-color Marco Rossi
    const drawSoldier = (
      ctx: CanvasContext2DLike,
      opts: {
        legOffsetL?: number;
        legOffsetR?: number;
        torsoBob?: number;
        aimAngle?: number; // 0..7
        headbandFlutter?: number;
        crouch?: boolean;
        crawl?: boolean;
        knife?: number; // 0=none, 1=windup, 2=slash, 3=follow
        fire?: boolean;
        death?: number; // 0=none, 1=hit, 2=fly, 3=tumble, 4=down
      }
    ) => {
      const bob = opts.torsoBob ?? 0;
      const isCrouch = !!opts.crouch;

      // ----------------------------------------------------
      // DEATH ANIMATIONS (Authentic Arcade Knockdown & Defeat)
      // ----------------------------------------------------
      if (opts.death) {
        const d = opts.death;
        if (d === 1) {
          // Flinch / Impact shock
          drawContouredRect(ctx, 10, 14, 16, 24, P[1], P[13], P[6], P[14]);
          // Flying head with grimace
          drawContouredRect(ctx, 11, 8, 14, 10, P[1], P[7], P[6], P[8]);
          // Red headband tearing loose
          ctx.fillStyle = P[4]; ctx.fillRect(10, 10, 16, 3);
          ctx.fillStyle = P[5]; ctx.fillRect(8, 11, 4, 3);
          // Blonde hair ruffled
          ctx.fillStyle = P[2]; ctx.fillRect(12, 5, 12, 5);
          ctx.fillStyle = P[3]; ctx.fillRect(14, 4, 8, 3);
          // Undershirt and torn vest
          ctx.fillStyle = P[9]; ctx.fillRect(14, 18, 8, 8);
          ctx.fillStyle = P[11]; ctx.fillRect(11, 18, 4, 10);
          ctx.fillStyle = P[12]; ctx.fillRect(21, 18, 4, 10);
          // Legs buckle
          ctx.fillStyle = P[14]; ctx.fillRect(9, 28, 7, 8);
          ctx.fillStyle = P[14]; ctx.fillRect(19, 28, 7, 8);
          ctx.fillStyle = P[15]; ctx.fillRect(8, 35, 8, 5);
          ctx.fillStyle = P[15]; ctx.fillRect(20, 35, 8, 5);
        } else if (d === 2) {
          // Airborne spiral tumble
          ctx.save();
          ctx.translate(18, 20);
          ctx.rotate(-0.35);
          drawContouredRect(ctx, -14, -8, 28, 16, P[1], P[11], P[13], P[12]);
          // Hair and detached headband flying behind
          ctx.fillStyle = P[2]; ctx.fillRect(4, -12, 10, 8);
          ctx.fillStyle = P[4]; ctx.fillRect(-16, -14, 10, 3); // Flying headband ribbon
          ctx.fillStyle = P[5]; ctx.fillRect(-22, -13, 8, 2);
          // Arms splayed
          ctx.fillStyle = P[7]; ctx.fillRect(-12, -14, 5, 6);
          ctx.fillStyle = P[7]; ctx.fillRect(8, -14, 5, 6);
          // Boots trailing
          ctx.fillStyle = P[15]; ctx.fillRect(-18, -4, 6, 8);
          ctx.restore();
        } else if (d === 3) {
          // Falling downward impact
          drawContouredRect(ctx, 6, 18, 24, 16, P[1], P[13], P[11], P[14]);
          ctx.fillStyle = P[2]; ctx.fillRect(18, 16, 10, 6);
          ctx.fillStyle = P[4]; ctx.fillRect(26, 12, 6, 4);
          ctx.fillStyle = P[15]; ctx.fillRect(4, 26, 8, 6);
          ctx.fillStyle = P[15]; ctx.fillRect(14, 28, 8, 6);
        } else {
          // Lying flat on ground, defeated
          // Torso & legs flat
          drawContouredRect(ctx, 4, 32, 28, 8, P[1], P[13], P[11], P[14]);
          // Blonde hair fallen
          ctx.fillStyle = P[2]; ctx.fillRect(6, 30, 8, 5);
          ctx.fillStyle = P[3]; ctx.fillRect(7, 29, 6, 3);
          // Olive vest
          ctx.fillStyle = P[11]; ctx.fillRect(14, 32, 10, 6);
          ctx.fillStyle = P[9]; ctx.fillRect(16, 33, 5, 4);
          // Combat boots fallen
          ctx.fillStyle = P[15]; ctx.fillRect(26, 32, 7, 6);
          // Dropped red headband on ground
          ctx.fillStyle = P[4]; ctx.fillRect(0, 34, 6, 3);
          ctx.fillStyle = P[5]; ctx.fillRect(1, 35, 4, 2);
        }
        return;
      }

      // ----------------------------------------------------
      // 1. LEGS, TROUSERS, HOLSTER & COMBAT BOOTS
      // ----------------------------------------------------
      const legY = isCrouch ? 27 : 23 + bob;
      const legL = opts.legOffsetL ?? 0;
      const legR = opts.legOffsetR ?? 0;

      if (isCrouch) {
        // Kneeling low crouch legs
        drawContouredRect(ctx, 8 + legL, legY, 11, 7, P[1], P[13], P[13], P[14]);
        drawContouredRect(ctx, 16 + legR, legY, 11, 7, P[1], P[13], P[13], P[14]);
        // Boots flat on ground
        drawContouredRect(ctx, 6 + legL, legY + 6, 10, 5, P[1], P[15], P[14], P[1]);
        drawContouredRect(ctx, 18 + legR, legY + 6, 10, 5, P[1], P[15], P[14], P[1]);
      } else {
        // Standing / Running legs
        // Left Leg & Fabric Folds
        drawContouredRect(ctx, 11 + legL, legY, 6, 11, P[1], P[13], P[13], P[14]);
        drawFabricFolds(ctx, 12 + legL, legY + 4, 4, P[13], P[14], P[6]);

        // Right Leg & Thigh Holster
        drawContouredRect(ctx, 18 + legR, legY, 6, 11, P[1], P[13], P[13], P[14]);
        drawFabricFolds(ctx, 19 + legR, legY + 4, 4, P[13], P[14], P[6]);

        // Leather side holster on right thigh
        ctx.fillStyle = P[15];
        ctx.fillRect(22 + legR, legY + 2, 3, 5); // Holster body
        ctx.fillStyle = P[1];
        ctx.fillRect(21 + legR, legY + 3, 4, 1); // Retention strap
        ctx.fillStyle = P[2];
        ctx.fillRect(23 + legR, legY + 4, 1, 1); // Brass buckle

        // Heavy Combat Boots (notched rubber soles & lacing)
        drawContouredRect(ctx, 10 + legL, legY + 11, 7, 6, P[1], P[15], P[14], P[1]);
        drawContouredRect(ctx, 18 + legR, legY + 11, 7, 6, P[1], P[15], P[14], P[1]);

        // Boot sole treads (notches)
        ctx.fillStyle = P[1];
        ctx.fillRect(10 + legL, legY + 16, 7, 1);
        ctx.fillRect(18 + legR, legY + 16, 7, 1);
        ctx.fillStyle = P[14];
        ctx.fillRect(12 + legL, legY + 12, 2, 2); // Laces
        ctx.fillRect(20 + legR, legY + 12, 2, 2);
      }

      // ----------------------------------------------------
      // 2. UTILITY BELT & AMMO CARTRIDGES
      // ----------------------------------------------------
      const beltY = isCrouch ? 24 : 21 + bob;
      ctx.fillStyle = P[14];
      ctx.fillRect(11, beltY, 14, 3);
      ctx.fillStyle = P[1];
      ctx.fillRect(11, beltY, 14, 1);
      // Gold belt buckle
      ctx.fillStyle = P[2];
      ctx.fillRect(17, beltY, 3, 3);
      ctx.fillStyle = P[3];
      ctx.fillRect(18, beltY + 1, 1, 1);
      // Brass ammo cartridges on belt
      ctx.fillStyle = P[2];
      ctx.fillRect(12, beltY + 1, 1, 2);
      ctx.fillRect(14, beltY + 1, 1, 2);
      ctx.fillRect(21, beltY + 1, 1, 2);
      ctx.fillRect(23, beltY + 1, 1, 2);

      // ----------------------------------------------------
      // 3. TORSO (WHITE UNDERSHIRT & OLIVE TACTICAL VEST)
      // ----------------------------------------------------
      const torsoY = isCrouch ? 15 : 12 + bob;

      // White athletic muscle tee (center chest)
      drawContouredRect(ctx, 13, torsoY + 1, 9, 8, P[1], P[9], P[9], P[10]);
      // Pectoral muscle crease
      ctx.fillStyle = P[10];
      ctx.fillRect(17, torsoY + 4, 1, 4);

      // Olive Tactical Vest (with lapels, collar, and pockets)
      // Left vest panel
      drawContouredRect(ctx, 10, torsoY, 4, 9, P[1], P[11], P[11], P[12]);
      // Right vest panel
      drawContouredRect(ctx, 21, torsoY, 4, 9, P[1], P[11], P[11], P[12]);
      // Vest collar trim
      ctx.fillStyle = P[11];
      ctx.fillRect(12, torsoY - 1, 3, 2);
      ctx.fillRect(20, torsoY - 1, 3, 2);
      // Brass snap pockets
      ctx.fillStyle = P[2];
      ctx.fillRect(11, torsoY + 4, 2, 2);
      ctx.fillRect(22, torsoY + 4, 2, 2);

      // ----------------------------------------------------
      // 4. HEAD, MULTI-TONE BLONDE HAIR, RED HEADBAND & FACE
      // ----------------------------------------------------
      const headY = isCrouch ? 7 : 4 + bob;
      const flut = opts.headbandFlutter ?? 0;

      // Neck & jaw shading
      ctx.fillStyle = P[8];
      ctx.fillRect(16, headY + 8, 4, 2);

      // Blonde Hair (Base volume)
      drawContouredRect(ctx, 12, headY - 1, 12, 7, P[1], P[3], P[2], P[3]);
      // Spiky mop hair crown
      ctx.fillStyle = P[2];
      ctx.fillRect(11, headY - 2, 3, 3);
      ctx.fillRect(14, headY - 4, 4, 4);
      ctx.fillRect(18, headY - 4, 4, 4);
      ctx.fillRect(22, headY - 2, 3, 3);
      // Specular golden hair highlights
      ctx.fillStyle = '#FFF8A0';
      ctx.fillRect(15, headY - 3, 2, 2);
      ctx.fillRect(19, headY - 3, 2, 2);

      // Red Headband (3-pixel band wrapped across brow)
      drawContouredRect(ctx, 11, headY + 2, 14, 4, P[1], P[4], P[4], P[5]);
      // Specular headband rim
      ctx.fillStyle = '#FF5533';
      ctx.fillRect(12, headY + 3, 11, 1);

      // Fluttering Ribbon Tails (2 trailing silk ribbons with sine flutter)
      const rY = headY + 3 + flut;
      // Top ribbon tail
      ctx.fillStyle = P[1]; ctx.fillRect(6, rY, 6, 3);
      ctx.fillStyle = P[4]; ctx.fillRect(7, rY + 1, 5, 1);
      ctx.fillStyle = P[5]; ctx.fillRect(4, rY + 1, 3, 2);
      // Bottom ribbon tail
      ctx.fillStyle = P[1]; ctx.fillRect(4, rY + 2 + flut * 0.5, 6, 3);
      ctx.fillStyle = P[4]; ctx.fillRect(5, rY + 3 + flut * 0.5, 5, 1);
      ctx.fillStyle = P[5]; ctx.fillRect(2, rY + 3 + flut * 0.5, 3, 2);

      // Face (3-Tone Shaded Skin: #FFCC99, #E09860, #905030)
      drawContouredRect(ctx, 14, headY + 5, 9, 6, P[1], P[7], P[6], P[8]);
      // Cheek highlight & nose
      ctx.fillStyle = P[6]; ctx.fillRect(16, headY + 6, 3, 2);
      ctx.fillStyle = P[8]; ctx.fillRect(21, headY + 7, 2, 1); // Nose shadow
      // Determined arcade eye with white glint
      ctx.fillStyle = P[9]; ctx.fillRect(19, headY + 6, 3, 2); // White sclera
      ctx.fillStyle = P[1]; ctx.fillRect(20, headY + 6, 2, 2); // Pupil

      // Blonde bangs falling over headband
      ctx.fillStyle = P[2];
      ctx.fillRect(14, headY + 3, 2, 2);
      ctx.fillRect(18, headY + 3, 3, 2);

      // ----------------------------------------------------
      // 5. ARMS, HANDS, WEAPONS & MELEE KNIFE
      // ----------------------------------------------------
      const armY = isCrouch ? 16 : 13 + bob;

      if (opts.knife) {
        // Melee Combat Knife Action
        const k = opts.knife;
        if (k === 1) {
          // Windup: arm drawn back, bowie knife gleaming
          drawContouredRect(ctx, 8, armY - 2, 5, 8, P[1], P[7], P[6], P[8]);
          // Combat knife handle
          ctx.fillStyle = P[15]; ctx.fillRect(7, armY - 6, 3, 5);
          // Gleaming steel blade
          ctx.fillStyle = P[9]; ctx.fillRect(7, armY - 13, 3, 8);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(8, armY - 13, 1, 8);
        } else if (k === 2) {
          // Active Slash: extended thrust with gleaming white/silver slash arc!
          drawContouredRect(ctx, 16, armY - 2, 10, 5, P[1], P[7], P[6], P[8]);
          // Knife blade extended
          ctx.fillStyle = P[9]; ctx.fillRect(25, armY - 4, 8, 3);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(27, armY - 4, 6, 1);
          // Brilliant dynamic slash trail
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(24, armY - 10, 3, 18);
          ctx.fillRect(27, armY - 8, 7, 14);
          ctx.fillStyle = '#A0D8EF';
          ctx.fillRect(29, armY - 6, 6, 10);
        } else {
          // Follow-through
          drawContouredRect(ctx, 18, armY + 1, 8, 5, P[1], P[7], P[6], P[8]);
          ctx.fillStyle = P[9]; ctx.fillRect(25, armY + 3, 6, 3);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(26, armY + 3, 4, 1);
        }
      } else {
        // Firearm Aiming & Directional Poses
        const aim = opts.aimAngle ?? 0;
        // Muscular bare arm holding weapon
        drawContouredRect(ctx, 16, armY, 5, 5, P[1], P[7], P[6], P[8]);

        // Gun metal receiver & barrel
        ctx.fillStyle = P[15];
        if (aim === 0) {
          // 0: Horizontal Forward (Rifle at shoulder height)
          ctx.fillRect(19, armY, 11, 4);      // Receiver & barrel
          ctx.fillStyle = P[10]; ctx.fillRect(20, armY + 1, 9, 1); // Steel shine
          ctx.fillStyle = P[1]; ctx.fillRect(21, armY + 4, 3, 3);  // Magazine
          ctx.fillStyle = P[15]; ctx.fillRect(28, armY - 1, 2, 2); // Front sight pin
        } else if (aim === 1) {
          // 1: 45° Up-Forward (Diagonal upward aim)
          ctx.fillRect(18, armY - 6, 8, 8);
          ctx.fillRect(23, armY - 9, 6, 6);
          ctx.fillStyle = P[10]; ctx.fillRect(20, armY - 5, 7, 2);
          ctx.fillStyle = P[15]; ctx.fillRect(28, armY - 11, 3, 3); // Muzzle tip
        } else if (aim === 2) {
          // 2: 90° Vertical Up (Straight up overhead)
          ctx.fillRect(16, armY - 11, 4, 12);
          ctx.fillStyle = P[10]; ctx.fillRect(17, armY - 10, 2, 10);
          ctx.fillStyle = P[15]; ctx.fillRect(15, armY - 12, 6, 2); // Flash hider
        } else if (aim === 3) {
          // 3: 45° Up-Back (Diagonal up-left)
          ctx.fillRect(9, armY - 6, 8, 8);
          ctx.fillRect(5, armY - 9, 6, 6);
          ctx.fillStyle = P[10]; ctx.fillRect(7, armY - 5, 7, 2);
        } else if (aim === 4) {
          // 4: Horizontal Back
          ctx.fillRect(5, armY, 11, 4);
          ctx.fillStyle = P[10]; ctx.fillRect(6, armY + 1, 9, 1);
        } else if (aim === 5) {
          // 5: 45° Down-Back (Airborne diagonal)
          ctx.fillRect(8, armY + 3, 7, 7);
          ctx.fillRect(5, armY + 8, 5, 5);
        } else if (aim === 6) {
          // 6: 90° Vertical Down (Airborne straight down)
          ctx.fillRect(16, armY + 4, 4, 12);
          ctx.fillStyle = P[10]; ctx.fillRect(17, armY + 5, 2, 10);
        } else if (aim === 7) {
          // 7: 45° Down-Forward (Airborne diagonal)
          ctx.fillRect(19, armY + 3, 7, 7);
          ctx.fillRect(23, armY + 8, 6, 5);
          ctx.fillStyle = P[10]; ctx.fillRect(20, armY + 4, 7, 2);
        }

        // Muzzle Recoil Flash
        if (opts.fire) {
          const mfx = aim === 2 ? 18 : aim === 6 ? 18 : aim === 1 ? 29 : 31;
          const mfy = aim === 2 ? armY - 14 : aim === 6 ? armY + 16 : aim === 1 ? armY - 10 : armY + 1;
          // Outer orange flare
          ctx.fillStyle = PALETTES.FIRE[3];
          ctx.fillRect(mfx - 4, mfy - 4, 9, 9);
          // Intense yellow star
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(mfx - 2, mfy - 2, 5, 5);
          // Pure white core
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(mfx - 1, mfy - 1, 3, 3);
          // Ejected brass shell casing
          ctx.fillStyle = P[2];
          ctx.fillRect(mfx - 12, mfy - 5, 3, 2);
        }
      }
    };

    // ----------------------------------------------------
    // REGISTER ALL MARCO ROSSI FRAMES & LEGACY KEYS
    // ----------------------------------------------------

    // Idle Frames (4 frames)
    for (let i = 0; i < 4; i++) {
      const bob = i === 1 || i === 2 ? 1 : 0;
      const flut = Math.sin((i * Math.PI) / 2) * 1.5;
      this.registerSprite(`player_idle_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { torsoBob: bob, headbandFlutter: flut, aimAngle: 0 });
      });
      // Composite aim variants for Worker 4
      this.registerSprite(`player_idle_aim_FORWARD_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { torsoBob: bob, headbandFlutter: flut, aimAngle: 0 });
      });
      this.registerSprite(`player_idle_aim_UP_FORWARD_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { torsoBob: bob, headbandFlutter: flut, aimAngle: 1 });
      });
      this.registerSprite(`player_idle_aim_UP_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { torsoBob: bob, headbandFlutter: flut, aimAngle: 2 });
      });
    }

    // Run Cycle (6 frames)
    const runOffsets = [
      { l: -4, r: 4, bob: 0, flut: -1 },
      { l: -2, r: 2, bob: 1, flut: 1 },
      { l: 0, r: 0, bob: 2, flut: -1.5 },
      { l: 4, r: -4, bob: 0, flut: 1 },
      { l: 2, r: -2, bob: 1, flut: -1 },
      { l: 0, r: 0, bob: 2, flut: 1.5 },
    ];
    for (let i = 0; i < 6; i++) {
      const ro = runOffsets[i];
      this.registerSprite(`player_run_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { legOffsetL: ro.l, legOffsetR: ro.r, torsoBob: ro.bob, headbandFlutter: ro.flut, aimAngle: 0 });
      });
      this.registerSprite(`player_run_aim_FORWARD_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { legOffsetL: ro.l, legOffsetR: ro.r, torsoBob: ro.bob, headbandFlutter: ro.flut, aimAngle: 0 });
      });
      this.registerSprite(`player_run_aim_UP_FORWARD_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { legOffsetL: ro.l, legOffsetR: ro.r, torsoBob: ro.bob, headbandFlutter: ro.flut, aimAngle: 1 });
      });
      this.registerSprite(`player_run_aim_UP_${i}`, W, H, AX, AY, (ctx) => {
        drawSoldier(ctx, { legOffsetL: ro.l, legOffsetR: ro.r, torsoBob: ro.bob, headbandFlutter: ro.flut, aimAngle: 2 });
      });
    }

    // Jump Frames (Rise & Fall)
    this.registerSprite('player_jump_rise', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -2, legOffsetR: -2, torsoBob: -2, headbandFlutter: 2, aimAngle: 0 });
    });
    this.registerSprite('player_jump_fall', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: 1, legOffsetR: 3, torsoBob: 1, headbandFlutter: -2, aimAngle: 0 });
    });

    // Airborne Directional Aiming
    this.registerSprite('player_jump_aim_FORWARD', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -1, legOffsetR: 1, torsoBob: -1, aimAngle: 0 });
    });
    this.registerSprite('player_jump_aim_UP_FORWARD', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -1, legOffsetR: 1, torsoBob: -1, aimAngle: 1 });
    });
    this.registerSprite('player_jump_aim_UP', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -1, legOffsetR: 1, torsoBob: -1, aimAngle: 2 });
    });
    this.registerSprite('player_jump_aim_DOWN_FORWARD', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -1, legOffsetR: 1, torsoBob: -1, aimAngle: 7 });
    });
    this.registerSprite('player_jump_aim_DOWN', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { legOffsetL: -2, legOffsetR: 2, torsoBob: -1, aimAngle: 6 });
    });

    // Crouch & Crawl
    this.registerSprite('player_crouch_idle', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { crouch: true, torsoBob: 0, aimAngle: 0 });
    });
    this.registerSprite('player_crouch_crawl', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { crouch: true, legOffsetL: -3, legOffsetR: 3, torsoBob: 1, aimAngle: 0 });
    });
    this.registerSprite('player_crouch_aim_FORWARD', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { crouch: true, torsoBob: 0, aimAngle: 0 });
    });

    // Aim 8 Directions (Legacy compatibility)
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

    // Fire Recoil (2 frames)
    this.registerSprite('player_fire_0', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { fire: true, torsoBob: -1, aimAngle: 0 });
    });
    this.registerSprite('player_fire_1', W, H, AX, AY, (ctx) => {
      drawSoldier(ctx, { torsoBob: 0, aimAngle: 0 });
    });

    // Death Frames (4 frames)
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
    const H = 42;
    const AX = 18;
    const AY = 40;
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

      // 1. Boots & Green Uniform Trousers
      // Left leg
      drawContouredRect(ctx, 11 + legL, 24 + bob, 6, 11, R[1], R[6], R[6], R[7]);
      drawFabricFolds(ctx, 12 + legL, 28 + bob, 4, R[6], R[7], R[9]);
      // Right leg
      drawContouredRect(ctx, 18 + legR, 24 + bob, 6, 11, R[1], R[6], R[6], R[7]);
      drawFabricFolds(ctx, 19 + legR, 28 + bob, 4, R[6], R[7], R[9]);

      // Combat boots with rubber sole tread
      drawContouredRect(ctx, 10 + legL, 34, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 18 + legR, 34, 7, 6, R[1], R[14], R[7], R[1]);
      ctx.fillStyle = R[1];
      ctx.fillRect(10 + legL, 39, 7, 1);
      ctx.fillRect(18 + legR, 39, 7, 1);

      // 2. Torso, Webbing Harness & Red Rebel Armband
      drawContouredRect(ctx, 11, 13 + bob, 13, 11, R[1], R[6], R[6], R[7]);

      // Webbing cross-belts across tunic
      ctx.fillStyle = R[14];
      ctx.fillRect(13, 14 + bob, 2, 9);
      ctx.fillRect(19, 14 + bob, 2, 9);
      ctx.fillRect(11, 21 + bob, 13, 2);
      // Brass belt buckle
      ctx.fillStyle = R[13];
      ctx.fillRect(16, 21 + bob, 3, 2);

      // Red Rebel Armband on Left Sleeve
      ctx.fillStyle = R[12];
      ctx.fillRect(10, 15 + bob, 3, 5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(11, 16 + bob, 1, 3); // Rebel insignia white core

      // 3. Head & Authentic Steel Stahlhelm Helmet
      // Face & Neck
      drawContouredRect(ctx, 13, 9 + bob, 8, 5, R[1], R[4], R[4], R[5]);
      // Scowling eyes and grimace / gas-mask snout
      ctx.fillStyle = R[15]; ctx.fillRect(17, 10 + bob, 3, 2); // Eye white
      ctx.fillStyle = R[1]; ctx.fillRect(18, 10 + bob, 2, 2);  // Eye pupil
      ctx.fillStyle = R[3]; ctx.fillRect(16, 12 + bob, 5, 2);  // Gas mask filter snout

      // German Stahlhelm Steel Helmet (with flared brim and specular metallic rim)
      // Helmet dome
      drawContouredRect(ctx, 11, 3 + bob, 13, 8, R[1], R[2], R[9], R[3]);
      // Flared helmet skirt & rim
      ctx.fillStyle = R[1];
      ctx.fillRect(9, 8 + bob, 17, 3);
      // Bright metallic steel highlight along the rim
      ctx.fillStyle = R[9];
      ctx.fillRect(10, 8 + bob, 15, 1);
      // Leather chin strap under jaw
      ctx.fillStyle = R[14];
      ctx.fillRect(14, 13 + bob, 6, 1);

      // 4. Weapon & Role-Specific Gear
      if (opts.type === 'rifle') {
        // Bolt-action carbine with wooden stock and long steel barrel
        ctx.fillStyle = R[11]; // Wooden stock
        ctx.fillRect(15, 16 + bob, 7, 4);
        ctx.fillStyle = R[10]; // Steel receiver
        ctx.fillRect(20, 15 + bob, 5, 3);
        ctx.fillStyle = R[9];  // Rifle barrel
        ctx.fillRect(25, 15 + bob, 9, 2);
        ctx.fillStyle = R[1];  // Front sight post
        ctx.fillRect(32, 14 + bob, 2, 2);

        if (opts.action === 'fire') {
          // Blazing rifle muzzle flash burst
          ctx.fillStyle = PALETTES.FIRE[1];
          ctx.fillRect(34, 13 + bob, 4, 4);
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(33, 12 + bob, 7, 6);
          ctx.fillStyle = PALETTES.FIRE[3];
          ctx.fillRect(32, 11 + bob, 9, 8);
        }
      } else if (opts.type === 'knife') {
        if (opts.action === 'leap') {
          // Leaping assault: raised overhead knife ready to stab downward!
          drawContouredRect(ctx, 18, 2 + bob, 5, 10, R[1], R[4], R[4], R[5]);
          ctx.fillStyle = R[9]; ctx.fillRect(20, 0 + bob, 3, 7);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(21, 0 + bob, 1, 7); // Razor gleaming edge
        } else {
          // Low predatory knife crouch
          drawContouredRect(ctx, 17, 14 + bob, 7, 4, R[1], R[4], R[4], R[5]);
          ctx.fillStyle = R[9]; ctx.fillRect(23, 13 + bob, 8, 3);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(25, 13 + bob, 5, 1);
        }
      } else if (opts.type === 'grenade') {
        if (opts.action === 'throw') {
          // Full athletic overhand pitch
          drawContouredRect(ctx, 18, 8 + bob, 8, 4, R[1], R[4], R[4], R[5]);
          // Stick grenade flying through air
          ctx.fillStyle = R[11]; ctx.fillRect(27, 4 + bob, 6, 2); // Wooden handle
          ctx.fillStyle = '#3A5F20'; ctx.fillRect(31, 3 + bob, 4, 4); // Warhead
        } else {
          // Preparing stick grenade (pulling friction fuse)
          ctx.fillStyle = R[11]; ctx.fillRect(17, 15 + bob, 5, 2);
          ctx.fillStyle = '#3A5F20'; ctx.fillRect(21, 14 + bob, 4, 4);
          ctx.fillStyle = R[13]; ctx.fillRect(16, 17 + bob, 2, 2); // Porcelain ball
        }
      } else if (opts.type === 'shield') {
        // Heavy Curved Ballistic Riot Shield (with observation visor & Rebel emblem)
        const sx = opts.action === 'bash' ? 24 : 20;
        // Outer beveled shield armor
        drawBeveledPlate(ctx, sx, 8 + bob, 8, 28, '#2C343E', '#606E7D', '#151A20', R[1]);
        // Armored viewing visor slit
        ctx.fillStyle = R[1];
        ctx.fillRect(sx + 2, 13 + bob, 4, 3);
        ctx.fillStyle = '#40E0D0'; // Bulletproof glass tint
        ctx.fillRect(sx + 2, 14 + bob, 4, 1);
        // Painted Rebel emblem on shield face
        ctx.fillStyle = R[12];
        ctx.fillRect(sx + 2, 21 + bob, 4, 4);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx + 3, 22 + bob, 2, 2);

        // Bullet impact indentations / scratch marks
        ctx.fillStyle = R[9];
        ctx.fillRect(sx + 2, 18 + bob, 2, 1);
        ctx.fillRect(sx + 3, 28 + bob, 2, 1);

        if (opts.action === 'bash') {
          // Motion impact streaks
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(sx + 8, 12 + bob, 4, 1);
          ctx.fillRect(sx + 8, 20 + bob, 6, 2);
          ctx.fillRect(sx + 8, 28 + bob, 4, 1);
        }
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
      // Blown backward, helmet flying off in air!
      drawContouredRect(ctx, 4, 16, 24, 18, R[1], R[6], R[6], R[7]);
      // Helmet flying high
      drawContouredRect(ctx, 22, 6, 10, 7, R[1], R[2], R[9], R[3]);
      // Face grimace
      ctx.fillStyle = R[4]; ctx.fillRect(10, 18, 8, 5);
      ctx.fillStyle = R[14]; ctx.fillRect(4, 28, 8, 6);
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

    // ==========================================
    // PARACHUTE CANOPY SPRITE (R1 DIVERSE SPAWNING)
    // ==========================================
    this.registerSprite('parachute_canopy', 48, 28, 24, 28, (ctx) => {
      // 5-panel military olive dome
      const oliveDark = '#2C3A20';
      const oliveBase = '#4A6038';
      const oliveLight = '#7A8B58';
      const oliveHi = '#9AB070';
      const white = '#FFFFFF';
      const cordMetal = '#D0D8C8';

      // Outer dome silhouette
      drawContouredRect(ctx, 4, 2, 40, 20, oliveDark, oliveBase, oliveHi, oliveDark);

      // Curved top bevel
      drawContouredRect(ctx, 8, 0, 32, 4, oliveDark, oliveLight, oliveHi, oliveBase);
      drawContouredRect(ctx, 14, 0, 20, 2, oliveDark, oliveHi, oliveHi, oliveLight);

      // 5 vertical panel seams
      ctx.fillStyle = oliveDark;
      ctx.fillRect(12, 3, 2, 18);
      ctx.fillRect(20, 2, 2, 19);
      ctx.fillRect(27, 2, 2, 19);
      ctx.fillRect(35, 3, 2, 18);

      // Scalloped bottom skirt
      ctx.fillStyle = oliveBase;
      for (let s = 0; s < 5; s++) {
        const sx = 4 + s * 8;
        ctx.fillRect(sx, 20, 8, 3);
        ctx.fillStyle = oliveDark;
        ctx.fillRect(sx, 23, 8, 1);
        ctx.fillStyle = oliveBase;
      }

      // White Rebel Star Insignia in center panel
      ctx.fillStyle = white;
      ctx.fillRect(23, 6, 3, 9);
      ctx.fillRect(20, 9, 9, 3);

      // 4 Heavy-duty suspension grommets along hem
      ctx.fillStyle = cordMetal;
      ctx.fillRect(6, 22, 3, 3);
      ctx.fillRect(17, 22, 3, 3);
      ctx.fillRect(29, 22, 3, 3);
      ctx.fillRect(40, 22, 3, 3);

      ctx.fillStyle = '#000000';
      ctx.fillRect(7, 23, 1, 1);
      ctx.fillRect(18, 23, 1, 1);
      ctx.fillRect(30, 23, 1, 1);
      ctx.fillRect(41, 23, 1, 1);
    });

    // ==========================================
    // AUTHENTIC REBEL CASUALTY & DEATH ANIMATIONS (R2)
    // ==========================================

    // --- 1. Standard Falling Death (Bullet / Pistol / Melee) ---
    // Frame 0: Hit stagger, chest clutching
    this.registerSprite('rebel_death_standard_0', W, H, AX, AY, (ctx) => {
      drawContouredRect(ctx, 9, 25, 7, 10, R[1], R[6], R[6], R[7]);
      drawContouredRect(ctx, 18, 25, 7, 10, R[1], R[6], R[6], R[7]);
      drawContouredRect(ctx, 8, 35, 8, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 19, 35, 8, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 8, 14, 14, 12, R[1], R[6], R[6], R[7]);
      ctx.fillStyle = R[4]; ctx.fillRect(12, 17, 7, 6);
      ctx.fillStyle = R[12]; ctx.fillRect(7, 16, 3, 5);
      drawContouredRect(ctx, 9, 8, 9, 6, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = R[15]; ctx.fillRect(13, 9, 3, 2);
      ctx.fillStyle = R[1]; ctx.fillRect(14, 9, 1, 2);
      ctx.fillStyle = R[3]; ctx.fillRect(11, 12, 4, 2);
      drawContouredRect(ctx, 5, 2, 14, 8, R[1], R[2], R[9], R[3]);
      ctx.fillStyle = R[9]; ctx.fillRect(4, 7, 16, 2);
    });

    // Frame 1: Knee buckle, falling backward at 45°
    this.registerSprite('rebel_death_standard_1', W, H, AX, AY, (ctx) => {
      drawContouredRect(ctx, 12, 27, 10, 8, R[1], R[6], R[6], R[7]);
      drawContouredRect(ctx, 8, 33, 9, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 19, 33, 9, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 5, 17, 15, 11, R[1], R[6], R[6], R[7]);
      ctx.fillStyle = R[12]; ctx.fillRect(4, 19, 3, 4);
      ctx.fillStyle = R[4]; ctx.fillRect(20, 20, 6, 4);
      drawContouredRect(ctx, 3, 11, 9, 6, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = R[15]; ctx.fillRect(6, 12, 3, 2);
      ctx.fillStyle = R[1]; ctx.fillRect(5, 14, 4, 3);
      drawContouredRect(ctx, 0, 4, 13, 8, R[1], R[2], R[9], R[3]);
      ctx.fillStyle = R[9]; ctx.fillRect(0, 9, 14, 2);
    });

    // Frame 2: Back and shoulders slamming ground, boots kicked up
    this.registerSprite('rebel_death_standard_2', 42, 32, 21, 30, (ctx) => {
      drawContouredRect(ctx, 6, 18, 20, 9, R[1], R[6], R[6], R[7]);
      ctx.fillStyle = R[12]; ctx.fillRect(10, 19, 4, 3);
      drawContouredRect(ctx, 24, 14, 8, 8, R[1], R[6], R[6], R[7]);
      drawContouredRect(ctx, 30, 10, 8, 7, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 22, 22, 8, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 2, 19, 8, 6, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 2, 8, 12, 7, R[1], R[2], R[9], R[3]);
      ctx.fillStyle = R[9]; ctx.fillRect(1, 13, 13, 2);
      ctx.fillStyle = '#C8B080';
      ctx.fillRect(0, 29, 40, 2);
    });

    // Frame 3: Flat sprawled corpse with dropped rifle
    this.registerSprite('rebel_death_standard_3', 42, 24, 21, 22, (ctx) => {
      drawContouredRect(ctx, 6, 12, 24, 7, R[1], R[6], R[6], R[7]);
      ctx.fillStyle = R[12]; ctx.fillRect(12, 13, 4, 2);
      drawContouredRect(ctx, 28, 11, 10, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 2, 12, 7, 5, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 0, 5, 11, 7, R[1], R[2], R[9], R[3]);
      ctx.fillStyle = R[9]; ctx.fillRect(0, 10, 12, 2);
      ctx.fillStyle = R[11]; ctx.fillRect(8, 19, 14, 3);
      ctx.fillStyle = R[9];  ctx.fillRect(22, 19, 12, 2);
    });

    // --- 2. Explosion Blowback (Grenade / Rocket / Blast) ---
    // Air tumble: Center-anchored soldier tumbling without helmet
    this.registerSprite('rebel_death_explosion_air', 38, 38, 19, 19, (ctx) => {
      drawContouredRect(ctx, 11, 11, 16, 14, R[1], R[6], R[7], R[1]);
      ctx.fillStyle = '#181818'; ctx.fillRect(13, 15, 6, 6);
      drawContouredRect(ctx, 2, 18, 10, 7, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 0, 23, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 22, 22, 10, 7, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 30, 24, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 4, 6, 8, 6, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 25, 7, 8, 6, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 14, 2, 10, 9, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = R[14]; ctx.fillRect(13, 2, 11, 3);
      ctx.fillStyle = R[15]; ctx.fillRect(16, 4, 3, 2);
      ctx.fillStyle = R[1];  ctx.fillRect(17, 4, 1, 2);
      ctx.fillStyle = R[1];  ctx.fillRect(16, 7, 6, 3);
      ctx.fillStyle = '#FF4030'; ctx.fillRect(18, 8, 2, 2);
    });

    // Detached Flying Stahlhelm Helmet (14x12, anchor 7, 6)
    this.registerSprite('rebel_death_explosion_helmet', 14, 12, 7, 6, (ctx) => {
      drawContouredRect(ctx, 1, 1, 12, 7, R[1], R[2], R[9], R[3]);
      ctx.fillStyle = R[1]; ctx.fillRect(0, 6, 14, 3);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(2, 6, 5, 1);
      ctx.fillStyle = R[9]; ctx.fillRect(7, 6, 6, 1);
      ctx.fillStyle = R[14];
      ctx.fillRect(4, 9, 2, 3);
      ctx.fillRect(8, 9, 2, 2);
    });

    // Ground impact bounce on stomach
    this.registerSprite('rebel_death_explosion_land_0', 44, 28, 22, 26, (ctx) => {
      drawContouredRect(ctx, 10, 12, 22, 11, R[1], R[6], R[7], R[1]);
      ctx.fillStyle = '#181818'; ctx.fillRect(16, 14, 8, 6);
      drawContouredRect(ctx, 28, 14, 12, 8, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 36, 15, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 3, 15, 9, 7, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = R[14]; ctx.fillRect(2, 14, 8, 3);
      drawContouredRect(ctx, 2, 8, 10, 6, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = '#D0B880';
      ctx.fillRect(0, 24, 44, 2);
      ctx.fillStyle = '#886840';
      ctx.fillRect(4, 26, 36, 2);
    });

    // Scorched flat sprawled corpse
    this.registerSprite('rebel_death_explosion_land_1', 44, 22, 22, 20, (ctx) => {
      drawContouredRect(ctx, 8, 8, 24, 8, R[1], '#283020', '#181818', R[1]);
      ctx.fillStyle = '#080808'; ctx.fillRect(14, 9, 10, 5);
      drawContouredRect(ctx, 30, 8, 12, 6, R[1], '#181818', '#101010', R[1]);
      drawContouredRect(ctx, 2, 9, 8, 6, R[1], R[4], '#805030', R[1]);
      ctx.fillStyle = '#505050';
      ctx.fillRect(18, 3, 2, 3);
      ctx.fillRect(19, 0, 2, 3);
    });

    // --- 3. Flamethrower Burning Death (Fire / Flame Shot) ---
    // Thrash 0: Arms raised high, intense flames
    this.registerSprite('rebel_death_burn_thrash_0', 36, 44, 18, 42, (ctx) => {
      drawContouredRect(ctx, 11, 26, 6, 12, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 18, 26, 6, 12, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 10, 36, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 18, 36, 7, 6, R[1], R[14], R[7], R[1]);
      drawContouredRect(ctx, 10, 14, 14, 13, R[1], R[6], R[7], R[1]);
      drawContouredRect(ctx, 5, 4, 6, 12, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 23, 4, 6, 12, R[1], R[4], R[4], R[5]);
      drawContouredRect(ctx, 12, 7, 10, 7, R[1], R[4], R[4], R[5]);
      ctx.fillStyle = R[1]; ctx.fillRect(15, 9, 5, 4);
      ctx.fillStyle = PALETTES.FIRE[4];
      ctx.fillRect(8, 12, 18, 15);
      ctx.fillStyle = PALETTES.FIRE[3];
      ctx.fillRect(10, 10, 14, 15);
      ctx.fillStyle = PALETTES.FIRE[2];
      ctx.fillRect(13, 8, 8, 12);
      ctx.fillStyle = PALETTES.FIRE[1];
      ctx.fillRect(15, 9, 4, 7);
    });

    // Thrash 1: Hunched forward, arms thrashing down
    this.registerSprite('rebel_death_burn_thrash_1', 36, 44, 18, 42, (ctx) => {
      drawContouredRect(ctx, 9, 27, 7, 11, R[1], '#382010', '#201008', R[1]);
      drawContouredRect(ctx, 19, 27, 7, 11, R[1], '#382010', '#201008', R[1]);
      drawContouredRect(ctx, 8, 36, 8, 6, R[1], '#181818', '#101010', R[1]);
      drawContouredRect(ctx, 19, 36, 8, 6, R[1], '#181818', '#101010', R[1]);
      drawContouredRect(ctx, 8, 16, 18, 13, R[1], '#382010', '#201008', R[1]);
      drawContouredRect(ctx, 5, 12, 6, 10, R[1], R[4], '#804020', R[1]);
      drawContouredRect(ctx, 23, 12, 6, 10, R[1], R[4], '#804020', R[1]);
      drawContouredRect(ctx, 12, 11, 10, 7, R[1], '#503020', '#301810', R[1]);
      ctx.fillStyle = PALETTES.FIRE[4]; ctx.fillRect(6, 14, 22, 16);
      ctx.fillStyle = PALETTES.FIRE[3]; ctx.fillRect(9, 12, 16, 16);
      ctx.fillStyle = PALETTES.FIRE[2]; ctx.fillRect(12, 10, 10, 14);
      ctx.fillStyle = PALETTES.FIRE[1]; ctx.fillRect(14, 11, 6, 8);
      ctx.fillStyle = PALETTES.FIRE[8];
      ctx.fillRect(11, 2, 4, 5);
      ctx.fillRect(18, 0, 5, 6);
    });

    // Charcoal 0: Pitch-black charred silhouette with glowing orange molten embers
    this.registerSprite('rebel_death_burn_charcoal_0', 36, 38, 18, 36, (ctx) => {
      const charcoalDark = '#101010';
      const charcoalBase = '#202020';
      const charcoalHi = '#383838';
      const emberOrange = '#FF5500';
      const emberYellow = '#FFA010';

      drawContouredRect(ctx, 8, 22, 9, 12, charcoalDark, charcoalBase, charcoalHi, charcoalDark);
      drawContouredRect(ctx, 18, 22, 9, 12, charcoalDark, charcoalBase, charcoalHi, charcoalDark);
      drawContouredRect(ctx, 7, 31, 8, 5, charcoalDark, charcoalDark, charcoalBase, charcoalDark);
      drawContouredRect(ctx, 19, 31, 8, 5, charcoalDark, charcoalDark, charcoalBase, charcoalDark);
      drawContouredRect(ctx, 9, 12, 16, 12, charcoalDark, charcoalBase, charcoalHi, charcoalDark);
      drawContouredRect(ctx, 12, 5, 10, 8, charcoalDark, charcoalBase, charcoalHi, charcoalDark);
      drawContouredRect(ctx, 6, 14, 5, 10, charcoalDark, charcoalBase, charcoalHi, charcoalDark);
      drawContouredRect(ctx, 23, 14, 5, 10, charcoalDark, charcoalBase, charcoalHi, charcoalDark);

      ctx.fillStyle = emberOrange;
      ctx.fillRect(14, 15, 6, 2);
      ctx.fillRect(17, 19, 4, 2);
      ctx.fillRect(11, 25, 3, 2);
      ctx.fillRect(21, 25, 3, 2);
      ctx.fillStyle = emberYellow;
      ctx.fillRect(15, 16, 3, 1);
      ctx.fillRect(18, 20, 2, 1);

      ctx.fillStyle = '#404040';
      ctx.fillRect(14, 1, 3, 3);
      ctx.fillRect(19, 0, 3, 3);
    });

    // Ash 0: Collapsing crumbled pile of smoking black ash and glowing embers
    this.registerSprite('rebel_death_burn_ash_0', 34, 20, 17, 18, (ctx) => {
      const ashDark = '#181818';
      const ashBase = '#2C2C2C';
      const ashLight = '#444444';

      drawContouredRect(ctx, 4, 6, 26, 12, ashDark, ashBase, ashLight, ashDark);
      drawContouredRect(ctx, 8, 2, 18, 7, ashDark, ashBase, ashLight, ashDark);

      ctx.fillStyle = '#E84800';
      ctx.fillRect(10, 8, 4, 2);
      ctx.fillRect(18, 10, 5, 2);
      ctx.fillStyle = '#FFA010';
      ctx.fillRect(12, 9, 2, 1);
      ctx.fillRect(20, 11, 2, 1);
    });

    // Ash 1: Flat settled ash pile on ground
    this.registerSprite('rebel_death_burn_ash_1', 32, 14, 16, 12, (ctx) => {
      const ashDark = '#141414';
      const ashBase = '#242424';
      const ashLight = '#383838';

      drawContouredRect(ctx, 2, 4, 28, 8, ashDark, ashBase, ashLight, ashDark);
      drawContouredRect(ctx, 7, 2, 18, 4, ashDark, ashBase, ashLight, ashDark);

      ctx.fillStyle = '#903000';
      ctx.fillRect(14, 6, 3, 2);
      ctx.fillStyle = '#505050';
      ctx.fillRect(15, 0, 2, 3);
    });

    // Backward compatibility aliases
    this.aliasSprite('soldier_rifle_idle', 'rebel_rifle_idle');
    this.aliasSprite('soldier_knife_idle', 'rebel_knife_idle');
    this.aliasSprite('soldier_grenade_idle', 'rebel_grenade_idle');
    this.aliasSprite('soldier_shield_idle', 'rebel_shield_idle');

  }

  // ==========================================
  // 3. HOSTAGE POW (PRISONER OF WAR)
  // ==========================================
  private generatePowSprites(): void {
    const W = 32;
    const H = 38;
    const AX = 16;
    const AY = 36;
    const P = PALETTES.POW;

    // Helper: Draw Hostage POW with bushy beard, bare muscular chest, ripped shorts, rope bonds
    const drawPow = (
      ctx: CanvasContext2DLike,
      opts: {
        tied?: boolean;
        freed?: boolean;
        salute?: boolean;
        dropItem?: boolean;
        escapeFrame?: number;
        sway?: number;
      }
    ) => {
      const sway = opts.sway ?? 0;

      if (opts.tied) {
        // Sitting on heels, wrists bound in front with thick twisted hemp cord
        // Head & Sunburned Face
        drawContouredRect(ctx, 12, 8, 8, 7, P[1], P[4], P[4], P[5]);

        // Wild bright yellow mop of hair
        drawContouredRect(ctx, 9, 3, 14, 7, P[1], P[2], '#FFF8A0', P[3]);
        ctx.fillStyle = P[2];
        ctx.fillRect(8, 2, 4, 3);
        ctx.fillRect(14, 1, 4, 3);
        ctx.fillRect(20, 2, 4, 3);

        // Bare Chest & Muscular Shoulders
        drawContouredRect(ctx, 10, 14, 12, 10, P[1], P[4], P[4], P[5]);
        // Pectoral definition
        ctx.fillStyle = P[5];
        ctx.fillRect(15, 17, 2, 4);

        // Legendary Massive Bushy Beard (covering chin down to waist!)
        drawContouredRect(ctx, 9 + sway, 13, 14, 13, P[1], P[2], '#FFF8A0', P[3]);
        // Textured beard strand locks
        ctx.fillStyle = P[3];
        ctx.fillRect(11 + sway, 18, 2, 6);
        ctx.fillRect(15 + sway, 19, 2, 6);
        ctx.fillRect(19 + sway, 18, 2, 6);

        // Tattered Blue Boxer Shorts
        drawContouredRect(ctx, 8, 24, 16, 8, P[1], P[6], P[6], P[7]);
        // Yellow fray tassels
        ctx.fillStyle = P[13];
        ctx.fillRect(9, 31, 3, 2);
        ctx.fillRect(18, 31, 3, 2);

        // Hemp Rope Binding Wrists (braided cord texture)
        drawContouredRect(ctx, 7, 18, 18, 5, P[1], P[8], '#F8E8B0', P[9]);
        ctx.fillStyle = P[9];
        ctx.fillRect(9, 19, 2, 3);
        ctx.fillRect(13, 19, 2, 3);
        ctx.fillRect(17, 19, 2, 3);
        ctx.fillRect(21, 19, 2, 3);
        return;
      }

      if (opts.freed) {
        // Freed: Flying rope fragments, cheering arms raised high!
        drawContouredRect(ctx, 12, 6, 8, 7, P[1], P[4], P[4], P[5]);
        // Hair
        drawContouredRect(ctx, 9, 2, 14, 6, P[1], P[2], '#FFF8A0', P[3]);
        // Raised muscular arms
        drawContouredRect(ctx, 5, 3, 4, 10, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 23, 3, 4, 10, P[1], P[4], P[4], P[5]);
        // Flying severed rope fragments
        ctx.fillStyle = P[8];
        ctx.fillRect(2, 6, 3, 2);
        ctx.fillRect(27, 7, 3, 2);
        ctx.fillRect(15, 2, 2, 3);
        // Beard
        drawContouredRect(ctx, 10, 11, 12, 10, P[1], P[2], '#FFF8A0', P[3]);
        // Torso & abs
        drawContouredRect(ctx, 11, 19, 10, 8, P[1], P[4], P[4], P[5]);
        // Tattered shorts
        drawContouredRect(ctx, 9, 25, 14, 7, P[1], P[6], P[6], P[7]);
        // Bare legs
        drawContouredRect(ctx, 10, 31, 4, 6, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 18, 31, 4, 6, P[1], P[4], P[4], P[5]);
        return;
      }

      if (opts.salute) {
        // Iconic Arcade Military Salute ("THANK YOU!")
        drawContouredRect(ctx, 12, 6, 8, 7, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 9, 2, 14, 6, P[1], P[2], '#FFF8A0', P[3]);
        // Beard
        drawContouredRect(ctx, 10, 11, 12, 10, P[1], P[2], '#FFF8A0', P[3]);
        // Right Arm in Crisp Military Salute to brow
        drawContouredRect(ctx, 19, 4, 9, 4, P[1], P[4], P[4], P[5]);
        // White sparkling tooth twinkle glint!
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(17, 8, 3, 3);
        ctx.fillRect(16, 9, 5, 1);
        ctx.fillRect(18, 7, 1, 5);
        // Torso, shorts & legs
        drawContouredRect(ctx, 11, 19, 10, 8, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 9, 25, 14, 7, P[1], P[6], P[6], P[7]);
        drawContouredRect(ctx, 10, 31, 4, 6, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 18, 31, 4, 6, P[1], P[4], P[4], P[5]);
        return;
      }

      if (opts.dropItem) {
        // Reaching into shorts and pulling out red gift crate with gold ribbon!
        drawContouredRect(ctx, 12, 7, 8, 7, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 9, 3, 14, 6, P[1], P[2], '#FFF8A0', P[3]);
        drawContouredRect(ctx, 10, 12, 12, 9, P[1], P[2], '#FFF8A0', P[3]);
        drawContouredRect(ctx, 9, 23, 14, 7, P[1], P[6], P[6], P[7]);
        // Red supply crate with golden ribbon
        drawBeveledPlate(ctx, 20, 16, 11, 10, P[12], '#FF6040', '#801808', P[1]);
        // Gold ribbon cross
        ctx.fillStyle = P[13];
        ctx.fillRect(25, 16, 2, 10);
        ctx.fillRect(20, 20, 11, 2);
        // Legs
        drawContouredRect(ctx, 10, 30, 4, 6, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 18, 30, 4, 6, P[1], P[4], P[4], P[5]);
        return;
      }

      if (opts.escapeFrame !== undefined) {
        // 4-Frame Comedic Sprint (high knees & pumping arms fleeing)
        const f = opts.escapeFrame;
        const off = f % 2 ? -4 : 4;
        drawContouredRect(ctx, 12, 6, 8, 7, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 9, 2, 14, 6, P[1], P[2], '#FFF8A0', P[3]);
        drawContouredRect(ctx, 11, 11, 10, 9, P[1], P[2], '#FFF8A0', P[3]);
        // Pumping arms
        drawContouredRect(ctx, 6 + off, 12, 4, 7, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 22 - off, 12, 4, 7, P[1], P[4], P[4], P[5]);
        // Shorts & running legs
        drawContouredRect(ctx, 10, 21, 12, 7, P[1], P[6], P[6], P[7]);
        drawContouredRect(ctx, 10 + off, 27, 4, 8, P[1], P[4], P[4], P[5]);
        drawContouredRect(ctx, 18 - off, 27, 4, 8, P[1], P[4], P[4], P[5]);
      }
    };

    // Tied States (breathing animation)
    this.registerSprite('pow_tied_0', W, H, AX, AY, (ctx) => {
      drawPow(ctx, { tied: true, sway: 0 });
    });
    this.registerSprite('pow_tied_1', W, H, AX, AY, (ctx) => {
      drawPow(ctx, { tied: true, sway: 1 });
    });

    // Freed & Salute
    this.registerSprite('pow_freed', W, H, AX, AY, (ctx) => {
      drawPow(ctx, { freed: true });
    });
    this.registerSprite('pow_salute_0', W, H, AX, AY, (ctx) => {
      drawPow(ctx, { salute: true });
    });

    // Drop Item Box
    this.registerSprite('pow_drop_item', W, H, AX, AY, (ctx) => {
      drawPow(ctx, { dropItem: true });
    });

    // Escape Sprint (4 frames)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`pow_escape_${i}`, W, H, AX, AY, (ctx) => {
        drawPow(ctx, { escapeFrame: i });
      });
    }
  }

  // ==========================================
  // 4. MID-BOSS: IRON TECHNICAL VEHICLE
  // ==========================================
  private generateVehicleSprites(): void {
    const V = PALETTES.VEHICLE;

    // 1. Tank Hull (Width 136, Height 68, AX 68, AY 60)
    this.registerSprite('iron_technical_hull', 136, 68, 68, 60, (ctx) => {
      // Main armored chassis base (Heavy welded olive green steel plates)
      drawBeveledPlate(ctx, 8, 14, 120, 38, V[2], V[3], V[4], V[1]);

      // Segmented armor plate seams
      ctx.fillStyle = V[1];
      ctx.fillRect(40, 15, 2, 36);
      ctx.fillRect(80, 15, 2, 36);
      ctx.fillRect(10, 32, 116, 2);

      // Rust streaks dripping from seams
      ctx.fillStyle = V[11];
      ctx.fillRect(41, 24, 1, 6);
      ctx.fillRect(81, 20, 1, 8);
      ctx.fillRect(28, 34, 1, 5);

      // Metallic Rivets across upper and lower armor borders
      for (let x = 14; x < 120; x += 12) {
        drawRivet(ctx, x, 17, V[8], '#FFFFFF', V[1]);
        drawRivet(ctx, x, 46, V[8], '#FFFFFF', V[1]);
      }

      // Front Spiked Ram Bumper (Heavy steel reinforcement)
      drawBeveledPlate(ctx, 120, 22, 12, 26, V[7], V[8], V[1], V[1]);
      // Spikes on bumper
      ctx.fillStyle = V[8];
      ctx.fillRect(130, 24, 4, 3);
      ctx.fillRect(130, 32, 5, 4);
      ctx.fillRect(130, 42, 4, 3);

      // Rear Twin Exhaust Smokestacks (with soot stains & dynamic heat)
      drawContouredRect(ctx, 10, 6, 7, 12, V[1], V[10], V[7], V[1]);
      drawContouredRect(ctx, 18, 8, 7, 10, V[1], V[10], V[7], V[1]);
      // Soot on hull around exhaust
      ctx.fillStyle = '#101010';
      ctx.fillRect(9, 14, 18, 4);

      // Yellow & Black Diagonal Hazard Caution Stripes
      ctx.fillStyle = V[14];
      ctx.fillRect(48, 26, 28, 8);
      ctx.fillStyle = V[1];
      for (let s = 48; s < 76; s += 6) {
        ctx.fillRect(s, 26, 3, 8);
      }

      // Red Rebel Army Insignia stamped on side
      ctx.fillStyle = V[12];
      ctx.fillRect(92, 24, 8, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(95, 25, 2, 6);
      ctx.fillRect(93, 27, 6, 2);
    });

    // 2. Animated Caterpillar Treads (4 frames, 136x24, AX 68, AY 12)
    for (let frame = 0; frame < 4; frame++) {
      this.registerSprite(`iron_technical_treads_${frame}`, 136, 24, 68, 12, (ctx) => {
        // Continuous rubber-and-steel track loop
        drawBeveledPlate(ctx, 6, 2, 124, 20, V[5], V[6], V[1], V[1]);

        // 5 Steel Road Wheels with Spoked Hubs (synchronized rotation!)
        const wheelCenters = [20, 44, 68, 92, 116];
        for (const cx of wheelCenters) {
          // Wheel outer tire rim
          ctx.fillStyle = V[1];
          ctx.fillRect(cx - 8, 3, 16, 16);
          ctx.fillStyle = V[7];
          ctx.fillRect(cx - 7, 4, 14, 14);
          ctx.fillStyle = V[1];
          ctx.fillRect(cx - 5, 6, 10, 10);
          ctx.fillStyle = V[6];
          ctx.fillRect(cx - 3, 8, 6, 6);

          // Center grease hub bearing
          ctx.fillStyle = V[10];
          ctx.fillRect(cx - 1, 10, 3, 3);

          // Rotating 4-spoke hub pattern by frame
          const ang = (frame * Math.PI) / 2;
          const cosA = Math.round(Math.cos(ang) * 4);
          const sinA = Math.round(Math.sin(ang) * 4);
          ctx.fillStyle = V[8];
          ctx.fillRect(cx + cosA - 1, 11 + sinA - 1, 2, 2);
          ctx.fillRect(cx - cosA - 1, 11 - sinA - 1, 2, 2);
        }

        // Ground Cleats on Track Outer Loop (caterpillar link pins)
        ctx.fillStyle = V[8];
        const offset = (frame * 3) % 8;
        for (let x = 8 + offset; x < 124; x += 8) {
          ctx.fillRect(x, 1, 3, 2);
          ctx.fillRect(x, 21, 3, 2);
        }
      });
    }

    // 3. Rotating 360° Autocannon Turret (48x28, AX 24, AY 20)
    this.registerSprite('iron_technical_turret', 48, 28, 24, 20, (ctx) => {
      // Armored cupola dome with commander hatch
      drawBeveledPlate(ctx, 8, 6, 28, 18, V[9], V[3], V[4], V[1]);
      // Periscope vision visor slit
      ctx.fillStyle = V[1];
      ctx.fillRect(14, 10, 12, 3);
      ctx.fillStyle = '#40E0D0';
      ctx.fillRect(15, 11, 10, 1);

      // Twin Heavy Autocannon Barrels extending forward
      drawContouredRect(ctx, 32, 10, 14, 4, V[1], V[10], V[7], V[1]);
      drawContouredRect(ctx, 32, 16, 14, 4, V[1], V[10], V[7], V[1]);

      // Ventilated cooling jacket perforations
      ctx.fillStyle = V[1];
      ctx.fillRect(35, 11, 2, 2);
      ctx.fillRect(39, 11, 2, 2);
      ctx.fillRect(35, 17, 2, 2);
      ctx.fillRect(39, 17, 2, 2);

      // Fluted Flash Suppressor Muzzle Tips
      drawBeveledPlate(ctx, 44, 9, 3, 6, V[7], V[8], V[1]);
      drawBeveledPlate(ctx, 44, 15, 3, 6, V[7], V[8], V[1]);
    });

    // 4. Burnt-out Wreckage
    this.registerSprite('iron_technical_wreckage', 136, 68, 68, 60, (ctx) => {
      drawBeveledPlate(ctx, 8, 16, 120, 36, '#1F1F1F', '#424242', '#0A0A0A', '#101010');
      // Jagged blast breaches
      ctx.fillStyle = '#050505';
      ctx.fillRect(30, 24, 30, 20);
      ctx.fillStyle = V[11];
      ctx.fillRect(20, 20, 45, 10);
      // Smoldering red-hot embers inside breach
      ctx.fillStyle = '#E84800';
      ctx.fillRect(36, 32, 6, 4);
      ctx.fillRect(46, 34, 4, 3);
    });
  }

  // ==========================================
  // 5. STAGE 1 END-BOSS: TETSUYUKI WAR FORTRESS
  // ==========================================
  private generateFortressSprites(): void {
    const F = PALETTES.FORTRESS;

    // 1. Intact Hull Phase 1 (260x140, AX 130, AY 70)
    this.registerSprite('tetsuyuki_hull_p1', 260, 140, 130, 70, (ctx) => {
      // Massive Naval Battleship Fuselage Plating
      drawBeveledPlate(ctx, 10, 18, 240, 104, F[2], F[3], F[4], F[1]);

      // Recessed Armor Panel Seam Lines
      ctx.fillStyle = F[5];
      for (let x = 36; x < 240; x += 34) {
        ctx.fillRect(x, 20, 2, 98);
      }
      ctx.fillRect(12, 54, 236, 2);
      ctx.fillRect(12, 86, 236, 2);

      // Heavy Structural Rivet Grid across all panels
      for (let x = 18; x < 240; x += 17) {
        drawRivet(ctx, x, 22, F[3], '#FFFFFF', F[5]);
        drawRivet(ctx, x, 50, F[3], '#FFFFFF', F[5]);
        drawRivet(ctx, x, 82, F[3], '#FFFFFF', F[5]);
        drawRivet(ctx, x, 114, F[3], '#FFFFFF', F[5]);
      }

      // Yellow & Black Industrial Hazard Caution Stripes on Lower Keel
      ctx.fillStyle = F[6];
      ctx.fillRect(40, 96, 140, 14);
      ctx.fillStyle = F[7];
      for (let x = 40; x < 180; x += 14) {
        ctx.fillRect(x, 96, 7, 14);
      }

      // Reinforced coastal cliff mounting anchors
      drawBeveledPlate(ctx, 16, 114, 46, 18, '#30261C', '#54321A', '#1A140E', F[1]);
      drawBeveledPlate(ctx, 180, 114, 56, 18, '#30261C', '#54321A', '#1A140E', F[1]);

      // Bulkhead inspection portholes
      ctx.fillStyle = F[1];
      ctx.fillRect(60, 32, 8, 8);
      ctx.fillRect(100, 32, 8, 8);
      ctx.fillRect(140, 32, 8, 8);
      ctx.fillStyle = '#40E0D0';
      ctx.fillRect(62, 34, 4, 4);
      ctx.fillRect(102, 34, 4, 4);
      ctx.fillRect(142, 34, 4, 4);
    });

    // 2. Hull Phase 2 (Catastrophic Breach & Exposed Girders)
    this.registerSprite('tetsuyuki_hull_p2', 260, 140, 130, 70, (ctx) => {
      // Base battleship fuselage
      drawBeveledPlate(ctx, 10, 18, 240, 104, F[2], F[3], F[4], F[1]);

      // Catastrophic 80x64 Jagged Hull Breach in front left section
      ctx.fillStyle = '#06080C';
      ctx.fillRect(20, 32, 80, 64);

      // Exposed structural steel I-beams & sheared girders
      ctx.fillStyle = F[4];
      ctx.fillRect(30, 34, 5, 60);
      ctx.fillRect(52, 34, 5, 60);
      ctx.fillRect(74, 34, 5, 60);
      ctx.fillRect(22, 60, 76, 5);

      // Severed Copper Hydraulic Lines with dripping fluid & electrical sparks
      ctx.fillStyle = F[14];
      ctx.fillRect(36, 68, 18, 3);
      ctx.fillRect(44, 76, 22, 3);
      // Bright electrical sparks
      ctx.fillStyle = F[9];
      ctx.fillRect(56, 66, 3, 3);
      ctx.fillRect(64, 78, 3, 3);

      // Charred battle damage rust and black soot spread around the crater
      ctx.fillStyle = F[12];
      ctx.fillRect(94, 28, 40, 44);
      ctx.fillStyle = '#101010';
      ctx.fillRect(98, 34, 32, 32);
    });

    // 3. Hull Phase 3 (Critical Overheating & Exposed Reactor Core)
    this.registerSprite('tetsuyuki_hull_p3', 260, 140, 130, 70, (ctx) => {
      // Overheated deep thermal crimson glowing hull
      drawBeveledPlate(ctx, 10, 18, 240, 104, '#38140C', '#8B0000', '#180402', F[1]);

      // Open Central Reactor Core Chamber (64x64)
      ctx.fillStyle = '#040608';
      ctx.fillRect(96, 36, 68, 68);

      // Warning hazard stripes framing the reactor hatch
      ctx.fillStyle = F[6];
      ctx.fillRect(92, 32, 76, 4);
      ctx.fillRect(92, 104, 76, 4);
      ctx.fillStyle = F[7];
      for (let x = 92; x < 168; x += 8) {
        ctx.fillRect(x, 32, 4, 4);
        ctx.fillRect(x, 104, 4, 4);
      }

      // Overheating radiator cooling vents venting cherry red heat
      ctx.fillStyle = F[13];
      ctx.fillRect(174, 38, 44, 10);
      ctx.fillRect(174, 56, 44, 10);
      ctx.fillRect(174, 74, 44, 10);
      ctx.fillStyle = '#FF4422';
      ctx.fillRect(178, 41, 36, 4);
      ctx.fillRect(178, 59, 36, 4);
      ctx.fillRect(178, 77, 36, 4);
    });

    // 4. Underside 60mm Heavy Artillery Cannon (64x32, AX 16, AY 16)
    this.registerSprite('tetsuyuki_cannon', 64, 32, 16, 16, (ctx) => {
      // Heavy swivel turret mount
      drawBeveledPlate(ctx, 4, 4, 24, 24, F[2], F[3], F[4], F[1]);
      // Recoil hydraulic cylinder
      ctx.fillStyle = F[4];
      ctx.fillRect(20, 8, 12, 16);
      // Massive artillery barrel extending forward
      drawContouredRect(ctx, 24, 10, 36, 12, F[1], F[3], '#FFFFFF', F[4]);
      // Stepped muzzle crown
      drawBeveledPlate(ctx, 56, 8, 6, 16, F[3], '#FFFFFF', F[1]);
    });

    // 5. Dorsal Rocket Launcher Pod (48x36, AX 24, AY 30)
    this.registerSprite('tetsuyuki_rocket_pod_open', 48, 36, 24, 30, (ctx) => {
      drawBeveledPlate(ctx, 4, 6, 40, 28, F[2], F[3], F[4], F[1]);
      // 5 Missile launch silos armed with red warhead rockets
      const tubes = [8, 15, 22, 29, 36];
      for (const tx of tubes) {
        ctx.fillStyle = '#0E1116';
        ctx.fillRect(tx, 12, 5, 16);
        // Rocket warhead
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(tx + 1, 12, 3, 10);
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(tx + 1, 9, 3, 4); // Red warhead tip
      }
    });

    // 6. Forward Rotary 6-Barrel Gatling Gun (36x24, AX 18, AY 12)
    this.registerSprite('tetsuyuki_gatling', 36, 24, 18, 12, (ctx) => {
      drawBeveledPlate(ctx, 4, 4, 16, 16, F[2], F[3], F[4], F[1]);
      // 6 Rotating barrels
      ctx.fillStyle = F[5];
      ctx.fillRect(18, 6, 16, 2);
      ctx.fillRect(18, 9, 16, 2);
      ctx.fillRect(18, 13, 16, 2);
      ctx.fillRect(18, 16, 16, 2);
      // Revolving barrel bracket disc
      drawBeveledPlate(ctx, 26, 5, 4, 14, F[3], '#FFFFFF', F[4]);
    });

    // 7. Thermal Plasma Laser Beam (240x24, AX 0, AY 12)
    this.registerSprite('tetsuyuki_laser_beam', 240, 24, 0, 12, (ctx) => {
      // Intense plasma red outer aura
      ctx.fillStyle = F[10]; ctx.fillRect(0, 1, 240, 22);
      // Fiery orange mid-beam
      ctx.fillStyle = '#FFA010'; ctx.fillRect(0, 4, 240, 16);
      // Intense yellow core
      ctx.fillStyle = '#FFF060'; ctx.fillRect(0, 7, 240, 10);
      // Pure white blinding center
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 9, 240, 6);
    });

    // 8. Pulsing Reactor Core (48x48, AX 24, AY 24)
    this.registerSprite('tetsuyuki_reactor_core', 48, 48, 24, 24, (ctx) => {
      // Rotating outer magnetic containment ring
      ctx.fillStyle = F[1];
      ctx.fillRect(4, 4, 40, 40);
      ctx.fillStyle = F[4];
      ctx.fillRect(6, 6, 36, 36);

      // Turquoise glowing plasma field
      ctx.fillStyle = F[8];
      ctx.beginPath();
      ctx.arc(24, 24, 15, 0, Math.PI * 2);
      ctx.fill();

      // Blinding white-hot plasma heart
      ctx.fillStyle = F[9];
      ctx.beginPath();
      ctx.arc(24, 24, 9, 0, Math.PI * 2);
      ctx.fill();

      // Radiating energy discharge spikes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(22, 1, 4, 46);
      ctx.fillRect(1, 22, 46, 4);
    });
  }

  // ==========================================
  // 6. PROJECTILES & WEAPON EFFECTS
  // ==========================================
  private generateProjectileSprites(): void {
    // Handgun bullet (8x4, brass body with white tip & tracer tail)
    this.registerSprite('proj_bullet_handgun', 8, 4, 4, 2, (ctx) => {
      ctx.fillStyle = '#FFA010'; ctx.fillRect(0, 1, 3, 2); // Tracer
      ctx.fillStyle = '#FFF060'; ctx.fillRect(2, 1, 4, 2); // Brass body
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(6, 1, 2, 2); // Point
    });

    // Heavy Machine Gun bullet (12x6, blue energetic aura with white-hot core)
    this.registerSprite('proj_bullet_hmg', 12, 6, 6, 3, (ctx) => {
      ctx.fillStyle = '#3A7BD5'; ctx.fillRect(0, 1, 11, 4); // Blue energetic aura
      ctx.fillStyle = '#FFF060'; ctx.fillRect(2, 2, 8, 2);  // Yellow body
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(7, 2, 5, 2);  // Blinding point
    });

    // Spent brass shell casings tumbling (4 angles, 6x6, AX 3, AY 3)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`casing_brass_${i}`, 6, 6, 3, 3, (ctx) => {
        ctx.save();
        ctx.translate(3, 3);
        ctx.rotate((i * Math.PI) / 2);
        ctx.fillStyle = '#D8C890'; ctx.fillRect(-2, -1, 4, 2);
        ctx.fillStyle = '#908050'; ctx.fillRect(-2, -1, 1, 2); // Primer pocket
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, -1, 2, 1);  // Glint
        ctx.restore();
      });
    }

    // Flame stream fireballs (5 expanding sizes, multi-tier heat gradient)
    const flameRadii = [6, 10, 15, 20, 25];
    for (let i = 0; i < flameRadii.length; i++) {
      const r = flameRadii[i];
      const size = r * 2 + 4;
      this.registerSprite(`proj_flame_${i}`, size, size, size / 2, size / 2, (ctx) => {
        // Red outer combustion rim
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

    // Hand Grenade (14x14, 4 rotation angles, pineapple fragmentation grid)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`proj_grenade_${i}`, 14, 14, 7, 7, (ctx) => {
        ctx.save();
        ctx.translate(7, 7);
        ctx.rotate((i * Math.PI) / 2);
        // Pineapple body
        drawContouredRect(ctx, -4, -4, 8, 9, '#181818', '#3A5F20', '#6B8E23', '#203010');
        // Segmentation grooves
        ctx.fillStyle = '#1D2E12';
        ctx.fillRect(-4, -1, 8, 1);
        ctx.fillRect(-1, -4, 1, 9);
        // Safety lever spoon & brass fuse
        ctx.fillStyle = '#808890'; ctx.fillRect(-2, -6, 3, 2);
        ctx.fillStyle = '#D8C890'; ctx.fillRect(1, -5, 2, 2);
        ctx.restore();
      });
    }

    // Micro-Rocket (18x10, finned missile with white fuselage & propulsion flame)
    this.registerSprite('proj_rocket', 18, 10, 9, 5, (ctx) => {
      // Missile fuselage
      drawContouredRect(ctx, 4, 3, 10, 4, '#181818', '#E8F0F8', '#FFFFFF', '#B0B8C0');
      // Red warhead tip
      ctx.fillStyle = '#E74C3C'; ctx.fillRect(14, 3, 3, 4);
      // Stabilizing fins
      ctx.fillStyle = '#384048';
      ctx.fillRect(2, 1, 4, 2);
      ctx.fillRect(2, 7, 4, 2);
      // Rocket propulsion flame
      ctx.fillStyle = '#FFA010'; ctx.fillRect(0, 3, 3, 4);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(1, 4, 2, 2);
    });

    // Heavy Mortar Shell (16x12, teardrop shell with finned tail & impact fuze)
    this.registerSprite('proj_mortar', 16, 12, 8, 6, (ctx) => {
      drawContouredRect(ctx, 2, 2, 12, 8, '#181818', '#485058', '#808890', '#2B2B28');
      // Red impact fuze tip
      ctx.fillStyle = '#E74C3C'; ctx.fillRect(13, 4, 3, 4);
      // Copper driving band
      ctx.fillStyle = '#B87333'; ctx.fillRect(6, 3, 2, 6);
    });
  }

  // ==========================================
  // 7. MULTI-FRAME EXPLOSIONS
  // ==========================================
  private generateExplosionSprites(): void {
    // 1. Small Explosion (4 frames, 28x28, AX 14, AY 14)
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

    // 2. Medium Explosion (6 frames, 52x52, AX 26, AY 26)
    for (let f = 0; f < 6; f++) {
      const size = 52;
      this.registerSprite(`explosion_medium_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const rad = 6 + f * 3.5;
        const col = f < 2 ? PALETTES.FIRE[1] : f < 4 ? PALETTES.FIRE[3] : PALETTES.FIRE[7];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(26, 26, rad, 0, Math.PI * 2); ctx.fill();

        // Edge flying sparks
        if (f < 4) {
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(26 - rad - 2, 26, 3, 3);
          ctx.fillRect(26 + rad - 1, 26, 3, 3);
          ctx.fillRect(26, 26 - rad - 2, 3, 3);
          ctx.fillRect(26, 26 + rad - 1, 3, 3);
        }
      });
    }

    // 3. Large Boss Detonation (8 frames, 100x100, AX 50, AY 50)
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

          // Blazing white & orange fireball core
          ctx.fillStyle = PALETTES.FIRE[2]; ctx.beginPath(); ctx.arc(50, 50, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[1]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.5, 0, Math.PI * 2); ctx.fill();
        } else {
          // Billowing dark soot and smoke with flying embers
          ctx.fillStyle = PALETTES.FIRE[8]; ctx.beginPath(); ctx.arc(50, 50, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[5]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[2];
          ctx.fillRect(30, 30, 3, 3);
          ctx.fillRect(70, 40, 3, 3);
          ctx.fillRect(40, 70, 3, 3);
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
      drawBeveledPlate(ctx, 0, 0, 24, 20, H[4], H[2], H[3], H[1]);
      // Bold 3D letter 'H'
      ctx.fillStyle = H[1];
      ctx.fillRect(7, 6, 3, 10);
      ctx.fillRect(16, 6, 3, 10);
      ctx.fillRect(10, 10, 6, 3);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 5, 3, 10);
      ctx.fillRect(15, 5, 3, 10);
      ctx.fillRect(9, 9, 6, 3);
    });

    // "F" Flame Shot Badge (24x20)
    this.registerSprite('hud_badge_flame', 24, 20, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 24, 20, H[5], H[2], H[3], H[1]);
      // Bold 3D letter 'F'
      ctx.fillStyle = H[1];
      ctx.fillRect(8, 6, 3, 10);
      ctx.fillRect(11, 6, 7, 3);
      ctx.fillRect(11, 10, 5, 3);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 5, 3, 10);
      ctx.fillRect(10, 5, 7, 3);
      ctx.fillRect(10, 9, 5, 3);
    });

    // Default Handgun Badge (24x20)
    this.registerSprite('hud_badge_pistol', 24, 20, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 24, 20, '#455A64', H[2], H[3], H[1]);
      // Pistol icon with drop shadow
      ctx.fillStyle = H[1];
      ctx.fillRect(7, 8, 10, 3);
      ctx.fillRect(13, 11, 4, 5);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 7, 10, 3);
      ctx.fillRect(12, 10, 4, 5);
    });

    // Grenade Icon (16x16)
    this.registerSprite('hud_icon_grenade', 16, 16, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 2, 3, 12, 12, H[9], '#81C784', H[10], H[1]);
      // Brass fuse
      ctx.fillStyle = '#D4AC0D'; ctx.fillRect(6, 1, 4, 3);
    });

    // POW Hostage Icon (16x16)
    this.registerSprite('hud_icon_pow', 16, 16, 0, 0, (ctx) => {
      ctx.fillStyle = '#F8E060'; ctx.fillRect(3, 2, 10, 6);
      ctx.fillStyle = '#F0B070'; ctx.fillRect(4, 6, 8, 4);
      ctx.fillStyle = '#F8E060'; ctx.fillRect(3, 9, 10, 6); // Beard
    });

    // Score & Ammo Digits 0 to 9 (8x12 each, 3D gold arcade numbers)
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
        // Bevel highlight on top edges
        ctx.fillStyle = '#FFFFFF';
        for (let x = 0; x < rows[0].length; x++) {
          if (rows[0][x] === '1') {
            ctx.fillRect(x * 2, 0, 2, 1);
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

    // Boss Health Bar Frame (184x12)
    this.registerSprite('hud_boss_bar_frame', 184, 12, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 184, 12, '#222222', H[2], H[3], H[1]);
    });
  }
}
