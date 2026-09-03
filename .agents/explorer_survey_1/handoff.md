# Handoff Report — Explorer 1: Input & Player Kinematics / Jump Mechanics Investigation

**Agent**: Explorer 1  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1`  
**Target Areas**: `src/input/KeyboardController.ts`, `src/core/player/PlayerKinematics.ts`, `src/core/player/PlayerController.ts`, `src/main.ts`, `tests/`

---

## 1. Observation

### 1.1 `src/input/KeyboardController.ts` Key Mapping & Parsing
Direct inspection of `/Users/user/teamwork_projects/metal_slug_web/src/input/KeyboardController.ts` revealed:

1. **Space is explicitly mapped to `'fire'` in `codeMap`**:
   Lines 72-80:
   ```typescript
   // Fire: J, Z, Space
   KeyJ: 'fire',
   KeyZ: 'fire',
   Space: 'fire',

   // Jump: K, X
   KeyK: 'jump',
   KeyX: 'jump',
   ```
2. **Space is explicitly mapped to `'fire'` in `resolveAction` key fallback**:
   Lines 257-264:
   ```typescript
   case 'j':
   case 'z':
   case ' ':
     return 'fire';
   case 'k':
   case 'x':
     return 'jump';
   ```
3. **No Edge-Trigger Latching Between Frames**:
   Lines 154-158:
   ```typescript
   public getSnapshot(): PlayerInputSnapshot {
     const jumpPressed = this.jump && !this.prevJump;
     const shootPressed = this.fire && !this.prevFire;
     const grenadePressed = this.grenade && !this.prevGrenade;
   ```
   And lines 217-235:
   ```typescript
   private handleKeyDown(e: KeyboardEvent): void {
     const action = this.resolveAction(e);
     if (!action) return;
     ...
     this.setAction(action, true);
   }

   private handleKeyUp(e: KeyboardEvent): void {
     const action = this.resolveAction(e);
     if (!action) return;
     this.setAction(action, false);
   }
   ```
   In browser event loops, if `handleKeyDown` and `handleKeyUp` execute before `getSnapshot()` runs inside the `requestAnimationFrame` tick (e.g. during rapid human tapping or Playwright's `await page.keyboard.press('KeyK')`), `this.jump` becomes `true` and then immediately `false`. When `getSnapshot()` executes:
   `jumpPressed = this.jump && !this.prevJump` evaluates to `false && !false === false`.
   The jump event is completely dropped and never delivered to the simulation engine.

### 1.2 `src/core/player/PlayerController.ts` & `PlayerKinematics.ts` Kinematics Loop
1. **Input Snapshot Processing**:
   In `src/core/player/PlayerController.ts` lines 146-203:
   ```typescript
   if (input.jumpPressed && !input.down) {
     this.jumpBufferTimer = PlayerKinematics.JUMP_BUFFER_FRAMES * timestep;
   }
   ...
   const wantsJump = (input.jumpPressed || this.jumpBufferTimer > 0) && !input.down;
   const canJump = (this.isGrounded || this.coyoteTimer > 0) && !this.isDroppingThrough;

   if (canJump && wantsJump) {
     this.performJump(engine);
   }
   ```
2. **Jump Impulse**:
   Lines 104-113:
   ```typescript
   public performJump(engine: GameEngine): void {
     this.velocity.y = PlayerKinematics.JUMP_IMPULSE; // -360 px/s
     this.isGrounded = false;
     this.coyoteTimer = 0;
     this.jumpBufferTimer = 0;
     this.jumpCutApplied = false;
     this.posture = PlayerPosture.AIRBORNE;
     this.actionState = PlayerActionState.JUMPING;
     engine.eventBus.emit('play_sound', { sound: 'sfx_player_jump' });
   }
   ```
3. **Gravity & Euler Integration**:
   Lines 475-494:
   ```typescript
   if (!this.isGrounded) {
     const isApex = Math.abs(this.velocity.y) < PlayerKinematics.APEX_FLOAT_VELOCITY_THRESHOLD;
     const effectiveGravity = isApex
       ? PlayerKinematics.GRAVITY * PlayerKinematics.APEX_GRAVITY_SCALE
       : PlayerKinematics.GRAVITY;

     this.velocity.y += effectiveGravity * dt;
     if (this.velocity.y > PlayerKinematics.TERMINAL_FALL_VELOCITY) {
       this.velocity.y = PlayerKinematics.TERMINAL_FALL_VELOCITY;
     }
     ...
   }
   const prevY = this.position.y;
   this.position.x += this.velocity.x * dt;
   this.position.y += this.velocity.y * dt;
   ```
4. **Ground Collision Resolver**:
   In `src/core/physics/Platform.ts` line 64:
   ```typescript
   // If downward velocity is negative (moving up), entity passes through
   if (vy < 0) {
     return { isGrounded: false, groundY: currFootY, platform: null };
   }
   ```
   When ascending (`vy < 0`), `resolveGroundContact` does NOT ground the player. The player remains airborne, and their Y coordinate continuously decreases.

### 1.3 Empirical Evidence & Bug Reproduction via Automated Execution
We executed an empirical test script (`.agents/explorer_survey_1/test_hypothesis.js`) and Playwright headless Chromium test (`.agents/explorer_survey_1/prototype.spec.ts`):

1. **Spacebar Keydown Test**:
   ```
   After Space keydown -> kb.fire: true kb.jump: false
   snapWithSpace: { jumpPressed: false, jumpHeld: false, shootPressed: true, shootHeld: true }
   After Space handleInput -> player.velocity.y: 0 player.isGrounded: true
   After Space update -> player.position.y: 230 player.isGrounded: true
   ```
   **Verbatim Result**: Space generated `shootPressed: true` and `shootHeld: true`. `jumpPressed` was `false`. Player Y remained strictly `230`. Space fired a bullet and NEVER jumped.
2. **KeyK Keydown Test**:
   ```
   [PROTOTYPE TEST] KeyK startY: 230
   [PROTOTYPE TEST] KeyK midJumpY: { y: 186, vy: -240, isGrounded: false }
   ```
   **Verbatim Result**: When jump input is received, player Y changes from `230` to `186` (a decrease of $44\text{ px}$, i.e., upward movement), and `isGrounded` becomes `false`.
3. **Quick-Tap Key Drop Test**:
   ```
   Testing quick tap (keydown immediately followed by keyup before getSnapshot):
   Quick tap snapshot for KeyK: { jumpPressed: false, jumpHeld: false }
   ```
   **Verbatim Result**: Because of missing edge-latch state, a keypress released before `getSnapshot()` was dropped completely.
4. **ArrowRight Movement Test**:
   ```
   [PROTOTYPE TEST] ArrowRight startX: 80 endX: 106.4 delta: 26.4
   ```
   **Verbatim Result**: Horizontal movement integrates accurately ($+132\text{ px/s} \times 0.2\text{s} = 26.4\text{ px}$).

---

## 2. Logic Chain

1. **Premise 1**: Users in web browsers expect `Space` to be the primary jump key, as documented in the Acceptance Criteria: *"A headless browser test MUST simulate pressing the jump key (e.g., Spacebar) and mathematically assert that the player sprite's Y-coordinate actually changes (moves upward)."*
2. **Observation 1**: In `src/input/KeyboardController.ts`, `Space` is mapped to `'fire'` in `codeMap` (line 75) and `resolveAction` (line 259).
3. **Observation 2**: When `Space` is pressed, `this.fire` becomes `true`, but `this.jump` remains `false`.
4. **Observation 3**: In `PlayerController.handleInput()`, `wantsJump` depends exclusively on `input.jumpPressed || this.jumpBufferTimer > 0`. Because `input.jumpPressed` is `false`, `performJump()` is never called when pressing Space. Instead, `input.shootPressed` is `true`, triggering `weaponManager.tryFire()` (creating a handgun projectile).
5. **Observation 4**: In previous test suites (`tests/unit/input_and_hud.test.ts` and `tests/e2e/visual_verification.spec.ts`), tests bypassed the keyboard listener by executing synthetic internal method calls:
   ```typescript
   game.keyboard.setAction('jump', true);
   game.step(1 / 60);
   game.keyboard.setAction('jump', false);
   ```
   This concealed the fact that real DOM `Space` key events fired guns and never jumped.
6. **Observation 5**: In standard headless browser automation (`page.keyboard.press('Space')` or `'KeyK'`), `keydown` and `keyup` are dispatched in immediate succession. In `KeyboardController.ts`, `keyup` resets `this.jump = false` before `getSnapshot()` is called by the `requestAnimationFrame` loop. Consequently, `this.jump && !this.prevJump` evaluates to `false && !false = false`.
7. **Deduction**: The player's Y coordinate failed to alter when pressing Spacebar because:
   - Primary: Spacebar was explicitly mapped to `fire` instead of `jump`.
   - Secondary: Without edge latching, any rapid key tap was discarded before the next 60Hz physics tick.
8. **Confirmation**: Once Space is mapped to `'jump'` and latching is enabled, pressing Spacebar sets `velocity.y = -360 px/s`, decreasing player Y from `230` to `166px` across 15 frames, visually and mathematically confirming upward vertical movement.

---

## 3. Caveats

1. **No Source Code Modified**: In accordance with the Explorer role and system instructions, zero production files in `src/` or `tests/` were modified during this investigation. All prototypes and tests were executed in `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/`.
2. **Horizontal Left Clamping**: Player horizontal movement (`ArrowLeft`, `KeyA`) moves the player leftward ($v_x = -132\text{ px/s}$). Currently, there is no hard barrier preventing the player from moving past $X < \text{cameraX} + 12$ or $X < 12$. Adding a viewport clamp in `PlayerController.update` is recommended to prevent the player from walking off the left edge of the screen.
3. **Touch Controls**: `TouchVirtualPad.ts` already maps its blue button to `jump` and red button to `fire`. Its edge-detection works similarly to `KeyboardController` and could also benefit from the same edge-latch enhancement for ultra-responsive mobile touch input.

---

## 4. Conclusion & Required Code Changes

### 4.1 Required Key Mappings
The controls must be configured as follows:
- **Jump**: `Space`, `KeyK`, `KeyX` (and fallback `key === ' '`, `'k'`, `'x'`)
- **Fire / Shoot**: `KeyJ`, `KeyZ` (and fallback `key === 'j'`, `'z'`)
- **Grenade**: `KeyL`, `KeyC` (and fallback `key === 'l'`, `'c'`)
- **Movement & Aiming**: `KeyW` / `ArrowUp` (aim up), `KeyS` / `ArrowDown` (crouch / aim down), `KeyA` / `ArrowLeft` (move left), `KeyD` / `ArrowRight` (move right)
- **Pause**: `Enter`, `Escape`

### 4.2 Exact Code Modifications in `src/input/KeyboardController.ts`

#### Step 1: Add Edge-Latch Member Variables
In `KeyboardController` class (around line 47):
```typescript
  // Edge-detected button latches to prevent dropping rapid key taps between animation frames
  private jumpJustPressed: boolean = false;
  private fireJustPressed: boolean = false;
  private grenadeJustPressed: boolean = false;
```

#### Step 2: Update `codeMap`
Replace lines 72-84:
```typescript
<<<< BEFORE
    // Fire: J, Z, Space
    KeyJ: 'fire',
    KeyZ: 'fire',
    Space: 'fire',

    // Jump: K, X
    KeyK: 'jump',
    KeyX: 'jump',

    // Grenade: L, C
    KeyL: 'grenade',
    KeyC: 'grenade',
====
>>>> AFTER
    // Jump: Space, K, X
    Space: 'jump',
    KeyK: 'jump',
    KeyX: 'jump',

    // Fire: J, Z
    KeyJ: 'fire',
    KeyZ: 'fire',

    // Grenade: L, C
    KeyL: 'grenade',
    KeyC: 'grenade',
<<<<
```

#### Step 3: Update `resolveAction` Key Fallback
Replace lines 257-266:
```typescript
<<<< BEFORE
      case 'j':
      case 'z':
      case ' ':
        return 'fire';
      case 'k':
      case 'x':
        return 'jump';
      case 'l':
      case 'c':
        return 'grenade';
====
>>>> AFTER
      case ' ':
      case 'k':
      case 'x':
        return 'jump';
      case 'j':
      case 'z':
        return 'fire';
      case 'l':
      case 'c':
        return 'grenade';
<<<<
```

#### Step 4: Latch Edge Presses in `handleKeyDown` and `setAction`
In `handleKeyDown`:
```typescript
  private handleKeyDown(e: KeyboardEvent): void {
    const action = this.resolveAction(e);
    if (!action) return;

    // Prevent default scrolling for game controls
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.key === ' ') {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
    if (action === 'fire' && !this.fire) this.fireJustPressed = true;
    if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;

    this.setAction(action, true);
  }
```
In `setAction`:
```typescript
  public setAction(action: KeyAction, value: boolean): void {
    if (value) {
      if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
      if (action === 'fire' && !this.fire) this.fireJustPressed = true;
      if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;
    }
    ...
  }
```

#### Step 5: Consume Edge Latches in `getSnapshot` and Clear in `reset`
In `getSnapshot`:
```typescript
  public getSnapshot(): PlayerInputSnapshot {
    const jumpPressed = this.jumpJustPressed || (this.jump && !this.prevJump);
    const shootPressed = this.fireJustPressed || (this.fire && !this.prevFire);
    const grenadePressed = this.grenadeJustPressed || (this.grenade && !this.prevGrenade);

    this.jumpJustPressed = false;
    this.fireJustPressed = false;
    this.grenadeJustPressed = false;
    ...
```
In `reset`:
```typescript
  public reset(): void {
    ...
    this.jumpJustPressed = false;
    this.fireJustPressed = false;
    this.grenadeJustPressed = false;
  }
```

---

## 5. Verification Method

### 5.1 Unit Tests (`tests/unit/input_and_hud.test.ts` or new `tests/unit/keyboard_controls.test.ts`)
Add automated unit tests verifying:
1. **DOM KeyboardEvent Mapping**:
   ```typescript
   const controller = new KeyboardController();
   // Space key
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
   expect(controller.jump).toBe(true);
   expect(controller.fire).toBe(false);

   // KeyK & KeyX
   controller.reset();
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'KeyK', key: 'k' }));
   expect(controller.jump).toBe(true);
   controller.reset();
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'KeyX', key: 'x' }));
   expect(controller.jump).toBe(true);

   // KeyJ & KeyZ
   controller.reset();
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j' }));
   expect(controller.fire).toBe(true);
   expect(controller.jump).toBe(false);

   // KeyL & KeyC
   controller.reset();
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }));
   expect(controller.grenade).toBe(true);
   ```
2. **Fast Tap Edge Latch Persistence**:
   ```typescript
   controller.reset();
   controller['handleKeyDown'](new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
   controller['handleKeyUp'](new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
   const snap = controller.getSnapshot();
   expect(snap.jumpPressed).toBe(true);
   expect(snap.jumpHeld).toBe(false);
   ```
3. **Run Unit Tests**:
   ```bash
   npm test
   ```
   Assert all tests pass 100% green.

### 5.2 Playwright E2E Tests (`tests/e2e/gameplay_controls.spec.ts`)
Create a new dedicated Playwright test suite:
```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E Gameplay Controls & Kinematics Verification', () => {
  test('R1: pressing Spacebar causes player Y-coordinate to decrease (move upward)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const initialY = await page.evaluate(() => (window as any).__GAME__.player.position.y);
    expect(initialY).toBe(230);

    // Simulate pressing Spacebar
    await page.keyboard.press('Space');
    // Sample during ascent (~150ms / 9 frames)
    await page.waitForTimeout(150);

    const jumpState = await page.evaluate(() => {
      const p = (window as any).__GAME__.player;
      return { y: p.position.y, vy: p.velocity.y, isGrounded: p.isGrounded };
    });

    // In 2D canvas coordinates, smaller Y is UPWARD
    expect(jumpState.y).toBeLessThan(initialY - 25);
    expect(jumpState.vy).toBeLessThan(0);
    expect(jumpState.isGrounded).toBe(false);

    // Wait for full jump arc to complete and land
    await page.waitForTimeout(650);
    const landedY = await page.evaluate(() => (window as any).__GAME__.player.position.y);
    expect(landedY).toBe(initialY);
  });

  test('R1: pressing KeyK and KeyX also causes player Y-coordinate to decrease', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const initialY = await page.evaluate(() => (window as any).__GAME__.player.position.y);

    await page.keyboard.press('KeyK');
    await page.waitForTimeout(150);
    const yK = await page.evaluate(() => (window as any).__GAME__.player.position.y);
    expect(yK).toBeLessThan(initialY - 25);

    await page.waitForTimeout(650);

    await page.keyboard.press('KeyX');
    await page.waitForTimeout(150);
    const yX = await page.evaluate(() => (window as any).__GAME__.player.position.y);
    expect(yX).toBeLessThan(initialY - 25);
  });

  test('R1: pressing ArrowRight and ArrowLeft moves player X-coordinate', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const startX = await page.evaluate(() => (window as any).__GAME__.player.position.x);

    // Move Right
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');

    const rightX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    expect(rightX).toBeGreaterThan(startX + 18);

    // Move Left
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowLeft');

    const leftX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    expect(leftX).toBeLessThan(rightX - 18);
  });

  test('R1: pressing KeyJ fires weapon without altering Y-coordinate', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const start = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      return {
        y: g.player.position.y,
        bullets: g.engine.getAllEntities().filter((e: any) => e.type === 'PROJECTILE').length,
      };
    });

    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      return {
        y: g.player.position.y,
        bullets: g.engine.getAllEntities().filter((e: any) => e.type === 'PROJECTILE').length,
      };
    });

    expect(after.bullets).toBeGreaterThan(start.bullets);
    expect(after.y).toBe(start.y); // Y is unaffected
  });
});
```
Execute via:
```bash
npm run build && npm run test:e2e
```
Assert 100% green pass.

---

### Summary for Implementing Agents
- **Worker 1 (Controls & Input)**: Apply the exact changes to `src/input/KeyboardController.ts` (re-map `Space` to `'jump'`, latch `jumpJustPressed` / `fireJustPressed` / `grenadeJustPressed`).
- **Worker 4 (E2E Verification)**: Create `tests/e2e/gameplay_controls.spec.ts` using the provided test suite.
- **Worker 5 (Unit Tests)**: Update `tests/unit/input_and_hud.test.ts` to include DOM KeyboardEvent dispatch and edge-latch unit tests.
