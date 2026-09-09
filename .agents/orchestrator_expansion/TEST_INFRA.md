# E2E Test Infra: Metal Slug Web Massive Expansion

## Test Philosophy
- Requirement-driven, opaque-box, and regression-proof.
- Invariants: 100% test pass rate across existing 294 unit tests and 17 E2E tests.
- Visual proof: Playwright browser screenshots saved to `artifacts/expansion/`.

## Feature Inventory & Test Coverage
| # | Feature | Unit Test Target | E2E Test Target |
|---|---------|------------------|-----------------|
| 1 | CrisisEventManager (75%, 50%, 25% HP) | `tests/unit/boss_crisis_events.test.ts` | `tests/e2e/ultimate_and_crisis_expansion.spec.ts` |
| 2 | IronNokanaBoss (4 phases, rage mode) | `tests/unit/iron_nokana_boss.test.ts` | Visual verification screenshot |
| 3 | Environmental Hazards (Artillery, Debris) | `tests/unit/boss_crisis_events.test.ts` | Visual verification screenshot |
| 4 | Platform & Bounds Collapse | `tests/unit/boss_crisis_events.test.ts` | Visual verification screenshot |
| 5 | Autonomous Ally NPC (Hyakutaro Ichimonji) | `tests/unit/allies_system.test.ts` | Visual verification screenshot |
| 6 | Expanded Weapons (Shotgun, Laser, Rocket) | `tests/unit/diverse_weapons_items.test.ts` | Visual verification |
| 7 | Medkits & Shields | `tests/unit/diverse_weapons_items.test.ts` | Visual verification |
| 8 | Screen-Clearing Ultimate Move | `tests/unit/ultimate_move_system.test.ts` | `tests/e2e/ultimate_and_crisis_expansion.spec.ts` |
| 9 | Visual Proof Screenshots | N/A | `artifacts/expansion/*.png` |

## Test Architecture
- **Unit Test Runner**: `npx vitest run` (deterministic 60Hz headless simulation)
- **E2E Test Runner**: `npx playwright test` (headless Chromium)
- **Visual Artifacts**:
  - `artifacts/expansion/ultimate_move_strike.png` (>5KB)
  - `artifacts/expansion/boss_crisis_environment.png` (>5KB)
  - `artifacts/expansion/ally_combat_support.png` (>5KB)
