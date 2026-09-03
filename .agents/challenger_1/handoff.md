# Adversarial Challenge Handoff Report — Kinematics, Combat & Collision

**Agent**: `challenger_1` (Empirical Challenger: Kinematics, Combat & Collision)  
**Date**: 2026-09-03  
**Target Suite**: `tests/unit/adversarial_challenge.test.ts`  
**Overall Verdict**: **PARTIALLY DISPROVED (Task 1 Boundary Defect at 38.0px; Tasks 2, 3, 4 CONFIRMED)**

---

## 1. Observation

### Task 1: Melee Boundary Conditions (37.9px, 38.0px, 38.1px, Vertical & Rear Limits)
- **Source Code Inspected**:
  - `src/core/player/PlayerKinematics.ts`:
    - Line 70: `static readonly MELEE_FORWARD_REACH: number = 38.0;`
    - Line 71: `static readonly MELEE_REAR_REACH: number = 6.0;`
    - Line 72: `static readonly MELEE_VERTICAL_UP: number = 34.0;`
    - Line 73: `static readonly MELEE_VERTICAL_DOWN: number = 10.0;`
    - Lines 261–276: `getMeleeScanBox(anchorX, anchorY, facing)` generates AABB:
      `minX = anchorX - 6`, `width = 44` (forward span: $[X - 6, X + 38]$)
      `minY = anchorY - 34`, `height = 44` (vertical span: $[Y - 34, Y + 10]$)
  - `src/core/physics/AABB.ts`:
    - Lines 63–70:
      ```typescript
      static intersects(a: AABB, b: AABB): boolean {
        return (
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        );
      }
      ```
  - `src/core/player/PlayerController.ts`:
    - Lines 272–281: `candidates = engine.spatialGrid.query(scanBox);` and `BoundingBox.intersects(scanBox, ent.bounds)`
- **Empirical Execution Observations**:
  - Test Target: `tests/unit/adversarial_challenge.test.ts > Task 1: Melee Boundary Conditions`
  - At distance `37.9px` ($X = 137.9$):
    - `isAttackingMelee: true`
    - `actionState: 'MELEE_SLASH'`
    - `projectilesCount: 0` (Knife triggered, projectile suppressed).
  - At distance `38.0px` ($X = 138.0$):
    - `isAttackingMelee: false`
    - `actionState: 'IDLE'`
    - `projectilesCount: 1` (Pistol fired, knife NOT triggered).
    - Verbatim test output log: `Empirical result at distance 38.0px: { isAttackingMelee: false, projectilesCount: 1, actionState: 'IDLE' }`.
  - At distance `38.1px` ($X = 138.1$):
    - `isAttackingMelee: false`
    - `actionState: 'IDLE'`
    - `projectilesCount: 1` (Pistol fired).
  - Vertical limits:
    - Target at bottom $Y = 166.1$ (33.9px above anchor $Y = 200$): Knife triggered (`isAttackingMelee: true`).
    - Target at bottom $Y = 165.9$ (34.1px above anchor): Knife rejected, pistol fired (`projectilesCount: 1`).
    - Target at top $Y = 209.9$ (9.9px below anchor): Knife triggered (`isAttackingMelee: true`).
    - Target at top $Y = 210.1$ (10.1px below anchor): Knife rejected, pistol fired (`projectilesCount: 1`).
  - Rear tolerance:
    - Target right edge at $X = 94.1$ (5.9px behind anchor $X = 100$): Knife triggered (`isAttackingMelee: true`).
    - Target right edge at $X = 93.9$ (6.1px behind anchor): Knife rejected, pistol fired (`projectilesCount: 1`).

---

### Task 2: Armored Target Melee Rejection (Mid-Boss & Boss)
- **Source Code Inspected**:
  - `src/core/entities/enemies/MidBossVehicle.ts`: Line 100 declares `public isMeleeVulnerable: boolean = false;`.
  - `src/core/entities/boss/TetsuyukiBoss.ts`: Line 210 declares `public isMeleeVulnerable: boolean = false;`.
  - `src/core/player/PlayerController.ts`: Lines 292–306:
    ```typescript
    const isEnemy =
      typeStr.startsWith('SOLDIER') ||
      typeStr.includes('ENEMY') ||
      typeStr.includes('BOSS') ||
      typeStr === 'MID_BOSS_VEHICLE' ||
      typeStr === 'TETSUYUKI_BOSS';

    if (isEnemy) {
      const isVulnerable = (candidate as any).isMeleeVulnerable !== false;
      if (isVulnerable) return candidate;
    }
    ```
- **Empirical Execution Observations**:
  - Point-blank shoot input against `MidBossVehicle` at $X = 105$ (player at $X = 100$):
    - `player.isAttackingMelee: false`
    - Spawned projectiles: Exactly 1 `PISTOL` projectile fired directly into vehicle.
  - Point-blank shoot input against `TetsuyukiBoss` at $X = 105$ (WITHOUT any monkey-patching):
    - `player.isAttackingMelee: false`
    - Spawned projectiles: Exactly 1 `PISTOL` projectile fired directly into boss fortress.

---

### Task 3: Rapid Weapon Switching & Ammo Starvation
- **Source Code Inspected**:
  - `src/core/weapons/WeaponManager.ts`: Lines 167–180 (ammo decrement and fallback), Lines 208–238 (`acquireWeapon`), Lines 78–108 (`tryFire`).
  - `src/core/weapons/WeaponTypes.ts`: Configs for `PISTOL`, `HEAVY_MACHINE_GUN` (15 shots/s, auto), and `FLAME_SHOT` (fireCooldownFrames: 18, auto).
- **Empirical Execution Observations**:
  - High-frequency input cycle across 760 frames ($12.67\text{ s}$ simulated at 60Hz):
    - 50 frames rapid Pistol -> acquired HMG (200 ammo) -> 50 frames rapid HMG -> acquired Flame Shot (30 ammo) -> 600 frames continuous auto-fire until 0 ammo -> 60 frames starved trigger attempts.
  - `negativeAmmoObserved`: `false` (Ammo clamped strictly $\ge 0$).
  - `droppedFrames`: `0` (Zero NaN coordinates, kinematics remained stable).
  - Auto-fallback to `PISTOL` occurred immediately upon Flame Shot ammo reaching `0`:
    - `activeWeapon`: `'PISTOL'`
    - `PISTOL ammo`: `Infinity`
    - `FLAME_SHOT ammo`: `0`
  - Memory leak verification: In-flight projectiles in engine after 760 frames totaled **4** (all others culled cleanly via lifetime or screen boundary eviction).

---

### Task 4: Spatial Hash Grid Saturation
- **Source Code Inspected**:
  - `src/core/physics/SpatialGrid.ts`: `cellSize = 64`, `Map<string, Set<T>> cells`, `itemCells`, `itemsById`.
- **Empirical Execution Observations**:
  - 500 active high-speed projectiles ($v_x \in [300, 500]\text{ px/s}$) + 100 moving entities ($v_x \in [-80, 80]\text{ px/s}$) injected into `SpatialGrid(64)`.
  - Grid item count: Exactly `600`.
  - Benchmark over 1,000 queries (44x44px box):
    - Total query time: **8.354 ms** (or ~24 ms under full test runner background load).
    - Average latency per query: **8.354 µs / query** (well below the 50 µs budget).
  - Kinematic simulation: 120 frames of continuous position integration and `grid.update()`. Zero freezing, zero corruption.
  - Pathological worst-case: 600 items crowded into the exact same cell (100, 100) returned all 600 items in 1 ms without infinite loops or hash collisions.
  - Eviction test: 300 projectiles removed via `grid.remove()`; grid count dropped to exactly 300; world query returned remaining 300 items with zero orphaned references.

---

## 2. Logic Chain

1. **Step 1 (Task 1 Melee Boundary Failure)**:
   - Observation 1 establishes that `PlayerKinematics.getMeleeScanBox(100, 200, 1)` has `minX = 94` and `width = 44`, meaning the maximum $X$ boundary is $94 + 44 = 138.0$.
   - Observation 1 also shows `AABB.intersects(a, b)` requires `a.x + a.width > b.x`.
   - When a stationary target is placed at distance $38.0\text{px}$ from player anchor $100$, target edge $b.x = 138.0$.
   - The expression evaluates $138.0 > 138.0$, which is `false`.
   - Therefore, at exactly $38.0\text{px}$, `intersects` returns `false`, causing `scanMeleeTarget()` to return `null`.
   - As observed empirically, the player fires a pistol bullet instead of triggering the knife slash at $38.0\text{px}$.
   - Conversely, at $37.9\text{px}$, $138.0 > 137.9$ is `true`, and knife triggers; at $38.1\text{px}$, $138.0 > 138.1$ is `false`, and pistol fires.
   - **Deduction**: The specification claim that distance $38.0\text{px}$ "must trigger knife" is DISPROVED under the current strict `<`/`>` AABB intersection implementation.

2. **Step 2 (Task 2 Armored Rejection Verified)**:
   - Both `MidBossVehicle` and `TetsuyukiBoss` have `isMeleeVulnerable: false` defined on their classes.
   - `PlayerController.scanMeleeTarget` explicitly checks `(candidate as any).isMeleeVulnerable !== false` for enemy types.
   - Empirical execution confirmed that point-blank shoot attempts bypass melee knife and spawn pistol projectiles.
   - **Deduction**: Armored target melee rejection is CONFIRMED.

3. **Step 3 (Task 3 Weapon Switching & Starvation Verified)**:
   - `WeaponManager.tryFire` decrements ammo, checks if `ammo <= 0`, and immediately invokes `fallbackToPistol(engine)` which resets active weapon to `'PISTOL'` and restores infinite ammo.
   - High-frequency stress test over 760 frames proved zero negative ammo, zero NaNs/dropped frames, and zero entity leaks.
   - **Deduction**: Rapid weapon switching and starvation handling are CONFIRMED.

4. **Step 4 (Task 4 Spatial Grid Saturation Verified)**:
   - `SpatialGrid` partitions entities into 64px hash buckets (`${cx}:${cy}`).
   - Proximity queries only traverse the small set of cells overlapping the query AABB ($O(1)$ cell lookup + $O(K)$ local candidate tests).
   - Under 600 moving entities, average query latency measured $8.354\text{ µs}$, and dynamic insertion/movement/eviction preserved mathematical consistency.
   - **Deduction**: Spatial hash grid saturation resilience and $O(1)/O(K)$ complexity are CONFIRMED.

---

## 3. Caveats

1. **Walking Enemy Dynamic Smearing**:
   - In live gameplay, infantry enemies (`SoldierEnemy`) walk forward toward the player (e.g. `walkSpeed = 40 px/s`).
   - If an enemy spawns at $38.0\text{px}$ or $38.1\text{px}$, during a single 60Hz tick it moves $\approx 0.67\text{px}$ closer, bringing it inside the knife scan box ($\approx 37.3\text{px}$ or $37.4\text{px}$) on the subsequent frame.
   - The adversarial boundary test intentionally used stationary targets (`velocity = 0`) to isolate the pure geometric kinematics boundary without velocity smearing.
2. **Boundary Touching Convention**:
   - Standard geometric AABBs in physics engines frequently treat touching boundaries as non-colliding (open/half-open intervals) to avoid penetration resolution artifacts between adjacent static tiles. If the project team intends for $38.0\text{px}$ to trigger melee, either:
     - `MELEE_FORWARD_REACH` should be set to `38.001` or `38.5px`, OR
     - `BoundingBox.intersects` should use non-strict comparisons (`>=` / `<=`) or a separate `intersectsInclusive` method for trigger zones.

---

## 4. Conclusion & Verdict

### Final Verdict: **PARTIALLY DISPROVED**
- **Task 1 (Melee Boundary Conditions)**: **DISPROVED / DEFECT REPORTED**.
  - 37.9px triggers knife: **PASS**.
  - 38.1px triggers pistol: **PASS**.
  - **38.0px triggers knife**: **FAIL / DISPROVED** (At exactly 38.0px, knife is rejected and pistol fires due to strict `>` in `BoundingBox.intersects`).
  - Vertical limits ($[-34, +10]\text{px}$) and rear tolerance ($6\text{px}$): **PASS**.
- **Task 2 (Armored Target Melee Rejection)**: **CONFIRMED (PASS)**.
- **Task 3 (Weapon Switching & Ammo Starvation)**: **CONFIRMED (PASS)**.
- **Task 4 (Spatial Hash Grid Saturation)**: **CONFIRMED (PASS)**.

### Recommended Implementation Mitigation (For Orchestrator / Implementation Workers)
To allow knife slash at exactly $38.0\text{px}$ distance without breaking platform/tile collision, update `PlayerKinematics.MELEE_FORWARD_REACH` in `src/core/player/PlayerKinematics.ts`:
```typescript
static readonly MELEE_FORWARD_REACH: number = 38.05; // px in front of anchor (ensures 38.0px boundary inclusive trigger)
```

---

## 5. Verification Method

Independent reproduction commands:

```bash
# Execute the adversarial challenge suite authored for this verification
npx vitest run tests/unit/adversarial_challenge.test.ts

# Execute specific Task 1 boundary test
npx vitest run tests/unit/adversarial_challenge.test.ts -t "Task 1: Melee Boundary Conditions"

# Execute specific Task 2 armored rejection test
npx vitest run tests/unit/adversarial_challenge.test.ts -t "Task 2: Armored Target Melee Rejection"

# Execute specific Task 3 weapon switching & ammo starvation test
npx vitest run tests/unit/adversarial_challenge.test.ts -t "Task 3: Rapid Weapon Switching & Ammo Starvation"

# Execute specific Task 4 spatial grid saturation test
npx vitest run tests/unit/adversarial_challenge.test.ts -t "Task 4: Spatial Hash Grid Saturation"
```

**Invalidation Conditions**:
- If `tests/unit/adversarial_challenge.test.ts` reports that distance 38.0px triggers a knife attack without modifying `MELEE_FORWARD_REACH` or `AABB.intersects`, this finding is invalidated.
