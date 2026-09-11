# Grim Harvest: Undead Siege — Claude Collaboration Guide & 40-Agent Swarm Blueprint

> **Project Mission**: Execute a focused enhancement task for "Grim Harvest: Undead Siege". Overhaul character and enemy animations with dynamic motion (easing, squash/stretch, multi-frame procedural animations) (R1), widen camera field of view (FOV) to dramatically increase situational awareness against horde sizes (R2), and completely redesign the HUD / UI with a modern, sleek dark fantasy aesthetic (R3).

---

## 📌 Claude Collaboration & Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, Channel ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: 🟢 **EXPLICIT USER APPROVAL RECEIVED ("승인 (허용)") — 40-AGENT SWARM ACTIVE**
- **Trigger Keyword**: When the user enters `내용확인` (Check content), immediately read this file (`COLLABORATION.md`) to inspect the ongoing progress and verification milestones.
- **Integrity Mode**: development
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web`

---

## 🎯 Requirements & Scope Breakdown

### R1. Dynamic Animations & Motion
- **Problem**: Current character and enemy animations feel stiff and lifeless.
- **Target Architecture**:
  - Implement dynamic procedural motion in `src/render/DarkFantasySprites.ts` and entity update loops:
    - Dynamic easing curves for movement transitions.
    - Squash and stretch during directional changes, dashes, and impact reactions.
    - Attack wind-up / anticipation and impact follow-through.
    - Multi-phase procedural bobbing/walking cycles and floating/hovering animations for spectral entities (Banshee/Necromancer).
    - Dynamic scaling, rotation, and flinch states on damage taken.

### R2. Widen Field of View (FOV)
- **Problem**: The camera view is too narrow and zoomed in, restricting situational awareness against massive enemy hordes.
- **Target Architecture**:
  - Overhaul `src/render/Camera.ts` and canvas viewport pipeline:
    - Calibrate zoom factor / effective FOV to reveal a substantially broader battlefield area (expanding visible game area while preserving crisp rendering).
    - Ensure smooth centered camera tracking with damped interpolation remains balanced at wider zoom.
    - Adjust toroidal backdrop tiling (`GothicBackdrop.ts`) and dynamic radial lighting pass to cover the expanded visible area seamlessly.
    - Adapt culling logic and off-screen projectile boundaries to match the expanded FOV.

### R3. Modern UI/HUD Overhaul
- **Problem**: Current UI looks outdated and clunky.
- **Target Architecture**:
  - Redesign HUD components in `index.html`, `src/ui/`, and Canvas overlay layers:
    - **Health Bar**: Ornate gothic filigree framing, layered blood-red gradient bar, damage stagger / ghost bar effect, numeric readout.
    - **Experience & Level**: High-contrast glowing soul-blue / amethyst progress bar with metallic gothic bevel, prominent runic level insignia.
    - **Survival Timer & Kill Counter**: Elegant dark fantasy header counter with antique gold typography and icon accents.
    - **Upgrade Menu Overhaul**: Redesign `UpgradeModal` with dark gothic glassmorphism cards, glowing rarity borders (Common, Rare, Epic, Legendary), custom skill icons, polished hover micro-interactions.

---

## 👥 40-Agent Swarm Organization Blueprint

```
                     [Project Sentinel]
                             │
            [teamwork_preview_orchestrator]
      ┌──────────────────────┼──────────────────────┐
[Phase 0: 3 Explorers]   [Milestones 1-5]   [Post-Victory Auditor]
```

### Phase 0: Architectural Survey & Subsystem Mapping (3 Agents)
1. **explorer_survey_anim**: Deep survey of `DarkFantasySprites.ts`, entity render hooks, transformation matrices, and animation cycle states.
2. **explorer_survey_camera**: Deep survey of `Camera.ts`, coordinate transforms, viewport dimensions, backdrop parallax, and lighting boundaries.
3. **explorer_survey_ui**: Deep survey of `UpgradeModal.ts`, HUD DOM/Canvas elements, styling, layouts, and interaction flows.

### Milestone 1: Dynamic Animations & Motion Engine (6 Agents)
- **worker_m1_anim**: Implement squash/stretch, dynamic easing, attack anticipation, walking bob, flinch/recoil.
- **reviewer_m1_1 & reviewer_m1_2**: Dual independent code review of motion physics, performance, and visual polish.
- **challenger_m1_1 & challenger_m1_2**: Adversarial review testing edge-case velocities, zero-division, and animation state desyncs.
- **auditor_m1**: Forensic code integrity, test coverage, and anti-facade verification.

### Milestone 2: Widen Camera FOV & Viewport Optimization (6 Agents)
- **worker_m2_camera**: Implement widened camera FOV / zoom factor, backdrop seamless coverage, boundary scaling.
- **reviewer_m2_1 & reviewer_m2_2**: Dual code review of camera math, aspect ratio stability, and rendering performance.
- **challenger_m2_1 & challenger_m2_2**: Adversarial challenge for viewport edge glitches, culling anomalies, and shake offset stability.
- **auditor_m2**: Forensic review verifying genuine camera overhaul and mathematical soundness.

### Milestone 3: Modern Dark Fantasy UI/HUD Overhaul (6 Agents)
- **worker_m3_ui**: Redesign HUD (Health, XP, Level, Timer, Kills) and modernize Upgrade Selection Menu cards with dark fantasy styling.
- **reviewer_m3_1 & reviewer_m3_2**: Dual review of UI aesthetics, accessibility, layout responsiveness, and event handling.
- **challenger_m3_1 & challenger_m3_2**: Adversarial UI stress testing (rapid level-ups, extreme health values, resolution changes).
- **auditor_m3**: Forensic verification of UI styling, CSS/Canvas asset integrity, and clean modular code.

### Milestone 4: Visual Proof & Automated E2E Verification Suite (6 Agents)
- **worker_m4_e2e**: Author Playwright E2E tests asserting dynamic animation states and capturing high-resolution visual proof screenshots (>250KB each).
- **reviewer_m4_1 & reviewer_m4_2**: Dual review of E2E coverage, stability, and screenshot fidelity.
- **challenger_m4_1 & challenger_m4_2**: Adversarial check of screenshot artifacts, payload sizes, and test non-flakiness.
- **auditor_m4**: Forensic audit of screenshot artifacts and E2E test authenticity.

### Milestone 5: Green Test Suite & Production Deployment (6 Agents)
- **worker_m5_deploy**: Run complete test suite (Unit + E2E), verify 100% green status, git commit & push to `origin/main`, verify live Vercel deployment.
- **reviewer_m5_1 & reviewer_m5_2**: Dual verification of git diff, build logs, and live production endpoints.
- **challenger_m5_1 & challenger_m5_2**: Adversarial deployment verification (live site functionality, HTTP/2 200 check).
- **auditor_m5**: Pre-victory forensic audit of repository clean state.

### Final Verification Gate (1 Agent)
- **teamwork_preview_victory_auditor**: Independent post-victory auditor executing 3-phase audit against `ORIGINAL_REQUEST.md`.

---

## 📋 Acceptance Criteria Tracking

- [x] **Milestone 2 (Widen Camera FOV & Viewport Optimization)**: Implemented Z = 0.80 camera zoom (+56.25% area, 1200x675 world view), world render pass scaling in `src/main.ts`, 1:1 HUD & modal isolation, dynamic lighting [250, 725]px vignette & 250px player torch, 800px WaveDirector spawn ring, and clamped sky backdrop. All 36 test files (529 tests) 100% green; `npm run build` cleanly succeeds.
- [ ] **Visual Proof (Animations)**: Playwright screenshots / recorded states demonstrate dynamic scaling, rotation, or sprite changes during gameplay.
- [ ] **Visual Proof (FOV & UI)**: Playwright screenshots (>250KB) clearly demonstrate the significantly widened camera view and newly polished, modern UI.
- [ ] **100% Green Tests**: Unit tests and E2E tests updated and pass cleanly without engine crashes.
- [ ] **Deployment**: Git push to `origin/main` verified and Vercel build succeeds.

---

## 🔒 User Approval Gate
Per `RULE[user_global]`: **We do not proceed with implementation without explicit user approval.**
Please respond with **"승인"** (Approve) or **"proceed"** to authorize the 40-agent swarm deployment.
