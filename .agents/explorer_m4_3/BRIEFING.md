# BRIEFING — 2026-09-08T05:25:30Z

## Mission
Design the Visual Proof Screenshot capture system for Milestone M4 (Playwright E2E Integration & Visual Proof Screenshots) targeting `artifacts/expansion/`.

## 🔒 My Identity
- Archetype: explorer
- Roles: [investigation, synthesis]
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M4

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT edit or modify project source code files
- Target directory for screenshots: `artifacts/expansion/`
- Four required visual proof screenshots:
  1. `artifacts/expansion/ultimate_strike_pass.png` (tactical bomber flyover, screen flash/shadow)
  2. `artifacts/expansion/ultimate_detonation_flash.png` (detonation flash overlay, shockwaves, camera shake)
  3. `artifacts/expansion/crisis_boss_encounter.png` (Iron Nokana boss / crisis environmental hazards)
  4. `artifacts/expansion/ally_pow_rescue.png` (POW rescue / Ally Hyakutaro combat)

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T05:25:30Z

## Investigation State
- **Explored paths**:
  - `package.json`, `playwright.config.ts`
  - `tests/e2e/death_animations_screenshots.spec.ts`
  - `tests/e2e/visual_verification.spec.ts`
  - `tests/e2e/gameplay_controls.spec.ts`
  - `src/main.ts` (Bootstrap, FullMetalSlugGame, step/render, window.__GAME__)
  - `src/core/player/UltimateManager.ts` (Cinematic phases, timings, state)
  - `src/render/CanvasRenderer.ts` (renderCinematicFXPass, virtualCtx, blitToCanvas)
  - `src/core/entities/boss/IronNokanaBoss.ts` (4 phases, rage aura, render)
  - `src/core/entities/boss/EnvironmentalHazard.ts` (Reticle, Shell, Debris, Flame, render)
  - `src/core/entities/boss/CrisisEventManager.ts` (Thresholds 75%, 50%, 25%)
  - `src/core/entities/pow/PowEntity.ts` (Hostage states, spawnsAlly)
  - `src/core/entities/allies/AllyNPC.ts`, `AllyManager.ts`, `AllyKiBlast.ts`
  - `src/render/sprites/ProceduralSpriteFactory.ts` (Expansion sprites: bomber, nokana, hazards, hyakutaro, item crates)
- **Key findings**:
  - `window.__GAME__` exposes `engine`, `player`, `camera`, `renderer`, `stageManager`, `keyboard`, and control functions `stop()`, `step(dt)`, `render()`.
  - Pause RAF via `game.stop()`, then advance exact frame counts with `game.step(1/60)` for 100% deterministic screenshots.
  - Ultimate Move timings: FREEZE 0.5s (30f) -> STRIKE_PASS 0.6s (36f) -> DETONATION 0.4s (24f). Frame 48 captures bomber dead center; Frame 69 captures maximum screen flash, shockwaves, and 16px camera shake.
  - Iron Nokana and Hazards have dedicated `render(ctx, camX, camY)` methods that render directly into `game.renderer.virtualCtx`.
  - Directory creation: `mkdir -p artifacts/expansion/` or `fs.mkdirSync(path.resolve(process.cwd(), 'artifacts/expansion'), { recursive: true })`.
  - Playwright screenshot: `await page.locator('#game-canvas').screenshot({ path: outPath })`.
- **Unexplored areas**: None for this subagent scope. Ready for handoff.

## Key Decisions Made
- Visual proof screenshot capture design specifies deterministic step-advance pattern (`game.stop()` + `game.step(1/60)` + `game.render()`) to eliminate browser frame-timing jitter.
- Detailed the exact code blueprint for `tests/e2e/ultimate_and_crisis_expansion.spec.ts`.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/DISPATCH.md — Incoming dispatch log
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/BRIEFING.md — Persistent working memory
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/progress.md — Progress & liveness heartbeat
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/handoff.md — Final 5-component report
