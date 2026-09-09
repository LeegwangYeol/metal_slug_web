# Forensic Audit Report: Milestone M2 Iteration 2 (Autonomous Ally NPCs & Diverse Items/Weapons)

- **Agent**: `teamwork_preview_auditor` (`auditor_m2_2`)
- **Role**: Forensic Auditor / Critic / Specialist
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_m2_2`
- **Target Work Product**: Milestone M2 Round 2 remediation by `worker_m2_2`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Audit Date**: 2026-09-08
- **Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)
- **Binary Verdict**: **CLEAN**

---

## Forensic Audit Report Summary

```markdown
## Forensic Audit Report

**Work Product**: Milestone M2 Iteration 2 (AllyNPC, RocketLauncherWeapon, tests)
**Profile**: General Project (Development Mode per ORIGINAL_REQUEST.md)
**Verdict**: CLEAN

### Phase Results
- [Hardcoded output detection]: PASS — Zero hardcoded cheats, fake returns, or test bypasses in src/core/
- [Facade detection]: PASS — Genuine physics, kinematics, trigonometry, and state machine simulation logic across all entities
- [Pre-populated artifact detection]: PASS — No pre-populated logs, mock traces, or test results found
- [Build from source]: PASS — `npm run build` and `npx tsc --noEmit` succeed cleanly with exit code 0
- [Unit test suite execution]: PASS — 100% green across all 30 test files and 373 unit/stress tests (including 59 M2 tests)
- [E2E test suite execution]: PASS — 100% green across all 17 Playwright browser tests (13.1s)
- [164-Key baseline invariant]: PASS — `ProceduralSpriteFactory.getAllKeys()` returns exactly 164 unique sprite keys

### Evidence
[See Section 1 (Observation) and Section 5 (Verification Method) below]
```

---

## 1. Observation

### 1.1 Source Code and Git Diff Analysis

A thorough forensic audit of the changes implemented by `worker_m2_2` was conducted:

1. **Pending Player Fallback in `src/core/entities/allies/AllyNPC.ts`**:
   Lines 56–61:
   ```typescript
   let player = engine.getEntity('player') as any;
   if (!player && Array.isArray((engine as any).entitiesToAdd)) {
     player = (engine as any).entitiesToAdd.find(
       (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
     );
   }
   ```
   - Verifiable Observation: If `player` has been added to `engine.entitiesToAdd` but `engine.tick()` has not yet committed it to `engine.entities`, `AllyNPC.update()` now resolves the entity without stalling in `IDLE`.

2. **Target Priority Ordering in `src/core/entities/allies/AllyNPC.ts`**:
   Lines 271–276:
   ```typescript
   let priorityWeight = 10;
   if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
     priorityWeight = 50;
   } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
     priorityWeight = 100;
   }
   ```
   - Verifiable Observation: Reversing the evaluation order ensures `MID_BOSS_VEHICLE` receives weight 50 ($5,000$ base score) rather than matching `typeStr.includes('BOSS')` first, allowing end bosses (`TETSUYUKI_BOSS`, weight 100, $10,000$ base score) to strictly outrank mid-bosses.

3. **Epsilon Lifetime Comparison in `src/core/weapons/RocketLauncherWeapon.ts`**:
   Lines 38–42:
   ```typescript
   this.lifeTime -= dt;
   if (this.lifeTime <= 1e-4) {
     this.detonate(engine);
     return;
   }
   ```
   - Verifiable Observation: In IEEE-754 arithmetic, $2.5 - 150 \times \frac{1}{60} = +3.8788 \times 10^{-15} > 0$. Using `1e-4` guarantees exact frame-150 detonation under 60Hz Euler integration while keeping the rocket alive on frame 149 ($\text{remaining} \approx 0.0167 > 10^{-4}$).

4. **Test Suite Verification in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`**:
   - Line 154: Strict assertion enforced:
     ```typescript
     expect(best?.id).toBe('test_boss');
     ```
   - Line 364: Direct addition without bypass:
     ```typescript
     smallEngine.addEntity(leadPlayer);
     // Manual map bypass (smallEngine as any).entities.set(...) has been completely eliminated
     ```
   - Lines 458–468: Frame-exact detonation verified:
     ```typescript
     for (let i = 0; i < 149; i++) {
       rocket.update(1 / 60, engine);
       expect(rocket.isAlive).toBe(true);
     }
     rocket.update(1 / 60, engine);
     expect(rocket.isAlive).toBe(false);
     expect(explosionSpawned).toBe(true);
     ```

### 1.2 Invariant Verification: 164-Key Baseline

Direct programmatic execution via `npx tsx`:
```bash
npx tsx -e "import { ProceduralSpriteFactory } from './src/render/sprites/ProceduralSpriteFactory'; const factory = new ProceduralSpriteFactory(); const keys = factory.getAllKeys(); const set = new Set(keys); console.log('Unique keys:', set.size, 'Total keys:', keys.length);"
```
Output:
```text
Unique keys: 164 Total keys: 164
```
Vitest Oracle verification in `tests/unit/adversarial_sprites_crosshairs.test.ts`:
```text
[Oracle 1A] Total Registered Sprite Keys: 164
[Category Audit 1E] Verified Breakdown: {
  player: 67,
  rebel: 21,
  pow: 9,
  ironTechnical: 7,
  tetsuyuki: 8,
  projectile: 13,
  casings: 4,
  explosions: 18,
  hud: 17,
  total: 164
}
Test Files  1 passed (1)
     Tests  17 passed (17)
```
The 164-key baseline invariant is 100% intact.

### 1.3 Compilation and Build Verification

1. `npx tsc --noEmit`:
   - Exit code: `0` (clean, zero errors or warnings).
2. `npm run build` (`tsc -b && vite build`):
   - Exit code: `0` (built in 280ms).
   - Artifacts: `dist/index.html` (1.26 kB), `dist/assets/index-B8gaD6WE.js` (206.37 kB).

### 1.4 Test Suite Execution

1. **Milestone M2 Unit Test Suites**:
   - Command: `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
   - Result: 5 test files passed, 59 of 59 tests passing (100% green).
2. **Full Unit Test Suite**:
   - Command: `npx vitest run`
   - Result: 30 test files passed, 373 of 373 tests passing (100% green).
3. **Playwright E2E Test Suite**:
   - Command: `npx playwright test`
   - Result: 17 of 17 tests passed (13.1s), all screenshots captured with valid file sizes.

---

## 2. Logic Chain

1. **Ground-Truth Integrity Mandate**:
   `ORIGINAL_REQUEST.md` establishes `Integrity mode: development`. Under Development Mode, the primary prohibited patterns are hardcoded test results, facade dummy implementations, and fabricated verification artifacts.
2. **Empirical Verification of Fixes**:
   - The pending player resolution fallback in `AllyNPC.ts` enables the ally to discover the player during initialization before the first engine commit tick flushes `entitiesToAdd`.
   - Re-ordering the priority checks in `AllyNPC.ts` resolves the string collision between `MID_BOSS_VEHICLE` and `BOSS`, strictly granting end bosses priority weight 100 over mid-bosses (weight 50).
   - The epsilon threshold $10^{-4}\text{s}$ in `RocketLauncherWeapon.ts` compensates for IEEE-754 precision loss while remaining two orders of magnitude smaller than a single frame duration ($16.67\text{ ms}$), enabling clean frame-150 termination.
   - The empirical challenge test `tests/unit/m2_ally_rocket_empirical_challenge.test.ts` now tests the engine natively without any manual hash map injections or bypassed assertions.
3. **No Prohibited Patterns**:
   - Zero hardcoded mock returns or fake branches exist in `src/core/`.
   - Zero test bypasses or pre-populated result files exist.
   - The 164-key baseline invariant in `ProceduralSpriteFactory` is completely preserved.
4. **Conclusion**:
   All checks pass without a single failure or integrity violation. The binary verdict is **CLEAN**.

---

## 3. Caveats

- **Scope Boundary**: Milestone M2 implements gameplay mechanics for allies, diverse weapons, and pickups. The Ultimate Move cinematic presentation and expansion sprites belong to Milestone M3 as planned in `PROJECT.md`.
- **Epsilon Tolerance**: The epsilon comparison $10^{-4}$ in `RocketLauncherWeapon` is calibrated for timesteps $\Delta t \ge 0.0001\text{s}$ ($\le 10\text{ kHz}$), which encompasses all standard browser refresh rates (30Hz, 60Hz, 120Hz, 144Hz, 240Hz).

---

## 4. Conclusion

Milestone M2 Iteration 2 work products submitted by `worker_m2_2` have been forensically audited and verified. All code changes are authentic, robust, mathematically sound, and fully compliant with project integrity standards.

**Binary Forensic Verdict**: **CLEAN**

Milestone M2 is officially certified as complete, and the project is cleared to proceed to Milestone M3 (Ultimate Move System & Cinematic Presentation FX).

---

## 5. Verification Method

To independently verify all findings:

```bash
# 1. Type Check
npx tsc --noEmit

# 2. Production Build
npm run build

# 3. Sprite Factory 164-Key Invariant Check
npx tsx -e "import { ProceduralSpriteFactory } from './src/render/sprites/ProceduralSpriteFactory'; const factory = new ProceduralSpriteFactory(); console.log('Sprite Keys:', factory.getAllKeys().length);"

# 4. Milestone M2 Unit & Challenger Tests (59 tests)
npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts

# 5. Full Project Unit Suite (373 tests)
npx vitest run

# 6. Full Playwright E2E Suite (17 tests)
npx playwright test
```

### Invalidation Conditions
- If `ProceduralSpriteFactory.getAllKeys()` returns anything other than 164.
- If `AllyNPC.findBestTarget()` assigns higher score to `MID_BOSS_VEHICLE` over `TETSUYUKI_BOSS` when equidistant.
- If `PlayerRocketProjectile` fails to detonate at frame 150 under 60Hz Euler integration.
