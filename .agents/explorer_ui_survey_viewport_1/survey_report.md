# UI Survey & Viewport 16:9 Architecture Analysis Report

**Agent**: `explorer_ui_survey_viewport_1`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_viewport_1`  
**Date**: 2026-09-10  
**Parent Task**: dc4b76ec-2c8d-41af-8152-fb6d5ed83654  
**Project**: Metal Slug Web (Full Metal Slug) UI/UX, Viewport & Level Design Overhaul  

---

## 1. Executive Summary

The user explicitly stated that the current game *"is not cute/charming at all, and it feels very stifling/claustrophobic"* (`아기자기한 느낌이 전혀 없고 답답함`). A thorough investigation across `src/render/`, `src/core/`, `src/ui/`, `index.html`, and `tests/` reveals the exact mathematical, architectural, and visual causes of this stifling feel:

1. **Severely Constrained Virtual Viewport (480x270)**: The game simulates and renders everything into a tiny 480x270 virtual coordinate space. On a 1080p display, each virtual pixel is stretched 4x, making sprites look blocky and chunky rather than detailed pixel art.
2. **Extreme Boss & Entity Footprint**: The Stage 1 Boss (*Tetsuyuki War Fortress*, hull 260x140) occupies over **54% of the screen width** and **51% of the screen height**. The mid-boss and end-boss arenas are locked to only 480px width, leaving the player crammed into a tiny 200px corner with virtually zero room to maneuver or dodge bullets.
3. **Deadzone & Forward Camera Asymmetry**: The camera deadzone is only 48px wide (10% of the screen, from 35% to 45% of 480px). Forward visibility ahead of the player is restricted to ~264px. With enemy bullet speed at 280 px/s, player reaction time is under 0.95 seconds.
4. **Sterile Level & Background Aesthetics**: The ground is a single flat brown rectangle across 2,400px at `Y: 230` with only 5 flat wooden planks. The background uses dark, muddy twilight gradients (#102040 to #5E485E) and bulbous cauliflower-like cloud puffs, lacking the vibrant azure coastal skies, golden sand dunes, swaying palm trees, and whimsical animated props characteristic of *Metal Slug Mission 1*.
5. **Rigid, Boxy Sprites Lacking Arcade Charm**: Characters and enemies are rendered with rigid rectangular primitives without the expressive squash-and-stretch proportions, comical expressions, bouncy breathing idles, or charming arcade personality of the original Neo Geo sprites.

This report establishes the complete architectural blueprint to upgrade the game to **16:9 Widescreen HD** (960x540 internal framebuffer with crisp integer pixel scaling or 1280x720 display resolution), expand the camera and stage breathing room, overhaul terrain into multi-tiered platforms, infuse cute/charming visual touches, and preserve 100% test compatibility across all 35 test suites (463 Vitest tests and Playwright E2E suites).

---

## 2. Canvas Dimensions, Viewport Sizing & CSS Layout

### 2.1 Current Implementation & Code Locations
- **`src/render/CanvasRenderer.ts`** (Lines 159–164, 176–188):
  ```ts
  public static readonly VIRTUAL_WIDTH = 480;
  public static readonly VIRTUAL_HEIGHT = 270;
  this.virtualBuffer = createCanvasBuffer(CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
  ```
  The renderer allocates an off-screen framebuffer buffer (`virtualBuffer`) fixed at **480x270**.
- **`src/main.ts`** (Lines 180–186):
  ```ts
  canvas.width = CanvasRenderer.VIRTUAL_WIDTH;   // 480
  canvas.height = CanvasRenderer.VIRTUAL_HEIGHT; // 270
  ```
  The physical HTML `<canvas id="game-canvas">` DOM element is set to `width="480"` and `height="270"`.
- **`index.html`** (Lines 31–39):
  ```css
  canvas {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  ```
  CSS expands the 480x270 bitmap to fill the container using nearest-neighbor scaling.
- **Letterbox Blitting (`CanvasRenderer.ts`, Lines 197–208, 260–285)**:
  `CanvasRenderer.calculateLetterbox(destWidth, destHeight)` computes scaling and margins. However, because `canvas.width` and `canvas.height` in `main.ts` are initialized to 480x270, `destWidth === VIRTUAL_WIDTH`, resulting in an internal scale factor of `1.0` (no offscreen blit scaling; the browser performs the entire stretch).

### 2.2 Comparison Table: Current vs Modern 16:9 HD Targets

| Parameter | Current (M6) | 960x540 (Target A: Crisp 2x HD) | 1280x720 (Target B: Native 720p) |
| :--- | :--- | :--- | :--- |
| **Virtual Buffer Width** | 480 px | 960 px | 1280 px |
| **Virtual Buffer Height** | 270 px | 540 px | 720 px |
| **Aspect Ratio** | 16:9 (1.7778) | 16:9 (1.7778) | 16:9 (1.7778) |
| **Visible World Screen Area** | 129,600 px² | 518,400 px² (4x increase) | 921,600 px² (7.1x increase) |
| **Tetsuyuki Boss Screen Width %** | 54.2% (260/480) | 27.1% (260/960) | 20.3% (260/1280) |
| **Player Standing Height %** | 14.8% (40/270) | 7.4% (40/540) | 5.5% (40/720) |
| **Forward Reaction Distance** | ~264 px (~0.94s @ 280px/s) | ~528 px (~1.88s @ 280px/s) | ~704 px (~2.51s @ 280px/s) |
| **Pixel Density / Sharpness** | Coarse 4x blowup on 1080p | Crisp 2x integer or native | 1:1 HD pixel art sharpness |

---

## 3. Camera Mechanics, Tracking & Boundaries

### 3.1 Code Structure & Tracking Mathematics
Located in `src/render/Camera.ts` (Lines 20–74, 96–144):
- **Deadzone Configuration**:
  ```ts
  this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);   // 168 px
  this.deadzoneRight = Math.floor(this.viewportWidth * 0.45);  // 216 px
  this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);    // 81 px
  this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70); // 189 px
  ```
  - Horizontal deadzone window: `216 - 168 = 48 px` (only 10% of screen). The player quickly triggers camera movement upon taking a few steps.
  - Asymmetric forward bias: When running right, the player sits at `x = camera.x + 216`, leaving only `480 - 216 = 264 px` ahead.
  - `smoothSpeed`: Defaults to `0` (instant hard tracking). Can be set to `4.0–6.0` for smooth cinematic follow without nausea.
  - Forward Lock (`forwardLock: true`): Implements classic arcade ratchet behavior where `camera.x` cannot decrease below `maxReachedX`.

### 3.2 Stage Boundaries & Lockdowns
Defined in `src/main.ts` (Lines 749–847) and `src/core/engine/StageManager.ts` (Lines 52, 115–136):
- **Full Stage 1**: `minX: 0, maxX: 2400, minY: 0, maxY: 270`.
- **Mid-Boss Lockdown (`trigger_mid_boss`)**:
  - `lockCameraBounds: { minX: 720, maxX: 1200, minY: 0, maxY: 270 }`
  - Arena width: `1200 - 720 = 480 px` (exactly 1.0 viewport).
  - Mid-Boss vehicle width: 90 px + 30 px turret. The player has less than 280 px of free arena floor.
- **End-Boss Lockdown (`trigger_end_boss`)**:
  - `lockCameraBounds: { minX: 1800, maxX: 2280, minY: 0, maxY: 270 }`
  - Arena width: `2280 - 1800 = 480 px` (exactly 1.0 viewport).
  - Tetsuyuki Boss width: 260 px.
  - This leaves only `480 - 260 = 220 px` of free arena space! When the boss fires artillery shells or sweeps lasers, the player is pinned against the left camera border.

---

## 4. Background Parallax Layers & Scrolling Mechanics

### 4.1 Layer Architecture (`src/render/ParallaxBackground.ts`)
The parallax system comprises 4 composite layers rendered to off-screen buffers:

1. **Layer 0: Sky Gradient & Drifting Clouds (Scroll Factor: 0.0x)**:
   - `skyBuffer = createCanvasBuffer(480, 270)`
   - 8-band vertical gradient from twilight navy (`#102040`) to dusky orange (`#F0A448`).
   - Procedural cumulus clouds rendered across 3 altitude tracks (y=35, 75, 115) drifting with speed coefficients 6, 10, 14.
2. **Layer 1: Distant Mountain Peaks & Pyramids (Scroll Factor: 0.2x)**:
   - `mountainsBuffer = createCanvasBuffer(960, 270)`
   - Dual-sine wave jagged silhouette in dark slate `#2A3648` and `#3E4959`.
3. **Layer 2: Midground War Ruins, Pillboxes & Palm Trees (Scroll Factor: 0.5x)**:
   - `ruinsBuffer = createCanvasBuffer(960, 270)`
   - Concrete bunkers, sandbags, shattered palm trunks, and communication radar antennas at 160px intervals.
4. **Layer 3: Foreground Combat Scaffolding & Ocean Wave Stilts (Scroll Factor: 1.0x)**:
   - `foregroundBuffer = createCanvasBuffer(960, 270)`
   - Wooden pilings, braces, and ocean waterline foam ripples at 80px intervals.

### 4.2 Seamless Tiling Logic & Viewport Width Limits
Lines 305–327 in `ParallaxBackground.ts`:
```ts
const offset1 = Math.floor((cameraX * factor1) % this.bufferWidth);
ctx.drawImage(this.mountainsBuffer as any, -offset1, 0);
if (offset1 > this.bufferWidth - W) {
  ctx.drawImage(this.mountainsBuffer as any, this.bufferWidth - offset1, 0);
}
```
- Currently, `bufferWidth = 960` and `W = 480`.
- **Limitation**: If viewport width `W` is increased to `960` or `1280`, `this.bufferWidth - W <= 0`. If `W > bufferWidth`, a single secondary draw is insufficient, leaving a black void on the right.
- **Required Fix**: Upgrade parallax tiling to a robust modular loop:
  ```ts
  let drawX = -Math.floor((cameraX * factor) % this.bufferWidth);
  while (drawX < viewportWidth) {
    ctx.drawImage(buffer, drawX, 0);
    drawX += this.bufferWidth;
  }
  ```
  Additionally, increase `bufferWidth` to 1920 to prevent repetition artifacts on wide screens.

---

## 5. Sprite Rasterization, Scaling & Cute/Charming (아기자기한) Aesthetics

### 5.1 Current Sprite Rasterization (`ProceduralSpriteFactory.ts`, `Palette.ts`)
- The game uses 100% procedural pixel-art generation without external PNG assets.
- Palettes (`Palette.ts`): 16-color authentic indexed Neo Geo ramps (`PLAYER`, `REBEL`, `POW`, `FIRE`, `VEHICLE`, `FORTRESS`, `HUD`, `TERRAIN`).
- **Why It Currently Feels "Not Cute / Unappealing"**:
  1. **Character Proportions**: Marco is rendered with a 1:3 head-to-body ratio with tiny rigid eyes, stiff posture, and minimal breathing dynamics.
  2. **Rebel Soldiers**: Drawn with rigid angular helmets, straight rectangular limbs, and grey stick rifles. Lacks the classic Metal Slug comical charm (slouching, dozing off, panicking, flailing).
  3. **POW Hostages**: Rendered with an awkward cylindrical head and crown-like yellow blob.
  4. **Color Saturation**: The environment palette uses low-saturation greys, slates, and muddy browns (#2A3648, #4D5866, #303844) rather than the vibrant, sun-drenched palette of tropical arcade stages.

### 5.2 Aesthetic Overhaul: Injecting "아기자기한" Arcade Charm
To completely fulfill the user's explicit aesthetic directive:
1. **Expressive Proportions (Chibi-Arcade Styling)**:
   - Increase head and facial feature proportions slightly (1:2.2 ratio).
   - Add animated blinking, expressive wide cartoon eyes, and dynamic headband fluttering.
   - Bouncing idle animation: 4-frame breathing cycle with 2px vertical squash-and-stretch.
2. **Humorous & Charming Rebel Minion Expressions**:
   - Idle variations: occasionally yawning, eating roasted chicken drumstick, or reading a newspaper.
   - Panic reaction: when player throws grenade or fires ultimate, minions trigger wide-eyed shock frame (`rebel_shock`) with jaw-drop before fleeing or ducking.
3. **Charming POW Overhaul**:
   - Give the POW wild golden beard curls, big sparkling eyes, and a comical exaggerated salute (`pow_salute`) with a thumbs-up.
   - Item offering: POW pulls weapon crate out of his shorts with a sparkling star effect (`#FFF5CC`).
4. **Vibrant Coastal Color Palette**:
   - Sky: transition from dark twilight to bright daytime azure dawn (`#2980B9` -> `#5DADE2` -> `#F9E79F`).
   - Terrain: warm golden beach sands (`#F4D03F`, `#D4AC0D`), lush tropical green palm fronds (`#27AE60`, `#2ECC71`), and crystal turquoise ocean waves (`#1ABC9C`, `#48C9B0`) with white foaming crests (`#FFFFFF`).
5. **Cute Retro Arcade HUD Details (`HUDOverlay.ts`)**:
   - Rounded metallic badge frames with golden rivet corners.
   - Bouncing score multiplier numbers on combo kills.
   - Comical life counter: cute chibi Marco head with smiling expression.
   - Grenade counter: chunky cartoon bomb with a sparkling animated fuse spark (`#FFA010`).
   - Boss health bar: classic arcade segmented gauge with blinking skull emblem.

---

## 6. Level Design & Terrain System Overhaul

### 6.1 Current Terrain Limitations (`src/main.ts`, Lines 717–746)
- The entire stage is currently 2,400px long, but essentially flat:
  - Main ground: `createAABB(0, 230, 2400, 40)` (a single straight line).
  - 5 small floating semi-solid planks at Y: 140–175.
- There are no elevation changes, no stepped slopes, no multi-tier defensive structures, no destructible barricades, and no hazards to jump over.

### 6.2 Widescreen Multi-Tier Level Layout Blueprint
With an expanded 960x540 viewport and rich level design:
- **Vertical Tiering**:
  - **Ground Floor (Y: 460–500)**: Sand dunes, coastal cobblestone road, and beach waterline.
  - **Tier 1 Platforms (Y: 360–380)**: Sandbag barricades, wooden pier boardwalks, and trench bunkers.
  - **Tier 2 Platforms (Y: 260–280)**: Elevated wooden rope bridges, watchtower sniper nests, and steel scaffolding.
  - **Tier 3 High Platforms (Y: 160–180)**: Fortress parapets and crane gantries.
- **Tactical Obstacles**:
  - Destructible wooden barricades (HP: 10) blocking enemy fire.
  - Sandbag redoubts providing crouch cover.
  - Explosive fuel barrels (red drums) that detonate when shot, wiping out nearby minion squads.
- **Stage Progression Pacing**:
  - Section 1 (Beachhead Landing, X: 0–1200): Open dunes, palm trees, paratrooper waves, elevated pier POW.
  - Section 2 (Mid-Boss Redoubt, X: 1200–2200): Fortified stone fortress entrance, Iron Technical armored half-track.
  - Section 3 (Fortress Inner Trench, X: 2200–3400): Multi-tier scaffolding, watchtower guards, ambush pits.
  - Section 4 (Boss War Arena, X: 3400–4400): Expansive 1,000px boss arena allowing full tactical maneuvering against Tetsuyuki and Iron Nokana.

---

## 7. Test Suite Audit & Compatibility Strategy

A thorough search across all 35 test files (463 Vitest tests and 5 Playwright E2E suites) identified the exact assertions that depend on canvas width, height, or camera bounds:

### 7.1 Catalog of Affected Tests

| File Path | Line(s) | Assertion / Code | Reason for Dependency | Recommended Update |
| :--- | :--- | :--- | :--- | :--- |
| `tests/e2e/game_initialization.spec.ts` | 40–41 | `expect(canvasDimensions.width).toBe(480);`<br>`expect(canvasDimensions.height).toBe(270);` | Verifies initial canvas DOM attributes | Update to `toBe(960)` and `toBe(540)` (or evaluate against dynamic `CanvasRenderer.VIRTUAL_WIDTH`). |
| `tests/unit/spawning_contract.test.ts` | 22, 37–38 | `expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);`<br>`expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 520);` | Checks that minions spawn outside camera viewport | If viewport becomes 960, minion spawnBaseX should be `cameraX + 1000` (which naturally satisfies `>= cameraX + 480`). |
| `tests/unit/challenger_2_empirical_stress.test.ts` | 80, 94–95 | `expect(entity.position.x).toBeGreaterThanOrEqual(camX + 480);`<br>`expect(entity.position.x).toBeGreaterThanOrEqual(camX + 520);` | Asserts wave spawn invariant | Satisfied automatically when spawnBaseX >= camX + 1000. |
| `tests/unit/empirical_physics_spawning_challenge.test.ts` | 385, 409, 413, 416 | `const viewportMaxX = camX + 480;`<br>`expect(spawnX).toBeGreaterThan(viewportMaxX);` | Spawner coordinate invariant test | Compatible if spawnX is placed beyond camera view. |
| `tests/unit/render_components.test.ts` | 256–266 | `CanvasRenderer.calculateLetterbox(480, 270)`<br>`CanvasRenderer.calculateLetterbox(960, 540)` | Tests letterbox math against static `VIRTUAL_WIDTH` / `HEIGHT` | If `VIRTUAL_WIDTH = 960`, `calculateLetterbox(960, 540)` yields `scale: 1.0`, and `(1920, 1080)` yields `scale: 2.0`. Update test expectations. |
| `tests/unit/adversarial_ultimate_challenge.test.ts` | 35, 73, 77, 106, 129 | Hardcoded `defaultViewport = { x: 0, y: 0, width: 480, height: 270 }` and tests `x = 479` vs `481`. | Test supplies its OWN local test viewport object | **Zero changes needed** — passes cleanly because it uses its own local viewport object. |
| `tests/unit/input_and_hud.test.ts` | 156, 183, 204, 227 | `createCanvasBuffer(480, 270)` | Allocates local test buffer | Works regardless of default renderer resolution. |

### 7.2 Safe Migration Architecture
By adopting **Clean Decoupling**:
1. Keep the base coordinate space or scale factor well-defined.
2. In `CanvasRenderer`, define `VIRTUAL_WIDTH = 960` and `VIRTUAL_HEIGHT = 540`.
3. In `main.ts`, spawn coordinates scale with `cameraX + CanvasRenderer.VIRTUAL_WIDTH + 40` (e.g. `cameraX + 1000`), which strictly satisfies all legacy assertions checking `>= cameraX + 480` and `>= cameraX + 520`!
4. Only `tests/e2e/game_initialization.spec.ts` (lines 40–41) and `tests/unit/render_components.test.ts` (lines 256–273) need their numeric assertions updated to match the new 960x540 standard.

---

## 8. Architectural Recommendations & Action Plan

### Recommended Target Architecture: 960x540 Crisp Widescreen HD
1. **Resolution & Canvas**:
   - `CanvasRenderer.VIRTUAL_WIDTH = 960`, `CanvasRenderer.VIRTUAL_HEIGHT = 540`.
   - Physical `<canvas>` initialized at 960x540. CSS `max-width: 100%; max-height: 100%; object-fit: contain;` handles any display window crisply.
   - 2x integer scale from classic 480x270; 0.5x integer scale from 1920x1080 Full HD. Eliminates fractional pixel blur entirely.
2. **Camera & Arena Boundaries**:
   - Camera viewport: 960x540.
   - Deadzones: `deadzoneLeft: 336 px (35%)`, `deadzoneRight: 432 px (45%)`.
   - Boss arena: expand from 480 px to **1,100 px** (`minX: 2400, maxX: 3500`).
   - Player will now have over 800 px of tactical maneuvering room during boss battles, completely eliminating the claustrophobic feeling!
3. **Parallax Background**:
   - Update `ParallaxBackground.VIEWPORT_WIDTH = 960`, `VIEWPORT_HEIGHT = 540`.
   - Increase buffer widths to 1,920 px and implement modular `while (drawX < viewportWidth)` drawing.
   - Shift color palettes to vibrant, sunny tropical dawn: bright cyan sky, golden sun, turquoise ocean waves with foaming crests, and swaying emerald palm trees.
4. **Cute / Charming Art Direction**:
   - Re-proportion Marco and Rebel soldiers with expressive chibi-arcade proportions (larger animated eyes, bouncing breathing idles, comical death and panic reactions).
   - POWs get bushy golden beards, sparkling eyes, and comical military salutes.
   - HUD gets arcade rounded badges with metallic gold bevels and animated flame/bomb badges.
5. **Level Design (Multi-Tier Terrain)**:
   - Ground floor at Y: 460.
   - Tier 1 platforms at Y: 360 (wooden piers, sandbag bunkers).
   - Tier 2 platforms at Y: 260 (elevated rope bridges, watchtowers).
   - Destructible crates and red explosive barrels.

This survey establishes the complete technical foundation for the implementer swarm to execute the overhaul flawlessly.
