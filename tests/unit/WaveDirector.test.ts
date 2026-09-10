import { describe, it, expect, beforeEach } from 'vitest';
import { HordeManager } from '../../src/core/HordeManager';
import {
  WaveDirector,
  WavePhaseId,
} from '../../src/core/systems/WaveDirector';

describe('WaveDirector Unit Tests (Milestone M3)', () => {
  let hordeManager: HordeManager;
  let waveDirector: WaveDirector;

  beforeEach(() => {
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

  describe('Suite 1: Timeline Escalation & Phase Transitions', () => {
    it('evaluates correct phase for elapsed time thresholds', () => {
      expect(waveDirector.getCurrentPhase(0).id).toBe(WavePhaseId.AWAKENING);
      expect(waveDirector.getCurrentPhase(29.9).id).toBe(WavePhaseId.AWAKENING);

      expect(waveDirector.getCurrentPhase(30).id).toBe(WavePhaseId.THE_SWARM);
      expect(waveDirector.getCurrentPhase(59.9).id).toBe(WavePhaseId.THE_SWARM);

      expect(waveDirector.getCurrentPhase(60).id).toBe(WavePhaseId.NIGHTFALL);
      expect(waveDirector.getCurrentPhase(119.9).id).toBe(WavePhaseId.NIGHTFALL);

      expect(waveDirector.getCurrentPhase(120).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
      expect(waveDirector.getCurrentPhase(300).id).toBe(WavePhaseId.ABYSSAL_SIEGE);
    });

    it('advances current phase automatically during update ticks', () => {
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);

      // Advance past 30s
      waveDirector.update(31, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.THE_SWARM);

      // Advance past 60s
      waveDirector.update(30, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.NIGHTFALL);

      // Advance past 120s
      waveDirector.update(60, 0, 0, 0, 0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.ABYSSAL_SIEGE);
    });
  });

  describe('Suite 2: Difficulty Scaling Mathematics', () => {
    it('computes exact HP multiplier over time (1.0 + t/60 * 0.30)', () => {
      expect(waveDirector.getHPMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getHPMultiplier(60)).toBeCloseTo(1.30, 4);
      expect(waveDirector.getHPMultiplier(120)).toBeCloseTo(1.60, 4);
      expect(waveDirector.getHPMultiplier(300)).toBeCloseTo(2.50, 4);
    });

    it('computes exact speed multiplier with 1.40 ceiling clamp', () => {
      expect(waveDirector.getSpeedMultiplier(0)).toBeCloseTo(1.00, 4);
      expect(waveDirector.getSpeedMultiplier(120)).toBeCloseTo(1.15, 4);
      expect(waveDirector.getSpeedMultiplier(240)).toBeCloseTo(1.30, 4);
      expect(waveDirector.getSpeedMultiplier(600)).toBeCloseTo(1.40, 4); // Clamped
    });

    it('scales spawn interval down to minimum 0.50s', () => {
      expect(waveDirector.getSpawnInterval(0)).toBeCloseTo(2.20, 4);
      expect(waveDirector.getSpawnInterval(60)).toBeCloseTo(1.65, 4);
      expect(waveDirector.getSpawnInterval(120)).toBeCloseTo(1.10, 4);
      expect(waveDirector.getSpawnInterval(300)).toBeCloseTo(0.50, 4); // Clamped
    });

    it('scales cluster size up to maximum 30', () => {
      expect(waveDirector.getClusterSize(0)).toBe(4);
      expect(waveDirector.getClusterSize(40)).toBe(9);
      expect(waveDirector.getClusterSize(120)).toBe(19);
      expect(waveDirector.getClusterSize(300)).toBe(30); // Clamped
    });
  });

  describe('Suite 3: Enemy Type Distribution by Phase', () => {
    it('spawns 100% skeletons during Phase 1 (Awakening)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 500; i++) {
        const type = waveDirector.selectEnemyType(15);
        counts[type]++;
      }
      expect(counts.skeleton).toBe(500);
      expect(counts.ghoul).toBe(0);
      expect(counts.banshee).toBe(0);
      expect(counts.death_knight).toBe(0);
    });

    it('spawns skeletons and ghouls only during Phase 2 (The Swarm)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 1000; i++) {
        const type = waveDirector.selectEnemyType(45);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(550);
      expect(counts.ghoul).toBeGreaterThan(250);
      expect(counts.banshee).toBe(0);
      expect(counts.death_knight).toBe(0);
    });

    it('introduces banshees in Phase 3 (Nightfall)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 1000; i++) {
        const type = waveDirector.selectEnemyType(90);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(350);
      expect(counts.ghoul).toBeGreaterThan(250);
      expect(counts.banshee).toBeGreaterThan(120);
      expect(counts.death_knight).toBe(0);
    });

    it('includes death knights in Phase 4 (Abyssal Siege)', () => {
      const counts: Record<string, number> = { skeleton: 0, ghoul: 0, banshee: 0, death_knight: 0 };
      for (let i = 0; i < 2000; i++) {
        const type = waveDirector.selectEnemyType(150);
        counts[type]++;
      }
      expect(counts.skeleton).toBeGreaterThan(500);
      expect(counts.ghoul).toBeGreaterThan(500);
      expect(counts.banshee).toBeGreaterThan(300);
      expect(counts.death_knight).toBeGreaterThan(30); // ~5% of 2000 = ~100
    });
  });

  describe('Suite 4: Perimeter Spawning & Viewport Culling Exclusion', () => {
    it('guarantees 100% of perimeter points lie strictly outside camera viewport', () => {
      const camX = 200;
      const camY = 300;
      const w = 960;
      const h = 540;

      for (let i = 0; i < 200; i++) {
        const pt = waveDirector.getPerimeterPoint(camX, camY);
        const insideX = pt.x >= camX && pt.x <= camX + w;
        const insideY = pt.y >= camY && pt.y <= camY + h;

        // Both insideX and insideY CANNOT be true at the same time
        const isInsideFrustum = insideX && insideY;
        expect(isInsideFrustum).toBe(false);

        // Verify point is within arena boundaries
        expect(pt.x).toBeGreaterThanOrEqual(-2000);
        expect(pt.x).toBeLessThanOrEqual(2000);
        expect(pt.y).toBeGreaterThanOrEqual(-2000);
        expect(pt.y).toBeLessThanOrEqual(2000);
      }
    });

    it('guarantees 0 on-screen points across 1,000 perimeter spawns at extreme boundary positions', () => {
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
          const pt = waveDirector.getPerimeterPoint(pos.camX, pos.camY);
          const insideFrustum = pt.x >= pos.camX && pt.x <= pos.camX + 960 && pt.y >= pos.camY && pt.y <= pos.camY + 540;
          expect(insideFrustum).toBe(false);

          expect(pt.x).toBeGreaterThanOrEqual(-2000);
          expect(pt.x).toBeLessThanOrEqual(2000);
          expect(pt.y).toBeGreaterThanOrEqual(-2000);
          expect(pt.y).toBeLessThanOrEqual(2000);
        }
      }
    });
  });

  describe('Suite 5: Milestone Events & Mini-Boss Scheduling', () => {
    it('triggers pincer rush at 30 seconds exactly once', () => {
      let notified = false;
      const director = new WaveDirector(hordeManager, {
        onWaveEvent: (e) => {
          if (e.id === 'pincer_30') notified = true;
        },
      });

      // Step up to 29s -> not triggered
      director.update(29, 0, 0, 0, 0);
      expect(notified).toBe(false);
      const countBefore = hordeManager.getActiveCount();

      // Step past 30s -> triggered
      director.update(2, 0, 0, 0, 0);
      expect(notified).toBe(true);
      expect(hordeManager.getActiveCount()).toBeGreaterThan(countBefore);
    });

    it('triggers Death Knight mini-boss at 120 seconds with notification', () => {
      let bossEvent: any = null;
      const director = new WaveDirector(hordeManager, {
        onWaveEvent: (e) => {
          if (e.id === 'boss_120') bossEvent = e;
        },
      });

      director.update(121, 0, 0, 0, 0);
      expect(bossEvent).not.toBeNull();
      expect(bossEvent.name).toContain('Death Knight');

      const active = hordeManager.getActiveEnemies();
      const deathKnights = active.filter((e) => e.type.toLowerCase() === 'death_knight');
      expect(deathKnights.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Suite 6: Density Throttling & Pool Conservation', () => {
    it('throttles ambient cluster spawns when active count reaches capacity cap', () => {
      // Artificially saturate pool to cap
      const cap = waveDirector.getMaxActiveCap(10); // ~230
      for (let i = 0; i < cap + 50; i++) {
        hordeManager.spawn('skeleton', i, i);
      }

      const countBefore = hordeManager.getActiveCount();
      // Tick director for 5 seconds (multiple spawn intervals)
      for (let t = 0; t < 5; t++) {
        waveDirector.update(1.0, 0, 0, 0, 0);
      }

      // Should not have spawned ambient clusters because cap was exceeded
      expect(hordeManager.getActiveCount()).toBe(countBefore);
    });

    it('resets wave director state cleanly for new run', () => {
      waveDirector.update(150, 0, 0, 0, 0);
      expect(waveDirector.elapsedTime).toBe(150);

      waveDirector.reset();
      expect(waveDirector.elapsedTime).toBe(0);
      expect(waveDirector.getCurrentPhase().id).toBe(WavePhaseId.AWAKENING);
    });
  });
});
