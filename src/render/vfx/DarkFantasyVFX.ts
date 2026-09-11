/**
 * DarkFantasyVFX.ts - High-Performance Zero-Garbage Particle & Arcane VFX Engine.
 * Milestone M3: Dynamic Lighting, Rich VFX & Atmospheric Polish.
 *
 * Performance features:
 * - 500-slot pre-allocated particle pool with O(1) swap-and-pop allocation
 * - 500-slot pre-allocated circular ring buffer for ground decals (blood, scorch, sigil)
 * - Zero runtime heap allocations during 60Hz frame loop
 * - Branching abyssal lightning with recursive midpoint displacement
 * - Swirling necrotic soul motes with multi-harmonic sinusoidal drift & additive bloom
 * - 3D tumbling bone fragments and elongated visceral blood droplets
 * - Ceremonial occult ascension runes and explosive shockwave sigils
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
  | 'GEM_GLINT'
  | 'LIGHTNING_SEGMENT'
  | 'OCCULT_SEAL';

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
  extra: number; // Fork level, bone archetype, seal mode, etc.
}

export type DecalType =
  | 'BLOOD_SPLATTER'
  | 'BLOOD_POOL'
  | 'LIGHTNING_SCORCH'
  | 'SIGIL_SCORCH';

export interface GroundDecal {
  id: number;
  active: boolean;
  type: DecalType;
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  alpha: number;
  rotation: number;
  extra: number; // Variation seed / satellites
}

export class DarkFantasyVFX {
  public readonly capacity: number;
  public readonly pool: Particle[];
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private readonly activeIndices: Int32Array;
  private activeCount: number;
  private readonly indexInActive: Int32Array;

  // Ground Decal System: 500-slot Circular Ring Buffer
  public readonly decalCapacity: number = 500;
  public readonly decals: GroundDecal[];
  private decalHead: number = 0;
  private decalActiveCount: number = 0;

  // Dynamic Radial Lighting Engine
  public readonly lighting: DynamicLightingEngine;

  // Glint periodic timer for loot items
  private lootGlintTimer: number = 0;

  constructor(capacity: number = 500) {
    this.capacity = capacity;
    this.lighting = new DynamicLightingEngine();
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

    // Initialize pre-allocated decal buffer
    this.decals = new Array(this.decalCapacity);
    for (let i = 0; i < this.decalCapacity; i++) {
      this.decals[i] = {
        id: i,
        active: false,
        type: 'BLOOD_SPLATTER',
        x: 0,
        y: 0,
        radius: 6,
        color: PALETTE.BLOOD_CRIMSON.COAGULATED,
        life: 0,
        maxLife: 12.0,
        alpha: 0.85,
        rotation: 0,
        extra: 0,
      };
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getFreeCount(): number {
    return this.freeCount;
  }

  public getActiveDecalCount(): number {
    return this.decalActiveCount;
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

    // Pool full: displace oldest particle (activeIndices[0]) in FIFO order
    if (this.activeCount > 0) {
      const oldestIdx = this.activeIndices[0];
      for (let i = 0; i < this.activeCount - 1; i++) {
        const nextIdx = this.activeIndices[i + 1];
        this.activeIndices[i] = nextIdx;
        this.indexInActive[nextIdx] = i;
      }
      this.activeIndices[this.activeCount - 1] = oldestIdx;
      this.indexInActive[oldestIdx] = this.activeCount - 1;

      const p = this.pool[oldestIdx];
      p.active = true;
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

    // Clear decals
    for (let i = 0; i < this.decalCapacity; i++) {
      this.decals[i].active = false;
      this.decals[i].life = 0;
    }
    this.decalHead = 0;
    this.decalActiveCount = 0;

    // Reset lighting engine
    this.lighting.reset();
  }

  // ==========================================
  // Ground Decal System (500-slot Ring Buffer)
  // ==========================================

  public emitDecal(
    type: DecalType,
    x: number,
    y: number,
    radius?: number,
    color?: string
  ): GroundDecal {
    const decal = this.decals[this.decalHead];
    this.decalHead = (this.decalHead + 1) % this.decalCapacity;
    if (this.decalActiveCount < this.decalCapacity) {
      this.decalActiveCount++;
    }

    decal.active = true;
    decal.type = type;
    decal.x = x;
    decal.y = y;
    decal.rotation = Math.random() * Math.PI * 2;
    decal.extra = Math.random();
    decal.life = 0;

    switch (type) {
      case 'BLOOD_SPLATTER':
        decal.radius = radius ?? (4 + Math.random() * 4);
        decal.color = color ?? (Math.random() > 0.4 ? PALETTE.BLOOD_CRIMSON.COAGULATED : PALETTE.BLOOD_CRIMSON.FLASH);
        decal.maxLife = 12.0;
        decal.alpha = 0.85;
        break;
      case 'BLOOD_POOL':
        decal.radius = radius ?? (12 + Math.random() * 6);
        decal.color = color ?? PALETTE.BLOOD_CRIMSON.COAGULATED;
        decal.maxLife = 15.0;
        decal.alpha = 0.90;
        break;
      case 'LIGHTNING_SCORCH':
        decal.radius = radius ?? (18 + Math.random() * 6);
        decal.color = color ?? '#1a202c';
        decal.maxLife = 10.0;
        decal.alpha = 0.80;
        break;
      case 'SIGIL_SCORCH':
        decal.radius = radius ?? (28 + Math.random() * 8);
        decal.color = color ?? PALETTE.CURSED_ARCANE.DEEP;
        decal.maxLife = 12.0;
        decal.alpha = 0.85;
        break;
    }

    return decal;
  }

  public emitBloodSplatter(x: number, y: number, radius: number = 6): void {
    this.emitDecal('BLOOD_SPLATTER', x, y, radius);
  }

  public emitBloodPool(x: number, y: number, radius: number = 14, color?: string): void {
    this.emitDecal('BLOOD_POOL', x, y, radius, color);
  }

  public emitLightningScorch(x: number, y: number, radius: number = 20): void {
    this.emitDecal('LIGHTNING_SCORCH', x, y, radius);
  }

  public emitSigilScorch(x: number, y: number, radius: number = 30): void {
    this.emitDecal('SIGIL_SCORCH', x, y, radius);
  }

  // ==========================================
  // Particle Simulation Loop
  // ==========================================

  public update(dt: number): void {
    // 1. Update Particles
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.freeParticle(idx);
        continue;
      }

      const progress = p.maxLife > 0 ? Math.max(0, Math.min(1, p.life / p.maxLife)) : 1;

      // Physics integration
      const dragFactor = p.drag > 0 ? Math.pow(p.drag, Math.max(0, dt * 60)) : 1.0;
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vy += p.gravity * dt;

      // Swirling Necrotic Soul Motes: Multi-harmonic 2D sinusoidal drift & ethereal lift
      if (p.type === 'SOUL_SPARK') {
        p.vx += (Math.cos(p.life * 7.5 + p.extra) * 24.0 - p.vx * 0.1) * dt;
        p.vy += (Math.sin(p.life * 5.0 + p.extra) * 12.0 - 32.0) * dt;
      } else if (p.type === 'BONE_CHIP') {
        // Ground bounce for bone fragments
        if (progress > 0.65 && p.vy > 0) {
          p.vy = -p.vy * 0.35;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.rotation += p.vRot * dt;

      // Interpolate size & alpha
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = Math.max(0, Math.min(1, p.startAlpha + (p.endAlpha - p.startAlpha) * progress));
    }

    // 2. Update Ground Decals
    for (let i = 0; i < this.decalCapacity; i++) {
      const d = this.decals[i];
      if (!d.active) continue;

      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        if (this.decalActiveCount > 0) this.decalActiveCount--;
        continue;
      }

      // Organic decay curves over 10-15s
      let baseAlpha = 0.85;
      let holdTime = 8.0;
      let fadeDuration = 4.0;

      if (d.type === 'BLOOD_POOL') {
        baseAlpha = 0.90;
        holdTime = 10.0;
        fadeDuration = 5.0;
      } else if (d.type === 'LIGHTNING_SCORCH') {
        baseAlpha = 0.80;
        holdTime = 6.0;
        fadeDuration = 4.0;
      } else if (d.type === 'SIGIL_SCORCH') {
        baseAlpha = 0.85;
        holdTime = 7.0;
        fadeDuration = 5.0;
      }

      if (d.life <= holdTime) {
        d.alpha = baseAlpha;
      } else {
        const fadeProgress = Math.min(1.0, (d.life - holdTime) / fadeDuration);
        d.alpha = Math.max(0, baseAlpha * (1.0 - fadeProgress));
      }
    }

    // 3. Update Dynamic Lighting Engine
    this.lighting.update(dt);
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

  public emitBloodImpact(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    count: number = 5
  ): void {
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    for (let i = 0; i < count; i++) {
      const p = this.allocateParticle();
      if (!p) break;

      p.type = 'BLOOD_DROPLET';
      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y + (Math.random() - 0.5) * 4;

      const spread = (Math.random() - 0.5) * 0.7;
      const angle = Math.atan2(ny, nx) + spread;
      const speed = 120 + Math.random() * 100;

      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.drag = 0.88;
      p.gravity = 140;

      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.25;

      p.startSize = 3.5 + Math.random() * 2;
      p.endSize = 1.0;
      p.size = p.startSize;

      p.color = PALETTE.BLOOD_CRIMSON.FLASH;
      p.startAlpha = 0.95;
      p.endAlpha = 0.0;
      p.alpha = 0.95;

      p.rotation = 0;
      p.vRot = 0;
      p.extra = 1; // Flag for high-speed impact droplet
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
      p.extra = Math.floor(Math.random() * 3); // 0=splinter, 1=rib sliver, 2=vertebra
    }
  }

  public emitDeathGore(
    x: number,
    y: number,
    gemType: GemType | string = 'emerald'
  ): void {
    this.emitBloodBurst(x, y, 14);
    this.emitBoneShatter(x, y, 8);
    this.emitSoulBurst(x, y, gemType, 6);
    this.emitBloodPool(x, y, 12 + Math.random() * 6);
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
      p.gravity = -32; // Inverted gravity for soul levitation

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

  /**
   * Branching Abyssal Lightning with recursive midpoint displacement forks
   * and cyan/violet dissipation timeline.
   */
  public emitLightningArc(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    isEvolution: boolean = false,
    color?: string
  ): void {
    const defaultColor = isEvolution ? PALETTE.BLOOD_CRIMSON.FLASH : (color || '#67e8f9');

    // Recursive midpoint subdivision helper
    const subdivide = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      depth: number,
      maxDepth: number,
      branchLevel: number = 0
    ) => {
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.hypot(dx, dy);

      if (depth >= maxDepth || dist < 16) {
        // Allocate leaf segment
        const p = this.allocateParticle();
        if (!p) return;

        p.type = 'LIGHTNING_SEGMENT';
        p.x = ax;
        p.y = ay;
        p.vx = dx; // stores seg dx
        p.vy = dy; // stores seg dy
        p.drag = 1.0;
        p.gravity = 0;
        p.life = 0;
        p.maxLife = 0.18 + Math.random() * 0.05;
        p.startSize = branchLevel === 0 ? 3.5 : branchLevel === 1 ? 2.4 : 1.4;
        p.endSize = 0.8;
        p.size = p.startSize;
        p.color = defaultColor;
        p.startAlpha = 1.0;
        p.endAlpha = 0.0;
        p.alpha = 1.0;
        p.rotation = 0;
        p.vRot = 0;
        p.extra = branchLevel; // 0 = main trunk, 1 = primary fork, 2 = secondary fork
        return;
      }

      // Compute perpendicular normal
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);

      const offset = (Math.random() - 0.5) * dist * 0.35 * Math.pow(0.75, depth);
      const mx = (ax + bx) * 0.5 + nx * offset;
      const my = (ay + by) * 0.5 + ny * offset;

      // Subdivide both halves
      subdivide(ax, ay, mx, my, depth + 1, maxDepth, branchLevel);
      subdivide(mx, my, bx, by, depth + 1, maxDepth, branchLevel);

      // Probabilistic forking at depth 1
      if (depth === 1 && Math.random() < 0.35) {
        const forkAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
        const forkLen = dist * (0.35 + Math.random() * 0.25);
        const fx = mx + Math.cos(forkAngle) * forkLen;
        const fy = my + Math.sin(forkAngle) * forkLen;
        subdivide(mx, my, fx, fy, depth + 1, maxDepth, branchLevel + 1);
      }
    };

    subdivide(x1, y1, x2, y2, 0, 3, 0);
    this.lighting.triggerLightningFlash(0.45);
    this.emitLightningScorch(x2, y2, 18);
  }

  /**
   * Occult Ascension Rune Seal centered on player during level-up.
   */
  public emitLevelUpRune(
    x: number,
    y: number,
    radius: number = 72,
    duration: number = 2.4
  ): void {
    const p = this.allocateParticle();
    if (!p) return;

    p.type = 'OCCULT_SEAL';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.drag = 1.0;
    p.gravity = 0;
    p.life = 0;
    p.maxLife = duration;
    p.startSize = radius;
    p.endSize = radius * 1.1;
    p.size = radius;
    p.color = PALETTE.CURSED_ARCANE.AURA;
    p.startAlpha = 0.9;
    p.endAlpha = 0.0;
    p.alpha = 0.9;
    p.rotation = 0;
    p.vRot = 1.2;
    p.extra = 0; // 0 = ceremonial level-up seal

    // Emit 12 rising soul motes spiraling upwards around perimeter
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const px = x + Math.cos(angle) * radius * 0.9;
      const py = y + Math.sin(angle) * radius * 0.9;
      const spark = this.allocateParticle();
      if (!spark) break;

      spark.type = 'SOUL_SPARK';
      spark.x = px;
      spark.y = py;
      spark.vx = (Math.random() - 0.5) * 15;
      spark.vy = -(35 + Math.random() * 45);
      spark.drag = 0.95;
      spark.gravity = -25;
      spark.life = 0;
      spark.maxLife = 1.2 + Math.random() * 0.4;
      spark.startSize = 4;
      spark.endSize = 1;
      spark.size = 4;
      spark.color = PALETTE.CURSED_ARCANE.AURA;
      spark.startAlpha = 0.9;
      spark.endAlpha = 0.0;
      spark.alpha = 0.9;
      spark.rotation = 0;
      spark.vRot = 0;
      spark.extra = angle;
    }
  }

  /**
   * Occult Shockwave Sigil for Death Sigil / Cursed Aura pulse.
   */
  public emitSigilShockwave(x: number, y: number, maxRadius: number = 180): void {
    const p = this.allocateParticle();
    if (p) {
      p.type = 'OCCULT_SEAL';
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.drag = 1.0;
      p.gravity = 0;
      p.life = 0;
      p.maxLife = 0.40;
      p.startSize = 15;
      p.endSize = maxRadius;
      p.size = 15;
      p.color = PALETTE.BLOOD_CRIMSON.FLASH;
      p.startAlpha = 0.95;
      p.endAlpha = 0.0;
      p.alpha = 0.95;
      p.rotation = 0;
      p.vRot = 3.0;
      p.extra = 1; // 1 = explosive shockwave ring
    }

    // Stamp scorched arcane crater
    this.emitSigilScorch(x, y, Math.min(maxRadius * 0.4, 45));
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

  /**
   * Render ground decals (persistent blood splatters, pools, lightning scorch, sigils)
   */
  public renderDecals(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = overrideVw ?? (camera as any).viewWidth ?? camera.viewportWidth;
    const vh = overrideVh ?? (camera as any).viewHeight ?? camera.viewportHeight;

    for (let i = 0; i < this.decalCapacity; i++) {
      const d = this.decals[i];
      if (!d.active) continue;

      const sx = d.x - camX;
      const sy = d.y - camY;
      const r = d.radius;

      // Frustum culling with generous margin
      if (sx < -r * 2 || sx > vw + r * 2 || sy < -r * 2 || sy > vh + r * 2) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, d.alpha));
      ctx.translate(sx, sy);
      ctx.rotate(d.rotation);

      switch (d.type) {
        case 'BLOOD_SPLATTER': {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          // Satellite micro-droplets
          ctx.beginPath();
          ctx.arc(r * 1.3, r * 0.4, r * 0.35, 0, Math.PI * 2);
          ctx.arc(-r * 1.1, -r * 0.5, r * 0.3, 0, Math.PI * 2);
          ctx.arc(r * 0.2, -r * 1.4, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'BLOOD_POOL': {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(0, 0, r, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
          ctx.beginPath();
          if (typeof ctx.ellipse === 'function') {
            ctx.ellipse(0, 0, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
          }
          ctx.fill();
          break;
        }

        case 'LIGHTNING_SCORCH': {
          ctx.fillStyle = 'rgba(8, 6, 12, 0.85)';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#2d3748';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (k * Math.PI) / 3 + 0.1;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.stroke();

          // Residual cyan electrical glow when fresh
          if (d.life < 1.0) {
            ctx.strokeStyle = `rgba(103, 232, 249, ${0.6 * (1.0 - d.life)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          break;
        }

        case 'SIGIL_SCORCH': {
          ctx.strokeStyle = 'rgba(15, 13, 26, 0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
          ctx.stroke();

          // 4 radial tick marks
          ctx.beginPath();
          for (let m = 0; m < 4; m++) {
            const ma = (m * Math.PI) / 2;
            ctx.moveTo(Math.cos(ma) * r * 0.5, Math.sin(ma) * r * 0.5);
            ctx.lineTo(Math.cos(ma) * r * 1.15, Math.sin(ma) * r * 1.15);
          }
          ctx.stroke();
          break;
        }
      }

      ctx.restore();
    }
  }

  public renderGround(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = overrideVw ?? (camera as any).viewWidth ?? camera.viewportWidth;
    const vh = overrideVh ?? (camera as any).viewHeight ?? camera.viewportHeight;

    for (let i = 0; i < this.activeCount; i++) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      if (p.type !== 'SPELL_CIRCLE' && p.type !== 'OCCULT_SEAL') continue;

      const sx = p.x - camX;
      const sy = p.y - camY;
      const r = p.size;

      // Culling
      if (sx < -r * 2 || sx > vw + r * 2 || sy < -r * 2 || sy > vh + r * 2) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);

      if (p.type === 'SPELL_CIRCLE') {
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
      } else if (p.type === 'OCCULT_SEAL') {
        if (p.extra === 0) {
          // Ceremonial Ascension Seal
          // Tier 1: Outer binding ring with tick marks
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let k = 0; k < 12; k++) {
            const ka = (k * Math.PI * 2) / 12;
            ctx.moveTo(Math.cos(ka) * r * 0.9, Math.sin(ka) * r * 0.9);
            ctx.lineTo(Math.cos(ka) * r * 1.08, Math.sin(ka) * r * 1.08);
          }
          ctx.stroke();

          // Tier 2: Mid counter-rotating ring
          ctx.save();
          ctx.rotate(-p.rotation * 1.8);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          // Inner hexagram
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const h1 = (h * 4 * Math.PI) / 6;
            const h2 = ((h + 1) * 4 * Math.PI) / 6;
            ctx.moveTo(Math.cos(h1) * r * 0.6, Math.sin(h1) * r * 0.6);
            ctx.lineTo(Math.cos(h2) * r * 0.6, Math.sin(h2) * r * 0.6);
          }
          ctx.stroke();
          ctx.restore();

          // Tier 3: Pulsing Void Eye Core
          const eyeR = Math.max(2, 10 + 4 * Math.sin(p.life * 7.0));
          ctx.fillStyle = PALETTE.CURSED_ARCANE.AURA;
          ctx.beginPath();
          ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Explosive Shockwave Ring with radial spikes
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const sa = (s * Math.PI * 2) / 8;
            ctx.moveTo(Math.cos(sa) * r * 0.8, Math.sin(sa) * r * 0.8);
            ctx.lineTo(Math.cos(sa) * r * 1.25, Math.sin(sa) * r * 1.25);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  public renderAir(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = overrideVw ?? (camera as any).viewWidth ?? camera.viewportWidth;
    const vh = overrideVh ?? (camera as any).viewHeight ?? camera.viewportHeight;

    for (let i = 0; i < this.activeCount; i++) {
      const idx = this.activeIndices[i];
      const p = this.pool[idx];

      if (p.type === 'SPELL_CIRCLE' || p.type === 'OCCULT_SEAL') continue; // Ground layer

      const sx = p.x - camX;
      const sy = p.y - camY;
      const s = p.size;

      // Frustum culling
      if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      switch (p.type) {
        case 'BLOOD_DROPLET': {
          ctx.fillStyle = p.color;
          const speed = Math.hypot(p.vx, p.vy);
          if (speed > 25) {
            ctx.translate(sx, sy);
            const angle = Math.atan2(p.vy, p.vx);
            ctx.rotate(angle);
            const len = s * (1.0 + Math.min(speed / 90, 2.8));
            ctx.beginPath();
            if (typeof ctx.ellipse === 'function') {
              ctx.ellipse(0, 0, len, Math.max(1, s * 0.65), 0, 0, Math.PI * 2);
            } else {
              ctx.arc(0, 0, len, 0, Math.PI * 2);
            }
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(sx, sy, s, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

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

          // 3D Cosine tumble illusion
          const tumbleW = Math.max(1, s * (Math.abs(Math.cos(p.rotation * 1.8)) * 0.85 + 0.3));
          const tumbleH = Math.max(1, s * (0.45 + 0.3 * Math.abs(Math.sin(p.rotation))));

          const archetype = (p.extra ?? 0) % 3;
          if (archetype === 0) {
            // Splinter sliver
            ctx.beginPath();
            ctx.moveTo(-tumbleW, 0);
            ctx.lineTo(0, -tumbleH * 0.5);
            ctx.lineTo(tumbleW, 0);
            ctx.lineTo(0, tumbleH * 0.5);
            ctx.closePath();
            ctx.fill();
          } else if (archetype === 1) {
            // Rib shard
            ctx.fillRect(-tumbleW * 0.5, -tumbleH * 0.5, tumbleW, tumbleH);
          } else {
            // Vertebra chunk with marrow dot
            ctx.fillRect(-tumbleW * 0.5, -tumbleH * 0.5, tumbleW, tumbleH * 0.8);
            ctx.fillStyle = '#4a3f35';
            ctx.fillRect(-tumbleW * 0.2, -tumbleH * 0.2, tumbleW * 0.4, tumbleH * 0.4);
          }
          break;
        }

        case 'SOUL_SPARK': {
          // Additive Lighter Halo & Blazing Core
          ctx.globalCompositeOperation = 'lighter';

          // Outer luminous glow
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s, 0, Math.PI * 2);
          ctx.fill();

          // Intense white core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, s * 0.38), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }

        case 'LIGHTNING_SEGMENT': {
          // Branching Abyssal Lightning Segment with Cyan/Violet Core & Corona
          ctx.globalCompositeOperation = 'lighter';

          const segDx = p.vx;
          const segDy = p.vy;

          // Electric Corona
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.2, p.size * 1.8);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + segDx, sy + segDy);
          ctx.stroke();

          // Blinding White Incandescent Core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(0.8, p.size * 0.6);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + segDx, sy + segDy);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
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
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Dedicated pre-entity contact drop shadow pass.
   * Renders grounded elliptical shadows beneath Player (18x7), Skeleton (14x5),
   * Ghoul (16x6), Death Knight (24x9), Banshee (floating diffuse), and Soul Gems.
   */
  public renderContactDropShadows(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: { position: { x: number; y: number }; isAlive: boolean },
    hordeManager: { getActiveEnemies(): readonly any[] },
    lootManager: { getActiveItems(): readonly any[] },
    elapsedTime: number,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = overrideVw ?? (camera as any).viewWidth ?? camera.viewportWidth;
    const vh = overrideVh ?? (camera as any).viewHeight ?? camera.viewportHeight;

    ctx.save();

    // 1. Soul Gems Contact Shadows (ground level at y + 8, ignoring vertical float oscillation)
    const activeItems = lootManager.getActiveItems();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < activeItems.length; i++) {
      const item = activeItems[i];
      if (!item.isAlive) continue;
      const gx = item.position.x - camX;
      const gy = item.position.y - camY + 8;
      if (gx < -20 || gx > vw + 20 || gy < -20 || gy > vh + 20) continue;

      const rawType = `${String((item as any).dropType || '')} ${String(item.type || '')}`.toLowerCase();
      let rx = 5;
      let ry = 2.5;
      if (rawType.includes('chest')) {
        rx = 11;
        ry = 5;
      } else if (rawType.includes('violet') || rawType.includes('ruby')) {
        rx = 7;
        ry = 3.2;
      }

      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.scale(rx, ry);
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
      }
      ctx.fill();
    }

    // 2. Horde Enemies Contact Shadows
    const activeEnemies = hordeManager.getActiveEnemies();
    for (let i = 0; i < activeEnemies.length; i++) {
      const enemy = activeEnemies[i];
      if (!enemy.isAlive) continue;
      const ex = enemy.x - camX;
      const ey = enemy.y - camY;
      if (ex < -40 || ex > vw + 40 || ey < -40 || ey > vh + 40) continue;

      const rawType = String(enemy.type || '').toUpperCase();
      if (rawType.includes('SKELETON')) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(ex, ey + 14, 14, 5, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(ex, ey + 14);
          ctx.scale(14, 5);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      } else if (rawType.includes('GHOUL')) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(ex, ey + 14, 16, 6, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(ex, ey + 14);
          ctx.scale(16, 6);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      } else if (rawType.includes('DEATH_KNIGHT') || rawType.includes('KNIGHT')) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(ex, ey + 22, 24, 9, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(ex, ey + 22);
          ctx.scale(24, 9);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      } else if (rawType.includes('BANSHEE')) {
        // Floating diffuse shadow: Banshee bobs vertically
        const yBob = Math.sin(elapsedTime * 3.0) * 3.0;
        const bScale = Math.max(0.65, 1.0 - yBob * 0.05);
        const bAlpha = Math.max(0.12, Math.min(0.40, 0.30 - yBob * 0.04));
        ctx.fillStyle = `rgba(26, 12, 46, ${bAlpha})`;
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(ex, ey + 18, 14 * bScale, 5 * bScale, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(ex, ey + 18);
          ctx.scale(14 * bScale, 5 * bScale);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      } else {
        // Fallback default shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(ex, ey + 14, 14, 5, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(ex, ey + 14);
          ctx.scale(14, 5);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      }
    }

    // 3. Player Contact Shadow (18x7)
    if (player.isAlive) {
      const px = player.position.x - camX;
      const py = player.position.y - camY + 16;
      if (px >= -30 && px <= vw + 30 && py >= -30 && py <= vh + 30) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        if (typeof ctx.ellipse === 'function') {
          ctx.ellipse(px, py, 18, 7, 0, 0, Math.PI * 2);
        } else {
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(18, 7);
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.restore();
        }
        ctx.fill();
      }
    }

    ctx.restore();
  }

  public renderLighting(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    scene: LightingSceneData,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    this.lighting.render(ctx, camera, scene, overrideVw, overrideVh);
  }
}

/**
 * Helper to safely create offscreen canvases without crashing in Node/Vitest.
 */
function safeCreateOffscreenCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

export interface LightingSceneData {
  player: {
    position: { x: number; y: number };
    stats?: { area?: number };
    isAlive: boolean;
  };
  weaponManager?: {
    getWeapon(id: string): any;
  };
  lootManager?: {
    getActiveItems(): readonly { position: { x: number; y: number }; type: any; isAlive: boolean }[];
  };
  elapsedTime: number;
}

/**
 * DynamicLightingEngine - Dual-pass offscreen lighting buffer & additive bloom engine.
 * Features:
 * - 960x540 offscreen canvas with ambient darkness + pre-baked viewport vignette
 * - Light carving pass via destination-out
 * - Player torch light (200px radial light with multi-frequency breathing flicker)
 * - Dynamic spell flashes: scythe arc, whole-screen lightning flash, sigil shockwave, soul orbiters
 * - Blitted to main canvas via source-over
 * - Followed by lighter additive bloom pass (warm amber bloom #f59e0b, cyan/white core, crimson ring)
 * - Strict restoration to source-over composite operation
 */
export class DynamicLightingEngine {
  public width: number;
  public height: number;
  public lightCanvas: HTMLCanvasElement | null = null;
  public lightCtx: CanvasRenderingContext2D | null = null;
  public vignetteCanvas: HTMLCanvasElement | null = null;
  public torchStencilCanvas: HTMLCanvasElement | null = null;
  public spellStencilCanvas: HTMLCanvasElement | null = null;
  public pointStencilCanvas: HTMLCanvasElement | null = null;

  public ambientDarkness: number = 0.84;
  public lightningFlash: number = 0;

  constructor(width: number = 960, height: number = 540) {
    this.width = width;
    this.height = height;
    this.initSurfaces();
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.initSurfaces();
  }

  public initSurfaces(): void {
    this.lightCanvas = safeCreateOffscreenCanvas(this.width, this.height);
    this.lightCtx = this.lightCanvas?.getContext('2d') ?? null;

    // 1. Pre-bake Viewport Edge Vignette (dynamically scaled: [250, 725]px at 1200x675)
    this.vignetteCanvas = safeCreateOffscreenCanvas(this.width, this.height);
    const vCtx = this.vignetteCanvas?.getContext('2d');
    if (vCtx && typeof vCtx.createRadialGradient === 'function') {
      const cx = this.width / 2;
      const cy = this.height / 2;
      // Scales to [250, 725]px at 1200x675, or [200, 580]px at 960x540
      const innerR = Math.round(this.width * 0.208);
      const outerR = Math.round(Math.hypot(cx, cy) * 1.05);
      const grad = vCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.65, 'rgba(8, 6, 12, 0.40)');
      grad.addColorStop(1, 'rgba(8, 6, 12, 0.70)');
      vCtx.fillStyle = grad;
      vCtx.fillRect(0, 0, this.width, this.height);
    }

    // 2. Pre-bake Torch Radial Stencil (512 x 512)
    this.torchStencilCanvas = safeCreateOffscreenCanvas(512, 512);
    const tCtx = this.torchStencilCanvas?.getContext('2d');
    if (tCtx && typeof tCtx.createRadialGradient === 'function') {
      const grad = tCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.30, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.72, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      tCtx.fillStyle = grad;
      tCtx.fillRect(0, 0, 512, 512);
    }

    // 3. Pre-bake Spell Flash Stencil (256 x 256)
    this.spellStencilCanvas = safeCreateOffscreenCanvas(256, 256);
    const sCtx = this.spellStencilCanvas?.getContext('2d');
    if (sCtx && typeof sCtx.createRadialGradient === 'function') {
      const grad = sCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }

    // 4. Pre-bake Point Light Stencil (128 x 128)
    this.pointStencilCanvas = safeCreateOffscreenCanvas(128, 128);
    const pCtx = this.pointStencilCanvas?.getContext('2d');
    if (pCtx && typeof pCtx.createRadialGradient === 'function') {
      const grad = pCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.40, 'rgba(0, 0, 0, 0.75)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 128, 128);
    }
  }

  public triggerLightningFlash(intensity: number = 0.45): void {
    this.lightningFlash = Math.max(this.lightningFlash, intensity);
  }

  public update(dt: number): void {
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);
    }
  }

  public reset(): void {
    this.lightningFlash = 0;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    scene: LightingSceneData,
    overrideVw?: number,
    overrideVh?: number
  ): void {
    const targetW = overrideVw ?? this.width;
    const targetH = overrideVh ?? this.height;
    if (overrideVw !== undefined && overrideVh !== undefined && targetW > 0 && targetH > 0 && (targetW !== this.width || targetH !== this.height)) {
      this.resize(targetW, targetH);
    }

    const camX = camera.renderX;
    const camY = camera.renderY;
    const vw = this.width;
    const vh = this.height;

    // Dual-pass offscreen lighting buffer
    if (this.lightCanvas && this.lightCtx) {
      const lCtx = this.lightCtx;

      // Pass 1A: Fill ambient darkness with lightning flash modulation
      const curAmbient = Math.max(0.35, Math.min(0.92, this.ambientDarkness - this.lightningFlash));
      lCtx.globalCompositeOperation = 'source-over';
      lCtx.globalAlpha = 1.0;
      lCtx.fillStyle = `rgba(8, 6, 12, ${curAmbient})`;
      lCtx.fillRect(0, 0, vw, vh);

      // Pass 1B: Blit pre-baked vignette
      if (this.vignetteCanvas) {
        lCtx.drawImage(this.vignetteCanvas, 0, 0);
      }

      // Pass 1C: Carve radial light holes via destination-out
      lCtx.globalCompositeOperation = 'destination-out';

      // 1. Player Torch Light (scaled to 250px for widened 1200x675 FOV with multi-frequency breathing flicker)
      const px = scene.player.position.x - camX;
      const py = scene.player.position.y - camY;
      const t = scene.elapsedTime;
      const flicker = 5.0 * Math.sin(t * 7.3) + 2.5 * Math.cos(t * 19.1) + 1.5 * Math.sin(t * 31.7);
      const baseTorch = this.width >= 1200 ? 250 : 200;
      let torchR = baseTorch + flicker;
      if (scene.player.stats?.area) {
        torchR *= Math.max(0.8, Math.min(1.6, Math.sqrt(scene.player.stats.area / 100)));
      }

      if (this.torchStencilCanvas) {
        lCtx.drawImage(this.torchStencilCanvas, px - torchR, py - torchR, torchR * 2, torchR * 2);
      } else {
        lCtx.beginPath();
        lCtx.arc(px, py, torchR, 0, Math.PI * 2);
        lCtx.fill();
      }

      // 2. Arcane Scythe Arc Illumination
      if (scene.weaponManager) {
        const scythe = scene.weaponManager.getWeapon('scythe');
        if (scythe && Array.isArray(scythe.activeSlashes)) {
          for (let i = 0; i < scythe.activeSlashes.length; i++) {
            const slash = scythe.activeSlashes[i];
            const midAngle = slash.angle;
            const midDist = slash.radius * 0.55;
            const lx = slash.x + Math.cos(midAngle) * midDist - camX;
            const ly = slash.y + Math.sin(midAngle) * midDist - camY;
            const lr = slash.radius * 1.25;
            const fade = slash.maxLife > 0 ? Math.max(0, 1.0 - slash.life / slash.maxLife) : 1.0;

            lCtx.globalAlpha = fade;
            if (this.spellStencilCanvas) {
              lCtx.drawImage(this.spellStencilCanvas, lx - lr, ly - lr, lr * 2, lr * 2);
            } else {
              lCtx.beginPath();
              lCtx.arc(lx, ly, lr, 0, Math.PI * 2);
              lCtx.fill();
            }
            lCtx.globalAlpha = 1.0;
          }
        }
      }

      // 3. Abyssal Lightning Point Lights & Whole-Screen Lightning Flash
      if (scene.weaponManager) {
        const lightning = scene.weaponManager.getWeapon('lightning');
        if (lightning && Array.isArray(lightning.activeBolts)) {
          for (let i = 0; i < lightning.activeBolts.length; i++) {
            const bolt = lightning.activeBolts[i];
            if (bolt.segments && Array.isArray(bolt.segments)) {
              for (let s = 0; s < bolt.segments.length; s++) {
                const seg = bolt.segments[s];
                const bx2 = seg.x2 - camX;
                const by2 = seg.y2 - camY;
                if (this.pointStencilCanvas) {
                  lCtx.drawImage(this.pointStencilCanvas, bx2 - 50, by2 - 50, 100, 100);
                }
              }
            }
          }
        }
      }

      // 4. Expanding Crimson Shockwave for Death Sigils / Cursed Aura
      if (scene.weaponManager) {
        const aura = scene.weaponManager.getWeapon('aura');
        if (aura && Array.isArray(aura.activeRings)) {
          for (let i = 0; i < aura.activeRings.length; i++) {
            const ring = aura.activeRings[i];
            const rx = ring.x - camX;
            const ry = ring.y - camY;
            const progress = ring.maxLife > 0 ? ring.life / ring.maxLife : 1.0;
            const ringR = Math.max(20, ring.maxRadius * progress);
            const ringFade = Math.max(0, 1.0 - progress);

            lCtx.globalAlpha = ringFade;
            if (this.spellStencilCanvas) {
              lCtx.drawImage(this.spellStencilCanvas, rx - ringR, ry - ringR, ringR * 2, ringR * 2);
            }
            lCtx.globalAlpha = 1.0;
          }
        }
      }

      // 5. Perimeter Lights for Soul Orbiters
      if (scene.weaponManager) {
        const orbiters = scene.weaponManager.getWeapon('orbiters');
        if (orbiters && Array.isArray(orbiters.skulls)) {
          for (let i = 0; i < orbiters.skulls.length; i++) {
            const skull = orbiters.skulls[i];
            const ox = skull.x - camX;
            const oy = skull.y - camY;
            if (this.pointStencilCanvas) {
              lCtx.drawImage(this.pointStencilCanvas, ox - 35, oy - 35, 70, 70);
            }
          }
        }
      }

      // 6. Soul Gems Shimmer Lights
      if (scene.lootManager) {
        const loot = scene.lootManager.getActiveItems();
        for (let i = 0; i < loot.length; i++) {
          const item = loot[i];
          if (!item.isAlive) continue;
          const rawType = `${String((item as any).dropType || '')} ${String(item.type || '')}`.toLowerCase();
          if (rawType.includes('ruby') || rawType.includes('violet') || rawType.includes('chest')) {
            const gx = item.position.x - camX;
            const gy = item.position.y - camY;
            if (gx >= -40 && gx <= vw + 40 && gy >= -40 && gy <= vh + 40) {
              const pulse = 0.5 + 0.3 * Math.sin(t * 9.4 + item.position.x);
              lCtx.globalAlpha = pulse;
              if (this.pointStencilCanvas) {
                lCtx.drawImage(this.pointStencilCanvas, gx - 25, gy - 25, 50, 50);
              }
              lCtx.globalAlpha = 1.0;
            }
          }
        }
      }

      // Reset offscreen composite op
      lCtx.globalCompositeOperation = 'source-over';
      lCtx.globalAlpha = 1.0;

      // Blit carved darkness veil to main canvas via source-over
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.lightCanvas, 0, 0);
      ctx.restore();
    }

    // Pass 2: Additive Bloom on Main Canvas via lighter
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Warm Amber Bloom for Player Torch (#f59e0b)
    const px = scene.player.position.x - camX;
    const py = scene.player.position.y - camY;
    const baseAmber = this.width >= 1200 ? 150 : 120;
    const amberR = baseAmber + 4.0 * Math.sin(scene.elapsedTime * 7.3);
    if (typeof ctx.createRadialGradient === 'function') {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, amberR);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
      grad.addColorStop(0.65, 'rgba(217, 119, 6, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - amberR, py - amberR, amberR * 2, amberR * 2);
    } else {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.beginPath();
      ctx.arc(px, py, amberR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Arcane Scythe Violet/Crimson Runic Bloom
    if (scene.weaponManager) {
      const scythe = scene.weaponManager.getWeapon('scythe');
      if (scythe && Array.isArray(scythe.activeSlashes)) {
        for (let i = 0; i < scythe.activeSlashes.length; i++) {
          const slash = scythe.activeSlashes[i];
          const midAngle = slash.angle;
          const lx = slash.x + Math.cos(midAngle) * slash.radius * 0.55 - camX;
          const ly = slash.y + Math.sin(midAngle) * slash.radius * 0.55 - camY;
          const lr = slash.radius;
          const bloomColor = slash.isEvolution ? 'rgba(229, 62, 62, 0.35)' : 'rgba(183, 148, 246, 0.30)';
          if (typeof ctx.createRadialGradient === 'function') {
            const sGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
            sGrad.addColorStop(0, bloomColor);
            sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = sGrad;
            ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
          }
        }
      }
    }

    // 3. Lightning Cyan/White Core Bloom
    if (scene.weaponManager) {
      const lightning = scene.weaponManager.getWeapon('lightning');
      if (lightning && Array.isArray(lightning.activeBolts)) {
        for (let i = 0; i < lightning.activeBolts.length; i++) {
          const bolt = lightning.activeBolts[i];
          if (bolt.segments && Array.isArray(bolt.segments)) {
            for (let s = 0; s < bolt.segments.length; s++) {
              const seg = bolt.segments[s];
              const bx = seg.x2 - camX;
              const by = seg.y2 - camY;
              if (typeof ctx.createRadialGradient === 'function') {
                const lGrad = ctx.createRadialGradient(bx, by, 0, bx, by, 60);
                lGrad.addColorStop(0, 'rgba(255, 255, 255, 0.70)');
                lGrad.addColorStop(0.35, 'rgba(103, 232, 249, 0.40)');
                lGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = lGrad;
                ctx.fillRect(bx - 60, by - 60, 120, 120);
              }
            }
          }
        }
      }
    }

    // 4. Expanding Crimson Shockwave for Cursed Aura
    if (scene.weaponManager) {
      const aura = scene.weaponManager.getWeapon('aura');
      if (aura && Array.isArray(aura.activeRings)) {
        for (let i = 0; i < aura.activeRings.length; i++) {
          const ring = aura.activeRings[i];
          const rx = ring.x - camX;
          const ry = ring.y - camY;
          const progress = ring.maxLife > 0 ? ring.life / ring.maxLife : 1.0;
          const r = Math.max(15, ring.maxRadius * progress);
          ctx.strokeStyle = `rgba(229, 62, 62, ${Math.max(0, 0.35 * (1.0 - progress))})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(rx, ry, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 5. Soul Orbiters Perimeter Glow
    if (scene.weaponManager) {
      const orbiters = scene.weaponManager.getWeapon('orbiters');
      if (orbiters && Array.isArray(orbiters.skulls)) {
        for (let i = 0; i < orbiters.skulls.length; i++) {
          const skull = orbiters.skulls[i];
          const ox = skull.x - camX;
          const oy = skull.y - camY;
          const oColor = orbiters.isEvolution ? 'rgba(229, 62, 62, 0.28)' : 'rgba(104, 211, 145, 0.28)';
          if (typeof ctx.createRadialGradient === 'function') {
            const oGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 35);
            oGrad.addColorStop(0, oColor);
            oGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = oGrad;
            ctx.fillRect(ox - 35, oy - 35, 70, 70);
          }
        }
      }
    }

    // Strict restoration of composite operation to source-over
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

