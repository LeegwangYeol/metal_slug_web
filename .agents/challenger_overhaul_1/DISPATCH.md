# Dispatch: Challenger Overhaul 1 (Physics & Spawning Stress Testing)

## Mission
Empirically challenge and stress-test the overhauled Newtonian physics, platform collision, and enemy spawning/despawning systems.

## Working Directory
/Users/user/src/fullmetalslug/.agents/challenger_overhaul_1

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `src/core/player/PlayerKinematics.ts`
- `src/core/player/PlayerController.ts`
- `src/core/engine/StageManager.ts`
- `src/core/entities/enemies/SoldierEnemy.ts`

## Instructions
1. Write and execute empirical stress-test scripts (or Vitest checks):
   - Verify Newtonian parabolic trajectory $y(t)$: test jump ascent frames, apex float window ($|v_y| < 40$), variable jump cut single-shot enforcement, coyote time edge cases (e.g. jumping at frame 3 vs frame 5), and jump buffering on rapid landing.
   - Verify out-of-bounds spawn positioning: simulate spawn trigger events across various camera positions and ensure minion initial positions NEVER fall inside $[ \text{cameraX}, \text{cameraX} + 480 ]$.
   - Verify despawn logic: simulate rapid camera forward movement and confirm entities are cleanly removed when $x < \text{cameraX} - 180$ or $y > 320$.
2. Run your tests and `npm test` using `run_command`.
3. Deliver `handoff.md` with empirical test data, failure analysis (if any), and explicit verdict: `APPROVE` or `REJECT`. Send message to orchestrator when done.

## 2026-09-03T07:00:51Z
You are challenger_overhaul_1.
Working directory: /Users/user/src/fullmetalslug/.agents/challenger_overhaul_1
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/challenger_overhaul_1/DISPATCH.md

You MUST read /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md before starting work.

Your task:
1. Empirically challenge and stress-test the overhauled Newtonian physics, platform collision, and enemy spawning/despawning systems:
   - Write and execute empirical stress tests or benchmark scripts to verify:
     - Jump ascent frame count and exact height at apex (81.0px).
     - Apex float dampening (0.65 * g) when |vy| < 40 px/s.
     - Single-shot jump cut on key release (no repeated deceleration cuts).
     - Coyote time edge cases (jumping within 4 frames vs after 4 frames).
     - Jump input buffering on rapid landing.
     - Spawner coordinate invariants: verify spawn coordinates are strictly > cameraX + 480 (never within active viewport).
     - Despawn invariants: verify entities behind cameraX - 180 or below y = 320 are cleanly culled.
2. Run your tests and npm test to confirm zero regressions.
3. Deliver handoff.md with empirical test data and an explicit verdict: APPROVE or REJECT. Send a message to orchestrator when done.
