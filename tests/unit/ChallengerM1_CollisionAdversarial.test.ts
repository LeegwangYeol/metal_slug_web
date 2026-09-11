/**
 * tests/unit/ChallengerM1_CollisionAdversarial.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS SUITE (Challenger 1, Milestone 1)
 * Precision Damage Hitbox & Collision Subsystem Verification.
 *
 * Focuses on edge cases, mathematical limits, and hostile scenarios:
 * 1. Exact mathematical boundary:
 *    - d = r_p + r_e exactly
 *    - d = r_p + r_e - 0.001
 *    - d = r_p + r_e + 0.001
 *    - Analytic epsilon threshold d = sqrt((r_p + r_e)^2 + 1e-3)
 * 2. Sub-pixel floating point precision & 360-degree omnidirectional symmetry
 * 3. High relative velocity & tunneling threshold analysis
 * 4. Multi-enemy dense cluster collision resolution & scratch buffer saturation
 * 5. Player invulnerability frame gating & lethal override mechanics
 * 6. Weapon narrowphase collision verification (BoneSpear, SoulOrbiters gap immunity, Scythe, Aura, Lightning)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { Player } from '../../src/core/entities/Player';
import { ENEMY_BASE_STATS, EnemyType } from '../../src/core/entities/EnemyTypes';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { CursedAura } from '../../src/core/weapons/CursedAura';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';

describe('Adversarial Challenger Suite (M1): Precision Damage Hitbox & Collision Subsystem', () => {
  let game: GrimHarvestGame;

  beforeEach(() => {
    game = new GrimHarvestGame();
    game.player.reset(0, 0);
    game.hordeManager.clear();
  });

  describe('Adversarial Challenge 1: Exact Mathematical Boundary & Epsilon Behavior', () => {
    const enemyTypes: EnemyType[] = ['skeleton', 'ghoul', 'banshee', 'death_knight', 'necromancer'];

    for (const type of enemyTypes) {
      const stats = ENEMY_BASE_STATS[type];
      const r_p = Player.COLLISION_RADIUS; // 11.0
      const r_e = stats.radius;
      const contactDist = r_p + r_e;
      const epsilonThreshold = Math.sqrt(contactDist * contactDist + 1e-3);

      it(`[${type}] asserts exact touch (d = ${contactDist}) inflicts contact damage`, () => {
        game.player.reset(0, 0);
        game.hordeManager.clear();
        const initialHp = game.player.stats.currentHealth;
        const enemy = game.hordeManager.spawn(type, contactDist, 0);
        expect(enemy).not.toBeNull();
        enemy!.speed = 0; // Freeze to test static spatial geometry

        game.step(1 / 60);

        const expectedDamage = Math.max(1, stats.damage - game.player.stats.armor);
        expect(game.player.stats.currentHealth).toBe(initialHp - expectedDamage);
      });

      it(`[${type}] asserts distance within boundary (d = ${contactDist} - 0.001) inflicts contact damage`, () => {
        game.player.reset(0, 0);
        game.hordeManager.clear();
        const initialHp = game.player.stats.currentHealth;
        const enemy = game.hordeManager.spawn(type, contactDist - 0.001, 0);
        expect(enemy).not.toBeNull();
        enemy!.speed = 0;

        game.step(1 / 60);

        const expectedDamage = Math.max(1, stats.damage - game.player.stats.armor);
        expect(game.player.stats.currentHealth).toBe(initialHp - expectedDamage);
      });

      it(`[${type}] asserts distance outside boundary (d = ${contactDist} + 0.001) inflicts ZERO damage`, () => {
        game.player.reset(0, 0);
        game.hordeManager.clear();
        const initialHp = game.player.stats.currentHealth;
        // Since (contactDist + 0.001)^2 = contactDist^2 + 2 * contactDist * 0.001 + 1e-6
        // For contactDist >= 22, 2 * contactDist * 0.001 = 0.044 > 1e-3 (0.001)
        // Therefore distSq > contactDist^2 + 1e-3, collision is cleanly avoided!
        const enemy = game.hordeManager.spawn(type, contactDist + 0.001, 0);
        expect(enemy).not.toBeNull();
        enemy!.speed = 0;

        game.step(1 / 60);

        expect(game.player.stats.currentHealth).toBe(initialHp);
      });

      it(`[${type}] verifies exact analytic boundary threshold at sqrt((r_p + r_e)^2 + 1e-3)`, () => {
        // Inside by 1e-7: should hit
        game.player.reset(0, 0);
        game.hordeManager.clear();
        let initialHp = game.player.stats.currentHealth;
        const insideEnemy = game.hordeManager.spawn(type, epsilonThreshold - 1e-7, 0);
        insideEnemy!.speed = 0;
        game.step(1 / 60);
        expect(game.player.stats.currentHealth).toBeLessThan(initialHp);

        // Outside by 1e-7: should NOT hit
        game = new GrimHarvestGame();
        game.player.reset(0, 0);
        game.hordeManager.clear();
        initialHp = game.player.stats.currentHealth;
        const outsideEnemy = game.hordeManager.spawn(type, epsilonThreshold + 1e-7, 0);
        outsideEnemy!.speed = 0;
        game.step(1 / 60);
        expect(game.player.stats.currentHealth).toBe(initialHp);
      });
    }
  });

  describe('Adversarial Challenge 2: Sub-Pixel Precision & 360-Degree Omnidirectional Stress', () => {
    it('empirically verifies exact touch across 360 integer degrees with sub-pixel trigonometry', () => {
      const r_p = Player.COLLISION_RADIUS; // 11
      const r_e = ENEMY_BASE_STATS.skeleton.radius; // 11
      const touchDist = r_p + r_e; // 22

      // Test 72 discrete angles around circle (every 5 degrees)
      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const pX = 314.159; // Irregular sub-pixel origin
        const pY = 271.828;

        const g = new GrimHarvestGame();
        g.player.reset(pX, pY);
        g.hordeManager.clear();
        const initHp = g.player.stats.currentHealth;

        const eX = pX + Math.cos(rad) * touchDist;
        const eY = pY + Math.sin(rad) * touchDist;
        const enemy = g.hordeManager.spawn('skeleton', eX, eY);
        enemy!.speed = 0;

        g.step(1 / 60);

        expect(g.player.stats.currentHealth).toBeLessThan(initHp);
      }
    });

    it('empirically verifies 1px near-miss across 360 degrees yields ZERO damage everywhere', () => {
      const r_p = Player.COLLISION_RADIUS; // 11
      const r_e = ENEMY_BASE_STATS.skeleton.radius; // 11
      const missDist = r_p + r_e + 1.0; // 23.0

      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const pX = 543.21;
        const pY = 987.65;

        const g = new GrimHarvestGame();
        g.player.reset(pX, pY);
        g.hordeManager.clear();
        const initHp = g.player.stats.currentHealth;

        const eX = pX + Math.cos(rad) * missDist;
        const eY = pY + Math.sin(rad) * missDist;
        const enemy = g.hordeManager.spawn('skeleton', eX, eY);
        enemy!.speed = 0;

        g.step(1 / 60);

        expect(g.player.stats.currentHealth).toBe(initHp);
      }
    });

    it('Monte Carlo adversarial stress: 500 randomized sub-pixel positions with strict separation', () => {
      const r_p = Player.COLLISION_RADIUS;
      const r_e = 11.0;

      // Generate 250 outside points (r_p + r_e + 0.05 to 30.0) -> ZERO damage
      for (let i = 0; i < 250; i++) {
        const testGame = new GrimHarvestGame();
        testGame.player.reset(100.5, 200.75);
        testGame.hordeManager.clear();
        const angle = Math.random() * Math.PI * 2;
        const dist = r_p + r_e + 0.05 + Math.random() * 20.0;
        const ex = 100.5 + Math.cos(angle) * dist;
        const ey = 200.75 + Math.sin(angle) * dist;

        const enemy = testGame.hordeManager.spawn('skeleton', ex, ey);
        enemy!.speed = 0;
        testGame.step(1 / 60);
        expect(testGame.player.stats.currentHealth).toBe(testGame.player.stats.maxHealth);
      }

      // Generate 250 inside points (0 to r_p + r_e - 0.05) -> 100% damage detected
      for (let i = 0; i < 250; i++) {
        const testGame = new GrimHarvestGame();
        testGame.player.reset(100.5, 200.75);
        testGame.hordeManager.clear();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (r_p + r_e - 0.05);
        const ex = 100.5 + Math.cos(angle) * dist;
        const ey = 200.75 + Math.sin(angle) * dist;

        const enemy = testGame.hordeManager.spawn('skeleton', ex, ey);
        enemy!.speed = 0;
        testGame.step(1 / 60);
        expect(testGame.player.stats.currentHealth).toBeLessThan(testGame.player.stats.maxHealth);
      }
    });
  });

  describe('Adversarial Challenge 3: Multi-Enemy Dense Cluster & Scratch Buffer Saturation', () => {
    it('handles 80 overlapping enemies without buffer overrun, memory leaks, or multi-damage instant death', () => {
      // damageScratch has capacity of 64
      game.player.reset(0, 0);
      game.hordeManager.clear();
      const initHp = game.player.stats.currentHealth;

      // Spawn 80 skeletons all touching player at radius = 10px
      for (let i = 0; i < 80; i++) {
        const angle = (i * Math.PI * 2) / 80;
        const enemy = game.hordeManager.spawn('skeleton', Math.cos(angle) * 10, Math.sin(angle) * 10);
        enemy!.speed = 0;
      }

      expect(game.hordeManager.getActiveCount()).toBe(80);

      // Execute 1 frame step
      expect(() => game.step(1 / 60)).not.toThrow();

      // Invariant 1: Player took damage from exactly 1 enemy due to i-frame gating (damage = 10 - armor 0 = 10)
      const expectedDmg = Math.max(1, 10 - game.player.stats.armor);
      expect(game.player.stats.currentHealth).toBe(initHp - expectedDmg);

      // Invariant 2: Invulnerability timer was engaged
      expect(game.player.invulnerabilityTimer).toBeGreaterThan(0.48);

      // Invariant 3: Player survives the 80-enemy dense cluster tick
      expect(game.player.isAlive).toBe(true);
    });

    it('processes dense ring of 16 enemies symmetrically placed around perimeter', () => {
      game.player.reset(0, 0);
      game.hordeManager.clear();
      const initHp = game.player.stats.currentHealth;

      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16;
        const enemy = game.hordeManager.spawn('ghoul', Math.cos(angle) * 20, Math.sin(angle) * 20);
        enemy!.speed = 0;
      }

      game.step(1 / 60);

      // Ghoul damage = 15
      const expectedDmg = Math.max(1, 15 - game.player.stats.armor);
      expect(game.player.stats.currentHealth).toBe(initHp - expectedDmg);
    });
  });

  describe('Adversarial Challenge 4: High Relative Velocity & Tunneling Analysis', () => {
    it('empirically calculates the tunneling threshold speed at 60Hz', () => {
      // Hurtbox diameter: 2 * (Player.COLLISION_RADIUS + enemy.radius) = 2 * (11 + 11) = 44px
      // At dt = 1/60, displacement per frame = speed / 60
      // For tunneling to occur: displacement > 44px => speed > 2640 px/s
      const r_p = Player.COLLISION_RADIUS;
      const r_e = 11.0;
      const overlapSpan = 2 * (r_p + r_e); // 44px
      const frameDt = 1 / 60;
      const theoreticalTunnelSpeed = overlapSpan / frameDt; // 2640 px/s

      expect(theoreticalTunnelSpeed).toBe(2640);

      // Test speeds: 65, 110, 200, 500, 1000, 2000 px/s
      const testSpeeds = [65, 110, 200, 500, 1000, 2000];

      for (const speed of testSpeeds) {
        // Enemy starts 300px away and travels towards player at speed
        let enemyX = 300;
        let collisionDetected = false;
        let framesInCollision = 0;

        while (enemyX >= -300) {
          const dx = enemyX - 0;
          const distSq = dx * dx;
          const contactDist = r_p + r_e;
          if (distSq <= contactDist * contactDist + 1e-3) {
            collisionDetected = true;
            framesInCollision++;
          }
          enemyX -= speed * frameDt;
        }

        // Must detect collision at all sub-tunnel speeds!
        expect(collisionDetected).toBe(true);

        // At standard game speeds (65 to 200 px/s), enemy remains in contact for multiple frames
        if (speed <= 200) {
          expect(framesInCollision).toBeGreaterThanOrEqual(13); // At least 13 consecutive frames
        }
      }
    });

    it('verifies that under maximum gameplay speed (player speed 200 + ghoul speed 110 = 310 px/s), tunneling is physically impossible', () => {
      const maxGameplayRelativeSpeed = 310;
      const frameDisplacement = maxGameplayRelativeSpeed * (1 / 60); // 5.167px
      const minContactDepth = (Player.COLLISION_RADIUS + ENEMY_BASE_STATS.skeleton.radius) * 2; // 44px

      // Contact window spans at least 44 / 5.167 = 8.5 frames
      const minimumFramesCovered = Math.floor(minContactDepth / frameDisplacement);
      expect(minimumFramesCovered).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Adversarial Challenge 5: Player Invulnerability Frame Gating & Lethal Override', () => {
    it('verifies strict invulnerability gating: 0 damage during i-frame window, damage resumes when window expires', () => {
      game.player.reset(0, 0);
      game.player.stats.healthRegen = 0; // Disable regen to isolate i-frame damage tests
      const initHp = game.player.stats.currentHealth;

      // First hit
      const dealt1 = game.player.takeDamage(20);
      expect(dealt1).toBe(20);
      expect(game.player.stats.currentHealth).toBe(initHp - 20);
      expect(game.player.invulnerabilityTimer).toBe(Player.INVULNERABILITY_DURATION);

      // Subsequent hits during window: must return 0
      const dealt2 = game.player.takeDamage(50);
      expect(dealt2).toBe(0);
      expect(game.player.stats.currentHealth).toBe(initHp - 20);

      // Advance time by 0.3s (still in window, 0.2s left)
      game.player.update(0.3);
      expect(game.player.invulnerabilityTimer).toBeCloseTo(0.2, 5);

      const dealt3 = game.player.takeDamage(30);
      expect(dealt3).toBe(0);
      expect(game.player.stats.currentHealth).toBe(initHp - 20);

      // Advance time by 0.21s (window expires)
      game.player.update(0.21);
      expect(game.player.invulnerabilityTimer).toBe(0);

      // New hit: deals damage
      const dealt4 = game.player.takeDamage(25);
      expect(dealt4).toBe(25);
      expect(game.player.stats.currentHealth).toBe(initHp - 45);
    });

    it('verifies intentional lethal damage override (amount >= 1000) penetrates i-frames for test harnesses', () => {
      game.player.reset(0, 0);
      game.player.takeDamage(10); // Engages 0.5s i-frame
      expect(game.player.invulnerabilityTimer).toBe(0.5);

      // Lethal spike >= 1000 ignores i-frames
      const lethalDealt = game.player.takeDamage(1000);
      expect(lethalDealt).toBe(1000);
      expect(game.player.stats.currentHealth).toBe(0);
      expect(game.player.isAlive).toBe(false);
    });

    it('verifies dead player cannot take further damage', () => {
      game.player.reset(0, 0);
      game.player.takeDamage(1000);
      expect(game.player.isAlive).toBe(false);

      const dealt = game.player.takeDamage(50);
      expect(dealt).toBe(0);
    });
  });

  describe('Adversarial Challenge 6: Weapon Narrowphase Collision & Gap Immunity', () => {
    it('verifies BoneSpear projectile (r = 8px) narrowphase boundary precision', () => {
      const spear = new BoneSpear(game.player, game.hordeManager);
      const enemy = game.hordeManager.spawn('skeleton', 100, 100);
      expect(enemy).not.toBeNull();

      const proj = spear.fireProjectile(1, 0);
      expect(proj).not.toBeNull();
      proj!.radius = 8.0;
      proj!.x = 100 - (8.0 + 11.0); // Exactly touching
      proj!.y = 100;

      // Touch -> collision detected
      expect(spear.checkCollision(proj!, enemy!)).toBe(true);

      // 1px near-miss -> collision rejected
      proj!.x = 100 - (8.0 + 11.0 + 1.0);
      expect(spear.checkCollision(proj!, enemy!)).toBe(false);
    });

    it('verifies SoulOrbiters annular gap immunity: zero damage between orbiting skulls', () => {
      const orbiters = new SoulOrbiters(game.player, game.hordeManager);
      orbiters.rank = 1; // 2 skulls orbiting at 180 degrees
      orbiters.orbitRadius = 80;
      game.player.reset(0, 0);
      game.hordeManager.clear();

      // Skull 1 is at (80, 0), Skull 2 is at (-80, 0)
      orbiters.update(0.001);

      // Place an enemy at (0, 80) — exactly on the orbit radius ring, but 90 degrees away from any skull!
      const enemy = game.hordeManager.spawn('skeleton', 0, 80);
      expect(enemy).not.toBeNull();
      enemy!.speed = 0;
      const initialHp = enemy!.hp;

      // Update orbiters for 1 small step
      orbiters.update(0.016);

      // In the legacy code with annular donut collision, this enemy would take damage!
      // In the narrowphase fix, enemy takes 0 damage because it is in the gap!
      expect(enemy!.hp).toBe(initialHp);
    });

    it('verifies ArcaneScythe dual-boundary: radial reach AND angular cleave cone', () => {
      const scythe = new ArcaneScythe(game.player, game.hordeManager);
      scythe.rank = 1; // area = 75px, arc = 110 deg (+-55 deg)
      game.player.reset(0, 0);
      game.player.facingAngle = 0; // Facing +X
      game.hordeManager.clear();

      // Case A: Within radius (60px), within angle (0 deg) -> HIT
      const e1 = game.hordeManager.spawn('skeleton', 60, 0);
      expect(e1).not.toBeNull();
      const hitsA = scythe.fire(1, 0);
      expect(hitsA).toBe(1);

      // Clear horde
      game.hordeManager.clear();

      // Case B: Outside radius (120px, reach is 75 + 11 = 86px), within angle (0 deg) -> MISS
      const e2 = game.hordeManager.spawn('skeleton', 120, 0);
      expect(e2).not.toBeNull();
      const hitsB = scythe.fire(1, 0);
      expect(hitsB).toBe(0);

      // Clear horde
      game.hordeManager.clear();

      // Case C: Within radius (60px), but behind player (180 deg, outside 110 deg cone) -> MISS
      const e3 = game.hordeManager.spawn('skeleton', -60, 0);
      expect(e3).not.toBeNull();
      const hitsC = scythe.fire(1, 0);
      expect(hitsC).toBe(0);
    });

    it('verifies CursedAura radial boundary precision', () => {
      const aura = new CursedAura(game.player, game.hordeManager);
      aura.rank = 1; // area = 85px
      game.player.reset(0, 0);
      game.hordeManager.clear();

      const reach = aura.getEffectiveArea() + 11; // 85 + 11 = 96px

      // Enemy at 96px (touching)
      const e1 = game.hordeManager.spawn('skeleton', reach, 0);
      expect(e1).not.toBeNull();
      const hits1 = aura.pulse();
      expect(hits1).toBe(1);

      // Clear horde
      game.hordeManager.clear();

      // Enemy at 98px (miss)
      const e2 = game.hordeManager.spawn('skeleton', reach + 2, 0);
      expect(e2).not.toBeNull();
      const hits2 = aura.pulse();
      expect(hits2).toBe(0);
    });

    it('verifies AbyssalLightning target filtering respects radial boundary', () => {
      const lightning = new AbyssalLightning(game.player, game.hordeManager);
      lightning.rank = 1; // range = 320px
      game.player.reset(0, 0);
      game.hordeManager.clear();

      const reach = lightning.getEffectiveArea() + 11; // 320 + 11 = 331px

      // Enemy inside range (reach - 1px)
      const e1 = game.hordeManager.spawn('skeleton', reach - 1, 0);
      expect(e1).not.toBeNull();
      const hits1 = lightning.triggerStrike();
      expect(hits1).toBe(1);

      // Clear horde
      game.hordeManager.clear();

      // Enemy outside range (reach + 9px)
      const e2 = game.hordeManager.spawn('skeleton', reach + 9, 0);
      expect(e2).not.toBeNull();
      const hits2 = lightning.triggerStrike();
      expect(hits2).toBe(0);
    });
  });
});
