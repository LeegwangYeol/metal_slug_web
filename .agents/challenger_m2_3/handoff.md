# Empirical Challenge Report: Milestone M2 Iteration 2

- **Agent**: `teamwork_preview_challenger` (`challenger_m2_3`)
- **Role**: Empirical Challenger / Critic / Specialist
- **Milestone**: Milestone M2 Iteration 2 (Autonomous Ally NPCs & Diverse Items/Weapons)
- **Date**: 2026-09-08
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_3`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Direct Code Observations

1. **Ally Target Selection Priority (`src/core/entities/allies/AllyNPC.ts:266-281`)**:
   ```typescript
   if (isEnemy) {
     const center = BoundingBox.getCenter(entity.bounds);
     const dist = vec2Dist(this.position, center);

     if (dist <= this.config.visionRadius) {
       let priorityWeight = 10;
       if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
         priorityWeight = 50;
       } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
         priorityWeight = 100;
       }

       const score = priorityWeight * 100 - dist;
       scoredTargets.push({ target: entity, score, distance: dist });
     }
   }
   ```
   - Mid-Boss type checks (`MID_BOSS_VEHICLE` and `includes('MID_BOSS')`) are evaluated before generic `BOSS` substring matching.
   - Priority weights are assigned deterministically: Minion = 10, Mid-Boss = 50, End-Boss = 100.
   - Vision radius is bounded by `this.config.visionRadius = 380.0`.

2. **Pending Player Fallback in `AllyNPC.ts:56-61`**:
   ```typescript
   let player = engine.getEntity('player') as any;
   if (!player && Array.isArray((engine as any).entitiesToAdd)) {
     player = (engine as any).entitiesToAdd.find(
       (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
     );
   }
   ```
   - When entities are added via `engine.addEntity(player)` prior to executing `engine.tick()`, `engine.getEntity('player')` is `undefined`.
   - The fallback array lookup in `(engine as any).entitiesToAdd` successfully retrieves the uncommitted player instance by `id === 'player'` or `type === 'PLAYER'`.

3. **Epsilon Lifetime Comparison in `src/core/weapons/RocketLauncherWeapon.ts:38-42`**:
   ```typescript
   this.lifeTime -= dt;
   if (this.lifeTime <= 1e-4) {
     this.detonate(engine);
     return;
   }
   ```
   - Initial rocket lifetime is $2.50\text{s}$.
   - Under IEEE-754 double precision floating-point arithmetic at 60Hz ($dt = 1/60$):
     - At Frame 149 (149 steps): `lifeTime = 0.016666666666670545` ($> 10^{-4}$), `isAlive` remains `true`.
     - At Frame 150 (150 steps): `lifeTime = 3.878841692284141e-15` ($\le 10^{-4}$), `detonate()` triggers.

4. **Independent Adversarial Challenge Suite (`tests/unit/m2_adversarial_challenger_audit.test.ts`)**:
   - Created an independent 16-test adversarial audit harness specifically stress-testing:
     - End-Boss vs Mid-Boss target selection across varied distance configurations (equidistant, Mid-Boss closer, End-Boss at perimeter, out-of-range, and post-death re-targeting).
     - Ally locomotion when player is registered only in `entitiesToAdd` without an initial tick (sprint follow, stop distance idle, platform jump, multi-frame traversal, mid-simulation tick commit, and player death).
     - Rocket lifetime detonation frame-exactness at frame 149 vs frame 150, explosive blast damage falloff ($8.0 \times (1 - d/48)$), friendly immunity, and 120Hz scaling (frame 299 vs 300).

### 1.2 Tool Commands and Verification Outputs

1. **Adversarial Challenge Suite Execution**:
   - Command: `npx vitest run tests/unit/m2_adversarial_challenger_audit.test.ts`
   - Output: `16 passed (16)` in 302ms.

2. **Milestone M2 Suites Execution**:
   - Command: `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts tests/unit/m2_adversarial_challenger_audit.test.ts`
   - Output: `6 passed (6 files), 75 passed (75 tests)` in 1.48s.

3. **Full Project Unit Test Suite (All Milestones)**:
   - Command: `npx vitest run`
   - Output: `31 passed (31 files), 389 passed (389 tests)` in 2.83s.

4. **Playwright Headless Browser E2E Suite**:
   - Command: `npx playwright test`
   - Output: `17 passed (17 tests)` in 14.5s. All 5 visual verification screenshots verified.

5. **TypeScript Strict Type Check**:
   - Command: `npx tsc --noEmit`
   - Output: Exit code 0 (clean, zero compiler diagnostics).

6. **Production Build**:
   - Command: `npm run build`
   - Output: `tsc -b && vite build` bundled successfully in 289ms (`dist/assets/index-B8gaD6WE.js`).

---

## 2. Logic Chain

### 2.1 Focus 1: Ally Target Selection (End-Boss vs Mid-Boss at Varied Distances)

1. **Observation**: In `AllyNPC.ts:271-276`, `typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')` assigns `priorityWeight = 50`. The `else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS')` assigns `priorityWeight = 100`. Standard enemies receive `priorityWeight = 10`.
2. **Scoring Function**: $\text{score} = \text{priorityWeight} \times 100 - \text{dist}$, evaluated strictly for $\text{dist} \le 380.0\text{px}$.
3. **Disjoint Interval Analysis**:
   - End-Boss ($d \in [0, 380]$): $\text{score}_{end} = 10000 - d \in [9620, 10000]$.
   - Mid-Boss ($d \in [0, 380]$): $\text{score}_{mid} = 5000 - d \in [4620, 5000]$.
   - Standard Soldier ($d \in [0, 380]$): $\text{score}_{soldier} = 1000 - d \in [620, 1000]$.
4. **Empirical Scenarios Tested**:
   - **Equidistant ($d = 200$)**: End-Boss scores $9800$ vs Mid-Boss $4800$. End-Boss is selected ($9800 > 4800$).
   - **Mid-Boss Much Closer**: Mid-Boss at $d = 50$ (score $4950$); End-Boss at $d = 370$ (score $9630$). End-Boss is selected ($9630 > 4950$). The major boss encounter always supersedes a mid-boss as long as it is visible.
   - **End-Boss Out of Vision Radius**: Mid-Boss at $d = 250$ (score $4750$); End-Boss at $d = 385$ ($> 380$). End-Boss is filtered out of `scoredTargets`; Mid-Boss is selected ($4750$).
   - **Both Out of Vision Radius ($d > 380$)**: Returns `null` without throwing exceptions or NaNs.
   - **Type Variants Verified**: `BOSS_TETSUYUKI`, `TETSUYUKI_BOSS`, `BOSS_IRON_NOKANA`, `STAGE1_BOSS`, `MID_BOSS_VEHICLE`, `ENEMY_MID_BOSS`, and `MID_BOSS` all map to their designated weights without shadowing.
   - **Dynamic Re-targeting**: Upon killing the End-Boss (`isAlive = false`), Ally immediately re-evaluates and switches priority to Mid-Boss on the very next target search.

### 2.2 Focus 2: Ally Locomotion with Player in `entitiesToAdd` (Zero Initial Ticks)

1. **Observation**: `engine.addEntity(player)` appends `player` to `engine.entitiesToAdd`. Until `engine.tick()` executes, `engine.getEntity('player')` returns `undefined`.
2. **Locomotion Fallback**: `AllyNPC.update()` queries `engine.getEntity('player')`, sees `undefined`, and checks `Array.isArray(engine.entitiesToAdd)`. It resolves the player via `(e) => e.id === 'player' || e.type === 'PLAYER'`.
3. **Kinematic Behavior**:
   - Follow target position $X_{target} = player.position.x - player.facing \times 45.0$.
   - Lateral offset $\Delta x = X_{target} - ally.position.x$.
   - When $|\Delta x| > 90.0$ (sprint threshold), Ally sets $velocity.x = 165.0\text{ px/s}$ and $facing = +1$.
   - When $|\Delta x| \le 12.0$ (stop threshold), Ally sets $velocity.x = 0$ and transitions to `'IDLE'`.
   - When player is elevated ($player.position.y < ally.position.y - 22.0$), Ally initiates a vertical jump ($velocity.y = -350.0\text{ px/s}$, $isGrounded = false$).
4. **Empirical Multi-Frame Continuity**:
   - In `tests/unit/m2_adversarial_challenger_audit.test.ts`, Ally was updated for 30 consecutive ticks with zero `engine.tick()` calls. Ally traversed from $X = 100.0$ to $X = 182.5$ ($\Delta X = 82.5\text{px} = 30 \times 165 / 60$) with zero errors or stalls.
   - Mid-simulation commit: Executing `engine.tick()` on frame 6 flushed `entitiesToAdd` to `entities`. On frame 7, `AllyNPC.update()` seamlessly fetched `player` from `engine.getEntity('player')` without positional discontinuity.

### 2.3 Focus 3: Rocket Lifetime Detonation at Frame 149 vs Frame 150 (2.50s)

1. **Observation**: In `PlayerRocketProjectile.update()`, `this.lifeTime -= dt; if (this.lifeTime <= 1e-4) { this.detonate(engine); return; }`.
2. **Mathematical Precision**:
   - At 60Hz: $dt = 1/60 = 0.016666666666666666\text{s}$.
   - Frame 149: $t = 149 \times \frac{1}{60} = 2.4833333333333334\text{s}$. Remaining lifetime is $0.016666666666670545\text{s}$.
     - Because $0.01667 > 10^{-4}$, the rocket remains alive. `explosionEvents.length === 0`.
   - Frame 150: $t = 150 \times \frac{1}{60} = 2.5000000000000000\text{s}$.
     - Remaining lifetime in IEEE-754 subtraction: $2.5 - 150/60 = +3.878841692284141 \times 10^{-15}\text{s}$.
     - With epsilon $10^{-4}$, $3.88 \times 10^{-15} \le 10^{-4}$ evaluates to `true`.
     - Rocket detonates frame-exact on frame 150. `isAlive` transitions to `false`, and `spawn_explosion` is emitted.
3. **Explosive Blast Damage Verification**:
   - At detonation, blast radius is $48.0\text{px}$.
   - Enemy placed at distance $24.0\text{px}$ received damage $8.0 \times (1 - 24/48) = 4.0\text{ HP}$ ($100 \to 96.0$).
   - Enemy placed at distance $50.0\text{px}$ received $0\text{ damage}$.
   - Friendly entities (`PLAYER`, `ALLY_NPC`) received $0\text{ damage}$ (100% friendly fire protection).
4. **Frequency Invariance**:
   - At 120Hz ($dt = 1/120\text{s}$, 300 frames to 2.5s), rocket remains alive at frame 299 and detonates on frame 300.

---

## 3. Caveats

1. **Player Entity ID Dependency**: `AllyNPC.ts:56` checks `engine.getEntity('player')` when querying committed entities, while the `entitiesToAdd` fallback checks `e.id === 'player' || e.type === 'PLAYER'`. Throughout the game and test suite, `PlayerController` always initializes with `id = 'player'` and `type = 'PLAYER'`. If custom multi-player entities with distinct IDs were introduced in the future, `engine.getEntitiesByType('PLAYER')` would be the generalized pattern.
2. **Epsilon Window Calibration**: The epsilon threshold $10^{-4}\text{s}$ is calibrated for simulation timesteps $\Delta t \ge 10^{-4}\text{s}$ ($\le 10,000\text{ Hz}$). Standard browser animation loops run at 60Hz to 240Hz, making this threshold mathematically robust and immune to floating-point drift.

---

## 4. Conclusion

**Verdict: APPROVE**

All three challenge vectors have been empirically tested and proven robust:
1. **Ally Target Selection**: Mid-Bosses ($5000 - d$) and End-Bosses ($10000 - d$) have strictly separated, non-overlapping scoring ranges within the $380\text{px}$ vision radius. End-Bosses take priority over Mid-Bosses regardless of distance when both are visible; Mid-Bosses are selected when End-Bosses are out of range or dead.
2. **Ally Locomotion with Pending Player**: The `entitiesToAdd` fallback operates seamlessly with zero initial ticks, preserving follow distance calculation, sprint locomotion, platform jumping, and state transitions.
3. **Rocket Lifetime Detonation**: The $10^{-4}$ epsilon eliminates the IEEE-754 floating-point underflow issue, ensuring the rocket is reliably alive at frame 149 and detonates frame-exact at frame 150 with accurate AOE blast damage and friendly safety.

With 389 unit tests passing (100% green across 31 test suites), 17 Playwright E2E browser tests passing, clean TypeScript compilation, and clean production builds, the Milestone M2 remediations are verified and ready for Milestone M3.

---

## 5. Verification Method

To independently reproduce and verify all findings:

```bash
# 1. Strict TypeScript Compile Check
npx tsc --noEmit

# 2. Run the Dedicated Adversarial Challenger Audit Suite (16 tests)
npx vitest run tests/unit/m2_adversarial_challenger_audit.test.ts

# 3. Run All Milestone M2 Suites (75 tests)
npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts tests/unit/m2_adversarial_challenger_audit.test.ts

# 4. Run Full Project Vitest Suite (389 tests)
npx vitest run

# 5. Run Full Playwright E2E Suite (17 tests)
npx playwright test

# 6. Production Bundle Build
npm run build
```

### Invalidation Conditions
- If `AllyNPC.findBestTarget()` assigns priority weight 100 to `MID_BOSS_VEHICLE` when an End-Boss is equidistant or within vision.
- If `AllyNPC.update()` leaves `velocity.x === 0` and remains stuck in `IDLE` when `player` is registered in `entitiesToAdd` prior to `engine.tick()`.
- If `PlayerRocketProjectile` detonates at frame 149 ($t < 2.50\text{s}$) or fails to detonate at frame 150 ($t = 2.50\text{s}$) under 60Hz Euler stepping.
