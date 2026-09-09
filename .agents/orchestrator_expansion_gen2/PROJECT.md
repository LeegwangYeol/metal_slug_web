# Project: Metal Slug Web Massive Expansion (Gen 2)

## Architecture
Decoupled multi-tier simulation and presentation architecture:
1. **Simulation Core (`src/core/`)**:
   - Fixed 60Hz timestep semi-implicit Euler integration (`dt = 1/60`), 100% decoupled from DOM/Canvas.
   - **Boss & Crisis Engine (`src/core/entities/boss/`)**:
     - `CrisisEventManager`: Decoupled engine monitoring boss HP checkpoints (`75%`, `50%`, `25%`) and coordinating environment alterations.
     - `IronNokanaBoss`: Heavy armored crawler dreadnought with 4 distinct phases, telegraphed attacks, and rage overdrive state.
     - `EnvironmentalHazard`: Concrete hazard entities (`ArtilleryShellHazard`, `FallingDebrisHazard`, `GroundFlameHazard`) with telegraph reticles and damage dispatch.
     - Dynamic arena modification: Platform removal (`GameEngine.removePlatform`) and camera bounds contraction (`StageManager.collapsePlatform`, `StageManager.setCameraBounds`).
   - **Autonomous Ally NPCs (`src/core/entities/allies/`)**:
     - `AllyNPC`: Companion entity (Hyakutaro Ichimonji) with decoupled AI state machine (`IDLE`, `FOLLOW`, `ACQUIRE_TARGET`, `ATTACK`, `CELEBRATE`).
     - Threat-weighted target acquisition scanning living enemies within vision radius.
     - `AllyKiBlast`: Friendly energy projectile dealing autonomous damage to enemies without player input.
   - **Expanded Weapons & Items (`src/core/weapons/`, `src/core/entities/items/`)**:
     - `Shotgun`: 7-pellet fan spread, short life, 160 px/s kinetic knockback.
     - `LaserGun`: 1200 px/s continuous piercing beam with tick immunity against duplicate hits.
     - `RocketLauncher`: Homing steering at 3.5 rad/s, acceleration to 650 px/s, 48px explosive blast AOE.
     - `Medkit`: HP restore / extra life pickup.
     - `Shield`: Temporary 2-hit damage absorption buffer on `PlayerController`.
   - **Ultimate Move System (`src/core/player/UltimateManager.ts`)**:
     - Dedicated trigger on `KeyU`.
     - 4-phase cinematic pipeline: Freeze & Siren -> Strike Pass -> Detonation -> Recovery.
     - Viewport query eliminating 100% of standard on-screen minions and dealing 120 HP burst damage to bosses.
2. **Presentation & Rendering (`src/render/`)**:
   - `ProceduralSpriteFactory`: 30+ new procedural sprites isolated in `expansionKeys: Set<string>` to preserve the 164-key baseline invariant for existing tests.
   - `CanvasRenderer`: Render passes for collectible item crates, crisis warning reticles, falling hazards, ally companions, and ultimate move airstrike/flash/shockwave effects.
3. **Audio Synthesis (`src/audio/SoundEngine.ts`)**:
   - Procedural Web Audio synthesis for air-raid siren, hydraulic hiss, ki blast, shotgun blast, laser beam, and homing rocket thrust.
4. **Testing Infrastructure (`tests/`)**:
   - Vitest Unit Test Suites: Automated tests for crisis events, Iron Nokana, ally autonomy, diverse weapons, and ultimate move.
   - Playwright E2E Suite: Headless browser verification of screen-clearing ultimate move and visual proof screenshots saved to `artifacts/expansion/`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | CrisisEventManager | Monitors boss HP at 75%, 50%, 25% checkpoints and coordinates crisis events | M1_BOSS_CRISIS | R1 |
| 2 | IronNokanaBoss | 4-phase heavy armored siege crawler boss with telegraphed attacks & rage state | M1_BOSS_CRISIS | R1 |
| 3 | Environmental Hazards | Concrete hazard entities (ArtilleryShellHazard, FallingDebrisHazard, GroundFlameHazard) | M1_BOSS_CRISIS | R1 |
| 4 | Platform & Bounds Collapse | Dynamic platform removal and camera bounds contraction during crisis events | M1_BOSS_CRISIS | R1 |
| 5 | Crisis Unit Tests | Vitest suite verifying HP thresholds, hazard entity generation, and bounds change | M1_BOSS_CRISIS | R1/Acceptance |
| 6 | Autonomous Ally NPC | Hyakutaro Ichimonji companion with autonomous follow, target acquisition, and ki blasts | M2_ALLIES_ITEMS | R2 |
| 7 | Shotgun Weapon | 7-pellet fan spread, high kinetic knockback, close-quarters devastation | M2_ALLIES_ITEMS | R2 |
| 8 | Laser Gun Weapon | Continuous 1200 px/s piercing beam with tick immunity | M2_ALLIES_ITEMS | R2 |
| 9 | Rocket Launcher | Homing projectile with steering kinematics and 48px explosive AOE blast | M2_ALLIES_ITEMS | R2 |
| 10 | Medkit & Shield Power-ups | HP restore and 2-hit damage absorption buffer on PlayerController | M2_ALLIES_ITEMS | R2 |
| 11 | Allies & Items Unit Tests | Vitest suite verifying ally autonomy, weapon spread/piercing/homing, and shields | M2_ALLIES_ITEMS | R2/Acceptance |
| 12 | Ultimate Move System | Screen-clearing tactical strike on Key U with freeze, siren, strike pass, minion wipe | M3_ULTIMATE_FX | R2/Acceptance |
| 13 | Expansion Procedural Sprites | 30+ new procedural sprites partitioned via expansionKeys (preserving 164 baseline) | M3_ULTIMATE_FX | R1/R2 |
| 14 | Cinematic Visual FX & Audio | Screen flash, freeze frame, siren sound, shockwave particles, item crate rendering | M3_ULTIMATE_FX | R2 |
| 15 | Playwright E2E Ultimate Test | Headless browser test verifying 100% minion elimination and boss burst damage | M4_E2E_VERIFY | R3/Acceptance |
| 16 | Visual Proof Screenshots | Playwright screenshots of Ultimate Move, Boss Crisis, and Ally Support in artifacts/expansion/ | M4_E2E_VERIFY | R3/Acceptance |
| 17 | Zero Regressions Verification | 100% pass across all unit tests, E2E tests, clean TypeScript build | M5_FINAL_GATE | R3/Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | M1_BOSS_CRISIS | Remediate CrisisEventManager, IronNokanaBoss, hazards, bounds collapse, 100% green tests | None | DONE |
| M2 | M2_ALLIES_ITEMS | AllyNPC, AllyKiBlast, Shotgun, LaserGun, RocketLauncher, Medkit, Shield, unit tests | None | IN_PROGRESS |
| M3 | M3_ULTIMATE_FX | UltimateManager, KeyU mapping, expansion sprites (164 invariant), visual FX, SoundEngine | M1, M2 | PLANNED |
| M4 | M4_E2E_VERIFY | Playwright E2E ultimate test, screenshot artifacts in artifacts/expansion/ | M3 | PLANNED |
| M5 | M5_FINAL_GATE | Adversarial Review, Challenger stress testing, and Forensic Victory Audit | M4 | PLANNED |

---

## Interface Contracts
### `CrisisEventManager` ↔ `GameEngine` & `StageManager`
- `crisisManager.update(dt, boss, engine, stageManager)`
- Thresholds: `0.75` (Artillery strike), `0.50` (Platform collapse & camera contraction), `0.25` (Rage overdrive)
- `engine.removePlatform(platformId: string): boolean`
- `stageManager.collapsePlatform(platformId: string): boolean`
- `stageManager.setCameraBounds(bounds: CameraBounds): void`

### `AllyNPC` ↔ `GameEngine`
- Implements `GameEntity` (`id`, `type: 'ALLY_NPC'`, `bounds`, `isAlive`, `update(dt, engine)`, `render(ctx)`)
- `AllyKiBlast` implements `GameEntity` (`type: 'ALLY_PROJECTILE'`), ignores `PLAYER` and `ALLY_NPC`, deals 3.5 damage to enemies.

### `WeaponManager` & `PlayerController` ↔ `ItemPickupEntity`
- `ItemDropType`: includes `'WEAPON_SHOTGUN'`, `'WEAPON_LASER'`, `'WEAPON_ROCKET'`, `'MEDKIT'`, `'SHIELD'`
- `player.shieldCharges: number` (absorbs up to 2 hits before taking HP damage)
- `player.triggerUltimateMove(engine: GameEngine): boolean`

### `ProceduralSpriteFactory` Invariant
- `getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[]`
- Default call `getAllKeys()` returns exactly 164 keys.

---

## Code Layout
- `src/core/entities/boss/CrisisEventManager.ts`: Boss HP threshold monitor and crisis event dispatcher
- `src/core/entities/boss/IronNokanaBoss.ts`: 4-phase heavy dreadnought crawler boss
- `src/core/entities/boss/EnvironmentalHazard.ts`: Concrete hazard entities (Artillery, Debris, Flame)
- `src/core/entities/allies/AllyNPC.ts`: Autonomous companion entity (Hyakutaro Ichimonji)
- `src/core/entities/allies/AllyKiBlast.ts`: Autonomous ally projectile
- `src/core/entities/allies/AllyManager.ts`: Ally lifecycle and spawn management
- `src/core/weapons/ShotgunWeapon.ts`: Shotgun spread weapon logic
- `src/core/weapons/LaserGunWeapon.ts`: Piercing continuous beam logic
- `src/core/weapons/RocketLauncherWeapon.ts`: Homing missile and AOE burst logic
- `src/core/player/UltimateManager.ts`: Cinematic screen-clearing ultimate attack coordinator
- `src/render/sprites/ProceduralSpriteFactory.ts`: Expansion sprites with isolated keys
- `src/render/CanvasRenderer.ts`: Rendering for items, reticles, allies, hazards, ultimate FX
- `src/audio/SoundEngine.ts`: Audio synthesis for expansion SFX
- `tests/unit/boss_crisis_events.test.ts`: Automated unit tests for crisis triggers and bounds change
- `tests/unit/iron_nokana_boss.test.ts`: Automated unit tests for Iron Nokana phases and attacks
- `tests/unit/allies_system.test.ts`: Automated unit tests for autonomous ally targeting and damage
- `tests/unit/diverse_weapons_items.test.ts`: Automated unit tests for new weapons, medkits, shields
- `tests/unit/ultimate_move_system.test.ts`: Automated unit tests for ultimate move activation and wipe
- `tests/e2e/ultimate_and_crisis_expansion.spec.ts`: Playwright E2E browser tests and screenshot capture
- `artifacts/expansion/`: Directory for captured visual proof screenshots
