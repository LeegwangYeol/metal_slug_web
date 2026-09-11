import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UpgradeModal,
  getCardRarity,
  RARITY_STYLES,
  CardRarity,
} from '../../src/ui/UpgradeModal';
import { UpgradeCard, UpgradeType } from '../../src/core/systems/UpgradeSystem';

describe('UpgradeModal 4-Tier Rarity & Dark Gothic Glassmorphism Suite', () => {
  let modal: UpgradeModal;
  let mockCtx: any;
  let sampleCards: UpgradeCard[];

  beforeEach(() => {
    modal = new UpgradeModal();

    mockCtx = {
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
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      translate: vi.fn(),
      scale: vi.fn(),
      rect: vi.fn(),
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

    sampleCards = [
      {
        id: 'card_scythe',
        itemId: 'weapon_scythe',
        name: 'Arcane Scythe',
        category: 'weapon',
        type: UpgradeType.WEAPON_RANK,
        subtitle: 'Rank 2',
        previousRank: 1,
        newRank: 2,
        maxRank: 5,
        description: 'Sweeps in a wider arc',
        statChangeDescription: '+20% Damage',
        icon: 'scythe',
        isEvolution: false,
      },
      {
        id: 'card_might',
        itemId: 'passive_might',
        name: 'Tome of Might',
        category: 'passive',
        type: UpgradeType.PASSIVE_RANK,
        subtitle: 'Rank 3',
        previousRank: 2,
        newRank: 3,
        maxRank: 5,
        description: 'Augments weapon force',
        statChangeDescription: '+15% Might',
        icon: 'tome',
        isEvolution: false,
      },
      {
        id: 'card_spear_max',
        itemId: 'weapon_spear',
        name: 'Void Spear',
        category: 'weapon',
        type: UpgradeType.WEAPON_RANK,
        subtitle: 'Rank 5 (Mastery)',
        previousRank: 4,
        newRank: 5,
        maxRank: 5,
        description: 'Pierces through all foes',
        statChangeDescription: '+30% Pierce',
        icon: 'spear',
        isEvolution: false,
      },
      {
        id: 'card_evolution',
        itemId: 'evolution_scythe',
        name: 'Death Harvest',
        category: 'evolution',
        type: UpgradeType.WEAPON_EVOLUTION,
        subtitle: 'Relic Evolution',
        previousRank: 5,
        newRank: 1,
        maxRank: 1,
        description: 'Reaps souls with infinite vengeance',
        statChangeDescription: 'Transmuted Power',
        icon: 'scythe',
        isEvolution: true,
      },
    ];
  });

  describe('Suite 1: 4-Tier Rarity Engine & Derivation', () => {
    it('classifies evolution cards as legendary tier', () => {
      const evolutionCard: UpgradeCard = {
        ...sampleCards[0],
        isEvolution: true,
        category: 'evolution',
      };
      expect(getCardRarity(evolutionCard)).toBe('legendary');
    });

    it('classifies rank 5 or weapon evolution types as epic tier', () => {
      const epicCard: UpgradeCard = {
        ...sampleCards[0],
        isEvolution: false,
        newRank: 5,
      };
      expect(getCardRarity(epicCard)).toBe('epic');
    });

    it('classifies passives and rank >= 3 items as rare tier', () => {
      const passiveCard: UpgradeCard = {
        ...sampleCards[0],
        isEvolution: false,
        category: 'passive',
        newRank: 1,
      };
      expect(getCardRarity(passiveCard)).toBe('rare');

      const rank3Card: UpgradeCard = {
        ...sampleCards[0],
        isEvolution: false,
        category: 'weapon',
        newRank: 3,
      };
      expect(getCardRarity(rank3Card)).toBe('rare');
    });

    it('classifies base rank 1-2 non-passives as common tier', () => {
      const commonCard: UpgradeCard = {
        ...sampleCards[0],
        isEvolution: false,
        category: 'weapon',
        newRank: 2,
      };
      expect(getCardRarity(commonCard)).toBe('common');
    });

    it('defines distinct palette styling and glow colors across all 4 tiers', () => {
      const tiers: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];
      for (const tier of tiers) {
        const style = RARITY_STYLES[tier];
        expect(style).toBeDefined();
        expect(style.tierName).toBe(tier.toUpperCase());
        expect(style.borderColor).toMatch(/^#/);
        expect(style.borderHoverColor).toMatch(/^#/);
        expect(style.glowColor).toContain('rgba');
        expect(style.glowHoverColor).toContain('rgba');
        expect(style.badgeBg).toMatch(/^#/);
        expect(style.badgeText).toMatch(/^#/);
      }
    });
  });

  describe('Suite 2: Modal Lifecycle, Reset & Input Event Handling', () => {
    it('opens and closes with correct isOpen state', () => {
      expect(modal.getIsOpen()).toBe(false);

      modal.open(sampleCards, 3);
      expect(modal.getIsOpen()).toBe(true);

      modal.close();
      expect(modal.getIsOpen()).toBe(false);
    });

    it('resets selections, bounds, and cards on reset()', () => {
      modal.open(sampleCards, 2);
      modal.hoveredIndex = 2;
      modal.selectedIndex = 1;

      modal.reset();
      expect(modal.getIsOpen()).toBe(false);
      expect(modal.hoveredIndex).toBeNull();
      expect(modal.selectedIndex).toBe(0);
    });

    it('triggers onSelect callback when hotkey digit 1 is pressed', () => {
      const selectSpy = vi.fn();
      modal.onSelect = selectSpy;
      modal.open(sampleCards, 2);

      (modal as any).handleKeyDown({ code: 'Digit1', key: '1' });
      expect(selectSpy).toHaveBeenCalledWith(sampleCards[0]);
    });

    it('triggers onSelect callback when hotkey digit 4 is pressed', () => {
      const selectSpy = vi.fn();
      modal.onSelect = selectSpy;
      modal.open(sampleCards, 2);

      (modal as any).handleKeyDown({ code: 'Digit4', key: '4' });
      expect(selectSpy).toHaveBeenCalledWith(sampleCards[3]);
    });

    it('navigates cards with arrow keys and selects with Space or Enter', () => {
      const selectSpy = vi.fn();
      modal.onSelect = selectSpy;
      modal.open(sampleCards, 2);

      expect(modal.selectedIndex).toBe(0);

      // ArrowRight -> index 1
      (modal as any).handleKeyDown({ code: 'ArrowRight' });
      expect(modal.selectedIndex).toBe(1);

      // ArrowRight -> index 2
      (modal as any).handleKeyDown({ code: 'ArrowRight' });
      expect(modal.selectedIndex).toBe(2);

      // Press Enter -> select card 2
      (modal as any).handleKeyDown({ code: 'Enter' });
      expect(selectSpy).toHaveBeenCalledWith(sampleCards[2]);
    });
  });

  describe('Suite 3: Mouse Detection & Canvas Coordinate Scaling', () => {
    it('detects hovered card and updates canvas cursor', () => {
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

      modal.open(sampleCards.slice(0, 3), 2, mockCanvas);
      modal.render(mockCtx, 960, 540);

      // Card 1 is centered horizontally around (480, 200)
      (modal as any).handleMouseMove({ clientX: 480, clientY: 200 });
      expect(modal.hoveredIndex).toBe(1);
      expect(mockCanvas.style.cursor).toBe('pointer');

      // Move outside of cards
      (modal as any).handleMouseMove({ clientX: 10, clientY: 10 });
      expect(modal.hoveredIndex).toBeNull();
      expect(mockCanvas.style.cursor).toBe('default');
    });
  });

  describe('Suite 4: Glassmorphic Rendering & Procedural Skill Icons', () => {
    it('renders 3 and 4 card layouts with balanced save and restore stack', () => {
      // 3 cards
      modal.open(sampleCards.slice(0, 3), 2);
      modal.update(0.016);
      expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      // 4 cards
      modal.open(sampleCards, 4);
      modal.update(0.016);
      expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();
    });

    it('renders all custom procedural skill icons without crashing', () => {
      const icons = [
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
        'unknown_relic',
      ];

      for (const icon of icons) {
        const testCards: UpgradeCard[] = [
          {
            id: `test_${icon}`,
            itemId: `item_${icon}`,
            name: `Test ${icon}`,
            category: 'weapon',
            type: UpgradeType.WEAPON_RANK,
            subtitle: 'Rank 1',
            previousRank: 0,
            newRank: 1,
            maxRank: 5,
            description: `Description for ${icon}`,
            statChangeDescription: '+10% effect',
            icon: icon,
            isEvolution: false,
          },
        ];

        modal.open(testCards, 1);
        expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();
      }
    });

    it('advances traveling perimeter gleam and ambient motes over time', () => {
      modal.open(sampleCards, 3);
      modal.update(0.1);
      expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();

      modal.update(0.5);
      expect(() => modal.render(mockCtx, 960, 540)).not.toThrow();
    });
  });
});
