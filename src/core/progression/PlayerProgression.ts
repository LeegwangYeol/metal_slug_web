/**
 * PlayerProgression.ts - Dark Fantasy Soul Level & XP Mathematical Curve.
 *
 * Implements exponential leveling curve:
 *   XP_required(level) = Math.floor(baseXP * Math.pow(level, 1.5))
 * Supports surplus XP rollover, multi-level bursts, and event listeners.
 */

export interface LevelUpEvent {
  newLevel: number;
  previousLevel: number;
  surplusXP: number;
  xpRequiredForNext: number;
  totalXPEarned?: number;
}

export type LevelUpListener = (event: LevelUpEvent) => void;

export class PlayerProgression {
  public readonly baseXP: number;
  private level: number = 1;
  private currentXP: number = 0;
  private totalXP: number = 0;
  private xpToNextLevel: number;
  private listeners: Set<LevelUpListener> = new Set();

  constructor(baseXP: number = 10) {
    this.baseXP = baseXP;
    this.xpToNextLevel = this.calculateXPRequired(this.level);
  }

  public calculateXPRequired(level: number): number {
    return Math.floor(this.baseXP * Math.pow(level, 1.5));
  }

  public getLevel(): number {
    return this.level;
  }

  public getCurrentXP(): number {
    return this.currentXP;
  }

  public getTotalXP(): number {
    return this.totalXP;
  }

  public getXPToNextLevel(): number {
    return this.xpToNextLevel;
  }

  /**
   * Registers a level-up event listener.
   * Returns an unsubscribe function.
   */
  public onLevelUp(listener: LevelUpListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Adds XP to player progression.
   * Sequentially resolves single or multi-level bursts with zero overflow loss.
   * Returns the count of levels gained.
   */
  public addXP(amount: number): number {
    if (amount <= 0) return 0;

    this.currentXP += amount;
    this.totalXP += amount;
    let levelsGained = 0;

    while (this.currentXP >= this.xpToNextLevel) {
      this.currentXP -= this.xpToNextLevel;
      const prevLevel = this.level;
      this.level++;
      levelsGained++;
      this.xpToNextLevel = this.calculateXPRequired(this.level);

      const event: LevelUpEvent = {
        newLevel: this.level,
        previousLevel: prevLevel,
        surplusXP: this.currentXP,
        xpRequiredForNext: this.xpToNextLevel,
        totalXPEarned: this.totalXP,
      };

      for (const listener of this.listeners) {
        listener(event);
      }
    }

    return levelsGained;
  }

  /**
   * Resets progression back to Level 1, 0 XP.
   */
  public reset(): void {
    this.level = 1;
    this.currentXP = 0;
    this.totalXP = 0;
    this.xpToNextLevel = this.calculateXPRequired(1);
  }
}
