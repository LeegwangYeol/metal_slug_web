# Dispatch Log

## 2026-09-04T01:17:16+09:00

You are the Project Orchestrator (teamwork_preview_orchestrator) for the Metal Slug Web Massive Expansion milestone.

Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion
Project Directory: /Users/user/teamwork_projects/metal_slug_web (symlink to /Users/user/src/fullmetalslug)
Original Request: /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
Collaboration Guide: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

User Approval Status: EXPLICITLY APPROVED ("승인", 2026-09-03T16:16:25Z). Proceed autonomously with full force!

Requirements:
1. R1. Epic Bosses & Crisis Events:
   - Implement new, highly challenging boss encounters with multiple phases (e.g. Iron Nokana, Hairbuster Riberts, or multi-phase stage boss) with distinct phases, telegraphed attacks, and rage states.
   - Introduce dynamic "Crisis Situations" during boss fights (e.g. screen-filling attacks, environmental artillery hazards, or collapsing terrain altering active platform/camera bounds) triggered at specific HP thresholds (e.g. 75%, 50%, 25%).
   - Automated unit tests asserting that specific HP thresholds trigger environment-altering crisis events (spawning hazards, altering bounds).

2. R2. Allies, Items, & Ultimate Moves:
   - Autonomous Ally NPCs: Companions (e.g. Hyakutaro Ichimonji firing ki blasts or prisoner allies) that spawn, follow, acquire enemy targets, and deal damage completely independently of the player. Unit tests verifying autonomous targeting and damage dispatch.
   - Diverse Items & Power-ups: Expand weapon/item pickups beyond H/F/G to include Shotgun (spread/knockback), Laser Gun (piercing beam), Rocket Launcher (homing/burst), Medkits (HP restore), and Shields.
   - Ultimate Move Mechanic: Spectacular screen-clearing tactical attack (e.g. SV-001 Kamikaze charge / Heavy Bomber Airstrike) triggered by player input, accompanied by screen freeze/flash, siren sound, visual strike sprite/effect, and clearing or severely damaging all enemies on screen.

3. R3. Autonomous Scaling & Rigorous Testing:
   - Playwright E2E Test (Ultimate Move): Headless browser test MUST trigger the ultimate move and verify that it correctly clears or severely damages all enemies on screen.
   - Code Verification (Allies): Tests must assert that ally NPCs spawn correctly, acquire targets, and deal damage independently of the player.
   - Code Verification (Crisis Events): Boss tests must verify that specific HP thresholds trigger environment-altering crisis events (e.g. spawning hazards or changing active bounds).
   - Visual Proof: Playwright screenshots capturing the Ultimate Move execution and the new Boss/Crisis environments saved to artifacts/expansion/.
   - Maintain 100% test pass rate across all existing (294 unit tests, 17 E2E tests) and new tests, with zero build errors.
