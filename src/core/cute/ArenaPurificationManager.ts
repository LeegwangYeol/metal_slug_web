/**
 * ArenaPurificationManager.ts
 *
 * Manages the 3 Blossom Altars (Lotus, Sunflower, Starlight Orchid) across the
 * Star Arena. Popping bubbles near altars purifies the ground (0.0 to 1.0),
 * blooming surrounding flowers and triggering 3-card rogue-lite perk selections.
 */

import { RenderAltarState } from './CuteGameTypes';

export interface BlossomAltar {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number; // Radius of influence (180px)
  purificationProgress: number; // 0.0 to 1.0
  isBloomed: boolean;
  bloomPetals: number;
  bloomAnimationTimer: number;
}

export class ArenaPurificationManager {
  public readonly altars: BlossomAltar[] = [];
  public static readonly ALTAR_INFLUENCE_RADIUS: number = 180;

  // Callbacks
  public onAltarBloomed?: (altar: BlossomAltar) => void;
  public onGardenFullyBloomed?: () => void;

  constructor() {
    this.initAltars();
  }

  private initAltars(): void {
    this.altars.push(
      {
        id: 'altar_lotus',
        name: 'Lotus Blossom Altar',
        x: 200,
        y: 220,
        radius: ArenaPurificationManager.ALTAR_INFLUENCE_RADIUS,
        purificationProgress: 0.0,
        isBloomed: false,
        bloomPetals: 6,
        bloomAnimationTimer: 0,
      },
      {
        id: 'altar_sunflower',
        name: 'Sun Meadow Altar',
        x: 500,
        y: 150,
        radius: ArenaPurificationManager.ALTAR_INFLUENCE_RADIUS,
        purificationProgress: 0.0,
        isBloomed: false,
        bloomPetals: 8,
        bloomAnimationTimer: 0,
      },
      {
        id: 'altar_starlight',
        name: 'Starlight Orchid Altar',
        x: 800,
        y: 165,
        radius: ArenaPurificationManager.ALTAR_INFLUENCE_RADIUS,
        purificationProgress: 0.0,
        isBloomed: false,
        bloomPetals: 5,
        bloomAnimationTimer: 0,
      }
    );
  }

  /**
   * Called when a bubble pops at (x, y) with a given combo multiplier.
   * Progresses nearby un-bloomed altars.
   */
  public onBubblePopped(x: number, y: number, combo: number = 1): void {
    for (const altar of this.altars) {
      if (altar.isBloomed) continue;

      const dx = altar.x - x;
      const dy = altar.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= altar.radius * altar.radius) {
        // Near altar! Progress increases by base 0.15 + combo bonus
        const progressIncrement = 0.15 + 0.02 * Math.min(combo, 5);
        altar.purificationProgress = Math.min(1.0, altar.purificationProgress + progressIncrement);

        if (altar.purificationProgress >= 1.0) {
          altar.isBloomed = true;
          altar.purificationProgress = 1.0;
          altar.bloomAnimationTimer = 1.5;

          if (this.onAltarBloomed) {
            this.onAltarBloomed(altar);
          }

          if (this.isGardenFullyBloomed() && this.onGardenFullyBloomed) {
            this.onGardenFullyBloomed();
          }
        }
      }
    }
  }

  /**
   * Advances altar bloom animation timers.
   */
  public update(dt: number): void {
    for (const altar of this.altars) {
      if (altar.bloomAnimationTimer > 0) {
        altar.bloomAnimationTimer = Math.max(0, altar.bloomAnimationTimer - dt);
      }
    }
  }

  /**
   * Returns true if all 3 altars have bloomed.
   */
  public isGardenFullyBloomed(): boolean {
    return this.altars.every((a) => a.isBloomed);
  }

  /**
   * Overall garden purification average (0.0 to 1.0).
   */
  public getOverallPurification(): number {
    const sum = this.altars.reduce((acc, a) => acc + a.purificationProgress, 0);
    return sum / this.altars.length;
  }

  /**
   * Converts to render states for CanvasRenderer / HUD.
   */
  public toRenderStates(): RenderAltarState[] {
    return this.altars.map((a) => ({
      id: a.id,
      name: a.name,
      x: a.x,
      y: a.y,
      purificationProgress: a.purificationProgress,
      isBloomed: a.isBloomed,
      bloomPetals: a.bloomPetals,
    }));
  }
}
