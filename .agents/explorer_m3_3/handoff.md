# Milestone 3 (Agent 19): Playwright Reliability & Flakiness Investigation Report

**Author**: Explorer 3 (Agent 19 - Playwright Reliability & Flakiness Explorer)  
**Date**: 2026-09-11  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3`  
**Target Scope**: Playwright E2E test reliability, headless browser rendering nuances, requestAnimationFrame pacing, reliable waiting strategies, and deterministic execution for Milestone 3 (`tests/e2e/hitbox_dodge.spec.ts`, `tests/e2e/camera_view.spec.ts`, and CI test runners).

---

## 1. Observation

### 1.1 Rendering Architecture & Context Inspection
- **Pure 2D Canvas Engine**: Inspection of all source rendering files confirms zero WebGL usage:
  - `src/main.ts:213`: `this.ctx = canvas.getContext('2d');`
  - `src/render/sprites/DarkFantasySprites.ts:190`: `const ctx = canvas.getContext('2d');`
  - `src/render/GothicBackdrop.ts:87`: `const ctx = canvas.getContext('2d')!;`
  - `src/render/vfx/DarkFantasyVFX.ts:1517`: `this.lightCtx = this.lightCanvas?.getContext('2d') ?? null;`
  - Grep search for `webgl` in `src/` returned 0 occurrences across the entire codebase.
- **Offscreen Procedural & Composite Stencils**:
  - `DarkFantasySprites.ts` uses cached offscreen canvases for procedural entity rasterization (Skeleton, Ghoul, Banshee, Death Knight, Necromancer, Sorcerer).
  - `DarkFantasyVFX.ts` manages 5 offscreen canvases (`lightCanvas`, `vignetteCanvas`, `torchStencilCanvas`, `spellStencilCanvas`, `pointStencilCanvas`) with composite operations:
    - `'source-over'` for dark ambient fill (`rgba(8, 6, 12, 0.88)`).
    - `'destination-out'` for torch/spell light carving.
    - `'lighter'` for additive bloom passes.

### 1.2 Playwright Configuration & Headless Chromium Flags
- In `playwright.config.ts:20-29`:
  ```typescript
  headless: true,
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1,
  trace: 'off',
  video: 'off',
  screenshot: 'only-on-failure',
  launchOptions: {
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  },
  ```
- And in `projects: [ { name: 'chromium', ... } ]` (lines 37–40):
  ```typescript
  launchOptions: {
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  },
  ```
- **Observations on Chromium Args**:
  - `--disable-gpu` disables GPU hardware acceleration, forcing Chromium to use CPU software rasterization (Skia software renderer).
  - Crucial background throttling prevention flags are **missing**:
    - `--disable-background-timer-throttling` is absent.
    - `--disable-backgrounding-occluded-windows` is absent.
    - `--disable-renderer-backgrounding` is absent.
  - When Chromium detects a tab/window is in the background, occluded, or loses focus in headless environments, it can throttle `requestAnimationFrame` down to 1–10 Hz and throttle `setTimeout` intervals.

### 1.3 Canvas DOM & Responsive CSS Nuance
- In `index.html:31-43`:
  ```css
  canvas {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    display: block;
  }
  ```
- In `src/main.ts:208-209`: `canvas.width = 960; canvas.height = 540;`.
- When CSS is `width: 100%; height: 100%`, any discrepancy in window frame size, scrollbars, or device pixel ratio causes CSS layout dimensions to deviate slightly from the 960x540 internal buffer, introducing subpixel anti-aliasing interpolation during screenshots unless explicitly pinned.
- In `tests/e2e/horde_survival.spec.ts:45-49` and `tests/e2e/restart_survival.spec.ts:45-49`, existing stable visual proof tests explicitly fix this by setting:
  ```typescript
  canvas.style.width = '960px';
  canvas.style.height = '540px';
  ```

### 1.4 Window Global Attachment & Property Discrepancy
- In `src/main.ts:614-620`:
  ```typescript
  const bootstrap = () => {
    if ((window as any).__game) return;
    const container = document.getElementById('game-container') ?? document.body;
    const game = new GrimHarvestGame(container);
    game.start();
    (window as any).__game = game;
    (window as any).__GAME__ = game;
  };
  ```
- **Critical Finding**: Only `__game` and `__GAME__` are exposed on `window`. `window.game` is **NOT** exposed!
- Any test or waiting utility querying `window.game` will encounter `undefined` and time out after 10,000ms.
- Furthermore, `bootstrap()` runs asynchronously:
  - If `document.readyState === 'loading'`, it attaches to `DOMContentLoaded`.
  - Even after `page.goto('/')` resolves, `<script type="module" src="/src/main.ts"></script>` executes asynchronously via the browser module loader.

### 1.5 HUD & Health Bar Architecture (Canvas vs DOM)
- In `src/ui/GothicHUD.ts:11`:
  `7. Zero DOM overhead: 100% rendered directly on 2D canvas context at locked 60Hz.`
- The vitality bar, level badge, XP bar, timer, and kill count are rendered 100% directly onto the 2D canvas context via `GothicHUD.renderVitalityBar()` (`src/ui/GothicHUD.ts:429-470`).
- There are **zero** DOM elements for health, XP, or HUD overlays inside `#game-container`.
- Vitality bar geometry in virtual canvas space:
  - `barX = 96, barY = 18, barW = 160, barH = 22`
  - Active blood fill is rendered from `(barX, barY)` to `(barX + bloodW, barY + barH)` with gradient `bloodBright` (`#e53e3e`) and `bloodBase` (`#6b1212`).
  - Charred empty reservoir background is `bloodDark` (`#380a0a`).

### 1.6 Timing Spikes & Benchmark Flakiness in CI / Parallel Execution
- Running `npx vitest run` across all 33 test files in parallel yielded a test failure:
  - `tests/unit/DarkFantasySprites.spec.ts:542`: `expect(elapsedMs).toBeLessThan(10.0)` failed with `expected 49.63ms to be less than 10`.
  - When run isolated via `npx vitest run tests/unit/DarkFantasySprites.spec.ts`, the exact same test passed in **0.572ms**!
  - Cause: In parallel test execution, CPU contention caused thread scheduling pauses that inflated wall-clock time from 0.57ms to 49.6ms.
- In `tests/e2e/game_initialization.spec.ts:129-131` and `tests/e2e/horde_survival.spec.ts:972-974`:
  - `expect(benchmark.maxFrameTimeMs).toBeLessThan(50.0);`
  - In `horde_survival.spec.ts:938-940`, `maxFrameTimeMs` is tracked from **frame 1** without excluding cold-start JIT and texture pre-render frames (`frameCount <= 5`).
  - On constrained CI runners (e.g. 2 vCPUs), a cold-start JIT or backdrop initialization frame can take 55–65ms on frame 1, triggering a timing flake despite steady 60Hz subsequent frames.

### 1.7 Live Autonomous Loop vs Deterministic Stepping Benchmark
- Running `npx playwright test tests/e2e/horde_survival.spec.ts -g "Visual Proof"` executed 4 tests in **3.3 seconds** total (~300ms per test).
- Running live rAF loop survival tests (`horde_survival.spec.ts:62`) requires 30 seconds of real-time game ticking + 230 CDP IPC roundtrips (`waitForTimeout(130)`), taking **35–45 seconds**.
- In `setupDeterministicGame(page)`:
  - Pausing rAF via `g.stop()` and manually calling `game.step(1/60)` + `game.render()` completely decouples test verification from browser vsync and CPU jitter.

---

## 2. Logic Chain

1. **Premise 1 (Rendering Pipeline)**: Since Grim Harvest relies strictly on Canvas 2D (`CanvasRenderingContext2D`) and software compositing with `--disable-gpu` (Obs 1.1, 1.2), there are no WebGL context loss risks (`webglcontextlost`, SwiftShader/ANGLE initialization failures). However, heavy CPU software rasterization of large offscreen stencil canvases (`lightCanvas` 960x540) increases susceptibility to CPU starvation under load.
2. **Premise 2 (Headless rAF Nuances)**: Headless Chromium without GPU acceleration drives `requestAnimationFrame` using an emulated BeginFrame timer. Without `--disable-background-timer-throttling` and related flags (Obs 1.2), Chromium may aggressively throttle rAF and timers if it marks the window as unfocused or occluded. Calling `await page.focus('canvas#game-canvas')` and supplying these launch flags prevents throttling.
3. **Premise 3 (Waiting Strategies)**:
   - Because `(window as any).game` is currently missing (only `__game` and `__GAME__` exist, Obs 1.4), test suites must use a unified fallback: `window.game ?? window.__game ?? window.__GAME__`.
   - Because the HUD is 100% canvas-rendered with zero DOM elements (Obs 1.5), tests attempting to locate DOM selectors like `.health-bar` will fail. Reliable waiting must either:
     - Query in-memory simulation state via `page.waitForFunction(() => window.__game.player.stats.currentHealth < 100)` or `hud.displayHealth`.
     - Sample canvas pixels at `(116, 29)` via `ctx.getImageData(116, 29, 1, 1)`.
4. **Premise 4 (Eliminating Flakiness)**:
   - Wall-clock sleeps (`page.waitForTimeout(N)`) cause timing flakes because real-world seconds do not map 1:1 to in-game `elapsedTime` in headless CI.
   - For visual proofs and mathematical boundary tests (such as near-miss dodge at 25px vs collision at 21px), asynchronous rAF loops introduce kinematic drift if frame deltas vary.
   - Employing `setupDeterministicGame()` (`g.stop()`, manual `game.step(1/60)`, and manual `game.render()`) makes execution 100% deterministic, reduces test execution time from 35s to 300ms, and guarantees mathematical reproducibility across CI and local environments.
5. **Premise 5 (Benchmarking Tolerance)**: Hard assertions like `maxFrameTimeMs < 50.0` from frame 1 fail under cold-start JIT contention (Obs 1.6). Excluding the first 5–10 warmup frames before asserting max frame time ensures tests measure steady-state performance rather than initial browser setup overhead.

---

## 3. Caveats

1. **Hardware Acceleration Variability**: While `--disable-gpu` ensures identical software rendering across Linux CI (headless GitHub Actions) and local macOS/Windows, it increases CPU usage. In ultra-low-spec CI environments (<2 vCPUs), running multiple tests concurrently would cause frame drops; hence `workers: 1` and `fullyParallel: false` in `playwright.config.ts` must be maintained.
2. **Dynamic Live Steering vs Controlled Spawning in E2E Dodge**:
   - In `tests/e2e/hitbox_dodge.spec.ts`, if the test allows the `WaveDirector` to spawn 50+ random enemies from all perimeter directions, the autonomous bot could become trapped, causing unintended damage and test failure.
   - The test must either clear the background horde (`game.hordeManager.clear()`) and spawn controlled test enemies for exact near-miss verification, or use a constrained enemy count with a conservative dodging safety radius.
3. **Canvas Tainted Origin**: Sampling pixel data via `ctx.getImageData()` is valid and un-tainted because all sprites, procedural textures, and fonts are generated dynamically in-memory or loaded from same-origin Vite assets without cross-origin image tainting.

---

## 4. Conclusion & Actionable Hardening Recommendations

### 4.1 Recommended Playwright Configuration Updates (`playwright.config.ts`)
Add the following Chromium launch arguments to eliminate headless timer and rAF throttling:
```typescript
// In playwright.config.ts launchOptions.args:
launchOptions: {
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
}
```

### 4.2 Game Bootstrap Ergonomics (`src/main.ts`)
Add `(window as any).game = game;` at line 620 alongside `__game` and `__GAME__` so tests can uniformly access `window.game`.

### 4.3 Standard Waiting & Readiness Helper Pattern
All E2E tests should use this standardized waiting function:
```typescript
export async function waitForGameReady(page: Page, timeoutMs = 15000) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas#game-canvas', { timeout: timeoutMs });
  
  await page.waitForFunction(() => {
    const w = window as any;
    const g = w.game ?? w.__game ?? w.__GAME__;
    return (
      g &&
      g.player &&
      g.player.isAlive &&
      g.hordeManager &&
      g.weaponManager &&
      g.backdrop &&
      g.backdrop.isInitialized &&
      g.isRunning
    );
  }, { timeout: timeoutMs });

  await page.focus('canvas#game-canvas');
}
```

### 4.4 Checking Health & HUD State Without DOM Elements
- **Approach 1 (Direct State Inspection)**:
  ```typescript
  const health = await page.evaluate(() => {
    const g = (window as any).game ?? (window as any).__game;
    return g.player.stats.currentHealth;
  });
  expect(health).toBe(100);
  ```
- **Approach 2 (Canvas Pixel Sampling)**:
  ```typescript
  const barSample = await page.evaluate(() => {
    const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Sample middle of health bar fill: (x=116, y=29)
    const data = ctx.getImageData(116, 29, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  });
  // Verify healthy crimson blood color
  expect(barSample?.r).toBeGreaterThan(120);
  expect(barSample?.g).toBeLessThan(50);
  ```

### 4.5 Blueprint for Milestone 3 Tests

#### A. `tests/e2e/hitbox_dodge.spec.ts` (Feature 10)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Milestone 3: Hitbox Precision & Near-Miss Dodge Verification', () => {
  test('verifies near-miss enemy dodge (distance = r_p + r_e + 3px) deals ZERO damage, while exact collision registers damage', async ({ page }) => {
    // 1. Boot and wait for game
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).game;
      return g && g.player && g.hordeManager && g.isRunning;
    }, { timeout: 10000 });

    // 2. Stop rAF for deterministic stepping
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).game;
      g.stop();
      g.hordeManager.clear(); // clear random wave director spawns
      
      // Position player at origin
      g.player.position.x = 0;
      g.player.position.y = 0;
      g.player.stats.currentHealth = 100;

      // Spawn skeleton (r_e = 11px, player r_p = 11px, contact = 22px)
      // Position at near-miss trajectory: x = 25px (3px clearance), y moving from -100 to +100
      const enemy = g.hordeManager.spawn('skeleton', 25.0, -80.0);
      if (enemy) {
        enemy.velocity.x = 0;
        enemy.velocity.y = 100; // moves downward past player
      }
    });

    // 3. Step 60 frames (1.0 second of simulation)
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).game;
      for (let i = 0; i < 60; i++) {
        g.step(1 / 60);
      }
      g.render();
    });

    // 4. Assert ZERO damage taken during near-miss graze
    const nearMissStatus = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).game;
      return {
        health: g.player.stats.currentHealth,
        isAlive: g.player.isAlive,
        vfxParticles: g.vfx.getParticleCount(),
      };
    });
    expect(nearMissStatus.health).toBe(100);
    expect(nearMissStatus.isAlive).toBe(true);

    // 5. Test Exact Touch: Position enemy into true physical contact (x = 21px, d < 22px)
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).game;
      g.hordeManager.clear();
      g.hordeManager.spawn('skeleton', 21.0, 0.0);
      g.step(1 / 60);
      g.render();
    });

    const collisionStatus = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).game;
      return {
        health: g.player.stats.currentHealth,
        hasBloodVFX: g.vfx.getParticleCount() > 0,
      };
    });

    expect(collisionStatus.health).toBeLessThan(100);
  });
});
```

#### B. `tests/e2e/camera_view.spec.ts` (Feature 11)
```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone 3: Camera Overhaul & Visual Proof Verification', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');

  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test('captures improved_camera_angle.png (>50KB, centered player tracking, comfortable 360 top-down FOV)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).game;
      return g && g.backdrop && g.backdrop.isInitialized;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      canvas.style.width = '960px';
      canvas.style.height = '540px';

      const g = (window as any).__game ?? (window as any).game;
      g.stop();

      // Position player at origin, camera centered
      g.player.position.x = 0;
      g.player.position.y = 0;
      g.camera.reset(-480, -270);
      g.camera.update(0, 0, 1 / 60, 0, 0);

      // Verify mathematical centering on viewport
      const screenPos = g.camera.worldToScreen(0, 0);
      (window as any)._screenPos = screenPos;

      // Populate rich visual scene: concentric undead horde, drops, and lighting
      g.hordeManager.clear();
      g.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 160);
      g.hordeManager.spawnWave('GHOUL', 20, { x: 0, y: 0 }, 250);
      g.hordeManager.spawnWave('BANSHEE', 15, { x: 0, y: 0 }, 340);
      g.hordeManager.spawnWave('DEATH_KNIGHT', 8, { x: 0, y: 0 }, 420);

      g.lootManager.spawnDrop('EMERALD_SHARD', 60, 40, false);
      g.lootManager.spawnDrop('RUBY_GEM', -80, -30, false);

      for (let i = 0; i < 8; i++) g.step(1 / 60);
      g.render();
    });

    const screenPos = await page.evaluate(() => (window as any)._screenPos);
    expect(screenPos.x).toBeCloseTo(480, 1);
    expect(screenPos.y).toBeCloseTo(270, 1);

    const targetPath = path.join(ARTIFACT_DIR, 'improved_camera_angle.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    expect(fs.existsSync(targetPath)).toBe(true);
    const stats = fs.statSync(targetPath);
    expect(stats.size).toBeGreaterThan(50 * 1024);
  });

  test('captures hitbox_precision_dodge.png (>50KB, tight near-miss graze without phantom damage or blood burst)', async ({ page }) => {
    // Similar deterministic setup showing player grazing past undead claws at 25px with active scythe
    const targetPath = path.join(ARTIFACT_DIR, 'hitbox_precision_dodge.png');
    // ... capture screenshot and assert > 50KB ...
  });
});
```

---

## 5. Verification Method

To independently verify all findings and test execution:

1. **Verify Playwright Test Discovery & Execution**:
   ```bash
   npx playwright test --list
   npx playwright test tests/e2e/game_initialization.spec.ts
   npx playwright test tests/e2e/challenger_m4_restart_stress.spec.ts
   npx playwright test tests/e2e/horde_survival.spec.ts -g "Visual Proof"
   ```
   *Expected*: All tests pass cleanly in headless mode with 1 worker.

2. **Verify Canvas Rendering Context**:
   Inspect `src/main.ts:213` and verify `canvas.getContext('2d')` is used with zero WebGL invocations.

3. **Verify Existing Visual Artifact Sizes**:
   ```bash
   ls -la artifacts/dark_fantasy/*.png
   ```
   *Expected*: All existing 6 artifacts (`horde_swarm.png`, `level_up_modal.png`, `survival_gameplay.png`, `enhanced_graphics_swarm.png`, `restart_verified.png`, `occult_vfx_lighting.png`) exceed 50,000 bytes (ranges between 186 KB and 335 KB).

4. **Invalidation Conditions**:
   - If tests reintroduce `page.waitForTimeout()` without state predicates and fail under CI CPU throttling.
   - If new tests query `window.game` before `(window as any).game = game;` is merged into `src/main.ts`.
   - If tests query non-existent DOM elements for HUD/health instead of canvas state or pixel data.
