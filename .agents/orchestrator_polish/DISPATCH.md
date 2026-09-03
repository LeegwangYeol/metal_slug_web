## 2026-09-03T15:13:13Z

Mission: Enhance the enemy spawning system and death animations to make the game feel dynamic and polished, and proactively hunt down and fix any remaining bugs in the Metal Slug web game. Explicit user approval has been granted ("승인").

Core Requirements:
1. R1. Diverse Enemy Spawning:
   - Parachute airborne drops: Enemies spawn high above (Y < 50), descending with parachute canopy, swaying trajectory, cleanly landing and detaching at ground level (Y = 230).
   - Trench / Structure Ambushes: Enemies leap out from background structures or trenches at designated trigger points.
2. R2. Varied Death Animations:
   - Standard falling death: Bullets / rifles cause classic stagger and collapse.
   - Explosion blowback: Grenades / explosions launch soldiers upward/backward in a ballistic trajectory with tumbling before landing.
   - Burning death: Flamethrower incinerates enemies with flame particles, thrashing animation, and charcoal ash collapse.
3. R3. Proactive Bug Hunt & Polish:
   - Autonomously playtest the game, hunt down and fix any edge-case glitches, collision bugs, audio/visual polish issues.
   - Produce a comprehensive Markdown report: BUG_HUNT_REPORT.md.
4. Acceptance Criteria:
   - Visual Proof: Playwright screenshot artifacts demonstrating at least 3 distinct death animations in artifacts/death_animations/ (e.g. death_standard.png, death_explosion_blowback.png, death_burning.png).
   - E2E Code Verification: Automated Playwright and Vitest tests verifying diverse spawn behaviors (high Y, descent velocity, trigger coordinates).
   - Bug Hunt Report: BUG_HUNT_REPORT.md created.
   - All tests passing: 100% green across all existing and new unit tests (vitest) and browser E2E tests (playwright). Clean npm run build.
