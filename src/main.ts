/**
 * Grim Harvest: Undead Siege - Main Game Assembly & Bootstrap.
 *
 * Dark Fantasy Horde Survival Architecture:
 * - Simulation: Fixed 60Hz timestep decoupled core
 * - Player: Top-down 360-degree dark sorcerer
 * - Horde: Pre-allocated object-pooled undead swarm (2,048 entities)
 * - Loot: Magnetic soul shard / gem collector (1,500 pool)
 * - Weapons: Automated occult arsenal with projectile pooling & intrusive hit memory
 * - Upgrades: 5 Weapons, 5 Passives, 5 Evolutions, rogue-lite card selection modal
 * - Director: 4-phase escalating wave director with perimeter off-screen spawning
 * - Input: KeyboardController & TouchVirtualPad
 * - Viewport: Camera tracking with screen shake & arena clamping
 */

import { Player } from './core/entities/Player';
import { HordeManager } from './core/HordeManager';
import { LootManager, LootDropType } from './core/systems/LootManager';
import { Camera } from './render/Camera';
import { KeyboardController } from './input/KeyboardController';
import { TouchVirtualPad } from './input/TouchVirtualPad';
import { GothicBackdrop } from './render/GothicBackdrop';
import { DarkFantasySprites } from './render/sprites/DarkFantasySprites';
import { DarkFantasyVFX } from './render/vfx/DarkFantasyVFX';
import { GothicHUD, HUDStateSnapshot } from './ui/GothicHUD';
import { WeaponManager } from './core/weapons/WeaponManager';
import { UpgradeSystem } from './core/systems/UpgradeSystem';
import { UpgradeModal } from './ui/UpgradeModal';
import { WaveDirector } from './core/systems/WaveDirector';

export class GrimHarvestGame {
  public static readonly VIRTUAL_WIDTH = 960;
  public static readonly VIRTUAL_HEIGHT = 540;
  public static readonly FIXED_TIMESTEP = 1 / 60; // 0.01667s

  public readonly player: Player;
  public readonly hordeManager: HordeManager;
  public readonly lootManager: LootManager;
  public readonly camera: Camera;
  public readonly keyboard: KeyboardController;
  public readonly touchPad: TouchVirtualPad;
  public readonly backdrop: GothicBackdrop;
  public readonly vfx: DarkFantasyVFX;
  public readonly hud: GothicHUD;

  public readonly weaponManager: WeaponManager;
  public readonly upgradeSystem: UpgradeSystem;
  public readonly upgradeModal: UpgradeModal;
  public readonly waveDirector: WaveDirector;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  private lastTime: number = 0;
  private accumulator: number = 0;
  public elapsedTime: number = 0;
  public killCount: number = 0;

  public isPaused: boolean = false;
  private pendingLevelUps: number = 0;

  constructor(container?: HTMLElement) {
    // 1. Core Simulation Systems
    this.player = new Player(0, 0, {
      maxHealth: 100,
      currentHealth: 100,
      moveSpeed: 200,
      armor: 0,
      magnetRadius: 100,
    });
    this.player.arenaBounds = {
      minX: -2000,
      maxX: 2000,
      minY: -2000,
      maxY: 2000,
    };

    this.hordeManager = new HordeManager({
      maxCapacity: 2048,
      cullDistance: 1800,
      worldBounds: { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000 },
    });

    this.lootManager = new LootManager(1500);

    // 2. Camera & Viewport
    this.camera = new Camera({
      viewportWidth: GrimHarvestGame.VIRTUAL_WIDTH,
      viewportHeight: GrimHarvestGame.VIRTUAL_HEIGHT,
      forwardLock: false,
      smoothSpeed: 8.0,
      bounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
    });

    // 3. Controllers
    this.keyboard = new KeyboardController();
    this.touchPad = new TouchVirtualPad();

    // 4. Gothic Render Engine & HUD
    this.backdrop = new GothicBackdrop({
      viewportWidth: GrimHarvestGame.VIRTUAL_WIDTH,
      viewportHeight: GrimHarvestGame.VIRTUAL_HEIGHT,
    });
    this.vfx = new DarkFantasyVFX(500);
    this.hud = new GothicHUD({
      virtualWidth: GrimHarvestGame.VIRTUAL_WIDTH,
      virtualHeight: GrimHarvestGame.VIRTUAL_HEIGHT,
    });
    DarkFantasySprites.initialize();

    // 5. Weapon and Upgrade Systems
    this.weaponManager = new WeaponManager(
      this.hordeManager,
      this.player,
      this.lootManager,
      this.vfx
    );
    this.upgradeSystem = new UpgradeSystem(this.player);
    this.upgradeModal = new UpgradeModal();

    // Wire Upgrade Modal Selection
    this.upgradeModal.onSelect = (card) => {
      this.upgradeSystem.applyUpgrade(card, this.player, this.weaponManager);
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);

      if (this.pendingLevelUps > 0) {
        this.openNextLevelUp(this.player.level);
      } else {
        this.upgradeModal.close();
        this.isPaused = false;
        this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.accumulator = 0;
      }
    };

    // Starter Weapon: Arcane Scythe Rank 1
    this.weaponManager.addWeapon('scythe', 1);
    this.upgradeSystem.addWeapon('weapon_scythe', 1);

    // 6. Escalating Wave Director
    this.waveDirector = new WaveDirector(this.hordeManager, {
      viewportWidth: GrimHarvestGame.VIRTUAL_WIDTH,
      viewportHeight: GrimHarvestGame.VIRTUAL_HEIGHT,
      spawnMargin: 90,
      arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
    });

    // 7. Level-up Event Listener
    this.player.progression.onLevelUp((event) => {
      this.handlePlayerLevelUp(event.newLevel);
    });

    // 8. Initial Swarm Deployment
    this.spawnInitialSwarm();

    // 9. DOM Mount
    if (container) {
      this.mount(container);
    }
  }

  private spawnInitialSwarm(): void {
    // Initial staggered perimeter wave
    this.hordeManager.spawnWave('SKELETON', 25, { x: 0, y: 0 }, 450);
    this.hordeManager.spawnWave('GHOUL', 10, { x: 0, y: 0 }, 600);
  }

  public handlePlayerLevelUp(newLevel: number): void {
    this.pendingLevelUps++;
    if (!this.upgradeModal.getIsOpen()) {
      this.openNextLevelUp(newLevel);
    }
  }

  private openNextLevelUp(level: number = this.player.level): void {
    const cards = this.upgradeSystem.generateUpgradeCards(3);
    this.isPaused = true;
    this.upgradeModal.open(cards, level, this.canvas ?? undefined);
  }

  public mount(container: HTMLElement): void {
    let canvas = container.querySelector<HTMLCanvasElement>('canvas#game-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      canvas.width = GrimHarvestGame.VIRTUAL_WIDTH;
      canvas.height = GrimHarvestGame.VIRTUAL_HEIGHT;
      container.appendChild(canvas);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.touchPad.mount(container);
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.touchPad.setVisible(isTouchDevice);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.accumulator = 0;

    const tickFrame = (now: number) => {
      if (!this.isRunning) return;

      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      if (!this.isPaused) {
        this.accumulator += dt;
        while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP) {
          this.step(GrimHarvestGame.FIXED_TIMESTEP);
          this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
        }
      } else {
        // Continue updating modal animations while simulation is frozen
        this.upgradeModal.update(dt);
      }

      this.render();

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tickFrame);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tickFrame);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public update(dt: number = GrimHarvestGame.FIXED_TIMESTEP): void {
    this.step(dt);
  }

  public step(dt: number = GrimHarvestGame.FIXED_TIMESTEP): void {
    this.elapsedTime += dt;

    // 1. Player Input
    const kbSnap = this.keyboard.getSnapshot();
    const touchSnap = this.touchPad.getSnapshot();

    const input = {
      up: kbSnap.up || touchSnap.up,
      down: kbSnap.down || touchSnap.down,
      left: kbSnap.left || touchSnap.left,
      right: kbSnap.right || touchSnap.right,
    };

    this.player.handleInput(input, dt);
    this.player.update(dt);

    // 2. Horde Simulation Update
    this.hordeManager.update(dt, this.player.position.x, this.player.position.y);

    // 3. Loot Collection & Magnetism Update
    this.lootManager.update(dt, this.player);

    // 4. Wave Director Escalation Spawning
    this.waveDirector.update(
      dt,
      this.player.position.x,
      this.player.position.y,
      this.camera.renderX,
      this.camera.renderY
    );

    // 5. Automated Occult Weaponry Update
    this.weaponManager.update(
      dt,
      this.player,
      this.hordeManager,
      this.lootManager,
      this.vfx
    );

    // 6. Contact Damage & Blood VFX
    const scratch = new Int32Array(32);
    const nearbyCount = this.hordeManager.getEnemiesInRadius(
      this.player.position.x,
      this.player.position.y,
      Player.COLLISION_RADIUS + 15,
      scratch
    );

    for (let i = 0; i < nearbyCount; i++) {
      const enemy = this.hordeManager.pool[scratch[i]];
      if (enemy && enemy.active && enemy.isAlive) {
        this.player.takeDamage(enemy.damage);
        this.vfx.emitBloodBurst(this.player.position.x, this.player.position.y, 3);
      }
    }

    // 7. Camera Tracking
    this.camera.update(this.player.position.x, this.player.position.y, dt);

    // 8. VFX Update & Loot Glints
    this.vfx.update(dt);
    this.vfx.updateLootGlints(this.lootManager.getActiveItems(), dt);

    // 9. Gothic HUD Update
    this.hud.update(dt, {
      player: {
        stats: this.player.stats,
        level: this.player.level,
        currentXP: this.player.currentXP,
        xpToNextLevel: this.player.xpToNextLevel,
        isAlive: this.player.isAlive,
        invulnerabilityTimer: this.player.invulnerabilityTimer,
        weapons: this.upgradeSystem.getWeaponsInventory(),
        passives: this.upgradeSystem.getPassivesInventory(),
      },
      hordeManager: this.hordeManager,
      elapsedTime: this.elapsedTime,
      killCount: this.killCount || this.hordeManager.totalKilled,
    });
  }

  public render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const w = GrimHarvestGame.VIRTUAL_WIDTH;
    const h = GrimHarvestGame.VIRTUAL_HEIGHT;
    const camX = this.camera.renderX;
    const camY = this.camera.renderY;

    // 1. Multi-Layer Gothic Parallax Backdrop
    this.backdrop.render(ctx, camX, camY, this.elapsedTime);

    // 2. Ground VFX (Decals, Persistent Spell Circles)
    this.vfx.renderGround(ctx, this.camera);

    // 3. Draw Loot Drops (Soul Gems) via DarkFantasySprites
    const activeLoot = this.lootManager.getActiveItems();
    for (const item of activeLoot) {
      if (!item.isAlive) continue;
      const screenX = item.position.x - camX;
      const screenY = item.position.y - camY;
      if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) continue;
      DarkFantasySprites.drawLoot(ctx, item, this.camera, this.elapsedTime);
    }

    // 4. Draw Undead Horde Entities via DarkFantasySprites
    const activeEnemies = this.hordeManager.getActiveEnemies();
    for (const enemy of activeEnemies) {
      if (!enemy.isAlive) continue;
      const screenX = enemy.x - camX;
      const screenY = enemy.y - camY;
      if (screenX < -40 || screenX > w + 40 || screenY < -40 || screenY > h + 40) continue;
      DarkFantasySprites.drawEnemy(ctx, enemy, this.camera, this.elapsedTime);
    }

    // 5. Draw Player (Dark Sorcerer) via DarkFantasySprites
    DarkFantasySprites.drawPlayer(ctx, this.player, this.camera, this.elapsedTime);

    // 5.5 Draw Occult Weapon Effects (Scythe slashes, Skulls, Lightning, Bone spears, Sigils)
    this.weaponManager.render(ctx, this.camera);

    // 6. Air VFX (Flying blood, bone chips, rising soul sparks, spell trails, glints)
    this.vfx.renderAir(ctx, this.camera);

    // 7. Foreground Atmospheric Mist Pass
    this.backdrop.renderForegroundMist(ctx, camX, camY, this.elapsedTime);

    // 8. Gothic HUD Overlay (Cracked Iron Vitality, XP Bar, Timer, Skull Kills, Inventory, Plaque)
    const hudSnapshot: HUDStateSnapshot = {
      player: {
        stats: this.player.stats,
        level: this.player.level,
        currentXP: this.player.currentXP,
        xpToNextLevel: this.player.xpToNextLevel,
        isAlive: this.player.isAlive,
        invulnerabilityTimer: this.player.invulnerabilityTimer,
        weapons: this.upgradeSystem.getWeaponsInventory(),
        passives: this.upgradeSystem.getPassivesInventory(),
      },
      hordeManager: this.hordeManager,
      elapsedTime: this.elapsedTime,
      killCount: this.killCount || this.hordeManager.totalKilled,
    };
    this.hud.render(ctx, hudSnapshot, GrimHarvestGame.FIXED_TIMESTEP);

    // 9. Gothic Level-Up Card Selection Modal Overlay
    if (this.upgradeModal.getIsOpen()) {
      this.upgradeModal.render(ctx, w, h);
    }
  }
}

// Auto-bootstrap when loaded in browser
if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('game-container') ?? document.body;
    const game = new GrimHarvestGame(container);
    game.start();
    (window as any).__game = game;
    (window as any).__GAME__ = game;
  });
}

// Backwards compatibility alias for old test suites or imports
export { GrimHarvestGame as FullMetalSlugGame };
export { LootDropType };
