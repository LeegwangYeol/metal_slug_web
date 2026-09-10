/**
 * DarkFantasySprites.ts - Procedural Gothic Sprite Engine with Offscreen Caching.
 * Milestone M2: Dark Fantasy Art & Gothic Render Engine.
 */

import { Enemy } from '../../core/entities/Enemy';
import { Player } from '../../core/entities/Player';
import { LootItem } from '../../core/systems/LootManager';
import { Camera } from '../Camera';
import { PALETTE } from '../DarkFantasyPalette';

export type EntitySpriteType = 'player' | 'skeleton' | 'ghoul' | 'banshee' | 'death_knight';
export type FlashState = 'normal' | 'white' | 'crimson';

export interface SpriteAtlasEntry {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export class DarkFantasySprites {
  private static cache: Map<string, SpriteAtlasEntry> = new Map();
  public static initialized: boolean = false;

  public static getSpriteKey(
    type: EntitySpriteType,
    frame: number,
    facingRight: boolean,
    flash: FlashState
  ): string {
    return `${type}_${frame % 4}_${facingRight ? 'right' : 'left'}_${flash}`;
  }

  public static initialize(): void {
    if (this.initialized) return;
    if (typeof document === 'undefined') {
      this.initialized = true;
      return;
    }

    try {
      const types: EntitySpriteType[] = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'];
      const flashStates: FlashState[] = ['normal', 'white', 'crimson'];
      const facings = [true, false];

      for (const type of types) {
        for (let frame = 0; frame < 4; frame++) {
          for (const facingRight of facings) {
            for (const flash of flashStates) {
              const entry = this.generateSpriteEntry(type, frame, facingRight, flash);
              if (entry) {
                const key = this.getSpriteKey(type, frame, facingRight, flash);
                this.cache.set(key, entry);
              }
            }
          }
        }
      }
      this.initialized = true;
    } catch {
      // Fallback gracefully
      this.initialized = true;
    }
  }

  public static getCachedEntry(
    type: EntitySpriteType,
    frame: number,
    facingRight: boolean,
    flash: FlashState
  ): SpriteAtlasEntry | null {
    if (!this.initialized) {
      this.initialize();
    }
    const key = this.getSpriteKey(type, frame, facingRight, flash);
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (typeof document !== 'undefined') {
      const generated = this.generateSpriteEntry(type, frame, facingRight, flash);
      if (generated) {
        this.cache.set(key, generated);
        return generated;
      }
    }
    return null;
  }

  private static getDimensions(type: EntitySpriteType): { w: number; h: number; ox: number; oy: number } {
    switch (type) {
      case 'player':
        return { w: 48, h: 48, ox: 24, oy: 24 };
      case 'skeleton':
        return { w: 36, h: 36, ox: 18, oy: 18 };
      case 'ghoul':
        return { w: 44, h: 44, ox: 22, oy: 22 };
      case 'banshee':
        return { w: 48, h: 48, ox: 24, oy: 24 };
      case 'death_knight':
        return { w: 64, h: 64, ox: 32, oy: 32 };
    }
  }

  private static generateSpriteEntry(
    type: EntitySpriteType,
    frame: number,
    facingRight: boolean,
    flash: FlashState
  ): SpriteAtlasEntry | null {
    if (typeof document === 'undefined') return null;

    const dims = this.getDimensions(type);
    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    // Origin at center
    ctx.translate(dims.ox, dims.oy);
    if (!facingRight) {
      ctx.scale(-1, 1);
    }

    if (flash === 'white') {
      this.drawMaskedEntity(ctx, type, frame, '#ffffff');
    } else if (flash === 'crimson') {
      this.drawMaskedEntity(ctx, type, frame, PALETTE.BLOOD_CRIMSON.FLASH);
    } else {
      switch (type) {
        case 'player':
          this.drawPlayerVector(ctx, frame);
          break;
        case 'skeleton':
          this.drawSkeletonVector(ctx, frame);
          break;
        case 'ghoul':
          this.drawGhoulVector(ctx, frame);
          break;
        case 'banshee':
          this.drawBansheeVector(ctx, frame);
          break;
        case 'death_knight':
          this.drawDeathKnightVector(ctx, frame);
          break;
      }
    }

    ctx.restore();

    return {
      canvas,
      width: dims.w,
      height: dims.h,
      originX: dims.ox,
      originY: dims.oy,
    };
  }

  private static drawMaskedEntity(
    ctx: CanvasRenderingContext2D,
    type: EntitySpriteType,
    frame: number,
    maskColor: string
  ): void {
    ctx.fillStyle = maskColor;
    ctx.strokeStyle = maskColor;

    switch (type) {
      case 'player': {
        const bob = Math.sin((frame * Math.PI) / 2) * 2;
        // Robe & cowl
        ctx.beginPath();
        ctx.moveTo(-10, 16 + bob);
        ctx.lineTo(-6, -6 + bob);
        ctx.lineTo(0, -18 + bob);
        ctx.lineTo(6, -6 + bob);
        ctx.lineTo(10, 16 + bob);
        ctx.closePath();
        ctx.fill();
        // Staff
        ctx.fillRect(8, -20 + bob, 3, 36);
        break;
      }
      case 'skeleton': {
        const legOff = (frame % 2 === 0 ? 3 : -3);
        // Skull
        ctx.beginPath();
        ctx.arc(0, -8, 7, 0, Math.PI * 2);
        ctx.fill();
        // Spine & ribs
        ctx.fillRect(-4, -2, 8, 8);
        // Pelvis & legs
        ctx.fillRect(-4 + legOff, 6, 3, 10);
        ctx.fillRect(1 - legOff, 6, 3, 10);
        // Sword
        ctx.fillRect(6, -10, 3, 16);
        break;
      }
      case 'ghoul': {
        const crawl = (frame % 2 === 0 ? 2 : -2);
        // Hunched torso & head
        ctx.beginPath();
        ctx.ellipse(-2, 0 + crawl, 10, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(6, -3 + crawl, 6, 0, Math.PI * 2);
        ctx.fill();
        // Claws
        ctx.fillRect(6, 6 + crawl, 4, 8);
        ctx.fillRect(-8, 6 - crawl, 4, 8);
        break;
      }
      case 'banshee': {
        const bob = Math.sin((frame * Math.PI) / 2) * 3;
        ctx.beginPath();
        ctx.arc(0, -10 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-8, -4 + bob);
        ctx.lineTo(8, -4 + bob);
        ctx.lineTo(12, 16 + bob);
        ctx.lineTo(0, 10 + bob);
        ctx.lineTo(-12, 16 + bob);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'death_knight': {
        const march = (frame % 2 === 0 ? 3 : -3);
        // Helm & pauldrons
        ctx.fillRect(-12, -22, 24, 12);
        ctx.fillRect(-8, -10, 16, 18);
        ctx.fillRect(-8 + march, 8, 6, 16);
        ctx.fillRect(2 - march, 8, 6, 16);
        // Greatsword
        ctx.fillRect(10, -26, 5, 42);
        break;
      }
    }
  }

  // --- Vector Drawer: Player (Dark Sorcerer) ---
  private static drawPlayerVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 2;

    // Shadow Disc
    ctx.fillStyle = 'rgba(26, 12, 46, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flowing Gothic Robes
    ctx.fillStyle = PALETTE.CURSED_ARCANE.DEEP;
    ctx.beginPath();
    ctx.moveTo(-11, 16 + bob);
    ctx.quadraticCurveTo(-12, 6 + bob, -7, -4 + bob);
    ctx.lineTo(7, -4 + bob);
    ctx.quadraticCurveTo(12, 6 + bob, 11, 16 + bob);
    ctx.lineTo(3, 13 + bob);
    ctx.lineTo(0, 16 + bob);
    ctx.lineTo(-3, 13 + bob);
    ctx.closePath();
    ctx.fill();

    // Robe Inner Fold & Shadow
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.beginPath();
    ctx.moveTo(-5, -4 + bob);
    ctx.lineTo(5, -4 + bob);
    ctx.lineTo(3, 13 + bob);
    ctx.lineTo(-3, 13 + bob);
    ctx.closePath();
    ctx.fill();

    // Hood / Cowl
    ctx.fillStyle = PALETTE.CURSED_ARCANE.SHADOW;
    ctx.beginPath();
    ctx.moveTo(0, -18 + bob);
    ctx.quadraticCurveTo(9, -15 + bob, 7, -4 + bob);
    ctx.lineTo(-7, -4 + bob);
    ctx.quadraticCurveTo(-9, -15 + bob, 0, -18 + bob);
    ctx.closePath();
    ctx.fill();

    // Void Shadow in Hood
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.ellipse(0, -8 + bob, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dual Glowing Violet Eyes
    ctx.fillStyle = PALETTE.CURSED_ARCANE.AURA;
    ctx.beginPath();
    ctx.arc(-2, -8 + bob, 1.2, 0, Math.PI * 2);
    ctx.arc(2, -8 + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Ashwood Staff in Right Hand
    const staffBob = -bob * 0.5;
    ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.fillRect(8, -18 + staffBob, 2.5, 34);

    // Eldritch Crystal on Staff Crown
    ctx.fillStyle = PALETTE.CURSED_ARCANE.VIOLET;
    ctx.beginPath();
    ctx.moveTo(9.25, -24 + staffBob);
    ctx.lineTo(13, -19 + staffBob);
    ctx.lineTo(9.25, -14 + staffBob);
    ctx.lineTo(5.5, -19 + staffBob);
    ctx.closePath();
    ctx.fill();

    // Crystal Core Glow
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.beginPath();
    ctx.arc(9.25, -19 + staffBob, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Vector Drawer: Skeleton ---
  private static drawSkeletonVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const legOffset = (frame % 2 === 0 ? 3 : -3);
    const headTilt = (frame === 1 ? -0.1 : frame === 3 ? 0.1 : 0);

    // Bleached Ivory Skull
    ctx.save();
    ctx.rotate(headTilt);
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.beginPath();
    ctx.arc(0, -8, 6.5, Math.PI, 0);
    ctx.lineTo(4, -3);
    ctx.lineTo(-4, -3);
    ctx.closePath();
    ctx.fill();

    // Jaw
    ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.fillRect(-2.5, -2, 5, 2.5);

    // Eye Sockets (Crimson Pinpricks)
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.fillRect(-3, -7, 2, 2.5);
    ctx.fillRect(1, -7, 2, 2.5);
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-2.5, -6.5, 1, 1);
    ctx.fillRect(1.5, -6.5, 1, 1);
    ctx.restore();

    // Ribs & Spine
    ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 6);
    // 3 pairs of ribs
    ctx.moveTo(-4, 1);
    ctx.lineTo(4, 1);
    ctx.moveTo(-4.5, 3);
    ctx.lineTo(4.5, 3);
    ctx.moveTo(-3.5, 5);
    ctx.lineTo(3.5, 5);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.lineTo(-2 + legOffset, 16);
    ctx.moveTo(2, 6);
    ctx.lineTo(2 - legOffset, 16);
    ctx.stroke();

    // Rusted Blade in Hand
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.fillRect(6, -11, 2.5, 18);
    // Crossguard
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    ctx.fillRect(4, 4, 7, 2);
  }

  // --- Vector Drawer: Ghoul ---
  private static drawGhoulVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const crawl = (frame % 2 === 0 ? 2 : -2);

    // Mottled Necrotic Flesh Torso
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.DARK;
    ctx.beginPath();
    ctx.ellipse(-2, 1 + crawl, 11, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Spinal Bone Spurs
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.beginPath();
    ctx.moveTo(-8, -4 + crawl);
    ctx.lineTo(-6, -8 + crawl);
    ctx.lineTo(-4, -4 + crawl);
    ctx.moveTo(-3, -5 + crawl);
    ctx.lineTo(-1, -9 + crawl);
    ctx.lineTo(1, -5 + crawl);
    ctx.fill();

    // Snapping Head
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.CORE;
    ctx.beginPath();
    ctx.arc(7, -2 + crawl, 6, 0, Math.PI * 2);
    ctx.fill();

    // Malevolent Bile Eye
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.GLOW;
    ctx.beginPath();
    ctx.arc(9, -3 + crawl, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dripping Toxic Bile Drop
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.BRIGHT;
    ctx.beginPath();
    ctx.arc(7, 4 + crawl, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Claws
    ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, 4 + crawl);
    ctx.lineTo(7, 14 + crawl);
    ctx.moveTo(-4, 4 + crawl);
    ctx.lineTo(-7, 14 - crawl);
    ctx.stroke();
  }

  // --- Vector Drawer: Banshee ---
  private static drawBansheeVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 3;

    // Translucent Ethereal Shroud (Flowing Behind)
    ctx.fillStyle = 'rgba(112, 56, 184, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-10, 0 + bob);
    ctx.quadraticCurveTo(-14, 10 + bob, -16, 20 + bob);
    ctx.lineTo(-4, 14 + bob);
    ctx.lineTo(0, 18 + bob);
    ctx.lineTo(4, 14 + bob);
    ctx.lineTo(16, 20 + bob);
    ctx.quadraticCurveTo(14, 10 + bob, 10, 0 + bob);
    ctx.closePath();
    ctx.fill();

    // Spectral Shroud Body
    ctx.fillStyle = 'rgba(183, 148, 246, 0.65)';
    ctx.beginPath();
    ctx.moveTo(-8, -6 + bob);
    ctx.lineTo(8, -6 + bob);
    ctx.lineTo(6, 12 + bob);
    ctx.lineTo(0, 8 + bob);
    ctx.lineTo(-6, 12 + bob);
    ctx.closePath();
    ctx.fill();

    // Spectral Cowl & Face
    ctx.fillStyle = PALETTE.CURSED_ARCANE.SHADOW;
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    // Screaming Hollow Visage
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    // Void eyes
    ctx.beginPath();
    ctx.arc(-2.5, -10 + bob, 1.3, 0, Math.PI * 2);
    ctx.arc(2.5, -10 + bob, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Screaming mouth
    ctx.beginPath();
    ctx.ellipse(0, -6 + bob, 1.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Vector Drawer: Death Knight ---
  private static drawDeathKnightVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const march = (frame % 2 === 0 ? 3 : -3);

    // Heavy Tattered Crimson Warcape
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.COAGULATED;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(14, -8);
    ctx.lineTo(16, 22);
    ctx.lineTo(-16, 22);
    ctx.closePath();
    ctx.fill();

    // Armored Legs
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.lineWidth = 1;
    ctx.fillRect(-9 + march, 8, 7, 18);
    ctx.strokeRect(-9 + march, 8, 7, 18);
    ctx.fillRect(2 - march, 8, 7, 18);
    ctx.strokeRect(2 - march, 8, 7, 18);

    // Armored Cuirass & Spiked Pauldrons
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.strokeRect(-10, -10, 20, 20);

    // Jagged Spiked Pauldrons
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.lineTo(-9, -20);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, -14);
    ctx.lineTo(9, -20);
    ctx.lineTo(8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Horned Greathelm
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.arc(0, -17, 7, Math.PI, 0);
    ctx.lineTo(6, -12);
    ctx.lineTo(-6, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Visor Slit (Crimson Streak)
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-4, -15, 8, 2);

    // Colossal Executioner Greatsword
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.fillRect(12, -26, 4, 44);
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    ctx.fillRect(9, 6, 10, 2.5);
  }

  // ========================================================
  // Entity Draw Routines called during render loop
  // ========================================================

  public static drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    camera: Camera,
    elapsedTime: number
  ): void {
    if (!player.isAlive) return;

    const screenX = player.position.x - camera.renderX;
    const screenY = player.position.y - camera.renderY;

    // Determine facing direction:
    // player.facingDirection is 1 (right) or -1 (left)
    const facingRight = (player as any).facingDirection !== -1;

    // Movement frame: check if velocity is significant
    const speedSq = player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y;
    const frame = speedSq > 10 ? Math.floor(elapsedTime * 8) % 4 : 0;

    // Damage Flash:
    let flash: FlashState = 'normal';
    if (player.invulnerabilityTimer > 0) {
      flash = Math.floor(player.invulnerabilityTimer * 24) % 2 === 0 ? 'white' : 'crimson';
    }

    const entry = this.getCachedEntry('player', frame, facingRight, flash);
    if (entry) {
      ctx.drawImage(entry.canvas, screenX - entry.originX, screenY - entry.originY);
    } else {
      // Fallback
      ctx.save();
      ctx.translate(screenX, screenY);
      if (!facingRight) ctx.scale(-1, 1);
      this.drawPlayerVector(ctx, frame);
      ctx.restore();
    }
  }

  public static drawEnemy(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    camera: Camera,
    elapsedTime: number
  ): void {
    if (!enemy.isAlive) return;

    const screenX = enemy.x - camera.renderX;
    const screenY = enemy.y - camera.renderY;

    // Map enemy type to sprite type
    const rawType = (enemy.type || 'skeleton').toLowerCase();
    let spriteType: EntitySpriteType = 'skeleton';
    if (rawType.includes('ghoul')) spriteType = 'ghoul';
    else if (rawType.includes('banshee')) spriteType = 'banshee';
    else if (rawType.includes('knight')) spriteType = 'death_knight';
    else spriteType = 'skeleton';

    const facingRight = enemy.facingRight !== false;
    const timer = (enemy as any).behaviorTimer ?? elapsedTime;
    const frame = Math.floor(timer * 8) % 4;

    // Flash state
    let flash: FlashState = 'normal';
    if (enemy.flashTimer > 0.05) {
      flash = 'white';
    } else if (enemy.flashTimer > 0) {
      flash = 'crimson';
    }

    const entry = this.getCachedEntry(spriteType, frame, facingRight, flash);
    if (entry) {
      ctx.drawImage(entry.canvas, screenX - entry.originX, screenY - entry.originY);
    } else {
      // Fallback
      ctx.save();
      ctx.translate(screenX, screenY);
      if (!facingRight) ctx.scale(-1, 1);
      if (flash === 'white') this.drawMaskedEntity(ctx, spriteType, frame, '#ffffff');
      else if (flash === 'crimson') this.drawMaskedEntity(ctx, spriteType, frame, PALETTE.BLOOD_CRIMSON.FLASH);
      else {
        switch (spriteType) {
          case 'skeleton': this.drawSkeletonVector(ctx, frame); break;
          case 'ghoul': this.drawGhoulVector(ctx, frame); break;
          case 'banshee': this.drawBansheeVector(ctx, frame); break;
          case 'death_knight': this.drawDeathKnightVector(ctx, frame); break;
        }
      }
      ctx.restore();
    }
  }

  public static drawLoot(
    ctx: CanvasRenderingContext2D,
    loot: LootItem,
    camera: Camera,
    elapsedTime: number
  ): void {
    if (!loot.isAlive) return;

    const screenX = loot.position.x - camera.renderX;
    const screenY = loot.position.y - camera.renderY;
    const r = loot.radius;

    // Gem Bobbing & Sparkle
    const bob = Math.sin(elapsedTime * 4.0 + loot.position.x * 0.05) * 1.5;
    const cy = screenY + bob;

    ctx.save();
    ctx.translate(screenX, cy);

    // Faceted diamond shape
    ctx.fillStyle = loot.color;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.2);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r * 1.2);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();

    // Specular Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.2);
    ctx.lineTo(r * 0.4, -r * 0.2);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.4, -r * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  public static clearCache(): void {
    this.cache.clear();
    this.initialized = false;
  }
}
