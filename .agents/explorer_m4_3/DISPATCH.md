## 2026-09-08T05:19:05Z
You are an Explorer subagent (teamwork_preview_explorer) for Milestone M4 (Playwright E2E Integration & Visual Proof Screenshots), replacing a timed-out predecessor.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3
Project root is: /Users/user/teamwork_projects/metal_slug_web

You are READ-ONLY. DO NOT edit or modify source code files.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

YOUR MISSION & FOCUS:
Design the Visual Proof Screenshot capture system:
1. Target directory: `artifacts/expansion/`
2. Required screenshots:
   - `artifacts/expansion/ultimate_strike_pass.png`: Capturing the tactical bomber flyover and screen flash/shadow.
   - `artifacts/expansion/ultimate_detonation_flash.png`: Capturing the screen flash overlay, shockwave rings, and camera shake.
   - `artifacts/expansion/crisis_boss_encounter.png`: Capturing Iron Nokana boss / crisis environmental hazards in action.
   - `artifacts/expansion/ally_pow_rescue.png`: Capturing POW rescue / Ally Hyakutaro combat.
3. Ensure directory creation (`mkdir -p artifacts/expansion/`) and proper Playwright screenshot options (`path: ...`).
4. Detail how to capture frames during the exact visual phases (e.g. timing after KeyU press).
5. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/handoff.md`
   and call `send_message` to parent.
