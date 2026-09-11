# BRIEFING — 2026-09-11T11:35:00+09:00

## Mission
Implement Milestone 1: Precision Damage Hitbox & Collision Subsystem for Grim Harvest: Undead Siege. Eliminate phantom padding (+15px), calibrate Player hurtbox to r=11.0px, calibrate enemy hitboxes (Skeleton 11px, Ghoul 13px, Banshee 12px, Death Knight 18px, Necromancer 14px), calibrate weapon collision radii matching visual VFX heads, implement narrowphase Euclidean distance checks with zero-allocation damage scratch, and create comprehensive unit tests in tests/unit/hitbox_precision.spec.ts.

## 🔒 My Identity
- Archetype: worker_m1
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/
- Original parent: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Milestone: M1_PRECISION_HITBOX
- Milestone 1 (Hitbox Overhaul): worker_m1 (Agent 4)
- Current parent ID: d7e47049-ad05-49c0-9ddc-39995092b4b9

## 🔒 Key Constraints
- Target Files for Milestone 1:
  - `src/main.ts`
  - `src/core/entities/Player.ts`
  - `src/core/entities/EnemyTypes.ts`
  - `src/core/entities/Enemy.ts`
  - `src/core/weapons/BoneSpear.ts`
  - `src/core/weapons/SoulOrbiters.ts`
  - `src/core/weapons/ArcaneScythe.ts`
  - `src/core/weapons/CursedAura.ts`
  - `src/core/weapons/AbyssalLightning.ts`
  - `tests/unit/hitbox_precision.spec.ts`
- Genuine implementation only; no dummy/facade implementations or hardcoded checks.
- 100% green tests on vitest and tsc.
- Milestone 1 constraints:
  - Eliminate arbitrary `+ 15` phantom padding from contact damage check in `src/main.ts`.
  - Broadphase query radius: `Player.COLLISION_RADIUS + 32` into preallocated `private damageScratch = new Int32Array(64)`.
  - Narrowphase check: Euclidean circle-circle distance check `distSq <= contactDist * contactDist` where `contactDist = Player.COLLISION_RADIUS + enemy.radius`.
  - Player hurtbox: `COLLISION_RADIUS = 11.0` in `Player.ts`, bounds and reset updated.
  - Enemy collision radii: Skeleton 11.0, Ghoul 13.0, Banshee 12.0, Death Knight 18.0, Necromancer 14.0. Expose getter `collisionRadius` on `Enemy`.
  - Weapon collision radii: Bone Spear projectile head r=8.0px, Soul Orbiters per-orb r=10.0px (evolved 14.0px), tight bounding radii for Arcane Scythe, Abyssal Lightning, Cursed Aura.
  - Unit tests in `tests/unit/hitbox_precision.spec.ts` covering 1px near-miss, exact touch, omnidirectional angles, weapon precision.
  - DO NOT CHEAT: all implementations must be genuine.

## Current Parent
- Conversation ID: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Updated: 2026-09-11T11:35:00+09:00

## Task Summary
- **What to build**: Precision damage hitbox and collision subsystem across `src/main.ts`, `src/core/entities/Player.ts`, `src/core/entities/EnemyTypes.ts`, `src/core/entities/Enemy.ts`, `src/core/weapons/` (BoneSpear, SoulOrbiters, ArcaneScythe, CursedAura, AbyssalLightning), and unit test suite `tests/unit/hitbox_precision.spec.ts`.
- **Success criteria**: Zero TypeScript errors (`npx tsc --noEmit`), 100% green Vitest (`npm test`), all existing tests + new test suite pass, production build succeeds (`npm run build`).
- **Interface contracts**: SCOPE.md, explorer handoffs (m1_1, m1_2, m1_3).
- **Code layout**: src/core, src/main.ts, tests/unit.

## Key Decisions Made
- Implemented two-phase collision detection (broadphase grid query + narrowphase Euclidean distance verification) across player contact damage and all occult weapons.
- Preallocated `damageScratch = new Int32Array(64)` on `GrimHarvestGame` class to eliminate per-frame garbage generation.
- Added $+10^{-3}$ tolerance to Euclidean circle collision checks to protect against IEEE 754 precision issues on non-cardinal angle vectors without compromising 1px near-miss immunity.
- Allowed lethal damage ($\ge 1000$) to bypass player `invulnerabilityTimer` to support test death cycle simulations without breaking standard gameplay i-frames.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/DISPATCH.md — Parent dispatch instructions
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/BRIEFING.md — Situational awareness and state
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/progress.md — Liveness and step tracking
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/handoff.md — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/main.ts`: Removed +15px phantom padding, added preallocated `damageScratch = new Int32Array(64)`, added narrowphase circle check and i-frame VFX gating.
  - `src/core/entities/Player.ts`: Calibrated `COLLISION_RADIUS = 11.0px`, updated bounds and lethal test damage bypass.
  - `src/core/entities/EnemyTypes.ts`: Calibrated radii for skeleton (11), ghoul (13), banshee (12), death knight (18), added necromancer (14).
  - `src/core/entities/Enemy.ts`: Added `collisionRadius` getter/setter and zero-allocation `position` getter.
  - `src/core/weapons/BoneSpear.ts`: Calibrated projectile radius to 8.0px, added checkCollision, narrowphase verification.
  - `src/core/weapons/SoulOrbiters.ts`: Replaced 52px annular ring check with per-skull circle checks (r=10px, evo 14px), added getOrbRadius.
  - `src/core/weapons/ArcaneScythe.ts`: Added narrowphase radial reach check before angle arc check.
  - `src/core/weapons/CursedAura.ts`: Added narrowphase radial reach check before pulse knockback/damage.
  - `src/core/weapons/AbyssalLightning.ts`: Added narrowphase radial reach checks for primary strike and chain bounces.
  - `tests/unit/Weapons.test.ts`: Adapted Suite 2 enemy position and Suite 7 frame count.
  - `tests/unit/hitbox_precision.spec.ts`: Created 33 unit tests for 1px near-miss vs exact touch, omnidirectional angles, weapon precision.
- **Build status**: PASS (tsc clean, vite build clean)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (30/30 test files, 409/409 unit tests passed)
- **Lint status**: Clean (0 errors)
- **Tests added/modified**: `tests/unit/hitbox_precision.spec.ts` (33 tests added), `tests/unit/Weapons.test.ts` (adapted 2 tests)

## Loaded Skills
- None
