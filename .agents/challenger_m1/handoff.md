# Handoff Report: Challenger 1 (Milestone 1 — Precision Damage Hitbox & Collision Subsystem)

- **Author**: Challenger 1 (Agent 7)
- **Role**: Empirical Challenger (critic, specialist)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1/`
- **Date**: 2026-09-11T11:40:00+09:00
- **Verdict**: **APPROVE**
- **Target Files Inspected & Stress-Tested**:
  - `src/main.ts` (Lines 464–487)
  - `src/core/entities/Player.ts` (Lines 43, 63–68, 99–102, 249–270)
  - `src/core/entities/EnemyTypes.ts` (Lines 31–77)
  - `src/core/entities/Enemy.ts` (Lines 29, 44–56)
  - `src/core/weapons/BoneSpear.ts` (Lines 155–160, 256–275)
  - `src/core/weapons/SoulOrbiters.ts` (Lines 200–225)
  - `src/core/weapons/ArcaneScythe.ts` (Lines 172–195)
  - `src/core/weapons/CursedAura.ts` (Lines 131–150)
  - `src/core/weapons/AbyssalLightning.ts` (Lines 143–162, 200–218)
  - `tests/unit/hitbox_precision.spec.ts` (33 specification tests)
  - `tests/unit/ChallengerM1_CollisionAdversarial.test.ts` (35 empirical adversarial stress tests)

---

## 1. Observation

### 1.1 Implementation Verifications

1. **`src/main.ts:464-487` (Two-Phase Contact Damage Routine)**:
   ```typescript
   // 6. Contact Damage & Blood VFX (Two-Phase: Broadphase Grid Query + Narrowphase Exact Circle Overlap)
   const nearbyCount = this.hordeManager.getEnemiesInRadius(
     this.player.position.x,
     this.player.position.y,
     Player.COLLISION_RADIUS + 32,
     this.damageScratch
   );

   for (let i = 0; i < nearbyCount; i++) {
     const enemy = this.hordeManager.pool[this.damageScratch[i]];
     if (enemy && enemy.active && enemy.isAlive) {
       const dx = enemy.position.x - this.player.position.x;
       const dy = enemy.position.y - this.player.position.y;
       const distSq = dx * dx + dy * dy;
       const contactDist = Player.COLLISION_RADIUS + enemy.radius;
       if (distSq <= contactDist * contactDist + 1e-3) {
         const dealt = this.player.takeDamage(enemy.damage);
         if (dealt > 0) {
           this.vfx.emitBloodBurst(this.player.position.x, this.player.position.y, 3);
           this.vfx.emitBloodSplatter(this.player.position.x, this.player.position.y, 4);
         }
       }
     }
   }
   ```
   - Broadphase query radius is explicitly `Player.COLLISION_RADIUS + 32`, capturing candidate enemies with max radius 32.
   - Arbitrary `+ 15` phantom padding from legacy code is completely removed.
   - Strict narrowphase Euclidean circle overlap is enforced: $dx^2 + dy^2 \le (r_p + r_e)^2 + 10^{-3}$.
   - Preallocated `this.damageScratch = new Int32Array(64)` eliminates per-frame heap allocations.
   - Particle VFX emissions (`emitBloodBurst`, `emitBloodSplatter`) are guarded by `if (dealt > 0)`, preventing ghost blood bursts during i-frames.

2. **`src/core/entities/Player.ts`**:
   - `Player.COLLISION_RADIUS` is exactly `11.0px` (Line 43).
   - Bounding box dimensions in constructor (Lines 63–68) and `reset()` (Lines 99–102) are strictly $22.0\text{px} \times 22.0\text{px}$.
   - `takeDamage(amount)` (Line 250) gates damage via `if (!this.isAlive || (this.invulnerabilityTimer > 0 && amount < 1000)) return 0;`, enabling lethal damage override ($amount \ge 1000$) while protecting normal damage intake during the 0.5s i-frame window.

3. **`src/core/entities/EnemyTypes.ts` & `Enemy.ts`**:
   - `ENEMY_BASE_STATS` defines visual archetype radii:
     - `skeleton`: $11.0\text{px}$
     - `ghoul`: $13.0\text{px}$
     - `banshee`: $12.0\text{px}$
     - `death_knight`: $18.0\text{px}$
     - `necromancer`: $14.0\text{px}$
   - `Enemy.ts` provides public `collisionRadius` getter/setter and zero-allocation `position` getter reusing private `_pos`.

4. **Weapon Narrowphase Routines in `src/core/weapons/`**:
   - `BoneSpear.ts`: Projectile radius is $8.0\text{px}$. Implements public `checkCollision(proj, enemy): boolean` checking $dx^2 + dy^2 \le (r_{\text{proj}} + r_{\text{enemy}})^2 + 10^{-3}$.
   - `SoulOrbiters.ts`: Narrowphase loops over individual active skulls ($r=10.0\text{px}$ standard, $14.0\text{px}$ evolved), eliminating the legacy 52px wide annular ring donut bug.
   - `ArcaneScythe.ts`: Checks radial boundary $dx^2 + dy^2 \le (\text{effectiveRadius} + r_{\text{enemy}})^2$ before testing angular cleave sector.
   - `CursedAura.ts`: Checks radial boundary $dx^2 + dy^2 \le (\text{effectiveRadius} + r_{\text{enemy}})^2$ before applying pulse damage and knockback.
   - `AbyssalLightning.ts`: Filters both primary strike candidates and secondary chain arcs by Euclidean radial boundaries.

### 1.2 Tool Executions and Test Outputs

#### Test Command 1: TypeScript Static Type Analysis
```bash
npx tsc --noEmit
```
- Exit code: 0
- Output: Empty (0 errors).

#### Test Command 2: Worker Specification Suite
```bash
npx vitest run tests/unit/hitbox_precision.spec.ts
```
- Exit code: 0
- Results: 33/33 tests passed (11ms).

#### Test Command 3: Challenger Adversarial Stress Suite
```bash
npx vitest run tests/unit/ChallengerM1_CollisionAdversarial.test.ts
```
- Exit code: 0
- Results: 35/35 tests passed (224ms).

#### Test Command 4: Combined Hitbox Verification
```bash
npx vitest run tests/unit/hitbox_precision.spec.ts tests/unit/ChallengerM1_CollisionAdversarial.test.ts
```
- Exit code: 0
- Results: 68/68 tests passed (236ms).

#### Test Command 5: Production Build Compilation
```bash
npm run build
```
- Exit code: 0
- Output: `✓ built in 235ms`, dist generated cleanly.

---

## 2. Logic Chain

1. **Exact Mathematical Boundary & Epsilon Behavior**:
   - The narrowphase collision condition is $d^2 \le R^2 + 10^{-3}$, where $R = r_p + r_e$.
   - For a Skeleton ($r_p = 11, r_e = 11, R = 22, R^2 = 484$):
     - At $d = 22.0$: $d^2 = 484 \le 484.001$ $\implies$ **Damage registered** (Pass).
     - At $d = 21.999$ ($R - 0.001$): $d^2 = 483.956 \le 484.001$ $\implies$ **Damage registered** (Pass).
     - At $d = 22.001$ ($R + 0.001$): $d^2 = 484.044001 > 484.001$ $\implies$ **ZERO damage** (Pass).
     - Analytic boundary threshold: $\sqrt{R^2 + 10^{-3}} = \sqrt{484.001} \approx 22.000022727\text{px}$.
       - Inside by $10^{-7}$ $\implies$ Hit detected.
       - Outside by $10^{-7}$ $\implies$ Miss detected.
   - Tested across all 5 enemy archetypes: Skeleton ($R=22$), Ghoul ($R=24$), Banshee ($R=23$), Death Knight ($R=29$), Necromancer ($R=25$). All 5 pass unconditionally.

2. **Sub-Pixel Precision & 360-Degree Omnidirectional Symmetry**:
   - Tested 72 discrete angles around the circle ($\theta = 0^\circ, 5^\circ, 10^\circ, \dots, 355^\circ$) with irregular sub-pixel player origin $(314.159, 271.828)$.
   - At $d = R$: 100% of angles register collision.
   - At $d = R + 1.0$: 100% of angles yield 0 damage.
   - Monte Carlo test: 250 random positions inside ($d \in [0, R - 0.05]$) yielded 250/250 hits; 250 random positions outside ($d \in [R + 0.05, R + 30.0]$) yielded 0/250 hits. Zero false positives and zero false negatives.

3. **Multi-Enemy Dense Cluster & Scratch Buffer Saturation**:
   - Tested with 80 active skeletons packed within 10px of the player, saturating `damageScratch` (capacity 64).
   - Invariant A: `queryRadius` returns 64 without array index out-of-bounds or heap memory allocation.
   - Invariant B: Player takes damage from exactly the first enemy (10 HP loss), engaging `invulnerabilityTimer = 0.5s`.
   - Invariant C: The remaining 63 enemies in the scratch buffer deal 0 damage due to i-frame gating.
   - Invariant D: Player survives the tick with 90 HP instead of suffering an instant-kill 800 HP burst.

4. **High Relative Velocity & Frame Tunneling Analysis**:
   - At locked 60Hz ($dt = 1/60\text{s}$), the combined hurtbox diameter is $2 \cdot (r_p + r_e) = 44\text{px}$.
   - For an enemy to tunnel through the hurtbox in a single frame without collision:
     $$\Delta x > 44\text{px} \implies v \cdot \left(\frac{1}{60}\right) > 44 \implies v > 2640\text{px/s}$$
   - Maximum gameplay relative speed: Player move speed (200 px/s) + fastest enemy Ghoul (110 px/s) = 310 px/s.
   - Maximum displacement per frame in gameplay is $310 \times (1/60) = 5.17\text{px}$.
   - Because $5.17\text{px} \ll 44\text{px}$, an enemy requires at least $\lfloor 44 / 5.17 \rfloor = 8$ consecutive frames to pass through the player's hurtbox. Discrete frame tunneling is mathematically and physically impossible under normal gameplay speeds.
   - Simulated speeds $65, 110, 200, 500, 1000, 2000\text{px/s}$: all registered multi-frame collision.

5. **Player Invulnerability Frame Gating & Lethal Override**:
   - First hit deals 20 damage, engaging $0.5\text{s}$ timer.
   - Hits at $t = 0.1\text{s}, 0.2\text{s}, 0.3\text{s}, 0.4\text{s}$ deal 0 damage.
   - Advancing time past $0.5\text{s}$ restores damage vulnerability (hit at $t = 0.51\text{s}$ deals damage).
   - Lethal damage spike ($amount \ge 1000$) immediately penetrates i-frames, reducing HP to 0 and setting `isAlive = false`, ensuring test harnesses can reset or kill the player without hanging.
   - Dead player (`isAlive = false`) takes 0 damage.

6. **Occult Weapon Narrowphase Collision & Gap Immunity**:
   - `BoneSpear`: Contact at $19.0\text{px}$ ($8+11$) hits; near-miss at $20.0\text{px}$ misses.
   - `SoulOrbiters`: Skulls at $0^\circ$ and $180^\circ$ on $80\text{px}$ radius ring. Enemy placed at $(0, 80)$ ($90^\circ$, on the ring but in the gap between skulls) takes **ZERO damage**, empirically verifying that the 52px donut bug is eliminated.
   - `ArcaneScythe`: Enemy within radial reach ($60\text{px}$) and within $110^\circ$ forward arc is hit; enemy outside radial reach ($120\text{px}$) or behind player ($180^\circ$) takes 0 hits.
   - `CursedAura`: Pulse hits enemy at touch distance ($96\text{px}$) and misses enemy at $98\text{px}$.
   - `AbyssalLightning`: Targets enemy at $330\text{px}$ (within $331\text{px}$ reach) and rejects enemy at $340\text{px}$.

---

## 3. Caveats

- **Kinematic Speed Coupling**: In the full game loop (`game.step(dt)`), `hordeManager.update(dt)` runs before contact damage resolution. Active enemies move $v \cdot dt$ pixels towards the player during that tick. Therefore, any spatial boundary test within the game loop must freeze enemy speed (`enemy.speed = 0`) to evaluate static spatial geometry; otherwise, moving enemies close distance before the collision check runs. This is expected kinematic behavior, not a collision bug.
- No other caveats. All stress-test dimensions passed with 100% precision.

---

## 4. Conclusion

- **VERDICT: APPROVE**
- Milestone 1 (Precision Damage Hitbox & Collision Subsystem) satisfies all mathematical, architectural, and edge-case requirements.
- The collision subsystem exhibits:
  - Strict Euclidean circle-circle narrowphase accuracy.
  - Zero false-positives at near-miss distances ($+0.001\text{px}$ and $+1.0\text{px}$).
  - Zero phantom padding (legacy `+ 15` padding eliminated).
  - Robust multi-enemy dense cluster handling with zero GC pressure.
  - Impossibility of frame tunneling under gameplay speeds ($v \le 310\text{px/s} \ll 2640\text{px/s}$).
  - Full annular gap immunity for orbiting weapons.
  - Solid i-frame gating with functional lethal test override.
- 0 TypeScript compilation errors (`npx tsc --noEmit`).
- 68/68 unit and adversarial tests pass (`hitbox_precision.spec.ts` + `ChallengerM1_CollisionAdversarial.test.ts`).
- Production build succeeds cleanly.

---

## 5. Verification Method

To independently reproduce and verify this challenger assessment:

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Output*: Exit code 0, 0 errors.

2. **Execute Specification Test Suite**:
   ```bash
   npx vitest run tests/unit/hitbox_precision.spec.ts
   ```
   *Expected Output*: 33/33 tests passed.

3. **Execute Adversarial Stress Test Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM1_CollisionAdversarial.test.ts
   ```
   *Expected Output*: 35/35 tests passed.

4. **Execute Production Build**:
   ```bash
   npm run build
   ```
   *Expected Output*: Exit code 0, `✓ built in ~250ms`.

5. **Invalidation Conditions**:
   - If any near-miss enemy at $d \ge r_p + r_e + 0.001$ inflicts damage, or
   - If any touching enemy at $d \le r_p + r_e$ fails to inflict damage, or
   - If Soul Orbiters damage enemies in the gap between skulls,
   then this approval is invalidated.
