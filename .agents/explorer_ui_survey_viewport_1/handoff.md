# Handoff Report: UI Survey & Viewport 16:9 Architecture Analysis

**Agent**: `explorer_ui_survey_viewport_1`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_viewport_1`  
**Parent Task ID**: `dc4b76ec-2c8d-41af-8152-fb6d5ed83654`  
**Date**: 2026-09-10  
**Handoff Type**: Hard (Investigation & Architecture Survey Complete)  

---

## 1. Observation

Direct observations and citations across the project files:

1. **Canvas Resolution Constants & DOM Setup**:
   - `src/render/CanvasRenderer.ts:159-164`:
     ```ts
     public static readonly VIRTUAL_WIDTH = 480;
     public static readonly VIRTUAL_HEIGHT = 270;
     ```
   - `src/main.ts:181-186`:
     ```ts
     canvas = document.createElement('canvas');
     canvas.id = 'game-canvas';
     canvas.width = CanvasRenderer.VIRTUAL_WIDTH;
     canvas.height = CanvasRenderer.VIRTUAL_HEIGHT;
     ```
   - `index.html:31-39`:
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
   - `artifacts/screenshots/screenshot_01_idle_crosshair.png` and `artifacts/screenshots/screenshot_05_combat_upgraded_sprites.png`:
     Canvas is stretched in browser from 480x270 to window size (e.g. 960x540 or 1280x720). Each pixel is scaled up 2x–4x into coarse blocks.

2. **Camera Tracking, Deadzones & Lockdown Boundaries**:
   - `src/render/Camera.ts:60-74`:
     ```ts
     this.viewportWidth = options.viewportWidth ?? 480;
     this.viewportHeight = options.viewportHeight ?? 270;
     this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);  // 168 px
     this.deadzoneRight = Math.floor(this.viewportWidth * 0.45); // 216 px
     this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);   // 81 px
     this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70);// 189 px
     ```
   - `src/main.ts:787` & `src/main.ts:831`:
     - Mid-boss arena: `lockCameraBounds: { minX: 720, maxX: 1200, minY: 0, maxY: 270 }` (width: 480 px).
     - End-boss arena: `lockCameraBounds: { minX: 1800, maxX: 2280, minY: 0, maxY: 270 }` (width: 480 px).
   - `src/render/sprites/ProceduralSpriteFactory.ts:1772`:
     ```ts
     this.registerSprite('tetsuyuki_hull_p1', 260, 140, 130, 70, (ctx) => {
     ```
     Tetsuyuki hull is 260px wide and 140px high. In a 480px wide arena, the boss consumes 54.2% of horizontal screen width and 51.9% of vertical height.

3. **Background Parallax Layers & Tiling**:
   - `src/render/ParallaxBackground.ts:22-38`:
     ```ts
     public static readonly VIEWPORT_WIDTH = 480;
     public static readonly VIEWPORT_HEIGHT = 270;
     private bufferWidth: number = 960;
     ```
   - `src/render/ParallaxBackground.ts:305-327`:
     ```ts
     const offset1 = Math.floor((cameraX * factor1) % this.bufferWidth);
     ctx.drawImage(this.mountainsBuffer as any, -offset1, 0);
     if (offset1 > this.bufferWidth - W) {
       ctx.drawImage(this.mountainsBuffer as any, this.bufferWidth - offset1, 0);
     }
     ```
     Tiling assumes `W = 480` and `bufferWidth = 960`. If `W >= bufferWidth`, this logic fails to fill the right side of the screen.

4. **HUD Hardcoded Dimensions**:
   - `src/ui/HUDOverlay.ts:268, 325, 335, 346`:
     - `renderWarningBanner`: `const width = 480;`
     - `renderPauseBanner`: `ctx.fillRect(0, 0, 480, 270);`
     - `renderStageClearBanner`: `ctx.fillRect(0, 80, 480, 80);`
     - `renderGameOverBanner`: `ctx.fillRect(0, 80, 480, 80);`

5. **Test Dependencies on Viewport Coordinates**:
   - `tests/e2e/game_initialization.spec.ts:40-41`:
     ```ts
     expect(canvasDimensions.width).toBe(480);
     expect(canvasDimensions.height).toBe(270);
     ```
   - `tests/unit/spawning_contract.test.ts:37-38`:
     ```ts
     expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);
     expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 520);
     ```
   - `tests/unit/render_components.test.ts:256-266`:
     ```ts
     const lb1 = CanvasRenderer.calculateLetterbox(480, 270); // expects scale: 1
     const lb2 = CanvasRenderer.calculateLetterbox(960, 540); // expects scale: 2
     ```
   - `npm test` runs 35 test files, 463 tests, and all 463 tests currently pass in 1.98s.

---

## 2. Logic Chain

1. **Cause of "Claustrophobic/Stifling" (답답한) Feeling**:
   - From Observation 1, the internal canvas buffer is locked to 480x270.
   - From Observation 2, the player is biased to `x = camera.x + 216`, leaving only 264px forward view. With enemy bullets moving at 280 px/s (`SoldierEnemy.ts:807`), players have only 0.94 seconds of reaction time.
   - In boss fights, Tetsuyuki's 260px hull occupies 54.2% of the locked 480px arena, leaving the player with only ~220px of movement room.
   - Therefore, the feeling of claustrophobia is directly caused by the 480x270 virtual camera boundary and the cramped 480px boss arena locks.

2. **Cause of "Not Cute/Charming" (아기자기한 느낌 없음)**:
   - From Observation 1 and visual inspection of captured screenshots (`screenshot_01_idle_crosshair.png`, `screenshot_05_combat_upgraded_sprites.png`), characters, enemies, and terrain are drawn using dark, monochromatic rectangular blocks (rigid helmet boxes, stick rifles, flat brown plank platforms).
   - From Observation 3, the background uses bleak dark slate tones (`#102040`, `#2A3648`, `#4D5866`) with simplistic cauliflower-shaped cloud stacks, rather than the sun-drenched, vibrant tropical azure shores and charming animated details of classic *Metal Slug*.
   - Therefore, the aesthetic lacks charm due to stiff character proportions, low color vibrancy, and flat, featureless platform geometry.

3. **Optimal Widescreen HD Architecture (960x540 Crisp 2x HD)**:
   - Increasing the internal canvas framebuffer from 480x270 to **960x540** represents an exact 2x integer upscale, and an exact 0.5x integer downscale from 1920x1080 (Full HD).
   - Setting `CanvasRenderer.VIRTUAL_WIDTH = 960` and `VIRTUAL_HEIGHT = 540` doubles the screen area from 129,600 to 518,400 px², cutting the boss screen footprint in half (from 54% to 27%) and expanding forward player visibility to over 528 px (nearly 2 seconds of reaction time).
   - Setting boss arena lockdown widths to 1,100px gives the player over 800px of tactical maneuvering room.
   - Tiling parallax buffers with a modular `while (drawX < viewportWidth)` loop cleanly supports 960x540 and arbitrary ultrawide displays without edge cutoffs.

4. **Test Suite Preservation**:
   - From Observation 5, all spawning tests assert `enemy.position.x >= cameraX + 480` and `>= cameraX + 520`.
   - By updating spawner base positions in `main.ts` to `cameraX + VIRTUAL_WIDTH + 40` (e.g. `cameraX + 1000`), the out-of-bounds invariant `x >= cameraX + 960` is strictly maintained, which simultaneously satisfies the legacy assertions `>= cameraX + 480` and `>= cameraX + 520`.
   - Only `tests/e2e/game_initialization.spec.ts:40-41` (asserting 480x270) and `tests/unit/render_components.test.ts:256-266` (asserting letterbox scaling) need mechanical updates to match 960x540.

---

## 3. Caveats

1. **Stage Height vs Multi-Tier Verticality**: If stage height remains at 270, expanding the camera height to 540 would expose void space. Therefore, the level layout overhaul must set `STAGE_HEIGHT = 540`, place the primary ground at `Y: 460`, and distribute multi-tiered platforms across Y: 160, 260, and 360.
2. **Touch Virtual Pad Placement**: On mobile devices, touch controls currently assume a 480x270 layout. Touch button coordinates in `TouchVirtualPad.ts` must use percentage or viewport-relative placement to accommodate 960x540.
3. **External Asset Independence**: All graphics must remain 100% procedural Canvas 2D sprites in `ProceduralSpriteFactory.ts` without relying on external image files to maintain offline test reliability.

---

## 4. Conclusion

1. **Adopt 960x540 Internal Resolution**: Set `CanvasRenderer.VIRTUAL_WIDTH = 960` and `VIRTUAL_HEIGHT = 540`. Set `<canvas>` dimensions to 960x540 with pixelated CSS scaling.
2. **Expand Boss Arenas**: Expand mid-boss and end-boss lockdown camera widths to 1,100px (`minX: 2400, maxX: 3500`), completely resolving the claustrophobic feeling.
3. **Overhaul Level Geometry to Multi-Tier**: Ground at Y: 460, Tier 1 at Y: 360, Tier 2 at Y: 260, Tier 3 at Y: 160, with destructible barricades and explosive barrels.
4. **Infuse "Cute/Charming" (아기자기한) Visual Touch**:
   - Expressive chibi-arcade proportions (larger head ratio, wide cartoon eyes, fluttering headband, bouncing breathing idles).
   - Comical Rebel minion poses (yawning, eating chicken drumsticks, wide-eyed panicked shock frames).
   - Charming POWs with bushy curly beards, sparkling eyes, and animated thumbs-up salute.
   - Tropical coastal dawn palette: azure sky, golden sun, turquoise ocean waves with foaming crests, and emerald green palms.
   - Rounded metallic arcade HUD badges with sparkling grenade fuses.
5. **Update Affected Tests**: Update `game_initialization.spec.ts` to verify 960x540 and update letterbox calculation tests in `render_components.test.ts`.

---

## 5. Verification Method

To independently verify these findings:

1. **Run Current Test Suite**:
   ```bash
   cd /Users/user/src/fullmetalslug && npm test
   ```
   Confirm 35 test files and 463 tests pass.
2. **Inspect Screen Resolution Constants**:
   ```bash
   grep -n "VIRTUAL_WIDTH" /Users/user/src/fullmetalslug/src/render/CanvasRenderer.ts
   grep -n "canvas.width" /Users/user/src/fullmetalslug/src/main.ts
   ```
3. **Inspect Boss Dimensions vs Viewport**:
   ```bash
   grep -n "tetsuyuki_hull" /Users/user/src/fullmetalslug/src/render/sprites/ProceduralSpriteFactory.ts
   grep -n "lockCameraBounds" /Users/user/src/fullmetalslug/src/main.ts
   ```
4. **Inspect Test Invariants**:
   ```bash
   grep -n "toBe(480)" /Users/user/src/fullmetalslug/tests/e2e/game_initialization.spec.ts
   grep -n "cameraX + 480" /Users/user/src/fullmetalslug/tests/unit/spawning_contract.test.ts
   ```
5. **Visual Confirmation**:
   Inspect existing screenshots in `artifacts/screenshots/` and `artifacts/expansion/` to observe the cramped layout, flat terrain, and rigid sprite shapes.
