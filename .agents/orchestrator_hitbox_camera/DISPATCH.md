## 2026-09-11T02:16:42Z

<USER_REQUEST>
You are the Project Orchestrator for Grim Harvest: Undead Siege.

## Identity & Workspace
- Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera
- Project Root: /Users/user/teamwork_projects/metal_slug_web
- Requirements source: /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (under ## 2026-09-11T02:13:54Z and ## 2026-09-11T02:16:21Z)
- Claude Collaboration Guide & Blueprint: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Integrity mode: development
- User mandate: Use a very large team of 30 agents. Explicit user approval ("승인") has been granted.

## Mission & Requirements
Execute a focused bug-fix and enhancement task for "Grim Harvest: Undead Siege":
1. **R1. Fix Damage Hitbox/Collision Logic**:
   - Investigate and resolve unfair damage detection.
   - Eliminate arbitrary phantom padding (+15px in `src/main.ts:468`).
   - Calibrate Player hurtbox to tight inner radius (r = 11.0px) matching the visual sorcerer silhouette.
   - Calibrate Horde enemy collision radii to tightly match rendered visual contours (Skeleton r=11, Ghoul r=13, Banshee r=12, Death Knight r=18, Necromancer r=14).
   - Ensure weapon projectiles (Arcane Scythe, Bone Spear, Soul Orbiters, Abyssal Lightning, Cursed Aura) have precise collision radii matching their glowing visual VFX heads.
2. **R2. Fix Camera/Viewing Angle**:
   - Overhaul `src/render/Camera.ts` and camera logic. The current perspective feels weird/jarring because it still uses legacy side-scroller deadzones (35% to 44%), pinning the player on the left and causing severe snapping on direction change.
   - Implement centered omni-directional top-down camera tracking with smooth exponential damping (k = 8.0) and subtle velocity lookahead (<= 40px).
   - Align `GothicBackdrop.ts` parallax scaling to provide a smooth, clear, and comfortable view of the action fitting the dark fantasy horde survival genre.

## Acceptance Criteria
- [ ] Hitbox Verification: Playwright E2E test intentionally dodges enemies and verifies that taking damage only occurs when bounding boxes/sprites mathematically and visually overlap (`tests/e2e/hitbox_dodge.spec.ts`).
- [ ] Camera Verification: Playwright screenshots clearly demonstrate the new, improved camera angle and field of view, ensuring it is no longer jarring (`artifacts/dark_fantasy/improved_camera_angle.png` and `artifacts/dark_fantasy/hitbox_precision_dodge.png`, each strictly >50KB).
- [ ] 100% Green Tests: Unit tests (`npm test`) and E2E tests (`npx playwright test`) must pass cleanly (0 failures).
- [ ] Deployment: Git push to `origin/main` is verified and live Vercel build succeeds (`https://metal-slug-web-lovat.vercel.app` returns HTTP/2 200).

## 30-Agent Swarm Structure
Decompose work across 4 milestones using 30 agents total:
- **Milestone 1 (Agents 1–8)**: Precision Damage Hitbox & Collision Subsystem (zero phantom padding, tight entity hurtboxes, unit test coverage). Gate verification.
- **Milestone 2 (Agents 9–16)**: Camera Overhaul & Cinematic Viewport Engine (centered tracking, smooth damping, velocity lookahead, backdrop alignment). Gate verification.
- **Milestone 3 (Agents 17–24)**: Automated Playwright E2E Suite & Visual Proof (dodge near-miss verification without damage, visual proof screenshots >50KB). Gate verification.
- **Milestone 4 (Agents 25–30)**: 100% Green Test Suite & Production Deployment (unit/E2E test suite green, git push to `origin/main`, live Vercel HTTP/2 200 verification). Gate verification.

## Execution Rules
- Maintain `progress.md` and `BRIEFING.md` in your directory at all times.
- Ensure every milestone has rigorous multi-agent verification (Reviewer, Challenger, Auditor).
- Never claim completion until all acceptance criteria are verified and green.
- Report completion back to Sentinel via send_message when ready for independent victory audit.
</USER_REQUEST>
