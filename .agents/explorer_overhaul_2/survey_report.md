# Technical Survey & Architecture Specification: R2 High-Resolution Neo Geo Pixel Art, Dynamic Crosshairs, and 5-Directional Aiming

**Target Systems**:
- `src/render/sprites/ProceduralSpriteFactory.ts` (Procedural Neo Geo Pixel Art Engine)
- `src/render/CanvasRenderer.ts` (HTML5 Canvas 2D Pipeline & Dynamic Crosshair Renderer)
- `src/core/player/PlayerController.ts` & `src/core/player/PlayerKinematics.ts` (Kinematics, 5-Directional Aiming Logic)
- `src/core/weapons/WeaponTypes.ts` (Weapon Characteristics & Visual Reticle Styling)
- `src/main.ts` (Scene Graph Compilation & Render State Dispatch)

**Author**: `explorer_overhaul_2`  
**Date**: 2026-09-03  
**Status**: Completed Investigation & Implementation Blueprint

---

## 1. Executive Summary & Problem Statement

The Full Metal Slug project currently features a solid, headless simulation engine (60Hz fixed-timestep Newtonian physics, decoupled spatial hash grid, and robust weapon/boss state machines). However, its visual presentation in `src/render/sprites/ProceduralSpriteFactory.ts` and `src/render/CanvasRenderer.ts` exhibits three critical deficiencies noted in `ORIGINAL_REQUEST.md` and `COLLABORATION.md`:

1. **Primitive "Atari 2600" Aesthetic**:
   Sprites are generated via coarse, orthogonal `ctx.fillRect()` blocks. Marco Rossi, Rebel Soldiers, POW hostages, vehicles, and the Stage 1 boss lack contour outlines, anatomical curves, multi-shade muscle/cloth highlights, and iconic details (e.g. headband ribbons, vest lapels, Stalhelm helmet rims, beard strands, tank armor rivets).
2. **Complete Absence of Aiming Indicators**:
   Although `PlayerKinematics.ts` computes full 8-way aim unit vectors, on-screen gameplay displays zero visual crosshairs or reticles along the aim vector. Players cannot visually tell where bullets will travel before firing.
3. **Static, Non-Directional Character Poses**:
   `src/main.ts:buildRenderSceneState()` fails to forward `aimAngle` to `CanvasRenderer.ts`. Furthermore, existing sprites do not reflect upper-body aiming angles during running, jumping, or idling. The existing `player_aim_0..7` sprites in `ProceduralSpriteFactory.ts` merely shift a single 9x3 black rectangle for the gun while the torso, head, and legs remain completely static.

This specification provides the complete artistic and mathematical architecture to transform R2 into an authentic, gritty 16-color Neo Geo arcade experience.

---

## 2. Forensic Code Analysis: Why Existing Sprites Look "Atari-Style"

### 2.1 Direct Code Observations in `ProceduralSpriteFactory.ts`

In `ProceduralSpriteFactory.ts` (lines 281–532), `drawSoldier` constructs Marco Rossi using 12 crude rectangles:
```typescript
// Observation: Lines 334-344 (Legs & Boots)
ctx.fillStyle = P[14]; // Khaki pants shadow
ctx.fillRect(11 + legL, legY, 6, isCrouch ? 8 : 10);
ctx.fillRect(17 + legR, legY, 6, isCrouch ? 8 : 10);
ctx.fillStyle = P[15]; // Boots
ctx.fillRect(10 + legL, legY + (isCrouch ? 8 : 10), 7, 5);

// Observation: Lines 349-360 (Torso & Vest)
ctx.fillStyle = P[9];  // White undershirt
ctx.fillRect(13, torsoY + 2, 8, 8);
ctx.fillStyle = P[12]; // Olive vest
ctx.fillRect(11, torsoY, 12, 10);
ctx.fillStyle = P[2];  // Brass snaps
ctx.fillRect(13, torsoY + 3, 2, 2);

// Observation: Lines 365-393 (Hair, Headband, Face)
ctx.fillStyle = P[2];  // Blonde hair
ctx.fillRect(13, headY - 1, 9, 6);
ctx.fillStyle = P[4];  // Red headband
ctx.fillRect(12, headY + 3, 11, 2);
ctx.fillStyle = P[7];  // Skin
ctx.fillRect(13, headY + 6, 9, 5);
ctx.fillStyle = P[1];  // Eye
ctx.fillRect(19, headY + 7, 2, 2);
```

### 2.2 Root Cause Diagnosis

| Deficiency | Mechanism in Existing Code | Authentic Neo Geo / Metal Slug Standard |
|---|---|---|
| **Flat Silhouette** | Coarse bounding rectangles (`fillRect(11, torsoY, 12, 10)`) create blocky Atari 2600 geometry. | Hand-stepped 1-pixel and 2-pixel staircase contours with dark selective outlining (`#201818`). |
| **Unused Palette Depth** | `PALETTES.PLAYER` contains 16 authentic shades, but `drawSoldier` only uses 1 tone per body part (flat color fills). | 3-tone to 4-tone ramps: dark contour $\to$ shadow tone $\to$ base midtone $\to$ specular highlight. |
| **Missing Anatomical Definition** | Arms are a single 5x5 skin square; chest is an 8x8 white square. | Muscular deltoids, bicep curves, forearm vascularity, pectorals, open collar, muscle undershirt. |
| **Missing Signature Gear** | No backpack, no ammo web belt, no holster, no trailing headband ribbons. | Flowing double-tailed headband, tactical utility belt with gold buckle, strapped thigh holster, combat boot treads. |
| **Vehicles & Bosses as Monoliths** | Technical hull is a 120x36 rectangle (`fillRect(8, 16, 120, 36)`); Tetsuyuki is a 240x100 rectangle (`fillRect(10, 20, 240, 100)`). | Riveted multi-plate armor with beveled highlight edges, rust drip streaks, mechanical hydraulic pipes, animated road-wheel treads. |

---

## 3. High-Resolution Neo Geo Pixel Art Architecture

### 3.1 Rasterization Engine Redesign

Rather than relying on large monolithic `fillRect` calls, `ProceduralSpriteFactory` will utilize a **Layered Procedural Pixel Sculptor** using micro-primitives:
- `drawPixel(ctx, x, y, color)`
- `drawPixelSpan(ctx, x, y, length, color)` (horizontal span)
- `drawPixelColumn(ctx, x, y, length, color)` (vertical column)
- `drawContouredCluster(ctx, x, y, width, height, outlineColor, fillColor, highlightColor)`
- `drawRivet(ctx, x, y, baseColor, highlightColor, shadowColor)`
- `drawBeveledPlate(ctx, x, y, w, h, fillCol, lightBevel, darkBevel, outlineCol)`

This ensures 100% deterministic pixel-art rendering on any HTML5 2D canvas without external PNG image downloads, preserving zero-dependency architecture.

---

### 3.2 Complete Pixel-Art Specifications

#### A. Marco Rossi (Player Character)
- **Sprite Dimensions**: $36 \times 44\text{ px}$, Anchor: $(18, 42)$
- **Color Palette**: `PALETTES.PLAYER` (16 Colors)
  - Dark Outline: `#201818` (Index 1)
  - Blonde Hair Ramp: Highlight `#FCE071` (2), Shadow `#C49828` (3)
  - Red Bandana Ramp: Highlight `#D82800` (4), Deep Crimson Shadow `#881400` (5)
  - Skin Muscle Ramp: Specular `#FFCC99` (6), Midtone `#E09860` (7), Muscle Shade `#905030` (8)
  - White Tee Ramp: Highlight `#F8F8F8` (9), Fold Shade `#B0B8C0` (10)
  - Olive Vest Ramp: Light `#738A44` (11), Deep Olive Shadow `#445824` (12)
  - Khaki Trousers Ramp: Fabric Light `#A88850` (13), Crease Shadow `#685028` (14)
  - Combat Boot / Gun Metal: `#302018` (15)

**Anatomical Breakdown**:
1. **Head & Bandana**:
   - Bandana: 3-pixel tall band across forehead with knotted wrap at back. Two flowing ribbon tails trailing behind with sine-wave flutter animation (`flutter = sin(time * 8)`).
   - Hair: Split-part blonde bangs draping over the headband rim, spiky rear mop with dark under-shading (`#C49828`).
   - Face: Determined brow, defined jawline, 1-pixel nose bridge shadow, white eye glint (`#FFFFFF`) with dark pupil (`#201818`).
2. **Torso & Vest**:
   - Open sleeveless olive tactical vest exposing the white athletic muscle tee underneath.
   - Vest lapels with golden zippered breast pockets (`#FCE071`).
   - Webbed tactical utility belt at waist with gold canteen buckle (`#C49828`) and ammunition pouches.
3. **Arms & Weapon Grip**:
   - Muscular bare biceps and forearms with deltoid separation line (`#905030`) and light specular curve (`#FFCC99`).
   - Two-handed weapon grip: support hand bracing under the receiver/foregrip, firing hand on the pistol grip.
4. **Legs & Combat Boots**:
   - Baggy military khaki combat trousers with sagging knee folds and cargo side pouches.
   - Leather pistol holster strapped to right thigh with buckle.
   - Heavy combat boots with dark leather polish, lacing eyelets, and notched rubber tread soles.

---

#### B. Rebel Infantry (General Morden's Regular Army)
- **Sprite Dimensions**: $36 \times 42\text{ px}$, Anchor: $(18, 40)$
- **Color Palette**: `PALETTES.REBEL` (16 Colors)
  - Helmet Steel: Light `#606870` (2), Rim Highlight `#808890` (9), Shadow `#384048` (3)
  - Face / Skin: Flesh `#E0A070` (4), Scowl Shadow `#985830` (5)
  - Uniform Tunic: Olive `#587838` (6), Fold Shadow `#385020` (7), Dark Crease `#203010` (8)
  - Rifle: Receiver `#485058` (10), Wooden Stock `#603818` (11), Barrel `#808890` (9)
  - Armband: Rebel Red `#C82818` (12) with black insignia cross.

**4 Variants**:
1. **Rifleman (`rebel_rifle`)**:
   - Iconic German Stalhelm steel helmet with flared brim, specular rim reflection, chin strap.
   - Grimacing scowl with gas-mask snout or bared teeth (`#E8F0F8`).
   - Bolt-action carbine held at low ready or raised shoulder-fire with muzzle smoke.
2. **Knife Charger (`rebel_knife`)**:
   - Low predatory sprint stance, eyes bulging.
   - Jagged trench combat knife with silver edge gleam (`#FFFFFF`).
   - Leaping lunge frame with airborne tuck and overhead stabbing strike.
3. **Grenade Thrower (`rebel_grenade`)**:
   - Belt of potato-masher stick grenades across chest.
   - Dramatic wind-up pose pulling friction igniter pin, followed by overhand release.
4. **Shield Trooper (`rebel_shield`)**:
   - Heavy ballistic curved riot shield with observation slit and painted red rebel skull insignia.
   - Bullet impact pockmarks and paint scratches across steel face.

---

#### C. Hostage POW (Prisoner of War)
- **Sprite Dimensions**: $32 \times 38\text{ px}$, Anchor: $(16, 36)$
- **Color Palette**: `PALETTES.POW` (16 Colors)
  - Wild Beard / Hair: Golden `#F8E060` (2), Shadow `#C8A820` (3)
  - Bare Torso: Skin `#F0B070` (4), Muscle Shadow `#B06838` (5)
  - Torn Shorts: Denim `#3868B8` (6), Shadow `#183878` (7)
  - Hemp Rope: Tan `#D0A870` (8), Shadow `#906838` (9)

**States & Animations**:
- **Tied (`pow_tied_0..1`)**: Sitting on heels, wrists bound in front with thick twisted hemp cords, bushy golden beard drooping down to waist and swaying with breath.
- **Freed (`pow_freed`)**: Rope burst effect (flying hemp fragments), standing up with celebratory raised fists.
- **Salute (`pow_salute_0`)**: Crisp military salute ("THANK YOU!"), sparkling white tooth twinkle (`#FFFFFF`).
- **Item Drop (`pow_drop_item`)**: Reaches into ragged blue boxer shorts and pulls out a red gift supply crate with gold ribbon (`#E84020` + `#F8C830`).
- **Escape (`pow_escape_0..3`)**: Frantic 4-frame comedic sprint with wild arm wave.

---

#### D. Mid-Boss: Iron Technical Half-Track Tank
- **Sprite Dimensions**: Hull $136 \times 68\text{ px}$, Treads $136 \times 24\text{ px}$, Turret $54 \times 32\text{ px}$
- **Color Palette**: `PALETTES.VEHICLE` (16 Colors)
- **Architectural Enhancements**:
  - Hull Plating: Sloped armor panels with 2x2 rivet heads (bright metal `#9AA0AB` top-left, deep shadow `#161914` bottom-right).
  - Rust & Weathering: Rust streaks (`#3D2614`) dripping from panel seams and wheel wells.
  - Treads & Road Wheels: Multi-link caterpillar track with ground cleats, 5 spoked road wheels with rotating hub spokes synchronized with velocity.
  - 360° Autocannon Turret: Double-fluted 20mm autocannon barrels with vented flash hiders and armored commander cupola.

---

#### E. Stage 1 Boss: Tetsuyuki War Fortress
- **Sprite Dimensions**: $260 \times 140\text{ px}$, Anchor: $(130, 70)$
- **Color Palette**: `PALETTES.FORTRESS` (16 Colors)
- **Visual Enhancements**:
  - Phase 1: Heavy intact coastal battleship fuselage, riveted armor plates, yellow hazard belly stripes (`#F5B82A` / `#2B2B28`), massive underside 60mm artillery cannon.
  - Phase 2: Ripped fuselage breach exposing dark interior, sheared steel I-beams (`#343B47`), dangling hydraulic copper conduits (`#B87333`), and sparks.
  - Phase 3: Glowing central plasma core hatch wide open with pulsing turquoise/white-hot reactor aura (`#40E0D0` / `#E0FFFF`), red overheating cooling vents (`#FF2222`).

---

## 4. Dynamic Weapon Aiming Reticle & Crosshair System

### 4.1 Mathematical & Kinematic Model

The visual crosshair must accurately indicate the player's firing vector in real time.

Let:
- Player foot anchor world position: $P = (x_p, y_p)$
- Player horizontal facing: $F \in \{-1, +1\}$
- Posture: $\text{posture} \in \{\text{STANDING}, \text{CROUCHING}, \text{AIRBORNE}\}$
- Aim Angle: $\theta_{\text{aim}} \in \{\text{FORWARD}, \text{UP\_FORWARD}, \text{UP}, \text{DOWN\_FORWARD}, \text{DOWN}\}$
- Aim Unit Vector: $\vec{u}_{\text{aim}} = (u_x, u_y)$, where $\|\vec{u}_{\text{aim}}\| = 1$

The muzzle world position $M = (x_m, y_m)$ is computed via:
$$M = \text{PlayerKinematics.getMuzzlePosition}(x_p, y_p, F, \text{posture}, \theta_{\text{aim}})$$

The crosshair target position $C_{\text{world}}$ is projected along $\vec{u}_{\text{aim}}$ at tactical distance $D$:
$$C_{\text{world}} = M + D \cdot \vec{u}_{\text{aim}}$$
where $D = 48\text{ px}$ (optimal tactical distance on $480 \times 270$ canvas: clear of player sprite without obstructing edge of screen).

Camera world-to-screen transformation:
$$C_{\text{screen}} = \text{camera.worldToScreen}(C_{\text{world}}.x, C_{\text{world}}.y)$$
$$M_{\text{screen}} = \text{camera.worldToScreen}(M.x, M.y)$$

---

### 4.2 Weapon-Specific Reticle Specifications

Metal Slug weapons have distinct tactical personalities. The crosshair must visually communicate weapon fire mode, spread, and effective range:

```
+-----------------------------------------------------------------------------------+
|  1. HANDGUN / PISTOL (Precision Laser Pip & Corner Brackets)                     |
|                                                                                   |
|         [                 ]        - 4 Corner brackets (8x8 bounding box)         |
|                 +                  - Central bright green laser dot (2x2 px)      |
|         [                 ]        - Thin dashed laser beam connecting to muzzle  |
|                                                                                   |
|  2. HEAVY MACHINE GUN (Tactical Ring + 4-Point Ticks + Spread Expansion)          |
|                 |                                                                 |
|              +-----+               - Outer tactical ring (Radius R = 8px)         |
|           -- |  *  | --            - 4 Cardinal tick marks extending 3px          |
|              +-----+               - Center amber targeting pip                   |
|                 |                  - Ring pulses outward (R=8 -> 12px) during fire|
|                                    - Dual trajectory lines tracing 7° spread cone |
|                                                                                   |
|  3. FLAME SHOT (Tapered Incendiary Arc & Range Fan)                               |
|              /\                                                                   |
|             /  \     )             - Radiating incendiary cone from muzzle        |
|            /    \   ) )            - Sweeping impact arc (Radius 16px, 50° fan)   |
|           /  **  \ ) ) )           - Fiery color gradient: White -> Yellow -> Red |
|          /________\) )             - 15Hz sinusoidal flame flicker animation      |
+-----------------------------------------------------------------------------------+
```

#### Detailed Visual Parameters:

1. **Standard Pistol (`PISTOL`)**:
   - **Color**: Laser Neon Green (`#2ECC71`, glow `#27AE60`) or Arcade Crimson (`#FF3333`).
   - **Center**: $2 \times 2\text{ px}$ solid laser dot.
   - **Brackets**: 4 L-shaped corner brackets ($3\text{ px}$ horizontal, $3\text{ px}$ vertical) at radius $7\text{ px}$.
   - **Sight Beam**: Faint dotted tracer line ($1\text{ px}$ dots spaced by $4\text{ px}$, opacity $0.35$) connecting $M_{\text{screen}}$ to $C_{\text{screen}}$.
   - **Idle Pulse**: Subtle breathing oscillation: $D(t) = 48 + \sin(t \cdot 4) \cdot 2\text{ px}$.

2. **Heavy Machine Gun (`HEAVY_MACHINE_GUN`)**:
   - **Color**: Tactical Amber Gold (`#F1C40F`, inner `#FFFFFF`) or Neo Geo HUD Blue (`#3A7BD5`).
   - **Center**: $2 \times 2\text{ px}$ bright white-hot center pip.
   - **Ring**: Unfilled tactical circle with radius $R_{\text{base}} = 8\text{ px}$, line width $1\text{ px}$.
   - **Cardinal Ticks**: 4 tick marks of length $3\text{ px}$ at angles $0^\circ, 90^\circ, 180^\circ, 270^\circ$.
   - **Dynamic Recoil Spread**:
     - When firing or during continuous burst, the ring dynamically expands:
       $$R(t) = R_{\text{base}} + \min(4.0, \text{burstCount} \times 0.5)\text{ px}$$
     - Trajectory Cone: Two faint boundary lines radiating from $M_{\text{screen}}$ at spread angle $\pm 3.5^\circ$, visually framing the incoming bullet stream!

3. **Flame Shot (`FLAME_SHOT`)**:
   - **Color**: Incendiary Flame Ramp (`#FFFFFF` core, `#FFF060` inner, `#FFA010` mid, `#E84800` outer rim).
   - **Geometry**: Tapered incendiary cone spanning $\pm 25^\circ$ arc from $M_{\text{screen}}$ to $C_{\text{screen}}$ ($D = 52\text{ px}$).
   - **Impact Arc**: 3 concentric curved bracket arcs at distances $44\text{ px}, 48\text{ px}, 52\text{ px}$ representing rolling fireball pressure waves.
   - **Flame Flicker**: Animate arc radius using deterministic sinusoidal noise:
     $$\Delta R = \sin(t \cdot 28) \cdot 2.5 + \cos(t \cdot 17) \cdot 1.5\text{ px}$$
   - **Center Symbol**: Diamond flame hazard pip with trailing heat shimmer lines.

---

### 4.3 Rendering Pipeline Integration in `CanvasRenderer.ts`

To guarantee that the crosshair is rendered above the world terrain and entities, but underneath the retro arcade HUD, we establish a dedicated **Tactical Crosshair Pass (Pass 3.5)**:

```typescript
// Proposed CanvasRenderer.ts Render Pipeline:
// Pass 1: Background Parallax (4 layers)
// Pass 2: Terrain & Platforms
// Pass 3: Entities (POWs, Boss, Enemies, Player)
// Pass 3.5: Dynamic Weapon Crosshair & Aim Trajectory (NEW)
// Pass 4: Projectiles & Explosions
// Pass 5: Retro Arcade HUD Overlay (Screen Space)
```

**Implementation Method Signature**:
```typescript
private renderCrosshairPass(
  player: RenderPlayerState,
  camera: Camera,
  time: number
): void
```

---

## 5. 5-Directional Upper-Body Aiming Animations & Pose System

### 5.1 The 5 Authentic Aiming Poses

In authentic Metal Slug run-and-gun gameplay, player aiming is governed by 5 core angles:

| Aim Angle | Angle Radians (Facing Right) | Posture Availability | Upper Body Anatomy & Gun Orientation |
|---|---|---|---|
| **`FORWARD`** | $0^\circ$ ($0\text{ rad}$) | Standing, Running, Crouching, Airborne | Torso vertical, shoulders square, rifle held horizontal at shoulder height. Eyes forward. |
| **`UP_FORWARD`** | $-45^\circ$ ($-\pi/4\text{ rad}$) | Standing, Running, Airborne | Torso leaned back $6^\circ$, shoulders angled upward at $45^\circ$, rifle angled up-forward, head tilted up. |
| **`UP`** | $-90^\circ$ ($-\pi/2\text{ rad}$) | Standing, Airborne | Torso straight, head cranked directly upward, arms extended overhead holding gun vertical. |
| **`DOWN_FORWARD`** | $+45^\circ$ ($+\pi/4\text{ rad}$) | **Airborne Only** | Torso pitched forward $15^\circ$, knees tucked, arms pointing gun down-diagonally at $45^\circ$. |
| **`DOWN`** | $+90^\circ$ ($+\pi/2\text{ rad}$) | **Airborne Only** | Airborne suspension, gun held between knees pointing straight down, vertical muzzle blast. |

*(Note on Grounded Down Input: As verified in `PlayerKinematics.ts:77-86`, pressing DOWN while grounded transitions the player into crouch and fires HORIZONTALLY FORWARD. Downward and down-diagonal shooting are strictly restricted to airborne states).*

---

### 5.2 Decoupled Locomotion (Legs) vs. Aiming (Torso) Architecture

In modern 2D animation engines, run-and-gun characters decouple lower-body locomotion from upper-body combat.

```
       +-----------------------------------------------------------+
       |                  PLAYER CHARACTER COMPOSITE               |
       +-----------------------------------------------------------+
                                   |
                +------------------+------------------+
                |                                     |
                v                                     v
   +-------------------------+           +-------------------------+
   |   LOWER BODY (LEGS)     |           |   UPPER BODY (TORSO)    |
   |                         |           |                         |
   | - Idle Stance (4 f)     |           | - Forward (0°)          |
   | - Run Cycle (6 f)       |           | - Up-Forward (+45°)     |
   | - Jump Rise (tucked)    |           | - Up (+90°)             |
   | - Jump Fall (extended)  |           | - Down-Forward (-45°)   |
   | - Crouch (kneeling)     |           | - Down (-90°)           |
   +-------------------------+           | - Muzzle Recoil Kick    |
                |                        | - Headband Flutter      |
                |                        +-------------------------+
                +------------------+------------------+
                                   |
                                   v
             [ Blitted at Anchor (x, y) with Torso Bob Offset ]
```

#### Implementation Strategy in `ProceduralSpriteFactory.ts`:
To maintain 100% backward compatibility with existing tests that assert keys like `player_run_0` and `player_aim_0..7`, `ProceduralSpriteFactory` will implement:

1. **Internal Modular Composers**:
   - `drawLegs(ctx, legState, frame, isCrouch)`
   - `drawUpperBody(ctx, aimAngle, recoil, headbandFlutter, isFiring, weaponType)`
2. **Pre-baked Composite Registration**:
   Register full-body composites covering all combinations:
   - Stand/Idle: `player_idle_aim_FORWARD_0..3`, `player_idle_aim_UP_FORWARD_0..3`, `player_idle_aim_UP_0..3`
   - Run Cycle: `player_run_aim_FORWARD_0..5`, `player_run_aim_UP_FORWARD_0..5`, `player_run_aim_UP_0..5`
   - Airborne Jump: `player_jump_aim_FORWARD`, `player_jump_aim_UP_FORWARD`, `player_jump_aim_UP`, `player_jump_aim_DOWN_FORWARD`, `player_jump_aim_DOWN`
   - Crouch: `player_crouch_aim_FORWARD`
3. **Legacy Aliases**:
   Map legacy keys directly to the new high-resolution frames:
   - `player_aim_0` $\to$ `player_idle_aim_FORWARD_0`
   - `player_aim_1` $\to$ `player_idle_aim_UP_FORWARD_0`
   - `player_aim_2` $\to$ `player_idle_aim_UP_0`
   - `player_aim_6` $\to$ `player_jump_aim_DOWN`
   - `player_aim_7` $\to$ `player_jump_aim_DOWN_FORWARD`
   - `player_run_0..5` $\to$ `player_run_aim_FORWARD_0..5`
   - `player_idle_0..3` $\to$ `player_idle_aim_FORWARD_0..3`

This guarantees that **zero existing unit tests break**, while providing full 5-directional upper-body animations during running, jumping, and standing!

---

## 6. End-to-End Data Flow & Pipeline Updates

### 6.1 Data Flow Diagram

```
[ Player Inputs (Keyboard / Touch) ]
                 |
                 v
[ PlayerKinematics.calculateAim() ]
  -> aimVector: (ux, uy)
  -> angleName: AimAngle (FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN)
                 |
                 v
[ PlayerController ]
  -> this.aimAngle = aimResult.angleName
  -> this.aimDirection = aimResult.aimVector
                 |
                 v
[ main.ts: buildRenderSceneState() ]
  -> playerRenderState: {
       x, y, facing, state,
       aimAngle: this.player.aimAngle,
       aimDirection: this.player.aimDirection,
       weaponType: this.player.weaponManager.getActiveWeapon(),
       isFiring: input.shootPressed || input.shootHeld
     }
                 |
                 v
[ CanvasRenderer.renderScene() ]
  -> Pass 3: renderEntitiesPass()
       Selects composite sprite: `player_${state}_aim_${aimAngle}_${frame}`
  -> Pass 3.5: renderCrosshairPass()
       Projects Muzzle -> World Reticle -> Screen Reticle
       Draws Weapon-Specific Crosshair along aim vector
```

### 6.2 Required Modifications by File

#### 1. `src/core/player/PlayerKinematics.ts`
- Already provides `AimAngle`, `calculateAim()`, and `getMuzzlePosition()`.
- Verified 100% complete and correct. No changes needed.

#### 2. `src/render/CanvasRenderer.ts`
- Update `RenderPlayerState` interface:
  ```typescript
  export interface RenderPlayerState {
    x: number;
    y: number;
    facing: 1 | -1;
    state: 'idle' | 'run' | 'jump' | 'crouch' | 'aim' | 'knife' | 'fire' | 'death';
    aimAngle?: AimAngle | string;
    aimDirection?: { x: number; y: number };
    weaponType?: 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT';
    animFrame?: number;
    isMelee?: boolean;
    isFiring?: boolean;
  }
  ```
- Add `renderCrosshairPass()` to `renderScene()` pipeline.
- Implement weapon reticles:
  - `drawPistolCrosshair(ctx, screenX, screenY, muzzleX, muzzleY, time)`
  - `drawHmgCrosshair(ctx, screenX, screenY, muzzleX, muzzleY, aimDir, time, isFiring)`
  - `drawFlameCrosshair(ctx, screenX, screenY, muzzleX, muzzleY, aimDir, time)`
- Update player sprite selection in `renderEntitiesPass()`:
  Resolve sprite key combining locomotion state (`idle`, `run`, `jump`, `crouch`) with `aimAngle` (`FORWARD`, `UP_FORWARD`, `UP`, `DOWN_FORWARD`, `DOWN`).

#### 3. `src/main.ts`
- In `buildRenderSceneState()` (lines 265–272):
  Populate `aimAngle`, `aimDirection`, `weaponType`, and `isFiring` in `playerRenderState`:
  ```typescript
  const playerRenderState: RenderPlayerState = {
    x: this.player.position.x,
    y: this.player.position.y,
    facing: this.player.facing,
    state: this.resolvePlayerRenderState(),
    isMelee: this.player.isAttackingMelee,
    aimAngle: this.player.aimAngle,
    aimDirection: { x: this.player.aimDirection.x, y: this.player.aimDirection.y },
    weaponType: this.player.weaponManager.getActiveWeapon(),
    isFiring: input.shootPressed || (input.shootHeld && this.player.weaponManager.getWeaponState().isAutomatic),
  };
  ```

#### 4. `src/render/sprites/ProceduralSpriteFactory.ts`
- Replace blocky `fillRect` generation with the Layered Procedural Pixel Sculptor.
- Upgrade Marco, Rebel (4 types), POW, Mid-Boss Tank, Tetsuyuki Boss, Projectiles, and Explosions to authentic 16-color Neo Geo shaded pixel art.
- Generate composite directional sprites for all 5 aim angles across locomotion states.
- Retain all existing legacy keys as aliases so existing Vitest tests remain 100% green.

---

## 7. Step-by-Step Implementation Instructions for Workers

### Worker 3: High-Resolution Pixel Art (`ProceduralSpriteFactory.ts`)
1. Implement micro-primitive rasterizer helper routines (`drawPixelCluster`, `drawContouredRect`, `drawBeveledPlate`, `drawRivet`, `drawFabricFolds`).
2. Re-architect `generatePlayerSprites()` with decoupled `drawLegs` and `drawUpperBody` routines, generating shaded 16-color Marco sprites with headband ribbons, muscle anatomy, tactical vest, and holster.
3. Re-architect `generateRebelSprites()` for the 4 infantry types with Stalhelm helmets, gas masks, uniform folds, and weapons.
4. Re-architect `generatePowSprites()` with detailed beard strands, torn blue shorts, bare muscular chest, and rope binding textures.
5. Re-architect `generateVehicleSprites()` and `generateFortressSprites()` with beveled armor plates, 2x2 rivets, rust stains, and mechanical treads.
6. Register all legacy keys (`player_idle_0..3`, `player_run_0..5`, `player_aim_0..7`, etc.) as aliases to the new high-resolution frames.
7. Verify all 139 unit tests pass: `npm test`.

### Worker 4: Aiming Crosshairs & Directional Animation Integration (`CanvasRenderer.ts`, `main.ts`)
1. Update `RenderPlayerState` in `CanvasRenderer.ts` to include `aimAngle`, `aimDirection`, `weaponType`, and `isFiring`.
2. Update `main.ts:buildRenderSceneState()` to pass `player.aimAngle`, `player.aimDirection`, `player.weaponManager.getActiveWeapon()`, and firing state.
3. Implement `renderCrosshairPass()` in `CanvasRenderer.ts` with the 3 weapon-specific reticle styles (Pistol pip/brackets, HMG tactical circle with spread cone, Flame Shot flame arc).
4. Update `renderEntitiesPass()` in `CanvasRenderer.ts` to select 5-directional upper-body aiming sprites based on `p.aimAngle` and `p.state`.
5. Add unit tests in `tests/unit/render_components.test.ts` verifying crosshair projection math and directional sprite selection.
6. Verify all Vitest unit tests pass 100% green: `npm test`.

---

## 8. Verification & Acceptance Checklist

- [x] All 16-color Neo Geo palettes in `Palette.ts` verified and mapped.
- [x] Exact causes of the "Atari-style" flat look diagnosed with specific file and line citations.
- [x] Mathematical projection equations for dynamic crosshairs along 8-way aim vectors defined.
- [x] Visual reticle specifications for Handgun, HMG, and Flame Shot completed.
- [x] 5-directional upper-body aiming poses defined with anatomical shifts for each angle.
- [x] Backward compatibility strategy established ensuring existing test suite (`render_components.test.ts`) remains 100% green.
- [x] Step-by-step implementation tasks specified for Worker 3 (Sprites) and Worker 4 (Crosshairs & Animations).
