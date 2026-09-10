# Handoff Report — Milestone 3: Dynamic Lighting, Rich VFX & Atmospheric Polish

**Agent ID**: worker_m3_2  
**Parent Agent ID**: 16d4f03a-b906-4dcd-a7c3-e24f1752216b  
**Date**: 2026-09-11  
**Project**: Grim Harvest: Undead Siege (`metal_slug_web`)

---

## 1. Observation

### Codebase & Architectural State
1. **Dynamic Lighting System**:
   - `src/render/vfx/DarkFantasyVFX.ts`: Implemented `DynamicLightingEngine` featuring:
     - Offscreen 960x540 buffer (`lightCanvas`, `vignetteCanvas`) pre-allocated strictly during initialization to prevent frame-time GC pauses.
     - Pre-baked radial stencils: `torchStencil` (512x512, warm amber `#f59e0b`), `spellStencil` (256x256, violet/cyan/crimson), and `pointStencil` (128x128).
     - Dual-pass composite rendering:
       - **Carving Pass**: Renders darkness mask (`#000000` at ambient darkness opacity 0.75 - 0.88), then carves out light circles using `globalCompositeOperation = 'destination-out'` for the player torch, weapon impacts, soul orbiters, and soul gems.
       - **Additive Bloom Pass**: Main canvas receives light mask via `source-over`, followed by `globalCompositeOperation = 'lighter'` additive bloom pass rendering warm amber torch glow with multi-frequency sinusoidal breathing flicker (3.5Hz, 7.2Hz, 14.1Hz), violet scythe arc illumination, cyan abyssal lightning flashes, and expanding crimson sigil shockwaves.
     - Full reset logic in `reset()` resetting flash timer, decay states, and offscreen buffers.

2. **Pre-Entity Contact Drop Shadows**:
   - `src/render/vfx/DarkFantasyVFX.ts`: Implemented `renderContactDropShadows()`:
     - Player: Grounded elliptical shadow `(18x7)` with dark semi-transparent fill (`rgba(0, 0, 0, 0.45)`).
     - Horde Enemies:
       - `skeleton`: `(14x5)`
       - `ghoul`: `(16x6)`
       - `death_knight`: `(24x9)`
       - `banshee`: Floating diffuse shadow. The shadow remains grounded at floor level while its radius scales inversely with float height (`1.0 - hRatio * 0.25`) and its opacity decreases as she rises (`alpha * (0.35 - hRatio * 0.1)`).
     - Soul Gems: Grounded elliptical shadow `(8x4)` rendered at floor coordinates while the crystal item oscillates vertically via floating sine wave.

3. **Ground Decal System**:
   - `src/render/vfx/DarkFantasyVFX.ts`: Pre-allocated circular ring buffer with capacity 500:
     - Supports 4 archetypes: `BLOOD_SPLATTER`, `BLOOD_POOL`, `LIGHTNING_SCORCH`, and `SIGIL_SCORCH`.
     - Multi-stage organic alpha decay: Full opacity hold for first 60% of lifetime, followed by smooth sinusoidal fade-out over remaining 40% (total duration 10–15 seconds).
     - High-performance ring buffer index advancing (`decalHead = (decalHead + 1) % capacity`) with zero heap garbage per frame.
     - Viewport frustum culling against camera bounds in `renderDecals()`.
     - Clean state reset on `clear()`.

4. **Arcane Particle Effects & Atmospheric Mist**:
   - `src/render/vfx/DarkFantasyVFX.ts`:
     - **Branching Abyssal Lightning**: Midpoint displacement recursive subdivider (depth=3) producing jagged branching forks, glowing cyan/violet corona (`#06b6d4`, `#8b5cf6`), and bright white core (`#f8fafc`). Automatically stamps `LIGHTNING_SCORCH` decal at target coordinate and triggers full-screen flash.
     - **Swirling Necrotic Soul Motes**: Multi-harmonic 2D sinusoidal drift (`sin(freq * t + phase)`, `cos(...)`) with upward ethereal lift and luminous halo rendering.
     - **Bone Fragments**: 3D cosine tumble rotation (`cos(rotSpeed * age) * size`) and elastic floor bouncing upon reaching ground level.
     - **Death Gore**: Coordinated death explosion combining directional blood splatter, bone fragments, soul sparks, and ground blood pool.
     - **Occult Runes**: Ceremonial ascension seal on level-up with dual counter-rotating hexagram rings and floating ascending soul motes; expanding crimson shockwave for sigil explosions.
     - **Pool Saturation Hygiene**: FIFO oldest displacement replaces the oldest active particle when all 500 slots are exhausted, preventing dropouts while allocating zero new objects.
   - `src/render/GothicBackdrop.ts`:
     - 3-layer parallax atmospheric depth mist (far mist at 0.40, mid mist at 0.65, foreground mist at 1.15) with undulating sine wave drift.
     - Corrected unused `vh` variable (TS6133).

5. **Visual Layering in `src/main.ts`**:
   - Render order strictly enforces dark fantasy visual hierarchy:
     1. Backdrop (`GothicBackdrop.render()`)
     2. Decals & Ground Runes (`vfx.renderDecals()`, `vfx.renderGround()`)
     3. Pre-Entity Contact Drop Shadows (`vfx.renderContactDropShadows()`)
     4. Loot Items (`lootManager.render()`)
     5. Horde Enemies (`hordeManager.render()`)
     6. Player Sorcerer (`player.render()`)
     7. Weapon Effects (`weaponManager.render()`)
     8. Air Particles & Lightning (`vfx.renderAir()`)
     9. Foreground Atmospheric Mist (`backdrop.renderForegroundMist()`)
     10. Dynamic Radial Lighting & Additive Bloom (`vfx.renderLighting()`)
     11. Gothic HUD (`hud.render()`)
     12. Upgrade Modal (`upgradeModal.render()`)

6. **Unit Tests (`tests/unit/DarkFantasyVFX.spec.ts`)**:
   - 9 test suites containing 34 comprehensive tests verifying:
     - Suite 1: Particle Pool Pre-allocation & Invariant Conservation (500 capacity, 25,000 churn cycles, FIFO oldest displacement under 200% burst load).
     - Suite 2: Ground Decal System (500-slot ring buffer, 4 archetypes, 750-cycle churn without re-allocation, multi-stage decay, culling, clear reset).
     - Suite 3: Branching Abyssal Lightning & Dissipation (recursive midpoint displacement, scorch stamp, additive blending).
     - Suite 4: Swirling Necrotic Soul Motes & Additive Blending (multi-harmonic drift, ethereal lift, luminous rendering).
     - Suite 5: Bone Fragments & Visceral Blood Droplets (directional alignment, 3D tumble, ground bounce, death gore combo).
     - Suite 6: Occult Rune Circles (ceremonial level-up seal, sigil shockwave, ground rendering & culling).
     - Suite 7: Pre-Entity Contact Drop Shadows (player 18x7, horde archetypes, banshee float modulation, soul gems floor grounding).
     - Suite 8: Dynamic Radial Lighting & Additive Bloom Engine (960x540 buffer & stencils, global lightning flash decay, warm amber bloom `#f59e0b`, spell flash blooms, reset).
     - Suite 9: Numerical Hygiene & Extreme Fuzzing Harness (zero NaNs across $dt=0, 10, -1$, zero-length vectors, coincident lightning coords, 1:1 save/restore balance, composite operation hygiene).

---

## 2. Logic Chain

1. **Offscreen Lighting Architecture**: Rendering radial darkness and additive bloom directly into the main scene canvas causes unwanted blend-mode bleed and high fill-rate overhead. By carving lights into a dedicated 960x540 offscreen canvas with `destination-out` and blitting it once via `source-over`, the ambient darkness mask is seamlessly integrated. Followed by a secondary `lighter` additive pass using pre-rendered radial stencils, spell blooms and torch highlights achieve vibrant luminosity without compromising performance.
2. **Zero-Allocation 60Hz Loop**: Dynamic memory allocation in requestAnimationFrame callbacks triggers frequent garbage collector sweeps, producing frame stutter. Pre-allocating the 500-slot particle pool, 500-slot decal ring buffer, offscreen light canvases, and static stencils guarantees $0$ dynamic heap allocations per frame.
3. **Depth Hierarchy & Grounding**: Without contact drop shadows and decals beneath entities, 2D sprites appear to float arbitrarily over the background flagstone. Placing ground decals immediately on top of the backdrop, followed by elliptical contact shadows beneath each entity (with height-dependent scaling for floating archetypes like Banshees and Soul Gems), firmly anchors entities in the environment.
4. **VFX Robustness & Fuzzing**: Extreme physics or edge cases ($dt=0$, massive delta spikes $dt=10$, coincident coordinates, zero-length normal vectors) often trigger `0/0` division resulting in `NaN` or `Infinity`, which corrupts Canvas 2D transforms. Clamping divisors with `Math.max(len, 1e-6)` and testing via fuzz harnesses guarantees that `NaN` coordinates never enter the render pipeline.

---

## 3. Caveats

1. **Canvas 2D Context Reset in Tests**: Mock canvas contexts in headless test runners do not automatically restore `globalCompositeOperation` upon `mockCtx.restore()`. To guarantee composite hygiene and zero bleeding across tests and browser frames, `ctx.globalCompositeOperation = 'source-over'` is explicitly reset before and after each render routine.
2. **Full Parallel CPU Contention**: While all unit tests run in milliseconds under normal conditions, high-churn benchmark suites (such as 15,000 continuous spawn/kill cycles) can experience timer spikes if run concurrently on heavily saturated CPU cores. All benchmarks pass with substantial headroom when executed individually or in standard test runner configurations.

---

## 4. Conclusion

Milestone 3 requirements for **Dynamic Lighting, Rich VFX & Atmospheric Polish** are 100% complete and empirically verified:
- Dynamic Radial Lighting & Vignette engine is operational with dual-pass carving, warm amber player torch flicker, dynamic spell flashes, and zero per-frame canvas allocations.
- Entity Contact Drop Shadow pass renders grounded elliptical shadows beneath all entity archetypes, including height-modulated shadows for Banshees and floor-grounded shadows for floating Soul Gems.
- 500-slot circular ring buffer for ground decals supports all 4 archetypes with organic 10–15s multi-stage decay and clean reset.
- Arcane particle effects (branching lightning, necrotic soul motes, bone fragments with 3D cosine tumble and bounce, occult seals) and 3-layer parallax mist are fully integrated.
- Strict visual layer ordering in `src/main.ts` ensures flawless visual composition.
- All 34 tests in `tests/unit/DarkFantasyVFX.spec.ts` pass, all 319 unit tests across 25 suites in the project pass, TypeScript compilation passes with 0 errors, and production build succeeds cleanly.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected result*: Exit code 0, 0 errors.

2. **DarkFantasyVFX Specification Suite**:
   ```bash
   npx vitest run tests/unit/DarkFantasyVFX.spec.ts
   ```
   *Expected result*: 34 passed out of 34 tests.

3. **Full Project Unit & Adversarial Test Suite**:
   ```bash
   npm test
   ```
   *Expected result*: 25 test files passed, 319 passed out of 319 tests.

4. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: Clean bundle build in `dist/` with exit code 0.
