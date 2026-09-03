# Handoff Report: Specification Miner (R3, R4, R5)

**Agent**: `spec_miner_survey_3`  
**Recipient**: Parent Orchestrator (`084b764e-0b87-4c6e-b6aa-67ece754bc64`)  
**Type**: Hard (Task Complete)  
**Deliverable**: `/Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md`

---

### 1. Observation
- `ORIGINAL_REQUEST.md` (lines 18-26, 29-34) specifies requirements:
  - R3: "Develop varied enemies, mid-bosses, and end-bosses with unique attack patterns, phases, and gimmicks across multiple stages."
  - R4: "Autonomously source or generate placeholder visual assets (character motions, effects) and audio files (voice clips, sound effects) to emulate the classic arcade feel."
  - R5: "Decouple core game logic from rendering so that behaviors (health, weapon states, enemy AI) can be verified via automated test scripts."
  - Acceptance Criteria: State machine automated tests, headless browser initialization without fatal console errors.
- `COLLABORATION.md` (lines 50-68, 70-80) provides concrete design parameters:
  - Infantry: Rebel Soldier (Rifleman, Knife Charger, Grenade Thrower), Shield Trooper.
  - Mid-Boss: Rebel Iron Technical / Half-track Armored Vehicle with rotating cannon and troop deployment.
  - Stage 1 End-Boss: Tetsuyuki War Fortress with Phase 1 artillery/rockets, Phase 2 hull breach/laser sweep, Phase 3 emergency thrusters/weak-points, and chain explosion death sequence.
  - Graphics & Audio: Procedural 16-color pixel-art sprites, Web Audio API sound synthesis, and formant filter announcer speech clips ("HEAVY MACHINE GUN!", "FLAME SHOT!", "OK!", "MISSION COMPLETE!").
  - Test Suite: Decoupled Vitest unit tests and Playwright E2E 60fps canvas test with zero console errors.
- Peer dispatch review: `spec_miner_survey_2` focuses on R1 (core mechanics, physics, 8-way aiming, melee threshold) and R2 (weapons system, ammo, HMG/FlameShot, POW drop tables).

---

### 2. Logic Chain
1. **Enemy AI & Boss Design (R3)**:
   - Ground infantry require distinct tactical roles: Rifleman (suppressive ranged fire), Knife Charger (fast closing threat forcing melee counter), Grenade Thrower (indirect curved fire bypassing low cover), and Shield Trooper (directional frontal invulnerability forcing flanking or melee).
   - Mid-Boss requires tread movement oscillation, $360^\circ$ turret tracking with angular velocity clamping ($\omega_{\max} = 1.8\text{ rad/s}$), and dynamic add spawning with an active add limit (3) to prevent screen overcrowding.
   - Stage 1 Boss ("Tetsuyuki War Fortress") must feature 3 distinct damage-gated phases (Phase 1: Artillery + Homing Rockets; Phase 2: Hull breach + Gatling + Thermal Laser sweep; Phase 3: Thruster meltdown shockwaves + exposed $48\times 48\text{ px}$ reactor core weakpoint taking $1.5\times$ damage) followed by a 4-stage timed chain explosion sequence ($3.2\text{ s}$).
2. **Procedural Pixel Art & Web Audio Synthesis (R4)**:
   - To satisfy the zero external asset dependency requirement, graphics are procedurally generated into cached OffscreenCanvas buffers using authentic Neo Geo 16-color indexed palette tables and mathematical limb rotation / cellular dithering algorithms.
   - For audio, procedural FM/waveshaping synthesis models gunshots and explosions, while a Source-Filter Formant Speech Synthesizer uses a Rosenberg glottal pulse train and 4-band biquad bandpass filters with exact acoustic formants ($F_1, F_2, F_3, F_4$) to render the iconic arcade announcer voice clips.
3. **Headless Unit Testing & Playwright E2E Criteria (R5)**:
   - Core simulation in `src/core/` runs with fixed $\Delta t = 1/60\text{ s}$ without any DOM dependency, allowing pure mathematical testing in Vitest.
   - Playwright E2E test validates 60 FPS performance over 300 continuous frames ($5.0\text{ s}$) with criteria: `avgFps >= 58.0`, `droppedFrames <= 5`, `maxFrameTime <= 33.33ms`, and zero uncaught console errors/exceptions.

---

### 3. Caveats
- Speech formant synthesis provides authentic robotic arcade announcer voice styling; pronunciation and intelligibility depend on precise millisecond filter transition interpolation. Pre-rendered AudioBuffer caching at game initialization is recommended to ensure zero runtime audio thread latency.
- Playwright E2E 60fps benchmark may experience minor variance across heavily loaded host machines; a threshold of $\ge 58.0$ FPS with $\le 5$ dropped frames accommodates normal CI scheduler jitter while strictly catching performance regressions.

---

### 4. Conclusion
A complete, rigorous technical specification for R3, R4, and R5 has been produced and saved to `/Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md`. It includes:
- Features Discovered table (20 entries) and Edge Cases table (13 entries).
- State machine transition tables and math formulas for all 4 infantry types, Mid-Boss Iron Technical, and the 3-phase Tetsuyuki War Fortress.
- Pixel-art procedural rasterization formulas, palette definitions, and 4-layer parallax scroll math.
- Web Audio API patch formulas and acoustic formant target tables for 4 announcer voice clips.
- Vitest headless unit testing interfaces and Playwright 60fps / zero-error E2E verification criteria.

---

### 5. Verification Method
- Inspect the generated specification file:
  `cat /Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md`
- Verify that all required sections, markdown tables, mathematical models, and testing criteria are fully populated without placeholders.
