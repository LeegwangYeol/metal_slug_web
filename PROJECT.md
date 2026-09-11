# Project: Grim Harvest — Undead Siege (40-Agent Swarm Enhancement)

## Core Vision & Identity
A grim, brutal, gothic dark-fantasy horde survival shooter inspired by Vampire Survivors.
This enhancement mission overhauls character/enemy animations with dynamic motion (R1), widens the camera field of view (FOV) to reveal a substantially broader battlefield against massive undead hordes (R2), completely redesigns the HUD and Upgrade Selection Menu with modern dark fantasy aesthetics (R3), provides Playwright visual proof screenshots (>250KB) and automated E2E tests (R4), and guarantees 100% green tests and live Vercel production deployment (R5).

---

## 🏛️ Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Entity Animation Clock Fix | Increment `enemy.behaviorTimer` in `HordeManager.ts` to unlock 4-frame sprite walk cycles | M1 | Survey (Anim) |
| 2 | Dynamic Velocity Easing | Critically damped exponential relaxation kinematics replacing linear clamping | M1 | Survey (Anim) |
| 3 | Harmonic Squash & Stretch | Damped harmonic oscillator volume-conserving scale transforms on dashes/turns/impacts | M1 | Survey (Anim) |
| 4 | Weapon Anticipation & Recoil | 3-phase weapon state machine (wind-up, release, follow-through) with torso lean | M1 | Survey (Anim) |
| 5 | Bi-Harmonic Grounded Walk Cycles | Vertical gait bobbing and pelvic sway for Skeletons, Ghouls, and Death Knights | M1 | Survey (Anim) |
| 6 | Spectral Hover & Floating | Dual incommensurate harmonic levitation and shadow-height coupling for Banshee/Necromancer | M1 | Survey (Anim) |
| 7 | Dynamic Flinch & Damage Cascade | Multi-tier damage reaction (impulse squash, angular stumble, 3-phase hit flash) | M1 | Survey (Anim) |
| 8 | Widened Camera FOV ($Z = 0.80$) | Expand visible world area by +56.25% ($1200 \times 675$) with centered damped tracking | M2 | Survey (Camera) |
| 9 | World vs Canvas Isolation | Scale world render pass via camera zoom while rendering HUD 1:1 on 960x540 canvas | M2 | Survey (Camera) |
| 10 | Viewport Culling Adaptation | Expand entity & loot render culling margins to match $1200 \times 675$ view extents | M2 | Survey (Camera) |
| 11 | Wave Spawner Adaptation | Update WaveDirector spawn margins and increase ring surround radius ($670 \to 800\text{px}$) | M2 | Survey (Camera) |
| 12 | Dynamic Radial Lighting Expansion | Scale player torch radius ($200 \to 250\text{px}$) and vignette radius to fit expanded FOV | M2 | Survey (Camera) |
| 13 | Toroidal Backdrop Seam Prevention | Continuous flagstone, rune, and prop tiling across expanded $1200 \times 675$ bounds | M2 | Survey (Camera) |
| 14 | Ornate Filigree Health Bar | Wrought-iron cathedral filigree framing, blood gradient, and amber ghost damage stagger | M3 | Survey (UI) |
| 15 | Soul-Blue & Amethyst XP Bar | High-contrast glowing soul-blue progress bar with metallic bevel and octagonal runic badge | M3 | Survey (UI) |
| 16 | Antique Gold Timer & Skull Ledger | Arched gothic pediment with antique gold chronometer and anatomical skull kill counter | M3 | Survey (UI) |
| 17 | 4-Tier Rarity Upgrade Cards | Common, Rare, Epic, Legendary glowing borders on dark gothic glassmorphism cards | M3 | Survey (UI) |
| 18 | Custom Procedural Skill Icons | Unique gothic iconography and traveling border gleam micro-interactions for upgrade cards | M3 | Survey (UI) |
| 19 | Typography & Font Elevation | Google Font 'Cinzel' preloading in index.html with graceful Georgia offline fallback | M3 | Survey (UI) |
| 20 | Visual Proof Artifacts (>250KB) | High-resolution Playwright screenshot captures for FOV, Modern UI, and Dynamic Motion | M4 | Survey / Req |
| 21 | Automated E2E Regression Suite | 30s+ survival loop, level-up card selection, zero-error assertions | M4 | Survey / Req |
| 22 | 100% Green Unit & E2E Tests | All Vitest and Playwright test suites passing cleanly without regressions | M5 | Survey / Req |
| 23 | Production Deployment Verification | Git push to origin/main verified and live Vercel HTTP/2 200 confirmed | M5 | Survey / Req |

---

## 👥 40-Agent Swarm Milestones & Decomposition

| # | Milestone | Scope | Agent Allocation | Dependencies | Status |
|---|-----------|-------|------------------|--------------|--------|
| 0 | Phase 0: Architectural Survey | Subsystem mapping across Anim, Camera, UI | 3 Explorers | None | **DONE** |
| 1 | Milestone 1: Dynamic Animations & Motion Engine | Entity timer fix, easing, squash/stretch, walk/hover bobs, flinch, weapon anticipation | 1 Worker, 2 Reviewers, 2 Challengers, 1 Auditor | M0 | **DONE** |
| 2 | Milestone 2: Widen Camera FOV & Viewport Optimization | Camera zoom 0.80, world scale, culling/spawning boundaries, radial lighting, backdrop | 1 Worker, 2 Reviewers, 2 Challengers, 1 Auditor | M0 | **DONE** |
| 3 | Milestone 3: Modern Dark Fantasy UI/HUD Overhaul | Filigree health bar, soul-blue XP, runic badge, gold timer, 4-tier rarity glassmorphic cards | 1 Worker, 2 Reviewers, 2 Challengers, 1 Auditor | M0 | **DONE** |
| 4 | Milestone 4: Visual Proof & Automated E2E Suite | Playwright E2E tests, >250KB screenshots for FOV & UI, motion proof validation | 1 Worker, 2 Reviewers, 2 Challengers, 1 Auditor | M1, M2, M3 | **PLANNED** |
| 5 | Milestone 5: 100% Green Tests & Production Deployment | Full test suite verification (unit + E2E), git commit/push to origin/main, live Vercel HTTP/2 200 | 1 Worker, 2 Reviewers, 2 Challengers, 1 Auditor | M4 | **PLANNED** |

---

## 🔗 Interface Contracts & Code Layout

### Code Layout
- `src/render/sprites/DarkFantasySprites.ts`: Sprite rendering, cached atlas transforms (squash, stretch, rotate, bob, flinch). Owned by M1.
- `src/core/entities/Player.ts`: Player kinematic easing relaxation, attack animation state machine. Owned by M1.
- `src/core/entities/Enemy.ts`: Enemy motion state (walk phase, hover phase, flinch state). Owned by M1.
- `src/core/HordeManager.ts`: Entity simulation loop, advancing `behaviorTimer`. Owned by M1.
- `src/render/Camera.ts`: Camera zoom factor ($Z = 0.80$), `viewWidth` ($1200$), `viewHeight` ($675$), coordinate transforms. Owned by M2.
- `src/render/GothicBackdrop.ts`: Toroidal tiling, seam prevention for expanded FOV. Owned by M2.
- `src/render/vfx/DarkFantasyVFX.ts`: Dynamic lighting engine bounds ($1200 \times 675$) and vignette gradients. Owned by M2.
- `src/core/systems/WaveDirector.ts`: Viewport dimensions and ring surround radius ($800\text{px}$). Owned by M2.
- `src/main.ts`: Render loop world scaling (`ctx.scale(zoom, zoom)`) and entity/loot culling bounds. Owned by M2.
- `src/ui/GothicHUD.ts`: Canvas HUD rendering (Health filigree, soul-blue XP, runic badge, gold timer/kills). Owned by M3.
- `src/ui/UpgradeModal.ts`: 4-tier rarity upgrade cards, glassmorphic styling, custom icons, border gleams. Owned by M3.
- `index.html`: Font preloading ('Cinzel'). Owned by M3.
- `tests/e2e/`: Playwright test suite and screenshot artifact generation. Owned by M4.

### Cross-Module Interface Contracts
1. **Camera ↔ Main Render Loop**:
   - `camera.zoom: number` (default `0.80`)
   - `camera.viewWidth: number` (returns `this.viewportWidth / this.zoom`, i.e. `1200`)
   - `camera.viewHeight: number` (returns `this.viewportHeight / this.zoom`, i.e. `675`)
   - `main.ts` executes `ctx.save(); ctx.scale(camera.zoom, camera.zoom);` for passes 1–10, then `ctx.restore();` before HUD pass 11 and modal pass 12.
2. **HordeManager ↔ DarkFantasySprites**:
   - `enemy.behaviorTimer: number` increments by `dt` on every frame.
   - `DarkFantasySprites.drawEnemy` reads `enemy.behaviorTimer` and derives walk frame `Math.floor(timer * 8) % 4`.
   - `DarkFantasySprites.initialize()` preserves the 120-canvas pre-rasterized atlas invariant (5 types $\times$ 4 frames $\times$ 2 facings $\times$ 3 flashes).
3. **Player & Weapons ↔ Render Loop**:
   - `player.attackAnimState: { phase: 'idle'|'windup'|'release'|'followthrough', timer: number, weaponType: string }`
   - `DarkFantasySprites.drawPlayer` applies dynamic squash/stretch and torso lean during attacks and turns.
4. **GothicHUD & UpgradeModal ↔ Canvas**:
   - Both modules render strictly within the native $960 \times 540$ virtual coordinate space, unaffected by camera world zoom.
   - Public properties in `GothicHUD` (`displayXP`, `ghostHealth`, `ghostDrainDelay`, `killScaleAnim`, `cachedTimerStr`) are strictly preserved.
