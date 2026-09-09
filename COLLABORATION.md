# Metal Slug Web (Full Metal Slug) — Claude Collaboration Guide

> **Project Mission**: Massively expand the Metal Slug web game by transplanting and implementing new multi-phase boss encounters, dynamic crisis situations, autonomous ally NPCs, diverse items/power-ups, and a screen-clearing ultimate move system.
> 
> **Core Deliverables**:
> 1. **R1. Epic Bosses & Crisis Events**:
>    - Multi-phase boss encounters with dynamic phase shifts and distinct attack patterns.
>    - Dynamic "Crisis Situations" triggered at specific HP thresholds (e.g. 75%, 50%, 25% HP) altering the active combat arena (screen-filling attacks, environmental artillery hazards, and collapsing terrain that modifies active bounds).
>    - Code verification confirming HP thresholds trigger environment-altering crisis events.
> 2. **R2. Allies, Items, & Ultimate Moves**:
>    - **Autonomous Ally NPCs**: Autonomous companions (e.g. Hyakutaro Ichimonji throwing Hadouken/ki blasts or prisoner allies) that spawn, follow, acquire enemy targets, and deal damage independently of player inputs.
>    - **Diverse Items & Power-ups**: Expanding collectible items beyond H/F/G to include Heavy Machine Gun, Flame Shot, Shotgun, Laser Gun, Rocket Launcher, Super Grenades, Medkits, and Coin/Score treasures with unique projectile behaviors.
>    - **Ultimate Move System**: A spectacular screen-clearing tactical attack (e.g. Metal Slug SV-001 Kamikaze charge / Heavy Bomber Airstrike) triggered by dedicated input (e.g. key `X` / `U` / button), inflicting massive screen-wide damage or clearing all active minions and damaging bosses.
> 3. **R3. Autonomous Scaling & Rigorous Testing**:
>    - Vitest unit tests asserting ally targeting/damage, boss phase transitions, and crisis event triggers.
>    - Playwright E2E browser tests asserting ultimate move execution and screen clearing.
>    - Visual proof: High-fidelity Playwright screenshots capturing the Ultimate Move execution and the new Boss/Crisis environment in `artifacts/expansion/`.
> 
> ---
> 
> ## 📌 Claude Collaboration & Protocol
> - **Primary AI Collaborator**: Claude
> - **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
> - **Current Status**: 🟢 **EXPLICIT USER BLANKET APPROVAL VERIFIED ("승인", 2026-09-09T13:38:27Z) — FINALIZATION & DEPLOYMENT IN PROGRESS**
> - **Trigger Keyword**: When the user enters `내용확인` (Check content), the team immediately reviews this file (`COLLABORATION.md`) to integrate Claude's feedback.
> - **Rule Constraint**: Explicit user approval verified. Finalize M3 polish, 100% test pass rate, Git push to origin/main, and Vercel deployment verification.
> 
> ---
> 
> ## 🗺️ Proposed Technical Architecture & Decomposition
> 
> ### 1. Boss Encounters & Dynamic Crisis Engine (`src/core/entities/boss/`)
> - **Multi-Phase Boss**: Extend `BossTypes.ts` with multi-phase state machines, phase transition invulnerability frames, telegraphed attacks, and rage modes.
> - **Crisis Event System**:
>   - `CrisisEventManager`: Monitors boss HP thresholds (`hp <= maxHp * 0.75`, `0.50`, `0.25`).
>   - Triggers environmental hazards (incoming mortar bombardments, ceiling debris, laser sweeps).
>   - Dynamically modifies active camera bounds / stage platform bounds (collapsing bridges / platforms forcing aerial platforming).
> 
> ### 2. Autonomous Ally NPCs (`src/core/entities/allies/`)
> - `AllyNPC.ts`: Autonomous entity with state machine (`IDLE`, `FOLLOW`, `ACQUIRE_TARGET`, `ATTACK`, `CELEBRATE`).
> - Target acquisition: Scans living enemy spatial grid within vision radius, prioritizes nearest active threat.
> - Combat dispatch: Emits friendly projectiles (e.g., Ki blasts / energy orbs) that register collision with enemy hitboxes independently of player state.
> 
> ### 3. Diverse Items & Inventory Expansion (`src/core/weapons/`, `src/core/entities/items/`)
> - Item types: `SHOTGUN` (short-range spread cone, high kinetic knockback), `LASER` (piercing continuous beam), `ROCKET_LAUNCHER` (homing / accelerating warheads), `MEDKIT` (HP restore), `SHIELD` (temporary damage absorption).
> - Dynamic floating bounce, hostage reward drops, and HUD item indicators.
> 
> ### 4. Ultimate Move Mechanic (`src/core/player/`, `src/render/`)
> - Ultimate Gauge / Stock: Accumulates via enemy kills and dealing damage, or initialized with tactical stock.
> - Activation: Player triggers Ultimate Move via dedicated key.
> - Cinematic Effect: Screen freeze / flash, siren sound, visual strike (airstrike bomber pass or SV-001 dive), full-screen particle shockwave.
> - Combat Resolution: Instantly eliminates all active standard minions on screen and inflicts heavy burst damage to bosses.
> 
> ### 5. Verification & Acceptance Criteria
> 
> | Criterion | Verification Target | Method |
> | :--- | :--- | :--- |
> | **Ultimate Move E2E** | Screen-clearing damage to all on-screen enemies | Playwright E2E browser test asserting enemy count drops to 0 or boss takes massive damage |
> | **Ally NPCs** | Independent spawn, target acquisition, damage dispatch | Vitest unit tests verifying autonomous targeting loop and damage dealt without player input |
> | **Crisis Events** | HP threshold triggers hazard spawning / active bounds change | Vitest unit tests asserting bounds change and hazard entity generation at HP checkpoints |
> | **Visual Proof** | Screenshot artifacts of Ultimate Move and Boss Crisis | Playwright screenshots saved to `artifacts/expansion/` |
> | **Zero Regressions** | 100% test pass rate, clean TypeScript build | `npm run build` + `npx vitest run` + `npx playwright test` |
> 
> ---
> 
> ## 🚦 Next Steps Upon User Approval ("승인")
> 1. Record user approval in `ORIGINAL_REQUEST.md`.
> 2. Dispatch Project Orchestrator (`teamwork_preview_orchestrator`) under General route.
> 3. Start Sentinel Monitoring Crons (Progress Reporting `*/8 * * * *`, Liveness Check `*/10 * * * *`).
> 4. Coordinate exploration, worker implementation, and adversarial challenge gates.
> 5. Dispatch independent `teamwork_preview_victory_auditor` for blocking post-victory audit.
