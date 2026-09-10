## 2026-09-10T15:51:43Z

You are worker_m2_1 (role: Implementation & Testing Worker).
Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md before starting any work. Do not skip this.
Also read:
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3/handoff.md

Your exclusive write ownership:
- src/render/sprites/DarkFantasySprites.ts
- tests/unit/DarkFantasySprites.spec.ts

Implementation Requirements for Milestone 2:
1. `src/render/sprites/DarkFantasySprites.ts`:
   - Elevate procedural sprite rendering from crude shapes to high-fidelity dark fantasy art across all entities:
     - **Player (Grim Sorcerer)**: Layered tattered cowl & hood, flowing robes with dark crimson borders, ethereal bone scythe with purple runic inscriptions and blade glint, triple-layered occult eyes with glow, 4-frame walk bobbing.
     - **Skeleton**: Weathered ivory bone gradients, anatomic ribcage & segmented spine, deep orbital voids with crimson ember pinpoints, skull fracture filigree, rusted iron broadsword with battle notches.
     - **Ghoul**: Hunched feral quadruped posture, gangrenous necrotic flesh gradients, pulsating necrotic boils with wet specular highlights, spinal osteophyte bone spurs, dripping toxic bile fangs, elongated bone talons.
     - **Banshee**: Translucent spectral apparition, floating wisps, weeping veil, luminous cyan/purple additive blending (`globalCompositeOperation = 'lighter'`), wailing mouth.
     - **Death Knight**: Heavy obsidian plate armor with metallic bevels, horned greathelm with glowing crimson visor slit, gold/blood filigree etchings, two-handed runic executioner greatsword.
   - Maintain full compatibility with offscreen canvas atlas caching (120 cached entries: 4 frames x 2 facings x 3 damage flash states).
   - Ensure safe headless fallback in test environments (e.g., safe gradient checks if canvas methods are mocked).
   - Zero NaN coordinates, zero unbounded memory allocations.

2. `tests/unit/DarkFantasySprites.spec.ts`:
   - Comprehensive Vitest unit test suite validating:
     - All entity types (Player, Skeleton, Ghoul, Banshee, Death Knight) render cleanly across all 4 walk frames and 2 facing directions without throwing errors or generating NaNs.
     - Damage flash states (normal, red, white) render properly.
     - Offscreen atlas caching produces valid image buffers.
     - Rendering performance remains locked at 60Hz.

Verification:
- Run `npx vitest run tests/unit/DarkFantasySprites.spec.ts`
- Run `npm test` to verify zero regressions across all test suites
- Run `npx tsc --noEmit` to verify 100% type safety
- Run `npm run build`

Document all changes, commands run, and test outputs in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1/handoff.md`.
Update `progress.md` with your status.
When finished, send a message to orchestrator with your results.
