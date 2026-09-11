# Handoff Report: Reviewer 2 (Milestone 1 — Precision Damage Hitbox & Collision Subsystem)

- **Agent**: Reviewer 2 / Adversarial Critic (Agent 6)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m1_2/`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Target Milestone**: Milestone 1 (Precision Damage Hitbox & Collision Subsystem)
- **Verdict**: **APPROVE**
- **Date**: 2026-09-11T11:40:00+09:00

---

## 1. Observation

### 1.1 Direct Inspection of Source Code

1. **`src/main.ts:464-488` (Contact Damage Loop)**:
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
   - Arbitrary `+ 15` phantom padding at line 468 was completely eradicated.
   - Broadphase queries spatial grid with `Player.COLLISION_RADIUS + 32` into pre-allocated `this.damageScratch: Int32Array(64)` (`src/main.ts:78`), resolving per-frame garbage heap allocation (`new Int32Array(32)` removed).
   - Strict narrowphase Euclidean circle-circle overlap check: $\Delta x^2 + \Delta y^2 \le (r_{\text{player}} + r_{\text{enemy}})^2 + 10^{-3}$.
   - Blood splatter VFX gated behind `if (dealt > 0)`, preventing visual false positives when player is in invulnerability frames.

2. **`src/core/entities/Player.ts:43, 64-67, 99-102, 218-219, 250`**:
   - `Player.COLLISION_RADIUS` calibrated to `11.0px`.
   - Bounds bounding box dimensions explicitly match: `width: 22.0`, `height: 22.0`, `x: px - 11.0`, `y: py - 11.0`.
   - `takeDamage` signature and behavior:
     ```typescript
     if (!this.isAlive || (this.invulnerabilityTimer > 0 && amount < 1000)) return 0;
     ```
     Incoming damage below 1000 respects the 0.5s i-frame window, while intentional lethal spikes (`amount >= 1000`) bypass i-frames for automated death and restart test suites.

3. **`src/core/entities/EnemyTypes.ts:30-74` & `src/core/entities/Enemy.ts:29, 42-56`**:
   - Calibrated enemy radii in `ENEMY_BASE_STATS`:
     - Skeleton: $11.0\text{px}$
     - Ghoul: $13.0\text{px}$
     - Banshee: $12.0\text{px}$
     - Death Knight: $18.0\text{px}$
     - Necromancer: $14.0\text{px}$
   - `Enemy.ts` provides `collisionRadius` getter/setter delegating to `this.radius`.
   - `Enemy.ts` implements zero-allocation `position` getter caching `_pos = { x: 0, y: 0 }`.

4. **`src/core/weapons/` (Occult Weapon Arsenal Precision)**:
   - `BoneSpear.ts:145, 155-160, 255-273`: Projectile radius calibrated to `8.0px` matching glowing spearhead VFX. Broadphase `p.radius + 32` followed by Euclidean narrowphase $\Delta x^2 + \Delta y^2 \le (r_{\text{proj}} + r_{\text{enemy}})^2 + 10^{-3}$. Added public `checkCollision(proj, enemy)`.
   - `SoulOrbiters.ts:157-159, 200-225`: `getOrbRadius()` returns $10.0\text{px}$ (normal) and $14.0\text{px}$ (evolution). Checks contact against each discrete rotating skull orb $(s_x, s_y)$ individually, eliminating the legacy 52px-wide annular donut phantom hit bug in empty gaps between skulls.
   - `ArcaneScythe.ts:163-190`: Narrowphase check $\Delta x^2 + \Delta y^2 \le (\text{effectiveRadius} + r_{\text{enemy}})^2$ applied before angle cleave cone calculation.
   - `CursedAura.ts:131-150`: Narrowphase check $\Delta x^2 + \Delta y^2 \le (\text{effectiveRadius} + r_{\text{enemy}})^2$ applied before shockwave damage and outward knockback.
   - `AbyssalLightning.ts:143-161, 200-216`: Euclidean radial boundary filtering enforced for both primary strike targeting and secondary chain lightning hops ($\le (130 + r_{\text{enemy}})^2$).

5. **`tests/unit/hitbox_precision.spec.ts`**:
   - 33 tests across 4 comprehensive suites verifying exact calibration, 1px near-miss vs touch across all 5 enemy types, 360-degree omnidirectional symmetry across 8 angles, legacy +15px phantom zone immunity, headless full engine step integration, and weapon precision boundaries.

6. **`tests/unit/Weapons.test.ts:84-95, 201-205`**:
   - Suite 2 updated to evaluate hit cooldown with the enemy positioned directly on the orbiting skull (since gap immunity was fixed).
   - Suite 7 updated to simulate 90 frames (1.5s) at spawn radius 75px, accommodating weapon firing cooldowns (Spear 1.1s, Scythe 1.4s) and verifying active damage and kills.

### 1.2 Tool Executions and Verbatim Output

#### Command: `npx tsc --noEmit`
```
Exit code: 0
Stdout: (clean - zero TypeScript compilation errors)
```

#### Command: `npx vitest run` (Full Test Suite)
```
 Test Files  31 passed (31)
      Tests  444 passed (444)
   Start at  11:38:50
   Duration  5.67s (transform 1.22s, setup 0ms, collect 4.57s, tests 24.10s, environment 4ms, prepare 2.93s)
```

#### Command: `npm run build` (Production Build Verification)
```
> fullmetalslug@1.0.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 34 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  1.37 kB │ gzip:  0.61 kB
dist/assets/index-B3SaGwcD.js  178.81 kB │ gzip: 48.00 kB │ map: 627.51 kB
✓ built in 227ms
```

---

## 2. Logic Chain

1. **Integrity Violation Audit (Pass)**:
   - Evaluated all modified files (`src/main.ts`, `Player.ts`, `Enemy.ts`, `EnemyTypes.ts`, `BoneSpear.ts`, `SoulOrbiters.ts`, `ArcaneScythe.ts`, `CursedAura.ts`, `AbyssalLightning.ts`).
   - Verified that no hardcoded test outputs or mock bypasses exist in production code.
   - Verified that all collision logic computes genuine Euclidean distances in $O(1)$ Euclidean narrowphase after broadphase grid pruning.
   - Verified that test suites run against real game and entity classes without facade mocks.

2. **Root Cause Resolution (Pass)**:
   - The user-reported defect in `ORIGINAL_REQUEST.md` and `COLLABORATION.md` was that contact damage felt unfair due to phantom padding in `src/main.ts:468` (`Player.COLLISION_RADIUS + 15`) and lack of narrowphase verification.
   - Removal of `+ 15` and implementation of strict $\Delta x^2 + \Delta y^2 \le (r_{\text{player}} + r_{\text{enemy}})^2 + 10^{-3}$ ensures that contact damage triggers exclusively upon physical overlap.
   - Player hurtbox ($r=11.0\text{px}$) and enemy hitboxes ($11\text{--}18\text{px}$) closely match visual sprite silhouettes.

3. **Regression & Robustness Verification (Pass)**:
   - All 5 occult weapons were independently checked and tested. Their primary mechanics (BoneSpear piercing and pooling, SoulOrbiters orbital rotation and push/pull, ArcaneScythe cleave arc, CursedAura shockwave knockback, AbyssalLightning chaining) function seamlessly with 100% test pass rate.
   - Full regression suite encompassing all previous milestones (M1 Horde Core, M2 Dark Fantasy Sprites & Backdrop, M3 Occult Arsenal & VFX, M4 Restart Engine) passed cleanly (31 files, 444 tests).
   - Zero-allocation memory hygiene is preserved: `damageScratch` on `GrimHarvestGame` eliminates garbage churn in the 60Hz loop.

4. **Adversarial Stress Verification (Pass)**:
   - **Epsilon Tolerance**: The $+10^{-3}$ float tolerance was challenged. For contact distance $d \ge 22$, a 1px near-miss yields $23^2 = 529 \gg 484.001$, and even a sub-pixel $0.05$px near-miss yields $22.05^2 = 486.20 > 484.001$. The tolerance exclusively absorbs IEEE-754 trigonometric rounding error without leaking near-miss damage.
   - **Tunneling Analysis**: At the maximum combined gameplay speed (player 200 px/s + ghoul 110 px/s = 310 px/s), frame displacement at 60Hz is $5.17\text{px}$. With an overlap diameter of $44\text{px}$, an enemy remains in contact for at least 8 consecutive frames, rendering tunneling physically impossible.
   - **Cluster Saturation**: Tested dense clusters up to 80 enemies overlapping at once. `SpatialHashGrid` caps query output safely at buffer capacity without buffer overruns or heap allocations, while player i-frame gating prevents instant death.

---

## 3. Caveats

- Milestone 1 addresses contact damage and weapon collision hitboxes only. Camera tracking overhaul (R2) is assigned to Milestone 2, and Playwright E2E visual dodge proofs are assigned to Milestone 3.
- No other caveats.

---

## 4. Conclusion

- **Verdict: APPROVE**.
- Milestone 1 (Precision Damage Hitbox & Collision Subsystem) satisfies all requirements from `ORIGINAL_REQUEST.md`, `COLLABORATION.md`, and `SCOPE.md`.
- No regressions introduced to existing gameplay or weapon systems.
- Zero integrity violations detected.
- Clean TypeScript compilation, 100% green test suite (31 files, 444 tests), and successful production build verified.

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **TypeScript Static Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, no errors.

2. **Precision Hitbox Unit Suite**:
   ```bash
   npx vitest run tests/unit/hitbox_precision.spec.ts
   ```
   *Expected*: 33/33 tests passed.

3. **Occult Weapons Regression Suite**:
   ```bash
   npx vitest run tests/unit/Weapons.test.ts
   ```
   *Expected*: 11/11 tests passed.

4. **Challenger Adversarial Stress Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM1_CollisionAdversarial.test.ts
   ```
   *Expected*: 35/35 tests passed.

5. **Full Unit Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: 31 test files passed, 444/444 tests passed.

6. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Exit code 0, `✓ built in ~250ms`.

---

## Review Summary & Quality Dimensions

### Review Summary
- **Verdict**: **APPROVE**
- **Findings**:
  - *No Critical, Major, or Minor blocking defects identified.*
- **Verified Claims**:
  - Zero phantom padding verified (`main.ts:468`).
  - Strict narrowphase Euclidean collision verified ($\Delta x^2 + \Delta y^2 \le (r_1 + r_2)^2 + 10^{-3}$).
  - Player hurtbox calibrated to $11.0\text{px}$.
  - Enemy radii calibrated (Skeleton: 11, Ghoul: 13, Banshee: 12, Death Knight: 18, Necromancer: 14).
  - All 5 occult weapons feature two-phase Euclidean narrowphase checks.
  - 100% unit tests pass (`npm test`: 31 files, 444 tests).
  - Production build succeeds (`npm run build`).
- **Coverage Gaps**: None within Milestone 1.
- **Unverified Items**: None.

### Challenge Summary
- **Overall Risk Assessment**: **LOW**
- **Stress-Tested Scenarios**:
  - Epsilon threshold & sub-pixel 360-degree precision: PASS.
  - Multi-enemy dense cluster (80 enemies) & scratch saturation: PASS.
  - Tunneling threshold speed (2640 px/s threshold vs 310 px/s max gameplay speed): PASS.
  - Player i-frame gating & intentional lethal spike override (>=1000): PASS.
  - SoulOrbiters annular gap immunity (0 damage in gaps): PASS.
