/**
 * Procedural Pixel-Art Sprite Engine.
 * Generates and caches authentic 16-color Neo Geo / Metal Slug sprites into Canvas / OffscreenCanvas buffers.
 * Zero external asset dependencies.
 */

import { PALETTES, hexToRgba } from './Palette';

export interface CanvasContext2DLike {
  canvas?: { width: number; height: number };
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
    canvas: { width, height },
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
    this.generateExpansionSprites();

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

  private readonly expansionKeys: Set<string> = new Set();

  public hasSprite(key: string): boolean {
    return this.spriteCache.has(key);
  }

  public getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[] {
    return Array.from(this.spriteCache.keys()).filter((k) => {
      if (!includePolish && this.polishKeys.has(k)) return false;
      if (!includeExpansion && this.expansionKeys.has(k)) return false;
      return true;
    });
  }

  public count(includePolish: boolean = false, includeExpansion: boolean = false): number {
    return this.getAllKeys(includePolish, includeExpansion).length;
  }

  private registerExpansionSprite(
    key: string,
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
    renderFn: (ctx: CanvasContext2DLike) => void
  ): SpriteFrame {
    this.expansionKeys.add(key);
    return this.registerSprite(key, width, height, anchorX, anchorY, renderFn);
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

    // Helper: Draw Chibi Hero / Sweet Adventurer (Anime catchlight eyes, rosy blush, toy blaster)
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
      // DEFEAT ANIMATIONS (Cute & Comical Cloud Defeat)
      // ----------------------------------------------------
      if (opts.death) {
        const d = opts.death;
        if (d === 1) {
          // 1: Comic flinch with spiral eyes and sweatdrop
          drawContouredRect(ctx, 10, 14, 16, 22, P[1], P[13], P[11], P[14]);
          // Round chibi head
          drawContouredRect(ctx, 9, 6, 18, 14, P[1], P[6], P[7], P[8]);
          // Buttercup blonde hair & ribbon
          ctx.fillStyle = P[2]; ctx.fillRect(8, 3, 20, 6);
          ctx.fillStyle = P[3]; ctx.fillRect(10, 2, 16, 3);
          ctx.fillStyle = P[4]; ctx.fillRect(8, 8, 20, 3); // Heart ribbon
          // Comic spiral eyes (@ @)
          ctx.fillStyle = P[1];
          ctx.fillRect(12, 10, 4, 1); ctx.fillRect(12, 12, 4, 1);
          ctx.fillRect(12, 10, 1, 3); ctx.fillRect(15, 10, 1, 3);
          ctx.fillRect(20, 10, 4, 1); ctx.fillRect(20, 12, 4, 1);
          ctx.fillRect(20, 10, 1, 3); ctx.fillRect(23, 10, 1, 3);
          // Rosy cheek blush
          ctx.fillStyle = P[7];
          ctx.fillRect(11, 14, 4, 2); ctx.fillRect(21, 14, 4, 2);
          // Comic sweatdrop
          ctx.fillStyle = '#48DBFB'; ctx.fillRect(26, 6, 3, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(27, 7, 1, 2);
          // Soft boots
          ctx.fillStyle = P[15]; ctx.fillRect(8, 34, 8, 5); ctx.fillRect(20, 34, 8, 5);
        } else if (d === 2) {
          // 2: Airborne spiral tumble with floating colorful star candies
          ctx.save();
          ctx.translate(18, 20);
          ctx.rotate(-0.35);
          drawContouredRect(ctx, -14, -8, 28, 16, P[1], P[11], P[7], P[12]);
          // Fluffy hair and ribbon flying
          ctx.fillStyle = P[2]; ctx.fillRect(2, -14, 12, 8);
          ctx.fillStyle = P[4]; ctx.fillRect(-16, -15, 10, 3);
          ctx.fillStyle = P[5]; ctx.fillRect(-22, -14, 8, 2);
          // Floating stars
          ctx.fillStyle = '#FED330';
          ctx.fillRect(-18, -20, 4, 4);
          ctx.fillRect(18, -18, 4, 4);
          ctx.fillStyle = '#FF9FF3';
          ctx.fillRect(0, -22, 3, 3);
          ctx.restore();
        } else if (d === 3) {
          // 3: Landing softly on a fluffy marshmallow cloud cushion
          // Fluffy cloud cushion
          ctx.fillStyle = '#E2D5F8';
          ctx.beginPath(); ctx.arc(18, 33, 15, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(12, 32, 10, 0, Math.PI * 2);
          ctx.arc(24, 32, 10, 0, Math.PI * 2);
          ctx.arc(18, 28, 11, 0, Math.PI * 2);
          ctx.fill();
          // Chibi hero sitting
          drawContouredRect(ctx, 10, 14, 16, 14, P[1], P[11], P[6], P[13]);
          drawContouredRect(ctx, 11, 6, 14, 10, P[1], P[6], P[7], P[8]);
          ctx.fillStyle = P[2]; ctx.fillRect(10, 4, 16, 4);
          ctx.fillStyle = P[4]; ctx.fillRect(10, 7, 16, 2);
          // Blushing cheeks
          ctx.fillStyle = P[7]; ctx.fillRect(12, 12, 3, 2); ctx.fillRect(21, 12, 3, 2);
        } else {
          // 4: Comical sheepish seated pose on a fluffy cloud with orbiting stars & angel wings
          // Pillowy marshmallow cloud
          ctx.fillStyle = '#E2D5F8';
          ctx.beginPath(); ctx.arc(18, 35, 16, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(9, 34, 9, 0, Math.PI * 2);
          ctx.arc(27, 34, 9, 0, Math.PI * 2);
          ctx.arc(18, 31, 12, 0, Math.PI * 2);
          ctx.fill();
          // Tiny cute angel wings
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(5, 20, 5, 4); ctx.fillRect(4, 18, 4, 3);
          ctx.fillRect(26, 20, 5, 4); ctx.fillRect(28, 18, 4, 3);
          // Chibi hero seated
          drawContouredRect(ctx, 11, 16, 14, 12, P[1], P[13], P[9], P[14]);
          // Head
          drawContouredRect(ctx, 10, 7, 16, 12, P[1], P[6], P[7], P[8]);
          // Fluffy hair & ribbon
          ctx.fillStyle = P[2]; ctx.fillRect(9, 4, 18, 5);
          ctx.fillStyle = P[4]; ctx.fillRect(9, 8, 18, 2);
          // Happy closed curving eyes (^ ^)
          ctx.fillStyle = P[1];
          ctx.fillRect(13, 12, 3, 1); ctx.fillRect(12, 13, 1, 1); ctx.fillRect(16, 13, 1, 1);
          ctx.fillRect(20, 12, 3, 1); ctx.fillRect(19, 13, 1, 1); ctx.fillRect(23, 13, 1, 1);
          // Rosy blushing cheeks
          ctx.fillStyle = P[7]; ctx.fillRect(12, 15, 3, 2); ctx.fillRect(21, 15, 3, 2);
          // Little cute mouth
          ctx.fillStyle = '#EE5253'; ctx.fillRect(17, 16, 2, 1);
          // Orbiting cartoon stars overhead
          ctx.fillStyle = '#FED330';
          ctx.fillRect(9, 1, 3, 3);
          ctx.fillRect(17, 0, 3, 3);
          ctx.fillRect(25, 2, 3, 3);
        }
        return;
      }

      // ----------------------------------------------------
      // 1. CHIBI LEGS & SHINY BUTTON SHOES
      // ----------------------------------------------------
      const legY = isCrouch ? 27 : 23 + bob;
      const legL = opts.legOffsetL ?? 0;
      const legR = opts.legOffsetR ?? 0;

      if (isCrouch) {
        // Kneeling low crouch legs
        drawContouredRect(ctx, 8 + legL, legY, 11, 7, P[1], P[13], P[10], P[14]);
        drawContouredRect(ctx, 16 + legR, legY, 11, 7, P[1], P[13], P[10], P[14]);
        // Cute button shoes
        drawContouredRect(ctx, 6 + legL, legY + 6, 10, 5, P[1], P[15], '#9980FA', P[1]);
        drawContouredRect(ctx, 18 + legR, legY + 6, 10, 5, P[1], P[15], '#9980FA', P[1]);
      } else {
        // Standing / Running legs
        // Left Leg & Lavender Shorts
        drawContouredRect(ctx, 11 + legL, legY, 6, 10, P[1], P[13], P[10], P[14]);
        // Right Leg
        drawContouredRect(ctx, 18 + legR, legY, 6, 10, P[1], P[13], P[10], P[14]);

        // Shiny Chocolate Button Shoes
        drawContouredRect(ctx, 10 + legL, legY + 10, 7, 6, P[1], P[15], '#9980FA', P[1]);
        drawContouredRect(ctx, 18 + legR, legY + 10, 7, 6, P[1], P[15], '#9980FA', P[1]);

        // Cute gold shoe buckles
        ctx.fillStyle = P[2];
        ctx.fillRect(12 + legL, legY + 11, 2, 2);
        ctx.fillRect(20 + legR, legY + 11, 2, 2);
      }

      // ----------------------------------------------------
      // 2. CANDY WAIST RIBBON & GOLDEN STAR BUCKLE
      // ----------------------------------------------------
      const beltY = isCrouch ? 24 : 21 + bob;
      ctx.fillStyle = P[4];
      ctx.fillRect(11, beltY, 14, 3);
      ctx.fillStyle = P[5];
      ctx.fillRect(11, beltY + 2, 14, 1);
      // Golden star buckle
      ctx.fillStyle = P[2];
      ctx.fillRect(16, beltY, 4, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(17, beltY + 1, 2, 1);

      // ----------------------------------------------------
      // 3. CHIBI TORSO (MINT TUNIC & MARSHMALLOW SHIRT)
      // ----------------------------------------------------
      const torsoY = isCrouch ? 15 : 12 + bob;

      // Pure Marshmallow cream shirt
      drawContouredRect(ctx, 13, torsoY + 1, 9, 8, P[1], P[9], P[9], P[10]);

      // Pastel mint turquoise adventurer tunic panels
      drawContouredRect(ctx, 10, torsoY, 4, 9, P[1], P[11], '#A8E6CF', P[12]);
      drawContouredRect(ctx, 21, torsoY, 4, 9, P[1], P[11], '#A8E6CF', P[12]);
      // Gold star buttons on tunic
      ctx.fillStyle = P[2];
      ctx.fillRect(11, torsoY + 3, 2, 2);
      ctx.fillRect(22, torsoY + 3, 2, 2);

      // ----------------------------------------------------
      // 4. CHIBI HEAD, ANIME CATCHLIGHT EYES, BLUSH & RIBBON
      // ----------------------------------------------------
      const headY = isCrouch ? 7 : 4 + bob;
      const flut = opts.headbandFlutter ?? 0;

      // Fluffy Buttercup Blonde Hair (Volume & Curls)
      drawContouredRect(ctx, 10, headY - 2, 16, 9, P[1], P[2], '#FFF8A0', P[3]);
      // Bouncy hair tufts
      ctx.fillStyle = P[2];
      ctx.fillRect(9, headY - 3, 4, 4);
      ctx.fillRect(14, headY - 5, 5, 4);
      ctx.fillRect(19, headY - 5, 5, 4);
      ctx.fillRect(23, headY - 3, 4, 4);
      // Golden hair highlights
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(15, headY - 4, 3, 2);
      ctx.fillRect(20, headY - 4, 2, 2);

      // Coral Pink Ribbon / Cute Ears Bow across hair
      drawContouredRect(ctx, 10, headY + 2, 16, 4, P[1], P[4], '#FFA0B0', P[5]);
      // Center ribbon knot
      ctx.fillStyle = P[5];
      ctx.fillRect(17, headY + 1, 3, 3);
      ctx.fillStyle = P[2];
      ctx.fillRect(18, headY + 2, 1, 1);

      // Fluttering Ribbon Tails with golden fringe
      const rY = headY + 3 + flut;
      ctx.fillStyle = P[1]; ctx.fillRect(4, rY - 1, 7, 4);
      ctx.fillStyle = P[4]; ctx.fillRect(5, rY, 6, 2);
      ctx.fillStyle = '#FFA0B0'; ctx.fillRect(5, rY, 4, 1);
      ctx.fillStyle = P[2]; ctx.fillRect(3, rY, 2, 2); // Golden fringe
      // Lower ribbon flutter
      ctx.fillStyle = P[1]; ctx.fillRect(2, rY + 2 + flut * 0.7, 7, 4);
      ctx.fillStyle = P[4]; ctx.fillRect(3, rY + 3 + flut * 0.7, 6, 2);
      ctx.fillStyle = P[2]; ctx.fillRect(1, rY + 3 + flut * 0.7, 2, 2);

      // Cute Chibi Face (Porcelain warm tone)
      drawContouredRect(ctx, 12, headY + 5, 12, 8, P[1], P[6], P[7], P[8]);

      // ANIME CATCHLIGHT EYES (Wide, Gemstone Sparkling Eyes!)
      // Sclera
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(16, headY + 5, 5, 4);
      // Dark mocha pupil
      ctx.fillStyle = P[1];
      ctx.fillRect(17, headY + 5, 3, 4);
      // Specular Primary Catchlight (Upper Left)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(17, headY + 5, 2, 2);
      // Specular Secondary Sparkle (Lower Right)
      ctx.fillRect(19, headY + 7, 1, 1);

      // Rosy Cheek Blush
      ctx.fillStyle = P[7];
      ctx.fillRect(13, headY + 9, 3, 2);
      ctx.fillRect(21, headY + 9, 3, 2);

      // Cheerful Smile
      ctx.fillStyle = '#EE5253';
      ctx.fillRect(17, headY + 10, 2, 1);

      // Cute Blonde Bangs framing face
      ctx.fillStyle = P[2];
      ctx.fillRect(12, headY + 3, 3, 3);
      ctx.fillRect(17, headY + 3, 3, 2);
      ctx.fillRect(22, headY + 3, 3, 3);

      // ----------------------------------------------------
      // 5. TOY BLASTER, WEAPONS & MAGICAL STAR WAND
      // ----------------------------------------------------
      const armY = isCrouch ? 16 : 13 + bob;

      if (opts.knife) {
        // Melee Action: Magical Star Wand / Squeaky Mallet
        const k = opts.knife;
        if (k === 1) {
          // Windup: arm drawn back, golden star wand shimmering
          drawContouredRect(ctx, 8, armY - 2, 5, 8, P[1], P[7], P[6], P[8]);
          // Wand handle
          ctx.fillStyle = P[4]; ctx.fillRect(7, armY - 6, 3, 5);
          // Golden star tip
          ctx.fillStyle = P[2]; ctx.fillRect(6, armY - 14, 5, 5);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(7, armY - 13, 3, 3);
        } else if (k === 2) {
          // Active Slash: Glorious Rainbow Sparkle Arc Trail!
          drawContouredRect(ctx, 16, armY - 2, 10, 5, P[1], P[7], P[6], P[8]);
          // Wand extended
          ctx.fillStyle = P[4]; ctx.fillRect(25, armY - 4, 8, 3);
          ctx.fillStyle = P[2]; ctx.fillRect(32, armY - 6, 5, 5);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(33, armY - 5, 3, 3);
          // Glorious Rainbow Sparkle Trail
          ctx.fillStyle = '#FF6B81'; ctx.fillRect(23, armY - 12, 3, 22);
          ctx.fillStyle = '#FFEAA7'; ctx.fillRect(26, armY - 10, 4, 18);
          ctx.fillStyle = '#55E6C1'; ctx.fillRect(29, armY - 8, 5, 14);
          ctx.fillStyle = '#48DBFB'; ctx.fillRect(33, armY - 6, 4, 10);
        } else {
          // Follow-through with floating star specks
          drawContouredRect(ctx, 18, armY + 1, 8, 5, P[1], P[7], P[6], P[8]);
          ctx.fillStyle = P[2]; ctx.fillRect(26, armY + 2, 4, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(27, armY + 3, 2, 2);
        }
      } else {
        // Firearm Aiming: Playful Golden Toy Blaster
        const aim = opts.aimAngle ?? 0;
        drawContouredRect(ctx, 16, armY, 5, 5, P[1], P[7], P[6], P[8]);

        // Toy Blaster (Trumpet/Star shaped nozzle, pastel body)
        ctx.fillStyle = P[11]; // Mint body
        if (aim === 0) {
          // 0: Horizontal Forward
          ctx.fillRect(19, armY, 10, 4);
          ctx.fillStyle = P[4]; ctx.fillRect(21, armY + 4, 3, 3); // Strawberry grip
          ctx.fillStyle = P[2]; ctx.fillRect(28, armY - 1, 3, 6); // Golden trumpet nozzle
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(20, armY + 1, 7, 1);
        } else if (aim === 1) {
          // 1: 45° Up-Forward
          ctx.fillRect(18, armY - 6, 8, 8);
          ctx.fillRect(23, armY - 9, 6, 6);
          ctx.fillStyle = P[2]; ctx.fillRect(28, armY - 12, 4, 4);
        } else if (aim === 2) {
          // 2: 90° Vertical Up
          ctx.fillRect(16, armY - 11, 4, 12);
          ctx.fillStyle = P[2]; ctx.fillRect(15, armY - 13, 6, 3);
        } else if (aim === 3) {
          // 3: 45° Up-Back
          ctx.fillRect(9, armY - 6, 8, 8);
          ctx.fillRect(5, armY - 9, 6, 6);
          ctx.fillStyle = P[2]; ctx.fillRect(3, armY - 12, 4, 4);
        } else if (aim === 4) {
          // 4: Horizontal Back
          ctx.fillRect(5, armY, 10, 4);
          ctx.fillStyle = P[2]; ctx.fillRect(3, armY - 1, 3, 6);
        } else if (aim === 5) {
          // 5: 45° Down-Back
          ctx.fillRect(8, armY + 3, 7, 7);
          ctx.fillRect(5, armY + 8, 5, 5);
          ctx.fillStyle = P[2]; ctx.fillRect(3, armY + 12, 4, 4);
        } else if (aim === 6) {
          // 6: 90° Vertical Down
          ctx.fillRect(16, armY + 4, 4, 12);
          ctx.fillStyle = P[2]; ctx.fillRect(15, armY + 14, 6, 3);
        } else if (aim === 7) {
          // 7: 45° Down-Forward
          ctx.fillRect(19, armY + 3, 7, 7);
          ctx.fillRect(23, armY + 8, 6, 5);
          ctx.fillStyle = P[2]; ctx.fillRect(28, armY + 12, 4, 4);
        }

        // Toy Blaster Recoil Sparkle Rings
        if (opts.fire) {
          const mfx = aim === 2 ? 18 : aim === 6 ? 18 : aim === 1 ? 29 : 31;
          const mfy = aim === 2 ? armY - 15 : aim === 6 ? armY + 17 : aim === 1 ? armY - 11 : armY + 2;
          // Starburst rings
          ctx.fillStyle = '#FF9FF3'; ctx.fillRect(mfx - 4, mfy - 4, 9, 9);
          ctx.fillStyle = '#FFEAA7'; ctx.fillRect(mfx - 2, mfy - 2, 5, 5);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(mfx - 1, mfy - 1, 3, 3);
        }
      }
    };

    // ----------------------------------------------------
    // REGISTER ALL MARCO ROSSI FRAMES & LEGACY KEYS
    // ----------------------------------------------------

    // Idle Frames (4 frames with bouncy rhythmic breathing cycle)
    for (let i = 0; i < 4; i++) {
      const bob = i === 1 ? 1 : i === 2 ? 2 : i === 3 ? 1 : 0;
      const flut = Math.sin((i * Math.PI) / 2) * 2.2;
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

    // Run Cycle (6 frames with springy arcade bounce)
    const runOffsets = [
      { l: -5, r: 5, bob: -1, flut: -2 },
      { l: -2, r: 2, bob: 1, flut: 1.5 },
      { l: 0, r: 0, bob: 2, flut: -2 },
      { l: 5, r: -5, bob: -1, flut: 2 },
      { l: 2, r: -2, bob: 1, flut: -1.5 },
      { l: 0, r: 0, bob: 2, flut: 2 },
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

    // Helper: Draw Bouncy Fluffy / Pastel Marcher
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

      // 1. Petite Gumdrop Shoes & Chubby Mint Legs
      // Left leg
      drawContouredRect(ctx, 11 + legL, 25 + bob, 6, 9, R[1], R[6], '#C8F7DC', R[7]);
      // Right leg
      drawContouredRect(ctx, 18 + legR, 25 + bob, 6, 9, R[1], R[6], '#C8F7DC', R[7]);

      // Petite Gumdrop Shoes
      drawContouredRect(ctx, 10 + legL, 34, 7, 6, R[1], R[14], '#A04070', R[1]);
      drawContouredRect(ctx, 18 + legR, 34, 7, 6, R[1], R[14], '#A04070', R[1]);
      // Gold shoe buckles
      ctx.fillStyle = R[13];
      ctx.fillRect(11 + legL, 36, 2, 2);
      ctx.fillRect(19 + legR, 36, 2, 2);

      // 2. Round Marshmallow Dough Body & Mint Jelly Uniform
      drawContouredRect(ctx, 10, 14 + bob, 15, 12, R[1], R[4], '#FFFFFF', R[5]);
      // Mint jelly vest overlay
      drawContouredRect(ctx, 10, 16 + bob, 4, 9, R[1], R[6], '#C8F7DC', R[7]);
      drawContouredRect(ctx, 21, 16 + bob, 4, 9, R[1], R[6], '#C8F7DC', R[7]);

      // Butter cookie waist belt
      ctx.fillStyle = R[13];
      ctx.fillRect(11, 23 + bob, 13, 3);
      ctx.fillStyle = R[1];
      ctx.fillRect(11, 23 + bob, 13, 1);
      // Heart belt buckle
      ctx.fillStyle = R[11];
      ctx.fillRect(16, 23 + bob, 3, 3);

      // Heart emblem on left sleeve
      ctx.fillStyle = R[11];
      ctx.fillRect(9, 17 + bob, 3, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(10, 18 + bob, 1, 2);

      // 3. Round Fluffy Head, Googly Anime Eyes & Sky-Blue Macaron Cap
      drawContouredRect(ctx, 11, 8 + bob, 13, 9, R[1], R[4], '#FFFFFF', R[5]);

      // Big Googly Cartoon Eyes (Blinking & Specular Catchlights)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(14, 9 + bob, 4, 4);
      ctx.fillRect(19, 9 + bob, 4, 4);
      // Dark pupils
      ctx.fillStyle = R[1];
      ctx.fillRect(16, 10 + bob, 2, 3);
      ctx.fillRect(21, 10 + bob, 2, 3);
      // Bright Specular Catchlights
      ctx.fillStyle = R[15];
      ctx.fillRect(16, 10 + bob, 1, 1);
      ctx.fillRect(21, 10 + bob, 1, 1);

      // Rosy Cotton Candy Cheeks
      ctx.fillStyle = R[12];
      ctx.fillRect(12, 13 + bob, 3, 2);
      ctx.fillRect(22, 13 + bob, 3, 2);

      // Cheerful smiling mouth
      ctx.fillStyle = '#EE5253';
      ctx.fillRect(17, 14 + bob, 2, 1);

      // Sky-Blue Fluffy Macaron Cap / Beret
      drawContouredRect(ctx, 9, 3 + bob, 17, 7, R[1], R[2], '#A0CFFF', R[3]);
      // Butter cookie pom-pom on top
      ctx.fillStyle = R[13];
      ctx.fillRect(16, 1 + bob, 4, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(17, 2 + bob, 2, 1);

      // 4. Role Gear & Whimsical Toys
      if (opts.type === 'rifle') {
        // Confetti Party Pop-Gun with trumpet golden nozzle
        ctx.fillStyle = R[9]; // Pastel lilac receiver
        ctx.fillRect(16, 17 + bob, 6, 4);
        ctx.fillStyle = R[2]; // Pastel blue barrel
        ctx.fillRect(22, 16 + bob, 8, 3);
        ctx.fillStyle = R[13]; // Golden trumpet nozzle
        ctx.fillRect(30, 15 + bob, 3, 5);

        if (opts.action === 'fire') {
          // Colorful Confetti & Star Sparkle Muzzle Burst!
          ctx.fillStyle = '#FF9FF3'; ctx.fillRect(33, 14 + bob, 6, 6);
          ctx.fillStyle = '#FFEAA7'; ctx.fillRect(35, 12 + bob, 3, 3);
          ctx.fillStyle = '#55E6C1'; ctx.fillRect(34, 19 + bob, 4, 3);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(34, 15 + bob, 2, 2);
        }
      } else if (opts.type === 'knife') {
        if (opts.action === 'leap') {
          // Leaping assault: raised rainbow swirl lollipop wand!
          drawContouredRect(ctx, 18, 3 + bob, 5, 8, R[1], R[4], '#FFFFFF', R[5]);
          // Big round swirl lollipop
          ctx.fillStyle = R[11]; ctx.beginPath(); ctx.arc(22, 4 + bob, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(22, 4 + bob, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = R[2]; ctx.beginPath(); ctx.arc(22, 4 + bob, 2, 0, Math.PI * 2); ctx.fill();
        } else {
          // Low ready stance holding candy wand
          drawContouredRect(ctx, 17, 15 + bob, 7, 4, R[1], R[4], '#FFFFFF', R[5]);
          ctx.fillStyle = R[11]; ctx.fillRect(24, 14 + bob, 6, 5);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(25, 15 + bob, 4, 3);
        }
      } else if (opts.type === 'grenade') {
        if (opts.action === 'throw') {
          // Pitching a wrapped peppermint swirl bonbon
          drawContouredRect(ctx, 18, 8 + bob, 8, 4, R[1], R[4], '#FFFFFF', R[5]);
          // Flying peppermint bonbon
          ctx.fillStyle = '#FF4757'; ctx.fillRect(28, 4 + bob, 6, 6);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(29, 5 + bob, 4, 4);
          ctx.fillStyle = '#FF9FF3'; ctx.fillRect(26, 6 + bob, 2, 2); // twist wrap
          ctx.fillRect(34, 6 + bob, 2, 2);
        } else {
          // Preparing peppermint bonbon
          ctx.fillStyle = '#FF4757'; ctx.fillRect(20, 15 + bob, 5, 5);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(21, 16 + bob, 3, 3);
        }
      } else if (opts.type === 'shield') {
        // Strawberry Frosted Heart Cookie Shield with Rainbow Sprinkles!
        const sx = opts.action === 'bash' ? 24 : 20;
        // Cookie base
        drawBeveledPlate(ctx, sx, 8 + bob, 9, 28, '#FFCAD4', '#FFE5EC', '#F4ACB7', R[1]);
        // Strawberry heart emblem
        ctx.fillStyle = '#FF4757';
        ctx.fillRect(sx + 2, 16 + bob, 5, 5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx + 3, 17 + bob, 3, 3);
        // Colorful candy sprinkles
        ctx.fillStyle = '#FFE66D'; ctx.fillRect(sx + 3, 11 + bob, 3, 2);
        ctx.fillStyle = '#55E6C1'; ctx.fillRect(sx + 4, 24 + bob, 2, 3);
        ctx.fillStyle = '#48DBFB'; ctx.fillRect(sx + 3, 30 + bob, 3, 2);

        if (opts.action === 'bash') {
          // Cheerful star impact sparks
          ctx.fillStyle = '#FFEAA7';
          ctx.fillRect(sx + 9, 12 + bob, 3, 3);
          ctx.fillRect(sx + 10, 20 + bob, 4, 4);
          ctx.fillRect(sx + 9, 28 + bob, 3, 3);
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
      // Comical surprise tumble, macaron cap flying high with floating stars
      drawContouredRect(ctx, 4, 16, 24, 18, R[1], R[4], '#FFFFFF', R[5]);
      // Cap flying high
      drawContouredRect(ctx, 22, 5, 11, 7, R[1], R[2], '#A0CFFF', R[3]);
      ctx.fillStyle = R[13]; ctx.fillRect(26, 3, 3, 3);
      // Comic spiral eyes (@ @)
      ctx.fillStyle = R[1];
      ctx.fillRect(9, 20, 3, 3);
      ctx.fillRect(15, 20, 3, 3);
      // Floating stars
      ctx.fillStyle = '#FFEAA7'; ctx.fillRect(2, 10, 3, 3);
      ctx.fillStyle = '#FF9FF3'; ctx.fillRect(18, 12, 3, 3);
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
    // PARACHUTE CANOPY: PASTEL RAINBOW HOT-AIR BALLOON
    // ==========================================
    this.registerSprite('parachute_canopy', 48, 28, 24, 28, (ctx) => {
      // 5-panel pastel rainbow hot-air balloon canopy
      const panels = ['#FF6B81', '#FFEAA7', '#55E6C1', '#48DBFB', '#D980FA'];
      drawContouredRect(ctx, 4, 2, 40, 20, R[1], '#FFFFFF', '#FFFFFF', '#E2D5F8');

      // 5 pastel color stripes
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = panels[s];
        ctx.fillRect(6 + s * 7, 3, 7, 18);
      }

      // Golden star emblem in center
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(22, 8, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(23, 9, 2, 2);

      // Cute scalloped edge with golden beads
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(8 + s * 7, 21, 3, 3);
      }
    });

    // ==========================================
    // WHIMSICAL REBEL CASUALTY & DEFEAT ANIMATIONS
    // ==========================================

    // --- 1. Standard Pop: Gentle Soap Bubble & Floating Hearts ---
    this.registerSprite('rebel_death_standard_0', W, H, AX, AY, (ctx) => {
      // Surprise wobble!
      drawContouredRect(ctx, 9, 14, 18, 16, R[1], R[4], '#FFFFFF', R[5]);
      // Big wide cartoon eyes (O O)
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(12, 17, 5, 5); ctx.fillRect(19, 17, 5, 5);
      ctx.fillStyle = R[1]; ctx.fillRect(14, 18, 2, 3); ctx.fillRect(21, 18, 2, 3);
      // Floating question mark
      ctx.fillStyle = '#FF6B81'; ctx.fillRect(17, 4, 3, 2); ctx.fillRect(19, 6, 2, 3); ctx.fillRect(18, 11, 2, 2);
    });

    this.registerSprite('rebel_death_standard_1', W, H, AX, AY, (ctx) => {
      // Jelly pudding wobble
      drawContouredRect(ctx, 6, 18, 24, 14, R[1], R[4], '#FFFFFF', R[5]);
      ctx.fillStyle = R[12]; ctx.fillRect(10, 21, 4, 3); ctx.fillRect(22, 21, 4, 3);
      // Happy closed eyes (^ ^)
      ctx.fillStyle = R[1]; ctx.fillRect(11, 19, 4, 1); ctx.fillRect(21, 19, 4, 1);
    });

    this.registerSprite('rebel_death_standard_2', 42, 32, 21, 30, (ctx) => {
      // Popping soap bubble ring with floating hearts
      ctx.strokeStyle = '#48DBFB'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(21, 16, 14, 0, Math.PI * 2); ctx.stroke();
      // Floating pink hearts
      ctx.fillStyle = '#FF6B81';
      ctx.fillRect(10, 10, 3, 3); ctx.fillRect(12, 10, 3, 3); ctx.fillRect(11, 13, 3, 3);
      ctx.fillRect(28, 12, 3, 3); ctx.fillRect(30, 12, 3, 3); ctx.fillRect(29, 15, 3, 3);
      // Golden stars
      ctx.fillStyle = '#FFEAA7'; ctx.fillRect(20, 6, 3, 3); ctx.fillRect(22, 22, 3, 3);
    });

    this.registerSprite('rebel_death_standard_3', 42, 24, 21, 22, (ctx) => {
      // Floating hearts drifting away peacefully
      ctx.fillStyle = '#FF6B81';
      ctx.fillRect(14, 6, 4, 4); ctx.fillRect(17, 6, 4, 4); ctx.fillRect(15, 10, 5, 4);
      ctx.fillStyle = '#FFEAA7';
      ctx.fillRect(8, 14, 3, 3); ctx.fillRect(30, 8, 3, 3);
      ctx.fillStyle = '#55E6C1'; ctx.fillRect(25, 15, 3, 3);
    });

    // --- 2. Explosion: Bouncing with White Surrender Flag ---
    this.registerSprite('rebel_death_explosion_air', 38, 38, 19, 19, (ctx) => {
      // Bouncing in the air with comical spiral eyes
      drawContouredRect(ctx, 11, 11, 16, 16, R[1], R[4], '#FFFFFF', R[5]);
      // Spiral eyes
      ctx.fillStyle = R[1]; ctx.fillRect(13, 14, 3, 3); ctx.fillRect(19, 14, 3, 3);
      // Waving tiny white surrender flag on a stick!
      ctx.fillStyle = '#BC6C25'; ctx.fillRect(28, 6, 2, 16); // flag pole
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(30, 6, 7, 6);   // white flag
    });

    this.registerSprite('rebel_death_explosion_helmet', 14, 12, 7, 6, (ctx) => {
      // Flying sky-blue macaron cap with yellow pom-pom
      drawContouredRect(ctx, 1, 3, 12, 7, R[1], R[2], '#A0CFFF', R[3]);
      ctx.fillStyle = R[13]; ctx.fillRect(5, 1, 4, 3);
    });

    this.registerSprite('rebel_death_explosion_land_0', 44, 28, 22, 26, (ctx) => {
      // Soft marshmallow cushion bounce landing
      ctx.fillStyle = '#F8EDEB';
      ctx.beginPath(); ctx.arc(22, 20, 14, 0, Math.PI * 2); ctx.fill();
      drawContouredRect(ctx, 14, 10, 16, 12, R[1], R[4], '#FFFFFF', R[5]);
      ctx.fillStyle = R[12]; ctx.fillRect(15, 14, 3, 2); ctx.fillRect(25, 14, 3, 2);
    });

    this.registerSprite('rebel_death_explosion_land_1', 44, 22, 22, 20, (ctx) => {
      // Settled on cushion waving surrender flag with sheepish smile
      ctx.fillStyle = '#FCD5CE'; ctx.fillRect(8, 16, 28, 6);
      drawContouredRect(ctx, 14, 8, 16, 10, R[1], R[4], '#FFFFFF', R[5]);
      // Little white flag
      ctx.fillStyle = '#BC6C25'; ctx.fillRect(32, 2, 2, 14);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(34, 2, 6, 5);
      // Smile
      ctx.fillStyle = '#EE5253'; ctx.fillRect(21, 13, 3, 1);
    });

    // --- 3. Cotton Candy Fluff Dance ---
    this.registerSprite('rebel_death_burn_thrash_0', 36, 44, 18, 42, (ctx) => {
      // Wrapped in colorful cotton candy fluff, dancing comically!
      ctx.fillStyle = '#FF9FF3';
      ctx.beginPath(); ctx.arc(18, 24, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#48DBFB';
      ctx.beginPath(); ctx.arc(12, 18, 8, 0, Math.PI * 2); ctx.arc(24, 18, 8, 0, Math.PI * 2); ctx.fill();
      // Peeking cute eyes
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(15, 14, 3, 3); ctx.fillRect(19, 14, 3, 3);
      ctx.fillStyle = R[1]; ctx.fillRect(16, 15, 2, 2); ctx.fillRect(20, 15, 2, 2);
    });

    this.registerSprite('rebel_death_burn_thrash_1', 36, 44, 18, 42, (ctx) => {
      // Waddling to shake off fluff
      ctx.fillStyle = '#FF9FF3';
      ctx.beginPath(); ctx.arc(18, 22, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFEAA7';
      ctx.beginPath(); ctx.arc(10, 26, 6, 0, Math.PI * 2); ctx.arc(26, 26, 6, 0, Math.PI * 2); ctx.fill();
    });

    this.registerSprite('rebel_death_burn_charcoal_0', 36, 38, 18, 36, (ctx) => {
      // Big soft cotton candy ball with peeking cute smile
      ctx.fillStyle = '#FFCAD4';
      ctx.beginPath(); ctx.arc(18, 22, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(16, 18, 2, 2); ctx.fillRect(20, 18, 2, 2);
      ctx.fillStyle = '#FF6B81'; ctx.fillRect(18, 22, 2, 1);
    });

    this.registerSprite('rebel_death_burn_ash_0', 34, 20, 17, 18, (ctx) => {
      // Colorful sugar candy sprinkle pile
      ctx.fillStyle = '#FFCAD4'; ctx.fillRect(6, 10, 22, 8);
      ctx.fillStyle = '#FFE66D'; ctx.fillRect(10, 8, 3, 2); ctx.fillRect(18, 9, 3, 2);
      ctx.fillStyle = '#48DBFB'; ctx.fillRect(14, 12, 3, 2); ctx.fillRect(22, 11, 3, 2);
    });

    this.registerSprite('rebel_death_burn_ash_1', 32, 14, 16, 12, (ctx) => {
      // Settled candy sprinkles with tiny floating heart
      ctx.fillStyle = '#FFCAD4'; ctx.fillRect(4, 6, 24, 6);
      ctx.fillStyle = '#FF6B81'; ctx.fillRect(14, 1, 3, 3);
    });

    // Backward compatibility aliases
    this.aliasSprite('soldier_rifle_idle', 'rebel_rifle_idle');
    this.aliasSprite('soldier_knife_idle', 'rebel_knife_idle');
    this.aliasSprite('soldier_grenade_idle', 'rebel_grenade_idle');
    this.aliasSprite('soldier_shield_idle', 'rebel_shield_idle');
  }

  // ==========================================
  // 3. RESCUED BUNNY PALS (CHARMING RESCUE FRIENDS)
  // ==========================================
  private generatePowSprites(): void {
    const W = 32;
    const H = 38;
    const AX = 16;
    const AY = 36;
    const P = PALETTES.POW;

    // Helper: Draw Rescued Bunny Pal (Fluffy white fur, pink ears, cute paws)
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
        // Chubby bunny sitting gently, tied with silky gift ribbon
        // Long fluffy ears with sweet pink inner pads
        drawContouredRect(ctx, 11 + sway, 1, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(12 + sway, 3, 2, 6);
        drawContouredRect(ctx, 17 + sway, 2, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(18 + sway, 4, 2, 6);

        // Round chubby bunny head
        drawContouredRect(ctx, 9, 9, 14, 11, P[1], P[2], '#FFFFFF', P[3]);

        // Sparkling anime eyes
        ctx.fillStyle = P[15]; ctx.fillRect(11, 12, 3, 4); ctx.fillRect(18, 12, 3, 4);
        ctx.fillStyle = P[10]; ctx.fillRect(11, 12, 1, 2); ctx.fillRect(18, 12, 1, 2);

        // Pink heart nose & rosy blushing cheeks
        ctx.fillStyle = P[11]; ctx.fillRect(15, 15, 2, 2);
        ctx.fillStyle = P[5]; ctx.fillRect(9, 15, 3, 2); ctx.fillRect(20, 15, 3, 2);

        // Chubby bunny body
        drawContouredRect(ctx, 8, 19, 16, 12, P[1], P[2], '#FFFFFF', P[3]);

        // Silky satin gift ribbon bow binding
        ctx.fillStyle = P[7]; ctx.fillRect(7, 22, 18, 4);
        ctx.fillStyle = P[9]; ctx.fillRect(7, 23, 18, 1);
        // Ribbon bow knot
        ctx.fillStyle = P[7]; ctx.fillRect(14, 20, 4, 4);
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(15, 21, 2, 2);

        // Cute paws
        ctx.fillStyle = P[2];
        ctx.fillRect(10, 31, 4, 4); ctx.fillRect(18, 31, 4, 4);
        return;
      }

      if (opts.freed) {
        // Freed: Silky ribbon bursts into golden glitter stars!
        // Ears raised high cheering
        drawContouredRect(ctx, 9, 1, 4, 11, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(10, 3, 2, 7);
        drawContouredRect(ctx, 19, 1, 4, 11, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(20, 3, 2, 7);

        // Raised happy paws
        drawContouredRect(ctx, 5, 12, 4, 6, P[1], P[2], '#FFFFFF', P[3]);
        drawContouredRect(ctx, 23, 12, 4, 6, P[1], P[2], '#FFFFFF', P[3]);

        // Happy head & beaming eyes (^ ^)
        drawContouredRect(ctx, 9, 9, 14, 11, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[1]; ctx.fillRect(11, 13, 3, 1); ctx.fillRect(18, 13, 3, 1);
        ctx.fillStyle = P[11]; ctx.fillRect(15, 15, 2, 2);
        ctx.fillStyle = P[5]; ctx.fillRect(9, 15, 3, 2); ctx.fillRect(20, 15, 3, 2);

        // Chubby body & mint bow tie
        drawContouredRect(ctx, 8, 19, 16, 12, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[6]; ctx.fillRect(13, 19, 6, 3); // mint bow tie

        // Golden stars bursting around
        ctx.fillStyle = P[13];
        ctx.fillRect(4, 6, 3, 3); ctx.fillRect(25, 7, 3, 3); ctx.fillRect(14, 2, 3, 3);

        // Feet
        ctx.fillStyle = P[2]; ctx.fillRect(9, 31, 5, 4); ctx.fillRect(18, 31, 5, 4);
        return;
      }

      if (opts.salute) {
        // Cheerful Double-Paw Wave ("THANK YOU!")
        drawContouredRect(ctx, 10, 2, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(11, 4, 2, 6);
        drawContouredRect(ctx, 18, 2, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(19, 4, 2, 6);

        // Head
        drawContouredRect(ctx, 9, 9, 14, 11, P[1], P[2], '#FFFFFF', P[3]);
        // Big sparkling eyes
        ctx.fillStyle = P[15]; ctx.fillRect(11, 12, 3, 4); ctx.fillRect(18, 12, 3, 4);
        ctx.fillStyle = P[10]; ctx.fillRect(11, 12, 2, 2); ctx.fillRect(18, 12, 2, 2);
        ctx.fillStyle = P[11]; ctx.fillRect(15, 15, 2, 2);
        ctx.fillStyle = P[5]; ctx.fillRect(9, 15, 3, 2); ctx.fillRect(20, 15, 3, 2);

        // Waving paw raised
        drawContouredRect(ctx, 23, 7, 5, 5, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(24, 8, 3, 3); // Pink paw pad

        // Floating hearts
        ctx.fillStyle = P[11];
        ctx.fillRect(26, 2, 3, 3); ctx.fillRect(28, 2, 3, 3); ctx.fillRect(27, 4, 3, 2);

        // Body & mint bow tie
        drawContouredRect(ctx, 8, 19, 16, 12, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[6]; ctx.fillRect(13, 19, 6, 3);
        ctx.fillStyle = P[2]; ctx.fillRect(9, 31, 5, 4); ctx.fillRect(18, 31, 5, 4);
        return;
      }

      if (opts.dropItem) {
        // Pulling out a gift-wrapped strawberry cupcake box with golden ribbon!
        drawContouredRect(ctx, 10, 2, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(11, 4, 2, 6);
        drawContouredRect(ctx, 18, 2, 4, 10, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(19, 4, 2, 6);

        // Head
        drawContouredRect(ctx, 9, 9, 14, 11, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[15]; ctx.fillRect(11, 12, 3, 4); ctx.fillRect(18, 12, 3, 4);
        ctx.fillStyle = P[10]; ctx.fillRect(11, 12, 2, 2); ctx.fillRect(18, 12, 2, 2);
        ctx.fillStyle = P[11]; ctx.fillRect(15, 15, 2, 2);
        ctx.fillStyle = P[5]; ctx.fillRect(9, 15, 3, 2); ctx.fillRect(20, 15, 3, 2);

        // Chubby body
        drawContouredRect(ctx, 8, 19, 16, 12, P[1], P[2], '#FFFFFF', P[3]);

        // Strawberry Gift Box with Golden Ribbon
        drawBeveledPlate(ctx, 19, 16, 12, 11, P[8], '#FFE5EC', '#F4ACB7', P[1]);
        ctx.fillStyle = P[13]; // Gold ribbon cross
        ctx.fillRect(24, 16, 2, 11);
        ctx.fillRect(19, 21, 12, 2);
        // Strawberry topper
        ctx.fillStyle = P[12]; ctx.fillRect(23, 13, 4, 3);
        ctx.fillStyle = P[14]; ctx.fillRect(24, 12, 2, 2); // green leaf

        // Feet
        ctx.fillStyle = P[2]; ctx.fillRect(9, 31, 5, 4); ctx.fillRect(18, 31, 5, 4);
        return;
      }

      if (opts.escapeFrame !== undefined) {
        // 4-Frame Joyful Bunny Hops (Ears flapping, happy bounce)
        const f = opts.escapeFrame;
        const off = f % 2 ? -3 : 3;
        // Bouncing ears
        drawContouredRect(ctx, 9 + off, 2, 4, 9, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(10 + off, 4, 2, 5);
        drawContouredRect(ctx, 17 - off, 3, 4, 9, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[4]; ctx.fillRect(18 - off, 5, 2, 5);

        // Head
        drawContouredRect(ctx, 9, 9, 14, 11, P[1], P[2], '#FFFFFF', P[3]);
        ctx.fillStyle = P[15]; ctx.fillRect(11, 12, 3, 4); ctx.fillRect(18, 12, 3, 4);
        ctx.fillStyle = P[10]; ctx.fillRect(11, 12, 1, 2); ctx.fillRect(18, 12, 1, 2);
        ctx.fillStyle = P[11]; ctx.fillRect(15, 15, 2, 2);
        ctx.fillStyle = P[5]; ctx.fillRect(9, 15, 3, 2); ctx.fillRect(20, 15, 3, 2);

        // Running paws
        drawContouredRect(ctx, 6 + off, 14, 4, 6, P[1], P[2], '#FFFFFF', P[3]);
        drawContouredRect(ctx, 22 - off, 14, 4, 6, P[1], P[2], '#FFFFFF', P[3]);

        // Chubby body & scampering feet
        drawContouredRect(ctx, 8, 19, 16, 11, P[1], P[2], '#FFFFFF', P[3]);
        drawContouredRect(ctx, 9 + off, 28, 5, 6, P[1], P[2], '#FFFFFF', P[3]);
        drawContouredRect(ctx, 18 - off, 28, 5, 6, P[1], P[2], '#FFFFFF', P[3]);
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

    // 1. Confectionery Macaron Roller Wagon Hull (Width 136, Height 68, AX 68, AY 60)
    this.registerSprite('iron_technical_hull', 136, 68, 68, 60, (ctx) => {
      // Strawberry macaron top shell (Rich pastel strawberry pink with royal plum outline)
      drawBeveledPlate(ctx, 10, 14, 116, 20, V[2], V[3], V[4], V[1]);

      // Whipped marshmallow cream filling middle layer
      drawContouredRect(ctx, 12, 32, 112, 10, V[1], V[7], '#FFFFFF', V[8]);
      // Piped cream dollop swirls
      ctx.fillStyle = '#FFFFFF';
      for (let x = 16; x < 120; x += 12) {
        ctx.beginPath();
        ctx.arc(x, 37, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Strawberry macaron bottom biscuit base
      drawBeveledPlate(ctx, 10, 40, 116, 14, V[4], V[2], V[1], V[1]);

      // Decorative sugar pearl beads across upper biscuit crest
      for (let x = 18; x < 118; x += 12) {
        ctx.fillStyle = V[1];
        ctx.beginPath(); ctx.arc(x, 18, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = V[15];
        ctx.beginPath(); ctx.arc(x, 18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 1, 16, 1, 1);
      }

      // Front bumper: Golden crispy waffle ram with smiling face grill
      drawBeveledPlate(ctx, 118, 22, 14, 28, V[8], '#FFF7ED', V[6], V[1]);
      // Cheerful smiling mouth on front grill
      ctx.fillStyle = V[1];
      ctx.beginPath();
      ctx.arc(125, 34, 5, 0, Math.PI);
      ctx.fill();
      // Rosy blush cheek on grill
      ctx.fillStyle = V[11];
      ctx.beginPath(); ctx.arc(121, 32, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(129, 32, 2, 0, Math.PI * 2); ctx.fill();

      // Rear twin candy-cane soda straw exhaust smokestacks
      drawContouredRect(ctx, 12, 4, 7, 12, V[1], '#FFFFFF', V[11], V[1]);
      drawContouredRect(ctx, 21, 6, 7, 10, V[1], '#FFFFFF', V[10], V[1]);
      // Striped diagonal candy pattern on straws
      ctx.fillStyle = V[11];
      ctx.fillRect(13, 6, 5, 2); ctx.fillRect(13, 11, 5, 2);
      ctx.fillStyle = V[10];
      ctx.fillRect(22, 8, 5, 2); ctx.fillRect(22, 12, 5, 2);
      // Floating tiny heart steam puffs from straws
      ctx.fillStyle = V[3];
      ctx.fillRect(14, 1, 3, 2); ctx.fillRect(23, 2, 3, 2);

      // Cheerful pastel candy sprinkles on side panel
      const sprinkles = [
        { x: 38, y: 22, c: V[14] }, // Lemon
        { x: 50, y: 20, c: V[10] }, // Mint
        { x: 62, y: 23, c: V[13] }, // Lavender
        { x: 74, y: 21, c: '#67E8F9' }, // Cyan
        { x: 86, y: 24, c: V[11] }, // Berry
        { x: 44, y: 26, c: '#FFFFFF' },
        { x: 56, y: 27, c: V[14] },
        { x: 68, y: 25, c: V[10] },
        { x: 80, y: 26, c: V[13] },
      ];
      for (const sp of sprinkles) {
        ctx.fillStyle = sp.c;
        ctx.fillRect(sp.x, sp.y, 4, 2);
      }

      // Sweet strawberry emblem badge stamped on side
      ctx.fillStyle = V[1];
      ctx.beginPath(); ctx.arc(102, 26, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = V[12];
      ctx.beginPath(); ctx.arc(102, 26, 6, 0, Math.PI * 2); ctx.fill();
      // Strawberry seeds & leafy green cap
      ctx.fillStyle = V[10]; ctx.fillRect(100, 20, 4, 2);
      ctx.fillStyle = V[15];
      ctx.fillRect(100, 24, 1, 1); ctx.fillRect(103, 25, 1, 1); ctx.fillRect(101, 28, 1, 1);
    });

    // 2. Animated Chocolate Wafer Treads with Peppermint Pinwheels (4 frames, 136x24, AX 68, AY 12)
    for (let frame = 0; frame < 4; frame++) {
      this.registerSprite(`iron_technical_treads_${frame}`, 136, 24, 68, 12, (ctx) => {
        // Warm chocolate wafer track frame
        drawBeveledPlate(ctx, 6, 2, 124, 20, V[5], V[6], V[1], V[1]);

        // 5 Spinning Peppermint Swirl Candy Wheels
        const wheelCenters = [20, 44, 68, 92, 116];
        for (const cx of wheelCenters) {
          // Wheel outer candy rim
          ctx.fillStyle = V[1];
          ctx.beginPath(); ctx.arc(cx, 12, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = V[7]; // Marshmallow white base
          ctx.beginPath(); ctx.arc(cx, 12, 7, 0, Math.PI * 2); ctx.fill();

          // 4-Spoke Peppermint Candy Swirl rotating with frame
          const ang = (frame * Math.PI) / 2;
          ctx.save();
          ctx.translate(cx, 12);
          ctx.rotate(ang);
          ctx.fillStyle = V[11]; // Strawberry swirl
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI / 2);
          ctx.lineTo(0, 0);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, 6, Math.PI, Math.PI * 1.5);
          ctx.lineTo(0, 0);
          ctx.fill();

          // Center gumdrop axle hub
          ctx.fillStyle = V[10]; // Mint gumdrop
          ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(-1, -1, 1, 1);
          ctx.restore();
        }

        // Biscuit tread cleats / cookie crumbs along track top and bottom
        ctx.fillStyle = V[8];
        const offset = (frame * 3) % 8;
        for (let x = 8 + offset; x < 124; x += 8) {
          ctx.fillRect(x, 1, 3, 2);
          ctx.fillRect(x, 21, 3, 2);
        }
      });
    }

    // 3. Rotating Pistachio & Bubblegum Dome Turret with Twin Candy Cane Cannons (48x28, AX 24, AY 20)
    this.registerSprite('iron_technical_turret', 48, 28, 24, 20, (ctx) => {
      // Rounded pistachio cream & bubblegum cupola dome
      drawBeveledPlate(ctx, 8, 6, 28, 18, V[9], V[3], V[10], V[1]);

      // Cute periscope visor slit with anime sparkle eyes
      ctx.fillStyle = V[1];
      ctx.fillRect(14, 10, 14, 4);
      ctx.fillStyle = '#48DBFB';
      ctx.fillRect(15, 11, 12, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(16, 11, 2, 1); ctx.fillRect(22, 11, 2, 1); // Twin catchlights

      // Twin Candy Cane Cannon Barrels extending forward
      drawContouredRect(ctx, 32, 10, 14, 4, V[1], '#FFFFFF', V[11], V[1]);
      drawContouredRect(ctx, 32, 16, 14, 4, V[1], '#FFFFFF', V[11], V[1]);
      // Red candy cane stripes on cannons
      ctx.fillStyle = V[11];
      ctx.fillRect(34, 10, 2, 4); ctx.fillRect(38, 10, 2, 4); ctx.fillRect(42, 10, 2, 4);
      ctx.fillRect(34, 16, 2, 4); ctx.fillRect(38, 16, 2, 4); ctx.fillRect(42, 16, 2, 4);

      // Frosted sugar doughnut muzzle tips
      drawBeveledPlate(ctx, 44, 9, 3, 6, V[14], '#FFFFFF', V[1]);
      drawBeveledPlate(ctx, 44, 15, 3, 6, V[14], '#FFFFFF', V[1]);
    });

    // 4. Sleepy Dessert Wreckage (136x68, AX 68, AY 60)
    this.registerSprite('iron_technical_wreckage', 136, 68, 68, 60, (ctx) => {
      // Soft lavender and cocoa crumb dessert resting peacefully
      drawBeveledPlate(ctx, 10, 16, 116, 36, '#4A3B52', '#7A6284', '#2C1E32', V[1]);

      // Crumbled macaron shell with melted strawberry compote oozing gently
      ctx.fillStyle = V[12];
      ctx.beginPath();
      ctx.arc(48, 34, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = V[11];
      ctx.fillRect(34, 34, 40, 12);
      ctx.fillRect(26, 40, 52, 8);

      // Comical sleepy curved eyes (^ ^) on the resting dessert hull
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(80, 28, 4, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(94, 28, 4, Math.PI, 0);
      ctx.stroke();

      // Cute rosy blush
      ctx.fillStyle = V[11];
      ctx.beginPath(); ctx.arc(74, 32, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(100, 32, 3, 0, Math.PI * 2); ctx.fill();

      // Scattered candy rainbow sprinkles on the crumbs
      ctx.fillStyle = V[14]; ctx.fillRect(42, 30, 3, 2);
      ctx.fillStyle = V[10]; ctx.fillRect(58, 36, 3, 2);
      ctx.fillStyle = '#67E8F9'; ctx.fillRect(70, 42, 3, 2);
      ctx.fillStyle = V[13]; ctx.fillRect(92, 40, 3, 2);

      // Soft "zZz" sleep puff in pure pixel art
      ctx.fillStyle = '#FFFFFF';
      // small 'z'
      ctx.fillRect(106, 18, 3, 1);
      ctx.fillRect(107, 19, 1, 1);
      ctx.fillRect(106, 20, 3, 1);
      // larger 'Z'
      ctx.fillRect(111, 14, 4, 1);
      ctx.fillRect(113, 15, 1, 1);
      ctx.fillRect(112, 16, 1, 1);
      ctx.fillRect(111, 17, 4, 1);
    });
  }

  // ==========================================
  // 5. STAGE 1 END-BOSS: TETSUYUKI WAR FORTRESS
  // ==========================================
  private generateFortressSprites(): void {
    const F = PALETTES.FORTRESS;

    // 1. Grand Sugar Citadel Hull Phase 1 (260x140, AX 130, AY 70)
    this.registerSprite('tetsuyuki_hull_p1', 260, 140, 130, 70, (ctx) => {
      // Lavender sugar-stone citadel palace battlements
      drawBeveledPlate(ctx, 10, 18, 240, 104, F[2], F[3], F[4], F[1]);

      // Scalloped royal icing battlement caps & decorative cornice drips
      ctx.fillStyle = F[3];
      ctx.fillRect(10, 16, 240, 5);
      for (let x = 14; x < 246; x += 14) {
        ctx.beginPath();
        ctx.arc(x, 21, 6, 0, Math.PI);
        ctx.fill();
      }

      // Confectionery sugar-mortar seam lines between lavender sugar blocks
      ctx.fillStyle = F[5];
      for (let x = 36; x < 240; x += 34) {
        ctx.fillRect(x, 24, 2, 94);
      }
      ctx.fillRect(12, 54, 236, 2);
      ctx.fillRect(12, 86, 236, 2);

      // Sugar pearl bead rivets across battlement tiers
      for (let x = 18; x < 240; x += 17) {
        ctx.fillStyle = F[1];
        ctx.beginPath(); ctx.arc(x, 26, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = F[15];
        ctx.beginPath(); ctx.arc(x, 26, 2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = F[1];
        ctx.beginPath(); ctx.arc(x, 58, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = F[15];
        ctx.beginPath(); ctx.arc(x, 58, 2, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = F[1];
        ctx.beginPath(); ctx.arc(x, 88, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = F[15];
        ctx.beginPath(); ctx.arc(x, 88, 2, 0, Math.PI * 2); ctx.fill();
      }

      // Crispy golden baked waffle cone tower sections on sides
      ctx.fillStyle = F[6];
      ctx.fillRect(40, 96, 140, 14);
      ctx.fillStyle = F[7]; // Waffle diagonal grid
      for (let x = 40; x < 180; x += 10) {
        ctx.fillRect(x, 96, 3, 14);
      }

      // Candy cane decorative pillar supports along lower foundation
      drawBeveledPlate(ctx, 16, 114, 46, 18, F[6], '#FFF7ED', F[7], F[1]);
      drawBeveledPlate(ctx, 180, 114, 56, 18, F[6], '#FFF7ED', F[7], F[1]);
      // Candy cane stripes on foundation pillars
      ctx.fillStyle = F[10];
      for (let x = 18; x < 60; x += 8) { ctx.fillRect(x, 116, 3, 14); }
      for (let x = 182; x < 232; x += 8) { ctx.fillRect(x, 116, 3, 14); }

      // Smiling sugar glaze arched stained-glass windows
      const windowX = [60, 100, 140, 180];
      const winColors = [F[14], F[8], F[9], F[10]];
      for (let i = 0; i < windowX.length; i++) {
        const wx = windowX[i];
        const wc = winColors[i];
        // Window arch frame
        ctx.fillStyle = F[1];
        ctx.fillRect(wx - 1, 31, 12, 14);
        ctx.fillStyle = wc;
        ctx.fillRect(wx, 34, 10, 10);
        ctx.beginPath(); ctx.arc(wx + 5, 34, 5, Math.PI, 0); ctx.fill();
        // Star sparkle in window
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(wx + 4, 33, 2, 6);
        ctx.fillRect(wx + 2, 35, 6, 2);
      }
    });

    // 2. Sugar Citadel Hull Phase 2 (Molten Strawberry Compote & Rainbow Sprinkles Breach)
    this.registerSprite('tetsuyuki_hull_p2', 260, 140, 130, 70, (ctx) => {
      // Base citadel fuselage
      drawBeveledPlate(ctx, 10, 18, 240, 104, F[2], F[3], F[4], F[1]);

      // Delicious molten strawberry jam compote breach in front-left section (80x64)
      ctx.fillStyle = F[1];
      ctx.fillRect(20, 32, 80, 64);
      ctx.fillStyle = F[12]; // Rich strawberry compote
      ctx.fillRect(22, 34, 76, 60);

      // Exposed crispy waffle biscuit wafers inside the breach
      ctx.fillStyle = F[6];
      ctx.fillRect(30, 36, 6, 56);
      ctx.fillRect(52, 36, 6, 56);
      ctx.fillRect(74, 36, 6, 56);
      ctx.fillRect(24, 60, 72, 6);
      ctx.fillStyle = F[7]; // Waffle grid marks
      ctx.fillRect(32, 40, 2, 48);
      ctx.fillRect(54, 40, 2, 48);
      ctx.fillRect(76, 40, 2, 48);

      // Luscious whipped cream dollops oozing from breach edges
      ctx.fillStyle = F[3];
      ctx.beginPath();
      ctx.arc(26, 42, 6, 0, Math.PI * 2);
      ctx.arc(38, 34, 7, 0, Math.PI * 2);
      ctx.arc(88, 48, 8, 0, Math.PI * 2);
      ctx.arc(76, 88, 7, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling candy sugar crystal conduits with glowing sparks
      ctx.fillStyle = F[14];
      ctx.fillRect(36, 68, 18, 3);
      ctx.fillRect(44, 76, 22, 3);
      // Bright star sparks
      ctx.fillStyle = F[9];
      ctx.fillRect(56, 66, 4, 4);
      ctx.fillRect(64, 78, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(57, 67, 2, 2);
      ctx.fillRect(65, 79, 2, 2);

      // Rainbow candy sprinkles scattered around the breach crater
      const breachSprinkles = [
        { x: 96, y: 32, c: F[9] },
        { x: 104, y: 38, c: F[14] },
        { x: 112, y: 30, c: F[10] },
        { x: 100, y: 46, c: F[8] },
        { x: 118, y: 44, c: '#FFFFFF' },
        { x: 108, y: 52, c: F[9] },
      ];
      for (const sp of breachSprinkles) {
        ctx.fillStyle = sp.c;
        ctx.fillRect(sp.x, sp.y, 4, 2);
      }
    });

    // 3. Sugar Citadel Hull Phase 3 (Radiant Sugar Overdrive & Glowing Heart Crystal Sanctum)
    this.registerSprite('tetsuyuki_hull_p3', 260, 140, 130, 70, (ctx) => {
      // Overheated radiant strawberry ruby glaze hull
      drawBeveledPlate(ctx, 10, 18, 240, 104, F[13], F[11], F[12], F[1]);

      // Open Central Crystal Sanctum Chamber (68x68)
      ctx.fillStyle = F[1];
      ctx.fillRect(96, 36, 68, 68);
      ctx.fillStyle = '#2A0818';
      ctx.fillRect(98, 38, 64, 64);

      // Rainbow candy sugar tiles framing the crystal sanctum
      const rainbowHues = [F[10], F[9], F[8], F[14], F[3]];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = rainbowHues[i % rainbowHues.length];
        ctx.fillRect(92 + i * 9, 32, 7, 4);
        ctx.fillRect(92 + i * 9, 106, 7, 4);
      }

      // Shimmering candy radiator cooling vents venting glowing cotton candy heat
      ctx.fillStyle = F[10];
      ctx.fillRect(174, 38, 44, 10);
      ctx.fillRect(174, 56, 44, 10);
      ctx.fillRect(174, 74, 44, 10);
      ctx.fillStyle = F[11];
      ctx.fillRect(178, 41, 36, 4);
      ctx.fillRect(178, 59, 36, 4);
      ctx.fillRect(178, 77, 36, 4);

      // Radiating golden star sparkles around the citadel
      ctx.fillStyle = F[9];
      ctx.fillRect(180, 24, 4, 4);
      ctx.fillRect(220, 30, 3, 3);
      ctx.fillRect(190, 92, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(181, 25, 2, 2);
    });

    // 4. Giant Peppermint Swirl Heavy Artillery Cannon (64x32, AX 16, AY 16)
    this.registerSprite('tetsuyuki_cannon', 64, 32, 16, 16, (ctx) => {
      // Cupcake swivel turret mount with scalloped sugar frosting
      drawBeveledPlate(ctx, 4, 4, 24, 24, F[2], F[3], F[4], F[1]);
      ctx.fillStyle = F[3];
      ctx.beginPath();
      ctx.arc(16, 16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = F[10]; // Pink center cherry
      ctx.beginPath();
      ctx.arc(16, 16, 4, 0, Math.PI * 2);
      ctx.fill();

      // Recoil marshmallow buffer
      ctx.fillStyle = F[6];
      ctx.fillRect(20, 8, 12, 16);

      // Striped Peppermint Candy Cane Artillery Barrel extending forward
      drawContouredRect(ctx, 24, 10, 36, 12, F[1], '#FFFFFF', F[10], F[4]);
      // Diagonal red peppermint stripes
      ctx.fillStyle = F[10];
      for (let s = 26; s < 56; s += 8) {
        ctx.fillRect(s, 11, 4, 10);
      }

      // Stepped crispy waffle cone muzzle crown with golden sugar ring
      drawBeveledPlate(ctx, 56, 8, 6, 16, F[6], F[9], F[1]);
      ctx.fillStyle = F[9];
      ctx.fillRect(57, 10, 2, 12);
    });

    // 5. Cupcake & Bonbon Missile Launcher Pod (48x36, AX 24, AY 30)
    this.registerSprite('tetsuyuki_rocket_pod_open', 48, 36, 24, 30, (ctx) => {
      // Waffle cone pod casing with frosted lavender trim
      drawBeveledPlate(ctx, 4, 6, 40, 28, F[6], F[3], F[7], F[1]);
      // 5 Missile launch silos loaded with candy bonbon rockets
      const tubes = [8, 15, 22, 29, 36];
      for (const tx of tubes) {
        ctx.fillStyle = F[1];
        ctx.fillRect(tx, 12, 5, 16);
        // Rocket pastel body
        ctx.fillStyle = F[3];
        ctx.fillRect(tx + 1, 12, 3, 10);
        // Pastel star candy warhead tip
        ctx.fillStyle = F[10];
        ctx.fillRect(tx + 1, 9, 3, 4);
        ctx.fillStyle = F[9];
        ctx.fillRect(tx + 2, 8, 1, 2);
      }
    });

    // 6. Rainbow Sprinkle Rotary Gatling Gun (36x24, AX 18, AY 12)
    this.registerSprite('tetsuyuki_gatling', 36, 24, 18, 12, (ctx) => {
      // Confectionery mount gear
      drawBeveledPlate(ctx, 4, 4, 16, 16, F[2], F[3], F[4], F[1]);

      // 6 Rotating candy-striped barrels
      const barrelHues = [F[10], F[14], F[8], F[9]];
      ctx.fillStyle = barrelHues[0]; ctx.fillRect(18, 6, 16, 2);
      ctx.fillStyle = barrelHues[1]; ctx.fillRect(18, 9, 16, 2);
      ctx.fillStyle = barrelHues[2]; ctx.fillRect(18, 13, 16, 2);
      ctx.fillStyle = barrelHues[3]; ctx.fillRect(18, 16, 16, 2);

      // Revolving peppermint pinwheel bracket disc with golden star center
      drawBeveledPlate(ctx, 26, 5, 4, 14, F[3], '#FFFFFF', F[4]);
      ctx.fillStyle = F[9];
      ctx.fillRect(27, 10, 2, 4);
    });

    // 7. Radiant Rainbow Prism Laser Beam (240x24, AX 0, AY 12)
    this.registerSprite('tetsuyuki_laser_beam', 240, 24, 0, 12, (ctx) => {
      // Spectacular pastel rainbow gradient beam
      // Outer strawberry pink aura
      ctx.fillStyle = F[10]; ctx.fillRect(0, 1, 240, 22);
      // Lavender violet mid-band
      ctx.fillStyle = '#D8B4E2'; ctx.fillRect(0, 3, 240, 18);
      // Sky aqua turquoise mid-beam
      ctx.fillStyle = F[14]; ctx.fillRect(0, 5, 240, 14);
      // Mint emerald highlight
      ctx.fillStyle = F[8]; ctx.fillRect(0, 7, 240, 10);
      // Radiant golden honey center
      ctx.fillStyle = F[9]; ctx.fillRect(0, 9, 240, 6);
      // Sparkling white diamond core
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 10, 240, 4);
    });

    // 8. Pulsing Heart-Shaped Sugar Crystal Core (48x48, AX 24, AY 24)
    this.registerSprite('tetsuyuki_reactor_core', 48, 48, 24, 24, (ctx) => {
      // Rotating ornate royal icing filigree ring
      ctx.fillStyle = F[1];
      ctx.fillRect(4, 4, 40, 40);
      ctx.fillStyle = F[3];
      ctx.fillRect(6, 6, 36, 36);

      // Emerald mint candy halo
      ctx.fillStyle = F[8];
      ctx.beginPath();
      ctx.arc(24, 24, 15, 0, Math.PI * 2);
      ctx.fill();

      // Glowing pink Heart-Shaped Sugar Crystal
      ctx.fillStyle = F[13];
      ctx.beginPath();
      ctx.arc(19, 20, 6, 0, Math.PI * 2);
      ctx.arc(29, 20, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(13, 22);
      ctx.lineTo(35, 22);
      ctx.lineTo(24, 34);
      ctx.closePath();
      ctx.fill();

      // Sparkling candy star highlight inside heart
      ctx.fillStyle = F[9];
      ctx.beginPath();
      ctx.arc(24, 22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(23, 20, 2, 2);

      // Radiating golden candy light rays
      ctx.fillStyle = F[9];
      ctx.fillRect(23, 1, 2, 46);
      ctx.fillRect(1, 23, 46, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(23, 11, 2, 2);
      ctx.fillRect(23, 35, 2, 2);
      ctx.fillRect(11, 23, 2, 2);
      ctx.fillRect(35, 23, 2, 2);
    });
  }

  // ==========================================
  // 6. PROJECTILES & WEAPON EFFECTS (CANDY & BUBBLEGUM)
  // ==========================================
  private generateProjectileSprites(): void {
    // Handgun bullet: Sparkling Star Candy Projectile (8x4, AX 4, AY 2)
    this.registerSprite('proj_bullet_handgun', 8, 4, 4, 2, (ctx) => {
      // Golden sugar sparkle tracer
      ctx.fillStyle = '#FED7AA'; ctx.fillRect(0, 1, 2, 2);
      // Pastel honey star body
      ctx.fillStyle = '#FDE047'; ctx.fillRect(2, 0, 4, 4);
      // Star points & glint
      ctx.fillStyle = '#FEF9C3'; ctx.fillRect(1, 1, 6, 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(3, 1, 2, 2);
    });

    // Heavy Machine Gun bullet: Cyan Bubblegum Energy Pellet (12x6, AX 6, AY 3)
    this.registerSprite('proj_bullet_hmg', 12, 6, 6, 3, (ctx) => {
      // Sweet aqua bubble aura
      ctx.fillStyle = '#67E8F9'; ctx.fillRect(0, 1, 11, 4);
      // Soft cyan bubblegum sphere
      ctx.fillStyle = '#38BDF8'; ctx.fillRect(2, 1, 8, 4);
      // Sparkling white center glint
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(5, 2, 4, 2);
    });

    // Spent shell casings: Tumbling Butterscotch Drops (4 angles, 6x6, AX 3, AY 3)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`casing_brass_${i}`, 6, 6, 3, 3, (ctx) => {
        ctx.save();
        ctx.translate(3, 3);
        ctx.rotate((i * Math.PI) / 2);
        // Golden butterscotch candy drop
        ctx.fillStyle = '#F59E0B'; ctx.fillRect(-2, -2, 4, 4);
        ctx.fillStyle = '#FDE047'; ctx.fillRect(-1, -1, 3, 2);
        // Glint
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, -1, 1, 1);
        ctx.restore();
      });
    }

    // Flame stream fireballs: Swirling Cotton Candy Puffs (5 expanding sizes)
    const flameRadii = [6, 10, 15, 20, 25];
    for (let i = 0; i < flameRadii.length; i++) {
      const r = flameRadii[i];
      const size = r * 2 + 4;
      this.registerSprite(`proj_flame_${i}`, size, size, size / 2, size / 2, (ctx) => {
        // Pastel strawberry pink outer puff
        ctx.fillStyle = PALETTES.FIRE[4];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.fill();
        // Warm peach midtone
        ctx.fillStyle = PALETTES.FIRE[3];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.75, 0, Math.PI * 2); ctx.fill();
        // Sweet buttercream yellow core
        ctx.fillStyle = PALETTES.FIRE[2];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.5, 0, Math.PI * 2); ctx.fill();
        // Marshmallow white heart
        ctx.fillStyle = PALETTES.FIRE[1];
        ctx.beginPath(); ctx.arc(size / 2, size / 2, r * 0.25, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Hand Grenade: Peppermint Bonbon Grenade with Wrapped Twists (14x14, 4 angles)
    for (let i = 0; i < 4; i++) {
      this.registerSprite(`proj_grenade_${i}`, 14, 14, 7, 7, (ctx) => {
        ctx.save();
        ctx.translate(7, 7);
        ctx.rotate((i * Math.PI) / 2);
        // Round peppermint candy body
        ctx.fillStyle = '#2C1B38';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        // Red candy swirl stripes
        ctx.fillStyle = '#FB7185';
        ctx.fillRect(-3, -1, 6, 2);
        ctx.fillRect(-1, -3, 2, 6);
        // Cute candy wrapper twist ends
        ctx.fillStyle = '#FBCFE8';
        ctx.beginPath();
        ctx.moveTo(-4, -1); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4, -1); ctx.lineTo(6, -3); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
    }

    // Micro-Rocket: Whimsical Carrot Rocket with Leafy Green Fins (18x10, AX 9, AY 5)
    this.registerSprite('proj_rocket', 18, 10, 9, 5, (ctx) => {
      // Orange carrot body
      drawContouredRect(ctx, 4, 3, 10, 4, '#2C1B38', '#FB923C', '#FDBA74', '#EA580C');
      // White sugar tip
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(14, 4, 3, 2);
      // Leafy green stabilizing fins
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(2, 1, 4, 2);
      ctx.fillRect(2, 7, 4, 2);
      // Sweet rainbow propulsion spark
      ctx.fillStyle = '#FDE047'; ctx.fillRect(0, 3, 3, 4);
      ctx.fillStyle = '#F472B6'; ctx.fillRect(1, 4, 2, 2);
    });

    // Heavy Mortar Shell: Giant Polka-Dot Bonbon (16x12, AX 8, AY 6)
    this.registerSprite('proj_mortar', 16, 12, 8, 6, (ctx) => {
      // Rounded bonbon shell body
      drawContouredRect(ctx, 2, 2, 12, 8, '#2C1B38', '#F472B6', '#FBCFE8', '#DB2777');
      // White icing polka dots
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(8, 6, 2, 2);
      ctx.fillRect(11, 4, 2, 2);
      // Candy wrapper crimped tail
      ctx.fillStyle = '#A7F3D0'; ctx.fillRect(13, 3, 2, 6);
    });
  }

  // ==========================================
  // 7. MULTI-FRAME CELEBRATORY EXPLOSIONS
  // ==========================================
  private generateExplosionSprites(): void {
    // 1. Small Explosion: Soap Bubble Pop & Confetti Dots (4 frames, 28x28, AX 14, AY 14)
    for (let f = 0; f < 4; f++) {
      const size = 28;
      this.registerSprite(`explosion_small_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const rad = 4 + f * 3;
        if (f < 2) {
          // Translucent bubble expanding
          ctx.strokeStyle = '#67E8F9';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(14, 14, rad, 0, Math.PI * 2); ctx.stroke();
          // Pastel star burst core
          ctx.fillStyle = PALETTES.FIRE[1]; ctx.beginPath(); ctx.arc(14, 14, rad * 0.6, 0, Math.PI * 2); ctx.fill();
        } else {
          // Confetti dots popping outward
          const confettiColors = ['#FF9FF3', '#FECA57', '#54A0FF', '#1DD1A1'];
          for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3;
            const dist = rad + 2;
            const cx = 14 + Math.cos(ang) * dist;
            const cy = 14 + Math.sin(ang) * dist;
            ctx.fillStyle = confettiColors[i % confettiColors.length];
            ctx.fillRect(cx - 1, cy - 1, 3, 3);
          }
          // Soft marshmallow puff
          ctx.fillStyle = PALETTES.FIRE[6];
          ctx.beginPath(); ctx.arc(14, 14, rad * 0.4, 0, Math.PI * 2); ctx.fill();
        }
      });
    }

    // 2. Medium Explosion: Confectionery Blossom Burst & Flying Candy Stars (6 frames, 52x52, AX 26, AY 26)
    for (let f = 0; f < 6; f++) {
      const size = 52;
      this.registerSprite(`explosion_medium_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const rad = 6 + f * 3.5;
        const col = f < 2 ? PALETTES.FIRE[1] : f < 4 ? PALETTES.FIRE[3] : PALETTES.FIRE[6];

        // Soft pastel floral ring
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(26, 26, rad, 0, Math.PI * 2); ctx.fill();

        // Flying confetti stars & diamond glints
        const confettiHues = ['#FF9FF3', '#FECA57', '#54A0FF', '#1DD1A1', '#FDA4AF', '#FDE047'];
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4 + f * 0.2;
          const dist = rad + (f > 2 ? 6 : 2);
          const px = 26 + Math.cos(ang) * dist;
          const py = 26 + Math.sin(ang) * dist;
          ctx.fillStyle = confettiHues[i % confettiHues.length];
          ctx.fillRect(px - 1, py - 1, 3, 3);
        }

        // Center white sparkle
        if (f < 3) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(24, 24, 4, 4);
        }
      });
    }

    // 3. Large Boss Detonation: Fairytale Celebration Fireworks (8 frames, 100x100, AX 50, AY 50)
    for (let f = 0; f < 8; f++) {
      const size = 100;
      this.registerSprite(`explosion_large_${f}`, size, size, size / 2, size / 2, (ctx) => {
        const progress = f / 7;
        const rad = 10 + progress * 36;

        if (progress < 0.5) {
          // Pastel rainbow shockwave ring
          const rainbowColors = ['#FF9FF3', '#FECA57', '#54A0FF', '#1DD1A1'];
          ctx.strokeStyle = rainbowColors[f % rainbowColors.length];
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(50, 50, rad * 1.1, 0, Math.PI * 2); ctx.stroke();

          // Warm pastel star core
          ctx.fillStyle = PALETTES.FIRE[2]; ctx.beginPath(); ctx.arc(50, 50, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(50, 50, rad * 0.5, 0, Math.PI * 2); ctx.fill();
        } else {
          // Multi-colored celebration confetti shower & marshmallow cloud puffs
          ctx.fillStyle = PALETTES.FIRE[7]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = PALETTES.FIRE[6]; ctx.beginPath(); ctx.arc(50, 50, rad * 0.4, 0, Math.PI * 2); ctx.fill();

          // Flying celebration star particles and heart glints
          const partyColors = ['#FF9FF3', '#FECA57', '#54A0FF', '#1DD1A1', '#FF6B6B', '#F8A5C2'];
          for (let i = 0; i < 12; i++) {
            const ang = (i * Math.PI) / 6 + f * 0.3;
            const dist = rad * 0.9 + (i % 3) * 6;
            const px = 50 + Math.cos(ang) * dist;
            const py = 50 + Math.sin(ang) * dist;
            ctx.fillStyle = partyColors[i % partyColors.length];
            ctx.fillRect(px - 2, py - 2, 4, 4);
          }
        }
      });
    }
  }

  // ==========================================
  // 8. CUTE RETRO ARCADE HUD BADGES & DIGITS
  // ==========================================
  private generateHudSprites(): void {
    const H = PALETTES.HUD;

    // "H" Heavy Machine Gun Candy Sticker Badge (24x20)
    this.registerSprite('hud_badge_hmg', 24, 20, 0, 0, (ctx) => {
      // Golden scalloped border
      drawBeveledPlate(ctx, 0, 0, 24, 20, H[4], H[2], H[3], H[1]);
      // 3D marshmallow letter 'H'
      ctx.fillStyle = H[1];
      ctx.fillRect(7, 6, 3, 10);
      ctx.fillRect(16, 6, 3, 10);
      ctx.fillRect(10, 10, 6, 3);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 5, 3, 10);
      ctx.fillRect(15, 5, 3, 10);
      ctx.fillRect(9, 9, 6, 3);
      // Sparkle star glint
      ctx.fillStyle = H[3];
      ctx.fillRect(17, 4, 2, 2);
    });

    // "F" Flame Shot Strawberry Jelly Badge (24x20)
    this.registerSprite('hud_badge_flame', 24, 20, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 24, 20, H[5], H[2], H[3], H[1]);
      // 3D marshmallow letter 'F'
      ctx.fillStyle = H[1];
      ctx.fillRect(8, 6, 3, 10);
      ctx.fillRect(11, 6, 7, 3);
      ctx.fillRect(11, 10, 5, 3);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 5, 3, 10);
      ctx.fillRect(10, 5, 7, 3);
      ctx.fillRect(10, 9, 5, 3);
      // Sparkle star glint
      ctx.fillStyle = H[3];
      ctx.fillRect(16, 4, 2, 2);
    });

    // Default Handgun Lilac Toy Blaster Badge (24x20)
    this.registerSprite('hud_badge_pistol', 24, 20, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 24, 20, H[10], H[2], H[3], H[1]);
      // Toy blaster icon
      ctx.fillStyle = H[1];
      ctx.fillRect(7, 8, 10, 3);
      ctx.fillRect(13, 11, 4, 5);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 7, 10, 3);
      ctx.fillRect(12, 10, 4, 5);
      // Sparkle
      ctx.fillStyle = H[3];
      ctx.fillRect(15, 6, 2, 2);
    });

    // Peppermint Bonbon Grenade Icon (16x16)
    this.registerSprite('hud_icon_grenade', 16, 16, 0, 0, (ctx) => {
      // Swirled round candy
      ctx.fillStyle = H[1];
      ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = H[5];
      ctx.fillRect(5, 7, 6, 2);
      ctx.fillRect(7, 5, 2, 6);
      // Wrapper crimps
      ctx.fillStyle = H[11];
      ctx.fillRect(1, 6, 2, 4);
      ctx.fillRect(13, 6, 2, 4);
    });

    // Rescued Bunny Pal Icon (16x16)
    this.registerSprite('hud_icon_pow', 16, 16, 0, 0, (ctx) => {
      // Bunny head
      ctx.fillStyle = H[1];
      ctx.beginPath(); ctx.arc(8, 10, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(8, 10, 4, 0, Math.PI * 2); ctx.fill();
      // Fluffy ears
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(5, 2, 2, 5);
      ctx.fillRect(9, 2, 2, 5);
      // Pink inner ear
      ctx.fillStyle = H[11];
      ctx.fillRect(5, 3, 1, 3);
      ctx.fillRect(10, 3, 1, 3);
      // Rosy cheeks
      ctx.fillStyle = H[11];
      ctx.fillRect(5, 10, 1, 1);
      ctx.fillRect(10, 10, 1, 1);
    });

    // Score & Ammo Digits 0 to 9 (8x12 each, Honey-Gold Jelly Arcade Digits)
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
        // Confectionery drop shadow
        ctx.fillStyle = H[1];
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] === '1') {
              ctx.fillRect(x * 2 + 1, y * 2 + 1, 2, 2);
            }
          }
        }
        // Honey-gold face
        ctx.fillStyle = H[2];
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] === '1') {
              ctx.fillRect(x * 2, y * 2, 2, 2);
            }
          }
        }
        // Vanilla sugar glint highlight on top edge
        ctx.fillStyle = H[3];
        for (let x = 0; x < rows[0].length; x++) {
          if (rows[0][x] === '1') {
            ctx.fillRect(x * 2, 0, 2, 1);
          }
        }
      });
    }

    // Special symbol 'infinity' (for default handgun ammo): Pink Ribbon Pretzel
    this.registerSprite('hud_symbol_infinity', 12, 10, 0, 0, (ctx) => {
      ctx.fillStyle = H[8];
      ctx.fillRect(1, 3, 4, 4);
      ctx.fillRect(7, 3, 4, 4);
      ctx.fillRect(3, 4, 6, 2);
      ctx.fillStyle = H[11];
      ctx.fillRect(2, 4, 2, 2);
      ctx.fillRect(8, 4, 2, 2);
    });

    // Boss Health Bar Frame (184x12): Crispy Waffle Bar Frame with Confectionery Trim
    this.registerSprite('hud_boss_bar_frame', 184, 12, 0, 0, (ctx) => {
      drawBeveledPlate(ctx, 0, 0, 184, 12, '#3A1E4A', H[2], H[3], H[1]);
      // Waffle pattern dots
      ctx.fillStyle = H[7];
      for (let x = 6; x < 178; x += 8) {
        ctx.fillRect(x, 4, 2, 4);
      }
    });
  }

  /**
   * Generates procedural expansion sprites for Milestone M3 (Ultimate Move, Iron Nokana, Hazards, Allies, Items).
   * All sprites registered here are strictly captured in expansionKeys to preserve the 164-key baseline invariant.
   */
  private generateExpansionSprites(): void {
    // -----------------------------------------------------------------------
    // 1. Ultimate Move: Tactical Bomber & Shadows (7 sprites)
    // -----------------------------------------------------------------------

    // Tactical Heavy Bomber (64x32)
    this.registerExpansionSprite('tactical_bomber', 64, 32, 32, 16, (ctx) => {
      // Main fuselage
      drawBeveledPlate(ctx, 8, 10, 48, 12, '#485848', '#708870', '#283828', '#141c14');
      // Wings
      drawBeveledPlate(ctx, 20, 2, 24, 28, '#3d4d3d', '#607860', '#203020', '#101810');
      // Cockpit canopy
      ctx.fillStyle = '#68c8e8';
      ctx.fillRect(40, 12, 10, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(44, 12, 4, 2);
      // Twin Engines
      drawBeveledPlate(ctx, 16, 6, 12, 6, '#555555', '#888888', '#222222');
      drawBeveledPlate(ctx, 16, 20, 12, 6, '#555555', '#888888', '#222222');
      // Propeller blur
      ctx.fillStyle = 'rgba(240, 240, 200, 0.6)';
      ctx.fillRect(14, 4, 2, 10);
      ctx.fillRect(14, 18, 2, 10);
      // Camo markings & star emblem
      ctx.fillStyle = '#e8c040';
      ctx.fillRect(28, 14, 4, 4);
      drawRivet(ctx, 24, 14);
      drawRivet(ctx, 36, 14);
    });

    // Tactical Bomber Ground Shadow (48x16)
    this.registerExpansionSprite('tactical_bomber_shadow', 48, 16, 24, 8, (ctx) => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.45)';
      ctx.fillRect(4, 4, 40, 8);
      ctx.fillRect(12, 1, 24, 14);
      ctx.fillRect(2, 6, 44, 4);
    });

    // Falling Blockbuster Bomb 0 & 1 (16x24)
    for (let f = 0; f < 2; f++) {
      this.registerExpansionSprite(`air_bomb_falling_${f}`, 16, 24, 8, 12, (ctx) => {
        // Bomb body
        drawBeveledPlate(ctx, 3, 4, 10, 14, '#384038', '#586858', '#182018', '#081008');
        // Yellow hazard warning stripe
        ctx.fillStyle = f === 0 ? '#e8b820' : '#f8d040';
        ctx.fillRect(4, 9, 8, 3);
        // Tail fins
        ctx.fillStyle = '#202820';
        ctx.fillRect(1, 16, 4, 6);
        ctx.fillRect(11, 16, 4, 6);
        // Nose fuse glint
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(7, 2, 2, 2);
      });
    }

    // Expanding Shockwave Rings 0, 1, 2 (48x48)
    const ringAlphas = [0.9, 0.65, 0.4];
    const ringRadii = [12, 18, 22];
    for (let i = 0; i < 3; i++) {
      this.registerExpansionSprite(`shockwave_ring_${i}`, 48, 48, 24, 24, (ctx) => {
        const rad = ringRadii[i];
        ctx.save();
        ctx.globalAlpha = ringAlphas[i];
        // Outer glow
        ctx.fillStyle = '#ffaa33';
        ctx.fillRect(24 - rad - 2, 24 - rad - 2, (rad + 2) * 2, 2);
        ctx.fillRect(24 - rad - 2, 24 + rad, (rad + 2) * 2, 2);
        ctx.fillRect(24 - rad - 2, 24 - rad, 2, rad * 2);
        ctx.fillRect(24 + rad, 24 - rad, 2, rad * 2);
        // Intense core ring
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(24 - rad, 24 - rad, rad * 2, 2);
        ctx.fillRect(24 - rad, 24 + rad - 2, rad * 2, 2);
        ctx.fillRect(24 - rad, 24 - rad + 2, 2, (rad - 2) * 2);
        ctx.fillRect(24 + rad - 2, 24 - rad + 2, 2, (rad - 2) * 2);
        ctx.restore();
      });
    }

    // -----------------------------------------------------------------------
    // 2. Boss Iron Nokana: Heavy Siege Crawler (7 sprites)
    // -----------------------------------------------------------------------

    // Nokana Armored Hull (120x60)
    this.registerExpansionSprite('iron_nokana_hull', 120, 60, 60, 30, (ctx) => {
      // Main chassis
      drawBeveledPlate(ctx, 4, 12, 112, 38, '#702820', '#a84838', '#401410', '#1c0808');
      // Upper superstructure armor
      drawBeveledPlate(ctx, 24, 4, 72, 20, '#883028', '#c05848', '#501814', '#1c0808');
      // Front ramming prow
      drawBeveledPlate(ctx, 96, 20, 20, 24, '#505058', '#808088', '#282830', '#101018');
      // Rivets along armor seams
      for (let rx = 10; rx <= 110; rx += 14) {
        drawRivet(ctx, rx, 14);
        drawRivet(ctx, rx, 46);
      }
      // Exhaust heat vent
      ctx.fillStyle = '#ff6622';
      ctx.fillRect(28, 6, 16, 4);
    });

    // Nokana Heavy Treads 0 & 1 (110x24)
    for (let t = 0; t < 2; t++) {
      this.registerExpansionSprite(`iron_nokana_treads_${t}`, 110, 24, 55, 12, (ctx) => {
        // Tread outer frame
        drawBeveledPlate(ctx, 0, 2, 110, 20, '#282828', '#484848', '#141414', '#080808');
        // Rotating road wheels
        const wheelOffset = t === 0 ? 0 : 4;
        for (let wx = 8 + wheelOffset; wx < 100; wx += 16) {
          ctx.fillStyle = '#606068';
          ctx.fillRect(wx, 6, 10, 10);
          ctx.fillStyle = '#181820';
          ctx.fillRect(wx + 3, 9, 4, 4);
        }
      });
    }

    // Nokana Main Artillery Cannon (64x20)
    this.registerExpansionSprite('iron_nokana_cannon', 64, 20, 16, 10, (ctx) => {
      drawBeveledPlate(ctx, 12, 4, 48, 12, '#484850', '#707078', '#242428', '#101014');
      // Muzzle brake
      drawBeveledPlate(ctx, 54, 2, 8, 16, '#606068', '#888890', '#303038', '#101014');
      // Pivot mount
      ctx.fillStyle = '#303034';
      ctx.fillRect(4, 2, 12, 16);
    });

    // Nokana Vertical Missile Pod (36x24)
    this.registerExpansionSprite('iron_nokana_missile_pod', 36, 24, 18, 12, (ctx) => {
      drawBeveledPlate(ctx, 2, 2, 32, 20, '#585860', '#808088', '#303038', '#141418');
      // 6 missile launch tube caps
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = '#aa2222';
          ctx.fillRect(6 + c * 9, 5 + r * 8, 6, 5);
          ctx.fillStyle = '#f0a040';
          ctx.fillRect(8 + c * 9, 7 + r * 8, 2, 2);
        }
      }
    });

    // Nokana Flamethrower Turret (30x20)
    this.registerExpansionSprite('iron_nokana_flame_turret', 30, 20, 15, 10, (ctx) => {
      drawBeveledPlate(ctx, 4, 4, 22, 12, '#604838', '#887058', '#382818', '#141008');
      ctx.fillStyle = '#ff5511';
      ctx.fillRect(0, 8, 6, 4);
    });

    // Nokana Demolished Wreckage (120x50)
    this.registerExpansionSprite('iron_nokana_wreckage', 120, 50, 60, 25, (ctx) => {
      drawBeveledPlate(ctx, 4, 14, 112, 32, '#282424', '#443c3c', '#181414', '#080606');
      // Jagged breach holes
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(36, 18, 18, 10);
      ctx.fillStyle = '#100804';
      ctx.fillRect(38, 20, 14, 6);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(74, 16, 14, 8);
    });

    // -----------------------------------------------------------------------
    // 3. Crisis Environmental Hazards (7 sprites)
    // -----------------------------------------------------------------------

    // Hazard Reticle: Artillery Strike (32x32)
    this.registerExpansionSprite('hazard_reticle_artillery', 32, 32, 16, 16, (ctx) => {
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 24, 24);
      // Crosshair lines
      ctx.fillStyle = '#ffdd22';
      ctx.fillRect(15, 1, 2, 30);
      ctx.fillRect(1, 15, 30, 2);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(13, 13, 6, 6);
    });

    // Hazard Reticle: Falling Debris (28x28)
    this.registerExpansionSprite('hazard_reticle_debris', 28, 28, 14, 14, (ctx) => {
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, 22, 22);
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(13, 5, 2, 12);
      ctx.fillRect(13, 20, 2, 3);
    });

    // Hazard Warning Icon Triangle (16x16)
    this.registerExpansionSprite('hazard_warning_icon', 16, 16, 8, 8, (ctx) => {
      ctx.fillStyle = '#f0c020';
      ctx.fillRect(6, 1, 4, 2);
      ctx.fillRect(4, 3, 8, 4);
      ctx.fillRect(2, 7, 12, 5);
      ctx.fillRect(0, 12, 16, 4);
      ctx.fillStyle = '#101010';
      ctx.fillRect(7, 4, 2, 5);
      ctx.fillRect(7, 11, 2, 2);
    });

    // Falling Artillery Shell (12x24)
    this.registerExpansionSprite('hazard_shell_falling', 12, 24, 6, 12, (ctx) => {
      drawBeveledPlate(ctx, 2, 4, 8, 16, '#505058', '#808088', '#282830', '#101014');
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(4, 1, 4, 4);
      ctx.fillStyle = '#ffbb22';
      ctx.fillRect(5, 0, 2, 2);
    });

    // Falling Ceiling Debris (20x20)
    this.registerExpansionSprite('hazard_falling_debris', 20, 20, 10, 10, (ctx) => {
      drawBeveledPlate(ctx, 2, 2, 16, 16, '#606060', '#909090', '#383838', '#181818');
      ctx.fillStyle = '#b03020';
      ctx.fillRect(6, 6, 8, 4);
    });

    // Ground Flame Hazard 0 & 1 (24x24)
    for (let f = 0; f < 2; f++) {
      this.registerExpansionSprite(`hazard_ground_flame_${f}`, 24, 24, 12, 20, (ctx) => {
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(2, 12, 20, 10);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(4, 6, 16, 12);
        ctx.fillStyle = '#ffee33';
        ctx.fillRect(f === 0 ? 8 : 10, 2, 6, 10);
      });
    }

    // -----------------------------------------------------------------------
    // 4. Autonomous Ally Hyakutaro Ichimonji (10 sprites)
    // -----------------------------------------------------------------------

    // Hyakutaro Idle 0 & 1 (24x36)
    for (let i = 0; i < 2; i++) {
      this.registerExpansionSprite(`ally_hyakutaro_idle_${i}`, 24, 36, 12, 32, (ctx) => {
        // Tattered prisoner shorts
        ctx.fillStyle = '#506890';
        ctx.fillRect(6, 16, 12, 10);
        // Bare chest & head
        ctx.fillStyle = '#e8a870';
        ctx.fillRect(7, 8, 10, 9);
        ctx.fillRect(8, 2, 8, 7);
        // Wild unkempt hair & beard
        ctx.fillStyle = '#483828';
        ctx.fillRect(6, 0, 12, 4);
        ctx.fillRect(7, 6, 10, 4);
        // Martial stance legs
        ctx.fillStyle = '#d89058';
        ctx.fillRect(7, 26, 4, 6 + (i === 1 ? 1 : 0));
        ctx.fillRect(13, 26, 4, 6);
      });
    }

    // Hyakutaro Walk 0 & 1 (24x36)
    for (let w = 0; w < 2; w++) {
      this.registerExpansionSprite(`ally_hyakutaro_walk_${w}`, 24, 36, 12, 32, (ctx) => {
        ctx.fillStyle = '#506890';
        ctx.fillRect(6, 16, 12, 10);
        ctx.fillStyle = '#e8a870';
        ctx.fillRect(7, 8, 10, 9);
        ctx.fillRect(8, 2, 8, 7);
        ctx.fillStyle = '#483828';
        ctx.fillRect(6, 0, 12, 4);
        // Stride legs
        ctx.fillStyle = '#d89058';
        if (w === 0) {
          ctx.fillRect(4, 26, 4, 7);
          ctx.fillRect(14, 25, 4, 5);
        } else {
          ctx.fillRect(14, 26, 4, 7);
          ctx.fillRect(4, 25, 4, 5);
        }
      });
    }

    // Hyakutaro Hadouken Ki-Blast Attack 0 & 1 (32x36)
    for (let a = 0; a < 2; a++) {
      this.registerExpansionSprite(`ally_hyakutaro_attack_${a}`, 32, 36, 16, 32, (ctx) => {
        ctx.fillStyle = '#506890';
        ctx.fillRect(6, 18, 12, 10);
        ctx.fillStyle = '#e8a870';
        ctx.fillRect(8, 10, 10, 9);
        ctx.fillRect(9, 4, 8, 7);
        ctx.fillStyle = '#483828';
        ctx.fillRect(7, 2, 12, 4);
        // Thrusting arms
        ctx.fillStyle = '#e8a870';
        ctx.fillRect(18, 12, 10, 6);
        // Glowing Ki Energy at palms
        ctx.fillStyle = a === 0 ? '#44aaff' : '#ffffff';
        ctx.fillRect(26, 10, 6, 10);
      });
    }

    // Hyakutaro Celebrate Cheers 0 & 1 (24x36)
    for (let c = 0; c < 2; c++) {
      this.registerExpansionSprite(`ally_hyakutaro_celebrate_${c}`, 24, 36, 12, 32, (ctx) => {
        ctx.fillStyle = '#506890';
        ctx.fillRect(6, 16, 12, 10);
        ctx.fillStyle = '#e8a870';
        ctx.fillRect(7, 8, 10, 9);
        ctx.fillRect(8, 2, 8, 7);
        // Raised arms
        ctx.fillRect(3, 2, 4, 10);
        ctx.fillRect(17, 2, 4, 10);
      });
    }

    // Ally Ki Blast Projectile 0 & 1 (20x20)
    for (let k = 0; k < 2; k++) {
      this.registerExpansionSprite(`ally_ki_blast_${k}`, 20, 20, 10, 10, (ctx) => {
        // Outer aura
        ctx.fillStyle = '#2288ff';
        ctx.fillRect(2, 2, 16, 16);
        // Intense cyan core
        ctx.fillStyle = '#88eeff';
        ctx.fillRect(5, 5, 10, 10);
        // Pure white center
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(7, 7, 6, 6);
      });
    }

    // -----------------------------------------------------------------------
    // 5. Diverse Weapons, Items & Shields (10 sprites)
    // -----------------------------------------------------------------------

    // Item Crate: Shotgun (24x20)
    this.registerExpansionSprite('item_crate_shotgun', 24, 20, 12, 10, (ctx) => {
      drawBeveledPlate(ctx, 1, 1, 22, 18, '#885522', '#bb8844', '#553311', '#221100');
      // Blue label with "S"
      ctx.fillStyle = '#2255aa';
      ctx.fillRect(5, 4, 14, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, 6, 10, 2);
      ctx.fillRect(7, 8, 3, 2);
      ctx.fillRect(7, 10, 10, 2);
      ctx.fillRect(14, 12, 3, 2);
      ctx.fillRect(7, 14, 10, 2);
    });

    // Item Crate: Laser Gun (24x20)
    this.registerExpansionSprite('item_crate_laser', 24, 20, 12, 10, (ctx) => {
      drawBeveledPlate(ctx, 1, 1, 22, 18, '#3377aa', '#55aacc', '#1e4466', '#0a1e2e');
      // "L"
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 5, 3, 10);
      ctx.fillRect(8, 13, 8, 2);
    });

    // Item Crate: Rocket Launcher (24x20)
    this.registerExpansionSprite('item_crate_rocket', 24, 20, 12, 10, (ctx) => {
      drawBeveledPlate(ctx, 1, 1, 22, 18, '#882222', '#bb4444', '#551111', '#220000');
      // "R"
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 5, 3, 10);
      ctx.fillRect(11, 5, 5, 2);
      ctx.fillRect(14, 7, 2, 4);
      ctx.fillRect(11, 10, 5, 2);
      ctx.fillRect(13, 12, 3, 3);
    });

    // Item Crate: Medkit (20x20)
    this.registerExpansionSprite('item_crate_medkit', 20, 20, 10, 10, (ctx) => {
      drawBeveledPlate(ctx, 1, 1, 18, 18, '#eeeeee', '#ffffff', '#cccccc', '#555555');
      // Red cross
      ctx.fillStyle = '#ee2222';
      ctx.fillRect(8, 4, 4, 12);
      ctx.fillRect(4, 8, 12, 4);
    });

    // Item Crate: Shield (20x20)
    this.registerExpansionSprite('item_crate_shield', 20, 20, 10, 10, (ctx) => {
      drawBeveledPlate(ctx, 1, 1, 18, 18, '#1e3860', '#3060a0', '#102038', '#081018');
      // Blue energy shield emblem
      ctx.fillStyle = '#44bbff';
      ctx.fillRect(6, 4, 8, 4);
      ctx.fillRect(5, 7, 10, 5);
      ctx.fillRect(7, 12, 6, 4);
      ctx.fillRect(9, 16, 2, 2);
    });

    // Projectile: Shotgun Pellet (8x8)
    this.registerExpansionSprite('proj_shotgun_pellet', 8, 8, 4, 4, (ctx) => {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(1, 1, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 4, 4);
    });

    // Projectile: Laser Continuous Beam Segment (24x8)
    this.registerExpansionSprite('proj_laser_beam', 24, 8, 12, 4, (ctx) => {
      ctx.fillStyle = '#0088ff';
      ctx.fillRect(0, 1, 24, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 3, 24, 2);
    });

    // Projectile: Laser Beam Penetrating Head (16x10)
    this.registerExpansionSprite('proj_laser_head', 16, 10, 8, 5, (ctx) => {
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(2, 1, 12, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 3, 8, 4);
    });

    // Projectile: Homing Rocket Missile (20x10)
    this.registerExpansionSprite('proj_homing_rocket', 20, 10, 10, 5, (ctx) => {
      drawBeveledPlate(ctx, 6, 2, 12, 6, '#485848', '#708870', '#283828', '#141c14');
      // Fiery exhaust plume
      ctx.fillStyle = '#ff5500';
      ctx.fillRect(0, 3, 6, 4);
      ctx.fillStyle = '#ffdd33';
      ctx.fillRect(2, 4, 4, 2);
      // Red warhead tip
      ctx.fillStyle = '#dd2222';
      ctx.fillRect(18, 3, 2, 4);
    });

    // Player Shield Bubble (48x48)
    this.registerExpansionSprite('player_shield_bubble', 48, 48, 24, 24, (ctx) => {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#33aaff';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, 40, 40);
      ctx.fillStyle = 'rgba(100, 200, 255, 0.25)';
      ctx.fillRect(6, 6, 36, 36);
      // Hexagonal glints
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, 10, 6, 2);
      ctx.fillRect(32, 12, 4, 2);
      ctx.restore();
    });

    // ==========================================
    // NOVEL CUTE ENEMIES EXPANSION SPRITES (M2)
    // ==========================================

    // Cute Marshmallow Slime (28x24, anchor: 14, 20)
    this.registerExpansionSprite('cute_marshmallow_slime', 28, 24, 14, 20, (ctx) => {
      // Pillowy marshmallow dome body
      ctx.fillStyle = '#FBCFE8'; // Pastel strawberry pink
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(14, 13, 11, 8, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(14, 13, 9, 0, Math.PI * 2);
      }
      ctx.fill();

      // Soft white powdered sugar highlight
      ctx.fillStyle = '#FFF1F2';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(14, 8, 8, 3, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(14, 8, 5, 0, Math.PI * 2);
      }
      ctx.fill();

      // Cute anime dot eyes
      ctx.fillStyle = '#1E162B';
      ctx.fillRect(10, 11, 2, 3);
      ctx.fillRect(16, 11, 2, 3);
      // Specular eye catchlight
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(10, 11, 1, 1);
      ctx.fillRect(16, 11, 1, 1);

      // Rosy blushing cheeks
      ctx.fillStyle = '#FDA4AF';
      ctx.fillRect(8, 14, 3, 2);
      ctx.fillRect(17, 14, 3, 2);

      // Tiny happy smile
      ctx.fillStyle = '#BE185D';
      ctx.fillRect(13, 15, 2, 1);
    });

    // Cute Honey Bee (28x24, anchor: 14, 12)
    this.registerExpansionSprite('cute_honey_bee', 28, 24, 14, 12, (ctx) => {
      // Chubby honey-gold body
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(14, 12, 10, 8, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(14, 12, 8, 0, Math.PI * 2);
      }
      ctx.fill();

      // Chocolate / molasses stripes
      ctx.fillStyle = '#78350F';
      ctx.fillRect(11, 5, 3, 14);
      ctx.fillRect(17, 6, 3, 12);

      // Translucent fluttering wings
      ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(10, 4, 4, 7, -0.4, 0, Math.PI * 2);
        (ctx as any).ellipse(16, 4, 4, 7, 0.4, 0, Math.PI * 2);
      } else {
        ctx.arc(10, 4, 4, 0, Math.PI * 2);
        ctx.arc(16, 4, 4, 0, Math.PI * 2);
      }
      ctx.fill();

      // Antennae with golden pollen balls
      ctx.fillStyle = '#78350F';
      ctx.fillRect(20, 4, 1, 4);
      ctx.fillRect(22, 5, 1, 4);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(19, 3, 3, 2);
      ctx.fillRect(22, 4, 3, 2);

      // Cute face
      ctx.fillStyle = '#1E162B';
      ctx.fillRect(21, 10, 2, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(22, 10, 1, 1);
      ctx.fillStyle = '#F472B6';
      ctx.fillRect(20, 13, 2, 2);
    });

    // Cute Donut Roller (28x28, anchor: 14, 14)
    this.registerExpansionSprite('cute_donut_roller', 28, 28, 14, 14, (ctx) => {
      // Golden baked pastry ring
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(14, 14, 12, 0, Math.PI * 2);
      ctx.fill();

      // Strawberry frosting coating
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(14, 14, 10, 0, Math.PI * 2);
      ctx.fill();

      // Donut hole
      ctx.fillStyle = '#1E162B';
      ctx.beginPath();
      ctx.arc(14, 14, 4, 0, Math.PI * 2);
      ctx.fill();

      // Multi-colored candy sprinkles
      ctx.fillStyle = '#6EE7B7'; // Mint
      ctx.fillRect(8, 7, 3, 1);
      ctx.fillRect(18, 19, 3, 1);
      ctx.fillStyle = '#FDE047'; // Lemon
      ctx.fillRect(18, 8, 1, 3);
      ctx.fillRect(7, 17, 1, 3);
      ctx.fillStyle = '#DDD6FE'; // Lavender
      ctx.fillRect(13, 5, 2, 2);
      ctx.fillRect(14, 21, 2, 2);
      ctx.fillStyle = '#BAE6FD'; // Sky
      ctx.fillRect(6, 12, 2, 2);
      ctx.fillRect(20, 13, 2, 2);
    });

    // Cute Gummy Colossus Boss (80x90, anchor: 40, 80)
    this.registerExpansionSprite('cute_gummy_colossus', 80, 90, 40, 80, (ctx) => {
      ctx.save();
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(40, 52, 26, 28, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(40, 52, 26, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(40, 24, 22, 20, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(40, 24, 20, 0, Math.PI * 2);
      }
      ctx.fill();

      // Rounded Bear Ears
      ctx.fillStyle = '#BE123C';
      ctx.beginPath();
      ctx.arc(22, 10, 8, 0, Math.PI * 2);
      ctx.arc(58, 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDA4AF'; // Inner ear
      ctx.beginPath();
      ctx.arc(22, 10, 4, 0, Math.PI * 2);
      ctx.arc(58, 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Chunky Paws & Feet
      ctx.fillStyle = '#BE123C';
      ctx.beginPath();
      ctx.arc(16, 42, 7, 0, Math.PI * 2);
      ctx.arc(64, 42, 7, 0, Math.PI * 2);
      ctx.arc(26, 78, 9, 0, Math.PI * 2);
      ctx.arc(54, 78, 9, 0, Math.PI * 2);
      ctx.fill();

      // Paw pads
      ctx.fillStyle = '#FECDD3';
      ctx.beginPath();
      ctx.arc(26, 79, 4, 0, Math.PI * 2);
      ctx.arc(54, 79, 4, 0, Math.PI * 2);
      ctx.fill();

      // Gelatinous translucent highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(34, 46, 12, 18, -0.3, 0, Math.PI * 2);
      } else {
        ctx.arc(34, 46, 12, 0, Math.PI * 2);
      }
      ctx.fill();

      // Innocent big anime sparkle eyes
      ctx.fillStyle = '#1E162B';
      ctx.fillRect(31, 20, 5, 6);
      ctx.fillRect(45, 20, 5, 6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(32, 21, 2, 2);
      ctx.fillRect(34, 24, 1, 1);
      ctx.fillRect(46, 21, 2, 2);
      ctx.fillRect(48, 24, 1, 1);

      // Gummy muzzle & heart button nose
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(40, 29, 8, 5, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(40, 29, 6, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = '#9F1239';
      ctx.fillRect(38, 27, 4, 3);

      // Cheerful rosy cheeks
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(26, 28, 4, 0, Math.PI * 2);
      ctx.arc(54, 28, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Cute Mini Gummy Cub (26x30, anchor: 13, 24)
    this.registerExpansionSprite('cute_gummy_cub', 26, 30, 13, 24, (ctx) => {
      ctx.fillStyle = '#4ADE80'; // Emerald pastel lime
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(13, 16, 8, 9, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(13, 16, 8, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(13, 9, 7, 6, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(13, 9, 6, 0, Math.PI * 2);
      }
      ctx.fill();

      // Ears
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(7, 4, 3, 0, Math.PI * 2);
      ctx.arc(19, 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Feet
      ctx.beginPath();
      ctx.arc(9, 23, 3, 0, Math.PI * 2);
      ctx.arc(17, 23, 3, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(10, 7, 2, 2);

      // Eyes
      ctx.fillStyle = '#1E162B';
      ctx.fillRect(10, 8, 2, 2);
      ctx.fillRect(15, 8, 2, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(10, 8, 1, 1);
      ctx.fillRect(15, 8, 1, 1);

      // Pink blush
      ctx.fillStyle = '#F472B6';
      ctx.fillRect(8, 11, 2, 1);
      ctx.fillRect(17, 11, 2, 1);
    });
  }
}
