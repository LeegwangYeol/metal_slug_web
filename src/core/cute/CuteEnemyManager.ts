/**
 * CuteEnemyManager.ts
 *
 * Simulates and spawns the 4 novel cute enemy archetypes:
 * 1. Marshmallow Slimes (bouncy ground hops, squash-and-stretch kinematics)
 * 2. Honey Bee Floaters (sine-wave aerial flight, sweet nectar drops)
 * 3. Donut Rollers (swift rolling physics, wall rebounds)
 * 4. Gummy Bear Colossus (massive boss with stomps and sneezes, splitting into 3 mini cubs on defeat)
 */

import { CuteEnemyType, CuteEnemyState } from './CuteGameTypes';
import { BubbleManager } from './BubbleManager';

export interface CuteEnemyInstance {
  id: string;
  type: CuteEnemyType;
  x: number;
  y: number;
  baseY: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  maxHealth: number;
  width: number;
  height: number;
  isAlive: boolean;
  isBubbled: boolean;
  bubbleId?: string;
  time: number;
  squashStretch: number;
  actionTimer: number;
  currentAction: string;
}

export class CuteEnemyManager {
  public readonly enemies: CuteEnemyInstance[] = [];
  private nextEnemyId: number = 1;

  // Boss tracking
  public isBossActive: boolean = false;
  public bossDefeated: boolean = false;

  // Callbacks
  public onEnemyBubbled?: (enemy: CuteEnemyInstance) => void;
  public onEnemyDefeated?: (enemy: CuteEnemyInstance) => void;
  public onBossDefeated?: () => void;
  public onShockwaveSpawned?: (x: number, y: number, dir: 1 | -1) => void;

  /**
   * Spawns an enemy of the specified archetype.
   */
  public spawnEnemy(
    type: CuteEnemyType,
    x: number,
    y: number,
    facing: 1 | -1 = -1
  ): CuteEnemyInstance {
    let hp = 1;
    let width = 24;
    let height = 24;
    let vx = 0;
    let vy = 0;

    switch (type) {
      case 'MARSHMALLOW_SLIME':
        hp = 1;
        width = 24;
        height = 20;
        vx = facing * 60;
        vy = -180;
        break;
      case 'HONEY_BEE':
        hp = 1;
        width = 22;
        height = 22;
        vx = facing * 50;
        vy = 0;
        break;
      case 'DONUT_ROLLER':
        hp = 2;
        width = 26;
        height = 26;
        vx = facing * 140;
        vy = 0;
        break;
      case 'GUMMY_COLOSSUS':
        hp = 250;
        width = 64;
        height = 72;
        vx = 0;
        vy = 0;
        this.isBossActive = true;
        break;
      case 'GUMMY_CUB':
        hp = 15;
        width = 24;
        height = 26;
        vx = facing * 80;
        vy = -160;
        break;
    }

    const enemy: CuteEnemyInstance = {
      id: `cute_${type.toLowerCase()}_${this.nextEnemyId++}`,
      type,
      x,
      y,
      baseY: y,
      vx,
      vy,
      facing,
      health: hp,
      maxHealth: hp,
      width,
      height,
      isAlive: true,
      isBubbled: false,
      time: 0,
      squashStretch: 1.0,
      actionTimer: 0,
      currentAction: 'idle',
    };

    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * Spawns a structured wave of cute foes across the Star Arena.
   */
  public spawnWave(waveNumber: number): CuteEnemyInstance[] {
    const spawned: CuteEnemyInstance[] = [];

    // Wave composition scales smoothly
    const slimeCount = 2 + waveNumber;
    const beeCount = 1 + Math.floor(waveNumber / 2);
    const rollerCount = waveNumber >= 2 ? 1 + Math.floor(waveNumber / 3) : 0;

    // Slimes spawn along ground platforms
    for (let i = 0; i < slimeCount; i++) {
      const spawnX = 250 + (i * 180) % 650;
      const facing = spawnX > 480 ? -1 : 1;
      spawned.push(this.spawnEnemy('MARSHMALLOW_SLIME', spawnX, 220, facing));
    }

    // Bees hover across mid/high skies
    for (let i = 0; i < beeCount; i++) {
      const spawnX = 180 + (i * 280) % 600;
      const spawnY = 90 + (i * 40);
      const facing = spawnX > 480 ? -1 : 1;
      spawned.push(this.spawnEnemy('HONEY_BEE', spawnX, spawnY, facing));
    }

    // Rollers speed along the lower deck
    for (let i = 0; i < rollerCount; i++) {
      const spawnX = i % 2 === 0 ? 80 : 880;
      const facing = spawnX > 480 ? -1 : 1;
      spawned.push(this.spawnEnemy('DONUT_ROLLER', spawnX, 224, facing));
    }

    return spawned;
  }

  /**
   * Spawns the Gummy Bear Colossus Boss showdown.
   */
  public spawnColossusBoss(): CuteEnemyInstance {
    this.isBossActive = true;
    this.bossDefeated = false;
    return this.spawnEnemy('GUMMY_COLOSSUS', 720, 200, -1);
  }

  /**
   * Encases an enemy into a buoyant bubble.
   */
  public trapEnemyInBubble(enemyId: string, bubbleManager: BubbleManager): boolean {
    const enemy = this.enemies.find((e) => e.id === enemyId && e.isAlive && !e.isBubbled);
    if (!enemy) return false;

    enemy.isBubbled = true;
    const bubble = bubbleManager.trapEnemy(enemy.x, enemy.y, {
      id: enemy.id,
      type: enemy.type,
      maxHp: enemy.maxHealth,
      remainingHp: enemy.health,
      width: enemy.width,
      height: enemy.height,
      facing: enemy.facing,
    });
    enemy.bubbleId = bubble.id;

    if (this.onEnemyBubbled) {
      this.onEnemyBubbled(enemy);
    }

    return true;
  }

  /**
   * Applies damage to an enemy.
   */
  public damageEnemy(enemyId: string, amount: number, bubbleManager?: BubbleManager): boolean {
    const enemy = this.enemies.find((e) => e.id === enemyId && e.isAlive);
    if (!enemy) return false;

    enemy.health -= amount;
    if (enemy.health <= 0) {
      enemy.health = 0;

      // If Colossus boss reaches 0 HP, split into 3 Mini Gummy Cubs!
      if (enemy.type === 'GUMMY_COLOSSUS') {
        enemy.isAlive = false;
        this.splitColossusIntoMiniCubs(enemy.x, enemy.y);
      } else {
        if (bubbleManager && !enemy.isBubbled) {
          // Trap or burst into bubble on defeat
          this.trapEnemyInBubble(enemy.id, bubbleManager);
        }
        enemy.isAlive = false;
      }

      if (this.onEnemyDefeated) {
        this.onEnemyDefeated(enemy);
      }

      // Check if all cubs and boss are defeated
      if (this.isBossActive && !this.enemies.some((e) => e.isAlive && (e.type === 'GUMMY_COLOSSUS' || e.type === 'GUMMY_CUB'))) {
        this.isBossActive = false;
        this.bossDefeated = true;
        if (this.onBossDefeated) {
          this.onBossDefeated();
        }
      }

      return true;
    }

    // If enemy took damage and is unbubbled, auto-encase on low health or hit
    if (bubbleManager && !enemy.isBubbled && enemy.type !== 'GUMMY_COLOSSUS') {
      this.trapEnemyInBubble(enemy.id, bubbleManager);
    }

    return false;
  }

  /**
   * Splits defeated Gummy Bear Colossus into 3 bouncy Mini Gummy Cubs.
   */
  private splitColossusIntoMiniCubs(x: number, y: number): void {
    const cub1 = this.spawnEnemy('GUMMY_CUB', x - 32, y - 10, -1);
    const cub2 = this.spawnEnemy('GUMMY_CUB', x, y - 20, 1);
    const cub3 = this.spawnEnemy('GUMMY_CUB', x + 32, y - 10, -1);
    cub1.vy = -240;
    cub2.vy = -280;
    cub3.vy = -220;
  }

  /**
   * Updates all active cute enemies.
   */
  public update(dt: number, bounds = { minX: 20, maxX: 940, groundY: 230 }, bubbleManager?: BubbleManager): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.isAlive) {
        this.enemies.splice(i, 1);
        continue;
      }

      // If bubbled, position is pinned to the bubble
      if (e.isBubbled && e.bubbleId && bubbleManager) {
        const bubble = bubbleManager.bubbles.find((b) => b.id === e.bubbleId && b.isAlive);
        if (bubble) {
          e.x = bubble.x;
          e.y = bubble.y;
          continue;
        } else {
          // Bubble popped! Enemy is defeated
          e.isAlive = false;
          this.enemies.splice(i, 1);
          if (this.isBossActive && !this.enemies.some((enemy) => enemy.isAlive && (enemy.type === 'GUMMY_COLOSSUS' || enemy.type === 'GUMMY_CUB'))) {
            this.isBossActive = false;
            this.bossDefeated = true;
            if (this.onBossDefeated) {
              this.onBossDefeated();
            }
          }
          continue;
        }
      }

      e.time += dt;

      switch (e.type) {
        case 'MARSHMALLOW_SLIME':
          this.updateMarshmallowSlime(e, dt, bounds);
          break;
        case 'HONEY_BEE':
          this.updateHoneyBee(e, dt, bounds);
          break;
        case 'DONUT_ROLLER':
          this.updateDonutRoller(e, dt, bounds);
          break;
        case 'GUMMY_COLOSSUS':
          this.updateGummyColossus(e, dt, bounds);
          break;
        case 'GUMMY_CUB':
          this.updateGummyCub(e, dt, bounds);
          break;
      }
    }
  }

  private updateMarshmallowSlime(e: CuteEnemyInstance, dt: number, bounds: any): void {
    // Gravity
    e.vy += 600 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Ground bounce
    if (e.y >= bounds.groundY) {
      e.y = bounds.groundY;
      e.vy = -220; // Bouncy hop
      e.squashStretch = 0.65; // Squash on impact
    } else {
      // Elastic stretch recovery
      e.squashStretch += (1.0 - e.squashStretch) * 8 * dt;
    }

    // Rebound at boundaries
    if (e.x <= bounds.minX) {
      e.x = bounds.minX;
      e.facing = 1;
      e.vx = Math.abs(e.vx);
    } else if (e.x >= bounds.maxX) {
      e.x = bounds.maxX;
      e.facing = -1;
      e.vx = -Math.abs(e.vx);
    }
  }

  private updateHoneyBee(e: CuteEnemyInstance, dt: number, bounds: any): void {
    // Sine-wave hovering flight
    e.x += e.vx * dt;
    e.y = e.baseY + Math.sin(e.time * 3.0) * 35;

    // Rebound horizontally
    if (e.x <= bounds.minX + 20) {
      e.x = bounds.minX + 20;
      e.facing = 1;
      e.vx = Math.abs(e.vx);
    } else if (e.x >= bounds.maxX - 20) {
      e.x = bounds.maxX - 20;
      e.facing = -1;
      e.vx = -Math.abs(e.vx);
    }
  }

  private updateDonutRoller(e: CuteEnemyInstance, dt: number, bounds: any): void {
    // Swift rolling along ground
    e.y = bounds.groundY - 2;
    e.x += e.vx * dt;

    if (e.x <= bounds.minX + 10) {
      e.x = bounds.minX + 10;
      e.facing = 1;
      e.vx = Math.abs(e.vx);
    } else if (e.x >= bounds.maxX - 10) {
      e.x = bounds.maxX - 10;
      e.facing = -1;
      e.vx = -Math.abs(e.vx);
    }
  }

  private updateGummyColossus(e: CuteEnemyInstance, dt: number, bounds: any): void {
    e.actionTimer += dt;

    // Colossus attacks cyclically every 3.0s
    if (e.actionTimer >= 3.0) {
      e.actionTimer = 0;
      const attackType = Math.floor(Math.random() * 3);

      if (attackType === 0) {
        // Ground Stomp
        e.currentAction = 'stomp';
        if (this.onShockwaveSpawned) {
          this.onShockwaveSpawned(e.x - 20, bounds.groundY, -1);
          this.onShockwaveSpawned(e.x + 20, bounds.groundY, 1);
        }
      } else if (attackType === 1) {
        // Sneeze Attack
        e.currentAction = 'sneeze';
      } else {
        // Belly Flop Leap
        e.currentAction = 'leap';
        e.vy = -260;
        e.vx = e.facing * 90;
      }
    }

    // Physics
    if (e.y < bounds.groundY) {
      e.vy += 500 * dt;
      e.y += e.vy * dt;
      e.x += e.vx * dt;
    } else {
      e.y = bounds.groundY;
      e.vy = 0;
      e.vx = 0;
    }

    // Boundary clamp
    if (e.x < 120) {
      e.x = 120;
      e.facing = 1;
    } else if (e.x > 840) {
      e.x = 840;
      e.facing = -1;
    }
  }

  private updateGummyCub(e: CuteEnemyInstance, dt: number, bounds: any): void {
    // Playful ground hops
    e.vy += 550 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (e.y >= bounds.groundY) {
      e.y = bounds.groundY;
      e.vy = -190;
    }

    if (e.x <= bounds.minX) {
      e.x = bounds.minX;
      e.facing = 1;
      e.vx = Math.abs(e.vx);
    } else if (e.x >= bounds.maxX) {
      e.x = bounds.maxX;
      e.facing = -1;
      e.vx = -Math.abs(e.vx);
    }
  }

  /**
   * Snapshots for renderer and state inspection.
   */
  public toStates(): CuteEnemyState[] {
    return this.enemies.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      vx: e.vx,
      vy: e.vy,
      facing: e.facing,
      health: e.health,
      maxHealth: e.maxHealth,
      isBubbled: e.isBubbled,
      bubbleId: e.bubbleId,
      animationState: e.currentAction,
      squashStretch: e.squashStretch,
      isAlive: e.isAlive,
    }));
  }
}
