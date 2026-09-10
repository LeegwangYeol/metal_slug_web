# BRIEFING — 2026-09-10T10:38:50Z

## Mission
Autonomous rebuild of the game into a dark fantasy, Vampire Survivors-like horde survival shooter ("Grim Harvest: Undead Siege") using a 60-agent swarm.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_dark_fantasy
- Original parent: sentinel
- Original parent conversation ID: c949f701-56e6-4b4f-902e-7db29e6ac6b2

## 🔒 My Workflow
- **Pattern**: Project Pattern (Milestones M1–M5 + Dual Track)
- **Scope document**: /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
1. **Decompose**: Decomposed into 5 Milestones per PROJECT.md
2. **Dispatch & Execute**:
   - For each milestone: Iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor) with gate evaluation.
3. **On failure**:
   - Retry -> Replace -> Skip -> Redistribute -> Redesign
4. **Succession**: Self-succeed at 16 spawns
- **Work items**:
  1. M1: Foundation & High-Performance Core [done]
  2. M2: Dark Fantasy Art & Gothic Render Engine [done]
  3. M3: Occult Arsenal, Upgrades & Horde Director [done]
  4. M4: Automated E2E Playtesting & Hardening [done]
  5. M5: Deployment & Live Production Verification [in-progress]
- **Current phase**: 5
- **Current focus**: M5 (Deployment & Live Production Verification)

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- DO NOT CHEAT. Forensic auditor check required. Binary veto on integrity violation.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: c949f701-56e6-4b4f-902e-7db29e6ac6b2
- Updated: 2026-09-10T12:04:00Z

## Key Decisions Made
- Discard all previous cute / metal slug code and assets completely per user directive.
- Adhere to PROJECT.md foundational architecture: fixed timestep 60Hz physics, spatial hash grid for 1,000+ enemies, zero-garbage object pooling.
- Milestone M1 passed Gate with 71/71 tests green.
- Milestone M2 passed Gate 2 with 139/139 tests green, Euclidean modulo parallax wrapping across 7 layers.
- Milestone M3 passed Gate 2 with 210/210 tests green, 0/90,000 boundary spawning errors, monotonic moveSpeed scaling, and anti-demotion evolution tracking.
- Proceed to Milestone M4: Playwright 30s+ automated E2E survival test, level-up card selection, zero engine lag/errors, and visual proof screenshots in `artifacts/dark_fantasy/`.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_df_m1_1 | teamwork_preview_explorer | M1 Core Architecture | completed | f819c5d5-7507-490e-a2ae-7c68f06e0314 |
| explorer_df_m1_2 | teamwork_preview_explorer | M1 Player & Progression | completed | 6338b71a-9648-493b-9cb5-f0565b2628bf |
| explorer_df_m1_3 | teamwork_preview_explorer | M1 Tests & Build Harness | completed | 25d4aa49-70ca-444c-a151-020d234fe531 |
| worker_df_m1_1 | teamwork_preview_worker | M1 Implementation & Unit Tests | completed | 554a4e27-b96d-4a2e-826c-185feac9c32f |
| reviewer_df_m1_1 | teamwork_preview_reviewer | M1 Code Review 1 | completed | d41d39a0-ef7a-476c-a838-98dd5397827e |
| reviewer_df_m1_2 | teamwork_preview_reviewer | M1 Code Review 2 | completed | 23c6edb5-707b-4027-bf71-3e3f5eb067bd |
| challenger_df_m1_1 | teamwork_preview_challenger | M1 Horde & Grid Challenge | completed | f77553b8-e7a4-4193-852f-5b7e2c2de30e |
| challenger_df_m1_2 | teamwork_preview_challenger | M1 Player & Progression Challenge | errored (network broken pipe) | f016e8cf-13e6-4328-9ab0-588944712bc7 |
| challenger_df_m1_2_repl | teamwork_preview_challenger | M1 Player & Progression Challenge (Repl) | completed | f8e381b4-a6f5-47c3-b5e3-2ce6cf32e0b1 |
| auditor_df_m1_1 | teamwork_preview_auditor | M1 Forensic Audit | completed | eee761be-9070-4bee-b773-b5092a33b49b |
| explorer_df_m2_1 | teamwork_preview_explorer | M2 Backdrop & Canvas | completed | 3c825a33-0d77-4368-97c6-a6ef85869f85 |
| explorer_df_m2_2 | teamwork_preview_explorer | M2 Sprites & VFX | completed | 7010c8e0-abdd-4ef9-895c-ace5492688fe |
| explorer_df_m2_3 | teamwork_preview_explorer | M2 Gothic HUD | completed | 4f35c459-eefa-4ba3-9c7e-49d902c0992e |
| worker_df_m2_1 | teamwork_preview_worker | M2 Art & Render Implementation | completed | 31441fcc-6241-4662-8e73-0c8889fcc2ec |
| reviewer_df_m2_1 | teamwork_preview_reviewer | M2 Palette & Backdrop Review | completed | 956fec78-81b3-4d23-a721-ff135a883a7a |
| reviewer_df_m2_2 | teamwork_preview_reviewer | M2 Sprites, VFX & HUD Review | completed | 830feb01-812c-4fc5-95a6-96aac47e7ef5 |
| challenger_df_m2_1 | teamwork_preview_challenger | M2 Render Performance Challenge | completed | ccdb779f-6b65-49ed-97c0-e55358480e2e |
| challenger_df_m2_2 | teamwork_preview_challenger | M2 VFX & HUD Challenge | completed | e6f20e91-695b-4710-9896-58039cb6b105 |
| auditor_df_m2_1 | teamwork_preview_auditor | M2 Forensic Audit | completed | f769a474-a6bf-4f9f-8020-41c98848add4 |
| worker_df_m2_remed | teamwork_preview_worker | M2 Parallax Modulo Remediation | completed | 4da60933-e64e-46f6-b852-eb56c29ee7c8 |
| challenger_df_m2_recheck | teamwork_preview_challenger | M2 Parallax Wrapping Re-Check | completed | 61db82d5-2f9b-4537-910c-1175301f892a |
| auditor_df_m2_recheck | teamwork_preview_auditor | M2 Remediation Forensic Audit | completed | 08271249-7a0f-4a61-88ee-b3e5184d9b72 |
| explorer_df_m3_1 | teamwork_preview_explorer | M3 Weapons Architecture | completed | 507171dc-4ade-4aa5-8b1d-34f59368205d |
| explorer_df_m3_2 | teamwork_preview_explorer | M3 Upgrades & Modal | completed | fd59fcca-b62b-47db-9b17-2cd7fc3b22d5 |
| explorer_df_m3_3 | teamwork_preview_explorer | M3 Wave Director & Tests | completed | 51c4bdc0-10a4-4831-8739-2b1918ed0e87 |
| worker_df_m3_1 | teamwork_preview_worker | M3 Arsenal, Upgrades & Director Implementation | completed | 8ab8a3fc-9911-4860-92a6-1c317b2cace4 |
| reviewer_df_m3_1 | teamwork_preview_reviewer | M3 Arsenal Code Review | completed | 41d31799-4d28-4baa-8e1a-38b0821f5e5a |
| reviewer_df_m3_2 | teamwork_preview_reviewer | M3 Upgrades & Director Review | completed | 8d9bf674-a21b-4b47-9ad7-79a89e5a6883 |
| challenger_df_m3_1 | teamwork_preview_challenger | M3 Weapon Simulation Challenge | completed | dbe67b39-c4de-4161-b3fc-5b8caaf1746b |
| challenger_df_m3_2 | teamwork_preview_challenger | M3 Progression & Wave Challenge | completed | 984ec482-3541-47d4-890d-5d8d8eba4b53 |
| auditor_df_m3_1 | teamwork_preview_auditor | M3 Forensic Audit | completed | dd262dc6-b859-4a38-adcb-a56ac2576b6a |
| worker_df_m3_remed | teamwork_preview_worker | M3 Review Remediation | completed | a9388631-aba0-4b33-a6c4-bec2ff9eb622 |
| reviewer_df_m3_recheck_1 | teamwork_preview_reviewer | M3 Reviewer 1 Re-Check | completed | e9cdb260-9e38-40f7-bc1d-9fa8f19d96e3 |
| reviewer_df_m3_recheck_2 | teamwork_preview_reviewer | M3 Reviewer 2 Re-Check | completed | d9a47808-8303-4d13-853d-08c37154b29f |
| auditor_df_m3_recheck | teamwork_preview_auditor | M3 Forensic Auditor Re-Check | completed | 904926a9-4585-4625-b10e-244f4da39e47 |
| explorer_df_m4_1 | teamwork_preview_explorer | M4 Playwright Setup & Lifecycle | completed | 26e0221d-b030-4d53-af56-bd159524e016 |
| explorer_df_m4_2 | teamwork_preview_explorer | M4 Survival Simulation & Level-Up | completed | 372c1c6f-7076-4b9f-8564-bd20ccd5d0f0 |
| explorer_df_m4_3 | teamwork_preview_explorer | M4 Visual Proof & Artifacts | completed | 5b007e64-f9f5-46dc-9639-aa3c90747bad |
| worker_df_m4_1 | teamwork_preview_worker | M4 E2E Implementation Worker | completed | e9218a14-46c1-43f8-96f5-52f101d2a39c |
| reviewer_df_m4_1 | teamwork_preview_reviewer | M4 Playwright & E2E Reviewer | completed | 20355ac5-f1fb-4693-b7a8-3b73e74997bd |
| reviewer_df_m4_2 | teamwork_preview_reviewer | M4 Visual Proof Reviewer | completed | 0cba5b03-bf2f-4505-8ca5-ba843cf14667 |
| challenger_df_m4_1 | teamwork_preview_challenger | M4 Survival Sim Challenger | completed | c7766444-bb2a-4cb7-9972-b8c0564e420d |
| challenger_df_m4_2 | teamwork_preview_challenger | M4 Artifact & Suite Challenger | completed | c671953e-c1a0-4a72-b77d-bdc769005ab6 |
| auditor_df_m4_1 | teamwork_preview_auditor | M4 Forensic Auditor | completed | 9c2ae931-2139-413b-aaff-da3bfadf57f7 |
| worker_df_m4_remed | teamwork_preview_worker | M4 Remediation Worker | errored (quota) | cdd8a8ac-c904-42f6-b86f-b1dd06f7cf29 |
| worker_df_m4_remed_2 | teamwork_preview_worker | M4 Remediation Worker 2 | completed | b2331355-68cf-420f-8748-ef93486e4298 |
| reviewer_df_m4_recheck | teamwork_preview_reviewer | M4 Reviewer Re-Check | completed | aded2979-ef4d-4217-a6a8-35685dd300b4 |
| challenger_df_m4_recheck | teamwork_preview_challenger | M4 Challenger Re-Check | completed | c50da8b5-3496-4d46-a287-40fa35f12c97 |
| auditor_df_m4_recheck | teamwork_preview_auditor | M4 Forensic Auditor Re-Check | completed | a691978a-9fbc-4f3d-8d12-1da1781e289d |
| explorer_df_m4_remed | teamwork_preview_explorer | M4 Remediation Strategy Explorer | completed | f961350f-8bc4-41e8-a97e-afb733e9bb43 |
| worker_df_m4_remed_3 | teamwork_preview_worker | M4 Combat Distance & Port Remediation | completed | 2c35e393-6ab5-458a-9621-81073ec45ac2 |
| reviewer_df_m4_recheck_3 | teamwork_preview_reviewer | M4 Reviewer 1 Re-Check | completed | a20770e8-3f6e-4bb0-955e-e1c7ce39411a |
| reviewer_df_m4_recheck_4 | teamwork_preview_reviewer | M4 Reviewer 2 Re-Check | completed | 19d3207f-2bc5-4152-8d91-ad1700d964d8 |
| challenger_df_m4_recheck_3 | teamwork_preview_challenger | M4 Challenger 1 Re-Check | completed | 05be041b-d5a7-46ca-811c-a53341584fa6 |
| challenger_df_m4_recheck_4 | teamwork_preview_challenger | M4 Challenger 2 Re-Check | errored (network broken pipe) | b36b3df7-afd0-47f3-a95a-4001a3429e1e |
| challenger_df_m4_recheck_4_repl | teamwork_preview_challenger | M4 Challenger 2 Re-Check Repl | completed | 3836b4c4-01c3-4a1d-b16f-2052415b0635 |
| auditor_df_m4_recheck_3 | teamwork_preview_auditor | M4 Forensic Auditor Re-Check 3 | completed | 0d0e86cc-cceb-441d-92e1-27e9dfd98d14 |
| worker_df_m5_deploy | teamwork_preview_worker | M5 Production Deployment & Git Push | in-progress | c7d4594f-dbdb-4064-b4e2-754ed91286e4 |

## Succession Status
- Succession required: no (orchestrator continuing direct milestone progression)
- Spawn count: 58
- Pending subagents: c7d4594f-dbdb-4064-b4e2-754ed91286e4
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 6bab7276-2b23-4494-b27b-d0a93584d82f/task-270
- Safety timer: none

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md — Global architecture, feature inventory, milestones
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md — Claude collaboration guide & swarm blueprint
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md — Verbatim user request record
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_dark_fantasy/progress.md — Liveness & progress tracking
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_dark_fantasy/BRIEFING.md — Persistent working memory
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_dark_fantasy/GATE_STATUS.md — Gate verdicts
