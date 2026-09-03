# Project: Metal Slug Web (Full Metal Slug) Polish & Diverse Spawning Overhaul

## Architecture
Decoupled multi-tier simulation and presentation architecture:
1. **Simulation Core (`src/core/`)**:
   - 100% decoupled from DOM, Window, and Canvas APIs.
   - Fixed 60Hz timestep semi-implicit Euler integration (`dt = 1/60`).
   - Natural Newtonian kinematics and platform collision.
   - **Diverse Spawning Architecture (R1)**:
     - `PARACHUTE_DESCENT`: Spawns at high altitude ($Y < 50$), controlled descent velocity ($v_y \approx 40-60\text{ px/s}$), horizontal sinusoidal swaying ($A = 18\text{ px}, \omega = 3.0\text{ rad/s}$), ground touchdown at $Y=230$ ($y=192$), canopy detachment and fade, transition to alert combat AI.
     - `STRUCTURE_AMBUSH`: Ballistic leap-out arc ($v_x = -130\text{ px/s}, v_y = -220\text{ px/s}, g=720\text{ px/s}^2$) leaping from trenches and structures at designated trigger coordinates.
   - **Decoupled Corpse Simulation (R2)**:
     - `DeathCorpseManager`: Subscribes to `enemy_death` events. Simulates visual death trajectories without violating core simulation entity culling invariants:
       - Standard falling death: Stagger, knee buckle, back ground collapse.
       - Explosion blowback: Ballistic parabolic air launch ($v_y=-300, v_x=\pm 200$), rotational tumbling ($\omega = 8.5\text{ rad/s}$), detached flying Stahlhelm helmet, ground impact bounce.
       - Burning death: Fire thrash with flame particles, charred silhouette with molten embers, ash crumble collapse.
2. **Render Layer (`src/render/`)**:
   - HTML5 2D Canvas rendering with procedural pixel-art rasterization (`ProceduralSpriteFactory.ts`).
   - Authentic 16-color procedural parachute canopy and 12 distinct death animation frames.
   - Corpse rendering pass with rotation, alpha fading, dynamic suspension cords, and canvas particle emitters.
3. **Audio Layer (`src/audio/`)**:
   - Web Audio API procedural sound synthesis including soldier casualty screams and flame sizzle effects.
4. **Testing & Visual Verification (`tests/`)**:
   - Vitest unit test suite: 24 test files, 294 tests passed (100% green).
   - Playwright E2E visual verification suite: 4 spec files, 17 tests passed (100% green).
   - 3 captured screenshot artifacts in `artifacts/death_animations/`:
     - `death_standard.png` (~20.7KB)
     - `death_explosion_blowback.png` (~21.7KB)
     - `death_burning.png` (~20.9KB)
   - Root-level `BUG_HUNT_REPORT.md` documenting 7 cataloged defect investigations and root-cause remediations.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Parachute Airborne Drops | Spawn at Y < 50, descent vy 40-60 px/s, sinusoidal sway, ground touchdown at Y=230 | M_POLISH | R1 |
| 2 | Trench / Structure Ambushes | Leap-out arc vx != 0, vy < 0, gravity landing from structures/trenches | M_POLISH | R1 |
| 3 | Standard Falling Death | Stagger, knee buckle, backward ground collapse from bullets/rifles | M_POLISH | R2 |
| 4 | Explosion Blowback Death | Ballistic launch, tumbling rotation, detached flying helmet, ground impact bounce | M_POLISH | R2 |
| 5 | Flamethrower Burning Death | Thrashing animation, flame particles, charred silhouette, ash collapse | M_POLISH | R2 |
| 6 | Procedural Death & Parachute Sprites | Parachute canopy + 12 pixel-art death animation frames in ProceduralSpriteFactory | M_POLISH | R1/R2 |
| 7 | Damage Type Normalization | Normalize damageSourceType across ProjectileManager, Grenade, SoldierEnemy | M_POLISH | R2/BugHunt |
| 8 | Decoupled Corpse Manager | DeathCorpseManager handles visual death physics without breaking entity invariants | M_POLISH | R2 |
| 9 | Player Damage Collision Wiring | Enemy bullets, grenades, and melee boxes deal proper damage to PlayerController | M_POLISH | R3/BugHunt |
| 10 | Soldier Casualty SFX | Procedural screams, grunts, and flame sizzle sound synthesis in SoundEngine | M_POLISH | R2/R3 |
| 11 | Playwright Death Screenshots | Capture death_standard.png, death_explosion_blowback.png, death_burning.png (>5KB) | M_POLISH | Acceptance |
| 12 | Diverse Spawning Unit Tests | Automated tests in tests/unit/diverse_spawning.test.ts asserting kinematics | M_POLISH | Acceptance |
| 13 | Autonomous Bug Hunt Report | Comprehensive audit and fix report documented in BUG_HUNT_REPORT.md | M_POLISH | R3 |
| 14 | 100% Green Verification | Clean build, 100% pass across vitest (294/294) and playwright (17/17) tests | M_POLISH | Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Architecture Analysis | Map spawning, death animation, and test systems | None | DONE |
| M_POLISH | Implementation & Polish | R1 (Spawning), R2 (Deaths), R3 (Bug fixes & BUG_HUNT_REPORT.md), E2E Screenshots | M0 | DONE |
| M_VERIFY | Adversarial Review & Forensic Victory Audit | 2 Reviewers, 2 Challengers, 1 Forensic Integrity Auditor | M_POLISH | DONE |

---

## Code Layout
- `src/core/entities/enemies/EnemyTypes.ts`: Damage types, death types, spawn behavior interfaces
- `src/core/entities/enemies/SoldierEnemy.ts`: Kinematics, parachute sway, ambush leap, damage normalization, death events
- `src/core/entities/enemies/DeathCorpseManager.ts`: Visual death simulation, ballistic arcs, air rotation, ground bounce, particles
- `src/core/weapons/ProjectileManager.ts`: Clean weapon damage type dispatching
- `src/core/weapons/Grenade.ts`: Explicit explosive damage dispatching
- `src/core/player/PlayerController.ts`: Enemy collision and damage handling
- `src/render/sprites/ProceduralSpriteFactory.ts`: Procedural parachute canopy + 12 death animation frames
- `src/render/CanvasRenderer.ts`: Parachute suspension lines and corpse rendering pass
- `src/audio/SoundEngine.ts`: Procedural soldier casualty voice synthesis and death sound effects
- `src/main.ts`: Stage trigger enhancements, DeathCorpseManager lifecycle, test hooks
- `tests/unit/diverse_spawning.test.ts`: Automated tests for high-Y parachute drops and ambush leaps
- `tests/unit/death_animations.test.ts`: Automated tests for damage types, corpse physics, and sprite registrations
- `tests/unit/adversarial_death_polish2_challenge.test.ts`: High-volume casualty stress tests (150 casualties)
- `tests/unit/adversarial_diverse_spawning_kinematics.test.ts`: Parachute and ambush kinematics empirical challenge
- `tests/e2e/death_animations_screenshots.spec.ts`: Playwright screenshot capture into artifacts/death_animations/
- `BUG_HUNT_REPORT.md`: Comprehensive bug hunt audit and resolution report
