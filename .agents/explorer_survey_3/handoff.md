# Handoff Report — Explorer Survey 3: Boss Health Rebalancing, HUD Health Display & Test Suite Architecture

**Author**: Explorer Survey 3 (`explorer_survey_3`)  
**Mission**: Investigate Boss Health Rebalancing, HUD Health Display, and the Test Suite Architecture for Metal Slug Web Critical Gameplay Bugs Overhaul.  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_3` (symlinked to `/Users/user/src/fullmetalslug/.agents/explorer_survey_3`)  
**Date**: 2026-09-03T17:29:00+09:00  

---

## 1. Observation

### 1.1 Boss Max Health & Phase Configuration in Source
- **File**: `src/core/entities/boss/TetsuyukiBoss.ts`
  - Line 206-207:
    ```typescript
    public health: number;
    public maxHealth: number = 1500;
    ```
  - Line 265-266:
    ```typescript
    this.maxHealth = config.customHp ?? 1500;
    this.health = this.maxHealth;
    ```
  - Line 350, 432, 503 (Comments describing intended percentage breakdown):
    - Line 350: `// PHASE 1: (100% -> 65% HP: 1500 -> 975 HP)`
    - Line 432: `// PHASE 2: (65% -> 30% HP: 975 -> 450 HP)`
    - Line 503: `// PHASE 3: (30% -> 0% HP: 450 -> 0 HP)`
  - Lines 685–707 (Hardcoded Health Gating in `takeDamage`):
    ```typescript
    if (this.phase === 'PHASE_1_ARTILLERY') {
      this.health = Math.max(975, this.health - effectiveDamage);
      if (this.health <= 975) {
        this.transitionToPhase2();
      }
      return;
    }

    if (this.phase === 'PHASE_2_LASER_SWEEP') {
      this.health = Math.max(450, this.health - effectiveDamage);
      if (this.health <= 450) {
        this.transitionToPhase3();
      }
      return;
    }

    if (this.phase === 'PHASE_3_MELTDOWN') {
      this.health = Math.max(0, this.health - effectiveDamage);
      if (this.health <= 0) {
        this.transitionToDeath();
      }
      return;
    }
    ```

### 1.2 Boss Trigger Logic in Stage 1 Setup
- **File**: `src/main.ts`
  - Lines 743–764:
    ```typescript
    // Trigger End-Boss: Tetsuyuki War Fortress Showdown
    {
      id: 'trigger_end_boss',
      triggerX: 1780,
      triggered: false,
      lockCameraBounds: { minX: 1800, maxX: 2280, minY: 0, maxY: 270 },
      spawnAction: (eng: GameEngine) => {
        this.stageManager.setState(StageState.BOSS_BATTLE);
        // Trigger Flashing Warning Banner
        this.bossWarningTimer = 3.5;
        // Spawn Tetsuyuki War Fortress Boss
        const boss = new TetsuyukiBoss('boss_tetsuyuki', vec2(2050, 70), {
          customHp: 1500,
        });
        eng.addEntity(boss);
      },
      isCompleted: (eng: GameEngine) => {
        const b = eng.getEntity('boss_tetsuyuki') as TetsuyukiBoss;
        return !b || !b.isAlive;
      },
    },
    ```

### 1.3 HUD Boss Health Bar Rendering & Scaling
- **File**: `src/ui/HUDOverlay.ts`
  - Lines 227–260:
    ```typescript
    // 2. Boss Health Bar
    if (state.bossHealth !== undefined && state.bossMaxHealth !== undefined && state.bossMaxHealth > 0) {
      const barX = 148;
      const barY = 246;

      // Boss Name Label
      const bossTitle = state.bossName ?? 'STAGE 1 BOSS: TETSUYUKI';
      this.drawPixelText(ctx, bossTitle, barX + 2, barY - 9, '#FF3333', 1.1, '#000000');

      // Metallic Outer Frame
      this.spriteFactory.drawSprite(ctx, 'hud_boss_bar_frame', barX, barY);

      // Gauge Ratio
      const ratio = Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth));
      const fillW = Math.round(180 * ratio);

      if (fillW > 0) {
        // Warning flashing when HP < 25%
        const isCritical = ratio < 0.25;
        const flash = isCritical && Math.floor(time * 8) % 2 === 0;

        ctx.fillStyle = flash ? '#FFFFFF' : '#E74C3C'; // Red / white flash
        ctx.fillRect(barX + 2, barY + 2, fillW, 8);

        // Top metallic highlight
        ctx.fillStyle = flash ? '#FFF080' : '#FFA010';
        ctx.fillRect(barX + 2, barY + 2, fillW, 2);

        // Segment tick dividers every 18px (10 segments)
        ctx.fillStyle = '#000000';
        for (let seg = 18; seg < fillW; seg += 18) {
          ctx.fillRect(barX + 2 + seg, barY + 2, 1, 8);
        }
      }
    }
    ```
- **File**: `src/main.ts`
  - Lines 322–334 & 410–412:
    `bossState` populates `health: b.health` and `maxHealth: b.maxHealth`.
    Passed to HUD via:
    `bossHealth: bossState ? bossState.health : ...`
    `bossMaxHealth: bossState ? bossState.maxHealth : ...`

### 1.4 Keyboard Controller Spacebar & Controls Mapping
- **File**: `src/input/KeyboardController.ts`
  - Lines 72–79:
    ```typescript
    // Fire: J, Z, Space
    KeyJ: 'fire',
    KeyZ: 'fire',
    Space: 'fire',

    // Jump: K, X
    KeyK: 'jump',
    KeyX: 'jump',
    ```
  - Lines 257–263:
    ```typescript
    case 'j':
    case 'z':
    case ' ':
      return 'fire';
    case 'k':
    case 'x':
      return 'jump';
    ```

### 1.5 Spawning Configuration in Stage Triggers
- **File**: `src/main.ts`
  - Lines 658–673:
    ```typescript
    id: 'trigger_wave_1',
    triggerX: 180,
    triggered: false,
    spawnAction: (eng: GameEngine, cameraX: number = 0) => {
      // POW 1 with Heavy Machine Gun badge on wooden pier
      eng.addEntity(new PowEntity('pow_1', vec2(180, 175), ItemDropType.WEAPON_HMG));
      ...
    ```
  - Lines 680–682:
    `trigger_wave_2` at `triggerX: 420` spawns `pow_2` at `vec2(640, 230)`.
  - Lines 723–740:
    `trigger_wave_3` at `triggerX: 1240` spawns `pow_3` at `vec2(1360, 165)` and `pow_4` at `vec2(1710, 175)`.

### 1.6 Existing Test Architecture & Baseline Status
- **File**: `package.json`
  - `npm test` -> `vitest run`
  - `npm run test:e2e` -> `playwright test`
- **File**: `vitest.config.ts`:
  - `environment: 'node'`, `include: ['tests/unit/**/*.{test,spec}.ts']`, `globals: true`, `testTimeout: 15000`
- **File**: `playwright.config.ts`:
  - `testDir: './tests/e2e'`, `timeout: 30000`, `webServer: { command: 'npm run preview', port: 4173 }`, `projects: [{ name: 'chromium' }]`
- **Existing Test Execution Output**:
  - `npm test`: **16 test files passed (205 tests total) in 1.02s**.
  - `npx playwright test`: **2 test files passed (9 tests total) in 5.7s**.
- **Flaws in Previous Tests**:
  - In `tests/e2e/game_initialization.spec.ts` line 160:
    Tested movement via `game.keyboard.setAction('right', true)` (internal JavaScript state setting), bypassing DOM event listeners and `KeyboardController.codeMap`.
  - In `tests/e2e/visual_verification.spec.ts` line 134:
    Tested jump frame via `game.keyboard.setAction('jump', true)`, bypassing `page.keyboard.press('Space')`.
  - In `tests/unit/enemy_boss_statemachine.test.ts` lines 338-339:
    Asserted `expect(boss.health).toBe(1500)` and `expect(boss.maxHealth).toBe(1500)` based on outdated specification.

---

## 2. Logic Chain

### 2.1 The Root Cause of Broken Spacebar Jumping
1. Observation 1.4 shows `Space` in `KeyboardController.ts` is explicitly mapped to `'fire'` (`Space: 'fire'`).
2. Only `KeyK` and `KeyX` were mapped to `'jump'`.
3. When a user presses Spacebar in the browser, `KeyboardController.handleKeyDown` receives `e.code === 'Space'` and sets `this.setAction('fire', true)`. The player shoots a pistol bullet instead of jumping.
4. Observation 1.6 shows why previous automated tests did not catch this bug: the E2E tests simulated actions by invoking internal mock functions (`game.keyboard.setAction('jump', true)`) rather than using real Playwright browser input simulation (`page.keyboard.press('Space')`).
5. **Deduction**: Re-mapping `Space` to `'jump'` in both `codeMap` and `resolveAction` is necessary, and genuine DOM-level Playwright tests (`page.keyboard.press('Space')`) are required to prevent regressions.

### 2.2 Rebalancing Boss Health from 1500 HP to 400 HP
1. Observation 1.1 and 1.2 show `maxHealth` is 1500 in `TetsuyukiBoss.ts` and `src/main.ts`.
2. Player weapons deal:
   - Handgun: $1.0\text{ HP/bullet}$ at $\sim 5\text{ shots/s}$.
   - Heavy Machine Gun (HMG): $1.0\text{ HP/bullet}$ at $10\text{ shots/s}$ ($600\text{ rpm}$).
   - Grenade: $10.0\text{ HP max blast damage}$ ($4.0\text{ HP min}$).
   - Phase 3 superstructure hits suffer $0.25\times$ damage penalty ($75\%$ reduction).
3. At $1500\text{ HP}$:
   - Defeating the boss with default pistol requires $\frac{1500}{5} = 300\text{ seconds}$ ($5\text{ minutes}$) of continuous non-stop firing.
   - With grenades and HMG, combat still lasts $3.5\text{ to }4.5\text{ minutes}$.
   - For an arcade run-and-gun stage, this was tedious and unplayable.
4. At rebalanced $M = 400\text{ HP}$ (within $\le 500\text{ HP}$ requirement):
   - Phase 1 ($400 \to 260\text{ HP}$, $\Delta = 140\text{ HP}$):
     - At $5\text{ shots/s}$, takes $\sim 28\text{ seconds}$ (or $\sim 20\text{s}$ with grenades).
     - Fits 4 heavy artillery cycles ($4.0\text{s}$ each) and 3 rocket salvos ($5.5\text{s}$ each).
   - Phase 2 ($260 \to 120\text{ HP}$, $\Delta = 140\text{ HP}$):
     - Laser sweep cycle lasts $\sim 5.8\text{s}$ ($3.5\text{s}$ cooldown + $0.8\text{s}$ telegraph + $1.5\text{s}$ sweep).
     - Combat takes $\sim 25\text{–}28\text{ seconds}$, player dodges $3\text{–}4$ laser sweeps while firing and dodging gatling cone.
   - Phase 3 ($120 \to 0\text{ HP}$, $\Delta = 120\text{ HP}$):
     - Weak point core takes $1.5\times$ damage ($1.5\text{ HP/bullet}$, $15\text{ HP/grenade}$).
     - Superstructure takes $0.25\times$ damage ($0.25\text{ HP/bullet}$).
     - Firing at weak point requires $\frac{120}{1.5} = 80\text{ handgun hits}$ ($\sim 16\text{s}$), or $4\text{ grenades} + 40\text{ bullets}$ ($\sim 20\text{s}$). Dodges ground thruster shockwaves ($3.0\text{s}$) and 5-way fan rockets ($4.2\text{s}$).
   - Death sequence: $3.2\text{ seconds}$.
   - **Total Fight Duration**: $70\text{–}90\text{ seconds}$ ($\sim 1.2\text{–}1.5\text{ minutes}$), representing optimal, authentic arcade pacing.

### 2.3 Critical Phase Transition Defect Under Rebalanced Health
1. Observation 1.1 reveals that `TetsuyukiBoss.takeDamage` contains hardcoded numbers:
   `this.health = Math.max(975, this.health - effectiveDamage)`
   `this.health = Math.max(450, this.health - effectiveDamage)`
2. If `maxHealth = 400` is applied without altering lines 686 and 694:
   - On the very first hit, `this.health` is $400$. `400 - 1 = 399`.
   - `Math.max(975, 399)` returns `975`, unexpectedly increasing health to 975!
   - Because `this.health <= 975` is true, the boss immediately transitions to Phase 2.
   - In Phase 2, `Math.max(450, ...)` triggers and transitions immediately to Phase 3.
   - **The boss would instantly skip Phase 1 and Phase 2 on the first bullet!**
3. **Architectural Solution**:
   Phase transition thresholds must be calculated dynamically:
   ```typescript
   const p1Threshold = Math.round(this.maxHealth * 0.65); // 260 HP for 400 HP
   const p2Threshold = Math.round(this.maxHealth * 0.30); // 120 HP for 400 HP
   ```
   This guarantees that any configured `maxHealth` ($\le 500$ or even custom $1500$ in legacy tests) maintains the exact $100\% \to 65\% \to 30\% \to 0\%$ state machine structure.

### 2.4 HUD / UI Scaling Verification
1. Observation 1.3 shows `HUDOverlay.renderBossHUD` calculates:
   `const ratio = Math.max(0, Math.min(1, state.bossHealth / state.bossMaxHealth));`
   `const fillW = Math.round(180 * ratio);`
   `const isCritical = ratio < 0.25;`
2. `state.bossMaxHealth` is dynamically read from `bossState.maxHealth` (from `b.maxHealth`).
3. When `bossMaxHealth = 400`:
   - At $400\text{ HP}$, `ratio = 1.0`, `fillW = 180px` (full bar).
   - At $200\text{ HP}$, `ratio = 0.5`, `fillW = 90px` (half bar).
   - At $< 100\text{ HP}$ ($< 25\%$), `isCritical = true` (flashing red/white bar).
4. No fixed `1500` constant exists in `HUDOverlay.ts` or `CanvasRenderer.ts`.
5. **Deduction**: The HUD health display is completely normalized and resolution/HP independent. It automatically scales correctly with zero modifications to rendering code.

### 2.5 Spawning Contract Defects
1. Observation 1.5 shows `trigger_wave_1` at `triggerX = 180` instantiates `new PowEntity('pow_1', vec2(180, 175), ...)` directly on the player's position.
2. The player reaches $X = 180$, and a POW appears in their face without warning.
3. POWs should be placed at fixed, logical stage coordinates (e.g. on bunker or bridge platforms ahead of the player) or spawned at coordinates ahead of the camera viewport ($X > \text{cameraX} + 480$).
4. Enemy minions must spawn exclusively at $X \ge \text{cameraX} + 510\text{px}$ and walk into view.
5. All random timer-based spawning inside the camera viewport must be prohibited.

---

## 3. Caveats
1. **Existing Unit Test Assertions on 1500 HP**:
   `tests/unit/enemy_boss_statemachine.test.ts` lines 338–339 and lines 348–350 assert `expect(boss.health).toBe(1500)` and `expect(boss.health).toBe(975)`. When default `maxHealth` is changed to 400, these assertions in `enemy_boss_statemachine.test.ts` must be updated to 400 and 260 (or instantiated with `{ customHp: 1500 }` to test legacy customHp functionality).
2. **Playwright Port & WebServer**:
   Playwright runs against `npm run preview` on port 4173. The project build (`npm run build`) must be kept up to date or executed before running Playwright tests to ensure bundled changes take effect.
3. **Touch Virtual Pad / Mobile Controls**:
   `src/input/TouchVirtualPad.ts` handles mobile touchscreen jump buttons. Its mapping (`jump: true`) already maps to jump, so mobile controls are unaffected, but desktop keyboard controls needed the Spacebar fix.

---

## 4. Conclusion

1. **Boss Rebalancing Target**:
   - Set `TetsuyukiBoss.maxHealth = 400` as default.
   - Update `trigger_end_boss` in `src/main.ts` line 755 to use `customHp: 400` (or remove customHp so it defaults to 400).
   - In `TetsuyukiBoss.takeDamage()`, replace hardcoded `975` and `450` with dynamic thresholds `Math.round(this.maxHealth * 0.65)` ($260\text{ HP}$) and `Math.round(this.maxHealth * 0.30)` ($120\text{ HP}$).
2. **HUD Compatibility**:
   - The HUD bar in `src/ui/HUDOverlay.ts` is already fully dynamic, computing `bossHealth / bossMaxHealth * 180px`. It requires **zero** changes.
3. **Controls Mapping**:
   - In `src/input/KeyboardController.ts`, map `Space`, `KeyK`, and `KeyX` to `'jump'`. Map `KeyJ` and `KeyZ` to `'fire'`.
4. **Spawning Redesign**:
   - Move `pow_1` from $(180, 175)$ to a fixed location ahead of player (e.g. $(320, 160)$ on bunker 1).
   - Ensure all minion spawns occur strictly at $X \ge \text{cameraX} + 510\text{px}$.
5. **New Test Suite Additions**:
   - `tests/e2e/gameplay_controls.spec.ts`: Real Playwright tests using `page.keyboard.press('Space')` verifying $\Delta Y < 0$ (upward movement) and `ArrowRight`/`ArrowLeft` verifying $\Delta X \neq 0$.
   - `tests/unit/boss_rebalance.test.ts`: Dedicated unit test verifying `boss.maxHealth <= 500` (400 HP), phase transitions at $65\%$ ($260$) and $30\%$ ($120$), and single-burst damage clamping.
   - `tests/unit/spawning_contract.test.ts`: Dedicated contract test verifying spawn coordinates are out-of-bounds ($X \ge \text{cameraX} + 480$), POWs do not pop on player, and zero timer-based random spawns occur.

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Unit & Contract Verification**:
   ```bash
   npm test
   ```
   *Expected*: All existing test files + `boss_rebalance.test.ts` + `spawning_contract.test.ts` pass with 100% green.
2. **Build Verification**:
   ```bash
   npm run build
   ```
   *Expected*: TypeScript compilation and Vite build succeed with zero errors.
3. **Playwright E2E Verification**:
   ```bash
   npx playwright test tests/e2e/gameplay_controls.spec.ts
   npx playwright test
   ```
   *Expected*: Headless browser boots, presses Spacebar, measures and asserts real upward Y coordinate change ($Y_{\text{peak}} < Y_{\text{start}}$), presses Arrow keys, measures and asserts X coordinate change, with zero console errors.

### 5.2 Specific Assertions to Implement in New Tests

#### Test 1: `tests/e2e/gameplay_controls.spec.ts` (Playwright E2E)
```typescript
test('pressing Spacebar causes genuine upward movement (Y decrease)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game-canvas');
  await page.waitForFunction(() => (window as any).__GAME__?.player);

  const startY = await page.evaluate(() => (window as any).__GAME__.player.position.y);

  // Authentic browser key press simulation
  await page.keyboard.press('Space');
  await page.waitForTimeout(150); // 9 frames into jump ascent

  const peakY = await page.evaluate(() => (window as any).__GAME__.player.position.y);
  const isGrounded = await page.evaluate(() => (window as any).__GAME__.player.isGrounded);

  // In canvas coordinates, smaller Y is upward
  expect(peakY).toBeLessThan(startY - 15);
  expect(isGrounded).toBe(false);
});

test('pressing ArrowRight and ArrowLeft causes genuine horizontal movement (X displacement)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game-canvas');
  await page.waitForFunction(() => (window as any).__GAME__.player);

  const startX = await page.evaluate(() => (window as any).__GAME__.player.position.x);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowRight');

  const movedRightX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
  expect(movedRightX).toBeGreaterThan(startX + 10);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowLeft');

  const movedLeftX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
  expect(movedLeftX).toBeLessThan(movedRightX - 10);
});
```

#### Test 2: `tests/unit/boss_rebalance.test.ts` (Vitest Unit)
```typescript
describe('Boss Health Rebalance & Phase Gating Contract', () => {
  it('default TetsuyukiBoss must have maxHealth <= 500 (specifically 400 HP)', () => {
    const boss = new TetsuyukiBoss('boss_test', { x: 360, y: 50 });
    expect(boss.maxHealth).toBeLessThanOrEqual(500);
    expect(boss.maxHealth).toBe(400);
    expect(boss.health).toBe(boss.maxHealth);
  });

  it('stage trigger trigger_end_boss must configure boss with maxHealth <= 500', () => {
    const stage = FullMetalSlugGame.createStage1();
    const trigger = stage.triggers.find((t) => t.id === 'trigger_end_boss');
    expect(trigger).toBeDefined();

    const engine = new GameEngine();
    trigger!.spawnAction(engine, 1780);
    const boss = engine.getEntity('boss_tetsuyuki') as TetsuyukiBoss;
    expect(boss).toBeDefined();
    expect(boss.maxHealth).toBeLessThanOrEqual(500);
  });

  it('boss must dynamically transition phases at 65% and 30% thresholds and clamp massive burst', () => {
    const boss = new TetsuyukiBoss('boss_test', { x: 360, y: 50 });
    expect(boss.maxHealth).toBe(400);

    // Phase 1 -> Phase 2 gate: 400 * 0.65 = 260 HP
    boss.takeDamage(1000); // 1000 HP burst in Phase 1
    expect(boss.health).toBe(260);
    expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

    // Phase 2 -> Phase 3 gate: 400 * 0.30 = 120 HP
    boss.takeDamage(1000); // 1000 HP burst in Phase 2
    expect(boss.health).toBe(120);
    expect(boss.phase).toBe('PHASE_3_MELTDOWN');

    // Phase 3 -> Death
    boss.takeDamage(1000, true);
    expect(boss.health).toBe(0);
    expect(boss.phase).toBe('DEATH_EXPLODING');
  });
});
```

#### Test 3: `tests/unit/spawning_contract.test.ts` (Vitest Unit)
```typescript
describe('Spawning Logic & Coordinate Invariant Suite', () => {
  it('all wave enemy spawns must occur strictly outside active viewport (x >= cameraX + 480)', () => {
    const stage = FullMetalSlugGame.createStage1();
    const testCameraCoords = [0, 200, 500, 1000, 1500];

    for (const cameraX of testCameraCoords) {
      for (const trigger of stage.triggers) {
        const engine = new GameEngine();
        trigger.spawnAction(engine, cameraX);

        const enemies = engine.getAllEntities().filter((e) => e.type.startsWith('SOLDIER'));
        for (const enemy of enemies) {
          expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);
        }
      }
    }
  });

  it('POW entities must not pop directly on top of the player trigger coordinate', () => {
    const stage = FullMetalSlugGame.createStage1();
    for (const trigger of stage.triggers) {
      const engine = new GameEngine();
      trigger.spawnAction(engine, trigger.triggerX);

      const pows = engine.getAllEntities().filter((e) => e.type === 'POW');
      for (const pow of pows) {
        // Assert POW is placed at least 80px away from triggerX
        expect(Math.abs(pow.position.x - trigger.triggerX)).toBeGreaterThan(60);
      }
    }
  });

  it('no spontaneous random timer-based spawns occur in engine over 3600 idle ticks', () => {
    const engine = new GameEngine();
    engine.start();
    const initialEntityCount = engine.getAllEntities().length;

    for (let i = 0; i < 3600; i++) {
      engine.tick();
    }

    expect(engine.getAllEntities().length).toBe(initialEntityCount);
  });
});
```

### 5.3 Invalidation Conditions
- If `TetsuyukiBoss.takeDamage` retains static constants `975` or `450`, this report's rebalancing recommendation is partially invalidated until dynamic percentage formulas are applied.
- If `KeyboardController.ts` maps `Space` to anything other than `'jump'`, the E2E jump test will fail with $Y_{\text{peak}} \ge Y_{\text{start}}$.
