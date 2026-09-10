/**
 * 4-Layer Parallax Background Engine.
 * Layer 0: Desert sky gradient with drifting cumulus clouds (0.0x scroll factor).
 * Layer 1: Distant mountain peaks & ancient desert ruins (0.2x scroll factor).
 * Layer 2: Midground war ruins, palm trees & bunkers (0.5x scroll factor).
 * Layer 3: Foreground coastal combat surface & scaffolding (1.0x scroll factor).
 * Pre-renders seamless repeating buffers for high-performance 60fps rendering.
 */

import { CanvasBuffer, CanvasContext2DLike, createCanvasBuffer } from './sprites/ProceduralSpriteFactory';

export interface ParallaxLayerConfig {
  scrollFactorX: number;
  scrollFactorY: number;
  bufferWidth: number;
  bufferHeight: number;
  yOffset: number;
}

export class ParallaxBackground {
  public static readonly VIEWPORT_WIDTH = 960;
  public static readonly VIEWPORT_HEIGHT = 540;

  // Layer 0: Sky buffer (static width 960, procedural animated clouds)
  private skyBuffer: CanvasBuffer;

  // Layer 1: Distant mountains & golden dunes (seamless width 1920)
  private mountainsBuffer: CanvasBuffer;

  // Layer 2: Midground fortress structures & tropical palms (seamless width 1920)
  private ruinsBuffer: CanvasBuffer;

  // Layer 3: Foreground turquoise ocean & wooden pier stilts (seamless width 1920)
  private foregroundBuffer: CanvasBuffer;

  private bufferWidth: number = 1920;

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
  // LAYER 0: SUNNY AZURE SKY BASE & CLOUDS
  // ==========================================
  private renderSkyBase(): void {
    const ctx = this.skyBuffer.getContext('2d');
    if (!ctx) return;

    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // Charming Sunny Coastal Arcade Sky (Radiant Azure -> Cyan Breeze -> Golden Dawn Sands)
    const skyBands = [
      { y: 0, h: 70, col: '#1B6CA8' },   // Deep radiant azure
      { y: 70, h: 65, col: '#2980B9' },  // Bright tropical sky
      { y: 135, h: 65, col: '#3498DB' }, // Sunny cerulean
      { y: 200, h: 60, col: '#5DADE2' }, // Sky cyan
      { y: 260, h: 60, col: '#85C1E9' }, // Light azure mist
      { y: 320, h: 60, col: '#AED6F1' }, // Coastal breeze tint
      { y: 380, h: 75, col: '#F9E79F' }, // Warm golden morning glow
      { y: 455, h: 85, col: '#FDEBD0' }, // Sandy beach horizon
    ];

    for (const band of skyBands) {
      ctx.fillStyle = band.col;
      ctx.fillRect(0, band.y, W, band.h);
    }

    // Radiant Golden Morning Sun & Warm Sunbeam Aura
    const sunX = 740;
    const sunY = 240;

    // Outer soft corona
    ctx.fillStyle = 'rgba(255, 245, 180, 0.15)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();

    // Inner glowing halo
    ctx.fillStyle = 'rgba(255, 235, 140, 0.35)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();

    // Brilliant golden sun disc
    ctx.fillStyle = '#FFF9D2';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDynamicClouds(ctx: CanvasContext2DLike, time: number): void {
    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // 3 Cloud drift tracks with varying wind speeds & cheerful soft shading
    const cloudTracks = [
      { y: 60, speed: 8, scale: 1.6, color: '#FFFFFF', shade: '#D4E6F1' },
      { y: 130, speed: 14, scale: 2.1, color: '#FFFFFF', shade: '#C8DEF0' },
      { y: 200, speed: 18, scale: 2.5, color: '#FEF9E7', shade: '#E5E8D8' },
    ];

    for (const track of cloudTracks) {
      const offsetX = (time * track.speed) % (W + 300);
      for (let base = -150; base < W + 300; base += 320) {
        const cx = (base + offsetX) % (W + 300) - 100;
        const cy = track.y;
        const s = track.scale;

        // Cloud shadow base
        ctx.fillStyle = track.shade;
        ctx.beginPath();
        ctx.arc(cx, cy + 5 * s, 16 * s, 0, Math.PI * 2);
        ctx.arc(cx + 18 * s, cy + 7 * s, 14 * s, 0, Math.PI * 2);
        ctx.arc(cx - 18 * s, cy + 7 * s, 14 * s, 0, Math.PI * 2);
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

  // ===================================================
  // LAYER 1: DISTANT MOUNTAINS & GOLDEN DUNES (0.2x)
  // ===================================================
  private renderMountains(): void {
    const ctx = this.mountainsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Distant jagged mountain ridges & warm golden coastal dunes
    // 1. Primary Far Ridge (Tropical Cobalt Mountain Haze)
    ctx.fillStyle = '#24587A';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(0, 320);

    for (let x = 0; x <= W; x += 40) {
      const h1 = Math.sin(x * 0.008) * 55;
      const h2 = Math.cos(x * 0.022) * 28;
      const y = 290 + h1 + h2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 540);
    ctx.closePath();
    ctx.fill();

    // 2. Secondary Near Ridge (Warm Golden Coastal Sand Dunes)
    ctx.fillStyle = '#C08A3E';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(0, 365);

    for (let x = 0; x <= W; x += 50) {
      const h = Math.sin(x * 0.012 + 1.2) * 40 + Math.sin(x * 0.028) * 20;
      ctx.lineTo(x, 350 + h);
    }
    ctx.lineTo(W, 540);
    ctx.closePath();
    ctx.fill();

    // Sunlit Dune Ridge Highlights
    ctx.fillStyle = '#E5B869';
    for (let x = 0; x <= W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 370);
      ctx.lineTo(x + 40, 350);
      ctx.lineTo(x + 70, 375);
      ctx.closePath();
      ctx.fill();
    }

    // Desert plateaus / ancient coastal obelisks & pyramid monoliths
    ctx.fillStyle = '#9C6F2D';
    for (let x = 120; x < W; x += 360) {
      ctx.beginPath();
      ctx.moveTo(x, 390);
      ctx.lineTo(x + 30, 310);
      ctx.lineTo(x + 75, 310);
      ctx.lineTo(x + 105, 390);
      ctx.closePath();
      ctx.fill();

      // Sunlit monolith facet
      ctx.fillStyle = '#D4AC0D';
      ctx.beginPath();
      ctx.moveTo(x + 50, 310);
      ctx.lineTo(x + 75, 310);
      ctx.lineTo(x + 105, 390);
      ctx.lineTo(x + 70, 390);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9C6F2D';
    }
  }

  // ========================================================
  // LAYER 2: MIDGROUND TROPICAL PALMS & WAR BUNKERS (0.5x)
  // ========================================================
  private renderRuins(): void {
    const ctx = this.ruinsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Midground terrain ground line
    ctx.fillStyle = '#4A5568';
    ctx.fillRect(0, 410, W, 130);
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, 430, W, 110);

    // Warm golden sand trim along ridge
    ctx.fillStyle = '#D4AC0D';
    ctx.fillRect(0, 408, W, 3);

    // Concrete bunkers, pillboxes, tropical coconut palms, radio towers
    for (let x = 60; x < W; x += 240) {
      const variant = Math.floor(x / 240) % 3;

      if (variant === 0) {
        // Concrete fortified pillbox with sandbag redoubt
        ctx.fillStyle = '#374151';
        ctx.fillRect(x, 360, 90, 52);
        ctx.fillStyle = '#4B5563';
        ctx.fillRect(x + 4, 364, 82, 16);
        // Visor slit
        ctx.fillStyle = '#111827';
        ctx.fillRect(x + 16, 370, 58, 7);

        // Golden sandbags in front
        ctx.fillStyle = '#D4AC0D';
        for (let bx = x - 10; bx < x + 100; bx += 20) {
          ctx.fillRect(bx, 400, 18, 10);
          ctx.fillRect(bx + 6, 392, 18, 10);
        }
      } else if (variant === 1) {
        // Charming Tropical Coconut Palm Tree with lush emerald fronds
        const trunkX = x + 30;
        ctx.fillStyle = '#784212'; // Curved trunk
        ctx.fillRect(trunkX, 330, 10, 82);
        ctx.fillStyle = '#935116';
        ctx.fillRect(trunkX + 2, 330, 5, 82);

        // Coconuts hanging in clusters
        ctx.fillStyle = '#512E0F';
        ctx.beginPath();
        ctx.arc(trunkX + 2, 332, 4, 0, Math.PI * 2);
        ctx.arc(trunkX + 8, 333, 4, 0, Math.PI * 2);
        ctx.fill();

        // Lush Emerald Green Palm Fronds (swaying in ocean breeze)
        ctx.fillStyle = '#27AE60';
        ctx.beginPath();
        ctx.moveTo(trunkX + 5, 330);
        ctx.lineTo(trunkX - 45, 360);
        ctx.lineTo(trunkX - 25, 342);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(trunkX + 5, 330);
        ctx.lineTo(trunkX + 55, 360);
        ctx.lineTo(trunkX + 30, 342);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#2ECC71'; // Bright top fronds
        ctx.beginPath();
        ctx.moveTo(trunkX + 5, 330);
        ctx.lineTo(trunkX - 40, 320);
        ctx.lineTo(trunkX - 15, 318);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(trunkX + 5, 330);
        ctx.lineTo(trunkX + 50, 320);
        ctx.lineTo(trunkX + 20, 318);
        ctx.closePath();
        ctx.fill();

        // Wooden fence
        ctx.fillStyle = '#5A4228';
        ctx.fillRect(x - 30, 395, 6, 26);
        ctx.fillRect(x + 75, 395, 6, 26);
        ctx.fillStyle = '#9CA3AF';
        ctx.fillRect(x - 30, 400, 110, 2);
        ctx.fillRect(x - 30, 410, 110, 2);
      } else {
        // Steel communication antenna & radar dish with bright red beacon
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(x + 28, 305, 6, 107);
        ctx.fillRect(x + 16, 340, 30, 3);
        ctx.fillRect(x + 22, 325, 18, 3);
        // Radar dish
        ctx.fillStyle = '#4B5563';
        ctx.beginPath();
        ctx.arc(x + 31, 310, 12, Math.PI * 0.8, Math.PI * 1.8);
        ctx.stroke();
        // Red flashing beacon light
        ctx.fillStyle = '#FF3333';
        ctx.fillRect(x + 29, 300, 4, 6);
        ctx.fillStyle = '#FFAAAA';
        ctx.fillRect(x + 30, 301, 2, 2);
      }
    }
  }

  // =========================================================================
  // LAYER 3: FOREGROUND TURQUOISE OCEAN & WOODEN PIER STILTS (1.0x)
  // =========================================================================
  private renderForegroundDetails(): void {
    const ctx = this.foregroundBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Coastal dock stilts, pier pilings, and turquoise ocean with white foam crests
    for (let x = 0; x < W; x += 120) {
      // Wooden pier stilt
      ctx.fillStyle = '#854D0E';
      ctx.fillRect(x + 45, 440, 12, 100);
      ctx.fillStyle = '#B7791F';
      ctx.fillRect(x + 48, 440, 6, 100);

      // Horizontal brace beam
      ctx.fillStyle = '#854D0E';
      ctx.fillRect(x, 465, 120, 7);
      ctx.fillStyle = '#A16207';
      ctx.fillRect(x, 466, 120, 3);

      // Deep turquoise ocean water below dock
      ctx.fillStyle = '#0E7490';
      ctx.fillRect(x, 495, 120, 45);
      ctx.fillStyle = '#0891B2';
      ctx.fillRect(x, 510, 120, 30);
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(x, 525, 120, 15);

      // Sparkling white sea foam ripples & wave crests
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 15, 496, 60, 3);
      ctx.fillRect(x + 70, 512, 45, 2);
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(x + 25, 499, 40, 2);
    }
  }

  /**
   * Renders the complete 4-layer composite parallax background with modular horizontal wrapping.
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

    // Modular horizontal wrapping helper: ensures seamless tiling across arbitrary viewport widths
    const renderTiledLayer = (buffer: CanvasBuffer, factor: number) => {
      const offset = ((cameraX * factor) % this.bufferWidth + this.bufferWidth) % this.bufferWidth;
      let drawX = -Math.floor(offset);
      while (drawX < W) {
        ctx.drawImage(buffer as any, drawX, 0);
        drawX += this.bufferWidth;
      }
    };

    // 2. Layer 1: Distant Mountains & Golden Dunes (0.2x scroll)
    renderTiledLayer(this.mountainsBuffer, 0.2);

    // 3. Layer 2: Midground Ruins & Tropical Palms (0.5x scroll)
    renderTiledLayer(this.ruinsBuffer, 0.5);

    // 4. Layer 3: Foreground Stilt Details & Turquoise Waters (1.0x scroll)
    renderTiledLayer(this.foregroundBuffer, 1.0);
  }
}
