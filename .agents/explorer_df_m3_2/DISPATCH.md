## 2026-09-10T11:22:15Z

You are Explorer 2 for Milestone M3 (Occult Arsenal, Upgrades & Horde Director) of the Dark Fantasy Horde Survival game ("Grim Harvest: Undead Siege").

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_2
Project Root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Objectives:
1. Read the authoritative files, focusing on rogue-lite boons, upgrade mechanics, level-up choices, and UI requirements.
2. Inspect existing codebase:
   - `src/core/progression/PlayerProgression.ts` (level up event emission and state)
   - `src/core/player/PlayerStats.ts` (stat modifiers: might, speed, armor, recovery, magnet, cdr, etc.)
   - `src/ui/GothicHUD.ts` and `src/main.ts` (input handling, render loop, game loop pause)
3. Design the Upgrade System & Synergies (`src/core/systems/UpgradeSystem.ts`):
   - Pool of upgrade options:
     - Weapon unlocks & rank-ups (Ranks 1–5 for all 5 weapons).
     - 5 Passives (Ranks 1–5):
       - Tome of Might: +10% Damage per rank
       - Ring of Velocity: +10% Move Speed per rank
       - Blood Chalice: +20 Max HP & +0.5 HP/s Regeneration per rank
       - Eldritch Magnet: +25% Pickup Range per rank
       - Obsidian Armor: +1 Armor (Flat damage reduction) per rank
     - 5 Synergistic Weapon Evolutions (unlocked when Weapon is Rank 5 + player possesses corresponding Passive):
       - Arcane Scythe + Blood Chalice = Soul Reaping Harvester
       - Soul Orbiters + Ring of Velocity = Abyssal Vortex
       - Bone Spear + Tome of Might = Ossuary Cataclysm
       - Abyssal Lightning + Eldritch Magnet = Storm of Torment
       - Cursed Aura + Obsidian Armor = Domain of Decay
   - Upgrade Card Generator:
     - Algorithm to select 3 to 4 distinct valid upgrades on level up (never suggesting already maxed items).
     - State tracking for player inventory (active weapons and passives).
4. Design the Gothic Level-Up Modal (`src/ui/UpgradeModal.ts`):
   - Ornate dark fantasy parchment / cracked obsidian card layout rendered on canvas or DOM overlay.
   - 3 to 4 cards displaying icon, item name, current -> new rank pips, description, and exact stat changes.
   - Input handling: Keyboard keys (1, 2, 3, 4) and mouse click / hover.
   - Clean pause / unpause protocol: suspends gameplay simulation while keeping UI responsive, resumes without frame delta spike.
5. Maintain your liveness in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_2/progress.md`.
6. Produce a structured handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_2/handoff.md`.
7. When complete, send a message to parent using send_message. DO NOT write or edit source code files yourself.
