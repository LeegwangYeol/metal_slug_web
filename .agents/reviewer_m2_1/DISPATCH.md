# Dispatch Assignment: Milestone 2 Reviewer 1 (Camera FOV & Viewport Math)

- **Role**: teamwork_preview_reviewer
- **Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Mandatory Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/handoff.md`

## Review Mission & Objectives
Perform an independent, objective review of Milestone 2 changes:
1. Inspect code modifications in:
   - `src/render/Camera.ts`
   - `src/main.ts`
   - `src/core/systems/WaveDirector.ts`
   - `src/render/vfx/DarkFantasyVFX.ts`
   - `src/render/GothicBackdrop.ts`
   - `tests/unit/camera_tracking.spec.ts`
2. Run build and tests:
   - `npm run build`
   - `npm test`
3. Verify:
   - FOV Math & Coordinate Transforms: Camera zoom $Z = 0.80$, `viewWidth = 1200`, `viewHeight = 675` (+56.25% battlefield view). Verify bijective round-tripping between `worldToScreen` and `screenToWorld`.
   - Render Isolation: Confirm world render passes 1–10 are scaled by `camera.zoom` inside `ctx.save()/restore()`, and passes 11 (HUD) & 12 (Modal) render 1:1 on 960x540 canvas without distortion. Confirm `GothicHUD.ts` and `UpgradeModal.ts` were strictly NOT touched.
   - Culling & Spawner Margins: Confirm entity/loot culling bounds and `WaveDirector.spawnRingSurround` radius ($\ge 800\text{px}$) prevent premature disappearance and on-screen enemy pop-in.
4. Output your verdict: **APPROVE** or **REQUEST_CHANGES** with clear rationale and evidence.

Write your report to:
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/progress.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/handoff.md`

Report completion to parent orchestrator.
