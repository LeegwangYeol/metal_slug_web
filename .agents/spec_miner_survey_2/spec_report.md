# Technical Specification Report: R1 (Core Engine & Mechanics) and R2 (Weapons & Combat)

**Author**: `spec_miner_survey_2`  
**Target Project**: Metal Slug Web (`fullmetalslug`)  
**Scope**: Requirements R1 & R2 (Game Physics, 8-Way Aiming, Melee Matrix, Weapons, Ammo Fallback, POW Rescue)  
**Date**: 2026-09-03  

---

## 1. Executive Summary & Specification Scope

This specification establishes the mathematical models, kinematic constants, discrete state machine transitions, collision resolution algorithms, and TypeScript interfaces for:
- **R1: Core Game Mechanics & Engine**: 8-way directional aiming vectors, player movement physics (run velocity, jump impulse, gravity, terminal velocity, crouch crawling), AABB hitboxes/hurtboxes, semi-solid platform one-way drop mechanics, and the melee knife vs. ranged projectile arbitration matrix.
- **R2: Weapons and Combat**: The 4 primary combat arsenals (Default Handgun, Heavy Machine Gun with angular spray sweeping, Flame Shot with piercing continuous AOE, and Hand Grenades with parabolic restitution bounce), the automated ammo depletion and weapon fallback pipeline, and the 6-phase Hostage POW rescue state machine with weighted loot drop tables.

All models are designed for a **purely headless, decoupled simulation core** (`src/core/`) operating on a deterministic 60Hz fixed timestep ($dt = 1/60 \approx 0.016667\text{ s}$).

---

## 2. R1: Core Game Mechanics & Engine Specification

### 2.1 Coordinate System & Timestep Foundation
- **Coordinate Space**: 2D Cartesian screen coordinates where the origin $(0,0)$ is top-left. $+X$ points East (right), $+Y$ points South (down).
- **Virtual Native Resolution**: $320 \times 224$ pixels (authentic Neo Geo arcade native aspect ratio) or scaled $16:9$ canvas of $480 \times 270$ pixels.
- **Fixed Timestep**: $\Delta t = \frac{1}{60} \text{ s} \approx 16.6667\text{ ms}$.
- **Kinematic Integration**: Semi-implicit Euler integration:
  $$v_{t + \Delta t} = v_t + a \cdot \Delta t$$
  $$x_{t + \Delta t} = x_t + v_{t + \Delta t} \cdot \Delta t$$

---

### 2.2 8-Way Aiming Coordinate Vectors & Input Mapping

The aiming direction is derived from directional inputs (Up, Down, Left, Right) combined with the player's facing horizontal orientation ($F_x \in \{-1, +1\}$) and locomotion state (Grounded vs Airborne).

#### Normalized Aim Vectors ($\vec{u}_{\text{aim}} = (u_x, u_y)$)
Let $\theta$ be the angle in radians from the positive X-axis (clockwise positive):

| Aim Mode | Input State | Facing ($F_x$) | Grounded? | Unit Vector $(u_x, u_y)$ | Angle ($\theta$) |
|---|---|---|---|---|---|
| **Forward Horizontal** | Neutral / Left / Right | $+1$ | Yes / No | $(+1.0000, 0.0000)$ | $0^\circ$ ($0\text{ rad}$) |
| **Forward Horizontal** | Neutral / Left / Right | $-1$ | Yes / No | $(-1.0000, 0.0000)$ | $180^\circ$ ($\pi\text{ rad}$) |
| **Upward Vertical** | Up | Any | Yes / No | $(0.0000, -1.0000)$ | $-90^\circ$ ($-\frac{\pi}{2}\text{ rad}$) |
| **Up-Forward Diagonal** | Up + Forward | $+1$ | Yes / No | $(+\frac{\sqrt{2}}{2}, -\frac{\sqrt{2}}{2}) \approx (+0.7071, -0.7071)$ | $-45^\circ$ ($-\frac{\pi}{4}\text{ rad}$) |
| **Up-Forward Diagonal** | Up + Forward | $-1$ | Yes / No | $(-\frac{\sqrt{2}}{2}, -\frac{\sqrt{2}}{2}) \approx (-0.7071, -0.7071)$ | $-135^\circ$ ($-\frac{3\pi}{4}\text{ rad}$) |
| **Downward Vertical** | Down | Any | **No (Air)** | $(0.0000, +1.0000)$ | $+90^\circ$ ($+\frac{\pi}{2}\text{ rad}$) |
| **Down-Forward Diagonal** | Down + Forward | $+1$ | **No (Air)** | $(+\frac{\sqrt{2}}{2}, +\frac{\sqrt{2}}{2}) \approx (+0.7071, +0.7071)$ | $+45^\circ$ ($+\frac{\pi}{4}\text{ rad}$) |
| **Down-Forward Diagonal** | Down + Forward | $-1$ | **No (Air)** | $(-\frac{\sqrt{2}}{2}, +\frac{\sqrt{2}}{2}) \approx (-0.7071, +0.7071)$ | $+135^\circ$ ($+\frac{3\pi}{4}\text{ rad}$) |
| **Crouched Horizontal** | Down / Down+Forward | $+1$ | **Yes (Ground)** | $(+1.0000, 0.0000)$ | $0^\circ$ |
| **Crouched Horizontal** | Down / Down+Forward | $-1$ | **Yes (Ground)** | $(-1.0000, 0.0000)$ | $180^\circ$ |

> **Critical Authentic Behavior**: When grounded, pressing **Down** puts the character into a **Crouch**. Pressing **Fire** while crouched fires **horizontally forward** at lower muzzle elevation. Downward vertical or downward diagonal firing is physically impossible on the ground and is **only enabled while airborne**.

---

### 2.3 Player Kinematic Physics Constants

All constants are specified both in real-time SI pixel units ($\text{px/s}, \text{px/s}^2$) and discrete 60Hz per-tick units ($\text{px/frame}, \text{px/frame}^2$):

| Parameter | Symbol | Continuous Unit | Per-Frame (60Hz) | Description / Notes |
|---|---|---|---|---|
| **Run Speed** | $V_{\text{run}}$ | $132.0\text{ px/s}$ | $2.20\text{ px/frame}$ | Constant horizontal running speed |
| **Crouch Crawl Speed** | $V_{\text{crawl}}$ | $54.0\text{ px/s}$ | $0.90\text{ px/frame}$ | Horizontal crawl speed while ducking |
| **Jump Initial Impulse** | $V_{\text{jump}}$ | $-348.0\text{ px/s}$ | $-5.80\text{ px/frame}$ | Instant upward velocity impulse at frame 0 |
| **Gravity Acceleration** | $g$ | $+720.0\text{ px/s}^2$ | $+0.20\text{ px/frame}^2$ | Constant downward gravitational acceleration |
| **Variable Jump Release Cut** | $k_{\text{jump\_cut}}$ | $0.45$ | $0.45$ | If jump button released early while $V_y < 0$, $V_y \leftarrow V_y \times 0.45$ |
| **Terminal Fall Velocity** | $V_{\text{term}}$ | $+480.0\text{ px/s}$ | $+8.00\text{ px/frame}$ | Clamped maximum downward falling velocity |
| **Horizontal Air Drag / Inertia** | $\mu_{\text{air}}$ | $1.00$ | $1.00$ | Full horizontal control in air (authentic arcade responsiveness) |
| **Max Jump Height** | $H_{\text{max}}$ | $84.1\text{ px}$ | $\approx 84\text{ px}$ | $H = \frac{V_0^2}{2g} = \frac{348^2}{2 \times 720} \approx 84.1\text{ px}$ |
| **Jump Total Air Time** | $T_{\text{air}}$ | $0.967\text{ s}$ | $58\text{ frames}$ | $T = \frac{2 |V_0|}{g} = \frac{2 \times 348}{720} \approx 0.967\text{ s}$ |

---

### 2.4 Posture Hitboxes, Hurtboxes & Muzzle Offsets

The player entity origin $(X, Y)$ is defined at the **bottom-center anchor** (midpoint of the feet resting on the ground plane).

#### Axis-Aligned Bounding Box (AABB) Hurtbox Definitions:
- `Hurtbox.x = Entity.X + OffsetX`
- `Hurtbox.y = Entity.Y + OffsetY`

```
           Standing                      Crouching
         [--- 24px ---]                [--- 24px ---]
     +--------------------+   -40px
     |                    |
     |     (Head/Torso)   |
     |                    |        +--------------------+   -22px
     |                    | -22px  |    (Duck Torso)    |
     |       (Legs)       |        |                    |
     +---------+----------+   0px  +---------+----------+   0px
               |                             |
          Anchor (X, Y)                 Anchor (X, Y)
```

| Posture | Width ($W$) | Height ($H$) | Offset X | Offset Y | Bounding Box $[X_{\min}, Y_{\min}, X_{\max}, Y_{\max}]$ |
|---|---|---|---|---|---|
| **Standing / Running** | $24\text{ px}$ | $40\text{ px}$ | $-12\text{ px}$ | $-40\text{ px}$ | $[X - 12, Y - 40, X + 12, Y]$ |
| **Crouching / Crawling** | $24\text{ px}$ | $22\text{ px}$ | $-12\text{ px}$ | $-22\text{ px}$ | $[X - 12, Y - 22, X + 12, Y]$ |
| **Airborne (Jump/Fall)** | $24\text{ px}$ | $36\text{ px}$ | $-12\text{ px}$ | $-38\text{ px}$ | $[X - 12, Y - 38, X + 12, Y - 2]$ |

#### Muzzle Emission Point Offsets (Relative to Anchor $(X,Y)$ and Facing $F_x$):
- **Standing Forward**: $(\Delta x, \Delta y) = (F_x \cdot 18, -24)$
- **Standing Up**: $(\Delta x, \Delta y) = (F_x \cdot 4, -46)$
- **Standing Diagonal Up**: $(\Delta x, \Delta y) = (F_x \cdot 16, -38)$
- **Crouching Forward**: $(\Delta x, \Delta y) = (F_x \cdot 18, -12)$
- **Airborne Down**: $(\Delta x, \Delta y) = (F_x \cdot 2, -6)$
- **Airborne Diagonal Down**: $(\Delta x, \Delta y) = (F_x \cdot 14, -8)$

---

### 2.5 Semi-Solid Platform One-Way Drop Mechanics

#### Platform Collision Model:
1. **Semi-Solid Platform Definition**: An obstacle bounding box $[P_{x1}, P_{y1}, P_{x2}, P_{y2}]$ where only the top edge $Y = P_{y1}$ provides collision support.
2. **Support Condition (Landing)**:
   A player at previous position $(X_{t-1}, Y_{t-1})$ moving to current position $(X_t, Y_t)$ with velocity $V_y \ge 0$ lands on the platform if and only if:
   $$X_t + W_{\text{half}} > P_{x1} \quad \land \quad X_t - W_{\text{half}} < P_{x2}$$
   $$Y_{t-1} \le P_{y1} + \epsilon_{\text{snap}} \quad \land \quad Y_t \ge P_{y1}$$
   where $\epsilon_{\text{snap}} = 4.0\text{ px}$.
   Upon landing:
   $$Y_t \leftarrow P_{y1}, \quad V_y \leftarrow 0, \quad \text{IsGrounded} \leftarrow \text{true}$$

3. **One-Way Drop-Through Trigger**:
   - **Input Condition**: $\text{Input.Down} = \text{true} \land \text{Input.JumpPressed} = \text{true}$.
   - **Execution**:
     1. Player posture sets `dropThroughActive = true`.
     2. Sets `ignoredPlatformId = currentPlatform.id`.
     3. Adds initial downward push: $V_y \leftarrow +120.0\text{ px/s}$ ($+2.0\text{ px/frame}$).
     4. Sets `dropThroughTimer = 18\text{ frames}$ ($0.30\text{ s}$).
     5. While `dropThroughActive` is true or $Y_t - 22 < P_{y1}$, platform $P$ is completely excluded from collision checks.

---

### 2.6 Melee Knife Proximity Threshold vs Ranged Firing Decision Matrix

When the player triggers the **Shoot Action Button**, the combat engine executes a deterministic decision matrix before allocating any projectile entities.

#### Decision Algorithm:
```
IF player.isMeleeInCoolDown THEN
    RETURN NO_ACTION
END IF

candidateEnemies = FindAliveEnemiesInArea(player.x, player.y, MELEE_SCAN_BOX)
meleeTarget = FilterKnifeEligibleTarget(candidateEnemies, player.facing)

IF meleeTarget != NULL THEN
    player.EnterState(PLAYER_STATE.MELEE_KNIFE)
    meleeTarget.ApplyDamage(MELEE_DAMAGE)
    PlaySound("KNIFE_SLASH")
    SpawnEffect("KNIFE_SWOOSH_FX", player.muzzleX, player.muzzleY)
    AwardScore(MELEE_KILL_SCORE_BONUS)
ELSE
    player.EnterState(PLAYER_STATE.RANGED_SHOOT)
    player.activeWeapon.Fire(player.aimVector, player.muzzlePosition)
END IF
```

#### Melee Parameters & Geometric Tolerances:
- **Melee Detection Box (Relative to Anchor)**:
  - Horizontal Reach: In front of player, from $X + F_x \cdot 0\text{ px}$ to $X + F_x \cdot 38.0\text{ px}$.
  - Backward Tolerance: Behind player up to $X - F_x \cdot 6.0\text{ px}$ (ensures overlapping sprites register).
  - Vertical Tolerance: $\Delta Y \in [-34\text{ px}, +10\text{ px}]$ relative to player anchor.
- **Target Eligibility**:
  - `target.isInvulnerable == false`
  - `target.isMeleeVulnerable == true` (Infantry: Rebel Rifleman, Knife Charger, Grenade Thrower, Shield Trooper from rear, Hostage Ropes). Heavy vehicles and armored bosses reject knife hits unless scripted.
- **Damage & Frame Data**:
  - **Damage**: $3.0\text{ HP}$ (Instantly kills standard $1.0\text{ HP}$ Rebel Soldiers).
  - **Animation Duration**: $18\text{ frames}$ ($300\text{ ms}$).
  - **Active Hitbox Frames**: Frame 5 to Frame 9.
  - **Score Award**: $500\text{ points}$ (vs $100\text{ points}$ for standard bullet kill).

---

## 3. R2: Weapons and Combat Specification

### 3.1 Combat Architecture & Weapon Inventory Data Schema
The player holds an active weapon slot and a grenade inventory:
- `activeWeapon: WeaponType` (`HANDGUN | HEAVY_MACHINE_GUN | FLAME_SHOT`)
- `ammoPool: Record<WeaponType, number>`:
  - `HANDGUN`: $\infty$ (unlimited)
  - `HEAVY_MACHINE_GUN`: Initial $200$, Max $999$
  - `FLAME_SHOT`: Initial $30$, Max $99$
- `grenadeCount`: Initial $10$, Max $99$

---

### 3.2 Default Handgun (Semi-Automatic)
- **Firing Mechanism**: Semi-automatic (requires distinct key-down release or throttle).
- **Fire Rate**: Max $6.67\text{ shots/s}$ (minimum cooldown $\tau_{\text{cooldown}} = 9\text{ frames} = 150\text{ ms}$).
- **Max Concurrent On-Screen Projectiles**: $4\text{ bullets}$. Firing is locked if $4$ active player handgun bullets exist in the simulation space.
- **Kinematics**:
  - Velocity: $\vec{V}_{\text{bullet}} = \vec{u}_{\text{aim}} \cdot 660.0\text{ px/s}$ ($11.0\text{ px/frame}$).
  - Gravity: $0\text{ px/s}^2$ (linear trajectory).
  - Lifetime: $T_{\text{life}} = 1.0\text{ s}$ ($60\text{ frames}$) or until stage boundary.
- **Hitbox**: $6 \times 4\text{ px}$ bounding box oriented along velocity.
- **Damage**: $1.0\text{ HP}$.
- **Piercing**: None ($0$). Destroyed on first entity collision.

---

### 3.3 Heavy Machine Gun ("HMG" / "H")
- **Capacity**: $200\text{ rounds}$ per pickup crate. Stacks up to $999$.
- **Firing Mechanism**: Fully automatic (hold fire button down).
- **Fire Rate**: $15.0\text{ shots/s}$ (fires once every $4\text{ frames} = 66.67\text{ ms}$).
- **Kinematics**:
  - Velocity: $\vec{V}_{\text{bullet}} = \vec{u}_{\text{spray}} \cdot 780.0\text{ px/s}$ ($13.0\text{ px/frame}$).
  - Damage: $1.0\text{ HP}$ per bullet.
  - Piercing: $0$ (single target).

#### Dynamic Angle Sweeping & Spray Dispersion Model:
When the player holds down the fire button while changing directional input (e.g. pivoting from Horizontal $[1, 0]$ to Up $[0, -1]$), the gun muzzle does not snap instantaneously. Instead, the firing vector $\theta_{\text{current}}$ sweeps continuously toward $\theta_{\text{target}}$:
$$\frac{d\theta}{dt} = \text{clamp}\left(\text{AngleDifference}(\theta_{\text{target}}, \theta_{\text{current}}), -\omega_{\text{sweep}} \Delta t, +\omega_{\text{sweep}} \Delta t\right)$$
where $\omega_{\text{sweep}} = 12.0\text{ rad/s} \approx 687.5^\circ/\text{s}$ ($11.45^\circ/\text{frame}$).

In addition, each fired bullet adds a minor pseudo-random stochastic dispersion jitter:
$$\theta_{\text{spray}} = \theta_{\text{current}} + \delta, \quad \delta \sim \mathcal{U}(-0.045\text{ rad}, +0.045\text{ rad}) \quad (\approx \pm 2.58^\circ)$$
$$\vec{u}_{\text{spray}} = (\cos \theta_{\text{spray}}, \sin \theta_{\text{spray}})$$

#### Spent Brass Casing Particle Physics:
At each shot:
- Spawn casing at $(X_{\text{muzzle}} - F_x \cdot 4, Y_{\text{muzzle}} - 2)$.
- Initial Velocity: $V_{cx} = -F_x \cdot (70 + \text{rand}(0, 30))\text{ px/s}$, $V_{cy} = -(120 + \text{rand}(0, 40))\text{ px/s}$.
- Gravity: $g_c = +900\text{ px/s}^2$. Restitution on floor: $e = 0.4$.

---

### 3.4 Flame Shot ("Flame" / "F")
- **Capacity**: $30\text{ fuel shots}$ per pickup crate. Stacks up to $99$.
- **Firing Mechanism**: Semi-auto or continuous stream. Fire interval $\tau_{\text{flame}} = 18\text{ frames} = 300\text{ ms}$.
- **Projectile Kinematics**:
  - Velocity: $\vec{V}_{\text{flame}} = \vec{u}_{\text{aim}} \cdot 330.0\text{ px/s}$ ($5.5\text{ px/frame}$).
  - Lifetime: $T_{\text{life}} = 0.55\text{ s}$ ($33\text{ frames}$).
- **Expanding Circular Hitbox**:
  The radius $R(t)$ expands linearly over time:
  $$R(t) = R_{\text{start}} + (R_{\text{max}} - R_{\text{start}}) \cdot \frac{t}{T_{\text{life}}}$$
  where $R_{\text{start}} = 10.0\text{ px}$, $R_{\text{max}} = 36.0\text{ px}$.
- **Piercing Multi-Hit Tick Damage Model**:
  - The Flame projectile **never despawns upon colliding with an enemy**; it pierces through all organic and non-solid entities.
  - To prevent dealing damage on every single frame, each enemy maintains an internal `damageImmunityTimer`:
    - Flame Shot delivers $1.5\text{ HP}$ damage per tick every $6\text{ frames}$ ($100\text{ ms}$).
    - Total theoretical single-target damage across a passing flame burst: $\approx 4.5 \text{ to } 6.0\text{ HP}$.
- **Ground Fire Residue AOE**:
  - When the center or perimeter of a Flame Shot intersects a solid ground tile or wall, it spawns a stationary `GroundFireAOE` entity:
    - Duration: $1.2\text{ s}$ ($72\text{ frames}$).
    - Damage: $1.0\text{ HP}$ per $10\text{ frames}$ ($166\text{ ms}$) to any enemy entering its $32 \times 16\text{ px}$ footprint.
- **Enemy Burn Death Flag**:
  Any infantry killed by Flame Shot triggers the `DEATH_BURNING` animation state (running while aflame, screaming before collapsing to ash).

---

### 3.5 Hand Grenade (Secondary Throwing Weapon)
- **Inventory**: $10\text{ grenades}$ default.
- **Trigger**: Grenade Throw Button (`K` / `Button 2`).
- **Throw Kinematics**:
  - **Standing Throw**:
    $$V_{0x} = F_x \cdot 240.0\text{ px/s} \quad (F_x \cdot 4.0\text{ px/frame})$$
    $$V_{0y} = -312.0\text{ px/s} \quad (-5.2\text{ px/frame})$$
  - **Crouch Throw (Low Roll Arc)**:
    $$V_{0x} = F_x \cdot 288.0\text{ px/s} \quad (F_x \cdot 4.8\text{ px/frame})$$
    $$V_{0y} = -90.0\text{ px/s} \quad (-1.5\text{ px/frame})$$
  - **Downwards Airborne Throw**:
    $$V_{0x} = F_x \cdot 120.0\text{ px/s}, \quad V_{0y} = +240.0\text{ px/s}$$
- **Gravity & Bouncing Dynamics**:
  - Downward gravity: $g_{\text{grenade}} = +780.0\text{ px/s}^2$ ($+0.217\text{ px/frame}^2$).
  - Ground Collision Coefficient of Restitution: $e_y = 0.50$, $e_x = 0.70$.
  - Upon ground contact:
    $$V_y \leftarrow -e_y \cdot V_y, \quad V_x \leftarrow e_x \cdot V_x$$
    If $|V_y| < 30.0\text{ px/s}$, set $V_y \leftarrow 0$ (comes to rest and rolls).
- **Detonation Conditions**:
  1. **Direct Impact**: Immediately detonates upon intersection with any enemy or boss hurtbox.
  2. **Fuse Expiry**: If no impact, detonates after $T_{\text{fuse}} = 1.25\text{ s}$ ($75\text{ frames}$).
- **Blast AOE & Damage Distribution**:
  - Epicenter Radius $R_{\text{inner}} = 18.0\text{ px}$: Deals maximum damage $D_{\text{max}} = 10.0\text{ HP}$.
  - Outer Blast Radius $R_{\text{outer}} = 52.0\text{ px}$: Linear damage falloff:
    $$D(d) = D_{\text{max}} - (D_{\text{max}} - D_{\text{min}}) \cdot \frac{d - R_{\text{inner}}}{R_{\text{outer}} - R_{\text{inner}}}, \quad D_{\text{min}} = 4.0\text{ HP}$$
  - Destruction Capability: Destroys enemy bullets, sandbags, wooden barriers, and clears enemy infantry within the blast radius.
  - Camera Shake: $5.0\text{ px}$ amplitude decaying over $12\text{ frames}$.

---

### 3.6 Ammo Depletion & Auto-Fallback Logic

```
                    +--------------------------------+
                    | Current Weapon: HMG / FLAMESHOT|
                    +--------------------------------+
                                   |
                             Fires a Round
                                   |
                                   v
                             Ammo = Ammo - 1
                                   |
                       +-----------+-----------+
                       |                       |
                  Ammo > 0                  Ammo == 0
                       |                       |
                    Continue                   v
                                     +-------------------+
                                     | Finish Current    |
                                     | Shot Tick / Burst |
                                     +-------------------+
                                               |
                                               v
                                     +-------------------+
                                     | Switch Weapon to  |
                                     | HANDGUN (Ammo: ∞) |
                                     +-------------------+
                                               |
                                               v
                                     +-------------------+
                                     | Trigger HUD Event |
                                     | Play Click SFX    |
                                     +-------------------+
```

#### State Invariants:
1. When ammo reaches $0$, any active projectile already in-flight remains unaffected and completes its lifetime.
2. The weapon transition occurs immediately at the end of the current frame tick ($t \to t+1$).
3. The HUD weapon badge icon switches from `"H"` / `"F"` to `"PISTOL"`, and counter displays `"∞"`.
4. If the player picks up a weapon badge while currently holding special weapon:
   - **Same Weapon Type**: Ammo accumulates ($\text{Ammo}_{\text{new}} = \min(\text{Ammo}_{\text{current}} + \text{Ammo}_{\text{bonus}}, 999)$).
   - **Different Weapon Type**: Replaces active weapon immediately with new weapon type, sets initial ammo, and triggers the distinct announcer voice line (*"HEAVY MACHINE GUN!"* or *"FLAME SHOT!"*).

---

### 3.7 Hostage POW Rescue State Machine & Item Drop Tables

#### 6-State POW Life Cycle:

```
[TIED_UP] --- (Hit by player bullet/knife) ---> [FREED]
                                                  |
                                             (Timer 30f)
                                                  |
                                                  v
                                               [SALUTE]  ("THANK YOU!")
                                                  |
                                             (Timer 20f)
                                                  |
                                                  v
                                            [OFFERING_ITEM] ---> (Spawns Item Crate)
                                                  |
                                             (Item Picked / Timer 30f)
                                                  |
                                                  v
                                              [ESCAPING] (Runs to screen edge)
                                                  |
                                             (Off screen)
                                                  |
                                                  v
                                               [SAVED] (Score tally +10,000 pts)
```

#### State Definitions & Transition Rules:
1. `TIED_UP`:
   - Hurtbox: $20 \times 32\text{ px}$.
   - Vulnerability: Takes damage only from player weapons/knife ($HP = 1.0$). Immune to enemy fire.
   - On taking player damage: Transitions to `FREED`.
2. `FREED`:
   - Animation: Ropes snap off, pants drop comedic hop animation.
   - Duration: $30\text{ frames}$ ($500\text{ ms}$). Invulnerable to all damage.
   - Transition: At frame 30, transitions to `SALUTE`.
3. `SALUTE`:
   - Animation: Stands erect, salutes player.
   - Audio: Triggers arcade voice sample *"THANK YOU!"*.
   - Duration: $25\text{ frames}$.
   - Transition: At frame 25, transitions to `OFFERING_ITEM`.
4. `OFFERING_ITEM`:
   - Animation: Reaches into trousers/backpack, produces an item crate or weapon badge.
   - Action: Instantiates the selected `ItemDrop` entity with a slight upward velocity ($V_y = -120.0\text{ px/s}$).
   - Duration: $35\text{ frames}$.
   - Transition: Transitions to `ESCAPING`.
5. `ESCAPING`:
   - Behavior: Runs toward the nearest screen edge (left if $X < \text{CameraCenter}$, right otherwise) at $V_{\text{run}} = 100.0\text{ px/s}$.
   - Transition: Once $X < \text{CameraLeft} - 32\text{ px}$ or $X > \text{CameraRight} + 32\text{ px}$, transitions to `SAVED` and entity is removed from memory.
6. `SAVED`:
   - Counter: Increments stage rescued hostage tally `player.rescuedPowCount++`.
   - Stage Clear Bonus: Each saved POW awards $10,000\text{ points}$ at mission complete screen.

#### Item Drop Table Specifications:
Drop selection can be **Scripted** (by level map data) or **Dynamic Weighted RNG**:

| Drop Type | Item ID | Weighted Probability | Ammo / Value | Description |
|---|---|---|---|---|
| **Heavy Machine Gun** | `ITEM_WEAPON_HMG` | $35\%$ | $+200\text{ rounds}$ | Letter "H" spinning badge icon |
| **Flame Shot** | `ITEM_WEAPON_FLAME` | $25\%$ | $+30\text{ fuel}$ | Letter "F" spinning badge icon |
| **Hand Grenade Crate** | `ITEM_GRENADE_BOX` | $20\%$ | $+10\text{ grenades}$ | Olive-drab ammo crate with grenade insignia |
| **Score Bonus: Banana** | `ITEM_SCORE_BANANA` | $8\%$ | $+500\text{ pts}$ | Edible fruit score item |
| **Score Bonus: Roast Chicken** | `ITEM_SCORE_CHICKEN` | $6\%$ | $+1,000\text{ pts}$ | Steaming roasted chicken |
| **Score Bonus: Gold Coin** | `ITEM_SCORE_COIN` | $4\%$ | $+100\text{ pts}$ | Spinning gold coin |
| **Score Bonus: Jewel / Diamond**| `ITEM_SCORE_JEWEL` | $2\%$ | $+3,000\text{ pts}$ | Sparkling gemstone |

---

## 4. Formal TypeScript Interfaces & Type Contracts

```typescript
/**
 * Vector and Geometry Primitives
 */
export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

export interface MutableVector2D {
  x: number;
  y: number;
}

export interface AABB {
  x: number; // Top-left x
  y: number; // Top-left y
  width: number;
  height: number;
}

export enum FacingDirection {
  LEFT = -1,
  RIGHT = 1,
}

export enum AimAngle {
  FORWARD = 0,
  UP_FORWARD = 1,
  UP = 2,
  DOWN_FORWARD = 3,
  DOWN = 4,
}

/**
 * Player Locomotion and Actions
 */
export enum PlayerPosture {
  STANDING = 'STANDING',
  CROUCHING = 'CROUCHING',
  AIRBORNE = 'AIRBORNE',
}

export enum PlayerActionState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  JUMPING = 'JUMPING',
  FALLING = 'FALLING',
  CROUCH_IDLE = 'CROUCH_IDLE',
  CRAWLING = 'CRAWLING',
  MELEE_SLASH = 'MELEE_SLASH',
  HIT_STUN = 'HIT_STUN',
  DEAD = 'DEAD',
}

export interface PlayerInputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  shootPressed: boolean;
  shootHeld: boolean;
  grenadePressed: boolean;
}

export interface PlayerPhysicsConstants {
  runSpeed: number;           // 132 px/s
  crawlSpeed: number;         // 54 px/s
  jumpImpulse: number;        // -348 px/s
  gravity: number;            // +720 px/s^2
  jumpReleaseCutRatio: number;// 0.45
  terminalFallVelocity: number;// 480 px/s
}

/**
 * Weapons and Projectiles
 */
export enum WeaponType {
  HANDGUN = 'HANDGUN',
  HEAVY_MACHINE_GUN = 'HEAVY_MACHINE_GUN',
  FLAME_SHOT = 'FLAME_SHOT',
}

export interface WeaponConfig {
  type: WeaponType;
  isAutomatic: boolean;
  fireCooldownFrames: number;
  initialAmmo: number;
  maxAmmo: number;
  projectileSpeed: number;
  projectileDamage: number;
  piercing: boolean;
  soundCueKey: string;
  announcerVoiceKey?: string;
}

export interface ProjectileEntity {
  id: string;
  weaponType: WeaponType;
  position: MutableVector2D;
  velocity: MutableVector2D;
  damage: number;
  radius?: number;            // For Flame Shot
  hitbox: AABB;
  lifeTimeFrames: number;
  maxLifeTimeFrames: number;
  isAlive: boolean;
  pierces: boolean;
  damagedEntityIds: Set<string>;
}

export interface GrenadeEntity {
  id: string;
  position: MutableVector2D;
  velocity: MutableVector2D;
  fuseTimerFrames: number;
  bouncesRemaining: number;
  isAlive: boolean;
  isExploding: boolean;
  blastInnerRadius: number;  // 18 px
  blastOuterRadius: number;  // 52 px
  maxDamage: number;         // 10 HP
}

/**
 * Melee System
 */
export interface MeleeScanConfig {
  reachForward: number;      // 38 px
  reachBehind: number;       // 6 px
  reachVerticalUp: number;   // 34 px
  reachVerticalDown: number; // 10 px
  damage: number;            // 3.0 HP
  animationFrames: number;   // 18 frames
  activeHitboxStart: number; // frame 5
  activeHitboxEnd: number;   // frame 9
  scoreBonus: number;        // 500 pts
}

export interface MeleeTargetCandidate {
  id: string;
  isAlive: boolean;
  isMeleeVulnerable: boolean;
  hurtbox: AABB;
}

/**
 * Platforms and Drop-Through
 */
export interface SemiSolidPlatform {
  id: string;
  bounds: AABB;
  isSemiSolid: boolean; // True if can jump through from bottom
}

export interface PlatformCollisionResult {
  isColliding: boolean;
  groundY: number;
  platformId?: string;
}

/**
 * Hostage POW System
 */
export enum PowState {
  TIED_UP = 'TIED_UP',
  FREED = 'FREED',
  SALUTE = 'SALUTE',
  OFFERING_ITEM = 'OFFERING_ITEM',
  ESCAPING = 'ESCAPING',
  SAVED = 'SAVED',
}

export enum ItemDropType {
  WEAPON_HMG = 'ITEM_WEAPON_HMG',
  WEAPON_FLAME = 'ITEM_WEAPON_FLAME',
  GRENADE_CRATE = 'ITEM_GRENADE_BOX',
  SCORE_BANANA = 'ITEM_SCORE_BANANA',
  SCORE_CHICKEN = 'ITEM_SCORE_CHICKEN',
  SCORE_COIN = 'ITEM_SCORE_COIN',
  SCORE_JEWEL = 'ITEM_SCORE_JEWEL',
}

export interface PowEntity {
  id: string;
  position: MutableVector2D;
  state: PowState;
  stateTimerFrames: number;
  assignedDropType: ItemDropType;
  facing: FacingDirection;
  isAlive: boolean;
}
```

---

## 5. State Machine Transition Matrices

### 5.1 Player Locomotion & Posture State Machine

| Current State | Condition / Event | Next State | Action / Side Effects |
|---|---|---|---|
| **IDLE** | Left or Right held | **RUNNING** | $V_x \leftarrow F_x \cdot V_{\text{run}}$ |
| **IDLE** | Jump pressed | **JUMPING** | $V_y \leftarrow V_{\text{jump}}$, Grounded = false |
| **IDLE** | Down held | **CROUCH_IDLE** | Height shrinks to $22\text{ px}$ |
| **RUNNING** | Direction input released | **IDLE** | $V_x \leftarrow 0$ |
| **RUNNING** | Jump pressed | **JUMPING** | $V_y \leftarrow V_{\text{jump}}$, preserves $V_x$ |
| **RUNNING** | Down held | **CRAWLING** | $V_x \leftarrow F_x \cdot V_{\text{crawl}}$, crouch hurtbox |
| **CROUCH_IDLE**| Down released | **IDLE** | Height expands to $40\text{ px}$ |
| **CROUCH_IDLE**| Left/Right held | **CRAWLING** | $V_x \leftarrow F_x \cdot V_{\text{crawl}}$ |
| **CROUCH_IDLE**| Down held + Jump pressed on Semi-Solid | **FALLING** | `dropThroughActive = true`, ignore platform |
| **CRAWLING** | Left/Right released | **CROUCH_IDLE** | $V_x \leftarrow 0$ |
| **CRAWLING** | Down released | **RUNNING** | $V_x \leftarrow F_x \cdot V_{\text{run}}$, stand hurtbox |
| **JUMPING** | $V_y \ge 0$ (Apex reached) | **FALLING** | Gravity continues |
| **JUMPING** | Jump button released early ($V_y < 0$) | **JUMPING** | $V_y \leftarrow V_y \times 0.45$ (jump cut) |
| **FALLING** | Lands on solid ground or platform top | **IDLE** | $V_y \leftarrow 0$, Grounded = true |
| **ANY (Ground)**| Shoot pressed & Melee Target in range | **MELEE_SLASH** | Lock motion, deal melee dmg at frame 5 |
| **MELEE_SLASH**| Frame 18 reached | **IDLE** | Return to posture before melee |

---

### 5.2 Weapon Firing & Fallback State Machine

| Current Weapon | Ammo Count | Firing Condition | Output Action | Next State |
|---|---|---|---|---|
| **HANDGUN** | $\infty$ | Shoot pressed & on-screen bullets $< 4$ | Spawn bullet entity, set cooldown 9 frames | Ready after 9f |
| **HMG** | $> 1$ | Shoot held & cooldown timer $0$ | Spawn HMG bullet with sweep/jitter, ammo -= 1, cooldown 4f | **HMG** |
| **HMG** | $1$ | Shoot held & cooldown timer $0$ | Spawn final HMG bullet, ammo = 0 | **Switching to HANDGUN** |
| **HMG** | $0$ | Post-burst frame tick | Auto fallback to HANDGUN, update HUD, play switch sound | **HANDGUN** |
| **FLAME_SHOT** | $> 1$ | Shoot pressed/held & cooldown 0 | Spawn expanding flame entity, ammo -= 1, cooldown 18f | **FLAME_SHOT** |
| **FLAME_SHOT** | $1$ | Shoot pressed/held & cooldown 0 | Spawn flame entity, ammo = 0 | **Switching to HANDGUN** |
| **FLAME_SHOT** | $0$ | Post-burst frame tick | Auto fallback to HANDGUN, update HUD, play switch sound | **HANDGUN** |
| **ANY** | Any | Collide with Weapon Crate (same type) | Ammo += bonus (capped at 999), play pickup SFX | Current Weapon |
| **ANY** | Any | Collide with Weapon Crate (new type) | ActiveWeapon = new type, ammo = new capacity, Announcer Voice | New Weapon |

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1 Engine | 8-Way Aiming Matrix | Maps directional keys and facing direction to normalized aim unit vectors. Disallows down-aim while grounded. | `left, right, up, down, isGrounded, facing` | Normalized `Vector2D` $(u_x, u_y)$ and `AimAngle` enum | Default to forward horizontal if invalid/ambiguous | ORIGINAL_REQUEST.md & COLLABORATION.md |
| 2 | R1 Engine | Variable Jump Apex Cut | Releases jump early to perform short hops vs full jumps. | `jumpHeld == false` while $V_y < 0$ | $V_y \leftarrow V_y \times 0.45$ | Ignore if already falling ($V_y \ge 0$) | SNK Neo Geo Arcade Spec |
| 3 | R1 Engine | Crouch Crawl Motion | Crawl under bullets while ducking. | `down + (left or right)` | $V_x = F_x \cdot 54\text{ px/s}$, crouch hurtbox ($22\text{px}$) | Clamped at screen/level bounds | COLLABORATION.md §2 |
| 4 | R1 Engine | Semi-Solid Platform Drop | Fall through semi-solid wooden platforms/bridges. | `down + jumpPressed` on semi-solid | `dropThroughActive = true`, ignore collision for 18f | Ignore if platform is fully solid block | COLLABORATION.md §2 |
| 5 | R1 Engine | Melee Knife Proximity Arbitration | Automatically slashes with combat knife if enemy infantry is within 38px in front. | `shootPressed`, player position, enemy positions | Spawns melee slash entity, deals 3 HP damage, skips bullet spawn | Fallback to ranged shoot if target invulnerable or out of range | ORIGINAL_REQUEST.md §R1 |
| 6 | R2 Weapons | Semi-Auto Handgun Throttling | Infinite ammo starter weapon with max 4 concurrent on-screen projectiles. | `shootPressed`, active bullet count | Bullet entity at $660\text{ px/s}$, 1 damage | Fire request rejected if active bullets == 4 | COLLABORATION.md §3 |
| 7 | R2 Weapons | Heavy Machine Gun Dynamic Sweeping | 200-round rapid fire with smooth angular sweeping when steering aim. | `shootHeld`, direction inputs | Bullet stream rotating at $\omega = 12\text{ rad/s}$ with $\pm 2.5^\circ$ jitter | Snaps to nearest valid angle if input released | ORIGINAL_REQUEST.md §R2 |
| 8 | R2 Weapons | Flame Shot Continuous Piercing AOE | Large expanding fireball that pierces enemies and inflicts tick damage. | `shootPressed/held`, ammo counter | Piercing flame entity expanding from $10\text{px}$ to $36\text{px}$, ground fire AOE | Clamped to level boundary | COLLABORATION.md §3 |
| 9 | R2 Weapons | Hand Grenade Parabolic Bouncing | Arcing explosive projectile that bounces on ground and detonates on enemy impact or timer. | `grenadePressed`, posture | Parabolic arc, $e=0.5$ ground bounce, $52\text{px}$ AOE blast | Explodes immediately if touching enemy hurtbox | COLLABORATION.md §2 |
| 10 | R2 Weapons | Ammo Auto-Fallback to Pistol | Seamlessly reverts to infinite handgun upon expending last HMG/Flame shot. | Current ammo == 0 after tick | Active weapon sets to HANDGUN, HUD update, switch SFX | Prevents player from being weaponless | ORIGINAL_REQUEST.md §R2 |
| 11 | R2 Weapons | POW Rescue Life Cycle | Rescuable hostage with 6-state progression from tied to salute to item drop to escape. | Weapon hit on POW rope, proximity | Spawns item crate, plays "THANK YOU!", increments saved counter | POW cannot be killed by enemy fire | COLLABORATION.md §3 |
| 12 | R2 Weapons | Weighted Loot Drop Engine | Generates weapon badges, grenade boxes, or food items based on probability weights. | POW item drop trigger / crate break | Spawned pickup entity with upward bounce velocity | Fallback to Banana if RNG index fails | COLLABORATION.md §3 |

---

## 7. Edge Cases & Empirical Resolution Table

| # | Feature | Input / Trigger Condition | Edge Case Scenario | Specified System Behavior |
|---|---------|---------------------------|-------------------|---------------------------|
| 1 | 8-Way Aiming | Grounded player presses Down + Shoot | Player aims Down while on ground | Character crouches and fires **horizontally forward** at lower elevation ($Y - 12\text{px}$). Bullet does **not** fire into floor. |
| 2 | 8-Way Aiming | Airborne player rapidly alternates Left/Right while aiming Down | Rapid horizontal flip while shooting downward | Aim vector stays strictly $(0, +1)$ downwards. Sprite flips horizontal facing without deflecting bullet trajectory. |
| 3 | Semi-Solid Platform | Standing on two vertically stacked semi-solid platforms | Player drops through top platform with another platform 10px below | Ignored platform filter applies specifically to the platform ID where drop initiated. Landing detection evaluates platform 2 correctly once clear of platform 1. |
| 4 | Semi-Solid Platform | Jumping upwards through a semi-solid platform while pressing Down | Player upward velocity $V_y < 0$ while crossing platform top | Collision is skipped as long as $V_y < 0$. Landing only resolves when $V_y \ge 0$ and feet cross downward. |
| 5 | Melee Arbitration | Target enemy dies on exact frame of melee trigger | Enemy health becomes 0 from a previous bullet in flight | Melee check filters for `isAlive == true`. If enemy died on same frame, melee check fails and engine executes standard ranged shot. |
| 6 | Melee Arbitration | Armored Tank Boss within 38px melee distance | Player presses shoot right next to tank hull | Tank has `isMeleeVulnerable == false`. Melee knife does not trigger; player fires active weapon (Handgun/HMG/Flame) into tank. |
| 7 | HMG Ammo Fallback | Player holds fire button with exactly 1 round remaining | Weapon fires last bullet and immediately updates state | Bullet #200 spawns normally. Weapon pointer switches to Handgun. Player must release and re-press or auto-throttle into Handgun semi-auto mode. |
| 8 | Weapon Pickup | Player has 150 HMG rounds and picks up another HMG badge | Same weapon pickup | Ammo stacks: $150 + 200 = 350\text{ rounds}$ (capped at 999). Announcer voice does not re-trigger if already active. |
| 9 | Weapon Pickup | Player has 80 HMG rounds and picks up Flame Shot badge | Different weapon pickup | Current HMG is replaced. Active weapon becomes Flame Shot with 30 fuel. Announcer plays *"FLAME SHOT!"*. HMG ammo is discarded. |
| 10 | Grenade Throw | Thrown grenade lands in shallow corner between floor and vertical wall | Grenade bounces repeatedly in tight wedge | Restitution damping quickly reduces $|V_x|, |V_y| < 30\text{ px/s}$, settling grenade on floor until 1.25s fuse detonates. |
| 11 | Flame Shot Multi-Hit | Flame projectile passes through dense cluster of 5 enemies | Multiple enemies in overlapping radius | Each enemy independently tracks `damageImmunityTimer`. All 5 enemies take 1.5 HP damage every 6 frames without cancelling projectile. |
| 12 | POW Life Cycle | Player shoots POW rope while camera is scrolling right | POW freed near left screen edge | `ESCAPING` state calculates distance to left screen edge ($X < \text{CameraLeft} - 32$). POW exits stage immediately and triggers `SAVED` tally. |

---

## 8. Verification & Integration Directives

1. **Unit Testing Protocol (`vitest`)**:
   - `test/unit/aiming_vectors.test.ts`: Verify 8-way aim vector normalization and ground vs air constraint.
   - `test/unit/player_physics.test.ts`: Validate jump impulse, gravity integration, jump release velocity cut, and crouch AABB dimensions.
   - `test/unit/melee_decision.test.ts`: Test proximity distance check ($\le 38\text{px}$), facing orientation filter, and melee vulnerability rejection.
   - `test/unit/weapon_fallback.test.ts`: Test HMG countdown from 200 to 0, zero-ammo fallback to Handgun, and badge pickup ammo stacking.
   - `test/unit/pow_state_machine.test.ts`: Verify 6-state progression, item drop instantiation, and score bonus accumulation.
2. **Deterministic Simulation Guarantee**:
   All formulas utilize pure numeric primitives and contain zero references to `window`, `document`, or DOM elements, ensuring 100% compliance with R5 headless verification.
