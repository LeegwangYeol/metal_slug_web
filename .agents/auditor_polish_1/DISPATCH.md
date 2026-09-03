# DISPATCH — Forensic Auditor

## Mission
Conduct an exhaustive forensic integrity audit of all work delivered in the Polish Milestone for Metal Slug Web.

## Integrity Forensic Checklist
Verify with ZERO TOLERANCE:
1. Genuine Implementation vs Mock/Facade:
   - Verify that parachute drops, sinusoidal sway, canopy detachment, and ambush leaps use genuine Newtonian/kinematic physics simulation and not hardcoded fake outputs or timer jumps.
   - Verify that death animations use genuine physics integration (ballistic velocity, gravity, rotation, bouncing, particles, alpha fading) and authentic procedural pixel art.
   - Verify that `DeathCorpseManager.ts` genuine logic simulates visual deaths and is not a no-op facade.
2. Anti-Cheating & Source Code Analysis:
   - Check that no test-specific shortcuts, fake passing mocks, or hardcoded return values exist in `src/` to satisfy tests artificially.
   - Inspect git diff or newly added files across `src/` and `tests/`.
3. Asset Authenticity:
   - Verify that all 3 screenshot artifacts in `artifacts/death_animations/` (`death_standard.png`, `death_explosion_blowback.png`, `death_burning.png`) are genuine Playwright browser canvas captures with valid PNG headers and realistic dimensions/sizes (>5KB).
   - Check that screenshots are not dummy static 1x1 pixels or placeholder files.
4. Bug Hunt Report Authenticity:
   - Verify that `BUG_HUNT_REPORT.md` details genuine root causes and real code remediations rather than fabricated claims.
5. Verification Execution:
   - Run:
     - `npm run build`
     - `npm test` (`npx vitest run`)
     - `npm run test:e2e` (`npx playwright test`)
6. Output your binary forensic verdict (`CLEAN` or `INTEGRITY VIOLATION`) with detailed forensic evidence in `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_polish_1/handoff.md`.

MANDATORY: Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/handoff.md` before starting the audit.

## 2026-09-03T15:44:05Z
You are Forensic Auditor Polish.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/auditor_polish_1/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md and /Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/handoff.md before starting. Also read /Users/user/teamwork_projects/metal_slug_web/.agents/auditor_polish_1/DISPATCH.md.

Conduct an exhaustive forensic integrity audit of the Polish Milestone:
1. Genuine Implementation: Check that parachute physics, sinusoidal swaying, ambush leaps, ballistic explosion tumble, flame thrash/charcoal/ash, and DeathCorpseManager are genuine simulations and not facades/mocks.
2. Anti-Cheating: Check that no test-specific bypasses, hardcoded returns, or dummy passes exist in src/.
3. Asset Authenticity: Verify that artifacts/death_animations/ screenshots (death_standard.png, death_explosion_blowback.png, death_burning.png) are genuine Playwright browser canvas captures (>5KB each).
4. Report Authenticity: Verify BUG_HUNT_REPORT.md details genuine code remediations.

Run:
- npm run build
- npm test
- npm run test:e2e

Write your forensic verdict (CLEAN or INTEGRITY VIOLATION) with detailed evidence to /Users/user/teamwork_projects/metal_slug_web/.agents/auditor_polish_1/handoff.md and report to the orchestrator via send_message.

