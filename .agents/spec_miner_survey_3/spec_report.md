# Metal Slug Web: Technical Specification Mining Report (R3, R4, R5)

**Author**: `spec_miner_survey_3`  
**Date**: 2026-09-03  
**Status**: Complete Specification  
**Target Architecture**: Decoupled TypeScript Simulation Engine (`src/core/`), Canvas 2D/WebGL Renderer (`src/render/`), Procedural Web Audio Synthesizer (`src/audio/`), Vitest & Playwright QA (`tests/`)

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R3 Infantry | Rebel Rifleman AI | 5-state AI cycle: Patrol, Alert, Aim, Shoot, Crouch Shoot with line-of-sight checks. | Player $(x, y)$, terrain collision, distance $< 240\text{px}$ | Bullet spawn $(v_x = 280\text{px/s})$, animation state change | Resets to Idle if player moves out of vision frustum | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 2 | R3 Infantry | Knife Charger AI | Aggressive melee sprint & leap attack triggered when player enters rush range. | Player $(x, y)$, distance $\in [45\text{px}, 180\text{px}]$ | Sprint velocity ($160\text{px/s}$), leap impulse ($v_y = -180\text{px/s}$), knife hitbox | Falls back to ground patrol if leap hits platform obstacle | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 3 | R3 Infantry | Grenade Thrower AI | Parabolic explosive projectile trajectory calculation to target player location. | Player $(x_p, y_p)$, standoff distance $120\text{px}-200\text{px}$ | Grenade entity with initial $(v_{0x}, v_{0y})$ | Clamps launch angle if player is too high or behind cover | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 4 | R3 Infantry | Shield Trooper AI | Frontal ballistic shield negating direct bullets; weak to flanking, melee, and rear hits. | Incoming damage vector $\vec{d}$, shield normal $\vec{n}$, player proximity | Bullet deflection sparks, shield bash knockback | Staggers for $500\text{ms}$ upon heavy explosion or rear melee | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 5 | R3 Mid-Boss | Iron Technical Vehicle | 3-phase armored vehicle with tread movement, 360° turret slew, and troop deployment. | Game world tick, player position, vehicle HP pool (400) | Autocannon bursts, mortar shells, spawned infantry adds | Halts movement if edge of screen/cliff reached | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 6 | R3 Mid-Boss | Vehicle Troop Spawn Hatch | Periodic opening of rear hatch deploying infantry reinforcements into arena. | Spawn timer ($8\text{s}-12\text{s}$), max concurrent adds cap (3) | Infantry entities placed behind vehicle | Suppresses spawn if active add count $\ge 3$ | COLLABORATION.md § 4 |
| 7 | R3 End-Boss | Tetsuyuki Fortress Phase 1 | Heavy artillery siege cannon and vertical homing rocket pod salvo. | Phase 1 active ($\text{HP} \in [976, 1500]$), firing timers | Heavy artillery shell ($80\text{px}$ blast), 3 homing micro-rockets | Cannon fire suspended if player in blind spot; rockets track | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 8 | R3 End-Boss | Tetsuyuki Fortress Phase 2 | Hull breach transition, exposed reactor core, sweeping gatling fire & laser beam. | Phase 2 active ($\text{HP} \in [451, 975]$), charge timers | Sweeping laser hitbox (floor hazard), falling debris | Interrupts laser sweep immediately on phase threshold cross | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 9 | R3 End-Boss | Tetsuyuki Fortress Phase 3 | Overheated emergency thrusters, destructible weak point ($1.5\times$ crit), multi-missiles. | Phase 3 active ($\text{HP} \in [1, 450]$), weak-point collision | Thruster flame shockwaves, 5-missile fan, steam particle vents | Non-weakpoint hits suffer $75\%$ armor damage reduction | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 10 | R3 End-Boss | Multi-Stage Chain Explosions | 4-stage sequential death sequence over $3.2\text{s}$ with camera shake and wreckage transformation. | $\text{HP} \le 0$, elapsed death timer | Local sparks $\to$ medium fireballs $\to$ core ring explosion $\to$ charred hulk | Boss entities set to non-interactive invulnerable during sequence | ORIGINAL_REQUEST.md § R3, COLLABORATION.md § 4 |
| 11 | R4 Graphics | Procedural Pixel Art Generator | OffscreenCanvas/ImageData pixel rasterization using 16-color Neo Geo indexed palettes. | Sprite definition matrix, color palette ID, frame index | Cached `ImageBitmap` / `HTMLCanvasElement` sprites | Fallbacks to solid colored placeholder rectangle on OOM | ORIGINAL_REQUEST.md § R4, COLLABORATION.md § 5 |
| 12 | R4 Graphics | Dynamic Explosion Dithering | Cellular automaton and radial distance noise for authentic retro fireballs. | Origin $(x_0, y_0)$, radius $r(t)$, random seed | Radial gradient pixel data with dithered edge sparks | Radius clamped to max $160\text{px}$ to prevent render bottleneck | COLLABORATION.md § 5 |
| 13 | R4 Graphics | 4-Layer Parallax Background | Multi-plane scrolling backgrounds (Sky, Distant Peaks, Ruins/Bunkers, Ground). | Camera scroll offset $X_c$, layer scroll factors $(0, 0.2, 0.5, 1.0)$ | Rendered composite background on canvas | Seamless modulo wrapping at tile boundaries | COLLABORATION.md § 5 |
| 14 | R4 Audio | Custom Oscillators & FM Synth | Web Audio nodes (`OscillatorNode`, `GainNode`, `WaveShaperNode`) for weapon sounds. | Audio event trigger, weapon type, parameter patch | Real-time PCM audio buffer played through master bus | Gracefully silent if `AudioContext` is suspended | ORIGINAL_REQUEST.md § R4, COLLABORATION.md § 5 |
| 15 | R4 Audio | Procedural Noise Generators | White, pink (Kellet filter), and brown noise generators for gunshots and explosions. | Duration, decay envelope, filter cutoff $f_c$, resonance $Q$ | Impact punch, blast rumble, shell casing clatter | Concurrency cap (max 32 active voices) prevents crackle | COLLABORATION.md § 5 |
| 16 | R4 Audio | Speech Formant Announcer | Formant bandpass filter bank modeling vocal tract for classic voice clips. | Phoneme sequence, glottal pulse train $f_0$, formant frequencies $(F_1 - F_4)$ | Announcer voice clips ("HEAVY MACHINE GUN!", "FLAME SHOT!", etc.) | Auto-unlocks `AudioContext` on first player user gesture | ORIGINAL_REQUEST.md § R4, COLLABORATION.md § 5 |
| 17 | R5 Testing | Headless Core Simulation Engine | Pure TypeScript in-memory game loop with deterministic fixed $\Delta t = 1/60\text{s}$. | Step tick, simulated input bitmask | World state snapshot (positions, velocities, HP, states) | Throws assertion errors on invariant violation | ORIGINAL_REQUEST.md § R5, COLLABORATION.md § 1 |
| 18 | R5 Testing | State Machine Unit Test Harness | Vitest suites verifying enemy/boss state transitions, health gates, damage formulas. | Unit test fixtures, mock clock, weapon fire events | Test pass/fail reports with code coverage | Fails if state transition diverges or deadlocks | ORIGINAL_REQUEST.md § R5, COLLABORATION.md § 7 |
| 19 | R5 Testing | Playwright 60fps Loop Validator | Browser-driven E2E test verifying frame rate stability ($\ge 58\text{fps}$) over 300 frames. | Headless Chromium browser, canvas DOM element | Frame time histograms, min/max/avg FPS metrics | Fails if dropped frames $> 5$ or avg FPS $< 58.0$ | COLLABORATION.md § 7 |
| 20 | R5 Testing | Zero Uncaught Error Sentry | Page error and console monitor capturing any unhandled exceptions or rejections. | Browser execution runtime logs | Clean error tally (target: 0 errors, 0 warnings) | Fails build if any fatal console error or audio crash occurs | ORIGINAL_REQUEST.md § Acceptance, COLLABORATION.md § 7 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Rebel Infantry AI | Player jumps over enemy while enemy is in mid-firing animation | Enemy finishes current shot in original direction, then enters turnaround state ($120\text{ms}$) before re-aiming at player. |
| 2 | Knife Charger AI | Player runs off edge/platform during knife charger's leap | Knife charger completes leap arc into empty air, lands on lower platform or ground level, suffers $500\text{ms}$ recovery stun. |
| 3 | Grenade Thrower AI | Player stands directly adjacent to Grenade Thrower ($< 30\text{px}$) | Thrower detects minimum safe distance violation, drops defensive smoke/stumble and steps backwards ($v_x = -70\text{px/s}$) rather than throwing self-damaging grenade. |
| 4 | Shield Trooper | High-DPS Flame Shot piercing stream hits frontal shield | Frontal shield blocks direct projectile impact, but fire stream's residual AOE puddle on floor behind shield deals ticking damage ($2\text{ HP/tick}$) to trooper's feet. |
| 5 | Mid-Boss Vehicle | Player jumps on top of Mid-Boss vehicle roof | Vehicle detects player presence above chassis; top hatch cannot spawn troops; turret rotates upward to shoot at $75^\circ$ angle; chassis applies slight rumble knockback. |
| 6 | Mid-Boss Vehicle | Rapid burst damage drops HP from 65% to 15% in a single frame | Health gate logic prevents skipping Phase 2; vehicle clamps HP at 20% (Phase 2 floor) for minimum $1.5\text{s}$ while initiating smoke transition before entering Phase 3. |
| 7 | Tetsuyuki Boss | Player destroys all homing missiles before they reach mid-screen | Boss missile controller clears active tracking slots; cooldown resets normally without crashing target array or hanging state. |
| 8 | Tetsuyuki Boss | Laser sweep charges while player is dead or respawning | Laser fires harmlessly across empty arena; sweep completes, and cooldown holds until player respawn invulnerability frames expire. |
| 9 | Procedural Pixel Art | Canvas context resized or high-DPI scaling changed on window resize | Sprite generator maintains fixed virtual pixel resolution ($320\times 224$), rendering to off-screen buffer with `imageSmoothingEnabled = false` for razor-sharp pixel aspect ratio. |
| 10 | Web Audio API | Game loads in modern browser before user interacts with window | `AudioContext` initializes in `suspended` state; sounds are queued or dropped gracefully without throwing `DOMException: The play() request was interrupted by a new load request`. Auto-resumes on first keypress/touch. |
| 11 | Web Audio Formants | 10 rapid explosions and sound effects fire simultaneously | Audio Voice Stealer prioritizes active channels: drops oldest low-priority bullet ricochets while preserving voice announcer and boss explosion channels. |
| 12 | Headless Vitest | Test executes 10,000 game ticks in 500ms without `window` or `document` | Core engine executes with zero DOM/Canvas dependencies; math vectors, collisions, and state machines compute identically to browser runtime. |
| 13 | Playwright E2E | Browser tab throttled or backgrounded during test run | Test runner forces active focus; delta time $\Delta t$ is capped at $\min(\Delta t, 0.05\text{s})$ inside game loop to prevent giant physics tunneling step ("spiral of death"). |

---

## 1. Detailed Specifications for R3: Enemies, Mid-Boss & Bosses

### 1.1 Core Entity Base Architecture
All combat entities in `src/core/entities/` adhere to the decoupled interface:

```typescript
export interface Vector2D {
  x: number;
  y: number;
}

export interface Hitbox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface DamageEvent {
  amount: number;
  sourceType: 'bullet' | 'flame' | 'grenade' | 'melee';
  origin: Vector2D;
  direction: Vector2D;
}

export interface EnemyEntity {
  id: string;
  type: 'rifleman' | 'charger' | 'thrower' | 'shield' | 'midboss' | 'tetsuyuki';
  position: Vector2D;
  velocity: Vector2D;
  facing: 'left' | 'right';
  hp: number;
  maxHp: number;
  hitboxes: Record<string, Hitbox>;
  currentState: string;
  stateTimer: number;
  isInvulnerable: boolean;
  isDead: boolean;
  tick(dt: number, context: WorldContext): void;
  takeDamage(event: DamageEvent): boolean;
}
```

---

### 1.2 Rebel Infantry Behaviors & State Machines

#### 1. Rebel Rifleman
- **Role**: Basic ranged infantry providing suppressive fire from mid-to-long distance.
- **Attributes**: HP = 1 (dies to single player bullet), Walk Speed = $60\text{ px/s}$, Vision Range = $240\text{ px}$, Fire Range = $200\text{ px}$, Fire Cooldown = $1200\text{ ms}$.
- **State Machine Transitions**:
  - `IDLE`: Waits for player detection. If $|x_p - x_e| \le 240\text{ px}$ and $\operatorname{sign}(x_p - x_e) == \text{facing}$, transition to `ALERT` ($200\text{ ms}$).
  - `PATROL`: Walks back and forth between patrol bounds $[x_{\min}, x_{\max}]$ at $v_x = 40\text{ px/s}$. Transitions to `ALERT` on player detection.
  - `ALERT`: Plays exclamation mark cue above helmet ($200\text{ ms}$). Faces player. Transitions to `AIM`.
  - `AIM`: Evaluates player vertical offset. If player is crouching or low, enters `CROUCH_AIM` ($250\text{ ms}$); else enters `STAND_AIM` ($250\text{ ms}$).
  - `FIRE`: Spawns bullet projectile:
    $$\vec{p}_{\text{bullet}} = \vec{p}_{\text{muzzle}}, \quad \vec{v}_{\text{bullet}} = (\text{facing} == \text{'right'} ? +280 : -280, 0)$$
    Plays muzzle flash and gunshot audio event. Transitions to `COOLDOWN`.
  - `COOLDOWN`: Waits $1200\text{ ms}$. If player closes distance to $< 50\text{ px}$, transitions to `FLEE` ($v_x = -90\text{ px/s}$ away from player for $800\text{ ms}$).
  - `DEATH`: Plays death animation based on damage type:
    - `bullet`: Flips backward with helmet flying off, lands on back ($400\text{ ms}$).
    - `flame`: Engulfed in fire, runs around flailing arms for $800\text{ ms}$, collapses into charred ashes.
    - `melee`: Sliced in half horizontally, blood spray effect ($300\text{ ms}$).

```
[PATROL / IDLE] --(Player in range <= 240px)--> [ALERT (200ms)]
       ^                                                |
       |                                                v
  [COOLDOWN] <--(Spawn Bullet)--- [FIRE] <--(250ms)-- [AIM]
       |
  (Player < 50px)
       v
    [FLEE]
```

#### 2. Knife Charger
- **Role**: High-threat close-quarters ambusher that charges with a combat knife.
- **Attributes**: HP = 2, Sprint Speed = $170\text{ px/s}$, Detection Range = $180\text{ px}$, Lunge Range = $65\text{ px}$, Knife Damage = 1 (lethal to player).
- **State Machine Transitions**:
  - `AMBUSH_IDLE`: Concealed behind trench or crate. Triggers when player $|x_p - x_e| \le 180\text{ px}$.
  - `SPRINT`: Screams and charges directly at player with knife raised:
    $$v_x = (\text{facing} == \text{'right'} ? +170 : -170)\text{ px/s}$$
  - `LEAP_LUNGE`: When $|x_p - x_e| \le 65\text{ px}$, launches into air:
    $$v_y = -190\text{ px/s}, \quad v_x = (\text{facing} == \text{'right'} ? +220 : -220)\text{ px/s}$$
  - `KNIFE_SLASH`: While airborne and within slashing frame ($120\text{ ms}-280\text{ ms}$ of jump), enables active melee hitbox ($24\times 18\text{ px}$) in front of knife.
  - `LAND_RECOVERY`: On ground touch, suffers $450\text{ ms}$ vulnerability delay before turning or attacking again.
  - `DEATH`: Immediate ragdoll collapse or decapitation if hit by player melee knife.

#### 3. Grenade Thrower
- **Role**: Artillery infantry who lobs bouncing grenades over obstacles.
- **Attributes**: HP = 2, Standoff Range = $130\text{ px}-220\text{ px}$, Lob Velocity = calculated dynamically, Throw Cooldown = $1800\text{ ms}$.
- **Trajectory Math Formula**:
  Given target player position $(x_p, y_p)$ and thrower launch origin $(x_0, y_0)$, with gravity $g = 550\text{ px/s}^2$ and desired time-of-flight $t_f = 0.85\text{ s}$:
  $$v_{0x} = \frac{x_p - x_0}{t_f}$$
  $$v_{0y} = \frac{y_p - y_0 - \frac{1}{2} g t_f^2}{t_f}$$
  Horizontal velocity is clamped to $|v_{0x}| \le 260\text{ px/s}$ and vertical velocity is clamped to $v_{0y} \in [-320, -180]\text{ px/s}$.
- **State Machine Transitions**:
  - `SEEK_STANDOFF`: Adjusts position so distance to player remains between $130\text{ px}$ and $200\text{ px}$.
  - `PULL_PIN`: Plays pin pull animation ($300\text{ ms}$).
  - `WINDUP`: Arm rears back ($200\text{ ms}$).
  - `THROW`: Instantiates Grenade entity with $(v_{0x}, v_{0y})$ calculated above. Grenade rotates at $\omega = 12\text{ rad/s}$.
  - `RELOAD_COOLDOWN`: Waits $1800\text{ ms}$. If player approaches closer than $60\text{ px}$, thrower hops backward $40\text{ px}$.

#### 4. Shield Trooper
- **Role**: Armored vanguard that blocks frontal projectile damage.
- **Attributes**: HP = 4 (behind shield), Shield Armor = Infinite against pistol/HMG from front, Shield Width = $14\text{ px}$, Shield Height = $36\text{ px}$, Advance Speed = $45\text{ px/s}$.
- **Directional Defense Logic**:
  When incoming damage event arrives with unit vector $\vec{d} = (d_x, d_y)$ from damage origin to shield:
  $$\text{Shield Normal: } \vec{n} = (\text{facing} == \text{'right'} ? -1 : 1, 0)$$
  $$\text{Impact Angle: } \cos \theta = \vec{d} \cdot \vec{n}$$
  - If $\cos \theta > \cos(60^\circ) = 0.5$ (incoming from front):
    - `bullet` (Pistol/HMG): Damage negated ($0\text{ HP}$). Triggers metallic spark particles and deflection audio ping (`metal_clang`).
    - `grenade` / `explosion`: Shield takes $50\%$ damage ($1\text{ HP}$ to trooper), knocks trooper backward $30\text{ px}$.
    - `flame`: Shield blocks direct bullet, but flame AOE ignites ground below feet dealing continuous damage.
  - If $\cos \theta \le 0.5$ (incoming from above, behind, or flanking):
    - Full damage dealt directly to trooper HP.
- **State Machine Transitions**:
  - `GUARD_ADVANCE`: Walks steadily toward player behind shield ($45\text{ px/s}$).
  - `SHIELD_BASH`: Triggers if player distance $\le 40\text{ px}$. Trooper thrusts shield forward ($120\text{ ms}$ windup, $150\text{ ms}$ active bash hitbox), knocking player back $80\text{ px}$ and dealing 1 damage.
  - `EXPOSED_THRUST`: Every $3.0\text{ s}$, lowers shield slightly to stab with bayonet or fire sidearm. Creates a $350\text{ ms}$ vulnerability window where frontal shield protection is lowered!
  - `STAGGER`: On taking explosive or rear melee hit, shield drops for $600\text{ ms}$.

---

### 1.3 Mid-Boss: "Iron Technical" Armored Vehicle
- **Dimensions**: Width $130\text{ px}$, Height $68\text{ px}$.
- **Health Pool**: 400 HP.
- **Components**:
  1. `Chassis`: Tracks, engine bay, suspension.
  2. `Turret`: Mounted on top at $(x + 40, y - 24)$, can rotate $360^\circ$ toward player.
  3. `Troop Hatch`: Located at rear $(x - 50, y - 10)$.

```
                      [Turret Cannon]
                      /
    +----------------o----+
    | [Hatch]     Chassis |
    +=====================+
       (O) (O) (O) (O) (O)  <- Treads
```

#### Movement & Suspension Formula
The chassis oscillates with engine vibration and terrain elevation:
$$y_{\text{chassis}}(t) = y_{\text{ground}} + A_{\text{idle}} \sin(\omega_{\text{engine}} t)$$
where $A_{\text{idle}} = 1.5\text{ px}$, $\omega_{\text{engine}} = 20\text{ rad/s}$.
When moving, tread rotation speed is linked directly to horizontal velocity:
$$\theta_{\text{tread}}(t) = \theta_{\text{tread}}(t - \Delta t) + \frac{v_x \Delta t}{R_{\text{wheel}}}$$

#### Turret Slew Logic
Turret angle $\theta$ aims towards player center $(x_p, y_p)$ with angular velocity limit $\omega_{\max} = 1.8\text{ rad/s}$ ($103^\circ/\text{s}$):
$$\theta_{\text{target}} = \operatorname{atan2}(y_p - y_{\text{turret}}, x_p - x_{\text{turret}})$$
$$\Delta \theta = \operatorname{normalize\_angle}(\theta_{\text{target}} - \theta_{\text{current}})$$
$$\theta_{\text{current}} \leftarrow \theta_{\text{current}} + \operatorname{clamp}(\Delta \theta, -\omega_{\max} \Delta t, \omega_{\max} \Delta t)$$

#### Health Gates & Phase Transitions
- **Phase 1: Heavy Patrol ($100\% \to 60\%$ HP; $400 \to 240$ HP)**:
  - Vehicle patrols ground at $v_x = \pm 45\text{ px/s}$ between arena markers $[x_1, x_2]$.
  - Every $3.5\text{ s}$, stops for $1.2\text{ s}$ and fires a 3-round burst from $20\text{ mm}$ autocannon (interval $150\text{ ms}$ between shots, bullet velocity $320\text{ px/s}$).
  - Hatch opens every $12\text{ s}$ to spawn 1 Rebel Rifleman + 1 Knife Charger. (Max 3 adds active).
- **Health Gate 1 (240 HP)**: When HP hits 240, locks damage for $1.0\text{ s}$. Vehicle brakes with screeched tread dust, engine emits black smoke puffs ($12\text{ particles/s}$).
- **Phase 2: Mortar & Reinforcements ($60\% \to 20\%$ HP; $240 \to 80$ HP)**:
  - Patrol speed increases to $v_x = \pm 70\text{ px/s}$.
  - Autocannon fires 5-round bursts.
  - Adds a high-angle Mortar Attack every $6.0\text{ s}$: fires mortar shell $(v_{0x} = (x_p - x_t)/1.2, v_{0y} = -380\text{ px/s})$. On floor impact, leaves a burning napalm patch for $2.5\text{ s}$.
  - Hatch spawns Shield Trooper or Grenade Thrower every $8\text{ s}$.
- **Health Gate 2 (80 HP)**: When HP hits 80, locks damage for $0.8\text{ s}$. Engine catches fire, red alert siren sounds.
- **Phase 3: Desperation Ramming ($20\% \to 0\%$ HP; $80 \to 0$ HP)**:
  - Vehicle revs engine for $1.0\text{ s}$ (loud diesel roar, exhaust backfire), then charges across the screen in a high-speed Ram Attack ($v_x = 220\text{ px/s}$) forcing player to jump over the vehicle.
  - Fires uncontrolled erratic cannon sprays while charging.
- **Destruction Sequence**:
  - HP reaches 0: Vehicle engine shudders and stops.
  - 4 consecutive staggered explosions along chassis at $t = 0\text{ ms}, 200\text{ ms}, 450\text{ ms}, 750\text{ ms}$.
  - Turret detaches and flies into air with smoke trail ($v_y = -220\text{ px/s}$, angular velocity $8\text{ rad/s}$).
  - Chassis remains as charred, burnt-out metal wreckage obstacle that player can jump over.

---

### 1.4 Stage 1 End-Boss: "Tetsuyuki War Fortress"

#### Background & Dimensions
Inspired by the iconic Mission 1 boss of Metal Slug (the giant crashed coastal bomber/fortress plane refitted by the Rebel Army).
- **Arena**: Coastal cliffside, width $640\text{ px}$, height $240\text{ px}$. Boss occupies the right half of the arena.
- **Dimensions**: Width $280\text{ px}$, Height $160\text{ px}$.
- **Total HP**: 1500 HP across 3 distinct mechanical phases.

```
       ===============================================
       \  [Dorsal Rocket Launcher Pod]               \
        \                                             \
   ======+=============================================+
   | [Laser/Gatling Core]           [Exhaust Meltdown] |
   |                                                   |
   |      [Underside Swivel Artillery Cannon]          |
   +---------------------------------------------------+
             (Cliffside Base / Foundation)
```

#### Phase 1: Heavy Artillery & Guided Rockets (100% -> 65% HP; 1500 -> 975 HP)
- **Attack 1: Heavy Artillery Cannon**:
  - Located on underside swivel mount.
  - Charge-up: Cannon barrel draws back, emitting glowing red particles for $1.0\text{ s}$ with a rising pitch charging tone ($150\text{ Hz} \to 600\text{ Hz}$).
  - Fire: Launches a massive $60\text{ mm}$ artillery shell horizontally ($v_x = -360\text{ px/s}$).
  - Impact: Explodes on contact with cliff floor or left wall, creating an $80\text{ px}$ diameter fiery explosion. Player must jump onto wooden scaffolding/platforms to avoid the blast radius.
- **Attack 2: Guided Rocket Salvo**:
  - Dorsal launcher opens top hatch.
  - Fires 3 homing micro-missiles sequentially ($200\text{ ms}$ interval).
  - **Homing Missile Physics Formula**:
    Missile has position $\vec{p}_m$, velocity $\vec{v}_m$ ($|\vec{v}_m| = 175\text{ px/s}$ constant), heading angle $\theta_m$.
    $$\text{Angle to player: } \theta_t = \operatorname{atan2}(y_p - y_m, x_p - x_m)$$
    $$\text{Steering rate: } \Delta \theta = \operatorname{clamp}(\operatorname{normalize\_angle}(\theta_t - \theta_m), -2.2 \Delta t, 2.2 \Delta t)$$
    $$\theta_m \leftarrow \theta_m + \Delta \theta$$
    $$\vec{v}_m = (175 \cos \theta_m, 175 \sin \theta_m)$$
  - Destructibility: Missiles have $\text{HP} = 1$. A single player bullet or knife hit detonates the missile in mid-air!

#### Phase 2: Hull Breach & High-Energy Laser Sweep (65% -> 30% HP; 975 -> 450 HP)
- **Transition Event**:
  - Heavy explosion shears off the outer wing and front armor plating.
  - The underside artillery cannon breaks off and tumbles down the cliff into the sea.
  - Alarm siren blares; inner machinery glows with electrical arcs.
- **Attack 1: Sweeping Gatling Rotary Gun**:
  - 6-barrel minigun deploys from forward hull breach.
  - Fires rapid-fire tracer rounds (10 rounds/sec) in a sweeping cone from $-50^\circ$ to $-15^\circ$ downward.
- **Attack 2: High-Energy Thermal Laser Sweep**:
  - Warning: A thin red collimated targeting laser paints the arena floor for $800\text{ ms}$.
  - Fire: Emits a thick high-energy laser beam ($20\text{ px}$ wide) that sweeps horizontally across the lower floor plane from right to left over $1.5\text{ s}$.
  - Hazard: Deals continuous damage ($1\text{ damage / } 100\text{ ms}$) to anything touching the floor. Player MUST time jump onto elevated ruins/platforms.
- **Attack 3: Falling Structural Debris**:
  - Overheated superstructure shakes, dropping steel girders and flaming debris from top of screen:
    $$x_{\text{debris}} = \text{random}(60, 480), \quad v_y = 320\text{ px/s}$$

#### Phase 3: Emergency Thruster Meltdown & Exposed Weak Point (30% -> 0% HP; 450 -> 0 HP)
- **Transition Event**:
  - Overheating reaches critical threshold. Steam exhaust blast shoots out of vents.
  - The central reactor cooling hatch blows off, revealing the **Reactor Core Weak Point** ($48\times 48\text{ px}$).
- **Vulnerability / Damage Multiplier Math**:
  - Hit to **Exposed Core**:
    $$\text{Damage} = \text{WeaponDamage} \times 1.5, \quad \text{Triggers bright white hit flash}$$
  - Hit to **Armored Superstructure**:
    $$\text{Damage} = \text{WeaponDamage} \times 0.25, \quad \text{Triggers metallic spark ricochet}$$
- **Attack 1: Thruster Meltdown Shockwave**:
  - Rear emergency jet thrusters fire pulsing bursts into the ground.
  - Generates rolling fiery shockwave rings that travel along the ground towards the left ($v_x = -180\text{ px/s}$).
- **Attack 2: Overloaded Rocket Barrage**:
  - Dorsal launcher fires 5 unguided rockets simultaneously in a 5-way fan spread:
    $$\theta \in [150^\circ, 165^\circ, 180^\circ, 195^\circ, 210^\circ]$$
  - Rockets travel in straight trajectories at high speed ($v = 240\text{ px/s}$).

#### Death Sequence: Multi-Stage Chain Explosions
Triggered when Boss $\text{HP} \le 0$:
1. **$t \in [0.0\text{ s}, 0.8\text{ s}]$ - Localized Sparks**:
   - Boss halts all attacks. Music stops; deep industrial groaning sound begins.
   - 10 small spark explosions ($r = 16\text{ px}$) detonate at random offsets across the fortress wings and hull.
2. **$t \in [0.8\text{ s}, 2.0\text{ s}]$ - Armor Tear Fireballs**:
   - Medium fireballs ($r = 40\text{ px}$) tear through plating every $120\text{ ms}$.
   - Screen shake initiates: camera offset $\Delta y = 6 \sin(50 t) e^{-0.5 t}\text{ px}$.
   - Metal debris chunks fly outward with smoke trails.
3. **$t \in [2.0\text{ s}, 3.2\text{ s}]$ - Core Reactor Detonation**:
   - Central reactor flashes blinding white ($150\text{ ms}$ screen flash).
   - Massive expanding shockwave ring ($r(t) = 150 \cdot (t - 2.0) / 1.2\text{ px}$).
   - Low-frequency bass explosion rumble ($30\text{ Hz} - 60\text{ Hz}$ sub-oscillator).
4. **$t \ge 3.2\text{ s}$ - Wreckage & Victory**:
   - Fortress collapses onto cliff edge as a smoking, charred skeleton.
   - Announcer voice triggers: *"MISSION COMPLETE!"*.
   - Victory fanfare plays; stage score tally begins.

---

## 2. Detailed Specifications for R4: Procedural Assets & Web Audio Engine

### 2.1 Procedural Pixel Art Generation Algorithms
To satisfy the requirement of zero external image dependencies, all visual assets are generated procedurally at game launch using HTML5 Canvas 2D / OffscreenCanvas rendering into cached sprite sheets.

#### 1. Neo Geo 16-Color Palette Tables
Authentic arcade aesthetics rely on calibrated 16-color indexed palettes:

```typescript
export const PALETTES = {
  // Marco / Player Palette
  PLAYER: [
    'transparent',
    '#201818', // 1: Dark outline
    '#FCE071', // 2: Blonde hair light
    '#C49828', // 3: Blonde hair shadow
    '#D82800', // 4: Headband red
    '#881400', // 5: Headband dark
    '#FFCC99', // 6: Skin highlight
    '#E09860', // 7: Skin midtone
    '#905030', // 8: Skin shadow
    '#F8F8F8', // 9: Shirt white
    '#B0B8C0', // 10: Shirt shade
    '#738A44', // 11: Olive vest
    '#445824', // 12: Olive vest shadow
    '#A88850', // 13: Khaki pants
    '#685028', // 14: Khaki pants shadow
    '#302018', // 15: Boot leather
  ],
  // Rebel Soldier Palette
  REBEL: [
    'transparent',
    '#181818', // 1: Outline
    '#606870', // 2: Helmet grey
    '#384048', // 3: Helmet shadow
    '#E0A070', // 4: Skin
    '#985830', // 5: Skin shadow
    '#587838', // 6: Uniform green
    '#385020', // 7: Uniform green shadow
    '#203010', // 8: Uniform dark crease
    '#808890', // 9: Metal buckle/rifle barrel
    '#485058', // 10: Rifle receiver
    '#603818', // 11: Rifle wooden stock
    '#C82818', // 12: Rebel armband red
    '#D8C890', // 13: Ammo belt brass
    '#302820', // 14: Combat boots
    '#E8F0F8', // 15: Eye white
  ],
  // POW Hostage Palette
  POW: [
    'transparent',
    '#201818', // 1: Outline
    '#F8E060', // 2: Long beard/hair bright
    '#C8A820', // 3: Beard shadow
    '#F0B070', // 4: Skin tone
    '#B06838', // 5: Skin sunburn
    '#3868B8', // 6: Blue ragged shorts
    '#183878', // 7: Shorts shadow
    '#D0A870', // 8: Rope binding
    '#906838', // 9: Rope shadow
    '#FFFFFF', // 10: Sparkle/teeth
  ],
  // Explosion & Fire Palette
  FIRE: [
    'transparent',
    '#FFFFFF', // 1: Pure white core
    '#FFF060', // 2: Intense yellow
    '#FFA010', // 3: Bright orange
    '#E84800', // 4: Fiery red
    '#981800', // 5: Dark crimson
    '#581808', // 6: Charred ember
    '#606060', // 7: Light smoke
    '#383838', // 8: Medium smoke
    '#181818', // 9: Heavy dark smoke
  ]
};
```

#### 2. Procedural Character Sprite Generation
Characters are rasterized on a $24\times 28\text{ px}$ grid using modular anatomy compositing:
- **Base Skeleton**: Pelvis $(12, 16)$, Spine $(12, 10)$, Head $(12, 5)$, Left/Right Foot anchors.
- **Walk Cycle Algorithm** (4-frame loop):
  For walk frame $k \in \{0, 1, 2, 3\}$:
  $$\phi_k = \frac{2\pi k}{4}$$
  $$\text{Leg Angle Left: } \theta_L = 28^\circ \sin(\phi_k)$$
  $$\text{Leg Angle Right: } \theta_R = 28^\circ \sin(\phi_k + \pi)$$
  $$\text{Torso Bob: } y_{\text{bob}} = |2 \cos(\phi_k)|$$
- **Pixel Matrix Rasterization**:
  The offscreen canvas draws pixels using `ctx.fillRect(px, py, 1, 1)` with integer snap. Outlines are automatically generated by expanding non-transparent boundaries by 1 pixel in 4 cardinal directions and tinting with palette color 1 (`outline`).

#### 3. Procedural Explosion Dithering Algorithm
Explosions use a hybrid radial-cellular noise formula to generate classic chunky arcade flame balls:

```typescript
export function generateExplosionFrame(
  radius: number,
  expansionProgress: number, // 0.0 to 1.0
  seed: number
): ImageData {
  const size = Math.ceil(radius * 2.4);
  const imgData = new ImageData(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = radius * expansionProgress;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Pseudo-random pseudo-cellular noise
      const noise = (Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453) % 1;
      const dither = (x % 2 === y % 2) ? 0.08 : -0.08;
      const effectiveDist = dist + noise * (radius * 0.35) + dither * radius;
      
      if (effectiveDist < maxR) {
        const norm = effectiveDist / maxR; // 0.0 (center) -> 1.0 (edge)
        let colorIdx = Math.floor(norm * 6) + 1; // 1 = White, 2 = Yellow, ..., 6 = Smoke
        if (expansionProgress > 0.6) colorIdx = Math.min(8, colorIdx + 2); // Shift to smoke late
        
        const [r, g, b, a] = hexToRgba(PALETTES.FIRE[colorIdx]);
        const pIndex = (y * size + x) * 4;
        imgData.data[pIndex] = r;
        imgData.data[pIndex + 1] = g;
        imgData.data[pIndex + 2] = b;
        imgData.data[pIndex + 3] = a;
      }
    }
  }
  return imgData;
}
```

#### 4. Parallax Background Generation
The background is rendered in 4 distinct depth layers:
- **Layer 0: Gradient Sky ($0.0\times$ Scroll)**:
  - Vertical linear gradient: Deep twilight blue `#102040` (top) $\to$ Warm orange dawn `#E07030` (horizon).
  - Procedural cumulus cloud puffs generated with overlapping sine functions:
    $$y_{\text{cloud}}(x) = y_0 + A_1 \sin(0.015 x) + A_2 \sin(0.045 x + 1.2)$$
- **Layer 1: Distant Mountain Ridge ($0.2\times$ Scroll)**:
  - Fractal midpoint displacement line generator with 5 octaves.
  - Tinted with atmospheric haze (`#405068`, alpha $0.7$).
- **Layer 2: Midground War Ruins & Palm Trees ($0.5\times$ Scroll)**:
  - Concrete bunkers, sandbags, barbed wire fences, and shattered tropical palm trees placed at deterministic intervals along the terrain.
- **Layer 3: Foreground Combat Floor ($1.0\times$ Scroll)**:
  - Solid terrain tiles ($16\times 16\text{ px}$): Mud `#584028`, cracked asphalt `#383838`, riveted steel plates `#687078`, puddles reflecting sky color.

---

### 2.2 Web Audio API Synthesis Formulas & Sound Engine

#### 1. Audio Architecture & Master Graph
```
[Oscillators / Noise Nodes]
        |
    [Envelopes]
        |
    [Filters (Biquad)]
        |
  [WaveShaper Distortion]
        |
   [StereoPanner]
        |
   [Master Gain] ---> [AudioDestination]
```

#### 2. Sound Effects Synthesis Formulas
All sounds are synthesized procedurally via code in `src/audio/sfx.ts`:

1. **Default Handgun Crack**:
   - Primary: Triangle oscillator pitch drop from $750\text{ Hz} \to 110\text{ Hz}$ exponentially over $50\text{ ms}$.
   - Punch: White noise burst bandpass filtered at $2200\text{ Hz}$ ($Q = 2.5$) for $35\text{ ms}$.
   - Envelope: Attack $0.001\text{ s}$, Decay $0.07\text{ s}$, Gain $0.85$.
2. **Heavy Machine Gun (HMG)**:
   - Primary: Sawtooth oscillator with heavy overdrive distortion ($k = 3.5$), pitch sweep $320\text{ Hz} \to 55\text{ Hz}$ over $75\text{ ms}$.
   - Mechanical click: Short square wave pulse at $1800\text{ Hz}$ ($10\text{ ms}$) emulating bolt blowback.
   - Shell casing clink: High sine tone at $3800\text{ Hz}$ decaying over $120\text{ ms}$, triggered with $90\text{ ms}$ delay.
3. **Flame Shot Continuous Roar**:
   - Noise Generator: Brown noise filtered through two parallel resonant lowpass filters:
     $$f_{c1}(t) = 650 + 250 \sin(2\pi \cdot 14 t)\text{ Hz}, \quad Q = 4.0$$
     $$f_{c2}(t) = 1200 + 400 \sin(2\pi \cdot 22 t + 1.5)\text{ Hz}, \quad Q = 3.0$$
   - Sub-bass body: Sine oscillator at $52\text{ Hz}$ with overdrive waveshaper.
   - Flame hiss: Highpass filtered white noise ($f_c = 4500\text{ Hz}$) modulated by Bernoulli crackle generator.
4. **Grenade & Boss Explosions**:
   - Sub-oscillator: Sine wave sweeping $160\text{ Hz} \to 28\text{ Hz}$ over $450\text{ ms}$.
   - Waveshaper non-linear distortion curve:
     $$f(x) = \tanh(4.5 \cdot x)$$
   - Blast noise: Pink noise with resonant lowpass filter sweeping $1800\text{ Hz} \to 120\text{ Hz}$ over $1.4\text{ s}$.
   - Tail: Stereo delay line ($45\text{ ms}$, feedback $0.4$) emulating outdoor landscape echo.

---

### 2.3 Formant Speech Synthesis for Arcade Announcer Clips
The iconic Metal Slug announcer voice is generated procedurally using a **Source-Filter Formant Speech Model**.

#### 1. Mathematical Acoustic Model
The vocal tract is modeled as an acoustic tube filter transfer function $H(s)$ acting on glottal excitation $E(s)$:
$$S(s) = E(s) \cdot \prod_{i=1}^{4} H_i(s)$$
where each formant filter $H_i(s)$ is implemented as a 2nd-order Biquad Bandpass Filter (`BiquadFilterNode` with `type = 'bandpass'`):
$$H_i(z) = \frac{\frac{\omega_0}{2Q} (1 - z^{-2})}{1 - 2 r \cos(\omega_0) z^{-1} + r^2 z^{-2}}$$
where $\omega_0 = 2\pi F_i / f_s$, and $Q_i = F_i / B_i$ ($F_i$ = formant frequency, $B_i$ = bandwidth).

- **Glottal Excitation $E(t)$**:
  - Voiced vowels: Rosenberg glottal pulse train generated via periodic band-limited sawtooth oscillator with pitch $f_0(t)$ modulated along the speech prosody contour ($f_0 \approx 105\text{ Hz} - 135\text{ Hz}$ for deep masculine arcade announcer).
  - Unvoiced consonants: White noise generator shaped by short burst envelopes.

#### 2. Phoneme Formant Target Tables
Key vowel formant frequencies and bandwidths (in Hz):

| Phoneme | IPA | $F_1$ | $B_1$ | $F_2$ | $B_2$ | $F_3$ | $B_3$ | Character |
|---------|-----|-------|-------|-------|-------|-------|-------|-----------|
| /i/ | `i` | 280 | 60 | 2250 | 90 | 2850 | 150 | "m**e**", "mach**i**ne" |
| /ɛ/ | `E` | 550 | 70 | 1800 | 80 | 2550 | 130 | "h**ea**vy" |
| /æ/ | `@` | 700 | 80 | 1650 | 100 | 2450 | 140 | "b**a**d" |
| /ʌ/ | `V` | 640 | 80 | 1220 | 90 | 2500 | 140 | "g**u**n" |
| /eɪ/ | `eI` | 500 $\to$ 360 | 70 | 1900 $\to$ 2200 | 90 | 2600 | 130 | "fl**a**me", "O-K**ay**" |
| /ɒ/ | `Q` | 680 | 80 | 1050 | 90 | 2500 | 140 | "sh**o**t" |
| /oʊ/ | `oU` | 450 $\to$ 380 | 70 | 1000 $\to$ 850 | 80 | 2400 | 140 | "**O**-kay" |
| /m/ | `m` | 250 | 50 | 1050 | 100 | 2200 | 180 | "Heavy **M**achine" |
| /n/ | `n` | 280 | 50 | 1550 | 100 | 2600 | 180 | "Gu**n**" |
| /ʃ/ | `S` | (Noise) | - | 2400 | 400 | 3800 | 600 | "Ma**ch**ine", "**Sh**ot" |
| /k/ | `k` | (Burst) | - | 1950 | 200 | 2800 | 300 | "O-**K**" |
| /t/ | `t` | (Burst) | - | 1800 | 150 | 3900 | 250 | "Sho**t**", "Comple**te**" |

#### 3. Phrase Synthesis Timelines

##### A. "HEAVY MACHINE GUN!"
- **Duration**: $1.25\text{ s}$
- **Timeline**:
  - $0\text{ ms} - 60\text{ ms}$: `/h/` - Aperiodic aspiration noise, $f_0$ off.
  - $60\text{ ms} - 180\text{ ms}$: `/ɛ/` - Voiced vowel ($F_1 = 550, F_2 = 1800, F_3 = 2550$), $f_0 = 125\text{ Hz}$.
  - $180\text{ ms} - 230\text{ ms}$: `/v/` - Voiced labiodental friction.
  - $230\text{ ms} - 320\text{ ms}$: `/i/` - High front vowel ($F_1 = 280, F_2 = 2250, F_3 = 2850$).
  - $320\text{ ms} - 370\text{ ms}$: `/m/` - Nasal murmur ($F_1 = 250, F_2 = 1050$).
  - $370\text{ ms} - 430\text{ ms}$: `/ə/` - Neutral schwa ($F_1 = 500, F_2 = 1500$).
  - $430\text{ ms} - 530\text{ ms}$: `/ʃ/` - Intense postalveolar friction noise bandpass $2500 - 5500\text{ Hz}$.
  - $530\text{ ms} - 680\text{ ms}$: `/i/` - Stressed vowel ($F_1 = 280, F_2 = 2300$), pitch peaks at $f_0 = 138\text{ Hz}$.
  - $680\text{ ms} - 740\text{ ms}$: `/n/` - Nasal closure.
  - $740\text{ ms} - 780\text{ ms}$: [Brief pause]
  - $780\text{ ms} - 830\text{ ms}$: `/ɡ/` - Velar stop burst.
  - $830\text{ ms} - 1050\text{ ms}$: `/ʌ/` - Deep authoritative vowel ($F_1 = 640, F_2 = 1220$), $f_0$ drops $130 \to 95\text{ Hz}$.
  - $1050\text{ ms} - 1250\text{ ms}$: `/n/` - Resonant nasal decay with light arcade hall reverb.

##### B. "FLAME SHOT!"
- **Duration**: $0.95\text{ s}$
- **Timeline**:
  - $0\text{ ms} - 70\text{ ms}$: `/f/` - Unvoiced labiodental friction noise.
  - $70\text{ ms} - 130\text{ ms}$: `/l/` - Lateral liquid transition ($F_1 = 380, F_2 = 1100$).
  - $130\text{ ms} - 340\text{ ms}$: `/eɪ/` - Stressed diphthong ($F_1: 520 \to 360, F_2: 1900 \to 2250$), $f_0 = 132\text{ Hz}$.
  - $340\text{ ms} - 420\text{ ms}$: `/m/` - Nasal closure.
  - $420\text{ ms} - 460\text{ ms}$: [Pause]
  - $460\text{ ms} - 580\text{ ms}$: `/ʃ/` - Sharp fricative noise burst.
  - $580\text{ ms} - 780\text{ ms}$: `/ɒ/` - Open back vowel ($F_1 = 680, F_2 = 1050$), pitch rises then drops ($120 \to 135 \to 100\text{ Hz}$).
  - $780\text{ ms} - 950\text{ ms}$: `/t/` - Silent closure followed by sharp explosive plosive transient at $4200\text{ Hz}$.

##### C. "OK!"
- **Duration**: $0.48\text{ s}$
- **Timeline**:
  - $0\text{ ms} - 160\text{ ms}$: `/oʊ/` - Rounded vowel ($F_1 = 450, F_2 = 980$), upbeat rising pitch $115 \to 130\text{ Hz}$.
  - $160\text{ ms} - 210\text{ ms}$: `/k/` - Velar plosive burst ($F_2 \approx 2000\text{ Hz}$).
  - $210\text{ ms} - 480\text{ ms}$: `/eɪ/` - Punchy bright vowel ($F_1 = 480, F_2 = 2100$), $f_0$ sustains enthusiastically at $145\text{ Hz}$.

##### D. "MISSION COMPLETE!"
- **Duration**: $1.35\text{ s}$
- **Timeline**:
  - $0\text{ ms} - 180\text{ ms}$: `/m ɪ/` - Nasal to front vowel.
  - $180\text{ ms} - 280\text{ ms}$: `/ʃ ə n/` - Fricative + schwa + nasal ("Mission").
  - $280\text{ ms} - 350\text{ ms}$: [Pause]
  - $350\text{ ms} - 520\text{ ms}$: `/k ə m/` - Plosive + schwa + nasal ("Com-").
  - $520\text{ ms} - 820\text{ ms}$: `/p l iː/` - Plosive + liquid + elongated high vowel ("-plee-"), heroic climax pitch $f_0 = 142\text{ Hz}$.
  - $820\text{ ms} - 1350\text{ ms}$: `/t/` - Crisp alveolar stop with lingering arcade reverb tail.

---

## 3. Detailed Specifications for R5: Testing Interfaces & Verification Criteria

### 3.1 Headless Unit Testing Architecture (`vitest`)
Because core game logic in `src/core/` is 100% decoupled from DOM/Canvas APIs, unit tests execute natively in Node.js via Vitest at high velocity ($>1000\text{ ticks/sec}$).

#### 1. Headless Simulation Harness Interface
```typescript
export interface WorldStepConfig {
  fixedDeltaTime: number; // 1 / 60 = 0.0166667
  maxSubSteps: number;    // 5
}

export class HeadlessSimulationHarness {
  public world: GameWorld;
  private accumulator: number = 0;
  private readonly dt: number = 1 / 60;

  constructor(seed: number = 1337) {
    this.world = new GameWorld({ seed, headless: true });
  }

  public step(elapsedSeconds: number, input: PlayerInputState): void {
    this.accumulator += elapsedSeconds;
    while (this.accumulator >= this.dt) {
      this.world.tick(this.dt, input);
      this.accumulator -= this.dt;
    }
  }

  public fastForward(seconds: number, input: PlayerInputState): void {
    const steps = Math.floor(seconds / this.dt);
    for (let i = 0; i < steps; i++) {
      this.world.tick(this.dt, input);
    }
  }
}
```

#### 2. Concrete Unit Test Specifications (`tests/unit/`)
1. `tests/unit/enemy_infantry.test.ts`:
   - **Rifleman AI Test**: Spawns rifleman at $x = 300$, player at $x = 100$. Asserts state transitions from `IDLE` $\to$ `ALERT` within $1\text{ tick}$, `ALERT` $\to$ `AIM` after $200\text{ ms}$, bullet spawned with velocity $v_x = -280\text{ px/s}$ at $t = 450\text{ ms}$.
   - **Knife Charger Test**: Spawns charger at $x = 200$, player at $x = 100$. Verifies sprint velocity ($170\text{ px/s}$), leap trigger at distance $\le 65\text{ px}$, and recovery stun duration ($450\text{ ms}$) upon landing.
   - **Shield Trooper Directional Test**: Fires handgun bullet from front ($\vec{d} = (1, 0)$, facing 'left'). Asserts bullet absorbed ($0\text{ damage}$). Fires handgun bullet from behind ($\vec{d} = (-1, 0)$). Asserts full damage taken and trooper HP reduced from 4 to 3.
2. `tests/unit/midboss_vehicle.test.ts`:
   - **Turret Slew Test**: Sets player position at $(x_t + 100, y_t - 100)$. Asserts turret angle tracks toward $-45^\circ$ clamped by max slew rate $\omega_{\max}$.
   - **Health Gate Invariant Test**: Applies $500$ damage to Mid-Boss in single frame. Asserts HP is clamped at Phase 2 threshold ($240$) and does not jump directly to death state.
3. `tests/unit/tetsuyuki_boss.test.ts`:
   - **Phase 1 $\to$ 2 Transition Test**: Depletes boss HP below 975. Asserts artillery cannon disabled, hull breach flag set to `true`, and Phase 2 laser sweep state initialized.
   - **Phase 3 Weak Point Test**: Deals 10 damage to exposed core hitbox: verifies $15$ damage applied ($1.5\times$). Deals 10 damage to main hull hitbox: verifies $2.5$ damage applied ($0.25\times$).
   - **Multi-Stage Explosion Timing**: Sets boss HP to 0. Ticks world for $3.5\text{ s}$. Verifies death stages 1, 2, 3, 4 trigger in exact sequence and boss marks level clear.
4. `tests/unit/audio_patches.test.ts`:
   - Verifies synthesized audio buffer generators: asserts buffer length $> 0$, sample rate $= 44100\text{ Hz}$, peak amplitude $\le 1.0$ (no clipping), and non-zero energy content.

---

### 3.2 Playwright E2E Verification Criteria & Test Harness (`tests/e2e/`)

#### 1. Execution Flags & Environment Setup
- Runner: Headless Chromium via Playwright.
- Launch Options:
  ```typescript
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--mute-audio=false' // Allow audio context verification
    ]
  });
  ```

#### 2. Verification Checklist & Gate Criteria

##### A. Zero Uncaught Console Errors & Exceptions
- **Listener Setup**:
  ```typescript
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`[PAGE ERROR] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  ```
- **Acceptance Criterion**: `expect(errors).toHaveLength(0)` at end of test run. Zero unhandled promise rejections, zero WebGL context loss, zero audio initialization exceptions.

##### B. 60 FPS Canvas Game Loop Stability Criterion
- **Metric Collection Hook**: The game exposes `window.__PERF_METRICS__` tracking the last 300 frames:
  ```typescript
  export interface PerfMetrics {
    frameCount: number;
    avgFps: number;
    minFps: number;
    maxFrameTimeMs: number;
    droppedFrames: number; // frameTime > 33.33ms (equivalent to < 30fps dip)
  }
  ```
- **Benchmark Run**:
  1. Load game page (`http://localhost:5173`).
  2. Simulate player inputs: Run right (`KeyD`), shoot weapon (`KeyJ`), throw grenade (`KeyK`), jump (`KeySpace`).
  3. Advance through Mid-Boss encounter and reach Boss arena.
  4. Collect metrics over 300 continuous frames ($5.0\text{ s}$ duration).
- **Pass Thresholds**:
  - `avgFps >= 58.0` (target 60.0 FPS)
  - `droppedFrames <= 5`
  - `maxFrameTimeMs <= 33.33 ms`

##### C. Visual Canvas Integrity & Render Validation
- Capture canvas screenshot buffer.
- Inspect canvas pixel data via `page.evaluate()`:
  - Non-empty buffer: Canvas must not be solid black (`#000000`) or transparent (`rgba(0,0,0,0)`).
  - Unique color count: Must contain $\ge 120$ unique RGB colors across background, player, HUD, and enemy sprites.
  - Virtual resolution letterboxing: Canvas maintains $320\times 224$ aspect ratio ($10:7$) inside window viewport with crisp pixelated rendering (`image-rendering: pixelated`).

##### D. Web Audio API Initialization Verification
- In headless test:
  ```typescript
  const audioState = await page.evaluate(() => {
    const audioCtx = (window as any).__AUDIO_CTX__;
    return {
      state: audioCtx ? audioCtx.state : 'uninitialized',
      sampleRate: audioCtx ? audioCtx.sampleRate : 0
    };
  });
  expect(audioState.state).toBe('running');
  expect(audioState.sampleRate).toBeGreaterThan(0);
  ```

---

## 4. Architectural Dependency Graph & Cross-Module Contracts

```
[src/core/math/] ---------> [src/core/physics/]
       |                           |
       v                           v
[src/core/entities/] <----> [src/core/weapons/]
 (Enemies, Bosses,             (Handgun, HMG,
  Infantry, Vehicles)           FlameShot, Grenades)
       |                           |
       +------------+--------------+
                    |
                    v
          [src/core/world.ts]  <----------------+
          (Deterministic Simulation Engine)     |
                    |                           |
       +------------+-------------+             | (Input state)
       |                          |             |
       v                          v             |
[src/render/canvas/]       [src/audio/engine/]  |
(Procedural Sprites,       (Procedural SFX,     |
 Parallax Layers,           Formant Announcer)  |
 HUD, Particle FX)                              |
       |                          |             |
       +------------+-------------+             |
                    |                           |
                    v                           |
            [src/main.ts] ----------------------+
            (Browser Bootstrap,
             Game Loop, Input Dispatch)
```

---

## 5. Specification Summary & Next Steps
This technical specification mined and detailed all functional, mathematical, and algorithmic requirements for:
1. **R3**: 4 distinct infantry AI state machines, multi-component Mid-Boss armored vehicle with health gates, and the 3-phase Tetsuyuki War Fortress end-boss with chain destruction sequences.
2. **R4**: Procedural 16-color Neo Geo palette pixel art generation algorithms, explosion dithering formulas, 4-layer parallax scrolling, Web Audio procedural FM/noise synthesizers, and source-filter formant speech synthesis models for the classic announcer voice clips.
3. **R5**: Decoupled headless unit testing interfaces (`vitest`) and strict Playwright 60fps / zero-error E2E verification criteria.

All specifications are ready for the orchestrator to synthesize into `PROJECT.md` and dispatch to implementation workers upon user approval.
