## 2026-09-03T16:52:17Z

You are Worker M1.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/
Your workspace root is: /Users/user/teamwork_projects/metal_slug_web/

MANDATORY FIRST STEP: Read the authoritative user request at:
/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
Also read the scope document and synthesis:
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen2/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen2/synthesis_m1_exploration.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2/handoff.md

Exclusively Owned Files:
- src/core/entities/boss/IronNokanaBoss.ts
- tests/unit/boss_crisis_events.test.ts
- tests/unit/iron_nokana_boss.test.ts

Task Instructions:
1. In `src/core/entities/boss/IronNokanaBoss.ts`:
   - In `takeDamage()`: add fatal overkill / test demolition bypass:
     `if (effectiveDamage >= this.maxHealth) { this.health = 0; this.transitionToDeath(); return; }`
   - In `transitionToPhase2()`: set `this.isFlameTelegraphing = false;` and `this.flameCooldownTimer = this.baseFlameCooldown;` so that `updateFlameSweep()` properly fires `boss_flame_telegraph` when cooldown expires.
2. In `tests/unit/boss_crisis_events.test.ts`:
   - Remove nonexistent `InputManager` and `SoundEngine` imports.
   - Replace `createPlatform` with local `makePlatform` helper using `createAABB(...)`.
   - Update `PlayerController` instantiation to `new PlayerController(vec2(1900, 200))` and set `player.health = 5; player.maxHealth = 5;` so taking 2 damage drops health to 3 without triggering life respawn.
   - Align multi-hit damage sequences to progress through phase clamping (e.g. two 100 dmg hits for 50%, three 100 dmg hits for 25%).
3. In `tests/unit/iron_nokana_boss.test.ts`:
   - Verify that all tests pass cleanly.
4. Run verification commands:
   - `npx tsc --noEmit`
   - `npx vitest run tests/unit/boss_crisis_events.test.ts tests/unit/iron_nokana_boss.test.ts`
   - `npx vitest run` (ensure 100% green across all unit tests, zero regressions)
5. Write handoff report with exact test outputs to:
   /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1/handoff.md
6. Send completion message to parent with summary and artifact path.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
