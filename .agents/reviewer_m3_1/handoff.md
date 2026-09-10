# Handoff Report — Milestone 3 Review & Adversarial Audit

**Agent ID**: reviewer_m3_1  
**Role**: High-Reliability Reviewer & Adversarial Critic  
**Parent Agent ID**: 16d4f03a-b906-4dcd-a7c3-e24f1752216b  
**Date**: 2026-09-11  
**Project**: Grim Harvest: Undead Siege (`metal_slug_web`)  
**Verdict**: **APPROVE**

---

## 1. Observation

### Codebase & Implementation Inspection
1. **Dynamic Radial Lighting & Additive Bloom**:
   - `src/render/vfx/DarkFantasyVFX.ts` (lines 1496–1855):
     - `DynamicLightingEngine` pre-allocates a 960x540 offscreen buffer (`lightCanvas`, `vignetteCanvas`) and pre-baked radial stencils (`torchStencilCanvas` 512x512, `spellStencilCanvas` 256x256, `pointStencilCanvas` 128x128) via `initSurfaces()` (lines 1515–1569).
     - Carving pass (lines 1592–1741): Fills ambient darkness (`rgba(8, 6, 12, curAmbient)` with `lightningFlash` flash attenuation), blits pre-baked vignette, switches to `globalCompositeOperation = 'destination-out'`, and carves:
       - Warm amber player torch light (200px radial light with multi-frequency breathing flicker `5.0 * Math.sin(t * 7.3) + 2.5 * Math.cos(t * 19.1) + 1.5 * Math.sin(t * 31.7)` and `player.stats.area` scaling).
       - Arcane Scythe arc illumination (`slash.radius * 1.25`, life fade).
       - Abyssal lightning point lights.
       - Expanding crimson shockwaves for Cursed Aura.
       - Perimeter lights for Soul Orbiters.
       - Shimmer lights for high-tier loot gems.
     - Blits carved mask to main canvas via `source-over` (lines 1737–1740).
     - Additive Bloom pass (lines 1743–1854): Sets `globalCompositeOperation = 'lighter'` on main canvas and renders warm amber torch bloom (`rgba(245, 158, 11, ...)`, `#f59e0b`), scythe violet/crimson bloom, lightning cyan/white incandescent core bloom, and cursed aura shockwave ring.
     - Strictly restores `globalCompositeOperation = 'source-over'` at line 1852.

2. **Pre-Entity Contact Drop Shadows**:
   - `src/render/vfx/DarkFantasyVFX.ts` (lines 1288–1446):
     - `renderContactDropShadows()` renders grounded elliptical shadows beneath all entities:
       - Player: `(18x7)` shadow with `rgba(0, 0, 0, 0.45)` at `player.position.y + 16`.
       - Skeleton: `(14x5)` shadow at `ey + 14`.
       - Ghoul: `(16x6)` shadow at `ey + 14`.
       - Death Knight: `(24x9)` shadow at `ey + 22`.
       - Banshee: Floating diffuse shadow at `ey + 18`, dynamically modulated with vertical bobbing `yBob = Math.sin(elapsedTime * 3.0) * 3.0`, scaling radius `1.0 + yBob * 0.05` and fading opacity `clamp(0.30 - yBob * 0.04)`.
       - Soul Gems: Grounded elliptical shadow at `gy = item.position.y - camY + 8` (floor level), allowing gem sprite to bob vertically without detaching its ground shadow.
     - Robust fallback paths when `ctx.ellipse` is unavailable (lines 1333–1337, 1358–1363, 1401–1406, 1435–1440).
     - Frustum culling against camera viewport bounds.

3. **Ground Decal System**:
   - `src/render/vfx/DarkFantasyVFX.ts` (lines 85–90, 136–154, 244–309, 356–393, 911–1022):
     - Pre-allocated 500-slot circular ring buffer (`this.decals = new Array(500)`).
     - Circular advancing: `decalHead = (decalHead + 1) % this.decalCapacity`.
     - 4 archetypes supported:
       - `BLOOD_SPLATTER`: radius 4–8, crimson color, 12.0s maxLife, 0.85 alpha, satellite micro-droplets.
       - `BLOOD_POOL`: radius 12–18, coagulated crimson with bright core, 15.0s maxLife, 0.90 alpha.
       - `LIGHTNING_SCORCH`: radius 18–24, dark core with 6 radial fracture spokes and fresh cyan glow (life < 1.0s), 10.0s maxLife.
       - `SIGIL_SCORCH`: radius 28–36, concentric etched rings and 4 radial ticks, 12.0s maxLife.
     - Multi-stage organic decay: Full opacity hold for initial 60% of lifespan (e.g. 10.0s for pool, 6.0s for lightning scorch, 7.0s for sigil scorch, 8.0s for splatter), followed by smooth linear fade over the remaining 4–5s.
     - Frustum culling in `renderDecals()`.

4. **Arcane Particle Effects**:
   - `src/render/vfx/DarkFantasyVFX.ts` (lines 400–892, 1024–1286):
     - 500-slot pre-allocated particle pool with O(1) swap-and-pop free list and FIFO oldest displacement under saturation (lines 168–198).
     - **Branching Abyssal Lightning**: Midpoint displacement recursive subdivider (depth=3, lines 733–793) with perpendicular jitter, electric corona, bright white core, full-screen flash trigger, and automatic scorch decal stamping.
     - **Swirling Necrotic Soul Motes**: Multi-harmonic 2D sinusoidal drift (`vx += (cos(life*7.5 + extra)*24.0 - vx*0.1)*dt`, `vy += (sin(life*5.0 + extra)*12.0 - 32.0)*dt`, inverted gravity `gravity = -32`), additive lighter halo + white core.
     - **Bone Fragments**: 3D cosine tumble illusion (`tumbleW = max(1, s * (|cos(rot * 1.8)| * 0.85 + 0.3))`), 3 distinct archetypes (splinter, rib, vertebra with marrow), and ground bounce (`vy = -vy * 0.35`).
     - **Death Gore**: Coordinated gore burst combining blood droplets, bone fragments, soul sparks, and ground blood pool.
     - **Occult Runes**: Ceremonial ascension seal on level-up with dual counter-rotating hexagram rings, pulsing void eye core, and 12 rising soul motes; expanding crimson shockwave for sigils.

5. **Atmospheric Mist**:
   - `src/render/GothicBackdrop.ts` (lines 482–507, 513–551):
     - Sub-layer A (Lower ground creeping mist at Parallax 0.40).
     - Sub-layer B (Mid swirling mist at Parallax 0.65 with multi-harmonic sinusoidal undulation `14*sin(...) + 8*cos(...)`).
     - Cinematic Foreground Depth Mist in `renderForegroundMist` (Parallax 1.15).

6. **Visual Layer Ordering in `src/main.ts`**:
   - Lines 507–586 strictly enforce depth hierarchy:
     1. Backdrop (`backdrop.render()`)
     2. Ground VFX & Decals (`vfx.renderDecals()`, `vfx.renderGround()`)
     3. Pre-Entity Contact Drop Shadows (`vfx.renderContactDropShadows()`)
     4. Loot Items (`DarkFantasySprites.drawLoot()`)
     5. Horde Enemies (`DarkFantasySprites.drawEnemy()`)
     6. Player Sorcerer (`DarkFantasySprites.drawPlayer()`)
     7. Occult Weapon Effects (`weaponManager.render()`)
     8. Air VFX (`vfx.renderAir()`)
     9. Foreground Atmospheric Mist (`backdrop.renderForegroundMist()`)
     10. Dynamic Radial Lighting & Additive Bloom (`vfx.lighting.render()`)
     11. Gothic HUD Overlay (`hud.render()`)
     12. Upgrade Modal Overlay (`upgradeModal.render()`)

7. **Verification Tool Outputs**:
   - `npx vitest run tests/unit/DarkFantasyVFX.spec.ts`:
     ```
     Test Files  1 passed (1)
          Tests  34 passed (34)
       Duration  492ms
     ```
   - `npm test`:
     ```
     Test Files  25 passed (25)
          Tests  319 passed (319)
       Duration  4.71s
     ```
   - `npx tsc --noEmit`:
     ```
     Exit code: 0 (0 errors)
     ```
   - `npm run build`:
     ```
     vite v6.4.3 building for production...
     ✓ 34 modules transformed.
     ✓ built in 449ms
     ```

---

## 2. Logic Chain

1. **Dual-Pass Offscreen Lighting Architecture**: Rendering radial darkness and additive bloom directly on the main canvas causes color clipping, blend mode bleed, and excessive draw calls. By pre-allocating an offscreen 960x540 buffer with pre-baked stencils, carving lights via `destination-out`, blitting the darkness mask once via `source-over`, and following with a secondary `lighter` additive bloom pass, the system achieves vibrant illumination with zero dynamic allocations and strict composite hygiene.
2. **Visual Grounding via Contact Drop Shadows**: Floating sprites on flat flagstone surfaces lack depth. Rendering grounded elliptical contact shadows beneath every entity prior to drawing the sprites—with height-modulated diffuse scaling for Banshees and fixed floor grounding for floating Soul Gems—creates a convincing 3D spatial grounding.
3. **Bounded Memory & Zero Garbage**: Dynamic particle and decal creation in 60Hz frame loops generates garbage collection stalls. Pre-allocating a 500-slot particle pool with swap-and-pop free list and FIFO displacement, along with a 500-slot circular ring buffer for decals, ensures zero heap allocations during gameplay.
4. **Numerical Hygiene & Robust Fallbacks**: Division by zero on coincident coordinates or zero-length direction vectors is guarded via `len || 1` and `Math.max(dist, 1e-6)`. Tests confirm that extreme $dt \in \{0, 10, -1\}$ produce zero NaNs or Infinities. Robust fallbacks exist for headless environments without DOM canvas support and for contexts lacking native `ctx.ellipse`.
5. **Integrity & Authenticity**: Thorough inspection of `src/render/vfx/DarkFantasyVFX.ts`, `src/render/GothicBackdrop.ts`, `src/main.ts`, and `tests/unit/DarkFantasyVFX.spec.ts` confirms that all features are implemented with genuine algorithmic logic (recursive midpoint displacement, sinusoidal physics, circular buffers, dual-pass canvas operations) and zero hardcoded test facades, dummy mocks, or shortcuts.

---

## 3. Caveats

1. **Headless Environment Canvas Fallback**: When run under Node.js test runners where `document.createElement('canvas')` is unavailable, `safeCreateOffscreenCanvas` returns `null` and the lighting pass gracefully falls back to direct radial gradients or mocks. Full offscreen buffer testing was validated using mock contexts with comprehensive spy assertions.
2. **Parallel CPU Contention During Full Test Suite**: In test suites with heavy numerical benchmark loops (such as 1,200 enemies at 60Hz), high parallel thread contention across 25 simultaneous test files can cause minor transient scheduling jitter. When executed individually, benchmarks pass with overwhelming margin (e.g. 1.09ms vs 8.0ms threshold).

---

## 4. Conclusion

The implementation of Milestone 3 (**Dynamic Lighting, Rich VFX & Atmospheric Polish**) is exceptionally well-engineered, robust, and completely satisfies all functional and architectural specifications:
- Dynamic Radial Lighting with dual-pass offscreen buffer (`destination-out` + `lighter`), warm amber player torch flicker, and dynamic spell flashes is fully verified.
- Contact Drop Shadows for Player (18x7), Skeletons (14x5), Ghouls (16x6), Death Knights (24x9), Banshees (height-modulated diffuse), and Soul Gems (floor-grounded) are operational.
- Ground Decal 500-slot circular ring buffer supports all 4 archetypes with organic 10–15s multi-stage decay.
- Arcane particles (branching abyssal lightning with midpoint displacement, swirling necrotic soul motes, bone fragments with 3D tumble and bounce, occult seals) are verified.
- 3-layer atmospheric mist in `GothicBackdrop.ts` (0.40, 0.65, 1.15 parallax) creates immersive depth.
- Visual layer ordering in `src/main.ts` is strictly compliant.
- All 34 tests in `DarkFantasyVFX.spec.ts` pass, all 319 unit tests across 25 suites pass, `npx tsc --noEmit` reports 0 errors, and `npm run build` succeeds cleanly.
- Zero integrity violations detected.

**Verdict**: **APPROVE**

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Verify DarkFantasyVFX Specification Suite**:
   ```bash
   npx vitest run tests/unit/DarkFantasyVFX.spec.ts
   ```
   *Verification condition*: 34 passed out of 34 tests.

2. **Verify Full Project Test Suite**:
   ```bash
   npm test
   ```
   *Verification condition*: 25 test files passed, 319 passed out of 319 tests.

3. **Verify TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   *Verification condition*: Exit code 0, 0 type errors.

4. **Verify Production Bundle Build**:
   ```bash
   npm run build
   ```
   *Verification condition*: Exit code 0, production bundle created in `dist/`.
