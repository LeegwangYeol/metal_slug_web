# BRIEFING — 2026-09-04T01:27:45Z

## Mission
Implement Milestone 1: Epic Bosses & Dynamic Crisis Events (Iron Nokana multi-phase boss, CrisisEventManager, EnvironmentalHazard entities, StageManager platform collapse/camera bounds, player hazard collision, and unit tests).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_boss_crisis
- Original parent: b3c79922-3858-4e29-9059-efa4eb0754d9
- Milestone: Milestone 1 - Epic Bosses & Dynamic Crisis Events

## 🔒 Key Constraints
- Multi-phase boss encounters with dynamic phase shifts and distinct attack patterns.
- Dynamic crisis situations triggered at specific HP thresholds (75%, 50%, 25% HP) altering the combat arena (environmental artillery hazards, collapsing terrain modifying active bounds).
- Zero regressions in existing 294 tests and clean tsc/vite build.
- Genuine implementation with no hardcoding or dummy implementations.

## Current Parent
- Conversation ID: b3c79922-3858-4e29-9059-efa4eb0754d9
- Updated: 2026-09-04T01:27:14+09:00

## Task Summary
- **What to build**: Multi-phase boss Iron Nokana, CrisisEventManager, concrete EnvironmentalHazard entities, platform collapse and camera bounds contraction in StageManager/GameEngine, player hazard damage integration, unit tests.
- **Success criteria**: All new unit tests pass, all 294 existing tests pass, tsc -b and vite build pass.
- **Interface contracts**: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/PROJECT.md
- **Code layout**: src/core/entities/boss/, src/core/engine/, src/core/player/, tests/unit/

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not yet run
- **Lint status**: Clean
- **Tests added/modified**: tests/unit/boss_crisis_events.test.ts, tests/unit/iron_nokana_boss.test.ts pending

## Loaded Skills
- None loaded yet

## Key Decisions Made
- Initializing worker workspace and situational awareness.

## Artifact Index
- DISPATCH.md — assignment requirements
- BRIEFING.md — persistent memory
- progress.md — liveness heartbeat
