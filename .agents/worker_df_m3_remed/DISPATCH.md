## 2026-09-10T11:50:34Z

You are Worker M3 Remediation (`worker_df_m3_remed`) for "Grim Harvest: Undead Siege".

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m3_remed
Project root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Defect Evidence & Reviewer Reports:
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m3_1/handoff.md (Reviewer 1 findings: evolved weapon re-offer, flaky test in UpgradeSystem.test.ts, double knockback in CursedAura.ts)
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m3_2/handoff.md (Reviewer 2 findings: post-evolution base weapon re-offer & rank demotion, player moveSpeed inversion with Ring of Velocity, perimeter spawner frustum violation at arena borders)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone M3 Remediation:
1. Fix Evolved Base Weapon Re-Offering in `src/core/systems/UpgradeSystem.ts`:
   - In `UpgradeSystem`, maintain an explicit `private readonly evolvedWeapons: Set<string> = new Set();`.
   - When a weapon evolves (`evolveWeapon(baseWeaponId, evolutionId)`), add `normalizeWeaponId(baseWeaponId)` to `this.evolvedWeapons`.
   - In `isWeaponEvolved(weaponId)`: check `this.evolvedWeapons.has(normalizeWeaponId(weaponId)) || this.weapons.get(norm)?.isEvolution`.
   - In `generateUpgradeCards`: when checking eligible weapons, if `this.isWeaponEvolved(weapon.id)`, completely SKIP it. Do NOT treat it as unowned (`rank === 0`) and do NOT re-offer it as a new unlock!
   - In `applyUpgrade`: if an evolution is selected, ensure the weapon stays marked as evolved so it cannot be demoted.
2. Fix Player MoveSpeed Inversion in `src/core/entities/Player.ts` & `src/main.ts`:
   - Review how `this.stats.moveSpeed` is initialized and used.
   - In `Player.ts`: clean up the `moveSpeed > 5` dual-mode branching. Standardize player moveSpeed so that base speed is `200` px/s, and applying passive `Ring of Velocity` (`deltaPerRank = 20.0` or `+10%`) increases the speed monotonically (200 -> 220 -> 240 -> 260 -> 280 -> 300 px/s). Ensure player speed NEVER collapses or drops!
3. Fix Perimeter Spawner Frustum Violation at Arena Borders in `src/core/systems/WaveDirector.ts`:
   - In `getPerimeterPoint(camX, camY)`:
     - Detect which cardinal edges are valid (i.e. lie outside the camera viewport AND inside the arena bounds).
     - If the camera is clamped against the arena's North border, the North perimeter is outside the arena, so clamping it would pull it into the visible screen. Do NOT spawn on an edge whose clamped coordinate falls inside the visible camera viewport `[camX, camY, camX + vw, camY + vh]`.
     - Only pick from valid outside edges (e.g. South, West, East).
     - Guarantee that for 100% of generated spawn points, the point lies OUTSIDE the camera viewport `(x < camX || x > camX + vw || y < camY || y > camY + vh)` AND within arena bounds.
4. Fix Double Knockback in `src/core/weapons/CursedAura.ts`:
   - Ensure knockback impulse is not applied twice (remove direct `enemy.pushVx/Vy` if `hordeManager.applyDamage` already applies knockback, or coordinate appropriately).
5. Fix Flaky Test in `tests/unit/UpgradeSystem.test.ts`:
   - Ensure test at lines 142–145 verifies evolution card generation reliably (e.g. roll with only the evolution and maxed weapons, or assert candidate inclusion without probabilistic drop).
   - Add new unit tests verifying:
     - Evolved weapons are NEVER re-offered as new unlocks.
     - MoveSpeed increases monotonically from Rank 0 to Rank 5 with Ring of Velocity.
     - 1,000 perimeter spawns across extreme camera positions clamped to arena borders produce 0 on-screen points.
6. Verify Build & Test Suite:
   - Run `npx tsc --noEmit`
   - Run `npm test` (all test files must pass 100% green)
   - Run `npm run build`
7. Document your fixes and results in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m3_remed/handoff.md` and send a message to parent when complete.
