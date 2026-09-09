# Empirical Challenger Audit Report: Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX)

## Verdict: APPROVE

---

## 1. Observation
- **Direct Observations of Implementation**:
  - `src/core/player/UltimateManager.ts`:
    - Implements the 4-phase cinematic state machine: `FREEZE` (0.5s), `STRIKE_PASS` (0.6s), `DETONATION` (0.4s), `RECOVERY` (0.3s) returning to `IDLE` (lines 50-68, 153-202).
    - Stock management: `initialStock = 1`, `maxStock = 3`. `canTrigger()` strictly enforces `!this.isActive && this.stock > 0` (lines 95-97, 104-106).
    - Friendly safety filter (lines 223-237):
      ```ts
      if (
        ent.id === 'player' ||
        ent.type === 'PLAYER' ||
        ent instanceof PlayerController ||
        ent.type === 'ALLY_NPC' ||
        ent.type === 'ALLY_PROJECTILE' ||
        ent instanceof AllyNPC ||
        ent instanceof AllyKiBlast ||
        ent.type === 'POW' ||
        ent instanceof PowEntity ||
        ent.type === 'ITEM_PICKUP'
      ) {
        continue;
      }
      ```
    - Viewport boundary intersection filter (lines 239-242):
      ```ts
      if (!BoundingBox.intersects(ent.bounds, viewport)) {
        continue;
      }
      ```
    - Hostile projectile removal (lines 245-259): `ENEMY_BULLET`, `ENEMY_GRENADE`, `CANNON_SHELL`, `ARTILLERY_SHELL`, `HOMING_MISSILE` set `isAlive = false` and removed from engine.
    - Boss burst damage (lines 262-280): Deals `this.bossDamage` (120 HP) to `IronNokanaBoss`, `TetsuyukiBoss`, `MidBossVehicle`, or any entity with `type.includes('BOSS')`.
    - Minion screen-clearing (lines 283-300): Deals 999 lethal explosion damage, setting `health = 0` and `isAlive = false`.
  - `src/input/KeyboardController.ts`:
    - Line 60: `KeyU` / `'u'` mapped to `ultimate`.
    - Line 56: `KeyX` / `'x'` strictly preserved for `jump`.
  - `src/render/sprites/ProceduralSpriteFactory.ts`:
    - 41 expansion sprites isolated in `expansionKeys: Set<string>`.
    - `getAllKeys(false, false)` returns exactly 164 keys, preserving the baseline invariant.

- **Empirical Challenge Results**:
  - Implemented and executed dedicated adversarial test suite `tests/unit/adversarial_ultimate_challenge.test.ts` (17 tests):
    1. *Viewport Boundary Edge Cases*:
       - Minion at `cameraX + 479` (`x = 479`, width 24, bounds `[479, 503]`): `479 < 480` -> intersects viewport, eliminated (`isAlive === false`, `health === 0`).
       - Minion at `cameraX + 481` (`x = 481`, width 24, bounds `[481, 505]`): `481 < 480` is FALSE -> outside viewport, strictly preserved (`isAlive === true`, `health === maxHealth`).
       - Minion at `cameraX + 480` (exact boundary): preserved (`isAlive === true`).
       - Scrolling camera test at `cameraX = 250`: minion at `cameraX + 479 = 729` eliminated; minion at `cameraX + 481 = 731` strictly preserved.
       - Left boundary edge test at `cameraX = 200`: minion at `cameraX - 23` eliminated (overlaps left edge); minion at `cameraX - 25` strictly preserved (outside left edge).
    2. *Stock Limits & Spam / Double-Tap Rejection*:
       - Activation with 0 stock rejected immediately (`canTrigger() === false`, `trigger()` returns `false`, `stock === 0`, `phase === IDLE`, zero events emitted).
       - `PlayerController.handleInput` ignores `ultimatePressed` when stock is 0.
       - Rapid double-tap KeyU during `FREEZE` phase rejected: stock remains 2, zero duplicate freeze events, 10 consecutive spams rejected.
       - Rapid KeyU during `STRIKE_PASS`, `DETONATION`, and `RECOVERY` phases strictly rejected without decrementing stock or resetting state.
    3. *Friendly Safety at Detonation Epicenter*:
       - Player at epicenter `(240, 135)` with 1 HP and 2 shield charges takes 0 damage (`health === 1.0`, `shieldCharges === 2`, `isAlive === true`).
       - Ally NPC (`AllyNPC`, Hyakutaro Ichimonji) at epicenter takes 0 damage (`isAlive === true`).
       - Ally projectile (`AllyKiBlast`) at epicenter is preserved (`isAlive === true`).
       - POW Hostage (`PowEntity`, tied up) at epicenter takes 0 damage (`isAlive === true`, state remains `TIED_UP`).
       - POW Hostage (`PowEntity`, freed) at epicenter takes 0 damage (`isAlive === true`).
       - Hostile minions, enemy bullets, and artillery shells at the exact same epicenter are 100% destroyed and removed from engine.
    4. *Boss Burst Damage & Phase Integrity*:
       - `IronNokanaBoss` (Max HP 400, Gate 1 at 300 HP): 120 damage applied; health clamped to 300 HP (75% gate), cleanly triggering `PHASE_2_FLAME_SWEEP`.
       - Multi-strike sequence through all 4 phases: Strike 1 (400 -> 300 HP, Phase 2), Strike 2 (300 -> 200 HP, Phase 3), Strike 3 (200 -> 100 HP, Phase 4 Rage), Strike 4 (100 -> 0 HP, `DEATH_EXPLODING`).
       - `CrisisEventManager` coordinates seamlessly: 75% artillery bombardment triggers at 300 HP without prematurely firing 50% terrain collapse or 25% rage overdrive.
       - `TetsuyukiBoss` absorbs 120 burst damage correctly: 400 -> 280 -> 260 Phase 2.
       - `MidBossVehicle` absorbs 120 burst damage with Gate 1 preservation: 400 -> 280 -> 240 Gate 1 transition.
       - Simultaneous detonation: clears 100% of minions (`minionsCleared === 3`) while dealing exactly 120 burst damage to the boss (`bossesHit === 1`, `bossDamageDealt === 120`).

- **Project-Wide Build and Test Telemetry**:
  - `npx vitest run tests/unit/adversarial_ultimate_challenge.test.ts`:
    `✓ tests/unit/adversarial_ultimate_challenge.test.ts (17 tests) 67ms` (100% pass)
  - `npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts`:
    `✓ tests/unit/adversarial_sprites_crosshairs.test.ts (17 tests) 71ms` (100% pass, exactly 164 baseline keys verified)
  - `npx vitest run tests/unit/adversarial_controls_jump.test.ts`:
    `✓ tests/unit/adversarial_controls_jump.test.ts (21 tests) 338ms` (100% pass, KeyX jump intact)
  - Full project test suite (`npx vitest run`):
    `Test Files  34 passed (34)`
    `Tests  450 passed (450)`
    `Duration  3.18s`
  - TypeScript typecheck (`npx tsc -b`): exited with code 0 (zero errors).
  - Production build (`npm run build`): built in 292ms, exited with code 0 (zero errors).

---

## 2. Logic Chain
1. *Observation*: The user prompt required an adversarial challenge of the Ultimate Move system across 4 focus areas: viewport boundary edge cases (`cameraX + 479` vs `cameraX + 481`), stock limits / double-tap rejection, friendly safety at epicenter, and boss burst damage without phase corruption.
2. *Deduction*: Testing these mechanics requires writing an empirical test suite that places entities at precise boundary coordinates, tests rapid keypress intervals across all 4 phases, places friendlies at the epicenter, and verifies boss phase gates under single and sequential 120 HP bursts.
3. *Observation*: Executing `tests/unit/adversarial_ultimate_challenge.test.ts` confirms:
   - Boundary checks at `cameraX + 479` eliminate the minion, while `cameraX + 481` and `cameraX + 480` preserve the minion (matches AABB intersection formula `a.x < b.x + b.width`).
   - Triggering with 0 stock fails, and spamming KeyU during `FREEZE`, `STRIKE_PASS`, `DETONATION`, and `RECOVERY` is rejected without consuming stock or resetting state.
   - Player, Ally NPC, AllyKiBlast, and POW entities take zero damage even when positioned at the detonation epicenter.
   - Iron Nokana, Tetsuyuki, and MidBoss vehicles take 120 damage and clamp cleanly to their respective health gates without phase skips or corrupted states.
4. *Observation*: Executing `npm run build`, `npx tsc -b`, and `npx vitest run` produces 0 type errors, 0 build errors, and 450 passing tests across all 34 test suites.
5. *Conclusion*: Milestone M3 implementation is robust, adheres to all architectural invariants, and meets all acceptance criteria.

---

## 3. Caveats
- No caveats. All 4 challenge foci were empirically verified using automated test harnesses executed directly against the simulation engine.

---

## 4. Conclusion
**VERDICT: APPROVE**
The Ultimate Move system (`UltimateManager.ts`), KeyU input mapping, baseline 164 sprite invariant, viewport culling geometry, friendly fire immunity, and boss burst damage phase preservation have passed all adversarial stress-tests with 100% empirical pass rates and zero regressions.

---

## 5. Verification Method
To independently verify:
```bash
# 1. Typecheck
npx tsc -b

# 2. Production build
npm run build

# 3. Targeted adversarial challenge suite (17 tests)
npx vitest run tests/unit/adversarial_ultimate_challenge.test.ts

# 4. Sprite invariant verification (164 keys)
npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts

# 5. Full test suite (34 files, 450 tests)
npx vitest run
```

Invalidation conditions:
- Any test failure in `tests/unit/adversarial_ultimate_challenge.test.ts`
- Any test failure in `tests/unit/ultimate_move_system.test.ts`
- `adversarial_sprites_crosshairs.test.ts` failing with != 164 keys
- Any TypeScript error under `npx tsc -b`
