/**
 * tests/unit/hitbox_precision.spec.ts
 *
 * Comprehensive Precision Hitbox & Zero-Phantom-Damage Test Suite (Milestone 1).
 *
 * Verifies:
 * 1. Entity Hurtbox & Hitbox Calibration:
 *    - Player hurtbox COLLISION_RADIUS = 11.0px
 *    - Enemy base radii: Skeleton 11.0px, Ghoul 13.0px, Banshee 12.0px, Death Knight 18.0px, Necromancer 14.0px
 *    - Enemy collisionRadius getter/setter and position getter
 * 2. Contact Damage Precision & Exact Euclidean Boundary:
 *    - Separation of 1px (r_player + r_enemy + 1) produces ZERO damage across all enemy types
 *    - Exact touch (r_player + r_enemy) produces damage across all enemy types
 *    - 360-degree omnidirectional symmetry (0, 45, 90, 135, 180, 225, 270, 315 degrees)
 *    - Elimination of legacy +15px phantom padding
 * 3. GrimHarvestGame Game Loop Integration & Zero-Allocation Scratch:
 *    - Headless game.step(1/60) tick precision with damageScratch buffer
 * 4. Occult Weapon Arsenal Collision Precision:
 *    - Bone Spear: r = 8.0px visual head, near-miss vs touch
 *    - Soul Orbiters: per-skull r = 10.0px (evo 14.0px) circle check & annular gap immunity
 *    - Arcane Scythe: radial reach boundary (effectiveRadius + r_enemy) and angular sector
 *    - Cursed Aura: radial pulse boundary (effectiveRadius + r_enemy)
 *    - Abyssal Lightning: targeting range boundary (effectiveRange + r_enemy) and chain reach
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GrimHarvestGame } from '../../src/main';
import { Player } from '../../src/core/entities/Player';
import { HordeManager } from '../../src/core/HordeManager';
import { Enemy } from '../../src/core/entities/Enemy';
import { ENEMY_BASE_STATS } from '../../src/core/entities/EnemyTypes';
import { BoneSpear } from '../../src/core/weapons/BoneSpear';
import { SoulOrbiters } from '../../src/core/weapons/SoulOrbiters';
import { ArcaneScythe } from '../../src/core/weapons/ArcaneScythe';
import { CursedAura } from '../../src/core/weapons/CursedAura';
import { AbyssalLightning } from '../../src/core/weapons/AbyssalLightning';

describe('Milestone 1: Precision Hitbox & Collision Subsystem Suite', () => {
  describe('Suite 1: Entity Hurtbox & Hitbox Calibration Specifications', () => {
    it('verifies Player hurtbox radius is calibrated to exactly 11.0px', () => {
      expect(Player.COLLISION_RADIUS).toBe(11.0);

      const player = new Player(100, 200);
      expect(player.bounds.width).toBe(22.0);
      expect(player.bounds.height).toBe(22.0);
      expect(player.bounds.x).toBe(100 - 11.0);
      expect(player.bounds.y).toBe(200 - 11.0);

      player.reset(300, 400);
      expect(player.bounds.width).toBe(22.0);
      expect(player.bounds.height).toBe(22.0);
      expect(player.bounds.x).toBe(300 - 11.0);
      expect(player.bounds.y).toBe(400 - 11.0);
    });

    it('verifies calibrated enemy base radii in ENEMY_BASE_STATS', () => {
      expect(ENEMY_BASE_STATS['skeleton'].radius).toBe(11.0);
      expect(ENEMY_BASE_STATS['ghoul'].radius).toBe(13.0);
      expect(ENEMY_BASE_STATS['banshee'].radius).toBe(12.0);
      expect(ENEMY_BASE_STATS['death_knight'].radius).toBe(18.0);
      expect(ENEMY_BASE_STATS['necromancer'].radius).toBe(14.0);
    });

    it('verifies Enemy class collisionRadius getter/setter and position getter', () => {
      const enemy = new Enemy(1);
      expect(enemy.radius).toBe(11.0);
      expect(enemy.collisionRadius).toBe(11.0);

      enemy.collisionRadius = 15.5;
      expect(enemy.radius).toBe(15.5);
      expect(enemy.collisionRadius).toBe(15.5);

      enemy.x = 42.5;
      enemy.y = 88.25;
      expect(enemy.position.x).toBe(42.5);
      expect(enemy.position.y).toBe(88.25);

      // Verify zero-allocation object reuse
      const pos1 = enemy.position;
      const pos2 = enemy.position;
      expect(pos1).toBe(pos2);
    });

    it('verifies spawned enemies acquire exact calibrated radii', () => {
      const horde = new HordeManager({ maxCapacity: 50 });
      const types = [
        { type: 'skeleton', expected: 11.0 },
        { type: 'ghoul', expected: 13.0 },
        { type: 'banshee', expected: 12.0 },
        { type: 'death_knight', expected: 18.0 },
        { type: 'necromancer', expected: 14.0 },
      ];

      for (const { type, expected } of types) {
        const e = horde.spawn(type, 0, 0);
        expect(e).not.toBeNull();
        expect(e!.radius).toBe(expected);
        expect(e!.collisionRadius).toBe(expected);
      }
    });
  });

  describe('Suite 2: Contact Damage Precision & Exact Euclidean Boundary', () => {
    let player: Player;
    let hordeManager: HordeManager;
    const scratch = new Int32Array(64);

    beforeEach(() => {
      player = new Player(0, 0);
      hordeManager = new HordeManager({ maxCapacity: 200 });
    });

    // Helper implementing the exact narrowphase contact damage check from src/main.ts
    function resolveContactDamage(px: number, py: number): number {
      const nearbyCount = hordeManager.getEnemiesInRadius(
        px,
        py,
        Player.COLLISION_RADIUS + 32,
        scratch
      );

      let damageDealt = 0;
      for (let i = 0; i < nearbyCount; i++) {
        const enemy = hordeManager.pool[scratch[i]];
        if (enemy && enemy.active && enemy.isAlive) {
          const dx = enemy.position.x - px;
          const dy = enemy.position.y - py;
          const distSq = dx * dx + dy * dy;
          const contactDist = Player.COLLISION_RADIUS + enemy.radius;
          if (distSq <= contactDist * contactDist) {
            damageDealt += player.takeDamage(enemy.damage);
          }
        }
      }
      return damageDealt;
    }

    const testArchetypes = [
      { type: 'skeleton', r: 11.0, damage: 10 },
      { type: 'ghoul', r: 13.0, damage: 15 },
      { type: 'banshee', r: 12.0, damage: 20 },
      { type: 'death_knight', r: 18.0, damage: 40 },
      { type: 'necromancer', r: 14.0, damage: 25 },
    ];

    for (const { type, r, damage } of testArchetypes) {
      it(`verifies 1px near-miss produces ZERO damage for ${type}`, () => {
        const rPlayer = Player.COLLISION_RADIUS; // 11.0
        const touchDist = rPlayer + r;
        const nearMissDist = touchDist + 1.0; // 1px outside physical boundary

        hordeManager.spawn(type, nearMissDist, 0);

        const initialHealth = player.stats.currentHealth;
        const dealt = resolveContactDamage(player.position.x, player.position.y);

        expect(dealt).toBe(0);
        expect(player.stats.currentHealth).toBe(initialHealth);
      });

      it(`verifies exact touch registers damage for ${type}`, () => {
        const rPlayer = Player.COLLISION_RADIUS; // 11.0
        const touchDist = rPlayer + r; // Exact physical contact

        hordeManager.spawn(type, touchDist, 0);

        const initialHealth = player.stats.currentHealth;
        const dealt = resolveContactDamage(player.position.x, player.position.y);

        expect(dealt).toBe(damage);
        expect(player.stats.currentHealth).toBe(initialHealth - damage);
      });
    }

    it('verifies 360-degree omnidirectional accuracy across 8 angles (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)', () => {
      const rPlayer = Player.COLLISION_RADIUS; // 11.0
      const rEnemy = 11.0; // Skeleton
      const touchDist = rPlayer + rEnemy; // 22.0
      const nearMissDist = touchDist + 1.0; // 23.0

      const angles = [
        0,
        Math.PI / 4,
        Math.PI / 2,
        (3 * Math.PI) / 4,
        Math.PI,
        -(3 * Math.PI) / 4,
        -Math.PI / 2,
        -Math.PI / 4,
      ];

      for (const angle of angles) {
        // 1. Test 1px Near-Miss
        hordeManager.clear();
        player.reset(0, 0);

        const nx = Math.cos(angle) * nearMissDist;
        const ny = Math.sin(angle) * nearMissDist;
        hordeManager.spawn('skeleton', nx, ny);

        const dmgNear = resolveContactDamage(0, 0);
        expect(dmgNear, `Angle ${angle} near-miss must deal 0 damage`).toBe(0);
        expect(player.stats.currentHealth).toBe(100);

        // 2. Test Exact Touch
        hordeManager.clear();
        player.reset(0, 0);

        const tx = Math.cos(angle) * touchDist;
        const ty = Math.sin(angle) * touchDist;
        hordeManager.spawn('skeleton', tx, ty);

        const dmgTouch = resolveContactDamage(0, 0);
        expect(dmgTouch, `Angle ${angle} touch must deal damage`).toBe(10);
        expect(player.stats.currentHealth).toBe(90);
      }
    });

    it('confirms legacy +15px phantom padding zone deals ZERO damage', () => {
      // Legacy code triggered damage at d <= 14 + 15 + 16 = 45px (or up to 61px)
      // For Skeleton (r=11), touchDist is 22px.
      // Any enemy between 23px and 45px previously dealt unfair damage.
      const testDistances = [23.0, 25.0, 30.0, 35.0, 40.0, 44.0];

      for (const dist of testDistances) {
        hordeManager.clear();
        player.reset(0, 0);

        hordeManager.spawn('skeleton', dist, 0);
        const dealt = resolveContactDamage(0, 0);

        expect(dealt, `Distance ${dist}px in legacy phantom zone must deal 0 damage`).toBe(0);
        expect(player.stats.currentHealth).toBe(100);
      }
    });
  });

  describe('Suite 3: GrimHarvestGame Full Integration & Zero-Allocation Scratch', () => {
    let game: GrimHarvestGame;

    beforeEach(() => {
      game = new GrimHarvestGame();
      // Ensure player is centered and stationary
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      // Clear auto-spawning wave enemies for deterministic test
      game.hordeManager.clear();
    });

    it('verifies GrimHarvestGame.step(dt) does not inflict damage at 1px separation', () => {
      const touchDist = Player.COLLISION_RADIUS + 11.0; // 22.0px for skeleton
      const enemy = game.hordeManager.spawn('skeleton', touchDist + 1.0, 0);
      expect(enemy).not.toBeNull();
      // Freeze enemy speed so it tests static positional separation without walking into player
      enemy!.speed = 0;

      const initialHp = game.player.stats.currentHealth;

      // Execute 1 tick
      game.step(1 / 60);

      expect(game.player.stats.currentHealth).toBe(initialHp);
    });

    it('verifies GrimHarvestGame.step(dt) inflicts damage on exact touch', () => {
      const touchDist = Player.COLLISION_RADIUS + 11.0; // 22.0px
      const enemy = game.hordeManager.spawn('skeleton', touchDist, 0);
      expect(enemy).not.toBeNull();

      const initialHp = game.player.stats.currentHealth;

      game.step(1 / 60);

      expect(game.player.stats.currentHealth).toBeLessThan(initialHp);
      expect(game.player.stats.currentHealth).toBe(initialHp - 10);
    });
  });

  describe('Suite 4: Occult Weapon Arsenal Collision Precision', () => {
    let player: Player;
    let hordeManager: HordeManager;

    beforeEach(() => {
      player = new Player(0, 0);
      hordeManager = new HordeManager({ maxCapacity: 200 });
    });

    describe('Bone Spear Precision', () => {
      it('calibrates projectile radius to 8.0px matching glowing arrowhead VFX', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0);
        expect(proj).not.toBeNull();
        expect(proj!.radius).toBe(8.0);
      });

      it('asserts spear.checkCollision returns false on 1px separation and true on exact touch', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0)!;
        proj.x = 0;
        proj.y = 0;

        const rSpear = proj.radius; // 8.0
        const rEnemy = 11.0; // Skeleton
        const touchDist = rSpear + rEnemy; // 19.0
        const nearMissDist = touchDist + 1.0; // 20.0

        const enemyNear = hordeManager.spawn('skeleton', nearMissDist, 0)!;
        expect(spear.checkCollision(proj, enemyNear)).toBe(false);

        const enemyTouch = hordeManager.spawn('skeleton', touchDist, 0)!;
        expect(spear.checkCollision(proj, enemyTouch)).toBe(true);
      });

      it('asserts projectile update loop does not damage enemy at 1px separation', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0)!;
        proj.x = 0;
        proj.y = 0;
        proj.vx = 0; // Freeze projectile motion to test static distance
        proj.vy = 0;

        const touchDist = proj.radius + 11.0; // 19.0px
        const enemy = hordeManager.spawn('skeleton', touchDist + 1.0, 0)!;
        const initialHp = enemy.health;

        spear.update(0.001);

        expect(enemy.health).toBe(initialHp);
        expect(proj.pierceRemaining).toBe(spear.getStats().pierce ?? 2);
      });

      it('asserts projectile update loop damages enemy on exact touch and decrements pierce', () => {
        const spear = new BoneSpear(player, hordeManager);
        const proj = spear.fireProjectile(1, 0)!;
        proj.x = 0;
        proj.y = 0;
        proj.vx = 0;
        proj.vy = 0;

        const touchDist = proj.radius + 11.0; // 19.0px
        const enemy = hordeManager.spawn('skeleton', touchDist, 0)!;
        const initialHp = enemy.health;

        spear.update(0.001);

        expect(enemy.health).toBeLessThan(initialHp);
        expect(proj.pierceRemaining).toBe((spear.getStats().pierce ?? 2) - 1);
      });
    });

    describe('Soul Orbiters Per-Orb Precision & Annular Gap Immunity', () => {
      it('verifies getOrbRadius returns 10.0px (standard) and 14.0px (evolved)', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        expect(orbiters.getOrbRadius()).toBe(10.0);

        orbiters.isEvolution = true;
        expect(orbiters.getOrbRadius()).toBe(14.0);
      });

      it('damages enemy when touching an individual skull orb', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1;
        orbiters.syncSkulls();

        const skull0 = orbiters.skulls[0];
        const rOrb = orbiters.getOrbRadius(); // 10.0
        const rEnemy = 11.0; // Skeleton
        const touchDist = rOrb + rEnemy; // 21.0

        const enemy = hordeManager.spawn('skeleton', skull0.x + touchDist, skull0.y)!;
        const initialHp = enemy.health;

        // Use micro-tick to test static boundary without angular orbital rotation displacement
        orbiters.update(0.0001);

        expect(enemy.health).toBeLessThan(initialHp);
      });

      it('deals ZERO damage to enemy 1px outside an individual skull orb', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1;
        orbiters.syncSkulls();

        const skull0 = orbiters.skulls[0];
        const rOrb = orbiters.getOrbRadius(); // 10.0
        const rEnemy = 11.0; // Skeleton
        const nearMissDist = rOrb + rEnemy + 1.0; // 22.0

        const enemy = hordeManager.spawn('skeleton', skull0.x + nearMissDist, skull0.y)!;
        const initialHp = enemy.health;

        // Use micro-tick to test static boundary without angular orbital rotation displacement
        orbiters.update(0.0001);

        expect(enemy.health).toBe(initialHp);
      });

      it('deals ZERO damage to enemy on the orbit radius in the empty space between skulls (annular ring phantom eliminated)', () => {
        const orbiters = new SoulOrbiters(player, hordeManager);
        orbiters.rank = 1; // 2 skulls at angle 0 (x=orbitRadius, y=0) and angle PI (x=-orbitRadius, y=0)
        orbiters.syncSkulls();

        // Place enemy on orbit radius at 90 degrees (x=0, y=orbitRadius)
        // In legacy code, Math.abs(dist - orbitRadius) <= 26 triggered damage here!
        const enemy = hordeManager.spawn('skeleton', 0, orbiters.orbitRadius)!;
        const initialHp = enemy.health;

        orbiters.update(1 / 60);

        expect(enemy.health).toBe(initialHp); // Immune in the gap!
      });
    });

    describe('Arcane Scythe Radial Reach & Cleave Precision', () => {
      it('asserts enemy 1px beyond scythe reach takes ZERO damage', () => {
        const scythe = new ArcaneScythe(player, hordeManager);
        scythe.rank = 1;
        const reach = scythe.getEffectiveArea(); // 75px
        const rEnemy = 11.0;
        const nearMissDist = reach + rEnemy + 1.0; // 87.0px

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0)!;
        const initialHp = enemy.health;

        scythe.fire(1, 0); // Aiming rightwards
        expect(enemy.health).toBe(initialHp);
      });

      it('asserts enemy within scythe reach takes damage', () => {
        const scythe = new ArcaneScythe(player, hordeManager);
        scythe.rank = 1;
        const reach = scythe.getEffectiveArea(); // 75px
        const rEnemy = 11.0;
        const touchDist = reach + rEnemy; // 86.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0)!;
        const initialHp = enemy.health;

        scythe.fire(1, 0);
        expect(enemy.health).toBeLessThan(initialHp);
      });

      it('asserts enemy behind player (outside cleave arc) takes ZERO damage', () => {
        const scythe = new ArcaneScythe(player, hordeManager);
        scythe.rank = 1; // Forward 110 deg cone

        // Position enemy at close distance (50px) but directly behind player
        const enemy = hordeManager.spawn('skeleton', -50, 0)!;
        const initialHp = enemy.health;

        scythe.fire(1, 0); // Aiming rightwards
        expect(enemy.health).toBe(initialHp);
      });
    });

    describe('Cursed Aura Radial Shockwave Precision', () => {
      it('asserts enemy 1px beyond aura pulse takes ZERO damage and ZERO knockback', () => {
        const aura = new CursedAura(player, hordeManager);
        aura.rank = 1;
        const reach = aura.getEffectiveArea(); // 85px
        const rEnemy = 11.0;
        const nearMissDist = reach + rEnemy + 1.0; // 97.0px

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0)!;
        const initialHp = enemy.health;

        aura.pulse();
        expect(enemy.health).toBe(initialHp);
        expect(enemy.pushVx).toBe(0);
      });

      it('asserts enemy within aura pulse takes damage and knockback', () => {
        const aura = new CursedAura(player, hordeManager);
        aura.rank = 1;
        const reach = aura.getEffectiveArea(); // 85px
        const rEnemy = 11.0;
        const touchDist = reach + rEnemy; // 96.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0)!;
        const initialHp = enemy.health;

        aura.pulse();
        expect(enemy.health).toBeLessThan(initialHp);
        expect(enemy.pushVx).toBeGreaterThan(0);
      });
    });

    describe('Abyssal Lightning Targeting Precision', () => {
      it('asserts enemy 1px beyond lightning targeting range is not targeted', () => {
        const lightning = new AbyssalLightning(player, hordeManager);
        lightning.rank = 1;
        const reach = lightning.getEffectiveArea(); // 220px
        const rEnemy = 11.0;
        const nearMissDist = reach + rEnemy + 1.0; // 232.0px

        const enemy = hordeManager.spawn('skeleton', nearMissDist, 0)!;
        const initialHp = enemy.health;

        const hits = lightning.triggerStrike();
        expect(hits).toBe(0);
        expect(enemy.health).toBe(initialHp);
      });

      it('asserts enemy within lightning targeting range is targeted and damaged', () => {
        const lightning = new AbyssalLightning(player, hordeManager);
        lightning.rank = 1;
        const reach = lightning.getEffectiveArea(); // 220px
        const rEnemy = 11.0;
        const touchDist = reach + rEnemy; // 231.0px

        const enemy = hordeManager.spawn('skeleton', touchDist, 0)!;
        const initialHp = enemy.health;

        const hits = lightning.triggerStrike();
        expect(hits).toBeGreaterThan(0);
        expect(enemy.health).toBeLessThan(initialHp);
      });
    });
  });
});
