import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardController } from '../../src/input/KeyboardController';
import { TouchVirtualPad } from '../../src/input/TouchVirtualPad';
import { HUDOverlay } from '../../src/ui/HUDOverlay';
import { createCanvasBuffer } from '../../src/render/sprites/ProceduralSpriteFactory';

describe('KeyboardController Suite', () => {
  let controller: KeyboardController;

  beforeEach(() => {
    controller = new KeyboardController();
  });

  it('should initialize with all keys neutral and not paused', () => {
    const state = controller.getState();
    expect(state.left).toBe(false);
    expect(state.right).toBe(false);
    expect(state.up).toBe(false);
    expect(state.down).toBe(false);
    expect(state.fire).toBe(false);
    expect(state.jump).toBe(false);
    expect(state.grenade).toBe(false);
    expect(state.pause).toBe(false);
    expect(controller.isPaused()).toBe(false);
  });

  it('should map WASD and arrow keys to directional actions', () => {
    controller.setAction('left', true);
    expect(controller.left).toBe(true);

    controller.setAction('right', true);
    expect(controller.right).toBe(true);

    controller.setAction('up', true);
    expect(controller.up).toBe(true);

    controller.setAction('down', true);
    expect(controller.down).toBe(true);

    controller.setAction('fire', true);
    expect(controller.fire).toBe(true);

    controller.setAction('jump', true);
    expect(controller.jump).toBe(true);

    controller.setAction('grenade', true);
    expect(controller.grenade).toBe(true);
  });

  it('should generate edge-triggered PlayerInputSnapshot correctly', () => {
    // Frame 1: Jump pressed
    controller.jump = true;
    controller.fire = true;
    const snap1 = controller.getSnapshot();

    expect(snap1.jumpPressed).toBe(true);
    expect(snap1.jumpHeld).toBe(true);
    expect(snap1.shootPressed).toBe(true);
    expect(snap1.shootHeld).toBe(true);

    // Frame 2: Jump and Fire still held
    const snap2 = controller.getSnapshot();
    expect(snap2.jumpPressed).toBe(false); // Not a new press
    expect(snap2.jumpHeld).toBe(true);
    expect(snap2.shootPressed).toBe(false);
    expect(snap2.shootHeld).toBe(true);

    // Frame 3: Released
    controller.jump = false;
    controller.fire = false;
    const snap3 = controller.getSnapshot();
    expect(snap3.jumpPressed).toBe(false);
    expect(snap3.jumpHeld).toBe(false);
    expect(snap3.shootPressed).toBe(false);
    expect(snap3.shootHeld).toBe(false);
  });

  it('should toggle pause when pause button is pressed', () => {
    expect(controller.isPaused()).toBe(false);
    controller.pause = true;
    controller.getSnapshot();
    expect(controller.isPaused()).toBe(true);

    // Release pause key
    controller.pause = false;
    controller.getSnapshot();
    expect(controller.isPaused()).toBe(true);

    // Press pause again
    controller.pause = true;
    controller.getSnapshot();
    expect(controller.isPaused()).toBe(false);
  });

  it('should reset all button states cleanly', () => {
    controller.left = true;
    controller.right = true;
    controller.jump = true;
    controller.fire = true;
    controller.reset();

    const state = controller.getState();
    expect(state.left).toBe(false);
    expect(state.right).toBe(false);
    expect(state.jump).toBe(false);
    expect(state.fire).toBe(false);
  });
});

describe('TouchVirtualPad Suite', () => {
  let touchPad: TouchVirtualPad;

  beforeEach(() => {
    touchPad = new TouchVirtualPad();
  });

  it('should initialize with all inputs neutral', () => {
    const state = touchPad.getState();
    expect(state.left).toBe(false);
    expect(state.right).toBe(false);
    expect(state.up).toBe(false);
    expect(state.down).toBe(false);
    expect(state.fire).toBe(false);
    expect(state.jump).toBe(false);
    expect(state.grenade).toBe(false);
    expect(touchPad.isVisible()).toBe(true);
  });

  it('should produce edge-triggered snapshots from touch state', () => {
    touchPad.fire = true;
    const snap1 = touchPad.getSnapshot();
    expect(snap1.shootPressed).toBe(true);
    expect(snap1.shootHeld).toBe(true);

    const snap2 = touchPad.getSnapshot();
    expect(snap2.shootPressed).toBe(false);
    expect(snap2.shootHeld).toBe(true);
  });

  it('should toggle visibility', () => {
    touchPad.setVisible(false);
    expect(touchPad.isVisible()).toBe(false);
    touchPad.setVisible(true);
    expect(touchPad.isVisible()).toBe(true);
  });
});

describe('HUDOverlay Suite', () => {
  let hud: HUDOverlay;

  beforeEach(() => {
    hud = new HUDOverlay();
  });

  it('should render complete HUD with all components without errors', () => {
    const buffer = createCanvasBuffer(480, 270);
    const ctx = buffer.getContext('2d');
    expect(ctx).not.toBeNull();
    if (!ctx) return;

    expect(() => {
      hud.render(
        ctx,
        {
          score: 54320,
          lives: 3,
          weaponType: 'HEAVY_MACHINE_GUN',
          ammo: 150,
          grenades: 8,
          hostagesRescued: 3,
          bossHealth: 1100,
          bossMaxHealth: 1500,
          bossName: 'STAGE 1 BOSS: TETSUYUKI',
          showBossWarning: true,
          bossWarningTimer: 2.0,
        },
        1.5
      );
    }).not.toThrow();
  });

  it('should render pistol weapon badge and infinity symbol for infinite ammo', () => {
    const buffer = createCanvasBuffer(480, 270);
    const ctx = buffer.getContext('2d');
    if (!ctx) return;

    expect(() => {
      hud.render(
        ctx,
        {
          score: 0,
          lives: 3,
          weaponType: 'PISTOL',
          ammo: Infinity,
          grenades: 10,
          hostagesRescued: 0,
        },
        0.0
      );
    }).not.toThrow();
  });

  it('should render paused and game over overlays gracefully', () => {
    const buffer = createCanvasBuffer(480, 270);
    const ctx = buffer.getContext('2d');
    if (!ctx) return;

    expect(() => {
      hud.render(
        ctx,
        {
          score: 1000,
          lives: 0,
          weaponType: 'FLAME_SHOT',
          ammo: 25,
          grenades: 2,
          hostagesRescued: 1,
          isPaused: true,
          isGameOver: true,
        },
        0.5
      );
    }).not.toThrow();
  });

  it('should render custom pixel text and digits accurately', () => {
    const buffer = createCanvasBuffer(480, 270);
    const ctx = buffer.getContext('2d');
    if (!ctx) return;

    expect(() => {
      hud.drawPixelText(ctx, 'TESTING 123 !?', 10, 10, '#FFFFFF', 1.0);
      hud.drawDigits(ctx, 98765, 50, 50, 6);
    }).not.toThrow();
  });
});
