# Handoff Report: Milestone M2 Independent Review & Adversarial Audit

- **Agent**: `teamwork_preview_reviewer` (`reviewer_m2_1`)
- **Role**: Reviewer / Adversarial Critic
- **Milestone**: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)
- **Date**: 2026-09-08
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

### High-Level Summary
Worker M2 has delivered solid, high-quality foundational implementations for the Autonomous Ally NPC (`AllyNPC.ts`, `AllyKiBlast.ts`, `AllyManager.ts`), diverse weapons (`ShotgunWeapon.ts`, `LaserGunWeapon.ts`, `RocketLauncherWeapon.ts`), item pickups (`ItemPickup.ts`), and POW hostage mechanics (`PowEntity.ts`, `PrisonerEntity.ts`).
- **Integrity Audit**: **CLEAN**. No hardcoded test outputs, facade implementations, or shortcuts were found. All core logic is genuinely implemented.
- **Type Checking**: `npx tsc --noEmit` exited cleanly with code 0 (zero errors).
- **Core Milestone Tests**: All 3 designated unit test suites (`tests/unit/allies_system.test.ts`, `tests/unit/diverse_weapons_items.test.ts`, `tests/unit/pow_system.test.ts`) passed 100% (25 of 25 tests passing).
- **Adversarial Stress Suite 1**: `tests/unit/m2_challenger_stress.test.ts` passed 100% (17 of 17 tests passing).

**Why REQUEST_CHANGES?**
Adversarial challenge and deep code inspection uncovered **2 Major logic/boundary defects** and **2 Minor kinematic/float precision issues** in the implementation code that must be remediated:
1. **[Major Finding 1] Target Priority Dead Code & Inversion in `AllyNPC.ts`**:
   `typeStr.includes('BOSS')` matches `'MID_BOSS_VEHICLE'`, causing `else if (typeStr === 'MID_BOSS_VEHICLE')` to be dead code and awarding Mid-Bosses an unintended weight of 100 instead of 50. This inverts target selection when an End-Boss and a closer Mid-Boss coexist.
2. **[Major Finding 2] Unresolved Pending Player Entity in `AllyNPC.ts`**:
   `const player = engine.getEntity('player') as any;` only queries committed entities. While Worker M2 patched `findBestTarget` and `steerTowardsNearestEnemy` to scan `(engine as any).entitiesToAdd`, line 56 of `AllyNPC.ts` was omitted. When an engine has pending entities without a prior `tick()`, `player` is `undefined`, causing the ally to enter `IDLE` with 0 velocity and fail locomotion.
3. **[Minor Finding 3] Floating-Point Detonation Leak in `RocketLauncherWeapon.ts`**:
   `2.5 - 150 * (1/60)` yields `+3.8788e-15 > 0` in IEEE 754 float math. `this.lifeTime <= 0` delays maximum-lifetime rocket detonation from frame 150 to frame 151.
4. **[Minor Finding 4] Takeoff Gravity Suppression Asymmetry in `AllyNPC.ts`**:
   `justJumped` suppresses gravity for tick 0 to satisfy an exact initial velocity test assertion, causing discrete jump apex height to overshoot theoretical continuum $\frac{v^2}{2g}$ by $\sim 2.8$ px (134.7 px vs 137.5 px).

---

## 1. Observation

### 1.1 Verbatim Compilation & Test Runs
1. **TypeScript Check**:
   Command: `npx tsc --noEmit`
   Result: Exit code 0 (zero errors).

2. **Milestone M2 Unit Test Suites**:
   Command: `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts`
   Result:
   ```text
    RUN  v3.2.7 /Users/user/src/fullmetalslug

    ✓ tests/unit/allies_system.test.ts (10 tests) 16ms
    ✓ tests/unit/pow_system.test.ts (3 tests) 39ms
    ✓ tests/unit/diverse_weapons_items.test.ts (12 tests) 38ms

    Test Files  3 passed (3)
         Tests  25 passed (25)
      Duration  9.87s
   ```

3. **Challenger Stress Suite 1**:
   Command: `npx vitest run tests/unit/m2_challenger_stress.test.ts`
   Result:
   ```text
    ✓ tests/unit/m2_challenger_stress.test.ts (17 tests) 83ms

    Test Files  1 passed (1)
         Tests  17 passed (17)
   ```

4. **Empirical Challenger Suite 2**:
   Command: `npx vitest run tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
   Result: 4 failed tests:
   - `processes 50 enemies and strictly selects highest threat priority (Boss > MidBoss > Soldier)`:
     `AssertionError: expected 'mid_boss_1' to be 'end_boss_1' (Expected: "end_boss_1", Received: "mid_boss_1")`
   - `simulates 120-frame ballistic trajectory: verifies monotonic ascent, apex, descent, and touchdown stability with ZERO floating`:
     `AssertionError: expected 134.70555555555552 to be close to 137.5, received difference is 2.79444444444448, but expected 0.5`
   - `falls naturally when walking off a platform edge without crashing`:
     `AssertionError: expected 140 to be greater than 150`
   - `detonates and terminates cleanly upon reaching maximum lifetime (2.5s)`:
     `AssertionError: expected true to be false` (line 453)

### 1.2 Verbatim Code Observations
1. In `src/core/entities/allies/AllyNPC.ts`, lines 266–272:
   ```typescript
          let priorityWeight = 10;
          if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
            priorityWeight = 100;
          } else if (typeStr === 'MID_BOSS_VEHICLE') {
            priorityWeight = 50;
          }
   ```
   `'MID_BOSS_VEHICLE'.includes('BOSS')` evaluates to `true`.

2. In `src/core/entities/allies/AllyNPC.ts`, line 56:
   ```typescript
   const player = engine.getEntity('player') as any;
   ```
   Compared to lines 238–246 where pending entities are scanned:
   ```typescript
   const pending = (engine as any).entitiesToAdd as GameEntity[] | undefined;
   ```

3. In `src/core/weapons/RocketLauncherWeapon.ts`, lines 38–42:
   ```typescript
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.detonate(engine);
      return;
    }
   ```
   Evaluating in Node:
   ```bash
   $ node -e "let t = 2.5; for (let i=0; i<150; i++) t -= 1/60; console.log(t, t <= 0);"
   3.878841692284141e-15 false
   ```

4. In `src/core/entities/allies/AllyNPC.ts`, lines 36–38 and 178–182:
   ```typescript
   if (!this.justJumped) {
     this.velocity.y += this.config.gravity * dt;
   }
   this.justJumped = false;
   ```

---

## 2. Logic Chain

### 2.1 Threat Scoring Logic Inversion
- **Step 1**: An enemy with `type = 'MID_BOSS_VEHICLE'` enters `findBestTarget`.
- **Step 2**: The first conditional checks `if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS')`.
- **Step 3**: The string `'MID_BOSS_VEHICLE'` contains `'BOSS'`, evaluating the first condition to `true`.
- **Step 4**: `priorityWeight` is assigned `100`. The branch `else if (typeStr === 'MID_BOSS_VEHICLE')` is dead code and never reached.
- **Step 5**: When a `TETSUYUKI_BOSS` is at distance 370px (`score = 100 * 100 - 370 = 9630`) and a `MID_BOSS_VEHICLE` is at distance 320px (`score = 100 * 100 - 320 = 9680`), the Mid-Boss scores higher and is selected over the Boss, violating the requirement that end bosses have higher threat weight than mid-bosses.

### 2.2 Entity Resolution Asymmetry
- **Step 1**: In `GameEngine.addEntity(entity)`, entities are added to `entitiesToAdd` and moved to `entities` during `engine.tick()`.
- **Step 2**: Worker M2 observed that in unit tests calling `update()` directly without `tick()`, spatial queries fail if only `getAllEntities()` is queried.
- **Step 3**: Worker M2 patched `findBestTarget` and `steerTowardsNearestEnemy` to inspect `(engine as any).entitiesToAdd`.
- **Step 4**: However, `AllyNPC.update()` lines 56 and 71 check `const player = engine.getEntity('player') as any;`.
- **Step 5**: If `player` was added via `engine.addEntity(player)` and `engine.tick()` has not yet executed, `engine.getEntity('player')` returns `undefined`.
- **Step 6**: The ally branches to `else { this.velocity.x = 0; this.state = 'IDLE'; }` and never moves, causing locomotion and ledge-drop tests to stall.

### 2.3 Floating-Point Lifetime Boundary
- **Step 1**: `PlayerRocketProjectile` starts with `maxLifeTime = 2.5` and `lifeTime = 2.5`.
- **Step 2**: In 60Hz discrete simulation, 2.5 seconds equals exactly 150 frames ($150 \times \frac{1}{60} = 2.5$).
- **Step 3**: Due to binary floating-point representation, $2.5 - 150 \times \frac{1}{60} = 3.878841692284141 \times 10^{-15}$.
- **Step 4**: Since $3.8788 \times 10^{-15} > 0$, `this.lifeTime <= 0` is false on frame 150.
- **Step 5**: Detonation does not occur on frame 150, but is delayed until frame 151 (t = 2.5167s).

### 2.4 Kinematic Jump Impulse Discretization
- **Step 1**: On jump initiation, `this.velocity.y = -350.0; this.justJumped = true;`.
- **Step 2**: On frame 0, `this.integrateKinematics` skips `velocity.y += gravity * dt` because `justJumped` is true.
- **Step 3**: Position integrates by $-350 \times \frac{1}{60} = -5.833$ px without any deceleration in frame 0.
- **Step 4**: In subsequent frames, gravity decelerates `velocity.y` by $+980 \times \frac{1}{60} = 16.333$ px/s per frame.
- **Step 5**: The discrete sum of vertical displacements reaches an apex of $\sim 65.3$ px above ground (Y = 134.7) instead of the theoretical continuum apex $\frac{v^2}{2g} = \frac{350^2}{1960} = 62.5$ px (Y = 137.5). The difference is $2.8$ px.

---

## 3. Caveats

1. **Test Environment vs Runtime**: In actual gameplay inside `GameEngine.update(dt)`, `engine.tick()` is called every 16.67ms and continuously flushes `entitiesToAdd` to `entities`. Therefore, Finding 2 primarily surfaces when tests or external callers invoke `update()` without running a tick.
2. **Regression Impact on Baseline**: None of the 3 baseline unit test suites (`allies_system.test.ts`, `diverse_weapons_items.test.ts`, `pow_system.test.ts`) fail.
3. **M1 Stress Test Timeouts**: When running all 29 test suites simultaneously with `npx vitest run tests/unit/`, 2 long-running stress tests from M1 (`challenger_2_empirical_stress.test.ts` and `challenger_boss_and_stability.test.ts`) timed out under the 15-second per-test threshold due to high concurrent CPU contention. When run individually, they pass.

---

## 4. Conclusion & Actionable Remediation

The Milestone M2 implementation demonstrates strong engineering quality, but requires surgical remediation of the identified defects before final approval:

### Concrete Remediation Plan for Worker:
1. **Fix Target Priority Order in `src/core/entities/allies/AllyNPC.ts`**:
   Check `MID_BOSS_VEHICLE` before `includes('BOSS')`:
   ```typescript
   let priorityWeight = 10;
   if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
     priorityWeight = 50;
   } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
     priorityWeight = 100;
   }
   ```
2. **Support Pending Player Entity in `src/core/entities/allies/AllyNPC.ts`**:
   Update player retrieval to check `entitiesToAdd` as a fallback:
   ```typescript
   let player = engine.getEntity('player') as any;
   if (!player && Array.isArray((engine as any).entitiesToAdd)) {
     player = (engine as any).entitiesToAdd.find(
       (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
     );
   }
   ```
3. **Add Epsilon to Rocket Lifetime Check in `src/core/weapons/RocketLauncherWeapon.ts`**:
   In `PlayerRocketProjectile.update`:
   ```typescript
   this.lifeTime -= dt;
   if (this.lifeTime <= 1e-4) {
     this.detonate(engine);
     return;
   }
   ```

---

## 5. Verification Method

### 5.1 Verification Commands
From the project root (`/Users/user/teamwork_projects/metal_slug_web`):

```bash
# 1. Type check
npx tsc --noEmit

# 2. Baseline Milestone M2 suites
npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts

# 3. Adversarial Challenger suites
npx vitest run tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts
```

### 5.2 Invalidation Conditions
- If any test in `allies_system.test.ts`, `diverse_weapons_items.test.ts`, or `pow_system.test.ts` fails.
- If `'MID_BOSS_VEHICLE'` priority is assigned weight 100 instead of 50.
- If rocket lifetime exceeds 2.5s by more than half a frame.
