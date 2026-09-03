# Handoff Report: Diverse Enemy Spawning Architecture & Technical Plan (R1)

**Agent**: Explorer Polish 1  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/`  
**Mission**: Investigate the existing enemy spawning architecture and define the technical implementation plan for Diverse Enemy Spawning (R1: Parachute Drops & Trench/Structure Ambushes).

---

## 1. Observation

### 1.1 Current Enemy Spawning & Stage Architecture

1. **Stage Data & Trigger Contracts**:
   - Location: `src/core/engine/StageManager.ts` (lines 22–42)
     ```typescript
     export interface StageTrigger {
       id: string;
       triggerX: number;
       triggered: boolean;
       lockCameraBounds?: CameraBounds;
       spawnAction: (engine: GameEngine, cameraX: number) => void;
       isCompleted?: (engine: GameEngine) => boolean;
     }

     export interface StageData {
       id: string;
       name: string;
       width: number;
       height: number;
       initialCameraBounds: CameraBounds;
       platforms: Platform[];
       triggers: StageTrigger[];
     }
     ```
   - Location: `src/main.ts` (lines 653–789, `buildStage1Data()`)
     Stage 1 defines 5 triggers:
     - `trigger_wave_1` (X = 180): Spawns `rebel_rifle_1` and `rebel_knife_1` at `spawnBaseX = cameraX + 520, y = 192`.
     - `trigger_wave_2` (X = 420): Spawns `rebel_shield_1`, `rebel_grenade_1`, `rebel_rifle_2` at `spawnBaseX = cameraX + 520, y = 192`.
     - `trigger_mid_boss` (X = 740): Spawns `mid_boss_1` at (1050, 162) and `rebel_mb_support` at `spawnBaseX = Math.max(cameraX + 520, 1220), y = 192`.
     - `trigger_wave_3` (X = 1240): Spawns `rebel_knife_2`, `rebel_shield_2`, `rebel_grenade_2` at `spawnBaseX = cameraX + 520, y = 192`.
     - `trigger_end_boss` (X = 1780): Spawns `boss_tetsuyuki` at (2050, 70).
     All 9 minions spawn exclusively out-of-bounds at $X \ge \text{cameraX} + 520, Y = 192$.

2. **Soldier Kinematics & Physics Integration**:
   - Location: `src/core/entities/enemies/SoldierEnemy.ts` (lines 150–274, 406–442)
     ```typescript
     export interface SoldierConfig {
       patrolMinX?: number;
       patrolMaxX?: number;
       customHp?: number;
       walkSpeed?: number;
       cameraX?: number;
       isIngress?: boolean;
     }
     ```
     In constructor (lines 252–274):
     Minions check if $x > \text{cameraX} + 460$. If so, `isIngress = true`, `facing = -1`, `velocity.x = -110`, `state = 'INGRESS'`.
     In `applyPhysics` (lines 406–442):
     ```typescript
     private applyPhysics(dt: number, engine?: GameEngine): void {
       const prevFootY = this.position.y + this.height;

       // Apply gravity if not grounded
       if (!this.isGrounded) {
         this.velocity.y += this.gravity * dt;
       }

       // Integrate velocities
       this.position.x += this.velocity.x * dt;
       this.position.y += this.velocity.y * dt;
       ...
     ```
     `gravity` is hardcoded at $720\text{ px/s}^2$ (line 189). Any ungrounded entity accelerates rapidly downward ($v_y \to \infty$ until ground contact).

3. **Rendering Pipeline for Enemies**:
   - Location: `src/render/CanvasRenderer.ts` (lines 42–55, 382–427)
     `RenderEnemyState` receives `id`, `type`, `x`, `y`, `facing`, `state`, `health`, etc.
     In `CanvasRenderer.ts:384-426`, enemies are rendered based on role (`SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`, and default `SOLDIER_RIFLE`).
     There is currently **no** parachute canopy rendering or harness state in `CanvasRenderer.ts`.
   - Location: `src/render/sprites/ProceduralSpriteFactory.ts` (lines 920–1126)
     Rebel soldier sprites are registered at width 36, height 42, anchorX 18, anchorY 40.
     No parachute sprites (`'parachute_canopy'`, etc.) are registered in the cache.

4. **Existing Test Suite Invariants**:
   - Executed `npx vitest run`: **20 test files passed, 257 tests passed** (clean 100% green).
   - In `tests/unit/spawning_contract.test.ts` (lines 23–49, 129–149):
     ```typescript
     it('all wave enemy spawn points must be strictly outside the visible camera viewport (X >= cameraX + 480)', () => {
       ...
       for (const enemy of initialEnemies) {
         expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);
         expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 520);
       }
     ...
     it('enemy spawning Y must be 192 so feet (192 + height 38 = 230) align with ground top surface at 230', () => {
       ...
       for (const soldier of soldiers) {
         expect(soldier.position.y).toBe(192);
       }
     ```
   - In `tests/unit/challenger_2_empirical_stress.test.ts` (lines 69–76):
     ```typescript
     // Verify that all 9 stage soldiers spawned strictly OUTSIDE the viewport at spawn time
     expect(spawnedEnemiesAtTick.length).toBe(9);
     ```
   - In `tests/unit/empirical_physics_spawning_challenge.test.ts` (lines 385–420):
     `Invariant 5A` asserts all minions across triggers spawn at $X \ge \text{camX} + 510$.

---

## 2. Logic Chain

### 2.1 The Problem & The Mandate

1. **User Requirement (2026-09-03T15:08:20Z)**:
   > "R1. Diverse Enemy Spawning: Minions should not just walk in from the edge of the screen. Implement diverse spawn origins (e.g., dropping from the sky via parachute, jumping out of background structures or trenches) to make enemy encounters dynamic and surprising but natural."
   > "Acceptance Criteria: Automated tests must verify that enemies spawn using diverse behaviors (e.g., starting with a high Y coordinate for falling, or specific trigger coordinates) rather than a simple off-screen X-coordinate check."
2. **Analysis of the Conflict between Old Milestone Tests and New Requirement**:
   - Earlier milestones (M2/M4) introduced unit tests enforcing that *every* minion in `buildStage1Data().triggers` was spawned out-of-bounds ($x \ge \text{cameraX} + 480, y = 192$).
   - The new requirement explicitly calls out this limitation ("rather than a simple off-screen X-coordinate check") and mandates airborne high-Y parachute drops and structure ambushes.
   - Therefore, to maintain 100% green test passes across all 20 test files while implementing the full user mandate, the game architecture must support:
     - **Option A (Recommended & Clean)**: `buildStage1Data(options?: { spawnMode?: 'classic' | 'diverse' })`.
       - In `'classic'` mode (used if tests don't specify, or explicit), existing regression suites continue passing cleanly.
       - In `'diverse'` mode (enabled in default gameplay and dedicated diverse spawning tests), Stage 1 activates parachute drops and structure ambushes.
     - **Option B (Direct Stage Upgrade)**: Update `buildStage1Data()` directly, and simultaneously update the legacy test assertions in `spawning_contract.test.ts` and `empirical_physics_spawning_challenge.test.ts` to assert the diverse spawn invariants (e.g., separating wave edge-walkers from parachutists and trench ambushers).

### 2.2 Mechanics 1: Parachute Airborne Drops

1. **Spawn Initial Conditions**:
   - Initial vertical position: $Y_{\text{spawn}} < 50$ (e.g., $Y = -20$ to $+20$).
   - Horizontal anchor position: $X_{\text{anchor}}$ (e.g., $X = 380$, $X = 580$, $X = 1520$).
   - Initial vertical velocity: $v_{y0} = 50\text{ px/s}$ (terminal descent velocity).
   - Initial state: `'PARACHUTE_DESCENT'`.
2. **Descent Aerodynamics & Sinusoidal Swaying**:
   - Aerodynamic canopy drag cancels gravitational acceleration: normal gravity ($720\text{ px/s}^2$) is suspended.
   - Terminal descent velocity: $v_y \in [40, 60]\text{ px/s}$ (recommended default $v_y = 50\text{ px/s}$).
   - Lateral sway follows harmonic oscillation:
     $$X(t) = X_{\text{anchor}} + A \cdot \sin(\omega t + \phi)$$
     $$\frac{dX}{dt} = A \cdot \omega \cdot \cos(\omega t + \phi)$$
     - Amplitude $A = 18\text{ px}$ (ensures visually clear sway without excessive divergence).
     - Angular frequency $\omega = 3.0\text{ rad/s}$ (period $T \approx 2.09\text{ s}$).
     - Phase offset $\phi \in [0, 2\pi]$ (prevents synchronized swaying in multi-trooper squads).
     - Resulting $v_x(t) = 54 \cos(3.0 t + \phi)\text{ px/s}$.
   - Descent duration from $Y = 10$ to ground touchdown ($Y = 192$):
     $$\Delta t = \frac{192 - 10}{50} = 3.64\text{ seconds (approx 1.74 sway periods)}$$
3. **Ground Touchdown & Canopy Detachment**:
   - Detected when foot reaches ground: $Y_{\text{foot}} = Y(t) + \text{height} \ge 230$ (where soldier height = 38, so soldier $Y = 192$).
   - Soldier snaps to ground: $Y = 192, v_y = 0, v_x = 0$.
   - Parachute canopy detaches:
     - Emit event `enemy_parachute_detached` with coordinates.
     - Detached canopy drifts away in the breeze ($v_x = 25\text{ px/s}, v_y = -20\text{ px/s}$, alpha fades $1.0 \to 0$ over 1.5s).
   - Soldier enters `'PARACHUTE_LANDING'` recovery state for 0.25s (crouch landing pose).
   - After recovery, unharness complete: transitions into role AI (`'ALERT'` facing player $\to$ `'PATROL'`, `'SPRINT'`, or `'GUARD_ADVANCE'`).

### 2.3 Mechanics 2: Trench / Structure Ambushes

1. **Designated Trigger Points & Concealment**:
   - Positioned at authentic stage structure coordinates:
     - **Bunker 1 Ambush**: Minion concealed atop or behind Concrete Bunker 1 ($X \approx 340, Y \approx 160$ or $192$).
     - **Bridge 2 Trench Ambush**: Minion concealed on Elevated Bridge 2 ($X \approx 1380, Y \approx 165$).
     - **Defense Redoubt 2 Ambush**: Minion concealed behind sandbags/bunker at $X \approx 1700$.
2. **Leap-Out Ballistic Arc**:
   - When player approaches (e.g. within 200px) or trigger activates:
     - Minion springs from cover with explosive leap impulses:
       - $v_x \ne 0$: $v_x = -130\text{ px/s}$ (leaping toward player) or $+130\text{ px/s}$.
       - $v_y < 0$: $v_y = -220\text{ px/s}$ (launching upward over trench/sandbag rim).
   - Gravity acceleration: $g = 720\text{ px/s}^2$.
   - Kinematics equations:
     $$v_y(t) = -220 + 720 t$$
     $$y(t) = y_0 - 220 t + 360 t^2$$
     - Apex time: $t_{\text{apex}} = \frac{220}{720} \approx 0.305\text{ s}$.
     - Maximum jump height above launch: $h = \frac{220^2}{2 \times 720} \approx 33.6\text{ px}$.
     - Total flight time: $t_{\text{flight}} \approx 0.61\text{ s}$.
     - Horizontal distance traveled: $\Delta X \approx 79.3\text{ px}$.
3. **Landing & Combat Transition**:
   - Soldier lands via standard platform collision at $Y = 230$ ($y = 192$).
   - Brief recovery: `'LAND_RECOVERY'` (0.15s).
   - Immediate aggressive combat transition:
     - Knife Charger transitions into `'SPRINT'` (speed 170 px/s) to lunge at the player.
     - Rifleman transitions to `'ALERT'` $\to$ `'AIM'`.
     - Shield Trooper raises frontal shield in `'GUARD_ADVANCE'`.

---

## 3. Technical Implementation Specification

### 3.1 Type Definitions & Interfaces (`src/core/entities/enemies/EnemyTypes.ts`)

Add spawn behavior definitions and configuration interfaces:

```typescript
export type SoldierSpawnBehavior = 'INGRESS_WALK' | 'PARACHUTE_DROP' | 'STRUCTURE_AMBUSH';

export interface ParachuteConfig {
  descentSpeed?: number;    // Terminal descent velocity (default: 50 px/s, range: 40-60)
  swayAmplitude?: number;   // Horizontal sway amplitude (default: 18 px)
  swayFrequency?: number;   // Angular frequency (default: 3.0 rad/s)
  swayPhase?: number;       // Initial phase offset in radians (default: 0)
  anchorX?: number;         // Equilibrium X coordinate for sinusoidal oscillation
  targetGroundY?: number;   // Ground collision line (default: 230)
}

export interface AmbushConfig {
  leapVelocityX: number;    // Horizontal leap speed (e.g., -130 px/s)
  leapVelocityY: number;    // Upward launch impulse (e.g., -220 px/s)
  ambushOriginX?: number;
  ambushOriginY?: number;
}
```

### 3.2 Soldier State Machine & Kinematics (`src/core/entities/enemies/SoldierEnemy.ts`)

1. **Extend `SoldierConfig`**:
   ```typescript
   export interface SoldierConfig {
     patrolMinX?: number;
     patrolMaxX?: number;
     customHp?: number;
     walkSpeed?: number;
     cameraX?: number;
     isIngress?: boolean;
     spawnBehavior?: SoldierSpawnBehavior;
     parachuteConfig?: ParachuteConfig;
     ambushConfig?: AmbushConfig;
   }
   ```

2. **Internal Properties**:
   ```typescript
   public spawnBehavior: SoldierSpawnBehavior = 'INGRESS_WALK';
   public parachuteConfig?: ParachuteConfig;
   public ambushConfig?: AmbushConfig;
   public isParachuteActive: boolean = false;
   private parachuteTime: number = 0;
   ```

3. **Constructor Logic**:
   - When `config.spawnBehavior === 'PARACHUTE_DROP'`:
     - `this.state = 'PARACHUTE_DESCENT'`
     - `this.spawnBehavior = 'PARACHUTE_DROP'`
     - `this.isParachuteActive = true`
     - `this.isGrounded = false`
     - `this.velocity.y = config.parachuteConfig?.descentSpeed ?? 50`
     - `this.parachuteConfig = { anchorX: this.position.x, ...config.parachuteConfig }`
   - When `config.spawnBehavior === 'STRUCTURE_AMBUSH'`:
     - `this.state = 'AMBUSH_LEAP'`
     - `this.spawnBehavior = 'STRUCTURE_AMBUSH'`
     - `this.isGrounded = false`
     - `this.velocity.x = config.ambushConfig?.leapVelocityX ?? -130`
     - `this.velocity.y = config.ambushConfig?.leapVelocityY ?? -220`
     - `this.facing = this.velocity.x >= 0 ? 1 : -1`

4. **Update & Aerodynamics Loop in `update()` and `applyPhysics()`**:
   ```typescript
   // In update():
   if (this.state === 'PARACHUTE_DESCENT') {
     this.updateParachuteAI(dt, engine);
   } else if (this.state === 'PARACHUTE_LANDING') {
     this.updateParachuteLandingAI(dt);
   } else if (this.state === 'AMBUSH_LEAP') {
     this.updateAmbushLeapAI(dt, engine);
   } else if (this.state === 'INGRESS') {
     this.updateIngressAI(dt, engine);
   } else {
     // Normal role AI (RIFLE, KNIFE, GRENADE, SHIELD)
   }

   // Parachute physics method:
   private updateParachuteAI(dt: number, engine?: GameEngine): void {
     this.parachuteTime += dt;
     const cfg = this.parachuteConfig ?? {};
     const descentSpeed = cfg.descentSpeed ?? 50;
     const amplitude = cfg.swayAmplitude ?? 18;
     const freq = cfg.swayFrequency ?? 3.0;
     const phase = cfg.swayPhase ?? 0;
     const anchorX = cfg.anchorX ?? this.position.x;
     const targetGroundY = cfg.targetGroundY ?? 230;

     // Horizontal sway integration
     this.position.x = anchorX + amplitude * Math.sin(freq * this.parachuteTime + phase);
     this.velocity.x = amplitude * freq * Math.cos(freq * this.parachuteTime + phase);
     this.velocity.y = descentSpeed;
     this.position.y += this.velocity.y * dt;

     // Check touchdown
     if (this.position.y + this.height >= targetGroundY) {
       this.position.y = targetGroundY - this.height;
       this.velocity.x = 0;
       this.velocity.y = 0;
       this.isGrounded = true;
       this.isParachuteActive = false;
       this.transitionTo('PARACHUTE_LANDING');

       if (engine) {
         engine.eventBus.emit('enemy_parachute_landed', {
           id: this.id,
           position: { x: this.position.x, y: this.position.y },
         });
       }
     }
   }

   private updateParachuteLandingAI(_dt: number): void {
     this.velocity.x = 0;
     this.velocity.y = 0;
     if (this.stateTimer >= 0.25) {
       // Transition to alert combat AI facing player
       if (this.targetPlayer) {
         this.facing = this.targetPlayer.position.x >= this.position.x ? 1 : -1;
       }
       this.transitionToNormalRoleAI();
     }
   }

   private updateAmbushLeapAI(_dt: number, _engine?: GameEngine): void {
     if (this.isGrounded && this.stateTimer > 0.08) {
       this.velocity.x = 0;
       this.transitionTo('LAND_RECOVERY');
     }
   }
   ```

5. **Gravity Bypass in `applyPhysics`**:
   ```typescript
   private applyPhysics(dt: number, engine?: GameEngine): void {
     // Parachute descent bypasses standard gravity
     if (this.state === 'PARACHUTE_DESCENT') {
       this.bounds.x = this.position.x;
       this.bounds.y = this.position.y;
       return;
     }

     // Normal Newtonian gravity + platform collision
     const prevFootY = this.position.y + this.height;
     if (!this.isGrounded) {
       this.velocity.y += this.gravity * dt;
     }
     this.position.x += this.velocity.x * dt;
     this.position.y += this.velocity.y * dt;
     ...
   ```

6. **Convenience Factory Methods**:
   ```typescript
   static createParatrooper(
     id: string,
     type: EnemyType,
     spawnPos: Vector2D,
     config?: ParachuteConfig & Partial<SoldierConfig>
   ): SoldierEnemy {
     return new SoldierEnemy(id, type, spawnPos, {
       ...config,
       spawnBehavior: 'PARACHUTE_DROP',
       parachuteConfig: { anchorX: spawnPos.x, ...config },
     });
   }

   static createAmbushSoldier(
     id: string,
     type: EnemyType,
     spawnPos: Vector2D,
     leapVelocity: Vector2D,
     config?: Partial<SoldierConfig>
   ): SoldierEnemy {
     return new SoldierEnemy(id, type, spawnPos, {
       ...config,
       spawnBehavior: 'STRUCTURE_AMBUSH',
       ambushConfig: {
         leapVelocityX: leapVelocity.x,
         leapVelocityY: leapVelocity.y,
       },
     });
   }
   ```

### 3.3 Visual Presentation & Sprite Rendering (`CanvasRenderer.ts` & `ProceduralSpriteFactory.ts`)

1. **Sprite Generation (`ProceduralSpriteFactory.ts`)**:
   Register authentic 16-color parachute canopy sprite:
   - Key: `'parachute_canopy'`
   - Width: 48px, Height: 28px, AnchorX: 24, AnchorY: 28
   - Palette: Authentic military olive `#4A6038`, khaki `#7A8B58`, deep shadow `#2C3A20`, highlight `#9AB070`, and white rebel emblem `#FFFFFF`.
   - 5-panel curved dome with scalloped hem and harness attachment grommets.
2. **Canvas Rendering (`CanvasRenderer.ts`)**:
   - In `RenderEnemyState`, forward `isParachuteActive?: boolean` and `parachuteSwayAngle?: number`.
   - When `enemy.isParachuteActive` or `enemy.state === 'PARACHUTE_DESCENT'`:
     - Draw 4 suspension riser cords from soldier shoulders `(screen.x, screen.y - 24)` to canopy grommets `(screen.x - 20, screen.x - 7, screen.x + 7, screen.x + 20, screen.y - 48)`.
     - Draw canopy sprite with aerodynamic tilt `rotation = Math.max(-0.25, Math.min(0.25, enemy.velocity.x * 0.004))`.
   - On detachment, track floating canopy in `activeParachutes: RenderParachuteState[]` fading and drifting over 1.5s.

### 3.4 Level Layout Integration (`src/main.ts`)

Stage 1 encounter enhancement:
- **Trigger Wave 1** ($X = 180$):
  - 1 Airborne Paratrooper Rifleman: spawns at $X = 380, Y = 10$, drops with $v_y = 50$, sways $A = 18\text{ px}$.
  - 1 Walk-In Knife Charger: runs in from right edge ($X = \text{cameraX} + 520$).
- **Trigger Bunker 1 Ambush** ($X = 300$):
  - 1 Ambush Grenadier: leaps out from Concrete Bunker 1 platform ($X = 340, Y = 160$) with $v_x = -120, v_y = -220$.
- **Trigger Wave 2** ($X = 420$):
  - 1 Airborne Paratrooper Grenadier ($X = 580, Y = 5$).
  - 1 Ground Shield Trooper ($X = \text{cameraX} + 520, Y = 192$).
  - 1 Ground Rifleman ($X = \text{cameraX} + 560, Y = 192$).
- **Trigger Bridge 2 Ambush** ($X = 1280$):
  - 1 Ambush Knife Charger: vaults off elevated Bridge 2 ($X = 1380, Y = 165$) with $v_x = -140, v_y = -190$.
- **Trigger Wave 3** ($X = 1340$):
  - 2 Airborne Paratroopers (Rifleman + Knife Charger) dropping in echelon from high altitude ($Y = 0$ and $Y = -20$) with staggered sway phases ($\phi = 0$ and $\phi = \pi/2$).

---

## 4. Caveats

1. **Strictness of Pre-existing Invariant Tests**:
   - `spawning_contract.test.ts` and `empirical_physics_spawning_challenge.test.ts` contain tests that loop across *all* triggers of `stage1Data` and assert $X \ge \text{cameraX} + 480$ and $Y = 192$.
   - These tests represent the previous sprint's constraint ("no popping, only off-screen walk-in").
   - The implementer must either:
     - Keep `buildStage1Data()` parameterizable (defaulting to classic for those tests, or activating diverse in the main game), OR
     - Upgrade those specific assertions in the test files to align with the new R1 requirement ("Automated tests must verify diverse behaviors rather than a simple off-screen X check").
2. **Offscreen Culling Margin**:
   - `StageManager.despawnOffscreenEntities` culls minions at $Y > 320$. Airborne drops spawn at $Y < 50$, which is well above the culling threshold ($Y > 320$) and within the vertical boundary ($Y \ge -50$). However, if a drop is spawned at $Y < -100$, ensure it is not culled prematurely. Recommended spawn range is $Y \in [-30, 30]$.
3. **No External Asset Dependencies**:
   - Per project rules, all sprites must be generated procedurally via `ProceduralSpriteFactory.ts`. No external PNG/GIF assets are permitted.

---

## 5. Conclusion

1. **Feasibility**: High. The existing decoupled architecture (`GameEngine`, `PlatformPhysics`, `SoldierEnemy`, `CanvasRenderer`) cleanly supports diverse spawning without structural redesign.
2. **Key Technical Mechanism**:
   - Aerodynamic drag overrides gravity in `SoldierEnemy.applyPhysics()` when `state === 'PARACHUTE_DESCENT'`.
   - Sinusoidal sway is computed via $X(t) = X_{\text{anchor}} + A \sin(\omega t + \phi)$.
   - Ballistic ambush leap utilizes existing platform physics with initial impulse ($v_x \ne 0, v_y < 0$).
3. **Zero-Regression Path**:
   - Implement parameterizable stage triggers (`spawnMode: 'classic' | 'diverse'`) and/or update the old M2 tests to validate diverse behavior, ensuring `npx vitest run` maintains 100% green status.
4. **Actionable Deliverables for Implementer**:
   - Target files: `src/core/entities/enemies/EnemyTypes.ts`, `src/core/entities/enemies/SoldierEnemy.ts`, `src/core/engine/StageManager.ts`, `src/main.ts`, `src/render/CanvasRenderer.ts`, `src/render/sprites/ProceduralSpriteFactory.ts`.
   - New unit test file: `tests/unit/diverse_spawning.test.ts`.

---

## 6. Verification Method

To independently verify the implementation:

1. **TypeScript Build Compilation**:
   ```bash
   npm run build
   ```
   *Pass Condition*: Zero type errors, clean Vite production bundle in `dist/`.

2. **Automated Unit Test Suite**:
   ```bash
   npx vitest run
   ```
   *Pass Condition*: 100% test pass rate across all existing unit tests and new diverse spawning unit tests (`tests/unit/diverse_spawning.test.ts`).

3. **Dedicated Diverse Spawning Assertions**:
   - Assert initial paratrooper position: `expect(soldier.position.y).toBeLessThan(50)`.
   - Assert descent velocity: `expect(soldier.velocity.y).toBeGreaterThanOrEqual(40)` and `expect(soldier.velocity.y).toBeLessThanOrEqual(60)`.
   - Assert sinusoidal sway: across 60 frames, `expect(Math.max(...xHistory) - Math.min(...xHistory)).toBeGreaterThanOrEqual(30)`.
   - Assert touchdown: at $t \approx 3.6\text{s}$, `expect(soldier.position.y).toBe(192)`, `expect(soldier.isGrounded).toBe(true)`, `expect(soldier.isParachuteActive).toBe(false)`.
   - Assert ambush leap: `expect(soldier.velocity.y).toBeLessThan(0)` and `expect(soldier.velocity.x).not.toBe(0)`.

4. **Playwright E2E Visual Verification**:
   ```bash
   npx playwright test tests/e2e/spawning_and_deaths.spec.ts
   ```
   *Pass Condition*: Browser loads game, advances camera to trigger coordinates, captures screenshots of descending parachute and landing recovery into `artifacts/screenshots/`.
