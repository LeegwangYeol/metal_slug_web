# BRIEFING — 2026-09-04T01:27:18+09:00

## Mission
Orchestrate the Metal Slug Web Massive Expansion: Boss Encounters & Crisis Engine, Autonomous Ally NPCs, Items & Power-ups, Screen-Clearing Ultimate Move, Playwright E2E/Screenshots, and 100% green tests.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion
- Original parent: parent
- Original parent conversation ID: 38ef94aa-79d4-4796-bd24-0df49de47ae7

## 🔒 My Workflow
- **Pattern**: Project Pattern (Dual Track: Implementation Track + E2E Testing Track)
- **Scope document**: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/PROJECT.md
1. **Decompose**: Survey codebase via 3 Explorers (Boss/Crisis, Allies/Items/Ultimates, Test/Rendering Infra). Formulate unified PROJECT.md with feature inventory, milestones, and interface contracts.
2. **Dispatch & Execute**:
   - Implementation Track: Sequential milestones with iteration loop (Explorer -> Worker -> Reviewers -> Challengers -> Forensic Auditor).
   - E2E Testing Track: Requirements-driven Playwright & Vitest test suites (Tiers 1-4) + visual screenshot proof generation.
   - Final Hardening Milestone: 100% test pass rate + Tier 5 adversarial challenge.
3. **On failure**: Retry -> Replace -> Skip (non-critical only) -> Redistribute -> Redesign. (Auditor integrity check is a non-skippable binary veto).
4. **Succession**: Threshold at 16 spawns; soft handoff to successor if reached.
- **Work items**:
  1. Survey & Architecture Exploration [done]
  2. PROJECT.md & TEST_INFRA.md Formulation [done]
  3. Milestone 1: Boss Encounters & Crisis Engine [in-progress]
  4. Milestone 2: Autonomous Ally NPCs & Weapons/Items Expansion [pending]
  5. Milestone 3: Screen-Clearing Ultimate Move & Cinematic FX [pending]
  6. Milestone 4: E2E Integration, Visual Proof Screenshots & Test Hardening [pending]
  7. Final Review, Challenge & Forensic Victory Audit [pending]
- **Current phase**: 2 (Milestone 1 Implementation)
- **Current focus**: Monitoring Worker 1 (M1 Boss & Crisis Engine)

## 🔒 Key Constraints
- DISPATCH-ONLY orchestrator: NEVER write source code directly, NEVER run build/tests directly, delegate all execution to subagents.
- User approval explicitly verified ("승인").
- Strict integrity rules: Zero tolerance for mock/cheating implementations. Binary veto by Forensic Auditor.
- Maintain 100% test pass rate across all existing (294 unit tests, 17 E2E tests) and new tests with zero build errors.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 38ef94aa-79d4-4796-bd24-0df49de47ae7
- Updated: not yet

## Key Decisions Made
- Project pattern selected with Dual Track (Implementation & E2E Testing).
- Survey completed: 3 explorers mapped all subsystems and preserved key invariants (164 sprite count baseline, KeyU for ultimate, KeyX preserved for jump, optional ultimatePressed in PlayerInputSnapshot).
- Master PROJECT.md and TEST_INFRA.md established in orchestrator_expansion.
- Dispatched Worker 1 for Milestone 1 (Boss & Crisis Engine).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_boss | teamwork_preview_explorer | Survey Boss & Crisis Event System | completed | 00699a5e-559e-4978-aaa9-1bf25c998726 |
| explorer_allies_items | teamwork_preview_explorer | Survey Allies, Items & Ultimate Move System | completed | 1e7bf31b-3949-466d-96a3-5de30b6403b4 |
| explorer_render_e2e | teamwork_preview_explorer | Survey Render, Audio & E2E Testing System | completed | f7d6bc5f-bf04-48e8-ab93-c2491efe8faa |
| worker_m1_boss_crisis | teamwork_preview_worker | Milestone 1 Boss & Crisis Implementation | in-progress | 2809c66c-9f73-45bc-9f01-1e4d0544fc57 |

## Succession Status
- Succession required: no
- Spawn count: 4 / 16
- Pending subagents: 2809c66c-9f73-45bc-9f01-1e4d0544fc57
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-17
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md — Authoritative user requirements
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md — Collaboration guide & technical specs
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/PROJECT.md — Master project architecture and milestones
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/TEST_INFRA.md — E2E test infrastructure specification
