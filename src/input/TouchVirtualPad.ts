/**
 * TouchVirtualPad.ts - On-Screen Virtual Controls for Mobile & Touch Devices.
 *
 * Provides:
 * - 8-Directional Virtual D-Pad / Analog Thumbstick on bottom-left.
 * - Action Buttons: FIRE (Red), JUMP (Blue), BOMB (Yellow) on bottom-right.
 * - Pause / Menu toggle button on top-right.
 * - Multi-touch PointerEvent tracking with touch-action: none.
 * - Edge-triggered PlayerInputSnapshot generation.
 */

import { PlayerInputSnapshot } from '../core/player/PlayerKinematics';

export interface TouchState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  jump: boolean;
  grenade: boolean;
  pause: boolean;
}

export class TouchVirtualPad {
  // Current button states
  public left: boolean = false;
  public right: boolean = false;
  public up: boolean = false;
  public down: boolean = false;
  public fire: boolean = false;
  public jump: boolean = false;
  public grenade: boolean = false;
  public pause: boolean = false;

  // Previous frame states for edge detection
  private prevJump: boolean = false;
  private prevFire: boolean = false;
  private prevGrenade: boolean = false;
  private prevPause: boolean = false;

  private paused: boolean = false;
  private overlayElement: HTMLElement | null = null;

  // Active touch identifiers
  private activeDpadPointerId: number | null = null;
  private dpadCenter: { x: number; y: number } = { x: 0, y: 0 };
  private readonly dpadRadius: number = 55;
  private readonly dpadDeadzone: number = 14;

  private dpadStickElement: HTMLElement | null = null;
  private isVisibleState: boolean = true;

  constructor() {}

  /**
   * Mounts the touch virtual pad DOM overlay over the specified game container.
   */
  public mount(container: HTMLElement): void {
    if (this.overlayElement) {
      this.destroy();
    }

    // Create overlay root
    const overlay = document.createElement('div');
    overlay.id = 'virtual-touch-pad';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.userSelect = 'none';
    overlay.style.webkitUserSelect = 'none';
    overlay.style.touchAction = 'none';
    overlay.style.zIndex = '20';
    overlay.style.display = this.isVisibleState ? 'block' : 'none';

    // 1. Virtual D-Pad (Bottom-Left)
    const dpadBase = document.createElement('div');
    dpadBase.id = 'touch-dpad-base';
    dpadBase.style.position = 'absolute';
    dpadBase.style.bottom = '24px';
    dpadBase.style.left = '24px';
    dpadBase.style.width = `${this.dpadRadius * 2}px`;
    dpadBase.style.height = `${this.dpadRadius * 2}px`;
    dpadBase.style.borderRadius = '50%';
    dpadBase.style.background = 'radial-gradient(circle, rgba(40,44,52,0.6) 0%, rgba(20,24,30,0.85) 100%)';
    dpadBase.style.border = '2px solid rgba(255,200,50,0.5)';
    dpadBase.style.boxShadow = '0 0 12px rgba(0,0,0,0.7), inset 0 0 8px rgba(255,200,50,0.2)';
    dpadBase.style.pointerEvents = 'auto';
    dpadBase.style.touchAction = 'none';

    // Cross direction arrows inside D-pad base
    dpadBase.innerHTML = `
      <div style="position:absolute;top:4px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:12px;font-weight:bold;">▲</div>
      <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:12px;font-weight:bold;">▼</div>
      <div style="position:absolute;left:4px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.7);font-size:12px;font-weight:bold;">◀</div>
      <div style="position:absolute;right:4px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.7);font-size:12px;font-weight:bold;">▶</div>
    `;

    // Stick thumb knob
    const dpadStick = document.createElement('div');
    dpadStick.id = 'touch-dpad-stick';
    dpadStick.style.position = 'absolute';
    dpadStick.style.top = '50%';
    dpadStick.style.left = '50%';
    dpadStick.style.width = '44px';
    dpadStick.style.height = '44px';
    dpadStick.style.marginLeft = '-22px';
    dpadStick.style.marginTop = '-22px';
    dpadStick.style.borderRadius = '50%';
    dpadStick.style.background = 'radial-gradient(circle, #e67e22 0%, #d35400 100%)';
    dpadStick.style.border = '2px solid #f39c12';
    dpadStick.style.boxShadow = '0 2px 6px rgba(0,0,0,0.8)';
    dpadStick.style.pointerEvents = 'none';
    dpadStick.style.transition = 'transform 0.05s ease-out';
    dpadBase.appendChild(dpadStick);
    this.dpadStickElement = dpadStick;

    // D-Pad Pointer Handlers
    dpadBase.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      dpadBase.setPointerCapture(e.pointerId);
      this.activeDpadPointerId = e.pointerId;
      const rect = dpadBase.getBoundingClientRect();
      this.dpadCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      this.updateDpadFromPointer(e.clientX, e.clientY);
    });

    dpadBase.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.activeDpadPointerId === e.pointerId) {
        e.preventDefault();
        this.updateDpadFromPointer(e.clientX, e.clientY);
      }
    });

    const releaseDpad = (e: PointerEvent) => {
      if (this.activeDpadPointerId === e.pointerId) {
        e.preventDefault();
        try {
          dpadBase.releasePointerCapture(e.pointerId);
        } catch {
          // Ignored
        }
        this.activeDpadPointerId = null;
        this.resetDpad();
      }
    };

    dpadBase.addEventListener('pointerup', releaseDpad);
    dpadBase.addEventListener('pointercancel', releaseDpad);

    overlay.appendChild(dpadBase);

    // 2. Action Buttons Cluster (Bottom-Right)
    const buttonCluster = document.createElement('div');
    buttonCluster.id = 'touch-buttons-cluster';
    buttonCluster.style.position = 'absolute';
    buttonCluster.style.bottom = '20px';
    buttonCluster.style.right = '24px';
    buttonCluster.style.width = '180px';
    buttonCluster.style.height = '140px';
    buttonCluster.style.pointerEvents = 'none';

    // Helper to create action buttons
    const createButton = (
      id: string,
      label: string,
      subLabel: string,
      color: string,
      shadowColor: string,
      x: number,
      y: number,
      size: number,
      onPress: (pressed: boolean) => void
    ) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.style.position = 'absolute';
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      btn.style.width = `${size}px`;
      btn.style.height = `${size}px`;
      btn.style.borderRadius = '50%';
      btn.style.background = color;
      btn.style.border = '2px solid rgba(255,255,255,0.7)';
      btn.style.boxShadow = `0 4px 10px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4), 0 0 10px ${shadowColor}`;
      btn.style.color = '#FFFFFF';
      btn.style.fontFamily = 'monospace, sans-serif';
      btn.style.fontWeight = '900';
      btn.style.fontSize = `${Math.floor(size * 0.28)}px`;
      btn.style.lineHeight = '1.1';
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.pointerEvents = 'auto';
      btn.style.touchAction = 'none';
      btn.style.cursor = 'pointer';
      btn.style.outline = 'none';
      btn.innerHTML = `<span>${label}</span><span style="font-size:9px;opacity:0.8;">${subLabel}</span>`;

      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.style.transform = 'scale(0.92)';
        btn.style.filter = 'brightness(1.2)';
        onPress(true);
      });

      const releaseBtn = (e: PointerEvent) => {
        e.preventDefault();
        try {
          btn.releasePointerCapture(e.pointerId);
        } catch {
          // Ignored
        }
        btn.style.transform = 'scale(1)';
        btn.style.filter = 'none';
        onPress(false);
      };

      btn.addEventListener('pointerup', releaseBtn);
      btn.addEventListener('pointercancel', releaseBtn);

      return btn;
    };

    // Button B: JUMP (Blue) - Bottom Left of cluster
    const jumpBtn = createButton(
      'touch-btn-jump',
      'JUMP',
      'K / X',
      'radial-gradient(circle, #2980b9 0%, #1c5980 100%)',
      'rgba(41, 128, 185, 0.6)',
      10,
      70,
      56,
      (pressed) => { this.jump = pressed; }
    );
    buttonCluster.appendChild(jumpBtn);

    // Button A: FIRE (Red) - Bottom Right of cluster
    const fireBtn = createButton(
      'touch-btn-fire',
      'FIRE',
      'J / Z',
      'radial-gradient(circle, #c0392b 0%, #962d22 100%)',
      'rgba(192, 57, 43, 0.6)',
      76,
      70,
      56,
      (pressed) => { this.fire = pressed; }
    );
    buttonCluster.appendChild(fireBtn);

    // Button C: BOMB / GRENADE (Yellow) - Top Center of cluster
    const grenadeBtn = createButton(
      'touch-btn-grenade',
      'BOMB',
      'L / C',
      'radial-gradient(circle, #f39c12 0%, #d68910 100%)',
      'rgba(243, 156, 18, 0.6)',
      45,
      6,
      52,
      (pressed) => { this.grenade = pressed; }
    );
    buttonCluster.appendChild(grenadeBtn);

    overlay.appendChild(buttonCluster);

    // 3. Pause / Menu Button (Top Right)
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'touch-btn-pause';
    pauseBtn.innerText = '⏸ PAUSE';
    pauseBtn.style.position = 'absolute';
    pauseBtn.style.top = '12px';
    pauseBtn.style.right = '12px';
    pauseBtn.style.padding = '6px 12px';
    pauseBtn.style.background = 'rgba(20, 24, 30, 0.85)';
    pauseBtn.style.border = '1px solid rgba(255, 200, 50, 0.6)';
    pauseBtn.style.borderRadius = '4px';
    pauseBtn.style.color = '#FFA010';
    pauseBtn.style.fontFamily = 'monospace, sans-serif';
    pauseBtn.style.fontSize = '12px';
    pauseBtn.style.fontWeight = 'bold';
    pauseBtn.style.pointerEvents = 'auto';
    pauseBtn.style.touchAction = 'none';
    pauseBtn.style.cursor = 'pointer';

    pauseBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.pause = true;
      this.togglePause();
    });

    pauseBtn.addEventListener('pointerup', (e: PointerEvent) => {
      e.preventDefault();
      this.pause = false;
    });

    overlay.appendChild(pauseBtn);

    this.overlayElement = overlay;
    container.appendChild(overlay);
  }

  private updateDpadFromPointer(clientX: number, clientY: number): void {
    const dx = clientX - this.dpadCenter.x;
    const dy = clientY - this.dpadCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp stick visual knob
    const maxVisual = Math.min(dist, this.dpadRadius - 10);
    const angle = Math.atan2(dy, dx);
    const visualX = Math.cos(angle) * maxVisual;
    const visualY = Math.sin(angle) * maxVisual;

    if (this.dpadStickElement) {
      this.dpadStickElement.style.transform = `translate(${visualX}px, ${visualY}px)`;
    }

    if (dist < this.dpadDeadzone) {
      this.left = false;
      this.right = false;
      this.up = false;
      this.down = false;
      return;
    }

    // 8-way directional sectors
    // angle in radians: -PI to +PI
    // Right: [-PI/8, PI/8]
    // Down-Right: [PI/8, 3PI/8]
    // Down: [3PI/8, 5PI/8]
    // Down-Left: [5PI/8, 7PI/8]
    // Left: [7PI/8, PI] or [-PI, -7PI/8]
    // Up-Left: [-7PI/8, -5PI/8]
    // Up: [-5PI/8, -3PI/8]
    // Up-Right: [-3PI/8, -PI/8]

    this.right = Math.abs(angle) <= (3 * Math.PI) / 8;
    this.left = Math.abs(angle) >= (5 * Math.PI) / 8;
    this.down = angle >= Math.PI / 8 && angle <= (7 * Math.PI) / 8;
    this.up = angle <= -Math.PI / 8 && angle >= (-7 * Math.PI) / 8;
  }

  private resetDpad(): void {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    if (this.dpadStickElement) {
      this.dpadStickElement.style.transform = 'translate(0px, 0px)';
    }
  }

  public getState(): TouchState {
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

  public getSnapshot(): PlayerInputSnapshot {
    const jumpPressed = this.jump && !this.prevJump;
    const shootPressed = this.fire && !this.prevFire;
    const grenadePressed = this.grenade && !this.prevGrenade;

    if (this.pause && !this.prevPause) {
      this.paused = !this.paused;
    }

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

  public setVisible(visible: boolean): void {
    this.isVisibleState = visible;
    if (this.overlayElement) {
      this.overlayElement.style.display = visible ? 'block' : 'none';
    }
  }

  public isVisible(): boolean {
    return this.isVisibleState;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  public destroy(): void {
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.dpadStickElement = null;
    this.resetDpad();
    this.fire = false;
    this.jump = false;
    this.grenade = false;
    this.pause = false;
  }
}
