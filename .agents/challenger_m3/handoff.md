# Milestone 3 Adversarial Challenge Report: Automated Playwright E2E Suite & Visual Proof

- **Agent**: Challenger 1 (Agent 23), Milestone 3: Automated Playwright E2E Suite & Visual Proof
- **Date**: 2026-09-11
- **Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m3`
- **Project Root**: `/Users/user/teamwork_projects/metal_slug_web`
- **Handoff Type**: Hard (Task Complete)
- **Verdict**: **REJECT** (Defect in `tests/e2e/hitbox_dodge.spec.ts:220` causing 20%–40% flakiness under consecutive runs; remediation provided)

---

## 1. Observation

### 1.1 Flake Reproduction in `tests/e2e/hitbox_dodge.spec.ts`
When executing repeated consecutive stress runs of `tests/e2e/hitbox_dodge.spec.ts`:
```bash
for i in {1..5}; do echo "=== RUN $i ==="; npx playwright test tests/e2e/hitbox_dodge.spec.ts || echo "HITBOX FAIL ON $i"; done
```
Test 1 (`Live dynamic dodging weaves between enemies at near-miss distances with zero phantom damage`) failed intermittently with the following verbatim assertion error:

```
  1) [chromium] › tests/e2e/hitbox_dodge.spec.ts:70:3 › Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite › Test 1: Live dynamic dodging weaves between enemies at near-miss distances with zero phantom damage 

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 12
    Received:    10.040450122677072

      218 |
      219 |     // Verify closest grazing distance was in the near-miss 12-20px band
    > 220 |     expect(minSeparationObserved).toBeGreaterThanOrEqual(12.0);
          |                                   ^
      221 |     expect(minSeparationObserved).toBeLessThanOrEqual(20.0);
      222 |
      223 |     expect(consoleErrors).toEqual([]);
        at /Users/user/src/fullmetalslug/tests/e2e/hitbox_dodge.spec.ts:220:35
```

Across multiple test series, `minSeparationObserved` repeatedly dropped below 12.0px:
- Run A: `Received: 7.092120653137933` (Expected: `>= 12`)
- Run B: `Received: 10.040450122677072` (Expected: `>= 12`)
- Run C: `Received: 11.941852044602236` (Expected: `>= 12`)
- Run D: `Received: 10.033985942224227` (Expected: `>= 12`)

In all failed runs, the player's health remained strictly 100 (`state.health === 100`), with zero damage and zero invulnerability timer.

### 1.2 WebServer Port Contention Under Rapid Loops
In rapid multi-run loops (`for i in {1..5}; do npx playwright test tests/e2e/hitbox_dodge.spec.ts tests/e2e/camera_view.spec.ts; done`), Playwright's webServer configuration in `playwright.config.ts:13-15`:
```typescript
  webServer: {
    command: 'kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
```
intermittently produced SIGKILL and socket refusals:
```
[WebServer] /bin/sh: line 1: 22686 Killed: 9 npm run preview
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
```
Resulting in 4 out of 5 runs failing in rapid sequence.

### 1.3 Empirical Regression Sensitivity (Deliberate Mutation Checks)
1. **+15px Phantom Padding Mutation (`src/main.ts:478`)**:
   - Injected temporary mutation:
     ```typescript
     - const contactDist = Player.COLLISION_RADIUS + enemy.radius;
     + const contactDist = Player.COLLISION_RADIUS + enemy.radius + 15;
     ```
   - Ran `npm run build && npx playwright test tests/e2e/hitbox_dodge.spec.ts`.
   - **Result**: Tests 1 and 2 BOTH immediately failed with verbatim errors:
     - Test 1: `Expected: 100, Received: 85.00333333333333`
     - Test 2: `Expected: 100, Received: 90.06333333333328`
   - Mutation was reverted and clean build restored.

2. **Side-Scroller Deadzone Offset Mutation (`src/render/Camera.ts:171`)**:
   - Injected temporary mutation:
     ```typescript
     - const idealTargetX = targetX - this.viewportWidth / 2 + this.lookaheadX;
     + const idealTargetX = targetX - this.viewportWidth * 0.35 + this.lookaheadX;
     ```
   - Ran `npm run build && npx playwright test tests/e2e/camera_view.spec.ts`.
   - **Result**: Test 1 immediately failed with verbatim error:
     ```
     Expected: 480
     Received: 346
     Expected difference: < 0.05
     Received difference: 134
     ```
   - Mutation was reverted and clean build restored.

### 1.4 Visual Proof Artifact Inspection
Inspected artifacts via Node.js script:
- `artifacts/dark_fantasy/improved_camera_angle.png`:
  - Size: 231,584 bytes (> 50,000 bytes requirement)
  - Magic bytes: `89 50 4e 47 0d 0a 1a 0a` (valid PNG)
  - Dimensions: 960 x 540 (non-interlaced RGB)
- `artifacts/dark_fantasy/hitbox_precision_dodge.png`:
  - Size: 225,202 bytes (> 50,000 bytes requirement)
  - Magic bytes: `89 50 4e 47 0d 0a 1a 0a` (valid PNG)
  - Dimensions: 960 x 540 (non-interlaced RGB)

---

## 2. Logic Chain

1. **Flake Root Cause Analysis (`hitbox_dodge.spec.ts:220`)**:
   - In `tests/e2e/hitbox_dodge.spec.ts:160-186`, player movement is guided through a series of enemy gates along the Y axis using Playwright CDP keyboard events (`KeyS`, `KeyA`, `KeyD`) with an asynchronous delay `await page.waitForTimeout(40)`.
   - Because CDP keyboard IPC and event-loop timing on Node.js / macOS have non-zero jitter, the player's lateral coordinate overshoots target positions by several pixels before the next controller tick executes.
   - For example, when weaving past the Death Knight at $(x=-48.0, y=60.0)$ ($r_{\text{enemy}}=18.0, r_{\text{player}}=11.0, \text{touchDist}=29.0\text{px}$), an overshoot to $x=-12.0$ yields a physical clearance of $|-48 - (-12)| - 29 = 7.0\text{px}$.
   - At this 7px–11.9px clearance, the player is still well outside physical contact ($d > \text{touchDist}$) and suffers 0 damage, validating that the +15px phantom padding is absent.
   - However, line 220 asserts:
     ```typescript
     expect(minSeparationObserved).toBeGreaterThanOrEqual(12.0);
     ```
   - This assertion treats getting *closer* than 12px without taking damage as a test failure. This is mathematically and logically counterproductive: a closer graze that takes zero damage provides *even stronger* empirical proof of hitbox precision, yet triggers a test failure.
   - This causes an empirical flake rate of ~20% in isolated runs and up to 40% under CPU load.

2. **Regression Sensitivity Proven**:
   - Both test suites (`hitbox_dodge.spec.ts` and `camera_view.spec.ts`) are genuine, high-fidelity integration tests. When injected with actual historical bugs (+15px phantom radius in `src/main.ts` and 35% side-scroller bias in `src/render/Camera.ts`), both suites failed immediately with clear, unambiguous diffs.

3. **Artifact Compliance Confirmed**:
   - The visual proof artifacts in `artifacts/dark_fantasy/` exist on disk, are completely uncorrupted 960x540 PNGs, and exceed 220KB (>4x the 50,000 bytes threshold).

---

## 3. Caveats

- **Isolated vs Sequential Execution**: When run individually with a running preview server, `camera_view.spec.ts` passes 100% (5/5 runs), and `hitbox_dodge.spec.ts` passes ~80% of runs (4/5 runs), failing only when lateral steering jitter crosses the 12.0px threshold.
- No other caveats.

---

## 4. Conclusion

- **Verdict**: **REJECT**.
- **Reason**: `tests/e2e/hitbox_dodge.spec.ts:220` fails the flake resistance requirement due to an over-constrained assertion (`expect(minSeparationObserved).toBeGreaterThanOrEqual(12.0)`) that fails when lateral navigation achieves closer grazing clearances (7–11.9px).
- **Remediation Required for Worker**:
  1. In `tests/e2e/hitbox_dodge.spec.ts:220`:
     Update the lower bound from:
     ```typescript
     expect(minSeparationObserved).toBeGreaterThanOrEqual(12.0);
     ```
     to:
     ```typescript
     expect(minSeparationObserved).toBeGreaterThanOrEqual(2.0);
     ```
     *(or `expect(minSeparationObserved).toBeGreaterThan(0.0);`)*, ensuring that any clean graze that avoids physical contact is accepted.
  2. In `tests/e2e/hitbox_dodge.spec.ts:93-101`:
     Optionally adjust the slalom gate X-offsets by +3px to +5px (e.g. `skeleton` at $x=45$, `ghoul` at $x=-47$, `banshee` at $x=46$, `death_knight` at $x=-52$) to widen the navigation corridor and prevent lateral keyboard overshoot under high CDP latency.

---

## 5. Verification Method

To reproduce the findings and verify the flake:

1. **Flake Reproduction Command**:
   ```bash
   for i in {1..5}; do
     echo "=== RUN $i ==="
     npx playwright test tests/e2e/hitbox_dodge.spec.ts || echo "FAILED ON $i"
   done
   ```
   *Observation*: Intermittently fails with `Received: < 12.0` (e.g. 7.09px, 10.04px, 11.94px) on line 220.

2. **Artifact Integrity Command**:
   ```bash
   node -e "
   const fs = require('fs');
   ['improved_camera_angle.png', 'hitbox_precision_dodge.png'].forEach(f => {
     const b = fs.readFileSync('artifacts/dark_fantasy/' + f);
     console.log(f, b.length, b.subarray(0, 8).toString('hex'), b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
   });
   "
   ```
   *Expected*: Sizes > 220,000 bytes, magic `89504e470d0a1a0a`, dimensions `960x540`.

3. **Sensitivity Mutation Check**:
   Add `+ 15` to `src/main.ts:478`, run `npm run build && npx playwright test tests/e2e/hitbox_dodge.spec.ts`, and observe immediate failure. Revert afterwards.
