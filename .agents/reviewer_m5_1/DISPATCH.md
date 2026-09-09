## 2026-09-08T05:57:52Z

You are the Lead Reviewer subagent (teamwork_preview_reviewer) for Milestone M5 (Full Verification Gate & Final Project Review).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m5_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

MISSION & FINAL REVIEW:
Conduct a comprehensive whole-project review against all original user requirements:
1. M1: Boss Encounters & Crisis Engine (CrisisEventManager, Iron Nokana 4 phases, hazards, arena bounds collapse).
2. M2: Autonomous Ally NPCs & Weapons/Items (AllyNPC Hyakutaro, AllyKiBlast, Shotgun, Laser, Rocket Launcher, Shield, Medkit, POW rescues).
3. M3: Ultimate Move System & Procedural Sprites / Cinematic FX (KeyU mapping, 4-phase cinematic pipeline, viewport minion wipe, 120 boss burst damage, zero friendly fire, 164 baseline sprite invariant preserved, Web Audio synthesis).
4. M4: Playwright E2E Integration & Visual Proof Screenshots (29/29 browser tests passing, 8 screenshot artifacts in artifacts/expansion/).
5. Run full verification commands:
   - `npm run build`
   - `npx vitest run`
   - `npx playwright test`
6. Provide an explicit verdict: APPROVE or REQUEST_CHANGES.
7. Write your full report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m5_1/handoff.md`
   and call `send_message` to parent.
