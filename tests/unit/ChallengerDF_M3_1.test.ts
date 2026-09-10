import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { Weapon } from '../../src/core/weapons/Weapon';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { CursedAura } from '../../src/core/weapons/CursedAura';
import { ProjectilePool, Projectile } from '../../src/core/weapons/Projectile';

describe('Empirical Challenge Suite M3-1: Occult Arsenal & Projectile Simulation', () => {
  let hordeManager: HordeManager;
  let player: Player;
  let statsManager: PlayerStatsManager;

  beforeEach(() => {
    hordeManager = new HordeManager({ maxCapacity: 2048 });
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
  });

  // =========================================================================
  // Challenge 1: Cooldown Scaling & Strict 50% Max Clamp
  // =========================================================================
  describe('Challenge 1: Weapon Cooldowns & Strict 50% CDR Clamp', () => {
    it('empirically verifies getEffectiveCooldown clamps at 50% reduction for all 5 weapons', () => {
      const weapons: Weapon[] = [
        new ArcaneScythe(player, hordeManager, statsManager),
        new SoulOrbiters(player, hordeManager, statsManager),
        new AbyssalLightning(player, hordeManager, statsManager),
        new BoneSpear(player, hordeManager, statsManager),
        new CursedAura(player, hordeManager, statsManager),
      ];

      // Test a matrix of CDR values: [-0.2, 0.0, 0.20, 0.40, 0.50, 0.60, 0.75, 1.0, 2.5]
      const cdrTestMatrix = [
        { cdr: -0.20, expectedMultiplier: 1.00 }, // No negative CDR boost
        { cdr: 0.00,  expectedMultiplier: 1.00 }, // 0% reduction
        { cdr: 0.20,  expectedMultiplier: 0.80 }, // 20% reduction
        { cdr: 0.40,  expectedMultiplier: 0.60 }, // 40% reduction
        { cdr: 0.50,  expectedMultiplier: 0.50 }, // 50% reduction (cap ceiling)
        { cdr: 0.60,  expectedMultiplier: 0.50 }, // Clamped at 50%!
        { cdr: 0.75,  expectedMultiplier: 0.50 }, // Clamped at 50% (not 25%!)
        { cdr: 1.00,  expectedMultiplier: 0.50 }, // Clamped at 50% (not 0%!)
        { cdr: 2.50,  expectedMultiplier: 0.50 }, // Extreme clamping
      ];

      for (const w of weapons) {
        const baseCD = w.getCooldown();
        for (const testCase of cdrTestMatrix) {
          statsManager.setBaseStat('cooldownReduction', testCase.cdr);
          const effectiveCD = w.getEffectiveCooldown();
          const expectedCD = baseCD * testCase.expectedMultiplier;
          expect(effectiveCD).toBeCloseTo(expectedCD, 4);
        }
      }
    });

    it('empirically verifies firing cadence over simulated time respects effective cooldown', () => {
      // Test ArcaneScythe (base CD = 1.4s)
      statsManager.setBaseStat('cooldownReduction', 0.75); // Should clamp to 50% => 0.7s
      const scythe = new ArcaneScythe(player, hordeManager, statsManager);
      expect(scythe.getEffectiveCooldown()).toBeCloseTo(0.70, 4);

      let fireCount = 0;
      const originalFire = scythe.fire.bind(scythe);
      scythe.fire = (...args) => {
        fireCount++;
        return originalFire(...args);
      };

      // Run 7.0 seconds of simulation in 60Hz ticks (420 ticks)
      const dt = 1 / 60;
      for (let t = 0; t < 420; t++) {
        scythe.update(dt);
      }

      // Over 7.0s with 0.7s cooldown, exactly 10 fires should occur
      expect(fireCount).toBe(10);
    });

    it('empirically verifies Abyssal Lightning fires at clamped rate under excessive CDR', () => {
      statsManager.setBaseStat('cooldownReduction', 0.99); // Clamped to 50% => 2.0s / 2 = 1.0s
      const lightning = new AbyssalLightning(player, hordeManager, statsManager);
      expect(lightning.getEffectiveCooldown()).toBeCloseTo(1.0, 4);

      let strikeCount = 0;
      const originalTrigger = lightning.triggerStrike.bind(lightning);
      lightning.triggerStrike = (...args) => {
        strikeCount++;
        return originalTrigger(...args);
      };

      // Run 10.0 seconds of simulation
      const dt = 1 / 60;
      for (let t = 0; t < 600; t++) {
        lightning.update(dt);
      }

      // Exactly 10 strikes over 10 seconds at 1.0s cooldown
      expect(strikeCount).toBe(10);
    });

    it('empirically verifies Cursed Aura pulses at clamped rate under excessive CDR', () => {
      statsManager.setBaseStat('cooldownReduction', 0.85); // Clamped to 50% => 1.2s / 2 = 0.6s
      const aura = new CursedAura(player, hordeManager, statsManager);
      expect(aura.getEffectiveCooldown()).toBeCloseTo(0.60, 4);

      let pulseCount = 0;
      const originalPulse = aura.pulse.bind(aura);
      aura.pulse = (...args) => {
        pulseCount++;
        return originalPulse(...args);
      };

      // Run 6.0 seconds of simulation (360 ticks)
      const dt = 1 / 60;
      for (let t = 0; t < 360; t++) {
        aura.update(dt);
      }

      // Exactly 10 pulses over 6.0s at 0.6s cooldown
      expect(pulseCount).toBe(10);
    });
  });

  // =========================================================================
  // Challenge 2: Damage Calculation Formula Math.round(baseDamage * might)
  // =========================================================================
  describe('Challenge 2: Damage Calculation Accuracy Math.round(baseDamage * might)', () => {
    it('empirically verifies damage matches Math.round(baseDamage * might) across varied might values', () => {
      const weapons: Weapon[] = [
        new ArcaneScythe(player, hordeManager, statsManager),
        new SoulOrbiters(player, hordeManager, statsManager),
        new AbyssalLightning(player, hordeManager, statsManager),
        new BoneSpear(player, hordeManager, statsManager),
        new CursedAura(player, hordeManager, statsManager),
      ];

      const mightValues = [0.25, 0.5, 0.77, 1.0, 1.15, 1.333, 1.5, 1.875, 2.0, 2.5, 3.1415, 5.0];

      for (const w of weapons) {
        const baseDmg = w.getDamage();
        for (const might of mightValues) {
          statsManager.setBaseStat('might', might);
          const effectiveDamage = w.getEffectiveDamage();
          const expectedDamage = Math.round(baseDmg * might);

          expect(effectiveDamage).toBe(expectedDamage);
          expect(Number.isInteger(effectiveDamage)).toBe(true);
        }
      }
    });

    it('empirically verifies damage calculation across all 5 ranks for each weapon', () => {
      const weapons: Weapon[] = [
        new ArcaneScythe(player, hordeManager, statsManager),
        new SoulOrbiters(player, hordeManager, statsManager),
        new AbyssalLightning(player, hordeManager, statsManager),
        new BoneSpear(player, hordeManager, statsManager),
        new CursedAura(player, hordeManager, statsManager),
      ];

      statsManager.setBaseStat('might', 1.45);

      for (const w of weapons) {
        for (let rank = 1; rank <= 5; rank++) {
          w.rank = rank;
          const rankDmg = w.getDamage(rank);
          const effectiveDamage = w.getEffectiveDamage();
          expect(effectiveDamage).toBe(Math.round(rankDmg * 1.45));
        }
      }
    });

    it('empirically verifies evolution weapon damage matches Math.round(evolvedDamage * might)', () => {
      const spear = new BoneSpear(player, hordeManager, statsManager);
      spear.isEvolution = true; // Ossuary Cataclysm (base evolved damage = 130)
      statsManager.setBaseStat('might', 1.75);

      expect(spear.getEffectiveDamage()).toBe(Math.round(130 * 1.75)); // Math.round(227.5) = 228
    });
  });

  // =========================================================================
  // Challenge 3: ProjectilePool Invariants, Active Conservation, Zero-Garbage
  // =========================================================================
  describe('Challenge 3: ProjectilePool Invariants & High-Throughput Stress', () => {
    it('empirically verifies active + available count strictly equals capacity', () => {
      const pool = new ProjectilePool(256);
      expect(pool.getCapacity()).toBe(256);
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(256);

      const spawned: Projectile[] = [];

      // Spawn all 256
      for (let i = 0; i < 256; i++) {
        const p = pool.spawn();
        expect(p).not.toBeNull();
        p!.reset('spear', 0, 0, 1, 0, 100, 10, 20, 100, 2);
        spawned.push(p!);

        expect(pool.getActiveCount()).toBe(i + 1);
        expect(pool.getAvailableCount()).toBe(256 - (i + 1));
        expect(pool.getActiveCount() + pool.getAvailableCount()).toBe(256);
      }

      // 257th spawn must return null (capacity exhausted)
      expect(pool.spawn()).toBeNull();

      // Free all 256 in reverse order (LIFO)
      for (let i = 255; i >= 0; i--) {
        pool.recycleProjectile(spawned[i]);
        expect(pool.getActiveCount()).toBe(i);
        expect(pool.getAvailableCount()).toBe(256 - i);
        expect(pool.getActiveCount() + pool.getAvailableCount()).toBe(256);
      }

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(256);
    });

    it('empirically verifies FIFO free order preserves pool integrity without corrupting indices', () => {
      const pool = new ProjectilePool(64);
      const spawned: Projectile[] = [];

      for (let i = 0; i < 64; i++) {
        const p = pool.spawn()!;
        p.reset('spear', 0, 0, 1, 0, 100, 10, 20, 100, 2);
        spawned.push(p);
      }

      // Free in FIFO order (0, 1, 2, ..., 63)
      for (let i = 0; i < 64; i++) {
        pool.recycleProjectile(spawned[i]);
        expect(pool.getActiveCount() + pool.getAvailableCount()).toBe(64);
      }

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(64);

      // Verify re-spawn works cleanly for all 64 slots
      for (let i = 0; i < 64; i++) {
        const p = pool.spawn();
        expect(p).not.toBeNull();
        p!.reset('spear', 0, 0, 1, 0, 100, 10, 20, 100, 2);
      }
      expect(pool.getActiveCount()).toBe(64);
    });

    it('empirically verifies random churn of 50,000 spawn/free cycles maintains 100% identity preservation', () => {
      const pool = new ProjectilePool(256);
      const originalInstances = [...pool.pool];

      const activeSet = new Set<Projectile>();

      for (let op = 0; op < 50000; op++) {
        const shouldSpawn = activeSet.size === 0 || (activeSet.size < 256 && Math.random() < 0.55);

        if (shouldSpawn) {
          const p = pool.spawn();
          if (p) {
            p.reset('spear', 0, 0, 1, 0, 100, 10, 20, 100, 2);
            activeSet.add(p);
          }
        } else {
          // Pick an active projectile to free
          const arr = Array.from(activeSet);
          const pick = arr[Math.floor(Math.random() * arr.length)];
          pool.recycleProjectile(pick);
          activeSet.delete(pick);
        }

        expect(pool.getActiveCount()).toBe(activeSet.size);
        expect(pool.getActiveCount() + pool.getAvailableCount()).toBe(256);
      }

      // Clean up remaining active projectiles
      for (const p of activeSet) {
        pool.recycleProjectile(p);
      }

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(256);

      // Verify zero new Projectile objects were instantiated
      for (let i = 0; i < 256; i++) {
        expect(pool.pool[i]).toBe(originalInstances[i]);
        expect(pool.pool[i].id).toBe(i);
      }
    });

    it('stress-tests BoneSpear projectile simulation across 1,000 ticks with high active throughput', () => {
      const spear = new BoneSpear(player, hordeManager);
      spear.rank = 5; // 3 spears per volley, 8 pierce

      // Spawn 100 skeletons around player
      for (let i = 0; i < 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const dist = 100 + (i % 5) * 40;
        hordeManager.spawn('skeleton', Math.cos(angle) * dist, Math.sin(angle) * dist);
      }

      const pool = spear.projectilePool;
      const initialCapacity = pool.getCapacity();

      // Run 500 frames of simulation
      for (let frame = 0; frame < 500; frame++) {
        hordeManager.update(1 / 60, player.position);
        spear.update(1 / 60);

        // Respawn skeletons if depleted
        if (hordeManager.getActiveCount() < 50) {
          hordeManager.spawn('skeleton', 150, 0);
        }

        // Check invariant on every frame
        expect(pool.getActiveCount() + pool.getAvailableCount()).toBe(initialCapacity);
      }

      // Drain all projectiles by waiting out maxLife (2.0s = 120 frames)
      spear.rank = 1;
      spear.timer = -100; // Prevent further firing
      for (let frame = 0; frame < 130; frame++) {
        spear.timer = -100;
        hordeManager.update(1 / 60, player.position);
        spear.update(1 / 60);
      }

      // All projectiles must have recycled back to available
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(initialCapacity);
    });
  });

  // =========================================================================
  // Challenge 4: Bone Spear Pierce Limits & Contact Cooldown
  // =========================================================================
  describe('Challenge 4: Bone Spear Pierce Limits & Collision Invariants', () => {
    it('empirically verifies Bone Spear respects exact pierce limit across ranks 1 to 5', () => {
      const piercePerRank = [2, 3, 5, 6, 8];

      for (let r = 1; r <= 5; r++) {
        const spear = new BoneSpear(player, hordeManager);
        spear.rank = r;
        const expectedPierce = piercePerRank[r - 1];

        // Line up 12 enemies along X axis
        const enemies = [];
        for (let e = 0; e < 12; e++) {
          enemies.push(hordeManager.spawn('death_knight', 50 + e * 40, 0)!);
        }

        const proj = spear.fireProjectile(1, 0)!;
        expect(proj.pierceRemaining).toBe(expectedPierce);

        // Simulate spear hitting enemies sequentially
        for (let e = 0; e < 12; e++) {
          const despawned = spear.handleHit(proj, enemies[e]);
          if (despawned) {
            // Must despawn exactly when pierce hits are exhausted
            expect(e + 1).toBe(expectedPierce);
            expect(proj.pierceRemaining).toBe(0);
            expect(proj.active).toBe(false);
            break;
          }
        }
      }
    });

    it('empirically verifies an enemy is not hit multiple times in a row by the same projectile', () => {
      const spear = new BoneSpear(player, hordeManager);
      spear.rank = 1;

      const enemy = hordeManager.spawn('death_knight', 50, 0)!;
      const hpInitial = enemy.health;

      const proj = spear.fireProjectile(1, 0)!;

      // Hit 1: Enemy damaged, pierce decremented
      const despawned1 = spear.handleHit(proj, enemy);
      expect(despawned1).toBe(false);
      expect(proj.pierceRemaining).toBe(1);
      const hpAfterHit1 = enemy.health;
      expect(hpAfterHit1).toBeLessThan(hpInitial);

      // Attempt Hit 2 on the SAME enemy with the same projectile
      const despawned2 = spear.handleHit(proj, enemy);
      expect(despawned2).toBe(false);
      expect(proj.pierceRemaining).toBe(1); // Pierce NOT decremented again!
      expect(enemy.health).toBe(hpAfterHit1); // Damage NOT dealt again!
    });

    it('empirically verifies Soul Orbiters contact cooldown prevents frame-by-frame spam', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 1; // hitCD = 0.30s

      const skull = orbiters.skulls[0];
      const enemy = hordeManager.spawn('death_knight', skull.x, skull.y)!;
      let hitEvents = 0;
      let lastHp = enemy.health;

      // Track damage events over 60 frames (1.0s)
      const dt = 1 / 60;
      for (let frame = 0; frame < 60; frame++) {
        // Keep enemy pinned to skull position
        enemy.x = skull.x;
        enemy.y = skull.y;

        orbiters.update(dt);

        if (enemy.health < lastHp) {
          hitEvents++;
          lastHp = enemy.health;
        }
      }

      // Over 1.0s with hitCD = 0.30s, exactly 4 hits can occur (at t=0.016s, 0.316s, 0.616s, 0.916s)
      // NOT 60 hits!
      expect(hitEvents).toBe(4);
    });

    it('empirically verifies Soul Orbiters tracks independent hit cooldowns per enemy', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 1; // hitCD = 0.30s

      // Place 2 enemies at different skull positions
      const skull0 = orbiters.skulls[0];
      const skull1 = orbiters.skulls[1];

      const enemyA = hordeManager.spawn('death_knight', skull0.x, skull0.y)!;
      const enemyB = hordeManager.spawn('death_knight', skull1.x, skull1.y)!;

      const hpA_init = enemyA.health;
      const hpB_init = enemyB.health;

      // Frame 1: Both hit
      orbiters.update(1 / 60);
      expect(enemyA.health).toBeLessThan(hpA_init);
      expect(enemyB.health).toBeLessThan(hpB_init);

      const hpA_hit1 = enemyA.health;
      const hpB_hit1 = enemyB.health;

      // Frame 2: Neither hit
      orbiters.update(1 / 60);
      expect(enemyA.health).toBe(hpA_hit1);
      expect(enemyB.health).toBe(hpB_hit1);
    });
  });

  // =========================================================================
  // Challenge 5: Edge Case Mining & Adversarial Stress
  // =========================================================================
  describe('Challenge 5: Adversarial Boundary & Stress Analysis', () => {
    it('adversarially probes ProjectilePool.spawn() without reset() lifecycle anomaly', () => {
      const pool = new ProjectilePool(16);

      // When a projectile is spawned via pool.spawn()
      const p = pool.spawn()!;
      expect(pool.getActiveCount()).toBe(1);

      // NOTICE: p.active is false until p.reset() is called!
      expect(p.active).toBe(false);

      // If someone calls free(p.id) when p.active is false:
      pool.free(p.id);

      // Empirical Observation:
      // Because free(idx) has "if (!p.active) return;", calling free() on a spawned projectile
      // that wasn't reset fails to free it!
      // This is a documented edge case: ProjectilePool assumes reset() is always paired with spawn().
      // If reset() is called:
      p.reset('spear', 0, 0, 1, 0, 100, 10, 20, 100, 2);
      expect(p.active).toBe(true);
      pool.free(p.id);
      expect(p.active).toBe(false);
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getAvailableCount()).toBe(16);
    });

    it('empirically tests Ossuary Cataclysm hit history limit (> 16 hits)', () => {
      const spear = new BoneSpear(player, hordeManager);
      spear.isEvolution = true; // pierce: 999

      const proj = spear.fireProjectile(1, 0)!;
      expect(proj.pierceRemaining).toBe(999);

      // Hit 16 distinct living enemies (death_knight HP = 500 > lance damage 130)
      for (let i = 0; i < 16; i++) {
        const enemy = hordeManager.spawn('death_knight', 50 + i * 10, 0)!;
        spear.handleHit(proj, enemy);
      }

      expect(proj.hitCount).toBe(16);
      expect(proj.pierceRemaining).toBe(999 - 16);

      // Hit 17th enemy
      const enemy17 = hordeManager.spawn('skeleton', 300, 0)!;
      spear.handleHit(proj, enemy17);

      // Because hitEnemyIds is Int16Array(16), hitCount caps at 16
      expect(proj.hitCount).toBe(16);
      // But enemy17 is not recorded in hitEnemyIds buffer!
      expect(proj.hasHit(enemy17.id)).toBe(false);
    });

    it('empirically verifies WeaponManager orchestrates all 5 weapons under high horde density', () => {
      const wm = new WeaponManager(hordeManager, player);
      wm.addWeapon('scythe', 3);
      wm.addWeapon('orbiters', 3);
      wm.addWeapon('lightning', 3);
      wm.addWeapon('spear', 3);
      wm.addWeapon('aura', 3);

      expect(wm.getEquippedCount()).toBe(5);

      // Spawn 300 skeletons around player
      for (let i = 0; i < 300; i++) {
        const angle = (i / 300) * Math.PI * 2;
        const dist = 50 + (i % 10) * 20;
        hordeManager.spawn('skeleton', Math.cos(angle) * dist, Math.sin(angle) * dist);
      }

      const initialKilled = hordeManager.totalKilled;

      // Run 180 ticks (3 seconds)
      for (let t = 0; t < 180; t++) {
        wm.update(1 / 60);
      }

      // Swarms should have been obliterated by the 5 active weapons
      expect(hordeManager.totalKilled).toBeGreaterThan(initialKilled + 50);
      expect(player.position.x).toBe(0);
      expect(player.position.y).toBe(0);
    });
  });
});
