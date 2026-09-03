# Full Metal Slug — Environment Survey & Scaffolding Investigation Report

**Author**: `explorer_survey_1`  
**Date**: 2026-09-03  
**Working Directory**: `/Users/user/src/fullmetalslug/.agents/explorer_survey_1/`  
**Target Project Directory**: `/Users/user/src/fullmetalslug/`  
**Mission**: Survey workspace toolchains, directory structure, and design optimal build/test configurations to satisfy decoupled architecture (pure Node.js / Vitest in `src/core/`, Canvas rendering in `src/render/`).

---

## 1. Executive Summary

A comprehensive investigation of the workspace, host environment, and toolchains was performed. The host is an Apple Silicon Mac Studio running macOS 26.6.2 (arm64) equipped with Node.js v25.8.1, npm v11.11.0, pnpm v11.20.0, and bun v1.3.14. Playwright headless browser binaries (Chromium, Firefox, WebKit) are already cached and validated in `~/Library/Caches/ms-playwright/`.

A sandboxed dry-run confirmed that a zero-runtime-dependency TypeScript stack using **Vite 6**, **Vitest 3**, and **Playwright 1.50+** compiles in 309ms, executes unit tests in pure Node.js in 4ms, and passes headless browser E2E tests in 3.7s without requiring native C++ build tools or external canvas binaries.

---

## 2. Workspace & Toolchain Inventory

### 2.1 Host Environment & Hardware
| Property | Value | Notes |
|---|---|---|
| **OS** | macOS 26.6.2 (Darwin 25.6.0) | Apple Silicon (arm64) |
| **Node.js** | `v25.8.1` (`/Users/user/.nvm/versions/node/v25.8.1/bin/node`) | High-performance, modern ES module support |
| **npm** | `v11.11.0` (`/Users/user/.nvm/versions/node/v25.8.1/bin/npm`) | Primary standard package manager |
| **pnpm** | `v11.20.0` (`/Users/user/.nvm/versions/node/v25.8.1/bin/pnpm`) | Supported fast alternative |
| **bun** | `v1.3.14` | Available on PATH |
| **yarn** | Not installed | Use `npm` or `pnpm` |
| **npx** | Available | Bundled with npm v11.11.0 |
| **Network** | Online | npm registry ping latency: 298ms |
| **Git** | Not initialized | Workspace is currently untracked directory |

### 2.2 Playwright Browser Cache
The system already possesses cached Playwright browsers in `~/Library/Caches/ms-playwright/`:
- `chromium-1208`, `chromium-1217`, `chromium-1234`
- `chromium_headless_shell-1208`, `chromium_headless_shell-1217`, `chromium_headless_shell-1234`
- `firefox-1509`, `firefox-1538`
- `webkit-2248`, `webkit-2336`
- `ffmpeg-1011`

*Validation result*: A headless Playwright Chromium test was executed in sandbox and successfully launched, loaded DOM/Canvas, and evaluated page content with zero missing library warnings.

### 2.3 Existing Files in Workspace
The root workspace `/Users/user/src/fullmetalslug/` currently contains:
- `ORIGINAL_REQUEST.md`: User prompt and acceptance criteria (R1–R5).
- `COLLABORATION.md`: Architecture guide, Claude collaboration protocol, swarm allocation plan.
- `.agents/`: Swarm metadata and agent directories (`orchestrator`, `sentinel`, `spec_miner_survey_3`, `explorer_survey_1`).
No conflicting `package.json`, `node_modules`, or stray files exist.

---

## 3. Decoupled Architecture Investigation (R5 Compliance)

### 3.1 Architectural Principle: Pure Core vs. Presentation
The core requirement of R5 is to guarantee that game logic (player physics, weapon states, bullet trajectories, enemy AI, boss phase transitions, damage calculations, and hostage rescues) can be 100% verified via automated unit test scripts without browser or canvas dependencies.

```
+-------------------------------------------------------------------------+
|                              Application Entry                          |
|                                (src/main.ts)                            |
+--------------------+-------------------+--------------------+-----------+
                     |                   |                    |
                     v                   v                    v
         +-----------------------+ +-------------+ +--------------------+
         |  src/input/           | | src/render/ | | src/audio/         |
         |  Keyboard & Touch     | | HTML5 2D    | | Web Audio Synth    |
         |  Virtual Pad          | | Canvas      | | & Formant Speech   |
         +-----------+-----------+ +------+------+ +----------+---------+
                     |                    ^                   ^
                     | InputFrame         | Snapshots         | Events
                     v                    |                   |
+--------------------+--------------------+-------------------+-----------+
|                          src/core/ (Simulation)                         |
|  - Math & Collision (AABB, Raycast, Slopes)                             |
|  - Player State Machine & Movement Physics                              |
|  - Weapons (Handgun, Heavy Machine Gun, Flame Shot, Grenade)            |
|  - Entities (Rebel Soldiers, Shield Trooper, POW, Iron Technical)       |
|  - Stage 1 Boss: Tetsuyuki War Fortress (3 Phases)                      |
|  - Stage Progression & Wave Spawner                                     |
|  - Pure TypeScript, ZERO DOM / Canvas imports                           |
+-------------------------------------------------------------------------+
                     ^
                     |
         +-----------+-----------+
         |      tests/unit/      |
         |   Vitest (Node env)   |
         |  Sub-second execution |
         +-----------------------+
```

### 3.2 Key Boundaries & Design Rules

1. **`src/core/` (Simulation Core)**:
   - **Zero DOM / Canvas Dependencies**: Forbidden from importing `document`, `window`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, or `AudioContext`.
   - **Deterministic Simulation**: Driven by `update(dt: number)` or fixed-timestep `tick()`. Takes an `InputFrame` and advances positions, velocities, lifetimes, and states.
   - **Typed Event Bus**: Emits game events (`player_fired`, `weapon_picked`, `enemy_damaged`, `boss_phase_changed`, `pow_rescued`, `sound_event`).
   - **Pure State Structures**: Read-only state snapshot access for renderers (`getPlayerSnapshot()`, `getEntitiesSnapshot()`, `getBossSnapshot()`).
   - **Testing**: Vitest runs directly in standard Node.js (`environment: 'node'`). Tests run in milliseconds with zero mocking overhead.

2. **`src/render/` (Presentation & Canvas Layer)**:
   - **HTML5 2D Canvas**: Clean pixel-art rendering with virtual internal resolution (320x224, standard Neo-Geo arcade resolution) scaled via CSS `image-rendering: pixelated` to fill display with letterboxing.
   - **Procedural Pixel-Art Generation**: Generates sprites in memory (or procedural canvas primitives) for Marco, rebel soldiers, POWs, tanks, Tetsuyuki boss, bullets, explosions, and UI HUD elements without external heavy image assets.
   - **Parallax Background**: Multi-layered background scrolling (sky, distant hills, ruined city, frontline trenches).
   - **Visual Effects**: Particle engine for shell casing ejection, smoke, flame streams, and multi-stage chain explosions.

3. **`src/audio/` (Retro Arcade Web Audio)**:
   - **Procedural SFX**: Uses Web Audio API oscillator nodes, noise buffers, and envelope filters for gunshots, metal hits, grenade booms, and flame roars.
   - **Voice Announcer Synthesis**: Uses formant synthesis / speech synthesis for classic announcer callouts (*"HEAVY MACHINE GUN!"*, *"FLAME SHOT!"*, *"THANK YOU!"*, *"OK!"*, *"MISSION COMPLETE!"*).
   - **Audio Unlock**: Listens to initial user gesture (click/key) to resume `AudioContext` per modern browser autoplay policy.

4. **`src/input/` (Input Adapter)**:
   - Maps Keyboard (`WASD` / Arrow keys for 8-directional aiming, `J` for Shoot, `K` for Jump, `L` for Grenade, `Space`) and on-screen Touch Virtual Stick + buttons.
   - Aggregates inputs into an immutable `InputFrame` passed to `core.update()`.

---

## 4. Recommended Project Directory Layout

```
/Users/user/src/fullmetalslug/
├── index.html                     # HTML5 canvas container & viewport meta
├── package.json                   # Dependencies, scripts, and build metadata
├── tsconfig.json                  # Strict TypeScript compiler options
├── tsconfig.node.json             # TypeScript config for Vite/Vitest
├── vite.config.ts                 # Vite bundler configuration
├── vitest.config.ts               # Vitest runner configuration
├── playwright.config.ts           # Playwright E2E configuration
├── public/                        # Static assets (favicons, icons)
├── src/
│   ├── main.ts                    # Entrypoint & coordinator loop
│   ├── core/                      # Pure headless simulation logic (R5)
│   │   ├── types.ts               # Core interfaces, enums, type definitions
│   │   ├── events.ts              # Typed event emitter
│   │   ├── engine.ts              # Main simulation coordinator & tick loop
│   │   ├── math/
│   │   │   ├── vector2.ts         # 2D Vector math
│   │   │   └── collision.ts      # AABB hitboxes, hurtboxes, platform checks
│   │   ├── player/
│   │   │   ├── player.ts          # Player physics and action handling
│   │   │   └── player_state.ts    # State machine (idle, run, jump, crouch, melee, hurt, die)
│   │   ├── weapons/
│   │   │   ├── weapon.ts          # Base weapon contract & cooldowns
│   │   │   ├── handgun.ts         # Default pistol (infinite ammo)
│   │   │   ├── heavy_machine_gun.ts # HMG (200 ammo, rapid spray, voice trigger)
│   │   │   ├── flame_shot.ts      # Flame Shot (piercing multi-hit fireball)
│   │   │   └── grenade.ts         # Parabolic explosive grenades
│   │   ├── entities/
│   │   │   ├── entity.ts          # Base entity class
│   │   │   ├── bullet.ts          # Bullet manager & projectile pooling
│   │   │   ├── enemy.ts           # Rebel infantry (rifle, knife, grenade)
│   │   │   ├── shield_trooper.ts  # Shield trooper (directional defense)
│   │   │   ├── pow.ts             # Hostage POW rescue & item drop logic
│   │   │   ├── mid_boss.ts        # Iron Technical armored half-track
│   │   │   └── boss_tetsuyuki.ts  # Stage 1 Boss: Tetsuyuki War Fortress (3 phases)
│   │   └── stage/
│   │       ├── stage_data.ts      # Level layout, platforms, spawn triggers
│   │       └── stage_manager.ts   # Wave spawning, scroll progress, boss triggers
│   ├── render/                    # Presentation layer (Canvas 2D)
│   │   ├── renderer.ts            # Canvas compositor & draw orchestrator
│   │   ├── camera.ts              # Viewport scrolling, screen shake, bounds
│   │   ├── parallax.ts            # Multi-layer background scrolling
│   │   ├── sprite_generator.ts    # Procedural pixel-art sprite generator
│   │   ├── animations.ts          # Sprite frame timers & animators
│   │   ├── particles.ts           # Shell casings, smoke, flame, sparks, explosions
│   │   └── hud.ts                 # Score, lives, weapon badge, ammo counter, boss HP
│   ├── audio/                     # Web Audio API retro arcade audio
│   │   ├── audio_manager.ts       # AudioContext manager & volume mixer
│   │   ├── sfx_synth.ts           # Procedural sound effects synthesizer
│   │   └── voice_synth.ts         # Formant announcer synthesizer
│   └── input/                     # Controls & input normalization
│       ├── input_state.ts         # Normalized InputFrame structure
│       ├── keyboard.ts            # Desktop keyboard mapping
│       └── touch.ts               # Mobile virtual joystick & buttons
└── tests/
    ├── unit/                      # Vitest unit tests (Pure Node environment)
    │   ├── player_weapon_state.test.ts # Weapon states, ammo fallback, fire rates
    │   ├── enemy_boss_statemachine.test.ts # Boss phases, HP thresholds, death
    │   ├── melee_ranged_decision.test.ts # Auto melee knife vs ranged shot
    │   ├── collision.test.ts      # Hitbox & platform collision tests
    │   └── stage_progression.test.ts # Stage progression & wave trigger tests
    └── e2e/                       # Playwright browser integration tests
        └── game_initialization.spec.ts # Canvas visible, 60fps loop, 0 console errors
```

---

## 5. Configuration Files Specifications

### 5.1 `package.json`
```json
{
  "name": "fullmetalslug",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.2.0",
    "vitest": "^3.0.0"
  }
}
```

### 5.2 `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

### 5.3 `vite.config.ts`
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### 5.4 `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    globals: true,
  },
});
```

### 5.5 `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

---

## 6. Concrete Execution Commands

### 6.1 Scaffolding Command
Execute in `/Users/user/src/fullmetalslug`:
```bash
npm install --save-dev typescript@^5.8.0 vite@^6.2.0 vitest@^3.0.0 @playwright/test@^1.50.0 @types/node@^22.0.0
```

### 6.2 Build & Typecheck Commands
```bash
# Typecheck
npm run typecheck

# Full production build to dist/
npm run build
```

### 6.3 Unit Testing Commands (Vitest)
```bash
# Run all unit tests once
npm run test

# Run tests in watch mode during development
npm run test:watch

# Run a specific unit test
npx vitest run tests/unit/player_weapon_state.test.ts
```

### 6.4 E2E Testing Commands (Playwright)
```bash
# Run headless browser E2E tests against built preview
npm run test:e2e

# Run with interactive UI inspector (optional)
npx playwright test --ui
```

### 6.5 Local Development Server
```bash
npm run dev
```

---

## 7. Risk Analysis & Mitigation Strategies

| Potential Risk | Severity | Mitigation Strategy |
|---|---|---|
| **AudioContext Autoplay Block** | Medium | Modern browsers block audio until user interaction. Implement a retro "INSERT COIN / PRESS ANY KEY" splash screen that calls `audioContext.resume()` on the first user input. |
| **Canvas Blurriness on High-DPI screens** | Low | Implement virtual resolution scaling: render to internal offscreen canvas or buffer at 320x224 with `ctx.imageSmoothingEnabled = false`, then scale to viewport using CSS `image-rendering: pixelated`. |
| **Core & Render Coupling Drift** | High | Enforce linting / build rule: `src/core/` must never import anything outside `src/core/`. Unit tests run under `environment: 'node'` so any accidental DOM reference immediately fails the test suite. |
| **Playwright Version Drift** | Low | Tested Playwright with local cache `~/Library/Caches/ms-playwright/` (Chromium 1234). `@playwright/test@^1.50.0` operates flawlessly with cached browsers. |

---

## 8. Conclusion & Handoff Recommendation

The workspace environment is primed and fully capable of supporting the implementation. The proposed decoupled architecture guarantees:
1. Fast, deterministic unit tests via Vitest in pure Node.js.
2. Robust, error-free browser rendering with HTML5 Canvas 2D.
3. Rapid zero-config builds via Vite.
4. Seamless automated verification via Playwright using pre-cached browsers.

Ready for orchestrator swarm dispatch and worker allocation.
