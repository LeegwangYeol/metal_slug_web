# Metal Slug Web (Full Metal Slug) — Claude Collaboration Guide

> **Project Mission**: Overhaul the Metal Slug web game's UI/UX and level design. Modernize screen size/viewport (16:9 HD), enrich terrain and platform obstacles, implement smooth death/continue/respawn loops, provide intuitive on-screen tutorials and controls explanations, ensure 100% green tests, commit & push to GitHub `main`, and verify Vercel deployment.
> 
> **Core Deliverables**:
> 1. **R1. Screen Size & Level Design (Terrain)**:
>    - Modernize game resolution/viewport (16:9 HD aspect ratio) for an expansive arcade feel without feeling cramped.
>    - Overhaul level design by introducing rich terrain variation, tactical obstacles, elevated platforms, and detailed parallax background scenery.
> 2. **R2. Death, Respawn, and UI/Explanations**:
>    - Implement a polished, seamless death and respawn flow featuring a classic arcade Game Over / Continue countdown screen with smooth fade/transition effects.
>    - Create an intuitive tutorial overlay and HUD control explanations so players immediately understand movement, firing, jumping, grenades, and ultimate abilities.
> 3. **R3. Rigorous Verification & Git Deployment**:
>    - Vitest unit tests asserting terrain collision, respawn state transitions, and UI overlays.
>    - Playwright E2E browser tests capturing visual proof:
>      - Expanded viewport and detailed terrain/obstacles (`artifacts/ui_overhaul/screen_terrain.png`).
>      - Polished Continue/Restart screen and tutorial overlay (`artifacts/ui_overhaul/respawn_tutorial.png`).
>    - Zero TypeScript errors and 100% green test suite.
>    - Autonomous Git commit and push to `origin/main` followed by Vercel deployment verification.
> 
> ---
> 
> ## 📌 Claude Collaboration & Protocol
> - **Primary AI Collaborator**: Claude
> - **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
> - **Current Status**: 🟢 **EXPLICIT USER APPROVAL VERIFIED ("허용", 2026-09-10T00:52:02Z) — UI/UX & LEVEL DESIGN OVERHAUL IN PROGRESS**
> - **Critical User Feedback (2026-09-10T00:53:24Z)**:
>   - *"Based on the original, it's not cute/charming at all, and it feels very stifling/claustrophobic."*
>   - Explicit direction: Make the visual aesthetic much more **"cute / charming / appealing" (아기자기한 느낌)** with expressive proportions and retro arcade sprite flair.
>   - Widescreen camera, spacious layout, and dynamic framing must completely eliminate any **"stifling / claustrophobic" (답답한)** feeling, giving players ample breathing room and panoramic stage visibility.
> - **Trigger Keyword**: When the user enters `내용확인` (Check content), the team immediately reviews this file (`COLLABORATION.md`) to integrate Claude's feedback.
> - **Rule Constraint**: Explicit user approval verified. Swarm execution authorized.
> 
> ---
> 
> ## 🗺️ Technical Architecture & Decomposition
> 
> ### 1. Viewport & Canvas Resolution (`src/render/`, `index.html`)
> - Upgrade base canvas dimensions and CSS styling to modern 16:9 widescreen HD layout (e.g. 960x540 or 1280x720 internal resolution scaled crisply).
> - Adjust camera scrolling bounds, HUD positioning, and parallax layers to accommodate the widescreen view seamlessly.
> 
> ### 2. Level Design & Terrain System (`src/core/stage/`, `src/core/physics/`)
> - Multi-tier platforms, bunker obstacles, destructible barricades, and varied elevation ground contours.
> - Dynamic obstacle collision handling ensuring smooth player navigation and jump dynamics.
> 
> ### 3. Death, Respawn, & UI Flow (`src/core/game/`, `src/ui/`)
> - Death sequence: Dramatic player demise animation, followed by arcade countdown "CONTINUE 9... 8...".
> - Respawn: Parachute drop-in or tactical re-entry with brief invulnerability flashing.
> - Tutorial Overlay: First-time control guide banner/overlay (WASD/Arrows to move, J/Z fire, K/X jump, L/C grenade, U/Space ultimate).
> 
> ### 4. Verification & Acceptance Criteria
> 
> | Criterion | Verification Target | Method |
> | :--- | :--- | :--- |
> | **Screen & Terrain** | 16:9 viewport with rich platforms & obstacles | Playwright screenshot in `artifacts/ui_overhaul/` |
> | **UI & Respawn** | Polished Continue countdown & tutorial overlay | Playwright screenshot in `artifacts/ui_overhaul/` |
> | **100% Green Tests** | All Vitest and Playwright tests passing | `npm run test` / `npx vitest run` & `npx playwright test` |
> | **Git & Vercel** | Pushed to `origin/main` and Vercel build confirmed | Git push logs + Vercel deployment status verification |
> 
> ---
> 
> ## 🚦 Sentinel Coordination
> 1. Verbatim request logged in `ORIGINAL_REQUEST.md`.
> 2. Dispatch Project Orchestrator (`teamwork_preview_orchestrator`) under General route.
> 3. Sentinel crons active: Progress Reporting (`*/8 * * * *`) and Liveness Check (`*/10 * * * *`).
> 4. Mandatory independent Victory Audit (`teamwork_preview_victory_auditor`) before declaring completion.
> 
> ---
> 
> ## 🎯 M3 Status Update (2026-09-10T01:52:00Z)
> - **Worker**: `worker_m3_ui_respawn`
> - **Deliverables Completed**:
>   1. **Player Death Sequence**: 1.2s knockback arc (`vy = -260, vx = facing * -80`, gravity applied, ground sprawl friction), cycling `player_death_0..3` frames with input lock.
>   2. **Tactical Parachute Respawn**: Drops in from screen top (`Y = 20, vy = 60 px/s`) with sinusoidal sway, lateral steering, mid-air firing, and smooth ground/platform contact resolution triggering 2.5s flashing invulnerability.
>   3. **Arcade Continue Countdown**: 10.0s countdown with prominent pixel-art digits, coin prompt, distressed mini Marco, and Fire (`J`/`Z`) or Jump (`K`/`X`/`Space`) re-entry resetting lives to 3; final Game Over banner on expiry.
>   4. **On-Screen Tutorial Placard**: Complete arcade instruction placard with keybindings grid (`WASD`/Arrows, `J`/`Z`, `K`/`X`/`Space`, `L`/`C`, `U`, `H`), 5s auto-dismiss with smooth 1s fade, and manual `KeyH` toggle.
>   5. **HUD Polish**: Beveled metallic arcade top framing with gold highlights and bronze bezels, cute mini Marco lives counter with blinking eye and fluttering headband ribbon, animated sizzling bomb fuse spark, and `[U]` Ultimate Move stock meter.
>   6. **Unit Tests**: 19 new comprehensive unit tests in `tests/unit/death_respawn_ui.test.ts`. Full test suite 100% green (41/41 test files, 578 tests passed).
