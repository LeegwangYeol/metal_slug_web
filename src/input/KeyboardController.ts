/**
 * KeyboardController.ts - Authentic Arcade Keyboard Input Controller.
 *
 * Mappings:
 * - Movement & 8-Way Aiming: WASD / Arrow Keys
 * - Fire: J / Z / Space
 * - Jump: K / X
 * - Grenade: L / C
 * - Pause: Enter / Escape
 *
 * Exposes:
 * - Current raw state: { left, right, up, down, fire, jump, grenade }
 * - Edge-triggered PlayerInputSnapshot for fixed 60Hz physics integration
 */

import { PlayerInputSnapshot } from '../core/player/PlayerKinematics';

export interface KeyboardState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  jump: boolean;
  grenade: boolean;
  pause: boolean;
}

export type KeyAction = 'left' | 'right' | 'up' | 'down' | 'fire' | 'jump' | 'grenade' | 'pause';

export class KeyboardController {
  // Current button held states
  public left: boolean = false;
  public right: boolean = false;
  public up: boolean = false;
  public down: boolean = false;
  public fire: boolean = false;
  public jump: boolean = false;
  public grenade: boolean = false;
  public pause: boolean = false;

  // Previous button states for edge-detection (Pressed vs Held)
  private prevJump: boolean = false;
  private prevFire: boolean = false;
  private prevGrenade: boolean = false;
  private prevPause: boolean = false;

  // Pause toggle state
  private paused: boolean = false;

  // Attached target & listeners
  private target: EventTarget | null = null;
  private isAttached: boolean = false;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;

  // Key mappings by code and key
  private readonly codeMap: Record<string, KeyAction> = {
    // Movement / Aiming: WASD
    KeyW: 'up',
    KeyA: 'left',
    KeyS: 'down',
    KeyD: 'right',

    // Movement / Aiming: Arrow Keys
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowDown: 'down',
    ArrowRight: 'right',

    // Fire: J, Z, Space
    KeyJ: 'fire',
    KeyZ: 'fire',
    Space: 'fire',

    // Jump: K, X
    KeyK: 'jump',
    KeyX: 'jump',

    // Grenade: L, C
    KeyL: 'grenade',
    KeyC: 'grenade',

    // Pause: Enter, Escape
    Enter: 'pause',
    Escape: 'pause',
  };

  constructor(target?: EventTarget) {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onBlurBound = this.reset.bind(this);

    if (target) {
      this.attach(target);
    } else if (typeof window !== 'undefined') {
      this.attach(window);
    }
  }

  /**
   * Attaches keyboard event listeners to window or container.
   */
  public attach(target: EventTarget): void {
    if (this.isAttached) {
      this.detach();
    }
    this.target = target;
    this.target.addEventListener('keydown', this.onKeyDownBound as EventListener);
    this.target.addEventListener('keyup', this.onKeyUpBound as EventListener);

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.onBlurBound);
    }
    this.isAttached = true;
  }

  /**
   * Detaches event listeners.
   */
  public detach(): void {
    if (this.target && this.isAttached) {
      this.target.removeEventListener('keydown', this.onKeyDownBound as EventListener);
      this.target.removeEventListener('keyup', this.onKeyUpBound as EventListener);
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', this.onBlurBound);
      }
      this.target = null;
      this.isAttached = false;
    }
    this.reset();
  }

  /**
   * Returns current input state: { left, right, up, down, fire, jump, grenade }.
   */
  public getState(): KeyboardState {
    return {
      left: this.left,
      right: this.right,
      up: this.up,
      down: this.down,
      fire: this.fire,
      jump: this.jump,
      grenade: this.grenade,
      pause: this.pause,
    };
  }

  /**
   * Generates and advances a PlayerInputSnapshot with edge-detected pressed flags.
   */
  public getSnapshot(): PlayerInputSnapshot {
    const jumpPressed = this.jump && !this.prevJump;
    const shootPressed = this.fire && !this.prevFire;
    const grenadePressed = this.grenade && !this.prevGrenade;

    // Edge-detect pause toggle
    if (this.pause && !this.prevPause) {
      this.paused = !this.paused;
    }

    // Save previous frame states
    this.prevJump = this.jump;
    this.prevFire = this.fire;
    this.prevGrenade = this.grenade;
    this.prevPause = this.pause;

    return {
      left: this.left,
      right: this.right,
      up: this.up,
      down: this.down,
      jumpPressed,
      jumpHeld: this.jump,
      shootPressed,
      shootHeld: this.fire,
      grenadePressed,
    };
  }

  /**
   * Resets all keys and states to false.
   */
  public reset(): void {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.fire = false;
    this.jump = false;
    this.grenade = false;
    this.pause = false;

    this.prevJump = false;
    this.prevFire = false;
    this.prevGrenade = false;
    this.prevPause = false;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  // --- Keyboard Event Handlers ---

  private handleKeyDown(e: KeyboardEvent): void {
    const action = this.resolveAction(e);
    if (!action) return;

    // Prevent default scrolling for game controls
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    this.setAction(action, true);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const action = this.resolveAction(e);
    if (!action) return;
    this.setAction(action, false);
  }

  private resolveAction(e: KeyboardEvent): KeyAction | undefined {
    // Check by standard code first
    if (e.code && this.codeMap[e.code]) {
      return this.codeMap[e.code];
    }
    // Fallback to key
    const keyLower = e.key ? e.key.toLowerCase() : '';
    switch (keyLower) {
      case 'w':
      case 'arrowup':
        return 'up';
      case 'a':
      case 'arrowleft':
        return 'left';
      case 's':
      case 'arrowdown':
        return 'down';
      case 'd':
      case 'arrowright':
        return 'right';
      case 'j':
      case 'z':
      case ' ':
        return 'fire';
      case 'k':
      case 'x':
        return 'jump';
      case 'l':
      case 'c':
        return 'grenade';
      case 'enter':
      case 'escape':
        return 'pause';
      default:
        return undefined;
    }
  }

  public setAction(action: KeyAction, value: boolean): void {
    switch (action) {
      case 'left':
        this.left = value;
        break;
      case 'right':
        this.right = value;
        break;
      case 'up':
        this.up = value;
        break;
      case 'down':
        this.down = value;
        break;
      case 'fire':
        this.fire = value;
        break;
      case 'jump':
        this.jump = value;
        break;
      case 'grenade':
        this.grenade = value;
        break;
      case 'pause':
        this.pause = value;
        break;
    }
  }
}
