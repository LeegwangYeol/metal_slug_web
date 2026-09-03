# Handoff Report: Varied Death Animations & Particle FX (R2) Technical Architecture

**Author**: Explorer Polish 2  
**Role**: Investigation & Synthesis  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_2/`  
**Target Milestone**: Milestone 2: Varied Death Animations & Particle FX (R2)  
**Date**: 2026-09-03T15:21:00Z  

---

## Executive Summary

This investigation analyzed the enemy damage reception, lifecycle, sprite generation, rendering, and audio systems in the Metal Slug Web engine. The objective is to establish an authentic, high-impact implementation plan for **Varied Death Animations & Particle FX (R2)**, encompassing:
1. **Standard Falling Death** (stagger, knee buckle, backward ground collapse from bullets/rifles).
2. **Explosion Blowback** (ballistic parabolic launch, rotational air tumbling, detached flying Stahlhelm helmet, heavy ground impact bounce from grenades/explosions).
3. **Flamethrower Burning Death** (flame tongues, agonized thrashing, rising flame/smoke particles, charred silhouette with glowing embers, crumbling ash collapse).

A critical architectural finding is that existing unit tests enforce strict invariants: when a soldier receives lethal damage, `soldier.isAlive` must immediately become `false`, `soldier.state` must become `'DEAD'`, and `GameEngine` purges the entity within 2 ticks. To honor this invariant without breaking existing tests while rendering multi-frame animations (0.7s–1.3s), the solution decouples simulation death from visual death using a dedicated `DeathCorpseManager` event-driven lifecycle.

---

## 1. Observation

### 1.1 Inconsistent `takeDamage` Invocations Across Callers
Across the codebase, damage callers pass incompatible argument types to `takeDamage`:

- **`src/core/weapons/ProjectileManager.ts` (lines 173–180)**:
  ```typescript
  173: private dealDamageTo(entity: GameEntity, engine: GameEngine): void {
  174:   const isFire = this.weaponType === 'FLAME_SHOT';
  175: 
  176:   if (typeof (entity as any).takeDamage === 'function') {
  177:     (entity as any).takeDamage(this.damage, false, isFire);
  178:   } else if (typeof (entity as any).applyDamage === 'function') {
  ...
  ```
  *Observation*: Passes boolean `false` as the 2nd argument (`sourceType`), and boolean `isFire` as the 3rd argument (`origin`).

- **`src/core/weapons/ProjectileManager.ts` (lines 411–414, Ground Fire AOE)**:
  ```typescript
  411: if (typeof (candidate as any).takeDamage === 'function') {
  412:   (candidate as any).takeDamage(fire.damage, false, true);
  413: }
  ```
  *Observation*: Passes boolean `false` as 2nd argument, and boolean `true` as 3rd argument.

- **`src/core/weapons/Grenade.ts` (lines 203–206)**:
  ```typescript
  203: if (typeof (entity as any).takeDamage === 'function') {
  204:   (entity as any).takeDamage(damage, true); // true indicates explosive damage
  205: }
  ```
  *Observation*: Passes boolean `true` as the 2nd argument (`sourceType`).

- **`src/core/player/PlayerController.ts` (lines 376–378)**:
  ```typescript
  376: if (typeof (target as any).takeDamage === 'function') {
  377:   (target as any).takeDamage(PlayerKinematics.MELEE_DAMAGE, 'melee', false);
  378: }
  ```
  *Observation*: Passes `'melee'` as the 2nd argument.

- **`src/core/entities/enemies/SoldierEnemy.ts` (lines 839–843)**:
  ```typescript
  839: takeDamage(
  840:   amount: number,
  841:   sourceType: DamageSourceType = 'bullet',
  842:   origin?: Vector2D
  843: ): boolean
  ```
  *Observation*: In `SoldierEnemy.ts`, `sourceType` expects `'bullet' | 'flame' | 'grenade' | 'melee'`. When `Grenade.ts` passes `true`, JavaScript evaluates `sourceType === 'grenade'` as `false`, causing grenade damage to bypass shield stagger and damage-source detection.

### 1.2 Instantaneous Entity Purge on Death in `SoldierEnemy` & `GameEngine`
- **`src/core/entities/enemies/SoldierEnemy.ts` (lines 891–898)**:
  ```typescript
  891: private checkDeath(_sourceType: DamageSourceType): void {
  892:   if (this.health <= 0) {
  893:     this.health = 0;
  894:     this.isAlive = false;
  895:     this.state = 'DEAD';
  896:     this.velocity = { x: 0, y: 0 };
  897:   }
  898: }
  ```
  *Observation*: `_sourceType` is prefixed with an underscore and completely unused. `isAlive` is immediately set to `false`, and `state` is set to `'DEAD'`.

- **`src/core/engine/GameEngine.ts` (lines 198–207)**:
  ```typescript
  198: // 3. Update all active entities
  199: for (const entity of this.entities.values()) {
  200:   if (entity.isAlive) {
  201:     entity.update(dt, this);
  202:     this.spatialGrid.update(entity);
  203:   } else {
  204:     this.entityIdsToRemove.add(entity.id);
  205:   }
  206: }
  ```
  *Observation*: As soon as `isAlive` is false, `GameEngine` adds the entity to `entityIdsToRemove`, purging it on the very next tick.

- **`tests/unit/enemy_boss_statemachine.test.ts` (lines 138–156)**:
  ```typescript
  146: const damaged = rifleman.takeDamage(1.0, 'bullet');
  147: expect(damaged).toBe(true);
  148: expect(rifleman.health).toBe(0);
  149: expect(rifleman.isAlive).toBe(false);
  150: expect(rifleman.state).toBe('DEAD');
  151: 
  152: // Engine tick marks for removal, second tick purges from collection
  153: engine.tick();
  154: engine.tick();
  155: expect(engine.getAllEntities().filter((e) => e.id === 'rebel_dead_1').length).toBe(0);
  ```
  *Observation*: Automated tests strictly assert that `rifleman.isAlive === false`, `rifleman.state === 'DEAD'`, and the entity is absent from `engine.getAllEntities()` after 2 ticks. Any design that delays `isAlive = false` directly on `SoldierEnemy` will immediately break this test.

### 1.3 CanvasRenderer Skips Dead Enemies
- **`src/render/CanvasRenderer.ts` (lines 383–388)**:
  ```typescript
  383: if (scene.enemies) {
  384:   for (const enemy of scene.enemies) {
  385:     if (enemy.isDead) continue;
  386:     const screen = camera.worldToScreen(enemy.x, enemy.y);
  387:     const flip = enemy.facing === -1;
  ```
  *Observation*: Line 385 explicitly skips any enemy with `isDead === true`.

- **`src/render/CanvasRenderer.ts` (lines 400–426)**:
  *Observation*: Enemy rendering only checks states `PATROL`, `WALK`, `INGRESS`, `FIRE`, `SPRINT`, `LEAP_LUNGE`, `THROW`, and `SHIELD_BASH`. There is zero branch or routine for any death state (`DEAD`, `DEAD_STANDARD`, `DEAD_EXPLOSION`, `DEAD_BURNING`).

- **`src/main.ts` (lines 327–332)**:
  ```typescript
  327: for (const ent of entities) {
  328:   if (!ent.isAlive) continue;
  329: 
  330:   if (ent.type === 'SOLDIER_RIFLE' || ent.type === 'SOLDIER_KNIFE' ||
  ...
  ```
  *Observation*: Living entities in `buildRenderSceneState` are filtered with `if (!ent.isAlive) continue;`. Once an enemy is dead, it is excluded from `enemyStates`.

### 1.4 Procedural Sprite Factory Has Only One Placeholder Frame
- **`src/render/sprites/ProceduralSpriteFactory.ts` (lines 1083–1091)**:
  ```typescript
  1083: this.registerSprite('rebel_rifle_death_0', W, H, AX, AY, (ctx) => {
  1084:   // Blown backward, helmet flying off in air!
  1085:   drawContouredRect(ctx, 4, 16, 24, 18, R[1], R[6], R[6], R[7]);
  1086:   // Helmet flying high
  1087:   drawContouredRect(ctx, 22, 6, 10, 7, R[1], R[2], R[9], R[3]);
  1088:   // Face grimace
  1089:   ctx.fillStyle = R[4]; ctx.fillRect(10, 18, 8, 5);
  1090:   ctx.fillStyle = R[14]; ctx.fillRect(4, 28, 8, 6);
  1091: });
  ```
  *Observation*: Only a single static frame (`rebel_rifle_death_0`) exists. There are zero multi-frame animations for standard fall, explosion tumbling, flying helmet, burning thrashing, charcoal silhouette, or ash collapse.

### 1.5 Audio System Lacks Death Vocals & Sizzles
- **`src/audio/AudioTypes.ts` (lines 5–14)**:
  *Observation*: `SoundEffectType` contains `'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT' | 'GRENADE_LAUNCH' | 'GRENADE_BOUNCE' | 'EXPLOSION' | 'KNIFE_SLASH' | 'BULLET_HIT' | 'ITEM_PICKUP'`. No sound exists for soldier death screams or flame burns.

---

## 2. Logic Chain

1. **Premise 1 (From Obs 1.2)**: `SoldierEnemy` must have `isAlive === false` and `state === 'DEAD'` immediately when health reaches 0, and `engine.getAllEntities()` must not contain the dead entity after 2 ticks. Therefore, the visual death animation (lasting 0.7s to 1.3s) cannot rely on keeping `SoldierEnemy.isAlive === true` in the core physics loop.
2. **Premise 2 (From Obs 1.1)**: Callers pass booleans or inconsistent strings to `takeDamage`. Therefore, `SoldierEnemy.takeDamage` must normalize its arguments:
   - `true` or `'grenade'` or `'explosion'` $\rightarrow$ `'explosion'`
   - `isFire === true` or `'flame'` or `'fire'` $\rightarrow$ `'fire'`
   - `'melee'` $\rightarrow$ `'melee'`
   - `false` or `'bullet'` $\rightarrow$ `'bullet'`
3. **Premise 3 (From Obs 1.3 & 1.4)**: To display multi-frame death animations, an entity/effect manager must take custody of the dying soldier upon death, simulate its post-death visual physics (ballistic arcs, air rotation, ground landing bounce, ash disintegration), and forward render states to `CanvasRenderer`.
4. **Premise 4 (From Obs 1.3 & Main.ts)**: In `main.ts`, `activeExplosions` is updated outside `engine.entities` and rendered in `CanvasRenderer`. Similarly, a `DeathCorpseManager` can subscribe to an `enemy_death` event on `engine.eventBus`, track `activeCorpses`, update their trajectories, and provide their render states to `scene.corpses` (or inject them into `scene.enemies`).
5. **Premise 5 (From Requirements R2)**:
   - *Standard Death*: Stagger and backward collapse onto the floor with zero air launch. Requires 4 frames (`rebel_death_standard_0..3`).
   - *Explosion Blowback*: Ballistic trajectory ($v_{0y} \approx -300\text{ px/s}, v_{0x} \approx \pm 200\text{ px/s}$), continuous rotation ($\omega \approx 8\text{ rad/s}$), detached flying helmet, and ground landing bounce. Requires center-anchored tumble frame (`rebel_death_explosion_air`), helmet sprite (`rebel_death_explosion_helmet`), and impact frames (`rebel_death_explosion_land_0..1`).
   - *Burning Death*: Immediate engulfment in fire, flailing thrash animation, procedural flame particles, transition to charred silhouette, and crumble into ash. Requires thrash frames (`rebel_death_burn_thrash_0..1`), charcoal frame (`rebel_death_burn_charcoal_0`), and ash crumble frames (`rebel_death_burn_ash_0..1`).
6. **Deduction**: This architecture satisfies all functional, visual, and unit testing requirements without regressions.

---

## 3. Caveats

1. **Mid-Boss Immunity**: `MidBossVehicle` is a mechanical vehicle tank and has its own destruction sequence (`DEFEAT_BURNING`). The varied death animations apply exclusively to infantry minions (`SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`).
2. **Shield Trooper Death**: When killed by explosives or fire, shield troopers discard their riot shield and undergo the same blowback/burning death as other infantry. For standard bullet/melee death, the shield drops to the ground next to the collapsing soldier.
3. **Particle FX Memory**: Procedural flame and dust particles are rendered in canvas with a fixed maximum pool (e.g., 64 active particles) to prevent memory allocation spikes.
4. **No Caveats Outside Stated Scope**: All other mechanics (jump physics, spawning invariants, boss balancing) remain untouched and fully preserved.

---

## 4. Conclusion & Detailed Technical Implementation Plan

### 4.1 Type Extensions & Signatures

#### File: `src/core/entities/enemies/EnemyTypes.ts`
Extend `DamageSourceType` and define `EnemyDeathType`:

```typescript
export type DamageSourceType =
  | 'bullet'
  | 'flame'
  | 'fire'
  | 'grenade'
  | 'explosion'
  | 'melee';

export type EnemyDeathType = 'standard' | 'explosion' | 'fire';

export interface EnemyDeathEvent {
  id: string;
  type: EnemyType;
  role: SoldierRole;
  position: Vector2D;
  velocity: Vector2D;
  facing: 1 | -1;
  deathType: EnemyDeathType;
  origin?: Vector2D;
}
```

#### File: `src/core/entities/enemies/SoldierEnemy.ts`
Update `takeDamage` normalization and event dispatch:

```typescript
public deathType: EnemyDeathType = 'standard';

takeDamage(
  amount: number,
  sourceType: DamageSourceType | boolean = 'bullet',
  origin?: Vector2D | boolean
): boolean {
  if (!this.isAlive) return false;

  // 1. Normalize damage source type
  let resolvedSource: DamageSourceType = 'bullet';
  if (sourceType === true || sourceType === 'grenade' || sourceType === 'explosion') {
    resolvedSource = 'explosion';
  } else if (sourceType === 'flame' || sourceType === 'fire' || origin === true) {
    resolvedSource = 'fire';
  } else if (sourceType === 'melee') {
    resolvedSource = 'melee';
  }

  const damageOrigin: Vector2D | undefined =
    typeof origin === 'object' && origin !== null && 'x' in origin ? origin : undefined;

  // 2. Shield Trooper Directional Defense
  if (this.role === 'SHIELD' && resolvedSource !== 'melee') {
    const isFrontal = damageOrigin
      ? (damageOrigin.x - this.position.x) * this.facing > 0
      : true;

    if (isFrontal) {
      if (resolvedSource === 'bullet') {
        if (this.state !== 'EXPOSED_THRUST' && this.state !== 'STAGGER') {
          return false; // Frontal bullet deflected!
        }
      } else if (resolvedSource === 'explosion') {
        this.transitionTo('STAGGER');
      }
    }
  }

  // 3. Resolve Death Type
  if (resolvedSource === 'fire') {
    this.deathType = 'fire';
  } else if (resolvedSource === 'explosion') {
    this.deathType = 'explosion';
  } else {
    this.deathType = 'standard';
  }

  this.health -= amount;
  if (this.health <= 0) {
    this.health = 0;
    this.isAlive = false;
    this.state = 'DEAD';
    this.velocity = { x: 0, y: 0 };
  }

  return true;
}
```

And in `SoldierEnemy.update(dt, engine)`:
When transitioning to `DEAD` or upon lethal damage with `engine` present, emit:
```typescript
engine.eventBus.emit('enemy_death', {
  id: this.id,
  type: this.type,
  role: this.role,
  position: { x: this.position.x, y: this.position.y },
  velocity: { x: this.velocity.x, y: this.velocity.y },
  facing: this.facing,
  deathType: this.deathType,
  origin: this.lastDamageOrigin,
});
```

---

### 4.2 Decoupled Corpse Management: `DeathCorpseManager`

Create `src/core/entities/enemies/DeathCorpseManager.ts`:

```typescript
export interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ActiveDeathCorpse {
  id: string;
  enemyType: EnemyType;
  role: SoldierRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  deathType: EnemyDeathType;
  elapsedTime: number;
  duration: number;
  rotation: number;
  angularVelocity: number;
  isGrounded: boolean;
  groundY: number;
  // Detached Stahlhelm helmet for explosion blowback
  helmet?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    angularVelocity: number;
    isGrounded: boolean;
  };
  particles: DeathParticle[];
}
```

#### Behavior & Physics by Mode:

1. **Standard Falling Death (`'standard'`)**:
   - `duration`: 0.70s.
   - Initial velocity: $v_x = -20 \cdot \text{facing}$, $v_y = 0$. $v_x$ decays to 0 in 0.15s.
   - Grounded throughout ($y = \text{groundY}$).
   - Animation frame progression:
     - $0.00\text{s} \le t < 0.15\text{s}$: Frame 0 (`rebel_death_standard_0` - hit stagger).
     - $0.15\text{s} \le t < 0.30\text{s}$: Frame 1 (`rebel_death_standard_1` - knee buckle & backward slump).
     - $0.30\text{s} \le t < 0.45\text{s}$: Frame 2 (`rebel_death_standard_2` - back slam impact).
     - $0.45\text{s} \le t \le 0.70\text{s}$: Frame 3 (`rebel_death_standard_3` - sprawled flat corpse, fades out in last 0.1s).

2. **Explosion Blowback (`'explosion'`)**:
   - `duration`: 1.10s.
   - Initial velocity:
     - Determine blast direction: if $\text{origin}$ is provided, $\text{dir} = x \ge \text{origin.x} ? 1 : -1$; else $\text{dir} = -\text{facing}$.
     - $v_x = \text{dir} \cdot 200\text{ px/s}$.
     - $v_y = -300\text{ px/s}$ (high upward ballistic arc).
     - $\omega = \text{dir} \cdot 8.5\text{ rad/s}$ (tumbling end-over-end).
   - Detached helmet physics:
     - $v_{\text{hx}} = \text{dir} \cdot 240\text{ px/s}$, $v_{\text{hy}} = -360\text{ px/s}$, $\omega_h = \text{dir} \cdot 18\text{ rad/s}$.
   - Air flight:
     - Apply gravity $g = 720\text{ px/s}^2$: $v_y += 720 \cdot dt$.
     - When $y \ge \text{groundY}$:
       - First ground impact ($t \approx 0.55\text{s}$): Hard bounce ($v_y = -v_y \cdot 0.25$, $v_x \cdot= 0.4$, $\omega = 0$).
       - Spawn 6 dust puff particles radiating outwards.
       - Settles into sprawled corpse frame (`rebel_death_explosion_land_1`).

3. **Burning Death (`'fire'`)**:
   - `duration`: 1.30s.
   - Initial velocity: $v_x = 0, v_y = 0$, firmly grounded at $\text{groundY}$.
   - Stages:
     - **Stage 1 (Thrashing, $0.00\text{s} \le t < 0.65\text{s}$)**:
       - Alternates `rebel_death_burn_thrash_0` and `rebel_death_burn_thrash_1` at 8Hz.
       - Continuously emits rising flame particles ($v_y \in [-50, -90]\text{ px/s}$, colors `#FFF060`, `#FFA010`, `#E84800`, life 0.25s).
     - **Stage 2 (Charcoal Silhouette, $0.65\text{s} \le t < 0.95\text{s}$)**:
       - Displays `rebel_death_burn_charcoal_0` (pitch-black charred uniform, glowing molten orange cracks/embers).
       - Soldier collapses to knees. Emits dark smoke particles ($v_y \in [-20, -40]\text{ px/s}$, colors `#303030`, `#484848`).
     - **Stage 3 (Ash Crumble & Dissolve, $0.95\text{s} \le t \le 1.30\text{s}$)**:
       - Displays `rebel_death_burn_ash_0` crumbling into `rebel_death_burn_ash_1` (smoking ash pile on ground).
       - Alpha fades from 1.0 to 0.0 during the final 0.2s.

---

### 4.3 Procedural Pixel-Art Sprite Specifications

Add the following 12 procedural sprite frames to `src/render/sprites/ProceduralSpriteFactory.ts`:

| Sprite Key | Dimensions ($W \times H$) | Anchor ($AX, AY$) | Visual Content |
| :--- | :---: | :---: | :--- |
| `rebel_death_standard_0` | $36 \times 42$ | $18, 40$ | Reeling backward, arms clutching chest, eyes wide, helmet tilting back. |
| `rebel_death_standard_1` | $36 \times 42$ | $18, 40$ | Buckling knees, body angled at 45° back, hands slipping from chest, mouth agape. |
| `rebel_death_standard_2` | $42 \times 32$ | $21, 30$ | Back and shoulders slamming ground, boots kicked up 6px, dust impact lines. |
| `rebel_death_standard_3` | $42 \times 24$ | $21, 22$ | Flat motionless corpse, dropped rifle beside body, helmet off on ground. |
| `rebel_death_explosion_air` | $38 \times 38$ | $19, 19$ | Center-anchored tumbling soldier without helmet, arched back, splayed limbs. |
| `rebel_death_explosion_helmet` | $14 \times 12$ | $7, 6$ | Detached German Stahlhelm helmet tumbling with metallic rim glint. |
| `rebel_death_explosion_land_0` | $44 \times 28$ | $22, 26$ | Hard bounce impact on stomach, arms thrown forward, impact shockwaves. |
| `rebel_death_explosion_land_1` | $44 \times 22$ | $22, 20$ | Charred/scorched sprawled corpse on floor, boots blackened. |
| `rebel_death_burn_thrash_0` | $36 \times 44$ | $18, 42$ | Arms raised high waving wildly, head back shouting, yellow/orange flame licking torso. |
| `rebel_death_burn_thrash_1` | $36 \times 44$ | $18, 42$ | Body hunched, arms thrashing down, white/yellow flame core, dark smoke wisps. |
| `rebel_death_burn_charcoal_0` | $36 \times 38$ | $18, 36$ | Pitch-black charcoal silhouette (`#181818`, `#303030`), glowing orange cracks (`#FF5500`). |
| `rebel_death_burn_ash_0` | $34 \times 20$ | $17, 18$ | Crumbled mound of ash and glowing embers, dissolving structure. |
| `rebel_death_burn_ash_1` | $32 \times 14$ | $16, 12$ | Flat settled ash mound with fading grey soot and embers. |

---

### 4.4 CanvasRenderer Integration

In `src/render/CanvasRenderer.ts`:
1. Extend `RenderSceneState` to accept `corpses?: RenderCorpseState[]`.
2. In `renderEntitiesPass`:
   Add corpse rendering before or after living enemies:
   ```typescript
   if (scene.corpses) {
     for (const corpse of scene.corpses) {
       const screen = camera.worldToScreen(corpse.x, corpse.y);
       const flip = corpse.facing === -1;

       if (corpse.deathType === 'explosion') {
         if (!corpse.isGrounded) {
           // Mid-air tumbling soldier
           this.spriteFactory.drawSprite(ctx, 'rebel_death_explosion_air', screen.x, screen.y, {
             rotation: corpse.rotation,
             flipX: flip,
             alpha: corpse.alpha,
           });
           // Flying detached helmet
           if (corpse.helmet) {
             const hScreen = camera.worldToScreen(corpse.helmet.x, corpse.helmet.y);
             this.spriteFactory.drawSprite(ctx, 'rebel_death_explosion_helmet', hScreen.x, hScreen.y, {
               rotation: corpse.helmet.rotation,
             });
           }
         } else {
           const landKey = corpse.frame === 0 ? 'rebel_death_explosion_land_0' : 'rebel_death_explosion_land_1';
           this.spriteFactory.drawSprite(ctx, landKey, screen.x, screen.y, { flipX: flip, alpha: corpse.alpha });
         }
       } else if (corpse.deathType === 'fire') {
         let burnKey = 'rebel_death_burn_thrash_0';
         if (corpse.stage === 'thrash') {
           burnKey = corpse.frame % 2 === 0 ? 'rebel_death_burn_thrash_0' : 'rebel_death_burn_thrash_1';
         } else if (corpse.stage === 'charcoal') {
           burnKey = 'rebel_death_burn_charcoal_0';
         } else {
           burnKey = corpse.frame === 0 ? 'rebel_death_burn_ash_0' : 'rebel_death_burn_ash_1';
         }
         this.spriteFactory.drawSprite(ctx, burnKey, screen.x, screen.y, { flipX: flip, alpha: corpse.alpha });
       } else {
         // Standard falling death
         const f = Math.min(3, Math.max(0, corpse.frame));
         this.spriteFactory.drawSprite(ctx, `rebel_death_standard_${f}`, screen.x, screen.y, {
           flipX: flip,
           alpha: corpse.alpha,
         });
       }

       // Render active particles (flames, smoke, impact dust)
       if (corpse.particles) {
         for (const p of corpse.particles) {
           const pScreen = camera.worldToScreen(p.x, p.y);
           ctx.fillStyle = p.color;
           ctx.fillRect(pScreen.x, pScreen.y, p.size, p.size);
         }
       }
     }
   }
   ```

---

### 4.5 Audio Synthesis Integration

In `src/audio/SoundEngine.ts`:
Add `playSoldierDeath(deathType: 'standard' | 'explosion' | 'fire')`:
- `'standard'`: Sawtooth/triangle glottal sweep from 240Hz down to 90Hz with lowpass filter cutoff sweep 800Hz $\rightarrow$ 200Hz, duration 0.25s.
- `'explosion'`: High-pitch shrieking sweep from 450Hz up to 680Hz and tumbling down to 180Hz with distortion waveshaper, duration 0.40s.
- `'fire'`: Dual-oscillator agonizing scream with FM vibrato (380Hz modulated by 18Hz LFO) layered with white noise bandpass flame crackle, duration 0.50s.

---

### 4.6 Concrete File Modification Roadmap for Implementer

| Priority | Target File | Action Required |
| :---: | :--- | :--- |
| **1** | `src/core/entities/enemies/EnemyTypes.ts` | Add `'explosion' \| 'fire'` to `DamageSourceType`, define `EnemyDeathType` and `EnemyDeathEvent`. |
| **2** | `src/core/entities/enemies/SoldierEnemy.ts` | Normalize `takeDamage` arguments, set `deathType`, emit `enemy_death` event on engine bus. |
| **3** | `src/core/weapons/ProjectileManager.ts` & `Grenade.ts` | Pass explicit `'bullet'`, `'fire'`, `'explosion'` source types into `takeDamage`. |
| **4** | `src/core/entities/enemies/DeathCorpseManager.ts` | **NEW FILE**: Implements corpse physics, ballistic arcs, timers, and particle emission. |
| **5** | `src/render/sprites/ProceduralSpriteFactory.ts` | Register 12 new procedural pixel-art death frames across standard, explosion, and burning. |
| **6** | `src/render/CanvasRenderer.ts` | Add corpse pass rendering sprites with rotation, flip, alpha, and particles. |
| **7** | `src/audio/AudioTypes.ts` & `SoundEngine.ts` | Add sound effects and synthesis for `playSoldierDeath(deathType)`. |
| **8** | `src/main.ts` | Instantiate `DeathCorpseManager`, update in game loop, pass corpses to `buildRenderSceneState`. |
| **9** | `tests/unit/death_animations.test.ts` | **NEW FILE**: Dedicated unit test suite verifying physics, state transitions, and sprite registrations. |
| **10** | `tests/e2e/death_animations.spec.ts` | **NEW FILE**: Playwright test capturing screenshots of all 3 death animations into `artifacts/death_animations/`. |

---

## 5. Verification Method

### 5.1 Unit Testing (`vitest`)
Run the complete unit test suite:
```bash
npm test
```
**Acceptance Criteria**:
1. All 257 existing unit tests in 20 test files pass with 0 failures (zero regressions).
2. New unit tests in `tests/unit/death_animations.test.ts` pass 100%:
   - Verifies `SoldierEnemy.takeDamage` sets `deathType` correctly for bullet, explosion, fire, and melee.
   - Verifies `SoldierEnemy.isAlive` becomes `false` immediately and entity is culled from `GameEngine` within 2 ticks.
   - Verifies `DeathCorpseManager` ballistic trajectory ($v_y < 0$ apex, positive gravity acceleration, ground impact at $y = \text{groundY}$).
   - Verifies `DeathCorpseManager` burning death stages (thrash $\rightarrow$ charcoal $\rightarrow$ ash crumble).
   - Verifies all 12 sprite keys exist in `ProceduralSpriteFactory` and render without throwing.

### 5.2 TypeScript Build
Verify zero compilation errors:
```bash
npm run build
```

### 5.3 Playwright E2E Visual Verification
Run the dedicated visual capture script:
```bash
npx playwright test tests/e2e/death_animations.spec.ts
```
**Inspection & Verification Conditions**:
- Inspect generated screenshot artifacts in `artifacts/death_animations/`:
  - `artifacts/death_animations/death_standard.png` (soldier in backward collapse on ground)
  - `artifacts/death_animations/death_explosion_blowback.png` (airborne tumbling soldier with detached flying helmet)
  - `artifacts/death_animations/death_burning.png` (soldier thrashing with active flame particles / charred ash)
- Each image file must exist, have valid PNG headers, and exceed 5,000 bytes in size.

### 5.4 Invalidation Conditions
The implementation will be deemed invalid if:
- `enemy_boss_statemachine.test.ts` fails (e.g. if `soldier.isAlive` remains true after death or entity remains in engine after 2 ticks).
- Frontal shield trooper deflections break or take unintended bullet damage.
- Explosions fail to tumble soldiers with rotational physics or omit the flying helmet.
- Burning death omits flame particles or does not collapse into ash.
