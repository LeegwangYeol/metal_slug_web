## 2026-09-08T03:04:02Z

You are an Explorer subagent (teamwork_preview_explorer) for Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3
Project root is: /Users/user/teamwork_projects/metal_slug_web

You are READ-ONLY. DO NOT edit or modify source code files.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

YOUR MISSION & FOCUS:
Investigate audio synthesis and unit test specifications for Milestone M3:
1. Inspect `src/audio/SoundEngine.ts`:
   - How are Web Audio procedural sound effects synthesized (e.g., siren, explosion shockwave, hydraulic hiss, ki blast)?
   - What methods exist and what needs to be added for the Ultimate Move siren, flyover roar, and apocalyptic blast?
2. Design the comprehensive unit test suite: `tests/unit/ultimate_move_system.test.ts`:
   - Activation on dedicated KeyU input and stock/cooldown management
   - 4-phase state progression (freeze -> strike -> detonation -> recovery)
   - 100% elimination of on-screen minions (viewport bounding box)
   - 120 HP burst damage to bosses
   - Off-screen minion preservation (enemies outside viewport remain untouched)
   - Zero friendly fire against player or allies
   - Preservation of 164 baseline sprite key invariant
3. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/handoff.md`
   and call send_message to parent.
