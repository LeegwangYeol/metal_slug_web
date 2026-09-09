# Milestone M1 Test Failures Forensic Investigation & Remediation Report

## 1. Observation

### 1.1 Test Execution Diagnostic Command & Verbatim Results
Command executed via `run_command`:
```bash
npx vitest run tests/unit/boss_crisis_events.test.ts tests/unit/iron_nokana_boss.test.ts
```

Verbatim Vitest Output:
```
 RUN  v3.2.7 /Users/user/src/fullmetalslug

 ❯ tests/unit/iron_nokana_boss.test.ts (13 tests | 2 failed) 192ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 1. Initial Configuration & Specifications > initializes with 400 HP, grounded dimensions, and PHASE_1_CRAWLER_BARRAGE 2ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 1. Initial Configuration & Specifications > supports custom HP configuration 1ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 2. Four-Phase State Transitions > Phase 1 (100% -> 75% HP = 400 -> 300 HP): clamped at 300 HP and transitions to Phase 2 0ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 2. Four-Phase State Transitions > Phase 2 (75% -> 50% HP = 300 -> 200 HP): clamped at 200 HP and transitions to Phase 3 3ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 2. Four-Phase State Transitions > Phase 3 (50% -> 25% HP = 200 -> 100 HP): clamped at 100 HP and transitions to Phase 4 Overdrive 6ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 2. Four-Phase State Transitions > Phase 4 (25% -> 0% HP = 100 -> 0 HP): transitions to DEATH_EXPLODING 0ms
   × Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 3. Telegraphed Attacks & Visual Warning Mechanics > flame sweep attack has 0.8s telegraph period and emits telegraph event 112ms
     → expected false to be true // Object.is equality
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 3. Telegraphed Attacks & Visual Warning Mechanics > cannon attack has 0.5s telegraph period before firing 13ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 4. Weak Point Bonus Damage (1.5x multiplier) > hits to exposed weak point deal 1.5x damage 0ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 4. Weak Point Bonus Damage (1.5x multiplier) > hits when weak point is NOT exposed deal normal 1.0x damage even if targeting weak point 0ms
   × Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 5. Death Demolition Chain & Final Destruction > executes 3.6s chain demolition and emits boss_destroyed and mission_complete 13ms
     → expected 'PHASE_2_FLAME_SWEEP' to be 'DEATH_EXPLODING' // Object.is equality
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 6. Sub-Entity Projectile Integration > IronNokanaCannonShell follows parabolic arc and detonates on ground 23ms
   ✓ Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 6. Sub-Entity Projectile Integration > IronNokanaRocket tracks player and can be destroyed in 1 hit 1ms

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/boss_crisis_events.test.ts [ tests/unit/boss_crisis_events.test.ts ]
Error: Cannot find module '../../src/input/InputManager' imported from '/Users/user/src/fullmetalslug/tests/unit/boss_crisis_events.test.ts'
 ❯ tests/unit/boss_crisis_events.test.ts:13:1
     11| } from '../../src/core/entities/boss/EnvironmentalHazard';
     12| import { PlayerController } from '../../src/core/player/PlayerControll…
     13| import { InputManager } from '../../src/input/InputManager';
       | ^
     14| import { SoundEngine } from '../../src/audio/SoundEngine';
     15| import { createPlatform } from '../../src/core/physics/Platform';

Caused by: Error: Failed to load url ../../src/input/InputManager (resolved id: ../../src/input/InputManager) in /Users/user/src/fullmetalslug/tests/unit/boss_crisis_events.test.ts. Does the file exist?

⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/iron_nokana_boss.test.ts > Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 3. Telegraphed Attacks & Visual Warning Mechanics > flame sweep attack has 0.8s telegraph period and emits telegraph event
AssertionError: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ tests/unit/iron_nokana_boss.test.ts:107:30
    105| 
    106|       expect(boss.isFlameTelegraphing).toBe(true);
    107|       expect(telegraphFired).toBe(true);
       |                              ^

 FAIL  tests/unit/iron_nokana_boss.test.ts > Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite > 5. Death Demolition Chain & Final Destruction > executes 3.6s chain demolition and emits boss_destroyed and mission_complete
AssertionError: expected 'PHASE_2_FLAME_SWEEP' to be 'DEATH_EXPLODING' // Object.is equality
Expected: "DEATH_EXPLODING"
Received: "PHASE_2_FLAME_SWEEP"
 ❯ tests/unit/iron_nokana_boss.test.ts:179:26
    177| 
    178|       boss.takeDamage(400);
    179|       expect(boss.phase).toBe('DEATH_EXPLODING');
       |                          ^
```

### 1.2 TypeScript Compiler Errors (`npx tsc --noEmit`)
```
tests/unit/boss_crisis_events.test.ts(13,30): error TS2307: Cannot find module '../../src/input/InputManager' or its corresponding type declarations.
tests/unit/boss_crisis_events.test.ts(15,10): error TS2305: Module '"../../src/core/physics/Platform"' has no exported member 'createPlatform'.
tests/unit/boss_crisis_events.test.ts(231,74): error TS2554: Expected 0-2 arguments, but got 4.
```

### 1.3 Baseline Invariant State
Execution of the remaining test suites (`npx vitest run --exclude 'tests/unit/boss_crisis_events.test.ts' --exclude 'tests/unit/iron_nokana_boss.test.ts'`):
- **Test Files**: 24 passed (24)
- **Tests**: 294 passed (294)
All existing regression baselines pass.

---

## 2. Logic Chain

### 2.1 Analysis of `tests/unit/boss_crisis_events.test.ts`
1. **Observation 1.1 & 1.2**: Line 13 imports non-existent `InputManager` from `../../src/input/InputManager`. Searching the codebase for `InputManager` yielded 0 results. The project uses `KeyboardController` and `TouchVirtualPad` in `src/input/`.
2. **Observation 1.2**: Line 231 calls `new PlayerController('player', { x: 1900, y: 200 }, input, sound)`. In `src/core/player/PlayerController.ts:84-87`, the constructor is:
   ```typescript
   constructor(startPosition: Vector2D = vec2(100, 200), weaponManager?: WeaponManager)
   ```
   Passing 4 arguments violates the constructor signature (`TS2554: Expected 0-2 arguments, but got 4`).
3. **Observation 1.2**: Line 15 imports `createPlatform` from `../../src/core/physics/Platform`. In `src/core/physics/Platform.ts`, `createPlatform` is not exported (`TS2305`).
4. **Observation on Damage Clamping**:
   - `IronNokanaBoss.takeDamage(amount)` (`src/core/entities/boss/IronNokanaBoss.ts:549-594`) clamps damage per phase:
     - Phase 1 threshold: 300 HP (75%)
     - Phase 2 threshold: 200 HP (50%)
     - Phase 3 threshold: 100 HP (25%)
     - Phase 4 threshold: 0 HP (Death)
   - In `boss_crisis_events.test.ts`:
     - Line 77: `boss.takeDamage(200)` only reduces 400 HP to 300 HP in Phase 1 and transitions to Phase 2. `CRISIS_TERRAIN_COLLAPSE` (50% HP = 200 HP) is not reached with a single 200-damage hit.
     - Line 91: `boss.takeDamage(300)` only reduces 400 HP to 300 HP in Phase 1. `CRISIS_RAGE_OVERDRIVE` (25% HP = 100 HP) is not reached with a single 300-damage hit.
     - Line 162: `boss.takeDamage(200)` needs Phase 1 and Phase 2 damage to collapse the platform.
     - Line 188: `boss.takeDamage(300)` needs Phase 1, 2, and 3 damage to trigger rage.
     - Line 211: `boss.takeDamage(5000)` only clamps to 300 HP on a Phase 1 boss. To verify `CrisisEventManager`'s handling of burst damage triggering all 3 thresholds sequentially (`CRISIS_ARTILLERY_STRIKE`, `CRISIS_TERRAIN_COLLAPSE`, `CRISIS_RAGE_OVERDRIVE`), the boss's HP must be reduced down to 0 across the phases.
5. **Observation on Player Lives vs HP in Test 6**:
   - In `PlayerController.ts:543-561`, `player.maxHealth` is 1.0. When taking hazard damage >= 1.0, `player.lives` decreases from 3 to 2, and the player immediately respawns with `player.health = player.maxHealth = 1.0` and 2s invulnerability.
   - In `boss_crisis_events.test.ts:243`, `expect(player.health).toBeLessThan(initialHealth)` fails because `1.0 < 1.0` is false.
   - Giving the test player `player.maxHealth = 10; player.health = 10;` or asserting `player.lives < initialLives` properly verifies damage intake.
6. **Observation on Tetsuyuki Threshold in Test 7**:
   - In `TetsuyukiBoss.ts:689`, `p1Threshold = Math.round(this.maxHealth * 0.65) = 260 HP`.
   - `boss_crisis_events.test.ts:257` calls `tetsuyuki.takeDamage(100)` twice from 400 HP, expecting 200 HP (50%). However, Phase 1 clamps at 260 HP (65%). An additional hit in Phase 2 (`tetsuyuki.takeDamage(60)`) brings HP down to 200 HP (50%) and triggers `CRISIS_TERRAIN_COLLAPSE`.

### 2.2 Analysis of `tests/unit/iron_nokana_boss.test.ts`
1. **Failure 1 (Line 107: `expect(telegraphFired).toBe(true)` received `false`)**:
   - In `src/core/entities/boss/IronNokanaBoss.ts:596-600`:
     ```typescript
     private transitionToPhase2(): void {
       this.phase = 'PHASE_2_FLAME_SWEEP';
       this.isFlameTelegraphing = true; // PREMATURE STATE
       this.flameTelegraphTimer = 0;
     }
     ```
   - When `boss.takeDamage(100)` transitioned the boss to Phase 2 at line 93, `isFlameTelegraphing` was set to `true` without emitting `boss_flame_telegraph`.
   - At line 103-104, `boss.flameCooldownTimer = 0; boss.update(1/60, engine)` was invoked. In `updateFlameSweep(dt, engine)`:
     ```typescript
     if (this.isFlameTelegraphing) {
       this.flameTelegraphTimer += dt;
       // ... returns without emitting event
       return;
     }
     ```
     Because `this.isFlameTelegraphing` was already `true`, it bypassed the `this.flameCooldownTimer <= 0` branch that emits `engine.eventBus.emit('boss_flame_telegraph', { bossId: this.id })`.
   - Fixing `this.isFlameTelegraphing = false;` in `transitionToPhase2()` ensures the cooldown expiration triggers the telegraph cycle and emits the event.
2. **Failure 2 (Line 179: `expect(boss.phase).toBe('DEATH_EXPLODING')` received `'PHASE_2_FLAME_SWEEP'`)**:
   - In `tests/unit/iron_nokana_boss.test.ts:175-178`:
     ```typescript
     const boss = new IronNokanaBoss('nokana_death', vec2(2050, 90));
     engine.addEntity(boss);
     boss.takeDamage(400);
     ```
   - Because `IronNokanaBoss` enforces phase clamping (as verified in Section 2 lines 40-75), taking 400 damage in Phase 1 clamps at 300 HP and transitions to `PHASE_2_FLAME_SWEEP`.
   - In Section 2 line 78-87, the test author properly stepped through the 4 phases:
     ```typescript
     boss.takeDamage(100); // To Phase 2
     boss.takeDamage(100); // To Phase 3
     boss.takeDamage(100); // To Phase 4
     boss.takeDamage(100); // To DEATH_EXPLODING
     ```
   - Section 5 line 178 took a shortcut by calling `boss.takeDamage(400)` once, which was caught by the Phase 1 clamp. Advancing through the phases (or initializing at Phase 4 via constructor config) immediately resolves the failure.

---

## 3. Caveats
- No code in `src/` or `tests/` has been modified during this investigation (Explorer read-only mode strictly respected).
- All proposed fixes were verified via independent headless execution using `npx tsx` and validated against Vitest's assertions.

---

## 4. Conclusion & Concrete Fix Recommendations for Worker

### 4.1 Fix 1: Export `createPlatform` in `src/core/physics/Platform.ts`
In `src/core/physics/Platform.ts`:
```typescript
import { AABB, createAABB } from './AABB';

export function createPlatform(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  type: PlatformType = 'SOLID'
): Platform {
  return {
    id,
    type,
    bounds: createAABB(x, y, width, height),
  };
}
```

### 4.2 Fix 2: Correct `transitionToPhase2` in `src/core/entities/boss/IronNokanaBoss.ts`
At line 596 of `src/core/entities/boss/IronNokanaBoss.ts`:
```typescript
<<<< BEFORE
  private transitionToPhase2(): void {
    this.phase = 'PHASE_2_FLAME_SWEEP';
    this.isFlameTelegraphing = true;
    this.flameTelegraphTimer = 0;
  }
==== AFTER
  private transitionToPhase2(): void {
    this.phase = 'PHASE_2_FLAME_SWEEP';
    this.isFlameTelegraphing = false;
    this.flameTelegraphTimer = 0;
  }
>>>>
```

### 4.3 Fix 3: Clean up Imports and Phase Transitions in `tests/unit/iron_nokana_boss.test.ts`
At line 178 of `tests/unit/iron_nokana_boss.test.ts`:
```typescript
<<<< BEFORE
      boss.takeDamage(400);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.isAlive).toBe(true);
==== AFTER
      boss.takeDamage(100); // To Phase 2 (300 HP)
      boss.takeDamage(100); // To Phase 3 (200 HP)
      boss.takeDamage(100); // To Phase 4 (100 HP)
      boss.takeDamage(100); // To Death (0 HP)
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.isAlive).toBe(true);
>>>>
```

### 4.4 Fix 4: Remediate Imports and Assertions in `tests/unit/boss_crisis_events.test.ts`
1. **Remove bogus imports**:
   ```typescript
<<<< BEFORE
import { InputManager } from '../../src/input/InputManager';
import { SoundEngine } from '../../src/audio/SoundEngine';
==== AFTER
// (Remove InputManager and SoundEngine imports)
>>>>
   ```
2. **Harmonize phase damage progression in test suites**:
   - **50% HP (Suite 1.2 & Suite 3)**:
     ```typescript
<<<< BEFORE
     boss.takeDamage(200);
==== AFTER
     boss.takeDamage(100);
     boss.takeDamage(100);
>>>>
     ```
   - **25% HP (Suite 1.3 & Suite 4)**:
     ```typescript
<<<< BEFORE
     boss.takeDamage(300);
==== AFTER
     boss.takeDamage(100);
     boss.takeDamage(100);
     boss.takeDamage(100);
>>>>
     ```
   - **Lethal burst (Suite 5)**:
     ```typescript
<<<< BEFORE
     boss.takeDamage(5000);
==== AFTER
     boss.takeDamage(100);
     boss.takeDamage(100);
     boss.takeDamage(100);
     boss.takeDamage(100);
>>>>
     ```
   - **Player hazard collision (Suite 6)**:
     ```typescript
<<<< BEFORE
      const input = new InputManager();
      const sound = new SoundEngine();
      const player = new PlayerController('player', { x: 1900, y: 200 }, input, sound);
      player.invulnerabilityTimer = 0;
      engine.addEntity(player);

      const initialHealth = player.health;
==== AFTER
      const player = new PlayerController(vec2(1900, 200));
      player.maxHealth = 10;
      player.health = 10;
      player.invulnerabilityTimer = 0;
      engine.addEntity(player);

      const initialHealth = player.health;
>>>>
     ```
   - **Tetsuyuki Phase 1 clamping (Suite 7)**:
     ```typescript
<<<< BEFORE
      tetsuyuki.takeDamage(100); // 300 HP = 75%
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);

      tetsuyuki.takeDamage(100); // 200 HP = 50%
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
==== AFTER
      tetsuyuki.takeDamage(100); // 300 HP = 75%
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE')).toBe(true);

      tetsuyuki.takeDamage(40);  // 260 HP = 65% (Tetsuyuki P1 clamp)
      tetsuyuki.takeDamage(60);  // 200 HP = 50% (triggers collapse)
      crisisManager.update(1 / 60);
      expect(crisisManager.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE')).toBe(true);
>>>>
     ```

---

## 5. Verification Method

To independently verify the resolution:
1. Run TypeScript check:
   ```bash
   npx tsc --noEmit
   ```
   **Expected**: Clean exit code 0 with 0 errors.
2. Run Vitest on the targeted suites:
   ```bash
   npx vitest run tests/unit/boss_crisis_events.test.ts tests/unit/iron_nokana_boss.test.ts
   ```
   **Expected**: 2 files passed, 20 tests passed (13 in iron_nokana_boss + 7 in boss_crisis_events), 0 failed.
3. Run full Vitest regression check:
   ```bash
   npm test
   ```
   **Expected**: 26 files passed, 314 tests passed, 0 failed.
4. Run project build:
   ```bash
   npm run build
   ```
   **Expected**: Clean `tsc -b && vite build` passing without errors.

**Invalidation Conditions**:
- If `tests/unit/boss_crisis_events.test.ts` still references `InputManager`.
- If `IronNokanaBoss.transitionToPhase2()` leaves `isFlameTelegraphing = true`.
- If `takeDamage` phase clamping in `IronNokanaBoss` is bypassed, which would break the 4-phase invariant tests in Section 2.
