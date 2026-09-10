import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrimHarvestGame } from '../../src/main';

describe('Empirical Challenger M4-1: Restart Lifecycle & Debounce Engine Stress Suite', () => {
  let game: GrimHarvestGame;
  let rafIdCounter: number;
  let activeRafCallbacks: Map<number, (now: number) => void>;

  beforeEach(() => {
    rafIdCounter = 0;
    activeRafCallbacks = new Map();

    vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
      const id = ++rafIdCounter;
      activeRafCallbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      activeRafCallbacks.delete(id);
    });

    game = new GrimHarvestGame();
  });

  afterEach(() => {
    game.destroy();
    vi.unstubAllGlobals();
    activeRafCallbacks.clear();
  });

  describe('Adversarial Challenge 1: 10x Consecutive Deaths & Restarts Stress Test', () => {
    it('asserts zero RAF loop accumulation, zero memory leaks, and accumulator <= 1/60 across 10 consecutive restart cycles', () => {
      // Mount with mock canvas so start() activates RAF loop
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getContext: () => null,
      };
      (game as any).canvas = mockCanvas;

      game.start();

      // Invariant: At game start, exactly 1 active RAF loop exists
      expect(activeRafCallbacks.size).toBe(1);
      let lastLoopEpoch = (game as any).loopEpoch;

      for (let cycle = 1; cycle <= 10; cycle++) {
        // 1. Advance active gameplay for 10 frames
        for (let f = 0; f < 10; f++) {
          const currentId = Array.from(activeRafCallbacks.keys())[0];
          const cb = activeRafCallbacks.get(currentId)!;
          activeRafCallbacks.delete(currentId);

          cb(performance.now() + (f + 1) * 16.667);

          // Assert accumulator is strictly <= 1/60 after each frame
          expect((game as any).accumulator).toBeLessThanOrEqual(GrimHarvestGame.FIXED_TIMESTEP + 1e-9);
          // Exactly 1 RAF callback must be scheduled for next frame
          expect(activeRafCallbacks.size).toBe(1);
        }

        // 2. Kill player
        game.player.takeDamage(9999);
        expect(game.player.isAlive).toBe(false);
        expect(game.isGameOver).toBe(true);

        // 3. Advance death timer past 0.5s debounce (35 frames)
        for (let df = 0; df < 35; df++) {
          const currentId = Array.from(activeRafCallbacks.keys())[0];
          const cb = activeRafCallbacks.get(currentId)!;
          activeRafCallbacks.delete(currentId);

          cb(performance.now() + 200 + (df + 1) * 16.667);
          expect(activeRafCallbacks.size).toBe(1);
        }

        expect(game.deathTimer).toBeGreaterThanOrEqual(0.5);
        expect(game.canResurrect()).toBe(true);

        // 4. Trigger restart
        game.restart();

        // 5. Invariant Assertions Post-Restart:
        // A. Exactly 1 active RAF loop (Zero RAF loop accumulation!)
        expect(
          activeRafCallbacks.size,
          `Cycle ${cycle}: Active RAF loops count must be exactly 1, got ${activeRafCallbacks.size}`
        ).toBe(1);

        // B. loopEpoch monotonically incremented (strictly > previous epoch)
        const currentLoopEpoch = (game as any).loopEpoch;
        expect(
          currentLoopEpoch,
          `Cycle ${cycle}: loopEpoch must increment (prev: ${lastLoopEpoch}, curr: ${currentLoopEpoch})`
        ).toBeGreaterThan(lastLoopEpoch);
        lastLoopEpoch = currentLoopEpoch;

        // C. Accumulator is strictly <= 1/60
        expect((game as any).accumulator).toBe(0);

        // D. Player pristine resurrection invariants
        expect(game.player.isAlive).toBe(true);
        expect(game.player.stats.currentHealth).toBe(100);
        expect(game.player.level).toBe(1);
        expect(game.player.position.x).toBe(0);
        expect(game.player.position.y).toBe(0);
        expect(game.elapsedTime).toBe(0);
        expect(game.deathTimer).toBe(0);

        // E. Zero entity leaks / pristine pool states
        expect(game.hordeManager.getActiveCount()).toBe(35); // 25 skeletons + 10 ghouls
        expect(game.hordeManager.getPoolAvailableCount()).toBe(2048 - 35); // 2013
        expect(game.lootManager.getActiveCount()).toBe(0);
        expect(game.weaponManager.projectilePool.getActiveCount()).toBe(0);
        expect(game.weaponManager.getActiveWeapons()[0]?.id).toBe('scythe');
      }

      // Final verification: exactly 1 RAF loop remains after 10 cycles
      expect(activeRafCallbacks.size).toBe(1);
    });
  });

  describe('Adversarial Challenge 2: Rapid Key Hammering & Click Spamming Stress Test', () => {
    it('spams 200 Spacebar and canvas click events during 0.5s death debounce: asserts resurrection NEVER fires prematurely', () => {
      const windowListeners: Record<string, Function[]> = {};
      const canvasListeners: Record<string, Function[]> = {};

      const mockWindow = {
        addEventListener: (type: string, fn: Function) => {
          windowListeners[type] = windowListeners[type] || [];
          windowListeners[type].push(fn);
        },
        removeEventListener: vi.fn(),
      };
      const mockCanvas: any = {
        addEventListener: (type: string, fn: Function) => {
          canvasListeners[type] = canvasListeners[type] || [];
          canvasListeners[type].push(fn);
        },
        removeEventListener: vi.fn(),
        getContext: () => null,
      };

      vi.stubGlobal('window', mockWindow);
      const mountedGame = new GrimHarvestGame();
      (mountedGame as any).canvas = mockCanvas;

      // Attach listeners manually as mount would
      mockCanvas.addEventListener('click', (mountedGame as any).boundOnCanvasClick);
      mockWindow.addEventListener('keydown', (mountedGame as any).boundOnKeyDown);

      // Kill player
      mountedGame.player.takeDamage(9999);
      expect(mountedGame.player.isAlive).toBe(false);
      expect(mountedGame.deathTimer).toBe(0);

      const spaceEvent = {
        code: 'Space',
        key: ' ',
        repeat: false,
        preventDefault: vi.fn(),
      } as any;

      const clickEvent = {
        preventDefault: vi.fn(),
      } as any;

      // Sub-divide the 0.49s debounce into 20 sub-steps
      const subStepDt = 0.49 / 20; // ~0.0245s per sub-step
      for (let step = 0; step < 20; step++) {
        // Accumulate death timer
        mountedGame.step(subStepDt);

        expect(mountedGame.deathTimer).toBeLessThan(0.5);
        expect(mountedGame.canResurrect()).toBe(false);

        // Adversarial Hammering: Spam 10 Spacebars and 10 Clicks per sub-step (200 total)
        for (let spam = 0; spam < 10; spam++) {
          windowListeners['keydown']?.forEach((fn) => fn(spaceEvent));
          canvasListeners['click']?.forEach((fn) => fn(clickEvent));
          mountedGame.keyboard.setAction('jump', true);
        }

        // Assert player is STILL dead, resurrection has NOT occurred
        expect(
          mountedGame.player.isAlive,
          `At deathTimer=${mountedGame.deathTimer.toFixed(4)}s, player must NOT be resurrected`
        ).toBe(false);
        expect(mountedGame.player.stats.currentHealth).toBe(0);
        expect(mountedGame.elapsedTime).toBe(0);
      }

      // Clear held jump key to test discrete Spacebar resurrection
      mountedGame.keyboard.setAction('jump', false);

      // Now advance simulation past 0.500s threshold
      mountedGame.step(0.02); // deathTimer becomes ~0.51s
      expect(mountedGame.deathTimer).toBeGreaterThanOrEqual(0.5);
      expect(mountedGame.canResurrect()).toBe(true);
      expect(mountedGame.player.isAlive).toBe(false);

      // Now a SINGLE Spacebar press MUST trigger clean resurrection
      windowListeners['keydown']?.forEach((fn) => fn(spaceEvent));

      expect(mountedGame.player.isAlive).toBe(true);
      expect(mountedGame.player.stats.currentHealth).toBe(100);
      expect(mountedGame.deathTimer).toBe(0);
      expect(mountedGame.elapsedTime).toBe(0);

      mountedGame.destroy();
    });
  });

  describe('Adversarial Challenge 3: loopEpoch Invalidation & Prior Callback Discard', () => {
    it('empirically asserts prior stale RAF callbacks from earlier epochs are discarded with zero execution', () => {
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getContext: () => null,
      };
      (game as any).canvas = mockCanvas;

      game.start();
      const epoch1 = (game as any).loopEpoch;

      // Capture callback from epoch 1
      const cb1Id = Array.from(activeRafCallbacks.keys())[0];
      const cb1 = activeRafCallbacks.get(cb1Id)!;
      expect(cb1).toBeDefined();

      // Trigger restart -> epoch transitions to epoch1 + 2
      game.restart();
      const epoch2 = (game as any).loopEpoch;
      expect(epoch2).toBe(epoch1 + 2);

      // Capture callback from epoch 2
      const cb2Id = Array.from(activeRafCallbacks.keys())[0];
      const cb2 = activeRafCallbacks.get(cb2Id)!;

      // Trigger restart again -> epoch transitions to epoch2 + 2
      game.restart();
      const epoch3 = (game as any).loopEpoch;
      expect(epoch3).toBe(epoch2 + 2);

      // Instrument step and render to detect if stale callbacks invoke them
      let stepInvocations = 0;
      let renderInvocations = 0;
      const originalStep = game.step.bind(game);
      const originalRender = game.render.bind(game);

      game.step = (dt: number) => {
        stepInvocations++;
        originalStep(dt);
      };
      game.render = () => {
        renderInvocations++;
        originalRender();
      };

      const initialActiveCount = activeRafCallbacks.size;

      // ADVERSARIAL ATTACK: Manually invoke stale cb1 from epoch 1
      cb1(performance.now() + 100);

      // Assert cb1 was completely ignored
      expect(stepInvocations).toBe(0);
      expect(renderInvocations).toBe(0);
      expect(activeRafCallbacks.size).toBe(initialActiveCount);

      // ADVERSARIAL ATTACK: Manually invoke stale cb2 from epoch 2
      cb2(performance.now() + 100);

      // Assert cb2 was also completely ignored
      expect(stepInvocations).toBe(0);
      expect(renderInvocations).toBe(0);
      expect(activeRafCallbacks.size).toBe(initialActiveCount);

      // Now invoke the legitimate current callback from epoch 3
      const currentCbId = Array.from(activeRafCallbacks.keys())[0];
      const currentCb = activeRafCallbacks.get(currentCbId)!;
      activeRafCallbacks.delete(currentCbId);

      currentCb(performance.now() + 16.667);

      // Legitimate callback MUST execute step, render, and schedule the next frame
      expect(stepInvocations).toBe(1);
      expect(renderInvocations).toBe(1);
      expect(activeRafCallbacks.size).toBe(1);
    });
  });

  describe('Adversarial Challenge 4: Accumulator Bounding & Death Spiral Prevention Under Severe Lag', () => {
    it('empirically guarantees accumulator <= 1/60 even when subjected to 10-second lag spikes and high-frequency restarts', () => {
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getContext: () => null,
      };
      (game as any).canvas = mockCanvas;

      game.start();

      let subStepCount = 0;
      const originalStep = game.step.bind(game);
      game.step = (dt: number) => {
        subStepCount++;
        originalStep(dt);
      };

      // 1. Lag spike of 10 seconds
      const currentCbId = Array.from(activeRafCallbacks.keys())[0];
      const cb = activeRafCallbacks.get(currentCbId)!;
      activeRafCallbacks.delete(currentCbId);

      subStepCount = 0;
      cb(performance.now() + 10000);

      // Sub-steps must be clamped to MAX_SUB_STEPS (5), accumulator must be reset to 0
      expect(subStepCount).toBe(GrimHarvestGame.MAX_SUB_STEPS);
      expect((game as any).accumulator).toBe(0);

      // 2. Restart under dirty accumulator state
      (game as any).accumulator = 0.5; // Artificially corrupt accumulator
      game.restart();

      // Accumulator must be strictly reset to 0
      expect((game as any).accumulator).toBe(0);

      // 3. Normal frame execution
      const postRestartCbId = Array.from(activeRafCallbacks.keys())[0];
      const postRestartCb = activeRafCallbacks.get(postRestartCbId)!;
      activeRafCallbacks.delete(postRestartCbId);

      subStepCount = 0;
      postRestartCb(performance.now() + 16.667);

      expect(subStepCount).toBe(1);
      expect((game as any).accumulator).toBeLessThanOrEqual(GrimHarvestGame.FIXED_TIMESTEP + 1e-9);
    });
  });
});
