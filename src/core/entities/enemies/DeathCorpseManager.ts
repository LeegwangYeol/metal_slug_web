/**
 * DeathCorpseManager.ts - Decoupled Visual Corpse and Casualty Simulation.
 *
 * Simulates high-impact multi-frame death animations and ballistic physics:
 * 1. Standard Falling Death: Stagger, knee buckle, and backward ground collapse.
 * 2. Explosion Blowback: Ballistic parabolic air launch (vy=-300, vx=±200), rotational tumbling
 *    (8.5 rad/s), detached flying Stahlhelm helmet, ground bounce, and dust puffs.
 * 3. Flamethrower Burning Death: Agonized thrashing with flame particles, charred charcoal silhouette
 *    with glowing embers, and crumbling ash collapse.
 *
 * Decoupled from living GameEntities so SoldierEnemy.isAlive becomes false immediately,
 * honoring entity collection and unit test invariants while presenting authentic arcade animations.
 */

import { GameEngine } from '../../engine/GameEngine';
import { EnemyType, SoldierRole, EnemyDeathType, EnemyDeathEvent } from './EnemyTypes';


export interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface DetachedHelmet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  isGrounded: boolean;
}

export interface ActiveDeathCorpse {
  id: string;
  enemyType: EnemyType;
  role: SoldierRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  deathType: EnemyDeathType;
  elapsedTime: number;
  duration: number;
  rotation: number;
  angularVelocity: number;
  isGrounded: boolean;
  groundY: number;
  alpha: number;
  frame: number;
  stage?: 'thrash' | 'charcoal' | 'ash';
  helmet?: DetachedHelmet;
  particles: DeathParticle[];
}

export interface RenderCorpseState {
  id: string;
  deathType: EnemyDeathType;
  x: number;
  y: number;
  facing: 1 | -1;
  rotation: number;
  alpha: number;
  frame: number;
  stage?: 'thrash' | 'charcoal' | 'ash';
  isGrounded: boolean;
  helmet?: {
    x: number;
    y: number;
    rotation: number;
  };
  particles: {
    x: number;
    y: number;
    color: string;
    size: number;
  }[];
}

export class DeathCorpseManager {
  private activeCorpses: ActiveDeathCorpse[] = [];
  private static readonly MAX_CORPSES = 32;
  private static readonly MAX_PARTICLES_PER_CORPSE = 16;
  private nextCorpseId = 1;

  constructor(engine?: GameEngine) {
    if (engine) {
      engine.eventBus.on('enemy_death', (event: EnemyDeathEvent) => {
        this.spawnCorpse(event);
      });
    }
  }

  /**
   * Spawns an authentic visual corpse simulation upon enemy casualty.
   */
  public spawnCorpse(event: EnemyDeathEvent): ActiveDeathCorpse {
    // If pool is saturated, remove oldest corpse
    if (this.activeCorpses.length >= DeathCorpseManager.MAX_CORPSES) {
      this.activeCorpses.shift();
    }

    const groundY = event.position.y + 38; // feet surface
    const id = `corpse_${this.nextCorpseId++}_${event.id}`;

    let corpse: ActiveDeathCorpse;

    switch (event.deathType) {
      case 'explosion': {
        // Determine blast impulse direction
        let dir: 1 | -1 = event.facing === 1 ? -1 : 1;
        if (event.origin) {
          dir = event.position.x >= event.origin.x ? 1 : -1;
        }


        const initialExplosionParticles: DeathParticle[] = [];
        for (let i = 0; i < 4; i++) {
          initialExplosionParticles.push({
            x: event.position.x - 4 + Math.random() * 8,
            y: event.position.y + Math.random() * 16,
            vx: (Math.random() - 0.5) * 80,
            vy: -50 - Math.random() * 50,
            color: i % 2 === 0 ? '#FFA010' : '#404040',
            size: 2.5,
            life: 0.5,
            maxLife: 0.5,
          });
        }

        corpse = {
          id,
          enemyType: event.type,
          role: event.role,
          x: event.position.x,
          y: event.position.y,
          vx: dir * 200,
          vy: -300, // High ballistic launch
          facing: dir,
          deathType: 'explosion',
          elapsedTime: 0,
          duration: 1.10,
          rotation: 0,
          angularVelocity: dir * 8.5, // Rapid 8.5 rad/s air tumble
          isGrounded: false,
          groundY,
          alpha: 1.0,
          frame: 0,
          helmet: {
            x: event.position.x + (dir === 1 ? -4 : 4),
            y: event.position.y - 12,
            vx: dir * 240,
            vy: -360, // Helmet flies higher and faster
            rotation: 0,
            angularVelocity: dir * 18.0,
            isGrounded: false,
          },
          particles: initialExplosionParticles,
        };
        break;
      }

      case 'fire': {
        const initialFireParticles: DeathParticle[] = [];
        for (let i = 0; i < 5; i++) {
          initialFireParticles.push({
            x: event.position.x - 6 + Math.random() * 12,
            y: event.position.y - 10 + Math.random() * 24,
            vx: (Math.random() - 0.5) * 30,
            vy: -50 - Math.random() * 50,
            color: ['#FFF060', '#FFA010', '#E84800'][i % 3],
            size: 3,
            life: 0.5,
            maxLife: 0.5,
          });
        }

        corpse = {
          id,
          enemyType: event.type,
          role: event.role,
          x: event.position.x,
          y: event.position.y,
          vx: 0,
          vy: 0,
          facing: event.facing,
          deathType: 'fire',
          elapsedTime: 0,
          duration: 1.30,
          rotation: 0,
          angularVelocity: 0,
          isGrounded: true,
          groundY,
          alpha: 1.0,
          frame: 0,
          stage: 'thrash',
          particles: initialFireParticles,
        };
        break;
      }


      case 'standard':
      default: {
        corpse = {
          id,
          enemyType: event.type,
          role: event.role,
          x: event.position.x,
          y: event.position.y,
          vx: -event.facing * 20, // Hit stagger recoil
          vy: 0,
          facing: event.facing,
          deathType: 'standard',
          elapsedTime: 0,
          duration: 0.70,
          rotation: 0,
          angularVelocity: 0,
          isGrounded: true,
          groundY,
          alpha: 1.0,
          frame: 0,
          particles: [],
        };
        break;
      }
    }

    this.activeCorpses.push(corpse);
    return corpse;
  }

  /**
   * Advances corpse kinematics, ballistic arcs, ground impacts, and particle systems.
   */
  public update(dt: number): void {
    const remaining: ActiveDeathCorpse[] = [];

    for (const corpse of this.activeCorpses) {
      corpse.elapsedTime += dt;
      if (corpse.elapsedTime >= corpse.duration) {
        continue; // Expired
      }

      // Update by death classification
      if (corpse.deathType === 'explosion') {
        this.updateExplosionBlowback(corpse, dt);
      } else if (corpse.deathType === 'fire') {
        this.updateBurningDeath(corpse, dt);
      } else {
        this.updateStandardDeath(corpse, dt);
      }

      // Update active particles
      for (let i = corpse.particles.length - 1; i >= 0; i--) {
        const p = corpse.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          corpse.particles.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }

      remaining.push(corpse);
    }

    this.activeCorpses = remaining;
  }

  private updateStandardDeath(corpse: ActiveDeathCorpse, dt: number): void {
    // Stagger velocity decay
    corpse.vx *= Math.max(0, 1 - 10 * dt);
    corpse.x += corpse.vx * dt;

    // Frame progression: 0 (0-0.15s), 1 (0.15-0.30s), 2 (0.30-0.45s), 3 (0.45-0.70s)
    const t = corpse.elapsedTime;
    if (t < 0.15) {
      corpse.frame = 0;
    } else if (t < 0.30) {
      corpse.frame = 1;
    } else if (t < 0.45) {
      corpse.frame = 2;
    } else {
      corpse.frame = 3;
    }

    // Fade out in last 0.1s
    if (t > 0.60) {
      corpse.alpha = Math.max(0, (corpse.duration - t) / 0.10);
    }
  }

  private updateExplosionBlowback(corpse: ActiveDeathCorpse, dt: number): void {
    const gravity = 720; // px/s^2

    // 1. Soldier Air Physics & Tumbling
    if (!corpse.isGrounded) {
      corpse.vy += gravity * dt;
      corpse.x += corpse.vx * dt;
      corpse.y += corpse.vy * dt;
      corpse.rotation += corpse.angularVelocity * dt;

      // Ground impact check
      const footY = corpse.y + 30;
      if (footY >= corpse.groundY) {
        corpse.y = corpse.groundY - 30;
        corpse.isGrounded = true;
        // Bounce recoil
        corpse.vy = -corpse.vy * 0.25;
        corpse.vx *= 0.4;
        corpse.angularVelocity = 0;
        corpse.rotation = 0;

        // Spawn dust puff particles
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI * (0.8 + 0.4 * Math.random());
          const speed = 40 + 50 * Math.random();
          corpse.particles.push({
            x: corpse.x,
            y: corpse.groundY - 2,
            vx: Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed * 0.5,
            color: i % 2 === 0 ? '#C8B080' : '#887050',
            size: 2 + Math.random() * 2,
            life: 0.35,
            maxLife: 0.35,
          });
        }
      }
    } else {
      corpse.vx *= Math.max(0, 1 - 8 * dt);
      corpse.x += corpse.vx * dt;
      if (Math.abs(corpse.vy) > 10) {
        corpse.vy += gravity * dt;
        corpse.y += corpse.vy * dt;
        if (corpse.y + 30 >= corpse.groundY) {
          corpse.y = corpse.groundY - 30;
          corpse.vy = 0;
        }
      }
    }

    // 2. Detached Helmet Physics
    if (corpse.helmet) {
      const h = corpse.helmet;
      if (!h.isGrounded) {
        h.vy += gravity * 0.9 * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rotation += h.angularVelocity * dt;

        if (h.y + 6 >= corpse.groundY) {
          h.y = corpse.groundY - 6;
          h.vy = -h.vy * 0.35;
          h.vx *= 0.5;
          h.angularVelocity *= 0.5;
          if (Math.abs(h.vy) < 40) {
            h.isGrounded = true;
            h.vy = 0;
            h.angularVelocity = 0;
          }
        }
      } else {
        h.vx *= Math.max(0, 1 - 5 * dt);
        h.x += h.vx * dt;
      }
    }

    // Frame selection
    if (!corpse.isGrounded) {
      corpse.frame = 0; // Air tumbling
    } else {
      corpse.frame = corpse.elapsedTime > 0.75 ? 1 : 0; // Settled / scorched
    }

    // Alpha fade in last 0.15s
    if (corpse.elapsedTime > 0.95) {
      corpse.alpha = Math.max(0, (corpse.duration - corpse.elapsedTime) / 0.15);
    }
  }

  private updateBurningDeath(corpse: ActiveDeathCorpse, _dt: number): void {
    const t = corpse.elapsedTime;


    // Stage 1: Agonized Thrashing (0.0s - 0.65s)
    if (t < 0.65) {
      corpse.stage = 'thrash';
      corpse.frame = Math.floor(t * 8) % 2;

      // Continuously emit rising flame particles
      if (corpse.particles.length < DeathCorpseManager.MAX_PARTICLES_PER_CORPSE && Math.random() < 0.8) {
        const flameColors = ['#FFF060', '#FFA010', '#E84800', '#FF7700'];
        corpse.particles.push({
          x: corpse.x - 8 + Math.random() * 16,
          y: corpse.y - 10 + Math.random() * 24,
          vx: (Math.random() - 0.5) * 30,
          vy: -50 - Math.random() * 50,
          color: flameColors[Math.floor(Math.random() * flameColors.length)],
          size: 2 + Math.random() * 3,
          life: 0.28,
          maxLife: 0.28,
        });
      }
    }
    // Stage 2: Charred Charcoal Silhouette (0.65s - 0.95s)
    else if (t < 0.95) {
      corpse.stage = 'charcoal';
      corpse.frame = 0;

      // Emit rising dark smoke wisps
      if (corpse.particles.length < 8 && Math.random() < 0.4) {
        const smokeColors = ['#484848', '#303030', '#181818'];
        corpse.particles.push({
          x: corpse.x - 6 + Math.random() * 12,
          y: corpse.y - 5 + Math.random() * 15,
          vx: (Math.random() - 0.5) * 15,
          vy: -25 - Math.random() * 25,
          color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
          size: 3 + Math.random() * 3,
          life: 0.40,
          maxLife: 0.40,
        });
      }
    }
    // Stage 3: Ash Crumble & Dissolve (0.95s - 1.30s)
    else {
      corpse.stage = 'ash';
      corpse.frame = t < 1.10 ? 0 : 1;

      // Fade out alpha over final 0.20s
      if (t > 1.10) {
        corpse.alpha = Math.max(0, (corpse.duration - t) / 0.20);
      }
    }
  }

  /**
   * Retrieves render states for canvas rendering.
   */
  public getRenderStates(): RenderCorpseState[] {
    return this.activeCorpses.map((c) => ({
      id: c.id,
      deathType: c.deathType,
      x: c.x,
      y: c.y,
      facing: c.facing,
      rotation: c.rotation,
      alpha: c.alpha,
      frame: c.frame,
      stage: c.stage,
      isGrounded: c.isGrounded,
      helmet: c.helmet
        ? {
            x: c.helmet.x,
            y: c.helmet.y,
            rotation: c.helmet.rotation,
          }
        : undefined,
      particles: c.particles.map((p) => ({
        x: p.x,
        y: p.y,
        color: p.color,
        size: p.size,
      })),
    }));
  }

  /**
   * Returns current active corpse count.
   */
  public getCorpseCount(): number {
    return this.activeCorpses.length;
  }

  /**
   * Returns all active corpses (for test assertions).
   */
  public getActiveCorpses(): readonly ActiveDeathCorpse[] {
    return this.activeCorpses;
  }

  /**
   * Clears all corpses.
   */
  public clear(): void {
    this.activeCorpses = [];
  }
}
