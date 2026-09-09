# BRIEFING — 2026-09-04T01:24:30+09:00

## Mission
Survey the Boss and Crisis Event architecture for the Metal Slug Web Massive Expansion, producing technical recommendations, data structures, and automated test specifications.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss
- Original parent: b3c79922-3858-4e29-9059-efa4eb0754d9
- Milestone: Boss and Crisis Event Architecture Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Wait for explicit user approval before proceeding with implementation
- Communicate with Claude via Rule Guide (Markdown COLLABORATION.md)
- Write only to .agents/survey_explorer_boss/

## Current Parent
- Conversation ID: b3c79922-3858-4e29-9059-efa4eb0754d9
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/core/entities/boss/BossTypes.ts`
  - `src/core/entities/boss/TetsuyukiBoss.ts`
  - `src/core/entities/enemies/MidBossVehicle.ts`
  - `src/core/engine/StageManager.ts`
  - `src/core/engine/GameEngine.ts`
  - `src/core/physics/Platform.ts`
  - `src/render/Camera.ts`
  - `src/core/player/PlayerController.ts`
  - `src/main.ts`
  - `tests/unit/enemy_boss_statemachine.test.ts`
  - `tests/unit/boss_rebalance.test.ts`
- **Key findings**:
  - Existing `TetsuyukiBoss` has 3 fixed phases and burst-damage clamping, but crisis logic is completely absent.
  - `GameEngine` lacks platform removal API; `StageManager` lacks runtime platform collapse and camera bounds contraction APIs.
  - Boss hazards (`falling_debris`, shockwaves) do not reliably register as physical `GameEntity` hitboxes damaging the player in `PlayerController.onCollision`.
  - Fully designed decoupled `CrisisEventManager` triggering at 75%, 50%, and 25% HP with environmental hazards, platform collapse, camera contraction, and rage states.
  - Fully designed `IronNokanaBoss` multi-phase heavy armored crawler dreadnought.
- **Unexplored areas**: None for this survey milestone.

## Key Decisions Made
- Designed `CrisisEventManager` as a standalone manager decoupled from specific boss classes.
- Specified concrete `EnvironmentalHazard` entity implementations (`ArtilleryShellHazard`, `FallingDebrisHazard`, `GroundFlameHazard`) with physical collision.
- Formulated zero-regression API extensions for `GameEngine` and `StageManager`.
- Outlined automated test suite verifying crisis event triggers and environment alterations.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/DISPATCH.md` — Initial dispatch instructions
- `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/BRIEFING.md` — Working memory and state tracking
- `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/progress.md` — Liveness heartbeat and milestone tracker
- `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/analysis.md` — Full architectural survey, blueprints, data structures, and test matrices
- `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/handoff.md` — 5-component handoff report
