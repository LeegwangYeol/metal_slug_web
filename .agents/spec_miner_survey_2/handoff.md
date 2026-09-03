# Handoff Report: R1 & R2 Specification Mining (spec_miner_survey_2)

## 1. Observation
- **Original Requirements**: Read `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md`, lines 12-16:
  > "### R1. Core Game Mechanics & Engine  
  > Build a multi-stage web game using a suitable library/engine chosen by the team (e.g., Phaser.js). Implement movement, jumping, melee attacks, and ranged shooting.  
  > ### R2. Weapon Upgrades & Combat  
  > Implement a system where picking up items upgrades the player's weapon (e.g., machine gun, flamethrower) with distinct firing behaviors and sound effects."
- **Collaboration Plan**: Read `/Users/user/src/fullmetalslug/COLLABORATION.md`, lines 17-49:
  - Line 18: "Decoupled Simulation Core (`src/core/`): Independent of DOM/Canvas/WebGL. Runs purely in memory. Pure state machines for Player, Weapons, Bullets, Enemies, Bosses, and Item drops."
  - Line 30-36: 8-directional aiming & shooting, run, jump with variable height/momentum, crouch crawl, fall through semi-solid platforms, automatic knife slash when within threshold distance, parabolic grenade throw with bounce physics and AOE blast.
  - Line 39-48: Default Handgun (infinite, semi-auto), Heavy Machine Gun ("H", 200 rounds, spray sweep angle), Flame Shot ("F", piercing multi-hit continuous fireball, burning AOE), Hostage POWs (rescuable, drop weapon badges/grenades/items), Ammo system (auto-fallback to pistol).
- **Workspace State**: Read workspace root `/Users/user/src/fullmetalslug/`, containing only `COLLABORATION.md` and `ORIGINAL_REQUEST.md`. No legacy conflicting code present.
- **Specification Report Created**: Successfully wrote `/Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md` (368 lines, 16.5 KB) containing mathematical models, kinematic constants, TypeScript contracts, state machine tables, features discovered, and 12 edge cases.

## 2. Logic Chain
1. **Decoupled Simulation Requirement**: In accordance with `COLLABORATION.md` line 18 and `ORIGINAL_REQUEST.md` line 25 (R5), the core engine must run headless with zero DOM/Canvas dependencies. Therefore, all coordinate calculations, kinematics, and bounding box intersections must use standard Cartesian math $(+X \text{ right}, +Y \text{ down})$ with a 60Hz fixed timestep $\Delta t = 1/60\text{ s}$.
2. **Ground vs Airborne 8-Way Aiming**: In authentic Metal Slug gameplay, pressing Down while grounded triggers Crouch rather than shooting downward through the floor. Downward vertical and downward diagonal aiming vectors are strictly valid only while airborne. Crouch shooting fires horizontally forward at a lowered muzzle offset ($Y - 12\text{px}$).
3. **Melee vs Ranged Arbitration**: To prevent shooting when slashing, the fire button input must first test a forward melee scan box ($38\text{px}$ forward, $6\text{px}$ rear, $[-34, +10]\text{px}$ vertical). If a living, melee-vulnerable enemy is present, the action allocates a knife attack state ($3\text{ HP}$ instant damage, frame 5-9 active) and suppresses projectile creation.
4. **HMG Angle Sweeping**: Authentic arcade feel requires that rotating the aim vector while holding fire does not snap instantly, but sweeps at angular velocity $\omega = 12\text{ rad/s}$ with a stochastic jitter $\delta \in [-0.045, +0.045]\text{ rad}$.
5. **Flame Shot Piercing & Ground AOE**: Because flame projectiles pierce without destruction, per-target tick cooldowns ($6\text{ frames}$) are necessary to avoid instant single-frame kills. Wall/ground impact must spawn a persistent 1.2s burning zone.
6. **Grenade Bouncing & Fallback Logic**: Parabolic trajectory with restitution coefficients ($e_y = 0.5, e_x = 0.7$) allows authentic rolling/bouncing behavior. Ammo zeroing instantly schedules an automatic weapon fallback to default pistol.
7. **POW 6-State Pipeline**: A linear deterministic state progression (`TIED_UP` $\to$ `FREED` $\to$ `SALUTE` $\to$ `OFFERING_ITEM` $\to$ `ESCAPING` $\to$ `SAVED`) ensures predictable drops and bonus score tallies ($10,000\text{ pts}$).

## 3. Caveats
- **Hardware Framerate Variance**: The specification assumes a fixed simulation tick of 60Hz. If the game is rendered on higher refresh rate monitors (120Hz/144Hz), the game loop must use a fixed-timestep accumulator pattern (`dt = 1/60`) to avoid running physics too fast.
- **Weapon Recoil**: Downward firing in air in original Metal Slug does not stall jump momentum, unlike some modern platformers. This design adheres strictly to original arcade physics.
- **Armored Targets**: The melee knife decision matrix deliberately rejects heavy vehicles and bosses unless specifically flagged `isMeleeVulnerable: true`.

## 4. Conclusion
Comprehensive and mathematically complete technical specifications for R1 (Core Mechanics & Engine) and R2 (Weapons & Combat) have been synthesized and documented in `/Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md`. The definitions include full kinematic equations, state transition tables, 12 edge cases with empirical resolutions, and copy-pasteable TypeScript interfaces ready for immediate implementation by Track A workers (`Worker 1` and `Worker 2`) and test authoring by Track B (`Worker 6`).

## 5. Verification Method
1. **Inspect Report Content**:
   View `/Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md`.
2. **Check Completeness against R1 & R2**:
   - Section 2: 8-way aiming matrix (Table in §2.2), player physics constants (Table in §2.3), AABB hitboxes (§2.4), one-way drop math (§2.5), melee proximity matrix (§2.6).
   - Section 3: Default handgun (§3.2), HMG angle sweep and brass casing (§3.3), Flame Shot piercing & AOE (§3.4), Grenade parabolic bounce (§3.5), Ammo auto-fallback (§3.6), POW 6-state machine and drop table (§3.7).
   - Section 4: Pure TypeScript interfaces (`Vector2D`, `PlayerPhysicsConstants`, `WeaponConfig`, `PowEntity`, etc.).
   - Section 5: Locomotion & Weapon State Machine Transition Matrices.
   - Section 6: Features Discovered table.
   - Section 7: Edge Cases & Empirical Resolution table.
3. **Downstream Unit Test Validation**:
   When `vitest` test suites are written by Worker 6 / testing agents, the tests can import the constants and assert exact matches for `runSpeed = 132`, `jumpImpulse = -348`, `gravity = 720`, `jumpReleaseCutRatio = 0.45`, `meleeThreshold = 38px`, and `hmgAmmo = 200`.
