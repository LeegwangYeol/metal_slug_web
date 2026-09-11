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
  ghostAmberStart: '#f59e0b',
  ghostAmberMid: '#d97706',
  ghostAmberEnd: '#991b1b',

  // Soul-Blue / Amethyst (XP & Soul Energy)
  soulVoid: '#1e0838',
  soulAmethyst: '#4c1d95',
  soulIndigo: '#3b82f6',
  soulCyan: '#06b6d4',
  soulSpark: '#e0f2fe',
  soulGlow: 'rgba(6, 182, 212, 0.7)',

  // Necrotic Emerald (Legacy XP & Energy)
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

  // Bone Ivory & Antique Gold (Text & Badges)
  boneIvory: '#ede5de',
  boneMuted: '#b8aea5',
  boneDark: '#615852',
  goldFiligree: '#d4af37',
  goldHighlight: '#fff3b0',
  goldShadow: '#946f08',
  goldGlow: 'rgba(212, 175, 55, 0.5)',

  // Fonts with robust Georgia fallbacks
  fontGothic: "bold 16px 'Cinzel', 'Cinzel Decorative', 'Georgia', serif",
  fontTimer: "bold 24px 'Cinzel', 'Cinzel Decorative', 'Georgia', serif",
  fontHeading: "bold 20px 'Cinzel', 'Georgia', serif",
  fontSmall: "bold 11px 'Cinzel', 'Georgia', serif",
  fontSubtitle: "italic 10px 'Georgia', serif",
  fontMono: "bold 11px 'Courier New', monospace",
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
  xpColorMode?: 'soul-blue' | 'necrotic-emerald' | 'cursed-violet';
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
      xpColorMode: config.xpColorMode ?? 'soul-blue',
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

    // Double-Beveled Obsidian Channel Background
    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(barX + 1, barY + 1, barW - 2, barH - 2);

    // Inner Channel Shadow Bevel
    ctx.strokeStyle = '#05030a';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 1.5, barY + 1.5, barW - 3, barH - 3);

    // Fill Ratio
    const ratio = this.xpToNextLevel > 0
      ? Math.min(1.0, Math.max(0, this.displayXP / this.xpToNextLevel))
      : 0;

    const fillW = Math.round((barW - 2) * ratio);

    if (fillW > 0) {
      const isArcane = this.config.xpColorMode === 'cursed-violet';
      const grad = ctx.createLinearGradient(barX + 1, barY, barX + 1 + fillW, barY);
      if (isArcane) {
        grad.addColorStop(0, GOTHIC_HUD_THEME.arcaneDark);
        grad.addColorStop(0.5, GOTHIC_HUD_THEME.arcaneMid);
        grad.addColorStop(0.85, GOTHIC_HUD_THEME.arcaneBright);
        grad.addColorStop(1, GOTHIC_HUD_THEME.arcaneGlow);
      } else {
        // Radiant Soul-Blue to Royal Amethyst Gradient (Mandatory Objective 3)
        grad.addColorStop(0.00, '#1e0838'); // Deep cosmic void
        grad.addColorStop(0.35, '#4c1d95'); // Royal amethyst core
        grad.addColorStop(0.70, '#3b82f6'); // Soul-fire indigo
        grad.addColorStop(0.92, '#06b6d4'); // Radiant cyan glow
        grad.addColorStop(1.00, '#e0f2fe'); // Incandescent soul spark
      }
      ctx.fillStyle = grad;
      ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);

      // Shimmer gleam wave
      const shimmerPos = (this.shimmerTimer * 160) % (barW + 100) - 50;
      if (shimmerPos > 0 && shimmerPos < fillW) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(barX + 1 + Math.max(0, shimmerPos - 12), barY + 1, 24, barH - 2);
      }

      // Radiant Leading Edge Soul Spark Orb
      const orbX = barX + 1 + fillW;
      const orbY = barY + barH / 2;
      const orbGrad = ctx.createRadialGradient(orbX, orbY, 1, orbX, orbY, 6);
      orbGrad.addColorStop(0, '#ffffff');
      orbGrad.addColorStop(0.4, '#06b6d4');
      orbGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Sharp spark core at leading edge
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(barX + fillW - 1, barY + 1, 2, barH - 2);
    }

    // Double-Beveled Cracked Iron Frame Border
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    ctx.strokeStyle = '#1a1429';
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    // Decorative Antique Gold Micro-Rivets
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillRect(barX - 1, barY - 1, 2, 2);
    ctx.fillRect(barX + barW - 1, barY - 1, 2, 2);
    ctx.fillRect(barX - 1, barY + barH - 1, 2, 2);
    ctx.fillRect(barX + barW - 1, barY + barH - 1, 2, 2);

    // Soul Level Badge (Top Left)
    this.renderSoulLevelBadge(ctx, 16, 18);
  }

  private renderSoulLevelBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const badgeW = 74;
    const badgeH = 24;
    const cut = 5;

    ctx.save();

    // Pulsating ascension shockwave & corona aura on level up
    if (this.levelUpFlashTimer > 0) {
      const flashAlpha = this.levelUpFlashTimer / 0.8;
      const expand = (1.0 - flashAlpha) * 14;

      ctx.strokeStyle = `rgba(6, 182, 212, ${flashAlpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + badgeW / 2, y + badgeH / 2, (badgeW / 2) + expand, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(59, 130, 246, ${flashAlpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(x + badgeW / 2, y + badgeH / 2, (badgeW / 2) + expand * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Octagonal / Diamond Beveled Crest Path
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + badgeW - cut, y);
    ctx.lineTo(x + badgeW, y + cut);
    ctx.lineTo(x + badgeW, y + badgeH - cut);
    ctx.lineTo(x + badgeW - cut, y + badgeH);
    ctx.lineTo(x + cut, y + badgeH);
    ctx.lineTo(x, y + badgeH - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();

    // Charred Obsidian Body
    ctx.fillStyle = GOTHIC_HUD_THEME.charredBlack;
    ctx.fill();

    // Inner Iron Bevel
    ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelLight;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Antique Gold Trim
    ctx.strokeStyle = this.levelUpFlashTimer > 0 ? GOTHIC_HUD_THEME.soulCyan : GOTHIC_HUD_THEME.goldFiligree;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Occult Runes: ᚱ (Raidho) and ᛟ (Othala)
    ctx.font = "8px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.goldShadow;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('ᚱ', x + 3, y + 10);
    ctx.textAlign = 'right';
    ctx.fillText('ᛟ', x + badgeW - 3, y + 10);

    // Badge Text
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(`SOUL LVL ${this.currentLevel}`, x + badgeW / 2 + 1, y + badgeH / 2 + 1);

    // Bone Ivory Fill
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(`SOUL LVL ${this.currentLevel}`, x + badgeW / 2, y + badgeH / 2);

    ctx.restore();
  }

  private renderVitalityBar(ctx: CanvasRenderingContext2D): void {
    const barX = 98;
    const barY = 18;
    const barW = 168;
    const barH = 24;

    const hpRatio = this.maxHealth > 0 ? Math.max(0, this.displayHealth / this.maxHealth) : 0;
    const ghostRatio = this.maxHealth > 0 ? Math.max(0, this.ghostHealth / this.maxHealth) : 0;

    ctx.save();

    // 1. Sculpted Wrought-Iron Filigree Brackets & Cathedral Spires
    ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelLight;
    ctx.fillStyle = GOTHIC_HUD_THEME.ironBase;
    ctx.lineWidth = 1.5;

    // Left Wing Bracket
    ctx.beginPath();
    ctx.moveTo(barX - 2, barY + barH / 2);
    if (ctx.bezierCurveTo) {
      ctx.bezierCurveTo(barX - 8, barY + 2, barX - 10, barY - 4, barX - 3, barY - 2);
    } else {
      ctx.lineTo(barX - 8, barY + 2);
      ctx.lineTo(barX - 3, barY - 2);
    }
    ctx.lineTo(barX - 2, barY);
    ctx.stroke();

    // Right Wing Bracket
    ctx.beginPath();
    ctx.moveTo(barX + barW + 2, barY + barH / 2);
    if (ctx.bezierCurveTo) {
      ctx.bezierCurveTo(barX + barW + 8, barY + 2, barX + barW + 10, barY - 4, barX + barW + 3, barY - 2);
    } else {
      ctx.lineTo(barX + barW + 8, barY + 2);
      ctx.lineTo(barX + barW + 3, barY - 2);
    }
    ctx.lineTo(barX + barW + 2, barY);
    ctx.stroke();

    // Center Cathedral Spire Accent
    const midX = barX + barW / 2;
    ctx.beginPath();
    ctx.moveTo(midX - 12, barY - 2);
    ctx.lineTo(midX, barY - 7);
    ctx.lineTo(midX + 12, barY - 2);
    ctx.closePath();
    ctx.fillStyle = GOTHIC_HUD_THEME.ironBase;
    ctx.fill();
    ctx.stroke();

    // Spire Apex Gold Micro-Stud
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.beginPath();
    ctx.arc(midX, barY - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 Corner Gold Micro-Studs
    ctx.fillRect(barX - 4, barY - 4, 3, 3);
    ctx.fillRect(barX + barW + 1, barY - 4, 3, 3);
    ctx.fillRect(barX - 4, barY + barH + 1, 3, 3);
    ctx.fillRect(barX + barW + 1, barY + barH + 1, 3, 3);

    // 2. Double-Beveled Iron Casing
    ctx.fillStyle = GOTHIC_HUD_THEME.ironBase;
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Frame Highlights & Shadows
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

    // 3. Interior Reservoir (Abyssal Empty Blood Well)
    ctx.fillStyle = '#1c070c';
    ctx.fillRect(barX, barY, barW, barH);

    // 4. Smoldering Amber Ghost Damage Stagger Bar
    if (ghostRatio > hpRatio) {
      const ghostW = Math.round(barW * ghostRatio);
      const ghostGrad = ctx.createLinearGradient(barX, barY, barX + ghostW, barY);
      ghostGrad.addColorStop(0, GOTHIC_HUD_THEME.ghostAmberStart);
      ghostGrad.addColorStop(0.5, GOTHIC_HUD_THEME.ghostAmberMid);
      ghostGrad.addColorStop(1, GOTHIC_HUD_THEME.ghostAmberEnd);
      ctx.fillStyle = ghostGrad;
      ctx.fillRect(barX, barY, ghostW, barH);

      // Crackling ember seam at ghost leading edge
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(barX + ghostW - 2, barY, 2, barH);
    }

    // 5. Dynamic Layered Blood Fill with Sinusoidal Fluid Meniscus Wave
    if (hpRatio > 0) {
      const bloodW = Math.max(1, Math.round(barW * hpRatio));

      // 5-Stop Arterial Blood Gradient
      const bloodGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      bloodGrad.addColorStop(0.00, '#ff8080'); // Radiant meniscus crest
      bloodGrad.addColorStop(0.15, '#e52b2b'); // Bright arterial scarlet
      bloodGrad.addColorStop(0.50, '#a81d1d'); // Deep blood midtone
      bloodGrad.addColorStop(0.85, '#6b1212'); // Coagulated dark red
      bloodGrad.addColorStop(1.00, '#380a0a'); // Abyssal base

      // Fluid Meniscus Wave Clipping
      ctx.save();
      if (ctx.rect && ctx.clip) {
        ctx.beginPath();
        ctx.rect(barX, barY, bloodW, barH);
        ctx.clip();
      }

      ctx.fillStyle = bloodGrad;
      ctx.beginPath();
      ctx.moveTo(barX, barY + barH);
      ctx.lineTo(barX, barY + Math.sin(this.shimmerTimer * 3.5) * 1.2 + 2);

      const step = 4;
      for (let px = 0; px <= bloodW; px += step) {
        const waveY = barY + Math.sin(this.shimmerTimer * 3.5 + px * 0.1) * 1.2 + 1.5;
        ctx.lineTo(barX + px, waveY);
      }
      ctx.lineTo(barX + bloodW, barY + barH);
      ctx.closePath();
      ctx.fill();

      // Meniscus Crest Highlight Wave
      ctx.strokeStyle = '#ff9999';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let px = 0; px <= bloodW; px += step) {
        const waveY = barY + Math.sin(this.shimmerTimer * 3.5 + px * 0.1) * 1.2 + 1.5;
        if (px === 0) ctx.moveTo(barX + px, waveY);
        else ctx.lineTo(barX + px, waveY);
      }
      ctx.stroke();

      ctx.restore();
    }

    // 6. Curvilinear Glass Specular Highlight across upper half
    const glassGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH * 0.5);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.03)');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barW, barY);
    ctx.lineTo(barX + barW, barY + barH * 0.45);
    if (ctx.bezierCurveTo) {
      ctx.bezierCurveTo(barX + barW * 0.7, barY + barH * 0.55, barX + barW * 0.3, barY + barH * 0.35, barX, barY + barH * 0.45);
    } else {
      ctx.lineTo(barX, barY + barH * 0.45);
    }
    ctx.closePath();
    ctx.fill();

    // 7. Low HP Warning Pulse Border
    if (hpRatio < 0.3) {
      const pulseAlpha = 0.35 + 0.35 * Math.sin(this.lowHPPulseTimer);
      ctx.strokeStyle = `rgba(229, 62, 62, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    }

    // 8. Polished Bone Ivory Numeric Readout
    ctx.font = GOTHIC_HUD_THEME.fontSmall;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hpText = `${Math.ceil(this.displayHealth)} / ${this.maxHealth}`;
    // Solid 2px Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(hpText, barX + barW / 2 + 1, barY + barH / 2 + 1);
    ctx.fillText(hpText, barX + barW / 2 + 2, barY + barH / 2 + 1);

    // Bone Ivory Fill
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(hpText, barX + barW / 2, barY + barH / 2);

    ctx.restore();
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
    const cy = 30;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Arched Gothic Pediment Canopy
    ctx.fillStyle = GOTHIC_HUD_THEME.charredBlack;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 56, Math.PI, 0);
    ctx.lineTo(cx + 56, cy + 18);
    ctx.lineTo(cx - 56, cy + 18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelLight;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gold Finial Crest at top
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillRect(cx - 2, cy - 22, 4, 6);
    ctx.beginPath();
    ctx.arc(cx, cy - 24, 3, 0, Math.PI * 2);
    ctx.fill();

    // 2. Antique Gold Gradient Typography
    ctx.font = GOTHIC_HUD_THEME.fontTimer;
    const timerText = `\u27E8  ${this.cachedTimerStr}  \u27E9`;

    // Deep Solid Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(timerText, cx + 1.5, cy + 1.5);
    ctx.fillText(timerText, cx + 2, cy + 2);

    // Antique Gold Linear Gradient
    const goldGrad = ctx.createLinearGradient(cx, cy - 12, cx, cy + 12);
    goldGrad.addColorStop(0.0, GOTHIC_HUD_THEME.goldHighlight);
    goldGrad.addColorStop(0.5, GOTHIC_HUD_THEME.goldFiligree);
    goldGrad.addColorStop(1.0, GOTHIC_HUD_THEME.goldShadow);
    ctx.fillStyle = goldGrad;
    ctx.fillText(timerText, cx, cy);

    // 3. Wave Phase Banner Ribbon
    if (this.config.showWavePhase) {
      let phaseText = 'PHASE I • THE AWAKENING';
      if (elapsedTime >= 60) {
        phaseText = 'PHASE III • NIGHTFALL ASCENDANT';
      } else if (elapsedTime >= 30) {
        phaseText = 'PHASE II • THE UNDEAD SWARM';
      }

      const bannerW = 200;
      const bannerH = 15;
      const bannerY = cy + 17;

      // Inset dark banner with gold border
      ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
      ctx.fillRect(cx - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH);
      ctx.strokeStyle = GOTHIC_HUD_THEME.goldShadow;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - bannerW / 2 + 0.5, bannerY - bannerH / 2 + 0.5, bannerW - 1, bannerH - 1);

      ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
      ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
      ctx.fillText(phaseText, cx, bannerY);
    }

    ctx.restore();
  }

  private renderKillCounter(
    ctx: CanvasRenderingContext2D,
    width: number,
    kills: number,
    swarmCount: number
  ): void {
    const rx = width - 20;
    const ry = 30;

    ctx.save();
    ctx.translate(rx, ry);

    if (this.killScaleAnim > 1.0) {
      ctx.scale(this.killScaleAnim, this.killScaleAnim);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Kill Tally Text in Polished Bone Ivory
    ctx.font = GOTHIC_HUD_THEME.fontGothic;
    const formattedKills = kills.toLocaleString('en-US');

    // Solid Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(formattedKills, 1.5, 1.5);
    ctx.fillText(formattedKills, 2, 2);

    // Bone Ivory Fill
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(formattedKills, 0, 0);

    // Anatomical Gothic Skull with Ruby Eyes (to left of text)
    const textMetrics = ctx.measureText(formattedKills);
    const skullX = -(textMetrics.width + 26);
    const skullY = -9;
    this.drawGothicSkull(ctx, skullX, skullY, 18);

    ctx.restore();

    // Dynamic Swarm Density Subtitle
    ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    let densityColor: string = GOTHIC_HUD_THEME.necroticGlow;
    if (swarmCount > 400) {
      densityColor = '#f87171'; // Searing Crimson
    } else if (swarmCount >= 200) {
      densityColor = '#fbbf24'; // Amber
    }

    // Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(`SWARM: ${swarmCount}`, rx + 1, ry + 19);
    ctx.fillStyle = densityColor;
    ctx.fillText(`SWARM: ${swarmCount}`, rx, ry + 18);
  }

  private drawGothicSkull(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size * 0.44;
    const r = size * 0.44;

    ctx.save();

    // 1. Cranium Bone Structure
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(cx + r * 0.72, cy + r * 0.85);
    ctx.lineTo(cx - r * 0.72, cy + r * 0.85);
    ctx.closePath();
    ctx.fill();

    // Cranium Bone Highlights
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Weathered Forehead Suture Crack
    ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - r * 0.85);
    ctx.lineTo(cx + 1, cy - r * 0.5);
    ctx.lineTo(cx - 1, cy - r * 0.2);
    ctx.stroke();

    // 2. Jaw & Teeth
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillRect(cx - r * 0.45, cy + r * 0.85, r * 0.9, r * 0.42);
    ctx.strokeStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.lineWidth = 0.6;
    for (let t = -2; t <= 2; t++) {
      ctx.beginPath();
      ctx.moveTo(cx + t * 2, cy + r * 0.85);
      ctx.lineTo(cx + t * 2, cy + r * 1.25);
      ctx.stroke();
    }

    // 3. Deep Recessed Eye Sockets with Glowing Ruby Eyes
    const eyeR = r * 0.24;
    const eyeOffset = r * 0.35;
    const eyeY = cy + 1;

    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.beginPath();
    ctx.arc(cx - eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Ruby-Crimson Glowing Irises
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(cx - eyeOffset, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffset, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Additive Red Gleam
    ctx.fillStyle = '#ff8888';
    ctx.fillRect(cx - eyeOffset - 0.5, eyeY - 0.5, 1.5, 1.5);
    ctx.fillRect(cx + eyeOffset - 0.5, eyeY - 0.5, 1.5, 1.5);

    // 4. Nasal Cavity
    ctx.fillStyle = GOTHIC_HUD_THEME.abyssalVoid;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.38);
    ctx.lineTo(cx + 1.2, cy + r * 0.62);
    ctx.lineTo(cx - 1.2, cy + r * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
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
