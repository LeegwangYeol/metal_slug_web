# Handoff Report: Milestone M3 Iteration 2 — Ultimate Move Integration & Remediation

## 1. Observation
1. **Defect 1 (`KeyU` Input Dropped in `src/main.ts`)**:
   - Location: `src/main.ts:247-258` (`FullMetalSlugGame.step()`).
   - Prior state: `PlayerInputSnapshot` was built from `kbSnap` and `touchSnap` but omitted `ultimatePressed`.
   - Resolution: Added `ultimatePressed: kbSnap.ultimatePressed,` to the input snapshot passed to `this.player.handleInput(input, dt, this.engine)`.
2. **Defect 2 (`UltimateManager.executeDetonation` and `entitiesToAdd` Sync)**:
   - Location: `src/core/player/UltimateManager.ts:300-360`.
   - Prior state: `executeDetonation()` only queried `engine.getAllEntities()`, omitting entities in `(engine as any).entitiesToAdd` that were added prior to `engine.tick()`. Additionally, culled projectiles were not removed from `entitiesToAdd`.
   - Resolution:
     - Merged `(engine as any).entitiesToAdd` into candidate entities list.
     - When culling hostile projectiles (`ENEMY_BULLET`, `ENEMY_GRENADE`, `CANNON_SHELL`, `ARTILLERY_SHELL`, `HOMING_MISSILE`), set `ent.isAlive = false`, called `engine.removeEntity(ent.id)`, and spliced the projectile out of `(engine as any).entitiesToAdd`.
     - Implemented `cameraShakeOffset` getter returning `{ x: number, y: number }` (with active shake offset in DETONATION phase and `{ x: 0, y: 0 }` in IDLE/other phases).
3. **Defect 3 (`cinematicFX` Presentation Pass in `src/main.ts`)**:
   - Location: `src/main.ts:470-484` (`buildRenderSceneState()`) and `src/core/player/UltimateManager.ts`.
   - Prior state: `buildRenderSceneState()` did not populate `cinematicFX` in the `RenderSceneState`, and `UltimateManager` did not expose `getCinematicState()`.
   - Resolution:
     - Implemented `public getCinematicState(): RenderCinematicFXState | undefined` on `UltimateManager` returning `undefined` when IDLE, and populating `screenFlashAlpha`, `screenFlashColor`, `bomber`, `shockwaves`, and `cameraShake` during `FREEZE`, `STRIKE_PASS`, `DETONATION`, and `RECOVERY` phases matching `CanvasRenderer.renderCinematicFXPass()` interface contracts.
     - Populated `cinematicFX: this.player.ultimateManager?.getCinematicState()` in `src/main.ts:buildRenderSceneState()`.
4. **Defect 4 (Ultimate Audio Event Bus Routing in `src/main.ts`)**:
   - Location: `src/main.ts:526-575` (`setupAudioAndEventBus()`).
   - Prior state: `sfx_air_raid_siren`, `sfx_bomber_flyover`, and `sfx_heavy_detonation` events were not handled in the `play_sound` switch block.
   - Resolution: Mapped events in `play_sound`:
     - `sfx_air_raid_siren` / `sfx_ultimate_siren` -> `this.soundEngine.playUltimateSiren()`
     - `sfx_bomber_flyover` / `sfx_flyover_roar` -> `this.soundEngine.playFlyoverRoar()`
     - `sfx_heavy_detonation` / `sfx_apocalyptic_blast` -> `this.soundEngine.playApocalypticBlast()`
5. **Test Compatibility & Adversarial Stress Tests**:
   - Location: `tests/unit/adversarial_m3_challenger_stress.test.ts:394` & end of file.
   - Verified line 394: `new PowEntity('pow_friendly_1', vec2(150, 200))` correctly passes ID.
   - Added empirical tests:
     - `EMPIRICAL 3G`: Validates `cameraShakeOffset` getter behavior across IDLE and DETONATION phases.
     - `EMPIRICAL 3H`: Validates `entitiesToAdd` synchronization for un-ticked minions and projectiles.
     - `EMPIRICAL 3I`: Validates `getCinematicState()` across all 4 phases and IDLE.
6. **Tool Execution Verification Results**:
   - `npx tsc -b`: PASS (Exit code 0, 0 type errors).
   - `npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts`: PASS (3 files, 64 passed, Exit code 0).
   - `npx vitest run`: PASS (34 test files, 453 passed, 0 failed, Exit code 0).
   - `npm run build`: PASS (Exit code 0, production bundle built in 12.99s, `dist/assets/index-DPtp5WSx.js`).

## 2. Logic Chain
1. *Observation*: Milestone M3 requires an operational KeyU ultimate move triggering a 4-phase cinematic sequence, 100% minion elimination, 120 boss damage, audio callouts, and visual effects pass.
2. *Observation*: Reviewer 1 identified that in `src/main.ts:247-257`, `kbSnap.ultimatePressed` was dropped from `PlayerInputSnapshot`, preventing KeyU from ever triggering `player.handleInput()` in live execution.
3. *Deduction*: Adding `ultimatePressed: kbSnap.ultimatePressed` directly closes the loop between `KeyboardController` and `PlayerController.triggerUltimateMove()`.
4. *Observation*: Entities added via `engine.addEntity()` during the current frame reside in `(engine as any).entitiesToAdd` until `engine.tick()` executes.
5. *Deduction*: Merging `entitiesToAdd` in `UltimateManager.executeDetonation()` ensures zero omissions for newly spawned entities, and splicing culled projectiles out of `entitiesToAdd` guarantees hostile projectiles cannot leak into subsequent ticks.
6. *Observation*: `CanvasRenderer.renderCinematicFXPass` expects `RenderCinematicFXState` on `RenderSceneState.cinematicFX`.
7. *Deduction*: Implementing `getCinematicState()` on `UltimateManager` and forwarding it in `buildRenderSceneState()` enables full rendering of the tactical bomber flyover, screen flash, camera jitter, and expanding shockwave rings during gameplay.
8. *Observation*: `SoundEngine` implements `playUltimateSiren()`, `playFlyoverRoar()`, and `playApocalypticBlast()`, but `main.ts:setupAudioAndEventBus()` lacked cases for `sfx_air_raid_siren`, `sfx_bomber_flyover`, and `sfx_heavy_detonation`.
9. *Deduction*: Adding these cases routes Web Audio synthesis directly from `UltimateManager` events.
10. *Observation*: Running `npx tsc -b`, targeted vitest suites, the entire 34-file test suite (`npx vitest run`), and `npm run build` yields 100% green tests and zero errors.
11. *Conclusion*: All 4 integration defects and test compatibility issues are completely resolved with genuine logic and verified across all test tiers.

## 3. Caveats
- Web Audio API in headless test environments safely no-ops via guard checks (`!this.canPlaySFX() || !this.ctx || !this.sfxGain`).
- No further code changes are required for Milestone M3.

## 4. Conclusion
Milestone M3 Iteration 2 is fully complete and robust. The Ultimate Move system is integrated into live game inputs, presentation rendering, audio routing, and headless entity synchronization, passing 100% of the project's test suite (34 files, 453 tests).

## 5. Verification Method
To independently verify:
```bash
# 1. Typecheck
npx tsc -b

# 2. Targeted ultimate and adversarial suites
npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts

# 3. Full project test suite (34 test files)
npx vitest run

# 4. Production build
npm run build
```
Invalidation conditions:
- Any TypeScript error under `npx tsc -b`.
- Any failure in `ultimate_move_system.test.ts`, `adversarial_ultimate_challenge.test.ts`, or `adversarial_m3_challenger_stress.test.ts`.
- Any failure in `npx vitest run`.
- Any error during `npm run build`.
