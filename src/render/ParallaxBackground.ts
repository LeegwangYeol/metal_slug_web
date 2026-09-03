/**
 * 4-Layer Parallax Background Engine.
 * Layer 0: Desert sky gradient with drifting cumulus clouds (0.0x scroll factor).
 * Layer 1: Distant mountain peaks & ancient desert ruins (0.2x scroll factor).
 * Layer 2: Midground war ruins, palm trees & bunkers (0.5x scroll factor).
 * Layer 3: Foreground coastal combat surface & scaffolding (1.0x scroll factor).
 * Pre-renders seamless repeating buffers for high-performance 60fps rendering.
 */

import { PALETTES } from './sprites/Palette';
import { CanvasBuffer, CanvasContext2DLike, createCanvasBuffer } from './sprites/ProceduralSpriteFactory';

export interface ParallaxLayerConfig {
  scrollFactorX: number;
  scrollFactorY: number;
  bufferWidth: number;
  bufferHeight: number;
  yOffset: number;
}

export class ParallaxBackground {
  public static readonly VIEWPORT_WIDTH = 480;
  public static readonly VIEWPORT_HEIGHT = 270;

  // Layer 0: Sky buffer (static width 480, procedural animated clouds)
  private skyBuffer: CanvasBuffer;

  // Layer 1: Distant mountains (seamless width 960)
  private mountainsBuffer: CanvasBuffer;

  // Layer 2: Midground fortress structures & ruins (seamless width 960)
  private ruinsBuffer: CanvasBuffer;

  // Layer 3: Foreground terrain & scaffolding details (seamless width 960)
  private foregroundBuffer: CanvasBuffer;

  private bufferWidth: number = 960;

  constructor() {
    this.skyBuffer = createCanvasBuffer(ParallaxBackground.VIEWPORT_WIDTH, ParallaxBackground.VIEWPORT_HEIGHT);
    this.mountainsBuffer = createCanvasBuffer(this.bufferWidth, ParallaxBackground.VIEWPORT_HEIGHT);
    this.ruinsBuffer = createCanvasBuffer(this.bufferWidth, ParallaxBackground.VIEWPORT_HEIGHT);
    this.foregroundBuffer = createCanvasBuffer(this.bufferWidth, ParallaxBackground.VIEWPORT_HEIGHT);

    this.renderSkyBase();
    this.renderMountains();
    this.renderRuins();
    this.renderForegroundDetails();
  }

  // ==========================================
  // LAYER 0: SKY BASE & CLOUDS
  // ==========================================
  private renderSkyBase(): void {
    const ctx = this.skyBuffer.getContext('2d');
    if (!ctx) return;

    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // Metal Slug Mission 1 Coastal Dawn Gradient (Twilight Blue -> Purple Dusk -> Fiery Orange Horizon)
    const skyBands = [
      { y: 0, h: 40, col: '#102040' },
      { y: 40, h: 35, col: '#1E3255' },
      { y: 75, h: 35, col: '#364766' },
      { y: 110, h: 30, col: '#5E485E' },
      { y: 140, h: 30, col: '#9A504B' },
      { y: 170, h: 30, col: '#C86B38' },
      { y: 200, h: 35, col: '#E08538' },
      { y: 235, h: 35, col: '#F0A448' },
    ];

    for (const band of skyBands) {
      ctx.fillStyle = band.col;
      ctx.fillRect(0, band.y, W, band.h);
    }

    // Distant Morning Sun / Dawn Glow
    ctx.fillStyle = '#FFF5CC';
    ctx.beginPath();
    ctx.arc(380, 150, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 235, 160, 0.3)';
    ctx.beginPath();
    ctx.arc(380, 150, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDynamicClouds(ctx: CanvasContext2DLike, time: number): void {
    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // 3 Cloud drift tracks with varying wind speeds
    const cloudTracks = [
      { y: 35, speed: 6, scale: 1.0, color: '#F8E8D0', shade: '#C8B098' },
      { y: 75, speed: 10, scale: 1.3, color: '#E8D4C0', shade: '#B89880' },
      { y: 115, speed: 14, scale: 1.6, color: '#D4B8A0', shade: '#987868' },
    ];

    for (const track of cloudTracks) {
      const offsetX = (time * track.speed) % (W + 200);
      for (let base = -100; base < W + 200; base += 220) {
        const cx = (base + offsetX) % (W + 200) - 80;
        const cy = track.y;
        const s = track.scale;

        // Cloud shadow base
        ctx.fillStyle = track.shade;
        ctx.beginPath();
        ctx.arc(cx, cy + 4 * s, 16 * s, 0, Math.PI * 2);
        ctx.arc(cx + 18 * s, cy + 6 * s, 14 * s, 0, Math.PI * 2);
        ctx.arc(cx - 18 * s, cy + 6 * s, 14 * s, 0, Math.PI * 2);
        ctx.fill();

        // Cloud highlight body
        ctx.fillStyle = track.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 15 * s, 0, Math.PI * 2);
        ctx.arc(cx + 16 * s, cy + 2 * s, 13 * s, 0, Math.PI * 2);
        ctx.arc(cx - 16 * s, cy + 2 * s, 13 * s, 0, Math.PI * 2);
        ctx.arc(cx + 8 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
        ctx.arc(cx - 8 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ==========================================
  // LAYER 1: DISTANT MOUNTAINS & DESERT PEAKS (0.2x)
  // ==========================================
  private renderMountains(): void {
    const ctx = this.mountainsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Distant jagged mountain ridges & desert pyramids
    // Primary Far Ridge (Haze Dark Blue-Gray)
    ctx.fillStyle = '#2A3648';
    ctx.beginPath();
    ctx.moveTo(0, 270);
    ctx.lineTo(0, 160);

    for (let x = 0; x <= W; x += 30) {
      // Deterministic jagged terrain heights
      const h1 = Math.sin(x * 0.012) * 35;
      const h2 = Math.cos(x * 0.035) * 18;
      const y = 145 + h1 + h2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 270);
    ctx.closePath();
    ctx.fill();

    // Secondary Near Ridge (Warm Earthy Gray Shadow)
    ctx.fillStyle = '#3E4959';
    ctx.beginPath();
    ctx.moveTo(0, 270);
    ctx.lineTo(0, 185);

    for (let x = 0; x <= W; x += 40) {
      const h = Math.sin(x * 0.018 + 1.5) * 25 + Math.sin(x * 0.04) * 12;
      ctx.lineTo(x, 175 + h);
    }
    ctx.lineTo(W, 270);
    ctx.closePath();
    ctx.fill();

    // Desert plateaus / ruins silhouettes
    ctx.fillStyle = '#2E3846';
    for (let x = 80; x < W; x += 240) {
      // Ancient stone tower / pyramid monolith
      ctx.beginPath();
      ctx.moveTo(x, 195);
      ctx.lineTo(x + 20, 150);
      ctx.lineTo(x + 50, 150);
      ctx.lineTo(x + 70, 195);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ==========================================
  // LAYER 2: MIDGROUND WAR RUINS & BUNKERS (0.5x)
  // ==========================================
  private renderRuins(): void {
    const ctx = this.ruinsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;
    const T = PALETTES.TERRAIN;

    // Midground ground line
    ctx.fillStyle = '#4D5866';
    ctx.fillRect(0, 205, W, 65);
    ctx.fillStyle = '#3A4452';
    ctx.fillRect(0, 215, W, 55);

    // Concrete bunkers, pillboxes, palm trees, radio towers
    for (let x = 40; x < W; x += 160) {
      const variant = (x / 160) % 3;

      if (variant === 0) {
        // Concrete fortified pillbox
        ctx.fillStyle = '#303844';
        ctx.fillRect(x, 180, 56, 30);
        ctx.fillStyle = '#485466';
        ctx.fillRect(x + 2, 182, 52, 10);
        // Pillbox visor slot
        ctx.fillStyle = '#101418';
        ctx.fillRect(x + 10, 186, 36, 4);

        // Sandbags in front
        ctx.fillStyle = T[12];
        for (let bx = x - 6; bx < x + 60; bx += 14) {
          ctx.fillRect(bx, 202, 12, 6);
          ctx.fillRect(bx + 4, 197, 12, 6);
        }
      } else if (variant === 1) {
        // Shattered tropical palm tree
        ctx.fillStyle = '#4B3621'; // Bent wooden trunk
        ctx.fillRect(x + 20, 160, 6, 48);
        ctx.fillRect(x + 18, 175, 6, 6);

        // Palm fronds
        ctx.fillStyle = '#2D3E1A';
        ctx.beginPath();
        ctx.moveTo(x + 23, 160);
        ctx.lineTo(x - 8, 172);
        ctx.lineTo(x + 10, 164);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + 23, 160);
        ctx.lineTo(x + 50, 170);
        ctx.lineTo(x + 32, 164);
        ctx.fill();

        // Barbed wire wooden fence
        ctx.fillStyle = '#5A4228';
        ctx.fillRect(x - 20, 192, 4, 16);
        ctx.fillRect(x + 50, 192, 4, 16);
        ctx.fillStyle = '#808890';
        ctx.fillRect(x - 20, 196, 74, 1);
        ctx.fillRect(x - 20, 202, 74, 1);
      } else {
        // Steel communication antenna & radar dish
        ctx.fillStyle = '#2F3542';
        ctx.fillRect(x + 18, 145, 4, 62);
        ctx.fillRect(x + 10, 165, 20, 2);
        ctx.fillRect(x + 14, 155, 12, 2);
        // Red beacon light
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(x + 19, 142, 2, 3);
      }
    }
  }

  // ==========================================
  // LAYER 3: FOREGROUND COMBAT SURFACE (1.0x)
  // ==========================================
  private renderForegroundDetails(): void {
    const ctx = this.foregroundBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;
    const T = PALETTES.TERRAIN;

    // Coastal dock stilts, pier pilings, and shoreline waves
    for (let x = 0; x < W; x += 80) {
      // Wooden pier stilt
      ctx.fillStyle = T[9];
      ctx.fillRect(x + 30, 220, 8, 50);
      ctx.fillStyle = T[8];
      ctx.fillRect(x + 32, 220, 4, 50);

      // Horizontal brace beam
      ctx.fillStyle = T[9];
      ctx.fillRect(x, 235, 80, 4);

      // Water reflection & ocean depth below dock
      ctx.fillStyle = T[14];
      ctx.fillRect(x, 255, 80, 15);
      ctx.fillStyle = '#5B86A8';
      ctx.fillRect(x + 10, 256, 40, 2); // White foam ripple
    }
  }

  /**
   * Renders the complete 4-layer composite parallax background.
   */
  public render(
    ctx: CanvasContext2DLike,
    cameraX: number,
    _cameraY: number,
    time: number
  ): void {
    const W = ParallaxBackground.VIEWPORT_WIDTH;
    const H = ParallaxBackground.VIEWPORT_HEIGHT;

    // 1. Layer 0: Sky Gradient & Drifting Clouds (0.0x scroll)
    ctx.drawImage(this.skyBuffer as any, 0, 0, W, H, 0, 0, W, H);
    this.drawDynamicClouds(ctx, time);

    // 2. Layer 1: Distant Mountains (0.2x scroll)
    const factor1 = 0.2;
    const offset1 = Math.floor((cameraX * factor1) % this.bufferWidth);
    ctx.drawImage(this.mountainsBuffer as any, -offset1, 0);
    if (offset1 > this.bufferWidth - W) {
      ctx.drawImage(this.mountainsBuffer as any, this.bufferWidth - offset1, 0);
    }

    // 3. Layer 2: Midground Ruins & War Structures (0.5x scroll)
    const factor2 = 0.5;
    const offset2 = Math.floor((cameraX * factor2) % this.bufferWidth);
    ctx.drawImage(this.ruinsBuffer as any, -offset2, 0);
    if (offset2 > this.bufferWidth - W) {
      ctx.drawImage(this.ruinsBuffer as any, this.bufferWidth - offset2, 0);
    }

    // 4. Layer 3: Foreground Stilt Details (1.0x scroll)
    const factor3 = 1.0;
    const offset3 = Math.floor((cameraX * factor3) % this.bufferWidth);
    ctx.drawImage(this.foregroundBuffer as any, -offset3, 0);
    if (offset3 > this.bufferWidth - W) {
      ctx.drawImage(this.foregroundBuffer as any, this.bufferWidth - offset3, 0);
    }
  }
}
