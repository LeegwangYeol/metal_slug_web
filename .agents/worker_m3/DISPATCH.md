## 2026-09-03T03:19:31Z

You are worker_m3.
Your working directory is /Users/user/src/fullmetalslug/.agents/worker_m3/.
Project workspace root is /Users/user/src/fullmetalslug/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md

Milestone: M3 — Enemies, Mid-Boss Armored Vehicle & Tetsuyuki War Fortress Boss.

File Write Ownership (Exclusively yours):
- src/core/entities/enemies/EnemyTypes.ts
- src/core/entities/enemies/SoldierEnemy.ts
- src/core/entities/enemies/MidBossVehicle.ts
- src/core/entities/boss/BossTypes.ts
- src/core/entities/boss/TetsuyukiBoss.ts

Specifications to implement (100% decoupled from DOM/Canvas):
1. Rebel Infantry AI (4 distinct roles):
   - SOLDIER_RIFLE: Patrol, sight detection, aim, burst rifle fire (3 shots).
   - SOLDIER_KNIFE: Sprint charger when player is in range, knife attack triggering melee counter.
   - SOLDIER_GRENADE: Curved parabolic grenade toss bypassing low obstacles.
   - SOLDIER_SHIELD: Directional frontal shield (deflects frontal bullets; vulnerable to rear attacks, melee knife, and explosives).
   - Melee vulnerability: All 4 soldiers have `isMeleeVulnerable: true`.
2. Mid-Boss Rebel Iron Technical:
   - Armored half-track / technical vehicle with tread kinematics.
   - 360° rotating turret tracking player with angular velocity clamp (1.8 rad/s).
   - Heavy cannon shell attacks with explosive impact.
   - Reinforcement deployment (spawns soldier waves, capped at 3 active adds).
   - `isMeleeVulnerable: false` (immune to knife).
3. Stage 1 End-Boss: Tetsuyuki War Fortress:
   - Multi-phase state machine with damage-gated transitions:
     - PHASE_1_ARTILLERY: Dual heavy cannon barrage and homing rocket pods.
     - PHASE_2_LASER_SWEEP: Hull breach, engine overheat, thermal laser sweep across battlefield, rapid gatling turret.
     - PHASE_3_MELTDOWN: Emergency thruster shockwaves, exposed reactor core weak-point ($48\times 48$ px, takes $1.5\times$ damage).
   - Death sequence: DEATH_EXPLODING 4-stage timed chain explosion sequence (3.2 seconds) transitioning to DESTROYED.

Verification:
- Run `npx tsc --noEmit` and confirm 0 errors.
- Run `npm run test` and ensure existing tests remain passing.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/worker_m3/handoff.md and notify orchestrator via send_message.
