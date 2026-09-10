# Empirical Challenge Report: Milestone M1 (Viewport, Camera, Parallax & Sprite Invariants)

## 1. Observation

### A. Non-Standard Resolution Letterboxing
- **Implementation**: `src/render/CanvasRenderer.ts` lines 197-208 (`CanvasRenderer.calculateLetterbox`):
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
- **Empirical Test Results** (`tests/unit/challenger_m1_viewport_stress.test.ts`):
  1. `2560x1080` (21:9 Ultrawide): `scale = 2.0`, `width = 1920`, `height = 1080`, `offsetX = 320`, `offsetY = 0`. Symmetrical horizontal pillarboxing with 320px black margins on left and right.
  2. `1024x768` (4:3 CRT): `scale = 1.06666...`, `width = 1024`, `height = 576`, `offsetX = 0`, `offsetY = 96`. Symmetrical vertical letterboxing with 96px black margins on top and bottom.
  3. `800x800` (1:1 Square): `scale = 0.83333...` (5/6), `width = 800`, `height = 450`, `offsetX = 0`, `offsetY = 175`. Symmetrical vertical letterboxing with 175px margins on top and bottom.
  4. `1080x1920` (9:16 Vertical Mobile): `scale = 1.125`, `width = 1080`, `height = 607`, `offsetX = 0`, `offsetY = 656`. Symmetrical vertical letterboxing with 656px margins on top and bottom.
  5. `5120x1440` (32:9 Super-Ultrawide): `scale = 2.6666...`, `width = 2560`, `height = 1440`, `offsetX = 1280`, `offsetY = 0`.
  6. `7680x4320` (8K UHD): `scale = 8.0`, `width = 7680`, `height = 4320`, `offsetX = 0`, `offsetY = 0`.
  7. `1x1` (Degenerate Minimum): `scale = 0.0010416...`, `width = 0`, `height = 0`, `offsetX = 0`, `offsetY = 0`. Zero NaN or Infinity.
  8. `1920.7x1080.4` (Fractional High-DPI): All outputs integer-floored (`width = 1920`, `height = 1080`, `offsetX = 0`, `offsetY = 0`), preventing fractional pixel seam artifacts.
  9. `blitToCanvas` verification: Validated mock canvas 2D context receiving `fillRect(0, 0, 2560, 1080)` to clear margins in solid `#000000` followed by `drawImage` blitting the 960x540 virtual buffer to `(320, 0, 1920, 1080)`.

### B. Parallax Horizontal Wrapping at Extreme Camera X Coordinates
- **Implementation**: `src/render/ParallaxBackground.ts` lines 380-388 (`renderTiledLayer`):
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
- **Empirical Test Results** (`tests/unit/challenger_m1_viewport_stress.test.ts`):
  - Tested `cameraX` points: `x = 1920` (1 buffer width), `x = 3840` (2 buffer widths), `x = 100,000` (extreme forward coordinate), `x = 0`, `x = 480`, `x = 960`, `x = -1920`, `x = -100,000`, `x = 1234.567`, `x = 999999.85`.
  - For all 3 scrolling layers (0.2x mountains, 0.5x ruins, 1.0x foreground):
    - `drawX` values are strictly finite (`Number.isFinite(drawX) === true`, `!Number.isNaN(drawX)`).
    - Contiguous tiling: for multi-strip layers, adjacent strips touch with zero gap (`strips[1].drawX === strips[0].drawX + 1920`).
    - Full viewport coverage: initial strip starts at `drawX <= 0` and final strip terminates at `drawX + 1920 >= 960`, guaranteeing 100% continuous coverage of `[0, 960]` with zero missing strips or black holes.
    - Loop safety: the `while (drawX < W)` loop executes at most 2 iterations per layer, completely eliminating the risk of runaway execution or infinite loops.
    - High-frequency sweep: verified 1,000 camera steps from `x = 0` to `x = 20,000` executing in 12ms.

### C. ProceduralSpriteFactory 164-Key Invariant
- **Implementation**: `src/render/sprites/ProceduralSpriteFactory.ts`:
  - `ProceduralSpriteFactory.getInstance()` singleton accessor.
  - `count(includePolish = false, includeExpansion = false): number`.
  - `getAllKeys(includePolish = false, includeExpansion = false): string[]`.
- **Empirical Test Results** (`tests/unit/challenger_m1_viewport_stress.test.ts`):
  - 1,000 consecutive calls to `getInstance()`: `count()` returned strictly `164` every time.
  - Set uniqueness: `new Set(getAllKeys()).size === 164` (0 duplicate keys).
  - Fresh instances: `new ProceduralSpriteFactory()` independently registers exactly 164 baseline keys.
  - Idempotency: repeated `.init()` calls do not duplicate keys or mutate key count.
  - Asset validity: all 164 keys map to defined `SpriteFrame` objects with `width > 0`, `height > 0`, and valid canvas buffers.
  - Drawing robustness: all 164 sprites render without exception in `drawSprite`; bogus keys (`""`, `'non_existent_key_999'`) return `false` cleanly without throwing errors.

### D. Widescreen Camera Deadzone & Boss Arena Bounds
- **Implementation**: `src/render/Camera.ts` lines 70-74, `src/main.ts` lines 86-90:
  - `Camera.viewportWidth = 960`, `Camera.viewportHeight = 540`.
  - `deadzoneRight = Math.floor(viewportWidth * 0.44)` = 422px.
  - Forward reaction view = `960 - 422 = 538px` (satisfies `>= 528px` requirement).
  - Mid-Boss arena: `{ minX: 720, maxX: 1820 }` -> `1820 - 720 = 1100px`.
  - End-Boss arena: `{ minX: 1800, maxX: 2900 }` -> `2900 - 1800 = 1100px`.

### E. Verbatim Verification Commands and Output
1. `npx vitest run tests/unit/challenger_m1_viewport_stress.test.ts`:
   - Output: `Test Files: 1 passed (1), Tests: 19 passed (19), Duration: 381ms`.
2. `npm test` (`vitest run` across whole test suite):
   - Output: `Test Files: 37 passed (37), Tests: 500 passed (500), Duration: 2.10s`.
3. `npx tsc --noEmit`:
   - Output: Exit code `0` (zero TypeScript errors).
4. `npm run build` (`tsc -b && vite build`):
   - Output: `✓ 44 modules transformed. dist/assets/index-CmkJZIRR.js 258.84 kB. built in 291ms. Exit code 0`.
5. `npx playwright test tests/e2e/game_initialization.spec.ts`:
   - Output: `3 passed (5.1s)`.
6. `npx playwright test tests/e2e/visual_verification.spec.ts`:
   - Output: `6 passed (1.6s)`.
7. `npx playwright test tests/e2e/gameplay_controls.spec.ts`:
   - Output: `5 passed (4.2s)`.
8. `npx playwright test tests/e2e/death_animations_screenshots.spec.ts`:
   - Output: `3 passed (1.3s)`.

---

## 2. Logic Chain

1. **Resolution Scaling & Centering**:
   - `destWidth` and `destHeight` are divided by virtual dimensions (960 and 540). Taking `Math.min` ensures the aspect ratio of 16:9 is preserved without cropping or non-uniform stretching.
   - Using `Math.floor` on width, height, and offsets ensures integer canvas coordinates, preventing subpixel jitter and blurry seams on canvas edges.
   - For all aspect ratios wider than 16:9 (e.g. 21:9 at 2560x1080), height scales to 1080 and horizontal margins of 320px pillarbox each side.
   - For all aspect ratios taller than 16:9 (e.g. 4:3, 1:1, 9:16), width scales to container width and vertical margins letterbox top and bottom.

2. **Parallax Continuity at Extreme X**:
   - The double-modulo arithmetic `((cameraX * factor) % bufferWidth + bufferWidth) % bufferWidth` maps any real `cameraX` into the range `[0, bufferWidth)`.
   - Starting `drawX` at `-Math.floor(offset)` guarantees that the first strip starts at or before `x = 0`.
   - Because `bufferWidth = 1920` is double `VIEWPORT_WIDTH = 960`, a single buffer span covers the entire visible screen whenever `offset <= 960`.
   - When `offset > 960`, the second strip starts at `drawX + 1920 > 960`, covering up to `3840 - offset >= 1920 > 960`.
   - Thus, 1 or 2 strips are mathematically guaranteed to cover the full viewport `[0, 960]` with contiguous alignment, zero gaps, zero missing strips, and zero risk of infinite loop.

3. **Sprite Factory Key Stability**:
   - Categorization sets `polishKeys` and `expansionKeys` isolate late-cycle additions from the baseline 164 keys.
   - When queried via `getAllKeys()` and `count()`, filtering against these sets returns strictly the 164 baseline keys with identical ordering and zero leaks.
   - Idempotency guard (`if (this.initialized) return;`) prevents duplication even under multi-threaded or redundant init cycles.

---

## 3. Caveats

- In `tests/e2e/ultimate_and_crisis_expansion.spec.ts` (Scenario 2, test 2.1), there is an un-updated assertion checking `expect(midBossStatus.boundsMaxX).toBe(1200)`. Because Milestone 1 intentionally expanded the mid-boss arena to 1100px width (`boundsMaxX === 1820`), this legacy test expects 1200. This file is owned by Milestone 4/orchestrator and will be adapted when the crisis tests are harmonized with the new arena boundaries.
- No other caveats. All unit tests (500/500), type checks (0 errors), and build scripts (291ms) pass completely.

---

## 4. Conclusion

### **VERDICT: APPROVE**

The Milestone 1 viewport, camera, parallax, and sprite engine implementations satisfy all functional, architectural, and adversarial requirements:
1. Letterbox / pillarbox calculations are mathematically proven and empirically verified across standard and extreme non-standard resolutions (21:9, 4:3, 1:1, 9:16 mobile, 32:9 super-ultrawide, 8K, 1x1, and fractional dimensions).
2. Parallax horizontal wrapping is robust against extreme camera X coordinates (`x = 0, 1920, 3840, 100,000, -100,000, 1e6`), with 0 NaN, 0 infinite loops, and 100% contiguous viewport coverage with zero missing strips.
3. ProceduralSpriteFactory 164-key invariant holds strictly across 1,000 continuous factory calls, fresh instance instantiations, and redundant initialization cycles.
4. Camera forward deadzone provides 538px reaction view (>= 528px requirement), and boss arenas provide 1100px maneuvering space.
5. All 37 Vitest test suites (500 tests) pass with 100% green status, `npx tsc --noEmit` returns 0 errors, and `npm run build` succeeds cleanly.

---

## 5. Verification Method

To independently reproduce and verify all empirical findings:
1. Run the dedicated challenger stress test suite:
   ```bash
   npx vitest run tests/unit/challenger_m1_viewport_stress.test.ts
   ```
   *Expected*: 19/19 tests pass in < 400ms.
2. Run the complete project unit test suite:
   ```bash
   npm test
   ```
   *Expected*: 37/37 test files pass, 500/500 tests pass (100% green).
3. Run TypeScript type checker:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Exits with code 0 (zero errors).
4. Run production build:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code 0 in ~300ms, transforms 44 modules cleanly.
5. Run Playwright E2E suites:
   ```bash
   npx playwright test tests/e2e/game_initialization.spec.ts
   npx playwright test tests/e2e/visual_verification.spec.ts
   npx playwright test tests/e2e/gameplay_controls.spec.ts
   npx playwright test tests/e2e/death_animations_screenshots.spec.ts
   ```
   *Expected*: All 17 tests across the 4 suites pass cleanly.
