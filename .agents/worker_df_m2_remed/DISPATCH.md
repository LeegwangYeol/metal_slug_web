## 2026-09-10T11:15:30Z

You are the M2 Remediation Worker for "Grim Harvest: Undead Siege".

Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m2_remed
Project root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Defect Evidence & Reports:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_df_m2_1/handoff.md (Detailed bug analysis and reproduction)
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m2_1/handoff.md (Finding 2 regarding Euclidean modulo)
- Reproducing Test Suite: `tests/unit/ChallengerDF_M2.test.ts` (currently has 5 failing tests for negative camera coordinates)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
1. Fix Negative-Coordinate Modulo Wrapping in `src/render/GothicBackdrop.ts`:
   - In ECMAScript, `-((camX * factor) % W)` returns a positive number when `camX < 0`, causing tiles to shift right and leaving `[0, pX]` unpainted on the left border.
   - For all parallax layers (Layer 0 Sky/Moon, Layer 1 Clouds, Layer 2 Skyline, Layer 6 Mist, and Foreground Mist):
     Calculate the start offset using Euclidean modulo:
     `const startX = -(((camX * factor) % W + W) % W);`
     Then loop to tile across the entire viewport width without gaps:
     `for (let x = startX; x < vw; x += W) { ctx.drawImage(surface, x, y); }`
   - Handle Y-parallax similarly for surfaces that tile vertically (e.g. `const startY = -(((camY * factor) % H + H) % H);`).
   - Ensure Layer 3 (Stone Flagging) does not completely occlude the celestial blood moon sky (e.g. start at/below horizon or blend properly).
2. Fix `src/ui/GothicHUD.ts`:
   - Clamp `ghostDrainDelay = Math.max(0, this.ghostDrainDelay - dt)` so it never drops below 0.
3. Test Verification:
   - Run `npx vitest run tests/unit/ChallengerDF_M2.test.ts` and ensure all 5 previously failing tests now pass cleanly.
   - Run `npm test` and verify that ALL 12+ unit test suites (120+ tests) pass 100% green.
   - Run `npx tsc --noEmit` and verify 0 compilation errors.
   - Run `npm run build` and verify production build succeeds cleanly.
4. Document the fix and command outputs in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m2_remed/handoff.md` and send a message to parent when done.
