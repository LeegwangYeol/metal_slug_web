# Metal Slug Web — Claude Collaboration Guide & Autonomous Reinvention Plan

> **Project Mission**: Autonomous Reinvention of the web game by a 100-agent swarm into a highly charming, overwhelmingly cute shooter with a completely reinvented, novel gameplay loop breaking away from traditional Metal Slug formula. Deliver cute/charming visuals, autonomous gameplay loop, 15+ second automated Playwright playtest verification, visual proof screenshots, 100% green unit/E2E test suite, and verified production deployment to Vercel via `origin/main`.
> 
> **Core Deliverables**:
> 1. **R1. Overwhelmingly Cute & Charming Art Overhaul**:
>    - Scrap gritty arcade assets and aesthetics.
>    - Implement vibrant, pastel, adorably styled sprites, environments, UI, and visual effects (kawaii / chibi aesthetic, delightful animations, charming particle effects).
> 2. **R2. Autonomous Gameplay Reinvention**:
>    - Break away from the linear run-and-gun formula.
>    - Brainstorm, design, and implement an innovative, engaging, novel shooter mechanic / loop (e.g. cozy rogue-lite arena shooter, sweet bubble/candy collection blaster, pet companion tactical shooter, or dynamic area-clearing joy).
> 3. **R3. Automated Playtesting & Deployment**:
>    - Playwright E2E test that actively plays the new loop for at least 15 seconds without engine or JavaScript errors.
>    - Visual proof screenshot artifacts capturing the cute/charming art direction.
>    - 100% green test suite (Vitest + Playwright).
>    - Git commit & push to `origin/main` with live Vercel deployment verification.
> 
> ---
> 
> ## 📌 Claude Collaboration & Protocol
> - **Primary AI Collaborator**: Claude
> - **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
> - **Current Status**: 🟢 **EXPLICIT USER APPROVAL VERIFIED ("승인", 2026-09-10T05:30:54Z) — AUTONOMOUS SWARM REINVENTION AUTHORIZED**
> - **Trigger Keyword**: When the user enters `내용확인` (Check content), immediately read this file (`COLLABORATION.md`) to integrate the latest guidance from Claude.
> - **Integrity Mode**: development
> 
> ---
> 
> ## 🗺️ Reinvention Architecture & Decomposition
> 
> ### 1. Art & Visual Identity Overhaul (`src/render/`, `src/assets/`, `src/ui/`)
> - Replace military/gritty palettes with vibrant, cheerful, pastel color schemes.
> - Adorable character sprites (e.g., cute chibi hero, delightful fluffy/bouncy opponents, colorful sparkling projectiles).
> - Charming environmental art, cute UI badges, playful score popups, and sparkling hit/clearing effects.
> 
> ### 2. Novel Gameplay Mechanics & Loop (`src/core/`)
> - Redefine game rules beyond linear run-and-gun:
>   - Multi-directional arena survival / capture / defense or dynamic candy/bubble combo shooting.
>   - Synergistic power-ups, charming special moves, and playful enemy behaviors.
>   - Responsive controls, joyful pacing, and zero frustration.
> 
> ### 3. Verification & Playtesting Suite (`tests/`)
> - Unit tests (`tests/unit/`): Logic tests for player abilities, cute enemy behaviors, scoring, and new game loop state transitions.
> - Playwright E2E (`tests/e2e/`): Automated 15+ second continuous gameplay run simulating user input, asserting zero unhandled exceptions, and recording visual screenshots to `artifacts/cute_reinvention/`.
> 
> ### 4. Acceptance Criteria Checklist
> 
> | Criterion | Target | Verification Method | Status |
> | :--- | :--- | :--- | :--- |
> | **R1. Visual Overhaul** | Overwhelmingly cute/charming confectionery fairytale art across all 164 sprite keys, palettes, parallax backgrounds, terrain, crosshairs, and HUD | Vitest suites (`adversarial_sprites_crosshairs.test.ts`, `render_components.test.ts`, `input_and_hud.test.ts`, etc.) | ✅ COMPLETED |
> | **Visual Proof** | Overwhelmingly cute/charming art overhaul | Playwright screenshots in `artifacts/cute_reinvention/` | ✅ COMPLETED |
> | **Playable Core Loop** | New loop played for >= 15 seconds without errors | Playwright E2E test (`tests/e2e/cute_gameplay_loop.spec.ts`) | ✅ COMPLETED |
> | **100% Green Tests** | All unit tests and E2E specs pass | `npm test` (48/48 files, 686/686 green) & `npm run test:e2e` (7/7 suites, 36/36 green) | ✅ COMPLETED |
> | **Deployment** | Pushed to `origin/main` and Vercel build succeeds | Git push logs + Vercel deployment status verification | Pending (M4) |
> 
> ---
> 
> ## 🎨 Milestone M1 — Overwhelmingly Cute & Charming Art Overhaul (COMPLETED)
> - **Joyful Pastel Palettes (`src/render/sprites/Palette.ts`)**:
>   - Replaced gritty military colors with 8 sweet pastel palettes (`PLAYER`, `REBEL`, `POW`, `FIRE`, `VEHICLE`, `FORTRESS`, `HUD`, `TERRAIN`), all strictly adhering to 16-color arrays.
> - **Procedural Sprite Confectionery Reinvention (`src/render/sprites/ProceduralSpriteFactory.ts`)**:
>   - Maintained all 164 canonical baseline sprite keys without exception.
>   - **Player**: Chibi hero with large expressive anime catchlight eyes, rosy blush, fluttering strawberry headband, mint vest, bubble blaster, and happy defeat pose under a fluffy marshmallow cloud.
>   - **Rebel Marchers**: Bouncy marshmallow soldiers with pink pom-pom hats and smiling cartoon faces.
>   - **Rescued POWs**: Adorable captive bunnies with floppy white ears, pink button noses, twitching whiskers, and pastel yellow overalls waving blissfully.
>   - **Vehicles**: *Confectionery Macaron Roller Wagon* with pastel frosting armor, spun-sugar exhaust, and bubble vents.
>   - **End-Boss**: *Grand Sugar Citadel* with gingerbread and waffle ramparts, candy cane turrets, and strawberry syrup cannons.
>   - **Projectiles & Explosions**: Candies, bubblegum pellets, carrot rockets, pastel confetti, popping bubbles, and celebratory fireworks.
> - **Fairytale Sunrise Meadow Parallax (`src/render/ParallaxBackground.ts`)**:
>   - Smiling cartoon sun with rosy blushing cheeks and gentle bobbing animation.
>   - Golden sunrise sky with blushing peach and mint horizon.
>   - Soft pastel rainbow arc bridging the sky.
>   - Heart and bunny-eared puffy clouds.
>   - Sugar candy castles and giant lollipop trees.
>   - Lush mint-green meadow with smiling giant buttercups and crystal turquoise waters.
> - **Confectionery Canvas Renderer (`src/render/CanvasRenderer.ts`)**:
>   - Shortcake strata terrain: strawberry glaze surface, marshmallow cream crust, golden sponge cake, and chocolate biscuit base.
>   - Wafer semi-solid platforms with candy cane stilts and candy rope ladders.
>   - Marshmallow cushions, pastel gift box crates, and soda pop barrels.
>   - Sparkling Star, Sweet Bubble, and Pulsing Heart crosshair visuals with accurate trajectory math preserved.
>   - Bouncy floating score popups (`+100`, `+500`, `+1000`) with soft confectionery drop shadows.
>   - Background set to `#1E162B`.
> - **Charming Confectionery HUD (`src/ui/HUDOverlay.ts`)**:
>   - Frosted glass pastel ribbon header with golden sugar piping and alternating candy pearls.
>   - Warm honey-gold 3D digits with soft drop shadows and sparkling star glints.
>   - Animated chibi hero portrait with blinking anime eye and heart life tokens.
>   - Candy sticker weapon badges with honey ammo digits and pink pretzel infinity symbol.
>   - Peppermint bonbon grenade icon with sparkling star fuse tip.
>   - Rescued bunny pal tally icon.
>   - Glowing star ultimate stock badge `[U]`.
>   - Cheerful boss warning banner (*"★ A CUTE SUGAR BOSS APPROACHES! ★"*) with candy cane hazard stripes.
>   - Bedtime continue screen: Sleepy hero resting under a marshmallow cloud blanket with floating 'zZz' and dream stars.
>   - Whimsical sweet bedtime game over and pause banners.
> - **Verification**:
>   - `npm run build`: 0 TypeScript compilation errors.
>   - `npm test`: 42 of 42 suites passed (596 of 596 tests green).
> 
> ---
> 
> ## 🌟 Milestone M2 — Autonomous Gameplay Reinvention ("Sugar Pop Blossom: Cozy Star Arena") (COMPLETED)
> - **Non-Linear Star Arena (`src/core/cute/CuteArenaCoordinator.ts`)**:
>   - Replaced linear corridor with multi-tiered Blossom Arena containing 3 purifying altars.
> - **Bubble-Trap & Cascade Combo Engine (`src/core/cute/BubbleManager.ts`, `BubbleTrapEntity.ts`)**:
>   - Traps foes in floating iridescent bubbles with buoyancy kinematics.
>   - Player contact, jumping, or projectile hits burst trapped bubbles, emitting 6-shard radial star bursts (at 60° increments).
>   - Chain reaction combos scale from 1x to 10x Miracle Bloom, dropping candy and star crystal pickups.
> - **Mochi the Cloud Bunny Companion (`src/core/cute/PetCompanion.ts`)**:
>   - Spring-damper follower physics with 160px candy vacuuming, auto heart-bolts, and bubble shield.
> - **Blossom Altars & Rogue-Lite Perks (`src/core/cute/ArenaPurificationManager.ts`, `SweetPerkManager.ts`)**:
>   - 3 altars purified by nearby bubble pops; blooming triggers 3-card rogue-lite sweet perk modal.
> - **Cute Enemies & Boss Showdown (`src/core/cute/CuteEnemyManager.ts`)**:
>   - Marshmallow Slimes, Honey Bees, Donut Rollers, and 250 HP Gummy Bear Colossus that splits into 3 Mini Gummy Cubs.
>   - Resolves cleanly to `GARDEN_PURIFIED` state upon cub defeat.
> - **Verification & Remediation**:
>   - Unanimously APPROVED by 2 Reviewers, 2 Challengers, and certified CLEAN by Forensic Integrity Auditor.
>   - `npm run build`: 0 errors.
>   - `npm test`: 47 test files passed, 673 unit tests passed (100% green).
> 
> ---
> 
> ## 🧪 Milestone M3 — Automated Playtesting, Visual Proof Screenshots & Test Hardening (COMPLETED)
> - **Playable Core Loop E2E (`tests/e2e/cute_gameplay_loop.spec.ts`)**:
>   - Multi-phase human-like playtest running actively for 16.3 continuous seconds (exceeding >= 15s requirement).
>   - Zero uncaught page errors or console errors throughout all 5 simulation phases.
>   - Real-time periodic health checks sampled every 1.5s asserting non-NaN, finite coordinates and active entity presence.
> - **Visual Proof Screenshot Artifacts (`artifacts/cute_reinvention/`)**:
>   - `01_cute_hero_and_pastel_world.png` (58 KB): Chibi hero in pastel dreamscape with beating heart HUD and wafer platforms.
>   - `02_cute_combat_and_candy_projectiles.png` (64 KB): Iridescent bubble combat, candy/star pickups, marshmallow slime and bee floaters.
>   - `03_cute_star_blossom_ultimate.png` (62 KB): Sweet star blossom / rainbow sugar rush burst with radial star sparks.
>   - `04_cute_arena_overview.png` (64 KB): Full arena overview with Mochi the Cloud Bunny companion and 3 Blossom Altars.
>   - Automated binary audit verifying PNG magic bytes and exact 960x540 viewport dimensions for all 4 artifacts.
> - **Unit Test Hardening (`tests/unit/cute_sprites_and_palette.test.ts`)**:
>   - 13 comprehensive unit tests validating pastel palette RGBA conversions, luminance contrast, and procedural rendering of cute expansion sprites.
>   - Invariant verified: Canonical baseline keys strictly preserved at exactly 164 unique keys without collisions.
> - **Verification Results**:
>   - `npm run build`: 0 TypeScript compilation errors, bundle created in 404ms.
>   - `npm test`: 48/48 test files passed, 686/686 tests green (100%).
>   - `npx playwright test tests/e2e/cute_gameplay_loop.spec.ts`: 3/3 tests passed (18.2s).
>   - `npm run test:e2e`: 36/36 tests passed across all 7 spec files (33.5s).
> 
> ---
> 
> ## 🚦 Sentinel Management
> 1. Verbatim request logged in `ORIGINAL_REQUEST.md`.
> 2. Dispatch Project Orchestrator (`teamwork_preview_orchestrator`) under General route.
> 3. Sentinel crons active: Progress Reporting (`*/8 * * * *`) and Liveness Check (`*/10 * * * *`)
> 4. Mandatory independent Victory Audit (`teamwork_preview_victory_auditor`) before declaring completion.
