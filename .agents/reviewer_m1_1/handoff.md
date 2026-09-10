# Handoff Report: Review & Adversarial Audit for Milestone M1 (16:9 HD Screen & Viewport Expansion)

**Reviewer / Critic**: `reviewer_m1_1`  
**Verdict**: **APPROVE**  
**Date**: 2026-09-10T10:11:00+09:00  

---

## Review Summary

**Verdict**: **APPROVE**  
Milestone 1 satisfies all core deliverables:
1. Native 16:9 widescreen HD framebuffer (`CanvasRenderer.VIRTUAL_WIDTH = 960`, `VIRTUAL_HEIGHT = 540`).
2. Camera system modernized with 960x540 defaults, 44% deadzone boundary yielding 538px forward reaction view (>528px required), and expanded 1100px boss arenas (`minX: 720, maxX: 1820` and `minX: 1800, maxX: 2900`).
3. Seamless modular parallax tiling (`while (drawX < W)`) with double-buffered 1920px layers and radiant coastal/tropical palette.
4. Expressive chibi-arcade aesthetic enhancements (specular sparkle eye glints, warm cheek blush, fluttering headband tails with golden fringe tips, bouncy idle/run cycles) while strictly preserving the 164 baseline sprite key invariant.
5. Dynamic HUD text measurement (`measurePixelText`) and edge-to-edge banners.
6. Zero integrity violations: implementation contains authentic procedural rendering and mathematical logic, no facades, no bypassed tasks, no hardcoded cheating.
7. Build and test verification: `npx tsc --noEmit` (0 errors), `npm run build` (success in 305ms), `npm test` (`vitest run`: 35 of 35 test files passed, 464 of 464 tests passed 100%).

---

## 1. Observation

### 1.1 Source Code Inspections
- **`src/render/CanvasRenderer.ts`**:
  - Lines 159-160:
    ```typescript
    public static readonly VIRTUAL_WIDTH = 960;
    public static readonly VIRTUAL_HEIGHT = 540;
    ```
  - Lines 176-186:
    ```typescript
    this.virtualBuffer = createCanvasBuffer(CanvasRenderer.VIRTUAL_WIDTH, CanvasRenderer.VIRTUAL_HEIGHT);
    ...
    this.camera = options?.camera ?? new Camera({ viewportWidth: CanvasRenderer.VIRTUAL_WIDTH, viewportHeight: CanvasRenderer.VIRTUAL_HEIGHT });
    ```
  - Lines 197-208:
    ```typescript
    public static calculateLetterbox(destWidth: number, destHeight: number): LetterboxBounds {
      const scale = Math.min(
        destWidth / CanvasRenderer.VIRTUAL_WIDTH,
        destHeight / CanvasRenderer.VIRTUAL_HEIGHT
      );
      const width = Math.floor(CanvasRenderer.VIRTUAL_WIDTH * scale);
      const height = Math.floor(CanvasRenderer.VIRTUAL_HEIGHT * scale);
      const offsetX = Math.floor((destWidth - width) / 2);
      const offsetY = Math.floor((destHeight - height) / 2);
      return { scale, offsetX, offsetY, width, height };
    }
    ```

- **`src/render/Camera.ts`**:
  - Lines 60-74:
    ```typescript
    this.viewportWidth = options.viewportWidth ?? 960;
    this.viewportHeight = options.viewportHeight ?? 540;
    this.forwardLock = options.forwardLock ?? true;
    ...
    this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);
    this.deadzoneRight = this.viewportWidth >= 960 ? Math.floor(this.viewportWidth * 0.44) : Math.floor(this.viewportWidth * 0.45);
    this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);
    this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70);
    ```
  - Forward sight calculation on 960 width: `deadzoneRight = Math.floor(960 * 0.44) = 422`. Forward view = `960 - 422 = 538px` (> 528px requirement).
  - Lines 36-41: Default `bounds.maxY = 540`.

- **`src/render/ParallaxBackground.ts`**:
  - Lines 21-22:
    ```typescript
    public static readonly VIEWPORT_WIDTH = 960;
    public static readonly VIEWPORT_HEIGHT = 540;
    ```
  - Line 36: `private bufferWidth: number = 1920;`
  - Lines 59-97: Sunny Coastal palette featuring sky bands (`#1B6CA8`, `#2980B9`, `#3498DB`, `#AED6F1`, `#F9E79F`, `#FDEBD0`), sun corona and halo (`rgba(255, 245, 180, 0.15)`, `rgba(255, 235, 140, 0.35)`, `#FFF9D2`).
  - Lines 381-388: Modular horizontal wrapping algorithm:
    ```typescript
    const renderTiledLayer = (buffer: CanvasBuffer, factor: number) => {
      const offset = ((cameraX * factor) % this.bufferWidth + this.bufferWidth) % this.bufferWidth;
      let drawX = -Math.floor(offset);
      while (drawX < W) {
        ctx.drawImage(buffer as any, drawX, 0);
        drawX += this.bufferWidth;
      }
    };
    ```

- **`src/render/sprites/ProceduralSpriteFactory.ts`**:
  - Lines 709-734: Marco Rossi chibi enhancements: large eye sclera (`#FFFFFF`), large dark arcade pupil (`P[1]`), sparkling specular glints (`#FFFFFF`), warm rosy cheek blush (`rgba(255, 110, 110, 0.4)`), fluttering headband tails with golden fringe tips (`#FF5533`, `P[2]`).
  - Lines 848-874: Bouncy breathing bobbing and springy run cycle offsets.
  - Lines 1018-1021: Rebel soldier expressive comical arcade eyes with specular highlights.
  - Lines 1480-1484: POW hostage expressive cartoon eyes and rosy cheeks.
  - Invariant preservation: `factory.count() === 164` with strictly 0 new or deleted baseline keys.

- **`src/ui/HUDOverlay.ts`**:
  - Lines 439-450:
    ```typescript
    public measurePixelText(text: string, scale: number = 1.0): number {
      const s = Math.max(1, Math.round(scale));
      let width = 0;
      const upper = text.toUpperCase();
      for (let i = 0; i < upper.length; i++) {
        const ch = upper[i];
        const bitmap = PIXEL_FONT[ch] ?? PIXEL_FONT[' '];
        const charWidth = bitmap[0].length;
        width += (charWidth + 1) * s;
      }
      return width;
    }
    ```
  - Lines 270-309, 331-350, 354-388, 391-410: Banners (Warning, Pause, Stage Clear, Game Over) dynamically read `ctx.canvas?.width ?? 960` and center text via `Math.round((width - textW) / 2)`.

- **`src/main.ts`**:
  - Lines 713-714: `STAGE_WIDTH = 3600; STAGE_HEIGHT = 540;`
  - Line 719: `ground_main`: `createAABB(0, 230, STAGE_WIDTH, 310)`
  - Lines 757, 771, 816: Spawning coordinates: `cameraX + Math.max(1000, CanvasRenderer.VIRTUAL_WIDTH + 40)` (strictly off-screen right edge of 960 viewport).
  - Lines 787, 831: Mid-boss arena lock `{ minX: 720, maxX: 1820, minY: 0, maxY: 540 }` (1100px width), End-boss arena lock `{ minX: 1800, maxX: 2900, minY: 0, maxY: 540 }` (1100px width).

- **`index.html`**:
  - Lines 31-43: `canvas` styled with `aspect-ratio: 16 / 9;`, `object-fit: contain;`, `image-rendering: pixelated;`.

### 1.2 Verbatim Verification Tool Executions
1. `npx tsc --noEmit`
   - Exit code: 0
   - Output: Empty (0 type errors).
2. `npm run build`
   - Exit code: 0
   - Output:
     ```
     > fullmetalslug@1.0.0 build
     > tsc -b && vite build
     vite v6.4.3 building for production...
     ✓ 44 modules transformed.
     dist/index.html                  1.36 kB │ gzip:  0.60 kB
     dist/assets/index-CmkJZIRR.js  258.84 kB │ gzip: 65.14 kB │ map: 929.76 kB
     ✓ built in 305ms
     ```
3. `npm test` (`vitest run`)
   - Exit code: 0
   - Output:
     ```
     Test Files  35 passed (35)
          Tests  464 passed (464)
       Duration  1.74s
     ```
4. `npx playwright test tests/e2e/game_initialization.spec.ts`
   - Exit code: 0
   - Output:
     ```
     Running 3 tests using 1 worker
       ✓ 1 should boot headless browser, mount game container, and render canvas with zero fatal console errors (251ms)
       ✓ 2 should maintain 60 FPS animation loop stably over 300 frames without crashing (3.8s)
       ✓ 3 should expose __GAME__, __ENGINE__, __AUDIO_CTX__ and respond to player input and stage progression (116ms)
       3 passed (4.5s)
     ```
5. `npx playwright test tests/e2e/visual_verification.spec.ts`
   - Exit code: 0 (6 passed in 1.5s).
6. `npx playwright test tests/e2e/death_animations_screenshots.spec.ts`
   - Exit code: 0 (3 passed in 950ms).
7. `npx playwright test tests/e2e/gameplay_controls.spec.ts`
   - Exit code: 0 (5 passed in 3.8s).

---

## 2. Logic Chain

1. **Resolution & Viewport (Observation 1.1 `CanvasRenderer.ts`, `Camera.ts`, `index.html`)**:
   - `CanvasRenderer.VIRTUAL_WIDTH = 960` and `VIRTUAL_HEIGHT = 540` create a 16:9 aspect ratio (960 / 540 = 1.7778 = 16:9).
   - In `Camera.ts`, `deadzoneRight` is `Math.floor(960 * 0.44) = 422px`. Forward reaction vision is `960 - 422 = 538px`, exceeding the >528px specification in PROJECT.md.
   - Stage dimensions and boss lockdown arenas expand to 1100px width (`1820 - 720 = 1100`, `2900 - 1800 = 1100`), ensuring players have room to maneuver without feeling cramped or claustrophobic.
   - Off-screen wave spawns are placed at `cameraX + Math.max(1000, 960 + 40)` = `cameraX + 1000`, which is 40px beyond the 960px screen boundary, eliminating minion popping while strictly satisfying the legacy `> cameraX + 480` invariant.

2. **Parallax Tiling & Palette (Observation 1.1 `ParallaxBackground.ts`)**:
   - The modular horizontal wrapping helper computes `offset = ((cameraX * factor) % 1920 + 1920) % 1920`. Since `offset >= 0`, `drawX = -Math.floor(offset)` is in `[-1919, 0]`.
   - The `while (drawX < W)` loop draws layers in increments of 1920px. For `W = 960`, drawing occurs at `drawX` and `drawX + 1920`, which completely covers `[0, 960]` without seams or clipping, regardless of camera coordinate magnitude or direction.
   - The palette replaces dark twilight tones with radiant sunny azure gradients, glowing sun halo, rolling golden dunes, and turquoise ocean water with white foam crests.

3. **Chibi Aesthetics & 164 Key Invariant (Observation 1.1 `ProceduralSpriteFactory.ts`)**:
   - Marco, Rebel, and Hostage sprites feature large expressive cartoon eyes, bright pupils with white specular glints, warm cheek blush (`rgba(255, 110, 110, 0.4)`), and dynamic headband flutter.
   - Because sprites are pre-rendered into offscreen buffers at factory initialization and cached by string key, visual enhancements incur zero per-frame runtime performance overhead.
   - `ProceduralSpriteFactory.getInstance().count() === 164` was verified across 1,000 continuous test iterations in `adversarial_m5_final_gate.test.ts`. Exactly 164 baseline keys exist, with 0 new keys introduced and 0 old keys removed.

4. **Dynamic HUD Overlay (Observation 1.1 `HUDOverlay.ts`)**:
   - `measurePixelText(text, scale)` parses the 5-row compact `PIXEL_FONT` and multiplies character widths by integer scale `s`.
   - The computed width matches the exact per-character advance in `drawPixelText`, guaranteeing mathematically centered titles for Warning, Pause, Stage Clear, and Game Over banners across arbitrary canvas widths.

5. **Build and Test Integrity (Observation 1.2)**:
   - All compilation checks, unit tests, and primary E2E tests execute cleanly and pass without errors.
   - There are no mocks bypassing real game logic, no fabricated test outputs, and no hardcoded cheating.

---

## 3. Caveats

1. **Legacy Test Invariant in `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355`**:
   - In `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355`, line 355 contains `expect(midBossStatus.boundsMaxX).toBe(1200);`.
   - This assertion was written during Gen 4 when the mid-boss arena was 480px wide (`minX: 720, maxX: 1200`).
   - Under M1, the arena was expanded to 1100px (`minX: 720, maxX: 1820`).
   - When running the Gen 4 E2E suite, this single assertion fails (`Expected: 1200, Received: 1820`).
   - Per `PROJECT.md`, E2E test hardening is scheduled for Milestone M4. Worker M1 accurately documented this caveat in their handoff. This is classified as a **Minor Finding** below.
2. **WebGL / Canvas2D Fallback**:
   - Procedural rendering relies on Canvas 2D. In headless Node test environments without DOM Canvas, `createMockCanvasBuffer` provides safe fallback. All mock context methods were verified to handle optional canvas dimensions safely.

---

## 4. Conclusion

**Verdict**: **APPROVE**  
Milestone M1 (16:9 HD Screen & Viewport Expansion) is thoroughly implemented, adheres strictly to the architectural requirements, and passes all build and unit testing gates (464/464 tests green). The visual aesthetics successfully address user feedback by adding retro arcade charm, vibrant tropical colors, and spacious widescreen framing.

---

## Findings

### [Minor] Finding 1: Legacy Mid-Boss Arena Bound Assertion in E2E Suite
- **What**: Legacy assertion `expect(midBossStatus.boundsMaxX).toBe(1200);` expects the old 480px arena maxX instead of the expanded 1100px arena maxX (1820).
- **Where**: `tests/e2e/ultimate_and_crisis_expansion.spec.ts:355`
- **Why**: Milestone 1 expanded the mid-boss lockdown bounds from `{ minX: 720, maxX: 1200 }` (480px width) to `{ minX: 720, maxX: 1820 }` (1100px width) to eliminate claustrophobia in widescreen 960x540.
- **Suggestion**: In Milestone M4 (E2E Test Hardening), update the assertion to `expect(midBossStatus.boundsMaxX).toBe(1820);` or `expect(midBossStatus.boundsMaxX - midBossStatus.boundsMinX).toBe(1100);`.

---

## Verified Claims

| Claim | Verification Method | Result |
|---|---|---|
| `CanvasRenderer.VIRTUAL_WIDTH = 960`, `VIRTUAL_HEIGHT = 540` | `view_file` on `src/render/CanvasRenderer.ts:159-160` & `tests/unit/render_components.test.ts:252` | **PASS** |
| Camera widescreen defaults (960x540, >528px forward reaction view) | `tests/unit/render_components.test.ts:237` (asserts forward view >= 528px) | **PASS** |
| Parallax modular horizontal wrapping (`while drawX < W`) | Code audit of `src/render/ParallaxBackground.ts:381-388` & rendering test in `tests/unit/render_components.test.ts:245` | **PASS** |
| ProceduralSpriteFactory 164 baseline sprite key invariant | `adversarial_m5_final_gate.test.ts` (1,000 iterations strictly asserting 164 keys) | **PASS** |
| HUDOverlay dynamic text measurement and full-width banners | Code inspection of `src/ui/HUDOverlay.ts:439-450` & `render_components.test.ts` | **PASS** |
| TypeScript compilation with zero errors | `npx tsc --noEmit` exited 0 | **PASS** |
| Production build generation | `npm run build` completed in 305ms, 44 modules transformed | **PASS** |
| Full unit test suite green | `npm test` passed 35/35 files, 464/464 tests | **PASS** |
| Browser E2E game initialization | `playwright test tests/e2e/game_initialization.spec.ts` passed 3/3 tests | **PASS** |
| Visual verification screenshot suite | `playwright test tests/e2e/visual_verification.spec.ts` passed 6/6 tests | **PASS** |

---

## Coverage Gaps
- **Multi-tier terrain and drop-through collision under 960x540 viewport**:
  - Risk Level: Low (Scoped for Milestone M2).
  - Recommendation: Proceed to M2 where platform elevation and drop-through resolution will be tested.

---

## Unverified Items
- None for Milestone 1 scope.

---

## Adversarial Review & Stress Testing Report

**Overall Risk Assessment**: **LOW**

### Integrity Audit
- **Hardcoded test returns**: None detected. Procedural routines render real geometric primitives and pixel bitmaps.
- **Dummy / facade implementations**: None detected. `CanvasRenderer`, `Camera`, `ParallaxBackground`, and `HUDOverlay` implement complete mathematical logic.
- **Bypassed tasks**: None detected. All M1 tasks specified in `PROJECT.md` were implemented directly.
- **Attestation / artifact fabrication**: None detected. Screenshots and build logs were produced by live tool commands.

### Challenges & Stress Scenarios

#### Challenge 1: Camera Frustum and Rapid Stage Panning
- **Assumption**: Fast-forward scrolling does not cause minions to spawn inside the active 960px viewport.
- **Attack Scenario**: Camera pans at speeds up to 2000 px/s (15x player run speed).
- **Stress Test Result**: `tests/unit/challenger_2_empirical_stress.test.ts` verified that across scrolling speeds from 132 to 2000 px/s, 100% of wave minions spawn strictly out of view (`cameraX + 1000 >= cameraX + 960 + 40`). **PASS**.

#### Challenge 2: Negative and Boundary Coordinates in Parallax Wrapping
- **Assumption**: Parallax background does not crash or leave visual gaps when camera is at 0, negative values, or large positive values.
- **Attack Scenario**: Negative camera offset `cameraX = -500` or extreme `cameraX = 100000`.
- **Stress Test Result**: Modulo wrapping formula `((cameraX * factor) % 1920 + 1920) % 1920` mathematically forces the initial offset into `[0, 1920)`. Starting draw coordinate `-Math.floor(offset)` is `<= 0`, and the `while (drawX < 960)` loop guarantees that two tiles covering `[drawX, drawX + 3840]` span the entire 960px viewport with no gaps. **PASS**.

#### Challenge 3: Letterbox Scaling on Non-Standard Display Resolutions
- **Assumption**: `CanvasRenderer.calculateLetterbox` handles ultrawide (21:9), vertical portrait (9:16), and exact multiple displays correctly.
- **Attack Scenario**: Tested inputs:
  - Exact 1:1 (`960x540`) -> scale = 1, offset = (0, 0)
  - 2x Integer (`1920x1080`) -> scale = 2, offset = (0, 0)
  - Ultrawide (`2400x1080`) -> scale = 2, offsetX = 240, offsetY = 0 (pillarbox)
  - Portrait (`540x960`) -> scale = 0.5625, offsetX = 0, offsetY = Math.floor((960 - 303)/2)
- **Stress Test Result**: All letterbox calculations clamp cleanly and keep the 16:9 aspect ratio without distortion. **PASS**.

---

## 5. Verification Method

To independently verify this review:
1. Run `npx tsc --noEmit` in root: Must return 0 errors.
2. Run `npm run build` in root: Must succeed and emit `dist/` bundle.
3. Run `npm test` in root: Must run all 35 test files and pass all 464 tests.
4. Run `npx playwright test tests/e2e/game_initialization.spec.ts`: Must pass 3/3 tests.
5. Run `npx playwright test tests/e2e/visual_verification.spec.ts`: Must pass 6/6 tests.
6. Inspect `src/render/CanvasRenderer.ts` lines 159-160 (`VIRTUAL_WIDTH = 960`, `VIRTUAL_HEIGHT = 540`).
7. Inspect `src/render/Camera.ts` lines 60-74 (widescreen dimensions and 44% deadzone).
8. Inspect `src/render/ParallaxBackground.ts` lines 381-388 (wrapping loop).
9. Inspect `src/render/sprites/ProceduralSpriteFactory.ts` (164 baseline keys invariant).
10. Invalidation conditions: Any TypeScript compilation error, any test failure in `npm test`, or mutation of baseline sprite keys beyond 164.
