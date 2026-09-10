# Milestone M3 Handoff Report: Occult Arsenal Upgrades, Synergies & Gothic Modal

**Agent**: Explorer 2 (`explorer_df_m3_2`)  
**Mission**: Architectural Investigation & Blueprint Design for Rogue-Lite Upgrades, Passives, Synergistic Weapon Evolutions, and Gothic Level-Up Modal  
**Date**: 2026-09-10  
**Status**: COMPLETE  

---

## 1. Observation

### 1.1 Codebase Structure & Existing APIs
1. **Player Progression & Level-Up Pipeline** (`src/core/progression/PlayerProgression.ts`):
   - Lines 32–34: Exponential XP requirement curve:
     $$\text{XP}_{\text{required}}(\text{level}) = \lfloor \text{baseXP} \times \text{level}^{1.5} \rfloor$$
     With $\text{baseXP} = 10$, benchmark thresholds are: Level 1: 10 XP, Level 2: 28 XP, Level 3: 51 XP, Level 4: 80 XP, Level 5: 111 XP.
   - Lines 68–96: `addXP(amount: number): number` supports single- or multi-level bursts in a `while (currentXP >= xpToNextLevel)` loop, firing `onLevelUp` listeners once per level gained.
   - In `src/core/entities/Player.ts` lines 186–205: `Player.gainXP(amount, engine)` receives the `levelsGained` count and emits `player_levelup` over `engine.eventBus`.
   - **Crucial Observation**: When multiple levels are gained in a single tick (e.g. collecting a massive ruby or violet XP gem), `addXP` loops and triggers the listener multiple times. The game must queue pending level-up choices (`pendingLevelUps: number`) to prevent dropping level-up choices or closing the modal prematurely.

2. **Player Stats & Passive Modifiers** (`src/core/player/PlayerStats.ts` & `src/core/entities/Player.ts`):
   - Lines 7–19 of `PlayerStats.ts`: Defines the 11 core statistics:
     - `maxHealth` (default 100), `currentHealth` (100), `healthRegen` (0.2 HP/s)
     - `armor` (0), `moveSpeed` (200 px/s), `might` (1.0x damage multiplier)
     - `area` (1.0x AoE multiplier), `projSpeed` (1.0x projectile velocity)
     - `cooldownReduction` (0.0 with hard clamp at 0.50 / 50% max)
     - `magnetRadius` (90 px), `luck` (1.0x)
   - Lines 247–258 of `Player.ts`: `applyStatDelta(stat: keyof PlayerStats, delta: number)` applies permanent stat changes directly with built-in safety clamps:
     - `cooldownReduction` is clamped to $[0.0, 0.50]$.
     - `maxHealth` increases by `delta` and immediately heals the player by `delta`.
     - `armor`, `might`, `moveSpeed`, `magnetRadius`, and `healthRegen` scale additively.

3. **Gothic HUD & Inventory Rendering** (`src/ui/GothicHUD.ts`):
   - Lines 14–63: Full `GOTHIC_HUD_THEME` with defined color tokens:
     - `abyssalVoid: '#08060c'`, `charredBlack: '#0f0d1a'`, `obsidianInset: '#171326'`, `obsidianBorder: '#2d2b38'`
     - `bloodDark: '#380a0a'`, `bloodBase: '#6b1212'`, `bloodBright: '#e53e3e'`
     - `necroticDark: '#0d3824'`, `necroticMid: '#19633e'`, `necroticBright: '#28a745'`, `necroticGlow: '#68d391'`
     - `arcaneDark: '#1a0c2e'`, `arcaneMid: '#3c1b6b'`, `arcaneBright: '#7038b8'`, `arcaneGlow: '#b794f6'`
     - `boneIvory: '#ede5de'`, `boneMuted: '#b8aea5'`, `goldFiligree: '#d4af37'`
   - Lines 65–72: Existing `InventorySlotData` interface:
     ```ts
     export interface InventorySlotData {
       id: string;
       name: string;
       icon: string; // 'scythe', 'orbiters', 'lightning', 'spear', 'aura', 'tome', 'ring', 'chalice', 'magnet', 'armor'
       rank: number; // 1 to 5
       maxRank?: number; // default 5
       isEvolution?: boolean;
     }
     ```
   - Lines 514–588: Renders 2 rows of 6 inventory slots (top row: Weapons, bottom row: Passives) with procedural icons and 5 rank pips. When `isEvolution === true`, rank pips render in glowing `goldFiligree` (`#d4af37`) instead of `necroticGlow` (`#68d391`).

4. **Engine Loop & Timestep Handling** (`src/main.ts` & `src/core/engine/GameEngine.ts`):
   - `main.ts` lines 141–158: Fixed timestep loop:
     ```ts
     const dt = Math.min((now - this.lastTime) / 1000, 0.1);
     this.lastTime = now;
     this.accumulator += dt;
     while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP) {
       this.step(GrimHarvestGame.FIXED_TIMESTEP);
       this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
     }
     this.render();
     ```
   - **Critical Vulnerability Identified**: If gameplay simulation is paused while the player deliberates on a level-up card (e.g. 5–10 seconds), unpausing without resetting `lastTime` will cause `(now - lastTime)` to hit the 0.1s clamp and fire multiple catch-up substeps or cause a jarring physics spike. Moreover, `this.elapsedTime` would incorrectly accumulate.

---

## 2. Logic Chain

### 2.1 Passives & Mathematical Stat Scaling
Each passive has 5 distinct ranks with linear additive deltas applied via `Player.applyStatDelta(stat, delta)`:

| Passive Name | Icon Key | Stat Affected | Delta Per Rank | Rank 1 (Base + $\Delta$) | Rank 5 Total Bonus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tome of Might** | `'tome'` | `might` | $+0.10$ ($+10\%$ damage) | $1.0 \to 1.10$ ($+10\%$) | $1.50$ ($+50\%$ damage) |
| **Ring of Velocity** | `'ring'` | `moveSpeed` | $+20.0$ ($+10\%$ base speed) | $200 \to 220$ ($+10\%$) | $300$ ($+50\%$ speed) |
| **Blood Chalice** | `'chalice'` | `maxHealth` & `healthRegen` | $+20$ Max HP & $+0.5$ HP/s | $+20$ HP, $+0.5$ HP/s | $+100$ Max HP, $+2.5$ HP/s |
| **Eldritch Magnet** | `'magnet'` | `magnetRadius` | $+22.5$ ($+25\%$ base radius) | $90 \to 112.5$ ($+25\%$) | $202.5$ ($+125\%$ radius) |
| **Obsidian Armor** | `'armor'` | `armor` | $+1.0$ (Flat damage reduction) | $0 \to 1$ armor | $5$ armor ($-5$ flat dmg) |

*Note on Blood Chalice*: Calling `player.applyStatDelta('maxHealth', 20)` in `Player.ts` automatically executes `this.heal(20)`, ensuring that gaining Max HP does not leave the newly added health bar segment empty.

### 2.2 Weapons & Rank Progression (Ranks 1 to 5)
Every weapon is designed to unlock at Rank 1 and scale through Rank 5:

1. **Arcane Scythe** (`'scythe'`):
   - *Rank 1*: Unlocks Arcane Scythe. Sweeps a $120^\circ$ spectral arc in front of the player (80px radius, 25 base damage, 1.2s cooldown).
   - *Rank 2*: $+20\%$ Damage (30 dmg) & $+15\%$ Cleave Radius (92px).
   - *Rank 3*: $-15\%$ Cooldown (1.02s) & $+1$ Max Piercing Target.
   - *Rank 4*: $+25\%$ Damage (37.5 dmg) & $+15\%$ Cleave Radius (106px).
   - *Rank 5*: Double Cleave Strike (forward slash followed by instant reverse back-slash) & $+20\%$ Damage (45 dmg).

2. **Soul Orbiters** (`'orbiters'`):
   - *Rank 1*: Unlocks Soul Orbiters. 2 spectral skull flames orbit the player at 65px radius (12 dmg per contact, 0.4s hit immunity cooldown per enemy).
   - *Rank 2*: $+1$ Orbiter (3 total) & $+10\%$ Orbit Velocity.
   - *Rank 3*: $+20\%$ Damage (14.4 dmg) & $+10$px Orbit Radius (75px).
   - *Rank 4*: $+1$ Orbiter (4 total) & $+15\%$ Orbit Velocity.
   - *Rank 5*: $+1$ Orbiter (5 total) & Skulls pulse necrotic radial burn waves every 2.0s.

3. **Abyssal Lightning** (`'lightning'`):
   - *Rank 1*: Unlocks Abyssal Lightning. Strikes 1 random enemy in 300px radius for 40 damage; chains to 1 nearby enemy within 100px for $50\%$ damage. Cooldown: 2.0s.
   - *Rank 2*: $+1$ Strike Target (2 random targets) & $-10\%$ Cooldown (1.8s).
   - *Rank 3*: $+1$ Chain Target per strike (chains to 2 enemies) & $+25\%$ Damage (50 dmg).
   - *Rank 4*: $+1$ Strike Target (3 random targets) & $-15\%$ Cooldown (1.53s).
   - *Rank 5*: Impact sites spawn necrotic ground shocks that damage passing enemies for 1.0s.

4. **Bone Spear** (`'spear'`):
   - *Rank 1*: Unlocks Bone Spear. Fires 1 piercing bone lance towards the nearest enemy (35 damage, pierces up to 3 enemies, 450 px/s velocity, 1.5s cooldown).
   - *Rank 2*: $+1$ Spear (fires 2 spears in slight spread) & $+10\%$ Velocity.
   - *Rank 3*: $+2$ Pierce Count (pierces up to 5 enemies) & $+20\%$ Damage (42 dmg).
   - *Rank 4*: $+1$ Spear (fires 3 spears) & $-15\%$ Cooldown (1.275s).
   - *Rank 5*: Spears shatter into 3 piercing bone fragments upon exhausting their pierce limit.

5. **Cursed Aura / Death Sigil** (`'aura'`):
   - *Rank 1*: Unlocks Cursed Aura. Emits a pulsing necrotic shockwave centered on the player every 1.5s (90px radius, 15 damage, moderate knockback).
   - *Rank 2*: $+20\%$ Aura Radius (108px) & $+20\%$ Damage (18 dmg).
   - *Rank 3*: $-20\%$ Pulse Interval (1.2s cadence) & $+25\%$ Knockback Force.
   - *Rank 4*: $+25\%$ Aura Radius (135px) & $+25\%$ Damage (22.5 dmg).
   - *Rank 5*: Cursed Vulnerability: enemies afflicted by the aura take $+20\%$ increased damage from all sources for 3.0s.

### 2.3 Synergistic Weapon Evolutions
When a weapon reaches **Rank 5** AND the player possesses the corresponding Passive (Rank $\ge 1$), an Evolution Card becomes available in the level-up pool. Choosing it upgrades the base weapon into its supreme form:

```
[Arcane Scythe (Rank 5)]     + [Blood Chalice (Rank >= 1)]   -->  Soul Reaping Harvester
[Soul Orbiters (Rank 5)]     + [Ring of Velocity (Rank >= 1)] -->  Abyssal Vortex
[Bone Spear (Rank 5)]        + [Tome of Might (Rank >= 1)]   -->  Ossuary Cataclysm
[Abyssal Lightning (Rank 5)] + [Eldritch Magnet (Rank >= 1)] -->  Storm of Torment
[Cursed Aura (Rank 5)]       + [Obsidian Armor (Rank >= 1)]  -->  Domain of Decay
```

Detailed Evolution Behaviors:
1. **Soul Reaping Harvester** (Scythe + Chalice):
   - 360-degree colossal crimson harvest (160px radius, 80 base damage, 1.0s cooldown).
   - Slain enemies have a **15% chance to drop Blood Shards** that heal the player for 2 HP on contact.
2. **Abyssal Vortex** (Orbiters + Velocity):
   - 8 accelerated spectral skulls create a permanent gravitational whirlpool.
   - Orbit velocity increased by $+100\%$, applying continuous micro-vacuum pulling enemies into the fire (35 dps).
3. **Ossuary Cataclysm** (Spear + Might):
   - Fires 4 ancient colossus dragon lances with **infinite penetration**.
   - Pierces the entire screen; leaves behind bone fissures that erupt for 75 AoE damage after 0.5s.
4. **Storm of Torment** (Lightning + Magnet):
   - Continuous tempest striking 6 simultaneous targets every 0.8s.
   - $100\%$ chain necrosis across all enemies within 120px; automatically pulls all dropped XP shards to the strike epicenter.
5. **Domain of Decay** (Aura + Armor):
   - Permanent 160px blight zone dealing continuous damage every 0.25s (60 total dps).
   - Slows enemy movement by $40\%$; reduces all incoming damage to the player by an additional flat $25\%$.

### 2.4 Card Selection Algorithm & Inventory Constraints
1. **Inventory Slot Quotas**:
   - Max Weapon Slots: 6
   - Max Passive Slots: 6
2. **Candidate Classification**:
   - **Evolution Candidates**: For each active weapon at Rank 5, if not already evolved, and the player owns the required passive, generate an Evolution Card.
   - **Active Upgrades**: For any owned weapon or passive at $\text{Rank} < 5$, generate a Rank-Up Card ($\text{Rank} + 1$).
   - **New Weapon Unlocks**: If active weapon count $< 6$, all unowned weapons are eligible at Rank 1.
   - **New Passive Unlocks**: If active passive count $< 6$, all unowned passives are eligible at Rank 1.
   - **Maxed Items**: Any item at Rank 5 (or already evolved) is permanently filtered out of the pool.
3. **Card Generation Math**:
   - Standard card count: 3 cards (increased to 4 if player Luck $\ge 1.5$ or via a $25\%$ lucky roll).
   - If total eligible candidate count $\le \text{targetCount}$, return all available candidates.
   - If eligible candidate count $> \text{targetCount}$, sample without replacement using weighted probabilities:
     - Evolution Cards: **Weight 3.5** (High priority reward)
     - Rank-Up for existing items: **Weight 2.0** (Build focus)
     - New item unlocks: **Weight 1.0**
   - **Fallback Condition**: If all 6 weapons and all 6 passives are maxed out (0 eligible candidates), supply `"Necrotic Feast"`: restores 30 HP and awards $+100$ score/XP.

### 2.5 Gothic Level-Up Modal (`UpgradeModal.ts`) Architecture
1. **Rendering Mode**:
   - 100% Canvas-rendered on virtual resolution ($960 \times 540$).
   - Matches `GothicHUD` and `DarkFantasySprites` pixel-for-pixel, eliminating DOM/CSS scale mismatch in fullscreen or letterboxed viewports.
2. **Visual Layout Math ($960 \times 540$)**:
   - Scrim: `rgba(8, 6, 12, 0.88)` with radial glow centered at $(480, 270)$.
   - Title: `"CHOOSE THY OCCULT BOON"` in `GOTHIC_HUD_THEME.fontGothic` ($24\text{px}$ Cinzel/Georgia), gold filigree fill with deep drop shadow.
   - Card Geometry (3 Cards):
     - Width: $210\text{px}$, Height: $330\text{px}$, Spacing: $28\text{px}$, $Y = 110\text{px}$.
     - Left margin: $X_0 = (960 - (3 \times 210 + 2 \times 28)) / 2 = 137\text{px}$.
     - Card 0: $X = 137$, Card 1: $X = 375$, Card 2: $X = 613$.
   - Card Anatomy:
     - Outer: Iron-beveled border (`#2d2b38`) with corner brackets.
     - On Hover/Select: 2px glowing border in `goldFiligree` (`#d4af37`) with 14px shadow blur.
     - Top Badges: Keybind pill `[1]`, `[2]`, `[3]` (top-left); Type tag `"WEAPON"`, `"PASSIVE"`, `"EVOLUTION"` (top-right).
     - Center Well ($52 \times 52\text{px}$): Circular metallic well displaying the procedural icon.
     - Title & Subtitle: Item name in `boneIvory` + Subtitle (e.g. `"Rank II \u2192 Rank III"`).
     - Rank Pips: 5 stone pips. Filled = `necroticGlow`, New = pulsing bright gold, Empty = `boneDark`.
     - Description: 2–3 lines of flavor and mechanics text in `boneMuted`.
     - Stat Deltas Box: Dark inset box highlighting exact numeric gains in `necroticSpark` (`#a7f3d0`).
     - Footer Button: `[ CLAIM BOON ]` / `[ Press 1 ]`.
3. **Input Handling**:
   - Keyboard: Keys `'1'`, `'2'`, `'3'`, `'4'` directly trigger selection of cards at index 0..3. Arrow keys (`ArrowLeft`, `ArrowRight`) move highlight, `Enter`/`Space` confirms.
   - Mouse: Mouse coordinate scaling from canvas bounding client rect:
     $$\text{canvasX} = (e.\text{clientX} - \text{rect.left}) \times \frac{960}{\text{rect.width}}, \quad \text{canvasY} = (e.\text{clientY} - \text{rect.top}) \times \frac{540}{\text{rect.height}}$$
     Hovering card updates `hoveredIndex`; clicking claims the boon immediately.

### 2.6 Robust Pause / Resume Protocol (Zero Frame Spike)
To prevent the delta spike bug when unpausing after a lengthy modal deliberation:
1. When level-up fires:
   - Increment `pendingLevelUps++`.
   - Set `isModalOpen = true`.
   - Freeze physics simulation: bypass `hordeManager.update`, `player.handleInput`, `lootManager.update`, and `elapsedTime += dt`.
   - Continue rendering: update modal animations (rank pip pulses, hover highlights) and render game state + modal overlay at 60fps.
2. When player selects a card:
   - Apply card to `UpgradeSystem` (updating stats or weapon ranks).
   - Decrement `pendingLevelUps--`.
   - If `pendingLevelUps > 0`: immediately regenerate card options and keep modal open (multi-level burst support).
   - If `pendingLevelUps === 0`:
     - Set `isModalOpen = false`.
     - **Timing Reset**:
       ```ts
       this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
       this.accumulator = 0;
       ```
       This eliminates any accumulated delta or large `(now - lastTime)` jumps, resuming the simulation smoothly.

---

## 3. Caveats

1. **WeaponManager Decoupling**:
   - Explorer 1 is designing the base `Weapon` classes and `WeaponManager`.
   - To ensure zero circular dependency, `UpgradeSystem` should define clean data interfaces (`UpgradeCard`, `InventorySlotData`) and expose `applyUpgrade(card, player, weaponManager)`. If `weaponManager` is present, it calls `weaponManager.upgradeWeapon(card.itemId, card.newRank)` or `weaponManager.evolveWeapon(card.itemId)`.
2. **Canvas DPI & Letterboxing**:
   - The game operates on a fixed virtual resolution of $960 \times 540$. When converting mouse coordinates, `canvas.getBoundingClientRect()` must be used to scale mouse positions properly, regardless of CSS display size or window resizing.
3. **Evolution Reversibility**:
   - Evolutions permanently replace the base weapon in the weapon slot. Once evolved, the base weapon cannot be rolled again.

---

## 4. Conclusion & Concrete Blueprints

### 4.1 File Structure Blueprint
The Worker should create the following files:
1. `src/core/systems/UpgradeSystem.ts` — Inventory state, passive scaling, evolution definitions, and card generator algorithm.
2. `src/ui/UpgradeModal.ts` — Canvas-rendered gothic modal, hover hit-testing, keyboard/mouse input, and rank pip animation.

### 4.2 Blueprint for `src/core/systems/UpgradeSystem.ts`

```typescript
/**
 * UpgradeSystem.ts - Occult Arsenal Upgrades, Passives & Synergies.
 *
 * Requirements:
 * - 5 Weapons with Ranks 1-5.
 * - 5 Passives with Ranks 1-5 (Might, Velocity, Chalice, Magnet, Armor).
 * - 5 Weapon Evolutions (Weapon Rank 5 + Passive Owned).
 * - Inventory limits: Max 6 weapons, 6 passives.
 * - Weighted random card generator (never offers maxed items).
 */

import { Player } from '../entities/Player';
import { PlayerStats } from '../player/PlayerStats';
import { InventorySlotData } from '../../ui/GothicHUD';

export type UpgradeCategory = 'weapon' | 'passive' | 'evolution' | 'fallback';

export interface UpgradeCard {
  id: string;
  itemId: string;
  name: string;
  subtitle: string;
  category: UpgradeCategory;
  icon: string;
  previousRank: number;
  newRank: number;
  maxRank: number;
  description: string;
  statChangeDescription: string;
  isEvolution: boolean;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  rankDescriptions: string[];
  statDeltas: string[];
}

export interface PassiveDefinition {
  id: string;
  name: string;
  icon: string;
  stat: keyof PlayerStats;
  deltaPerRank: number;
  secondaryStat?: keyof PlayerStats;
  secondaryDeltaPerRank?: number;
  rankDescriptions: string[];
  statDeltas: string[];
}

export interface EvolutionDefinition {
  id: string;
  name: string;
  weaponId: string;
  passiveId: string;
  icon: string;
  description: string;
  statChangeDescription: string;
}

// 1. Definition Data
export const OCCULT_PASSIVES: Record<string, PassiveDefinition> = {
  passive_might: {
    id: 'passive_might',
    name: 'Tome of Might',
    icon: 'tome',
    stat: 'might',
    deltaPerRank: 0.10, // +10% damage
    rankDescriptions: [
      'Inscribes forbidden runes of ruin, amplifying occult power.',
      '+10% Damage to all weapons.',
      '+10% Damage (Total +20%).',
      '+10% Damage (Total +30%).',
      '+10% Damage (Total +40%).',
      '+10% Damage (Total +50% Maximum Might).',
    ],
    statDeltas: ['+10% Damage', '+10% Damage', '+10% Damage', '+10% Damage', '+10% Damage'],
  },
  passive_velocity: {
    id: 'passive_velocity',
    name: 'Ring of Velocity',
    icon: 'ring',
    stat: 'moveSpeed',
    deltaPerRank: 20.0, // +10% base speed (base 200)
    rankDescriptions: [
      'An obsidian band imbued with phantom wind.',
      '+10% Movement Speed.',
      '+10% Movement Speed (Total +20%).',
      '+10% Movement Speed (Total +30%).',
      '+10% Movement Speed (Total +40%).',
      '+10% Movement Speed (Total +50% Maximum Velocity).',
    ],
    statDeltas: ['+20 Move Speed', '+20 Move Speed', '+20 Move Speed', '+20 Move Speed', '+20 Move Speed'],
  },
  passive_chalice: {
    id: 'passive_chalice',
    name: 'Blood Chalice',
    icon: 'chalice',
    stat: 'maxHealth',
    deltaPerRank: 20,
    secondaryStat: 'healthRegen',
    secondaryDeltaPerRank: 0.5,
    rankDescriptions: [
      'An unholy reliquary of immortal blood.',
      '+20 Max HP & +0.5 HP/s Regeneration.',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +40 HP, +1.0/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +60 HP, +1.5/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +80 HP, +2.0/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +100 HP, +2.5/s).',
    ],
    statDeltas: [
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
    ],
  },
  passive_magnet: {
    id: 'passive_magnet',
    name: 'Eldritch Magnet',
    icon: 'magnet',
    stat: 'magnetRadius',
    deltaPerRank: 22.5, // +25% of base 90
    rankDescriptions: [
      'Attunes the soul to draw nearby spiritual essence.',
      '+25% Soul Magnet Radius.',
      '+25% Soul Magnet Radius (Total +50%).',
      '+25% Soul Magnet Radius (Total +75%).',
      '+25% Soul Magnet Radius (Total +100%).',
      '+25% Soul Magnet Radius (Total +125% Maximum Range).',
    ],
    statDeltas: ['+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius'],
  },
  passive_armor: {
    id: 'passive_armor',
    name: 'Obsidian Armor',
    icon: 'armor',
    stat: 'armor',
    deltaPerRank: 1.0,
    rankDescriptions: [
      'Forged in volcanic depths to deflect mortal and undead blows.',
      '+1 Armor (Flat Damage Reduction).',
      '+1 Armor (Total 2 Damage Reduction).',
      '+1 Armor (Total 3 Damage Reduction).',
      '+1 Armor (Total 4 Damage Reduction).',
      '+1 Armor (Total 5 Maximum Damage Reduction).',
    ],
    statDeltas: ['+1 Armor', '+1 Armor', '+1 Armor', '+1 Armor', '+1 Armor'],
  },
};

export const OCCULT_WEAPONS: Record<string, WeaponDefinition> = {
  weapon_scythe: {
    id: 'weapon_scythe',
    name: 'Arcane Scythe',
    icon: 'scythe',
    description: 'Sweeping spectral blade cleaving arcs through forward enemy swarms.',
    rankDescriptions: [
      'Cleaves an arc cutting through forward enemy clusters.',
      '+20% Damage & +15% Cleave Range.',
      '-15% Cooldown & +1 Max Cleave Targets.',
      '+25% Damage & +15% Cleave Range.',
      'Double Cleave Strike (instant reverse back-slash) & +20% Damage.',
    ],
    statDeltas: ['Base Cleave: 25 Dmg', '+20% Dmg, +15% Range', '-15% Cooldown, +1 Target', '+25% Dmg, +15% Range', 'Double Cleave, +20% Dmg'],
  },
  weapon_orbiters: {
    id: 'weapon_orbiters',
    name: 'Soul Orbiters',
    icon: 'orbiters',
    description: 'Orbiting skull flames that incinerate encroaching undead on contact.',
    rankDescriptions: [
      '2 spectral skulls orbit the sorcerer, burning enemies on contact.',
      '+1 Skull (3 total) & +10% Orbit Velocity.',
      '+20% Damage & +10px Orbit Radius.',
      '+1 Skull (4 total) & +15% Orbit Velocity.',
      '+1 Skull (5 total) & Skulls pulse radial necrotic flares every 2s.',
    ],
    statDeltas: ['2 Skulls, 12 Dmg', '+1 Skull, +10% Speed', '+20% Dmg, +10px Radius', '+1 Skull, +15% Speed', '+1 Skull, Radial Flares'],
  },
  weapon_lightning: {
    id: 'weapon_lightning',
    name: 'Abyssal Lightning',
    icon: 'lightning',
    description: 'Strikes random dense enemy clusters with chaining electrical necrosis.',
    rankDescriptions: [
      'Strikes a random foe in range, chaining necrotic bolts to adjacent enemies.',
      '+1 Strike Target & -10% Cooldown.',
      '+1 Chain Jump per strike & +25% Damage.',
      '+1 Strike Target & -15% Cooldown.',
      'Impacts leave lingering electrified ground zones for 1s.',
    ],
    statDeltas: ['1 Target, 40 Dmg', '+1 Target, -10% Cooldown', '+1 Chain, +25% Dmg', '+1 Target, -15% Cooldown', 'Ground Shockpools'],
  },
  weapon_spear: {
    id: 'weapon_spear',
    name: 'Bone Spear',
    icon: 'spear',
    description: 'High-velocity piercing projectiles penetrating multiple undead in a line.',
    rankDescriptions: [
      'Hurls a piercing lance through up to 3 enemies in a straight line.',
      '+1 Spear (fires 2 spears in spread) & +10% Velocity.',
      '+2 Pierce Count (pierces up to 5 enemies) & +20% Damage.',
      '+1 Spear (fires 3 spears) & -15% Cooldown.',
      'Spears shatter into 3 piercing bone shards upon exhausting pierce.',
    ],
    statDeltas: ['35 Dmg, Pierce 3', '+1 Spear, +10% Speed', '+2 Pierce, +20% Dmg', '+1 Spear, -15% Cooldown', 'Shattering Shards'],
  },
  weapon_aura: {
    id: 'weapon_aura',
    name: 'Cursed Aura',
    icon: 'aura',
    description: 'Periodic pulsating damage ring centered on the player with knockback.',
    rankDescriptions: [
      'Emits a periodic shockwave of dark energy repelling nearby foes.',
      '+20% Aura Radius & +20% Damage.',
      '-20% Pulse Cadence & +25% Knockback Force.',
      '+25% Aura Radius & +25% Damage.',
      'Cursed Vulnerability: damaged enemies suffer +20% damage from all weapons for 3s.',
    ],
    statDeltas: ['15 Dmg, 90px Radius', '+20% Radius, +20% Dmg', '-20% Cadence, +25% Knockback', '+25% Radius, +25% Dmg', 'Cursed Vulnerability (+20%)'],
  },
};

export const OCCULT_EVOLUTIONS: Record<string, EvolutionDefinition> = {
  evolution_harvester: {
    id: 'evolution_harvester',
    name: 'Soul Reaping Harvester',
    weaponId: 'weapon_scythe',
    passiveId: 'passive_chalice',
    icon: 'scythe',
    description: 'Colossal 360-degree crimson sweep. Slain foes have a 15% chance to drop Blood Shards that heal 2 HP.',
    statChangeDescription: '360° Harvest • 80 Damage • 15% Life Shard Drop',
  },
  evolution_vortex: {
    id: 'evolution_vortex',
    name: 'Abyssal Vortex',
    weaponId: 'weapon_orbiters',
    passiveId: 'passive_velocity',
    icon: 'orbiters',
    description: '8 accelerated skulls form a gravitational whirlpool pulling enemies into crushing void flames.',
    statChangeDescription: '8 Orbiting Skulls • +100% Speed • Micro-Vacuum Pull',
  },
  evolution_cataclysm: {
    id: 'evolution_cataclysm',
    name: 'Ossuary Cataclysm',
    weaponId: 'weapon_spear',
    passiveId: 'passive_might',
    icon: 'spear',
    description: 'Fires 4 ancient dragon lances with infinite screen-wide pierce that erupt in 75 AoE bone cataclysms.',
    statChangeDescription: '4 Colossus Lances • Infinite Pierce • 75 AoE Eruptions',
  },
  evolution_torment: {
    id: 'evolution_torment',
    name: 'Storm of Torment',
    weaponId: 'weapon_lightning',
    passiveId: 'passive_magnet',
    icon: 'lightning',
    description: 'Continuous necrotic tempest strikes 6 targets every 0.8s, electrocuting swarms and drawing soul gems to impact.',
    statChangeDescription: '6 Simultaneous Strikes • 0.8s Rate • Gem Attraction',
  },
  evolution_decay: {
    id: 'evolution_decay',
    name: 'Domain of Decay',
    weaponId: 'weapon_aura',
    passiveId: 'passive_armor',
    icon: 'aura',
    description: 'Permanent 160px death blight dealing continuous ticks, slowing foes by 40%, and absorbing 25% incoming damage.',
    statChangeDescription: 'Permanent Blight Field • 40% Enemy Slow • +25% Damage Absorb',
  },
};

export class UpgradeSystem {
  public static readonly MAX_WEAPON_SLOTS = 6;
  public static readonly MAX_PASSIVE_SLOTS = 6;

  private weapons: Map<string, { rank: number; isEvolution: boolean }> = new Map();
  private passives: Map<string, { rank: number }> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.weapons.clear();
    this.passives.clear();
  }

  public getWeaponRank(weaponId: string): number {
    return this.weapons.get(weaponId)?.rank ?? 0;
  }

  public getPassiveRank(passiveId: string): number {
    return this.passives.get(passiveId)?.rank ?? 0;
  }

  public isWeaponEvolved(weaponId: string): boolean {
    return this.weapons.get(weaponId)?.isEvolution ?? false;
  }

  public getWeaponsInventory(): InventorySlotData[] {
    const list: InventorySlotData[] = [];
    for (const [id, data] of this.weapons.entries()) {
      const def = OCCULT_WEAPONS[id];
      if (def) {
        list.push({
          id,
          name: def.name,
          icon: def.icon,
          rank: data.rank,
          maxRank: 5,
          isEvolution: data.isEvolution,
        });
      }
    }
    return list;
  }

  public getPassivesInventory(): InventorySlotData[] {
    const list: InventorySlotData[] = [];
    for (const [id, data] of this.passives.entries()) {
      const def = OCCULT_PASSIVES[id];
      if (def) {
        list.push({
          id,
          name: def.name,
          icon: def.icon,
          rank: data.rank,
          maxRank: 5,
        });
      }
    }
    return list;
  }

  /**
   * Generates 3 to 4 distinct valid upgrade cards on level up.
   */
  public generateUpgradeCards(count: number = 3): UpgradeCard[] {
    const candidates: UpgradeCard[] = [];

    // 1. Check for Eligible Evolutions
    for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
      const weaponState = this.weapons.get(evo.weaponId);
      const passiveRank = this.getPassiveRank(evo.passiveId);

      if (weaponState && weaponState.rank >= 5 && !weaponState.isEvolution && passiveRank >= 1) {
        candidates.push({
          id: evo.id,
          itemId: evo.id,
          name: evo.name,
          subtitle: '★ SUPREME EVOLUTION ★',
          category: 'evolution',
          icon: evo.icon,
          previousRank: 5,
          newRank: 5,
          maxRank: 5,
          description: evo.description,
          statChangeDescription: evo.statChangeDescription,
          isEvolution: true,
        });
      }
    }

    // 2. Check for Weapon Upgrades or New Unlocks
    const canAddWeapon = this.weapons.size < UpgradeSystem.MAX_WEAPON_SLOTS;
    for (const weapon of Object.values(OCCULT_WEAPONS)) {
      const rank = this.getWeaponRank(weapon.id);
      const isEvolved = this.isWeaponEvolved(weapon.id);

      if (isEvolved) continue;

      if (rank > 0 && rank < 5) {
        candidates.push({
          id: `${weapon.id}_rank_${rank + 1}`,
          itemId: weapon.id,
          name: weapon.name,
          subtitle: `Rank ${rank} → Rank ${rank + 1}`,
          category: 'weapon',
          icon: weapon.icon,
          previousRank: rank,
          newRank: rank + 1,
          maxRank: 5,
          description: weapon.rankDescriptions[rank],
          statChangeDescription: weapon.statDeltas[rank],
          isEvolution: false,
        });
      } else if (rank === 0 && canAddWeapon) {
        candidates.push({
          id: `${weapon.id}_unlock`,
          itemId: weapon.id,
          name: weapon.name,
          subtitle: 'NEW WEAPON',
          category: 'weapon',
          icon: weapon.icon,
          previousRank: 0,
          newRank: 1,
          maxRank: 5,
          description: weapon.rankDescriptions[0],
          statChangeDescription: weapon.statDeltas[0],
          isEvolution: false,
        });
      }
    }

    // 3. Check for Passive Upgrades or New Unlocks
    const canAddPassive = this.passives.size < UpgradeSystem.MAX_PASSIVE_SLOTS;
    for (const passive of Object.values(OCCULT_PASSIVES)) {
      const rank = this.getPassiveRank(passive.id);

      if (rank > 0 && rank < 5) {
        candidates.push({
          id: `${passive.id}_rank_${rank + 1}`,
          itemId: passive.id,
          name: passive.name,
          subtitle: `Rank ${rank} → Rank ${rank + 1}`,
          category: 'passive',
          icon: passive.icon,
          previousRank: rank,
          newRank: rank + 1,
          maxRank: 5,
          description: passive.rankDescriptions[rank],
          statChangeDescription: passive.statDeltas[rank],
          isEvolution: false,
        });
      } else if (rank === 0 && canAddPassive) {
        candidates.push({
          id: `${passive.id}_unlock`,
          itemId: passive.id,
          name: passive.name,
          subtitle: 'NEW PASSIVE',
          category: 'passive',
          icon: passive.icon,
          previousRank: 0,
          newRank: 1,
          maxRank: 5,
          description: passive.rankDescriptions[0],
          statChangeDescription: passive.statDeltas[0],
          isEvolution: false,
        });
      }
    }

    // 4. Edge Case: No valid upgrades left
    if (candidates.length === 0) {
      return [{
        id: 'fallback_feast',
        itemId: 'fallback_feast',
        name: 'Necrotic Feast',
        subtitle: 'SOUL RESTORATION',
        category: 'fallback',
        icon: 'chalice',
        previousRank: 0,
        newRank: 1,
        maxRank: 1,
        description: 'Absorbs residual soul essence, healing wounds and restoring vitality.',
        statChangeDescription: '+30 HP Healed • +100 Score',
        isEvolution: false,
      }];
    }

    // 5. Weighted Sampling without Replacement
    return this.sampleWeightedCards(candidates, count);
  }

  private sampleWeightedCards(candidates: UpgradeCard[], count: number): UpgradeCard[] {
    const k = Math.min(count, candidates.length);
    const pool = [...candidates];
    const selected: UpgradeCard[] = [];

    while (selected.length < k && pool.length > 0) {
      const weights = pool.map((c) => {
        if (c.category === 'evolution') return 3.5;
        if (c.previousRank > 0) return 2.0;
        return 1.0;
      });

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let chosenIndex = 0;

      for (let i = 0; i < pool.length; i++) {
        rand -= weights[i];
        if (rand <= 0) {
          chosenIndex = i;
          break;
        }
      }

      selected.push(pool[chosenIndex]);
      pool.splice(chosenIndex, 1);
    }

    return selected;
  }

  /**
   * Applies the selected upgrade card to the player and inventory state.
   */
  public applyUpgrade(card: UpgradeCard, player: Player, weaponManager?: any): void {
    if (card.category === 'fallback') {
      player.heal(30);
      return;
    }

    if (card.category === 'passive') {
      const def = OCCULT_PASSIVES[card.itemId];
      if (def) {
        this.passives.set(card.itemId, { rank: card.newRank });
        player.applyStatDelta(def.stat, def.deltaPerRank);
        if (def.secondaryStat && def.secondaryDeltaPerRank) {
          player.applyStatDelta(def.secondaryStat, def.secondaryDeltaPerRank);
        }
      }
      return;
    }

    if (card.category === 'weapon') {
      this.weapons.set(card.itemId, { rank: card.newRank, isEvolution: false });
      weaponManager?.setWeaponRank?.(card.itemId, card.newRank);
      return;
    }

    if (card.category === 'evolution') {
      const evo = OCCULT_EVOLUTIONS[card.itemId];
      if (evo) {
        this.weapons.set(evo.weaponId, { rank: 5, isEvolution: true });
        weaponManager?.evolveWeapon?.(evo.weaponId, evo.id);
      }
    }
  }
}
```

---

### 4.3 Blueprint for `src/ui/UpgradeModal.ts`

```typescript
/**
 * UpgradeModal.ts - Ornate Gothic Level-Up Card Selection Modal.
 *
 * Capabilities:
 * - 100% Canvas-rendered on 960x540 virtual canvas context.
 * - Cracked obsidian stone cards, gold filigree highlights, animated rank pips.
 * - Mouse hover detection, cursor changes, and click confirmation.
 * - Keyboard selection via [1], [2], [3], [4], arrow navigation, and [Enter].
 * - Clean pause/resume lifecycle with zero accumulator delta spikes.
 */

import { GOTHIC_HUD_THEME } from './GothicHUD';
import { UpgradeCard } from '../core/systems/UpgradeSystem';

export interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class UpgradeModal {
  private cards: UpgradeCard[] = [];
  private level: number = 1;
  private isOpen: boolean = false;

  public hoveredIndex: number | null = null;
  public selectedIndex: number = 0;
  public onSelect?: (card: UpgradeCard) => void;

  private pulseTimer: number = 0;
  private cardBounds: CardBounds[] = [];

  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnClick: (e: MouseEvent) => void;
  private targetCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.boundOnKeyDown = this.handleKeyDown.bind(this);
    this.boundOnMouseMove = this.handleMouseMove.bind(this);
    this.boundOnClick = this.handleClick.bind(this);
  }

  public open(cards: UpgradeCard[], level: number, canvas?: HTMLCanvasElement): void {
    this.cards = cards;
    this.level = level;
    this.isOpen = true;
    this.hoveredIndex = null;
    this.selectedIndex = 0;
    this.pulseTimer = 0;

    if (canvas) {
      this.targetCanvas = canvas;
      canvas.addEventListener('mousemove', this.boundOnMouseMove);
      canvas.addEventListener('click', this.boundOnClick);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public close(): void {
    this.isOpen = false;
    if (this.targetCanvas) {
      this.targetCanvas.removeEventListener('mousemove', this.boundOnMouseMove);
      this.targetCanvas.removeEventListener('click', this.boundOnClick);
      this.targetCanvas.style.cursor = 'default';
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundOnKeyDown);
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public update(dt: number): void {
    if (!this.isOpen) return;
    this.pulseTimer += dt;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (e.code === 'Digit1' || e.key === '1') {
      this.confirmSelection(0);
    } else if (e.code === 'Digit2' || e.key === '2') {
      this.confirmSelection(1);
    } else if (e.code === 'Digit3' || e.key === '3') {
      this.confirmSelection(2);
    } else if (e.code === 'Digit4' || e.key === '4') {
      this.confirmSelection(3);
    } else if (e.code === 'ArrowLeft') {
      this.selectedIndex = (this.selectedIndex - 1 + this.cards.length) % this.cards.length;
      this.hoveredIndex = this.selectedIndex;
    } else if (e.code === 'ArrowRight') {
      this.selectedIndex = (this.selectedIndex + 1) % this.cards.length;
      this.hoveredIndex = this.selectedIndex;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      this.confirmSelection(this.hoveredIndex ?? this.selectedIndex);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isOpen || !this.targetCanvas) return;
    const rect = this.targetCanvas.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 540 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let hit: number | null = null;
    for (let i = 0; i < this.cardBounds.length; i++) {
      const b = this.cardBounds[i];
      if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
        hit = i;
        break;
      }
    }

    this.hoveredIndex = hit;
    if (hit !== null) {
      this.selectedIndex = hit;
      this.targetCanvas.style.cursor = 'pointer';
    } else {
      this.targetCanvas.style.cursor = 'default';
    }
  }

  private handleClick(_e: MouseEvent): void {
    if (!this.isOpen) return;
    if (this.hoveredIndex !== null) {
      this.confirmSelection(this.hoveredIndex);
    }
  }

  private confirmSelection(index: number): void {
    if (index >= 0 && index < this.cards.length) {
      const chosen = this.cards[index];
      this.onSelect?.(chosen);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number = 960, height: number = 540): void {
    if (!this.isOpen) return;

    ctx.save();

    // 1. Dark Vignetted Scrim
    ctx.fillStyle = 'rgba(8, 6, 12, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // Subtle center glow
    const radial = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 450);
    radial.addColorStop(0, 'rgba(23, 19, 38, 0.4)');
    radial.addColorStop(1, 'rgba(5, 3, 8, 0.9)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // 2. Gothic Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = GOTHIC_HUD_THEME.fontGothic;

    // Header Drop Shadow
    ctx.fillStyle = '#000000';
    ctx.fillText('SELECT THY OCCULT BOON', width / 2 + 2, 52);
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText('SELECT THY OCCULT BOON', width / 2, 50);

    // Subtitle
    ctx.font = "italic 13px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(`Soul Level ${this.level} Ascended — Claim a Relic of Ruin`, width / 2, 74);

    // 3. Calculate Card Dimensions
    const n = this.cards.length;
    const cardW = n <= 3 ? 210 : 184;
    const cardH = 330;
    const cardY = 105;
    const gap = n <= 3 ? 28 : 16;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (width - totalW) / 2;

    this.cardBounds = [];

    // 4. Render Each Card
    for (let i = 0; i < n; i++) {
      const card = this.cards[i];
      const cardX = startX + i * (cardW + gap);
      this.cardBounds.push({ x: cardX, y: cardY, width: cardW, height: cardH });

      const isHovered = this.hoveredIndex === i || this.selectedIndex === i;
      this.renderCard(ctx, cardX, cardY, cardW, cardH, card, i, isHovered);
    }

    // 5. Footer Instructions
    ctx.font = "12px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText('Press [1] - [3] or Click to Claim • [←] [→] to Navigate • [Enter] to Confirm', width / 2, 475);

    ctx.restore();
  }

  private renderCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    card: UpgradeCard,
    index: number,
    isHovered: boolean
  ): void {
    ctx.save();

    // Card Hover Lift & Glow
    const drawY = isHovered ? y - 4 : y;

    // Inset Stone Background
    const grad = ctx.createLinearGradient(x, drawY, x, drawY + h);
    grad.addColorStop(0, '#151122');
    grad.addColorStop(1, '#0b0813');
    ctx.fillStyle = grad;
    ctx.fillRect(x, drawY, w, h);

    // Border Frame
    if (isHovered) {
      ctx.strokeStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticGlow;
      ctx.lineWidth = 2;
      ctx.shadowColor = card.isEvolution ? 'rgba(212, 175, 55, 0.7)' : 'rgba(40, 167, 69, 0.6)';
      ctx.shadowBlur = 12;
    } else {
      ctx.strokeStyle = card.isEvolution ? GOTHIC_HUD_THEME.bloodMid : GOTHIC_HUD_THEME.obsidianBorder;
      ctx.lineWidth = 1.5;
    }
    ctx.strokeRect(x + 0.5, drawY + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // Corner Brackets
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.ironRivet;
    const bs = 5;
    ctx.fillRect(x, drawY, bs, bs);
    ctx.fillRect(x + w - bs, drawY, bs, bs);
    ctx.fillRect(x, drawY + h - bs, bs, bs);
    ctx.fillRect(x + w - bs, drawY + h - bs, bs, bs);

    // Top Keybind Pill [1..4]
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 8, drawY + 8, 24, 18);
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 8.5, drawY + 8.5, 23, 17);

    ctx.textAlign = 'center';
    ctx.font = "bold 11px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
    ctx.fillText(`${index + 1}`, x + 20, drawY + 18);

    // Type Tag (top right)
    ctx.textAlign = 'right';
    ctx.font = "bold 10px 'Georgia', serif";
    if (card.category === 'evolution') {
      ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
      ctx.fillText('EVOLUTION', x + w - 10, drawY + 20);
    } else if (card.category === 'weapon') {
      ctx.fillStyle = GOTHIC_HUD_THEME.arcaneGlow;
      ctx.fillText('WEAPON', x + w - 10, drawY + 20);
    } else {
      ctx.fillStyle = GOTHIC_HUD_THEME.necroticGlow;
      ctx.fillText('PASSIVE', x + w - 10, drawY + 20);
    }

    // Icon Circle Well
    const iconCx = x + w / 2;
    const iconCy = drawY + 68;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 24, 0, Math.PI * 2);
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fill();
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Procedural Icon Render
    this.drawIcon(ctx, iconCx, iconCy, card.icon, card.isEvolution);

    // Item Title
    ctx.textAlign = 'center';
    ctx.font = "bold 14px 'Cinzel', 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
    ctx.fillText(card.name, iconCx, drawY + 112);

    // Subtitle
    ctx.font = "italic 11px 'Georgia', serif";
    ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(card.subtitle, iconCx, drawY + 128);

    // Rank Pips
    const pipW = 14;
    const pipH = 5;
    const pipGap = 4;
    const totalPipW = 5 * pipW + 4 * pipGap;
    const startPipX = iconCx - totalPipW / 2;
    const pipY = drawY + 140;

    for (let p = 0; p < 5; p++) {
      const px = startPipX + p * (pipW + pipGap);
      if (p < card.previousRank) {
        ctx.fillStyle = card.isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticGlow;
      } else if (p < card.newRank) {
        // Newly gained rank pip pulses with golden shine
        const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer * 8);
        ctx.fillStyle = pulse > 0.5 ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.necroticSpark;
      } else {
        ctx.fillStyle = GOTHIC_HUD_THEME.boneDark;
      }
      ctx.fillRect(px, pipY, pipW, pipH);
    }

    // Divider
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 16, drawY + 158);
    ctx.lineTo(x + w - 16, drawY + 158);
    ctx.stroke();

    // Description (multi-line wrap)
    ctx.textAlign = 'center';
    ctx.font = "11px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.boneMuted;
    this.wrapText(ctx, card.description, iconCx, drawY + 178, w - 24, 15);

    // Stat Deltas Box
    const statBoxY = drawY + 236;
    ctx.fillStyle = GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 10, statBoxY, w - 20, 42);
    ctx.strokeStyle = GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 10.5, statBoxY + 0.5, w - 21, 41);

    ctx.font = "bold 10px 'Georgia', serif";
    ctx.fillStyle = GOTHIC_HUD_THEME.necroticSpark;
    ctx.fillText(card.statChangeDescription, iconCx, statBoxY + 24);

    // Bottom Claim Button
    const btnY = drawY + 292;
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.bloodBase : GOTHIC_HUD_THEME.obsidianInset;
    ctx.fillRect(x + 14, btnY, w - 28, 26);
    ctx.strokeStyle = isHovered ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.obsidianBorder;
    ctx.strokeRect(x + 14.5, btnY + 0.5, w - 29, 25);

    ctx.font = "bold 11px 'Georgia', serif";
    ctx.fillStyle = isHovered ? GOTHIC_HUD_THEME.boneIvory : GOTHIC_HUD_THEME.boneMuted;
    ctx.fillText(isHovered ? 'CLAIM BOON' : `Press [${index + 1}]`, iconCx, btnY + 15);

    ctx.restore();
  }

  private drawIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, icon: string, isEvolution: boolean): void {
    ctx.save();
    const glow = isEvolution ? GOTHIC_HUD_THEME.goldFiligree : GOTHIC_HUD_THEME.arcaneGlow;

    switch (icon) {
      case 'scythe':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, -Math.PI * 0.3, Math.PI * 0.7);
        ctx.stroke();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 6);
        ctx.lineTo(cx + 8, cy + 8);
        ctx.stroke();
        break;

      case 'orbiters':
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 5, 4, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'lightning':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 12);
        ctx.lineTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx - 3, cy + 12);
        ctx.stroke();
        break;

      case 'spear':
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx - 5, cy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = GOTHIC_HUD_THEME.boneDark;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + 12);
        ctx.stroke();
        break;

      case 'aura':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'tome':
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBase;
        ctx.fillRect(cx - 8, cy - 10, 16, 20);
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.fillRect(cx - 2, cy - 4, 4, 8);
        break;

      case 'ring':
        ctx.strokeStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'chalice':
        ctx.fillStyle = GOTHIC_HUD_THEME.goldFiligree;
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 8);
        ctx.lineTo(cx + 7, cy - 8);
        ctx.lineTo(cx + 3, cy + 3);
        ctx.lineTo(cx - 3, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GOTHIC_HUD_THEME.bloodBright;
        ctx.fillRect(cx - 5, cy - 7, 10, 3);
        break;

      case 'magnet':
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, Math.PI, 0);
        ctx.stroke();
        break;

      case 'armor':
        ctx.fillStyle = GOTHIC_HUD_THEME.ironRivet;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 9, cy - 6);
        ctx.lineTo(cx + 7, cy + 8);
        ctx.lineTo(cx, cy + 12);
        ctx.lineTo(cx - 7, cy + 8);
        ctx.lineTo(cx - 9, cy - 6);
        ctx.closePath();
        ctx.fill();
        break;

      default:
        ctx.fillStyle = GOTHIC_HUD_THEME.boneIvory;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }
}
```

---

## 5. Verification Method

### 5.1 Unit Tests (`tests/unit/UpgradeSystem.test.ts`)
The unit test suite must assert:
1. **Passives Stat Mathematics**:
   - `Tome of Might`: increments `player.stats.might` by exactly $+0.10$ per rank.
   - `Ring of Velocity`: increments `player.stats.moveSpeed` by $+20$ per rank.
   - `Blood Chalice`: increments `player.stats.maxHealth` by $+20$, heals $+20$, and adds $+0.5$ `healthRegen` per rank.
   - `Eldritch Magnet`: increments `player.stats.magnetRadius` by $+22.5$ per rank.
   - `Obsidian Armor`: increments `player.stats.armor` by $+1$ per rank.
2. **Card Generator Determinism & Constraints**:
   - Generates exactly 3 distinct cards on standard level-up.
   - Never suggests an item that is already Rank 5.
   - If weapon inventory has 6 items, never proposes new weapons (only rank-ups for existing weapons).
   - If passive inventory has 6 items, never proposes new passives.
3. **Weapon Evolution Conditions**:
   - When `weapon_scythe` is Rank 5 and `passive_chalice` is Rank 1, `evolution_harvester` is generated.
   - When `weapon_scythe` is Rank 4 and `passive_chalice` is Rank 1, evolution is NOT generated.
   - When `weapon_scythe` is Rank 5 and player does NOT have `passive_chalice`, evolution is NOT generated.
4. **Queue & Pause Protocol**:
   - Gaining 3 levels at once generates 3 sequential upgrade choices without frame delta jumps or accumulator spikes.

### 5.2 Command Verification
Run the Vitest test suite to confirm zero regressions:
```bash
npm test
```

Run Playwright E2E to verify level-up interaction in browser:
```bash
npx playwright test tests/e2e/horde_survival.spec.ts
```
