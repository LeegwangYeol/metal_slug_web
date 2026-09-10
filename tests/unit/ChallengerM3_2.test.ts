/**
 * ChallengerM3_2.test.ts - Empirical Challenge Suite for Milestone M3.
 *
 * Objectives:
 * 1. Upgrade card generation invariants: Rank 5 exclusion, 6-slot capping, no duplicates.
 * 2. Evolution availability matrix: Rank 5 weapon + paired passive requirement.
 * 3. Wave Director perimeter spawning math: Margin M >= 80px across interior and boundary cameras.
 * 4. Wave Director timeline escalation: 4-phase progression and difficulty math.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../src/core/entities/Player';
import { PlayerStatsManager } from '../../src/core/player/PlayerStats';
import {
  UpgradeSystem,
  UpgradeType,
  OCCULT_WEAPONS,
  OCCULT_PASSIVES,
  OCCULT_EVOLUTIONS,
} from '../../src/core/systems/UpgradeSystem';
import { HordeManager } from '../../src/core/HordeManager';
import {
  WaveDirector,
  WavePhaseId,
} from '../../src/core/systems/WaveDirector';

describe('Challenger M3-2 Empirical Verification & Adversarial Suite', () => {
  let player: Player;
  let statsManager: PlayerStatsManager;
  let upgradeSystem: UpgradeSystem;
  let hordeManager: HordeManager;
  let waveDirector: WaveDirector;

  beforeEach(() => {
    player = new Player(0, 0);
    statsManager = new PlayerStatsManager();
    upgradeSystem = new UpgradeSystem(player, statsManager);
    hordeManager = new HordeManager({
      maxCapacity: 2048,
      worldBounds: { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 },
    });
    waveDirector = new WaveDirector(hordeManager, {
      viewportWidth: 960,
      viewportHeight: 540,
      spawnMargin: 90,
      arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
    });
  });

  describe('Objective 1: Upgrade Card Generation Invariants & Slot Quotas', () => {
    it('empirically asserts never offering an item already at Rank 5 across 500 rolls', () => {
      // Max out 2 weapons and 2 passives to Rank 5
      const maxedWeapons = ['weapon_scythe', 'weapon_orbiters'];
      const maxedPassives = ['passive_might', 'passive_chalice'];

      for (const w of maxedWeapons) {
        for (let r = 0; r < 5; r++) upgradeSystem.upgradeItem(w);
      }
      for (const p of maxedPassives) {
        for (let r = 0; r < 5; r++) upgradeSystem.upgradeItem(p);
      }

      for (let roll = 0; roll < 500; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        for (const card of cards) {
          if (card.type === UpgradeType.WEAPON_RANK) {
            expect(maxedWeapons).not.toContain(card.itemId);
          }
          if (card.type === UpgradeType.PASSIVE_RANK) {
            expect(maxedPassives).not.toContain(card.itemId);
          }
          if (card.type !== UpgradeType.WEAPON_EVOLUTION) {
            expect(card.previousRank).toBeLessThan(5);
            expect(card.newRank).toBeLessThanOrEqual(5);
          }
        }
      }
    });

    it('empirically asserts never offering a 7th weapon or passive when slots are full (capped at 6)', () => {
      // Fill all 6 weapon slots and 6 passive slots with custom Rank 1 items
      for (let i = 1; i <= 6; i++) {
        upgradeSystem.addWeapon(`slot_weapon_${i}`, 1);
        upgradeSystem.addPassive(`slot_passive_${i}`, 1);
      }

      expect(upgradeSystem.getWeaponSlotsCount()).toBe(6);
      expect(upgradeSystem.getPassiveSlotsCount()).toBe(6);

      for (let roll = 0; roll < 500; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        for (const card of cards) {
          expect(card.type).not.toBe(UpgradeType.WEAPON_UNLOCK);
          expect(card.type).not.toBe(UpgradeType.PASSIVE_UNLOCK);
        }
      }
    });

    it('empirically asserts zero duplicate cards in any single roll across 2,000 rolls', () => {
      for (let roll = 0; roll < 2000; roll++) {
        upgradeSystem.reset();
        // Give randomized partial inventory
        const numW = Math.floor(Math.random() * 4);
        const numP = Math.floor(Math.random() * 4);
        const wKeys = Object.keys(OCCULT_WEAPONS);
        const pKeys = Object.keys(OCCULT_PASSIVES);
        for (let i = 0; i < numW; i++) upgradeSystem.addWeapon(wKeys[i], Math.floor(Math.random() * 4) + 1);
        for (let i = 0; i < numP; i++) upgradeSystem.addPassive(pKeys[i], Math.floor(Math.random() * 4) + 1);

        const cards = upgradeSystem.generateUpgradeCards(4);
        const ids = new Set(cards.map((c) => c.id));
        const itemIds = new Set(cards.map((c) => c.itemId));

        expect(ids.size).toBe(cards.length);
        expect(itemIds.size).toBe(cards.length);
      }
    });

    it('generates safe fallback feast card when all 6 weapon slots and 6 passive slots are maxed', () => {
      // Fill all 6 weapon slots and 6 passive slots with Rank 5 items
      for (let i = 1; i <= 6; i++) {
        upgradeSystem.addWeapon(`max_w${i}`, 5);
        upgradeSystem.addPassive(`max_p${i}`, 5);
      }

      const cards = upgradeSystem.generateUpgradeCards(4);
      expect(cards.length).toBe(1);
      expect(cards[0].category).toBe('fallback');
      expect(cards[0].itemId).toBe('fallback_feast');
    });

    it('empirically verifies evolved base weapon is NEVER re-offered as a new unlock', () => {
      // Setup: Arcane Scythe Rank 5 + Blood Chalice Rank 1
      for (let r = 0; r < 5; r++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.upgradeItem('blood_chalice');

      // Evolve Arcane Scythe to Soul Reaping Harvester
      upgradeSystem.evolveWeapon('arcane_scythe', 'soul_reaping_harvester');

      // Check state: weapon slots count = 1 (< 6 max slots)
      expect(upgradeSystem.getWeaponSlotsCount()).toBe(1);
      expect(upgradeSystem.hasWeapon('soul_reaping_harvester')).toBe(true);

      // Verified: isWeaponEvolved('weapon_scythe') returns true
      expect(upgradeSystem.isWeaponEvolved('weapon_scythe')).toBe(true);
      expect(upgradeSystem.getWeaponRank('weapon_scythe')).toBe(5);

      // Verified: generateUpgradeCards never puts weapon_scythe into candidates as a NEW WEAPON!
      let reOfferedAsUnlock = false;
      for (let roll = 0; roll < 30; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        if (cards.some((c) => c.itemId === 'weapon_scythe' && c.type === UpgradeType.WEAPON_UNLOCK)) {
          reOfferedAsUnlock = true;
          break;
        }
      }
      expect(reOfferedAsUnlock).toBe(false);
    });
  });

  describe('Objective 2: Evolution Availability Matrix & Worker Test Flaw Analysis', () => {
    it('confirms evolution availability requires base weapon Rank 5 AND paired passive', () => {
      for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
        // Condition A: weapon < 5, passive present -> NOT eligible
        upgradeSystem.reset();
        for (let r = 0; r < 4; r++) upgradeSystem.upgradeItem(evo.weaponId);
        upgradeSystem.upgradeItem(evo.passiveId);
        expect(upgradeSystem.isEvolutionEligible(evo.weaponId)).toBe(false);

        // Condition B: weapon 5, passive missing -> NOT eligible
        upgradeSystem.reset();
        for (let r = 0; r < 5; r++) upgradeSystem.upgradeItem(evo.weaponId);
        expect(upgradeSystem.isEvolutionEligible(evo.weaponId)).toBe(false);

        // Condition C: weapon 5, wrong passive present -> NOT eligible
        const wrongPassive = evo.passiveId === 'passive_might' ? 'passive_armor' : 'passive_might';
        upgradeSystem.upgradeItem(wrongPassive);
        expect(upgradeSystem.isEvolutionEligible(evo.weaponId)).toBe(false);

        // Condition D: weapon 5, paired passive present -> ELIGIBLE
        upgradeSystem.upgradeItem(evo.passiveId);
        expect(upgradeSystem.isEvolutionEligible(evo.weaponId)).toBe(true);

        // Condition E: once evolved -> NOT eligible again
        upgradeSystem.evolveWeapon(evo.weaponId, evo.id);
        expect(upgradeSystem.isEvolutionEligible(evo.weaponId)).toBe(false);
      }
    });

    it('empirically verifies evolution card is reliably offered when eligible', () => {
      // Reproducing the setup from UpgradeSystem.test.ts:135
      // 1 weapon at Rank 5, 1 passive at Rank 1.
      upgradeSystem.reset();
      for (let i = 0; i < 5; i++) upgradeSystem.upgradeItem('arcane_scythe');
      upgradeSystem.upgradeItem('blood_chalice');

      expect(upgradeSystem.isEvolutionEligible('arcane_scythe')).toBe(true);

      let missedCount = 0;
      const N = 1000;
      for (let roll = 0; roll < N; roll++) {
        const cards = upgradeSystem.generateUpgradeCards(4);
        const hasEvo = cards.some((c) => c.type === UpgradeType.WEAPON_EVOLUTION);
        if (!hasEvo) missedCount++;
      }

      const missRate = missedCount / N;
      // Remediated: miss rate is 0% (guaranteed evolution card on draw)
      expect(missRate).toBe(0);
    });
  });

  describe('Objective 3: Wave Director Perimeter Spawning Math & Boundary Analysis', () => {
    it('verifies 100+ interior camera spawns lie strictly outside 960x540 viewport (M >= 80px)', () => {
      const interiorCameras = [
        { x: 0, y: 0 },
        { x: 200, y: 300 },
        { x: -500, y: 200 },
        { x: 400, y: -300 },
      ];

      for (const cam of interiorCameras) {
        for (let i = 0; i < 150; i++) {
          const pt = waveDirector.getPerimeterPoint(cam.x, cam.y);

          // Calculate orthogonal distance M outside [cam.x, cam.x + 960] x [cam.y, cam.y + 540]
          const dx = Math.max(cam.x - pt.x, 0, pt.x - (cam.x + 960));
          const dy = Math.max(cam.y - pt.y, 0, pt.y - (cam.y + 540));
          const margin = Math.hypot(dx, dy);

          // Must be strictly outside viewport with M >= 80px
          expect(margin).toBeGreaterThanOrEqual(80);
        }
      }
    });

    it('empirically verifies 0 on-screen boundary clamping spawns when camera is at arena edge', () => {
      // When camera is at the east boundary: camX = 1040 (viewport [1040, 2000])
      // Arena maxX is 2000. Perimeter spawns must never clamp inside camera viewport.
      const camX = 1040;
      const camY = 0;

      let onScreenSpawns = 0;
      const N = 200;
      for (let i = 0; i < N; i++) {
        const pt = waveDirector.getPerimeterPoint(camX, camY);
        const insideX = pt.x >= camX && pt.x <= camX + 960;
        const insideY = pt.y >= camY && pt.y <= camY + 540;
        if (insideX && insideY) {
          onScreenSpawns++;
        }
      }

      // Remediated: 0 on-screen spawns
      expect(onScreenSpawns).toBe(0);
    });
  });

  describe('Objective 4: Wave Director Timeline Escalation & Milestones', () => {
    it('verifies 4-phase timeline progression (0-30s, 30-60s, 60-120s, 120s+)', () => {
      expect(waveDirector.getCurrentPhase(0).id).toBe(WavePhaseId.AWAKENING);
      expect(waveDirector.getCurrentPhase(29.99).id).toBe(WavePhaseId.AWAKENING);
      expect(waveDirector.getCurrentPhase(30.0).id).toBe(WavePhaseId.THE_SWARM);
      expect(waveDirector.getCurrentPhase(59.99).id).toBe(WavePhaseId.THE_SWARM);
      expect(waveDirector.getCurrentPhase(60.0).id).toBe(WavePhaseId.NIGHTFALL);
      expect(waveDirector.getCurrentPhase(119.99).id).toBe(WavePhaseId.NIGHTFALL);
      expect(waveDirector.getCurrentPhase(120.0).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
      expect(waveDirector.getCurrentPhase(360.0).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
    });

    it('verifies difficulty escalation formulas and clamp ceilings', () => {
      // HP multiplier = 1.0 + (t/60) * 0.30
      expect(waveDirector.getHPMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getHPMultiplier(60)).toBeCloseTo(1.30, 4);
      expect(waveDirector.getHPMultiplier(180)).toBeCloseTo(1.90, 4);

      // Speed multiplier = min(1.40, 1.0 + (t/120) * 0.15)
      expect(waveDirector.getSpeedMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getSpeedMultiplier(120)).toBeCloseTo(1.15, 4);
      expect(waveDirector.getSpeedMultiplier(600)).toBeCloseTo(1.40, 4);

      // Spawn interval = max(0.50, 2.20 - (t/60) * 0.55)
      expect(waveDirector.getSpawnInterval(0)).toBeCloseTo(2.20, 4);
      expect(waveDirector.getSpawnInterval(60)).toBeCloseTo(1.65, 4);
      expect(waveDirector.getSpawnInterval(300)).toBeCloseTo(0.50, 4);

      // Cluster size = min(30, 4 + floor(t/8))
      expect(waveDirector.getClusterSize(0)).toBe(4);
      expect(waveDirector.getClusterSize(32)).toBe(8);
      expect(waveDirector.getClusterSize(300)).toBe(30);

      // Active cap = min(1200, 150 + floor(t/10) * 80)
      expect(waveDirector.getMaxActiveCap(0)).toBe(150);
      expect(waveDirector.getMaxActiveCap(50)).toBe(550);
      expect(waveDirector.getMaxActiveCap(200)).toBe(1200);
    });

    it('verifies all scripted tactical milestone events fire sequentially up to 240s', () => {
      const firedIds: string[] = [];
      const director = new WaveDirector(hordeManager, {
        onWaveEvent: (e) => firedIds.push(e.id),
      });

      for (let s = 1; s <= 245; s++) {
        director.update(1.0, 0, 0, 0, 0);
      }

      expect(firedIds).toEqual([
        'pincer_30',
        'ring_60',
        'quad_90',
        'boss_120',
        'boss_180',
        'boss_240',
      ]);
    });
  });
});
