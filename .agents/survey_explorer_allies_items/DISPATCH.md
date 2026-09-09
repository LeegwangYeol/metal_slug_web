## 2026-09-03T16:18:53Z
You are a teamwork_preview_explorer assigned to survey the Allies, Items, and Ultimate Move systems for the Metal Slug Web Massive Expansion.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_allies_items
You MUST read:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md

Your tasks:
1. Thoroughly investigate player controller (src/core/player/), weapon mechanics (src/core/weapons/), projectiles (ProjectileManager.ts), enemy targeting, item drop/pickup systems, and input handling.
2. Map out how to implement:
   - Autonomous Ally NPCs: Companions (e.g. Hyakutaro Ichimonji firing ki blasts or prisoner allies) that spawn, follow the player, acquire enemy targets, and deal damage completely independently of player inputs.
   - Diverse Items & Power-ups: Expanding pickups beyond H/F/G to include Shotgun (spread/knockback), Laser Gun (piercing beam), Rocket Launcher (homing/burst), Medkits (HP restore), and Shields (temporary damage absorption).
   - Ultimate Move Mechanic: Spectacular screen-clearing tactical attack (e.g. SV-001 Kamikaze charge / Heavy Bomber Airstrike) triggered by player input, accompanied by screen freeze/flash, siren sound, visual strike sprite/effect, and clearing or severely damaging all enemies on screen.
   - Automated unit tests asserting autonomous targeting and damage dispatch for allies, weapon/item mechanics, and ultimate move activation.
3. Identify exact files to create or modify, class hierarchies, mathematical models, and event flows.
4. Write your detailed findings and technical recommendations to /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_allies_items/analysis.md and produce a complete handoff.md in your working directory.
5. Send a concise completion message back to the parent orchestrator when done.
