# Dispatch: Explorer Overhaul 2 (R2 Sprites, Crosshair, Directional Aiming)

## Mission
Investigate R2: High-Resolution Neo Geo Pixel Art Sprites (`ProceduralSpriteFactory.ts`), Dynamic Aiming Crosshair/Reticle (`CanvasRenderer.ts`), and 5-Directional Upper-Body Aiming Animations (`PlayerController.ts`, `ProceduralSpriteFactory.ts`).

## Working Directory
/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2

## Scope & Instructions
1. Read `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md`, `/Users/user/src/fullmetalslug/COLLABORATION.md`, and `/Users/user/src/fullmetalslug/PROJECT.md`.
2. Inspect `src/render/sprites/ProceduralSpriteFactory.ts`, `src/render/CanvasRenderer.ts`, `src/core/player/PlayerController.ts`, `src/core/weapons/WeaponTypes.ts`.
3. Analyze the current sprite generation logic: Why does it look flat/blocky/Atari? How can it be transformed into high-detail, shaded 16-color authentic Neo Geo pixel art (Marco Rossi with headband, muscle highlights, vest, holster; Rebel Soldier with steel rim helmet, gas mask/uniform, rifle; POW with beard, bare chest, rope-bound wrists, wave; vehicles with rivets and rust)?
4. Analyze how to implement dynamic visual aiming reticles/crosshairs along the player's 8-way aim vector (with weapon-specific cues: pistol laser pip/bracket, HMG tactical circle with spread, Flame Shot flame arc).
5. Analyze how to implement distinct upper-body aiming animations/poses for the 5 key aim angles (`FORWARD`, `UP_FORWARD`, `UP`, `DOWN_FORWARD`, `DOWN`).
6. Write a comprehensive technical report and handoff report (`handoff.md`) with verified line numbers, architecture plan, and step-by-step implementation recommendations for Worker 3 & Worker 4.

## 2026-09-03T06:16:14Z
<USER_REQUEST>
You are explorer_overhaul_2.
Working directory: /Users/user/src/fullmetalslug/.agents/explorer_overhaul_2
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/DISPATCH.md

You MUST read /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md before starting work.

Your task:
1. Thoroughly investigate R2: High-Resolution Neo Geo Pixel Art Sprites (ProceduralSpriteFactory.ts), Dynamic Aiming Crosshairs (CanvasRenderer.ts), and 5-Directional Upper-Body Aiming Animations (PlayerController.ts, ProceduralSpriteFactory.ts).
2. Examine why current sprites look primitive/flat "Atari" style and provide complete pixel-art designs and procedural rasterization specifications for Marco, Rebel Soldiers, POW, vehicles, and effects with 16-color authentic shading.
3. Detail the mathematical and visual rendering approach for weapon crosshairs/reticles (pistol pip/bracket, HMG tactical circle with spread, Flame Shot arc) along the aim vector.
4. Detail the 5-directional upper-body aiming sprite poses (FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN).
5. Output your analysis into /Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/survey_report.md and deliver a complete, self-contained handoff.md in your directory. Send a message to orchestrator when done.
</USER_REQUEST>
