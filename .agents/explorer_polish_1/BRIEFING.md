# BRIEFING — 2026-09-04T00:17:35+09:00

## Mission
Investigate the existing enemy spawning architecture and define the technical implementation plan for Diverse Enemy Spawning (R1) including parachute drops and trench/structure ambushes.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1
- Original parent: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Milestone: Milestone 1 - Diverse Enemy Spawning Architecture (R1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code in src/
- Write only to .agents/explorer_polish_1/
- Strictly adhere to Handoff Protocol (5 components: Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- Use send_message to communicate results to parent (9248aa64-223b-4547-a5ad-20c1dd4a3980)

## Current Parent
- Conversation ID: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/core/entities/enemies/EnemyTypes.ts`
  - `src/core/entities/enemies/SoldierEnemy.ts`
  - `src/core/engine/StageManager.ts`
  - `src/main.ts`
  - `src/render/CanvasRenderer.ts`
  - `src/render/sprites/ProceduralSpriteFactory.ts`
  - `tests/unit/spawning_contract.test.ts`
  - `tests/unit/empirical_physics_spawning_challenge.test.ts`
  - `tests/unit/challenger_2_empirical_stress.test.ts`
  - `tests/unit/adversarial_controls_jump.test.ts`
- **Key findings**:
  1. Enemy architecture in `SoldierEnemy.ts` has cleanly separated roles (RIFLE, KNIFE, GRENADE, SHIELD) and an `INGRESS` state, but physics currently unconditionally applies gravity ($720\text{ px/s}^2$) when `!this.isGrounded`. Parachute descent requires gravity suspension and custom aerodynamic integration ($v_y \approx 40-60\text{ px/s}$ with sinusoidal $X(t)$).
  2. `StageData` is defined in `StageManager.ts` and populated in `main.ts:buildStage1Data()`. It defines 5 triggers with 9 soldiers strictly spawning at $x \ge cameraX + 520, y = 192$.
  3. Existing unit tests (`spawning_contract.test.ts`, `challenger_2_empirical_stress.test.ts`, `empirical_physics_spawning_challenge.test.ts`) assert the old M2/M4 constraint that all wave enemies in `buildStage1Data().triggers` spawn out-of-bounds ($x \ge cameraX + 480, y = 192$). The new user requirement explicitly supercedes this ("Minions should not just walk in from the edge... Automated tests must verify diverse behaviors rather than a simple off-screen X check").
  4. Complete implementation plan designed with zero-regression strategy, exact mathematical models, state machine transitions, procedural sprite specifications, and new test suite definitions.
- **Unexplored areas**: None. Entire spawning lifecycle and rendering pipeline investigated.

## Key Decisions Made
- Formulated two compatible implementation paths for stage triggers: (A) Configurable spawn modes (`classic` vs `diverse`) ensuring existing challenger tests remain green, or (B) Harmonizing existing contract tests to the new Diverse Spawning specification.
- Defined mathematical kinematic formulas for Parachute descent ($v_y = 50\text{ px/s}$, $X(t) = X_{\text{anchor}} + 18 \sin(3.0 t)$) and Ambush leap arc ($v_x = -130\text{ px/s}$, $v_y = -220\text{ px/s}$, $g = 720\text{ px/s}^2$).

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/handoff.md — Final 5-component handoff report
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/progress.md — Liveness heartbeat
