# Milestone 2 Investigation & Implementation Blueprint Report: Autonomous Ally NPCs & Weapon/Item Expansion

- **Author**: Explorer M2 (`explorer_m2`)
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2/`
- **Date**: 2026-09-04
- **Scope**: Milestone 2 (`M2_ALLIES_ITEMS`) — Autonomous Ally NPCs, Shotgun, Laser Gun, Rocket Launcher, Medkit, Shield, and Unit Test Suites

---

## 1. Observation

### 1.1 Baseline System & Test Status
1. **Full Test Suite Status**:
   - Executed command: `npx vitest run`
   - Verbatim output:
     ```
     Test Files  26 passed (26)
          Tests  317 passed (317)
       Duration  2.06s
     ```
   - 100% green across all 26 test files (including M1's `boss_crisis_events.test.ts` and `iron_nokana_boss.test.ts`).
2. **TypeScript Compilation Check**:
   - Executed command: `npx tsc --noEmit`
   - Result: Exit code 0, clean build with zero errors.
3. **Target M2 Test Files Check**:
   - Executed command: `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts`
   - Verbatim output:
     ```
     RUN  v3.2.7 /Users/user/src/fullmetalslug
     No test files found, exiting with code 1
     filter: tests/unit/allies_system.test.ts, tests/unit/diverse_weapons_items.test.ts
     ```
   - Both target test files are currently missing and must be authored.

---

### 1.2 File Existence & Gap Inventory

| File Path | Status | Observations & Gap Analysis |
| :--- | :--- | :--- |
| `src/core/entities/allies/AllyTypes.ts` | **Missing** | Directory `src/core/entities/allies/` does not exist. Needs state definitions (`SPAWN_SALUTE`, `IDLE`, `FOLLOW`, `ACQUIRE_TARGET`, `CHARGE_ATTACK`, `FIRE_ATTACK`, `RECOVERY`, `CELEBRATE`), config interfaces, and threat scoring contracts. |
| `src/core/entities/allies/AllyNPC.ts` | **Missing** | Needs companion entity (Hyakutaro Ichimonji) implementing `GameEntity` (`type: 'ALLY_NPC'`). Must implement autonomous tethering (45px follow offset), dynamic walk/sprint pacing, platform jumping, threat-weighted target acquisition (380px radius), ki charge timer (0.35s), and projectile emission without player input. |
| `src/core/entities/allies/AllyKiBlast.ts` | **Missing** | Needs autonomous friendly projectile implementing `GameEntity` (`type: 'ALLY_PROJECTILE'`). Speed 520 px/s, damage 3.5 HP. Must ignore `PLAYER`, `ALLY_NPC`, and `ALLY_PROJECTILE`, while damaging enemies (`takeDamage(3.5)`). |
| `src/core/entities/allies/AllyManager.ts` | **Missing** | Needs lifecycle coordinator for spawning, updating, querying, and cleaning up allies in `GameEngine`. |
| `src/core/weapons/WeaponTypes.ts` | **Exists (Incomplete)** | Currently only defines `PISTOL`, `HEAVY_MACHINE_GUN`, `FLAME_SHOT` in `WeaponType` and `WEAPON_CONFIGS`. Missing `SHOTGUN`, `LASER_GUN`, `ROCKET_LAUNCHER`. `ItemDropType` enum (lines 92-100) lacks `WEAPON_SHOTGUN`, `WEAPON_LASER`, `WEAPON_ROCKET`, `MEDKIT`, `SHIELD`. `POW_LOOT_TABLE` lacks entries for new items. |
| `src/core/weapons/WeaponManager.ts` | **Exists (Incomplete)** | `ammoPool` (lines 12-16) only tracks PISTOL, HMG, FLAME. `tryFire` (lines 78-186) does not handle SHOTGUN, LASER_GUN, ROCKET_LAUNCHER. `applyItemPickup` (lines 243-273) does not handle new weapon drops or Medkit/Shield. |
| `src/core/weapons/ProjectileManager.ts` | **Exists (Needs Update)** | In `BulletProjectile.onCollision` (lines 133-135): `if (typeStr === 'PLAYER' || typeStr === 'PROJECTILE' || typeStr === 'GRENADE') return;` lacks friendly checks for `ALLY_NPC` and `ALLY_PROJECTILE`. |
| `src/core/weapons/ShotgunWeapon.ts` | **Missing** | Needs module to generate 7-pellet fan spread ($\pm 14^\circ$, $0.4887\text{ rad}$), 680 px/s speed, 2.0 damage/pellet, 0.18s lifetime, and kinetic knockback ($\ge 100$ px/s, specifically 160 px/s horizontal). |
| `src/core/weapons/LaserGunWeapon.ts` | **Missing** | Needs module for high-velocity continuous beam (1200 px/s), continuous piercing through multiple enemies, with per-target 0.1s (6 frames) tick immunity to prevent multi-hit frame bugs. |
| `src/core/weapons/RocketLauncherWeapon.ts` | **Missing** | Needs module for homing rocket kinematics ($v_0 = 220$ px/s, $a = 750\text{ px/s}^2$, $v_{max} = 650$ px/s, steering rate $\omega = 3.5$ rad/s towards nearest living enemy), and 48px explosive blast AOE ($8.0 \cdot (1 - d/48)$ damage falloff). |
| `src/core/entities/items/ItemPickup.ts` | **Missing** | Currently `ItemPickupEntity` is embedded inside `src/core/entities/pow/PowEntity.ts` (lines 17-75). Needs dedicated module `ItemPickup.ts` under `src/core/entities/items/` handling falling gravity, platform bouncing, and bobbing, supporting all `ItemDropType`s. |
| `src/core/player/PlayerController.ts` | **Exists (Needs Update)** | Lacks `public shieldCharges: number = 0`. In `takeDamage` (lines 543-565), incoming damage directly subtracts `health` without checking `shieldCharges`. In `onCollision` (lines 570-577), Medkit and Shield pickup events are not handled. |
| `tests/unit/allies_system.test.ts` | **Missing** | Vitest suite required to assert autonomous companion state machine, follow locomotion, target acquisition, ki blast emission, and damage resolution without player input. |
| `tests/unit/diverse_weapons_items.test.ts` | **Missing** | Vitest suite required to assert Shotgun spread/knockback, Laser continuous piercing/tick immunity, Rocket homing/AOE blast, Medkit healing/life bonus, and Shield 2-hit damage absorption. |

---

### 1.3 Baseline Invariant Observations

1. **Sprite Key Invariant (`src/render/sprites/ProceduralSpriteFactory.ts`)**:
   - Lines 402-407:
     ```ts
     public getAllKeys(includePolish: boolean = false): string[] {
       if (includePolish) return Array.from(this.spriteCache.keys());
       return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
     }
     ```
   - `tests/unit/adversarial_sprites_crosshairs.test.ts` line 199 strictly asserts:
     ```ts
     expect(allKeys.length).toBe(164);
     ```
   - *Constraint*: If any procedural sprites are added for new weapons, items, or allies, they MUST be registered in an `expansionKeys: Set<string>` set and excluded when `includeExpansion` is false, exactly preserving the 164-key baseline invariant.

2. **Entity Collision Invariant (`src/core/engine/GameEngine.ts`)**:
   - `GameEngine` maintains a `SpatialGrid<GameEntity>` and dispatches `onCollision(other, engine)`.
   - All friendly projectiles (`type: 'PROJECTILE'`, `type: 'ALLY_PROJECTILE'`) must ignore friendly entities (`'PLAYER'`, `'ALLY_NPC'`).

---

## 2. Logic Chain

1. **Autonomous Ally NPC Mechanics**:
   - By R2 requirements and `PROJECT.md` line 45, Hyakutaro Ichimonji must act completely autonomously without player input.
   - The ally entity (`AllyNPC`) requires a state machine:
     - `SPAWN_SALUTE`: Brief initial cheer on spawn (0.5s).
     - `IDLE` / `FOLLOW`: Follows player at $X_{player} - \text{facing} \cdot 45\text{px}$. If horizontal distance $\Delta X > 12\text{px}$, moves at 115 px/s; if $\Delta X > 90\text{px}$, sprints at 165 px/s; if $|\Delta X| \le 12\text{px}$, stops. If player is elevated ($Y_{player} < Y_{ally} - 22\text{px}$) and ally is grounded, jumps with $v_y = -350$ px/s.
     - `ACQUIRE_TARGET`: Scans spatial grid for living enemies within vision radius $R \le 380\text{px}$. Threat scoring: $W_{boss} \cdot 100 - \text{dist}$ prioritizes bosses, then mid-bosses, then minions.
     - `CHARGE_ATTACK`: Halts and charges ki energy for 0.35s (21 frames at 60Hz), orienting toward target.
     - `FIRE_ATTACK`: Spawns `AllyKiBlast` at $(x + \text{facing} \cdot 16, y - 16)$ moving at 520 px/s with 3.5 damage.
     - `RECOVERY`: Cooldown period of 1.2s before next attack.
     - `CELEBRATE`: Victory animation when no enemies remain on screen or boss is dead.
   - Because `AllyKiBlast` has `type = 'ALLY_PROJECTILE'`, it does not collide with `PLAYER` or `ALLY_NPC`. When it collides with an enemy entity (`SOLDIER_*`, `MID_BOSS_*`, `BOSS_*`), it calls `enemy.takeDamage(3.5)` and sets `this.isAlive = false`.

2. **Expanded Weapons Architecture**:
   - **Shotgun (`SHOTGUN`)**:
     - 7 pellets spawned per shot in an angular fan of $\Delta \theta = 28^\circ$ ($\pm 14^\circ$ around aim vector).
     - Velocity: $680\text{ px/s}$, lifetime: $0.18\text{s}$ ($\implies$ max range $\approx 122.4\text{px}$).
     - Damage: 2.0 per pellet (up to 14.0 if all pellets hit point-blank).
     - Kinetic knockback: When hitting a damageable target, applies horizontal impulse of $\text{facing} \cdot 160\text{ px/s}$ (and vertical $-80\text{ px/s}$) to target's velocity.
     - Semi-automatic with 32 frames cooldown (~1.875 shots/s). Initial ammo: 30.
   - **Laser Gun (`LASER_GUN`)**:
     - Fast continuous beam: velocity $1200\text{ px/s}$, lifetime $0.4\text{s}$ (covers 480px screen).
     - Piercing: `pierces = true`, does not die on enemy impact.
     - Tick immunity: Tracks `targetImmunityMap` per target ID with $0.1\text{s}$ cooldown to prevent duplicate damage frames while allowing multiple ticks as it passes through large enemies/bosses.
     - Damage: 1.2 per tick. Full-auto with 4 frames cooldown (15 shots/s). Initial ammo: 200.
   - **Rocket Launcher (`ROCKET_LAUNCHER`)**:
     - Spawns `PlayerRocketProjectile`.
     - Forward launch at $v_0 = \text{facing} \cdot 220\text{ px/s}$, accelerating at $a = 750\text{ px/s}^2$ up to $650\text{ px/s}$.
     - Active homing steering: queries nearest living enemy in front of rocket, calculates angular error $\Delta \theta$, and turns at rate $\omega = \text{clamp}(\Delta \theta / dt, -3.5, 3.5)\text{ rad/s}$.
     - On collision with enemy or solid terrain, triggers 48px explosive blast:
       $$\text{Damage}(d) = 8.0 \cdot \max(0, 1 - d / 48)$$
       Calls `takeDamage(damage, true, false)` on all entities within 48px radius and emits `'spawn_explosion'` event. Initial ammo: 30, cooldown: 24 frames (~2.5 shots/s).

3. **Power-ups & Player Integration**:
   - **Medkit (`ItemDropType.MEDKIT`)**:
     - When collected: if `player.health < player.maxHealth`, restores `player.health = player.maxHealth`; if already at full health, grants `player.lives++`.
   - **Shield (`ItemDropType.SHIELD`)**:
     - When collected: sets `player.shieldCharges = 2`.
     - In `PlayerController.takeDamage(amount)`:
       ```ts
       if (this.shieldCharges > 0) {
         this.shieldCharges--;
         this.invulnerabilityTimer = 0.5;
         engine?.eventBus.emit('play_sound', { sound: 'sfx_shield_absorb' });
         engine?.eventBus.emit('shield_hit', { remainingCharges: this.shieldCharges });
         if (this.shieldCharges <= 0) {
           engine?.eventBus.emit('play_sound', { sound: 'sfx_shield_break' });
         }
         return; // Damage completely absorbed!
       }
       ```
     - Perfectly absorbs 2 hits before player takes any HP damage.

4. **Dedicated Test Verification**:
   - `tests/unit/allies_system.test.ts` will verify autonomous tracking, state transitions, projectile emission, and damage resolution with 0 player inputs.
   - `tests/unit/diverse_weapons_items.test.ts` will verify Shotgun fan spread/knockback, Laser continuous piercing/tick immunity, Rocket homing/blast AOE, Medkit healing/lives, and Shield absorption.

---

## 3. Caveats

1. **`ItemPickupEntity` Backward Compatibility**:
   - `src/core/entities/pow/PowEntity.ts` currently defines `ItemPickupEntity`.
   - When creating `src/core/entities/items/ItemPickup.ts`, `PowEntity.ts` should import `ItemPickupEntity` (or alias it) from `src/core/entities/items/ItemPickup.ts` so all existing code and tests continue working seamlessly.
2. **`ProceduralSpriteFactory` Key Invariant**:
   - Any new procedural sprite keys must be added to an `expansionKeys: Set<string>` and filtered out when `includeExpansion` is false so that `getAllKeys(false, false).length === 164` remains strictly true.
3. **Audio Event Decoupling**:
   - Headless unit tests run without Web Audio `AudioContext`. All audio calls must route through `engine.eventBus.emit('play_sound', { sound })` or be safely guarded with optional chaining so unit tests execute in pure Node.js environments without error.

---

## 4. Conclusion & Implementation Blueprint for Worker M2

### 4.1 Implementation Steps

#### Step 1: Types & Configuration (`src/core/weapons/WeaponTypes.ts`)
1. Extend `WeaponType`:
   ```ts
   export type WeaponType =
     | 'PISTOL'
     | 'HEAVY_MACHINE_GUN'
     | 'FLAME_SHOT'
     | 'SHOTGUN'
     | 'LASER_GUN'
     | 'ROCKET_LAUNCHER';
   ```
2. Add configurations to `WEAPON_CONFIGS`:
   - `SHOTGUN`: `fireCooldownFrames: 32`, `initialAmmo: 30`, `maxAmmo: 99`, `projectileSpeed: 680`, `projectileDamage: 2.0`, `isAutomatic: false`, `soundKey: 'sfx_shotgun_fire'`, `announcerKey: 'voice_shotgun'`.
   - `LASER_GUN`: `fireCooldownFrames: 4`, `initialAmmo: 200`, `maxAmmo: 999`, `projectileSpeed: 1200`, `projectileDamage: 1.2`, `piercing: true`, `isAutomatic: true`, `soundKey: 'sfx_laser_fire'`, `announcerKey: 'voice_laser_gun'`.
   - `ROCKET_LAUNCHER`: `fireCooldownFrames: 24`, `initialAmmo: 30`, `maxAmmo: 99`, `projectileSpeed: 220`, `projectileDamage: 8.0`, `isAutomatic: false`, `soundKey: 'sfx_rocket_fire'`, `announcerKey: 'voice_rocket_launcher'`.
3. Extend `ItemDropType`:
   ```ts
   export enum ItemDropType {
     WEAPON_HMG = 'ITEM_WEAPON_HMG',
     WEAPON_FLAME = 'ITEM_WEAPON_FLAME',
     WEAPON_SHOTGUN = 'ITEM_WEAPON_SHOTGUN',
     WEAPON_LASER = 'ITEM_WEAPON_LASER',
     WEAPON_ROCKET = 'ITEM_WEAPON_ROCKET',
     GRENADE_CRATE = 'ITEM_GRENADE_BOX',
     MEDKIT = 'ITEM_MEDKIT',
     SHIELD = 'ITEM_SHIELD',
     SCORE_BANANA = 'ITEM_SCORE_BANANA',
     SCORE_CHICKEN = 'ITEM_SCORE_CHICKEN',
     SCORE_COIN = 'ITEM_SCORE_COIN',
     SCORE_JEWEL = 'ITEM_SCORE_JEWEL',
   }
   ```
4. Rebalance `POW_LOOT_TABLE` with weighted entries for `WEAPON_SHOTGUN` (15), `WEAPON_LASER` (15), `WEAPON_ROCKET` (15), `MEDKIT` (8), `SHIELD` (5).

#### Step 2: Dedicated Weapon Modules (`src/core/weapons/`)
1. **`src/core/weapons/ShotgunWeapon.ts`**:
   - `ShotgunPelletProjectile extends BulletProjectile`:
     - Lifetime: 0.18s.
     - On collision with enemy: applies 2.0 damage and kinetic knockback impulse $\ge 100$ px/s (specifically 160 px/s in facing direction) to target velocity.
   - `ShotgunWeapon.fire(muzzlePos, aimVec, facing, engine, projectileManager)`:
     - Calculates fan spread of 7 pellets over $28^\circ$ arc ($\pm 14^\circ$).
     - Spawns all 7 pellets into `engine`. Returns lead/central pellet.
2. **`src/core/weapons/LaserGunWeapon.ts`**:
   - `LaserBeamProjectile extends BulletProjectile`:
     - Piercing: `pierces = true`, does not terminate on enemy contact.
     - Velocity: 1200 px/s. Max lifetime: 0.4s.
     - Manages `targetImmunityMap` with 0.1s tick immunity to damage enemies passing through without duplicate single-frame hits.
   - `LaserGunWeapon.fire(muzzlePos, aimVec, facing, engine, projectileManager)`:
     - Spawns beam projectile and registers with `engine`.
3. **`src/core/weapons/RocketLauncherWeapon.ts`**:
   - `PlayerRocketProjectile extends BulletProjectile`:
     - $v_0 = \text{facing} \cdot 220$ px/s, accelerates by $750\text{ px/s}^2$ up to $650$ px/s.
     - Homing: scans for nearest living enemy ahead, steers at up to 3.5 rad/s.
     - Detonates on impact or solid platform: 48px AOE radius, damage falloff $8.0 \cdot (1 - d/48)$, emits `'spawn_explosion'`.
   - `RocketLauncherWeapon.fire(muzzlePos, aimVec, facing, engine, projectileManager)`:
     - Spawns homing rocket projectile.

#### Step 3: WeaponManager & ProjectileManager Integration
1. In `src/core/weapons/WeaponManager.ts`:
   - Add `SHOTGUN: 0`, `LASER_GUN: 0`, `ROCKET_LAUNCHER: 0` to `ammoPool`.
   - In `tryFire`: delegate firing of `'SHOTGUN'`, `'LASER_GUN'`, `'ROCKET_LAUNCHER'` to their respective weapon modules.
   - In `applyItemPickup`: add cases for `WEAPON_SHOTGUN`, `WEAPON_LASER`, `WEAPON_ROCKET`, `MEDKIT`, `SHIELD`.
2. In `src/core/weapons/ProjectileManager.ts`:
   - In `BulletProjectile.onCollision`: add `|| typeStr === 'ALLY_NPC' || typeStr === 'ALLY_PROJECTILE'` to prevent friendly fire against allies.

#### Step 4: Items & PlayerController Integration
1. **`src/core/entities/items/ItemPickup.ts`**:
   - Create standalone `ItemPickup` entity implementing `GameEntity` (`type: 'ITEM_PICKUP'`).
   - Supports floating bobbing, falling gravity, platform landing.
   - Re-export `ItemPickupEntity` for full backward compatibility with `PowEntity.ts`.
2. In `src/core/player/PlayerController.ts`:
   - Add `public shieldCharges: number = 0;`.
   - In `takeDamage(amount: number)`:
     - If `this.shieldCharges > 0`: decrement `this.shieldCharges`, set `this.invulnerabilityTimer = 0.5`, emit events, and return early (negating damage).
   - In `onCollision(other: GameEntity, engine: GameEngine)`:
     - If `other.type === 'ITEM_PICKUP'`:
       - If `dropType === ItemDropType.MEDKIT`: restore HP to max (or increment lives if already full HP).
       - If `dropType === ItemDropType.SHIELD`: set `this.shieldCharges = 2`.
       - For weapons/ammo: delegate to `this.weaponManager.applyItemPickup(dropType, engine, this)`.

#### Step 5: Autonomous Ally NPC System (`src/core/entities/allies/`)
1. **`src/core/entities/allies/AllyTypes.ts`**:
   - Export `AllyState = 'SPAWN_SALUTE' | 'IDLE' | 'FOLLOW' | 'ACQUIRE_TARGET' | 'CHARGE_ATTACK' | 'FIRE_ATTACK' | 'RECOVERY' | 'CELEBRATE'`.
   - Export `AllyConfig` (follow distance 45px, vision radius 380px, ki damage 3.5 HP, charge duration 0.35s, attack cooldown 1.2s).
2. **`src/core/entities/allies/AllyKiBlast.ts`**:
   - `type: 'ALLY_PROJECTILE'`.
   - Velocity: $\text{facing} \cdot 520\text{ px/s}$, damage: 3.5.
   - Ignores `PLAYER`, `ALLY_NPC`, `ALLY_PROJECTILE`.
   - Inflicts 3.5 damage on enemy collision and terminates.
3. **`src/core/entities/allies/AllyNPC.ts`**:
   - Implements `GameEntity` (`type: 'ALLY_NPC'`).
   - Autonomous AI loop:
     - Locomotion: Follows player at 45px offset, walking (115 px/s) / sprinting (165 px/s), platform jumping ($v_y = -350$ px/s).
     - Target Acquisition: Threat-weighted search within 380px radius without player input.
     - Attack: 0.35s ki gathering charge $\to$ emits `AllyKiBlast` $\to$ recovery cooldown.
     - Celebration: Salutes when enemies are eliminated.
4. **`src/core/entities/allies/AllyManager.ts`**:
   - `spawnAlly(position, engine)`: registers `AllyNPC` with `engine`.
   - `update(dt, engine)`: manages active allies.
   - `clear()`: cleans up allies on stage transition.

#### Step 6: Unit Test Suites
1. **`tests/unit/diverse_weapons_items.test.ts`**:
   - Shotgun: 7-pellet spread, angles span $\pm 14^\circ$, speed 680 px/s, 0.18s lifetime, 160 px/s knockback impulse, semi-auto cooldown.
   - Laser Gun: 1200 px/s speed, continuous multi-enemy piercing, 0.1s tick immunity, full-auto fire rate.
   - Rocket Launcher: 220 $\to$ 650 px/s acceleration, 3.5 rad/s homing steering, 48px explosive AOE blast damage falloff.
   - Medkit: HP restoration from damaged state, +1 life at full HP.
   - Shield: 2-hit damage absorption on `PlayerController`.
   - ItemDropType: Loot table and enum integrity.
2. **`tests/unit/allies_system.test.ts`**:
   - Ally initialization and state transitions.
   - Autonomous tethering, locomotion, and platform jumping.
   - Autonomous target acquisition without player keyboard inputs.
   - Ki blast emission, kinematics, and friendly fire immunity.
   - Autonomous damage resolution against enemies (3.5 HP damage).
   - Attack recovery and victory celebration.
   - AllyManager lifecycle.

---

## 5. Verification Method

### 5.1 Commands to Execute
1. Run target Milestone 2 unit test suites:
   ```bash
   npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts
   ```
   *Expected Output*: Both test files pass with 100% green tests.

2. Run full test suite regression gate:
   ```bash
   npx vitest run
   ```
   *Expected Output*: All 28 test files pass (26 baseline + 2 new suites), 0 failures.

3. Verify TypeScript compilation:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Output*: Exit code 0, no diagnostic errors.

### 5.2 Invalidation Conditions
- If `AllyNPC` requires player keyboard input (e.g. `shootPressed`) to acquire targets or fire, the autonomous ally requirement is violated.
- If `AllyKiBlast` damages `PLAYER` or `ALLY_NPC`, friendly fire safety is violated.
- If `Shotgun` does not spawn 7 pellets or fails to apply kinetic knockback, weapon physics is invalid.
- If `LaserGun` gets destroyed on first enemy impact or damages an enemy multiple times within a single tick without immunity, piercing mechanics are invalid.
- If `RocketLauncher` does not steer towards enemies or lacks 48px blast AOE damage, homing rocket requirements are invalid.
- If `Shield` allows `player.health` to decrease on the first or second hit, shield absorption is invalid.
- If `ProceduralSpriteFactory.getAllKeys()` returns anything other than 164, the sprite count invariant is violated.

---

Report complete and ready for Worker M2 implementation.
