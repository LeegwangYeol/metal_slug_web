# BRIEFING — 2026-09-11T02:20:45Z

## Mission
Investigate enemy collision radii in HordeManager.ts and enemy definitions, verify getEnemiesInRadius logic, evaluate separation/spatial grid, and provide calibration recommendations for Milestone 1.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2
- Original parent: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Milestone: Milestone 1 (Hitbox Calibration & Camera Tightening)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Calibrate enemy collision radii across HordeManager.ts and enemy definitions
- Examine getEnemiesInRadius collision logic
- Evaluate impacts on spawning, spatial partitioning grid, and separation behaviors
- Wait for explicit user approval before proceeding with implementation

## Current Parent
- Conversation ID: d7e47049-ad05-49c0-9ddc-39995092b4b9
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/core/entities/EnemyTypes.ts` (base stats, archetypes)
  - `src/core/entities/Enemy.ts` (pooled entity properties)
  - `src/core/HordeManager.ts` (swarm simulation, getEnemiesInRadius, flocking separation)
  - `src/core/SpatialHashGrid.ts` (broadphase spatial partitioning, queryRadius)
  - `src/render/sprites/DarkFantasySprites.ts` (visual sprite vector drawing contours)
  - `src/core/systems/WaveDirector.ts` (off-screen perimeter spawning)
  - `src/main.ts` (contact damage loop)
  - Existing test suites in `tests/unit/`
- **Key findings**:
  - `HordeManager.getEnemiesInRadius()` does NOT check `distSq <= (radius + enemy.collisionRadius)^2`; it directly calls `SpatialHashGrid.queryRadius()`, which adds broadphase `maxEntityRadius = 32px` to the query radius.
  - In `main.ts:468`, damage occurred up to $14 + 15 + 32 = 61\text{px}$ away because no narrowphase distance check existed!
  - `Enemy` does not have a `collisionRadius` property (only `radius`).
  - Calibrated radii from sprite contours: Skeleton $r=11\text{px}$, Ghoul $r=13\text{px}$, Banshee $r=12\text{px}$, Death Knight $r=18\text{px}$, Necromancer $r=14\text{px}$.
  - Spawning and spatial grid (cellSize=64) are unaffected; soft flocking separation benefits from tighter clustering.
- **Unexplored areas**: None within Milestone 1 scope; complete.

## Key Decisions Made
- Concluded that narrowphase filtering must be added to `HordeManager.getEnemiesInRadius()` to ensure $\text{distSq} \le (\text{radius} + \text{enemy.radius})^2$.
- Aliased `collisionRadius` to `radius` via getter/setter on `Enemy` for complete contract safety.
- Documented full findings and recommendations in `handoff.md`.

## Artifact Index
- handoff.md — Final handoff report (complete 5-component report)
- progress.md — Liveness heartbeat
- DISPATCH.md — Task history
