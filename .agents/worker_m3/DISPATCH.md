# Dispatch: Worker M3 (High-Resolution Neo Geo Pixel Art Sprites)

## Mission
Upgrade character, enemy, POW, and vehicle sprites from flat primitive "Atari" rectangles to high-resolution, detailed 16-color authentic Neo Geo pixel art in `src/render/sprites/ProceduralSpriteFactory.ts`.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m3

## Exclusive File Ownership
- `src/render/sprites/ProceduralSpriteFactory.ts`

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/survey_report.md`

## Instructions
1. In `src/render/sprites/ProceduralSpriteFactory.ts`, introduce micro-primitive helper routines (`drawPixelCluster`, `drawContouredRect`, `drawBeveledPlate`, `drawRivet`, etc.) using standard 2D canvas context methods compatible with both headless Node and browser environments.
2. Upgrade sprite generation with rich 16-color shaded pixel art:
   - **Marco Rossi**: Red headband with fluttering ribbons, multi-tone blonde hair, 3-tone shaded skin, muscle definition, olive tactical vest with pockets and collar trim, ammo belt with brass cartridges, holster, combat boots.
   - **Rebel Soldiers**: Stahlhelm helmets with metallic rim highlight, gas masks, uniform folds, webbing straps, detailed rifles and knives.
   - **POW (Hostage)**: Untamed bushy beard, ripped yellow shorts, bare torso with anatomical muscle highlights, rope-bound wrists, and animated rescue wave.
   - **Vehicles & Boss**: Riveted steel plates, panel lines, metallic rust/scratches, rotating turret barrels, dynamic smoke/exhaust.
3. Crucial Requirement: Preserve ALL existing sprite cache keys (`player_idle_0..3`, `player_run_0..5`, `player_jump_rise`, `player_jump_fall`, `player_aim_0..7`, `soldier_rifle_idle`, etc.) so that existing unit tests (`tests/unit/render_components.test.ts`) continue to pass 100% green without breaking changes.
4. Run `npm test` using `run_command` and confirm all render and sprite tests pass.
5. Deliver `handoff.md` in your working directory with build & test output.

## 2026-09-03T06:22:35Z
You are worker_m3.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m3
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m3/DISPATCH.md

Exclusive File Ownership:
- src/render/sprites/ProceduralSpriteFactory.ts

Task:
1. Upgrade procedural sprites in src/render/sprites/ProceduralSpriteFactory.ts from primitive flat "Atari" blocks to high-resolution, detailed 16-color authentic Neo Geo pixel art.
2. Introduce micro-primitive helper routines (drawPixelCluster, drawContouredRect, drawBeveledPlate, drawRivet, etc.).
3. Rich detail for Marco Rossi, Rebel Soldiers, POW, Vehicles & Boss, Projectiles, Explosions, HUD.
4. Preserve all existing sprite cache keys.
5. Run npm test and write handoff.md.
