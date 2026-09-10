# Project: Dark Fantasy Horde Survival ("Grim Harvest: Undead Siege")

## Core Vision & Identity
A grim, brutal, gothic dark-fantasy horde survival shooter inspired by Vampire Survivors.
The player controls an exiled dark sorcerer / grim inquisitor fighting off endless tides of the undead and cosmic horrors across an cursed wasteland.
Survival demands lethal precision, automated occult weaponry, soul-essence harvesting, and synergistic rogue-lite boons.

---

## 🏛️ Foundational Engine Architecture

### 1. High-Performance Horde Simulation Core (`src/core/`)
- **Entity Component & Horde Pool**:
  - High-density spatial partitioning (dynamic spatial hash grid / quadtree) capable of simulating 1,000+ simultaneous active undead entities at locked 60Hz.
  - Zero-garbage object pooling for projectiles, damage numbers, soul gems, and particle effects.
  - Fixed-timestep physics simulation (`dt = 1/60`) completely decoupled from rendering.
- **Player Entity (`src/core/entities/Player.ts`)**:
  - Omnidirectional 360-degree movement with smooth inertia and responsive collision.
  - Core statistics: Max Health, Health Regen, Armor / Damage Reduction, Move Speed, Might (Damage Multiplier), Area of Effect, Projectile Speed, Cooldown Reduction, Magnet Radius, Luck / Crit Chance.
  - Soul level & XP progression curve: `XP_required = base * (level ^ 1.5)`.
- **Horde Wave Director (`src/core/systems/WaveDirector.ts`)**:
  - Continuous elapsed-time horde scaling:
    - *Minute 0:00–0:30 (The Awakening)*: Shambling skeletons and crawling ghouls surrounding the player in staggered clusters.
    - *Minute 0:30–1:00 (The Swarm)*: High-density zombie hordes and fast phantom bats executing ring surrounds.
    - *Minute 1:00+ (Nightfall)*: Massive undead legion surges, elite armored death knights, and spectral banshees with projectile attacks.
  - Periodic Mini-Bosses & Horde Events (e.g. Abyssal Reaper at milestone times).
- **Automated Occult Arsenal (`src/core/weapons/`)**:
  - Weapons fire automatically based on independent internal cooldowns, targeting nearest enemies, random clusters, or orbiting the player:
    1. **Arcane Scythe**: Sweeping spectral blade cutting arcs through forward enemy clusters.
    2. **Soul Orbiters**: Orbiting skull flames orbiting the player that incinerate encroaching enemies on contact.
    3. **Abyssal Lightning**: Strikes down random dense enemy clusters with chaining electrical necrosis.
    4. **Bone Spear**: High-velocity piercing projectiles penetrating multiple undead in a straight line.
    5. **Cursed Aura (Death Sigil)**: Periodic pulsating damage ring centered on player with heavy knockback.
- **Loot & Magnetism System (`src/core/systems/LootManager.ts`)**:
  - Defeated enemies spawn Soul Shards / Blood Gems (Emerald, Ruby, Violet for varying XP values).
  - Shards remain persistent until attracted by the player's Magnet radius, accelerating towards the player with lerped velocity.
- **Rogue-Lite Boon & Synergy Engine (`src/core/systems/UpgradeSystem.ts`)**:
  - Upon leveling up, the game pauses simulation and generates 3–4 randomized upgrade cards.
  - Weapons can be upgraded from Rank 1 to 5.
  - Passives (Tome of Might, Ring of Velocity, Blood Chalice, Eldritch Magnet, Obsidian Armor).
  - Synergistic Weapon Evolutions at max rank (e.g. Arcane Scythe + Blood Chalice = Soul Reaping Harvester).

---

## 🎨 Dark Fantasy Aesthetic & Render Pipeline (`src/render/`)

### 1. Gothic Color Palette & Atmosphere
- Deep grim palettes:
  - Abyssal Void (`#08060c`, `#0f0d1a`, `#171326`)
  - Necrotic Emerald (`#0d3824`, `#19633e`, `#28a745`, `#68d391`)
  - Blood Crimson (`#380a0a`, `#6b1212`, `#a81d1d`, `#e53e3e`)
  - Bone Ivory (`#2a2624`, `#615852`, `#b8aea5`, `#ede5de`)
  - Cursed Arcane (`#1a0c2e`, `#3c1b6b`, `#7038b8`, `#b794f6`)

### 2. High-Performance Procedural & Canvas Rendering
- Dynamic multi-layered gothic backdrop:
  - Cursed desolate graveyard with weathered obsidian tombstones, twisted dead trees, and ground mist.
  - Blood moon / eclipse looming in the darkened stormy sky with drifting storm clouds.
  - Dynamic runic circles engraved into ancient stone flagging.
- Swarm Visuals:
  - Distinct silhouette-driven procedural sprites for Player, Skeletons, Ghouls, Death Knights, and Banshees.
  - Flashing damage frames (white/crimson flash on impact), gore splatters, and soul dissipation upon death.
- Arcane VFX:
  - Luminescent glowing trails, lingering spell circles, shadow aura, and floating XP gem glints.

---

## 🖥️ Imposing Dark Fantasy UI & HUD (`src/ui/`)
- **Gothic HUD**:
  - Vitality Orb / Bar with deep crimson blood filling and cracked iron framing.
  - Soul Level indicator and luminous green/violet XP bar stretching across top of screen.
  - Elapsed Survival Timer (MM:SS) and Kill Counter with skull iconography.
  - Active Weapon & Passive Inventory Slots displaying current ranks.
- **Level-Up Choice Modal**:
  - Pauses gameplay immediately.
  - Ornate gothic stone tablets displaying Card Icon, Name, Rank, Description, and Stat Deltas.
  - Keyboard (1, 2, 3, 4) and mouse click selection with visceral sound/visual confirmation.
- **Game Over & Victory Screen**:
  - "YOU HAVE SUCCUMBED TO THE HORDE" / "SURVIVAL ACHIEVED".
  - Detailed run statistics: Survival Time, Total Kills, Damage Dealt, Final Level, Weapon DPS breakdown.
  - Restart / Retry button.

---

## 🧪 Rigorous Verification & Deployment Strategy

1. **Unit Test Suite (`tests/unit/`)**:
   - `HordeManager.test.ts`: 1,000+ enemy spawn, culling, spatial grid lookup, zero memory leaks.
   - `PlayerProgression.test.ts`: XP curve math, leveling logic, stat calculation with passives.
   - `WeaponsAndSynergies.test.ts`: Auto-firing timing, projectile pierce, damage scaling, evolution triggers.
   - `WaveDirector.test.ts`: Escalation timeline, difficulty scaling, enemy type distribution.

2. **Automated Playwright E2E Playtesting (`tests/e2e/`)**:
   - `horde_survival.spec.ts`:
     - Launches browser and runs continuous 30+ second survival simulation.
     - Simulates player dodging hordes while auto-firing kills enemies.
     - Verifies XP gem collection and leveling up.
     - Interacts with Level-Up modal and selects an upgrade card.
     - Confirms simulation resumes seamlessly with upgraded stats.
     - Asserts zero JavaScript errors, zero unhandled rejections, and zero engine lag.
   - High-resolution visual proof screenshots saved in `artifacts/dark_fantasy/`:
     - `artifacts/dark_fantasy/horde_swarm.png` (demonstrating overwhelming undead swarms and dark gothic art).
     - `artifacts/dark_fantasy/level_up_modal.png` (demonstrating gothic upgrade card selection).
     - `artifacts/dark_fantasy/survival_gameplay.png` (demonstrating auto-firing weapons and visual effects).

3. **Production Deployment**:
   - 100% green tests (`npm test` and `npm run test:e2e`).
   - Clean production build (`npm run build`).
   - Git push to `origin/main` on GitHub.
   - Verify Vercel deployment status.

---

## 🏁 Milestones & 60-Agent Decomposition

| Milestone | Scope | Agent Allocation | Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- |
| **M1: Foundation & High-Performance Core** | Wipe old cute code, implement spatial grid, horde entity pooling, player physics, XP/leveling math | Agents 1–15 | None | **DONE** |
| **M2: Dark Fantasy Art & Gothic Render Engine** | Dark fantasy palette, procedural undead & player sprites, cursed graveyard backdrop, spell VFX, gothic HUD | Agents 16–30 | M1 | **DONE** |
| **M3: Occult Arsenal, Upgrades & Horde Director** | 5 auto-firing weapons, rogue-lite level-up modal, passives & synergies, escalating wave spawner | Agents 31–45 | M1, M2 | **DONE** |
| **M4: Automated E2E Playtesting & Hardening** | Playwright 30s+ survival loop test, visual proof screenshots, comprehensive unit tests | Agents 46–55 | M3 | **DONE** |
| **M5: Deployment & Live Production Verification** | Clean build, 100% green tests, git push to origin/main, Vercel verification | Agents 56–60 | M4 | **DONE** |
