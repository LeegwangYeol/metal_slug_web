# Automated Screenshot Protocol Specification — Dark Fantasy Horde Survival ("Grim Harvest: Undead Siege")

## Milestone M4: Automated E2E Playtesting & Hardening
**Document Author**: Explorer 3 (`explorer_df_m4_3`)  
**Target Test Suite**: `tests/e2e/horde_survival.spec.ts` (or `tests/e2e/dark_fantasy_visual_proof.spec.ts`)  
**Output Directory**: `artifacts/dark_fantasy/`  

---

## 1. Executive Summary & Objective

In accordance with `PROJECT.md` (§ 🧪 Rigorous Verification & Deployment Strategy) and `COLLABORATION.md` (§ 🎯 Acceptance Criteria Checklist), Milestone M4 requires high-resolution visual proof artifacts demonstrating the complete dark fantasy reboot. These artifacts must prove:
1. Gritty dark fantasy gothic aesthetic with overwhelming undead hordes.
2. Canvas-rendered gothic card selection modal with obsidian cards, gold filigree, and rank pips.
3. Active occult weapon visual effects and high-performance particle VFX.

Each screenshot artifact must be strictly validated for:
- **File presence**: Guaranteed existence in `artifacts/dark_fantasy/`.
- **Byte size threshold**: Strictly **> 50 KB** (> 51,200 bytes) to guarantee no blank/black screen or canvas initialization failure.
- **Aspect ratio and fidelity**: 960x540 virtual resolution, 1:1 pixel rendering, zero distortion.

---

## 2. Target Screenshot Artifact Matrix

| Artifact Path | Visual Focus | Key Systems Involved | Target Byte Size | Settle Timing |
| :--- | :--- | :--- | :--- | :--- |
| `artifacts/dark_fantasy/horde_swarm.png` | 130+ diverse undead swarming player beneath blood moon eclipse | `GothicBackdrop`, `DarkFantasySprites`, `HordeManager`, `GothicHUD` | > 150 KB | 10 simulation frames |
| `artifacts/dark_fantasy/level_up_modal.png` | 4 obsidian boon cards with gold filigree, category badges & rank pips | `UpgradeModal`, `UpgradeSystem`, `GothicHUD` | > 120 KB | 2 frames + 0.3s pulse |
| `artifacts/dark_fantasy/survival_gameplay.png` | All 5 occult weapons firing simultaneously + rich blood/soul/spell VFX | `WeaponManager` (5 weapons), `DarkFantasyVFX`, `LootManager` | > 180 KB | 3 simulation frames |

---

## 3. Playwright Test Environment & Viewport Configuration

### 3.1 Device & Viewport Settings
```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  viewport: { width: 960, height: 540 },
  deviceScaleFactor: 1,
});
```

### 3.2 Directory Initialization Pre-condition
Before capturing screenshots, the test suite must ensure the destination directory exists:
```typescript
const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');

test.beforeAll(() => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
});
```

### 3.3 Deterministic Game Initialization Helper
In `src/main.ts`, the game is exported to the browser global as `(window as any).__game`.
To avoid asynchronous animation frame drift and ensure pixel-perfect visual captures, Playwright tests should pause the real-time requestAnimationFrame loop and manually drive the fixed timestep step and render cycles:

```typescript
async function setupDeterministicGame(page: any) {
  // Capture console and unhandled page errors
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err: any) => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

  // Await window.__game bootstrap
  await page.waitForFunction(() => {
    const w = window as any;
    return (
      w.__game &&
      w.__game.player &&
      w.__game.hordeManager &&
      w.__game.backdrop &&
      w.__game.backdrop.isInitialized
    );
  }, { timeout: 10000 });

  // Set deterministic canvas display style and pause real-time RAF loop
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.style.width = '960px';
      canvas.style.height = '540px';
    }
    const game = (window as any).__game;
    if (game && typeof game.stop === 'function') {
      game.stop(); // Cease continuous requestAnimationFrame ticks
    }
  });

  return { consoleErrors, pageErrors };
}
```

---

## 4. Detailed Capture Protocols per Artifact

### Protocol 1: `artifacts/dark_fantasy/horde_swarm.png`

#### Composition & Visual Requirements:
- **Atmosphere & Backdrop**:
  - Sky gradient with Blood Moon Eclipse (corona glow, crimson rim, black core).
  - Distant gothic skyline with cathedral spires, pointed arches, and weathered cracks.
  - Ancient stone flagstone arena with mortar and cracked weathering.
  - Dynamic runic circles inscribed into the flagging.
  - Weathered tombstones (Celtic cross, rounded arch, obelisk, shattered slabs) and twisted dead trees.
  - Layered ground mist and atmospheric fog pass.
- **Horde Entities**:
  - Concentric multi-tier encirclement containing 130+ active undead entities.
  - Skeletons: Bleached ivory skulls, ribcages, glowing red eye sockets, rusted crossguard blades.
  - Ghouls: Hunched mottled necrotic green flesh, spinal spurs, snapping head, bile eyes.
  - Banshees: Translucent flowing violet shrouds, screaming hollow void visages.
  - Death Knights: Heavy spiked pauldrons, horned greathelm, glowing crimson visor slit, executioner greatsword.
- **Player**:
  - Dark Sorcerer in deep arcane hooded robe, ashwood staff with glowing crystal.
- **HUD**:
  - Top XP bar, Soul Level badge, cracked iron Vitality bar (85/100 HP with ghost health fill), timer `⟨ 01:05 ⟩`, subtitle `III. NIGHTFALL`, skull counter displaying `SWARM: 135+`.

#### Implementation Script:
```typescript
test('Visual Proof 1: Overwhelming undead horde swarm against gothic backdrop (horde_swarm.png)', async ({ page }) => {
  const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

  await page.evaluate(() => {
    const game = (window as any).__game;
    
    // 1. Position player and camera
    game.player.position.x = 0;
    game.player.position.y = 0;
    game.player.velocity.x = 0;
    game.player.velocity.y = 0;
    game.player.facingDirection = 1;
    game.player.stats.currentHealth = 85;
    game.player.stats.maxHealth = 100;

    game.camera.x = 0;
    game.camera.y = 0;
    game.camera.renderX = -480;
    game.camera.renderY = -270;

    // 2. Clear existing initial spawn
    game.hordeManager.clear();

    // 3. Multi-tier concentric swarm spawn (135+ total entities)
    game.hordeManager.spawnWave('SKELETON', 50, { x: 0, y: 0 }, 210);
    game.hordeManager.spawnWave('GHOUL', 35, { x: 0, y: 0 }, 300);
    game.hordeManager.spawnWave('BANSHEE', 25, { x: 0, y: 0 }, 380);
    game.hordeManager.spawnWave('DEATH_KNIGHT', 15, { x: 0, y: 0 }, 440);
    // Asymmetric right flank pressure
    game.hordeManager.spawnWave('SKELETON', 15, { x: 260, y: -80 }, 90);

    // 4. Set HUD state
    game.elapsedTime = 65.0; // Minute 1:05 -> Nightfall phase
    game.killCount = 142;
    (game.hud as any).isFirstUpdate = false;
    game.hud.displayHealth = 85;
    game.hud.ghostHealth = 95;
    game.hud.displayXP = 8;
    game.hud.xpToNextLevel = 25;
    game.hud.currentLevel = 2;

    // 5. Advance 10 frames to settle orientations and walk frames
    for (let i = 0; i < 10; i++) {
      game.step(1 / 60);
    }

    // 6. Force canvas render
    game.render();
  });

  const targetPath = path.join(ARTIFACT_DIR, 'horde_swarm.png');
  await page.screenshot({ path: targetPath, fullPage: false });

  // Assertions
  expect(fs.existsSync(targetPath), 'horde_swarm.png must exist').toBe(true);
  const stats = fs.statSync(targetPath);
  expect(stats.size, `horde_swarm.png size (${stats.size} bytes) must be > 50KB`).toBeGreaterThan(50 * 1024);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
```

---

### Protocol 2: `artifacts/dark_fantasy/level_up_modal.png`

#### Composition & Visual Requirements:
- **Background**:
  - Darkened combat scene with 88% vignetted scrim and radial gradient.
- **Modal Header**:
  - "SELECT THY OCCULT BOON" in Cinzel/Georgia gold filigree with drop shadow.
  - Subtitle: "Soul Level 4 Ascended — Claim a Relic of Ruin".
- **Cards (4 Obsidian Tablets)**:
  - Inset stone gradient (`#151122` to `#0b0813`), beveled border, iron corner rivets.
  - Keybind pills `[1]`, `[2]`, `[3]`, `[4]` in gold font.
  - Type badges: `WEAPON` (arcane purple), `PASSIVE` (necrotic green), `EVOLUTION` (blood crimson).
  - Procedural icon wells (Scythe, Orbiters, Tome of Might, Supreme Harvester).
  - Title and subtitle in bone ivory and gold.
  - 5 rank pips (active filled, upgrading pulsing, unreached dark).
  - Multi-line descriptive text.
  - Stat change box in necrotic spark green.
  - Claim button (`CLAIM BOON` highlighted in gold/crimson for hovered card, `Press [X]` on inactive).
- **Footer**:
  - Full keyboard & mouse instruction prompt.

#### Implementation Script:
```typescript
test('Visual Proof 2: Gothic level-up boon card selection modal (level_up_modal.png)', async ({ page }) => {
  const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

  await page.evaluate(() => {
    const game = (window as any).__game;

    // 1. Establish background scene
    game.player.position.x = 0;
    game.player.position.y = 0;
    game.player.level = 4;
    game.elapsedTime = 124.0;
    game.camera.renderX = -480;
    game.camera.renderY = -270;

    game.upgradeSystem.addWeapon('weapon_scythe', 3);
    game.upgradeSystem.addWeapon('weapon_orbiters', 2);
    game.upgradeSystem.addPassive('passive_might', 2);
    game.upgradeSystem.addPassive('passive_chalice', 1);

    game.hordeManager.clear();
    game.hordeManager.spawnWave('SKELETON', 20, { x: 0, y: 0 }, 280);
    game.hordeManager.spawnWave('GHOUL', 10, { x: 0, y: 0 }, 360);
    game.lootManager.spawnDrop(0, 50, 40);
    game.lootManager.spawnDrop(1, -70, -30);

    for (let i = 0; i < 2; i++) {
      game.step(1 / 60);
    }

    // 2. Generate 4 diverse cards
    const card1 = {
      id: 'card_scythe_4',
      itemType: 'weapon',
      itemId: 'weapon_scythe',
      name: 'Arcane Scythe',
      subtitle: 'Sweeping Cleave',
      category: 'weapon' as const,
      icon: 'scythe',
      currentRank: 3,
      previousRank: 3,
      newRank: 4,
      description: 'Sweeps a wider 140° cleave arc with +20 damage and increased reach.',
      statChangeDescription: '+20 Damage, +15px Radius',
      isEvolution: false,
    };

    const card2 = {
      id: 'card_orbiters_3',
      itemType: 'weapon',
      itemId: 'weapon_orbiters',
      name: 'Soul Orbiters',
      subtitle: 'Necrotic Shield',
      category: 'weapon' as const,
      icon: 'orbiters',
      currentRank: 2,
      previousRank: 2,
      newRank: 3,
      description: 'Summons an additional flaming skull orbiter incinerating nearby foes.',
      statChangeDescription: '+1 Orbiter, +15 Damage',
      isEvolution: false,
    };

    const card3 = {
      id: 'card_might_3',
      itemType: 'passive',
      itemId: 'passive_might',
      name: 'Tome of Might',
      subtitle: 'Occult Knowledge',
      category: 'passive' as const,
      icon: 'tome',
      currentRank: 2,
      previousRank: 2,
      newRank: 3,
      description: 'Empowers all occult spells with +15% total damage multiplier.',
      statChangeDescription: '+15% Might Damage',
      isEvolution: false,
    };

    const card4 = {
      id: 'card_evolution_scythe',
      itemType: 'evolution',
      itemId: 'evolution_scythe',
      name: 'Soul Harvester',
      subtitle: 'Supreme Evolution',
      category: 'evolution' as const,
      icon: 'scythe',
      currentRank: 4,
      previousRank: 4,
      newRank: 5,
      description: 'Transforms Arcane Scythe into a 360° full-screen harvest with life-drain.',
      statChangeDescription: '360° Cleave, 15% Life Shards',
      isEvolution: true,
    };

    const cards = [card1, card2, card3, card4];

    // 3. Open modal & set hover state
    game.isPaused = true;
    game.upgradeModal.open(cards, 4, game.canvas);
    game.upgradeModal.hoveredIndex = 0; // Highlight card 1
    game.upgradeModal.selectedIndex = 0;
    game.upgradeModal.update(0.3); // Animate glow

    // 4. Force render
    game.render();
  });

  const targetPath = path.join(ARTIFACT_DIR, 'level_up_modal.png');
  await page.screenshot({ path: targetPath, fullPage: false });

  // Assertions
  expect(fs.existsSync(targetPath), 'level_up_modal.png must exist').toBe(true);
  const stats = fs.statSync(targetPath);
  expect(stats.size, `level_up_modal.png size (${stats.size} bytes) must be > 50KB`).toBeGreaterThan(50 * 1024);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
```

---

### Protocol 3: `artifacts/dark_fantasy/survival_gameplay.png`

#### Composition & Visual Requirements:
- **Active Occult Weapons (All 5 Simultaneously Active)**:
  1. **Arcane Scythe**: Luminous purple cleave arc with shadow blur cutting through forward horde.
  2. **Soul Orbiters**: 5 flaming green spectral skulls with emerald halos, glowing cores, and dark eye sockets orbiting the player.
  3. **Abyssal Lightning**: Branching electrical lightning bolts with white inner electric cores and violet outer glow striking multiple enemy clusters.
  4. **Bone Spear**: 3 piercing bone spears with ivory shafts, sharp tips, and fading projectile trails.
  5. **Cursed Aura**: Expanding necrotic shockwave ring pulse.
- **Dynamic Particle VFX**:
  - Blood spray bursts (crimson droplets).
  - Bone chips flying from shattered skeletons.
  - Soul sparks rising from slain foes with sine-wave wobble.
  - Runic spell circle inscribed beneath player on stone floor.
  - 4-pointed gem glints glistening on ground loot.
- **Loot & Entities**:
  - Emerald, ruby, and violet faceted soul gems scattered with specular highlights.
  - Undead enemies with white/crimson damage flash timers active.
  - Player casting stance with staff and crystal core glow.
- **Gothic HUD**:
  - Equipped weapon inventory slots filled with Rank III badges.
  - Vitality bar at 72/100 with ghost health drain.
  - Elapsed timer `⟨ 01:35 ⟩` and 287 kills.

#### Implementation Script:
```typescript
test('Visual Proof 3: Active spell VFX and occult weapon arsenal combat (survival_gameplay.png)', async ({ page }) => {
  const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

  await page.evaluate(() => {
    const game = (window as any).__game;

    // 1. Position player and camera
    game.player.position.x = 0;
    game.player.position.y = 0;
    game.camera.renderX = -480;
    game.camera.renderY = -270;
    game.player.facingDirection = 1;
    game.player.stats.currentHealth = 72;
    game.player.stats.maxHealth = 100;
    game.elapsedTime = 95.0; // 01:35
    game.killCount = 287;

    // 2. Equip all 5 occult weapons at Rank 3+ in both systems
    game.weaponManager.clear();
    const scythe = game.weaponManager.addWeapon('scythe', 3);
    const orbiters = game.weaponManager.addWeapon('orbiters', 4);
    const lightning = game.weaponManager.addWeapon('lightning', 3);
    const spear = game.weaponManager.addWeapon('spear', 3);
    const aura = game.weaponManager.addWeapon('aura', 3);

    game.upgradeSystem.addWeapon('weapon_scythe', 3);
    game.upgradeSystem.addWeapon('weapon_orbiters', 4);
    game.upgradeSystem.addWeapon('weapon_lightning', 3);
    game.upgradeSystem.addWeapon('weapon_spear', 3);
    game.upgradeSystem.addWeapon('weapon_aura', 3);
    game.upgradeSystem.addPassive('passive_might', 2);

    // 3. Populate combat enemies
    game.hordeManager.clear();
    game.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 180);
    game.hordeManager.spawnWave('GHOUL', 20, { x: 0, y: 0 }, 260);
    game.hordeManager.spawnWave('BANSHEE', 15, { x: 0, y: 0 }, 340);
    game.hordeManager.spawnWave('DEATH_KNIGHT', 8, { x: 0, y: 0 }, 410);

    // 4. Trigger active visual effects for ALL 5 occult weapons:
    // (a) Arcane Scythe cleave arc
    (scythe as any).activeSlashes.push({
      x: 0,
      y: 0,
      angle: 0.2,
      radius: 110,
      arcAngle: (130 * Math.PI) / 180,
      life: 0.04,
      maxLife: 0.18,
      isDual: false,
      isEvolution: false,
    });

    // (b) Soul Orbiters skulls
    (orbiters as any).orbitAngle = 0.8;
    orbiters.syncSkulls();

    // (c) Abyssal Lightning arcs
    (lightning as any).activeBolts.push(
      {
        segments: [
          { x1: 0, y1: -10, x2: 70, y2: -60 },
          { x1: 70, y1: -60, x2: 120, y2: -90 },
          { x1: 120, y1: -90, x2: 175, y2: -110 },
          { x1: 120, y1: -90, x2: 160, y2: -40 },
        ],
        life: 0.03,
        maxLife: 0.14,
        isEvolution: false,
      },
      {
        segments: [
          { x1: 0, y1: -10, x2: -60, y2: -80 },
          { x1: -60, y1: -80, x2: -130, y2: -100 },
          { x1: -130, y1: -100, x2: -190, y2: -70 },
        ],
        life: 0.05,
        maxLife: 0.14,
        isEvolution: false,
      }
    );

    // (d) Bone Spears in flight with trails
    (spear as any).projectilePool.clear();
    const p1 = (spear as any).projectilePool.allocate();
    if (p1) {
      p1.x = 90; p1.y = 35; p1.vx = 450; p1.vy = 120;
      p1.rotation = Math.atan2(120, 450); p1.life = 0.2; p1.maxLife = 1.0;
      p1.damage = 60; p1.pierceRemaining = 3;
    }
    const p2 = (spear as any).projectilePool.allocate();
    if (p2) {
      p2.x = 110; p2.y = 0; p2.vx = 500; p2.vy = 0;
      p2.rotation = 0; p2.life = 0.22; p2.maxLife = 1.0;
      p2.damage = 60; p2.pierceRemaining = 3;
    }
    const p3 = (spear as any).projectilePool.allocate();
    if (p3) {
      p3.x = 85; p3.y = -40; p3.vx = 450; p3.vy = -140;
      p3.rotation = Math.atan2(-140, 450); p3.life = 0.18; p3.maxLife = 1.0;
      p3.damage = 60; p3.pierceRemaining = 3;
    }

    // (e) Cursed Aura expanding ring
    (aura as any).activeRings.push({
      x: 0,
      y: 0,
      maxRadius: 130,
      life: 0.18,
      maxLife: 0.35,
      isEvolution: false,
    });

    // 5. Populate DarkFantasyVFX Particles
    game.vfx.clear();
    game.vfx.emitBloodBurst(95, 20, 24, 1, 0.2);
    game.vfx.emitBloodBurst(-120, -50, 16, -1, -0.3);
    game.vfx.emitBoneShatter(110, -20, 18);
    game.vfx.emitBoneShatter(-80, 70, 14);
    game.vfx.emitSoulBurst(130, 40, 'emerald', 10);
    game.vfx.emitSoulBurst(-110, -70, 'violet', 10);
    game.vfx.emitSoulBurst(60, -90, 'ruby', 8);
    game.vfx.emitSpellCircle(0, 0, 70, 2.0);
    game.vfx.emitGemGlint(80, 90);
    game.vfx.emitGemGlint(-90, -80);
    game.vfx.emitGemGlint(140, -40);

    // 6. Scattered Soul Gems
    game.lootManager.clear();
    game.lootManager.spawnDrop(0, 80, 90, false);
    game.lootManager.spawnDrop(1, -90, -80, false);
    game.lootManager.spawnDrop(2, 140, -40, false);
    game.lootManager.spawnDrop(0, -60, 110, false);

    // 7. Enemy damage flash
    const enemies = game.hordeManager.getActiveEnemies();
    for (let i = 0; i < Math.min(6, enemies.length); i++) {
      enemies[i].flashTimer = 0.08;
    }

    // 8. Settle particles
    for (let i = 0; i < 2; i++) {
      game.vfx.update(1 / 60);
    }

    // 9. Force render
    game.render();
  });

  const targetPath = path.join(ARTIFACT_DIR, 'survival_gameplay.png');
  await page.screenshot({ path: targetPath, fullPage: false });

  // Assertions
  expect(fs.existsSync(targetPath), 'survival_gameplay.png must exist').toBe(true);
  const stats = fs.statSync(targetPath);
  expect(stats.size, `survival_gameplay.png size (${stats.size} bytes) must be > 50KB`).toBeGreaterThan(50 * 1024);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
```

---

### Protocol 4: Comprehensive Artifact Verification Suite

To guarantee pipeline safety, the test file must include an explicit verification block:

```typescript
test('Verification: all 3 dark fantasy screenshot artifacts exist and strictly exceed 50KB', async () => {
  const requiredArtifacts = [
    'horde_swarm.png',
    'level_up_modal.png',
    'survival_gameplay.png',
  ];

  for (const filename of requiredArtifacts) {
    const fullPath = path.join(ARTIFACT_DIR, filename);
    expect(fs.existsSync(fullPath), `Artifact missing: ${filename}`).toBe(true);
    
    const stats = fs.statSync(fullPath);
    expect(
      stats.size,
      `Artifact ${filename} byte size (${stats.size} bytes) is suspiciously small (<= 50KB). Ensure canvas is rendering properly.`
    ).toBeGreaterThan(50 * 1024);
  }
});
```

---

## 5. Failure Modes & Mitigations

| Potential Failure Mode | Root Cause | Preventative Mitigation |
| :--- | :--- | :--- |
| Canvas renders blank black screen | `GothicBackdrop` offscreen canvases not initialized in time | Explicitly await `w.__game.backdrop.isInitialized === true` before running setup. |
| Screenshot size < 50 KB | Canvas cleared or WebGL context lost | Assert `stats.size > 50 * 1024`. Uncompressed 960x540 raster is ~1.5MB; high-entropy vector textures compress to 120–300KB. A <50KB size immediately catches empty frames. |
| Asynchronous drift in positions | Real-time `requestAnimationFrame` loop advancing while tests execute | Call `game.stop()` immediately upon page load; drive simulation deterministically via `game.step(1/60)` and `game.render()`. |
| Modal doesn't appear | `openNextLevelUp` or `handlePlayerLevelUp` not called | Directly invoke `game.upgradeModal.open(cards, level, game.canvas)` with generated or mock cards. |
| Flaky tests in CI | Preview server port conflict or timeout | Ensure `playwright.config.ts` uses `webServer: { command: 'npm run preview', port: 4173, reuseExistingServer: !process.env.CI }` with `timeout: 30000`. |
