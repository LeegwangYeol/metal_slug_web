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
  // LAYER 0: FAIRYTALE SUNRISE SKY & RAINBOW
  // ==========================================
  private renderSkyBase(): void {
    const ctx = this.skyBuffer.getContext('2d');
    if (!ctx) return;

    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // Fairytale Sunrise Meadow Sky Gradient (Pastel Rose -> Soft Peach -> Buttercream -> Baby Blue)
    const skyBands = [
      { y: 0, h: 65, col: '#C8B6E2' },    // Soft twilight lavender
      { y: 65, h: 65, col: '#E8D3F3' },   // Pastel lilac mist
      { y: 130, h: 65, col: '#FFD1DC' },  // Cotton candy rose
      { y: 195, h: 60, col: '#FFE4E1' },  // Misty peach blossom
      { y: 255, h: 60, col: '#FFF0F5' },  // Soft lavender blush
      { y: 315, h: 65, col: '#FFF9D2' },  // Morning sunshine yellow
      { y: 380, h: 75, col: '#E0F7FA' },  // Crystal turquoise breeze
      { y: 455, h: 85, col: '#D4F1F4' },  // Meadow horizon glow
    ];

    for (const band of skyBands) {
      ctx.fillStyle = band.col;
      ctx.fillRect(0, band.y, W, band.h);
    }

    // Gentle Pastel Rainbow Arc curving across the morning sky
    const rainbowBands = [
      { r: 420, c: 'rgba(255, 159, 243, 0.45)', w: 7 }, // Pastel Pink
      { r: 413, c: 'rgba(254, 202, 87, 0.45)', w: 7 },  // Pastel Orange/Gold
      { r: 406, c: 'rgba(255, 250, 101, 0.45)', w: 7 }, // Pastel Yellow
      { r: 399, c: 'rgba(29, 209, 161, 0.45)', w: 7 },  // Pastel Mint
      { r: 392, c: 'rgba(84, 160, 255, 0.45)', w: 7 },  // Pastel Sky Blue
      { r: 385, c: 'rgba(155, 89, 182, 0.45)', w: 7 },  // Pastel Lavender
    ];
    for (const rb of rainbowBands) {
      ctx.strokeStyle = rb.c;
      ctx.lineWidth = rb.w;
      ctx.beginPath();
      ctx.arc(280, 520, rb.r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }

    // Radiant Smiling Cartoon Sun & Warm Sunbeam Aura
    const sunX = 760;
    const sunY = 220;

    // Soft outer warm corona
    ctx.fillStyle = 'rgba(255, 245, 180, 0.2)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();

    // Inner glowing halo
    ctx.fillStyle = 'rgba(255, 235, 140, 0.4)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();

    // Brilliant golden sun disc
    ctx.fillStyle = '#FFF275';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
    ctx.fill();

    // Cute smiling cartoon sun face!
    // Anime eyes with catchlights
    ctx.fillStyle = '#4A2E50';
    ctx.beginPath(); ctx.arc(sunX - 14, sunY - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunX + 14, sunY - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sunX - 16, sunY - 7, 3, 3);
    ctx.fillRect(sunX + 12, sunY - 7, 3, 3);

    // Cheerful rosy cheeks
    ctx.fillStyle = '#FF9FF3';
    ctx.beginPath(); ctx.arc(sunX - 22, sunY + 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunX + 22, sunY + 8, 7, 0, Math.PI * 2); ctx.fill();

    // Smiling curved mouth
    ctx.strokeStyle = '#4A2E50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sunX, sunY + 6, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  private drawDynamicClouds(ctx: CanvasContext2DLike, time: number): void {
    const W = ParallaxBackground.VIEWPORT_WIDTH;

    // 3 Cloud drift tracks with varying wind speeds & cheerful soft shapes
    const cloudTracks = [
      { y: 55, speed: 7, scale: 1.5, color: '#FFFFFF', shade: '#E8D8F8', type: 'bunny' },
      { y: 120, speed: 12, scale: 2.0, color: '#FFFFFF', shade: '#FFE3EC', type: 'heart' },
      { y: 190, speed: 16, scale: 2.3, color: '#FFFDF5', shade: '#E2F0D9', type: 'cumulus' },
    ];

    for (const track of cloudTracks) {
      const offsetX = (time * track.speed) % (W + 360);
      for (let base = -160; base < W + 360; base += 340) {
        const cx = (base + offsetX) % (W + 360) - 120;
        const cy = track.y;
        const s = track.scale;

        if (track.type === 'bunny') {
          // Whimsical Fluffy Bunny Cloud!
          ctx.fillStyle = track.shade;
          ctx.beginPath();
          ctx.arc(cx, cy + 3 * s, 14 * s, 0, Math.PI * 2);
          ctx.arc(cx - 8 * s, cy - 10 * s, 6 * s, 0, Math.PI * 2);
          ctx.arc(cx + 8 * s, cy - 10 * s, 6 * s, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = track.color;
          ctx.beginPath();
          ctx.arc(cx, cy, 14 * s, 0, Math.PI * 2);
          ctx.arc(cx - 8 * s, cy - 12 * s, 5 * s, 0, Math.PI * 2);
          ctx.arc(cx + 8 * s, cy - 12 * s, 5 * s, 0, Math.PI * 2);
          ctx.arc(cx - 14 * s, cy + 2 * s, 9 * s, 0, Math.PI * 2);
          ctx.arc(cx + 14 * s, cy + 2 * s, 9 * s, 0, Math.PI * 2);
          ctx.fill();
        } else if (track.type === 'heart') {
          // Whimsical Fluffy Heart Cloud (formed purely with overlapping soft arcs)!
          ctx.fillStyle = track.shade;
          ctx.beginPath();
          ctx.arc(cx - 7 * s, cy - 2 * s, 9 * s, 0, Math.PI * 2);
          ctx.arc(cx + 7 * s, cy - 2 * s, 9 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 4 * s, 9 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 9 * s, 6 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 13 * s, 3 * s, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = track.color;
          ctx.beginPath();
          ctx.arc(cx - 7 * s, cy - 4 * s, 8 * s, 0, Math.PI * 2);
          ctx.arc(cx + 7 * s, cy - 4 * s, 8 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 2 * s, 8 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 7 * s, 5 * s, 0, Math.PI * 2);
          ctx.arc(cx, cy + 11 * s, 2 * s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Plump marshmallow cloud
          ctx.fillStyle = track.shade;
          ctx.beginPath();
          ctx.arc(cx, cy + 4 * s, 16 * s, 0, Math.PI * 2);
          ctx.arc(cx + 18 * s, cy + 6 * s, 13 * s, 0, Math.PI * 2);
          ctx.arc(cx - 18 * s, cy + 6 * s, 13 * s, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = track.color;
          ctx.beginPath();
          ctx.arc(cx, cy, 15 * s, 0, Math.PI * 2);
          ctx.arc(cx + 16 * s, cy + 2 * s, 12 * s, 0, Math.PI * 2);
          ctx.arc(cx - 16 * s, cy + 2 * s, 12 * s, 0, Math.PI * 2);
          ctx.arc(cx + 8 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
          ctx.arc(cx - 8 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ===================================================
  // LAYER 1: FAIRYTALE MOUNTAINS & SUGAR CASTLES (0.2x)
  // ===================================================
  private renderMountains(): void {
    const ctx = this.mountainsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // 1. Primary Far Ridge: Pastel Lavender & Lilac Mountain Peaks
    ctx.fillStyle = '#9C78B8';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(0, 310);

    for (let x = 0; x <= W; x += 40) {
      const h1 = Math.sin(x * 0.008) * 55;
      const h2 = Math.cos(x * 0.022) * 28;
      const y = 285 + h1 + h2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 540);
    ctx.closePath();
    ctx.fill();

    // 2. Secondary Near Ridge: Soft Mint & Sugar Candy Rolling Hills
    ctx.fillStyle = '#81C784';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(0, 360);

    for (let x = 0; x <= W; x += 50) {
      const h = Math.sin(x * 0.012 + 1.2) * 38 + Math.sin(x * 0.028) * 18;
      ctx.lineTo(x, 345 + h);
    }
    ctx.lineTo(W, 540);
    ctx.closePath();
    ctx.fill();

    // Sunlit Hill Crest Highlights (Pastel Buttercream Grass)
    ctx.fillStyle = '#A5D6A7';
    for (let x = 0; x <= W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 365);
      ctx.lineTo(x + 40, 345);
      ctx.lineTo(x + 70, 370);
      ctx.closePath();
      ctx.fill();
    }

    // Fairytale Sugar Castles & Waffle Spires on the distant peaks
    for (let x = 140; x < W; x += 380) {
      // Castle central tower
      ctx.fillStyle = '#F3E8FF';
      ctx.fillRect(x + 35, 275, 30, 70);
      // Side turrets
      ctx.fillRect(x + 15, 295, 18, 50);
      ctx.fillRect(x + 67, 295, 18, 50);

      // Conical waffle-cone roofs in pastel pink
      ctx.fillStyle = '#F472B6';
      // Center roof
      ctx.beginPath();
      ctx.moveTo(x + 50, 240);
      ctx.lineTo(x + 30, 275);
      ctx.lineTo(x + 70, 275);
      ctx.closePath();
      ctx.fill();
      // Left turret roof
      ctx.beginPath();
      ctx.moveTo(x + 24, 265);
      ctx.lineTo(x + 10, 295);
      ctx.lineTo(x + 38, 295);
      ctx.closePath();
      ctx.fill();
      // Right turret roof
      ctx.beginPath();
      ctx.moveTo(x + 76, 265);
      ctx.lineTo(x + 62, 295);
      ctx.lineTo(x + 90, 295);
      ctx.closePath();
      ctx.fill();

      // Golden star flag topper
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(x + 49, 235, 2, 7);
      ctx.beginPath();
      ctx.arc(x + 50, 235, 3, 0, Math.PI * 2);
      ctx.fill();

      // Stained glass glowing arched windows
      ctx.fillStyle = '#67E8F9';
      ctx.fillRect(x + 45, 290, 10, 12);
      ctx.beginPath(); ctx.arc(x + 50, 290, 5, Math.PI, 0); ctx.fill();
    }
  }

  // ========================================================
  // LAYER 2: MIDGROUND LOLLIPOP TREES & FAIRY COTTAGES (0.5x)
  // ========================================================
  private renderRuins(): void {
    const ctx = this.ruinsBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Midground grassy rolling meadow base
    ctx.fillStyle = '#48BB78';
    ctx.fillRect(0, 408, W, 132);
    ctx.fillStyle = '#38A169';
    ctx.fillRect(0, 428, W, 112);

    // Warm pastel daisy meadow trim along ridge
    ctx.fillStyle = '#9AE6B4';
    ctx.fillRect(0, 405, W, 4);

    // Whimsical items: Lollipop Trees, Giant Daisies, Gingerbread Fairy Cottages
    for (let x = 60; x < W; x += 240) {
      const variant = Math.floor(x / 240) % 3;

      if (variant === 0) {
        // Fairytale Gingerbread Cottage with Frosted Scalloped Roof
        ctx.fillStyle = '#8D5B4C'; // Warm gingerbread walls
        ctx.fillRect(x + 8, 350, 84, 58);

        // Frosted strawberry icing roof
        ctx.fillStyle = '#F472B6';
        ctx.beginPath();
        ctx.moveTo(x + 50, 318);
        ctx.lineTo(x + 2, 354);
        ctx.lineTo(x + 98, 354);
        ctx.closePath();
        ctx.fill();

        // White scalloped sugar trim on eaves
        ctx.fillStyle = '#FFFFFF';
        for (let rx = x + 6; rx < x + 96; rx += 10) {
          ctx.beginPath();
          ctx.arc(rx, 354, 4, 0, Math.PI);
          ctx.fill();
        }

        // Smiling round window
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(x + 32, 372, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 31, 365, 2, 14);
        ctx.fillRect(x + 25, 371, 14, 2);

        // Candy door
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + 58, 368, 18, 40);
        ctx.fillStyle = '#FED7AA';
        ctx.beginPath(); ctx.arc(x + 62, 388, 2, 0, Math.PI * 2); ctx.fill();

        // White picket garden fence
        ctx.fillStyle = '#FFFFFF';
        for (let fx = x - 15; fx < x + 120; fx += 14) {
          ctx.fillRect(fx, 396, 4, 14);
          ctx.beginPath();
          ctx.moveTo(fx, 396);
          ctx.lineTo(fx + 2, 392);
          ctx.lineTo(fx + 4, 396);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillRect(x - 15, 400, 135, 3);
      } else if (variant === 1) {
        // Whimsical Giant Lollipop Tree (Caramel trunk & spinning pinwheel top)
        const trunkX = x + 35;
        // Striped candy cane trunk
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(trunkX, 325, 10, 85);
        ctx.fillStyle = '#FB7185';
        for (let ty = 328; ty < 405; ty += 12) {
          ctx.fillRect(trunkX, ty, 10, 5);
        }

        // Giant Swirling Lollipop Head
        const headY = 320;
        const headR = 30;
        // Outer candy rim
        ctx.fillStyle = '#F472B6';
        ctx.beginPath(); ctx.arc(trunkX + 5, headY, headR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF7ED';
        ctx.beginPath(); ctx.arc(trunkX + 5, headY, headR - 5, 0, Math.PI * 2); ctx.fill();

        // Pinwheel swirls
        const candyColors = ['#F472B6', '#38BDF8', '#FDE047', '#4ADE80'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = candyColors[i];
          ctx.beginPath();
          ctx.moveTo(trunkX + 5, headY);
          ctx.arc(trunkX + 5, headY, headR - 6, (i * Math.PI) / 2, ((i + 0.5) * Math.PI) / 2);
          ctx.closePath();
          ctx.fill();
        }
        // Center cherry drop
        ctx.fillStyle = '#FB7185';
        ctx.beginPath(); ctx.arc(trunkX + 5, headY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(trunkX + 3, headY - 3, 2, 2);

        // Charming blooming daisies at trunk base
        for (let dx = -18; dx <= 24; dx += 14) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(trunkX + dx, 405, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FDE047';
          ctx.beginPath(); ctx.arc(trunkX + dx, 405, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // Giant Blooming Sunflower / Fantasy Blossom with smiling face
        const flowerX = x + 35;
        // Slender green flower stem
        ctx.fillStyle = '#48BB78';
        ctx.fillRect(flowerX, 335, 8, 75);
        // Green leaves
        ctx.beginPath();
        ctx.arc(flowerX - 8, 368, 12, 0, Math.PI * 2);
        ctx.arc(flowerX + 16, 360, 12, 0, Math.PI * 2);
        ctx.fill();

        // Flower Petals (Radiant Golden Honey & Coral)
        for (let p = 0; p < 8; p++) {
          const ang = (p * Math.PI) / 4;
          const px = flowerX + 4 + Math.cos(ang) * 18;
          const py = 330 + Math.sin(ang) * 18;
          ctx.fillStyle = p % 2 === 0 ? '#FDE047' : '#FB923C';
          ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        }

        // Flower center disk with cute smiling face
        ctx.fillStyle = '#8B5E3C';
        ctx.beginPath(); ctx.arc(flowerX + 4, 330, 14, 0, Math.PI * 2); ctx.fill();
        // Anime smile on flower
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(flowerX, 325, 2, 3);
        ctx.fillRect(flowerX + 6, 325, 2, 3);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(flowerX + 4, 332, 4, 0, Math.PI);
        ctx.stroke();
      }
    }
  }

  // =========================================================================
  // LAYER 3: FOREGROUND TURQUOISE LAGOON & CONFECTIONERY STILTS (1.0x)
  // =========================================================================
  private renderForegroundDetails(): void {
    const ctx = this.foregroundBuffer.getContext('2d');
    if (!ctx) return;

    const W = this.bufferWidth;

    // Sparkling turquoise lagoon, peppermint pier stilts, and water blossoms
    for (let x = 0; x < W; x += 120) {
      // Candy cane pier stilt
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 45, 438, 14, 102);
      ctx.fillStyle = '#FB7185';
      for (let sy = 442; sy < 535; sy += 14) {
        ctx.fillRect(x + 45, sy, 14, 6);
      }

      // Chocolate wafer horizontal crossbeam
      ctx.fillStyle = '#7C4A2D';
      ctx.fillRect(x, 464, 120, 8);
      ctx.fillStyle = '#A0633C';
      ctx.fillRect(x, 465, 120, 3);

      // Sugar frosting dripping from crossbeam
      ctx.fillStyle = '#FFFFFF';
      for (let fx = x + 6; fx < x + 118; fx += 16) {
        ctx.beginPath();
        ctx.arc(fx, 472, 4, 0, Math.PI);
        ctx.fill();
      }

      // Sparkling turquoise lagoon water below dock
      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(x, 492, 120, 48);
      ctx.fillStyle = '#0891B2';
      ctx.fillRect(x, 508, 120, 32);
      ctx.fillStyle = '#0E7490';
      ctx.fillRect(x, 524, 120, 16);

      // Sparkling white water ripples & sugar sparkles
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(x + 10, 494, 55, 3);
      ctx.fillRect(x + 72, 510, 42, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 22, 495, 8, 2);
      ctx.fillRect(x + 85, 511, 8, 2);

      // Floating Pink Water Lily Blossom
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath(); ctx.arc(x + 95, 493, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F472B6';
      ctx.beginPath(); ctx.arc(x + 95, 492, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FDE047';
      ctx.beginPath(); ctx.arc(x + 95, 492, 1.5, 0, Math.PI * 2); ctx.fill();
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
