# Project: Metal Slug Web (Full Metal Slug) Gameplay & Visual Overhaul

## Architecture
Decoupled multi-tier simulation and presentation architecture:
1. **Simulation Core (`src/core/`)**:
   - 100% decoupled from DOM, Window, and Canvas APIs.
   - Fixed 60Hz timestep semi-implicit Euler integration (`dt = 1/60`).
   - Natural Newtonian kinematics: $v_y(t+\Delta t) = v_y(t) + g\Delta t$, $y(t+\Delta t) = y(t) + v_y(t)\Delta t$. Crisp jump impulses, coyote-time jump buffering, apex float dampening.
   - Stage manager & enemy spawning: Out-of-bounds spawn positioning ($X > \text{camera.maxX}$ or $X < \text{camera.minX}$) so minions smoothly run/patrol into view without jarring pop-in.
   - Off-screen despawn margins for enemies falling behind camera.
2. **Render Layer (`src/render/`)**:
   - HTML5 2D Canvas rendering with procedural pixel-art rasterization (`ProceduralSpriteFactory.ts`).
   - High-resolution Neo Geo authentic 16-color shaded pixel art for Marco Rossi, Rebel Soldiers, POWs, vehicles, and effects.
   - Dynamic Aiming Reticle / Crosshair rendered along the player's 8-way aim vector with weapon-specific visual styling.
   - 5 distinct directional upper-body aiming poses: `FORWARD`, `UP_FORWARD`, `UP`, `DOWN_FORWARD`, `DOWN`.
   - 4-layer parallax scrolling background system and dynamic camera tracking.
3. **Audio Layer (`src/audio/`)**:
   - Web Audio API procedural sound synthesis and formant speech filter announcer voice engine.
4. **Input & UI Layer (`src/input/`, `src/ui/`)**:
   - Keyboard & touch input handling, retro arcade HUD.
5. **Testing & Visual Verification (`tests/`)**:
   - Vitest unit test suite covering kinematics, weapons, spawning, state machines, and spatial grid.
   - Playwright E2E visual verification suite capturing 5 designated screenshot artifacts into `artifacts/screenshots/`.
   - Visual AI evaluation report documented in `artifacts/VISUAL_EVALUATION.md`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Natural Newtonian Kinematics | Parabolic jump arc, gravity, ground snapping, variable jump height | M1 | survey/R1 |
| 2 | Platform Collision & Landing | Crisp landing response, platform pass-through and drop-down | M1 | survey/R1 |
| 3 | Out-of-Bounds Enemy Spawner | Minions spawn at camera.maxX + 40px or camera.minX - 40px | M2 | survey/R1 |
| 4 | Minion Smooth Entrance & Despawn | Walk/run-in entrance animations, clean off-screen despawn | M2 | survey/R1 |
| 5 | High-Res Neo Geo Marco Sprite | 16-color shaded pixel art, headband, vest, ammo belt, boots | M3 | survey/R2 |
| 6 | High-Res Rebel & POW Sprites | Detailed helmets, uniforms, weapons, muscle definition, rescue wave | M3 | survey/R2 |
| 7 | High-Res Vehicles & Effects | Metal plating rivets, rust, muzzle flashes, smoke puffs | M3 | survey/R2 |
| 8 | Dynamic Weapon Crosshair | Tactical aiming reticle along aim vector (pistol pip, HMG circle, flame arc) | M4 | survey/R2 |
| 9 | 5-Directional Upper Body Poses | Distinct sprites/rotations for FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN | M4 | survey/R2 |
| 10 | SpatialGrid Timing Flake Calibration | Calibrate adversarial_challenge benchmark threshold to prevent CI flake | M5 | survey/QA |
| 11 | Playwright Visual Screenshot Suite | Captures 5 required screenshots into artifacts/screenshots/ | M5 | survey/R3 |
| 12 | Visual AI Design Evaluation Report | Formal critique of art, layout, crosshair, jump arc, walk-in to artifacts/VISUAL_EVALUATION.md | M6 | survey/R3 |
| 13 | 100% Green Test Verification | All Vitest unit tests and Playwright E2E tests pass green | M6 | survey/QA |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Physics & Newtonian Kinematics | `src/core/player/PlayerKinematics.ts`, `src/core/physics/` | None | DONE |
| M2 | Smooth Out-of-Bounds Spawning | `src/core/engine/StageManager.ts`, `src/main.ts` | M1 | DONE |
| M3 | High-Resolution Neo Geo Sprites | `src/render/sprites/ProceduralSpriteFactory.ts` | None | DONE |
| M4 | Dynamic Crosshair & Aim Animations | `src/render/CanvasRenderer.ts`, `src/core/player/` | M3 | DONE |
| M5 | Test Flake Fix & Playwright Visual Suite | `tests/unit/adversarial_challenge.test.ts`, `tests/e2e/visual_verification.spec.ts` | M1, M2, M4 | DONE |
| M6 | Visual Evaluation & 100% Verification | Screenshot capture, `artifacts/VISUAL_EVALUATION.md`, Full test pass | M5 | DONE |

---

## Code Layout
- `src/core/math/`: Vector math, math utilities
- `src/core/physics/`: AABB, spatial hash grid, collision detection
- `src/core/player/`: PlayerKinematics, PlayerController, PlayerState
- `src/core/weapons/`: Weapon logic (Handgun, HMG, Flame Shot, Grenade)
- `src/core/entities/`: Rebel soldiers, vehicles, POWs, bosses
- `src/core/engine/`: StageManager, GameEngine, ObjectPool
- `src/render/`: CanvasRenderer, Camera, parallax backgrounds
- `src/render/sprites/`: ProceduralSpriteFactory (Pixel art generator)
- `src/audio/`: Procedural sound generator, speech formant synthesizer
- `src/ui/`: HUD display, on-screen controls
- `tests/unit/`: Vitest unit tests (kinematics, weapons, enemies, boss, stress)
- `tests/e2e/`: Playwright end-to-end tests & visual verification
- `artifacts/screenshots/`: Captured gameplay visual screenshots
- `artifacts/VISUAL_EVALUATION.md`: Visual evaluation critique
