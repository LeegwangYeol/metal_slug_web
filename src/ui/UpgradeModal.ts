/**
 * UpgradeModal.ts - Ornate Gothic Level-Up Card Selection Modal.
 *
 * Capabilities:
 * - 100% Canvas-rendered on 960x540 virtual canvas context.
 * - 4-tier glowing rarity engine: Common (Silver), Rare (Cyan), Epic (Amethyst), Legendary (Molten Gold).
 * - Dark gothic glassmorphism cards (translucent frosted obsidian, specular sheen, corner brackets).
 * - Micro-interactions: -8px hover lift, 1.02x scale zoom, traveling perimeter border gleams, ambient soul spark motes.
 * - Custom high-fidelity procedural skill icons for weapons and passives.
 * - Embossed [1]..[4] keybind buttons with interactive claim button.
 * - Clean pause/resume lifecycle with zero accumulator delta spikes.
 */

import { GOTHIC_HUD_THEME } from './GothicHUD';
import { UpgradeCard, UpgradeType } from '../core/systems/UpgradeSystem';

export interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RarityStyle {
  tierName: string;
  borderColor: string;
  borderHoverColor: string;
  glowColor: string;
  glowHoverColor: string;
  badgeBg: string;
  badgeText: string;
  particleColor: string;
}

export const RARITY_STYLES: Record<CardRarity, RarityStyle> = {
  common: {
    tierName: 'COMMON',
    borderColor: '#4b4859',
    borderHoverColor: '#a8a29e',
    glowColor: 'rgba(168, 162, 158, 0.25)',
    glowHoverColor: 'rgba(214, 211, 209, 0.50)',
    badgeBg: '#1f1d2b',
    badgeText: '#d6d3d1',
    particleColor: '#a8a29e',
  },
  rare: {
    tierName: 'RARE',
    borderColor: '#0d9488',
    borderHoverColor: '#14b8a6',
    glowColor: 'rgba(20, 184, 166, 0.35)',
    glowHoverColor: 'rgba(45, 212, 191, 0.65)',
    badgeBg: '#0f2b26',
    badgeText: '#5eead4',
    particleColor: '#2dd4bf',
  },
  epic: {
    tierName: 'EPIC',
    borderColor: '#7c3aed',
    borderHoverColor: '#a855f7',
    glowColor: 'rgba(124, 58, 237, 0.45)',
    glowHoverColor: 'rgba(168, 85, 247, 0.75)',
    badgeBg: '#241242',
    badgeText: '#c084fc',
    particleColor: '#c084fc',
  },
  legendary: {
    tierName: 'LEGENDARY',
    borderColor: '#d97706',
    borderHoverColor: '#f59e0b',
    glowColor: 'rgba(217, 119, 6, 0.55)',
    glowHoverColor: 'rgba(245, 158, 11, 0.85)',
    badgeBg: '#3b2207',
    badgeText: '#fde68a',
    particleColor: '#f59e0b',
  },
};

export function getCardRarity(card: UpgradeCard): CardRarity {
  if (card.isEvolution || card.category === 'evolution') return 'legendary';
  if (card.newRank >= 5 || card.type === UpgradeType.WEAPON_EVOLUTION || (card.type as any) === 4) return 'epic';
  if (card.newRank >= 3 || card.category === 'passive') return 'rare';
  return 'common';
}

export class UpgradeModal {
  private cards: UpgradeCard[] = [];
  private level: number = 1;
  private isOpen: boolean = false;

  public hoveredIndex: number | null = null;
  public selectedIndex: number = 0;
  public onSelect?: (card: UpgradeCard) => void;

  private pulseTimer: number = 0;
  private cardBounds: CardBounds[] = [];

  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnClick: (e: MouseEvent) => void;
  private targetCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.boundOnMouseMove = this.handleMouseMove.bind(this);
    this.boundOnClick = this.handleClick.bind(this);
  }

  public open(cards: UpgradeCard[], level: number, canvas?: HTMLCanvasElement): void {
    this.cards = cards;
    this.level = level;
    this.isOpen = true;
    this.hoveredIndex = null;
    this.selectedIndex = 0;
    this.pulseTimer = 0;

    if (canvas) {
      this.targetCanvas = canvas;
      canvas.addEventListener('mousemove', this.boundOnMouseMove);
      canvas.addEventListener('click', this.boundOnClick);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public close(): void {
    this.isOpen = false;
    if (this.targetCanvas) {
      this.targetCanvas.removeEventListener('mousemove', this.boundOnMouseMove);
      this.targetCanvas.removeEventListener('click', this.boundOnClick);
      this.targetCanvas.style.cursor = 'default';
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundOnKeyDown);
    }
  }

  /**
   * Closes the modal, detaches listeners, and resets all card and selection state.
   */
  public reset(): void {
    this.close();
    this.cards = [];
    this.level = 1;
    this.hoveredIndex = null;
    this.selectedIndex = 0;
    this.pulseTimer = 0;
    this.cardBounds = [];
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public update(dt: number): void {
    if (!this.isOpen) return;
    this.pulseTimer += dt;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isOpen || this.cards.length === 0) return;

    if (e.code === 'Digit1' || e.key === '1') {
      this.confirmSelection(0);
    } else if (e.code === 'Digit2' || e.key === '2') {
      this.confirmSelection(1);
    } else if (e.code === 'Digit3' || e.key === '3') {
      this.confirmSelection(2);
    } else if (e.code === 'Digit4' || e.key === '4') {
      this.confirmSelection(3);
    } else if (e.code === 'ArrowLeft') {
      this.selectedIndex = (this.selectedIndex - 1 + this.cards.length) % this.cards.length;
      this.hoveredIndex = this.selectedIndex;
    } else if (e.code === 'ArrowRight') {
      this.selectedIndex = (this.selectedIndex + 1) % this.cards.length;
      this.hoveredIndex = this.selectedIndex;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      this.confirmSelection(this.hoveredIndex ?? this.selectedIndex);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isOpen || !this.targetCanvas) return;
    const rect = this.targetCanvas.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 540 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let hit: number | null = null;
    for (let i = 0; i < this.cardBounds.length; i++) {
      const b = this.cardBounds[i];
      if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
        hit = i;
        break;
      }
    }

    this.hoveredIndex = hit;
    if (hit !== null) {
      this.selectedIndex = hit;
      this.targetCanvas.style.cursor = 'pointer';
    } else {
      this.targetCanvas.style.cursor = 'default';
    }
  }

  private handleClick(_e: MouseEvent): void {
    if (!this.isOpen) return;
    if (this.hoveredIndex !== null) {
      this.confirmSelection(this.hoveredIndex);
    }
  }

  private confirmSelection(index: number): void {
    if (index >= 0 && index < this.cards.length) {
      const chosen = this.cards[index];
      this.onSelect?.(chosen);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number = 960, height: number = 540): void {
    if (!this.isOpen) return;

    ctx.save();

    // 1. Dark Vignetted Scrim
    ctx.fillStyle = 'rgba(8, 6, 12, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // Subtle center glow
    const radial = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 450);
    radial.addColorStop(0, 'rgba(23, 19, 38, 0.45)');
    radial.addColorStop(1, 'rgba(5, 3, 8, 0.95)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Soul Spark Motes
    for (let m = 0; m < 20; m++) {
      const mx = ((m * 197 + 53) % width);
      const speed = 25 + (m % 5) * 8;
      const my = ((height - ((this.pulseTimer * speed + m * 73) % height)) + height) % height;
      const moteAlpha = 0.2 + 0.3 * Math.sin(this.pulseTimer * 2 + m);
      const moteRadius = 1.2 + (m % 3) * 0.8;
      ctx.fillStyle = `rgba(147, 197, 253, ${moteAlpha})`;
      ctx.beginPath();
      ctx.arc(mx, my, moteRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Gothic Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = GOTHIC_HUD_THEME.fontGothic;

    // Header Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText('SELECT THY OCCULT BOON', width / 2 + 2, 48);
    ctx.fillText('SELECT THY OCCULT BOON', width / 2 + 1, 47);

    // Antique Gold Header
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText('SELECT THY OCCULT BOON', width / 2, 46);

    // Subtitle
    ctx.font = "italic 12px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(`Soul Level ${this.level} Ascended — Claim a Relic of Ruin`, width / 2, 68);

    // 4. Calculate Card Dimensions
    const n = this.cards.length;
    const cardW = n <= 3 ? 220 : 196;
    const cardH = 340;
    const cardY = 96;
    const gap = n <= 3 ? 24 : 16;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (width - totalW) / 2;

    this.cardBounds = [];

    // 5. Render Each Card
    for (let i = 0; i < n; i++) {
      const card = this.cards[i];
      const cardX = startX + i * (cardW + gap);
      this.cardBounds.push({ x: cardX, y: cardY, width: cardW, height: cardH });

      const isHovered = this.hoveredIndex === i || this.selectedIndex === i;
      this.renderCard(ctx, cardX, cardY, cardW, cardH, card, i, isHovered);
    }

    // 6. Footer Instructions
    ctx.font = "12px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText('Press [1] - [4] or Click to Claim • [←] [→] to Navigate • [Enter] to Confirm', width / 2, 480);

    ctx.restore();
  }

  private renderCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    card: UpgradeCard,
    index: number,
    isHovered: boolean
  ): void {
    ctx.save();

    // 1. Hover Lift (-8px) and Scale Zoom (1.02x)
    const drawY = isHovered ? y - 8 : y;
    const cx = x + w / 2;
    const cy = drawY + h / 2;

    if (isHovered && ctx.scale && ctx.translate) {
      ctx.translate(cx, cy);
      ctx.scale(1.02, 1.02);
      ctx.translate(-cx, -cy);
    }

    const rarityKey = getCardRarity(card);
    const rarity = RARITY_STYLES[rarityKey];

    // 2. Dark Gothic Glassmorphism Card Body (Translucent Frosted Obsidian)
    const grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
    grad.addColorStop(0, 'rgba(18, 14, 28, 0.90)');
    grad.addColorStop(0.5, 'rgba(14, 11, 22, 0.92)');
    grad.addColorStop(1, 'rgba(8, 6, 14, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, drawY, w, h);

    // 3. Diagonal Specular Glass Sheen
    const sheenGrad = ctx.createLinearGradient(x, drawY, x + w * 0.75, drawY + h * 0.6);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.moveTo(x, drawY);
    ctx.lineTo(x + w * 0.75, drawY);
    ctx.lineTo(x, drawY + h * 0.65);
    ctx.closePath();
    ctx.fill();

    // 4. Glowing Rarity Border
    if (isHovered) {
      ctx.strokeStyle = rarity.borderHoverColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = rarity.glowHoverColor;
      ctx.shadowBlur = 16;
    } else {
      ctx.strokeStyle = rarity.borderColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = rarity.glowColor;
      ctx.shadowBlur = 8;
    }
    ctx.strokeRect(x + 0.5, drawY + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // 5. Traveling Perimeter Border Gleam
    const perimeter = 2 * (w + h);
    const gleamDist = ((this.pulseTimer * 140 + index * 90) % perimeter);
    let gx = x;
    let gy = drawY;
    if (gleamDist < w) {
      gx = x + gleamDist;
      gy = drawY;
    } else if (gleamDist < w + h) {
      gx = x + w;
      gy = drawY + (gleamDist - w);
    } else if (gleamDist < 2 * w + h) {
      gx = x + w - (gleamDist - (w + h));
      gy = drawY + h;
    } else {
      gx = x;
      gy = drawY + h - (gleamDist - (2 * w + h));
    }

    const gleamGrad = ctx.createRadialGradient(gx, gy, 1, gx, gy, 6);
    gleamGrad.addColorStop(0, '#ffffff');
    gleamGrad.addColorStop(0.4, rarity.borderHoverColor);
    gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gleamGrad;
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.fill();

    // 6. 4 Metallic Corner Filigree Brackets
    const bs = 6;
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.ironBase;
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldHighlight : GOTHIC_HUD_THEME.ironBevelLight;
    ctx.lineWidth = 1;

    // Top-Left
    ctx.fillRect(x, drawY, bs, bs);
    ctx.strokeRect(x + 0.5, drawY + 0.5, bs, bs);
    // Top-Right
    ctx.fillRect(x + w - bs, drawY, bs, bs);
    ctx.strokeRect(x + w - bs - 0.5, drawY + 0.5, bs, bs);
    // Bottom-Left
    ctx.fillRect(x, drawY + h - bs, bs, bs);
    ctx.strokeRect(x + 0.5, drawY + h - bs - 0.5, bs, bs);
    // Bottom-Right
    ctx.fillRect(x + w - bs, drawY + h - bs, bs, bs);
    ctx.strokeRect(x + w - bs - 0.5, drawY + h - bs - 0.5, bs, bs);

    // Center micro-rivet inside brackets
    ctx.fillStyle = isHovered ? '#ffffff' : GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillRect(x + 2, drawY + 2, 2, 2);
    ctx.fillRect(x + w - 4, drawY + 2, 2, 2);
    ctx.fillRect(x + 2, drawY + h - 4, 2, 2);
    ctx.fillRect(x + w - 4, drawY + h - 4, 2, 2);

    // 7. Top Embossed Keybind Hotkey Pill [1]..[4]
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 10, drawY + 10, 26, 20);
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10.5, drawY + 10.5, 25, 19);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 11px 'Cinzel', 'Georgia', serif";
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.goldHighlight : GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText(`${index + 1}`, x + 23, drawY + 20);

    // 8. Rarity Tier Badge Pill (Top Right)
    const badgeW = 72;
    const badgeH = 20;
    const badgeX = x + w - badgeW - 10;
    const badgeY = drawY + 10;

    ctx.fillStyle = rarity.badgeBg;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = rarity.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);

    ctx.font = "bold 9px 'Cinzel', 'Georgia', serif";
    ctx.fillStyle = rarity.badgeText;
    ctx.textAlign = 'center';
    ctx.fillText(rarity.tierName, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // 9. Procedural Skill Icon Well with Radiant Ambient Glow
    const iconCx = x + w / 2;
    const iconCy = drawY + 68;

    // Ambient radial glow behind icon
    const iconAura = ctx.createRadialGradient(iconCx, iconCy, 2, iconCx, iconCy, 30);
    iconAura.addColorStop(0, rarity.glowColor);
    iconAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = iconAura;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 30, 0, Math.PI * 2);
    ctx.fill();

    // Dark inset circle
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 25, 0, Math.PI * 2);
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fill();
    ctx.strokeStyle = isHovered ? rarity.borderHoverColor : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Procedural Icon Render
    this.drawIcon(ctx, iconCx, iconCy, card.icon, card.isEvolution, rarity);

    // 10. Item Title
    ctx.textAlign = 'center';
    ctx.font = "bold 14px 'Cinzel', 'Georgia', serif";
    // Drop shadow
    ctx.fillStyle = '#000000';
    ctx.fillText(card.name, iconCx + 1, drawY + 113);
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(card.name, iconCx, drawY + 112);

    // Subtitle
    ctx.font = "italic 11px 'Georgia', serif";
    ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(card.subtitle, iconCx, drawY + 128);

    // 11. Rank Pips
    const pipW = 14;
    const pipH = 5;
    const pipGap = 4;
    const totalPipW = 5 * pipW + 4 * pipGap;
    const startPipX = iconCx - totalPipW / 2;
    const pipY = drawY + 140;

    for (let p = 0; p < 5; p++) {
      const px = startPipX + p * (pipW + pipGap);
      if (p < card.previousRank) {
        ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : rarity.borderHoverColor;
      } else if (p < card.newRank) {
        const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer * 8);
        ctx.fillStyle = pulse > 0.5 ? GOTHIC_HUD_THEME.goldFiligree : rarity.particleColor;
      } else {
        ctx.fillStyle = GOTHIC_HUD_THEME.boneDark;
      }
      ctx.fillRect(px, pipY, pipW, pipH);
    }

    // Divider
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 16, drawY + 158);
    ctx.lineTo(x + w - 16, drawY + 158);
    ctx.stroke();

    // 12. Description (Multi-Line Wrap)
    ctx.textAlign = 'center';
    ctx.font = "11px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    this.wrapText(ctx, card.description, iconCx, drawY + 178, w - 24, 15);

    // 13. Stat Deltas Box
    const statBoxY = drawY + 238;
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 10, statBoxY, w - 20, 42);
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 10.5, statBoxY + 0.5, w - 21, 41);

    ctx.font = "bold 10px 'Georgia', serif";
    ctx.fillStyle = rarity.particleColor;
    ctx.fillText(card.statChangeDescription, iconCx, statBoxY + 24);

    // 14. Bottom Interactive Claim Button
    const btnY = drawY + 296;
    ctx.fillStyle = isHovered ? rarity.badgeBg : GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 14, btnY, w - 28, 28);
    ctx.strokeStyle = isHovered ? rarity.borderHoverColor : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 14.5, btnY + 0.5, w - 29, 27);

    ctx.font = "bold 11px 'Cinzel', 'Georgia', serif";
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.boneIvory : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(isHovered ? `CLAIM RELIC [${index + 1}]` : `PRESS [${index + 1}]`, iconCx, btnY + 17);

    ctx.restore();
  }

  private drawIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    icon: string,
    isEvolution: boolean,
    rarity?: RarityStyle
  ): void {
    ctx.save();
    const glow = isEvolution ? GOTHIC_HUD_THEME.goldFiligree : (rarity?.borderHoverColor ?? GOTHIC_HUD_THEME.arcaneGlow);

    switch (icon.toLowerCase()) {
      case 'scythe':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, -Math.PI * 0.35, Math.PI * 0.75);
        ctx.stroke();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 7);
        ctx.lineTo(cx + 9, cy + 9);
        ctx.stroke();
        // Blood droplet on tip
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.beginPath();
        ctx.arc(cx - 7, cy + 11, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'orbiters':
        // Spectral orbital ring
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.stroke();
        // 3 Glowing Orbiting Orbs
        for (let i = 0; i < 3; i++) {
          const angle = (this.pulseTimer * 3 + i * (Math.PI * 2 / 3));
          const ox = cx + Math.cos(angle) * 11;
          const oy = cy + Math.sin(angle) * 11;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'lightning':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 14);
        ctx.lineTo(cx - 2, cy - 2);
        ctx.lineTo(cx + 3, cy - 2);
        ctx.lineTo(cx - 4, cy + 14);
        ctx.stroke();
        // Inner white hot core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 14);
        ctx.lineTo(cx - 2, cy - 2);
        ctx.lineTo(cx + 3, cy - 2);
        ctx.lineTo(cx - 4, cy + 14);
        ctx.stroke();
        break;

      case 'spear':
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 6, cy);
        ctx.lineTo(cx - 6, cy);
        ctx.closePath();
        ctx.fill();
        // Center fuller groove
        ctx.strokeStyle = GOTHIC_HUD_THEME.abyssalVoid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx, cy - 1);
        ctx.stroke();
        // Shaft
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + 14);
        ctx.stroke();
        // Tassel ribbon
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.fillRect(cx - 3, cy + 1, 6, 2.5);
        break;

      case 'aura':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        // Cardinal rune nodes
        ctx.fillStyle = '#ffffff';
        for (let a = 0; a < 4; a++) {
          const ang = a * Math.PI / 2;
          ctx.fillRect(cx + Math.cos(ang) * 14 - 1, cy + Math.sin(ang) * 14 - 1, 2, 2);
        }
        break;

      case 'tome':
        // Book cover
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBase;
        ctx.fillRect(cx - 9, cy - 11, 18, 22);
        // Gold edge & clasps
        ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 9.5, cy - 11.5, 19, 23);
        // Rune eye crest on cover
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'ring':
        // Golden Band
        ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2);
        ctx.stroke();
        // Faceted Gemstone on top
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 11);
        ctx.lineTo(cx + 5, cy - 6);
        ctx.lineTo(cx, cy - 3);
        ctx.lineTo(cx - 5, cy - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, cy - 7, 2, 2);
        break;

      case 'chalice':
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 9);
        ctx.lineTo(cx + 8, cy - 9);
        ctx.lineTo(cx + 4, cy + 3);
        ctx.lineTo(cx - 4, cy + 3);
        ctx.closePath();
        ctx.fill();
        // Stem & Base
        ctx.fillRect(cx - 1.5, cy + 3, 3, 7);
        ctx.fillRect(cx - 6, cy + 10, 12, 2.5);
        // Wine
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.fillRect(cx - 6, cy - 8, 12, 3);
        break;

      case 'magnet':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 11, Math.PI, 0);
        ctx.stroke();
        // Pole Tips
        ctx.fillStyle = '#ef4444'; // Red pole
        ctx.fillRect(cx - 12.5, cy + 2, 3.5, 6);
        ctx.fillStyle = '#3b82f6'; // Blue pole
        ctx.fillRect(cx + 9, cy + 2, 3.5, 6);
        break;

      case 'armor':
        ctx.fillStyle = GOTHIC_HUD_THEME.ironBase;
        ctx.strokeStyle = GOTHIC_HUD_THEME.ironBevelLight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 10, cy - 7);
        ctx.lineTo(cx + 8, cy + 8);
        ctx.lineTo(cx, cy + 13);
        ctx.lineTo(cx - 8, cy + 8);
        ctx.lineTo(cx - 10, cy - 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Gold Chest Medallion
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }
}
