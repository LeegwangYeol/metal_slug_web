# Milestone M3 Investigation & Architectural Blueprint: Ultimate Move System & Procedural Sprites / Cinematic FX

## Executive Summary
This report provides the complete architectural blueprint and interface specification for Milestone M3 (**Ultimate Move System & Procedural Sprites / Cinematic FX**). All 31 existing test suites (389 tests) are currently 100% green. The investigation confirmed that `src/core/player/UltimateManager.ts` does not yet exist and must be created. Furthermore, an essential discovery regarding key mappings was made: `KeyX` is already bound to `jump` and enforced by an existing test (`tests/unit/adversarial_controls_jump.test.ts`), so `KeyU` must serve as the dedicated ultimate move trigger key. A 4-phase cinematic state machine, viewport-bounded entity query, audio synthesis hooks, and procedural sprite cache isolation (preserving the 164 baseline invariant) have been mapped out with exact interface contracts.

---

## 1. Observation

### 1.1 Existing Files and Code Structure
1. **Input Architecture**:
   - `src/core/input/InputHandler.ts` does **not** exist.
   - Input is implemented via `src/input/KeyboardController.ts` and `src/input/TouchVirtualPad.ts`.
   - In `src/input/KeyboardController.ts` lines 77–81:
     ```ts
     // Jump: Space, KeyK, KeyX
     Space: 'jump',
     KeyK: 'jump',
     KeyX: 'jump',
     ```
   - In `tests/unit/adversarial_controls_jump.test.ts` lines 7–12:
     ```ts
     it('1.1: Rapid keydown/keyup sequence within a single frame tick across all jump keys (Space, KeyK, KeyX)', () => {
       const jumpKeys = [
         { code: 'Space', key: ' ' },
         { code: 'KeyK', key: 'k' },
         { code: 'KeyX', key: 'x' },
       ];
     ```
     **Direct Evidence**: Changing `KeyX` away from `jump` will fail `tests/unit/adversarial_controls_jump.test.ts`. `KeyU` (and `'u'` key fallback) must be used for the ultimate move action.
   - `PlayerInputSnapshot` in `src/core/player/PlayerKinematics.ts` lines 38–48 currently defines:
     `{ left, right, up, down, jumpPressed, jumpHeld, shootPressed, shootHeld, grenadePressed }`.
     It does not yet include `ultimatePressed`.

2. **Player Controller State**:
   - `src/core/player/PlayerController.ts` lines 41–47: contains `health`, `maxHealth`, `lives`, `score`, `rescuedPowCount`, `shieldCharges`.
   - Lines 238–247: handles shoot and grenade inputs, but does not yet process ultimate moves.
   - `UltimateManager.ts` does **not** exist in `src/core/player/`.

3. **StageManager, Camera, and Viewport Coordinates**:
   - In `src/core/engine/StageManager.ts` lines 89–95:
     ```ts
     getCameraBounds(): CameraBounds {
       return this.cameraBounds;
     }

     getCameraX(): number {
       return this.currentCameraX;
     }
     ```
   - In `src/core/engine/StageManager.ts` lines 127–130:
     ```ts
     update(cameraX: number, playerX: number): void {
       this.currentCameraX = cameraX;
       (this.engine as any).cameraX = cameraX;
     ```
   - `StageManager` does not yet possess a `getCamera()` method returning viewport dimensions `{ x, y, width, height }` or `getViewportBoundingBox(): AABB`.
   - In `src/render/Camera.ts` lines 20–25 & 240–248:
     - `viewportWidth: 480`, `viewportHeight: 270`.
     - `isVisible(box: AABB)` checks intersection between `box` and `{ x: this.renderX, y: this.renderY, width: 480, height: 270 }`.

4. **Enemy & Boss Entity Interfaces**:
   - Standard Minions (`SoldierEnemy.ts` lines 206–216): implements `takeDamage(amount: number, sourceType: DamageSourceType, origin?: Vector2D): boolean`. Passing `sourceType = 'explosion'` pierces shields (`role === 'SHIELD'`) and marks `deathType = 'explosion'` (lines 1137–1142 & 1168).
   - Mid-Boss Vehicle (`MidBossVehicle.ts` lines 562–600): implements `takeDamage(amount: number, sourceType: DamageSourceType): boolean`. Respects health gates at 240 HP and 80 HP.
   - End-Bosses (`TetsuyukiBoss.ts` line 674, `IronNokanaBoss.ts` line 549): implement `takeDamage(amount: number, isWeakPoint?: boolean): void`.

5. **ProceduralSpriteFactory Baseline Invariant (164 Keys)**:
   - In `src/render/sprites/ProceduralSpriteFactory.ts` lines 402–407:
     ```ts
     public getAllKeys(includePolish: boolean = false): string[] {
       if (includePolish) {
         return Array.from(this.spriteCache.keys());
       }
       return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
     }
     ```
   - In `tests/unit/adversarial_sprites_crosshairs.test.ts` line 199:
     `expect(allKeys.length).toBe(164);`
     `getAllKeys()` with default arguments **must** return exactly 164 keys. Any expansion sprites (bomber, airstrike, shockwaves) must be registered under `expansionKeys: Set<string>` and excluded when `includeExpansion` is false.

6. **SoundEngine Capabilities**:
   - `src/audio/SoundEngine.ts` uses procedural Web Audio oscillators, noise buffers, and biquad filters.
   - Does not currently have an `AIR_RAID_SIREN` preset or `playAirRaidSiren()` method.

---

## 2. Logic Chain

1. **Input Key Mapping**:
   - *Premise*: The user request mentions `KeyU` and references `KeyX` / button triggers from COLLABORATION.md.
   - *Observation*: `KeyboardController.ts` lines 77–80 already map `KeyX` to `jump`, which is asserted by `adversarial_controls_jump.test.ts`.
   - *Deduction*: We must **not** rebind `KeyX`. We must map `KeyU` (and `'u'`) to a dedicated `'ultimate'` action in `KeyboardController.ts`. Adding `ultimatePressed?: boolean` to `PlayerInputSnapshot` allows transparent consumption without breaking any existing test creating snapshots.

2. **Simulation Decoupling & Viewport Determination**:
   - *Premise*: The simulation core (`src/core/`) must remain headless and runnable without DOM/Canvas.
   - *Observation*: `StageManager.update(cameraX, playerX)` sets `this.currentCameraX = cameraX` and `(engine as any).cameraX = cameraX`.
   - *Deduction*: Adding `getCamera()` and `getViewportBoundingBox()` to `StageManager` allows both headless simulation/tests and the runtime game to retrieve `{ x: cameraX, y: 0, width: 480, height: 270 }`. If `stageManager` is not attached to an engine in an isolated unit test, `UltimateManager` can fallback to `(engine as any).cameraX` or the player's position, ensuring 100% test robustness.

3. **4-Phase Cinematic Pipeline**:
   - *Phase 1 (Freeze Frame & Siren, ~0.5s)*:
     - Player movement and enemy behavior are frozen.
     - Event `ultimate_freeze_start` is emitted with duration `0.5`.
     - Event `play_sound` with `sfx_air_raid_siren` is dispatched.
   - *Phase 2 (Tactical Strike Pass, ~0.8s)*:
     - A Heavy Bomber aircraft traverses horizontally across the viewport from `cameraX - 100` to `cameraX + 540`.
     - `strikePassProgress` advances from `0.0` to `1.0`.
     - Engine audio `sfx_bomber_flyover` and smoke contrail particles are generated.
   - *Phase 3 (Screen Detonation Shockwave, ~0.5s)*:
     - Detonation event `ultimate_detonation_start` fires at $t = 0$ of Phase 3.
     - Screen shake `camera_shake` (intensity 14, duration 0.6s) and heavy blast SFX `sfx_heavy_detonation`.
     - **Minion Wipe**: 100% of standard on-screen minions (`SoldierEnemy` of all types, bullets, grenades, shells) within the active viewport AABB are destroyed using `takeDamage(999, 'explosion')` and `isAlive = false`.
     - **Boss Damage**: All bosses/mid-bosses (`MidBossVehicle`, `TetsuyukiBoss`, `IronNokanaBoss`) within the active viewport receive exactly 120 burst damage.
     - Friendly entities (`PLAYER`, `ALLY_NPC`, `ALLY_PROJECTILE`, `POW`, `ITEM_PICKUP`) are strictly unharmed.
   - *Phase 4 (Recovery, ~0.3s)*:
     - Smoke and flash dissipate, time unfreezes, and player locomotion is restored.
     - State transitions back to `IDLE`. Event `ultimate_completed` is emitted.

4. **Preserving the 164 Sprite Key Baseline Invariant**:
   - `getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[]`
   - Default `getAllKeys()` filters out both `polishKeys` and `expansionKeys`, returning exactly 164 keys.

---

## 3. Caveats

1. **MidBossVehicle Health Gates**: `MidBossVehicle` clamps health at 240 HP (Gate 1) and 80 HP (Gate 2). If its HP is 260 and it takes 120 damage, its HP will clamp to 240 as designed by the gate transition. This is normal game behavior and must be accounted for in tests.
2. **Iron Nokana Phase Transitions**: Similarly, `IronNokanaBoss` has phase thresholds at 300 HP (75%), 200 HP (50%), and 100 HP (25%). When dealt 120 damage, it transitions cleanly to the appropriate next phase.
3. **Audio Synthesis in Headless Vitest**: Web Audio `AudioContext` is mocked or absent in Node.js Vitest environments. All sound triggers must emit through `engine.eventBus.emit('play_sound', { sound })`, which executes headlessly without error.

---

## 4. Conclusion & Architectural Blueprint for Worker

### 4.1 New Class: `src/core/player/UltimateManager.ts`
```ts
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { AABB, createAABB, BoundingBox } from '../physics/AABB';
import { PlayerController } from './PlayerController';
import { SoldierEnemy } from '../entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from '../entities/boss/TetsuyukiBoss';
import { IronNokanaBoss } from '../entities/boss/IronNokanaBoss';

export enum UltimatePhase {
  IDLE = 'IDLE',
  PHASE_1_FREEZE = 'PHASE_1_FREEZE',
  PHASE_2_STRIKE_PASS = 'PHASE_2_STRIKE_PASS',
  PHASE_3_DETONATION = 'PHASE_3_DETONATION',
  PHASE_4_RECOVERY = 'PHASE_4_RECOVERY',
}

export interface UltimateConfig {
  freezeDuration?: number;     // 0.5s
  strikePassDuration?: number; // 0.8s
  detonationDuration?: number; // 0.5s
  recoveryDuration?: number;   // 0.3s
  bossDamage?: number;         // 120.0
}

export interface DetonationResult {
  minionsCleared: number;
  bossesHit: number;
  bossDamageDealt: number;
  culledProjectiles: number;
}

export class UltimateManager {
  public phase: UltimatePhase = UltimatePhase.IDLE;
  public phaseTimer: number = 0;
  public totalTime: number = 0;
  public stock: number = 1;
  public maxStock: number = 3;

  public readonly freezeDuration: number;
  public readonly strikePassDuration: number;
  public readonly detonationDuration: number;
  public readonly recoveryDuration: number;
  public readonly bossDamage: number;

  public strikePassProgress: number = 0; // 0.0 to 1.0
  public strikePassX: number = 0;
  public strikePassY: number = 0;
  public detonationExecuted: boolean = false;
  public lastResult: DetonationResult | null = null;

  constructor(config: UltimateConfig = {}) {
    this.freezeDuration = config.freezeDuration ?? 0.5;
    this.strikePassDuration = config.strikePassDuration ?? 0.8;
    this.detonationDuration = config.detonationDuration ?? 0.5;
    this.recoveryDuration = config.recoveryDuration ?? 0.3;
    this.bossDamage = config.bossDamage ?? 120.0;
  }

  public get isActive(): boolean {
    return this.phase !== UltimatePhase.IDLE;
  }

  public canTrigger(): boolean {
    return !this.isActive && this.stock > 0;
  }

  public trigger(engine: GameEngine, player?: PlayerController): boolean {
    if (!this.canTrigger()) return false;

    this.stock--;
    this.phase = UltimatePhase.PHASE_1_FREEZE;
    this.phaseTimer = this.freezeDuration;
    this.totalTime = 0;
    this.strikePassProgress = 0;
    this.detonationExecuted = false;
    this.lastResult = null;

    engine.eventBus.emit('ultimate_freeze_start', { duration: this.freezeDuration });
    engine.eventBus.emit('play_sound', { sound: 'sfx_air_raid_siren' });

    return true;
  }

  public update(dt: number, engine: GameEngine, cameraX?: number): void {
    if (this.phase === UltimatePhase.IDLE) return;

    this.totalTime += dt;
    this.phaseTimer -= dt;

    const currentCamX = cameraX ?? (engine as any).cameraX ?? 0;

    switch (this.phase) {
      case UltimatePhase.PHASE_1_FREEZE:
        if (this.phaseTimer <= 0) {
          this.phase = UltimatePhase.PHASE_2_STRIKE_PASS;
          this.phaseTimer = this.strikePassDuration;
          engine.eventBus.emit('ultimate_strike_pass_start', { type: 'HEAVY_BOMBER' });
          engine.eventBus.emit('play_sound', { sound: 'sfx_bomber_flyover' });
        }
        break;

      case UltimatePhase.PHASE_2_STRIKE_PASS: {
        const progress = Math.min(1.0, Math.max(0.0, 1.0 - this.phaseTimer / this.strikePassDuration));
        this.strikePassProgress = progress;
        this.strikePassX = currentCamX - 100 + progress * (480 + 200);
        this.strikePassY = 45;

        if (this.phaseTimer <= 0) {
          this.phase = UltimatePhase.PHASE_3_DETONATION;
          this.phaseTimer = this.detonationDuration;
          this.executeDetonation(engine, currentCamX);
        }
        break;
      }

      case UltimatePhase.PHASE_3_DETONATION:
        if (this.phaseTimer <= 0) {
          this.phase = UltimatePhase.PHASE_4_RECOVERY;
          this.phaseTimer = this.recoveryDuration;
          engine.eventBus.emit('ultimate_unfreeze');
        }
        break;

      case UltimatePhase.PHASE_4_RECOVERY:
        if (this.phaseTimer <= 0) {
          this.phase = UltimatePhase.IDLE;
          this.detonationExecuted = false;
          engine.eventBus.emit('ultimate_completed', this.lastResult);
        }
        break;
    }
  }

  public executeDetonation(engine: GameEngine, cameraX?: number, explicitViewport?: AABB): DetonationResult {
    const camX = cameraX ?? (engine as any).cameraX ?? 0;
    const viewport = explicitViewport ?? createAABB(camX, 0, 480, 270);

    let minionsCleared = 0;
    let bossesHit = 0;
    let bossDamageDealt = 0;
    let culledProjectiles = 0;

    const entities = engine.getAllEntities();

    for (const ent of entities) {
      if (!ent.isAlive) continue;

      // Friendly entities are exempt
      if (
        ent.id === 'player' ||
        ent.type === 'PLAYER' ||
        ent.type === 'ALLY_NPC' ||
        ent.type === 'ALLY_PROJECTILE' ||
        ent.type === 'POW' ||
        ent.type === 'ITEM_PICKUP'
      ) {
        continue;
      }

      // Check if entity is within active camera viewport
      if (!BoundingBox.intersects(ent.bounds, viewport)) {
        continue;
      }

      // Hostile Projectiles
      if (ent.type === 'ENEMY_BULLET' || ent.type === 'ENEMY_GRENADE' || ent.type === 'CANNON_SHELL') {
        ent.isAlive = false;
        engine.removeEntity(ent.id);
        culledProjectiles++;
        continue;
      }

      // Bosses / Mid-Bosses
      const isBoss =
        ent instanceof TetsuyukiBoss ||
        ent instanceof IronNokanaBoss ||
        ent instanceof MidBossVehicle ||
        ent.type.includes('BOSS');

      if (isBoss) {
        if (typeof (ent as any).takeDamage === 'function') {
          if (ent.type === 'MID_BOSS_VEHICLE') {
            (ent as any).takeDamage(this.bossDamage, 'explosion');
          } else {
            (ent as any).takeDamage(this.bossDamage, true);
          }
        } else if ((ent as any).health !== undefined) {
          (ent as any).health = Math.max(0, (ent as any).health - this.bossDamage);
        }
        bossesHit++;
        bossDamageDealt += this.bossDamage;
        continue;
      }

      // Standard Minions (100% Cleared)
      const isMinion =
        ent instanceof SoldierEnemy ||
        ent.type.startsWith('SOLDIER_') ||
        ent.type === 'minion';

      if (isMinion) {
        if (typeof (ent as any).takeDamage === 'function') {
          (ent as any).takeDamage(999, 'explosion');
        }
        ent.isAlive = false;
        if ((ent as any).health !== undefined) {
          (ent as any).health = 0;
        }
        minionsCleared++;
      }
    }

    this.detonationExecuted = true;
    this.lastResult = { minionsCleared, bossesHit, bossDamageDealt, culledProjectiles };

    engine.eventBus.emit('ultimate_detonation_start', this.lastResult);
    engine.eventBus.emit('camera_shake', { intensity: 14, duration: 0.6 });
    engine.eventBus.emit('play_sound', { sound: 'sfx_heavy_detonation' });

    return this.lastResult;
  }
}
```

### 4.2 Modifications to Existing Files

1. **`src/core/player/PlayerKinematics.ts`**:
   - In `PlayerInputSnapshot`: add `ultimatePressed?: boolean;`.

2. **`src/input/KeyboardController.ts`**:
   - Add `'ultimate'` to `KeyAction`.
   - Add `KeyU: 'ultimate'` in `codeMap`.
   - Add `case 'u': return 'ultimate';` in `resolveAction`.
   - Keep `KeyX: 'jump'` intact (preserving jump test contract).
   - In `getSnapshot()`: populate and clear `ultimatePressed`.

3. **`src/core/player/PlayerController.ts`**:
   - Instantiate `public readonly ultimateManager: UltimateManager = new UltimateManager();`.
   - Add `triggerUltimateMove(engine: GameEngine): boolean { return this.ultimateManager.trigger(engine, this); }`.
   - In `handleInput()`: if `input.ultimatePressed`, call `this.triggerUltimateMove(engine)`.
   - In kinematic update / step: advance `this.ultimateManager.update(timestep, engine, (engine as any).cameraX);`.

4. **`src/core/engine/StageManager.ts`**:
   - Add `getCamera(): { x: number; y: number; width: number; height: number }` returning `{ x: this.currentCameraX, y: 0, width: 480, height: 270 }`.
   - Add `getViewportBoundingBox(): AABB` returning `createAABB(this.currentCameraX, 0, 480, 270)`.

5. **`src/render/sprites/ProceduralSpriteFactory.ts`**:
   - Add `private expansionKeys: Set<string> = new Set([...]);`.
   - Update `getAllKeys(includePolish: boolean = false, includeExpansion: boolean = false): string[]` so `getAllKeys()` without arguments excludes `expansionKeys` and retains exactly 164 keys.
   - Add procedural sprite generation for:
     - `expansion_heavy_bomber_0`, `expansion_heavy_bomber_1`
     - `expansion_airstrike_bomb_0`, `expansion_airstrike_bomb_1`
     - `expansion_shockwave_ring_0`, `expansion_shockwave_ring_1`

6. **`src/audio/AudioTypes.ts` & `src/audio/SoundEngine.ts`**:
   - Add `'AIR_RAID_SIREN'` and `'HEAVY_DETONATION'` to `SoundEffectType`.
   - Implement `playAirRaidSiren()` with dual-tone frequency modulation sweep (500Hz to 850Hz).

7. **`src/render/CanvasRenderer.ts`**:
   - Add ultimate FX rendering pass for screen freeze tint, bomber flyover sprite, detonation flash, and expanding shockwave rings.

---

## 5. Verification Method

To independently verify the implementation, the Worker and Challenger should run:

1. **Unit Test Suite**:
   - New suite: `tests/unit/ultimate_move_system.test.ts`.
   - Assert:
     - `KeyboardController` generates `ultimatePressed: true` on `KeyU`.
     - `KeyX` still generates `jumpPressed: true` and does not trigger ultimate.
     - `player.triggerUltimateMove(engine)` returns `true` on initial trigger and `false` when already active or stock is 0.
     - 4-phase sequence advances from `PHASE_1_FREEZE` -> `PHASE_2_STRIKE_PASS` -> `PHASE_3_DETONATION` -> `PHASE_4_RECOVERY` -> `IDLE`.
     - Standard minions in active viewport are 100% destroyed (health = 0, isAlive = false, deathType = 'explosion').
     - Minions outside viewport are 100% unharmed.
     - Bosses in viewport take exactly 120 damage.
     - Bosses outside viewport take 0 damage.
     - `ProceduralSpriteFactory.getInstance().getAllKeys().length === 164`.

2. **Full Regression Check**:
   ```bash
   npx vitest run
   ```
   Must exit with code 0 and 100% passing tests (zero regressions).

3. **TypeScript Build Check**:
   ```bash
   npm run build
   ```
   Must produce zero compiler errors.
