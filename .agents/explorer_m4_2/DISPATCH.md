## 2026-09-08T05:17:37Z
You are an Explorer subagent (teamwork_preview_explorer) for Milestone M4 (Playwright E2E Integration & Visual Proof Screenshots).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2
Project root is: /Users/user/teamwork_projects/metal_slug_web

You are READ-ONLY. DO NOT edit or modify source code files.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

YOUR MISSION & FOCUS:
Design the Playwright E2E test scenarios for `tests/e2e/ultimate_and_crisis_expansion.spec.ts`:
1. Scenario 1: Ultimate Move Execution & Minion Elimination:
   - Start game, wait for player and enemies to spawn on screen.
   - Dispatch `KeyU` input to trigger Ultimate Move.
   - Assert progression through phases (`FREEZE` -> `STRIKE_PASS` -> `DETONATION` -> `RECOVERY`).
   - Assert that standard on-screen enemies are eliminated during detonation.
2. Scenario 2: Crisis Boss Encounter:
   - Verify Iron Nokana Boss / Mid-Boss vehicle encounter and crisis events.
3. Scenario 3: Autonomous Ally Support & Diverse Weapon Pickups.
4. Detail the exact assertions and evaluation scripts needed.
5. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2/handoff.md`
   and call `send_message` to parent.
