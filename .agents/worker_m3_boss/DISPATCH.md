## 2026-09-03T08:32:45Z

You are Worker 3 (Boss Balance Specialist) for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative context:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Explorer 3 Handoff Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_3/handoff.md
- Project Scope: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_boss

Exclusive Write Ownership:
`src/core/entities/boss/TetsuyukiBoss.ts`
(Do NOT modify `src/main.ts` or `KeyboardController.ts`.)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 3 (M3: Boss Health Rebalance):
1. In `src/core/entities/boss/TetsuyukiBoss.ts`:
   - Set default `maxHealth = 400` (lines 207, 265).
   - In `takeDamage()`, replace hardcoded clamping constants `975` and `450` with dynamic percentage thresholds:
     ```typescript
     const p1Threshold = Math.round(this.maxHealth * 0.65);
     const p2Threshold = Math.round(this.maxHealth * 0.30);
     ```
     (For `maxHealth = 400`, `p1Threshold = 260`, `p2Threshold = 120`.)
   - Phase 1 clamping:
     ```typescript
     if (this.phase === 'PHASE_1_ARTILLERY') {
       this.health = Math.max(p1Threshold, this.health - effectiveDamage);
       if (this.health <= p1Threshold) {
         this.transitionToPhase2();
       }
       return;
     }
     ```
   - Phase 2 clamping:
     ```typescript
     if (this.phase === 'PHASE_2_LASER_SWEEP') {
       this.health = Math.max(p2Threshold, this.health - effectiveDamage);
       if (this.health <= p2Threshold) {
         this.transitionToPhase3();
       }
       return;
     }
     ```
   - Phase 3 clamping:
     ```typescript
     if (this.phase === 'PHASE_3_MELTDOWN') {
       this.health = Math.max(0, this.health - effectiveDamage);
       if (this.health <= 0) {
         this.transitionToDeath();
       }
       return;
     }
     ```
2. Update comments and debug logs to reflect the dynamic thresholds and 400 HP balance.
3. Run verification:
   - Run tests: `npm test`
   - Run typecheck and build: `npm run build`
4. Deliverable:
   - Write comprehensive handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_boss/handoff.md` with:
     - Summary of changes made
     - Exact line diffs
     - Build and test command outputs
   - Send completion message to parent with path to handoff.
