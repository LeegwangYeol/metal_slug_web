# Dispatch Assignment: Milestone 1 Worker (Dynamic Animations & Motion Engine)

- **Role**: teamwork_preview_worker
- **Assigned Milestone**: Milestone 1 (Dynamic Animations & Motion Engine)
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Mandatory Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/analysis.md`
5. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Ownership
You exclusively own and may edit the following files:
- `src/core/entities/Enemy.ts`
- `src/core/HordeManager.ts`
- `src/core/entities/Player.ts`
- `src/render/sprites/DarkFantasySprites.ts`
- Unit tests under `tests/unit/` relating to animation and player kinematics (e.g., `tests/unit/DarkFantasySprites.test.ts`, `tests/unit/PlayerMotion.test.ts`)

DO NOT edit `src/render/Camera.ts`, `src/ui/GothicHUD.ts`, `src/ui/UpgradeModal.ts`, or `src/render/GothicBackdrop.ts` (owned by other milestones).

## Implementation Objectives
Execute the 6 technical specifications defined in the explorer survey:
1. **Fix Entity Animation Frame Lock**:
   - In `src/core/HordeManager.ts`, ensure `enemy.behaviorTimer += dt` is advanced every simulation tick.
   - In `src/render/sprites/DarkFantasySprites.ts`, advance enemy walk cycles dynamically based on `enemy.behaviorTimer` and movement velocity.
2. **Implement Dynamic Velocity Easing**:
   - In `src/core/entities/Player.ts`, replace linear `approach()` with exponential relaxation easing ($v_{t+dt} = v_t + (v_{target} - v_t)(1 - e^{-\lambda dt})$) with $\lambda_{accel} = 14.0$, $\lambda_{brake} = 18.0$, and $1.6\times$ turnaround multiplier.
   - Maintain strict 60Hz numerical stability and bounded velocity.
3. **Implement Harmonic Squash & Stretch**:
   - In `src/render/sprites/DarkFantasySprites.ts:drawPlayer`, apply volume-conserving scale transforms ($S_x \cdot S_y \approx 1.0$) using damped harmonic oscillation on directional changes, dash impulses, and impacts.
4. **Implement Attack Wind-Up, Anticipation & Recoil**:
   - Implement a 3-phase attack animation state machine on `Player` (wind-up $0.08\text{s}$, release $0.06\text{s}$, follow-through $0.12\text{s}$) with torso lean and weapon recoil offsets.
5. **Implement Multi-Phase Grounded Walk Cycles & Spectral Hover**:
   - In `DarkFantasySprites.ts:drawEnemy`, wrap cached sprite blitting with contextual affine transforms (`ctx.save()`, `ctx.translate()`, `ctx.rotate()`, `ctx.scale()`, `ctx.restore()`):
     - Bi-harmonic vertical gait bobbing and pelvic sway for Skeletons, Ghouls, and Death Knights.
     - Dual-frequency incommensurate harmonic levitation ($y_{hover} = A_1\sin(\omega_1 t) + A_2\sin(\omega_2 t)$) and contact shadow height coupling for Banshees and Necromancers.
6. **Implement Dynamic Damage Flinch & Hit-Flash Cascade**:
   - 3-tier damage reaction: impulse deformation squash, angular stumble ($\pm 20^\circ$), and 3-phase hit-flash cascade (white $\to$ crimson $\to$ normal).
7. **Preserve Atlas & Baseline Invariants**:
   - Maintain the 120-canvas pre-rendered sprite atlas count in `DarkFantasySprites.initialize()`.
   - Ensure stationary baseline (idle player at $(100, 150)$ has zero dynamic offsets, preserving existing test assertions).
   - Zero dynamic allocations in the render loop; ensure all 488 existing unit tests pass cleanly (`npm test`).

## Verification Requirements
You MUST:
1. Run `npm test` and verify that all unit tests pass 100% green.
2. Write unit tests to explicitly verify the new animation mechanics (behaviorTimer advancement, exponential easing, squash/stretch factors, attack states).
3. Document all modified files, test outputs, and verification commands in your `handoff.md`.
4. Report completion to parent orchestrator.

## 2026-09-11T06:18:49Z
<USER_REQUEST>
You are worker_m1_anim, a teamwork_preview_worker subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/analysis.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_anim/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You exclusively own and may edit:
- src/core/entities/Enemy.ts
- src/core/HordeManager.ts
- src/core/entities/Player.ts
- src/render/sprites/DarkFantasySprites.ts
- tests/unit/ (animation & motion test files)

Execute the 6 technical specifications defined in the explorer survey:
1. Fix Entity Animation Frame Lock: Advance enemy.behaviorTimer += dt in HordeManager.ts; advance enemy walk cycles dynamically in DarkFantasySprites.ts.
2. Implement Dynamic Velocity Easing in Player.ts using exponential relaxation.
3. Implement Harmonic Squash & Stretch in DarkFantasySprites.ts:drawPlayer.
4. Implement Attack Wind-Up, Anticipation & Recoil state machine on Player and weapon hooks.
5. Implement Multi-Phase Grounded Walk Cycles & Spectral Hover in DarkFantasySprites.ts:drawEnemy using contextual 2D affine transforms.
6. Implement Dynamic Damage Flinch & Hit-Flash Cascade.
7. Preserve Atlas & Baseline Invariants (120-canvas atlas count in initialize(), zero offset on idle).
8. Run build and tests (npm test) and verify 100% green. Write unit tests for new motion mechanics.

Write your report to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/handoff.md

When complete, send a message to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5) summarizing your results and referencing your handoff file.
</USER_REQUEST>
