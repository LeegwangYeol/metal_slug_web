# BRIEFING — 2026-09-03T15:20:00Z

## Mission
Investigate enemy damage taking and death animation architecture, and define the complete technical implementation plan for Varied Death Animations & Particle FX (R2: standard fall, explosion blowback, burning death).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2
- Original parent: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Milestone: Milestone 2: Varied Death Animations & Particle FX (R2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code in source tree
- Output detailed technical plan and handoff to `.agents/explorer_polish_2/handoff.md`
- Maintain `progress.md` with liveness heartbeat
- Send notification to parent via `send_message` upon completion

## Current Parent
- Conversation ID: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/core/entities/enemies/SoldierEnemy.ts`
  - `src/core/entities/enemies/EnemyTypes.ts`
  - `src/core/weapons/ProjectileManager.ts`
  - `src/core/weapons/Grenade.ts`
  - `src/core/player/PlayerController.ts`
  - `src/render/sprites/ProceduralSpriteFactory.ts`
  - `src/render/sprites/Palette.ts`
  - `src/render/CanvasRenderer.ts`
  - `src/audio/AudioTypes.ts` & `src/audio/SoundEngine.ts`
  - `src/main.ts` & `src/core/engine/GameEngine.ts`
  - Existing test suite (257 passing tests across 20 files)
- **Key findings**:
  1. Signature mismatch across callers: `ProjectileManager` passes booleans `(damage, false, isFire)` and `(fire.damage, false, true)`, `Grenade` passes `(damage, true)`, `PlayerController` passes `(damage, 'melee', false)`.
  2. In `SoldierEnemy.ts`: `checkDeath` currently discards `sourceType`, sets `health = 0; isAlive = false; state = 'DEAD';` immediately, and `GameEngine` purges dead entities after 2 ticks (strictly asserted by existing unit tests).
  3. `CanvasRenderer.ts` line 385 explicitly skips dead enemies (`if (enemy.isDead) continue;`) and has zero death animation rendering logic.
  4. Only one rudimentary placeholder sprite exists (`rebel_rifle_death_0`).
  5. Architecture solution: Decouple simulation death from visual death through `DeathCorpseManager` listening to `enemy_death` event, preserving unit test invariants while driving full ballistic tumbling, ash collapsing, and staggered fall animations.
- **Unexplored areas**: None. Full scope explored.

## Key Decisions Made
- Design `DeathCorpseManager` to manage active dying corpses and particles.
- Normalize `takeDamage` to accept string/boolean union with backward compatibility.
- Plan 12 procedural sprite frames across 3 death modes.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/handoff.md` — Final handoff report
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/progress.md` — Progress tracker
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/BRIEFING.md` — Situational awareness
