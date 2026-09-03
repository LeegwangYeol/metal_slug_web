## 2026-09-03T08:25:24Z

You are Explorer 1 for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative original request and collaboration guide:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1

Your Task:
Investigate the Input and Player Kinematics / Jump Mechanics.
Inspect:
1. `src/input/KeyboardController.ts`: Current key mappings, why Space was mapped to 'fire' instead of 'jump', how 'jump', 'fire', 'grenade', and directional controls are handled.
2. `src/core/player/` (e.g. `PlayerKinematics.ts`, `PlayerEntity.ts`) and `src/main.ts`: How input commands are passed to the player entity, how jump velocity/impulse is applied, how gravity and ground collisions work, and why jumping was failing to visibly/mathematically alter the Y coordinate.
3. Key bindings requirements:
   - Jump: Space, KeyK, KeyX
   - Fire: KeyJ, KeyZ
   - Grenade: KeyL, KeyC
   - Movement/Aiming: WASD, ArrowLeft/Right/Up/Down
4. Determine the exact changes needed in code so that pressing Spacebar/K/X genuinely causes the player's Y coordinate to decrease (move upward) and arrows/AD move X.
5. Provide recommendations for unit tests and Playwright E2E tests.

Deliverable:
Write a comprehensive handoff report to:
`/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/handoff.md`
Send a message to parent when done with a concise summary and path to your handoff.
