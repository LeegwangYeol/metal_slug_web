# Investigation & Remediation Strategy: Milestone M2 Core Loop Bubble Popping & Companion Robustness

**Agent**: Explorer Remediation 2 (`explorer_remediation_m2_loop_2`)  
**Mission**: Investigate and formulate an exact, copy-paste ready fix strategy for Reviewer 1 Finding 1 and Challenger 2 findings.  
**Scope**:
1. Trapped bubble popping during live gameplay in `CuteArenaCoordinator.ts` and `main.ts` (Reviewer 1 Finding 1).
2. Fix array mutation during `for (const pickup of bubbleManager.pickups)` loop in `PetCompanion.ts:118` (Challenger 2 BUG 1).
3. Add `Number.isFinite(choiceIndex)` / integer guard in `SweetPerkManager.ts:104` to prevent NaN index crash (Challenger 2 BUG 2).
4. Ensure `dt` sanitization in `PetCompanion.ts` to prevent `NaN` or `Infinity` coordinate corruption / thread freeze (Challenger 2 Vulnerabilities 1 & 2).
5. Target files:
   - `src/core/cute/CuteArenaCoordinator.ts`
   - `src/core/cute/BubbleManager.ts`
   - `src/core/cute/PetCompanion.ts`
   - `src/core/cute/SweetPerkManager.ts`
   - `src/main.ts`
   - `tests/unit/challenger_cute_m2_2_stress.test.ts`
6. Patch artifact: `.agents/explorer_remediation_m2_loop_2/m2_core_loop_bubble_popping.patch`

---

## 1. Observation

### 1.1 Direct Code Observations & Empirical Proofs

#### Observation 1 (Reviewer 1 Finding 1): Zero Calls to `popBubble` in Live Gameplay
In `src/core/cute/BubbleManager.ts:100-145`:
```typescript
  public popBubble(bubbleId: string): boolean {
    const bubble = this.bubbles.find((b) => b.id === bubbleId && b.isAlive && b.state !== 'POPPING');
    if (!bubble) return false;
    ...
```
Ripgrep across the entire codebase revealed `popBubble` was called in only 3 places:
1. `src/core/cute/BubbleManager.ts:139` (recursive cascade pop)
2. `src/core/cute/BubbleManager.ts:261` (star shard collision)
3. `tests/unit/cute_gameplay_loop.test.ts:107, 185` (headless unit test assertion)

In `src/core/cute/CuteArenaCoordinator.ts:313-345` and `src/main.ts`:
`popBubble` was **never called** (`0 matches`).
Furthermore, in `src/core/cute/BubbleTrapEntity.ts:122-125`:
```typescript
      // Auto-escape if lifespan exceeded
      if (this.age >= this.lifespan) {
        this.pop(1);
      }
```
When `this.age >= this.lifespan` (8.0s), `this.pop(1)` on the entity generated 6 radial shards that were discarded. `BubbleManager` was never notified, so `onScoreAwarded`, `onAltarInfluence`, `spawnPickups`, combo scaling, and fever charging were completely bypassed.

**Empirical Verification**:
```bash
npx tsx -e "
import { FullMetalSlugGame } from './src/main';
const game = new FullMetalSlugGame();
for (let i = 0; i < 100; i++) game.step(1 / 60);
game.keyboard.fireJustPressed = true; game.keyboard.fire = true; game.step(1 / 60);
for (let i = 0; i < 120; i++) game.step(1 / 60);
for (let i = 0; i < 600; i++) game.step(1 / 60);
console.log('Score:', game.player.score, 'Pickups:', game.cuteCoordinator.bubbleManager.pickups.length,
  'Altar 0 Progress:', game.cuteCoordinator.altars.altars[0].purificationProgress,
  'Fever Meter:', game.cuteCoordinator.bubbleManager.feverMeter);
"
```
**Output**: `Score: 0 Pickups: 0 Altar 0 Progress: 0 Fever Meter: 0`.

---

#### Observation 2 (Challenger 2 BUG 1): In-place Array Mutation in `PetCompanion.ts:118-139`
In `src/core/cute/PetCompanion.ts:118-139`:
```typescript
118:     for (const pickup of bubbleManager.pickups) {
119:       if (!pickup.isAlive) continue;
...
135:         if (dist < 22) {
136:           bubbleManager.collectPickup(pickup.id);
137:         }
138:       }
139:     }
```
And in `src/core/cute/BubbleManager.ts:328-329`:
```typescript
328:     pickup.isAlive = false;
329:     this.pickups.splice(idx, 1);
```
**Empirical Finding**:
When 4 pickups are co-located within 22px of Mochi:
- Frame 1: Index 0 is collected & spliced $\to$ index 1 shifts to index 0. The forward iterator advances to index 1 (originally index 2). The pickup at new index 0 is **skipped**. Result: 2 pickups remain.
- Frame 2: Index 0 is collected & spliced $\to$ index 1 shifts to index 0. Forward iterator advances to index 1. Pickup at index 0 is skipped again. Result: 1 pickup remains.
- Frame 3: Final pickup collected.
It required 3 entire frames (50ms) to collect 4 co-located candies instead of 1 frame.

---

#### Observation 3 (Challenger 2 BUG 2): Unhandled NaN Index in `SweetPerkManager.ts:104-109`
In `src/core/cute/SweetPerkManager.ts:104-109`:
```typescript
104:   public selectCard(index: number = this.selectedCardIndex): SweetPerkCard | null {
105:     if (!this.isModalActive || index < 0 || index >= this.availableCards.length) {
106:       return null;
107:     }
108: 
109:     const card = this.availableCards[index];
110:     const currentLevel = this.acquiredPerks.get(card.id) ?? 0;
```
**Empirical Finding**:
In JavaScript:
- `NaN < 0` is `false`.
- `NaN >= 3` is `false`.
If `selectCard(NaN)` is invoked, the guard `index < 0 || index >= this.availableCards.length` evaluates to `false` and is bypassed. `this.availableCards[NaN]` returns `undefined`. Accessing `card.id` crashes the engine:
```text
TypeError: Cannot read properties of undefined (reading 'id')
 ❯ SweetPerkManager.selectCard src/core/cute/SweetPerkManager.ts:109:54
```

---

#### Observation 4 (Challenger 2 Vulnerabilities 1 & 2): `dt` Sanitization in `PetCompanion.ts`
In `src/core/cute/PetCompanion.ts:70-105`:
```typescript
70:   public update(
71:     dt: number,
...
76:     this.time += dt;
...
88:     const targetY = player.y - 30 + Math.sin(this.time * 3.5) * 8;
...
93:     let remainingDt = dt;
94:     while (remainingDt > 0) {
95:       const stepDt = Math.min(remainingDt, 1 / 60);
...
104:       remainingDt -= stepDt;
105:     }
```
And lines 161-163:
```typescript
161:         const currentSpeed = Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy);
162:         bolt.vx = (bolt.vx / currentSpeed) * speed;
163:         bolt.vy = (bolt.vy / currentSpeed) * speed;
```
**Empirical Finding**:
1. If `dt = NaN`: `this.time` becomes `NaN`. In subsequent normal frames (`dt = 1/60`), `Math.sin(NaN * 3.5)` yields `NaN`, causing `targetY = NaN`, which permanently corrupts `pet.y`, `pet.vx`, and `pet.vy` to `NaN`.
2. If `dt = Infinity`: `Math.min(Infinity, 1/60) = 1/60`. `Infinity - 1/60 === Infinity`. `while (remainingDt > 0)` never terminates, freezing the browser thread in an infinite loop.
3. If `currentSpeed = 0`: `bolt.vx / 0` evaluates to `NaN`.

---

## 2. Logic Chain

1. **Step 1 (Core Loop Dependency on Popping)**:
   In the "Sugar Pop Blossom" design, trapping enemies in bubbles is only phase 1 of combat. Phase 2 requires popping trapped bubbles. Popping is what spawns 6-shard radial bursts (`StarShard[]`), triggers Sweet Cascade chain reactions, awards combo score (`onScoreAwarded`), drops candy/star crystals (`spawnPickups`), charges the Rainbow Sugar Rush fever bar (`addFeverCharge`), and purifies Blossom Altars (`onAltarInfluence`).
2. **Step 2 (Root Cause of Zero Pops)**:
   Observation 1 demonstrates that neither `CuteArenaCoordinator.ts` nor `main.ts` checked collisions between player bounds (feet/body) or projectiles and trapped bubbles. Trapped bubbles simply floated upward until their 8.0s lifespan expired, at which point the entity called `this.pop(1)` locally, throwing away all shards and bypassing `BubbleManager`.
3. **Step 3 (Array Mutation Analysis)**:
   Observation 2 demonstrates that `PetCompanion.ts` performed in-place splicing on `bubbleManager.pickups` during a forward `for...of` loop. When multiple pickups are in collection range, the forward iterator skips every second pickup. Staging collected IDs in a temporary `toCollect: string[]` list during the vacuum check and calling `collectPickup` after the loop guarantees all co-located candies are collected in a single frame.
4. **Step 4 (Perk Index Guard Flaw)**:
   Observation 3 proves that numeric comparison (`< 0` or `>= length`) fails to guard against `NaN` due to IEEE-754 unordered comparison semantics. Explicitly checking `!Number.isFinite(index) || !Number.isInteger(index)` and adding a fallback `if (!card) return null;` guarantees absolute immunity against bad input and prevents `TypeError` crashes.
5. **Step 5 (Timestep Hardening)**:
   Observation 4 shows that while sub-stepped Euler integration protects against finite large timesteps, lack of input boundary guards allows `NaN` and `Infinity` to poison the spring simulation or hang the loop. Adding `if (!Number.isFinite(dt) || dt <= 0) return; const safeDt = Math.min(dt, 0.5);` and a loop guard `maxSubsteps = 30` eliminates both vulnerabilities.

---

## 3. Caveats

1. **Scope Boundaries**:
   - Boss defeat lifecycle and Colossus cub splitting are addressed by Explorer Remediation 1 (`explorer_remediation_m2_boss_1`).
   - Living enemy rendering in `CanvasRenderer` and dual-gunfire suppression in `main.ts` are addressed by Explorer Remediation 3 (`explorer_remediation_m2_render_3`).
2. **Test Expectations in Challenger 2 Suite**:
   - In `tests/unit/challenger_cute_m2_2_stress.test.ts`, tests 1F, 2B, and 3H were written as *bug proofs* asserting that the bugs existed (e.g. `expect(isYCorrupted).toBe(true)`). When the fixes are applied, the Worker must update the test assertions to reflect the correct, hardened behavior.
3. No other caveats.

---

## 4. Conclusion & Exact Replacement Code

### 4.1 Target File: `src/core/cute/CuteArenaCoordinator.ts`
**Location**: Around lines 177, 240-250, and 320-350.

#### Edit 1: Guard `choosePerk` against non-finite input (Line 177)
```typescript
<<<<
  public choosePerk(index: number): boolean {
    const card = this.perks.selectCard(index);
====
  public choosePerk(index: number): boolean {
    if (!Number.isFinite(index)) return false;
    const card = this.perks.selectCard(index);
>>>>
```

#### Edit 2: Accept optional player bounds/position in `update` signature (Lines 240-250)
```typescript
<<<<
  public update(
    dt: number,
    player: {
      x: number;
      y: number;
      facing: 1 | -1;
      isAlive: boolean;
      lives?: number;
      takeDamage?: (dmg: number) => void;
    }
  ): void {
====
  public update(
    dt: number,
    player: {
      x: number;
      y: number;
      facing: 1 | -1;
      isAlive: boolean;
      lives?: number;
      takeDamage?: (dmg: number) => void;
      position?: { x: number; y: number };
      bounds?: { x: number; y: number; width: number; height: number };
    }
  ): void {
>>>>
```

#### Edit 3: Add Player Touch/Jump Collision & Projectile Bubble Popping (Lines 319-325)
Insert immediately before `// 3. Collision: Player Bubble Projectiles with Living Unbubbled Cute Enemies`:
```typescript
    // 3. Collision: Player Touching or Jumping on Trapped Bubbles
    const px = player.position?.x ?? player.x;
    const py = player.position?.y ?? player.y;
    if (player.isAlive) {
      const playerRadiusX = 18;
      const playerRadiusY = 24;
      const playerCenterY = py - 20;

      for (const b of this.bubbleManager.bubbles) {
        if (!b.isAlive || b.state !== 'TRAPPED') continue;

        const dx = Math.abs(px - b.x);
        const dy = Math.abs(playerCenterY - b.y);

        if (dx <= b.radius + playerRadiusX && dy <= b.radius + playerRadiusY) {
          this.bubbleManager.popBubble(b.id, px, py);
        }
      }
    }

    // 4. Collision: Player Bubble Projectiles Popping Trapped Bubbles
    for (const proj of this.bubbleManager.bubbles) {
      if (!proj.isAlive || proj.state !== 'FREE_PROJECTILE') continue;

      for (const trapped of this.bubbleManager.bubbles) {
        if (!trapped.isAlive || trapped.state !== 'TRAPPED' || trapped.id === proj.id) continue;

        const dx = proj.x - trapped.x;
        const dy = proj.y - trapped.y;
        const hitDist = proj.radius + trapped.radius;
        if (dx * dx + dy * dy <= hitDist * hitDist) {
          proj.isAlive = false;
          this.bubbleManager.popBubble(trapped.id, px, py);
          break;
        }
      }
    }
```

---

### 4.2 Target File: `src/core/cute/BubbleManager.ts`
**Location**: Lines 100-103 and 240-246.

#### Edit 1: Update `popBubble` signature to accept optional origin coordinates (Line 100)
```typescript
<<<<
  public popBubble(bubbleId: string): boolean {
    const bubble = this.bubbles.find((b) => b.id === bubbleId && b.isAlive && b.state !== 'POPPING');
====
  public popBubble(bubbleId: string, _originX?: number, _originY?: number): boolean {
    const bubble = this.bubbles.find((b) => b.id === bubbleId && b.isAlive && b.state !== 'POPPING');
>>>>
```

#### Edit 2: Route expired trapped bubbles through `popBubble` (Lines 240-245)
```typescript
<<<<
    // 3. Update Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      bubble.update(dt);
      if (!bubble.isAlive) {
        this.bubbles.splice(i, 1);
      }
    }
====
    // 3. Update Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      if (bubble.isAlive && bubble.state === 'TRAPPED' && bubble.age >= bubble.lifespan) {
        this.popBubble(bubble.id, playerPos?.x, playerPos?.y);
      } else {
        bubble.update(dt);
      }
      if (!bubble.isAlive) {
        this.bubbles.splice(i, 1);
      }
    }
>>>>
```

---

### 4.3 Target File: `src/core/cute/PetCompanion.ts`
**Location**: Lines 70-106, lines 118-139, and lines 150-170.

#### Edit 1: Sanitize `dt` and add sub-step iteration ceiling (Lines 70-106)
```typescript
<<<<
  public update(
    dt: number,
    player: { x: number; y: number; facing: 1 | -1; isAlive: boolean },
    bubbleManager: BubbleManager,
    enemies: CuteEnemyState[] = []
  ): void {
    this.time += dt;

    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        this.state = 'hover';
      }
    }

    // 1. Spring-Damper Follower Physics
    // Target anchor is slightly behind and above the player with gentle sine bobbing
    const targetX = player.x - player.facing * 42;
    const targetY = player.y - 30 + Math.sin(this.time * 3.5) * 8;

    const stiffness = 22.0 * this.modifiers.speedMultiplier;
    const damping = 5.0;

    let remainingDt = dt;
    while (remainingDt > 0) {
      const stepDt = Math.min(remainingDt, 1 / 60);
      const fx = (targetX - this.x) * stiffness - this.vx * damping;
      const fy = (targetY - this.y) * stiffness - this.vy * damping;

      this.vx += fx * stepDt;
      this.vy += fy * stepDt;

      this.x += this.vx * stepDt;
      this.y += this.vy * stepDt;
      remainingDt -= stepDt;
    }
====
  public update(
    dt: number,
    player: { x: number; y: number; facing: 1 | -1; isAlive: boolean },
    bubbleManager: BubbleManager,
    enemies: CuteEnemyState[] = []
  ): void {
    // Sanitize dt against NaN, Infinity, non-positive numbers
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }
    const safeDt = Math.min(dt, 0.5); // Clamp extreme lag spikes

    this.time += safeDt;

    if (this.actionTimer > 0) {
      this.actionTimer -= safeDt;
      if (this.actionTimer <= 0) {
        this.state = 'hover';
      }
    }

    // 1. Spring-Damper Follower Physics
    // Target anchor is slightly behind and above the player with gentle sine bobbing
    const targetX = player.x - player.facing * 42;
    const targetY = player.y - 30 + Math.sin(this.time * 3.5) * 8;

    const stiffness = 22.0 * this.modifiers.speedMultiplier;
    const damping = 5.0;

    let remainingDt = safeDt;
    let maxSubsteps = 30; // Guard against infinite loop
    while (remainingDt > 0 && maxSubsteps-- > 0) {
      const stepDt = Math.min(remainingDt, 1 / 60);
      const fx = (targetX - this.x) * stiffness - this.vx * damping;
      const fy = (targetY - this.y) * stiffness - this.vy * damping;

      this.vx += fx * stepDt;
      this.vy += fy * stepDt;

      this.x += this.vx * stepDt;
      this.y += this.vy * stepDt;
      remainingDt -= stepDt;
    }
>>>>
```

#### Edit 2: Fix array mutation during vacuum collection loop (Lines 114-140)
```typescript
<<<<
    // 2. Candy & Star Crystal Vacuum
    const vacuumRadius = this.modifiers.vacuumRadius;
    let isFetching = false;

    for (const pickup of bubbleManager.pickups) {
      if (!pickup.isAlive) continue;

      const dx = this.x - pickup.x;
      const dy = this.y - pickup.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= vacuumRadius * vacuumRadius) {
        isFetching = true;
        const dist = Math.max(1, Math.sqrt(distSq));
        const vacuumSpeed = 440 * this.modifiers.speedMultiplier;

        // Pull pickup towards Mochi
        pickup.vx = (dx / dist) * vacuumSpeed;
        pickup.vy = (dy / dist) * vacuumSpeed;

        // Collect if close enough
        if (dist < 22) {
          bubbleManager.collectPickup(pickup.id);
        }
      }
    }
====
    // 2. Candy & Star Crystal Vacuum
    const vacuumRadius = this.modifiers.vacuumRadius;
    let isFetching = false;
    const toCollect: string[] = [];

    for (const pickup of bubbleManager.pickups) {
      if (!pickup.isAlive) continue;

      const dx = this.x - pickup.x;
      const dy = this.y - pickup.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= vacuumRadius * vacuumRadius) {
        isFetching = true;
        const dist = Math.max(1, Math.sqrt(distSq));
        const vacuumSpeed = 440 * this.modifiers.speedMultiplier;

        // Pull pickup towards Mochi
        pickup.vx = (dx / dist) * vacuumSpeed;
        pickup.vy = (dy / dist) * vacuumSpeed;

        // Collect if close enough
        if (dist < 22) {
          toCollect.push(pickup.id);
        }
      }
    }

    for (const pickupId of toCollect) {
      bubbleManager.collectPickup(pickupId);
    }
>>>>
```

#### Edit 3: Guard Heart Bolt 0-speed division and use `safeDt` (Lines 150-170)
```typescript
<<<<
    // 3. Update Active Heart Bolts
    for (let i = this.activeHeartBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeHeartBolts[i];
      bolt.age += dt;

      // Gentle homing if target enemy is still valid
      const target = enemies.find((e) => e.id === bolt.targetId && e.isAlive && !e.isBubbled);
      if (target) {
        const dx = target.x - bolt.x;
        const dy = target.y - bolt.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 380;
        bolt.vx += (dx / dist) * 1200 * dt;
        bolt.vy += (dy / dist) * 1200 * dt;
        const currentSpeed = Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy);
        bolt.vx = (bolt.vx / currentSpeed) * speed;
        bolt.vy = (bolt.vy / currentSpeed) * speed;
      }

      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
====
    // 3. Update Active Heart Bolts
    for (let i = this.activeHeartBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeHeartBolts[i];
      bolt.age += safeDt;

      // Gentle homing if target enemy is still valid
      const target = enemies.find((e) => e.id === bolt.targetId && e.isAlive && !e.isBubbled);
      if (target) {
        const dx = target.x - bolt.x;
        const dy = target.y - bolt.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 380;
        bolt.vx += (dx / dist) * 1200 * safeDt;
        bolt.vy += (dy / dist) * 1200 * safeDt;
        const currentSpeed = Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy) || 1;
        bolt.vx = (bolt.vx / currentSpeed) * speed;
        bolt.vy = (bolt.vy / currentSpeed) * speed;
      }

      bolt.x += bolt.vx * safeDt;
      bolt.y += bolt.vy * safeDt;
>>>>
```

---

### 4.4 Target File: `src/core/cute/SweetPerkManager.ts`
**Location**: Lines 103-111.

```typescript
<<<<
  public selectCard(index: number = this.selectedCardIndex): SweetPerkCard | null {
    if (!this.isModalActive || index < 0 || index >= this.availableCards.length) {
      return null;
    }

    const card = this.availableCards[index];
    const currentLevel = this.acquiredPerks.get(card.id) ?? 0;
====
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
>>>>
```

---

### 4.5 Target File: `src/main.ts`
**Location**: Lines 128-132 and 395-400.

#### Edit 1: Wire `cuteCoordinator.onScoreChanged` to update `this.player.score` (Line 128)
```typescript
<<<<
    if (this.gameMode === 'cute_blossom_arena') {
      this.cuteCoordinator.onBannerAnnounce = (text: string) => {
        this.activeCuteBanner = text;
        this.bossWarningTimer = 2.0;
      };
    }
====
    if (this.gameMode === 'cute_blossom_arena') {
      this.cuteCoordinator.onBannerAnnounce = (text: string) => {
        this.activeCuteBanner = text;
        this.bossWarningTimer = 2.0;
      };
      this.cuteCoordinator.onScoreChanged = (_totalScore: number, points: number) => {
        this.player.score += points;
      };
    }
>>>>
```

#### Edit 2: Allow classic projectiles to pop trapped bubbles in cute mode (Line 395)
```typescript
      // Update cute coordinator (bubbles, pet companion, altars, perks, enemies)
      this.cuteCoordinator.update(dt, playerActor);

      // Check classic weapon projectiles hitting trapped bubbles
      const engineEntities = this.engine.getAllEntities();
      for (const ent of engineEntities) {
        if (ent.type === 'PROJECTILE' && ent.isAlive) {
          const p = ent as any;
          for (const b of this.cuteCoordinator.bubbleManager.bubbles) {
            if (b.isAlive && b.state === 'TRAPPED') {
              const dx = p.position.x - b.x;
              const dy = p.position.y - b.y;
              if (dx * dx + dy * dy <= (b.radius + 12) * (b.radius + 12)) {
                p.isAlive = false;
                this.cuteCoordinator.bubbleManager.popBubble(b.id, this.player.position.x, this.player.position.y);
                break;
              }
            }
          }
        }
      }
```

---

### 4.6 Target File: `tests/unit/challenger_cute_m2_2_stress.test.ts`
**Location**: Update the 3 test assertions in tests 1F, 2B, and 3H:

#### Edit 1: Test 1F (lines 155-167)
```typescript
<<<<
      // Proves vulnerability: pet.time becomes NaN, which causes targetY and pet.y to become permanently NaN!
      const isYCorrupted = Number.isNaN(pet.y);
      expect(isYCorrupted, 'Vulnerability reproduction: NaN dt permanently poisons pet.y to NaN').toBe(true);
====
      // After remediation: dt=NaN is rejected, pet.time and pet.y remain strictly finite!
      const isYCorrupted = Number.isNaN(pet.y);
      expect(isYCorrupted, 'dt=NaN must NOT poison pet.y').toBe(false);
      expect(Number.isFinite(pet.y)).toBe(true);
>>>>
```

#### Edit 2: Test 2B (lines 268-285)
```typescript
<<<<
      // Because collectPickup splices the array during `for (const p of bubbleManager.pickups)`,
      // element 0 is collected & spliced -> element 1 shifts to index 0.
      // The iterator advances to index 1 (which is element 2). Element 1 is SKIPPED!
      // Therefore, in frame 1, only 2 out of 4 pickups are collected:
      expect(bubbleManager.pickups.length).toBe(2);
      expect(bubbleManager.pickups[0].id).toBe('candy_adjacent_1');
      expect(bubbleManager.pickups[1].id).toBe('candy_adjacent_3');

      // Frame 2: element 0 (candy_adjacent_1) is collected & spliced -> element 1 (candy_adjacent_3)
      // shifts to index 0, and the iterator moves to index 1. candy_adjacent_3 is SKIPPED AGAIN!
      pet.update(0.016, player, bubbleManager, []);
      expect(bubbleManager.pickups.length).toBe(1);
      expect(bubbleManager.pickups[0].id).toBe('candy_adjacent_3');

      // Frame 3: finally collects the last pickup
      pet.update(0.016, player, bubbleManager, []);
      expect(bubbleManager.pickups.length).toBe(0);
====
      // After remediation with staged collection: all 4 co-located pickups are collected in Frame 1!
      expect(bubbleManager.pickups.length).toBe(0);
>>>>
```

#### Edit 3: Test 3H (lines 494-504)
```typescript
<<<<
      let caughtError: any = null;
      try {
        perkManager.selectCard(NaN);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof TypeError).toBe(true);
      expect(caughtError.message).toContain("reading 'id'");
====
      let caughtError: any = null;
      let result: any = null;
      try {
        result = perkManager.selectCard(NaN);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeNull();
      expect(result).toBeNull();
      expect(perkManager.isModalActive).toBe(true);
>>>>
```

---

## 5. Verification Method

To independently verify these remediations:

1. **Verify Live Popping, Score, Shards, Drops, Fever & Altar**:
   ```bash
   npx tsx -e "
   import { FullMetalSlugGame } from './src/main';
   const game = new FullMetalSlugGame();
   for (let i = 0; i < 100; i++) game.step(1 / 60);
   game.keyboard.fireJustPressed = true; game.keyboard.fire = true; game.step(1 / 60);
   for (let i = 0; i < 720; i++) game.step(1 / 60);
   console.log('Score:', game.player.score, 'Candies:', game.cuteCoordinator.bubbleManager.pickups.length,
     'Altar:', game.cuteCoordinator.altars.altars[0].purificationProgress,
     'Fever:', game.cuteCoordinator.bubbleManager.feverMeter);
   "
   ```
   *Expected Result*: `Score > 0`, `Altar > 0`, `Fever > 0`.

2. **Verify Challenger 2 Stress Suite Passes 100%**:
   ```bash
   npx vitest run tests/unit/challenger_cute_m2_2_stress.test.ts
   ```
   *Expected Result*: 20/20 tests passing cleanly in $< 50\text{ms}$.

3. **Verify Core Gameplay Loop Suite**:
   ```bash
   npx vitest run tests/unit/cute_gameplay_loop.test.ts
   ```
   *Expected Result*: 25/25 tests passing cleanly.

4. **Verify Clean Production Build**:
   ```bash
   npm run build
   ```
   *Expected Result*: Exits 0 with 0 TypeScript compilation errors.
