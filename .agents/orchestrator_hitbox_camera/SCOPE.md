# Scope: Hitbox & Camera Overhaul ("Grim Harvest: Undead Siege")

## Architecture & Boundaries
- `src/main.ts`: Contact damage checking loop, player collision query, phantom padding removal (`+ 15` elimination at line 468).
- `src/core/entities/Player.ts`: Player hurtbox radius calibration to tight inner radius ($r = 11.0\text{px}$).
- `src/core/systems/HordeManager.ts`: Enemy collision radii calibration per enemy type (Skeleton $r=11$, Ghoul $r=13$, Banshee $r=12$, Death Knight $r=18$, Necromancer $r=14$).
- `src/core/weapons/`: Weapon projectile collision radii calibration matching visual VFX heads.
- `src/render/Camera.ts`: Top-down omnidirectional camera overhaul. Remove legacy 35%-44% side-scroller deadzone. Implement centered player tracking, smooth damping ($k=8.0$), subtle velocity lookahead ($\le 40\text{px}$), world boundary clamping.
- `src/render/GothicBackdrop.ts`: Parallax mist & gothic backdrop alignment to centered camera without visual seam/jitter.
- `tests/unit/hitbox_precision.spec.ts`: Unit tests verifying zero phantom padding, exact touch vs near miss.
- `tests/unit/camera_tracking.spec.ts`: Unit tests verifying player centering, lookahead clamping, smooth damping.
- `tests/e2e/hitbox_dodge.spec.ts`: Playwright test intentionally dodging enemies without taking damage.
- `tests/e2e/camera_view.spec.ts`: Playwright test capturing improved camera angle and dodge proof screenshots.
- `artifacts/dark_fantasy/`: Visual proof images (`improved_camera_angle.png`, `hitbox_precision_dodge.png`, each >50KB).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Zero Phantom Padding | Remove +15px padding from damage check in src/main.ts:468 | M1 | ORIGINAL_REQUEST.md |
| 2 | Player Hurtbox Calibration | Set Player inner hurtbox radius to r = 11.0px matching sorcerer sprite silhouette | M1 | ORIGINAL_REQUEST.md |
| 3 | Enemy Collision Radii Calibration | Set enemy collision radii: Skeleton 11px, Ghoul 13px, Banshee 12px, Death Knight 18px, Necromancer 14px | M1 | ORIGINAL_REQUEST.md |
| 4 | Weapon Projectile Hitbox Calibration | Calibrate weapon collision radii to match glowing VFX heads | M1 | ORIGINAL_REQUEST.md |
| 5 | Hitbox Unit Test Suite | Comprehensive unit tests for near-miss vs exact touch | M1 | ORIGINAL_REQUEST.md |
| 6 | Centered Camera Tracking | Replace side-scroller deadzones with centered viewport tracking | M2 | ORIGINAL_REQUEST.md |
| 7 | Smooth Damping & Lookahead | Exponential damping (k=8.0) and subtle velocity lookahead (<=40px) | M2 | ORIGINAL_REQUEST.md |
| 8 | Backdrop Parallax Alignment | Seamless parallax backdrop rendering relative to centered camera | M2 | ORIGINAL_REQUEST.md |
| 9 | Camera Unit Test Suite | Unit tests for camera centering, lookahead limits, and smoothing | M2 | ORIGINAL_REQUEST.md |
| 10 | Playwright E2E Dodge Test | Near-miss enemy dodge verification without taking damage | M3 | ORIGINAL_REQUEST.md |
| 11 | Playwright Camera & Visual Proof | High-res screenshots >50KB for camera angle & dodge proof | M3 | ORIGINAL_REQUEST.md |
| 12 | 100% Green Suite & Build | Full pass of npm test, npx playwright test, tsc, and build | M4 | ORIGINAL_REQUEST.md |
| 13 | Git Push & Vercel Verification | Push to origin/main and verify HTTP/2 200 on live Vercel URL | M4 | ORIGINAL_REQUEST.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Precision Hitbox & Collision Subsystem | Features 1–5 (zero padding, tight hurtboxes/hitboxes, unit tests) | None | DONE |
| 2 | Camera Overhaul & Cinematic Viewport | Features 6–9 (centered tracking, damping, lookahead, backdrop) | M1 | DONE |
| 3 | Automated Playwright E2E & Visual Proof | Features 10–11 (E2E dodge test, visual screenshots >50KB) | M1, M2 | DONE |
| 4 | Green Test Suite & Production Deployment | Features 12–13 (full suite pass, git push, live Vercel HTTP/2 200) | M1, M2, M3 | IN_PROGRESS |
