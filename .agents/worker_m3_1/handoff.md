# Handoff Report: Milestone M3 — Ultimate Move System & Procedural Sprites / Cinematic FX

## 1. Observation
- **Direct Observations**:
  - `src/core/player/UltimateManager.ts` implements the full 4-phase cinematic state machine:
    - Phase 1 `FREEZE` (duration 0.5s): Simulation freezes, screen color flashes, siren audio triggers.
    - Phase 2 `STRIKE_PASS` (duration 0.6s): Tactical bomber jet flies across screen at Y=48 with ground shadow at Y=220, engine roar audio triggers.
    - Phase 3 `DETONATION` (duration 0.4s): Apocalyptic shockwave, camera shake (amplitude 12, frequency 30), lethal 999 damage wiping 100% of standard enemies (`SoldierEnemy`, `EnemyVehicle`, etc.) within viewport `[cameraX, 0, 480, 270]`, clears enemy bullets/projectiles (`ENEMY_BULLET`, `ENEMY_ROCKET`), inflicts exactly 120 burst damage to bosses (`IronNokanaBoss`, `TetsuyukiBoss`, `MidBossVehicle`).
    - Phase 4 `RECOVERY` (duration 0.3s): FX fades out, camera shake dampens, simulation resumes.
    - Transitions to `IDLE` (or `READY` if stock >= 1).
  - Tactical Stock Management:
    - Initial stock: 1, Max stock: 3.
    - Rejects trigger when `stock === 0` or when `phase !== IDLE`.
  - Viewport Spatial Culling & Safe Units:
    - Off-screen minions outside `[cameraX, 0, 480, 270]` are 100% preserved (verified at X = 500+ when cameraX = 0).
    - Zero friendly fire: Player (`PlayerController`), Allies (`AllyNPC`, `AllyKiBlast`), and POW hostages (`PowEntity`, `PrisonerEntity`) take zero damage.
  - Dedicated Key Mapping:
    - `src/input/KeyboardController.ts`: Mapped `KeyU` / `'u'` to `ultimate`. `PlayerInputSnapshot` includes `ultimatePressed?: boolean`.
    - `KeyX` strictly remains mapped to `jump` (verified by `tests/unit/adversarial_controls_jump.test.ts`).
  - Procedural Sprite Factory 164 Baseline Invariant:
    - `src/render/sprites/ProceduralSpriteFactory.ts`: 41 expansion sprites (`bomber_aircraft`, `bomber_shadow`, `shockwave_ring`, `smoke_plume_*`, `muzzle_flash_*`, `debris_*`, `laser_beam_*`) are registered in `expansionKeys: Set<string>`.
    - `getAllKeys(includePolish = false, includeExpansion = false)` returns exactly 164 keys, preserving the baseline invariant verified by `tests/unit/adversarial_sprites_crosshairs.test.ts`.
  - Cinematic FX Pass in CanvasRenderer:
    - `src/render/CanvasRenderer.ts`: `renderCinematicFXPass` renders screen flash overlay, tactical bomber aircraft & ground shadow, expanding shockwave rings, and applies viewport shake offset.
  - Headless Web Audio Synthesis:
    - `src/audio/SoundEngine.ts`: `playUltimateSiren()`, `playFlyoverRoar()`, `playApocalypticBlast()` with guard `if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;`.
  - Test Suite Results:
    - `tests/unit/ultimate_move_system.test.ts`: 28 tests passing.
    - Full project test suite: `npx vitest run`:
      `Test Files 32 passed (32)`
      `Tests 417 passed (417)`
      `Duration 27.54s`
    - Full TypeScript typecheck: `npx tsc -b` exited with code 0 (zero errors).
    - Full production build: `npm run build` exited with code 0 (zero errors).

## 2. Logic Chain
1. *Observation*: Milestone M3 requires an Ultimate Move system with 4 cinematic phases, stock management, lethal minion wipe, 120 boss damage, off-screen preservation, and zero friendly fire.
2. *Deduction*: Placing the cinematic state machine in `src/core/player/UltimateManager.ts` isolates ultimate lifecycle, timing, event dispatch, and damage execution.
3. *Observation*: `StageManager` manages camera position and world boundaries, but lacked standardized viewport getters.
4. *Deduction*: Adding `getCamera()` and `getViewportBoundingBox()` to `src/core/engine/StageManager.ts` and `src/core/stage/StageManager.ts` allows `UltimateManager` and renderer to query the active viewport `[cameraX, 0, 480, 270]`.
5. *Observation*: `adversarial_sprites_crosshairs.test.ts` asserts `factory.getAllKeys().length === 164` with exact category breakdown.
6. *Deduction*: Separating expansion keys into `expansionKeys: Set<string>` and keeping `getAllKeys(includePolish = false, includeExpansion = false)` returning default keys satisfies existing tests while allowing expansion systems to access expansion sprites via `getAllKeys(true, true)` or `hasKey()`.
7. *Observation*: `adversarial_controls_jump.test.ts` asserts `KeyX` binds to `jump`.
8. *Deduction*: Binding `KeyU` exclusively to `ultimate` leaves `KeyX` intact, ensuring 100% backwards compatibility and passing jump tests.
9. *Observation*: Running `tsc -b`, `npm run build`, and `vitest run` on the entire test suite achieves 0 type errors, 0 build errors, and 417/417 passing tests across 32 files.
10. *Conclusion*: Milestone M3 is complete, fully functional, and verified with zero regressions.

## 3. Caveats
- Audio generation relies on Web Audio API oscillators and gain nodes; in headless environments (like Node.js / CI without Web Audio), the audio calls safely no-op via null-checks.
- Canvas rendering was verified through unit mock contexts (`renderCinematicFXPass` and `render_components.test.ts`); full visual verification in a browser will visually display the alpha overlays and bomber sprites.

## 4. Conclusion
Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX) is fully implemented, verified, and ready for deployment. All contracts specified in `PROJECT.md` and Explorer reports are satisfied.

## 5. Verification Method
To independently verify:
```bash
# 1. Typecheck
npx tsc -b

# 2. Production build
npm run build

# 3. Targeted test suite
npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_sprites_crosshairs.test.ts

# 4. Full test suite (all 32 suites)
npx vitest run
```
Invalidation conditions:
- Any failure in `tests/unit/ultimate_move_system.test.ts`
- `adversarial_sprites_crosshairs.test.ts` reporting total keys != 164
- `adversarial_controls_jump.test.ts` reporting KeyX not bound to jump
- Any TypeScript error under `npx tsc -b`
