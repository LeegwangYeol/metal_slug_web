# E2E & Unit Test Infra: Metal Slug Web (Full Metal Slug)

## Test Philosophy
- Opaque-box, requirement-driven testing derived from `ORIGINAL_REQUEST.md` and `COLLABORATION.md`.
- Decoupled headless testing in pure Node.js via Vitest (zero DOM dependency for `src/core/`).
- Full-stack browser integration testing via Playwright (verifying canvas context, 60fps loop, and zero fatal console errors).
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise + Real-World Workload Testing.

---

## Feature Inventory & Test Coverage Mapping

| # | Feature | Requirements Source | Tier 1 (Isolated) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (E2E Scenario) |
|---|---------|---------------------|:-----------------:|:-----------------:|:-----------------:|:---------------------:|
| 1 | Handgun Firing & Ammo | R2 (Handgun) | 5 tests | 5 tests | ✓ | ✓ |
| 2 | Heavy Machine Gun (HMG) | R2 (HMG 200 ammo, spray) | 5 tests | 5 tests | ✓ | ✓ |
| 3 | Flame Shot | R2 (Flame pierce, AOE) | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Grenade Toss & Bounce | R2 (Grenade physics) | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Ammo Depletion & Fallback | R2 (Auto fallback) | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Hostage POW Rescue Pipeline | R2 (POW loot drops) | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Melee vs Ranged Arbitration | R1 (Knife 38px reach) | 5 tests | 5 tests | ✓ | ✓ |
| 8 | 8-Way Aiming Vectors | R1 (8 directions) | 5 tests | 5 tests | ✓ | ✓ |
| 9 | Player Kinematics & Platforms | R1 (Jump, gravity, drop) | 5 tests | 5 tests | ✓ | ✓ |
| 10 | Rebel Infantry AI States | R3 (4 infantry roles) | 5 tests | 5 tests | ✓ | ✓ |
| 11 | Mid-Boss Armored Vehicle | R3 (Turret, troop spawn) | 5 tests | 5 tests | ✓ | ✓ |
| 12 | Tetsuyuki Boss Phases 1-3 | R3 (Multi-phase fortress) | 5 tests | 5 tests | ✓ | ✓ |
| 13 | Browser Canvas & 60fps Loop | R5 (Headless E2E) | 5 tests | 5 tests | ✓ | ✓ |

---

## Test Architecture
1. **Unit Test Runner**:
   - Tool: `vitest run`
   - Config: `vitest.config.ts` (`environment: 'node'`)
   - Test files:
     - `tests/unit/player_weapon_state.test.ts` (Handgun, HMG, FlameShot, Grenade, Ammo Fallback, POWs)
     - `tests/unit/enemy_boss_statemachine.test.ts` (Rebel infantry, Mid-boss vehicle, Tetsuyuki 3-phase fortress)
     - `tests/unit/melee_ranged_decision.test.ts` (Proximity detection, knife slash priority, vehicle rejection)
2. **Integration / E2E Test Runner**:
   - Tool: `npx playwright test`
   - Config: `playwright.config.ts`
   - Server: Vite preview (`http://localhost:4173`)
   - Test file:
     - `tests/e2e/game_initialization.spec.ts` (Validates headless browser boot, Canvas context creation, 60fps loop over 300 frames, zero fatal console errors)

---

## Real-World Application Scenarios (Tier 4)
1. **Full Stage 1 Walkthrough Scenario**: Player advances through soldier waves, executes melee knife slashes on infantry, collects HMG weapon crate, rescues POW, encounters Mid-Boss vehicle, transitions weapon to Flame Shot, and defeats Phase 1-3 Tetsuyuki Boss.
2. **Ammo Depletion Pressure Test**: Heavy weapon firing under continuous combat until ammo reaches 0, validating instant seamless fallback to default pistol with zero dropped frames or state corruption.
3. **Melee Proximity Stress Test**: Rapid alternations between close-quarters knife attack (<38px) and ranged pistol shot (>38px) against mixed enemy groups.
4. **Boss Phase Transition Integrity**: Continuous damage accumulation triggering Phase 1 -> Phase 2 -> Phase 3 -> Death exploding sequence without state desynchronization.
5. **Headless Browser 60 FPS Stability**: 300 continuous frames running in headless Chromium with `avgFps >= 58.0`, `droppedFrames <= 5`, and zero console errors.

---

## Coverage Thresholds
- Unit Tests: >= 40 individual test assertions across 3 unit test files.
- E2E Tests: Full automated headless browser run passing with exit code 0.
- All acceptance criteria verified.
