# BRIEFING — 2026-09-10T20:40:00+09:00

## Mission
Independently review and stress-test the M3 Occult Arsenal implementation for Grim Harvest: Undead Siege, checking for correctness, performance, integrity violations, and testing validity.

## 🔒 My Identity
- Archetype: reviewer-critic
- Roles: reviewer, critic
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m3_1
- Original parent: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Milestone: M3 (Occult Arsenal, Upgrades & Horde Director)
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Review code quality, architecture, and correctness of Occult Arsenal (src/core/weapons/)
- Actively check for integrity violations: hardcoded results, dummy implementations, shortcuts, fabricated verification, self-certifying work without genuine independent verification
- Run tests and build (tsc, test, build)
- Write handoff report following Handoff Protocol
- Communicate via send_message to parent

## Current Parent
- Conversation ID: 6bab7276-2b23-4494-b27b-d0a93584d82f
- Updated: 2026-09-10T20:40:00+09:00

## Review Scope
- **Files to review**:
  - src/core/weapons/WeaponTypes.ts
  - src/core/weapons/Projectile.ts
  - src/core/weapons/Weapon.ts
  - src/core/weapons/ArcaneScythe.ts
  - src/core/weapons/SoulOrbiters.ts
  - src/core/weapons/AbyssalLightning.ts
  - src/core/weapons/BoneSpear.ts
  - src/core/weapons/CursedAura.ts
  - src/core/weapons/WeaponManager.ts
  - src/main.ts
- **Interface contracts**: PROJECT.md, ORIGINAL_REQUEST.md, COLLABORATION.md
- **Review criteria**: Correctness, performance (zero heap allocations, 256 capacity pool, Int16Array hit memory), CDR clamping, stat scaling, integrity, test coverage

## Review Checklist
- **Items reviewed**:
  - `src/core/weapons/WeaponTypes.ts` (VERIFIED: clean definitions, normalization helper)
  - `src/core/weapons/Projectile.ts` (VERIFIED: zero allocations, 256 capacity pool, intrusive Int16Array hit memory)
  - `src/core/weapons/Weapon.ts` (VERIFIED: Might scaling, CDR clamped at 50% max, area, speed multipliers)
  - `src/core/weapons/ArcaneScythe.ts` (VERIFIED: 110°–180° frontal cleave, dual blades, 360° evolution)
  - `src/core/weapons/SoulOrbiters.ts` (VERIFIED: 2–6 orbiting skulls, Float32Array hit cooldowns)
  - `src/core/weapons/AbyssalLightning.ts` (VERIFIED: 1–4 strikes, chain necrosis, jittered bolt visuals)
  - `src/core/weapons/BoneSpear.ts` (VERIFIED: piercing projectiles, pool lifecycle, spread firing)
  - `src/core/weapons/CursedAura.ts` (VERIFIED: expanding shockwave, knockback, evolution blight)
  - `src/core/weapons/WeaponManager.ts` (VERIFIED: multi-weapon auto-fire coordination, factory methods)
  - `src/main.ts` (VERIFIED: wiring with game loop, player, horde manager, loot, HUD, upgrade modal)
  - `tests/unit/Weapons.test.ts` (11/11 tests pass)
  - `tests/unit/UpgradeSystem.test.ts` (10/11 tests pass, 1 intermittent failure identified)
  - `tests/unit/WaveDirector.test.ts` (15/15 tests pass)
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: None

## Attack Surface
- **Hypotheses tested**:
  - Zero-velocity BoneSpear input `(0, 0)`: Handled safely via fallback `Math.hypot() || 1`.
  - Int16Array enemy ID overflow: Int16 supports up to 32,767; maxEnemies is 2,048. Safe.
  - Projectile pool exhaustion (> 256): Handled gracefully, returns null.
  - CDR scaling with > 50% passive reduction: Hard clamped at 0.50 max reduction.
  - Evolved weapon interaction with card generator: FOUND DEFECT — `UpgradeSystem.ts` deletes base weapon on evolution, causing card generator to offer base weapon as a new unlock if slots < 6.
  - Flaky evolution test in `UpgradeSystem.test.ts`: FOUND DEFECT — 17.2% miss rate due to weighted random sampling with candidate weight 3.5 vs 8.0 other candidates.
  - CursedAura knockback stacking: FOUND MINOR DEFECT — Double application of knockback force.
  - Redundant ProjectilePool: WeaponManager allocates a 256 pool that is unused by BoneSpear.
- **Vulnerabilities found**:
  - [Major] Evolved base weapon zombie re-offering in `UpgradeSystem.ts`
  - [Major] Flaky evolution card test in `UpgradeSystem.test.ts` (~17% failure rate)
  - [Minor] Double-applied knockback in `CursedAura.ts`
  - [Minor] Redundant ProjectilePool allocation in `WeaponManager.ts`
- **Untested angles**: None within M3 scope

## Key Decisions Made
- Confirmed zero integrity violations in `src/core/weapons/`.
- Verified TypeScript compilation (`npx tsc --noEmit` -> 0 errors) and Vite production build (`npm run build` -> 0 errors).
- Issued REQUEST_CHANGES due to the two Major defects affecting test stability and weapon evolution game state.

## Artifact Index
- handoff.md — Final review and handoff report
- progress.md — Liveness heartbeat
- DISPATCH.md — Received instructions log
