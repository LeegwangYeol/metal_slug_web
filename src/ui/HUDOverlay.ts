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
import { WeaponType } from '../core/weapons/WeaponTypes';

export interface HUDOverlayState {
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
  '/': ['001', '010', '010', '100', '100'],
  '[': ['110', '100', '100', '100', '110'],
  ']': ['011', '001', '001', '001', '011'],
  '*': ['101', '010', '101', '000', '000'],
  '★': ['00100', '01110', '11111', '01110', '10001'],
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
    const width = (ctx as any).canvas?.width ?? 960;

    // 0. Beveled Metallic Arcade Top Header Framing
    this.renderMetallicFrame(ctx, width);

    // 1. Top HUD Bar: Score ("1UP 000000")
    this.renderScore(ctx, state.score, time);

    // 2. Lives: Cute Marco Soldier Head + "x3"
    this.renderLives(ctx, state.lives, time);

    // 3. Arms Weapon Badge & Ammo: ("H", "F", or "PISTOL") + ("200", "30", or "∞")
    this.renderWeaponAndAmmo(ctx, state.weaponType, state.ammo);

    // 4. Grenade Stock ("x10") with Sizzling Spark
    this.renderGrenades(ctx, state.grenades, time);

    // 5. Hostage Rescue Tallies ("POW x N")
    this.renderPowTally(ctx, state.hostagesRescued);

    // 6. Ultimate Move Stock Meter [U]
    this.renderUltimateStock(ctx, state.ultimateStock ?? 0, state.maxUltimateStock ?? 1, time);

    // 7. Boss Warning Banner & Health Bar
    this.renderBossHUD(ctx, state, time);

    // 8. On-Screen Tutorial Placard
    if (state.showTutorial) {
      this.renderTutorialPlacard(ctx, state.tutorialAlpha ?? 1.0);
    }

    // 9. Classic Arcade Continue Countdown (10s timer)
    if (state.isContinueActive || (state.continueCountdown !== undefined && state.continueCountdown > 0)) {
      this.renderContinueCountdown(ctx, state.continueCountdown ?? 0, time);
    } else if (state.isGameOver) {
      // 10. Final Game Over Banner
      this.renderGameOverBanner(ctx, time);
    }

    // 11. Paused Banner
    if (state.isPaused) {
      this.renderPauseBanner(ctx, time);
    }

    // 12. Stage Clear Banner
    if (state.isStageClear) {
      this.renderStageClearBanner(ctx, time);
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

  private renderMetallicFrame(ctx: CanvasContext2DLike, width: number): void {
    // Brushed metallic top arcade header
    ctx.fillStyle = 'rgba(14, 18, 26, 0.78)';
    ctx.fillRect(0, 0, width, 24);

    // Bottom bronze bezel line
    ctx.fillStyle = '#6B5B3E';
    ctx.fillRect(0, 24, width, 1);

    // Top gold specular highlight line
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(0, 0, width, 1);

    // Metallic Corner Rivets
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(6, 4, 2, 2);
    ctx.fillRect(width - 8, 4, 2, 2);
  }

  private renderLives(ctx: CanvasContext2DLike, lives: number, time: number = 0): void {
    // Mini Marco Soldier Icon with cute animated blinking eye & headband flutter
    const blink = Math.floor(time * 3) % 8 === 0;
    const flutter = Math.floor(time * 8) % 2 === 0 ? 1 : 0;

    // Marco blonde hair
    ctx.fillStyle = PALETTES.PLAYER[2];
    ctx.fillRect(116, 5, 7, 3);
    // Marco red headband with fluttering ribbon tail
    ctx.fillStyle = PALETTES.PLAYER[6];
    ctx.fillRect(115, 8, 9, 2);
    ctx.fillRect(113, 8 + flutter, 2, 2); // Fluttering headband tail
    // Face
    ctx.fillStyle = PALETTES.PLAYER[1];
    ctx.fillRect(116, 10, 7, 4);
    // Cute eye / blinking
    ctx.fillStyle = '#111122';
    if (!blink) {
      ctx.fillRect(119, 11, 2, 2);
    } else {
      ctx.fillRect(119, 12, 2, 1);
    }
    // Rosy cute blush
    ctx.fillStyle = '#FF9999';
    ctx.fillRect(117, 13, 1, 1);
    // Red vest
    ctx.fillStyle = PALETTES.PLAYER[8];
    ctx.fillRect(115, 14, 9, 4);

    // "x" symbol
    this.drawPixelText(ctx, 'x', 127, 9, '#FFA010', 1.0, '#000000');

    // Lives count (e.g. "3")
    this.drawDigits(ctx, Math.max(0, lives), 136, 6, 1);
  }

  private renderWeaponAndAmmo(
    ctx: CanvasContext2DLike,
    weaponType: WeaponType,
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

  private renderGrenades(ctx: CanvasContext2DLike, grenades: number, time: number = 0): void {
    const grenadeX = 265;
    const grenadeY = 6;

    // Bomb icon
    this.spriteFactory.drawSprite(ctx, 'hud_icon_grenade', grenadeX, grenadeY);

    // Cute animated sparkling fuse tip
    const sparkColor = (Math.floor(time * 16) % 3 === 0) ? '#FFFFFF' : (Math.floor(time * 16) % 3 === 1) ? '#FFFF00' : '#FF4400';
    ctx.fillStyle = sparkColor;
    ctx.fillRect(grenadeX + 11, grenadeY + 1, 2, 2);

    // "x" symbol
    this.drawPixelText(ctx, 'x', grenadeX + 18, grenadeY + 4, '#FFA010', 1.0, '#000000');

    // Count (e.g. "10")
    this.drawDigits(ctx, Math.max(0, grenades), grenadeX + 26, grenadeY + 2, 2);
  }

  private renderUltimateStock(
    ctx: CanvasContext2DLike,
    stock: number,
    _maxStock: number,
    time: number
  ): void {
    const ultX = 405;
    const ultY = 5;

    // Metallic frame for ultimate button badge
    const isReady = stock > 0;
    const glow = isReady ? 0.7 + Math.sin(time * 6) * 0.3 : 0.2;

    ctx.fillStyle = isReady ? `rgba(255, 170, 16, ${glow})` : 'rgba(80, 80, 80, 0.6)';
    ctx.fillRect(ultX, ultY, 56, 15);

    ctx.fillStyle = isReady ? '#111622' : '#222222';
    ctx.fillRect(ultX + 1, ultY + 1, 54, 13);

    // Winged Bomber icon or [U] badge
    const badgeColor = isReady ? '#FFD700' : '#777777';
    this.drawPixelText(ctx, '[U]', ultX + 3, ultY + 3, badgeColor, 1.0, '#000000');

    // Stock count or READY
    if (isReady) {
      this.drawPixelText(ctx, `x${stock}`, ultX + 26, ultY + 3, '#00FFFF', 1.0, '#000000');
    } else {
      this.drawPixelText(ctx, 'EMPTY', ultX + 22, ultY + 3, '#666666', 0.9, '#000000');
    }
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
      const width = (ctx as any).canvas?.width ?? 960;
      const height = (ctx as any).canvas?.height ?? 540;
      const barX = Math.round((width - 184) / 2);
      const barY = height - 28;

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
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;
    const bannerY = Math.round(height * 0.3);
    const bannerH = 50;

    // Pulsing background flash spanning full dynamic width
    const pulse = 0.65 + Math.sin(time * 10) * 0.35;
    ctx.fillStyle = `rgba(180, 0, 0, ${pulse * 0.85})`;
    ctx.fillRect(0, bannerY, width, bannerH);

    // Hazard Stripes (Top and bottom caution tape) across full width
    const stripeOffset = Math.floor(time * 40) % 20;
    this.drawHazardStripes(ctx, 0, bannerY - 6, width, 6, stripeOffset);
    this.drawHazardStripes(ctx, 0, bannerY + bannerH, width, 6, stripeOffset);

    // Flashing Arcade Warning Text (Centered)
    const textFlash = Math.floor(time * 6) % 2 === 0;
    const textColor = textFlash ? '#FFFF00' : '#FFFFFF';

    const line1 = 'WARNING! Tetsuyuki Fortress Approaches!';
    const w1 = this.measurePixelText(line1, 2.0);
    this.drawPixelText(
      ctx,
      line1,
      Math.max(10, Math.round((width - w1) / 2)),
      bannerY + 10,
      textColor,
      2.0,
      '#000000'
    );

    const line2 = '*** EMERGENCY LEVEL-1 ENCOUNTER ***';
    const w2 = this.measurePixelText(line2, 1.2);
    this.drawPixelText(
      ctx,
      line2,
      Math.max(10, Math.round((width - w2) / 2)),
      bannerY + 32,
      '#FFA010',
      1.2,
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
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, width, height);

    const flash = Math.floor(time * 3) % 2 === 0;
    if (flash) {
      const text = 'PAUSED';
      const textW = this.measurePixelText(text, 3.0);
      this.drawPixelText(
        ctx,
        text,
        Math.round((width - textW) / 2),
        Math.round(height * 0.45),
        '#FFA010',
        3.0,
        '#000000'
      );
    }
  }

  private renderStageClearBanner(ctx: CanvasContext2DLike, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;
    const bannerY = Math.round(height * 0.32);
    const bannerH = 90;

    ctx.fillStyle = 'rgba(0, 20, 0, 0.75)';
    ctx.fillRect(0, bannerY, width, bannerH);

    const flash = Math.floor(time * 5) % 2 === 0;
    const color = flash ? '#FFFF00' : '#2ECC71';

    const line1 = 'MISSION COMPLETE!';
    const w1 = this.measurePixelText(line1, 2.5);
    this.drawPixelText(
      ctx,
      line1,
      Math.round((width - w1) / 2),
      bannerY + 16,
      color,
      2.5,
      '#000000'
    );

    const line2 = 'STAGE 1 CLEARED - EXCELLENT SOLDIER';
    const w2 = this.measurePixelText(line2, 1.4);
    this.drawPixelText(
      ctx,
      line2,
      Math.round((width - w2) / 2),
      bannerY + 54,
      '#FFFFFF',
      1.4,
      '#000000'
    );
  }

  private renderTutorialPlacard(ctx: CanvasContext2DLike, alpha: number = 1.0): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const cardW = 460;
    const cardH = 175;
    const cardX = Math.round((width - cardW) / 2);
    const cardY = 36;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Semi-transparent deep navy arcade placard background
    ctx.fillStyle = 'rgba(12, 18, 30, 0.92)';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Beveled metallic bronze / gold border
    ctx.strokeStyle = '#D4AF37'; // Antique Gold
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle = '#6B5B3E'; // Inner bronze line
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 3, cardY + 3, cardW - 6, cardH - 6);

    // Metallic Corner Rivets
    ctx.fillStyle = '#FFA010';
    ctx.fillRect(cardX + 5, cardY + 5, 3, 3);
    ctx.fillRect(cardX + cardW - 8, cardY + 5, 3, 3);
    ctx.fillRect(cardX + 5, cardY + cardH - 8, 3, 3);
    ctx.fillRect(cardX + cardW - 8, cardY + cardH - 8, 3, 3);

    // Header Title
    const title = '★ MISSION CONTROLS & TACTICS ★';
    const titleW = this.measurePixelText(title, 1.4);
    this.drawPixelText(ctx, title, cardX + Math.round((cardW - titleW) / 2), cardY + 10, '#FFD700', 1.4, '#000000');

    // Divider
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(cardX + 16, cardY + 28, cardW - 32, 1);

    // Keybindings grid
    const controls = [
      { action: 'MOVE / AIM', keys: 'WASD / ARROWS' },
      { action: 'FIRE / MELEE', keys: 'J / Z' },
      { action: 'JUMP', keys: 'K / X / SPACE' },
      { action: 'GRENADE', keys: 'L / C' },
      { action: 'ULTIMATE', keys: 'U' },
      { action: 'HELP TOGGLE', keys: 'H' },
    ];

    const startY = cardY + 36;
    const rowH = 18;
    for (let i = 0; i < controls.length; i++) {
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const xCol = cardX + 24 + col * 215;
      const yRow = startY + row * rowH;

      const c = controls[i];
      this.drawPixelText(ctx, c.action + ':', xCol, yRow, '#FFA010', 1.0, '#000000');
      this.drawPixelText(ctx, c.keys, xCol + 96, yRow, '#FFFFFF', 1.0, '#000000');
    }

    // Bottom banner tip
    ctx.fillStyle = '#6B5B3E';
    ctx.fillRect(cardX + 16, cardY + cardH - 32, cardW - 32, 1);

    const tip = 'Press [H] to toggle tutorial • Auto-dismiss in 5s';
    const tipW = this.measurePixelText(tip, 0.9);
    this.drawPixelText(ctx, tip, cardX + Math.round((cardW - tipW) / 2), cardY + cardH - 22, '#A0B0C0', 0.9, '#000000');

    ctx.restore();
  }

  private renderContinueCountdown(ctx: CanvasContext2DLike, countdown: number, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;

    // Dark backdrop overlay
    ctx.fillStyle = 'rgba(8, 10, 20, 0.82)';
    ctx.fillRect(0, 0, width, height);

    // Center continue panel
    const boxW = 460;
    const boxH = 260;
    const boxX = Math.round((width - boxW) / 2);
    const boxY = Math.round((height - boxH) / 2);

    // Beveled frame
    ctx.fillStyle = 'rgba(20, 24, 36, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#D4AF37'; // Antique gold
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#FF3333'; // Inner red neon border
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8);

    // Prominent "CONTINUE" text with pixel-art countdown
    const title = 'CONTINUE';
    const titleW = this.measurePixelText(title, 3.2);
    this.drawPixelText(ctx, title, boxX + Math.round((boxW - titleW) / 2), boxY + 20, '#FFD700', 3.2, '#000000');

    // Giant Countdown Digit (9 down to 0)
    const digitVal = Math.max(0, Math.ceil(countdown));
    const digitChar = digitVal.toString();
    const digitScale = 5.0;
    const digitW = this.measurePixelText(digitChar, digitScale);
    const digitX = boxX + Math.round((boxW - digitW) / 2);
    const digitY = boxY + 70;

    // Pulsing color: golden yellow, flashing red on <= 3
    const isUrgent = digitVal <= 3;
    const flash = isUrgent && Math.floor(time * 8) % 2 === 0;
    const digitColor = flash ? '#FFFFFF' : isUrgent ? '#FF2222' : '#FFA010';
    this.drawPixelText(ctx, digitChar, digitX, digitY, digitColor, digitScale, '#000000');

    // Cute distressed chibi Marco with comic bandage & tear
    const marcoFaceX = boxX + 60;
    const marcoFaceY = boxY + 80;
    // Hair
    ctx.fillStyle = PALETTES.PLAYER[2];
    ctx.fillRect(marcoFaceX, marcoFaceY, 20, 10);
    // Headband
    ctx.fillStyle = PALETTES.PLAYER[6];
    ctx.fillRect(marcoFaceX - 2, marcoFaceY + 8, 24, 6);
    // Face
    ctx.fillStyle = PALETTES.PLAYER[1];
    ctx.fillRect(marcoFaceX, marcoFaceY + 14, 20, 16);
    // Dizzy spiraling eyes (x marks)
    ctx.fillStyle = '#111122';
    ctx.fillRect(marcoFaceX + 4, marcoFaceY + 18, 2, 2);
    ctx.fillRect(marcoFaceX + 14, marcoFaceY + 18, 2, 2);
    // Comic bandage on cheek
    ctx.fillStyle = '#F5E6CC';
    ctx.fillRect(marcoFaceX + 2, marcoFaceY + 23, 7, 5);
    ctx.fillStyle = '#D9534F';
    ctx.fillRect(marcoFaceX + 4, marcoFaceY + 24, 3, 3);
    // Tear drop
    ctx.fillStyle = '#5DADE2';
    ctx.fillRect(marcoFaceX + 16, marcoFaceY + 22, 2, 4);

    // Comic dizzy stars circling overhead
    const starAngle = time * 4;
    const star1X = marcoFaceX + 10 + Math.cos(starAngle) * 16;
    const star1Y = marcoFaceY - 6 + Math.sin(starAngle) * 6;
    const star2X = marcoFaceX + 10 + Math.cos(starAngle + Math.PI) * 16;
    const star2Y = marcoFaceY - 6 + Math.sin(starAngle + Math.PI) * 6;
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(star1X, star1Y, 3, 3);
    ctx.fillRect(star2X, star2Y, 3, 3);

    // Flashing Press Fire / Jump prompt
    const promptFlash = Math.floor(time * 4) % 2 === 0;
    const promptColor = promptFlash ? '#FFFFFF' : '#FFCC00';
    const prompt = 'PRESS FIRE [J/Z] OR JUMP [K/X] TO CONTINUE';
    const promptW = this.measurePixelText(prompt, 1.2);
    this.drawPixelText(ctx, prompt, boxX + Math.round((boxW - promptW) / 2), boxY + 185, promptColor, 1.2, '#000000');

    // Subtitle note
    const sub = '3 LIVES RESTORED • TACTICAL PARACHUTE RE-ENTRY';
    const subW = this.measurePixelText(sub, 0.9);
    this.drawPixelText(ctx, sub, boxX + Math.round((boxW - subW) / 2), boxY + 225, '#8899AA', 0.9, '#000000');
  }

  private renderGameOverBanner(ctx: CanvasContext2DLike, _time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;
    const bannerY = Math.round(height * 0.30);
    const bannerH = 110;

    ctx.fillStyle = 'rgba(30, 0, 0, 0.85)';
    ctx.fillRect(0, bannerY, width, bannerH);

    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(0, bannerY, width, 2);
    ctx.fillRect(0, bannerY + bannerH - 2, width, 2);

    const text = 'GAME OVER';
    const textW = this.measurePixelText(text, 3.2);
    this.drawPixelText(
      ctx,
      text,
      Math.round((width - textW) / 2),
      bannerY + 24,
      '#E74C3C',
      3.2,
      '#000000'
    );

    const prompt = 'PRESS [FIRE] OR [JUMP] TO RESTART MISSION';
    const promptW = this.measurePixelText(prompt, 1.2);
    this.drawPixelText(
      ctx,
      prompt,
      Math.round((width - promptW) / 2),
      bannerY + 75,
      '#FFA010',
      1.2,
      '#000000'
    );
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
   * Measures pixel width of string rendered by drawPixelText.
   */
  public measurePixelText(text: string, scale: number = 1.0): number {
    const s = Math.max(1, Math.round(scale));
    let width = 0;
    const upper = text.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      const ch = upper[i];
      const bitmap = PIXEL_FONT[ch] ?? PIXEL_FONT[' '];
      const charWidth = bitmap[0].length;
      width += (charWidth + 1) * s;
    }
    return width;
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
