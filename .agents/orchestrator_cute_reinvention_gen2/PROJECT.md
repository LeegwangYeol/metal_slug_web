# Project: Metal Slug Web — Autonomous Cute Shooter Reinvention ("Sugar Pop Blossom: Cozy Star Arena")

## Architecture
Decoupled multi-tier simulation, rendering, and UI architecture:
1. **Simulation Core (`src/core/` & `src/core/cute/`)**:
   - Headless 60Hz fixed timestep simulation.
   - Non-linear multi-tiered Pastel Arena replacing linear 3600px corridor.
   - Bubble-Trap & Sweet Cascade combo mechanics (`BubbleTrapEntity.ts`, `BubbleManager.ts`):
     - Iridescent pastel bubble shots encasing enemies.
     - Radial star bursts (6 shards at 60° angles) triggering chain reactions.
     - Combo multipliers (1x -> 2x -> 3x -> 5x -> 10x Miracle Bloom).
   - Rainbow Sugar Rush (Sweet Fever): 8s invincibility rush at 100% meter.
   - Pet Companion ("Mochi the Cloud Bunny") (`PetCompanion.ts`): candy vacuuming (160px), heart-bolt auto-attacks, bubble shield.
   - Blossom Altars & Rogue-Lite Perks (`ArenaPurificationManager.ts`, `SweetPerkManager.ts`).
   - Cute enemies: Marshmallow Slimes, Honey Bee Floaters, Donut Rollers, Gummy Bear Colossus.
2. **Render Layer (`src/render/`)**:
   - 16:9 widescreen HD canvas (960x540 virtual framebuffer).
   - Joyful pastel palettes in `src/render/sprites/Palette.ts` across all 8 palettes.
   - Chibi Hero sprites with anime catchlight eyes, rosy blush, toy blasters in `src/render/sprites/ProceduralSpriteFactory.ts` (preserving 164 canonical keys).
   - Fairytale dreamscape parallax in `src/render/ParallaxBackground.ts` with smiling sun, heart clouds, rainbow arc.
   - Shortcake ground, frosted wafer decks, candy cane stilts, marshmallow cushions, gift box crates in `src/render/CanvasRenderer.ts`.
   - Floating popups ("+100", "SWEET!", "POP!") and joyful star/heart/confetti particles.
3. **UI & Controls Layer (`src/ui/`)**:
   - Storybook HUD with frosted glass header, honey-gold digits, cute beating heart lives.
   - Cheerful boss warning banner ("★ A BIG CUTE BOSS HAS ARRIVED! ★").
   - Cozy bedtime story continue modal and gentle sweet dreams game over screen.
4. **Verification & Deployment (`tests/`, `artifacts/cute_reinvention/`)**:
   - Continuous 15+ second active Playwright playtest (`tests/e2e/cute_gameplay_loop.spec.ts`) with 0 JS/engine errors.
   - 4 canonical screenshot artifacts in `artifacts/cute_reinvention/`.
   - 100% green Vitest unit tests (48/48 test files, 686 tests) and Playwright E2E (8/8 suites, 38 tests).
   - Git commit `4a6957a`, push to `origin/main`, and verified Vercel production deployment (HTTP/2 200).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Pastel Palette Overhaul | 8 joyful pastel palettes in Palette.ts replacing gritty military colors | M1 | R1, Explorer 1 |
| 2 | Chibi Hero & Sprite Overhaul | Adorable chibi hero with anime eyes, toy blaster, preserving 164 keys | M1 | R1, Explorer 1 |
| 3 | Bouncy Foes & Rescued Pals | Marshmallow troopers, heart cookie shields, rescued bunny/kitten pals | M1 | R1, Explorer 1 |
| 4 | Confectionery Toy Bosses | Macaron Roller Wagon & Grand Sugar Citadel with waffle battlements | M1 | R1, Explorer 1 |
| 5 | Fairytale Meadow Parallax | Smiling sun, heart clouds, rainbow valley, crystal waters in ParallaxBackground | M1 | R1, Explorer 1 |
| 6 | Sweets Terrain & Obstacles | Shortcake strata, wafer decks, candy cane stilts, marshmallow cushions, gift crates | M1 | R1, Explorer 1 |
| 7 | Storybook HUD & Popups | Frosted ribbon header, honey digits, beating hearts, floating "+100"/"SWEET!" | M1 | R1, Explorer 1 |
| 8 | Non-Linear Star Arena | Expansive pastel arena breaking away from 3600px linear forward-locked corridor | M2 | R2, Explorer 2 |
| 9 | Bubble Trap & Radial Star Shards | Iridescent bubble shots encasing foes; 6 radial star shards popping adjacent bubbles | M2 | R2, Explorer 2 |
| 10 | Sweet Cascade Combo System | Chain reaction combos scaling from 1x to 10x Miracle Bloom with candy drops | M2 | R2, Explorer 2 |
| 11 | Rainbow Sugar Rush (Sweet Fever) | 8s invincibility rush at 100% meter with 3-way spread and full-screen magnet | M2 | R2, Explorer 2 |
| 12 | Mochi the Cloud Bunny Pet | Orbit companion with candy vacuuming, heart-bolt attacks, and bubble shield | M2 | R2, Explorer 2 |
| 13 | Blossom Altars & Rogue-Lite Perks | 3 purifying altars blooming flowers and granting 3-card cute perk selection | M2 | R2, Explorer 2 |
| 14 | Cute Enemy Logic & Boss Splitting | Marshmallow slimes, honey bees, donut rollers, gummy bear colossus splitting | M2 | R2, Explorer 2 |
| 15 | 15s Continuous E2E Playtest | Playwright test actively playing 5 phases for >= 15s with 0 errors | M3 | R3, Explorer 3 |
| 16 | Visual Proof Screenshots | 4 canonical 960x540 PNG screenshots captured in artifacts/cute_reinvention/ | M3 | R3, Explorer 3 |
| 17 | 100% Green Test Suite | Complete Vitest and Playwright test suites passing with 0 errors | M3 | R3, Explorer 3 |
| 18 | Git Push to origin/main | Staged, committed, and pushed to main branch on GitHub (commit 4a6957a) | M4 | R3, Explorer 3 |
| 19 | Vercel Deployment Verification | Both production domains verified with HTTP 200 and Ready status | M4 | R3, Explorer 3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Architecture Assessment | Full codebase investigation across render, core loop, testing & deployment | None | DONE |
| M1 | Overwhelmingly Cute & Charming Art Overhaul | Pastel palettes, chibi hero, bouncy foes, candy terrain, storybook HUD, popups | M0 | DONE |
| M2 | Autonomous Gameplay Reinvention | Star arena, bubble trap, cascade combos, pet companion, altars & perks | M1 | DONE |
| M3 | 15s Playtesting, Visual Proof & Test Hardening | Playwright active 15s playtest, visual screenshots, 100% green tests | M2 | DONE |
| M4 | Autonomous Git Push & Vercel Verification | Commit, push to origin/main, verify Vercel production status & HTTP 200 | M3 | DONE |

---

## Interface Contracts

### 1. Render Layer Contracts (`src/render/`)
- Canvas virtual dimensions: 960x540.
- All 8 palette arrays (`PLAYER`, `REBEL`, `POW`, `FIRE`, `VEHICLE`, `FORTRESS`, `HUD`, `TERRAIN`) retain exactly 16 strings.
- `ProceduralSpriteFactory.getAllKeys(false, false)` strictly returns 164 canonical keys.
- Category breakdowns: player (67), rebel (21), pow (9), ironTechnical (7), tetsuyuki (8), projectile (13), casings (4), explosions (18), hud (17).

### 2. Core Simulation Contracts (`src/core/cute/`)
- `RenderBubbleState`: `{ id, x, y, radius, trappedType, isPopping, popProgress, swayAngle }`
- `RenderPetState`: `{ x, y, facing, state: 'hover' | 'fetch' | 'zap' | 'cheer', actionProgress }`
- `RenderAltarState`: `{ id, x, y, purificationProgress, isBloomed }`
- `RenderFeverState`: `{ isActive, meterProgress, remainingTime }`
- `RenderPerkCardState`: `{ id, title, description, icon, rarity }`

### 3. UI Overlay Contracts (`src/ui/HUDOverlay.ts`)
- Storybook HUD header, score digits, lives, weapon stickers, boss warning banner.
- 3-card rogue-lite perk selection modal display.

### 4. Code Layout
- `src/render/sprites/Palette.ts`: Pastel color palette definitions.
- `src/render/sprites/ProceduralSpriteFactory.ts`: Chibi hero, cute creatures, toy weapons.
- `src/render/ParallaxBackground.ts`: Fairytale sunrise meadow, smiling sun, rainbow.
- `src/render/CanvasRenderer.ts`: Confectionery terrain, wafer platforms, star reticles, score popups.
- `src/ui/HUDOverlay.ts`: Storybook HUD, honey-gold digits, continue modal.
- `src/core/cute/`: All novel cute loop systems (`CuteGameTypes.ts`, `BubbleTrapEntity.ts`, `BubbleManager.ts`, `PetCompanion.ts`, `CuteEnemyManager.ts`, `ArenaPurificationManager.ts`, `SweetPerkManager.ts`).
- `tests/unit/`: Unit tests for cute mechanics and palette invariants.
- `tests/e2e/cute_gameplay_loop.spec.ts`: Active 15s playtest.
- `artifacts/cute_reinvention/`: Visual proof screenshot captures.
