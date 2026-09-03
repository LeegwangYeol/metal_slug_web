# Dispatch: Worker M1 (Physics & Newtonian Kinematics)

## Mission
Implement Newtonian physics and authentic arcade kinematics according to R1 requirements and Explorer 1's handoff specification.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m1

## Exclusive File Ownership
- `src/core/player/PlayerKinematics.ts`
- `src/core/player/PlayerController.ts`
- `tests/unit/player_kinematics_aiming.test.ts`

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/survey_report.md`

## Instructions
1. Update physics constants in `src/core/player/PlayerKinematics.ts`:
   - `RUN_SPEED = 132.0`
   - `CRAWL_SPEED = 54.0`
   - `JUMP_IMPULSE = -360.0`
   - `GRAVITY = 800.0`
   - `TERMINAL_FALL_VELOCITY = 500.0`
   - `JUMP_CUT_RATIO = 0.5`
2. In `src/core/player/PlayerController.ts`:
   - Implement apex float dampening: when airborne and $|v_y| < 40\text{ px/s}$, apply $0.65 \times \text{GRAVITY}$ to achieve the signature arcade apex hangtime.
   - Fix jump cut: execute jump cut strictly ONCE when jump button is released (`!input.jumpHeld`), rather than repeatedly every frame.
   - Implement 4-frame ($66.7\text{ms}$) coyote time: allow jumping within 4 frames after leaving a ledge.
   - Implement 4-frame jump input buffering: buffer a jump press within 4 frames before touching ground and execute on landing.
   - Ensure clean platform landing snapping and velocity zeroing.
3. Update `tests/unit/player_kinematics_aiming.test.ts` to sync with new constants.
4. Run `npm test` using `run_command` and ensure all player kinematics tests pass green.
5. Deliver `handoff.md` in your working directory with build & test output.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-03T06:22:35Z
You are worker_m1.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m1
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m1/DISPATCH.md

Exclusive File Ownership:
- src/core/player/PlayerKinematics.ts
- src/core/player/PlayerController.ts
- tests/unit/player_kinematics_aiming.test.ts

Your task:
1. Implement authentic Newtonian physics in src/core/player/PlayerKinematics.ts and PlayerController.ts:
   - RUN_SPEED = 132.0, CRAWL_SPEED = 54.0, JUMP_IMPULSE = -360.0, GRAVITY = 800.0, TERMINAL_FALL_VELOCITY = 500.0, JUMP_CUT_RATIO = 0.5.
   - Implement apex float dampening: when airborne and |velocity.y| < 40 px/s, apply 0.65 * GRAVITY to produce the iconic arcade apex hangtime.
   - Implement single-shot jump cut: apply jump cut strictly once upon releasing jump key.
   - Implement 4-frame coyote time and 4-frame jump input buffering.
   - Ensure clean platform landing snapping.
2. Update tests/unit/player_kinematics_aiming.test.ts with the new constants.
3. Run npm test to verify all kinematics tests pass.
4. Output your handoff report to /Users/user/src/fullmetalslug/.agents/worker_m1/handoff.md with passing test results. Send a message to orchestrator when done.
