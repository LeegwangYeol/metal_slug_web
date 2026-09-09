# Milestone M3 Reviewer Report: Ultimate Move System & Procedural Sprites / Cinematic FX

## Review Summary
**Verdict**: APPROVE

---

## 1. Observation

1. **`ProceduralSpriteFactory.ts` Baseline 164-Key Invariant**:
   - Location: `src/render/sprites/ProceduralSpriteFactory.ts:405-411`
   - Verified via runtime execution (`npx tsx -e ...`):
     - `getAllKeys()` (default call): exactly **164** keys.
     - `getAllKeys(true, false)` (polish included): **178** keys (164 + 14 polish keys).
     - `getAllKeys(false, true)` (expansion included): **205** keys (164 + 41 expansion keys).
     - `getAllKeys(true, true)` (both included): **219** keys.
   - Verified category audit breakdown in `tests/unit/adversarial_sprites_crosshairs.test.ts:162-200`:
     - `player`: 67
     - `rebel`: 21
     - `pow`: 9
     - `ironTechnical`: 7
     - `tetsuyuki`: 8
     - `projectile`: 13
     - `casings`: 4
     - `explosions`: 18
     - `hud`: 17
     - **Total**: 164.
   - Isolation mechanism:
     - `expansionKeys: Set<string>` at line 399.
     - `registerExpansionSprite` (lines 417-427) registers sprites directly into `this.expansionKeys`.
     - `getAllKeys` filters out `this.expansionKeys` unless `includeExpansion === true`.

2. **`CanvasRenderer.ts` Cinematic FX Passes**:
   - Location: `src/render/CanvasRenderer.ts:117-140`, `246-249`, `1030-1113`
   - Non-breaking architecture:
     - Guard: `if (scene.cinematicFX) { this.renderCinematicFXPass(scene.cinematicFX, cam, time); }` (line 247). When `cinematicFX` is undefined or null, pass is completely bypassed.
     - Transform safety: Camera shake translational jitter `ctx.save()` matches `ctx.restore()` strictly when `fx.cameraShake.intensity > 0` (lines 1040, 1111).
     - Sprite fallback: Tactical bomber and ground shadow render passes check `this.spriteFactory.hasSprite(...)`, falling back gracefully to solid rectangle geometry if sprites are missing.
     - Shockwaves: Each shockwave loop uses local `ctx.save()` / `ctx.restore()` with clamped alpha `Math.max(0, Math.min(1, alpha))` and radius clamping `Math.max(1, wave.radius)`.
     - Screen flash: Clamps alpha [0.0, 1.0], fills virtual resolution (480x270), safely restores context.
     - Layering: Placed at Pass 4.5 prior to Pass 5 HUD overlay (`renderHudPass`), ensuring high-priority retro arcade HUD indicators remain legible.

3. **`SoundEngine.ts` Headless Environment Audio Safety**:
   - Location: `src/audio/SoundEngine.ts:315-319`, `963-1145`
   - Universal guard in all procedural synthesis routines (`playUltimateSiren`, `playFlyoverRoar`, `playApocalypticBlast`):
     `if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;`
   - `canPlaySFX()` returns false if `!this.ctx || !this.sfxGain || this.isMutedState`.
   - In Node.js / headless environments without DOM `window`, `this.ctx` and `this.sfxGain` initialize as `null`.
   - Headless unit execution confirmed: `expect(() => sound.playUltimateSiren()).not.toThrow()`, etc., executed with zero uncaught exceptions.

4. **Dedicated Key Mapping & Kinematics Preservation**:
   - Location: `src/input/KeyboardController.ts:81-85`, `94-96`
   - `KeyU` / `'u'` binds to action `'ultimate'`.
   - `KeyX` / `'x'` strictly remains bound to action `'jump'`, with zero cross-talk.
   - `PlayerInputSnapshot` includes edge-triggered `ultimatePressed?: boolean`.

5. **Empirical Build & Vitest Verification**:
   - `npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts tests/unit/adversarial_controls_jump.test.ts`:
     - Output: `Test Files 2 passed (2)`, `Tests 38 passed (38)` (17 crosshair/sprite tests + 21 jump kinematics tests).
   - `npm run build`:
     - Output: `tsc -b && vite build` exited with code 0 (41 modules transformed, production build successful in 1.67s).
   - `tests/unit/ultimate_move_system.test.ts`:
     - Output: `Test Files 1 passed (1)`, `Tests 28 passed (28)`.
   - `tests/unit/adversarial_ultimate_challenge.test.ts`:
     - Output: `Test Files 1 passed (1)`, `Tests 17 passed (17)`.

---

## 2. Logic Chain

1. *Premise*: Acceptance criteria require that the default call to `ProceduralSpriteFactory.getInstance().getAllKeys()` must return exactly 164 keys so that baseline tests asserting 164 keys never fail.
2. *Observation*: Line 405-411 of `ProceduralSpriteFactory.ts` filters keys using `this.expansionKeys` and `this.polishKeys`. Runtime execution confirms `getAllKeys().length === 164`.
3. *Deduction*: Baseline sprite key invariant is strictly preserved without regression.
4. *Premise*: Acceptance criteria require that `CanvasRenderer` cinematic FX passes must be non-breaking and safely handle camera shake, shockwaves, bomber flyovers, and full-screen alpha overlays.
5. *Observation*: All context modifications within `renderCinematicFXPass` are enclosed in matched `ctx.save()` and `ctx.restore()` calls, values are clamped to safe ranges, and sprite draw calls have fallback branches.
6. *Deduction*: The rendering pipeline will not crash or corrupt the graphics context under any game state or missing sprite condition.
7. *Premise*: Audio synthesis must not crash in headless testing environments where the Web Audio API is unavailable.
8. *Observation*: Every expansion audio synthesis routine checks `!this.canPlaySFX() || !this.ctx || !this.sfxGain` before accessing audio graph nodes.
9. *Deduction*: Procedural audio synthesis is 100% headless-safe.
10. *Premise*: Controls must allocate `KeyU` to ultimate without colliding with existing controls (`KeyX` jump, `KeyC` grenade).
11. *Observation*: `KeyboardController.ts` maps `KeyU` to `ultimate`, while `KeyX` remains mapped to `jump`. The full adversarial suite `adversarial_controls_jump.test.ts` passed 21/21 tests.
12. *Conclusion*: Milestone M3 satisfies all functional, architectural, and presentation requirements.

---

## 3. Caveats

- Playwright browser E2E verification capturing actual visual screenshots of the bomber flyover and apocalyptic shockwave is scheduled for Milestone M4 (`M4_E2E_VERIFY`). Canvas rendering in M3 was verified via mock 2D contexts, mathematical transformation checks, and unit test suites.
- Audio synthesis in Web Audio API requires user gesture activation in modern browsers; in headless Node.js tests, audio calls safely no-op.

---

## 4. Conclusion

Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX) is **APPROVED**.
- Baseline 164 sprite key invariant: **PASS (164/164)**
- Non-breaking cinematic rendering: **PASS**
- Headless Web Audio API safety: **PASS**
- Key mapping and jump mechanics preservation: **PASS**
- TypeScript build & unit tests: **PASS (Exit 0)**
- Integrity violations: **NONE DETECTED**

---

## 5. Verification Method

To independently verify all findings:
```bash
# 1. Verify strict 164 sprite key invariant
npx tsx -e "import { ProceduralSpriteFactory } from './src/render/sprites/ProceduralSpriteFactory'; console.log('Sprite Keys:', ProceduralSpriteFactory.getInstance().getAllKeys().length);"

# 2. Run targeted adversarial suites
npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts tests/unit/adversarial_controls_jump.test.ts

# 3. Run M3 ultimate move system unit suite
npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts

# 4. Production TypeScript build
npm run build
```

Invalidation conditions:
- `getAllKeys()` returning anything other than 164.
- `KeyX` triggering ultimate move or failing jump kinematics.
- Any crash in `SoundEngine` under headless execution.
- Build failure under `npm run build`.
