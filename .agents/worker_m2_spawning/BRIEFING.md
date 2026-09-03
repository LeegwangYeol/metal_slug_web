# BRIEFING — 2026-09-03T08:41:00Z

## Mission
Implement Milestone 2 (Spawning Logic Overhaul): Fix enemy spawn Y-coordinate & collision snapping, rewrite POW placement to static pre-placement, fix enemy ingress AI forward movement, set boss trigger HP to 400, and ensure mid-boss reinforcements enter from off-screen right.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_spawning
- Original parent: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Milestone: M2 - Spawning Logic Overhaul

## 🔒 Key Constraints
- Exclusive Write Ownership:
  - `src/main.ts`
  - `src/core/entities/enemies/SoldierEnemy.ts`
  - `src/core/entities/pow/PowEntity.ts`
- Prohibited: Do NOT modify `KeyboardController.ts` or `TetsuyukiBoss.ts` (owned by other workers).
- Do NOT cheat: Genuine implementation, no hardcoded test shortcuts, maintain real state and physics.
- SoldierEnemy height = 38, ground Y = 230 -> spawn Y = 192 (feet at 230).
- POWs must be pre-placed statically at stage load time in `src/main.ts`, no popping on player or visible viewport.
- Enemy ingress must spawn off-screen ($X \ge \text{cameraX} + 480 + 40$) and advance into viewport smoothly.
- `trigger_end_boss` customHp: 400.
- All tests must pass: `npm test`, `npm run build`.

## Current Parent
- Conversation ID: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Updated: 2026-09-03T08:41:00Z

## Task Summary
- **What to build**: Overhaul spawning logic for enemies and POWs, fix enemy physics falling bug, fix ingress AI freezing bug, set boss spawn HP to 400, Pre-place POWs statically.
- **Success criteria**: Enemies don't fall through ground or despawn; POWs pre-placed and don't pop on screen; enemies advance smoothly; mid-boss reinforcements enter from off-screen; `npm run build` passes; unit and E2E tests pass.
- **Interface contracts**: `/Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md`
- **Code layout**: `/Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md`

## Key Decisions Made
- `initStaticPows()` placed 4 static POWs at stage load time: `pow_1` at (320, 175), `pow_2` at (850, 175), `pow_3` at (1450, 165), `pow_4` at (1710, 175).
- Initial entity queue (`entitiesToAdd`) flushed at stage load so POWs and player are immediately retrievable via `engine.getEntity()`.
- Removed all `PowEntity` additions from runtime triggers `trigger_wave_1`, `trigger_wave_2`, `trigger_wave_3`.
- Set all soldier spawn `y = 192` so bottom edge aligns at $192 + 38 = 230$ with solid ground platform at $Y = 230$.
- Ingress completion state transition updated: knife charger and grenade thrower smoothly advance into viewport ($v_x = \text{facing} \times 70$ and $v_x = \text{facing} \times 50$) instead of stopping at 0; rifleman patrol boundary constrained to $x + 20$ to prevent exiting off-screen.
- Mid-boss reinforcement adds detected via `id.startsWith('midboss_add_')` and routed to spawn off-screen right ($X \ge 1220, Y = 192$) entering with `INGRESS`.
- Set `trigger_end_boss` `customHp: 400`.

## Artifact Index
- `.agents/worker_m2_spawning/DISPATCH.md` — Assignment instructions
- `.agents/worker_m2_spawning/BRIEFING.md` — Situational awareness
- `.agents/worker_m2_spawning/progress.md` — Heartbeat and progress tracking
- `.agents/worker_m2_spawning/handoff.md` — Final 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/main.ts`: Added `initStaticPows()`, removed runtime trigger POW spawns, aligned soldier spawn Y to 192, rebalanced end boss HP to 400.
  - `src/core/entities/enemies/SoldierEnemy.ts`: Handled midboss add off-screen ingress, prevented AI freeze on ingress completion, and fixed forward advance.
- **Build status**: `npm run build` PASS (tsc -b && vite build)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 14/14 unit test suites passed (178 tests), 9/9 Playwright E2E passed.
- **Lint status**: 0 violations
- **Tests added/modified**: Verified all stage spawning, despawn, and kinematics suites.

## Loaded Skills
None
