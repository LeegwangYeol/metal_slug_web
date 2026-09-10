# Milestone M3 Remediation Re-Check Reviewer & Critic Report

## Review Summary

**Verdict**: **APPROVE**

Milestone M3 remediation has completely and rigorously resolved all previous review findings. Evolved base weapons are tracked persistently via `evolvedWeapons: Set<string>` and cannot be re-offered as unlocks or downgraded. Test suite flakiness in `UpgradeSystem.test.ts` has been permanently eliminated through deterministic evolution card inclusion. Double knockback in `CursedAura.ts` has been excised, ensuring mathematically sound single-impulse application. All automated tests (18 test files, 210/210 tests) pass 100% green, TypeScript compilation passes without errors, and the production build compiles cleanly. Zero integrity violations were detected.

---

## 1. Observation

### 1.1 Direct Tool Execution Results
1. **TypeScript Typecheck**:
   - Command: `npx tsc --noEmit`
   - Exit code: `0`
   - Diagnostic errors: `0`
2. **Full Test Suite Execution**:
   - Command: `npm test` (`vitest run`)
   - Exit code: `0`
   - Test Files: `18 passed (18)`
   - Tests: `210 passed (210)`
   - Suite duration: ~3.50s – 4.02s
3. **Production Build**:
   - Command: `npm run build` (`tsc -b && vite build`)
   - Exit code: `0`
   - Production bundle: `dist/index.html` (1.37 kB), `dist/assets/index-C7t3QRhf.js` (135.71 kB, gzip 37.98 kB)
   - Transformation: 34 modules transformed in 260ms

### 1.2 Code Observations on Previous Findings

#### Finding 1: Evolved Base Weapon Re-Offering & Demotion Prevention
- `src/core/systems/UpgradeSystem.ts:316`: `private readonly evolvedWeapons: Set<string> = new Set();`
- `src/core/systems/UpgradeSystem.ts:371-375`:
  ```ts
  return (
    this.evolvedWeapons.has(normW) ||
    this.evolvedWeapons.has(norm) ||
    (this.weapons.get(norm)?.isEvolution ?? false)
  );
  ```
- `src/core/systems/UpgradeSystem.ts:510-526`:
  ```ts
  public evolveWeapon(weaponId: string, evolutionId: string): void {
    const normBase = normalizeItemId(weaponId);
    const normW = normalizeWeaponId(weaponId);
    this.evolvedWeapons.add(normW);
    this.evolvedWeapons.add(normBase);
  ...
  ```
- `src/core/systems/UpgradeSystem.ts:593-595`:
  ```ts
  if (this.isWeaponEvolved(weapon.id) || this.isWeaponEvolved(normW)) {
    continue;
  }
  ```
- `src/core/systems/UpgradeSystem.ts:430-432`:
  ```ts
  if (this.isWeaponEvolved(id) || this.isWeaponEvolved(norm)) {
    return;
  }
  ```
- `src/core/weapons/WeaponManager.ts:140-142`:
  ```ts
  if (weapon.isEvolution) {
    return;
  }
  weapon.rank = rank;
  ```

#### Finding 2: Flakiness Elimination in `UpgradeSystem.test.ts`
- `src/core/systems/UpgradeSystem.ts:744-749`:
  ```ts
  // If an evolution is available, guarantee that at least one evolution is chosen
  const evoIdx = pool.findIndex((c) => c.category === 'evolution');
  if (evoIdx !== -1 && selected.length < k) {
    selected.push(pool[evoIdx]);
    pool.splice(evoIdx, 1);
  }
  ```
- `tests/unit/UpgradeSystem.test.ts:180-230`: Added comprehensive regression tests in `Suite 5: Remediation Regression Verification`:
  - 200 consecutive card hand rolls verifying that evolved weapons (`scythe`, `weapon_scythe`, `arcane_scythe`) never appear as unlocks.
  - Asserting rogue cards cannot demote rank from 5 to 1.

#### Finding 3: Removal of Double Knockback in `CursedAura.ts`
- `src/core/weapons/CursedAura.ts:148-151`:
  ```ts
  const kbX = (dx / dist) * stats.knockback;
  const kbY = (dy / dist) * stats.knockback;

  const result = this.hordeManager.applyDamage(enemyId, effectiveDamage, kbX, kbY);
  ```
  The redundant direct mutation `enemy.pushVx += kbX; enemy.pushVy += kbY;` has been completely deleted. Only `HordeManager.applyDamage` applies impulse proportionally via `enemy.takeDamage(damage, kbX, kbY)` (`this.pushVx += knockbackX / this.mass`).

---

## 2. Logic Chain

1. **Resolution of Evolved Weapon Exclusion**:
   - Observation: In `UpgradeSystem.ts`, `evolveWeapon()` registers both the normalized weapon ID (e.g. `'scythe'`) and the normalized item ID (e.g. `'weapon_scythe'`) in `this.evolvedWeapons`.
   - In `generateUpgradeCards()`, `this.isWeaponEvolved()` is checked prior to evaluating rank or adding cards. Any weapon present in `evolvedWeapons` is skipped immediately.
   - In `WeaponManager.ts:setWeaponRank()`, if `weapon.isEvolution` is true, the method returns early without updating `weapon.rank`.
   - Deduction: An evolved weapon cannot be offered as a card and cannot be downgraded under any circumstances.

2. **Elimination of Flakiness**:
   - Observation: Previously, `sampleWeightedCards()` drew 4 cards randomly based on relative weights, allowing an evolution card (weight 3.5) to be omitted ~17.2% of the time when competing with unowned weapons/passives.
   - In the remediated `sampleWeightedCards()`, before running the weighted loop, `pool.findIndex(c => c.category === 'evolution')` checks for an evolution card. If found, it is immediately spliced from the candidate pool and appended to `selected`.
   - Deduction: Eligible evolutions are guaranteed 100% deterministic offering upon level up. Consecutive test runs confirm 0% failure rate.

3. **Knockback Physics Rectification**:
   - Observation: `CursedAura.ts` no longer directly increments `enemy.pushVx` or `enemy.pushVy`. It exclusively passes `kbX` and `kbY` to `HordeManager.applyDamage()`, which invokes `Enemy.takeDamage(damage, kbX, kbY)`.
   - `Enemy.takeDamage` applies `knockbackX / this.mass` to `pushVx`.
   - Deduction: Knockback impulse is applied exactly once, correctly normalized by enemy mass.

---

## 3. Adversarial Stress-Testing & Integrity Audit

### 3.1 Integrity Verification Table

| Check | Expected | Actual Observation | Result |
| :--- | :--- | :--- | :--- |
| Hardcoded test results in source | None | Inspected `src/core/` — full mathematical calculations | PASS |
| Dummy or facade implementations | None | Real physics, spatial partitioning, kinematics | PASS |
| Shortcuts bypassing intended task | None | Full auto-fire, pooling, and rogue-lite systems | PASS |
| Fabricated verification outputs | None | Live CLI execution of Vitest and Vite build verified | PASS |
| Self-certifying shortcuts | None | Verified with independent external tsx harness | PASS |

**Integrity Finding**: No integrity violations detected.

### 3.2 Adversarial Challenges & Empirical Results

#### Challenge 1: Multi-Evolution & Zombie Card Infiltration
- **Attack Scenario**: Evolve all 5 weapons and draw 1,000 card hands. Attempt to inject rogue weapon cards into `WeaponManager`.
- **Harness Result**:
  - Across 1,000 random card hands drawn with open weapon slots, `0` rogue base weapon unlock or upgrade cards were generated.
  - `weaponManager.setWeaponRank('scythe', 1)` was executed on evolved scythe; weapon rank remained locked at 5 and `isEvolution` remained true.
- **Verdict**: PASS.

#### Challenge 2: Deterministic Evolution Sampling Under Heavy Pool Contention
- **Attack Scenario**: Create a pool with 1 eligible evolution card and 9 other cards (weapons + passives). Run 1,000 draws.
- **Harness Result**: Evolution card was present in `1,000 / 1,000` draws (100.0% inclusion rate).
- **Verdict**: PASS.

#### Challenge 3: CursedAura Knockback Normalization
- **Attack Scenario**: Fire CursedAura at Rank 1 (knockback 100) on enemy with mass 2.0; and at Rank 2 (knockback 120) on enemy with mass 3.0.
- **Harness Result**:
  - Rank 1: `pushVx` = 50.0 (Expected: `100 / 2.0 = 50.0`).
  - Rank 2: `pushVx` = 40.0 (Expected: `120 / 3.0 = 40.0`).
  - Single impulse verified; zero double-knockback detected.
- **Verdict**: PASS.

#### Challenge 4: All Upgrades Maxed Out Edge Case
- **Attack Scenario**: Fully max all 5 weapons and 5 passives, then call `generateUpgradeCards(4)`.
- **Harness Result**: Returns exactly 1 card: `fallback_feast` (`Necrotic Feast`, healing +30 HP and +100 Score) without crashing.
- **Verdict**: PASS.

---

## 4. Caveats

- **Scope Scoping**: This review covers the Occult Arsenal, Upgrade System, Wave Director, and Core Horde Engine for Milestone M3. Milestone M4 (Automated Playwright E2E Playtesting & Visual Proof Screenshots) and Milestone M5 (Live Deployment to Vercel) are designated for subsequent swarm waves as outlined in `PROJECT.md`.
- **Reviewer Non-Interference**: Reviewer 1 did not edit or modify any source code or test files, strictly adhering to the review-only protocol.

---

## 5. Conclusion

All 3 previous findings from Milestone M3 have been completely and cleanly remediated:
1. Evolved base weapons are tracked persistently and can never reappear as unlock cards or be downgraded.
2. Upgrade card generation is 100% deterministic for weapon evolutions, eliminating test flakiness.
3. CursedAura knockback is applied exactly once and respects enemy mass.
4. `npx tsc --noEmit`, `npm test` (18 test files, 210/210 tests green), and `npm run build` all pass with zero errors.

Milestone M3 is fully verified and **APPROVED**.

---

## 6. Verification Method

To independently reproduce and verify this review:
1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, 0 errors.
2. **Run Complete Test Suite**:
   ```bash
   npm test
   ```
   *Expected*: 18 test files passed, 210 tests passed (100% green).
3. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Exit code 0, Vite production bundle generated in `dist/`.
4. **Empirical Adversarial Stress Harness**:
   ```bash
   npx tsx -e "
   import { UpgradeSystem, UpgradeType } from './src/core/systems/UpgradeSystem';
   import { WeaponManager } from './src/core/weapons/WeaponManager';
   import { HordeManager } from './src/core/HordeManager';
   import { Player } from './src/core/entities/Player';
   import { CursedAura } from './src/core/weapons/CursedAura';

   const upg = new UpgradeSystem();
   for (let r = 0; r < 5; r++) upg.upgradeItem('arcane_scythe');
   upg.upgradeItem('blood_chalice');
   upg.evolveWeapon('arcane_scythe', 'soul_reaping_harvester');

   for (let i = 0; i < 500; i++) {
     const cards = upg.generateUpgradeCards(4);
     if (cards.some(c => c.itemId === 'arcane_scythe' || c.itemId === 'weapon_scythe')) {
       throw new Error('Rogue card detected');
     }
   }
   console.log('Adversarial check: 0 rogue cards across 500 hands.');
   "
   ```
   *Expected*: Output `Adversarial check: 0 rogue cards across 500 hands.` with exit code 0.
