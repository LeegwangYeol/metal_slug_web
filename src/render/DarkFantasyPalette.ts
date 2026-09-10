/**
 * Dark Fantasy Gothic Color Palette & Zero-Garbage Color Utilities.
 * Milestone M2 (Dark Fantasy Art & Gothic Render Engine)
 */

export const ABYSSAL_VOID = {
  DEEP: '#08060c',
  MID: '#0f0d1a',
  SLATE: '#171326',
} as const;

export const NECROTIC_EMERALD = {
  DARK: '#0d3824',
  CORE: '#19633e',
  BRIGHT: '#28a745',
  GLOW: '#68d391',
} as const;

export const BLOOD_CRIMSON = {
  DRIED: '#380a0a',
  COAGULATED: '#6b1212',
  VIVID: '#a81d1d',
  FLASH: '#e53e3e',
} as const;

export const BONE_IVORY = {
  SHADOW: '#2a2624',
  WEATHERED: '#615852',
  BLEACHED: '#b8aea5',
  POLISHED: '#ede5de',
} as const;

export const CURSED_ARCANE = {
  DEEP: '#1a0c2e',
  SHADOW: '#3c1b6b',
  VIOLET: '#7038b8',
  AURA: '#b794f6',
} as const;

export const PALETTE = {
  ABYSSAL_VOID,
  NECROTIC_EMERALD,
  BLOOD_CRIMSON,
  BONE_IVORY,
  CURSED_ARCANE,
} as const;

export const SEMANTIC_COLORS = {
  backgroundClear: ABYSSAL_VOID.DEEP,
  floorMortar: ABYSSAL_VOID.MID,
  floorFlagstoneBase: BONE_IVORY.SHADOW,
  floorFlagstoneHighlight: BONE_IVORY.WEATHERED,
  bloodMoonCorona: BLOOD_CRIMSON.FLASH,
  bloodMoonInnerGlow: BLOOD_CRIMSON.VIVID,
  bloodMoonEclipseCore: ABYSSAL_VOID.DEEP,
  stormCloudDark: ABYSSAL_VOID.MID,
  stormCloudPurple: CURSED_ARCANE.DEEP,
  graveyardSkyline: ABYSSAL_VOID.SLATE,
  tombstoneBody: ABYSSAL_VOID.MID,
  tombstoneHighlight: BONE_IVORY.WEATHERED,
  tombstoneRune: CURSED_ARCANE.VIOLET,
  deadTreeBark: ABYSSAL_VOID.MID,
  deadTreeMoss: NECROTIC_EMERALD.DARK,
  runicCircleActive: CURSED_ARCANE.AURA,
  runicCircleBase: CURSED_ARCANE.VIOLET,
  groundMistDense: ABYSSAL_VOID.SLATE,
  groundMistLight: CURSED_ARCANE.DEEP,
  // Entities & VFX
  playerRobes: CURSED_ARCANE.SHADOW,
  playerStaffGlow: CURSED_ARCANE.AURA,
  skeletonBone: BONE_IVORY.POLISHED,
  ghoulBile: NECROTIC_EMERALD.BRIGHT,
  bansheeEthereal: CURSED_ARCANE.AURA,
  deathKnightArmor: ABYSSAL_VOID.SLATE,
  // HUD
  hudVitalityBlood: BLOOD_CRIMSON.VIVID,
  hudVitalityGlow: BLOOD_CRIMSON.FLASH,
  hudXpFill: NECROTIC_EMERALD.GLOW,
  hudTextPrimary: BONE_IVORY.POLISHED,
  hudTextMuted: BONE_IVORY.BLEACHED,
  hudBorderIron: ABYSSAL_VOID.SLATE,
} as const;

export const PRECOMPUTED_TRANSLUCENCIES = {
  lunarGlowOuter: 'rgba(56, 10, 10, 0.25)',
  lunarGlowMid: 'rgba(168, 29, 29, 0.40)',
  lunarCorona: 'rgba(229, 62, 62, 0.85)',
  stormCloudSoft: 'rgba(26, 12, 46, 0.35)',
  stormCloudDeep: 'rgba(15, 13, 26, 0.50)',
  mistBase: 'rgba(23, 19, 38, 0.28)',
  mistUpper: 'rgba(15, 13, 26, 0.18)',
  runicGlow: 'rgba(183, 148, 246, 0.45)',
  runicCore: 'rgba(112, 56, 184, 0.70)',
} as const;

const rgbaCache = new Map<string, string>();

export function hexToRgba(hex: string, alpha: number): string {
  const roundedAlpha = Math.round(alpha * 100) / 100;
  const key = `${hex}_${roundedAlpha}`;
  let cached = rgbaCache.get(key);
  if (cached) return cached;

  let r = 0, g = 0, b = 0;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  }

  cached = `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
  rgbaCache.set(key, cached);
  return cached;
}
