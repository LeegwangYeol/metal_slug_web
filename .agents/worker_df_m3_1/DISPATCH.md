## 2026-09-10T11:25:34Z

You are Worker 1 for Milestone M3 (Occult Arsenal, Upgrades & Horde Director) of "Grim Harvest: Undead Siege".

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m3_1
Project root: /Users/user/teamwork_projects/metal_slug_web

Tasks for Milestone M3:
1. Implement Occult Arsenal & Weapons (`src/core/weapons/`):
   - `src/core/weapons/WeaponTypes.ts`
   - `src/core/weapons/Projectile.ts`
   - `src/core/weapons/Weapon.ts`
   - 5 Concrete Weapons (Ranks 1 to 5):
     - `src/core/weapons/ArcaneScythe.ts`
     - `src/core/weapons/SoulOrbiters.ts`
     - `src/core/weapons/AbyssalLightning.ts`
     - `src/core/weapons/BoneSpear.ts`
     - `src/core/weapons/CursedAura.ts`
   - `src/core/weapons/WeaponManager.ts`
2. Implement Upgrades, Passives & Evolutions (`src/core/systems/UpgradeSystem.ts`)
3. Implement Gothic Level-Up Modal (`src/ui/UpgradeModal.ts`)
4. Implement Escalating Wave Director (`src/core/systems/WaveDirector.ts`)
5. Integrate Everything into `src/main.ts`
6. Create Comprehensive Unit Test Suites in `tests/unit/`:
   - `tests/unit/Weapons.test.ts`
   - `tests/unit/UpgradeSystem.test.ts`
   - `tests/unit/WaveDirector.test.ts`
7. Verify Build & Tests: `npx tsc --noEmit`, `npm test`, `npm run build`
8. Keep progress.md updated
9. Produce handoff.md and send_message to parent
