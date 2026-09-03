# Handoff Report: R1 Newtonian Physics & Arcade Kinematics Overhaul

**Agent**: `worker_m1`  
**Milestone**: R1 Overhaul (Physics & Newtonian Kinematics)  
**Date**: 2026-09-03  
**Working Directory**: `/Users/user/src/fullmetalslug/.agents/worker_m1/`  
**Target Repository Root**: `/Users/user/src/fullmetalslug/`  
**Exclusive File Ownership**:
- `src/core/player/PlayerKinematics.ts`
- `src/core/player/PlayerController.ts`
- `tests/unit/player_kinematics_aiming.test.ts`

---

## 1. Observation

### 1.1 Source Code Changes
1. `src/core/player/PlayerKinematics.ts`:
   - Updated movement and physics constants:
     - `RUN_SPEED = 132.0;` (px/s)
     - `CRAWL_SPEED = 54.0;` (px/s)
     - `JUMP_IMPULSE = -360.0;` (px/s upward)
     - `GRAVITY = 800.0;` (px/s^2 downward)
     - `JUMP_CUT_RATIO = 0.5;` (early jump release cut factor)
     - `TERMINAL_FALL_VELOCITY = 500.0;` (px/s maximum fall speed)
     - `DROP_THROUGH_IMPULSE = 120.0;` (px/s downward drop-through)
     - `DROP_THROUGH_FRAMES = 18;` (duration of platform exclusion)
   - Added apex and input buffer constants:
     - `APEX_FLOAT_VELOCITY_THRESHOLD = 40.0;` (px/s, $|v_y| < 40$)
     - `APEX_GRAVITY_SCALE = 0.65;` ($0.65 \times \text{GRAVITY}$ for arcade hangtime)
     - `COYOTE_FRAMES = 4;` (4 frames, ~66.7ms @ 60Hz)
     - `JUMP_BUFFER_FRAMES = 4;` (4 frames, ~66.7ms @ 60Hz)

2. `src/core/player/PlayerController.ts`:
   - Added persistent state properties:
     - `public coyoteTimer: number = 0;`
     - `public jumpBufferTimer: number = 0;`
     - `public jumpCutApplied: boolean = false;`
   - Added `performJump(engine: GameEngine): void` helper method that executes the jump impulse (`velocity.y = -360`), resets `coyoteTimer = 0`, `jumpBufferTimer = 0`, `jumpCutApplied = false`, sets `posture = AIRBORNE`, `actionState = JUMPING`, and emits `'sfx_player_jump'`.
   - Implemented 4-frame Coyote Time:
     - While `isGrounded` is true, `coyoteTimer` refreshes to `4 * dt`.
     - When stepping off a ledge without jumping, `coyoteTimer` counts down per tick, permitting jumps while `coyoteTimer > 0`.
   - Implemented 4-frame Jump Input Buffering:
     - On `input.jumpPressed && !input.down`, buffers jump for `4 * dt`.
     - In `update()`, upon landing on a platform (`contact.isGrounded`), if `jumpBufferTimer > 0 && !isDroppingThrough`, triggers `performJump` immediately on touchdown.
   - Implemented Single-Shot Jump Cut:
     - Evaluated strictly once upon releasing the jump key:
       `if (!this.isGrounded && this.velocity.y < 0 && !input.jumpHeld && !input.jumpPressed && !this.jumpCutApplied)`
       Applies `applyJumpCut(velocity.y)` (cuts velocity by 0.5) and sets `jumpCutApplied = true`.
     - Subsequent frames while still ascending do not re-apply the cut.
   - Implemented Apex Float Dampening:
     - In `update()`, when `!this.isGrounded`:
       `const isApex = Math.abs(this.velocity.y) < PlayerKinematics.APEX_FLOAT_VELOCITY_THRESHOLD;`
       `const effectiveGravity = isApex ? PlayerKinematics.GRAVITY * PlayerKinematics.APEX_GRAVITY_SCALE : PlayerKinematics.GRAVITY;`
       Applies $520\text{ px/s}^2$ ($0.65 \times 800$) within $[-40, +40]\text{ px/s}$ window, otherwise $800\text{ px/s}^2$.
   - Implemented Clean Platform Landing Snapping:
     - When `contact.isGrounded` is true:
       `this.position.y = contact.groundY;`
       `this.velocity.y = 0;`
       `this.isGrounded = true;`
       `this.jumpCutApplied = false;`
       Resets action state to `IDLE`/`RUNNING`/`CROUCH_IDLE`/`CRAWLING` appropriately.

3. `tests/unit/player_kinematics_aiming.test.ts`:
   - Updated constants assertion to verify: `RUN_SPEED = 132.0`, `CRAWL_SPEED = 54.0`, `JUMP_IMPULSE = -360.0`, `GRAVITY = 800.0`, `JUMP_CUT_RATIO = 0.5`, `TERMINAL_FALL_VELOCITY = 500.0`, `APEX_FLOAT_VELOCITY_THRESHOLD = 40.0`, `APEX_GRAVITY_SCALE = 0.65`, `COYOTE_FRAMES = 4`, `JUMP_BUFFER_FRAMES = 4`.
   - Updated jump cut assertion: `PlayerKinematics.applyJumpCut(-300)` returns `-150`.
   - Added 6 dedicated Newtonian kinematics unit tests:
     - Apex float dampening test ($|v_y| < 40 \implies 520\text{ px/s}^2$ vs $|v_y| \ge 40 \implies 800\text{ px/s}^2$).
     - Single-shot jump cut test (cuts strictly once, prevents repeated cuts).
     - 4-frame coyote time window test (allowed within 4 frames, rejected after expiration).
     - 4-frame jump input buffering test (buffered airborne, executed on landing).
     - Platform landing snapping, zeroing, and state reset test.
     - Terminal fall velocity clamping test ($500\text{ px/s}$).

### 1.2 Tool Commands and Verbatim Output
1. **Typecheck (`npx tsc --noEmit`)**:
   ```
   Exit code: 0
   Stdout: (empty)
   Stderr: (empty)
   ```

2. **Test Suite Execution (`npm test`)**:
   ```
   > fullmetalslug@1.0.0 test
   > vitest run

    RUN  v3.2.7 /Users/user/src/fullmetalslug

    ✓ tests/unit/grenade_physics.test.ts (5 tests) 3ms
    ✓ tests/unit/core_engine.test.ts (19 tests) 4ms
    ✓ tests/unit/enemy_boss_statemachine.test.ts (18 tests) 6ms
    ✓ tests/unit/input_and_hud.test.ts (12 tests) 14ms
    ✓ tests/unit/player_melee_ranged.test.ts (4 tests) 3ms
    ✓ tests/unit/pow_system.test.ts (3 tests) 4ms
    ✓ tests/unit/player_kinematics_aiming.test.ts (15 tests) 4ms
    ✓ tests/unit/weapons_system.test.ts (5 tests) 5ms
    ✓ tests/unit/player_weapon_state.test.ts (17 tests) 7ms
    ✓ tests/unit/melee_ranged_decision.test.ts (7 tests) 6ms
    ✓ tests/unit/render_components.test.ts (21 tests) 8ms
    ✓ tests/unit/adversarial_challenge.test.ts (10 tests) 92ms
    ✓ tests/unit/challenger_boss_and_stability.test.ts (9 tests) 259ms

    Test Files  13 passed (13)
         Tests  145 passed (145)
      Start at  15:28:40
      Duration  651ms
   ```

3. **Production Build (`npm run build`)**:
   ```
   > fullmetalslug@1.0.0 build
   > tsc -b && vite build

   vite v6.4.3 building for production...
   transforming...
   ✓ 31 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                  1.26 kB │ gzip:  0.58 kB
   dist/assets/index-DiOqv67x.js  165.40 kB │ gzip: 43.05 kB │ map: 605.99 kB
   ✓ built in 234ms
   ```

---

## 2. Logic Chain

1. **Newtonian Jump Trajectory ($h = 81.0\text{px}$, $t_{\text{apex}} = 27\text{ frames}$)**:
   - Observation 1.1 shows initial impulse set to $-360.0\text{ px/s}$ and gravity to $800.0\text{ px/s}^2$.
   - Using $t_{\text{apex}} = \frac{|v_0|}{g} = \frac{360}{800} = 0.450\text{ s}$, at 60Hz this equals exactly 27 simulation ticks.
   - Parabolic height $h = \frac{v_0^2}{2g} = \frac{129600}{1600} = 81.0\text{ px}$. This gives authentic arcade weight, eliminates the previous floatiness, and cleanly clears standard 40px obstacle heights.

2. **Apex Float Dampening**:
   - Observation 1.1 shows that when $|v_y| < 40\text{ px/s}$, effective gravity scales to $0.65 \times 800 = 520\text{ px/s}^2$.
   - This smoothly broadens the crest of the parabola across the $[-40, +40]\text{ px/s}$ zone, providing 3–4 extra frames of hangtime for air-to-ground aiming before full downward acceleration resumes.

3. **Single-Shot Jump Cut**:
   - Observation 1.1 reveals the previous bug where `applyJumpCut` was evaluated unconditionally every frame while `!input.jumpHeld`, multiplying $v_y$ repeatedly by $0.45^n$ and freezing the player mid-air.
   - Requiring `!input.jumpHeld && !input.jumpPressed && !this.jumpCutApplied` guarantees that jump cut applies strictly once upon release, halving upward velocity to provide responsive variable jump heights without physics freezing.

4. **Input Forgiveness (Coyote Time & Buffering)**:
   - Observation 1.1 demonstrates that `coyoteTimer` (4 frames) permits jumping within 66.7ms of walking off a ledge, preventing dropped jumps due to sub-frame timing.
   - Similarly, `jumpBufferTimer` (4 frames) captures jump presses up to 66.7ms prior to platform touchdown and instantly executes the jump upon landing, eliminating input lag.

5. **Landing Snapping & Velocity Zeroing**:
   - Observation 1.1 shows `resolveGroundContact` snapping `position.y = contact.groundY` and setting `velocity.y = 0`, eliminating jitter, clipping, and downward accumulation.

---

## 3. Caveats

1. Semi-solid platform drop-through (`initiateDropThrough`) intentionally resets both `coyoteTimer` and `jumpBufferTimer` to 0 so downward drop inputs never trigger an accidental jump.
2. In headless unit test environments without platforms, `PlatformPhysics.resolveGroundContact` is skipped, so tests validating platform landing must supply at least one solid platform.
3. No caveats remain regarding physics calculations or test coverage.

---

## 4. Conclusion

All tasks assigned to `worker_m1` under R1 Newtonian Physics & Arcade Kinematics have been completed with genuine physics implementations.
- All physics constants match the specification.
- Apex float dampening, single-shot jump cut, coyote time, jump input buffering, and platform landing snapping are fully implemented and verified.
- 13/13 test files and 145/145 tests pass green. Production build compiles cleanly.

---

## 5. Verification Method

### 5.1 Commands
```bash
npx tsc --noEmit
npm test
npm run build
```

### 5.2 Files to Inspect
- `src/core/player/PlayerKinematics.ts`: Constants on lines 51–66.
- `src/core/player/PlayerController.ts`: `performJump` (lines 102–112), `handleInput` (lines 135–210), `update` (lines 430–520).
- `tests/unit/player_kinematics_aiming.test.ts`: 15 comprehensive unit tests.

### 5.3 Invalidation Conditions
- Any unit test in `player_kinematics_aiming.test.ts` fails.
- Player jumps while airborne when `coyoteTimer === 0`.
- Player jump velocity is cut repeatedly across consecutive frames.
- Player falling speed exceeds 500 px/s.

