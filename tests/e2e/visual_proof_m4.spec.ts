import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone 4: High-Resolution Visual Proof & Automated E2E Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');
  const MIN_ARTIFACT_SIZE = 250 * 1024; // Strictly > 250KB (256,000 bytes)

  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  // Use deviceScaleFactor: 2 for crisp, high-density retina captures (>250KB PNG files)
  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
  });

  /**
   * Helper: Mounts canvas, waits for complete engine bootstrap,
   * locks canvas CSS dimensions, and stops automatic rAF loop for deterministic rendering.
   */
  async function setupDeterministicGame(page: Page) {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return (
        g &&
        g.player &&
        g.camera &&
        g.hordeManager &&
        g.weaponManager &&
        g.lootManager &&
        g.upgradeSystem &&
        g.upgradeModal &&
        g.backdrop &&
        g.backdrop.isInitialized === true &&
        g.vfx &&
        g.hud
      );
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
      if (g && typeof g.stop === 'function') {
        g.stop();
      }
    });

    return { consoleErrors, pageErrors };
  }

  // =========================================================================
  // TEST 1: Visual Proof 1 — widened_fov_battlefield.png (>250KB)
  // =========================================================================
  test('Visual Proof 1: captures widened_fov_battlefield.png (>250KB, Z = 0.80, 1200x675 area, dynamic radial lighting, torch vignette)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    const fovVerified = await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Assert Camera Zoom & Expanded FOV Metrics (Z = 0.80 -> 1200x675 world area)
      const zoom = game.camera.zoom;
      const viewW = game.camera.viewWidth;
      const viewH = game.camera.viewHeight;

      // 2. Position player and center camera
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 92;
      game.player.stats.maxHealth = 100;
      game.player.level = 6;
      game.elapsedTime = 85.0; // 01:25 -> Phase III Nightfall Ascendant
      game.killCount = 312;

      game.camera.centerOn(0, 0);

      // 3. Populate massive, dense concentric undead horde spanning the full 1200x675 battlefield
      game.hordeManager.clear();
      // Inner ring: Skeletons & Ghouls (r = 160..280)
      game.hordeManager.spawnWave('SKELETON', 45, { x: 0, y: 0 }, 190);
      game.hordeManager.spawnWave('GHOUL', 35, { x: 0, y: 0 }, 270);
      // Middle ring: Gliding Banshees & Armored Death Knights (r = 340..460)
      game.hordeManager.spawnWave('BANSHEE', 25, { x: 0, y: 0 }, 360);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 16, { x: 0, y: 0 }, 440);
      // Perimeter flanks demonstrating wide 1200x675 viewport boundaries (x = ±520, y = ±280)
      game.hordeManager.spawnWave('SKELETON', 20, { x: -500, y: -260 }, 100);
      game.hordeManager.spawnWave('SKELETON', 20, { x: 500, y: -260 }, 100);
      game.hordeManager.spawnWave('GHOUL', 18, { x: -500, y: 260 }, 100);
      game.hordeManager.spawnWave('GHOUL', 18, { x: 500, y: 260 }, 100);

      // 4. Equip comprehensive occult arsenal across all weapon slots
      game.weaponManager.clear();
      game.weaponManager.addWeapon('scythe', 4);
      game.weaponManager.addWeapon('orbiters', 4);
      game.weaponManager.addWeapon('lightning', 3);
      game.weaponManager.addWeapon('spear', 3);
      game.weaponManager.addWeapon('aura', 3);

      game.upgradeSystem.addWeapon('weapon_scythe', 4);
      game.upgradeSystem.addWeapon('weapon_orbiters', 4);
      game.upgradeSystem.addWeapon('weapon_lightning', 3);
      game.upgradeSystem.addWeapon('weapon_spear', 3);
      game.upgradeSystem.addWeapon('weapon_aura', 3);
      game.upgradeSystem.addPassive('passive_might', 3);
      game.upgradeSystem.addPassive('passive_chalice', 2);

      // 5. Scatter shimmering soul gems, chests, and atmospheric ground decals
      game.lootManager.clear();
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', -140, 90, false);
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', 180, -110, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', -220, -150, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', 240, 130, false);
      game.lootManager.spawnDrop('RUBY_GEM', 80, 170, false);
      game.lootManager.spawnDrop('RUBY_GEM', -90, -190, false);
      game.lootManager.spawnDrop('SOUL_CHEST', -300, 200, false);
      game.lootManager.spawnDrop('SOUL_CHEST', 310, -210, false);

      // Decals and combat particles across the expanded flagstone arena
      game.vfx.emitSigilScorch(0, 0, 55);
      game.vfx.emitBloodPool(110, 60, 26);
      game.vfx.emitBloodPool(-120, -70, 22);
      game.vfx.emitBloodSplatter(140, 90, 12);
      game.vfx.emitBloodSplatter(-160, -80, 10);
      game.vfx.emitSoulBurst(0, 0, 16);
      game.vfx.emitSoulBurst(180, -110, 12);

      // 6. Synchronize Gothic HUD
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 92;
        game.hud.ghostHealth = 98;
        game.hud.displayXP = 68;
        game.hud.xpToNextLevel = 100;
        game.hud.currentLevel = 6;
      }

      // 7. Advance 10 simulation frames to settle physics, drop shadows, and lighting
      for (let i = 0; i < 10; i++) {
        game.step(1 / 60);
      }

      // 8. Force complete synchronous multi-pass render
      game.render();

      return {
        zoom,
        viewW,
        viewH,
        activeEnemies: game.hordeManager.getActiveCount(),
      };
    });

    expect(fovVerified.zoom).toBe(0.80);
    expect(fovVerified.viewW).toBe(1200);
    expect(fovVerified.viewH).toBe(675);
    expect(fovVerified.activeEnemies).toBeGreaterThanOrEqual(150);

    const targetPath = path.join(ARTIFACT_DIR, 'widened_fov_battlefield.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    expect(fs.existsSync(targetPath), 'widened_fov_battlefield.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `widened_fov_battlefield.png size (${stats.size} bytes) must be strictly > 250KB (${MIN_ARTIFACT_SIZE} bytes)`
    ).toBeGreaterThan(MIN_ARTIFACT_SIZE);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 2: Visual Proof 2 — modern_gothic_hud.png (>250KB)
  // =========================================================================
  test('Visual Proof 2: captures modern_gothic_hud.png (>250KB, ornate filigree HP bar, glowing soul-blue/amethyst XP, octagonal runic badge, antique gold chronometer & skull ledger)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Establish player in dramatic combat: taking damage to showcase amber ghost stagger bar
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 68; // Partial health -> blood meniscus + amber ghost bar visible
      game.player.stats.maxHealth = 100;
      game.player.level = 5;
      game.player.currentXP = 74;
      game.player.xpToNextLevel = 100;
      game.elapsedTime = 72.0; // Phase III: NIGHTFALL ASCENDANT
      game.killCount = 389; // Triggers anatomical skull glowing ruby eyes and severe swarm warning

      game.camera.centerOn(0, 0);

      // 2. Equip full 5-weapon arsenal with upgrades
      game.weaponManager.clear();
      const scythe = game.weaponManager.addWeapon('scythe', 4);
      const orbiters = game.weaponManager.addWeapon('orbiters', 4);
      const lightning = game.weaponManager.addWeapon('lightning', 3);
      game.weaponManager.addWeapon('spear', 3);
      game.weaponManager.addWeapon('aura', 2);

      game.upgradeSystem.addWeapon('weapon_scythe', 4);
      game.upgradeSystem.addWeapon('weapon_orbiters', 4);
      game.upgradeSystem.addWeapon('weapon_lightning', 3);
      game.upgradeSystem.addWeapon('weapon_spear', 3);
      game.upgradeSystem.addWeapon('weapon_aura', 2);
      game.upgradeSystem.addPassive('passive_might', 3);
      game.upgradeSystem.addPassive('passive_chalice', 2);
      game.upgradeSystem.addPassive('passive_tome', 1);

      // 3. Populate combat enemies surrounding player
      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 180);
      game.hordeManager.spawnWave('GHOUL', 25, { x: 0, y: 0 }, 260);
      game.hordeManager.spawnWave('BANSHEE', 20, { x: 0, y: 0 }, 340);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 10, { x: 0, y: 0 }, 420);

      // 4. Trigger active weapon VFX for maximum visual spectacle
      if (scythe) {
        (scythe as any).activeSlashes.push({
          x: 0,
          y: 0,
          angle: 0.25,
          radius: 120,
          arcAngle: (140 * Math.PI) / 180,
          life: 0.08,
          maxLife: 0.24,
          damage: 55,
        });
      }
      if (orbiters) {
        (orbiters as any).orbitAngle = 1.2;
      }
      if (lightning) {
        (lightning as any).activeBolts.push({
          segments: [
            { x1: 0, y1: 0, x2: 45, y2: -60 },
            { x1: 45, y1: -60, x2: 90, y2: -110 },
            { x1: 90, y1: -110, x2: 160, y2: -140 },
          ],
          life: 0.12,
          maxLife: 0.25,
          color: '#38bdf8',
        });
      }

      // Ground decals & particles
      game.vfx.emitSigilScorch(0, 0, 48);
      game.vfx.emitBloodPool(60, 40, 24);
      game.vfx.emitBloodSplatter(70, 50, 10);
      game.vfx.emitSoulBurst(120, -80, 14);

      // 5. Explicitly configure modern Gothic HUD state:
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 68;
        game.hud.ghostHealth = 88; // Ghost bar actively staggered!
        game.hud.displayXP = 74;
        game.hud.xpToNextLevel = 100;
        game.hud.currentLevel = 5;
        (game.hud as any).killScaleAnim = 1.25; // Kill punch active
      }

      // 6. Step 4 frames and force render
      for (let i = 0; i < 4; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'modern_gothic_hud.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    expect(fs.existsSync(targetPath), 'modern_gothic_hud.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `modern_gothic_hud.png size (${stats.size} bytes) must be strictly > 250KB (${MIN_ARTIFACT_SIZE} bytes)`
    ).toBeGreaterThan(MIN_ARTIFACT_SIZE);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 3: Visual Proof 3 — dynamic_motion_proof.png (>250KB)
  // =========================================================================
  test('Visual Proof 3: captures dynamic_motion_proof.png (>250KB, character dash/stretch Sx*Sy=1.0, weapon anticipation/follow-through, enemy walk bob & spectral hover)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    const motionVerified = await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Position player and trigger volume-conserving harmonic dash squash/stretch
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.velocity.x = 220; // High horizontal dash velocity
      game.player.velocity.y = -60;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 85;
      game.player.stats.maxHealth = 100;
      game.player.level = 4;
      game.elapsedTime = 54.0;
      game.killCount = 195;

      // Trigger volume-conserving harmonic squash/stretch: Sx = 1.35, Sy = 1 / 1.35 = 0.7407
      const initialSx = 1.35;
      const initialSy = 1.0 / initialSx;
      game.player.triggerSquashStretch(initialSx, initialSy);

      // Trigger 3-phase weapon attack anticipation / follow-through
      game.player.triggerAttack(0.40, 'scythe');
      if (game.player.attackAnim) {
        game.player.attackAnim.phase = 'release';
        game.player.attackAnim.recoilOffset.x = -6;
        game.player.attackAnim.recoilOffset.y = 2;
        game.player.attackAnim.weaponAngleOffset = 0.55;
      }

      game.camera.centerOn(0, 0);

      // 2. Deploy specialized enemies showcasing distinct motion modes:
      game.hordeManager.clear();

      // (A) Spectral Hover: Gliding Banshees with active dual incommensurate harmonic levitation
      const banshee1 = game.hordeManager.spawn('banshee', 120, -90);
      if (banshee1) {
        banshee1.hoverPhase = 1.85;
        banshee1.vx = -40;
        banshee1.vy = 20;
      }
      const banshee2 = game.hordeManager.spawn('banshee', -130, -110);
      if (banshee2) {
        banshee2.hoverPhase = 3.42;
        banshee2.vx = 45;
        banshee2.vy = 15;
      }

      // (B) Grounded Walk Bobbing: Skeletons and Ghouls with bi-harmonic gait and pelvic sway
      const skeleton1 = game.hordeManager.spawn('skeleton', -110, 80);
      if (skeleton1) {
        skeleton1.walkPhase = 2.15;
        skeleton1.vx = 65;
        skeleton1.vy = -30;
      }
      const ghoul1 = game.hordeManager.spawn('ghoul', 140, 90);
      if (ghoul1) {
        ghoul1.walkPhase = 4.30;
        ghoul1.vx = -70;
        ghoul1.vy = -40;
      }

      // (C) Flinch & Recoil: Damaged enemy taking cleave hit with angular stumble and hit flash
      const flinchKnight = game.hordeManager.spawn('death_knight', 75, -20);
      if (flinchKnight) {
        flinchKnight.flinchRot = 0.28;
        flinchKnight.squashX = 0.82;
        flinchKnight.squashY = 1.22;
        flinchKnight.flashTimer = 0.08;
      }

      // Additional horde formation for visual density
      game.hordeManager.spawnWave('SKELETON', 30, { x: -240, y: 0 }, 120);
      game.hordeManager.spawnWave('GHOUL', 25, { x: 240, y: 0 }, 120);

      // 3. Equip weapons with active slashing arc
      game.weaponManager.clear();
      const scythe = game.weaponManager.addWeapon('scythe', 4);
      game.weaponManager.addWeapon('orbiters', 3);
      if (scythe) {
        (scythe as any).activeSlashes.push({
          x: 20,
          y: -10,
          angle: 0.40,
          radius: 130,
          arcAngle: (150 * Math.PI) / 180,
          life: 0.06,
          maxLife: 0.22,
          damage: 60,
        });
      }

      // 4. Decals, flying blood chips, and spell trails
      game.vfx.emitBloodBurst(75, -20, 8);
      game.vfx.emitBloodSplatter(90, -10, 12);
      game.vfx.emitSoulBurst(75, -20, 10);
      game.vfx.emitSpellCircle(0, 0, 36, '#8b5cf6');

      // 5. Update HUD state
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 85;
        game.hud.ghostHealth = 92;
        game.hud.displayXP = 45;
        game.hud.xpToNextLevel = 75;
        game.hud.currentLevel = 4;
      }

      // 6. Step 2 frames to capture active dynamic motion state and render
      game.step(1 / 60);
      game.render();

      return {
        volumeProduct: game.player.squashScale.x * game.player.squashScale.y,
        scaleX: game.player.squashScale.x,
        scaleY: game.player.squashScale.y,
        attackActive: game.player.attackAnim?.active,
        bansheeHover: banshee1?.hoverPhase,
        flinchRot: flinchKnight?.flinchRot,
      };
    });

    // Verify mathematical volume conservation: Sx * Sy == 1.0
    expect(motionVerified.volumeProduct).toBeCloseTo(1.0, 3);
    expect(motionVerified.scaleX).toBeGreaterThan(1.0);
    expect(motionVerified.scaleY).toBeLessThan(1.0);
    expect(motionVerified.attackActive).toBe(true);

    const targetPath = path.join(ARTIFACT_DIR, 'dynamic_motion_proof.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    expect(fs.existsSync(targetPath), 'dynamic_motion_proof.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `dynamic_motion_proof.png size (${stats.size} bytes) must be strictly > 250KB (${MIN_ARTIFACT_SIZE} bytes)`
    ).toBeGreaterThan(MIN_ARTIFACT_SIZE);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 4: Visual Proof 4 — upgrade_modal_modern.png (>250KB)
  // =========================================================================
  test('Visual Proof 4: captures upgrade_modal_modern.png (>250KB, 4-tier rarity glassmorphic cards: Common, Rare, Epic, Legendary, specular sheen, procedural icons)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Establish rich dark fantasy background behind modal
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.level = 6;
      game.elapsedTime = 135.0; // 02:15 -> Phase III Nightfall Ascendant
      game.killCount = 380;
      game.camera.centerOn(0, 0);

      // Populate background combat
      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 35, { x: 0, y: 0 }, 220);
      game.hordeManager.spawnWave('GHOUL', 25, { x: 0, y: 0 }, 310);
      game.hordeManager.spawnWave('BANSHEE', 20, { x: 0, y: 0 }, 400);
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', -80, 60, false);
      game.lootManager.spawnDrop('RUBY_GEM', 110, -70, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', -130, -90, false);
      game.vfx.emitSigilScorch(0, 0, 44);
      game.vfx.emitBloodPool(70, 50, 20);

      // 2. Synthesize 4 cards covering all 4 glowing rarity tiers:
      // Card 0: COMMON (Silver / Ash) - Base weapon upgrade
      const commonCard = {
        id: 'card_scythe_2',
        itemType: 'weapon',
        itemId: 'weapon_scythe',
        name: 'Arcane Scythe',
        subtitle: 'Sweeping Cleave',
        category: 'weapon' as const,
        icon: 'scythe',
        currentRank: 1,
        previousRank: 1,
        newRank: 2,
        description: 'Expands the sweeping blade arc to 110° and increases cleave damage by +15.',
        statChangeDescription: '+15 Cleave Damage, +10px Reach',
        isEvolution: false,
      };

      // Card 1: RARE (Soul Emerald / Frost Cyan) - Occult Passive
      const rareCard = {
        id: 'card_might_3',
        itemType: 'passive',
        itemId: 'passive_might',
        name: 'Tome of Might',
        subtitle: 'Ancient Grimoire',
        category: 'passive' as const,
        icon: 'tome',
        currentRank: 2,
        previousRank: 2,
        newRank: 3,
        description: 'Ancient abyssal rites amplify all spell and occult strike damage by +15%.',
        statChangeDescription: '+15% Total Damage Multiplier',
        isEvolution: false,
      };

      // Card 2: EPIC (Arcane Amethyst) - High Rank Weapon (newRank = 5)
      const epicCard = {
        id: 'card_orbiters_5',
        itemType: 'weapon',
        itemId: 'weapon_orbiters',
        name: 'Soul Orbiters',
        subtitle: 'Necrotic Sentinel',
        category: 'weapon' as const,
        icon: 'orbiters',
        currentRank: 4,
        previousRank: 4,
        newRank: 5,
        description: 'Summons a 5th flaming soul orbiter with blazing rotational velocity and flame trail.',
        statChangeDescription: '+1 Flaming Orbiter, +20% Rotation Speed',
        isEvolution: false,
      };

      // Card 3: LEGENDARY (Celestial Molten Gold / Bloodflame) - Supreme Evolution
      const legendaryCard = {
        id: 'card_evolution_scythe',
        itemType: 'evolution',
        itemId: 'evolution_scythe',
        name: 'Soul Harvester',
        subtitle: 'Supreme Evolution',
        category: 'evolution' as const,
        icon: 'scythe',
        currentRank: 5,
        previousRank: 5,
        newRank: 6,
        description: 'Transcends the Arcane Scythe into a continuous 360° screen-clearing abyssal harvest with life drain.',
        statChangeDescription: '360° Continuous Cleave, 20% Life Leech',
        isEvolution: true,
      };

      const cards = [commonCard, rareCard, epicCard, legendaryCard];

      // 3. Open modal and configure interactive hover on Epic card
      game.isPaused = true;
      game.upgradeModal.open(cards, 6, game.canvas);
      game.upgradeModal.hoveredIndex = 2; // Hover on Epic card (Arcane Amethyst)
      game.upgradeModal.selectedIndex = 2;

      // Advance pulse animation timer to render traveling perimeter gleams & glass specular highlights
      game.upgradeModal.update(0.45);

      // 4. Force synchronous render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'upgrade_modal_modern.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    expect(fs.existsSync(targetPath), 'upgrade_modal_modern.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `upgrade_modal_modern.png size (${stats.size} bytes) must be strictly > 250KB (${MIN_ARTIFACT_SIZE} bytes)`
    ).toBeGreaterThan(MIN_ARTIFACT_SIZE);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 5: Visual Proof Forensic Invariant Audit (Existence, Size > 250KB, PNG Magic)
  // =========================================================================
  test('Visual Proof Audit: asserts all 4 required artifacts exist on disk, are valid high-res PNGs, and each strictly exceeds 250KB (256,000 bytes)', async () => {
    const requiredArtifacts = [
      'widened_fov_battlefield.png',
      'modern_gothic_hud.png',
      'dynamic_motion_proof.png',
      'upgrade_modal_modern.png',
    ];

    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const filename of requiredArtifacts) {
      const filePath = path.join(ARTIFACT_DIR, filename);

      // 1. File existence
      expect(fs.existsSync(filePath), `Artifact ${filename} must exist on disk`).toBe(true);

      // 2. Strict file size > 250KB (256,000 bytes)
      const stats = fs.statSync(filePath);
      expect(
        stats.size,
        `Artifact ${filename} size (${stats.size} bytes) must be strictly > 250KB (${MIN_ARTIFACT_SIZE} bytes)`
      ).toBeGreaterThan(MIN_ARTIFACT_SIZE);

      // 3. Valid PNG magic header bytes
      const buffer = fs.readFileSync(filePath);
      expect(
        buffer.subarray(0, 8).equals(pngMagic),
        `Artifact ${filename} must possess valid 8-byte PNG signature`
      ).toBe(true);

      // 4. High-resolution IHDR chunk dimensions (deviceScaleFactor: 2 -> 1920x1080)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `Artifact ${filename} width must be 1920 (deviceScaleFactor: 2)`).toBe(1920);
      expect(height, `Artifact ${filename} height must be 1080 (deviceScaleFactor: 2)`).toBe(1080);
    }
  });

  // =========================================================================
  // TEST 6: Automated Survival Loop, Modal Interaction & Zero Console Errors
  // =========================================================================
  test('Survival Loop & Error Gate: verifies clean 30s+ live survival loop, level-up card selection via hotkey Digit1, zero console errors, zero page crashes', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // Run active survival loop for 30 continuous seconds or until level-up modal handled
    let modalSelected = false;
    const startTime = Date.now();
    const MAX_WALL_MS = 60000;

    while (Date.now() - startTime < MAX_WALL_MS) {
      const state = await page.evaluate(() => {
        const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
        return {
          elapsedTime: g.elapsedTime,
          isAlive: g.player.isAlive,
          health: g.player.stats.currentHealth,
          kills: g.hordeManager.totalKilled,
          totalXP: g.player.progression.getTotalXP(),
          level: g.player.level,
          isModalOpen: g.upgradeModal?.getIsOpen?.() ?? false,
          isPaused: g.isPaused,
        };
      });

      expect(state.isAlive).toBe(true);
      expect(state.health).toBeGreaterThan(0);

      if (state.isModalOpen && !modalSelected) {
        expect(state.isPaused).toBe(true);

        // Select Boon Card 1 via authentic keypress 'Digit1'
        await page.keyboard.press('Digit1');
        await page.waitForTimeout(200);

        const postSelect = await page.evaluate(() => {
          const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
          return {
            isOpen: g.upgradeModal.getIsOpen(),
            isPaused: g.isPaused,
            level: g.player.level,
          };
        });

        expect(postSelect.isOpen).toBe(false);
        expect(postSelect.isPaused).toBe(false);
        modalSelected = true;
      }

      if (state.elapsedTime >= 30.0 && modalSelected) {
        break;
      }

      // Dynamic dodge steering: 8-directional window evaluation avoiding collision danger
      const steer = await page.evaluate(() => {
        const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const px = p.position.x;
        const py = p.position.y;
        const CANDIDATES = [
          { dx:  1,          dy:  0,          keys: { right: true,  left: false, up: false, down: false } },
          { dx:  0.7071068,  dy:  0.7071068,  keys: { right: true,  left: false, up: false, down: true  } },
          { dx:  0,          dy:  1,          keys: { right: false, left: false, up: false, down: true  } },
          { dx: -0.7071068,  dy:  0.7071068,  keys: { right: false, left: true,  up: false, down: true  } },
          { dx: -1,          dy:  0,          keys: { right: false, left: true,  up: false, down: false } },
          { dx: -0.7071068,  dy: -0.7071068,  keys: { right: false, left: true,  up: true,  down: false } },
          { dx:  0,          dy: -1,          keys: { right: false, left: false, up: true,  down: false } },
          { dx:  0.7071068,  dy: -0.7071068,  keys: { right: true,  left: false, up: true,  down: false } },
        ];

        const activeEnemies = g.hordeManager.getActiveEnemies();
        const activeLoot = g.lootManager.getActiveItems();
        const enemiesList: Array<{ x: number; y: number; speed: number }> = [];

        for (const e of activeEnemies) {
          if (!e.isAlive) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < 380) {
            enemiesList.push({ x: e.x, y: e.y, speed: e.speed || 65 });
          }
        }

        const distCenter = Math.hypot(px, py);
        let desiredDirX = 0.7071068;
        let desiredDirY = 0.7071068;
        if (distCenter >= 240) {
          const currentAngle = Math.atan2(py, px);
          const tanX = -Math.sin(currentAngle);
          const tanY = Math.cos(currentAngle);
          const targetRadius = 310;
          const radErr = Math.max(-1.0, Math.min(1.0, (distCenter - targetRadius) / targetRadius));
          const radX = -px / distCenter;
          const radY = -py / distCenter;
          const blendX = tanX + radX * radErr * 2.2;
          const blendY = tanY + radY * radErr * 2.2;
          const blendLen = Math.hypot(blendX, blendY) || 1;
          desiredDirX = blendX / blendLen;
          desiredDirY = blendY / blendLen;
        }

        let bestGemX = 0;
        let bestGemY = 0;
        let bestGemDist = Infinity;
        for (const item of activeLoot) {
          if (!item.isAlive) continue;
          const d = Math.hypot(item.position.x - px, item.position.y - py);
          if (d < bestGemDist && d < 320) {
            bestGemDist = d;
            bestGemX = item.position.x - px;
            bestGemY = item.position.y - py;
          }
        }

        let bestScore = -Infinity;
        let bestCandidate = CANDIDATES[0];

        for (const c of CANDIDATES) {
          let score = 0;
          const futureX = px + c.dx * 200 * 0.32;
          const futureY = py + c.dy * 200 * 0.32;

          for (const en of enemiesList) {
            const curDist = Math.hypot(px - en.x, py - en.y);
            const futDist = Math.hypot(futureX - en.x, futureY - en.y);
            const fdist = Math.min(curDist, futDist);
            if (fdist < 34) {
              score -= 800000;
            } else if (fdist < 60) {
              score -= 40000 * ((60 - fdist) / 60);
            }
          }

          const kdot = c.dx * desiredDirX + c.dy * desiredDirY;
          score += kdot * 180;

          if (bestGemDist < Infinity) {
            const gdot = c.dx * (bestGemX / bestGemDist) + c.dy * (bestGemY / bestGemDist);
            score += gdot * 100;
          }

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = c;
          }
        }

        return bestCandidate.keys;
      });

      if (steer.left) await page.keyboard.down('KeyA'); else await page.keyboard.up('KeyA');
      if (steer.right) await page.keyboard.down('KeyD'); else await page.keyboard.up('KeyD');
      if (steer.up) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
      if (steer.down) await page.keyboard.down('KeyS'); else await page.keyboard.up('KeyS');

      await page.waitForTimeout(120);
    }

    // Release all keys
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyS');

    // Final state assertions
    const finalReport = await page.evaluate(() => {
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
      return {
        elapsedTime: g.elapsedTime,
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        kills: g.hordeManager.totalKilled,
        level: g.player.level,
      };
    });

    expect(finalReport.elapsedTime).toBeGreaterThanOrEqual(30.0);
    expect(finalReport.isAlive).toBe(true);
    expect(finalReport.health).toBeGreaterThan(0);
    expect(modalSelected).toBe(true);

    // Strict zero error assertions
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
