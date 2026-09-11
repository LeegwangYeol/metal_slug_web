# DISPATCH — challenger_m3_ui_2

## Identity
- Subagent Name: `challenger_m3_ui_2`
- TypeName: `teamwork_preview_challenger`
- Working Directory: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_2`
- Parent: Orchestrator (`52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- Milestone: Milestone 3 (Modern Dark Fantasy UI/HUD Overhaul)

## Required Reading
Before starting, you MUST read:
- `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
- `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
- `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern/handoff.md`

## Objective
Adversarially challenge and stress-test the `UpgradeModal` 4-tier rarity engine, input matrix, and procedural icons:
1. Write and execute an adversarial test harness (e.g. in `tests/unit/ChallengerM3_Modal_RarityStress.test.ts` or run existing test suites).
2. Stress test:
   - Rarity distribution: test `getCardRarity()` across 1,000 randomized `UpgradeCard` objects (weapons, passives, evolutions, ranks 1-8). Assert valid key in `RARITY_STYLES` 100% of the time.
   - Dynamic card counts: test modal rendering with 1, 2, 3, 4, and pathological empty `[]` or 5+ cards. Assert no crash or coordinate NaN.
   - Rapid input fuzzing: simulate 10,000 rapid keystrokes (`Digit1..4`, Arrow keys, Enter, Space) while modal opens/closes. Assert zero unhandled exceptions.
   - Mouse hover coordinate mapping: test boundary hits, canvas resize aspect ratio changes, and cursor resets.
   - Procedural skill icons: verify all 10 icon types render without throwing errors on missing context methods.
3. Run `npm test` and verify that all test suites pass 100% green.
4. Formulate gate verdict: **APPROVE** or **REQUEST_CHANGES**.

## Deliverables
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_2/progress.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_ui_2/handoff.md`
Send a completion message back to parent with your verdict and handoff link.
