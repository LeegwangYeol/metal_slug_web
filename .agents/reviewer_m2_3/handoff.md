# Review & Adversarial Audit Report: Milestone M2 Iteration 2

- **Agent**: `teamwork_preview_reviewer` (`reviewer_m2_3`)
- **Roles**: Reviewer, Adversarial Critic
- **Milestone**: Milestone M2 Iteration 2 (Autonomous Ally NPCs & Diverse Items/Weapons Remediation)
- **Target Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_3`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Date**: 2026-09-08

---

## Review Summary

**Verdict**: **APPROVE**

No integrity violations, hardcoded test shortcuts, or facade implementations were detected. All three surgical remediations are verified mathematically and empirically.

---

## 1. Observation

### 1.1 Direct Code Observations

1. **Mid-Boss Check Order in `src/core/entities/allies/AllyNPC.ts`**:
   - Lines 271–276:
     ```typescript
     let priorityWeight = 10;
     if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
       priorityWeight = 50;
     } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
       priorityWeight = 100;
     }
     ```
   - Prior to this edit, `typeStr.includes('BOSS')` was checked first. Because `'MID_BOSS_VEHICLE'.includes('BOSS') === true`, the mid-boss was receiving weight 100 and shadowing the mid-boss branch.
   - Now, `'MID_BOSS_VEHICLE' || includes('MID_BOSS')` is evaluated first, correctly assigning `priorityWeight = 50` ($50 \times 100 - \text{dist}$) while end-bosses receive `priorityWeight = 100` ($100 \times 100 - \text{dist}$).

2. **Pending Player Fallback in `src/core/entities/allies/AllyNPC.ts`**:
   - Lines 56–61:
     ```typescript
     let player = engine.getEntity('player') as any;
     if (!player && Array.isArray((engine as any).entitiesToAdd)) {
       player = (engine as any).entitiesToAdd.find(
         (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
       );
     }
     ```
   - Lines 243–251 (`findBestTarget`):
     ```typescript
     const pending = (engine as any).entitiesToAdd as GameEntity[] | undefined;
     if (Array.isArray(pending)) {
       for (const entity of pending) {
         if (!seen.has(entity.id)) {
           seen.add(entity.id);
           allEntities.push(entity);
         }
       }
     }
     ```
   - In `GameEngine.ts:131-133`, `addEntity(entity)` pushes into `entitiesToAdd`, which is only committed to `this.entities` during `tick()`. When unit tests call `ally.update()` directly before `engine.tick()`, the player was previously unresolved (`undefined`), causing `AllyNPC` to stall in `IDLE`. The fallback safely resolves pending players from `entitiesToAdd`.

3. **Rocket Lifetime Precision Check in `src/core/weapons/RocketLauncherWeapon.ts`**:
   - Lines 38–42:
     ```typescript
     this.lifeTime -= dt;
     if (this.lifeTime <= 1e-4) {
       this.detonate(engine);
       return;
     }
     ```
   - Under IEEE-754 double-precision arithmetic, subtracting $1/60$ for 150 frames from $2.5$ yields $2.5 - 150 \times (1/60) = +3.878841692284141 \times 10^{-15} > 0$.
   - A threshold of `<= 0` delayed detonation to frame 151. With `<= 1e-4`, frame 149 has `lifeTime = 0.016667 > 1e-4` (alive), while frame 150 has `lifeTime = 3.88e-15 <= 1e-4` (detonated frame-exact).

4. **Empirical Challenger Suite Updates in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`**:
   - Line 154: Strict equality assertion `expect(best?.id).toBe('test_boss')` successfully passes without fallback unions.
   - Lines 361–365: Manual entity map insertion `(smallEngine as any).entities.set(leadPlayer.id, leadPlayer);` was completely removed; `AllyNPC` resolves `leadPlayer` natively from `entitiesToAdd` and advances off the ledge (`isGrounded === false`, `velocity.y > 0`).
   - Lines 458–468: Asserts frame 149 is alive and frame 150 detonates with `spawn_explosion` event dispatched.

### 1.2 Tool Execution Verification Outputs

1. **TypeScript Type Check**:
   - Command: `npx tsc --noEmit`
   - Result: Exit code `0`, clean, 0 errors.

2. **Milestone M2 Unit Test Suite**:
   - Command: `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
   - Result: Exit code `0`
   - Output:
     ```text
     ✓ tests/unit/pow_system.test.ts (3 tests) 4ms
     ✓ tests/unit/allies_system.test.ts (10 tests) 3ms
     ✓ tests/unit/m2_challenger_stress.test.ts (17 tests) 5ms
     ✓ tests/unit/diverse_weapons_items.test.ts (12 tests) 4ms
     ✓ tests/unit/m2_ally_rocket_empirical_challenge.test.ts (17 tests) 11ms

     Test Files  5 passed (5)
          Tests  59 passed (59)
       Duration  233ms
     ```

3. **Full Project Regression Suite**:
   - Command: `npx vitest run`
   - Result: Exit code `0`
   - Output: 30 test files passed, 373 of 373 tests passing (100% green).

4. **Production Build**:
   - Command: `npm run build`
   - Result: Exit code `0` (`tsc -b && vite build` bundled successfully in 272ms).

---

## 2. Logic Chain

1. **Boss vs Mid-Boss Priority**:
   - Observations 1.1.1 & 1.1.4 establish that `'MID_BOSS_VEHICLE'` contains `'BOSS'`.
   - By matching `'MID_BOSS_VEHICLE' || includes('MID_BOSS')` first, mid-bosses are granted weight 50, leaving only true bosses to receive weight 100.
   - At equal distance $d = 200\text{px}$, score for `TETSUYUKI_BOSS` is $100 \times 100 - 200 = 9800$; score for `MID_BOSS_VEHICLE` is $50 \times 100 - 200 = 4800$.
   - The boss score is strictly greater, proving strict priority order.

2. **Unflushed Entity Resolution**:
   - Observations 1.1.2 & 1.1.4 demonstrate that `smallEngine.addEntity(leadPlayer)` leaves `leadPlayer` inside `entitiesToAdd` until `smallEngine.tick()`.
   - The fallback queries `(engine as any).entitiesToAdd` looking for `id === 'player' || type === 'PLAYER'`.
   - `AllyNPC` successfully retrieves `leadPlayer`, computes distance, sets velocity, and walks forward off the platform without hanging in `IDLE`.
   - Removing the manual test workaround proves the engine logic itself is functioning as required.

3. **Epsilon Comparison for Floating Point Subtraction**:
   - Observations 1.1.3 & 1.1.4: $2.5 - 150 \times \frac{1}{60} = 3.878841692284141 \times 10^{-15} > 0$.
   - A threshold of $10^{-4}$ ($0.0001\text{s}$) is large enough to absorb machine epsilon ($3.88 \times 10^{-15}\text{s}$) while being $166\times$ smaller than a single 60Hz frame ($0.01667\text{s}$).
   - Therefore, at frame 149, `lifeTime` ($0.01667\text{s}$) is $> 10^{-4}\text{s}$ (remains alive).
   - At frame 150, `lifeTime` ($3.88 \times 10^{-15}\text{s}$) is $\le 10^{-4}\text{s}$ (detonates exactly on time).

---

## 3. Adversarial Challenges & Stress Testing

### 3.1 Assumption Stress-Testing
- **Assumption 1**: Could `typeStr.includes('MID_BOSS')` inadvertently catch non-midboss entities?
  - *Analysis*: Grep of the entire codebase shows only `MID_BOSS_VEHICLE` and `StageState.MID_BOSS_BATTLE` use this prefix. No minions or end-bosses contain `MID_BOSS`. Thus, no false positives exist.
- **Assumption 2**: Does checking `entitiesToAdd` create memory leaks or duplicate processing?
  - *Analysis*: In `AllyNPC.findBestTarget()`, `seen: Set<string>` tracks all processed IDs. Any entity already in `engine.getAllEntities()` is skipped when scanning `entitiesToAdd`. In `update()`, only a single player reference is read for positional tracking without holding long-lived references.
- **Assumption 3**: Does `lifeTime <= 1e-4` fail if the game runs at 120Hz or 240Hz?
  - *Analysis*: At 240Hz, $dt = 1/240 \approx 0.004167\text{s} = 4.167 \times 10^{-3}\text{s}$. Because $10^{-4}\text{s} \ll 4.167 \times 10^{-3}\text{s}$, the rocket will not trigger early on the penultimate 240Hz frame.

### 3.2 Integrity Audit
- Grep scan for hardcoded test fixtures or bypasses (`test_boss`, mock returns, dummy flags): 0 results in `src/`.
- Verify real implementation: `AllyNPC` and `RocketLauncherWeapon` contain complete kinematic, targeting, spatial hash grid, and platform physics calculations.
- No fabricated outputs detected.

---

## 4. Caveats

- The epsilon check `1e-4` is tailored for simulation frequencies below 10,000Hz, which covers all standard browser and test timesteps.
- In multi-player scenarios (not currently in scope for this single-player game), `entitiesToAdd.find` picks the first player encountered.

---

## 5. Conclusion

**Verdict**: **APPROVE**

Milestone M2 Iteration 2 surgical remediations are 100% verified, clean, robust, and mathematically sound.
The project is ready to proceed to Milestone M3 (`M3_ULTIMATE_FX`).

---

## 6. Verification Method

To independently verify all claims:

```bash
# 1. TypeScript Compilation
npx tsc --noEmit

# 2. Milestone M2 Target Unit & Challenger Suites
npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts

# 3. Full Project Unit Test Regression Suite
npx vitest run

# 4. Production Build
npm run build
```

### Invalidation Conditions
- If `AllyNPC.findBestTarget()` targets `MID_BOSS_VEHICLE` when `TETSUYUKI_BOSS` is equidistant.
- If `AllyNPC` fails to move when `player` is added to `entitiesToAdd` before `engine.tick()`.
- If `PlayerRocketProjectile` detonates before frame 150 or after frame 150 under standard 60Hz Euler integration.
