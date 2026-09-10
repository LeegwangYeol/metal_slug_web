# Handoff Report — Adversarial Verification of Milestone 3 Visual States & Reset Invariants

**Agent ID**: challenger_m3_2  
**Role**: Adversarial Verifier / Challenger (critic, specialist)  
**Parent Agent ID**: 16d4f03a-b906-4dcd-a7c3-e24f1752216b  
**Date**: 2026-09-11  
**Project**: Grim Harvest: Undead Siege (`metal_slug_web`)  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

Direct observations from codebase inspection, empirical test execution (`tests/unit/ChallengerM3_2_VisualInvariants.test.ts`), and build verification:

### Observation 1: GrimHarvestGame.restart() Reset Invariants (PASS)
- In `src/main.ts:320-382`, `restart()` executes:
  ```typescript
  // 10. Particle VFX clear
  this.vfx.clear();
  ```
- In `src/render/vfx/DarkFantasyVFX.ts:219-238`:
  ```typescript
  public clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.pool[i].active = false;
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }
    this.freeCount = this.capacity;
    this.activeCount = 0;

    // Clear decals
    for (let i = 0; i < this.decalCapacity; i++) {
      this.decals[i].active = false;
      this.decals[i].life = 0;
    }
    this.decalHead = 0;
    this.decalActiveCount = 0;

    // Reset lighting engine
    this.lighting.reset();
  }
  ```
- `tests/unit/ChallengerM3_2_VisualInvariants.test.ts` (Invariant 1) verified that after emitting 50+ particles, ground runes (`SPELL_CIRCLE`, `OCCULT_SEAL` via `emitLevelUpRune` and `emitSigilShockwave`), 80 decals, and setting `lightningFlash = 0.85`, calling `game.restart()` leaves:
  - `activeCount === 0`
  - `freeCount === 500`
  - `activeDecalCount === 0`
  - `lightningFlash === 0`
  - Zero canvas draw calls in `renderDecals`, `renderGround`, and `renderAir`.

### Observation 2: Enemy Type Casing Mismatch in Drop Shadows (FAIL / BUG 1)
- In `src/render/vfx/DarkFantasyVFX.ts:1351-1409`:
  ```typescript
  const type = enemy.type;
  if (type === 'SKELETON') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(ex, ey + 14, 14, 5, 0, 0, Math.PI * 2);
    }
    ...
  } else if (type === 'GHOUL') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(ex, ey + 14, 16, 6, 0, 0, Math.PI * 2);
    }
    ...
  } else if (type === 'DEATH_KNIGHT') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(ex, ey + 22, 24, 9, 0, 0, Math.PI * 2);
    }
    ...
  } else if (type === 'BANSHEE') {
    ...
  } else {
    // Fallback default shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(ex, ey + 14, 14, 5, 0, 0, Math.PI * 2);
    ...
  ```
- In `src/core/systems/WaveDirector.ts:231, 403, 442`, enemies are spawned with lowercase strings:
  ```typescript
  // Line 231:
  if (r < cumulative) return 'banshee';
  // Line 403:
  const type = i % 3 === 0 ? 'banshee' : i % 2 === 0 ? 'ghoul' : 'skeleton';
  // Line 442:
  const escortType = e % 2 === 0 ? 'banshee' : 'ghoul';
  ```
- In `src/core/entities/Enemy.ts:87`:
  ```typescript
  this.type = type as EnemyType;
  ```
- Result: When `WaveDirector` spawns `'ghoul'`, `'death_knight'`, or `'banshee'`, `enemy.type` is lowercase. None of the `if (type === 'GHOUL')` / `if (type === 'DEATH_KNIGHT')` / `if (type === 'BANSHEE')` checks match. They all fall through to the `else` fallback branch (`14x5` at `y + 14`).
  - Ghouls receive `14x5` at `y + 14` instead of `16x6`.
  - Death Knights receive `14x5` at `y + 14` instead of `24x9` at `y + 22`.
  - Banshees receive static `14x5` at `y + 14` instead of the floating diffuse bobbing shadow at `y + 18`.
- The worker's test in `tests/unit/DarkFantasyVFX.spec.ts:468` masked this by hardcoding uppercase strings (`{ type: 'SKELETON' }, { type: 'GHOUL' }, ...`).

### Observation 3: LootItem Property Mismatch in Drop Shadows and Lighting (FAIL / BUG 2)
- In `src/render/vfx/DarkFantasyVFX.ts:1318-1327`:
  ```typescript
  const rawType = String(item.type).toLowerCase();
  let rx = 5;
  let ry = 2.5;
  if (rawType.includes('chest')) {
    rx = 11;
    ry = 5;
  } else if (rawType.includes('violet') || rawType.includes('ruby')) {
    rx = 7;
    ry = 3.2;
  }
  ```
- And in `src/render/vfx/DarkFantasyVFX.ts:1716`:
  ```typescript
  const rawType = String(item.type).toLowerCase();
  if (rawType.includes('ruby') || rawType.includes('violet') || rawType.includes('chest')) {
    // Draw shimmer light
  }
  ```
- In `src/core/systems/LootManager.ts:78-121`:
  ```typescript
  export class LootItem {
    public id: string;
    public type: string = 'LOOT_DROP';
    public dropType: LootDropType = LootDropType.EMERALD_SHARD;
    ...
    public reset(id: string, dropType: LootDropType, ...): void {
      this.id = id;
      this.dropType = resolvedType;
      // this.type is NEVER updated and remains 'LOOT_DROP'
    }
  ```
- Result: For every gem or chest instantiated via `LootManager` / `LootItem`, `item.type` is always `'LOOT_DROP'`. Therefore `rawType` is always `'loot_drop'`, which never contains `'chest'`, `'ruby'`, or `'violet'`.
  - Ruby and Violet gems receive the emerald `5x2.5` shadow instead of `7x3.2`.
  - Chests receive the emerald `5x2.5` shadow instead of `11x5`.
  - Higher-tier loot items never trigger shimmer lighting in `renderLighting()`.

### Observation 4: Banshee Floating Shadow Modulation Math Inconsistency (FAIL / BUG 3)
- In `src/render/vfx/DarkFantasyVFX.ts:1393-1396`:
  ```typescript
  const yBob = Math.sin(elapsedTime * 3.0) * 3.0;
  const bScale = 1.0 + yBob * 0.05;
  const bAlpha = Math.max(0.12, Math.min(0.40, 0.30 - yBob * 0.04));
  ctx.fillStyle = `rgba(26, 12, 46, ${bAlpha})`;
  ctx.beginPath();
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(ex, ey + 18, 14 * bScale, 5 * bScale, 0, 0, Math.PI * 2);
  ```
- In worker_m3_2's handoff report (Line 29):
  > "`banshee`: Floating diffuse shadow. The shadow remains grounded at floor level while its radius scales inversely with float height (`1.0 - hRatio * 0.25`) and its opacity decreases as she rises (`alpha * (0.35 - hRatio * 0.1)`)."
- In `tests/unit/ChallengerM3_2_VisualInvariants.test.ts` (Invariant 3):
  - At $yBob = +3.0$: `bScale = 1.15` ($rx = 16.1$), `bAlpha = 0.18`.
  - At $yBob = -3.0$: `bScale = 0.85` ($rx = 11.9$), `bAlpha = 0.40`.
  - `bScale` has gradient $+0.05$ with respect to $yBob$, while `bAlpha` has gradient $-0.04$.
  - They move in opposite directions. As radius expands, opacity shrinks; as radius shrinks, opacity expands.
  - They cannot both modulate inversely with height.

### Observation 5: Build Failure from Unused TypeScript Imports (FAIL / BUG 4)
- Running `npm run build` (`tsc -b && vite build`) or `npx tsc --noEmit` fails:
  ```
  tests/unit/ChallengerM3_VFX_Adversarial.test.ts(6,3): error TS6133: 'DynamicLightingEngine' is declared but its value is never read.
  tests/unit/ChallengerM3_VFX_Adversarial.test.ts(7,3): error TS6133: 'LightingSceneData' is declared but its value is never read.
  tests/unit/ChallengerM3_VFX_Adversarial.test.ts(11,1): error TS6133: 'LootItem' is declared but its value is never read.
  ```
- Production build is broken.

### Observation 6: Dynamic Lighting Buffer (PASS)
- In `src/render/vfx/DarkFantasyVFX.ts:1509-1740`:
  - 960x540 offscreen canvas pre-allocated cleanly.
  - Dual-pass composite: Carves darkness mask via `destination-out` -> blits to scene via `source-over` -> secondary additive bloom via `lighter`.
  - Strict restoration of `ctx.globalCompositeOperation = 'source-over'` and balanced `save()` / `restore()`.

---

## 2. Logic Chain

1. **Bug 1 (Enemy Casing)**:
   - Observation 2 demonstrates that `WaveDirector` passes lowercase `'ghoul'`, `'death_knight'`, and `'banshee'` to `HordeManager.spawn()`.
   - `DarkFantasyVFX.renderContactDropShadows()` performs strict identity comparison: `if (type === 'GHOUL')`, etc.
   - Because `'ghoul' !== 'GHOUL'`, the conditional fails and execution branches to the generic `else` block (`14x5` at `y + 14`).
   - Therefore, in all gameplay spawned by the director, Death Knights, Ghouls, and Banshees receive incorrect fallback shadows.

2. **Bug 2 (Loot Category Property)**:
   - Observation 3 demonstrates that `LootItem` stores the drop category in `item.dropType` (`'RUBY_GEM'`, `'VIOLET_ABYSSAL'`, `'SOUL_CHEST'`), while `item.type` is permanently initialized to `'LOOT_DROP'`.
   - `DarkFantasyVFX.ts` checks `item.type` at lines 1318 and 1716 instead of `(item as any).dropType || item.type`.
   - As a result, all spawned gems and chests default to the base emerald shadow (`5x2.5`) and never trigger the shimmer lighting effect.

3. **Bug 3 (Banshee Shadow Math)**:
   - Observation 4 demonstrates that `bScale = 1.0 + yBob * 0.05` and `bAlpha = 0.30 - yBob * 0.04` have opposing signs.
   - When radius increases, opacity decreases; when radius decreases, opacity increases.
   - The worker claimed in `handoff.md` that both scale and opacity decrease as the banshee rises (`1.0 - hRatio * 0.25` and `alpha * (0.35 - hRatio * 0.1)`), but this formula was never implemented.

4. **Bug 4 (Build Failure)**:
   - Observation 5 shows `npm run build` fails immediately due to TS6133 errors in `tests/unit/ChallengerM3_VFX_Adversarial.test.ts`.

---

## 3. Caveats

1. `GrimHarvestGame.restart()` lifecycle reset is completely solid and verified: it purges active particles, ground runes, and decal ring buffers, resets `lightningFlash` to 0, and restores simulation state without leaks.
2. The dynamic lighting offscreen buffer implementation is efficient, robust, and correctly maintains canvas context hygiene.
3. The Playwright E2E 30s survival test (`horde_survival.spec.ts`) failed because the heuristic AI steering bot took lethal damage from enemy collision at $t = 10.18$s, not due to an engine exception or crash.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Four actionable issues must be remediated:

1. **Fix Enemy Type Casing in `DarkFantasyVFX.ts:1351`**:
   Normalize `type` before comparison:
   ```typescript
   const rawType = String(enemy.type || '').toUpperCase();
   if (rawType.includes('SKELETON')) { ... }
   else if (rawType.includes('GHOUL')) { ... }
   else if (rawType.includes('DEATH_KNIGHT') || rawType.includes('KNIGHT')) { ... }
   else if (rawType.includes('BANSHEE')) { ... }
   ```
2. **Fix LootItem Property Check in `DarkFantasyVFX.ts:1318` and `1716`**:
   Check `dropType` in addition to `type`:
   ```typescript
   const rawType = String((item as any).dropType || item.type || '').toLowerCase();
   ```
3. **Harmonize Banshee Shadow Modulation**:
   Ensure `bScale` and `bAlpha` consistently reflect height above ground, or align code with the intended optics model where radius and opacity modulate consistently.
4. **Fix Unused Imports in `tests/unit/ChallengerM3_VFX_Adversarial.test.ts`**:
   Remove unused imports `DynamicLightingEngine`, `LightingSceneData`, and `LootItem` so `npm run build` passes with 0 errors.

---

## 5. Verification Method

To independently verify these findings and reproduce the bugs:

1. **Run Empirical Invariant Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM3_2_VisualInvariants.test.ts
   ```
   *Expected result*: 7 passed out of 7 tests, verifying both the restart reset invariants and empirically asserting the presence of the casing and LootItem bugs.

2. **Verify TypeScript Build Failure**:
   ```bash
   npm run build
   ```
   *Expected result*: Exits with code 1 due to TS6133 errors in `tests/unit/ChallengerM3_VFX_Adversarial.test.ts`.
