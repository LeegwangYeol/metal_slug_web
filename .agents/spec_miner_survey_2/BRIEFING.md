# BRIEFING — 2026-09-03T03:13:45Z

## Mission
Mine authoritative and mathematically precise technical specifications for R1 (Core Mechanics & Engine) and R2 (Weapons & Combat) for Full Metal Slug.

## 🔒 My Identity
- Archetype: spec_miner
- Roles: Specification Miner, Domain Specialist
- Working directory: /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/
- Original parent: 084b764e-0b87-4c6e-b6aa-67ece754bc64
- Milestone: Phase 0 Survey & Scope Mapping

## 🔒 Key Constraints
- Do NOT implement anything in production code — read-only spec miner.
- Discover and probe authoritative specifications thoroughly without skipping obscure edge cases.
- Provide precise TypeScript interfaces, state machine definitions, and mathematical models for R1 and R2.
- Write report to /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/handoff.md.
- Communicate completion to parent orchestrator via send_message.

## Current Parent
- Conversation ID: 084b764e-0b87-4c6e-b6aa-67ece754bc64
- Updated: 2026-09-03T03:13:45Z

## Task Summary
- **What to build**: Comprehensive technical specifications for R1 (8-way aiming, player physics, jump/gravity, semi-solid platforms, melee vs ranged matrix) and R2 (Handgun, HMG, Flame Shot, Grenade, ammo depletion/fallback, POW rescue & item drop table).
- **Success criteria**: Complete mathematical formulas, state machine tables, edge case matrices, and TypeScript type signatures ready for direct implementation by downstream workers.
- **Interface contracts**: COLLABORATION.md & ORIGINAL_REQUEST.md
- **Code layout**: Pure decoupled simulation engine in src/core/

## Key Decisions Made
- Adopted 60 FPS tick-based physics with fixed timestep dt = 1/60 (~0.01667s) with integer/sub-pixel coordinate modeling.
- Specified authentic arcade constants: run speed (132 px/s), crawl speed (54 px/s), jump impulse (-348 px/s), gravity (+720 px/s^2), jump cut ratio (0.45).
- Established 8-way aiming vector table with ground-vs-air rules (down aiming translates to crouch forward on ground; down aiming in air shoots vertically down).
- Modeled HMG continuous angle sweep (omega = 12 rad/s) and stochastic dispersion (+/- 0.045 rad).
- Modeled Flame Shot expanding circle (10px to 36px), piercing multi-hit tick immunity (6 frames), and ground residue fire AOE.
- Modeled Grenade restitution bounce (ey = 0.5, ex = 0.7), fuse timer (1.25s), and 52px blast radius falloff.
- Modeled 6-state POW state machine and weighted loot drop table.

## Artifact Index
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md — Technical specification report for R1 and R2.
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/handoff.md — 5-component handoff report.
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/progress.md — Liveness heartbeat.

## Loaded Skills
- None explicitly assigned.
