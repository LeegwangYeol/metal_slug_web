## 2026-09-03T03:19:31Z

You are worker_m2.
Your working directory is /Users/user/src/fullmetalslug/.agents/worker_m2/.
Project workspace root is /Users/user/src/fullmetalslug/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md

Milestone: M2 — Player, 8-Way Aiming, Melee vs Ranged, Weapons System & POWs.

File Write Ownership (Exclusively yours):
- src/core/player/PlayerKinematics.ts
- src/core/player/PlayerController.ts
- src/core/weapons/WeaponTypes.ts
- src/core/weapons/WeaponManager.ts
- src/core/weapons/ProjectileManager.ts
- src/core/weapons/Grenade.ts
- src/core/entities/pow/PowEntity.ts

Specifications to implement (100% decoupled from DOM/Canvas):
1. Player Kinematics & 8-Way Aiming:
   - Run speed 132 px/s, crawl speed 54 px/s, jump impulse -348 px/s, gravity +720 px/s², jump cut ratio 0.45.
   - Ground crouch on Down input (crouch crawl, lowered shooting muzzle).
   - Downward shooting only permitted while airborne. 8-directional normalized aim vectors.
   - Standing (24x40 px) and crouching (24x22 px) AABBs.
2. Melee vs Ranged Arbitration:
   - Forward knife scan box (38px forward, 6px rear, [-34, +10]px vertical).
   - If a living, melee-vulnerable enemy is within the scan box on Fire button press: allocate knife slash state (3.0 damage, active frames 5-9) and suppress bullet firing. Otherwise, fire ranged weapon.
3. Weapons System:
   - PISTOL: Infinite ammo, semi-automatic, max 4 on-screen projectiles, 660 px/s.
   - HEAVY_MACHINE_GUN: 200 rounds, 15 shots/s full-auto, 12 rad/s angular sweep when rotating while firing, ±2.5° spray dispersion, brass casing ejection simulation.
   - FLAME_SHOT: 30 fuel, expanding fireball (10px -> 36px), piercing multi-hit with 6-frame per-target tick immunity, ground burning AOE.
   - GRENADE: Parabolic trajectory, ground bounce restitution (ey=0.5, ex=0.7), 52px blast radius AOE, fuse/contact detonation.
   - Ammo Depletion: Seamless automatic fallback to PISTOL when special ammo drops to 0.
4. Hostage POW System:
   - 6-state machine: TIED_UP -> FREED (on player contact or bullet hit) -> SALUTE -> OFFERING_ITEM -> ESCAPING -> SAVED.
   - Weighted loot drop table (HMG badge, Flame Shot badge, Grenade box, Score items).

Verification:
- Run `npx tsc --noEmit` and confirm 0 errors.
- Run `npm run test` and ensure existing tests remain passing.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/worker_m2/handoff.md and notify orchestrator via send_message.
