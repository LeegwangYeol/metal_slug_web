# Grim Harvest: Undead Siege — Claude Collaboration Guide & 30-Agent Swarm Blueprint

> **Project Mission**: Execute a focused bug-fix and enhancement task for "Grim Harvest: Undead Siege". Resolve the unfair damage hitbox / collision detection (R1) and overhaul the jarring camera / viewing angle (R2) to deliver precise, fair combat and a smooth, comfortable top-down dark fantasy perspective.

---

## 📌 Claude Collaboration & Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: 🟢 **EXPLICIT USER APPROVAL RECEIVED ("승인", 2026-09-11T02:16:21Z) — 30-AGENT SWARM EXECUTION AUTHORIZED**
- **Trigger Keyword**: When the user enters `내용확인` (Check content), immediately read this file (`COLLABORATION.md`) to integrate the latest guidance from Claude and proceed with implementation.
- **Integrity Mode**: development
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web`

---

## 🔍 Investigation & Technical Findings

### 1. Root Cause: Unfair Damage Hitbox / Collision Detection (R1)
- **Phantom Contact Damage Padding**: In `src/main.ts:465-470`:
  ```typescript
  const nearbyCount = this.hordeManager.getEnemiesInRadius(
    this.player.position.x,
    this.player.position.y,
    Player.COLLISION_RADIUS + 15, // <--- Arbitrary +15px phantom radius!
    scratch
  );
  ```
  `Player.COLLISION_RADIUS` is defined as `14.0px`. Adding `+ 15` inflates the query radius to `29px`. In `HordeManager.getEnemiesInRadius()`, collision checks use `distSq <= (radius + enemy.collisionRadius)^2`. For a standard enemy with `collisionRadius = 16px`, contact damage triggers at:
  $$d \le 29 + 16 = 45\text{px}$$
  Since player and enemy sprites are only ~28–32px wide, the player takes damage when enemies are visually more than 15–20 pixels away! This feels unfair, inaccurate, and frustrating during close-quarters dodging.
- **Visual Sprite vs Hitbox Discrepancy**:
  - `Player`: The sorcerer sprite visual core is a slim silhouette (~20px wide), but damage checks use an inflated 45px circle. The core hurtbox should be calibrated to a tight inner circle ($r \approx 10\text{--}11\text{px}$) so dodging close projectiles and claws feels responsive and fair.
  - `Enemies`: Different enemy types (Skeleton, Ghoul, Banshee, Death Knight, Necromancer) currently share rough collision radii that don't match their rendered sprite dimensions. Hitboxes should tightly wrap visible silhouettes.
  - `Weapons & Projectiles`: Ensure projectile hitboxes (Arcane Scythe, Bone Spear, Soul Orbiters, Abyssal Lightning, Cursed Aura) have precise collision radii matching their glowing visual VFX heads.

### 2. Root Cause: Jarring Camera & Viewing Angle (R2)
- **Legacy Side-Scroller Deadzones & Asymmetric Offsets**:
  - `src/render/Camera.ts` retains legacy Run-and-Gun / side-scroller deadzone settings:
    - `deadzoneLeft = viewportWidth * 0.35` (336px)
    - `deadzoneRight = viewportWidth * 0.44` (422px)
    - `deadzoneTop = viewportHeight * 0.30` (162px)
    - `deadzoneBottom = viewportHeight * 0.70` (378px)
  - Because `deadzoneLeft` and `deadzoneRight` are heavily biased to the left, the player is pinned at 35% of the screen rather than centered. When the player reverses horizontal direction, the camera jerks abruptly across the deadzone margin before moving.
  - In a top-down horde survival game where undead swarm from all 360 degrees, this asymmetric bias severely blinds the player to enemies approaching from the left and behind, creating an awkward, jarring, and disorienting viewing experience.
- **Camera Overhaul Architecture**:
  - **Centered Tracking with Smooth Damping**: Center the player at screen coordinates $(W/2, H/2)$ with configurable exponential decay / lerp smoothing ($k \approx 6.0\text{--}8.0$) to absorb rapid direction toggling without jitter.
  - **Subtle Velocity Lookahead (Lead Bias)**: Add a gentle camera lookahead along the player's current velocity vector ($\le 40\text{px}$) to provide forward sightline in the direction of motion without sudden snapping.
  - **Balanced Field of View & Parallax Scaling**: Tune the virtual viewport and `GothicBackdrop.ts` multi-layer parallax mist / gothic architecture so world movement feels grounded, expansive, and natural.
  - **Boundary Clamping**: Ensure smooth deceleration when approaching map limits ($-2000$ to $+2000$) with zero hard-snapping.

---

## 🗺️ 30-Agent Swarm Decomposition & Architecture

The 30-agent swarm will be orchestrated by `teamwork_preview_orchestrator` across 4 milestone waves:

### 1. Milestone 1: Precision Damage Hitbox & Collision Subsystem (Agents 1–8)
- **Eliminate Phantom Padding**: Remove `+ 15` padding from `src/main.ts:468`. Contact damage triggers strictly when bounding geometry touches.
- **Calibrate Core Hurtboxes & Hitboxes**:
  - Player hurtbox: Calibrated to tight inner radius ($r = 11.0\text{px}$) matching sorcerer body silhouette.
  - Enemy hitboxes: Calibrated per type (Skeleton: $r = 11\text{px}$, Ghoul: $r = 13\text{px}$, Banshee: $r = 12\text{px}$, Death Knight: $r = 18\text{px}$, Necromancer: $r = 14\text{px}$).
  - Weapon projectile radii: Explicitly matched to projectile visual effects.
- **Unit Testing**: Unit tests in `tests/unit/hitbox_precision.spec.ts` testing near-miss (1px separation $\to$ 0 damage) and exact touch ($\to$ damage registered).
- **Gate 1**: 3-agent verification team (Reviewer, Challenger, Auditor).

### 2. Milestone 2: Camera Overhaul & Cinematic Viewport (Agents 9–16)
- **Refactor `src/render/Camera.ts`**:
  - Replace side-scroller deadzone with symmetrical centered tracking for omni-directional top-down horde survival.
  - Implement smooth exponential damping lerp and gentle velocity lookahead.
  - Remove all legacy forward-lock / ratchet artifacts.
  - Maintain decaying screen-shake trauma with high-frequency noise.
- **Backdrop & Fog Alignment**: Ensure `GothicBackdrop.ts` renders smoothly relative to centered camera without texture stutter or seams.
- **Unit Testing**: Unit tests in `tests/unit/camera_tracking.spec.ts` verifying player centering, lookahead clamping, and smooth interpolation.
- **Gate 2**: 3-agent verification team.

### 3. Milestone 3: Automated Playwright E2E Suite & Visual Proof (Agents 17–24)
- **E2E Hitbox Verification (`tests/e2e/hitbox_dodge.spec.ts`)**:
  - Autonomous Playwright test that drives the player weaving between approaching undead.
  - Verifies that grazing enemies at near-miss distances does NOT decrease player health.
  - Verifies that true physical collision cleanly registers damage and emits blood burst VFX.
- **E2E Camera Verification (`tests/e2e/camera_view.spec.ts`)**:
  - Playwright test capturing high-resolution gameplay screenshots demonstrating the centered, comfortable camera angle and wide field of view.
  - Artifacts saved to `artifacts/dark_fantasy/`:
    - `improved_camera_angle.png` (demonstrating balanced, comfortable field of view and centered player).
    - `hitbox_precision_dodge.png` (visual proof of close-quarters dodge without phantom damage).
  - Verify all screenshots exceed 50KB.
- **Gate 3**: 3-agent verification team.

### 4. Milestone 4: Full Suite Validation & Production Deployment (Agents 25–30)
- Verify 100% clean test execution: `npm test` (unit tests) and `npx playwright test` (E2E tests).
- Zero TypeScript compilation errors (`npx tsc --noEmit`).
- Production build verification (`npm run build`).
- Git commit and push to `origin/main`.
- Live Vercel production check at `https://metal-slug-web-lovat.vercel.app` (verifying HTTP/2 200 OK).
- **Gate 4**: 3-agent verification team.

---

## 🎯 Acceptance Criteria Checklist
- [ ] **Hitbox Verification**: A Playwright E2E test intentionally dodges enemies and verifies that taking damage only occurs when bounding boxes/sprites mathematically and visually overlap.
- [ ] **Camera Verification**: Playwright screenshots clearly demonstrate the new, improved camera angle and field of view, ensuring it is no longer jarring.
- [ ] **100% Green Tests**: Unit tests and E2E tests must pass cleanly.
- [ ] **Deployment**: Git push to `origin/main` is verified and Vercel build succeeds.
- [ ] **Independent Victory Audit**: Independent `teamwork_preview_victory_auditor` verification with `VICTORY CONFIRMED` verdict before project completion.
