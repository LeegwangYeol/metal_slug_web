# DISPATCH — worker_m4_e2e_artifacts

## Identity
- Subagent Name: `worker_m4_e2e_artifacts`
- Archetype / TypeName: `teamwork_preview_worker`
- Working Directory: `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_e2e_artifacts`
- Parent: Orchestrator (`52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- Milestone: Milestone 4 (Visual Proof & Automated E2E Verification Suite)

---

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Required Reading (Read BEFORE touching any files)
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern/handoff.md`

---

## Exclusive File Ownership
You exclusively own and may edit:
- `tests/e2e/` (specifically authoring or updating Playwright E2E spec files, e.g. `tests/e2e/visual_proof_m4.spec.ts` or modifying existing specs)
- `artifacts/dark_fantasy/` (capturing high-resolution visual proof screenshots)
- Any helper scripts or mock harnesses in `tests/e2e/`

You MUST NOT modify core gameplay/rendering code in `src/` unless fixing minor test harness hook exposes.

---

## Implementation Objectives

### 1. High-Resolution Visual Proof Screenshot Capture (>250KB each)
Capture high-resolution visual proof screenshots into `artifacts/dark_fantasy/`:
1. **Widened FOV (`artifacts/dark_fantasy/widened_fov_battlefield.png`)**:
   - Shows the broader horde battlefield ($1200 \times 675$ visible area at $Z = 0.80$).
   - Shows dense undead horde swarming across the expanded flagstone floor with dynamic radial torch lighting and torch vignette.
   - Assert file size $> 250\text{KB}$ in automated test (`expect(stat.size).toBeGreaterThan(250 * 1024)`).
2. **Modern Dark Fantasy UI (`artifacts/dark_fantasy/modern_gothic_hud.png`)**:
   - Shows the overhauled HUD in action: ornate filigree health bar with layered blood-red gradient and fluid wave, glowing soul-blue / amethyst XP bar with leading soul spark orb, octagonal runic badge, antique gold arched chronometer with phase banner, and anatomical skull ledger with glowing ruby eyes.
   - Assert file size $> 250\text{KB}$ in automated test (`expect(stat.size).toBeGreaterThan(250 * 1024)`).
3. **Dynamic Motion & Animations (`artifacts/dark_fantasy/dynamic_motion_proof.png`)**:
   - Captures character dash with volume-conserving harmonic squash/stretch ($S_x \cdot S_y = 1.0$), weapon attack swing anticipation/follow-through, and enemy walk bobbing or spectral hover.
   - Assert file size $> 250\text{KB}$ in automated test (`expect(stat.size).toBeGreaterThan(250 * 1024)`).
4. **4-Tier Rarity Upgrade Modal (`artifacts/dark_fantasy/upgrade_modal_modern.png`)**:
   - Captures the overhauled `UpgradeModal` displaying Common, Rare, Epic, and Legendary rarity cards with dark gothic glassmorphism, diagonal specular sheens, corner filigree brackets, and custom procedural skill icons.
   - Assert file size $> 250\text{KB}$ in automated test (`expect(stat.size).toBeGreaterThan(250 * 1024)`).

*Tip for achieving crisp >250KB screenshots*:
Ensure high visual density (background flagstone textures, horde particles, blood gradients, lighting buffer) and/or configure browser context with `deviceScaleFactor: 2` (or full canvas $1920 \times 1080$ render scale) so the PNG compression retains rich high-frequency details.

### 2. Automated E2E Regression Suite
1. Ensure all Playwright tests in `tests/e2e/` pass 100% green.
2. Verify survival loop (30s+ active play), level-up card selection via hotkeys (`Digit1`..`Digit4`), pause/resume, and zero console errors (`page.on('console', msg => ...)` and `page.on('pageerror', err => ...)`).
3. Ensure unit tests (`npm test`) continue passing 100% green.

---

## Verification & Deliverables
1. Run `npx playwright test` (or `npm run test:e2e`) and verify all E2E specs pass cleanly.
2. Run `npm test` and verify all 41 unit test suites pass cleanly.
3. Verify that all 4 visual proof screenshots in `artifacts/dark_fantasy/` exist and strictly exceed $250\text{KB}$ ($> 256,000\text{ bytes}$).
4. Write your report to:
   - `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_e2e_artifacts/progress.md`
   - `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_e2e_artifacts/handoff.md`
5. Report completion to parent (`52278ce8-fed5-44e0-ad05-d44362fee9a5`) with your handoff link.

## 2026-09-11T07:23:10Z
You are worker_m4_e2e_artifacts, a teamwork_preview_worker subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_e2e_artifacts

## 2026-09-11T07:30:17Z
**Context**: Milestone 4 Visual Proof & Automated E2E Suite
**Content**: Checking in on your status. Please report your current progress on authoring/running the Playwright E2E suite and capturing the 4 high-resolution visual proof screenshots (>250KB each) into `artifacts/dark_fantasy/`.
**Action**: Please provide an update on your active step.

## 2026-09-11T07:31:55Z
**Context**: Milestone 4 Visual Proof & Automated E2E Suite
**Content**: Please report your current execution status on `visual_proof_m4.spec.ts` and verify if `modern_gothic_hud.png`, `widened_fov_battlefield.png`, `dynamic_motion_proof.png`, and `upgrade_modal_modern.png` have been generated and validated (>250KB each).
**Action**: If tests have passed and artifacts are generated, please write your updated handoff to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_e2e_artifacts/handoff.md` and send your completion report so we can proceed to the Milestone 4 Gate.



