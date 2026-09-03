import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProceduralSpriteFactory,
  createCanvasBuffer,
} from '../../src/render/sprites/ProceduralSpriteFactory';
import {
  CanvasRenderer,
  RenderPlayerState,
  RenderSceneState,
} from '../../src/render/CanvasRenderer';
import { AimAngle } from '../../src/core/player/PlayerKinematics';
import { vec2 } from '../../src/core/math/Vector2D';
import { Camera } from '../../src/render/Camera';

describe('CHALLENGER_OVERHAUL_2: Empirical Sprite Engine, Crosshairs & Aim Animation Challenge', () => {
  let factory: ProceduralSpriteFactory;
  let renderer: CanvasRenderer;
  let camera: Camera;

  beforeEach(() => {
    factory = ProceduralSpriteFactory.getInstance();
    camera = new Camera({ viewportWidth: 480, viewportHeight: 270 });
    renderer = new CanvasRenderer({ camera });
  });

  // =========================================================================
  // TASK 1: ProceduralSpriteFactory All 164 Sprite Keys & Buffer Integrity
  // =========================================================================
  describe('Task 1: ProceduralSpriteFactory All 164 Sprite Keys & Buffer Integrity', () => {
    it('EMPIRICAL ORACLE 1A: Sprite factory initializes exactly or at least 164 unique sprite keys', () => {
      const allKeys = factory.getAllKeys();
      const count = factory.count();

      console.log(`[Oracle 1A] Total Registered Sprite Keys: ${count}`);
      expect(count).toBeGreaterThanOrEqual(164);
      expect(allKeys.length).toBe(count);

      // Verify no duplicate keys
      const uniqueKeys = new Set(allKeys);
      expect(uniqueKeys.size).toBe(count);
    });

    it('EMPIRICAL ORACLE 1B: Every single registered sprite key yields a non-null buffer with valid dimensions and finite anchors', () => {
      const allKeys = factory.getAllKeys();
      const defectiveKeys: Array<{ key: string; error: string }> = [];

      for (const key of allKeys) {
        if (!factory.hasSprite(key)) {
          defectiveKeys.push({ key, error: 'hasSprite returned false' });
          continue;
        }

        const frame = factory.getSprite(key);
        if (!frame) {
          defectiveKeys.push({ key, error: 'getSprite returned undefined/null' });
          continue;
        }

        if (!frame.canvas) {
          defectiveKeys.push({ key, error: 'frame.canvas is undefined/null' });
          continue;
        }

        if (typeof frame.width !== 'number' || frame.width <= 0 || !Number.isFinite(frame.width)) {
          defectiveKeys.push({ key, error: `Invalid frame.width: ${frame.width}` });
          continue;
        }

        if (typeof frame.height !== 'number' || frame.height <= 0 || !Number.isFinite(frame.height)) {
          defectiveKeys.push({ key, error: `Invalid frame.height: ${frame.height}` });
          continue;
        }

        if (typeof frame.anchorX !== 'number' || !Number.isFinite(frame.anchorX) || frame.anchorX < 0) {
          defectiveKeys.push({ key, error: `Invalid frame.anchorX: ${frame.anchorX}` });
          continue;
        }

        if (typeof frame.anchorY !== 'number' || !Number.isFinite(frame.anchorY) || frame.anchorY < 0) {
          defectiveKeys.push({ key, error: `Invalid frame.anchorY: ${frame.anchorY}` });
          continue;
        }

        const ctx = frame.canvas.getContext('2d');
        if (!ctx) {
          defectiveKeys.push({ key, error: 'frame.canvas.getContext(2d) returned null' });
        }
      }

      console.log(`[Oracle 1B] Verified ${allKeys.length} sprite buffers. Defective count: ${defectiveKeys.length}`);
      expect(defectiveKeys).toEqual([]);
    });

    it('EMPIRICAL STRESS 1C: Every single sprite renders cleanly with flipping, rotation, scaling and alpha blending', () => {
      const allKeys = factory.getAllKeys();
      const mockBuffer = createCanvasBuffer(128, 128);
      const mockCtx = mockBuffer.getContext('2d');
      expect(mockCtx).not.toBeNull();

      let successfulDraws = 0;
      const failedDraws: Array<{ key: string; error: string }> = [];

      for (const key of allKeys) {
        try {
          // Standard draw
          const res1 = factory.drawSprite(mockCtx!, key, 30, 30);
          if (!res1) {
            failedDraws.push({ key, error: 'drawSprite returned false' });
            continue;
          }

          // Adversarial transform draw (flipX, flipY, rotation, scaling, alpha)
          const res2 = factory.drawSprite(mockCtx!, key, 64, 64, {
            flipX: true,
            flipY: true,
            rotation: Math.PI / 4,
            scale: 1.5,
            alpha: 0.5,
          });
          if (!res2) {
            failedDraws.push({ key, error: 'drawSprite with transforms returned false' });
            continue;
          }

          successfulDraws++;
        } catch (err: any) {
          failedDraws.push({ key, error: err?.message ?? String(err) });
        }
      }

      console.log(`[Stress 1C] Successfully rendered: ${successfulDraws}/${allKeys.length} sprites under stress`);
      expect(failedDraws).toEqual([]);
      expect(successfulDraws).toBe(allKeys.length);
    });

    it('EMPIRICAL EDGE CASE 1D: Unknown sprite keys gracefully return undefined and false without exceptions', () => {
      const mockBuffer = createCanvasBuffer(64, 64);
      const mockCtx = mockBuffer.getContext('2d')!;

      const nonExistentKeys = [
        'player_unknown_foo',
        '',
        'undefined',
        'null',
        '__proto__',
        'constructor',
        'rebel_tank_invalid_frame_99',
      ];

      for (const badKey of nonExistentKeys) {
        expect(factory.hasSprite(badKey)).toBe(false);
        expect(factory.getSprite(badKey)).toBeUndefined();
        expect(() => {
          const result = factory.drawSprite(mockCtx, badKey, 0, 0);
          expect(result).toBe(false);
        }).not.toThrow();
      }
    });

    it('EMPIRICAL CATEGORY AUDIT 1E: Verifies all major sprite key categories are populated and sum to exactly 164', () => {
      const allKeys = factory.getAllKeys();

      const categories = {
        player: allKeys.filter((k) => k.startsWith('player_')),
        rebel: allKeys.filter((k) => k.startsWith('rebel_') || k.startsWith('soldier_')),
        pow: allKeys.filter((k) => k.startsWith('pow_')),
        ironTechnical: allKeys.filter((k) => k.startsWith('iron_technical_')),
        tetsuyuki: allKeys.filter((k) => k.startsWith('tetsuyuki_')),
        projectile: allKeys.filter((k) => k.startsWith('proj_')),
        casings: allKeys.filter((k) => k.startsWith('casing_')),
        explosions: allKeys.filter((k) => k.startsWith('explosion_')),
        hud: allKeys.filter((k) => k.startsWith('hud_')),
      };

      console.log('[Category Audit 1E] Verified Breakdown:', {
        player: categories.player.length,
        rebel: categories.rebel.length,
        pow: categories.pow.length,
        ironTechnical: categories.ironTechnical.length,
        tetsuyuki: categories.tetsuyuki.length,
        projectile: categories.projectile.length,
        casings: categories.casings.length,
        explosions: categories.explosions.length,
        hud: categories.hud.length,
        total: allKeys.length,
      });

      expect(categories.player.length).toBe(67);
      expect(categories.rebel.length).toBe(21);
      expect(categories.pow.length).toBe(9);
      expect(categories.ironTechnical.length).toBe(7);
      expect(categories.tetsuyuki.length).toBe(8);
      expect(categories.projectile.length).toBe(13);
      expect(categories.casings.length).toBe(4);
      expect(categories.explosions.length).toBe(18);
      expect(categories.hud.length).toBe(17);
      expect(allKeys.length).toBe(164);
    });
  });

  // =========================================================================
  // TASK 2: calculateCrosshairGeometry Across All Directions, Symmetry & Weapons
  // =========================================================================
  describe('Task 2: calculateCrosshairGeometry Across All Directions, Symmetry & Weapons', () => {
    it('EMPIRICAL ORACLE 2A: Left/Right facing symmetry across horizontal, diagonal, and vertical directions', () => {
      const testCases = [
        { angle: AimAngle.FORWARD, expectedDxR: 1, expectedDyR: 0, expectedDxL: -1, expectedDyL: 0 },
        { angle: AimAngle.UP_FORWARD, expectedDxR: Math.SQRT1_2, expectedDyR: -Math.SQRT1_2, expectedDxL: -Math.SQRT1_2, expectedDyL: -Math.SQRT1_2 },
        { angle: AimAngle.UP, expectedDxR: 0, expectedDyR: -1, expectedDxL: 0, expectedDyL: -1 },
        { angle: AimAngle.DOWN_FORWARD, expectedDxR: Math.SQRT1_2, expectedDyR: Math.SQRT1_2, expectedDxL: -Math.SQRT1_2, expectedDyL: Math.SQRT1_2 },
        { angle: AimAngle.DOWN, expectedDxR: 0, expectedDyR: 1, expectedDxL: 0, expectedDyL: 1 },
      ];

      for (const tc of testCases) {
        // Facing Right (+1)
        const pRight: RenderPlayerState = {
          x: 200,
          y: 150,
          facing: 1,
          state: 'idle',
          aimAngle: tc.angle,
          weaponType: 'PISTOL',
        };
        const geomRight = renderer.calculateCrosshairGeometry(pRight, 0);

        expect(geomRight.aimDir.x).toBeCloseTo(tc.expectedDxR, 4);
        expect(geomRight.aimDir.y).toBeCloseTo(tc.expectedDyR, 4);
        expect(Number.isFinite(geomRight.worldReticle.x)).toBe(true);
        expect(Number.isFinite(geomRight.worldReticle.y)).toBe(true);

        // Facing Left (-1)
        const pLeft: RenderPlayerState = {
          x: 200,
          y: 150,
          facing: -1,
          state: 'idle',
          aimAngle: tc.angle,
          weaponType: 'PISTOL',
        };
        const geomLeft = renderer.calculateCrosshairGeometry(pLeft, 0);

        expect(geomLeft.aimDir.x).toBeCloseTo(tc.expectedDxL, 4);
        expect(geomLeft.aimDir.y).toBeCloseTo(tc.expectedDyL, 4);
        expect(Number.isFinite(geomLeft.worldReticle.x)).toBe(true);
        expect(Number.isFinite(geomLeft.worldReticle.y)).toBe(true);

        // Vector magnitude must be exactly 1.0 (unit vector)
        const magRight = Math.hypot(geomRight.aimDir.x, geomRight.aimDir.y);
        const magLeft = Math.hypot(geomLeft.aimDir.x, geomLeft.aimDir.y);
        expect(magRight).toBeCloseTo(1.0, 4);
        expect(magLeft).toBeCloseTo(1.0, 4);

        // Reticle displacement relative to muzzle must equal aimDir * distance
        expect(geomRight.worldReticle.x - geomRight.muzzle.x).toBeCloseTo(geomRight.aimDir.x * geomRight.distance, 3);
        expect(geomRight.worldReticle.y - geomRight.muzzle.y).toBeCloseTo(geomRight.aimDir.y * geomRight.distance, 3);
        expect(geomLeft.worldReticle.x - geomLeft.muzzle.x).toBeCloseTo(geomLeft.aimDir.x * geomLeft.distance, 3);
        expect(geomLeft.worldReticle.y - geomLeft.muzzle.y).toBeCloseTo(geomLeft.aimDir.y * geomLeft.distance, 3);
      }
    });

    it('EMPIRICAL ORACLE 2B: Legacy 8-directional integer angles (0..7) correctly map without errors', () => {
      // 0: forward, 1: up-forward, 2: up, 3: up-forward(back), 4: forward(back), 5: down-forward(back), 6: down, 7: down-forward
      for (let angleInt = 0; angleInt < 8; angleInt++) {
        const p: RenderPlayerState = {
          x: 100,
          y: 100,
          facing: 1,
          state: 'idle',
          aimAngle: angleInt as any,
          weaponType: 'HEAVY_MACHINE_GUN',
        };

        const geom = renderer.calculateCrosshairGeometry(p, 0);
        expect(Number.isFinite(geom.muzzle.x)).toBe(true);
        expect(Number.isFinite(geom.muzzle.y)).toBe(true);
        expect(Number.isFinite(geom.aimDir.x)).toBe(true);
        expect(Number.isFinite(geom.aimDir.y)).toBe(true);
        expect(Number.isFinite(geom.worldReticle.x)).toBe(true);
        expect(Number.isFinite(geom.worldReticle.y)).toBe(true);
        expect(geom.distance).toBe(48); // HMG base distance
      }
    });

    it('EMPIRICAL ORACLE 2C: Weapon switching produces verified tactical distances and pulsation', () => {
      const weapons: Array<'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT'> = [
        'PISTOL',
        'HEAVY_MACHINE_GUN',
        'FLAME_SHOT',
      ];

      for (const w of weapons) {
        const p: RenderPlayerState = {
          x: 150,
          y: 150,
          facing: 1,
          state: 'idle',
          aimAngle: AimAngle.FORWARD,
          weaponType: w,
        };

        const geomT0 = renderer.calculateCrosshairGeometry(p, 0);
        const geomT1 = renderer.calculateCrosshairGeometry(p, 0.5);

        expect(geomT0.weaponType).toBe(w);
        expect(geomT1.weaponType).toBe(w);

        if (w === 'PISTOL') {
          // Base 44, pulse sin(4t)*1.5
          expect(geomT0.distance).toBeCloseTo(44, 2);
          expect(geomT1.distance).toBeCloseTo(44 + Math.sin(2.0) * 1.5, 2);
          expect(geomT1.distance).toBeGreaterThanOrEqual(42.5);
          expect(geomT1.distance).toBeLessThanOrEqual(45.5);
        } else if (w === 'HEAVY_MACHINE_GUN') {
          // Constant 48
          expect(geomT0.distance).toBe(48);
          expect(geomT1.distance).toBe(48);
        } else if (w === 'FLAME_SHOT') {
          // Base 52, pulse sin(18t)*2.0
          expect(geomT0.distance).toBeCloseTo(52, 2);
          expect(geomT1.distance).toBeCloseTo(52 + Math.sin(9.0) * 2.0, 2);
          expect(geomT1.distance).toBeGreaterThanOrEqual(50.0);
          expect(geomT1.distance).toBeLessThanOrEqual(54.0);
        }
      }
    });

    it('EMPIRICAL ADVERSARIAL STRESS 2D: Extreme coordinates, unnormalized vectors, and NaN avoidance', () => {
      const adversarialInputs: Partial<RenderPlayerState>[] = [
        { x: 0, y: 0, facing: 1 },
        { x: -99999, y: -99999, facing: -1 },
        { x: 1e6, y: 1e6, facing: 1 },
        { x: 123.456, y: 789.012, facing: 1 },
        { aimDirection: vec2(0, 0) }, // Degenerate zero vector
        { aimDirection: vec2(0.0000001, 0.0000001) }, // Micro vector
        { aimDirection: vec2(999999, -999999) }, // Huge vector
        { aimAngle: undefined },
        { aimAngle: null as any },
        { weaponType: undefined },
        { weaponType: 'UNKNOWN_WEAPON' as any },
      ];

      for (const input of adversarialInputs) {
        const p: RenderPlayerState = {
          x: 100,
          y: 100,
          facing: 1,
          state: 'idle',
          aimAngle: AimAngle.FORWARD,
          weaponType: 'PISTOL',
          ...input,
        };

        const geom = renderer.calculateCrosshairGeometry(p, 123.45);

        // Strict non-NaN, non-Infinity invariants
        expect(Number.isFinite(geom.muzzle.x)).toBe(true);
        expect(Number.isFinite(geom.muzzle.y)).toBe(true);
        expect(Number.isFinite(geom.aimDir.x)).toBe(true);
        expect(Number.isFinite(geom.aimDir.y)).toBe(true);
        expect(Number.isFinite(geom.worldReticle.x)).toBe(true);
        expect(Number.isFinite(geom.worldReticle.y)).toBe(true);
        expect(Number.isFinite(geom.distance)).toBe(true);
        expect(geom.distance).toBeGreaterThan(0);

        // Ensure aimDir magnitude is normalized
        const mag = Math.hypot(geom.aimDir.x, geom.aimDir.y);
        expect(mag).toBeCloseTo(1.0, 3);
      }
    });

    it('EMPIRICAL RENDER STRESS 2E: Full crosshair render pass across all weapon types and directions', () => {
      const weapons: Array<'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT'> = [
        'PISTOL',
        'HEAVY_MACHINE_GUN',
        'FLAME_SHOT',
      ];
      const directions = [
        AimAngle.FORWARD,
        AimAngle.UP_FORWARD,
        AimAngle.UP,
        AimAngle.DOWN_FORWARD,
        AimAngle.DOWN,
      ];
      const states: Array<'idle' | 'run' | 'jump' | 'crouch'> = ['idle', 'run', 'jump', 'crouch'];
      const facings: Array<1 | -1> = [1, -1];

      let renderPassCount = 0;

      for (const weapon of weapons) {
        for (const dir of directions) {
          for (const state of states) {
            for (const facing of facings) {
              const scene: RenderSceneState = {
                camera,
                time: 0.25,
                player: {
                  x: 240,
                  y: 135,
                  facing,
                  state,
                  aimAngle: dir,
                  weaponType: weapon,
                  isFiring: true,
                },
              };

              expect(() => {
                renderer.renderScene(scene);
              }).not.toThrow();
              renderPassCount++;
            }
          }
        }
      }

      console.log(`[Render Stress 2E] Successfully executed ${renderPassCount} full scene render passes`);
      expect(renderPassCount).toBe(3 * 5 * 4 * 2); // 120 unique render configurations
    });
  });

  // =========================================================================
  // TASK 3: 5-Directional Upper-Body Aiming Sprite Resolution
  // =========================================================================
  describe('Task 3: 5-Directional Upper-Body Aiming Sprite Resolution (resolvePlayerSpriteKey)', () => {
    const canonicalAngles = [
      { angle: AimAngle.FORWARD, name: 'FORWARD' },
      { angle: AimAngle.UP_FORWARD, name: 'UP_FORWARD' },
      { angle: AimAngle.UP, name: 'UP' },
      { angle: AimAngle.DOWN_FORWARD, name: 'DOWN_FORWARD' },
      { angle: AimAngle.DOWN, name: 'DOWN' },
    ];

    it('EMPIRICAL RESOLVER 3A: JUMP state resolves 5-directional upper-body aiming sprites', () => {
      for (const item of canonicalAngles) {
        const p: RenderPlayerState = {
          x: 100,
          y: 100,
          facing: 1,
          state: 'jump',
          aimAngle: item.angle,
        };

        const resolvedKey = renderer.resolvePlayerSpriteKey(p, 0);
        console.log(`[Resolver Jump] Angle: ${item.name} -> Resolved Key: ${resolvedKey}`);

        // Jump has explicit sprites for all 5 directions
        expect(resolvedKey).toBe(`player_jump_aim_${item.name}`);
        expect(factory.hasSprite(resolvedKey)).toBe(true);
      }
    });

    it('EMPIRICAL RESOLVER 3B: IDLE state resolves upper-body aiming sprites across all 4 idle frames', () => {
      for (const item of canonicalAngles) {
        for (let frame = 0; frame < 4; frame++) {
          const p: RenderPlayerState = {
            x: 100,
            y: 100,
            facing: 1,
            state: 'idle',
            animFrame: frame,
            aimAngle: item.angle,
          };

          const resolvedKey = renderer.resolvePlayerSpriteKey(p, 0);

          // FORWARD, UP_FORWARD, UP have composite idle frames; DOWN/DOWN_FORWARD have graceful locomotion fallbacks
          if (item.name === 'FORWARD' || item.name === 'UP_FORWARD' || item.name === 'UP') {
            expect(resolvedKey).toBe(`player_idle_aim_${item.name}_${frame}`);
          } else {
            // DOWN or DOWN_FORWARD falls back to base idle
            expect(resolvedKey).toBe(`player_idle_${frame}`);
          }

          // In every case, resolved key MUST be a valid cached sprite
          expect(factory.hasSprite(resolvedKey)).toBe(true);
        }
      }
    });

    it('EMPIRICAL RESOLVER 3C: RUN state resolves upper-body aiming sprites across all 6 running frames', () => {
      for (const item of canonicalAngles) {
        for (let frame = 0; frame < 6; frame++) {
          const p: RenderPlayerState = {
            x: 100,
            y: 100,
            facing: 1,
            state: 'run',
            animFrame: frame,
            aimAngle: item.angle,
          };

          const resolvedKey = renderer.resolvePlayerSpriteKey(p, 0);

          if (item.name === 'FORWARD' || item.name === 'UP_FORWARD' || item.name === 'UP') {
            expect(resolvedKey).toBe(`player_run_aim_${item.name}_${frame}`);
          } else {
            // DOWN or DOWN_FORWARD falls back to base run
            expect(resolvedKey).toBe(`player_run_${frame}`);
          }

          expect(factory.hasSprite(resolvedKey)).toBe(true);
        }
      }
    });

    it('EMPIRICAL RESOLVER 3D: CROUCH state resolves crouch aiming sprites', () => {
      for (const item of canonicalAngles) {
        const p: RenderPlayerState = {
          x: 100,
          y: 100,
          facing: 1,
          state: 'crouch',
          aimAngle: item.angle,
        };

        const resolvedKey = renderer.resolvePlayerSpriteKey(p, 0);
        console.log(`[Resolver Crouch] Angle: ${item.name} -> Resolved Key: ${resolvedKey}`);

        if (item.name === 'FORWARD') {
          expect(resolvedKey).toBe('player_crouch_aim_FORWARD');
        } else {
          // Other angles gracefully fallback to player_crouch_aim_FORWARD or player_crouch_idle
          expect(resolvedKey === 'player_crouch_aim_FORWARD' || resolvedKey === 'player_crouch_idle').toBe(true);
        }

        expect(factory.hasSprite(resolvedKey)).toBe(true);
      }
    });

    it('EMPIRICAL RESOLVER 3E: Special states (knife, melee, death) resolve dedicated frames without throwing', () => {
      // Death frames 0..3
      for (let d = 0; d < 4; d++) {
        const pDeath: RenderPlayerState = { x: 100, y: 100, facing: 1, state: 'death', animFrame: d };
        const kDeath = renderer.resolvePlayerSpriteKey(pDeath, 0);
        expect(kDeath).toBe(`player_death_${d}`);
        expect(factory.hasSprite(kDeath)).toBe(true);
      }

      // Knife frames 0..2
      for (let k = 0; k < 3; k++) {
        const pKnife: RenderPlayerState = { x: 100, y: 100, facing: 1, state: 'knife', animFrame: k };
        const kKnife = renderer.resolvePlayerSpriteKey(pKnife, 0);
        expect(kKnife).toBe(`player_knife_${k}`);
        expect(factory.hasSprite(kKnife)).toBe(true);
      }

      // Melee boolean flag
      const pMelee: RenderPlayerState = { x: 100, y: 100, facing: 1, state: 'idle', isMelee: true, animFrame: 1 };
      const kMelee = renderer.resolvePlayerSpriteKey(pMelee, 0);
      expect(kMelee).toBe('player_knife_1');
      expect(factory.hasSprite(kMelee)).toBe(true);
    });
  });

  // =========================================================================
  // TASK 4: Screenshot Artifact Integrity (960x540 PNGs)
  // =========================================================================
  describe('Task 4: Screenshot Artifact Integrity (artifacts/screenshots/)', () => {
    const screenshotDir = path.resolve(process.cwd(), 'artifacts/screenshots');
    const expectedFiles = [
      'screenshot_01_idle_crosshair.png',
      'screenshot_02_aim_up_forward.png',
      'screenshot_03_jump_arc.png',
      'screenshot_04_enemy_smooth_spawn.png',
      'screenshot_05_combat_upgraded_sprites.png',
    ];

    it('EMPIRICAL ARTIFACT 4A: All 5 screenshot files exist and have non-zero size (> 10KB)', () => {
      expect(fs.existsSync(screenshotDir)).toBe(true);

      for (const fileName of expectedFiles) {
        const filePath = path.join(screenshotDir, fileName);
        expect(fs.existsSync(filePath), `Missing screenshot: ${fileName}`).toBe(true);

        const stats = fs.statSync(filePath);
        console.log(`[Artifact 4A] ${fileName}: ${stats.size} bytes`);
        expect(stats.size).toBeGreaterThan(10000); // Must be non-trivial image file
      }
    });

    it('EMPIRICAL ARTIFACT 4B: Binary verification of PNG magic bytes, IHDR chunk, and exact 960x540 dimensions', () => {
      // PNG Specification:
      // Bytes 0-7: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ("\x89PNG\r\n\x1a\n")
      // Bytes 8-11: Length of IHDR chunk (always 13 = 0x0000000D)
      // Bytes 12-15: Chunk Type "IHDR" (0x49, 0x48, 0x44, 0x52)
      // Bytes 16-19: Width (Big-Endian UInt32) -> 960 (0x000003C0)
      // Bytes 20-23: Height (Big-Endian UInt32) -> 540 (0x0000021C)
      // Bytes 24: Bit depth (8)
      // Bytes 25: Color type (e.g. 6 = RGBA, 2 = RGB)

      for (const fileName of expectedFiles) {
        const filePath = path.join(screenshotDir, fileName);
        const buf = fs.readFileSync(filePath);

        // 1. Magic bytes
        const magic = buf.subarray(0, 8);
        const expectedMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(magic.equals(expectedMagic), `${fileName} has invalid PNG magic bytes`).toBe(true);

        // 2. IHDR Chunk Marker
        const ihdrMarker = buf.toString('ascii', 12, 16);
        expect(ihdrMarker).toBe('IHDR');

        // 3. Exact Dimensions: 960 x 540
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        console.log(`[Artifact 4B] ${fileName}: Header Resolution = ${width}x${height}`);
        expect(width).toBe(960);
        expect(height).toBe(540);

        // 4. Bit depth & color type
        const bitDepth = buf.readUInt8(24);
        expect(bitDepth).toBe(8);

        // 5. Check for valid IEND trailer chunk at the end of the file
        const iendIndex = buf.lastIndexOf(Buffer.from('IEND'));
        expect(iendIndex).toBeGreaterThan(0);
        expect(iendIndex).toBe(buf.length - 8); // 'IEND' is followed by 4-byte CRC
      }
    });
  });
});
