import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerProgression, LevelUpEvent } from '../../src/core/progression/PlayerProgression';
import { PassiveModifier, PlayerStatsManager } from '../../src/core/player/PlayerStats';

describe('PlayerProgression & Stat Scaling (Milestone 1 Core Math)', () => {
  let progression: PlayerProgression;
  let statsManager: PlayerStatsManager;

  beforeEach(() => {
    progression = new PlayerProgression(10); // Base XP = 10
    statsManager = new PlayerStatsManager({
      maxHealth: 100,
      currentHealth: 100,
      healthRegen: 0,
      armor: 0,
      moveSpeed: 200,
      might: 1.0,
      area: 1.0,
      projSpeed: 1.0,
      cooldownReduction: 0.0,
      magnetRadius: 80,
      luck: 1.0,
    });
  });

  describe('Suite 1: XP Required Mathematical Curve (XP_required = Math.floor(base * level^1.5))', () => {
    it('computes exact XP requirements for benchmark levels 1 to 20 with base = 10', () => {
      const testCases: [number, number][] = [
        [1, 10],   // 10 * 1^1.5 = 10
        [2, 28],   // 10 * 2^1.5 = 28.284 -> 28
        [3, 51],   // 10 * 3^1.5 = 51.961 -> 51
        [4, 80],   // 10 * 4^1.5 = 80.000 -> 80
        [5, 111],  // 10 * 5^1.5 = 111.803 -> 111
        [8, 226],  // 10 * 8^1.5 = 226.274 -> 226
        [10, 316], // 10 * 10^1.5 = 316.227 -> 316
        [16, 640], // 10 * 16^1.5 = 640.000 -> 640
        [20, 894], // 10 * 20^1.5 = 894.427 -> 894
      ];

      for (const [level, expectedXP] of testCases) {
        expect(progression.calculateXPRequired(level)).toBe(expectedXP);
      }
    });

    it('strictly satisfies monotonic growth for levels 1 through 100', () => {
      for (let lvl = 1; lvl < 100; lvl++) {
        const currentReq = progression.calculateXPRequired(lvl);
        const nextReq = progression.calculateXPRequired(lvl + 1);
        expect(nextReq).toBeGreaterThan(currentReq);
      }
    });

    it('supports custom base XP multipliers', () => {
      const customProg = new PlayerProgression(25);
      expect(customProg.calculateXPRequired(1)).toBe(25);
      expect(customProg.calculateXPRequired(4)).toBe(200); // 25 * 8 = 200
    });
  });

  describe('Suite 2: XP Acquisition & Single Level-Up Event Triggers', () => {
    it('initializes with level 1, 0 current XP, and xpToNextLevel = 10', () => {
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(0);
      expect(progression.getTotalXP()).toBe(0);
      expect(progression.getXPToNextLevel()).toBe(10);
    });

    it('accumulates XP without leveling up when below requirement', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(9);

      expect(levelsGained).toBe(0);
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(9);
      expect(progression.getTotalXP()).toBe(9);
      expect(levelUpSpy).not.toHaveBeenCalled();
    });

    it('triggers level up when XP matches threshold exactly', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(10);

      expect(levelsGained).toBe(1);
      expect(progression.getLevel()).toBe(2);
      expect(progression.getCurrentXP()).toBe(0);
      expect(progression.getTotalXP()).toBe(10);
      expect(progression.getXPToNextLevel()).toBe(28); // Level 2 requires 28 XP

      expect(levelUpSpy).toHaveBeenCalledTimes(1);
      expect(levelUpSpy).toHaveBeenCalledWith({
        newLevel: 2,
        previousLevel: 1,
        surplusXP: 0,
        xpRequiredForNext: 28,
        totalXPEarned: 10,
      } as LevelUpEvent);
    });
  });

  describe('Suite 3: Surplus XP Carryover & Multi-Level Up Bursts', () => {
    it('carries over surplus XP to the next level accurately', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      // Level 1 needs 10 XP. Add 15 XP.
      const levelsGained = progression.addXP(15);

      expect(levelsGained).toBe(1);
      expect(progression.getLevel()).toBe(2);
      expect(progression.getCurrentXP()).toBe(5); // 15 - 10 = 5
      expect(progression.getTotalXP()).toBe(15);
      expect(progression.getXPToNextLevel()).toBe(28);
    });

    it('handles multi-level jump from a massive XP drop in sequential order', () => {
      const events: LevelUpEvent[] = [];
      progression.onLevelUp((e) => events.push(e));

      // Level 1 requires 10 (cum 10)
      // Level 2 requires 28 (cum 38)
      // Level 3 requires 51 (cum 89)
      // Adding 100 XP:
      // - 100 - 10 = 90 -> Level 2
      // - 90 - 28 = 62 -> Level 3
      // - 62 - 51 = 11 -> Level 4 (surplus 11)
      const levelsGained = progression.addXP(100);

      expect(levelsGained).toBe(3);
      expect(progression.getLevel()).toBe(4);
      expect(progression.getCurrentXP()).toBe(11);
      expect(progression.getTotalXP()).toBe(100);
      expect(progression.getXPToNextLevel()).toBe(80); // Level 4 requires 80 XP

      expect(events.length).toBe(3);
      expect(events[0].newLevel).toBe(2);
      expect(events[1].newLevel).toBe(3);
      expect(events[2].newLevel).toBe(4);
      expect(events[2].surplusXP).toBe(11);
    });

    it('handles extreme burst XP (50,000 XP) without recursion overflow', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      const levelsGained = progression.addXP(50000);

      expect(levelsGained).toBeGreaterThan(30);
      expect(progression.getLevel()).toBe(levelsGained + 1);
      expect(progression.getTotalXP()).toBe(50000);
      expect(levelUpSpy).toHaveBeenCalledTimes(levelsGained);
    });

    it('ignores 0 or negative XP increments', () => {
      const levelUpSpy = vi.fn();
      progression.onLevelUp(levelUpSpy);

      expect(progression.addXP(0)).toBe(0);
      expect(progression.addXP(-50)).toBe(0);
      expect(progression.getLevel()).toBe(1);
      expect(progression.getCurrentXP()).toBe(0);
      expect(levelUpSpy).not.toHaveBeenCalled();
    });

    it('supports unregistering level-up listeners', () => {
      const levelUpSpy = vi.fn();
      const unsubscribe = progression.onLevelUp(levelUpSpy);

      progression.addXP(10); // Levels up to 2
      expect(levelUpSpy).toHaveBeenCalledTimes(1);

      unsubscribe();

      progression.addXP(50); // Levels up further
      expect(levelUpSpy).toHaveBeenCalledTimes(1); // Not called again after unsubscribe
    });
  });

  describe('Suite 4: Stat Scaling & Passive Modifiers', () => {
    it('returns unmodified base stats when no passives are equipped', () => {
      const stats = statsManager.getEffectiveStats();
      expect(stats.maxHealth).toBe(100);
      expect(stats.moveSpeed).toBe(200);
      expect(stats.might).toBe(1.0);
      expect(stats.armor).toBe(0);
      expect(stats.cooldownReduction).toBe(0.0);
      expect(stats.magnetRadius).toBe(80);
    });

    it('applies flat passive modifiers additively', () => {
      statsManager.addPassiveModifier({
        id: 'obsidian_armor_1',
        name: 'Obsidian Armor',
        stat: 'armor',
        type: 'flat',
        value: 3,
      });

      statsManager.addPassiveModifier({
        id: 'blood_chalice_1',
        name: 'Blood Chalice',
        stat: 'maxHealth',
        type: 'flat',
        value: 25,
      });

      const stats = statsManager.getEffectiveStats();
      expect(stats.armor).toBe(3);
      expect(stats.maxHealth).toBe(125);
    });

    it('applies percentage passive modifiers additively on top of baseline', () => {
      // Tome of Might Rank 1 (+10% might)
      statsManager.addPassiveModifier({
        id: 'might_1',
        name: 'Tome of Might',
        stat: 'might',
        type: 'percent',
        value: 0.10,
      });

      // Tome of Might Rank 2 (+10% might)
      statsManager.addPassiveModifier({
        id: 'might_2',
        name: 'Tome of Might',
        stat: 'might',
        type: 'percent',
        value: 0.10,
      });

      // Ring of Velocity (+15% move speed)
      statsManager.addPassiveModifier({
        id: 'velocity_1',
        name: 'Ring of Velocity',
        stat: 'moveSpeed',
        type: 'percent',
        value: 0.15,
      });

      const stats = statsManager.getEffectiveStats();
      expect(stats.might).toBeCloseTo(1.20, 5); // 1.0 + 0.10 + 0.10
      expect(stats.moveSpeed).toBeCloseTo(230, 5); // 200 * (1 + 0.15) = 230
    });

    it('strictly clamps Cooldown Reduction (CDR) at maximum 50% (0.50)', () => {
      statsManager.addPassiveModifier({
        id: 'cdr_1',
        name: 'Chrono Relic',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.35,
      });

      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.35);

      // Add another 30% CDR (total 65%)
      statsManager.addPassiveModifier({
        id: 'cdr_2',
        name: 'Temporal Sigil',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.30,
      });

      // Must be strictly clamped at 0.50 to avoid division by zero or infinite weapon firing
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.50);
    });

    it('removes modifiers cleanly restoring exact baseline stats', () => {
      const mod: PassiveModifier = {
        id: 'magnet_1',
        name: 'Eldritch Magnet',
        stat: 'magnetRadius',
        type: 'flat',
        value: 60,
      };

      statsManager.addPassiveModifier(mod);
      expect(statsManager.getEffectiveStats().magnetRadius).toBe(140);

      statsManager.removePassiveModifier('magnet_1');
      expect(statsManager.getEffectiveStats().magnetRadius).toBe(80);
    });
  });
});
