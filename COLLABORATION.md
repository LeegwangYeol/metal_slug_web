# Metal Slug Web (Full Metal Slug) — Claude Collaboration Guide

> **Project Mission**: Build a complete, multi-stage web-based 2D run-and-gun action game inspired by Metal Slug featuring character motions, authentic-style voice/sound events, melee and ranged combat (default handgun, Heavy Machine Gun, Flame Shot), hostage POW rescues, and multi-phase mid-boss / boss encounters with unique gimmicks.

---

## 📌 Claude Collaboration & Approval Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Status**: 🚀 **APPROVED BY USER** — Swarm orchestration & implementation initiated.
- **Trigger Keyword**: When the user enters `내용확인` (Check content), the team reviews `COLLABORATION.md` for updated feedback from Claude.

---

## 🎮 Game Architecture & Technical Stack

### 1. Testable Decoupled Architecture (R5 Compliance)
- **Decoupled Simulation Core (`src/core/`)**:
  - Independent of DOM/Canvas/WebGL. Runs purely in memory.
  - Pure state machines for Player, Weapons, Bullets, Enemies, Bosses, and Item drops.
  - Enables 100% headless testing in Node.js / Vitest without browser dependency.
- **Render & Input Layer (`src/render/`, `src/input/`)**:
  - High-performance HTML5 2D Canvas / WebGL rendering layer driven by Vite + TypeScript.
  - Responsive letterboxing with fixed virtual resolution (e.g. 320x224 or 480x270 scaled cleanly to HD/4K).
  - Dual input system: Keyboard (WASD/Arrows + J/K/L/Space) and on-screen Touch virtual pad for mobile.
- **Vite + TypeScript Build Pipeline**:
  - Instant development HMR and zero-config static bundle generation (`dist/`).

### 2. Core Game Mechanics & Movement (R1)
- **Player Motion & Physics**:
  - 8-directional aiming & shooting (horizontal, upward diagonal, vertical up, downward during jump).
  - Run, jump with variable height/momentum, crouch crawl, fall through semi-solid platforms.
- **Melee Combat System**:
  - Automatic close-quarters knife slash / combat knife when within threshold distance of infantry enemies.
- **Secondary Weapons**:
  - Parabolic grenade throw with bounce physics and area-of-effect blast.

### 3. Weapon Upgrades & Combat System (R2)
- **Default Handgun**: Infinite ammo, semi-automatic rapid firing with bullet physics.
- **Heavy Machine Gun ("H")**:
  - Full-automatic rapid fire, 200 rounds, spray sweep angle when moving while firing.
  - Iconic synthesized announcer voice clip: *"HEAVY MACHINE GUN!"*.
- **Flame Shot ("F")**:
  - Piercing multi-hit continuous fireball / flame stream, burning area effect.
  - Iconic announcer voice clip: *"FLAME SHOT!"*.
- **Hostage POWs & Item Crates**:
  - Rescuable POWs (Hostages) that thank the player (*"THANK YOU!"*) and drop weapon badges, grenades, and score items.
- **Ammo System**: Visible HUD counter; seamless automatic switch back to default handgun when ammo depletes.

### 4. Multi-Stage Enemies, Mid-Bosses, and Bosses (R3)
- **Enemy Infantry**:
  - Rebel Soldier (Rifleman, Knife Charger, Grenade Thrower).
  - Shield Trooper (requires flanking, melee knife, or explosive to penetrate).
- **Mid-Boss Encounter**:
  - Rebel Iron Technical / Half-track Armored Vehicle with mounted rotating cannon and troop deployment.
- **Stage 1 End-Boss: Tetsuyuki War Fortress**:
  - Phase 1: Heavy artillery cannon barrage and homing rocket pods.
  - Phase 2: Hull breach, engine overheating, laser/gatling sweep attack.
  - Phase 3: Final emergency thruster meltdown, destructible turrets, weak-point flashing, and multi-stage chain explosions.

### 5. Procedural Assets & Retro Arcade Audio (R4)
- **Visual Assets**:
  - Procedural pixel-art sprite generation for Marco/Tarma style soldier, rebel enemies, POWs, weapon effects, explosions, and layered parallax backgrounds.
- **Web Audio API Sound Engine & Arcade Announcer**:
  - Real-time procedural audio synthesis for gunshots, shell clatter, grenade explosions, and hit impacts.
  - Speech synthesis / formant filter synthesis for classic arcade voice clips (*"HEAVY MACHINE GUN!"*, *"FLAME SHOT!"*, *"OK!"*, *"MISSION COMPLETE!"*).

---

## 🧪 Acceptance Criteria & Automated Testing Suite

1. **Automated Unit Tests (`vitest`)**:
   - `tests/unit/player_weapon_state.test.ts`: Verifies player inventory, weapon acquisition, fire rates, ammo countdown, and auto-fallback to pistol.
   - `tests/unit/enemy_boss_statemachine.test.ts`: Verifies damage reception, invulnerability frames, phase transitions at HP thresholds, and death state cleanup.
   - `tests/unit/melee_ranged_decision.test.ts`: Verifies automatic knife trigger when enemy distance $\le$ melee threshold, otherwise ranged projectile.
2. **Integration / E2E Tests (`playwright`)**:
   - `tests/e2e/game_initialization.spec.ts`: Validates headless browser loading, Canvas context creation, asset generation, 60fps game loop startup, and zero uncaught console errors.
3. **Asset & Audio Integrity**:
   - Verify playable graphics render properly and audio cues trigger without audio context blocking.

---

## 👥 Large Team / Swarm Allocation Plan

| Role / Agent | Focus Area | Deliverables |
|---|---|---|
| **Orchestrator** | Milestone coordination & integration | Overall system harmony, gate checks |
| **Worker 1 (Engine & Core Logic)** | Decoupled game engine & state machines | `src/core/` game loop, player physics, collision engine |
| **Worker 2 (Combat & Weapons)** | Weapon upgrade system & ammo logic | `src/core/weapons/` Handgun, HMG, FlameShot, Grenades |
| **Worker 3 (Enemy & Boss AI)** | Rebel AI, POW logic, Mid-Boss & Boss | `src/core/entities/` Soldier, Tank Mid-Boss, Tetsuyuki Boss |
| **Worker 4 (Visual Assets & Canvas)** | Pixel art procedural generator & renderer | `src/render/` Canvas renderer, sprite animators, parallax |
| **Worker 5 (Web Audio & Voices)** | Procedural arcade SFX & voice synthesis | `src/audio/` Web Audio API sound synthesizer, voice clips |
| **Worker 6 (Test & QA Suite)** | Vitest unit tests & Playwright E2E | `tests/` comprehensive test suite and CI execution scripts |

---

## 💬 Instructions & Questions for Claude
1. **Engine Selection**: We propose a decoupled TypeScript + Vite + Canvas architecture (100% testable without DOM) rather than a heavy black-box engine, allowing both headless unit testing and browser gameplay. Do you agree with this design?
2. **Audio & Voice Strategy**: We will utilize Web Audio API procedural synthesis with formant speech filters for authentic arcade announcer callouts. Please let us know if you prefer pre-rendered audio buffers or dynamic synthesis.
3. **Approval**: If this plan looks solid, please instruct the user to enter `승인`, `proceed`, or `내용확인` so we can immediately launch the orchestrator and swarm.
