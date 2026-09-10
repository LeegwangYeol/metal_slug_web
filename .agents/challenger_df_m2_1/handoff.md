# Handoff Report — Challenger 1 (Milestone M2: Dark Fantasy Art & Gothic Render Engine)

**Agent**: `challenger_df_m2_1`  
**Role**: Empirical Challenger (critic, specialist)  
**Milestone**: M2 — Dark Fantasy Art & Gothic Render Engine  
**Project Root**: `/Users/user/teamwork_projects/metal_slug_web`  
**Verdict**: 🔴 **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Direct Tool Execution Results
1. **Existing Baseline Unit Tests**:
   Command: `npx vitest run tests/unit/GothicBackdrop.test.ts tests/unit/DarkFantasyPalette.test.ts`
   ```text
   ✓ tests/unit/DarkFantasyPalette.test.ts (8 tests) 2ms
   ✓ tests/unit/GothicBackdrop.test.ts (8 tests) 4ms
   Test Files  2 passed (2)
        Tests  16 passed (16)
     Duration  164ms
   ```

2. **Empirical Challenge Verification Harness**:
   Created and executed `/Users/user/teamwork_projects/metal_slug_web/tests/unit/ChallengerDF_M2.test.ts`.
   Command: `npx vitest run tests/unit/ChallengerDF_M2.test.ts`
   Output:
   ```text
   [Backdrop Benchmark] 1,000 iterations took 11.23ms (Avg: 0.0112ms/call)
   [1,000 Entities Draw Benchmark] Executed in 0.803ms

   Layer 0 Sky Gaps: [
     'Angle 45° (camX=566, camY=566) VERTICAL GAP in Sky: [[528.68,540]]',
     'Angle 90° (camX=0, camY=800) VERTICAL GAP in Sky: [[524,540]]',
     'Angle 135° (camX=-566, camY=566) HORIZONTAL GAP in Sky: [[0,11.32]]',
     'Angle 135° (camX=-566, camY=566) VERTICAL GAP in Sky: [[528.68,540]]',
     'Angle 180° (camX=-800, camY=0) HORIZONTAL GAP in Sky: [[0,16]]',
     'Angle 225° (camX=-566, camY=-566) HORIZONTAL GAP in Sky: [[0,11.32]]',
     'Angle 225° (camX=-566, camY=-566) VERTICAL GAP in Sky: [[0,11.32]]',
     'Angle 270° (camX=0, camY=-800) VERTICAL GAP in Sky: [[0,16]]',
     'Angle 315° (camX=566, camY=-566) VERTICAL GAP in Sky: [[0,11.32]]'
   ]

   Layer 1 Cloud Gaps: [
     'Angle 135° (camX=-707, camY=707) HORIZONTAL GAP in Clouds: [[0,35.35]]',
     'Angle 180° (camX=-1000, camY=0) HORIZONTAL GAP in Clouds: [[0,50]]',
     'Angle 225° (camX=-707, camY=-707) HORIZONTAL GAP in Clouds: [[0,35.35]]'
   ]

   Layer 2 Skyline Gaps: [
     'Angle 135° (camX=-707, camY=707) HORIZONTAL GAP in Skyline: [[0,106.05]]',
     'Angle 180° (camX=-1000, camY=0) HORIZONTAL GAP in Skyline: [[0,150]]',
     'Angle 225° (camX=-707, camY=-707) HORIZONTAL GAP in Skyline: [[0,106.05]]'
   ]

   Layer 3 Flagstone Gaps: []

   Layer 6 Mist Gaps: [
     'Angle 135° (camX=-707, camY=707) HORIZONTAL GAP in Mist Sub-Layer A: [[0,282.8]]',
     'Angle 180° (camX=-1000, camY=0) HORIZONTAL GAP in Mist Sub-Layer A: [[0,400]]',
     'Angle 225° (camX=-707, camY=-707) HORIZONTAL GAP in Mist Sub-Layer A: [[0,282.8]]'
   ]

   FAIL tests/unit/ChallengerDF_M2.test.ts > Challenger M2 Empirical Verification Suite > Objective 1.3: Parallax Offsets & Seamless Wrapping (360-degree)
   ```

### 1.2 Code Observations in `src/render/GothicBackdrop.ts`
1. **Layer 0 (Celestial Sky & Blood Moon Eclipse)**, lines 375–384:
   ```ts
   if (this.skyCanvas) {
     const pX = -((camX * 0.02) % 1024);
     const pY = -((camY * 0.02) % 540);
     ctx.drawImage(this.skyCanvas, pX, pY);
     if (pX + 1024 < vw) {
       ctx.drawImage(this.skyCanvas, pX + 1024, pY);
     }
   } else {
     ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
     ctx.fillRect(0, 0, vw, vh);
   }
   ```
   - When `camX < 0` (e.g. `camX = -500`), `(camX * 0.02) % 1024` evaluates to `-10`. Negating yields `pX = +10`.
   - `ctx.drawImage` draws starting at `x = 10`. The interval `[0, 10]` is unpainted.
   - `pX + 1024 = 1034 >= 960 (vw)`, so `if (pX + 1024 < vw)` is false. No trailing image is rendered.
   - For `pY`: Sky canvas height is `540`. There is zero vertical wrapping logic. When `camY > 0`, `pY < 0`, leaving the bottom unpainted. When `camY < 0`, `pY > 0`, leaving the top unpainted.
   - `ctx.fillRect(0, 0, vw, vh)` is placed only in the `else` branch, so unpainted gaps reveal unpainted canvas background.

2. **Layer 1 (Drifting Storm Clouds)**, lines 388–393:
   ```ts
   const cX = -((camX * 0.05 + elapsedTime * 14.0) % 1920);
   ctx.drawImage(this.cloudCanvas, cX, 0);
   if (cX + 1920 < vw) {
     ctx.drawImage(this.cloudCanvas, cX + 1920, 0);
   }
   ```
   - When `camX * 0.05 + elapsedTime * 14.0 < 0`, `cX > 0`, leaving `[0, cX]` unpainted on the left screen edge.

3. **Layer 2 (Distant Graveyard Skyline Silhouette)**, lines 397–402:
   ```ts
   const sX = -((camX * 0.15) % 1920);
   const horizonY = vh * 0.35;
   ctx.drawImage(this.skylineCanvas, sX, horizonY);
   if (sX + 1920 < vw) {
     ctx.drawImage(this.skylineCanvas, sX + 1920, horizonY);
   }
   ```
   - When `camX < 0`, `sX > 0`, leaving up to 150px unpainted gap on the left, causing the skyline silhouette to abruptly clip.

4. **Layer 6 (Rolling Ground Mist)** & **Foreground Mist**, lines 480–495, 514–519:
   - Same negative-sign modulo defect occurs for `mX1`, `mX2`, and `mX`, leaving up to 400px gaps on the left viewport edge.

5. **Camera Coordinates in Game Environment (`src/main.ts`)**:
   - `player.arenaBounds` is `minX: -2000, maxX: 2000, minY: -2000, maxY: 2000` (lines 61–66).
   - Player starts at `(0, 0)` and moves in all 360 degrees.
   - Viewport is 960x540. Top-left of camera `renderX` is `-480` and `renderY` is `-270` at spawn!
   - As a result, the game immediately spawns with negative camera coordinates, triggering the seam and tearing bugs from frame 1.

---

## 2. Logic Chain

1. **Observation 1.1 & 1.2** show that backdrop execution speed (0.0112ms) and offscreen entity blitting (0.803ms for 1,000 entities) easily exceed the performance requirements (both << 1.0ms and << 16.6ms).
2. However, **Objective 1.3** specifically demands:
   *"Verify that parallax offsets wrap seamlessly during 360-degree camera motion without seams or visual tearing."*
3. In ECMAScript, the `%` operator is a remainder operator, not a Euclidean modulo. When the dividend is negative, the remainder is negative. Negating it produces a positive number: `-((-10) % 1024) = +10`.
4. The backdrop implementation assumed offsets `pX`, `cX`, `sX`, `mX` are always non-positive (`<= 0`) and only checked whether the right edge needed extension (`if (offset + W < vw)`).
5. When the camera moves left (`camX < 0`), the computed offset is strictly positive (`> 0`). The surface is drawn starting at `x = offset`, leaving `[0, offset]` uncovered. Since `offset + W > vw`, the trailing tile condition fails, leaving a gaping seam on the left screen border.
6. Furthermore, Layer 0 (Sky canvas) has a height of 540 matching the viewport height. Any vertical camera movement (`camY != 0`) shifts the canvas vertically (`pY != 0`) with zero vertical wrapping, exposing an unpainted horizontal bar at the top or bottom of the screen.
7. Because the game is a 360-degree horde survival shooter centered at `(0, 0)` with negative world bounds `[-2000, 2000]`, the camera regularly operates in negative coordinate space. The visual tearing occurs continuously during normal gameplay.
8. Therefore, the implementation fails Objective 1.3 and must be remediated.

---

## 3. Caveats

- **Layer 3 (Flagstone Floor)** and **Layer 4 / 5 (Runes / Props)** correctly handle negative camera coordinates using proper tile math (`-((camX % fSize) + fSize) % fSize`) and `Math.floor()`. They showed 0 gaps in all tests.
- Challenger 2 also uncovered a minor delay underflow in `GothicHUD.ts` (`ghostDrainDelay` reaching `-0.002` instead of clamping to 0).
- This challenge does not alter production files, in accordance with the `review-only` constraint.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The render performance and offscreen sprite blitting are exceptional (0.011ms backdrop, 0.803ms for 1,000 entities). However, Milestone M2 cannot be approved in its current state because **parallax offsets do NOT wrap seamlessly during 360-degree camera motion**, resulting in confirmed visual seams and unpainted screen gaps across Layers 0, 1, 2, 6, and the foreground mist whenever `camX < 0` or `camY != 0`.

### Required Actionable Remediations for Worker DF M2:
1. **Always clear the base void background** at the start of `GothicBackdrop.render()`:
   ```ts
   ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
   ctx.fillRect(0, 0, vw, vh);
   ```
2. **Normalize horizontal wrapping offsets** so `startX <= 0` and loop until `x >= vw`:
   ```ts
   // Layer 0 (Sky):
   let pX = -((camX * 0.02) % 1024);
   if (pX > 0) pX -= 1024;
   let pY = -((camY * 0.02) % 540);
   if (pY > 0) pY -= 540;
   for (let x = pX; x < vw; x += 1024) {
     for (let y = pY; y < vh; y += 540) {
       ctx.drawImage(this.skyCanvas, x, y);
     }
   }

   // Layer 1 (Clouds):
   let cX = -((camX * 0.05 + elapsedTime * 14.0) % 1920);
   if (cX > 0) cX -= 1920;
   for (let x = cX; x < vw; x += 1920) {
     ctx.drawImage(this.cloudCanvas, x, 0);
   }

   // Layer 2 (Skyline):
   let sX = -((camX * 0.15) % 1920);
   if (sX > 0) sX -= 1920;
   for (let x = sX; x < vw; x += 1920) {
     ctx.drawImage(this.skylineCanvas, x, horizonY);
   }

   // Layer 6 (Mist Sub-layer A & B):
   let mX1 = -((camX * 0.40 + elapsedTime * 20.0) % 1024);
   if (mX1 > 0) mX1 -= 1024;
   for (let x = mX1; x < vw; x += 1024) {
     ctx.drawImage(this.mistCanvas, x, 0);
   }
   let mX2 = -((camX * 0.65 - elapsedTime * 28.0) % 1024);
   if (mX2 > 0) mX2 -= 1024;
   let mY2 = -((camY * 0.65 + Math.sin(elapsedTime * 0.5) * 15) % 540);
   if (mY2 > 0) mY2 -= 540;
   for (let x = mX2; x < vw; x += 1024) {
     for (let y = mY2; y < vh; y += 540) {
       ctx.drawImage(this.mistCanvas, x, y);
     }
   }

   // Foreground Mist:
   let mX = -((camX * 0.85 + elapsedTime * 35.0) % 1024);
   if (mX > 0) mX -= 1024;
   for (let x = mX; x < vw; x += 1024) {
     ctx.drawImage(this.mistCanvas, x, 0);
   }
   ```
3. **Clamp HUD Ghost Drain Delay** in `GothicHUD.ts` line 195:
   ```ts
   if (this.ghostDrainDelay > 0) {
     this.ghostDrainDelay = Math.max(0, this.ghostDrainDelay - dt);
   }
   ```

---

## 5. Verification Method

To independently reproduce this failure and verify the subsequent fix:

1. Run the empirical challenge verification harness:
   ```bash
   npx vitest run tests/unit/ChallengerDF_M2.test.ts
   ```
   - **Current result**: 5 tests fail under `Objective 1.3: Parallax Offsets & Seamless Wrapping (360-degree)` with exact interval gaps printed to stdout.
   - **Invalidation Condition**: Once worker applies the normalization loops above, all 8 tests in `tests/unit/ChallengerDF_M2.test.ts` pass with 0 gaps across all 360-degree angles.

2. Run the full unit test suite:
   ```bash
   npm test
   ```
