# Dispatch Log

## 2026-09-11T06:13:01Z

You are the Project Orchestrator for the "Grim Harvest: Undead Siege" 40-Agent Swarm Enhancement Mission.

Your working directory is:
/Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_anim_fov_ui

Your authoritative requirements are located at:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

## Explicit Approval Status
Explicit user approval has been verified and recorded: "승인 (허용)". You are authorized to begin immediate execution.

## Requirements
### R1. Dynamic Animations & Motion
Character and enemy animations must feel alive, impactful, and fluid. Implement dynamic motion (e.g., easing curves, squash and stretch during dashes/direction changes, multi-frame procedural animations, attack wind-up/anticipation and follow-through, spectral floating bob, and damage flinch/recoil) in DarkFantasySprites.ts and entity render loops.

### R2. Widen Field of View (FOV)
The camera view is too narrow and zoomed in. Adjust the camera zoom factor / FOV in Camera.ts to reveal a much larger portion of the map, providing the player with superior situational awareness to react to massive enemy hordes. Ensure toroidal backdrop tiling (GothicBackdrop.ts), dynamic radial lighting, and culling/projectile boundaries adapt seamlessly to the expanded FOV.

### R3. Modern UI/HUD Overhaul
Completely redesign the HUD (Health Bar with ornate dark fantasy filigree, Soul-Blue XP bar, Runic Level Badge, Antique Gold Timer/Kill counter) and modernize the Upgrade Selection Menu cards with sleek dark fantasy glassmorphism, glowing rarity borders, custom iconography, and polished hover states.

## Acceptance Criteria
- [ ] Visual Proof (Animations): Playwright screenshots or recorded states demonstrate dynamic scaling, rotation, or sprite changes during gameplay.
- [ ] Visual Proof (FOV & UI): Playwright screenshots (>250KB) clearly demonstrate the significantly widened camera view and the newly polished, modern UI.
- [ ] 100% Green Tests: Unit tests and E2E tests must be updated and pass cleanly without engine crashes.
- [ ] Deployment: Git push to origin/main is verified and Vercel build succeeds.

## Swarm Structure & Milestone Gates (40-Agent Swarm)
You will direct a 40-agent swarm through strict milestone gates:
1. Phase 0: 3 Explorers (Animation survey, Camera/FOV survey, UI/HUD survey). Synthesize findings into PROJECT.md.
2. Milestone 1 (Dynamic Animations & Motion): 1 Worker, 2 Reviewers, 2 Challengers, 1 Forensic Auditor.
3. Milestone 2 (Widen Camera FOV): 1 Worker, 2 Reviewers, 2 Challengers, 1 Forensic Auditor.
4. Milestone 3 (Modern UI/HUD Overhaul): 1 Worker, 2 Reviewers, 2 Challengers, 1 Forensic Auditor.
5. Milestone 4 (Visual Proof & Automated E2E Suite): 1 Worker, 2 Reviewers, 2 Challengers, 1 Forensic Auditor. Assert >250KB screenshots for FOV & UI, and dynamic animation proofs.
6. Milestone 5 (100% Green Tests & Production Deployment): 1 Worker, 2 Reviewers, 2 Challengers, 1 Forensic Auditor. Commit, push to origin/main, verify live Vercel HTTP/2 200.

Maintain progress.md continuously in your working directory so Sentinel crons can track progress. Report completion when all milestones pass gate.
