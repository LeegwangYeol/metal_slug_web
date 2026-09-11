# DISPATCH — challenger_m3_ui_1

## Identity
- Subagent Name: `challenger_m3_ui_1`
- TypeName: `teamwork_preview_challenger`
- Working Directory: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_1`
- Parent: Orchestrator (`52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- Milestone: Milestone 3 (Modern Dark Fantasy UI/HUD Overhaul)

## Required Reading
Before starting, you MUST read:
- `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
- `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
- `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern/handoff.md`

## Objective
Adversarially challenge and stress-test the overhauled `GothicHUD` and rendering logic:
1. Write and execute an adversarial test harness (e.g. in `tests/unit/ChallengerM3_HUD_Stress.test.ts` or run existing test suites).
2. Stress test:
   - Health extremes: HP = 0, HP = 1, HP > 10,000, negative HP, NaN HP. Assert 0 crashes or visual overflow.
   - Ghost health damage drain under 10,000 randomized damage pulses: verify non-negative drain, monotonic decay, and delay timing invariance.
   - XP bar fill and soul spark orb under extreme XP values: XP = 0, rapid level-up burst (e.g. level 1 -> 50 in 1 frame), negative XP resistance.
   - Kill counter punch animation and skull eye rendering under extreme kill counts (0 to 1,000,000 kills) and rapid increments.
   - Timer formatting under extreme elapsed seconds (0s, 3599s, 100,000s).
3. Run `npm test` and verify that all test suites pass 100% green.
4. Formulate gate verdict: **APPROVE** or **REQUEST_CHANGES**.

## Deliverables
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_1/progress.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_1/handoff.md`
Send a completion message back to parent with your verdict and handoff link.

## 2026-09-11T07:16:59Z
Received task from parent (52278ce8-fed5-44e0-ad05-d44362fee9a5):
Adversarially challenge and stress-test the overhauled GothicHUD and rendering logic.

