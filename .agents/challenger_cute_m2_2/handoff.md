# Challenger 2 Empirical Stress Assessment (Milestone M2: "Sugar Pop Blossom")

## 1. Observation

### Scope & Tasks
Adversarially stress-tested Mochi Pet Companion numerical stability across extreme delta-t values, candy vacuuming algorithms with 100+ scattered pickups, 3 Blossom Altars purification logic, and 3-card rogue-lite perk selection under rapid keyboard input.

### Empirical Evidence & Findings

1. **PetCompanion Spring Damping Stability across Extreme Delta-T**:
   - Tested in `tests/unit/challenger_cute_m2_2_stress.test.ts` (Tests 1A–1E):
     - Logarithmic sweep: `dt in [1e-6, 1e-5, 1e-4, 0.001, 0.005, 0.016, 0.033, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0]`.
     - Output: `Number.isFinite(pet.x) === true`, `Number.isFinite(pet.y) === true`, `pet.vx` and `pet.vy` strictly finite with 0 NaN / 0 Inf coordinates.
     - Sudden +50,000px player teleportation with 10.0s dt lag spike: Mochi smoothly integrated over 600 substeps without coordinate explosion (`49000 < pet.x < 51000`).
     - 1,000 violently fluctuating steps (`dt` oscillating between 0.001s and 3.0s): converged stably to player anchor (`x ~= 408, y ~= 180 +/- 8`).
   - **[Vulnerability 1 - NaN Propagation]**:
     - Location: `src/core/cute/PetCompanion.ts:76`
       ```ts
       76: this.time += dt;
       ...
       88: const targetY = player.y - 30 + Math.sin(this.time * 3.5) * 8;
       ```
     - Verbatim Test 1F output:
       If `dt = NaN`, `this.time` becomes `NaN`. In subsequent normal frames (`dt = 1/60`), `Math.sin(NaN * 3.5)` yields `NaN`, causing `targetY = NaN`, which permanently corrupts `pet.y` to `NaN`.
   - **[Vulnerability 2 - Infinite Loop / DoS on Infinite dt]**:
     - Location: `src/core/cute/PetCompanion.ts:93-105`
       ```ts
       93: let remainingDt = dt;
       94: while (remainingDt > 0) {
       95:   const stepDt = Math.min(remainingDt, 1 / 60);
       ...
       104:  remainingDt -= stepDt;
       105: }
       ```
     - If `dt = Infinity`, `Math.min(Infinity, 1/60) = 1/60`. `Infinity - 1/60 === Infinity`. The loop runs forever, locking the browser main thread. Missing `Math.min(dt, 1.0)` or loop iteration count ceiling.

2. **Candy Vacuuming Algorithm with 100+ Pickups**:
   - Tested in `tests/unit/challenger_cute_m2_2_stress.test.ts` (Tests 2A–2D):
     - 150 scattered pickups: pickups within 160px vacuum radius were correctly accelerated towards Mochi; pickups outside 160px remained static.
     - `STAR_MAGNET` perk: successfully expanded vacuum radius to 320px for 200 pickups.
     - 500 active pickups benchmark: 10 simulation frames completed in 28ms (average < 3ms/frame, well within 16.6ms frame budget).
   - **[BUG 1 - Array Mutation Skip in Forward Loop]**:
     - Location: `src/core/cute/PetCompanion.ts:118-139`
       ```ts
       118: for (const pickup of bubbleManager.pickups) {
       ...
       135:   if (dist < 22) {
       136:     bubbleManager.collectPickup(pickup.id);
       137:   }
       138: }
       ```
     - Location: `src/core/cute/BubbleManager.ts:329`
       ```ts
       328: pickup.isAlive = false;
       329: this.pickups.splice(idx, 1);
       ```
     - Empirical Observation (Test 2B):
       When 4 pickups are co-located within collection radius (< 22px):
       - Frame 1: Index 0 collected & spliced -> index 1 shifts to index 0. The forward iterator advances to index 1 (originally index 2). The pickup now at index 0 is SKIPPED. Result: only 2 of 4 pickups collected.
       - Frame 2: Index 0 collected & spliced -> index 1 shifts to index 0. Forward iterator advances. Pickup at index 0 is SKIPPED AGAIN. Result: 1 pickup remains.
       - Frame 3: Final pickup collected.
       It requires 3 whole simulation frames (50ms) to collect 4 co-located pickups. Contrast with `BubbleManager.ts:274` which properly uses backward iteration: `for (let i = this.pickups.length - 1; i >= 0; i--)`.

3. **3 Blossom Altars Purification & 3-Card Perk Selection**:
   - Tested in `tests/unit/challenger_cute_m2_2_stress.test.ts` (Tests 3A–3J):
     - Altar radius boundary: pop at 179px purifies altar; pop at 181px does not.
     - Multi-altar overlap: bubble pop at `(350, 185)` successfully purifies both Lotus Altar (dist 154px) and Sun Meadow Altar (dist 154px) simultaneously.
     - Bloom idempotency: 50 pops at bloomed altar triggered `onAltarBloomed` exactly once.
     - Garden bloom: all 3 altars bloomed triggered `onGardenFullyBloomed` exactly once.
     - 200 random perk draws: 100% produced 3 unique cards from `PERK_POOL`.
     - Rapid keyboard input spam (100 presses of '1', '2', '3'): exactly 1 perk was granted, modal cleanly closed, and state resumed to `WAVE_ACTIVE`.
   - **[BUG 2 - Unhandled NaN Index in `selectCard` Throws TypeError]**:
     - Location: `src/core/cute/SweetPerkManager.ts:104-109`
       ```ts
       104: if (!this.isModalActive || index < 0 || index >= this.availableCards.length) {
       105:   return null;
       106: }
       107:
       108: const card = this.availableCards[index];
       109: const currentLevel = this.acquiredPerks.get(card.id) ?? 0;
       ```
     - Verbatim Test 3H output:
       ```
       TypeError: Cannot read properties of undefined (reading 'id')
        ❯ SweetPerkManager.selectCard src/core/cute/SweetPerkManager.ts:109:54
       ```
     - In JavaScript, `NaN < 0` is `false` and `NaN >= 3` is `false`. Thus, the guard is bypassed! `this.availableCards[NaN]` returns `undefined`, and accessing `card.id` crashes the engine. Missing `typeof index !== 'number' || !Number.isInteger(index)` or `if (!card) return null;`.

4. **Integration with Challenger 1 Findings**:
   - Running `npm test` reveals 5 additional failing tests in `tests/unit/adversarial_cute_m2_challenge.test.ts` regarding Colossus Boss defeat, cub splitting, and state transition deadlocks in `CuteArenaCoordinator.ts`.

---

## 2. Logic Chain

1. **Step 1 (Pet Kinematics)**: The sub-stepped Euler integration in `PetCompanion.ts` (`stepDt = Math.min(remainingDt, 1/60)`) provides numerical stability across all finite `dt` values between $10^{-6}$ and $10.0$ seconds. However, the absence of input sanitation on `dt` allows `NaN` and `Infinity` to cause permanent coordinate corruption or infinite loop hangs.
2. **Step 2 (Collection Array Mutation)**: `BubbleManager.collectPickup()` mutates `this.pickups` via `splice(idx, 1)`. In `PetCompanion.ts`, iterating with `for (const pickup of bubbleManager.pickups)` mutates the iterated array in-place, causing index-skipping on every collection. While this does not crash the game, it delays pickup collection across multiple frames and introduces non-deterministic collection ordering.
3. **Step 3 (Perk Bounds Check Flaw)**: The guard `index < 0 || index >= this.availableCards.length` assumes `index` is a comparable ordered number. When `index` is `NaN`, both relational comparisons return `false`, allowing execution to pass the guard and attempt property access on `undefined`.
4. **Step 4 (Impact Assessment)**: Both BUG 1 and BUG 2 affect gameplay stability and core loop reliability, complementing the boss defeat deadlocks discovered by Challenger 1.

---

## 3. Caveats

- Tests were run in Vitest (headless Node.js environment); browser-specific `KeyboardEvent` objects were verified via `KeyboardController.handleKeyDown` simulation rather than raw DOM window dispatch.
- Visual rendering of vacuum particles and altar petal animations was verified mathematically through state properties rather than GPU pixel capture.
- No other caveats.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone M2 demonstrates strong architecture and mathematical foundations for the cute gameplay reinvention, but contains two verified bugs and two numerical vulnerabilities that must be addressed:
1. **Fix Array Splicing in `PetCompanion.update`**: Change forward `for...of` loop to reverse index loop `for (let i = bubbleManager.pickups.length - 1; i >= 0; i--)` or stage collected IDs in an array before calling `collectPickup`.
2. **Fix `selectCard` Bounds Check in `SweetPerkManager.ts`**: Add `if (!card) return null;` or `if (!this.isModalActive || !Number.isInteger(index) || index < 0 || index >= this.availableCards.length) return null;`.
3. **Sanitize `dt` in `PetCompanion.update`**: Add `if (!Number.isFinite(dt) || dt <= 0) return; const clampedDt = Math.min(dt, 0.5);`.
4. **Resolve Challenger 1 Boss Defeat Deadlocks**: Fix boss cub defeat tracking and `GARDEN_PURIFIED` state transition in `CuteEnemyManager` and `CuteArenaCoordinator`.

---

## 5. Verification Method

To independently verify these empirical results:

1. **Run Challenger 2 Dedicated Stress Suite**:
   ```bash
   npx vitest run tests/unit/challenger_cute_m2_2_stress.test.ts
   ```
   *Expected Output*: 20/20 passed in ~30ms, confirming the bug proofs and stress invariants.

2. **Run Full Test Suite (Observing Both Challenger Findings)**:
   ```bash
   npm test
   ```
   *Expected Output*: 45 suites passing, 5 failures in Challenger 1's boss suite, 20/20 passing in Challenger 2's suite.
