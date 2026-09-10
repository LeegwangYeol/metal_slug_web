import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DarkFantasySprites, EntitySpriteType } from '../../src/render/sprites/DarkFantasySprites';
import { Player } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { Camera } from '../../src/render/Camera';
import { LootItem } from '../../src/core/systems/LootManager';

describe('DarkFantasySprites Procedural Gothic Sprite Engine (Milestone M2)', () => {
  let mockCtx: any;
  let camera: Camera;

  beforeEach(() => {
    DarkFantasySprites.clearCache();

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };

    camera = new Camera({
      viewportWidth: 960,
      viewportHeight: 540,
    });
  });

  describe('Sprite Key Generation & Uniqueness', () => {
    it('generates distinct keys for all 5 entity types', () => {
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const keys = new Set<string>();

      for (const type of types) {
        const key = DarkFantasySprites.getSpriteKey(type, 0, true, 'normal');
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
      expect(keys.size).toBe(5);
    });

    it('generates distinct keys for frames, facings, and flash states', () => {
      const kNormal = DarkFantasySprites.getSpriteKey('skeleton', 0, true, 'normal');
      const kWhite = DarkFantasySprites.getSpriteKey('skeleton', 0, true, 'white');
      const kCrimson = DarkFantasySprites.getSpriteKey('skeleton', 0, true, 'crimson');
      const kLeft = DarkFantasySprites.getSpriteKey('skeleton', 0, false, 'normal');
      const kFrame1 = DarkFantasySprites.getSpriteKey('skeleton', 1, true, 'normal');

      expect(kNormal).not.toBe(kWhite);
      expect(kNormal).not.toBe(kCrimson);
      expect(kNormal).not.toBe(kLeft);
      expect(kNormal).not.toBe(kFrame1);
    });

    it('wraps frame indices modulo 4', () => {
      const k0 = DarkFantasySprites.getSpriteKey('ghoul', 0, true, 'normal');
      const k4 = DarkFantasySprites.getSpriteKey('ghoul', 4, true, 'normal');
      expect(k0).toBe(k4);
    });
  });

  describe('Player Drawing (Dark Sorcerer)', () => {
    it('draws living player and sets up context transforms', () => {
      const player = new Player(100, 150);
      player.isAlive = true;

      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 0.5);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.translate).toHaveBeenCalledWith(100 - camera.renderX, 150 - camera.renderY);
    });

    it('does not draw dead player', () => {
      const player = new Player(100, 150);
      player.isAlive = false;

      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 0.5);

      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('mirrors context horizontally when facing left', () => {
      const player = new Player(100, 150);
      (player as any).facingDirection = -1; // Facing left

      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 0.5);

      expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
    });
  });

  describe('Enemy Drawing (Undead Swarm)', () => {
    it('draws skeleton, ghoul, banshee, and death knight entities', () => {
      const skeleton = new Enemy(1);
      skeleton.reset('skeleton', 50, 50);
      skeleton.active = true;

      DarkFantasySprites.drawEnemy(mockCtx, skeleton, camera, 0);
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      mockCtx.save.mockClear();
      mockCtx.restore.mockClear();

      const ghoul = new Enemy(2);
      ghoul.reset('ghoul', 80, 80);
      ghoul.active = true;

      DarkFantasySprites.drawEnemy(mockCtx, ghoul, camera, 0);
      expect(mockCtx.save).toHaveBeenCalled();

      mockCtx.save.mockClear();

      const banshee = new Enemy(3);
      banshee.reset('banshee', 120, 120);
      banshee.active = true;

      DarkFantasySprites.drawEnemy(mockCtx, banshee, camera, 0);
      expect(mockCtx.save).toHaveBeenCalled();

      mockCtx.save.mockClear();

      const knight = new Enemy(4);
      knight.reset('death_knight', 200, 200);
      knight.active = true;

      DarkFantasySprites.drawEnemy(mockCtx, knight, camera, 0);
      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('does not draw inactive or dead enemy', () => {
      const enemy = new Enemy(5);
      enemy.active = false;

      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('applies white damage flash when flashTimer > 0.05', () => {
      const enemy = new Enemy(6);
      enemy.reset('skeleton', 60, 60);
      enemy.active = true;
      enemy.flashTimer = 0.09; // > 0.05 -> white flash

      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);
      expect(mockCtx.fillStyle).toBe('#ffffff');
    });
  });

  describe('Loot Drawing (Soul Gems)', () => {
    it('draws living faceted gem with bobbing animation', () => {
      const loot = new LootItem('1');
      loot.reset('1', 'EMERALD_SHARD' as any, 200, 300);

      DarkFantasySprites.drawLoot(mockCtx, loot, camera, 1.0);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.translate).toHaveBeenCalled();
      expect(mockCtx.fillStyle).toBe('#ffffff'); // Specular highlight
    });

    it('does not draw dead loot items', () => {
      const deadLoot = new LootItem('2');
      deadLoot.isAlive = false;

      DarkFantasySprites.drawLoot(mockCtx, deadLoot, camera, 1.0);
      expect(mockCtx.save).not.toHaveBeenCalled();
    });
  });
});
