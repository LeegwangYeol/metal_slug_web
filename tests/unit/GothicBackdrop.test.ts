import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GothicBackdrop } from '../../src/render/GothicBackdrop';
import { PALETTE } from '../../src/render/DarkFantasyPalette';

describe('GothicBackdrop Multi-Layer Parallax Engine (Milestone M2)', () => {
  let backdrop: GothicBackdrop;
  let mockCtx: any;

  beforeEach(() => {
    backdrop = new GothicBackdrop({
      viewportWidth: 960,
      viewportHeight: 540,
      enableParallax: true,
      enableMist: true,
      enableDynamicRunes: true,
    });

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1.0,
    };
  });

  describe('Configuration & Headless Initialization', () => {
    it('initializes with default options in headless Node.js without errors', () => {
      expect(backdrop.isInitialized).toBe(true);
      expect(backdrop.viewportWidth).toBe(960);
      expect(backdrop.viewportHeight).toBe(540);
      expect(backdrop.enableParallax).toBe(true);
      expect(backdrop.enableMist).toBe(true);
      expect(backdrop.enableDynamicRunes).toBe(true);
      expect(backdrop.flagstoneTileSize).toBe(512);
      expect(backdrop.graveyardCellSize).toBe(160);
    });

    it('accepts custom configuration overrides', () => {
      const custom = new GothicBackdrop({
        viewportWidth: 1280,
        viewportHeight: 720,
        enableParallax: false,
        enableMist: false,
        enableDynamicRunes: false,
        flagstoneTileSize: 256,
        graveyardCellSize: 120,
      });

      expect(custom.viewportWidth).toBe(1280);
      expect(custom.viewportHeight).toBe(720);
      expect(custom.enableParallax).toBe(false);
      expect(custom.enableMist).toBe(false);
      expect(custom.enableDynamicRunes).toBe(false);
      expect(custom.flagstoneTileSize).toBe(256);
      expect(custom.graveyardCellSize).toBe(120);
    });
  });

  describe('Headless Fallback Rendering', () => {
    it('renders deep space dark fallback fill when surfaces are null', () => {
      backdrop.render(mockCtx, 100, 200, 15.0);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillStyle).toBe(PALETTE.ABYSSAL_VOID.DEEP);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 960, 540);
    });

    it('handles renderForegroundMist without crashing when mist surface is null', () => {
      expect(() => {
        backdrop.renderForegroundMist(mockCtx, 100, 200, 15.0);
      }).not.toThrow();
    });
  });

  describe('Surfaced Multi-Layer Parallax Rendering', () => {
    beforeEach(() => {
      // Inject mock canvases to simulate browser offscreen pre-rendered surfaces
      const createMockCanvas = (w: number, h: number) => ({
        width: w,
        height: h,
      }) as any;

      backdrop.skyCanvas = createMockCanvas(1024, 540);
      backdrop.cloudCanvas = createMockCanvas(1920, 240);
      backdrop.skylineCanvas = createMockCanvas(1920, 160);
      backdrop.flagstoneCanvas = createMockCanvas(512, 512);
      backdrop.runeCanvas = createMockCanvas(256, 256);
      backdrop.propAtlasCanvas = createMockCanvas(512, 256);
      backdrop.mistCanvas = createMockCanvas(1024, 540);
    });

    it('draws all 7 parallax layers when surfaces are present', () => {
      backdrop.render(mockCtx, 500, 300, 10.0);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      // Total drawImage calls should cover sky, clouds, skyline, flagstones, runes, props, mist
      expect(mockCtx.drawImage).toHaveBeenCalled();
      expect(mockCtx.drawImage.mock.calls.length).toBeGreaterThan(10);
    });

    it('renders foreground mist pass with transparency', () => {
      backdrop.renderForegroundMist(mockCtx, 500, 300, 10.0);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalAlpha).toBe(0.10);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(backdrop.mistCanvas, expect.any(Number), expect.any(Number));
    });

    it('respects enableParallax = false toggle', () => {
      const noParallax = new GothicBackdrop({ enableParallax: false });
      noParallax.skyCanvas = backdrop.skyCanvas;
      noParallax.cloudCanvas = backdrop.cloudCanvas;
      noParallax.skylineCanvas = backdrop.skylineCanvas;

      noParallax.render(mockCtx, 500, 300, 10.0);

      // Cloud & Skyline should not be drawn if enableParallax is false
      const drawnCanvases = mockCtx.drawImage.mock.calls.map((call: any[]) => call[0]);
      expect(drawnCanvases).not.toContain(noParallax.cloudCanvas);
      expect(drawnCanvases).not.toContain(noParallax.skylineCanvas);
    });
  });

  describe('Deterministic Spatial Hash Integrity', () => {
    it('evaluates spatial hash deterministically for same camera position', () => {
      // Create mock canvas for props
      backdrop.propAtlasCanvas = { width: 512, height: 256 } as any;

      backdrop.render(mockCtx, 1000, 1000, 0);
      const firstCallCount = mockCtx.drawImage.mock.calls.length;

      mockCtx.drawImage.mockClear();

      backdrop.render(mockCtx, 1000, 1000, 0);
      const secondCallCount = mockCtx.drawImage.mock.calls.length;

      expect(firstCallCount).toBe(secondCallCount);
    });
  });
});
