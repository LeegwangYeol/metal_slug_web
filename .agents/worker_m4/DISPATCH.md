## 2026-09-03T03:19:31Z
You are worker_m4.
Your working directory is /Users/user/src/fullmetalslug/.agents/worker_m4/.
Project workspace root is /Users/user/src/fullmetalslug/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md

Milestone: M4 — Procedural Pixel-Art Generation, Parallax Backgrounds & Canvas 2D Renderer.

File Write Ownership (Exclusively yours):
- src/render/Camera.ts
- src/render/ParallaxBackground.ts
- src/render/sprites/Palette.ts
- src/render/sprites/ProceduralSpriteFactory.ts
- src/render/CanvasRenderer.ts

Specifications to implement:
1. Procedural 16-Color Pixel-Art Sprite Engine:
   - Authentic Neo Geo / Metal Slug style indexed color palette (`Palette.ts`).
   - Procedural rasterization into cached OffscreenCanvas / Canvas image buffers:
     - Player (Marco soldier: idle, run, jump, crouch, aim 8 directions, knife slash, fire, death).
     - Rebel soldiers (rifleman, knife charger, grenade thrower, shield trooper).
     - Hostage POW (tied, freed, salute, escape).
     - Mid-Boss Iron Technical (hull, tread animation, rotating turret).
     - Tetsuyuki War Fortress (multi-part fortress hull, turrets, laser beam, reactor core).
     - Projectiles (handgun bullet, HMG tracer & casing, flame stream fireball, grenade) and multi-frame explosion anims.
     - HUD badges ("H", "F", grenade icon, score digits).
2. Parallax Background & Camera System:
   - 4-layer parallax scrolling (Layer 0: desert sky & clouds, Layer 1: distant ruins/mountains, Layer 2: midground fortress structures, Layer 3: foreground combat surface).
   - Camera deadzone tracking with forward scrolling lock and boss arena boundary locking.
3. High-Performance Canvas Renderer:
   - Virtual resolution letterbox scaling (480x270 virtual frame buffer cleanly centered and scaled with nearest-neighbor crisp pixel rendering).
   - Render passes: Background Parallax -> Terrain/Platforms -> Entities (Enemies, Boss, POWs, Player) -> Projectiles & Explosions -> HUD Overlay.

Verification:
- Run `npx tsc --noEmit` and confirm 0 errors.
- Run `npm run build` and confirm production bundle compiles cleanly.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/worker_m4/handoff.md and notify orchestrator via send_message.
