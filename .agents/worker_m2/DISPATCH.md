## 2026-09-04T01:59:10Z

You are Worker M2.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2/
Your workspace root is: /Users/user/teamwork_projects/metal_slug_web/

MANDATORY FIRST STEP: Read the authoritative user request at:
/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
Also read the scope document and Explorer M2 blueprint:
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen2/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2/handoff.md

Exclusively Owned Files for Milestone 2:
- src/core/entities/allies/AllyTypes.ts
- src/core/entities/allies/AllyNPC.ts
- src/core/entities/allies/AllyKiBlast.ts
- src/core/entities/allies/AllyManager.ts
- src/core/weapons/WeaponTypes.ts
- src/core/weapons/ShotgunWeapon.ts
- src/core/weapons/LaserGunWeapon.ts
- src/core/weapons/RocketLauncherWeapon.ts
- src/core/weapons/WeaponManager.ts
- src/core/weapons/ProjectileManager.ts
- src/core/entities/items/ItemPickup.ts
- src/core/player/PlayerController.ts
- tests/unit/allies_system.test.ts
- tests/unit/diverse_weapons_items.test.ts

Task Instructions:
Implement the complete Milestone 2 feature set strictly according to the architecture blueprint in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2/handoff.md`:
1. `src/core/weapons/WeaponTypes.ts`:
   - Add SHOTGUN, LASER_GUN, ROCKET_LAUNCHER to `WeaponType` and `WEAPON_CONFIGS`.
   - Add WEAPON_SHOTGUN, WEAPON_LASER, WEAPON_ROCKET, MEDKIT, SHIELD to `ItemDropType` and update `POW_LOOT_TABLE`.
2. Dedicated Weapon Implementations:
   - `src/core/weapons/ShotgunWeapon.ts`: 7-pellet fan spread (+-14 degrees), 680 px/s velocity, 2.0 damage per pellet, 0.18s lifetime, kinetic knockback impulse (160 px/s horizontal).
   - `src/core/weapons/LaserGunWeapon.ts`: 1200 px/s continuous beam, piercing without termination, per-target 0.1s tick immunity map, 1.2 damage per tick.
   - `src/core/weapons/RocketLauncherWeapon.ts`: Homing rocket (220 to 650 px/s acceleration, 3.5 rad/s steering toward nearest enemy), 48px explosive AOE blast (8.0 * (1 - d/48) damage falloff).
3. Integration in `src/core/weapons/WeaponManager.ts` and `ProjectileManager.ts`:
   - Wire up firing, ammo pools, and item pickups for new weapons.
   - Guard against friendly fire on ALLY_NPC and ALLY_PROJECTILE.
4. Items & Player Integration:
   - `src/core/entities/items/ItemPickup.ts`: Standalone entity supporting floating/bouncing and all ItemDropTypes, maintaining backwards compatibility with PowEntity.ts.
   - `src/core/player/PlayerController.ts`: Add `public shieldCharges: number = 0;`, implement 2-hit damage absorption in `takeDamage()`, handle Medkit (heal/lives) and Shield pickups.
5. Autonomous Ally NPC System:
   - `src/core/entities/allies/AllyTypes.ts`: States, configs, contracts.
   - `src/core/entities/allies/AllyKiBlast.ts`: Friendly energy projectile (520 px/s, 3.5 damage, ignores player/ally).
   - `src/core/entities/allies/AllyNPC.ts`: Autonomous Hyakutaro Ichimonji companion. Autonomous follow/locomotion, threat-weighted target acquisition within 380px radius without player input, 0.35s ki charge, ki blast firing, celebrate state.
   - `src/core/entities/allies/AllyManager.ts`: Lifecycle management.
6. Comprehensive Unit Tests:
   - `tests/unit/diverse_weapons_items.test.ts`: Test Shotgun spread/knockback, Laser piercing/tick immunity, Rocket homing/blast AOE, Medkit heal/lives, Shield 2-hit absorption.
   - `tests/unit/allies_system.test.ts`: Test autonomous state transitions, tethering locomotion, target acquisition with 0 player input, ki blast emission, damage resolution (3.5 damage), friendly fire safety.
7. Verification:
   - Run `npx tsc --noEmit` (must have 0 errors).
   - Run `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts`.
   - Run `npx vitest run` (ensure all tests pass 100% green, 0 regressions).
8. Write detailed handoff report to:
   /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2/handoff.md
9. Send completion message to parent with summary and artifact path.
