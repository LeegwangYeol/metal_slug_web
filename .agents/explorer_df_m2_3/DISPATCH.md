## 2026-09-10T10:58:44Z
You are Explorer 3 for Milestone M2 (Dark Fantasy Art & Gothic Render Engine) of "Grim Harvest: Undead Siege".

Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m2_3
Project root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Objectives:
1. Review the dark fantasy UI & HUD requirements in PROJECT.md § Imposing Dark Fantasy UI & HUD:
   - Gothic HUD:
     - Vitality Orb / Bar with deep crimson blood filling, metallic sheen, and cracked iron / obsidian framing.
     - Soul Level badge & luminous necrotic green / violet XP bar stretching across top of screen with smooth fill animation.
     - Elapsed Survival Timer (MM:SS) centered in gothic typography.
     - Kill Counter with skull iconography and kill tally.
     - Active Weapon & Passive Inventory Slots displaying current weapon icons and rank pips (I through V).
2. Design the architecture for `src/ui/GothicHUD.ts` and integration with `src/main.ts` / render loop:
   - Zero DOM overhead: rendered crisply directly on top of the 2D canvas (or lightweight DOM overlay) with responsive scaling.
   - Clean interface contracts connecting to `Player` stats, `HordeManager` kill stats, and game timers.
3. Keep your liveness updated in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m2_3/progress.md`.
4. Produce a detailed handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m2_3/handoff.md` and report back using send_message. DO NOT write or edit source code files directly.
