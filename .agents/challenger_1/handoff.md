# Adversarial Challenge Handoff Report — Milestone M5 (Controls, Keyboard Latches & Jump Kinematics)

**Agent**: `challenger_1` (Empirical Challenger: Controls, Input Latches & Jump Kinematics)  
**Date**: 2026-09-03  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_1`  
**Authoritative Suite**: `tests/unit/adversarial_controls_jump.test.ts` (21 Tests)  
**Overall Verdict**: **`APPROVE`**

---

## 1. Observation

### 1.1 Source Code Architecture Inspected

Direct empirical inspection of the production codebase was performed across the following files:

1. **`src/input/KeyboardController.ts`**:
   - **Key Mappings**:
     - Line 78: `Space: 'jump', KeyK: 'jump', KeyX: 'jump'`
     - Line 83: `KeyJ: 'fire', KeyZ: 'fire'`
     - Line 87: `KeyL: 'grenade', KeyC: 'grenade'`
     - Line 280: `case ' ': case 'k': case 'x': return 'jump';`
   - **Edge-Detection Latching**:
     - Lines 43–45:
       ```typescript
       public jumpJustPressed: boolean = false;
       public fireJustPressed: boolean = false;
       public grenadeJustPressed: boolean = false;
       ```
     - Lines 160–167:
       ```typescript
       const jumpPressed = this.jumpJustPressed || (this.jump && !this.prevJump);
       const shootPressed = this.fireJustPressed || (this.fire && !this.prevFire);
       const grenadePressed = this.grenadeJustPressed || (this.grenade && !this.prevGrenade);

       this.jumpJustPressed = false;
       this.fireJustPressed = false;
       this.grenadeJustPressed = false;
       ```
   - **OS Auto-Repeat Suppression**:
     - Lines 242–246:
       ```typescript
       if (!e.repeat) {
         if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
         if (action === 'fire' && !this.fire) this.fireJustPressed = true;
         if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;
       }
       ```

2. **`src/core/player/PlayerKinematics.ts`**:
   - Lines 54–57:
     ```typescript
     static readonly RUN_SPEED: number = 132.0; // px/s
     static readonly JUMP_IMPULSE: number = -360.0; // px/s (upward)
     static readonly GRAVITY: number = 800.0; // px/s^2 (downward)
     static readonly JUMP_CUT_RATIO: number = 0.5; // early jump release cut
     static readonly TERMINAL_FALL_VELOCITY: number = 500.0; // px/s
     ```
   - Lines 62–67:
     ```typescript
     static readonly APEX_FLOAT_VELOCITY_THRESHOLD: number = 40.0; // px/s (|vy| < 40)
     static readonly APEX_GRAVITY_SCALE: number = 0.65; // arcade hangtime
     static readonly COYOTE_FRAMES: number = 4; // ~66.7ms @ 60Hz
     static readonly JUMP_BUFFER_FRAMES: number = 4; // ~66.7ms @ 60Hz
     ```
   - Lines 128–215: `calculateAim(inputUp, inputDown, inputForward, facing, isGrounded)`:
     - Grounded + Down: crouched forward horizontal shooting (`AimAngle.FORWARD`, vector `(facing, 0)`).
     - Airborne + Down: strictly downward vertical shooting (`AimAngle.DOWN`, vector `(0, 1)`).
     - Airborne + Down + Forward: diagonal downward shooting (`AimAngle.DOWN_FORWARD`, vector `(facing * 0.7071, 0.7071)`).
     - Grounded/Airborne + Up: upward vertical shooting (`AimAngle.UP`, vector `(0, -1)`).
     - Grounded/Airborne + Up + Forward: diagonal upward shooting (`AimAngle.UP_FORWARD`, vector `(facing * 0.7071, -0.7071)`).

3. **`src/core/player/PlayerController.ts`**:
   - Lines 104–113:
     ```typescript
     public performJump(engine: GameEngine): void {
       this.velocity.y = PlayerKinematics.JUMP_IMPULSE; // -360 px/s
       this.isGrounded = false;
       this.coyoteTimer = 0;
       this.jumpBufferTimer = 0;
       this.jumpCutApplied = false;
       this.posture = PlayerPosture.AIRBORNE;
       this.actionState = PlayerActionState.JUMPING;
       engine.eventBus.emit('play_sound', { sound: 'sfx_player_jump' });
     }
     ```
   - Lines 147–149: Jump input buffering on press: `this.jumpBufferTimer = PlayerKinematics.JUMP_BUFFER_FRAMES * timestep;`.
   - Lines 191–194: Drop-through trigger: `if (this.isGrounded && input.down && input.jumpPressed) { this.initiateDropThrough(); return; }`.
   - Lines 200–203: Jump execution condition: `wantsJump = (input.jumpPressed || this.jumpBufferTimer > 0) && !input.down; canJump = (this.isGrounded || this.coyoteTimer > 0) && !this.isDroppingThrough;`.
   - Lines 206–209: Single-shot jump apex cut: `if (!this.isGrounded && this.velocity.y < 0 && !input.jumpHeld && !input.jumpPressed && !this.jumpCutApplied)`.
   - Lines 527–529: Immediate landing bounce execution via buffered jump: `if (this.jumpBufferTimer > 0 && !this.isDroppingThrough) { this.performJump(engine); }`.

4. **`src/core/physics/Platform.ts`**:
   - Lines 103–160: `PlatformPhysics.resolveGroundContact()`:
     - Solid platforms (`type: 'SOLID'`) resolve top-surface contact when `vy >= 0` and `prevFootY <= platTop + 4.0 && currFootY >= platTop`.
     - Drop-through ignores platform only if `plat.type === 'SEMI_SOLID' && plat.id === ignoredPlatformId`. Solid platforms cannot be dropped through.

---

### 1.2 Adversarial Test Suite Execution Metrics

An independent adversarial stress suite of 21 tests was written and executed at `tests/unit/adversarial_controls_jump.test.ts`.

```
 RUN  v3.2.7 /Users/user/src/fullmetalslug

 ✓ tests/unit/adversarial_controls_jump.test.ts (21 tests) 327ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  714ms
```

Detailed test metrics across the 4 assigned challenge areas:

#### Area 1: Edge Cases in Input Latching (Tests 1.1 – 1.7)
- **Sub-frame Keydown/Keyup**:
  - `Space`, `KeyK`, `KeyX`: Keydown dispatched and Keyup dispatched before `getSnapshot()`. Snapshot 1 returned `jumpPressed: true`, `jumpHeld: false`. Snapshot 2 returned `jumpPressed: false`, `jumpHeld: false`. (100% verified across all 3 jump keys).
  - `KeyJ`, `KeyZ`: Snapshot 1 returned `shootPressed: true`, `shootHeld: false`. Snapshot 2 returned `shootPressed: false`.
  - `KeyL`, `KeyC`: Snapshot 1 returned `grenadePressed: true`. Snapshot 2 returned `grenadePressed: false`.
- **Multi-press Storm (Jitter / Churn)**:
  - Sequence `keydown -> keyup -> keydown -> keyup` in 0ms was captured cleanly as single `jumpPressed: true`, `jumpHeld: false`.
- **Simultaneous Triple-Tap**:
  - `Space` + `KeyJ` + `KeyL` all tapped in a single frame tick: snapshot simultaneously captured `jumpPressed: true`, `shootPressed: true`, and `grenadePressed: true`.
- **OS Auto-Repeat Suppression**:
  - Initial press (`e.repeat = false`) set `jumpPressed: true`, `jumpHeld: true`.
  - Subsequent OS repeat (`e.repeat = true`) maintained `jumpHeld: true`, but strictly suppressed re-triggering `jumpPressed: false`.
- **Controller Reset**:
  - `reset()` completely cleared held states and latched flags.

#### Area 2: Jump Kinematics & Parabolic Arc Verification (Tests 2.1 – 2.4)
- **Monotonic Ascent**:
  - Starting position: $X = 80.00\text{px}, Y = 230.00\text{px}$, $v_{y0} = -360.00\text{ px/s}$.
  - Tick 1: $v_{y1} = -346.67\text{ px/s}, Y_1 = 224.22\text{px}$, $\Delta Y = -5.78\text{px}$.
  - Every single frame from Frame 1 through Frame 28 satisfied $Y_{t+1} < Y_t$ strictly (zero non-decreasing frames).
  - Minimum vertical coordinate (Apex): $Y_{\text{min}} = 151.7556\text{px}$ reached at Frame 28. Peak displacement $\Delta Y = -78.24\text{px}$.
- **Monotonic Descent & Landing**:
  - Descent from Frame 29 through Frame 55 satisfied $Y_{t+1} > Y_t$ strictly.
  - Landing at Frame 56: $Y = 230.000\text{px}$ exactly, $v_y = 0.000\text{ px/s}$, `isGrounded = true`, `actionState = IDLE`.
  - Frame 57: `posture` transitioned to `PlayerPosture.STANDING`.
- **Variable Jump Apex Cut (Short Hop)**:
  - Full Jump: apex $Y = 151.76\text{px}$ ($\Delta Y = -78.24\text{px}$), airtime 56 frames (~0.933s).
  - Short Hop (key released after 2 frames): apex $Y = 202.31\text{px}$ ($\Delta Y = -27.69\text{px}$), airtime 33 frames (~0.550s).
  - Proves apex cut dampens upward velocity by 50% ($v_y \leftarrow v_y \times 0.5$).
- **2D Parabolic Trajectory**:
  - Leftward jump: $X$ decreased monotonically at $132\text{ px/s}$, landing on `ground_main` at $Y = 230$.
  - Rightward jump: $X$ increased monotonically at $132\text{ px/s}$, cleanly landing on elevated dock platform `dock_1` (bounds $[140, 260]$) at $Y = 175$ with `isGrounded = true`.

#### Area 3: Rapid Repeated Jump Key Presses & Bouncing On Ground Contact (Tests 3.1 – 3.3)
- **Jump Buffering Window**:
  - Jump pressed in mid-air at Frame 29 (2 frames prior to ground contact). `jumpBufferTimer = 0.05s` (3 frames).
  - Frame 31 (Touchdown): player touched ground at $Y = 230$; buffered jump immediately triggered with $v_y = -360.0\text{ px/s}$ and `isGrounded = false`. Zero idle grounded ticks.
  - Frame 32: ascending immediately at $Y = 227.22\text{px}$.
- **600-Frame Pathological Jump Mashing (10 Seconds Continuous)**:
  - Dispatched `keydown` and `keyup` on every single tick for 600 consecutive ticks.
  - Total jump impulses executed: exactly 11 (matching natural jump frequency $600 / 56 \approx 10.7$).
  - Physical Invariants:
    - Zero underground clipping ($Y \le 230.001$ throughout).
    - Zero NaNs, zero Infinities across all position and velocity coordinates.
    - Zero mid-air double-jump exploits (airborne jumps correctly rejected once coyote time elapsed).
- **Jump Key Continuously Held**:
  - Holding Spacebar across frames landed the player cleanly at Frame 56 and remained safely grounded at $Y = 230, v_y = 0$ for all subsequent 30 frames without spurious auto-bouncing.

#### Area 4: Simultaneous Multimodal Combat Actions (Tests 4.1 – 4.7)
- **Simultaneous Jump + Fire**:
  - Frame 1: player jumped ($v_y = -346.67\text{ px/s}, Y = 224.22\text{px}$) AND spawned a projectile with horizontal velocity $(660, 0)$.
- **Simultaneous Jump + Grenade**:
  - Frame 1: player jumped AND spawned a grenade with arcing velocity $(240, -299)$, decrementing grenade inventory from 10 to 9.
- **Simultaneous Jump + Aim UP + Shoot**:
  - Frame 1: player jumped, `aimAngle = AimAngle.UP`, `aimDirection = (0, -1)`, bullet spawned with vertical velocity $(0, -660)$ straight upward.
- **Simultaneous Jump + Aim UP-FORWARD Diagonal + Shoot**:
  - Frame 1: player jumped, `aimAngle = AimAngle.UP_FORWARD`, `aimDirection = (0.7071, -0.7071)`, bullet spawned with diagonal velocity $(466.69, -466.69)$.
- **Mid-Air Downward Aiming & Shooting**:
  - In mid-air, Down + Fire triggered `aimAngle = AimAngle.DOWN`, `aimDirection = (0, 1)`, bullet spawned with downward velocity $(0, 660)$.
- **Mid-Air Downward Grenade Throw**:
  - In mid-air, Down + Grenade threw grenade downward toward ground with velocity $(120, 253)$.
- **Drop-Through Invariants**:
  - On solid ground (`ground_main`, $Y = 230$): pressing Down + Jump was safely clamped by `PlatformPhysics.resolveGroundContact()`, maintaining $Y = 230$ and preventing abyss falling.
  - On semi-solid platform (`dock_1`, $Y = 175$): pressing Down + Jump initiated drop-through, ignoring `dock_1` and cleanly landing on solid ground at $Y = 230$.

---

### 1.3 Full Project Verification Outputs

1. **Production Build & Typecheck (`npm run build`)**:
   ```
   > fullmetalslug@1.0.0 build
   > tsc -b && vite build

   vite v6.4.3 building for production...
   transforming...
   ✓ 31 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                  1.26 kB │ gzip:  0.58 kB
   dist/assets/index-Cy7S9ANT.js  174.28 kB │ gzip: 45.45 kB │ map: 640.54 kB
   ✓ built in 228ms
   ```
   *Exit code: 0.*

2. **Complete Vitest Unit Suite (`npm test`)**:
   ```
   Test Files  20 passed (20)
        Tests  257 passed (257)
     Duration  1.39s
   ```
   *Exit code: 0 (All 20 test files, 257 tests green).*

3. **Playwright E2E Browser Suite (`npx playwright test`)**:
   ```
   Running 14 tests using 3 workers

     ✓  1 [chromium] › tests/e2e/game_initialization.spec.ts:4:3 › should boot headless browser...
     ✓  2 [chromium] › tests/e2e/visual_verification.spec.ts:45:3 › Scene 1: player standing with visible aiming crosshair...
     ✓  3 [chromium] › tests/e2e/visual_verification.spec.ts:79:3 › Scene 2: player aiming diagonally upward...
     ✓  4 [chromium] › tests/e2e/visual_verification.spec.ts:113:3 › Scene 3: natural jump arc trajectory frame...
     ✓  5 [chromium] › tests/e2e/visual_verification.spec.ts:151:3 › Scene 4: rebel soldier walking in from off-screen margin...
     ✓  6 [chromium] › tests/e2e/gameplay_controls.spec.ts:17:3 › Jump Test (Spacebar): genuine Space keypress causes player upward movement (delta Y < 0) and landing
     ✓  7 [chromium] › tests/e2e/visual_verification.spec.ts:200:3 › Scene 5: combat scene with upgraded high-res sprites...
     ✓  8 [chromium] › tests/e2e/visual_verification.spec.ts:251:3 › Verification: all 5 screenshot artifacts exist...
     ✓  9 [chromium] › tests/e2e/gameplay_controls.spec.ts:85:3 › Jump Test (KeyK): authentic secondary jump key...
     ✓ 10 [chromium] › tests/e2e/gameplay_controls.spec.ts:114:3 › Movement Test (Arrow Keys): ArrowRight and ArrowLeft cause genuine horizontal X displacement
     ✓ 11 [chromium] › tests/e2e/gameplay_controls.spec.ts:138:3 › Movement Test (WASD Keys): KeyD and KeyA cause genuine horizontal X displacement
     ✓ 12 [chromium] › tests/e2e/gameplay_controls.spec.ts:160:3 › Combined Air Mobility: moving right while jumping produces 2D parabolic displacement
     ✓ 13 [chromium] › tests/e2e/game_initialization.spec.ts:57:3 › should maintain 60 FPS animation loop stably over 300 frames...
     ✓ 14 [chromium] › tests/e2e/game_initialization.spec.ts:137:3 › should expose __GAME__, __ENGINE__, __AUDIO_CTX__...

     14 passed (5.5s)
   ```
   *Exit code: 0.*

---

## 2. Logic Chain

1. **Edge-Latching Integrity**:
   - In standard browser execution, rapid physical key taps or automated synthetic events can dispatch `keydown` and `keyup` between `requestAnimationFrame` render ticks.
   - By latching `jumpJustPressed = true`, `fireJustPressed = true`, and `grenadeJustPressed = true` on unrepeated `keydown` events (and preserving them across `handleKeyUp`), the controller guarantees that sub-frame taps are preserved until consumed by `getSnapshot()`.
   - The latch is cleared immediately upon `getSnapshot()` consumption, guaranteeing that a single physical tap produces exactly one `pressed: true` frame edge without ghost held states.

2. **Kinematic Monotonicity & Parabolic Physics**:
   - On jump initiation, vertical velocity is set to $v_y = -360\text{ px/s}$.
   - Over consecutive frames, gravity $g = 800\text{ px/s}^2$ integrates $v_y \leftarrow v_y + g \cdot dt$, gradually reducing upward speed.
   - Because $v_y < 0$ throughout the entire ascent, position integration $Y \leftarrow Y + v_y \cdot dt$ strictly decreases $Y$ monotonically until the apex is reached at Frame 28.
   - At the apex ($|v_y| < 40\text{ px/s}$), arcade float dampening ($g_{\text{eff}} = 0.65 \times 800 = 520\text{ px/s}^2$) provides subtle hangtime before downward acceleration takes over.
   - During descent ($v_y > 0$), $Y$ strictly increases monotonically.
   - At Frame 56, downward velocity crosses the solid ground plane at $Y = 230$, where `PlatformPhysics.resolveGroundContact()` detects the top surface crossing within the $4.0\text{px}$ tolerance window, cleanly snapping player position to $Y = 230.000$, setting $v_y = 0$, and returning `isGrounded = true`.

3. **Jump Buffering & Rapid Mashing Stability**:
   - When jump is pressed while falling within 4 frames of touchdown, `jumpBufferTimer` retains the jump intent.
   - Upon ground contact resolution in `PlayerController.update()`, `jumpBufferTimer > 0` immediately triggers `performJump()`, setting $v_y = -360\text{ px/s}$ on the exact frame of landing. This produces arcade-authentic responsive bouncing with 0 idle grounded ticks.
   - When subjected to 600 continuous frames of mashing, the finite state machine safely gates mid-air jumps (rejecting impulses while airborne after coyote time expires) and executes exactly 11 valid parabolic jumps. Position coordinates remain bounded and strictly above ground, confirming zero position drift, zero tunnel clipping, and zero NaN/Inf instability.

4. **Multimodal Action Decoupling**:
   - Input snapshot processing separates directional aiming, jump impulses, primary fire decisions, and secondary grenade launches into orthogonal execution blocks within `PlayerController.handleInput()`.
   - Simultaneous inputs (e.g. `Space` + `KeyJ`, `Space` + `KeyL`, `Space` + `KeyW` + `KeyJ`) execute without mutual exclusion or event dropping:
     - Player initiates jump ascent ($\Delta Y < 0$).
     - Weapon manager consumes ammo/grenades and spawns projectiles at the appropriate directional muzzle offset.
     - Downward shooting and grenade throwing are properly gated: grounded down-inputs crouch, while airborne down-inputs activate authentic vertical downward attacks.

---

## 3. Caveats

1. **Ground Landing Posture Transition Timing**:
   - On the exact frame of landing (Frame 56), `actionState` immediately switches to `IDLE` (or `RUNNING`), `position.y` snaps to $230$, and `isGrounded` becomes `true`.
   - However, `posture` remains `AIRBORNE` until the start of the next frame's `handleInput()`, where it transitions to `STANDING`. This 1-frame latency in `posture` has zero mechanical impact on physics or collision resolution, but tests inspecting `player.posture` on landing must check Frame 57.
2. **Horizontal Jump Landing on Stage Platforms**:
   - Stage 1 contains an elevated pier platform (`dock_1`, bounds $X \in [140, 260], Y = 175$). A player running right from starting position ($X = 80$) while jumping will travel $123.2\text{px}$ horizontally, landing at $X = 203.2\text{px}$, which contacts `dock_1` at $Y = 175$ instead of ground terrain at $Y = 230$. This is intentional level geometry. Leftward or stationary jumps land at $Y = 230$.

---

## 4. Conclusion

**Final Verdict**: **`APPROVE`**

The implementation of Controls, Input Latches, and Jump Kinematics across `src/input/KeyboardController.ts`, `src/core/player/PlayerKinematics.ts`, and `src/core/player/PlayerController.ts` is robust, mathematically sound, and fully verified under rigorous empirical stress-testing:
- Spacebar, KeyK, and KeyX reliably execute jumps without dropped frames.
- Edge-detection latching reliably captures rapid sub-frame keydown/keyup sequences.
- Rapid repeated jump mashing and jump buffering execute responsive ground-contact bounces with zero clipping or drift.
- Simultaneous multimodal inputs (jump+fire, jump+grenade, jump+aim up/down/diagonal) operate seamlessly.
- Parabolic jump kinematics strictly decrease vertical position $Y$ on ascent ($\Delta Y = -78.24\text{px}$ at apex) and cleanly land back on solid ground ($Y = 230.00\text{px}$, $v_y = 0$).
- All test suites are 100% green (257 Vitest unit tests, 14 Playwright E2E browser tests, zero build errors).

---

## 5. Verification Method

To independently reproduce and verify this challenge report:

1. **Run Challenger 1 Adversarial Suite (21 Tests)**:
   ```bash
   npx vitest run tests/unit/adversarial_controls_jump.test.ts
   ```
   *Expected output*: 21 passed (21).

2. **Run Full Unit Test Suite (257 Tests across 20 Files)**:
   ```bash
   npm test
   ```
   *Expected output*: 20 test files passed, 257 tests passed (0 failures).

3. **Run TypeScript Compilation and Production Build**:
   ```bash
   npm run build
   ```
   *Expected output*: Clean compilation (`tsc -b && vite build`), exit code 0.

4. **Run Playwright E2E Headless Browser Suite (14 Tests)**:
   ```bash
   npx playwright test
   ```
   *Expected output*: 14 passed (3 test files, 0 failures).

5. **Invalidation Conditions**:
   - Any test failure in `tests/unit/adversarial_controls_jump.test.ts`.
   - Failure of `player.position.y` to strictly decrease on Spacebar jump.
   - Failure of player to land at $Y = 230.00\text{px}$ on solid ground.
   - Any dropped rapid tap in sub-frame keydown/keyup testing.
   - Any non-zero exit code from `npm run build`, `npm test`, or `npx playwright test`.
