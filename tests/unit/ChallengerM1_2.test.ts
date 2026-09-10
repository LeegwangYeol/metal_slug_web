import { describe, it, expect, beforeEach } from 'vitest';
import { Player, PlayerInputSnapshot } from '../../src/core/entities/Player';
import { PlayerProgression, LevelUpEvent } from '../../src/core/progression/PlayerProgression';
import { PlayerStatsManager, DEFAULT_PLAYER_STATS } from '../../src/core/player/PlayerStats';
import { LootManager, LootDropType } from '../../src/core/systems/LootManager';

describe('Empirical Challenge Suite M1-2: Kinematics, Progression Math, and Loot Magnetism', () => {
  describe('Challenge 1: 360-Degree Player Kinematics & Diagonal Normalization', () => {
    let player: Player;

    beforeEach(() => {
      player = new Player(0, 0, {
        moveSpeed: 1.0,
      });
      player.arenaBounds = { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000 };
    });

    it('empirically verifies player does NOT move 1.414x faster diagonally', () => {
      const dt = 1 / 60;
      const baseMaxSpeed = Player.BASE_MOVE_SPEED; // 200 px/s

      // 1. Cardinal Right
      const rightPlayer = new Player(0, 0, { moveSpeed: 1.0 });
      for (let i = 0; i < 60; i++) {
        rightPlayer.handleInput({ up: false, down: false, left: false, right: true }, dt);
      }
      const cardinalSpeed = Math.hypot(rightPlayer.velocity.x, rightPlayer.velocity.y);
      expect(cardinalSpeed).toBeCloseTo(baseMaxSpeed, 2);

      // 2. Diagonal Up-Right
      const diagPlayer = new Player(0, 0, { moveSpeed: 1.0 });
      for (let i = 0; i < 60; i++) {
        diagPlayer.handleInput({ up: true, down: false, left: false, right: true }, dt);
      }
      const diagSpeed = Math.hypot(diagPlayer.velocity.x, diagPlayer.velocity.y);

      // CRITICAL ASSERTION: Diagonal speed must equal cardinal maxSpeed, NOT 1.414 * maxSpeed
      expect(diagSpeed).toBeCloseTo(cardinalSpeed, 2);
      expect(diagSpeed).not.toBeCloseTo(cardinalSpeed * Math.SQRT2, 0);

      // Each component must equal baseMaxSpeed / sqrt(2)
      const expectedComponent = baseMaxSpeed / Math.SQRT2;
      expect(Math.abs(diagPlayer.velocity.x)).toBeCloseTo(expectedComponent, 2);
      expect(Math.abs(diagPlayer.velocity.y)).toBeCloseTo(expectedComponent, 2);
    });

    it('empirically verifies all 4 diagonal quadrants normalize to exact vector magnitude', () => {
      const dt = 1 / 60;
      const baseMaxSpeed = 200;
      const quadrants: { name: string; input: PlayerInputSnapshot; signX: number; signY: number }[] = [
        { name: 'Up-Right', input: { up: true, down: false, left: false, right: true }, signX: 1, signY: -1 },
        { name: 'Up-Left', input: { up: true, down: false, left: true, right: false }, signX: -1, signY: -1 },
        { name: 'Down-Right', input: { up: false, down: true, left: false, right: true }, signX: 1, signY: 1 },
        { name: 'Down-Left', input: { up: false, down: true, left: true, right: false }, signX: -1, signY: 1 },
      ];

      for (const q of quadrants) {
        const p = new Player(0, 0, { moveSpeed: 1.0 });
        for (let i = 0; i < 60; i++) {
          p.handleInput(q.input, dt);
        }
        const speed = Math.hypot(p.velocity.x, p.velocity.y);
        expect(speed, `${q.name} speed magnitude`).toBeCloseTo(baseMaxSpeed, 2);
        expect(Math.sign(p.velocity.x), `${q.name} signX`).toBe(q.signX);
        expect(Math.sign(p.velocity.y), `${q.name} signY`).toBe(q.signY);
      }
    });

    it('handles conflicting opposing inputs by cancelling motion completely', () => {
      const dt = 1 / 60;

      // Up + Down opposing
      player.handleInput({ up: true, down: true, left: false, right: false }, dt);
      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);

      // Left + Right opposing
      player.handleInput({ up: false, down: false, left: true, right: true }, dt);
      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);

      // All 4 keys simultaneously
      player.handleInput({ up: true, down: true, left: true, right: true }, dt);
      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);
    });

    it('empirically verifies linear acceleration and friction timing', () => {
      const dt = 1 / 60;
      const targetSpeed = 200; // px/s
      // Acceleration = 1800 px/s^2 -> Time to reach 200 px/s = 200 / 1800 = 0.1111s (~6.67 frames)
      const p = new Player(0, 0, { moveSpeed: 1.0 });

      // Frame 1
      p.handleInput({ up: false, down: false, left: false, right: true }, dt);
      expect(p.velocity.x).toBeCloseTo(1800 * dt, 2); // 30 px/s

      // After 7 frames (0.1167s), must have reached max speed
      for (let i = 1; i < 7; i++) {
        p.handleInput({ up: false, down: false, left: false, right: true }, dt);
      }
      expect(p.velocity.x).toBe(targetSpeed);

      // Deceleration = 2400 px/s^2 -> Time to stop from 200 px/s = 200 / 2400 = 0.0833s (5 frames)
      p.handleInput({ up: false, down: false, left: false, right: false }, dt);
      expect(p.velocity.x).toBeCloseTo(200 - 2400 * dt, 2); // 160 px/s

      for (let i = 1; i < 5; i++) {
        p.handleInput({ up: false, down: false, left: false, right: false }, dt);
      }
      expect(p.velocity.x).toBe(0);
    });
  });

  describe('Challenge 2: XP Curve Mathematical Precision (Levels 1 to 100)', () => {
    it('empirically asserts exact mathematical curve for every level from 1 through 100', () => {
      const baseXP = 10;
      const progression = new PlayerProgression(baseXP);

      for (let level = 1; level <= 100; level++) {
        const expected = Math.floor(baseXP * Math.pow(level, 1.5));
        const actual = progression.calculateXPRequired(level);

        expect(actual, `XP required for level ${level}`).toBe(expected);
      }
    });

    it('empirically validates monotonicity and rate of increase across 100 levels', () => {
      const progression = new PlayerProgression(10);
      let previousReq = progression.calculateXPRequired(1);

      for (let level = 2; level <= 100; level++) {
        const currentReq = progression.calculateXPRequired(level);
        expect(currentReq).toBeGreaterThan(previousReq);

        // Derivative check: rate of change increases because exponent is 1.5 > 1.0
        if (level >= 3) {
          const prevDelta = previousReq - progression.calculateXPRequired(level - 2);
          const currentDelta = currentReq - previousReq;
          expect(currentDelta).toBeGreaterThanOrEqual(prevDelta);
        }

        previousReq = currentReq;
      }
    });

    it('matches exact precomputed milestone thresholds', () => {
      const progression = new PlayerProgression(10);
      expect(progression.calculateXPRequired(1)).toBe(10);
      expect(progression.calculateXPRequired(10)).toBe(316);
      expect(progression.calculateXPRequired(25)).toBe(1250);
      expect(progression.calculateXPRequired(50)).toBe(3535);
      expect(progression.calculateXPRequired(75)).toBe(6495);
      expect(progression.calculateXPRequired(100)).toBe(10000);
    });
  });

  describe('Challenge 3: Multi-Level Burst XP Acquisition (+100,000 XP)', () => {
    it('empirically stress-tests +100,000 XP single burst and matches exact mathematical oracle', () => {
      const baseXP = 10;
      const progression = new PlayerProgression(baseXP);

      // Mathematical oracle: step through levels manually
      let oracleLevel = 1;
      let remainingXP = 100000;
      const levelBreakpoints: { level: number; cost: number; cumulativeCost: number }[] = [];
      let cumulativeCost = 0;

      while (true) {
        const req = Math.floor(baseXP * Math.pow(oracleLevel, 1.5));
        if (remainingXP >= req) {
          remainingXP -= req;
          cumulativeCost += req;
          levelBreakpoints.push({ level: oracleLevel, cost: req, cumulativeCost });
          oracleLevel++;
        } else {
          break;
        }
      }

      const expectedNewLevel = oracleLevel;
      const expectedSurplus = remainingXP;

      // Track events emitted
      const events: LevelUpEvent[] = [];
      progression.onLevelUp((e) => events.push(e));

      // Execute single massive burst
      const levelsGained = progression.addXP(100000);

      // Assertions
      expect(progression.getLevel()).toBe(expectedNewLevel);
      expect(levelsGained).toBe(expectedNewLevel - 1);
      expect(progression.getCurrentXP()).toBe(expectedSurplus);
      expect(progression.getTotalXP()).toBe(100000);

      // ZERO XP LOSS INVARIANT: cumulative spent + current surplus === total added
      expect(cumulativeCost + progression.getCurrentXP()).toBe(100000);

      // Assert all event sequence transitions
      expect(events.length).toBe(levelsGained);
      for (let i = 0; i < events.length; i++) {
        expect(events[i].newLevel).toBe(i + 2);
        expect(events[i].previousLevel).toBe(i + 1);
        expect(events[i].totalXPEarned).toBe(100000);
      }
      expect(events[events.length - 1].surplusXP).toBe(expectedSurplus);
    });

    it('empirically asserts exact consistency across multiple sequential bursts (+100k, +50k, +250k)', () => {
      const progression = new PlayerProgression(10);
      const bursts = [100000, 50000, 250000];
      let totalAdded = 0;

      for (const burst of bursts) {
        totalAdded += burst;
        progression.addXP(burst);

        // Compute oracle for totalAdded from Level 1
        let oracleLvl = 1;
        let rem = totalAdded;
        let cum = 0;
        while (true) {
          const req = Math.floor(10 * Math.pow(oracleLvl, 1.5));
          if (rem >= req) {
            rem -= req;
            cum += req;
            oracleLvl++;
          } else {
            break;
          }
        }

        expect(progression.getLevel()).toBe(oracleLvl);
        expect(progression.getCurrentXP()).toBe(rem);
        expect(progression.getTotalXP()).toBe(totalAdded);
        expect(cum + progression.getCurrentXP()).toBe(totalAdded);
      }
    });

    it('verifies Player entity properly dispatches eventBus notification on +100,000 XP burst', () => {
      const player = new Player(0, 0);
      const emittedEvents: any[] = [];
      const mockEngine = {
        eventBus: {
          emit: (event: string, data: any) => {
            if (event === 'player_levelup') emittedEvents.push(data);
          },
        },
      };

      const result = player.gainXP(100000, mockEngine);
      expect(result.newLevel).toBe(player.level);
      expect(emittedEvents.length).toBe(1); // Player emits the final summary event
      expect(emittedEvents[0].newLevel).toBe(player.level);
      expect(emittedEvents[0].surplusXP).toBe(player.currentXP);
      expect(emittedEvents[0].totalXPEarned).toBe(100000);
    });
  });

  describe('Challenge 4: Cooldown Reduction (CDR) Hard-Clamp at 0.50 Ceiling', () => {
    it('empirically clamps CDR at 0.50 when multiple stacked relics sum to 0.80+', () => {
      const statsManager = new PlayerStatsManager();

      // Relic 1: +25% CDR
      statsManager.addPassiveModifier({
        id: 'chrono_hourglass',
        name: 'Chrono Hourglass',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.25,
      });
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.25);

      // Relic 2: +20% CDR (Total 45%)
      statsManager.addPassiveModifier({
        id: 'temporal_sigil',
        name: 'Temporal Sigil',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.20,
      });
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.45);

      // Relic 3: +35% CDR (Total would be 80% without clamp)
      statsManager.addPassiveModifier({
        id: 'abyssal_pendulum',
        name: 'Abyssal Pendulum',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.35,
      });

      // MUST BE HARD-CLAMPED AT 0.50
      const effectiveStats = statsManager.getEffectiveStats();
      expect(effectiveStats.cooldownReduction).toBe(0.50);

      // Relic 4: Add another +50% CDR (Total would be 1.30)
      statsManager.addPassiveModifier({
        id: 'god_tier_chrono',
        name: 'Omnipresent Core',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.50,
      });
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.50);
    });

    it('empirically clamps CDR at 0.50 when using percentage modifiers or stat deltas', () => {
      // Test percentage scaling on CDR
      const statsManager = new PlayerStatsManager({
        ...DEFAULT_PLAYER_STATS,
        cooldownReduction: 0.40,
      });

      statsManager.addPassiveModifier({
        id: 'percent_cdr_boon',
        name: 'Arcane Echo',
        stat: 'cooldownReduction',
        type: 'percent',
        value: 1.0, // +100% of base CDR -> 0.80
      });

      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.50);

      // Test Player.applyStatDelta on CDR
      const player = new Player(0, 0);
      player.applyStatDelta('cooldownReduction', 0.30);
      expect(player.stats.cooldownReduction).toBe(0.30);

      player.applyStatDelta('cooldownReduction', 0.55); // Total 0.85
      expect(player.stats.cooldownReduction).toBe(0.50);

      // Negative delta clamping to 0.0
      player.applyStatDelta('cooldownReduction', -0.90);
      expect(player.stats.cooldownReduction).toBe(0.0);
    });

    it('safely restores accurate unclamped CDR when excessive modifiers are removed', () => {
      const statsManager = new PlayerStatsManager();

      statsManager.addPassiveModifier({
        id: 'mod1',
        name: 'Mod 1',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.30,
      });
      statsManager.addPassiveModifier({
        id: 'mod2',
        name: 'Mod 2',
        stat: 'cooldownReduction',
        type: 'flat',
        value: 0.40,
      }); // Total 0.70 -> clamped to 0.50

      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.50);

      // Remove mod2 (+0.40), leaving mod1 (+0.30)
      statsManager.removePassiveModifier('mod2');
      expect(statsManager.getEffectiveStats().cooldownReduction).toBe(0.30);
    });
  });

  describe('Challenge 5: LootManager Magnetic Acceleration Physics & Global Vacuum Pull', () => {
    let player: Player;
    let lootManager: LootManager;

    beforeEach(() => {
      player = new Player(0, 0, {
        magnetRadius: 100,
      });
      lootManager = new LootManager(1500);
    });

    it('empirically verifies magnetic acceleration equation: speed increases by 900 px/s^2 up to 1400 px/s', () => {
      // Place item at (3000, 0) to allow full acceleration run (1071 px required to hit 1400 px/s)
      const item = lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 3000, 0, false)!;
      expect(item).not.toBeNull();

      // Manually trigger attraction
      item.isAttracted = true;
      item.currentSpeed = LootManager.BASE_MAGNET_SPEED; // 180 px/s

      const dt = 1 / 60; // 0.01667s
      const accel = LootManager.MAGNET_ACCELERATION; // 900 px/s^2
      let prevSpeed = item.currentSpeed;

      // Simulate 10 frames of acceleration
      for (let frame = 1; frame <= 10; frame++) {
        lootManager.update(dt, player);

        const expectedSpeed = Math.min(
          LootManager.MAX_MAGNET_SPEED,
          prevSpeed + accel * dt
        );
        expect(item.currentSpeed).toBeCloseTo(expectedSpeed, 2);
        prevSpeed = item.currentSpeed;
      }

      // Simulate until speed caps at MAX_MAGNET_SPEED (1400 px/s)
      // Time required from 180 to 1400: (1400 - 180) / 900 = 1.3555s (~82 frames)
      for (let i = 0; i < 90; i++) {
        lootManager.update(dt, player);
      }
      expect(item.currentSpeed).toBe(LootManager.MAX_MAGNET_SPEED);
    });

    it('empirically verifies global vacuum pull attracts 100% of distant active gems regardless of radius', () => {
      const spawnedDrops = [];
      const testCoordinates = [
        { x: 500, y: 500 },
        { x: -1200, y: 800 },
        { x: 2500, y: -1500 },
        { x: -3000, y: -2000 },
        { x: 4000, y: 3500 },
      ];

      for (const coord of testCoordinates) {
        const drop = lootManager.spawnDrop(LootDropType.VIOLET_ABYSSAL, coord.x, coord.y, false)!;
        spawnedDrops.push(drop);
      }

      expect(lootManager.getActiveCount()).toBe(5);

      // Verify none are attracted before vacuum (all > magnetRadius 100)
      lootManager.update(1 / 60, player);
      for (const drop of spawnedDrops) {
        expect(drop.isAttracted).toBe(false);
      }

      // Trigger global vacuum
      lootManager.triggerGlobalVacuum();

      // All 5 must now be attracted
      for (const drop of spawnedDrops) {
        expect(drop.isAttracted).toBe(true);
        expect(drop.currentSpeed).toBeGreaterThanOrEqual(LootManager.BASE_MAGNET_SPEED);
      }

      // Simulate frames until all 5 distant gems converge to player (0, 0) and are collected
      // Max distance = hypot(4000, 3500) = ~5315 px
      // At average speed ~800-1400 px/s, takes ~4-6 seconds (~360 frames)
      for (let frame = 0; frame < 400; frame++) {
        lootManager.update(1 / 60, player);
        if (lootManager.getActiveCount() === 0) break;
      }

      // All 5 gems must be collected
      expect(lootManager.getActiveCount()).toBe(0);
      // 5 Violet Abyssal gems * 25 XP = 125 XP
      expect(player.totalXPEarned).toBe(125);
    });

    it('empirically verifies Eldritch Magnet drop automatically triggers map-wide vacuum on pickup', () => {
      // Spawn 10 far gems at 1500px distance
      for (let i = 0; i < 10; i++) {
        lootManager.spawnDrop(LootDropType.RUBY_GEM, 1500 + i * 50, 0, false);
      }
      // Spawn 1 Eldritch Magnet at player position (5px)
      lootManager.spawnDrop(LootDropType.ELDRITCH_MAGNET, 5, 0, false);

      expect(lootManager.getActiveCount()).toBe(11);

      // Step 1 frame: player collects Eldritch Magnet
      lootManager.update(1 / 60, player);

      // Eldritch Magnet collected, remaining 10 gems should all be attracted now
      expect(lootManager.getActiveCount()).toBe(10);
      const activeItems = lootManager.getActiveItems();
      for (const item of activeItems) {
        expect(item.isAttracted).toBe(true);
      }
    });

    it('empirically confirms zero object leak across 1,500 full spawn/recycle stress cycles', () => {
      // Spawn maximum pool capacity (1500)
      for (let i = 0; i < 1500; i++) {
        const item = lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 10, 10, false);
        expect(item).not.toBeNull();
      }
      expect(lootManager.getActiveCount()).toBe(1500);

      // 1501st spawn must return null due to strict pool exhaustion safeguard
      const overflowItem = lootManager.spawnDrop(LootDropType.EMERALD_SHARD, 10, 10, false);
      expect(overflowItem).toBeNull();

      // Collect all 1500 items in single update
      lootManager.update(1 / 60, player);
      expect(lootManager.getActiveCount()).toBe(0);

      // Resupply: verify we can spawn 1500 again immediately without failure
      for (let i = 0; i < 1500; i++) {
        const item = lootManager.spawnDrop(LootDropType.RUBY_GEM, 10, 10, false);
        expect(item).not.toBeNull();
      }
      expect(lootManager.getActiveCount()).toBe(1500);

      lootManager.clear();
      expect(lootManager.getActiveCount()).toBe(0);
    });
  });
});
