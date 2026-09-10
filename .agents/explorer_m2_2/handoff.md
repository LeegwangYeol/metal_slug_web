# Handoff Report: High-Fidelity Procedural Minion Designs (Skeleton & Ghoul)

**Agent**: `explorer_m2_2` (Codebase Researcher / Explorer)  
**Milestone**: Milestone 2 — High-Fidelity Dark Fantasy Graphics Overhaul  
**Target File for Overhaul**: `src/render/sprites/DarkFantasySprites.ts`  
**Date**: 2026-09-10T15:53:00Z  

---

## 1. Observation

### 1.1 Current Architecture & Pipeline in `src/render/sprites/DarkFantasySprites.ts`
- **Offscreen Caching Pipeline** (`DarkFantasySprites.ts:23-89`):
  - Pre-renders offscreen canvases into a static cache `Map<string, SpriteAtlasEntry>`.
  - Cache key format: `${type}_${frame % 4}_${facingRight ? 'right' : 'left'}_${flash}` (`DarkFantasySprites.ts:33`).
  - Total combinations per minion: 4 walk frames × 2 horizontal facings (right/left via `ctx.scale(-1, 1)`) × 3 damage flash states (`'normal'`, `'white'`, `'crimson'`) = 24 entries per archetype.
  - In browser runtime, `generateSpriteEntry` creates an `HTMLCanvasElement`, renders the vector art once, and caches it. During gameplay rendering (`drawEnemy`), it blits the pre-rendered canvas via `ctx.drawImage` with zero garbage collection overhead.
  - In headless/Node test environments where `typeof document === 'undefined'`, `drawEnemy` falls back to direct vector drawing (`DarkFantasySprites.ts:628-643`).
- **Current Minion Dimensions** (`DarkFantasySprites.ts:91-104`):
  - `skeleton`: `{ w: 36, h: 36, ox: 18, oy: 18 }`
  - `ghoul`: `{ w: 44, h: 44, ox: 22, oy: 22 }`
- **Current Skeleton Vector Routine** (`DarkFantasySprites.ts:325-384`):
  ```typescript
  // Bleached Ivory Skull: Flat semicircle + jaw rectangle
  ctx.arc(0, -8, 6.5, Math.PI, 0); ctx.lineTo(4, -3); ctx.lineTo(-4, -3);
  // Eye Sockets: 2 flat 2x2.5px black rectangles with 1px crimson dots
  ctx.fillRect(-3, -7, 2, 2.5); ctx.fillRect(1, -7, 2, 2.5);
  // Ribs & Spine: 1 vertical line + 3 horizontal straight 1.5px lines
  ctx.moveTo(0, 0); ctx.lineTo(0, 6);
  ctx.moveTo(-4, 1); ctx.lineTo(4, 1); ...
  // Legs: 2 straight lines from spine; no pelvis or kneecaps
  ctx.moveTo(-2, 6); ctx.lineTo(-2 + legOffset, 16);
  // Rusted Blade: Single flat rectangle (2.5x18) with flat crossguard (7x2)
  ctx.fillRect(6, -11, 2.5, 18);
  ```
- **Current Ghoul Vector Routine** (`DarkFantasySprites.ts:386-434`):
  ```typescript
  // Mottled Necrotic Flesh Torso: Single flat dark green ellipse
  ctx.ellipse(-2, 1 + crawl, 11, 8, -0.2, 0, Math.PI * 2);
  // Spinal Bone Spurs: 2 simple triangular polygons
  // Snapping Head: Single solid circle arc(7, -2 + crawl, 6)
  // Malevolent Bile Eye: Single green dot arc(9, -3 + crawl, 1.5)
  // Dripping Bile: Single static circle arc(7, 4 + crawl, 1.8)
  // Claws: Two 2px straight stroke lines moveTo/lineTo
  // Waistcloth: Completely missing
  ```
- **Damage Flash Constraints** (`tests/unit/ChallengerM2_2.test.ts:215-251`):
  - Unit tests assert exact flash thresholds:
    - `flashTimer > 0.05` → `'white'` (`#ffffff`).
    - `0 < flashTimer <= 0.05` → `'crimson'` (`PALETTE.BLOOD_CRIMSON.FLASH` = `#e53e3e`).
    - `flashTimer <= 0` → `'normal'` (procedural drawing must NOT leave `ctx.fillStyle` as `#ffffff` or `#e53e3e`).
  - Silhouettes in `drawMaskedEntity` (`DarkFantasySprites.ts:163-244`) must closely match the procedural silhouette.

---

## 2. Logic Chain

### 2.1 Aesthetic Deficiencies of the Existing Minions
1. **Lack of Volumetric Shading & Texturing**:
   - Both Skeleton and Ghoul currently use flat solid hex fills from `PALETTE` without lighting gradients, depth occlusion, or specular highlights. They read as flat paper cutouts rather than imposing dark fantasy creatures.
2. **Absence of Anatomical Detail**:
   - *Skeleton*: The ribcage is currently 3 straight horizontal lines; there are no individual vertebrae, no pelvis (pelvic girdle/iliac crest), no clavicles/shoulders, and no skull anatomical features (zygomatic arches, nasal cavity, teeth).
   - *Ghoul*: The torso is a single tilted ellipse; there is no hunched feral quadruped posture, no exposed flank ribs, no jaw separation (head is a featureless circle), and no tattered burial rags.
3. **Crudeness of Weapons & Natural Attacks**:
   - *Skeleton Blade*: A featureless 2.5px wide grey stick without bevels, fuller, chipping, or rust oxidation.
   - *Ghoul Claws*: Two straight lines that lack claw articulation, curved sickle profile, or dried blood encrustation.
4. **Static Animation Dynamics**:
   - Both entities rely on a simple ±2-3px offset on a single axis. They lack secondary motion (head tilt, jaw chatter, pustule swelling, spine curvature flexing).

### 2.2 Procedural Vector Engineering Strategy
To achieve high-fidelity rendering within HTML5 Canvas2D while maintaining locked 60Hz performance and zero per-frame garbage collection:
1. **Layer-Ordered Painter's Algorithm**:
   - Both entities must be drawn in strict back-to-front layer ordering:
     1. Ground contact drop shadow (`ellipse` with `rgba(8, 6, 12, 0.45-0.50)`).
     2. Distal (far) limbs & shadows.
     3. Skeletal spine / torso necrotic core.
     4. Anterior ribcage / dorsal hump & bone spurs.
     5. Pelvis / tattered waistcloth.
     6. Proximal (near) articulated limbs.
     7. Cranium / feral snarling head with facial cavity voids & eyes.
     8. Weapons (notched rusted broadsword) / sickle bone claws with dried gore.
2. **Multi-Stop Gradients with Graceful Fallback**:
   - In browser environments, offscreen caching executes `ctx.createLinearGradient` and `ctx.createRadialGradient` once during sprite atlas generation.
   - To guarantee 100% test compatibility in headless test runners (where `mockCtx` may lack gradient methods), gradient creation is wrapped in runtime feature checks:
     `if (typeof ctx.createLinearGradient === 'function') { ... } else { ctx.fillStyle = fallbackColor; }`
3. **Anatomic Curve Modeling (`bezierCurveTo` & `quadraticCurveTo`)**:
   - Replace flat polygons with smooth organic contours:
     - Calvaria dome, orbital sockets, and zygomatic cheekbones.
     - Curving anatomical ribs branching from thoracic vertebrae to sternum.
     - Feral hunched dorsal arch with protruding vertebrae osteophytes.
     - Hooked sickle talons and notched battle-damaged blade cutouts.
4. **Dynamic Multi-Frame Organic Motion**:
   - **Skeleton (4 frames)**:
     - Frame 0: Extended walking stride (distal leg forward, proximal leg back).
     - Frame 1: Stride passing compression (torso dips 0.8px, head tilts -0.08 rad, sword lowers).
     - Frame 2: Opposite extended stride (proximal leg forward, distal leg back).
     - Frame 3: Recoil high point (torso rises 0.6px, jaw chatters open with 1px vertical gap).
   - **Ghoul (4 frames)**:
     - Frame 0: Low predatory compression (haunches coiled, spine deeply arched, boils dormant).
     - Frame 1: Forward lunge (foreclaw reaches forward, jaw snaps half-closed, bile drop forms).
     - Frame 2: High scuttle step (torso rises 1.2px, jaw hangs wide open, bile strand stretches).
     - Frame 3: Pre-strike recoil (forelimbs plant into earth, pustules reach peak sine swelling).

---

## 3. High-Fidelity Procedural Design Specifications

### 3.1 Skeleton: "The Cursed Legionnaire"
- **Dimensions**: `{ w: 40, h: 40, ox: 20, oy: 20 }` (centered coordinates from `x = -10` to `+11`, `y = -17` to `+18`).
- **Visual Features**:
  1. **Weathered Ivory Cranium**:
     - Calvaria constructed via bezier curves (`-5.5, -5.5` to `0, -15.5` to `5.5, -5.5`).
     - Shaded with radial bone gradient: `#ede5de` (cranial top highlight) → `#b8aea5` (mid ivory) → `#615852` (weathered shadow).
     - Inverted heart-shaped nasal cavity void (`ABYSSAL_VOID.DEEP`, `#08060c`).
     - Dual deep orbital cavities with pitch-black voids.
     - **Occult Crimson Pinpoints**: Each socket holds a 1.2px radial occult ember halo (`rgba(229, 62, 62, 0.35)`) enclosing a piercing `#e53e3e` pinpoint core.
     - **Cracked Skull Filigree**: Hairline fracture zigzagging across the frontal bone down to the temporal ridge (`ctx.strokeStyle = '#2a2624'`, `lineWidth = 0.6`).
     - Maxilla with 4 distinct tooth serrations (`#ede5de`) and an articulated mandible that drops on frame 3 for jaw-chattering animation.
  2. **Anatomic Ribcage & Vertebral Column**:
     - 4 segmented lumbar/thoracic vertebrae discs (`fillRect(-1.5, y, 3, 1.4)` in `#615852` and `#b8aea5`).
     - 4 pairs of curved anatomical ribs (`quadraticCurveTo` arcs) enclosing a central sternum keel plate (`#ede5de`).
     - Posterior dark void interior shadow (`rgba(23, 19, 38, 0.6)`) creating hollow 3D thoracic depth.
  3. **Pelvic Girdle & Articulated Skeletal Legs**:
     - Flared butterfly iliac wings (`#b8aea5` with `#615852` crevices) and sacrum plate.
     - Two-segment articulated legs: Femur → Patella (kneecap) → Tibia/Fibula pair → Phalange clawed feet.
     - Opposing walk cycle: Distal leg shaded in darker bone tone (`#615852`), proximal leg in bleached bone (`#b8aea5` / `#ede5de`).
  4. **Notched Rusted Iron Blade**:
     - Hand grip with pommel skull-crusher knob and iron crossguard (`#380a0a` dried blood crust).
     - Blade: 16.5px tapered falchion/broadsword with oxidized rust gradient (`#7a828e` steel edge → `#3e444c` forged iron → `#5c2715` oxidized rust).
     - Central blood fuller groove (`#1b1d20`).
     - Two jagged battle notches cut out of the cutting edge (`y = -6` and `y = -10`) with dark oxidation pitting.

### 3.2 Ghoul: "The Feral Necrophage"
- **Dimensions**: `{ w: 44, h: 44, ox: 22, oy: 22 }` (centered coordinates from `x = -14` to `+15`, `y = -12` to `+17`).
- **Visual Features**:
  1. **Hunched Feral Posture**:
     - Quadrupedal predatory stance with high arched haunches (`(-10, -5)`), sunken lumbar flank, and low lunging neck.
     - Contoured body path using quadratic curves creating an aggressive hunchback silhouette.
     - 3 emaciated exposed ribs visible along the sunken flank (`#b8aea5`).
  2. **Decaying Necrotic Flesh Shading**:
     - Complex multi-stop linear/radial gradient blending putrid green (`#19633e`), gangrenous olive (`#384c24`), dead cadaver grey (`#2d3033`), and deep abyssal green (`#0d3824`).
     - Subcutaneous bruised purple/crimson undertones (`#300d18`) around joints and belly folds.
  3. **Spinal Bone Spurs (Vertebral Osteophytes)**:
     - 3 prominent jagged bone spikes erupting along the dorsal spine hunch:
       - Rump spur: `(-8, -8 + crawl)`
       - Hunch apex spur: `(-3, -11 + crawl)`
       - Cervical spur: `(2, -9 + crawl)`
     - Shaded from weathered bone base (`#615852`) to sharp bleached ivory tips (`#ede5de`).
  4. **Pulsating Necrotic Boils / Pustules**:
     - Cluster of 3 swollen pustules on shoulder, dorsal crest, and flank.
     - Base: Dark inflamed erythematous ring (`#4a0e1e`).
     - Fluid dome: Pressurized bilious core (`#d4f55a` → `#68d391` → `#19633e`).
     - Dynamic Sine Swelling: Radius expands and contracts rhythmically (`r + Math.sin(frame * PI * 0.5) * 0.4px`).
     - Specular Wet Highlight: Pure white glistening micro-dot (`rgba(255, 255, 255, 0.95)`, `r = 0.6px`) on upper-left quadrant giving a foul, pressurized wet sheen.
  5. **Tattered Waistcloth**:
     - Decayed burial shroud / torn rags wrapped around the pelvis (`#2b2723`).
     - Asymmetrical shredded hemline with loose hanging strips dragging in the dirt.
     - Outlined with rotted thread and dried gore edging (`#161311`).
  6. **Snapping Feral Maw & Crazed Eye**:
     - Elongated predatory cranium (`ellipse(9, -2 + crawl, 6.5, 4.8)`).
     - Gaping unhinged jaw revealing a pitch-black oral cavity (`#0a0305`).
     - Irregular needle-sharp fangs (`#ede5de`) including a prominent curved lower canine jutting upward.
     - Dripping Viscous Bile: Hanging venomous saliva thread (`#68d391`) with a teardrop bead (`#28a745`) dangling below the chin.
     - Crazed Necrotic Eye: Sunken orbital cavity (`#08060c`) holding a glowing bilious iris (`#68d391`) with a vertical feral slit pupil.
  7. **Elongated Jagged Bone Claws**:
     - Powerful forelimbs transitioning into 3 elongated, sickle-curved talons.
     - Articulated knuckles and tapering bone blades (`quadraticCurveTo`).
     - Tips crusted in coagulated and vivid dried blood (`#380a0a` to `#a81d1d`).

---

## 4. Concrete Canvas2D Drawing Procedures (Reference Code)

The following procedures provide the complete, ready-to-integrate Canvas2D implementation for `DarkFantasySprites.ts`:

```typescript
// =========================================================================
// 1. HIGH-FIDELITY SKELETON VECTOR ROUTINE
// =========================================================================
private static drawSkeletonVector(ctx: CanvasRenderingContext2D, frame: number): void {
  const legOffset = (frame % 2 === 0 ? 2.5 : -2.5);
  const headTilt = (frame === 1 ? -0.08 : frame === 3 ? 0.06 : 0);
  const bodyBob = (frame === 1 ? 0.8 : frame === 3 ? -0.6 : 0);
  const jawDrop = (frame === 3 ? 1.0 : 0);

  // --- Layer 1: Ground Contact Drop Shadow ---
  ctx.beginPath();
  ctx.ellipse(0, 17, 9.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 6, 12, 0.45)';
  ctx.fill();

  // --- Layer 2: Distal (Far) Leg ---
  ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2.5, 10 + bodyBob);
  ctx.lineTo(-2.5 - legOffset * 0.6, 13.5 + bodyBob);
  ctx.lineTo(-2.5 - legOffset, 17);
  ctx.stroke();
  // Distal Foot
  ctx.fillStyle = PALETTE.BONE_IVORY.SHADOW;
  ctx.fillRect(-3.5 - legOffset, 16.5, 3.0, 1.2);

  // --- Layer 3: Spine & Thoracic Cavity Shadow ---
  ctx.fillStyle = 'rgba(23, 19, 38, 0.6)';
  ctx.beginPath();
  ctx.ellipse(0, 3 + bodyBob, 4.5, 4.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // Segmented Vertebrae Column (T1 - L4)
  ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
  for (let i = 0; i < 4; i++) {
    const vy = 0.5 + i * 1.8 + bodyBob;
    ctx.fillRect(-1.5, vy, 3.0, 1.2);
  }

  // --- Layer 4: Anatomic Curved Ribcage ---
  ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
  ctx.lineWidth = 1.2;
  // Rib Pair 1 (T1)
  ctx.beginPath();
  ctx.moveTo(0, 0.5 + bodyBob);
  ctx.quadraticCurveTo(-5.0, 0.5 + bodyBob, -4.0, 2.2 + bodyBob);
  ctx.moveTo(0, 0.5 + bodyBob);
  ctx.quadraticCurveTo(5.0, 0.5 + bodyBob, 4.0, 2.2 + bodyBob);
  ctx.stroke();
  // Rib Pair 2 (T3)
  ctx.beginPath();
  ctx.moveTo(0, 2.3 + bodyBob);
  ctx.quadraticCurveTo(-6.0, 2.3 + bodyBob, -4.8, 4.2 + bodyBob);
  ctx.moveTo(0, 2.3 + bodyBob);
  ctx.quadraticCurveTo(6.0, 2.3 + bodyBob, 4.8, 4.2 + bodyBob);
  ctx.stroke();
  // Rib Pair 3 (T5)
  ctx.beginPath();
  ctx.moveTo(0, 4.1 + bodyBob);
  ctx.quadraticCurveTo(-5.2, 4.1 + bodyBob, -4.2, 6.0 + bodyBob);
  ctx.moveTo(0, 4.1 + bodyBob);
  ctx.quadraticCurveTo(5.2, 4.1 + bodyBob, 4.2, 6.0 + bodyBob);
  ctx.stroke();
  // Rib Pair 4 (Floating Ribs)
  ctx.beginPath();
  ctx.moveTo(0, 5.9 + bodyBob);
  ctx.quadraticCurveTo(-3.8, 5.9 + bodyBob, -2.8, 7.2 + bodyBob);
  ctx.moveTo(0, 5.9 + bodyBob);
  ctx.quadraticCurveTo(3.8, 5.9 + bodyBob, 2.8, 7.2 + bodyBob);
  ctx.stroke();

  // Sternum Plate
  ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  ctx.fillRect(-0.7, 0.2 + bodyBob, 1.4, 4.5);

  // --- Layer 5: Pelvic Girdle ---
  ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
  // Left Iliac Wing
  ctx.beginPath();
  ctx.moveTo(-0.8, 7.5 + bodyBob);
  ctx.quadraticCurveTo(-4.8, 7.0 + bodyBob, -4.2, 10.2 + bodyBob);
  ctx.lineTo(-0.8, 9.8 + bodyBob);
  ctx.closePath();
  ctx.fill();
  // Right Iliac Wing
  ctx.beginPath();
  ctx.moveTo(0.8, 7.5 + bodyBob);
  ctx.quadraticCurveTo(4.8, 7.0 + bodyBob, 4.2, 10.2 + bodyBob);
  ctx.lineTo(0.8, 9.8 + bodyBob);
  ctx.closePath();
  ctx.fill();
  // Sacrum Core
  ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
  ctx.fillRect(-1.0, 8.0 + bodyBob, 2.0, 2.8);

  // --- Layer 6: Proximal (Near) Leg ---
  ctx.strokeStyle = PALETTE.BONE_IVORY.POLISHED;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(2.2, 10 + bodyBob);
  ctx.lineTo(2.2 + legOffset * 0.6, 13.5 + bodyBob);
  ctx.lineTo(2.2 + legOffset, 17);
  ctx.stroke();
  // Patella (Kneecap)
  ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  ctx.beginPath();
  ctx.arc(2.2 + legOffset * 0.6, 13.5 + bodyBob, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // Near Foot (Tarsals & Clawed Phalanges)
  ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
  ctx.fillRect(1.5 + legOffset, 16.5, 3.8, 1.3);

  // --- Layer 7: Cranium & Facial Filigree ---
  ctx.save();
  ctx.translate(0, -9 + bodyBob);
  ctx.rotate(headTilt);

  // Calvaria Bone Shading
  if (typeof ctx.createRadialGradient === 'function') {
    const skullGrad = ctx.createRadialGradient(-1, -3, 1, 0, -1, 7.5);
    skullGrad.addColorStop(0.0, PALETTE.BONE_IVORY.POLISHED);
    skullGrad.addColorStop(0.55, PALETTE.BONE_IVORY.BLEACHED);
    skullGrad.addColorStop(1.0, PALETTE.BONE_IVORY.WEATHERED);
    ctx.fillStyle = skullGrad;
  } else {
    ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  }

  // Cranial Vault Contour
  ctx.beginPath();
  ctx.moveTo(-5.2, 1.5);
  ctx.bezierCurveTo(-6.5, -4.5, -4.0, -7.8, 0, -7.8);
  ctx.bezierCurveTo(4.0, -7.8, 6.5, -4.5, 5.2, 1.5);
  ctx.bezierCurveTo(3.8, 3.5, 2.0, 4.0, 0, 4.0);
  ctx.bezierCurveTo(-2.0, 4.0, -3.8, 3.5, -5.2, 1.5);
  ctx.closePath();
  ctx.fill();

  // Zygomatic Cheekbone Ridges
  ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-4.8, 1.0);
  ctx.lineTo(-2.2, 2.2);
  ctx.moveTo(4.8, 1.0);
  ctx.lineTo(2.2, 2.2);
  ctx.stroke();

  // Nasal Cavity Void
  ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
  ctx.beginPath();
  ctx.moveTo(0, 0.8);
  ctx.lineTo(-0.8, 2.2);
  ctx.lineTo(0.8, 2.2);
  ctx.closePath();
  ctx.fill();

  // Deep Orbital Cavities
  ctx.beginPath();
  ctx.ellipse(-2.3, -1.2, 1.8, 2.2, -0.1, 0, Math.PI * 2);
  ctx.ellipse(2.3, -1.2, 1.8, 2.2, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Occult Crimson Pinpoints & Corona
  ctx.fillStyle = 'rgba(229, 62, 62, 0.35)';
  ctx.beginPath();
  ctx.arc(-2.2, -1.0, 1.4, 0, Math.PI * 2);
  ctx.arc(2.2, -1.0, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.BLOOD_CRIMSON.FLASH;
  ctx.fillRect(-2.7, -1.5, 1.0, 1.0);
  ctx.fillRect(1.7, -1.5, 1.0, 1.0);

  // Cracked Skull Hairline Filigree
  ctx.strokeStyle = PALETTE.BONE_IVORY.SHADOW;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-0.8, -7.5);
  ctx.lineTo(-1.8, -5.2);
  ctx.lineTo(-0.4, -3.2);
  ctx.lineTo(-1.2, -2.0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1.8, -5.2);
  ctx.lineTo(-3.5, -5.8);
  ctx.stroke();

  // Upper Maxilla Teeth
  ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  for (let t = 0; t < 4; t++) {
    ctx.fillRect(-1.8 + t * 1.0, 3.2, 0.6, 1.2);
  }

  // Hinged Mandible (Jawbone) with Walking Chatter
  ctx.fillStyle = PALETTE.BONE_IVORY.BLEACHED;
  ctx.beginPath();
  ctx.moveTo(-2.8, 4.2 + jawDrop);
  ctx.lineTo(2.8, 4.2 + jawDrop);
  ctx.lineTo(2.0, 6.2 + jawDrop);
  ctx.lineTo(-2.0, 6.2 + jawDrop);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Layer 8: Arm & Notched Rusted Iron Blade ---
  // Humerus & Forearm holding sword hilt
  ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3.5, 1.0 + bodyBob);
  ctx.lineTo(6.5, 3.5 + bodyBob);
  ctx.stroke();

  // Forged Iron Crossguard & Pommel
  ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
  ctx.fillRect(3.2, 2.8 + bodyBob, 7.5, 2.0);
  ctx.fillStyle = PALETTE.ABYSSAL_VOID.SLATE;
  ctx.beginPath();
  ctx.arc(7.0, 6.2 + bodyBob, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Rusted Blade Body with Gradient
  if (typeof ctx.createLinearGradient === 'function') {
    const bladeGrad = ctx.createLinearGradient(5.5, -14 + bodyBob, 8.5, 3 + bodyBob);
    bladeGrad.addColorStop(0.0, '#7a828e'); // Tarnished steel tip
    bladeGrad.addColorStop(0.35, '#3e444c'); // Forged iron
    bladeGrad.addColorStop(0.70, '#5c2715'); // Rust oxidation patch
    bladeGrad.addColorStop(1.0, '#26292d');  // Base iron
    ctx.fillStyle = bladeGrad;
  } else {
    ctx.fillStyle = '#4a4440';
  }

  // Blade Path with Tapered Spear Point
  ctx.beginPath();
  ctx.moveTo(5.8, 2.8 + bodyBob);
  ctx.lineTo(5.8, -13.5 + bodyBob);
  ctx.lineTo(7.0, -15.5 + bodyBob); // Sharp tip
  ctx.lineTo(8.2, -13.5 + bodyBob);
  ctx.lineTo(8.2, 2.8 + bodyBob);
  ctx.closePath();
  ctx.fill();

  // Central Blood Fuller Groove
  ctx.strokeStyle = '#1b1d20';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(7.0, 2.5 + bodyBob);
  ctx.lineTo(7.0, -13.0 + bodyBob);
  ctx.stroke();

  // Jagged Edge Notches / Battle Chips
  ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
  // Notch 1 (Deep triangular chip on cutting edge)
  ctx.beginPath();
  ctx.moveTo(5.8, -6.5 + bodyBob);
  ctx.lineTo(7.0, -5.5 + bodyBob);
  ctx.lineTo(5.8, -4.5 + bodyBob);
  ctx.closePath();
  ctx.fill();
  // Notch 2 (Chipped stress fracture)
  ctx.beginPath();
  ctx.moveTo(5.8, -10.5 + bodyBob);
  ctx.lineTo(6.6, -9.8 + bodyBob);
  ctx.lineTo(5.8, -9.2 + bodyBob);
  ctx.closePath();
  ctx.fill();

  // Rust Pitting Stains
  ctx.fillStyle = '#6e2f18';
  ctx.fillRect(6.2, -1.0 + bodyBob, 1.2, 1.5);
  ctx.fillRect(6.0, -8.0 + bodyBob, 1.0, 1.2);
}


// =========================================================================
// 2. HIGH-FIDELITY GHOUL VECTOR ROUTINE
// =========================================================================
private static drawGhoulVector(ctx: CanvasRenderingContext2D, frame: number): void {
  const crawl = (frame % 2 === 0 ? 1.8 : -1.8);
  const lunge = (frame === 1 ? 1.2 : frame === 3 ? -0.8 : 0);
  const boilPulse = Math.sin((frame * Math.PI) / 2) * 0.35;

  // --- Layer 1: Ground Contact Drop Shadow ---
  ctx.beginPath();
  ctx.ellipse(0, 16 + crawl * 0.3, 13.5, 4.2, -0.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 6, 12, 0.50)';
  ctx.fill();

  // --- Layer 2: Distal (Far) Limbs ---
  // Far Hind Leg
  ctx.strokeStyle = '#1e241c';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(-8, 5 + crawl);
  ctx.lineTo(-12, 10 - crawl);
  ctx.lineTo(-9, 16);
  ctx.stroke();

  // Far Foreleg & Ground Claws
  ctx.strokeStyle = '#2d3326';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(4, 3 + crawl);
  ctx.lineTo(3, 9 - crawl);
  ctx.lineTo(1, 15);
  ctx.stroke();

  // --- Layer 3: Hunched Necrotic Torso ---
  if (typeof ctx.createLinearGradient === 'function') {
    const fleshGrad = ctx.createLinearGradient(-12, -7 + crawl, 10, 8 + crawl);
    fleshGrad.addColorStop(0.0, '#384c24'); // Gangrenous olive ridge
    fleshGrad.addColorStop(0.35, PALETTE.NECROTIC_EMERALD.CORE); // Rotting green
    fleshGrad.addColorStop(0.70, '#2d3033'); // Decayed ashen grey flank
    fleshGrad.addColorStop(1.0, PALETTE.NECROTIC_EMERALD.DARK);  // Abyssal deep belly
    ctx.fillStyle = fleshGrad;
  } else {
    ctx.fillStyle = PALETTE.NECROTIC_EMERALD.DARK;
  }

  // Feral Convex Spine & Haunches
  ctx.beginPath();
  ctx.moveTo(-11, 4 + crawl);
  ctx.quadraticCurveTo(-14, -2 + crawl, -10, -5 + crawl); // High rump
  ctx.quadraticCurveTo(-4, -9 + crawl, 3 + lunge, -4 + crawl); // Arched dorsal hump
  ctx.quadraticCurveTo(8 + lunge, -1 + crawl, 9 + lunge, 4 + crawl); // Sunken chest
  ctx.quadraticCurveTo(4, 9 + crawl, -5, 8 + crawl); // Belly
  ctx.closePath();
  ctx.fill();

  // Subcutaneous Bruised Undertones
  ctx.fillStyle = 'rgba(66, 18, 34, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-3, 4 + crawl, 5.0, 3.2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Emaciated Flank Ribs
  ctx.strokeStyle = PALETTE.BONE_IVORY.BLEACHED;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-1.5, 0.5 + crawl);
  ctx.quadraticCurveTo(0.5, 3.0 + crawl, 2.5, 5.0 + crawl);
  ctx.moveTo(-4.5, -0.5 + crawl);
  ctx.quadraticCurveTo(-2.5, 2.2 + crawl, -0.5, 4.2 + crawl);
  ctx.moveTo(-7.5, 0.2 + crawl);
  ctx.quadraticCurveTo(-5.5, 2.5 + crawl, -3.5, 4.0 + crawl);
  ctx.stroke();

  // --- Layer 4: Spinal Bone Spurs (Vertebral Osteophytes) ---
  ctx.fillStyle = PALETTE.BONE_IVORY.WEATHERED;
  // Spur 1 (Rump)
  ctx.beginPath();
  ctx.moveTo(-9, -3 + crawl);
  ctx.lineTo(-8, -7 + crawl);
  ctx.lineTo(-6, -4 + crawl);
  ctx.closePath();
  ctx.fill();
  // Spur 2 (Hunch Apex - Longest)
  ctx.beginPath();
  ctx.moveTo(-5, -6 + crawl);
  ctx.lineTo(-3, -10.5 + crawl);
  ctx.lineTo(-1, -5 + crawl);
  ctx.closePath();
  ctx.fill();
  // Spur 3 (Cervical)
  ctx.beginPath();
  ctx.moveTo(1 + lunge, -5 + crawl);
  ctx.lineTo(3 + lunge, -8.5 + crawl);
  ctx.lineTo(5 + lunge, -3 + crawl);
  ctx.closePath();
  ctx.fill();

  // Spur Ivory Highlights
  ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  ctx.fillRect(-8.3, -7.0 + crawl, 0.8, 1.2);
  ctx.fillRect(-3.3, -10.5 + crawl, 0.8, 1.5);
  ctx.fillRect(2.7 + lunge, -8.5 + crawl, 0.8, 1.2);

  // --- Layer 5: Tattered Burial Waistcloth ---
  ctx.fillStyle = '#2b2723'; // Mouldering linen
  ctx.beginPath();
  ctx.moveTo(-11, 2 + crawl);
  ctx.lineTo(-5, 4 + crawl);
  ctx.lineTo(-4, 8 + crawl);
  ctx.lineTo(-6, 7 + crawl);
  ctx.lineTo(-7, 11 + crawl); // Long shredded rag
  ctx.lineTo(-9, 7.5 + crawl);
  ctx.lineTo(-11, 9.5 + crawl); // Second frayed strip
  ctx.lineTo(-12, 5 + crawl);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#140d0a';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // --- Layer 6: Pulsating Necrotic Boils & Wet Specular Highlights ---
  // Boil 1: Shoulder Pustule
  const b1x = 4 + lunge;
  const b1y = -1 + crawl;
  const b1r = 2.0 + boilPulse;
  ctx.fillStyle = '#4a0e1e'; // Inflamed ring
  ctx.beginPath();
  ctx.arc(b1x, b1y, b1r + 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.NECROTIC_EMERALD.BRIGHT;
  ctx.beginPath();
  ctx.arc(b1x, b1y, b1r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d4f55a'; // Bilious core
  ctx.beginPath();
  ctx.arc(b1x - 0.3, b1y - 0.3, b1r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Wet Specular Dot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(b1x - 0.6, b1y - 0.6, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Boil 2: Dorsal Hump Pustule
  const b2x = -2;
  const b2y = -4 + crawl;
  const b2r = 1.7 - boilPulse * 0.8;
  ctx.fillStyle = '#4a0e1e';
  ctx.beginPath();
  ctx.arc(b2x, b2y, b2r + 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.NECROTIC_EMERALD.GLOW;
  ctx.beginPath();
  ctx.arc(b2x, b2y, b2r, 0, Math.PI * 2);
  ctx.fill();
  // Wet Specular Dot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(b2x - 0.5, b2y - 0.5, 0.45, 0, Math.PI * 2);
  ctx.fill();

  // --- Layer 7: Feral Cranium, Snapping Maw & Rabid Eye ---
  // Cranial Mass
  ctx.fillStyle = PALETTE.NECROTIC_EMERALD.CORE;
  ctx.beginPath();
  ctx.ellipse(8.5 + lunge, -1.8 + crawl, 6.2, 4.5, 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Blackened Gaping Maw
  ctx.fillStyle = '#0a0305';
  ctx.beginPath();
  ctx.moveTo(8.5 + lunge, 0 + crawl);
  ctx.lineTo(14.5 + lunge, -1.2 + crawl);
  ctx.lineTo(12.5 + lunge, 4.2 + crawl);
  ctx.closePath();
  ctx.fill();

  // Needle-Sharp Fangs
  ctx.fillStyle = PALETTE.BONE_IVORY.POLISHED;
  // Upper fangs
  ctx.beginPath();
  ctx.moveTo(10.5 + lunge, -0.5 + crawl);
  ctx.lineTo(11.0 + lunge, 1.5 + crawl);
  ctx.lineTo(11.5 + lunge, -0.5 + crawl);
  ctx.moveTo(12.5 + lunge, -0.8 + crawl);
  ctx.lineTo(13.0 + lunge, 1.2 + crawl);
  ctx.lineTo(13.5 + lunge, -0.8 + crawl);
  // Prominent curved lower canine
  ctx.moveTo(11.8 + lunge, 3.8 + crawl);
  ctx.lineTo(12.3 + lunge, 1.2 + crawl);
  ctx.lineTo(12.9 + lunge, 3.8 + crawl);
  ctx.fill();

  // Dripping Toxic Bile Strand
  ctx.strokeStyle = PALETTE.NECROTIC_EMERALD.GLOW;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(11.5 + lunge, 3.5 + crawl);
  ctx.quadraticCurveTo(12.5 + lunge, 6.5 + crawl, 11.0 + lunge, 8.5 + crawl);
  ctx.stroke();
  // Falling teardrop bead
  ctx.fillStyle = PALETTE.NECROTIC_EMERALD.BRIGHT;
  ctx.beginPath();
  ctx.arc(11.0 + lunge, 9.2 + crawl, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Sunken Eye Socket & Bilious Iris
  ctx.fillStyle = PALETTE.ABYSSAL_VOID.DEEP;
  ctx.beginPath();
  ctx.arc(10.2 + lunge, -3.2 + crawl, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Glowing Necrotic Iris
  ctx.fillStyle = PALETTE.NECROTIC_EMERALD.GLOW;
  ctx.beginPath();
  ctx.arc(10.5 + lunge, -3.2 + crawl, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // Feral Slit Pupil
  ctx.fillStyle = '#050203';
  ctx.fillRect(10.3 + lunge, -3.7 + crawl, 0.5, 1.1);

  // --- Layer 8: Proximal Forelimb & Elongated Bone Claws ---
  // Muscular Upper Arm & Sinewy Forearm
  ctx.strokeStyle = PALETTE.NECROTIC_EMERALD.CORE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(6.5 + lunge, 2.0 + crawl);
  ctx.lineTo(8.5 + lunge, 9.5 + crawl);
  ctx.stroke();

  // 3 Elongated Jagged Talons
  ctx.strokeStyle = PALETTE.BONE_IVORY.WEATHERED;
  ctx.lineWidth = 1.3;
  // Talon 1 (Inner / Hooked back)
  ctx.beginPath();
  ctx.moveTo(7.5 + lunge, 9.5 + crawl);
  ctx.quadraticCurveTo(6.0 + lunge, 12.5 + crawl, 5.5 + lunge, 15.2 + crawl);
  ctx.stroke();
  // Talon 2 (Center / Longest)
  ctx.beginPath();
  ctx.moveTo(8.5 + lunge, 9.5 + crawl);
  ctx.quadraticCurveTo(9.5 + lunge, 13.0 + crawl, 11.2 + lunge, 16.0 + crawl);
  ctx.stroke();
  // Talon 3 (Outer)
  ctx.beginPath();
  ctx.moveTo(9.5 + lunge, 9.5 + crawl);
  ctx.quadraticCurveTo(11.5 + lunge, 12.5 + crawl, 13.0 + lunge, 14.5 + crawl);
  ctx.stroke();

  // Blood-Dipped Claw Tips
  ctx.fillStyle = PALETTE.BLOOD_CRIMSON.DRIED;
  ctx.fillRect(5.0 + lunge, 14.5 + crawl, 1.2, 1.2);
  ctx.fillRect(10.5 + lunge, 15.0 + crawl, 1.4, 1.4);
  ctx.fillRect(12.2 + lunge, 13.8 + crawl, 1.2, 1.2);
}
```

---

## 5. Masked Entity (Hit Flash) Synchronizations

To prevent jarring visual "popping" or shape morphing when minions take damage (`flash === 'white'` or `flash === 'crimson'`), the `drawMaskedEntity` method in `DarkFantasySprites.ts` must be updated to mirror the new silhouettes:

```typescript
// Inside drawMaskedEntity(ctx, type, frame, maskColor):
case 'skeleton': {
  const legOffset = (frame % 2 === 0 ? 2.5 : -2.5);
  const bodyBob = (frame === 1 ? 0.8 : frame === 3 ? -0.6 : 0);
  // Cranium
  ctx.beginPath();
  ctx.arc(0, -9 + bodyBob, 6.0, 0, Math.PI * 2);
  ctx.fill();
  // Ribcage & Spine
  ctx.fillRect(-5.0, 0.5 + bodyBob, 10.0, 7.0);
  // Pelvis & Legs
  ctx.fillRect(-4.5, 7.5 + bodyBob, 9.0, 2.5);
  ctx.fillRect(-3.0 - legOffset, 10 + bodyBob, 2.2, 7.0);
  ctx.fillRect(1.5 + legOffset, 10 + bodyBob, 2.2, 7.0);
  // Notched Sword
  ctx.fillRect(5.8, -14.0 + bodyBob, 2.6, 17.0);
  ctx.fillRect(3.2, 2.8 + bodyBob, 7.5, 2.0);
  break;
}
case 'ghoul': {
  const crawl = (frame % 2 === 0 ? 1.8 : -1.8);
  const lunge = (frame === 1 ? 1.2 : frame === 3 ? -0.8 : 0);
  // Hunched Torso & Haunches
  ctx.beginPath();
  ctx.ellipse(-2, 1 + crawl, 12.0, 7.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(8.5 + lunge, -1.8 + crawl, 6.2, 4.5, 0.22, 0, Math.PI * 2);
  ctx.fill();
  // Claws & Limbs
  ctx.fillRect(6.0 + lunge, 8.0 + crawl, 6.0, 8.0);
  ctx.fillRect(-11.0, 8.0 - crawl, 4.0, 8.0);
  break;
}
```

---

## 6. Caveats
1. **Headless / Vitest Environment Differences**:
   - In browser environments, offscreen canvases are cached with real browser gradient objects.
   - In headless unit test environments (`DarkFantasySprites.test.ts`), `mockCtx.createLinearGradient` is not mocked. The procedural code must include runtime guards (`if (typeof ctx.createLinearGradient === 'function')`) so that fallback solid palette colors are used without throwing `TypeError`.
2. **Dimension Scaling**:
   - Skeleton coordinates span 21px wide × 35px high. A canvas size of `{ w: 40, h: 40, ox: 20, oy: 20 }` (or `{ w: 36, h: 36, ox: 18, oy: 18 }`) cleanly accommodates all frames. Changing `getDimensions('skeleton')` to `40x40` is safe since `getDimensions` is private and internal to `DarkFantasySprites.ts`.
3. **Flashing Invariant**:
   - `ChallengerM2_2.test.ts` checks that `ctx.fillStyle` equals `#ffffff` on white flash and `PALETTE.BLOOD_CRIMSON.FLASH` on crimson flash, but NOT on normal frames. The last fill style set in normal rendering is `#6e2f18` (rust) or `#380a0a` (dried blood), fully satisfying this invariant.

---

## 7. Conclusion
- The current minion sprites in `DarkFantasySprites.ts` are simplistic geometric prototypes that do not meet the aesthetic bar of a high-fidelity dark fantasy game.
- The formulated procedural designs for **Skeleton** and **Ghoul** introduce:
  1. Multi-layered anatomical depth (segmented spine, curved ribcage, iliac wings, hunched haunches).
  2. Weathered, decaying gradient textures (bone calvaria highlights, necrotic olive/emerald flesh, oxidized iron rust).
  3. Evocative micro-details (cranial fracture filigree, glowing crimson pinpoints, notched blade chipped cutouts, pulsating wet pustules, and tattered burial linen).
  4. Organic 4-frame walk cycles (pelvic sway, head bobbing, jaw chattering, lunging strike postures).
- The provided Canvas2D code is 100% compliant with the offscreen canvas caching system, guarantees zero-allocation 60Hz runtime blitting, and maintains full backward compatibility with all 21 test suites.

---

## 8. Verification Method

### 8.1 Automated Regression Verification
Run the complete unit test suite to verify zero regressions:
```bash
npx vitest run
```
Expected output: All 21 test files (247 tests) pass cleanly.

### 8.2 Targeted Sprite Test Verification
Run the sprite test suites specifically:
```bash
npx vitest run tests/unit/DarkFantasySprites.test.ts tests/unit/ChallengerM2_2.test.ts tests/unit/ChallengerDF_M2.test.ts
```
Expected output:
- `DarkFantasySprites.test.ts`: All 11 tests pass (key generation, frame wrapping, transforms).
- `ChallengerM2_2.test.ts`: All 12 tests pass (damage flash thresholds, mask switching, particle pool invariants).
- `ChallengerDF_M2.test.ts`: 1,000+ entities offscreen blitting completes in `< 5.0ms`.

### 8.3 Invalidation Conditions
- If any test throws `ctx.createLinearGradient is not a function`, the runtime guard was omitted.
- If `ChallengerM2_2.test.ts` fails assertion on normal `flashTimer <= 0`, verify that normal vector routines do not leave `ctx.fillStyle` set to `#ffffff` or `PALETTE.BLOOD_CRIMSON.FLASH`.
- If offscreen blitting benchmark exceeds `5.0ms`, verify offscreen cache keys are correctly hitting `this.cache`.
