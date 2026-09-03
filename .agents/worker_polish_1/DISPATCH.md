# DISPATCH — Worker Polish 1

## Mission
Implement the full Polish Milestone for Metal Slug Web:
1. R1: Diverse Enemy Spawning (Parachute drops from Y < 50, descent velocity 40-60 px/s, sinusoidal sway, ground touchdown at Y=230, canopy detachment; Trench/structure ambushes with leap-out ballistic arcs).
2. R2: Varied Death Animations & Particle FX (Standard falling collapse, explosion blowback with ballistic tumble & detached flying Stahlhelm helmet, flamethrower burning with flame particles, charred silhouette, and ash crumble collapse). Decouple visual corpses in `DeathCorpseManager` so `SoldierEnemy.isAlive === false` immediate entity culling test invariants are preserved.
3. R3: Bug Remediation & Polish across the 7 cataloged defects (damage dispatch normalization, instant despawn, player damage collision, death voice grunts/scream audio synthesis in SoundEngine, mid-boss add coordinates, spawn monotony, HUD ammo glitch) and produce the comprehensive Markdown report `BUG_HUNT_REPORT.md`.
4. Verification & Screenshots:
   - Unit tests in `tests/unit/diverse_spawning.test.ts` and `tests/unit/death_animations.test.ts`.
   - Playwright screenshot spec `tests/e2e/death_animations_screenshots.spec.ts` capturing:
     - `artifacts/death_animations/death_standard.png`
     - `artifacts/death_animations/death_explosion_blowback.png`
     - `artifacts/death_animations/death_burning.png`
   - Ensure `npm run build`, `npx vitest run`, and `npx playwright test` are 100% green with zero regressions.

## File Ownership
Worker Polish 1 has EXCLUSIVE write ownership of:
- `src/core/entities/enemies/EnemyTypes.ts`
- `src/core/entities/enemies/SoldierEnemy.ts`
- `src/core/entities/enemies/DeathCorpseManager.ts`
- `src/core/weapons/ProjectileManager.ts`
- `src/core/weapons/Grenade.ts`
- `src/core/player/PlayerController.ts`
- `src/render/sprites/ProceduralSpriteFactory.ts`
- `src/render/CanvasRenderer.ts`
- `src/audio/AudioTypes.ts` & `src/audio/SoundEngine.ts`
- `src/main.ts`
- `BUG_HUNT_REPORT.md`
- `tests/unit/diverse_spawning.test.ts`
- `tests/unit/death_animations.test.ts`
- `tests/e2e/death_animations_screenshots.spec.ts`
- `artifacts/death_animations/`

## Mandatory Input Documents
- `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
- `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
- `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/handoff.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/handoff.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-04T00:23:14+09:00
You are Worker Polish 1.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md before starting work. Do NOT summarize or filter it — read the path as-is.
Also read:
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive file write ownership:
- src/core/entities/enemies/EnemyTypes.ts
- src/core/entities/enemies/SoldierEnemy.ts
- src/core/entities/enemies/DeathCorpseManager.ts (new file)
- src/core/weapons/ProjectileManager.ts
- src/core/weapons/Grenade.ts
- src/core/player/PlayerController.ts
- src/render/sprites/ProceduralSpriteFactory.ts
- src/render/CanvasRenderer.ts
- src/audio/AudioTypes.ts & src/audio/SoundEngine.ts
- src/main.ts
- BUG_HUNT_REPORT.md (new file)
- tests/unit/diverse_spawning.test.ts (new file)
- tests/unit/death_animations.test.ts (new file)
- tests/e2e/death_animations_screenshots.spec.ts (new file)
- artifacts/death_animations/ (screenshot files)

Implement:
1. R1. Diverse Enemy Spawning
2. R2. Varied Death Animations
3. R3. Proactive Bug Hunt & Remediation
4. Acceptance Criteria & Test Execution

