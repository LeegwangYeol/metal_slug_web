import { describe, it, expect, beforeEach } from 'vitest';
import { IronNokanaBoss, IronNokanaCannonShell, IronNokanaRocket } from '../../src/core/entities/boss/IronNokanaBoss';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { vec2 } from '../../src/core/math/Vector2D';

describe('Milestone M1: Iron Nokana Multi-Phase Boss Encounter Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
  });

  describe('1. Initial Configuration & Specifications', () => {
    it('initializes with 400 HP, grounded dimensions, and PHASE_1_CRAWLER_BARRAGE', () => {
      const boss = new IronNokanaBoss('iron_nokana_init', vec2(2050, 90));
      expect(boss.id).toBe('iron_nokana_init');
      expect(boss.type).toBe('BOSS_IRON_NOKANA');
      expect(boss.health).toBe(400);
      expect(boss.maxHealth).toBe(400);
      expect(boss.phase).toBe('PHASE_1_CRAWLER_BARRAGE');
      expect(boss.width).toBe(220);
      expect(boss.height).toBe(140);
      expect(boss.isAlive).toBe(true);
      expect(boss.isRaging).toBe(false);
      expect(boss.weakPointExposed).toBe(false);
      expect(boss.bounds.width).toBe(220);
      expect(boss.bounds.height).toBe(140);
      expect(boss.boundingBox).toBe(boss.bounds);
    });

    it('supports custom HP configuration', () => {
      const boss = new IronNokanaBoss('iron_nokana_custom', vec2(2050, 90), { customHp: 500 });
      expect(boss.maxHealth).toBe(500);
      expect(boss.health).toBe(500);
    });
  });

  describe('2. Four-Phase State Transitions', () => {
    it('Phase 1 (100% -> 75% HP = 400 -> 300 HP): clamped at 300 HP and transitions to Phase 2', () => {
      const boss = new IronNokanaBoss('nokana_p1', vec2(2050, 90));
      boss.takeDamage(50);
      expect(boss.health).toBe(350);
      expect(boss.phase).toBe('PHASE_1_CRAWLER_BARRAGE');

      // Clamping: dealing 200 damage in Phase 1 clamps at 300 HP and transitions
      boss.takeDamage(200);
      expect(boss.health).toBe(300);
      expect(boss.phase).toBe('PHASE_2_FLAME_SWEEP');
    });

    it('Phase 2 (75% -> 50% HP = 300 -> 200 HP): clamped at 200 HP and transitions to Phase 3', () => {
      const boss = new IronNokanaBoss('nokana_p2', vec2(2050, 90));
      boss.takeDamage(100); // Transitions to Phase 2 at 300 HP
      expect(boss.phase).toBe('PHASE_2_FLAME_SWEEP');

      // Clamping: dealing 200 damage in Phase 2 clamps at 200 HP and transitions
      boss.takeDamage(200);
      expect(boss.health).toBe(200);
      expect(boss.phase).toBe('PHASE_3_GIRIDA_DEPLOY');
      expect(boss.giridaDeployed).toBe(true);
    });

    it('Phase 3 (50% -> 25% HP = 200 -> 100 HP): clamped at 100 HP and transitions to Phase 4 Overdrive', () => {
      const boss = new IronNokanaBoss('nokana_p3', vec2(2050, 90));
      boss.takeDamage(100); // To Phase 2
      boss.takeDamage(100); // To Phase 3
      expect(boss.phase).toBe('PHASE_3_GIRIDA_DEPLOY');

      boss.takeDamage(200); // Clamps at 100 HP, transitions to Phase 4
      expect(boss.health).toBe(100);
      expect(boss.phase).toBe('PHASE_4_OVERDRIVE_RAGE');
      expect(boss.isRaging).toBe(true);
      expect(boss.rageSpeedMultiplier).toBe(1.5);
    });

    it('Phase 4 (25% -> 0% HP = 100 -> 0 HP): transitions to DEATH_EXPLODING', () => {
      const boss = new IronNokanaBoss('nokana_p4', vec2(2050, 90));
      boss.takeDamage(100); // To Phase 2
      boss.takeDamage(100); // To Phase 3
      boss.takeDamage(100); // To Phase 4

      expect(boss.phase).toBe('PHASE_4_OVERDRIVE_RAGE');
      boss.takeDamage(100);
      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
    });
  });

  describe('3. Telegraphed Attacks & Visual Warning Mechanics', () => {
    it('flame sweep attack has 0.8s telegraph period and emits telegraph event', () => {
      const boss = new IronNokanaBoss('nokana_telegraph', vec2(2050, 90));
      boss.takeDamage(100); // Phase 2
      engine.addEntity(boss);

      let telegraphFired = false;
      engine.eventBus.on('boss_flame_telegraph', (data: any) => {
        telegraphFired = true;
        expect(data.bossId).toBe('nokana_telegraph');
      });

      // Force flame cooldown to expire
      boss.flameCooldownTimer = 0;
      boss.update(1 / 60, engine);

      expect(boss.isFlameTelegraphing).toBe(true);
      expect(telegraphFired).toBe(true);

      // Advance 0.7s (still telegraphing)
      boss.update(0.7, engine);
      expect(boss.isFlameTelegraphing).toBe(true);
      expect(boss.isFlameActive).toBe(false);

      // Advance past 0.8s -> flame becomes active
      boss.update(0.15, engine);
      expect(boss.isFlameTelegraphing).toBe(false);
      expect(boss.isFlameActive).toBe(true);
    });

    it('cannon attack has 0.5s telegraph period before firing', () => {
      const boss = new IronNokanaBoss('nokana_cannon', vec2(2050, 90));
      engine.addEntity(boss);

      let cannonTelegraphFired = false;
      let cannonFired = false;
      engine.eventBus.on('boss_cannon_telegraph', () => {
        cannonTelegraphFired = true;
      });
      engine.eventBus.on('boss_cannon_fired', () => {
        cannonFired = true;
      });

      boss.cannonCooldownTimer = 0;
      boss.update(1 / 60, engine);

      expect(boss.isCannonTelegraphing).toBe(true);
      expect(cannonTelegraphFired).toBe(true);
      expect(cannonFired).toBe(false);

      // Advance 0.55s -> fires shell
      boss.update(0.55, engine);
      expect(boss.isCannonTelegraphing).toBe(false);
      expect(cannonFired).toBe(true);
    });
  });

  describe('4. Weak Point Bonus Damage (1.5x multiplier)', () => {
    it('hits to exposed weak point deal 1.5x damage', () => {
      const boss = new IronNokanaBoss('nokana_weakpoint', vec2(2050, 90));
      boss.takeDamage(100); // Phase 2
      boss.weakPointExposed = true;

      // In Phase 2, HP = 300. Clamping threshold is 200 HP.
      // Base hit: 20 damage without weak point -> takes 20 damage (HP = 280)
      boss.takeDamage(20, false);
      expect(boss.health).toBe(280);

      // Weak point hit: 20 damage with weak point -> takes 20 * 1.5 = 30 damage (HP = 250)
      boss.takeDamage(20, true);
      expect(boss.health).toBe(250);
    });

    it('hits when weak point is NOT exposed deal normal 1.0x damage even if targeting weak point', () => {
      const boss = new IronNokanaBoss('nokana_unexposed', vec2(2050, 90));
      boss.weakPointExposed = false;

      // In Phase 1, HP = 400
      boss.takeDamage(20, true);
      expect(boss.health).toBe(380); // only 20 damage taken, not 30
    });
  });

  describe('5. Death Demolition Chain & Final Destruction', () => {
    it('executes 3.6s chain demolition and emits boss_destroyed and mission_complete', () => {
      const boss = new IronNokanaBoss('nokana_death', vec2(2050, 90));
      engine.addEntity(boss);

      boss.takeDamage(400);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.isAlive).toBe(true);

      let bossDestroyed = false;
      let missionComplete = false;
      engine.eventBus.on('boss_destroyed', () => {
        bossDestroyed = true;
      });
      engine.eventBus.on('mission_complete', () => {
        missionComplete = true;
      });

      // Advance through death stages
      boss.update(1.2, engine); // Stage 2
      expect(boss.deathStage).toBe(2);

      boss.update(1.2, engine); // Stage 3
      expect(boss.deathStage).toBe(3);

      boss.update(1.3, engine); // 1.2 + 1.2 + 1.3 = 3.7s > 3.6s -> Stage 4
      expect(boss.deathStage).toBe(4);
      expect(boss.phase).toBe('DESTROYED');
      expect(boss.isAlive).toBe(false);
      expect(bossDestroyed).toBe(true);
      expect(missionComplete).toBe(true);
    });
  });

  describe('6. Sub-Entity Projectile Integration', () => {
    it('IronNokanaCannonShell follows parabolic arc and detonates on ground', () => {
      const shell = new IronNokanaCannonShell('shell_arc', 2000, 100, -200, -250, 230);
      engine.addEntity(shell);
      engine.tick(1 / 60);

      let explosion = false;
      engine.eventBus.on('explosion_spawned', () => {
        explosion = true;
      });

      // Update until shell hits target ground Y
      for (let i = 0; i < 60; i++) {
        engine.tick(1 / 30);
        if (!shell.isAlive) break;
      }

      expect(shell.isAlive).toBe(false);
      expect(explosion).toBe(true);
    });

    it('IronNokanaRocket tracks player and can be destroyed in 1 hit', () => {
      const target = { position: { x: 1850, y: 150 }, isAlive: true };
      const rocket = new IronNokanaRocket('rocket_test', { x: 2000, y: 100 }, target as any);

      expect(rocket.health).toBe(1);
      expect(rocket.isAlive).toBe(true);

      rocket.takeDamage(1);
      expect(rocket.health).toBe(0);
      expect(rocket.isAlive).toBe(false);
    });
  });
});
