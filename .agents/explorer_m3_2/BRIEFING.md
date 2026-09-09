# BRIEFING — 2026-09-08T04:24:00Z

## Mission
Investigate ProceduralSpriteFactory.ts and CanvasRenderer.ts for Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX) with strict test preservation and 164-key invariant.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M3

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Preserve the crucial invariant: default getAllKeys() MUST return exactly 164 keys
- Write only to our own directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2
- Communicate via send_message to parent (id: 05969896-3516-4d88-a516-8ffeaafab39c)

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T04:20:26Z

## Investigation State
- **Explored paths**:
  - `src/render/sprites/ProceduralSpriteFactory.ts` (lines 381-411, 450-480, 1140-1250)
  - `src/render/CanvasRenderer.ts` (lines 1-1006 complete inspection)
  - `tests/unit/adversarial_sprites_crosshairs.test.ts` (tasks 1-4, exact 164-key & category audit assertions)
  - `tests/unit/render_components.test.ts` (suite assertions for factory & renderer)
  - `src/main.ts` (`compileSceneState()`, entity render mapping, sound bus wiring)
  - `src/audio/SoundEngine.ts` and `src/audio/AudioTypes.ts`
  - `src/core/entities/items/ItemPickup.ts`, `src/core/entities/boss/IronNokanaBoss.ts`, `src/core/entities/boss/EnvironmentalHazard.ts`
- **Key findings**:
  1. Invariant 164 keys: `adversarial_sprites_crosshairs.test.ts` Oracle 1E strictly asserts `expect(allKeys.length).toBe(164)` and category counts: player: 67, rebel: 21, pow: 9, ironTechnical: 7, tetsuyuki: 8, projectile: 13, casings: 4, explosions: 18, hud: 17.
  2. Isolation mechanism: `polishKeys` set already filters 14 keys from `getAllKeys(includePolish = false)`. Adding `expansionKeys: Set<string>` and updating `getAllKeys(includePolish = false, includeExpansion = false)` isolates all 41 new expansion sprites completely while keeping `hasSprite()`, `getSprite()`, and `drawSprite()` 100% accessible.
  3. Cinematic FX in CanvasRenderer: CanvasRenderer lacks passes for Screen Flash, Tactical Bomber Airstrike flyover, Shockwave rings, Item crates, Allies, and Crisis warning reticles. Adding optional fields to `RenderSceneState` ensures zero breakage for existing tests while enabling full cinematic presentation.
- **Unexplored areas**: None for M3 sprite & render architecture.

## Key Decisions Made
- Use `registerExpansionSprite(...)` pattern to auto-populate `expansionKeys: Set<string>` to prevent accidental key leakage.
- Extend `RenderSceneState` with optional fields (`allies?`, `items?`, `hazards?`, `cinematicFX?`) to preserve existing call signatures.
- Place screen flash overlay in Pass 4.8 right before the HUD (Pass 5) so HUD score/lives/ammo stay legible during full-screen detonations.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/DISPATCH.md — record of incoming dispatch instructions
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/BRIEFING.md — persistent working memory
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/progress.md — liveness heartbeat
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/handoff.md — comprehensive investigation report
