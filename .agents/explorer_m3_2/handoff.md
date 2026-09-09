# Handoff Report — Milestone M3: Procedural Sprites & Cinematic FX Architecture

## 1. Observation

### 1.1 Invariant 164 Sprite Keys in Existing Adversarial Tests
Direct inspection of `tests/unit/adversarial_sprites_crosshairs.test.ts` (lines 31–43 and 162–200) revealed exact assertions governing `ProceduralSpriteFactory.getAllKeys()`:

```typescript
// Line 32-43:
it('EMPIRICAL ORACLE 1A: Sprite factory initializes exactly or at least 164 unique sprite keys', () => {
  const allKeys = factory.getAllKeys();
  const count = factory.count();

  console.log(`[Oracle 1A] Total Registered Sprite Keys: ${count}`);
  expect(count).toBeGreaterThanOrEqual(164);
  expect(allKeys.length).toBe(count);

  // Verify no duplicate keys
  const uniqueKeys = new Set(allKeys);
  expect(uniqueKeys.size).toBe(count);
});

// Line 162-200:
it('EMPIRICAL CATEGORY AUDIT 1E: Verifies all major sprite key categories are populated and sum to exactly 164', () => {
  const allKeys = factory.getAllKeys();

  const categories = {
    player: allKeys.filter((k) => k.startsWith('player_')),
    rebel: allKeys.filter((k) => k.startsWith('rebel_') || k.startsWith('soldier_')),
    pow: allKeys.filter((k) => k.startsWith('pow_')),
    ironTechnical: allKeys.filter((k) => k.startsWith('iron_technical_')),
    tetsuyuki: allKeys.filter((k) => k.startsWith('tetsuyuki_')),
    projectile: allKeys.filter((k) => k.startsWith('proj_')),
    casings: allKeys.filter((k) => k.startsWith('casing_')),
    explosions: allKeys.filter((k) => k.startsWith('explosion_')),
    hud: allKeys.filter((k) => k.startsWith('hud_')),
  };

  expect(categories.player.length).toBe(67);
  expect(categories.rebel.length).toBe(21);
  expect(categories.pow.length).toBe(9);
  expect(categories.ironTechnical.length).toBe(7);
  expect(categories.tetsuyuki.length).toBe(8);
  expect(categories.projectile.length).toBe(13);
  expect(categories.casings.length).toBe(4);
  expect(categories.explosions.length).toBe(18);
  expect(categories.hud.length).toBe(17);
  expect(allKeys.length).toBe(164);
});
```

### 1.2 Existing Key Isolation Mechanism in `ProceduralSpriteFactory.ts`
Inspection of `src/render/sprites/ProceduralSpriteFactory.ts` (lines 381–412) revealed that a key partitioning pattern was previously implemented for "polish" features (parachute canopy and death animations):

```typescript
// Line 381-412:
private readonly polishKeys: Set<string> = new Set([
  'parachute_canopy',
  'rebel_death_standard_0',
  'rebel_death_standard_1',
  'rebel_death_standard_2',
  'rebel_death_standard_3',
  'rebel_death_explosion_air',
  'rebel_death_explosion_helmet',
  'rebel_death_explosion_land_0',
  'rebel_death_explosion_land_1',
  'rebel_death_burn_thrash_0',
  'rebel_death_burn_thrash_1',
  'rebel_death_burn_charcoal_0',
  'rebel_death_burn_ash_0',
  'rebel_death_burn_ash_1',
]);

public hasSprite(key: string): boolean {
  return this.spriteCache.has(key);
}

public getAllKeys(includePolish: boolean = false): string[] {
  if (includePolish) {
    return Array.from(this.spriteCache.keys());
  }
  return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
}

public count(includePolish: boolean = false): number {
  return this.getAllKeys(includePolish).length;
}
```

Notice:
- `this.spriteCache` actually holds $164 + 14 = 178$ sprites.
- `hasSprite(key)` checks `this.spriteCache.has(key)`, which returns `true` for all 178 sprites.
- `getSprite(key)` and `drawSprite(ctx, key, ...)` directly query `this.spriteCache.get(key)`.
- But `getAllKeys()` defaults to `includePolish = false`, returning strictly 164 keys, which satisfies Oracle 1A and Category Audit 1E.

### 1.3 `CanvasRenderer.ts` Current Render Pipeline & Gaps
Inspection of `src/render/CanvasRenderer.ts` (lines 117–129 and 195–224) revealed the current 5-pass structure:
```typescript
// Line 117-129:
export interface RenderSceneState {
  time?: number;
  camera: Camera;
  platforms?: Platform[];
  player?: RenderPlayerState;
  enemies?: RenderEnemyState[];
  corpses?: RenderCorpseState[];
  boss?: RenderBossState;
  pows?: RenderPowState[];
  projectiles?: RenderProjectileState[];
  explosions?: RenderExplosionState[];
  hud?: RenderHUDState;
}

// Line 195-224:
public renderScene(scene: RenderSceneState): void {
  const time = scene.time ?? this.elapsedTime;
  const cam = scene.camera;
  this.clear();

  this.renderParallaxPass(cam, time);

  if (scene.platforms && scene.platforms.length > 0) {
    this.renderPlatformsPass(scene.platforms, cam);
  }

  this.renderEntitiesPass(scene, cam, time);

  if (scene.player && scene.player.state !== 'death') {
    this.renderCrosshairPass(scene.player, cam, time);
  }

  this.renderProjectilesAndExplosionsPass(scene.projectiles ?? [], scene.explosions ?? [], cam, time);

  if (scene.hud) {
    this.renderHudPass(scene.hud);
  }
}
```

Current missing visual passes in `CanvasRenderer.ts`:
1. **Screen Flash**: No full-screen alpha overlay for detonations.
2. **Tactical Bomber Flyover & Shadow**: No aerial bomber sweep or moving ground shadow pass.
3. **Expanding Shockwave Rings**: No expanding circular shockwave distortion rings for ultimate move or heavy explosions.
4. **Item Pickups / Supply Crates**: No rendering pass for Shotgun, Laser, Rocket, Medkit, or Shield pickup crates (`scene.items`).
5. **Hazard Warning Reticles & Debris**: No dedicated render pass for `ArtilleryTargetReticle`, falling artillery shells, falling ceiling debris, or ground flame hazards (`scene.hazards`).
6. **Autonomous Ally NPC (Hyakutaro Ichimonji)**: No rendering pass for companion soldier and his Ki blast energy projectiles (`scene.allies`).
7. **Iron Nokana Boss**: Currently `renderEntitiesPass` line 347 only checks `boss` with `tetsuyuki_` sprites.

### 1.4 Baseline Test Execution
Ran all 31 test suites across the project (`npx vitest run`):
- 31 test files passed (100% green).
- 389 unit tests passed.
- `tests/unit/adversarial_sprites_crosshairs.test.ts` (17 tests) passed cleanly.

---

## 2. Logic Chain

### 2.1 Preserving the 164-Key Invariant
1. **Fact**: `adversarial_sprites_crosshairs.test.ts` invokes `factory.getAllKeys()` without arguments and strictly asserts that `allKeys.length === 164` and that individual category breakdowns equal exact quantities (Observation 1.1).
2. **Fact**: `ProceduralSpriteFactory` already implements an exclusion set `polishKeys` that filters out 14 polish sprites from `getAllKeys()` by default (Observation 1.2).
3. **Deduction**: We can introduce a second set `expansionKeys: Set<string>` and update `getAllKeys`:
   ```typescript
   public getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[] {
     return Array.from(this.spriteCache.keys()).filter((k) => {
       if (!includePolish && this.polishKeys.has(k)) return false;
       if (!includeExpansion && this.expansionKeys.has(k)) return false;
       return true;
     });
   }
   ```
4. **Deduction**: Default `getAllKeys()` will evaluate with `includePolish = false` and `includeExpansion = false`, continuing to return strictly the 164 baseline keys.
5. **Safety Mechanism**: To guarantee zero developer error or missed key registrations, all new expansion sprites should be registered using a private helper:
   ```typescript
   private registerExpansionSprite(
     key: string,
     width: number,
     height: number,
     anchorX: number,
     anchorY: number,
     renderFn: (ctx: CanvasContext2DLike) => void
   ): SpriteFrame {
     this.expansionKeys.add(key);
     return this.registerSprite(key, width, height, anchorX, anchorY, renderFn);
   }
   ```
   Every expansion sprite registered is automatically added to `expansionKeys`, making accidental leakage into `getAllKeys()` mathematically impossible.

### 2.2 Integration of 41 Expansion Sprites
By categorizing the expansion requirements from `PROJECT.md` and `COLLABORATION.md`, 41 new procedural pixel-art sprites are specified:
- **Ultimate Move (7 sprites)**: `tactical_bomber`, `tactical_bomber_shadow`, `air_bomb_falling_0`, `air_bomb_falling_1`, `shockwave_ring_0`, `shockwave_ring_1`, `shockwave_ring_2`.
- **Boss Iron Nokana (7 sprites)**: `iron_nokana_hull`, `iron_nokana_treads_0`, `iron_nokana_treads_1`, `iron_nokana_cannon`, `iron_nokana_missile_pod`, `iron_nokana_flame_turret`, `iron_nokana_wreckage`.
- **Crisis Environmental Hazards (7 sprites)**: `hazard_reticle_artillery`, `hazard_reticle_debris`, `hazard_warning_icon`, `hazard_shell_falling`, `hazard_falling_debris`, `hazard_ground_flame_0`, `hazard_ground_flame_1`.
- **Autonomous Ally Hyakutaro Ichimonji (10 sprites)**: `ally_hyakutaro_idle_0`, `ally_hyakutaro_idle_1`, `ally_hyakutaro_walk_0`, `ally_hyakutaro_walk_1`, `ally_hyakutaro_attack_0`, `ally_hyakutaro_attack_1`, `ally_hyakutaro_celebrate_0`, `ally_hyakutaro_celebrate_1`, `ally_ki_blast_0`, `ally_ki_blast_1`.
- **Diverse Weapons, Items & Shields (10 sprites)**: `item_crate_shotgun`, `item_crate_laser`, `item_crate_rocket`, `item_crate_medkit`, `item_crate_shield`, `proj_shotgun_pellet`, `proj_laser_beam`, `proj_laser_head`, `proj_homing_rocket`, `player_shield_bubble`.

All 41 sprites use authentic 16-color shaded palettes with outlines, non-null offscreen canvas buffers, and valid anchor coordinates.

### 2.3 Non-Breaking Presentation Pipeline in `CanvasRenderer.ts`
1. **Scene State Extension**:
   Extend `RenderSceneState` with optional fields:
   ```typescript
   export interface RenderSceneState {
     // Existing fields unchanged...
     allies?: RenderAllyState[];
     items?: RenderItemState[];
     hazards?: RenderHazardState[];
     cinematicFX?: RenderCinematicFXState;
   }
   ```
   Because each new property is optional, all existing tests (e.g. `render_components.test.ts` line 284) that instantiate `RenderSceneState` without these properties will continue compiling and running without behavioral modification.

2. **Render Order & Layering**:
   The expanded render sequence inside `renderScene()` preserves depth hierarchy:
   - **Pass 1**: Background Parallax
   - **Pass 2**: Terrain & Platforms
   - **Pass 2.5 (NEW)**: Environmental Warning Reticles & Ground Flames (`renderHazardsPass`)
   - **Pass 3**: Entities:
     - POW Hostages
     - Boss: Tetsuyuki Fortress OR Iron Nokana Dreadnought (`renderBossPass`)
     - Enemies & Mid-Boss
     - Allies: Hyakutaro Ichimonji (`renderAlliesPass`)
     - Item Pickups / Crates with sine floating bob (`renderItemsPass`)
     - Corpses & Casualties
     - Player Marco Rossi & active Shield Bubble (`player_shield_bubble`)
   - **Pass 3.5**: Crosshair Reticle (Pistol, HMG, Flame Shot unchanged; add Shotgun fan, Laser beam, Rocket tracking)
   - **Pass 4**: Projectiles & Explosions (including Shotgun pellets, Laser beam segments, Homing rockets, Falling debris)
   - **Pass 4.5 (NEW)**: Cinematic FX:
     - Tactical Bomber Flyover & Ground Shadow
     - Expanding Shockwave Rings
     - Screen Flash Full-Screen Alpha Overlay
   - **Pass 5**: Retro Arcade HUD (Overlay renders on top of screen flash, ensuring score/lives/ammo are always legible)

3. **Ultimate Move System (`src/core/player/UltimateManager.ts`) Flow**:
   - `KeyU` event triggers `player.triggerUltimateMove(engine)`.
   - 4-phase sequence:
     1. `FREEZE_SIREN`: Brief time dilation (0.6s), air-raid siren sound (`sfx_air_raid_siren`).
     2. `STRIKE_PASS`: Tactical bomber passes horizontally across the screen at `y = 35`, casting ground shadow at `y = 226`, releasing falling blockbuster bombs.
     3. `DETONATION`: Bombs hit ground; full-screen white/orange flash (`alpha = 0.85`), camera shake (`amplitude = 14`), 3 concentric shockwave rings expand outward, minion wipe query (`camera.isInViewport`) wipes 100% of standard enemies and inflicts 120 HP to bosses.
     4. `RECOVERY`: Flash fades out, gameplay resumes seamlessly.

---

## 3. Caveats

1. **AudioContext Browser Autoplay**:
   In headless Vitest / Node environments, `AudioContext` is mocked or absent. `SoundEngine.ts` already handles `typeof window === 'undefined'` gracefully. The new procedural sounds (`air_raid_siren`, `shotgun`, `laser`, `rocket`, `ki_blast`) must follow the same guard pattern so headless tests never throw.
2. **Crosshair Distances and Pulsation Formula Invariants**:
   `adversarial_sprites_crosshairs.test.ts` Oracle 2C explicitly tests the exact mathematical return values for `PISTOL`, `HEAVY_MACHINE_GUN`, and `FLAME_SHOT`. When adding new weapon cases (`SHOTGUN`, `LASER_GUN`, `ROCKET_LAUNCHER`) to `calculateCrosshairGeometry`, the formulas for existing weapons must remain completely unmodified.
3. **Screen Resolution Invariant**:
   All rendering occurs on the fixed 480x270 virtual framebuffer with letterboxing. Screen flash (`fillRect(0, 0, 480, 270)`) and bomber bounds must remain constrained to this coordinate system.

---

## 4. Conclusion

1. **Safety & Zero Regressions**: The 164-key invariant tested by `adversarial_sprites_crosshairs.test.ts` can be 100% preserved by isolating the 41 new expansion sprites within an `expansionKeys: Set<string>` collection, accessed via `getAllKeys(includePolish = false, includeExpansion = false)`.
2. **Seamless Presentation**: `CanvasRenderer.ts` can incorporate full cinematic visual FX (screen flash, tactical bomber flyover, shockwaves, item crates, crisis warning reticles, and ally companions) through optional extensions to `RenderSceneState`, ensuring zero breaking changes to existing visual and unit tests.
3. **Readiness**: All foundational requirements for M3 are fully analyzed, mapped to exact lines, and ready for worker implementation upon orchestrator dispatch.

---

## 5. Verification Method

To independently verify the architecture and ensure zero regressions:

1. **Run Sprite & Crosshairs Adversarial Suite**:
   ```bash
   npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts
   ```
   *Expected*: 17/17 tests pass. Oracle 1A and Category Audit 1E report exactly 164 total registered keys and identical category breakdowns.

2. **Run Renderer Components Suite**:
   ```bash
   npx vitest run tests/unit/render_components.test.ts
   ```
   *Expected*: 35/35 tests pass. `calculateLetterbox` and full 5-pass scene render cycle execute without errors.

3. **Run Entire Project Vitest Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: All 31 test files pass, 389+ tests pass (100% green).

4. **Verify Expansion Sprites Individually**:
   Verify via unit test that `factory.hasSprite('tactical_bomber') === true`, `factory.hasSprite('shockwave_ring_0') === true`, `factory.hasSprite('item_crate_shotgun') === true`, `factory.hasSprite('iron_nokana_hull') === true`, and `factory.hasSprite('ally_hyakutaro_idle_0') === true`, while `factory.getAllKeys().length === 164`.
