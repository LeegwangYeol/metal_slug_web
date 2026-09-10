# Project: Metal Slug Web (Full Metal Slug) — UI/UX & Level Design Overhaul

## Architecture
Decoupled multi-tier simulation, rendering, and UI architecture:
1. **Simulation Core (`src/core/`)**:
   - Decoupled from DOM/Window/Canvas.
   - Fixed 60Hz semi-implicit Euler timestep.
   - Enhanced multi-tier platform collision & drop-through resolution (`Platform.ts`, `PlayerController.ts`).
   - Dynamic paratrooper ground/platform resolution (`SoldierEnemy.ts`).
   - Destructible cover obstacles (`DestructibleObstacle.ts`: sandbag barricades, supply crates, explosive fuel barrels).
   - Player death & respawn lifecycle: `ALIVE` -> `DYING` (1.2s knockback arc) -> `RESPAWN_PARACHUTE` / `CONTINUE_COUNTDOWN` (10s timer) -> `GAME_OVER`.
2. **Render Layer (`src/render/`)**:
   - Upgraded to modern 16:9 widescreen HD: 960x540 internal canvas framebuffer with crisp pixelated CSS display scaling, eliminating claustrophobia.
   - Expanded dynamic camera tracking (>528px forward vision) and spacious 1100px boss arenas.
   - Modular parallax background tiling supporting 960px+ seamlessly.
   - Charming retro-arcade aesthetics: vibrant tropical azure palette, expressive chibi-arcade proportions, bouncy visual feedback.
3. **UI & Controls Layer (`src/ui/`)**:
   - Classic arcade Continue countdown screen (10s timer, large 9..0 digits, press Fire/Jump to continue).
   - Polished arcade tutorial & controls guide banner/overlay (WASD/Arrows, J/Z Fire, K/X Jump, L/C Grenade, U Ultimate, auto-dismiss & `[H]` toggle).
   - HUD overhaul: cute animated Marco portrait, Ultimate Move stock gauge, bomb fuse, and beveled metallic arcade framing.
4. **Testing & Visual Verification (`tests/`, `artifacts/ui_overhaul/`)**:
   - Playwright visual proof: `artifacts/ui_overhaul/screen_terrain.png` and `artifacts/ui_overhaul/respawn_tutorial.png`.
   - 100% green Vitest unit test suite (asserting platforms, drop-through, continue countdown, tutorial state).
   - 100% green Playwright E2E browser tests and 0 TypeScript errors.
   - Autonomous Git commit, push to `origin/main`, and Vercel deployment status confirmation.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 16:9 HD Resolution (960x540) | Modern 16:9 canvas framebuffer with crisp integer pixel scaling | M1 | R1, Explorer 1 |
| 2 | Widescreen Camera & Arenas | Camera deadzones (>528px forward sight) and spacious 1100px boss arenas | M1 | R1, Explorer 1 |
| 3 | Parallax Background Tiling | Modular horizontal multi-buffer wrapping without edge cutoffs | M1 | R1, Explorer 1 |
| 4 | Charming Arcade Visuals | Vibrant tropical palette, expressive chibi proportions, charming sprites | M1 | User Feedback, Explorer 1 |
| 5 | Multi-Tier Platform System | 24 platforms across 5 zones (stilt docks, towers, bridges, catwalks) | M2 | R1, Explorer 2 |
| 6 | Stepped Terrain & Elevation | Ground elevation variation, sand dunes, tidal dips, sunken trenches | M2 | R1, Explorer 2 |
| 7 | Destructible Cover Obstacles | Sandbag barricades, supply crates, and red explosive fuel barrels | M2 | R1, Explorer 2 |
| 8 | Platform Drop-Through Fix | Fix freeze bug by caching `ignoredPlatformId` at drop initiation | M2 | BugHunt, Explorer 2 |
| 9 | Paratrooper Dynamic Landing | Paratroopers check `PlatformPhysics.resolveGroundContact` to land on towers | M2 | R1, Explorer 2 |
| 10 | Authentic Player Death Arc | 1.2s knockback arc using pre-rendered `player_death_0..3` frames | M3 | R2, Explorer 3 |
| 11 | Arcade Continue Countdown | 10s countdown timer with large 9..0 digits and continue re-entry | M3 | R2, Explorer 3 |
| 12 | Tactical Parachute Respawn | Respawn drop-in from screen top with parachute canopy & 2.5s invulnerability | M3 | R2, Explorer 3 |
| 13 | On-Screen Tutorial & Controls | Arcade instruction placard showing WASD/Arrows, J/Z, K/X, L/C, U | M3 | R2, Explorer 3 |
| 14 | HUD Polish & Ultimate Stock | Cute Marco portrait, Ultimate stock meter, bomb fuse, metallic bevels | M3 | R2, Explorer 3 |
| 15 | Visual Proof Screenshots | Capture `screen_terrain.png` and `respawn_tutorial.png` in `artifacts/ui_overhaul/` | M4 | R3, Acceptance |
| 16 | 100% Green Test Suite | Vitest and Playwright test suites passing with 0 TypeScript compilation errors | M4 | R3, Acceptance |
| 17 | Autonomous Git Commit & Push | Autonomous commit and push to `origin/main` on GitHub | M5 | R3, Acceptance |
| 18 | Vercel Deployment Verification | Check Vercel build status and deployment logs to confirm success | M5 | R3, Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Architecture Assessment | Full codebase investigation across viewport, terrain, UI, and test suite | None | DONE |
| M1 | 16:9 HD Screen & Viewport Expansion | Canvas 960x540, dynamic camera, parallax tiling, charming arcade styling | M0 | DONE |
| M2 | Level Design & Terrain System Overhaul | 24 platforms, 5 zones, destructible obstacles, paratrooper landing, drop-through fix | M1 | DONE |
| M3 | Death, Respawn Flow & Tutorial UI | Death arc, 10s continue countdown, parachute respawn, tutorial placard, HUD ultimate gauge | M1 | DONE |
| M4 | E2E Visual Verification & Test Hardening | Playwright screenshots in artifacts/ui_overhaul/, 100% green tests | M2, M3 | DONE |
| M5 | Autonomous Git Push & Vercel Verification | Commit, push to origin/main, check Vercel build status & logs | M4 | IN_PROGRESS |

---

## Interface Contracts

### 1. Viewport & Camera Contract (M1)
- `CanvasRenderer.VIRTUAL_WIDTH = 960;`
- `CanvasRenderer.VIRTUAL_HEIGHT = 540;`
- `<canvas>` element dimensions: `960` x `540` with `image-rendering: pixelated;`
- Camera viewport: width `960`, height `540`. Forward deadzone: `~528px`.
- Mid-boss and Boss camera lockdown widths expanded to `1100px`.

### 2. Level Design & Platform Contract (M2)
- Stage bounds: `STAGE_WIDTH = 3600`, `STAGE_HEIGHT = 540`.
- Ground line base at `Y = 460` (or `Y = 230` scaled accordingly), with stepped elevations.
- Preserved platform IDs: `boss_arena_left` at `(x: 1860, y: 170, w: 100, h: 12)` or mapped coordinate preserving crisis tests, `midboss_dock_left`, `midboss_dock_right`, `tower_platform`, `bunker_2`.
- Destructible obstacle types: `'SANDBAG_BARRICADE'`, `'SUPPLY_CRATE'`, `'EXPLOSIVE_BARREL'`.

### 3. Death & Respawn Contract (M3)
- Player states:
  - `PlayerActionState.DYING`: 1.2s knockback arc, cycling `player_death_0..3`.
  - `PlayerActionState.RESPAWNING_PARACHUTE`: starts at `Y = 20`, controlled descent at `vy = 60 px/s`, canopy attached, 2.5s invulnerability flashing.
- Continue Countdown:
  - 10s countdown timer when `lives <= 0`.
  - Digit rendering: 9..0.
  - On Fire or Jump button: resets lives to 3, drops in with parachute.
  - On timer expiration: transitions to final Game Over banner.
- Tutorial Placard:
  - Visible on game start, 5s auto-dismiss or toggle with key `H`.
  - Displays movement, shoot, jump, grenade, ultimate bindings.
