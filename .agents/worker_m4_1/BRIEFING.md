# BRIEFING — 2026-09-11T03:52:16Z

## Mission
Implement Milestone 4 Playwright E2E verification test suite `tests/e2e/restart_survival.spec.ts` covering death debounce & pristine restart invariants, >=15s autonomous post-restart survival loop, and visual proof screenshot generation (>50KB each).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1
- Original parent: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Milestone: Milestone 4 (Automated E2E Verification & Visual Proof Suite)

## 🔒 Key Constraints
- Exclusive write ownership: `tests/e2e/restart_survival.spec.ts` and `src/main.ts` (only for minor exposure adjustments if needed).
- No cheating: All implementations must be genuine, maintain real state and produce real behavior.
- Test 1: Game Over, Death Debounce (0.5s) & Pristine Restart State Invariants.
- Test 2: Post-Restart Autonomous Survival Loop (>= 15 Continuous Seconds) using 8-directional dynamic window evaluation steering bot.
- Test 3: Visual Proof Screenshots Generation (all 3 artifacts > 50KB in `artifacts/dark_fantasy/`: `enhanced_graphics_swarm.png`, `restart_verified.png`, `occult_vfx_lighting.png`).
- 100% clean test passes: `npm run build`, `npx playwright test tests/e2e/restart_survival.spec.ts`, `npm test`, `npx tsc --noEmit`.

## Current Parent
- Conversation ID: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Updated: not yet

## Task Summary
- **What to build**: Comprehensive Playwright E2E suite `tests/e2e/restart_survival.spec.ts` with 3 core tests + audit test.
- **Success criteria**: All tests pass, 15+ seconds survived post-restart, 0 engine errors, screenshots generated >50KB.
- **Interface contracts**: `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md` and `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`.
- **Code layout**: E2E tests in `tests/e2e/`, artifacts in `artifacts/dark_fantasy/`.

## Key Decisions Made
- Use authentic 8-directional steering bot adapted from `tests/e2e/horde_survival.spec.ts` with carousel kiting orbit ($R=320$px), $H=0.32$s horizon, and Arcane Scythe sweet spot.
- Use deterministic render setup for the 3 visual proof screenshots to eliminate frame jitter while showcasing all graphics overhaul features.
- Provide helper getters/methods if needed in `src/main.ts` for clean test access while preserving existing behavior.

## Artifact Index
- `tests/e2e/restart_survival.spec.ts` — Main E2E test suite for restart lifecycle and survival.
- `artifacts/dark_fantasy/enhanced_graphics_swarm.png` — Visual proof: 4 concentric rings of undead and drop shadows.
- `artifacts/dark_fantasy/restart_verified.png` — Visual proof: active post-restart gameplay and revived HUD.
- `artifacts/dark_fantasy/occult_vfx_lighting.png` — Visual proof: dynamic lighting, scythe arc, lightning, soul motes, decals, mist.
- `.agents/worker_m4_1/handoff.md` — 5-component handoff report.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending implementation
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: 0 violations
- **Tests added/modified**: `tests/e2e/restart_survival.spec.ts`

## Loaded Skills
None
