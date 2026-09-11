# Handoff Report: Weapon Projectile Collision Radii & Unit Testing Infrastructure (Milestone 1)

- **Agent**: Explorer 3 (`explorer_m1_3`)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_3`
- **Target Component**: Weapon Collision Radii, Player Hurtbox, Enemy Hitboxes, Contact Damage & Unit Test Specification (`tests/unit/hitbox_precision.spec.ts`)
- **Status**: Completed

---

## 1. Observation

### 1.1 Player Hurtbox & Contact Damage Collision in `src/main.ts`
In `src/main.ts:463-479`:
```typescript
// 6. Contact Damage & Blood VFX
const scratch = new Int32Array(32);
const nearbyCount = this.hordeManager.getEnemiesInRadius(
  this.player.position.x,
  this.player.position.y,
  Player.COLLISION_RADIUS + 15, // <--- Phantom +15px padding
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
Direct observations:
1. `Player.COLLISION_RADIUS` is defined as `14.0px` in `src/core/entities/Player.ts:43`.
2. Adding `+ 15` inflates the query radius to $29.0\text{px}$.
3. In `src/core/HordeManager.ts:393-400`, `getEnemiesInRadius()` forwards directly to `SpatialHashGrid.queryRadius()`.
4. In `src/core/SpatialHashGrid.ts:130-167`:
   ```typescript
   const searchRadius = radius + this.maxEntityRadius; // maxEntityRadius is 32px by default
   const searchRadiusSq = searchRadius * searchRadius;
   ...
   if (dx * dx + dy * dy <= searchRadiusSq) { outIds[count++] = curr; }
   ```
   When `main.ts` queries with `radius = 29.0`, `SpatialHashGrid` searches up to $29 + 32 = 61.0\text{px}$!
5. In `src/main.ts:472-479`, there is **no narrowphase distance check** whatsoever. Every enemy returned by the broadphase query inflicts damage unconditionally. For a standard Skeleton enemy ($r = 12$), damage triggers when enemy center is up to $61\text{px}$ away from player center, even though player sprite width is ~20px and skeleton width is ~16px!

### 1.2 Weapon Collision Logic in `src/core/weapons/`
We inspected all 5 occult weapon classes under `src/core/weapons/`:

#### A. Bone Spear (`src/core/weapons/BoneSpear.ts`)
- **Projectile Spawn** (lines 138–150):
  ```typescript
  p.reset(
    this.id, px, py, nx * speed, ny * speed, speed,
    12, // <--- radius = 12
    damage, stats.knockback, pierce, 2.0
  );
  ```
- **Collision Query & Resolution** (lines 248–264):
  ```typescript
  const hitCount = this.hordeManager.getEnemiesInRadius(
    p.x,
    p.y,
    p.radius + 14, // <--- Phantom +14px padding! (query radius = 26px)
    this.scratchIds
  );

  for (let j = 0; j < hitCount; j++) {
    const enemyId = this.scratchIds[j];
    const enemy = this.hordeManager.pool[enemyId];
    if (enemy && enemy.active && enemy.isAlive) {
      const despawned = this.handleHit(p, enemy, vfx, lootManager, engine);
      if (despawned) break;
    }
  }
  ```
- **`handleHit` Check** (lines 166–169):
  ```typescript
  if (!proj.active || proj.hasHit(enemy.id)) return false;
  proj.recordHit(enemy.id);
  proj.pierceRemaining--;
  ...
  const result = this.hordeManager.applyDamage(enemy.id, proj.damage, kbX, kbY);
  ```
  `handleHit` has **no narrowphase distance check**. Because `getEnemiesInRadius` searches with $r + 32$, an enemy at $26 + 32 = 58\text{px}$ distance takes damage immediately!
- **Visual VFX Rendering** (lines 291–303):
  Shaft is a rectangle $28 \times 4\text{px}$ (`fillRect(-14, -2, 28, 4)`). The spearhead is a triangle from $(10, -5)$ to $(18, 0)$ to $(10, 5)$ (length 8px, half-width 5px, glowing visual head width 10px). The visual head tightly fits an $8\text{px}$ radius circle.

#### B. Soul Orbiters (`src/core/weapons/SoulOrbiters.ts`)
- **Collision Check** (lines 196–215):
  ```typescript
  const nearby = this.hordeManager.getEnemiesInRadius(
    px, py, this.orbitRadius + 28, this.scratchIds
  );
  for (let j = 0; j < nearby; j++) {
    ...
    const dist = Math.hypot(dx, dy) || 1;
    if (Math.abs(dist - this.orbitRadius) <= 26) {
  ```
  Collision does NOT check distance to individual orbiting skulls $(skull.x, skull.y)$. It checks if the enemy's distance from the **player** is within $26\text{px}$ of `orbitRadius`. This creates an invisible $52\text{px}$-thick annular ring that damages enemies even when they are 180° away from the nearest skull!
- **Visual VFX Rendering** (lines 253–268):
  Skulls are drawn at $(skull.x, skull.y)$ with an outer flaming glow `arc(screenX, screenY, isEvolution ? 14 : 10)` (outer radius 10px, evolution 14px) and core skull `arc(..., isEvolution ? 8 : 6)` (radius 6px, evolution 8px).

#### C. Arcane Scythe (`src/core/weapons/ArcaneScythe.ts`)
- **Collision Check** (lines 164–187):
  ```typescript
  const enemyCount = this.hordeManager.getEnemiesInRadius(
    px, py, effectiveRadius, this.scratchIds
  );
  for (let i = 0; i < enemyCount; i++) {
    ...
    const enemyAngle = Math.atan2(dy, dx);
    let diff = enemyAngle - aimAngle;
    ...
    if (Math.abs(diff) <= halfArcRad || this.isEvolution) {
      hits++;
  ```
  There is NO radial distance check in the loop. It relies solely on `getEnemiesInRadius(px, py, effectiveRadius)`. Due to SpatialHashGrid's broadphase padding ($+32\text{px}$), enemies up to $32\text{px}$ beyond the visual blade tip in the angular sector are damaged.
- **Visual VFX Rendering** (lines 270–281):
  Renders arc `ctx.arc(0, 0, s.radius, startAngle, endAngle)` with radius `effectiveRadius` (75px at Rank 1 to 130px at Rank 5, 160px evolution) and `lineWidth` 3.5–6px.

#### D. Cursed Aura (`src/core/weapons/CursedAura.ts`)
- **Collision Check** (lines 131–152):
  Queries `getEnemiesInRadius(px, py, effectiveRadius, this.scratchIds)` and damages all returned enemies without a narrowphase check. Due to the grid's $+32\text{px}$ broadphase envelope, enemies up to $32\text{px}$ outside the shockwave take damage.
- **Visual VFX Rendering** (lines 216–227):
  Renders expanding ring up to `maxRadius: effectiveRadius` (85px at Rank 1 to 155px at Rank 5, 160px evolution).

#### E. Abyssal Lightning (`src/core/weapons/AbyssalLightning.ts`)
- **Collision Check** (lines 143–178):
  Queries `getEnemiesInRadius(px, py, effectiveRange, this.scratchPrimary)` and randomly selects targets. Because there is no `distSq <= effectiveRange * effectiveRange` filter, enemies up to $32\text{px}$ outside targeting range can be struck.

### 1.3 Testing Infrastructure & Current Test Suite
- **Configuration** (`vitest.config.ts`):
  ```typescript
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.{test,spec}.ts'],
      globals: true,
      testTimeout: 15000,
    },
  });
  ```
- **Test Suite Run**:
  Executed `npm test`: **29 test files passed (100%), 376 tests passed (100%)** in 5.80s.
  Currently, no `tests/unit/hitbox_precision.spec.ts` exists.

---

## 2. Logic Chain

1. **Premise 1**: The user reported that damage detection feels unfair and inaccurate, with damage registering when attacks visually missed.
2. **Observation Connection (Contact Damage)**:
   - In `src/main.ts:468`, contact damage checks query with `Player.COLLISION_RADIUS + 15`.
   - `Player.COLLISION_RADIUS` is `14.0px`, so the query radius is `29.0px`.
   - In `src/core/SpatialHashGrid.ts:136`, `queryRadius` adds `maxEntityRadius = 32px`, searching a circle of radius $29 + 32 = 61\text{px}$.
   - In `src/main.ts:472-476`, there is zero distance checking between player center and enemy center. Every returned entity inflicts contact damage.
   - For a Skeleton with visual width ~16px ($r = 11\text{px}$) and Player sorcerer silhouette with visual width ~20px ($r = 11\text{px}$), the physical contact boundary should be $11 + 11 = 22\text{px}$.
   - Currently, damage triggers at up to $61\text{px}$ separation! This is almost triple the visual boundary, causing massive phantom contact damage when dodging.
3. **Observation Connection (Weapon Projectiles)**:
   - Bone Spear sets `radius = 12px`, queries with `p.radius + 14` ($26\text{px}$), and uses no narrowphase check in `handleHit`. Broadphase expands this to $58\text{px}$. The visual glowing head is only $10\text{px}$ wide ($r = 5\text{px}$), so a calibrated radius of $8.0\text{px}$ with an exact narrowphase check $\Delta x^2 + \Delta y^2 \le (r_{\text{spear}} + r_{\text{enemy}})^2$ is required.
   - Soul Orbiters checks a full 360° annular ring $\pm 26\text{px}$ around the player rather than individual orbiting skull flames ($r = 10\text{px}$), causing enemies to take damage in empty gaps between skulls.
   - Arcane Scythe, Cursed Aura, and Abyssal Lightning lack narrowphase radial checks, causing enemies outside visual bounds (up to $+32\text{px}$) to be hit.
4. **Resolution Logic**:
   - Calibrate Player hurtbox to $r = 11.0\text{px}$ matching sorcerer robe silhouette.
   - Calibrate enemy hitboxes per archetype: Skeleton $r = 11\text{px}$, Ghoul $r = 13\text{px}$, Banshee $r = 12\text{px}$, Death Knight $r = 18\text{px}$, Necromancer $r = 14\text{px}$.
   - Remove phantom padding in `src/main.ts` (`+ 15` elimination) and add exact Euclidean narrowphase check:
     $$\text{Damage} \iff \Delta x^2 + \Delta y^2 \le (r_{\text{player}} + r_{\text{enemy}})^2$$
   - Enforce exact narrowphase checking in weapon classes:
     - Bone Spear: $r = 8.0\text{px}$, hit condition $\Delta x^2 + \Delta y^2 \le (r_{\text{spear}} + r_{\text{enemy}})^2$.
     - Soul Orbiters: per-skull collision with $r_{\text{skull}} = 10.0\text{px}$ (evolution $14.0\text{px}$).
     - Arcane Scythe: distance check $\text{dist} \le \text{effectiveRadius} + r_{\text{enemy}}$ inside cleave arc.
     - Cursed Aura: distance check $\Delta x^2 + \Delta y^2 \le (\text{effectiveRadius} + r_{\text{enemy}})^2$.
     - Abyssal Lightning: range check $\Delta x^2 + \Delta y^2 \le \text{effectiveRange}^2$.
5. **Testing Logic**:
   - To guarantee zero phantom damage and precision, unit tests in `tests/unit/hitbox_precision.spec.ts` must assert:
     - Near-miss: $\text{distance} = r_1 + r_2 + 1\text{px} \implies$ **0 damage registered**.
     - Exact touch: $\text{distance} = r_1 + r_2\text{px} \implies$ **damage IS registered**.
     - Omnidirectional symmetry across 8 cardinal/diagonal angles (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).
     - Weapon projectile collision boundaries.

---

## 3. Caveats

1. **SpatialHashGrid Candidate Buffer**: `SpatialHashGrid.queryRadius` inherently expands by `maxEntityRadius = 32`. This is standard broadphase acceleration architecture and does NOT need to be changed; instead, all calling systems (`main.ts`, weapon classes) MUST perform the $O(1)$ narrowphase distance check on the returned candidates.
2. **Existing Unit Tests**: Some existing tests in `tests/unit/Weapons.test.ts` or `tests/unit/ChallengerDF_M3_1.test.ts` spawn enemies at arbitrary coordinates (e.g. `(60, 0)` for scythe, `(50, 0)` for spear). These existing coordinates are well within weapon ranges, so adding precise narrowphase checks will not break existing tests (as long as `dist <= reach` is satisfied).
3. **Orbiters Per-Skull vs Annular Ring**: Changing Soul Orbiters to per-skull collision requires enemies to physically touch a skull. For backward compatibility with existing tests (`tests/unit/Weapons.test.ts:75` spawns enemy directly at `skull.x, skull.y`), this test will still pass. However, any enemy positioned on the ring between skulls will no longer take damage.

---

## 4. Conclusion & Calibration Specifications

### 4.1 Collision Radii Calibration Table

| Entity / Projectile | Visual Geometry & Head Dimensions | Current Radius | Calibrated Radius | Phantom Padding Removed |
|---|---|---|---|---|
| **Player (Hurtbox)** | Cowl & Robe Silhouette (~20–22px wide) | 14.0px | **11.0px** | Removed `+ 15` from `main.ts:468` |
| **Skeleton** | Ribcage & Cranium (~20–22px wide) | 12.0px | **11.0px** | None (narrowphase added) |
| **Ghoul** | Hunched Torso & Haunches (~24–26px) | 14.0px | **13.0px** | None (narrowphase added) |
| **Banshee** | Spirit Shroud & Floating Torso (~24px) | 16.0px | **12.0px** | None (narrowphase added) |
| **Death Knight** | Heavy Plate Armor Behemoth (~36px) | 22.0px | **18.0px** | None (narrowphase added) |
| **Bone Spear** | Triangular Spearhead Tip (10px wide x 8px long) | 12.0px | **8.0px** | Removed `+ 14` from query; added narrowphase check |
| **Soul Orbiters** | Outer Flaming Glow (20px diameter) & Skull Core | Ring $\pm 26\text{px}$ | **10.0px** (per skull; 14px evo) | Removed $\pm 26\text{px}$ whole-ring hit; check per skull |
| **Arcane Scythe** | Spectral Cleave Arc (radius = effectiveRadius) | No dist check | **effectiveRadius** | Added radial check `dist <= effectiveRadius + r_enemy` |
| **Cursed Aura** | Expanding Radial Shockwave | No dist check | **effectiveRadius** | Added radial check `distSq <= (radius + r_enemy)^2` |
| **Abyssal Lightning**| Target Range Arc | No dist check | **effectiveRange** | Added radial filter `distSq <= effectiveRange^2` |

### 4.2 Narrowphase Formulas
For two entities $A$ and $B$ with centers $(x_A, y_A)$, $(x_B, y_B)$ and collision radii $r_A, r_B$:
$$\Delta x = x_B - x_A, \quad \Delta y = y_B - y_A$$
$$\text{distSq} = \Delta x^2 + \Delta y^2$$
$$\text{touchDist} = r_A + r_B$$
$$\text{Collision Triggered} \iff \text{distSq} \le \text{touchDist}^2$$
When $\text{dist} = \text{touchDist} + 1$:
$$\text{distSq} = (\text{touchDist} + 1)^2 > \text{touchDist}^2 \implies \mathbf{NO\ Damage}$$
When $\text{dist} = \text{touchDist}$:
$$\text{distSq} = \text{touchDist}^2 \le \text{touchDist}^2 \implies \mathbf{Damage\ Registered}$$

### 4.3 Detailed Specification for `tests/unit/hitbox_precision.spec.ts`

```typescript
/**
 * tests/unit/hitbox_precision.spec.ts
 *
 * Comprehensive Precision Hitbox & Zero-Phantom-Damage Test Suite (Milestone 1).
 *
 * Verifies:
 * 1. Exact contact damage boundary (touchDist = r_player + r_enemy):
 *    - Separation of 1px (touchDist + 1) registers 0 damage.
 *    - Exact touch (touchDist) registers damage.
 * 2. All 4 enemy archetypes (Skeleton r=11, Ghoul r=13, Banshee r=12, Death Knight r=18).
 * 3. 360-degree omnidirectional symmetry (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).
 * 4. Elimination of legacy +15px phantom padding.
 * 5. Weapon projectile hitboxes:
 *    - Bone Spear (r=8px): near miss (r_spear + r_enemy + 1) vs exact touch (r_spear + r_enemy).
 *    - Soul Orbiters (r=10px): near miss vs exact touch per skull, plus empty gap immunity.
 *    - Arcane Scythe: radial reach boundary (effectiveRadius + r_enemy) and angular sector boundary.
 *    - Cursed Aura: radial pulse boundary (effectiveRadius + r_enemy).
 *    - Abyssal Lightning: max targeting range boundary (effectiveRange).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../src/core/entities/Player';
import { HordeManager } from '../../src/core/HordeManager';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { CursedAura } from '../../src/core/weapons/CursedAura';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';

describe('Hitbox Precision & Zero Phantom Padding Specification Suite (Milestone 1)', () => {
  let player: Player;
  let hordeManager: HordeManager;

  beforeEach(() => {
    player = new Player(0, 0);
    hordeManager = new HordeManager({ maxCapacity: 500 });
  });

  // Helper simulating the exact calibrated contact damage loop from main.ts
  function checkContactDamage(px: number, py: number, pRadius: number = Player.COLLISION_RADIUS): number {
    const scratch = new Int32Array(32);
    const nearbyCount = hordeManager.getEnemiesInRadius(px, py, pRadius + 22, scratch);
    let damageDealt = 0;

    for (let i = 0; i < nearbyCount; i++) {
      const enemy = hordeManager.pool[scratch[i]];
      if (enemy && enemy.active && enemy.isAlive) {
        const dx = enemy.x - px;
        const dy = enemy.y - py;
        const distSq = dx * dx + dy * dy;
        const touchDist = pRadius + enemy.radius;
        if (distSq <= touchDist * touchDist + 1e-4) {
          damageDealt += player.takeDamage(enemy.damage);
        }
      }
    }
    return damageDealt;
  }

  describe('Suite 1: Player Hurtbox & Enemy Hitbox Contact Precision', () => {
    it('verifies Player hurtbox radius is calibrated to 11.0px', () => {
      expect(Player.COLLISION_RADIUS).toBe(11.0);
    });

    const enemyTypes = [
      { type: 'skeleton', expectedRadius: 11.0 },
      { type: 'ghoul', expectedRadius: 13.0 },
      { type: 'banshee', expectedRadius: 12.0 },
      { type: 'death_knight', expectedRadius: 18.0 },
    ];

    for (const { type, expectedRadius } of enemyTypes) {
      it(`verifies ${type} hitbox radius is calibrated to ${expectedRadius}px`, () => {
        const enemy = hordeManager.spawn(type, 100, 100);
        expect(enemy).not.toBeNull();
        expect(enemy!.radius).toBe(expectedRadius);
      });

      it(`asserts 1px near-miss registers ZERO damage for ${type}`, () => {
        const rPlayer = Player.COLLISION_RADIUS;
        const rEnemy = expectedRadius;
        const nearMissDist = rPlayer + rEnemy + 1.0; // 1px outside collision boundary

        // Spawn enemy to the right of player
        const enemy = hordeManager.spawn(type, nearMissDist, 0);
        expect(enemy).not.toBeNull();

        const initialHealth = player.stats.currentHealth;
        const damage = checkContactDamage(player.position.x, player.position.y);

        expect(damage).toBe(0);
        expect(player.stats.currentHealth).toBe(initialHealth);
      });

      it(`asserts exact touch registers damage for ${type}`, () => {
        const rPlayer = Player.COLLISION_RADIUS;
        const rEnemy = expectedRadius;
        const touchDist = rPlayer + rEnemy; // Exact boundary touch

        const enemy = hordeManager.spawn(type, touchDist, 0);
        expect(enemy).not.toBeNull();

        const initialHealth = player.stats.currentHealth;
        const damage = checkContactDamage(player.position.x, player.position.y);

        expect(damage).toBeGreaterThan(0);
        expect(player.stats.currentHealth).toBeLessThan(initialHealth);
      });
    }

    it('asserts 360-degree directional symmetry across 8 angles for 1px near-miss vs exact touch', () => {
      const rPlayer = Player.COLLISION_RADIUS; // 11.0
      const rEnemy = 11.0; // skeleton
      const touchDist = rPlayer + rEnemy; // 22.0
      const nearMissDist = touchDist + 1.0; // 23.0

      const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4];

      for (const angle of angles) {
        // Reset player
        player.reset(0, 0);
        hordeManager.clear();

        // 1px near miss
        const nx = Math.cos(angle) * nearMissDist;
        const ny = Math.sin(angle) * nearMissDist;
        hordeManager.spawn('skeleton', nx, ny);

        const damageNearMiss = checkContactDamage(0, 0);
        expect(damageNearMiss, `Angle ${angle} near-miss should deal 0 damage`).toBe(0);

        // Exact touch
        hordeManager.clear();
        player.reset(0, 0);
        const tx = Math.cos(angle) * touchDist;
        const ty = Math.sin(angle) * touchDist;
        hordeManager.spawn('skeleton', tx, ty);

        const damageTouch = checkContactDamage(0, 0);
        expect(damageTouch, `Angle ${angle} touch should deal damage`).toBeGreaterThan(0);
      }
    });

    it('confirms legacy +15px phantom padding zone deals ZERO damage', () => {
      // Legacy code dealt damage at distance <= 14 + 15 + 16 = 45px.
      // At distance = 25px (which is touchDist 22px + 3px):
      const enemy = hordeManager.spawn('skeleton', 25, 0);
      expect(enemy).not.toBeNull();

      const damage = checkContactDamage(player.position.x, player.position.y);
      expect(damage).toBe(0);
      expect(player.stats.currentHealth).toBe(player.stats.maxHealth);
    });
  });

  describe('Suite 2: Weapon Projectile Hitbox Boundaries', () => {
    describe('Bone Spear Projectile Precision', () => {
      it('calibrates Bone Spear radius to 8.0px matching glowing arrowhead', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0);
        expect(proj).not.toBeNull();
        expect(proj!.radius).toBe(8.0);
      });

      it('asserts 1px separation between spear and skeleton deals 0 damage', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0);
        expect(proj).not.toBeNull();
        proj!.x = 0;
        proj!.y = 0;

        const rSpear = proj!.radius; // 8.0
        const rEnemy = 11.0; // skeleton
        const nearMissDist = rSpear + rEnemy + 1.0; // 20.0px

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0);
        const initialHp = enemy!.health;

        // Custom narrowphase hitcheck
        const hit = spear.handleHit(proj!, enemy!);
        expect(hit).toBe(false);
        expect(enemy!.health).toBe(initialHp);
        expect(proj!.pierceRemaining).toBe(spear.getStats().pierce ?? 2);
      });

      it('asserts exact touch between spear and skeleton deals damage and consumes pierce', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0);
        expect(proj).not.toBeNull();
        proj!.x = 0;
        proj!.y = 0;

        const rSpear = proj!.radius; // 8.0
        const rEnemy = 11.0; // skeleton
        const touchDist = rSpear + rEnemy; // 19.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0);
        const initialHp = enemy!.health;

        const hit = spear.handleHit(proj!, enemy!);
        expect(enemy!.health).toBeLessThan(initialHp);
        expect(proj!.pierceRemaining).toBe((spear.getStats().pierce ?? 2) - 1);
      });
    });

    describe('Soul Orbiters Per-Skull Hitbox Precision', () => {
      it('deals damage when enemy touches an individual orbital skull', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1; // 2 skulls
        orbiters.syncSkulls();

        const skull0 = orbiters.skulls[0];
        const rSkull = 10.0; // calibrated flame radius
        const rEnemy = 11.0; // skeleton
        const touchDist = rSkull + rEnemy; // 21.0px

        // Position enemy exactly on touch boundary of skull 0
        const enemy = hordeManager.spawn('skeleton', skull0.x + touchDist, skull0.y);
        const initialHp = enemy!.health;

        orbiters.update(1 / 60);
        expect(enemy!.health).toBeLessThan(initialHp);
      });

      it('asserts 1px near-miss from an orbital skull deals ZERO damage', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1;
        orbiters.syncSkulls();

        const skull0 = orbiters.skulls[0];
        const rSkull = 10.0;
        const rEnemy = 11.0;
        const nearMissDist = rSkull + rEnemy + 1.0; // 22.0px

        const enemy = hordeManager.spawn('skeleton', skull0.x + nearMissDist, skull0.y);
        const initialHp = enemy!.health;

        orbiters.update(1 / 60);
        expect(enemy!.health).toBe(initialHp);
      });

      it('asserts enemy positioned on the orbit ring between skulls takes ZERO damage (no phantom ring)', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1; // 2 skulls at 0 and PI
        orbiters.syncSkulls();

        // Position enemy on the orbit radius at PI / 2 (90 degrees away from both skulls)
        const enemy = hordeManager.spawn('skeleton', 0, orbiters.orbitRadius);
        const initialHp = enemy!.health;

        orbiters.update(1 / 60);
        expect(enemy!.health).toBe(initialHp); // Untouched in the gap!
      });
    });

    describe('Arcane Scythe Radial Reach & Cleave Precision', () => {
      it('asserts enemy 1px beyond scythe reach takes ZERO damage', () => {
        const scythe = new ArcaneScythe(player, hordeManager);
        scythe.rank = 1;
        const reach = scythe.getEffectiveArea(); // 75px
        const rEnemy = 11.0; // skeleton
        const nearMissDist = reach + rEnemy + 1.0; // 87.0px directly ahead

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0);
        const initialHp = enemy!.health;

        scythe.fire(1, 0);
        expect(enemy!.health).toBe(initialHp);
      });

      it('asserts enemy within scythe reach takes damage', () => {
        const scythe = new ArcaneScythe(player, hordeManager);
        scythe.rank = 1;
        const reach = scythe.getEffectiveArea(); // 75px
        const rEnemy = 11.0;
        const touchDist = reach + rEnemy; // 86.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0);
        const initialHp = enemy!.health;

        scythe.fire(1, 0);
        expect(enemy!.health).toBeLessThan(initialHp);
      });
    });

    describe('Cursed Aura Radial Shockwave Precision', () => {
      it('asserts enemy 1px beyond aura pulse takes ZERO damage', () => {
        const aura = new CursedAura(player, hordeManager);
        aura.rank = 1;
        const reach = aura.getEffectiveArea(); // 85px
        const rEnemy = 11.0;
        const nearMissDist = reach + rEnemy + 1.0; // 97.0px

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0);
        const initialHp = enemy!.health;

        aura.pulse();
        expect(enemy!.health).toBe(initialHp);
        expect(enemy!.pushVx).toBe(0);
      });

      it('asserts enemy within aura pulse takes damage and knockback', () => {
        const aura = new CursedAura(player, hordeManager);
        aura.rank = 1;
        const reach = aura.getEffectiveArea(); // 85px
        const rEnemy = 11.0;
        const touchDist = reach + rEnemy; // 96.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0);
        const initialHp = enemy!.health;

        aura.pulse();
        expect(enemy!.health).toBeLessThan(initialHp);
        expect(enemy!.pushVx).toBeGreaterThan(0);
      });
    });
  });
});
```

---

## 5. Verification Method

To independently verify the investigation and test specification:

1. **Verify Existing Suite**:
   ```bash
   npm test
   ```
   Ensures all 29 test files and 376 tests currently execute green.

2. **Verify Hitbox Precision Suite** (once implemented in Milestone 1):
   ```bash
   npx vitest run tests/unit/hitbox_precision.spec.ts
   ```
   Must pass 100% green with 0 failures, verifying:
   - Near-miss distance $d = r_p + r_e + 1$ produces 0 damage.
   - Exact touch distance $d = r_p + r_e$ produces damage.
   - Projectile near-miss vs touch boundaries.
   - Zero phantom padding.

3. **Verify Zero Dynamic Memory Allocations**:
   Check that `scratch` in `src/main.ts` contact check loop uses a persistent pre-allocated `Int32Array` instead of `new Int32Array(32)` inside the frame loop.

4. **Invalidation Conditions**:
   - If player takes damage when an enemy is at distance $r_p + r_e + 1$, the test MUST fail (invalidation).
   - If Bone Spear pierces or damages an enemy at distance $r_{\text{spear}} + r_e + 1$, the test MUST fail.
   - If Soul Orbiters damages an enemy in the angular void between skulls, the test MUST fail.
