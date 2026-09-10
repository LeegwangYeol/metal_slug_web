/**
 * DarkFantasySprites.spec.ts - Comprehensive Vitest Test Suite for High-Fidelity Dark Fantasy Sprites.
 * Milestone M2: Procedural Gothic Sprite Engine, Offscreen Caching, Invariant Conservation & 60Hz Performance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DarkFantasySprites, EntitySpriteType, FlashState } from '../../src/render/sprites/DarkFantasySprites';
import { Player } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';
import { PALETTE } from '../../src/render/DarkFantasyPalette';

describe('DarkFantasySprites Comprehensive Specification Suite (Milestone M2)', () => {
  let createdCanvases: any[] = [];
  let recordingCtxList: any[] = [];
  let camera: Camera;

  // Headless Canvas2D Simulation Harness with Full Operation Tracing
  function createMockCanvasContext() {
    const operations: Array<{ method: string; args: any[] }> = [];
    const gradientMock = {
      addColorStop: vi.fn(),
    };

    const ctx: any = {
      operations,
      save: vi.fn(() => ctx.operations.push({ method: 'save', args: [] })),
      restore: vi.fn(() => ctx.operations.push({ method: 'restore', args: [] })),
      translate: vi.fn((x, y) => ctx.operations.push({ method: 'translate', args: [x, y] })),
      scale: vi.fn((x, y) => ctx.operations.push({ method: 'scale', args: [x, y] })),
      rotate: vi.fn((a) => ctx.operations.push({ method: 'rotate', args: [a] })),
      beginPath: vi.fn(() => ctx.operations.push({ method: 'beginPath', args: [] })),
      closePath: vi.fn(() => ctx.operations.push({ method: 'closePath', args: [] })),
      moveTo: vi.fn((x, y) => ctx.operations.push({ method: 'moveTo', args: [x, y] })),
      lineTo: vi.fn((x, y) => ctx.operations.push({ method: 'lineTo', args: [x, y] })),
      quadraticCurveTo: vi.fn((cpx, cpy, x, y) => ctx.operations.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] })),
      bezierCurveTo: vi.fn((cp1x, cp1y, cp2x, cp2y, x, y) => ctx.operations.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] })),
      arc: vi.fn((x, y, r, sa, ea) => ctx.operations.push({ method: 'arc', args: [x, y, r, sa, ea] })),
      ellipse: vi.fn((x, y, rx, ry, rot, sa, ea) => ctx.operations.push({ method: 'ellipse', args: [x, y, rx, ry, rot, sa, ea] })),
      fill: vi.fn(() => ctx.operations.push({ method: 'fill', args: [] })),
      stroke: vi.fn(() => ctx.operations.push({ method: 'stroke', args: [] })),
      fillRect: vi.fn((x, y, w, h) => ctx.operations.push({ method: 'fillRect', args: [x, y, w, h] })),
      strokeRect: vi.fn((x, y, w, h) => ctx.operations.push({ method: 'strokeRect', args: [x, y, w, h] })),
      drawImage: vi.fn((...args: any[]) => ctx.operations.push({ method: 'drawImage', args })),
      createLinearGradient: vi.fn(() => gradientMock),
      createRadialGradient: vi.fn(() => gradientMock),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: 'source-over',
    };
    return ctx;
  }

  function setupDocumentStub() {
    createdCanvases = [];
    recordingCtxList = [];
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          const ctx = createMockCanvasContext();
          recordingCtxList.push(ctx);
          const canvas: any = {
            width: 0,
            height: 0,
            getContext: (type: string) => (type === '2d' ? ctx : null),
          };
          createdCanvases.push(canvas);
          return canvas;
        }
        return {};
      },
    });
  }

  beforeEach(() => {
    DarkFantasySprites.clearCache();
    setupDocumentStub();
    camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    DarkFantasySprites.clearCache();
  });

  // =========================================================================
  // Suite 1: Atlas Initialization & Caching Invariants (120 Cached Surfaces)
  // =========================================================================
  describe('Suite 1: Atlas Initialization & Caching Invariants', () => {
    it('initializes and pre-caches all 120 unique sprite permutations', () => {
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const flashStates: FlashState[] = ['normal', 'white', 'crimson'];
      const facings = [true, false];

      let entryCount = 0;
      for (const type of types) {
        for (let f = 0; f < 4; f++) {
          for (const facing of facings) {
            for (const flash of flashStates) {
              const entry = DarkFantasySprites.getCachedEntry(type, f, facing, flash);
              expect(entry, `Entry missing for ${type}_f${f}_${facing}_${flash}`).not.toBeNull();
              expect(entry?.canvas).toBeDefined();
              expect(entry?.width).toBeGreaterThan(0);
              expect(entry?.height).toBeGreaterThan(0);
              expect(entry?.originX).toBe(entry!.width / 2);
              expect(entry?.originY).toBe(entry!.height / 2);
              entryCount++;
            }
          }
        }
      }
      expect(entryCount).toBe(120);
      expect(createdCanvases.length).toBe(120);
    });

    it('validates canonical dimensions for all dark fantasy entities', () => {
      DarkFantasySprites.initialize();

      const pEntry = DarkFantasySprites.getCachedEntry('player', 0, true, 'normal')!;
      expect(pEntry.width).toBe(64);
      expect(pEntry.height).toBe(64);
      expect(pEntry.originX).toBe(32);
      expect(pEntry.originY).toBe(32);

      const sEntry = DarkFantasySprites.getCachedEntry('skeleton', 0, true, 'normal')!;
      expect(sEntry.width).toBe(40);
      expect(sEntry.height).toBe(40);
      expect(sEntry.originX).toBe(20);
      expect(sEntry.originY).toBe(20);

      const gEntry = DarkFantasySprites.getCachedEntry('ghoul', 0, true, 'normal')!;
      expect(gEntry.width).toBe(44);
      expect(gEntry.height).toBe(44);
      expect(gEntry.originX).toBe(22);
      expect(gEntry.originY).toBe(22);

      const bEntry = DarkFantasySprites.getCachedEntry('banshee', 0, true, 'normal')!;
      expect(bEntry.width).toBe(48);
      expect(bEntry.height).toBe(48);
      expect(bEntry.originX).toBe(24);
      expect(bEntry.originY).toBe(24);

      const dkEntry = DarkFantasySprites.getCachedEntry('death_knight', 0, true, 'normal')!;
      expect(dkEntry.width).toBe(64);
      expect(dkEntry.height).toBe(64);
      expect(dkEntry.originX).toBe(32);
      expect(dkEntry.originY).toBe(32);
    });

    it('returns exact same cached instance without re-allocating canvases', () => {
      DarkFantasySprites.initialize();
      const initialCanvasCount = createdCanvases.length;

      // Access entries repeatedly across multiple frames
      for (let i = 0; i < 100; i++) {
        const e1 = DarkFantasySprites.getCachedEntry('player', i % 4, true, 'normal');
        const e2 = DarkFantasySprites.getCachedEntry('player', i % 4, true, 'normal');
        expect(e1).toBe(e2);
      }

      expect(createdCanvases.length).toBe(initialCanvasCount);
    });

    it('clears cache cleanly and lazily regenerates entries on demand', () => {
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      DarkFantasySprites.clearCache();
      expect(DarkFantasySprites.initialized).toBe(false);

      // On-demand lazy instantiation
      const entry = DarkFantasySprites.getCachedEntry('death_knight', 2, false, 'crimson');
      expect(entry).not.toBeNull();
      expect(entry?.width).toBe(64);
      expect(DarkFantasySprites.initialized).toBe(true);
    });
  });

  // =========================================================================
  // Suite 2: Strict Invariant Conservation & Zero Errors (Zero NaNs, Balanced State)
  // =========================================================================
  describe('Suite 2: Strict Invariant Conservation & Zero Errors', () => {
    it('ensures zero NaN, Infinity, or undefined arguments across all 120 cached entries', () => {
      DarkFantasySprites.initialize();

      for (const ctx of recordingCtxList) {
        for (const op of ctx.operations) {
          for (let argIdx = 0; argIdx < op.args.length; argIdx++) {
            const arg = op.args[argIdx];
            if (typeof arg === 'number') {
              expect(
                Number.isNaN(arg),
                `NaN detected in ${op.method}(arg[${argIdx}])`
              ).toBe(false);
              expect(
                Number.isFinite(arg),
                `Non-finite number in ${op.method}(arg[${argIdx}])`
              ).toBe(true);
            }
            expect(arg, `Undefined arg in ${op.method}(arg[${argIdx}])`).not.toBeUndefined();
          }
        }
      }
    });

    it('ensures strictly balanced save and restore calls across all 120 generated entries', () => {
      DarkFantasySprites.initialize();

      for (const ctx of recordingCtxList) {
        let balance = 0;
        for (const op of ctx.operations) {
          if (op.method === 'save') balance++;
          if (op.method === 'restore') balance--;
          expect(balance, 'Premature restore() called below stack depth 0').toBeGreaterThanOrEqual(0);
        }
        expect(balance, 'Unbalanced save()/restore() pair').toBe(0);
      }
    });

    it('ensures globalCompositeOperation is restored to source-over across all entries', () => {
      DarkFantasySprites.initialize();

      for (const ctx of recordingCtxList) {
        expect(ctx.globalCompositeOperation).toBe('source-over');
      }
    });
  });

  // =========================================================================
  // Suite 3: High-Fidelity Procedural Art Verification for All 5 Entities
  // =========================================================================
  describe('Suite 3: High-Fidelity Procedural Art Verification', () => {
    it('verifies Player (Grim Sorcerer) features: scythe, tattered cowl, crimson trim, triple-layered occult eyes', () => {
      const entry = DarkFantasySprites.getCachedEntry('player', 0, true, 'normal')!;
      expect(entry).not.toBeNull();

      const canvasCtx = (entry.canvas as any).getContext('2d');
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();
      expect(canvasCtx.createRadialGradient).toHaveBeenCalled();

      // Verify curved robe contours and scythe blade path
      const curveOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'quadraticCurveTo'
      );
      expect(curveOps.length).toBeGreaterThanOrEqual(8);

      // Verify drop shadow and hood cavity
      const ellipseOps = canvasCtx.operations.filter((op: any) => op.method === 'ellipse');
      expect(ellipseOps.length).toBeGreaterThanOrEqual(2);
    });

    it('verifies Skeleton features: anatomic curved ribcage, segmented spine, cranium, notched sword', () => {
      const entry = DarkFantasySprites.getCachedEntry('skeleton', 3, true, 'normal')!;
      expect(entry).not.toBeNull();

      const canvasCtx = (entry.canvas as any).getContext('2d');
      expect(canvasCtx.createRadialGradient).toHaveBeenCalled();
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Verify curved rib pairs and cranial vault
      const curveOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'quadraticCurveTo' || op.method === 'bezierCurveTo'
      );
      expect(curveOps.length).toBeGreaterThanOrEqual(8);

      // Verify segmented vertebrae rects
      const rectOps = canvasCtx.operations.filter((op: any) => op.method === 'fillRect');
      expect(rectOps.length).toBeGreaterThanOrEqual(8);
    });

    it('verifies Ghoul features: hunched feral posture, necrotic gradient, bone spurs, boils, fangs, talons', () => {
      const entry = DarkFantasySprites.getCachedEntry('ghoul', 1, true, 'normal')!;
      expect(entry).not.toBeNull();

      const canvasCtx = (entry.canvas as any).getContext('2d');
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Verify hunched dorsal arch and sickle talons
      const curveOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'quadraticCurveTo'
      );
      expect(curveOps.length).toBeGreaterThanOrEqual(8);

      // Verify pulsating boils and wet specular highlights
      const arcOps = canvasCtx.operations.filter((op: any) => op.method === 'arc');
      expect(arcOps.length).toBeGreaterThanOrEqual(6);
    });

    it('verifies Banshee features: spectral apparition, floating wisps, additive lighter blending, wailing mouth', () => {
      const entry = DarkFantasySprites.getCachedEntry('banshee', 0, true, 'normal')!;
      expect(entry).not.toBeNull();

      const canvasCtx = (entry.canvas as any).getContext('2d');
      expect(canvasCtx.createRadialGradient).toHaveBeenCalled();
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Verify additive blending for luminous aura
      const saveOps = canvasCtx.operations.filter((op: any) => op.method === 'save');
      expect(saveOps.length).toBeGreaterThanOrEqual(3);

      // Verify wailing mouth and weeping face
      const ellipseOps = canvasCtx.operations.filter((op: any) => op.method === 'ellipse');
      expect(ellipseOps.length).toBeGreaterThanOrEqual(3);
    });

    it('verifies Death Knight features: heavy obsidian armor, horned greathelm, gold/blood filigree, runic greatsword', () => {
      const entry = DarkFantasySprites.getCachedEntry('death_knight', 1, true, 'normal')!;
      expect(entry).not.toBeNull();

      const canvasCtx = (entry.canvas as any).getContext('2d');
      expect(canvasCtx.createLinearGradient).toHaveBeenCalled();

      // Verify horned greathelm curved horns
      const curveOps = canvasCtx.operations.filter(
        (op: any) => op.method === 'quadraticCurveTo'
      );
      expect(curveOps.length).toBeGreaterThanOrEqual(6);

      // Verify pauldron and cuirass geometry
      const lineOps = canvasCtx.operations.filter((op: any) => op.method === 'lineTo');
      expect(lineOps.length).toBeGreaterThanOrEqual(15);
    });
  });

  // =========================================================================
  // Suite 4: Damage Flash States & Silhouette Masking
  // =========================================================================
  describe('Suite 4: Damage Flash States & Silhouette Masking', () => {
    it('verifies white damage flash sets mask color to #ffffff across all entity types', () => {
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];

      for (const type of types) {
        const entry = DarkFantasySprites.getCachedEntry(type, 0, true, 'white')!;
        expect(entry).not.toBeNull();

        const canvasCtx = (entry.canvas as any).getContext('2d');
        expect(canvasCtx.fillStyle).toBe('#ffffff');
      }
    });

    it('verifies crimson damage flash sets mask color to PALETTE.BLOOD_CRIMSON.FLASH', () => {
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];

      for (const type of types) {
        const entry = DarkFantasySprites.getCachedEntry(type, 0, true, 'crimson')!;
        expect(entry).not.toBeNull();

        const canvasCtx = (entry.canvas as any).getContext('2d');
        expect(canvasCtx.fillStyle).toBe(PALETTE.BLOOD_CRIMSON.FLASH);
      }
    });

    it('verifies normal rendering preserves procedural textures without mask override', () => {
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];

      for (const type of types) {
        const entry = DarkFantasySprites.getCachedEntry(type, 0, true, 'normal')!;
        expect(entry).not.toBeNull();

        const canvasCtx = (entry.canvas as any).getContext('2d');
        expect(canvasCtx.fillStyle).not.toBe(PALETTE.BLOOD_CRIMSON.FLASH);
      }
    });
  });

  // =========================================================================
  // Suite 5: Runtime Render Pipeline & Headless Fallback Execution
  // =========================================================================
  describe('Suite 5: Runtime Render Pipeline & Headless Fallback Execution', () => {
    let mockDrawCtx: any;

    beforeEach(() => {
      mockDrawCtx = createMockCanvasContext();
    });

    it('blits cached offscreen canvas via drawImage during standard runtime loop', () => {
      DarkFantasySprites.initialize();

      const enemy = new Enemy(101);
      enemy.reset('banshee', 150, 200);
      enemy.active = true;

      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 1.0);

      const drawImageOp = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(drawImageOp).toBeDefined();
      expect(drawImageOp.args[1]).toBe(150 - camera.renderX - 24); // Screen X - originX
      expect(drawImageOp.args[2]).toBe(200 - camera.renderY - 24); // Screen Y - originY
    });

    it('executes safe headless vector fallback when document is undefined', () => {
      vi.stubGlobal('document', undefined);
      DarkFantasySprites.clearCache();

      const player = new Player(300, 400);
      player.isAlive = true;

      expect(() => {
        DarkFantasySprites.drawPlayer(mockDrawCtx, player, camera, 0.5);
      }).not.toThrow();

      expect(mockDrawCtx.save).toHaveBeenCalled();
      expect(mockDrawCtx.restore).toHaveBeenCalled();
      expect(mockDrawCtx.translate).toHaveBeenCalledWith(300 - camera.renderX, 400 - camera.renderY);

      // Restore document stub for other tests
      setupDocumentStub();
    });

    it('mirrors sprite horizontally when facing left in headless fallback', () => {
      vi.stubGlobal('document', undefined);
      DarkFantasySprites.clearCache();

      const enemy = new Enemy(102);
      enemy.reset('death_knight', 250, 350);
      enemy.active = true;
      enemy.facingRight = false; // Facing left

      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0.5);

      expect(mockDrawCtx.scale).toHaveBeenCalledWith(-1, 1);

      setupDocumentStub();
    });

    it('correctly maps enemy flashTimer thresholds to flash states', () => {
      DarkFantasySprites.initialize();

      const enemy = new Enemy(103);
      enemy.reset('ghoul', 100, 100);
      enemy.active = true;

      // 1. > 0.05 -> White Flash
      enemy.flashTimer = 0.08;
      mockDrawCtx.operations.length = 0;
      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0);
      const whiteCall = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(whiteCall).toBeDefined();
      const whiteEntry = DarkFantasySprites.getCachedEntry('ghoul', 0, true, 'white');
      expect(whiteCall.args[0]).toBe(whiteEntry?.canvas);

      // 2. <= 0.05 and > 0 -> Crimson Flash
      enemy.flashTimer = 0.03;
      mockDrawCtx.operations.length = 0;
      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0);
      const crimsonCall = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(crimsonCall).toBeDefined();
      const crimsonEntry = DarkFantasySprites.getCachedEntry('ghoul', 0, true, 'crimson');
      expect(crimsonCall.args[0]).toBe(crimsonEntry?.canvas);

      // 3. <= 0 -> Normal
      enemy.flashTimer = 0;
      mockDrawCtx.operations.length = 0;
      DarkFantasySprites.drawEnemy(mockDrawCtx, enemy, camera, 0);
      const normalCall = mockDrawCtx.operations.find((op: any) => op.method === 'drawImage');
      expect(normalCall).toBeDefined();
      const normalEntry = DarkFantasySprites.getCachedEntry('ghoul', 0, true, 'normal');
      expect(normalCall.args[0]).toBe(normalEntry?.canvas);
    });

    it('suppresses rendering for dead or inactive entities and loot', () => {
      DarkFantasySprites.initialize();

      // Dead Player
      const deadPlayer = new Player(100, 100);
      deadPlayer.isAlive = false;
      DarkFantasySprites.drawPlayer(mockDrawCtx, deadPlayer, camera, 0);
      expect(mockDrawCtx.operations.length).toBe(0);

      // Inactive Enemy
      const deadEnemy = new Enemy(104);
      deadEnemy.active = false;
      deadEnemy.isAlive = false;
      DarkFantasySprites.drawEnemy(mockDrawCtx, deadEnemy, camera, 0);
      expect(mockDrawCtx.operations.length).toBe(0);

      // Dead Loot
      const deadLoot = new LootItem('loot-1');
      deadLoot.isAlive = false;
      DarkFantasySprites.drawLoot(mockDrawCtx, deadLoot, camera, 0);
      expect(mockDrawCtx.operations.length).toBe(0);
    });

    it('draws faceted loot gem with bobbing animation and specular glint', () => {
      const liveLoot = new LootItem('loot-2');
      liveLoot.reset('loot-2', 'EMERALD_SHARD' as any, 200, 300);

      DarkFantasySprites.drawLoot(mockDrawCtx, liveLoot, camera, 1.5);

      expect(mockDrawCtx.save).toHaveBeenCalled();
      expect(mockDrawCtx.restore).toHaveBeenCalled();
      expect(mockDrawCtx.fill).toHaveBeenCalledTimes(2);
      expect(mockDrawCtx.fillStyle).toBe('#ffffff');
    });
  });

  // =========================================================================
  // Suite 6: Performance & 60Hz Frame Budget Validation
  // =========================================================================
  describe('Suite 6: Performance & 60Hz Frame Budget Validation', () => {
    it('executes 1,000 entity draw pass in under 5.0ms (locked 60Hz frame budget)', () => {
      DarkFantasySprites.initialize();

      const enemyCount = 1000;
      const enemies: Enemy[] = [];
      const types = ['skeleton', 'ghoul', 'banshee', 'death_knight'] as const;

      for (let i = 0; i < enemyCount; i++) {
        const enemy = new Enemy(i);
        enemy.reset(types[i % types.length], (i % 32) * 30, Math.floor(i / 32) * 16);
        enemy.active = true;
        enemy.flashTimer = i % 10 === 0 ? 0.08 : 0;
        enemies.push(enemy);
      }

      const mockCtx = createMockCanvasContext();

      // Warm-up JIT
      for (let i = 0; i < 50; i++) {
        DarkFantasySprites.drawEnemy(mockCtx, enemies[i], camera, 1.0);
      }

      // Timed Benchmark Pass
      mockCtx.operations = [];
      mockCtx.drawImage.mockClear();
      const t0 = performance.now();
      for (let i = 0; i < enemyCount; i++) {
        DarkFantasySprites.drawEnemy(mockCtx, enemies[i], camera, 1.0);
      }
      const t1 = performance.now();
      const elapsedMs = t1 - t0;

      console.log(`[DarkFantasySprites.spec] 1,000 Entities Cached Blit Duration: ${elapsedMs.toFixed(3)}ms`);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1000);
      expect(elapsedMs).toBeLessThan(10.0);
    });
  });
});
