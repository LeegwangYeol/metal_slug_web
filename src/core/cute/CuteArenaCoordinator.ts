/**
 * CuteArenaCoordinator.ts
 *
 * Master coordinator for "Sugar Pop Blossom: Cozy Star Arena".
 * Integrates:
 * - BubbleManager (traps, 6-shard bursts, cascade combos, candy drops, fever rush)
 * - PetCompanion (Mochi the Cloud Bunny follow, vacuum, heart bolts, bubble shield)
 * - ArenaPurificationManager (3 Blossom Altars, blooming garden)
 * - SweetPerkManager (3-card rogue-lite upgrades)
 * - CuteEnemyManager (marshmallow slimes, bees, donut rollers, gummy bear boss)
 * - State machine (INTRO -> WAVES <-> FEVER / PERKS -> BOSS SHOWDOWN -> GARDEN PURIFIED)
 */

import {
  CuteGameLoopState,
  RenderBubbleState,
  RenderPetState,
  RenderAltarState,
  RenderFeverState,
  RenderPerkCardState,
  RenderPickupState,
  CuteEnemyState,
} from './CuteGameTypes';
import { BubbleManager } from './BubbleManager';
import { PetCompanion } from './PetCompanion';
import { ArenaPurificationManager } from './ArenaPurificationManager';
import { SweetPerkManager } from './SweetPerkManager';
import { CuteEnemyManager } from './CuteEnemyManager';
import { Vector2D } from '../math/Vector2D';

export interface OrbitingBubble {
  angle: number;
  radius: number;
}

export interface SugarTrailParticle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  color: string;
}

export class CuteArenaCoordinator {
  public state: CuteGameLoopState = 'ARENA_INTRO';
  public stateTimer: number = 1.5; // 1.5s intro banner

  public readonly bubbleManager: BubbleManager;
  public readonly pet: PetCompanion;
  public readonly altars: ArenaPurificationManager;
  public readonly perks: SweetPerkManager;
  public readonly enemyManager: CuteEnemyManager;

  public waveNumber: number = 1;
  public maxWaves: number = 3;
  public score: number = 0;
  public time: number = 0;

  // Perk effects in play
  public orbitingBubbles: OrbitingBubble[] = [];
  public sugarTrails: SugarTrailParticle[] = [];

  // Callbacks
  public onScoreChanged?: (newScore: number, addedPoints: number, text?: string) => void;
  public onStateChanged?: (newState: CuteGameLoopState) => void;
  public onBannerAnnounce?: (bannerText: string) => void;

  constructor() {
    this.bubbleManager = new BubbleManager();
    this.pet = new PetCompanion(80, 190);
    this.altars = new ArenaPurificationManager();
    this.perks = new SweetPerkManager();
    this.enemyManager = new CuteEnemyManager();

    this.wireSubsystems();
  }

  private wireSubsystems(): void {
    // 1. Wire Bubble Score & Altars
    this.bubbleManager.onScoreAwarded = (points, _x, _y, text) => {
      this.score += points;
      if (this.onScoreChanged) {
        this.onScoreChanged(this.score, points, text);
      }
    };

    this.bubbleManager.onAltarInfluence = (x, y, combo) => {
      this.altars.onBubblePopped(x, y, combo);
    };

    this.bubbleManager.onFeverStateChange = (active) => {
      if (active) {
        this.pet.cheer(2.0);
        if (this.state === 'WAVE_ACTIVE') {
          this.setState('SWEET_FEVER');
        }
      } else {
        if (this.state === 'SWEET_FEVER') {
          this.setState('WAVE_ACTIVE');
        }
      }
    };

    // 2. Wire Altar Blooms to Perk Selection
    this.altars.onAltarBloomed = (altar) => {
      this.pet.cheer(1.5);
      if (this.onBannerAnnounce) {
        this.onBannerAnnounce(`★ ${altar.name.toUpperCase()} PURIFIED! ★`);
      }
      this.triggerPerkSelection();
    };

    this.altars.onGardenFullyBloomed = () => {
      if (this.onBannerAnnounce) {
        this.onBannerAnnounce('🌸 ENTIRE ARENA BLOOMED! FINAL SHOWDOWN APPROACHES! 🌸');
      }
    };

    // 3. Wire Pet Heart Bolt Hits
    this.pet.onHeartBoltHitEnemy = (bolt, enemy) => {
      this.enemyManager.damageEnemy(enemy.id, bolt.damage, this.bubbleManager);
    };

    // 4. Wire Boss Defeat
    this.enemyManager.onBossDefeated = () => {
      this.setState('GARDEN_PURIFIED');
      this.pet.cheer(4.0);
      if (this.onBannerAnnounce) {
        this.onBannerAnnounce('💖 VICTORY! THE COZY STAR ARENA IS SAVED! 💖');
      }
    };

    // 5. Wire Perk Acquisition to Concrete Stats
    this.perks.onPerkAcquired = (card, _level) => {
      switch (card.id) {
        case 'PET_PEP':
          this.pet.modifiers.speedMultiplier = 1.4;
          this.pet.modifiers.fireCooldownMultiplier = 0.55;
          break;
        case 'STAR_MAGNET':
          this.pet.modifiers.vacuumRadius = 320.0;
          break;
        case 'CUPCAKE_SHIELD':
          this.pet.modifiers.shieldCooldown = 6.0;
          this.pet.isShieldActive = true;
          break;
        case 'BUBBLE_ORBITERS':
          if (this.orbitingBubbles.length === 0) {
            this.orbitingBubbles.push(
              { angle: 0, radius: 52 },
              { angle: Math.PI, radius: 52 }
            );
          }
          break;
      }
    };
  }

  public setState(newState: CuteGameLoopState): void {
    this.state = newState;
    if (this.onStateChanged) {
      this.onStateChanged(newState);
    }
  }

  /**
   * Starts the 3-Card Rogue-Lite Perk Selection Modal.
   */
  public triggerPerkSelection(): void {
    this.perks.triggerPerkSelection();
    this.setState('PERK_SELECTION');
  }

  /**
   * Selects a perk card and resumes the action.
   */
  public choosePerk(index: number): boolean {
    if (!Number.isFinite(index)) return false;
    const card = this.perks.selectCard(index);
    if (card) {
      if (this.bubbleManager.isFeverActive) {
        this.setState('SWEET_FEVER');
      } else if (this.altars.isGardenFullyBloomed() && !this.enemyManager.bossDefeated) {
        this.setState('BOSS_SHOWDOWN');
        this.enemyManager.spawnColossusBoss();
      } else {
        this.setState('WAVE_ACTIVE');
      }
      return true;
    }
    return false;
  }

  /**
   * Called when the player presses shoot. Fires bubble blaster projectiles.
   */
  public onPlayerShoot(
    player: { x: number; y: number; facing: 1 | -1; isAlive: boolean },
    _aimAngle?: any,
    aimDirection?: Vector2D
  ): void {
    if (!player.isAlive || this.state === 'PERK_SELECTION') return;

    let dirX = aimDirection ? aimDirection.x : player.facing;
    let dirY = aimDirection ? aimDirection.y : 0;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= len;
    dirY /= len;

    const spawnX = player.x + dirX * 24;
    const spawnY = player.y - 12 + dirY * 24;
    const speed = 360;

    // Main Bubble Projectile
    this.bubbleManager.shootBubble(spawnX, spawnY, dirX * speed, dirY * speed);

    // If Rainbow Sprinkles perk is active or Fever is active: multi-spread!
    if (this.perks.hasPerk('RAINBOW_SPRINKLES') || this.bubbleManager.isFeverActive) {
      const angle = Math.atan2(dirY, dirX);
      const angleUp = angle - 0.26; // ~15 deg
      const angleDown = angle + 0.26;

      this.bubbleManager.shootBubble(
        spawnX,
        spawnY,
        Math.cos(angleUp) * speed * 0.9,
        Math.sin(angleUp) * speed * 0.9
      );
      this.bubbleManager.shootBubble(
        spawnX,
        spawnY,
        Math.cos(angleDown) * speed * 0.9,
        Math.sin(angleDown) * speed * 0.9
      );
    }
  }

  /**
   * Main discrete update step (deterministic headless 60Hz).
   */
  public update(
    dt: number,
    player: {
      x: number;
      y: number;
      facing: 1 | -1;
      isAlive: boolean;
      lives?: number;
      takeDamage?: (dmg: number) => void;
      position?: { x: number; y: number };
      bounds?: { x: number; y: number; width: number; height: number };
    }
  ): void {
    this.time += dt;

    // 1. State Machine Progression
    switch (this.state) {
      case 'ARENA_INTRO':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.setState('WAVE_ACTIVE');
          this.enemyManager.spawnWave(this.waveNumber);
          if (this.onBannerAnnounce) {
            this.onBannerAnnounce('★ WAVE 1: READY, POP & BLOOM! ★');
          }
        }
        break;

      case 'WAVE_ACTIVE':
      case 'SWEET_FEVER':
        // Check wave completion
        if (this.enemyManager.enemies.length === 0) {
          if (this.waveNumber < this.maxWaves) {
            this.waveNumber++;
            this.setState('WAVE_CLEARED');
            this.stateTimer = 2.0;
            this.pet.cheer(2.0);
            if (this.onBannerAnnounce) {
              this.onBannerAnnounce(`★ WAVE ${this.waveNumber - 1} CLEARED! ★`);
            }
          } else if (!this.enemyManager.bossDefeated && !this.enemyManager.isBossActive) {
            // All waves cleared -> Trigger Boss Showdown!
            this.setState('BOSS_SHOWDOWN');
            this.enemyManager.spawnColossusBoss();
            if (this.onBannerAnnounce) {
              this.onBannerAnnounce('★ GUMMY BEAR COLOSSUS HAS ARRIVED! ★');
            }
          }
        }
        break;

      case 'WAVE_CLEARED':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.setState('WAVE_ACTIVE');
          this.enemyManager.spawnWave(this.waveNumber);
          if (this.onBannerAnnounce) {
            this.onBannerAnnounce(`★ WAVE ${this.waveNumber} STARTS! ★`);
          }
        }
        break;

      case 'BOSS_SHOWDOWN':
        // Handled via enemyManager.onBossDefeated callback
        break;

      case 'GARDEN_PURIFIED':
        // Infinite joyful victory celebration loop
        break;

      case 'PERK_SELECTION':
        // Paused until card is picked
        return;
    }

    // 2. Update Subsystems
    this.bubbleManager.update(dt, player);
    this.altars.update(dt);
    this.pet.update(dt, player, this.bubbleManager, this.enemyManager.toStates());
    this.enemyManager.update(dt, { minX: 30, maxX: 930, groundY: 230 }, this.bubbleManager);

    // 3. Collision: Player Touching or Jumping on Trapped Bubbles
    const px = player.position?.x ?? player.x;
    const py = player.position?.y ?? player.y;
    if (player.isAlive) {
      const playerRadiusX = 18;
      const playerRadiusY = 24;
      const playerCenterY = py - 20;

      for (const b of this.bubbleManager.bubbles) {
        if (!b.isAlive || b.state !== 'TRAPPED') continue;

        const dx = Math.abs(px - b.x);
        const dy = Math.abs(playerCenterY - b.y);

        if (dx <= b.radius + playerRadiusX && dy <= b.radius + playerRadiusY) {
          this.bubbleManager.popBubble(b.id, px, py);
        }
      }
    }

    // 4. Collision: Player Bubble Projectiles Popping Trapped Bubbles
    for (const proj of this.bubbleManager.bubbles) {
      if (!proj.isAlive || proj.state !== 'FREE_PROJECTILE') continue;

      for (const trapped of this.bubbleManager.bubbles) {
        if (!trapped.isAlive || trapped.state !== 'TRAPPED' || trapped.id === proj.id) continue;

        const dx = proj.x - trapped.x;
        const dy = proj.y - trapped.y;
        const hitDist = proj.radius + trapped.radius;
        if (dx * dx + dy * dy <= hitDist * hitDist) {
          proj.isAlive = false;
          this.bubbleManager.popBubble(trapped.id, px, py);
          break;
        }
      }
    }

    // 5. Collision: Player Bubble Projectiles with Living Unbubbled Cute Enemies
    for (const b of this.bubbleManager.bubbles) {
      if (!b.isAlive || b.state !== 'FREE_PROJECTILE') continue;

      for (const e of this.enemyManager.enemies) {
        if (!e.isAlive || e.isBubbled) continue;

        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy <= (b.radius + 12) * (b.radius + 12)) {
          if (e.type === 'GUMMY_COLOSSUS') {
            // Boss resists direct bubble encasement: take damage and pop projectile instead
            this.enemyManager.damageEnemy(e.id, 1, this.bubbleManager);
            this.bubbleManager.popBubble(b.id);
            break;
          }

          // Trap enemy inside bubble!
          b.trapEnemy({
            id: e.id,
            type: e.type,
            maxHp: e.maxHealth,
            remainingHp: e.health,
            width: e.width,
            height: e.height,
            facing: e.facing,
          });
          e.isBubbled = true;
          e.bubbleId = b.id;
          break;
        }
      }
    }

    // 4. Update Orbiting Bubble Perk
    if (this.orbitingBubbles.length > 0) {
      for (const orb of this.orbitingBubbles) {
        orb.angle += dt * 4.2; // ~4 rad/s spin
        const orbX = player.x + Math.cos(orb.angle) * orb.radius;
        const orbY = player.y - 16 + Math.sin(orb.angle) * orb.radius;

        // Damage unbubbled enemies touching the orb
        for (const e of this.enemyManager.enemies) {
          if (!e.isAlive || e.isBubbled) continue;
          const dx = e.x - orbX;
          const dy = e.y - orbY;
          if (dx * dx + dy * dy <= 22 * 22) {
            this.enemyManager.damageEnemy(e.id, 1, this.bubbleManager);
          }
        }
      }
    }

    // 5. Update Sugar Dash Trail Perk
    if (this.perks.hasPerk('SUGAR_DASH_TRAIL')) {
      if (Math.random() < 0.35) {
        this.sugarTrails.push({
          x: player.x - player.facing * 12 + (Math.random() - 0.5) * 8,
          y: player.y + (Math.random() - 0.5) * 6,
          age: 0,
          maxAge: 0.8,
          color: Math.random() > 0.5 ? '#FBCFE8' : '#FEF08A',
        });
      }
    }

    for (let i = this.sugarTrails.length - 1; i >= 0; i--) {
      const trail = this.sugarTrails[i];
      trail.age += dt;
      if (trail.age >= trail.maxAge) {
        this.sugarTrails.splice(i, 1);
      }
    }

    // 6. Collision: Living Enemies vs Player
    if (player.isAlive && !this.bubbleManager.isFeverActive) {
      for (const e of this.enemyManager.enemies) {
        if (!e.isAlive || e.isBubbled) continue;

        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (dx * dx + dy * dy <= 20 * 20) {
          // Pet Bubble Shield absorbs hit if ready
          if (this.pet.tryAbsorbHit()) {
            if (this.onBannerAnnounce) {
              this.onBannerAnnounce('🫧 BUBBLE SHIELD ABSORBED HIT! 🫧');
            }
          } else if (player.takeDamage) {
            player.takeDamage(1);
          }
          break;
        }
      }
    }
  }

  // =========================================================================
  // RENDER GRAPH COMPILATION CONTRACTS
  // =========================================================================

  public getRenderBubbles(): RenderBubbleState[] {
    return this.bubbleManager.getRenderBubbles();
  }

  public getRenderPet(): RenderPetState {
    return this.pet.toRenderState();
  }

  public getRenderAltars(): RenderAltarState[] {
    return this.altars.toRenderStates();
  }

  public getRenderPickups(): RenderPickupState[] {
    return this.bubbleManager.getRenderPickups();
  }

  public getRenderFever(): RenderFeverState {
    return this.bubbleManager.getFeverState();
  }

  public getRenderPerkCards(): RenderPerkCardState[] {
    return this.perks.getRenderPerkCards();
  }

  public getCuteEnemyStates(): CuteEnemyState[] {
    return this.enemyManager.toStates();
  }
}
