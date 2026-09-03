/**
 * Neo Geo / Metal Slug 16-Color Indexed Palettes & Color Utilities.
 * Authentic retro arcade color ramps designed for procedural pixel-art rasterization.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Converts a hex color string ('#RRGGBB' or '#RGB') to [r, g, b, a].
 */
export function hexToRgba(hex: string, alpha: number = 1.0): [number, number, number, number] {
  if (hex === 'transparent' || !hex) {
    return [0, 0, 0, 0];
  }

  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);

  return [r, g, b, a];
}

/**
 * Formats RGBA components into CSS rgba string.
 */
export function rgbaToString(r: number, g: number, b: number, a: number = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Authentic 16-color Neo Geo arcade palettes for Metal Slug assets.
 */
export const PALETTES = {
  // Marco Rossi / Player Soldier Palette
  PLAYER: [
    'transparent', // 0: Transparent background
    '#201818',     // 1: Dark outline
    '#FCE071',     // 2: Blonde hair highlight
    '#C49828',     // 3: Blonde hair shadow
    '#D82800',     // 4: Headband red
    '#881400',     // 5: Headband dark shadow
    '#FFCC99',     // 6: Skin highlight
    '#E09860',     // 7: Skin midtone
    '#905030',     // 8: Skin shadow
    '#F8F8F8',     // 9: Shirt white
    '#B0B8C0',     // 10: Shirt shade
    '#738A44',     // 11: Olive vest
    '#445824',     // 12: Olive vest shadow
    '#A88850',     // 13: Khaki pants
    '#685028',     // 14: Khaki pants shadow
    '#302018',     // 15: Boot leather / gun metal
  ],

  // Rebel Infantry Palette (General Morden's Regular Army)
  REBEL: [
    'transparent', // 0: Transparent
    '#181818',     // 1: Outline
    '#606870',     // 2: Helmet grey
    '#384048',     // 3: Helmet shadow
    '#E0A070',     // 4: Skin tone
    '#985830',     // 5: Skin shadow
    '#587838',     // 6: Uniform green
    '#385020',     // 7: Uniform green shadow
    '#203010',     // 8: Uniform dark crease
    '#808890',     // 9: Metal buckle / rifle barrel
    '#485058',     // 10: Rifle receiver
    '#603818',     // 11: Rifle wooden stock
    '#C82818',     // 12: Rebel armband red
    '#D8C890',     // 13: Ammo belt brass
    '#302820',     // 14: Combat boots
    '#E8F0F8',     // 15: Eye white / teeth
  ],

  // Hostage POW (Prisoner of War) Palette
  POW: [
    'transparent', // 0: Transparent
    '#201818',     // 1: Outline
    '#F8E060',     // 2: Long beard/hair bright
    '#C8A820',     // 3: Beard shadow
    '#F0B070',     // 4: Skin tone
    '#B06838',     // 5: Skin sunburn
    '#3868B8',     // 6: Blue ragged shorts
    '#183878',     // 7: Shorts shadow
    '#D0A870',     // 8: Rope binding
    '#906838',     // 9: Rope shadow
    '#FFFFFF',     // 10: Sparkle / teeth
    '#805020',     // 11: Dirty bandage
    '#E84020',     // 12: Gift box red
    '#F8C830',     // 13: Gift box ribbon gold
    '#40A030',     // 14: Saluting arm sleeve
    '#202020',     // 15: Deep crease
  ],

  // Fire, Flame Shot & Explosions Palette
  FIRE: [
    'transparent', // 0: Transparent
    '#FFFFFF',     // 1: Pure white core
    '#FFF060',     // 2: Intense yellow
    '#FFA010',     // 3: Bright orange
    '#E84800',     // 4: Fiery red
    '#981800',     // 5: Dark crimson
    '#581808',     // 6: Charred ember
    '#787878',     // 7: Light smoke
    '#484848',     // 8: Medium smoke
    '#181818',     // 9: Heavy dark smoke
    '#FF7700',     // 10: Flame stream accent
    '#FF3300',     // 11: Flame edge
    '#FFE080',     // 12: Spark yellow
    '#303030',     // 13: Charcoal ash
    '#903000',     // 14: Secondary ember
    '#000000',     // 15: Black soot
  ],

  // Iron Technical / Rebel Vehicle Palette
  VEHICLE: [
    'transparent', // 0: Transparent
    '#161914',     // 1: Heavy armor outline
    '#4E5B31',     // 2: Olive chassis base
    '#6C7E44',     // 3: Chassis highlight
    '#2D361B',     // 4: Chassis deep shade
    '#1F1F1F',     // 5: Rubber tread dark
    '#424242',     // 6: Tread metal link
    '#6E727A',     // 7: Wheel rim / steel plate
    '#9AA0AB',     // 8: Rivet bright metal
    '#55633A',     // 9: Turret armor
    '#111111',     // 10: Autocannon bore / barrel shadow
    '#3D2614',     // 11: Rust / oil grease
    '#C42010',     // 12: Rebel insignias / alert lamp
    '#E67E22',     // 13: Exhaust backfire flame
    '#D4AC0D',     // 14: Warning stripes
    '#0A0A0A',     // 15: Deepest crevice
  ],

  // Stage 1 End-Boss: Tetsuyuki War Fortress Palette
  FORTRESS: [
    'transparent', // 0: Transparent
    '#151820',     // 1: Steel outline
    '#5A6577',     // 2: Camouflage steel hull
    '#7E8B9E',     // 3: Armor highlight
    '#343B47',     // 4: Armor shadow
    '#1D222A',     // 5: Recessed seam
    '#F5B82A',     // 6: Warning hazard yellow
    '#2B2B28',     // 7: Hazard dark stripe
    '#40E0D0',     // 8: Reactor core cyan glow
    '#E0FFFF',     // 9: Reactor core white-hot peak
    '#FF2222',     // 10: Heavy laser thermal red
    '#FFFFFF',     // 11: Laser white core
    '#54321A',     // 12: Battle damage rust
    '#8B0000',     // 13: Emergency overheating vent
    '#B87333',     // 14: Exposed hydraulic copper pipes
    '#0B0E14',     // 15: Deep void
  ],

  // Retro Arcade HUD Palette
  HUD: [
    'transparent', // 0: Transparent
    '#101010',     // 1: Border & drop shadow
    '#FFD700',     // 2: Badge gold border
    '#8B6508',     // 3: Badge dark gold shade
    '#3A7BD5',     // 4: HMG blue badge fill
    '#E53935',     // 5: Flame Shot red badge fill
    '#FFFFFF',     // 6: Font white text
    '#F1C40F',     // 7: Score digit primary gold
    '#B7950B',     // 8: Score digit bevel shade
    '#4CAF50',     // 9: Grenade olive green badge fill
    '#2E7D32',     // 10: Grenade dark green shade
    '#E74C3C',     // 11: Boss HP red
    '#C0392B',     // 12: Boss HP dark red
    '#2ECC71',     // 13: Player health green
    '#F39C12',     // 14: Ammo warning orange
    '#000000',     // 15: HUD frame solid black
  ],

  // Desert Beach & War Ruins Terrain Palette
  TERRAIN: [
    'transparent', // 0: Transparent
    '#1A1612',     // 1: Ground outline
    '#C29B62',     // 2: Desert beach sand light
    '#99733E',     // 3: Sand shadow
    '#584028',     // 4: Wet mud / trench earth
    '#383838',     // 5: Cracked concrete / asphalt
    '#687078',     // 6: Steel scaffold beam
    '#42484F',     // 7: Steel beam shadow
    '#7D5836',     // 8: Wooden dock planks
    '#4E331A',     // 9: Wood grain dark
    '#304020',     // 10: Palm leaf dark green
    '#556B2F',     // 11: Palm leaf olive
    '#8B8070',     // 12: Sandbag fabric
    '#5A5244',     // 13: Sandbag shadow
    '#2B4C6F',     // 14: Shoreline seawater reflection
    '#0E141C',     // 15: Ocean depth
  ],
} as const;
