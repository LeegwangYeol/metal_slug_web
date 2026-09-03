# DISPATCH — Explorer Polish 3

## Mission
Investigate the test suite, autonomous playtest harness, bug hunt scope, and visual screenshot verification (R3, Acceptance Criteria).

## Scope & Instructions
1. Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`.
2. Inspect the current test suite and test configs:
   - `package.json`, `vitest.config.ts`, `playwright.config.ts`
   - `tests/unit/` and `tests/e2e/`
   - `artifacts/`
3. Audit the current codebase for bugs, glitches, edge cases, collision anomalies, audio/HUD issues, or weapon balance problems.
4. Detail the plan for:
   - Autonomous playtest sweep and hunting down remaining bugs across the game.
   - Outlining the structure of `BUG_HUNT_REPORT.md`.
   - Creating E2E Playwright test harness for capturing screenshots into `artifacts/death_animations/`:
     - `death_standard.png`
     - `death_explosion_blowback.png`
     - `death_burning.png`
   - Designing unit and E2E tests for diverse spawning (parachute spawn Y < 50, descent velocity, trigger coordinates).
5. Write your comprehensive report to `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/handoff.md`.

## 2026-09-03T15:14:18Z

You are Explorer Polish 3.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md and /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/DISPATCH.md before starting work. Do NOT skip this.

Your mission:
Investigate the test suite, autonomous playtest harness, bug hunt scope, and visual screenshot verification (R3, Acceptance Criteria):
- Examine tests/ (unit, e2e), package.json, vitest.config.ts, playwright.config.ts, and artifacts/.
- Proactively audit existing codebase for bugs, glitches, collision anomalies, audio/HUD issues, or weapon balance problems.
- Detail the test architecture for:
  1. Playwright screenshot verification capturing artifacts/death_animations/ (death_standard.png, death_explosion_blowback.png, death_burning.png).
  2. Vitest & Playwright tests for diverse spawning (parachute spawn Y < 50, descent velocity, trigger coordinates).
  3. Plan and structure for BUG_HUNT_REPORT.md based on code inspection and playtest findings.

Produce your detailed analysis and handoff report in:
/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/handoff.md

Remember to maintain progress.md in your working directory with 'Last visited: [timestamp]'.
When complete, notify the orchestrator via send_message with your handoff summary and report path.
