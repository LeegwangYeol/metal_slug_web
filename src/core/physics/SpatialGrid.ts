import { AABB, BoundingBox } from './AABB';
import { Vector2D } from '../math/Vector2D';

export interface SpatialGridItem {
  id: string;
  bounds: AABB;
}

/**
 * SpatialGrid - Fast 2D spatial hash grid for broadphase collision detection.
 * Partitions the world into cells of fixed size to accelerate proximity & collision queries.
 */
export class SpatialGrid<T extends SpatialGridItem = SpatialGridItem> {
  private readonly cellSize: number;
  private readonly cells: Map<string, Set<T>> = new Map();
  private readonly itemCells: Map<string, Set<string>> = new Map();
  private readonly itemsById: Map<string, T> = new Map();

  constructor(cellSize: number = 64) {
    this.cellSize = Math.max(8, cellSize);
  }

  getCellSize(): number {
    return this.cellSize;
  }

  private hashCoords(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  private getCellRange(bounds: AABB): { minCx: number; maxCx: number; minCy: number; maxCy: number } {
    const minCx = Math.floor(bounds.x / this.cellSize);
    const maxCx = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const minCy = Math.floor(bounds.y / this.cellSize);
    const maxCy = Math.floor((bounds.y + bounds.height) / this.cellSize);
    return { minCx, maxCx, minCy, maxCy };
  }

  insert(item: T): void {
    if (this.itemsById.has(item.id)) {
      this.remove(item);
    }

    this.itemsById.set(item.id, item);
    const itemCellKeys = new Set<string>();
    const { minCx, maxCx, minCy, maxCy } = this.getCellRange(item.bounds);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        itemCellKeys.add(key);

        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set<T>();
          this.cells.set(key, cell);
        }
        cell.add(item);
      }
    }

    this.itemCells.set(item.id, itemCellKeys);
  }

  remove(item: T): boolean {
    if (!this.itemsById.has(item.id)) {
      return false;
    }

    const cellKeys = this.itemCells.get(item.id);
    if (cellKeys) {
      for (const key of cellKeys) {
        const cell = this.cells.get(key);
        if (cell) {
          cell.delete(item);
          if (cell.size === 0) {
            this.cells.delete(key);
          }
        }
      }
      this.itemCells.delete(item.id);
    }

    this.itemsById.delete(item.id);
    return true;
  }

  removeById(id: string): boolean {
    const item = this.itemsById.get(id);
    if (!item) return false;
    return this.remove(item);
  }

  update(item: T): void {
    this.insert(item);
  }

  query(bounds: AABB): T[] {
    const { minCx, maxCx, minCy, maxCy } = this.getCellRange(bounds);
    const candidateSet = new Set<T>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        const cell = this.cells.get(key);
        if (cell) {
          for (const item of cell) {
            candidateSet.add(item);
          }
        }
      }
    }

    const results: T[] = [];
    for (const item of candidateSet) {
      if (BoundingBox.intersects(bounds, item.bounds)) {
        results.push(item);
      }
    }

    return results;
  }

  queryWithFilter(bounds: AABB, predicate: (item: T) => boolean): T[] {
    const matches = this.query(bounds);
    return matches.filter(predicate);
  }

  queryPoint(point: Vector2D): T[] {
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const key = this.hashCoords(cx, cy);
    const cell = this.cells.get(key);
    if (!cell) return [];

    const results: T[] = [];
    for (const item of cell) {
      if (BoundingBox.containsPoint(item.bounds, point)) {
        results.push(item);
      }
    }
    return results;
  }

  getItem(id: string): T | undefined {
    return this.itemsById.get(id);
  }

  getAllItems(): T[] {
    return Array.from(this.itemsById.values());
  }

  count(): number {
    return this.itemsById.size;
  }

  clear(): void {
    this.cells.clear();
    this.itemCells.clear();
    this.itemsById.clear();
  }
}
