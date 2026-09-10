# BRIEFING — 2026-09-10T15:32:00Z

## Mission
Investigate Milestone 1 (Restart State Engine & Lifecycle Architecture) with focus on Player, HordeManager, SpatialHashGrid, and LootManager reset mechanics.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase Researcher / Explorer
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2
- Original parent: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Milestone: Milestone 1 - Restart State Engine & Lifecycle Architecture

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify source code files
- Recommend concrete fix and implementation strategies
- Communicate all reports/results to parent via send_message
- Follow 5-Component Handoff Protocol in handoff.md

## Current Parent
- Conversation ID: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Updated: 2026-09-10T15:32:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `COLLABORATION.md`, `PROJECT.md`
  - `src/core/entities/Player.ts`
  - `src/core/player/PlayerStats.ts`, `src/core/progression/PlayerProgression.ts`
  - `src/core/HordeManager.ts`
  - `src/core/entities/Enemy.ts`, `src/core/entities/EnemyTypes.ts`
  - `src/core/SpatialHashGrid.ts`
  - `src/core/systems/LootManager.ts`
  - `src/core/weapons/WeaponManager.ts`, `src/core/systems/UpgradeSystem.ts`
  - `src/core/systems/WaveDirector.ts`
  - `src/core/engine/GameEngine.ts`
  - `src/render/Camera.ts`, `src/render/vfx/DarkFantasyVFX.ts`
  - `src/ui/GothicHUD.ts`, `src/ui/UpgradeModal.ts`
  - `src/main.ts`
  - `tests/unit/*.ts` and `tests/e2e/*.ts`
- **Key findings**:
  1. `Player.ts` lacks any `reset()` method; `progression.reset()` resets XP but leaves listeners intact; mutated stats persist unless re-initialized.
  2. `HordeManager.ts` current `clear()` calls `despawn()`, which increments `totalKilled++` during cleanup and fails to reset `totalSpawned` and `totalKilled` to 0. Shuffled freeIndices and dirty entity state linger.
  3. `SpatialHashGrid.ts` `clear()` clears buckets (`cellHeads` and `entityNext` to -1), but leaves `entityX` and `entityY` caches un-zeroed.
  4. `LootManager.ts` `clear()` recycles active items but does not reset `nextId`, leaves kinematic properties dirty on pooled items, and does not enforce strict pool size invariants.
  5. `GrimHarvestGame` in `main.ts` completely lacks `restart()`, has no Spacebar/Click listener for resurrection, and duplicate RAF loops explode accumulators if re-instantiated.
- **Unexplored areas**: None within Milestone 1 scope; all 4 target systems and their lifecycle caller have been thoroughly mapped.

## Key Decisions Made
- Recommend in-place `reset()` methods on `Player`, `HordeManager`, `SpatialHashGrid`, and `LootManager`.
- In-place reset preserves object references across `WeaponManager`, `UpgradeSystem`, and HUD, eliminating stale pointer and listener re-wiring hazards.
- Specify exact implementation of `GrimHarvestGame.restart()` with clean RAF teardown, clock reset, modal closure, initial swarm respawn, and resurrection event listeners.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2/DISPATCH.md — Incoming mission dispatch log
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2/progress.md — Progress log and liveness heartbeat
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2/handoff.md — Final 5-component handoff report
