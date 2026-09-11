# Handoff Report: UI & HUD Subsystem Survey

- **Subsystem**: Modern Dark Fantasy UI/HUD & Level-Up Upgrade Modal
- **Agent**: `explorer_survey_ui`
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_ui`
- **Target Recipient**: Orchestrator (`52278ce8-fed5-44e0-ad05-d44362fee9a5`) and `worker_m3_ui`
- **Date**: 2026-09-11
- **Handoff Type**: Hard Handoff (Phase 0 UI Survey Complete)

---

## 1. Observation

1. **DOM Structure & Canvas Setup (`index.html:23-43`)**:
   `index.html` contains:
   ```html
   <div id="game-container"></div>
   ```
   with CSS:
   ```css
   canvas {
     image-rendering: -moz-crisp-edges;
     image-rendering: -webkit-crisp-edges;
     image-rendering: pixelated;
     image-rendering: crisp-edges;
     width: 100%;
     height: 100%;
     max-width: 100%;
     max-height: 100%;
     aspect-ratio: 16 / 9;
     object-fit: contain;
     display: block;
   }
   ```
   There are no DOM HUD elements or Google Fonts preloaded in `<head>`.

2. **Render Loop HUD & Modal Execution (`src/main.ts:602-607`)**:
   ```ts
   // 11. Gothic HUD Overlay (Cracked Iron Vitality, XP Bar, Timer, Skull Kills, Inventory, Plaque)
   this.hud.render(ctx, hudSnapshot, GrimHarvestGame.FIXED_TIMESTEP);

   // 12. Gothic Level-Up Card Selection Modal Overlay
   if (this.upgradeModal.getIsOpen()) {
     this.upgradeModal.render(ctx, w, h);
   }
   ```
   Both HUD and modal are rendered directly onto the `960x540` 2D Canvas context.

3. **Current Health Bar Implementation (`src/ui/GothicHUD.ts:429-512`)**:
   Coordinates: `barX = 96, barY = 18, barW = 160, barH = 22`.
   The frame is drawn using basic 1px beveled rectangles (`ironBevelLight`, `ironBevelDark`). The fill is a vertical 4-stop linear gradient (`bloodBright -> bloodDark`). The numeric readout is drawn via `ctx.font = GOTHIC_HUD_THEME.fontSmall` (`bold 11px 'Georgia', serif`). The ghost damage bar pauses for `0.35s` (`ghostDrainDelay`), then drains at `maxHealth * 0.75 * dt`.

4. **Current XP Bar & Level Badge (`src/ui/GothicHUD.ts:335-428`)**:
   `barX = 12, barY = 4, barW = width - 24, barH = 10`.
   Filled with `necrotic-emerald` (green) gradient by default.
   Level badge at `x = 16, y = 18, w = 72, h = 22` is a flat rectangular box.

5. **Current Survival Timer & Kill Counter (`src/ui/GothicHUD.ts:718-836`)**:
   Timer at `cx = width / 2, cy = 34` displays `⟨  MM:SS  ⟩` in plain bone ivory text (`#ede5de`).
   Kill counter at `rx = width - 20, ry = 34` displays formatted number with punch scale `1.35x` and procedural 16px skull icon.

6. **Current Upgrade Modal (`src/ui/UpgradeModal.ts:202-373`)**:
   Cards are drawn with width `210` (if <=3) or `184` (if 4), height `330`, starting at `y = 105`.
   Background is an opaque linear gradient `#151122` to `#0b0813`.
   Border stroke is `GOTHIC_HUD_THEME.obsidianBorder` (or `bloodMid` if evolution), switching to green or gold on hover.
   There is **no rarity classification** (Common, Rare, Epic, Legendary).

7. **E2E Playwright Screenshot Locator Constraint (`tests/e2e/horde_survival.spec.ts:686`)**:
   ```ts
   const targetPath = path.join(ARTIFACT_DIR, 'level_up_modal.png');
   await page.locator('canvas#game-canvas').screenshot({ path: targetPath });
   ```
   Playwright screenshot tests capture `canvas#game-canvas` directly.

8. **Test Suite Baseline**:
   Running `npm test` executes Vitest across 33 test files with 488 tests passing cleanly (100% green, 5.28s duration).

---

## 2. Logic Chain

1. **Canvas Pipeline Preservation**:
   From Observation 7, Playwright E2E visual tests capture screenshots strictly on `canvas#game-canvas`. From Observation 2, `GothicHUD` and `UpgradeModal` render directly onto this canvas context. If the UI were moved to DOM overlay elements outside the canvas, all canvas screenshots would be completely devoid of HUD and modal graphics, causing visual proof failures and regression. Therefore, the HUD and Modal must remain Canvas-rendered.
2. **60Hz Performance Invariant**:
   From Observation 8 and `tests/unit/HordeStressAdversarial.test.ts`, the simulation sustains 1,000+ active horde entities at locked 60Hz. Canvas rendering avoids DOM layout thrashing and style recalculations during intensive combat.
3. **Typography Elevation via Google Fonts**:
   From Observations 1, 3, and 5, fonts currently specify `'Cinzel'`, but `'Cinzel'` is not imported into `index.html`. Preloading Google Fonts in `index.html` enables Canvas to immediately render authentic, chiseled Roman serif typography without layout shift.
4. **Fulfilling R3 Dark Fantasy Requirements**:
   - **Health Bar**: Redesign with ornate wrought-iron filigree brackets, cathedral spires, dynamic fluid meniscus, and smoldering amber ghost damage stagger.
   - **Experience Bar**: Shift from green to glowing soul-blue / amethyst gradient (`#4c1d95` -> `#3b82f6` -> `#06b6d4`), add metallic bevels and an octagonal runic level talisman.
   - **Survival Timer & Kills**: Upgrade to antique gold typography (`#fff3b0` -> `#d4af37` -> `#946f08`) in a gothic arched pediment and anatomical skull ledger.
   - **Upgrade Modal**: Add 4 glowing rarity tiers (Common, Rare, Epic, Legendary), dark gothic glassmorphism cards, enhanced procedural skill icons, and traveling border gleam micro-interactions.

---

## 3. Caveats

1. **Virtual Resolution**: The game renders in a virtual resolution of `960x540` that CSS scales to the browser viewport. All HUD and Modal coordinates must strictly operate within `960x540` virtual coordinates.
2. **Offline Font Fallback**: If internet connectivity is unavailable during headless test runs, the browser will fall back to `'Georgia', serif`. All layout math and text bounding boxes must remain stable and visually aligned regardless of whether `'Cinzel'` or `'Georgia'` is active.
3. **Test Signature Invariants**: `GothicHUD.test.ts` asserts specific property names (`displayXP`, `ghostHealth`, `ghostDrainDelay`, `killScaleAnim`, `cachedTimerStr`). These public properties must be strictly preserved.

---

## 4. Conclusion

The HUD and UI subsystems are thoroughly mapped and verified. The current implementation is functionally stable (100% green tests) but visually plain, lacking true dark fantasy filigree, soul-blue/amethyst palettes, and card rarities. 

A complete, actionable technical blueprint has been formulated in `.agents/explorer_survey_ui/analysis.md`. The design preserves 100% canvas rendering compatibility, provides exact geometry and color coordinates for all components, and equips `worker_m3_ui` to implement Milestone 3 rapidly and safely.

---

## 5. Verification Method

To independently verify this survey and prepare for Milestone 3 implementation:

1. **Inspect Survey Report**:
   ```bash
   cat /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_ui/analysis.md
   ```
2. **Verify Test Suite Baseline (100% Green)**:
   ```bash
   npm test
   ```
   Assert that all 33 test files and 488 tests pass.
3. **Verify Canvas Screenshot Target in E2E**:
   Inspect line 686 of `/Users/user/teamwork_projects/metal_slug_web/tests/e2e/horde_survival.spec.ts` to confirm canvas locator usage.
4. **Invalidation Conditions**:
   - Any modification that removes canvas rendering for the HUD or Modal will immediately invalidate this architecture by breaking Playwright E2E canvas screenshots.
   - Any change that alters public property names in `GothicHUD` without updating unit tests will fail `tests/unit/GothicHUD.test.ts`.
