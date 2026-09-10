# Task Assignment: Milestone M4 & Victory Audit (Replacement)

**Assigned Agent**: auditor_cute_m4_deploy_2  
**Role**: teamwork_preview_auditor (Forensic Integrity & Victory Auditor)  
**Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/auditor_cute_m4_deploy_2  
**Project Root**: /Users/user/teamwork_projects/metal_slug_web  
**Parent Orchestrator Conversation ID**: c0a7538f-b163-4fae-9aaa-d9e17ebc0c62  

---

### Objectives
Perform independent, adversarial forensic integrity audit of Milestone M4 (Deployment & Production Verification) and the overall Cute Shooter Reinvention project:

1. **Verify Git & Production Deployment Authenticity**:
   - Check `git log -n 1 --stat` and `git status` in project root. Ensure working tree is clean and latest commit is on `origin/main`.
   - Probe live production endpoints:
     `curl -sI https://metal-slug-web-lovat.vercel.app`
     `curl -sI https://metalslugweb.vercel.app`
     Verify `HTTP/2 200` and inspect the returned HTML structure and JS bundle.
   - Check Vercel deployment status via `npx vercel ls metal-slug-web`.

2. **Verify Visual Artifact Integrity**:
   - Inspect `artifacts/cute_reinvention/*.png`.
   - Assert all 4 PNG files exist, are valid 960x540 PNGs with proper headers, and file sizes > 50,000 bytes.

3. **Verify Build & Test Integrity**:
   - Run `npm run build` and verify exit code 0.
   - Run `npm test` and verify 48/48 test files and 686 tests green.
   - Verify there are no hardcoded mocks, false assertions, or dummy facades.

4. **Verdict & Handoff**:
   - Deliver binary verdict: `CLEAN` or `INTEGRITY VIOLATION`.
   - Write comprehensive report to `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_cute_m4_deploy_2/handoff.md`.
   - Send completion message to parent orchestrator.
