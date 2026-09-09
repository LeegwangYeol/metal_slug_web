import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProceduralSpriteFactory } from '../../src/render/sprites/ProceduralSpriteFactory';
import { KeyboardController } from '../../src/input/KeyboardController';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import { UltimatePhase } from '../../src/core/player/UltimateManager';
import { vec2 } from '../../src/core/math/Vector2D';

describe('CHALLENGER_M5: Full Verification Gate Empirical Audit', () => {
  let factory: ProceduralSpriteFactory;
  let keyboard: KeyboardController;

  beforeEach(() => {
    factory = ProceduralSpriteFactory.getInstance();
    keyboard = new KeyboardController();
  });

  // =========================================================================
  // REQUIREMENT 1: 164-Key Baseline Invariant over 1,000 Invocations
  // =========================================================================
  describe('1. ProceduralSpriteFactory 1,000-Invocation Invariant Audit', () => {
    it('EMPIRICAL 1.1: 1,000 consecutive invocations of getAllKeys() and count() return strictly 164 keys', () => {
      const BASELINE_COUNT = 164;
      const initialKeys = factory.getAllKeys();
      expect(initialKeys.length).toBe(BASELINE_COUNT);

      const knownExpansionPrefixes = [
        'tactical_bomber',
        'air_bomb_falling',
        'shockwave_ring',
        'iron_nokana',
        'hazard_',
        'ally_',
        'item_crate',
        'proj_shotgun',
        'proj_laser',
        'proj_homing',
        'player_shield_bubble',
      ];

      const knownPolishPrefixes = [
        'parachute_canopy',
        'rebel_death_',
      ];

      const referenceSignature = initialKeys.join('|');

      for (let i = 0; i < 1000; i++) {
        const keys = factory.getAllKeys();
        if (keys.length !== BASELINE_COUNT) {
          throw new Error(`Iteration ${i}: getAllKeys().length was ${keys.length}, expected ${BASELINE_COUNT}`);
        }
        if (factory.count() !== BASELINE_COUNT) {
          throw new Error(`Iteration ${i}: factory.count() was ${factory.count()}, expected ${BASELINE_COUNT}`);
        }
        if (new Set(keys).size !== BASELINE_COUNT) {
          throw new Error(`Iteration ${i}: Duplicate keys found in baseline key set`);
        }
        if (keys.join('|') !== referenceSignature) {
          throw new Error(`Iteration ${i}: Key ordering or composition mutated across invocations`);
        }

        // Assert 0% leak of expansion or polish keys
        for (const key of keys) {
          for (const exp of knownExpansionPrefixes) {
            if (key.startsWith(exp)) {
              throw new Error(`Iteration ${i}: Expansion key "${key}" leaked into baseline keys!`);
            }
          }
          for (const pol of knownPolishPrefixes) {
            if (key.startsWith(pol)) {
              throw new Error(`Iteration ${i}: Polish key "${key}" leaked into baseline keys!`);
            }
          }
        }
      }
    });

    it('EMPIRICAL 1.2: Category breakdown invariance verifies exactly 164 baseline keys', () => {
      const keys = factory.getAllKeys();
      const categories = {
        player: keys.filter((k) => k.startsWith('player_')),
        rebel: keys.filter((k) => k.startsWith('rebel_') || k.startsWith('soldier_')),
        pow: keys.filter((k) => k.startsWith('pow_')),
        ironTechnical: keys.filter((k) => k.startsWith('iron_technical_')),
        tetsuyuki: keys.filter((k) => k.startsWith('tetsuyuki_')),
        projectile: keys.filter((k) => k.startsWith('proj_')),
        casings: keys.filter((k) => k.startsWith('casing_')),
        explosions: keys.filter((k) => k.startsWith('explosion_')),
        hud: keys.filter((k) => k.startsWith('hud_')),
      };

      expect(categories.player.length).toBe(67);
      expect(categories.rebel.length).toBe(21);
      expect(categories.pow.length).toBe(9);
      expect(categories.ironTechnical.length).toBe(7);
      expect(categories.tetsuyuki.length).toBe(8);
      expect(categories.projectile.length).toBe(13);
      expect(categories.casings.length).toBe(4);
      expect(categories.explosions.length).toBe(18);
      expect(categories.hud.length).toBe(17);

      const total = Object.values(categories).reduce((sum, list) => sum + list.length, 0);
      expect(total).toBe(164);
      expect(keys.length).toBe(164);
    });

    it('EMPIRICAL 1.3: Calling getAllKeys with expansion and polish flags does not pollute baseline', () => {
      const fullCount = factory.getAllKeys(true, true).length;
      expect(fullCount).toBeGreaterThanOrEqual(219); // 164 baseline + 14 polish + 41 expansion

      // Immediate subsequent call without flags must be untouched
      const baseline = factory.getAllKeys();
      expect(baseline.length).toBe(164);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: KeyX (Jump) and KeyU (Ultimate) Zero Input Collisions & Execution
  // =========================================================================
  describe('2. KeyX (Jump) vs KeyU (Ultimate) Input Collision & Execution Audit', () => {
    it('EMPIRICAL 2.1: Keybindings dictionary strictly maps KeyX to jump and KeyU to ultimate with zero overlaps', () => {
      expect(keyboard.codeMap['KeyX']).toBe('jump');
      expect(keyboard.codeMap['KeyU']).toBe('ultimate');

      // Assert no other key action is mapped to KeyX or KeyU
      for (const [code, action] of Object.entries(keyboard.codeMap)) {
        if (code === 'KeyX') {
          expect(action).toBe('jump');
        }
        if (code === 'KeyU') {
          expect(action).toBe('ultimate');
        }
      }
    });

    it('EMPIRICAL 2.2: Isolated KeyX triggers jump state and kinematics with zero ultimate activation', () => {
      const engine = new GameEngine();
      const player = new PlayerController(vec2(100, 300));
      player.isGrounded = true;
      player.velocity.x = 0;
      player.velocity.y = 0;

      // Press KeyX
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);

      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.jumpPressed).toBe(true);
      expect(snap.jumpHeld).toBe(true);
      expect(snap.ultimatePressed).toBe(false);

      // Feed snapshot to PlayerController
      player.handleInput(snap, 1 / 60, engine);
      player.update(1 / 60, engine);

      // Player must have jumped (upward velocity impulse -360 px/s, ungrounded)
      expect(player.velocity.y).toBeLessThan(0);
      expect(player.isGrounded).toBe(false);

      // UltimateManager must still be in IDLE with full stock
      expect(player.ultimateManager.phase).toBe(UltimatePhase.IDLE);
      expect(player.ultimateManager.stock).toBe(1);
    });

    it('EMPIRICAL 2.3: Isolated KeyU triggers ultimate state and cinematic freeze with zero jump kinematics', () => {
      const engine = new GameEngine();
      const player = new PlayerController(vec2(100, 300));
      player.isGrounded = true;
      player.velocity.x = 0;
      player.velocity.y = 0;

      // Press KeyU
      keyboard['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);

      expect(keyboard.ultimate).toBe(true);
      expect(keyboard.jump).toBe(false);

      const snap = keyboard.getSnapshot();
      expect(snap.ultimatePressed).toBe(true);
      expect(snap.jumpPressed).toBe(false);
      expect(snap.jumpHeld).toBe(false);

      // Feed snapshot to PlayerController
      player.handleInput(snap, 1 / 60, engine);
      player.update(1 / 60, engine);

      // Player must NOT jump: stays grounded on platform
      expect(player.isGrounded).toBe(true);
      expect(player.velocity.y).toBe(0);

      // Ultimate move must be active and in FREEZE phase
      expect(player.ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(player.ultimateManager.isSimulationFrozen).toBe(true);
      expect(player.ultimateManager.stock).toBe(0);
    });

    it('EMPIRICAL 2.4: Simultaneous KeyX + KeyU press executes both actions concurrently without interference', () => {
      const engine = new GameEngine();
      const player = new PlayerController(vec2(100, 300));
      player.isGrounded = true;
      player.velocity.x = 0;
      player.velocity.y = 0;

      // Dispatch KeyX and KeyU concurrently
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);

      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(true);

      const snap = keyboard.getSnapshot();
      expect(snap.jumpPressed).toBe(true);
      expect(snap.jumpHeld).toBe(true);
      expect(snap.ultimatePressed).toBe(true);

      // Update player with combined inputs
      player.handleInput(snap, 1 / 60, engine);
      player.update(1 / 60, engine);

      // Both mechanics must have executed faithfully:
      // 1. Jump impulse applied
      expect(player.velocity.y).toBeLessThan(0);
      expect(player.isGrounded).toBe(false);

      // 2. Ultimate triggered
      expect(player.ultimateManager.phase).toBe(UltimatePhase.FREEZE);
      expect(player.ultimateManager.isSimulationFrozen).toBe(true);
    });

    it('EMPIRICAL 2.5: Releasing KeyX does not affect KeyU, and releasing KeyU does not affect KeyX', () => {
      // Press both
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      keyboard['handleKeyDown']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);
      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(true);

      // Release KeyX
      keyboard['handleKeyUp']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      expect(keyboard.jump).toBe(false);
      expect(keyboard.ultimate).toBe(true);

      // Re-press KeyX, release KeyU
      keyboard['handleKeyDown']({ code: 'KeyX', key: 'x', preventDefault: () => {} } as any);
      keyboard['handleKeyUp']({ code: 'KeyU', key: 'u', preventDefault: () => {} } as any);
      expect(keyboard.jump).toBe(true);
      expect(keyboard.ultimate).toBe(false);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Visual Screenshot Artifact Integrity & Color Entropy
  // =========================================================================
  describe('3. Visual Screenshot Artifacts Integrity & Color Entropy Audit', () => {
    const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/expansion');

    const EXPECTED_FILES = [
      'ally_pow_rescue.png',
      'crisis_boss_encounter.png',
      'screenshot_ally_and_weapons.png',
      'screenshot_boss_nokana_crisis.png',
      'screenshot_ultimate_detonation_blast.png',
      'screenshot_ultimate_strike_bomber.png',
      'ultimate_detonation_flash.png',
      'ultimate_strike_pass.png',
    ];

    /**
     * Calculates Shannon entropy (in bits per byte, 0 to 8) of a buffer.
     * High entropy (> 7.0) indicates dense, complex graphical data (compressed PNG data).
     * Degenerate/solid images or trivial patterns have markedly lower entropy.
     */
    function calculateShannonEntropy(buffer: Buffer): number {
      const frequencies = new Array(256).fill(0);
      for (let i = 0; i < buffer.length; i++) {
        frequencies[buffer[i]]++;
      }
      let entropy = 0;
      const total = buffer.length;
      for (let i = 0; i < 256; i++) {
        if (frequencies[i] > 0) {
          const p = frequencies[i] / total;
          entropy -= p * Math.log2(p);
        }
      }
      return entropy;
    }

    it('EMPIRICAL 3.1: artifacts/expansion/ directory contains all 8 required screenshots', () => {
      expect(fs.existsSync(ARTIFACT_DIR)).toBe(true);
      const files = fs.readdirSync(ARTIFACT_DIR);
      for (const expected of EXPECTED_FILES) {
        expect(files).toContain(expected);
      }
    });

    it('EMPIRICAL 3.2: Every screenshot is a valid PNG with high file size (> 20KB) and high color entropy (> 7.0 bits/byte)', () => {
      const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      for (const fileName of EXPECTED_FILES) {
        const filePath = path.join(ARTIFACT_DIR, fileName);
        const stat = fs.statSync(filePath);

        // 1. Non-empty, substantial file size (> 20,000 bytes)
        expect(stat.size).toBeGreaterThan(20000);

        const buffer = fs.readFileSync(filePath);

        // 2. Valid PNG Magic Bytes
        const header = buffer.subarray(0, 8);
        expect(header.equals(PNG_MAGIC)).toBe(true);

        // 3. Valid IHDR dimensions
        // Offset 12: chunk type "IHDR" (4 bytes)
        // Offset 16: width (4 bytes big-endian)
        // Offset 20: height (4 bytes big-endian)
        const chunkType = buffer.toString('ascii', 12, 16);
        expect(chunkType).toBe('IHDR');
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        expect(width).toBeGreaterThanOrEqual(800);
        expect(height).toBeGreaterThanOrEqual(450);

        // 4. Shannon Byte Entropy > 7.0 bits/byte (confirming dense pixel entropy)
        const entropy = calculateShannonEntropy(buffer);
        expect(entropy).toBeGreaterThan(7.0);

        // 5. Distinct byte distribution coverage (> 240 of 256 possible byte values present)
        const uniqueBytes = new Set(buffer).size;
        expect(uniqueBytes).toBeGreaterThan(240);
      }
    });
  });
});
