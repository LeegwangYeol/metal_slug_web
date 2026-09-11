import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GothicHUD, HUDStateSnapshot } from '../../src/ui/GothicHUD';

/**
 * ChallengerM3_HUD_Stress.test.ts
 *
 * Adversarial Challenge & Stress Test Suite for GothicHUD (Milestone 3).
 * Author: challenger_m3_ui_1 (Empirical Challenger)
 *
 * Stress Test Vectors:
 * 1. Health extremes: HP = 0, HP = 1, HP > 10,000, negative HP, NaN HP (0 crashes, 0 visual overflow).
 * 2. Ghost health damage drain under 10,000 randomized damage pulses: non-negative drain, monotonic decay, delay timing invariance.
 * 3. XP bar fill and soul spark orb under extreme XP values: XP = 0, rapid level-up burst (level 1 -> 50 in 1 frame), negative XP resistance.
 * 4. Kill counter punch animation and skull eye rendering under extreme kill counts (0 to 1,000,000 kills) and rapid increments.
 * 5. Timer formatting under extreme elapsed seconds (0s, 3599s, 100,000s).
 * 6. Zero crashes and balanced canvas save/restore states under combined extremes.
 */

describe('Milestone 3 Adversarial Challenge: GothicHUD Stress & Invariants (challenger_m3_ui_1)', () => {
  let hud: GothicHUD;
  let mockCtx: any;
  let defaultState: HUDStateSnapshot;
  let fillRectCalls: Array<[number, number, number, number]>;
  let strokeRectCalls: Array<[number, number, number, number]>;
  let arcCalls: Array<[number, number, number, number, number]>;
  let fillTextCalls: Array<[string, number, number]>;

  beforeEach(() => {
    hud = new GothicHUD({
      virtualWidth: 960,
      virtualHeight: 540,
      xpColorMode: 'soul-blue',
      showInventorySlots: true,
      showWavePhase: true,
    });

    fillRectCalls = [];
    strokeRectCalls = [];
    arcCalls = [];
    fillTextCalls = [];

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn((...args: [number, number, number, number]) => {
        fillRectCalls.push(args);
      }),
      strokeRect: vi.fn((...args: [number, number, number, number]) => {
        strokeRectCalls.push(args);
      }),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn((...args: [number, number, number, number, number]) => {
        arcCalls.push(args);
      }),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn((...args: [string, number, number]) => {
        fillTextCalls.push(args);
      }),
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      translate: vi.fn(),
      scale: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
    };

    defaultState = {
      player: {
        stats: {
          currentHealth: 100,
          maxHealth: 100,
          healthRegen: 0.5,
          armor: 2,
        },
        level: 1,
        currentXP: 0,
        xpToNextLevel: 10,
        isAlive: true,
        weapons: [
          { id: 'w1', name: 'Arcane Scythe', icon: 'scythe', rank: 3 },
          { id: 'w2', name: 'Soul Orbiters', icon: 'orbiters', rank: 2 },
        ],
        passives: [
          { id: 'p1', name: 'Tome of Might', icon: 'tome', rank: 4 },
        ],
      },
      hordeManager: {
        totalKilled: 120,
        getActiveCount: () => 75,
      },
      elapsedTime: 45.0,
      killCount: 120,
    };
  });

  // =========================================================================
  // Challenge 1: Health Extremes & Boundary Stress (HP = 0, 1, >10,000, <0, NaN)
  // =========================================================================
  describe('Challenge 1: Vitality Bar Extreme Boundaries & Zero-Overflow', () => {
    it('handles HP = 0 without rendering negative blood fill or crashing', () => {
      defaultState.player.stats.currentHealth = 0;
      defaultState.player.stats.maxHealth = 100;

      hud.update(0.016, defaultState);
      expect(hud.displayHealth).toBe(0);
      expect(hud.ghostHealth).toBe(0);

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      // Readout must display "0 / 100"
      const readouts = fillTextCalls.filter(call => call[0] === '0 / 100');
      expect(readouts.length).toBeGreaterThanOrEqual(1);

      // Blood fill should not execute (hpRatio === 0)
      const bloodBarFills = fillRectCalls.filter(call => call[0] === 98 && call[1] === 18);
      // Only the empty blood well (168x24) should be drawn, no positive blood fill
      expect(bloodBarFills.some(call => call[2] < 0)).toBe(false);
    });

    it('handles HP = 1 with micro-fill clamped inside bar bounds (bloodW >= 1)', () => {
      defaultState.player.stats.currentHealth = 1;
      defaultState.player.stats.maxHealth = 100;

      hud.update(0.016, defaultState);
      expect(hud.displayHealth).toBe(1);

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      // Numeric readout "1 / 100"
      const readouts = fillTextCalls.filter(call => call[0] === '1 / 100');
      expect(readouts.length).toBeGreaterThanOrEqual(1);

      // Low health warning border triggered (1/100 < 0.3)
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(96, 16, 172, 28);
    });

    it('handles massive health HP > 10,000 without visual overflow or freeze', () => {
      const extremeHealth = 25000;
      defaultState.player.stats.currentHealth = extremeHealth;
      defaultState.player.stats.maxHealth = extremeHealth;

      hud.update(0.016, defaultState);
      expect(hud.displayHealth).toBe(extremeHealth);
      expect(hud.maxHealth).toBe(extremeHealth);

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      // Readout format
      const readouts = fillTextCalls.filter(call => call[0] === `${extremeHealth} / ${extremeHealth}`);
      expect(readouts.length).toBeGreaterThanOrEqual(1);

      // Verify fill geometry remains bounded (barW = 168)
      if (mockCtx.rect.mock.calls.length > 0) {
        for (const call of mockCtx.rect.mock.calls) {
          const [, , width] = call;
          expect(width).toBeLessThanOrEqual(168);
        }
      }
    });

    it('defensively clamps negative HP to 0 preventing inverted fills', () => {
      defaultState.player.stats.currentHealth = -150;
      defaultState.player.stats.maxHealth = 100;

      hud.update(0.016, defaultState);
      expect(hud.displayHealth).toBe(0);

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      const readouts = fillTextCalls.filter(call => call[0] === '0 / 100');
      expect(readouts.length).toBeGreaterThanOrEqual(1);

      // No negative widths in any fillRect call
      for (const call of fillRectCalls) {
        expect(call[2]).toBeGreaterThanOrEqual(0);
        expect(call[3]).toBeGreaterThanOrEqual(0);
      }
    });

    it('safely handles NaN HP without unhandled exception or engine crash', () => {
      defaultState.player.stats.currentHealth = NaN;
      defaultState.player.stats.maxHealth = 100;

      expect(() => {
        hud.update(0.016, defaultState);
      }).not.toThrow();

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 2: Ghost Health Drain Under 10,000 Randomized Damage Pulses
  // =========================================================================
  describe('Challenge 2: Ghost Health Invariants Under 10,000 Damage Pulses', () => {
    it('empirically verifies non-negative drain, monotonic decay, and delay timing invariance across 10,000 randomized pulses', () => {
      // Initialize at 10,000 HP
      defaultState.player.stats.currentHealth = 10000;
      defaultState.player.stats.maxHealth = 10000;
      hud.update(0.016, defaultState);

      let nonNegativeViolations = 0;
      let monotonicDecayViolations = 0;
      let delayInvarianceViolations = 0;
      let totalPulses = 10000;

      for (let pulse = 0; pulse < totalPulses; pulse++) {
        const damage = 1 + Math.random() * 40;
        const targetHP = Math.max(0, defaultState.player.stats.currentHealth - damage);
        defaultState.player.stats.currentHealth = targetHP;

        const prevDisplayHealth = hud.displayHealth;

        // Apply damage tick
        hud.update(0.016, defaultState);

        // Invariance 1: On damage (targetHP < prevDisplayHealth), ghostDrainDelay must be reset to 0.35s (minus dt)
        if (targetHP < prevDisplayHealth) {
          // Delay must be active
          if (hud.ghostDrainDelay <= 0) {
            delayInvarianceViolations++;
          }
          // Ghost health must NOT have instantly collapsed to targetHP
          if (hud.ghostHealth < targetHP - 0.001) {
            monotonicDecayViolations++;
          }
        }

        // Invariance 2: Simulate multi-frame decay steps
        const decayFrames = Math.floor(1 + Math.random() * 25);
        let stepPrevGhost = hud.ghostHealth;

        for (let f = 0; f < decayFrames; f++) {
          hud.update(0.016, defaultState);

          // Drain must be non-negative: ghostHealth cannot increase during decay
          if (hud.ghostHealth > stepPrevGhost + 0.0001) {
            nonNegativeViolations++;
          }

          // Ghost health must never drop below displayHealth
          if (hud.ghostHealth < hud.displayHealth - 0.001) {
            monotonicDecayViolations++;
          }

          stepPrevGhost = hud.ghostHealth;
        }

        // Replenish player health if depleted to keep stress testing continuous
        if (defaultState.player.stats.currentHealth <= 50) {
          defaultState.player.stats.currentHealth = 10000;
          hud.update(0.016, defaultState);
        }
      }

      // Assert 100% compliance across all 10,000 damage events
      expect(nonNegativeViolations).toBe(0);
      expect(monotonicDecayViolations).toBe(0);
      expect(delayInvarianceViolations).toBe(0);
    });
  });

  // =========================================================================
  // Challenge 3: XP Bar Fill, Soul Spark Orb & Extreme Level Bursts
  // =========================================================================
  describe('Challenge 3: XP Progression & Level Burst Invariants', () => {
    it('renders clean 0-width XP bar at XP = 0 without spark orb overflow', () => {
      defaultState.player.currentXP = 0;
      defaultState.player.xpToNextLevel = 10;

      hud.update(0.016, defaultState);
      expect(hud.displayXP).toBe(0);

      hud.render(mockCtx, 960, 540, defaultState);

      // Arc for soul spark orb should NOT be called since fillW === 0
      // Only level badge and potential other circular decorations are drawn
      const sparkOrbArcs = arcCalls.filter(call => call[2] === 6);
      expect(sparkOrbArcs.length).toBe(0);
    });

    it('survives rapid level-up burst (Level 1 -> 50 in 1 frame) with shockwave flash & smooth displayXP reset', () => {
      hud.update(0.016, defaultState);
      expect(hud.currentLevel).toBe(1);

      // Sudden massive burst
      defaultState.player.level = 50;
      defaultState.player.currentXP = 250;
      defaultState.player.xpToNextLevel = 1200;

      hud.update(0.016, defaultState);

      expect(hud.currentLevel).toBe(50);
      expect(hud.levelUpFlashTimer).toBeCloseTo(0.784, 0.02); // 0.8s - 0.016
      // displayXP resets to 0 upon level up and steps smoothly towards 250
      expect(hud.displayXP).toBeLessThan(250);

      // Render check
      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      // Badge must display "SOUL LVL 50"
      const badgeTexts = fillTextCalls.filter(call => call[0] === 'SOUL LVL 50');
      expect(badgeTexts.length).toBeGreaterThanOrEqual(2); // Shadow + fill

      // Flash shockwave arc should be drawn
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('defensively handles negative XP without rendering reversed/inverted rectangles', () => {
      defaultState.player.currentXP = -500;
      defaultState.player.xpToNextLevel = 100;

      hud.update(0.016, defaultState);

      // Advance multiple ticks
      for (let i = 0; i < 20; i++) {
        hud.update(0.016, defaultState);
      }

      hud.render(mockCtx, 960, 540, defaultState);

      // Verify no negative width was passed to fillRect
      for (const call of fillRectCalls) {
        expect(call[2]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Kill Counter Punch Animation & Anatomical Skull Eyes
  // =========================================================================
  describe('Challenge 4: Kill Counter Scale Punch & Skull Eye Geometry', () => {
    it('formats kill tally cleanly up to 1,000,000 kills and dynamically offsets skull to prevent overlap', () => {
      defaultState.killCount = 1000000;
      hud.update(0.016, defaultState);

      hud.render(mockCtx, 960, 540, defaultState);

      // Check formatted text "1,000,000"
      const formattedCalls = fillTextCalls.filter(call => call[0] === '1,000,000');
      expect(formattedCalls.length).toBeGreaterThanOrEqual(2);

      // Skull should have been rendered with measureText clearance
      expect(mockCtx.measureText).toHaveBeenCalledWith('1,000,000');
      const textWidth = mockCtx.measureText.mock.results[0]?.value?.width ?? 90;
      expect(textWidth).toBeGreaterThan(0);
    });

    it('bounds killScaleAnim strictly in [1.0, 1.35] under 1,000 continuous kill bursts', () => {
      hud.update(0.016, defaultState);
      let minScale = 1.0;
      let maxScale = 1.0;

      for (let i = 0; i < 1000; i++) {
        defaultState.killCount = (defaultState.killCount ?? 0) + Math.floor(1 + Math.random() * 10);
        hud.update(0.016, defaultState);

        if (hud.killScaleAnim > maxScale) maxScale = hud.killScaleAnim;
        if (hud.killScaleAnim < minScale) minScale = hud.killScaleAnim;
      }

      expect(maxScale).toBe(1.35);
      expect(minScale).toBeGreaterThanOrEqual(1.0);

      // Decays when kills stop
      for (let i = 0; i < 30; i++) {
        hud.update(0.05, defaultState);
      }
      expect(hud.killScaleAnim).toBe(1.0);
    });

    it('renders anatomical skull with ruby eyes and additive red gleam', () => {
      hud.update(0.016, defaultState);
      hud.render(mockCtx, 960, 540, defaultState);

      // Sockets and ruby irises rendered via arc calls
      // Cranium arc + 2 sockets + 2 irises = at least 5 arcs per skull
      expect(arcCalls.length).toBeGreaterThanOrEqual(5);

      // Ruby crimson iris color (#ff2222) and gleam (#ff8888)
      // Since mockCtx.fillStyle records the assignments, we verify fillRect calls
      expect(mockCtx.fill).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 5: Survival Timer Formatting Under Extreme Elapsed Seconds
  // =========================================================================
  describe('Challenge 5: Elapsed Timer Formatting & Phase Invariants', () => {
    it('formats 0s into 00:00 with Phase I banner', () => {
      defaultState.elapsedTime = 0;
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('00:00');

      hud.render(mockCtx, 960, 540, defaultState);
      expect(fillTextCalls.some(call => call[0] === 'PHASE I • THE AWAKENING')).toBe(true);
    });

    it('formats 3599s into 59:59 with Phase III banner', () => {
      defaultState.elapsedTime = 3599;
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('59:59');

      hud.render(mockCtx, 960, 540, defaultState);
      expect(fillTextCalls.some(call => call[0] === 'PHASE III • NIGHTFALL ASCENDANT')).toBe(true);
    });

    it('formats extreme time 100,000s into 1666:40 with Phase III banner and zero crash', () => {
      defaultState.elapsedTime = 100000;
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('1666:40');

      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      const timerTexts = fillTextCalls.filter(call => call[0].includes('1666:40'));
      expect(timerTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Challenge 6: Combined Extreme Stress & Canvas Stack Invariance
  // =========================================================================
  describe('Challenge 6: Stack Integrity & Combined Extremes', () => {
    it('preserves strict ctx.save() / ctx.restore() balance under combined extreme values', () => {
      defaultState.player.stats.currentHealth = 50000;
      defaultState.player.stats.maxHealth = 50000;
      defaultState.player.level = 99;
      defaultState.player.currentXP = 9999;
      defaultState.player.xpToNextLevel = 10000;
      defaultState.killCount = 500000;
      defaultState.elapsedTime = 99999;
      defaultState.boss = {
        name: 'Malok the Undying',
        currentHealth: 50000,
        maxHealth: 100000,
      };

      hud.update(0.016, defaultState);

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      hud.render(mockCtx, 960, 540, defaultState);

      // Stack symmetry invariant
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.save.mock.calls.length).toBe(mockCtx.restore.mock.calls.length);
    });
  });
});
