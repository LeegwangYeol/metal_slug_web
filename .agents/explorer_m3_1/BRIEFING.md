# BRIEFING — 2026-09-08T04:24:45Z

## Mission
Investigate core mechanics, input wiring, viewport queries, and simulation architecture for the M3 Ultimate Move System.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: explorer, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M3_ULTIMATE_FX

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT edit or modify source code files
- Always wait for explicit user approval before proceeding with implementation (approval already verified in ORIGINAL_REQUEST.md line 160)
- Deliver findings via handoff.md and send_message to parent

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T04:24:45Z

## Investigation State
- **Explored paths**:
  - `src/input/KeyboardController.ts` & `src/input/TouchVirtualPad.ts`
  - `src/core/player/PlayerController.ts` & `src/core/player/PlayerKinematics.ts`
  - `src/core/engine/GameEngine.ts` & `src/core/engine/StageManager.ts`
  - `src/render/Camera.ts` & `src/render/CanvasRenderer.ts`
  - `src/audio/SoundEngine.ts` & `src/audio/AudioTypes.ts`
  - `src/core/entities/enemies/SoldierEnemy.ts`, `MidBossVehicle.ts`
  - `src/core/entities/boss/TetsuyukiBoss.ts`, `IronNokanaBoss.ts`, `BossTypes.ts`, `CrisisEventManager.ts`
  - `src/render/sprites/ProceduralSpriteFactory.ts`
  - `tests/unit/adversarial_controls_jump.test.ts` (KeyX invariant verified!)
  - `tests/unit/adversarial_sprites_crosshairs.test.ts` (164 sprite key baseline verified!)
- **Key findings**:
  1. `src/core/player/UltimateManager.ts` does not exist and must be created.
  2. In `KeyboardController.ts`, `KeyX` is currently mapped to `jump` and tested in `adversarial_controls_jump.test.ts`. `KeyX` must remain jump. `KeyU` (and 'u') must be mapped to the new action `'ultimate'`.
  3. `PlayerInputSnapshot` in `PlayerKinematics.ts` should have `ultimatePressed?: boolean`.
  4. `PlayerController` needs `triggerUltimateMove(engine: GameEngine): boolean` and internal `UltimateManager`.
  5. 4-Phase Cinematic Pipeline mapped:
     - Phase 1 (0.5s): Freeze frame + air-raid siren (`sfx_air_raid_siren`).
     - Phase 2 (0.8s): Heavy bomber / SV-001 tactical pass traversing screen.
     - Phase 3 (0.5s): Screen detonation shockwave, clearing 100% of standard minions in active viewport and dealing 120 burst damage to bosses/mid-bosses.
     - Phase 4 (0.3s): Screen unfreeze, smoke dissipates, recovery.
  6. Viewport query: `StageManager` should provide `getCamera()` / `getViewportBoundingBox()`. `UltimateManager` queries all living entities in `GameEngine` intersecting the viewport AABB `[cameraX, 0, 480, 270]`.
  7. `ProceduralSpriteFactory` 164-key baseline invariant: All new expansion sprites must be in `expansionKeys: Set<string>` and excluded by default in `getAllKeys()`.
- **Unexplored areas**:
  - None. All requirements and interface contracts fully mapped.

## Key Decisions Made
- Architecture blueprint fully specified for Worker with exact class contracts, method signatures, audio synthesis profiles, sprite partitioning, and test suite specs.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1/handoff.md — Final handoff report
