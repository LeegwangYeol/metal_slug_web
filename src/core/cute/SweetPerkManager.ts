/**
 * SweetPerkManager.ts
 *
 * 3-Card Rogue-Lite Upgrade Pool ("Sugar Pop Blossom").
 * Generates card choices from a pool of 6 delightful perks, manages the selection modal
 * state machine, and applies persistent modifiers to player, pet companion, and bubbles.
 */

import { SweetPerkCard, RenderPerkCardState } from './CuteGameTypes';

export const PERK_POOL: SweetPerkCard[] = [
  {
    id: 'RAINBOW_SPRINKLES',
    title: 'Rainbow Sprinkles',
    description: 'Bubble blaster fires 2 additional micro-bubbles at angles',
    icon: '🌈',
    rarity: 'rare',
    category: 'sprinkles',
  },
  {
    id: 'BUBBLE_ORBITERS',
    title: 'Bubble Orbiters',
    description: '2 spinning protective bubbles orbit player, damaging nearby foes',
    icon: '🫧',
    rarity: 'legendary',
    category: 'orbiters',
  },
  {
    id: 'SUGAR_DASH_TRAIL',
    title: 'Sugar Dash Trail',
    description: 'Running leaves behind sparkling sugar clouds that slow foes',
    icon: '✨',
    rarity: 'common',
    category: 'dash',
  },
  {
    id: 'PET_PEP',
    title: 'Pet Pep',
    description: 'Mochi moves 40% faster and fires heart bolts twice as quickly',
    icon: '🐰',
    rarity: 'rare',
    category: 'pet',
  },
  {
    id: 'STAR_MAGNET',
    title: 'Star Magnet',
    description: 'Doubles candy and star pickup vacuum attraction radius',
    icon: '⭐',
    rarity: 'common',
    category: 'magnet',
  },
  {
    id: 'CUPCAKE_SHIELD',
    title: 'Cupcake Shield',
    description: 'Restores a life heart & halves Bubble Shield recharge cooldown',
    icon: '🧁',
    rarity: 'legendary',
    category: 'shield',
  },
];

export class SweetPerkManager {
  public isModalActive: boolean = false;
  public availableCards: SweetPerkCard[] = [];
  public selectedCardIndex: number = 0;
  public readonly acquiredPerks: Map<string, number> = new Map();

  // Callbacks
  public onPerkAcquired?: (perk: SweetPerkCard, level: number) => void;

  /**
   * Opens the 3-Card Rogue-Lite Perk Selection Modal.
   * Draws 3 distinct random cards from the perk pool.
   */
  public triggerPerkSelection(): SweetPerkCard[] {
    const poolCopy = [...PERK_POOL];
    const drawn: SweetPerkCard[] = [];

    // Draw 3 unique cards
    while (drawn.length < 3 && poolCopy.length > 0) {
      const idx = Math.floor(Math.random() * poolCopy.length);
      drawn.push(poolCopy.splice(idx, 1)[0]);
    }

    this.availableCards = drawn;
    this.selectedCardIndex = 0;
    this.isModalActive = true;
    return drawn;
  }

  /**
   * Navigates selected card index (0, 1, 2).
   */
  public navigate(direction: 1 | -1): number {
    if (this.availableCards.length === 0) return 0;
    this.selectedCardIndex = (this.selectedCardIndex + direction + this.availableCards.length) % this.availableCards.length;
    return this.selectedCardIndex;
  }

  /**
   * Selects a card by index (0, 1, or 2), applying the upgrade.
   */
  public selectCard(index: number = this.selectedCardIndex): SweetPerkCard | null {
    if (
      !this.isModalActive ||
      typeof index !== 'number' ||
      !Number.isFinite(index) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.availableCards.length
    ) {
      return null;
    }

    const card = this.availableCards[index];
    if (!card) {
      return null;
    }
    const currentLevel = this.acquiredPerks.get(card.id) ?? 0;
    const newLevel = currentLevel + 1;
    this.acquiredPerks.set(card.id, newLevel);

    this.isModalActive = false;
    this.availableCards = [];

    if (this.onPerkAcquired) {
      this.onPerkAcquired(card, newLevel);
    }

    return card;
  }

  /**
   * Returns true if perk is acquired.
   */
  public hasPerk(perkId: string): boolean {
    return (this.acquiredPerks.get(perkId) ?? 0) > 0;
  }

  /**
   * Gets acquired level of a perk.
   */
  public getPerkLevel(perkId: string): number {
    return this.acquiredPerks.get(perkId) ?? 0;
  }

  /**
   * Converts current available cards to render states.
   */
  public getRenderPerkCards(): RenderPerkCardState[] {
    return this.availableCards.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      rarity: c.rarity,
      category: c.category,
    }));
  }
}
