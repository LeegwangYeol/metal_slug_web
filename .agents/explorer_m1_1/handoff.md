# Handoff Report — Explorer 1 (Milestone 1: Player Contact Damage & Hurtbox Calibration)

**Author**: Explorer 1 (`.agents/explorer_m1_1`)  
**Target Milestone**: Milestone 1 (Precision Damage Hitbox & Collision Subsystem)  
**Project**: Grim Harvest: Undead Siege (`/Users/user/teamwork_projects/metal_slug_web`)  
**Date**: 2026-09-11T02:20:00Z  

---

## 1. Observation

Direct code inspections, line numbers, and verbatim quotations from the codebase:

### 1.1 `src/main.ts` Contact Damage Loop (Lines 463–479)
```typescript
    // 6. Contact Damage & Blood VFX
    const scratch = new Int32Array(32);
    const nearbyCount = this.hordeManager.getEnemiesInRadius(
      this.player.position.x,
      this.player.position.y,
      Player.COLLISION_RADIUS + 15,
      scratch
    );

    for (let i = 0; i < nearbyCount; i++) {
      const enemy = this.hordeManager.pool[scratch[i]];
      if (enemy && enemy.active && enemy.isAlive) {
        this.player.takeDamage(enemy.damage);
        this.vfx.emitBloodBurst(this.player.position.x, this.player.position.y, 3);
        this.vfx.emitBloodSplatter(this.player.position.x, this.player.position.y, 4);
      }
    }
```
- Line 464: `const scratch = new Int32Array(32);` is allocated inside the `update()` loop every frame (60 allocations/sec, garbage collector pressure).
- Line 468: Passes `Player.COLLISION_RADIUS + 15` directly to `getEnemiesInRadius`.
- Lines 472–479: **Zero narrowphase collision check**. Every enemy returned by `getEnemiesInRadius` immediately calls `this.player.takeDamage(enemy.damage)` and emits blood VFX regardless of actual distance to the player.

### 1.2 `src/core/SpatialHashGrid.ts` Broadphase Search Distance (Lines 130–169)
```typescript
  public queryRadius(
    x: number,
    y: number,
    radius: number,
    outIds: Int32Array | number[]
  ): number {
    const searchRadius = radius + this.maxEntityRadius;
    const searchRadiusSq = searchRadius * searchRadius;
...
          if (dx * dx + dy * dy <= searchRadiusSq) {
            if (count < maxCapacity) {
              outIds[count++] = curr;
            } else {
              return count; // Buffer full
            }
          }
```
- `SpatialHashGrid` defaults `maxEntityRadius = config.maxEntityRadius ?? 32` (`SpatialHashGrid.ts:53`).
- In `HordeManager.ts:68–75`, `SpatialHashGrid` is instantiated without overriding `maxEntityRadius`, so `this.maxEntityRadius = 32`.
- When `queryRadius` is called with `radius = Player.COLLISION_RADIUS + 15` ($14.0 + 15 = 29.0$), `searchRadius` becomes $29.0 + 32 = 61.0\text{px}$!
- Any enemy within $61.0\text{px}$ Euclidean distance is returned in `scratch`. Combined with the lack of narrowphase in `main.ts`, the player currently takes damage when enemies are up to $61.0\text{px}$ away.

### 1.3 `src/core/entities/Player.ts` COLLISION_RADIUS Usages
- Line 43: `public static readonly COLLISION_RADIUS = 14.0;`
- Lines 63–68 (Constructor):
  ```typescript
  this.bounds = {
    x: startX - Player.COLLISION_RADIUS,
    y: startY - Player.COLLISION_RADIUS,
    width: Player.COLLISION_RADIUS * 2,
    height: Player.COLLISION_RADIUS * 2,
  };
  ```
- Lines 99–102 (`reset`):
  ```typescript
  this.bounds.x = startX - Player.COLLISION_RADIUS;
  this.bounds.y = startY - Player.COLLISION_RADIUS;
  this.bounds.width = Player.COLLISION_RADIUS * 2;
  this.bounds.height = Player.COLLISION_RADIUS * 2;
  ```
- Lines 206–216 (`update`, arena bounds clamping):
  ```typescript
  if (this.arenaBounds) {
    const r = Player.COLLISION_RADIUS;
    this.position.x = Math.max(
      this.arenaBounds.minX + r,
      Math.min(this.arenaBounds.maxX - r, this.position.x)
    );
    this.position.y = Math.max(
      this.arenaBounds.minY + r,
      Math.min(this.arenaBounds.maxY - r, this.position.y)
    );
  }
  ```
- Lines 218–219 (`update`, AABB position sync):
  ```typescript
  this.bounds.x = this.position.x - Player.COLLISION_RADIUS;
  this.bounds.y = this.position.y - Player.COLLISION_RADIUS;
  ```

### 1.4 `tests/unit/PlayerAndLoot.test.ts` (Lines 63–65)
```typescript
const r = Player.COLLISION_RADIUS;
expect(player.position.x).toBeLessThanOrEqual(1000 - r);
expect(player.position.y).toBeLessThanOrEqual(1000 - r);
```
- The test reads `Player.COLLISION_RADIUS` dynamically; reducing it from `14.0` to `11.0` will not break this test.

### 1.5 Sprite Dimensions in `src/render/sprites/DarkFantasySprites.ts`
- Player: Canvas size $64 \times 64$, center $(32, 32)$ (`DarkFantasySprites.ts:93–94`). Robe silhouette width extends from $x = -14$ to $+12$, and height from $y = -22$ to $+20$ (`DarkFantasySprites.ts:249–258`). The core body silhouette radius is $r \approx 11.0\text{px}$.
- Skeleton: Base radius in `EnemyTypes.ts` is `12` (calibrated: `11`). Cranium $r = 6$, ribcage $10 \times 7$.
- Ghoul: Base radius in `EnemyTypes.ts` is `14` (calibrated: `13`). Torso ellipse radius $12.0 \times 7.5$.
- Banshee: Base radius in `EnemyTypes.ts` is `16` (calibrated: `12`). Floating ghost torso.
- Death Knight: Base radius in `EnemyTypes.ts` is `22` (calibrated: `18`). Plate armor bulk.

### 1.6 Hardcoded Paddings in Weapons
- `src/core/weapons/BoneSpear.ts:252`: `getEnemiesInRadius(p.x, p.y, p.radius + 14, this.scratchIds)` uses `+ 14` padding.
- `src/core/weapons/SoulOrbiters.ts:200, 213`: `getEnemiesInRadius(px, py, this.orbitRadius + 28, ...)` followed by narrowphase `Math.abs(dist - this.orbitRadius) <= 26`.

---

## 2. Logic Chain

Step-by-step deduction from observations to conclusions:

1. **Premise 1 (Two-Phase Collision Architecture)**: Spatial partitioning systems like `SpatialHashGrid` are broadphase acceleration structures. By definition, `SpatialHashGrid.queryRadius(x, y, R)` must return any entity whose bounding circle could possibly intersect a query circle of radius $R$. Because entities have radii up to `maxEntityRadius = 32`, `queryRadius` returns all entities within Euclidean distance $R + 32$ (Observation 1.2).
2. **Premise 2 (Root Cause of Invisible Damage)**: In `src/main.ts:468–475`, the caller passes $R = \text{Player.COLLISION\_RADIUS} + 15 = 29$, causing `SpatialHashGrid` to return any entity within $29 + 32 = 61\text{px}$. Because `main.ts` lacks a narrowphase distance check, any enemy returned in this 61px sphere instantly damages the player (Observation 1.1).
3. **Premise 3 (Inadequacy of Simply Removing `+ 15`)**: If an engineer only removes `+ 15` and sets `Player.COLLISION_RADIUS = 11.0`, but omits the narrowphase check, `SpatialHashGrid.queryRadius` will still return all entities within $11.0 + 32 = 43.0\text{px}$. For a skeleton with $r = 11.0\text{px}$, true physical touch occurs at $d \le 11 + 11 = 22\text{px}$. An enemy at $d = 35\text{px}$ (13px of empty visual gap) would still deal damage.
4. **Deduction 4 (Required Two-Phase Implementation)**: Contact damage resolution in `src/main.ts` must execute both phases:
   - **Phase 1 (Broadphase)**: `getEnemiesInRadius(player.x, player.y, Player.COLLISION_RADIUS, scratch)` safely retrieves candidates in $O(1)$ grid buckets.
   - **Phase 2 (Narrowphase)**: For each candidate enemy, compute $\Delta x^2 + \Delta y^2 \le (r_{\text{player}} + r_{\text{enemy}})^2$. Only candidates satisfying this exact touch condition trigger `player.takeDamage()`.
5. **Deduction 5 (VFX Hygiene & I-Frames)**: Currently, `emitBloodBurst` and `emitBloodSplatter` fire unconditionally for every nearby enemy, even when `player.takeDamage` returns 0 due to the 0.5s invulnerability window (Observation 1.1). Guarding blood emissions with `if (dealt > 0)` eliminates confusing visual feedback during i-frames.
6. **Deduction 6 (Garbage Collection Optimization)**: Replacing `const scratch = new Int32Array(32);` (allocated 60 times/sec in `main.ts:464`) with a member variable `private readonly damageScratch = new Int32Array(64);` on `GrimHarvestGame` eliminates heap allocation during the 60Hz loop.

---

## 3. Caveats

1. **Boss / Crisis Units**: Currently, all enemies are spawned through `HordeManager` using `EnemyTypes.ts` archetypes (`skeleton`, `ghoul`, `banshee`, `death_knight`). There are currently no independent Boss entities with separate hurtboxes.
2. **Enemy Flocking**: `HordeManager.ts:340–355` computes enemy-to-enemy soft separation using $Q = p.\text{radius} + I.\text{radius}$. Calibrating enemy radii in `EnemyTypes.ts` (e.g., Skeleton 12 $\to$ 11, Banshee 16 $\to$ 12, Death Knight 22 $\to$ 18) will slightly tighten enemy swarm density, which is desirable and matches visual silhouettes.
3. **Weapon Radii**: `src/core/weapons/BoneSpear.ts:252` contains a `+ 14` padding when checking projectile hits. This is in weapon-to-enemy collision, not player hurtbox, but should also be calibrated in Milestone 1.

---

## 4. Conclusion & Concrete Recommendations

### 4.1 Target Changes

#### Change 1: `src/core/entities/Player.ts`
- Line 43: Update `COLLISION_RADIUS`:
```typescript
// BEFORE:
public static readonly COLLISION_RADIUS = 14.0;

// AFTER:
public static readonly COLLISION_RADIUS = 11.0;
```
*(All dependent bounds and arena boundary clamping in Player.ts automatically update to 11.0px).*

#### Change 2: `src/main.ts` Contact Damage & Zero-Garbage Scratch
- Add private member to `GrimHarvestGame`:
```typescript
private readonly damageScratch = new Int32Array(64);
```
- Replace lines 463–479 in `src/main.ts`:
```typescript
// BEFORE:
// 6. Contact Damage & Blood VFX
const scratch = new Int32Array(32);
const nearbyCount = this.hordeManager.getEnemiesInRadius(
  this.player.position.x,
  this.player.position.y,
  Player.COLLISION_RADIUS + 15,
  scratch
);

for (let i = 0; i < nearbyCount; i++) {
  const enemy = this.hordeManager.pool[scratch[i]];
  if (enemy && enemy.active && enemy.isAlive) {
    this.player.takeDamage(enemy.damage);
    this.vfx.emitBloodBurst(this.player.position.x, this.player.position.y, 3);
    this.vfx.emitBloodSplatter(this.player.position.x, this.player.position.y, 4);
  }
}

// AFTER:
// 6. Contact Damage & Blood VFX (Two-Phase: Broadphase Grid Query + Narrowphase Exact Circle Overlap)
const px = this.player.position.x;
const py = this.player.position.y;
const pr = Player.COLLISION_RADIUS;
const nearbyCount = this.hordeManager.getEnemiesInRadius(
  px,
  py,
  pr,
  this.damageScratch
);

for (let i = 0; i < nearbyCount; i++) {
  const enemy = this.hordeManager.pool[this.damageScratch[i]];
  if (enemy && enemy.active && enemy.isAlive) {
    const dx = enemy.x - px;
    const dy = enemy.y - py;
    const touchDist = pr + enemy.radius;
    if (dx * dx + dy * dy <= touchDist * touchDist) {
      const dealt = this.player.takeDamage(enemy.damage);
      if (dealt > 0) {
        this.vfx.emitBloodBurst(px, py, 3);
        this.vfx.emitBloodSplatter(px, py, 4);
      }
    }
  }
}
```

#### Change 3: `src/core/entities/EnemyTypes.ts` Calibration
- Update `ENEMY_BASE_STATS` in lines 29–66 to match rendered silhouettes:
```typescript
// Skeleton: radius 11 (was 12)
// Ghoul: radius 13 (was 14)
// Banshee: radius 12 (was 16)
// Death Knight: radius 18 (was 22)
```

---

## 5. Verification Method

How to independently verify these conclusions and future implementations:

1. **Automated Unit Tests**:
   - Run `npm test` to ensure existing 376 tests pass.
   - Run `npx vitest run tests/unit/PlayerAndLoot.test.ts`.
2. **New Hitbox Precision Unit Suite (`tests/unit/hitbox_precision.spec.ts`)**:
   Implement unit test with exact coordinate asserts:
   - Player at $(0, 0)$, $r = 11.0$.
   - Skeleton at $(23, 0)$, $r = 11.0$ (Separation = $1\text{px}$, distance = $23 > 22$): Assert `takeDamage` is NOT called; player HP remains 100.
   - Skeleton at $(22, 0)$, $r = 11.0$ (Exact touch, distance = $22 = 22$): Assert `takeDamage` is called; player HP drops from 100 to 90.
   - Phantom padding test: Enemy placed at distance $d = 26\text{px}$ (within old 61px phantom radius): Assert 0 damage.
3. **Headless E2E Dodge Test**:
   - `npx playwright test tests/e2e/hitbox_dodge.spec.ts` (in Milestone 3).
4. **Invalidation Conditions**:
   - If player takes damage when distance $d > r_p + r_e$, the narrowphase check failed.
   - If player passes through enemies without taking damage when $d \le r_p + r_e$, the broadphase query radius was too small or narrowphase comparison inverted.
