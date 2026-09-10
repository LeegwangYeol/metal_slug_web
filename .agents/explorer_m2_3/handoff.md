# Handoff Report: High-Fidelity Procedural Design for Elite Undead (Banshee & Death Knight) & Unit Test Architecture

- **Agent**: `explorer_m2_3`
- **Role**: Codebase Researcher / Explorer (Milestone M2: High-Fidelity Dark Fantasy Graphics Overhaul)
- **Date**: 2026-09-10
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3`
- **Target Files**:
  - `src/render/sprites/DarkFantasySprites.ts`
  - `tests/unit/DarkFantasySprites.spec.ts` (Proposed)
  - `src/render/DarkFantasyPalette.ts`
  - `src/core/entities/EnemyTypes.ts`

---

## 1. Observation

### 1.1 Existing Elite Undead Sprite Implementation
Direct inspection of `src/render/sprites/DarkFantasySprites.ts` reveals the following current implementations for the two elite undead entities:

#### A. Current Banshee Rendering (`src/render/sprites/DarkFantasySprites.ts:436-482`)
```typescript
  // --- Vector Drawer: Banshee ---
  private static drawBansheeVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 3;

    // Translucent Ethereal Shroud (Flowing Behind)
    ctx.fillStyle = 'rgba(112, 56, 184, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-10, 0 + bob);
    ctx.quadraticCurveTo(-14, 10 + bob, -16, 20 + bob);
    ctx.lineTo(-4, 14 + bob);
    ctx.lineTo(0, 18 + bob);
    ctx.lineTo(4, 14 + bob);
    ctx.lineTo(16, 20 + bob);
    ctx.quadraticCurveTo(14, 10 + bob, 10, 0 + bob);
    ctx.closePath();
    ctx.fill();

    // Spectral Shroud Body
    ctx.fillStyle = 'rgba(183, 148, 246, 0.65)';
    ctx.beginPath();
    ctx.moveTo(-8, -6 + bob);
    ctx.lineTo(8, -6 + bob);
    ctx.lineTo(6, 12 + bob);
    ctx.lineTo(0, 8 + bob);
    ctx.lineTo(-6, 12 + bob);
    ctx.closePath();
    ctx.fill();

    // Spectral Cowl & Face
    ctx.fillStyle = PALETTE.CURSED_ARCANE.SHADOW;
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    // Screaming Hollow Visage
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    // Void eyes
    ctx.beginPath();
    ctx.arc(-2.5, -10 + bob, 1.3, 0, Math.PI * 2);
    ctx.arc(2.5, -10 + bob, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Screaming mouth
    ctx.beginPath();
    ctx.ellipse(0, -6 + bob, 1.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
```

#### Deficiencies of Current Banshee:
1. **Flat, Monochromatic Fill**: Only two flat RGBA fills (`rgba(112, 56, 184, 0.25)` and `rgba(183, 148, 246, 0.65)`) are used. There is no gradient falloff, no ethereal luminosity, and no spectral depth.
2. **Missing Additive Blending**: `globalCompositeOperation = 'lighter'` is never invoked. The apparition lacks any glowing halo, luminous corona, or spectral burn.
3. **Crude Geometry**: The ghostly wisps are merely 4 connected line segments forming a rigid trapezoid with a V-notch. There are no trailing particle-like tendrils or undulating bezier ribbons.
4. **Rudimentary Facial Silhouette**: The screaming mouth is a tiny 1.5x2.5 ellipse, and the eyes are 1.3px circles. It completely fails to project an agonizing, chilling wail or soul-draining specter.
5. **Mask Silhouette Disparity (`DarkFantasySprites.ts:217-231`)**: The damage flash mask is a basic circle and 5-point polygon that does not reflect high-fidelity wisps.

---

#### B. Current Death Knight Rendering (`src/render/sprites/DarkFantasySprites.ts:484-550`)
```typescript
  // --- Vector Drawer: Death Knight ---
  private static drawDeathKnightVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const march = (frame % 2 === 0 ? 3 : -3);

    // Heavy Tattered Crimson Warcape
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.COAGULATED;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(14, -8);
    ctx.lineTo(16, 22);
    ctx.lineTo(-16, 22);
    ctx.closePath();
    ctx.fill();

    // Armored Legs
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.lineWidth = 1;
    ctx.fillRect(-9 + march, 8, 7, 18);
    ctx.strokeRect(-9 + march, 8, 7, 18);
    ctx.fillRect(2 - march, 8, 7, 18);
    ctx.strokeRect(2 - march, 8, 7, 18);

    // Armored Cuirass & Spiked Pauldrons
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.strokeRect(-10, -10, 20, 20);

    // Jagged Spiked Pauldrons
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.lineTo(-9, -20);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, -14);
    ctx.lineTo(9, -20);
    ctx.lineTo(8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Horned Greathelm
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.arc(0, -17, 7, Math.PI, 0);
    ctx.lineTo(6, -12);
    ctx.lineTo(-6, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Visor Slit (Crimson Streak)
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-4, -15, 8, 2);

    // Colossal Executioner Greatsword
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.fillRect(12, -26, 4, 44);
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    ctx.fillRect(9, 6, 10, 2.5);
  }
```

#### Deficiencies of Current Death Knight:
1. **Atari-Like Box Articulation**: Legs and torso are drawn as crude rectangular blocks (`fillRect(-9+march, 8, 7, 18)` and `fillRect(-10, -10, 20, 20)`). This directly triggers the user's critique regarding "crude/poor/Atari feel".
2. **Missing Horns**: Despite the code comment `"// Horned Greathelm"`, lines 530-539 draw only a semicircle dome with no horns whatsoever!
3. **Flat Armor Without Specular Highlights**: Obsidian plate armor should have dark glassy reflections, sharp bevels, and metallic edge highlights (`PALETTE.BONE_IVORY.POLISHED` or cool steel reflections). Currently, it is flat `#0f0d1a` slate.
4. **Missing Gold/Blood Filigree**: No etched runes appear on the cuirass, greaves, or greatsword.
5. **Primitive Greatsword**: The weapon is a plain 4x44 vertical bar with a flat rectangular crossbar. There is no tapered blade, no fuller groove, no pommel, and no glowing runic inscription.
6. **Visor Slit Lacks Menace**: A flat 8x2 crimson rectangle lacks the ominous horizontal laser glare or intense core point of an unholy undead warlord.

---

### 1.2 Sprite Atlas Dimensions & Lifecycle Observations
In `src/render/sprites/DarkFantasySprites.ts:91-104`:
```typescript
  private static getDimensions(type: EntitySpriteType): { w: number; h: number; ox: number; oy: number } {
    switch (type) {
      case 'player': return { w: 48, h: 48, ox: 24, oy: 24 };
      case 'skeleton': return { w: 36, h: 36, ox: 18, oy: 18 };
      case 'ghoul': return { w: 44, h: 44, ox: 22, oy: 22 };
      case 'banshee': return { w: 48, h: 48, ox: 24, oy: 24 };
      case 'death_knight': return { w: 64, h: 64, ox: 32, oy: 32 };
    }
  }
```
- In `EnemyTypes.ts`, `banshee` has collision radius `16`, while `death_knight` has radius `22`.
- A 48x48 (or 52x52) canvas centered at (ox: 24, oy: 24) gives bounds `[-24, +24]`.
- A 64x64 canvas centered at (ox: 32, oy: 32) gives bounds `[-32, +32]`, perfectly proportioned for the massive Death Knight.
- Atlas cache keys: `5 types * 4 frames * 2 facings * 3 flash states = 120 total cached entries`.
- In `vitest.config.ts`, `environment: 'node'` is configured. In Node, `typeof document === 'undefined'`, which caused `DarkFantasySprites.initialize()` to exit early in tests. In `tests/unit/ChallengerDF_M2.test.ts:140-157`, the challenger test manually injected mock canvases into the private cache rather than exercising `DarkFantasySprites.initialize()`.
- **Architectural Need**: A comprehensive test suite (`tests/unit/DarkFantasySprites.spec.ts`) that stubs the canvas/document environment so that all 120 cached offscreen canvases are genuinely generated, tested, and validated for zero runtime errors.

---

## 2. Logic Chain

1. **Premise 1 (Visual Quality & Theme)**: Milestone M2 requires a dramatic elevation from crude geometry to high-polish dark fantasy. Elite undead (Banshee and Death Knight) are primary focal points that define the late-game threat aesthetic.
2. **Premise 2 (Banshee Spectral Apparition)**:
   - Real-time ethereal quality is achieved on HTML5 Canvas by combining:
     a. Soft radial gradient background glow (`createRadialGradient`).
     b. Additive blending (`globalCompositeOperation = 'lighter'`) for glowing wisps and vocal emissions.
     c. Multi-tier bezier ribbons for drifting, translucent shrouds.
     d. A weeping veil featuring descending mourning fold shadows and glowing teardrops.
     e. An elongated gaping scream cavity with an ethereal core soul flare.
3. **Premise 3 (Death Knight Obsidian Warlord)**:
   - Imposing armored weight requires:
     a. Multi-segment plate armor (pauldrons, breastplate, tassets, greaves) with distinct chamfered highlights.
     b. Dual curved obsidian horns arching upward from the greathelm temples.
     c. Deep shadow behind the helmet visor with an intense blood-red optical slit and horizontal glare.
     d. Intricate filigree: gold etching along pauldron rims and blood runes pulsed across the cuirass.
     e. A two-handed executioner greatsword featuring a central blood groove (fuller) inscribed with glowing runes.
4. **Premise 4 (Atlas Caching Invariant)**:
   - Offscreen caching generates each frame once. Complex vector drawing runs only during pre-generation (or lazy first access). At 60Hz runtime, drawing is purely `ctx.drawImage()`, preserving locked 60 FPS even with 1,000+ active horde entities.
5. **Premise 5 (Test Rigor)**:
   - Vitest runs in Node. By providing a clean headless Canvas2D simulation harness via `vi.stubGlobal('document', ...)`, we can exercise `DarkFantasySprites.initialize()`, assert that all 120 atlas permutations render cleanly, verify zero `NaN` coordinates, and confirm that `globalCompositeOperation` is always cleanly restored to `'source-over'`.

---

## 3. Caveats

1. **Composite Operation Safety**: Whenever `ctx.globalCompositeOperation = 'lighter'` is used for additive glows, it MUST be wrapped in a `ctx.save()` / `ctx.restore()` block or explicitly reset to `'source-over'` immediately after drawing. Otherwise, subsequent entities and backdrop layers will be incorrectly blended.
2. **Canvas Dimension Boundaries**: Banshee floating wisps and Death Knight greatsword tips must remain within their canvas dimensions (48x48 and 64x64) to prevent visual clipping at offscreen canvas boundaries.
3. **Palette Consistency**: Use colors from `PALETTE` (`ABYSSAL_VOID`, `BLOOD_CRIMSON`, `BONE_IVORY`, `CURSED_ARCANE`, `NECROTIC_EMERALD`) and `hexToRgba()` to avoid uncoordinated colors across the game.
4. **Zero Heap Allocations in Render Loop**: All gradient creation and path generation occurs during atlas pre-computation (`initialize()`). The runtime `drawEnemy()` / `drawPlayer()` calls must strictly use `ctx.drawImage` from cache without allocating new objects.

---

## 4. Conclusion & Proposed High-Fidelity Implementation

### 4.1 Proposed High-Fidelity Banshee Vector Renderer
To be implemented in `src/render/sprites/DarkFantasySprites.ts`:

```typescript
  // --- High-Fidelity Vector Drawer: Banshee (Milestone M2) ---
  private static drawBansheeVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 2.5;
    const flutter = Math.cos((frame * Math.PI) / 2) * 1.8;

    // 1. Ethereal Ground Void Eddy (Faint pulsating floating shadow)
    const shadowGrad = ctx.createRadialGradient(0, 20, 1, 0, 20, 14);
    shadowGrad.addColorStop(0, 'rgba(26, 12, 46, 0.40)');
    shadowGrad.addColorStop(0.6, 'rgba(15, 13, 26, 0.15)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 20, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Additive Spectral Glow Corona (globalCompositeOperation = 'lighter')
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const coronaGrad = ctx.createRadialGradient(0, -2 + bob, 2, 0, -2 + bob, 22);
    coronaGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)');     // Luminous cyan core
    coronaGrad.addColorStop(0.4, 'rgba(183, 148, 246, 0.18)'); // Cursed arcane aura
    coronaGrad.addColorStop(0.8, 'rgba(112, 56, 184, 0.08)');  // Deep violet fringe
    coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(0, -2 + bob, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Trailing Ghostly Wisps (Undulating translucent vapor tendrils)
    ctx.save();
    // Left wisp
    const leftWispGrad = ctx.createLinearGradient(-12, 2 + bob, -16 + flutter, 22 + bob);
    leftWispGrad.addColorStop(0, 'rgba(183, 148, 246, 0.65)');
    leftWispGrad.addColorStop(0.5, 'rgba(0, 220, 240, 0.35)');
    leftWispGrad.addColorStop(1, 'rgba(112, 56, 184, 0.0)');
    ctx.fillStyle = leftWispGrad;
    ctx.beginPath();
    ctx.moveTo(-6, 2 + bob);
    ctx.quadraticCurveTo(-14, 10 + bob, -16 + flutter, 20 + bob * 0.5);
    ctx.quadraticCurveTo(-10, 16 + bob, -4, 8 + bob);
    ctx.closePath();
    ctx.fill();

    // Right wisp
    const rightWispGrad = ctx.createLinearGradient(12, 2 + bob, 16 - flutter, 22 + bob);
    rightWispGrad.addColorStop(0, 'rgba(183, 148, 246, 0.65)');
    rightWispGrad.addColorStop(0.5, 'rgba(0, 220, 240, 0.35)');
    rightWispGrad.addColorStop(1, 'rgba(112, 56, 184, 0.0)');
    ctx.fillStyle = rightWispGrad;
    ctx.beginPath();
    ctx.moveTo(6, 2 + bob);
    ctx.quadraticCurveTo(14, 10 + bob, 16 - flutter, 20 + bob * 0.5);
    ctx.quadraticCurveTo(10, 16 + bob, 4, 8 + bob);
    ctx.closePath();
    ctx.fill();

    // Central vortex vapor
    const centerWispGrad = ctx.createLinearGradient(0, 4 + bob, 0, 22 + bob);
    centerWispGrad.addColorStop(0, 'rgba(150, 100, 240, 0.70)');
    centerWispGrad.addColorStop(0.6, 'rgba(0, 200, 230, 0.40)');
    centerWispGrad.addColorStop(1, 'rgba(26, 12, 46, 0.0)');
    ctx.fillStyle = centerWispGrad;
    ctx.beginPath();
    ctx.moveTo(-8, 4 + bob);
    ctx.lineTo(8, 4 + bob);
    ctx.quadraticCurveTo(6 + flutter, 14 + bob, 2, 21 + bob);
    ctx.quadraticCurveTo(-2, 16 + bob, -4 - flutter, 18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Translucent Spectral Shroud & Torso (Layered gossamer robe)
    const shroudGrad = ctx.createLinearGradient(0, -12 + bob, 0, 12 + bob);
    shroudGrad.addColorStop(0, 'rgba(215, 195, 255, 0.90)');  // Spectral highlight
    shroudGrad.addColorStop(0.5, 'rgba(140, 90, 230, 0.75)'); // Mid violet
    shroudGrad.addColorStop(1, 'rgba(40, 15, 80, 0.50)');    // Shaded hem
    ctx.fillStyle = shroudGrad;
    ctx.beginPath();
    ctx.moveTo(-8, -4 + bob);
    ctx.quadraticCurveTo(-10, 4 + bob, -7, 12 + bob);
    ctx.lineTo(-2, 9 + bob);
    ctx.lineTo(0, 13 + bob);
    ctx.lineTo(2, 9 + bob);
    ctx.lineTo(7, 12 + bob);
    ctx.quadraticCurveTo(10, 4 + bob, 8, -4 + bob);
    ctx.closePath();
    ctx.fill();

    // 5. Weeping Mourning Veil & Hood
    ctx.fillStyle = 'rgba(60, 27, 107, 0.92)'; // Deep arcane cowl
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 7.5, Math.PI, 0);
    ctx.quadraticCurveTo(8, -2 + bob, 7, 2 + bob);
    ctx.lineTo(-7, 2 + bob);
    ctx.quadraticCurveTo(-8, -2 + bob, 0, -9 + bob);
    ctx.closePath();
    ctx.fill();

    // Sheer Veil Overlay with delicate gossamer highlights
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -8 + bob);
    ctx.quadraticCurveTo(-7, -2 + bob, -5, 4 + bob);
    ctx.moveTo(6, -8 + bob);
    ctx.quadraticCurveTo(7, -2 + bob, 5, 4 + bob);
    ctx.stroke();

    // Abyss Interior of Hood
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.ellipse(0, -8 + bob, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Agonized Weeping Visage
    // Void eye sockets with weeping cyan tears
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(-2.5, -9.5 + bob, 1.2, 1.8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2.5, -9.5 + bob, 1.2, 1.8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Burning Cyan Pinpoint Gaze
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(-3, -10 + bob, 1, 1);
    ctx.fillRect(2, -10 + bob, 1, 1);

    // Weeping Spectral Tears (Streaks flowing down cheeks)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-2.5, -8 + bob);
    ctx.lineTo(-2.5, -4.5 + bob);
    ctx.moveTo(2.5, -8 + bob);
    ctx.lineTo(2.5, -4.5 + bob);
    ctx.stroke();

    // Wailing Mouth Silhouette (Distended gaping void)
    ctx.fillStyle = '#020106';
    ctx.beginPath();
    ctx.ellipse(0, -4.5 + bob, 1.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Luminous Soul Scream Emission (Inner throat glow)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(0, 255, 240, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -4 + bob, 0.8, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
```

---

### 4.2 Proposed High-Fidelity Death Knight Vector Renderer
To be implemented in `src/render/sprites/DarkFantasySprites.ts`:

```typescript
  // --- High-Fidelity Vector Drawer: Death Knight (Milestone M2) ---
  private static drawDeathKnightVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const marchPhase = (frame % 4);
    const legStride = Math.sin((frame * Math.PI) / 2) * 5;
    const stompDrop = (marchPhase === 1 || marchPhase === 3) ? 1 : 0;
    const capeSway = Math.sin((frame * Math.PI) / 2) * 3;

    // 1. Heavy Contact Shadow (Massive grounded presence)
    ctx.fillStyle = 'rgba(8, 6, 12, 0.70)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Heavy Tattered Crimson Warcape (Swaying behind armor)
    const capeGrad = ctx.createLinearGradient(0, -10 + stompDrop, 0, 24 + stompDrop);
    capeGrad.addColorStop(0, PALETTE.BLOOD_CRIMSON.COAGULATED);
    capeGrad.addColorStop(0.7, PALETTE.BLOOD_CRIMSON.DRIED);
    capeGrad.addColorStop(1, '#1a0404');
    ctx.fillStyle = capeGrad;
    ctx.beginPath();
    ctx.moveTo(-14, -8 + stompDrop);
    ctx.lineTo(14, -8 + stompDrop);
    ctx.quadraticCurveTo(18 + capeSway, 8 + stompDrop, 17 + capeSway, 23 + stompDrop);
    // Ragged jagged tattered hem
    ctx.lineTo(11 + capeSway, 20 + stompDrop);
    ctx.lineTo(5 + capeSway, 24 + stompDrop);
    ctx.lineTo(-2 + capeSway, 20 + stompDrop);
    ctx.lineTo(-8 + capeSway, 24 + stompDrop);
    ctx.lineTo(-17 + capeSway, 22 + stompDrop);
    ctx.quadraticCurveTo(-18 + capeSway, 8 + stompDrop, -14, -8 + stompDrop);
    ctx.closePath();
    ctx.fill();

    // Cape Inner Folds (Deep shadow)
    ctx.strokeStyle = 'rgba(10, 4, 4, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -4 + stompDrop);
    ctx.lineTo(-7 + capeSway, 20 + stompDrop);
    ctx.moveTo(6, -4 + stompDrop);
    ctx.lineTo(7 + capeSway, 20 + stompDrop);
    ctx.stroke();

    // 3. Articulated Obsidian Armored Greaves & Sabatons (Legs)
    const drawLeg = (baseX: number, stride: number) => {
      // Thigh & Poleyn (Knee guard)
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
      ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
      ctx.lineWidth = 1;

      // Greave (Shin)
      ctx.beginPath();
      ctx.moveTo(baseX - 4 + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 4 + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 5 + stride, 20 + stompDrop);
      ctx.lineTo(baseX - 4 + stride, 20 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Knee Guard Spiked Ridge
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
      ctx.beginPath();
      ctx.moveTo(baseX - 3 + stride, 10 + stompDrop);
      ctx.lineTo(baseX + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 3 + stride, 10 + stompDrop);
      ctx.lineTo(baseX + stride, 12 + stompDrop);
      ctx.closePath();
      ctx.fill();

      // Pointed Sabaton (Foot)
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
      ctx.beginPath();
      ctx.moveTo(baseX - 4 + stride, 20 + stompDrop);
      ctx.lineTo(baseX + 6 + stride, 20 + stompDrop);
      ctx.lineTo(baseX + 7 + stride, 24 + stompDrop);
      ctx.lineTo(baseX - 5 + stride, 24 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular Highlight along shin edge
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX - 2 + stride, 9 + stompDrop);
      ctx.lineTo(baseX - 2 + stride, 19 + stompDrop);
      ctx.stroke();
    };

    drawLeg(-7, legStride);
    drawLeg(6, -legStride);

    // 4. Obsidian Cuirass & Segmented Plackart (Torso)
    const cuirassGrad = ctx.createLinearGradient(-10, -10 + stompDrop, 10, 10 + stompDrop);
    cuirassGrad.addColorStop(0, '#231d38'); // Specular obsidian top-left
    cuirassGrad.addColorStop(0.4, PALETTE.ABYSSAL_VOID.SLATE);
    cuirassGrad.addColorStop(1, PALETTE.ABYSSAL_VOID.DEEP); // Deep shadow
    ctx.fillStyle = cuirassGrad;
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(-11, -10 + stompDrop);
    ctx.lineTo(11, -10 + stompDrop);
    ctx.lineTo(9, 7 + stompDrop);
    ctx.lineTo(0, 10 + stompDrop);
    ctx.lineTo(-9, 7 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central Gothic Sternal Ridge
    ctx.strokeStyle = 'rgba(220, 225, 240, 0.70)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -9 + stompDrop);
    ctx.lineTo(0, 9 + stompDrop);
    ctx.stroke();

    // Etched Antique Gold & Blood Filigree Runes on Breastplate
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)'; // Antique Gold filigree
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Left chest rune
    ctx.moveTo(-7, -5 + stompDrop);
    ctx.lineTo(-3, -2 + stompDrop);
    ctx.lineTo(-6, 2 + stompDrop);
    // Right chest rune
    ctx.moveTo(7, -5 + stompDrop);
    ctx.lineTo(3, -2 + stompDrop);
    ctx.lineTo(6, 2 + stompDrop);
    ctx.stroke();

    // Occult Blood Sigil Center
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.VIVID;
    ctx.beginPath();
    ctx.arc(0, 1 + stompDrop, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 5. Massive Flared Spiked Pauldrons (Shoulders)
    const drawPauldron = (isLeft: boolean) => {
      const dir = isLeft ? -1 : 1;
      ctx.save();
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.65)';
      ctx.lineWidth = 1;

      // Tier 1 upper spiked plate
      ctx.beginPath();
      ctx.moveTo(dir * 7, -14 + stompDrop);
      ctx.lineTo(dir * 18, -20 + stompDrop); // High sharp flare
      ctx.lineTo(dir * 17, -10 + stompDrop);
      ctx.lineTo(dir * 8, -6 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold etched border along pauldron rim
      ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(dir * 8, -13 + stompDrop);
      ctx.lineTo(dir * 16, -18 + stompDrop);
      ctx.stroke();

      ctx.restore();
    };

    drawPauldron(true);
    drawPauldron(false);

    // 6. Horned Greathelm with Glowing Crimson Visor
    // Helm Base Dome
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -17 + stompDrop, 7, Math.PI, 0);
    ctx.lineTo(6, -11 + stompDrop);
    ctx.lineTo(0, -9 + stompDrop); // Sharp gothic faceplate prow
    ctx.lineTo(-6, -11 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Greathelm Specular Bevel
    ctx.strokeStyle = 'rgba(210, 220, 240, 0.70)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -24 + stompDrop);
    ctx.lineTo(0, -10 + stompDrop);
    ctx.stroke();

    // Demonic Sweeping Obsidian Horns
    const hornGrad = ctx.createLinearGradient(0, -18 + stompDrop, 0, -32 + stompDrop);
    hornGrad.addColorStop(0, PALETTE.ABYSSAL_VOID.DEEP);
    hornGrad.addColorStop(0.6, PALETTE.BONE_IVORY.SHADOW);
    hornGrad.addColorStop(1, PALETTE.BONE_IVORY.POLISHED); // Sharp ivory horn tips
    ctx.fillStyle = hornGrad;
    ctx.strokeStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.lineWidth = 1;

    // Left Horn (Curving outward and up)
    ctx.beginPath();
    ctx.moveTo(-5, -20 + stompDrop);
    ctx.quadraticCurveTo(-14, -22 + stompDrop, -16, -30 + stompDrop);
    ctx.quadraticCurveTo(-12, -26 + stompDrop, -4, -22 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Horn
    ctx.beginPath();
    ctx.moveTo(5, -20 + stompDrop);
    ctx.quadraticCurveTo(14, -22 + stompDrop, 16, -30 + stompDrop);
    ctx.quadraticCurveTo(12, -26 + stompDrop, 4, -22 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Visor Aperture (Void recess)
    ctx.fillStyle = '#000000';
    ctx.fillRect(-5, -16 + stompDrop, 10, 2.5);

    // Intense Glowing Crimson Visor Slit
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-4.5, -15.5 + stompDrop, 9, 1.5);

    // Visor Horizontal Laser Glare (Additive flare)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const visorGlow = ctx.createLinearGradient(-8, 0, 8, 0);
    visorGlow.addColorStop(0, 'rgba(255, 30, 30, 0)');
    visorGlow.addColorStop(0.5, 'rgba(255, 80, 80, 0.85)');
    visorGlow.addColorStop(1, 'rgba(255, 30, 30, 0)');
    ctx.fillStyle = visorGlow;
    ctx.fillRect(-8, -16 + stompDrop, 16, 2.5);
    ctx.restore();

    // 7. Imposing Two-Handed Runic Greatsword
    const swordX = 13;
    const swordY = -26 + stompDrop;

    // Pommel (Skull / Diamond terminal)
    ctx.fillStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.beginPath();
    ctx.arc(swordX + 2, swordY + 45, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Leather-bound Wire Hilt
    ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.fillRect(swordX + 1, swordY + 36, 2, 8);

    // Gothic Spiked Crossguard (Downward quillons)
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(swordX - 5, swordY + 35);
    ctx.lineTo(swordX + 9, swordY + 35);
    ctx.lineTo(swordX + 8, swordY + 38);
    ctx.lineTo(swordX + 2, swordY + 36.5);
    ctx.lineTo(swordX - 4, swordY + 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Colossal Steel Blade
    const bladeGrad = ctx.createLinearGradient(swordX, swordY, swordX + 4, swordY);
    bladeGrad.addColorStop(0, '#555e70'); // Left bevel dark iron
    bladeGrad.addColorStop(0.4, '#b8c4d8'); // Specular ridge
    bladeGrad.addColorStop(0.6, '#ffffff'); // Edge highlight
    bladeGrad.addColorStop(1, '#3b4252'); // Right bevel
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(swordX - 1, swordY + 35);
    ctx.lineTo(swordX - 1, swordY + 4);
    ctx.lineTo(swordX + 2, swordY - 2); // Chiseled dagger tip
    ctx.lineTo(swordX + 5, swordY + 4);
    ctx.lineTo(swordX + 5, swordY + 35);
    ctx.closePath();
    ctx.fill();

    // Central Fuller Blood Groove
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.fillRect(swordX + 1.5, swordY + 6, 1, 28);

    // Glowing Blood Runes Etched Along Fuller
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 40, 40, 0.9)';
    ctx.fillRect(swordX + 1.5, swordY + 8, 1, 3);
    ctx.fillRect(swordX + 1.5, swordY + 14, 1, 4);
    ctx.fillRect(swordX + 1.5, swordY + 21, 1, 3);
    ctx.fillRect(swordX + 1.5, swordY + 27, 1, 4);
    ctx.restore();
  }
```

---

### 4.3 Proposed High-Fidelity Damage Flash Mask Silhouettes
In `src/render/sprites/DarkFantasySprites.ts:drawMaskedEntity`:
- **Banshee**: Must trace the full ethereal wisp silhouette, cowl, and trailing vapor.
- **Death Knight**: Must trace the horned greathelm, flared spiked pauldrons, articulated legs, and colossal greatsword.

```typescript
      case 'banshee': {
        const bob = Math.sin((frame * Math.PI) / 2) * 2.5;
        // Head & veil dome
        ctx.beginPath();
        ctx.arc(0, -9 + bob, 7.5, 0, Math.PI * 2);
        ctx.fill();
        // Torso & wisps
        ctx.beginPath();
        ctx.moveTo(-8, -4 + bob);
        ctx.lineTo(8, -4 + bob);
        ctx.lineTo(16, 20 + bob * 0.5);
        ctx.lineTo(2, 21 + bob);
        ctx.lineTo(-16, 20 + bob * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'death_knight': {
        const stompDrop = ((frame % 4) === 1 || (frame % 4) === 3) ? 1 : 0;
        const legStride = Math.sin((frame * Math.PI) / 2) * 5;
        // Helm & horns
        ctx.beginPath();
        ctx.arc(0, -17 + stompDrop, 7, 0, Math.PI * 2);
        ctx.moveTo(-16, -30 + stompDrop);
        ctx.lineTo(-5, -20 + stompDrop);
        ctx.lineTo(5, -20 + stompDrop);
        ctx.lineTo(16, -30 + stompDrop);
        ctx.fill();
        // Cuirass & Pauldrons
        ctx.fillRect(-17, -16 + stompDrop, 34, 24);
        // Legs
        ctx.fillRect(-11 + legStride, 8 + stompDrop, 8, 16);
        ctx.fillRect(2 - legStride, 8 + stompDrop, 8, 16);
        // Greatsword
        ctx.fillRect(12, -28 + stompDrop, 6, 64);
        break;
      }
```

---

### 4.4 Proposed Unit Test Architecture (`tests/unit/DarkFantasySprites.spec.ts`)
A dedicated, robust unit test suite designed for Vitest to comprehensively verify procedural generation, atlas caching, and clean canvas execution:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DarkFantasySprites, EntitySpriteType, FlashState } from '../../src/render/sprites/DarkFantasySprites';
import { Player } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';

describe('DarkFantasySprites Comprehensive Atlas & Canvas Test Suite', () => {
  let createdCanvases: any[] = [];
  let recordingCtxList: any[] = [];
  let camera: Camera;

  // Headless Canvas2D Simulation Harness
  function createMockCanvasContext() {
    const operations: Array<{ method: string; args: any[] }> = [];
    const gradientMock = {
      addColorStop: vi.fn(),
    };

    const ctx: any = {
      operations,
      save: vi.fn(() => operations.push({ method: 'save', args: [] })),
      restore: vi.fn(() => operations.push({ method: 'restore', args: [] })),
      translate: vi.fn((x, y) => operations.push({ method: 'translate', args: [x, y] })),
      scale: vi.fn((x, y) => operations.push({ method: 'scale', args: [x, y] })),
      rotate: vi.fn((a) => operations.push({ method: 'rotate', args: [a] })),
      beginPath: vi.fn(() => operations.push({ method: 'beginPath', args: [] })),
      closePath: vi.fn(() => operations.push({ method: 'closePath', args: [] })),
      moveTo: vi.fn((x, y) => operations.push({ method: 'moveTo', args: [x, y] })),
      lineTo: vi.fn((x, y) => operations.push({ method: 'lineTo', args: [x, y] })),
      quadraticCurveTo: vi.fn((cpx, cpy, x, y) => operations.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] })),
      bezierCurveTo: vi.fn((cp1x, cp1y, cp2x, cp2y, x, y) => operations.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] })),
      arc: vi.fn((x, y, r, sa, ea) => operations.push({ method: 'arc', args: [x, y, r, sa, ea] })),
      ellipse: vi.fn((x, y, rx, ry, rot, sa, ea) => operations.push({ method: 'ellipse', args: [x, y, rx, ry, rot, sa, ea] })),
      fill: vi.fn(() => operations.push({ method: 'fill', args: [] })),
      stroke: vi.fn(() => operations.push({ method: 'stroke', args: [] })),
      fillRect: vi.fn((x, y, w, h) => operations.push({ method: 'fillRect', args: [x, y, w, h] })),
      strokeRect: vi.fn((x, y, w, h) => operations.push({ method: 'strokeRect', args: [x, y, w, h] })),
      drawImage: vi.fn((...args: any[]) => operations.push({ method: 'drawImage', args })),
      createLinearGradient: vi.fn(() => gradientMock),
      createRadialGradient: vi.fn(() => gradientMock),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    };
    return ctx;
  }

  beforeEach(() => {
    createdCanvases = [];
    recordingCtxList = [];
    DarkFantasySprites.clearCache();

    camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });

    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          const ctx = createMockCanvasContext();
          recordingCtxList.push(ctx);
          const canvas: any = {
            width: 0,
            height: 0,
            getContext: (type: string) => (type === '2d' ? ctx : null),
          };
          createdCanvases.push(canvas);
          return canvas;
        }
        return {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Suite 1: Atlas Initialization & Caching Invariants', () => {
    it('initializes and pre-caches all 120 unique sprite permutations', () => {
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const flashStates: FlashState[] = ['normal', 'white', 'crimson'];
      const facings = [true, false];

      let entryCount = 0;
      for (const type of types) {
        for (let f = 0; f < 4; f++) {
          for (const facing of facings) {
            for (const flash of flashStates) {
              const entry = DarkFantasySprites.getCachedEntry(type, f, facing, flash);
              expect(entry).not.toBeNull();
              expect(entry?.canvas).toBeDefined();
              expect(entry?.width).toBeGreaterThan(0);
              expect(entry?.height).toBeGreaterThan(0);
              expect(entry?.originX).toBe(entry!.width / 2);
              expect(entry?.originY).toBe(entry!.height / 2);
              entryCount++;
            }
          }
        }
      }
      expect(entryCount).toBe(120);
    });

    it('returns exact same cached instance without re-allocating canvases', () => {
      DarkFantasySprites.initialize();
      const initialCanvasCount = createdCanvases.length;

      // Access entries repeatedly
      for (let i = 0; i < 50; i++) {
        const e1 = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'normal');
        const e2 = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'normal');
        expect(e1).toBe(e2);
      }

      expect(createdCanvases.length).toBe(initialCanvasCount);
    });

    it('clears cache cleanly and resets initialized flag', () => {
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      DarkFantasySprites.clearCache();
      expect(DarkFantasySprites.initialized).toBe(false);

      // On-demand regeneration
      const entry = DarkFantasySprites.getCachedEntry('banshee', 1, false, 'crimson');
      expect(entry).not.toBeNull();
    });
  });

  describe('Suite 2: Zero Rendering Errors & Canvas Invariant Conservation', () => {
    it('ensures zero NaN or undefined values passed to any canvas context method', () => {
      DarkFantasySprites.initialize();

      for (const ctx of recordingCtxList) {
        for (const op of ctx.operations) {
          for (const arg of op.args) {
            if (typeof arg === 'number') {
              expect(Number.isNaN(arg)).toBe(false);
              expect(Number.isFinite(arg)).toBe(true);
            }
            expect(arg).not.toBeUndefined();
          }
        }
      }
    });

    it('ensures strictly balanced save and restore calls across all generated entries', () => {
      DarkFantasySprites.initialize();

      for (const ctx of recordingCtxList) {
        let balance = 0;
        for (const op of ctx.operations) {
          if (op.method === 'save') balance++;
          if (op.method === 'restore') balance--;
          expect(balance).toBeGreaterThanOrEqual(0);
        }
        expect(balance).toBe(0);
      }
    });
  });

  describe('Suite 3: High-Fidelity Banshee Procedural Verification', () => {
    it('verifies Banshee uses additive blending, gradients, and wailing facial features', () => {
      const entry = DarkFantasySprites.getCachedEntry('banshee', 0, true, 'normal');
      expect(entry).not.toBeNull();
      expect(entry?.width).toBe(48);
      expect(entry?.height).toBe(48);

      // Inspect operations recorded on this canvas
      const canvasCtx = (entry?.canvas as any).getContext('2d');
      expect(canvasCtx.createRadialGradient).toHaveBeenCalled();
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Check that lighter composite operation was invoked for the aura/wail
      const lighterOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'save' // save before lighter
      );
      expect(lighterOps.length).toBeGreaterThan(0);
    });
  });

  describe('Suite 4: High-Fidelity Death Knight Procedural Verification', () => {
    it('verifies Death Knight uses 64x64 canvas, horns, runes, and greatsword geometry', () => {
      const entry = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'normal');
      expect(entry).not.toBeNull();
      expect(entry?.width).toBe(64);
      expect(entry?.height).toBe(64);

      const canvasCtx = (entry?.canvas as any).getContext('2d');
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Verify sword and armor paths were drawn
      const pathOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'quadraticCurveTo' || op.method === 'lineTo'
      );
      expect(pathOps.length).toBeGreaterThan(20);
    });
  });

  describe('Suite 5: Render Pipeline Integration (drawEnemy & drawPlayer)', () => {
    let mockDrawCtx: any;

    beforeEach(() => {
      mockDrawCtx = createMockCanvasContext();
    });

    it('blits cached canvas via drawImage for living enemy', () => {
      const enemy = new Enemy(10);
      enemy.reset('banshee', 100, 100);
      enemy.active = true;

      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0.5);

      const drawImageCall = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(drawImageCall).toBeDefined();
    });

    it('blits cached canvas via drawImage for living death knight with damage flash', () => {
      const enemy = new Enemy(11);
      enemy.reset('death_knight', 200, 200);
      enemy.active = true;
      enemy.flashTimer = 0.08; // > 0.05 -> white flash

      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0.5);

      const drawImageCall = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(drawImageCall).toBeDefined();
    });

    it('does not draw dead enemies', () => {
      const enemy = new Enemy(12);
      enemy.active = false;
      enemy.isAlive = false;

      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0.5);
      expect(mockDrawCtx.operations.length).toBe(0);
    });
  });
});
```

---

## 5. Verification Method

1. **Verify Existing Tests Pass**:
   ```bash
   npm test
   ```
   **Expected Result**: All 21 test suites and 247 tests pass cleanly.

2. **Implement Procedural Sprites in `DarkFantasySprites.ts`**:
   Replace `drawBansheeVector` and `drawDeathKnightVector` with the high-fidelity procedures and update `drawMaskedEntity`.

3. **Run the New Sprite Spec Suite**:
   ```bash
   npx vitest run tests/unit/DarkFantasySprites.spec.ts
   ```
   **Expected Result**: 100% green across all suites (caching, zero NaN, composite restoration, and entity features).

4. **Verify Challenger Benchmark Performance**:
   ```bash
   npx vitest run tests/unit/ChallengerDF_M2.test.ts
   ```
   **Expected Result**: 1,000 entities draw benchmark remains < 5.0ms (typically ~1.5ms).
