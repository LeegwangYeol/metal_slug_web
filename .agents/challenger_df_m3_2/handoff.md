# Milestone M3: Empirical Challenge & Stress Report (Challenger 2)

## 1. Observation

### Test Execution & Flakiness Findings
1. **Direct Test Suite Failure**:
   - Command: `npm test` / `npx vitest run`
   - Output observed in task-30:
     ```
     FAIL tests/unit/UpgradeSystem.test.ts > Rogue-Lite UpgradeSystem & Synergies Suite (Milestone M3) > Suite 4: Synergistic Weapon Evolutions > unlocks evolution card when weapon is Rank 5 and passive is owned
     AssertionError: expected undefined to be defined
      ❯ tests/unit/UpgradeSystem.test.ts:144:23
         142| const cards = upgradeSystem.generateUpgradeCards(4);
         143| const evoCard = cards.find((c) => c.type === UpgradeType.WEAPON_…
         144| expect(evoCard).toBeDefined();
             | ^
         145| expect(evoCard!.itemId).toBe('soul_reaping_harvester');
     Test Files 1 failed | 15 passed (16)
     Tests 1 failed | 175 passed (176)
     ```
   - Across 10 repeated executions of `npx vitest run tests/unit/UpgradeSystem.test.ts`, the suite failed intermittently with 1 failure and 9 passes.
   - Root cause in `src/core/systems/UpgradeSystem.ts:729`: `generateUpgradeCards(4)` samples 4 cards without replacement from a pool of 10 candidates (1 evolution with weight 3.5, 4 weapon unlocks with weight 1.0, 1 passive rank-up with weight 2.0, 4 passive unlocks with weight 1.0; total weight 13.5). The mathematical probability of not drawing the evolution card in 4 draws is $(10/13.5) \times (9/12.5) \times (8/11.5) \times (7/10.5) \approx 24.74\%$. The unit test in `UpgradeSystem.test.ts:144` asserts unconditional presence on a single draw, creating an intermittent ~25% failure rate.

2. **Wave Director Perimeter Spawning Clamping Defect**:
   - Location: `src/core/systems/WaveDirector.ts:274-275`:
     ```typescript
     // Clamp inside arena bounds
     outPoint.x = Math.max(this.arenaBounds.minX + 20, Math.min(this.arenaBounds.maxX - 20, x));
     outPoint.y = Math.max(this.arenaBounds.minY + 20, Math.min(this.arenaBounds.maxY - 20, y));
     ```
   - In `src/main.ts:83, 94, 147`, `Camera.bounds` and `WaveDirector.arenaBounds` both share `[-2000, 2000]`.
   - When the camera tracks the player to the eastern boundary (`camX = 1040`, viewport spans $[1040, 2000]$), East edge perimeter spawning generates $x = \text{camX} + w + m + \text{rand} \ge 2090$.
   - Line 274 clamps this point to $\text{maxX} - 20 = 1980$.
   - The point $(1980, y)$ has screen coordinate $x = 1980 - 1040 = 940\text{px}$, which is **strictly inside the visible $960 \times 540$ camera viewport** ($M = -20\text{px}$).
   - Empirical test script (`tests/unit/ChallengerM3_2.test.ts`) across 500 boundary spawns measured:
     - Near East wall (`camX = 1040, camY = 0`): $99 / 500$ ($19.8\%$) spawns inside viewport, $130 / 500$ ($26.0\%$) violating $M \ge 80\text{px}$.
     - Near West wall (`camX = -2000, camY = 0`): $119 / 500$ ($23.8\%$) spawns inside viewport, $138 / 500$ ($27.6\%$) violating $M \ge 80\text{px}$.
     - Near North wall (`camX = 0, camY = -2000`): $107 / 500$ ($21.4\%$) spawns inside viewport, $119 / 500$ ($23.8\%$) violating $M \ge 80\text{px}$.
     - Near South wall (`camX = 0, camY = 1460`): $96 / 500$ ($19.2\%$) spawns inside viewport, $114 / 500$ ($22.8\%$) violating $M \ge 80\text{px}$.

3. **Evolved Weapon Zombie Re-Offering Defect**:
   - Location: `src/core/systems/UpgradeSystem.ts:502`:
     ```typescript
     public evolveWeapon(weaponId: string, evolutionId: string): void {
       const normBase = normalizeItemId(weaponId);
       const weapon = this.weapons.get(normBase);
       if (weapon) {
         this.weapons.delete(normBase);
         const normEvo = normalizeItemId(evolutionId);
         this.weapons.set(normEvo, {
           rank: 5,
           isEvolution: true,
           rawId: evolutionId,
         });
       }
     }
     ```
   - When Arcane Scythe is evolved to Soul Reaping Harvester, `this.weapons.delete('weapon_scythe')` deletes the base weapon key.
   - `this.isWeaponEvolved('weapon_scythe')` checks `this.weapons.get('weapon_scythe')?.isEvolution`, which returns `false`.
   - `this.getWeaponRank('weapon_scythe')` returns `0`.
   - In `generateUpgradeCards`, because `rank === 0`, `!isEvolved`, and `this.weapons.size < 6`, `weapon_scythe` is placed into `candidates` as a `NEW WEAPON` (`WEAPON_UNLOCK`).
   - The player is offered to unlock the base weapon again while currently wielding its evolved form.

### Successful Objective Verifications
1. **Upgrade Card Invariants (Interior)**:
   - Items at Rank 5 are never offered for rank-up (verified across 500 rolls, 0 violations).
   - 7th weapon and 7th passive unlocks are strictly rejected when slots are at 6 (verified across 500 rolls, 0 violations).
   - Single-roll cards have strictly 0 duplicate IDs or item IDs across 2,000 rolls.
   - Safe fallback (`fallback_feast`) is cleanly returned when all 6 weapon slots and 6 passive slots are maxed.
2. **Evolution Eligibility Matrix**:
   - Verified that all 5 evolutions require both base weapon Rank 5 AND the specific paired passive (`soul_reaping_harvester`, `abyssal_vortex`, `ossuary_cataclysm`, `storm_of_torment`, `domain_of_decay`). Ranks $< 5$, missing passives, or mismatched passives correctly reject eligibility.
3. **Interior Perimeter Spawning ($M \ge 80\text{px}$)**:
   - For camera coordinates away from arena boundaries (e.g. $[0, 0]$, $[200, 300]$, $[-500, 200]$), 100% of spawns lie strictly outside the $960 \times 540$ viewport with orthogonal distance $M \ge 90\text{px} \ge 80\text{px}$.
4. **Wave Director Timeline Escalation**:
   - 0s–30s Phase 1 (Awakening), 30s–60s Phase 2 (The Swarm), 60s–120s Phase 3 (Nightfall), 120s+ Phase 4 (Abyssal Siege).
   - Exact mathematical formulas verified: $\text{HP} = 1.0 + (t/60) \times 0.30$, $\text{Speed} = \min(1.40, 1.0 + (t/120) \times 0.15)$, $\text{Interval} = \max(0.50, 2.20 - (t/60) \times 0.55)$, $\text{Cluster} = \min(30, 4 + \lfloor t/8 \rfloor)$, $\text{Cap} = \min(1200, 150 + \lfloor t/10 \rfloor \times 80)$.
   - All 6 milestone events (`pincer_30`, `ring_60`, `quad_90`, `boss_120`, `boss_180`, `boss_240`) trigger accurately.

---

## 2. Logic Chain

1. **Test Flakiness & CI Instability**: The worker handoff claimed 100% green test status with 176/176 tests passing. However, running the project test command `npm test` triggered a failure in `tests/unit/UpgradeSystem.test.ts:144`. Tracing `UpgradeSystem.generateUpgradeCards` demonstrated that random weighted sampling without guaranteeing eligible evolutions means a ~25% chance of omitting the evolution card from the 4 drawn cards. The test fails whenever this RNG outcome occurs.
2. **Perimeter Invariant Breach**: The requirement states: "test 100+ spawns across various camera coordinates and verify mathematically that every spawn is strictly outside the 960x540 viewport ($M \ge 80\text{px}$)". In `WaveDirector.ts`, `getPerimeterPoint` clamps coordinates to `arenaBounds` $(\pm 2000)$. However, the camera can travel up to $\text{camX} = 1040$ ($\text{camX} + 960 = 2000$). When the player is against the east wall, the generator picks an off-screen point at $x \approx 2090$, which gets clamped to $x = 1980$. Because $1040 \le 1980 \le 2000$, the enemy is placed inside the viewport at screen $x = 940$. The same occurs at west, north, and south walls. Thus, $\approx 20-25\%$ of spawns at arena boundaries pop directly on-screen.
3. **Progression Tree Inconsistency**: Evolving a weapon removes its key from `this.weapons`. Because `isWeaponEvolved` only inspects `this.weapons.get(baseId)`, it returns `false` for any weapon that has already undergone evolution. This causes the card generator to misclassify the evolved weapon's base form as an unowned weapon, offering it again to the player.

---

## 3. Caveats

- No caveats regarding unit and math verification: all equations, boundary conditions, and RNG simulations were executed directly via Vitest and TSX.
- Visual inspection of canvas rendering of the upgrade modal under Playwright was not performed in this unit challenge, as it is formally assigned to Milestone M4 E2E testing.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone M3 cannot be approved in its current state due to two functional bugs and one test suite reliability issue:
1. **WaveDirector boundary clamping bug**: Clamping perimeter spawn coordinates to `arenaBounds` forces enemies to spawn directly inside the camera viewport when the player is near arena walls.
   - *Remediation*: When a camera boundary is within $w + m$ of an arena edge, `WaveDirector` should exclude that edge from cardinal random selection and only spawn from edges with valid off-screen margin, or the enemy spawn arena bounds should be offset from camera bounds by at least $w + m$.
2. **Evolved weapon re-offering bug**: Evolving a weapon deletes the base weapon entry, causing `isWeaponEvolved(baseId)` to return `false` and re-offering the base weapon as a new unlock.
   - *Remediation*: Track evolved weapon lineage (e.g. `Set<string> evolvedBaseWeapons` or mark `isEvolution: true` while preserving base mapping) so `isWeaponEvolved` and `getWeaponRank` correctly prevent base weapon re-appearance.
3. **Flaky Unit Test**: `tests/unit/UpgradeSystem.test.ts:144` must either account for weighted RNG (e.g. checking candidate presence or rolling until offered) or `generateUpgradeCards` should guarantee eligible evolution cards are always offered.

---

## 5. Verification Method

1. **Reproduce Unit Test Failure**:
   ```bash
   npx vitest run tests/unit/UpgradeSystem.test.ts
   ```
   (Repeat 5–10 times; intermittent failure `AssertionError: expected undefined to be defined` will trigger).
2. **Reproduce Empirical Challenge Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM3_2.test.ts
   ```
   (Confirms 12/12 empirical challenge tests, proving the boundary popping rates and evolved weapon re-offering).
3. **Reproduce Boundary Clamping Math**:
   ```bash
   npx tsx -e "
   import { HordeManager } from './src/core/HordeManager';
   import { WaveDirector } from './src/core/systems/WaveDirector';
   const wd = new WaveDirector(new HordeManager({ maxCapacity: 100 }), {
     viewportWidth: 960, viewportHeight: 540, spawnMargin: 90,
     arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 }
   });
   let inside = 0;
   for (let i = 0; i < 500; i++) {
     const pt = wd.getPerimeterPoint(1040, 0);
     if (pt.x >= 1040 && pt.x <= 2000 && pt.y >= 0 && pt.y <= 540) inside++;
   }
   console.log('Boundary screen popping rate:', (inside / 500 * 100) + '%');
   "
   ```
