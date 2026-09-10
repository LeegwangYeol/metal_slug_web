import { describe, it, expect, beforeEach } from 'vitest';
import { BubbleManager } from '../../src/core/cute/BubbleManager';
import { CuteEnemyManager } from '../../src/core/cute/CuteEnemyManager';
import { CuteArenaCoordinator } from '../../src/core/cute/CuteArenaCoordinator';

describe('Adversarial M2 Empirical Challenge: Bubble Combat & Cascade Combo Stress', () => {

  describe('Challenge 1: High Density Bubble Cascade, Combo Scaling & Fever Rush', () => {
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      bubbleManager = new BubbleManager();
    });

    it('handles 100 simultaneous bubbles in a cascade chain without stack overflow or performance degradation', () => {
      const count = 100;
      const bubbleIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const b = bubbleManager.trapEnemy(50 + i * 40, 200, {
          id: `foe_dense_${i}`,
          type: 'MARSHMALLOW_SLIME',
          maxHp: 1,
          remainingHp: 1,
          width: 20,
          height: 20,
          facing: 1,
        });
        bubbleIds.push(b.id);
      }

      expect(bubbleManager.bubbles.length).toBe(count);

      const start = performance.now();
      bubbleManager.popBubble(bubbleIds[0]);
      const elapsed = performance.now() - start;

      // All 100 bubbles cascade-popped
      const poppingCount = bubbleManager.bubbles.filter(b => b.state === 'POPPING').length;
      expect(poppingCount).toBe(count);

      // Combo reached 100, multiplier capped at 10x
      expect(bubbleManager.comboCount).toBe(count);
      expect(bubbleManager.getComboMultiplier(bubbleManager.comboCount)).toBe(10);
      expect(bubbleManager.getComboTitle(bubbleManager.comboCount)).toBe('★ MIRACLE BLOOM! ★');

      // 100 bubbles * 6 shards = 600 star shards generated
      expect(bubbleManager.shards.length).toBe(count * 6);

      // Drops generated: each bubble drops min(2 + combo, 8) items -> 8 items * 100 = 800 pickups
      expect(bubbleManager.pickups.length).toBeGreaterThanOrEqual(700);

      // Execution time must be < 50ms (synchronous recursion limit safety)
      expect(elapsed).toBeLessThan(50);
    });

    it('verifies 6-shard radial symmetry, speed, and lifetime invariants under stress', () => {
      const b = bubbleManager.trapEnemy(300, 200, {
        id: 'foe_symmetry',
        type: 'HONEY_BEE',
        maxHp: 1,
        remainingHp: 1,
        width: 22,
        height: 22,
        facing: 1,
      });

      const shards = b.pop(5);
      expect(shards.length).toBe(6);

      for (let k = 0; k < 6; k++) {
        const shard = shards[k];
        const expectedAngle = k * (Math.PI / 3);
        expect(shard.angle).toBeCloseTo(expectedAngle, 5);
        expect(shard.maxAge).toBe(0.35);

        const speed = Math.hypot(shard.vx, shard.vy);
        expect(speed).toBeCloseTo(320, 2);
      }
    });

    it('verifies combo timer countdown and reset after 2.2s inactivity', () => {
      const b = bubbleManager.trapEnemy(100, 100, {
        id: 'foe_timer',
        type: 'MARSHMALLOW_SLIME',
        maxHp: 1,
        remainingHp: 1,
        width: 20,
        height: 20,
        facing: 1,
      });

      bubbleManager.popBubble(b.id);
      expect(bubbleManager.comboCount).toBe(1);
      expect(bubbleManager.comboTimer).toBe(2.2);

      // Update 1.0s -> combo persists
      bubbleManager.update(1.0);
      expect(bubbleManager.comboCount).toBe(1);
      expect(bubbleManager.comboTimer).toBeCloseTo(1.2, 2);

      // Update 1.3s (total 2.3s > 2.2s) -> combo resets
      bubbleManager.update(1.3);
      expect(bubbleManager.comboCount).toBe(0);
      expect(bubbleManager.comboTimer).toBe(0);
    });

    it('verifies Rainbow Sugar Rush activates on pickup vacuum and decays over 8.0s', () => {
      // Add 20 candies worth of charge
      for (let i = 0; i < 20; i++) {
        bubbleManager.addFeverCharge(0.05);
      }

      expect(bubbleManager.isFeverActive).toBe(true);
      expect(bubbleManager.feverMeter).toBe(1.0);
      expect(bubbleManager.feverTimeRemaining).toBe(8.0);

      // Step 4.0s
      bubbleManager.update(4.0);
      expect(bubbleManager.isFeverActive).toBe(true);
      expect(bubbleManager.feverTimeRemaining).toBeCloseTo(4.0, 1);
      expect(bubbleManager.feverMeter).toBeCloseTo(0.5, 1);

      // Step 4.1s -> fever expires
      bubbleManager.update(4.1);
      expect(bubbleManager.isFeverActive).toBe(false);
      expect(bubbleManager.feverMeter).toBe(0);
      expect(bubbleManager.feverTimeRemaining).toBe(0);
    });
  });

  describe('Challenge 2: Gummy Bear Colossus Defeat & Mini-Cub Splitting Failure Modes', () => {
    let enemyManager: CuteEnemyManager;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      enemyManager = new CuteEnemyManager();
      bubbleManager = new BubbleManager();
    });

    it('[CRITICAL BUG 1] Defeating all mini-cubs via damageEnemy fails to set bossDefeated and onBossDefeated due to dead entity remaining in enemies array during check', () => {
      let bossDefeatedFired = false;
      enemyManager.onBossDefeated = () => {
        bossDefeatedFired = true;
      };

      const boss = enemyManager.spawnColossusBoss();
      enemyManager.damageEnemy(boss.id, 250, bubbleManager);

      const cubs = enemyManager.enemies.filter(e => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);

      // Defeat all 3 cubs
      for (const cub of cubs) {
        enemyManager.damageEnemy(cub.id, cub.health, bubbleManager);
      }

      // Step physics
      enemyManager.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);

      // Empirical verification:
      // Line 228 check '!this.enemies.some((e) => e.type === "GUMMY_COLOSSUS" || e.type === "GUMMY_CUB")'
      // evaluated to false because dead enemies were still in this.enemies when damageEnemy checked!
      // Consequently, bossDefeated is false and onBossDefeated was never invoked!
      expect({
        isBossActive: enemyManager.isBossActive,
        bossDefeated: enemyManager.bossDefeated,
        bossDefeatedFired,
      }).toEqual({
        isBossActive: false,
        bossDefeated: true,
        bossDefeatedFired: true,
      });
    });

    it('[CRITICAL BUG 2] Defeating mini-cubs via bubble popping in update() completely bypasses boss defeat logic and leaves isBossActive stuck true', () => {
      let bossDefeatedFired = false;
      enemyManager.onBossDefeated = () => {
        bossDefeatedFired = true;
      };

      const boss = enemyManager.spawnColossusBoss();
      enemyManager.damageEnemy(boss.id, 250, bubbleManager);

      const cubs = enemyManager.enemies.filter(e => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);

      // Trap all cubs in bubbles
      for (const cub of cubs) {
        enemyManager.trapEnemyInBubble(cub.id, bubbleManager);
        expect(cub.isBubbled).toBe(true);
      }

      // Pop all bubbles
      for (const b of [...bubbleManager.bubbles]) {
        bubbleManager.popBubble(b.id);
      }

      // Advance physics past popDuration (0.25s)
      for (let step = 0; step < 20; step++) {
        bubbleManager.update(1 / 60);
        enemyManager.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);
      }

      // All cubs are gone
      expect(enemyManager.enemies.length).toBe(0);

      // Empirical verification:
      // CuteEnemyManager.update() removes popped enemies without checking isBossActive or triggering onBossDefeated
      expect({
        isBossActive: enemyManager.isBossActive,
        bossDefeated: enemyManager.bossDefeated,
        bossDefeatedFired,
      }).toEqual({
        isBossActive: false,
        bossDefeated: true,
        bossDefeatedFired: true,
      });
    });

    it('[CRITICAL BUG 3] Player bubble projectile in CuteArenaCoordinator traps 250 HP boss instantly, bypassing combat and mini-cub split', () => {
      const coordinator = new CuteArenaCoordinator();
      coordinator.setState('BOSS_SHOWDOWN');
      coordinator.enemyManager.spawnColossusBoss();

      const boss = coordinator.enemyManager.enemies.find(e => e.type === 'GUMMY_COLOSSUS')!;
      expect(boss).toBeDefined();
      expect(boss.isBubbled).toBe(false);

      // Player fires bubble at boss
      coordinator.onPlayerShoot({ x: boss.x - 10, y: boss.y, facing: 1, isAlive: true });
      coordinator.update(1 / 60, { x: 100, y: 200, facing: 1, isAlive: true });

      // In CuteArenaCoordinator.ts line 324, there is no check for enemy.type !== 'GUMMY_COLOSSUS'
      // As a result, the 250 HP Colossus Boss is trapped in a bubble by a single player shot!
      expect(boss.isBubbled).toBe(false);
    });

    it('[CRITICAL BUG 4] trapEnemyInBubble in damageEnemy fails silently because enemy.isAlive is set to false before trapping', () => {
      const slime = enemyManager.spawnEnemy('MARSHMALLOW_SLIME', 200, 200);
      expect(slime.isAlive).toBe(true);

      // Fatal damage with bubbleManager supplied
      enemyManager.damageEnemy(slime.id, 1, bubbleManager);

      // CuteEnemyManager line 216 sets enemy.isAlive = false, then calls trapEnemyInBubble(enemy.id)
      // trapEnemyInBubble filters by 'e.isAlive', which is already false!
      // Thus slime is NEVER trapped in bubble upon defeat!
      expect(slime.isBubbled).toBe(true);
      expect(bubbleManager.bubbles.length).toBe(1);
    });

    it('[CRITICAL BUG 5] CuteArenaCoordinator end-to-end boss defeat deadlocks in BOSS_SHOWDOWN and never transitions to GARDEN_PURIFIED', () => {
      const coordinator = new CuteArenaCoordinator();
      // Skip intro
      coordinator.update(2.0, { x: 100, y: 200, facing: 1, isAlive: true });

      // Fast-forward to boss showdown
      coordinator.enemyManager.enemies.length = 0;
      coordinator.waveNumber = 3;
      coordinator.update(0.1, { x: 100, y: 200, facing: 1, isAlive: true });

      expect(coordinator.state).toBe('BOSS_SHOWDOWN');
      const boss = coordinator.enemyManager.enemies.find(e => e.type === 'GUMMY_COLOSSUS')!;

      // Defeat boss
      coordinator.enemyManager.damageEnemy(boss.id, 250, coordinator.bubbleManager);

      // Defeat all 3 mini cubs
      const cubs = coordinator.enemyManager.enemies.filter(e => e.type === 'GUMMY_CUB');
      for (const cub of cubs) {
        coordinator.enemyManager.damageEnemy(cub.id, cub.health, coordinator.bubbleManager);
      }

      coordinator.update(0.5, { x: 100, y: 200, facing: 1, isAlive: true });

      // Game state should advance to victory celebration
      expect(coordinator.state).toBe('GARDEN_PURIFIED');
    });
  });
});
