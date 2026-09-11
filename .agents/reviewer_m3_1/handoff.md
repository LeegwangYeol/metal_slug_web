# Milestone 3 Review & Adversarial Critic Report: Automated Playwright E2E Suite & Visual Proof

- **Agent**: Reviewer 1 (Agent 21), Milestone 3
- **Roles**: reviewer, critic
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Date**: 2026-09-11
- **Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Playwright E2E Test Suite Execution
- Executed `npx playwright test tests/e2e/hitbox_dodge.spec.ts tests/e2e/camera_view.spec.ts`
- **Verbatim Output**:
  ```
  Running 8 tests using 1 worker

    ✓  1 [chromium] › tests/e2e/camera_view.spec.ts:76:3 › Milestone 3: Camera View Overhaul & Visual Proof Capture Suite › Camera Tracking: verifies centered player tracking, velocity lookahead <= 40px, and smooth arena clamping (211ms)
    ✓  2 [chromium] › tests/e2e/camera_view.spec.ts:155:3 › Milestone 3: Camera View Overhaul & Visual Proof Capture Suite › Visual Proof 1: captures improved_camera_angle.png (>50KB, centered omnidirectional viewpoint, 360 horde, occult VFX, Gothic HUD) (336ms)
    ✓  3 [chromium] › tests/e2e/camera_view.spec.ts:244:3 › Milestone 3: Camera View Overhaul & Visual Proof Capture Suite › Visual Proof 2: captures hitbox_precision_dodge.png (>50KB, grazing near-miss with 0 damage, tight hurtbox, active combat) (313ms)
    ✓  4 [chromium] › tests/e2e/camera_view.spec.ts:351:3 › Milestone 3: Camera View Overhaul & Visual Proof Capture Suite › Visual Proof Audit: asserts both artifacts exist on disk, are valid 960x540 PNGs, and exceed 50,000 bytes (1ms)
    ✓  5 [chromium] › tests/e2e/hitbox_dodge.spec.ts:70:3 › Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite › Test 1: Live dynamic dodging weaves between enemies at near-miss distances with zero phantom damage (3.2s)
    ✓  6 [chromium] › tests/e2e/hitbox_dodge.spec.ts:230:3 › Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite › Test 2: Deterministic near-miss grazing (12-20px gap) deals strict ZERO damage across all archetypes (220ms)
    ✓  7 [chromium] › tests/e2e/hitbox_dodge.spec.ts:331:3 › Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite › Test 3: Physical circle-circle overlap cleanly inflicts contact damage and triggers blood VFX (211ms)
    ✓  8 [chromium] › tests/e2e/hitbox_dodge.spec.ts:404:3 › Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite › Test 4: Visual Proof — captures hitbox_precision_dodge.png (>50KB, close-quarters near-miss graze without damage) (315ms)

    8 passed (8.6s)
  ```
  Result: 8 tests passed cleanly in 8.6 seconds with zero failures.

### 1.2 Full Unit Test Suite & Typecheck Execution
- `npx tsc --noEmit`: Exited with code 0 (zero TypeScript errors).
- `npm run build`: Exited with code 0 (`dist/index.html` 1.37 kB, `dist/assets/index-BsOJa5ji.js` 179.71 kB).
- `npm test`: Exited with code 0 (33 test files passed, 488 tests passed).

### 1.3 Hitbox Dodge E2E Implementation (`tests/e2e/hitbox_dodge.spec.ts`)
- **Test 1 (Dynamic Slalom Weaving, lines 70–225)**:
  - Dispatches player at `(0, -220)` with downward keyboard drive `page.keyboard.down('KeyS')` and closed-loop lateral weaving (`KeyA` / `KeyD`).
  - Navigates through 6 staggered enemy gates spanning $y = -150$ to $y = 200$.
  - Continuous assertion checks: `state.health === 100`, `state.invulnerabilityTimer === 0`, `state.isAlive === true`.
  - Boundary traversal confirmed: `finalReport.py > 200` (>420px vertical descent).
  - Minimum clearance observed: `minSeparationObserved >= 12.0` and `<= 20.0`, confirming strict near-miss grazing with zero damage.
- **Test 2 (Deterministic Grazing Across All Archetypes, lines 230–326)**:
  - Iterates through `skeleton` ($r=11$), `ghoul` ($r=13$), `banshee` ($r=12$), `death_knight` ($r=18$), and `necromancer` ($r=14$).
  - Evaluates both $+15\text{px}$ air gap (legacy phantom damage trigger band) and $+1.0\text{px}$ razor-edge air gap over 20 simulation frames at 60Hz.
  - Verifies `currentHealth === 100`, `invulnerabilityTimer === 0`, and `vfx.getActiveCount() === 0`.
- **Test 3 (Physical Circle Collision Damage & Blood VFX, lines 331–399)**:
  - Positions skeleton at $\text{touchDist} - 2.0\text{px} = 20.0\text{px}$ (2px physical circle penetration).
  - Steps 1 simulation frame at 60Hz.
  - Verifies damage deducted: `initialHp = 100`, `postHp = 90` ($100 - \text{skeletonDamage}$).
  - Verifies invulnerability window: `postInvuln > 0.45` and `<= 0.5`.
  - Verifies blood burst VFX: `postVfx > 0`.
- **Test 4 (Visual Proof Screenshot Capture, lines 404–485)**:
  - Captures `artifacts/dark_fantasy/hitbox_precision_dodge.png`.

### 1.4 Camera View E2E Implementation (`tests/e2e/camera_view.spec.ts`)
- **Test 1 (Centered Tracking & Clamping, lines 76–150)**:
  - Verifies stationary player at origin maps to screen center: `stationaryScreenX ≈ 480`, `stationaryScreenY ≈ 270`.
  - Verifies high-speed movement velocity lookahead: `lookaheadRight > 0` and `<= 40.0` (`lookaheadMax`).
  - Verifies arena edge clamping: `maxCameraX <= boundsMaxX - viewportWidth`, `maxCameraY <= boundsMaxY - viewportHeight`.
- **Test 2 (Visual Proof 1, lines 155–239)**:
  - Captures `artifacts/dark_fantasy/improved_camera_angle.png` with 360-degree horde wave, occult weaponry, soul gems, torchlight carving, and Gothic HUD.
- **Test 3 (Visual Proof 2, lines 244–346)**:
  - Captures `artifacts/dark_fantasy/hitbox_precision_dodge.png` with near-miss grazing enemies (14px air gap), scythe sweep, blood burst VFX, and full health bar.
- **Test 4 (Visual Proof Invariant Audit, lines 351–385)**:
  - Validates file existence on disk, PNG magic header (`89 50 4E 47 0D 0A 1A 0A`), dimensions $960 \times 540$, and size $> 50,000$ bytes.

### 1.5 Disk Artifact Verification
- Commands executed:
  ```bash
  ls -lh artifacts/dark_fantasy/improved_camera_angle.png artifacts/dark_fantasy/hitbox_precision_dodge.png
  file artifacts/dark_fantasy/improved_camera_angle.png artifacts/dark_fantasy/hitbox_precision_dodge.png
  ```
- Observed:
  - `hitbox_precision_dodge.png`: 224,896 bytes (220 KB), PNG 960x540, 8-bit/color RGB.
  - `improved_camera_angle.png`: 239,011 bytes (233 KB), PNG 960x540, 8-bit/color RGB.
  - Both files exceed 50KB / 50,000 bytes by more than $4.4\times$.
  - Both visual images inspected via `view_file` confirm authentic, high-quality rendering matching dark fantasy horde survival aesthetics.

---

## 2. Logic Chain

1. **Integrity and Anti-Cheating Assessment**:
   - Inspected `src/main.ts:465-487` for contact damage checking logic. Broadphase uses `getEnemiesInRadius(..., Player.COLLISION_RADIUS + 32, ...)` and narrowphase strictly evaluates `distSq <= contactDist * contactDist + 1e-3` where `contactDist = Player.COLLISION_RADIUS + enemy.radius`.
   - Grep search for `playwright` or `NODE_ENV` in `src/` yielded zero hits. There are no test bypasses, no hardcoded responses, and no mock facades.
   - Global exposure in `src/main.ts:613-622` exposes `window.game = game`, allowing standard E2E inspection without modifying core gameplay logic during test execution.
2. **Near-Miss Dodge Verification**:
   - The legacy bug was caused by an arbitrary `+ 15` padding in `src/main.ts:468`.
   - In `hitbox_dodge.spec.ts`, Test 1 physically maneuvers the player between approaching enemy gates with real keyboard events (`KeyS`, `KeyA`, `KeyD`), traveling over 420px through the course while holding clearance in the $[12.0, 20.0]\text{px}$ band. Player health remains at 100 throughout.
   - Test 2 mathematically confirms that across all 5 enemy archetypes, 15px separation (the exact distance where the bug used to trigger) and 1px separation inflict 0 damage and produce 0 blood particles over 20 frames.
   - Therefore, the claim that near-miss grazing deals zero damage is genuinely verified.
3. **Physical Collision & Blood VFX Verification**:
   - In Test 3, placing an enemy 2px into circle intersection immediately deals 10 damage ($100 \to 90$), sets the invulnerability timer to 0.5s, and triggers `DarkFantasyVFX.emitBloodBurst` and `emitBloodSplatter`, generating active particles in the particle pool.
   - Therefore, physical contact damage and blood burst VFX are genuinely verified.
4. **Camera Tracking & Visual Proof Verification**:
   - In `camera_view.spec.ts`, Test 1 confirms centered player coordinates at `(480, 270)` on a $960 \times 540$ canvas, confirms lookahead is bounded to $\le 40.0\text{px}$, and confirms viewport bounds clamping.
   - Tests 2, 3, and 4 verify that `improved_camera_angle.png` and `hitbox_precision_dodge.png` exist, are valid $960 \times 540$ PNGs, and exceed 50KB.
   - Visual inspection of both images confirms centered, comfortable top-down framing with 360-degree visibility, occult VFX, and clear HUD.
5. **Conclusion Support**:
   - All criteria set forth in `ORIGINAL_REQUEST.md`, `COLLABORATION.md`, and `SCOPE.md` are completely satisfied with zero regressions.

---

## 3. Caveats

- In Test 2 and Test 3 of `hitbox_dodge.spec.ts`, the player's weapon manager is cleared before the geometric contact check. This is standard testing practice in combat games to isolate hitbox collision from auto-cleaving weapons (e.g. Arcane Scythe), ensuring test enemies survive to test collision mechanics.
- No other caveats.

---

## 4. Conclusion

- **Verdict**: **APPROVE**
- Milestone 3 implementation is robust, complete, and thoroughly tested.
- Playwright E2E tests genuinely verify near-miss dodge (0 damage at 12–20px), physical contact damage with blood burst VFX, centered camera tracking, and screenshot generation.
- Zero integrity violations detected.
- All 8 Playwright E2E tests and all 488 unit tests pass 100% green.
- Artifacts `improved_camera_angle.png` (233 KB) and `hitbox_precision_dodge.png` (220 KB) exist on disk and exceed the 50KB requirement.

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Run Playwright E2E Tests**:
   ```bash
   npx playwright test tests/e2e/hitbox_dodge.spec.ts tests/e2e/camera_view.spec.ts
   ```
   *Expected output*: 8 passed in ~8s.

2. **Verify Screenshot Artifacts on Disk**:
   ```bash
   ls -lh artifacts/dark_fantasy/improved_camera_angle.png artifacts/dark_fantasy/hitbox_precision_dodge.png
   file artifacts/dark_fantasy/improved_camera_angle.png artifacts/dark_fantasy/hitbox_precision_dodge.png
   ```
   *Expected output*: Both exist, PNG 960x540, sizes > 219KB (> 50KB).

3. **Run TypeScript Check & Production Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   *Expected output*: Exit code 0, 0 errors.

4. **Run Complete Unit Suite**:
   ```bash
   npm test
   ```
   *Expected output*: 33 test files passed, 488 tests passed.
