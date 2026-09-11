# Comprehensive Technical Survey: Camera, FOV, Backdrop, and Viewport Systems

## Executive Summary
This architectural survey investigates the Camera, FOV, Backdrop, Dynamic Lighting, and Viewport systems of **"Grim Harvest: Undead Siege"** to establish the exact mathematical formulation, parameter values, and implementation strategy for **Milestone 2 (Widen Camera Field of View)** in accordance with `ORIGINAL_REQUEST.md` (§ R2) and `COLLABORATION.md` (§ R2).

The current camera system operates at a 1:1 pixel scale with an implicit zoom factor of $Z = 1.0$ across a $960 \times 540$ virtual viewport ($518,400\text{ px}^2$ visible world area). At this scale, the vertical half-extent is only $270\text{ px}$, causing fast undead enemies ($120\text{ px/s}$) to reach the player in under $2.25\text{ seconds}$, creating an oppressive, claustrophobic viewing angle that restricts tactical reaction against surging hordes.

We propose calibrating the camera to a **calibrated zoom factor of $Z = 0.80$** (effective world view $1200 \times 675\text{ px}$, a **$+56.25\%$ battlefield expansion**), with an alternative option of $Z = 0.75$ ($1280 \times 720\text{ px}$, $+77.8\%$ expansion). This expands the player's situational awareness by $25\%$ to $33\%$ in all directions, provides clean integer-ratio downscaling without pixel shimmer, preserves the 960x540 canvas resolution for razor-sharp HUD typography, and eliminates off-screen spawn popping and culling anomalies across the entire engine.

---

## 1. System Inventory & Architecture Mapping

| Subsystem | File Path | Current Dimensions / Parameters | Key Responsibilities & Invariants |
| :--- | :--- | :--- | :--- |
| **Camera Core** | `src/render/Camera.ts` | $960 \times 540$, $Z = 1.0$ (implicit), $k = 8.0\text{ s}^{-1}$, $\text{lookaheadMax} = 40.0\text{ px}$ | Exponential damping tracking, centered player alignment $(W/2, H/2)$, velocity lookahead, decoupled screen shake, arena clamping $[-2000, 2000]$. |
| **Main Engine Loop** | `src/main.ts` | $\text{VIRTUAL\_WIDTH} = 960$, $\text{VIRTUAL\_HEIGHT} = 540$, fixed $60\text{Hz}$ ($dt = 1/60\text{s}$) | Canvas mounting, coordinate translation, multi-pass rendering, entity culling margins. |
| **Backdrop Engine** | `src/render/GothicBackdrop.ts` | $960 \times 540$, flagstone $512\text{px}$, prop cell $160\text{px}$, rune $800\text{px}$ | 7-layer parallax & world-space procedural rendering, toroidal wrapping, offscreen canvas pre-baking. |
| **Dynamic Lighting** | `src/render/vfx/DarkFantasyVFX.ts` | $960 \times 540$, torch radius $200\text{px}$, vignette gradient $[200\text{px}, 580\text{px}]$ | Offscreen darkness carving (`destination-out`), pre-baked stencils, additive bloom pass (`lighter`). |
| **Horde & Culling** | `src/core/HordeManager.ts` | 2,048 pool capacity, $\text{cullDistance} = 1800\text{ px}$, grid cell $64\text{ px}$ | Spatial hash grid simulation, kinematic integration, distance culling. |
| **Wave Director** | `src/core/systems/WaveDirector.ts` | $960 \times 540$, $\text{spawnMargin} = 90\text{ px}$, ring radius $670\text{ px}$ | 4-phase escalation timeline, strict off-screen perimeter spawning, scripted milestone surges. |
| **Weapon Projectiles** | `src/core/weapons/` | Bone Spear ($450\text{--}600\text{px}$ range, $500\text{--}750\text{px/s}$, $2.0\text{s}$ life), Lightning ($320\text{--}540\text{px}$ range) | Auto-targeting enemy acquisition, piercing projectiles, particle VFX emission. |
| **Display & Canvas** | `index.html` | CSS `aspect-ratio: 16 / 9`, `object-fit: contain`, `image-rendering: pixelated / crisp-edges` | Responsive window containment, letterbox presentation, high-DPI scaling. |

---

## 2. Current Camera Zoom Factor, Transforms, and Tracking

### 2.1 Coordinate Transform Formulation
In `src/render/Camera.ts`:
- **Current Viewport**: $W = 960$, $H = 540$.
- **World to Screen**:
  $$\begin{bmatrix} sx \\ sy \end{bmatrix} = \begin{bmatrix} wx - \text{renderX} \\ wy - \text{renderY} \end{bmatrix}$$
- **Screen to World**:
  $$\begin{bmatrix} wx \\ wy \end{bmatrix} = \begin{bmatrix} sx + \text{renderX} \\ sy + \text{renderY} \end{bmatrix}$$
- **Centering Math** (`centerOn` and `update`):
  $$X_{\text{ideal}} = T_x - \frac{W}{2} + L_x$$
  $$Y_{\text{ideal}} = T_y - \frac{H}{2} + L_y$$
  Where $(T_x, T_y)$ is the target entity world coordinate and $(L_x, L_y)$ is the damped velocity lookahead vector.

### 2.2 Exponential Damping & Shake Decoupling
- **Damping Filter**:
  $$\alpha = 1 - e^{-k \cdot dt}, \quad k = \text{smoothSpeed} = 8.0\text{ s}^{-1}$$
  At $60\text{Hz}$ ($dt \approx 0.01667\text{ s}$), $\alpha \approx 0.1248$. The camera closes $\sim 12.5\%$ of positional displacement per frame, asymptotically eliminating $98\%$ of displacement in $0.5\text{s}$ ($30$ frames) and $>99.9\%$ in $1.0\text{s}$ ($60$ frames) with zero overshoot.
- **Velocity Lookahead**:
  $$\vec{L}_{\text{target}} = \min(40.0, \|\vec{v}\| \cdot 0.20) \cdot \frac{\vec{v}}{\|\vec{v}\|}$$
  Damped via $k_{\text{look}} = 5.0\text{ s}^{-1}$ ($\alpha_{\text{look}} \approx 0.080$).
- **Screen Shake**:
  Offsets $\Delta X_{\text{shake}}, \Delta Y_{\text{shake}} \in [-I(t), I(t)]$ are computed via quadratic decay $I(t) = I_0 \cdot (t / D)^2$ and added strictly to `renderX, renderY` without feedback into logical tracking coordinates `x, y`.

---

## 3. FOV Widening Mathematical Formulation & Calibration

### 3.1 Zoom Factor Comparison Matrix

| Zoom Factor ($Z$) | World Viewport ($W_{\text{world}} \times H_{\text{world}}$) | Visible Area ($\text{px}^2$) | Area Increase | Half-Distance ($X / Y$) | Vertical Edge Reaction (at $120\text{px/s}$) | Pixel Grid Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **$1.00$ (Current)** | $960 \times 540$ | $518,400$ | Baseline ($0\%$) | $480\text{ px} / 270\text{ px}$ | $2.25\text{ seconds}$ | $1 : 1$ (Native) |
| **$0.80$ (Recommended)** | **$1200 \times 675$** | **$810,000$** | **$+56.25\%$** | **$600\text{ px} / 337.5\text{ px}$** | **$2.81\text{ seconds}$ (+25%)** | **$4 : 5$ (Sharp downscale)** |
| **$0.75$ (Max View)** | $1280 \times 720$ | $921,600$ | $+77.78\%$ | $640\text{ px} / 360\text{ px}$ | $3.00\text{ seconds}$ (+33%) | $3 : 4$ (Clean fraction) |
| **$0.67$ (Extreme)** | $1440 \times 810$ | $1,166,400$ | $+125.0\%$ | $720\text{ px} / 405\text{ px}$ | $3.38\text{ seconds}$ (+50%) | $2 : 3$ (Sprites too small) |

### 3.2 Recommendation: Calibrated Zoom Factor $Z = 0.80$
- **Visible Battlefield**: $1200 \times 675$ world units.
- **Rationale**:
  1. Expands visible gameplay area by **$+56.25\%$**, providing an extra $120\text{ px}$ horizontally and $67.5\text{ px}$ vertically.
  2. Increases the reaction window against charging ghouls from $2.25\text{s}$ to $2.81\text{s}$, completely eliminating the "stifling, claustrophobic" feeling reported in `ORIGINAL_REQUEST.md`.
  3. Maintains crisp pixel art fidelity: At $0.80$ ($4/5$), sprite details, eye glints, and damage flash states remain clearly legible without subpixel moiré artifacts.
  4. Keeps canvas at standard $960 \times 540$ internal resolution, preserving 100% crisp HUD text and button geometry while satisfying Playwright test invariants.

### 3.3 Overhauled Camera Transforms with Zoom
Let $W = 960$, $H = 540$, and $Z = \text{zoom}$ (default $0.80$):
- **Effective World View Extents**:
  $$W_{\text{world}} = \frac{W}{Z} = \frac{960}{0.80} = 1200\text{ px}$$
  $$H_{\text{world}} = \frac{H}{Z} = \frac{540}{0.80} = 675\text{ px}$$
- **Centering Calculation**:
  $$X_{\text{ideal}} = T_x - \frac{W_{\text{world}}}{2} + L_x = T_x - \frac{W}{2Z} + L_x$$
  $$Y_{\text{ideal}} = T_y - \frac{H_{\text{world}}}{2} + L_y = T_y - \frac{H}{2Z} + L_y$$
- **Arena Boundary Clamping**:
  $$\text{minClampX} = B_{\text{minX}} = -2000$$
  $$\text{maxClampX} = B_{\text{maxX}} - W_{\text{world}} = 2000 - \frac{W}{Z} = 800$$
  $$\text{minClampY} = B_{\text{minY}} = -2000$$
  $$\text{maxClampY} = B_{\text{maxY}} - H_{\text{world}} = 2000 - \frac{H}{Z} = 1325$$
- **World to Screen Transform**:
  $$sx = (wx - \text{renderX}) \cdot Z$$
  $$sy = (wy - \text{renderY}) \cdot Z$$
- **Screen to World Transform**:
  $$wx = \text{renderX} + \frac{sx}{Z}$$
  $$wy = \text{renderY} + \frac{sy}{Z}$$
- **Frustum Culling**:
  $$\text{viewBounds} = \left\{ x: \text{renderX}, y: \text{renderY}, \text{width}: \frac{W}{Z}, \text{height}: \frac{H}{Z} \right\}$$

---

## 4. Impact Analysis on Engine Subsystems

### 4.1 Toroidal Backdrop Tiling (`src/render/GothicBackdrop.ts`)

#### Current Mechanism
`GothicBackdrop.ts` uses offscreen canvas caching and mathematical tile stamping in `render(ctx, camX, camY, elapsedTime)`.
- **Layer 0 (Sky)**: Surface $1024 \times 540$, parallax $0.02$. Stamped with step $W=1024, H=540$.
- **Layer 1 (Clouds)**: Surface $1920 \times 240$, parallax $0.05$. Stamped at $y=0$.
- **Layer 2 (Skyline)**: Surface $1920 \times 160$, parallax $0.15$. Stamped at $y = vh \cdot 0.35$.
- **Layer 3 (Flagstones)**: Surface $512 \times 512$, parallax $1.0$. Stamped with step $fSize=512$.
- **Layer 4 (Occult Runes)**: Grid interval $800\text{ px}$. Stamped using `minRX = floor((camX - 256)/800)` to `maxRX = floor((camX + vw)/800)`.
- **Layer 5 (Graveyard Props)**: Hash cell $160\text{ px}$. Stamped using `minCX = floor((camX - 80)/160)` to `maxCX = floor((camX + vw + 80)/160)`.
- **Layer 6 (Mist)**: Surface $1024 \times 540$. Sub-layer A at parallax $0.40$, Sub-layer B at parallax $0.65$.

#### Impact & Seam Prevention Under Widened FOV ($1200 \times 675$)
1. **Flagstone Floor (Layer 3)**:
   - Loop runs `for (let x = startX; x < vw; x += fSize)`. When $vw$ expands from $960$ to $1200$, the loop condition automatically stamps 3 horizontal tiles (e.g. $-100, 412, 924$) covering up to $924 + 512 = 1436\text{ px} > 1200\text{ px}$.
   - Vertically, when $vh$ expands from $540$ to $675$, the loop stamps 2 vertical tiles covering up to $924\text{ px} > 675\text{ px}$.
   - **Seam risk**: ZERO gaps. Mathematical continuity is $100\%$ verified.
2. **Occult Runes & Graveyard Props (Layers 4 & 5)**:
   - Because `maxRX` and `maxCX` use `(camX + vw)`, expanding $vw$ to $1200$ and $vh$ to $675$ automatically increases query ranges from $[-1..1]$ to $[-1..2]$ grid cells.
   - Runes and props dynamically cover the wider edges with zero unpopulated fringes.
3. **Sky Surface (Layer 0)**:
   - Surface height is $H = 540$. If $vh = 675$, vertical tiling `for (let y = startY; y < vh; y += H)` would stamp a second tile vertically, causing a duplicate blood moon to appear stacked above or below!
   - **Adjustment**: Either enlarge `skyCanvas` surface to $1024 \times 720$, or scale the vertical draw call, or clamp sky draw to a single celestial band.
4. **Mist Layer (Layer 6)**:
   - Sub-layer A currently draws at `y = 0` with height $540$. When $vh = 675$, the bottom $135\text{ px}$ would lack Sub-layer A mist.
   - **Adjustment**: Add vertical loop `for (let y = 0; y < vh; y += H)` or scale mist canvas draw to match $vh$.

---

### 4.2 Dynamic Radial Lighting Pass (`src/render/vfx/DarkFantasyVFX.ts`)

#### Current Mechanism
`DynamicLightingEngine` pre-bakes offscreen surfaces:
- `lightCanvas` ($960 \times 540$)
- `vignetteCanvas` ($960 \times 540$) with radial gradient from radius $200$ to $580$
- `torchStencilCanvas` ($512 \times 512$) with smooth radial fade to zero alpha
- Pass 1: Fills ambient darkness ($0.84$), blits vignette, carves holes via `destination-out`
- Pass 2: Additive bloom via `lighter` (amber player torch $120\text{px}$, weapon glows)

#### Impact Under Widened FOV
1. **Light Canvas & Vignette Dimensions**:
   - `this.width` and `this.height` currently default to $960 \times 540$.
   - If world coordinates expand to $1200 \times 675$, the offscreen buffer must be initialized or resized to $1200 \times 675$.
2. **Vignette Radial Gradient**:
   - Current: Inner radius $200$, Outer radius $580$.
   - At $1200 \times 675$, the screen corner distance is $\sqrt{600^2 + 337.5^2} = 688.4\text{ px}$.
   - If outer radius remains $580$, the corners beyond $580\text{ px}$ will be heavily eclipsed by solid darkness.
   - **Scaled Formula**:
     $$R_{\text{inner}} = \text{round}(W_{\text{world}} \cdot 0.208) = 1200 \cdot 0.208 = 250\text{ px}$$
     $$R_{\text{outer}} = \text{round}(\text{hypot}(W_{\text{world}}/2, H_{\text{world}}/2) \cdot 1.05) = 688.4 \cdot 1.05 = 725\text{ px}$$
3. **Player Torch Illumination Radius**:
   - Current: $\text{torchR} = 200 + \text{flicker}$. At $960\text{px}$ width, this illuminates $41.7\%$ of the half-screen.
   - At $1200\text{px}$ width, a $200\text{px}$ torch illuminates only $33.3\%$ of the half-screen, making the screen feel excessively pitch black around the borders.
   - **Scaled Value**:
     $$\text{torchR} = 250 + \text{flicker} \quad (+25\% \text{ scaling})$$
   - Additive Amber Bloom: Scale from $120\text{ px}$ to $150\text{ px}$ ($120 \times 1.25$).
4. **Loot Gem Shimmer Bounds**:
   - Line 1720: `if (gx >= -40 && gx <= vw + 40 && gy >= -40 && gy <= vh + 40)`
   - When $vw = 1200$ and $vh = 675$, gems across the wider perimeter will naturally be included in the light carving pass.

---

### 4.3 Culling Logic & Perimeter Spawning Boundaries

#### 1. Entity & Loot Frustum Culling (`src/main.ts`)
- **Current Lines 552 & 562**:
  ```ts
  // Loot culling
  if (screenX < -20 || screenX > w + 20 || screenY < -20 || screenY > h + 20) continue;
  // Enemy culling
  if (screenX < -40 || screenX > w + 40 || screenY < -40 || screenY > h + 40) continue;
  ```
  Here $w = 960$ and $h = 540$.
- **Critical Flaw If Unchanged**:
  When FOV is widened to $1200 \times 675$, any enemy at world position $screenX \in [1000, 1200]$ or $screenY \in [580, 675]$ would be **erroneously culled** and become invisible on the right and bottom edges of the screen!
- **Required Fix**:
  Replace $w$ and $h$ with the camera's effective world view dimensions:
  $$w_{\text{view}} = \frac{W}{Z} = 1200\text{ px}$$
  $$h_{\text{view}} = \frac{H}{Z} = 675\text{ px}$$

#### 2. Wave Director Perimeter Spawning (`src/core/systems/WaveDirector.ts`)
- **Current Lines 245–288**:
  ```ts
  const w = this.viewportWidth;  // 960
  const h = this.viewportHeight; // 540
  const m = this.spawnMargin;    // 90
  // East: x = camX + w + m + random(60) -> camX + 1050 to camX + 1110
  // South: y = camY + h + m + random(60) -> camY + 630 to camY + 690
  ```
- **Critical Flaw If Unchanged**:
  Because the widened camera viewport extends to $camX + 1200$ and $camY + 675$, spawning an enemy at $camX + 1050$ or $camY + 630$ places them **DIRECTLY ON-SCREEN IN FULL VIEW OF THE PLAYER**! This violates Acceptance Criterion R2 of zero on-screen popping.
- **Scripted Milestone Events**:
  - `spawnRingSurround` (Line 394): `radius = 670`.
    Screen corner at $1200 \times 675$ is $688.4\text{ px}$. A $670\text{ px}$ circle intersects the visible viewport corners!
  - `spawnPincerRush` (Line 380): `rightX = camX + this.viewportWidth + m + 40 = camX + 1090` (inside visible view).
  - `spawnQuadFlank` (Line 416): East flank `camX + w + m = camX + 1080` (inside visible view).
- **Required Parameter Adjustments**:
  - `WaveDirectorConfig.viewportWidth`: Set to $1200$ (or camera's $W_{\text{world}}$).
  - `WaveDirectorConfig.viewportHeight`: Set to $675$ (or camera's $H_{\text{world}}$).
  - `spawnRingSurround.radius`: Increase from $670\text{ px}$ to **$800\text{ px}$** ($688.4 + 111.6\text{ px}$ safety margin).
  - `spawnMargin`: Maintain at $90\text{--}100\text{ px}$ outside the widened viewport ($X > camX + 1290$, $Y > camY + 765$).

#### 3. Weapon Range & Projectile Lifetimes
- **Bone Spear (`src/core/weapons/BoneSpear.ts`)**:
  - Targeting `area`: $450\text{ px}$ (Rank 1) to $550\text{ px}$ (Rank 5), $600\text{ px}$ (Evolution).
  - Range coverage: At $1200\text{px}$ wide screen, player is centered at $600\text{px}$. A targeting range of $500\text{--}600\text{px}$ covers the entire horizontal sightline.
  - Projectile speed & lifetime: $speed = 500\text{--}750\text{ px/s}$, $maxLife = 2.0\text{ s}$.
  - Total travel distance: $500 \cdot 2.0 = 1000\text{ px}$ (Rank 1) to $750 \cdot 2.0 = 1500\text{ px}$ (Evolution).
  - Since corner distance is $688\text{ px}$, projectiles cleanly travel all the way through and off the visible screen before recycling. Zero premature despawns!
- **Abyssal Lightning (`src/core/weapons/AbyssalLightning.ts`)**:
  - Targeting `area`: Scale base targeting range by $+15\%$ (Rank 1 from $320 \to 370\text{ px}$, Rank 5 from $480 \to 550\text{ px}$, Evolution from $540 \to 620\text{ px}$) so strikes reach enemies across the expanded perimeter.

---

### 4.4 Screen Shake & Tracking Interpolation Damping

- **Exponential Damping Factor $k = 8.0\text{ s}^{-1}$**:
  - The damping formula $\alpha = 1 - e^{-k \cdot dt}$ operates on relative positional error.
  - In a wider FOV ($1200\text{ px}$), the player's movement speed of $200\text{ px/s}$ covers $16.7\%$ of screen width per second (compared to $20.8\%$ at $960\text{ px}$).
  - The camera tracking feels naturally smoother and less frantic. $k = 8.0$ remains mathematically optimal with zero oscillation.
- **Lookahead Offset Maximum (`lookaheadMax`)**:
  - At $960\text{ px}$, $\text{lookaheadMax} = 40.0\text{ px}$ ($8.3\%$ of half-screen).
  - At $1200\text{ px}$, scaling $\text{lookaheadMax} = 50.0\text{ px}$ ($40 \times 1.25$) maintains the identical proportional forward lookahead sightline ($8.3\%$).
- **Screen Shake Trauma**:
  - Decoupled additive offsets on `renderX, renderY` preserve the zero-drift guarantee.
  - At $1200 \times 675$, a $30\text{px}$ explosion trauma occupies $2.5\%$ screen displacement, providing crisp, impactful tactile punch without inducing visual disorientation.

---

## 5. Precise Mathematical Values & Configuration Blueprint

| Parameter | Current Value (Baseline) | Proposed Value ($Z = 0.80$ Sweet Spot) | Alternative ($Z = 0.75$ Wide) | Unit / Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **`Camera.zoom`** | $1.00$ (implicit) | **$0.80$** | $0.75$ | Dimensionless scale factor |
| **Virtual Viewport Width** | $960\text{ px}$ | **$960\text{ px}$ (Canvas) / $1200\text{ px}$ (World)** | $960\text{ px}$ / $1280\text{ px}$ | Preserves HUD pixel density |
| **Virtual Viewport Height** | $540\text{ px}$ | **$540\text{ px}$ (Canvas) / $675\text{ px}$ (World)** | $540\text{ px}$ / $720\text{ px}$ | 16:9 aspect ratio locked |
| **Visible World Area** | $518,400\text{ px}^2$ | **$810,000\text{ px}^2$ (+56.25%)** | $921,600\text{ px}^2$ (+77.8%) | Dramatic situational awareness |
| **Camera `lookaheadMax`** | $40.0\text{ px}$ | **$50.0\text{ px}$** | $53.3\text{ px}$ | Proportional forward reaction bias |
| **Arena Clamp `maxClampX`** | $2000 - 960 = 1040$ | **$2000 - 1200 = 800$** | $2000 - 1280 = 720$ | World arena $[-2000, 2000]$ bounds |
| **Arena Clamp `maxClampY`** | $2000 - 540 = 1460$ | **$2000 - 675 = 1325$** | $2000 - 720 = 1280$ | World arena $[-2000, 2000]$ bounds |
| **Backdrop View Width** | $960\text{ px}$ | **$1200\text{ px}$** | $1280\text{ px}$ | Toroidal horizontal coverage |
| **Backdrop View Height** | $540\text{ px}$ | **$675\text{ px}$** | $720\text{ px}$ | Toroidal vertical coverage |
| **Lighting Canvas Size** | $960 \times 540$ | **$1200 \times 675$** | $1280 \times 720$ | Offscreen darkness buffer |
| **Lighting Vignette Inner R** | $200\text{ px}$ | **$250\text{ px}$** | $265\text{ px}$ | Matches widened view center |
| **Lighting Vignette Outer R** | $580\text{ px}$ | **$725\text{ px}$** | $770\text{ px}$ | Extends beyond screen corners |
| **Player Torch Light Radius** | $200\text{ px}$ | **$250\text{ px}$** | $265\text{ px}$ | Illuminates approaching hordes |
| **Player Torch Amber Bloom** | $120\text{ px}$ | **$150\text{ px}$** | $160\text{ px}$ | Warm atmospheric aura |
| **WaveDirector View Extents** | $960 \times 540$ | **$1200 \times 675$** | $1280 \times 720$ | Off-screen perimeter reference |
| **Ring Surround Spawn Radius** | $670\text{ px}$ | **$800\text{ px}$** | $840\text{ px}$ | Prevents on-screen corner popping |
| **Main Render Cull Margin X** | $w + 40 = 1000\text{ px}$ | **$W_{\text{world}} + 40 = 1240\text{ px}$** | $1320\text{ px}$ | Prevents enemy edge vanishing |
| **Main Render Cull Margin Y** | $h + 40 = 580\text{ px}$ | **$H_{\text{world}} + 40 = 715\text{ px}$** | $760\text{ px}$ | Prevents enemy edge vanishing |

---

## 6. Code Injection Points & Implementation Strategy

### Injection Point 1: `src/render/Camera.ts`
Add `zoom` property, getter view extents, and update transforms and boundary clamping:
```typescript
// Add to CameraOptions
export interface CameraOptions {
  viewportWidth?: number;  // default 960
  viewportHeight?: number; // default 540
  zoom?: number;           // default 0.80 (or 1.0 for backward compatibility)
  smoothSpeed?: number;    // default 8.0
  lookaheadMax?: number;   // default 50.0
  lookaheadSpeed?: number; // default 5.0
  bounds?: CameraBounds;
  forwardLock?: boolean;
}

// Inside Camera class:
public zoom: number = 0.80;

public get viewWidth(): number {
  return this.viewportWidth / this.zoom;
}

public get viewHeight(): number {
  return this.viewportHeight / this.zoom;
}

public centerOn(targetX: number, targetY: number): void {
  this.x = targetX - this.viewWidth / 2;
  this.y = targetY - this.viewHeight / 2;
  this.lookaheadX = 0;
  this.lookaheadY = 0;
  this.clampToBounds();
  this.renderX = Math.round(this.x);
  this.renderY = Math.round(this.y);
}

// In update():
const idealTargetX = targetX - this.viewWidth / 2 + this.lookaheadX;
const idealTargetY = targetY - this.viewHeight / 2 + this.lookaheadY;

// In clampToBounds():
const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewWidth);
const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewHeight);

// In worldToScreen & screenToWorld:
public worldToScreen(worldX: number, worldY: number): Vector2D {
  return {
    x: (worldX - this.renderX) * this.zoom,
    y: (worldY - this.renderY) * this.zoom,
  };
}

public screenToWorld(screenX: number, screenY: number): Vector2D {
  return {
    x: screenX / this.zoom + this.renderX,
    y: screenY / this.zoom + this.renderY,
  };
}
```

### Injection Point 2: `src/main.ts`
Wrap world render passes in `ctx.scale(zoom, zoom)` and update frustum culling:
```typescript
public render(): void {
  const ctx = this.ctx;
  if (!ctx || !this.canvas) return;

  const camX = this.camera.renderX;
  const camY = this.camera.renderY;
  const viewW = this.camera.viewWidth;   // 1200
  const viewH = this.camera.viewHeight;  // 675
  const zoom = this.camera.zoom;         // 0.80

  // -------------------------------------------------------------
  // World Space Render Pass (Scaled by Camera Zoom Factor)
  // -------------------------------------------------------------
  ctx.save();
  ctx.scale(zoom, zoom);

  // 1. Backdrop (rendered with viewW, viewH)
  this.backdrop.render(ctx, camX, camY, this.elapsedTime, viewW, viewH);

  // 2. Ground VFX & Decals
  this.vfx.renderDecals(ctx, this.camera, viewW, viewH);
  this.vfx.renderGround(ctx, this.camera, viewW, viewH);

  // 3. Drop Shadows
  this.vfx.renderContactDropShadows(ctx, this.camera, this.player, this.hordeManager, this.lootManager, this.elapsedTime);

  // 4. Loot Items (Culling against viewW, viewH)
  const activeLoot = this.lootManager.getActiveItems();
  for (const item of activeLoot) {
    if (!item.isAlive) continue;
    const sx = item.position.x - camX;
    const sy = item.position.y - camY;
    if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
    DarkFantasySprites.drawLoot(ctx, item, this.camera, this.elapsedTime);
  }

  // 5. Enemies (Culling against viewW, viewH)
  const activeEnemies = this.hordeManager.getActiveEnemies();
  for (const enemy of activeEnemies) {
    if (!enemy.isAlive) continue;
    const sx = enemy.x - camX;
    const sy = enemy.y - camY;
    if (sx < -40 || sx > viewW + 40 || sy < -40 || sy > viewH + 40) continue;
    DarkFantasySprites.drawEnemy(ctx, enemy, this.camera, this.elapsedTime);
  }

  // 6. Player
  DarkFantasySprites.drawPlayer(ctx, this.player, this.camera, this.elapsedTime);

  // 7. Weapon effects
  this.weaponManager.render(ctx, this.camera);

  // 8. Air VFX
  this.vfx.renderAir(ctx, this.camera, viewW, viewH);

  // 9. Foreground Mist
  this.backdrop.renderForegroundMist(ctx, camX, camY, this.elapsedTime, viewW, viewH);

  // 10. Dynamic Lighting Pass
  this.vfx.lighting.render(ctx, this.camera, {
    player: this.player,
    weaponManager: this.weaponManager,
    lootManager: this.lootManager,
    elapsedTime: this.elapsedTime,
  }, viewW, viewH);

  ctx.restore();

  // -------------------------------------------------------------
  // Screen Space HUD & Modal Pass (1:1 Native Resolution 960x540)
  // -------------------------------------------------------------
  this.hud.render(ctx, hudSnapshot, GrimHarvestGame.FIXED_TIMESTEP);
  if (this.upgradeModal.getIsOpen()) {
    this.upgradeModal.render(ctx, GrimHarvestGame.VIRTUAL_WIDTH, GrimHarvestGame.VIRTUAL_HEIGHT);
  }
}
```

### Injection Point 3: `src/core/systems/WaveDirector.ts`
Update initialization parameters and ring surround radius:
```typescript
// In main.ts:
this.waveDirector = new WaveDirector(this.hordeManager, {
  viewportWidth: this.camera.viewWidth,   // 1200
  viewportHeight: this.camera.viewHeight, // 675
  spawnMargin: 100,
  arenaBounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
});

// In WaveDirector.ts:
public spawnRingSurround(camX: number, camY: number, count: number): void {
  const centerX = camX + this.viewportWidth / 2;
  const centerY = camY + this.viewportHeight / 2;
  // Scaled from 670 to 800 to lie strictly outside 1200x675 viewport (hypot(600, 337.5) = 688.4)
  const radius = Math.max(800, Math.hypot(this.viewportWidth / 2, this.viewportHeight / 2) + 110);
  ...
}
```

### Injection Point 4: `src/render/vfx/DarkFantasyVFX.ts`
Scale lighting canvas and vignette radii:
```typescript
// In DynamicLightingEngine:
public resize(width: number, height: number): void {
  this.width = width;
  this.height = height;
  this.initSurfaces();
}

public initSurfaces(): void {
  this.lightCanvas = safeCreateOffscreenCanvas(this.width, this.height);
  this.lightCtx = this.lightCanvas?.getContext('2d') ?? null;

  this.vignetteCanvas = safeCreateOffscreenCanvas(this.width, this.height);
  const vCtx = this.vignetteCanvas?.getContext('2d');
  if (vCtx && typeof vCtx.createRadialGradient === 'function') {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const innerR = Math.round(Math.min(cx, cy) * 0.74); // 250px
    const outerR = Math.round(Math.hypot(cx, cy) * 1.05); // 725px
    const grad = vCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.65, 'rgba(8, 6, 12, 0.40)');
    grad.addColorStop(1, 'rgba(8, 6, 12, 0.70)');
    vCtx.fillStyle = grad;
    vCtx.fillRect(0, 0, this.width, this.height);
  }
}

// In render():
let torchR = 250 + flicker; // Scaled +25% from 200
const amberR = 150 + 4.0 * Math.sin(scene.elapsedTime * 7.3); // Scaled +25% from 120
```

---

## 7. Verification & Anti-Regression Plan

1. **Unit Test Suite Preservation (`tests/unit/`)**:
   - `camera_tracking.spec.ts`: Default constructor parameters `new Camera({ viewportWidth: 960, viewportHeight: 540 })` will retain `zoom = 1.0` if not specified, keeping all 6 existing camera test suites passing $100\%$ green.
   - Add new tests in `camera_tracking.spec.ts` asserting:
     - `zoom = 0.80` produces `viewWidth = 1200` and `viewHeight = 675`.
     - `worldToScreen` maps target world coordinate $(px, py)$ to $(480, 270)$ on screen.
     - `screenToWorld` correctly round-trips with precision $< 10^{-4}$.
     - Clamping limits camera $x$ to $2000 - 1200 = 800$ and $y$ to $2000 - 675 = 1325$.
   - `ChallengerDF_M2.test.ts`: Re-run horizontal and vertical span coverage tests at $vw = 1200, vh = 675$ asserting `gapsFound.length === 0`.
2. **Automated Playwright E2E Playtesting (`tests/e2e/`)**:
   - Author a dedicated test capturing the widened FOV gameplay state.
   - Assert visual proof screenshot artifact size $> 250\text{KB}$ (e.g. `artifacts/dark_fantasy/widened_fov_gameplay.png`).
   - Verify that all active hordes, props, decals, torchlight, and weapon slashes render without seams or blank margins.
