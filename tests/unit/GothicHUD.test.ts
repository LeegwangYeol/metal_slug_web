import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GothicHUD, HUDStateSnapshot } from '../../src/ui/GothicHUD';

describe('GothicHUD Architecture & Interface Verification (Milestone M2)', () => {
  let hud: GothicHUD;
  let mockCtx: any;
  let defaultState: HUDStateSnapshot;

  beforeEach(() => {
    hud = new GothicHUD({
      virtualWidth: 960,
      virtualHeight: 540,
      xpColorMode: 'necrotic-emerald',
    });

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 40 }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      translate: vi.fn(),
      scale: vi.fn(),
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
          healthRegen: 0.2,
          armor: 2,
        },
        level: 1,
        currentXP: 0,
        xpToNextLevel: 10,
        isAlive: true,
        weapons: [
          { id: 'w1', name: 'Arcane Scythe', icon: 'scythe', rank: 2 },
          { id: 'w2', name: 'Soul Orbiters', icon: 'orbiters', rank: 1 },
        ],
        passives: [
          { id: 'p1', name: 'Tome of Might', icon: 'tome', rank: 3 },
        ],
      },
      hordeManager: {
        totalKilled: 42,
        getActiveCount: () => 150,
      },
      elapsedTime: 65.5,
      killCount: 42,
    };
  });

  describe('Suite 1: Smooth XP Interpolation & Level-Up Detection', () => {
    it('interpolates displayXP towards targetXP smoothly across update ticks', () => {
      // First update initializes
      hud.update(0.016, defaultState);
      expect(hud.displayXP).toBe(0);

      // State gains 8 XP
      defaultState.player.currentXP = 8;
      defaultState.player.xpToNextLevel = 10;

      hud.update(0.016, defaultState); // ~1 frame at 60Hz
      expect(hud.displayXP).toBeGreaterThan(0);
      expect(hud.displayXP).toBeLessThan(8);

      // Advance multiple ticks
      for (let i = 0; i < 30; i++) {
        hud.update(0.016, defaultState);
      }
      expect(hud.displayXP).toBeCloseTo(8, 0.1);
    });

    it('triggers level-up flash timer and resets displayXP when level increases', () => {
      hud.update(0.016, defaultState);
      expect(hud.currentLevel).toBe(1);
      expect(hud.levelUpFlashTimer).toBe(0);

      // Level up to 2
      defaultState.player.level = 2;
      defaultState.player.currentXP = 3;
      defaultState.player.xpToNextLevel = 28;

      hud.update(0.016, defaultState);
      expect(hud.currentLevel).toBe(2);
      expect(hud.levelUpFlashTimer).toBeGreaterThan(0.7); // 0.8s max
      // displayXP resets to 0 upon level-up and begins interpolating to currentXP (3)
      expect(hud.displayXP).toBeLessThan(3);
    });
  });

  describe('Suite 2: Vitality Bar & Damage Ghost Drain', () => {
    it('preserves ghostHealth during damage delay then drains smoothly', () => {
      // Settle at 100 HP
      hud.update(0.016, defaultState);
      expect(hud.displayHealth).toBe(100);
      expect(hud.ghostHealth).toBe(100);

      // Player takes 40 damage -> 60 HP
      defaultState.player.stats.currentHealth = 60;
      hud.update(0.016, defaultState);

      // Immediately: displayHealth is 60, ghostHealth is still 100 (delayed drain)
      expect(hud.displayHealth).toBe(60);
      expect(hud.ghostHealth).toBe(100);
      expect(hud.ghostDrainDelay).toBeGreaterThan(0.3);

      // Advance past delay (0.35s delay + some drain time)
      for (let i = 0; i < 40; i++) {
        hud.update(0.016, defaultState);
      }
      expect(hud.ghostHealth).toBeLessThan(100);
      expect(hud.ghostHealth).toBeGreaterThanOrEqual(60);
    });

    it('activates low health pulse when health drops below 30%', () => {
      defaultState.player.stats.currentHealth = 25; // 25% < 30%
      hud.update(0.016, defaultState);

      hud.render(mockCtx, 960, 540, defaultState);

      // Radial gradient created for low health vignette
      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    });
  });

  describe('Suite 3: Kill Counter Punch Animation & Timer Formatting', () => {
    it('triggers scale punch animation when kill count increases', () => {
      hud.update(0.016, defaultState);
      expect(hud.killScaleAnim).toBe(1.0);

      // 10 new kills
      defaultState.killCount = 52;
      hud.update(0.016, defaultState);
      expect(hud.killScaleAnim).toBe(1.35); // Snaps to 1.35

      // Decays over time
      hud.update(0.05, defaultState);
      expect(hud.killScaleAnim).toBeLessThan(1.35);
      expect(hud.killScaleAnim).toBeGreaterThan(1.0);
    });

    it('formats elapsed time correctly into MM:SS format', () => {
      defaultState.elapsedTime = 0;
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('00:00');

      defaultState.elapsedTime = 75; // 1m 15s
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('01:15');

      defaultState.elapsedTime = 635; // 10m 35s
      hud.update(0.016, defaultState);
      expect(hud.cachedTimerStr).toBe('10:35');
    });
  });

  describe('Suite 4: Zero-Crash Complete Render Pass', () => {
    it('executes full render pass without errors for normal running state', () => {
      hud.update(0.016, defaultState);
      expect(() => {
        hud.render(mockCtx, 960, 540, defaultState);
      }).not.toThrow();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('supports overloaded render(ctx, hudSnapshot, dt) call signature', () => {
      hud.update(0.016, defaultState);
      expect(() => {
        hud.render(mockCtx, defaultState as any, 0.016);
      }).not.toThrow();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('renders boss health bar when boss state is present', () => {
      defaultState.boss = {
        name: 'Abyssal Reaper',
        currentHealth: 850,
        maxHealth: 1000,
      };

      hud.update(0.016, defaultState);
      hud.render(mockCtx, 960, 540, defaultState);

      expect(mockCtx.fillText).toHaveBeenCalledWith('ABYSSAL REAPER', expect.any(Number), expect.any(Number));
    });

    it('renders game over tombstone plaque when player is dead', () => {
      defaultState.player.isAlive = false;

      hud.update(0.016, defaultState);
      hud.render(mockCtx, 960, 540, defaultState);

      expect(mockCtx.fillText).toHaveBeenCalledWith('YOU HAVE SUCCUMBED TO THE HORDE', expect.any(Number), expect.any(Number));
    });
  });
});
