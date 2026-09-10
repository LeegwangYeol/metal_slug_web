import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import {
  UpgradeSystem,
  UpgradeType,
} from '../../src/core/systems/UpgradeSystem';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { HordeManager } from '../../src/core/HordeManager';
import { WaveDirector } from '../../src/core/systems/WaveDirector';

describe('Rogue-Lite UpgradeSystem & Synergies Suite (Milestone M3)', () => {
  let player: Player;
  let statsManager: PlayerStatsManager;
  let upgradeSystem: UpgradeSystem;

  beforeEach(() => {
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
    upgradeSystem = new UpgradeSystem(player, statsManager);
  });

  describe('Suite 1: Inventory Slot Limits (6 Weapons, 6 Passives)', () => {
    it('enforces maximum 6 active weapons capacity', () => {
      const weapons = [
        'arcane_scythe',
        'soul_orbiters',
        'abyssal_lightning',
        'bone_spear',
        'cursed_aura',
        'spectral_daggers',
      ];

      for (const w of weapons) {
        expect(upgradeSystem.canAddWeapon(w)).toBe(true);
        upgradeSystem.addWeapon(w);
      }
      expect(upgradeSystem.getWeaponSlotsCount()).toBe(6);

      // 7th weapon rejected
      expect(upgradeSystem.canAddWeapon('void_staff')).toBe(false);
    });

    it('enforces maximum 6 passives capacity', () => {
      const passives = [
        'tome_of_might',
        'ring_of_velocity',
        'blood_chalice',
        'eldritch_magnet',
        'obsidian_armor',
        'chrono_relic',
      ];

      for (const p of passives) {
        expect(upgradeSystem.canAddPassive(p)).toBe(true);
        upgradeSystem.addPassive(p);
      }
      expect(upgradeSystem.getPassiveSlotsCount()).toBe(6);

      // 7th passive rejected
      expect(upgradeSystem.canAddPassive('silver_bullet')).toBe(false);
    });
  });

  describe('Suite 2: Card Generation Algorithm', () => {
    it('generates 3 to 4 distinct upgrade choices without duplicates', () => {
      const cards = upgradeSystem.generateUpgradeCards(3);
      expect(cards.length).toBe(3);

      const ids = new Set(cards.map((c) => c.itemId));
      expect(ids.size).toBe(3); // Strictly distinct
    });

    it('never offers upgrades for already maxed Rank 5 items', () => {
      // Max out Tome of Might to Rank 5
      for (let r = 1; r <= 5; r++) {
        upgradeSystem.upgradeItem('tome_of_might');
      }
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(5);

      // Roll 100 hands, ensure Tome of Might rank upgrade never appears
      for (let roll = 0; roll < 100; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        const hasMightRankUp = cards.some(
          (c) => c.itemId === 'tome_of_might' && c.type === UpgradeType.PASSIVE_RANK
        );
        expect(hasMightRankUp).toBe(false);
      }
    });

    it('only offers rank-ups of owned items when inventory slots are full', () => {
      // Fill all 6 weapon slots and 6 passive slots with Rank 1 items
      const wList = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
      const pList = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      wList.forEach((w) => upgradeSystem.addWeapon(w));
      pList.forEach((p) => upgradeSystem.addPassive(p));

      const cards = upgradeSystem.generateUpgradeCards(4);
      for (const card of cards) {
        const isOwned = wList.includes(card.itemId) || pList.includes(card.itemId);
        expect(isOwned).toBe(true);
      }
    });
  });

  describe('Suite 3: Rank Progression 1 through 5', () => {
    it('advances rank monotonically and applies correct passive modifiers', () => {
      expect(statsManager.getEffectiveStats().might).toBe(1.0);

      // Rank 1 (+10% might)
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(1);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.10, 4);

      // Rank 2 (+10% might)
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(2);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.20, 4);

      // Rank 5 (+50% might total)
      upgradeSystem.upgradeItem('tome_of_might');
      upgradeSystem.upgradeItem('tome_of_might');
      upgradeSystem.upgradeItem('tome_of_might');
      expect(upgradeSystem.getItemRank('tome_of_might')).toBe(5);
      expect(statsManager.getEffectiveStats().might).toBeCloseTo(1.50, 4);
    });

    it('applies flat armor bonuses from Obsidian Armor', () => {
      for (let r = 1; r <= 3; r++) {
        upgradeSystem.upgradeItem('obsidian_armor');
      }
      expect(statsManager.getEffectiveStats().armor).toBe(3);
    });
  });

  describe('Suite 4: Synergistic Weapon Evolutions', () => {
    it('unlocks evolution card when weapon is Rank 5 and passive is owned', () => {
      // Weapon: Arcane Scythe Rank 5, Passive: Blood Chalice Rank 1
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.upgradeItem('blood_chalice');

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(true);

      // Card generator should include the evolution
      const cards = upgradeSystem.generateUpgradeCards(4);
      const evoCard = cards.find((c) => c.type === UpgradeType.WEAPON_EVOLUTION);
      expect(evoCard).toBeDefined();
      expect(evoCard!.itemId).toBe('soul_reaping_harvester');
    });

    it('does not offer evolution if weapon is below Rank 5', () => {
      for (let i = 0; i < 4; i++) upgradeSystem.upgradeItem('arcane_scythe'); // Rank 4
      upgradeSystem.upgradeItem('blood_chalice');

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(false);
    });

    it('does not offer evolution if corresponding passive is missing', () => {
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe'); // Rank 5
      // No Blood Chalice

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(false);
    });

    it('replaces base weapon with evolved weapon preserving slot count', () => {
      upgradeSystem.addWeapon('arcane_scythe');
      for (let i = 1; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.addPassive('blood_chalice');

      const initialSlotCount = upgradeSystem.getWeaponSlotsCount();

      upgradeSystem.evolveWeapon('arcane_scythe', 'soul_reaping_harvester');

      expect(upgradeSystem.getWeaponSlotsCount()).toBe(initialSlotCount);
      expect(upgradeSystem.hasWeapon('arcane_scythe')).toBe(false);
      expect(upgradeSystem.hasWeapon('soul_reaping_harvester')).toBe(true);
    });
  });

  describe('Suite 5: Remediation Regression Verification', () => {
    it('empirically verifies evolved weapons are NEVER re-offered as new unlocks or downgraded', () => {
      const hordeManager = new HordeManager({ maxCapacity: 100 });
      const weaponManager = new WeaponManager(hordeManager, player);
      weaponManager.addWeapon('scythe', 1);

      // Upgrade scythe to rank 5 and add blood chalice
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.upgradeItem('blood_chalice');

      // Evolve scythe
      upgradeSystem.evolveWeapon('arcane_scythe', 'soul_reaping_harvester');
      weaponManager.evolveWeapon('scythe', 'soul_reaping_harvester');

      expect(upgradeSystem.isWeaponEvolved('arcane_scythe')).toBe(true);
      expect(upgradeSystem.isWeaponEvolved('weapon_scythe')).toBe(true);
      expect(upgradeSystem.isWeaponEvolved('scythe')).toBe(true);
      expect(weaponManager.getWeapon('scythe')?.isEvolution).toBe(true);
      expect(weaponManager.getWeapon('scythe')?.rank).toBe(5);

      // Roll 200 card hands (with open weapon slots < 6)
      for (let roll = 0; roll < 200; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        const hasScytheUnlock = cards.some(
          (c) => c.itemId === 'weapon_scythe' || c.itemId === 'arcane_scythe' || c.itemId === 'scythe'
        );
        expect(hasScytheUnlock).toBe(false);
      }

      // Try applying a rogue weapon card for scythe with rank 1
      upgradeSystem.applyUpgrade({
        id: 'weapon_scythe_unlock',
        itemId: 'weapon_scythe',
        name: 'Arcane Scythe',
        subtitle: 'NEW WEAPON',
        category: 'weapon',
        type: UpgradeType.WEAPON_UNLOCK,
        icon: 'scythe',
        previousRank: 0,
        newRank: 1,
        maxRank: 5,
        description: 'Slash',
        statChangeDescription: 'Unlock',
        isEvolution: false,
      }, player, weaponManager);

      // Assert weapon remains evolved and rank is STILL 5 (never demoted)
      expect(upgradeSystem.isWeaponEvolved('arcane_scythe')).toBe(true);
      expect(weaponManager.getWeapon('scythe')?.rank).toBe(5);
      expect(weaponManager.getWeapon('scythe')?.isEvolution).toBe(true);
    });

    it('empirically verifies player moveSpeed increases monotonically from Rank 0 to Rank 5 with Ring of Velocity', () => {
      const freshPlayer = new Player(0, 0);
      const freshUpgrade = new UpgradeSystem(freshPlayer);

      expect(freshPlayer.stats.moveSpeed).toBe(200);

      const expectedSpeeds = [200, 220, 240, 260, 280, 300];
      let prevSpeed = freshPlayer.stats.moveSpeed;

      for (let rank = 1; rank <= 5; rank++) {
        freshUpgrade.upgradeItem('passive_velocity');
        const currentSpeed = freshPlayer.stats.moveSpeed;

        expect(currentSpeed).toBe(expectedSpeeds[rank]);
        expect(currentSpeed).toBeGreaterThan(prevSpeed); // Strictly monotonic
        prevSpeed = currentSpeed;

        // Verify kinematic velocity approaches currentSpeed
        freshPlayer.velocity.x = 0;
        freshPlayer.velocity.y = 0;
        for (let frame = 0; frame < 60; frame++) {
          freshPlayer.handleInput({ up: false, down: false, left: false, right: true }, 1 / 60);
        }
        expect(freshPlayer.velocity.x).toBeCloseTo(currentSpeed, 1);
      }

      expect(freshPlayer.stats.moveSpeed).toBe(300);
    });

    it('empirically verifies 1,000 perimeter spawns across extreme camera positions clamped to arena borders produce 0 on-screen points', () => {
      const horde = new HordeManager({ maxCapacity: 100 });
      const director = new WaveDirector(horde, {
        viewportWidth: 960,
        viewportHeight: 540,
        spawnMargin: 90,
        arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
      });

      const extremePositions = [
        { name: 'East Boundary', camX: 1040, camY: 0 },
        { name: 'West Boundary', camX: -2000, camY: 0 },
        { name: 'North Boundary', camX: 0, camY: -2000 },
        { name: 'South Boundary', camX: 0, camY: 1460 },
        { name: 'North-East Corner', camX: 1040, camY: -2000 },
        { name: 'North-West Corner', camX: -2000, camY: -2000 },
        { name: 'South-East Corner', camX: 1040, camY: 1460 },
        { name: 'South-West Corner', camX: -2000, camY: 1460 },
      ];

      for (const pos of extremePositions) {
        for (let i = 0; i < 1000; i++) {
          const pt = director.getPerimeterPoint(pos.camX, pos.camY);
          const isInsideFrustum =
            pt.x >= pos.camX &&
            pt.x <= pos.camX + 960 &&
            pt.y >= pos.camY &&
            pt.y <= pos.camY + 540;

          expect(isInsideFrustum).toBe(false);
          expect(pt.x).toBeGreaterThanOrEqual(-2000);
          expect(pt.x).toBeLessThanOrEqual(2000);
          expect(pt.y).toBeGreaterThanOrEqual(-2000);
          expect(pt.y).toBeLessThanOrEqual(2000);
        }
      }
    });
  });
});
