/**
 * HUDOverlay.ts - Authentic Retro Arcade Canvas HUD.
 *
 * Displays:
 * - Score: "1UP 000000"
 * - Lives: Soldier badge + "x3"
 * - Arms Weapon Badge: "H", "F", or "PISTOL"
 * - Ammo Counter: "200", "30", or "∞"
 * - Grenade Stock: Bomb icon + "x10"
 * - Hostage Rescue Tallies: POW icon + "POW x N"
 * - Stage 1 End-Boss Health Bar with flashing warning banners ("WARNING! Tetsuyuki Fortress Approaches!").
 * - Pause / Stage Clear / Game Over retro overlays.
 */

import { CanvasContext2DLike, ProceduralSpriteFactory } from '../render/sprites/ProceduralSpriteFactory';
import { PALETTES } from '../render/sprites/Palette';

export interface HUDOverlayState {
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

// 5-row compact pixel font table for arcade typography
const PIXEL_FONT: Record<string, string[]> = {
  A: ['0110', '1001', '1111', '1001', '1001'],
  B: ['1110', '1001', '1110', '1001', '1110'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  D: ['1110', '1001', '1001', '1001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['0111', '1000', '1011', '1001', '0110'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  I: ['111', '010', '010', '010', '111'],
  J: ['0011', '0001', '0001', '1001', '0110'],
  K: ['1001', '1010', '1100', '1010', '1001'],
  L: ['1000', '1000', '1000', '1000', '1111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  P: ['1110', '1001', '1110', '1000', '1000'],
  Q: ['0110', '1001', '1001', '1011', '0111'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['1001', '1001', '1001', '1001', '0110'],
  V: ['10001', '10001', '01010', '01010', '00100'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  X: ['1001', '0110', '0010', '0110', '1001'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
  Z: ['1111', '0010', '0100', '1000', '1111'],
  '0': ['0110', '1001', '1001', '1001', '0110'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['1110', '0001', '0110', '1000', '1111'],
  '3': ['1110', '0001', '0110', '0001', '1110'],
  '4': ['1001', '1001', '1111', '0001', '0001'],
  '5': ['1111', '1000', '1110', '0001', '1110'],
  '6': ['0110', '1000', '1110', '1001', '0110'],
  '7': ['1111', '0001', '0010', '0100', '0100'],
  '8': ['0110', '1001', '0110', '1001', '0110'],
  '9': ['0110', '1001', '0111', '0001', '0110'],
  '!': ['1', '1', '1', '0', '1'],
  '?': ['1110', '0001', '0110', '0000', '0100'],
  ':': ['0', '1', '0', '1', '0'],
  '.': ['0', '0', '0', '0', '1'],
  ',': ['0', '0', '0', '1', '1'],
  '-': ['000', '000', '111', '000', '000'],
  x: ['101', '010', '101', '000', '000'],
  ' ': ['00'],
};

export class HUDOverlay {
  private spriteFactory: ProceduralSpriteFactory;

  constructor(spriteFactory?: ProceduralSpriteFactory) {
    this.spriteFactory = spriteFactory ?? ProceduralSpriteFactory.getInstance();
  }

  /**
   * Main render method for the Retro Arcade HUD Overlay.
   */
  public render(ctx: CanvasContext2DLike, state: HUDOverlayState, time: number = 0): void {
    // 1. Top HUD Bar: Score ("1UP 000000")
    this.renderScore(ctx, state.score, time);

    // 2. Lives: Marco Soldier Head + "x3"
    this.renderLives(ctx, state.lives);

    // 3. Arms Weapon Badge & Ammo: ("H", "F", or "PISTOL") + ("200", "30", or "∞")
    this.renderWeaponAndAmmo(ctx, state.weaponType, state.ammo);

    // 4. Grenade Stock ("x10")
    this.renderGrenades(ctx, state.grenades);

    // 5. Hostage Rescue Tallies ("POW x N")
    this.renderPowTally(ctx, state.hostagesRescued);

    // 6. Boss Warning Banner & Health Bar
    this.renderBossHUD(ctx, state, time);

    // 7. Paused Banner
    if (state.isPaused) {
      this.renderPauseBanner(ctx, time);
    }

    // 8. Stage Clear Banner
    if (state.isStageClear) {
      this.renderStageClearBanner(ctx, time);
    }

    // 9. Game Over Banner
    if (state.isGameOver) {
      this.renderGameOverBanner(ctx, time);
    }
  }

  // =========================================================================
  // SUB-RENDERERS
  // =========================================================================

  private renderScore(ctx: CanvasContext2DLike, score: number, time: number): void {
    // Flashing "1UP" header text
    const flash = Math.floor(time * 4) % 2 === 0;
    const oneUpColor = flash ? '#FF2222' : '#FFFFFF';
    this.drawPixelText(ctx, '1UP', 16, 6, oneUpColor, 1.5, '#000000');

    // 6-digit golden score ("000000")
    this.drawDigits(ctx, score, 48, 6, 6);
  }

  private renderLives(ctx: CanvasContext2DLike, lives: number): void {
    // Mini Marco Soldier Icon
    ctx.fillStyle = PALETTES.PLAYER[2]; // Marco blonde hair
    ctx.fillRect(116, 6, 6, 3);
    ctx.fillStyle = PALETTES.PLAYER[6]; // Marco red headband
    ctx.fillRect(115, 8, 8, 2);
    ctx.fillStyle = PALETTES.PLAYER[1]; // Face
    ctx.fillRect(116, 10, 6, 4);
    ctx.fillStyle = PALETTES.PLAYER[8]; // Red vest
    ctx.fillRect(115, 14, 8, 4);

    // "x" symbol
    this.drawPixelText(ctx, 'x', 126, 9, '#FFA010', 1.0, '#000000');

    // Lives count (e.g. "3")
    this.drawDigits(ctx, Math.max(0, lives), 134, 6, 1);
  }

  private renderWeaponAndAmmo(
    ctx: CanvasContext2DLike,
    weaponType: 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT',
    ammo: number
  ): void {
    const badgeX = 180;
    const badgeY = 5;

    let badgeKey = 'hud_badge_pistol';
    if (weaponType === 'HEAVY_MACHINE_GUN') {
      badgeKey = 'hud_badge_hmg';
    } else if (weaponType === 'FLAME_SHOT') {
      badgeKey = 'hud_badge_flame';
    }

    // Draw authentic weapon badge ("H", "F", or "PISTOL")
    this.spriteFactory.drawSprite(ctx, badgeKey, badgeX, badgeY);

    // Ammo Counter ("200", "30", or "∞")
    const ammoX = badgeX + 30;
    const ammoY = badgeY + 4;

    if (weaponType === 'PISTOL' || !isFinite(ammo) || ammo <= 0) {
      this.spriteFactory.drawSprite(ctx, 'hud_symbol_infinity', ammoX, ammoY + 1);
    } else {
      this.drawDigits(ctx, ammo, ammoX, ammoY, 3);
    }

  }

  private renderGrenades(ctx: CanvasContext2DLike, grenades: number): void {
    const grenadeX = 265;
    const grenadeY = 6;

    // Bomb icon
    this.spriteFactory.drawSprite(ctx, 'hud_icon_grenade', grenadeX, grenadeY);

    // "x" symbol
    this.drawPixelText(ctx, 'x', grenadeX + 18, grenadeY + 4, '#FFA010', 1.0, '#000000');

    // Count (e.g. "10")
    this.drawDigits(ctx, Math.max(0, grenades), grenadeX + 26, grenadeY + 2, 2);
  }

  private renderPowTally(ctx: CanvasContext2DLike, count: number): void {
    const powX = 330;
    const powY = 6;

    // POW icon
    this.spriteFactory.drawSprite(ctx, 'hud_icon_pow', powX, powY);

    // "POW x N"
    this.drawPixelText(ctx, 'POW', powX + 18, powY + 3, '#FFA010', 1.2, '#000000');
    this.drawPixelText(ctx, 'x', powX + 44, powY + 4, '#FFA010', 1.0, '#000000');
    this.drawDigits(ctx, Math.max(0, count), powX + 52, powY + 2, 2);
  }

  private renderBossHUD(ctx: CanvasContext2DLike, state: HUDOverlayState, time: number): void {
    const isWarning =
      state.showBossWarning ||
      (state.bossWarningTimer !== undefined && state.bossWarningTimer > 0);

    // 1. Flashing Warning Banner ("WARNING! Tetsuyuki Fortress Approaches!")
    if (isWarning) {
      this.renderWarningBanner(ctx, time);
    }

    // 2. Boss Health Bar
    if (state.bossHealth !== undefined && state.bossMaxHealth !== undefined && state.bossMaxHealth > 0) {
      const barX = 148;
      const barY = 246;

      // Boss Name Label
      const bossTitle = state.bossName ?? 'STAGE 1 BOSS: TETSUYUKI';
      this.drawPixelText(ctx, bossTitle, barX + 2, barY - 9, '#FF3333', 1.1, '#000000');

      // Metallic Outer Frame
      this.spriteFactory.drawSprite(ctx, 'hud_boss_bar_frame', barX, barY);

      // Gauge Ratio
      const ratio = Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth));
      const fillW = Math.round(180 * ratio);

      if (fillW > 0) {
        // Warning flashing when HP < 25%
        const isCritical = ratio < 0.25;
        const flash = isCritical && Math.floor(time * 8) % 2 === 0;

        ctx.fillStyle = flash ? '#FFFFFF' : '#E74C3C'; // Red / white flash
        ctx.fillRect(barX + 2, barY + 2, fillW, 8);

        // Top metallic highlight
        ctx.fillStyle = flash ? '#FFF080' : '#FFA010';
        ctx.fillRect(barX + 2, barY + 2, fillW, 2);

        // Segment tick dividers every 18px (10 segments)
        ctx.fillStyle = '#000000';
        for (let seg = 18; seg < fillW; seg += 18) {
          ctx.fillRect(barX + 2 + seg, barY + 2, 1, 8);
        }
      }
    }
  }

  private renderWarningBanner(ctx: CanvasContext2DLike, time: number): void {
    const bannerY = 85;
    const bannerH = 44;
    const width = 480;

    // Pulsing background flash
    const pulse = 0.65 + Math.sin(time * 10) * 0.35;
    ctx.fillStyle = `rgba(180, 0, 0, ${pulse * 0.85})`;
    ctx.fillRect(0, bannerY, width, bannerH);

    // Hazard Stripes (Top and bottom caution tape)
    const stripeOffset = Math.floor(time * 40) % 20;
    this.drawHazardStripes(ctx, 0, bannerY - 6, width, 6, stripeOffset);
    this.drawHazardStripes(ctx, 0, bannerY + bannerH, width, 6, stripeOffset);

    // Flashing Arcade Warning Text
    const textFlash = Math.floor(time * 6) % 2 === 0;
    const textColor = textFlash ? '#FFFF00' : '#FFFFFF';

    this.drawPixelText(
      ctx,
      'WARNING! Tetsuyuki Fortress Approaches!',
      36,
      bannerY + 10,
      textColor,
      1.8,
      '#000000'
    );

    this.drawPixelText(
      ctx,
      '*** EMERGENCY LEVEL-1 ENCOUNTER ***',
      120,
      bannerY + 28,
      '#FFA010',
      1.0,
      '#000000'
    );
  }

  private drawHazardStripes(
    ctx: CanvasContext2DLike,
    x: number,
    y: number,
    w: number,
    h: number,
    offset: number
  ): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#F39C12'; // Yellow caution stripe

    const stripeWidth = 10;
    for (let px = -stripeWidth * 2; px < w + stripeWidth * 2; px += stripeWidth * 2) {
      ctx.fillRect(x + px + offset, y, stripeWidth, h);
    }
  }

  private renderPauseBanner(ctx: CanvasContext2DLike, time: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, 480, 270);

    const flash = Math.floor(time * 3) % 2 === 0;
    if (flash) {
      this.drawPixelText(ctx, 'PAUSED', 195, 125, '#FFA010', 2.5, '#000000');
    }
  }

  private renderStageClearBanner(ctx: CanvasContext2DLike, time: number): void {
    ctx.fillStyle = 'rgba(0, 20, 0, 0.7)';
    ctx.fillRect(0, 80, 480, 80);

    const flash = Math.floor(time * 5) % 2 === 0;
    const color = flash ? '#FFFF00' : '#2ECC71';

    this.drawPixelText(ctx, 'MISSION COMPLETE!', 135, 100, color, 2.2, '#000000');
    this.drawPixelText(ctx, 'STAGE 1 CLEARED - EXCELLENT SOLDIER', 110, 130, '#FFFFFF', 1.2, '#000000');
  }

  private renderGameOverBanner(ctx: CanvasContext2DLike, _time: number): void {
    ctx.fillStyle = 'rgba(40, 0, 0, 0.75)';
    ctx.fillRect(0, 80, 480, 80);

    this.drawPixelText(ctx, 'GAME OVER', 180, 105, '#E74C3C', 2.5, '#000000');
  }

  // =========================================================================
  // ARCADE BITMAP FONT & DIGIT UTILITIES
  // =========================================================================

  /**
   * Draws a sequence of gold digits using the registered hud_digit_ sprites.
   */
  public drawDigits(
    ctx: CanvasContext2DLike,
    value: number,
    startX: number,
    startY: number,
    padZeroes: number = 0
  ): void {
    let str = Math.floor(Math.max(0, value)).toString();
    if (padZeroes > str.length) {
      str = '0'.repeat(padZeroes - str.length) + str;
    }
    for (let i = 0; i < str.length; i++) {
      const d = str[i];
      this.spriteFactory.drawSprite(ctx, `hud_digit_${d}`, startX + i * 9, startY);
    }
  }

  /**
   * Draws crisp retro pixel letters on canvas with drop shadow.
   */
  public drawPixelText(
    ctx: CanvasContext2DLike,
    text: string,
    x: number,
    y: number,
    color: string = '#FFFFFF',
    scale: number = 1.0,
    shadowColor: string | null = '#000000'
  ): void {
    const s = Math.max(1, Math.round(scale));
    let cursorX = Math.round(x);
    const startY = Math.round(y);

    const upper = text.toUpperCase();

    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i];
      const bitmap = PIXEL_FONT[ch] ?? PIXEL_FONT[' '];
      const charWidth = bitmap[0].length;

      // Drop shadow pass
      if (shadowColor) {
        ctx.fillStyle = shadowColor;
        for (let r = 0; r < bitmap.length; r++) {
          const row = bitmap[r];
          for (let c = 0; c < row.length; c++) {
            if (row[c] === '1') {
              ctx.fillRect(cursorX + c * s + s, startY + r * s + s, s, s);
            }
          }
        }
      }

      // Foreground pass
      ctx.fillStyle = color;
      for (let r = 0; r < bitmap.length; r++) {
        const row = bitmap[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '1') {
            ctx.fillRect(cursorX + c * s, startY + r * s, s, s);
          }
        }
      }

      cursorX += (charWidth + 1) * s;
    }
  }
}
