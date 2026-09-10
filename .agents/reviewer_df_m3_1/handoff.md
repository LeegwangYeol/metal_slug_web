# Milestone M3 Review & Adversarial Critic Report: Occult Arsenal

## Review Summary

**Verdict**: **REQUEST_CHANGES**

The core Occult Arsenal (`src/core/weapons/`) demonstrates exceptional engineering quality, zero integrity violations, real spatial physics, and proper mathematical stat scaling. However, two **Major findings** in the integration between `WeaponManager` and `UpgradeSystem` create gameplay corruption (evolved weapons being re-offered as new unlocks) and intermittent CI test failures (~17% flaky failure rate in `UpgradeSystem.test.ts`). These must be remediated before Milestone M3 can be approved.

---

## 1. Observation

### 1.1 Tool Commands and Execution Results
- `npx tsc --noEmit`: Exited code 0 with zero diagnostic errors.
- `npm run build`: Exited code 0 (`vite v6.4.3 building for production... ✓ 34 modules transformed... dist/index.html 1.37 kB, dist/assets/index-Bh1HQSmG.js 134.68 kB, ✓ built in 963ms`).
- `npx vitest run tests/unit/Weapons.test.ts`: Exited code 0 (11 passed / 11 total).
- `npx vitest run tests/unit/WaveDirector.test.ts`: Exited code 0 (15 passed / 15 total).
- `npm test`: Exited with code 1 during full suite execution due to an intermittent assertion failure in `tests/unit/UpgradeSystem.test.ts`:
  ```
  FAIL tests/unit/UpgradeSystem.test.ts > Rogue-Lite UpgradeSystem & Synergies Suite (Milestone M3) > Suite 4: Synergistic Weapon Evolutions > unlocks evolution card when weapon is Rank 5 and passive is owned
  AssertionError: expected undefined to be defined
    ❯ tests/unit/UpgradeSystem.test.ts:144:24
       142|       const cards = upgradeSystem.generateUpgradeCards(4);
       143|       const evoCard = cards.find((c) => c.type === UpgradeType.WEAPON_EVOLUTION);
       144|       expect(evoCard).toBeDefined();
       145|       expect(evoCard!.itemId).toBe('soul_reaping_harvester');
  ```

### 1.2 Direct Code Observations in Reviewed Files

#### A. Occult Arsenal (`src/core/weapons/`)
- `src/core/weapons/WeaponTypes.ts`: Comprehensive type definitions for 5 base weapons and 5 supreme evolutions. Includes `normalizeWeaponId()` handling variants (`arcane_scythe`, `scythe`, etc.).
- `src/core/weapons/Projectile.ts`:
  - `ProjectilePool`: Fixed capacity of 256 (`constructor(capacity: number = 256)`), zero heap allocations during `spawn()` and `free()`, O(1) swap-and-pop active tracking via `Int32Array` buffers.
  - `Projectile`: Pre-allocated `hitEnemyIds: Int16Array = new Int16Array(16)` with `hitCount` tracking. Linear lookup `hasHit(enemyId)` without heap allocations or object creation.
- `src/core/weapons/Weapon.ts`:
  - Abstract base class with stat getters.
  - `getEffectiveDamage()`: Scaled by player might (`Math.round(this.getDamage() * might)`).
  - `getEffectiveCooldown()`: Hard-clamps cooldown reduction to [0.0, 0.50] (`const clampedCDR = Math.min(0.50, Math.max(0.0, cdr)); return this.getCooldown() * (1.0 - clampedCDR);`).
  - `getEffectiveArea()`: Scaled by player area (`this.getArea() * area`).
- `src/core/weapons/ArcaneScythe.ts`:
  - Cleaves forward arc from 110° (Rank 1) to 180° (Rank 5) with dual blades, expanding to 360° upon supreme evolution (`soul_reaping_harvester`).
  - Angular difference check properly normalizes radians to `[-Math.PI, Math.PI]` with `while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;`.
  - Evolution grants 15% life shard chance on kill (`if (this.isEvolution && Math.random() < 0.15) this.player.heal(2);`).
- `src/core/weapons/SoulOrbiters.ts`:
  - Kinematic orbit of 2 (Rank 1) to 6 (Rank 5) skulls, expanding to 8 on evolution (`abyssal_vortex`).
  - Per-enemy hit cooldown tracked via flat `lastHitTimes: Float32Array = new Float32Array(2048)`.
  - Evolution reverses knockback to create an inward gravitational pull (`kbX = -kbX * 0.4; kbY = -kbY * 0.4`).
- `src/core/weapons/AbyssalLightning.ts`:
  - Targets 1 to 4 primary enemies within radius and chains up to 4 bounces.
  - Multi-segment canvas rendering with jittered offsets and dual-core cyan/violet glow.
  - Chained strikes decay damage by 25% per bounce (`currentDamage = Math.round(currentDamage * 0.75)`).
- `src/core/weapons/BoneSpear.ts`:
  - Fires high-velocity straight projectiles with pierce countdown (pierce 2 at Rank 1, up to 8 at Rank 5, infinite 999 on evolution `ossuary_cataclysm`).
  - Dedicated `ProjectilePool(256)` with zero-allocation recycling upon expiry or pierce depletion.
- `src/core/weapons/CursedAura.ts`:
  - Emits expanding necrotic shockwave centered on the player with radial knockback.
  - Evolution (`domain_of_decay`) leaves a permanent subtle 160px death blight aura.
  - Observed double knockback application at lines 152–155 (`enemy.pushVx += kbX; enemy.pushVy += kbY;` followed by `applyDamage(enemyId, ..., kbX, kbY)` which also adds to `pushVx`/`pushVy`).
- `src/core/weapons/WeaponManager.ts`:
  - Orchestrates up to 6 weapons with decoupled auto-fire simulation and canvas rendering.
  - Instantiates `public readonly projectilePool: ProjectilePool = new ProjectilePool(256);` at line 29, but `BoneSpear` maintains its own dedicated `ProjectilePool(256)` and ignores the pool parameter in `update()`.

#### B. Upgrade & Synergy Interaction (`src/core/systems/UpgradeSystem.ts`)
- `UpgradeSystem.evolveWeapon` lines 500–509:
  ```ts
  public evolveWeapon(baseWeaponId: string, evolutionId: string): void {
    const normBase = normalizeItemId(baseWeaponId);
    const weapon = this.weapons.get(normBase);
    if (weapon) {
      this.weapons.delete(normBase); // <--- DELETES BASE WEAPON FROM MAP
      const normEvo = normalizeItemId(evolutionId);
      this.weapons.set(normEvo, {
        rank: 5,
        isEvolution: true,
        rawId: evolutionId,
      });
    }
  }
  ```
- `UpgradeSystem.generateUpgradeCards` lines 574–605:
  ```ts
  const canAddWeapon = this.weapons.size < UpgradeSystem.MAX_WEAPON_SLOTS;
  for (const weapon of Object.values(OCCULT_WEAPONS)) {
    const normW = normalizeItemId(weapon.id);
    const rank = this.getWeaponRank(normW); // <--- Returns 0 because normBase was deleted!
    const isEvolved = this.isWeaponEvolved(normW); // <--- Returns false because normBase was deleted!

    if (isEvolved) continue;

    if (rank > 0 && rank < 5) {
      ...
    } else if (rank === 0 && canAddWeapon) {
      candidates.push({ ... WEAPON_UNLOCK ... }); // <--- Base weapon re-offered as a new unlock!
    }
  }
  ```
- `UpgradeSystem.sampleWeightedCards` lines 723–752:
  - Evolution card weight is 3.5.
  - Unowned weapons and passives have weight 1.0 (totaling 8.0 weight across 8 unowned items).
  - Probability of missing the evolution card in 4 draws is $(8/11.5) \times (7/10.5) \times (6/9.5) \times (5/8.5) \approx 17.2\%$.

---

## 2. Logic Chain

1. **Verification of Weapon Core**:
   - `src/core/weapons/` satisfies all technical specifications:
     - Projectile pooling operates at zero heap allocations using pre-allocated arrays and swap-and-pop recycling.
     - Projectile hit memory uses `Int16Array(16)`, preventing duplicate hits on enemies up to ID 32,767 without object allocations.
     - Cooldown reduction strictly enforces the 50% hard clamp (`Math.min(0.50, Math.max(0.0, cdr))`).
     - Damage scales proportionally with player Might multiplier.
     - All 5 base weapons and 5 evolutions have authentic dark fantasy mechanics.
2. **Detection of Defect 1 (Evolved Base Weapon Zombie Re-Offering)**:
   - When a player evolves a weapon (e.g. Arcane Scythe into Soul Reaping Harvester), `UpgradeSystem.evolveWeapon` deletes `'scythe'` from `this.weapons` and adds `'soul_reaping_harvester'`.
   - On subsequent level-ups, `generateUpgradeCards` queries `getWeaponRank('scythe')` and `isWeaponEvolved('scythe')`. Both return false/0 because `'scythe'` is no longer in `this.weapons`.
   - If the player has $< 6$ weapons equipped (which they do, having only 1 evolution), `canAddWeapon` is true.
   - Consequently, `generateUpgradeCards` generates a `WEAPON_UNLOCK` card for Arcane Scythe.
   - If the player selects this card, `applyUpgrade` calls `weaponManager.setWeaponRank('scythe', 1)`, resetting the existing weapon rank and causing severe state corruption.
3. **Detection of Defect 2 (Flaky Test Failure in `UpgradeSystem.test.ts`)**:
   - `UpgradeSystem.test.ts` line 142 calls `generateUpgradeCards(4)` and asserts that the evolution card is defined.
   - Because `sampleWeightedCards` uses random sampling where evolution weight is 3.5 and other candidate weight is 8.0, the evolution card is missed in approximately 17.2% of test runs.
   - This causes `npm test` to fail intermittently, violating the requirement of 100% green tests.

---

## 3. Findings

### [Major] Finding 1: Evolved Base Weapon Re-Offered as New Unlock
- **Where**: `src/core/systems/UpgradeSystem.ts:500-509`, `574-605`
- **Why**: `evolveWeapon` deletes the base weapon key from `this.weapons`. As a result, `getWeaponRank(baseWeapon)` returns 0 and `isWeaponEvolved(baseWeapon)` returns false. When weapon slots are below 6, the card generator offers the base weapon again as a new unlock. If selected, it resets the evolved weapon in `WeaponManager` back to Rank 1.
- **Suggestion**:
  1. Do not delete `normBase` from `this.weapons` in `UpgradeSystem.ts`. Instead, mark `weapon.isEvolution = true` and `weapon.rank = 5`, or maintain an `evolvedBaseWeapons: Set<string>` that prevents re-offering.
  2. Ensure `isWeaponEvolved(weaponId)` checks whether the weapon or its base has been evolved.

### [Major] Finding 2: Flaky Evolution Card Generation Test in `UpgradeSystem.test.ts`
- **Where**: `src/core/systems/UpgradeSystem.ts:729-733`, `tests/unit/UpgradeSystem.test.ts:142-145`
- **Why**: `sampleWeightedCards` assigns weight 3.5 to evolutions and 1.0 to other cards. When 8 other cards exist in the pool, the chance of not drawing the evolution card in 4 picks is ~17.2%. This produces intermittent test failures in CI.
- **Suggestion**:
  1. When an evolution is eligible, guarantee that it is always included in the returned cards (or assign it a sufficiently high priority/forced slot), OR
  2. Add an option/method to generate cards deterministically or mock the random generator in the unit test.

### [Minor] Finding 3: Double Knockback Application in `CursedAura.ts`
- **Where**: `src/core/weapons/CursedAura.ts:152-155`
- **Why**: `enemy.pushVx += kbX; enemy.pushVy += kbY;` is executed directly on the enemy, and immediately afterward `this.hordeManager.applyDamage(enemyId, effectiveDamage, kbX, kbY)` is called, which also applies `knockbackX / this.mass` to `pushVx`/`pushVy`. This applies knockback twice.
- **Suggestion**: Remove the explicit `enemy.pushVx += kbX; enemy.pushVy += kbY;` in `CursedAura.ts` and let `applyDamage` handle impulse application uniformly.

### [Minor] Finding 4: Redundant ProjectilePool Allocation in `WeaponManager.ts`
- **Where**: `src/core/weapons/WeaponManager.ts:29`, `src/core/weapons/BoneSpear.ts:26`
- **Why**: `WeaponManager` allocates a `ProjectilePool(256)`, while `BoneSpear` also instantiates its own `ProjectilePool(256)` and ignores the pool passed into `update(_pool)`. This allocates 256 unnecessary projectile objects in `WeaponManager`.
- **Suggestion**: Either have `BoneSpear` consume the pooled projectiles provided by `WeaponManager`, or document `BoneSpear`'s dedicated pool ownership and remove the unused pool in `WeaponManager`.

### [Minor] Finding 5: Ephemeral Heap Allocations in VFX Helpers
- **Where**: `src/core/weapons/ArcaneScythe.ts:210`, `src/core/weapons/AbyssalLightning.ts:257, 282`
- **Why**: `ArcaneScythe` pushes a new object literal to `this.activeSlashes` each time it fires, and `AbyssalLightning` creates an array of segments for each strike.
- **Suggestion**: While firing frequencies are low (~1 Hz) and objects are short-lived (< 200ms), pre-allocating a small visual pool (e.g. 8 slashes, 16 bolts) would achieve strict 100% zero-garbage compliance.

---

## 4. Integrity Verification

| Check | Expected | Actual | Result |
| :--- | :--- | :--- | :--- |
| Hardcoded test results in source | None | None found | PASS |
| Dummy or facade implementations | None | Real physics, spatial hashing, and kinematics | PASS |
| Bypassed mechanics | None | Full auto-fire timers, stats scaling, pooling | PASS |
| Fabricated verification logs | None | Verified live test commands | PASS |
| Self-certifying shortcuts | None | Full test suite with genuine assertions | PASS |

No integrity violations detected.

---

## 5. Verified Claims

| Claim | Verification Method | Result |
| :--- | :--- | :--- |
| TypeScript check passes | `npx tsc --noEmit` | PASS (Exit code 0) |
| Vite production build compiles | `npm run build` | PASS (Built in 963ms) |
| Weapon suite tests pass | `npx vitest run tests/unit/Weapons.test.ts` | PASS (11/11 tests pass) |
| Wave director tests pass | `npx vitest run tests/unit/WaveDirector.test.ts` | PASS (15/15 tests pass) |
| Zero-allocation ProjectilePool | `Projectile.ts` code audit & tests | PASS (256 capacity, O(1) swap-and-pop) |
| Intrusive hit memory buffer | `Projectile.ts:31` (`Int16Array(16)`) | PASS (No per-hit allocations) |
| 50% Cooldown Reduction Cap | `Weapon.ts:87` & `Weapons.test.ts:176` | PASS (Clamped to 0.50 max) |
| Might scaling multiplier | `Weapon.ts:77` & `Weapons.test.ts:183` | PASS (Scaled proportionally) |
| 5 Weapons + 5 Evolutions defined | `src/core/weapons/*.ts` inspection | PASS (All 5 ranks + evolutions complete) |
| Overall Test Suite Stability | `npm test` across multiple runs | FAIL (Intermittent failure in `UpgradeSystem.test.ts`) |

---

## 6. Caveats

- No caveats regarding `src/core/weapons/`. The weapon mechanics, rendering, and math were inspected in full detail.
- Code review strictly honored the review-only constraint: no source files were modified by Reviewer 1.

---

## 7. Conclusion

Milestone M3 demonstrates outstanding work on the Occult Arsenal core (`src/core/weapons/`), with clean zero-garbage pooling, authentic dark fantasy aesthetics, and rock-solid stat scaling. However, because `npm test` fails intermittently due to a 17% flakiness rate in `UpgradeSystem.test.ts`, and because evolving a weapon causes the base weapon to be re-offered as a new unlock, the verdict is **REQUEST_CHANGES**.

Once Worker remediates Finding 1 (base weapon tracking on evolution) and Finding 2 (deterministic evolution card offering in tests), Milestone M3 will achieve 100% test reliability and full production readiness.

---

## 8. Verification Method for Remediation

1. Run TypeScript check: `npx tsc --noEmit` (Must exit code 0).
2. Run full test suite 5 consecutive times to verify elimination of flakiness:
   `for i in {1..5}; do npx vitest run || break; done`
3. Verify evolved weapon does not reappear in card generation:
   Assert that after calling `evolveWeapon('scythe', 'evolution_harvester')`, `generateUpgradeCards()` never includes `'weapon_scythe'` as a candidate.
4. Run production build: `npm run build` (Must exit code 0).
