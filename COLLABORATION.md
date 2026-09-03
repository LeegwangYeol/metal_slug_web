# Metal Slug Web (Full Metal Slug) — Claude Collaboration Guide

> **Project Mission**: Overhaul the existing Metal Slug web game to address major visual and gameplay issues: fix broken physics, correct enemy spawn/despawn logic so minions walk in smoothly from off-screen without popping, upgrade character and enemy sprites from primitive "Atari" style to high-resolution detailed Neo Geo pixel art, add clear aiming crosshair indicators and directional animations, and establish visual screenshot verification via headless browser.

---

## 📌 Claude Collaboration & Approval Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: 🚀 **APPROVED BY USER** — Implementation swarm authorized and dispatched.
- **Trigger Keyword**: When the user enters `내용확인` (Check content), the team reviews `COLLABORATION.md` for updated feedback from Claude.

---

## 🔍 Root Cause Analysis of Current Deficiencies

1. **R1 Physics & Spawning**:
   - **Enemy Popping**: In `src/main.ts`, spawn triggers currently place enemies directly inside the visible viewport (e.g. `rebel_rifle_1` at `x=340` when player triggers at `x=180` with a 480px camera viewport). Enemies abruptly pop onto the screen instead of entering from beyond the screen margins.
   - **Physics Inconsistencies**: Jump curves and falling velocity need tuning to follow clean Newtonian parabolic equations ($y(t) = y_0 + v_0 t + \frac{1}{2} g t^2$) with consistent ground snapping and platform landing forgiveness to eliminate floatiness and erratic collisions.
   - **SpatialGrid Benchmark Flake**: In `tests/unit/adversarial_challenge.test.ts`, the spatial grid latency assertion `< 50µs` failed under heavy CI/system load (~480µs), requiring realistic threshold calibration.

2. **R2 Graphics & Aiming**:
   - **Primitive "Atari" Look**: The current procedural sprites use flat blocky rectangles and low-detail silhouettes. Metal Slug is celebrated for dense, shaded, gritty 16-color military pixel art with black contours, multi-shade muscle/clothing highlights, and expressive animations.
   - **Ambiguous Aiming**: While 8-way aim math exists in the core kinematics, the on-screen presentation lacks a visual aiming reticle / crosshair, and sprite upper-body postures do not visibly indicate diagonal or upward gun angles.

3. **R3 Visual Verification**:
   - Need automated Playwright visual screenshot tests to render the game in headless Chromium, capture screenshots of the player aiming, jump arcs, and enemy off-screen walk-in sequences, and save artifacts in `artifacts/screenshots/` for AI visual critique.

---

## 🛠️ Overhaul Technical Specification

### 1. Physics & Smooth Spawning System (R1)
- **Natural Newtonian Kinematics (`src/core/player/PlayerKinematics.ts`)**:
  - Refine jump physics to authentic arcade curve: Initial impulse $-360\text{ px/s}$, gravity $800\text{ px/s}^2$, apex float dampening, and crisp terminal velocity ($500\text{ px/s}$).
  - Jump trajectory strictly adheres to continuous Newtonian integration: $v_{y}(t+\Delta t) = v_{y}(t) + g \Delta t$, $y(t+\Delta t) = y(t) + v_{y}(t)\Delta t$.
  - Soft landing compression frame and coyote-time jump buffer (4 frames) for responsive jump control.
- **Smooth Out-of-Bounds Enemy Spawning (`src/core/engine/StageManager.ts` & `src/main.ts`)**:
  - Spawn coordinates positioned outside the active camera frustum:
    - Right-entering minions spawn at $X_{\text{spawn}} = \text{camera.x} + \text{camera.width} + 40\text{px}$ (off-screen right).
    - Left-entering ambushers spawn at $X_{\text{spawn}} = \text{camera.x} - 40\text{px}$ (off-screen left).
  - Minions spawn in `RUNNING` or `PATROL` state and smoothly run/walk into the camera view.
  - Off-screen despawn margin: Minions that fall behind the camera by $> 180\text{px}$ or drop below $Y = 320\text{px}$ despawn cleanly without memory leaks.

### 2. High-Resolution Neo Geo Pixel Art & Aiming Overhaul (R2)
- **High-Resolution Sprite Engine (`src/render/sprites/ProceduralSpriteFactory.ts`)**:
  - Replace primitive block sprites with authentic Neo Geo style 32x32 / 48x48 pixel art:
    - **Marco Rossi**: Red headband, blonde hair, dark eyes, shaded military khaki vest, white undershirt, muscle shading, ammo belt, tactical combat boots, weapon holster.
    - **Rebel Soldier**: Olive green combat helmet with steel rim highlight, shaded gas mask/uniform, brown combat webbing, detailed rifle and knife models.
    - **POW (Hostage)**: Yellow tattered shorts, bare chest with muscle definition, rope-bound wrists, untamed beard, wave animation on rescue.
    - **Vehicles & Boss**: Detailed steel plating rivets, metallic rust/scratches, rotating turret barrels, dynamic engine exhaust smoke.
- **Dynamic Aiming Crosshair & Directional Animations**:
  - Visual aiming reticle rendered along player aim vector:
    - Standard Pistol: Laser targeting pip and subtle crosshair bracket.
    - Heavy Machine Gun: Circular tactical reticle with active bullet spread indicator.
    - Flame Shot: Tapered flame range arc indicator.
  - 5 distinct upper-body aiming sprite poses: `FORWARD`, `UP_FORWARD` ($45^\circ$), `UP` ($90^\circ$), `DOWN_FORWARD` ($-45^\circ$), `DOWN` ($-90^\circ$ airborne).

### 3. Visual Verification Pipeline via Screenshots (R3)
- **Playwright Visual Capture Suite (`tests/e2e/visual_verification.spec.ts`)**:
  - Boots the game in headless Chromium at $960\times 540$ ($2\times$ virtual resolution).
  - Captures and saves high-resolution screenshot artifacts to `artifacts/screenshots/`:
    1. `screenshot_01_idle_crosshair.png`: Player standing with visible aiming crosshair.
    2. `screenshot_02_aim_up_forward.png`: Player aiming diagonally upward with directional sprite.
    3. `screenshot_03_jump_arc.png`: Captured frame of natural jump arc trajectory.
    4. `screenshot_04_enemy_smooth_spawn.png`: Captured frame showing rebel soldier entering smoothly from off-screen margin.
    5. `screenshot_05_combat_upgraded_sprites.png`: Active combat scene showing high-res player and rebel sprites.
  - Formal AI design evaluation report written to `artifacts/VISUAL_EVALUATION.md`.

---

## 🧪 Acceptance Criteria

- [ ] **Visual Proof**: Screenshot artifacts (`artifacts/screenshots/`) showing upgraded high-res sprites, UI layout, and aiming crosshairs, alongside an AI evaluation document.
- [ ] **AI Evaluation (Spawn Logic)**: Confirmed that enemies spawn at $X > \text{camera.maxX}$ or $X < \text{camera.minX}$ and walk into screen smoothly with zero popping.
- [ ] **AI Evaluation (Physics)**: Confirmed natural Newtonian jump arcs and crisp collision response without floating or clipping.
- [ ] **Automated Tests**: 100% green on all Vitest unit tests and Playwright E2E/visual tests.

---

## 👥 Full Team / Swarm Allocation Plan

| Role / Agent | Target Area | Deliverables |
|---|---|---|
| **Orchestrator** | Master coordination | Milestone sequencing, integration, gate reviews |
| **Worker 1 (Physics & Kinematics)** | `src/core/player/` & `src/core/physics/` | Newtonian jump curves, platform collision, gravity tuning, unit tests |
| **Worker 2 (Spawn & Despawn Logic)** | `src/core/engine/StageManager.ts`, `src/main.ts` | Off-screen spawn margins, walk-in patrol behaviors, clean despawning |
| **Worker 3 (High-Res Pixel Art)** | `src/render/sprites/` | 16-color Neo Geo shaded sprites (Marco, Rebel, POW, vehicles) |
| **Worker 4 (Aiming Crosshair & UI)** | `src/render/CanvasRenderer.ts`, `src/ui/` | Dynamic crosshair, aim vector rendering, 5-directional upper-body animations |
| **Worker 5 (Visual Verification & QA)** | `tests/e2e/visual_verification.spec.ts` | Playwright screenshot capture, test suite green (100%), visual evaluation report |
| **Reviewer / Challenger** | Verification | Adversarial inspection of screenshot artifacts, physics math, and test coverage |

---

## 💬 Questions & Consultation for Claude

1. **Aiming Reticle Style**: Do you prefer a modern subtle holographic reticle, or a classic arcade-style crosshair with a weapon-specific color (e.g., green laser for pistol, amber for HMG, orange for Flame Shot)?
2. **Enemy Walk-In Speed**: For off-screen spawned minions, we plan a slight run speed boost ($110\text{ px/s}$) until they cross the visible boundary, then settling into their tactical patrol speed ($75\text{ px/s}$). Does this transition meet your vision for smooth pacing?
3. **Approval to Proceed**: If this overhaul plan meets your approval, please provide your feedback and instruct the user to enter `승인`, `proceed`, or `내용확인` so the Sentinel can dispatch the full team orchestrator.
