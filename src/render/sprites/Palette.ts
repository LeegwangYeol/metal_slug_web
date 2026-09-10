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
 * Vibrant, Joyful Pastel 16-Color Indexed Palettes & Color Utilities.
 * Whimsical fairytale and candy-themed color ramps for procedural pixel-art rasterization.
 */
export const PALETTES = {
  // Chibi Hero / Sweet Adventurer Palette
  PLAYER: [
    'transparent', // 0: Transparent
    '#3D2631',     // 1: Warm mocha berry outline (softer than harsh black)
    '#FFEAA7',     // 2: Buttercup blonde / pastel golden fleece
    '#FDCB6E',     // 3: Warm honey shadow
    '#FF6B81',     // 4: Coral pink heart ribbon / headband
    '#EE5253',     // 5: Rose ribbon shadow
    '#FFF0E6',     // 6: Porcelain warm skin tone
    '#FFB8B8',     // 7: Rosy cheek blush / peach midtone
    '#D98880',     // 8: Warm berry shadow
    '#FFFFFF',     // 9: Pure marshmallow cream shirt
    '#E2D5F8',     // 10: Lavender cloud shade
    '#55E6C1',     // 11: Pastel mint turquoise adventurer tunic
    '#1B9CFC',     // 12: Sky blue tunic shadow
    '#D980FA',     // 13: Lavender cream shorts
    '#9980FA',     // 14: Berry plum shorts shadow
    '#574B90',     // 15: Shiny chocolate button shoes
  ],

  // Bouncy Fluffy Foes / Pastel Marchers Palette
  REBEL: [
    'transparent', // 0: Transparent
    '#2C2D5B',     // 1: Soft midnight plum outline
    '#74B9FF',     // 2: Sky blue fluffy cap / macaron shell
    '#0984E3',     // 3: Cap shadow
    '#FFF5EB',     // 4: Creamy dough body
    '#FDCB6E',     // 5: Warm dough shadow
    '#A8E6CF',     // 6: Pastel mint jelly uniform
    '#55E6C1',     // 7: Mint shadow
    '#25CCF7',     // 8: Crease accent
    '#D6A2E8',     // 9: Pastel lilac trim
    '#82589F',     // 10: Lilac shadow
    '#FD7272',     // 11: Heart emblem pink
    '#FF9FF3',     // 12: Cotton candy pink cheeks
    '#F8EFBA',     // 13: Butter cookie buckle
    '#6D214F',     // 14: Petite gumdrop shoes
    '#FFFFFF',     // 15: Big sparkling eye catchlights
  ],

  // Adorable Forest Pals / Trapped Bunny Palette
  POW: [
    'transparent', // 0: Transparent
    '#3B2219',     // 1: Warm chocolate outline
    '#FFFDF0',     // 2: Fluffy white bunny fur
    '#E8DFD8',     // 3: Soft fur shadow
    '#FFE0E6',     // 4: Sweet pink inner ears & paw pads
    '#FF9AA2',     // 5: Rosy blushing cheeks
    '#B5EAD7',     // 6: Pastel mint shorts / bow tie
    '#70A1FF',     // 7: Sky blue satin ribbon binding
    '#FFB7B2',     // 8: Strawberry gift crate
    '#FFDAC1',     // 9: Peach ribbon trim
    '#FFFFFF',     // 10: Sparkling anime eye twinkle
    '#FF69B4',     // 11: Pink heart nose
    '#FF4757',     // 12: Strawberry fruit gift
    '#FED330',     // 13: Golden star sparkle
    '#2ED573',     // 14: Cheerful green leaf sprig
    '#2F3542',     // 15: Soft eye pupil
  ],

  // Magic Stardust, Sweet Cotton Candy & Sugar Sparks
  FIRE: [
    'transparent', // 0: Transparent
    '#FFFFFF',     // 1: Blinding white starburst core
    '#FFF3B0',     // 2: Pastel lemon sugar glow
    '#FFD3B6',     // 3: Peach confection midtone
    '#FFAAA6',     // 4: Strawberry pink flare
    '#FF8B94',     // 5: Cotton candy magenta
    '#D4A5A5',     // 6: Dreamy lavender ember
    '#F0E6F6',     // 7: Soft pastel cloud puff
    '#D7C8E8',     // 8: Lavender mist
    '#B8A7D9',     // 9: Twilight lilac dust
    '#A8E6CF',     // 10: Rainbow sparkle cyan
    '#FF85A2',     // 11: Bubblegum pop pink
    '#FFE494',     // 12: Shimmering gold stardust
    '#C7ECEE',     // 13: Soft candy sugar crystal
    '#E056FD',     // 14: Radiant magic violet
    '#686DE0',     // 15: Twilight starlight
  ],

  // Whimsical Confectionery Wagon (Mid-Boss)
  VEHICLE: [
    'transparent', // 0: Transparent
    '#2C1A1D',     // 1: Dark chocolate outline
    '#FFCAD4',     // 2: Strawberry macaron chassis
    '#FFE5EC',     // 3: Sweet cream highlight
    '#F4ACB7',     // 4: Strawberry shadow
    '#4A3728',     // 5: Chocolate wafer tread dark
    '#7D5A38',     // 6: Chocolate cookie tread link
    '#9D8189',     // 7: Frosted wheel rim
    '#FFF0F5',     // 8: Sugar icing bead
    '#D8E2DC',     // 9: Mint cream turret
    '#FF6B6B',     // 10: Cherry red cannon nozzle
    '#FFE66D',     // 11: Butter cookie trim
    '#48DBFB',     // 12: Bubblegum siren lamp
    '#FF9FF3',     // 13: Sparkling puff exhaust
    '#54A0FF',     // 14: Pastel cyan candy stripes
    '#1E1215',     // 15: Deep chocolate crevice
  ],

  // Grand Sugar Citadel (Stage 1 End-Boss)
  FORTRESS: [
    'transparent', // 0: Transparent
    '#251A2E',     // 1: Sugar plum outline
    '#DDA0DD',     // 2: Pastel plum citadel hull
    '#F8E8F8',     // 3: Vanilla frosting highlight
    '#BA68C8',     // 4: Plum battlements shadow
    '#6A1B9A',     // 5: Recessed seam
    '#FFD54F',     // 6: Honey waffle trim
    '#FF8A80',     // 7: Strawberry swirl stripes
    '#4DD0E1',     // 8: Glowing heart crystal cyan
    '#E0F7FA',     // 9: Heart crystal diamond peak
    '#FF4081',     // 10: Magic rainbow laser aura
    '#FFFFFF',     // 11: Pure white starbeam core
    '#CE93D8',     // 12: Lilac cake layer
    '#FF1744',     // 13: Overheating sweet strawberry syrup
    '#FFB74D',     // 14: Sugar candy cane piping
    '#1A0028',     // 15: Deep royal violet shadow
  ],

  // Sweet Storybook HUD
  HUD: [
    'transparent', // 0: Transparent
    '#3D2631',     // 1: Soft berry outline
    '#FFD700',     // 2: Shiny gold star border
    '#F39C12',     // 3: Warm honey shadow
    '#48DBFB',     // 4: Bubblegum cyan HMG badge
    '#FF6B81',     // 5: Strawberry pink Flame badge
    '#FFFFFF',     // 6: Crisp milk white text
    '#FFEAA7',     // 7: Bubbly honey-gold score digit
    '#FDCB6E',     // 8: Honey digit shadow
    '#2ED573',     // 9: Sweet mint green badge
    '#10AC84',     // 10: Mint shadow
    '#FF4757',     // 11: Sweet boss HP strawberry red
    '#C0392B',     // 12: Berry syrup shade
    '#2ED573',     // 13: Hero heart green
    '#FFA502',     // 14: Orange bonbon warning
    '#2F3542',     // 15: Frame soft charcoal
  ],

  // Enchanted Fairytale Meadow & Sweets Terrain
  TERRAIN: [
    'transparent', // 0: Transparent
    '#2D1F1D',     // 1: Warm earth outline
    '#FFF1E6',     // 2: Frosted cream ground surface
    '#FDE2E4',     // 3: Strawberry shortcake sand
    '#E2ECE9',     // 4: Pastel mint sponge strata
    '#DFCCF1',     // 5: Lavender biscuit rock base
    '#FFCAD4',     // 6: Candy cane stilt pink
    '#FFFFFF',     // 7: Candy cane stilt white stripe
    '#DDA15E',     // 8: Crisp waffle deck planks
    '#BC6C25',     // 9: Waffle grid shadow
    '#7BDCB5',     // 10: Velvet mint grass crest
    '#55E6C1',     // 11: Lush meadow flower stalk
    '#F8EDEB',     // 12: Marshmallow cushion white
    '#FCD5CE',     // 13: Marshmallow pink puff
    '#48CAE4',     // 14: Sparkling azure soda sea
    '#0096C7',     // 15: Deep crystal ocean
  ],
} as const;
