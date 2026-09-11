# Grim Harvest: Undead Siege

> A brutal, gothic dark-fantasy horde survival shooter inspired by *Vampire Survivors*, featuring dynamic procedural animations, an expanded battlefield field of view, and an ornate, modern dark fantasy UI.

---

## 🌐 Live Production Deployments

| Environment | URL | Status | Description |
| :--- | :--- | :--- | :--- |
| **Canonical Production** | **`https://metal-slug-web-lovat.vercel.app`** | 🟢 Active | Primary authentic production deployment serving the full game, preloaded Cinzel typography, and Vite bundle. |
| **Secondary Production** | **`https://metalslugweb.vercel.app`** | 🟢 Active | Secondary production mirror under team deployment. |

### ⚠️ Domain Alias Collision Notice
> **Important Note on `metal-slug-web.vercel.app`**:  
> The domain alias `metal-slug-web.vercel.app` is owned by an **external third-party project** serving an obsolete 339-byte legacy prototype. It is **not** associated with this repository. The authentic, verified canonical production deployment for this project is strictly **`https://metal-slug-web-lovat.vercel.app`**.

---

## ⚔️ Project Overview & Architecture

*Grim Harvest: Undead Siege* challenges players to survive relentless waves of the undead across a sprawling, torchlit gothic battlefield. The engine is engineered from scratch in TypeScript with Vite, decoupling core simulation from the high-performance HTML5 Canvas rendering pipeline.

### System Architecture

```
src/
├── core/
│   ├── entities/
│   │   ├── Player.ts          # Kinematic relaxation, state machine, weapon slots
│   │   ├── Enemy.ts           # Entity archetypes (Skeleton, Ghoul, Banshee, Knight, Necromancer)
│   │   └── Projectile.ts      # Occult ballistic & piercing projectile physics
│   ├── systems/
│   │   ├── WaveDirector.ts    # Horde pacing, difficulty scaling, dynamic spawn ring (800px)
│   │   └── WeaponSystem.ts    # Scythe, bone crossbow, hellfire, spectral blades
│   ├── HordeManager.ts        # High-density spatial grid collision & entity clock
│   └── LootManager.ts         # Experience souls, blood gems, and magnetized drops
├── render/
│   ├── Camera.ts              # Centered tracking, velocity lookahead, FOV zoom (Z = 0.80)
│   ├── GothicBackdrop.ts      # Toroidal continuous flagstone & rune floor tiling
│   ├── sprites/
│   │   └── DarkFantasySprites.ts # 120-canvas pre-rasterized atlas, squash/stretch & flinch
│   └── vfx/
│       └── DarkFantasyVFX.ts  # Dynamic player torch (250px), ambient vignette, blood decals
├── ui/
│   ├── GothicHUD.ts           # Cathedral filigree health bar, soul-blue XP, gold chronometer
│   └── UpgradeModal.ts        # Glassmorphic 4-tier rarity cards (Common, Rare, Epic, Legendary)
└── main.ts                    # Fixed-timestep loop, world zoom scaling & screen-space HUD pass
```

---

## 🌟 Key Features & Visual Enhancements

### 1. Dynamic Animations & Procedural Motion (R1)
- **Kinematic Velocity Easing**: Critically damped exponential relaxation replaces abrupt linear movement clamping.
- **Harmonic Squash & Stretch**: Volume-conserving transforms applied during directional changes, dashes, and melee impacts.
- **3-Phase Weapon Anticipation**: Explicit wind-up, release, and follow-through recoil states coupled with torso lean.
- **Bi-Harmonic Walk Cycles**: Grounded pelvic sway and vertical gait bobbing for Skeletons, Ghouls, and Death Knights.
- **Spectral Hovering**: Dual incommensurate harmonic levitation and shadow-height decoupling for Banshees and Necromancers.
- **Multi-Tier Flinch Cascade**: Angular stumble, impulse compression, and white/red hit flash reactions on damage taken.

### 2. Widened Camera Field of View (FOV) (R2)
- **Calibrated Camera Zoom ($Z = 0.80$)**: Visible world area expanded by **+56.25%** ($1200 \times 675$ world view mapped to $960 \times 540$ canvas), providing dramatic situational awareness against massive hordes.
- **Isolated Render Passes**: World elements scaled via `ctx.scale(0.80, 0.80)` while HUD and modals render natively 1:1 on the $960 \times 540$ screen space.
- **Expanded Lighting & Spawning**: Dynamic player torch radius scaled to $250\text{px}$, ambient vignette calibrated to $[250, 725]\text{px}$, and WaveDirector spawn ring expanded to $800\text{px}$.

### 3. Modern Dark Fantasy HUD & UI (R3)
- **Ornate Filigree Health Bar**: Wrought-iron cathedral filigree framing with blood-red gradient and amber ghost damage stagger bar.
- **Soul-Blue & Amethyst XP Bar**: High-contrast luminous blue progress bar with metallic beveling and an octagonal runic level badge.
- **Antique Gold Ledger**: Arched gothic pediment housing the survival chronometer and anatomical skull kill counter.
- **4-Tier Rarity Upgrade Cards**: Common, Rare, Epic, and Legendary glassmorphic cards with custom procedural skill icons, traveling border gleams, and keyboard shortcuts.
- **Cinzel Gothic Typography**: Google Font 'Cinzel' preloaded with graceful Georgia system fallback.

---

## 🎮 Gameplay Controls

| Action | Primary Input | Alternative Input |
| :--- | :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` | Arrow Keys (`↑`, `←`, `↓`, `→`) |
| **Aim & Attack** | Mouse Pointer / Auto-fire | Spacebar (`Space`) |
| **Select Upgrade 1** | `1` | Click Card 1 |
| **Select Upgrade 2** | `2` | Click Card 2 |
| **Select Upgrade 3** | `3` | Click Card 3 |
| **Select Upgrade 4** | `4` | Click Card 4 |
| **Pause / Unpause** | `Escape` (`Esc`) | `P` |

---

## 🛠️ Developer Commands & Verification

### Installation
```bash
npm install
```

### Local Development Server
```bash
npm run dev
# Starts local Vite development server at http://localhost:5173
```

### Type Checking & Production Build
```bash
npx tsc --noEmit
npm run build
# Compiles production bundle into dist/
```

### Unit Test Suite (Vitest)
```bash
npm test
# Executes all 42 unit test files (629 tests)
```

### End-to-End Test Suite (Playwright)
```bash
npx playwright test
# Executes all 8 E2E test suites (35 tests) including visual proof captures
```

---

## 📜 License
MIT License. Created for the Grim Harvest: Undead Siege project.
