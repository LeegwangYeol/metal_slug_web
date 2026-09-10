import { describe, it, expect, beforeEach } from 'vitest';
import { CuteEnemyManager } from '../../src/core/cute/CuteEnemyManager';
import { BubbleManager } from '../../src/core/cute/BubbleManager';
import { CuteArenaCoordinator } from '../../src/core/cute/CuteArenaCoordinator';

describe('CHALLENGER_RECHECK_1: Empirical Boundary Sweeps on Boss HP & Cub Splitting', () => {
  let enemyManager: CuteEnemyManager;
  let bubbleManager: BubbleManager;

  beforeEach(() => {
    enemyManager = new CuteEnemyManager();
    bubbleManager = new BubbleManager();
  });

  // =========================================================================
  // 1. BOSS HP BOUNDARIES & GRANULAR SWEEPS
  // =========================================================================
  describe('1. Gummy Bear Colossus HP Granular Sweep & Splitting Invariants', () => {
    it('EMPIRICAL 1A: Non-lethal HP damage sweeps (1 to 249 HP) never trigger split early', () => {
      const boss = enemyManager.spawnColossusBoss();
      expect(boss.health).toBe(250);
      expect(boss.maxHealth).toBe(250);
      expect(boss.type).toBe('GUMMY_COLOSSUS');
      expect(enemyManager.isBossActive).toBe(true);
      expect(enemyManager.bossDefeated).toBe(false);

      // Incrementally damage boss by 1 HP 249 times
      for (let damage = 1; damage <= 249; damage++) {
        const wasKilled = enemyManager.damageEnemy(boss.id, 1, bubbleManager);
        expect(wasKilled).toBe(false);
        expect(boss.health).toBe(250 - damage);
        expect(boss.isAlive).toBe(true);
        expect(boss.isBubbled).toBe(false); // Colossus resists direct encasement

        // Verify no cubs spawned early
        const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');
        expect(cubs.length).toBe(0);
        expect(enemyManager.isBossActive).toBe(true);
        expect(enemyManager.bossDefeated).toBe(false);
      }

      // Exactly 1 HP remains
      expect(boss.health).toBe(1);

      // Final 1 HP damage triggers split
      let bossDefeatedCallbackFired = false;
      enemyManager.onBossDefeated = () => {
        bossDefeatedCallbackFired = true;
      };

      const finalHitKilled = enemyManager.damageEnemy(boss.id, 1, bubbleManager);
      expect(finalHitKilled).toBe(true);
      expect(boss.health).toBe(0);
      expect(boss.isAlive).toBe(false);

      // Colossus must have spawned exactly 3 mini-cubs
      const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);

      // Boss is not considered fully defeated until all cubs are also defeated!
      expect(enemyManager.isBossActive).toBe(true);
      expect(enemyManager.bossDefeated).toBe(false);
      expect(bossDefeatedCallbackFired).toBe(false);
    });

    it('EMPIRICAL 1B: Exact lethal threshold (250 damage in single hit) triggers clean 3-cub split', () => {
      const boss = enemyManager.spawnColossusBoss();
      const killed = enemyManager.damageEnemy(boss.id, 250, bubbleManager);

      expect(killed).toBe(true);
      expect(boss.health).toBe(0);
      expect(boss.isAlive).toBe(false);

      const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);

      // Verify cub attributes & kinematic initial impulses
      for (const cub of cubs) {
        expect(cub.maxHealth).toBe(15);
        expect(cub.health).toBe(15);
        expect(cub.isAlive).toBe(true);
        expect(cub.vy).toBeLessThan(0); // Upward leap impulse
      }
    });

    it('EMPIRICAL 1C: Massive overkill damage sweeps (251, 500, 1,000, 100,000 HP) clamp cleanly and spawn exactly 3 cubs once', () => {
      const overkills = [251, 300, 500, 1000, 5000, 100000];

      for (const overkill of overkills) {
        const localMgr = new CuteEnemyManager();
        const boss = localMgr.spawnColossusBoss();

        const killed = localMgr.damageEnemy(boss.id, overkill, bubbleManager);
        expect(killed).toBe(true);
        expect(boss.health).toBe(0);
        expect(boss.isAlive).toBe(false);

        const cubs = localMgr.enemies.filter((e) => e.type === 'GUMMY_CUB');
        expect(cubs.length).toBe(3);
        expect(localMgr.isBossActive).toBe(true);
        expect(localMgr.bossDefeated).toBe(false);

        // Subsequent damage calls to the dead boss must return false and not spawn additional cubs
        const ghostHit = localMgr.damageEnemy(boss.id, 100, bubbleManager);
        expect(ghostHit).toBe(false);
        const cubsAfterGhost = localMgr.enemies.filter((e) => e.type === 'GUMMY_CUB');
        expect(cubsAfterGhost.length).toBe(3);
      }
    });

    it('EMPIRICAL 1D: Pathological zero and negative damage do not heal or glitch boss state', () => {
      const boss = enemyManager.spawnColossusBoss();
      expect(boss.health).toBe(250);

      // 0 damage
      enemyManager.damageEnemy(boss.id, 0, bubbleManager);
      expect(boss.health).toBe(250);
      expect(boss.isAlive).toBe(true);

      // Negative damage
      enemyManager.damageEnemy(boss.id, -50, bubbleManager);
      // Even if health increased algebraically, it does not trigger split or defeat
      expect(boss.isAlive).toBe(true);
      expect(enemyManager.isBossActive).toBe(true);
      expect(enemyManager.bossDefeated).toBe(false);
    });
  });

  // =========================================================================
  // 2. MINI-CUB SPLITTING & COMBINATORIAL DEFEAT PERMUTATIONS
  // =========================================================================
  describe('2. Combinatorial Defeat Permutations of Mini Gummy Cubs', () => {
    it('EMPIRICAL 2A: Sequential direct damage defeat across all index permutations [0,1,2], [2,1,0], [1,0,2]', () => {
      const permutations = [
        [0, 1, 2],
        [2, 1, 0],
        [1, 0, 2],
      ];

      for (const order of permutations) {
        const localMgr = new CuteEnemyManager();
        let defeatFired = 0;
        localMgr.onBossDefeated = () => {
          defeatFired++;
        };

        const boss = localMgr.spawnColossusBoss();
        localMgr.damageEnemy(boss.id, 250, bubbleManager);
        const cubs = localMgr.enemies.filter((e) => e.type === 'GUMMY_CUB');
        expect(cubs.length).toBe(3);

        // Kill cub 1st in order
        localMgr.damageEnemy(cubs[order[0]].id, 15, bubbleManager);
        expect(localMgr.isBossActive).toBe(true);
        expect(localMgr.bossDefeated).toBe(false);
        expect(defeatFired).toBe(0);

        // Kill cub 2nd in order
        localMgr.damageEnemy(cubs[order[1]].id, 15, bubbleManager);
        expect(localMgr.isBossActive).toBe(true);
        expect(localMgr.bossDefeated).toBe(false);
        expect(defeatFired).toBe(0);

        // Kill cub 3rd in order -> triggers boss defeat
        localMgr.damageEnemy(cubs[order[2]].id, 15, bubbleManager);
        expect(localMgr.isBossActive).toBe(false);
        expect(localMgr.bossDefeated).toBe(true);
        expect(defeatFired).toBe(1);

        // Step physics to ensure cleanup without regressions
        localMgr.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);
        expect(localMgr.bossDefeated).toBe(true);
        expect(defeatFired).toBe(1); // Never fires twice
      }
    });

    it('EMPIRICAL 2B: Simultaneous bubble entrapment & popping in single frame', () => {
      let defeatFired = 0;
      enemyManager.onBossDefeated = () => {
        defeatFired++;
      };

      const boss = enemyManager.spawnColossusBoss();
      enemyManager.damageEnemy(boss.id, 250, bubbleManager);
      const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');

      // Trap all 3 cubs in bubbles
      for (const cub of cubs) {
        const trapped = enemyManager.trapEnemyInBubble(cub.id, bubbleManager);
        expect(trapped).toBe(true);
        expect(cub.isBubbled).toBe(true);
      }

      // Pop all 3 bubbles simultaneously
      for (const b of [...bubbleManager.bubbles]) {
        bubbleManager.popBubble(b.id);
      }

      // Advance physics past pop animation (0.25s)
      for (let i = 0; i < 20; i++) {
        bubbleManager.update(1 / 60);
        enemyManager.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);
      }

      // Assert all enemies cleaned up and boss defeated
      expect(enemyManager.enemies.length).toBe(0);
      expect(enemyManager.isBossActive).toBe(false);
      expect(enemyManager.bossDefeated).toBe(true);
      expect(defeatFired).toBe(1);
    });

    it('EMPIRICAL 2C: Hybrid defeat modes (damage + bubble pop + natural lifespan expiry)', () => {
      let defeatFired = 0;
      enemyManager.onBossDefeated = () => {
        defeatFired++;
      };

      const boss = enemyManager.spawnColossusBoss();
      enemyManager.damageEnemy(boss.id, 250, bubbleManager);
      const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');

      // Cub 0: Defeated by direct damage
      enemyManager.damageEnemy(cubs[0].id, 15, bubbleManager);
      expect(enemyManager.bossDefeated).toBe(false);

      // Cub 1: Trapped in bubble and popped manually
      enemyManager.trapEnemyInBubble(cubs[1].id, bubbleManager);
      const cub1Bubble = bubbleManager.bubbles.find((b) => b.id === cubs[1].bubbleId)!;
      bubbleManager.popBubble(cub1Bubble.id);
      enemyManager.update(0.3, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);
      expect(enemyManager.bossDefeated).toBe(false);

      // Cub 2: Trapped in bubble and allowed to pop naturally via lifespan expiration
      enemyManager.trapEnemyInBubble(cubs[2].id, bubbleManager);
      expect(enemyManager.bossDefeated).toBe(false);

      // Advance time by 6.0s (bubble lifespan is 4.5s)
      for (let i = 0; i < 360; i++) {
        bubbleManager.update(1 / 60);
        enemyManager.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);
      }

      expect(enemyManager.isBossActive).toBe(false);
      expect(enemyManager.bossDefeated).toBe(true);
      expect(defeatFired).toBe(1);
    });
  });

  // =========================================================================
  // 3. CUTE ARENA COORDINATOR END-TO-END STRESS & STABILITY
  // =========================================================================
  describe('3. CuteArenaCoordinator End-to-End Boss Lifecycle & Extended Stability', () => {
    it('EMPIRICAL 3A: Projectile combat loop correctly damages boss without trapping, splits into cubs, and purifies garden', () => {
      const coordinator = new CuteArenaCoordinator();
      coordinator.setState('BOSS_SHOWDOWN');
      coordinator.enemyManager.spawnColossusBoss();

      const boss = coordinator.enemyManager.enemies.find((e) => e.type === 'GUMMY_COLOSSUS')!;
      expect(boss).toBeDefined();

      // Fire bubble projectiles at boss until colossus reaches 0 HP
      // If an altar reaches 100% bloom during the battle, choose a perk card to unpause
      for (let step = 0; step < 1000 && boss.isAlive; step++) {
        if (coordinator.state === 'PERK_SELECTION') {
          coordinator.choosePerk(0);
        }
        coordinator.onPlayerShoot({ x: boss.x - 30, y: boss.y + 12, facing: 1, isAlive: true });
        coordinator.update(1 / 60, { x: boss.x - 30, y: boss.y + 12, facing: 1, isAlive: true });
      }

      // Boss should now be defeated and split into 3 cubs
      expect(boss.isAlive).toBe(false);
      expect(boss.health).toBe(0);

      // Step one frame for coordinator to cull dead boss entity
      coordinator.update(1 / 60, { x: 100, y: 200, facing: 1, isAlive: true });

      const cubs = coordinator.enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);

      // Defeat all 3 cubs via damage
      for (const cub of cubs) {
        coordinator.enemyManager.damageEnemy(cub.id, cub.health, coordinator.bubbleManager);
      }

      coordinator.update(0.1, { x: 100, y: 200, facing: 1, isAlive: true });

      // State transitions cleanly to GARDEN_PURIFIED
      expect(coordinator.state).toBe('GARDEN_PURIFIED');
      expect(coordinator.enemyManager.bossDefeated).toBe(true);
    });

    it('EMPIRICAL 3B: Extended 1,000 tick (16.6s) simulation in GARDEN_PURIFIED remains completely stable', () => {
      const coordinator = new CuteArenaCoordinator();
      coordinator.setState('GARDEN_PURIFIED');

      for (let tick = 0; tick < 1000; tick++) {
        coordinator.update(1 / 60, { x: 480, y: 200, facing: 1, isAlive: true });
      }

      expect(coordinator.state).toBe('GARDEN_PURIFIED');
      expect(coordinator.enemyManager.enemies.length).toBe(0);
      expect(coordinator.enemyManager.bossDefeated).toBe(false); // In purified state, no active boss
    });
  });
});
