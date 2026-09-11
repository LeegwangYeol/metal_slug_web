# Dispatch Assignment: Phase 0 Explorer (Dynamic Animations & Motion Survey)

- **Role**: teamwork_preview_explorer
- **Assigned Subsystem**: Dynamic Animations & Motion Engine
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Required Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`

## Mission & Objectives
Investigate the current codebase for character and enemy animation mechanics to prepare for Milestone 1 (Dynamic Animations & Motion).
Specific investigation areas:
1. Examine `src/render/DarkFantasySprites.ts`, `src/render/GameRenderer.ts`, and entity loops (`src/core/entities/Player.ts`, `src/core/entities/Enemy.ts`, `src/core/systems/HordeManager.ts`).
2. Identify how character and enemy sprites are currently rendered (transformation matrices, canvas translations, rotations, scale).
3. Determine exact injection points and mathematical formulas for:
   - Squash and stretch during movement direction changes, dashes, and impacts.
   - Dynamic easing curves for movement velocity transitions.
   - Attack wind-up / anticipation and impact follow-through (e.g. Arcane Scythe, Bone Spear, etc.).
   - Multi-phase procedural bobbing/walking cycles for grounded units.
   - Spectral floating/hovering animations for Banshees and Necromancers.
   - Dynamic flinch, scaling recoil, and hit-flash states upon taking damage.
4. Verify compatibility with existing 60Hz fixed timestep simulation and canvas rendering performance.

## Deliverables
- Detailed report in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/analysis.md`
- Self-contained handoff in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/handoff.md`
- Send completion message to parent orchestrator.

## 2026-09-11T06:14:03Z
Execute a comprehensive architectural survey of the animation and motion systems:
1. Examine src/render/DarkFantasySprites.ts, src/render/GameRenderer.ts, and entity logic in src/core/entities/Player.ts, src/core/entities/Enemy.ts, src/core/systems/HordeManager.ts.
2. Analyze current sprite rendering (transformation matrices, scaling, procedural shapes, walk bobs).
3. Formulate concrete implementation specs for:
   - Squash and stretch during movement direction changes, dashes, and impact reactions.
   - Dynamic easing curves for movement velocity transitions.
   - Attack wind-up / anticipation and impact follow-through for weapons (Arcane Scythe, Bone Spear, etc.).
   - Multi-phase procedural bobbing/walking cycles for grounded units.
   - Spectral floating/hovering bob animations for Banshees and Necromancers.
   - Dynamic scaling, rotation, flinch, and hit-flash states on taking damage.
4. Verify performance and mathematical stability at 60Hz.

Write your findings to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/analysis.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/handoff.md

When complete, send a message to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5) summarizing your results and referencing your handoff file.

