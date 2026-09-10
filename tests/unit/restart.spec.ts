import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { WavePhaseId } from '../../src/core/systems/WaveDirector';
import { LootDropType } from '../../src/core/systems/LootManager';

describe('GrimHarvestGame Restart Lifecycle & State Engine Suite (Milestone 1)', () => {
  let game: GrimHarvestGame;

  beforeEach(() => {
    // Headless instantiation (no DOM container required)
    game = new GrimHarvestGame();
  });

  describe('Suite 1: Clock, Accumulator & Loop Epoch Reset', () => {
    it('resets elapsedTime, killCount, deathTimer, and unpauses simulation', () => {
      // Simulate 45s of active gameplay (heal player each tick to survive swarm)
      for (let i = 0; i < 45 * 60; i++) {
        game.player.heal(100);
        game.step(1 / 60);
      }
      expect(game.elapsedTime).toBeGreaterThan(40);

      game.restart();
      expect(game.elapsedTime).toBe(0);
      expect(game.killCount).toBe(0);
      expect(game.deathTimer).toBe(0);
      expect(game.isPaused).toBe(false);
      expect(game.isVictory).toBe(false);
    });

    it('prevents accumulator freeze and advances 60 ticks cleanly without error', () => {
      game.restart();
      expect(() => {
        for (let i = 0; i < 60; i++) {
          game.step(1 / 60);
        }
      }).not.toThrow();
      expect(game.elapsedTime).toBeCloseTo(1.0, 2);
    });

    it('enforces MAX_SUB_STEPS clamp and discards backlogged accumulator debt', () => {
      expect(GrimHarvestGame.MAX_SUB_STEPS).toBe(5);

      // Verify step execution bound under RAF
      let stepCalls = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        stepCalls++;
        originalStep(dt);
      };

      // Mock requestAnimationFrame to invoke a single frame with a huge 10-second lag spike
      let frameCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        frameCallback = cb;
        return 101;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      game.start();
      expect(frameCallback).not.toBeNull();

      // Trigger frame after 10 seconds of freeze
      stepCalls = 0;
      frameCallback!(performance.now() + 10000);

      // Substeps must be capped at MAX_SUB_STEPS (5), preventing infinite loop
      expect(stepCalls).toBe(GrimHarvestGame.MAX_SUB_STEPS);

      game.stop();
      vi.unstubAllGlobals();
    });

    it('increments loopEpoch and invalidates prior loop callbacks', () => {
      let callbackCount = 0;
      let frameCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        frameCallback = cb;
        return 202;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      game.start();
      const staleCallback = frameCallback!;

      // Calling stop increments loopEpoch
      game.stop();

      // Invoking stale callback from earlier epoch must be a no-op
      callbackCount = 0;
      const originalRender = game.render.bind(game);
      game.render = () => {
        callbackCount++;
        originalRender();
      };

      staleCallback(performance.now() + 16);
      expect(callbackCount).toBe(0);

      vi.unstubAllGlobals();
    });
  });

  describe('Suite 2: Player Entity State Restoration', () => {
    it('resurrects deceased player with 100 HP at origin (0, 0)', () => {
      game.player.position.x = 450;
      game.player.position.y = -300;
      game.player.velocity.x = 180;
      game.player.velocity.y = -120;
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);
      expect(game.player.stats.currentHealth).toBe(0);

      game.restart();
      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(100);
      expect(game.player.stats.maxHealth).toBe(100);
      expect(game.player.position.x).toBe(0);
      expect(game.player.position.y).toBe(0);
      expect(game.player.velocity.x).toBe(0);
      expect(game.player.velocity.y).toBe(0);
      expect(game.player.invulnerabilityTimer).toBe(0);
    });

    it('resets mutated stats back to initial baseline', () => {
      game.player.applyStatDelta('might', 1.5);
      game.player.applyStatDelta('armor', 10);
      game.player.applyStatDelta('moveSpeed', 150);
      game.player.applyStatDelta('cooldownReduction', 0.4);
      expect(game.player.stats.might).toBe(2.5);
      expect(game.player.stats.armor).toBe(10);

      game.restart();
      expect(game.player.stats.might).toBe(1.0);
      expect(game.player.stats.armor).toBe(0);
      expect(game.player.stats.moveSpeed).toBe(200);
      expect(game.player.stats.cooldownReduction).toBe(0.0);
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
      expect(game.weaponManager.hasWeapon('lightning')).toBe(false);
    });

    it('clears active projectiles and resets simulation timer and buffers', () => {
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
      expect(game.upgradeModal.getIsOpen()).toBe(true);

      game.restart();
      expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(0);
      expect(game.upgradeSystem.getWeaponSlotsCount()).toBe(1);
      expect(game.upgradeSystem.hasWeapon('weapon_scythe')).toBe(true);
      expect(game.upgradeModal.getIsOpen()).toBe(false);
      expect(game.isPaused).toBe(false);
    });

    it('UpgradeModal.reset() clears cards, bounds, and hovered selection', () => {
      game.upgradeModal.open([
        {
          id: 'card_1',
          itemId: 'weapon_scythe',
          name: 'Arcane Scythe',
          category: 'weapon',
          type: 1 as any,
          subtitle: 'Rank 2',
          previousRank: 1,
          newRank: 2,
          maxRank: 5,
          description: 'Wider arc',
          statChangeDescription: '+20% Damage',
          icon: 'scythe',
          isEvolution: false,
        },
      ], 2);

      expect(game.upgradeModal.getIsOpen()).toBe(true);
      game.upgradeModal.hoveredIndex = 0;
      game.upgradeModal.selectedIndex = 0;

      game.upgradeModal.reset();
      expect(game.upgradeModal.getIsOpen()).toBe(false);
      expect(game.upgradeModal.hoveredIndex).toBeNull();
    });
  });

  describe('Suite 5: WaveDirector & Swarm Reset', () => {
    it('resets timeline to Phase 1 (Awakening), resets multipliers, and re-spawns initial swarm', () => {
      // Fast forward wave director to Nightfall (>60s)
      game.waveDirector.update(75, 0, 0, 0, 0);
      expect(game.waveDirector.getCurrentPhase().id).toBe(WavePhaseId.NIGHTFALL);
      expect(game.waveDirector.getHPMultiplier()).toBeGreaterThan(1.2);

      // Kill 10 enemies
      const enemies = game.hordeManager.getActiveEnemies();
      for (let i = 0; i < 10 && i < enemies.length; i++) {
        game.hordeManager.despawn(enemies[i].id);
      }
      expect(game.hordeManager.totalKilled).toBeGreaterThan(0);

      game.restart();
      expect(game.waveDirector.elapsedTime).toBe(0);
      expect(game.waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);
      expect(game.waveDirector.getHPMultiplier()).toBeCloseTo(1.0, 4);

      // Initial swarm: 25 skeletons + 10 ghouls = 35 enemies
      expect(game.hordeManager.getActiveCount()).toBe(35);
      expect(game.hordeManager.totalKilled).toBe(0);
      expect(game.hordeManager.totalSpawned).toBe(35);
    });

    it('HordeManager.reset() guarantees 2,048 available pooled slots without memory leaks', () => {
      game.hordeManager.reset();
      expect(game.hordeManager.getActiveCount()).toBe(0);
      expect(game.hordeManager.getPoolAvailableCount()).toBe(2048);
      expect(game.hordeManager.totalKilled).toBe(0);
      expect(game.hordeManager.totalSpawned).toBe(0);
    });
  });

  describe('Suite 6: LootManager & Drop Pool Purge', () => {
    it('clears all lingering soul shards and pickups and restores pristine pool', () => {
      game.lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 50, 50);
      game.lootManager.spawnDrop(LootDropType.RUBY_GEM, 100, 100);
      expect(game.lootManager.getActiveCount()).toBe(2);

      game.restart();
      expect(game.lootManager.getActiveCount()).toBe(0);

      // Verify fresh drop gets gem_1 ID
      const newDrop = game.lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 0, 0, false);
      expect(newDrop).not.toBeNull();
      expect(newDrop?.id).toBe('gem_1');
      expect(newDrop?.isAttracted).toBe(false);
      expect(newDrop?.currentSpeed).toBe(0);
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

  describe('Suite 8: Resurrection Trigger via Jump/Space & Debounce', () => {
    it('rejects resurrection while player is alive', () => {
      expect(game.player.isAlive).toBe(true);
      expect(game.canResurrect()).toBe(false);

      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      expect(game.player.isAlive).toBe(true);
    });

    it('rejects resurrection when player is dead but deathTimer < 0.5 (debounce buffer)', () => {
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Simulate 1 tick (deathTimer = 1/60 ~ 0.0167s < 0.5s)
      game.step(1 / 60);
      expect(game.deathTimer).toBeLessThan(0.5);
      expect(game.canResurrect()).toBe(false);

      // Jump action must NOT trigger restart yet
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      expect(game.player.isAlive).toBe(false);
    });

    it('triggers resurrection when player is dead and deathTimer >= 0.5', () => {
      game.player.takeDamage(9999);
      expect(game.player.isAlive).toBe(false);

      // Advance death timer past 0.5s (35 ticks * 1/60 = 0.583s)
      for (let i = 0; i < 35; i++) {
        game.step(1 / 60);
      }
      expect(game.deathTimer).toBeGreaterThanOrEqual(0.5);
      expect(game.canResurrect()).toBe(true);

      // Simulate Jump input
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);

      // Verify resurrected state
      expect(game.player.isAlive).toBe(true);
      expect(game.player.stats.currentHealth).toBe(100);
      expect(game.elapsedTime).toBe(0);
      expect(game.deathTimer).toBe(0);
    });

    it('rejects resurrection if upgrade modal is currently open', () => {
      game.player.takeDamage(9999);
      game.deathTimer = 1.0;
      game.upgradeModal.open([], 1);

      expect(game.upgradeModal.getIsOpen()).toBe(true);
      expect(game.canResurrect()).toBe(false);

      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      expect(game.player.isAlive).toBe(false);
    });

    it('supports DOM canvas click and window keydown resurrection triggers', () => {
      const listeners: Record<string, Function[]> = {};
      const mockCanvas: any = {
        addEventListener: (type: string, fn: Function) => {
          listeners[type] = listeners[type] || [];
          listeners[type].push(fn);
        },
        removeEventListener: vi.fn(),
        getContext: () => ({}),
      };
      const mockContainer: any = {
        querySelector: () => mockCanvas,
        appendChild: vi.fn(),
      };

      const mockWindowListeners: Record<string, Function[]> = {};
      vi.stubGlobal('window', {
        addEventListener: (type: string, fn: Function) => {
          mockWindowListeners[type] = mockWindowListeners[type] || [];
          mockWindowListeners[type].push(fn);
        },
        removeEventListener: vi.fn(),
      });
      vi.stubGlobal('document', {
        createElement: () => ({
          id: '',
          style: {},
          appendChild: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          getContext: () => ({}),
        }),
      });

      const mountedGame = new GrimHarvestGame();
      mountedGame.mount(mockContainer);

      mountedGame.player.takeDamage(9999);
      mountedGame.deathTimer = 1.0;
      expect(mountedGame.canResurrect()).toBe(true);

      // Simulate Spacebar keydown on window
      const spaceEvent = { code: 'Space', key: ' ', preventDefault: vi.fn() } as any;
      mockWindowListeners['keydown']?.forEach((fn) => fn(spaceEvent));

      expect(mountedGame.player.isAlive).toBe(true);
      expect(mountedGame.player.stats.currentHealth).toBe(100);

      // Kill again and test canvas click
      mountedGame.player.takeDamage(9999);
      mountedGame.deathTimer = 1.0;
      expect(mountedGame.canResurrect()).toBe(true);

      const clickEvent = { preventDefault: vi.fn() } as any;
      listeners['click']?.forEach((fn) => fn(clickEvent));

      expect(mountedGame.player.isAlive).toBe(true);
      expect(mountedGame.player.stats.currentHealth).toBe(100);

      mountedGame.destroy();
      vi.unstubAllGlobals();
    });
  });
});
