/**
 * cute_gameplay_loop.test.ts
 *
 * Comprehensive unit test suite for Milestone M2: Autonomous Gameplay Reinvention
 * ("Sugar Pop Blossom: Cozy Star Arena").
 *
 * Verifies:
 * 1. BubbleTrapEntity & BubbleManager (buoyancy, 6-shard radial pop burst, cascade chains, combos, fever)
 * 2. PetCompanion ("Mochi the Cloud Bunny" spring follow, pickup vacuum, auto heart bolts, bubble shield)
 * 3. ArenaPurificationManager (3 Blossom Altars, 180px influence, bloom progression, final bloom)
 * 4. SweetPerkManager (3-card rogue-lite modal, perk selection, stat modifiers)
 * 5. CuteEnemyManager (Marshmallow slimes, Honey bees, Donut rollers, Gummy Bear Colossus split into 3 mini cubs)
 * 6. FullMetalSlugGame Integration & Backward Compatibility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BubbleTrapEntity } from '../../src/core/cute/BubbleTrapEntity';
import { BubbleManager } from '../../src/core/cute/BubbleManager';
import { PetCompanion } from '../../src/core/cute/PetCompanion';
import { ArenaPurificationManager } from '../../src/core/cute/ArenaPurificationManager';
import { SweetPerkManager, PERK_POOL } from '../../src/core/cute/SweetPerkManager';
import { CuteEnemyManager } from '../../src/core/cute/CuteEnemyManager';
import { CuteArenaCoordinator } from '../../src/core/cute/CuteArenaCoordinator';
import { FullMetalSlugGame } from '../../src/main';

describe('Milestone M2: Autonomous Cute Gameplay Reinvention ("Sugar Pop Blossom")', () => {
  describe('1. BubbleTrapEntity & BubbleManager Mechanics', () => {
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      bubbleManager = new BubbleManager();
    });

    it('buoyant trapped bubbles exhibit upward velocity with sinusoidal sway', () => {
      const bubble = bubbleManager.trapEnemy(200, 200, {
        id: 'slime_1',
        type: 'MARSHMALLOW_SLIME',
        maxHp: 1,
        remainingHp: 1,
        width: 24,
        height: 20,
        facing: -1,
      });

      expect(bubble.state).toBe('TRAPPED');
      expect(bubble.radius).toBe(24);

      // Simulate 10 frames
      const initialY = bubble.y;
      for (let i = 0; i < 10; i++) {
        bubble.update(1 / 60);
      }

      // Buoyancy vy is around -42 px/s, so Y decreases (floats up)
      expect(bubble.y).toBeLessThan(initialY);
      expect(bubble.swayAngle).toBeDefined();
    });

    it('popping a bubble generates exactly 6 radial star shards at 60-degree increments', () => {
      const bubble = bubbleManager.trapEnemy(300, 200, {
        id: 'test_foe',
        type: 'MARSHMALLOW_SLIME',
        maxHp: 1,
        remainingHp: 1,
        width: 24,
        height: 20,
        facing: -1,
      });

      const shards = bubble.pop(1);
      expect(shards.length).toBe(6);

      // Verify angular increments: k * PI / 3 for k in 0..5
      for (let k = 0; k < 6; k++) {
        const expectedAngle = k * (Math.PI / 3);
        expect(shards[k].angle).toBeCloseTo(expectedAngle, 4);
        expect(shards[k].maxAge).toBe(0.35); // 350ms lifespan
        const speed = Math.sqrt(shards[k].vx * shards[k].vx + shards[k].vy * shards[k].vy);
        expect(speed).toBeCloseTo(320, 1); // 320 px/s speed
      }
    });

    it('Sweet Cascade: adjacent bubbles within 65px cascade-pop with scaling combos', () => {
      // Spawn two bubbles close to each other (40px apart)
      const b1 = bubbleManager.trapEnemy(100, 100, {
        id: 'foe_1',
        type: 'MARSHMALLOW_SLIME',
        maxHp: 1,
        remainingHp: 1,
        width: 20,
        height: 20,
        facing: 1,
      });
      const b2 = bubbleManager.trapEnemy(135, 100, {
        id: 'foe_2',
        type: 'MARSHMALLOW_SLIME',
        maxHp: 1,
        remainingHp: 1,
        width: 20,
        height: 20,
        facing: 1,
      });

      expect(bubbleManager.bubbles.length).toBe(2);

      // Pop the first bubble
      bubbleManager.popBubble(b1.id);

      // b2 should have been popped via Sweet Cascade chain reaction
      expect(b1.state).toBe('POPPING');
      expect(b2.state).toBe('POPPING');
      expect(bubbleManager.comboCount).toBe(2);
      expect(bubbleManager.getComboMultiplier(bubbleManager.comboCount)).toBe(2);
    });

    it('combo multiplier scales correctly from 1x to 10x Miracle Bloom', () => {
      expect(bubbleManager.getComboMultiplier(1)).toBe(1);
      expect(bubbleManager.getComboMultiplier(2)).toBe(2);
      expect(bubbleManager.getComboMultiplier(3)).toBe(3);
      expect(bubbleManager.getComboMultiplier(4)).toBe(5);
      expect(bubbleManager.getComboMultiplier(5)).toBe(5);
      expect(bubbleManager.getComboMultiplier(6)).toBe(10);
      expect(bubbleManager.getComboMultiplier(12)).toBe(10);

      expect(bubbleManager.getComboTitle(2)).toBe('SWEET!');
      expect(bubbleManager.getComboTitle(3)).toBe('DELICIOUS!');
      expect(bubbleManager.getComboTitle(5)).toBe('FANTASTIC!');
      expect(bubbleManager.getComboTitle(6)).toBe('★ MIRACLE BLOOM! ★');
    });

    it('candy drop count scales with combo up to maximum 8', () => {
      const bubble = new BubbleTrapEntity('b_drop', 100, 100);
      expect(bubble.getCandyDropCount(1)).toBe(3); // min(2 + 1, 8) = 3
      expect(bubble.getCandyDropCount(3)).toBe(5); // min(2 + 3, 8) = 5
      expect(bubble.getCandyDropCount(7)).toBe(8); // min(2 + 7, 8) = 8
      expect(bubble.getCandyDropCount(10)).toBe(8);
    });

    it('collecting pickups charges the Rainbow Sugar Rush fever meter to 100%', () => {
      expect(bubbleManager.feverMeter).toBe(0.0);
      expect(bubbleManager.isFeverActive).toBe(false);

      // Add charge
      bubbleManager.addFeverCharge(0.5);
      expect(bubbleManager.feverMeter).toBe(0.5);

      // Fully charge to 1.0
      bubbleManager.addFeverCharge(0.5);
      expect(bubbleManager.isFeverActive).toBe(true);
      expect(bubbleManager.feverTimeRemaining).toBe(8.0);

      // Advances fever timer
      bubbleManager.update(1.0);
      expect(bubbleManager.feverTimeRemaining).toBeCloseTo(7.0, 1);
    });
  });

  describe('2. PetCompanion ("Mochi the Cloud Bunny")', () => {
    let pet: PetCompanion;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      pet = new PetCompanion(100, 180);
      bubbleManager = new BubbleManager();
    });

    it('follows the player with spring physics', () => {
      const player = { x: 300, y: 200, facing: 1 as const, isAlive: true };

      const initialDist = Math.abs(player.x - pet.x);

      // Simulate 30 frames
      for (let i = 0; i < 30; i++) {
        pet.update(1 / 60, player, bubbleManager, []);
      }

      // Mochi should have moved towards player
      const newDist = Math.abs(player.x - pet.x);
      expect(newDist).toBeLessThan(initialDist);
    });

    it('vacuums nearby candy and star pickups within 160px', () => {
      // Spawn a pickup within 80px of Mochi
      bubbleManager.shootBubble(pet.x + 50, pet.y, 0, 0);
      bubbleManager.popBubble(bubbleManager.bubbles[0].id);

      expect(bubbleManager.pickups.length).toBeGreaterThan(0);

      const player = { x: pet.x + 20, y: pet.y, facing: 1 as const, isAlive: true };

      // Update pet
      pet.update(0.1, player, bubbleManager, []);

      // Pickup should have been accelerated towards Mochi
      expect(bubbleManager.pickups[0].vx).toBeLessThan(0);
      expect(pet.state).toBe('fetch');
    });

    it('auto-fires heart bolts at nearest un-bubbled foe every 1.5s', () => {
      const enemies = [
        {
          id: 'bee_1',
          type: 'HONEY_BEE' as const,
          x: pet.x + 120,
          y: pet.y,
          vx: 0,
          vy: 0,
          facing: -1 as const,
          health: 1,
          maxHealth: 1,
          isBubbled: false,
          animationState: 'fly',
          isAlive: true,
        },
      ];

      const player = { x: pet.x + 20, y: pet.y, facing: 1 as const, isAlive: true };

      // Advance time past 1.5s cooldown
      pet.update(1.6, player, bubbleManager, enemies);

      expect(pet.activeHeartBolts.length).toBe(1);
      expect(pet.activeHeartBolts[0].targetId).toBe('bee_1');
      expect(pet.state).toBe('zap');
    });

    it('shimmering bubble shield absorbs one incoming hit then starts recharge', () => {
      expect(pet.isShieldActive).toBe(true);

      // First hit absorbed
      const absorbed = pet.tryAbsorbHit();
      expect(absorbed).toBe(true);
      expect(pet.isShieldActive).toBe(false);

      // Second hit during cooldown is NOT absorbed
      const secondHit = pet.tryAbsorbHit();
      expect(secondHit).toBe(false);

      // Simulate 12.1s of recharge
      const player = { x: pet.x, y: pet.y, facing: 1 as const, isAlive: true };
      pet.update(12.1, player, bubbleManager, []);

      expect(pet.isShieldActive).toBe(true);
    });
  });

  describe('3. ArenaPurificationManager (3 Blossom Altars)', () => {
    let altarManager: ArenaPurificationManager;

    beforeEach(() => {
      altarManager = new ArenaPurificationManager();
    });

    it('initializes 3 distinct Blossom Altars across the arena', () => {
      expect(altarManager.altars.length).toBe(3);
      expect(altarManager.altars[0].name).toContain('Lotus');
      expect(altarManager.altars[1].name).toContain('Sun Meadow');
      expect(altarManager.altars[2].name).toContain('Starlight Orchid');

      for (const altar of altarManager.altars) {
        expect(altar.purificationProgress).toBe(0.0);
        expect(altar.isBloomed).toBe(false);
      }
    });

    it('popping bubbles near an altar increases purification progress', () => {
      const altar = altarManager.altars[0]; // at (200, 220)

      // Pop a bubble 50px away from the altar
      altarManager.onBubblePopped(200, 210, 1);

      expect(altar.purificationProgress).toBeGreaterThanOrEqual(0.15);
      expect(altar.isBloomed).toBe(false);
    });

    it('purifying an altar to 1.0 triggers the bloom event and marks isBloomed', () => {
      let bloomedAltarId: string | null = null;
      altarManager.onAltarBloomed = (a) => {
        bloomedAltarId = a.id;
      };

      const altar = altarManager.altars[0]; // at (200, 220)

      // Pop enough bubbles near altar to reach 1.0
      for (let i = 0; i < 7; i++) {
        altarManager.onBubblePopped(200, 220, 2);
      }

      expect(altar.purificationProgress).toBe(1.0);
      expect(altar.isBloomed).toBe(true);
      expect(bloomedAltarId).toBe('altar_lotus');
    });

    it('triggers garden fully bloomed when all 3 altars bloom', () => {
      let fullBloomTriggered = false;
      altarManager.onGardenFullyBloomed = () => {
        fullBloomTriggered = true;
      };

      for (const altar of altarManager.altars) {
        for (let i = 0; i < 7; i++) {
          altarManager.onBubblePopped(altar.x, altar.y, 2);
        }
      }

      expect(altarManager.isGardenFullyBloomed()).toBe(true);
      expect(fullBloomTriggered).toBe(true);
    });
  });

  describe('4. SweetPerkManager (3-Card Rogue-Lite Upgrades)', () => {
    let perkManager: SweetPerkManager;

    beforeEach(() => {
      perkManager = new SweetPerkManager();
    });

    it('contains all 6 canonical cute perks in the upgrade pool', () => {
      expect(PERK_POOL.length).toBe(6);
      const ids = PERK_POOL.map((p) => p.id);
      expect(ids).toContain('RAINBOW_SPRINKLES');
      expect(ids).toContain('BUBBLE_ORBITERS');
      expect(ids).toContain('SUGAR_DASH_TRAIL');
      expect(ids).toContain('PET_PEP');
      expect(ids).toContain('STAR_MAGNET');
      expect(ids).toContain('CUPCAKE_SHIELD');
    });

    it('triggerPerkSelection draws exactly 3 distinct cards and opens modal', () => {
      expect(perkManager.isModalActive).toBe(false);

      const drawn = perkManager.triggerPerkSelection();
      expect(drawn.length).toBe(3);
      expect(perkManager.isModalActive).toBe(true);

      // Verify all 3 cards are unique
      const ids = new Set(drawn.map((d) => d.id));
      expect(ids.size).toBe(3);
    });

    it('selecting a card applies the perk level and closes modal', () => {
      perkManager.triggerPerkSelection();
      const chosenCard = perkManager.availableCards[1];

      const selected = perkManager.selectCard(1);
      expect(selected?.id).toBe(chosenCard.id);
      expect(perkManager.isModalActive).toBe(false);
      expect(perkManager.hasPerk(chosenCard.id)).toBe(true);
      expect(perkManager.getPerkLevel(chosenCard.id)).toBe(1);
    });
  });

  describe('5. CuteEnemyManager Archetypes & Boss Splitting', () => {
    let enemyManager: CuteEnemyManager;
    let bubbleManager: BubbleManager;

    beforeEach(() => {
      enemyManager = new CuteEnemyManager();
      bubbleManager = new BubbleManager();
    });

    it('spawns Marshmallow Slimes with bouncy kinematics and squash-stretch factor', () => {
      const slime = enemyManager.spawnEnemy('MARSHMALLOW_SLIME', 200, 200, 1);
      expect(slime.health).toBe(1);

      // Simulate physics: slime hops upward (vy = -180)
      enemyManager.update(1 / 60, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);

      expect(slime.y).toBeLessThan(200);
      expect(slime.squashStretch).toBeDefined();
    });

    it('spawns Honey Bees with sine-wave hovering flight', () => {
      const bee = enemyManager.spawnEnemy('HONEY_BEE', 300, 120, -1);
      expect(bee.health).toBe(1);

      const initialY = bee.y;
      enemyManager.update(0.2, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);

      // Sine flight alters Y
      expect(bee.y).not.toBe(initialY);
    });

    it('spawns Donut Rollers that roll swiftly along ground', () => {
      const roller = enemyManager.spawnEnemy('DONUT_ROLLER', 100, 224, 1);
      expect(roller.health).toBe(2);

      enemyManager.update(0.1, { minX: 20, maxX: 940, groundY: 230 }, bubbleManager);

      expect(roller.x).toBeGreaterThan(100);
    });

    it('Gummy Bear Colossus boss splits into 3 Mini Gummy Cubs upon reaching 0 HP', () => {
      const boss = enemyManager.spawnColossusBoss();
      expect(boss.health).toBe(250);
      expect(enemyManager.isBossActive).toBe(true);

      // Reduce boss health to 0
      enemyManager.damageEnemy(boss.id, 250, bubbleManager);

      // Boss should be defeated and 3 cubs spawned
      const cubs = enemyManager.enemies.filter((e) => e.type === 'GUMMY_CUB');
      expect(cubs.length).toBe(3);
      for (const cub of cubs) {
        expect(cub.health).toBe(15);
        expect(cub.isAlive).toBe(true);
      }
    });
  });

  describe('6. CuteArenaCoordinator & FullMetalSlugGame Integration', () => {
    it('CuteArenaCoordinator seamlessly coordinates waves, altars, and state transitions', () => {
      const coordinator = new CuteArenaCoordinator();
      expect(coordinator.state).toBe('ARENA_INTRO');

      // Step past intro timer (1.5s)
      coordinator.update(1.6, { x: 100, y: 200, facing: 1, isAlive: true });

      expect(coordinator.state).toBe('WAVE_ACTIVE');
      expect(coordinator.enemyManager.enemies.length).toBeGreaterThan(0);
    });

    it('FullMetalSlugGame initializes in cute_blossom_arena mode by default with camera unlocked', () => {
      const game = new FullMetalSlugGame();
      expect(game.gameMode).toBe('cute_blossom_arena');
      expect(game.cuteCoordinator).toBeDefined();
      expect(game.camera.forwardLock).toBe(false);

      // 10 simulation ticks execute cleanly with 0 exceptions
      for (let i = 0; i < 10; i++) {
        game.step(1 / 60);
      }
    });

    it('FullMetalSlugGame supports optional gameMode: "classic" for 100% backward compatibility', () => {
      const game = new FullMetalSlugGame(undefined, { gameMode: 'classic' });
      expect(game.gameMode).toBe('classic');
      expect(game.camera.forwardLock).toBe(true);
    });

    it('buildRenderSceneState includes all cute contracts (bubbles, pet, altars, fever, perks)', () => {
      const game = new FullMetalSlugGame();
      const scene = (game as any).buildRenderSceneState();

      expect(scene.cuteBubbles).toBeDefined();
      expect(scene.cutePet).toBeDefined();
      expect(scene.cuteAltars).toBeDefined();
      expect(scene.cutePickups).toBeDefined();
      expect(scene.hud.cuteFever).toBeDefined();
      expect(scene.hud.cutePerks).toBeDefined();
      expect(scene.hud.cuteAltars).toBeDefined();
    });
  });
});
