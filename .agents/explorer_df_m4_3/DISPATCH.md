## 2026-09-10T12:04:48Z

You are Explorer 3 for Milestone M4 (Automated E2E Playtesting & Hardening) of "Grim Harvest: Undead Siege".

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_3
Project Root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Objectives:
1. Read the authoritative files, focusing on the visual proof screenshots required in `artifacts/dark_fantasy/`.
2. Inspect existing visual systems:
   - `src/render/GothicBackdrop.ts` (parallax layers, blood moon, gothic ruins).
   - `src/render/sprites/DarkFantasySprites.ts` (sorcerer, skeletons, ghouls, banshees, death knights).
   - `src/render/vfx/DarkFantasyVFX.ts` (weapon VFX, particles, blood splatter, souls).
   - `src/ui/UpgradeModal.ts` (canvas-rendered obsidian cards, gold filigree, rank pips).
   - `src/ui/GothicHUD.ts` (cracked iron blood bar, XP bar, skull counter, survival timer).
3. Design the Automated Screenshot Protocol in Playwright:
   - Target Artifacts:
     1. `artifacts/dark_fantasy/horde_swarm.png`: Overwhelming undead swarms surrounding the player against gothic backdrop.
     2. `artifacts/dark_fantasy/level_up_modal.png`: Gothic card selection modal displaying 3-4 obsidian boon cards with gold filigree and rank pips.
     3. `artifacts/dark_fantasy/survival_gameplay.png`: Active spell VFX (slashing Arcane Scythe, orbiting spectral skulls, Abyssal Lightning arcs, Bone Spear trails, and Cursed Aura pulses).
   - Precise timing, conditions, and assertions (file existence, byte size > 50KB).
4. Maintain your liveness in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_3/progress.md`.
5. Produce a structured handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_3/handoff.md`.
6. When complete, send a message to parent using send_message. DO NOT write or edit source code files yourself.
