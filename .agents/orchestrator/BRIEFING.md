# BRIEFING — 2026-09-03T12:11:30+09:00

## Mission
Lead a multi-agent swarm to design, implement, integrate, and verify a complete, multi-stage web-based 2D run-and-gun action game inspired by Metal Slug with decoupled architecture, rich combat mechanics, procedural assets/audio, and 100% automated test coverage.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/user/src/fullmetalslug/.agents/orchestrator
- Original parent: sentinel
- Original parent conversation ID: c1ceb542-d7d3-4f22-bb6a-1226794cb1fb

## 🔒 My Workflow
- **Pattern**: Project Pattern (Survey → Decompose & Delegate / Iteration Loop)
- **Scope document**: /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
1. **Decompose**: Decompose requirements R1-R5 into survey, architecture/scaffolding, decoupled core simulation, combat/weapons, enemy/boss AI, procedural assets/audio, rendering/input integration, and testing track.
2. **Dispatch & Execute**:
   - Step 0: Survey full scope with 3 parallel Explorers / Spec Miners.
   - Step 1: Establish project scaffolding & E2E test infra in parallel with core implementation milestones.
   - Step 2: Execute milestones via specialized Workers, verified by Reviewers, Challengers, and Forensic Auditor.
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Spawn successor at 16 spawns after active subagents complete.

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- File-editing tools ONLY for metadata/state files (.md) in .agents/ folder.
- ALWAYS wait for explicit user approval before proceeding with implementation (User already gave explicit approval "승인" in ORIGINAL_REQUEST.md).
- Forensics Audit is MANDATORY — binary veto on integrity violation.
- Never reuse subagents after handoff delivery.

## Current Parent
- Conversation ID: c1ceb542-d7d3-4f22-bb6a-1226794cb1fb
- Updated: 2026-09-03T12:11:00+09:00

## Key Decisions Made
- Confirmed explicit user approval in ORIGINAL_REQUEST.md ("승인").
- Initiated Project Pattern workflow starting with Step 0 Survey (3 parallel Explorers/Spec Miners).
- Maintaining decoupled TypeScript + Vite architecture (pure Node-testable core in `src/core/`, Canvas renderer in `src/render/`).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|---|---|---|---|---|
| explorer_survey_1 | teamwork_preview_explorer | Environment & Scaffolding Survey | completed | a921f8f5-a19f-4620-9326-6f06d9d2a390 |
| spec_miner_survey_2 | teamwork_preview_spec_miner | Game Mechanics & Weapons Spec Mining | completed | 3826ee14-53c0-4c2e-b601-907804242d70 |
| spec_miner_survey_3 | teamwork_preview_spec_miner | Enemies, Bosses & Audio Spec Mining | completed | 75053138-a1b1-4666-b4a3-4105fd46de96 |
| worker_m1 | teamwork_preview_worker | Milestone M1: Scaffolding & Core Engine | completed | 7d9744d4-8665-485c-a855-1081e8007096 |
| worker_m2 | teamwork_preview_worker | Milestone M2: Player, Weapons & POWs | completed | af2905d0-c15e-4c42-b586-232eebfd7e65 |
| worker_m3 | teamwork_preview_worker | Milestone M3: Enemies & Boss Multi-Phase | in-progress | cb6a661e-15a2-4c04-b59f-3aac4a893d35 |
| worker_m4 | teamwork_preview_worker | Milestone M4: Pixel Art & Parallax Render | completed | 70f1cc59-2aa9-45b5-b1d9-1a398ec1c795 |
| worker_m5 | teamwork_preview_worker | Milestone M5: Web Audio & Voice Announcer | completed | 23eda555-b087-4f6a-a4dc-5eb6341f1cab |
| test_writer_track | teamwork_preview_test_writer | Unit & E2E Test Suite | completed | be373148-9458-496e-900b-e529bfb9f7f2 |
| worker_m6 | teamwork_preview_worker | Milestone M6: Full Game Integration & Polish | completed | 26a10d8c-11f2-4113-8862-665a342aef78 |
| reviewer_1 | teamwork_preview_reviewer | Architecture & Gameplay Code Review | in-progress | 09b12c3b-d6aa-45ad-9932-c1bee428f36d |
| reviewer_2 | teamwork_preview_reviewer | Enemies, Render & Audio Review | in-progress | 3081ce71-6fec-48d3-829f-7ef111e5f9b0 |
| challenger_1 | teamwork_preview_challenger | Kinematics & Combat Stress Challenger | in-progress | 9e7efa93-be09-444a-8803-9f005ac994de |
| challenger_2 | teamwork_preview_challenger | Boss AI & Long-Run Stability Challenger | in-progress | 2c178d4a-215b-424d-8fda-f794b3de4114 |
| auditor_1 | teamwork_preview_auditor | Forensic Integrity Auditor | completed | 91d4763c-8385-4f03-9b4d-2c938410dfab |
| worker_remediation | teamwork_preview_worker | Remediation & Polish Worker | completed | 511a246d-375b-4c1d-9f0c-8f574111b3f6 |

## Succession Status
- Succession required: no (all milestones complete and verified)
- Spawn count: 16 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not required

## Active Timers
- Heartbeat cron: task-25 (`*/10 * * * *`)
- Safety timer: none (setting next)

## Artifact Index
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` — Authoritative user request
- `/Users/user/src/fullmetalslug/COLLABORATION.md` — Claude collaboration specification
- `/Users/user/src/fullmetalslug/.agents/orchestrator/BRIEFING.md` — Orchestrator briefing and state
- `/Users/user/src/fullmetalslug/.agents/orchestrator/DISPATCH.md` — Dispatch log from parent
- `/Users/user/src/fullmetalslug/.agents/orchestrator/plan.md` — Master execution plan
- `/Users/user/src/fullmetalslug/.agents/orchestrator/progress.md` — Progress tracker and liveness heartbeat
