# DISPATCH — Worker M2 (Autonomous Gameplay Reinvention: Sugar Pop Blossom)
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m2_core
- Role: Core Gameplay & Mechanics Worker
- Milestone: M2 — Autonomous Gameplay Reinvention ("Sugar Pop Blossom: Cozy Star Arena")
- Scope:
  - Create `src/core/cute/` subsystem:
    - `src/core/cute/CuteGameTypes.ts`: Types and interfaces for bubbles, perks, altars, fever.
    - `src/core/cute/BubbleTrapEntity.ts`: Floating buoyant bubble entity with 6-shard radial burst.
    - `src/core/cute/BubbleManager.ts`: Lifecycle, cascade chain reactions, combo multipliers.
    - `src/core/cute/PetCompanion.ts`: Mochi the Cloud Bunny follow physics, candy vacuuming, auto-bolts, bubble shield.
    - `src/core/cute/CuteEnemyManager.ts`: Marshmallow slimes, honey bees, donut rollers, gummy bear colossus.
    - `src/core/cute/ArenaPurificationManager.ts`: 3 Blossom Altars with blooming garden progression.
    - `src/core/cute/SweetPerkManager.ts`: 3-card rogue-lite upgrade pool.
  - Wire into game loop and rendering in `src/main.ts`, `src/render/CanvasRenderer.ts`, and `src/ui/HUDOverlay.ts`:
    - Support `gameMode: 'cute_blossom_arena'` (default) while maintaining 100% backward compatibility for classic mode in existing tests.
    - Render bubbles, Mochi companion, altars, fever meter, and 3-card perk selection modal.
  - Verification: Run `npm run build` and `npm test` (all tests green, 0 build errors).

## 2026-09-10T05:59:40Z
Received dispatch assignment:
TASK: Milestone M2 — Autonomous Gameplay Reinvention ("Sugar Pop Blossom: Cozy Star Arena")
Implement the novel core gameplay loop and systems detailed in Explorer 2's architectural blueprint.
Integrity Mandate: DO NOT CHEAT. All implementations must be genuine.
CRITICAL INVARIANTS:
- The simulation core must remain 100% headless and deterministic.
- All existing 596 unit tests MUST continue to pass with 0 regressions.
- npm run build must succeed with 0 TypeScript compilation errors.
