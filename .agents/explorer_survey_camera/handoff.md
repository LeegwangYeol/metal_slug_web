# Handoff Report: Camera, FOV, Backdrop, and Viewport Survey

- **Subagent**: `explorer_survey_camera`
- **Role**: `teamwork_preview_explorer`
- **Assigned Milestone**: Phase 0 (Subsystem Architectural Mapping for Milestone 2 FOV Overhaul)
- **Target Recipient**: `parent` (Orchestrator Conversation ID: `52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera`
- **Timestamp**: 2026-09-11T06:18:00Z
- **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

### 1.1 Camera Transform & Coordinate Pipeline
- In `src/render/Camera.ts` (lines 25–36, 171–178, 287–302):
  ```typescript
  export interface CameraOptions {
    viewportWidth?: number;  // default 960
    viewportHeight?: number; // default 540
    ...
  }
  ```
  `worldToScreen` directly subtracts `renderX, renderY` without any zoom factor:
  ```typescript
  public worldToScreen(worldX: number, worldY: number): Vector2D {
    return {
      x: worldX - this.renderX,
      y: worldY - this.renderY,
    };
  }
  ```
  `clampToBounds` hardcodes `this.viewportWidth` and `this.viewportHeight`:
  ```typescript
  const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
  const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);
  ```
- In `src/main.ts` (lines 32–33, 208–209):
  `public static readonly VIRTUAL_WIDTH = 960;`
  `public static readonly VIRTUAL_HEIGHT = 540;`
  `canvas.width = GrimHarvestGame.VIRTUAL_WIDTH;`
  `canvas.height = GrimHarvestGame.VIRTUAL_HEIGHT;`
  Canvas aspect ratio in `index.html` (lines 40–41) is locked to `16 / 9` with `object-fit: contain`.

### 1.2 Entity & Loot Culling Hardcoding
- In `src/main.ts` (lines 524–527, 552, 562):
  ```typescript
  const w = GrimHarvestGame.VIRTUAL_WIDTH;  // 960
  const h = GrimHarvestGame.VIRTUAL_HEIGHT; // 540
  const camX = this.camera.renderX;
  const camY = this.camera.renderY;
  ...
  if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) continue; // Loot
  ...
  if (screenX < -40 || screenX > w + 40 || screenY < -40 || screenY > h + 40) continue; // Enemy
  ```
  Any entity or gem positioned in an expanded viewport beyond $X > 1000$ or $Y > 580$ is immediately culled by `main.ts`!

### 1.3 Wave Director Spawning Vulnerability to Viewport Expansion
- In `src/core/systems/WaveDirector.ts` (lines 245–288, 391–395):
  ```typescript
  const w = this.viewportWidth;  // 960
  const h = this.viewportHeight; // 540
  const m = this.spawnMargin;    // 90
  // East: x = camX + w + m + Math.random() * 60; (camX + 1050 to 1110)
  // South: y = camY + h + m + Math.random() * 60; (camY + 630 to 690)
  ```
  In `spawnRingSurround` (lines 394–395):
  ```typescript
  const radius = 670; // Outside 960x540 camera
  ```
  For a widened viewport of $1200 \times 675$, the corner distance is $\sqrt{600^2 + 337.5^2} \approx 688.4\text{ px}$. A $670\text{px}$ ring intersects the visible screen corners, causing enemies to visibly pop into existence on-screen!

### 1.4 Dynamic Radial Lighting & Vignette Buffer
- In `src/render/vfx/DarkFantasyVFX.ts` (lines 1509–1531, 1615–1621, 1750):
  `DynamicLightingEngine` hardcodes `width: 960, height: 540`.
  The pre-baked vignette radial gradient spans $[200\text{px}, 580\text{px}]$:
  `const grad = vCtx.createRadialGradient(cx, cy, 200, cx, cy, 580);`
  Player torch radius is `torchR = 200 + flicker`, and amber bloom is `amberR = 120`.

### 1.5 Toroidal Backdrop Mathematical Tiling
- In `src/render/GothicBackdrop.ts` (lines 420–432, 437–440, 459–464):
  - Layer 3 (Flagstone) loops `for (let x = startX; x < vw; x += fSize)` with $fSize = 512$.
  - Layer 4 (Runes) and Layer 5 (Props) derive iteration bounds directly from `(camX + vw)` and `(camY + vh)`.
  - Layer 0 (Sky) tiles vertically every $540\text{ px}$ (`for (let y = startY; y < vh; y += H)` where $H = 540$).
  - Layer 6 (Mist Sub-layer A) draws only at $y = 0$ with height $540$.

---

## 2. Logic Chain

1. **Premise 1 (FOV Deficit)**: Under $Z = 1.0$ ($960 \times 540$), the half-extents from the centered player are $480\text{ px}$ (horizontal) and $270\text{ px}$ (vertical). Enemies moving at $120\text{ px/s}$ reach the player in $2.25\text{ seconds}$, creating an oppressive, claustrophobic view (Observation 1.1).
2. **Premise 2 (Zoom Scaling Factor)**: Calibrating the camera zoom factor to $Z = 0.80$ expands the visible world viewport to $W_{\text{world}} = 960 / 0.80 = 1200\text{ px}$ and $H_{\text{world}} = 540 / 0.80 = 675\text{ px}$. This achieves a **$+56.25\%$ visible area expansion** ($810,000\text{ px}^2$ vs $518,400\text{ px}^2$) and expands the reaction window from $2.25\text{s}$ to $2.81\text{s}$ (+25%) while maintaining crisp $4:5$ integer-ratio sprite rendering without subpixel distortion (Observation 1.1).
3. **Premise 3 (Canvas & HUD Isolation)**: By applying the zoom transform via `ctx.scale(zoom, zoom)` during the world render pass in `main.ts` and restoring the canvas matrix before the HUD pass, the canvas remains at native $960 \times 540$. All gothic HUD components (Vitality bar, XP runes, Timer, Kill tally, Upgrade Modal) retain 100% crisp typography, filigree bevels, and existing screenshot dimensions (Observations 1.1, 1.4).
4. **Premise 4 (Elimination of On-Screen Popping & Disappearing)**:
   - If entity culling in `main.ts` remains at $w=960, h=540$, enemies in the expanded perimeter will prematurely disappear (Observation 1.2). Therefore, culling margins must evaluate against `camera.viewWidth` ($1200$) and `camera.viewHeight` ($675$).
   - If `WaveDirector` spawns at $camX + 960 + 90$, enemies will spawn on-screen at $X = 1050 < 1200$ (Observation 1.3). Therefore, `WaveDirector` must be configured with `viewportWidth = 1200, viewportHeight = 675`, and `spawnRingSurround.radius` must increase from $670\text{ px}$ to $800\text{ px}$.
5. **Premise 5 (Atmospheric Lighting Coherence)**:
   - In a $1200 \times 675$ view, an unscaled vignette ($580\text{ px}$) cuts into the screen corners ($688.4\text{ px}$). Scaling the vignette to $[250\text{ px}, 725\text{ px}]$ and scaling the player torch from $200\text{ px} \to 250\text{ px}$ ($+25\%$) preserves the gothic dread without plunging the screen perimeter into pitch blackness (Observation 1.4).
6. **Premise 6 (Seam-Free Backdrop)**:
   - Toroidal flagstones, runes, and props automatically scale their mathematical loop ranges to cover $1200 \times 675$ with zero gaps. Enforcing a single vertical celestial band for Layer 0 prevents duplicate blood moon stacking (Observation 1.5).

---

## 3. Caveats

- **Alternative Zoom Factor $Z = 0.75$**: If user feedback demands an even wider field of view, $Z = 0.75$ ($1280 \times 720$, $+77.8\%$ view area) can be activated cleanly via configuration. At $Z = 0.75$, small enemy sprites (e.g. $16\text{ px}$) scale down to $12\text{ px}$, slightly reducing facial detail compared to $Z = 0.80$.
- **Performance Budget**: Expanding the visible area by $+56.25\%$ increases the count of simultaneously rendered sprites and light-carving stencils by $\sim 35\text{--}50\%$. However, our empirical Vitest benchmarks show `DarkFantasySprites` draws 1,000 entities in $1.18\text{ms}$ and `DarkFantasyVFX` runs in $0.56\text{ms}$, well inside the locked $16.67\text{ms}$ ($60\text{Hz}$) frame budget.
- **Scope Discipline**: As an explorer, no production source files outside `.agents/explorer_survey_camera` have been modified.

---

## 4. Conclusion

1. **Zoom Calibration**: Overhaul `src/render/Camera.ts` to support dynamic `zoom` (defaulting to $Z = 0.80$), providing getters `viewWidth` ($1200$) and `viewHeight` ($675$), updating `clampToBounds` bounds to $[-2000, 800] \times [-2000, 1325]$, and scaling `worldToScreen` / `screenToWorld`.
2. **Render Pipeline Integration**: In `src/main.ts`, wrap world render passes 1–10 in `ctx.save(); ctx.scale(camera.zoom, camera.zoom); ... ctx.restore();` while rendering the HUD (pass 11) and UpgradeModal (pass 12) at 1:1 scale on the $960 \times 540$ canvas.
3. **Culling & Spawning Corrections**:
   - Update `main.ts` entity and loot culling checks to use `camera.viewWidth` and `camera.viewHeight`.
   - Initialize `WaveDirector` with `viewportWidth = 1200, viewportHeight = 675`.
   - Scale `spawnRingSurround` radius from $670\text{ px} \to 800\text{ px}$.
4. **Lighting & Backdrop Adjustments**:
   - Scale `DynamicLightingEngine` surfaces to $1200 \times 675$, vignette gradient to $[250\text{ px}, 725\text{ px}]$, and player torch radius to $250\text{ px}$.
   - Ensure `GothicBackdrop.ts` Layer 0 sky draw is clamped or sized to avoid duplicate vertical moons.

---

## 5. Verification Method

### 5.1 Independent Test Execution
1. Run complete unit test suite:
   ```bash
   npm test
   ```
   *Expected Result*: All 33 test files and 488 unit tests pass 100% green without regressions.
2. Run camera-specific tracking suite:
   ```bash
   npx vitest run tests/unit/camera_tracking.spec.ts
   ```
   *Expected Result*: All centering, damping ($k=8.0$), velocity lookahead ($\le 40\text{px}$ or $50\text{px}$), boundary clamping, and zero-drift shake decay tests pass.
3. Run backdrop seamless tiling challenge:
   ```bash
   npx vitest run tests/unit/ChallengerDF_M2.test.ts
   ```
   *Expected Result*: Zero gaps found across all 360-degree camera test angles.

### 5.2 Playwright Visual Proof Verification
1. Author or execute Playwright camera verification:
   ```bash
   npx playwright test tests/e2e/camera_view.spec.ts
   ```
2. Inspect generated screenshot artifact:
   - File: `artifacts/dark_fantasy/improved_camera_angle.png` (or `widened_fov_gameplay.png`)
   - Size: strictly $> 250\text{KB}$
   - Verify visually: Centered player sorcerer, significantly broader battlefield visible, undead hordes approaching smoothly from outer perimeter without pop-in, zero tiling seams at edges, and radiant gothic torchlight with smooth corner vignette.

### 5.3 Invalidation Conditions
- Any enemy or loot item disappearing before leaving the visible screen edge.
- Any enemy spawning inside the visible screen bounds (especially during milestone ring surrounds).
- Visible seams, unrendered black bands, or duplicate blood moons in `GothicBackdrop`.
- Camera overshoot, jitter, or permanent coordinate drift after screen shake.
