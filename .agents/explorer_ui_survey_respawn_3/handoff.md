# Handoff Report — UI Survey, Respawn Flow, Continue Countdown & Tutorial

**Agent ID**: `explorer_ui_survey_respawn_3`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_respawn_3`  
**Parent Agent ID**: `dc4b76ec-2c8d-41af-8152-fb6d5ed83654`  
**Type**: Hard Handoff (Investigation Task Complete)  
**Date**: 2026-09-10  

---

## 1. Observation

Direct observations and evidence from the codebase:

1. **Player Death & Instant Respawn Handling**:
   - `src/core/player/PlayerController.ts` lines 576–594:
     ```typescript
     this.health -= amount;
     if (this.health <= 0) {
       this.lives--;
       if (this.lives <= 0) {
         this.isAlive = false;
         this.actionState = PlayerActionState.DEAD;
       } else {
         // Respawn with full health and 2s invulnerability
         this.health = this.maxHealth;
         this.invulnerabilityTimer = 2.0;
         this.actionState = PlayerActionState.IDLE;
         this.coyoteTimer = PlayerKinematics.COYOTE_FRAMES * GameEngine.DEFAULT_TIMESTEP;
         this.jumpBufferTimer = 0;
         this.jumpCutApplied = false;
       }
     }
     ```
     When `lives > 1`, `lives--` occurs, but `health` is immediately set back to `1.0` and `actionState` immediately set to `IDLE` in the exact same tick. No death animation, no sound effect, no knockback, no parachute re-entry, and no pause.
   - When `lives <= 0`, `this.isAlive = false` and `actionState = DEAD`. In `handleInput()` (line 145): `if (!this.isAlive) return;`. The game permanently freezes player inputs without any restart prompt or continue option.

2. **Static Game Over UI & Missing Continue Countdown**:
   - `src/ui/HUDOverlay.ts` lines 344–350:
     ```typescript
     private renderGameOverBanner(ctx: CanvasContext2DLike, _time: number): void {
       ctx.fillStyle = 'rgba(40, 0, 0, 0.75)';
       ctx.fillRect(0, 80, 480, 80);

       this.drawPixelText(ctx, 'GAME OVER', 180, 105, '#E74C3C', 2.5, '#000000');
     }
     ```
     Renders a flat red box with static text `"GAME OVER"`. There is no countdown (9, 8, 7...), no button prompt to continue, and no restart mechanism.
   - `src/core/engine/StageManager.ts` line 13: `StageState.GAME_OVER` is declared in the enum, but is never entered or referenced.

3. **Existing Unused Procedural Sprites**:
   - `src/render/sprites/ProceduralSpriteFactory.ts` lines 945–949:
     ```typescript
     for (let d = 0; d < 4; d++) {
       this.registerSprite(`player_death_${d}`, W, H, AX, AY, (ctx) => {
         drawSoldier(ctx, { death: d + 1 });
       });
     }
     ```
     Frames `player_death_0` through `player_death_3` are pre-registered (shock, spiral tumble, inverted fall, ground crash), but `CanvasRenderer.ts` lines 662–665 defaults to static frame `player_death_2` because `animFrame` is never incremented.
   - `src/render/CanvasRenderer.ts` lines 464–485 and `src/core/entities/enemies/SoldierEnemy.ts` implement parachute descent with canopy lines and sinusoidal sway for enemy soldiers, but player parachute drop-in has not been implemented.

4. **Missing HUD Elements & Hardcoded Viewport**:
   - `src/ui/HUDOverlay.ts` lines 19–34 (`HUDOverlayState`): Does not contain `ultimateStock` or `shieldCharges`.
   - Players have the tactical Ultimate Move (Key `U`), but the HUD gives zero indication of whether it is available or how many stocks remain.
   - Viewport dimensions are hardcoded to `480` and `270` across `HUDOverlay.ts` (lines 268, 325, 335, 346).

5. **Absence of On-Screen Tutorial / Controls**:
   - No tutorial banner, controls card, or on-screen button guide exists in `src/ui/`, `src/render/`, or `index.html`.
   - Keyboard mappings in `src/input/KeyboardController.ts` lines 68–100 include WASD/Arrows (move/aim), Space/K/X (jump), J/Z (fire), L/C (grenade), U (ultimate), Esc/Enter (pause), but players are never informed of them.

6. **Current Test Suite Baseline**:
   - Running `npm test` (`vitest run`) currently passes with **35 test files and 463 tests 100% green**.
   - Multiple unit tests (`spawning_contract.test.ts`, `empirical_physics_spawning_challenge.test.ts`, `render_components.test.ts`, `adversarial_ultimate_challenge.test.ts`) assert `cameraX + 480` and `480x270` buffer dimensions.

---

## 2. Logic Chain

1. **Premise 1 (Jarring Experience)**: From Observation 1, because `PlayerController.takeDamage()` instantly restores `health` and `IDLE` state in the exact same frame when `lives > 1`, player damage appears as a momentary blink with no feedback, directly causing the user's report of a "jarring death and restart flow".
2. **Premise 2 (Unused Assets)**: From Observation 3, the codebase already possesses the four death animation frames (`player_death_0..3`) and parachute rendering systems. Connecting these existing assets into a 1.2s `PLAYER_DYING` sequence followed by a `RESPAWNING_PARACHUTE` sequence will immediately transform death from jarring to authentic and cinematic without requiring external assets.
3. **Premise 3 (Softlock on Game Over)**: From Observations 1 and 2, when `lives === 0`, the player entity is disabled (`isAlive = false`) and HUD displays a static `"GAME OVER"` banner while keyboard inputs are ignored. The player is softlocked. Introducing an arcade `CONTINUE_COUNTDOWN` state (10s timer, large 9..0 digits, press Fire/Jump to continue, lives reset to 3, parachute drop-in) eliminates the softlock and brings authentic arcade excitement.
4. **Premise 4 (Player Guidance)**: From Observation 5, players have 7 distinct control inputs without any on-screen explanation. Adding an arcade-style instruction placard displaying WASD/Arrows, J/Z Fire, K/X/Space Jump, L/C Grenade, U Ultimate, with a 5s auto-dismiss and `[H]` toggle, directly satisfies Requirement R2.
5. **Premise 5 (Visual Charm & Claustrophobia)**: From Observation 4 and user feedback ("Based on the original, it's not cute/charming at all, and it feels very stifling/claustrophobic"), the claustrophobic feeling stems from rigid forward camera clamping, low vertical headroom (Y: 230 ground on 270px screen), and sterile flat UI boxes. Giving the HUD warm metallic bevels, cute animated icons (fluttering Marco, bomb with sparking fuse, glowing ultimate badge), bouncy score popups, and panoramic camera deadzones directly addresses the user's aesthetic concerns.
6. **Premise 6 (Safety Invariant)**: From Observation 6, changing internal virtual coordinates from 480x270 to another base could break dozens of existing unit tests. The recommended strategy is to keep internal simulation coordinate contracts intact (or carefully configure scaling) while modernizing presentation, camera deadzones, and HUD layouts.

---

## 3. Caveats

1. **Audio Synthesizer Expansion**: The Web Audio procedural sound engine (`SoundEngine.ts`) currently has `playSoldierDeath()`, but does not yet have a dedicated `playPlayerDeath()` sound clip or countdown beep. The implementer should add procedural audio envelopes or call `playSoldierDeath('standard')` as a temporary fallback.
2. **Touch Virtual Pad Ultimate Button**: `TouchVirtualPad.ts` currently has Jump, Fire, Bomb, and Pause buttons, but does not have an on-screen button for the Ultimate Move (`U`). Adding a 4th button (`touch-btn-ultimate`) is recommended for mobile play.
3. **Spawning Bounds Stability**: Modifying virtual width beyond 480 within the headless simulation must be avoided or coordinated with spawner tests to prevent breaking `cameraX + 480` out-of-bounds invariants.

---

## 4. Conclusion

1. **Death & Respawn Architecture**:
   - Replace instantaneous health reset in `PlayerController.takeDamage()` with a two-phase state machine:
     - Phase 1: `PLAYER_DYING` (1.2s upward knockback arc, cycling `player_death_0..3`, defeat SFX).
     - Phase 2: If `lives > 0`, enter `RESPAWNING_PARACHUTE` (top-of-screen spawn, canopy descent with gentle steering, ground landing snap, 2.5s invulnerability flashing, "OK!" callout).
2. **Arcade Continue Countdown State Machine**:
   - When `lives === 0`, trigger `CONTINUE_COUNTDOWN` (10s timer, large 9..0 retro digits, cartoon character vignette, blinking "PRESS FIRE / JUMP TO CONTINUE").
   - Pressing Fire (`J`/`Z`) or Jump (`K`/`X`/`Space`) restores 3 lives and transitions into parachute drop-in.
   - Timer reaching 0 triggers `GAME_OVER_FINAL` with restart prompt (`[ENTER]`/`[SPACE]`).
3. **Tutorial & Controls Overlay**:
   - Implement an arcade cabinet instruction card showing WASD/Arrows (move/aim), J/Z (fire/knife), K/X/Space (jump), L/C (grenade), U (ultimate), Esc (pause).
   - Show on stage start with 5s auto-dismiss and key `H` or on-screen `[?]` toggle.
4. **Charming Retro HUD**:
   - Add Ultimate Move stock icon (`[U] BOMBER x1`).
   - Add shield charges indicator.
   - Add cute micro-animations (sparking bomb fuse, mini Marco head).
5. **Zero-Regression Verification**:
   - Add unit tests in `tests/unit/ui_respawn_continue.test.ts` for all transitions.
   - Add Playwright E2E tests capturing `continue_countdown.png`, `player_respawn_parachute.png`, and `tutorial_overlay.png`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Existing Tests**:
   ```bash
   npm test
   ```
   Expect: 35 test files passed, 463 tests passed.

2. **Inspect Current Death Flow Code**:
   ```bash
   grep -n -A 25 "takeDamage(amount" src/core/player/PlayerController.ts
   ```
   Verify lines 576–594 show instant reset `this.health = this.maxHealth; this.actionState = PlayerActionState.IDLE;` without death animation or parachute.

3. **Inspect Current Game Over UI**:
   ```bash
   grep -n -A 10 "renderGameOverBanner" src/ui/HUDOverlay.ts
   ```
   Verify lines 344–350 show static `GAME OVER` banner with no continue countdown.

4. **Inspect Existing Player Death Sprites**:
   ```bash
   grep -n "player_death_" src/render/sprites/ProceduralSpriteFactory.ts
   ```
   Verify 4 frames (`player_death_0` through `3`) are defined.

5. **Inspect Test Invariants on Viewport 480**:
   ```bash
   grep -n "cameraX + 480" tests/unit/spawning_contract.test.ts
   ```
   Verify the strict invariant requirement.
