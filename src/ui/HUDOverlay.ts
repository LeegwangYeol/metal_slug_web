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
import {
  RenderFeverState,
  RenderPerkCardState,
  RenderAltarState,
} from '../core/cute/CuteGameTypes';

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
  // Novel Cute Blossom Arena state
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
  '♥': ['01010', '11111', '11111', '01110', '00100'],
  '+': ['000', '010', '111', '010', '000'],
  '(': ['011', '100', '100', '100', '011'],
  ')': ['110', '001', '001', '001', '110'],
  '•': ['0', '0', '1', '0', '0'],
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

    // 6.5. Rainbow Sugar Rush (Sweet Fever) Meter
    if (state.cuteFever) {
      this.renderFeverMeter(ctx, state.cuteFever, time);
    }

    // 6.6. Cute Blossom Altars Status Tracker
    if (state.cuteAltars && state.cuteAltars.length > 0) {
      this.renderAltarTrackers(ctx, state.cuteAltars, time);
    }

    // 7. Boss Warning Banner & Health Bar
    this.renderBossHUD(ctx, state, time);

    // 8. On-Screen Tutorial Placard
    if (state.showTutorial) {
      this.renderTutorialPlacard(ctx, state.tutorialAlpha ?? 1.0);
    }

    // 8.5. Cute Banner Announce (e.g. "★ MIRACLE BLOOM! ★")
    if (state.bannerText) {
      this.renderCuteBanner(ctx, state.bannerText, time);
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

    // 13. 3-Card Rogue-Lite Perk Selection Modal
    if (state.cutePerks?.active && state.cutePerks.cards.length > 0) {
      this.renderPerkSelectionModal(ctx, state.cutePerks.cards, state.cutePerks.selectedIndex ?? 0, time);
    }
  }

  // =========================================================================
  // SUB-RENDERERS
  // =========================================================================

  private renderScore(ctx: CanvasContext2DLike, score: number, time: number): void {
    // Flashing "1UP" header text with cute pastel star glint
    const flash = Math.floor(time * 4) % 2 === 0;
    const oneUpColor = flash ? '#FF6584' : '#FFF5EA';
    this.drawPixelText(ctx, '1UP', 16, 6, oneUpColor, 1.5, '#4A1525');

    // Star glint sparkle next to 1UP
    const glint = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = glint ? '#FFE66D' : '#FFFFFF';
    ctx.fillRect(40, 7, 2, 2);

    // 6-digit golden honey score ("000000")
    this.drawDigits(ctx, score, 48, 6, 6);
  }

  private renderMetallicFrame(ctx: CanvasContext2DLike, width: number): void {
    // Frosted glass pastel ribbon header
    ctx.fillStyle = 'rgba(255, 240, 245, 0.88)';
    ctx.fillRect(0, 0, width, 24);

    // Top strawberry glaze border
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(0, 0, width, 1);

    // Bottom golden sugar piping line
    ctx.fillStyle = '#F4D06F';
    ctx.fillRect(0, 23, width, 1);

    // Scalloped pastel candy pearls along bottom edge
    const pearlColors = ['#FFB7B2', '#B5EAD7', '#E2F0CB', '#FFDAC1'];
    for (let px = 8; px < width - 8; px += 16) {
      const colorIndex = Math.floor(px / 16) % pearlColors.length;
      ctx.fillStyle = pearlColors[colorIndex];
      ctx.fillRect(px, 22, 3, 2);
    }

    // Corner sweet candy gems
    ctx.fillStyle = '#FF6584';
    ctx.fillRect(6, 4, 3, 3);
    ctx.fillStyle = '#70D6FF';
    ctx.fillRect(width - 9, 4, 3, 3);
  }

  private renderLives(ctx: CanvasContext2DLike, lives: number, time: number = 0): void {
    // Mini Chibi Hero Portrait with animated blinking anime eye & fluttering headband ribbon
    const blink = Math.floor(time * 3) % 8 === 0;
    const flutter = Math.floor(time * 8) % 2 === 0 ? 1 : 0;

    // Chibi blonde fluffy hair
    ctx.fillStyle = PALETTES.PLAYER[2];
    ctx.fillRect(116, 4, 8, 4);
    // Sweet strawberry headband with fluttering ribbon tail
    ctx.fillStyle = PALETTES.PLAYER[6];
    ctx.fillRect(115, 8, 10, 2);
    ctx.fillRect(113, 8 + flutter, 2, 2); // Fluttering headband ribbon tail
    // Soft peach face
    ctx.fillStyle = PALETTES.PLAYER[1];
    ctx.fillRect(116, 10, 8, 5);
    // Cute anime catchlight eye / blinking
    ctx.fillStyle = '#2B1E3A';
    if (!blink) {
      ctx.fillRect(119, 11, 2, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(119, 11, 1, 1); // Anime eye sparkle catchlight
    } else {
      ctx.fillRect(119, 13, 2, 1); // Happy closed eye blink
    }
    // Rosy cute blush
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(117, 13, 2, 1);
    // Mint vest
    ctx.fillStyle = PALETTES.PLAYER[8];
    ctx.fillRect(115, 15, 10, 4);

    // Heart icon token
    ctx.fillStyle = '#FF4D6D';
    ctx.fillRect(128, 9, 1, 3);
    ctx.fillRect(129, 8, 2, 4);
    ctx.fillRect(131, 9, 1, 2);
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(129, 9, 1, 1);

    // "x" symbol
    this.drawPixelText(ctx, 'x', 135, 9, '#FFA010', 1.0, '#4A1525');

    // Lives count (e.g. "3")
    this.drawDigits(ctx, Math.max(0, lives), 144, 6, 1);
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

    // Peppermint swirl bonbon grenade icon
    this.spriteFactory.drawSprite(ctx, 'hud_icon_grenade', grenadeX, grenadeY);

    // Cute animated sparkling star fuse tip
    const sparkColors = ['#FFFFFF', '#FFE66D', '#FF6584'];
    const sparkColor = sparkColors[Math.floor(time * 16) % 3];
    ctx.fillStyle = sparkColor;
    ctx.fillRect(grenadeX + 11, grenadeY + 1, 2, 2);

    // "x" symbol
    this.drawPixelText(ctx, 'x', grenadeX + 18, grenadeY + 4, '#FFA010', 1.0, '#4A1525');

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

    // Sweet candy-bordered frame for ultimate button badge
    const isReady = stock > 0;
    const glow = isReady ? 0.7 + Math.sin(time * 6) * 0.3 : 0.2;

    ctx.fillStyle = isReady ? `rgba(255, 215, 0, ${glow})` : 'rgba(100, 80, 110, 0.6)';
    ctx.fillRect(ultX, ultY, 56, 15);

    ctx.fillStyle = isReady ? '#2A1835' : '#1A1425';
    ctx.fillRect(ultX + 1, ultY + 1, 54, 13);

    // Glowing star badge [U]
    const badgeColor = isReady ? '#FFE66D' : '#887799';
    this.drawPixelText(ctx, '[U]', ultX + 3, ultY + 3, badgeColor, 1.0, '#221122');

    // Stock count or EMPTY
    if (isReady) {
      this.drawPixelText(ctx, `x${stock}`, ultX + 26, ultY + 3, '#70D6FF', 1.0, '#112233');
    } else {
      this.drawPixelText(ctx, 'EMPTY', ultX + 22, ultY + 3, '#7A6B88', 0.9, '#110D18');
    }
  }

  private renderPowTally(ctx: CanvasContext2DLike, count: number): void {
    const powX = 330;
    const powY = 6;

    // Sweet rescued bunny icon
    this.spriteFactory.drawSprite(ctx, 'hud_icon_pow', powX, powY);

    // "POW x N" in honey gold with sweet shadow
    this.drawPixelText(ctx, 'POW', powX + 18, powY + 3, '#FFA010', 1.2, '#4A1525');
    this.drawPixelText(ctx, 'x', powX + 44, powY + 4, '#FFA010', 1.0, '#4A1525');
    this.drawDigits(ctx, Math.max(0, count), powX + 52, powY + 2, 2);
  }

  private renderBossHUD(ctx: CanvasContext2DLike, state: HUDOverlayState, time: number): void {
    const isWarning =
      state.showBossWarning ||
      (state.bossWarningTimer !== undefined && state.bossWarningTimer > 0);

    // 1. Cheerful Boss Warning Banner
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
      const bossTitle = state.bossName ?? 'STAGE 1 BOSS: GRAND SUGAR CITADEL';
      this.drawPixelText(ctx, bossTitle, barX + 2, barY - 9, '#FF6584', 1.1, '#331122');

      // Waffle outer frame
      this.spriteFactory.drawSprite(ctx, 'hud_boss_bar_frame', barX, barY);

      // Gauge Ratio
      const ratio = Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth));
      const fillW = Math.round(180 * ratio);

      if (fillW > 0) {
        // Warning flashing when HP < 25%
        const isCritical = ratio < 0.25;
        const flash = isCritical && Math.floor(time * 8) % 2 === 0;

        ctx.fillStyle = flash ? '#FFFFFF' : '#FF4D6D'; // Strawberry pink / white flash
        ctx.fillRect(barX + 2, barY + 2, fillW, 8);

        // Top glossy strawberry highlight
        ctx.fillStyle = flash ? '#FFF9D2' : '#FFA0B8';
        ctx.fillRect(barX + 2, barY + 2, fillW, 2);

        // Vanilla sugar tick dividers every 18px (10 segments)
        ctx.fillStyle = '#FFE6EA';
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

    // Pulsing sweet strawberry background flash spanning full dynamic width
    const pulse = 0.65 + Math.sin(time * 10) * 0.35;
    ctx.fillStyle = `rgba(255, 75, 110, ${pulse * 0.88})`;
    ctx.fillRect(0, bannerY, width, bannerH);

    // Candy Cane Hazard Stripes (Top and bottom caution tape) across full width
    const stripeOffset = Math.floor(time * 40) % 20;
    this.drawHazardStripes(ctx, 0, bannerY - 6, width, 6, stripeOffset);
    this.drawHazardStripes(ctx, 0, bannerY + bannerH, width, 6, stripeOffset);

    // Flashing Arcade Warning Text (Centered)
    const textFlash = Math.floor(time * 6) % 2 === 0;
    const textColor = textFlash ? '#FFE66D' : '#FFFFFF';

    const line1 = '★ A CUTE SUGAR BOSS APPROACHES! ★';
    const w1 = this.measurePixelText(line1, 2.0);
    this.drawPixelText(
      ctx,
      line1,
      Math.max(10, Math.round((width - w1) / 2)),
      bannerY + 10,
      textColor,
      2.0,
      '#4A0E17'
    );

    const line2 = '*** GRAND SUGAR CITADEL ENCOUNTER ***';
    const w2 = this.measurePixelText(line2, 1.2);
    this.drawPixelText(
      ctx,
      line2,
      Math.max(10, Math.round((width - w2) / 2)),
      bannerY + 32,
      '#FFE66D',
      1.2,
      '#4A0E17'
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
    // Red strawberry base
    ctx.fillStyle = '#FF4D6D';
    ctx.fillRect(x, y, w, h);
    // Vanilla white candy cane diagonal stripes
    ctx.fillStyle = '#FFFFFF';

    const stripeWidth = 10;
    for (let px = -stripeWidth * 2; px < w + stripeWidth * 2; px += stripeWidth * 2) {
      ctx.fillRect(x + px + offset, y, stripeWidth, h);
    }
  }

  private renderPauseBanner(ctx: CanvasContext2DLike, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;

    ctx.fillStyle = 'rgba(25, 18, 35, 0.70)';
    ctx.fillRect(0, 0, width, height);

    const flash = Math.floor(time * 3) % 2 === 0;
    if (flash) {
      const text = '★ PAUSED ★';
      const textW = this.measurePixelText(text, 3.0);
      this.drawPixelText(
        ctx,
        text,
        Math.round((width - textW) / 2),
        Math.round(height * 0.45),
        '#FFE66D',
        3.0,
        '#331825'
      );
    }
  }

  private renderStageClearBanner(ctx: CanvasContext2DLike, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;
    const bannerY = Math.round(height * 0.32);
    const bannerH = 90;

    ctx.fillStyle = 'rgba(20, 45, 35, 0.85)';
    ctx.fillRect(0, bannerY, width, bannerH);

    ctx.fillStyle = '#F4D06F';
    ctx.fillRect(0, bannerY, width, 2);
    ctx.fillRect(0, bannerY + bannerH - 2, width, 2);

    const flash = Math.floor(time * 5) % 2 === 0;
    const color = flash ? '#FFE66D' : '#70D6FF';

    const line1 = '★ MISSION COMPLETE! ★';
    const w1 = this.measurePixelText(line1, 2.5);
    this.drawPixelText(
      ctx,
      line1,
      Math.round((width - w1) / 2),
      bannerY + 16,
      color,
      2.5,
      '#1A3028'
    );

    const line2 = 'STAGE 1 CLEARED - SO SWEET & CHARMING!';
    const w2 = this.measurePixelText(line2, 1.4);
    this.drawPixelText(
      ctx,
      line2,
      Math.round((width - w2) / 2),
      bannerY + 54,
      '#FFF5EA',
      1.4,
      '#1A3028'
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

    // Semi-transparent frosted grape jelly placard background
    ctx.fillStyle = 'rgba(30, 22, 45, 0.92)';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Beveled golden sugar piping border
    ctx.strokeStyle = '#F4D06F'; // Golden honey
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle = '#FF85A2'; // Inner pastel pink piping
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 3, cardY + 3, cardW - 6, cardH - 6);

    // Corner candy pearls
    ctx.fillStyle = '#70D6FF';
    ctx.fillRect(cardX + 5, cardY + 5, 3, 3);
    ctx.fillStyle = '#FFB7B2';
    ctx.fillRect(cardX + cardW - 8, cardY + 5, 3, 3);
    ctx.fillStyle = '#B5EAD7';
    ctx.fillRect(cardX + 5, cardY + cardH - 8, 3, 3);
    ctx.fillStyle = '#FFE66D';
    ctx.fillRect(cardX + cardW - 8, cardY + cardH - 8, 3, 3);

    // Header Title
    const title = '★ SWEET CONTROLS & TACTICS ★';
    const titleW = this.measurePixelText(title, 1.4);
    this.drawPixelText(ctx, title, cardX + Math.round((cardW - titleW) / 2), cardY + 10, '#FFE66D', 1.4, '#301824');

    // Divider
    ctx.fillStyle = '#F4D06F';
    ctx.fillRect(cardX + 16, cardY + 28, cardW - 32, 1);

    // Keybindings grid
    const controls = [
      { action: 'MOVE / AIM', keys: 'WASD / ARROWS' },
      { action: 'FIRE / CANDY', keys: 'J / Z' },
      { action: 'JUMP', keys: 'K / X / SPACE' },
      { action: 'BONBON', keys: 'L / C' },
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
      this.drawPixelText(ctx, c.action + ':', xCol, yRow, '#FFA010', 1.0, '#301824');
      this.drawPixelText(ctx, c.keys, xCol + 96, yRow, '#FFF5EA', 1.0, '#301824');
    }

    // Bottom banner tip
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(cardX + 16, cardY + cardH - 32, cardW - 32, 1);

    const tip = 'Press [H] to toggle tutorial • Auto-dismiss in 5s';
    const tipW = this.measurePixelText(tip, 0.9);
    this.drawPixelText(ctx, tip, cardX + Math.round((cardW - tipW) / 2), cardY + cardH - 22, '#D0C0E0', 0.9, '#301824');

    ctx.restore();
  }

  private renderContinueCountdown(ctx: CanvasContext2DLike, countdown: number, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;

    // Dark bedtime backdrop overlay
    ctx.fillStyle = 'rgba(25, 18, 38, 0.85)';
    ctx.fillRect(0, 0, width, height);

    // Center continue panel
    const boxW = 460;
    const boxH = 260;
    const boxX = Math.round((width - boxW) / 2);
    const boxY = Math.round((height - boxH) / 2);

    // Soft grape confectionery frame
    ctx.fillStyle = 'rgba(42, 28, 56, 0.94)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#F4D06F'; // Golden honey piping
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#FF85A2'; // Inner strawberry ribbon
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8);

    // Prominent "CONTINUE" text with pixel-art countdown
    const title = '★ CONTINUE? ★';
    const titleW = this.measurePixelText(title, 3.0);
    this.drawPixelText(ctx, title, boxX + Math.round((boxW - titleW) / 2), boxY + 18, '#FFE66D', 3.0, '#3A1424');

    // Giant Countdown Digit (9 down to 0)
    const digitVal = Math.max(0, Math.ceil(countdown));
    const digitChar = digitVal.toString();
    const digitScale = 5.0;
    const digitW = this.measurePixelText(digitChar, digitScale);
    const digitX = boxX + Math.round((boxW - digitW) / 2);
    const digitY = boxY + 68;

    // Pulsing color: warm honey gold, flashing strawberry pink on <= 3
    const isUrgent = digitVal <= 3;
    const flash = isUrgent && Math.floor(time * 8) % 2 === 0;
    const digitColor = flash ? '#FFFFFF' : isUrgent ? '#FF4D6D' : '#FFAA00';
    this.drawPixelText(ctx, digitChar, digitX, digitY, digitColor, digitScale, '#3A1424');

    // Sleepy chibi hero under marshmallow cloud blanket with floating 'zZz' and dream stars
    const heroBedX = boxX + 50;
    const heroBedY = boxY + 95;

    // Marshmallow cloud blanket
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(heroBedX + 10, heroBedY + 16, 50, 24);
    ctx.fillStyle = '#FCE4EC';
    ctx.fillRect(heroBedX + 8, heroBedY + 20, 54, 18);
    // Strawberry trim on blanket
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(heroBedX + 10, heroBedY + 16, 50, 3);

    // Chibi hero resting head on pillow
    // Pillow
    ctx.fillStyle = '#E2F0CB';
    ctx.fillRect(heroBedX - 4, heroBedY + 6, 20, 20);
    // Caramel hair
    ctx.fillStyle = PALETTES.PLAYER[2];
    ctx.fillRect(heroBedX, heroBedY, 16, 8);
    // Pink headband
    ctx.fillStyle = PALETTES.PLAYER[6];
    ctx.fillRect(heroBedX - 2, heroBedY + 6, 18, 4);
    // Face
    ctx.fillStyle = PALETTES.PLAYER[1];
    ctx.fillRect(heroBedX, heroBedY + 10, 16, 10);
    // Sleeping happy eyes: curved '^' lines
    ctx.fillStyle = '#3A1424';
    ctx.fillRect(heroBedX + 4, heroBedY + 13, 3, 1);
    ctx.fillRect(heroBedX + 3, heroBedY + 14, 1, 1);
    ctx.fillRect(heroBedX + 7, heroBedY + 14, 1, 1);
    // Rosy sleeping cheek blush
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(heroBedX + 2, heroBedY + 16, 4, 2);

    // Floating z Z Z drifting up into dreamland
    const zFloat = (time * 12) % 24;
    this.drawPixelText(ctx, 'z', heroBedX + 24, heroBedY - 2 - zFloat, '#B5EAD7', 0.9, '#301824');
    this.drawPixelText(ctx, 'Z', heroBedX + 32, heroBedY - 12 - zFloat, '#FFE66D', 1.1, '#301824');
    this.drawPixelText(ctx, 'Z', heroBedX + 42, heroBedY - 24 - zFloat, '#FFB7B2', 1.4, '#301824');

    // Floating dream stars bobbing overhead
    const starAngle = time * 3;
    const star1X = heroBedX + 15 + Math.cos(starAngle) * 20;
    const star1Y = heroBedY - 10 + Math.sin(starAngle) * 8;
    const star2X = heroBedX + 15 + Math.cos(starAngle + Math.PI) * 20;
    const star2Y = heroBedY - 10 + Math.sin(starAngle + Math.PI) * 8;
    ctx.fillStyle = '#FFE66D';
    ctx.fillRect(star1X, star1Y, 3, 3);
    ctx.fillStyle = '#70D6FF';
    ctx.fillRect(star2X, star2Y, 3, 3);

    // Flashing Press Fire / Jump prompt
    const promptFlash = Math.floor(time * 4) % 2 === 0;
    const promptColor = promptFlash ? '#FFFFFF' : '#FFE66D';
    const prompt = 'PRESS FIRE [J/Z] OR JUMP [K/X] TO CONTINUE';
    const promptW = this.measurePixelText(prompt, 1.2);
    this.drawPixelText(ctx, prompt, boxX + Math.round((boxW - promptW) / 2), boxY + 185, promptColor, 1.2, '#3A1424');

    // Subtitle note
    const sub = '3 HEARTS RESTORED • PARACHUTE INTO SWEET PARADISE';
    const subW = this.measurePixelText(sub, 0.9);
    this.drawPixelText(ctx, sub, boxX + Math.round((boxW - subW) / 2), boxY + 225, '#C8B6D6', 0.9, '#3A1424');
  }

  private renderGameOverBanner(ctx: CanvasContext2DLike, _time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;
    const bannerY = Math.round(height * 0.30);
    const bannerH = 110;

    ctx.fillStyle = 'rgba(35, 20, 45, 0.88)';
    ctx.fillRect(0, bannerY, width, bannerH);

    ctx.fillStyle = '#F4D06F';
    ctx.fillRect(0, bannerY, width, 2);
    ctx.fillRect(0, bannerY + bannerH - 2, width, 2);

    const text = 'GAME OVER - SWEET DREAMS!';
    const textW = this.measurePixelText(text, 2.6);
    this.drawPixelText(
      ctx,
      text,
      Math.round((width - textW) / 2),
      bannerY + 24,
      '#FF6584',
      2.6,
      '#2A101C'
    );

    const prompt = 'PRESS [FIRE] OR [JUMP] TO PLAY AGAIN!';
    const promptW = this.measurePixelText(prompt, 1.2);
    this.drawPixelText(
      ctx,
      prompt,
      Math.round((width - promptW) / 2),
      bannerY + 75,
      '#FFE66D',
      1.2,
      '#2A101C'
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

  // =========================================================================
  // NOVEL CUTE HUD SUB-RENDERERS (M2)
  // =========================================================================

  private renderFeverMeter(ctx: CanvasContext2DLike, fever: RenderFeverState, time: number): void {
    const barX = 420;
    const barY = 6;
    const barW = 140;
    const barH = 12;

    ctx.save();
    // Frosted track
    ctx.fillStyle = 'rgba(30, 22, 43, 0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#F4D06F';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Fill progress
    const progress = Math.min(1.0, Math.max(0.0, fever.meterProgress));
    const fillW = Math.max(0, Math.floor(barW * progress));

    if (fever.isActive) {
      // Flashing rainbow sugar rush cycling
      const rainbowColors = ['#FF85A2', '#FDE047', '#A7F3D0', '#67E8F9', '#C084FC'];
      const cycleIdx = Math.floor(time * 10) % rainbowColors.length;
      ctx.fillStyle = rainbowColors[cycleIdx];
      if (fillW > 2) {
        ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);
      }

      // Flashing text
      this.drawPixelText(ctx, 'SUGAR RUSH!', barX + 24, barY + 3, '#FFFFFF', 1, '#4A1525');
    } else {
      ctx.fillStyle = progress > 0.8 ? '#FF85A2' : '#FDE047';
      if (fillW > 2) {
        ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);
      }

      // Label
      this.drawPixelText(ctx, 'FEVER', barX + 50, barY + 3, '#FFFFFF', 1, '#4A1525');
    }
    ctx.restore();
  }

  private renderAltarTrackers(ctx: CanvasContext2DLike, altars: RenderAltarState[], _time: number): void {
    const startX = 580;
    const y = 6;

    ctx.save();
    for (let i = 0; i < altars.length; i++) {
      const altar = altars[i];
      const ax = startX + i * 22;

      // Flower petal circle
      ctx.fillStyle = altar.isBloomed ? '#FF85A2' : 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(ax + 6, y + 6, 6, 0, Math.PI * 2);
      ctx.fill();

      // Golden center
      ctx.fillStyle = altar.isBloomed ? '#FDE047' : '#94A3B8';
      ctx.beginPath();
      ctx.arc(ax + 6, y + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderCuteBanner(ctx: CanvasContext2DLike, bannerText: string, time: number): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const bannerY = 48;
    const bannerH = 24;

    ctx.save();
    const flash = Math.floor(time * 8) % 2 === 0;
    ctx.fillStyle = flash ? 'rgba(255, 133, 162, 0.92)' : 'rgba(253, 224, 71, 0.92)';
    ctx.fillRect(width / 2 - 200, bannerY, 400, bannerH);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(width / 2 - 200, bannerY, 400, bannerH);

    this.drawPixelText(ctx, bannerText, width / 2 - bannerText.length * 3.5, bannerY + 7, '#1E162B', 1.3);
    ctx.restore();
  }

  private renderPerkSelectionModal(
    ctx: CanvasContext2DLike,
    cards: RenderPerkCardState[],
    selectedIndex: number,
    time: number
  ): void {
    const width = (ctx as any).canvas?.width ?? 960;
    const height = (ctx as any).canvas?.height ?? 540;

    ctx.save();
    // 1. Dark frosted plum backdrop overlay
    ctx.fillStyle = 'rgba(30, 22, 43, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // 2. Modal Window Container
    const modalW = 680;
    const modalH = 340;
    const modalX = (width - modalW) / 2;
    const modalY = (height - modalH) / 2;

    // Pastel card background
    ctx.fillStyle = 'rgba(255, 245, 248, 0.98)';
    ctx.fillRect(modalX, modalY, modalW, modalH);

    // Golden sugar piping border
    ctx.strokeStyle = '#F4D06F';
    ctx.lineWidth = 4;
    ctx.strokeRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = '#FF85A2';
    ctx.lineWidth = 1;
    ctx.strokeRect(modalX + 3, modalY + 3, modalW - 6, modalH - 6);

    // Top Header Banner
    ctx.fillStyle = '#FF85A2';
    ctx.fillRect(modalX + 10, modalY + 10, modalW - 20, 36);

    this.drawPixelText(ctx, 'CHOOSE A SWEET PERK!', modalX + 180, modalY + 20, '#FFFFFF', 1.6, '#4A1525');

    // 3. Render 3 Perk Cards
    const cardW = 190;
    const cardH = 240;
    const cardY = modalY + 65;
    const startX = modalX + 35;
    const gap = 25;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cx = startX + i * (cardW + gap);
      const isSelected = i === selectedIndex;
      const cy = isSelected ? cardY - 4 : cardY;

      // Card Background
      ctx.fillStyle = isSelected ? '#FFFBEB' : '#FFFFFF';
      ctx.fillRect(cx, cy, cardW, cardH);

      // Card Border
      if (isSelected) {
        // Flashing golden star glow
        const glowColor = Math.floor(time * 8) % 2 === 0 ? '#F59E0B' : '#FDE047';
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx, cy, cardW, cardH);

        // Star indicator above selected card
        this.drawPixelText(ctx, 'PICK', cx + 75, cy - 14, '#FDE047', 1.2, '#1E162B');
      } else {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, cardW, cardH);
      }

      // Rarity Banner
      let rarityColor = '#B5EAD7';
      if (card.rarity === 'rare') rarityColor = '#FDE047';
      else if (card.rarity === 'legendary') rarityColor = '#E9D5FF';

      ctx.fillStyle = rarityColor;
      ctx.fillRect(cx + 8, cy + 8, cardW - 16, 18);
      this.drawPixelText(ctx, card.rarity.toUpperCase(), cx + 55, cy + 13, '#1E162B', 1);

      // Icon circle
      ctx.fillStyle = '#FFE4E6';
      ctx.beginPath();
      ctx.arc(cx + cardW / 2, cy + 65, 24, 0, Math.PI * 2);
      ctx.fill();

      // Card Title
      this.drawPixelText(ctx, card.title.toUpperCase(), cx + 16, cy + 105, '#1E162B', 1.1);

      // Key button tag at bottom: "[ 1 ]", "[ 2 ]", "[ 3 ]"
      const keyTag = `PRESS [ ${i + 1} ]`;
      ctx.fillStyle = isSelected ? '#FF85A2' : '#94A3B8';
      ctx.fillRect(cx + 25, cy + cardH - 32, cardW - 50, 22);
      this.drawPixelText(ctx, keyTag, cx + 45, cy + cardH - 26, '#FFFFFF', 1.1);
    }

    ctx.restore();
  }
}
