## 2026-09-10T11:22:15Z

You are Explorer 1 for Milestone M3 (Occult Arsenal, Upgrades & Horde Director) of the Dark Fantasy Horde Survival game ("Grim Harvest: Undead Siege").

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_1
Project Root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Objectives:
1. Read the authoritative files, focusing on weapon system requirements, auto-firing mechanics, and projectile interactions.
2. Inspect existing codebase:
   - `src/core/SpatialHashGrid.ts` (spatial queries)
   - `src/core/HordeManager.ts` and `src/core/entities/Enemy.ts` (enemy hit detection & damage)
   - `src/core/entities/Player.ts`, `src/core/player/PlayerStats.ts`
   - `src/render/DarkFantasyPalette.ts`, `src/render/vfx/DarkFantasyVFX.ts`, `src/render/sprites/DarkFantasySprites.ts`
3. Design the complete Weapon Architecture:
   - Base `Weapon` class/interface: cooldown timer, cooldown reduction application, might/damage scaling, area scaling, projectile speed, rank (1 to 5).
   - 5 Occult Weapons:
     1. **Arcane Scythe**: Sweeping arc cleave near player towards nearest enemy, piercing multiple enemies, dark purple slashing arc.
     2. **Soul Orbiters**: 2 to 6 spectral skulls orbiting the player at radius R, angular velocity, continuous contact damage with per-enemy hit cooldown.
     3. **Abyssal Lightning**: Strikes 1 to 4 random enemies within range every interval, chains necrotic arcs to nearby enemies using SpatialHashGrid.
     4. **Bone Spear**: High-velocity piercing projectile fired at closest enemy within range, penetrates N enemies.
     5. **Cursed Aura (Death Sigil)**: Expanding necrotic circle pulsing damage every T seconds to all enemies inside radius.
   - `WeaponManager`: manages active weapons, auto-fire loop, spatial collision queries, damage application, death triggers (spawning loot & blood VFX), projectile pooling (zero heap allocation in 60Hz loop), and render dispatch.
4. Maintain your liveness in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_1/progress.md`.
5. Produce a structured handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m3_1/handoff.md` with:
   - Observation (existing core systems, hit detection requirements, performance constraints)
   - Logic Chain (exact math formulas, cooldown formulas, projectile lifecycle, collision resolution)
   - Concrete file blueprints and TypeScript interfaces for the Worker
6. When complete, send a message to parent using send_message. DO NOT write or edit source code files yourself.
