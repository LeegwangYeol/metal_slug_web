/**
 * challenger_cute_m2_2_stress.test.ts
 *
 * Empirical Adversarial Stress Suite for Milestone M2:
 * "Sugar Pop Blossom: Cozy Star Arena"
 *
 * Scope:
 * 1. PetCompanion spring damping stability across extreme delta-t values (dt = 0.001s to 10.0s, negative, zero, etc.)
 *    verifying numerical coordinates, bound stability, and spring convergence.
 * 2. Candy vacuuming algorithms with 100+ candy pickups scattered across the arena,
 *    testing collection distance boundaries, array mutation integrity, and performance.
 * 3. 3 Blossom Altars purification logic and 3-card rogue-lite perk selection under rapid keyboard input,
 *    testing boundary radii, multi-altar overlap, bloom idempotency, modal race conditions, and keyboard spam.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PetCompanion } from '../../src/core/cute/PetCompanion';
import { BubbleManager } from '../../src/core/cute/BubbleManager';
import { ArenaPurificationManager } from '../../src/core/cute/ArenaPurificationManager';
import { SweetPerkManager, PERK_POOL } from '../../src/core/cute/SweetPerkManager';
import { CuteArenaCoordinator } from '../../src/core/cute/CuteArenaCoordinator';
import { KeyboardController } from '../../src/input/KeyboardController';

describe('CHALLENGER_M2_2: Empirical Stress Test Suite (Pet Companion, Altars & Perks)', () => {
  // =========================================================================
  // TASK 1: PetCompanion Spring Damping Stability Across Extreme Delta-T
  // =========================================================================
  describe('Task 1: PetCompanion Spring Damping Stability Under Extreme Delta-T Sweeps', () => {
    let pet: PetCompanion;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      pet = new PetCompanion(100, 200);
      bubbleManager = new BubbleManager();
    });

    it('EMPIRICAL 1A: Extreme Delta-T logarithmic sweep (1e-6s to 10.0s) produces 0 NaN and 0 Infinite coordinates', () => {
      const player = { x: 300, y: 200, facing: 1 as const, isAlive: true };
      const testDts = [
        1e-6,
        1e-5,
        1e-4,
        0.001,
        0.005,
        0.016667,
        0.033333,
        0.05,
        0.1,
        0.25,
        0.5,
        1.0,
        2.0,
        5.0,
        10.0,
      ];

      for (const dt of testDts) {
        // Reset pet to test starting position
        pet.x = 100;
        pet.y = 200;
        pet.vx = 0;
        pet.vy = 0;

        // Execute update with target dt
        pet.update(dt, player, bubbleManager, []);

        // Assert strictly finite numerical coordinates
        expect(Number.isFinite(pet.x), `pet.x must be finite at dt=${dt}`).toBe(true);
        expect(Number.isNaN(pet.x), `pet.x must not be NaN at dt=${dt}`).toBe(false);
        expect(Number.isFinite(pet.y), `pet.y must be finite at dt=${dt}`).toBe(true);
        expect(Number.isNaN(pet.y), `pet.y must not be NaN at dt=${dt}`).toBe(false);
        expect(Number.isFinite(pet.vx), `pet.vx must be finite at dt=${dt}`).toBe(true);
        expect(Number.isNaN(pet.vx), `pet.vx must not be NaN at dt=${dt}`).toBe(false);
        expect(Number.isFinite(pet.vy), `pet.vy must be finite at dt=${dt}`).toBe(true);
        expect(Number.isNaN(pet.vy), `pet.vy must not be NaN at dt=${dt}`).toBe(false);

        // Pet should not explode to astronomical coordinates
        expect(Math.abs(pet.x)).toBeLessThan(10000);
        expect(Math.abs(pet.y)).toBeLessThan(10000);
      }
    });

    it('EMPIRICAL 1B: Pathological delta-t values (dt = 0, dt < 0) do not cause coordinate drift', () => {
      const player = { x: 300, y: 200, facing: 1 as const, isAlive: true };
      const initialX = pet.x;
      const initialY = pet.y;

      // dt = 0
      pet.update(0, player, bubbleManager, []);
      expect(pet.x).toBe(initialX);
      expect(pet.y).toBe(initialY);
      expect(pet.vx).toBe(0);
      expect(pet.vy).toBe(0);

      // dt = -0.5 (negative time step)
      pet.update(-0.5, player, bubbleManager, []);
      expect(Number.isFinite(pet.x)).toBe(true);
      expect(Number.isFinite(pet.y)).toBe(true);
      expect(pet.x).toBe(initialX);
      expect(pet.y).toBe(initialY);
    });

    it('EMPIRICAL 1C: Rapidly fluctuating delta-t over 1,000 steps converges stably to player anchor', () => {
      const player = { x: 450, y: 210, facing: 1 as const, isAlive: true };
      pet.x = 0;
      pet.y = 0;

      // Simulate 1,000 steps with pseudo-random violently oscillating delta-t (0.001 to 3.0s)
      for (let i = 0; i < 1000; i++) {
        const dt = (i % 7 === 0) ? (0.5 + (i % 5) * 0.5) : (0.005 + (i % 10) * 0.003);
        pet.update(dt, player, bubbleManager, []);

        expect(Number.isFinite(pet.x)).toBe(true);
        expect(Number.isFinite(pet.y)).toBe(true);
        expect(Number.isFinite(pet.vx)).toBe(true);
        expect(Number.isFinite(pet.vy)).toBe(true);
      }

      // Target anchor is: player.x - player.facing * 42 = 450 - 42 = 408
      expect(pet.x).toBeCloseTo(408, 0);
      expect(pet.y).toBeGreaterThan(170);
      expect(pet.y).toBeLessThan(190);
    });

    it('EMPIRICAL 1D: Massive player teleportation (+50,000px) with huge dt (10.0s) does not diverge', () => {
      const player = { x: 50000, y: 200, facing: 1 as const, isAlive: true };
      pet.x = 100;
      pet.y = 200;

      // Single massive 10.0s lag spike update
      pet.update(10.0, player, bubbleManager, []);

      expect(Number.isFinite(pet.x)).toBe(true);
      expect(Number.isFinite(pet.y)).toBe(true);
      expect(Number.isFinite(pet.vx)).toBe(true);
      expect(Number.isFinite(pet.vy)).toBe(true);

      // Over 10.0 seconds of sub-stepped spring physics (600 steps), Mochi reaches teleported player
      expect(pet.x).toBeGreaterThan(49000);
      expect(pet.x).toBeLessThan(51000);
    });

    it('EMPIRICAL 1E: Pet speedMultiplier perk (PET_PEP) remains numerically stable at dt=5.0s', () => {
      pet.modifiers.speedMultiplier = 2.5;
      const player = { x: 200, y: 200, facing: 1 as const, isAlive: true };

      pet.update(5.0, player, bubbleManager, []);

      expect(Number.isFinite(pet.x)).toBe(true);
      expect(Number.isFinite(pet.y)).toBe(true);
      expect(Number.isFinite(pet.vx)).toBe(true);
      expect(Number.isFinite(pet.vy)).toBe(true);
    });

    it('EMPIRICAL 1F (VULNERABILITY PROOF): dt=NaN corrupts pet.time and causes permanent NaN coordinates in subsequent frames', () => {
      const player = { x: 200, y: 200, facing: 1 as const, isAlive: true };

      // Pass NaN as dt
      pet.update(NaN, player, bubbleManager, []);

      // Now pass normal 60Hz dt (1/60s)
      pet.update(1 / 60, player, bubbleManager, []);

      // After remediation: dt=NaN is rejected, pet.time and pet.y remain strictly finite!
      const isYCorrupted = Number.isNaN(pet.y);
      expect(isYCorrupted, 'dt=NaN must NOT poison pet.y').toBe(false);
      expect(Number.isFinite(pet.y)).toBe(true);
    });
  });

  // =========================================================================
  // TASK 2: Candy Vacuuming Algorithms with 100+ Candy Pickups
  // =========================================================================
  describe('Task 2: Candy Vacuuming Algorithm with 100+ Candy Pickups Across Arena', () => {
    let pet: PetCompanion;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      pet = new PetCompanion(480, 220); // Center of arena
      bubbleManager = new BubbleManager();
    });

    it('EMPIRICAL 2A: 150 pickups scattered across the arena (all > 25px away): exactly those within vacuum radius are attracted', () => {
      const player = { x: pet.x, y: pet.y, facing: 1 as const, isAlive: true };
      const vacuumRadius = pet.modifiers.vacuumRadius; // 160px

      // Spawn 150 pickups between 30px and 450px distance so none are immediately collected (<22px)
      let countInsideRadius = 0;
      let countOutsideRadius = 0;

      for (let i = 0; i < 150; i++) {
        const angle = (i / 150) * Math.PI * 2 * 7;
        const dist = 30 + (i / 150) * 420; // 30px to 450px
        const px = pet.x + Math.cos(angle) * dist;
        const py = pet.y + Math.sin(angle) * dist;

        const isInside = dist <= vacuumRadius;
        if (isInside) countInsideRadius++;
        else countOutsideRadius++;

        bubbleManager.pickups.push({
          id: `pickup_scatter_${i}`,
          type: 'candy',
          x: px,
          y: py,
          vx: 0,
          vy: 0,
          value: 50,
          feverCharge: 0.05,
          age: 0,
          lifespan: 12.0,
          isAlive: true,
        });
      }

      expect(bubbleManager.pickups.length).toBe(150);
      expect(countInsideRadius).toBeGreaterThan(30);
      expect(countOutsideRadius).toBeGreaterThan(50);

      // Execute 1 frame update of pet companion
      pet.update(0.016, player, bubbleManager, []);

      // Verify velocity direction of all pickups
      let attractedCount = 0;
      for (const p of bubbleManager.pickups) {
        const dx = pet.x - p.x;
        const dy = pet.y - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= vacuumRadius * vacuumRadius) {
          attractedCount++;
          const dotProduct = p.vx * dx + p.vy * dy;
          expect(dotProduct, `Pickup ${p.id} must be pulled towards pet`).toBeGreaterThan(0);
        } else {
          expect(p.vx).toBe(0);
          expect(p.vy).toBe(0);
        }
      }

      expect(attractedCount).toBe(countInsideRadius);
      expect(pet.state).toBe('fetch');
    });

    it('EMPIRICAL 2B (BUG PROOF): In-place array splicing during forward iteration skips adjacent pickups in a single frame', () => {
      const player = { x: pet.x, y: pet.y, facing: 1 as const, isAlive: true };

      // Place 4 pickups right next to Mochi (dist < 22px)
      for (let i = 0; i < 4; i++) {
        bubbleManager.pickups.push({
          id: `candy_adjacent_${i}`,
          type: 'candy',
          x: pet.x + 5,
          y: pet.y + 5,
          vx: 0,
          vy: 0,
          value: 100,
          feverCharge: 0.05,
          age: 0,
          lifespan: 12.0,
          isAlive: true,
        });
      }

      expect(bubbleManager.pickups.length).toBe(4);

      // In a single update frame:
      pet.update(0.016, player, bubbleManager, []);

      // After remediation with staged collection: all 4 co-located pickups are collected in Frame 1!
      expect(bubbleManager.pickups.length).toBe(0);
    });

    it('EMPIRICAL 2C: STAR_MAGNET perk doubles vacuum radius from 160px to 320px with 200 pickups', () => {
      const player = { x: pet.x, y: pet.y, facing: 1 as const, isAlive: true };
      pet.modifiers.vacuumRadius = 320.0;

      // Spawn pickups at distance 240px (outside normal 160px, inside 320px)
      for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        bubbleManager.pickups.push({
          id: `candy_mid_${i}`,
          type: 'star',
          x: pet.x + Math.cos(angle) * 240,
          y: pet.y + Math.sin(angle) * 240,
          vx: 0,
          vy: 0,
          value: 200,
          feverCharge: 0.1,
          age: 0,
          lifespan: 12.0,
          isAlive: true,
        });
      }

      pet.update(0.016, player, bubbleManager, []);

      for (const p of bubbleManager.pickups) {
        const dx = pet.x - p.x;
        const dy = pet.y - p.y;
        const dotProduct = p.vx * dx + p.vy * dy;
        expect(dotProduct).toBeGreaterThan(0);
      }
    });

    it('EMPIRICAL 2D: Performance benchmark: 500 active pickups update within < 10ms', () => {
      const player = { x: pet.x, y: pet.y, facing: 1 as const, isAlive: true };

      // Spawn 500 pickups
      for (let i = 0; i < 500; i++) {
        bubbleManager.pickups.push({
          id: `perf_candy_${i}`,
          type: 'candy',
          x: Math.random() * 960,
          y: Math.random() * 540,
          vx: 0,
          vy: 0,
          value: 50,
          feverCharge: 0.05,
          age: 0,
          lifespan: 12.0,
          isAlive: true,
        });
      }

      const start = performance.now();
      for (let frame = 0; frame < 10; frame++) {
        pet.update(1 / 60, player, bubbleManager, []);
        bubbleManager.update(1 / 60, player);
      }
      const elapsed = performance.now() - start;

      // 10 frames of 500 pickups should easily execute in < 100ms (< 10ms/frame)
      expect(elapsed).toBeLessThan(100);
    });
  });

  // =========================================================================
  // TASK 3: 3 Blossom Altars Purification Logic & 3-Card Rogue-Lite Perks
  // =========================================================================
  describe('Task 3: 3 Blossom Altars Purification & 3-Card Perk Selection Stress', () => {
    let altarManager: ArenaPurificationManager;
    let perkManager: SweetPerkManager;
    let coordinator: CuteArenaCoordinator;
    let keyboard: KeyboardController;

    beforeEach(() => {
      altarManager = new ArenaPurificationManager();
      perkManager = new SweetPerkManager();
      coordinator = new CuteArenaCoordinator();
      keyboard = new KeyboardController();
    });

    it('EMPIRICAL 3A: Distance boundary precision: bubble at 179px purifies altar, bubble at 181px does not', () => {
      const altar = altarManager.altars[0]; // Lotus at (200, 220), radius 180px

      // Bubble pop at 181px away (x = 200 + 181, y = 220)
      altarManager.onBubblePopped(altar.x + 181, altar.y, 1);
      expect(altar.purificationProgress).toBe(0.0);

      // Bubble pop at 179px away (x = 200 + 179, y = 220)
      altarManager.onBubblePopped(altar.x + 179, altar.y, 1);
      expect(altar.purificationProgress).toBeGreaterThan(0.14);
    });

    it('EMPIRICAL 3B: Overlapping influence boundary: single bubble pop at (350, 185) purifies BOTH Altar 0 and Altar 1', () => {
      const altar0 = altarManager.altars[0]; // (200, 220)
      const altar1 = altarManager.altars[1]; // (500, 150)

      altarManager.onBubblePopped(350, 185, 2);

      expect(altar0.purificationProgress).toBeGreaterThan(0);
      expect(altar1.purificationProgress).toBeGreaterThan(0);
      expect(altarManager.altars[2].purificationProgress).toBe(0);
    });

    it('EMPIRICAL 3C: Bloom callback idempotency: onAltarBloomed fires exactly once per altar even under continuous pops', () => {
      let lotusBloomCount = 0;
      altarManager.onAltarBloomed = (altar) => {
        if (altar.id === 'altar_lotus') lotusBloomCount++;
      };

      const altar = altarManager.altars[0];

      // Pop 50 bubbles directly at the altar
      for (let i = 0; i < 50; i++) {
        altarManager.onBubblePopped(altar.x, altar.y, 3);
      }

      expect(altar.isBloomed).toBe(true);
      expect(altar.purificationProgress).toBe(1.0);
      expect(lotusBloomCount).toBe(1);
    });

    it('EMPIRICAL 3D: All 3 altars purified triggers onGardenFullyBloomed exactly once', () => {
      let gardenBloomCount = 0;
      altarManager.onGardenFullyBloomed = () => {
        gardenBloomCount++;
      };

      // Purify all 3 altars
      for (const altar of altarManager.altars) {
        for (let i = 0; i < 10; i++) {
          altarManager.onBubblePopped(altar.x, altar.y, 2);
        }
        expect(altar.isBloomed).toBe(true);
      }

      expect(altarManager.isGardenFullyBloomed()).toBe(true);
      expect(gardenBloomCount).toBe(1);

      // Additional pops should not re-trigger
      altarManager.onBubblePopped(altarManager.altars[0].x, altarManager.altars[0].y, 1);
      expect(gardenBloomCount).toBe(1);
    });

    it('EMPIRICAL 3E: 3-Card Rogue-Lite Perk Draw uniqueness over 200 random draws', () => {
      for (let trial = 0; trial < 200; trial++) {
        const drawn = perkManager.triggerPerkSelection();
        expect(drawn.length).toBe(3);

        const cardIds = new Set(drawn.map((c) => c.id));
        expect(cardIds.size, `Trial ${trial} must contain 3 distinct card choices`).toBe(3);

        for (const card of drawn) {
          expect(PERK_POOL.some((p) => p.id === card.id)).toBe(true);
        }
      }
    });

    it('EMPIRICAL 3F: Rapid keyboard input spam (100 rapid keypresses) selects exactly 1 perk and closes modal', () => {
      coordinator.triggerPerkSelection();
      expect(coordinator.state).toBe('PERK_SELECTION');
      expect(coordinator.perks.isModalActive).toBe(true);
      expect(coordinator.perks.availableCards.length).toBe(3);

      const targetCard = coordinator.perks.availableCards[0];
      const initialLevel = coordinator.perks.getPerkLevel(targetCard.id);

      // Simulate player mashing '1', '2', '3' keys 100 times in rapid succession
      let successfulSelections = 0;
      for (let press = 0; press < 100; press++) {
        const choiceIndex = press % 3;
        const result = coordinator.choosePerk(choiceIndex);
        if (result) {
          successfulSelections++;
        }
      }

      expect(successfulSelections).toBe(1);
      expect(coordinator.perks.isModalActive).toBe(false);
      expect(coordinator.perks.availableCards.length).toBe(0);
      expect(coordinator.perks.getPerkLevel(targetCard.id)).toBe(initialLevel + 1);
      expect(coordinator.state).toBe('WAVE_ACTIVE');
    });

    it('EMPIRICAL 3G: Out-of-bounds integer perk indices (-1, 3, 99) return false without corrupting modal state', () => {
      coordinator.triggerPerkSelection();
      expect(coordinator.perks.isModalActive).toBe(true);

      expect(coordinator.choosePerk(-1)).toBe(false);
      expect(coordinator.choosePerk(3)).toBe(false);
      expect(coordinator.choosePerk(999)).toBe(false);

      // Modal should still remain active waiting for valid input
      expect(coordinator.perks.isModalActive).toBe(true);
      expect(coordinator.perks.availableCards.length).toBe(3);

      // Now choose valid card
      expect(coordinator.choosePerk(1)).toBe(true);
      expect(coordinator.perks.isModalActive).toBe(false);
    });

    it('EMPIRICAL 3H (BUG PROOF): selectCard(NaN) bypasses index bounds check and throws TypeError', () => {
      perkManager.triggerPerkSelection();
      expect(perkManager.isModalActive).toBe(true);

      // In JS: (NaN < 0) is false, (NaN >= 3) is false.
      // Therefore `if (!this.isModalActive || index < 0 || index >= this.availableCards.length)` is bypassed!
      // This causes `this.availableCards[NaN]` to yield undefined, throwing TypeError on card.id.
      let caughtError: any = null;
      let result: any = null;
      try {
        result = perkManager.selectCard(NaN);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeNull();
      expect(result).toBeNull();
      expect(perkManager.isModalActive).toBe(true);
    });

    it('EMPIRICAL 3I: Repeated perk level stacking across 6 successive selections modifies stats correctly', () => {
      for (let i = 0; i < 3; i++) {
        coordinator.triggerPerkSelection();
        coordinator.perks.availableCards[0] = PERK_POOL.find((p) => p.id === 'PET_PEP')!;
        coordinator.choosePerk(0);
      }

      expect(coordinator.perks.getPerkLevel('PET_PEP')).toBe(3);
      expect(coordinator.pet.modifiers.speedMultiplier).toBe(1.4);
      expect(coordinator.pet.modifiers.fireCooldownMultiplier).toBe(0.55);

      for (let i = 0; i < 3; i++) {
        coordinator.triggerPerkSelection();
        coordinator.perks.availableCards[0] = PERK_POOL.find((p) => p.id === 'STAR_MAGNET')!;
        coordinator.choosePerk(0);
      }

      expect(coordinator.perks.getPerkLevel('STAR_MAGNET')).toBe(3);
      expect(coordinator.pet.modifiers.vacuumRadius).toBe(320.0);
    });

    it('EMPIRICAL 3J: KeyboardController edge-detection and consumePerkChoice contract under rapid simulated events', () => {
      // Simulate rapid keydown events via handleKeyDown directly
      (keyboard as any).handleKeyDown({ code: 'Digit1', key: '1', repeat: false });
      expect(keyboard.perkChoiceJustPressed).toBe(0);

      // Consuming returns 0 and clears latch
      const consumed = keyboard.consumePerkChoice();
      expect(consumed).toBe(0);
      expect(keyboard.perkChoiceJustPressed).toBeNull();

      // Subsequent consumption without new press returns null
      expect(keyboard.consumePerkChoice()).toBeNull();

      (keyboard as any).handleKeyDown({ code: 'Digit2', key: '2', repeat: false });
      expect(keyboard.consumePerkChoice()).toBe(1);

      (keyboard as any).handleKeyDown({ code: 'Digit3', key: '3', repeat: false });
      expect(keyboard.consumePerkChoice()).toBe(2);
    });
  });
});
