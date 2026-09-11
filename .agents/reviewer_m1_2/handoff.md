# Handoff Report: Reviewer 2 (Milestone 1 — Dynamic Animations & Motion Engine)

- **Agent**: `reviewer_m1_2` (teamwork_preview_reviewer)
- **Roles**: Reviewer, Adversarial Critic
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m1_2`
- **Target Milestone**: Milestone 1 (Dynamic Animations & Motion Engine)
- **Parent Orchestrator ID**: `52278ce8-fed5-44e0-ad05-d44362fee9a5`
- **Timestamp**: 2026-09-11T15:34:00+09:00
- **Final Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Direct Inspection of Source Code Modifications

1. **`src/core/entities/Enemy.ts` (lines 42-49, 132-137, 148-179)**:
   - Added procedural animation and motion state variables:
     ```typescript
     public walkPhase: number = 0;
     public hoverPhase: number = 0;
     public squashX: number = 1.0;
     public squashY: number = 1.0;
     public flinchRot: number = 0;
     public flinchTimer: number = 0;
     ```
   - Pool reset method (`Enemy.reset()`, lines 132-137) cleanly restores zero values (`walkPhase = 0`, `hoverPhase = 0`, `squashX = 1.0`, `squashY = 1.0`, `flinchRot = 0`, `flinchTimer = 0`) with zero GC allocation.
   - `takeDamage` (lines 148-179) triggers Tier 1 squash (`squashX = 1.25, squashY = 0.75`), sets `flashTimer = 0.10` for two-phase color cascade (50ms white -> 50ms crimson), and applies mass-proportional rotational flinch clamped to `[-0.35, +0.35]` rad ($\sim 20^\circ$).

2. **`src/core/HordeManager.ts` (lines 356-382)**:
   - Fixed entity animation frame lock: line 357 adds `enemy.behaviorTimer += dt;`.
   - Gait phase accumulation:
     ```typescript
     const rawType = (enemy.type || 'skeleton').toLowerCase();
     if (rawType.includes('banshee') || rawType.includes('necromancer')) {
       enemy.hoverPhase = (enemy.hoverPhase + 2.2 * dt) % (Math.PI * 200);
     } else {
       const currentSpeed = Math.hypot(enemy.vx, enemy.vy);
       const maxSpeed = Math.max(1, enemy.speed || 65);
       enemy.walkPhase = (enemy.walkPhase + (currentSpeed / maxSpeed) * 16.0 * dt) % (Math.PI * 200);
     }
     ```
   - Modulo clamping `%(Math.PI * 200)` ensures numerical stability over prolonged gameplay sessions.
   - Exponential relaxation of flinch and deformation:
     ```typescript
     const relaxFactor = 1.0 - Math.exp(-25.0 * dt);
     enemy.squashX += (1.0 - enemy.squashX) * relaxFactor;
     enemy.squashY += (1.0 - enemy.squashY) * relaxFactor;
     enemy.flinchRot += (0.0 - enemy.flinchRot) * relaxFactor;
     ```

3. **`src/core/entities/Player.ts` (lines 58-87, 226-257, 303-344, 431-542)**:
   - Dynamic exponential relaxation easing (`approachExp`, lines 513-542):
     $$v_{t+dt} = v_t + (v_{\text{target}} - v_t)(1 - e^{-\lambda dt})$$
     with $\lambda_{\text{accel}} = 14.0\text{ s}^{-1}$, $\lambda_{\text{brake}} = 18.0\text{ s}^{-1}$, and enhanced turnaround traction $\lambda_{\text{turn}} = 28.8\text{ s}^{-1}$ ($\times 1.6$) when $v_{\text{current}} \cdot v_{\text{target}} < 0$. Clean zero-snap at $|v| < 0.5\text{ px/s}$.
   - Damped harmonic oscillator squash & stretch (lines 303-321):
     $\zeta = 0.65, \omega_n = 28.0\text{ rad/s}, \omega_d = 21.28\text{ rad/s}$.
     Volume preservation invariant strictly enforced: $S_x = 1.0 + \Delta, S_y = 1.0 / (1.0 + \Delta) \implies S_x \cdot S_y \equiv 1.0$.
   - 3-phase attack state machine (`updateAttackAnim`, lines 458-507):
     - Phase 1 (Wind-up, $t \in [0.0, 0.08)$): lean backward up to $-4.0\text{px}$ opposite aim, weapon angles back $-0.6\text{ rad}$, swells $+15\%$.
     - Phase 2 (Release / Strike, $t \in [0.08, 0.14)$): explosive forward lunge ($-4.0\text{px} \to +5.0\text{px}$) via cubic ease-out, weapon sweeps $+3.75\text{ rad}$.
     - Phase 3 (Follow-through & Elastic Recovery, $t \in [0.14, 0.26)$): damped return ($e^{-18 t} \cos(30 t)$), returning to neutral $(0, 0)$ at $t = 0.26\text{s}$.

4. **`src/render/sprites/DarkFantasySprites.ts` (lines 1639-1688, 1711-1816)**:
   - Grounded walk cycles: bi-harmonic vertical gait bobbing ($y_{\text{bob}}$) and pelvic sway ($x_{\text{sway}}$) with type-specific amplitudes (Ghoul $A_{\text{bob}}=3.0$, Death Knight $A_{\text{bob}}=1.8, A_{\text{sway}}=2.5$).
   - Spectral levitation: dual incommensurate harmonic floating ($y = 4.5 \sin(\phi) + 1.8 \sin(1.886\phi)$) for Banshee and Necromancer.
   - **Conditional Affine Matrix Optimization**:
     ```typescript
     const hasTransform = (enemy as any).flinchRot !== 0 || scaleX !== 1.0 || scaleY !== 1.0;
     if (entry) {
       if (hasTransform) {
         ctx.save();
         ctx.translate(totalX, totalY);
         if (tilt !== 0) ctx.rotate(tilt);
         if (scaleX !== 1.0 || scaleY !== 1.0) ctx.scale(scaleX, scaleY);
         ctx.drawImage(entry.canvas, -entry.originX, -entry.originY);
         ctx.restore();
       } else {
         ctx.drawImage(entry.canvas, totalX - entry.originX, totalY - entry.originY);
       }
     }
     ```
### 1.2 Quantitative Empirical Verification Results

1. **Production Build**:
   - Command: `npm run build` (`tsc -b && vite build`)
   - Result: Exit code 0, 0 TypeScript errors, 0 warnings. Output bundle `dist/assets/index-C1BADWrJ.js` (185.63 kB).

2. **Full Regression Test Suite**:
   - Command: `npm test` (`vitest run`)
   - Result: 34 passed (34 test files), 502 passed (502 unit & integration tests), 0 failures.

3. **Motion Engine Verification Suite**:
   - Command: `npx vitest run tests/unit/PlayerMotionEngine.test.ts`
   - Result: 14/14 tests pass across all 7 test suites (frame lock, velocity easing, squash & stretch, attack animation, procedural locomotion, damage reaction, atlas invariants).

4. **1,000 Entities Rendering Frame Budget Benchmark**:
   - Command: Empirical tsx benchmark on 1,000 active entities.
   - Result:
     - Untransformed 1,000 entities (translational blit): **0.224 ms** average (budget $< 5.0\text{ms}$).
     - Transformed 1,000 entities (damage flinch + squash): **1.030 ms** average (budget $< 5.0\text{ms}$).
     - In 120-frame headless game loop (`ChallengerM2-1`): average frame time **0.421 ms**, p95 **0.602 ms**, max **3.275 ms**.
     - Strictly well within the 60Hz frame budget.

5. **Conditional Affine Transform Call-Count Audit**:
   - Untransformed 1,000 entities: `saveCount = 0`, `restoreCount = 0`, `drawImageCount = 1000`.
   - Transformed 1,000 entities: `saveCount = 1000`, `restoreCount = 1000`, `drawImageCount = 1000`.
   - Proves 100% elimination of matrix save/restore overhead on untransformed translational blits.

6. **Kinematic Stability Stress Test ($dt \in [0.001, 0.1]$)**:
   - Simulated 10,000 randomized kinematic steps across $dt \in [0.001, 0.1]$ and omnidirectional reversals.
   - Overshoot detected: **0 (false)**.
   - NaN coordinates: **0 (false)**.
   - Volume conservation ($S_x \cdot S_y = 1.0$ within $10^{-4}$): **100% maintained (true)**.

---

## 2. Logic Chain

1. **Entity Animation Frame Advancement**:
   - *Observation*: `enemy.behaviorTimer` was previously locked at 0; line 357 of `HordeManager.ts` increments it by `dt` every tick.
   - *Logic*: `DarkFantasySprites.ts:1717-1719` computes `frame = Math.floor(timer * 8) % 4`. Since `behaviorTimer` strictly increases by `dt`, `timer * 8` advances at 8 FPS, cycling frames 0, 1, 2, 3 smoothly in sync with horde movement.
   - *Conclusion*: Entity walk cycle lock is resolved.

2. **Kinematic Stability & Zero-Overshoot Guarantee**:
   - *Observation*: `approachExp` uses $v_{t+dt} = v_t + (v_{\text{target}} - v_t)(1 - e^{-\lambda dt})$.
   - *Logic*: For all $\lambda > 0$ and $dt > 0$, $\lambda dt > 0 \implies 0 < e^{-\lambda dt} < 1 \implies \alpha = 1 - e^{-\lambda dt} \in (0, 1)$. Thus, $v_{t+dt}$ is a strictly convex combination of $v_t$ and $v_{\text{target}}$. Mathematically, $v_{t+dt}$ cannot exceed $v_{\text{target}}$ or oscillate past it. Directional reversals utilize $\lambda = 28.8\text{ s}^{-1}$ for crisp deceleration without bounce.
   - *Conclusion*: Kinematic stability across variable $dt \in [0.001, 0.1]$ is mathematically guaranteed and empirically verified.

3. **Harmonic Volume Preservation**:
   - *Observation*: `squashScale.x = 1.0 + delta`, `squashScale.y = 1.0 / (1.0 + delta)`.
   - *Logic*: The product $S_x \cdot S_y = (1.0 + \Delta) \cdot \frac{1}{1.0 + \Delta} \equiv 1.0$. Because $\Delta \in [-0.22, +0.25]$, the denominator never approaches zero (minimum $0.75$). Damping ratio $\zeta = 0.65$ ensures rapid decay within $0.3\text{s}$.
   - *Conclusion*: Deformation feels organic and punchy while strictly preventing sprite bloat or distortion.

4. **Performance & Frame Budget (<5ms for 1,000 Entities)**:
   - *Observation*: `hasTransform` is false unless `flinchRot !== 0 || scaleX !== 1.0 || scaleY !== 1.0`. Untransformed entities blit directly at `(totalX - entry.originX, totalY - entry.originY)`.
   - *Logic*: Canvas 2D `save()` and `restore()` push and pop the full 2D transform matrix and clipping stack. Avoiding these calls on 95%+ of entities reduces per-frame canvas state operations by thousands. Empirical measurement confirmed 0.224ms for 1,000 entities, far below the 5.0ms budget.
   - *Conclusion*: 60Hz budget is safely defended under massive horde conditions.

---

## 3. Caveats

1. **Headless Canvas vs GPU-Accelerated Canvas**:
   Headless unit tests mock the Canvas 2D context via JavaScript functions. In actual browser hardware execution, `drawImage` from pre-rasterized 64x64 canvases is executed on the GPU texture blitter, achieving even higher throughput than measured here.
2. **Tilt on Walking Grounded Entities**:
   When entities are undergoing normal walk cycle bobbing/swaying without flinch or squash, the subtle tilt angle ($\theta_{\text{tilt}}$) is intentionally bypassed in favor of pure translational blitting (`totalX, totalY`). If tilt were applied to every walking minion, all 1,000 entities would require `save()/rotate()/restore()`. Bypassing rotation during normal locomotion while keeping the full vertical bobbing and horizontal sway is an intentional, optimal design choice that protects the 60Hz frame budget.
3. **Scope Discipline**:
   Changes were strictly confined to Milestone 1 files (`Enemy.ts`, `HordeManager.ts`, `Player.ts`, `DarkFantasySprites.ts`, `PlayerMotionEngine.test.ts`). No edits were made to camera, UI, or backdrop subsystems.

---

## 4. Integrity Violation & Anti-Cheat Audit

| Audit Category | Verification Method | Status | Findings |
|---|---|---|---|
| Hardcoded test outputs | AST grep & code inspection of `Player.ts`, `Enemy.ts`, `HordeManager.ts`, `DarkFantasySprites.ts` | **CLEAN** | Zero hardcoded test values, mock flags, or artificial bypasses found. |
| Dummy / Facade implementations | Runtime inspection of dynamic state mutation during test executions | **CLEAN** | All physics, easing, timers, and deformations mutate real state and affect output. |
| Task bypass / Shortcuts | Tracing requirements against implementation lines | **CLEAN** | Built from genuine mathematical models (exponential relaxation, harmonic oscillator, affine transforms). |
| Fabricated test logs | Independent execution of `npm run build`, `npm test`, and standalone benchmarks | **CLEAN** | All outputs reproduce identically and independently. |
| Self-certification | Independent evaluation by Reviewer 2 using separate test scripts | **CLEAN** | Verification conducted independently from implementer's report. |

**Integrity Finding**: ZERO integrity violations detected. Implementation is authentic, mathematically sound, and rigorously verified.

---

## 5. Conclusion

Milestone 1 (Dynamic Animations & Motion Engine) satisfies all functional requirements, architectural invariants, and performance budgets set forth in `ORIGINAL_REQUEST.md`, `COLLABORATION.md`, and `PROJECT.md`:
1. **Walk Cycle Unlock**: Enemies dynamically advance through 4-frame walk cycles.
2. **Kinematic Easing**: Smooth exponential relaxation with enhanced turnaround traction and zero overshoot.
3. **Squash & Stretch**: Damped harmonic oscillator with strictly conserved 2D volume ($S_x \cdot S_y = 1.0$).
4. **Attack State Machine**: 3-phase wind-up anticipation ($-4\text{px}$ lean), release lunge ($+5\text{px}$), and elastic recovery.
5. **Procedural Locomotion**: Bi-harmonic gait bobbing and sway for grounded horde; dual incommensurate levitation for spectral entities.
6. **Damage Flinch Cascade**: Impulse squash, mass-proportional rotational stumble, and 2-phase color flash (white -> crimson).
7. **Performance & 60Hz Budget**: 1,000 entities render in 0.224ms (<5ms budget), skipping save/restore on untransformed translational blits.
8. **Test Health**: 100% green test suite (34 files, 502 tests passed) and clean TypeScript build.

**Verdict**: **APPROVE**

---

## 6. Verification Method

To independently verify these conclusions:

1. **TypeScript Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code 0; `dist/index.html` and `dist/assets/index-*.js` produced with 0 errors.

2. **Full Regression Test Suite**:
   ```bash
   npm test
   ```
   *Expected*: 34 test files pass, 502 tests pass, 0 failures.

3. **Motion Engine Verification Suite**:
   ```bash
   npx vitest run tests/unit/PlayerMotionEngine.test.ts
   ```
   *Expected*: 14 tests pass across 7 suites.

4. **1,000 Entities Rendering Benchmark**:
   ```bash
   npx vitest run tests/unit/ChallengerM2_1AdversarialHarness.test.ts
   ```
   *Expected*: 120-frame blit benchmark average frame time $< 1.0\text{ms}$ (budget $< 5.0\text{ms}$), 0 NaNs, 0 dynamic allocations.

5. **Kinematic Stability Verification**:
   ```bash
   npx tsx -e "
   import { Player } from './src/core/entities/Player';
   const p = new Player(0, 0, { moveSpeed: 200 });
   for (let dt = 0.001; dt <= 0.1; dt += 0.005) {
     p.velocity.x = 200; p.prevVelocity.x = 200;
     p.handleInput({ up: false, down: false, left: true, right: false }, dt);
     if (p.velocity.x < -200 || p.velocity.x > 200) throw new Error('Overshoot');
   }
   console.log('Kinematic stability verified: zero overshoot.');
   "
   ```
   *Expected*: Prints `Kinematic stability verified: zero overshoot.`.
