/**
 * Vector2D - Pure 2D vector mathematics for kinematics, physics, and aiming.
 * Zero external dependencies, fully decoupled from DOM/Canvas.
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface ReadonlyVector2D {
  readonly x: number;
  readonly y: number;
}

export class Vec2 implements Vector2D {
  constructor(public x: number = 0, public y: number = 0) {}

  static readonly ZERO: ReadonlyVector2D = Object.freeze({ x: 0, y: 0 });
  static readonly UP: ReadonlyVector2D = Object.freeze({ x: 0, y: -1 });
  static readonly DOWN: ReadonlyVector2D = Object.freeze({ x: 0, y: 1 });
  static readonly LEFT: ReadonlyVector2D = Object.freeze({ x: -1, y: 0 });
  static readonly RIGHT: ReadonlyVector2D = Object.freeze({ x: 1, y: 0 });

  static create(x: number = 0, y: number = 0): Vector2D {
    return { x, y };
  }

  static clone(v: Vector2D): Vector2D {
    return { x: v.x, y: v.y };
  }

  static set(out: Vector2D, x: number, y: number): Vector2D {
    out.x = x;
    out.y = y;
    return out;
  }

  static copy(out: Vector2D, src: Vector2D): Vector2D {
    out.x = src.x;
    out.y = src.y;
    return out;
  }

  static add(a: Vector2D, b: Vector2D): Vector2D {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static addInPlace(out: Vector2D, b: Vector2D): Vector2D {
    out.x += b.x;
    out.y += b.y;
    return out;
  }

  static sub(a: Vector2D, b: Vector2D): Vector2D {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static subInPlace(out: Vector2D, b: Vector2D): Vector2D {
    out.x -= b.x;
    out.y -= b.y;
    return out;
  }

  static scale(v: Vector2D, s: number): Vector2D {
    return { x: v.x * s, y: v.y * s };
  }

  static scaleInPlace(out: Vector2D, s: number): Vector2D {
    out.x *= s;
    out.y *= s;
    return out;
  }

  static dot(a: Vector2D, b: Vector2D): number {
    return a.x * b.x + a.y * b.y;
  }

  static cross(a: Vector2D, b: Vector2D): number {
    return a.x * b.y - a.y * b.x;
  }

  static lenSq(v: Vector2D): number {
    return v.x * v.x + v.y * v.y;
  }

  static len(v: Vector2D): number {
    return Math.hypot(v.x, v.y);
  }

  static distSq(a: Vector2D, b: Vector2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static dist(a: Vector2D, b: Vector2D): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static normalize(v: Vector2D): Vector2D {
    const l = Math.hypot(v.x, v.y);
    if (l === 0) {
      return { x: 0, y: 0 };
    }
    return { x: v.x / l, y: v.y / l };
  }

  static normalizeInPlace(out: Vector2D): Vector2D {
    const l = Math.hypot(out.x, out.y);
    if (l === 0) {
      out.x = 0;
      out.y = 0;
    } else {
      out.x /= l;
      out.y /= l;
    }
    return out;
  }

  static angle(v: Vector2D): number {
    return Math.atan2(v.y, v.x);
  }

  static fromAngle(radians: number, length: number = 1): Vector2D {
    return {
      x: Math.cos(radians) * length,
      y: Math.sin(radians) * length,
    };
  }

  static angleBetween(a: Vector2D, b: Vector2D): number {
    const dotVal = Vec2.dot(a, b);
    const lens = Vec2.len(a) * Vec2.len(b);
    if (lens === 0) return 0;
    const cosVal = Math.max(-1, Math.min(1, dotVal / lens));
    return Math.acos(cosVal);
  }

  static rotate(v: Vector2D, radians: number): Vector2D {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    };
  }

  static lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
    const clampedT = Math.max(0, Math.min(1, t));
    return {
      x: a.x + (b.x - a.x) * clampedT,
      y: a.y + (b.y - a.y) * clampedT,
    };
  }
}

// Convenient top-level functional exports matching common idioms
export const vec2 = Vec2.create;
export const vec2Add = Vec2.add;
export const vec2Sub = Vec2.sub;
export const vec2Scale = Vec2.scale;
export const vec2Dot = Vec2.dot;
export const vec2Normalize = Vec2.normalize;
export const vec2Dist = Vec2.dist;
export const vec2Angle = Vec2.angle;
export const vec2Rotate = Vec2.rotate;
export const vec2Lerp = Vec2.lerp;
