import { EventBus } from '../core/EventBus';
import { ErrorPipeline } from '../core/ErrorPipeline';
import { LevelDefinition, TowerDefinition, EnemyDefinition, SkillTreeDefinition, SkillDefinition, GameConfig } from '../models/GameModels';

export class EditorManager {
  private eventBus = EventBus.getInstance();
  private errorPipeline = ErrorPipeline.getInstance();

  private config!: GameConfig;
  private levels: LevelDefinition[] = [];
  private towers: TowerDefinition[] = [];
  private enemies: EnemyDefinition[] = [];
  private skillTrees: Map<string, SkillTreeDefinition> = new Map();

  private isAuthenticated: boolean = false;

  constructor() {}

  public initialize(
    config: GameConfig,
    levels: LevelDefinition[],
    towers: TowerDefinition[],
    enemies: EnemyDefinition[],
    skillTrees: SkillTreeDefinition[]
  ): void {
    this.config = config;
    this.levels = levels;
    this.towers = towers;
    this.enemies = enemies;
    skillTrees.forEach(t => this.skillTrees.set(t.treeId, t));
  }

  /**
   * Constant-time string comparison to prevent timing side-channel attacks during authentication.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    let mismatch = a.length === b.length ? 0 : 1;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const charA = i < a.length ? a.charCodeAt(i) : 0;
      const charB = i < b.length ? b.charCodeAt(i) : 0;
      mismatch |= charA ^ charB;
    }
    return mismatch === 0;
  }

  public authenticate(password: string): boolean {
    // Security: Use constant-time comparison to prevent timing side-channel attacks on editor password
    if (
      typeof password === 'string' &&
      this.config &&
      typeof this.config.editorPasswordHash === 'string' &&
      this.timingSafeEqual(password, this.config.editorPasswordHash)
    ) {
      this.isAuthenticated = true;
      this.eventBus.emit('editor:authenticated');
      return true;
    } else {
      this.errorPipeline.handleError('AUTH_FAILED', 'Incorrect editor password');
      return false;
    }
  }

  public isAuth(): boolean {
    return this.isAuthenticated;
  }

  public logout(): void {
    this.isAuthenticated = false;
    this.eventBus.emit('editor:loggedOut');
  }

  public addLevel(level: LevelDefinition): boolean {
    if (!this.isAuthenticated) return false;
    if (this.levels.some(l => l.id === level.id)) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Level ID ${level.id} already exists`);
      return false;
    }
    this.levels.push(level);
    this.eventBus.emit('editor:levelAdded', level);
    return true;
  }

  public updateLevel(level: LevelDefinition): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.levels.findIndex(l => l.id === level.id);
    if (idx === -1) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Level ID ${level.id} not found`);
      return false;
    }
    this.levels[idx] = level;
    this.eventBus.emit('editor:levelUpdated', level);
    return true;
  }

  public deleteLevel(levelId: number): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.levels.findIndex(l => l.id === levelId);
    if (idx !== -1) {
      this.levels.splice(idx, 1);
      this.eventBus.emit('editor:levelDeleted', levelId);
      return true;
    }
    return false;
  }

  public addTower(tower: TowerDefinition): boolean {
    if (!this.isAuthenticated) return false;
    if (this.towers.some(t => t.id === tower.id)) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Tower ID ${tower.id} already exists`);
      return false;
    }
    this.towers.push(tower);
    this.eventBus.emit('editor:towerAdded', tower);
    return true;
  }

  public updateTower(tower: TowerDefinition): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.towers.findIndex(t => t.id === tower.id);
    if (idx === -1) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Tower ID ${tower.id} not found`);
      return false;
    }
    this.towers[idx] = tower;
    this.eventBus.emit('editor:towerUpdated', tower);
    return true;
  }

  public deleteTower(towerId: string): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.towers.findIndex(t => t.id === towerId);
    if (idx !== -1) {
      this.towers.splice(idx, 1);
      this.eventBus.emit('editor:towerDeleted', towerId);
      return true;
    }
    return false;
  }

  public addEnemy(enemy: EnemyDefinition): boolean {
    if (!this.isAuthenticated) return false;
    if (this.enemies.some(e => e.id === enemy.id)) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Enemy ID ${enemy.id} already exists`);
      return false;
    }
    this.enemies.push(enemy);
    this.eventBus.emit('editor:enemyAdded', enemy);
    return true;
  }

  public updateEnemy(enemy: EnemyDefinition): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.enemies.findIndex(e => e.id === enemy.id);
    if (idx === -1) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Enemy ID ${enemy.id} not found`);
      return false;
    }
    this.enemies[idx] = enemy;
    this.eventBus.emit('editor:enemyUpdated', enemy);
    return true;
  }

  public deleteEnemy(enemyId: string): boolean {
    if (!this.isAuthenticated) return false;
    const idx = this.enemies.findIndex(e => e.id === enemyId);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
      this.eventBus.emit('editor:enemyDeleted', enemyId);
      return true;
    }
    return false;
  }

  public addSkill(treeId: string, skill: SkillDefinition): boolean {
    if (!this.isAuthenticated) return false;
    const tree = this.skillTrees.get(treeId);
    if (!tree) return false;

    if (tree.skills.some(s => s.id === skill.id)) {
      this.errorPipeline.handleError('EDITOR_ERROR', `Skill ID ${skill.id} already exists`);
      return false;
    }
    tree.skills.push(skill);
    this.eventBus.emit('editor:skillAdded', { treeId, skill });
    return true;
  }

  public updateSkill(treeId: string, skill: SkillDefinition): boolean {
    if (!this.isAuthenticated) return false;
    const tree = this.skillTrees.get(treeId);
    if (!tree) return false;

    const idx = tree.skills.findIndex(s => s.id === skill.id);
    if (idx === -1) return false;
    tree.skills[idx] = skill;
    this.eventBus.emit('editor:skillUpdated', { treeId, skill });
    return true;
  }

  public deleteSkill(treeId: string, skillId: string): boolean {
    if (!this.isAuthenticated) return false;
    const tree = this.skillTrees.get(treeId);
    if (!tree) return false;

    const idx = tree.skills.findIndex(s => s.id === skillId);
    if (idx !== -1) {
      tree.skills.splice(idx, 1);
      this.eventBus.emit('editor:skillDeleted', { treeId, skillId });
      return true;
    }
    return false;
  }

  public exportLevelsJSON(): string {
    return JSON.stringify(this.levels, null, 2);
  }

  public exportTowersJSON(): string {
    return JSON.stringify(this.towers, null, 2);
  }

  public exportEnemiesJSON(): string {
    return JSON.stringify(this.enemies, null, 2);
  }

  public exportSkillTreesJSON(): string {
    const obj: Record<string, SkillTreeDefinition> = {};
    this.skillTrees.forEach((val, key) => {
      obj[key] = val;
    });
    return JSON.stringify(obj, null, 2);
  }

  public getLevels(): LevelDefinition[] { return this.levels; }
  public getTowers(): TowerDefinition[] { return this.towers; }
  public getEnemies(): EnemyDefinition[] { return this.enemies; }
  public getSkillTree(treeId: string): SkillTreeDefinition | undefined { return this.skillTrees.get(treeId); }
}
