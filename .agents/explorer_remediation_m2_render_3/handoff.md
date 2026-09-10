# Investigation & Remediation Strategy Report: Living Enemy Rendering & Entity Harmonization

**Agent**: Explorer Remediation 3 (`explorer_remediation_m2_render_3`)  
**Mission**: Investigate and formulate an exact, complete fix strategy for Reviewer 1 Finding 2 (Living Cute Enemy Rendering) and Finding 4/5 (Entity & Weapon Harmonization) for Milestone M2.  
**Target Files**:
- `src/render/sprites/ProceduralSpriteFactory.ts`
- `src/render/CanvasRenderer.ts`
- `src/main.ts`
- `src/core/cute/CuteEnemyManager.ts`  
**Patch File**: `.agents/explorer_remediation_m2_render_3/living_enemy_render_harmonization.patch`  
**Parent Conversation ID**: `126ae93c-9f63-4451-b923-a4f1126318fc`

---

## 1. Observation

### 1.1 Verbatim Code & Empirical Findings

#### Observation 1: Living Cute Enemies Missing from Scene Graph and Renderer (Reviewer 1 Finding 2)
In `src/main.ts`, lines 644–665 (`buildRenderSceneState()`):
```typescript
    return {
      time: this.elapsedTime,
      camera: this.camera,
      platforms: this.stageManager.getPlatforms(),
      obstacles: obstacleStates,
      player: playerRenderState,
      enemies: enemyStates,
      corpses: this.corpseManager.getRenderStates(),
      boss: bossState,
      pows: powStates,
      projectiles: projectileStates,
      explosions: this.activeExplosions,
      hud: hudState,
      cinematicFX: this.player.ultimateManager?.getCinematicState(),
      cuteBubbles: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.getRenderBubbles() : undefined,
      cutePet: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.getRenderPet() : undefined,
      cuteAltars: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.getRenderAltars() : undefined,
      cutePickups: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.getRenderPickups() : undefined,
      cuteOrbiters: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.orbitingBubbles : undefined,
      cuteTrails: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.sugarTrails : undefined,
    };
```
- **Finding**: `this.cuteCoordinator.getCuteEnemyStates()` is **never invoked or referenced** in `buildRenderSceneState()`. `scene.cuteEnemies` does not exist on `RenderSceneState` in `src/render/CanvasRenderer.ts:180-198`.
- In `src/render/CanvasRenderer.ts:720-764`, `renderEntitiesPass` only iterates `scene.enemies`, checking `MID_BOSS_VEHICLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`, and `rebel_rifle_*`. Unbubbled cute enemies (`MARSHMALLOW_SLIME`, `HONEY_BEE`, `DONUT_ROLLER`, `GUMMY_COLOSSUS`, `GUMMY_CUB`) are completely omitted from the scene graph.
- **Empirical Confirmation**:
  ```bash
  npx tsx -e "
  import { FullMetalSlugGame } from './src/main';
  const game = new FullMetalSlugGame();
  for (let i = 0; i < 100; i++) game.step(1 / 60);
  const scene = (game as any).buildRenderSceneState();
  console.log('Scene enemies length:', scene.enemies.length, 'Cute enemies length:', game.cuteCoordinator.enemyManager.enemies.length);
  "
  ```
  Result: `Scene enemies length: 0` while `Cute enemies length: 4`. Living enemies hop, hover, roll, and stomp while 100% invisible on screen until trapped in a bubble.

---

#### Observation 2: Missing Sprite Mappings in `ProceduralSpriteFactory.ts`
In `src/render/sprites/ProceduralSpriteFactory.ts`:
- Searching for `cute_marshmallow_slime`, `cute_honey_bee`, `cute_donut_roller`, `cute_gummy_colossus`, or `cute_gummy_cub` returns **0 results**.
- In `ProceduralSpriteFactory.ts:407-413`:
  ```typescript
  public getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[] {
    return Array.from(this.spriteCache.keys()).filter((k) => {
      if (!includePolish && this.polishKeys.has(k)) return false;
      if (!includeExpansion && this.expansionKeys.has(k)) return false;
      return true;
    });
  }
  ```
- **Finding**: The baseline 164-key invariant is strictly protected by `includeExpansion: false`. Registering novel cute enemy sprites via `this.registerExpansionSprite(key, w, h, ax, ay, renderFn)` adds them to `this.expansionKeys`, allowing them to be cached and drawn via `drawSprite()` while strictly preserving `getAllKeys(false, false).length === 164`. Empirical test confirmed: `getAllKeys(false, false).length` remained strictly 164 before and after registration.

---

#### Observation 3: Dual Gunfire & Entity Disconnection in Cute Mode (Reviewer 1 Finding 5)
In `src/main.ts`, lines 370–395:
```typescript
    // Update Player controller with input (handles gameplay, dying, continue countdown, and parachute)
    this.player.handleInput(input, dt, this.engine);

    // Cute Blossom Arena loop processing
    if (this.gameMode === 'cute_blossom_arena') {
      ...
      // On fire, shoot sweet iridescent bubbles
      if (input.shootPressed || (input.shootHeld && this.player.weaponManager.getWeaponState().isAutomatic)) {
        this.cuteCoordinator.onPlayerShoot(playerActor, this.player.aimAngle, this.player.aimDirection);
      }
    }
```
- **Finding**: When `input.shootPressed` or `input.shootHeld` is active:
  1. `this.player.handleInput` invokes `executeAttackDecision` in `PlayerController.ts`, which calls `this.weaponManager.tryFire(...)`. This instantiates a classic military handgun/HMG/flame projectile into `this.engine` and consumes ammunition.
  2. Concurrently, line 391 calls `this.cuteCoordinator.onPlayerShoot(...)`, spawning a bubble projectile.
  3. The classic military bullets travel across the arena, passing harmlessly through cute slimes and bees because collision detection in `src/core/weapons/ProjectileManager.ts` only tests classic `SoldierEnemy` entities.
  4. Ammunition decreases and brass shell casings eject onto the candy ground while bubbles float in parallel.

---

#### Observation 4: Fatal Damage Trap Inversion Bug in `CuteEnemyManager.ts` (Reviewer 1 Finding 4)
In `src/core/cute/CuteEnemyManager.ts`, lines 215–221:
```typescript
      } else {
        enemy.isAlive = false;
        if (bubbleManager && !enemy.isBubbled) {
          // Trap or burst into bubble on defeat
          this.trapEnemyInBubble(enemy.id, bubbleManager);
        }
      }
```
And in `trapEnemyInBubble` (`src/core/cute/CuteEnemyManager.ts:178`):
```typescript
    const enemy = this.enemies.find((e) => e.id === enemyId && e.isAlive && !e.isBubbled);
    if (!enemy) return false;
```
- **Finding**: At line 216, `enemy.isAlive = false;` is assigned *prior* to invoking `trapEnemyInBubble`. When line 219 calls `trapEnemyInBubble`, line 178 fails because `e.isAlive` is `false`. It immediately returns `false` and the enemy is never trapped into a bubble on defeat.

---

## 2. Logic Chain

1. **Premise 1 (Visual Integrity Requirement)**:
   In `ORIGINAL_REQUEST.md` and `PROJECT.md`, the visual presentation must be "overwhelmingly cute and charming" with zero invisible enemies. If living slimes, bees, donut rollers, and the boss are not passed to `buildRenderSceneState()` or drawn by `CanvasRenderer`, they exist only as headless mathematical abstractions.
2. **Premise 2 (Render Graph Continuity)**:
   When unbubbled, an enemy must be drawn at its simulation coordinates `(e.x, e.y)` projected to the virtual canvas `camera.worldToScreen(e.x, e.y)`. When bubbled, it must be drawn suspended inside the floating bubble with comical dizzy `@_@` eyes. When popped, it bursts into drops. At no point should an enemy be invisible.
3. **Premise 3 (Weapon Harmonization)**:
   In `cute_blossom_arena` mode, the player's weapon is the Sweet Bubble Blaster. Classic military firearm projectiles (`PROJECTILE` with `handgun`/`hmg`/`flame`) must NOT be spawned into `this.engine` on shoot input, and ammunition must not be deducted. Sanitizing `playerInput` to `{ ...input, shootPressed: false, shootHeld: false, grenadePressed: false }` before passing to `player.handleInput()` guarantees that `PlayerController` handles all movement, jumping, posture, and 8-way aiming calculations without executing classic weapon firing decisions.
4. **Premise 4 (Baseline Invariant Preservation)**:
   Over 20 test files strictly assert `ProceduralSpriteFactory.getAllKeys(false, false).length === 164`. Using `registerExpansionSprite()` guarantees that the 5 new cute enemy sprites are cached for `drawSprite()` while being excluded from the 164 baseline keys.

---

## 3. Caveats

- In `spawning_contract.test.ts`, tests directly call `game.step(1/60)` to assert that classic triggers spawn `SoldierEnemy` on terrain. Therefore, classic stage triggers in `StageManager` must remain available when classic tests run, but classic projectiles are completely suppressed from the player's weapon in cute mode.
- In headless test environments where the canvas 2D context lacks `ellipse` or HTML5 canvas methods, `drawSprite` and `renderCuteEnemiesPass` provide fallback primitive fills (`ctx.fillRect` / `ctx.arc`) ensuring tests never throw `TypeError: ctx.ellipse is not a function`.
- Boss lifecycle fixes (`isBossActive` check on dead entities and cub popping) are managed by Explorer Remediation 1 (`m2_boss_lifecycle_remediation.patch`); this report focuses on rendering and weapon/entity harmonization.

---

## 4. Conclusion & Concrete Fix Specification

### 4.1 Component 1: Sprite Registration in `ProceduralSpriteFactory.ts`
Register 5 charming expansion sprites in `registerAllSprites()` in `src/render/sprites/ProceduralSpriteFactory.ts`:
1. `cute_marshmallow_slime` (28x24, anchor: 14, 20): Pastel pink dome, powdered sugar glaze, blushing cheeks, anime catchlight eyes.
2. `cute_honey_bee` (28x24, anchor: 14, 12): Warm honey-gold body, chocolate stripes, translucent wings, pollen antennae.
3. `cute_donut_roller` (28x28, anchor: 14, 14): Golden pastry ring, strawberry glaze, candy sprinkles, hollow center.
4. `cute_gummy_colossus` (80x90, anchor: 40, 80): Massive translucent ruby gummy bear, bear ears, squishy paws with paw pads, cute heart nose, and double catchlight eyes.
5. `cute_gummy_cub` (26x30, anchor: 13, 24): Pastel lime/orange bouncy mini gummy bear cub.

### 4.2 Component 2: Render Graph & Pass in `CanvasRenderer.ts`
1. Update `RenderSceneState` interface:
   ```typescript
   export interface RenderSceneState {
     ...
     cuteBubbles?: RenderBubbleState[];
     cutePet?: RenderPetState;
     cuteAltars?: RenderAltarState[];
     cutePickups?: RenderPickupState[];
     cuteEnemies?: CuteEnemyState[]; // <-- ADDED
     cuteOrbiters?: Array<{ angle: number; radius: number }>;
     cuteTrails?: Array<{ x: number; y: number; age: number; maxAge: number; color: string }>;
   }
   ```
2. In `renderScene()`: Add Pass 3.1:
   ```typescript
   // Pass 3: Entities (POWs, Boss, Enemies, Player)
   this.renderEntitiesPass(scene, cam, time);

   // Pass 3.1: Cute Living Enemies (Slimes, Bees, Donut Rollers, Gummy Colossus, Cubs)
   if (scene.cuteEnemies && scene.cuteEnemies.length > 0) {
     this.renderCuteEnemiesPass(scene.cuteEnemies, cam, time);
   }
   ```
3. Implement `renderCuteEnemiesPass`:
   - Iterate `scene.cuteEnemies`. If `!enemy.isAlive || enemy.isBubbled`, continue.
   - Screen coordinates: `const screen = camera.worldToScreen(enemy.x, enemy.y);`.
   - Slimes: render with dynamic `scale: enemy.squashStretch ?? 1.0`.
   - Bees: render with sinusoidal wing flutter (`Math.sin(time * 28)`).
   - Donut Rollers: render with rolling rotation (`rotation: (enemy.x / 14) * facing`).
   - Gummy Colossus: render with subtle breathing wobble (`1 + Math.sin(time * 4) * 0.03`) and floating overhead boss HP bar (`👑 GUMMY COLOSSUS`).
   - Gummy Cubs: render with bouncy hopping scale.
4. Enhance `renderCuteBubblesPass`:
   - Extend `if (b.trappedType)` to render custom trapped sprites for `SLIME`, `BEE`, `DONUT`, and `CUB` with funny dizzy spiral eyes (`@_@`).

### 4.3 Component 3: Input Sanitization & Attack Harmonization in `src/main.ts`
1. In `FullMetalSlugGame.step()`:
   ```typescript
   // In cute_blossom_arena mode, sanitize input so playerController handles movement/jump/aiming
   // while weapon attack is cleanly delegated to cuteCoordinator bubble blaster (no classic gunfire/ammo consumption)
   const playerInput = this.gameMode === 'cute_blossom_arena'
     ? { ...input, shootPressed: false, shootHeld: false, grenadePressed: false }
     : input;
   this.player.handleInput(playerInput, dt, this.engine);

   // Cute Blossom Arena loop processing
   if (this.gameMode === 'cute_blossom_arena') {
     ...
     // On fire, cleanly shoot sweet iridescent bubbles (including rapid fire during Sweet Fever)
     const wantsFire = input.shootPressed || (input.shootHeld && (this.cuteCoordinator.bubbleManager.isFeverActive || this.player.weaponManager.getWeaponState().isAutomatic));
     if (wantsFire) {
       this.cuteCoordinator.onPlayerShoot(playerActor, this.player.aimAngle, this.player.aimDirection);
     }
     this.cuteCoordinator.update(dt, playerActor);
   }
   ```
2. In `buildRenderSceneState()`:
   ```typescript
   cuteEnemies: this.gameMode === 'cute_blossom_arena' ? this.cuteCoordinator.getCuteEnemyStates() : undefined,
   ```

### 4.4 Component 4: Defeat Trapping Order in `CuteEnemyManager.ts`
In `damageEnemy()`:
```typescript
<<<<
      } else {
        enemy.isAlive = false;
        if (bubbleManager && !enemy.isBubbled) {
          // Trap or burst into bubble on defeat
          this.trapEnemyInBubble(enemy.id, bubbleManager);
        }
      }
====
      } else {
        if (bubbleManager && !enemy.isBubbled) {
          // Trap enemy into bubble BEFORE marking isAlive = false
          this.trapEnemyInBubble(enemy.id, bubbleManager);
        }
        enemy.isAlive = false;
      }
>>>>
```

---

## 5. Verification Method

### 5.1 Step-by-Step Independent Verification Commands

1. **Verify Baseline 164-Key Invariant**:
   ```bash
   npx tsx -e "
   import { ProceduralSpriteFactory } from './src/render/sprites/ProceduralSpriteFactory';
   const factory = ProceduralSpriteFactory.getInstance();
   console.log('Baseline keys (must be 164):', factory.getAllKeys(false, false).length);
   console.log('Has Slime Sprite:', factory.hasSprite('cute_marshmallow_slime'));
   console.log('Has Bee Sprite:', factory.hasSprite('cute_honey_bee'));
   console.log('Has Donut Sprite:', factory.hasSprite('cute_donut_roller'));
   console.log('Has Colossus Sprite:', factory.hasSprite('cute_gummy_colossus'));
   console.log('Has Cub Sprite:', factory.hasSprite('cute_gummy_cub'));
   "
   ```
   *Expected*: `Baseline keys: 164`, all sprite queries return `true`.

2. **Verify Living Cute Enemies in Scene Graph**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame();
   for (let i = 0; i < 100; i++) game.step(1 / 60);
   const scene = (game as any).buildRenderSceneState();
   console.log('Cute enemies in scene:', scene.cuteEnemies?.length);
   console.log('Enemy types:', scene.cuteEnemies?.map(e => e.type));
   "
   ```
   *Expected*: `Cute enemies in scene: 4`, types: `['MARSHMALLOW_SLIME', 'MARSHMALLOW_SLIME', 'MARSHMALLOW_SLIME', 'HONEY_BEE']`.

3. **Verify Pure Bubble Weapon Firing (Zero Military Gunfire/Ammo Consumption)**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame();
   game.keyboard.fireJustPressed = true; game.keyboard.fire = true;
   game.step(1 / 60);
   const entities = game.engine.getAllEntities();
   const classicBullets = entities.filter(e => e.type === 'PROJECTILE');
   const bubbles = game.cuteCoordinator.bubbleManager.bubbles;
   console.log('Classic bullets in engine (must be 0):', classicBullets.length);
   console.log('Bubbles spawned in coordinator (must be 1):', bubbles.length);
   "
   ```
   *Expected*: `Classic bullets in engine: 0`, `Bubbles spawned: 1`.

4. **Verify Fatal Damage Trapping Order**:
   ```bash
   npx tsx -e "
   import { CuteEnemyManager } from './src/core/cute/CuteEnemyManager';
   import { BubbleManager } from './src/core/cute/BubbleManager';
   const em = new CuteEnemyManager();
   const bm = new BubbleManager();
   const slime = em.spawnEnemy('MARSHMALLOW_SLIME', 200, 200);
   em.damageEnemy(slime.id, 1, bm);
   console.log('Slime is bubbled (must be true):', slime.isBubbled);
   console.log('Bubble spawned in manager (must be 1):', bm.bubbles.length);
   "
   ```
   *Expected*: `Slime is bubbled: true`, `Bubble spawned: 1`.

5. **Execute Unit Test Suites**:
   ```bash
   npx vitest run tests/unit/cute_gameplay_loop.test.ts
   npm test
   ```
   *Expected*: All tests pass cleanly.

---

### Invalidation Conditions
- If `ProceduralSpriteFactory.getAllKeys(false, false).length !== 164`, the baseline key contract is invalidated.
- If pressing shoot in `cute_blossom_arena` causes `game.engine.getAllEntities()` to contain classic `PROJECTILE` entities, weapon harmonization is invalidated.
- If `scene.cuteEnemies` is undefined in `buildRenderSceneState()`, living enemy rendering is invalidated.
