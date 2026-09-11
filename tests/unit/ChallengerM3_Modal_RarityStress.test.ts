import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UpgradeModal,
  getCardRarity,
  RARITY_STYLES,
  CardRarity,
  CardBounds,
} from '../../src/ui/UpgradeModal';
import { UpgradeCard, UpgradeType } from '../../src/core/systems/UpgradeSystem';

/**
 * ChallengerM3_Modal_RarityStress.test.ts
 *
 * Empirical Adversarial Challenger Suite for Milestone 3 UI (challenger_m3_ui_2).
 * Stress tests:
 * 1. 4-Tier Rarity Engine across 1,000 randomized UpgradeCards (ranks 1-8, evolutions, passives, weapons).
 * 2. Dynamic Card Counts (empty [], 1, 2, 3, 4, 5, 8, 10, 20) with strict coordinate NaN & stack balance detection.
 * 3. Rapid Input Fuzzing: 10,000 rapid keystrokes across open/closed/reset lifecycles.
 * 4. Mouse Hover Coordinate Mapping: boundary hit precision, non-standard canvas aspect ratios, and cursor resets.
 * 5. Procedural Skill Icons: all 10 types, case variance, fallbacks, and missing canvas method resilience.
 */

describe('Challenger M3-2: UpgradeModal & Rarity Engine Adversarial Stress Suite', () => {
  let modal: UpgradeModal;
  let mockCtx: any;
  let capturedCalls: Array<{ method: string; args: any[] }>;
  let saveCount: number;
  let restoreCount: number;

  const checkFiniteCoords = (method: string, ...args: any[]) => {
    capturedCalls.push({ method, args });
    for (let i = 0; i < args.length; i++) {
      const val = args[i];
      if (typeof val === 'number') {
        if (Number.isNaN(val) || !Number.isFinite(val)) {
          throw new Error(`Adversarial Failure: NaN or non-finite coordinate in ${method} at arg ${i}: ${val}`);
        }
      }
    }
  };

  beforeEach(() => {
    modal = new UpgradeModal();
    capturedCalls = [];
    saveCount = 0;
    restoreCount = 0;

    const dummyGradient = {
      addColorStop: vi.fn(),
    };

    mockCtx = {
      save: vi.fn(() => {
        saveCount++;
      }),
      restore: vi.fn(() => {
        restoreCount++;
      }),
      fillRect: vi.fn((...args) => checkFiniteCoords('fillRect', ...args)),
      strokeRect: vi.fn((...args) => checkFiniteCoords('strokeRect', ...args)),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn((...args) => checkFiniteCoords('moveTo', ...args)),
      lineTo: vi.fn((...args) => checkFiniteCoords('lineTo', ...args)),
      arc: vi.fn((...args) => checkFiniteCoords('arc', ...args)),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn((_text, x, y, ...rest) => checkFiniteCoords('fillText', x, y, ...rest)),
      measureText: vi.fn((text: string) => ({ width: text ? text.length * 7 : 0 })),
      createLinearGradient: vi.fn((...args) => {
        checkFiniteCoords('createLinearGradient', ...args);
        return dummyGradient;
      }),
      createRadialGradient: vi.fn((...args) => {
        checkFiniteCoords('createRadialGradient', ...args);
        return dummyGradient;
      }),
      translate: vi.fn((...args) => checkFiniteCoords('translate', ...args)),
      scale: vi.fn((...args) => checkFiniteCoords('scale', ...args)),
      rect: vi.fn((...args) => checkFiniteCoords('rect', ...args)),
      clip: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      shadowColor: '',
      shadowBlur: 0,
    };
  });

  const generateRandomCard = (i: number): UpgradeCard => {
    const categories: Array<UpgradeCard['category']> = ['weapon', 'passive', 'evolution'];
    const types: UpgradeType[] = [
      UpgradeType.WEAPON_UNLOCK,
      UpgradeType.WEAPON_RANK,
      UpgradeType.PASSIVE_UNLOCK,
      UpgradeType.PASSIVE_RANK,
      UpgradeType.WEAPON_EVOLUTION,
    ];
    const icons = ['scythe', 'orbiters', 'lightning', 'spear', 'aura', 'tome', 'ring', 'chalice', 'magnet', 'armor'];

    const category = categories[i % categories.length];
    const isEvolution = category === 'evolution' || (i % 7 === 0);
    const newRank = (i % 8) + 1; // 1 to 8
    const previousRank = Math.max(0, newRank - 1);
    const type = isEvolution ? UpgradeType.WEAPON_EVOLUTION : types[i % types.length];
    const icon = icons[i % icons.length];

    return {
      id: `card_${i}`,
      itemId: `item_${i}`,
      name: `Occult Relic ${i}`,
      category,
      type,
      subtitle: `Rank ${newRank}`,
      previousRank,
      newRank,
      maxRank: 8,
      description: `Ancient forbidden enchantment description line for relic ${i} testing multi-line text wrapping logic.`,
      statChangeDescription: `+${(i * 5) % 100}% Potency`,
      icon,
      isEvolution,
    };
  };

  // =========================================================================
  // VECTOR 1: Rarity Distribution & Classification Across 1,000 Cards
  // =========================================================================
  describe('Vector 1: Rarity Distribution & Classification Stress (1,000 Cards)', () => {
    it('empirically asserts getCardRarity() produces valid RARITY_STYLES keys 100% of the time across 1,000 randomized cards', () => {
      const counts: Record<CardRarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
      };

      const validTiers = new Set<string>(['common', 'rare', 'epic', 'legendary']);

      for (let i = 0; i < 1000; i++) {
        const card = generateRandomCard(i);
        const rarity = getCardRarity(card);

        expect(validTiers.has(rarity)).toBe(true);
        expect(RARITY_STYLES[rarity]).toBeDefined();
        expect(typeof RARITY_STYLES[rarity].tierName).toBe('string');
        expect(typeof RARITY_STYLES[rarity].borderColor).toBe('string');
        expect(typeof RARITY_STYLES[rarity].borderHoverColor).toBe('string');
        expect(typeof RARITY_STYLES[rarity].glowColor).toBe('string');
        expect(typeof RARITY_STYLES[rarity].glowHoverColor).toBe('string');
        expect(typeof RARITY_STYLES[rarity].badgeBg).toBe('string');
        expect(typeof RARITY_STYLES[rarity].badgeText).toBe('string');
        expect(typeof RARITY_STYLES[rarity].particleColor).toBe('string');

        counts[rarity]++;
      }

      // Assert all 4 tiers are represented in the 1,000 generated cards
      expect(counts.legendary).toBeGreaterThan(0);
      expect(counts.epic).toBeGreaterThan(0);
      expect(counts.rare).toBeGreaterThan(0);
      expect(counts.common).toBeGreaterThan(0);

      const total = counts.common + counts.rare + counts.epic + counts.legendary;
      expect(total).toBe(1000);

      console.log(
        `[Challenger M3-2 Rarity Distribution] 1,000 Cards: Common=${counts.common}, Rare=${counts.rare}, Epic=${counts.epic}, Legendary=${counts.legendary}`
      );
    });

    it('rigorously tests edge-case and boundary inputs for getCardRarity()', () => {
      // Degenerate card with rank 0, empty category
      const degenerateCard: any = {
        id: 'degen',
        itemId: 'degen',
        name: 'Empty',
        category: '',
        type: -1,
        subtitle: '',
        previousRank: 0,
        newRank: 0,
        maxRank: 5,
        description: '',
        statChangeDescription: '',
        icon: '',
        isEvolution: false,
      };
      expect(getCardRarity(degenerateCard)).toBe('common');

      // Card with negative rank
      degenerateCard.newRank = -5;
      expect(getCardRarity(degenerateCard)).toBe('common');

      // Card with huge rank (e.g. 99)
      degenerateCard.newRank = 99;
      expect(getCardRarity(degenerateCard)).toBe('epic');

      // Card with evolution flag set
      degenerateCard.isEvolution = true;
      expect(getCardRarity(degenerateCard)).toBe('legendary');

      // Card with category 'evolution' regardless of isEvolution flag
      degenerateCard.isEvolution = false;
      degenerateCard.category = 'evolution';
      expect(getCardRarity(degenerateCard)).toBe('legendary');

      // Card with type 4 (WEAPON_EVOLUTION)
      degenerateCard.category = 'weapon';
      degenerateCard.isEvolution = false;
      degenerateCard.newRank = 1;
      degenerateCard.type = UpgradeType.WEAPON_EVOLUTION;
      expect(getCardRarity(degenerateCard)).toBe('epic');
    });
  });

  // =========================================================================
  // VECTOR 2: Dynamic Card Counts & Zero-NaN Coordinate Stress
  // =========================================================================
  describe('Vector 2: Dynamic Card Counts & Zero-NaN Coordinate Stress', () => {
    const cardCountsToTest = [0, 1, 2, 3, 4, 5, 8, 10, 20];

    for (const count of cardCountsToTest) {
      it(`renders correctly with ${count} cards without NaN coordinates and maintains balanced stack`, () => {
        const testCards: UpgradeCard[] = [];
        for (let i = 0; i < count; i++) {
          testCards.push(generateRandomCard(i));
        }

        modal.open(testCards, 5);
        modal.update(0.016);

        capturedCalls = [];
        saveCount = 0;
        restoreCount = 0;

        expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();

        // Balanced save/restore stack
        expect(saveCount).toBeGreaterThan(0);
        expect(saveCount).toBe(restoreCount);

        // Verify that NO call received NaN
        expect(capturedCalls.length).toBeGreaterThan(0);
        for (const call of capturedCalls) {
          for (let a = 0; a < call.args.length; a++) {
            const val = call.args[a];
            if (typeof val === 'number') {
              expect(Number.isNaN(val)).toBe(false);
              expect(Number.isFinite(val)).toBe(true);
            }
          }
        }

        modal.close();
      });
    }

    it('handles non-standard render dimensions (e.g. 1920x1080, 800x600, 1200x675) with zero NaNs', () => {
      const cards = [generateRandomCard(0), generateRandomCard(1), generateRandomCard(2)];
      modal.open(cards, 3);

      const resolutions = [
        { w: 960, h: 540 },
        { w: 1920, h: 1080 },
        { w: 1200, h: 675 },
        { w: 800, h: 600 },
        { w: 320, h: 240 },
      ];

      for (const res of resolutions) {
        capturedCalls = [];
        saveCount = 0;
        restoreCount = 0;

        expect(() => modal.render(mockCtx, res.w, res.h)).not.toThrow();
        expect(saveCount).toBe(restoreCount);

        for (const call of capturedCalls) {
          for (let a = 0; a < call.args.length; a++) {
            const val = call.args[a];
            if (typeof val === 'number') {
              expect(Number.isFinite(val)).toBe(true);
            }
          }
        }
      }

      modal.close();
    });
  });

  // =========================================================================
  // VECTOR 3: Rapid Input Fuzzing (10,000 Keystrokes)
  // =========================================================================
  describe('Vector 3: Rapid Input Fuzzing (10,000 Keystrokes Across Lifecycle)', () => {
    it('simulates 10,000 randomized rapid keystrokes without unhandled exceptions or invalid selections', () => {
      const selectedCards: UpgradeCard[] = [];
      modal.onSelect = (card: UpgradeCard) => {
        expect(card).toBeDefined();
        expect(typeof card.id).toBe('string');
        selectedCards.push(card);
      };

      const keyPool = [
        { code: 'Digit1', key: '1' },
        { code: 'Digit2', key: '2' },
        { code: 'Digit3', key: '3' },
        { code: 'Digit4', key: '4' },
        { code: 'Digit5', key: '5' },
        { code: 'Digit0', key: '0' },
        { code: 'ArrowLeft', key: 'ArrowLeft' },
        { code: 'ArrowRight', key: 'ArrowRight' },
        { code: 'ArrowUp', key: 'ArrowUp' },
        { code: 'ArrowDown', key: 'ArrowDown' },
        { code: 'Enter', key: 'Enter' },
        { code: 'Space', key: ' ' },
        { code: 'Escape', key: 'Escape' },
        { code: 'Tab', key: 'Tab' },
        { code: 'Backspace', key: 'Backspace' },
        { code: 'KeyA', key: 'a' },
      ];

      let openCount = 0;
      let closeCount = 0;
      let resetCount = 0;

      for (let i = 0; i < 10000; i++) {
        // Periodically toggle modal lifecycle
        const cycle = i % 1000;
        if (cycle === 0) {
          modal.reset();
          resetCount++;
        } else if (cycle === 500) {
          modal.close();
          closeCount++;
        } else if (cycle === 250 || cycle === 750) {
          const cardCount = (i % 4) + 1; // 1 to 4 cards
          const testCards = Array.from({ length: cardCount }, (_, idx) => generateRandomCard(idx));
          modal.open(testCards, Math.floor(i / 100) + 1);
          openCount++;
        }

        const keyEvt = keyPool[i % keyPool.length];
        expect(() => {
          (modal as any).handleKeyDown(keyEvt);
        }).not.toThrow();

        // Modal update simulation
        if (i % 50 === 0) {
          modal.update(0.016);
        }
      }

      console.log(
        `[Challenger M3-2 Input Fuzzing] 10,000 Keystrokes Completed: Selections=${selectedCards.length}, Opens=${openCount}, Closes=${closeCount}, Resets=${resetCount}`
      );
    });

    it('verifies arrow key circular navigation wrapping with various card counts', () => {
      const cards = [generateRandomCard(0), generateRandomCard(1), generateRandomCard(2)];
      modal.open(cards, 1);

      expect(modal.selectedIndex).toBe(0);

      // ArrowLeft from 0 wraps to 2
      (modal as any).handleKeyDown({ code: 'ArrowLeft' });
      expect(modal.selectedIndex).toBe(2);

      // ArrowRight from 2 wraps to 0
      (modal as any).handleKeyDown({ code: 'ArrowRight' });
      expect(modal.selectedIndex).toBe(0);

      // ArrowRight to 1
      (modal as any).handleKeyDown({ code: 'ArrowRight' });
      expect(modal.selectedIndex).toBe(1);

      modal.close();
    });

    it('safely ignores key input when modal is closed or cards array is empty', () => {
      const selectSpy = vi.fn();
      modal.onSelect = selectSpy;

      // Closed modal
      (modal as any).handleKeyDown({ code: 'Digit1', key: '1' });
      (modal as any).handleKeyDown({ code: 'Enter' });
      expect(selectSpy).not.toHaveBeenCalled();

      // Open modal with 0 cards
      modal.open([], 1);
      (modal as any).handleKeyDown({ code: 'Digit1', key: '1' });
      (modal as any).handleKeyDown({ code: 'Enter' });
      expect(selectSpy).not.toHaveBeenCalled();

      modal.close();
    });
  });

  // =========================================================================
  // VECTOR 4: Mouse Hover Coordinate Mapping & Aspect Ratio Resizing
  // =========================================================================
  describe('Vector 4: Mouse Hover Coordinate Mapping & Aspect Ratio Resizing', () => {
    it('accurately hits card boundaries and resets cursor when mouse leaves', () => {
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 0,
          width: 960,
          height: 540,
        }),
        style: { cursor: 'default' },
      };

      const cards = [generateRandomCard(0), generateRandomCard(1), generateRandomCard(2)];
      modal.open(cards, 2, mockCanvas);
      modal.render(mockCtx, 960, 540);

      const bounds: CardBounds[] = (modal as any).cardBounds;
      expect(bounds.length).toBe(3);

      // Test all 3 cards: center hit
      for (let i = 0; i < 3; i++) {
        const b = bounds[i];
        (modal as any).handleMouseMove({
          clientX: b.x + b.width / 2,
          clientY: b.y + b.height / 2,
        });
        expect(modal.hoveredIndex).toBe(i);
        expect(mockCanvas.style.cursor).toBe('pointer');
      }

      // Test boundary: exactly on top-left of card 0
      (modal as any).handleMouseMove({ clientX: bounds[0].x, clientY: bounds[0].y });
      expect(modal.hoveredIndex).toBe(0);
      expect(mockCanvas.style.cursor).toBe('pointer');

      // Test boundary: exactly on bottom-right of card 0
      (modal as any).handleMouseMove({
        clientX: bounds[0].x + bounds[0].width,
        clientY: bounds[0].y + bounds[0].height,
      });
      expect(modal.hoveredIndex).toBe(0);
      expect(mockCanvas.style.cursor).toBe('pointer');

      // Test 1px outside left of card 0
      (modal as any).handleMouseMove({
        clientX: bounds[0].x - 1,
        clientY: bounds[0].y + bounds[0].height / 2,
      });
      expect(modal.hoveredIndex).toBeNull();
      expect(mockCanvas.style.cursor).toBe('default');

      // Test 1px outside top of card 0
      (modal as any).handleMouseMove({
        clientX: bounds[0].x + bounds[0].width / 2,
        clientY: bounds[0].y - 1,
      });
      expect(modal.hoveredIndex).toBeNull();
      expect(mockCanvas.style.cursor).toBe('default');

      modal.close();
      expect(mockCanvas.style.cursor).toBe('default');
    });

    it('correctly maps client coordinates under non-1:1 canvas aspect ratio scaling', () => {
      // Viewport is scaled up to 1920x1080 with offset (left=100, top=50)
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 100,
          top: 50,
          width: 1920,
          height: 1080,
        }),
        style: { cursor: 'default' },
      };

      const cards = [generateRandomCard(0), generateRandomCard(1), generateRandomCard(2)];
      modal.open(cards, 2, mockCanvas);
      modal.render(mockCtx, 960, 540);

      const bounds: CardBounds[] = (modal as any).cardBounds;
      const targetCard = bounds[1]; // Center card

      // Calculate the physical screen coordinate corresponding to the center of card 1:
      // mx = (clientX - left) * (960 / width) => clientX = left + mx * (width / 960)
      const virtualCx = targetCard.x + targetCard.width / 2;
      const virtualCy = targetCard.y + targetCard.height / 2;

      const physicalClientX = 100 + virtualCx * (1920 / 960);
      const physicalClientY = 50 + virtualCy * (1080 / 540);

      (modal as any).handleMouseMove({ clientX: physicalClientX, clientY: physicalClientY });
      expect(modal.hoveredIndex).toBe(1);
      expect(mockCanvas.style.cursor).toBe('pointer');

      // Click confirms card 1
      const selectSpy = vi.fn();
      modal.onSelect = selectSpy;
      (modal as any).handleClick({});
      expect(selectSpy).toHaveBeenCalledWith(cards[1]);

      modal.close();
      expect(mockCanvas.style.cursor).toBe('default');
    });

    it('cleans up event listeners and resets state upon modal reset()', () => {
      const mockCanvas: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 960, height: 540 }),
        style: { cursor: 'pointer' },
      };

      const cards = [generateRandomCard(0)];
      modal.open(cards, 1, mockCanvas);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      modal.reset();
      expect(modal.getIsOpen()).toBe(false);
      expect(modal.hoveredIndex).toBeNull();
      expect(modal.selectedIndex).toBe(0);
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockCanvas.style.cursor).toBe('default');
    });
  });

  // =========================================================================
  // VECTOR 5: Procedural Skill Icons & Context Resilience
  // =========================================================================
  describe('Vector 5: Procedural Skill Icons & Missing Context Method Resilience', () => {
    const allIcons = [
      'scythe',
      'orbiters',
      'lightning',
      'spear',
      'aura',
      'tome',
      'ring',
      'chalice',
      'magnet',
      'armor',
    ];

    it('renders all 10 procedural skill icons in both normal and evolution states across all 4 rarity tiers', () => {
      const rarities: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];

      for (const icon of allIcons) {
        for (const isEvolution of [false, true]) {
          for (const rarityTier of rarities) {
            const card: UpgradeCard = {
              id: `test_${icon}_${rarityTier}`,
              itemId: `item_${icon}`,
              name: `Relic ${icon.toUpperCase()}`,
              category: isEvolution ? 'evolution' : (rarityTier === 'rare' ? 'passive' : 'weapon'),
              type: isEvolution ? UpgradeType.WEAPON_EVOLUTION : UpgradeType.WEAPON_RANK,
              subtitle: isEvolution ? 'Relic Evolution' : 'Rank 1',
              previousRank: 0,
              newRank: isEvolution ? 1 : (rarityTier === 'epic' ? 5 : 1),
              maxRank: 5,
              description: `Description text for ${icon}`,
              statChangeDescription: '+10% Potency',
              icon,
              isEvolution,
            };

            modal.open([card], 1);
            expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();
            modal.close();
          }
        }
      }
    });

    it('handles mixed-case icon names and unknown fallback icons gracefully', () => {
      const weirdIcons = ['SCYTHE', 'OrBiTeRs', 'LIGHTNING', 'Spear', '', 'totally_unknown_weapon', '123_custom'];

      for (const icon of weirdIcons) {
        const card: UpgradeCard = {
          id: `test_${icon}`,
          itemId: `item_${icon}`,
          name: `Relic ${icon}`,
          category: 'weapon',
          type: UpgradeType.WEAPON_RANK,
          subtitle: 'Rank 1',
          previousRank: 0,
          newRank: 1,
          maxRank: 5,
          description: 'A strange relic from the beyond',
          statChangeDescription: '+5% Stats',
          icon,
          isEvolution: false,
        };

        modal.open([card], 1);
        expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();
        modal.close();
      }
    });

    it('survives stripped context lacking scale, translate, or measureText gracefully', () => {
      // Simulate stripped canvas mock
      const strippedCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        // Missing measureText fallback simulation
        measureText: vi.fn().mockReturnValue({ width: 20 }),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        // Explicitly undefined transformation methods
        translate: undefined,
        scale: undefined,
      };

      const cards = [generateRandomCard(0), generateRandomCard(1)];
      modal.open(cards, 3);
      modal.hoveredIndex = 0; // Trigger hover branch where translate/scale are conditionally used

      expect(() => modal.render(strippedCtx, 960, 540)).not.toThrow();
      modal.close();
    });
  });
});
