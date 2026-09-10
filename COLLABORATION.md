# Grim Harvest: Undead Siege — Claude Collaboration Guide & 60-Agent Swarm Blueprint

> **Project Mission**: Execute a focused enhancement and bug-fix task for "Grim Harvest: Undead Siege". Resolve the critical infinite loop / state re-initialization bug upon game restart and execute a dramatic graphics overhaul to elevate visual fidelity from crude shapes to high-polish dark fantasy (professional sprites, dynamic lighting, drop shadows, rich blood/magic VFX, and imposing gothic atmosphere).

---

## 📌 Claude Collaboration & Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: 🟡 **EXPLICIT USER APPROVAL RECEIVED ("승인", 2026-09-10T15:27:30Z) — 60-AGENT SWARM EXECUTION AUTHORIZED**
- **Trigger Keyword**: When the user enters `내용확인` (Check content), immediately read this file (`COLLABORATION.md`) to integrate the latest guidance from Claude and proceed with implementation.
- **Integrity Mode**: development
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web`

---

## 🔍 Investigation & Technical Findings

### 1. Game Restart Infinite Loop Root Cause
- In `src/main.ts`, `GrimHarvestGame` currently lacks a formal `restart()` / `reinitialize()` lifecycle method.
- When player health reaches 0, `GothicHUD` renders the Game Over plaque with `"PRESS [SPACE] OR CLICK TO RESURRECT"`, but no event handlers were wired to safely trigger a restart.
- When restarts were triggered externally or via re-instantiation, the previous `requestAnimationFrame` loop was not cleanly torn down, causing:
  1. Multiple concurrent RAF loops.
  2. Timestamp accumulator explosions (`while (this.accumulator >= FIXED_TIMESTEP)` hanging the main thread in an unbounded loop).
  3. Residual entity states in the pre-allocated `HordeManager` (2,048 slots), `SpatialHashGrid`, and `LootManager` (1,500 slots) leaking into the new game, crashing the collision system.
  4. Pending upgrade modals and paused states remaining unreset.

### 2. Graphics Upgrade Opportunity
- The current sprite generation in `src/render/sprites/DarkFantasySprites.ts` uses simplistic geometric paths and basic solid fills.
- Visual improvements needed:
  1. **Sprites**: Multi-layered anatomical shading, weathered bone filigree, flowing tattered robes, glowing occult eye sockets, and distinct elite silhouettes (Necromancer, Skeleton, Ghoul, Banshee, Death Knight).
  2. **Lighting & Shadows**: Dynamic player torch/spell radial illumination, entity drop shadows for grounded depth, and directional highlights.
  3. **VFX**: Sticky ground blood splatters with fading decals, particle trails for projectiles, crackling abyssal lightning arcs, and volumetric mist.
  4. **HUD & Plaque**: Ornate gold/blood iron filigree with refined typography and responsive vitality draining.

---

## 🗺️ 60-Agent Swarm Decomposition & Architecture

The 60-agent swarm will be orchestrated by `teamwork_preview_orchestrator` across 5 milestone waves:

### 1. Milestone 1: Restart State Engine & Lifecycle Architecture (Agents 1–12)
- **Implement `GrimHarvestGame.restart()` & clean lifecycle management**:
  - Cancel existing RAF loop cleanly (`cancelAnimationFrame`).
  - Reset simulation clock (`elapsedTime = 0`, `lastTime = performance.now()`, `accumulator = 0`, `isPaused = false`).
  - Re-initialize Player state (reset HP, level 1, starting stats, position (0,0), inventory, progression callbacks).
  - Clear and re-populate `HordeManager` (reset pool, active list, cull counters, kill tally).
  - Clear and re-populate `LootManager` and `SpatialHashGrid`.
  - Reset `WeaponManager` (clear active projectiles, re-equip Rank 1 Arcane Scythe).
  - Reset `UpgradeSystem` & `UpgradeModal` (close modal, clear pending level ups).
  - Reset `WaveDirector` to Phase 1 and reset camera tracking with zero shake.
  - Wire Spacebar and Canvas Click listeners to trigger clean restart from Game Over and Victory states.
- **Milestone 1 Gate**: 5-agent verification team (2 Reviewers, 2 Challengers, 1 Forensic Auditor) + unit tests (`tests/unit/restart.spec.ts`).

### 2. Milestone 2: High-Fidelity Dark Fantasy Graphics Overhaul (Agents 13–28)
- **Overhaul `src/render/sprites/DarkFantasySprites.ts`**:
  - High-definition procedural offscreen cached sprite atlas.
  - **Player (Grim Sorcerer)**: Layered tattered cowl and hooded robe with dark crimson borders, ethereal bone scythe with purple runic glow, glowing eyes.
  - **Undead Horde Entities**:
    - *Skeleton*: Weathered bone textures, hollow eye sockets with crimson pinpoints, cracked skull details, rusted iron blades.
    - *Ghoul*: Hunched feral frame, decaying flesh shading, glowing green necrotic boils, jagged claws.
    - *Banshee*: Translucent spectral apparition, floating ghostly wisps, weeping veil, luminous cyan/purple additive blending.
    - *Death Knight*: Heavy obsidian armor, horned helm, gold filigree etchings, glowing blood broadsword.
  - Multi-frame walk and attack animations with smooth bobbing and directional flipping.
- **Milestone 2 Gate**: 5-agent verification team.

### 3. Milestone 3: Dynamic Lighting, Rich VFX & Atmospheric Polish (Agents 29–42)
- **Overhaul `src/render/vfx/DarkFantasyVFX.ts` & `src/render/GothicBackdrop.ts`**:
  - **Dynamic Radial Lighting**: Player aura illuminates nearby terrain and entities; spells cast dynamic colored light.
  - **Drop Shadows & Ambient Occlusion**: Elliptical contact shadows under player, horde, and loot gems.
  - **Decal System**: Persistent ground blood splatters and charred blast marks that gently fade over time.
  - **Arcane & Particle Effects**: Branching abyssal lightning, swirling necrotic soul motes, bone fragments, and glowing rune circles.
  - **Atmospheric Mist**: Multi-layered depth mist with gentle undulation.
- **Milestone 3 Gate**: 5-agent verification team.

### 4. Milestone 4: Automated E2E Verification & Visual Proof Suite (Agents 43–52)
- **Playwright E2E Restart & Visual Test (`tests/e2e/restart_survival.spec.ts`)**:
  - Test intentionally drives player into enemy horde until Game Over occurs.
  - Asserts Game Over tombstone overlay is displayed.
  - Clicks restart (or presses Space) and verifies the game cleanly resets without infinite loops or RAF freeze.
  - Bot survives autonomously for at least 15 seconds in the restarted session, moving, auto-firing, collecting XP, and verifying zero crashes.
  - High-resolution visual proof screenshots saved in `artifacts/dark_fantasy/`:
    - `enhanced_graphics_swarm.png` (demonstrating dramatic leap in visual fidelity, lighting, and textures).
    - `restart_verified.png` (showing clean restarted gameplay state after resurrection).
    - `occult_vfx_lighting.png` (highlighting particle lighting and blood decals).
    - Verify all screenshot files strictly exceed 50KB.
- **Milestone 4 Gate**: 5-agent verification team.

### 5. Milestone 5: 100% Green Test Suite & Production Deployment (Agents 53–60)
- Verify 100% clean test passes: `npm test` (unit tests) and `npx playwright test` (E2E tests).
- TypeScript compile verification (`npx tsc --noEmit`).
- Production build verification (`npm run build`).
- Git commit and push to `origin/main`.
- Live Vercel deployment check (`https://metal-slug-web-lovat.vercel.app`).
- **Milestone 5 Gate**: 5-agent verification team.

---

## 🎯 Acceptance Criteria Checklist

| Criterion | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **R1. Fix Restart Bug** | Clean re-initialization of player, horde, grid, weapons; zero infinite loops | `tests/unit/restart.spec.ts` & Playwright E2E | 🟡 Planned |
| **Restart Verification** | Playwright E2E triggers Game Over, restarts, survives >= 15s smoothly | `tests/e2e/restart_survival.spec.ts` | 🟡 Planned |
| **R2. Graphics Upgrade** | Professional dark fantasy visual fidelity: sprites, lighting, VFX, decals | Visual audit & high-res screenshot capture | 🟡 Planned |
| **Visual Proof** | Playwright screenshots showing significant leap in visual quality (>50KB) | `artifacts/dark_fantasy/*.png` | 🟡 Planned |
| **100% Green Tests** | All unit tests and E2E tests pass cleanly | `npm test` & `npx playwright test` | 🟡 Planned |
| **Production Deployment** | Git push to `origin/main` & Vercel production build verified | Git push & HTTP/2 200 live URL check | 🟡 Planned |

---

## 💬 Next Steps for Claude & User
1. **User / Claude**: Review the proposed 60-agent swarm blueprint above.
2. If any modifications or specific aesthetic/mechanical preferences are desired, update this file or provide guidance.
3. Once approved, reply with **"승인"**, **"proceed"**, or **"내용확인"** to trigger immediate swarm execution.
