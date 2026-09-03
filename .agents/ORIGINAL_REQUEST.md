# Original User Request

## 2026-09-03T03:05:02Z

Use a very large team of agents. A complete, multi-stage web-based 2D run-and-gun action game inspired by Metal Slug. The game features character motions, authentic-style voice/sound events, melee and ranged combat (default rifle, weapon upgrades like machine gun and flamethrower), and boss/mid-boss encounters with various gimmicks.

Working directory: ~/teamwork_projects/metal_slug_web
Integrity mode: development

## Requirements

### R1. Core Game Mechanics & Engine
Build a multi-stage web game using a suitable library/engine chosen by the team (e.g., Phaser.js). Implement movement, jumping, melee attacks, and ranged shooting. 

### R2. Weapon Upgrades & Combat
Implement a system where picking up items upgrades the player's weapon (e.g., machine gun, flamethrower) with distinct firing behaviors and sound effects.

### R3. Enemies, Mid-Bosses, and Bosses
Develop varied enemies, mid-bosses, and end-bosses with unique attack patterns, phases, and gimmicks across multiple stages.

### R4. Assets & Audio
Autonomously source or generate placeholder visual assets (character motions, effects) and audio files (voice clips, sound effects) to emulate the classic arcade feel.

### R5. Testable Architecture
Decouple core game logic from rendering so that behaviors (health, weapon states, enemy AI) can be verified via automated test scripts.

## Acceptance Criteria

### Functional Verification
- [ ] Automated tests pass: Verifies player weapon state transitions correctly upon acquiring items.
- [ ] Automated tests pass: Verifies boss/enemy state machines (taking damage, phase transitions, death).
- [ ] Integration test: The game initializes in a browser/headless environment without fatal console errors.
- [ ] Asset presence: The build includes playable placeholder graphics and audio files for weapons, voices, and motions.

## 2026-09-03T03:10:10Z

The user has explicitly approved the plan. Please proceed with the code implementation and dispatch the orchestrator swarm. (User message: "승인")

## 2026-09-03T05:38:05Z

Full team. Overhaul the existing Metal Slug web game to address major visual and gameplay issues. The focus is to fix broken physics, correct enemy spawn/despawn logic, significantly upgrade the character graphics to remove the "Atari" feel, add clear aiming indicators, and use visual verification (screenshots) to improve UI and screen design.

Working directory: /Users/user/teamwork_projects/metal_slug_web
Integrity mode: development

## Requirements

### R1. Physics and Enemy Spawning
Fix the broken physics logic (e.g., collision, gravity, movement) to feel natural and consistent. Correct the enemy spawning system so minions enter and exit the screen smoothly without jarring appearances or disappearances.

### R2. Graphics and Aiming Overhaul
Upgrade character and enemy sprites from the primitive "Atari" style to high-resolution, detailed pixel art. Implement a clear visual aiming indicator (like a crosshair) and distinct character animations so the aiming direction is immediately obvious.

### R3. Visual Design Verification via Screenshots
You MUST use a headless browser (e.g., Chrome DevTools or Playwright) to take screenshots of the game's UI and gameplay. The implementing agents must visually analyze these screenshots to judge and refine the screen design, layout, and art quality.

## Acceptance Criteria

### Visual & Gameplay Verification
- [ ] Visual Proof: The team produces screenshot artifacts showing the upgraded graphics, UI layout, and crosshairs, along with an AI evaluation of the design.
- [ ] AI Evaluation: An agent visually confirms that enemies spawn out-of-bounds and walk in (no popping).
- [ ] AI Evaluation: An agent visually confirms the physics (jump arcs, gravity) appear natural in captured frames or that the physics simulation logic strictly follows Newtonian principles.
- [ ] Automated tests: Existing and newly added Vitest / Playwright tests pass (100% green).

## 2026-09-03T06:13:54Z

The user has explicitly approved the plan. Please proceed with the code implementation and dispatch the orchestrator swarm. (User message: "승인")

## 2026-09-03T08:22:19Z

Use a very large team of agents. Completely overhaul and fix the critical gameplay bugs in the Metal Slug web game. The previous implementation severely broke basic mechanics despite passing tests.

Working directory: /Users/user/teamwork_projects/metal_slug_web
Integrity mode: development

## Requirements

### R1. Fix Key Controls and Jump Mechanic
The jump mechanic is currently completely missing or broken, and key controls are unresponsive or terrible. Re-implement and map the keyboard controls correctly so that the player can move, jump, and shoot smoothly.

### R2. Fix Spawning Logic (POWs and Enemies)
POWs currently spawn out of nowhere, and enemies do not appear properly. Completely rewrite the spawning system so that enemies and POWs only spawn at designated coordinates or wave triggers, not randomly popping into the screen.

### R3. Rebalance Boss Health
The boss health is currently set way too high, making it unplayable. Rebalance the boss HP to a reasonable level for a web game stage.

## Acceptance Criteria

### E2E Gameplay Verification (No Fake Tests)
- [ ] Playwright E2E Test (Jump): A headless browser test MUST simulate pressing the jump key (e.g., Spacebar) and mathematically assert that the player sprite's Y-coordinate actually changes (moves upward).
- [ ] Playwright E2E Test (Movement): A headless browser test MUST simulate pressing the left/right arrow keys and assert that the player's X-coordinate changes accordingly.
- [ ] Code Verification (Spawning): Spawning logic must be strictly tied to camera position or explicit wave triggers. Random timer-based popping must be removed.
- [ ] Code Verification (Boss HP): The Boss entity's max health must be explicitly asserted in a test to be <= 500 (or a similarly reasonable threshold).

## 2026-09-03T08:23:20Z

The user has explicitly approved the prompt artifact. Proceed with full force to overhaul and squash the bugs!
