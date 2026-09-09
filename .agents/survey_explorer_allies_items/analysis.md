# Metal Slug Web Massive Expansion: Technical Architecture & Implementation Survey
## Subsystems: Autonomous Ally NPCs, Diverse Items & Power-ups, and Ultimate Move Mechanic

- **Survey Agent**: `survey_explorer_allies_items`
- **Date**: 2026-09-04
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_allies_items`
- **Scope**: Complete investigation of Player, Weapons, Projectiles, Enemies, Items, and Input systems to formulate a production-ready expansion architecture.

---

## 1. Executive Summary

This survey establishes the complete technical blueprint for Milestone Expansion R2:
1. **Autonomous Ally NPCs**: Introducing autonomous companions (e.g. Hyakutaro Ichimonji firing ki blasts, or liberated combat POWs) that spawn, follow the player, acquire enemy targets, and deal damage completely independently of player inputs.
2. **Diverse Items & Power-ups**: Expanding collectible pickups beyond H/F/G to include Shotgun (spread cone & kinetic knockback), Laser Gun (piercing continuous beam), Rocket Launcher (homing & explosive AOE), Medkits (HP restoration), and Shields (temporary damage absorption).
3. **Ultimate Move Mechanic**: A spectacular screen-clearing tactical attack (e.g. SV-001 Kamikaze Charge / Heavy Bomber Airstrike) triggered by player input, accompanied by screen freeze/flash, emergency siren klaxon, visual strike pass, and full-viewport minion elimination + massive boss burst damage.
4. **Automated Testing Suite**: A rigorous Vitest unit testing and Playwright E2E browser verification strategy asserting autonomous targeting, diverse weapon physics, and screen-clearing damage dispatch.

---

## 2. Baseline Codebase Architecture & System Survey

### 2.1 Player Controller (`src/core/player/`)
- **`PlayerController.ts`**:
  - Implements `GameEntity` with AABB bounding box and 60Hz Euler integration.
  - Locomotion handled via `PlayerKinematics` (run speed: 132 px/s, crawl speed: 54 px/s, jump impulse: -360 px/s, gravity: 800 px/s²).
  - Combat arbitration: Knife melee slash priority over ranged shooting within 38px scan box (`scanMeleeTarget`).
  - Health & Lives: `health = 1.0`, `maxHealth = 1.0`, `lives = 3`. Respawn provides 2.0s invulnerability.
  - Item Pickup Handling (`onCollision` lines 567-578):
    ```ts
    if (other.type === 'ITEM_PICKUP') {
      const dropType = (other as any).dropType as ItemDropType;
      if (dropType) {
        this.weaponManager.applyItemPickup(dropType, engine);
        (other as any).isAlive = false;
      }
    }
    ```
  - **Identified Gaps for Expansion**:
    - No shield hit absorption mechanism (`shieldCharges` or `shieldTimer`).
    - Health is currently binary/hardcoded to 1.0; no support for fractional damage or Medkit HP restoration.
    - No Ultimate Move trigger handler or gauge tracking in player state.

### 2.2 Weapons & Projectiles (`src/core/weapons/`)
- **`WeaponTypes.ts`**:
  - Currently defines:
    - `WeaponType = 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT'`.
    - `WEAPON_CONFIGS`: Configs for Pistol (cooldown: 9, 660 px/s), HMG (cooldown: 4, 780 px/s), Flame (cooldown: 18, 330 px/s, piercing).
    - `ItemDropType`: `WEAPON_HMG`, `WEAPON_FLAME`, `GRENADE_CRATE`, and 4 score items.
    - `POW_LOOT_TABLE`: Weighted array (HMG 35%, Flame 25%, Grenade 20%, Score items 20%).
- **`WeaponManager.ts`**:
  - Manages `activeWeapon`, `ammoPool`, `grenadeCount`, and `cooldownTimer`.
  - Coordinates with `ProjectileManager`.
  - Implements HMG angular sweeping (12 rad/s) and spray jitter (±2.5°).
  - Handles automatic fallback to `PISTOL` when ammo hits 0.
- **`ProjectileManager.ts`**:
  - Spawns `BulletProjectile` entities (`type: 'PROJECTILE'`).
  - Pistol enforces max 4 concurrent on-screen bullets.
  - Flame Shot features expanding radius (10px to 36px) and piercing tick immunity (6 frames / 0.1s per target).
  - Manages bouncing brass spent casings and ground fire AOEs.
- **Identified Gaps for Expansion**:
  - Missing `SHOTGUN`: Needs pellet cluster generator (7 pellets, ±14° spread, 0.18s lifetime, knockback impulse).
  - Missing `LASER_GUN`: Needs high-speed piercing beam ($v = 1200\text{ px/s}$), continuous beam trail.
  - Missing `ROCKET_LAUNCHER`: Needs homing kinematic steering ($\omega = 3.5\text{ rad/s}$), acceleration ($a = 750\text{ px/s}^2$), and 48px explosive blast AOE.
  - Missing `MEDKIT` and `SHIELD` in `ItemDropType` and `applyItemPickup`.

### 2.3 Enemy Targeting & Combat Invariants (`src/core/entities/enemies/`)
- **`EnemyTypes.ts` & `SoldierEnemy.ts`**:
  - Enemies: `SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`, `MID_BOSS_VEHICLE`.
  - Damage normalization: `takeDamage(amount, sourceType, origin)`.
  - When HP $\le 0$, emits `enemy_death` event with `deathType: 'standard' | 'explosion' | 'fire'`.
  - Target tracking: Enemies currently track `targetPlayer: TargetPlayer | null`.
- **Boss Entities (`src/core/entities/boss/`)**:
  - `TetsuyukiBoss.ts`: 3-Phase War Fortress (Phase 1: Artillery & Homing Rockets; Phase 2: Thermal Laser; Phase 3: Core Meltdown).
  - Rebalanced max HP: 400.
- **Hostage POWs (`src/core/entities/pow/PowEntity.ts`)**:
  - 6-State progression: `TIED_UP` -> `FREED` -> `SALUTE` -> `OFFERING_ITEM` -> `ESCAPING` -> `SAVED`.
  - Spawns `ItemPickupEntity` upon entering `OFFERING_ITEM`.

### 2.4 Input Handling (`src/input/`)
- **`KeyboardController.ts`**:
  - Maps: WASD / Arrows (aim/move), J/Z (fire), Space/K/X (jump), L/C (grenade), Enter/Esc (pause).
  - Outputs `PlayerInputSnapshot`: `{ left, right, up, down, jumpPressed, jumpHeld, shootPressed, shootHeld, grenadePressed }`.
  - **Gap**: Needs `ultimatePressed` mapped to `KeyU` (and alternate `KeyX` if configured).
- **`TouchVirtualPad.ts`**:
  - On-screen touch buttons: Fire, Jump, Grenade.
  - **Gap**: Needs an "ULT" tactical strike touch button.

### 2.5 Presentation & Audio (`src/render/`, `src/audio/`, `src/ui/`)
- **`CanvasRenderer.ts`**:
  - Virtual 480x270 letterbox canvas.
  - Passes: Parallax -> Platforms -> Entities -> Reticle -> Projectiles/Explosions -> HUD.
- **`HUDOverlay.ts`**:
  - Renders score, lives, weapon badge, ammo, grenades, rescued POWs, boss health bar.
- **`SoundEngine.ts` & `SpeechSynthesizer.ts`**:
  - Procedural Web Audio API sound generator + formant voice synthesis.

---

## 3. Subsystem 1: Autonomous Ally NPCs

### 3.1 Architectural Concept
In authentic Metal Slug (Metal Slug 2 / X), Hyakutaro Ichimonji is an elite martial artist POW who, when freed, stays alongside the player, mimics locomotion, tracks enemy targets, charges his inner spiritual energy, and unleashes destructive Ki Blasts (Hadouken energy waves) without any player commands.

```
+--------------------------------------------------------------------------+
|                            AllyNPC AI Loop                               |
|                                                                          |
|   +--------------+      Enemy Detected      +------------------------+   |
|   |  IDLE/FOLLOW | -----------------------> |     ACQUIRE_TARGET     |   |
|   +--------------+                          +------------------------+   |
|          ^                                               |               |
|          |                                               v               |
|   +--------------+      Emits KiBlast       +------------------------+   |
|   |   RECOVERY   | <----------------------- |      CHARGE_ATTACK     |   |
|   +--------------+                          +------------------------+   |
|          |                                                               |
|          v Boss Defeated / All Enemies Cleared                           |
|   +--------------+                                                       |
|   |  CELEBRATE   | (Martial arts victory salute)                         |
|   +--------------+                                                       |
+--------------------------------------------------------------------------+
```

### 3.2 Ally Class Hierarchy & Structure
- **Interface**: `AllyEntity extends GameEntity`
- **Class**: `AllyNPC` (`src/core/entities/allies/AllyNPC.ts`)
  ```ts
  export type AllyState =
    | 'SPAWN_SALUTE'
    | 'IDLE'
    | 'FOLLOW'
    | 'ACQUIRE_TARGET'
    | 'CHARGE_ATTACK'
    | 'FIRE_ATTACK'
    | 'RECOVERY'
    | 'CELEBRATE';

  export interface AllyConfig {
    subtype?: 'HYAKUTARO' | 'COMBAT_POW';
    followDistance?: number;    // Default: 45 px
    maxLeashDistance?: number;  // Default: 180 px
    visionRadius?: number;      // Default: 380 px
    attackCooldown?: number;    // Default: 1.2s
    chargeDuration?: number;    // Default: 0.35s (21 frames)
    kiDamage?: number;          // Default: 3.5 HP
  }
  ```

### 3.3 Target Acquisition & Autonomous Decision Engine
1. **Target Filtering**:
   - Queries `engine.getAllEntities()` or `engine.spatialGrid`.
   - Candidate criteria:
     - `isAlive === true`
     - `type.startsWith('SOLDIER') || type.includes('ENEMY') || type.includes('BOSS') || type === 'MID_BOSS_VEHICLE' || type === 'TETSUYUKI_BOSS'`
     - On-screen check: $|X_{candidate} - X_{camera}| \le 480$
     - Range check: $\sqrt{(X_E - X_A)^2 + (Y_E - Y_A)^2} \le R_{vision}$ (380 px).
2. **Prioritization Score**:
   $$\text{Score}(E) = W_{type}(E) \cdot 100 - \text{Dist}(A, E)$$
   where:
   - $W_{type}(\text{BOSS}) = 4$
   - $W_{type}(\text{MID\_BOSS}) = 3$
   - $W_{type}(\text{SOLDIER\_GRENADE}) = 2$
   - $W_{type}(\text{SOLDIER\_*}) = 1$
3. **Attack Dispatch**:
   - Orient facing towards target: `this.facing = target.position.x >= this.position.x ? 1 : -1`.
   - Charge duration: 21 frames (0.35s). Emits gathering ki particles.
   - Fire: Spawns `AllyKiBlast` projectile at $(x_{ally} + \text{facing} \cdot 16, y_{ally} - 16)$.
   - Sound: `sfx_ki_blast`.

### 3.4 Kinematics & Player Tethering Model
- Follow position:
  $$X_{target} = X_{player} - \text{facing}_{player} \cdot D_{follow} \quad (D_{follow} = 45\text{ px})$$
- Error: $e_x = X_{target} - X_{ally}$.
- Velocity assignment:
  - If $|e_x| \le 12\text{ px}$: $v_x = 0$ (Settles in place).
  - If $12 < |e_x| < 90\text{ px}$: $v_x = \text{sign}(e_x) \cdot 115\text{ px/s}$ (Walk).
  - If $|e_x| \ge 90\text{ px}$: $v_x = \text{sign}(e_x) \cdot 165\text{ px/s}$ (Sprint catch-up).
- Jump Trigger:
  - When $Y_{player} < Y_{ally} - 22\text{ px}$ (player is on an elevated platform), ally initiates jump with $v_y = -350\text{ px/s}$.
  - Ground collision resolved via `PlatformPhysics.resolveGroundContact`.

### 3.5 Autonomous Projectile: `AllyKiBlast` (`src/core/entities/allies/AllyKiBlast.ts`)
- `type: 'ALLY_PROJECTILE'`
- Kinematics: $v_x = \text{facing} \cdot 520\text{ px/s}$, $v_y = 0$ (or directed toward target vector).
- Bounds: $14 \times 14$ AABB.
- Damage: 3.5 HP (instantly kills standard soldiers [HP=1] and shield troopers [HP=2], chunks vehicles).
- Invariant & Safety:
  - Ignores player (`type === 'PLAYER'`).
  - Ignores other allies (`type === 'ALLY_NPC'`).
  - Hits enemy: calls `enemy.takeDamage(3.5, 'bullet', { x, y })`.

---

## 4. Subsystem 2: Diverse Items & Power-ups

### 4.1 New Weapon Specifications & Models

| Weapon | Type Key | Fire Rate | Ammo | Speed | Damage | Trajectory / Mechanics |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Shotgun** | `SHOTGUN` | 1.875/s (32f cd) | 30 | 680 px/s | 2.0 / pellet | Fan spread of 7 pellets ($\pm 14^\circ$), 0.18s lifetime, kinetic knockback (160 px/s). |
| **Laser Gun** | `LASER_GUN` | 15/s (4f cd) | 200 | 1200 px/s | 1.2 / tick | High-velocity continuous beam, 100% piercing through all targets, 0.1s tick immunity. |
| **Rocket Launcher** | `ROCKET_LAUNCHER` | 2.5/s (24f cd) | 30 | 220 $\to$ 650 | 8.0 AOE | Forward launch, accelerating ($a=750\text{ px/s}^2$), homing steering ($\omega=3.5\text{ rad/s}$), 48px blast. |

### 4.2 Power-up Items: Medkit and Shield
1. **Medkit (`ItemDropType.MEDKIT`)**:
   - Collectible medical supply crate.
   - Behavior upon player contact:
     - Restores `player.health` to `player.maxHealth` (full recovery).
     - If player is already at full health: awards +1 life (`player.lives++`) or score bonus +5,000.
     - Audio: `sfx_medkit_pickup`.
2. **Shield (`ItemDropType.SHIELD`)**:
   - High-tech tactical energy barrier.
   - Behavior upon pickup:
     - Sets `player.shieldCharges = 2` (absorbs 2 incoming hits of any damage type).
     - Visual: Orbiting cyan/gold hexagonal forcefield halo drawn around player bounding box.
     - In `PlayerController.takeDamage(amount)`:
       ```ts
       if (this.shieldCharges > 0) {
         this.shieldCharges--;
         this.invulnerabilityTimer = 0.5; // brief grace period
         engine.eventBus.emit('play_sound', { sound: 'sfx_shield_absorb' });
         engine.eventBus.emit('shield_hit', { remainingCharges: this.shieldCharges });
         if (this.shieldCharges <= 0) {
           engine.eventBus.emit('play_sound', { sound: 'sfx_shield_break' });
         }
         return; // Damage completely negated!
       }
       ```

### 4.3 Rebalanced Loot Distribution
Updated `POW_LOOT_TABLE` in `WeaponTypes.ts`:
```ts
export const POW_LOOT_TABLE: LootTableEntry[] = [
  { type: ItemDropType.WEAPON_HMG, weight: 18, ammoBonus: 200 },
  { type: ItemDropType.WEAPON_FLAME, weight: 14, ammoBonus: 30 },
  { type: ItemDropType.WEAPON_SHOTGUN, weight: 15, ammoBonus: 30 },
  { type: ItemDropType.WEAPON_LASER, weight: 15, ammoBonus: 200 },
  { type: ItemDropType.WEAPON_ROCKET, weight: 15, ammoBonus: 30 },
  { type: ItemDropType.GRENADE_CRATE, weight: 10, grenadeBonus: 10 },
  { type: ItemDropType.MEDKIT, weight: 8 },
  { type: ItemDropType.SHIELD, weight: 5 },
  { type: ItemDropType.SCORE_BANANA, weight: 2, scoreBonus: 500 },
  { type: ItemDropType.SCORE_CHICKEN, weight: 2, scoreBonus: 1000 },
  { type: ItemDropType.SCORE_COIN, weight: 1, scoreBonus: 100 },
];
```

---

## 5. Subsystem 3: Ultimate Move Mechanic

### 5.1 Tactical Concept
The Ultimate Move is a high-impact tactical screen-clearing intervention representing either:
1. **The SV-001 Kamikaze Charge ("Metal Slug Attack!")**: The iconic super vehicle charges across the battlefield with thrusters roaring, ramming all infantry and detonating at the screen center.
2. **Heavy Bomber Airstrike**: A Regular Army heavy bomber streaks across the top of the viewport dropping a carpet bomb cluster.

### 5.2 State Machine & Execution Pipeline (`UltimateManager.ts`)

```
 [IDLE (Gauge=100%)]
         |
         | Player presses KeyU / "ULT" button
         v
 [PHASE 1: FREEZE & SIREN (0.0s - 0.4s)]
   - Time dilation: World simulation frozen
   - Audio: Emergency klaxon siren sound
   - Visual: Screen flash white/red, "TACTICAL STRIKE INCOMING!" banner
   - Player: Invulnerability granted
         |
         v
 [PHASE 2: STRIKE PASS (0.4s - 1.2s)]
   - Visual strike entity streaks across viewport (X: cameraX-60 -> cameraX+540 at 900 px/s)
   - Blazing booster flame particles
         |
         v
 [PHASE 3: DETONATION & SCREEN CLEAR (1.2s - 2.0s)]
   - 8-point cascading massive explosions across viewport
   - Heavy camera shake: camera.shake(14.0, 0.8s)
   - Combat Dispatch:
     * Regular enemies in viewport take 999 damage -> explosion death with flying helmets
     * Hostile projectiles intercepted and cleared
     * Mid-Boss & End-Boss take 120 HP tactical burst damage
         |
         v
 [PHASE 4: RECOVERY (2.0s - 2.4s)]
   - Smoke dissipates, simulation resumes normal speed
   - Player invulnerability expires
   - Gauge resets to 0%
```

### 5.3 Resource & Charge Model
- `gauge: number` (0 to 100).
- Initialization: Starts at 100 (1 full stock) to enable immediate tactical access.
- Recharge rates:
  - Bullet damage: $+0.2\%$ per damage dealt.
  - Minion kill: $+4.0\%$.
  - Special vehicle / boss hit: $+1.5\%$.
  - Hostage POW rescue: $+15.0\%$.
- When `gauge >= 100`: HUD flashes `"ULT READY [U]"`.

---

## 6. Mathematical Models & Kinematic Formulas

### 6.1 Shotgun Pellet Fan Spread
- Number of pellets: $N = 7$.
- Angular spread width: $\Delta \theta = 28^\circ = 0.4887\text{ rad}$.
- Aim direction vector: $\vec{d} = (d_x, d_y)$, $\theta_0 = \text{atan2}(d_y, d_x)$.
- For each pellet $i \in \{0, \dots, 6\}$:
  $$\theta_i = \theta_0 + \left(\frac{i - 3}{3}\right) \cdot \frac{\Delta \theta}{2}$$
  $$\vec{v}_i = \begin{pmatrix} 680 \cdot \cos(\theta_i) \\ 680 \cdot \sin(\theta_i) \end{pmatrix}\text{ px/s}$$
- Lifetime limit: $T_{life} = 0.18\text{ s} \implies \text{Max Range} = 680 \times 0.18 = 122.4\text{ px}$.
- Kinetic knockback impulse applied to target:
  $$\vec{F}_{knockback} = \begin{pmatrix} \text{facing}_{player} \cdot 160 \\ -80 \end{pmatrix}\text{ px/s}$$

### 6.2 Rocket Launcher Homing Kinematics
- Initial velocity: $\vec{v}(0) = (\text{facing} \cdot 220, 0)\text{ px/s}$.
- Acceleration: $a = 750\text{ px/s}^2$ up to $v_{max} = 650\text{ px/s}$.
- Target angle: $\theta_{target} = \text{atan2}(Y_{target} - Y_{rocket}, X_{target} - X_{rocket})$.
- Angular difference: $\Delta \theta = \text{normalize\_angle}(\theta_{target} - \theta_{rocket})$.
- Steer rate: $\omega = \text{clamp}(\Delta \theta / \Delta t, -3.5, 3.5)\text{ rad/s}$.
- Velocity update:
  $$\theta_{rocket}(t + \Delta t) = \theta_{rocket}(t) + \omega \cdot \Delta t$$
  $$\vec{v}(t + \Delta t) = \min(650, \|\vec{v}(t)\| + a \cdot \Delta t) \cdot \begin{pmatrix} \cos(\theta_{rocket}) \\ \sin(\theta_{rocket}) \end{pmatrix}$$
- Area-of-effect blast damage:
  $$\text{Damage}(d) = 8.0 \cdot \max\left(0, 1 - \frac{d}{48}\right)$$

### 6.3 Ally Leash & Pacing Kinematics
- Target position: $X_T = X_{player} - \text{facing}_{player} \cdot 45\text{ px}$.
- Delta: $\Delta X = X_T - X_{ally}$.
- Ground horizontal speed:
  $$v_x = \begin{cases}
    0 & \text{if } |\Delta X| \le 12 \\
    \text{sign}(\Delta X) \cdot 115 & \text{if } 12 < |\Delta X| < 90 \\
    \text{sign}(\Delta X) \cdot 165 & \text{if } |\Delta X| \ge 90
  \end{cases}$$
- Vertical jump impulse: $v_y = -350\text{ px/s}$ if grounded and $Y_{player} < Y_{ally} - 22\text{ px}$.

---

## 7. Concrete File Inventory & Modifications

### 7.1 New Files to Create

1. `src/core/entities/allies/AllyTypes.ts`:
   - Type definitions: `AllyState`, `AllyConfig`, `AllyEntity`, `AllyTargetInfo`.
2. `src/core/entities/allies/AllyNPC.ts`:
   - Full autonomous companion entity (Hyakutaro Ichimonji).
   - State machine, target acquisition, charging animation, ki blast emission.
3. `src/core/entities/allies/AllyKiBlast.ts`:
   - High-damage autonomous energy projectile with enemy-only collision resolution.
4. `src/core/entities/allies/AllyManager.ts`:
   - Lifecycle manager handling ally summoning, persistence, and stage cleanup.
5. `src/core/player/UltimateManager.ts`:
   - Ultimate move state machine, cinematic timeline, screen-clearing damage query, and HUD gauge tracking.
6. `tests/unit/allies_system.test.ts`:
   - Vitest suite asserting autonomous targeting, damage dispatch, and locomotion.
7. `tests/unit/diverse_weapons_items.test.ts`:
   - Vitest suite asserting Shotgun spread/knockback, Laser penetration, Rocket homing/blast, Medkit healing, Shield absorption.
8. `tests/unit/ultimate_move_system.test.ts`:
   - Vitest suite asserting gauge accumulation, screen-wide minion clearing, and 120 HP boss damage.
9. `tests/e2e/ultimate_move_e2e.spec.ts`:
   - Playwright E2E browser test asserting KeyU input, screen clear verification, and artifact capture.

### 7.2 Existing Files to Modify

| File Path | Nature of Modification |
| :--- | :--- |
| `src/core/weapons/WeaponTypes.ts` | Add `SHOTGUN`, `LASER_GUN`, `ROCKET_LAUNCHER` to `WeaponType` & `WEAPON_CONFIGS`. Add `MEDKIT`, `SHIELD` to `ItemDropType`. Rebalance `POW_LOOT_TABLE`. |
| `src/core/weapons/WeaponManager.ts` | Add new weapon ammo tracking, tryFire handlers for Shotgun/Laser/Rocket, and item pickup handlers for Medkit/Shield. |
| `src/core/weapons/ProjectileManager.ts` | Add `spawnShotgunPellets`, `spawnLaserBeam`, `spawnPlayerRocket`. Add `PlayerRocketProjectile`. Update `BulletProjectile` to ignore allies. |
| `src/core/player/PlayerKinematics.ts` | Add `ultimatePressed?: boolean` to `PlayerInputSnapshot`. |
| `src/core/player/PlayerController.ts` | Add `shieldCharges`, integrate `UltimateManager`, update `takeDamage` to check shield, update `onCollision` for Medkit/Shield. |
| `src/input/KeyboardController.ts` | Map `KeyU` to `ultimate`, add edge-detection latch `ultimateJustPressed`, export in snapshot. |
| `src/input/TouchVirtualPad.ts` | Add "ULT" virtual touch button and edge detection. |
| `src/render/sprites/ProceduralSpriteFactory.ts` | Add procedural pixel art for Hyakutaro (idle, ki charge, salute), Ki Blast, Shotgun pellets, Laser beam, Rocket, Medkit cross, Shield halo, and SV-001/Bomber strike. |
| `src/render/CanvasRenderer.ts` | Add rendering passes for Allies, new weapons, Shield halo, and Ultimate Move screen effects (freeze flash, warning banner, strike pass, multi-explosions). |
| `src/ui/HUDOverlay.ts` | Add weapon badges ('S', 'L', 'R'), shield count indicator, and Ultimate Move gauge bar (`[||||||||||] ULT READY [U]`). |
| `src/audio/AudioTypes.ts` & `SoundEngine.ts` | Add procedural audio synthesis for shotgun blast, laser beam buzz, rocket whoosh, ki blast, siren alarm, shield absorb/break, medkit chime, and announcer voice clips (`voice_shotgun`, `voice_laser_gun`, `voice_rocket_launcher`). |
| `src/main.ts` | Instantiate and update `AllyManager` and `UltimateManager`. Wire event bus for new SFX and visual effects. Expose test hooks on `window.__GAME__`. |

---

## 8. Verification Strategy & Acceptance Criteria

### 8.1 Acceptance Criteria Mapping

| Criterion | Target Metric | Verification Method |
| :--- | :--- | :--- |
| **Ally Autonomous Targeting** | Ally acquires target $\le 380\text{px}$ without player input; dispatches Ki Blast | Vitest test asserting target acquisition, ki projectile spawn, and enemy HP reduction with 0 player inputs |
| **Shotgun Spread & Knockback** | 7 pellets at $\pm 14^\circ$ spread; push enemy back by $\ge 100\text{px/s}$ | Vitest test asserting 7 velocities and enemy stagger velocity |
| **Laser Piercing** | Beam pierces 3+ aligned enemies in a single frame | Vitest test asserting 3 enemies damaged simultaneously |
| **Rocket Homing & AOE** | Rocket steers toward target; 48px radius blast | Vitest test asserting trajectory curvature and splash damage |
| **Medkit & Shield** | Medkit restores HP; Shield absorbs 2 hits | Vitest tests asserting health recovery and zero damage taken while shield active |
| **Ultimate Move Screen Clear** | 100% of on-screen standard minions eliminated; Boss takes 120 HP | Vitest + Playwright E2E browser test asserting enemy count drops to 0 |
| **E2E Visual Proof** | Capture screenshot artifacts of Ultimate Move in action | Playwright test saving artifacts to `artifacts/expansion/` |
| **Zero Regressions** | 100% test pass rate across entire suite | `npm test` passing 294+ unit tests and all E2E specs |

---

## 9. Next Steps for Implementation Team

1. **Sprint 1 (Weapons & Items Core)**:
   - Extend `WeaponTypes.ts`, `WeaponManager.ts`, `ProjectileManager.ts`.
   - Implement Shotgun, Laser Gun, Rocket Launcher, Medkit, Shield.
   - Run `tests/unit/diverse_weapons_items.test.ts`.
2. **Sprint 2 (Autonomous Allies)**:
   - Implement `AllyNPC.ts`, `AllyKiBlast.ts`, `AllyManager.ts`.
   - Wire into `GameEngine` and `main.ts`.
   - Run `tests/unit/allies_system.test.ts`.
3. **Sprint 3 (Ultimate Move Mechanic)**:
   - Implement `UltimateManager.ts`, update `PlayerController.ts`, `KeyboardController.ts`.
   - Implement screen freeze, siren sound, visual strike, screen clear resolution.
   - Run `tests/unit/ultimate_move_system.test.ts`.
4. **Sprint 4 (Presentation & Audio Polish)**:
   - Add pixel art sprites, HUD gauge, Web Audio procedural SFX, announcer voice clips.
   - Run Playwright E2E tests and capture visual artifacts.
