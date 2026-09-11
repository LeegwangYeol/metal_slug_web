# BRIEFING — 2026-09-11T02:58:15Z

## Mission
Investigate Playwright reliability and deterministic execution of E2E tests: headless browser rendering nuances, requestAnimationFrame pacing in headless Chromium, reliable waiting strategies, and elimination of timing flakes for CI and local test execution.

## 🔒 My Identity
- Archetype: explorer
- Roles: Playwright Reliability & Flakiness Explorer / Codebase Researcher
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3
- Original parent: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Milestone: Milestone 3 (Playwright Reliability & Flakiness)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Abide by communication guidelines and handoff protocol
- Write only to own folder (.agents/explorer_m3_3/)
- Verify all findings with exact line numbers, code references, and commands

## Current Parent
- Conversation ID: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Updated: 2026-09-11T02:58:15Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `COLLABORATION.md`, `.agents/orchestrator_hitbox_camera/SCOPE.md`
  - `playwright.config.ts`, `index.html`, `src/main.ts`
  - `src/render/Camera.ts`, `src/render/GothicBackdrop.ts`, `src/render/sprites/DarkFantasySprites.ts`, `src/render/vfx/DarkFantasyVFX.ts`
  - `src/ui/GothicHUD.ts`, `src/input/KeyboardController.ts`
  - `tests/e2e/game_initialization.spec.ts`, `tests/e2e/horde_survival.spec.ts`, `tests/e2e/restart_survival.spec.ts`, `tests/e2e/challenger_m4_restart_stress.spec.ts`, `tests/e2e/challenger_m4_2_stress.spec.ts`
  - `tests/unit/hitbox_precision.spec.ts`, `tests/unit/camera_tracking.spec.ts`, `tests/unit/DarkFantasySprites.spec.ts`
- **Key findings**:
  - Entire game is pure Canvas 2D (`CanvasRenderingContext2D`); 0 WebGL dependencies.
  - `--disable-gpu` forces CPU software rasterization via Skia; offscreen lighting stencil composite operations (`destination-out`, `lighter`) have CPU overhead.
  - Missing Chromium launch flags for headless CI: `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`.
  - Game attaches only `window.__game` and `window.__GAME__`. `window.game` is missing; tests querying it time out.
  - HUD is 100% canvas-rendered; zero DOM elements exist for health or XP. Tests must check state via `page.evaluate()` or sample pixel data at `(116, 29)`.
  - Deterministic stepping harness (`setupDeterministicGame()`, `g.stop()`, manual `game.step(1/60)`, manual `game.render()`) reduces test duration from 35s to <300ms and guarantees 100% flake-free execution.
  - Benchmark cold-start JIT spikes should exclude warmup frames (frames 1–5) from `maxFrameTimeMs`.
  - Formulated comprehensive test architecture blueprints for `tests/e2e/hitbox_dodge.spec.ts` and `tests/e2e/camera_view.spec.ts`.
- **Unexplored areas**: None remaining for this mission scope.

## Key Decisions Made
- Authored comprehensive 5-component handoff report in `handoff.md`.
- Recommended adding `(window as any).game = game;` to `src/main.ts`.
- Recommended updating `playwright.config.ts` launch args with background throttling prevention flags.
- Provided ready-to-use test blueprints for Milestone 3 E2E test authors.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/DISPATCH.md` — incoming dispatches
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/BRIEFING.md` — persistent memory
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/progress.md` — heartbeat and task log
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/handoff.md` — comprehensive 5-component report
