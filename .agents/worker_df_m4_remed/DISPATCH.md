## 2026-09-10T12:35:56Z

You are the M4 Remediation Worker (`worker_df_m4_remed`) for "Grim Harvest: Undead Siege".

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_remed
Project root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Reviewer & Challenger Defect Reports (READ THESE CAREFULLY):
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_df_m4_1/handoff.md (Detailed failure analysis: gem attraction guard, premature loop break, 75% flakiness)
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_df_m4_2/handoff.md (Detailed failure analysis: cancelling repulsion vectors, zombie processes on port 4173, GPU crash)
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m4_1/handoff.md (Reviewer 1 findings: potential field entrapment, 60ms CDP polling saturation)
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m4_2/handoff.md (Reviewer 2 findings: CDP pipe saturation, ChallengerDF_M2 cold-start timing threshold)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone M4 Remediation:
1. Fix Player Bot Steering & Evasion in `tests/e2e/horde_survival.spec.ts`:
   - **Eliminate Symmetrical Entrapment & Stalling**: When surrounded by horde enemies, repulsion vectors must NOT cancel to zero. If net vector magnitude is small, enforce a strong tangential / perpendicular evasion velocity (e.g. +90° or -90° from the dense cluster) to break out of encirclements. The bot must NEVER release all movement keys and stall.
   - **Fix Gem Attraction**: Relax the `if (closeEnemies < 2)` restriction! The player has a 100px magnet radius. When soul shards are nearby, incorporate a weighted attraction vector toward gems that steers the player through gem clusters as long as safety distance (>35px) is respected, ensuring the player deterministically collects >= 10 XP and reaches Level 2 within 15–20 seconds.
   - **Loop Level-Up Guarantee**: In Test 1, do NOT break the loop at exactly 30.5s if Level 2 has not yet been reached; allow the loop to run up to 40–45s if needed, or ensure the steering collects gems so reliably that Level 2 is always reached before 25s.
2. Fix CDP Pipe Saturation & GPU Crashes:
   - In `tests/e2e/horde_survival.spec.ts`, throttle the evaluate / input polling interval from 60ms to 120ms–150ms. This cuts CDP traffic by more than 50% (~200 round-trips over 30s instead of ~1,000), completely eliminating Chromium GPU process and network service crashes (`exit_code=15`) under software rendering on macOS.
   - In `playwright.config.ts`, add launch options to chromium project: `args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']`.
3. Clean Up Stale WebServer Processes:
   - Ensure `playwright.config.ts` handles clean process shutdown. In your test execution script or setup, kill any stale processes listening on port 4173 (`lsof -ti :4173 | xargs kill -9 2>/dev/null || true`).
4. Relax Cold-Start Timing Threshold in `tests/unit/ChallengerDF_M2.test.ts:188`:
   - Warm up the render loop with a few iterations or adjust threshold from `12.0ms` to `20.0ms` so that cold un-cached CPU JIT compiles do not fail.
5. Verify 100% Deterministic Green Test Stability:
   - Run `npx tsc --noEmit` (0 errors)
   - Run `npm test` (all 18 unit test files pass 100% green)
   - Run `npm run build` (clean build)
   - Run `npx playwright test` at least **3 consecutive times** and verify that ALL 3 runs pass 100% green (9/9 passed, 0 failures, 0 timeouts).
   - Verify that all 3 artifacts in `artifacts/dark_fantasy/` exist and are strictly > 50 KB.
6. Keep your liveness updated in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_remed/progress.md`.
7. Write a comprehensive handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_remed/handoff.md` and report back using send_message.
