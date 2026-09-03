# Master Execution Plan: Metal Slug Web (Full Metal Slug)

## Objective
Build, verify, and deliver a complete, multi-stage web-based 2D run-and-gun action game inspired by Metal Slug with 100% automated test verification.

## Requirements Breakdown
- **R1. Core Game Mechanics & Engine**: 8-directional aiming, run/jump physics, crouch, semi-solid platforms, knife melee slash vs ranged shot dispatch.
- **R2. Weapon Upgrades & Combat**: Default handgun (infinite), Heavy Machine Gun (spray, ammo tracking), Flame Shot (piercing stream), Grenade toss, ammo depletion auto-fallback to handgun, POW hostage rescues with item drops.
- **R3. Enemies, Mid-Bosses, Bosses**: Rebel infantry (rifle, knife, grenade, shield), Mid-Boss armored vehicle, Stage 1 End-Boss (Tetsuyuki War Fortress with multi-phase mechanics, destructible turrets, weak points).
- **R4. Assets & Audio**: Procedural pixel-art sprite generation, Web Audio API sound effects, formant speech synthesis announcer clips.
- **R5. Testable Architecture**: Pure simulation in `src/core/` (zero DOM dependency, vitest unit tests), Canvas/WebGL renderer in `src/render/`, Playwright E2E integration test.

## Execution Phases

### Phase 0: Survey & Scope Mapping
- Dispatch 3 parallel Explorers / Spec Miners:
  1. `explorer_1`: Technical environment, package tooling, Vite + TypeScript setup, Vitest + Playwright capabilities.
  2. `spec_miner_2`: Game mechanics, 8-way aiming, state transitions, physics formulas, Metal Slug authentic timing/ranges.
  3. `spec_miner_3`: Weapon specifications, enemy AI state machines, boss phases, audio synthesis parameters.
- Synthesize findings into `PROJECT.md` (§ Architecture, Feature Inventory, Milestones, Interface Contracts, Code Layout).

### Phase 1: Dual Track Launch
- **Track A (Implementation)**:
  - Milestone 1: Project Scaffolding, Build Configuration, and Decoupled Core Simulation Engine (`src/core/engine`, `src/core/math`, `src/core/physics`).
  - Milestone 2: Player Controller, 8-Way Aiming, Melee vs Ranged Combat, Weapons System (Handgun, HMG, FlameShot, Grenades, POWs).
  - Milestone 3: Enemy State Machines, Infantry AI, Mid-Boss Vehicle, and Tetsuyuki End-Boss Multi-Phase Engine.
  - Milestone 4: Procedural Pixel-Art Generation & High-Performance 2D Canvas Renderer.
  - Milestone 5: Web Audio API Arcade Synthesizer & Speech Formant Announcer Engine.
  - Milestone 6: Full Integration & Polish.
- **Track B (Testing Track)**:
  - Milestone T1: Test Harness & Runner Setup (`vitest` + `playwright`).
  - Milestone T2: Unit Test Suite for Weapons, State Machines, and Melee Decision Logic.
  - Milestone T3: Headless Playwright E2E Integration Test Suite.
  - Publish `TEST_READY.md`.

### Phase 2: Final Verification & Hardening
- Run full Vitest unit test suite (100% pass).
- Run full Playwright E2E suite (60fps loop, zero fatal console errors).
- Dispatch Forensic Auditor (`teamwork_preview_auditor`) for integrity verification.
- Dispatch Reviewers & Challengers for empirical validation.
- Deliver final completion handoff to Sentinel.
