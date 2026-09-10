import { describe, it, expect, beforeEach } from 'vitest';
import {
  PALETTES,
  hexToRgba,
  rgbaToString,
} from '../../src/render/sprites/Palette';
import {
  ProceduralSpriteFactory,
  createCanvasBuffer,
} from '../../src/render/sprites/ProceduralSpriteFactory';

describe('Milestone M3: Cute Sprites & Pastel Palette Hardening Suite', () => {
  let factory: ProceduralSpriteFactory;

  beforeEach(() => {
    factory = ProceduralSpriteFactory.getInstance();
  });

  // =========================================================================
  // 1. Pastel Palette Hex-to-RGBA Conversions & Color Invariants
  // =========================================================================
  describe('1. Pastel Palette Hex-to-RGBA Conversions & Color Invariants', () => {
    it('verifies hexToRgba accurately parses 6-digit hex, 3-digit hex, and transparency', () => {
      // 6-digit standard hex
      const coralPink = hexToRgba('#FF6B81', 1.0);
      expect(coralPink).toEqual([255, 107, 129, 255]);

      // Alpha clamping and scaling [0, 1] -> [0, 255]
      const halfAlpha = hexToRgba('#FF6B81', 0.5);
      expect(halfAlpha[0]).toBe(255);
      expect(halfAlpha[1]).toBe(107);
      expect(halfAlpha[2]).toBe(129);
      expect(halfAlpha[3]).toBe(128);

      const zeroAlpha = hexToRgba('#55E6C1', 0);
      expect(zeroAlpha).toEqual([85, 230, 193, 0]);

      // 3-digit shorthand hex (#RGB -> #RRGGBB)
      const shorthand = hexToRgba('#FFF', 1.0);
      expect(shorthand).toEqual([255, 255, 255, 255]);

      const shortBlack = hexToRgba('#000', 1.0);
      expect(shortBlack).toEqual([0, 0, 0, 255]);

      // Transparent string or empty string
      expect(hexToRgba('transparent')).toEqual([0, 0, 0, 0]);
      expect(hexToRgba('')).toEqual([0, 0, 0, 0]);
    });

    it('verifies rgbaToString produces valid CSS rgba formatted strings', () => {
      expect(rgbaToString(255, 107, 129, 1)).toBe('rgba(255, 107, 129, 1)');
      expect(rgbaToString(85, 230, 193, 0.75)).toBe('rgba(85, 230, 193, 0.75)');
      expect(rgbaToString(0, 0, 0, 0)).toBe('rgba(0, 0, 0, 0)');
    });

    it('verifies all 8 pastel palettes contain exactly 16 color entries with valid formats', () => {
      const paletteNames: Array<keyof typeof PALETTES> = [
        'PLAYER',
        'REBEL',
        'POW',
        'FIRE',
        'VEHICLE',
        'FORTRESS',
        'HUD',
        'TERRAIN',
      ];

      for (const name of paletteNames) {
        const pal = PALETTES[name];
        expect(pal).toBeDefined();
        expect(pal).toHaveLength(16);

        // Index 0 must always be 'transparent'
        expect(pal[0]).toBe('transparent');

        // Indices 1-15 must be valid hexadecimal colors
        for (let i = 1; i < 16; i++) {
          const color = pal[i];
          expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);

          const [r, g, b, a] = hexToRgba(color);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(255);
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(255);
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(255);
          expect(a).toBe(255);
        }
      }
    });

    it('verifies pastel color brightness and aesthetic contrast for player and HUD palettes', () => {
      // Chibi Hero skin tone and blonde hair must have high luminance (> 200)
      const skinRgba = hexToRgba(PALETTES.PLAYER[6]); // #FFF0E6
      const skinLuma = 0.299 * skinRgba[0] + 0.587 * skinRgba[1] + 0.114 * skinRgba[2];
      expect(skinLuma).toBeGreaterThan(200);

      const hairRgba = hexToRgba(PALETTES.PLAYER[2]); // #FFEAA7
      const hairLuma = 0.299 * hairRgba[0] + 0.587 * hairRgba[1] + 0.114 * hairRgba[2];
      expect(hairLuma).toBeGreaterThan(200);

      // Hero outline #3D2631 must provide soft warm contrast against white cream shirt #FFFFFF
      const outlineRgba = hexToRgba(PALETTES.PLAYER[1]);
      const shirtRgba = hexToRgba(PALETTES.PLAYER[9]);
      const deltaR = Math.abs(shirtRgba[0] - outlineRgba[0]);
      const deltaG = Math.abs(shirtRgba[1] - outlineRgba[1]);
      expect(deltaR + deltaG).toBeGreaterThan(200);
    });
  });

  // =========================================================================
  // 2. 164 Baseline Sprite Invariant Guard
  // =========================================================================
  describe('2. Canonical 164 Baseline Sprite Keys Invariant Guard', () => {
    it('preserves exactly 164 canonical baseline sprite keys when polish and expansion flags are false', () => {
      const baselineKeys = factory.getAllKeys(false, false);
      const baselineCount = factory.count(false, false);

      expect(baselineCount).toBe(164);
      expect(baselineKeys.length).toBe(164);

      // Zero key collisions
      const uniqueKeys = new Set(baselineKeys);
      expect(uniqueKeys.size).toBe(164);

      // Verify baseline core categories exist
      expect(baselineKeys).toContain('player_idle_0');
      expect(baselineKeys).toContain('player_run_0');
      expect(baselineKeys).toContain('player_jump_rise');
      expect(baselineKeys).toContain('player_jump_fall');
      expect(baselineKeys).toContain('rebel_rifle_idle');
      expect(baselineKeys).toContain('soldier_rifle_idle');
      expect(baselineKeys).toContain('pow_tied_0');
      expect(baselineKeys).toContain('proj_bullet_handgun');
      expect(baselineKeys).toContain('iron_technical_hull');
      expect(baselineKeys).toContain('hud_badge_pistol');
      expect(baselineKeys).toContain('hud_icon_grenade');
    });

    it('ensures cute expansion sprites are segregated into expansion registry without polluting baseline 164 count', () => {
      const baselineKeys = factory.getAllKeys(false, false);
      const cuteSpriteKeys = [
        'cute_marshmallow_slime',
        'cute_honey_bee',
        'cute_donut_roller',
        'cute_gummy_colossus',
        'cute_gummy_cub',
      ];

      for (const key of cuteSpriteKeys) {
        expect(baselineKeys).not.toContain(key);
      }

      // But when includeExpansion is true, they are present
      const allExpansionKeys = factory.getAllKeys(true, true);
      for (const key of cuteSpriteKeys) {
        expect(allExpansionKeys).toContain(key);
        expect(factory.hasSprite(key)).toBe(true);
      }
      expect(allExpansionKeys.length).toBeGreaterThan(164);
    });
  });

  // =========================================================================
  // 3. Procedural Rendering of Cute Expansion Sprites
  // =========================================================================
  describe('3. Procedural Rendering & Dimensions of Cute Expansion Sprites', () => {
    const cuteSprites = [
      { key: 'cute_marshmallow_slime', expectedWidth: 28, expectedHeight: 24, anchorX: 14, anchorY: 20 },
      { key: 'cute_honey_bee', expectedWidth: 28, expectedHeight: 24, anchorX: 14, anchorY: 12 },
      { key: 'cute_donut_roller', expectedWidth: 28, expectedHeight: 28, anchorX: 14, anchorY: 14 },
      { key: 'cute_gummy_colossus', expectedWidth: 80, expectedHeight: 90, anchorX: 40, anchorY: 80 },
      { key: 'cute_gummy_cub', expectedWidth: 26, expectedHeight: 30, anchorX: 13, anchorY: 24 },
    ];

    for (const spec of cuteSprites) {
      it(`verifies ${spec.key} has valid frame geometry (${spec.expectedWidth}x${spec.expectedHeight}) and anchor (${spec.anchorX}, ${spec.anchorY})`, () => {
        const frame = factory.getSprite(spec.key);
        expect(frame).toBeDefined();
        if (!frame) return;

        expect(frame.width).toBe(spec.expectedWidth);
        expect(frame.height).toBe(spec.expectedHeight);
        expect(frame.anchorX).toBe(spec.anchorX);
        expect(frame.anchorY).toBe(spec.anchorY);
        expect(frame.canvas).toBeDefined();
        expect(frame.canvas.width).toBe(spec.expectedWidth);
        expect(frame.canvas.height).toBe(spec.expectedHeight);
      });
    }

    it('successfully draws all cute expansion sprites to target canvas context with transformations', () => {
      const targetBuffer = createCanvasBuffer(200, 200);
      const ctx = targetBuffer.getContext('2d');
      expect(ctx).not.toBeNull();
      if (!ctx) return;

      for (const spec of cuteSprites) {
        // Standard draw
        const drawSuccess1 = factory.drawSprite(ctx, spec.key, 100, 100);
        expect(drawSuccess1).toBe(true);

        // Flipped and scaled draw
        const drawSuccess2 = factory.drawSprite(ctx, spec.key, 100, 100, {
          flipX: true,
          flipY: false,
          rotation: 0.25,
          scale: 1.5,
          alpha: 0.9,
        });
        expect(drawSuccess2).toBe(true);
      }

      // Drawing non-existent key returns false safely
      const nonexistentSuccess = factory.drawSprite(ctx, 'non_existent_key_xyz', 100, 100);
      expect(nonexistentSuccess).toBe(false);
    });

    it('verifies chibi hero sprites render with adorable proportions and valid anchors', () => {
      const heroKey = 'player_idle_0';
      const frame = factory.getSprite(heroKey);
      expect(frame).toBeDefined();
      if (!frame) return;

      expect(frame.width).toBe(36);
      expect(frame.height).toBe(42);
      expect(frame.anchorX).toBe(18);
      expect(frame.anchorY).toBe(40);
    });
  });
});
