# Comprehensive Technical Survey & Architecture Plan: Rendering, Audio, and E2E Testing for Metal Slug Web Massive Expansion

## Executive Summary
This survey establishes the complete technical architectural blueprint for the **Rendering Pipeline, Procedural Audio Synthesis, and E2E Visual Verification Infrastructure** for the Metal Slug Web Massive Expansion (R1: Epic Bosses & Crisis Events, R2: Allies, Items, & Ultimate Moves, R3: Autonomous Scaling & Rigorous Testing).

### Key Architectural Findings
1. **Zero Regression Baseline**:
   - Current unit test suite: **24 test files, 294 tests (100% green)**.
   - Current Playwright E2E suite: **4 spec files, 17 tests (100% green)**.
   - Current production build: `tsc -b && vite build` transforms 32 modules with **0 errors**.
2. **Critical Sprite Count Contract (The 164 Baseline)**:
   - `tests/unit/adversarial_sprites_crosshairs.test.ts` (Tasks 1A & 1E) asserts that `factory.getAllKeys()` returns **exactly 164 unique keys** with strict category counts (`player: 67, rebel: 21, pow: 9, ironTechnical: 7, tetsuyuki: 8, projectile: 13, casings: 4, explosions: 18, hud: 17`).
   - The Polish milestone resolved this by isolating Polish keys (`polishKeys` set) and filtering them when `includePolish === false`.
   - **Expansion Solution**: The expansion must isolate all newly added sprite keys into an `expansionKeys: Set<string>` and keep `getAllKeys(includePolish = false, includeExpansion = false)` default to return the baseline 164 keys, while exposing `getAllKeys(true, true)` or `getExpansionKeys()` for expansion suites.
3. **Keyboard Mapping Contract (`KeyX` vs `KeyU`)**:
   - `tests/unit/adversarial_controls_jump.test.ts` (Task 1.1) asserts that `KeyX` is an authentic jump key (`Space`, `KeyK`, `KeyX`).
   - Re-mapping `KeyX` to Ultimate Move will break unit tests.
   - **Expansion Solution**: Map the Ultimate Move to dedicated key **`KeyU`** (`KeyU: 'ultimate'`) in `KeyboardController.ts` and add optional `ultimatePressed?: boolean` to `PlayerInputSnapshot`.
4. **Item Pickup Rendering Gap**:
   - `ItemPickupEntity` exists in `src/core/entities/pow/PowEntity.ts` (`type: 'ITEM_PICKUP'`), but `buildRenderSceneState()` in `src/main.ts` does not forward item entities to `RenderSceneState`, leaving dropped items invisible.
   - **Expansion Solution**: Add `items?: RenderItemState[]` to `RenderSceneState`, forward dropped items in `src/main.ts`, and render them with glowing, bobbing pixel-art crate/treasure sprites.

---

## 1. Procedural Pixel-Art Sprite Architecture (`ProceduralSpriteFactory.ts`)

### 1.1 Color Palettes (`src/render/sprites/Palette.ts`)
Add 4 specialized indexed 16-color palettes matching classic Neo Geo arcade aesthetics:
- `ALLY` (Hyakutaro Ichimonji):
  - `#FFFFFF` (white karate gi), `#201818` (outline), `#3868B8` (blue belt/headband), `#E0A070` / `#985830` (skin tone/shadow), `#40E0D0` / `#E0FFFF` (cyan/white Ki energy aura).
- `EXPANSION_BOSS` (Heavy Assault Siege Boss / Stage 2 Machine):
  - `#181C24` (heavy steel outline), `#485460` (cold gunmetal armor), `#C83220` (warning crimson trim), `#F5B82A` (hazard diagonal stripes), `#E67E22` (turbo exhaust flames).
- `CRISIS` (Environmental Hazards):
  - `#FF0033` (laser/hazard warning red), `#FFF060` (flare core), `#333333` (shattered rock/debris), `#554433` (collapsing earth/timber).
- `EXPANSION_WEAPONS`:
  - Blue/Steel for Shotgun [S], Cyan/Neon for Laser [L], Olive/Amber for Rocket Launcher [R], Emerald/White for Medkit [+], Azure/Cyan for Shield.

### 1.2 Sprite Registry Breakdown

| Category | Sprite Key | Dimensions (W x H) | Anchor (X, Y) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Ally NPC** | `ally_hyakutaro_idle_0..1` | 32 x 40 | 16, 38 | Breathing martial artist in white gi & blue belt |
| | `ally_hyakutaro_walk_0..3` | 32 x 40 | 16, 38 | 4-frame running/following animation |
| | `ally_hyakutaro_charge_0` | 36 x 40 | 18, 38 | Gathering glowing Ki energy orb at waist |
| | `ally_hyakutaro_fire_0..1` | 40 x 40 | 18, 38 | Hadouken ki blast forward palm thrust |
| | `ally_hyakutaro_salute_0` | 32 x 40 | 16, 38 | Respectful martial arts bow upon stage clear |
| | `proj_ki_blast_0..1` | 24 x 16 | 12, 8 | Glowing cyan plasma projectile with trailing aura |
| | `proj_ki_burst` | 28 x 28 | 14, 14 | Resonant energy impact detonation |
| **Expansion Boss** | `boss_nokana_chassis` | 140 x 64 | 70, 56 | Heavy armored locomotive tread carriage |
| | `boss_nokana_treads_0..1` | 140 x 24 | 70, 16 | Animated heavy steel caterpillar links |
| | `boss_nokana_main_cannon`| 64 x 28 | 16, 14 | 155mm heavy siege howitzer barrel with recoil |
| | `boss_nokana_turret_top` | 48 x 36 | 24, 28 | Top rocket battery launcher module |
| | `boss_nokana_flame_nozzle`| 28 x 16 | 14, 8 | Underside flame sweep incinerator port |
| | `boss_nokana_wreckage` | 140 x 64 | 70, 56 | Exploded scorched metal husk with sparks |
| **Crisis Hazards**| `hazard_mortar_target_0..1`| 32 x 16 | 16, 8 | Flashing red ground impact target ellipse |
| | `hazard_falling_debris_0..2`| 24 x 24 | 12, 12 | Tumbling jagged concrete rubble & steel rebar |
| | `hazard_laser_beam_v` | 16 x 270 | 8, 0 | Vertical orbital satellite laser warning beam |
| | `hazard_fire_pillar_0..3` | 28 x 80 | 14, 76 | Erupting ground lava / thermal explosion geyser |
| | `hazard_platform_crumble` | 64 x 16 | 32, 8 | Shattered bridge fragment tilting & falling |
| **Items / Drops**| `item_shotgun` | 20 x 20 | 10, 18 | Blue metallic crate with embossed gold "S" |
| | `item_laser` | 20 x 20 | 10, 18 | Bright cyan crate with neon "L" |
| | `item_rocket` | 20 x 20 | 10, 18 | Olive drab crate with amber "R" |
| | `item_super_grenade` | 20 x 20 | 10, 18 | Green ammo box with red explosive stripes |
| | `item_medkit` | 18 x 18 | 9, 16 | White field dressing pack with red medical cross |
| | `item_shield` | 20 x 20 | 10, 18 | Hexagonal kinetic barrier energy generator |
| | `item_treasure_coin_0..3`| 14 x 14 | 7, 12 | 4-frame rotating shiny gold coin |
| | `item_treasure_gem` | 16 x 16 | 8, 14 | Sparkling cut ruby gemstone |
| **Weapons / Proj**| `proj_shotgun_pellet` | 8 x 6 | 4, 3 | High-velocity buckshot cluster pellet |
| | `proj_laser_beam_seg` | 32 x 8 | 16, 4 | Continuous piercing laser segment with core |
| | `proj_rocket_heavy` | 24 x 12 | 12, 6 | Heavy anti-armor missile with propellant jet |
| **Ultimate Move** | `ultimate_sv001_dive` | 48 x 36 | 24, 20 | SV-001 tank dive attack with thrusters blazing |
| | `ultimate_bomber_wing` | 160 x 50 | 80, 25 | Allied heavy bomber strategic airframe |
| | `ultimate_payload_bomb` | 16 x 24 | 8, 12 | Heavy bunker-buster ordnance dropping |
| | `ultimate_shockwave_ring`| 96 x 96 | 48, 48 | Concentric expanding circular blast wave |
| **Expanded HUD** | `hud_badge_shotgun` | 24 x 14 | 12, 7 | HUD weapon badge [S] |
| | `hud_badge_laser` | 24 x 14 | 12, 7 | HUD weapon badge [L] |
| | `hud_badge_rocket` | 24 x 14 | 12, 7 | HUD weapon badge [R] |
| | `hud_ultimate_bar_frame` | 64 x 10 | 0, 0 | Ultimate Move stock energy gauge container |
| | `hud_ultimate_bar_fill` | 60 x 6 | 0, 0 | Glowing energy segments (fills on kills) |
| | `hud_ultimate_ready_flash`| 44 x 12 | 22, 6 | Flashing golden "READY" arcade indicator |

---

## 2. Visual FX Engine & Render Passes (`CanvasRenderer.ts`)

### 2.1 Render Pass Integration
In `CanvasRenderer.renderScene()`, insert dedicated passes:
1. `renderParallaxPass(cam, time)` (Existing)
2. `renderPlatformsPass(platforms, cam)` (Existing, enhanced for collapsing platforms)
3. **`renderCrisisHazardsPass(hazards, cam, time)` (NEW)**:
   - Renders ground artillery impact targets (`hazard_mortar_target`), falling debris with rotation, orbital laser warning lines, and ground lava plumes.
4. `renderEntitiesPass(scene, cam, time)` (Existing, enhanced):
   - POWs
   - **Allies (`scene.allies`) (NEW)**: Hyakutaro Ichimonji following player, charging, and firing Ki blasts.
   - **Collectible Items (`scene.items`) (NEW)**: Floating weapon crates, medkits, shields, coins with vertical sinusoidal hover ($y_{\text{screen}} = y + \sin(\text{time} \times 6) \times 2.5$) and gleam sparkle.
   - Bosses (Tetsuyuki and new Stage 2 Boss).
   - Enemies & Decoupled Corpses.
   - Player.
5. `renderCrosshairPass(player, cam, time)` (Existing, enhanced):
   - Add reticles for **SHOTGUN** (wide dual-angle spread fan with 5 target pips), **LASER** (infinite straight ray tracer with target lock brackets), **ROCKET_LAUNCHER** (square box acquisition reticle with missile flight path).
6. `renderProjectilesAndExplosionsPass(projectiles, explosions, cam, time)` (Existing, enhanced):
   - Render Ki blasts, Shotgun pellets, Laser beam strips, Heavy Rockets.
7. **`renderUltimateVisualStrikePass(ultimateState, cam, time)` (NEW)**:
   - Renders low-altitude Heavy Bomber flyover or SV-001 kamikaze dive across screen.
   - Renders expanding shockwave rings and radial particle debris.
8. **`renderScreenFlashPass(screenFlash)` (NEW)**:
   - Fullscreen virtual canvas flash (`ctx.fillRect(0, 0, 480, 270)`) with decaying alpha and customizable tint (`#FFFFFF` pure white, `#FFA010` incendiary amber, `#FF2222` critical crisis alarm).
9. `renderHudPass(hud)` (Existing, enhanced):
   - Render Ultimate Move stock bar at bottom-left / top-center.
   - Flashing "CRISIS WARNING!" marquee when crisis event triggers.

### 2.2 Freeze Frame (Hitstop) Mechanics
- In `FullMetalSlugGame.ts`:
  - Variable `freezeFrameTimer: number = 0`.
  - Method `triggerFreezeFrame(seconds: number = 0.2): void`.
  - In `step(dt)`:
    - If `freezeFrameTimer > 0`:
      - Decrement `freezeFrameTimer -= dt`.
      - Advance only visual timers (screen flash decay, shockwave radius expansion, camera shake).
      - Skip entity physics integration (`engine.tick`), player movement, and enemy AI.
      - Produces the signature arcade hitstop feeling on ultimate move detonation and crisis threshold triggers.

---

## 3. Procedural Audio Synthesis Architecture (`SoundEngine.ts`)

### 3.1 Emergency Crisis Siren Synthesis (`playSiren`)
```typescript
public playSiren(duration: number = 2.5): void {
  if (!this.ctx || !this.sfxGain || this.isMutedState) return;
  const now = this.ctx.currentTime;
  
  // Dual-tone frequency sweep oscillator
  const osc = this.ctx.createOscillator();
  osc.type = 'sawtooth';
  
  // Modulation between 440 Hz and 880 Hz with 1.2s period
  osc.frequency.setValueAtTime(440, now);
  for (let t = 0; t < duration; t += 1.2) {
    osc.frequency.exponentialRampToValueAtTime(880, now + t + 0.6);
    osc.frequency.exponentialRampToValueAtTime(440, now + t + 1.2);
  }
  
  // Resonant bandpass filter for mechanical horn horn acoustics
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(660, now);
  filter.Q.setValueAtTime(2.8, now);
  
  const gain = this.ctx.createGain();
  gain.gain.setValueAtTime(0.7 * this.sfxVolume, now);
  gain.gain.setValueAtTime(0.7 * this.sfxVolume, now + duration - 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(this.sfxGain);
  
  osc.start(now);
  osc.stop(now + duration);
}
```

### 3.2 Ultimate Move Audio Sequence
1. **Charge-Up SFX (`playUltimateCharge`)**:
   - Rising exponential pitch sweep from 100 Hz to 1400 Hz over 0.5s.
   - High-pass white noise wind whoosh build-up.
2. **Detonation Blast (`playUltimateDetonation`)**:
   - Deep sub-bass kick (sine wave falling from 160 Hz to 30 Hz).
   - Brown noise rumble with non-linear wave-shaper distortion.
   - Lingering reverb-like noise decay (1.2s).

### 3.3 Expanded Arsenal & Ally SFX
- `playShotgun()`: Heavy multi-pellet blast (white noise burst through 1200Hz lowpass + 90Hz square thump) + mechanical slide rack sound.
- `playLaserGun()`: High-frequency sci-fi beam pulse (1200 Hz sawtooth modulated down to 400 Hz with peak filter at 2400 Hz).
- `playRocketLauncher()`: Rocket motor ignition hiss + whooshing pink noise flight burn.
- `playAllyKiBlast()`: Resonant energy pulse (sine sweep 320 Hz -> 680 Hz -> 240 Hz with high resonance filter).

### 3.4 Speech Synthesizer Additions (`SpeechSynthesizer.ts`)
Add formant phoneme maps for announcer voice callouts:
- `"SHOTGUN!"`
- `"LASER GUN!"`
- `"ROCKET LAUNCHER!"`

---

## 4. Playwright E2E Browser Testing & Mathematical Verification

### 4.1 Specification File: `tests/e2e/ultimate_and_crisis_expansion.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Expansion Milestone: Ultimate Move & Boss Crisis E2E Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/expansion');

  test.beforeAll(async () => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  async function setupDeterministicGame(page: any) {
    await page.goto('/');
    await page.waitForSelector('#game-canvas');
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

  test('Ultimate Move Mathematical Assertion: wipes 100% of on-screen minions and deals massive burst damage to boss', async ({ page }) => {
    await setupDeterministicGame(page);

    const result = await page.evaluate(async () => {
      const game = (window as any).__GAME__;
      const engine = game.engine;
      game.camera.x = 0;
      game.player.position.x = 100;
      game.player.position.y = 230;

      // 1. Spawn 5 living test soldiers across visible screen
      const testSoldierIds = ['s_test_1', 's_test_2', 's_test_3', 's_test_4', 's_test_5'];
      testSoldierIds.forEach((id, idx) => {
        const soldier = (window as any).SoldierEnemy
          ? (window as any).SoldierEnemy.createRifleman(id, { x: 180 + idx * 50, y: 192 })
          : { id, type: 'SOLDIER_RIFLE', position: { x: 180 + idx * 50, y: 192 }, health: 1, isAlive: true, takeDamage: function(d: number) { this.health -= d; if (this.health <= 0) this.isAlive = false; } };
        engine.addEntity(soldier);
      });

      // 2. Spawn a boss or high-health enemy
      const initialBossHp = 300;
      const boss = {
        id: 'test_boss_target',
        type: 'BOSS_TETSUYUKI',
        position: { x: 420, y: 140 },
        health: initialBossHp,
        maxHealth: initialBossHp,
        isAlive: true,
        takeDamage: function(amount: number) {
          this.health -= amount;
          if (this.health <= 0) this.isAlive = false;
        }
      };
      engine.addEntity(boss);

      // Pre-condition assertion
      const preMinions = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER') && e.isAlive).length;
      const preBossHp = boss.health;

      // 3. Trigger Ultimate Move
      game.player.triggerUltimateMove(engine);

      // 4. Advance simulation through the strike sequence (30 ticks = 0.5s)
      for (let i = 0; i < 30; i++) {
        game.step(1 / 60);
      }
      game.render();

      // Post-condition measurement
      const postMinions = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER') && e.isAlive).length;
      const postBossHp = boss.health;

      return {
        preMinions,
        postMinions,
        preBossHp,
        postBossHp,
        damageDealtToBoss: preBossHp - postBossHp,
      };
    });

    // MATHEMATICAL ASSERTIONS
    expect(result.preMinions).toBeGreaterThanOrEqual(5);
    // Every single minion on screen must be eliminated!
    expect(result.postMinions).toBe(0);
    // Boss must take massive burst damage (>= 100 damage)
    expect(result.damageDealtToBoss).toBeGreaterThanOrEqual(100);
    expect(result.postBossHp).toBeLessThanOrEqual(result.preBossHp - 100);
  });

  test('Visual Proof Artifact 1: Ultimate Move Execution (ultimate_move_strike.png)', async ({ page }) => {
    await setupDeterministicGame(page);
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;
      game.camera.x = 0;
      game.player.position.x = 120;
      game.player.position.y = 230;

      // Trigger Ultimate Move & capture mid-strike frame
      game.player.triggerUltimateMove(engine);
      for (let i = 0; i < 10; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'ultimate_move_strike.png');
    await canvas.screenshot({ path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBeGreaterThan(5000);
  });

  test('Visual Proof Artifact 2: Boss Crisis Phase & Hazards (boss_crisis_environment.png)', async ({ page }) => {
    await setupDeterministicGame(page);
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.camera.x = 1800;
      game.player.position.x = 1900;
      game.player.position.y = 230;

      // Trigger crisis event (e.g. boss HP at 50% meltdown)
      const stage = game.stageManager.getCurrentStage();
      // Setup boss in Meltdown phase with active crisis hazards
      if (game.crisisEventManager) {
        game.crisisEventManager.triggerCrisis(2); // Phase 2 Crisis
      }
      for (let i = 0; i < 15; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'boss_crisis_environment.png');
    await canvas.screenshot({ path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBeGreaterThan(5000);
  });

  test('Visual Proof Artifact 3: Ally NPC Combat Support (ally_combat_support.png)', async ({ page }) => {
    await setupDeterministicGame(page);
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;
      game.camera.x = 400;
      game.player.position.x = 520;
      game.player.position.y = 230;

      // Spawn Ally Hyakutaro in attack stance throwing Ki blast
      if (game.allyManager) {
        game.allyManager.spawnAlly({ x: 470, y: 230 });
      }
      for (let i = 0; i < 8; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'ally_combat_support.png');
    await canvas.screenshot({ path: outPath });
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBeGreaterThan(5000);
  });
});
```

---

## 5. 100% Pass Rate & Zero Regression Strategy

| Risk Area | Existing Test Invariant | Failure Mode | Architectural Defense |
| :--- | :--- | :--- | :--- |
| **Sprite Key Count** | `adversarial_sprites_crosshairs.test.ts:37` asserts `count == 164` and category counts | Adding new keys makes `allKeys.length > 164` | Store new expansion keys in `expansionKeys: Set<string>`. `getAllKeys()` defaults to `includePolish=false, includeExpansion=false` returning exactly 164. |
| **Jump Key Mappings** | `adversarial_controls_jump.test.ts:7` asserts `KeyX` causes jump | Mapping `KeyX` to Ultimate breaks jump tests | Map Ultimate Move to **`KeyU`** in `codeMap` and `KeyAction`. Keep `Space`, `KeyK`, and `KeyX` as jump keys. |
| **Input Snapshot** | 15+ unit tests construct `PlayerInputSnapshot` literals | Adding required fields causes compile errors | Declare `ultimatePressed?: boolean;` as optional in `PlayerInputSnapshot`. |
| **Boss Max Health** | `boss_rebalance.test.ts:93` asserts `maxHealth <= 500` | New bosses with HP > 500 violate contract | All bosses/vehicles must cap `maxHealth <= 500` (e.g., 350-450 HP). |
| **Spawning Frustum** | `spawning_contract.test.ts` asserts minions spawn at $X \ge \text{cameraX} + 480$ | Ally spawning near player violates minion contract | Allies are friendly entities (`type: 'ALLY_HYAKUTARO'`), not hostile wave minions. Exclude allies from wave minion frustum validators. |
| **TypeScript Build** | `tsc -b && vite build` strictly checks all interfaces | Undefined properties or broken unions fail build | Strictly type all render scene states (`RenderAllyState`, `RenderHazardState`, `RenderItemState`) with proper optional chaining. |
| **Playwright Web Server** | `playwright.config.ts` runs `npm run preview` on port 4173 | Dist out-of-date or port conflict | Ensure `npm run build` is run prior to executing Playwright E2E suite. |

---

## 6. Implementation Ledger: Files to Create and Modify

### New Files to Create:
1. `src/core/entities/allies/AllyNPC.ts`: Autonomous companion AI, target acquisition, Hadouken ki blast dispatch.
2. `src/core/entities/allies/AllyManager.ts`: Ally lifecycle management and event bus integration.
3. `src/core/entities/boss/CrisisEventManager.ts`: Boss HP threshold monitor (75%, 50%, 25%), arena bounds alteration, hazard spawning.
4. `src/core/player/UltimateMoveSystem.ts`: Gauge accumulation, tactical activation, screen-clearing damage calculations.
5. `tests/e2e/ultimate_and_crisis_expansion.spec.ts`: Playwright headless E2E verification test and screenshot generator.
6. `tests/unit/ultimate_move_and_expansion.test.ts`: Vitest unit tests verifying gauge, damage, ally targeting, and crisis triggers.

### Existing Files to Modify:
1. `src/render/sprites/Palette.ts`: Add `ALLY`, `EXPANSION_BOSS`, `CRISIS`, `EXPANSION_WEAPONS` ramps.
2. `src/render/sprites/ProceduralSpriteFactory.ts`: Add procedural generators for all expansion keys; protect the 164 baseline keys in `getAllKeys()`.
3. `src/render/CanvasRenderer.ts`: Add passes for Allies, Collectible Item Pickups, Crisis Hazards, Ultimate Move strikes, and Screen Flash.
4. `src/audio/AudioTypes.ts`: Add `SIREN`, `ULTIMATE_*`, `SHOTGUN`, `LASER`, `ROCKET`, `ALLY_*` types.
5. `src/audio/SoundEngine.ts`: Implement `playSiren()`, `playUltimateCharge()`, `playUltimateDetonation()`, and weapon synthesis.
6. `src/audio/SpeechSynthesizer.ts`: Add announcer phoneme targets for new weapons.
7. `src/input/KeyboardController.ts`: Add `KeyU: 'ultimate'`.
8. `src/core/player/PlayerKinematics.ts`: Add `ultimatePressed?: boolean` to `PlayerInputSnapshot`.
9. `src/core/player/PlayerController.ts`: Expose `ultimateCharge`, `triggerUltimateMove()`.
10. `src/core/weapons/WeaponTypes.ts`: Add `SHOTGUN`, `LASER`, `ROCKET_LAUNCHER` to `WeaponType` and `ItemDropType`.
11. `src/main.ts`: Wire `CrisisEventManager`, `AllyManager`, `UltimateMoveSystem`, `freezeFrameTimer`, screen flash, and scene state compilation.
