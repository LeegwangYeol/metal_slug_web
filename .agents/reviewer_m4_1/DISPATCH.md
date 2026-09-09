## 2026-09-08T05:46:56Z
You are a Reviewer subagent (teamwork_preview_reviewer) for Milestone M4 (Playwright E2E Integration & Visual Proof Screenshots).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m4_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Worker M4 Handoff: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1/handoff.md

REVIEW FOCUS:
Review the Playwright E2E implementation in `tests/e2e/ultimate_and_crisis_expansion.spec.ts` and changes to `src/main.ts`:
1. Check that the tests legitimately test:
   - KeyU ultimate move input, 4-phase progression, 100% on-screen minion wipe with 0 friendly fire.
   - Mid-Boss vehicle encounter and Iron Nokana 4-phase crisis triggers (75% artillery, 50% platform collapse, 25% rage overdrive) and 120 HP burst damage.
   - Autonomous Ally NPC (Hyakutaro follow & Ki blast attack) and diverse weapon pickups.
2. Check that all visual screenshots in `artifacts/expansion/` exist, are valid PNG files, and have size > 5,000 bytes.
3. Run verification:
   - `npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts`
   - `npx playwright test`
4. Output an explicit verdict: APPROVE or REQUEST_CHANGES.
5. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m4_1/handoff.md`
   and call `send_message` to parent.
