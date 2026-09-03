# DISPATCH — Challenger Polish 2

## Mission
Adversarially challenge and stress-test the Varied Death Animations & Decoupled Corpse Manager (R2) and Bug Remediations (R3).

## Focus & Stress Testing
1. Empirically verify death states and corpse simulation:
   - High-volume stress test: spawn and kill 100+ soldiers simultaneously with mixed damage types (`bullet`, `grenade`, `flame`, `melee`). Verify memory stability, corpse culling, and zero entity leaks in `GameEngine`.
   - Verify `soldier.isAlive === false` immediate entity invariant across all 4 soldier roles.
   - Verify explosion blowback ballistic trajectory, tumbling angular velocity, and detached helmet physics.
   - Verify burning death state progression (thrashing -> charcoal silhouette -> ash collapse).
2. Empirically verify bug fixes:
   - Player damage collision: verify player takes damage from enemy bullets, melee boxes, and grenade explosions.
   - Frontal shield deflection: verify shield trooper deflects frontal bullets but takes grenade/flame damage.
   - Mid-boss add coordinate integrity: verify adds spawn with foot on ground line ($y = 192$).
3. Inspect and verify Playwright screenshot artifacts in `artifacts/death_animations/`:
   - `death_standard.png` (>5KB)
   - `death_explosion_blowback.png` (>5KB)
   - `death_burning.png` (>5KB)
4. Execute `npm run build`, `npm test`, `npm run test:e2e`.
5. Output your formal verdict (`APPROVE` or `REJECT`) with empirical data in `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_polish_2/handoff.md`.

MANDATORY: Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/handoff.md` before testing.

## 2026-09-03T15:44:04Z
You are Challenger Polish 2.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_polish_2/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md and /Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/handoff.md before starting. Also read /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_polish_2/DISPATCH.md.

Adversarially challenge and stress-test the Death Animations (R2) and Bug Remediations (R3):
- High-volume stress test: spawn and kill 100+ soldiers simultaneously with mixed damage types (bullet, grenade, flame, melee). Check memory, corpse lifecycle, and zero engine entity leaks.
- Empirically verify explosion blowback ballistic trajectory, tumbling angular velocity, and detached helmet physics.
- Empirically verify burning death state progression (thrash -> charcoal -> ash).
- Empirically verify player damage collision from enemy bullets and melee attacks.
- Inspect and verify artifacts/death_animations/ screenshots (>5KB each).

Run:
- npm run build
- npm test
- npm run test:e2e

Write your detailed findings and verdict (APPROVE or REJECT) to /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_polish_2/handoff.md and report to the orchestrator via send_message.

