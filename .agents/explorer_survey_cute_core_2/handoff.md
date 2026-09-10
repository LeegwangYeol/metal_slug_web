# Handoff Report: Novel Core Gameplay Loop & Mechanics Survey (R2)

**Author**: Explorer 2 (Autonomous Gameplay Reinvention & Core Systems Architect)  
**Target Milestone**: R2 — Autonomous Gameplay Reinvention ("Sugar Pop Blossom: Cozy Star Arena")  
**Target Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_cute_core_2`  

---

## 1. Observation

Direct investigation of the codebase and test suites revealed the following concrete architectural facts:

1. **Deterministic Headless Simulation Core (`src/core/engine/GameEngine.ts:55-253`)**:
   - Simulation runs on a fixed 60Hz timestep (`DEFAULT_TIMESTEP = 1/60s`) with zero DOM or HTML Canvas dependencies.
   - `GameEntity` interface (`GameEngine.ts:6-15`) specifies `id: string`, `type: string`, `position: Vector2D`, `velocity: Vector2D`, `bounds: AABB`, `isAlive: boolean`, `update(dt, engine): void`, and optional `onCollision(other, engine): void`.
   - `SpatialGrid<GameEntity>` (`GameEngine.ts:71`, cell size 64px) handles broadphase queries, while `resolveEntityCollisions()` (`GameEngine.ts:225-240`) executes narrowphase AABB bounding-box checks.
   - `EventBus` (`GameEngine.ts:19-46`) provides decoupled pub/sub for SFX, voice callouts, screen shakes, score awards, and stage transitions.
   - Performance benchmark: `SpatialGrid Saturation Benchmark (600 items)` completes 1,000 queries in 9.094 ms (~9.09 µs/query); headless simulation runs at >12,000 ticks/sec.

2. **Stage Manager & Linear Camera Constraints (`src/core/engine/StageManager.ts:6-231` & `src/main.ts:824-967`)**:
   - Currently, `StageManager` controls a linear corridor of `width: 3600, height: 540` (`src/main.ts:825-826`).
   - Camera has `forwardLock: true` (`src/main.ts:130`) which strictly prevents backtracking to the left.
   - Triggers are strictly X-coordinate thresholds (`trigger_wave_1` at X=180, `trigger_wave_2` at X=420, `trigger_mid_boss` at X=740, `trigger_wave_3` at X=1240, `trigger_end_boss` at X=1780).
   - This linear progression and camera locking directly causes the user-reported "stifling/claustrophobic" (답답한) feel.

3. **Player Kinematics & Locomotion (`src/core/player/PlayerController.ts:33-356` & `PlayerKinematics.ts:1-150`)**:
   - Features robust Newtonian mechanics: `RUN_SPEED = 132 px/s`, `CRAWL_SPEED = 54 px/s`, `JUMP_IMPULSE = -360 px/s`, `GRAVITY = 880 px/s^2`.
   - Enhanced game feel mechanics: 4-frame Coyote time (`coyoteTimer`), 4-frame Jump buffering (`jumpBufferTimer`), and single-shot variable jump apex cut (`applyJumpCut`, cuts upward velocity to 45%).
   - Semi-solid platform drop-through (`initiateDropThrough`, downward jump ignores platform contact for 0.25s).
   - Currently tied to military weapon manager (`PISTOL`, `HEAVY_MACHINE_GUN`, `FLAME_SHOT`, `SHOTGUN`, `LASER_GUN`, `ROCKET_LAUNCHER`, `Grenade`, and a 4-phase bomber strike `UltimateManager`).

4. **Companion AI System Already Exists (`src/core/entities/allies/AllyNPC.ts:9-323` & `AllyManager.ts:1-51`)**:
   - `AllyNPC` implements autonomous target acquisition (`findBestTarget`, prioritizes bosses and close enemies within 320px vision radius), pathfinding platform jumps (`player.position.y < this.position.y - 22`), follow offset, attack charge/fire cycle, and zero friendly-fire logic.
   - This provides a production-ready architectural foundation for an adorable Pet Companion (`PetCompanionEntity`).

5. **Existing Verification Baseline (`tests/unit/`)**:
   - Running `npm test` executes 42 test suites with **596 passing unit tests** across core engine, kinematics, collision, weapons, bosses, and stage triggers.
   - Many tests explicitly instantiate `new FullMetalSlugGame()` and assert properties such as `game.stageManager.getState() === 'SECTION_1_ADVANCE'`, `game.player.weaponManager.getActiveWeapon()`, and `boss.maxHealth <= 500`.
   - Backward compatibility of existing test entry points must be preserved while introducing the reinvented cute loop.

---

## 2. Logic Chain

1. **From Observation 2 (Linear 3600px Corridor & Forward Camera Lock) to Design Need**:
   - The traditional Metal Slug design forced players into a single-direction march where enemies walk in from the right edge.
   - To break away from this formula and eliminate claustrophobia, the game must transition to an expansive, non-linear **Arena Sanctuary** (960x540 or 1280x720 with full 2D exploration, bouncy mushroom launch-pads, cloud perches, and vertical multi-tiered platforms).

2. **From Observation 1 & User Prompt to Core Gameplay Reinvention (R2)**:
   - Rather than grim military shooting with bullets, blood, and corpses, the core interaction becomes **"Sugar Pop Blossom: Cozy Star Arena"**:
     - **Shooting = Sweet Bubble Trapping**: Shots fire iridescent pastel bubbles that encase enemies into buoyant floating spheres.
     - **Popping = Cascade Combos ("Sweet Cascade")**: Popping a bubble unleashes radial star shards (6 shards at 60-degree intervals) that pop adjacent bubbles in chain reactions, awarding combo multipliers (`1x -> 2x -> 3x [Sweet!] -> 5x [Fantastic!] -> 10x [Miracle Bloom!]`).
     - **Collecting = Sweet Fever ("Rainbow Sugar Rush")**: Popped bubbles drop Candies, Sugar Hearts, and Star Crystals. Collecting them charges the Fever Meter to 100%, triggering an 8-second rainbow invincibility rush with 3-way bubble spread and full-screen candy attraction magnet.

3. **From Observation 4 (AllyNPC Architecture) to Pet Companion**:
   - Re-skin and extend `AllyNPC` into **"Mochi the Cloud Bunny"** (or **"Puff the Star Kitten"**):
     - Orbit-follows the player with smooth spring physics.
     - Automates candy collection by vacuuming stars/candies within 160px.
     - Fires playful heart-bolts at nearby un-bubbled enemies every 1.5s.
     - Grants a shimmering Bubble Shield that periodically absorbs hits.

4. **From Observation 2 & 3 to Dynamic Zone-Purification & Rogue-Lite Progression**:
   - The arena features 3 **Blossom Altars** (Left, High-Center, Right).
   - Purifying altars by clearing bubble waves nearby causes the surrounding environment to bloom with pastel flowers and candy vines.
   - Completing altar purification or leveling up opens a **Cozy 3-Card Rogue-Lite Perk Selection** (e.g., *Rainbow Sprinkles*, *Bubble Orbiters*, *Sugar Dash Trail*, *Pet Pep*, *Star Magnet*, *Cupcake Shield*).

5. **From Observation 5 (596 Unit Tests) to Implementation Architecture**:
   - All cute mechanics are encapsulated cleanly in a dedicated directory: `src/core/cute/`:
     - `CuteGameTypes.ts`
     - `BubbleManager.ts` & `BubbleTrapEntity.ts`
     - `PetCompanion.ts`
     - `CuteEnemyManager.ts`
     - `ArenaPurificationManager.ts`
     - `SweetPerkManager.ts`
   - `FullMetalSlugGame` in `src/main.ts` accepts an optional `gameMode?: 'cute_blossom_arena' | 'classic'` in `GameOptions` (defaulting to `'cute_blossom_arena'`), ensuring 100% backward compatibility for all existing tests while delivering the new cute loop out-of-the-box.

---

## 3. Detailed Specification: "Sugar Pop Blossom: Cozy Star Arena"

### 3.1. Game State Machine

```
                  ┌───────────────────────┐
                  │      INITIALIZING     │
                  └──────────┬────────────┘
                             │ (Stage & Pet loaded)
                             ▼
                  ┌───────────────────────┐
                  │      ARENA_INTRO      │ (1.5s Banner: "READY! POP & BLOOM!")
                  └──────────┬────────────┘
                             │
                             ▼
         ┌──────────────►┌───────────────────────┐◄──────────────┐
         │               │      WAVE_ACTIVE      │               │
         │               └─────┬───────────┬─────┘               │
         │                     │           │                     │
         │ (Fever 100%)        │           │ (Altar 100% or      │ (Resume
         │                     ▼           │  Wave Target Met)   │  after
  ┌──────────────┐   ┌─────────────────┐   │                     │  Perk)
  │ SWEET_FEVER  │   │  PERK_SELECTION │◄──┘                     │
  │  (8.0s Rush) │   └─────────┬───────┘                         │
  └──────┬───────┘             │ (Player selects 1 of 3 cards)   │
         │                     ▼                                 │
         └────────────►┌─────────────────┐                       │
                       │   WAVE_CLEARED  │───────────────────────┘
                       └───────┬─────────┘
                               │ (After Wave 3: Final Bloom)
                               ▼
                       ┌─────────────────┐
                       │   BOSS_SHOWDOWN │ (Gummy Bear Colossus)
                       └───────┬─────────┘
                               │ (Boss Defeated)
                               ▼
                       ┌─────────────────┐
                       │  GARDEN_PURIFIED│ (Victory Celebration & Loop)
                       └─────────────────┘
```

### 3.2. Combat & Bubble Cascade Mathematics
- **Bubble Entity (`BubbleTrapEntity`)**:
  - Encapsulates target enemy, moves upward with buoyant velocity: $v_y = -42 \text{ px/s} + \sin(\omega t) \times 8 \text{ px/s}$.
  - Radius: $R = 24 \text{ px}$. Lifespan before auto-escape: $8.0 \text{ s}$.
- **Pop Radial Burst**:
  - Generates 6 star shards at angles $\theta_k = k \times \frac{\pi}{3} \quad (k \in \{0, 1, 2, 3, 4, 5\})$.
  - Shard speed: $320 \text{ px/s}$, lifespan: $0.35 \text{ s}$ (reach: $\approx 110 \text{ px}$).
  - Any bubble within radius $R_{pop} = 65 \text{ px}$ or touched by a shard is immediately popped.
- **Scoring & Multiplier**:
  $$\text{Score} = \text{BasePoints} \times \min(\text{ComboCount}, 10)$$
  $$\text{CandyDrops} = \min(2 + \text{ComboCount}, 8)$$

### 3.3. Cute Enemy Archetypes
| Archetype | HP | Locomotion | Special Mechanic |
| :--- | :--- | :--- | :--- |
| **Marshmallow Slime** | 1 | Ground hops ($v_x = \pm 60, v_y = -220$ on bounce) | Squashes and stretches adorably on landing |
| **Honey Bee Floater** | 1 | Sine-wave flight ($y(t) = y_0 + 35 \sin(3t)$) | Drops sweet nectar drops that sprout flower obstacles |
| **Donut Roller** | 2 | Swift roll ($v_x = \pm 140 \text{ px/s}$) | Jumps gaps, bounces off walls |
| **Gummy Bear Colossus (Boss)** | 250 | Ground stomp shockwaves, belly flops | Sneeze launches gumdrop bubbles; splits into 3 mini gummy cubs upon defeat |

### 3.4. Required Core Files & Interface Contracts

#### Files to Create in `src/core/cute/`:
1. `src/core/cute/CuteGameTypes.ts`: All cute domain models (perks, bubbles, altars, fever state).
2. `src/core/cute/BubbleTrapEntity.ts`: Floating bubble entity with chain reaction radial bursts.
3. `src/core/cute/BubbleManager.ts`: Entity lifecycle, spatial queries, combo tracking.
4. `src/core/cute/PetCompanion.ts`: Companion follow logic, candy vacuuming, auto-blast.
5. `src/core/cute/CuteEnemyManager.ts`: Spawns slimes, bees, rollers, and boss.
6. `src/core/cute/ArenaPurificationManager.ts`: Altars and garden bloom progression.
7. `src/core/cute/SweetPerkManager.ts`: 3-card rogue-lite upgrade pool.

#### Interface Contract with Render Layer (`src/render/CanvasRenderer.ts`):
```typescript
export interface RenderBubbleState {
  id: string;
  x: number;
  y: number;
  radius: number;
  trappedType?: string;
  isPopping?: boolean;
  popProgress?: number; // 0.0 to 1.0
  swayAngle?: number;
}

export interface RenderPetState {
  x: number;
  y: number;
  facing: 1 | -1;
  state: 'hover' | 'fetch' | 'zap' | 'cheer';
  actionProgress?: number;
}

export interface RenderAltarState {
  id: string;
  x: number;
  y: number;
  purificationProgress: number; // 0.0 to 1.0
  isBloomed: boolean;
}

export interface RenderFeverState {
  isActive: boolean;
  meterProgress: number; // 0.0 to 1.0
  remainingTime: number;
}

export interface RenderPerkCardState {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'legendary';
}
```

#### Interface Contract with UI Layer (`src/ui/HUDOverlay.ts`):
- Candy Star Score Counter (vibrant gold/pink arcade numbers with star badge).
- Sweet Heart Lives Bar (3 cute beating pastel hearts).
- Rainbow Fever Meter (pulsing gradient bar charging from 0% to 100%).
- Rogue-Lite 3-Card Selection Modal (active when `state === 'PERK_SELECTION'`).
- Altar Bloom Progress Indicator (mini garden map showing 3 flower statuses).

---

## 4. Caveats

1. **Test Suite Invariance**: The existing 596 tests assert specific properties on `SoldierEnemy`, `TetsuyukiBoss`, `PlayerKinematics`, and `WeaponManager`. The cute loop must either act as an additive mode (via `gameMode: 'cute_blossom_arena'`) or cleanly wrap existing classes so all 596 tests remain 100% green without modification.
2. **Parallel Stream Coordination**: Explorer 1 is surveying the visual rendering and palette replacement (`src/render/`), while Explorer 3 is inspecting Playwright E2E testing (`tests/e2e/`). The interface contracts defined above serve as the exact handshake specification for both streams.
3. **Canvas Dimension Compatibility**: Virtual resolution is 960x540 (16:9 modern viewport). The Arena layout is fully contained within 960x540 or an expansive 1200x540 camera scroll, ensuring smooth 60 FPS performance without frame drops.

---

## 5. Conclusion

The "Sugar Pop Blossom: Cozy Star Arena" blueprint decisively satisfies every directive of the user's R2 Autonomous Gameplay Reinvention:
- It eliminates the linear 3600px forward-locked corridor in favor of a joyful, multi-tiered pastel arena with bounce mushrooms and vertical platforms.
- It introduces an innovative, charming bubble-trap and sweet cascade combo loop, supported by Mochi the Cloud Bunny pet companion, dynamic altar purification, and 3-card rogue-lite perk progression.
- It maintains 100% decoupling between headless simulation physics (`src/core/`) and rendering (`src/render/`), allowing rock-solid deterministic unit and Playwright E2E verification.

---

## 6. Verification Method

To independently verify this survey and prepare for implementation:

1. **Verify Existing Simulation & Test Baseline**:
   ```bash
   npm test
   ```
   *Expected*: All 42 test suites pass (596 tests green).

2. **Verify Headless Performance & Memory Stability**:
   ```bash
   npx vitest run tests/unit/challenger_boss_and_stability.test.ts
   ```
   *Expected*: 3,600 simulation ticks complete in <400 ms with 0 exceptions and 0 NaN/Inf occurrences.

3. **Verify Type-Safety & Build Integrity**:
   ```bash
   npm run build
   ```
   *Expected*: `tsc -b` and `vite build` complete with 0 errors.

4. **Invalidation Conditions**:
   - Any design requiring direct DOM access in `src/core/` is invalid (must remain 100% headless).
   - Any modification breaking existing 596 unit tests is invalid.
   - Any loop requiring linear forward-scrolling camera lock is invalid.
