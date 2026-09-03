# BRIEFING — 2026-09-03T17:31:10+09:00

## Mission
Investigate Spawning Logic for Enemies and POWs, analyze viewport/camera coordinate mapping, identify random timer/pop spawns, and propose a clean off-screen/fixed-stage spawning architecture.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2
- Original parent: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Milestone: exploration_phase

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- ALWAYS wait for explicit user approval before proceeding with implementation
- Communicate with Claude via Rule Guide (Markdown) COLLABORATION.md
- Use File for content delivery, Message for coordination

## Current Parent
- Conversation ID: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/main.ts` (trigger definitions, wave spawn actions, entity coordinates, render scene assembly)
  - `src/core/engine/StageManager.ts` (trigger execution, camera bounds, despawnOffscreenEntities)
  - `src/core/entities/enemies/SoldierEnemy.ts` (ingress state machine, bounding box, physics, role AI)
  - `src/core/entities/enemies/MidBossVehicle.ts` (timer-based troop hatch spawning, patrol boundaries)
  - `src/core/entities/pow/PowEntity.ts` (state machine, item drop spawning, rescue tally)
  - `src/core/physics/Platform.ts` (resolveGroundContact, snap tolerance, solid collision math)
  - `src/render/Camera.ts` (worldToScreen, deadzone tracking, forward ratchet lock)
  - `src/render/CanvasRenderer.ts` (viewport scaling, sprite drawing coordinates)
  - `tests/unit/stage_spawning_despawn.test.ts`, `tests/unit/empirical_physics_spawning_challenge.test.ts`
- **Key findings**:
  1. **Enemy Vanishing Root Cause**: Enemies are spawned at `y = 230` in `src/main.ts`. Because `SoldierEnemy`'s `position.y` is its top-left bound and height is 38px, its foot is at `y = 268` — 38px beneath the ground platform (`platTop = 230`). Platform collision check fails (`prevFootY <= platTop + 4.0` is false), gravity accelerates them downward, and within 30 frames (0.5s), `y > 320`, triggering `despawnOffscreenEntities`! They are deleted before entering the viewport!
  2. **POW Popping Root Cause**: `pow_1` is dynamically spawned at `(180, 175)` when player reaches `triggerX = 180` (right on top of the player). `pow_2` is spawned at `(640, 230)` when player reaches `420` (cameraX ~204, viewport [204, 684]), popping on-screen.
  3. **Ingress AI Freeze**: In `SoldierEnemy.ts`, when crossing `x <= cameraX + 460`, Knife Chargers and Grenade Throwers transition to `IDLE` with `vx = 0`, freezing at the screen edge if player is >180px away.
  4. **Mid-Boss Hatch Popping**: Mid-Boss has a 8-12s timer spawning soldiers directly on the vehicle hull at `hatchPos` without ingress or spawn jump animation.
- **Unexplored areas**: none (all assigned areas thoroughly analyzed and verified with code traces).

## Key Decisions Made
- Architected pre-placed static POWs in `StageData` (tied to piers/platforms at stage load).
- Architected exact spawn coordinates for enemies: `x = cameraX + 520 + offset`, `y = groundY - 38 = 192`.
- Architected active forward advance transitions for enemies upon completing ingress.
- Proposed off-screen reinforcement ingress for Mid-Boss adds.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/DISPATCH.md` — Dispatch log
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/BRIEFING.md` — Persistent working memory
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/progress.md` — Liveness heartbeat
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/handoff.md` — Final handoff report
