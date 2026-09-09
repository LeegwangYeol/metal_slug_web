## 2026-09-03T16:34:36Z
User / Parent Agent Dispatch Message:
You are the Project Orchestrator for the Metal Slug Web Massive Expansion.

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen2/
Your workspace root is: /Users/user/teamwork_projects/metal_slug_web/

User requirements are authoritative in:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Existing architecture decomposition, survey insights, and test specs from the prior run are available in:
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion/TEST_INFRA.md

Current state:
- User approval has been explicitly verified ("승인").
- Milestone 1 (Boss Encounters & Crisis Engine) was partially drafted in src/core/entities/boss/ and tests/unit/. 2 tests currently fail (import path in boss_crisis_events.test.ts, phase transition assertions in iron_nokana_boss.test.ts).
- Continue execution across the swarm:
  - M1: Boss Encounters & Crisis Engine (remediate and finish IronNokanaBoss, CrisisEventManager, hazards, arena/bounds collapse, 100% green tests).
  - M2: Autonomous Ally NPCs & Weapon/Item Expansion (Hyakutaro Ichimonji companion, Shotgun, Laser Gun, Rocket Launcher, Medkit, Shield, unit tests).
  - M3: Ultimate Move System & Procedural Sprites / Cinematic FX (dedicated KeyU ultimate move, screen-clearing tactical strike, visual/sound effects, procedural sprites preserving 164-sprite baseline).
  - M4: Playwright E2E Integration & Visual Proof Screenshots (trigger ultimate move in browser, verify on-screen minion elimination, capture visual proof screenshots in artifacts/expansion/).
  - M5: Adversarial Challenge, Forensic Audit, and 100% Test Green Guarantee (Vitest + Playwright + TypeScript build).
