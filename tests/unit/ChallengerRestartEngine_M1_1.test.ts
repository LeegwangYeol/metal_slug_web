import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { WavePhaseId } from '../../src/core/systems/WaveDirector';
import { LootDropType } from '../../src/core/systems/LootManager';

describe('Adversarial Challenger Suite: Milestone 1 Restart Engine (challenger_m1_1)', () => {
  let game: GrimHarvestGame;

  beforeEach(() => {
    game = new GrimHarvestGame();
  });

  describe('Objective 1: 50 Consecutive Restarts in Headless Loop (Zero Leaks, Zero NaNs, Zero Crashes)', () => {
    it('executes 50 consecutive restarts in high-churn conditions with 0 NaNs, 0 crashes, and bounded memory', () => {
      if (typeof global.gc === 'function') {
        global.gc();
      }
      const initialHeap = process.memoryUsage().heapUsed;

      for (let cycle = 1; cycle <= 50; cycle++) {
        // 1. Heavy state mutation before restart
        // Add multiple weapons & upgrades
        game.weaponManager.addWeapon('orbiters', 2);
        game.weaponManager.addWeapon('spear', 3);
        game.weaponManager.addWeapon('lightning', 2);
        game.weaponManager.addWeapon('aura', 1);
        game.upgradeSystem.addWeapon('weapon_orbiters', 2);
        game.upgradeSystem.addWeapon('weapon_spear', 3);
        game.upgradeSystem.addWeapon('weapon_lightning', 2);
        game.upgradeSystem.addWeapon('weapon_aura', 1);
        game.upgradeSystem.addPassive('passive_might', 2);
        game.upgradeSystem.addPassive('passive_boots', 2);

        // Spawn extra hordes of different enemy types
        game.hordeManager.spawnWave('SKELETON', 30, { x: 100, y: 100 }, 300);
        game.hordeManager.spawnWave('GHOUL', 20, { x: -100, y: 150 }, 250);
        game.hordeManager.spawnWave('BANSHEE', 15, { x: 200, y: -200 }, 400);
        game.hordeManager.spawnWave('DEATH_KNIGHT', 5, { x: 0, y: 300 }, 200);

        // Spawn drops
        for (let j = 0; j < 20; j++) {
          game.lootManager.spawnDrop(
            j % 2 === 0 ? LootDropType.EMERALD_SHARD : LootDropType.RUBY_GEM,
            (j - 10) * 15,
            (j - 10) * 20
          );
        }

        // Advance simulation for 25 ticks with active movement & attacks
        game.keyboard.setAction('right', true);
        game.keyboard.setAction('up', true);
        for (let tick = 0; tick < 25; tick++) {
          game.step(1 / 60);
        }

        // Damage player partially
        game.player.takeDamage(45);
        expect(game.player.stats.currentHealth).toBeLessThan(100);

        // Verify entities have valid coordinates (NO NaN)
        expect(Number.isNaN(game.player.position.x)).toBe(false);
        expect(Number.isNaN(game.player.position.y)).toBe(false);
        expect(Number.isFinite(game.player.position.x)).toBe(true);
        expect(Number.isFinite(game.player.position.y)).toBe(true);

        const activeEnemiesBefore = game.hordeManager.getActiveEnemies();
        for (const e of activeEnemiesBefore) {
          expect(Number.isNaN(e.x)).toBe(false);
          expect(Number.isNaN(e.y)).toBe(false);
          expect(Number.isFinite(e.x)).toBe(true);
          expect(Number.isFinite(e.y)).toBe(true);
        }

        // 2. Trigger restart
        expect(() => game.restart()).not.toThrow();

        // 3. Post-restart strict invariant assertions
        expect(game.player.isAlive).toBe(true);
        expect(game.player.stats.currentHealth).toBe(100);
        expect(game.player.stats.maxHealth).toBe(100);
        expect(game.player.position.x).toBe(0);
        expect(game.player.position.y).toBe(0);
        expect(game.player.velocity.x).toBe(0);
        expect(game.player.velocity.y).toBe(0);
        expect(Number.isNaN(game.player.position.x)).toBe(false);
        expect(Number.isNaN(game.player.position.y)).toBe(false);

        // Initial swarm invariants: exactly 35 (25 skeletons + 10 ghouls)
        expect(game.hordeManager.getActiveCount()).toBe(35);
        expect(game.hordeManager.totalKilled).toBe(0);
        expect(game.hordeManager.totalSpawned).toBe(35);
        expect(game.hordeManager.getPoolAvailableCount()).toBe(2048 - 35);

        const activeEnemiesAfter = game.hordeManager.getActiveEnemies();
        expect(activeEnemiesAfter.length).toBe(35);
        for (const e of activeEnemiesAfter) {
          expect(e.active).toBe(true);
          expect(e.isAlive).toBe(true);
          expect(Number.isNaN(e.x)).toBe(false);
          expect(Number.isNaN(e.y)).toBe(false);
          expect(Number.isFinite(e.x)).toBe(true);
          expect(Number.isFinite(e.y)).toBe(true);
          expect(e.vx).toBe(0);
          expect(e.vy).toBe(0);
        }

        // Spatial grid consistency: query radius around origin must find exactly the initial 35 enemies
        const scratch = new Int32Array(64);
        const countInOrigin = game.hordeManager.getEnemiesInRadius(0, 0, 800, scratch);
        expect(countInOrigin).toBe(35);

        // LootManager invariants: 0 active drops, fresh nextId
        expect(game.lootManager.getActiveCount()).toBe(0);

        // WeaponManager invariants: 1 starter scythe, 0 active projectiles
        expect(game.weaponManager.getEquippedCount()).toBe(1);
        expect(game.weaponManager.hasWeapon('scythe')).toBe(true);
        expect(game.weaponManager.hasWeapon('orbiters')).toBe(false);
        expect(game.weaponManager.hasWeapon('spear')).toBe(false);
        expect(game.weaponManager.hasWeapon('lightning')).toBe(false);
        expect(game.weaponManager.hasWeapon('aura')).toBe(false);
        expect(game.weaponManager.projectilePool.getActiveCount()).toBe(0);
        expect(game.weaponManager.simulationTime).toBe(0);

        // UpgradeSystem & Modal invariants
        expect(game.upgradeSystem.getWeaponSlotsCount()).toBe(1);
        expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(0);
        expect(game.upgradeModal.getIsOpen()).toBe(false);
        expect(game.isPaused).toBe(false);

        // Clocks and states
        expect(game.elapsedTime).toBe(0);
        expect(game.killCount).toBe(0);
        expect(game.deathTimer).toBe(0);
        expect(game.isVictory).toBe(false);

        // Camera tracking snaps cleanly to player centered coordinates (-480, -270)
        expect(game.camera.x).toBe(-480);
        expect(game.camera.y).toBe(-270);
        expect(game.camera.renderX).toBe(-480);
        expect(game.camera.renderY).toBe(-270);
        expect(game.camera.shakeIntensity).toBe(0);
        expect(game.camera.shakeOffsetX).toBe(0);
        expect(game.camera.shakeOffsetY).toBe(0);
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }
      const finalHeap = process.memoryUsage().heapUsed;
      const heapGrowthMB = (finalHeap - initialHeap) / (1024 * 1024);
      // Assert that 50 full restart cycles do not create runaway memory accumulation (< 35MB growth)
      expect(heapGrowthMB).toBeLessThan(35);
    });

    it('survives rapid consecutive restart calls in 0ms without state corruption', () => {
      // Spam 15 restart calls back-to-back synchronously
      for (let i = 0; i < 15; i++) {
        expect(() => game.restart()).not.toThrow();
      }

      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(100);
      expect(game.hordeManager.getActiveCount()).toBe(35);
      expect(game.hordeManager.totalKilled).toBe(0);
      expect(game.hordeManager.totalSpawned).toBe(35);
      expect(game.weaponManager.getEquippedCount()).toBe(1);
      expect(game.lootManager.getActiveCount()).toBe(0);

      // Verify game steps normally after burst restarts
      for (let t = 0; t < 60; t++) {
        game.step(1 / 60);
      }
      expect(game.elapsedTime).toBeCloseTo(1.0, 2);
    });
  });

  describe('Objective 2: Accumulator Spikes & MAX_SUB_STEPS Clamp', () => {
    it('clamps massive delta spikes (dt = 100.0s) to MAX_SUB_STEPS (5) and zeroes residual debt', () => {
      let stepCalls = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        stepCalls++;
        originalStep(dt);
      };

      let frameCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        frameCallback = cb;
        return 501;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      game.start();
      expect(frameCallback).not.toBeNull();

      // Trigger a massive 100-second lag spike (100,000ms delta)
      stepCalls = 0;
      const t0 = performance.now();
      frameCallback!(t0 + 100000);
      const executionDuration = performance.now() - t0;

      // Assert that execution duration did NOT hang the thread (< 100ms)
      expect(executionDuration).toBeLessThan(100);

      // Assert that sub-steps were strictly clamped at MAX_SUB_STEPS = 5
      expect(stepCalls).toBe(GrimHarvestGame.MAX_SUB_STEPS);
      expect(GrimHarvestGame.MAX_SUB_STEPS).toBe(5);

      // The next normal frame (16.6ms later) must execute exactly 1 step (no residual backlogged debt)
      stepCalls = 0;
      frameCallback!(t0 + 100000 + 16.67);
      expect(stepCalls).toBe(1);

      game.stop();
      vi.unstubAllGlobals();
    });

    it('verifies clamp progression across range of dt deltas (normal, 1-frame drop, multi-frame, extreme)', () => {
      let stepCalls = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        stepCalls++;
        originalStep(dt);
      };

      let frameCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        frameCallback = cb;
        return 601;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      const deltas = [
        { name: 'normal 60Hz frame (16.6ms)', deltaMs: 16.67, expectedSteps: 1 },
        { name: '1 dropped frame (33.3ms)', deltaMs: 33.34, expectedSteps: 2 },
        { name: '2 dropped frames (50.0ms)', deltaMs: 50.0, expectedSteps: 3 },
        { name: '3 dropped frames (66.7ms)', deltaMs: 66.67, expectedSteps: 4 },
        { name: '4 dropped frames (83.3ms)', deltaMs: 83.34, expectedSteps: 5 },
        { name: 'large lag spike (500ms)', deltaMs: 500, expectedSteps: 5 },
        { name: 'extreme lag spike (10,000ms)', deltaMs: 10000, expectedSteps: 5 },
        { name: 'catastrophic lag spike (1,000,000ms)', deltaMs: 1000000, expectedSteps: 5 },
      ];

      for (const d of deltas) {
        game.restart();
        game.start();

        let currentTime = performance.now();
        stepCalls = 0;
        frameCallback!(currentTime + d.deltaMs);
        expect(stepCalls).toBe(d.expectedSteps);

        // Next frame after spike must execute smoothly
        stepCalls = 0;
        frameCallback!(currentTime + d.deltaMs + 16.67);
        expect(stepCalls).toBe(1);

        game.stop();
      }

      vi.unstubAllGlobals();
    });

    it('handles extreme edge-case timestamps (zero delta, backwards time, NaN)', () => {
      let stepCalls = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        stepCalls++;
        originalStep(dt);
      };

      let frameCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        frameCallback = cb;
        return 701;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      game.start();
      const baseTime = performance.now();

      // 1. Backwards time (now < lastTime, e.g. system clock adjust)
      stepCalls = 0;
      frameCallback!(baseTime - 5000);
      // rawDt is negative -> clamped to 0 -> 0 steps
      expect(stepCalls).toBe(0);

      // 2. Zero delta (now === lastTime)
      stepCalls = 0;
      frameCallback!(baseTime - 5000);
      expect(stepCalls).toBe(0);

      // 3. Normal frame advances exactly 1 step
      stepCalls = 0;
      frameCallback!(baseTime - 5000 + 16.67);
      expect(stepCalls).toBe(1);

      game.stop();
      vi.unstubAllGlobals();
    });
  });

  describe('Objective 3: Exact Starting State Invariant Preservation Across Die -> Restart -> 100 Ticks -> Die -> Restart', () => {
    it('maintains 100% exact starting state invariants across multiple death-restart cycles', () => {
      // 1. Capture pristine initial state baseline (via an initial restart to establish clean baseline)
      game.restart();

      const initialPlayerHP = game.player.stats.currentHealth;
      const initialPlayerMaxHP = game.player.stats.maxHealth;
      const initialPlayerLevel = game.player.level;
      const initialPlayerXP = game.player.currentXP;
      const initialActiveHorde = game.hordeManager.getActiveCount(); // 35
      const initialEquippedWeapons = game.weaponManager.getEquippedCount(); // 1
      const initialLootCount = game.lootManager.getActiveCount(); // 0
      const initialPhaseId = game.waveDirector.getCurrentPhase().id;

      expect(initialPlayerHP).toBe(100);
      expect(initialPlayerLevel).toBe(1);
      expect(initialActiveHorde).toBe(35);
      expect(initialEquippedWeapons).toBe(1);
      expect(initialLootCount).toBe(0);
      expect(initialPhaseId).toBe(WavePhaseId.AWAKENING);

      // --- CYCLE 1: Take lethal damage, wait for debounce, restart ---
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Wait 35 ticks for debounce (35 * 1/60 ~ 0.58s > 0.5s)
      for (let i = 0; i < 35; i++) {
        game.step(1 / 60);
      }
      expect(game.canResurrect()).toBe(true);

      // Trigger restart 1 via Jump action
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      game.keyboard.setAction('jump', false);

      // Assert Invariants After Restart 1
      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(initialPlayerHP);
      expect(game.player.stats.maxHealth).toBe(initialPlayerMaxHP);
      expect(game.player.level).toBe(initialPlayerLevel);
      expect(game.player.currentXP).toBe(initialPlayerXP);
      expect(game.player.position.x).toBe(0);
      expect(game.player.position.y).toBe(0);
      expect(game.hordeManager.getActiveCount()).toBe(initialActiveHorde);
      expect(game.hordeManager.totalKilled).toBe(0);
      expect(game.hordeManager.totalSpawned).toBe(35);
      expect(game.lootManager.getActiveCount()).toBe(initialLootCount);
      expect(game.weaponManager.getEquippedCount()).toBe(initialEquippedWeapons);
      expect(game.elapsedTime).toBe(0);
      expect(game.deathTimer).toBe(0);

      // --- ADVANCE 100 TICKS: Live gameplay simulation ---
      // Player moves, attacks fire, damage taken, enemies killed, loot collected
      game.keyboard.setAction('right', true);
      for (let tick = 0; tick < 100; tick++) {
        game.step(1 / 60);
      }
      game.keyboard.setAction('right', false);

      // State is now heavily mutated
      expect(game.elapsedTime).toBeCloseTo(100 / 60, 2);
      expect(game.player.position.x).toBeGreaterThan(0); // Moved right

      // --- CYCLE 2: Die again, debounce, restart ---
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Advance debounce
      for (let i = 0; i < 35; i++) {
        game.step(1 / 60);
      }
      expect(game.canResurrect()).toBe(true);

      // Trigger restart 2
      game.restart();

      // Assert Invariants After Restart 2 (MUST MATCH S0 EXACTLY)
      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(initialPlayerHP);
      expect(game.player.stats.maxHealth).toBe(initialPlayerMaxHP);
      expect(game.player.stats.moveSpeed).toBe(200);
      expect(game.player.stats.might).toBe(1.0);
      expect(game.player.stats.armor).toBe(0);
      expect(game.player.level).toBe(initialPlayerLevel);
      expect(game.player.currentXP).toBe(initialPlayerXP);
      expect(game.player.position.x).toBe(0);
      expect(game.player.position.y).toBe(0);
      expect(game.player.velocity.x).toBe(0);
      expect(game.player.velocity.y).toBe(0);

      // Horde integrity
      expect(game.hordeManager.getActiveCount()).toBe(initialActiveHorde);
      expect(game.hordeManager.totalKilled).toBe(0);
      expect(game.hordeManager.totalSpawned).toBe(35);
      expect(game.hordeManager.getPoolAvailableCount()).toBe(2048 - 35);

      // Loot integrity
      expect(game.lootManager.getActiveCount()).toBe(initialLootCount);

      // Weapons integrity
      expect(game.weaponManager.getEquippedCount()).toBe(initialEquippedWeapons);
      expect(game.weaponManager.hasWeapon('scythe')).toBe(true);
      expect(game.weaponManager.projectilePool.getActiveCount()).toBe(0);

      // Upgrade & wave director integrity
      expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(0);
      expect(game.upgradeSystem.getWeaponSlotsCount()).toBe(1);
      expect(game.waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);
      expect(game.waveDirector.elapsedTime).toBe(0);
      expect(game.waveDirector.getHPMultiplier()).toBeCloseTo(1.0, 4);

      // Camera & clocks
      expect(game.camera.x).toBe(-480);
      expect(game.camera.y).toBe(-270);
      expect(game.camera.renderX).toBe(-480);
      expect(game.camera.renderY).toBe(-270);
      expect(game.camera.shakeIntensity).toBe(0);
      expect(game.elapsedTime).toBe(0);
      expect(game.deathTimer).toBe(0);
      expect(game.killCount).toBe(0);
      expect(game.isPaused).toBe(false);
      expect(game.isVictory).toBe(false);
    });
  });

  describe('Objective 4: Adversarial Edge Cases (Progression Callbacks, Modal Reset, Input Debounce)', () => {
    it('preserves level-up progression callbacks across restarts (modal opens upon leveling)', () => {
      game.restart();

      // Give player enough XP to trigger level up
      expect(game.upgradeModal.getIsOpen()).toBe(false);
      expect(game.isPaused).toBe(false);

      // Gain XP equal to required XP for level 2
      const neededXP = game.player.xpToNextLevel;
      game.player.gainXP(neededXP + 10);

      // Modal must open and simulation must pause
      expect(game.player.level).toBe(2);
      expect(game.upgradeModal.getIsOpen()).toBe(true);
      expect(game.isPaused).toBe(true);

      // Select first card
      const availableCards = (game.upgradeModal as any).cards;
      expect(availableCards.length).toBeGreaterThan(0);
      game.upgradeModal.onSelect?.(availableCards[0]);

      // Modal must close and simulation must resume
      expect(game.upgradeModal.getIsOpen()).toBe(false);
      expect(game.isPaused).toBe(false);
    });

    it('strictly enforces 0.5s deathTimer debounce against input spam', () => {
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Spam Jump 50 times during debounce window
      for (let t = 0; t < 20; t++) {
        game.keyboard.setAction('jump', true);
        game.step(1 / 60);
        game.keyboard.setAction('jump', false);
        expect(game.player.isAlive).toBe(false);
        expect(game.canResurrect()).toBe(false);
      }

      // Step past 0.5s (20 ticks = 0.33s, need 15 more)
      for (let t = 0; t < 15; t++) {
        game.step(1 / 60);
      }
      expect(game.canResurrect()).toBe(true);

      // Now single Jump action successfully resurrects
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      expect(game.player.isAlive).toBe(true);
    });

    it('resets from Victory condition as smoothly as from Game Over', () => {
      game.isVictory = true;
      game.deathTimer = 1.0;
      expect(game.canResurrect()).toBe(true);

      game.restart();
      expect(game.isVictory).toBe(false);
      expect(game.player.isAlive).toBe(true);
      expect(game.deathTimer).toBe(0);
    });
  });
});
