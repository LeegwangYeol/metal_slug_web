## 2026-09-10T11:22:15Z
You are Explorer 3 for Milestone M3 (Occult Arsenal, Upgrades & Horde Director) of the Dark Fantasy Horde Survival game ("Grim Harvest: Undead Siege").

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_3
Project Root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Objectives:
1. Read the authoritative files, focusing on wave escalation, horde scaling, and test requirements.
2. Inspect existing codebase:
   - `src/core/HordeManager.ts` and `src/core/entities/EnemyTypes.ts` (spawn APIs, enemy types: Skeleton, Ghoul, Banshee, Death Knight)
   - `src/core/SpatialHashGrid.ts`
   - `tests/unit/` (test harness, mock patterns, vitest headless setup)
3. Design the Escalating Wave Director (`src/core/systems/WaveDirector.ts`):
   - Timeline progression:
     - 0:00 - 0:30 (Phase 1: The Awakening): Sparse Skeletons, slow shamblers.
     - 0:30 - 1:00 (Phase 2: The Swarm): High-density Skeletons + aggressive Ghouls.
     - 1:00 - 2:00 (Phase 3: Nightfall): Banshees (high speed, spectral) + mixed horde.
     - 2:00+ (Phase 4: Abyssal Siege): Imposing Death Knights (armored mini-bosses) + continuous swarms.
   - Spawn mechanics:
     - Perimeter spawns (outside player camera viewport).
     - Burst waves & pincer rushes at milestone intervals.
     - Difficulty scaling: enemy HP, speed, and spawn rate over time.
   - Zero-garbage allocation in update loop.
4. Design the Unit Test Suite for Milestone M3:
   - `tests/unit/Weapons.test.ts`: test all 5 weapons, auto-fire timers, cooldown reduction formula, damage application, pierce limits.
   - `tests/unit/UpgradeSystem.test.ts`: test card generation, inventory slot limits (up to 6 weapons, 6 passives), rank progression 1 to 5, weapon evolutions, stat updates.
   - `tests/unit/WaveDirector.test.ts`: test timeline escalation, spawn rate scaling, enemy type distribution, boss scheduling.
5. Maintain your liveness in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_3/progress.md`.
6. Produce a structured handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_3/handoff.md`.
7. When complete, send a message to parent using send_message. DO NOT write or edit source code files yourself.
