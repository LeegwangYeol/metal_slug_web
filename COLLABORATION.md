# Dark Fantasy Horde Survival — Claude Collaboration Guide & Swarm Blueprint

> **Project Mission**: Autonomous Rebuild of the game from absolute scratch by a 60-agent swarm into a dark fantasy, Vampire Survivors-like horde survival shooter. Discard previous code, logic, and cute assets. Implement gritty, epic dark fantasy visuals (undead swarms, gothic magic, imposing environments), an overwhelming horde survival core loop (auto-firing weapons, XP gems, level-ups, rogue-lite upgrades, synergies), automated 30+ second Playwright playtest verification, visual proof screenshots, 100% green tests, and production deployment to Vercel via `origin/main`.

---

## 📌 Claude Collaboration & Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: 🟢 **EXPLICIT USER APPROVAL VERIFIED ("승인", 2026-09-10T10:36:45Z) — 60-AGENT SWARM REBUILD AUTHORIZED**
- **Trigger Keyword**: When the user enters `내용확인` (Check content), immediately read this file (`COLLABORATION.md`) to integrate the latest guidance from Claude.
- **Integrity Mode**: development
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web`

---

## 🗺️ 60-Agent Swarm Decomposition & Architecture

### Phase Overview
The 60-agent swarm is organized into coordinated specialist waves led by the Project Orchestrator (`teamwork_preview_orchestrator`):

1. **Wave 1: Clean Slate & Foundation (Agents 1–12)**
   - Wipe old cute/metal-slug specific gameplay logic and assets.
   - Set up Dark Fantasy Horde Engine architecture:
     - Entity Component / High-performance Horde Manager (supporting 500+ simultaneous enemies).
     - Spatial grid / quadtree partitioning for efficient collision detection and performance.
     - Game loop with fixed timestep physics and variable render interpolation.

2. **Wave 2: Dark Fantasy Art & Aesthetic Engine (Agents 13–24)**
   - Dark, gritty gothic palette: obsidian, blood crimson, necrotic emerald, bone ivory, abyssal purple, rusted iron.
   - Procedural / vector sprite rendering:
     - Player: Dark Sorcerer / Grim Knight / Necromancer.
     - Undead swarms: Skeletons, zombies, ghouls, banshees, abyssal horrors, imposing elite necromancers/bosses.
   - Atmospheric environmental rendering:
     - Desolate cursed cathedral / graveyard / abyssal ruins backdrop.
     - Gothic visual effects: shadow tendrils, soul sparks, blood splatters, arcane runes, glowing spell circles.
   - Imposing Dark Fantasy HUD: Gothic health orb/bar, soul/XP meter, kill counter, survival timer, wave indicator, active ability cooldown badges.

3. **Wave 3: Horde Survival Mechanics & Synergies (Agents 25–40)**
   - Vampire Survivors-like core loop:
     - Auto-firing weapons (Arcane Daggers, Soul Orbiters, Bone Spears, Abyssal Lightning, Cursed Aura).
     - Experience gems / Soul shards dropped upon enemy death with magnetic attraction radius.
     - Level-up trigger pausing action and presenting 3–4 randomized rogue-lite cards (weapons, passive stat buffs: damage, area, cooldown, speed, magnet, armor).
     - Synergies and weapon evolutions at max level.
     - Escalating wave system: timer-based wave spawner scaling horde density, speed, health, and periodic champion/boss mini-events.

4. **Wave 4: Automated Testing & Verification Suite (Agents 41–52)**
   - Unit tests (`tests/unit/`): Complete test coverage for horde math, XP leveling curve, weapon firing, collision, upgrade selection, and wave manager.
   - Playwright E2E (`tests/e2e/`):
     - `horde_survival.spec.ts`: Automated 30+ second continuous playtest surviving enemy hordes, collecting XP gems, leveling up, picking an upgrade card, and verifying zero engine lag, freeze, or unhandled exceptions.
     - High-resolution visual proof screenshot capture stored in `artifacts/dark_fantasy/`.

5. **Wave 5: Production Deployment & Verification (Agents 53–60)**
   - Clean production build (`npm run build`).
   - 100% green test run (`npm test` & `npm run test:e2e`).
   - Git commit & push to `origin/main`.
   - Vercel live deployment verification.

---

## 🎯 Acceptance Criteria Checklist

| Criterion | Target | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **R1. Complete Reboot & Art** | Discard old cute code/assets; dark fantasy gothic aesthetic, undead swarms, gothic magic, imposing environments | Code audit, visual tests, unit tests | ✅ Completed |
| **Visual Proof** | Playwright screenshots showing dark fantasy aesthetic & overwhelming swarms | `artifacts/dark_fantasy/*.png` | ✅ Completed (3/3 > 50KB) |
| **R2. Horde Survival Loop** | Auto-firing, XP gems, level-up cards, rogue-lite upgrades, escalating waves | Unit tests + Playwright E2E simulation | ✅ Completed |
| **Playable Horde Loop** | Playwright E2E survives >= 30s, collects XP, levels up, picks upgrade, 0 crashes | `tests/e2e/horde_survival.spec.ts` | ✅ Completed (100% Green) |
| **R3. 100% Green Tests** | All unit and E2E tests pass cleanly | `npm test` & `npm run test:e2e` | ✅ Completed (210/210 unit, 9/9 E2E) |
| **Deployment** | Git push to `origin/main` & Vercel deployment succeeds | Git push log & Vercel deployment status | 🔄 In Progress |
