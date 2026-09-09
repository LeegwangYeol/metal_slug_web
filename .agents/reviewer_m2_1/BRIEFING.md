# BRIEFING — 2026-09-08T02:44:30Z

## Mission
Perform comprehensive review and adversarial challenge for Milestone M2 (Autonomous Ally NPCs & Diverse Items/Weapons), verifying implementation correctness, edge cases, physics kinematics, and test validity, providing an objective verdict.

## 🔒 My Identity
- Archetype: teamwork_preview_reviewer
- Roles: reviewer, critic
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M2 - Autonomous Ally NPCs & Diverse Items/Weapons
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Check for integrity violations (hardcoded test results, facade implementations, bypassed tasks, fabricated verifications)
- Must execute build and tests independently: `npx tsc --noEmit` and `npx vitest run ...`
- Write comprehensive handoff.md following the 5-component format
- Communicate verdict and summary to parent via send_message

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T02:44:30Z

## Review Scope
- **Files to review**:
  - `src/core/entities/allies/AllyNPC.ts`
  - `src/core/weapons/RocketLauncherWeapon.ts`
  - `src/core/entities/items/ItemPickup.ts`
  - `src/core/entities/pow/PowEntity.ts`
  - `src/core/entities/pow/PrisonerEntity.ts`
  - `tests/unit/allies_system.test.ts`
  - `tests/unit/diverse_weapons_items.test.ts`
  - `tests/unit/pow_system.test.ts`
- **Interface contracts**:
  - `/Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md`
  - `/Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md`
  - `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
  - `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1/handoff.md`
- **Review criteria**:
  - Correctness, physics kinematics, robustness, integrity, absence of regressions, test coverage and quality.

## Review Checklist
- **Items reviewed**:
  - `AllyNPC.ts` — Verified state machine, jump takeoff, target scoring, and ki blast dispatch.
  - `RocketLauncherWeapon.ts` — Verified steering, acceleration, obstacle detonation, blast damage falloff.
  - `ItemPickup.ts` — Verified vertical gravity, platform landing, and bobbing timer.
  - `PowEntity.ts` / `PrisonerEntity.ts` — Verified 6-state machine, loot sampling, ally spawn event, and PrisonerEntity aliases.
  - `tests/unit/allies_system.test.ts` (10 tests) — 100% PASS.
  - `tests/unit/diverse_weapons_items.test.ts` (12 tests) — 100% PASS.
  - `tests/unit/pow_system.test.ts` (3 tests) — 100% PASS.
  - `tests/unit/m2_challenger_stress.test.ts` (17 tests) — 100% PASS.
  - `tests/unit/m2_ally_rocket_empirical_challenge.test.ts` — 4 failures analyzed and traced to concrete logic/boundary defects.
- **Verdict**: REQUEST_CHANGES (3 precise, surgical remediations required)
- **Unverified claims**: Zero unverified claims. All claims empirically tested.

## Attack Surface
- **Hypotheses tested**:
  - Threat priority calculation with multiple boss/minion types: CONFIRMED BUG — `'MID_BOSS_VEHICLE'.includes('BOSS')` matches first branch, dead-coding the mid-boss branch and assigning weight 100 instead of 50.
  - Rocket maximum lifetime boundary at 60Hz: CONFIRMED BUG — IEEE 754 precision `2.5 - 150 * (1/60) = 3.878e-15 > 0` delays detonation to frame 151.
  - Pending player entity resolution: CONFIRMED GAP — `engine.getEntity('player')` in `AllyNPC.update` does not check `entitiesToAdd`, while `findBestTarget` does.
  - Ballistic jump trajectory: CONFIRMED ASYMMETRY — `justJumped` flag skips gravity on frame 0, increasing apex height by ~2.8 px.
- **Vulnerabilities found**: 2 Major findings, 2 Minor findings.
- **Untested angles**: Full long-run browser rendering with canvas assets (deferred to M3/M4).

## Key Decisions Made
- Confirmed zero integrity violations (no cheats, facades, or fabrications).
- Issued REQUEST_CHANGES due to genuine logic bug in target priority scoring and boundary condition issues.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/DISPATCH.md` — Inbound instructions
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/BRIEFING.md` — Situational awareness
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/progress.md` — Heartbeat & execution log
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/handoff.md` — Final review report
