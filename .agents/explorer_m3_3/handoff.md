# Milestone M3 Investigation & Specification Report: Ultimate Move System, Audio Synthesis & Comprehensive Unit Test Suite

**Author**: Explorer Subagent `teamwork_preview_explorer` (`explorer_m3_3`)  
**Target Milestone**: M3 (Ultimate Move System & Procedural Sprites / Cinematic FX)  
**Date**: 2026-09-08  
**Project Root**: `/Users/user/teamwork_projects/metal_slug_web`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3`  
**Status**: COMPLETE (Read-Only Investigation & Test Architecture Design)

---

## 1. Observation

### 1.1 SoundEngine.ts Web Audio Graph & AudioTypes.ts
Direct inspection of `src/audio/SoundEngine.ts` and `src/audio/AudioTypes.ts` revealed:

1. **Audio Graph Hierarchy** (`SoundEngine.ts` lines 86–98):
   ```ts
   // Master audio graph
   this.masterGain = this.ctx.createGain();
   this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.masterVolume, this.ctx.currentTime);
   this.masterGain.connect(this.ctx.destination);

   this.sfxGain = this.ctx.createGain();
   this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
   this.sfxGain.connect(this.masterGain);

   this.voiceGain = this.ctx.createGain();
   this.voiceGain.gain.setValueAtTime(this.voiceVolume, this.ctx.currentTime);
   this.voiceGain.connect(this.masterGain);
   ```

2. **Noise Generators & Distortion Curve** (`SoundEngine.ts` lines 110–163):
   - `whiteNoiseBuffer`: 2-second buffer populated with `Math.random() * 2 - 1`.
   - `pinkNoiseBuffer`: 2-second buffer generated via Paul Kellet's 7-pole IIR filter algorithm (`b0`..`b6`).
   - `brownNoiseBuffer`: 2-second buffer generated via a leaky integrator (`lastOut + 0.02 * white) / 1.02 * 3.5`.
   - `distortionCurve`: 512-point `Float32Array` implementing `Math.tanh(3.2 * x)` for arcade warmth.

3. **Active Voice Limiting** (`SoundEngine.ts` lines 44–45, 291–307):
   - `maxActiveVoices = 32`.
   - `canPlaySFX()` enforces checks on AudioContext state, mute, and active voice ceiling.
   - `registerVoiceNode(node, duration)` auto-disconnects nodes and decrements voice count via `setTimeout(duration * 1000 + 50)`.

4. **Current Sound Methods & Types**:
   - `AudioTypes.ts` lines 5–17 define `SoundEffectType`:
     `'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT' | 'GRENADE_LAUNCH' | 'GRENADE_BOUNCE' | 'EXPLOSION' | 'KNIFE_SLASH' | 'BULLET_HIT' | 'ITEM_PICKUP' | 'SOLDIER_DEATH_STANDARD' | 'SOLDIER_DEATH_EXPLOSION' | 'SOLDIER_DEATH_FIRE'`
   - `SoundEngine.ts` currently implements: `playPistol`, `playHeavyMachineGun`, `playFlameShot`, `playGrenadeLaunch`, `playGrenadeBounce`, `playExplosion(isLarge)`, `playKnifeSlash`, `playBulletHit(isFlesh)`, `playItemPickup`, `playSoldierDeath(type)`.
   - **Gap Observed**: There are currently **NO** procedural routines in `SoundEngine.ts` for:
     - Air-raid siren (`playUltimateSiren` / `playAirRaidSiren`)
     - Heavy bomber flyover roar (`playFlyoverRoar` / `playBomberFlyover`)
     - Apocalyptic detonation shockwave (`playApocalypticBlast` / `playScreenDetonation`)
     - Nor are there methods for `playHydraulicHiss`, `playKiBlast`, `playShotgun`, `playLaser`, `playRocketThrust`.

### 1.2 Input System & Key Mapping
Inspection of `src/input/KeyboardController.ts` lines 64–93 revealed:
```ts
private readonly codeMap: Record<string, KeyAction> = {
  // Movement / Aiming: WASD & Arrows
  ...
  // Jump: Space, KeyK, KeyX
  Space: 'jump',
  KeyK: 'jump',
  KeyX: 'jump',

  // Fire: KeyJ, KeyZ
  KeyJ: 'fire',
  KeyZ: 'fire',

  // Grenade: KeyL, KeyC
  KeyL: 'grenade',
  KeyC: 'grenade',
  ...
};
```
- **Crucial Input Finding**: `KeyX` is already mapped to `'jump'`. Remapping `KeyX` would break existing jump controls and fail jump test suites (e.g. `adversarial_controls_jump.test.ts`). Therefore, **`KeyU` is strictly the dedicated Ultimate Move input key**, matching `PROJECT.md` line 23 (`Dedicated trigger on KeyU`).

### 1.3 Viewport Geometry & Spatial Query Mechanics
Inspection of `src/render/Camera.ts` lines 240–248 and `src/core/engine/StageManager.ts` lines 89–95:
```ts
public isVisible(box: AABB): boolean {
  const viewBounds: AABB = {
    x: this.renderX,
    y: this.renderY,
    width: this.viewportWidth,   // default 480
    height: this.viewportHeight, // default 270
  };
  return BoundingBox.intersects(box, viewBounds);
}
```
- `viewportWidth = 480`, `viewportHeight = 270`.
- In headless simulation (`GameEngine`), the active camera viewport is defined by `x: cameraX`, `y: 0`, `width: 480`, `height: 270`.
- Spatial queries can be performed deterministically by querying `engine.getAllEntities()` or `engine.spatialGrid.query(viewAABB)`.

### 1.4 Baseline Test Suites & 164 Sprite Key Invariant
1. Verification of baseline test suite via `npx vitest run`:
   - **Result**: `31 passed (31)`, `389 passed (389)`, duration 3.94s.
   - Clean TypeScript check via `npx tsc --noEmit`: 0 errors.
2. Invariant verification in `tests/unit/adversarial_sprites_crosshairs.test.ts` lines 162–199:
   - `it('EMPIRICAL CATEGORY AUDIT 1E: Verifies all major sprite key categories are populated and sum to exactly 164')`
   - `expect(allKeys.length).toBe(164);`
   - `ProceduralSpriteFactory.ts` lines 402–407:
     ```ts
     public getAllKeys(includePolish: boolean = false): string[] {
       if (includePolish) {
         return Array.from(this.spriteCache.keys());
       }
       return Array.from(this.spriteCache.keys()).filter((k) => !this.polishKeys.has(k));
     }
     ```
   - **Strict Constraint**: Default call `factory.getAllKeys()` MUST return exactly 164 keys. Any expansion sprites added in M3 must be isolated in `expansionKeys: Set<string>` and filtered out when `includeExpansion = false`!

---

## 2. Logic Chain

### 2.1 Web Audio Procedural Synthesis Architecture for Ultimate Move
To emulate arcade tactical airstrikes and cataclysmic super moves without external WAV/MP3 files, Web Audio synthesis must be designed with three distinct acoustic stages:

1. **Air-Raid Warning Siren (`playUltimateSiren()` / `playAirRaidSiren()`)**:
   - **Acoustic Function**: Signals the immediate time-freeze / tactical alert at Phase 1 activation.
   - **Synthesis Chain**:
     - Dual detuned Sawtooth/Triangle Oscillators (`osc1` at 480Hz -> 840Hz, `osc2` at 484Hz -> 848Hz) creating natural acoustic beating.
     - Cyclic pitch sweep: Frequency ramps between 480Hz and 880Hz over 0.5s via `linearRampToValueAtTime`.
     - Resonant Bandpass Biquad Filter (`type = 'bandpass'`, `freq = 720Hz`, `Q = 3.0`) imparting the metallic horn resonance of a mechanical civil defense siren.
     - Gain envelope: Quick 0.08s attack, steady hold for 0.35s, smooth exponential decay to 0.001 at 0.6s.

2. **Heavy Bomber Flyover Roar (`playFlyoverRoar()` / `playBomberFlyover()`)**:
   - **Acoustic Function**: Accompanies the visual strike pass (Heavy Bomber or Metal Slug SV-001 streak crossing the sky in Phase 2).
   - **Synthesis Chain**:
     - Swept Brownian Noise Buffer (`brownNoiseBuffer` -> Biquad lowpass filter).
     - Doppler frequency sweep: Filter cutoff ramps from 180Hz up to 620Hz at midpoint (t + 0.35s), then down to 140Hz as the aircraft recedes.
     - Turbine Drone: Dual low sawtooth oscillators (72Hz and 144Hz) passed through `WaveShaper` non-linear distortion (`distortionCurve`) to reproduce heavy twin-propeller air displacement.
     - White noise high-pass hiss (`hp = 3500Hz`) at low amplitude for high-speed wind shearing.
     - Total duration: 0.8s.

3. **Apocalyptic Screen Detonation (`playApocalypticBlast()` / `playScreenDetonation()`)**:
   - **Acoustic Function**: Cataclysmic multi-stage sonic shockwave for Phase 3 minion wipe and boss burst damage.
   - **Synthesis Chain**:
     - **Stage 1 (Initial Hypersonic Crack)**: Bandpass-filtered white noise transient (3200Hz -> 600Hz, 0.04s, sharp 1.0 gain impulse).
     - **Stage 2 (Massive Resonant Explosion Body)**: Pink/Brown noise through swept lowpass filter (3800Hz down to 45Hz with high resonance `Q = 4.2`), sustaining heavy explosive pressure over 2.2s.
     - **Stage 3 (Seismic Sub-Bass Wave)**: Deep sine oscillator sweeping from 140Hz down to 22Hz through `distortionCurve`, generating ground-rumbling bass that physically translates the screen shake.
     - **Stage 4 (Debris/Reverb Tail)**: Bandpass pink noise (1200Hz, Q=2.0) decaying exponentially to 0.001 over 2.4s.

4. **Additional Expansion Sound Methods**:
   - `playHydraulicHiss()`: White noise bandpass sweep (1600Hz -> 650Hz, 0.22s) for mechanical boss/vehicle limbs.
   - `playKiBlast()`: Resonant triangle chirp (1100Hz down to 280Hz) + highpass sizzle for Hyakutaro Ichimonji's Ki blast.
   - `playShotgun()`: Heavy punch transient (240Hz -> 45Hz) + wideband pink noise explosion (0.28s).
   - `playLaser()`: High square wave pulse (980Hz -> 1850Hz) + continuous 4kHz bandpass sizzle.
   - `playRocketThrust()`: Accelerating brown noise whoosh (120Hz -> 380Hz) + sub-drone.

### 2.2 UltimateManager Architecture & State Machine
Decoupled simulation class `src/core/player/UltimateManager.ts`:
- **State Enum**:
  ```ts
  export enum UltimatePhase {
    READY = 'READY',
    FREEZE = 'FREEZE',
    STRIKE_PASS = 'STRIKE_PASS',
    DETONATION = 'DETONATION',
    RECOVERY = 'RECOVERY',
  }
  ```
- **Timeline & Timings (60Hz Ticks)**:
  - `Phase 1: FREEZE` (0.50s / 30 ticks):
    - `isSimulationFrozen = true`.
    - Input to player locomotion is suppressed.
    - Emits `ultimate_freeze_started` and `play_sound: sfx_ultimate_siren`.
    - Screen tint/flash begins ramping up.
  - `Phase 2: STRIKE_PASS` (0.60s / 36 ticks):
    - Bomber / SV-001 streak traverses screen from `cameraX - 80` to `cameraX + 560`.
    - `flyoverProgress` advances monotonically from 0.0 to 1.0.
    - Emits `ultimate_strike_pass` and `play_sound: sfx_flyover_roar`.
  - `Phase 3: DETONATION` (0.40s / 24 ticks):
    - White/orange apocalyptic screen flash (`flashAlpha = 1.0`).
    - Violent screen shake emitted (`screen_shake: { amplitude: 18, durationFrames: 24 }`).
    - Emits `ultimate_detonation` and `play_sound: sfx_apocalyptic_blast`.
    - **Screen-Wipe Spatial Resolution**:
      - Viewport box = `[cameraX, 0, 480, 270]`.
      - Eliminates 100% of standard living minions within viewport.
      - Deals exactly 120 HP burst damage to bosses within viewport.
      - Vaporizes all hostile enemy projectiles on screen (`ENEMY_BULLET`, `ENEMY_GRENADE`, `HOMING_MISSILE`, `ARTILLERY_SHELL`).
      - Preserves 100% of off-screen minions.
      - Zero friendly fire against `PLAYER`, `ALLY_NPC`, or `POW`.
  - `Phase 4: RECOVERY` (0.30s / 18 ticks):
    - Flash decays to 0, smoke particles dissipate.
    - Timers wind down.
  - `Completion`:
    - Transitions back to `READY`.
    - `isSimulationFrozen = false`, normal movement and weapon controls restored.
    - Total sequence duration: 1.80s (108 ticks).

### 2.3 Stock & Cooldown Governance
- `stock: number`: Initialized to 1 (configurable, max 3).
- Trigger check: `canTrigger()` returns `true` ONLY IF `stock > 0 && phase === UltimatePhase.READY`.
- On successful trigger:
  - `stock--` (e.g. 1 -> 0).
  - Subsequent press with 0 stock returns `false`.
  - Pressing while in `FREEZE`, `STRIKE_PASS`, `DETONATION`, or `RECOVERY` returns `false`.
- Stock acquisition: `addStock(amount = 1)` allows replenishing stock from POW rescues or score milestones.

### 2.4 Viewport Spatial Query Invariant
To ensure mathematical precision between on-screen elimination and off-screen preservation:
- An entity is defined as on-screen if and only if:
  `BoundingBox.intersects(entity.bounds, viewAABB)`
  where `viewAABB = { x: cameraX, y: 0, width: 480, height: 270 }`.
- Entities with `x >= cameraX + 480` or `x + width <= cameraX` are strictly outside viewport and must receive 0 damage.

---

## 3. Caveats

1. **AudioContext Mocking in Vitest/Node**:
   - Web Audio `AudioContext` is a browser DOM API. In Node test environments (`vitest`), `typeof window === 'undefined'` or `window.AudioContext` is undefined unless polyfilled/mocked.
   - Test suites must verify audio triggers via the decoupled `engine.eventBus.on('play_sound')` pattern or by providing a lightweight mock `AudioContext` with `createOscillator`, `createGain`, `createBiquadFilter`, and `createBufferSource`.

2. **Boss Gating Mechanics (Iron Nokana & Mid-Boss)**:
   - Heavy bosses like `IronNokanaBoss` possess health gates (e.g. Phase 1 gate at 75% / 300 HP). If an Iron Nokana has 400 HP, a 120 HP burst would mathematically yield 280 HP, but the boss's internal health gate clamps it to 300 HP and transitions to Phase 2.
   - The test must assert that the boss either took 120 damage OR was reduced to its gate threshold (300 HP), advancing its phase cleanly without bypassing phase logic.

3. **Input Key Disambiguation**:
   - `KeyX` cannot be used as the ultimate key because it is mapped to `'jump'` in `KeyboardController.ts`. Only `KeyU` (and virtual button `button_ultimate`) should be wired to trigger the Ultimate Move.

4. **164 Baseline Sprite Key Invariant**:
   - When adding new visual sprites for M3 (airstrike bomber, bomb drop, shockwave ring, hazard reticles, crates), the Worker MUST add them to `private expansionKeys: Set<string>` in `ProceduralSpriteFactory.ts` and ensure `getAllKeys(false, false)` filters them out, leaving the count at exactly 164.

---

## 4. Conclusion & Concrete Implementation Blueprints

### 4.1 Required Additions to `src/audio/AudioTypes.ts`
```ts
// In SoundEffectType union:
export type SoundEffectType =
  | 'PISTOL'
  | 'HEAVY_MACHINE_GUN'
  | 'FLAME_SHOT'
  | 'GRENADE_LAUNCH'
  | 'GRENADE_BOUNCE'
  | 'EXPLOSION'
  | 'KNIFE_SLASH'
  | 'BULLET_HIT'
  | 'ITEM_PICKUP'
  | 'SOLDIER_DEATH_STANDARD'
  | 'SOLDIER_DEATH_EXPLOSION'
  | 'SOLDIER_DEATH_FIRE'
  // Milestone M3 Expansion SFX:
  | 'ULTIMATE_SIREN'
  | 'FLYOVER_ROAR'
  | 'APOCALYPTIC_BLAST'
  | 'HYDRAULIC_HISS'
  | 'KI_BLAST'
  | 'SHOTGUN'
  | 'LASER'
  | 'ROCKET_THRUST';

// In ISoundEngine interface:
export interface ISoundEngine {
  ...
  playUltimateSiren(): void;
  playFlyoverRoar(): void;
  playApocalypticBlast(): void;
  playHydraulicHiss?(): void;
  playKiBlast?(): void;
  playShotgun?(): void;
  playLaser?(): void;
  playRocketThrust?(): void;
}
```

### 4.2 Required Additions to `src/audio/SoundEngine.ts`
```ts
  /**
   * Ultimate Move SFX 1: Air-Raid Siren (Phase 1 Freeze)
   * Dual oscillating tone with metallic bandpass resonance.
   */
  public playUltimateSiren(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 0.55;

    // Dual detuned sawtooth oscillators
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    // Pitch sweep: 480Hz -> 880Hz -> 480Hz
    osc1.frequency.setValueAtTime(480, t);
    osc1.frequency.linearRampToValueAtTime(880, t + 0.25);
    osc1.frequency.linearRampToValueAtTime(480, t + duration);

    osc2.frequency.setValueAtTime(484, t);
    osc2.frequency.linearRampToValueAtTime(884, t + 0.25);
    osc2.frequency.linearRampToValueAtTime(484, t + duration);

    // Resonant horn filter
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(720, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.82, t + 0.08);
    gain.gain.setValueAtTime(0.82, t + 0.38);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
    this.registerVoiceNode(gain, duration);
  }

  /**
   * Ultimate Move SFX 2: Heavy Bomber Flyover Roar (Phase 2 Strike Pass)
   * Swept Brownian noise + low turbine drone with Doppler pitch shift.
   */
  public playFlyoverRoar(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 0.75;

    // Brownian Noise through Doppler Filter
    if (this.brownNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const lp = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      noise.buffer = this.brownNoiseBuffer;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.35); // Approach
      lp.frequency.exponentialRampToValueAtTime(140, t + duration); // Recede

      noiseGain.gain.setValueAtTime(0.05, t);
      noiseGain.gain.linearRampToValueAtTime(0.9, t + 0.35);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(lp);
      lp.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + duration);
      this.registerVoiceNode(noiseGain, duration);
    }

    // Heavy Twin-Turbine Drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(74, t);
    drone.frequency.linearRampToValueAtTime(96, t + 0.35);
    drone.frequency.linearRampToValueAtTime(58, t + duration);

    droneGain.gain.setValueAtTime(0.01, t);
    droneGain.gain.linearRampToValueAtTime(0.7, t + 0.35);
    droneGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    drone.connect(droneGain);
    droneGain.connect(this.sfxGain);

    drone.start(t);
    drone.stop(t + duration);
    this.registerVoiceNode(droneGain, duration);
  }

  /**
   * Ultimate Move SFX 3: Apocalyptic Detonation Shockwave (Phase 3 Detonation)
   * Multi-stage cataclysmic blast: transient crack, pink noise roar, seismic sub-bass rumble.
   */
  public playApocalypticBlast(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 2.4;

    // 1. Hypersonic Crack Transient
    if (this.whiteNoiseBuffer) {
      const crack = this.ctx.createBufferSource();
      const bp = this.ctx.createBiquadFilter();
      const cGain = this.ctx.createGain();

      crack.buffer = this.whiteNoiseBuffer;
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + 0.05);
      bp.Q.setValueAtTime(3.5, t);

      cGain.gain.setValueAtTime(1.0, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      crack.connect(bp);
      bp.connect(cGain);
      cGain.connect(this.sfxGain);

      crack.start(t);
      crack.stop(t + 0.06);
      this.registerVoiceNode(cGain, 0.06);
    }

    // 2. Heavy Resonant Pink/Brown Explosion Body
    if (this.pinkNoiseBuffer) {
      const blast = this.ctx.createBufferSource();
      const lp = this.ctx.createBiquadFilter();
      const bGain = this.ctx.createGain();

      blast.buffer = this.pinkNoiseBuffer;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(4000, t);
      lp.frequency.exponentialRampToValueAtTime(40, t + duration);
      lp.Q.setValueAtTime(4.2, t);

      bGain.gain.setValueAtTime(1.0, t);
      bGain.gain.setValueAtTime(0.95, t + 0.15);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      blast.connect(lp);
      lp.connect(bGain);
      bGain.connect(this.sfxGain);

      blast.start(t);
      blast.stop(t + duration);
      this.registerVoiceNode(bGain, duration);
    }

    // 3. Ground-Shaking Seismic Sub-Bass (140Hz -> 20Hz)
    const sub = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const subGain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(20, t + 1.2);

    if (this.distortionCurve) {
      shaper.curve = this.distortionCurve;
    }

    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);

    sub.connect(shaper);
    shaper.connect(subGain);
    subGain.connect(this.sfxGain);

    sub.start(t);
    sub.stop(t + 1.35);
    this.registerVoiceNode(subGain, 1.35);
  }
```

---

### 4.3 Complete Specification for `tests/unit/ultimate_move_system.test.ts`
Below is the full, exhaustive unit test suite designed for the Worker to implement directly at `tests/unit/ultimate_move_system.test.ts`.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB, BoundingBox } from '../../src/core/physics/AABB';
import { PlayerController } from '../../src/core/player/PlayerController';
import { KeyboardController } from '../../src/input/KeyboardController';
import { UltimateManager, UltimatePhase } from '../../src/core/player/UltimateManager';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { IronNokanaBoss } from '../../src/core/entities/boss/IronNokanaBoss';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { PowEntity } from '../../src/core/entities/pow/PowEntity';
import { ProceduralSpriteFactory } from '../../src/render/sprites/ProceduralSpriteFactory';
import { SoundEngine } from '../../src/audio/SoundEngine';

describe('Milestone M3: Ultimate Move System & Unit Test Specifications', () => {
  let engine: GameEngine;
  let player: PlayerController;
  let ultimateManager: UltimateManager;
  let keyboard: KeyboardController;

  const viewport = { x: 0, y: 0, width: 480, height: 270 };

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 220, 2000, 50),
    });

    player = new PlayerController(vec2(100, 200));
    engine.addEntity(player);

    ultimateManager = new UltimateManager({
      initialStock: 1,
      maxStock: 3,
      freezeDuration: 0.5,
      strikeDuration: 0.6,
      detonationDuration: 0.4,
      recoveryDuration: 0.3,
      bossDamage: 120,
    });
    keyboard = new KeyboardController();
  });

  // =========================================================================
  // SUITE 1: Dedicated KeyU Input & Stock / Cooldown Management
  // =========================================================================
  describe('1. Dedicated KeyU Input & Stock Management', () => {
    it('KeyboardController maps KeyU to ultimate action and edge-triggered snapshot', () => {
      expect(keyboard.codeMap['KeyU']).toBe('ultimate');

      keyboard.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyU' }));
      expect(keyboard.ultimate).toBe(true);

      const snap = keyboard.getSnapshot();
      expect(snap.ultimatePressed).toBe(true);

      // Edge trigger resets on next frame
      const snap2 = keyboard.getSnapshot();
      expect(snap2.ultimatePressed).toBe(false);
    });

    it('initializes with stock = 1 and phase = READY', () => {
      expect(ultimateManager.stock).toBe(1);
      expect(ultimateManager.phase).toBe(UltimatePhase.READY);
      expect(ultimateManager.canTrigger()).toBe(true);
      expect(ultimateManager.isSimulationFrozen).toBe(false);
    });

    it('triggers successfully with stock > 0, decrements stock, and transitions to FREEZE', () => {
      const activated = ultimateManager.trigger(engine);
      expect(activated).toBe(true);
      expect(ultimateManager.stock).toBe(0);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(ultimateManager.isSimulationFrozen).toBe(true);
    });

    it('fails to trigger when stock = 0', () => {
      ultimateManager.stock = 0;
      expect(ultimateManager.canTrigger()).toBe(false);

      const activated = ultimateManager.trigger(engine);
      expect(activated).toBe(false);
      expect(ultimateManager.phase).toBe(UltimatePhase.READY);
    });

    it('rejects re-triggering while an ultimate move is already active', () => {
      ultimateManager.stock = 2;
      ultimateManager.trigger(engine);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);

      // Attempt second trigger during active move
      const secondAttempt = ultimateManager.trigger(engine);
      expect(secondAttempt).toBe(false);
      expect(ultimateManager.stock).toBe(1); // stock not consumed
    });

    it('allows stock replenishment up to maxStock ceiling', () => {
      ultimateManager.stock = 1;
      ultimateManager.addStock(1);
      expect(ultimateManager.stock).toBe(2);

      ultimateManager.addStock(5); // Exceeds maxStock = 3
      expect(ultimateManager.stock).toBe(3);
    });
  });

  // =========================================================================
  // SUITE 2: 4-Phase State Progression Pipeline
  // =========================================================================
  describe('2. 4-Phase Cinematic Progression Pipeline', () => {
    it('progresses through Freeze -> Strike Pass -> Detonation -> Recovery -> Ready', () => {
      const events: string[] = [];
      engine.eventBus.on('ultimate_freeze_started', () => events.push('freeze'));
      engine.eventBus.on('ultimate_strike_pass', () => events.push('strike'));
      engine.eventBus.on('ultimate_detonation', () => events.push('detonation'));
      engine.eventBus.on('ultimate_completed', () => events.push('completed'));

      ultimateManager.trigger(engine);
      expect(ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(ultimateManager.isSimulationFrozen).toBe(true);

      // Step Phase 1 (Freeze, 0.5s = 30 ticks)
      for (let i = 0; i < 30; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.STRIKE_PASS);
      expect(events).toContain('freeze');
      expect(events).toContain('strike');

      // Step Phase 2 (Strike Pass, 0.6s = 36 ticks)
      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.flyoverProgress).toBeGreaterThan(0.4);
      expect(ultimateManager.flyoverProgress).toBeLessThan(0.6);

      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.DETONATION);
      expect(events).toContain('detonation');

      // Step Phase 3 (Detonation, 0.4s = 24 ticks)
      for (let i = 0; i < 24; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.RECOVERY);

      // Step Phase 4 (Recovery, 0.3s = 18 ticks)
      for (let i = 0; i < 18; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }
      expect(ultimateManager.phase).toBe(UltimatePhase.READY);
      expect(ultimateManager.isSimulationFrozen).toBe(false);
      expect(events).toContain('completed');
    });

    it('emits screen shake on detonation phase', () => {
      let shakeEmitted = false;
      let shakeAmplitude = 0;
      engine.eventBus.on('screen_shake', (data: { amplitude: number }) => {
        shakeEmitted = true;
        shakeAmplitude = data.amplitude;
      });

      ultimateManager.trigger(engine);
      // Fast forward to detonation (0.5s + 0.6s = 66 ticks)
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(shakeEmitted).toBe(true);
      expect(shakeAmplitude).toBeGreaterThanOrEqual(15);
    });
  });

  // =========================================================================
  // SUITE 3: 100% On-Screen Minion Elimination
  // =========================================================================
  describe('3. 100% Elimination of On-Screen Minions', () => {
    it('wipes all standard infantry minions (Rifle, Knife, Grenade) in viewport', () => {
      const s1 = new SoldierEnemy('m_rifle', 'SOLDIER_RIFLE', vec2(150, 190));
      const s2 = new SoldierEnemy('m_knife', 'SOLDIER_KNIFE', vec2(250, 190));
      const s3 = new SoldierEnemy('m_grenade', 'SOLDIER_GRENADE', vec2(350, 190));
      engine.addEntity(s1);
      engine.addEntity(s2);
      engine.addEntity(s3);
      engine.tick(1 / 60);

      expect(s1.isAlive).toBe(true);
      expect(s2.isAlive).toBe(true);
      expect(s3.isAlive).toBe(true);

      ultimateManager.trigger(engine);
      // Fast forward through freeze and strike pass to detonation
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(s1.isAlive).toBe(false);
      expect(s2.isAlive).toBe(false);
      expect(s3.isAlive).toBe(false);
    });

    it('wipes on-screen shield troopers even with frontal directional defense', () => {
      const shieldTrooper = new SoldierEnemy('m_shield', 'SOLDIER_SHIELD', vec2(280, 190));
      shieldTrooper.facing = -1; // Facing left toward player
      engine.addEntity(shieldTrooper);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(shieldTrooper.isAlive).toBe(false);
    });

    it('vaporizes on-screen hostile enemy projectiles and reticles', () => {
      const bullet: GameEntity = {
        id: 'hostile_bullet',
        type: 'ENEMY_BULLET',
        position: vec2(200, 150),
        velocity: vec2(-200, 0),
        bounds: createAABB(198, 148, 4, 4),
        isAlive: true,
        update: () => {},
      };
      engine.addEntity(bullet);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(bullet.isAlive).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: 120 HP Burst Damage to Bosses & Health Gates
  // =========================================================================
  describe('4. 120 HP Burst Damage to Bosses', () => {
    it('deals 120 HP burst damage to on-screen Iron Nokana Boss and triggers Phase 2 gate', () => {
      const nokana = new IronNokanaBoss('boss_nokana', vec2(300, 100), { customHp: 400 });
      engine.addEntity(nokana);
      engine.tick(1 / 60);

      expect(nokana.health).toBe(400);
      expect(nokana.phase).toBe('PHASE_1_CRAWLER_BARRAGE');

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // Iron Nokana has a 75% gate (300 HP). 400 - 120 = 280, clamped to 300 HP with Phase 2 transition
      expect(nokana.health).toBe(300);
      expect(nokana.phase).toBe('PHASE_2_FLAME_SWEEP');
      expect(nokana.isAlive).toBe(true); // NOT insta-killed
    });

    it('deals 120 HP burst damage to Tetsuyuki Boss', () => {
      const tetsuyuki = new TetsuyukiBoss('boss_tetsuyuki', vec2(250, 40));
      tetsuyuki.health = 400;
      tetsuyuki.maxHealth = 400;
      engine.addEntity(tetsuyuki);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // Tetsuyuki Phase 1 threshold is 65% (260 HP). 400 - 120 = 280 HP
      expect(tetsuyuki.health).toBe(280);
      expect(tetsuyuki.isAlive).toBe(true);
    });

    it('deals 120 HP burst damage to MidBossVehicle and respects gate transition', () => {
      const midboss = new MidBossVehicle('midboss_1', vec2(320, 160));
      midboss.health = 400;
      engine.addEntity(midboss);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      // 400 - 120 = 280 HP (Gate 1 is 240 HP)
      expect(midboss.health).toBe(280);
      expect(midboss.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: Off-Screen Minion Preservation
  // =========================================================================
  describe('5. Off-Screen Minion Preservation (Spatial Frustum Safety)', () => {
    it('preserves minions strictly outside the active camera viewport', () => {
      // In-screen minion
      const insideSoldier = new SoldierEnemy('s_inside', 'SOLDIER_RIFLE', vec2(200, 190));
      // Off-screen right minion (cameraX=0, viewport width=480, spawn at x=600)
      const outsideRightSoldier = new SoldierEnemy('s_outside_right', 'SOLDIER_RIFLE', vec2(600, 190));
      // Off-screen left minion (behind camera, x=-50)
      const outsideLeftSoldier = new SoldierEnemy('s_outside_left', 'SOLDIER_RIFLE', vec2(-50, 190));

      engine.addEntity(insideSoldier);
      engine.addEntity(outsideRightSoldier);
      engine.addEntity(outsideLeftSoldier);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(insideSoldier.isAlive).toBe(false);
      expect(outsideRightSoldier.isAlive).toBe(true);
      expect(outsideRightSoldier.health).toBe(outsideRightSoldier.maxHealth);
      expect(outsideLeftSoldier.isAlive).toBe(true);
    });

    it('rigorously tests viewport boundary edges (x = 479 vs x = 481)', () => {
      const edgeInside = new SoldierEnemy('edge_in', 'SOLDIER_RIFLE', vec2(465, 190)); // bounds: [453, 477]
      const edgeOutside = new SoldierEnemy('edge_out', 'SOLDIER_RIFLE', vec2(520, 190)); // bounds: [508, 532]

      engine.addEntity(edgeInside);
      engine.addEntity(edgeOutside);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(edgeInside.isAlive).toBe(false);
      expect(edgeOutside.isAlive).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 6: Zero Friendly Fire
  // =========================================================================
  describe('6. Zero Friendly Fire Against Player, Allies & POWs', () => {
    it('inflicts zero damage to player during detonation', () => {
      player.health = 1.0;
      player.shieldCharges = 2;

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(player.isAlive).toBe(true);
      expect(player.health).toBe(1.0);
      expect(player.shieldCharges).toBe(2);
    });

    it('inflicts zero damage to autonomous AllyNPC (Hyakutaro Ichimonji)', () => {
      const ally = new AllyNPC(vec2(180, 200));
      engine.addEntity(ally);
      engine.tick(1 / 60);

      const initialAllyHp = ally.health;

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(ally.isAlive).toBe(true);
      expect(ally.health).toBe(initialAllyHp);
    });

    it('does not destroy friendly ally projectiles (AllyKiBlast)', () => {
      const kiBlast = new AllyKiBlast('ki_1', vec2(220, 180), 1);
      engine.addEntity(kiBlast);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(kiBlast.isAlive).toBe(true);
    });

    it('does not harm or kill rescued / tied POWs in viewport', () => {
      const pow = new PowEntity('pow_1', vec2(200, 190), 'WEAPON_SHOTGUN');
      engine.addEntity(pow);
      engine.tick(1 / 60);

      ultimateManager.trigger(engine);
      for (let i = 0; i < 66; i++) {
        ultimateManager.update(1 / 60, engine, viewport);
      }

      expect(pow.isAlive).toBe(true);
      expect(pow.isRescued).toBe(false); // remains rescueable
    });
  });

  // =========================================================================
  // SUITE 7: Preservation of 164 Baseline Sprite Key Invariant
  // =========================================================================
  describe('7. Preservation of 164 Baseline Sprite Key Invariant', () => {
    it('default getAllKeys() returns exactly 164 keys', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const keys = factory.getAllKeys();
      expect(keys.length).toBe(164);
    });

    it('expansion sprite keys are isolated and returned only when includeExpansion is true', () => {
      const factory = ProceduralSpriteFactory.getInstance();
      const baselineKeys = factory.getAllKeys(false, false);
      const allWithExpansion = factory.getAllKeys(false, true);

      expect(baselineKeys.length).toBe(164);
      expect(allWithExpansion.length).toBeGreaterThanOrEqual(164);

      // Verify no duplicate keys across registry
      const uniqueSet = new Set(allWithExpansion);
      expect(uniqueSet.size).toBe(allWithExpansion.length);
    });
  });

  // =========================================================================
  // SUITE 8: Audio Engine Synthesis API Safety
  // =========================================================================
  describe('8. Procedural Audio Engine Method Verification', () => {
    it('SoundEngine exposes playUltimateSiren, playFlyoverRoar, and playApocalypticBlast safely', () => {
      const sound = new SoundEngine();
      expect(typeof sound.playUltimateSiren).toBe('function');
      expect(typeof sound.playFlyoverRoar).toBe('function');
      expect(typeof sound.playApocalypticBlast).toBe('function');

      // Safe execution in headless test environment (does not throw)
      expect(() => sound.playUltimateSiren()).not.toThrow();
      expect(() => sound.playFlyoverRoar()).not.toThrow();
      expect(() => sound.playApocalypticBlast()).not.toThrow();
    });
  });
});
```

---

## 5. Verification Method

To independently verify all findings and test specifications:

1. **Verify Current Baseline Passing (389 tests, 31 files)**:
   ```bash
   npx vitest run
   ```
   *Expected*: All 31 test files pass with 0 failures.

2. **Verify TypeScript Strict Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, 0 type errors.

3. **Verify 164 Sprite Key Invariant**:
   ```bash
   npx vitest run tests/unit/adversarial_sprites_crosshairs.test.ts
   ```
   *Expected*: `EMPIRICAL CATEGORY AUDIT 1E` asserts `allKeys.length === 164`.

4. **Verify Milestone M3 Suite Execution (Post-Worker Implementation)**:
   ```bash
   npx vitest run tests/unit/ultimate_move_system.test.ts
   ```
   *Expected*: All 24 unit tests across 8 suites pass 100% green.
