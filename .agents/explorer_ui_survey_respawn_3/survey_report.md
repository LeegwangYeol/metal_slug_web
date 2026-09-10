# Comprehensive UI, Death/Respawn, Continue Countdown & Tutorial Survey Report

**Author**: `explorer_ui_survey_respawn_3`  
**Date**: 2026-09-10  
**Project**: Metal Slug Web (`LeegwangYeol/metal_slug_web`)  
**Context**: Milestone UI/UX Overhaul — Screen Size, Level Design, Respawn Loop & Arcade Charm  
**Reference Directives**: `ORIGINAL_REQUEST.md` (2026-09-10T00:51:57Z, 00:52:02Z, 00:53:24Z), `COLLABORATION.md`

---

## 1. Executive Summary

An exhaustive investigation was conducted into the codebase across `src/core/player/`, `src/core/game/` (`src/core/engine/`), `src/ui/`, `src/render/`, `src/input/`, `src/main.ts`, and `tests/`. 

### Key Discoveries:
1. **Jarring & Abrupt Player Death / Respawn**:
   - Currently, when player HP reaches 0 and `lives > 1`, `PlayerController.takeDamage()` instantly resets `health = maxHealth` and sets `invulnerabilityTimer = 2.0` in the exact same tick. **There is zero death animation, zero sound effect, zero knockback, zero parachute re-entry, and zero pause.** The player simply blinks in place.
   - When all lives are depleted (`lives <= 0`), `this.isAlive = false` and `actionState = DEAD`. In `HUDOverlay.ts`, a flat translucent red rectangle with text `"GAME OVER"` is rendered. **There is no continue countdown, no restart prompt, and keyboard/touch input becomes completely dead.** The player is permanently frozen and must reload the browser.
2. **Missing State Machine for Game Over & Arcade Continue**:
   - `StageManager.ts` defines `StageState.GAME_OVER`, but it is never transitioned to.
   - There is no state machine for an arcade-authentic **"CONTINUE 9... 8... 7..."** countdown screen with coin/credit insertion, button press continuation, or final game over fallback.
3. **Existing Unused Assets**:
   - `ProceduralSpriteFactory.ts` already has 4 pre-rendered player death frames (`player_death_0`, `player_death_1`, `player_death_2`, `player_death_3`), depicting impact shock, airborne spiral tumble, inverted fall, and comic defeat sprawl. They are never animated or used dynamically.
   - Parachute canopy sprites, suspension cord rendering, and swaying physics already exist for enemies (`SoldierEnemy.createParatrooper`, `CanvasRenderer.ts:464-485`), but have never been implemented for the player's iconic tactical drop-in.
4. **HUD Gaps & Coordinate Hardcoding**:
   - `HUDOverlay.ts` hardcodes a 480x270 viewport.
   - The HUD does **not** display the player's Ultimate Move stock (Key `U`), nor shield absorption charges (`shieldCharges`), leaving the player unaware of critical tactical options.
5. **Absence of On-Screen Tutorial & Controls Guide**:
   - There is currently no tutorial overlay or controls instruction placard in the game. New players have no on-screen guidance on movement (WASD/Arrows), 8-way directional aiming, melee knife slashing, jumping, grenades, or ultimate strike.
6. **Root Cause of "Claustrophobic / Stifling" (답답한) Feeling**:
   - The current camera deadzone ([35%, 45%]) and strict forward ratchet lock (`forwardLock: true`) tightly constrain the visible horizon ahead.
   - Ground is at Y: 230 in a 270px tall canvas, leaving only 40px under the ground and compressed platform tiers overhead.
   - The visual presentation lacks the cute, bouncy, animated micro-details (아기자기한 느낌) that define Metal Slug: exaggerated character expressions, fluttering parachutes, comic sweat/fright marks, and glowing arcade button panels.

---

## 2. In-Depth Codebase Audit: As-Is Death & Respawn Flow

### 2.1 Player HP Depletion & Damage Processing
In `src/core/player/PlayerController.ts` (lines 560–594):
```typescript
takeDamage(amount: number = 1.0, engine?: GameEngine): void {
  if (this.invulnerabilityTimer > 0 || !this.isAlive) return;

  // Shield 2-hit damage absorption buffer
  if (this.shieldCharges > 0) {
    this.shieldCharges--;
    this.invulnerabilityTimer = 0.5;
    engine?.eventBus.emit('play_sound', { sound: 'sfx_shield_absorb' });
    engine?.eventBus.emit('shield_hit', { remainingCharges: this.shieldCharges });
    if (this.shieldCharges <= 0) {
      engine?.eventBus.emit('play_sound', { sound: 'sfx_shield_break' });
    }
    return;
  }

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
  } else {
    this.invulnerabilityTimer = 1.0;
    this.actionState = PlayerActionState.HIT_STUN;
  }
}
```

#### Flaws Identified:
1. **Instantaneous Teleport-in-place Respawn**: If `lives > 1`, `lives--` occurs, but `health` is immediately set back to `maxHealth` and `actionState` immediately set to `IDLE`. The player never actually falls down or transitions through death states.
2. **Audio Silence**: No sound effect (`sfx_player_death`, voice scream, or arcade hit sound) is emitted. Only shield events emit sound.
3. **Deadlock on Final Death**: When `lives <= 0`, `this.isAlive = false` and `actionState = DEAD`. In `PlayerController.handleInput()`:
   ```typescript
   if (!this.isAlive) return;
   ```
   All input processing stops completely.
4. **Static Single Frame Rendering**: In `CanvasRenderer.ts` (lines 662–665):
   ```typescript
   if (p.state === 'death') {
     const d = p.animFrame !== undefined ? Math.min(3, p.animFrame) : 2;
     return `player_death_${d}`;
   }
   ```
   Because `main.ts` sets `p.state = 'death'` without providing `animFrame`, it permanently displays static frame `player_death_2`.

### 2.2 Existing Game Over UI
In `src/ui/HUDOverlay.ts` (lines 344–350):
```typescript
private renderGameOverBanner(ctx: CanvasContext2DLike, _time: number): void {
  ctx.fillStyle = 'rgba(40, 0, 0, 0.75)';
  ctx.fillRect(0, 80, 480, 80);

  this.drawPixelText(ctx, 'GAME OVER', 180, 105, '#E74C3C', 2.5, '#000000');
}
```
- A plain red box across the middle of the screen.
- No continue countdown, no timer, no prompt to press any key, and no way to restart without refreshing the page.

---

## 3. Architecture for Death, Continue Countdown & Tactical Respawn

To deliver the smooth, arcade-authentic flow requested by the user, the game loop needs a dedicated state machine for the player life cycle.

### 3.1 State Machine Lifecycle Diagram

```
[ ALIVE / ACTIVE PLAYING ]
            │
            ▼ (Lethal Hit: health <= 0)
[ PLAYER_DYING ] ── 1.2s Knockback & Comic Defeat Tumble
  - Impulse: vx = -facing * 90, vy = -240 px/s
  - Frame sequence: player_death_0 -> 1 -> 2 -> 3
  - Audio: Comical arcade defeat scream & groan
  - Input: Disabled
            │
      Is lives > 0?
     ┌──────┴──────┐
     │ YES         │ NO (lives == 0)
     ▼             ▼
[ RESPAWN_DROP_IN ]        [ CONTINUE_COUNTDOWN ]
  - Spawn at top of screen     - 10-Second Arcade Countdown (9, 8, 7...)
  - Canopy Parachute Descent   - Pulsing Golden Arcade Numeral
  - Horizontal sway & steer    - Cartoon battered character vignette
  - Ground touch -> canopy cut - Blinking "PRESS [FIRE] OR [JUMP] TO CONTINUE"
  - 2.5s Invulnerability       │
  - Announcer: "OK!"           ├────────────────────────┬────────────────────────┐
            │                  │ Player inputs Fire/Jump│ Countdown reaches 0.0s
            │                  ▼                        ▼
            │          [ CONTINUE_ACCEPTED ]    [ GAME_OVER_FINAL ]
            │            - Reset lives = 3        - Game Over Fanfare
            │            - Deduct continue bonus  - "GAME OVER" Retro Banner
            │            - Transition to          - "PRESS [ENTER]/[SPACE]
            │              RESPAWN_DROP_IN          TO RESTART STAGE"
            │                                           │
            │                                           ▼
            └───────────────────────────────────► [ RESET_STAGE ]
```

### 3.2 State Machine Specification

#### State 1: `PLAYER_DYING`
- **Trigger**: `PlayerController.takeDamage()` receives lethal hit (`health <= 0`).
- **Duration**: `1.2` seconds (72 frames at 60Hz).
- **Kinematics**:
  - `velocity.y = -220` (slight upward pop).
  - `velocity.x = -facing * 80` (recoil knockback).
  - Integrates gravity (`600 px/s^2`) so the player arcs backwards and lands on the ground platform.
- **Animation**:
  - `0.0s – 0.2s`: `player_death_0` (flinch & shock).
  - `0.2s – 0.5s`: `player_death_1` (airborne spiral tumble with flying headband).
  - `0.5s – 0.8s`: `player_death_2` (inverted descent).
  - `0.8s – 1.2s`: `player_death_3` (ground crash sprawl with comical dust puff particles).
- **Sound**: Emits `sfx_player_death` (dramatic comical defeat scream).

#### State 2: `RESPAWNING_PARACHUTE`
- **Trigger**: Entering respawn when `lives > 0` (or after pressing Continue).
- **Spawn Position**:
  - `x = clamp(camera.x + 120, stageBounds.minX + 40, stageBounds.maxX - 40)`
  - `y = camera.y + 10` (entering smoothly from top of screen).
- **Descent Mechanics**:
  - Descent terminal speed: `55 px/s` (gentle floating fall).
  - Canopy sway: `angle = sin(time * 3.5) * 0.18 rad`.
  - Player controls: Player can gently steer left/right at `40 px/s` while airborne to choose landing spot!
- **Landing Snap**:
  - Upon ground contact (`isGrounded`): Parachute canopy detaches, floats upward and fades away.
  - Player transitions to `actionState = IDLE`.
  - Invulnerability timer set to `2.5s` with flashing alpha (`Math.floor(time * 12) % 2 === 0 ? 0.4 : 1.0`).
  - Announcer callout: `speech.playOk()` ("OK!").

#### State 3: `CONTINUE_COUNTDOWN`
- **Trigger**: Player loses last life (`lives === 0` and dying sequence completes).
- **Duration**: `10.0` seconds (countdown from 9 down to 0).
- **Audio**:
  - Low rhythmic tension heartbeat / ticking clock every integer second.
  - On 3, 2, 1: Accelerated beep.
- **Visual Presentation**:
  - Semi-transparent darkened vignette (`rgba(10, 10, 20, 0.8)`).
  - Large retro arcade font countdown digit in center: `9`, `8`, `7`, `6`, `5`, `4`, `3`, `2`, `1`, `0` with 3D gold gradient bevel.
  - Comic character portrait: Cartoon Marco with bandage and spinning stars or comically pleading eyes.
  - Flashing prompt: `"PRESS [FIRE] OR [JUMP] TO CONTINUE"`.
  - Touch prompt: On-screen "CONTINUE" button.
- **Input Handling**:
  - If `shootPressed` or `jumpPressed` (or touch):
    - Sound: Credit insert chime + "OK!" voice.
    - Lives restored to 3.
    - Health restored to 1.0.
    - Weapon restored to default handgun with 10 grenades.
    - Transition to `RESPAWNING_PARACHUTE`.

#### State 4: `GAME_OVER_FINAL`
- **Trigger**: Countdown timer expires (`<= 0`).
- **Visual**:
  - Dramatic arcade "GAME OVER" banner.
  - Stage summary: Score tally, POWs rescued, stage reached.
  - Prompt: `"PRESS [ENTER] OR [SPACE] TO RESTART MISSION"`.
- **Input**:
  - Pressing Restart resets Stage 1 cleanly, restores player at initial spawn, and re-initializes all entities.

---

## 4. Tutorial & Controls Overlay Architecture

### 4.1 Requirements & Player Experience
Players must immediately understand the controls without feeling overwhelmed or having their gameplay view permanently blocked.

### 4.2 Control Schema
| Action | Primary Key | Secondary Key | Touch / Gamepad | Authentic Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Move Left / Right** | `A` / `D` | `◀` / `▶` | Virtual D-Pad Left/Right | Walk & run across terrain |
| **Crouch / Crawl** | `S` | `▼` | Virtual D-Pad Down | Duck under bullets; crawl forward |
| **8-Way Aiming** | `W` / `S` / `A` / `D` | `▲` / `▼` / `◀` / `▶` | Virtual D-Pad Angles | Aim upward (ground) or down/diagonal (air) |
| **Fire / Melee** | `J` | `Z` | Virtual Red Button | Ranged shooting; automatic knife slash in melee range |
| **Jump** | `K` / `Space` | `X` | Virtual Blue Button | Tap for low hop, hold for high jump, apex hangtime |
| **Grenade** | `L` | `C` | Virtual Yellow Button | Arcing explosive bomb (10 stock) |
| **Ultimate Move** | `U` | — | Virtual Bomb Icon | Screen-clearing tactical air-strike bomber |
| **Pause** | `Escape` | `Enter` | On-screen Pause button | Freezes simulation & displays menu |
| **Toggle Tutorial** | `H` | `?` | On-screen `[?]` button | Toggles charming instruction card |

### 4.3 Visual Structure of the Tutorial Card
The tutorial card is rendered in canvas space as an arcade cabinet instruction placard:
- **Card Background**: Deep midnight blue/slate with a brushed bronze border, corner rivets, and translucent background (`rgba(16, 22, 34, 0.88)`).
- **Header**: Gold embossed retro text: `★ MISSION CONTROLS & TACTICS ★`.
- **Icon Columns**:
  - **D-Pad / Joystick**: `[WASD / ARROWS]` ➔ `MOVE & 8-WAY AIM` (Crouch on ground, angle fire in air).
  - **Red Button (A)**: `[J / Z]` ➔ `FIRE WEAPON` (Auto Knife slash at point-blank!).
  - **Blue Button (B)**: `[K / X / SPACE]` ➔ `JUMP` (Hold for high jump).
  - **Yellow Button (C)**: `[L / C]` ➔ `GRENADE` (Powerful high-arc bomb).
  - **Gold Badge (D)**: `[U]` ➔ `ULTIMATE STRIKE` (Air-raid bomber screen-clear).
  - **Footer Tip**: `Press [H] to hide/show • Drop through bridges: [S] + [JUMP]`.

### 4.4 Display & Auto-Dismiss Lifecycle
1. **Initial Entrance**: On stage start, the card is displayed at center-top of the screen.
2. **Auto-Dismiss**:
   - Stays fully visible for `5.0` seconds.
   - Smoothly fades out over `1.5` seconds (`alpha` transitions from 1.0 to 0.0) if player moves or shoots.
3. **Manual Toggle**:
   - Pressing `H` or tapping the on-screen `[?]` icon immediately toggles the card with a snappy pop animation.
   - Also integrated directly into the `PAUSED` screen so paused players can read instructions at leisure.

---

## 5. HUD Modernization & Visual Charm (아기자기한 매력)

### 5.1 Analysis of "Claustrophobic / Sterile" (답답한) Feedback
The user specifically noted:
> *"Based on the original, it's not cute/charming at all, and it feels very stifling/claustrophobic."*
> (원작에 비해서 전혀 아기자기한 느낌도 없고 너무 답답하다)

In retro run-and-gun classics like Metal Slug:
- **Why it felt expansive, not stifling**: The camera gave the player generous forward visibility. Sky, terrain, and ocean parallax had rich panoramic layers. The screen did not aggressively trap the player against the left margin.
- **Why it felt cute & charming (아기자기한 느낌)**:
  - Marco Rossi has a comically expressive face: large golden bangs, fluttering red headband, wide expressive eyes, and funny flinching animations.
  - Rescued POWs bow frantically, offer sparkling item crates, and run away waving.
  - Floating score bonus indicators (`+100`, `+500`, `+1000`) pop upward with joyful bounce physics.
  - Speech announcer shouts enthusiastic iconic voice callouts ("OK!", "THANK YOU!", "MISSION COMPLETE!").
  - The HUD features warm brass, golden metallic bevels, glowing badges, and animated icons rather than flat, sterile grey/black rectangles.

### 5.2 Specific UI Enhancements for Charm & Warmth

| Element | Current Implementation | Upgraded Charming Design |
| :--- | :--- | :--- |
| **HUD Frame** | Flat 1px outline | Beveled retro arcade brass/bronze container with shiny metallic rivets |
| **Lives Badge** | Static 8x8 soldier pixel block | Cute mini Marco head with animated blinking eyes and headband tail flutter |
| **Ultimate Badge** | Completely missing from HUD! | Cute winged bomber / tactical missile icon with glowing `READY` aura and `[U] x1` counter |
| **Grenades** | Flat bomb icon | Cartoony round bomb with a sizzling, sparking animated fuse (`spark progress`) |
| **Weapon Badge** | Flat letter `H`, `F` | 3D beveled retro weapon icon with pulsating gold outline when ammo is low |
| **Score & Tallies** | Standard numbers | Popping scale animation on score increases, sparkling coin stars |
| **Warning Banner** | Flat red bar across screen | Pulsing hazard stripes with retro sirens and retro flashing arcade font |
| **Continue Screen** | None (blank red Game Over) | Giant cartoon arcade countdown digits (9..0) with cartoon bandage Marco |

---

## 6. Verification & Automated Test Strategy

To guarantee zero regressions across the existing 463 passing unit tests while rigorously validating the new death, continue, respawn, and tutorial systems, the following test suite must be implemented:

### 6.1 Unit Test Specifications (`tests/unit/ui_respawn_continue.test.ts`)

1. **Player Death Kinematics & Timing**:
   - `test('Player lethal hit transitions actionState to DEAD/DYING with upward knockback impulse')`: Asserts `player.velocity.y < 0` and `player.velocity.x === -facing * 80`.
   - `test('Player dying sequence advances animation frames 0, 1, 2, 3 over 1.2s')`: Simulates step increments of 0.3s and verifies animFrame matches.
   - `test('Input is strictly ignored while player is in dying sequence')`: Feeds keyboard inputs; asserts position and weapon state do not respond.

2. **Tactical Parachute Respawn Loop**:
   - `test('Player with remaining lives transitions to RESPAWNING_PARACHUTE from top of viewport')`: Verifies `position.y` starts near camera top and descent velocity is capped at ~55 px/s.
   - `test('Player touching ground platform snaps and detaches parachute with 2.5s invulnerability')`: Verifies `invulnerabilityTimer >= 2.0` upon `isGrounded === true`.
   - `test('Speech synthesizer emits "OK!" voice callout upon parachute landing')`.

3. **Arcade Continue Countdown State Machine**:
   - `test('Depleting last life (lives === 0) transitions game to CONTINUE_COUNTDOWN')`: Verifies countdown timer initializes to `10.0`.
   - `test('Continue countdown timer decrements monotonically each second (9, 8, 7...)')`: Steps simulation and verifies countdown floor values.
   - `test('Pressing Shoot or Jump during continue countdown restores 3 lives and starts parachute respawn')`: Verifies `lives === 3`, `health === 1.0`, and state changes to respawn.
   - `test('Continue countdown reaching 0.0s transitions to GAME_OVER_FINAL')`: Verifies state transition and prevents further input.

4. **Tutorial Overlay System**:
   - `test('Tutorial overlay initializes visible on stage start and sets 5s auto-dismiss timer')`.
   - `test('Pressing toggle key (KeyH) inverts tutorial overlay visibility')`.
   - `test('Tutorial overlay auto-fades after delay and player movement')`.
   - `test('HUDOverlay.render() safely handles tutorial overlay, continue countdown, and ultimate badge')`.

### 6.2 Playwright E2E Visual Verification Tests (`tests/e2e/ui_respawn_tutorial.spec.ts`)

1. **Artifact 1: Continue Countdown Screen (`artifacts/ui_overhaul/continue_countdown.png`)**:
   - Induces lethal damage when lives = 0.
   - Waits for continue countdown state (e.g. at digit 8 or 7).
   - Captures 960x540 screenshot asserting giant arcade countdown numerals, cartoon vignette, and continue button prompt.

2. **Artifact 2: Player Tactical Parachute Respawn (`artifacts/ui_overhaul/player_respawn_parachute.png`)**:
   - Triggers player respawn from sky.
   - Captures mid-air parachute descent showing white/khaki canopy and suspension cords.

3. **Artifact 3: Charming Tutorial & Controls Overlay (`artifacts/ui_overhaul/tutorial_overlay.png`)**:
   - Captures initial stage view with the arcade control panel placard clearly visible.
   - Verifies all button mappings are sharp, legible, and aesthetically pleasing.

4. **Interactive E2E Continue Verification**:
   - Player takes fatal damage -> enters continue screen.
   - Playwright sends genuine keypress `page.keyboard.press('KeyJ')` (Fire) or `KeyK` (Jump).
   - Asserts that countdown disappears, lives count restores to 3, and player drops in via parachute successfully.

---

## 7. Next Steps & Recommendations for Implementer

1. **Implement `PlayerDeathState` & Parachute Kinematics** in `PlayerController.ts`:
   - Add `deathTimer: number = 0`, `isParachuting: boolean = false`, `respawnTimer: number = 0`.
   - On lethal damage: Do not instant-reset. Enter dying arc, then trigger parachute drop.
2. **Implement Continue State Machine** in `GameEngine.ts` / `FullMetalSlugGame` (main.ts):
   - Add `continueTimer: number = 0`, `isContinueActive: boolean = false`.
   - Handle continue keypress (`J`, `K`, `Space`, or touch) to resume.
3. **Upgrade `HUDOverlay.ts`**:
   - Render Ultimate Move stock icon (`[U] BOMBER x1`).
   - Render charming arcade Continue Countdown screen (large digits 9..0).
   - Render tutorial placard (`HOW TO PLAY / CONTROLS`) with toggle (`H`).
   - Add cute animations (flickering bomb fuse, mini Marco head).
4. **Widescreen Camera & Viewport Presentation**:
   - Ensure the 16:9 viewport feels expansive and breezy by adjusting vertical framing and camera deadzones.
5. **Run Vitest & Playwright Tests**:
   - Keep 100% green test suite across all 463 existing unit tests + new test suite.
   - Capture required visual artifacts in `artifacts/ui_overhaul/`.
