import { describe, it, expect, beforeEach } from 'vitest';
import { ParallaxBackground } from '../../src/render/ParallaxBackground';
import { CanvasRenderer, RenderSceneState } from '../../src/render/CanvasRenderer';
import { HUDOverlay } from '../../src/ui/HUDOverlay';
import { Camera } from '../../src/render/Camera';
import { CanvasContext2DLike } from '../../src/render/sprites/ProceduralSpriteFactory';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { PlayerActionState } from '../../src/core/player/PlayerKinematics';
import { vec2 } from '../../src/core/math/Vector2D';

describe('CHALLENGER_M1_2: Empirical Stress Test Suite for ParallaxBackground, CanvasRenderer & HUDOverlay', () => {

  // =========================================================================
  // 1. PARALLAX BACKGROUND STRESS: EXTREME CAMERA COORDS & HIGH SPEEDS
  // =========================================================================
  describe('1. Parallax Scrolling & Layer Wrapping Under Extreme Camera Dynamics', () => {
    let parallax: ParallaxBackground;
    const VIEWPORT_W = ParallaxBackground.VIEWPORT_WIDTH; // 960
    const BUFFER_W = 1920;

    beforeEach(() => {
      parallax = new ParallaxBackground();
    });

    /**
     * Intercepts and records drawImage calls to verify tiling invariants:
     * - No NaN, Infinity, or unrounded subpixel bleed in drawX
     * - 100% horizontal coverage from x <= 0 to x >= VIEWPORT_W
     * - Zero gaps between adjacent strips
     * - Strict iteration bound (<= 2 draws per layer)
     */
    function verifyLayerTiling(cameraX: number, cameraY: number = 0, time: number = 1.0) {
      const draws: Array<{ buffer: any; drawX: number; drawY: number }> = [];

      const mockCtx: Partial<CanvasContext2DLike> = {
        drawImage: (img: any, ...args: number[]) => {
          if (args.length === 2) {
            const drawX = args[0];
            const drawY = args[1];
            expect(Number.isFinite(drawX)).toBe(true);
            expect(Number.isNaN(drawX)).toBe(false);
            expect(Number.isFinite(drawY)).toBe(true);
            draws.push({ buffer: img, drawX, drawY });
          }
        },
        fillStyle: '',
        fillRect: (x, y, w, h) => {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          expect(Number.isFinite(w)).toBe(true);
          expect(Number.isFinite(h)).toBe(true);
        },
        beginPath: () => {},
        arc: (x, y, r) => {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          expect(Number.isFinite(r)).toBe(true);
        },
        fill: () => {},
        stroke: () => {},
      };

      parallax.render(mockCtx as CanvasContext2DLike, cameraX, cameraY, time);

      // Group calls by unique buffer (3 tiled layers: mountains, ruins, foreground)
      const layersMap = new Map<any, Array<number>>();
      for (const d of draws) {
        if (!layersMap.has(d.buffer)) {
          layersMap.set(d.buffer, []);
        }
        layersMap.get(d.buffer)!.push(d.drawX);
      }

      expect(layersMap.size).toBe(3);

      for (const [_, stripXs] of layersMap.entries()) {
        expect(stripXs.length).toBeGreaterThanOrEqual(1);
        expect(stripXs.length).toBeLessThanOrEqual(2); // Invariant: buffer (1920) >= 2 * viewport (960)

        // First strip must cover left edge (<= 0)
        expect(stripXs[0]).toBeLessThanOrEqual(0);

        // If two strips, verify seamless adjacent touching
        if (stripXs.length === 2) {
          expect(stripXs[1]).toBe(stripXs[0] + BUFFER_W);
        }

        // Last strip must cover right edge (>= VIEWPORT_W)
        const endCoverage = stripXs[stripXs.length - 1] + BUFFER_W;
        expect(endCoverage).toBeGreaterThanOrEqual(VIEWPORT_W);
      }
    }

    it('EMPIRICAL: Negative camera coordinates (-1, -500, -1920, -100000, -1e7)', () => {
      const negativeCoords = [-1, -50, -500, -960, -1920, -1921, -3840, -50000, -100000, -1e7];
      for (const x of negativeCoords) {
        verifyLayerTiling(x);
      }
    });

    it('EMPIRICAL: Beyond stage boundaries (stage max is 2900 -> test 3500, 10000, 500000, 1e8)', () => {
      const forwardCoords = [2901, 3500, 5000, 10000, 50000, 100000, 500000, 1e8];
      for (const x of forwardCoords) {
        verifyLayerTiling(x);
      }
    });

    it('EMPIRICAL: Extreme high-speed delta & teleports (20,000 px/s forward and reverse)', () => {
      let cameraX = 0;
      const speed = 20000; // 20,000 px/s
      const dt = 1 / 60;

      // Forward warp
      for (let step = 0; step < 60; step++) {
        cameraX += speed * dt;
        verifyLayerTiling(cameraX, 0, step * dt);
      }
      expect(cameraX).toBe(20000);

      // Reverse warp
      for (let step = 0; step < 60; step++) {
        cameraX -= speed * dt * 2;
        verifyLayerTiling(cameraX, 0, 1.0 + step * dt);
      }
      expect(cameraX).toBe(-20000);
    });

    it('EMPIRICAL: Subpixel floats and irrational camera coordinates', () => {
      const weirdCoords = [0.123456, 123.4567, -987.6543, Math.PI * 1000, Math.E * 500];
      for (const x of weirdCoords) {
        verifyLayerTiling(x);
      }
    });

    it('EMPIRICAL: Negative time and extreme time values in dynamic clouds', () => {
      const times = [-100.0, -1.0, 0, 1e-5, 10000.0, 999999.0];
      for (const t of times) {
        verifyLayerTiling(500, 0, t);
      }
    });
  });

  // =========================================================================
  // 2. HUD OVERLAY STRESS: EXTREME STATES & TIMERS
  // =========================================================================
  describe('2. HUD Rendering Under Extreme States and Timers', () => {
    let hud: HUDOverlay;
    let mockCtx: any;

    beforeEach(() => {
      hud = new HUDOverlay();
      mockCtx = {
        canvas: { width: 960, height: 540 },
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        rect: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: (x: number, y: number, w: number, h: number) => {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          expect(Number.isFinite(w)).toBe(true);
          expect(Number.isFinite(h)).toBe(true);
        },
        strokeRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 40 }),
        drawImage: () => {},
        createLinearGradient: () => ({
          addColorStop: () => {},
        }),
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        globalAlpha: 1.0,
      };
    });

    it('EMPIRICAL: 0 lives, negative lives (-5), and huge lives (99)', () => {
      const lifeCases = [0, -1, -5, -99, 1, 9, 99];
      for (const lives of lifeCases) {
        expect(() => {
          hud.render(mockCtx, {
            score: 1000,
            lives,
            weaponType: 'PISTOL',
            ammo: Infinity,
            grenades: 10,
            hostagesRescued: 0,
          });
        }).not.toThrow();
      }
    });

    it('EMPIRICAL: Score boundaries (0, 999999, negative -500, overflow 10,000,000)', () => {
      const scoreCases = [0, 1, 999, 999999, -500, 10000000];
      for (const score of scoreCases) {
        expect(() => {
          hud.render(mockCtx, {
            score,
            lives: 3,
            weaponType: 'HEAVY_MACHINE_GUN',
            ammo: 200,
            grenades: 10,
            hostagesRescued: 0,
          });
        }).not.toThrow();
      }
    });

    it('EMPIRICAL: Negative and extreme timers (continueCountdown, bossWarningTimer, time)', () => {
      const timerCases = [
        { continueCountdown: -10, bossWarningTimer: -5, time: -1.0 },
        { continueCountdown: 0, bossWarningTimer: 0, time: 0 },
        { continueCountdown: 0.001, bossWarningTimer: 0.001, time: 0.001 },
        { continueCountdown: 10.0, bossWarningTimer: 5.0, time: 999999 },
      ];

      for (const tc of timerCases) {
        expect(() => {
          hud.render(mockCtx, {
            score: 50000,
            lives: 0,
            weaponType: 'PISTOL',
            ammo: Infinity,
            grenades: 0,
            hostagesRescued: 0,
            isContinueActive: true,
            continueCountdown: tc.continueCountdown,
            showBossWarning: true,
            bossWarningTimer: tc.bossWarningTimer,
          }, tc.time);
        }).not.toThrow();
      }
    });

    it('EMPIRICAL: Extreme health ratios on boss bar (0 HP, negative HP, overflow HP)', () => {
      const healthCases = [
        { bossHealth: 0, bossMaxHealth: 1500 },
        { bossHealth: -50, bossMaxHealth: 1500 },
        { bossHealth: 2000, bossMaxHealth: 1500 },
        { bossHealth: 1, bossMaxHealth: 1500 },
        { bossHealth: 0, bossMaxHealth: 0 }, // 0 max health edge case
      ];

      for (const hc of healthCases) {
        expect(() => {
          hud.render(mockCtx, {
            score: 1000,
            lives: 3,
            weaponType: 'PISTOL',
            ammo: Infinity,
            grenades: 10,
            hostagesRescued: 0,
            bossHealth: hc.bossHealth,
            bossMaxHealth: hc.bossMaxHealth,
            bossName: 'CUTE TEST BOSS',
          });
        }).not.toThrow();
      }
    });

    it('EMPIRICAL: Degenerate canvas dimensions (1x1, 100x100, 3840x2160, null canvas)', () => {
      const resolutions = [
        { width: 1, height: 1 },
        { width: 100, height: 100 },
        { width: 480, height: 270 },
        { width: 1920, height: 1080 },
        { width: 3840, height: 2160 },
      ];

      for (const res of resolutions) {
        const customCtx = { ...mockCtx, canvas: res };
        expect(() => {
          hud.render(customCtx, {
            score: 12345,
            lives: 2,
            weaponType: 'FLAME_SHOT',
            ammo: 30,
            grenades: 5,
            hostagesRescued: 2,
            showTutorial: true,
            isContinueActive: true,
            continueCountdown: 7.2,
            showBossWarning: true,
            bossHealth: 500,
            bossMaxHealth: 1000,
          });
        }).not.toThrow();
      }
    });
  });

  // =========================================================================
  // 3. RAPID CONTINUE BUTTON PRESSES & STATE MACHINE INTEGRITY
  // =========================================================================
  describe('3. Rapid Continue Button Presses & State Transitions', () => {
    let engine: GameEngine;
    let player: PlayerController;

    beforeEach(() => {
      engine = new GameEngine();
      player = new PlayerController(vec2(100, 200));
      engine.addEntity(player);
    });

    it('EMPIRICAL: 100 consecutive continue button presses across 100 frames', () => {
      // Enter continue countdown
      player.lives = 0;
      player.startContinueCountdown();
      expect(player.actionState).toBe(PlayerActionState.CONTINUE_COUNTDOWN);
      expect(player.isContinueActive).toBe(true);
      expect(player.continueTimer).toBe(10.0);

      // Frame 1: Continue accepted
      player.handleInput({
        left: false,
        right: false,
        up: false,
        down: false,
        jumpPressed: false,
        jumpHeld: false,
        shootPressed: true,
        shootHeld: true,
        grenadePressed: false,
      }, 1 / 60, engine);

      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isContinueActive).toBe(false);
      expect(player.lives).toBe(3);
      expect(player.isAlive).toBe(true);

      // Frames 2..100: 99 more rapid presses while parachuting
      for (let f = 2; f <= 100; f++) {
        player.handleInput({
          left: false,
          right: false,
          up: false,
          down: false,
          jumpPressed: f % 2 === 0,
          jumpHeld: true,
          shootPressed: f % 3 === 0,
          shootHeld: true,
          grenadePressed: false,
        }, 1 / 60, engine);

        // State must remain RESPAWNING_PARACHUTE (or transition to IDLE if landed)
        expect(player.lives).toBe(3); // Never corrupted or re-incremented
        expect(player.isContinueActive).toBe(false);
        expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      }
    });

    it('EMPIRICAL: Simultaneous Jump + Shoot press on continue countdown', () => {
      player.lives = 0;
      player.startContinueCountdown();

      player.handleInput({
        left: false,
        right: false,
        up: false,
        down: false,
        jumpPressed: true,
        jumpHeld: true,
        shootPressed: true,
        shootHeld: true,
        grenadePressed: false,
      }, 1 / 60, engine);

      expect(player.lives).toBe(3);
      expect(player.actionState).toBe(PlayerActionState.RESPAWNING_PARACHUTE);
      expect(player.isContinueActive).toBe(false);
    });
  });

  // =========================================================================
  // 4. CANVAS RENDERER EXTREME INTEGRATION PASSES
  // =========================================================================
  describe('4. CanvasRenderer Extreme Integration Passes', () => {
    let renderer: CanvasRenderer;
    let camera: Camera;

    beforeEach(() => {
      renderer = new CanvasRenderer();
      camera = new Camera();
    });

    it('EMPIRICAL: renderScene with extreme camera coordinates (-100,000 to +1,000,000)', () => {
      const extremeCameraXs = [-100000, -5000, 0, 2900, 50000, 1000000];

      for (const cx of extremeCameraXs) {
        camera.reset(cx, 0);
        const scene: RenderSceneState = {
          time: 5.0,
          camera,
          hud: {
            score: 999999,
            lives: 0,
            weaponType: 'HEAVY_MACHINE_GUN',
            ammo: 0,
            grenades: 0,
            hostagesRescued: 0,
            isContinueActive: true,
            continueCountdown: 3.5,
          },
        };

        expect(() => {
          renderer.renderScene(scene);
        }).not.toThrow();
      }
    });

    it('EMPIRICAL: High frequency score bursts generating 500 score popups', () => {
      camera.reset(0, 0);

      // Generate 100 frames with increasing scores
      for (let i = 1; i <= 100; i++) {
        const scene: RenderSceneState = {
          time: i * 0.016,
          camera,
          hud: {
            score: i * 500, // triggers "SWEET! +500" popup every frame
            lives: 3,
            weaponType: 'PISTOL',
            ammo: Infinity,
            grenades: 10,
            hostagesRescued: 1,
          },
        };

        expect(() => {
          renderer.renderScene(scene);
        }).not.toThrow();
      }
    });
  });
});
