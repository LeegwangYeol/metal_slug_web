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
  public static readonly MAX_SUB_STEPS = 5;

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
  private loopEpoch: number = 0;

  private lastTime: number = 0;
  private accumulator: number = 0;
  public elapsedTime: number = 0;
  public killCount: number = 0;
  public deathTimer: number = 0;
  public isVictory: boolean = false;

  public isPaused: boolean = false;
  private pendingLevelUps: number = 0;

  public get isGameOver(): boolean {
    return !this.player.isAlive;
  }

  public get deathDebounceTimer(): number {
    return this.deathTimer;
  }

  private readonly boundOnKeyDown: (e: KeyboardEvent) => void;
  private readonly boundOnCanvasClick: (e: MouseEvent) => void;
  private damageScratch = new Int32Array(64);

  constructor(container?: HTMLElement) {
    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.boundOnCanvasClick = this.handleCanvasClick.bind(this);

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
    this.vfx.emitLevelUpRune(this.player.position.x, this.player.position.y, 72, 2.4);
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

    if (this.canvas) {
      this.canvas.removeEventListener('click', this.boundOnCanvasClick);
      this.canvas.addEventListener('click', this.boundOnCanvasClick);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundOnKeyDown);
      window.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public destroy(): void {
    this.stop();
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.boundOnCanvasClick);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundOnKeyDown);
    }
    this.keyboard.detach();
    this.upgradeModal.close();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const currentEpoch = ++this.loopEpoch;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.accumulator = 0;

    const tickFrame = (now: number) => {
      if (!this.isRunning || this.loopEpoch !== currentEpoch) return;

      const rawDt = (now - this.lastTime) / 1000;
      const dt = Math.max(0, Math.min(rawDt, 0.1));
      this.lastTime = now;

      if (!this.isPaused && this.player.isAlive && !this.isVictory) {
        this.accumulator += dt;
        let subSteps = 0;
        while (
          this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP &&
          subSteps < GrimHarvestGame.MAX_SUB_STEPS
        ) {
          this.step(GrimHarvestGame.FIXED_TIMESTEP);
          this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
          subSteps++;
        }
        if (subSteps >= GrimHarvestGame.MAX_SUB_STEPS) {
          this.accumulator = 0; // Prevent infinite freeze death spiral
        }
      } else if (this.upgradeModal.getIsOpen()) {
        // Continue updating modal animations while simulation is frozen
        this.upgradeModal.update(dt);
      } else if (!this.player.isAlive || this.isVictory) {
        this.deathTimer += dt;
        this.vfx.update(dt);
      }

      this.render();

      if (this.isRunning && this.loopEpoch === currentEpoch && typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tickFrame);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tickFrame);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.loopEpoch++;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public canResurrect(): boolean {
    return (
      (!this.player.isAlive || this.isVictory) &&
      !this.upgradeModal.getIsOpen() &&
      this.deathTimer >= 0.5
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      if (this.canResurrect()) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        this.restart();
      }
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (this.canResurrect()) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      this.restart();
    }
  }

  public restart(): void {
    const wasRunning = this.isRunning;
    this.stop();

    // 1. Simulation clock & loop state
    this.elapsedTime = 0;
    this.killCount = 0;
    this.isPaused = false;
    this.isVictory = false;
    this.pendingLevelUps = 0;
    this.deathTimer = 0;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 2. Upgrade modal reset
    this.upgradeModal.reset();

    // 3. Player entity reset
    this.player.reset(0, 0);

    // 4. Horde manager & spatial grid reset
    this.hordeManager.reset();

    // 5. Loot drops purge
    this.lootManager.reset();

    // 6. Weapons reset (starter Rank 1 Arcane Scythe)
    this.weaponManager.reset('scythe', 1);

    // 7. Upgrade system reset (starter Rank 1 Arcane Scythe)
    this.upgradeSystem.reset('weapon_scythe', 1);

    // 8. Wave director reset (Phase 1, 0:00)
    this.waveDirector.reset();

    // 9. Camera & screen shake zeroing
    this.camera.reset(0, 0);
    this.camera.update(0, 0, 0);

    // 10. Particle VFX clear
    this.vfx.clear();

    // 11. HUD reset
    this.hud.reset();

    // 12. Input controllers reset
    this.keyboard.reset();
    this.touchPad.left = false;
    this.touchPad.right = false;
    this.touchPad.up = false;
    this.touchPad.down = false;
    this.touchPad.fire = false;
    this.touchPad.jump = false;
    this.touchPad.grenade = false;

    // 13. Re-spawn initial perimeter swarm
    this.spawnInitialSwarm();

    // 14. Restart simulation loop if active or mounted
    if (wasRunning || !!this.canvas) {
      this.start();
    }
  }

  public update(dt: number = GrimHarvestGame.FIXED_TIMESTEP): void {
    this.step(dt);
  }

  public step(dt: number = GrimHarvestGame.FIXED_TIMESTEP): void {
    if (!this.player.isAlive) {
      this.deathTimer += dt;
      const kbSnap = this.keyboard.getSnapshot();
      if ((kbSnap.jumpPressed || kbSnap.jumpHeld || this.keyboard.jump) && this.canResurrect()) {
        this.restart();
        return;
      }
      this.vfx.update(dt);
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
      return;
    }

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

    // 6. Contact Damage & Blood VFX (Two-Phase: Broadphase Grid Query + Narrowphase Exact Circle Overlap)
    const nearbyCount = this.hordeManager.getEnemiesInRadius(
      this.player.position.x,
      this.player.position.y,
      Player.COLLISION_RADIUS + 32,
      this.damageScratch
    );

    for (let i = 0; i < nearbyCount; i++) {
      const enemy = this.hordeManager.pool[this.damageScratch[i]];
      if (enemy && enemy.active && enemy.isAlive) {
        const dx = enemy.position.x - this.player.position.x;
        const dy = enemy.position.y - this.player.position.y;
        const distSq = dx * dx + dy * dy;
        const contactDist = Player.COLLISION_RADIUS + enemy.radius;
        if (distSq <= contactDist * contactDist + 1e-3) {
          const dealt = this.player.takeDamage(enemy.damage);
          if (dealt > 0) {
            this.vfx.emitBloodBurst(this.player.position.x, this.player.position.y, 3);
            this.vfx.emitBloodSplatter(this.player.position.x, this.player.position.y, 4);
          }
        }
      }
    }

    // 7. Camera Tracking (Centered with Velocity Lookahead)
    this.camera.update(
      this.player.position.x,
      this.player.position.y,
      dt,
      this.player.velocity.x,
      this.player.velocity.y
    );

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
    this.vfx.renderDecals(ctx, this.camera);
    this.vfx.renderGround(ctx, this.camera);

    // 3. Contact Drop Shadows (Pre-Entity Grounded Shadows Pass)
    this.vfx.renderContactDropShadows(
      ctx,
      this.camera,
      this.player,
      this.hordeManager,
      this.lootManager,
      this.elapsedTime
    );

    // 4. Draw Loot Drops (Soul Gems) via DarkFantasySprites
    const activeLoot = this.lootManager.getActiveItems();
    for (const item of activeLoot) {
      if (!item.isAlive) continue;
      const screenX = item.position.x - camX;
      const screenY = item.position.y - camY;
      if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) continue;
      DarkFantasySprites.drawLoot(ctx, item, this.camera, this.elapsedTime);
    }

    // 5. Draw Undead Horde Entities via DarkFantasySprites
    const activeEnemies = this.hordeManager.getActiveEnemies();
    for (const enemy of activeEnemies) {
      if (!enemy.isAlive) continue;
      const screenX = enemy.x - camX;
      const screenY = enemy.y - camY;
      if (screenX < -40 || screenX > w + 40 || screenY < -40 || screenY > h + 40) continue;
      DarkFantasySprites.drawEnemy(ctx, enemy, this.camera, this.elapsedTime);
    }

    // 6. Draw Player (Dark Sorcerer) via DarkFantasySprites
    DarkFantasySprites.drawPlayer(ctx, this.player, this.camera, this.elapsedTime);

    // 7. Occult Weapon Effects (Scythe slashes, Skulls, Lightning, Bone spears, Sigils)
    this.weaponManager.render(ctx, this.camera);

    // 8. Air VFX (Flying blood, bone chips, rising soul sparks, spell trails, glints)
    this.vfx.renderAir(ctx, this.camera);

    // 9. Foreground Atmospheric Mist Pass
    this.backdrop.renderForegroundMist(ctx, camX, camY, this.elapsedTime);

    // 10. Dynamic Lighting Pass (Dual-Pass Offscreen Carving + Additive Bloom)
    this.vfx.lighting.render(ctx, this.camera, {
      player: this.player,
      weaponManager: this.weaponManager,
      lootManager: this.lootManager,
      elapsedTime: this.elapsedTime,
    });

    // 11. Gothic HUD Overlay (Cracked Iron Vitality, XP Bar, Timer, Skull Kills, Inventory, Plaque)
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

    // 12. Gothic Level-Up Card Selection Modal Overlay
    if (this.upgradeModal.getIsOpen()) {
      this.upgradeModal.render(ctx, w, h);
    }
  }
}

// Auto-bootstrap when loaded in browser
if (typeof document !== 'undefined') {
  const bootstrap = () => {
    if ((window as any).__game) return;
    const container = document.getElementById('game-container') ?? document.body;
    const game = new GrimHarvestGame(container);
    game.start();
    (window as any).__game = game;
    (window as any).__GAME__ = game;
    (window as any).game = game;
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

// Backwards compatibility alias for old test suites or imports
export { GrimHarvestGame as FullMetalSlugGame };
export { LootDropType };
