import { describe, it, expect } from 'vitest';
import {
  ABYSSAL_VOID,
  NECROTIC_EMERALD,
  BLOOD_CRIMSON,
  BONE_IVORY,
  CURSED_ARCANE,
  PALETTE,
  SEMANTIC_COLORS,
  PRECOMPUTED_TRANSLUCENCIES,
  hexToRgba,
} from '../../src/render/DarkFantasyPalette';

describe('DarkFantasyPalette (Milestone M2)', () => {
  describe('Color Families & Tokens', () => {
    it('contains all 5 authoritative gothic color families matching PROJECT.md', () => {
      // Abyssal Void
      expect(ABYSSAL_VOID.DEEP).toBe('#08060c');
      expect(ABYSSAL_VOID.MID).toBe('#0f0d1a');
      expect(ABYSSAL_VOID.SLATE).toBe('#171326');

      // Necrotic Emerald
      expect(NECROTIC_EMERALD.DARK).toBe('#0d3824');
      expect(NECROTIC_EMERALD.CORE).toBe('#19633e');
      expect(NECROTIC_EMERALD.BRIGHT).toBe('#28a745');
      expect(NECROTIC_EMERALD.GLOW).toBe('#68d391');

      // Blood Crimson
      expect(BLOOD_CRIMSON.DRIED).toBe('#380a0a');
      expect(BLOOD_CRIMSON.COAGULATED).toBe('#6b1212');
      expect(BLOOD_CRIMSON.VIVID).toBe('#a81d1d');
      expect(BLOOD_CRIMSON.FLASH).toBe('#e53e3e');

      // Bone Ivory
      expect(BONE_IVORY.SHADOW).toBe('#2a2624');
      expect(BONE_IVORY.WEATHERED).toBe('#615852');
      expect(BONE_IVORY.BLEACHED).toBe('#b8aea5');
      expect(BONE_IVORY.POLISHED).toBe('#ede5de');

      // Cursed Arcane
      expect(CURSED_ARCANE.DEEP).toBe('#1a0c2e');
      expect(CURSED_ARCANE.SHADOW).toBe('#3c1b6b');
      expect(CURSED_ARCANE.VIOLET).toBe('#7038b8');
      expect(CURSED_ARCANE.AURA).toBe('#b794f6');
    });

    it('exposes PALETTE grouping with frozen constants', () => {
      expect(PALETTE.ABYSSAL_VOID).toBe(ABYSSAL_VOID);
      expect(PALETTE.NECROTIC_EMERALD).toBe(NECROTIC_EMERALD);
      expect(PALETTE.BLOOD_CRIMSON).toBe(BLOOD_CRIMSON);
      expect(PALETTE.BONE_IVORY).toBe(BONE_IVORY);
      expect(PALETTE.CURSED_ARCANE).toBe(CURSED_ARCANE);
    });

    it('contains comprehensive semantic color tokens', () => {
      expect(SEMANTIC_COLORS.backgroundClear).toBe(ABYSSAL_VOID.DEEP);
      expect(SEMANTIC_COLORS.bloodMoonCorona).toBe(BLOOD_CRIMSON.FLASH);
      expect(SEMANTIC_COLORS.runicCircleActive).toBe(CURSED_ARCANE.AURA);
      expect(SEMANTIC_COLORS.hudVitalityBlood).toBe(BLOOD_CRIMSON.VIVID);
      expect(SEMANTIC_COLORS.hudXpFill).toBe(NECROTIC_EMERALD.GLOW);
    });

    it('defines precomputed static translucencies', () => {
      expect(PRECOMPUTED_TRANSLUCENCIES.lunarCorona).toBe('rgba(229, 62, 62, 0.85)');
      expect(PRECOMPUTED_TRANSLUCENCIES.runicGlow).toBe('rgba(183, 148, 246, 0.45)');
      expect(PRECOMPUTED_TRANSLUCENCIES.mistBase).toBe('rgba(23, 19, 38, 0.28)');
    });
  });

  describe('hexToRgba Conversion & Cache Memoization', () => {
    it('converts 6-digit hex strings to valid rgba strings', () => {
      expect(hexToRgba('#ffffff', 1.0)).toBe('rgba(255, 255, 255, 1)');
      expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
      expect(hexToRgba('#e53e3e', 0.85)).toBe('rgba(229, 62, 62, 0.85)');
    });

    it('converts 3-digit shorthand hex strings', () => {
      expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
      expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
    });

    it('memoizes identical conversions and returns identical string reference', () => {
      const res1 = hexToRgba('#7038b8', 0.75);
      const res2 = hexToRgba('#7038b8', 0.75);
      expect(res1).toBe(res2);
    });

    it('rounds alpha to 2 decimal places to prevent cache explosion', () => {
      const res1 = hexToRgba('#b794f6', 0.333333);
      const res2 = hexToRgba('#b794f6', 0.33);
      expect(res1).toBe(res2);
      expect(res1).toBe('rgba(183, 148, 246, 0.33)');
    });
  });
});
