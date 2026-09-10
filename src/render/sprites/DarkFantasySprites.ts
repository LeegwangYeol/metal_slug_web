/**
 * DarkFantasySprites.ts - High-Fidelity Procedural Gothic Sprite Engine with Offscreen Caching.
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
        return { w: 64, h: 64, ox: 32, oy: 32 };
      case 'skeleton':
        return { w: 40, h: 40, ox: 20, oy: 20 };
      case 'ghoul':
        return { w: 44, h: 44, ox: 22, oy: 22 };
      case 'banshee':
        return { w: 48, h: 48, ox: 24, oy: 24 };
      case 'death_knight':
        return { w: 64, h: 64, ox: 32, oy: 32 };
    }
  }

  private static safeLinearGradient(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: Array<[number, string]>,
    fallbackColor: string
  ): void {
    if (typeof ctx.createLinearGradient === 'function') {
      try {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        if (grad && typeof grad.addColorStop === 'function') {
          for (const [offset, color] of stops) {
            grad.addColorStop(offset, color);
          }
          ctx.fillStyle = grad;
          return;
        }
      } catch {
        // Fallback
      }
    }
    ctx.fillStyle = fallbackColor;
  }

  private static safeRadialGradient(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
    stops: Array<[number, string]>,
    fallbackColor: string
  ): void {
    if (typeof ctx.createRadialGradient === 'function') {
      try {
        const grad = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        if (grad && typeof grad.addColorStop === 'function') {
          for (const [offset, color] of stops) {
            grad.addColorStop(offset, color);
          }
          ctx.fillStyle = grad;
          return;
        }
      } catch {
        // Fallback
      }
    }
    ctx.fillStyle = fallbackColor;
  }

  private static safeBezierCurveTo(
    ctx: CanvasRenderingContext2D,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): void {
    if (typeof ctx.bezierCurveTo === 'function') {
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    } else if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.quadraticCurveTo((cp1x + cp2x) / 2, (cp1y + cp2y) / 2, x, y);
    } else {
      ctx.lineTo(x, y);
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
        const bob = Math.sin((frame * Math.PI) / 2) * 1.8;
        const scytheAngle = 0.12 + Math.sin((frame * Math.PI) / 2) * 0.05;
        // Cowl and tattered robe silhouette
        ctx.beginPath();
        ctx.moveTo(0, -22 + bob);
        ctx.lineTo(9, -6 + bob);
        ctx.lineTo(12, 17 + bob);
        ctx.lineTo(6, 20 + bob);
        ctx.lineTo(-6, 20 + bob);
        ctx.lineTo(-14, 19 + bob);
        ctx.lineTo(-9, -6 + bob);
        ctx.closePath();
        ctx.fill();
        // Scythe haft and blade silhouette
        ctx.save();
        ctx.rotate(scytheAngle);
        ctx.fillRect(8, -26 + bob, 3, 48);
        ctx.beginPath();
        ctx.moveTo(9, -27 + bob);
        ctx.quadraticCurveTo(18, -32 + bob, 26, -22 + bob);
        ctx.quadraticCurveTo(30, -14 + bob, 25, -2 + bob);
        ctx.quadraticCurveTo(24, -12 + bob, 18, -18 + bob);
        ctx.quadraticCurveTo(12, -22 + bob, 9, -25 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'skeleton': {
        const legOffset = (frame % 2 === 0 ? 2.5 : -2.5);
        const bodyBob = (frame === 1 ? 0.8 : frame === 3 ? -0.6 : 0);
        // Cranium
        ctx.beginPath();
        ctx.arc(0, -9 + bodyBob, 6.0, 0, Math.PI * 2);
        ctx.fill();
        // Ribcage & Spine
        ctx.fillRect(-5.0, 0.5 + bodyBob, 10.0, 7.0);
        // Pelvis & Legs
        ctx.fillRect(-4.5, 7.5 + bodyBob, 9.0, 2.5);
        ctx.fillRect(-3.0 - legOffset, 10 + bodyBob, 2.2, 7.0);
        ctx.fillRect(1.5 + legOffset, 10 + bodyBob, 2.2, 7.0);
        // Notched Sword
        ctx.fillRect(5.8, -14.0 + bodyBob, 2.6, 17.0);
        ctx.fillRect(3.2, 2.8 + bodyBob, 7.5, 2.0);
        break;
      }
      case 'ghoul': {
        const crawl = (frame % 2 === 0 ? 1.8 : -1.8);
        const lunge = (frame === 1 ? 1.2 : frame === 3 ? -0.8 : 0);
        // Hunched Torso & Haunches
        ctx.beginPath();
        ctx.ellipse(-2, 1 + crawl, 12.0, 7.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(8.5 + lunge, -1.8 + crawl, 6.2, 4.5, 0.22, 0, Math.PI * 2);
        ctx.fill();
        // Claws & Limbs
        ctx.fillRect(6.0 + lunge, 8.0 + crawl, 6.0, 8.0);
        ctx.fillRect(-11.0, 8.0 - crawl, 4.0, 8.0);
        break;
      }
      case 'banshee': {
        const bob = Math.sin((frame * Math.PI) / 2) * 2.5;
        // Head & veil dome
        ctx.beginPath();
        ctx.arc(0, -9 + bob, 7.5, 0, Math.PI * 2);
        ctx.fill();
        // Torso & wisps
        ctx.beginPath();
        ctx.moveTo(-8, -4 + bob);
        ctx.lineTo(8, -4 + bob);
        ctx.lineTo(16, 20 + bob * 0.5);
        ctx.lineTo(2, 21 + bob);
        ctx.lineTo(-16, 20 + bob * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'death_knight': {
        const stompDrop = ((frame % 4) === 1 || (frame % 4) === 3) ? 1 : 0;
        const legStride = Math.sin((frame * Math.PI) / 2) * 5;
        // Helm & horns
        ctx.beginPath();
        ctx.arc(0, -17 + stompDrop, 7, 0, Math.PI * 2);
        ctx.moveTo(-16, -30 + stompDrop);
        ctx.lineTo(-5, -20 + stompDrop);
        ctx.lineTo(5, -20 + stompDrop);
        ctx.lineTo(16, -30 + stompDrop);
        ctx.fill();
        // Cuirass & Pauldrons
        ctx.fillRect(-17, -16 + stompDrop, 34, 24);
        // Legs
        ctx.fillRect(-11 + legStride, 8 + stompDrop, 8, 16);
        ctx.fillRect(2 - legStride, 8 + stompDrop, 8, 16);
        // Greatsword
        ctx.fillRect(12, -28 + stompDrop, 6, 64);
        break;
      }
    }
  }

  // --- Vector Drawer: Player (Grim Sorcerer) ---
  private static drawPlayerVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 1.8;
    const sway = Math.cos((frame * Math.PI) / 2) * 1.2;

    // 1. Soft Contact Drop Shadow (Grounded Depth)
    this.safeRadialGradient(
      ctx,
      0, 22, 2, 0, 22, 16,
      [
        [0, 'rgba(8, 6, 12, 0.65)'],
        [0.6, 'rgba(26, 12, 46, 0.35)'],
        [1, 'rgba(8, 6, 12, 0.0)'],
      ],
      'rgba(8, 6, 12, 0.5)'
    );
    ctx.beginPath();
    ctx.ellipse(0, 22, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Scythe Haft (Weathered Calcified Bone)
    ctx.save();
    const scytheAngle = 0.12 + Math.sin((frame * Math.PI) / 2) * 0.05;
    ctx.rotate(scytheAngle);

    this.safeLinearGradient(
      ctx,
      12, -26 + bob, -10, 22 + bob,
      [
        [0, PALETTE.BONE_IVORY.POLISHED],
        [0.3, PALETTE.BONE_IVORY.BLEACHED],
        [0.7, PALETTE.BONE_IVORY.WEATHERED],
        [1, PALETTE.BONE_IVORY.SHADOW],
      ],
      PALETTE.BONE_IVORY.BLEACHED
    );
    ctx.fillRect(8, -26 + bob, 3, 48);

    // Dark Leather Grip Wrappings
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    for (let wy = -4; wy <= 12; wy += 5) {
      ctx.fillRect(7.5, wy + bob, 4, 2);
    }

    // Ribbed Bone Pommel Spur
    ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.beginPath();
    ctx.moveTo(8, 22 + bob);
    ctx.lineTo(9.5, 26 + bob);
    ctx.lineTo(11, 22 + bob);
    ctx.closePath();
    ctx.fill();

    // 3. Ethereal Bone Scythe Blade
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.fillRect(7, -27 + bob, 5, 4); // Clasp

    this.safeLinearGradient(
      ctx,
      10, -28 + bob, 28, -8 + bob,
      [
        [0, PALETTE.BONE_IVORY.POLISHED],
        [0.4, PALETTE.BONE_IVORY.BLEACHED],
        [0.8, PALETTE.CURSED_ARCANE.AURA],
        [1, PALETTE.CURSED_ARCANE.VIOLET],
      ],
      PALETTE.CURSED_ARCANE.AURA
    );

    ctx.beginPath();
    ctx.moveTo(9, -27 + bob);
    ctx.quadraticCurveTo(18, -32 + bob, 26, -22 + bob);
    ctx.quadraticCurveTo(30, -14 + bob, 25, -2 + bob); // Tip
    ctx.quadraticCurveTo(24, -12 + bob, 18, -18 + bob);
    ctx.quadraticCurveTo(12, -22 + bob, 9, -25 + bob);
    ctx.closePath();
    ctx.fill();

    // Runic Blade Inscription
    ctx.strokeStyle = PALETTE.CURSED_ARCANE.AURA;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(13, -27 + bob);
    ctx.lineTo(17, -25 + bob);
    ctx.lineTo(21, -20 + bob);
    ctx.stroke();

    // Specular Razor Cutting Edge
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11, -24 + bob);
    ctx.quadraticCurveTo(14, -20 + bob, 19, -16 + bob);
    ctx.quadraticCurveTo(24, -10 + bob, 25, -2 + bob);
    ctx.stroke();

    // Tip Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(25, -2 + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. Inner Dark Tunic / Shadow Underlay
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.moveTo(-6, 2 + bob);
    ctx.lineTo(6, 2 + bob);
    ctx.lineTo(8, 20 + bob);
    ctx.lineTo(-8, 20 + bob);
    ctx.closePath();
    ctx.fill();

    // 5. Outer Gothic Robe with Frayed Tattered Hem
    this.safeLinearGradient(
      ctx,
      -14, -8 + bob, 14, 22 + bob,
      [
        [0, PALETTE.CURSED_ARCANE.SHADOW],
        [0.5, PALETTE.CURSED_ARCANE.DEEP],
        [1, PALETTE.ABYSSAL_VOID.SLATE],
      ],
      PALETTE.CURSED_ARCANE.DEEP
    );

    ctx.beginPath();
    ctx.moveTo(-9, -6 + bob);
    ctx.quadraticCurveTo(-13, 6 + bob, -14 + sway, 19 + bob);
    ctx.lineTo(-10 + sway, 16 + bob);
    ctx.lineTo(-6, 20 + bob);
    ctx.lineTo(-2 - sway, 16 + bob);
    ctx.lineTo(2, 20 + bob);
    ctx.lineTo(6 + sway, 16 + bob);
    ctx.lineTo(10 - sway, 20 + bob);
    ctx.lineTo(12, 17 + bob);
    ctx.quadraticCurveTo(12, 6 + bob, 9, -6 + bob);
    ctx.closePath();
    ctx.fill();

    // Drapery Pleats
    ctx.strokeStyle = PALETTE.ABYSSAL_VOID.MID;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -4 + bob);
    ctx.quadraticCurveTo(-5, 8 + bob, -6, 19 + bob);
    ctx.moveTo(3, -4 + bob);
    ctx.quadraticCurveTo(4, 8 + bob, 4, 19 + bob);
    ctx.stroke();

    // 6. Dark Crimson Borders & Embroidered Trim
    ctx.strokeStyle = PALETTE.BLOOD_CRIMSON.VIVID;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-14 + sway, 19 + bob);
    ctx.lineTo(-10 + sway, 16 + bob);
    ctx.lineTo(-6, 20 + bob);
    ctx.lineTo(-2 - sway, 16 + bob);
    ctx.lineTo(2, 20 + bob);
    ctx.lineTo(6 + sway, 16 + bob);
    ctx.lineTo(10 - sway, 20 + bob);
    ctx.stroke();

    // Front Mantle Lapels
    ctx.strokeStyle = PALETTE.BLOOD_CRIMSON.COAGULATED;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -6 + bob);
    ctx.lineTo(-2, 14 + bob);
    ctx.moveTo(2, -6 + bob);
    ctx.lineTo(2, 14 + bob);
    ctx.stroke();

    // 7. Peaked Cowl & Deep Hood
    this.safeLinearGradient(
      ctx,
      0, -22 + bob, 0, -4 + bob,
      [
        [0, PALETTE.CURSED_ARCANE.VIOLET],
        [0.3, PALETTE.CURSED_ARCANE.SHADOW],
        [1, PALETTE.CURSED_ARCANE.DEEP],
      ],
      PALETTE.CURSED_ARCANE.SHADOW
    );

    ctx.beginPath();
    ctx.moveTo(0, -22 + bob);
    ctx.quadraticCurveTo(11, -19 + bob, 9, -6 + bob);
    ctx.lineTo(4, -3 + bob);
    ctx.lineTo(-4, -3 + bob);
    ctx.lineTo(-9, -6 + bob);
    ctx.quadraticCurveTo(-11, -19 + bob, 0, -22 + bob);
    ctx.closePath();
    ctx.fill();

    // Cowl Crimson Trim
    ctx.strokeStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-9, -6 + bob);
    ctx.quadraticCurveTo(-11, -19 + bob, 0, -22 + bob);
    ctx.quadraticCurveTo(11, -19 + bob, 9, -6 + bob);
    ctx.stroke();

    // 8. Void Hood Recess
    ctx.fillStyle = '#040306';
    ctx.beginPath();
    ctx.ellipse(0, -11 + bob, 5.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 9. Triple-Layered Occult Eyes & Pinpoints
    this.safeRadialGradient(
      ctx,
      -2.5, -11 + bob, 0.5, -2.5, -11 + bob, 4.0,
      [
        [0, 'rgba(183, 148, 246, 0.7)'],
        [0.5, 'rgba(112, 56, 184, 0.3)'],
        [1, 'rgba(112, 56, 184, 0.0)'],
      ],
      'rgba(183, 148, 246, 0.4)'
    );
    ctx.beginPath();
    ctx.arc(-2.5, -11 + bob, 4.0, 0, Math.PI * 2);
    ctx.fill();

    this.safeRadialGradient(
      ctx,
      2.5, -11 + bob, 0.5, 2.5, -11 + bob, 4.0,
      [
        [0, 'rgba(183, 148, 246, 0.7)'],
        [0.5, 'rgba(112, 56, 184, 0.3)'],
        [1, 'rgba(112, 56, 184, 0.0)'],
      ],
      'rgba(183, 148, 246, 0.4)'
    );
    ctx.beginPath();
    ctx.arc(2.5, -11 + bob, 4.0, 0, Math.PI * 2);
    ctx.fill();

    // Arcane Iris Sockets
    ctx.fillStyle = PALETTE.CURSED_ARCANE.AURA;
    ctx.beginPath();
    ctx.arc(-2.5, -11 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(2.5, -11 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Piercing White Pupil Pinpoints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2.2, -11 + bob, 0.7, 0, Math.PI * 2);
    ctx.arc(2.8, -11 + bob, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Vector Drawer: Skeleton (The Cursed Legionnaire) ---
  private static drawSkeletonVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const legOffset = (frame % 2 === 0 ? 2.5 : -2.5);
    const headTilt = (frame === 1 ? -0.08 : frame === 3 ? 0.06 : 0);
    const bodyBob = (frame === 1 ? 0.8 : frame === 3 ? -0.6 : 0);
    const jawDrop = (frame === 3 ? 1.0 : 0);

    // Layer 1: Ground Contact Drop Shadow
    ctx.beginPath();
    ctx.ellipse(0, 16, 9.5, 3.0, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 6, 12, 0.45)';
    ctx.fill();

    // Layer 2: Distal (Far) Leg
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2.5, 10 + bodyBob);
    ctx.lineTo(-2.5 - legOffset * 0.6, 13.5 + bodyBob);
    ctx.lineTo(-2.5 - legOffset, 16);
    ctx.stroke();
    // Distal Foot
    ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.fillRect(-3.5 - legOffset, 15.5, 3.0, 1.2);

    // Layer 3: Spine & Thoracic Cavity Shadow
    ctx.fillStyle = 'rgba(23, 19, 38, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 3 + bodyBob, 4.5, 4.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Segmented Vertebrae Column (T1 - L4)
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    for (let i = 0; i < 4; i++) {
      const vy = 0.5 + i * 1.8 + bodyBob;
      ctx.fillRect(-1.5, vy, 3.0, 1.2);
    }

    // Layer 4: Anatomic Curved Ribcage
    ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.lineWidth = 1.2;
    // Rib Pair 1
    ctx.beginPath();
    ctx.moveTo(0, 0.5 + bodyBob);
    ctx.quadraticCurveTo(-5.0, 0.5 + bodyBob, -4.0, 2.2 + bodyBob);
    ctx.moveTo(0, 0.5 + bodyBob);
    ctx.quadraticCurveTo(5.0, 0.5 + bodyBob, 4.0, 2.2 + bodyBob);
    ctx.stroke();
    // Rib Pair 2
    ctx.beginPath();
    ctx.moveTo(0, 2.3 + bodyBob);
    ctx.quadraticCurveTo(-6.0, 2.3 + bodyBob, -4.8, 4.2 + bodyBob);
    ctx.moveTo(0, 2.3 + bodyBob);
    ctx.quadraticCurveTo(6.0, 2.3 + bodyBob, 4.8, 4.2 + bodyBob);
    ctx.stroke();
    // Rib Pair 3
    ctx.beginPath();
    ctx.moveTo(0, 4.1 + bodyBob);
    ctx.quadraticCurveTo(-5.2, 4.1 + bodyBob, -4.2, 6.0 + bodyBob);
    ctx.moveTo(0, 4.1 + bodyBob);
    ctx.quadraticCurveTo(5.2, 4.1 + bodyBob, 4.2, 6.0 + bodyBob);
    ctx.stroke();
    // Rib Pair 4
    ctx.beginPath();
    ctx.moveTo(0, 5.9 + bodyBob);
    ctx.quadraticCurveTo(-3.8, 5.9 + bodyBob, -2.8, 7.2 + bodyBob);
    ctx.moveTo(0, 5.9 + bodyBob);
    ctx.quadraticCurveTo(3.8, 5.9 + bodyBob, 2.8, 7.2 + bodyBob);
    ctx.stroke();

    // Sternum Plate
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.fillRect(-0.7, 0.2 + bodyBob, 1.4, 4.5);

    // Layer 5: Pelvic Girdle
    ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.beginPath();
    ctx.moveTo(-0.8, 7.5 + bodyBob);
    ctx.quadraticCurveTo(-4.8, 7.0 + bodyBob, -4.2, 10.2 + bodyBob);
    ctx.lineTo(-0.8, 9.8 + bodyBob);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.8, 7.5 + bodyBob);
    ctx.quadraticCurveTo(4.8, 7.0 + bodyBob, 4.2, 10.2 + bodyBob);
    ctx.lineTo(0.8, 9.8 + bodyBob);
    ctx.closePath();
    ctx.fill();
    // Sacrum Core
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.fillRect(-1.0, 8.0 + bodyBob, 2.0, 2.8);

    // Layer 6: Proximal (Near) Leg
    ctx.strokeStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(2.2, 10 + bodyBob);
    ctx.lineTo(2.2 + legOffset * 0.6, 13.5 + bodyBob);
    ctx.lineTo(2.2 + legOffset, 16);
    ctx.stroke();
    // Patella (Kneecap)
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.beginPath();
    ctx.arc(2.2 + legOffset * 0.6, 13.5 + bodyBob, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // Near Foot
    ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.fillRect(1.5 + legOffset, 15.5, 3.8, 1.3);

    // Layer 7: Cranium & Facial Filigree
    ctx.save();
    ctx.translate(0, -9 + bodyBob);
    ctx.rotate(headTilt);

    // Calvaria Bone Shading
    this.safeRadialGradient(
      ctx,
      -1, -3, 1, 0, -1, 7.5,
      [
        [0.0, PALETTE.BONE_IVORY.POLISHED],
        [0.55, PALETTE.BONE_IVORY.BLEACHED],
        [1.0, PALETTE.BONE_IVORY.WEATHERED],
      ],
      PALETTE.BONE_IVORY.POLISHED
    );

    // Cranial Vault Contour
    ctx.beginPath();
    ctx.moveTo(-5.2, 1.5);
    this.safeBezierCurveTo(ctx, -6.5, -4.5, -4.0, -7.8, 0, -7.8);
    this.safeBezierCurveTo(ctx, 4.0, -7.8, 6.5, -4.5, 5.2, 1.5);
    this.safeBezierCurveTo(ctx, 3.8, 3.5, 2.0, 4.0, 0, 4.0);
    this.safeBezierCurveTo(ctx, -2.0, 4.0, -3.8, 3.5, -5.2, 1.5);
    ctx.closePath();
    ctx.fill();

    // Zygomatic Cheekbone Ridges
    ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.8, 1.0);
    ctx.lineTo(-2.2, 2.2);
    ctx.moveTo(4.8, 1.0);
    ctx.lineTo(2.2, 2.2);
    ctx.stroke();

    // Nasal Cavity Void
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.moveTo(0, 0.8);
    ctx.lineTo(-0.8, 2.2);
    ctx.lineTo(0.8, 2.2);
    ctx.closePath();
    ctx.fill();

    // Deep Orbital Cavities
    ctx.beginPath();
    ctx.ellipse(-2.3, -1.2, 1.8, 2.2, -0.1, 0, Math.PI * 2);
    ctx.ellipse(2.3, -1.2, 1.8, 2.2, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Occult Crimson Pinpoints & Corona
    ctx.fillStyle = 'rgba(229, 62, 62, 0.35)';
    ctx.beginPath();
    ctx.arc(-2.2, -1.0, 1.4, 0, Math.PI * 2);
    ctx.arc(2.2, -1.0, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-2.7, -1.5, 1.0, 1.0);
    ctx.fillRect(1.7, -1.5, 1.0, 1.0);

    // Cracked Skull Hairline Filigree
    ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-0.8, -7.5);
    ctx.lineTo(-1.8, -5.2);
    ctx.lineTo(-0.4, -3.2);
    ctx.lineTo(-1.2, -2.0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1.8, -5.2);
    ctx.lineTo(-3.5, -5.8);
    ctx.stroke();

    // Upper Maxilla Teeth
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    for (let t = 0; t < 4; t++) {
      ctx.fillRect(-1.8 + t * 1.0, 3.2, 0.6, 1.2);
    }

    // Hinged Mandible (Jawbone) with Walking Chatter
    ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.beginPath();
    ctx.moveTo(-2.8, 4.2 + jawDrop);
    ctx.lineTo(2.8, 4.2 + jawDrop);
    ctx.lineTo(2.0, 6.2 + jawDrop);
    ctx.lineTo(-2.0, 6.2 + jawDrop);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Layer 8: Arm & Notched Rusted Iron Blade
    ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(3.5, 1.0 + bodyBob);
    ctx.lineTo(6.5, 3.5 + bodyBob);
    ctx.stroke();

    // Forged Iron Crossguard & Pommel
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    ctx.fillRect(3.2, 2.8 + bodyBob, 7.5, 2.0);
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.beginPath();
    ctx.arc(7.0, 6.2 + bodyBob, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Rusted Blade Body with Gradient
    this.safeLinearGradient(
      ctx,
      5.5, -14 + bodyBob, 8.5, 3 + bodyBob,
      [
        [0.0, '#7a828e'],
        [0.35, '#3e444c'],
        [0.70, '#5c2715'],
        [1.0, '#26292d'],
      ],
      '#4a4440'
    );

    ctx.beginPath();
    ctx.moveTo(5.8, 2.8 + bodyBob);
    ctx.lineTo(5.8, -13.5 + bodyBob);
    ctx.lineTo(7.0, -15.5 + bodyBob);
    ctx.lineTo(8.2, -13.5 + bodyBob);
    ctx.lineTo(8.2, 2.8 + bodyBob);
    ctx.closePath();
    ctx.fill();

    // Central Fuller Groove
    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(7.0, 2.5 + bodyBob);
    ctx.lineTo(7.0, -13.0 + bodyBob);
    ctx.stroke();

    // Jagged Edge Notches / Battle Chips
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.moveTo(5.8, -6.5 + bodyBob);
    ctx.lineTo(7.0, -5.5 + bodyBob);
    ctx.lineTo(5.8, -4.5 + bodyBob);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5.8, -10.5 + bodyBob);
    ctx.lineTo(6.6, -9.8 + bodyBob);
    ctx.lineTo(5.8, -9.2 + bodyBob);
    ctx.closePath();
    ctx.fill();

    // Rust Pitting Stains
    ctx.fillStyle = '#6e2f18';
    ctx.fillRect(6.2, -1.0 + bodyBob, 1.2, 1.5);
    ctx.fillRect(6.0, -8.0 + bodyBob, 1.0, 1.2);
  }

  // --- Vector Drawer: Ghoul (The Feral Necrophage) ---
  private static drawGhoulVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const crawl = (frame % 2 === 0 ? 1.8 : -1.8);
    const lunge = (frame === 1 ? 1.2 : frame === 3 ? -0.8 : 0);
    const boilPulse = Math.sin((frame * Math.PI) / 2) * 0.35;

    // Layer 1: Ground Contact Drop Shadow
    ctx.beginPath();
    ctx.ellipse(0, 16 + crawl * 0.3, 13.5, 4.2, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 6, 12, 0.50)';
    ctx.fill();

    // Layer 2: Distal (Far) Limbs
    ctx.strokeStyle = '#1e241c';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-8, 5 + crawl);
    ctx.lineTo(-12, 10 - crawl);
    ctx.lineTo(-9, 16);
    ctx.stroke();

    ctx.strokeStyle = '#2d3326';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4, 3 + crawl);
    ctx.lineTo(3, 9 - crawl);
    ctx.lineTo(1, 15);
    ctx.stroke();

    // Layer 3: Hunched Necrotic Torso
    this.safeLinearGradient(
      ctx,
      -12, -7 + crawl, 10, 8 + crawl,
      [
        [0.0, '#384c24'],
        [0.35, PALETTE.NECROTIC_EMERALD.CORE],
        [0.70, '#2d3033'],
        [1.0, PALETTE.NECROTIC_EMERALD.DARK],
      ],
      PALETTE.NECROTIC_EMERALD.DARK
    );

    ctx.beginPath();
    ctx.moveTo(-11, 4 + crawl);
    ctx.quadraticCurveTo(-14, -2 + crawl, -10, -5 + crawl);
    ctx.quadraticCurveTo(-4, -9 + crawl, 3 + lunge, -4 + crawl);
    ctx.quadraticCurveTo(8 + lunge, -1 + crawl, 9 + lunge, 4 + crawl);
    ctx.quadraticCurveTo(4, 9 + crawl, -5, 8 + crawl);
    ctx.closePath();
    ctx.fill();

    // Subcutaneous Bruised Undertones
    ctx.fillStyle = 'rgba(66, 18, 34, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-3, 4 + crawl, 5.0, 3.2, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Emaciated Flank Ribs
    ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-1.5, 0.5 + crawl);
    ctx.quadraticCurveTo(0.5, 3.0 + crawl, 2.5, 5.0 + crawl);
    ctx.moveTo(-4.5, -0.5 + crawl);
    ctx.quadraticCurveTo(-2.5, 2.2 + crawl, -0.5, 4.2 + crawl);
    ctx.moveTo(-7.5, 0.2 + crawl);
    ctx.quadraticCurveTo(-5.5, 2.5 + crawl, -3.5, 4.0 + crawl);
    ctx.stroke();

    // Layer 4: Spinal Bone Spurs
    ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.beginPath();
    ctx.moveTo(-9, -3 + crawl);
    ctx.lineTo(-8, -7 + crawl);
    ctx.lineTo(-6, -4 + crawl);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-5, -6 + crawl);
    ctx.lineTo(-3, -10.5 + crawl);
    ctx.lineTo(-1, -5 + crawl);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1 + lunge, -5 + crawl);
    ctx.lineTo(3 + lunge, -8.5 + crawl);
    ctx.lineTo(5 + lunge, -3 + crawl);
    ctx.closePath();
    ctx.fill();

    // Spur Highlights
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.fillRect(-8.3, -7.0 + crawl, 0.8, 1.2);
    ctx.fillRect(-3.3, -10.5 + crawl, 0.8, 1.5);
    ctx.fillRect(2.7 + lunge, -8.5 + crawl, 0.8, 1.2);

    // Layer 5: Tattered Burial Waistcloth
    ctx.fillStyle = '#2b2723';
    ctx.beginPath();
    ctx.moveTo(-11, 2 + crawl);
    ctx.lineTo(-5, 4 + crawl);
    ctx.lineTo(-4, 8 + crawl);
    ctx.lineTo(-6, 7 + crawl);
    ctx.lineTo(-7, 11 + crawl);
    ctx.lineTo(-9, 7.5 + crawl);
    ctx.lineTo(-11, 9.5 + crawl);
    ctx.lineTo(-12, 5 + crawl);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#140d0a';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Layer 6: Pulsating Necrotic Boils & Wet Specular Highlights
    const b1x = 4 + lunge;
    const b1y = -1 + crawl;
    const b1r = 2.0 + boilPulse;
    ctx.fillStyle = '#4a0e1e';
    ctx.beginPath();
    ctx.arc(b1x, b1y, b1r + 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.BRIGHT;
    ctx.beginPath();
    ctx.arc(b1x, b1y, b1r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4f55a';
    ctx.beginPath();
    ctx.arc(b1x - 0.3, b1y - 0.3, b1r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(b1x - 0.6, b1y - 0.6, 0.55, 0, Math.PI * 2);
    ctx.fill();

    const b2x = -2;
    const b2y = -4 + crawl;
    const b2r = 1.7 - boilPulse * 0.8;
    ctx.fillStyle = '#4a0e1e';
    ctx.beginPath();
    ctx.arc(b2x, b2y, b2r + 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.GLOW;
    ctx.beginPath();
    ctx.arc(b2x, b2y, b2r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(b2x - 0.5, b2y - 0.5, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Layer 7: Feral Cranium, Snapping Maw & Rabid Eye
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.CORE;
    ctx.beginPath();
    ctx.ellipse(8.5 + lunge, -1.8 + crawl, 6.2, 4.5, 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Blackened Maw
    ctx.fillStyle = '#0a0305';
    ctx.beginPath();
    ctx.moveTo(8.5 + lunge, 0 + crawl);
    ctx.lineTo(14.5 + lunge, -1.2 + crawl);
    ctx.lineTo(12.5 + lunge, 4.2 + crawl);
    ctx.closePath();
    ctx.fill();

    // Needle-Sharp Fangs
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
    ctx.beginPath();
    ctx.moveTo(10.5 + lunge, -0.5 + crawl);
    ctx.lineTo(11.0 + lunge, 1.5 + crawl);
    ctx.lineTo(11.5 + lunge, -0.5 + crawl);
    ctx.moveTo(12.5 + lunge, -0.8 + crawl);
    ctx.lineTo(13.0 + lunge, 1.2 + crawl);
    ctx.lineTo(13.5 + lunge, -0.8 + crawl);
    ctx.moveTo(11.8 + lunge, 3.8 + crawl);
    ctx.lineTo(12.3 + lunge, 1.2 + crawl);
    ctx.lineTo(12.9 + lunge, 3.8 + crawl);
    ctx.fill();

    // Dripping Toxic Bile Strand
    ctx.strokeStyle = PALETTE.NECROTIC_EMERALD.GLOW;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11.5 + lunge, 3.5 + crawl);
    ctx.quadraticCurveTo(12.5 + lunge, 6.5 + crawl, 11.0 + lunge, 8.5 + crawl);
    ctx.stroke();
    // Falling Bead
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.BRIGHT;
    ctx.beginPath();
    ctx.arc(11.0 + lunge, 9.2 + crawl, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Sunken Eye Socket & Bilious Iris
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.arc(10.2 + lunge, -3.2 + crawl, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.GLOW;
    ctx.beginPath();
    ctx.arc(10.5 + lunge, -3.2 + crawl, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050203';
    ctx.fillRect(10.3 + lunge, -3.7 + crawl, 0.5, 1.1);

    // Layer 8: Proximal Forelimb & Elongated Bone Claws
    ctx.strokeStyle = PALETTE.NECROTIC_EMERALD.CORE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(6.5 + lunge, 2.0 + crawl);
    ctx.lineTo(8.5 + lunge, 9.5 + crawl);
    ctx.stroke();

    // 3 Talons
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(7.5 + lunge, 9.5 + crawl);
    ctx.quadraticCurveTo(6.0 + lunge, 12.5 + crawl, 5.5 + lunge, 15.2 + crawl);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.5 + lunge, 9.5 + crawl);
    ctx.quadraticCurveTo(9.5 + lunge, 13.0 + crawl, 11.2 + lunge, 16.0 + crawl);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9.5 + lunge, 9.5 + crawl);
    ctx.quadraticCurveTo(11.5 + lunge, 12.5 + crawl, 13.0 + lunge, 14.5 + crawl);
    ctx.stroke();

    // Blood-Dipped Claw Tips
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
    ctx.fillRect(5.0 + lunge, 14.5 + crawl, 1.2, 1.2);
    ctx.fillRect(10.5 + lunge, 15.0 + crawl, 1.4, 1.4);
    ctx.fillRect(12.2 + lunge, 13.8 + crawl, 1.2, 1.2);
  }

  // --- Vector Drawer: Banshee (The Spectral Apparition) ---
  private static drawBansheeVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const bob = Math.sin((frame * Math.PI) / 2) * 2.5;
    const flutter = Math.cos((frame * Math.PI) / 2) * 1.8;

    // 1. Ethereal Ground Void Eddy
    this.safeRadialGradient(
      ctx,
      0, 20, 1, 0, 20, 14,
      [
        [0, 'rgba(26, 12, 46, 0.40)'],
        [0.6, 'rgba(15, 13, 26, 0.15)'],
        [1, 'rgba(0, 0, 0, 0)'],
      ],
      'rgba(26, 12, 46, 0.25)'
    );
    ctx.beginPath();
    ctx.ellipse(0, 20, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Additive Spectral Glow Corona
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.safeRadialGradient(
      ctx,
      0, -2 + bob, 2, 0, -2 + bob, 22,
      [
        [0, 'rgba(0, 240, 255, 0.22)'],
        [0.4, 'rgba(183, 148, 246, 0.18)'],
        [0.8, 'rgba(112, 56, 184, 0.08)'],
        [1, 'rgba(0, 0, 0, 0)'],
      ],
      'rgba(183, 148, 246, 0.15)'
    );
    ctx.beginPath();
    ctx.arc(0, -2 + bob, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // 3. Trailing Ghostly Wisps
    ctx.save();
    this.safeLinearGradient(
      ctx,
      -12, 2 + bob, -16 + flutter, 22 + bob,
      [
        [0, 'rgba(183, 148, 246, 0.65)'],
        [0.5, 'rgba(0, 220, 240, 0.35)'],
        [1, 'rgba(112, 56, 184, 0.0)'],
      ],
      'rgba(183, 148, 246, 0.5)'
    );
    ctx.beginPath();
    ctx.moveTo(-6, 2 + bob);
    ctx.quadraticCurveTo(-14, 10 + bob, -16 + flutter, 20 + bob * 0.5);
    ctx.quadraticCurveTo(-10, 16 + bob, -4, 8 + bob);
    ctx.closePath();
    ctx.fill();

    this.safeLinearGradient(
      ctx,
      12, 2 + bob, 16 - flutter, 22 + bob,
      [
        [0, 'rgba(183, 148, 246, 0.65)'],
        [0.5, 'rgba(0, 220, 240, 0.35)'],
        [1, 'rgba(112, 56, 184, 0.0)'],
      ],
      'rgba(183, 148, 246, 0.5)'
    );
    ctx.beginPath();
    ctx.moveTo(6, 2 + bob);
    ctx.quadraticCurveTo(14, 10 + bob, 16 - flutter, 20 + bob * 0.5);
    ctx.quadraticCurveTo(10, 16 + bob, 4, 8 + bob);
    ctx.closePath();
    ctx.fill();

    this.safeLinearGradient(
      ctx,
      0, 4 + bob, 0, 22 + bob,
      [
        [0, 'rgba(150, 100, 240, 0.70)'],
        [0.6, 'rgba(0, 200, 230, 0.40)'],
        [1, 'rgba(26, 12, 46, 0.0)'],
      ],
      'rgba(150, 100, 240, 0.5)'
    );
    ctx.beginPath();
    ctx.moveTo(-8, 4 + bob);
    ctx.lineTo(8, 4 + bob);
    ctx.quadraticCurveTo(6 + flutter, 14 + bob, 2, 21 + bob);
    ctx.quadraticCurveTo(-2, 16 + bob, -4 - flutter, 18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Translucent Spectral Shroud & Torso
    this.safeLinearGradient(
      ctx,
      0, -12 + bob, 0, 12 + bob,
      [
        [0, 'rgba(215, 195, 255, 0.90)'],
        [0.5, 'rgba(140, 90, 230, 0.75)'],
        [1, 'rgba(40, 15, 80, 0.50)'],
      ],
      'rgba(140, 90, 230, 0.75)'
    );
    ctx.beginPath();
    ctx.moveTo(-8, -4 + bob);
    ctx.quadraticCurveTo(-10, 4 + bob, -7, 12 + bob);
    ctx.lineTo(-2, 9 + bob);
    ctx.lineTo(0, 13 + bob);
    ctx.lineTo(2, 9 + bob);
    ctx.lineTo(7, 12 + bob);
    ctx.quadraticCurveTo(10, 4 + bob, 8, -4 + bob);
    ctx.closePath();
    ctx.fill();

    // 5. Weeping Mourning Veil & Hood
    ctx.fillStyle = 'rgba(60, 27, 107, 0.92)';
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 7.5, Math.PI, 0);
    ctx.quadraticCurveTo(8, -2 + bob, 7, 2 + bob);
    ctx.lineTo(-7, 2 + bob);
    ctx.quadraticCurveTo(-8, -2 + bob, 0, -9 + bob);
    ctx.closePath();
    ctx.fill();

    // Gossamer highlights
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -8 + bob);
    ctx.quadraticCurveTo(-7, -2 + bob, -5, 4 + bob);
    ctx.moveTo(6, -8 + bob);
    ctx.quadraticCurveTo(7, -2 + bob, 5, 4 + bob);
    ctx.stroke();

    // Abyss Interior of Hood
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.beginPath();
    ctx.ellipse(0, -8 + bob, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Agonized Weeping Visage
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(-2.5, -9.5 + bob, 1.2, 1.8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2.5, -9.5 + bob, 1.2, 1.8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Cyan Pinpoint Gaze
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(-3, -10 + bob, 1, 1);
    ctx.fillRect(2, -10 + bob, 1, 1);

    // Weeping Spectral Tears
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-2.5, -8 + bob);
    ctx.lineTo(-2.5, -4.5 + bob);
    ctx.moveTo(2.5, -8 + bob);
    ctx.lineTo(2.5, -4.5 + bob);
    ctx.stroke();

    // Wailing Mouth Silhouette
    ctx.fillStyle = '#020106';
    ctx.beginPath();
    ctx.ellipse(0, -4.5 + bob, 1.8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Luminous Soul Scream Emission
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(0, 255, 240, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -4 + bob, 0.8, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // --- Vector Drawer: Death Knight (The Obsidian Executioner) ---
  private static drawDeathKnightVector(ctx: CanvasRenderingContext2D, frame: number): void {
    const legStride = Math.sin((frame * Math.PI) / 2) * 5;
    const stompDrop = ((frame % 4) === 1 || (frame % 4) === 3) ? 1 : 0;
    const capeSway = Math.sin((frame * Math.PI) / 2) * 3;

    // 1. Heavy Contact Shadow
    ctx.fillStyle = 'rgba(8, 6, 12, 0.70)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Heavy Tattered Crimson Warcape
    this.safeLinearGradient(
      ctx,
      0, -10 + stompDrop, 0, 24 + stompDrop,
      [
        [0, PALETTE.BLOOD_CRIMSON.COAGULATED],
        [0.7, PALETTE.BLOOD_CRIMSON.DRIED],
        [1, '#1a0404'],
      ],
      PALETTE.BLOOD_CRIMSON.COAGULATED
    );

    ctx.beginPath();
    ctx.moveTo(-14, -8 + stompDrop);
    ctx.lineTo(14, -8 + stompDrop);
    ctx.quadraticCurveTo(18 + capeSway, 8 + stompDrop, 17 + capeSway, 23 + stompDrop);
    ctx.lineTo(11 + capeSway, 20 + stompDrop);
    ctx.lineTo(5 + capeSway, 24 + stompDrop);
    ctx.lineTo(-2 + capeSway, 20 + stompDrop);
    ctx.lineTo(-8 + capeSway, 24 + stompDrop);
    ctx.lineTo(-17 + capeSway, 22 + stompDrop);
    ctx.quadraticCurveTo(-18 + capeSway, 8 + stompDrop, -14, -8 + stompDrop);
    ctx.closePath();
    ctx.fill();

    // Cape Inner Folds
    ctx.strokeStyle = 'rgba(10, 4, 4, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -4 + stompDrop);
    ctx.lineTo(-7 + capeSway, 20 + stompDrop);
    ctx.moveTo(6, -4 + stompDrop);
    ctx.lineTo(7 + capeSway, 20 + stompDrop);
    ctx.stroke();

    // 3. Articulated Obsidian Armored Greaves & Sabatons
    const drawLeg = (baseX: number, stride: number) => {
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
      ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(baseX - 4 + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 4 + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 5 + stride, 20 + stompDrop);
      ctx.lineTo(baseX - 4 + stride, 20 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Knee Guard Spiked Ridge
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
      ctx.beginPath();
      ctx.moveTo(baseX - 3 + stride, 10 + stompDrop);
      ctx.lineTo(baseX + stride, 8 + stompDrop);
      ctx.lineTo(baseX + 3 + stride, 10 + stompDrop);
      ctx.lineTo(baseX + stride, 12 + stompDrop);
      ctx.closePath();
      ctx.fill();

      // Pointed Sabaton
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
      ctx.beginPath();
      ctx.moveTo(baseX - 4 + stride, 20 + stompDrop);
      ctx.lineTo(baseX + 6 + stride, 20 + stompDrop);
      ctx.lineTo(baseX + 7 + stride, 24 + stompDrop);
      ctx.lineTo(baseX - 5 + stride, 24 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular Highlight
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX - 2 + stride, 9 + stompDrop);
      ctx.lineTo(baseX - 2 + stride, 19 + stompDrop);
      ctx.stroke();
    };

    drawLeg(-7, legStride);
    drawLeg(6, -legStride);

    // 4. Obsidian Cuirass & Segmented Plackart
    this.safeLinearGradient(
      ctx,
      -10, -10 + stompDrop, 10, 10 + stompDrop,
      [
        [0, '#231d38'],
        [0.4, PALETTE.ABYSSAL_VOID.SLATE],
        [1, PALETTE.ABYSSAL_VOID.DEEP],
      ],
      PALETTE.ABYSSAL_VOID.SLATE
    );
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(-11, -10 + stompDrop);
    ctx.lineTo(11, -10 + stompDrop);
    ctx.lineTo(9, 7 + stompDrop);
    ctx.lineTo(0, 10 + stompDrop);
    ctx.lineTo(-9, 7 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central Sternal Ridge
    ctx.strokeStyle = 'rgba(220, 225, 240, 0.70)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -9 + stompDrop);
    ctx.lineTo(0, 9 + stompDrop);
    ctx.stroke();

    // Etched Antique Gold Filigree
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -5 + stompDrop);
    ctx.lineTo(-3, -2 + stompDrop);
    ctx.lineTo(-6, 2 + stompDrop);
    ctx.moveTo(7, -5 + stompDrop);
    ctx.lineTo(3, -2 + stompDrop);
    ctx.lineTo(6, 2 + stompDrop);
    ctx.stroke();

    // Occult Blood Sigil Center
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.VIVID;
    ctx.beginPath();
    ctx.arc(0, 1 + stompDrop, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 5. Massive Flared Spiked Pauldrons
    const drawPauldron = (isLeft: boolean) => {
      const dir = isLeft ? -1 : 1;
      ctx.save();
      ctx.fillStyle = PALETTE.ABYSSAL_VOID.MID;
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.65)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(dir * 7, -14 + stompDrop);
      ctx.lineTo(dir * 18, -20 + stompDrop);
      ctx.lineTo(dir * 17, -10 + stompDrop);
      ctx.lineTo(dir * 8, -6 + stompDrop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(dir * 8, -13 + stompDrop);
      ctx.lineTo(dir * 16, -18 + stompDrop);
      ctx.stroke();
      ctx.restore();
    };

    drawPauldron(true);
    drawPauldron(false);

    // 6. Horned Greathelm with Glowing Crimson Visor
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -17 + stompDrop, 7, Math.PI, 0);
    ctx.lineTo(6, -11 + stompDrop);
    ctx.lineTo(0, -9 + stompDrop);
    ctx.lineTo(-6, -11 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Greathelm Specular Bevel
    ctx.strokeStyle = 'rgba(210, 220, 240, 0.70)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -24 + stompDrop);
    ctx.lineTo(0, -10 + stompDrop);
    ctx.stroke();

    // Demonic Sweeping Obsidian Horns
    this.safeLinearGradient(
      ctx,
      0, -18 + stompDrop, 0, -32 + stompDrop,
      [
        [0, PALETTE.ABYSSAL_VOID.DEEP],
        [0.6, PALETTE.BONE_IVORY.SHADOW],
        [1, PALETTE.BONE_IVORY.POLISHED],
      ],
      PALETTE.ABYSSAL_VOID.DEEP
    );
    ctx.strokeStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(-5, -20 + stompDrop);
    ctx.quadraticCurveTo(-14, -22 + stompDrop, -16, -30 + stompDrop);
    ctx.quadraticCurveTo(-12, -26 + stompDrop, -4, -22 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(5, -20 + stompDrop);
    ctx.quadraticCurveTo(14, -22 + stompDrop, 16, -30 + stompDrop);
    ctx.quadraticCurveTo(12, -26 + stompDrop, 4, -22 + stompDrop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Visor Aperture
    ctx.fillStyle = '#000000';
    ctx.fillRect(-5, -16 + stompDrop, 10, 2.5);

    // Glowing Crimson Visor Slit
    ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
    ctx.fillRect(-4.5, -15.5 + stompDrop, 9, 1.5);

    // Visor Horizontal Laser Glare
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.safeLinearGradient(
      ctx,
      -8, 0, 8, 0,
      [
        [0, 'rgba(255, 30, 30, 0)'],
        [0.5, 'rgba(255, 80, 80, 0.85)'],
        [1, 'rgba(255, 30, 30, 0)'],
      ],
      'rgba(255, 80, 80, 0.5)'
    );
    ctx.fillRect(-8, -16 + stompDrop, 16, 2.5);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // 7. Imposing Two-Handed Runic Executioner Greatsword
    const swordX = 13;
    const swordY = -26 + stompDrop;

    // Pommel
    ctx.fillStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.beginPath();
    ctx.arc(swordX + 2, swordY + 45, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Wire Hilt
    ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
    ctx.fillRect(swordX + 1, swordY + 36, 2, 8);

    // Spiked Crossguard
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(swordX - 5, swordY + 35);
    ctx.lineTo(swordX + 9, swordY + 35);
    ctx.lineTo(swordX + 8, swordY + 38);
    ctx.lineTo(swordX + 2, swordY + 36.5);
    ctx.lineTo(swordX - 4, swordY + 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Steel Blade
    this.safeLinearGradient(
      ctx,
      swordX, swordY, swordX + 4, swordY,
      [
        [0, '#555e70'],
        [0.4, '#b8c4d8'],
        [0.6, '#ffffff'],
        [1, '#3b4252'],
      ],
      '#555e70'
    );
    ctx.beginPath();
    ctx.moveTo(swordX - 1, swordY + 35);
    ctx.lineTo(swordX - 1, swordY + 4);
    ctx.lineTo(swordX + 2, swordY - 2);
    ctx.lineTo(swordX + 5, swordY + 4);
    ctx.lineTo(swordX + 5, swordY + 35);
    ctx.closePath();
    ctx.fill();

    // Central Fuller
    ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
    ctx.fillRect(swordX + 1.5, swordY + 6, 1, 28);

    // Glowing Blood Runes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 40, 40, 0.9)';
    ctx.fillRect(swordX + 1.5, swordY + 8, 1, 3);
    ctx.fillRect(swordX + 1.5, swordY + 14, 1, 4);
    ctx.fillRect(swordX + 1.5, swordY + 21, 1, 3);
    ctx.fillRect(swordX + 1.5, swordY + 27, 1, 4);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // Finish with iron crossguard highlight
    ctx.fillStyle = '#3b4252';
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
      if (flash === 'white') this.drawMaskedEntity(ctx, 'player', frame, '#ffffff');
      else if (flash === 'crimson') this.drawMaskedEntity(ctx, 'player', frame, PALETTE.BLOOD_CRIMSON.FLASH);
      else this.drawPlayerVector(ctx, frame);
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
