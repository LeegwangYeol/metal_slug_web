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
