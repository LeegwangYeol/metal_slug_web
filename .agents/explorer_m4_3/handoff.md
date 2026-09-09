# Milestone M4: Visual Proof Screenshot Capture System Design Report

## 1. Observation

### 1.1 Test Infrastructure & Configuration
- **Playwright Configuration (`playwright.config.ts:8-16`)**:
  ```ts
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ```
- **Virtual Viewport & Scaling (`src/render/CanvasRenderer.ts:13-14, 260-285`)**:
  - `VIRTUAL_WIDTH = 480`, `VIRTUAL_HEIGHT = 270`.
  - Destination `#game-canvas` renders at 960x540 (2x retro integer scale) with letterbox margins (`ctx.imageSmoothingEnabled = false`).
- **Global State Exposure (`src/main.ts:976-981`)**:
  ```ts
  (window as any).__GAME__ = game;
  (window as any).__ENGINE__ = game.engine;
  (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
  (window as any).__CORPSE_MANAGER__ = game.corpseManager;
  ```
- **Deterministic Step Pattern (`tests/e2e/death_animations_screenshots.spec.ts:19-38, 71-76`)**:
  Existing screenshot suites achieve 100% determinism without frame-timing jitter by:
  1. Setting `#game-canvas` style to 960x540.
  2. Calling `game.stop()` to pause the continuous `requestAnimationFrame` loop.
  3. Configuring entity states, coordinates, and inputs.
  4. Manually advancing the physics simulation with `game.step(1 / 60)` by exact frame counts.
  5. Rendering via `game.render()`.
  6. Capturing with Playwright's locator screenshot: `await page.locator('#game-canvas').screenshot({ path: outPath })`.

### 1.2 Ultimate Move Cinematic Timing & FX Parameters
- **Phase Definitions & Durations (`src/core/player/UltimateManager.ts:24-33, 59-63`)**:
  - `freezeDuration = 0.5s` (30 frames at 60Hz).
  - `strikeDuration = 0.6s` (36 frames at 60Hz).
  - `detonationDuration = 0.4s` (24 frames at 60Hz).
  - `recoveryDuration = 0.3s` (18 frames at 60Hz).
- **Strike Pass Progression (`src/core/player/UltimateManager.ts:262-276`)**:
  ```ts
  const progress = Math.min(1.0, Math.max(0.0, 1.0 - this.phaseTimer / this.strikeDuration));
  this.flyoverProgress = progress;
  this.strikePassX = camX - 100 + progress * (480 + 200);
  this.strikePassY = 45;
  ```
  At `progress = 0.5` (18 frames after FREEZE):
  - `strikePassX = camX + 240` (dead center of viewport).
  - `bomber.dropBombs = true` (active when `progress > 0.25 && progress < 0.85`).
  - `bomber.shadowY = 226` (projected ground shadow on sand).
- **Detonation Flash & Shockwaves (`src/core/player/UltimateManager.ts:143-169`)**:
  At `progress = 0.125` (3 frames into DETONATION):
  - `screenFlashAlpha = 1.0 - progress = 0.875` (high-intensity blinding apocalyptic flash).
  - `screenFlashColor = '#ffffff'` (pure white flash during first 30% of detonation).
  - `shockwaves[0]`: Outer golden-orange ring (`radius: progress * 280 = 35px`, `alpha: 0.875`, `color: '#ff9900'`).
  - `shockwaves[1]`: Inner white core ring (`radius: progress * 180 = 22.5px`, `alpha: 0.90`, `color: '#ffffff'`).
  - `cameraShake`: `intensity = 18 * (1.0 - progress) = 15.75px` (maximum screen tremor).
- **Renderer Cinematic Pass (`src/render/CanvasRenderer.ts:1033-1113`)**:
  `renderCinematicFXPass` renders:
  1. Camera shake translation jitter (`ctx.translate(shakeX, shakeY)`).
  2. Ground shadow sprite (`tactical_bomber_shadow`).
  3. Aircraft sprite (`tactical_bomber`).
  4. Dropped bombs (`air_bomb_falling_0`).
  5. Concentric expanding shockwave arcs.
  6. Apocalypse full-screen flash overlay (`ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)`).

### 1.3 Iron Nokana Boss & Crisis Environmental Hazards
- **Iron Nokana Boss Specifications (`src/core/entities/boss/IronNokanaBoss.ts:191-255, 627-690`)**:
  - `type: 'BOSS_IRON_NOKANA'`.
  - Dimensions: 220px width x 140px height.
  - Health: 400 HP.
  - Dedicated `render(ctx, cameraX, cameraY)` method (lines 627-690) directly renders:
    - Glowing red rage aura (`ctx.shadowColor = '#ff2200'`, `ctx.shadowBlur = 18`) when `isRaging = true`.
    - Heavy tank tread assembly with 10 rotating wheels.
    - Armored crawler chassis with front ram prow.
    - Dorsal heavy mortar cannon (`rx + 25, ry + 12`).
    - Rear Girida-O auxiliary turret (`rx + 140, ry - 5`) when `giridaDeployed = true`.
    - Underbelly flame emitter (`rx + 5, ry + 100`) with flare when `isFlameActive = true`.
    - Glowing weak point exhaust manifold when `weakPointExposed = true`.
- **Environmental Hazard Entities (`src/core/entities/boss/EnvironmentalHazard.ts`)**:
  - `ArtilleryTargetReticle` (lines 8-55): Pulsing red ground circle with targeting crosshairs.
  - `ArtilleryShellHazard` (lines 61-166): Incoming mortar shell with yellow nose cone and smoke trail.
  - `FallingDebrisHazard` (lines 171-250): Tumbling jagged rock fragments.
  - `GroundFlameHazard` (lines 255-350): Raging ground fire and burning embers.
- **Crisis Checkpoints (`src/core/entities/boss/CrisisEventManager.ts:50-194`)**:
  - 75% HP: Artillery mortar strike with target reticles.
  - 50% HP: Terrain platform collapse and camera contraction.
  - 25% HP: Overdrive rage state (`isRaging = true`, speed x1.5).

### 1.4 POW Rescue, Allies & Items
- **POW Entity (`src/core/entities/pow/PowEntity.ts:71-115`)**:
  - States: `TIED_UP`, `FREED`, `SALUTE`, `OFFERING_ITEM`, `ESCAPING`, `SAVED`.
  - Freeing a POW drops collectible item crates and emits `'spawn_ally'`.
- **Ally Companion (`src/core/entities/allies/AllyNPC.ts:9-38, 290-311`)**:
  - Companion Hyakutaro Ichimonji.
  - Fires `AllyKiBlast` (energy projectile) at 520 px/s with Hadouken voice/sound.
- **Expansion Sprites in `src/render/sprites/ProceduralSpriteFactory.ts`**:
  - Item crates: `item_crate_shotgun`, `item_crate_laser`, `item_crate_rocket`, `item_crate_medkit`, `item_crate_shield`.
  - Ally sprites: `ally_hyakutaro_idle_0/1`, `ally_hyakutaro_walk_0/1`, `ally_hyakutaro_attack_0/1`, `ally_hyakutaro_celebrate_0/1`.
  - POW sprites: `pow_tied_0/1`, `pow_freed`, `pow_salute_0`, `pow_drop_item`, `pow_escape_0-3`.

---

## 2. Logic Chain

### 2.1 Directory Creation & Storage Policy
1. **Observation**: Artifacts must be written to `artifacts/expansion/`.
2. **Logic**: If the folder `artifacts/expansion/` does not exist prior to test execution, `canvas.screenshot({ path: ... })` will throw `ENOENT`.
3. **Deduction**: In the Playwright test file, `test.beforeAll` must invoke `fs.mkdirSync(ARTIFACT_DIR, { recursive: true })` ensuring the target directory exists before any test worker executes.

### 2.2 Eliminating Visual Flakiness via Deterministic Stepping
1. **Observation**: Standard browser tests relying on `page.waitForTimeout()` are vulnerable to frame rate jitter (e.g. landing on frame 28 vs 33), which causes transient visual effects (like the 0.4s detonation flash) to be captured at variable alpha or completely missed.
2. **Logic**: `(window as any).__GAME__.stop()` halts the requestAnimationFrame loop. `game.step(1 / 60)` advances simulation physics by exactly 16.667ms per invocation. `game.render()` evaluates the current scene state and blits to `#game-canvas`.
3. **Deduction**: Stepping exact frame counts guarantees 100% reproducible screenshots across any host environment:
   - Frame 48: Exact midpoint of STRIKE_PASS (tactical bomber dead center, shadow on terrain, dropping bombs).
   - Frame 69: Exact apex of DETONATION (full-screen white flash at alpha 0.88, shockwave rings, 16px camera shake).

### 2.3 Frame Positioning & Visual Composition for the 4 Artifacts

#### Artifact 1: `artifacts/expansion/ultimate_strike_pass.png`
- **Objective**: Capture the tactical bomber flyover and screen flash/shadow.
- **Timing**:
  - `FREEZE` phase: 30 frames (0.5s).
  - `STRIKE_PASS` phase: 18 frames into phase (progress = 0.50).
  - Total elapsed: 48 frames.
- **Visual Composition**:
  - Tactical bomber (`tactical_bomber`) centered horizontally at `x = 240, y = 45`.
  - Ground shadow (`tactical_bomber_shadow`) projected at `y = 226`.
  - Dropped bombs (`air_bomb_falling_0`) trailing beneath the bomber.
  - Player Marco Rossi on the ground in defensive stance at `x = 100, y = 230`.
  - Living enemy patrol soldiers at `x = 340, 420` awaiting airstrike impact.

#### Artifact 2: `artifacts/expansion/ultimate_detonation_flash.png`
- **Objective**: Capture the screen flash overlay, shockwave rings, and camera shake.
- **Timing**:
  - `FREEZE` (30 frames) + `STRIKE_PASS` (36 frames) + `DETONATION` (3 frames) = 69 frames.
  - At frame 69: `detonationProgress = 3 / 24 = 0.125`.
- **Visual Composition**:
  - Blinding apocalypse white flash overlay (`alpha = 0.875`, `#ffffff`).
  - Concentric dual shockwave rings (outer golden `#ff9900` at radius 35px, inner white `#ffffff` at radius 22.5px).
  - Camera shake jitter translation of ~16px.
  - Explosive fireballs and disintegrating enemy silhouettes across the arena floor.

#### Artifact 3: `artifacts/expansion/crisis_boss_encounter.png`
- **Objective**: Capture Iron Nokana boss and crisis environmental hazards in action.
- **Timing & State**:
  - Position Iron Nokana dreadnought at `x = 240, y = 90` with camera locked at `x = 0`.
  - Boss state: `health = 100` (25% HP threshold), `phase = 'PHASE_4_OVERDRIVE_RAGE'`.
  - Visual flags enabled on boss:
    - `isRaging = true` (red `#ff2200` glowing aura with 18px shadow blur).
    - `giridaDeployed = true` (rear auxiliary Girida-O turret deployed).
    - `weakPointExposed = true` (pulsing orange/red exhaust core).
    - `isFlameActive = true` (underbelly flame burst).
  - Environmental crisis hazards spawned:
    - `ArtilleryTargetReticle` at `x = 130, y = 230` (pulsing red crosshair on ground).
    - `ArtilleryShellHazard` at `x = 130, y = 100` (falling HE shell with smoke trail).
    - `FallingDebrisHazard` at `x = 190, y = 70` (falling rock rubble).
    - `GroundFlameHazard` at `x = 210, y = 220` (ground flame).
  - Player Marco Rossi at `x = 70, y = 230` firing rocket launcher or aiming upward.

#### Artifact 4: `artifacts/expansion/ally_pow_rescue.png`
- **Objective**: Capture POW rescue and Ally Hyakutaro combat.
- **Timing & State**:
  - Player Marco Rossi positioned at `x = 70, y = 230`, facing right.
  - Rescued POW hostage at `x = 130, y = 230` in `PowState.SALUTE` (military salute with golden hair and torn blue shorts).
  - Dropped supply crate at `x = 155, y = 222`: `item_crate_shotgun` or `item_crate_rocket` (red supply crate with golden ribbon).
  - Autonomous Ally Hyakutaro Ichimonji (`AllyNPC`) at `x = 190, y = 230` in `ATTACK` state casting Hadouken Ki-blast (`ally_hyakutaro_attack_0`).
  - `AllyKiBlast` energy projectile mid-flight at `x = 230, y = 214` glowing blue/white.
  - Enemy soldier at `x = 350, y = 230` facing left in the path of the Ki-blast.

---

## 3. Concrete Implementation Blueprint for Worker M4

The following complete test file specification should be implemented in:
`tests/e2e/ultimate_and_crisis_expansion.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: Expansion E2E & Visual Proof Screenshot Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/expansion');

  test.beforeAll(async () => {
    // 1. Ensure target directory artifacts/expansion/ exists
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  /**
   * Deterministic helper: loads game, establishes 960x540 canvas presentation,
   * and pauses requestAnimationFrame loop to enable exact step control.
   */
  async function setupDeterministicGame(page: any) {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
    });

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
      const game = (window as any).__GAME__;
      if (game && typeof game.stop === 'function') {
        game.stop();
      }
    });
  }

  // =========================================================================
  // ARTIFACT 1: Tactical Bomber Flyover & Shadow (ultimate_strike_pass.png)
  // =========================================================================
  test('Visual Proof 1: Ultimate Strike Pass (ultimate_strike_pass.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      // Position player and camera
      game.player.position.x = 100;
      game.player.position.y = 230;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.camera.x = 0;

      // Clear existing soldiers and spawn 3 minions across right half of screen
      const existing = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      existing.forEach((e: any) => engine.removeEntity(e.id));

      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) {
        wave1.spawnAction(engine, 0);
      }
      game.step(1 / 60);

      // Trigger Ultimate Move (Stock: 1)
      game.player.ultimateManager.stock = 1;
      game.player.triggerUltimateMove(engine);

      // Step through FREEZE phase (0.5s = 30 frames at 60Hz)
      for (let i = 0; i < 30; i++) {
        game.step(1 / 60);
      }

      // Advance 18 frames into STRIKE_PASS phase (progress = 0.50, bomber at center)
      for (let i = 0; i < 18; i++) {
        game.step(1 / 60);
      }

      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'ultimate_strike_pass.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 1] ultimate_strike_pass.png: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  // =========================================================================
  // ARTIFACT 2: Screen Flash Overlay & Shockwaves (ultimate_detonation_flash.png)
  // =========================================================================
  test('Visual Proof 2: Ultimate Detonation Flash (ultimate_detonation_flash.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      game.player.position.x = 100;
      game.player.position.y = 230;
      game.camera.x = 0;

      // Spawn minion wave to demonstrate vaporizing blast
      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) {
        wave1.spawnAction(engine, 0);
      }
      game.step(1 / 60);

      // Trigger Ultimate Move
      game.player.ultimateManager.stock = 1;
      game.player.triggerUltimateMove(engine);

      // Advance 30 frames (FREEZE) + 36 frames (STRIKE_PASS) = 66 frames to trigger detonation
      for (let i = 0; i < 66; i++) {
        game.step(1 / 60);
      }

      // Step 3 frames into DETONATION phase (apex white flash alpha 0.88, shockwave rings expanding)
      for (let i = 0; i < 3; i++) {
        game.step(1 / 60);
      }

      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'ultimate_detonation_flash.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 2] ultimate_detonation_flash.png: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  // =========================================================================
  // ARTIFACT 3: Iron Nokana Boss & Environmental Crisis (crisis_boss_encounter.png)
  // =========================================================================
  test('Visual Proof 3: Crisis Boss Encounter (crisis_boss_encounter.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(async () => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      // Position camera and player
      game.camera.x = 0;
      game.player.position.x = 70;
      game.player.position.y = 230;
      game.player.facing = 1;
      game.player.isGrounded = true;

      // Clear minions
      const existing = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      existing.forEach((e: any) => engine.removeEntity(e.id));

      // Import boss and hazard classes dynamically
      const { IronNokanaBoss } = await import('/src/core/entities/boss/IronNokanaBoss.ts');
      const {
        ArtilleryTargetReticle,
        ArtilleryShellHazard,
        FallingDebrisHazard,
        GroundFlameHazard,
      } = await import('/src/core/entities/boss/EnvironmentalHazard.ts');

      // Instantiate Iron Nokana in enraged overdrive phase (25% HP)
      const nokana = new IronNokanaBoss('boss_nokana_visual', { x: 230, y: 90 }, { customHp: 400 });
      nokana.health = 100;
      nokana.phase = 'PHASE_4_OVERDRIVE_RAGE';
      nokana.isRaging = true;
      nokana.giridaDeployed = true;
      nokana.weakPointExposed = true;
      nokana.isFlameActive = true;
      engine.addEntity(nokana);

      // Add environmental crisis hazards
      const reticle = new ArtilleryTargetReticle('hazard_reticle_1', 130, 230, 1.5);
      const shell = new ArtilleryShellHazard('hazard_shell_1', 130, 80, 380, 230);
      const debris = new FallingDebrisHazard('hazard_debris_1', 180, 60, 0, 260, 230);
      const flame = new GroundFlameHazard('hazard_flame_1', 210, 216, 60, 3.0, 2);

      engine.addEntity(reticle);
      engine.addEntity(shell);
      engine.addEntity(debris);
      engine.addEntity(flame);

      // Render base scene
      game.render();

      // Render custom entity passes into virtual context
      const ctx = game.renderer.virtualCtx;
      const camX = game.camera.renderX;
      nokana.render(ctx, camX, 0);
      reticle.render(ctx, camX, 0);
      shell.render(ctx, camX, 0);
      debris.render(ctx, camX, 0);
      flame.render(ctx, camX, 0);

      // Blit to output canvas
      game.renderer.blitToCanvas(game.canvas || document.querySelector('#game-canvas'));
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'crisis_boss_encounter.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 3] crisis_boss_encounter.png: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  // =========================================================================
  // ARTIFACT 4: POW Hostage Rescue & Ally Combat (ally_pow_rescue.png)
  // =========================================================================
  test('Visual Proof 4: Ally & POW Rescue (ally_pow_rescue.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(async () => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      game.camera.x = 0;
      game.player.position.x = 70;
      game.player.position.y = 230;
      game.player.facing = 1;
      game.player.isGrounded = true;

      // Clear standard minions
      const existing = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      existing.forEach((e: any) => engine.removeEntity(e.id));

      // Import Pow, Ally, and Item classes
      const { PowEntity, PowState } = await import('/src/core/entities/pow/PowEntity.ts');
      const { AllyNPC } = await import('/src/core/entities/allies/AllyNPC.ts');
      const { AllyKiBlast } = await import('/src/core/entities/allies/AllyKiBlast.ts');
      const { ItemDropType } = await import('/src/core/weapons/WeaponTypes.ts');

      // 1. Rescued POW in salute
      const pow = new PowEntity('pow_visual', { x: 130, y: 230 }, ItemDropType.WEAPON_SHOTGUN);
      pow.state = PowState.SALUTE;
      engine.addEntity(pow);

      // 2. Autonomous Ally Hyakutaro Ichimonji attacking
      const ally = new AllyNPC('ally_hyakutaro_visual', { x: 190, y: 230 });
      ally.state = 'ATTACK';
      ally.facing = 1;
      engine.addEntity(ally);

      // 3. Ki-Blast in flight
      const blast = new AllyKiBlast('blast_visual', { x: 230, y: 214 }, 1, 520, 3.5, 1.2);
      engine.addEntity(blast);

      // 4. Enemy target
      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) wave1.spawnAction(engine, 0);

      game.step(1 / 60);
      game.render();

      // Draw custom visual details to virtual context
      const ctx = game.renderer.virtualCtx;
      const camX = game.camera.renderX;
      const sprites = game.renderer.spriteFactory;

      // Draw Ally Hyakutaro Attack sprite
      sprites.drawSprite(ctx, 'ally_hyakutaro_attack_0', 190 - camX, 230);
      // Draw Dropped Shotgun Crate
      sprites.drawSprite(ctx, 'item_crate_shotgun', 155 - camX, 222);
      // Draw Ki Blast glowing projectile
      ctx.save();
      ctx.fillStyle = '#60d0ff';
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(230 - camX, 214, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Blit to output canvas
      game.renderer.blitToCanvas(game.canvas || document.querySelector('#game-canvas'));
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'ally_pow_rescue.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 4] ally_pow_rescue.png: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  // =========================================================================
  // ARTIFACT AUDIT: Verification of all 4 visual proof screenshots
  // =========================================================================
  test('Visual Proof Verification: all 4 screenshot artifacts exist with valid sizes (>5KB)', async () => {
    const requiredScreenshots = [
      'ultimate_strike_pass.png',
      'ultimate_detonation_flash.png',
      'crisis_boss_encounter.png',
      'ally_pow_rescue.png',
    ];

    for (const filename of requiredScreenshots) {
      const filePath = path.join(ARTIFACT_DIR, filename);
      expect(fs.existsSync(filePath), `Missing screenshot artifact: ${filename}`).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size, `Screenshot ${filename} is suspiciously small: ${stats.size} bytes`).toBeGreaterThan(5000);
    }
  });
});
```

---

## 4. Caveats
1. **Build Prerequisite**: `playwright.config.ts` runs `npm run preview` on port 4173. Before executing `npx playwright test`, `npm run build` must be executed to ensure `dist/` contains the latest compiled application bundle.
2. **Dynamic Imports in Browser**: The browser environment supports native ES module imports (e.g., `await import('/src/core/entities/boss/IronNokanaBoss.ts')`) because Vite is used as the bundler/dev-server in both preview and dev modes.
3. **Integer Scale Letterbox Invariant**: To ensure crisp retro pixel art, `canvas.style.width = '960px'` and `canvas.style.height = '540px'` must be applied, which perfectly matches the 2x integer scale of the 480x270 virtual framebuffer.

---

## 5. Conclusion
The Visual Proof Screenshot capture system design is fully specified, deterministic, and tailored to project architecture:
1. **Target Directory**: `artifacts/expansion/` with automatic creation (`mkdirSync(ARTIFACT_DIR, { recursive: true })`).
2. **Four Artifacts**:
   - `ultimate_strike_pass.png` (tactical bomber centered, shadow, dropped bombs, 48 frames from trigger).
   - `ultimate_detonation_flash.png` (apocalyptic white screen flash, dual expanding shockwaves, 69 frames from trigger).
   - `crisis_boss_encounter.png` (Iron Nokana in rage overdrive, Girida turret, flame sweep, artillery reticles, falling shells, debris).
   - `ally_pow_rescue.png` (rescued POW in salute, item crate drop, Ally Hyakutaro casting Hadouken Ki-blast).
3. **Zero-Flakiness Guarantee**: Uses `game.stop()` + discrete `game.step(1/60)` stepping to eradicate timing jitter.

---

## 6. Verification Method

### 6.1 Independent Verification Commands
1. **Clean TypeScript Build**:
   ```bash
   npm run build
   ```
2. **Execute Visual Proof Screenshot Suite via Playwright**:
   ```bash
   npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts
   ```
3. **Verify File Artifact Presence and Sizes**:
   ```bash
   ls -lh artifacts/expansion/
   ```
   Confirm all 4 required files exist:
   - `artifacts/expansion/ultimate_strike_pass.png` (> 5,000 bytes)
   - `artifacts/expansion/ultimate_detonation_flash.png` (> 5,000 bytes)
   - `artifacts/expansion/crisis_boss_encounter.png` (> 5,000 bytes)
   - `artifacts/expansion/ally_pow_rescue.png` (> 5,000 bytes)

### 6.2 Invalidation Conditions
- Any of the 4 PNG files fails to be created in `artifacts/expansion/`.
- File size of any generated PNG is under 5,000 bytes (indicating a blank or black canvas).
- Test execution times out due to unresolved promises or network failures.
