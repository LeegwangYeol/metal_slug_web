# Dispatch: Challenger Overhaul 2 (Sprites, Crosshairs, Aim Animations Stress Testing)

## Mission
Empirically stress-test the overhauled procedural sprite engine, weapon crosshair math, and 5-directional upper-body aiming animations.

## Working Directory
/Users/user/src/fullmetalslug/.agents/challenger_overhaul_2

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `src/render/sprites/ProceduralSpriteFactory.ts`
- `src/render/CanvasRenderer.ts`
- `artifacts/screenshots/`

## Instructions
1. Write and execute empirical validation scripts:
   - Verify all 164 sprite keys in `ProceduralSpriteFactory.ts`: confirm zero null/undefined buffers, valid non-zero dimensions, and proper rendering without throwing exceptions.
   - Verify weapon crosshair geometry: test `calculateCrosshairGeometry` across all 8 aiming directions, test facing right ($+1$) vs facing left ($-1$), test weapon switching (Pistol, HMG, Flame Shot), and confirm no NaN/Infinity coordinates or invalid canvas arc angles.
   - Verify 5-directional aiming animation selection in `resolvePlayerSpriteKey`: test FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN across IDLE, RUN, JUMP, and CROUCH states.
   - Verify screenshot artifact integrity: verify all 5 files in `artifacts/screenshots/` are valid non-corrupted PNGs with dimensions 960x540.
2. Run your tests and `npm test` using `run_command`.
3. Deliver `handoff.md` with empirical test data and explicit verdict: `APPROVE` or `REJECT`. Send message to orchestrator when done.

## 2026-09-03T07:00:51Z
You are challenger_overhaul_2.
Working directory: /Users/user/src/fullmetalslug/.agents/challenger_overhaul_2
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/challenger_overhaul_2/DISPATCH.md

You MUST read /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md before starting work.

Your task:
1. Empirically stress-test the procedural sprite engine, weapon crosshair math, and 5-directional upper-body aiming animations:
   - Write and execute empirical validation scripts to verify:
     - All 164 sprite keys in ProceduralSpriteFactory.ts generate valid buffers without errors or null/undefined.
     - calculateCrosshairGeometry across all 8 aiming directions, left/right facing symmetry, weapon switching, and ensure no NaN/Infinity coordinates or invalid angles.
     - 5-directional upper-body aiming sprite resolution across IDLE, RUN, JUMP, and CROUCH states.
     - Screenshot artifact integrity: verify all 5 PNGs in artifacts/screenshots/ are valid 960x540 images.
2. Run your tests and npm test.
3. Deliver handoff.md with empirical test data and an explicit verdict: APPROVE or REJECT. Send a message to orchestrator when done.
