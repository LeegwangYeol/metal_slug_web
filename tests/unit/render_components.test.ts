import { describe, it, expect } from 'vitest';
import { PALETTES, hexToRgba, rgbaToString } from '../../src/render/sprites/Palette';
import { ProceduralSpriteFactory, createCanvasBuffer } from '../../src/render/sprites/ProceduralSpriteFactory';
import { Camera } from '../../src/render/Camera';
import { ParallaxBackground } from '../../src/render/ParallaxBackground';
import { CanvasRenderer, RenderSceneState } from '../../src/render/CanvasRenderer';
import { createAABB } from '../../src/core/physics/AABB';
import { Platform } from '../../src/core/physics/Platform';

describe('Palette & Color Utility Suite', () => {
  it('should parse hex strings to RGBA arrays correctly', () => {
    expect(hexToRgba('#FFFFFF')).toEqual([255, 255, 255, 255]);
    expect(hexToRgba('#000000')).toEqual([0, 0, 0, 255]);
    expect(hexToRgba('#F00', 0.5)).toEqual([255, 0, 0, 128]);
    expect(hexToRgba('transparent')).toEqual([0, 0, 0, 0]);
  });

  it('should format RGBA to string correctly', () => {
    expect(rgbaToString(255, 128, 0, 0.8)).toBe('rgba(255, 128, 0, 0.8)');
  });

  it('should define complete 16-color authentic Neo Geo palettes', () => {
    expect(PALETTES.PLAYER.length).toBe(16);
    expect(PALETTES.REBEL.length).toBe(16);
    expect(PALETTES.POW.length).toBe(16);
    expect(PALETTES.FIRE.length).toBe(16);
    expect(PALETTES.VEHICLE.length).toBe(16);
    expect(PALETTES.FORTRESS.length).toBe(16);
    expect(PALETTES.HUD.length).toBe(16);
    expect(PALETTES.TERRAIN.length).toBe(16);
  });
});

describe('ProceduralSpriteFactory Suite', () => {
  const factory = ProceduralSpriteFactory.getInstance();

  it('should initialize and generate complete sprite catalogue', () => {
    expect(factory.count()).toBeGreaterThan(50);
  });

  it('should generate all required Player Marco soldier sprites', () => {
    expect(factory.hasSprite('player_idle_0')).toBe(true);
    expect(factory.hasSprite('player_idle_3')).toBe(true);
    expect(factory.hasSprite('player_run_0')).toBe(true);
    expect(factory.hasSprite('player_run_5')).toBe(true);
    expect(factory.hasSprite('player_jump_rise')).toBe(true);
    expect(factory.hasSprite('player_jump_fall')).toBe(true);
    expect(factory.hasSprite('player_crouch_idle')).toBe(true);
    expect(factory.hasSprite('player_knife_0')).toBe(true);
    expect(factory.hasSprite('player_knife_1')).toBe(true);
    expect(factory.hasSprite('player_fire_0')).toBe(true);
    expect(factory.hasSprite('player_death_0')).toBe(true);

    // 8 Aiming directions
    for (let aim = 0; aim < 8; aim++) {
      expect(factory.hasSprite(`player_aim_${aim}`)).toBe(true);
    }
  });

  it('should generate all Rebel infantry types', () => {
    // Rifleman
    expect(factory.hasSprite('rebel_rifle_idle')).toBe(true);
    expect(factory.hasSprite('rebel_rifle_walk_0')).toBe(true);
    expect(factory.hasSprite('rebel_rifle_fire_0')).toBe(true);

    // Knife charger
    expect(factory.hasSprite('rebel_knife_idle')).toBe(true);
    expect(factory.hasSprite('rebel_knife_run_0')).toBe(true);
    expect(factory.hasSprite('rebel_knife_leap')).toBe(true);

    // Grenade thrower
    expect(factory.hasSprite('rebel_grenade_idle')).toBe(true);
    expect(factory.hasSprite('rebel_grenade_throw')).toBe(true);

    // Shield trooper
    expect(factory.hasSprite('rebel_shield_idle')).toBe(true);
    expect(factory.hasSprite('rebel_shield_bash')).toBe(true);
  });

  it('should generate Hostage POW sprites', () => {
    expect(factory.hasSprite('pow_tied_0')).toBe(true);
    expect(factory.hasSprite('pow_freed')).toBe(true);
    expect(factory.hasSprite('pow_salute_0')).toBe(true);
    expect(factory.hasSprite('pow_drop_item')).toBe(true);
    expect(factory.hasSprite('pow_escape_0')).toBe(true);
  });

  it('should generate Mid-Boss Iron Technical components', () => {
    expect(factory.hasSprite('iron_technical_hull')).toBe(true);
    expect(factory.hasSprite('iron_technical_treads_0')).toBe(true);
    expect(factory.hasSprite('iron_technical_turret')).toBe(true);
    expect(factory.hasSprite('iron_technical_wreckage')).toBe(true);
  });

  it('should generate Stage 1 Boss Tetsuyuki War Fortress components', () => {
    expect(factory.hasSprite('tetsuyuki_hull_p1')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_hull_p2')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_hull_p3')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_cannon')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_rocket_pod_open')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_gatling')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_laser_beam')).toBe(true);
    expect(factory.hasSprite('tetsuyuki_reactor_core')).toBe(true);
  });

  it('should generate projectiles and multi-frame explosions', () => {
    expect(factory.hasSprite('proj_bullet_handgun')).toBe(true);
    expect(factory.hasSprite('proj_bullet_hmg')).toBe(true);
    expect(factory.hasSprite('casing_brass_0')).toBe(true);
    expect(factory.hasSprite('proj_flame_0')).toBe(true);
    expect(factory.hasSprite('proj_grenade_0')).toBe(true);
    expect(factory.hasSprite('proj_rocket')).toBe(true);
    expect(factory.hasSprite('proj_mortar')).toBe(true);

    expect(factory.hasSprite('explosion_small_0')).toBe(true);
    expect(factory.hasSprite('explosion_medium_0')).toBe(true);
    expect(factory.hasSprite('explosion_large_0')).toBe(true);
  });

  it('should generate HUD badges and digits', () => {
    expect(factory.hasSprite('hud_badge_hmg')).toBe(true);
    expect(factory.hasSprite('hud_badge_flame')).toBe(true);
    expect(factory.hasSprite('hud_badge_pistol')).toBe(true);
    expect(factory.hasSprite('hud_icon_grenade')).toBe(true);
    expect(factory.hasSprite('hud_icon_pow')).toBe(true);
    for (let d = 0; d <= 9; d++) {
      expect(factory.hasSprite(`hud_digit_${d}`)).toBe(true);
    }
    expect(factory.hasSprite('hud_symbol_infinity')).toBe(true);
    expect(factory.hasSprite('hud_boss_bar_frame')).toBe(true);
  });

  it('should draw sprites onto a destination canvas context without error', () => {
    const dest = createCanvasBuffer(100, 100);
    const ctx = dest.getContext('2d');
    expect(ctx).not.toBeNull();
    if (ctx) {
      const drawn = factory.drawSprite(ctx, 'player_run_0', 50, 50, { flipX: true, scale: 1.5 });
      expect(drawn).toBe(true);
    }
  });
});

describe('Camera Suite', () => {
  it('should maintain deadzone tracking horizontally and vertically', () => {
    const camera = new Camera({ viewportWidth: 480, viewportHeight: 270, forwardLock: false });
    camera.reset(0, 0);

    // Target inside deadzone (deadzoneLeft = 168, deadzoneRight = 216)
    camera.update(190, 120, 1 / 60);
    expect(camera.x).toBe(0);

    // Move target past deadzoneRight (> 216)
    camera.update(300, 120, 1 / 60);
    expect(camera.x).toBe(300 - camera.deadzoneRight);
  });

  it('should enforce forward-only scrolling ratchet lock', () => {
    const camera = new Camera({ viewportWidth: 480, viewportHeight: 270, forwardLock: true });
    camera.reset(0, 0);

    // Advance forward
    camera.update(400, 120, 1 / 60);
    const advancedX = camera.x;
    expect(advancedX).toBeGreaterThan(0);

    // Retreat player backwards (target moves to 100)
    camera.update(100, 120, 1 / 60);
    // Camera must not scroll backwards!
    expect(camera.x).toBe(advancedX);
  });

  it('should clamp inside stage boundaries and handle arena lock', () => {
    const camera = new Camera({
      viewportWidth: 480,
      viewportHeight: 270,
      forwardLock: false,
      bounds: { minX: 100, maxX: 1000, minY: 0, maxY: 270 },
    });
    camera.reset(100, 0);

    // Advance beyond maxX
    camera.update(5000, 120, 1 / 60);
    expect(camera.x).toBe(1000 - 480); // Clamped to maxX - viewportWidth

    // Arena lock (e.g. Mid-Boss)
    camera.lock({ minX: 500, maxX: 980, minY: 0, maxY: 270 });
    expect(camera.bounds.minX).toBe(500);
    expect(camera.bounds.maxX).toBe(980);
  });

  it('should compute screen shake trauma and decay over time', () => {
    const camera = new Camera({ viewportWidth: 480, viewportHeight: 270 });
    camera.reset(0, 0);

    camera.shake(10, 0.5); // 10px trauma for 0.5s
    expect(camera.shakeIntensity).toBe(10);
    expect(camera.shakeTimer).toBe(0.5);

    camera.update(0, 0, 0.1);
    expect(camera.shakeTimer).toBeCloseTo(0.4);

    // Fast-forward past duration
    camera.update(0, 0, 0.5);
    expect(camera.shakeTimer).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);
  });

  it('should accurately transform world and screen coordinates', () => {
    const camera = new Camera({ viewportWidth: 480, viewportHeight: 270, forwardLock: false });
    camera.reset(200, 50);

    const screen = camera.worldToScreen(250, 100);
    expect(screen.x).toBe(50);
    expect(screen.y).toBe(50);

    const world = camera.screenToWorld(50, 50);
    expect(world.x).toBe(250);
    expect(world.y).toBe(100);
  });

  it('should perform visibility frustum culling', () => {
    const camera = new Camera({ viewportWidth: 480, viewportHeight: 270, forwardLock: false });
    camera.reset(0, 0);

    const insideBox = createAABB(50, 50, 20, 20);
    const outsideBox = createAABB(1000, 50, 20, 20);

    expect(camera.isVisible(insideBox)).toBe(true);
    expect(camera.isVisible(outsideBox)).toBe(false);
  });
});

describe('ParallaxBackground Suite', () => {
  it('should instantiate and render all 4 parallax layers without error', () => {
    const parallax = new ParallaxBackground();
    const dest = createCanvasBuffer(480, 270);
    const ctx = dest.getContext('2d');
    expect(ctx).not.toBeNull();

    if (ctx) {
      expect(() => {
        parallax.render(ctx, 100, 0, 1.5);
      }).not.toThrow();
    }
  });
});

describe('CanvasRenderer Suite', () => {
  it('should calculate crisp letterbox scaling accurately', () => {
    // 1:1 exact
    const lb1 = CanvasRenderer.calculateLetterbox(480, 270);
    expect(lb1.scale).toBe(1);
    expect(lb1.offsetX).toBe(0);
    expect(lb1.offsetY).toBe(0);

    // 2x integer scale (960 x 540)
    const lb2 = CanvasRenderer.calculateLetterbox(960, 540);
    expect(lb2.scale).toBe(2);
    expect(lb2.width).toBe(960);
    expect(lb2.height).toBe(540);

    // Ultrawide pillarbox (1200 x 540)
    const lb3 = CanvasRenderer.calculateLetterbox(1200, 540);
    expect(lb3.scale).toBe(2);
    expect(lb3.width).toBe(960);
    expect(lb3.offsetX).toBe(120); // (1200 - 960) / 2 = 120
    expect(lb3.offsetY).toBe(0);
  });

  it('should execute full 5-pass scene render cycle without exceptions', () => {
    const renderer = new CanvasRenderer();
    const camera = renderer.camera;

    const testPlatforms: Platform[] = [
      { id: 'floor', type: 'SOLID', bounds: createAABB(0, 230, 1000, 40) },
      { id: 'ledge', type: 'SEMI_SOLID', bounds: createAABB(100, 160, 120, 10) },
    ];

    const scene: RenderSceneState = {
      camera,
      time: 2.0,
      platforms: testPlatforms,
      player: {
        x: 120,
        y: 230,
        facing: 1,
        state: 'run',
        animFrame: 2,
      },
      enemies: [
        { id: 'e1', type: 'SOLDIER_RIFLE', x: 250, y: 230, facing: -1, state: 'PATROL' },
        { id: 'e2', type: 'MID_BOSS_VEHICLE', x: 400, y: 200, facing: -1, state: 'PATROL', turretAngle: -0.2 },
      ],
      boss: {
        x: 600,
        y: 120,
        phase: 'PHASE_1_ARTILLERY',
        health: 1200,
        maxHealth: 1500,
      },
      pows: [
        { id: 'pow1', x: 180, y: 230, state: 'tied' },
      ],
      projectiles: [
        { id: 'p1', type: 'hmg', x: 150, y: 210 },
        { id: 'p2', type: 'casing', x: 130, y: 205 },
      ],
      explosions: [
        { id: 'x1', type: 'medium', x: 220, y: 220, progress: 0.5 },
      ],
      hud: {
        score: 12500,
        lives: 3,
        weaponType: 'HEAVY_MACHINE_GUN',
        ammo: 182,
        grenades: 10,
        hostagesRescued: 1,
        bossHealth: 1200,
        bossMaxHealth: 1500,
      },
    };

    expect(() => {
      renderer.renderScene(scene);
    }).not.toThrow();

    // Blit to output canvas
    const target = createCanvasBuffer(960, 540);
    expect(() => {
      renderer.blitToCanvas(target);
    }).not.toThrow();
  });
});
