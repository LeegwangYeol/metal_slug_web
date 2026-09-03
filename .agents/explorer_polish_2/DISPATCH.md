# DISPATCH — Explorer Polish 2

## Mission
Investigate the enemy damage taking and death animation architecture, and define the implementation plan for Varied Death Animations & Particle FX (R2).

## Scope & Instructions
1. Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`.
2. Inspect the current codebase around damage calculation and death animations:
   - `src/core/entities/enemies/SoldierEnemy.ts`
   - `src/core/weapons/` (Handgun, HMG, Flame Shot, Grenade, Melee Knife)
   - `src/render/sprites/ProceduralSpriteFactory.ts`
   - `src/render/CanvasRenderer.ts`
   - Any particle or effect systems.
3. Analyze how damage is passed to enemies (is damage type tracked?).
4. Detail exactly how to implement the 3 distinct death states & animations:
   - Standard falling death: Bullets / rifles cause classic stagger and backward collapse onto ground.
   - Explosion blowback: Grenades / explosions launch soldiers upward/backward in a ballistic trajectory with tumbling rotation before ground landing.
   - Burning death: Flamethrower incinerates enemies with flame particles, thrashing animation, turning to charcoal ash collapse.
5. Identify required sprite frames, canvas rendering routines, particle effects, and sound triggers.
6. Provide exact signatures, state enum extensions, and rendering pipelines.
7. Write your comprehensive report to `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/handoff.md`.

## 2026-09-03T15:14:18Z
You are Explorer Polish 2.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md and /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/DISPATCH.md before starting work. Do NOT skip this.

Your mission:
Investigate enemy damage taking and death animations, and define the technical implementation plan for Varied Death Animations & Particle FX (R2):
- Standard falling death (bullets/rifles: stagger and collapse).
- Explosion blowback (grenades/explosions: launch upward/backward in ballistic tumbling trajectory, impact ground).
- Burning death (flamethrower: flame particles, thrashing animation, charcoal ash collapse).

Inspect:
- src/core/entities/enemies/SoldierEnemy.ts
- src/core/weapons/ (Handgun, HMG, Flame Shot, Grenade, Melee Knife, etc.)
- src/render/sprites/ProceduralSpriteFactory.ts
- src/render/CanvasRenderer.ts
- Effect/particle systems and audio triggers.

Produce your detailed analysis and handoff report in:
/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/handoff.md

Remember to maintain progress.md in your working directory with 'Last visited: [timestamp]'.
When complete, notify the orchestrator via send_message with your handoff summary and report path.
