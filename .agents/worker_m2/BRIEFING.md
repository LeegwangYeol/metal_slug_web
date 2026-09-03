# BRIEFING — 2026-09-03T06:32:00Z

## Mission
Overhaul R1: Implement smooth out-of-bounds enemy spawning and clean off-screen despawning in StageManager.ts, SoldierEnemy.ts, and main.ts.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/src/fullmetalslug/.agents/worker_m2/
- Original parent: 084b764e-0b87-4c6e-b6aa-67ece754bc64
- Milestone: M2
- Current parent: 390e9a3c-c60d-42f9-80ff-35ac81372992 (Overhaul Swarm)

## 🔒 Key Constraints
- File Write Ownership exclusively:
  - src/core/player/PlayerKinematics.ts
  - src/core/player/PlayerController.ts
  - src/core/weapons/WeaponTypes.ts
  - src/core/weapons/WeaponManager.ts
  - src/core/weapons/ProjectileManager.ts
  - src/core/weapons/Grenade.ts
  - src/core/entities/pow/PowEntity.ts
- Also allowed to create/modify tests in tests/unit/ to verify functionality.
- 100% decoupled simulation core (no DOM/Window/Canvas in src/core/).
- Run speed 132 px/s, crawl speed 54 px/s, jump impulse -348 px/s, gravity +720 px/s², jump cut ratio 0.45.
- Standing (24x40) and crouching (24x22) AABBs.
- Forward knife scan box: 38px forward, 6px rear, [-34, +10]px vertical, 3.0 damage, active frames 5-9.
- PISTOL: infinite ammo, semi-auto, max 4 on-screen, 660 px/s.
- HMG: 200 rounds, 15 shots/s, 12 rad/s sweep, ±2.5° spray, brass casings.
- FLAME_SHOT: 30 fuel, expanding 10->36px, piercing multi-hit (6f immunity per target), ground burning AOE.
- GRENADE: Parabolic, bounce restitution (ey=0.5, ex=0.7), 52px blast radius AOE.
- Ammo depletion auto-fallback to PISTOL.
- POW 6-state machine: TIED_UP -> FREED -> SALUTE -> OFFERING_ITEM -> ESCAPING -> SAVED + weighted loot table.
- Mandatory integrity: Genuine implementations, real state and behavior.
- Overhaul M2 Exclusive File Ownership:
  - src/core/engine/StageManager.ts
  - src/core/entities/enemies/SoldierEnemy.ts
  - src/main.ts (spawn triggers & stage manager update loop)
- Never spawn enemies inside visible screen ([cameraX, cameraX + viewportWidth]).
- Minions entering from right: X_spawn = cameraX + viewportWidth + 40 (cameraX + 520), staggered by +40px.
- Smooth ingress: vx = -110 px/s until x <= cameraX + 460, then transition to normal patrol/combat AI.
- Despawn offscreen minions: x < cameraX - 180 or y > 320.
- All tests must pass 100% green.

## Current Parent
- Conversation ID: 390e9a3c-c60d-42f9-80ff-35ac81372992
- Updated: 2026-09-03T06:32:00Z

## Task Summary
- **What to build**: Smooth out-of-bounds enemy spawn and despawn logic across StageManager, SoldierEnemy, and main.ts.
- **Success criteria**: StageManager passes cameraX to spawnAction and despawns offscreen/fallen enemies; SoldierEnemy runs in at -110 px/s until entering viewport; main.ts spawn triggers use out-of-bounds coords; 100% tests green.
- **Interface contracts**: PROJECT.md, COLLABORATION.md, DISPATCH.md
- **Code layout**: src/core/engine/StageManager.ts, src/core/entities/enemies/SoldierEnemy.ts, src/main.ts

## Key Decisions Made
- Implemented pure headless kinematics in `PlayerKinematics.ts` with accurate 8-way directional unit vectors and strict airborne-only downward shooting.
- Embedded melee arbitration in `PlayerController.ts` scanning 38px forward, 6px rear, [-34, +10]px vertical, allocating knife slash state (3.0 damage, active frames 5-9) while cleanly suppressing bullet firing.
- WeaponManager & ProjectileManager implement full HMG 12 rad/s sweep with ±2.5° dispersion, brass casing ejection simulation with parabolic bounce, and Flame Shot expanding fireball with 6-frame per-target tick immunity and ground burning AOE.
- Seamless automatic fallback to PISTOL upon 0 ammo with continuous in-flight bullet survival.
- Hostage POW 6-state machine with item dropping and weighted drop table (HMG, Flame, Grenade, Score items).
- Overhaul R1: Updated `StageTrigger` in `StageManager.ts` to pass `cameraX` to `spawnAction(engine, cameraX)`.
- Overhaul R1: Implemented `despawnOffscreenEntities(cameraX)` in `StageManager.ts` to cleanly despawn any minion/enemy projectile when `x < cameraX - 180` or `y > 320` (exempting player, bosses, and POWs).
- Overhaul R1: Implemented smooth ingress in `SoldierEnemy.ts` with run-in velocity `vx = -110 px/s` until reaching `x <= cameraX + 460`, then seamlessly transitioning to normal role patrol/combat AI (`PATROL`, `IDLE`, or `GUARD_ADVANCE`).
- Overhaul R1: Updated all enemy wave triggers in `src/main.ts` (`trigger_wave_1`, `trigger_wave_2`, `trigger_wave_3`, `trigger_mid_boss`) to place spawns out-of-bounds at `cameraX + 520px` with +40px echelon staggering. Zero visible enemy popping.
- Overhaul R1: Created comprehensive unit tests in `tests/unit/stage_spawning_despawn.test.ts` (11 tests, 100% green).

## Artifact Index
- /Users/user/src/fullmetalslug/.agents/worker_m2/DISPATCH.md — Assignment instructions
- /Users/user/src/fullmetalslug/.agents/worker_m2/BRIEFING.md — Persistent context & memory
- /Users/user/src/fullmetalslug/.agents/worker_m2/progress.md — Progress heartbeat
- /Users/user/src/fullmetalslug/.agents/worker_m2/handoff.md — 5-Component handoff report
- /Users/user/src/fullmetalslug/tests/unit/stage_spawning_despawn.test.ts — Unit tests for spawn and despawn

## Change Tracker
- **Files modified**:
  - `src/core/engine/StageManager.ts`: StageTrigger camera parameter, despawnOffscreenEntities, cameraX tracking.
  - `src/core/entities/enemies/SoldierEnemy.ts`: SoldierConfig cameraX/isIngress, INGRESS state, -110 px/s run-in velocity, boundary transition.
  - `src/main.ts`: Out-of-bounds wave spawners at cameraX + 520px with +40px staggering.
  - `tests/unit/stage_spawning_despawn.test.ts`: 11 unit tests covering StageTrigger, despawnOffscreenEntities, ingress AI, and out-of-bounds wave spawners.
- **Build status**: PASS (tsc -b && vite build: 0 errors; npx tsc --noEmit: 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (14/14 test suites, 156/156 tests passing 100% green)
- **Lint status**: 0 violations
- **Tests added/modified**: `tests/unit/stage_spawning_despawn.test.ts` added with 11 behavior-driven test cases.

## Loaded Skills
- None

