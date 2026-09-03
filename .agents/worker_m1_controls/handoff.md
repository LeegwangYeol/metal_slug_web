# Handoff Report — Milestone 1 (M1: Key Controls & Jump Fix)

**Agent**: Worker 1 (Controls & Input Specialist)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_controls`  
**Exclusive Write Ownership**: `src/input/KeyboardController.ts`  
**Target Milestone**: M1 (Key Controls and Jump Fix)  

---

## 1. Observation

### 1.1 Pre-Modification Code Inspection
Prior to modification, direct inspection of `/Users/user/teamwork_projects/metal_slug_web/src/input/KeyboardController.ts` showed:
1. **Spacebar Incorrectly Mapped to 'fire'**:
   - Lines 72-80:
     ```typescript
     // Fire: J, Z, Space
     KeyJ: 'fire',
     KeyZ: 'fire',
     Space: 'fire',

     // Jump: K, X
     KeyK: 'jump',
     KeyX: 'jump',
     ```
   - Lines 257-264:
     ```typescript
     case 'j':
     case 'z':
     case ' ':
       return 'fire';
     case 'k':
     case 'x':
       return 'jump';
     ```
2. **Missing Edge-Detection Latching**:
   - Lines 154-158:
     ```typescript
     public getSnapshot(): PlayerInputSnapshot {
       const jumpPressed = this.jump && !this.prevJump;
       const shootPressed = this.fire && !this.prevFire;
       const grenadePressed = this.grenade && !this.prevGrenade;
     ```
   - When a fast key tap occurred (DOM `keydown` followed immediately by `keyup` before the 60Hz `getSnapshot()` call), `this.jump` reverted to `false`, causing `this.jump && !this.prevJump` to evaluate to `false && !false === false`. The keypress was dropped.

### 1.2 Modifications Applied to `src/input/KeyboardController.ts`
The following modifications were made to `src/input/KeyboardController.ts`:
- Re-mapped `Space`, `KeyK`, and `KeyX` to `'jump'`.
- Re-mapped `KeyJ` and `KeyZ` to `'fire'`.
- Re-mapped `KeyL` and `KeyC` to `'grenade'`.
- Preserved WASD (`KeyW`, `KeyA`, `KeyS`, `KeyD`) and Arrow Keys (`ArrowUp`, `ArrowLeft`, `ArrowDown`, `ArrowRight`) mapping to directions and aiming.
- Added edge-detection latches (`jumpJustPressed`, `fireJustPressed`, `grenadeJustPressed`) to capture keydown events and hold them until consumed by `getSnapshot()`.
- Updated `reset()` to clear all latched flags.

### 1.3 Exact Line Diff
Verbatim `git diff src/input/KeyboardController.ts`:
```diff
diff --git a/src/input/KeyboardController.ts b/src/input/KeyboardController.ts
index d27e2ce..f5f2e3a 100644
--- a/src/input/KeyboardController.ts
+++ b/src/input/KeyboardController.ts
@@ -3,8 +3,8 @@
  *
  * Mappings:
  * - Movement & 8-Way Aiming: WASD / Arrow Keys
- * - Fire: J / Z / Space
- * - Jump: K / X
+ * - Fire: J / Z
+ * - Jump: Space / K / X
  * - Grenade: L / C
  * - Pause: Enter / Escape
  *
@@ -39,6 +39,11 @@ export class KeyboardController {
   public grenade: boolean = false;
   public pause: boolean = false;
 
+  // Latched edge-detection flags to preserve fast key taps between frames
+  public jumpJustPressed: boolean = false;
+  public fireJustPressed: boolean = false;
+  public grenadeJustPressed: boolean = false;
+
   // Previous button states for edge-detection (Pressed vs Held)
   private prevJump: boolean = false;
   private prevFire: boolean = false;
@@ -69,16 +74,16 @@ export class KeyboardController {
     ArrowDown: 'down',
     ArrowRight: 'right',
 
-    // Fire: J, Z, Space
-    KeyJ: 'fire',
-    KeyZ: 'fire',
-    Space: 'fire',
-
-    // Jump: K, X
+    // Jump: Space, KeyK, KeyX
+    Space: 'jump',
     KeyK: 'jump',
     KeyX: 'jump',
 
-    // Grenade: L, C
+    // Fire: KeyJ, KeyZ
+    KeyJ: 'fire',
+    KeyZ: 'fire',
+
+    // Grenade: KeyL, KeyC
     KeyL: 'grenade',
     KeyC: 'grenade',
 
@@ -152,9 +157,14 @@ export class KeyboardController {
    * Generates and advances a PlayerInputSnapshot with edge-detected pressed flags.
    */
   public getSnapshot(): PlayerInputSnapshot {
-    const jumpPressed = this.jump && !this.prevJump;
-    const shootPressed = this.fire && !this.prevFire;
-    const grenadePressed = this.grenade && !this.prevGrenade;
+    const jumpPressed = this.jumpJustPressed || (this.jump && !this.prevJump);
+    const shootPressed = this.fireJustPressed || (this.fire && !this.prevFire);
+    const grenadePressed = this.grenadeJustPressed || (this.grenade && !this.prevGrenade);
+
+    // Clear edge-detection latches after snapshot consumption
+    this.jumpJustPressed = false;
+    this.fireJustPressed = false;
+    this.grenadeJustPressed = false;
 
     // Edge-detect pause toggle
     if (this.pause && !this.prevPause) {
@@ -193,6 +203,10 @@ export class KeyboardController {
     this.grenade = false;
     this.pause = false;
 
+    this.jumpJustPressed = false;
+    this.fireJustPressed = false;
+    this.grenadeJustPressed = false;
+
     this.prevJump = false;
     this.prevFire = false;
     this.prevGrenade = false;
@@ -219,12 +233,18 @@ export class KeyboardController {
     if (!action) return;
 
     // Prevent default scrolling for game controls
-    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
+    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.key === ' ') {
       if (typeof e.preventDefault === 'function') {
         e.preventDefault();
       }
     }
 
+    if (!e.repeat) {
+      if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
+      if (action === 'fire' && !this.fire) this.fireJustPressed = true;
+      if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;
+    }
+
     this.setAction(action, true);
   }
 
@@ -254,13 +274,13 @@ export class KeyboardController {
       case 'd':
       case 'arrowright':
         return 'right';
-      case 'j':
-      case 'z':
       case ' ':
-        return 'fire';
       case 'k':
       case 'x':
         return 'jump';
+      case 'j':
+      case 'z':
+        return 'fire';
       case 'l':
       case 'c':
         return 'grenade';
@@ -273,6 +293,11 @@ export class KeyboardController {
   }
 
   public setAction(action: KeyAction, value: boolean): void {
+    if (value) {
+      if (action === 'jump' && !this.jump) this.jumpJustPressed = true;
+      if (action === 'fire' && !this.fire) this.fireJustPressed = true;
+      if (action === 'grenade' && !this.grenade) this.grenadeJustPressed = true;
+    }
     switch (action) {
       case 'left':
         this.left = value;
```

### 1.4 Verification Outputs
1. **Unit Tests**: `npx vitest run tests/unit/input_and_hud.test.ts`
   ```
   RUN  v3.2.7 /Users/user/src/fullmetalslug

   ✓ tests/unit/input_and_hud.test.ts (12 tests) 26ms

   Test Files  1 passed (1)
        Tests  12 passed (12)
     Start at  17:36:57
     Duration  1.19s
   ```
2. **Build & Typecheck**: `npm run build`
   ```
   > fullmetalslug@1.0.0 build
   > tsc -b && vite build

   vite v6.4.3 building for production...
   transforming...
   ✓ 31 modules transformed.
   rendering chunks...
   computing gzip size...
   dist/index.html                  1.26 kB │ gzip:  0.58 kB
   dist/assets/index-Ai9lZIDV.js  173.62 kB │ gzip: 45.31 kB │ map: 637.56 kB
   ✓ built in 662ms
   ```
3. **Automated Mechanical Checks**:
   - DOM Event Mappings: Space, KeyK, KeyX -> jump; KeyJ, KeyZ -> fire; KeyL, KeyC -> grenade; WASD/Arrows -> directions. All passed.
   - Fast Tap Latching: Keydown + Keyup before `getSnapshot()` -> `jumpPressed: true`, `jumpHeld: false` in snapshot 1; `jumpPressed: false` in snapshot 2. Passed.
   - Headless In-Engine Physics Simulation:
     ```
     Initial player position: { x: 80, y: 230, vy: 0, isGrounded: true }
     After tick 1 (Space down): { x: 80, y: 224.22, vy: -346.67, isGrounded: false }
     After 6 ticks mid-jump: { x: 80, y: 213.11, vy: -106.67, isGrounded: false }
     Jump verified! Delta Y: -16.89px
     ```
   - Headless In-Engine Fast Tap Physics Simulation:
     ```
     Space keydown + keyup both dispatched BEFORE game.step(1/60).
     After tick 1 following fast tap: { x: 80, y: 224.22, vy: -346.67, isGrounded: false }
     Fast tap latching verified! Delta Y: -5.78px
     ```

---

## 2. Logic Chain

1. **Observation 1.1** revealed that pressing `Space` previously set `this.fire = true`, causing `PlayerController` to fire bullets instead of jumping.
2. Re-mapping `Space` (both `codeMap['Space'] = 'jump'` and `resolveAction` fallback `' ' -> 'jump'`) ensures that pressing Spacebar triggers the `'jump'` action.
3. Rapid key tapping in modern browsers or automated test environments (e.g. Playwright's `await page.keyboard.press('Space')`) can dispatch both `keydown` and `keyup` within the same frame before `getSnapshot()` is called by `requestAnimationFrame`.
4. Adding `jumpJustPressed`, `fireJustPressed`, and `grenadeJustPressed` ensures that any keydown event sets the latched flag to `true`. Because `handleKeyUp` does not reset this latch, the flag remains `true` until `getSnapshot()` consumes it and clears it for the next frame.
5. In `PlayerController.handleInput()`, `wantsJump = (input.jumpPressed || this.jumpBufferTimer > 0) && !input.down`. With `input.jumpPressed = true`, `performJump(engine)` is called, setting `velocity.y = -360 px/s` and `isGrounded = false`.
6. Physics integration `y += vy * dt` over subsequent ticks decreases `y` (from $230\text{px}$ down to $224.22\text{px}$, $213.11\text{px}$, etc.), mathematically and visually proving upward movement on Spacebar press.

---

## 3. Caveats

1. **Exclusive Write Scope**: Only `src/input/KeyboardController.ts` was modified, strictly respecting the assigned ownership boundary. No other files in `src/` or `tests/` were altered.
2. **Old Boss Test Expectations**: `tests/unit/enemy_boss_statemachine.test.ts` still has assertions expecting the un-rebalanced 1500 HP boss. These tests will be updated by Worker 3 (Boss Rebalance) and Worker 4 (Test Suite Maintenance) in their respective milestone scopes. `tests/unit/input_and_hud.test.ts` (the input test suite) passed 100% green.

---

## 4. Conclusion

Milestone 1 (M1: Key Controls and Jump Fix) is fully implemented and genuinely verified:
- `Space`, `KeyK`, and `KeyX` map to `'jump'`.
- `KeyJ` and `KeyZ` map to `'fire'`.
- `KeyL` and `KeyC` map to `'grenade'`.
- `WASD` and `Arrow Keys` accurately map to directions and 8-way aiming.
- Edge-detection latching reliably preserves rapid taps across browser frame intervals.
- Player character reliably jumps upward ($\Delta Y < 0$) on Spacebar press.
- Build compiles cleanly without errors.

---

## 5. Verification Method

To independently verify this implementation, run:

1. **Input & HUD Unit Tests**:
   ```bash
   npx vitest run tests/unit/input_and_hud.test.ts
   ```
   *Expected result*: 12 of 12 tests pass.

2. **TypeScript Compilation and Production Build**:
   ```bash
   npm run build
   ```
   *Expected result*: Zero errors, successful bundle generation in `dist/`.

3. **Empirical Headless Test (DOM Space Jump & Latching)**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame(null as any);
   const initialY = game.player.position.y;
   game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
   game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);
   game.step(1/60);
   if (game.player.position.y >= initialY) throw new Error('Jump failed');
   console.log('SUCCESS: Space jump delta Y =', game.player.position.y - initialY);
   "
   ```
   *Expected result*: Prints `SUCCESS: Space jump delta Y = -5.7777777777777715`.
