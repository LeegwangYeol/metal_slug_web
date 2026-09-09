## 2026-09-08T05:57:52Z

You are the Final Forensic Victory Auditor subagent (teamwork_preview_auditor) for Milestone M5.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/auditor_m5_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

AUDIT FOCUS & FINAL FORENSIC CERTIFICATION:
Perform a comprehensive forensic integrity audit across the ENTIRE repository and all expansion commits/changes:
1. Run `git status` and `git diff` across all modified files in `src/`, `tests/`, and `artifacts/`.
2. Check for ANY cheating, hardcoded test results, fake return values, mock bypasses, dummy facades, or skipped assertions.
3. Confirm that all gameplay systems (Boss encounters, Crisis events, Ally NPCs, Weapons/Pickups, Ultimate Move, Audio, Rendering, and E2E tests) represent genuine, authentic engineering.
4. Verify baseline 164-key sprite invariant in `ProceduralSpriteFactory`.
5. Run full verification commands:
   - `npm run build`
   - `npx vitest run`
   - `npx playwright test`
6. Output a binary audit verdict: CLEAN or INTEGRITY VIOLATION.
7. Write your complete final forensic victory audit report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_m5_1/handoff.md`
   and call `send_message` to parent.
