## 2026-09-03T03:27:56Z
You are worker_m6.
Your working directory is /Users/user/src/fullmetalslug/.agents/worker_m6/.
Project workspace root is /Users/user/src/fullmetalslug/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/TEST_INFRA.md
- /Users/user/src/fullmetalslug/TEST_READY.md

Milestone: M6 — Full Game Integration, Input Handling & Polish.

File Write Ownership:
- src/input/KeyboardController.ts
- src/input/TouchVirtualPad.ts
- src/ui/HUDOverlay.ts
- src/main.ts
- Any wiring/integration fixes in src/core/ or src/render/ needed for clean end-to-end operation.

Tasks to Complete:
1. Implement Input Handling in `src/input/`:
   - `src/input/KeyboardController.ts`: WASD / Arrow keys for 8-way movement and aiming, J/Z/Space for Fire, K/X for Jump, L/C for Grenade, Enter/Escape for Pause. Expose current input state `{ left, right, up, down, fire, jump, grenade }`.
   - `src/input/TouchVirtualPad.ts`: Virtual D-pad and on-screen touch buttons for mobile/pointer devices, cleanly mounted over canvas.
2. Implement Retro HUD in `src/ui/HUDOverlay.ts`:
   - Canvas-rendered retro arcade HUD displaying:
     - Score ("1UP 000000")
     - Lives ("x3")
     - Arms weapon badge ("H", "F", or "PISTOL")
     - Ammo counter ("200", "30", or "∞")
     - Grenade stock ("x10")
     - Hostage rescue tallies ("POW x N")
     - Stage 1 End-Boss health bar with flashing warning banners ("WARNING! Tetsuyuki Fortress Approaches!").
3. Assemble Full Game Loop in `src/main.ts`:
   - Wire together `GameEngine`, `StageManager`, `PlayerController`, `Camera`, `ParallaxBackground`, `CanvasRenderer`, `SoundEngine`, `SpeechSynthesizer`, `KeyboardController`, `TouchVirtualPad`, and `HUDOverlay`.
   - Connect `engine.eventBus` to `SoundEngine` and `SpeechSynthesizer`:
     - Firing sounds for Pistol, HMG, Flame Shot, Grenade.
     - Announcer voice clips on weapon pickup ("HEAVY MACHINE GUN!", "FLAME SHOT!").
     - Knife slash whoosh on melee.
     - Explosions on grenade/rocket/boss hit.
     - Announcer voice clip on POW rescue ("THANK YOU!").
     - Announcer voice clip on Boss defeat ("MISSION COMPLETE!").
   - Populate Stage 1:
     - Platforms: Ground terrain, elevated bridges, bunker platforms.
     - Enemies: Patrol waves of Rebel Soldiers (Rifleman, Knife Charger, Grenade Thrower, Shield Trooper).
     - POWs: Tied-up hostages positioned along the level and in defensive redoubts.
     - Mid-Boss Encounter: Rebel Iron Technical battle at Section 1.
     - Boss Encounter: Tetsuyuki War Fortress multi-phase showdown at Section 2.
   - Run 60 FPS `requestAnimationFrame` loop with fixed-timestep physics accumulator.
   - Expose `(window as any).__GAME__`, `(window as any).__ENGINE__`, `(window as any).__AUDIO_CTX__` for Playwright E2E and debug automation.
4. Verification:
   - Run `npx tsc --noEmit` and ensure 0 compilation errors.
   - Run `npm run test` and ensure all 108+ unit tests pass.
   - Run `npm run test:e2e` and ensure Playwright E2E passes.
   - Run `npm run build` and ensure production bundle builds cleanly.

Write your handoff report to `/Users/user/src/fullmetalslug/.agents/worker_m6/handoff.md` and notify orchestrator via `send_message`.
