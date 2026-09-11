## 2026-09-11T04:31:17Z

You are Worker 4 (Agent 27) for Milestone 4: 100% Green Test Suite & Production Deployment.
Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4
Project root: /Users/user/teamwork_projects/metal_slug_web

Read the following documents before starting:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera/SCOPE.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera/GATE_STATUS.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Deployment Tasks:
Follow the exact 4-phase deployment blueprint provided in explorer_m4_2/handoff.md:

Phase 1: Pre-Flight Verification & Clean Build
1. Run `npx tsc --noEmit` and ensure 0 errors.
2. Run `npm test` and ensure all unit tests pass (488/488).
3. Run `npm run build` to generate the fresh production bundle in `dist/`.
4. Clean up transient test results:
   `rm -rf test-results/`
   `git checkout -- test-results/.last-run.json 2>/dev/null || true`

Phase 2: Git Staging
5. Stage all project files:
   `git add src/ tests/ artifacts/dark_fantasy/ dist/ .agents/ COLLABORATION.md PROJECT.md ORIGINAL_REQUEST.md tsconfig.tsbuildinfo`
6. Verify status with `git status` to ensure `test-results/` is NOT staged.

Phase 3: Git Commit & Remote Push
7. Commit changes:
   `git commit -m "feat(hitbox-camera): calibrate precision damage hitboxes, overhaul centered camera tracking with velocity lookahead, and verify visual proof (Grim Harvest)"`
8. Push to GitHub remote:
   `git push origin main`
   Confirm push exit code is 0 and remote is updated.

Phase 4: Live Vercel Production Verification
9. Verify live deployment:
   - Check CLI or URL status: `npx vercel inspect https://metal-slug-web-lovat.vercel.app`
   - Probe live headers: `curl -I -sS https://metal-slug-web-lovat.vercel.app` (confirm HTTP/2 200)
   - Probe live HTML: `curl -sS https://metal-slug-web-lovat.vercel.app | grep -o 'src="/assets/[^"]*"'`
   - Probe live JS bundle: `curl -I -sS https://metal-slug-web-lovat.vercel.app/assets/index-BsOJa5ji.js` (confirm HTTP/2 200)

10. Document all executed commands, console outputs, git commit hash, and verification results in:
    `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4/handoff.md`.
11. Send a message to the orchestrator when finished.
