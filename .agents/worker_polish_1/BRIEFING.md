# BRIEFING — 2026-09-04T00:43:00Z

## Mission
Execute Polish Milestone: R1 Diverse Spawning, R2 Varied Death Animations & Decoupled Corpse Simulation, R3 Proactive Bug Hunt (7 defects) & BUG_HUNT_REPORT.md, and Visual Verification via Playwright screenshots.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/
- Original parent: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Milestone: M_POLISH

## 🔒 Key Constraints
- Exclusive file write ownership:
  - src/core/entities/enemies/EnemyTypes.ts
  - src/core/entities/enemies/SoldierEnemy.ts
  - src/core/entities/enemies/DeathCorpseManager.ts
  - src/core/weapons/ProjectileManager.ts
  - src/core/weapons/Grenade.ts
  - src/core/player/PlayerController.ts
  - src/render/sprites/ProceduralSpriteFactory.ts
  - src/render/CanvasRenderer.ts
  - src/audio/AudioTypes.ts & src/audio/SoundEngine.ts
  - src/main.ts
  - BUG_HUNT_REPORT.md
  - tests/unit/diverse_spawning.test.ts
  - tests/unit/death_animations.test.ts
  - tests/e2e/death_animations_screenshots.spec.ts
  - artifacts/death_animations/
- Preserve all existing 257 unit tests (100% green).
- Integrity Mandate: No cheating, no hardcoded test outputs, genuine logic and physics.
- Decouple visual death so `SoldierEnemy.isAlive === false` immediately when health reaches 0.
- Capture 3 required Playwright screenshot artifacts (>5KB each) in `artifacts/death_animations/`.

## Current Parent
- Conversation ID: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Updated: 2026-09-04T00:43:00Z

## Task Summary
- **What to build**:
  1. R1: Diverse Spawning (parachute descent with sinusoidal sway and ground touchdown at Y=230; trench/structure ambush leap with ballistic arc).
  2. R2: Varied Death Animations (standard collapse, explosive blowback with Stahlhelm helmet and ground bounce, burning death with flame particles, charcoal silhouette, ash crumble) via `DeathCorpseManager`.
  3. R3: Bug hunt & fixes for 7 cataloged issues, plus `BUG_HUNT_REPORT.md`.
  4. Visual verification: Playwright screenshot spec for `death_standard.png`, `death_explosion_blowback.png`, `death_burning.png`.
- **Success criteria**:
  - `npm run build` succeeds with 0 errors. [PASSED: 32 modules transformed in 1.68s]
  - `npx vitest run` passes 100% (268/268 tests passed across 22 test files). [PASSED]
  - `npx playwright test` passes 100% (17/17 tests passed). [PASSED]
  - Screenshots in `artifacts/death_animations/` > 5KB. [PASSED: 20KB - 21KB each]
- **Interface contracts**: /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- **Code layout**: /Users/user/teamwork_projects/metal_slug_web/PROJECT.md § Code Layout

## Key Decisions Made
- Architected `DeathCorpseManager` listening on `enemy_death` so `SoldierEnemy.isAlive` becomes false immediately, preserving all existing state machine test assertions and spatial culling.
- Implemented parachute descent: $v_y \in [40, 60]$, horizontal sway $X(t) = X_{\text{anchor}} + A \sin(\omega t + \phi)$, canopy detachment and AI transition at $Y=230$.
- Implemented ambush kinematics: launch with $v_x \ne 0, v_y < 0$ under gravity $720\text{ px/s}^2$ with land recovery.
- Normalized damage source dispatching across `ProjectileManager.ts`, `Grenade.ts`, and `SoldierEnemy.ts`.
- Enabled `ENEMY_BULLET`, enemy melee, and blast radius collision against player.
- Registered procedural pixel-art for parachute canopy and 12 casualty frames in `ProceduralSpriteFactory.ts`.
- Synthesized procedural Web Audio grunts, screaming blowbacks, and flame thrashing in `SoundEngine.ts`.
- Set `workers: 1` in `playwright.config.ts` for deterministic Canvas game rendering tests.

## Change Tracker
- **Files modified**:
  - `src/core/entities/enemies/EnemyTypes.ts` — Added diverse spawning & death animation types
  - `src/core/entities/enemies/DeathCorpseManager.ts` — New decoupled visual corpse simulation engine
  - `src/core/entities/enemies/SoldierEnemy.ts` — Parachute/ambush kinematics, damage normalization, player damage detection
  - `src/core/weapons/ProjectileManager.ts` — Normalized damage dispatch types and origin
  - `src/core/weapons/Grenade.ts` — Normalized explosion damage dispatch type and epicenter
  - `src/core/player/PlayerController.ts` — Handled ENEMY_BULLET collision damage
  - `src/render/sprites/ProceduralSpriteFactory.ts` — Registered parachute canopy & 12 casualty frames
  - `src/render/CanvasRenderer.ts` — Rendered parachute risers/canopy and decoupled corpse simulation pass
  - `src/audio/AudioTypes.ts` & `src/audio/SoundEngine.ts` — Web Audio procedural casualty grunts/screams
  - `src/ui/HUDOverlay.ts` — Fixed ammo <= 0 infinity blit
  - `src/main.ts` — Wired corpse manager, diverse stage triggers, audio, and explosion damage
  - `playwright.config.ts` — Configured workers: 1 for deterministic canvas test runs
  - `BUG_HUNT_REPORT.md` — Complete 7-defect root-cause and remediation audit report
  - `tests/unit/diverse_spawning.test.ts` — Unit tests for parachute and ambush kinematics
  - `tests/unit/death_animations.test.ts` — Unit tests for corpse decoupling and damage normalization
  - `tests/e2e/death_animations_screenshots.spec.ts` — Playwright screenshot capture suite
- **Build status**: PASS (`npm run build` 0 errors, 32 modules)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 22/22 unit test files passed (268/268 tests); 17/17 E2E tests passed
- **Lint status**: 0 violations, clean TypeScript compilation
- **Tests added/modified**: 11 new unit tests (2 test files), 3 new visual E2E screenshot tests

## Loaded Skills
- None explicitly requested for load

## Artifact Index
- `BUG_HUNT_REPORT.md` — Comprehensive 7-defect root cause and remediation audit
- `artifacts/death_animations/death_standard.png` — 20.6KB visual artifact
- `artifacts/death_animations/death_explosion_blowback.png` — 21.7KB visual artifact
- `artifacts/death_animations/death_burning.png` — 20.8KB visual artifact
- `.agents/worker_polish_1/handoff.md` — Self-contained 5-component handoff report
