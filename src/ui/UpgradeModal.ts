/**
 * UpgradeModal.ts - Ornate Gothic Level-Up Card Selection Modal.
 *
 * Capabilities:
 * - 100% Canvas-rendered on 960x540 virtual canvas context.
 * - Cracked obsidian stone cards, gold filigree highlights, animated rank pips.
 * - Mouse hover detection, cursor changes, and click confirmation.
 * - Keyboard selection via [1], [2], [3], [4], arrow navigation, and [Enter] / [Space].
 * - Clean pause/resume lifecycle with zero accumulator delta spikes.
 */

import { GOTHIC_HUD_THEME } from './GothicHUD';
import { UpgradeCard } from '../core/systems/UpgradeSystem';

export interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
    radial.addColorStop(0, 'rgba(23, 19, 38, 0.4)');
    radial.addColorStop(1, 'rgba(5, 3, 8, 0.9)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // 2. Gothic Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = GOTHIC_HUD_THEME.fontGothic;

    // Header Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText('SELECT THY OCCULT BOON', width / 2 + 2, 52);
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText('SELECT THY OCCULT BOON', width / 2, 50);

    // Subtitle
    ctx.font = "italic 13px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(`Soul Level ${this.level} Ascended — Claim a Relic of Ruin`, width / 2, 74);

    // 3. Calculate Card Dimensions
    const n = this.cards.length;
    const cardW = n <= 3 ? 210 : 184;
    const cardH = 330;
    const cardY = 105;
    const gap = n <= 3 ? 28 : 16;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (width - totalW) / 2;

    this.cardBounds = [];

    // 4. Render Each Card
    for (let i = 0; i < n; i++) {
      const card = this.cards[i];
      const cardX = startX + i * (cardW + gap);
      this.cardBounds.push({ x: cardX, y: cardY, width: cardW, height: cardH });

      const isHovered = this.hoveredIndex === i || this.selectedIndex === i;
      this.renderCard(ctx, cardX, cardY, cardW, cardH, card, i, isHovered);
    }

    // 5. Footer Instructions
    ctx.font = "12px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText('Press [1] - [4] or Click to Claim • [←] [→] to Navigate • [Enter] to Confirm', width / 2, 475);

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

    // Card Hover Lift
    const drawY = isHovered ? y - 4 : y;

    // Inset Stone Background
    const grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
    grad.addColorStop(0, '#151122');
    grad.addColorStop(1, '#0b0813');
    ctx.fillStyle = grad;
    ctx.fillRect(x, drawY, w, h);

    // Border Frame
    if (isHovered) {
      ctx.strokeStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticGlow;
      ctx.lineWidth = 2;
      ctx.shadowColor = card.isEvolution ? 'rgba(212, 175, 55, 0.7)' : 'rgba(40, 167, 69, 0.6)';
      ctx.shadowBlur = 12;
    } else {
      ctx.strokeStyle = card.isEvolution ? GOTHIC_HUD_THEME.bloodMid : GOTHIC_HUD_THEME.obsidianBorder;
      ctx.lineWidth = 1.5;
    }
    ctx.strokeRect(x + 0.5, drawY + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // Corner Brackets
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.ironRivet;
    const bs = 5;
    ctx.fillRect(x, drawY, bs, bs);
    ctx.fillRect(x + w - bs, drawY, bs, bs);
    ctx.fillRect(x, drawY + h - bs, bs, bs);
    ctx.fillRect(x + w - bs, drawY + h - bs, bs, bs);

    // Top Keybind Pill [1..4]
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 8, drawY + 8, 24, 18);
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 8.5, drawY + 8.5, 23, 17);

    ctx.textAlign = 'center';
    ctx.font = "bold 11px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText(`${index + 1}`, x + 20, drawY + 18);

    // Type Tag (top right)
    ctx.textAlign = 'right';
    ctx.font = "bold 10px 'Georgia', serif";
    if (card.category === 'evolution') {
      ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
      ctx.fillText('EVOLUTION', x + w - 10, drawY + 20);
    } else if (card.category === 'weapon') {
      ctx.fillStyle = GOTHIC_HUD_THEME.arcaneGlow;
      ctx.fillText('WEAPON', x + w - 10, drawY + 20);
    } else if (card.category === 'fallback') {
      ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
      ctx.fillText('RESTORATION', x + w - 10, drawY + 20);
    } else {
      ctx.fillStyle = GOTHIC_HUD_THEME.necroticGlow;
      ctx.fillText('PASSIVE', x + w - 10, drawY + 20);
    }

    // Icon Circle Well
    const iconCx = x + w / 2;
    const iconCy = drawY + 68;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 24, 0, Math.PI * 2);
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fill();
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Procedural Icon Render
    this.drawIcon(ctx, iconCx, iconCy, card.icon, card.isEvolution);

    // Item Title
    ctx.textAlign = 'center';
    ctx.font = "bold 14px 'Cinzel', 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(card.name, iconCx, drawY + 112);

    // Subtitle
    ctx.font = "italic 11px 'Georgia', serif";
    ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(card.subtitle, iconCx, drawY + 128);

    // Rank Pips
    const pipW = 14;
    const pipH = 5;
    const pipGap = 4;
    const totalPipW = 5 * pipW + 4 * pipGap;
    const startPipX = iconCx - totalPipW / 2;
    const pipY = drawY + 140;

    for (let p = 0; p < 5; p++) {
      const px = startPipX + p * (pipW + pipGap);
      if (p < card.previousRank) {
        ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticGlow;
      } else if (p < card.newRank) {
        const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer * 8);
        ctx.fillStyle = pulse > 0.5 ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticSpark;
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

    // Description (multi-line wrap)
    ctx.textAlign = 'center';
    ctx.font = "11px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    this.wrapText(ctx, card.description, iconCx, drawY + 178, w - 24, 15);

    // Stat Deltas Box
    const statBoxY = drawY + 236;
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 10, statBoxY, w - 20, 42);
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 10.5, statBoxY + 0.5, w - 21, 41);

    ctx.font = "bold 10px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.necroticSpark;
    ctx.fillText(card.statChangeDescription, iconCx, statBoxY + 24);

    // Bottom Claim Button
    const btnY = drawY + 292;
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.bloodBase : GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 14, btnY, w - 28, 26);
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 14.5, btnY + 0.5, w - 29, 25);

    ctx.font = "bold 11px 'Georgia', serif";
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.boneIvory : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(isHovered ? 'CLAIM BOON' : `Press [${index + 1}]`, iconCx, btnY + 15);

    ctx.restore();
  }

  private drawIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, icon: string, isEvolution: boolean): void {
    ctx.save();
    const glow = isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.arcaneGlow;

    switch (icon) {
      case 'scythe':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, -Math.PI * 0.3, Math.PI * 0.7);
        ctx.stroke();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 6);
        ctx.lineTo(cx + 8, cy + 8);
        ctx.stroke();
        break;

      case 'orbiters':
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 5, 4, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'lightning':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 12);
        ctx.lineTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx - 3, cy + 12);
        ctx.stroke();
        break;

      case 'spear':
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx - 5, cy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + 12);
        ctx.stroke();
        break;

      case 'aura':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'tome':
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBase;
        ctx.fillRect(cx - 8, cy - 10, 16, 20);
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.fillRect(cx - 2, cy - 4, 4, 8);
        break;

      case 'ring':
        ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'chalice':
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 8);
        ctx.lineTo(cx + 7, cy - 8);
        ctx.lineTo(cx + 3, cy + 3);
        ctx.lineTo(cx - 3, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.fillRect(cx - 5, cy - 7, 10, 3);
        break;

      case 'magnet':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, Math.PI, 0);
        ctx.stroke();
        break;

      case 'armor':
        ctx.fillStyle = GOTHIC_HUD_THEME.ironRivet;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 9, cy - 6);
        ctx.lineTo(cx + 7, cy + 8);
        ctx.lineTo(cx, cy + 12);
        ctx.lineTo(cx - 7, cy + 8);
        ctx.lineTo(cx - 9, cy - 6);
        ctx.closePath();
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
