## 2026-09-04T01:27:14+09:00

You are a teamwork_preview_worker assigned to implement Milestone 1: Epic Bosses & Dynamic Crisis Events for the Metal Slug Web Massive Expansion.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_boss_crisis

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read before starting work:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/analysis.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/handoff.md

Your tasks and file ownership:
1. `src/core/engine/GameEngine.ts`: Add `removePlatform(platformId: string): boolean`.
2. `src/core/engine/StageManager.ts`: Add `collapsePlatform(platformId: string): boolean` and `setCameraBounds(bounds: CameraBounds): void`.
3. `src/core/entities/boss/BossTypes.ts`: Add interfaces for crisis management and Iron Nokana phases.
4. `src/core/entities/boss/CrisisEventManager.ts`: Implement the decoupled CrisisEventManager monitoring boss HP thresholds (75%, 50%, 25%) and triggering environmental hazards and arena alterations.
5. `src/core/entities/boss/EnvironmentalHazard.ts`: Implement concrete hazard entities (ArtilleryShellHazard, FallingDebrisHazard, GroundFlameHazard) implementing GameEntity with physical hitboxes and collision damage.
6. `src/core/entities/boss/IronNokanaBoss.ts`: Implement the multi-phase heavy crawler boss Iron Nokana with 4 distinct phases, telegraphed attacks, and rage overdrive state.
7. `src/core/player/PlayerController.ts`: Ensure player handles hazard collision damage gracefully.
8. `tests/unit/boss_crisis_events.test.ts`: Write comprehensive unit tests asserting:
   - Boss HP thresholds (75%, 50%, 25%) trigger crisis events.
   - 75% HP triggers artillery shell hazard entity generation.
   - 50% HP collapses platform and contracts camera bounds.
   - 25% HP triggers rage state.
   - Threshold tracking is robust under massive burst damage.
9. `tests/unit/iron_nokana_boss.test.ts`: Write comprehensive unit tests for Iron Nokana phases, telegraphed attacks, rage mode, and death.
10. Run `npm test` and `npm run build` (`tsc -b && vite build`) to verify that all new tests pass and all existing 294 unit tests pass with zero regressions and zero TypeScript errors.
11. Write a complete handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_boss_crisis/handoff.md` with build/test command results, files modified/created, and send a message back to the orchestrator.
