# Milestone 1 Investigation Report: Restart State Engine & Lifecycle Architecture

**Agent**: `explorer_m1_3` (Codebase Researcher / Explorer)  
**Date**: 2026-09-10T15:33:00Z  
**Target Milestone**: Milestone 1 (Restart State Engine & Lifecycle Architecture)  
**Status**: Read-Only Investigation Complete — Ready for Implementation  

---

## 1. Observation

Direct examination of the codebase reveals the architectural state and exact defect locations responsible for the game restart failure and state leakage:

### 1.1 `src/main.ts` (Lines 31–413)
- **Defect 1: Total Absence of `restart()` Lifecycle Method**: `GrimHarvestGame` defines `constructor()`, `start()`, `stop()`, `update()`, `step()`, and `render()`, but has **no** `restart()` or `reinitialize()` method.
- **Defect 2: Missing Game Over Event Listeners**: In `src/ui/GothicHUD.ts` (lines 927–928), the HUD renders:
  ```ts
  ctx.fillText('PRESS [SPACE] OR CLICK TO RESURRECT', width / 2, py + plaqueH - 30);
  ```
  However, in `src/main.ts`, no event listeners on canvas `click` or keyboard `Space` are wired to trigger any resurrection or restart action when `!this.player.isAlive`. The game loop remains frozen on the Game Over screen indefinitely.
- **Defect 3: Unbounded Accumulator Loop (Main Thread Hang)**: In `src/main.ts` lines 214–219:
  ```ts
  if (!this.isPaused) {
    this.accumulator += dt;
    while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP) {
      this.step(GrimHarvestGame.FIXED_TIMESTEP);
      this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
    }
  }
  ```
  Unlike `GameEngine.ts` (line 144) which caps sub-steps at `maxSubSteps = 5`, `GrimHarvestGame.start()` has no sub-step ceiling. When restarting after a long idle period or after external re-instantiation, if `lastTime` is stale or `accumulator` spikes, this `while` loop runs thousands of iterations on a single frame, causing the browser tab to hang in an infinite execution freeze.

### 1.2 `src/core/weapons/WeaponManager.ts` (Lines 27–215)
- **Defect 1: Incomplete `clear()`**: Lines 211–214:
  ```ts
  public clear(): void {
    this.weapons.clear();
    this.projectilePool.clear();
  }
  ```
- **Defect 2: Local Weapon Projectile Pools Leak**: `BoneSpear.ts` (line 26) maintains its own `public readonly projectilePool: ProjectilePool = new ProjectilePool(256)`. Merely clearing `WeaponManager.projectilePool` does not clear `BoneSpear.projectilePool` if weapon instances are retained or referenced.
- **Defect 3: Residual Weapon Manager State**: `simulationTime` (line 40) and `hitCooldownBuffer` (line 38) are not reset in `clear()`.
- **Defect 4: Weapons Map Left Empty**: After `clear()`, `this.weapons.size === 0`. The game initializes with Rank 1 Arcane Scythe (`this.weaponManager.addWeapon('scythe', 1)` in `main.ts` line 139), but `clear()` leaves the player completely unarmed.

### 1.3 `src/core/systems/UpgradeSystem.ts` (Lines 307–329) & `src/ui/UpgradeModal.ts` (Lines 22–73)
- In `UpgradeSystem.ts`:
  ```ts
  public reset(): void {
    this.weapons.clear();
    this.passives.clear();
    this.evolvedWeapons.clear();
  }
  ```
  `reset()` clears all weapon and passive records, but does not re-add the starter weapon (`weapon_scythe` Rank 1).
- In `UpgradeModal.ts`:
  - `close()` (lines 63–73) sets `this.isOpen = false` and removes mouse/keyboard listeners, but does **not** clear `this.cards = []`, `this.hoveredIndex`, or `this.selectedIndex`.
  - In `main.ts`, `this.pendingLevelUps` and `this.isPaused` are maintained on the `GrimHarvestGame` instance. If a player restarts while the modal is open or with pending level-ups, `pendingLevelUps` remains non-zero and `isPaused` remains `true`, keeping the simulation frozen.

### 1.4 `src/core/systems/WaveDirector.ts` (Lines 454–462)
- `WaveDirector` **already** implements a clean `reset()` method:
  ```ts
  public reset(): void {
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.lastPeriodicBossMinute = 2;
    for (let i = 0; i < this.milestones.length; i++) {
      this.milestones[i].triggered = false;
    }
  }
  ```
  Calling `waveDirector.reset()` cleanly restores `elapsedTime = 0`, phase `AWAKENING` (0:00–0:30), 100% skeleton weight, baseline HP/speed/cadence multipliers, and all milestone triggers.

### 1.5 `src/render/Camera.ts` (Lines 85–97) & `src/ui/GothicHUD.ts` (Lines 148–168)
- `Camera.reset(x = 0, y = 0)` is **already** implemented in `src/render/Camera.ts`:
  ```ts
  public reset(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
    this.maxReachedX = x;
    this.renderX = x;
    this.renderY = y;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.clampToBounds();
  }
  ```
  This zeroes screen shake trauma and resets coordinates.
- `GothicHUD.reset()` is **already** implemented in `src/ui/GothicHUD.ts` (lines 148–168), resetting XP, current level, health, ghost drain timers, kill count, and timer string to `'00:00'`.

### 1.6 `src/core/entities/Player.ts` (Lines 32–89) & `src/core/HordeManager.ts` (Lines 456–461)
- `Player.ts`: Does not have a `reset()` method. Its `progression` instance (`PlayerProgression.ts` line 101) does have `reset()`, but `Player` properties (`position`, `velocity`, `bounds`, `isAlive`, `stats`, `invulnerabilityTimer`) are not reset in a single call.
- `HordeManager.ts`: `clear()` (line 456) despawns all active enemies and clears `spatialGrid`, but leaves `totalSpawned` and `totalKilled` unreset.

---

## 2. Logic Chain

1. **Root Cause of the Infinite Loop / Freeze**:
   - When a session ends (player HP = 0), `isAlive = false`. The simulation continues to call `step()` and `render()`.
   - If an external caller or UI attempted to re-instantiate `new GrimHarvestGame()`, the prior instance's RAF loop was never stopped (`cancelAnimationFrame` was never called), resulting in dual concurrent RAF loops competing for canvas and input.
   - If `restart()` is triggered after any real-world delay, `now - this.lastTime` can be large. Without an accumulator sub-step clamp and without an immediate clock reset (`this.lastTime = performance.now(); this.accumulator = 0`), the `while (this.accumulator >= FIXED_TIMESTEP)` loop executes an enormous batch of ticks synchronously, freezing the browser.
2. **State Leakage Across Subsystems**:
   - In `HordeManager`, if enemies are not despawned back to the pool, their IDs remain registered in `SpatialHashGrid`, leading to collision against phantom entities in the restarted session.
   - In `LootManager`, uncollected soul gems must be recycled to prevent pool starvation and unexpected instant XP collection on resurrection.
   - In `WeaponManager`, any lingering projectiles from `BoneSpear` or slashes from `ArcaneScythe` must be removed, and the arsenal must be strictly reset to Rank 1 Arcane Scythe.
   - In `UpgradeSystem` & `UpgradeModal`, an open modal or pending level-up counter pauses the engine (`isPaused = true`). Calling `restart()` must close the modal, detach DOM listeners, reset `pendingLevelUps = 0`, and set `isPaused = false`.
   - In `WaveDirector`, if `elapsedTime` is not reset, the game will spawn late-game Nightfall/Abyssal Siege enemies with high HP multipliers against a Level 1 player with Rank 1 starter weapon.
   - In `Camera`, residual `shakeIntensity` or trauma timer would cause the camera to violently jitter upon resurrection.
3. **Synthesis**:
   A deterministic, single-point `GrimHarvestGame.restart()` method that sequentially coordinates the reset of every subsystem guarantees 100% clean resurrection with zero memory leaks, zero accumulator drift, and zero stale state.

---

## 3. Caveats

1. **DOM vs Headless Node Testing**:
   In unit tests (Vitest under Node.js), `window`, `document`, and `HTMLCanvasElement` are undefined unless polyfilled or mocked. `GrimHarvestGame`'s constructor and lifecycle methods must remain completely safe when instantiated without DOM arguments (`new GrimHarvestGame()` without `container`).
2. **Spacebar Key Event Contention**:
   Spacebar is used both for in-game jump/action during gameplay and for resurrection when dead. The resurrection listener must strictly guard on `!this.player.isAlive` to prevent accidental restarts during normal gameplay.
3. **No Modification Rule for Explorer**:
   As `explorer_m1_3`, this report contains recommended code and unit test designs only. Source code modifications must be executed by implementation workers after user authorization.

---

## 4. Conclusion & Actionable Implementation Recommendations

### 4.1 Changes to `src/core/weapons/WeaponManager.ts`
Implement `WeaponManager.reset(starterWeaponId = 'scythe', starterRank = 1)`:
```ts
public reset(starterWeaponId: string = 'scythe', starterRank: number = 1): void {
  // 1. Purge weapon-specific projectile pools and active visuals
  for (const weapon of this.weapons.values()) {
    if ((weapon as any).projectilePool?.clear) {
      (weapon as any).projectilePool.clear();
    }
    if (Array.isArray((weapon as any).activeSlashes)) {
      (weapon as any).activeSlashes.length = 0;
    }
    if (Array.isArray((weapon as any).skulls)) {
      (weapon as any).skulls.length = 0;
    }
    if (Array.isArray((weapon as any).activeBolts)) {
      (weapon as any).activeBolts.length = 0;
    }
    if (Array.isArray((weapon as any).activeRings)) {
      (weapon as any).activeRings.length = 0;
    }
    weapon.timer = 0;
  }

  // 2. Clear weapon map and central projectile pool
  this.weapons.clear();
  this.projectilePool.clear();

  // 3. Reset manager clocks and scratch buffers
  this.simulationTime = 0;
  this.hitCooldownBuffer.fill(-999);
  this.scratchEnemyIds.fill(0);

  // 4. Re-equip Rank 1 starter weapon
  if (starterWeaponId) {
    this.addWeapon(starterWeaponId, starterRank);
  }
}
```

### 4.2 Changes to `src/core/systems/UpgradeSystem.ts` & `src/ui/UpgradeModal.ts`
1. In `UpgradeSystem.ts`:
```ts
public reset(starterWeaponId: string = 'weapon_scythe', starterRank: number = 1): void {
  this.weapons.clear();
  this.passives.clear();
  this.evolvedWeapons.clear();
  if (starterWeaponId) {
    this.addWeapon(starterWeaponId, starterRank);
  }
}
```
2. In `UpgradeModal.ts`:
```ts
public reset(): void {
  this.close();
  this.cards = [];
  this.level = 1;
  this.hoveredIndex = null;
  this.selectedIndex = 0;
  this.pulseTimer = 0;
  this.cardBounds = [];
}
```

### 4.3 Changes to `src/core/entities/Player.ts`
Implement `Player.reset(startX = 0, startY = 0)`:
```ts
public reset(startX: number = 0, startY: number = 0): void {
  this.position.x = startX;
  this.position.y = startY;
  this.velocity.x = 0;
  this.velocity.y = 0;
  this.bounds.x = startX - Player.COLLISION_RADIUS;
  this.bounds.y = startY - Player.COLLISION_RADIUS;
  this.isAlive = true;
  this.facingAngle = 0;
  this.facingDirection = 1;
  this.invulnerabilityTimer = 0;

  // Reset stats to initial baseline
  this.stats.maxHealth = DEFAULT_PLAYER_STATS.maxHealth;
  this.stats.currentHealth = DEFAULT_PLAYER_STATS.currentHealth;
  this.stats.healthRegen = DEFAULT_PLAYER_STATS.healthRegen;
  this.stats.armor = DEFAULT_PLAYER_STATS.armor;
  this.stats.moveSpeed = 200;
  this.stats.might = DEFAULT_PLAYER_STATS.might;
  this.stats.area = DEFAULT_PLAYER_STATS.area;
  this.stats.projSpeed = DEFAULT_PLAYER_STATS.projSpeed;
  this.stats.cooldownReduction = DEFAULT_PLAYER_STATS.cooldownReduction;
  this.stats.magnetRadius = 100;
  this.stats.luck = DEFAULT_PLAYER_STATS.luck;

  // Reset XP progression curve
  this.progression.reset();
}
```

### 4.4 Changes to `src/core/HordeManager.ts`
Implement `HordeManager.reset()`:
```ts
public reset(): void {
  this.clear();
  this.totalSpawned = 0;
  this.totalKilled = 0;
}
```

### 4.5 Changes to `src/main.ts` (`GrimHarvestGame`)
1. Implement `restart()`:
```ts
public restart(): void {
  // 1. Simulation clock & loop state
  this.elapsedTime = 0;
  this.killCount = 0;
  this.isPaused = false;
  this.pendingLevelUps = 0;
  this.accumulator = 0;
  this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // 2. Upgrade modal reset
  this.upgradeModal.reset();

  // 3. Player entity reset
  this.player.reset(0, 0);

  // 4. Horde manager & spatial grid reset
  this.hordeManager.reset();

  // 5. Loot drops purge
  this.lootManager.clear();

  // 6. Weapons reset (starter Rank 1 Arcane Scythe)
  this.weaponManager.reset('scythe', 1);

  // 7. Upgrade system reset (starter Rank 1 Arcane Scythe)
  this.upgradeSystem.reset('weapon_scythe', 1);

  // 8. Wave director reset (Phase 1, 0:00)
  this.waveDirector.reset();

  // 9. Camera & screen shake zeroing
  this.camera.reset(0, 0);
  this.camera.update(0, 0, 0);

  // 10. Particle VFX clear
  this.vfx.clear();

  // 11. HUD reset
  this.hud.reset();

  // 12. Input controllers reset
  this.keyboard.reset();
  this.touchPad.reset();

  // 13. Re-spawn initial perimeter swarm
  this.spawnInitialSwarm();
}
```

2. Add accumulator safety clamp in `tickFrame` (`start()` method):
```ts
if (!this.isPaused) {
  this.accumulator += dt;
  let subSteps = 0;
  const maxSubSteps = 5;
  while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP && subSteps < maxSubSteps) {
    this.step(GrimHarvestGame.FIXED_TIMESTEP);
    this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
    subSteps++;
  }
  if (subSteps >= maxSubSteps) {
    this.accumulator = 0; // Discard backlogged time to prevent death spiral
  }
}
```

3. Wire Canvas Click & Spacebar Listeners in `mount()` and `step()`:
```ts
// In mount(container):
canvas.addEventListener('click', () => {
  if (!this.player.isAlive) {
    this.restart();
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!this.player.isAlive && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      this.restart();
    }
  });
}

// In step(dt):
if (!this.player.isAlive) {
  const kbSnap = this.keyboard.getSnapshot();
  if (kbSnap.jumpPressed) {
    this.restart();
    return;
  }
}
```

---

## 5. Verification Method & Concrete Plan for `tests/unit/restart.spec.ts`

The test suite for `tests/unit/restart.spec.ts` should be structured as follows:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { WavePhaseId } from '../../src/core/systems/WaveDirector';
import { LootDropType } from '../../src/core/systems/LootManager';

describe('GrimHarvestGame Restart Lifecycle & State Engine Suite (Milestone 1)', () => {
  let game: GrimHarvestGame;

  beforeEach(() => {
    // Headless instantiation (no container/DOM required)
    game = new GrimHarvestGame();
  });

  describe('Suite 1: Clock & Accumulator Reset', () => {
    it('resets elapsedTime, killCount, and unpauses simulation', () => {
      // Simulate 45s of active gameplay
      for (let i = 0; i < 45 * 60; i++) {
        game.step(1 / 60);
      }
      expect(game.elapsedTime).toBeGreaterThan(40);

      game.restart();
      expect(game.elapsedTime).toBe(0);
      expect(game.killCount).toBe(0);
      expect(game.isPaused).toBe(false);
    });

    it('prevents accumulator freeze and advances 60 ticks without error', () => {
      game.restart();
      expect(() => {
        for (let i = 0; i < 60; i++) {
          game.step(1 / 60);
        }
      }).not.toThrow();
      expect(game.elapsedTime).toBeCloseTo(1.0, 2);
    });
  });

  describe('Suite 2: Player Entity State Restoration', () => {
    it('resurrects deceased player with 100 HP at origin (0, 0)', () => {
      game.player.position.x = 450;
      game.player.position.y = -300;
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);
      expect(game.player.stats.currentHealth).toBe(0);

      game.restart();
      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(100);
      expect(game.player.position.x).toBe(0);
      expect(game.player.position.y).toBe(0);
      expect(game.player.invulnerabilityTimer).toBe(0);
    });

    it('resets player level and XP progression back to Level 1 / 0 XP', () => {
      game.player.gainXP(250);
      expect(game.player.level).toBeGreaterThan(1);
      expect(game.player.currentXP).toBeGreaterThan(0);

      game.restart();
      expect(game.player.level).toBe(1);
      expect(game.player.currentXP).toBe(0);
      expect(game.player.totalXPEarned).toBe(0);
    });
  });

  describe('Suite 3: WeaponManager & Projectile Pool Reset', () => {
    it('purges non-starter weapons and restores Rank 1 starter Arcane Scythe', () => {
      game.weaponManager.addWeapon('orbiters', 3);
      game.weaponManager.addWeapon('spear', 2);
      game.weaponManager.addWeapon('lightning', 4);
      expect(game.weaponManager.getEquippedCount()).toBe(4);

      game.restart();
      expect(game.weaponManager.getEquippedCount()).toBe(1);
      expect(game.weaponManager.hasWeapon('scythe')).toBe(true);
      expect(game.weaponManager.getWeapon('scythe')?.rank).toBe(1);
      expect(game.weaponManager.getWeapon('scythe')?.isEvolution).toBe(false);
      expect(game.weaponManager.hasWeapon('orbiters')).toBe(false);
      expect(game.weaponManager.hasWeapon('spear')).toBe(false);
    });

    it('clears active projectiles and resets simulation timer', () => {
      game.weaponManager.addWeapon('spear', 1);
      const spear = game.weaponManager.getWeapon('spear') as any;
      if (spear?.fireProjectile) {
        spear.fireProjectile(1, 0);
      }
      game.weaponManager.update(1.0);

      game.restart();
      expect(game.weaponManager.projectilePool.getActiveCount()).toBe(0);
      expect(game.weaponManager.simulationTime).toBe(0);
    });
  });

  describe('Suite 4: UpgradeSystem & UpgradeModal Reset', () => {
    it('clears passives, closes modal, and resets pending level ups', () => {
      game.upgradeSystem.addPassive('passive_might', 3);
      game.upgradeSystem.addPassive('passive_chalice', 2);
      expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(2);

      // Force open modal
      game.handlePlayerLevelUp(2);
      expect(game.isPaused).toBe(true);

      game.restart();
      expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(0);
      expect(game.upgradeSystem.getWeaponSlotsCount()).toBe(1);
      expect(game.upgradeModal.getIsOpen()).toBe(false);
      expect(game.isPaused).toBe(false);
    });
  });

  describe('Suite 5: WaveDirector & Swarm Reset', () => {
    it('resets timeline to Phase 1 (Awakening), resets multipliers, and re-spawns initial swarm', () => {
      // Fast forward wave director to Nightfall (>60s)
      game.waveDirector.update(75, 0, 0, 0, 0);
      expect(game.waveDirector.getCurrentPhase().id).toBe(WavePhaseId.NIGHTFALL);
      expect(game.waveDirector.getHPMultiplier()).toBeGreaterThan(1.2);

      game.restart();
      expect(game.waveDirector.elapsedTime).toBe(0);
      expect(game.waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);
      expect(game.waveDirector.getHPMultiplier()).toBeCloseTo(1.0, 4);

      // Initial swarm: 25 skeletons + 10 ghouls = 35 enemies
      expect(game.hordeManager.getActiveCount()).toBe(35);
      expect(game.hordeManager.totalKilled).toBe(0);
    });
  });

  describe('Suite 6: LootManager & Drop Pool Purge', () => {
    it('clears all lingering soul shards and pickups', () => {
      game.lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 50, 50);
      game.lootManager.spawnDrop(LootDropType.RUBY_GEM, 100, 100);
      expect(game.lootManager.getActiveCount()).toBe(2);

      game.restart();
      expect(game.lootManager.getActiveCount()).toBe(0);
    });
  });

  describe('Suite 7: Camera & Screen Shake Reset', () => {
    it('zeroes camera shake trauma and resets view position', () => {
      game.camera.shake(30, 2.5);
      game.camera.x = 800;
      game.camera.y = 600;

      game.restart();
      expect(game.camera.shakeIntensity).toBe(0);
      expect(game.camera.shakeTimer).toBe(0);
      expect(game.camera.shakeOffsetX).toBe(0);
      expect(game.camera.shakeOffsetY).toBe(0);
    });
  });

  describe('Suite 8: Resurrection Trigger via Jump/Space Input', () => {
    it('triggers restart and resurrection when player dies and jump input is received', () => {
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Simulate Spacebar press
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);

      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(100);
      expect(game.elapsedTime).toBe(0);
    });
  });
});
```

### Verification Commands:
1. `npm test`: Run entire Vitest unit test suite (assert 19 files, ~220 tests 100% green).
2. `npx vitest run tests/unit/restart.spec.ts`: Run the dedicated restart test suite.
3. `npx tsc --noEmit`: Ensure clean TypeScript type-checking with zero compilation errors.
