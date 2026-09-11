# Progress Log

- Last visited: 2026-09-11T02:20:20Z
- Status: Investigation Completed
- Current Step: Synthesizing findings and writing handoff.md
- Accomplishments:
  - Read ORIGINAL_REQUEST.md, COLLABORATION.md, and SCOPE.md
  - Investigated Enemy.ts, EnemyTypes.ts, HordeManager.ts, SpatialHashGrid.ts, and DarkFantasySprites.ts
  - Uncovered critical discrepancy: HordeManager.getEnemiesInRadius() does NOT check `distSq <= (radius + enemy.collisionRadius)^2`; it only delegates to SpatialHashGrid.queryRadius() which adds `maxEntityRadius = 32px`
  - Uncovered that `enemy.collisionRadius` does not exist on Enemy (only `enemy.radius`)
  - Calibrated exact collision radii for Skeleton (11px), Ghoul (13px), Banshee (12px), Death Knight (18px), and Necromancer (14px) based on DarkFantasySprites vector rendering contours
  - Evaluated impacts on spawning (agnostic), spatial partitioning grid (safe with maxEntityRadius, optimal cellSize=64), and flocking separation (cleaner clustering, tighter swarms)
