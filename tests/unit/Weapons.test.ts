import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { CursedAura } from '../../src/core/weapons/CursedAura';

describe('Occult Weapons & WeaponManager Suite (Milestone M3)', () => {
  let hordeManager: HordeManager;
  let player: Player;
  let statsManager: PlayerStatsManager;
  let weaponManager: WeaponManager;

  beforeEach(() => {
    hordeManager = new HordeManager({ maxCapacity: 1000 });
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
    weaponManager = new WeaponManager(hordeManager, player);
  });

  describe('Suite 1: Arcane Scythe cleave arc & target piercing', () => {
    it('cleaves all enemies within forward arc and deals might-scaled damage', () => {
      const scythe = new ArcaneScythe(player, hordeManager);
      scythe.rank = 1;

      // Place 3 skeletons in front of player (facing right)
      const e1 = hordeManager.spawn('skeleton', 60, 0);
      const e2 = hordeManager.spawn('skeleton', 70, 20);
      const e3 = hordeManager.spawn('skeleton', 70, -20);
      // Place 1 enemy behind player
      const eBehind = hordeManager.spawn('skeleton', -60, 0);

      const initialHp1 = e1!.health;
      scythe.fire(0, 0);

      expect(e1!.health).toBeLessThan(initialHp1);
      expect(e2!.health).toBeLessThan(initialHp1);
      expect(e3!.health).toBeLessThan(initialHp1);
      expect(eBehind!.health).toBe(initialHp1); // Untouched
    });

    it('scales damage and cleave radius from Rank 1 to Rank 5', () => {
      const scythe = new ArcaneScythe(player, hordeManager);
      expect(scythe.getDamage(1)).toBeLessThan(scythe.getDamage(5));
      expect(scythe.getArea(1)).toBeLessThan(scythe.getArea(5));
      expect(scythe.getCooldown(1)).toBeGreaterThan(scythe.getCooldown(5));
    });
  });

  describe('Suite 2: Soul Orbiters orbit kinematics & per-enemy hit cooldown', () => {
    it('maintains continuous rotation at fixed radius around player', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 2; // 3 skulls

      const initialAngle = orbiters.skulls[0].angle;
      orbiters.update(0.1);
      expect(orbiters.skulls[0].angle).not.toBe(initialAngle);

      // Radial distance remains constant
      const skull = orbiters.skulls[0];
      const dist = Math.hypot(skull.x - player.position.x, skull.y - player.position.y);
      expect(dist).toBeCloseTo(orbiters.orbitRadius, 1);
    });

    it('enforces per-enemy contact cooldown preventing frame-by-frame damage spam', () => {
      const orbiters = new SoulOrbiters(player, hordeManager);
      orbiters.rank = 1;

      // Position enemy right on the orbiter skull
      const skull = orbiters.skulls[0];
      const enemy = hordeManager.spawn('death_knight', skull.x, skull.y);
      const hpInitial = enemy!.health;

      // Frame 1: Hit occurs
      orbiters.update(1 / 60);
      const hpAfterHit1 = enemy!.health;
      expect(hpAfterHit1).toBeLessThan(hpInitial);

      // Frame 2: Still on top of skull, but on cooldown
      orbiters.update(1 / 60);
      expect(enemy!.health).toBe(hpAfterHit1); // No new damage dealt immediately

      // Step past per-enemy hit cooldown (0.3s)
      orbiters.update(0.35);
      expect(enemy!.health).toBeLessThan(hpAfterHit1); // Damage dealt again
    });
  });

  describe('Suite 3: Abyssal Lightning chain necrosis', () => {
    it('strikes target enemy and chains to nearest neighbor via SpatialHashGrid', () => {
      const lightning = new AbyssalLightning(player, hordeManager);
      lightning.rank = 1;

      const primary = hordeManager.spawn('skeleton', 100, 0);
      const neighbor = hordeManager.spawn('skeleton', 140, 0); // within chain radius 120px
      const distant = hordeManager.spawn('skeleton', 600, 0);  // outside chain radius

      lightning.triggerStrike();

      expect(primary!.health).toBeLessThan(25);
      expect(neighbor!.health).toBeLessThan(25);
      expect(distant!.health).toBe(25);
    });
  });

  describe('Suite 4: Bone Spear piercing & zero-allocation projectile pool', () => {
    it('penetrates up to pierce limit and despawns upon exceeding limit', () => {
      const spear = new BoneSpear(player, hordeManager);
      spear.rank = 1; // Pierce = 2

      // Line up 3 skeletons in a row
      const e1 = hordeManager.spawn('skeleton', 50, 0);
      const e2 = hordeManager.spawn('skeleton', 100, 0);
      const e3 = hordeManager.spawn('skeleton', 150, 0);

      const proj = spear.fireProjectile(1, 0); // Fired rightwards
      expect(proj).not.toBeNull();
      expect(proj!.active).toBe(true);

      // Pass through e1 -> pierce count decrements to 1
      spear.handleHit(proj!, e1!);
      expect(proj!.pierceRemaining).toBe(1);
      expect(proj!.active).toBe(true);

      // Pass through e2 -> pierce count decrements to 0
      spear.handleHit(proj!, e2!);
      expect(proj!.pierceRemaining).toBe(0);
      expect(proj!.active).toBe(false); // Despawned and recycled

      // e3 is not hit
      expect(e3!.health).toBe(25);
    });

    it('sustains 100% projectile identity reuse without heap growth', () => {
      const spear = new BoneSpear(player, hordeManager);
      const poolCapacity = spear.projectilePool.getCapacity();

      for (let i = 0; i < 500; i++) {
        const p = spear.fireProjectile(1, 0);
        if (p) spear.recycleProjectile(p);
      }

      expect(spear.projectilePool.getAvailableCount()).toBe(poolCapacity);
    });
  });

  describe('Suite 5: Cursed Aura pulsating radius & radial knockback', () => {
    it('inflicts damage and pushes all enemies inside radius outwards', () => {
      const aura = new CursedAura(player, hordeManager);
      aura.rank = 1;

      const inside = hordeManager.spawn('skeleton', 40, 0);
      const outside = hordeManager.spawn('skeleton', 250, 0);

      aura.pulse();

      expect(inside!.health).toBeLessThan(25);
      expect(inside!.pushVx).toBeGreaterThan(0); // Pushed away along X
      expect(outside!.health).toBe(25);
      expect(outside!.pushVx).toBe(0);
    });
  });

  describe('Suite 6: Cooldown Reduction & Might Scaling Integration', () => {
    it('applies player CDR clamped at 50% ceiling', () => {
      statsManager.setBaseStat('cooldownReduction', 0.30);
      const scythe = new ArcaneScythe(player, hordeManager, statsManager);
      const baseCD = scythe.baseCooldown;
      expect(scythe.getEffectiveCooldown()).toBeCloseTo(baseCD * 0.70, 4);

      // Set CDR to 80% -> clamped at 50%
      statsManager.setBaseStat('cooldownReduction', 0.80);
      expect(scythe.getEffectiveCooldown()).toBeCloseTo(baseCD * 0.50, 4);
    });

    it('scales weapon damage proportionally with Might multiplier', () => {
      statsManager.setBaseStat('might', 1.50);
      const spear = new BoneSpear(player, hordeManager, statsManager);
      expect(spear.getEffectiveDamage()).toBeCloseTo(spear.baseDamage * 1.50, 4);
    });
  });

  describe('Suite 7: WeaponManager Multi-Weapon Orchestration', () => {
    it('equips up to 6 weapons and ticks all auto-fire timers concurrently', () => {
      weaponManager.addWeapon(new ArcaneScythe(player, hordeManager));
      weaponManager.addWeapon(new SoulOrbiters(player, hordeManager));
      weaponManager.addWeapon(new AbyssalLightning(player, hordeManager));
      weaponManager.addWeapon(new BoneSpear(player, hordeManager));
      weaponManager.addWeapon(new CursedAura(player, hordeManager));

      expect(weaponManager.getEquippedCount()).toBe(5);

      // Run 60 frames (1 second)
      hordeManager.spawnWave('skeleton', 20, { x: 0, y: 0 }, 100);
      for (let f = 0; f < 60; f++) {
        weaponManager.update(1 / 60);
      }

      // Weapons should have fired and damaged horde
      expect(hordeManager.totalKilled).toBeGreaterThan(0);
    });
  });
});
