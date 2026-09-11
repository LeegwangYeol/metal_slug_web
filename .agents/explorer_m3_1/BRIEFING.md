# BRIEFING — 2026-09-11T02:56:55Z

## Mission
Investigate Playwright E2E setup and design `tests/e2e/hitbox_dodge.spec.ts` for verifying near-miss grazing (12-20px, 0 damage) and collision damage.

## 🔒 My Identity
- Archetype: explorer
- Roles: read-only investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1
- Original parent: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Milestone: Milestone 3

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Never modify project source code directly
- Produce structured 5-component handoff report in handoff.md
- Wait for user confirmation for implementation if applicable

## Current Parent
- Conversation ID: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Updated: 2026-09-11T02:56:55Z

## Investigation State
- **Explored paths**: `playwright.config.ts`, `package.json`, `tests/e2e/*`, `src/main.ts`, `src/core/entities/Player.ts`, `src/core/HordeManager.ts`, `src/core/entities/EnemyTypes.ts`, `src/render/Camera.ts`, `src/render/vfx/DarkFantasyVFX.ts`, `src/input/KeyboardController.ts`
- **Key findings**:
  - WebServer command in `playwright.config.ts`: `kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview` at `http://localhost:4173`.
  - Game exposed on `window.__game` and `window.__GAME__` with `#game-canvas` (960x540) inside `#game-container`.
  - Contact damage logic in `src/main.ts:465-487` uses narrowphase check `distSq <= (Player.COLLISION_RADIUS + enemy.radius)^2 + 1e-3` with `Player.COLLISION_RADIUS = 11.0px`.
  - Legacy +15px padding bug caused contact damage at distances up to 45px (12-20px gap beyond physical contact). The fix now ensures 0 damage in that zone.
  - Complete 4-test suite designed for `tests/e2e/hitbox_dodge.spec.ts`: live dynamic weaving, deterministic 12-20px near-miss grazing (0 damage), physical collision damage, and visual proof screenshot (`hitbox_precision_dodge.png` > 50KB).
- **Unexplored areas**: None. Investigation complete and documented.

## Key Decisions Made
- Formulated dual testing strategy (live dynamic weaving + deterministic archetype grazing) to guarantee both gameplay authenticity and 100% CI reproducibility.
- Created complete, production-ready specification and code in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — Incoming dispatch record
- `BRIEFING.md` — Persistent working memory
- `progress.md` — Heartbeat and progress tracking
- `handoff.md` — 5-component handoff report with full test suite code design
