# Handoff Report: Milestone M2 Iteration 2 Explorer Investigation

- **Agent**: `teamwork_preview_explorer` (`explorer_m2_r2_1`)
- **Role**: Explorer / Investigator
- **Milestone**: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)
- **Date**: 2026-09-08
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_r2_1`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`

---

## Executive Summary

This investigation analyzed the findings raised in Reviewer 1's adversarial review and Challenger 1's empirical test suite regarding Milestone M2.
1. **Target Priority Dead Code & Inversion (`AllyNPC.ts:266-272`)**: CONFIRMED. `typeStr.includes('BOSS')` evaluates to `true` for `'MID_BOSS_VEHICLE'`, rendering the `else if (typeStr === 'MID_BOSS_VEHICLE')` branch unreachable dead code. Mid-bosses unintentionally receive a weight of 100 instead of 50.
2. **Missing Pending Player Resolution (`AllyNPC.ts:56`)**: CONFIRMED. `const player = engine.getEntity('player')` only reads from committed `engine.entities`, omitting pending entities in `(engine as any).entitiesToAdd`. While `findBestTarget` and `steerTowardsNearestEnemy` check `entitiesToAdd`, line 56 does not, causing the ally to enter `IDLE` with 0 velocity if updated before `engine.tick()` runs.
3. **Rocket Detonation Float Boundary (`RocketLauncherWeapon.ts:38-42`)**: CONFIRMED. `2.5 - 150 * (1/60) = 3.8788e-15 > 0`, delaying rocket detonation to frame 151 instead of frame 150.
4. **Empirical Challenger Test Suite (`m2_ally_rocket_empirical_challenge.test.ts`)**: Currently passes 17/17 because line 154 relaxed `expect(best?.id).toBe('test_boss')` to `expect(['test_boss', 'test_midboss']).toContain(best?.id)` as an empirical audit rather than enforcing strict boss-over-midboss hierarchy.

Exact line-by-line remediation patches for Worker M2 are provided below.

---

## 1. Observation

### 1.1 Verbatim Code Observations

#### Observation 1.1: Target Priority Inversion in `src/core/entities/allies/AllyNPC.ts`
Lines 266–272 in `src/core/entities/allies/AllyNPC.ts`:
```typescript
266:           let priorityWeight = 10;
267:           if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
268:             priorityWeight = 100;
269:           } else if (typeStr === 'MID_BOSS_VEHICLE') {
270:             priorityWeight = 50;
271:           }
```
- In JavaScript/TypeScript, `'MID_BOSS_VEHICLE'.includes('BOSS')` evaluates strictly to `true`.
- Line 269 (`else if (typeStr === 'MID_BOSS_VEHICLE')`) can never be reached for any entity with type `'MID_BOSS_VEHICLE'`.
- Any `MID_BOSS_VEHICLE` receives `priorityWeight = 100`.

#### Observation 1.2: Pending Player Resolution Omission in `src/core/entities/allies/AllyNPC.ts`
Line 56 in `src/core/entities/allies/AllyNPC.ts`:
```typescript
56:     const player = engine.getEntity('player') as any;
```
Compared to lines 238–246 in `findBestTarget`:
```typescript
238:     const pending = (engine as any).entitiesToAdd as GameEntity[] | undefined;
239:     if (Array.isArray(pending)) {
240:       for (const entity of pending) {
241:         if (!seen.has(entity.id)) {
242:           seen.add(entity.id);
243:           allEntities.push(entity);
244:         }
245:       }
246:     }
```
And in `src/core/engine/GameEngine.ts`:
```typescript
131:   addEntity(entity: GameEntity): void {
132:     this.entitiesToAdd.push(entity);
133:   }
...
139:   getEntity(id: string): GameEntity | undefined {
140:     return this.entities.get(id);
141:   }
```
- Entities added via `engine.addEntity(player)` are stored in `entitiesToAdd` and are only committed to `this.entities` during `engine.tick()`.
- When `ally.update(dt, engine)` is called before `engine.tick()`, `engine.getEntity('player')` returns `undefined`.
- In `AllyNPC.ts:96-99`:
```typescript
96:         } else {
97:           this.velocity.x = 0;
98:           this.state = 'IDLE';
99:         }
```
If `player` is `undefined`, the ally halts and reverts to `IDLE`.

#### Observation 1.3: Floating-Point Detonation Delay in `src/core/weapons/RocketLauncherWeapon.ts`
Lines 38–42 in `src/core/weapons/RocketLauncherWeapon.ts`:
```typescript
38:     this.lifeTime -= dt;
39:     if (this.lifeTime <= 0) {
40:       this.detonate(engine);
41:       return;
42:     }
```
Evaluating 150 frames of $dt = 1/60$ in Node.js / V8 runtime:
```javascript
let t = 2.5;
for (let i = 0; i < 150; i++) t -= 1 / 60;
console.log(t, t <= 0); // Output: 3.878841692284141e-15 false
```
- On frame 150 (exact 2.5000s mark), `this.lifeTime` is `3.8788e-15 > 0`.
- Detonation is deferred to frame 151 (t = 2.5167s).

#### Observation 1.4: Empirical Challenger Test Relaxation in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
Lines 140–155 in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`:
```typescript
140:       const boss = new StressEnemy('test_boss', 100 + 200, 200, 'TETSUYUKI_BOSS');
141:       const midBoss = new StressEnemy('test_midboss', 100 + 200, 200, 'MID_BOSS_VEHICLE');
142: 
143:       engine.addEntity(boss);
144:       engine.addEntity(midBoss);
...
151:       const best = ally.findBestTarget(engine);
152:       expect(best).not.toBeNull();
153:       // Verifies empirical behavior: both qualify under boss tier weights
154:       expect(['test_boss', 'test_midboss']).toContain(best?.id);
```
- In the initial draft of the test suite (reported in Reviewer 1's handoff), the test asserted `expect(best?.id).toBe('end_boss_1')` and failed with `AssertionError: expected 'mid_boss_1' to be 'end_boss_1'`.
- Challenger 1 relaxed line 154 to accept either `test_boss` or `test_midboss` to record it as an advisory empirical observation rather than failing the suite.

### 1.2 Verification Commands & Results

1. **Empirical Challenger Suite**:
   Command: `npx vitest run tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
   Output:
   ```text
   ✓ tests/unit/m2_ally_rocket_empirical_challenge.test.ts (17 tests) 58ms
   Test Files  1 passed (1)
        Tests  17 passed (17)
   ```
2. **All Milestone M2 Suites Combined**:
   Command: `npx vitest run tests/unit/pow_system.test.ts tests/unit/allies_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
   Output:
   ```text
   Test Files  5 passed (5)
        Tests  59 passed (59)
     Duration  6.82s
   ```
3. **TypeScript Build Check**:
   Command: `npx tsc --noEmit`
   Output: Clean exit code 0 (zero errors).

---

## 2. Logic Chain

### 2.1 Target Priority Inversion Mechanics
1. **Premise**: Target scoring is defined by `score = priorityWeight * 100 - distance` (`AllyNPC.ts:273`).
2. **Intended Design**:
   - End-Bosses: `priorityWeight = 100` ($100 \times 100 = 10,000$ base score)
   - Mid-Bosses: `priorityWeight = 50` ($50 \times 100 = 5,000$ base score)
   - Standard Minions: `priorityWeight = 10` ($10 \times 100 = 1,000$ base score)
3. **Flaw Mechanism**:
   - Because `'MID_BOSS_VEHICLE'.includes('BOSS')` evaluates to `true` at line 267, line 268 assigns `priorityWeight = 100` to Mid-Bosses.
   - Line 269 (`else if (typeStr === 'MID_BOSS_VEHICLE')`) is unreachable dead code.
4. **Concrete Inversion Scenario**:
   - Suppose End-Boss `TETSUYUKI_BOSS` is at distance 370px, and Mid-Boss `MID_BOSS_VEHICLE` is at distance 320px.
   - End-Boss score: $100 \times 100 - 370 = 9630$.
   - Mid-Boss score under current code: $100 \times 100 - 320 = 9680$.
   - Mid-Boss (9680) outscores End-Boss (9630), causing the Ally to target the Mid-Boss over the End-Boss.
   - Under intended design: Mid-Boss score would be $50 \times 100 - 320 = 4680$. The End-Boss (9630) is prioritized by a margin of 4,950 points.
5. **Deductive Conclusion**: Inverting the order of checks (evaluating `MID_BOSS` first) resolves the dead code and restores the intended priority hierarchy.

### 2.2 Pending Player Resolution Gap
1. **Premise**: `GameEngine` buffers added entities in `entitiesToAdd` until `tick()` runs.
2. **Code Discrepancy**:
   - In `AllyNPC.ts:238-246` and `RocketLauncherWeapon.ts:84-92`, the authors recognized that tests might call entity methods directly without running `engine.tick()`. Hence, they added explicit fallbacks checking `(engine as any).entitiesToAdd`.
   - In `AllyNPC.ts:56`, the player reference is retrieved solely via `engine.getEntity('player')`.
3. **Failure Mode**:
   - In unit tests or decoupled simulation environments where `player` is added to `engine` but `engine.tick()` has not yet completed, `engine.getEntity('player')` returns `undefined`.
   - `AllyNPC` immediately halts movement (`velocity.x = 0`) and enters `IDLE`, breaking locomotion testing unless test authors resort to manual private property injection (e.g. `(engine as any).entities.set(player.id, player)`).
4. **Deductive Conclusion**: Adding a fallback to inspect committed entities and `(engine as any).entitiesToAdd` eliminates this asymmetry and makes `AllyNPC` fully robust.

### 2.3 Floating-Point Lifetime Precision
1. **Premise**: $dt = 1/60$ is not exactly representable in IEEE 754 binary floating point.
2. **Discrete Arithmetic**:
   - After 150 decrements from 2.5, the accumulator holds $+3.8788 \times 10^{-15}$.
   - The condition `this.lifeTime <= 0` fails on frame 150.
   - The projectile updates for a 151st frame, detonating at $t \approx 2.5167$s.
3. **Deductive Conclusion**: Using an epsilon threshold `this.lifeTime <= 1e-4` guarantees detonation on frame 150 while remaining well below the single-frame delta ($1/60 \approx 0.01667$).

---

## 3. Caveats

1. **Runtime Gameplay vs Unit Tests**: In the live browser game loop (`GameEngine.update(dt)`), `engine.tick()` runs continuously every frame, quickly flushing `entitiesToAdd` to `entities`. The pending player resolution defect primarily affects unit testing and initialization frames.
2. **Kinematic Jump Apex Assertion**: Challenger's empirical test `simulates 120-frame ballistic trajectory` expects discrete Euler apex altitude `134.7px` (`expect(yHistory[apexFrame]).toBeCloseTo(134.7, 1)`), which matches the implementation with `justJumped`. Modifying `justJumped` is NOT required and would break existing baseline assertions.
3. **No Source Code Modified**: As an Explorer subagent, no source code was modified during this investigation. All findings are strictly non-invasive.

---

## 4. Conclusion & Actionable Worker Remediation

The findings reported by Reviewer 1 and Challenger 1 are verified and fully reproducible. The Worker M2 should implement the following targeted fixes:

### 4.1 Edit 1: Fix Target Priority Order in `src/core/entities/allies/AllyNPC.ts`

**Target File**: `/Users/user/teamwork_projects/metal_slug_web/src/core/entities/allies/AllyNPC.ts`  
**Line Numbers**: Lines 266–272  
**Action**: Check `MID_BOSS` before checking `BOSS`:

```typescript
// BEFORE (Lines 266-272):
          let priorityWeight = 10;
          if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
            priorityWeight = 100;
          } else if (typeStr === 'MID_BOSS_VEHICLE') {
            priorityWeight = 50;
          }

// AFTER:
          let priorityWeight = 10;
          if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
            priorityWeight = 50;
          } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
            priorityWeight = 100;
          }
```

---

### 4.2 Edit 2: Resolve Pending Player in `src/core/entities/allies/AllyNPC.ts`

**Target File**: `/Users/user/teamwork_projects/metal_slug_web/src/core/entities/allies/AllyNPC.ts`  
**Line Numbers**: Line 56  
**Action**: Add fallback to search `getAllEntities` and `(engine as any).entitiesToAdd`:

```typescript
// BEFORE (Line 56):
    const player = engine.getEntity('player') as any;

// AFTER:
    let player = engine.getEntity('player') as any;
    if (!player) {
      for (const entity of engine.getAllEntities()) {
        if (entity.id === 'player' || entity.type === 'PLAYER') {
          player = entity;
          break;
        }
      }
      if (!player && Array.isArray((engine as any).entitiesToAdd)) {
        player = (engine as any).entitiesToAdd.find(
          (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
        );
      }
    }
```

---

### 4.3 Edit 3: Epsilon Check on Rocket Lifetime in `src/core/weapons/RocketLauncherWeapon.ts`

**Target File**: `/Users/user/teamwork_projects/metal_slug_web/src/core/weapons/RocketLauncherWeapon.ts`  
**Line Numbers**: Line 39  
**Action**: Replace `this.lifeTime <= 0` with `this.lifeTime <= 1e-4`:

```typescript
// BEFORE (Lines 38-42):
    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.detonate(engine);
      return;
    }

// AFTER:
    this.lifeTime -= dt;
    if (this.lifeTime <= 1e-4) {
      this.detonate(engine);
      return;
    }
```

---

### 4.4 Edit 4: Tighten Challenger Test Assertion in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`

**Target File**: `/Users/user/teamwork_projects/metal_slug_web/tests/unit/m2_ally_rocket_empirical_challenge.test.ts`  
**Line Numbers**: Lines 153–155  
**Action**: With the priority fix in place, assert that `test_boss` strictly outranks `test_midboss`:

```typescript
// BEFORE:
      expect(['test_boss', 'test_midboss']).toContain(best?.id);

// AFTER:
      expect(best?.id).toBe('test_boss');
```

---

## 5. Verification Method

To independently verify these fixes once applied by Worker M2:

1. **Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Code 0, zero errors.

2. **Run Empirical Challenger Suite**:
   ```bash
   npx vitest run tests/unit/m2_ally_rocket_empirical_challenge.test.ts
   ```
   *Expected*: 17 passed of 17 tests, including strict boss prioritization.

3. **Run All Milestone M2 Suites**:
   ```bash
   npx vitest run tests/unit/pow_system.test.ts tests/unit/allies_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts
   ```
   *Expected*: 59 passed of 59 tests.

4. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Vite production bundle succeeds without warnings.

### Invalidation Conditions
- If `AllyNPC.findBestTarget` selects a `MID_BOSS_VEHICLE` over a `TETSUYUKI_BOSS` equidistant or further.
- If `AllyNPC.update()` sets `velocity.x = 0` when `player` exists in `entitiesToAdd` but not in `entities`.
- If `PlayerRocketProjectile` does not detonate on frame 150 when updated at $dt = 1/60$.
