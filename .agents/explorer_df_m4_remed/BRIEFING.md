# BRIEFING — 2026-09-10T14:10:00Z

## Mission
Investigate and remediate M4 horde survival test failures: diagnose steering evaluator distance starvation, design mathematically sound combat engagement parameters, and resolve Playwright port/server reuse issues.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer (investigation & synthesis)
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_remed
- Original parent: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Milestone: M4 Remediation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT write or edit source code files directly
- Always wait for explicit user approval before proceeding with implementation
- Communicate via files and send_message to parent
- Adhere strictly to 5-Component Handoff Protocol

## Current Parent
- Conversation ID: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Updated: 2026-09-10T14:10:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`, `COLLABORATION.md`
  - Forensic audit reports: `auditor_df_m4_recheck/handoff.md`, `reviewer_df_m4_recheck/handoff.md`, `challenger_df_m4_recheck/handoff.md`
  - Engine code: `src/main.ts` (contact damage `Player.COLLISION_RADIUS + 15 = 29px`), `src/core/entities/Player.ts`, `src/core/entities/EnemyTypes.ts` (Skeleton HP 25, speed 65), `src/core/weapons/ArcaneScythe.ts` (Rank 1 damage 25, reach 75px, cooldown 1.4s), `src/core/progression/PlayerProgression.ts` (Level 1 -> 2 requires 10 XP), `src/core/systems/LootManager.ts` (magnet radius 90px), `src/core/systems/WaveDirector.ts`
  - Spec & Config: `tests/e2e/horde_survival.spec.ts` (lines 364-374, 376-379, 409-418, 420-428), `playwright.config.ts`, `package.json`
- **Key findings**:
  - Starvation root cause: Candidate evaluator severely penalized `fdist < 72` (-40,000) and `fdist < 90` (-5,000), forcing the bot to flee to 110-135px and starving the 75px Arcane Scythe of kills.
  - Skeletons have 25 HP; Scythe deals 25 damage (1-hit kill). When killed within 45-72px, emerald shards (1 XP) drop directly within player's 90px magnet radius.
  - Port deadlock cause: `reuseExistingServer: false` in `playwright.config.ts` causes Playwright to probe port 4173 before running cleanup command, aborting on orphaned Vite preview.
- **Unexplored areas**: None; all necessary components analyzed.

## Key Decisions Made
- Confirmed exact mathematical envelope for candidate steering evaluator:
  1. Restrict severe collision penalties strictly to `fdist < 29` (-1,000,000) and danger buffer `fdist < 38` (-80,000).
  2. Implement positive combat engagement bonus (+550) for maintaining distance in sweet spot 45px to 72px.
  3. Encourage STOP (+350) when enemies approach at 48px to 74px.
  4. Relax gem attraction clearance gate from `>= 65px` to `>= 42px` with elevated Level 1 priority (2200).
- Confirmed dual-layer port 4173 fix:
  1. Set `webServer.reuseExistingServer: !process.env.CI` (or `true`) in `playwright.config.ts`.
  2. Add `"pretest:e2e": "kill -9 $(lsof -ti :4173) 2>/dev/null || true"` to `package.json`.

## Artifact Index
- DISPATCH.md — Initial dispatch log
- BRIEFING.md — Working memory
- progress.md — Activity and liveness heartbeat
- handoff.md — Comprehensive forensic investigation and implementation plan report
