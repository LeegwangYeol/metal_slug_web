# BRIEFING — 2026-09-03T03:26:35Z

## Mission
Implement Milestone M2: Player Kinematics, 8-Way Aiming, Melee vs Ranged Arbitration, Weapons System (Pistol, HMG, Flame Shot, Grenades) with ammo fallback, and Hostage POW System with state machine & loot table.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/src/fullmetalslug/.agents/worker_m2/
- Original parent: 084b764e-0b87-4c6e-b6aa-67ece754bc64
- Milestone: M2

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

## Current Parent
- Conversation ID: 084b764e-0b87-4c6e-b6aa-67ece754bc64
- Updated: 2026-09-03T03:26:35Z

## Task Summary
- **What to build**: Full M2 core systems: Player Kinematics & 8-way aim, PlayerController with melee arbitration, WeaponTypes, WeaponManager with auto-fallback, ProjectileManager with HMG sweep and Flame Shot piercing tick damage, Grenade with physics & blast, and PowEntity state machine & loot table.
- **Success criteria**: All specs implemented cleanly, npx tsc --noEmit passes, vitest unit tests pass with thorough coverage, handoff report generated.
- **Interface contracts**: /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md and /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md
- **Code layout**: src/core/player/, src/core/weapons/, src/core/entities/pow/, tests/unit/

## Key Decisions Made
- Implemented pure headless kinematics in `PlayerKinematics.ts` with accurate 8-way directional unit vectors and strict airborne-only downward shooting.
- Embedded melee arbitration in `PlayerController.ts` scanning 38px forward, 6px rear, [-34, +10]px vertical, allocating knife slash state (3.0 damage, active frames 5-9) while cleanly suppressing bullet firing.
- WeaponManager & ProjectileManager implement full HMG 12 rad/s sweep with ±2.5° dispersion, brass casing ejection simulation with parabolic bounce, and Flame Shot expanding fireball with 6-frame per-target tick immunity and ground burning AOE.
- Seamless automatic fallback to PISTOL upon 0 ammo with continuous in-flight bullet survival.
- Hostage POW 6-state machine with item dropping and weighted drop table (HMG, Flame, Grenade, Score items).

## Artifact Index
- /Users/user/src/fullmetalslug/.agents/worker_m2/DISPATCH.md — Assignment instructions
- /Users/user/src/fullmetalslug/.agents/worker_m2/BRIEFING.md — Persistent context & memory
- /Users/user/src/fullmetalslug/.agents/worker_m2/progress.md — Progress heartbeat
- /Users/user/src/fullmetalslug/.agents/worker_m2/handoff.md — 5-Component handoff report

## Change Tracker
- **Files modified**:
  - `src/core/weapons/WeaponTypes.ts`: Weapon types, states, configs, casing & ground fire interfaces, POW loot table.
  - `src/core/player/PlayerKinematics.ts`: Movement constants, AABB boxes, 8-way aiming matrix, muzzle positions, melee scan box.
  - `src/core/weapons/Grenade.ts`: Parabolic trajectory, bounce restitution (ey=0.5, ex=0.7), contact/fuse detonation, AOE blast falloff.
  - `src/core/weapons/ProjectileManager.ts`: Bullet entities, pistol 4-bullet throttle, HMG spray & casing ejection, flame piercing & ground fire.
  - `src/core/weapons/WeaponManager.ts`: Inventory management, cooldowns, HMG 12 rad/s sweep, auto-fallback to PISTOL, badge pickup handling.
  - `src/core/player/PlayerController.ts`: Player entity, 8-way aiming, melee vs ranged arbitration, grenade throw, platform integration.
  - `src/core/entities/pow/PowEntity.ts`: 6-state hostage machine, weighted loot table, item drop pickup entity, saved scoring.
  - `tests/unit/player_kinematics_aiming.test.ts`: Kinematics, AABBs, and 8-way aim unit tests.
  - `tests/unit/player_melee_ranged.test.ts`: Melee knife vs ranged arbitration unit tests.
  - `tests/unit/weapons_system.test.ts`: Weapons, HMG sweep, Flame multi-hit, and fallback unit tests.
  - `tests/unit/grenade_physics.test.ts`: Grenade trajectory, bounce, fuse, and blast AOE unit tests.
  - `tests/unit/pow_system.test.ts`: POW 6-state machine, loot table, and item pickup unit tests.
- **Build status**: PASS (npx tsc --noEmit: 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (10/10 test files, 108 tests passing)
- **Lint status**: 0 violations
- **Tests added/modified**: 5 new test files added covering 100% of M2 specifications.

## Loaded Skills
- None
