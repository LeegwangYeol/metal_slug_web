# BRIEFING — 2026-09-10T10:42:45Z

## Mission
Investigate and design the Player Entity and Progression System (physics, stats, XP leveling curve, loot/gem drop & magnetic attraction) for M1 Foundation & High-Performance Core.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m1_2
- Original parent: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Milestone: M1 - Foundation & High-Performance Core

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files (src/**)
- Write handoff report to .agents/explorer_df_m1_2/handoff.md
- Maintain liveness heartbeat in .agents/explorer_df_m1_2/progress.md
- Use send_message to notify parent upon completion

## Current Parent
- Conversation ID: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Updated: 2026-09-10T10:42:45Z

## Investigation State
- **Explored paths**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `COLLABORATION.md`, `src/core/math/Vector2D.ts`, `src/core/physics/AABB.ts`, `src/core/physics/SpatialGrid.ts`, `src/core/player/PlayerController.ts`, `src/core/engine/GameEngine.ts`, `vitest.config.ts`, `tsconfig.json`, peer explorer progress (`explorer_df_m1_1`, `explorer_df_m1_3`).
- **Key findings**:
  1. Complete reboot to Dark Fantasy Horde Survival ("Grim Harvest: Undead Siege"). Old side-scrolling platformer mechanics (jump, crawl, platform drops, ammo guns) must be replaced by 360-degree top-down omnidirectional movement.
  2. Movement Kinematics: Diagonal input normalization, linear approach acceleration (1800 px/s²) and braking friction (2400 px/s²), base speed 200 px/s scaled by `moveSpeed` stat.
  3. Stats Model: 11 core stats (`maxHealth`, `currentHealth`, `healthRegen`, `armor`, `moveSpeed`, `might`, `area`, `projSpeed`, `cooldownReduction`, `magnetRadius`, `luck`). Flat and percentage passive bonuses, CDR capped at 50%.
  4. XP Progression: `XP_required = Math.floor(base * Math.pow(level, 1.5))` with `base = 10`. Supports multi-level bursts without losing overflow XP, level-up event callbacks.
  5. Loot & Magnetism (`LootManager.ts`): Object pooled `LootItem` entities (1500 pool), 6 drop types (Emerald, Ruby, Violet, Chest, Health, Magnet vacuum). Attraction acceleration: starts at 180 px/s, accelerates at 900 px/s² up to 1400 px/s, collection radius 18px. Distance culling & consolidation prevents GC stutter.
  6. Decoupling: Node vitest environment (`environment: 'node'`) and TypeScript strict mode require 100% headless, DOM-free code.
- **Unexplored areas**: None for M1 Player/Progression scope. Fully investigated.

## Key Decisions Made
- Player entity will be located at `src/core/entities/Player.ts` implementing `GameEntity`.
- Loot system will be located at `src/core/systems/LootManager.ts` with zero-allocation pooling.
- Stat modification architecture cleanly separates base stats from modifier deltas.
- Level progression encapsulates level-up event dispatching to seamlessly trigger the M3 upgrade modal.

## Artifact Index
- .agents/explorer_df_m1_2/DISPATCH.md — Task assignment log
- .agents/explorer_df_m1_2/BRIEFING.md — Persistent working memory
- .agents/explorer_df_m1_2/progress.md — Liveness heartbeat and milestone tracking
- .agents/explorer_df_m1_2/handoff.md — Final structured handoff report
