/**
 * GothicHUD.ts - Imposing Dark Fantasy UI & Heads-Up Display.
 *
 * Requirements (PROJECT.md § Imposing Dark Fantasy UI & HUD):
 * 1. Vitality Bar / Orb with deep crimson blood filling, metallic sheen, and cracked iron / obsidian framing.
 * 2. Soul Level badge & luminous necrotic green / violet XP bar stretching across top with smooth fill animation.
 * 3. Elapsed Survival Timer (MM:SS) centered in gothic typography with wave phase indicators.
 * 4. Kill Counter with skull iconography and kill tally punch animation.
 * 5. Active Weapon & Passive Inventory Slots (6 weapons + 6 passives) displaying icons and rank pips (I to V).
 * 6. Low-health critical vignette pulsing when HP < 30%.
 * 7. Zero DOM overhead: 100% rendered directly on 2D canvas context at locked 60Hz.
 */

export const GOTHIC_HUD_THEME = {
  // Void & Obsidian Backgrounds
  abyssalVoid: '#08060c',
  charredBlack: '#0f0d1a',
  obsidianInset: '#171326',
  obsidianBorder: '#2d2b38',

  // Metallic Sheen & Cracked Iron Framing
  ironBase: '#1a1720',
  ironBevelLight: '#413e50',
  ironBevelDark: '#0c0a12',
  ironRivet: '#8a879d',
  specularSheen: 'rgba(255, 255, 255, 0.18)',
  crackedVein: '#2c1220',

  // Blood Crimson (Vitality)
  bloodDark: '#380a0a',
  bloodBase: '#6b1212',
  bloodMid: '#a81d1d',
  bloodBright: '#e53e3e',
  bloodGlow: 'rgba(229, 62, 62, 0.4)',
  ghostHealth: '#b33939',

  // Necrotic Emerald (XP & Soul Energy)
  necroticDark: '#0d3824',
  necroticMid: '#19633e',
  necroticBright: '#28a745',
  necroticGlow: '#68d391',
  necroticSpark: '#a7f3d0',

  // Cursed Arcane (Violet XP / Magic)
  arcaneDark: '#1a0c2e',
  arcaneMid: '#3c1b6b',
  arcaneBright: '#7038b8',
  arcaneGlow: '#b794f6',

  // Bone Ivory & Gold (Text & Badges)
  boneIvory: '#ede5de',
  boneMuted: '#b8aea5',
  boneDark: '#615852',
  goldFiligree: '#d4af37',
  goldGlow: 'rgba(212, 175, 55, 0.5)',

  // Fonts
  fontGothic: "bold 16px 'Cinzel', 'IM Fell English', 'Georgia', serif",
  fontTimer: "bold 22px 'Cinzel', 'IM Fell English', 'Georgia', serif",
  fontSmall: "bold 11px 'Georgia', serif",
  fontSubtitle: "italic 10px 'Georgia', serif",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

export interface InventorySlotData {
  id: string;
  name: string;
  icon: string; // 'scythe', 'orbiters', 'lightning', 'spear', 'aura', 'tome', 'ring', 'chalice', 'magnet', 'armor'
  rank: number; // 1 to 5
  maxRank?: number; // default 5
  isEvolution?: boolean;
}

export interface HUDStateSnapshot {
  player: {
    stats: {
      currentHealth: number;
      maxHealth: number;
      healthRegen?: number;
      armor?: number;
    };
    level: number;
    currentXP: number;
    xpToNextLevel: number;
    isAlive: boolean;
    invulnerabilityTimer?: number;
    weapons?: InventorySlotData[];
    passives?: InventorySlotData[];
  };
  hordeManager: {
    totalKilled: number;
    getActiveCount(): number;
  };
  elapsedTime: number; // in seconds
  killCount?: number;
  boss?: {
    name: string;
    currentHealth: number;
    maxHealth: number;
  };
}

export interface GothicHUDConfig {
  virtualWidth?: number;  // default 960
  virtualHeight?: number; // default 540
  xpColorMode?: 'necrotic-emerald' | 'cursed-violet';
  showInventorySlots?: boolean;
  showWavePhase?: boolean;
}

export class GothicHUD {
  public readonly config: Required<GothicHUDConfig>;

  // Animation & Interpolation States
  public displayXP: number = 0;
  public targetXP: number = 0;
  public xpToNextLevel: number = 10;
  public currentLevel: number = 1;
  public levelUpFlashTimer: number = 0;

  public displayHealth: number = 100;
  public ghostHealth: number = 100;
  public maxHealth: number = 100;
  public ghostDrainDelay: number = 0;

  public killDisplayCount: number = 0;
  public killScaleAnim: number = 1.0;

  public lowHPPulseTimer: number = 0;
  public shimmerTimer: number = 0;

  // Cached formatted strings
  public cachedTimerStr: string = '00:00';
  private lastFormattedSecond: number = -1;
  private isFirstUpdate: boolean = true;

  constructor(config: GothicHUDConfig = {}) {
    this.config = {
      virtualWidth: config.virtualWidth ?? 960,
      virtualHeight: config.virtualHeight ?? 540,
      xpColorMode: config.xpColorMode ?? 'necrotic-emerald',
      showInventorySlots: config.showInventorySlots ?? true,
      showWavePhase: config.showWavePhase ?? true,
    };
    this.reset();
  }

  public reset(): void {
    this.displayXP = 0;
    this.targetXP = 0;
    this.xpToNextLevel = 10;
    this.currentLevel = 1;
    this.levelUpFlashTimer = 0;

    this.displayHealth = 100;
    this.ghostHealth = 100;
    this.maxHealth = 100;
    this.ghostDrainDelay = 0;

    this.killDisplayCount = 0;
    this.killScaleAnim = 1.0;

    this.lowHPPulseTimer = 0;
    this.shimmerTimer = 0;
    this.lastFormattedSecond = -1;
    this.cachedTimerStr = '00:00';
    this.isFirstUpdate = true;
  }

  /**
   * Advances HUD animation states, interpolates smooth bar fills, and updates timers.
   */
  public update(dt: number, state: HUDStateSnapshot): void {
    this.shimmerTimer += dt;
    this.lowHPPulseTimer += dt * 4.0;

    // 1. Health & Ghost Health Drain Animation
    const targetHP = Math.max(0, state.player.stats.currentHealth);
    this.maxHealth = Math.max(1, state.player.stats.maxHealth);

    if (this.isFirstUpdate) {
      this.displayHealth = targetHP;
      this.ghostHealth = targetHP;
    } else if (targetHP < this.displayHealth) {
      this.ghostDrainDelay = 0.35; // 350ms delay before ghost bar drains
      this.displayHealth = targetHP;
    } else {
      this.displayHealth = targetHP;
      if (this.ghostHealth < targetHP) {
        this.ghostHealth = targetHP;
      }
    }

    if (this.ghostDrainDelay > 0) {
      this.ghostDrainDelay = Math.max(0, this.ghostDrainDelay - dt);
    } else if (this.ghostHealth > this.displayHealth) {
      this.ghostHealth = Math.max(
        this.displayHealth,
        this.ghostHealth - (this.maxHealth * 0.75) * dt
      );
    }

    // 2. XP Progression & Level-Up Flash Detection
    if (!this.isFirstUpdate && state.player.level > this.currentLevel) {
      this.currentLevel = state.player.level;
      this.levelUpFlashTimer = 0.8;
      this.displayXP = 0;
    } else if (this.isFirstUpdate) {
      this.currentLevel = state.player.level;
    }

    if (this.levelUpFlashTimer > 0) {
      this.levelUpFlashTimer = Math.max(0, this.levelUpFlashTimer - dt);
    }

    this.targetXP = state.player.currentXP;
    this.xpToNextLevel = Math.max(1, state.player.xpToNextLevel);

    const xpDiff = this.targetXP - this.displayXP;
    if (Math.abs(xpDiff) > 0.01) {
      this.displayXP += xpDiff * Math.min(1.0, dt * 12.0);
    } else {
      this.displayXP = this.targetXP;
    }

    // 3. Kill Count Punch Animation (Decay existing impulse first, then apply new spike)
    if (this.killScaleAnim > 1.0) {
      this.killScaleAnim = Math.max(1.0, this.killScaleAnim - dt * 3.0);
    }

    const currentKills = state.killCount ?? state.hordeManager.totalKilled;
    if (this.isFirstUpdate) {
      this.killDisplayCount = currentKills;
      this.killScaleAnim = 1.0;
    } else if (currentKills > this.killDisplayCount) {
      this.killDisplayCount = currentKills;
      this.killScaleAnim = 1.35;
    }

    // 4. Time Formatting Cache
    const currentSec = Math.floor(state.elapsedTime);
    if (currentSec !== this.lastFormattedSecond) {
      this.lastFormattedSecond = currentSec;
      const m = Math.floor(currentSec / 60);
      const s = currentSec % 60;
      this.cachedTimerStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    this.isFirstUpdate = false;
  }

  /**
   * Renders the complete Gothic HUD directly onto the 2D canvas context.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    widthOrState?: number | HUDStateSnapshot,
    heightOrDt?: number,
    state?: HUDStateSnapshot
  ): void {
    let actualWidth = this.config.virtualWidth;
    let actualHeight = this.config.virtualHeight;
    let actualState = state;

    if (typeof widthOrState === 'object' && widthOrState !== null) {
      actualState = widthOrState as HUDStateSnapshot;
    } else if (typeof widthOrState === 'number') {
      actualWidth = widthOrState;
      if (typeof heightOrDt === 'number' && heightOrDt > 1) {
        actualHeight = heightOrDt;
      }
    }

    ctx.save();

    // A. Critical Health Screen Vignette
    this.renderLowHealthVignette(ctx, actualWidth, actualHeight);

    // B. Soul Level & Necrotic XP Bar
    this.renderXPBar(ctx, actualWidth);

    // C. Gothic Vitality Bar with Metallic Sheen & Cracked Obsidian
    this.renderVitalityBar(ctx);

    // D. Active Weapons & Passive Inventory Slots
    if (this.config.showInventorySlots) {
      this.renderInventorySlots(ctx, actualState?.player?.weapons, actualState?.player?.passives);
    }

    // E. Gothic Elapsed Survival Timer & Phase Subtitle
    this.renderSurvivalTimer(ctx, actualWidth, actualState?.elapsedTime ?? 0);

    // F. Skull Kill Counter & Swarm Tally
    const kills = actualState?.killCount ?? actualState?.hordeManager?.totalKilled ?? this.killDisplayCount;
    const swarmCount = actualState?.hordeManager?.getActiveCount ? actualState.hordeManager.getActiveCount() : 0;
    this.renderKillCounter(ctx, actualWidth, kills, swarmCount);

    // G. Boss Health Bar (if active)
    if (actualState?.boss) {
      this.renderBossBar(ctx, actualWidth, actualState.boss);
    }

    // H. Game Over Tombstone Plaque (if player dead)
    if (actualState?.player && !actualState.player.isAlive) {
      this.renderGameOverOverlay(ctx, actualWidth, actualHeight, actualState);
    }

    ctx.restore();
    return;
  }

  // ==========================================
  // Component Renderers
  // ==========================================

  private renderLowHealthVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const hpRatio = this.maxHealth > 0 ? this.displayHealth / this.maxHealth : 1.0;
    if (hpRatio >= 0.3) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.lowHPPulseTimer);
    const alpha = (0.2 + 0.25 * (1.0 - hpRatio / 0.3)) * (0.7 + 0.3 * pulse);

    const grad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.25,
      width / 2, height / 2, width * 0.55
    );
    grad.addColorStop(0, 'rgba(56, 10, 10, 0)');
    grad.addColorStop(0.7, `rgba(107, 18, 18, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(168, 29, 29, ${alpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  private renderXPBar(ctx: CanvasRenderingContext2D, width: number): void {
    const barX = 12;
    const barY = 4;
    const barW = width - 24;
    const barH = 10;

    // Obsidian Channel Background
    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(barX + 1, barY + 1, barW - 2, barH - 2);

    // Fill Ratio
    const ratio = this.xpToNextLevel > 0
      ? Math.min(1.0, Math.max(0, this.displayXP / this.xpToNextLevel))
      : 0;

    const fillW = Math.round((barW - 2) * ratio);

    if (fillW > 0) {
      const isEmerald = this.config.xpColorMode === 'necrotic-emerald';
      const grad = ctx.createLinearGradient(barX + 1, barY, barX + 1 + fillW, barY);
      if (isEmerald) {
        grad.addColorStop(0, GOTHIC_HUD_THEME.necroticDark);
        grad.addColorStop(0.5, GOTHIC_HUD_THEME.necroticMid);
        grad.addColorStop(0.85, GOTHIC_HUD_THEME.necroticBright);
        grad.addColorStop(1, GOTHIC_HUD_THEME.necroticGlow);
      } else {
        grad.addColorStop(0, GOTHIC_HUD_THEME.arcaneDark);
        grad.addColorStop(0.5, GOTHIC_HUD_THEME.arcaneMid);
        grad.addColorStop(0.85, GOTHIC_HUD_THEME.arcaneBright);
        grad.addColorStop(1, GOTHIC_HUD_THEME.arcaneGlow);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);

      // Shimmer gleam
      const shimmerPos = (this.shimmerTimer * 160) % (barW + 100) - 50;
      if (shimmerPos > 0 && shimmerPos < fillW) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(barX + 1 + Math.max(0, shimmerPos - 12), barY + 1, 24, barH - 2);
      }

      // Spark at leading edge
      ctx.fillStyle = isEmerald ? GOTHIC_HUD_THEME.necroticSpark : '#ffffff';
      ctx.fillRect(barX + fillW - 1, barY + 1, 2, barH - 2);
    }

    // Cracked Iron Frame Border
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    // Decorative corner rivets
    ctx.fillStyle = GOTHIC_HUD_THEME.ironRivet;
    ctx.fillRect(barX - 1, barY - 1, 2, 2);
    ctx.fillRect(barX + barW - 1, barY - 1, 2, 2);
    ctx.fillRect(barX - 1, barY + barH - 1, 2, 2);
    ctx.fillRect(barX + barW - 1, barY + barH - 1, 2, 2);

    // Soul Level Badge (Top Left)
    this.renderSoulLevelBadge(ctx, 16, 18);
  }

  private renderSoulLevelBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const badgeW = 72;
    const badgeH = 22;

    // Flash glow on level up
    if (this.levelUpFlashTimer > 0) {
      const flashAlpha = this.levelUpFlashTimer / 0.8;
      ctx.fillStyle = `rgba(104, 211, 145, ${flashAlpha * 0.4})`;
      ctx.fillRect(x - 4, y - 4, badgeW + 8, badgeH + 8);
    }

    // Obsidian Tablet Inset
    ctx.fillStyle = GOTHIC_HUD_THEME.charredBlack;
    ctx.fillRect(x, y, badgeW, badgeH);

    // Iron & Gold Trim Border
    ctx.strokeStyle = this.levelUpFlashTimer > 0 ? GOTHIC_HUD_THEME.necroticGlow : GOTHIC_HUD_THEME.goldFiligree;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, badgeW - 1, badgeH - 1);

    // Badge Text
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SOUL LVL ${this.currentLevel}`, x + badgeW / 2, y + badgeH / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private renderVitalityBar(ctx: CanvasRenderingContext2D): void {
    const barX = 96;
    const barY = 18;
    const barW = 160;
    const barH = 22;

    const hpRatio = this.maxHealth > 0 ? Math.max(0, this.displayHealth / this.maxHealth) : 0;
    const ghostRatio = this.maxHealth > 0 ? Math.max(0, this.ghostHealth / this.maxHealth) : 0;

    // Outer cracked iron framing & shadow
    ctx.fillStyle = GOTHIC_HUD_THEME.ironBase;
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Beveled frame highlights
    ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX - 2, barY + barH + 1);
    ctx.lineTo(barX - 2, barY - 2);
    ctx.lineTo(barX + barW + 1, barY - 2);
    ctx.stroke();

    ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelDark;
    ctx.beginPath();
    ctx.moveTo(barX + barW + 1, barY - 2);
    ctx.lineTo(barX + barW + 1, barY + barH + 1);
    ctx.lineTo(barX - 2, barY + barH + 1);
    ctx.stroke();

    // Interior Well (Charred Empty Reservoir)
    ctx.fillStyle = GOTHIC_HUD_THEME.bloodDark;
    ctx.fillRect(barX, barY, barW, barH);

    // Ghost Damage Fill (Lingering pale red)
    if (ghostRatio > hpRatio) {
      ctx.fillStyle = GOTHIC_HUD_THEME.ghostHealth;
      ctx.fillRect(barX, barY, Math.round(barW * ghostRatio), barH);
    }

    // Active Crimson Blood Fill
    if (hpRatio > 0) {
      const bloodW = Math.round(barW * hpRatio);
      const bloodGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      bloodGrad.addColorStop(0, GOTHIC_HUD_THEME.bloodBright);
      bloodGrad.addColorStop(0.3, GOTHIC_HUD_THEME.bloodMid);
      bloodGrad.addColorStop(0.7, GOTHIC_HUD_THEME.bloodBase);
      bloodGrad.addColorStop(1, GOTHIC_HUD_THEME.bloodDark);

      ctx.fillStyle = bloodGrad;
      ctx.fillRect(barX, barY, bloodW, barH);

      // Surface Meniscus Line
      ctx.fillStyle = '#ff8787';
      ctx.fillRect(barX, barY, bloodW, 1.5);
    }

    // Glass / Specular Sheen across top half
    ctx.fillStyle = GOTHIC_HUD_THEME.specularSheen;
    ctx.fillRect(barX, barY, barW, Math.floor(barH / 2));

    // Low HP Pulse border
    if (hpRatio < 0.3) {
      const pulseAlpha = 0.3 + 0.3 * Math.sin(this.lowHPPulseTimer);
      ctx.strokeStyle = `rgba(229, 62, 62, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    }

    // Vitality Text Numeric Readout (Centered)
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hpText = `${Math.ceil(this.displayHealth)} / ${this.maxHealth}`;
    // Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(hpText, barX + barW / 2 + 1, barY + barH / 2 + 1);
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(hpText, barX + barW / 2, barY + barH / 2);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private renderInventorySlots(
    ctx: CanvasRenderingContext2D,
    weapons: InventorySlotData[] = [],
    passives: InventorySlotData[] = []
  ): void {
    const startX = 16;
    const row1Y = 46;
    const row2Y = 74;
    const slotSize = 24;
    const gap = 4;
    const maxSlots = 6;

    // Row 1: Weapons
    for (let i = 0; i < maxSlots; i++) {
      const slotX = startX + i * (slotSize + gap);
      const item = weapons[i];
      this.renderSingleSlot(ctx, slotX, row1Y, slotSize, item, 'weapon');
    }

    // Row 2: Passives
    for (let i = 0; i < maxSlots; i++) {
      const slotX = startX + i * (slotSize + gap);
      const item = passives[i];
      this.renderSingleSlot(ctx, slotX, row2Y, slotSize, item, 'passive');
    }
  }

  private renderSingleSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    item: InventorySlotData | undefined,
    _type: 'weapon' | 'passive'
  ): void {
    // Inset Background
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x, y, size, size);

    // Beveled Iron Frame
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    if (item) {
      // Draw procedural icon
      this.drawItemIcon(ctx, x + 2, y + 2, size - 4, item.icon);

      // Rank Pips (I through V)
      const rank = Math.min(5, Math.max(1, item.rank));
      const pipW = 3;
      const pipH = 3;
      const pipGap = 1.5;
      const startPipX = x + (size - (5 * pipW + 4 * pipGap)) / 2;
      const pipY = y + size - pipH - 1;

      for (let p = 0; p < 5; p++) {
        const px = startPipX + p * (pipW + pipGap);
        ctx.fillStyle = p < rank
          ? (item.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticGlow)
          : GOTHIC_HUD_THEME.boneDark;
        ctx.fillRect(px, pipY, pipW, pipH);
      }
    } else {
      // Empty watermark cross
      ctx.strokeStyle = '#1d1a27';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y + 6);
      ctx.lineTo(x + size / 2, y + size - 6);
      ctx.moveTo(x + 6, y + size / 2);
      ctx.lineTo(x + size - 6, y + size / 2);
      ctx.stroke();
    }
  }

  private drawItemIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    icon: string
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;

    ctx.save();
    switch (icon.toLowerCase()) {
      case 'scythe':
        ctx.strokeStyle = GOTHIC_HUD_THEME.arcaneGlow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.35, -Math.PI * 0.3, Math.PI * 0.7);
        ctx.stroke();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 4);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.stroke();
        break;

      case 'orbiters':
        ctx.fillStyle = GOTHIC_HUD_THEME.arcaneGlow;
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 3, 2.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy + 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'lightning':
        ctx.strokeStyle = GOTHIC_HUD_THEME.arcaneGlow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + 2, y);
        ctx.lineTo(cx - 2, cy);
        ctx.lineTo(cx + 2, cy);
        ctx.lineTo(cx - 2, y + size);
        ctx.stroke();
        break;

      case 'spear':
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx - 3, cy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, y + size);
        ctx.stroke();
        break;

      case 'aura':
        ctx.strokeStyle = GOTHIC_HUD_THEME.arcaneMid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
        ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'tome':
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBase;
        ctx.fillRect(cx - 5, cy - 6, 10, 12);
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.fillRect(cx - 1, cy - 2, 2, 4);
        break;

      case 'ring':
        ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'chalice':
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 5);
        ctx.lineTo(cx + 4, cy - 5);
        ctx.lineTo(cx + 2, cy + 1);
        ctx.lineTo(cx - 2, cy + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.fillRect(cx - 3, cy - 4, 6, 2);
        break;

      case 'magnet':
        ctx.strokeStyle = GOTHIC_HUD_THEME.arcaneGlow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.3, Math.PI, 0);
        ctx.stroke();
        break;

      case 'armor':
        ctx.fillStyle = GOTHIC_HUD_THEME.ironRivet;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 5, cy - 3);
        ctx.lineTo(cx + 4, cy + 5);
        ctx.lineTo(cx, cy + 7);
        ctx.lineTo(cx - 4, cy + 5);
        ctx.lineTo(cx - 5, cy - 3);
        ctx.closePath();
        ctx.fill();
        break;

      default:
        ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private renderSurvivalTimer(ctx: CanvasRenderingContext2D, width: number, elapsedTime: number): void {
    const cx = width / 2;
    const cy = 34;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gothic Winglets & Timer Readout
    ctx.font = GOTHIC_HUD_THEME.fontTimer;

    // Deep Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(`\u27E8  ${this.cachedTimerStr}  \u27E9`, cx + 1, cy + 1);

    // Bone Ivory Fill
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(`\u27E8  ${this.cachedTimerStr}  \u27E9`, cx, cy);

    // Wave Phase Subtitle
    if (this.config.showWavePhase) {
      let phaseText = 'I. THE AWAKENING';
      if (elapsedTime >= 60) {
        phaseText = 'III. NIGHTFALL';
      } else if (elapsedTime >= 30) {
        phaseText = 'II. THE SWARM';
      }

      ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
      ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
      ctx.fillText(phaseText, cx, cy + 16);
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private renderKillCounter(
    ctx: CanvasRenderingContext2D,
    width: number,
    kills: number,
    swarmCount: number
  ): void {
    const rx = width - 20;
    const ry = 34;

    ctx.save();
    ctx.translate(rx, ry);

    if (this.killScaleAnim > 1.0) {
      ctx.scale(this.killScaleAnim, this.killScaleAnim);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Kill Tally Text
    ctx.font = GOTHIC_HUD_THEME.fontGothic;
    const formattedKills = kills.toLocaleString('en-US');

    // Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(formattedKills, 1, 1);
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(formattedKills, 0, 0);

    // Skull Icon (to left of text)
    const textMetrics = ctx.measureText(formattedKills);
    const skullX = -(textMetrics.width + 24);
    const skullY = -8;
    this.drawGothicSkull(ctx, skullX, skullY, 16);

    ctx.restore();

    // Swarm Counter Subtitle (Below)
    ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
    ctx.fillStyle = GOTHIC_HUD_THEME.necroticGlow;
    ctx.textAlign = 'right';
    ctx.fillText(`SWARM: ${swarmCount}`, rx, ry + 16);
    ctx.textAlign = 'start';
  }

  private drawGothicSkull(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size * 0.45;
    const r = size * 0.42;

    // Cranium
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.8);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.8);
    ctx.closePath();
    ctx.fill();

    // Jaw
    ctx.fillRect(cx - r * 0.45, cy + r * 0.8, r * 0.9, r * 0.4);

    // Eye Sockets (Dark with crimson glow)
    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy + 1, r * 0.22, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.35, cy + 1, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
    ctx.fillRect(cx - r * 0.35, cy + 1, 1.5, 1.5);
    ctx.fillRect(cx + r * 0.35, cy + 1, 1.5, 1.5);

    // Nasal aperture
    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.35);
    ctx.lineTo(cx + 1, cy + r * 0.55);
    ctx.lineTo(cx - 1, cy + r * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  private renderBossBar(
    ctx: CanvasRenderingContext2D,
    width: number,
    boss: { name: string; currentHealth: number; maxHealth: number }
  ): void {
    const cx = width / 2;
    const cy = 70;
    const barW = 340;
    const barH = 12;
    const barX = cx - barW / 2;

    const ratio = boss.maxHealth > 0 ? Math.max(0, boss.currentHealth / boss.maxHealth) : 0;

    // Boss Name
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
    ctx.textAlign = 'center';
    ctx.fillText(boss.name.toUpperCase(), cx, cy - 4);

    // Frame
    ctx.fillStyle = GOTHIC_HUD_THEME.charredBlack;
    ctx.fillRect(barX, cy, barW, barH);

    // Fill
    const fillW = Math.round(barW * ratio);
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, cy, barX + fillW, cy);
      grad.addColorStop(0, GOTHIC_HUD_THEME.bloodDark);
      grad.addColorStop(0.5, GOTHIC_HUD_THEME.bloodBase);
      grad.addColorStop(1, GOTHIC_HUD_THEME.bloodBright);
      ctx.fillStyle = grad;
      ctx.fillRect(barX, cy, fillW, barH);
    }

    ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, cy + 0.5, barW - 1, barH - 1);
    ctx.textAlign = 'start';
  }

  private renderGameOverOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: HUDStateSnapshot
  ): void {
    // Dark Scrim
    ctx.fillStyle = 'rgba(8, 6, 12, 0.86)';
    ctx.fillRect(0, 0, width, height);

    const plaqueW = 480;
    const plaqueH = 260;
    const px = (width - plaqueW) / 2;
    const py = (height - plaqueH) / 2;

    // Tombstone Plaque Inset
    ctx.fillStyle = GOTHIC_HUD_THEME.charredBlack;
    ctx.fillRect(px, py, plaqueW, plaqueH);

    // Double Gothic Border
    ctx.strokeStyle = GOTHIC_HUD_THEME.bloodMid;
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, plaqueW, plaqueH);

    ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + 4, plaqueW - 8, plaqueH - 8);

    // Title
    ctx.font = "bold 20px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
    ctx.textAlign = 'center';
    ctx.fillText('YOU HAVE SUCCUMBED TO THE HORDE', width / 2, py + 42);

    // Skull Divider
    this.drawGothicSkull(ctx, width / 2 - 10, py + 56, 20);

    // Run Stats
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;

    const statsY = py + 105;
    ctx.fillText(`Survival Time: ${this.cachedTimerStr}`, width / 2, statsY);
    ctx.fillText(`Final Soul Level: ${state.player.level}`, width / 2, statsY + 24);
    const totalKills = state.killCount ?? state.hordeManager.totalKilled;
    ctx.fillText(`Foes Exterminated: ${totalKills.toLocaleString('en-US')}`, width / 2, statsY + 48);

    // Restart Prompt (Pulsing)
    const promptPulse = 0.5 + 0.5 * Math.sin(this.lowHPPulseTimer);
    ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
    ctx.fillStyle = `rgba(237, 229, 222, ${0.4 + 0.6 * promptPulse})`;
    ctx.fillText('PRESS [SPACE] OR CLICK TO RESURRECT', width / 2, py + plaqueH - 30);

    ctx.textAlign = 'start';
  }
}
