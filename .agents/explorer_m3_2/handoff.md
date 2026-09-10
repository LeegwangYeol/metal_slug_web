# Milestone 3 Investigation Report: Entity Contact Drop Shadows & Ground Decal System

- **Author**: `explorer_m3_2` (Codebase Researcher / Explorer)
- **Date**: 2026-09-10T16:15:00Z
- **Target Systems**: Entity Contact Drop Shadows & Ground Decal System for "Grim Harvest: Undead Siege"
- **Status**: COMPLETE (Investigation & Architecture Formulation)

---

## 1. Observation

### 1.1 Existing Render Pipeline & Shadow State
1. **`src/main.ts:505-545`**:
   The current rendering sequence in `GrimHarvestGame.render()` executes in the following order:
   - Line 506: `this.backdrop.render(ctx, camX, camY, this.elapsedTime);`
   - Line 509: `this.vfx.renderGround(ctx, this.camera);`
   - Lines 512-519: `DarkFantasySprites.drawLoot(ctx, item, this.camera, this.elapsedTime);`
   - Lines 522-529: `DarkFantasySprites.drawEnemy(ctx, enemy, this.camera, this.elapsedTime);`
   - Line 532: `DarkFantasySprites.drawPlayer(ctx, this.player, this.camera, this.elapsedTime);`
   - Line 535: `this.weaponManager.render(ctx, this.camera);`
   - Line 538: `this.vfx.renderAir(ctx, this.camera);`
   - Line 541: `this.backdrop.renderForegroundMist(ctx, camX, camY, this.elapsedTime);`
   - Lines 544-565: HUD and Upgrade Modal overlays.
   **Direct observation**: There is currently no standalone shadow pass. Shadows are partially baked inside each entity's procedural sprite offscreen canvas.

2. **`src/render/sprites/DarkFantasySprites.ts:353-366, 609-613, 879-883, 1115-1128, 1298-1302`**:
   - `drawPlayerVector`: Ellipse at `(0, 22)`, radius `(16, 6)`, radial gradient from `rgba(8, 6, 12, 0.65)` to transparent.
   - `drawSkeletonVector`: Ellipse at `(0, 16)`, radius `(9.5, 3.0)`, color `'rgba(8, 6, 12, 0.45)'`.
   - `drawGhoulVector`: Ellipse at `(0, 16 + crawl * 0.3)`, radius `(13.5, 4.2)`, color `'rgba(8, 6, 12, 0.50)'`.
   - `drawBansheeVector`: Ellipse at `(0, 20)`, radius `(14, 4)`, radial gradient from `'rgba(26, 12, 46, 0.40)'`.
   - `drawDeathKnightVector`: Ellipse at `(0, 25)`, radius `(20, 6)`, color `'rgba(8, 6, 12, 0.70)'`.
   - `drawLoot` (`DarkFantasySprites.ts:1706-1746`): Draws only a diamond shape and specular reflection with `bob = Math.sin(...) * 1.5`. **Direct observation**: Soul Gems have zero contact shadows.
   - Damage Flashing Flaw (`DarkFantasySprites.ts:1643-1649, 1690-1703`): When an entity takes damage, `flash === 'white'` or `'crimson'`, `drawMaskedEntity` fills the entire sprite bounding box mask. Because the shadow is baked into the sprite canvas, the shadow itself flashes white or crimson on hit! Furthermore, when multiple enemies cluster, an enemy drawn later in the loop draws its quad over the bodies/limbs of enemies behind it, causing its baked shadow to clip onto adjacent enemy sprites.

3. **Entity Physical Scale & Dimensions (`src/core/entities/EnemyTypes.ts:29-66`, `src/core/entities/Player.ts:43`)**:
   - Player: `COLLISION_RADIUS = 14.0`, sprite size `64x64`, feet at `y + 16`. Target shadow: `18x7`.
   - Skeleton: `radius = 12`, sprite size `40x40`, feet at `y + 14`. Target shadow: `14x5`.
   - Ghoul: `radius = 14`, sprite size `44x44`, feet at `y + 14`. Target shadow: `16x6`.
   - Death Knight: `radius = 22`, sprite size `64x64`, feet at `y + 22`. Target shadow: `24x9`.
   - Banshee: `radius = 16`, sprite size `48x48`, floating apparitional entity. Target shadow: Floating diffuse shadow.
   - Loot Items (`src/core/systems/LootManager.ts:33-60`): Emerald radius 4, Ruby radius 6, Violet radius 8, Chest radius 12.

### 1.2 Existing Decal System State
1. **`src/render/vfx/DarkFantasyVFX.ts:470-514`**:
   `renderGround(ctx, camera)` iterates through active particles in the pool and only renders particles of type `SPELL_CIRCLE`.
   `emitBloodBurst` (`DarkFantasyVFX.ts:194-239`) creates transient airborne droplets (`maxLife = 0.4 - 0.7s`) that disappear immediately upon expiry.
   **Direct observation**: There is no ground decal system in the project. Blood splatters, blast scorch marks from Abyssal Lightning, and Death Sigil craters do not persist on the floor.

2. **Weapon Impact Events (`src/core/weapons/AbyssalLightning.ts:176-218`, `src/core/weapons/CursedAura.ts:151-167`)**:
   - `AbyssalLightning` creates electrical bolt visual segments and applies damage/kills enemies, emitting `emitBloodBurst` and `emitSoulBurst`, but stamps no scorch marks on the terrain.
   - `CursedAura` pulses expanding shockwave rings and damages swarms, but stamps no occult blast scorch marks.

3. **Performance & Memory Rigor (`tests/unit/ChallengerM2_1AdversarialHarness.test.ts:4-9`)**:
   Unit and adversarial benchmarks require 60Hz performance with 1,000+ active entities, 0 dynamic canvas allocations per frame, and 0 runtime memory leaks. Any decal or shadow system must strictly conform to zero-garbage architecture.

---

## 2. Logic Chain

### 2.1 Entity Contact Drop Shadow Architecture
- **Step 1 (Layer Separation)**:
  By moving shadow rendering from individual entity sprite drawers into a dedicated **Pre-Entity Contact Drop Shadow Pass** (executing directly after Ground Decals and before any Loot, Horde, or Player entities draw):
  - Shadows are always projected onto the ground plane beneath all living entities.
  - Overlapping enemies in high-density swarms (e.g. 500+ enemies) will never have one enemy's shadow drawn across another enemy's torso or weapon.
  - Damage flashes (`white` / `crimson`) applied to entity sprites will never taint the ground contact shadow.
  - Floating entities (Banshees and Soul Gems) achieve true 3D grounding: the shadow remains on the ground plane while the sprite bobs above it.

- **Step 2 (Offscreen Radial Shadow Atlas for 60 FPS Performance)**:
  Calling `ctx.createRadialGradient(...)` hundreds of times per frame in HTML5 Canvas 2D is a well-known CPU bottleneck due to gradient object instantiation and CSS color parsing.
  Therefore, an offscreen canvas atlas (`ShadowAtlas`) must be pre-rendered once at initialization, baking soft radial gradient stamps:
  - `STAMP_PLAYER` (48x24 surface, soft 18x7 core)
  - `STAMP_SKELETON` (36x18 surface, soft 14x5 core)
  - `STAMP_GHOUL` (40x20 surface, soft 16x6 core with subtle necrotic rim)
  - `STAMP_DEATH_KNIGHT` (56x28 surface, soft 24x9 deep core)
  - `STAMP_BANSHEE` (44x22 surface, ethereal diffuse 18x7 purple-void halo)
  - `STAMP_GEM_SMALL` (16x10 surface, 5x2.2 core)
  - `STAMP_GEM_MED` (20x12 surface, 7x3 core)
  - `STAMP_GEM_LARGE` (28x16 surface, 11x5 core)
  Rendering each shadow in the frame loop then becomes an immediate, GPU-accelerated `ctx.drawImage` blit costing $< 0.001\text{ ms}$ per entity.

- **Step 3 (Dynamic Scaling & Floating Modulation)**:
  - For grounded entities (Player, Skeleton, Ghoul, Death Knight), shadow positions are pegged to `(x, y + feetOffset)` with fixed scale.
  - For the Banshee: the entity bobs at $y_{bob} = \sin(t \cdot 3) \cdot 3$. As it rises higher above the ground, the shadow expands ($scale = 1.0 + y_{bob} \cdot 0.05$) and its alpha diffuses ($\alpha = 0.35 - y_{bob} \cdot 0.04$).
  - For Soul Gems: the diamond sprite oscillates with `Math.sin(elapsedTime * 4.0 + ...) * 1.5` while the shadow stays fixed at `y + 4`, creating a convincing levitation aesthetic.

### 2.2 Ground Decal System Architecture
- **Step 1 (Zero-Allocation Circular Buffer)**:
  A fixed-capacity circular ring buffer (`GroundDecalSystem`, capacity 500) ensures zero dynamic heap allocation:
  - An array of 500 pre-allocated `GroundDecal` objects is created at instantiation.
  - Decal allocation uses `this.head = (this.head + 1) % this.capacity`, overwriting the oldest slot when full in $O(1)$ time with zero GC pressure.
  - Frame updates step decal `life += dt`. When `life >= maxLife`, the decal expires.
  - Memory footprint is strictly bounded to $< 50\text{ KB}$ permanently.

- **Step 2 (Decal Types & Dynamic Fading Curves)**:
  1. **Blood Splatters & Droplets (`BLOOD_SPLATTER`)**:
     - Triggered on weapon slash/pierce impacts and when airborne blood particles land on the ground.
     - Radius: 3 to 8 px with 2 to 4 directional satellite micro-droplets.
     - Lifespan: 12.0s (fully opaque for 8.0s, linear decay to 0 over final 4.0s).
     - Color transitions from fresh coagulated crimson (`#6b1212`) to oxidized crust (`#380a0a`).
  2. **Pooling Dark Crimson Core (`BLOOD_POOL`)**:
     - Triggered on enemy death (`result.killed === true`).
     - Radius scaled to enemy mass: Skeleton 10px, Ghoul 14px, Death Knight 26px, Banshee 12px (ectoplasmic violet).
     - Lifespan: 15.0s (opaque for 10.0s, smooth exponential decay over final 5.0s).
  3. **Blast Scorch Marks (`LIGHTNING_SCORCH`)**:
     - Triggered at Abyssal Lightning impact and bounce coordinates.
     - Radius: 16 to 22 px charred carbon crater with 4 to 6 jagged fractal electrical discharge cracks.
     - Lifespan: 10.0s with cooling ozone aura.
  4. **Death Sigil Occult Scorch (`SIGIL_SCORCH`)**:
     - Triggered by Cursed Aura shockwave pulse.
     - Radius: 25 to 35 px charred occult ring with inscribed arcane geometric runes.
     - Lifespan: 8.0s.

- **Step 3 (Frustum Culling & Render Efficiency)**:
  The decal renderer evaluates each active decal against the camera viewport:
  ```typescript
  const sx = decal.x - camera.renderX;
  const sy = decal.y - camera.renderY;
  if (sx < -decal.radius || sx > vw + decal.radius || sy < -decal.radius || sy > vh + decal.radius) continue;
  ```
  Only on-screen decals are submitted to the canvas, keeping the render budget under $0.5\text{ ms}$ even with 500 active decals.

- **Step 4 (Clean Lifecycle Reset)**:
  In `GrimHarvestGame.restart()`, `groundDecals.clear()` resets `head = 0`, `count = 0`, and `active = false` across all 500 slots, guaranteeing clean re-initialization with zero state leaks.

---

## 3. Caveats
1. **Sprite Atlas Decoupling**: Removing the baked contact shadow from `DarkFantasySprites.ts` vector methods (`drawPlayerVector`, `drawSkeletonVector`, etc.) is recommended so that damage flashes do not tint shadows. If backward compatibility with tests checking sprite atlas pixel bounds is required, the baked shadow can be retained as a faint 1px ambient occlusion rim while the primary soft shadow is handled by the pre-entity pass.
2. **Decal Visual Complexity vs Canvas 2D Path Overhead**: Procedurally rendering 500 complex fractal paths per frame directly via `ctx.arc()` and `ctx.lineTo()` can accumulate path evaluation overhead. To achieve sub-millisecond execution, decals should utilize a hybrid approach: pre-rendered procedural offscreen decal stamps (4 variations per decal type) blitted via `ctx.drawImage` with randomized rotation and scale.
3. **Canvas Taint in Headless Environments**: All offscreen canvases must be created through existing safe helpers (`safeCreateOffscreen` or `document.createElement('canvas')`) with headless environment guards (`typeof document !== 'undefined'`) to ensure 100% test compatibility in Node/Vitest.

---

## 4. Conclusion
1. **Entity Contact Drop Shadows**:
   - Implement a dedicated `renderContactDropShadows` pass in `GrimHarvestGame.render()` positioned immediately before entity rendering.
   - Use an offscreen `ShadowAtlas` with pre-rendered radial gradient stamps scaled to the exact requested bounds:
     - Player: `18x7` (offset `y + 16`)
     - Skeleton: `14x5` (offset `y + 14`)
     - Ghoul: `16x6` (offset `y + 14`, necrotic rim)
     - Death Knight: `24x9` (offset `y + 22`, heavy ambient occlusion)
     - Banshee: `18x7` (floating diffuse shadow with inverse height scaling and alpha modulation)
     - Soul Gems: `5x2.2` to `11x5` (pinned to ground at `y + 4` while sprite bobs vertically)
   - Guarantees zero shadow flash discoloration, zero overlapping body clipping, and $< 0.5\text{ ms}$ render time.

2. **Ground Decal System**:
   - Create `src/render/vfx/GroundDecalSystem.ts` with a pre-allocated 500-slot circular ring buffer.
   - Implement 4 distinct decal archetypes: `BLOOD_SPLATTER`, `BLOOD_POOL`, `LIGHTNING_SCORCH`, and `SIGIL_SCORCH`.
   - Wire event triggers into `HordeManager.applyDamage` / kill events, `AbyssalLightning` strikes, and `CursedAura` pulses.
   - Hook airborne blood droplets in `DarkFantasyVFX` so expiring droplets stamp persistent splatters onto the ground.
   - Enforce zero dynamic heap allocation, deterministic procedural variety via PRNG seeds, and seamless `restart()` lifecycle cleanup.

---

## 5. Verification Method

### 5.1 Automated Unit & Adversarial Tests
1. **Shadow System Invariants**:
   - Verify shadow dimensions match exact specs (Player: 18x7, Skeleton: 14x5, Ghoul: 16x6, Death Knight: 24x9).
   - Verify Banshee shadow radius increases and opacity decreases when floating bob is at peak.
   - Verify Soul Gem shadows render at ground level while sprite position reflects vertical oscillation.
   - Verify zero canvas rendering exceptions and 0 NaNs across 1,000 active entities.
2. **Ground Decal Buffer & Performance Invariants**:
   - Circular buffer capacity check: Verify exact 500 capacity, $O(1)$ wrap-around replacement, and zero array re-allocations across 10,000 spawn cycles.
   - Lifecycle fade test: Verify alpha transitions from 1.0 to 0.0 over decal lifespan.
   - Frustum culling test: Assert off-screen decals are bypassed during rendering.
   - Restart reset test: Assert `groundDecals.clear()` resets active count to 0 and reclaims all slots.
3. **Execution Command**:
   ```bash
   npm test
   ```
   All 24 test suites (285+ tests) must remain 100% green.

### 5.2 Visual Inspection & Playwright Proof
- Run Playwright test and capture high-resolution screenshots in `artifacts/dark_fantasy/`:
  - Verify contact shadows ground entities naturally on flagstone tiles.
  - Verify persistent crimson blood pools accumulate around slain horde swarms.
  - Verify charred black scorch marks appear under lightning strikes and sigil explosions.
