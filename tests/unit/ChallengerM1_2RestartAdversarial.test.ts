import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { LootDropType } from '../../src/core/systems/LootManager';
import { ProjectilePool } from '../../src/core/weapons/Projectile';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';

describe('Empirical Challenger M1-2: Adversarial Restart & Invariant Stress Suite', () => {
  let game: GrimHarvestGame;

  beforeEach(() => {
    game = new GrimHarvestGame();
  });

  describe('Adversarial Check 1: HordeManager Exact Invariants Across 1,000-Enemy Spawns & Restarts', () => {
    it('empirically verifies: 1000 spawns + kills -> restart -> activeCount=35, poolAvailable=2013, totalSpawned=35, totalKilled=0', () => {
      // 1. Initial swarm is deployed in constructor: 25 skeletons + 10 ghouls = 35 enemies
      expect(game.hordeManager.getActiveCount()).toBe(35);
      expect(game.hordeManager.getPoolAvailableCount()).toBe(2048 - 35); // 2013
      expect(game.hordeManager.totalSpawned).toBe(35);
      expect(game.hordeManager.totalKilled).toBe(0);

      // 2. Adversarial mass spawn: 1,000 additional enemies
      const spawnedSkeletons = game.hordeManager.spawnWave('SKELETON', 600, { x: 300, y: 300 }, 500);
      const spawnedGhouls = game.hordeManager.spawnWave('GHOUL', 400, { x: -300, y: -300 }, 600);
      expect(spawnedSkeletons.length).toBe(600);
      expect(spawnedGhouls.length).toBe(400);

      // Total active must now be 1,035
      expect(game.hordeManager.getActiveCount()).toBe(1035);
      expect(game.hordeManager.getPoolAvailableCount()).toBe(2048 - 1035); // 1013
      expect(game.hordeManager.totalSpawned).toBe(1035);

      // 3. Simulate active gameplay with kills: kill 400 enemies
      const activeEnemies = game.hordeManager.getActiveEnemies();
      for (let i = 0; i < 400; i++) {
        game.hordeManager.despawn(activeEnemies[i].id);
      }
      expect(game.hordeManager.getActiveCount()).toBe(635);
      expect(game.hordeManager.totalKilled).toBe(400);

      // Advance simulation 30 ticks
      for (let i = 0; i < 30; i++) {
        game.player.heal(100);
        game.step(1 / 60);
      }

      // 4. TRIGGER RESTART
      game.restart();

      // STRICT EMPIRICAL INVARIANTS:
      // Active count must be EXACTLY 35 (initial swarm re-spawned)
      expect(game.hordeManager.getActiveCount()).toBe(35);
      // Available pool slots must be EXACTLY 2,013 (2,048 - 35)
      expect(game.hordeManager.getPoolAvailableCount()).toBe(2013);
      // Total spawned must be reset and equal EXACTLY 35
      expect(game.hordeManager.totalSpawned).toBe(35);
      // Total killed must be reset and equal EXACTLY 0 (NOT inflated by clear or despawn)
      expect(game.hordeManager.totalKilled).toBe(0);
    });

    it('empirically verifies 25 consecutive restart stress cycles without any counter drift or pool leakage', () => {
      for (let cycle = 1; cycle <= 25; cycle++) {
        // Spawn varied batches up to pool limits
        const spawnCount = 100 + (cycle * 37) % 800;
        game.hordeManager.spawnWave('SKELETON', spawnCount, { x: cycle * 10, y: -cycle * 10 }, 400);

        // Despawn random subset
        const actives = game.hordeManager.getActiveEnemies();
        const killCount = Math.floor(actives.length * 0.4);
        for (let k = 0; k < killCount; k++) {
          game.hordeManager.despawn(actives[k].id);
        }

        // Restart
        game.restart();

        expect(game.hordeManager.getActiveCount()).toBe(35);
        expect(game.hordeManager.getPoolAvailableCount()).toBe(2013);
        expect(game.hordeManager.totalSpawned).toBe(35);
        expect(game.hordeManager.totalKilled).toBe(0);
      }
    });
  });

  describe('Adversarial Check 2: SpatialHashGrid Zero Ghost Entities & Phantom Collision Hits', () => {
    it('empirically asserts ZERO ghost entities across the entire grid after restart', () => {
      // 1. Pre-populate spatial hash grid with 1,000 enemies scattered across extreme bounds
      for (let i = 0; i < 1000; i++) {
        const angle = (i / 1000) * Math.PI * 2;
        const dist = 300 + (i % 1500);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        game.hordeManager.spawn('SKELETON', x, y);
      }

      // Rebuild grid and step
      game.step(1 / 60);

      // 2. Restart game
      game.restart();

      // 3. Grid Inspection: Check internal cell heads and intrusive linked list
      const grid = game.hordeManager.spatialGrid;
      const cellHeads: Int32Array = (grid as any).cellHeads;
      const entityNext: Int32Array = (grid as any).entityNext;

      let totalGridEntities = 0;
      const visitedEntities = new Set<number>();

      for (let c = 0; c < cellHeads.length; c++) {
        let curr = cellHeads[c];
        while (curr !== -1) {
          totalGridEntities++;
          expect(visitedEntities.has(curr), `Duplicate entity registration ${curr}`).toBe(false);
          visitedEntities.add(curr);

          // Entity in grid MUST be an active living enemy
          const enemy = game.hordeManager.pool[curr];
          expect(enemy.active, `Ghost entity ${curr} in grid is active`).toBe(true);
          expect(enemy.isAlive, `Ghost entity ${curr} in grid isAlive`).toBe(true);

          curr = entityNext[curr];
        }
      }

      // Exact count of entities in the entire spatial grid must be EXACTLY 35
      expect(totalGridEntities).toBe(35);
      expect(visitedEntities.size).toBe(35);

      // 4. Adversarial Phantom Hit Scan:
      // Query 500 coordinates across the map where no initial enemies were spawned
      const scratch = new Int32Array(2048);
      // The initial swarm is spawned at radius 450 (25 skeletons) and 600 (10 ghouls) around (0, 0).
      // A query at (0, 0) with radius 100 must find ZERO enemies (no phantom hits).
      const centerHits = grid.queryRadius(0, 0, 100, scratch);
      expect(centerHits).toBe(0);

      // A query at distant coordinates (1500, 1500) where pre-restart enemies were located must return 0
      const distantHits = grid.queryRadius(1500, 1500, 300, scratch);
      expect(distantHits).toBe(0);

      const farNegativeHits = grid.queryRadius(-1800, -1800, 400, scratch);
      expect(farNegativeHits).toBe(0);

      // 5. Query the entire bounding box of the world (-2500 to 2500)
      const allFound = grid.queryRadius(0, 0, 3500, scratch);
      expect(allFound).toBe(35);

      // Every returned ID must strictly correspond to an active enemy
      for (let i = 0; i < allFound; i++) {
        const id = scratch[i];
        expect(game.hordeManager.pool[id].active).toBe(true);
      }
    });

    it('empirically verifies zero ghost entities after stepping simulation post-restart', () => {
      // Spawn enemies, kill them, restart
      game.hordeManager.spawnWave('SKELETON', 500, { x: 500, y: 500 }, 300);
      game.restart();

      // Step simulation for 60 frames
      for (let f = 0; f < 60; f++) {
        game.player.heal(100);
        game.step(1 / 60);

        const scratch = new Int32Array(2048);
        const count = game.hordeManager.spatialGrid.queryRadius(0, 0, 3500, scratch);

        // Every entity returned across every frame must be strictly active
        for (let i = 0; i < count; i++) {
          const id = scratch[i];
          const enemy = game.hordeManager.pool[id];
          expect(enemy.active).toBe(true);
          expect(enemy.isAlive).toBe(true);
        }
      }
    });
  });

  describe('Adversarial Check 3: LootManager Pooled Items 1,500 & Active Gems 0', () => {
    it('empirically verifies: LootManager pooled items count is 1,500, active gems is 0, and all items are sanitized', () => {
      // 1. Spawn hundreds of diverse drops with velocities and attraction
      for (let i = 0; i < 400; i++) {
        const types = [
          LootDropType.EMERALD_SHARD,
          LootDropType.RUBY_GEM,
          LootDropType.VIOLET_ABYSSAL,
          LootDropType.SOUL_CHEST,
          LootDropType.HEALTH_VIAL,
          LootDropType.ELDRITCH_MAGNET,
        ];
        const drop = game.lootManager.spawnDrop(types[i % types.length], i * 2, i * -2, true);
        if (drop) {
          drop.isAttracted = true;
          drop.currentSpeed = 500;
          drop.velocity.x = 200;
          drop.velocity.y = -200;
        }
      }
      expect(game.lootManager.getActiveCount()).toBe(400);

      // Collect some drops
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.stats.magnetRadius = 50;
      game.lootManager.update(1 / 60, game.player);

      // 2. Trigger restart
      game.restart();

      // 3. EMPIRICAL ASSERTIONS
      // Active gems count must be exactly 0
      expect(game.lootManager.getActiveCount()).toBe(0);
      expect(game.lootManager.getActiveItems().length).toBe(0);

      // Pooled items count must be exactly 1,500
      const pool: any[] = (game.lootManager as any).pool;
      expect(pool.length).toBe(1500);

      // Every pooled item must be completely sanitized back to factory state
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        expect(item.isAlive, `Item ${i} isAlive`).toBe(false);
        expect(item.isAttracted, `Item ${i} isAttracted`).toBe(false);
        expect(item.currentSpeed, `Item ${i} currentSpeed`).toBe(0);
        expect(item.velocity.x, `Item ${i} velocity.x`).toBe(0);
        expect(item.velocity.y, `Item ${i} velocity.y`).toBe(0);
        expect(item.position.x, `Item ${i} position.x`).toBe(0);
        expect(item.position.y, `Item ${i} position.y`).toBe(0);
      }

      // Stepping LootManager after restart must gain 0 XP and collect 0 items
      const preXP = game.player.currentXP;
      game.lootManager.update(1.0, game.player);
      expect(game.player.currentXP).toBe(preXP);
      expect(game.lootManager.getActiveCount()).toBe(0);
    });
  });

  describe('Adversarial Check 4: WeaponManager Active Projectiles 0 & Rank 1 Arcane Scythe', () => {
    it('empirically verifies: Active projectiles is 0, only Rank 1 Arcane Scythe is equipped', () => {
      // 1. Equip all 5 weapons and upgrade them to maximum ranks
      game.weaponManager.addWeapon('orbiters', 5);
      game.weaponManager.addWeapon('spear', 5);
      game.weaponManager.addWeapon('lightning', 5);
      game.weaponManager.addWeapon('aura', 5);

      // Upgrade scythe to rank 5
      const scythe = game.weaponManager.getWeapon('scythe') as ArcaneScythe;
      scythe.rank = 5;
      scythe.isEvolution = true;

      expect(game.weaponManager.getEquippedCount()).toBe(5);

      // Fire weapons to generate active in-flight projectiles / slashes
      const spear = game.weaponManager.getWeapon('spear') as BoneSpear;
      if (spear?.fireProjectile) {
        for (let i = 0; i < 20; i++) {
          spear.fireProjectile(Math.cos(i), Math.sin(i));
        }
      }

      // Also spawn projectiles directly into WeaponManager's central projectilePool and initialize them
      const p1 = game.weaponManager.projectilePool.spawn();
      p1?.reset('spear', 0, 0, 100, 0, 100, 8, 20, 100, 2);
      const p2 = game.weaponManager.projectilePool.spawn();
      p2?.reset('spear', 0, 0, -100, 0, 100, 8, 20, 100, 2);

      // Update weapons to generate slashes, bolts, skulls
      game.weaponManager.update(
        1.0,
        game.player,
        game.hordeManager,
        game.lootManager,
        game.vfx,
        game.camera
      );

      // Verify weapons have active projectiles / state
      expect(game.weaponManager.projectilePool.getActiveCount()).toBeGreaterThan(0);
      expect(spear.projectilePool.getActiveCount()).toBeGreaterThan(0);
      expect(game.weaponManager.simulationTime).toBeGreaterThan(0);

      // 2. Trigger restart
      game.restart();

      // 3. EMPIRICAL ASSERTIONS
      // Active projectiles pool count must be EXACTLY 0
      expect(game.weaponManager.projectilePool.getActiveCount()).toBe(0);

      // Equipped weapons count must be EXACTLY 1
      expect(game.weaponManager.getEquippedCount()).toBe(1);

      // The only equipped weapon must be Rank 1 Arcane Scythe
      expect(game.weaponManager.hasWeapon('scythe')).toBe(true);
      const resetScythe = game.weaponManager.getWeapon('scythe')!;
      expect(resetScythe.id).toBe('scythe');
      expect(resetScythe.rank).toBe(1);
      expect(resetScythe.isEvolution).toBe(false);

      // All other weapons must NOT be equipped
      expect(game.weaponManager.hasWeapon('orbiters')).toBe(false);
      expect(game.weaponManager.hasWeapon('spear')).toBe(false);
      expect(game.weaponManager.hasWeapon('lightning')).toBe(false);
      expect(game.weaponManager.hasWeapon('aura')).toBe(false);

      // Weapon sub-pools must be empty
      expect((resetScythe as ArcaneScythe).activeSlashes.length).toBe(0);
      expect(game.weaponManager.simulationTime).toBe(0);

      // UpgradeSystem weapons inventory must match WeaponManager exactly
      expect(game.upgradeSystem.getWeaponSlotsCount()).toBe(1);
      expect(game.upgradeSystem.hasWeapon('weapon_scythe')).toBe(true);
      expect(game.upgradeSystem.getWeaponRank('weapon_scythe')).toBe(1);
      expect(game.upgradeSystem.getPassiveSlotsCount()).toBe(0);
    });

    it('empirically demonstrates infinite loop vulnerability in ProjectilePool.clear() when an entity is spawned without active=true', () => {
      const pool = new ProjectilePool(16);
      const p = pool.spawn();
      expect(p).not.toBeNull();
      // Observation: spawn() increments activeCount and registers index in activeIndices,
      // but leaves p.active === false!
      expect(p!.active).toBe(false);
      expect(pool.getActiveCount()).toBe(1);

      // In ProjectilePool.clear():
      // while (this.activeCount > 0) { this.free(this.activeIndices[this.activeCount - 1]); }
      // In ProjectilePool.free(idx):
      // if (!p.active) return;
      // Because p.active is false, free() returns early WITHOUT decrementing activeCount.
      // Running pool.clear() here would hang the node process forever at 100% CPU.
      // We simulate the clear() while-loop with an iteration guard:
      let iterations = 0;
      const maxIterations = 10;
      while (pool.getActiveCount() > 0 && iterations < maxIterations) {
        pool.free((pool as any).activeIndices[pool.getActiveCount() - 1]);
        iterations++;
      }

      // Proof of bug: activeCount is NEVER decremented, loop would run indefinitely!
      expect(iterations).toBe(maxIterations);
      expect(pool.getActiveCount()).toBe(1);
    });
  });

  describe('Adversarial Check 5: Accumulator & Infinite Loop Clamping Guard', () => {
    it('empirically prevents infinite while-loop hangs during 1-hour lag spikes', () => {
      let stepCount = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        stepCount++;
        originalStep(dt);
      };

      let rafCallback: ((now: number) => void) | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
        rafCallback = cb;
        return 999;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      game.start();
      expect(rafCallback).not.toBeNull();

      // Simulate a 1-hour (3600s) freeze spike (e.g. laptop closed for lunch)
      const hugeLagTime = performance.now() + 3600 * 1000;
      stepCount = 0;
      rafCallback!(hugeLagTime);

      // Sub-steps MUST be strictly capped at MAX_SUB_STEPS (5) and accumulator reset to 0
      expect(stepCount).toBe(GrimHarvestGame.MAX_SUB_STEPS);
      expect((game as any).accumulator).toBe(0);

      game.stop();
      vi.unstubAllGlobals();
    });
  });
});
