# Milestone 3 Exploration & Architectural Blueprint: Dynamic Lighting, Rich VFX & Atmospheric Polish

**Investigator**: explorer_m3_3 (Codebase Researcher / Explorer)  
**Date**: 2026-09-10T16:15:00Z  
**Target Subsystems**:
1. `src/render/vfx/DarkFantasyVFX.ts` (Particle System & Arcane Effects Engine)
2. `src/render/GothicBackdrop.ts` (Multi-Layer Atmospheric Mist & Parallax Pipeline)
3. `tests/unit/DarkFantasyVFX.spec.ts` (Comprehensive Vitest Specification & Empirical Verification Suite)

---

## 1. Observation

### 1.1 Existing Codebase State & Current Implementations

1. **`DarkFantasyVFX.ts` (`src/render/vfx/DarkFantasyVFX.ts:11-42, 63-93, 156-188, 470-593`)**:
   - **Data Structures**:
     - `ParticleType` is restricted to 7 types:
       `'BLOOD_DROPLET' | 'BONE_CHIP' | 'SOUL_SPARK' | 'GHOUL_BILE' | 'SPELL_TRAIL' | 'SPELL_CIRCLE' | 'GEM_GLINT'` (lines 11–18).
     - `Particle` interface (lines 20–42) includes `id, active, type, x, y, vx, vy, drag, gravity, life, maxLife, startSize, endSize, size, color, startAlpha, endAlpha, alpha, rotation, vRot, extra`.
   - **Allocation & Pooling**:
     - Constructor defaults to `capacity = 500` pre-allocated particle objects in `this.pool`, paired with `freeIndices: Int32Array`, `activeIndices: Int32Array`, and `indexInActive: Int32Array` (lines 56–93).
     - `allocateParticle()` uses swap-and-pop from `freeIndices` (lines 103–125). When saturated, it currently returns `this.pool[this.activeIndices[0]]` without re-ordering `activeIndices` or cycling the active array.
   - **Motion Integration (`update(dt)`)**:
     - Standard Euler integration with drag: `vx *= Math.pow(drag, dt * 60)`, `vy *= Math.pow(drag, dt * 60)`, `vy += gravity * dt` (lines 169–173).
     - `SOUL_SPARK` only exhibits simple 1D X-axis oscillation:
       `p.vx += Math.sin(p.life * 12.0 + p.extra) * 15.0 * dt;` (lines 175–177). It lacks true 2D orbital/swirling drift.
   - **Dual-Layer Rendering**:
     - `renderGround(ctx, camera)` (lines 470–514): Renders only `SPELL_CIRCLE`. It draws a basic 5-pointed star and single outer ring.
     - `renderAir(ctx, camera)` (lines 516–593): Renders all non-circle particles. All drawing uses default `source-over` composite operation. There is **zero additive blending** (`ctx.globalCompositeOperation = 'lighter'`), causing soul motes, sparks, and spell trails to appear as flat opaque shapes rather than luminous spiritual energy.
     - `BLOOD_DROPLET` is rendered as a simple uniform circle (`ctx.arc(sx, sy, s, 0, Math.PI * 2)`) (lines 543–546), completely lacking velocity-based elongation, directional spraying, or viscous blood pooling.
     - `BONE_CHIP` is rendered as a simple solid rectangle (`ctx.fillRect(-s / 2, -s / 2, s, s * 0.6)`) (lines 553), with no 3D tumbling projection, marrow detailing, or geometry variation.
     - There is **no branching lightning arc emitter** in `DarkFantasyVFX.ts`.

2. **Weapon Integration Gaps (`src/core/weapons/AbyssalLightning.ts` & `src/core/weapons/CursedAura.ts`)**:
   - `AbyssalLightning.ts:27-32, 282-288, 301-305`:
     - Implements an internal `activeBolts: ActiveBolt[]` array that dynamically instantiates heap objects via `this.activeBolts.push(...)` and churns memory via `this.activeBolts.splice(i, 1)`.
     - In `createBoltVisual()` (lines 256–288), bolts are straight line-segments jittered along a single perpendicular vector. There are **zero recursive branching forks**, **zero child branches**, and **no cyan-to-purple dissipation timeline**.
   - `CursedAura.ts:169-176, 210-227`:
     - Dynamically pushes pulse rings to `activeRings: ActiveRing[]`.
     - Renders a plain single circle with `ctx.arc(...)`. There are no inscribed occult glyphs, radial rune spokes, or shockwave expansion effects.
   - `main.ts:160-192`:
     - On player level-up (`this.player.progression.onLevelUp(...)`), the game pauses and opens `UpgradeModal`, but does **not** trigger any occult ascension rune or ritual VFX on the ground.

3. **Atmospheric Mist in `GothicBackdrop.ts` (`src/render/GothicBackdrop.ts:335-354, 482-530`)**:
   - **Surface Generation (`createMistSurface`)**:
     - Pre-renders 24 radial gradient circles onto a single `mistCanvas` (1024x540) using `PRECOMPUTED_TRANSLUCENCIES.mistBase` and `mistUpper` (lines 340–353).
   - **Render Pass**:
     - Layer 6 (Background rolling mist, lines 482–504) draws `mistCanvas` at Parallax 0.40 and Parallax 0.65. Sub-layer B applies a rigid vertical translation `Math.sin(elapsedTime * 0.5) * 15` to the entire canvas. This produces a rigid sliding sheet effect rather than organic undulating waves.
     - `renderForegroundMist(ctx, camX, _camY, elapsedTime)` (lines 513–529):
       - Draws `mistCanvas` at Parallax 0.85 across the screen at `y = 0`.
       - **Direct Defect**: `_camY` is marked as unused and completely ignored! When the player moves vertically across the cursed graveyard arena, the foreground mist fails to track vertical camera movement, breaking atmospheric immersion.

4. **Testing Environment & Existing Invariants**:
   - All 24 test suites (285 unit tests) are currently 100% green (`npm test` passes in 3.42s).
   - `tests/unit/DarkFantasyVFX.test.ts` contains 11 baseline tests verifying 500-slot initialization, free/active counts, and dual-layer culling.
   - `tests/unit/ChallengerM2_2.test.ts` (lines 10–148) enforces strict pool invariants:
     - `activeCount + freeCount === 500` across 15,000 cycles.
     - 100% object identity preservation (zero new objects instantiated).
     - Heap growth strictly bounded (< 10MB).
     - Strict 1:1 balance between `ctx.save()` and `ctx.restore()`.

---

## 2. Logic Chain

### 2.1 Overhaul Architecture for `DarkFantasyVFX.ts`

From Observation 1.1 and 1.2, elevating `DarkFantasyVFX` to AAA dark-fantasy visual fidelity requires 4 targeted architectural upgrades while preserving strict $O(1)$ zero-garbage pool invariants:

#### A. Branching Abyssal Lightning Arcs (`LIGHTNING_SEGMENT` / Recursive Subdivided Forks)
1. **Algorithmic Midpoint Displacement with Probabilistic Forking**:
   - Let strike origin be $(x_1, y_1)$ and target impact be $(x_2, y_2)$.
   - Subdivide recursively down to depth $D = 3$:
     - Compute midpoint $(mx, my) = \left(\frac{x_1 + x_2}{2}, \frac{y_1 + y_2}{2}\right)$.
     - Compute perpendicular unit normal: $\hat{n} = \left(-\frac{\Delta y}{L}, \frac{\Delta x}{L}\right)$ where $L = \sqrt{\Delta x^2 + \Delta y^2} \lor 1$.
     - Displace midpoint: $\vec{m}' = \vec{m} + \hat{n} \cdot (\text{random}() - 0.5) \cdot L \cdot 0.35 \cdot (0.75^{\text{depth}})$.
     - At depth 1 and 2, evaluate branch probability $P_{\text{branch}} = 0.40$:
       If triggered, spawn a child fork shooting outward at angle $\theta_{\text{fork}} = \text{atan2}(\Delta y, \Delta x) \pm (25^\circ \dots 40^\circ)$ with length $L_{\text{fork}} = L \cdot (0.45 \dots 0.65)$.
   - Each resulting segment is allocated from the pre-allocated particle pool as a `LIGHTNING_SEGMENT`.
2. **Particle Representation**:
   - `p.type = 'LIGHTNING_SEGMENT'`.
   - `p.x = segX1, p.y = segY1`, `p.vx = segX2 - segX1, p.vy = segY2 - segY1`.
   - `p.size` = line width (trunk: 3.5px, primary fork: 2.2px, secondary fork: 1.4px).
   - `p.extra` = branch level (0 for main trunk, 1 for primary fork, 2 for secondary fork).
   - `p.maxLife` = 0.16s – 0.22s.
3. **Cyan-to-Purple Dissipation Timeline**:
   - Let progress $\tau = \text{life} / \text{maxLife} \in [0, 1]$.
   - $\tau \in [0.0, 0.25]$: Blinding incandescent core (`#ffffff` / `#e6fffa`) enclosed by intense electric cyan corona (`#4fd1c5` / `#38b2ac`, `shadowBlur: 12`, `shadowColor: '#4fd1c5'`).
   - $\tau \in [0.25, 0.65]$: Core transitions into crackling violet current (`#b794f6` / `#9f7aea`).
   - $\tau \in [0.65, 1.0]$: Corona dissipates into faint abyssal purple ether (`rgba(112, 56, 184, alpha)`) with terminal spark motes popping at fork ends.

#### B. Swirling Necrotic Soul Motes (`SOUL_SPARK` / Ethereal Kinematics & Additive Blending)
1. **Multi-Harmonic 2D Sinusoidal Drift**:
   - Replace the simplistic 1D X-oscillation with dual-frequency Lissajous swirl and ethereal buoyancy:
     $$\frac{dx}{dt} = v_x \cdot \text{drag} + A_x \cos(\omega_x \cdot t + \phi) + B_x \sin(2\omega_x \cdot t)$$
     $$\frac{dy}{dt} = v_y \cdot \text{drag} + g_{\text{inv}} + A_y \sin(\omega_y \cdot t + \phi)$$
     where $g_{\text{inv}} = -32\text{ px/s}^2$ (inverted gravity / soul levitation), $\omega_x = 7.5\text{ rad/s}$, $\omega_y = 5.0\text{ rad/s}$, and amplitudes $A_x = 24\text{ px/s}, A_y = 12\text{ px/s}$.
2. **Soft Additive Blending (`lighter`) Pass**:
   - In `renderAir()`, partition luminous particles (`SOUL_SPARK`, `SPELL_TRAIL`, `GEM_GLINT`, `LIGHTNING_SEGMENT`):
     ```typescript
     ctx.save();
     ctx.globalCompositeOperation = 'lighter';
     // Render soft radial halos and glowing white cores
     ctx.restore(); // Automatically restores 'source-over'
     ```
   - Each soul mote renders a soft outer halo (radius $s$, alpha $0.5 \cdot \alpha$, color `#48bb78` or `#9f7aea`) and a blazing inner pinpoint core (radius $0.35 \cdot s$, alpha $\alpha$, color `#f0fff4`). Overlapping motes additively sum into blazing spiritual vortexes.

#### C. Visceral Blood Particles & 3D Tumbling Bone Shards
1. **Enemy Impact vs Catastrophic Death Gore**:
   - *Impact (`emitBloodImpact`)*:
     - Directional spray cone aligned with weapon trajectory: $\theta_{\text{base}} = \text{atan2}(dirY, dirX) \pm 0.35\text{ rad}$.
     - Count: 4–6 high-velocity droplets ($120-220\text{ px/s}$).
     - Elongated droplet rendering: Aligned with velocity vector $\theta = \text{atan2}(v_y, v_x)$, length $L = s \cdot (1 + \text{speed} / 120)$. Rendered as viscous teardrops with arterial crimson `#9b111e` to `#e53e3e`.
   - *Death (`emitDeathGore`)*:
     - Catastrophic 360-degree radial blast: 14–20 blood droplets + 8–12 bone chips + 6 soul motes.
     - Parabolic downward trajectory ($g = 180\text{ px/s}^2$) so droplets splatter toward the ground.
2. **Bone Shard 3D Tumbling Projection**:
   - Fragment archetypes: Splinter slivers, curved rib shards, and irregular vertebra chunks.
   - Tumbling 3D illusion: Modulate horizontal width by cosine of tumble phase:
     $$W(t) = s \cdot |\cos(p.\text{rotation} \cdot 1.8)| + 1.0,\quad H(t) = s \cdot (0.45 + 0.3 \cdot |\sin(p.\text{rotation})|)$$
   - Ground bounce: When shard reaches ground level or progress $> 0.7$, reflect vertical velocity: $v_y = -v_y \cdot 0.35$, simulating bone fragments clattering onto flagstones.

#### D. Occult Glowing Rune Circles (Level-Up Ascension & Sigil Shockwaves)
1. **Level-Up Occult Ascension Seal (`emitLevelUpRune(x, y)` / `SPELL_CIRCLE` with mode)**:
   - Centered on the player during level-up pauses ($R = 72\text{px}$, duration $2.4\text{s}$).
   - 4-tiered sacred ceremonial geometry:
     - *Tier 1*: Outer binding ring with 12 radial archaic rune hashes along perimeter.
     - *Tier 2*: Clockwise rotating ring ($\omega = +1.2\text{ rad/s}$) carrying 8 runic node medallions.
     - *Tier 3*: Counter-clockwise rotating inner heptagram ($\omega = -1.6\text{ rad/s}$) with illuminated celestial intersections.
     - *Tier 4*: Central pulsing eye of the void breathing with $r = 14 + 4\sin(t \cdot 7)$.
   - Emits an ascending ethereal ring of 12 rising soul motes spiraling upwards from the circle perimeter.
2. **Ultimate / Sigil Activation Shockwave (`emitSigilShockwave(x, y, maxRadius)` / `emitUltimateRune`)**:
   - Rapid explosive expansion: $r(t) = r_{\max} \cdot \left(1 - (1 - \tau)^3\right)$ where $\tau = t / 0.35$.
   - Heavy outer shockwave ring ($4\text{px}$ stroke) in blinding cyan/crimson with blooming glow (`shadowBlur: 14`).
   - 8-directional occult spikes projecting outward from the perimeter.
   - Spawns a ring of crackling electric sparks along the expanding circumference.

---

### 2.2 Atmospheric Depth Mist Architecture in `GothicBackdrop.ts`

From Observation 1.3, mist must provide genuine 3D volumetric depth and multi-frequency undulation:

1. **3-Layer Depth Mist Separation**:
   - **Layer 1: Low Creeping Graveyard Ground Mist (Midground, Parallax 0.40)**:
     - Hugs the flagstones and tombstones below horde entities.
     - Slow horizontal drift: $V_x = +18\text{ px/s}$.
     - Base opacity $\alpha = 0.20$.
   - **Layer 2: Undulating Graveyard Midground Mist (Mid-to-Fore, Parallax 0.65)**:
     - Weaves between horde entities and player with counter-current drift: $V_x = -26\text{ px/s}$.
     - True vertical multi-harmonic undulation:
       $$Y_{\text{undulate}}(x, t) = 14 \cdot \sin(0.0035 x + 1.2 t) + 8 \cdot \cos(0.007 x - 0.7 t)$$
     - Sliced strip blitting (10–12 vertical strips of width $96\text{px}$) ensures undulating displacement at $< 0.10\text{ms}$ execution cost.
   - **Layer 3: Cinematic Foreground Depth Mist (Foreground, Parallax 1.15)**:
     - Rendered in `renderForegroundMist()` after all entities and particles.
     - Full 2D camera tracking:
       $$\text{startX} = -((((camX \cdot 1.15 + t \cdot 38.0) \pmod W) + W) \pmod W)$$
       $$\text{startY} = -((((camY \cdot 0.35 + 10 \cdot \sin(t \cdot 0.6)) \pmod H) + H) \pmod H)$$
     - Solves the $camY$ defect. Soft billows ($\alpha = 0.08$) provide optical depth without obscuring combat.

2. **360-Degree Seamless Wrapping Guarantee**:
   - Loop bounds evaluated across `x < vw + W` and `y < vh + H` guarantee zero gaps across any camera coordinate $[-10000, 10000]$.

---

### 2.3 Comprehensive Vitest Test Suite Architecture (`tests/unit/DarkFantasyVFX.spec.ts`)

To ensure complete verification, `tests/unit/DarkFantasyVFX.spec.ts` must be structured into 8 exhaustive test suites:

| Suite | Focus Area | Key Assertions & Thresholds |
| :--- | :--- | :--- |
| **Suite 1** | **Pool Pre-allocation & Invariants** | Strict count conservation (`active + free === capacity`), 25,000 churn cycles, 100% object identity preservation (0 heap allocations). |
| **Suite 2** | **Saturation & FIFO Cycling** | 200% burst load clamping, safe oldest particle displacement, zero array growth. |
| **Suite 3** | **Decal Cycling & Alpha Decay** | Bounded ring buffer, monotonic alpha decay ($\alpha \ge 0$, no negative underflow), off-screen frustum culling. |
| **Suite 4** | **Branching Abyssal Lightning** | Jagged recursive subdivision, branch length/width scaling, cyan-to-purple dissipation timeline, terminal spark generation. |
| **Suite 5** | **Swirling Soul Motes & Additive Blending** | 2D multi-harmonic sinusoidal drift, upward ethereal lift ($vy < 0$), `globalCompositeOperation = 'lighter'`, strict restoration to `'source-over'`. |
| **Suite 6** | **Impact & Death Gore System** | Directional elongated blood spray on impact vs 360-degree burst on death, 3D bone tumbling illusion ($|\cos(\text{rot})|$), ground bounce. |
| **Suite 7** | **Occult Runes (Level-Up & Sigil)** | Multi-tiered level-up seal with counter-rotating geometry, expanding sigil shockwave with radial spikes, viewport culling. |
| **Suite 8** | **Numerical Hygiene & State Hygiene** | Zero NaNs across extreme fuzzing ($dt = 0, dt = 10$, negative coords, zero normals), 1:1 `save`/`restore` balance, zero shadow leaks. |

---

## 3. Caveats

1. **Particle Pool Capacity Backward Compatibility**:
   - Existing tests (`DarkFantasyVFX.test.ts` and `ChallengerM2_2.test.ts`) instantiate `new DarkFantasyVFX(500)` and assert `capacity === 500`.
   - The constructor **must** continue to accept `capacity: number = 500` as default, allowing `main.ts` or higher-capacity environments to pass `1000` while keeping all legacy tests green.
2. **Canvas Composite State Leaks**:
   - Using `ctx.globalCompositeOperation = 'lighter'` for soul motes and lightning must be wrapped inside `ctx.save()` / `ctx.restore()` or explicitly reset to `'source-over'`. Failure to reset would cause HUD or entity rendering to bleed additively.
3. **Decal System Coordination with Peer Agent (explorer_m3_2)**:
   - `explorer_m3_2` is focusing on the ground decal system (blood pools, blast marks).
   - `DarkFantasyVFX` should provide clean ground particle hooks (`SPELL_CIRCLE`, ground blood droplets, scorch markers) that seamlessly interface with or complement the dedicated decal manager without duplicate rendering passes.
4. **Headless / Node.js Mock Fidelity**:
   - In headless test runs (`vitest`), Canvas 2D is mocked via stub objects. All drawing routines in `DarkFantasyVFX.ts` and `GothicBackdrop.ts` must safely execute without crashing when gradient or composite methods return stub objects.

---

## 4. Conclusion & Concrete Code Specifications

### 4.1 Proposed Upgraded `DarkFantasyVFX.ts` Interface & Implementation Blueprint

The following complete TypeScript specification defines the exact signatures, algorithms, and rendering passes to be implemented in `src/render/vfx/DarkFantasyVFX.ts`:

```typescript
export type ParticleType =
  | 'BLOOD_DROPLET'
  | 'BONE_CHIP'
  | 'SOUL_SPARK'
  | 'GHOUL_BILE'
  | 'SPELL_TRAIL'
  | 'SPELL_CIRCLE'
  | 'GEM_GLINT'
  | 'LIGHTNING_SEGMENT'
  | 'OCCULT_SEAL';

export interface Particle {
  id: number;
  active: boolean;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravity: number;
  life: number;
  maxLife: number;
  startSize: number;
  endSize: number;
  size: number;
  color: string;
  startAlpha: number;
  endAlpha: number;
  alpha: number;
  rotation: number;
  vRot: number;
  extra: number; // Fork level for lightning, archetype for bone, mode for rune
}
```

#### Emitter Enhancements:
1. **`emitLightningArc(x1, y1, x2, y2, isEvolution = false, color?: string)`**:
   - Executes recursive midpoint subdivision up to depth 3 with 35% fork probability.
   - Allocates `LIGHTNING_SEGMENT` particles storing `vx = x2 - x1, vy = y2 - y1`.
   - Core glow rendered with white core + cyan/violet corona.
2. **`emitSoulBurst(x, y, gemType, count = 6, swirlSpeed = 1.0)`**:
   - Initializes motes with randomized orbital phases `extra = Math.random() * Math.PI * 2`.
   - `update(dt)` applies multi-harmonic drift:
     ```typescript
     p.vx += (Math.cos(p.life * 7.5 + p.extra) * 24.0 - p.vx * 0.1) * dt;
     p.vy += (Math.sin(p.life * 5.0 + p.extra) * 12.0 - 32.0) * dt;
     ```
3. **`emitBloodImpact(x, y, dirX, dirY, count = 4)` vs `emitDeathGore(x, y, gemType)`**:
   - `emitBloodImpact`: Directional spray along $(\text{dirX}, \text{dirY})$, high drag ($0.88$), elongated teardrop rendering.
   - `emitDeathGore`: Full 360-degree visceral blast combining arterial blood droplets, tumbling bone chips (using 3 distinct geometric archetypes), and rising soul sparks.
4. **`emitLevelUpRune(x, y, radius = 72, duration = 2.4)` & `emitSigilShockwave(x, y, maxRadius = 180)`**:
   - `emitLevelUpRune`: Spawns multi-tier ceremonial occult seal with dual counter-rotating geometry and spiraling ascending perimeter sparks.
   - `emitSigilShockwave`: Spawns rapidly expanding shockwave ring ($10\text{px} \to 180\text{px}$) with radial spikes and crackling electric perimeter sparks.

#### Render Hygiene:
- `renderGround`: Renders `SPELL_CIRCLE` and `OCCULT_SEAL` with balanced `save()`/`restore()`.
- `renderAir`: Renders flying gore and groups luminous particles (`SOUL_SPARK`, `LIGHTNING_SEGMENT`, `SPELL_TRAIL`, `GEM_GLINT`) within an additive `ctx.globalCompositeOperation = 'lighter'` block, strictly resetting to `'source-over'`.

---

### 4.2 Proposed Upgraded `GothicBackdrop.ts` Mist Pipeline

1. **Undulating Midground Mist**:
   ```typescript
   // Sub-layer B (Mid swirling undulating mist)
   const sliceCount = 10;
   const sliceW = vw / sliceCount;
   for (let s = 0; s < sliceCount; s++) {
     const sliceWorldX = camX * 0.65 + s * sliceW;
     const undulationY = 14 * Math.sin(sliceWorldX * 0.0035 + elapsedTime * 1.2) +
                         8 * Math.cos(sliceWorldX * 0.007 - elapsedTime * 0.7);
     const startX = -((((sliceWorldX - elapsedTime * 26.0) % W) + W) % W);
     const startY = -((((camY * 0.65 + undulationY) % H) + H) % H);
     ctx.drawImage(this.mistCanvas, s * (W / sliceCount), 0, W / sliceCount, H,
                   s * sliceW, startY, sliceW, vh);
   }
   ```
2. **Foreground Mist Vertical Camera Tracking**:
   ```typescript
   public renderForegroundMist(ctx: CanvasRenderingContext2D, camX: number, camY: number, elapsedTime: number): void {
     if (!this.mistCanvas || !this.enableMist) return;
     ctx.save();
     const vw = this.viewportWidth;
     const vh = this.viewportHeight;
     const W = 1024;
     const H = 540;
     const startX = -((((camX * 1.15 + elapsedTime * 38.0) % W) + W) % W);
     const startY = -((((camY * 0.35 + Math.sin(elapsedTime * 0.6) * 10) % H) + H) % H);
     ctx.globalAlpha = 0.08;
     for (let x = startX; x < vw + W; x += W) {
       for (let y = startY; y < vh + H; y += H) {
         ctx.drawImage(this.mistCanvas, x, y);
       }
     }
     ctx.restore();
   }
   ```

---

### 4.3 Proposed Full Specification Test Suite: `tests/unit/DarkFantasyVFX.spec.ts`

The specification test file will contain 8 comprehensive suites (over 25 rigorous unit tests) utilizing a full operation-tracing mock Canvas context:
- Suite 1: Pool Pre-allocation, Zero-Garbage Lifecycles & Saturation Invariants (25,000 cycles, 0 allocations).
- Suite 2: Decal Cycling & Persistent Ground State Lifecycle.
- Suite 3: Branching Abyssal Lightning & Dissipation Timeline.
- Suite 4: Swirling Necrotic Soul Motes & Additive Blending Hygiene.
- Suite 5: Bone Fragments, Visceral Gore & Impact/Death Differentiation.
- Suite 6: Occult Glowing Rune Circles (Level-Up & Sigil Shockwaves).
- Suite 7: Numerical Hygiene & Zero NaN / Infinity Fuzzing Harness.
- Suite 8: Canvas Composite Hygiene & 60Hz Frame Execution Budget (< 1.5ms).

---

## 5. Verification Method

To independently verify all findings and validate future implementations:

1. **Unit Test Execution**:
   ```bash
   npm test
   ```
   Ensures all 24 test suites (285 tests) continue to pass 100% green without regressions.
2. **Dedicated VFX Specification Run**:
   ```bash
   npx vitest run tests/unit/DarkFantasyVFX.test.ts
   ```
   And once implemented:
   ```bash
   npx vitest run tests/unit/DarkFantasyVFX.spec.ts
   ```
3. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   Confirms strict type safety across all particle type additions and interface signatures.
4. **Invalidation Conditions**:
   - If `activeCount + freeCount !== capacity` at any frame, the pooling invariant is broken.
   - If any particle field contains `NaN`, `Infinity`, or `undefined`, the numerical hygiene test must fail.
   - If `ctx.globalCompositeOperation` is not `'source-over'` after rendering, the composite cleanup test must fail.
   - If foreground mist does not track vertical camera motion, the backdrop parity test must fail.

