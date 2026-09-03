## 2026-09-03T08:32:45Z
You are Worker 1 (Controls & Input Specialist) for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative context:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Explorer 1 Handoff Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/handoff.md
- Project Scope: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_controls

Exclusive Write Ownership:
`src/input/KeyboardController.ts`
(Do NOT modify any other files.)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 1 (M1: Key Controls and Jump Fix):
1. In `src/input/KeyboardController.ts`:
   - Map `Space`, `KeyK`, and `KeyX` to `'jump'` (fix lines 75, 259 where Space was incorrectly mapped to 'fire').
   - Map `KeyJ` and `KeyZ` to `'fire'`.
   - Map `KeyL` and `KeyC` to `'grenade'`.
   - Ensure WASD and Arrow keys map to direction and aiming:
     - `KeyA`, `ArrowLeft` -> left
     - `KeyD`, `ArrowRight` -> right
     - `KeyW`, `ArrowUp` -> up
     - `KeyS`, `ArrowDown` -> down
2. Implement edge-detection latching for `jumpJustPressed` (and `fireJustPressed`, `grenadeJustPressed`):
   - Fast key taps in real browsers or Playwright might fire keydown then keyup before the next 60Hz tick consumes the snapshot.
   - Maintain a latched flag `jumpJustPressed` that becomes true on keydown and is cleared ONLY after `getSnapshot()` reads it.
3. Run verification:
   - Run unit tests: `npx vitest run tests/unit/input_and_hud.test.ts` (or `npm test`)
   - Run typecheck and build: `npm run build`
4. Deliverable:
   - Write comprehensive handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_controls/handoff.md` with:
     - Summary of changes made
     - Exact line diffs
     - Build and test command outputs
   - Send completion message to parent with path to handoff.
