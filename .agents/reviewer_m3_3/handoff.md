# Quality Review & Adversarial Challenge Report: Milestone M3 Iteration 2 (Ultimate Move System & Procedural Sprites / Cinematic FX)

## Review Summary
- **Verdict**: **APPROVE**
- **Integrity Assessment**: **NO INTEGRITY VIOLATIONS DETECTED**
  - No hardcoded test results or expected values in implementation code.
  - No dummy/facade implementations (state machine, detonation math, projectile culling, procedural audio, and canvas rendering are genuine).
  - No bypassed tasks or shortcut delegations.
  - All test commands independently executed and confirmed 100% green.

---

## 1. Observation

### 1.1 Direct Inspection of the 4 Integration Fixes

1. **Fix 1: KeyU Input Forwarding in `src/main.ts`**:
   - Location: `src/main.ts:247-258`
   - Verbatim Code:
     ```ts
     const input: PlayerInputSnapshot = {
       left: kbSnap.left || touchSnap.left,
       right: kbSnap.right || touchSnap.right,
       up: kbSnap.up || touchSnap.up,
       down: kbSnap.down || touchSnap.down,
       jumpPressed: kbSnap.jumpPressed || touchSnap.jumpPressed,
       jumpHeld: kbSnap.jumpHeld || touchSnap.jumpHeld,
       shootPressed: kbSnap.shootPressed || touchSnap.shootPressed,
       shootHeld: kbSnap.shootHeld || touchSnap.shootHeld,
       grenadePressed: kbSnap.grenadePressed || touchSnap.grenadePressed,
       ultimatePressed: kbSnap.ultimatePressed,
     };
     ```
   - Observed: `ultimatePressed: kbSnap.ultimatePressed` is explicitly assigned, ensuring `player.handleInput(input, dt, this.engine)` receives the keypress when KeyU is struck.

2. **Fix 2: Viewport Detonation & `entitiesToAdd` Synchronization in `src/core/player/UltimateManager.ts`**:
   - Location: `src/core/player/UltimateManager.ts:300-368`
   - Verbatim Code:
     ```ts
     const entities = engine.getAllEntities();
     if (Array.isArray((engine as any).entitiesToAdd)) {
       for (const ent of (engine as any).entitiesToAdd) {
         if (!entities.some((e) => e.id === ent.id)) {
           entities.push(ent);
         }
       }
     }
     ```
   - Hostile projectile culling and removal from both `engine` and `entitiesToAdd`:
     ```ts
     if (
       ent.type === 'ENEMY_BULLET' ||
       ent.type === 'ENEMY_GRENADE' ||
       ent.type === 'CANNON_SHELL' ||
       ent.type === 'ARTILLERY_SHELL' ||
       ent.type === 'HOMING_MISSILE'
     ) {
       ent.isAlive = false;
       engine.removeEntity(ent.id);
       if ((engine as any).entities instanceof Map) {
         (engine as any).entities.delete(ent.id);
       }
       if (Array.isArray((engine as any).entitiesToAdd)) {
         const idx = (engine as any).entitiesToAdd.findIndex((e: any) => e.id === ent.id);
         if (idx !== -1) {
           (engine as any).entitiesToAdd.splice(idx, 1);
         }
       }
       culledProjectiles++;
       continue;
     }
     ```
   - `cameraShakeOffset` getter:
     ```ts
     public get cameraShakeOffset(): { x: number; y: number } {
       if (this.phase === UltimatePhase.DETONATION) {
         const progress = Math.min(
           1.0,
           Math.max(0.0, 1.0 - this.phaseTimer / this.detonationDuration)
         );
         const intensity = Math.max(0, 18 * (1.0 - progress));
         return {
           x: Math.sin(this.totalTime * 60) * intensity,
           y: Math.cos(this.totalTime * 50) * intensity,
         };
       }
       return { x: 0, y: 0 };
     }
     ```

3. **Fix 3: Presentation Pass Wiring in `src/main.ts`**:
   - Location: `src/main.ts:470-484` (`buildRenderSceneState()`)
   - Verbatim Code:
     ```ts
     return {
       time: this.elapsedTime,
       camera: this.camera,
       platforms: this.stageManager.getPlatforms(),
       player: playerRenderState,
       enemies: enemyStates,
       corpses: this.corpseManager.getRenderStates(),
       boss: bossState,
       pows: powStates,
       projectiles: projectileStates,
       explosions: this.activeExplosions,
       hud: hudState,
       cinematicFX: this.player.ultimateManager?.getCinematicState(),
     };
     ```
   - Observed: `this.player.ultimateManager?.getCinematicState()` is forwarded into `scene.cinematicFX`, which triggers `CanvasRenderer.renderCinematicFXPass(scene.cinematicFX, cam, time)` during active ultimate phases.

4. **Fix 4: Sound Event Routing in `src/main.ts`**:
   - Location: `src/main.ts:565-577` (`setupAudioAndEventBus()`)
   - Verbatim Code:
     ```ts
     case 'sfx_air_raid_siren':
     case 'sfx_ultimate_siren':
       this.soundEngine.playUltimateSiren();
       break;
     case 'sfx_bomber_flyover':
     case 'sfx_flyover_roar':
       this.soundEngine.playFlyoverRoar();
       break;
     case 'sfx_heavy_detonation':
     case 'sfx_apocalyptic_blast':
       this.soundEngine.playApocalypticBlast();
       break;
     ```
   - Observed: Events dispatched by `UltimateManager` are correctly captured and dispatched to `SoundEngine`.

---

### 1.2 Independent Tool Execution Results

1. **TypeScript Compilation**:
   - Command: `npx tsc -b`
   - Exit Code: `0`
   - Errors: `0`

2. **Targeted Vitest Suites**:
   - Command: `npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts`
   - Exit Code: `0`
   - Results: `3 test files passed (3)`, `64 tests passed (64)`, `0 failed`
     - `ultimate_move_system.test.ts`: 28 passed
     - `adversarial_ultimate_challenge.test.ts`: 17 passed
     - `adversarial_m3_challenger_stress.test.ts`: 19 passed

3. **Full Vitest Test Suite (Regression Verification)**:
   - Command: `npx vitest run`
   - Exit Code: `0`
   - Results: `34 test files passed (34)`, `453 tests passed (453)`, `0 failed`
   - Highlights:
     - Spawning contracts intact (X >= cameraX + 480)
     - 60-second headless simulation (3,600 ticks @ 60Hz) passed with 0 NaN, 0 exceptions
     - Jump kinematics & monotonic parabolic arcs 100% green
     - All prior M1 and M2 tests passed without regression

4. **Sprite Engine Baseline Invariant**:
   - Command: `npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts`
   - Exit Code: `0`
   - Results: `17 tests passed (17)`
   - Breakdown: exactly 164 baseline keys (player: 67, rebel: 21, pow: 9, ironTechnical: 7, tetsuyuki: 8, projectile: 13, casings: 4, explosions: 18, hud: 17 = 164).

5. **Production Build**:
   - Command: `npm run build`
   - Exit Code: `0`
   - Output: `dist/index.html (1.26 kB)`, `dist/assets/index-DPtp5WSx.js (247.45 kB)`
   - Transformation: 41 modules cleanly compiled and bundled in 7.74s.

---

## 2. Logic Chain

1. *Observation*: Milestone M3 requires an operational Ultimate Move system triggered on KeyU, complete with 4-phase cinematic timing, 100% on-screen minion elimination, 120 boss burst damage, hostile projectile culling, presentation rendering, and audio routing.
2. *Observation*: Reviewer 1 previously flagged 4 specific defects: dropped KeyU input in `src/main.ts`, omission of `entitiesToAdd` in `UltimateManager.executeDetonation()`, disconnected `cinematicFX` in `buildRenderSceneState()`, and missing audio event routing in `setupAudioAndEventBus()`.
3. *Observation*: Inspection of `src/main.ts` confirms lines 257, 482, and 565-577 implement the exact missing bindings.
4. *Observation*: Inspection of `UltimateManager.ts` lines 314-368 confirms that `(engine as any).entitiesToAdd` is merged into candidate entities, hostile projectiles are culled from both `engine.entities` and `engine.entitiesToAdd`, and `cameraShakeOffset` is properly computed and decayed.
5. *Observation*: Direct execution of the test suite demonstrates that the 9 previous test failures in `adversarial_ultimate_challenge.test.ts` and `adversarial_m3_challenger_stress.test.ts` are resolved, and the entire test suite passes (34 files, 453 tests).
6. *Observation*: Production build (`npm run build`) and type checking (`npx tsc -b`) pass with zero errors or warnings.
7. *Deduction*: The implementation satisfies all functional and non-functional requirements without regressions or integrity violations.
8. *Conclusion*: Milestone M3 Iteration 2 is complete and verified. The milestone is approved to proceed to Milestone M4 (Playwright E2E browser verification and visual proof capture).

---

## 3. Adversarial Challenges & Stress Testing

### Challenge 1: Un-ticked Minions and Projectiles in Frame of Detonation
- **Attack Scenario**: Enemies or bullets spawned in the current simulation frame reside in `entitiesToAdd` and have not yet migrated into `engine.entities`.
- **Stress Result**: Test `EMPIRICAL 3H` explicitly places a soldier and an enemy bullet in `engine.addEntity()` without ticking the engine. During detonation, `pendingMinion.isAlive` was set to false (`health = 0`), and `pendingBullet` was culled and spliced out of `entitiesToAdd`.
- **Verdict**: PASS.

### Challenge 2: Rapid/Mashed Keypresses of KeyU
- **Attack Scenario**: Player spams KeyU during cinematic phases or with 0 stocks.
- **Stress Result**: `canTrigger()` verifies `!this.isActive && this.stock > 0`. Mashing KeyU during `FREEZE`, `STRIKE_PASS`, `DETONATION`, or `RECOVERY` returns `false` without side effects or double-decrementing stock.
- **Verdict**: PASS.

### Challenge 3: Spatial Filtering (Viewport Bounding Box)
- **Attack Scenario**: Enemies positioned off-screen (e.g., waiting at X = 700 while camera is at X = 0) could accidentally be wiped by the ultimate move.
- **Stress Result**: `BoundingBox.intersects(ent.bounds, viewport)` checks bounding box against `[camX, 0, 480, 270]`. Off-screen entities are safely skipped, maintaining stage progression balance.
- **Verdict**: PASS.

### Challenge 4: Friendly Fire Immunity
- **Attack Scenario**: High explosive density damaging Player, Ally NPCs, Ki Blasts, or Hostages (POWs).
- **Stress Result**: Whitelist checks `PLAYER`, `ALLY_NPC`, `ALLY_PROJECTILE`, `POW`, and `ITEM_PICKUP`. Test `EMPIRICAL 3D` verified that with player, ally, ki blast, and POW inside the detonation radius, all 4 entities maintain full health and remain alive.
- **Verdict**: PASS.

---

## 4. Caveats
- Web Audio synthesis in headless environments (e.g., automated CI / Node test runners) safely skips hardware playback via `if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;`. Full audio playback is active in interactive browser runtimes.
- No other caveats or uninvestigated areas.

---

## 5. Conclusion
All 4 integration defects identified in the first review iteration have been thoroughly resolved. Code quality, architecture decoupling, baseline sprite invariants (164 keys), audio synthesis, and headless physics execution are in complete alignment with `PROJECT.md` and `COLLABORATION.md`.

**Verdict: APPROVE**

---

## 6. Verification Method
To reproduce this verification:
```bash
# 1. Typecheck
npx tsc -b

# 2. Targeted Ultimate Move and Adversarial Suites (64 tests)
npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts

# 3. Sprite Engine Invariant (164 keys)
npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts

# 4. Full Project Suite (34 files, 453 tests)
npx vitest run

# 5. Production Build
npm run build
```
Invalidation conditions:
- Any TypeScript error under `npx tsc -b`
- Any test failure across the 34 Vitest test files
- Any failure during `npm run build`
- Any mutation of baseline sprite keys away from 164
