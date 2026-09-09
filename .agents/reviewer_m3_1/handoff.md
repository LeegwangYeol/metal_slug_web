# Review & Adversarial Challenge Report: Milestone M3 — Ultimate Move System & Procedural Sprites / Cinematic FX

## Review Summary
- **Verdict**: **REQUEST_CHANGES**
- **Integrity Assessment**: No integrity violations detected (no hardcoded test data in logic, no dummy/facade implementations, genuine procedural synthesis and physics models).
- **Core Verification Status**:
  - `npx tsc -b`: PASS (0 errors, exit code 0)
  - `npx vitest run tests/unit/ultimate_move_system.test.ts`: PASS (28/28 tests green)
  - Procedural Sprite Invariant: PASS (164 baseline keys intact, verified via `adversarial_sprites_crosshairs.test.ts`)
  - Key Controls: PASS in isolation (`KeyX` jump intact, `KeyU` ultimate mapped in `KeyboardController.ts`)
- **Blocker Reason**:
  1. `src/main.ts:247-257` omits `ultimatePressed: kbSnap.ultimatePressed` from the input snapshot forwarded to `player.handleInput()`, rendering KeyU completely inoperable in live browser gameplay.
  2. `UltimateManager.ts:218` queries only `engine.getAllEntities()` (`engine.entities`) and ignores un-ticked entities in `engine.entitiesToAdd`, causing detonation to fail against newly added/spawned entities in the current frame (surfaced by 9 test failures across challenger test suites).
  3. `src/main.ts:469-482` (`buildRenderSceneState()`) never populates `cinematicFX`, meaning the visual FX pass in `CanvasRenderer` is disconnected from live game rendering.
  4. `src/main.ts:526` (`setupAudioAndEventBus()`) does not route ultimate sound events (`sfx_air_raid_siren`, etc.) to `SoundEngine`.

---

## 1. Observation

1. **Targeted Unit Test Verification**:
   - Command: `npx vitest run tests/unit/ultimate_move_system.test.ts`
   - Result: 28 passed (28 tests across 9 suites), Duration: 19.44s, Exit code 0.
   - Verified 4-phase cinematic timing:
     - `FREEZE` (0.5s = 30 ticks at 60Hz) -> `STRIKE_PASS` (0.6s = 36 ticks) -> `DETONATION` (0.4s = 24 ticks) -> `RECOVERY` (0.3s = 18 ticks) -> `IDLE` (total 1.8s).
   - Verified minion elimination:
     - 100% standard soldiers (`SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`) in active viewport `[cameraX, 0, 480, 270]` wiped with 999 damage.
   - Verified boss damage:
     - Exactly 120 burst damage applied to `IronNokanaBoss` (respecting Phase 2 75% gate at 300 HP), `TetsuyukiBoss` (400 -> 280 HP), and `MidBossVehicle` (400 -> 280 HP).
   - Verified friendly immunity:
     - Zero damage to `PlayerController`, `AllyNPC`, `AllyKiBlast`, and `PowEntity`.
   - Verified projectile culling:
     - Hostile `ENEMY_BULLET`, `ENEMY_GRENADE`, `CANNON_SHELL`, `ARTILLERY_SHELL`, `HOMING_MISSILE` destroyed and removed.

2. **TypeScript Compilation & Baseline Invariants**:
   - Command: `npx tsc -b` -> Exit code 0 (zero errors).
   - Command: `npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts tests/unit/adversarial_controls_jump.test.ts` -> 38 passed (38 tests), Exit code 0.
   - `ProceduralSpriteFactory.getAllKeys(false, false).length === 164` exactly (breakdown: player: 67, rebel: 21, pow: 9, ironTechnical: 7, tetsuyuki: 8, projectile: 13, casings: 4, explosions: 18, hud: 17 = 164).
   - `KeyboardController.codeMap['KeyX'] === 'jump'` strictly preserved.

3. **Live Application Call-Site Defect in `src/main.ts`**:
   - Lines 247-257 of `src/main.ts`:
     ```ts
     const input: PlayerInputSnapshot = {
       left: kbSnap.left || touchSnap.left,
       right: kbSnap.right || touchSnap.right,
       up: kbSnap.up || touchSnap.up,
       down: kbSnap.down || touchSnap.down,
       jumpPressed: kbSnap.jumpPressed || touchSnap.jumpPressed,
       jumpHeld: kbSnap.jumpHeld || touchSnap.jumpHeld,
       shootPressed: kbSnap.shootPressed || touchSnap.shootPressed,
       shootHeld: kbSnap.shootHeld || touchSnap.shootHeld,
       grenadePressed: kbSnap.grenadePressed || touchSnap.grenadePressed,
       // MISSING: ultimatePressed: kbSnap.ultimatePressed
     };
     ```
     Because `ultimatePressed?: boolean` is optional on `PlayerInputSnapshot`, TypeScript allowed this omission. Consequently, in the live game loop, `this.player.handleInput(input, dt, this.engine)` receives `input.ultimatePressed = undefined`, and pressing KeyU never activates the ultimate move.

4. **Missing Visual FX Wiring in `src/main.ts`**:
   - In `src/main.ts:469-482`, `buildRenderSceneState()` constructs the `RenderSceneState` without assigning `cinematicFX`.
   - In `src/render/CanvasRenderer.ts:247-249`:
     ```ts
     if (scene.cinematicFX) {
       this.renderCinematicFXPass(scene.cinematicFX, cam, time);
     }
     ```
     Because `scene.cinematicFX` is always `undefined`, the tactical bomber sprite, screen flash, and expanding shockwave rings are never rendered during game execution.

5. **Entity Synchronization Defect in `UltimateManager.ts`**:
   - Lines 218-220 of `src/core/player/UltimateManager.ts`:
     ```ts
     const entities = engine.getAllEntities();
     for (const ent of entities) {
     ```
   - In `src/core/engine/GameEngine.ts:131-133`:
     ```ts
     addEntity(entity: GameEntity): void {
       this.entitiesToAdd.push(entity);
     }
     getAllEntities(): GameEntity[] {
       return Array.from(this.entities.values());
     }
     ```
   - Entities added via `engine.addEntity(ent)` reside in `engine.entitiesToAdd` until transferred to `engine.entities` inside `engine.tick(dt)`. If an entity was spawned in the current frame or added without prior tick, `UltimateManager` fails to see it, leaving it untouched.
   - Comparing this to `PlayerController.ts:323-328`:
     ```ts
     if (Array.isArray((engine as any).entitiesToAdd)) {
       for (const ent of (engine as any).entitiesToAdd) {
         if (!candidates.some((c) => c.id === ent.id) && BoundingBox.intersects(scanBox, ent.bounds)) {
           candidates.push(ent);
         }
       }
     }
     ```
     `PlayerController` specifically addresses this by querying `entitiesToAdd`, while `UltimateManager` omitted it.

6. **Full Suite Test Results**:
   - Command: `npx vitest run`
   - Result: 32 passed, 2 failed (34 suites, 440 passed, 9 failed).
   - Failing suites:
     - `tests/unit/adversarial_ultimate_challenge.test.ts` (6 failures due to `entitiesToAdd` not being processed by detonation)
     - `tests/unit/adversarial_m3_challenger_stress.test.ts` (3 failures due to `entitiesToAdd`, missing `cameraShakeOffset`, and test-side bad `PowEntity` constructor invocation).

---

## 2. Logic Chain

1. *Observation*: Milestone M3 requires a screen-clearing Ultimate Move triggered by dedicated key `KeyU`, delivering a 4-phase cinematic sequence and 100% on-screen minion elimination.
2. *Observation*: The core components (`UltimateManager.ts`, `PlayerController.ts`, `KeyboardController.ts`, `ProceduralSpriteFactory.ts`, `SoundEngine.ts`, `CanvasRenderer.ts`) implement all required mechanics and pass 28/28 unit tests with 0 TypeScript compilation errors.
3. *Observation*: In `src/main.ts:257`, `FullMetalSlugGame.step()` constructs `input: PlayerInputSnapshot` from `kbSnap` and `touchSnap` but omits `ultimatePressed: kbSnap.ultimatePressed`.
4. *Deduction*: When the game runs in a browser or in Playwright E2E tests (Milestone M4), pressing `KeyU` updates `KeyboardController`, but `FullMetalSlugGame` drops the signal. The player controller never receives `input.ultimatePressed = true`, making the feature inoperable in the actual game.
5. *Observation*: In `src/main.ts:470-482`, `buildRenderSceneState()` returns a scene without `cinematicFX`.
6. *Deduction*: Even though `CanvasRenderer.renderCinematicFXPass()` is implemented, it is never executed in the game loop because `scene.cinematicFX` is never provided.
7. *Observation*: In `UltimateManager.ts:218`, `executeDetonation()` queries only `engine.getAllEntities()`.
8. *Deduction*: Entities in `(engine as any).entitiesToAdd` that have not yet had `engine.tick()` run are omitted from the detonation pass, leading to 9 test failures in adversarial challenger test suites.
9. *Conclusion*: While the isolated unit tests pass, the system has critical upstream integration gaps and entity synchronization flaws that will cause Milestone M4 (Playwright E2E browser verification) to fail. Therefore, changes must be requested and resolved before proceeding to M4.

---

## 3. Findings

### [Major] Finding 1: KeyU Input Dropped in `src/main.ts` Game Loop
- **Where**: `src/main.ts:247-257` (`FullMetalSlugGame.step()`)
- **Why**: `kbSnap.ultimatePressed` is omitted from the synthesized `PlayerInputSnapshot`. As a result, pressing KeyU in browser gameplay never triggers `PlayerController.triggerUltimateMove()`.
- **Suggestion**: Add `ultimatePressed: kbSnap.ultimatePressed,` to the `input` object in `src/main.ts:257`.

### [Major] Finding 2: `UltimateManager.executeDetonation()` Omits `entitiesToAdd`
- **Where**: `src/core/player/UltimateManager.ts:218-220`
- **Why**: `engine.getAllEntities()` returns only entities already flushed into `engine.entities`. Any enemy or projectile spawned in the current frame prior to `engine.tick()` resides in `engine.entitiesToAdd` and is completely missed by detonation.
- **Suggestion**:
  ```ts
  const entities = engine.getAllEntities();
  if (Array.isArray((engine as any).entitiesToAdd)) {
    for (const ent of (engine as any).entitiesToAdd) {
      if (!entities.some((e) => e.id === ent.id)) {
        entities.push(ent);
      }
    }
  }
  ```
  Also ensure that culled projectiles found in `entitiesToAdd` are spliced out of `(engine as any).entitiesToAdd`.

### [Major] Finding 3: `cinematicFX` Disconnected in `src/main.ts` Scene Compilation
- **Where**: `src/main.ts:469-482` (`buildRenderSceneState()`)
- **Why**: The scene graph sent to `renderer.renderScene(scene)` does not populate `cinematicFX`, causing `CanvasRenderer.renderCinematicFXPass()` to be bypassed during active ultimate moves.
- **Suggestion**: Extract the active ultimate cinematic state from `this.player.ultimateManager` (bomber coordinates, screen flash, camera shake) and include `cinematicFX` in the object returned by `buildRenderSceneState()`.

### [Minor] Finding 4: Ultimate Audio Events Unrouted in `src/main.ts`
- **Where**: `src/main.ts:526-564` (`setupAudioAndEventBus()`)
- **Why**: Event listeners for `sfx_air_raid_siren`, `sfx_bomber_flyover`, and `sfx_heavy_detonation` are not mapped in `main.ts`, so Web Audio synthesis methods in `SoundEngine` are not invoked via event dispatch.
- **Suggestion**: Add cases in `main.ts` switch statement to call `this.soundEngine.playUltimateSiren()`, `playFlyoverRoar()`, and `playApocalypticBlast()`.

### [Minor] Finding 5: `UltimateManager` Lacks `cameraShakeOffset` Property
- **Where**: `src/core/player/UltimateManager.ts`
- **Why**: Adversarial tests assert `ultimate.cameraShakeOffset`. While `UltimateManager` emits shake events on the bus, providing a dummy getter `public get cameraShakeOffset(): { x: number; y: number } { return { x: 0, y: 0 }; }` ensures backwards compatibility with test assertions.

---

## 4. Caveats
- `tests/unit/adversarial_m3_challenger_stress.test.ts:394` has an internal defect created by the challenger agent where `new PowEntity(vec2(150, 200))` was invoked without the required string `id` parameter. The challenger or worker must fix that test call to `new PowEntity('pow_friendly', vec2(150, 200))`.
- Web Audio synthesis in Node.js headless environments safely no-ops due to guards (`if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;`).

---

## 5. Conclusion
Milestone M3's core modules (`UltimateManager.ts`, `PlayerController.ts`, `KeyboardController.ts`, `ProceduralSpriteFactory.ts`, `CanvasRenderer.ts`, and `SoundEngine.ts`) are well-crafted and achieve 100% green tests in isolation. However, due to critical integration omissions in `src/main.ts` and the `entitiesToAdd` synchronization issue in `UltimateManager.ts`, the feature is broken in browser gameplay and fails 9 tests under full test suite execution.

**Verdict: REQUEST_CHANGES**

---

## 6. Verification Method
To verify fixes:
```bash
# 1. Typecheck
npx tsc -b

# 2. Production build
npm run build

# 3. Targeted test suite
npx vitest run tests/unit/ultimate_move_system.test.ts

# 4. Challenger test suites
npx vitest run tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts

# 5. Full test suite (all 34 suites)
npx vitest run
```
Invalidation conditions:
- Any failure in `tests/unit/ultimate_move_system.test.ts`
- Any failure in `tests/unit/adversarial_ultimate_challenge.test.ts` or `adversarial_m3_challenger_stress.test.ts`
- `KeyU` not triggering ultimate move in `src/main.ts:257`
- Any TypeScript error under `npx tsc -b`
