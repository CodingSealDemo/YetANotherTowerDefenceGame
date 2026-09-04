import { BigNumber } from '../utils/BigNumber';
import { BezierPath } from './BezierPath';
import { EventBus } from '../core/EventBus';
import { ErrorPipeline } from '../core/ErrorPipeline';
import {
  LevelDefinition,
  TowerDefinition,
  EnemyDefinition,
  PlacedTower,
  ActiveEnemy,
  SkillDefinition
} from '../models/GameModels';

export class GameEngine {
  private eventBus = EventBus.getInstance();
  private errorPipeline = ErrorPipeline.getInstance();

  private levelDef!: LevelDefinition;
  private path!: BezierPath;
  private towerDefs: Map<string, TowerDefinition> = new Map();
  private enemyDefs: Map<string, EnemyDefinition> = new Map();

  private baseHealth: BigNumber = new BigNumber(100);
  private currentBaseHealth: BigNumber = new BigNumber(100);
  private tookDamageInLevel: boolean = false;
  private isCombatPhase: boolean = false;
  private waveIndex: number = 0;
  private activeEnemies: ActiveEnemy[] = [];
  private placedTowers: PlacedTower[] = [];
  private purchasedSkills: Set<string> = new Set();
  private skillDefs: Map<string, SkillDefinition> = new Map();

  private currentWaveEnemiesToSpawn: { enemyId: string; interval: number }[] = [];
  private nextSpawnTime: number = 0;
  private enemyIdCounter: number = 0;

  constructor() {}

  public initializeData(
    towers: TowerDefinition[],
    enemies: EnemyDefinition[],
    skills: SkillDefinition[]
  ): void {
    towers.forEach(t => this.towerDefs.set(t.id, t));
    enemies.forEach(e => this.enemyDefs.set(e.id, e));
    skills.forEach(s => this.skillDefs.set(s.id, s));
  }

  public loadLevel(levelDef: LevelDefinition, purchasedSkills: string[] = []): void {
    try {
      this.levelDef = levelDef;
      this.path = new BezierPath(levelDef.pathPoints);
      this.baseHealth = new BigNumber(levelDef.baseHealth);
      this.currentBaseHealth = new BigNumber(levelDef.baseHealth);
      this.tookDamageInLevel = false;
      this.isCombatPhase = false;
      this.waveIndex = 0;
      this.activeEnemies = [];
      this.placedTowers = [];
      this.purchasedSkills = new Set(purchasedSkills);
      this.currentWaveEnemiesToSpawn = [];
      this.nextSpawnTime = 0;

      this.eventBus.emit('engine:levelLoaded', levelDef);
    } catch (err: any) {
      this.errorPipeline.handleError('LOAD_LEVEL_ERROR', err.message || 'Failed to load level', err);
    }
  }

  public startCombatPhase(): boolean {
    if (this.isCombatPhase) return false;
    this.isCombatPhase = true;
    this.waveIndex = 0;
    this.prepareWave(0);
    this.eventBus.emit('engine:combatStarted');
    return true;
  }

  private prepareWave(index: number): void {
    if (!this.levelDef || index >= this.levelDef.waves.length) return;
    const wave = this.levelDef.waves[index];
    this.currentWaveEnemiesToSpawn = [];
    for (let i = 0; i < wave.count; i++) {
      this.currentWaveEnemiesToSpawn.push({
        enemyId: wave.enemyId,
        interval: wave.interval
      });
    }
  }

  public placeTower(typeId: string, x: number, y: number): PlacedTower | null {
    if (this.isCombatPhase) {
      this.errorPipeline.handleError('PLACEMENT_ERROR', 'Cannot place towers during combat phase');
      return null;
    }
    const def = this.towerDefs.get(typeId);
    if (!def) {
      this.errorPipeline.handleError('TOWER_NOT_FOUND', `Tower type ${typeId} not found`);
      return null;
    }

    if (this.path.isNearPath(x, y, 20)) {
      this.errorPipeline.handleError('INVALID_LOCATION', 'Cannot place tower directly on enemy path');
      return null;
    }

    const tower: PlacedTower = {
      id: `tower_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      typeId,
      x,
      y,
      directionAngle: 0,
      spreadAngle: 45,
      lastShotTime: 0
    };

    this.placedTowers.push(tower);
    this.eventBus.emit('engine:towerPlaced', tower);
    return tower;
  }

  public removeTower(towerId: string): boolean {
    if (this.isCombatPhase) return false;
    const idx = this.placedTowers.findIndex(t => t.id === towerId);
    if (idx !== -1) {
      this.placedTowers.splice(idx, 1);
      this.eventBus.emit('engine:towerRemoved', towerId);
      return true;
    }
    return false;
  }

  public updateTowerAngleAndSpread(towerId: string, directionAngle: number, spreadAngle: number): void {
    const tower = this.placedTowers.find(t => t.id === towerId);
    if (tower) {
      tower.directionAngle = (directionAngle % 360 + 360) % 360;
      tower.spreadAngle = Math.max(10, Math.min(180, spreadAngle));
      this.eventBus.emit('engine:towerUpdated', tower);
    }
  }

  public update(deltaTime: number, currentTime: number): { waveComplete: boolean; levelFailed: boolean; levelCleared: boolean } {
    if (!this.isCombatPhase) {
      return { waveComplete: false, levelFailed: false, levelCleared: false };
    }

    if (this.currentWaveEnemiesToSpawn.length > 0 && currentTime >= this.nextSpawnTime) {
      const spawnItem = this.currentWaveEnemiesToSpawn.shift()!;
      this.spawnEnemy(spawnItem.enemyId);
      this.nextSpawnTime = currentTime + spawnItem.interval;
    }

    this.updateStealthReveals();
    this.updateTowerAttacks(currentTime);

    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.pathProgress += enemy.speed * deltaTime;

      const pos = this.path.getPointAtDistance(enemy.pathProgress);
      enemy.x = pos.x;
      enemy.y = pos.y;

      if (enemy.pathProgress >= this.path.getTotalLength()) {
        this.currentBaseHealth = this.currentBaseHealth.sub(enemy.damage);
        this.tookDamageInLevel = true;
        this.activeEnemies.splice(i, 1);
        this.eventBus.emit('engine:baseDamaged', { remainingHp: this.currentBaseHealth.toString() });

        if (this.currentBaseHealth.lte(0)) {
          this.isCombatPhase = false;
          this.eventBus.emit('engine:levelFailed');
          return { waveComplete: false, levelFailed: true, levelCleared: false };
        }
      }
    }

    if (this.currentWaveEnemiesToSpawn.length === 0 && this.activeEnemies.length === 0) {
      this.waveIndex++;
      if (this.waveIndex < this.levelDef.waves.length) {
        this.prepareWave(this.waveIndex);
      } else {
        this.isCombatPhase = false;
        const rewardCoins = new BigNumber(this.levelDef.rewardCoins);
        this.eventBus.emit('engine:levelCleared', {
          levelId: this.levelDef.id,
          flawless: !this.tookDamageInLevel,
          rewardCoins: rewardCoins.toString()
        });
        return { waveComplete: true, levelFailed: false, levelCleared: true };
      }
    }

    return { waveComplete: false, levelFailed: false, levelCleared: false };
  }

  private spawnEnemy(enemyTypeId: string, overridePos?: { x: number; y: number; progress: number }): void {
    const def = this.enemyDefs.get(enemyTypeId);
    if (!def) return;

    this.enemyIdCounter++;
    const progress = overridePos ? overridePos.progress : 0;
    const initialPos = overridePos ? { x: overridePos.x, y: overridePos.y } : this.path.getPointAtDistance(0);

    const activeEnemy: ActiveEnemy = {
      id: `enemy_${this.enemyIdCounter}_${Date.now()}`,
      typeId: enemyTypeId,
      x: initialPos.x,
      y: initialPos.y,
      currentHealth: new BigNumber(def.health),
      maxHealth: new BigNumber(def.health),
      speed: def.speed,
      reward: new BigNumber(def.reward),
      damage: new BigNumber(def.damage),
      isReinforced: def.isReinforced,
      isStealth: def.isStealth,
      isRevealed: false,
      splitsInto: def.splitsInto,
      splitCount: def.splitCount,
      pathProgress: progress,
      sprite: def.sprite
    };

    this.activeEnemies.push(activeEnemy);
  }

  private updateStealthReveals(): void {
    const detectorRanges: { x: number; y: number; range: number }[] = [];
    for (const tower of this.placedTowers) {
      const def = this.towerDefs.get(tower.typeId);
      if (def && def.canDetectStealth) {
        detectorRanges.push({ x: tower.x, y: tower.y, range: def.range });
      }
    }

    for (const enemy of this.activeEnemies) {
      if (enemy.isStealth) {
        let revealed = false;
        for (const det of detectorRanges) {
          const dx = enemy.x - det.x;
          const dy = enemy.y - det.y;
          if (dx * dx + dy * dy <= det.range * det.range) {
            revealed = true;
            break;
          }
        }
        enemy.isRevealed = revealed;
      }
    }
  }

  private updateTowerAttacks(currentTime: number): void {
    let damageMultiplier = new BigNumber(1);
    let fireRateBonus = 0;
    let rangeBonus = 0;

    this.purchasedSkills.forEach(skillId => {
      const skill = this.skillDefs.get(skillId);
      if (skill) {
        damageMultiplier = damageMultiplier.add(skill.statBonus.damageMultiplier);
        fireRateBonus += skill.statBonus.fireRateBonus;
        rangeBonus += skill.statBonus.rangeBonus;
      }
    });

    for (const tower of this.placedTowers) {
      const def = this.towerDefs.get(tower.typeId);
      if (!def) continue;

      const effectiveRange = def.range + rangeBonus;
      const effectiveFireRate = def.fireRate + fireRateBonus;
      const cooldown = 1.0 / Math.max(0.1, effectiveFireRate);

      if (currentTime - tower.lastShotTime < cooldown) continue;

      const targets = this.findTargetsInCone(tower, effectiveRange, def.canPierceArmor);

      if (targets.length > 0) {
        tower.lastShotTime = currentTime;

        let baseDmg = new BigNumber(def.damage).mul(damageMultiplier);
        const spreadFactor = 45 / Math.max(10, tower.spreadAngle);
        const finalDmg = baseDmg.mul(spreadFactor);

        for (const target of targets) {
          this.damageEnemy(target, finalDmg, def.canPierceArmor);
        }

        this.eventBus.emit('engine:towerFired', { tower, targetsCount: targets.length });
      }
    }
  }

  private findTargetsInCone(tower: PlacedTower, range: number, canPierceArmor: boolean): ActiveEnemy[] {
    const targets: ActiveEnemy[] = [];
    const dirRad = (tower.directionAngle * Math.PI) / 180;
    const halfSpreadRad = ((tower.spreadAngle / 2) * Math.PI) / 180;

    for (const enemy of this.activeEnemies) {
      if (enemy.isStealth && !enemy.isRevealed) {
        const def = this.towerDefs.get(tower.typeId);
        if (!def || !def.canDetectStealth) continue;
      }

      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > range * range) continue;

      const angleToEnemy = Math.atan2(dy, dx);
      let angleDiff = angleToEnemy - dirRad;

      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) <= halfSpreadRad) {
        targets.push(enemy);
      }
    }

    return targets;
  }

  private damageEnemy(enemy: ActiveEnemy, damage: BigNumber, canPierceArmor: boolean): void {
    let effectiveDmg = damage;

    if (enemy.isReinforced && !canPierceArmor) {
      effectiveDmg = damage.mul(0.1);
    }

    enemy.currentHealth = enemy.currentHealth.sub(effectiveDmg);

    if (enemy.currentHealth.lte(0)) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: ActiveEnemy): void {
    const idx = this.activeEnemies.indexOf(enemy);
    if (idx !== -1) {
      this.activeEnemies.splice(idx, 1);
      this.eventBus.emit('engine:enemyKilled', { reward: enemy.reward.toString() });

      if (enemy.splitsInto && enemy.splitCount > 0) {
        for (let i = 0; i < enemy.splitCount; i++) {
          const offsetProgress = Math.max(0, enemy.pathProgress - (i * 12));
          const pos = this.path.getPointAtDistance(offsetProgress);
          this.spawnEnemy(enemy.splitsInto, { x: pos.x, y: pos.y, progress: offsetProgress });
        }
      }
    }
  }

  public getActiveEnemies(): ActiveEnemy[] { return this.activeEnemies; }
  public getPlacedTowers(): PlacedTower[] { return this.placedTowers; }
  public getPath(): BezierPath { return this.path; }
  public getCurrentBaseHealth(): BigNumber { return this.currentBaseHealth; }
  public getMaxBaseHealth(): BigNumber { return this.baseHealth; }
  public isCombat(): boolean { return this.isCombatPhase; }
  public getTookDamage(): boolean { return this.tookDamageInLevel; }
}
