# Milestone 1 Handoff Report: Restart State Engine & Lifecycle Architecture

**Agent**: `explorer_m1_1` (Role: Codebase Researcher / Explorer)  
**Date**: 2026-09-10T15:33:00Z  
**Target Milestone**: Milestone 1 (Restart State Engine & Lifecycle Architecture)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_1`

---

## 1. Observation

### 1.1 `src/main.ts` & `GrimHarvestGame` Lifecycle Missing Restart & Cleanup
- In `src/main.ts` (lines 31–64), `GrimHarvestGame` instantiates 12 subsystems as `public readonly` fields in its constructor:
  - `Player` (lines 66–79)
  - `HordeManager` (lines 80–84)
  - `LootManager` (lines 86)
  - `Camera` (lines 89–95)
  - `KeyboardController` & `TouchVirtualPad` (lines 98–99)
  - `GothicBackdrop`, `DarkFantasyVFX`, `GothicHUD` (lines 102–110)
  - `WeaponManager`, `UpgradeSystem`, `UpgradeModal` (lines 114–122)
  - `WaveDirector` (lines 143–148)
- Lines 202–235 define `public start(): void`:
  ```typescript
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.accumulator = 0;

    const tickFrame = (now: number) => {
      if (!this.isRunning) return;

      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      if (!this.isPaused) {
        this.accumulator += dt;
        while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP) {
          this.step(GrimHarvestGame.FIXED_TIMESTEP);
          this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
        }
      } else {
        this.upgradeModal.update(dt);
      }

      this.render();

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tickFrame);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tickFrame);
    }
  }
  ```
- Lines 237–243 define `public stop(): void`:
  ```typescript
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  ```
- **Finding**: There is **no `restart()` method**, **no `reset()` method**, and **no `destroy()` method** in `src/main.ts`.

### 1.2 Uncapped While-Loop & Accumulator Explosion Vulnerability
- In `src/main.ts` lines 214–219:
  ```typescript
  this.accumulator += dt;
  while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP) {
    this.step(GrimHarvestGame.FIXED_TIMESTEP);
    this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
  }
  ```
- Compare this with `src/core/engine/GameEngine.ts` lines 141–150:
  ```typescript
  const clampedDt = Math.min(dt, this.fixedTimestep * this.maxSubSteps);
  this.accumulator += clampedDt;

  let steps = 0;
  while (this.accumulator >= this.fixedTimestep && steps < this.maxSubSteps) {
    this.tick(this.fixedTimestep);
    this.accumulator -= this.fixedTimestep;
    steps++;
  }
  ```
- **Finding**: In `src/main.ts`, there is **no `maxSubSteps` loop boundary** inside `tickFrame()`. If frame delta `dt` or `accumulator` is elevated (e.g. after garbage collection, tab inactivity, or when re-starting without zeroing `accumulator`), the while-loop iterates without upper bound. Furthermore, if `step()` execution time approaches or exceeds `FIXED_TIMESTEP` (0.01667s), `now - this.lastTime` in subsequent frames becomes larger than the time simulated, causing an unrecoverable CPU spiral of death (main thread freeze).

### 1.3 Game Over Prompt Rendered Without Any Event Listener
- In `src/ui/GothicHUD.ts` line 304–306:
  ```typescript
  if (actualState?.player && !actualState.player.isAlive) {
    this.renderGameOverOverlay(ctx, actualWidth, actualHeight, actualState);
  }
  ```
- In `src/ui/GothicHUD.ts` lines 924–928:
  ```typescript
  const promptPulse = 0.5 + 0.5 * Math.sin(this.lowHPPulseTimer);
  ctx.font = GOTHIC_HUD_THEME.fontSubtitle;
  ctx.fillStyle = `rgba(237, 229, 222, ${0.4 + 0.6 * promptPulse})`;
  ctx.fillText('PRESS [SPACE] OR CLICK TO RESURRECT', width / 2, py + plaqueH - 30);
  ```
- In `src/input/KeyboardController.ts` lines 86–88 & lines 282–289:
  - `Space` is mapped to action `'jump'` (legacy arcade mapping).
  - When `!player.isAlive`, `Player.handleInput()` (lines 116 in `Player.ts`) immediately aborts with `if (!this.isAlive) return;`.
- In `src/main.ts` lines 183–200 (`mount`):
  - Canvas has no click listener attached.
  - `KeyboardController` does not dispatch restart requests.
- **Finding**: Despite the UI displaying `"PRESS [SPACE] OR CLICK TO RESURRECT"`, **zero event listeners exist** in the entire codebase for resurrecting/restarting the session upon Game Over.

### 1.4 State Reset Inventory Across Subsystems
- Direct inspection of all submodules reveals:
  1. `Player` (`src/core/entities/Player.ts`): **Lacks `reset()` method**. `this.stats` values remain modified by passives.
  2. `PlayerProgression` (`src/core/progression/PlayerProgression.ts` lines 101–106): Has `public reset(): void` (resets level to 1, currentXP to 0, totalXP to 0, recalculates xpToNextLevel; preserves registered listeners in `Set`).
  3. `HordeManager` (`src/core/HordeManager.ts` lines 456–461): Has `public clear(): void` (despawns all active enemies, resets spatialGrid). However, `totalSpawned` and `totalKilled` counters are **not reset** by `clear()`.
  4. `LootManager` (`src/core/systems/LootManager.ts` lines 265–271): Has `public clear(): void` (recycles all active items to free pool).
  5. `WeaponManager` (`src/core/weapons/WeaponManager.ts` lines 211–214): Has `public clear(): void` (clears weapons map and projectile pool). Needs `simulationTime = 0` and starter weapon re-equipment.
  6. `UpgradeSystem` (`src/core/systems/UpgradeSystem.ts` lines 324–328): Has `public reset(): void` (clears weapons, passives, evolvedWeapons). Needs starter weapon re-added.
  7. `UpgradeModal` (`src/ui/UpgradeModal.ts` lines 63–73): Has `public close(): void` (removes window keydown and canvas mouse listeners).
  8. `WaveDirector` (`src/core/systems/WaveDirector.ts` lines 454–461): Has `public reset(): void` (resets elapsedTime, spawnTimer, milestone triggers).
  9. `Camera` (`src/render/Camera.ts` lines 85–97): Has `public reset(x, y): void` (resets coordinates, render offset, and clears screen shake).
  10. `DarkFantasyVFX` (`src/render/vfx/DarkFantasyVFX.ts` lines 146–154): Has `public clear(): void` (deactivates all particles in pool).
  11. `GothicHUD` (`src/ui/GothicHUD.ts` lines 148–168): Has `public reset(): void` (resets health/ghost bars, XP bar animations, timers, kill counters).
  12. `KeyboardController` (`src/input/KeyboardController.ts` lines 219–243): Has `public reset(): void` (clears held and edge-latched keys).

---

## 2. Logic Chain

1. **Premise 1 (Missing Restart Orchestration)**: Because `GrimHarvestGame` lacked a centralized `restart()` lifecycle method, external attempts to reset the game (e.g. creating `new GrimHarvestGame(container)` or manual state manipulation) failed to cancel the pre-existing `requestAnimationFrame` loop.
2. **Premise 2 (Concurrent Loops & Stale Clocks)**: When a previous loop is not cancelled via `cancelAnimationFrame` and loop generation tokens, multiple `tickFrame` callbacks run concurrently. Each callback advances the simulation and renders to the same canvas context.
3. **Premise 3 (Accumulator Explosion Mechanism)**:
   - When the player dies or is paused, time continues to elapse in the real world (`performance.now()`).
   - If `lastTime` is not reset to `performance.now()` synchronously at the moment of restart, the very first RAF callback computes `dt = (now - lastTime) / 1000`.
   - Even if clamped to 0.1s, 6 sub-steps are queued. If `step()` takes >16ms due to heavy entity allocation/culling, `now - lastTime` on the next frame is even larger.
   - Because `main.ts` lacks `maxSubSteps` limiting, `while (this.accumulator >= FIXED_TIMESTEP)` runs without bound, hanging the browser thread in an infinite loop.
4. **Premise 4 (Accumulator Safety Guard)**:
   - Introducing `public static readonly MAX_SUB_STEPS = 5;` and capping loop execution (`while (this.accumulator >= FIXED_TIMESTEP && steps < MAX_SUB_STEPS)`) provides a mathematical ceiling on per-frame CPU time.
   - If `steps >= MAX_SUB_STEPS`, discarding residual accumulator debt (`this.accumulator = 0`) guarantees the simulation will never spiral into deadlock.
5. **Premise 5 (Zero-Leak Input Wiring)**:
   - Creating bound handler references once (`this.onKeyDownBound`, `this.onCanvasClickBound`) and registering them during `mount()` (and unregistering in `destroy()`) prevents duplicate event listeners across any number of restarts.
   - Checking `canResurrect()` with conditions (`!this.player.isAlive && !this.upgradeModal.getIsOpen() && this.deathTimer >= 0.5`) ensures:
     a) Space key during active play never triggers restart.
     b) Space key while selecting an upgrade card never triggers restart.
     c) Accidental Space spamming upon death does not instantly dismiss the Game Over plaque (enforces a 500ms debounce buffer).

---

## 3. Caveats

1. **No Caveats on Root Cause**: The infinite loop and missing restart mechanism are 100% accounted for by the missing `restart()` method, uncapped while-loop, and lack of event wiring.
2. **Touch/Mobile Restart**: While desktop focuses on `[Space]` and Canvas `click`, mobile touch users tap the screen, which synthesizes standard `click` events on the canvas element. Thus, wiring Canvas `click` inherently supports mobile touch resurrection without requiring extra touch-specific event logic.
3. **Victory State**: Currently `WaveDirector` escalates continuously up to `ABYSSAL_SIEGE` (120s+). A formal `isVictory` flag or 5-minute survival threshold can be wired identically through `canResurrect()` (`(!this.player.isAlive || this.isVictory)`).

---

## 4. Conclusion & Concrete Implementation Recommendations

### Recommendation 1: `Player.ts` — Add `public reset()` Method
In `src/core/entities/Player.ts`, implement:
```typescript
public reset(startX: number = 0, startY: number = 0): void {
  this.position.x = startX;
  this.position.y = startY;
  this.velocity.x = 0;
  this.velocity.y = 0;
  this.bounds.x = startX - Player.COLLISION_RADIUS;
  this.bounds.y = startY - Player.COLLISION_RADIUS;
  this.bounds.width = Player.COLLISION_RADIUS * 2;
  this.bounds.height = Player.COLLISION_RADIUS * 2;

  this.isAlive = true;
  this.invulnerabilityTimer = 0;
  this.facingAngle = 0;
  this.facingDirection = 1;

  this.stats.maxHealth = 100;
  this.stats.currentHealth = 100;
  this.stats.healthRegen = DEFAULT_PLAYER_STATS.healthRegen;
  this.stats.armor = 0;
  this.stats.moveSpeed = 200;
  this.stats.might = 1.0;
  this.stats.area = 1.0;
  this.stats.projSpeed = 1.0;
  this.stats.cooldownReduction = 0.0;
  this.stats.magnetRadius = 100;
  this.stats.luck = 1.0;

  this.progression.reset();
}
```

### Recommendation 2: `HordeManager.ts` — Add `public reset()` Method
In `src/core/HordeManager.ts`, implement:
```typescript
public reset(): void {
  this.clear();
  this.totalSpawned = 0;
  this.totalKilled = 0;
}
```

### Recommendation 3: `src/main.ts` — Overhaul `GrimHarvestGame` Lifecycle
In `src/main.ts`:
1. Add loop generation token, maximum substep constant, and death debounce timer:
   ```typescript
   public static readonly MAX_SUB_STEPS = 5;
   private loopEpoch: number = 0;
   public deathTimer: number = 0;
   public isVictory: boolean = false;
   private readonly onKeyDownBound: (e: KeyboardEvent) => void;
   private readonly onCanvasClickBound: (e: MouseEvent) => void;
   ```
2. Bind handlers in constructor:
   ```typescript
   this.onKeyDownBound = this.handleKeyDown.bind(this);
   this.onCanvasClickBound = this.handleCanvasClick.bind(this);
   ```
3. Update `start()` with generation token and accumulator guard:
   ```typescript
   public start(): void {
     if (this.isRunning) return;
     this.isRunning = true;
     const currentEpoch = ++this.loopEpoch;
     this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
     this.accumulator = 0;

     const tickFrame = (now: number) => {
       if (!this.isRunning || this.loopEpoch !== currentEpoch) return;

       const rawDt = (now - this.lastTime) / 1000;
       const dt = Math.max(0, Math.min(rawDt, 0.1));
       this.lastTime = now;

       if (!this.isPaused && this.player.isAlive && !this.isVictory) {
         this.accumulator += dt;
         let steps = 0;
         while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP && steps < GrimHarvestGame.MAX_SUB_STEPS) {
           this.step(GrimHarvestGame.FIXED_TIMESTEP);
           this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
           steps++;
         }
         if (steps >= GrimHarvestGame.MAX_SUB_STEPS) {
           this.accumulator = 0; // Prevent spiral of death
         }
       } else if (this.upgradeModal.getIsOpen()) {
         this.upgradeModal.update(dt);
       } else if (!this.player.isAlive || this.isVictory) {
         this.deathTimer += dt;
         this.vfx.update(dt); // Keep particle animations fluid during game over
       }

       this.render();

       if (this.isRunning && this.loopEpoch === currentEpoch && typeof requestAnimationFrame !== 'undefined') {
         this.animationFrameId = requestAnimationFrame(tickFrame);
       }
     };

     if (typeof requestAnimationFrame !== 'undefined') {
       this.animationFrameId = requestAnimationFrame(tickFrame);
     }
   }
   ```
4. Update `stop()`:
   ```typescript
   public stop(): void {
     this.isRunning = false;
     this.loopEpoch++;
     if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
       cancelAnimationFrame(this.animationFrameId);
       this.animationFrameId = null;
     }
   }
   ```
5. Implement `restart()`:
   ```typescript
   public restart(): void {
     // 1. Cancel in-flight RAF loops
     this.stop();

     // 2. Reset clock & lifecycle flags
     this.isPaused = false;
     this.isVictory = false;
     this.elapsedTime = 0;
     this.killCount = 0;
     this.pendingLevelUps = 0;
     this.deathTimer = 0;
     this.accumulator = 0;
     this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

     // 3. Reset modal
     this.upgradeModal.close();

     // 4. Reset Player & Progression
     this.player.reset(0, 0);

     // 5. Reset Horde & Grid
     this.hordeManager.reset();

     // 6. Reset Loot Pool
     this.lootManager.clear();

     // 7. Reset Weapons
     this.weaponManager.clear();
     this.weaponManager.simulationTime = 0;
     this.weaponManager.addWeapon('scythe', 1);

     // 8. Reset Upgrade System
     this.upgradeSystem.reset();
     this.upgradeSystem.addWeapon('weapon_scythe', 1);

     // 9. Reset Wave Director
     this.waveDirector.reset();

     // 10. Reset Camera
     this.camera.reset(-GrimHarvestGame.VIRTUAL_WIDTH / 2, -GrimHarvestGame.VIRTUAL_HEIGHT / 2);
     this.camera.update(0, 0, GrimHarvestGame.FIXED_TIMESTEP);

     // 11. Reset VFX
     this.vfx.clear();

     // 12. Reset HUD
     this.hud.reset();

     // 13. Reset Keyboard
     this.keyboard.reset();

     // 14. Deploy initial swarm
     this.spawnInitialSwarm();

     // 15. Restart RAF loop
     this.start();
   }
   ```
6. Implement `canResurrect()`, `handleKeyDown`, `handleCanvasClick`:
   ```typescript
   public canResurrect(): boolean {
     return (!this.player.isAlive || this.isVictory) &&
            !this.upgradeModal.getIsOpen() &&
            this.deathTimer >= 0.5;
   }

   private handleKeyDown(e: KeyboardEvent): void {
     if (e.repeat) return;
     if (e.code === 'Space' || e.key === ' ') {
       if (this.canResurrect()) {
         if (typeof e.preventDefault === 'function') {
           e.preventDefault();
         }
         this.restart();
       }
     }
   }

   private handleCanvasClick(e: MouseEvent): void {
     if (this.canResurrect()) {
       if (typeof e.preventDefault === 'function') {
         e.preventDefault();
       }
       this.restart();
     }
   }
   ```
7. Wire listeners in `mount(container)` and detach in `destroy()`:
   ```typescript
   public mount(container: HTMLElement): void {
     let canvas = container.querySelector<HTMLCanvasElement>('canvas#game-canvas');
     if (!canvas) {
       canvas = document.createElement('canvas');
       canvas.id = 'game-canvas';
       canvas.width = GrimHarvestGame.VIRTUAL_WIDTH;
       canvas.height = GrimHarvestGame.VIRTUAL_HEIGHT;
       container.appendChild(canvas);
     }
     this.canvas = canvas;
     this.ctx = canvas.getContext('2d');

     this.touchPad.mount(container);
     const isTouchDevice =
       typeof window !== 'undefined' &&
       ('ontouchstart' in window || navigator.maxTouchPoints > 0);
     this.touchPad.setVisible(isTouchDevice);

     // Safe listener attachment
     if (this.canvas) {
       this.canvas.removeEventListener('click', this.onCanvasClickBound);
       this.canvas.addEventListener('click', this.onCanvasClickBound);
     }
     if (typeof window !== 'undefined') {
       window.removeEventListener('keydown', this.onKeyDownBound);
       window.addEventListener('keydown', this.onKeyDownBound);
     }
   }

   public destroy(): void {
     this.stop();
     if (this.canvas) {
       this.canvas.removeEventListener('click', this.onCanvasClickBound);
     }
     if (typeof window !== 'undefined') {
       window.removeEventListener('keydown', this.onKeyDownBound);
     }
     this.keyboard.detach();
     this.upgradeModal.close();
   }
   ```

---

## 5. Verification Method

### 5.1 Unit Test Suite (`tests/unit/restart.spec.ts`)
Create a comprehensive test file `tests/unit/restart.spec.ts` verifying:
1. **Full Subsystem Re-initialization**:
   - Mutate `player` (take 80 damage, add 200 XP, level up to 3, move to `(500, 500)`).
   - Spawn 100 horde enemies, kill 40 of them (`totalKilled = 40`).
   - Spawn 50 loot items in `lootManager`.
   - Add weapons (Lightning, Spear) and passives (Tome of Might) to `weaponManager` and `upgradeSystem`.
   - Advance `waveDirector.elapsedTime` to 85s (Phase: Nightfall).
   - Emit 150 blood particles in `vfx`.
   - Call `game.restart()`.
   - Assert:
     - `player.isAlive === true`
     - `player.position.x === 0 && player.position.y === 0`
     - `player.stats.currentHealth === 100`
     - `player.level === 1 && player.currentXP === 0`
     - `hordeManager.getActiveCount() === 35` (initial wave)
     - `hordeManager.totalKilled === 0`
     - `lootManager.getActiveCount() === 0`
     - `weaponManager.getEquippedCount() === 1`
     - `weaponManager.getWeapon('scythe')?.rank === 1`
     - `upgradeSystem.getWeaponSlotsCount() === 1`
     - `upgradeSystem.getPassivesInventory().length === 0`
     - `waveDirector.elapsedTime === 0`
     - `game.elapsedTime === 0`
     - `game.killCount === 0`
     - `game.isPaused === false`
     - `vfx.getActiveCount() === 0`
2. **Spiral of Death & Infinite Loop Prevention**:
   - Mock RAF `now` jumping by 15.0 seconds (`dt = 15.0`).
   - Run frame tick.
   - Assert `step()` is called at most `MAX_SUB_STEPS` (5) times and accumulator drops to 0 without hanging.
3. **RAF Concurrency & Epoch Invalidation**:
   - Verify `stop()` increments `loopEpoch` and cancels pending `animationFrameId`.
   - Verify that any queued callback from a prior epoch aborts immediately.
4. **Safe Event Triggering & Debounce**:
   - Assert Space key does not restart when `player.isAlive === true`.
   - Assert Space key does not restart when `deathTimer < 0.5`.
   - Assert Space key triggers `restart()` when `!player.isAlive && deathTimer >= 0.5`.
   - Assert Space key does not restart when `upgradeModal.getIsOpen() === true`.
   - Assert Canvas click mirrors Space key resurrection behavior.

### 5.2 Commands to Run
```bash
# Run the complete unit test suite including the new restart specs
npm test

# Run Vitest directly on restart tests
npx vitest run tests/unit/restart.spec.ts

# TypeScript verification
npx tsc --noEmit
```

### 5.3 Invalidation Conditions
- Any test where `game.restart()` leaves active enemies from the prior session.
- Any test where `accumulator` is not reset to 0 upon restart.
- Any test where multiple concurrent RAF loops are detected.
- Any test where pressing Space during active gameplay triggers an unexpected restart.
