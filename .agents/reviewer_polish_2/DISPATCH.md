# DISPATCH — Reviewer Polish 2

## Mission
Perform independent, adversarial review of the changes delivered in the Polish Milestone (R1 Diverse Spawning, R2 Varied Death Animations, R3 Bug Hunt & Polish).

## Review Focus
1. Examine code correctness, completeness, robustness, and potential regressions:
   - Check physics stability, numerical edge cases (dt spikes, NaN protection, coordinate boundaries).
   - Check sprite rendering safety in `CanvasRenderer.ts` and `ProceduralSpriteFactory.ts` (rotation, alpha, clipping, coordinate transforms).
   - Check Web Audio stability in headless vs browser environments (`SoundEngine.ts`).
   - Check `DeathCorpseManager.ts` memory limits and particle lifecycle management.
   - Inspect `BUG_HUNT_REPORT.md` for completeness and technical accuracy.
   - Inspect visual artifacts in `artifacts/death_animations/`: `death_standard.png`, `death_explosion_blowback.png`, `death_burning.png`.
2. Run verification commands:
   - `npm run build`
   - `npm test` (`npx vitest run`)
   - `npm run test:e2e` (`npx playwright test`)
3. Output your formal verdict (`APPROVE` or `REQUEST_CHANGES`) with detailed evidence in `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_polish_2/handoff.md`.

MANDATORY: Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_polish_1/handoff.md` before reviewing.
