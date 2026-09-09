import { Vector2D } from '../../math/Vector2D';
import { GameEngine } from '../../engine/GameEngine';
import { AllyNPC } from './AllyNPC';
import { AllyConfig } from './AllyTypes';

export class AllyManager {
  private nextAllyId: number = 1;
  private allies: AllyNPC[] = [];

  constructor() {}

  spawnAlly(
    position: Vector2D,
    engine: GameEngine,
    config?: Partial<AllyConfig>
  ): AllyNPC {
    const ally = new AllyNPC(`ally_npc_${this.nextAllyId++}`, position, config);
    this.allies.push(ally);

    engine.addEntity(ally);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(ally.id, ally);
      engine.spatialGrid.insert(ally);
    }

    engine.eventBus.emit('ally_spawned', { allyId: ally.id, position });
    return ally;
  }

  update(_dt: number, _engine: GameEngine): void {
    // Filter dead allies
    this.allies = this.allies.filter((ally) => ally.isAlive);
  }

  getAllies(): AllyNPC[] {
    return [...this.allies];
  }

  getAllyCount(): number {
    return this.allies.filter((a) => a.isAlive).length;
  }

  hasActiveAlly(): boolean {
    return this.getAllyCount() > 0;
  }

  clear(): void {
    this.allies = [];
  }
}
