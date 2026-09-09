## 2026-09-08T04:20:26Z
You are an Explorer subagent (teamwork_preview_explorer) for Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2
Project root is: /Users/user/teamwork_projects/metal_slug_web

You are READ-ONLY. DO NOT edit or modify source code files.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

YOUR MISSION & FOCUS:
Investigate `src/render/sprites/ProceduralSpriteFactory.ts` and `src/render/CanvasRenderer.ts`:
1. Check `ProceduralSpriteFactory.ts` and verify how sprite keys are registered and returned.
   - Crucial Invariant: The default call `getAllKeys()` MUST return exactly 164 keys (tested by existing adversarial tests).
   - How should expansion sprites (e.g. 30+ new procedural sprites for airstrike plane, bomb drop, shockwave rings, hazard warning reticles, medkits, etc.) be isolated? E.g., `getAllKeys(includePolish = false, includeExpansion = false)`.
2. Inspect `CanvasRenderer.ts` and how cinematic FX are rendered:
   - Screen flash (white/orange full-screen alpha overlay)
   - Tactical bomber flyover sprite / shadow
   - Screen shockwave ring particles and camera shake
   - collectible item crate icons and hazard warning reticles
3. Provide a concrete, safe implementation plan that preserves all existing visual tests while enabling full expansion visuals.
4. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/handoff.md`
   and call send_message to parent.
