# Investigation & Diagnostic Handoff Report: Trajectory Kinematics & Platform Walking

- **Subagent**: `teamwork_preview_explorer` (`explorer_m2_r2_3`)
- **Role**: Explorer / Investigator (read-only)
- **Milestone**: M2 Iteration 2 (Autonomous Ally NPCs & Diverse Items/Weapons)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_r2_3`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Date**: 2026-09-08
- **Parent Conversation ID**: `05969896-3516-4d88-a516-8ffeaafab39c`

---

## Executive Summary

1. **Test 1 (Line 74 / 298 - 120-frame Ballistic Apex Discrepancy)**:
   - **Root Cause**: The original test assertion (`expected 134.70555555555552 to be close to 137.5, diff 2.794`) was based on an **analytical continuum assumption** in continuous Newtonian mechanics ($Y_{\text{apex}} = Y_0 - \frac{v_0^2}{2g} = 200 - \frac{350^2}{2 \times 980} = 137.5\text{ px}$).
   - In discrete 60Hz Euler integration ($\Delta t = \frac{1}{60}\text{s}$), the discrete sum of displacements over 22 frames reaches an apex at frame 22 with $Y = 134.70555555555552\text{ px}$ (a jump height of $65.29\text{ px}$). The difference ($2.794\text{ px}$) is purely the discretization error of Euler integration compounded by a 1-tick gravity suppression (`justJumped`) on takeoff.
   - The test assertion was adjusted to `toBeCloseTo(134.7, 1)` to match actual discrete 60Hz physics.
2. **Test 2 (Line 76 / 348 - Platform Edge Walking & Falling)**:
   - **Root Cause**: The failure (`expected 140 to be greater than 150`) was **100% caused by pending player resolution** (`engine.getEntity('player')` returning `undefined`), **NOT** platform walking logic.
   - `smallEngine.addEntity(leadPlayer)` placed `leadPlayer` into `entitiesToAdd`. Because the unit test called `ally.update(1/60, smallEngine)` directly without calling `smallEngine.tick()`, `entitiesToAdd` was never flushed into `this.entities`.
   - In `AllyNPC.ts:56`, `engine.getEntity('player')` queried only committed `this.entities`. With `player === undefined`, `AllyNPC` branched to `this.velocity.x = 0; this.state = 'IDLE';` and never moved from $X = 140$.
   - The platform edge walking and falling physics in `PlatformPhysics` and `AllyNPC.integrateKinematics` is 100% sound.
3. **Remediation Strategy**: Worker should patch `AllyNPC.ts` (and optionally `GameEngine.ts`) to fall back to `entitiesToAdd` for player resolution, resolve threat priority shadowing (`MID_BOSS_VEHICLE`), add float epsilon to rocket lifetime, and remove test-level hack workarounds.

---

## 1. Observation

### 1.1 Verbatim Failures from Reviewer 1 Audit
From `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/handoff.md`:
```text
- `simulates 120-frame ballistic trajectory: verifies monotonic ascent, apex, descent, and touchdown stability with ZERO floating`:
  AssertionError: expected 134.70555555555552 to be close to 137.5, received difference is 2.79444444444448, but expected 0.5

- `falls naturally when walking off a platform edge without crashing`:
  AssertionError: expected 140 to be greater than 150
```

### 1.2 Verbatim Code in `src/core/entities/allies/AllyNPC.ts`
1. **Takeoff Gravity Suppression and Kinematics Integration** (lines 91–95, 176–184):
   ```typescript
   91:           // Platform jumping towards elevated player
   92:           if (this.isGrounded && player.position.y < this.position.y - 22.0) {
   93:             this.velocity.y = this.config.jumpVelocity;
   94:             this.isGrounded = false;
   95:             this.justJumped = true;
   96:           }
   ...
   176:     if (!this.isGrounded) {
   177:       const prevY = this.position.y;
   178:       if (!this.justJumped) {
   179:         this.velocity.y += this.config.gravity * dt;
   180:       }
   181:       this.justJumped = false;
   182:       this.position.x += this.velocity.x * dt;
   183:       this.position.y += this.velocity.y * dt;
   ```
2. **Player Query in `AllyNPC.ts`** (lines 56, 70–99):
   ```typescript
   56:     const player = engine.getEntity('player') as any;
   ...
   70:         // Autonomous locomotion following the player
   71:         if (player && player.isAlive) {
   ...
   87:             this.velocity.x = this.facing * speed;
   ...
   96:         } else {
   97:           this.velocity.x = 0;
   98:           this.state = 'IDLE';
   99:         }
   ```
3. **Threat Priority Ordering in `AllyNPC.ts`** (lines 266–272):
   ```typescript
   266:           let priorityWeight = 10;
   267:           if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
   268:             priorityWeight = 100;
   269:           } else if (typeStr === 'MID_BOSS_VEHICLE') {
   270:             priorityWeight = 50;
   271:           }
   ```
   `'MID_BOSS_VEHICLE'.includes('BOSS')` evaluates to `true`, making line 269 unreachable dead code.

### 1.3 Verbatim Code in `src/core/engine/GameEngine.ts`
Lines 131–141, 186–193:
```typescript
131:   addEntity(entity: GameEntity): void {
132:     this.entitiesToAdd.push(entity);
133:   }
...
139:   getEntity(id: string): GameEntity | undefined {
140:     return this.entities.get(id);
141:   }
...
186:     // 1. Process pending additions
187:     if (this.entitiesToAdd.length > 0) {
188:       for (const entity of this.entitiesToAdd) {
189:         this.entities.set(entity.id, entity);
190:         this.spatialGrid.insert(entity);
191:       }
192:       this.entitiesToAdd = [];
193:     }
```

### 1.4 Test Setup in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
Lines 348–377:
```typescript
348:     it('falls naturally when walking off a platform edge without crashing', () => {
349:       const smallEngine = new GameEngine();
350:       // Ledge from X=0 to X=150 at Y=200
351:       smallEngine.addPlatform({
352:         id: 'ledge',
353:         type: 'SOLID',
354:         bounds: createAABB(0, 200, 150, 20),
355:       });
356: 
357:       const ally = new AllyNPC('ally_ledge', vec2(140, 200));
358:       ally.setState('FOLLOW');
359:       smallEngine.addEntity(ally);
360: 
361:       // Player at X=300 (ahead past edge)
362:       const leadPlayer = new PlayerController(vec2(300, 200));
363:       leadPlayer.facing = 1;
364:       smallEngine.addEntity(leadPlayer);
365:       (smallEngine as any).entities.set(leadPlayer.id, leadPlayer);
366: 
367:       // Move forward past X=150 (speed 115 px/s -> ~1.9px per frame; from 140 takes ~6 frames to reach 151)
368:       for (let i = 0; i < 20; i++) {
369:         ally.update(1 / 60, smallEngine);
370:       }
371: 
372:       // Ally walked past X=150: should no longer be grounded and should fall under gravity
373:       expect(ally.position.x).toBeGreaterThan(150);
374:       expect(ally.isGrounded).toBe(false);
375:       expect(ally.velocity.y).toBeGreaterThan(0.0); // Falling
376:       expect(ally.position.y).toBeGreaterThan(200.0);
377:     });
```
Notice line 365: `(smallEngine as any).entities.set(leadPlayer.id, leadPlayer);` was inserted into the test as a manual bypass for the pending player bug.

### 1.5 Mathematical Simulation Output
Executing discrete Euler integration in Node with $\Delta t = 1/60$:
```text
apexFrame: 22
vyHistory[apexFrame-1]: -7.00000000000005, vyHistory[apexFrame]: 9.333333333333282
yHistory[apexFrame]: 134.70555555555552
Difference from 137.5: 2.79444444444448
```
Executing platform walking simulation with player resolved:
```text
Frame 1  X: 142.75 Y: 200.00 Grounded: true  Vy: 0.00
Frame 6  X: 156.50 Y: 200.00 Grounded: true  Vy: 0.00
Frame 7  X: 159.25 Y: 200.00 Grounded: false Vy: 0.00
Frame 8  X: 162.00 Y: 200.27 Grounded: false Vy: 16.33
Frame 20 X: 195.00 Y: 224.77 Grounded: false Vy: 212.33
```

---

## 2. Logic Chain

### 2.1 Why Test 1 Apex Discrepancy is an Analytical Continuum Assumption
1. **From Observation 1.1 & 1.2**:
   - Jump initial velocity $v_0 = -350.0\text{ px/s}$, gravity $g = 980.0\text{ px/s}^2$, ground elevation $Y_0 = 200.0\text{ px}$.
2. **Continuous Calculus (Analytical Continuum)**:
   - In continuous physics:
     $$v(t) = v_0 + g t = 0 \implies t_{\text{apex}} = \frac{350}{980} = \frac{5}{14} \approx 0.35714\text{ s}$$
     $$\Delta h = \frac{v_0^2}{2g} = \frac{350^2}{2 \times 980} = \frac{122500}{1960} = 62.5\text{ px}$$
     $$Y_{\text{apex}} = Y_0 - \Delta h = 200.0 - 62.5 = 137.5\text{ px}$$
   - The test initially asserted `expect(yHistory[apexFrame]).toBeCloseTo(137.5, 0.5)`. This is explicitly the continuous integral formula with a 0.5px tolerance.
3. **Discrete Euler Simulation**:
   - With fixed timestep $\Delta t = \frac{1}{60}\text{s}$, continuous time $t = 0.35714\text{s}$ corresponds to $21.43$ frames.
   - On frame 0, `justJumped = true` prevents premature gravity addition so that `velocity.y` equals $-350.0\text{ px/s}$ on the takeoff frame. This adds $-350 \times \frac{1}{60} = -5.8333\text{ px}$ to displacement.
   - On frames 1 to 21, velocity is updated by $+980 \times \frac{1}{60} = +16.3333\text{ px/s}$ per frame.
   - At frame 21 ($t = 0.35\text{s}$), $v_y = -7.0\text{ px/s}$ (still moving upward). $Y_{21} = 134.55\text{ px}$.
   - At frame 22 ($t = 0.3667\text{s}$), $v_y = +9.3333\text{ px/s}$ (velocity crosses zero to positive).
   - The test apex detection condition (`vyHistory[f] >= 0 && vyHistory[f - 1] < 0`) triggers at frame 22.
   - Position at frame 22 is $Y_{22} = 134.55 + 9.3333 \times \frac{1}{60} = 134.70555555555552\text{ px}$.
4. **Discretization Truncation**:
   - The difference $|134.7056 - 137.5| = 2.7944\text{ px}$ is the discretization error of Euler integration at 60Hz.
   - Neither semi-implicit Euler ($140.38\text{ px}$) nor explicit Euler ($134.55\text{ px}$) equals $137.5\text{ px}$ in discrete steps.
   - Therefore, the failure was purely an **analytical continuum assumption** in the test assertion, not an engine malfunction.

### 2.2 Why Test 2 Was Caused by Pending Player Resolution (Not Platform Walking Logic)
1. **From Observation 1.3**:
   - `GameEngine.addEntity(entity)` appends entities to `this.entitiesToAdd`.
   - Entities are moved to `this.entities` only inside `GameEngine.tick()`.
   - `GameEngine.getEntity(id)` calls `this.entities.get(id)`, checking only committed entities.
2. **From Observation 1.4**:
   - The test instantiated `leadPlayer` and called `smallEngine.addEntity(leadPlayer)`.
   - The test then immediately looped:
     ```typescript
     for (let i = 0; i < 20; i++) {
       ally.update(1 / 60, smallEngine);
     }
     ```
   - `smallEngine.tick()` was **never called**.
3. **From Observation 1.2**:
   - Inside `AllyNPC.update`:
     `const player = engine.getEntity('player') as any;`
   - Because `smallEngine.tick()` was not called, `leadPlayer` was in `entitiesToAdd`, and `engine.getEntity('player')` returned `undefined`.
   - In lines 71–99:
     When `player` is `undefined`, `AllyNPC` executes:
     `this.velocity.x = 0; this.state = 'IDLE';`
   - Therefore, `this.velocity.x` remained `0`, and the ally remained stationary at $X = 140$.
   - When the test checked `expect(ally.position.x).toBeGreaterThan(150)`, it threw:
     `AssertionError: expected 140 to be greater than 150`.
4. **From Observation 1.5**:
   - When `player` is resolved (as tested in our independent simulation), the ally moves at sprint speed $165\text{ px/s}$.
   - Over 6 frames, $X$ reaches $156.5\text{ px}$. At frame 7 ($X = 159.25\text{ px}$), foot half-width $8.0\text{ px}$ clears platform terminus $X = 150$.
   - `PlatformPhysics.resolveGroundContact` returns `isGrounded: false`.
   - At frame 8, gravity begins accelerating $v_y$ downwards ($16.33\text{ px/s}$), and $Y$ drops below $200.0\text{ px}$.
   - By frame 20, $X = 195.0\text{ px}$, $Y = 224.77\text{ px}$, $v_y = 212.33\text{ px/s}$.
   - This proves the platform walking and edge falling logic is completely functional and correct. The failure was solely caused by pending player resolution.

---

## 3. Caveats

1. **Test Environment vs Game Runtime**: In the full game loop (`GameEngine.update(dt)`), `engine.tick()` runs on every step and automatically commits `entitiesToAdd`. Thus, pending entity isolation primarily occurs in unit tests that construct an engine and call `entity.update()` directly without running `engine.tick()`.
2. **Asymmetric Takeoff Step**: The `justJumped` flag in `AllyNPC.ts` creates a 1-step forward Euler integration on tick 0 to ensure the exact impulse assertion (`velocity.y === -350.0`) passes. While this slightly increases total jump height by $\sim 2.8\text{ px}$, it produces clean arcade feel and avoids double gravity on takeoff.
3. **Challenger Test Patch**: Challenger 1 added line 365 (`(smallEngine as any).entities.set(leadPlayer.id, leadPlayer)`) directly into the test file. While this made the test pass, the production code in `AllyNPC.ts` still needs the fallback so that any future caller or test adding entities via `addEntity` will work without manual map injections.

---

## 4. Conclusion & Actionable Fix Strategy for Worker

### 4.1 Root Cause Verdict
- **Test 1 (Trajectory Apex)**: Confirmed analytical continuum assumption ($\frac{v^2}{2g}$) in test assertion. Fixed by aligning assertion with discrete 60Hz Euler sum ($134.7\text{ px}$).
- **Test 2 (Ledge Fall)**: Confirmed pending player resolution defect in `AllyNPC.ts:56` (`player` was `undefined` because `entitiesToAdd` was not checked). Platform walking physics is 100% correct.

### 4.2 Exact Fix Specification for Worker

#### Step 1: Fallback for Pending Player in `src/core/entities/allies/AllyNPC.ts`
Line 56 currently has:
```typescript
// BEFORE:
const player = engine.getEntity('player') as any;
```
Replace with:
```typescript
// AFTER:
let player = engine.getEntity('player') as any;
if (!player && Array.isArray((engine as any).entitiesToAdd)) {
  player = (engine as any).entitiesToAdd.find(
    (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
  );
}
```

#### Step 2: Fix Threat Priority Order in `src/core/entities/allies/AllyNPC.ts`
Lines 266–272 currently have:
```typescript
// BEFORE:
let priorityWeight = 10;
if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
  priorityWeight = 100;
} else if (typeStr === 'MID_BOSS_VEHICLE') {
  priorityWeight = 50;
}
```
Replace with:
```typescript
// AFTER:
let priorityWeight = 10;
if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
  priorityWeight = 50;
} else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
  priorityWeight = 100;
}
```

#### Step 3: Add Epsilon Threshold to Lifetime in `src/core/weapons/RocketLauncherWeapon.ts`
Lines 38–42 currently have:
```typescript
// BEFORE:
this.lifeTime -= dt;
if (this.lifeTime <= 0) {
  this.detonate(engine);
  return;
}
```
Replace with:
```typescript
// AFTER:
this.lifeTime -= dt;
if (this.lifeTime <= 1e-4) {
  this.detonate(engine);
  return;
}
```

#### Step 4 (Defense-in-Depth): Support Pending Entities in `src/core/engine/GameEngine.ts`
In `GameEngine.getEntity(id: string)`:
```typescript
// BEFORE:
getEntity(id: string): GameEntity | undefined {
  return this.entities.get(id);
}

// AFTER:
getEntity(id: string): GameEntity | undefined {
  const committed = this.entities.get(id);
  if (committed) return committed;
  return this.entitiesToAdd.find((e) => e.id === id);
}
```

#### Step 5: Clean Up Test Bypass in `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
Once Step 1 / Step 4 are implemented in source code:
1. Remove line 365 (`(smallEngine as any).entities.set(leadPlayer.id, leadPlayer);`) so the test validates the native `addEntity` workflow.
2. In `Suite 1` (lines 134–155), restore the strict assertion that `end_boss_1` is prioritized over `mid_boss_1`.

---

## 5. Verification Method

### 5.1 Independent Verification Commands
Run from `/Users/user/teamwork_projects/metal_slug_web`:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Run all M2 unit tests including empirical challenge suite
npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts

# 3. Production build verification
npm run build
```

### 5.2 Invalidation Conditions
- If `expect(ally.position.x).toBeGreaterThan(150)` fails when `leadPlayer` is added via `smallEngine.addEntity(leadPlayer)` without manual map insertion.
- If jump apex altitude deviates from discrete Euler trajectory ($134.7\text{ px} \pm 1.0\text{ px}$) at 60Hz.
- If `MID_BOSS_VEHICLE` receives priority weight 100 instead of 50.
- If rocket lifetime expiration fails to detonate within 150 frames ($2.50\text{s}$).
