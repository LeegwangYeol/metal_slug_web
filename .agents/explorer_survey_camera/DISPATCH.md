# Dispatch Assignment: Phase 0 Explorer (Camera & Widened FOV Survey)

- **Role**: teamwork_preview_explorer
- **Assigned Subsystem**: Camera & Field of View (FOV) System
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Required Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`

## Mission & Objectives
Investigate the current camera, viewport, backdrop, and boundary systems to prepare for Milestone 2 (Widen Camera FOV).
Specific investigation areas:
1. Examine `src/render/Camera.ts`, `src/render/GameRenderer.ts`, `src/render/GothicBackdrop.ts`, and canvas sizing in `src/main.ts` and `index.html`.
2. Analyze current camera zoom factor, world-to-screen transforms, and viewport calculations.
3. Determine how widening the FOV (decreasing zoom factor to reveal a significantly larger battlefield) affects:
   - Toroidal backdrop tiling and wrapping in `GothicBackdrop.ts` (ensuring no visible tiling gaps, seam artifacts, or unrendered canvas borders).
   - Dynamic radial player torch/spell lighting pass (ensuring light radius and ambient darkness scale appropriately to maintain gothic mood without clipping).
   - Culling logic and off-screen bounds in `HordeManager.ts`, `LootManager.ts`, and weapon projectile systems (ensuring enemies and projectiles do not prematurely despawn or stop rendering within the expanded viewport).
   - Screen shake offsets and interpolation damping.
4. Recommend exact zoom factor / FOV settings and code modifications for seamless camera expansion.

## Deliverables
- Detailed report in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/analysis.md`
- Self-contained handoff in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/handoff.md`
- Send completion message to parent orchestrator.

## 2026-09-11T06:14:03Z

You are explorer_survey_camera, a teamwork_preview_explorer subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/DISPATCH.md

Execute a comprehensive survey of the Camera, FOV, Backdrop, and Viewport systems:
1. Examine src/render/Camera.ts, src/render/GameRenderer.ts, src/render/GothicBackdrop.ts, and canvas sizing in src/main.ts, index.html.
2. Analyze current camera zoom factor, world-to-screen transforms, viewport calculations, and centered tracking.
3. Determine exact adjustments needed to widen the FOV (lower zoom factor / expanded view area) while maintaining crisp visual fidelity.
4. Analyze impact on:
   - Toroidal backdrop tiling and wrapping in GothicBackdrop.ts (seam prevention, tile coverage across expanded viewport).
   - Dynamic radial player torch/spell lighting pass (light radius, darkness gradient scaling).
   - Culling logic and off-screen boundaries in HordeManager.ts, LootManager.ts, and weapon projectile systems.
   - Screen shake and tracking interpolation damping.
5. Provide precise mathematical values, code injection points, and implementation strategy.

Write your findings to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/analysis.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/handoff.md

When complete, send a message to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5) summarizing your results and referencing your handoff file.

