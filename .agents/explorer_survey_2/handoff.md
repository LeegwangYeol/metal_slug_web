# Handoff Report: Spawning Logic Overhaul (POWs & Enemies)

**Agent**: Explorer 2 (`explorer_survey_2`)  
**Mission**: Investigate Spawning Logic for Enemies and POWs, analyze viewport/camera coordinate mapping, identify random timer/pop spawns, and propose a clean off-screen/fixed-stage spawning architecture.  
**Target File**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/handoff.md`  
**Date**: 2026-09-03T17:31:30+09:00  

---

## 1. Observation

Direct empirical observations of the codebase:

### Obs 1: Enemy Spawning Y-Coordinate & Physics Despawn Bug
- **Location**: `src/main.ts` lines 667–672, 685–692, 711–713, 730–738:
  ```typescript
  // Wave 1
  const spawnBaseX = cameraX + 520;
  eng.addEntity(new SoldierEnemy('rebel_rifle_1', 'SOLDIER_RIFLE', vec2(spawnBaseX, 230), { cameraX }));
  eng.addEntity(new SoldierEnemy('rebel_knife_1', 'SOLDIER_KNIFE', vec2(spawnBaseX + 40, 230), { cameraX }));
  // Wave 2
  eng.addEntity(new SoldierEnemy('rebel_shield_1', 'SOLDIER_SHIELD', vec2(spawnBaseX, 230), { cameraX }));
  eng.addEntity(new SoldierEnemy('rebel_grenade_1', 'SOLDIER_GRENADE', vec2(spawnBaseX + 40, 230), { cameraX }));
  eng.addEntity(new SoldierEnemy('rebel_rifle_2', 'SOLDIER_RIFLE', vec2(spawnBaseX + 80, 230), { cameraX }));
  ```
- **Soldier Bounds Definition**: `src/core/entities/enemies/SoldierEnemy.ts` lines 166–168, 210–212:
  ```typescript
  public readonly width: number = 24;
  public readonly height: number = 38;
  this.position = { x: initialPosition.x, y: initialPosition.y };
  this.bounds = createAABB(this.position.x, this.position.y, this.width, this.height);
  ```
  `position.y` in `SoldierEnemy` represents the **top-left** of the bounding box. Its feet are located at `position.y + height` ($230 + 38 = 268\text{px}$).
- **Platform Height**: `src/main.ts` line 626:
  ```typescript
  { id: 'ground_main', type: 'SOLID', bounds: createAABB(0, 230, STAGE_WIDTH, 40) }
  ```
  The ground top surface is at $Y = 230$.
- **Ground Contact Solver**: `src/core/physics/Platform.ts` line 146:
  ```typescript
  const crossedTopSurface = prevFootY <= platTop + snapTolerance && currFootY >= platTop;
  ```
  Where `snapTolerance = 4.0`. With `initialPosition.y = 230`, `prevFootY = 268`. Since $268 \le 230 + 4.0$ is **false**, `isGrounded` immediately becomes `false`.
- **Despawn Mechanism**: `src/core/engine/StageManager.ts` line 186:
  ```typescript
  if (entity.position.x < cameraX - 180 || entity.position.y > 320) {
    entity.isAlive = false;
    this.engine.removeEntity(entity.id);
  }
  ```
  Gravity ($720\text{ px/s}^2$) pulls the ungrounded soldier downward.
- **Empirical Execution Trace**:
  Simulating `rebel_rifle_1` in `FullMetalSlugGame`:
  ```
  Frame 1: x=516.3, y=230.2, vy=12.0, grounded=false, isAlive=true
  ...
  Frame 20: x=481.5, y=272.0, vy=240.0, grounded=false, isAlive=true (still off-screen)
  Frame 21: x=479.7, y=276.2, vy=252.0, grounded=false, isAlive=true (crosses into screen)
  ...
  Frame 30: x=463.2, y=323.0, vy=360.0, grounded=false, isAlive=true (drops past y=320)
  Frame 31: DESPAWNED/REMOVED!
  ```
  `rebel_rifle_1` falls through the terrain and is culled after only 9 frames ($0.15\text{s}$) in the viewport! `rebel_knife_1` (spawned at $X = 560$) plummets and is culled at Frame 31 at $X = 503$, **never even reaching the visible screen**!

### Obs 2: POW Popping On Top of Player and In-Frustum
- **Location**: `src/main.ts` lines 657–665, 677–683, 722–729, 738–740:
  - `trigger_wave_1` (`triggerX: 180`):
    `eng.addEntity(new PowEntity('pow_1', vec2(180, 175), ItemDropType.WEAPON_HMG));`
    Player activates this trigger by walking to $X = 180$. `pow_1` is dynamically added at $X = 180$, directly on top of the player's collision hull!
  - `trigger_wave_2` (`triggerX: 420`):
    `eng.addEntity(new PowEntity('pow_2', vec2(640, 230), ItemDropType.WEAPON_FLAME));`
    When player is at $X = 420$, camera is at $X \approx 204$. Viewport range is $[204, 684]$. $X = 640$ is at viewport screen pixel $436$ ($480 - 44$). The hostage pops into existence on screen in plain sight of the player!
  - `trigger_wave_3` (`triggerX: 1240`):
    `eng.addEntity(new PowEntity('pow_3', vec2(1360, 165), ItemDropType.GRENADE_CRATE));`
    At $X = 1240$, camera is at $X \approx 1024$. Viewport range is $[1024, 1504]$. $X = 1360$ is at viewport screen pixel $336$, right in front of the player!

### Obs 3: Camera Tracking & Viewport Coordinates
- **Camera Dimensions**: `src/render/Camera.ts` lines 60–61:
  `viewportWidth = 480`, `viewportHeight = 270`.
- **Deadzone**: `src/render/Camera.ts` lines 70–71:
  `deadzoneLeft = Math.floor(480 * 0.35) = 168`
  `deadzoneRight = Math.floor(480 * 0.45) = 216`
- **World to Screen**:
  `screenX = worldX - camera.renderX`
  `screenY = worldY - camera.renderY`
- **Forward Lock**: `Camera.forwardLock = true` prevents scrolling backwards.

### Obs 4: Enemy Ingress AI Freeze Bug
- **Location**: `src/core/entities/enemies/SoldierEnemy.ts` lines 369–390:
  ```typescript
  private transitionToNormalRoleAI(): void {
    switch (this.role) {
      case 'RIFLE':
        this.patrolMinX = this.position.x - 100;
        this.patrolMaxX = this.position.x + 50; // walks back out off-screen!
        this.velocity.x = this.facing * this.walkSpeed;
        this.transitionTo('PATROL');
        break;
      case 'KNIFE':
        this.velocity.x = 0;
        this.transitionTo('IDLE'); // stops dead at screen edge!
        break;
      case 'GRENADE':
        this.velocity.x = 0;
        this.transitionTo('IDLE'); // stops dead at screen edge!
        break;
      case 'SHIELD':
        this.velocity.x = this.facing * 45;
        this.transitionTo('GUARD_ADVANCE');
        break;
    }
  }
  ```
  Knife chargers and grenade throwers stop at $v_x = 0$ as soon as they cross `cameraX + 460`. Unless the player closes within $180\text{px}$, they remain completely immobile at the right boundary of the viewport.

### Obs 5: Timer-Based Spawns in Mid-Boss
- **Location**: `src/core/entities/enemies/MidBossVehicle.ts` lines 129, 305–309, 354–358, 521–555:
  - `spawnTimer: number = 8.0` / `12.0` (decremented by `dt`).
  - At timeout, calls `trySpawnTroops()`.
  - Instantiates `new SoldierEnemy(...)` at `hatchPos` ($X \approx \text{vehicle.x} + \text{width} - 20$, $Y = \text{position.y} + \text{height} - 38$), dropping a minion directly onto the vehicle body inside the active screen.

---

## 2. Logic Chain

1. **Why enemies "do not appear properly"**:
   - `SoldierEnemy` interprets `position.y` as the top-left coordinate. With `height = 38`, its feet are at `y + 38`.
   - `src/main.ts` mistakenly treats `y` as the foot coordinate (like `PlayerController`), passing `y = 230`.
   - The feet start at $Y = 268$, $38\text{px}$ below the platform top surface ($Y = 230$).
   - `PlatformPhysics.resolveGroundContact` checks `prevFootY <= platTop + 4.0`. $268 \le 234$ is false, so ground contact fails.
   - The soldier falls through the floor and within 30 frames ($0.5\text{s}$) exceeds $Y = 320$.
   - `StageManager.despawnOffscreenEntities` immediately kills and unregisters any minion with $Y > 320$.
   - Consequently, wave enemies either vanish after 9 frames of falling or despawn entirely before reaching the viewport.
   - By changing spawn Y to `230 - 38 = 192`, `prevFootY` becomes $230$, ground contact succeeds, `isGrounded` becomes true, and the soldier stays on the platform.

2. **Why POWs "spawn out of nowhere"**:
   - `PowEntity` instances were wired into runtime wave triggers (`trigger_wave_1`, `trigger_wave_2`, `trigger_wave_3`) instead of being static level entities.
   - When the player trips `triggerX = 180`, `pow_1` is created right at $(180, 175)$, which is the exact location of the player.
   - When the player trips `triggerX = 420` and `triggerX = 1240`, `pow_2` ($X = 640$) and `pow_3` ($X = 1360$) are well within the visible viewport frustum, appearing out of thin air.
   - POWs in classic Metal Slug are static fixtures already tied to platforms or scenery. Moving them to static level generation (`StageData.pows`) guarantees they are pre-placed and only discovered as the player advances the camera.

3. **Why enemies freeze after entering**:
   - `SoldierEnemy.transitionToNormalRoleAI()` resets $v_x = 0$ for `SOLDIER_KNIFE` and `SOLDIER_GRENADE`.
   - Their AI requires the player to be within $180\text{px}$ to activate a charge. At camera position $0$ and player at $80$, the minion at $460$ is $380\text{px}$ away and never wakes up.
   - Changing the transition to forward advance ($v_x = -70\text{ px/s}$ for knife, $v_x = -50\text{ px/s}$ for grenade) allows them to smoothly continue into combat range.

4. **Off-Screen Spawning Formula**:
   - Visible viewport right edge: $X_{\text{viewMax}} = \text{cameraX} + 480$.
   - Safety margin to account for camera shake ($12\text{px}$) and ingress speed ($110\text{ px/s} \times 0.016\text{s} \approx 2\text{px}$): $\text{margin} = 40\text{px}$.
   - Minimum spawn base: $X_{\text{spawnBase}} = \text{cameraX} + 520$.
   - Echelon stagger: Minion $i$ spawns at $X = X_{\text{spawnBase}} + i \times 40$.
   - This mathematically guarantees $X_{\text{spawn}} \ge \text{cameraX} + 520 > \text{cameraX} + 480$ under all circumstances.

---

## 3. Caveats

1. **Player vs Enemy Y-Anchor Convention**:
   - `PlayerController` uses the **foot anchor** as its `position` (`position.y = 230` is the foot touching the ground at 230; bounding box extends up to $230 - 40 = 190$).
   - `PowEntity` uses the **foot anchor** as its `position` (`position.y = 175` is the foot touching the dock at 175; bounding box extends up to $175 - 32 = 143$).
   - `SoldierEnemy` uses the **top-left corner** as its `position` (`position.y = 192` is top-left, feet extend down to $192 + 38 = 230$).
   - `CanvasRenderer` line 303 accounts for this by passing `y: soldier.position.y + soldier.height` to the renderer. We must preserve this distinction or document it clearly so future developers do not reintroduce the bug.
2. **Elevated Platforms**:
   - When placing minions on elevated platforms (e.g., `bridge_1` at $Y = 140$ or `bunker_2` at $Y = 175$), `position.y` must be set to $\text{platformTop} - 38$ (e.g. $140 - 38 = 102$).
3. **Mid-Boss Hatch Spawn**:
   - While `MidBossVehicle` uses a timer to spawn reinforcements, having them pop on top of the tank hull is jarring. We propose routing reinforcement spawns to enter from the off-screen right edge ($\max(\text{cameraX} + 520, 1220)$) or giving the hatch spawn a parabolic ejection impulse ($v_y = -100\text{ px/s}$) with a hatch opening sound effect.

---

## 4. Conclusion & Concrete Overhaul Plan

### Core Principles of the Rewrite
1. **POWs**: 100% pre-placed statically at stage load time. Removed completely from dynamic trigger spawn actions.
2. **Minion Waves**: Spawned strictly out-of-bounds ($X \ge \text{cameraX} + 520$) via player advance triggers.
3. **Correct Ground Y**: All ground minions spawned at `Y = 230 - 38 = 192`.
4. **Smooth Ingress AI**: Minions enter in `INGRESS` ($v_x = -110\text{ px/s}$), then smoothly transition to advancing combat states, never freezing at the viewport boundary.
5. **Mid-Boss Reinforcements**: Off-screen ingress support waves instead of hull popping.

### Detailed Implementation Blueprint

#### File 1: `src/core/engine/StageManager.ts`
1. Expand `StageData` interface to support static pre-placed POWs:
   ```typescript
   export interface StaticPowData {
     id: string;
     position: Vector2D;
     dropType: ItemDropType;
   }

   export interface StageData {
     id: string;
     name: string;
     width: number;
     height: number;
     initialCameraBounds: CameraBounds;
     platforms: Platform[];
     triggers: StageTrigger[];
     pows?: StaticPowData[];
   }
   ```
2. Update `StageManager.loadStage(stageData)` to automatically instantiate static POWs into the engine:
   ```typescript
   if (stageData.pows) {
     for (const p of stageData.pows) {
       this.engine.addEntity(new PowEntity(p.id, p.position, p.dropType));
     }
   }
   ```

#### File 2: `src/main.ts`
1. Remove all `PowEntity` additions from `triggers`.
2. Add `pows` array to `buildStage1Data()`:
   ```typescript
   const pows: StaticPowData[] = [
     // POW 1: Sitting tied on elevated wooden pier dock 1
     { id: 'pow_1', position: vec2(180, 175), dropType: ItemDropType.WEAPON_HMG },
     // POW 2: Tied on ground ahead of reinforced redoubt
     { id: 'pow_2', position: vec2(640, 230), dropType: ItemDropType.WEAPON_FLAME },
     // POW 3: Tied on elevated wooden bridge 2 in Section 2
     { id: 'pow_3', position: vec2(1360, 165), dropType: ItemDropType.GRENADE_CRATE },
     // POW 4: Tied on top of defense bunker 2 before boss arena
     { id: 'pow_4', position: vec2(1710, 175), dropType: ItemDropType.WEAPON_HMG },
   ];
   ```
3. Fix all enemy spawn Y coordinates to `192` (foot at $230$) in `triggers`:
   ```typescript
   // Trigger Wave 1: First skirmish at X = 180
   {
     id: 'trigger_wave_1',
     triggerX: 180,
     triggered: false,
     spawnAction: (eng: GameEngine, cameraX: number = 0) => {
       const spawnBaseX = cameraX + 520;
       // Rebel Rifleman (foot at 230 -> y = 192)
       eng.addEntity(new SoldierEnemy('rebel_rifle_1', 'SOLDIER_RIFLE', vec2(spawnBaseX, 192), { cameraX }));
       // Rebel Knife Charger (staggered +40px)
       eng.addEntity(new SoldierEnemy('rebel_knife_1', 'SOLDIER_KNIFE', vec2(spawnBaseX + 40, 192), { cameraX }));
     },
   },

   // Trigger Wave 2: Fortified redoubt at X = 420
   {
     id: 'trigger_wave_2',
     triggerX: 420,
     triggered: false,
     spawnAction: (eng: GameEngine, cameraX: number = 0) => {
       const spawnBaseX = cameraX + 520;
       eng.addEntity(new SoldierEnemy('rebel_shield_1', 'SOLDIER_SHIELD', vec2(spawnBaseX, 192), { cameraX }));
       eng.addEntity(new SoldierEnemy('rebel_grenade_1', 'SOLDIER_GRENADE', vec2(spawnBaseX + 40, 192), { cameraX }));
       eng.addEntity(new SoldierEnemy('rebel_rifle_2', 'SOLDIER_RIFLE', vec2(spawnBaseX + 80, 192), { cameraX }));
     },
   },

   // Trigger Mid-Boss Support at X = 740
   {
     id: 'trigger_mid_boss',
     triggerX: 740,
     triggered: false,
     lockCameraBounds: { minX: 720, maxX: 1200, minY: 0, maxY: 270 },
     spawnAction: (eng: GameEngine, cameraX: number = 0) => {
       this.stageManager.setState(StageState.MID_BOSS_BATTLE);
       const midBoss = new MidBossVehicle('mid_boss_1', vec2(1050, 162), {
         customHp: 320,
         patrolMinX: 800,
         patrolMaxX: 1150,
       });
       eng.addEntity(midBoss);
       const spawnBaseX = Math.max(cameraX + 520, 1220);
       eng.addEntity(new SoldierEnemy('rebel_mb_support', 'SOLDIER_RIFLE', vec2(spawnBaseX, 192), { cameraX }));
     },
     isCompleted: (eng: GameEngine) => {
       const mb = eng.getEntity('mid_boss_1');
       return !mb || !mb.isAlive;
     },
   },

   // Trigger Wave 3: Section 2 Advance at X = 1240
   {
     id: 'trigger_wave_3',
     triggerX: 1240,
     triggered: false,
     spawnAction: (eng: GameEngine, cameraX: number = 0) => {
       this.stageManager.setState(StageState.SECTION_2_ADVANCE);
       const spawnBaseX = cameraX + 520;
       eng.addEntity(new SoldierEnemy('rebel_knife_2', 'SOLDIER_KNIFE', vec2(spawnBaseX, 192), { cameraX }));
       eng.addEntity(new SoldierEnemy('rebel_shield_2', 'SOLDIER_SHIELD', vec2(spawnBaseX + 40, 192), { cameraX }));
       eng.addEntity(new SoldierEnemy('rebel_grenade_2', 'SOLDIER_GRENADE', vec2(spawnBaseX + 80, 192), { cameraX }));
     },
   },
   ```

#### File 3: `src/core/entities/enemies/SoldierEnemy.ts`
Fix `transitionToNormalRoleAI()` so enemies keep moving towards the player after completing ingress instead of freezing at $v_x = 0$:
```typescript
private transitionToNormalRoleAI(): void {
  switch (this.role) {
    case 'RIFLE':
      this.patrolMinX = this.position.x - 100;
      this.patrolMaxX = this.position.x + 20; // Keep within viewport!
      this.velocity.x = this.facing * this.walkSpeed;
      this.transitionTo('PATROL');
      break;
    case 'KNIFE':
      // Advance toward the player instead of freezing
      this.velocity.x = this.facing * 70;
      this.transitionTo('PATROL');
      break;
    case 'GRENADE':
      // Advance toward optimal standoff range
      this.velocity.x = this.facing * 50;
      this.transitionTo('SEEK_STANDOFF');
      break;
    case 'SHIELD':
      this.velocity.x = this.facing * 45;
      this.transitionTo('GUARD_ADVANCE');
      break;
  }
}
```

#### File 4: `src/core/entities/enemies/MidBossVehicle.ts`
Route reinforcement soldiers to enter smoothly from off-screen right ($X \ge 1220$) with `INGRESS`:
```typescript
const spawnX = Math.max((engine as any)?.cameraX ? (engine as any).cameraX + 520 : 1220, 1220);
const soldier = new SoldierEnemy(
  `midboss_add_${this.id}_${Date.now()}_${Math.random()}`,
  selectedType,
  vec2(spawnX, 192),
  { cameraX: (engine as any)?.cameraX ?? 720 }
);
```

---

## 5. Verification Method

Independent test verification commands to validate this overhaul:

1. **Verify Enemy Ground Stays Intact & Does Not Fall**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame();
   game.player.position.x = 180;
   game.step(1/60); // triggers wave 1
   for (let i = 0; i < 60; i++) game.step(1/60);
   const rifleman = game.engine.getEntity('rebel_rifle_1');
   if (!rifleman || !rifleman.isAlive || (rifleman as any).position.y > 200) {
     console.error('FAIL: Rifleman fell through ground or despawned!');
     process.exit(1);
   }
   console.log('SUCCESS: Rifleman alive on ground at y =', rifleman.position.y);
   "
   ```
2. **Verify POW Pre-Placement & Zero Popping**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame();
   const pow1 = game.engine.getEntity('pow_1');
   const pow2 = game.engine.getEntity('pow_2');
   if (!pow1 || !pow2) {
     console.error('FAIL: POWs not pre-placed in engine at stage load!');
     process.exit(1);
   }
   console.log('SUCCESS: POW 1 and POW 2 pre-placed at load time.');
   "
   ```
3. **Verify Out-of-Bounds Invariant Across All Triggers**:
   ```bash
   npx vitest run tests/unit/stage_spawning_despawn.test.ts
   npx vitest run tests/unit/empirical_physics_spawning_challenge.test.ts
   ```
4. **Visual & Headless E2E Verification**:
   ```bash
   npx playwright test tests/e2e/visual_verification.spec.ts
   ```
   Assert that `screenshot_04_enemy_smooth_spawn.png` captures the soldier running in at $Y = 192$ with his feet planted firmly at $Y = 230$.
