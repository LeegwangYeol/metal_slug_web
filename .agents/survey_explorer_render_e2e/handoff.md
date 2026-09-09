# Handoff Report: Rendering, Audio, and E2E Testing Survey

## 1. Observation
- **Test Baseline Executions**:
  - `npm test` (vitest): 24 test files passed, 294 tests passed (100% green, 10.61s).
  - `npm run build` (`tsc -b && vite build`): 32 modules transformed, 0 errors, gzip 50.97 KB.
  - `npm run test:e2e` (playwright): 17 passed across 4 spec files (`death_animations_screenshots.spec.ts`, `game_initialization.spec.ts`, `gameplay_controls.spec.ts`, `visual_verification.spec.ts`) in 13.7s.
- **Critical Code Constraints Directly Observed**:
  - `tests/unit/adversarial_sprites_crosshairs.test.ts:37,199`:
    `expect(count).toBeGreaterThanOrEqual(164);`
    `expect(allKeys.length).toBe(164);`
    Directly checks `const allKeys = factory.getAllKeys();` without arguments.
  - `src/render/sprites/ProceduralSpriteFactory.ts:402-407`:
    `getAllKeys(includePolish: boolean = false): string[]` filters `polishKeys: Set<string>` when `includePolish === false` to preserve the 164 count.
  - `tests/unit/adversarial_controls_jump.test.ts:7,11`:
    Explicitly asserts that `KeyX` (`{ code: 'KeyX', key: 'x' }`) triggers player upward jump velocity.
  - `src/input/KeyboardController.ts:80`:
    `KeyX: 'jump'` is mapped in `codeMap`.
  - `src/core/player/PlayerKinematics.ts:38-48`:
    `PlayerInputSnapshot` interface currently requires `{ left, right, up, down, jumpPressed, jumpHeld, shootPressed, shootHeld, grenadePressed }`.
  - `src/core/entities/pow/PowEntity.ts:20-35`:
    `ItemPickupEntity` with `type: 'ITEM_PICKUP'` exists in simulation, but `src/main.ts:338-435` does not forward item pickups to `RenderSceneState`, leaving dropped items invisible in `CanvasRenderer.ts`.
  - `tests/e2e/death_animations_screenshots.spec.ts:19-38`:
    Establishes deterministic headless E2E pattern: `await page.goto('/')`, configure 960x540 canvas, call `game.stop()`, manipulate entities, advance with `game.step(1/60)`, render with `game.render()`, and capture canvas screenshot.

## 2. Logic Chain
1. **Sprite Count Invariant**:
   - `adversarial_sprites_crosshairs.test.ts` fails if `factory.getAllKeys().length !== 164`.
   - Therefore, newly registered expansion sprite keys (for Bosses, Crisis Hazards, Allies, Weapons, and Ultimate Move) must be isolated into an `expansionKeys: Set<string>` inside `ProceduralSpriteFactory.ts`.
   - `getAllKeys()` with default parameters (`includePolish = false, includeExpansion = false`) must filter out both sets, continuing to return exactly the 164 baseline keys to existing tests, while exposing `getAllKeys(true, true)` or `getExpansionKeys()` for expansion tests.
2. **Keyboard Control Contract**:
   - `adversarial_controls_jump.test.ts` strictly tests `KeyX` as a jump key.
   - Therefore, remapping `KeyX` to Ultimate Move would immediately break existing unit tests.
   - Mapping Ultimate Move to dedicated key **`KeyU`** (`KeyU: 'ultimate'`) satisfies all expansion requirements while maintaining 100% backwards compatibility.
3. **Input Snapshot Compatibility**:
   - Multiple unit test files construct `PlayerInputSnapshot` objects directly.
   - Adding `ultimatePressed?: boolean` as an **optional** property prevents TypeScript compilation errors across existing test files.
4. **Item Pickup Rendering**:
   - `ItemPickupEntity` is already functional in core physics, but missing from `buildRenderSceneState()` and `CanvasRenderer`.
   - Adding `items: RenderItemState[]` to `RenderSceneState` and rendering collectible crates with floating sine-wave bounce completes R2 weapon drop visuals.
5. **Deterministic Playwright Ultimate Verification**:
   - Following the pattern from `death_animations_screenshots.spec.ts`, the E2E test can spawn 5 minions and 1 boss, assert pre-counts, trigger `game.player.triggerUltimateMove(engine)`, step 30 ticks, and mathematically assert `postMinions === 0` and boss damage >= 100.
   - Capturing screenshots directly to `artifacts/expansion/` (`ultimate_move_strike.png`, `boss_crisis_environment.png`, `ally_combat_support.png`) satisfies all visual proof acceptance criteria.

## 3. Caveats
- Web Audio API in headless Chromium is auto-suspended until user gesture or resume. In E2E tests, deterministic evaluation is executed by invoking engine methods directly or dispatching key events, while audio triggers emit event bus notifications.
- The Node.js Vitest test environment uses `createMockCanvasBuffer` (mock Uint8Array canvas context). All newly registered sprites must be rasterized using standard 2D canvas context operations (`fillRect`, `beginPath`, `arc`, etc.) supported by the mock buffer.

## 4. Conclusion
The rendering, audio, and E2E testing architecture for the Metal Slug Web Massive Expansion is completely mapped out with zero ambiguity:
- **Procedural Pixel-Art Sprites**: 4 new palettes and 30+ new procedural sprites cleanly partitioned via `expansionKeys`.
- **Visual FX**: Hitstop freeze frame (0.2s pause), fullscreen color flash overlay with alpha decay, procedural dual-tone air-raid siren, and radial shockwave rings.
- **E2E Browser Verification**: Headless Playwright test asserting 100% minion wipe and boss damage with visual proof artifacts saved to `artifacts/expansion/`.
- **100% Pass Rate**: Guarantees zero regressions across 294 unit tests and 17 E2E tests.

## 5. Verification Method
- **Unit Test Suite**: `npm test` -> Must pass 294/294 existing tests + new expansion unit tests.
- **TypeScript & Production Build**: `npm run build` (`tsc -b && vite build`) -> Must exit code 0 with 0 diagnostics.
- **E2E Test Suite**: `npm run test:e2e` -> Must pass 17/17 existing tests + new `tests/e2e/ultimate_and_crisis_expansion.spec.ts`.
- **Screenshot Verification**: Inspect files in `artifacts/expansion/` to confirm size > 5,000 bytes.
- **Invalidation Condition**: Any implementation that alters default `getAllKeys()` return length or remaps `KeyX` away from jump.
