## 2026-09-11T03:36:43Z

You are worker_m3_3 (role: Implementation & Testing Worker).
Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_3

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md before starting any work. Do not skip this.
Also read:
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_enhancement/GATE_STATUS.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3_2/handoff.md

Your exclusive write ownership:
- src/render/vfx/DarkFantasyVFX.ts
- tests/unit/ChallengerM3_VFX_Adversarial.test.ts

Implementation Task: Remediate the 4 bugs identified by challenger_m3_2 in Milestone 3:
1. Enemy Type Casing in `src/render/vfx/DarkFantasyVFX.ts:1351`:
   Normalize type: `const rawType = String(enemy.type || '').toUpperCase();`
   Ensure matching covers `'SKELETON'`, `'GHOUL'`, `'DEATH_KNIGHT'` (or `rawType.includes('KNIGHT')`), and `'BANSHEE'` case-insensitively. This ensures enemies spawned by WaveDirector (which are lowercase 'ghoul', 'death_knight', 'banshee') receive their intended scaled shadows (Ghoul: 16x6, Death Knight: 24x9 at y+22, Banshee: floating bobbing shadow at y+18) instead of falling through to the generic 14x5 fallback.

2. LootItem Property Check in `src/render/vfx/DarkFantasyVFX.ts:1318` and `1716`:
   In `LootItem`, the category is stored in `item.dropType` (`'RUBY_GEM'`, `'VIOLET_ABYSSAL'`, `'SOUL_CHEST'`), while `item.type` is permanently `'LOOT_DROP'`.
   In `renderContactDropShadows` and `renderLighting`, inspect:
   `const rawType = String((item as any).dropType || item.type || '').toLowerCase();`
   Ensure Ruby/Violet gems receive `7x3.2`, chests receive `11x5`, and both trigger shimmer lighting in `renderLighting()`.

3. Banshee Shadow Height Attenuation in `src/render/vfx/DarkFantasyVFX.ts:1393-1396`:
   Harmonize `bScale` and `bAlpha` so both modulate consistently with height above floor (higher float bob -> smaller and more diffuse shadow):
   `const bScale = Math.max(0.65, 1.0 - yBob * 0.05);`
   `const bAlpha = Math.max(0.12, Math.min(0.40, 0.30 - yBob * 0.04));`

4. Fix Unused Imports in `tests/unit/ChallengerM3_VFX_Adversarial.test.ts`:
   Remove unused imports `DynamicLightingEngine`, `LightingSceneData`, and `LootItem` to eliminate TS6133 errors.

Verification:
- Run `npx vitest run tests/unit/ChallengerM3_2_VisualInvariants.test.ts` (all 7 tests must pass).
- Run `npx vitest run tests/unit/DarkFantasyVFX.spec.ts`
- Run `npm test`
- Run `npx tsc --noEmit`
- Run `npm run build`

Document all changes and command results in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_3/handoff.md`.
Update `progress.md` with your progress.
When finished, send a message to orchestrator with your results.
