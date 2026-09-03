import { describe, it, expect } from 'vitest';
import { FullMetalSlugGame } from '../../src/main';
import { KeyboardController } from '../../src/input/KeyboardController';
import { PlayerKinematics, AimAngle, PlayerPosture, PlayerActionState } from '../../src/core/player/PlayerKinematics';

describe('ADVERSARIAL SUITE 1: Edge Cases in Input Latching & Key Mapping', () => {
  it('1.1: Rapid keydown/keyup sequence within a single frame tick across all jump keys (Space, KeyK, KeyX)', () => {
    const jumpKeys = [
      { code: 'Space', key: ' ' },
      { code: 'KeyK', key: 'k' },
      { code: 'KeyX', key: 'x' },
    ];

    for (const { code, key } of jumpKeys) {
      const kb = new KeyboardController();
      // Rapid tap: keydown followed immediately by keyup before getSnapshot()
      kb['handleKeyDown']({ code, key, preventDefault: () => {} } as any);
      kb['handleKeyUp']({ code, key } as any);

      // Snapshot 1 must capture the latched edge
      const snap1 = kb.getSnapshot();
      expect(snap1.jumpPressed, `Key ${code} should register jumpPressed: true`).toBe(true);
      expect(snap1.jumpHeld, `Key ${code} should register jumpHeld: false`).toBe(false);

      // Snapshot 2 without further events must be completely cleared
      const snap2 = kb.getSnapshot();
      expect(snap2.jumpPressed, `Key ${code} snap2 jumpPressed should be false`).toBe(false);
      expect(snap2.jumpHeld, `Key ${code} snap2 jumpHeld should be false`).toBe(false);
    }
  });

  it('1.2: Rapid keydown/keyup sequence for fire keys (KeyJ, KeyZ) within a single tick', () => {
    const fireKeys = [
      { code: 'KeyJ', key: 'j' },
      { code: 'KeyZ', key: 'z' },
    ];

    for (const { code, key } of fireKeys) {
      const kb = new KeyboardController();
      kb['handleKeyDown']({ code, key, preventDefault: () => {} } as any);
      kb['handleKeyUp']({ code, key } as any);

      const snap1 = kb.getSnapshot();
      expect(snap1.shootPressed, `Key ${code} should register shootPressed: true`).toBe(true);
      expect(snap1.shootHeld, `Key ${code} should register shootHeld: false`).toBe(false);

      const snap2 = kb.getSnapshot();
      expect(snap2.shootPressed).toBe(false);
      expect(snap2.shootHeld).toBe(false);
    }
  });

  it('1.3: Rapid keydown/keyup sequence for grenade keys (KeyL, KeyC) within a single tick', () => {
    const grenadeKeys = [
      { code: 'KeyL', key: 'l' },
      { code: 'KeyC', key: 'c' },
    ];

    for (const { code, key } of grenadeKeys) {
      const kb = new KeyboardController();
      kb['handleKeyDown']({ code, key, preventDefault: () => {} } as any);
      kb['handleKeyUp']({ code, key } as any);

      const snap1 = kb.getSnapshot();
      expect(snap1.grenadePressed, `Key ${code} should register grenadePressed: true`).toBe(true);

      const snap2 = kb.getSnapshot();
      expect(snap2.grenadePressed).toBe(false);
    }
  });

  it('1.4: Multi-press storm within a single frame tick (keydown -> keyup -> keydown -> keyup)', () => {
    const kb = new KeyboardController();
    // Simulate high-frequency bounce / jitter within 0ms
    kb['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    kb['handleKeyUp']({ code: 'Space', key: ' ' } as any);
    kb['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    kb['handleKeyUp']({ code: 'Space', key: ' ' } as any);

    const snap = kb.getSnapshot();
    expect(snap.jumpPressed).toBe(true);
    expect(snap.jumpHeld).toBe(false);

    const snapNext = kb.getSnapshot();
    expect(snapNext.jumpPressed).toBe(false);
    expect(snapNext.jumpHeld).toBe(false);
  });

  it('1.5: Simultaneous triple-tap: Space, KeyJ, KeyL all tapped within the same frame tick', () => {
    const kb = new KeyboardController();
    kb['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    kb['handleKeyUp']({ code: 'Space', key: ' ' } as any);
    kb['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);
    kb['handleKeyUp']({ code: 'KeyJ', key: 'j' } as any);
    kb['handleKeyDown']({ code: 'KeyL', key: 'l', preventDefault: () => {} } as any);
    kb['handleKeyUp']({ code: 'KeyL', key: 'l' } as any);

    const snap = kb.getSnapshot();
    expect(snap.jumpPressed).toBe(true);
    expect(snap.shootPressed).toBe(true);
    expect(snap.grenadePressed).toBe(true);
    expect(snap.jumpHeld).toBe(false);
    expect(snap.shootHeld).toBe(false);
  });

  it('1.6: OS Auto-Repeat Suppression (e.repeat = true does not re-trigger edge latches)', () => {
    const kb = new KeyboardController();
    // Initial physical press
    kb['handleKeyDown']({ code: 'Space', key: ' ', repeat: false, preventDefault: () => {} } as any);
    const snap1 = kb.getSnapshot();
    expect(snap1.jumpPressed).toBe(true);
    expect(snap1.jumpHeld).toBe(true);

    // OS auto-repeat event arrives while key is still held
    kb['handleKeyDown']({ code: 'Space', key: ' ', repeat: true, preventDefault: () => {} } as any);
    const snap2 = kb.getSnapshot();
    // Must NOT re-trigger jumpPressed edge
    expect(snap2.jumpPressed).toBe(false);
    expect(snap2.jumpHeld).toBe(true);
  });

  it('1.7: Controller reset() cleanses all held states and latched edge flags', () => {
    const kb = new KeyboardController();
    kb['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    kb['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);
    expect(kb.jump).toBe(true);
    expect(kb.jumpJustPressed).toBe(true);

    kb.reset();

    expect(kb.jump).toBe(false);
    expect(kb.fire).toBe(false);
    expect(kb.jumpJustPressed).toBe(false);
    expect(kb.fireJustPressed).toBe(false);

    const snap = kb.getSnapshot();
    expect(snap.jumpPressed).toBe(false);
    expect(snap.jumpHeld).toBe(false);
    expect(snap.shootPressed).toBe(false);
    expect(snap.shootHeld).toBe(false);
  });
});

describe('ADVERSARIAL SUITE 2: Jump Kinematics & Parabolic Arc Verification', () => {
  it('2.1: Player vertical position Y strictly decreases monotonically on jump ascent until apex', () => {
    const game = new FullMetalSlugGame();
    expect(game.player.position.y).toBe(230);
    expect(game.player.isGrounded).toBe(true);

    // Press jump key
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);

    const ascentFrames: { frame: number; y: number; vy: number }[] = [];

    // Step 1: Initial impulse check
    game.step(1 / 60);
    expect(game.player.velocity.y).toBeCloseTo(-346.67, 1);
    expect(game.player.position.y).toBeLessThan(230);
    expect(game.player.position.y).toBeCloseTo(224.22, 1);
    expect(game.player.isGrounded).toBe(false);
    ascentFrames.push({ frame: 1, y: game.player.position.y, vy: game.player.velocity.y });

    // Step through remaining ascent frames until apex (velocity.y >= 0)
    for (let f = 2; f <= 30; f++) {
      game.step(1 / 60);
      ascentFrames.push({ frame: f, y: game.player.position.y, vy: game.player.velocity.y });
      if (game.player.velocity.y >= 0) break;
    }

    // Apex occurs at frame 28 where Y reaches minimum (151.76px)
    const apexIndex = ascentFrames.findIndex((f) => f.vy >= 0);
    expect(apexIndex).toBeGreaterThan(20);

    // Mathematically assert strict monotonic decrease in Y throughout all ascent frames up to peak
    for (let i = 0; i < apexIndex - 1; i++) {
      const prev = ascentFrames[i];
      const next = ascentFrames[i + 1];
      expect(next.y, `Frame ${next.frame} Y must be strictly less than frame ${prev.frame} Y`).toBeLessThan(prev.y);
    }

    // Verify apex peak displacement: delta Y must reach ~ -78.24px (apex Y approx 151.76px)
    const apexFrame = ascentFrames[apexIndex - 1]; // Peak frame with minimum Y
    expect(apexFrame.y).toBeCloseTo(151.76, 0.5);
    const deltaYPeak = apexFrame.y - 230;
    expect(deltaYPeak).toBeLessThan(-75);
    expect(deltaYPeak).toBeGreaterThan(-85);
  });

  it('2.2: Parabolic descent strictly increases monotonically and lands on solid ground at Y = 230.00', () => {
    const game = new FullMetalSlugGame();
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);

    const fullArc: { frame: number; y: number; vy: number; isGrounded: boolean }[] = [];

    for (let frame = 1; frame <= 65; frame++) {
      game.step(1 / 60);
      fullArc.push({
        frame,
        y: game.player.position.y,
        vy: game.player.velocity.y,
        isGrounded: game.player.isGrounded,
      });
      if (frame > 10 && game.player.isGrounded) break;
    }

    const apexIndex = fullArc.findIndex((f) => f.vy >= 0);
    const landingFrame = fullArc[fullArc.length - 1];

    // Mathematically assert strict monotonic increase in Y during descent until landing
    for (let i = apexIndex; i < fullArc.length - 2; i++) {
      const prev = fullArc[i];
      const next = fullArc[i + 1];
      expect(next.y, `Descent frame ${next.frame} Y must be strictly greater than frame ${prev.frame} Y`).toBeGreaterThan(prev.y);
    }

    // Assert exact solid landing conditions on frame 56
    expect(landingFrame.frame).toBe(56);
    expect(landingFrame.y).toBe(230);
    expect(landingFrame.vy).toBe(0);
    expect(landingFrame.isGrounded).toBe(true);
    expect(game.player.actionState).toBe(PlayerActionState.IDLE);

    // On next frame tick, grounded posture transitions from AIRBORNE to STANDING
    game.step(1 / 60);
    expect(game.player.posture).toBe(PlayerPosture.STANDING);
  });

  it('2.3: Variable Jump Apex Cut (Short Hop vs Full Jump)', () => {
    // Full jump: hold jump key throughout
    const gameFull = new FullMetalSlugGame();
    gameFull.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    let fullMinY = Infinity;
    for (let f = 1; f <= 60; f++) {
      gameFull.step(1 / 60);
      if (gameFull.player.position.y < fullMinY) fullMinY = gameFull.player.position.y;
      if (f > 10 && gameFull.player.isGrounded) break;
    }

    // Short hop: release jump key after 2 frames
    const gameShort = new FullMetalSlugGame();
    gameShort.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    gameShort.step(1 / 60);
    gameShort.step(1 / 60);
    gameShort.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);

    let shortMinY = Infinity;
    let shortLandingFrame = 0;
    for (let f = 3; f <= 60; f++) {
      gameShort.step(1 / 60);
      if (gameShort.player.position.y < shortMinY) shortMinY = gameShort.player.position.y;
      if (f > 5 && gameShort.player.isGrounded) {
        shortLandingFrame = f;
        break;
      }
    }

    // Full jump delta Y: ~ -78.24px (apex ~ 151.76px)
    // Short hop delta Y: ~ -27.69px (apex ~ 202.31px)
    expect(fullMinY).toBeCloseTo(151.76, 0.5);
    expect(shortMinY).toBeCloseTo(202.31, 0.5);
    expect(shortMinY).toBeGreaterThan(fullMinY + 40); // Apex cut produces dramatically lower jump
    expect(shortLandingFrame).toBe(33); // Short hop lands much faster (33 frames vs 56 frames)
    expect(gameShort.player.position.y).toBe(230);
    expect(gameShort.player.isGrounded).toBe(true);
  });

  it('2.4: 2D Parabolic Trajectory with Horizontal Movement (Solid Ground vs Elevated Dock Landing)', () => {
    // 2.4A: Moving left on flat ground terrain (ground_main, Y = 230)
    const gameLeft = new FullMetalSlugGame();
    gameLeft.player.position.x = 120;
    const startXLeft = 120;

    gameLeft.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    gameLeft.keyboard['handleKeyDown']({ code: 'ArrowLeft', key: 'ArrowLeft', preventDefault: () => {} } as any);

    let prevX = startXLeft;
    for (let f = 1; f <= 56; f++) {
      gameLeft.step(1 / 60);
      expect(gameLeft.player.position.x, `Leftward Frame ${f} X must decrease monotonically`).toBeLessThan(prevX);
      prevX = gameLeft.player.position.x;
    }
    // Lands on solid main ground at Y = 230
    expect(gameLeft.player.position.y).toBe(230);
    expect(gameLeft.player.isGrounded).toBe(true);

    // 2.4B: Moving right into elevated pier platform (dock_1, bounds [140, 260], Y = 175)
    const gameRight = new FullMetalSlugGame();
    const startXRight = gameRight.player.position.x; // 80

    gameRight.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    gameRight.keyboard['handleKeyDown']({ code: 'ArrowRight', key: 'ArrowRight', preventDefault: () => {} } as any);

    for (let f = 1; f <= 60; f++) {
      gameRight.step(1 / 60);
      if (f > 10 && gameRight.player.isGrounded) {
        break;
      }
    }
    // Clean landing on elevated platform dock_1 at Y = 175
    expect(gameRight.player.position.y).toBe(175);
    expect(gameRight.player.isGrounded).toBe(true);
    expect(gameRight.player.position.x).toBeGreaterThan(startXRight);
    expect(gameRight.player.position.x).toBeGreaterThan(140);
    expect(gameRight.player.position.x).toBeLessThan(260);
  });
});

describe('ADVERSARIAL SUITE 3: Rapid Repeated Jump Presses & Bouncing On Ground Contact', () => {
  it('3.1: Jump Buffering window: pressing Jump 2 frames prior to touchdown executes immediate bounce upon landing', () => {
    const game = new FullMetalSlugGame();

    // Initial jump
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.step(1 / 60);
    game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);

    // Natural landing frame for single short impulse is around frame 31
    // Advance to frame 28 (3 frames before landing)
    for (let f = 2; f <= 28; f++) {
      game.step(1 / 60);
    }
    expect(game.player.isGrounded).toBe(false);

    // Press jump at frame 29 (in mid-air, 2 frames before touchdown)
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.step(1 / 60); // frame 29
    game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);
    expect(game.player.isGrounded).toBe(false);
    expect((game.player as any).jumpBufferTimer).toBeGreaterThan(0);

    game.step(1 / 60); // frame 30 (falling toward ground)
    expect(game.player.isGrounded).toBe(false);

    // Frame 31: Touchdown! Buffered jump MUST trigger immediately on contact
    game.step(1 / 60);
    expect(game.player.position.y).toBe(230);
    expect(game.player.velocity.y).toBe(PlayerKinematics.JUMP_IMPULSE); // -360 px/s!
    expect(game.player.isGrounded).toBe(false); // Instantly bounced!

    // Frame 32: Already ascending
    game.step(1 / 60);
    expect(game.player.position.y).toBeLessThan(230);
    expect(game.player.isGrounded).toBe(false);
  });

  it('3.2: 600-Frame Pathological Jump Mashing (jump key pressed every single tick for 10 seconds)', () => {
    const game = new FullMetalSlugGame();
    let totalJumps = 0;

    for (let frame = 0; frame < 600; frame++) {
      // Rapid tap on every frame
      game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
      game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);

      const prevVy = game.player.velocity.y;
      game.step(1 / 60);

      // Detect jump initiation (-360 px/s impulse)
      if (game.player.velocity.y === PlayerKinematics.JUMP_IMPULSE || (prevVy >= 0 && game.player.velocity.y < -300)) {
        totalJumps++;
      }

      // Assert physical invariants
      expect(game.player.position.y, `Frame ${frame} Y must never clip underground`).toBeLessThanOrEqual(230.001);
      expect(Number.isFinite(game.player.position.y)).toBe(true);
      expect(Number.isFinite(game.player.velocity.y)).toBe(true);
    }

    // Over 600 frames with ~54-56 frames per jump cycle, exactly 11 jumps should execute
    expect(totalJumps).toBe(11);
  });

  it('3.3: Jump Key Continuously Held: player lands cleanly and does NOT auto-bounce without releasing', () => {
    const game = new FullMetalSlugGame();

    // Press and HOLD jump key continuously
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);

    for (let frame = 1; frame <= 56; frame++) {
      game.step(1 / 60);
    }

    // At frame 56, player lands on ground
    expect(game.player.position.y).toBe(230);
    expect(game.player.isGrounded).toBe(true);

    // Keep holding jump for another 30 frames without releasing
    for (let frame = 57; frame <= 87; frame++) {
      game.step(1 / 60);
      expect(game.player.position.y).toBe(230);
      expect(game.player.isGrounded).toBe(true);
      expect(game.player.velocity.y).toBe(0);
    }
  });
});

describe('ADVERSARIAL SUITE 4: Simultaneous Multimodal Combat Actions Stress', () => {
  it('4.1: Simultaneous Jump + Fire on exact same tick', () => {
    const game = new FullMetalSlugGame();
    const initEntityCount = game.engine.getAllEntities().length;

    // Dispatch Jump + Fire simultaneously
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);

    game.step(1 / 60);

    // Assert Player jumped
    expect(game.player.isGrounded).toBe(false);
    expect(game.player.position.y).toBeCloseTo(224.22, 1);
    expect(game.player.velocity.y).toBeCloseTo(-346.67, 1);

    // Assert Projectile was spawned simultaneously
    const entities = game.engine.getAllEntities();
    expect(entities.length).toBe(initEntityCount + 1);
    const bullet = entities.find((e) => e.type === 'PROJECTILE') as any;
    expect(bullet).toBeDefined();
    expect(bullet.velocity.x).toBe(660);
    expect(bullet.velocity.y).toBe(0);
  });

  it('4.2: Simultaneous Jump + Grenade on exact same tick', () => {
    const game = new FullMetalSlugGame();
    const initGrenades = game.player.weaponManager.getGrenadeCount(); // 10

    // Dispatch Jump + Grenade simultaneously
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyL', key: 'l', preventDefault: () => {} } as any);

    game.step(1 / 60);

    // Assert Player jumped
    expect(game.player.isGrounded).toBe(false);
    expect(game.player.position.y).toBeLessThan(230);

    // Assert Grenade was spawned and inventory decremented
    expect(game.player.weaponManager.getGrenadeCount()).toBe(initGrenades - 1);
    const grenade = game.engine.getAllEntities().find((e) => e.type === 'GRENADE') as any;
    expect(grenade).toBeDefined();
    expect(grenade.velocity.x).toBe(240);
    expect(grenade.velocity.y).toBeLessThan(0); // Arcing upward
  });

  it('4.3: Simultaneous Jump + Aim UP + Shoot', () => {
    const game = new FullMetalSlugGame();

    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyW', key: 'w', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);

    game.step(1 / 60);

    expect(game.player.isGrounded).toBe(false);
    expect(game.player.aimAngle).toBe(AimAngle.UP);
    expect(game.player.aimDirection).toEqual({ x: 0, y: -1 });

    const bullet = game.engine.getAllEntities().find((e) => e.type === 'PROJECTILE') as any;
    expect(bullet).toBeDefined();
    expect(bullet.velocity.x).toBe(0);
    expect(bullet.velocity.y).toBe(-660); // Straight up!
  });

  it('4.4: Simultaneous Jump + Aim UP-FORWARD Diagonal + Shoot', () => {
    const game = new FullMetalSlugGame();

    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyW', key: 'w', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyD', key: 'd', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);

    game.step(1 / 60);

    expect(game.player.isGrounded).toBe(false);
    expect(game.player.aimAngle).toBe(AimAngle.UP_FORWARD);
    expect(game.player.aimDirection.x).toBeCloseTo(Math.SQRT1_2, 4);
    expect(game.player.aimDirection.y).toBeCloseTo(-Math.SQRT1_2, 4);

    const bullet = game.engine.getAllEntities().find((e) => e.type === 'PROJECTILE') as any;
    expect(bullet).toBeDefined();
    expect(bullet.velocity.x).toBeCloseTo(660 * Math.SQRT1_2, 1);
    expect(bullet.velocity.y).toBeCloseTo(-660 * Math.SQRT1_2, 1);
  });

  it('4.5: Mid-Air Downward Aiming & Shooting (Airborne Down + Shoot)', () => {
    const game = new FullMetalSlugGame();

    // Step 1: Jump to become airborne
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.step(1 / 60);
    game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);
    expect(game.player.isGrounded).toBe(false);

    // Step 2: Aim Down + Shoot while airborne
    game.keyboard['handleKeyDown']({ code: 'KeyS', key: 's', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyJ', key: 'j', preventDefault: () => {} } as any);
    game.step(1 / 60);

    expect(game.player.aimAngle).toBe(AimAngle.DOWN);
    expect(game.player.aimDirection).toEqual({ x: 0, y: 1 });

    const bullet = game.engine.getAllEntities().find((e) => e.type === 'PROJECTILE') as any;
    expect(bullet).toBeDefined();
    expect(bullet.velocity.x).toBe(0);
    expect(bullet.velocity.y).toBe(660); // Downward shooting!
  });

  it('4.6: Mid-Air Downward Grenade Throw', () => {
    const game = new FullMetalSlugGame();

    // Jump
    game.keyboard['handleKeyDown']({ code: 'Space', key: ' ', preventDefault: () => {} } as any);
    game.step(1 / 60);
    game.keyboard['handleKeyUp']({ code: 'Space', key: ' ' } as any);

    // Throw grenade downward
    game.keyboard['handleKeyDown']({ code: 'KeyS', key: 's', preventDefault: () => {} } as any);
    game.keyboard['handleKeyDown']({ code: 'KeyL', key: 'l', preventDefault: () => {} } as any);
    game.step(1 / 60);

    const grenade = game.engine.getAllEntities().find((e) => e.type === 'GRENADE') as any;
    expect(grenade).toBeDefined();
    expect(grenade.velocity.x).toBe(120);
    expect(grenade.velocity.y).toBe(253); // Thrown downward!
  });

  it('4.7: Grounded Down + Jump Drop-Through Invariant', () => {
    const game = new FullMetalSlugGame();

    // 1. On Solid Ground: down + jump must NOT drop into the abyss
    game.keyboard.setAction('down', true);
    game.keyboard.setAction('jump', true);
    game.step(1 / 60);
    game.keyboard.setAction('jump', false);

    for (let f = 2; f <= 30; f++) {
      game.step(1 / 60);
    }
    expect(game.player.position.y).toBe(230);
    expect(game.player.isGrounded).toBe(true);

    // 2. On Semi-Solid Platform (dock_1 at Y = 175): down + jump cleanly drops through to solid ground
    game.player.position.x = 180;
    game.player.position.y = 175;
    game.player.isGrounded = true;
    game.step(1 / 60);
    expect(game.player.position.y).toBe(175);

    // Initiate drop-through
    game.keyboard.setAction('down', true);
    game.keyboard.setAction('jump', true);
    game.step(1 / 60);
    game.keyboard.setAction('jump', false);

    for (let f = 2; f <= 40; f++) {
      game.step(1 / 60);
    }
    // Lands on main solid ground at Y = 230
    expect(game.player.position.y).toBe(230);
    expect(game.player.isGrounded).toBe(true);
  });
});
