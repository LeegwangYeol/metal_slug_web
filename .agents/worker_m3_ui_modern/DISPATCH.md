# DISPATCH — worker_m3_ui_modern

## Identity
- Subagent Name: `worker_m3_ui_modern`
- Archetype / TypeName: `teamwork_preview_worker`
- Working Directory: `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern`
- Parent: Orchestrator (`52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- Milestone: Milestone 3 (Modern Dark Fantasy UI/HUD Overhaul)

---

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Required Reading (Read BEFORE touching any files)
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_ui/analysis.md`
5. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_ui/handoff.md`

---

## Exclusive File Ownership
You exclusively own and may modify:
- `src/ui/GothicHUD.ts`
- `src/ui/UpgradeModal.ts`
- `index.html`
- `tests/unit/GothicHUD.test.ts` (and any new unit test files for HUD/UI in `tests/unit/`)

You MUST NOT modify files owned by previous or future milestones (`src/render/Camera.ts`, `src/main.ts`, `src/core/entities/Player.ts`, `src/core/entities/Enemy.ts`, `src/core/HordeManager.ts`, `src/render/sprites/DarkFantasySprites.ts`, `src/render/GothicBackdrop.ts`).

---

## Critical Invariants & Constraints
1. **100% Canvas Context**: All HUD elements in `GothicHUD.ts` and cards in `UpgradeModal.ts` MUST render directly onto the HTML5 2D Canvas context (`ctx`). NEVER create DOM overlay elements (divs, spans, buttons) for HUD or Modal. Playwright E2E visual tests capture `canvas#game-canvas` directly.
2. **Virtual Viewport $960 \times 540$**: All UI layout coordinates must operate strictly within $960 \times 540$ virtual resolution.
3. **Public Property Invariants in `GothicHUD`**:
   The unit test suite `tests/unit/GothicHUD.test.ts` asserts these exact public properties:
   - `displayXP: number`
   - `ghostHealth: number`
   - `ghostDrainDelay: number`
   - `killScaleAnim: number`
   - `cachedTimerStr: string`
   - `levelUpFlashTimer: number`
   You MUST retain and properly update these properties in `GothicHUD`.
4. **Canvas State Balance**: Every `ctx.save()` must have a matching `ctx.restore()`. Net stack depth delta across every frame must be strictly 0.

---

## Detailed Implementation Objectives

### 1. Typography & Font Enablers (`index.html`)
- In `index.html` `<head>`, add Google Fonts preconnect and stylesheet links for `'Cinzel'` and `'Cinzel Decorative'`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet" />
  ```
- Ensure robust fallbacks in `GothicHUD.ts` and `UpgradeModal.ts`: `"bold 16px 'Cinzel', 'Cinzel Decorative', 'Georgia', serif"`.

### 2. Ornate Dark Fantasy Health Bar (`src/ui/GothicHUD.ts`)
- **Outer Filigree Casing**: Sculpted wrought-iron filigree brackets, cathedral spires, and antique gold corner micro-studs (`#d4af37`).
- **Dynamic Layered Blood Fill**: 5-stop arterial gradient (`#ff8080` -> `#e52b2b` -> `#a81d1d` -> `#6b1212` -> `#380a0a`) with dynamic sinusoidal fluid meniscus wave animation (`Math.sin(shimmerTimer * 3.5 + px * 0.1) * 1.2`).
- **Smoldering Amber Ghost Bar**: Amber-crimson ember gradient with lingering delay (`ghostDrainDelay = 0.35s`), then smooth drain.
- **Glass Curvilinear Specular Highlight**: Translucent curved overlay across upper half.
- **Typography**: Polished bone ivory numeric readout (`100 / 100`) with solid drop shadow.

### 3. Soul-Blue / Amethyst XP Bar & Octagonal Runic Badge (`src/ui/GothicHUD.ts`)
- **Experience Bar**: Replace plain green with radiant soul-blue to amethyst linear gradient:
  - Deep cosmic void (`#1e0838`) -> Royal amethyst (`#4c1d95`) -> Soul-fire indigo (`#3b82f6`) -> Radiant cyan (`#06b6d4`) -> Incandescent spark (`#e0f2fe`).
- **Metallic Gothic Bevel**: High-contrast obsidian channel with double-beveled borders.
- **Leading Edge Soul Orb**: Glowing circular spark at the current progress position with additive cyan aura.
- **Runic Level Badge**: Octagonal/diamond beveled iron crest with antique gold trim (`#d4af37`), occult rune engravings, and pulsating ascension shockwave on level up.

### 4. Antique Gold Chronometer & Skull Ledger (`src/ui/GothicHUD.ts`)
- **Chronometer**: Arched gothic pediment with antique gold typography (`#fff3b0` -> `#d4af37` -> `#946f08`), phase banner (`PHASE I • THE AWAKENING`, `PHASE II • THE UNDEAD SWARM`, `PHASE III • NIGHTFALL ASCENDANT`).
- **Skull Ledger**: Antique gold & iron ledger tablet, anatomical gothic skull with bone highlights and glowing ruby-crimson eye sockets (`#ff2222`), smooth scale punch animation (`1.35x -> 1.0x`) on enemy elimination, and dynamic swarm density subtitle.

### 5. 4-Tier Rarity Upgrade Selection Cards (`src/ui/UpgradeModal.ts`)
- **Rarity Engine**: Implement 4 glowing rarity tiers:
  - **Common**: Silver / Ash (`#4b4859` border, `#1f1d2b` badge, silver glow).
  - **Rare**: Soul Emerald / Frost Cyan (`#0d9488` border, `#0f2b26` badge, cyan glow).
  - **Epic**: Arcane Amethyst (`#7c3aed` border, `#241242` badge, purple glow).
  - **Legendary**: Celestial Molten Gold / Bloodflame (`#d97706` border, `#3b2207` badge, golden glow).
- **Rarity Derivation**: Assign rarity based on card type, rank, and evolution:
  - Evolution -> Legendary
  - Rank >= 5 or Evolution type -> Epic
  - Rank >= 3 or Passive -> Rare
  - Base / Rank 1-2 -> Common
- **Glassmorphic Card Aesthetics**: Translucent frosted obsidian body (`rgba(18, 14, 28, 0.88)` to `rgba(10, 8, 16, 0.94)`), diagonal specular glass sheen, 4 metallic corner filigree brackets.
- **Micro-Interactions**: Smooth -8px lift on hover, glowing rarity borders, traveling perimeter border gleam animation, and ambient soul spark motes.
- **Custom Procedural Skill Icons**: High-fidelity procedural drawings for all weapon and passive types with glowing cores.
- **Keybind Pills & Buttons**: Embossed `[1]`, `[2]`, `[3]`, `[4]` hotkey buttons with interactive claim button.

---

## Verification & Completion Criteria
1. `npm run build`: Must compile cleanly with 0 errors and 0 warnings.
2. `npm test`: All unit tests in `tests/unit/` must pass 100% green.
3. Write/update unit tests verifying the new HUD features and Upgrade Modal rarity system.
4. Document all changes, file lines, and test outputs in:
   - `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern/progress.md`
   - `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_modern/handoff.md`
5. Send completion message back to parent (`52278ce8-fed5-44e0-ad05-d44362fee9a5`) with your handoff path.
