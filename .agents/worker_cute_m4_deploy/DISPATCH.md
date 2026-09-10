# Task Assignment: Milestone M4 — Deployment & Production Verification

**Assigned Agent**: worker_cute_m4_deploy  
**Role**: teamwork_preview_worker  
**Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m4_deploy  
**Project Root**: /Users/user/teamwork_projects/metal_slug_web  
**Parent Orchestrator Conversation ID**: c0a7538f-b163-4fae-9aaa-d9e17ebc0c62  

---

### Objectives
Execute Milestone M4: Autonomous Git Commit, Push to `origin/main`, and Vercel Production Deployment Verification.

1. **Working Tree Assessment**:
   - Inspect git status (`git status`, `git diff --stat`).
   - Ensure no unintended temporary files or secret leaks are tracked.
   - All cute art, novel gameplay code, tests, visual screenshots (`artifacts/cute_reinvention/`), and project docs must be included.

2. **Git Commit**:
   - Stage all modified and untracked project files (`git add -A`). Note: `.agents/` metadata is tracked or ignored as configured.
   - Commit with a clean conventional commit message:
     `feat: autonomous cute shooter reinvention with sugar pop blossom arena and e2e playtesting`

3. **Git Push**:
   - Push to `origin/main` (`git push origin main`).
   - If upstream changes exist, handle rebasing/pulling cleanly.

4. **Vercel Deployment Verification**:
   - Monitor and verify Vercel deployment status using CLI:
     `npx vercel ls metal-slug-web` or `npx vercel ls metal_slug_web`
     Verify until deployment state is `● Ready` (or inspect the latest deployment URL).
   - Verify HTTP 200 and response headers on production URLs:
     `curl -sI https://metal-slug-web-lovat.vercel.app`
     `curl -sI https://metalslugweb.vercel.app`
     Also verify that the response body contains HTML structure with index assets.

5. **Handoff Documentation**:
   - Write comprehensive handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m4_deploy/handoff.md` following standard format (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
   - Send completion message to parent orchestrator via `send_message`.

---

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations and verifications must be genuine. DO NOT fabricate git logs, Vercel outputs, or curl responses. A forensic auditor will independently verify your work.

---

## 2026-09-10T08:27:48Z

You are worker_cute_m4_deploy, assigned to execute Milestone M4: Production Deployment & Live Verification for the Autonomous Cute Shooter Reinvention project.

Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m4_deploy
Project root: /Users/user/teamwork_projects/metal_slug_web
Parent Conversation ID: c0a7538f-b163-4fae-9aaa-d9e17ebc0c62

Read these files first:
1. /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
2. /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
3. /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m4_deploy/DISPATCH.md
4. /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m3_test/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
1. Check git status in project root (/Users/user/teamwork_projects/metal_slug_web). Ensure working tree includes all cute reinvention code, tests, visual artifacts (artifacts/cute_reinvention/*.png), and docs.
2. Stage all relevant files (git add -A).
3. Commit with conventional commit message:
   feat: autonomous cute shooter reinvention with sugar pop blossom arena and e2e playtesting
4. Push commit to remote main: git push origin main. (If any remote changes, git pull --rebase or resolve cleanly).
5. Verify Vercel deployment status:
   - Check with CLI: npx vercel ls metal-slug-web or npx vercel ls metal_slug_web.
   - Verify that deployment reaches '● Ready' status.
   - Verify production domains return HTTP 200:
     curl -sI https://metal-slug-web-lovat.vercel.app
     curl -sI https://metalslugweb.vercel.app
   - Verify HTML content contains proper title and bundle tags.
6. Write detailed handoff report to /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m4_deploy/handoff.md following the standard Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
7. Send completion notification back to caller via send_message(Recipient="c0a7538f-b163-4fae-9aaa-d9e17ebc0c62", Message=...).
