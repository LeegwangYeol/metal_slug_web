# Handoff Report — Milestone M2 (Dark Fantasy Sprites & Particle VFX Architecture)

## 1. Observation

### 1.1 Requirements and Authoritative Directives
1. **PROJECT.md § Dark Fantasy Aesthetic & Render Pipeline (lines 45–66)** mandates:
   - "Gothic Color Palette & Atmosphere: Abyssal Void (`#08060c`, `#0f0d1a`, `#171326`), Necrotic Emerald (`#0d3824`, `#19633e`, `#28a745`, `#68d391`), Blood Crimson (`#380a0a`, `#6b1212`, `#a81d1d`, `#e53e3e`), Bone Ivory (`#2a2624`, `#615852`, `#b8aea5`, `#ede5de`), Cursed Arcane (`#1a0c2e`, `#3c1b6b`, `#7038b8`, `#b794f6`)."
   - "Swarm Visuals: Distinct silhouette-driven procedural sprites for Player, Skeletons, Ghouls, Death Knights, and Banshees. Flashing damage frames (white/crimson flash on impact), gore splatters, and soul dissipation upon death."
   - "Arcane VFX: Luminescent glowing trails, lingering spell circles, shadow aura, and floating XP gem glints."
2. **Explorer 2 Dispatch Directives**:
   - Distinct silhouette-driven procedural sprites for:
     1. Player: Dark Sorcerer (tattered dark hooded robes, glowing arcane staff, shadow aura).
     2. Skeleton: Bleached ivory bones, rusted iron blade, hollow crimson eye sockets.
     3. Ghoul: Hunched grotesque scavenger, feral claws, necrotic green bile drippings.
     4. Banshee: Spectral floating wraith, ethereal purple glow, translucent trailing shroud.
     5. Death Knight: Imposing armored monolith, heavy spiked greatsword, dark glowing visor.
   - Visual impact feedback: white/crimson damage flash frames on hit.
   - Death feedback: gore splatters and soul dissipation particle bursts.
   - Arcane VFX: Luminescent glowing trails, lingering spell circles, floating XP gem glints (Emerald, Ruby, Violet).
   - High performance: pre-render sprite variations onto cached offscreen canvas surfaces or draw using high-speed vector paths.
   - Zero-garbage particle pooling (500 pre-allocated particles) for blood splatters and soul sparks.

### 1.2 Existing Codebase State
1. **`src/main.ts` (lines 268–322)** currently uses primitive placeholders:
   - Lines 276–290: Enemies are drawn as flat colored circles (`ctx.arc(screenX, screenY, enemy.radius, 0, Math.PI * 2)`) with basic color ternary.
   - Lines 296–320: Player is drawn as a purple circle with an outer aura circle and a single line representing facing direction.
   - Lines 254–266: Loot gems are rendered as simple flat circles (`ctx.arc`).
   - Lines 228–253: Background is a flat `#08060c` clear with simple grey grid lines.
   - There are currently **zero particle effects**, **zero sprite animations**, and **zero offscreen caching**.
2. **`src/core/entities/Enemy.ts` (lines 20–41, 116–134)**:
   - `enemy.type`: `'skeleton' | 'ghoul' | 'banshee' | 'death_knight' | 'SKELETON' | 'GHOUL' | 'BANSHEE' | 'DEATH_KNIGHT'`
   - `enemy.radius`: 12 (skeleton), 14 (ghoul), 16 (banshee), 22 (death_knight)
   - `enemy.flashTimer`: Initialized to `0.1` (100ms) on `takeDamage()`, decremented by `dt` in `HordeManager.ts:357`.
   - `enemy.facingRight`: Boolean tracking horizontal orientation (`HordeManager.ts:361–365`).
   - `enemy.behaviorTimer`: Float timer accumulating elapsed active time.
3. **`src/core/entities/Player.ts` (lines 32–54, 139–145)**:
   - `player.facingAngle`: In radians (360° top-down direction).
   - `player.facingDirection`: `1 | -1` (right vs left).
   - `player.invulnerabilityTimer`: Counts down from `0.5s` when taking damage (`takeDamage()`, line 215).
4. **`src/core/systems/LootManager.ts` (lines 33–76)**:
   - Multi-tier loot items: `EMERALD_SHARD` (`#68d391`), `RUBY_GEM` (`#e53e3e`), `VIOLET_ABYSSAL` (`#b794f6`), `SOUL_CHEST` (`#ecc94b`), `HEALTH_VIAL` (`#fc8181`), `ELDRITCH_MAGNET` (`#63b3ed`).
5. **Existing Test Suite**:
   - `npm test` executed: 6 test suites passed, 71 tests passed (100% green), including 1,200 active enemy 60Hz simulation benchmarks.

---

## 2. Logic Chain

### 2.1 Procedural Offscreen Sprite Caching Architecture (`DarkFantasySprites.ts`)
1. **The Performance Bottleneck**:
   Drawing 1,000+ onscreen entities per frame using direct Canvas2D vector paths (e.g., 40+ canvas calls per skeleton = 40,000 path ops/frame) causes severe CPU overhead and drops framerate below 30 FPS.
2. **The Offscreen Caching Solution**:
   - Procedural vector rendering is executed once during initialization (`DarkFantasySprites.initialize()`) or lazily per variant onto small offscreen `HTMLCanvasElement` surfaces.
   - During runtime frames, rendering each enemy or player requires only a single GPU-accelerated `ctx.drawImage(cachedCanvas, dx, dy)` call (taking <0.001ms per entity).
3. **Key Indexing Scheme**:
   Each cached canvas is indexed in a fast lookup map:
   `key = `${entityType}_${frameIndex}_${facing}_${flashState}``
   - `entityType`: `'player' | 'skeleton' | 'ghoul' | 'banshee' | 'death_knight'`
   - `frameIndex`: `0..3` (4 distinct animation frames for smooth walking/hovering)
   - `facing`: `'left' | 'right'` (or horizontal flip at draw time)
   - `flashState`:
     - `'normal'`: Rich gothic palette colors.
     - `'white'`: Solid white silhouette mask (`#ffffff` fill), triggered when `flashTimer > 0.05` or `player.invulnerabilityTimer > 0` with odd blink cadence.
     - `'crimson'`: Intense blood-crimson silhouette (`#e53e3e` / `#6b1212`), triggered when `0 < flashTimer <= 0.05`.
4. **Total Pre-rendered Surfaces**:
   - 5 entity types × 4 animation frames × 2 facings × 3 flash states = 120 cached canvases.
   - Canvas sizes:
     - Player: 48 × 48 px (center: 24, 24)
     - Skeleton: 36 × 36 px (center: 18, 18)
     - Ghoul: 44 × 44 px (center: 22, 22)
     - Banshee: 48 × 48 px (center: 24, 24)
     - Death Knight: 64 × 64 px (center: 32, 32)
   - Total GPU memory footprint: < 1.5 MB VRAM (negligible).

### 2.2 Silhouette & Visual Design of Entities
1. **Player: Dark Sorcerer**
   - **Silhouette**: Cowled tattered hood covering the face, glowing dual arcane violet eyes (`#b794f6`), flowing tattered gothic robe (`#171326`, highlights `#3c1b6b`, hem tear notches).
   - **Arcane Staff**: Right hand grasps a twisted ashwood staff (`#2a2624`) crowned by an iron claw grasping a pulsating fractured eldritch crystal (`#b794f6` with glowing `#ede5de` core).
   - **Off-hand**: Left hand extended forward, radiating swirling void motes.
   - **Shadow Aura**: Beneath the robes, a soft pulsing elliptical shadow disc (`rgba(26, 12, 46, 0.45)`) grounds the character.
   - **Animation**: 4 frames undulating the robe hem (`sin(frame * PI / 2) * 2px`), staff tilting ±6 degrees, crystal bobbing.
2. **Skeleton**
   - **Silhouette**: Bleached ivory skeleton (`#ede5de`, shadow `#b8aea5`), exposed vertebrae, 4 pairs of ribs, jagged jawline.
   - **Crimson Eyes**: Deep hollow eye sockets with dual malevolent pinpricks of crimson fire (`#e53e3e`).
   - **Weapon**: Right arm wields a notched, chipped rusted iron broad blade (`#615852`, edge `#8c7b70`, rust `#6b1212`).
   - **Animation**: 4-frame clattering mechanical walk cycle (legs scissor, sword sways forward/backward, skull tilts).
3. **Ghoul**
   - **Silhouette**: Low-slung, hunched grotesque predator with prominent spinal bone spurs protruding from mottled necrotic green skin (`#0d3824`, `#19633e`).
   - **Head**: Elongated predatory skull, razor fangs, dripping viscous necrotic green bile (`#68d391`).
   - **Claws**: Feral elongated clawed arms (`#ede5de` claws) dragging along the ground.
   - **Animation**: 4-frame creeping prowl, jaws snapping, bile drop lengthening before dripping.
4. **Banshee**
   - **Silhouette**: Spectral floating wraith with no legs, tapering into translucent ghostly shreds (`rgba(183, 148, 246, 0.5)` to `rgba(112, 56, 184, 0.1)`).
   - **Head & Visage**: Shrouded spectral cowl framing a hollow screaming wailing mouth and void eyes.
   - **Shroud**: Flowing, diaphanous burial shroud billowing outward in spectral waves.
   - **Animation**: 4-frame smooth hovering vertical bob (`sin(frame * PI / 2) * 3px`), shroud trails undulating backward with phase lag.
5. **Death Knight**
   - **Silhouette**: Imposing heavily armored gothic monolith, jagged spiked pauldrons (`#08060c`, `#2a2624`, `#615852`), horned greathelm.
   - **Visor**: Slit eye visor blazing with an intense crimson streak (`#e53e3e`).
   - **Weapon**: Colossal two-handed executioner greatsword with barbed quillons and a blood-groove.
   - **Cloak**: Heavy tattered crimson warcape (`#380a0a`, `#6b1212`) hanging between pauldrons.
   - **Animation**: 4-frame ponderous, menacing ground-shaking march.

### 2.3 Zero-Garbage Particle Pool & Arcane VFX Architecture (`DarkFantasyVFX.ts`)
1. **Pre-allocated 500-Particle Pool**:
   - `DarkFantasyVFX` instantiates an array of exactly 500 `Particle` objects and an `Int32Array(500)` free-index stack at construction time.
   - Spawning takes `freeIndices[--freeCount]`, initializes properties directly on the pooled instance, and returns.
   - Dying particles swap-and-pop from the active list back to `freeIndices[freeCount++]` in O(1).
   - **Zero heap allocations (`new`, `{}`) occur during gameplay ticks.**
2. **Particle Types & Lifecycles**:
   - `BLOOD_DROPLET`: Emitted on fleshy enemy hits/death (Ghoul, Death Knight, Player). High initial velocity, drag factor 0.88, gravity +80 px/s², fades from `#e53e3e` to coagulated `#380a0a`. Lifespan: 0.4–0.6s.
   - `BONE_CHIP`: Emitted on Skeleton hits/death. Sharp ivory fragments (`#ede5de`), tumbling with fast angular velocity (`vRot: ±12 rad/s`), bouncing deceleration. Lifespan: 0.5–0.7s.
   - `SOUL_SPARK`: Emitted on enemy death (soul harvesting). Inverted gravity (`-70 px/s²`), gentle sinusoidal horizontal drift, ethereal violet (`#b794f6`) / necrotic emerald (`#68d391`) glow, shrinking to point. Lifespan: 0.8–1.2s.
   - `GHOUL_BILE`: Emitted on Ghoul death. Sputtering toxic droplets (`#68d391`), leaving small fading acidic sizzles.
   - `SPELL_TRAIL`: Emitted along projectile paths and player staff tip. Luminous fading motes (0.2–0.3s) creating glowing trails.
   - `SPELL_CIRCLE`: Persistent ground runes. Rendered as a glowing runic circle with rotating occult glyphs on the ground layer (lifespan 1.0–2.5s) for AoE spells and death sigils.
   - `GEM_GLINT`: Specular 4-pointed cross star sparkle on uncollected soul gems, pulsing periodically to draw player attention.
3. **Dual Layer Rendering**:
   - `renderGround(ctx, camera)`: Draws ground-level decals, lingering spell circles, and blood pools under characters.
   - `renderAir(ctx, camera)`: Draws flying blood droplets, bone chips, rising soul sparks, spell trails, and gem glints above characters.

---

## 3. Caveats

1. **Headless / Node Environment Compatibility**:
   - In automated unit testing (Vitest in Node.js), `document.createElement('canvas')` or `OffscreenCanvas` is not natively available unless jsdom is configured or canvas methods are mocked.
   - **Architectural Safeguard**: `DarkFantasySprites` and `DarkFantasyVFX` must guard canvas operations with `if (typeof document !== 'undefined')` and provide a deterministic fallback or mockable interface so that headless test runners can execute simulation and render logic without throwing `ReferenceError`.
2. **Pool Saturation Policy**:
   - If more than 500 particles are requested simultaneously (e.g. 50 enemies dying in the same frame from a screen-clearing spell), `DarkFantasyVFX` enforces a strict drop-or-displace policy: if `freeCount === 0`, low-priority particles (e.g. oldest spell trails or blood droplets) are recycled first to guarantee high-priority soul bursts and spell circles always render, without ever expanding the pool or allocating memory.
3. **Camera Culling**:
   - Particle updates and rendering must cull particles outside the camera viewport + 40px margin to save rasterization fill-rate.

---

## 4. Conclusion & Detailed Design Specifications

### 4.1 File Layout
- `src/render/sprites/DarkFantasySprites.ts` — Procedural offscreen sprite generation, caching engine, and high-performance entity renderers.
- `src/render/vfx/DarkFantasyVFX.ts` — 500-slot pre-allocated particle engine, dual-layer renderer, and emitter systems.
- `tests/unit/DarkFantasySprites.test.ts` — Unit tests for sprite initialization, cache resolution, and flash states.
- `tests/unit/DarkFantasyVFX.test.ts` — Unit tests for zero-allocation pooling, particle lifecycle, and emitter triggers.

### 4.2 Exact TypeScript Interface Specifications

#### Specification for `DarkFantasySprites.ts`:
```typescript
/**
 * DarkFantasySprites.ts - Procedural Gothic Sprite Engine with Offscreen Caching.
 */
import { Enemy } from '../../core/entities/Enemy';
import { Player } from '../../core/entities/Player';
import { LootItem } from '../../core/systems/LootManager';
import { Camera } from '../Camera';

export type EntitySpriteType = 'player' | 'skeleton' | 'ghoul' | 'banshee' | 'death_knight';
export type FlashState = 'normal' | 'white' | 'crimson';

export interface SpriteAtlasEntry {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export class DarkFantasySprites {
  private static cache: Map<string, SpriteAtlasEntry> = new Map();
  private static initialized: boolean = false;

  public static initialize(): void;
  public static getSpriteKey(type: EntitySpriteType, frame: number, facingRight: boolean, flash: FlashState): string;
  public static drawPlayer(ctx: CanvasRenderingContext2D, player: Player, camera: Camera, elapsedTime: number): void;
  public static drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, camera: Camera, elapsedTime: number): void;
  public static drawLoot(ctx: CanvasRenderingContext2D, loot: LootItem, camera: Camera, elapsedTime: number): void;
  public static clearCache(): void;
}
```

#### Specification for `DarkFantasyVFX.ts`:
```typescript
/**
 * DarkFantasyVFX.ts - High-Performance Zero-Garbage Particle & Arcane VFX Engine.
 */
import { Camera } from '../Camera';
import { GemType } from '../../core/entities/EnemyTypes';
import { LootItem } from '../../core/systems/LootManager';

export type ParticleType =
  | 'BLOOD_DROPLET'
  | 'BONE_CHIP'
  | 'SOUL_SPARK'
  | 'GHOUL_BILE'
  | 'SPELL_TRAIL'
  | 'SPELL_CIRCLE'
  | 'GEM_GLINT';

export interface Particle {
  id: number;
  active: boolean;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  gravity: number;
  life: number;
  maxLife: number;
  startSize: number;
  endSize: number;
  size: number;
  color: string;
  startAlpha: number;
  endAlpha: number;
  alpha: number;
  rotation: number;
  vRot: number;
  extra: number;
}

export class DarkFantasyVFX {
  public readonly capacity: number;
  public readonly pool: Particle[];
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private readonly activeIndices: Int32Array;
  private activeCount: number;
  private readonly indexInActive: Int32Array;

  constructor(capacity: number = 500);

  public update(dt: number): void;
  public renderGround(ctx: CanvasRenderingContext2D, camera: Camera): void;
  public renderAir(ctx: CanvasRenderingContext2D, camera: Camera): void;

  // Emitters (zero runtime heap allocations)
  public emitBloodBurst(x: number, y: number, count?: number, dirX?: number, dirY?: number): void;
  public emitBoneShatter(x: number, y: number, count?: number): void;
  public emitSoulBurst(x: number, y: number, gemType: GemType | string, count?: number): void;
  public emitBileSputter(x: number, y: number, count?: number): void;
  public emitSpellTrail(x: number, y: number, color?: string, size?: number): void;
  public emitSpellCircle(x: number, y: number, radius?: number, duration?: number, color?: string): void;
  public emitGemGlint(x: number, y: number, color?: string): void;
  public updateLootGlints(items: readonly LootItem[], dt: number): void;

  public getActiveCount(): number;
  public clear(): void;
}
```

---

## 5. Verification Method

To independently verify the implementation when workers build these components:

1. **Unit Test Verification (`npm test`)**:
   - Run `npm test` to ensure all 71 existing core simulation tests remain 100% green.
   - Run newly added `tests/unit/DarkFantasySprites.test.ts`:
     - Assert all 5 entity types generate distinct cached sprite keys.
     - Assert `flashTimer > 0.05` selects the white flash frame, while `0 < flashTimer <= 0.05` selects crimson flash frame.
     - Assert facing left vs right uses appropriate mirrored/directional sprites.
     - Assert headless environments fallback gracefully without throwing.
   - Run newly added `tests/unit/DarkFantasyVFX.test.ts`:
     - Assert pool capacity is exactly 500 and `freeCount` equals 500 initially.
     - Assert spawning 100 particles decreases `freeCount` to 400 and increments `activeCount` to 100.
     - Assert running `update(2.0)` fully returns all expired particles to the free pool without leaking indices (`activeCount == 0`, `freeCount == 500`).
     - Assert 10,000 spawn/death churn cycles execute with **0 memory leaks** (`heapUsed` remains flat).
2. **Visual & Performance Inspection**:
   - Mount `DarkFantasySprites` and `DarkFantasyVFX` in `src/main.ts`.
   - Measure frame time with `performance.now()`:
     - Backdrop + Sprites + Particles + HUD must complete in **< 4.0ms** total render time for 500 active enemies and 200 particles (well within the 16.6ms budget for 60 FPS).
3. **Invalidation Conditions**:
   - If any particle spawn invokes `new Object()`, `new Particle()`, or `{}` at runtime, verification fails.
   - If entity sprites are drawn via dynamic un-cached vector loops during 60 FPS gameplay, verification fails.
   - If damage flashes fail to visually trigger when an enemy's health decreases, verification fails.
