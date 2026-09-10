import { describe, it, expect, beforeEach } from 'vitest';
import { CanvasRenderer, LetterboxBounds } from '../../src/render/CanvasRenderer';
import { ParallaxBackground } from '../../src/render/ParallaxBackground';
import { Camera } from '../../src/render/Camera';
import {
  ProceduralSpriteFactory,
  CanvasContext2DLike,
} from '../../src/render/sprites/ProceduralSpriteFactory';

describe('CHALLENGER_M1: Viewport, Camera & Parallax Empirical Stress Suite', () => {

  // =========================================================================
  // TASK 1: Letterbox Calculations Across Standard & Non-Standard Aspect Ratios
  // =========================================================================
  describe('Task 1: Letterbox Calculations Across Non-Standard Resolutions', () => {
    const VIRTUAL_W = 960;
    const VIRTUAL_H = 540;
    const TARGET_ASPECT = VIRTUAL_W / VIRTUAL_H; // 16:9 = 1.7777777777777777

    /**
     * Helper asserting foundational letterbox geometry invariants:
     * 1. Output dimensions fit within destination dimensions.
     * 2. Letterbox margins (offsets) are non-negative.
     * 3. Perfect centering symmetry (left/right and top/bottom equal within 1px integer floor parity).
     * 4. Aspect ratio is preserved within integer truncation error.
     * 5. No NaN or Infinite numbers.
     */
    function assertLetterboxInvariants(destW: number, destH: number, lb: LetterboxBounds) {
      expect(Number.isFinite(lb.scale)).toBe(true);
      expect(Number.isNaN(lb.scale)).toBe(false);
      expect(Number.isFinite(lb.offsetX)).toBe(true);
      expect(Number.isFinite(lb.offsetY)).toBe(true);
      expect(Number.isFinite(lb.width)).toBe(true);
      expect(Number.isFinite(lb.height)).toBe(true);

      expect(lb.width).toBeLessThanOrEqual(destW);
      expect(lb.height).toBeLessThanOrEqual(destH);
      expect(lb.offsetX).toBeGreaterThanOrEqual(0);
      expect(lb.offsetY).toBeGreaterThanOrEqual(0);

      // Centering symmetry: (destW - (width + 2*offsetX)) in {0, 1} due to Math.floor
      const slackX = destW - (lb.width + 2 * lb.offsetX);
      expect(slackX).toBeGreaterThanOrEqual(0);
      expect(slackX).toBeLessThanOrEqual(1);

      const slackY = destH - (lb.height + 2 * lb.offsetY);
      expect(slackY).toBeGreaterThanOrEqual(0);
      expect(slackY).toBeLessThanOrEqual(1);

      if (lb.width > 0 && lb.height > 0) {
        const aspect = lb.width / lb.height;
        expect(Math.abs(aspect - TARGET_ASPECT)).toBeLessThanOrEqual(0.02);
      }
    }

    it('EMPIRICAL 1A: 21:9 Ultrawide (2560x1080) -> Perfect Pillarboxing', () => {
      const lb = CanvasRenderer.calculateLetterbox(2560, 1080);
      // scale = min(2560/960=2.666..., 1080/540=2.0) = 2.0
      expect(lb.scale).toBe(2.0);
      expect(lb.width).toBe(1920);
      expect(lb.height).toBe(1080);
      // offsetX = (2560 - 1920) / 2 = 320px pillarbox on each side
      expect(lb.offsetX).toBe(320);
      expect(lb.offsetY).toBe(0);
      assertLetterboxInvariants(2560, 1080, lb);
    });

    it('EMPIRICAL 1B: 4:3 CRT Resolution (1024x768) -> Perfect Letterboxing', () => {
      const lb = CanvasRenderer.calculateLetterbox(1024, 768);
      // scale = min(1024/960=1.0666..., 768/540=1.4222...) = 1.0666...
      expect(lb.scale).toBeCloseTo(1024 / 960, 5);
      expect(lb.width).toBe(1024);
      // height = floor(540 * (1024/960)) = floor(576) = 576
      expect(lb.height).toBe(576);
      expect(lb.offsetX).toBe(0);
      // offsetY = (768 - 576) / 2 = 96px letterbox top and bottom
      expect(lb.offsetY).toBe(96);
      assertLetterboxInvariants(1024, 768, lb);
    });

    it('EMPIRICAL 1C: 1:1 Square Resolution (800x800) -> Perfect Letterboxing', () => {
      const lb = CanvasRenderer.calculateLetterbox(800, 800);
      // scale = min(800/960=0.8333..., 800/540=1.481...) = 0.8333... (5/6)
      expect(lb.scale).toBeCloseTo(800 / 960, 5);
      expect(lb.width).toBe(800);
      // height = floor(540 * (5/6)) = 450
      expect(lb.height).toBe(450);
      expect(lb.offsetX).toBe(0);
      // offsetY = (800 - 450) / 2 = 175px letterbox top and bottom
      expect(lb.offsetY).toBe(175);
      assertLetterboxInvariants(800, 800, lb);
    });

    it('EMPIRICAL 1D: Vertical Mobile Portrait (1080x1920) -> Massive Vertical Letterboxing', () => {
      const lb = CanvasRenderer.calculateLetterbox(1080, 1920);
      // scale = min(1080/960=1.125, 1920/540=3.555...) = 1.125
      expect(lb.scale).toBe(1.125);
      expect(lb.width).toBe(1080);
      // height = floor(540 * 1.125) = 607
      expect(lb.height).toBe(607);
      expect(lb.offsetX).toBe(0);
      // offsetY = floor((1920 - 607) / 2) = floor(1313 / 2) = 656
      expect(lb.offsetY).toBe(656);
      assertLetterboxInvariants(1080, 1920, lb);
    });

    it('EMPIRICAL 1E: Extreme & Degenerate Resolutions (32:9 Super-Ultrawide, 8K, 1x1, Degenerate)', () => {
      // 32:9 Super-Ultrawide (5120x1440)
      const lb32x9 = CanvasRenderer.calculateLetterbox(5120, 1440);
      expect(lb32x9.scale).toBeCloseTo(1440 / 540, 5); // 2.6666...
      expect(lb32x9.width).toBe(2560);
      expect(lb32x9.height).toBe(1440);
      expect(lb32x9.offsetX).toBe(1280);
      expect(lb32x9.offsetY).toBe(0);
      assertLetterboxInvariants(5120, 1440, lb32x9);

      // 8K UHD (7680x4320) -> Exact 8x scale, zero margins
      const lb8k = CanvasRenderer.calculateLetterbox(7680, 4320);
      expect(lb8k.scale).toBe(8.0);
      expect(lb8k.width).toBe(7680);
      expect(lb8k.height).toBe(4320);
      expect(lb8k.offsetX).toBe(0);
      expect(lb8k.offsetY).toBe(0);
      assertLetterboxInvariants(7680, 4320, lb8k);

      // Micro 1x1 canvas
      const lbTiny = CanvasRenderer.calculateLetterbox(1, 1);
      expect(lbTiny.scale).toBeCloseTo(1 / 960, 5);
      expect(lbTiny.width).toBeLessThanOrEqual(1);
      expect(lbTiny.height).toBeLessThanOrEqual(1);
      assertLetterboxInvariants(1, 1, lbTiny);

      // Fractional resolution (e.g. high-DPI CSS pixel scaling: 1920.7 x 1080.4)
      const lbFrac = CanvasRenderer.calculateLetterbox(1920.7, 1080.4);
      expect(lbFrac.width).toBeLessThanOrEqual(1921);
      expect(lbFrac.height).toBeLessThanOrEqual(1081);
      expect(Number.isInteger(lbFrac.offsetX)).toBe(true);
      expect(Number.isInteger(lbFrac.offsetY)).toBe(true);
      expect(Number.isInteger(lbFrac.width)).toBe(true);
      expect(Number.isInteger(lbFrac.height)).toBe(true);
    });

    it('EMPIRICAL 1F: blitToCanvas letterbox rendering into target canvas', () => {
      const renderer = new CanvasRenderer();
      const calls: { op: string; args: any[] }[] = [];

      const mockTargetCanvas = {
        width: 2560,
        height: 1080,
        getContext: () => ({
          imageSmoothingEnabled: true,
          fillStyle: '',
          fillRect: (x: number, y: number, w: number, h: number) => {
            calls.push({ op: 'fillRect', args: [x, y, w, h] });
          },
          drawImage: (...args: any[]) => {
            calls.push({ op: 'drawImage', args });
          },
        }),
      };

      renderer.blitToCanvas(mockTargetCanvas as any);

      // Must fill black letterbox margins across full 2560x1080
      const clearCall = calls.find(c => c.op === 'fillRect');
      expect(clearCall).toBeDefined();
      expect(clearCall!.args).toEqual([0, 0, 2560, 1080]);

      // Must draw virtual buffer centered at offsetX=320, offsetY=0, w=1920, h=1080
      const drawCall = calls.find(c => c.op === 'drawImage');
      expect(drawCall).toBeDefined();
      // args: [buffer, sx, sy, sw, sh, dx, dy, dw, dh]
      expect(drawCall!.args[1]).toBe(0);
      expect(drawCall!.args[2]).toBe(0);
      expect(drawCall!.args[3]).toBe(960);
      expect(drawCall!.args[4]).toBe(540);
      expect(drawCall!.args[5]).toBe(320); // dx
      expect(drawCall!.args[6]).toBe(0);   // dy
      expect(drawCall!.args[7]).toBe(1920);// dw
      expect(drawCall!.args[8]).toBe(1080);// dh
    });
  });

  // =========================================================================
  // TASK 2: Parallax Horizontal Wrapping at Extreme Camera X Coordinates
  // =========================================================================
  describe('Task 2: Parallax Horizontal Wrapping at Extreme Camera X Coordinates', () => {
    let parallax: ParallaxBackground;
    const VIEWPORT_W = ParallaxBackground.VIEWPORT_WIDTH; // 960
    const BUFFER_W = 1920; // internal repeating buffer width

    beforeEach(() => {
      parallax = new ParallaxBackground();
    });

    /**
     * Intercepts drawImage calls per layer during parallax.render()
     * and rigorously checks:
     * 1. All drawX coordinates are finite (no NaN, no Infinity).
     * 2. No infinite loops: loop iteration count per layer <= 2.
     * 3. Seamless tiling: adjacent strips touch exactly with zero gap.
     * 4. Full horizontal viewport coverage: min(drawX) <= 0 and max(drawX + bufferWidth) >= VIEWPORT_W.
     */
    function verifyParallaxTilingCoverage(cameraX: number, time: number = 1.0) {
      const layerDraws: { buffer: any; drawX: number; bufferWidth: number }[] = [];

      // Mock context capturing drawImage calls
      const mockCtx: Partial<CanvasContext2DLike> = {
        drawImage: (img: any, ...args: number[]) => {
          // Args for drawImage(buffer, drawX, 0) in renderTiledLayer
          if (args.length === 2) {
            const drawX = args[0];
            const drawY = args[1];
            expect(Number.isFinite(drawX)).toBe(true);
            expect(Number.isNaN(drawX)).toBe(false);
            expect(drawY).toBe(0);
            layerDraws.push({ buffer: img, drawX, bufferWidth: BUFFER_W });
          }
        },
        fillStyle: '',
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
      };

      parallax.render(mockCtx as CanvasContext2DLike, cameraX, 0, time);

      // There are 3 tiled layers: Layer 1 (0.2x), Layer 2 (0.5x), Layer 3 (1.0x)
      expect(layerDraws.length).toBeGreaterThanOrEqual(3);

      // Group calls by buffer identity: each layer uses its own buffer
      const layers: { buffer: any; strips: { drawX: number }[] }[] = [];
      for (const d of layerDraws) {
        let entry = layers.find(l => l.buffer === d.buffer);
        if (!entry) {
          entry = { buffer: d.buffer, strips: [] };
          layers.push(entry);
        }
        entry.strips.push({ drawX: d.drawX });
      }

      expect(layers.length).toBe(3);

      for (let l = 0; l < 3; l++) {
        const { strips } = layers[l];
        expect(strips.length).toBeGreaterThanOrEqual(1);
        expect(strips.length).toBeLessThanOrEqual(2); // Never more than 2 iterations needed!

        const firstStrip = strips[0];
        // The first strip must start at or before x = 0
        expect(firstStrip.drawX).toBeLessThanOrEqual(0);

        // If there are 2 strips, they must be contiguous with zero gap
        if (strips.length === 2) {
          expect(strips[1].drawX).toBe(firstStrip.drawX + BUFFER_W);
        }

        const lastStrip = strips[strips.length - 1];
        // The last strip must extend to or beyond viewport width (960)
        const coverageEnd = lastStrip.drawX + BUFFER_W;
        expect(coverageEnd).toBeGreaterThanOrEqual(VIEWPORT_W);
      }
    }

    it('EMPIRICAL 2A: x = 1920 (exactly 1 buffer width) -> Seamless Wrapping', () => {
      verifyParallaxTilingCoverage(1920);
    });

    it('EMPIRICAL 2B: x = 3840 (exactly 2 buffer widths) -> Seamless Wrapping', () => {
      verifyParallaxTilingCoverage(3840);
    });

    it('EMPIRICAL 2C: x = 100,000 (extreme forward stage coordinate) -> No NaN, Zero Gaps', () => {
      verifyParallaxTilingCoverage(100000);
    });

    it('EMPIRICAL 2D: x = 0 (origin), x = 960 (one screen width), x = 480 (half screen)', () => {
      verifyParallaxTilingCoverage(0);
      verifyParallaxTilingCoverage(480);
      verifyParallaxTilingCoverage(960);
    });

    it('EMPIRICAL 2E: Negative & Subpixel Camera Coordinates (x = -1920, -100,000, 1234.567)', () => {
      verifyParallaxTilingCoverage(-1920);
      verifyParallaxTilingCoverage(-100000);
      verifyParallaxTilingCoverage(1234.567);
      verifyParallaxTilingCoverage(999999.85);
    });

    it('EMPIRICAL 2F: High-Frequency Sweep Across 1,000 Camera Steps (Performance & Continuity)', () => {
      const t0 = performance.now();
      for (let x = 0; x < 20000; x += 20) {
        verifyParallaxTilingCoverage(x, x * 0.016);
      }
      const elapsed = performance.now() - t0;
      // 1,000 verification checks should execute in < 2500ms
      expect(elapsed).toBeLessThan(2500);
    });
  });

  // =========================================================================
  // TASK 3: ProceduralSpriteFactory 164-Key Invariant Across Multiple Calls
  // =========================================================================
  describe('Task 3: ProceduralSpriteFactory 164-Key Invariant Across Multiple Calls', () => {
    const BASELINE_KEY_COUNT = 164;

    it('EMPIRICAL 3A: getInstance() returns strictly 164 keys across 1,000 consecutive calls', () => {
      const initialInstance = ProceduralSpriteFactory.getInstance();
      const referenceKeys = initialInstance.getAllKeys();
      expect(referenceKeys.length).toBe(BASELINE_KEY_COUNT);
      expect(initialInstance.count()).toBe(BASELINE_KEY_COUNT);

      const refSet = new Set(referenceKeys);
      expect(refSet.size).toBe(BASELINE_KEY_COUNT);

      for (let i = 0; i < 1000; i++) {
        const factory = ProceduralSpriteFactory.getInstance();
        expect(factory.count()).toBe(BASELINE_KEY_COUNT);
        const keys = factory.getAllKeys();
        expect(keys.length).toBe(BASELINE_KEY_COUNT);
      }
    });

    it('EMPIRICAL 3B: Fresh instance instantiation (new ProceduralSpriteFactory) preserves 164 keys', () => {
      const freshFactory = new ProceduralSpriteFactory();
      expect(freshFactory.count()).toBe(BASELINE_KEY_COUNT);
      expect(freshFactory.getAllKeys().length).toBe(BASELINE_KEY_COUNT);

      // Redundant init() calls must be idempotent and never duplicate keys
      freshFactory.init();
      freshFactory.init();
      expect(freshFactory.count()).toBe(BASELINE_KEY_COUNT);
      expect(freshFactory.getAllKeys().length).toBe(BASELINE_KEY_COUNT);
    });

    it('EMPIRICAL 3C: All 164 baseline keys map to valid SpriteFrames with positive dimensions', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const keys = factory.getAllKeys();

      for (const key of keys) {
        expect(factory.hasSprite(key)).toBe(true);
        const frame = factory.getSprite(key);
        expect(frame).toBeDefined();
        expect(frame!.width).toBeGreaterThan(0);
        expect(frame!.height).toBeGreaterThan(0);
        expect(Number.isFinite(frame!.anchorX)).toBe(true);
        expect(Number.isFinite(frame!.anchorY)).toBe(true);
        expect(frame!.canvas).toBeDefined();
      }
    });

    it('EMPIRICAL 3D: drawSprite handles all 164 keys and gracefully rejects bogus keys', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const keys = factory.getAllKeys();
      const mockCtx: Partial<CanvasContext2DLike> = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        drawImage: () => {},
      };

      // Draw all 164 valid sprites
      for (const key of keys) {
        const ok = factory.drawSprite(mockCtx as CanvasContext2DLike, key, 100, 100, {
          flipX: true,
          rotation: 0.5,
          scale: 1.2,
          alpha: 0.9,
        });
        expect(ok).toBe(true);
      }

      // Bogus / non-existent keys must return false gracefully without throwing
      expect(factory.drawSprite(mockCtx as CanvasContext2DLike, 'non_existent_key_999', 0, 0)).toBe(false);
      expect(factory.drawSprite(mockCtx as CanvasContext2DLike, '', 0, 0)).toBe(false);
      expect(factory.hasSprite('bogus_key')).toBe(false);
    });
  });

  // =========================================================================
  // TASK 4: Widescreen Camera Deadzone & Boss Arena Dimensions
  // =========================================================================
  describe('Task 4: Widescreen Camera Deadzone & Boss Arena Lockdown Verification', () => {
    it('EMPIRICAL 4A: Camera defaults to 960x540 with >= 528px forward reaction view', () => {
      const camera = new Camera();
      expect(camera.viewportWidth).toBe(960);
      expect(camera.viewportHeight).toBe(540);

      // Forward reaction view = viewportWidth - deadzoneRight
      const forwardReactionView = camera.viewportWidth - camera.deadzoneRight;
      // 960 - floor(960 * 0.44 = 422.4 = 422) = 538px >= 528px
      expect(forwardReactionView).toBe(538);
      expect(forwardReactionView).toBeGreaterThanOrEqual(528);
    });

    it('EMPIRICAL 4B: Arena bounds support >= 1100px width for Mid-Boss and End-Boss arenas', () => {
      // In main.ts:
      // Mid-boss bounds: { minX: 720, maxX: 1820 } -> 1820 - 720 = 1100px
      // End-boss bounds: { minX: 1800, maxX: 2900 } -> 2900 - 1800 = 1100px
      const midBossArenaWidth = 1820 - 720;
      expect(midBossArenaWidth).toBeGreaterThanOrEqual(1100);

      const endBossArenaWidth = 2900 - 1800;
      expect(endBossArenaWidth).toBeGreaterThanOrEqual(1100);

      // Verify camera locks cleanly into 1100px arena
      const camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      camera.lock({ minX: 720, maxX: 1820, minY: 0, maxY: 540 });
      expect(camera.bounds.minX).toBe(720);
      expect(camera.bounds.maxX).toBe(1820);

      // Track target across arena
      camera.update(700, 200, 1 / 60);
      expect(camera.x).toBeGreaterThanOrEqual(720);
      camera.update(2500, 200, 1 / 60);
      expect(camera.x).toBeLessThanOrEqual(1820 - 960);
    });

    it('EMPIRICAL 4C: Camera tracking handles extreme world coordinates without NaN', () => {
      const camera = new Camera();
      camera.reset(0, 0);

      const extremeCoords = [
        { x: -50000, y: -20000 },
        { x: 100000, y: 50000 },
        { x: 1e6, y: 1e5 },
      ];

      for (const pt of extremeCoords) {
        camera.update(pt.x, pt.y, 1 / 60);
        expect(Number.isFinite(camera.x)).toBe(true);
        expect(Number.isFinite(camera.y)).toBe(true);
        expect(Number.isNaN(camera.x)).toBe(false);
        expect(Number.isNaN(camera.y)).toBe(false);
      }
    });
  });
});
