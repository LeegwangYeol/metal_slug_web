import { describe, it, expect, beforeEach } from 'vitest';
import { ProceduralSpriteFactory } from '../../src/render/sprites/ProceduralSpriteFactory';
import { KeyboardController } from '../../src/input/KeyboardController';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { StageManager } from '../../src/core/engine/StageManager';
import { PlayerController } from '../../src/core/player/PlayerController';
import { UltimateManager, UltimatePhase } from '../../src/core/player/UltimateManager';
import { SoldierEnemy, EnemyBullet } from '../../src/core/entities/enemies/SoldierEnemy';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { PowEntity } from '../../src/core/entities/pow/PowEntity';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';

describe('CHALLENGER_M3: Adversarial Sprite Invariant, Controls Collision & Ultimate Stress', () => {
  let factory: ProceduralSpriteFactory;
  let keyboard: KeyboardController;

  beforeEach(() => {
    factory = ProceduralSpriteFactory.getInstance();
    keyboard = new KeyboardController();
  });

  // =========================================================================
  // FOCUS 1: 1,000 Invocations of getAllKeys() & Zero Baseline Leak Invariant
  // =========================================================================
  describe('Focus 1: ProceduralSpriteFactory 1,000 Invocations & Baseline Invariant (Exactly 164 Keys)', () => {
    it('EMPIRICAL 1A: 1,000 consecutive invocations of getAllKeys() consistently return exactly 164 keys with zero drift', () => {
      const BASELINE_COUNT = 164;
      const initialKeys = factory.getAllKeys();
      expect(initialKeys.length).toBe(BASELINE_COUNT);

      const knownExpansionPrefixes = [
        'tactical_bomber',
        'air_bomb_falling',
        'shockwave_ring',
        'iron_nokana',
        'hazard_',
        'ally_',
        'item_crate',
        'proj_shotgun',
        'proj_laser',
        'proj_homing',
        'player_shield_bubble',
      ];

      const knownPolishPrefixes = [
        'parachute_canopy',
        'rebel_death_',
      ];

      for (let i = 0; i < 1000; i++) {
        const keys = factory.getAllKeys();
        if (keys.length !== BASELINE_COUNT) {
          throw new Error(`Iteration ${i}: Expected ${BASELINE_COUNT} keys but got ${keys.length}`);
        }
        if (factory.count() !== BASELINE_COUNT) {
          throw new Error(`Iteration ${i}: factory.count() expected ${BASELINE_COUNT} but got ${factory.count()}`);
        }

        // Verify zero leakage of expansion keys
        for (const key of keys) {
          for (const exp of knownExpansionPrefixes) {
            if (key.startsWith(exp)) {
              throw new Error(`Iteration ${i}: Expansion key "${key}" leaked into default getAllKeys()`);
            }
          }
          for (const pol of knownPolishPrefixes) {
            if (key.startsWith(pol)) {
              throw new Error(`Iteration ${i}: Polish key "${key}" leaked into default getAllKeys()`);
            }
          }
        }
      }

      console.log(`[Focus 1A] Successfully completed 1,000 invocations: exactly ${BASELINE_COUNT} keys, 0 leaks.`);
    });

    it('EMPIRICAL 1B: Precise Category Breakdown holds invariant across baseline keys', () => {
      const keys = factory.getAllKeys();
      const categories = {
        player: keys.filter((k) => k.startsWith('player_')),
        rebel: keys.filter((k) => k.startsWith('rebel_') || k.startsWith('soldier_')),
        pow: keys.filter((k) => k.startsWith('pow_')),
        ironTechnical: keys.filter((k) => k.startsWith('iron_technical_')),
        tetsuyuki: keys.filter((k) => k.startsWith('tetsuyuki_')),
        projectile: keys.filter((k) => k.startsWith('proj_')),
        casings: keys.filter((k) => k.startsWith('casing_')),
        explosions: keys.filter((k) => k.startsWith('explosion_')),
        hud: keys.filter((k) => k.startsWith('hud_')),
      };

      expect(categories.player.length).toBe(67);
      expect(categories.rebel.length).toBe(21);
      expect(categories.pow.length).toBe(9);
      expect(categories.ironTechnical.length).toBe(7);
      expect(categories.tetsuyuki.length).toBe(8);
      expect(categories.projectile.length).toBe(13);
      expect(categories.casings.length).toBe(4);
      expect(categories.explosions.length).toBe(18);
      expect(categories.hud.length).toBe(17);

      const sum = Object.values(categories).reduce((acc, cat) => acc + cat.length, 0);
      expect(sum).toBe(164);
      expect(keys.length).toBe(164);
    });

    it('EMPIRICAL 1C: Cross-Pollution Immunity: querying expansion keys does not pollute default getAllKeys()', () => {
      // 1. Query full keys with polish and expansion enabled
      const fullKeys = factory.getAllKeys(true, true);
      expect(fullKeys.length).toBeGreaterThan(164);
      const expansionKeysOnly = fullKeys.filter((k) => !factory.getAllKeys().includes(k));
      expect(expansionKeysOnly.length).toBeGreaterThanOrEqual(41);

      // 2. Query individual expansion sprites
      expect(factory.hasSprite('tactical_bomber')).toBe(true);
      expect(factory.getSprite('tactical_bomber')).toBeDefined();
      expect(factory.hasSprite('iron_nokana_hull')).toBe(true);
      expect(factory.getSprite('iron_nokana_hull')).toBeDefined();

      // 3. Mutate returned array copy
      const returnedArr = factory.getAllKeys();
      returnedArr.push('illegal_injected_key');
      expect(returnedArr.length).toBe(165);

      // 4. Invariant must remain strictly 164
      const freshKeys = factory.getAllKeys();
      expect(freshKeys.length).toBe(164);
      expect(freshKeys.includes('illegal_injected_key')).toBe(false);
      expect(freshKeys.includes('tactical_bomber')).toBe(false);
      expect(freshKeys.includes('iron_nokana_hull')).toBe(false);
    });
  });

  // =========================================================================
  // FOCUS 2: Keyboard Control Bindings Collision & Isolation
  // =========================================================================
  describe('Focus 2: Keyboard Control Bindings Non-Collision (KeyU vs KeyX, KeyC, Shoot, Arrows)', () => {
    it('EMPIRICAL 2A: KeyU strictly triggers ultimate without activating jump, grenade, fire, or directions', () => {
      keyboard['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);

      expect(keyboard.ultimate).toBe(true);
      expect(keyboard.jump).toBe(false);
      expect(keyboard.grenade).toBe(false);
      expect(keyboard.fire).toBe(false);
      expect(keyboard.left).toBe(false);
      expect(keyboard.right).toBe(false);
      expect(keyboard.up).toBe(false);
      expect(keyboard.down).toBe(false);
      expect(keyboard.pause).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.ultimatePressed).toBe(true);
      expect(snap.jumpPressed).toBe(false);
      expect(snap.jumpHeld).toBe(false);
      expect(snap.grenadePressed).toBe(false);
      expect(snap.shootPressed).toBe(false);
      expect(snap.shootHeld).toBe(false);
      expect(snap.left).toBe(false);
      expect(snap.right).toBe(false);
      expect(snap.up).toBe(false);
      expect(snap.down).toBe(false);
    });

    it('EMPIRICAL 2B: KeyX strictly triggers jump without activating ultimate', () => {
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);

      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.jumpPressed).toBe(true);
      expect(snap.jumpHeld).toBe(true);
      expect(snap.ultimatePressed).toBe(false);
    });

    it('EMPIRICAL 2C: KeyC strictly triggers grenade without activating ultimate', () => {
      keyboard['handleKeyDown']({ code: 'KeyC', key: 'c', preventDefault: () => {} } as any);

      expect(keyboard.grenade).toBe(true);
      expect(keyboard.ultimate).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.grenadePressed).toBe(true);
      expect(snap.ultimatePressed).toBe(false);
    });

    it('EMPIRICAL 2D: Shoot keys (KeyJ, KeyZ) trigger fire without activating ultimate', () => {
      for (const { code, key } of [{ code: 'KeyJ', key: 'j' }, { code: 'KeyZ', key: 'z' }]) {
        const kb = new KeyboardController();
        kb['handleKeyDown']({ code, key, preventDefault: () => {} } as any);

        expect(kb.fire).toBe(true);
        expect(kb.ultimate).toBe(false);

        const snap = kb.getSnapshot();
        expect(snap.shootPressed).toBe(true);
        expect(snap.shootHeld).toBe(true);
        expect(snap.ultimatePressed).toBe(false);
      }
    });

    it('EMPIRICAL 2E: Arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) trigger directions without activating ultimate', () => {
      const arrowTests = [
        { code: 'ArrowUp', key: 'ArrowUp', prop: 'up' },
        { code: 'ArrowDown', key: 'ArrowDown', prop: 'down' },
        { code: 'ArrowLeft', key: 'ArrowLeft', prop: 'left' },
        { code: 'ArrowRight', key: 'ArrowRight', prop: 'right' },
      ];

      for (const { code, key, prop } of arrowTests) {
        const kb = new KeyboardController();
        kb['handleKeyDown']({ code, key, preventDefault: () => {} } as any);

        expect((kb as any)[prop]).toBe(true);
        expect(kb.ultimate).toBe(false);

        const snap = kb.getSnapshot();
        expect((snap as any)[prop]).toBe(true);
        expect(snap.ultimatePressed).toBe(false);
      }
    });

    it('EMPIRICAL 2F: Simultaneous 5-key chord (KeyU + KeyX + KeyC + KeyJ + ArrowRight) preserves all discrete actions without cross-talk', () => {
      keyboard['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'KeyC', key: 'c', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'ArrowRight', key: 'ArrowRight', preventDefault: () => {} } as any);

      expect(keyboard.ultimate).toBe(true);
      expect(keyboard.jump).toBe(true);
      expect(keyboard.grenade).toBe(true);
      expect(keyboard.fire).toBe(true);
      expect(keyboard.right).toBe(true);

      const snap = keyboard.getSnapshot();
      expect(snap.ultimatePressed).toBe(true);
      expect(snap.jumpPressed).toBe(true);
      expect(snap.jumpHeld).toBe(true);
      expect(snap.grenadePressed).toBe(true);
      expect(snap.shootPressed).toBe(true);
      expect(snap.shootHeld).toBe(true);
      expect(snap.right).toBe(true);
      expect(snap.left).toBe(false);
      expect(snap.up).toBe(false);
      expect(snap.down).toBe(false);

      // Snapshot 2: held keys stay held, edge triggers reset
      const snap2 = keyboard.getSnapshot();
      expect(snap2.ultimatePressed).toBe(false);
      expect(snap2.jumpPressed).toBe(false);
      expect(snap2.jumpHeld).toBe(true);
      expect(snap2.grenadePressed).toBe(false);
      expect(snap2.shootPressed).toBe(false);
      expect(snap2.shootHeld).toBe(true);
      expect(snap2.right).toBe(true);
    });

    it('EMPIRICAL 2G: Pathological Rapid Key Mashing (100 alternating taps of KeyU and KeyX within ticks)', () => {
      const kb = new KeyboardController();
      let totalUltimate = 0;
      let totalJump = 0;

      for (let tick = 0; tick < 100; tick++) {
        if (tick % 2 === 0) {
          kb['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);
          kb['handleKeyUp']({ code: 'KeyU', key: 'u' } as any);
        } else {
          kb['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
          kb['handleKeyUp']({ code: 'KeyX', key: 'x' } as any);
        }

        const snap = kb.getSnapshot();
        if (snap.ultimatePressed) totalUltimate++;
        if (snap.jumpPressed) totalJump++;

        // At no point should both be pressed simultaneously from single alternate tap
        expect(snap.ultimatePressed && snap.jumpPressed).toBe(false);
      }

      expect(totalUltimate).toBe(50);
      expect(totalJump).toBe(50);
    });
  });

  // =========================================================================
  // FOCUS 3: Ultimate Move Adversarial Stress & Edge Cases
  // =========================================================================
  describe('Focus 3: Ultimate Move Adversarial State & Damage Stress', () => {
    let engine: GameEngine;
    let stageManager: StageManager;
    let ultimate: UltimateManager;

    beforeEach(() => {
      engine = new GameEngine();
      engine.start();
      stageManager = new StageManager(engine);
      (engine as any).cameraX = 0;

      ultimate = new UltimateManager({
        initialStock: 1,
        maxStock: 3,
        bossDamage: 120,
      });
    });

    it('EMPIRICAL 3A: Spamming trigger() while in active execution does not consume extra stock or glitch phase', () => {
      expect(ultimate.stock).toBe(1);
      const first = ultimate.trigger(engine);
      expect(first).toBe(true);
      expect(ultimate.stock).toBe(0);
      expect(ultimate.phase).toBe(UltimatePhase.FREEZE);

      // Attempt 50 rapid re-triggers during FREEZE phase
      for (let i = 0; i < 50; i++) {
        const retrigger = ultimate.trigger(engine);
        expect(retrigger).toBe(false);
      }
      expect(ultimate.stock).toBe(0);
      expect(ultimate.phase).toBe(UltimatePhase.FREEZE);

      // Advance to STRIKE_PASS and spam again
      ultimate.update(0.6, engine, stageManager.getViewportBoundingBox());
      expect(ultimate.phase).toBe(UltimatePhase.STRIKE_PASS);
      for (let i = 0; i < 50; i++) {
        expect(ultimate.trigger(engine)).toBe(false);
      }
      expect(ultimate.stock).toBe(0);
    });

    it('EMPIRICAL 3B: Stock boundaries: addStock respects maxStock and ignores negative/invalid increments', () => {
      expect(ultimate.stock).toBe(1);
      ultimate.addStock(1);
      expect(ultimate.stock).toBe(2);
      ultimate.addStock(1);
      expect(ultimate.stock).toBe(3);

      // Exceeding max stock
      ultimate.addStock(5);
      expect(ultimate.stock).toBe(3);

      // Negative stock increment ignored
      ultimate.addStock(-1);
      expect(ultimate.stock).toBe(3);
    });

    it('EMPIRICAL 3C: Spatial Culling Stress: 50 in-screen minions wiped, 50 out-of-screen minions 100% unharmed', () => {
      const inScreenMinions: SoldierEnemy[] = [];
      const outScreenMinions: SoldierEnemy[] = [];
      const viewport = { x: 0, y: 0, width: 480, height: 270 };

      // Spawn 50 minions inside viewport [0, 480]
      for (let i = 0; i < 50; i++) {
        const x = 50 + (i * 7); // 50 to 393
        const soldier = new SoldierEnemy(`soldier_in_${i}`, 'SOLDIER_RIFLE', vec2(x, 190));
        inScreenMinions.push(soldier);
        engine.addEntity(soldier);
      }

      // Spawn 50 minions outside viewport [550, 1500]
      for (let i = 0; i < 50; i++) {
        const x = 550 + (i * 15);
        const soldier = new SoldierEnemy(`soldier_out_${i}`, 'SOLDIER_RIFLE', vec2(x, 190));
        outScreenMinions.push(soldier);
        engine.addEntity(soldier);
      }
      engine.tick(1 / 60);

      ultimate.trigger(engine);
      // Advance past FREEZE (0.5s) and STRIKE_PASS (0.6s) to DETONATION in 60Hz ticks
      // Total 1.2s = 72 ticks
      for (let i = 0; i < 72; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);

      // All 50 in-screen minions must be dead / non-alive
      for (const minion of inScreenMinions) {
        expect(minion.isAlive).toBe(false);
      }

      // All 50 out-screen minions must still be alive with full health
      for (const minion of outScreenMinions) {
        expect(minion.isAlive).toBe(true);
        expect(minion.health).toBe(minion.maxHealth);
      }
    });

    it('EMPIRICAL 3D: Friendly Fire Immunity under maximum blast density', () => {
      const player = new PlayerController(vec2(200, 200));
      const ally = new AllyNPC('ally_friendly_1', vec2(220, 200));
      const kiBlast = new AllyKiBlast('ki_1', vec2(240, 200), 1);
      const pow = new PowEntity('pow_friendly_1', vec2(150, 200));

      engine.addEntity(player);
      engine.addEntity(ally);
      engine.addEntity(kiBlast);
      engine.addEntity(pow);
      engine.tick(1 / 60);

      const initialPlayerHP = player.health;
      const viewport = { x: 0, y: 0, width: 480, height: 270 };

      ultimate.trigger(engine);
      // Advance to detonation in 60Hz ticks
      for (let i = 0; i < 72; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);

      expect(player.isAlive).toBe(true);
      expect(player.health).toBe(initialPlayerHP);
      expect(ally.isAlive).toBe(true);
      expect(kiBlast.isAlive).toBe(true);
      expect(pow.isAlive).toBe(true);
    });

    it('EMPIRICAL 3E: Full Lifecycle Simulation: 60Hz fixed updates cleanly cycle through all phases to IDLE', () => {
      let screenShakeEmitted = false;
      let completedEmitted = false;
      engine.eventBus.on('screen_shake', () => { screenShakeEmitted = true; });
      engine.eventBus.on('ultimate_completed', () => { completedEmitted = true; });

      const viewport = { x: 0, y: 0, width: 480, height: 270 };
      ultimate.trigger(engine);
      expect(ultimate.isSimulationFrozen).toBe(true);
      expect(ultimate.phase).toBe(UltimatePhase.FREEZE);

      // Total cycle: freeze (0.5s) + strike (0.6s) + detonation (0.4s) + recovery (0.3s) = 1.8s
      // Run 150 ticks @ 60Hz (2.5s)
      for (let i = 0; i < 150; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }

      expect(ultimate.phase).toBe(UltimatePhase.IDLE);
      expect(ultimate.isSimulationFrozen).toBe(false);
      expect(screenShakeEmitted).toBe(true);
      expect(completedEmitted).toBe(true);
    });

    it('EMPIRICAL 3F: AABB Instance Parameter Compatibility: Passing AABB instance to update() correctly wipes minions', () => {
      const soldier = new SoldierEnemy('soldier_aabb_test', 'SOLDIER_RIFLE', vec2(200, 190));
      engine.addEntity(soldier);
      engine.tick(1 / 60);

      const aabbViewport = createAABB(0, 0, 480, 270);
      ultimate.trigger(engine);
      for (let i = 0; i < 72; i++) {
        ultimate.update(1 / 60, engine, aabbViewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);

      // Successfully wipes minion using AABB interface { x, y, width, height }
      expect(soldier.isAlive).toBe(false);
    });

    it('EMPIRICAL 3G: cameraShakeOffset getter provides stable zero-offset in IDLE and valid vectors in DETONATION', () => {
      expect(ultimate.cameraShakeOffset).toEqual({ x: 0, y: 0 });

      const viewport = { x: 0, y: 0, width: 480, height: 270 };
      ultimate.trigger(engine);
      expect(ultimate.cameraShakeOffset).toEqual({ x: 0, y: 0 });

      // Advance to DETONATION (72 ticks)
      for (let i = 0; i < 72; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);
      const shake = ultimate.cameraShakeOffset;
      expect(typeof shake.x).toBe('number');
      expect(typeof shake.y).toBe('number');
      expect(Number.isFinite(shake.x)).toBe(true);
      expect(Number.isFinite(shake.y)).toBe(true);
    });

    it('EMPIRICAL 3H: entitiesToAdd synchronization: entities added without prior tick() are wiped and culled during detonation', () => {
      // Add a minion and a hostile projectile to engine WITHOUT calling engine.tick()
      const pendingMinion = new SoldierEnemy('soldier_pending_1', 'SOLDIER_RIFLE', vec2(200, 190));
      const pendingBullet = new EnemyBullet('bullet_pending_1', vec2(220, 190), vec2(-200, 0));

      engine.addEntity(pendingMinion);
      engine.addEntity(pendingBullet);

      // Verify they reside in entitiesToAdd and NOT yet in entities map
      expect((engine as any).entitiesToAdd).toContain(pendingMinion);
      expect((engine as any).entitiesToAdd).toContain(pendingBullet);
      expect(engine.getEntity('soldier_pending_1')).toBeUndefined();
      expect(engine.getEntity('bullet_pending_1')).toBeUndefined();

      const viewport = { x: 0, y: 0, width: 480, height: 270 };
      ultimate.trigger(engine);
      for (let i = 0; i < 72; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);

      // Verify minion in entitiesToAdd was eliminated
      expect(pendingMinion.isAlive).toBe(false);
      expect(pendingMinion.health).toBe(0);

      // Verify hostile projectile was culled and removed from entitiesToAdd
      expect(pendingBullet.isAlive).toBe(false);
      expect((engine as any).entitiesToAdd).not.toContain(pendingBullet);
    });

    it('EMPIRICAL 3I: getCinematicState() returns valid RenderCinematicFXState across phases and undefined in IDLE', () => {
      expect(ultimate.getCinematicState()).toBeUndefined();

      const viewport = { x: 0, y: 0, width: 480, height: 270 };
      ultimate.trigger(engine);
      expect(ultimate.phase).toBe(UltimatePhase.FREEZE);
      const freezeState = ultimate.getCinematicState();
      expect(freezeState).toBeDefined();
      expect(freezeState?.screenFlashAlpha).toBeGreaterThan(0);

      // Advance to STRIKE_PASS (35 ticks)
      for (let i = 0; i < 35; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.STRIKE_PASS);
      const strikeState = ultimate.getCinematicState();
      expect(strikeState?.bomber).toBeDefined();
      expect(typeof strikeState?.bomber?.x).toBe('number');

      // Advance to DETONATION (another 36 ticks)
      for (let i = 0; i < 36; i++) {
        ultimate.update(1 / 60, engine, viewport);
      }
      expect(ultimate.phase).toBe(UltimatePhase.DETONATION);
      const detState = ultimate.getCinematicState();
      expect(detState?.shockwaves).toBeDefined();
      expect(detState?.shockwaves?.length).toBeGreaterThan(0);
      expect(detState?.cameraShake?.intensity).toBeGreaterThan(0);
    });
  });
});
