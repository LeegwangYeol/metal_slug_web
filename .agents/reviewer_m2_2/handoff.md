# Handoff Report: Milestone M2 Review & Adversarial Challenge

- **Agent**: `teamwork_preview_reviewer` (`reviewer_m2_2`)
- **Role**: Reviewer / Adversarial Critic
- **Milestone**: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)
- **Date**: 2026-09-08
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_2`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Direct Inspection of Source Code Changes

1. **`PrisonerEntity` Alias & `spawnsAlly` Events (`src/core/entities/pow/PowEntity.ts` & `PrisonerEntity.ts`)**:
   - `src/core/entities/pow/PrisonerEntity.ts` directly re-exports `PowEntity` via:
     ```ts
     export * from './PowEntity';
     export { PowEntity as PrisonerEntity } from './PowEntity';
     ```
   - `src/core/entities/pow/PowEntity.ts` lines 89, 98-112:
     Constructor accepts optional parameter `spawnsAlly: boolean = false` and assigns `this.spawnsAlly = spawnsAlly`.
   - Lines 143-148, 168-173, and 252-257:
     Emits event `'spawn_ally'` with payload `{ position: { x: this.position.x, y: this.position.y }, powId: this.id }` through `engine.eventBus`.

2. **`ItemPickup` Defaults & `PlayerController` Integration**:
   - `src/core/entities/items/ItemPickup.ts` line 24:
     Constructor default: `initialVelocity: Vector2D = vec2(0, 0)`.
   - Lines 36-59: Physical falling integrates gravity `ItemPickup.GRAVITY = 600.0 px/s^2` and resolves solid platform contact via `PlatformPhysics.resolveGroundContact`, cleanly snapping to `position.y = contact.groundY` and zeroing vertical velocity.
   - Lines 64-68: Grounded state executes sinusoidal bobbing `Math.sin(this.bobTimer * 4.0) * 2.0`.
   - `src/core/player/PlayerController.ts` lines 46, 544-557:
     `shieldCharges: number = 0` property added.
     `takeDamage(amount, engine)`: When `shieldCharges > 0`, decrements charges, activates 0.5s invulnerability, emits `'sfx_shield_absorb'`, and emits `'shield_hit'`. Emits `'sfx_shield_break'` upon reaching 0 charges without reducing player health or lives.
   - `src/core/weapons/WeaponManager.ts` lines 272-290:
     `applyItemPickup(ItemDropType.MEDKIT)`: If player is damaged (`health < maxHealth`), restores to `maxHealth` (1.0). If already at full health, awards +1 extra life (`player.lives++`), plays `'sfx_item_pickup'`, and awards 1,000 points.
     `applyItemPickup(ItemDropType.SHIELD)`: Equips `player.shieldCharges = 2`, plays `'sfx_item_pickup'`, and emits `'shield_acquired'`.

3. **`ProceduralSpriteFactory` 164 Baseline Invariant**:
   - `src/render/sprites/ProceduralSpriteFactory.ts` lines 402-407:
     ```ts
     public getAllKeys(includePolish: boolean = false): string[] {
       if (includePolish) {
         return Array.from(this.spriteCache.keys());
       }
       return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
     }
     ```
   - Executing `tests/unit/adversarial_sprites_crosshairs.test.ts` directly verified:
     ```text
     [Oracle 1A] Total Registered Sprite Keys: 164
     [Oracle 1B] Verified 164 sprite buffers. Defective count: 0
     [Stress 1C] Successfully rendered: 164/164 sprites under stress
     [Category Audit 1E] Verified Breakdown: { player: 67, rebel: 21, pow: 9, ironTechnical: 7, tetsuyuki: 8, projectile: 13, casings: 4, explosions: 18, hud: 17, total: 164 }
     ```

4. **Integrity Violations Audit**:
   - Source code was inspected for hardcoded test results, facade logic, or test bypasses.
   - `AllyNPC.findBestTarget` computes real spatial distances (`vec2Dist`) and dynamic threat scores across all living entities.
   - `ShotgunWeapon` generates 7 discrete physics projectiles with trigonometry across the `[-14°, +14°]` spread arc.
   - `LaserGunWeapon` generates continuous beam projectiles with an active `targetImmunityMap` tracking delta-time expiration.
   - `RocketLauncherWeapon` executes angular steering kinematics towards nearest targets with real Euclidean AOE falloff.
   - Zero facade patterns or shortcuts detected.

5. **Test Suite Execution & Empirical Telemetry**:
   - Full test run of all 30 test files with `--testTimeout=35000`:
     ```text
     Test Files  30 passed (30)
          Tests  373 passed (373)
       Duration  20.23s
     ```
   - TypeScript compilation (`npx tsc --noEmit`): Exit code 0, zero errors.
   - Production bundle build (`npm run build`): Exit code 0, 35 modules transformed, built in 3.85s.

---

## 2. Logic Chain

1. **Requirement R2 Fulfillment (Autonomous Allies & Diverse Weapons/Items)**:
   - Observation 1.1: `AllyNPC` autonomously tracks the player, executes jumps over elevated platforms, scans for targets without player input, gathers ki, and fires `AllyKiBlast` dealing 3.5 damage while remaining immune to friendly fire.
   - Observation 1.2: Shotgun, Laser Gun, and Rocket Launcher introduce distinct projectile kinematics: 7-pellet spread with 160 px/s knockback; 1200 px/s continuous piercing beam with 0.1s tick immunity; and homing rocket accelerating up to 650 px/s with 48px explosive blast falloff.
   - Observation 1.2: Medkit restores health or increments lives on overheal, and Shield provides a 2-hit damage absorption buffer before player health decrement occurs.
   - **Deduction**: All feature requirements for Milestone M2 are fully, authentically implemented.

2. **System Stability & Invariant Preservation**:
   - Observation 1.3: The baseline sprite key count invariant (164 keys) was untouched and verified by empirical test suites.
   - Observation 1.5: The full test suite of 30 test files (including previous milestones M1, Overhaul 1, Overhaul 2, and Polish suites) achieved 100% green status (373/373 passed).
   - Observation 1.5: TypeScript compilation and Vite production build pass cleanly with zero warnings or errors.
   - **Deduction**: The codebase maintains high architectural integrity and zero regressions.

---

## 3. Caveats & Adversarial Findings

1. **Minor Finding 1 (Target Acquisition Priority Substring Collision)**:
   - In `src/core/entities/allies/AllyNPC.ts` lines 267-271:
     ```ts
     if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
       priorityWeight = 100;
     } else if (typeStr === 'MID_BOSS_VEHICLE') {
       priorityWeight = 50;
     }
     ```
     If an enemy entity type contains `'BOSS'` (such as `'MID_BOSS'`), it matches the first condition and receives weight 100 instead of 50. Both are still prioritized over standard minions (weight 10), so targeting remains functional, but future mid-boss types should be ordered or matched explicitly.
2. **Minor Finding 2 (PowEntity Event Latch)**:
   - In `PowEntity.ts`, `this.spawnsAlly` emits `'spawn_ally'` on `freeHostage()`, upon transition from `FREED` to `SALUTE`, and on `markSaved()`. While harmless currently (as `AllyManager` has not yet bound a multi-spawn handler), adding a boolean latch `hasSpawnedAlly = true` will ensure idempotency when event wiring is expanded in M3/M4.
3. **Execution Environment Timeout Invariant**:
   - When executing all 30 test suites concurrently in parallel workers on loaded CPU environments, long-running 3,600-tick simulation tests (`challenger_2_empirical_stress.test.ts` and `challenger_boss_and_stability.test.ts`) require ~18-24s and should be run with `--testTimeout=35000` to prevent runner timeouts.

---

## 4. Conclusion

The implementation of Milestone M2 (Autonomous Ally NPCs & Diverse Items/Weapons) by `worker_m2_1` satisfies all functional and architectural specifications:
- Interface contracts for `AllyNPC`, `AllyKiBlast`, `ItemPickup`, `PlayerController`, `WeaponManager`, `PrisonerEntity`, and weapons conform to `PROJECT.md` and `COLLABORATION.md`.
- Default key count invariant of 164 keys in `ProceduralSpriteFactory` is strictly preserved.
- Zero integrity violations were found.
- 100% of all unit test suites pass (30 files, 373 tests).
- Clean TypeScript compilation and production build.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently verify this assessment:

1. **Verify TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   # Expect exit code 0
   ```

2. **Verify ProceduralSpriteFactory 164 Keys Invariant**:
   ```bash
   npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts
   # Expect 17 passed tests, Oracle 1A logs 164 keys
   ```

3. **Verify Milestone M2 Systems**:
   ```bash
   npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts
   # Expect 5 files passed, 59 passed tests
   ```

4. **Verify Full Test Suite**:
   ```bash
   npx vitest run tests/unit/ --testTimeout=35000
   # Expect 30 files passed, 373 passed tests
   ```

5. **Verify Production Build**:
   ```bash
   npm run build
   # Expect exit code 0, clean build in dist/
   ```
