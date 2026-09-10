/**
 * DarkFantasyVFX.ts - High-Performance Zero-Garbage Particle & Arcane VFX Engine.
 * Milestone M2: Dark Fantasy Art & Gothic Render Engine.
 */

import { Camera } from '../Camera';
import { GemType } from '../../core/entities/EnemyTypes';
import { LootItem } from '../../core/systems/LootManager';
import { PALETTE } from '../DarkFantasyPalette';

export type ParticleType =
  | 'BLOOD_DROPLET'
  | 'BONE_CHIP'
  | 'SOUL_SPARK'
  | 'GHOUL_BILE'
  | 'SPELL_TRAIL'
  | 'SPELL_CIRCLE'
  | 'GEM_GLINT';

export interface Particle {
  id: number;
  active: boolean;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravity: number;
  life: number;
  maxLife: number;
  startSize: number;
  endSize: number;
  size: number;
  color: string;
  startAlpha: number;
  endAlpha: number;
  alpha: number;
  rotation: number;
  vRot: number;
  extra: number; // For circle radius, spark wobble phase, etc.
}

export class DarkFantasyVFX {
  public readonly capacity: number;
  public readonly pool: Particle[];
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private readonly activeIndices: Int32Array;
  private activeCount: number;
  private readonly indexInActive: Int32Array;

  // Glint periodic timer for loot items
  private lootGlintTimer: number = 0;

  constructor(capacity: number = 500) {
    this.capacity = capacity;
    this.pool = new Array(capacity);
    this.freeIndices = new Int32Array(capacity);
    this.activeIndices = new Int32Array(capacity);
    this.indexInActive = new Int32Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.pool[i] = {
        id: i,
        active: false,
        type: 'BLOOD_DROPLET',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        drag: 1.0,
        gravity: 0,
        life: 0,
        maxLife: 1.0,
        startSize: 2,
        endSize: 1,
        size: 2,
        color: '#ffffff',
        startAlpha: 1.0,
        endAlpha: 0.0,
        alpha: 1.0,
        rotation: 0,
        vRot: 0,
        extra: 0,
      };
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }

    this.freeCount = capacity;
    this.activeCount = 0;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getFreeCount(): number {
    return this.freeCount;
  }

  private allocateParticle(): Particle | null {
    if (this.freeCount > 0) {
      const idx = this.freeIndices[--this.freeCount];
      const p = this.pool[idx];
      p.active = true;

      // Register in active list
      this.activeIndices[this.activeCount] = idx;
      this.indexInActive[idx] = this.activeCount;
      this.activeCount++;
      return p;
    }

    // Pool full: displace oldest particle (activeIndices[0])
    if (this.activeCount > 0) {
      const oldestIdx = this.activeIndices[0];
      const p = this.pool[oldestIdx];
      // Reset and reuse
      return p;
    }

    return null;
  }

  private freeParticle(idx: number): void {
    const p = this.pool[idx];
    if (!p.active) return;
    p.active = false;

    // Swap-and-pop from activeIndices
    const pos = this.indexInActive[idx];
    if (pos >= 0 && pos < this.activeCount) {
      const lastIdx = this.activeIndices[this.activeCount - 1];
      this.activeIndices[pos] = lastIdx;
      this.indexInActive[lastIdx] = pos;
      this.indexInActive[idx] = -1;
      this.activeCount--;
    }

    // Return to freeIndices
    this.freeIndices[this.freeCount++] = idx;
  }

  public clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.pool[i].active = false;
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }
    this.freeCount = this.capacity;
    this.activeCount = 0;
  }

  public update(dt: number): void {
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.freeParticle(idx);
        continue;
      }

      const progress = p.life / p.maxLife;

      // Physics integration
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;

      // Special oscillation for SOUL_SPARK
      if (p.type === 'SOUL_SPARK') {
        p.vx += Math.sin(p.life * 12.0 + p.extra) * 15.0 * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.rotation += p.vRot * dt;

      // Interpolate size & alpha
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = Math.max(0, p.startAlpha + (p.endAlpha - p.startAlpha) * progress);
    }
  }

  // ==========================================
  // Emitters (Zero Heap Allocation at Runtime)
  // ==========================================

  public emitBloodBurst(
    x: number,
    y: number,
    count: number = 8,
    dirX?: number,
    dirY?: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocateParticle();
      if (!p) break;

      p.type = 'BLOOD_DROPLET';
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;

      let angle = Math.random() * Math.PI * 2;
      let speed = 40 + Math.random() * 120;

      if (dirX !== undefined && dirY !== undefined && (dirX !== 0 || dirY !== 0)) {
        const baseAngle = Math.atan2(dirY, dirX);
        angle = baseAngle + (Math.random() - 0.5) * 1.2;
        speed = 80 + Math.random() * 140;
      }

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.drag = 0.90;
      p.gravity = 90;

      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.3;

      p.startSize = 3 + Math.random() * 2.5;
      p.endSize = 1.2;
      p.size = p.startSize;

      p.color = Math.random() > 0.3 ? PALETTE.BLOOD_CRIMSON.FLASH : PALETTE.BLOOD_CRIMSON.COAGULATED;
      p.startAlpha = 0.9;
      p.endAlpha = 0.0;
      p.alpha = 0.9;

      p.rotation = 0;
      p.vRot = 0;
      p.extra = 0;
    }
  }

  public emitBoneShatter(x: number, y: number, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocateParticle();
      if (!p) break;

      p.type = 'BONE_CHIP';
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;

      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 130;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.drag = 0.88;
      p.gravity = 110;

      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.3;

      p.startSize = 3.5 + Math.random() * 2;
      p.endSize = 2;
      p.size = p.startSize;

      p.color = PALETTE.BONE_IVORY.POLISHED;
      p.startAlpha = 1.0;
      p.endAlpha = 0.0;
      p.alpha = 1.0;

      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 24;
      p.extra = 0;
    }
  }

  public emitSoulBurst(
    x: number,
    y: number,
    gemType: GemType | string = 'emerald',
    count: number = 6
  ): void {
    const rawType = String(gemType).toLowerCase();
    let color: string = PALETTE.NECROTIC_EMERALD.GLOW;
    if (rawType.includes('ruby')) color = PALETTE.BLOOD_CRIMSON.FLASH;
    else if (rawType.includes('violet') || rawType.includes('abyssal')) color = PALETTE.CURSED_ARCANE.AURA;
    else if (rawType.includes('chest') || rawType.includes('gold')) color = '#ecc94b';

    for (let i = 0; i < count; i++) {
      const p = this.allocateParticle();
      if (!p) break;

      p.type = 'SOUL_SPARK';
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;

      p.vx = (Math.random() - 0.5) * 50;
      p.vy = -(40 + Math.random() * 60); // Float upward
      p.drag = 0.94;
      p.gravity = -30; // Inverted gravity

      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.5;

      p.startSize = 4.5 + Math.random() * 2;
      p.endSize = 0.8;
      p.size = p.startSize;

      p.color = color;
      p.startAlpha = 1.0;
      p.endAlpha = 0.0;
      p.alpha = 1.0;

      p.rotation = 0;
      p.vRot = 0;
      p.extra = Math.random() * Math.PI * 2;
    }
  }

  public emitBileSputter(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocateParticle();
      if (!p) break;

      p.type = 'GHOUL_BILE';
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.drag = 0.91;
      p.gravity = 60;

      p.life = 0;
      p.maxLife = 0.5 + Math.random() * 0.3;

      p.startSize = 3 + Math.random() * 2.5;
      p.endSize = 1;
      p.size = p.startSize;

      p.color = PALETTE.NECROTIC_EMERALD.BRIGHT;
      p.startAlpha = 0.9;
      p.endAlpha = 0.0;
      p.alpha = 0.9;

      p.rotation = 0;
      p.vRot = 0;
      p.extra = 0;
    }
  }

  public emitSpellTrail(
    x: number,
    y: number,
    color: string = PALETTE.CURSED_ARCANE.AURA,
    size: number = 3.5
  ): void {
    const p = this.allocateParticle();
    if (!p) return;

    p.type = 'SPELL_TRAIL';
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 12;
    p.vy = (Math.random() - 0.5) * 12;
    p.drag = 0.90;
    p.gravity = 0;

    p.life = 0;
    p.maxLife = 0.25;

    p.startSize = size;
    p.endSize = 0.5;
    p.size = size;

    p.color = color;
    p.startAlpha = 0.8;
    p.endAlpha = 0.0;
    p.alpha = 0.8;

    p.rotation = 0;
    p.vRot = 0;
    p.extra = 0;
  }

  public emitSpellCircle(
    x: number,
    y: number,
    radius: number = 48,
    duration: number = 1.5,
    color: string = PALETTE.CURSED_ARCANE.AURA
  ): void {
    const p = this.allocateParticle();
    if (!p) return;

    p.type = 'SPELL_CIRCLE';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.drag = 1.0;
    p.gravity = 0;

    p.life = 0;
    p.maxLife = duration;

    p.startSize = radius;
    p.endSize = radius;
    p.size = radius;

    p.color = color;
    p.startAlpha = 0.6;
    p.endAlpha = 0.0;
    p.alpha = 0.6;

    p.rotation = 0;
    p.vRot = 1.8; // Rotating circle
    p.extra = radius;
  }

  public emitGemGlint(x: number, y: number, color: string = '#ffffff'): void {
    const p = this.allocateParticle();
    if (!p) return;

    p.type = 'GEM_GLINT';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = -6;
    p.drag = 0.95;
    p.gravity = 0;

    p.life = 0;
    p.maxLife = 0.35;

    p.startSize = 6;
    p.endSize = 1;
    p.size = 6;

    p.color = color;
    p.startAlpha = 1.0;
    p.endAlpha = 0.0;
    p.alpha = 1.0;

    p.rotation = Math.PI / 4;
    p.vRot = 4;
    p.extra = 0;
  }

  public updateLootGlints(items: readonly LootItem[], dt: number): void {
    this.lootGlintTimer += dt;
    if (this.lootGlintTimer < 0.4) return;
    this.lootGlintTimer = 0;

    const count = Math.min(items.length, 30);
    for (let i = 0; i < count; i++) {
      const item = items[i];
      if (item.isAlive && Math.random() < 0.25) {
        this.emitGemGlint(item.position.x, item.position.y, item.color);
      }
    }
  }

  // ==========================================
  // Dual-Layer Rendering
  // ==========================================

  public renderGround(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = camera.viewportWidth;
    const vh = camera.viewportHeight;

    for (let i = 0; i < this.activeCount; i++) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      if (p.type !== 'SPELL_CIRCLE') continue;

      const sx = p.x - camX;
      const sy = p.y - camY;
      const r = p.size;

      // Culling
      if (sx < -r || sx > vw + r || sy < -r || sy > vh + r) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);

      // Outer ring
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // Inner pentagram / star
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let pt = 0; pt < 5; pt++) {
        const a1 = (pt * 4 * Math.PI) / 5 - Math.PI / 2;
        const a2 = ((pt + 1) * 4 * Math.PI) / 5 - Math.PI / 2;
        ctx.moveTo(Math.cos(a1) * r * 0.7, Math.sin(a1) * r * 0.7);
        ctx.lineTo(Math.cos(a2) * r * 0.7, Math.sin(a2) * r * 0.7);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  public renderAir(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = camera.viewportWidth;
    const vh = camera.viewportHeight;

    for (let i = 0; i < this.activeCount; i++) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      if (p.type === 'SPELL_CIRCLE') continue; // Handled in ground layer

      const sx = p.x - camX;
      const sy = p.y - camY;
      const s = p.size;

      // Frustum culling
      if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      switch (p.type) {
        case 'BLOOD_DROPLET':
        case 'GHOUL_BILE':
        case 'SPELL_TRAIL': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'BONE_CHIP': {
          ctx.translate(sx, sy);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
          break;
        }

        case 'SOUL_SPARK': {
          // Soft outer halo & bright core
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'GEM_GLINT': {
          ctx.translate(sx, sy);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          // 4-pointed sparkle
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.lineTo(-s * 0.2, -s * 0.2);
          ctx.lineTo(0, -s);
          ctx.lineTo(s * 0.2, -s * 0.2);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.2, s * 0.2);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.2, s * 0.2);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
  }
}
